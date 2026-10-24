import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Flotte, Payeur, StatutDossier, StatutLivraison, TransportMode } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EspecesService } from '../especes/especes.service.js';
import type { EwuangClient } from '../ewuang/ewuang.client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LivreurCoursesService } from './livreur-courses.service.js';
import type { LivreursService } from './livreurs.service.js';

/**
 * Prisma, Ewuang et le service des profils sont des doublures : ce qui est
 * testé, ce sont les décisions — qui obtient la course, quand l'argent est
 * accepté, quand un code coûte un essai.
 */

const LIVREUR = {
    id: 'lv-1',
    userLivreurId: 'u-lv',
    firstname: 'Jean',
    lastname: 'Ondo',
    phoneAirtel: '+24107445566',
    phoneMoov: null,
    moyenTransport: TransportMode.MOTO,
    zoneGeographique: ['Libreville'],
    estDisponible: true,
    statutDossier: StatutDossier.VALIDE,
};

function course(surcharge: Record<string, unknown> = {}) {
    return {
        id: 'l-1',
        referenceExterne: 'FD-1',
        statut: StatutLivraison.EN_ATTENTE,
        flotte: null,
        livreurId: null,
        clientId: 'cl-1',
        typeCourse: 'standard',
        zoneDepart: 'Libreville',
        zoneArrivee: 'Akanda',
        adresseDepart: 'Quartier Louis',
        adresseArrivee: 'Angondjé',
        destinataireNom: 'Awa',
        destinataireContact: '+24106998877',
        tarif: 2_000,
        commission: 100,
        tarifEwuang: 1_900,
        remunerationLivreur: 1_900,
        payeur: Payeur.DESTINATAIRE,
        montantMarchandise: 15_000,
        chargeEwuang: { enlevement: { contact: '+24107112233' }, colis: { description: '2 cartons' } },
        missionEwuangId: 'm-1',
        statutEwuang: 'En attente',
        codeRemise: '4817',
        tentativesCode: 0,
        livreurEwuangId: null,
        livreurNom: null,
        livreurContact: null,
        livreurTypeVehicule: null,
        noteLivreur: null,
        dateDemande: new Date('2026-10-24T08:00:00Z'),
        dateAcceptation: null,
        dateRecuperation: null,
        arriveeDestinationAt: null,
        dateLivraison: null,
        dateRetour: null,
        ...surcharge,
    };
}

/** La même course, déjà entre les mains de ce livreur. */
function aLui(surcharge: Record<string, unknown> = {}) {
    return course({ flotte: Flotte.FIND_DELIVERY, livreurId: LIVREUR.id, statut: StatutLivraison.ACCEPTEE, ...surcharge });
}

function fabriquer() {
    const prisma = {
        livraison: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(course()),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ tentativesCode: 1 }),
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        livreur: { update: vi.fn().mockResolvedValue({}) },
        suiviPosition: { create: vi.fn().mockResolvedValue({}) },
        $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const livreurs = {
        exigerValide: vi.fn().mockResolvedValue(LIVREUR),
        exigerProfil: vi.fn().mockResolvedValue(LIVREUR),
    };
    const ewuang = { annulerMission: vi.fn().mockResolvedValue({ statut: 'Annulée' }) };
    const especes = {
        etatLivreur: vi.fn().mockResolvedValue({ solde: 0, blocage: null }),
        exigerPeutPrendre: vi.fn().mockResolvedValue(undefined),
        ecrireCourse: vi.fn().mockResolvedValue(undefined),
    };
    const service = new LivreurCoursesService(
        prisma as unknown as PrismaService,
        livreurs as unknown as LivreursService,
        ewuang as unknown as EwuangClient,
        especes as unknown as EspecesService,
    );
    return { prisma, livreurs, ewuang, especes, service };
}

/** Les écritures passées au registre, toutes étapes confondues. */
function ecritures() {
    return f.especes.ecrireCourse.mock.calls.flatMap(([, e]) => e as Record<string, unknown>[]);
}

let f: ReturnType<typeof fabriquer>;
beforeEach(() => {
    f = fabriquer();
});

describe('disponibles', () => {
    it('garde les courses compatibles (véhicule, zone) et met l’express en tête', async () => {
        f.prisma.livraison.findMany.mockResolvedValue([
            course({ id: 'a' }),
            course({ id: 'voiture', chargeEwuang: { colis: { vehicule_requis: 'voiture' } } }),
            course({ id: 'owendo', zoneDepart: 'Owendo' }),
            course({ id: 'express', typeCourse: 'express' }),
        ]);
        const { courses } = await f.service.disponibles('u-lv');
        expect(courses.map((c) => c.id)).toEqual(['express', 'a']);
    });

    it('ne sert pas les contacts avant l’acceptation', async () => {
        f.prisma.livraison.findMany.mockResolvedValue([course()]);
        const { courses } = await f.service.disponibles('u-lv');
        expect(courses[0].destinataire).not.toHaveProperty('contact');
        expect(courses[0].enlevement).not.toHaveProperty('contact');
        expect(courses[0]).not.toHaveProperty('codeRemise');
        expect(courses[0].aEncaisser).toEqual({ enlevement: 0, remise: 17_000, retour: 2_000 });
        expect(courses[0].gain).toBe(1_900);
    });

    it('hors service : aucune course', async () => {
        f.livreurs.exigerValide.mockResolvedValue({ ...LIVREUR, estDisponible: false });
        expect(await f.service.disponibles('u-lv')).toEqual({ enService: false, blocage: null, courses: [] });
        expect(f.prisma.livraison.findMany).not.toHaveBeenCalled();
    });

    it('espèces à verser (R5) : aucune course, et le motif', async () => {
        f.especes.etatLivreur.mockResolvedValue({ solde: 52_000, blocage: 'versez' });
        expect(await f.service.disponibles('u-lv')).toEqual({ enService: true, blocage: 'versez', courses: [] });
        expect(f.prisma.livraison.findMany).not.toHaveBeenCalled();
    });

    it('dossier non validé : la garde du KYC remonte', async () => {
        f.livreurs.exigerValide.mockRejectedValue(new ForbiddenException('dossier'));
        await expect(f.service.disponibles('u-lv')).rejects.toBeInstanceOf(ForbiddenException);
    });
});

describe('accepter', () => {
    it('prend la course sous le verrou sansFlotte, puis la retire chez Ewuang', async () => {
        f.prisma.livraison.findFirst.mockResolvedValueOnce(course()).mockResolvedValue(aLui());
        await f.service.accepter('u-lv', 'l-1');

        const prise = f.prisma.livraison.updateMany.mock.calls[0][0];
        expect(prise.where).toMatchObject({ id: 'l-1', livreurId: null, statut: StatutLivraison.EN_ATTENTE });
        // Libre : jamais prise, ou réservée par Ewuang sans attribution depuis 10 min.
        expect(prise.where.OR).toEqual([
            { flotte: null },
            { flotte: Flotte.EWUANG, dateAcceptation: null, reserveeEwuangAt: { lt: expect.any(Date) } },
        ]);
        expect(prise.data).toMatchObject({
            flotte: Flotte.FIND_DELIVERY,
            livreurId: 'lv-1',
            statut: StatutLivraison.ACCEPTEE,
            remunerationLivreur: 1_900,
            commission: 100,
            tarifEwuang: null,
            livreurNom: 'Jean Ondo',
            reserveeEwuangAt: null,
            livreurEwuangId: null,
        });
        expect(f.ewuang.annulerMission).toHaveBeenCalledWith('m-1');
    });

    it('course prise entre-temps : 409, Ewuang n’est pas appelé', async () => {
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(ConflictException);
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
    });

    it('Ewuang refuse (un des siens a le colis) : acceptation défaite, course à Ewuang, 409', async () => {
        f.ewuang.annulerMission.mockRejectedValue(new BadRequestException('Colis déjà récupéré'));
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(ConflictException);
        const defaite = f.prisma.livraison.updateMany.mock.calls[1][0];
        expect(defaite.where).toMatchObject({ livreurId: 'lv-1', flotte: Flotte.FIND_DELIVERY });
        expect(defaite.data).toMatchObject({
            flotte: Flotte.EWUANG,
            livreurId: null,
            statut: StatutLivraison.EN_ATTENTE,
            tarifEwuang: 1_900,
        });
    });

    it('Ewuang injoignable : acceptation défaite, course au pot commun, 503', async () => {
        f.ewuang.annulerMission.mockRejectedValue(new ServiceUnavailableException('injoignable'));
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(f.prisma.livraison.updateMany.mock.calls[1][0].data).toMatchObject({ flotte: null, livreurId: null });
    });

    it('mission déjà annulée chez Ewuang : rien à retirer', async () => {
        f.prisma.livraison.findFirst.mockResolvedValueOnce(course({ statutEwuang: 'Annulée' })).mockResolvedValue(aLui());
        await f.service.accepter('u-lv', 'l-1');
        expect(f.ewuang.annulerMission).not.toHaveBeenCalled();
    });

    it('véhicule incompatible : 404, rien n’est écrit', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(course({ chargeEwuang: { colis: { vehicule_requis: 'camionnette' } } }));
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(NotFoundException);
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();
    });

    it('hors service : 409', async () => {
        f.livreurs.exigerValide.mockResolvedValue({ ...LIVREUR, estDisponible: false });
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('espèces à verser (R5) : 403, la course n’est pas prise', async () => {
        f.especes.exigerPeutPrendre.mockRejectedValue(new ForbiddenException('versez'));
        await expect(f.service.accepter('u-lv', 'l-1')).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();
        expect(f.especes.exigerPeutPrendre).toHaveBeenCalledWith('lv-1');
    });
});

describe('recuperer', () => {
    it("l'expéditeur paie : le montant exact est exigé, sinon rien ne bouge", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui({ payeur: Payeur.EXPEDITEUR }));
        await expect(f.service.recuperer('u-lv', 'l-1', { montant_encaisse: 1_500 })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();

        await f.service.recuperer('u-lv', 'l-1', { montant_encaisse: 2_000 });
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].data).toMatchObject({
            statut: StatutLivraison.EN_COURS,
            montantEncaisseEnlevement: 2_000,
        });
        expect(ecritures()).toEqual([
            { type: 'ENCAISSEMENT', livraisonId: 'l-1', etape: 'enlevement', montant: 2_000, livreurId: 'lv-1' },
        ]);
    });

    it("course changée entre-temps : 409, et l'écriture n'est pas passée", async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui({ payeur: Payeur.EXPEDITEUR }));
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        await expect(f.service.recuperer('u-lv', 'l-1', { montant_encaisse: 2_000 })).rejects.toBeInstanceOf(
            ConflictException,
        );
        expect(f.especes.ecrireCourse).not.toHaveBeenCalled();
    });

    it('le destinataire paie : rien ne doit être déclaré à l’enlèvement', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui());
        await expect(f.service.recuperer('u-lv', 'l-1', { montant_encaisse: 2_000 })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        await f.service.recuperer('u-lv', 'l-1', {});
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].data).not.toHaveProperty('montantEncaisseEnlevement');
    });
});

describe('livrer', () => {
    const enCours = () => aLui({ statut: StatutLivraison.EN_COURS });

    it('montant faux : 400 sans consommer d’essai', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(enCours());
        await expect(f.service.livrer('u-lv', 'l-1', { code: '4817', montant_encaisse: 2_000 })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();
    });

    it('code faux : l’essai est consommé AVANT la comparaison, sous la borne de 5', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(enCours());
        f.prisma.livraison.findUniqueOrThrow.mockResolvedValue({ tentativesCode: 2 });
        await expect(f.service.livrer('u-lv', 'l-1', { code: '0000', montant_encaisse: 17_000 })).rejects.toThrow(
            'Encore 3 essais',
        );
        const essai = f.prisma.livraison.updateMany.mock.calls[0][0];
        expect(essai.where).toMatchObject({ tentativesCode: { lt: 5 }, statut: StatutLivraison.EN_COURS });
        expect(essai.data).toEqual({ tentativesCode: { increment: 1 } });
        expect(f.prisma.livraison.updateMany).toHaveBeenCalledTimes(1);
    });

    it('code bloqué : 409, même avec le bon code', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(enCours());
        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        await expect(f.service.livrer('u-lv', 'l-1', { code: '4817', montant_encaisse: 17_000 })).rejects.toBeInstanceOf(
            ConflictException,
        );
    });

    it('bon code et bon montant : livrée, encaissement noté, compteur du livreur incrémenté', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(enCours());
        await f.service.livrer('u-lv', 'l-1', { code: '4817', montant_encaisse: 17_000 });
        expect(f.prisma.livraison.updateMany.mock.calls[1][0].data).toMatchObject({
            statut: StatutLivraison.LIVREE,
            montantEncaisseRemise: 17_000,
        });
        expect(f.prisma.livreur.update).toHaveBeenCalledWith({
            where: { id: 'lv-1' },
            data: { nombreLivraisons: { increment: 1 } },
        });
        // L'exemple du plan : 17 000 reçus, 1 900 gardés, 15 000 dus au client.
        expect(ecritures()).toEqual([
            { type: 'ENCAISSEMENT', livraisonId: 'l-1', etape: 'remise', montant: 17_000, livreurId: 'lv-1' },
            { type: 'REMUNERATION', livraisonId: 'l-1', etape: 'remuneration', montant: 1_900, livreurId: 'lv-1' },
            { type: 'MARCHANDISE', livraisonId: 'l-1', etape: 'marchandise', montant: 15_000, clientId: 'cl-1' },
        ]);
    });

    it('course sans client avec marchandise : 409 avant de consommer un essai', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui({ statut: StatutLivraison.EN_COURS, clientId: null }));
        await expect(f.service.livrer('u-lv', 'l-1', { code: '4817', montant_encaisse: 17_000 })).rejects.toBeInstanceOf(
            ConflictException,
        );
        expect(f.prisma.livraison.updateMany).not.toHaveBeenCalled();
    });
});

describe('échec et retour', () => {
    it('échec refusé avant 10 min sur place', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(
            aLui({ statut: StatutLivraison.EN_COURS, arriveeDestinationAt: new Date(Date.now() - 4 * 60_000) }),
        );
        await expect(f.service.echec('u-lv', 'l-1', { motif: 'absent' })).rejects.toThrow('Attendez encore 6 min');
    });

    it('échec sans arrivée signalée : 409', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui({ statut: StatutLivraison.EN_COURS }));
        await expect(f.service.echec('u-lv', 'l-1', { motif: 'absent' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('échec après 10 min : retour à l’expéditeur, avec le motif', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(
            aLui({ statut: StatutLivraison.EN_COURS, arriveeDestinationAt: new Date(Date.now() - 11 * 60_000) }),
        );
        await f.service.echec('u-lv', 'l-1', { motif: 'refus_paiement' });
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].data).toEqual({
            statut: StatutLivraison.RETOUR_EXPEDITEUR,
            noteLivreur: 'Le destinataire refuse de payer',
        });
    });

    it('retour : l’expéditeur doit l’aller, le livreur touche sa part et le forfait', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui({ statut: StatutLivraison.RETOUR_EXPEDITEUR }));
        await expect(f.service.retourner('u-lv', 'l-1', {})).rejects.toBeInstanceOf(BadRequestException);

        await f.service.retourner('u-lv', 'l-1', { montant_encaisse: 2_000 });
        expect(f.prisma.livraison.updateMany.mock.calls[0][0].data).toMatchObject({
            statut: StatutLivraison.RETOURNEE,
            montantEncaisseRetour: 2_000,
            remunerationLivreur: 2_400,
            commission: -400,
        });
        // Pas de marchandise : le colis n'a pas été remis.
        expect(ecritures()).toEqual([
            { type: 'ENCAISSEMENT', livraisonId: 'l-1', etape: 'retour', montant: 2_000, livreurId: 'lv-1' },
            { type: 'REMUNERATION', livraisonId: 'l-1', etape: 'remuneration', montant: 2_400, livreurId: 'lv-1' },
        ]);
    });
});

describe('rendre', () => {
    it('seulement avant l’enlèvement, et la course repart libre', async () => {
        f.prisma.livraison.findFirst.mockResolvedValue(aLui());
        await f.service.rendre('u-lv', 'l-1');
        const rendue = f.prisma.livraison.updateMany.mock.calls[0][0];
        expect(rendue.where).toMatchObject({ statut: { in: [StatutLivraison.ACCEPTEE] } });
        expect(rendue.data).toMatchObject({ flotte: null, livreurId: null, statut: StatutLivraison.EN_ATTENTE, commission: 100 });

        f.prisma.livraison.updateMany.mockResolvedValue({ count: 0 });
        await expect(f.service.rendre('u-lv', 'l-1')).rejects.toBeInstanceOf(ConflictException);
    });
});
