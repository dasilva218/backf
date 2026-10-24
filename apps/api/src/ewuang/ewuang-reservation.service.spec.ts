import { Flotte, StatutLivraison } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELAI_RESERVATION_EWUANG_MS } from '../livraisons/flotte.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EwuangReservationService } from './ewuang-reservation.service.js';

const DEMANDE = {
    mission_id: 'm-1',
    reference_externe: 'FD-1',
    livreur: { id: 'lv-ew-1', nom: 'Jean Ondo', contact: '+24107445566', type_vehicule: 'moto' },
    demande_at: '2026-10-24T10:00:00Z',
};

function fabriquer() {
    const prisma = {
        livraison: {
            findFirst: vi.fn().mockResolvedValue({ id: 'l-1' }),
            findUnique: vi.fn().mockResolvedValue(null),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
    };
    return { prisma, service: new EwuangReservationService(prisma as unknown as PrismaService) };
}

let f: ReturnType<typeof fabriquer>;
beforeEach(() => {
    f = fabriquer();
});

describe('EwuangReservationService.reserver', () => {
    it('réserve sous le verrou sansFlotte, avec le livreur Ewuang', async () => {
        expect(await f.service.reserver(DEMANDE)).toBe(true);
        const { where, data } = f.prisma.livraison.updateMany.mock.calls[0][0];
        expect(where).toMatchObject({ id: 'l-1', livreurId: null, statut: StatutLivraison.EN_ATTENTE });
        expect(where.OR[0]).toEqual({ flotte: null });
        expect(data).toMatchObject({
            flotte: Flotte.EWUANG,
            livreurEwuangId: 'lv-ew-1',
            livreurNom: 'Jean Ondo',
            livreurTypeVehicule: 'moto',
        });
        expect(data.reserveeEwuangAt).toBeInstanceOf(Date);
    });

    it('une réservation sans attribution expire au bout de 10 min', async () => {
        const avant = Date.now();
        await f.service.reserver(DEMANDE);
        const borne = f.prisma.livraison.updateMany.mock.calls[0][0].where.OR[1].reserveeEwuangAt.lt as Date;
        expect(avant - borne.getTime()).toBeGreaterThanOrEqual(DELAI_RESERVATION_EWUANG_MS - 5);
        expect(DELAI_RESERVATION_EWUANG_MS).toBe(10 * 60_000);
    });

    it('même livreur qui redemande : oui (idempotent)', async () => {
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        f.prisma.livraison.findUnique.mockResolvedValue({
            flotte: Flotte.EWUANG,
            livreurEwuangId: 'lv-ew-1',
            statut: StatutLivraison.EN_ATTENTE,
        });
        expect(await f.service.reserver(DEMANDE)).toBe(true);
    });

    it('un autre livreur, même d’Ewuang : non', async () => {
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        f.prisma.livraison.findUnique.mockResolvedValue({
            flotte: Flotte.EWUANG,
            livreurEwuangId: 'lv-ew-2',
            statut: StatutLivraison.EN_ATTENTE,
        });
        expect(await f.service.reserver(DEMANDE)).toBe(false);
    });

    it('prise par la flotte find_delivery : non', async () => {
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        f.prisma.livraison.findUnique.mockResolvedValue({
            flotte: Flotte.FIND_DELIVERY,
            livreurEwuangId: null,
            statut: StatutLivraison.ACCEPTEE,
        });
        expect(await f.service.reserver(DEMANDE)).toBe(false);
    });

    it('mission inconnue ou demande incomplète : non, rien n’est écrit', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(null);
        expect(await f.service.reserver(DEMANDE)).toBe(false);
        expect(await f.service.reserver({ mission_id: 'm-1' })).toBe(false);
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();
    });
});
