import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Flotte, Payeur, StatutLivraison, UserRole } from '@prisma/client';
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

const CLIENT = { id: 'u-client', role: UserRole.CLIENT };

const PROFIL = {
    id: 'c-1',
    userClientId: 'u-client',
    address: 'Quartier Louis',
    phoneAirtel: '+24107112233',
    phoneMoov: null,
};

// Objet simple, pas typé comme la classe du DTO : il se décline par spread.
const DEMANDE = {
    zone_depart: 'Libreville',
    zone_arrivee: 'Akanda',
    type_course: 'standard',
    destinataire: { nom: 'Awa Mbadinga', adresse: 'Angondjé', contact: '+24106998877' },
    colis: { description: '2 cartons' },
} satisfies Omit<CreerLivraisonDto, 'paiement'>;

const DTO: CreerLivraisonDto = { ...DEMANDE, paiement: { payeur: 'expediteur' } };

const AVEC_MARCHANDISE: CreerLivraisonDto = {
    ...DEMANDE,
    paiement: { payeur: 'destinataire', montant_marchandise: 15_000 },
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
        client: { findUnique: vi.fn().mockResolvedValue(PROFIL) },
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

    it('refuse un client sans profil, sans rien écrire', async () => {
        f.prisma.client.findUnique.mockResolvedValue(null);
        await expect(f.service.creer(CLIENT, DTO)).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.prisma.livraison.create).not.toHaveBeenCalled();
    });

    it("envoie la zone d'arrivée et les valeurs du profil pour l'enlèvement", async () => {
        await f.service.creer(CLIENT, DTO);
        const charge = f.ewuang.creerMission.mock.calls[0][0];
        expect(charge.zone).toBe('Akanda');
        expect(charge.enlevement).toEqual({ adresse: 'Quartier Louis', contact: '+24107112233' });
        expect(charge.reference_externe).toMatch(/^FD-/);
    });

    it('enregistre le payeur choisi et, sans marchandise, un montant nul', async () => {
        await f.service.creer(CLIENT, DTO);
        expect(f.prisma.livraison.create.mock.calls[0][0].data).toMatchObject({
            payeur: Payeur.EXPEDITEUR,
            montantMarchandise: 0,
        });
    });

    it('enregistre le contre-remboursement payé par le destinataire', async () => {
        await f.service.creer(CLIENT, AVEC_MARCHANDISE);
        expect(f.prisma.livraison.create.mock.calls[0][0].data).toMatchObject({
            payeur: Payeur.DESTINATAIRE,
            montantMarchandise: 15_000,
        });
    });

    it('envoie le bloc paiement de la v2 : frais = NOTRE prix client, pas le tarif Ewuang', async () => {
        await f.service.creer(CLIENT, AVEC_MARCHANDISE);
        expect(f.ewuang.creerMission.mock.calls[0][0].paiement).toEqual({
            mode: 'especes',
            payeur: 'destinataire',
            frais: 1_500,
            montant_marchandise: 15_000,
        });
    });

    it("enregistre la course AVANT d'appeler Ewuang, avec le corps envoyé", async () => {
        await f.service.creer(CLIENT, DTO);
        const ordreCreation = f.prisma.livraison.create.mock.invocationCallOrder[0];
        const ordreAppel = f.ewuang.creerMission.mock.invocationCallOrder[0];
        expect(ordreCreation).toBeLessThan(ordreAppel);

        const donnees = f.prisma.livraison.create.mock.calls[0][0].data;
        expect(donnees.chargeEwuang).toEqual(f.ewuang.creerMission.mock.calls[0][0]);
        // Libreville → Akanda standard : le prix de la zone d'arrivée, 1 500.
        expect(donnees.tarif).toBe(1_500);
    });

    it("succès : la commission devient le prix client moins la part d'Ewuang (remuneration_livreur, pas tarif)", async () => {
        const resultat = await f.service.creer(CLIENT, DTO);
        expect(resultat.transmise).toBe(true);
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toMatchObject({
            missionEwuangId: 'm-1',
            codeRemise: '4817',
            tarifEwuang: 1_425,
            commission: 1_500 - 1_425,
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
        const resultat = await f.service.creer(CLIENT, DTO);
        expect(resultat.transmise).toBe(false);
        expect(f.prisma.livraison.update.mock.calls[0][0].data).toEqual({
            erreurEwuang: 'injoignable',
        });
    });

    it('refus définitif : la course est annulée et le client reçoit un 400', async () => {
        f.ewuang.creerMission.mockRejectedValue(new BadRequestException('Zone inconnue'));
        await expect(f.service.creer(CLIENT, DTO)).rejects.toBeInstanceOf(BadRequestException);
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

    it("course d'un autre client : 404", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(null);
        await expect(f.service.annuler(CLIENT, 'l-x')).rejects.toBeInstanceOf(NotFoundException);
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
        await f.service.annuler(CLIENT, 'l-1');
        expect(f.ewuang.annulerMission).toHaveBeenCalledWith('m-1');
        expect(f.prisma.livraison.updateMany.mock.calls[0][0]).toMatchObject({
            // Conditionnée : un livreur find_delivery a pu accepter entre-temps.
            where: { id: 'l-1', statut: { in: [StatutLivraison.EN_ATTENTE, StatutLivraison.ACCEPTEE] } },
            data: { statut: StatutLivraison.ANNULEE, statutEwuang: 'Annulée' },
        });
    });

    it("mission déjà retirée chez Ewuang (course rendue par un livreur find_delivery) : pas de rappel à Ewuang", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_000,
            statut: StatutLivraison.EN_ATTENTE,
            statutEwuang: 'Annulée',
            missionEwuangId: 'm-1',
            chargeEwuang: {},
            flotte: null,
        });
        await f.service.annuler(CLIENT, 'l-1');
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].data).toMatchObject({ statut: StatutLivraison.ANNULEE });
    });

    it('flotte find_delivery : annulable tant que le colis n’est pas récupéré, sans appel à Ewuang', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_000,
            statut: StatutLivraison.ACCEPTEE,
            statutEwuang: 'Annulée',
            missionEwuangId: 'm-1',
            chargeEwuang: {},
            flotte: Flotte.FIND_DELIVERY,
        });
        await f.service.annuler(CLIENT, 'l-1');
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].where).toMatchObject({
            flotte: Flotte.FIND_DELIVERY,
            statut: StatutLivraison.ACCEPTEE,
        });
    });

    it('flotte find_delivery, colis déjà récupéré : 409, retour par le support', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue({
            id: 'l-1',
            tarif: 2_000,
            statut: StatutLivraison.EN_COURS,
            statutEwuang: 'Annulée',
            missionEwuangId: 'm-1',
            chargeEwuang: {},
            flotte: Flotte.FIND_DELIVERY,
        });
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        await expect(f.service.annuler(CLIENT, 'l-1')).rejects.toBeInstanceOf(ConflictException);
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
        await f.service.annuler(CLIENT, 'l-1');
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
        await expect(f.service.annuler(CLIENT, 'l-1')).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
        const annulations = f.prisma.livraison.update.mock.calls.filter(
            ([arg]) => (arg as { data: { statut?: string } }).data.statut === StatutLivraison.ANNULEE,
        );
        expect(annulations).toHaveLength(0);
    });
});
