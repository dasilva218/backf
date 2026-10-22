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
 * `PRIX_STANDARD` reprend la grille moto « Octobre Rose » remise pour
 * find_delivery : un prix par trajet, zone de départ → zone d'arrivée (les
 * lignes de l'affiche sont le départ). Le tableau n'est PAS symétrique —
 * Akanda → Libreville coûte 2 000, Libreville → Akanda 2 500 — ne pas
 * « corriger » un sens sur l'autre. Express = standard + 1 000, volumineux =
 * standard + 2 000.
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

export const TYPES_COURSE = [
    'standard',
    'express',
    'volumineux',
] as const satisfies readonly TypeCourse[];

/** Commission reversée par Ewuang à find_delivery, en pourcentage du prix. */
export const COMMISSION_POURCENT = 5;

export const DEVISE = 'XAF';

/** Prix client d'une course standard, `PRIX_STANDARD[départ][arrivée]`, en FCFA. */
const PRIX_STANDARD: Record<Zone, Record<Zone, number>> = {
    Akanda: { Akanda: 1_500, Libreville: 2_000, Owendo: 3_500 },
    Libreville: { Akanda: 2_500, Libreville: 2_000, Owendo: 3_000 },
    Owendo: { Akanda: 3_500, Libreville: 2_500, Owendo: 2_000 },
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
    const tarif = PRIX_STANDARD[zoneDepart][zoneArrivee] + SUPPLEMENT[typeCourse];
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
