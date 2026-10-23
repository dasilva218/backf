import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { BoutiquesService } from './boutiques.service.js';
import { ProfilBoutiqueDto } from './profil-boutique.dto.js';

@ApiTags('Boutiques')
@Roles(UserRole.BOUTIQUE)
@Controller('boutiques')
export class BoutiquesController {
    constructor(private readonly boutiques: BoutiquesService) { }

    @Get('moi')
    @ApiOperation({ summary: 'Profil de la boutique connectée' })
    @ApiResponse({ status: 200, description: 'Profil boutique.' })
    @ApiResponse({ status: 404, description: 'Profil pas encore renseigné.' })
    lire(@CurrentUser() user: Omit<User, 'password'>) {
        return this.boutiques.lireProfil(user.id);
    }

    @Put('moi')
    @ApiOperation({
        summary: 'Crée ou met à jour le profil de la boutique connectée',
        description: 'Obligatoire avant de soumettre une course.',
    })
    @ApiResponse({ status: 200, description: 'Profil enregistré.' })
    @ApiResponse({ status: 400, description: 'Erreur de validation.' })
    enregistrer(
        @CurrentUser() user: Omit<User, 'password'>,
        @Body() dto: ProfilBoutiqueDto,
    ) {
        return this.boutiques.enregistrerProfil(user.id, dto);
    }
}
