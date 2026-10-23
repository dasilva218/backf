import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreerLivraisonDto } from './creer-livraison.dto.js';
import { ListerLivraisonsDto } from './lister-livraisons.dto.js';
import { LivraisonsService } from './livraisons.service.js';

type Utilisateur = Omit<User, 'password'>;

@ApiTags('Livraisons')
@Roles(UserRole.BOUTIQUE, UserRole.ADMIN)
@Controller('livraisons')
export class LivraisonsController {
    constructor(private readonly livraisons: LivraisonsService) { }

    @Post()
    @Roles(UserRole.BOUTIQUE)
    @ApiOperation({
        summary: 'Soumet une course, dispatchée à la flotte Ewuang',
        description:
            "Le prix vient de la grille find_delivery (zone d'arrivée + type). Le `codeRemise` renvoyé est à transmettre au destinataire : le livreur le lui réclamera à la remise.",
    })
    @ApiResponse({ status: 201, description: 'Course créée et transmise à Ewuang.' })
    @ApiResponse({
        status: 202,
        description:
            'Course enregistrée mais Ewuang injoignable : `transmise` vaut false, à rejouer par POST /livraisons/:id/renvoyer.',
    })
    @ApiResponse({ status: 400, description: "Erreur de validation, ou course refusée par Ewuang (elle est alors annulée)." })
    @ApiResponse({ status: 403, description: 'Profil boutique non renseigné.' })
    async creer(
        @CurrentUser() user: Utilisateur,
        @Body() dto: CreerLivraisonDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const resultat = await this.livraisons.creer(user, dto);
        res.status(resultat.transmise ? HttpStatus.CREATED : HttpStatus.ACCEPTED);
        return resultat;
    }

    @Get()
    @ApiOperation({ summary: 'Courses de la boutique connectée (toutes pour un ADMIN), les plus récentes en tête' })
    @ApiResponse({ status: 200, description: 'Page de courses : `donnees`, `total`, `page`, `limite`.' })
    lister(@CurrentUser() user: Utilisateur, @Query() query: ListerLivraisonsDto) {
        return this.livraisons.lister(user, query);
    }

    @Get(':id')
    @ApiOperation({ summary: "Détail d'une course" })
    @ApiResponse({ status: 200, description: 'Course, avec la demande envoyée à Ewuang.' })
    @ApiResponse({ status: 404, description: 'Course introuvable.' })
    lire(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.livraisons.lire(user, id);
    }

    @Post(':id/renvoyer')
    @ApiOperation({
        summary: "Rejoue la transmission d'une course non transmise à Ewuang",
        description: 'Sans risque de doublon : Ewuang est idempotent sur la référence de la course.',
    })
    @ApiResponse({ status: 201, description: 'Course transmise.' })
    @ApiResponse({ status: 202, description: 'Ewuang toujours injoignable.' })
    @ApiResponse({ status: 400, description: 'Course refusée par Ewuang (elle est alors annulée).' })
    @ApiResponse({ status: 409, description: 'Course déjà transmise ou annulée.' })
    async renvoyer(
        @CurrentUser() user: Utilisateur,
        @Param('id') id: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const resultat = await this.livraisons.renvoyer(user, id);
        res.status(resultat.transmise ? HttpStatus.CREATED : HttpStatus.ACCEPTED);
        return resultat;
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Annule une course',
        description: "Possible jusqu'à la récupération du colis par le livreur. Au-delà, passer par le support.",
    })
    @ApiResponse({ status: 200, description: 'Course annulée.' })
    @ApiResponse({ status: 400, description: "Refusée par Ewuang (colis déjà récupéré)." })
    @ApiResponse({ status: 409, description: 'Course déjà annulée ou livrée.' })
    @ApiResponse({ status: 503, description: "Ewuang injoignable : l'annulation n'est pas garantie, réessayer." })
    annuler(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.livraisons.annuler(user, id);
    }
}
