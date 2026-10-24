import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MouvementsQueryDto, ReglementDto } from './especes.dto.js';
import { EspecesService } from './especes.service.js';

type Utilisateur = Omit<User, 'password'>;

/** Le registre des espèces, côté ADMIN : encours, dus, règlements contre reçu. */
@ApiTags('Administration — espèces')
@Roles(UserRole.ADMIN)
@Controller('admin/especes')
export class AdminEspecesController {
    constructor(private readonly especes: EspecesService) { }

    @Get('livreurs')
    @ApiOperation({
        summary: 'Espèces détenues par chaque livreur',
        description: 'Solde > 0 : à verser à find_delivery ; < 0 : find_delivery lui doit. Avec l’échéance de 48 h et le blocage éventuel (R5).',
    })
    encoursLivreurs() {
        return this.especes.encoursLivreurs();
    }

    @Get('clients')
    @ApiOperation({ summary: 'Contre-remboursements encaissés et pas encore reversés, par client' })
    dusClients() {
        return this.especes.dusClients();
    }

    @Get('mouvements')
    @ApiOperation({ summary: 'Journal du registre, filtrable par livreur ou par client' })
    mouvements(@Query() filtre: MouvementsQueryDto) {
        return this.especes.mouvements(filtre);
    }

    @Get('ewuang')
    @ApiOperation({
        summary: 'Compte Ewuang : ce que ses livreurs ont encaissé sur nos courses, moins ce que ces courses lui coûtent',
        description: 'du > 0 : Ewuang nous doit ; < 0 : nous lui devons. Base du relevé périodique (contrat v2).',
    })
    releveEwuang() {
        return this.especes.releveEwuang();
    }

    @Post('ewuang/reglements-recus')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Ewuang nous règle le relevé, contre un reçu' })
    @ApiResponse({ status: 400, description: 'Montant supérieur à ce qu’Ewuang nous doit.' })
    @ApiResponse({ status: 409, description: 'Reçu déjà enregistré.' })
    recevoirDEwuang(@CurrentUser() admin: Utilisateur, @Body() dto: ReglementDto) {
        return this.especes.recevoirDEwuang(dto, admin.id);
    }

    @Post('ewuang/reglements-verses')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Nous réglons Ewuang quand le relevé est en sa faveur, contre un reçu' })
    @ApiResponse({ status: 400, description: 'Montant supérieur à ce que nous devons à Ewuang.' })
    @ApiResponse({ status: 409, description: 'Reçu déjà enregistré.' })
    verserAEwuang(@CurrentUser() admin: Utilisateur, @Body() dto: ReglementDto) {
        return this.especes.verserAEwuang(dto, admin.id);
    }

    @Post('livreurs/:id/versements')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Le livreur remet des espèces à find_delivery, contre un reçu' })
    @ApiResponse({ status: 400, description: 'Montant supérieur à ce que le livreur détient.' })
    @ApiResponse({ status: 409, description: 'Reçu déjà enregistré.' })
    verser(@CurrentUser() admin: Utilisateur, @Param('id') id: string, @Body() dto: ReglementDto) {
        return this.especes.verser(id, dto, admin.id);
    }

    @Post('livreurs/:id/paiements')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'find_delivery paie un livreur dont le solde est négatif, contre un reçu' })
    @ApiResponse({ status: 400, description: 'Montant supérieur à ce qui est dû au livreur.' })
    @ApiResponse({ status: 409, description: 'Reçu déjà enregistré.' })
    payer(@CurrentUser() admin: Utilisateur, @Param('id') id: string, @Body() dto: ReglementDto) {
        return this.especes.payer(id, dto, admin.id);
    }

    @Post('clients/:id/reversements')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'find_delivery reverse au client la marchandise encaissée pour lui, contre un reçu' })
    @ApiResponse({ status: 400, description: 'Montant supérieur à ce qui est dû au client.' })
    @ApiResponse({ status: 409, description: 'Reçu déjà enregistré.' })
    reverser(@CurrentUser() admin: Utilisateur, @Param('id') id: string, @Body() dto: ReglementDto) {
        return this.especes.reverser(id, dto, admin.id);
    }
}

/** Ce que find_delivery doit au client connecté. */
@ApiTags('Clients')
@Roles(UserRole.CLIENT)
@Controller('clients/moi/especes')
export class ClientEspecesController {
    constructor(
        private readonly especes: EspecesService,
        private readonly prisma: PrismaService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Contre-remboursements encaissés pour le client et pas encore reversés, avec l’historique' })
    async releve(@CurrentUser() user: Utilisateur) {
        const client = await this.prisma.client.findUnique({ where: { userClientId: user.id }, select: { id: true } });
        if (!client) throw new NotFoundException('Profil client introuvable');
        return this.especes.releveClient(client.id);
    }
}
