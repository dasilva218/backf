import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('users')
export class UsersController {

    constructor(private readonly usersService: UsersService) { }


    @Get('me')
    me(@CurrentUser() user: unknown) {
        return user;
    }

    @Get()
    @Roles(UserRole.ADMIN)
    findAll() {
        return this.usersService.findAllUsers();
    }

    @Public()
    @Get('controle')
    controle() {
        return 'Road controle'
    }


}
