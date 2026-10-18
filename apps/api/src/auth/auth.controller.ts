import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './authDto/login.dto.js';
import { CreateUserDto } from './authDto/create_user.dto.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }


  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enregistre un nouvel utilisateur (Admin, Boutique ou Livreur)' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès.', type: CreateUserDto })
  @ApiResponse({ status: 400, description: "Erreur de validation ou données invalides." })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connecte un utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: "Identifiants invalides." })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
