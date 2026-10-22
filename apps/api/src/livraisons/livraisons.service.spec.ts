import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { StatutLivraison, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EwuangClient, MissionCreee } from '../ewuang/ewuang.client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreerLivraisonDto } from './creer-livraison.dto.js';
import { LivraisonsService } from './livraisons.service.js';

/**
 * Prisma et le client Ewuang sont remplacés par des doublures : ce qui est
 * testé ici, c'est la décision prise à chaque issue de la transmission, pas
 * l'accès à la base.
 */

const BOUTIQUE = { id: 'u-boutique', role: UserRole.BOUTIQUE };

const PROFIL = {
    id: 'b-1',
    userBoutiqueId: 'u-boutique',
    address: 'Quartier Louis',
    phoneAirtel: '+24107112233',
    phoneMoov: null,
};

const DTO: CreerLivraisonDto = {
    zone_depart: 'Libreville',
    zone_arrivee: 'Akanda',
    type_course: 'standard',
    destinataire: { nom: 'Awa Mbadinga', adresse: 'Angondjé', contact: '+24106998877' },
    colis: { description: '2 cartons' },
};

const MISSION: MissionCreee = {
    mission_id: 'm-1',
    reference_externe: 'FD-x',
    statut: 'En attente',
    code_remise: '4817',
    // Valeurs réelles renvoyées par Ewuang pour Akanda standard (2026-10-22) :
    // le prix de la zone, et sa part après les 5 % reversés.
    tarif: 1_500,
    remuneration_livreur: 1_425,
    devise: 'XAF',
    disponible_at: '2026-10-22T10:00:00Z',
};

function fabriquer() {
    const prisma = {
        boutique: { findUnique: vi.fn().mockResolvedValue(PROFIL) },
        livraison: {
            create: vi.fn().mockResolvedValue({ id: 'l-1' }),
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findFirst: vi.fn().mockResolvedValue({ id: 'l-1' }),
            findUniqueOrThrow: vi.fn(),
        },
        $transaction: vi.fn((operations: unknown) =>
            Promise.all(operations as Promise<unknown>[]),
        ),
    };
    const ewuang = {
        creerMission: vi.fn().mockResolvedValue(MISSION),
        annulerMission: vi.fn().mockResolvedValue({ mission_id: 'm-1', statut: 'Annulée' }),
    };
    const service = new LivraisonsService(
        prisma as unknown as PrismaService,
        ewuang as unknown as EwuangClient,
    );
    return { prisma, ewuang, service };
}

describe('LivraisonsService.creer', () => {
    let f: ReturnType<typeof fabriquer>;
    beforeEach(() => {
        f = fabriquer();
    });

    it('refuse une boutique sans profil, sans rien écrire', async () => {
        f.prisma.boutique.findUnique.mockResolvedValue(null);
        await expect(f.service.creer(BOUTIQUE, DTO)).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.prisma.livraison.create).not.toHaveBeenCalled();
    });

    it("envoie la zone d'arrivée et les valeurs du profil pour l'enlèvement", async () => {
        await f.service.creer(BOUTIQUE, DTO);
        const charge = f.ewuang.creerMission.mock.calls[0][0];
        expect(charge.zone).toBe('Akanda');
        expect(charge.enlevement).toEqual({ adresse: 'Quartier Louis', contact: '+24107112233' });
        expect(charge.reference_externe).toMatch(/^FD-/);
    });

    it("enregistre la course AVANT d'appeler Ewuang, avec le corps envoyé", async () => {
        await f.service.creer(BOUTIQUE, DTO);
        const ordreCreation = f.prisma.livraison.create.mock.invocationCallOrder[0];
        const ordreAppel = f.ewuang.creerMission.mock.invocationCallOrder[0];
        expect(ordreCreation).toBeLessThan(ordreAppel);

        const donnees = f.prisma.livraison.create.mock.calls[0][0].data;
        expect(donnees.chargeEwuang).toEqual(f.ewuang.creerMission.mock.calls[0][0]);
        // Libreville → Akanda standard : 2 500 sur la grille.
        expect(donnees.tarif).toBe(2_500);
    });

    it("succès : la commission devient le prix client moins la part d'Ewuang (remuneration_livreur, pas tarif)", async () => {
        const resultat = await f.service.creer(BOUTIQUE, DTO);
        expect(resultat.transmise).toBe(true);
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toMatchObject({
            missionEwuangId: 'm-1',
            codeRemise: '4817',
            tarifEwuang: 1_425,
            commission: 2_500 - 1_425,
            erreurEwuang: null,
        });
        // Le statut ne doit pas écraser celui d'un webhook arrivé avant.
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].where).toEqual({
            id: 'l-1',
            statutEwuang: null,
        });
    });

    it('Ewuang injoignable : la course reste, non transmise, avec le motif', async () => {
        f.ewuang.creerMission.mockRejectedValue(new ServiceUnavailableException('injoignable'));
        const resultat = await f.service.creer(BOUTIQUE, DTO);
        expect(resultat.transmise).toBe(false);
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toEqual({
            erreurEwuang: 'injoignable',
        });
    });

    it('refus définitif : la course est annulée et la boutique reçoit un 400', async () => {
        f.ewuang.creerMission.mockRejectedValue(new BadRequestException('Zone inconnue'));
        await expect(f.service.creer(BOUTIQUE, DTO)).rejects.toBeInstanceOf(BadRequestException);
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toMatchObject({
            statut: StatutLivraison.ANNULEE,
            erreurEwuang: 'Zone inconnue',
        });
    });
});

describe('LivraisonsService.annuler', () => {
    let f: ReturnType<typeof fabriquer>;
    beforeEach(() => {
        f = fabriquer();
    });

    it("course d'une autre boutique : 404", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(null);
        await expect(f.service.annuler(BOUTIQUE, 'l-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('course transmise : annulée chez Ewuang puis en local', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_500,
            statut: StatutLivraison.EN_ATTENTE,
            statutEwuang: 'En attente',
            missionEwuangId: 'm-1',
            chargeEwuang: {},
        });
        await f.service.annuler(BOUTIQUE, 'l-1');
        expect(f.ewuang.annulerMission).toHaveBeenCalledWith('m-1');
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toMatchObject({
            statut: StatutLivraison.ANNULEE,
            statutEwuang: 'Annulée',
        });
    });

    it("course non transmise : récupère d'abord la mission peut-être créée chez Ewuang", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_500,
            statut: StatutLivraison.EN_ATTENTE,
            statutEwuang: null,
            missionEwuangId: null,
            chargeEwuang: { reference_externe: 'FD-x' },
        });
        f.prisma.livraison.findUniqueOrThrow.mockResolvedValue({ missionEwuangId: 'm-1' });
        await f.service.annuler(BOUTIQUE, 'l-1');
        expect(f.ewuang.creerMission).toHaveBeenCalledWith({ reference_externe: 'FD-x' });
        expect(f.ewuang.annulerMission).toHaveBeenCalledWith('m-1');
    });

    it("course non transmise et Ewuang injoignable : 503, rien n'est annulé en local", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_500,
            statut: StatutLivraison.EN_ATTENTE,
            statutEwuang: null,
            missionEwuangId: null,
            chargeEwuang: { reference_externe: 'FD-x' },
        });
        f.ewuang.creerMission.mockRejectedValue(new ServiceUnavailableException('injoignable'));
        await expect(f.service.annuler(BOUTIQUE, 'l-1')).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
        const annulations = f.prisma.livraison.update.mock.calls.filter(
            ([arg]) => (arg as { data: { statut?: string } }).data.statut === StatutLivraison.ANNULEE,
        );
        expect(annulations).toHaveLength(0);
    });
});
