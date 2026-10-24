import type { TypeCourse } from '../ewuang/ewuang.client.js';

/**
 * Grille de tarifs des courses find_delivery.
 *
 * ── Qui paie quoi ──────────────────────────────────────────────────────────
 *
 * Le client paie le prix de cette grille, sans majoration. find_delivery ne
 * prend pas de marge sur le client : c'est Ewuang qui lui reverse une
 * commission de 5 % du prix. Sur une course à 2 000 FCFA, find_delivery
 * touche 100, Ewuang garde 1 900.
 *
 * ── D'où viennent ces montants ─────────────────────────────────────────────
 *
 * `PRIX_STANDARD` est un prix par zone d'ARRIVÉE, le seul que connaisse
 * Ewuang : son contrat ne reçoit qu'une `zone` par mission (la destination) et
 * sa grille `partenaire_tarifs` un prix par zone. Le prix par trajet de
 * l'affiche « Octobre Rose » a été abandonné le 2026-10-22 : sur une course
 * entre deux zones, le client payait le trajet (Libreville → Owendo express
 * 4 000) quand Ewuang appliquait le prix de la zone (Owendo express 3 000) —
 * le livreur touchait 2 850 au lieu de 3 800 et l'écart gonflait notre
 * commission. Ces montants doivent rester égaux à `tarif_partenaire` côté
 * Ewuang. Express = standard + 1 000, volumineux = standard + 2 000.
 *
 * Le départ reste dans le devis (il est stocké et affiché sur la course), il
 * n'entre simplement plus dans le prix.
 *
 * La zone PK de l'affiche est volontairement absente : Ewuang ne la sert pas
 * encore (`zones_livraison`), une course PK serait refusée au dispatch.
 *
 * Ce ne sont PAS les frais de livraison de la marketplace Ewuang, qui vivent
 * dans sa base et ne concernent pas find_delivery.
 *
 * ── Ce que cette grille n'est PAS ──────────────────────────────────────────
 *
 * Elle sert à DEVISER, avant que la course existe. À la création de la
 * mission, Ewuang renvoie sa part (`MissionCreee.remuneration_livreur` — son
 * `tarif` est le prix de la zone, pas sa part) : c'est elle qui doit
 * être stockée dans `Livraison.tarifEwuang`, et la commission réelle se lit
 * alors par différence avec le prix payé par le client.
 */

export const ZONES = ['Akanda', 'Libreville', 'Owendo'] as const;
export type Zone = (typeof ZONES)[number];

/**
 * Types proposés au client. `volumineux` est retiré pour l'instant (décision
 * de Franck, 2026-10-24) : il reste dans `TypeCourse` et `SUPPLEMENT` pour les
 * courses déjà créées, mais n'est plus ni devisé ni accepté à la création.
 */
export const TYPES_COURSE = [
    'standard',
    'express',
] as const satisfies readonly TypeCourse[];

/** Commission reversée par Ewuang à find_delivery, en pourcentage du prix. */
export const COMMISSION_POURCENT = 5;

export const DEVISE = 'XAF';

/** Prix client d'une course standard, selon la zone d'arrivée, en FCFA. */
const PRIX_STANDARD: Record<Zone, number> = {
    Akanda: 1_500,
    Libreville: 2_000,
    Owendo: 2_000,
};

/** Supplément ajouté au prix standard, selon le type de course. */
const SUPPLEMENT: Record<TypeCourse, number> = {
    standard: 0,
    express: 1_000,
    volumineux: 2_000,
};

export interface Devis {
    zoneDepart: Zone;
    zoneArrivee: Zone;
    typeCourse: TypeCourse;
    /** Prix payé par le client. Correspond à `Livraison.tarif`. */
    tarif: number;
    /** Commission reversée par Ewuang à find_delivery. Correspond à `Livraison.commission`. */
    commission: number;
    /** Part d'Ewuang (= tarif − commission). Correspond à `Livraison.tarifEwuang`. */
    tarifEwuang: number;
    devise: typeof DEVISE;
}

/**
 * Commission de find_delivery sur un prix client.
 *
 * Arrondie à l'entier : le FCFA n'a pas de subdivision, et toutes les colonnes
 * de montant de `Livraison` sont des `Int`. La part d'Ewuang se déduit par
 * soustraction, pour que tarif = commission + tarifEwuang tienne toujours,
 * arrondi compris.
 */
export function calculerCommission(tarif: number): number {
    return Math.round((tarif * COMMISSION_POURCENT) / 100);
}

export function calculerDevis(
    zoneDepart: Zone,
    zoneArrivee: Zone,
    typeCourse: TypeCourse,
): Devis {
    const tarif = PRIX_STANDARD[zoneArrivee] + SUPPLEMENT[typeCourse];
    const commission = calculerCommission(tarif);

    return {
        zoneDepart,
        zoneArrivee,
        typeCourse,
        tarif,
        commission,
        tarifEwuang: tarif - commission,
        devise: DEVISE,
    };
}

/** La grille complète, telle qu'affichée au client. */
export function lireGrille(): Devis[] {
    return ZONES.flatMap((zoneDepart) =>
        ZONES.flatMap((zoneArrivee) =>
            TYPES_COURSE.map((typeCourse) =>
                calculerDevis(zoneDepart, zoneArrivee, typeCourse),
            ),
        ),
    );
}
