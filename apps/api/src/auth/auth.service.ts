import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { LoginDto } from './authDto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from './authDto/create_user.dto.js';
import { UserRole } from '@prisma/client';
import { InscriptionLivreurDto } from '../livreurs/livreurs.dto.js';
import { TRANSPORT_PAR_VEHICULE } from '../livreurs/vehicules.js';
import { EmailService } from './email.service.js';

// Hash bcrypt (coût 10) d'une valeur aléatoire jetée : sert seulement à donner
// au login d'un e-mail inconnu la même durée qu'un vrai `bcrypt.compare`.
const HASH_FACTICE =
  '$2b$10$sby6mQK/KKd0y6xcvUcJFOeX1LFmiQNow8vCIoU0uRFl4Piv2pRVO';

const BUT_REINITIALISATION = 'reinitialisation';
const DUREE_LIEN_REINITIALISATION = '30m';
const LIEN_INVALIDE =
  'Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

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

    if (!isUser || !passwordMatches || isUser.status !== 'ACTIVE') {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload = { sub: isUser.id, email: isUser.email, role: isUser.role };
    const accessToken = await this.generateToken(payload);

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
    const payload = {
      sub: resultUser.id,
      email: resultUser.email,
      role: resultUser.role,
    };
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

    const payload = {
      sub: resultUser.id,
      email: resultUser.email,
      role: resultUser.role,
    };
    const accessToken = await this.generateToken(payload);
    return { ...resultUser, accessToken };
  }

  /**
   * Envoie un lien de réinitialisation, s'il existe un compte actif pour cet
   * e-mail. Ne dit jamais si le compte existe (le contrôleur répond pareil
   * dans tous les cas, sans attendre cette méthode) et ne lève jamais.
   *
   * Aucune table : le lien porte un JWT de 30 min signé avec `JWT_SECRET` ET
   * le hash actuel du mot de passe. Dès que le mot de passe change, la
   * signature ne correspond plus : le lien est à usage unique, et toute
   * demande antérieure meurt avec lui.
   */
  async demanderReinitialisation(email: string): Promise<void> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user || user.status !== 'ACTIVE') return;

      const urlWeb = this.urlWeb();
      if (!urlWeb) {
        this.logger.error(
          'Lien de réinitialisation non envoyé : WEB_URL absente.',
        );
        return;
      }

      const jeton = await this.jwtService.signAsync(
        { sub: user.id, but: BUT_REINITIALISATION },
        {
          secret: this.secretReinitialisation(user.password),
          expiresIn: DUREE_LIEN_REINITIALISATION,
        },
      );
      const lien = `${urlWeb}/reinitialiser-mot-de-passe?jeton=${encodeURIComponent(jeton)}`;

      if (
        !this.emailService.estConfigure &&
        process.env.NODE_ENV !== 'production'
      ) {
        // En développement seulement : sans Resend, le lien n'a pas d'autre chemin.
        this.logger.warn(
          `[dev] Lien de réinitialisation pour ${user.email} : ${lien}`,
        );
        return;
      }

      await this.emailService.envoyer({
        a: user.email,
        sujet: 'Réinitialisation de votre mot de passe Avoo',
        texte:
          `Bonjour,\n\nVous avez demandé à réinitialiser le mot de passe de votre compte Avoo.\n` +
          `Ouvrez ce lien pour en choisir un nouveau (valable 30 minutes, une seule fois) :\n\n${lien}\n\n` +
          `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.\n`,
        html:
          `<p>Bonjour,</p>` +
          `<p>Vous avez demandé à réinitialiser le mot de passe de votre compte Avoo.</p>` +
          `<p><a href="${lien}">Choisir un nouveau mot de passe</a></p>` +
          `<p>Ce lien est valable 30 minutes et ne sert qu'une fois.</p>` +
          `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>`,
      });
    } catch (erreur) {
      this.logger.error(
        `Demande de réinitialisation en échec : ${(erreur as Error).message}`,
      );
    }
  }

  /**
   * Les sessions déjà ouvertes restent valides jusqu'à leur expiration (JWT
   * sans état) ; pour couper un accès sur-le-champ, suspendre le compte.
   */
  async reinitialiserMotDePasse(
    jeton: string,
    password: string,
  ): Promise<void> {
    const charge = this.jwtService.decode<{
      sub?: unknown;
      but?: unknown;
    } | null>(jeton);
    if (
      !charge ||
      typeof charge.sub !== 'string' ||
      charge.but !== BUT_REINITIALISATION
    ) {
      throw new BadRequestException(LIEN_INVALIDE);
    }

    const user = await this.usersService.findByIdAvecMotDePasse(charge.sub);
    if (!user || user.status !== 'ACTIVE')
      throw new BadRequestException(LIEN_INVALIDE);

    try {
      await this.jwtService.verifyAsync(jeton, {
        secret: this.secretReinitialisation(user.password),
      });
    } catch {
      throw new BadRequestException(LIEN_INVALIDE);
    }

    const remplace = await this.usersService.remplacerMotDePasse(
      user.id,
      user.password,
      await this.hashPassword(password),
    );
    if (!remplace) throw new BadRequestException(LIEN_INVALIDE);
  }

  private secretReinitialisation(hashMotDePasse: string): string {
    return `${this.config.getOrThrow<string>('JWT_SECRET')}:${hashMotDePasse}`;
  }

  /** Racine du site client, sans barre finale. Obligatoire en production. */
  private urlWeb(): string | null {
    const url = this.config.get<string>('WEB_URL');
    if (url) return url.replace(/\/+$/, '');
    return process.env.NODE_ENV === 'production'
      ? null
      : 'http://localhost:3000';
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
  private async generateToken(payload: {
    sub: string;
    email: string;
    role: string;
  }) {
    if (payload.role === UserRole.LIVREUR) {
      return await this.jwtService.signAsync(payload, {
        expiresIn: this.config.get<string>(
          'JWT_EXPIRES_IN_LIVREUR',
          '12h',
        ) as JwtSignOptions['expiresIn'],
      });
    }
    return await this.jwtService.signAsync(payload);
  }
}
