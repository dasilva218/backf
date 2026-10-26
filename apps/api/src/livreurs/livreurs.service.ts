import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatutDossier, type Livreur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { vehiculeDuTransport } from './vehicules.js';

/**
 * Profil des livreurs find_delivery, et validation de leur dossier.
 *
 * Le dossier est vérifié par un ADMIN, pièces en main, au bureau : pas de
 * dépôt de fichiers au lancement (find_delivery n'a pas de stockage). Tant
 * qu'il n'est pas VALIDE, le livreur se connecte, voit son profil, mais
 * aucune course ne lui est proposée ni ne peut être acceptée.
 */

const CHAMPS_ADMIN = {
    id: true,
    firstname: true,
    lastname: true,
    phoneAirtel: true,
    phoneMoov: true,
    moyenTransport: true,
    immatriculation: true,
    zoneGeographique: true,
    statutDossier: true,
    motifRefus: true,
    dossierTraiteAt: true,
    nombreLivraisons: true,
    estDisponible: true,
    createdAt: true,
    user: { select: { email: true, status: true } },
} satisfies Prisma.LivreurSelect;

@Injectable()
export class LivreursService {
    constructor(private readonly prisma: PrismaService) { }

    async exigerProfil(userId: string): Promise<Livreur> {
        const livreur = await this.prisma.livreur.findUnique({ where: { userLivreurId: userId } });
        if (!livreur) {
            throw new NotFoundException('Profil livreur introuvable');
        }
        return livreur;
    }

    /** La garde du KYC : rien ne se fait sur une course sans dossier validé. */
    async exigerValide(userId: string): Promise<Livreur> {
        const livreur = await this.exigerProfil(userId);
        if (livreur.statutDossier === StatutDossier.EN_ATTENTE) {
            throw new ForbiddenException(
                "Votre dossier n'est pas encore validé. Passez au bureau Avoo avec vos pièces.",
            );
        }
        if (livreur.statutDossier === StatutDossier.REFUSE) {
            throw new ForbiddenException(
                `Votre dossier a été refusé${livreur.motifRefus ? ` : ${livreur.motifRefus}` : ''}.`,
            );
        }
        return livreur;
    }

    async lireProfil(userId: string) {
        return this.vue(await this.exigerProfil(userId));
    }

    async changerDisponibilite(userId: string, enService: boolean) {
        const livreur = await this.exigerProfil(userId);
        return this.vue(
            await this.prisma.livreur.update({
                where: { id: livreur.id },
                data: { estDisponible: enService },
            }),
        );
    }

    listerPourAdmin(statut?: StatutDossier) {
        return this.prisma.livreur.findMany({
            where: statut ? { statutDossier: statut } : {},
            select: CHAMPS_ADMIN,
            orderBy: { createdAt: 'desc' },
        });
    }

    valider(livreurId: string) {
        return this.traiterDossier(livreurId, { statutDossier: StatutDossier.VALIDE, motifRefus: null });
    }

    refuser(livreurId: string, motif: string) {
        return this.traiterDossier(livreurId, { statutDossier: StatutDossier.REFUSE, motifRefus: motif });
    }

    private async traiterDossier(livreurId: string, donnees: Prisma.LivreurUpdateInput) {
        try {
            return await this.prisma.livreur.update({
                where: { id: livreurId },
                data: { ...donnees, dossierTraiteAt: new Date() },
                select: CHAMPS_ADMIN,
            });
        } catch (erreur) {
            if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2025') {
                throw new NotFoundException('Livreur introuvable');
            }
            throw erreur;
        }
    }

    /** Ce que le livreur voit de lui-même, dans le vocabulaire de l'application. */
    private vue(livreur: Livreur) {
        return {
            id: livreur.id,
            firstname: livreur.firstname,
            lastname: livreur.lastname,
            phoneAirtel: livreur.phoneAirtel,
            phoneMoov: livreur.phoneMoov,
            typeVehicule: vehiculeDuTransport(livreur.moyenTransport),
            immatriculation: livreur.immatriculation,
            zones: livreur.zoneGeographique,
            statutDossier: livreur.statutDossier,
            motifRefus: livreur.motifRefus,
            enService: livreur.estDisponible,
            nombreLivraisons: livreur.nombreLivraisons,
        };
    }
}
