import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { LoginDto } from './authDto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from './authDto/create_user.dto.js';
import { UserRole } from '@prisma/client';
import { InscriptionLivreurDto } from '../livreurs/livreurs.dto.js';
import { TRANSPORT_PAR_VEHICULE } from '../livreurs/vehicules.js';

// Hash bcrypt (coût 10) d'une valeur aléatoire jetée : sert seulement à donner
// au login d'un e-mail inconnu la même durée qu'un vrai `bcrypt.compare`.
const HASH_FACTICE = '$2b$10$sby6mQK/KKd0y6xcvUcJFOeX1LFmiQNow8vCIoU0uRFl4Piv2pRVO';


@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) { }

    async login(LoginDto: LoginDto) {
        // verifi si l'utilisateur existe
        const isUser = await this.usersService.findByEmail(LoginDto.email);

        // Le mot de passe est toujours comparé, même pour un e-mail inconnu
        // (contre un hash factice) : sans cela, la durée de réponse dit si le
        // compte existe. Le statut n'est examiné qu'après un mot de passe
        // correct, et le refus reste le même message, pour qu'un tiers ne
        // puisse pas savoir qu'un compte est suspendu.
        const passwordMatches = await this.comparePassword(
            LoginDto.password,
            isUser?.password ?? HASH_FACTICE,
        );

        if (!isUser || !passwordMatches || isUser.status !== "ACTIVE") {
            throw new UnauthorizedException('Identifiants invalides');
        }

        const payload = { sub: isUser.id, email: isUser.email, role: isUser.role };
        const accessToken = await this.generateToken(payload)

        const { password, ...result } = isUser;

        return { ...result, accessToken };
    }

    async register(createUserDto: CreateUserDto) {
        // L'inscription publique ne crée que des clients : les comptes ADMIN
        // et LIVREUR se créent hors de cette route.
        const resultUser = await this.usersService.create({
            email: createUserDto.email,
            password: await this.hashPassword(createUserDto.password),
            role: UserRole.CLIENT,
        });

        // genrer un token
        const payload = { sub: resultUser.id, email: resultUser.email, role: resultUser.role };
        const accessToken = await this.generateToken(payload);

        return { ...resultUser, accessToken };

    }

    /**
     * Inscription d'un livreur find_delivery, compte et profil d'un coup.
     *
     * Le compte est ACTIVE pour qu'il puisse se connecter et suivre son
     * dossier ; c'est `Livreur.statutDossier` (EN_ATTENTE) qui le tient à
     * l'écart des courses tant qu'un ADMIN ne l'a pas validé.
     */
    async registerLivreur(dto: InscriptionLivreurDto) {
        const resultUser = await this.usersService.create({
            email: dto.email,
            password: await this.hashPassword(dto.password),
            role: UserRole.LIVREUR,
            name: `${dto.firstname} ${dto.lastname}`,
            livreurProfile: {
                create: {
                    firstname: dto.firstname,
                    lastname: dto.lastname,
                    phoneAirtel: dto.phoneAirtel || null,
                    phoneMoov: dto.phoneMoov || null,
                    moyenTransport: TRANSPORT_PAR_VEHICULE[dto.type_vehicule],
                    immatriculation: dto.immatriculation || null,
                    zoneGeographique: dto.zones,
                },
            },
        });

        const payload = { sub: resultUser.id, email: resultUser.email, role: resultUser.role };
        const accessToken = await this.generateToken(payload);
        return { ...resultUser, accessToken };
    }

    private async hashPassword(password: string) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }

    private async comparePassword(password: string, hash: string) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Un livreur garde sa session une journée de travail (12 h par défaut) :
     * le reconnecter toutes les 30 min, au guidon, n'est pas tenable. Le
     * risque reste borné : `JwtStrategy` relit le statut du compte à chaque
     * requête, une suspension coupe donc l'accès sur-le-champ.
     */
    private async generateToken(payload: { sub: string, email: string, role: string }) {
        if (payload.role === UserRole.LIVREUR) {
            return await this.jwtService.signAsync(payload, {
                expiresIn: this.config.get<string>('JWT_EXPIRES_IN_LIVREUR', '12h') as JwtSignOptions['expiresIn'],
            });
        }
        return await this.jwtService.signAsync(payload);
    }


}
