import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './authDto/login.dto.js';
import { CreateUserDto } from './authDto/create_user.dto.js';
import {
  DemandeReinitialisationDto,
  ReinitialisationDto,
} from './authDto/mot_de_passe.dto.js';
import { InscriptionLivreurDto } from '../livreurs/livreurs.dto.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator.js';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crée un compte client (particulier, entreprise ou boutique)',
  })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès.',
    type: CreateUserDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Erreur de validation ou données invalides.',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/livreur')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crée un compte livreur find_delivery',
    description:
      'Le compte peut se connecter tout de suite, mais aucune course ne lui est proposée avant la validation de son dossier par un administrateur.',
  })
  @ApiResponse({
    status: 201,
    description: 'Livreur inscrit, dossier en attente.',
  })
  @ApiResponse({ status: 409, description: 'E-mail déjà utilisé.' })
  async registerLivreur(@Body() dto: InscriptionLivreurDto) {
    return this.authService.registerLivreur(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // par e-mail, voir ThrottlerParCompteGuard
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connecte un utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides.' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } }) // par e-mail : freine l'envoi en rafale à une même boîte
  @Post('mot-de-passe/oubli')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoie un lien de réinitialisation du mot de passe',
    description:
      'Répond toujours 200, que le compte existe ou non. Le lien, valable 30 min et à usage unique, part par e-mail.',
  })
  @ApiResponse({ status: 200, description: 'Demande prise en compte.' })
  demanderReinitialisation(@Body() body: DemandeReinitialisationDto) {
    // Non attendu : la durée de réponse ne doit pas dire si un e-mail est parti.
    void this.authService.demanderReinitialisation(body.email);
    return {
      message:
        'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mot-de-passe/reinitialiser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Choisit un nouveau mot de passe à partir du lien reçu par e-mail',
  })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié.' })
  @ApiResponse({
    status: 400,
    description:
      'Lien invalide, expiré ou déjà utilisé, ou mot de passe non conforme.',
  })
  async reinitialiserMotDePasse(@Body() body: ReinitialisationDto) {
    await this.authService.reinitialiserMotDePasse(body.jeton, body.password);
    return { message: 'Mot de passe modifié.' };
  }
}
