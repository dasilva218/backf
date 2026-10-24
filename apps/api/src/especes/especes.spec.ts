import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, TypeMouvementEspeces as T } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DELAI_VERSEMENT_MS, etatLivreur, PLAFOND_ENCOURS, solde } from './especes.js';
import { EspecesService } from './especes.service.js';

const MAINTENANT = new Date('2026-10-25T10:00:00Z');
const il_y_a = (ms: number) => new Date(MAINTENANT.getTime() - ms);

describe('solde', () => {
    it("l'exemple du plan : le livreur doit 15 100, find_delivery doit 15 000 au client", () => {
        expect(solde([
            { type: T.ENCAISSEMENT, montant: 17_000 },
            { type: T.REMUNERATION, montant: 1_900 },
        ])).toBe(15_100);
        expect(solde([{ type: T.MARCHANDISE, montant: 15_000 }])).toBe(15_000);
    });

    it('versements et reversements soldent les comptes', () => {
        expect(solde([
            { type: T.ENCAISSEMENT, montant: 17_000 },
            { type: T.REMUNERATION, montant: 1_900 },
            { type: T.VERSEMENT, montant: 15_100 },
        ])).toBe(0);
        expect(solde([{ type: T.MARCHANDISE, montant: 15_000 }, { type: T.REVERSEMENT, montant: 15_000 }])).toBe(0);
    });

    it('un retour qui coûte plus que la course : find_delivery doit au livreur, le paiement solde', () => {
        const retour = [{ type: T.ENCAISSEMENT, montant: 2_000 }, { type: T.REMUNERATION, montant: 2_400 }];
        expect(solde(retour)).toBe(-400);
        expect(solde([...retour, { type: T.PAIEMENT_LIVREUR, montant: 400 }])).toBe(0);
    });
});

describe('etatLivreur (R5)', () => {
    it('rien dû : ni échéance ni blocage', () => {
        expect(etatLivreur(0, null, MAINTENANT)).toMatchObject({ echeance: null, blocage: null });
        expect(etatLivreur(-400, il_y_a(DELAI_VERSEMENT_MS * 2), MAINTENANT)).toMatchObject({ depuis: null, echeance: null, blocage: null });
    });

    it('sous le plafond et dans les 48 h : libre, échéance affichée', () => {
        const depuis = il_y_a(3_600_000);
        const etat = etatLivreur(15_100, depuis, MAINTENANT);
        expect(etat.blocage).toBeNull();
        expect(etat.echeance).toEqual(new Date(depuis.getTime() + DELAI_VERSEMENT_MS));
    });

    it('au plafond : bloqué', () => {
        expect(etatLivreur(PLAFOND_ENCOURS, il_y_a(60_000), MAINTENANT).blocage).toContain('au-delà de');
    });

    it('48 h passées : bloqué, quel que soit le montant', () => {
        expect(etatLivreur(100, il_y_a(DELAI_VERSEMENT_MS), MAINTENANT).blocage).toContain('en retard');
    });
});

describe('EspecesService', () => {
    function fabriquer() {
        const tx = {
            $queryRaw: vi.fn().mockResolvedValue([{ id: 'lv-1' }]),
            mouvementEspeces: {
                groupBy: vi.fn().mockResolvedValue([]),
                create: vi.fn().mockResolvedValue({}),
            },
        };
        const prisma = {
            ...tx,
            $queryRaw: vi.fn().mockResolvedValue([]),
            mouvementEspeces: {
                ...tx.mouvementEspeces,
                findMany: vi.fn().mockResolvedValue([]),
                createMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
        };
        return { tx, prisma, service: new EspecesService(prisma as unknown as PrismaService) };
    }

    let f: ReturnType<typeof fabriquer>;
    beforeEach(() => {
        f = fabriquer();
    });

    const RECU = { montant: 15_100, reference: 'R-0001' };

    it('écritures de course : clé par étape, montants nuls ignorés', async () => {
        await f.service.ecrireCourse(f.prisma as unknown as Prisma.TransactionClient, [
            { type: T.ENCAISSEMENT, livraisonId: 'l-1', etape: 'enlevement', montant: 0, livreurId: 'lv-1' },
            { type: T.MARCHANDISE, livraisonId: 'l-1', etape: 'marchandise', montant: 15_000, clientId: 'cl-1' },
        ]);
        expect(f.prisma.mouvementEspeces.createMany).toHaveBeenCalledWith({
            data: [{ type: T.MARCHANDISE, montant: 15_000, livraisonId: 'l-1', livreurId: null, clientId: 'cl-1', cle: 'l-1:marchandise' }],
        });
    });

    it('versement : sous verrou, au plus le solde, clé = le reçu', async () => {
        f.tx.mouvementEspeces.groupBy.mockResolvedValue([
            { type: T.ENCAISSEMENT, _sum: { montant: 17_000 } },
            { type: T.REMUNERATION, _sum: { montant: 1_900 } },
        ]);
        await f.service.verser('lv-1', RECU, 'u-admin');
        expect(f.tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(f.tx.mouvementEspeces.create).toHaveBeenCalledWith({
            data: { type: T.VERSEMENT, montant: 15_100, cle: 'recu:R-0001', note: null, saisiParId: 'u-admin', livreurId: 'lv-1' },
        });
    });

    it('versement supérieur au solde : 400, rien n’est écrit', async () => {
        f.tx.mouvementEspeces.groupBy.mockResolvedValue([{ type: T.ENCAISSEMENT, _sum: { montant: 2_000 } }]);
        await expect(f.service.verser('lv-1', RECU, 'u-admin')).rejects.toBeInstanceOf(BadRequestException);
        expect(f.tx.mouvementEspeces.create).not.toHaveBeenCalled();
    });

    it('paiement : seulement quand find_delivery doit au livreur', async () => {
        await expect(f.service.payer('lv-1', { montant: 400, reference: 'R-2' }, 'u-admin')).rejects.toThrow(
            "Rien n'est dû à ce livreur",
        );
        f.tx.mouvementEspeces.groupBy.mockResolvedValue([
            { type: T.ENCAISSEMENT, _sum: { montant: 2_000 } },
            { type: T.REMUNERATION, _sum: { montant: 2_400 } },
        ]);
        await f.service.payer('lv-1', { montant: 400, reference: 'R-2' }, 'u-admin');
        expect(f.tx.mouvementEspeces.create.mock.calls[0][0].data).toMatchObject({ type: T.PAIEMENT_LIVREUR, montant: 400 });
    });

    it('reçu déjà enregistré : 409', async () => {
        f.tx.mouvementEspeces.groupBy.mockResolvedValue([{ type: T.MARCHANDISE, _sum: { montant: 15_000 } }]);
        f.tx.mouvementEspeces.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
        );
        await expect(f.service.reverser('cl-1', { montant: 15_000, reference: 'R-3' }, 'u-admin')).rejects.toBeInstanceOf(
            ConflictException,
        );
    });

    it('livreur inconnu : 404', async () => {
        f.tx.$queryRaw.mockResolvedValue([]);
        await expect(f.service.verser('lv-x', RECU, 'u-admin')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('exigerPeutPrendre : 403 au-delà du plafond', async () => {
        f.prisma.$queryRaw.mockResolvedValue([{ livreurId: 'lv-1', solde: 52_000, depuis: new Date() }]);
        await expect(f.service.exigerPeutPrendre('lv-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
});
