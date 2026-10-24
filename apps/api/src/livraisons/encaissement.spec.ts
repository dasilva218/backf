import { Payeur } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
    aEncaisserAuRetour,
    calculerEncaissements,
    calculerRemunerationLivreur,
} from './encaissement.js';

describe('calculerEncaissements', () => {
    it("l'expéditeur paie les frais à l'enlèvement, la marchandise reste due à la remise", () => {
        expect(calculerEncaissements(2_000, Payeur.EXPEDITEUR, 15_000)).toEqual({
            enlevement: 2_000,
            remise: 15_000,
        });
    });

    it('le destinataire paie frais et marchandise à la remise', () => {
        expect(calculerEncaissements(2_000, Payeur.DESTINATAIRE, 15_000)).toEqual({
            enlevement: 0,
            remise: 17_000,
        });
    });

    it('sans marchandise, rien à la remise quand l’expéditeur a payé', () => {
        expect(calculerEncaissements(1_500, Payeur.EXPEDITEUR, 0)).toEqual({ enlevement: 1_500, remise: 0 });
    });
});

describe('aEncaisserAuRetour', () => {
    it("l'expéditeur doit l'aller quand le destinataire devait payer", () => {
        expect(aEncaisserAuRetour(2_000, Payeur.DESTINATAIRE)).toBe(2_000);
    });

    it("rien de plus quand l'expéditeur a déjà payé à l'enlèvement", () => {
        expect(aEncaisserAuRetour(2_000, Payeur.EXPEDITEUR)).toBe(0);
    });
});

describe('calculerRemunerationLivreur', () => {
    it.each([
        [1_500, 1_425],
        [2_000, 1_900],
        [2_500, 2_375],
        [4_000, 3_800],
    ])('%i FCFA → %i pour le livreur (95 %, comme chez Ewuang)', (tarif, gain) => {
        expect(calculerRemunerationLivreur(tarif)).toBe(gain);
    });
});
