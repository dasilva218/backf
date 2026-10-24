import { Injectable, Logger } from '@nestjs/common';
import { Flotte, StatutLivraison } from '@prisma/client';
import { sansFlotte } from '../livraisons/flotte.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Réservation d'une course par un livreur Ewuang (v2 du contrat, §1).
 *
 * Ewuang l'appelle AVANT d'attribuer une mission à un de ses livreurs, et
 * n'attribue que sur un « oui ». La réservation pose `flotte = EWUANG` sous le
 * même verrou que l'acceptation d'un livreur find_delivery (`sansFlotte`) :
 * des deux demandes simultanées, une seule obtient la course.
 */

export interface DemandeReservation {
    mission_id?: unknown;
    reference_externe?: unknown;
    livreur?: { id?: unknown; nom?: unknown; contact?: unknown; type_vehicule?: unknown };
}

function texte(valeur: unknown, max = 200): string | null {
    return typeof valeur === 'string' && valeur.length > 0 ? valeur.slice(0, max) : null;
}

@Injectable()
export class EwuangReservationService {
    private readonly logger = new Logger(EwuangReservationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * `true` : réservée pour ce livreur (ou déjà réservée pour lui : la demande
     * est idempotente). `false` : prise par une autre flotte, annulée, ou
     * mission inconnue.
     */
    async reserver(demande: DemandeReservation): Promise<boolean> {
        const missionId = texte(demande.mission_id, 100);
        const livreurId = texte(demande.livreur?.id, 100);
        if (!missionId || !livreurId) return false;

        const course = await this.prisma.livraison.findFirst({
            where: { missionEwuangId: missionId },
            select: { id: true },
        });
        if (!course) {
            this.logger.warn(`Réservation refusée : mission ${missionId} inconnue`);
            return false;
        }

        const maintenant = new Date();
        const { count } = await this.prisma.livraison.updateMany({
            where: {
                id: course.id,
                livreurId: null,
                statut: StatutLivraison.EN_ATTENTE,
                ...sansFlotte(maintenant),
            },
            data: {
                flotte: Flotte.EWUANG,
                reserveeEwuangAt: maintenant,
                livreurEwuangId: livreurId,
                livreurNom: texte(demande.livreur?.nom),
                livreurContact: texte(demande.livreur?.contact, 50),
                livreurTypeVehicule: texte(demande.livreur?.type_vehicule, 30),
            },
        });
        if (count === 1) return true;

        // Idempotence : le même livreur redemande (Ewuang a relancé après un
        // délai dépassé). Un autre livreur, même d'Ewuang, est refusé.
        const actuelle = await this.prisma.livraison.findUnique({
            where: { id: course.id },
            select: { flotte: true, livreurEwuangId: true, statut: true },
        });
        return (
            actuelle?.flotte === Flotte.EWUANG &&
            actuelle.livreurEwuangId === livreurId &&
            actuelle.statut === StatutLivraison.EN_ATTENTE
        );
    }
}
