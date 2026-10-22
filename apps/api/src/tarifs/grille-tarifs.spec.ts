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
 * Ils recopient la grille `partenaire_tarifs` d'Ewuang (`tarif_partenaire` →
 * `remuneration_livreur`) : un écart avec elle, c'est un livreur mal payé.
 */

describe('calculerDevis — le prix dépend de la zone d\'arrivée seule', () => {
    it.each([
        ['Akanda', 'standard', 1_500, 1_425],
        ['Akanda', 'express', 2_500, 2_375],
        ['Akanda', 'volumineux', 3_500, 3_325],
        ['Libreville', 'standard', 2_000, 1_900],
        ['Libreville', 'express', 3_000, 2_850],
        ['Libreville', 'volumineux', 4_000, 3_800],
        ['Owendo', 'standard', 2_000, 1_900],
        ['Owendo', 'express', 3_000, 2_850],
        ['Owendo', 'volumineux', 4_000, 3_800],
    ] as const)('arrivée %s en %s : %i, dont %i pour Ewuang', (arrivee, type, tarif, tarifEwuang) => {
        for (const depart of ZONES) {
            const devis = calculerDevis(depart, arrivee, type);
            expect(devis.tarif).toBe(tarif);
            expect(devis.tarifEwuang).toBe(tarifEwuang);
        }
    });

    // Le cas qui a payé un livreur 2 850 pour une course facturée 4 000.
    it('Libreville → Owendo en express : le client paie 3 000, comme la zone Owendo chez Ewuang', () => {
        expect(calculerDevis('Libreville', 'Owendo', 'express')).toEqual({
            zoneDepart: 'Libreville',
            zoneArrivee: 'Owendo',
            typeCourse: 'express',
            tarif: 3_000,
            commission: 150,
            tarifEwuang: 2_850,
            devise: 'XAF',
        });
    });
});

describe('calculerDevis — répartition', () => {

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
