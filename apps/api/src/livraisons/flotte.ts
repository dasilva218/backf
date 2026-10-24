import { Flotte, type Prisma } from '@prisma/client';

/**
 * Le verrou de flotte : à qui est une course qui n'a pas encore de livreur.
 *
 * Une course est proposée en même temps à la flotte find_delivery et à Ewuang.
 * Elle passe d'« aucune flotte » à une flotte par UNE mise à jour conditionnée
 * par `sansFlotte` : l'acceptation d'un livreur find_delivery
 * (livreur-courses.service.ts) ou la réservation d'un livreur Ewuang
 * (ewuang-reservation.service.ts). Deux demandes simultanées, une seule
 * obtient la ligne.
 */

/**
 * Délai de confirmation d'une réservation Ewuang par `mission.attribuee` (v2
 * du contrat, §1). Au-delà, la réservation est réputée expirée.
 *
 * 10 min et non 2 : Ewuang pousse ses webhooks par un cron d'une minute, et
 * relance un échec après 1, 2, puis 4 min. Un délai plus court libérerait une
 * course qu'un livreur Ewuang a bel et bien obtenue.
 */
export const DELAI_RESERVATION_EWUANG_MS = 10 * 60_000;

/**
 * Aucune flotte n'a la course : jamais prise, ou réservée par Ewuang sans
 * attribution confirmée depuis plus de 10 minutes.
 *
 * Une course attribuée par Ewuang a une `dateAcceptation` ; une course rendue
 * à Ewuang après un refus d'annulation n'a pas de `reserveeEwuangAt`. Ni
 * l'une ni l'autre n'est donc libérée par l'expiration.
 */
export function sansFlotte(maintenant: Date): Prisma.LivraisonWhereInput {
    return {
        OR: [
            { flotte: null },
            {
                flotte: Flotte.EWUANG,
                dateAcceptation: null,
                reserveeEwuangAt: { lt: new Date(maintenant.getTime() - DELAI_RESERVATION_EWUANG_MS) },
            },
        ],
    };
}
