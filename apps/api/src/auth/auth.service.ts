import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './authDto/login.dto.js';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from './authDto/create_user.dto.js';


@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService
    ) { }

    async login(LoginDto: LoginDto) {
        // verifi si l'utilisateur existe
        const isUser = await this.usersService.findByEmail(LoginDto.email);

        // si utilisateur n'existe pas
        if (!isUser) {
            throw new UnauthorizedException('Identifiants invalides');
        }

        // si utilisateur existe on verifie si son statut est ACTIF
        if (isUser.status !== "ACTIVE") {
            throw new UnauthorizedException('Utilisateur non actif');
        }

        // On compare le mot de passe hashé avec celui fourni
        const passwordMatches = await this.comparePassword(LoginDto.password, isUser.password);

        // si le mot de passe est incorrect
        if (!passwordMatches) {
            throw new UnauthorizedException('Identifiants invalides');
        }

        const payload = { sub: isUser.id, email: isUser.email, role: isUser.role };
        const accessToken = await this.generateToken(payload)

        const { password, ...result } = isUser;

        return { ...result, accessToken };
    }

    async register(createUserDto: CreateUserDto) {
        // controle si l'utilisateur existe deja
        const isUser = await this.usersService.findByEmail(createUserDto.email);

        // creer le nouvel utilisateur
        const newUser: CreateUserDto = {
            email: createUserDto.email,
            password: await this.hashPassword(createUserDto.password),
            role: createUserDto.role
        }
        // enregistrer le nouvel utilisateur
        const resultUser = await this.usersService.create(newUser);

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
