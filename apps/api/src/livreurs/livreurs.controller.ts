import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatutDossier, UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { EspecesService } from '../especes/especes.service.js';
import { LivreurCoursesService } from './livreur-courses.service.js';
import {
    DisponibiliteDto,
    EchecDto,
    EncaissementDto,
    LivrerDto,
    PositionDto,
    RefusDossierDto,
} from './livreurs.dto.js';
import { LivreursService } from './livreurs.service.js';

type Utilisateur = Omit<User, 'password'>;

/** L'API de l'application `find_delivery_mobile`. */
@ApiTags('Livreurs')
@Roles(UserRole.LIVREUR)
@Controller('livreurs')
export class LivreursController {
    constructor(
        private readonly livreurs: LivreursService,
        private readonly courses: LivreurCoursesService,
        private readonly registre: EspecesService,
    ) { }

    @Get('moi')
    @ApiOperation({ summary: 'Profil du livreur connecté, avec l’état de son dossier' })
    profil(@CurrentUser() user: Utilisateur) {
        return this.livreurs.lireProfil(user.id);
    }

    @Put('moi/disponibilite')
    @ApiOperation({ summary: 'Passe en service ou hors service' })
    disponibilite(@CurrentUser() user: Utilisateur, @Body() dto: DisponibiliteDto) {
        return this.livreurs.changerDisponibilite(user.id, dto.en_service);
    }

    @Get('moi/especes')
    @ApiOperation({
        summary: 'Espèces détenues : solde, échéance de versement, blocage éventuel, derniers mouvements',
        description: 'Solde > 0 : à verser à find_delivery sous 48 h ; < 0 : find_delivery doit au livreur. Au-delà de 50 000 FCFA ou en retard, plus de nouvelle course (R5).',
    })
    async especes(@CurrentUser() user: Utilisateur) {
        const livreur = await this.livreurs.exigerProfil(user.id);
        return this.registre.releveLivreur(livreur.id);
    }

    @Get('courses/disponibles')
    @ApiOperation({
        summary: 'Courses que le livreur peut accepter',
        description: 'Véhicule et zones compatibles, express en tête. Sans les contacts : ils ne sont servis qu’une fois la course acceptée. Dossier validé exigé.',
    })
    @ApiResponse({ status: 403, description: 'Dossier pas encore validé, ou refusé.' })
    disponibles(@CurrentUser() user: Utilisateur) {
        return this.courses.disponibles(user.id);
    }

    @Get('courses')
    @ApiOperation({ summary: 'Courses du livreur : en cours (`actives=true`) ou historique' })
    @ApiQuery({ name: 'actives', required: false, type: Boolean })
    mesCourses(
        @CurrentUser() user: Utilisateur,
        @Query('actives', new ParseBoolPipe({ optional: true })) actives?: boolean,
    ) {
        return this.courses.mesCourses(user.id, actives ?? false);
    }

    @Get('courses/:id')
    @ApiOperation({ summary: "Détail d'une course : la sienne, ou une course disponible" })
    lire(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.courses.lire(user.id, id);
    }

    @Post('courses/:id/accepter')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    @ApiOperation({
        summary: 'Accepte une course',
        description: "Premier arrivé, premier servi, contre les autres livreurs find_delivery comme contre la flotte Ewuang. La mission est retirée chez Ewuang ; s'il refuse ou ne répond pas, l'acceptation est défaite.",
    })
    @ApiResponse({ status: 403, description: 'Dossier non validé, ou espèces à verser (plafond ou délai de 48 h dépassé).' })
    @ApiResponse({ status: 409, description: 'Course prise entre-temps, ou livreur hors service.' })
    @ApiResponse({ status: 503, description: 'Ewuang injoignable : réessayer.' })
    accepter(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.courses.accepter(user.id, id);
    }

    @Post('courses/:id/rendre')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rend une course pas encore récupérée' })
    rendre(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.courses.rendre(user.id, id);
    }

    @Post('courses/:id/recuperer')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Colis récupéré chez l’expéditeur',
        description: "Si l'expéditeur paie, `montant_encaisse` doit valoir exactement les frais.",
    })
    recuperer(@CurrentUser() user: Utilisateur, @Param('id') id: string, @Body() dto: EncaissementDto) {
        return this.courses.recuperer(user.id, id, dto);
    }

    @Post('courses/:id/arrivee')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Arrivé chez le destinataire (ouvre le délai de 10 min avant un échec)' })
    arrivee(@CurrentUser() user: Utilisateur, @Param('id') id: string) {
        return this.courses.arrivee(user.id, id);
    }

    @Post('courses/:id/livrer')
    @HttpCode(HttpStatus.OK)
    // Le compteur d'essais protège déjà le code ; ce seau freine en plus le
    // martèlement d'une même route.
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({
        summary: 'Remet le colis contre le code du destinataire',
        description: "`montant_encaisse` = exactement ce qui est dû à la remise (frais si le destinataire paie, plus la marchandise). 5 essais de code au plus.",
    })
    @ApiResponse({ status: 400, description: 'Code ou montant incorrect.' })
    @ApiResponse({ status: 409, description: 'Code bloqué après 5 essais, ou course pas en cours.' })
    livrer(@CurrentUser() user: Utilisateur, @Param('id') id: string, @Body() dto: LivrerDto) {
        return this.courses.livrer(user.id, id, dto);
    }

    @Post('courses/:id/echec')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Échec de remise : le colis repart à l’expéditeur',
        description: "Possible 10 min après l'arrivée chez le destinataire.",
    })
    echec(@CurrentUser() user: Utilisateur, @Param('id') id: string, @Body() dto: EchecDto) {
        return this.courses.echec(user.id, id, dto);
    }

    @Post('courses/:id/retourner')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Colis rendu à l'expéditeur",
        description: "Si le destinataire devait payer, l'expéditeur doit les frais de l'aller : `montant_encaisse` doit les valoir.",
    })
    retourner(@CurrentUser() user: Utilisateur, @Param('id') id: string, @Body() dto: EncaissementDto) {
        return this.courses.retourner(user.id, id, dto);
    }

    @Post('courses/:id/position')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 12, ttl: 60_000 } })
    @ApiOperation({ summary: 'Position du livreur pendant une course (toutes les 15 s au plus)' })
    position(@CurrentUser() user: Utilisateur, @Param('id') id: string, @Body() dto: PositionDto) {
        return this.courses.enregistrerPosition(user.id, id, dto);
    }
}

/** Interventions d'un ADMIN sur les courses de la flotte find_delivery. */
@ApiTags('Administration — courses')
@Roles(UserRole.ADMIN)
@Controller('admin/courses')
export class AdminCoursesController {
    constructor(private readonly courses: LivreurCoursesService) { }

    @Post(':id/cloturer')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Clôture sans code une course en cours de la flotte find_delivery',
        description: "Code bloqué après 5 essais, ou perdu par le destinataire. `montant_encaisse` = exactement ce qui est dû à la remise, comme pour le livreur ; les écritures au registre sont les mêmes.",
    })
    @ApiResponse({ status: 400, description: 'Montant incorrect.' })
    @ApiResponse({ status: 409, description: 'Course pas en cours de livraison.' })
    cloturer(@CurrentUser() admin: Utilisateur, @Param('id') id: string, @Body() dto: EncaissementDto) {
        return this.courses.cloturerParAdmin(admin.id, id, dto);
    }
}

/** Validation des dossiers, par un ADMIN, pièces vérifiées au bureau. */
@ApiTags('Administration — livreurs')
@Roles(UserRole.ADMIN)
@Controller('admin/livreurs')
export class AdminLivreursController {
    constructor(private readonly livreurs: LivreursService) { }

    @Get()
    @ApiOperation({ summary: 'Livreurs, filtrés par état de dossier' })
    @ApiQuery({ name: 'statut', required: false, enum: StatutDossier })
    lister(@Query('statut') statut?: string) {
        const filtre = Object.values(StatutDossier).find((s) => s === statut);
        return this.livreurs.listerPourAdmin(filtre);
    }

    @Post(':id/valider')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Valide le dossier : le livreur peut prendre des courses' })
    valider(@Param('id') id: string) {
        return this.livreurs.valider(id);
    }

    @Post(':id/refuser')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refuse le dossier, avec un motif lu par le livreur' })
    refuser(@Param('id') id: string, @Body() dto: RefusDossierDto) {
        return this.livreurs.refuser(id, dto.motif);
    }
}
