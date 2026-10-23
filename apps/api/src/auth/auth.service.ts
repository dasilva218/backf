import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './authDto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from './authDto/create_user.dto.js';
import { UserRole } from '@prisma/client';

// Hash bcrypt (coût 10) d'une valeur aléatoire jetée : sert seulement à donner
// au login d'un e-mail inconnu la même durée qu'un vrai `bcrypt.compare`.
const HASH_FACTICE = '$2b$10$sby6mQK/KKd0y6xcvUcJFOeX1LFmiQNow8vCIoU0uRFl4Piv2pRVO';


@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService
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
        // L'inscription publique ne crée que des boutiques : les comptes ADMIN
        // et LIVREUR se créent hors de cette route.
        const resultUser = await this.usersService.create({
            email: createUserDto.email,
            password: await this.hashPassword(createUserDto.password),
            role: UserRole.BOUTIQUE,
        });

        // genrer un token
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

    private async generateToken(payload: { sub: string, email: string, role: string }) {
        return await this.jwtService.signAsync(payload);
    }


}
