import { Payeur, TypeMouvementEspeces as T } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ecrituresEwuang, type CoursePourRegistre, type EvenementEwuang } from './ewuang-webhook.service.js';

const EMIS = new Date('2026-10-24T10:00:00Z');

/** L'exemple du plan : 2 000 de frais + 15 000 de marchandise, le destinataire paie. */
const COURSE: CoursePourRegistre = {
    id: 'l-1',
    clientId: 'cl-1',
    payeur: Payeur.DESTINATAIRE,
    montantMarchandise: 15_000,
    tarifEwuang: 1_900,
};

function evenement(type: string, montant?: number): EvenementEwuang {
    return {
        evenement_id: 'e-1',
        type,
        emis_at: EMIS.toISOString(),
        mission_id: 'm-1',
        ...(montant ? { encaissement: { montant, encaisse_at: EMIS.toISOString() } } : {}),
    };
}

describe('ecrituresEwuang', () => {
    it('livrée : Ewuang a encaissé 17 000, la course lui coûte 1 900, 15 000 sont dus au client', () => {
        expect(ecrituresEwuang(evenement('mission.livree', 17_000), COURSE, EMIS)).toEqual([
            { type: T.ENCAISSEMENT_EWUANG, livraisonId: 'l-1', etape: 'ewuang:remise', montant: 17_000 },
            { type: T.TARIF_EWUANG, livraisonId: 'l-1', etape: 'ewuang:tarif', montant: 1_900 },
            { type: T.MARCHANDISE, livraisonId: 'l-1', etape: 'marchandise', montant: 15_000, clientId: 'cl-1' },
        ]);
        // Ewuang nous doit 17 000 − 1 900 = 15 100 : 15 000 pour le client, 100 de commission.
    });

    it('colis récupéré, l’expéditeur paie : seul l’encaissement de l’enlèvement', () => {
        const course = { ...COURSE, payeur: Payeur.EXPEDITEUR };
        expect(ecrituresEwuang(evenement('mission.colis_recupere', 2_000), course, EMIS)).toEqual([
            { type: T.ENCAISSEMENT_EWUANG, livraisonId: 'l-1', etape: 'ewuang:enlevement', montant: 2_000 },
        ]);
    });

    it('retournée : l’aller encaissé auprès de l’expéditeur, le tarif plus le forfait, pas de marchandise', () => {
        expect(ecrituresEwuang(evenement('mission.retournee', 2_000), COURSE, EMIS)).toEqual([
            { type: T.ENCAISSEMENT_EWUANG, livraisonId: 'l-1', etape: 'ewuang:retour', montant: 2_000 },
            { type: T.TARIF_EWUANG, livraisonId: 'l-1', etape: 'ewuang:tarif', montant: 2_400 },
        ]);
    });

    it('course réglée hors course (sans payeur) : rien', () => {
        expect(ecrituresEwuang(evenement('mission.livree', 17_000), { ...COURSE, payeur: null }, EMIS)).toEqual([]);
    });

    it('autres événements : rien', () => {
        expect(ecrituresEwuang(evenement('mission.attribuee'), COURSE, EMIS)).toEqual([]);
        expect(ecrituresEwuang(evenement('mission.annulee'), COURSE, EMIS)).toEqual([]);
    });
});
