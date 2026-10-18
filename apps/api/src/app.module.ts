import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]), UsersModule, PrismaModule, AuthModule],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 1. limite le débit
    { provide: APP_GUARD, useClass: JwtAuthGuard },   // 2. authentifie
    { provide: APP_GUARD, useClass: RolesGuard },]     // 3. vérifie le rôle],
})
export class AppModule { }
