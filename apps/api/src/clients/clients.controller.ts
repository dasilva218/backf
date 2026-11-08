import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ClientsService } from './clients.service.js';
import { ProfilClientDto } from './profil-client.dto.js';

@ApiTags('Clients')
@Roles(UserRole.CLIENT)
@Controller('clients')
export class ClientsController {
    constructor(private readonly clients: ClientsService) { }

    @Get('moi')
    @ApiOperation({ summary: 'Profil du client connecté' })
    @ApiResponse({ status: 200, description: 'Profil client.' })
    @ApiResponse({ status: 404, description: 'Profil pas encore renseigné.' })
    lire(@CurrentUser() user: Omit<User, 'password'>) {
        return this.clients.lireProfil(user.id);
    }

    @Put('moi')
    @ApiOperation({
        summary: 'Crée ou met à jour le profil du client connecté',
        description: 'Obligatoire avant de soumettre une course.',
    })
    @ApiResponse({ status: 200, description: 'Profil enregistré.' })
    @ApiResponse({ status: 400, description: 'Erreur de validation.' })
    enregistrer(
        @CurrentUser() user: Omit<User, 'password'>,
        @Body() dto: ProfilClientDto,
    ) {
        return this.clients.enregistrerProfil(user.id, dto);
    }
}
