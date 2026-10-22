import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { DevisQueryDto } from './devis-query.dto.js';
import { calculerDevis, lireGrille, type Devis } from './grille-tarifs.js';

/**
 * Ce que le client voit d'un devis : le prix, jamais sa décomposition.
 * `commission` et `tarifEwuang` sont la marge de find_delivery et ce qu'elle
 * paie à Ewuang — réservés à l'ADMIN, comme dans `livraisons.service.ts`.
 */
function prixClient({ zoneDepart, zoneArrivee, typeCourse, tarif, devise }: Devis) {
    return { zoneDepart, zoneArrivee, typeCourse, tarif, devise };
}

@ApiTags('Tarifs')
@Controller('tarifs')
export class TarifsController {
    /**
     * Public : la grille est affichée sur la page d'accueil, avant toute
     * inscription. Elle ne porte que des prix déjà publics.
     */
    @Public()
    @Get()
    @ApiOperation({ summary: "Grille complète des prix, par trajet (départ → arrivée) et type de course — seule la zone d'arrivée fixe le prix" })
    @ApiResponse({ status: 200, description: 'Prix client en FCFA.' })
    lireGrille() {
        return lireGrille().map(prixClient);
    }

    @Get('devis')
    @ApiOperation({ summary: "Prix d'une course pour un trajet et un type de course" })
    @ApiResponse({ status: 200, description: 'Prix client en FCFA.' })
    @ApiResponse({ status: 400, description: 'Zone ou type de course invalide.' })
    deviser(@Query() query: DevisQueryDto) {
        return prixClient(calculerDevis(query.zone_depart, query.zone_arrivee, query.type_course));
    }
}
