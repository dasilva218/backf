import { Flotte, Prisma, StatutLivraison } from '@prisma/client';
import { STATUTS_ACTIFS } from '../livreurs/livreur-courses.service.js';

/**
 * Suivi en direct d'une course : où est le livreur qui a le colis.
 *
 * Deux sources, selon la flotte :
 *   • FIND_DELIVERY : la dernière `SuiviPosition` de la course, envoyée par
 *     find_delivery_mobile toutes les 30 s, application ouverte ;
 *   • EWUANG : `GET /partenaires/flotte` (contrat §5), lu au plus toutes les
 *     15 s et jamais stocké ici (voir `Livraison.livreurEwuangId`).
 *
 * Une position n'est servie que pendant que le livreur a la course en main :
 * avant, il n'y a pas de livreur ; après, sa position n'a plus rien à voir avec
 * le colis, et la donner prolongerait le suivi d'une personne au-delà de ce
 * que la course justifie.
 */

/**
 * Au-delà, une position n'est plus présentée comme actuelle (contrat §5 :
 * « une position périmée présentée comme fraîche est pire qu'une absence »).
 * Même règle pour notre flotte : l'application fermée n'envoie plus rien.
 */
export const PERIMEE_APRES_MS = 5 * 60_000;

/** Statuts Ewuang où son livreur a la course en main (contrat §7, v2 §3). */
export const STATUTS_EWUANG_EN_COURS = [
  'En cours de livraison',
  'Colis récupéré',
  'Retour expéditeur',
];

/** Les courses qu'un livreur a en main, des deux flottes. */
export const COURSE_EN_COURS = {
  OR: [
    { flotte: Flotte.FIND_DELIVERY, statut: { in: STATUTS_ACTIFS } },
    {
      flotte: Flotte.EWUANG,
      livreurEwuangId: { not: null },
      statutEwuang: { in: STATUTS_EWUANG_EN_COURS },
    },
  ],
} satisfies Prisma.LivraisonWhereInput;

export interface CoursePourSuivi {
  flotte: Flotte | null;
  statut: StatutLivraison;
  statutEwuang: string | null;
  livreurEwuangId: string | null;
}

/** Miroir de `COURSE_EN_COURS`, pour une course déjà lue. */
export function estEnCours(course: CoursePourSuivi): boolean {
  if (course.flotte === Flotte.FIND_DELIVERY)
    return STATUTS_ACTIFS.includes(course.statut);
  if (course.flotte === Flotte.EWUANG) {
    return (
      course.livreurEwuangId !== null &&
      STATUTS_EWUANG_EN_COURS.includes(course.statutEwuang ?? '')
    );
  }
  return false;
}

export interface PositionVue {
  latitude: number;
  longitude: number;
  positionAt: string;
  /** Plus vieille que `PERIMEE_APRES_MS` : à afficher comme « dernière position connue ». */
  perimee: boolean;
  precisionM: number | null;
}

/** Une position lisible, ou null si une coordonnée ou sa date manque. */
export function positionVue(
  latitude: number | null,
  longitude: number | null,
  at: Date | string | null,
  precisionM: number | null,
  maintenant: Date,
): PositionVue | null {
  if (latitude === null || longitude === null || at === null) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return {
    latitude,
    longitude,
    positionAt: date.toISOString(),
    perimee: maintenant.getTime() - date.getTime() > PERIMEE_APRES_MS,
    precisionM,
  };
}
