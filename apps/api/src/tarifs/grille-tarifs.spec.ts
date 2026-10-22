import { describe, expect, it } from 'vitest';
import {
    calculerCommission,
    calculerDevis,
    lireGrille,
    TYPES_COURSE,
    ZONES,
} from './grille-tarifs.js';

/**
 * Les montants attendus sont écrits en dur, et non recalculés : un test qui
 * reprendrait la formule du code passerait avec la même erreur que lui.
 * Ils recopient l'affiche « Octobre Rose », lignes = départ.
 */

describe('calculerDevis — prix standard, départ → arrivée', () => {
    it.each([
        ['Akanda', 'Akanda', 1_500],
        ['Akanda', 'Libreville', 2_000],
        ['Akanda', 'Owendo', 3_500],
        ['Libreville', 'Akanda', 2_500],
        ['Libreville', 'Libreville', 2_000],
        ['Libreville', 'Owendo', 3_000],
        ['Owendo', 'Akanda', 3_500],
        ['Owendo', 'Libreville', 2_500],
        ['Owendo', 'Owendo', 2_000],
    ] as const)('%s → %s : %i', (depart, arrivee, tarif) => {
        expect(calculerDevis(depart, arrivee, 'standard').tarif).toBe(tarif);
    });

    // La grille n'est pas symétrique : c'est le sens qui fixe le prix. Un
    // départ et une arrivée inversés par erreur donneraient le mauvais tarif
    // sans rien casser d'autre.
    it('distingue le sens du trajet', () => {
        expect(calculerDevis('Akanda', 'Libreville', 'standard').tarif).toBe(2_000);
        expect(calculerDevis('Libreville', 'Akanda', 'standard').tarif).toBe(2_500);
    });
});

describe('calculerDevis — répartition et suppléments', () => {
    it('Libreville → Owendo en express : le client paie 4 000, find_delivery touche 200, Ewuang garde 3 800', () => {
        expect(calculerDevis('Libreville', 'Owendo', 'express')).toEqual({
            zoneDepart: 'Libreville',
            zoneArrivee: 'Owendo',
            typeCourse: 'express',
            tarif: 4_000,
            commission: 200,
            tarifEwuang: 3_800,
            devise: 'XAF',
        });
    });

    it('Akanda → Owendo en volumineux : 5 500, dont 275 pour find_delivery', () => {
        const devis = calculerDevis('Akanda', 'Owendo', 'volumineux');
        expect(devis.tarif).toBe(5_500);
        expect(devis.commission).toBe(275);
        expect(devis.tarifEwuang).toBe(5_225);
    });

    // Le client paie le prix de la grille, jamais plus : la commission est
    // prélevée sur la part d'Ewuang, pas ajoutée au prix.
    it('garde la relation tarif = commission + tarifEwuang', () => {
        for (const devis of lireGrille()) {
            expect(devis.commission + devis.tarifEwuang).toBe(devis.tarif);
        }
    });
});

describe('calculerCommission', () => {
    // Le jour où un prix hors grille apparaîtra, la commission ne doit pas
    // produire de décimale : toutes les colonnes de montant sont des entiers.
    it('arrondit à l\'entier', () => {
        expect(calculerCommission(1_550)).toBe(78);
        expect(calculerCommission(1_530)).toBe(77);
        expect(Number.isInteger(calculerCommission(1_234))).toBe(true);
    });
});

describe('lireGrille', () => {
    it('couvre chaque trajet pour chaque type de course, une seule fois', () => {
        const grille = lireGrille();
        expect(grille).toHaveLength(ZONES.length * ZONES.length * TYPES_COURSE.length);
        const cles = new Set(
            grille.map((d) => `${d.zoneDepart}/${d.zoneArrivee}/${d.typeCourse}`),
        );
        expect(cles.size).toBe(grille.length);
    });
});
