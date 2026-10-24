import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { ThrottlerParCompteGuard } from './auth/guards/throttler-par-compte.guard.js';
import { EwuangModule } from './ewuang/ewuang.module.js';
import { TarifsModule } from './tarifs/tarifs.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { LivraisonsModule } from './livraisons/livraisons.module.js';
import { LivreursModule } from './livreurs/livreurs.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]), UsersModule, PrismaModule, AuthModule, EwuangModule, TarifsModule, ClientsModule, LivraisonsModule, LivreursModule],
  controllers: [],
  providers: [
    // L'ordre compte : le limiteur compte par compte, il a besoin de `req.user`.
    { provide: APP_GUARD, useClass: JwtAuthGuard },            // 1. authentifie
    { provide: APP_GUARD, useClass: ThrottlerParCompteGuard }, // 2. limite le débit
    { provide: APP_GUARD, useClass: RolesGuard },]             // 3. vérifie le rôle
})
export class AppModule { }
