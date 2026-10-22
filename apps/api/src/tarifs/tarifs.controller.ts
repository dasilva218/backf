import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevisQueryDto } from './devis-query.dto.js';
import { calculerDevis, lireGrille } from './grille-tarifs.js';

/**
 * Consultation des tarifs par une boutique connectée, avant de soumettre une
 * course. Pas de `@Public()` : le `JwtAuthGuard` global s'applique.
 */
@ApiTags('Tarifs')
@Controller('tarifs')
export class TarifsController {
    @Get()
    @ApiOperation({ summary: 'Grille complète des tarifs, par trajet (départ → arrivée) et type de course' })
    @ApiResponse({ status: 200, description: 'Grille en FCFA : prix client, commission find_delivery et part Ewuang.' })
    lireGrille() {
        return lireGrille();
    }

    @Get('devis')
    @ApiOperation({ summary: "Prix d'une course pour un trajet et un type de course" })
    @ApiResponse({ status: 200, description: 'Devis en FCFA : prix client, commission find_delivery et part Ewuang.' })
    @ApiResponse({ status: 400, description: 'Zone ou type de course invalide.' })
    deviser(@Query() query: DevisQueryDto) {
        return calculerDevis(query.zone_depart, query.zone_arrivee, query.type_course);
    }
}
