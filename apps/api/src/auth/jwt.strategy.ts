import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service.js';


export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        config: ConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
        });
    }

    async validate(payload: JwtPayload) {

        const user = await this.usersService.findById(payload.sub);

        // Le statut est relu à chaque requête : un compte suspendu perd l'accès
        // immédiatement, pas seulement à l'expiration de son jeton.
        if (!user || user.status !== "ACTIVE") {
            throw new UnauthorizedException("Identifiants invalides");
        }

        return user; // devient req.user
    }
}