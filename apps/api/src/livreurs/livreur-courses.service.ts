import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Flotte, Prisma, StatutLivraison, TypeMouvementEspeces, type Livreur } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { EspecesService, type EcritureCourse } from '../especes/especes.service.js';
import { EwuangClient, type CreerMissionEntree } from '../ewuang/ewuang.client.js';
import {
    aEncaisserAuRetour,
    calculerEncaissements,
    calculerRemunerationLivreur,
    FORFAIT_RETOUR,
} from '../livraisons/encaissement.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { sansFlotte } from '../livraisons/flotte.js';
import { calculerCommission } from '../tarifs/grille-tarifs.js';
import { EchecDto, EncaissementDto, LivrerDto, MOTIFS_ECHEC, PositionDto } from './livreurs.dto.js';
import { LivreursService } from './livreurs.service.js';
import { vehiculeCompatible, vehiculeDuTransport } from './vehicules.js';

/**
 * Les courses vues et exécutées par un livreur de la flotte find_delivery.
 *
 * ── Le verrou d'attribution ────────────────────────────────────────────────
 *
 * Une course est proposée en même temps à cette flotte et à Ewuang.
 * `accepter` la prend par UNE mise à jour conditionnée par `sansFlotte`
 * (src/livraisons/flotte.ts) : deux livreurs qui acceptent au même instant, un
 * seul obtient une ligne. La réservation d'un livreur Ewuang (v2 du contrat,
 * ewuang-reservation.service.ts) et le webhook `mission.attribuee` posent
 * `flotte = EWUANG` sous la même condition.
 *
 * Puis la mission est annulée chez Ewuang, pour la retirer de la liste de ses
 * livreurs. Si Ewuang refuse (colis déjà récupéré par un des siens) ou ne
 * répond pas, l'acceptation est défaite : jamais deux livreurs sur une course.
 * Tant qu'Ewuang est en v1 (sans réservation), un livreur Ewuang qui a accepté
 * sans avoir récupéré le colis se le voit retirer ; en v2, il ne l'a qu'après
 * une réservation, et la course n'est alors plus libre ici.
 *
 * ── Les transitions ────────────────────────────────────────────────────────
 *
 *   EN_ATTENTE ──accepter──▶ ACCEPTEE ──recuperer──▶ EN_COURS ──livrer──▶ LIVREE
 *        ▲                      │                        │
 *        └────────rendre────────┘                        └─echec─▶ RETOUR_EXPEDITEUR ──retourner──▶ RETOURNEE
 *
 * Chaque transition est une mise à jour conditionnée par l'état de départ ET
 * le livreur : une double soumission ou une course reprise entre-temps ne
 * touche aucune ligne, et la réponse est un 409.
 *
 * ── L'argent ───────────────────────────────────────────────────────────────
 *
 * À chaque étape où quelque chose est dû, le livreur déclare ce qu'il a reçu,
 * et le montant EXACT est exigé (R2 : pas de remise ni d'enlèvement contre un
 * paiement partiel). Chaque encaissement, et à la fin la rémunération du
 * livreur et la marchandise due au client, est écrit au registre des espèces
 * dans la MÊME transaction que l'étape (especes.service.ts). Au-delà du
 * plafond ou en retard de versement, le livreur ne prend plus de nouvelle
 * course (R5) ; celles en main continuent.
 */

/** Au 5e code faux, la course ne se clôture plus que par un ADMIN. */
const MAX_TENTATIVES_CODE = 5;

/** Attente chez le destinataire avant de pouvoir déclarer un échec (R3). */
const ATTENTE_AVANT_ECHEC_MS = 10 * 60_000;

/** Courses examinées pour la liste des disponibles, les plus anciennes d'abord. */
const LIMITE_DISPONIBLES = 100;

/** Statuts où le livreur a la course en main. */
const STATUTS_ACTIFS: StatutLivraison[] = [
    StatutLivraison.ACCEPTEE,
    StatutLivraison.EN_COURS,
    StatutLivraison.RETOUR_EXPEDITEUR,
];

/**
 * Une course ouverte à la flotte find_delivery.
 *
 * `payeur` non null : seules les courses payées en espèces y sont proposées
 * (les deux courses d'avant le 2026-10-23 sont réglées hors course).
 * `codeRemise` non null : c'est le code d'Ewuang, déjà transmis au
 * destinataire par le client. Une course qu'Ewuang n'a jamais reçue n'en a pas,
 * et ne peut donc pas être remise : elle attend d'être renvoyée.
 * `sansFlotte` : ni prise, ni réservée par Ewuang (sauf réservation expirée).
 */
function ouverte(maintenant = new Date()): Prisma.LivraisonWhereInput {
    return {
        livreurId: null,
        statut: StatutLivraison.EN_ATTENTE,
        payeur: { not: null },
        codeRemise: { not: null },
        ...sansFlotte(maintenant),
    };
}

const CHAMPS = {
    id: true,
    referenceExterne: true,
    statut: true,
    flotte: true,
    livreurId: true,
    clientId: true,
    typeCourse: true,
    zoneDepart: true,
    zoneArrivee: true,
    adresseDepart: true,
    adresseArrivee: true,
    destinataireNom: true,
    destinataireContact: true,
    tarif: true,
    commission: true,
    tarifEwuang: true,
    remunerationLivreur: true,
    payeur: true,
    montantMarchandise: true,
    chargeEwuang: true,
    missionEwuangId: true,
    statutEwuang: true,
    codeRemise: true,
    tentativesCode: true,
    livreurEwuangId: true,
    livreurNom: true,
    livreurContact: true,
    livreurTypeVehicule: true,
    noteLivreur: true,
    dateDemande: true,
    dateAcceptation: true,
    dateRecuperation: true,
    arriveeDestinationAt: true,
    dateLivraison: true,
    dateRetour: true,
} satisfies Prisma.LivraisonSelect;

type Course = Prisma.LivraisonGetPayload<{ select: typeof CHAMPS }>;

@Injectable()
export class LivreurCoursesService {
    private readonly logger = new Logger(LivreurCoursesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly livreurs: LivreursService,
        private readonly ewuang: EwuangClient,
        private readonly especes: EspecesService,
    ) { }

    // ─── Lecture ──────────────────────────────────────────────────────────

    /**
     * Courses que ce livreur peut accepter : véhicule et zones compatibles,
     * express d'abord. Aucune quand il est bloqué (R5) : `blocage` dit pourquoi.
     */
    async disponibles(userId: string) {
        const livreur = await this.livreurs.exigerValide(userId);
        if (!livreur.estDisponible) {
            return { enService: false, blocage: null, courses: [] };
        }
        const { blocage } = await this.especes.etatLivreur(livreur.id);
        if (blocage) {
            return { enService: true, blocage, courses: [] };
        }

        const candidates = await this.prisma.livraison.findMany({
            where: ouverte(),
            select: CHAMPS,
            orderBy: { dateDemande: 'asc' },
            take: LIMITE_DISPONIBLES,
        });
        const courses = candidates
            .filter((c) => this.accessible(c, livreur))
            // `sort` est stable : à priorité égale, l'ordre d'ancienneté demeure.
            .sort((a, b) => Number(b.typeCourse === 'express') - Number(a.typeCourse === 'express'))
            .map((c) => this.vue(c, false));
        return { enService: true, blocage: null, courses };
    }

    /** Les courses de ce livreur : en cours, ou l'historique. */
    async mesCourses(userId: string, actives: boolean) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const courses = await this.prisma.livraison.findMany({
            where: {
                livreurId: livreur.id,
                flotte: Flotte.FIND_DELIVERY,
                ...(actives ? { statut: { in: STATUTS_ACTIFS } } : {}),
            },
            select: CHAMPS,
            orderBy: { dateAcceptation: 'desc' },
            take: 50,
        });
        return courses.map((c) => this.vue(c, true));
    }

    /**
    * Détail d'une course : la sienne, avec les contacts, ou une course ouverte
    * qu'il pourrait prendre, sans eux. 404 pour tout le reste.
    */
    async lire(userId: string, id: string) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.prisma.livraison.findFirst({
            where: { id, OR: [{ livreurId: livreur.id, flotte: Flotte.FIND_DELIVERY }, ouverte()] },
            select: CHAMPS,
        });
        if (!course) throw new NotFoundException('Course introuvable');

        const aLui = course.livreurId === livreur.id;
        if (!aLui && !this.accessible(course, livreur)) throw new NotFoundException('Course introuvable');
        return this.vue(course, aLui);
    }

    // ─── Attribution ──────────────────────────────────────────────────────

    async accepter(userId: string, id: string) {
        const livreur = await this.livreurs.exigerValide(userId);
        if (!livreur.estDisponible) {
            throw new ConflictException('Passez en service pour accepter une course');
        }
        await this.especes.exigerPeutPrendre(livreur.id);

        const maintenant = new Date();
        const course = await this.prisma.livraison.findFirst({ where: { id, ...ouverte(maintenant) }, select: CHAMPS });
        if (!course || !this.accessible(course, livreur)) {
            throw new NotFoundException("Cette course n'est plus disponible");
        }

        const tarif = course.tarif ?? 0;
        const gain = calculerRemunerationLivreur(tarif);
        const { count } = await this.prisma.livraison.updateMany({
            where: { id, livreurId: null, statut: StatutLivraison.EN_ATTENTE, ...sansFlotte(maintenant) },
            data: {
                flotte: Flotte.FIND_DELIVERY,
                livreurId: livreur.id,
                statut: StatutLivraison.ACCEPTEE,
                dateAcceptation: maintenant,
                // Une réservation Ewuang expirée est effacée avec son livreur.
                reserveeEwuangAt: null,
                livreurEwuangId: null,
                // La course ne coûte plus rien à Ewuang : la part du livreur
                // devient la nôtre, et la commission se lit par différence.
                remunerationLivreur: gain,
                commission: tarif - gain,
                tarifEwuang: null,
                // Instantané montré au client, comme pour un livreur Ewuang.
                livreurNom: `${livreur.firstname} ${livreur.lastname}`,
                livreurContact: livreur.phoneAirtel || livreur.phoneMoov,
                livreurTypeVehicule: vehiculeDuTransport(livreur.moyenTransport),
            },
        });
        if (count === 0) {
            throw new ConflictException("Cette course vient d'être prise par un autre livreur");
        }

        await this.retirerChezEwuang(course, livreur);
        return this.lire(userId, id);
    }

    /**
     * Annule la mission chez Ewuang ; en cas d'échec, défait l'acceptation.
     *
     * Une mission déjà « Annulée » chez Ewuang (course rendue, ou annulée par
     * Ewuang lui-même) n'est pas rappelée : il n'y a plus rien à retirer.
     */
    private async retirerChezEwuang(course: Course, livreur: Livreur): Promise<void> {
        if (!course.missionEwuangId || course.statutEwuang === 'Annulée') return;

        try {
            const reponse = await this.ewuang.annulerMission(course.missionEwuangId);
            await this.prisma.livraison.update({
                where: { id: course.id },
                data: { statutEwuang: typeof reponse.statut === 'string' ? reponse.statut : 'Annulée' },
            });
        } catch (erreur) {
            if (!(erreur instanceof HttpException)) throw erreur;

            // 400 = Ewuang refuse l'annulation : un de ses livreurs a déjà le
            // colis. La course est à lui. Sinon (réseau, 5xx) on ne sait pas :
            // la course retourne au pot commun, et le livreur réessaiera.
            const refusee = erreur instanceof BadRequestException;
            await this.prisma.livraison.updateMany({
                where: { id: course.id, livreurId: livreur.id, flotte: Flotte.FIND_DELIVERY, statut: StatutLivraison.ACCEPTEE },
                data: {
                    flotte: refusee ? Flotte.EWUANG : null,
                    livreurId: null,
                    statut: StatutLivraison.EN_ATTENTE,
                    dateAcceptation: null,
                    remunerationLivreur: course.remunerationLivreur,
                    commission: course.commission,
                    tarifEwuang: course.tarifEwuang,
                    // Pas de réservation à restaurer : rendue à Ewuang, la
                    // course est à lui pour de bon, et ne doit pas « expirer ».
                    reserveeEwuangAt: null,
                    livreurEwuangId: course.livreurEwuangId,
                    livreurNom: course.livreurNom,
                    livreurContact: course.livreurContact,
                    livreurTypeVehicule: course.livreurTypeVehicule,
                },
            });
            this.logger.warn(`Course ${course.id} : retrait chez Ewuang impossible (${erreur.message}), acceptation défaite`);
            throw refusee
                ? new ConflictException('Cette course a déjà été prise par un livreur partenaire')
                : new ServiceUnavailableException(
                    "Impossible de confirmer la course pour l'instant. Réessayez dans un instant.",
                );
        }
    }

    /** Rend une course pas encore récupérée : elle repart aux autres livreurs. */
    async rendre(userId: string, id: string) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        const ok = await this.transition(livreur, id, [StatutLivraison.ACCEPTEE], {
            flotte: null,
            livreurId: null,
            statut: StatutLivraison.EN_ATTENTE,
            dateAcceptation: null,
            remunerationLivreur: null,
            commission: calculerCommission(course.tarif ?? 0),
            livreurNom: null,
            livreurContact: null,
            livreurTypeVehicule: null,
        });
        // La mission ayant été annulée chez Ewuang à l'acceptation, la course
        // rendue ne revient qu'à la flotte find_delivery. Phase 4 : la
        // réservation n'annulera plus avant l'enlèvement.
        if (!ok) throw new ConflictException('Seule une course pas encore récupérée peut être rendue');
        return { id, statut: StatutLivraison.EN_ATTENTE };
    }

    // ─── Exécution ────────────────────────────────────────────────────────

    async recuperer(userId: string, id: string, dto: EncaissementDto) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        this.exigerStatut(course, StatutLivraison.ACCEPTEE, "Le colis n'est pas à récupérer");

        const du = this.encaissements(course).enlevement;
        this.verifierMontant(du, dto.montant_encaisse, "à l'enlèvement");

        const maintenant = new Date();
        await this.prisma.$transaction(async (tx) => {
            await this.transitionOu409(livreur, id, [StatutLivraison.ACCEPTEE], {
                statut: StatutLivraison.EN_COURS,
                dateRecuperation: maintenant,
                ...(du > 0 ? { montantEncaisseEnlevement: du, encaisseEnlevementAt: maintenant } : {}),
            }, tx);
            await this.especes.ecrireCourse(tx, [
                { type: TypeMouvementEspeces.ENCAISSEMENT, livraisonId: id, etape: 'enlevement', montant: du, livreurId: livreur.id },
            ]);
        });
        return this.lire(userId, id);
    }

    /** Arrivée chez le destinataire : ouvre le délai avant un éventuel échec. Idempotent. */
    async arrivee(userId: string, id: string) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        this.exigerStatut(course, StatutLivraison.EN_COURS, "Récupérez d'abord le colis");
        await this.prisma.livraison.updateMany({
            where: { id, livreurId: livreur.id, statut: StatutLivraison.EN_COURS, arriveeDestinationAt: null },
            data: { arriveeDestinationAt: new Date() },
        });
        return this.lire(userId, id);
    }

    /**
     * Remise contre le code du destinataire.
     *
     * L'essai est CONSOMMÉ avant la comparaison, par une mise à jour
     * conditionnée par `tentativesCode < 5` : des requêtes parallèles prennent
     * chacune un essai sous le verrou de ligne, et aucune ne peut comparer au
     * sixième. Comparer d'abord et compter ensuite laisserait passer autant
     * d'essais que de requêtes simultanées — le brute-force qu'Ewuang a fermé
     * le 2026-10-23 en déplaçant ce contrôle dans `verifier_code_livraison`.
     */
    async livrer(userId: string, id: string, dto: LivrerDto) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        this.exigerStatut(course, StatutLivraison.EN_COURS, "Récupérez d'abord le colis");

        // Le montant se vérifie avant le code : une erreur de saisie de
        // l'argent ne doit pas coûter un essai.
        const du = this.encaissements(course).remise;
        this.verifierMontant(du, dto.montant_encaisse, 'à la remise');
        const marchandise = this.marchandiseDue(course);

        const { count } = await this.prisma.livraison.updateMany({
            where: {
                id,
                livreurId: livreur.id,
                statut: StatutLivraison.EN_COURS,
                tentativesCode: { lt: MAX_TENTATIVES_CODE },
            },
            data: { tentativesCode: { increment: 1 } },
        });
        if (count === 0) {
            throw new ConflictException(
                'Code bloqué après 5 essais incorrects : contactez find_delivery pour clôturer la course',
            );
        }

        if (!codesEgaux(dto.code, course.codeRemise)) {
            const { tentativesCode } = await this.prisma.livraison.findUniqueOrThrow({
                where: { id },
                select: { tentativesCode: true },
            });
            const restants = Math.max(0, MAX_TENTATIVES_CODE - tentativesCode);
            throw new BadRequestException(
                restants > 0
                    ? `Code incorrect. Encore ${restants} essai${restants > 1 ? 's' : ''}.`
                    : 'Code incorrect. Code bloqué : contactez find_delivery pour clôturer la course.',
            );
        }

        const maintenant = new Date();
        await this.prisma.$transaction(async (tx) => {
            const livree = await tx.livraison.updateMany({
                where: { id, livreurId: livreur.id, statut: StatutLivraison.EN_COURS },
                data: {
                    statut: StatutLivraison.LIVREE,
                    dateLivraison: maintenant,
                    ...(du > 0 ? { montantEncaisseRemise: du, encaisseRemiseAt: maintenant } : {}),
                },
            });
            if (livree.count === 0) throw new ConflictException('Cette course a changé entre-temps');
            await tx.livreur.update({ where: { id: livreur.id }, data: { nombreLivraisons: { increment: 1 } } });
            await this.especes.ecrireCourse(tx, [
                { type: TypeMouvementEspeces.ENCAISSEMENT, livraisonId: id, etape: 'remise', montant: du, livreurId: livreur.id },
                {
                    type: TypeMouvementEspeces.REMUNERATION,
                    livraisonId: id,
                    etape: 'remuneration',
                    montant: course.remunerationLivreur ?? calculerRemunerationLivreur(course.tarif ?? 0),
                    livreurId: livreur.id,
                },
                ...marchandise,
            ]);
        });
        return this.lire(userId, id);
    }

    /** Échec de remise, après 10 min sur place (R3) : le colis repart à l'expéditeur. */
    async echec(userId: string, id: string, dto: EchecDto) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        this.exigerStatut(course, StatutLivraison.EN_COURS, 'Seule une course en cours de livraison peut échouer');

        if (!course.arriveeDestinationAt) {
            throw new ConflictException("Signalez d'abord votre arrivée chez le destinataire");
        }
        const reste = course.arriveeDestinationAt.getTime() + ATTENTE_AVANT_ECHEC_MS - Date.now();
        if (reste > 0) {
            throw new ConflictException(
                `Attendez encore ${Math.ceil(reste / 60_000)} min et appelez le destinataire au moins deux fois avant de déclarer l'échec`,
            );
        }

        await this.transitionOu409(livreur, id, [StatutLivraison.EN_COURS], {
            statut: StatutLivraison.RETOUR_EXPEDITEUR,
            noteLivreur: MOTIFS_ECHEC[dto.motif],
        });
        return this.lire(userId, id);
    }

    /**
     * Colis rendu à l'expéditeur. Il doit alors les frais de l'aller si le
     * destinataire devait les payer ; le livreur touche sa part de l'aller et
     * le forfait retour, à la charge de find_delivery (R3).
     */
    async retourner(userId: string, id: string, dto: EncaissementDto) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        this.exigerStatut(course, StatutLivraison.RETOUR_EXPEDITEUR, "Ce colis n'est pas en retour");

        const tarif = course.tarif ?? 0;
        const du = course.payeur ? aEncaisserAuRetour(tarif, course.payeur) : 0;
        this.verifierMontant(du, dto.montant_encaisse, 'au retour du colis');

        const gain = (course.remunerationLivreur ?? calculerRemunerationLivreur(tarif)) + FORFAIT_RETOUR;
        const maintenant = new Date();
        await this.prisma.$transaction(async (tx) => {
            await this.transitionOu409(livreur, id, [StatutLivraison.RETOUR_EXPEDITEUR], {
                statut: StatutLivraison.RETOURNEE,
                dateRetour: maintenant,
                remunerationLivreur: gain,
                // Négative si le retour coûte plus que ce que la course a
                // rapporté : c'est une information juste, pas une erreur.
                commission: tarif - gain,
                ...(du > 0 ? { montantEncaisseRetour: du, encaisseRetourAt: maintenant } : {}),
            }, tx);
            // Pas de marchandise : le colis n'a pas été remis, rien n'a été
            // encaissé pour le client.
            await this.especes.ecrireCourse(tx, [
                { type: TypeMouvementEspeces.ENCAISSEMENT, livraisonId: id, etape: 'retour', montant: du, livreurId: livreur.id },
                { type: TypeMouvementEspeces.REMUNERATION, livraisonId: id, etape: 'remuneration', montant: gain, livreurId: livreur.id },
            ]);
        });
        return this.lire(userId, id);
    }

    async enregistrerPosition(userId: string, id: string, dto: PositionDto) {
        const livreur = await this.livreurs.exigerProfil(userId);
        const course = await this.maCourse(livreur, id);
        if (!STATUTS_ACTIFS.includes(course.statut)) {
            throw new ConflictException("Cette course n'est plus en cours");
        }
        await this.prisma.suiviPosition.create({
            data: { livraisonId: id, latitude: dto.latitude, longitude: dto.longitude },
        });
        return { ok: true };
    }

    // ─── Outils ───────────────────────────────────────────────────────────

    private async maCourse(livreur: Livreur, id: string): Promise<Course> {
        const course = await this.prisma.livraison.findFirst({
            where: { id, livreurId: livreur.id, flotte: Flotte.FIND_DELIVERY },
            select: CHAMPS,
        });
        if (!course) throw new NotFoundException('Course introuvable');
        return course;
    }

    private accessible(course: Course, livreur: Livreur): boolean {
        const requis = (course.chargeEwuang as Partial<CreerMissionEntree> | null)?.colis?.vehicule_requis;
        const zones = livreur.zoneGeographique;
        return (
            vehiculeCompatible(requis, livreur.moyenTransport) &&
            (zones.length === 0 || (course.zoneDepart !== null && zones.includes(course.zoneDepart)))
        );
    }

    private encaissements(course: Course) {
        // Toute course de la flotte a un payeur : `OUVERTE` l'exige.
        if (!course.payeur) throw new ConflictException("Cette course n'est pas payée en espèces");
        return calculerEncaissements(course.tarif ?? 0, course.payeur, course.montantMarchandise);
    }

    /** La marchandise encaissée à la remise est due au client qui a commandé. */
    private marchandiseDue(course: Course): EcritureCourse[] {
        if (course.montantMarchandise === 0) return [];
        if (!course.clientId) {
            // Impossible pour une course créée par l'API : refuser plutôt
            // qu'encaisser de l'argent qui n'aurait pas de propriétaire au registre.
            throw new ConflictException('Course sans client : contactez find_delivery pour la clôturer');
        }
        return [{
            type: TypeMouvementEspeces.MARCHANDISE,
            livraisonId: course.id,
            etape: 'marchandise',
            montant: course.montantMarchandise,
            clientId: course.clientId,
        }];
    }

    private exigerStatut(course: Course, attendu: StatutLivraison, message: string): void {
        if (course.statut !== attendu) throw new ConflictException(message);
    }

    /** Montant exact exigé quand quelque chose est dû ; aucun quand rien ne l'est. */
    private verifierMontant(du: number, recu: number | undefined, moment: string): void {
        if (du === 0) {
            if (recu) throw new BadRequestException(`Rien n'est à encaisser ${moment}`);
            return;
        }
        if (recu !== du) {
            throw new BadRequestException(
                `Encaissez exactement ${du.toLocaleString('fr-FR')} FCFA ${moment} avant de continuer : pas de paiement partiel`,
            );
        }
    }

    private async transition(
        livreur: Livreur,
        id: string,
        depuis: StatutLivraison[],
        // « Unchecked » : `rendre` remet `livreurId` à null, une clé étrangère.
        data: Prisma.LivraisonUncheckedUpdateManyInput,
        db: Prisma.TransactionClient = this.prisma,
    ): Promise<boolean> {
        const { count } = await db.livraison.updateMany({
            where: { id, livreurId: livreur.id, flotte: Flotte.FIND_DELIVERY, statut: { in: depuis } },
            data,
        });
        return count === 1;
    }

    private async transitionOu409(
        livreur: Livreur,
        id: string,
        depuis: StatutLivraison[],
        data: Prisma.LivraisonUncheckedUpdateManyInput,
        db: Prisma.TransactionClient = this.prisma,
    ): Promise<void> {
        if (!(await this.transition(livreur, id, depuis, data, db))) {
            throw new ConflictException('Cette course a changé entre-temps');
        }
    }

    /**
     * Ce que l'application livreur affiche. Les contacts n'apparaissent que sur
     * ses propres courses ; le code de remise, jamais : c'est au destinataire
     * de le donner.
     */
    private vue(course: Course, detaillee: boolean) {
        const charge = (course.chargeEwuang ?? {}) as Partial<CreerMissionEntree>;
        const tarif = course.tarif ?? 0;
        const encaissements = course.payeur
            ? calculerEncaissements(tarif, course.payeur, course.montantMarchandise)
            : { enlevement: 0, remise: 0 };

        return {
            id: course.id,
            reference: course.referenceExterne,
            statut: course.statut,
            typeCourse: course.typeCourse,
            zoneDepart: course.zoneDepart,
            zoneArrivee: course.zoneArrivee,
            enlevement: {
                adresse: course.adresseDepart,
                ...(detaillee
                    ? { contact: charge.enlevement?.contact ?? null, instructions: charge.enlevement?.instructions ?? null }
                    : {}),
            },
            destinataire: {
                adresse: course.adresseArrivee,
                ...(detaillee ? { nom: course.destinataireNom, contact: course.destinataireContact } : {}),
            },
            colis: {
                description: charge.colis?.description ?? null,
                vehiculeRequis: charge.colis?.vehicule_requis ?? null,
            },
            dateSouhaitee: charge.date_souhaitee ?? null,
            payeur: course.payeur,
            aEncaisser: {
                enlevement: encaissements.enlevement,
                remise: encaissements.remise,
                retour: course.payeur ? aEncaisserAuRetour(tarif, course.payeur) : 0,
            },
            gain: course.remunerationLivreur ?? calculerRemunerationLivreur(tarif),
            motifEchec: course.statut === StatutLivraison.RETOUR_EXPEDITEUR || course.statut === StatutLivraison.RETOURNEE
                ? course.noteLivreur
                : null,
            essaisCodeRestants: Math.max(0, MAX_TENTATIVES_CODE - course.tentativesCode),
            dateDemande: course.dateDemande,
            dateAcceptation: course.dateAcceptation,
            dateRecuperation: course.dateRecuperation,
            arriveeDestinationAt: course.arriveeDestinationAt,
            dateLivraison: course.dateLivraison,
            dateRetour: course.dateRetour,
        };
    }
}

/** Comparaison à temps constant : la durée de réponse ne dit rien du code. */
function codesEgaux(saisi: string, attendu: string | null): boolean {
    if (!attendu || saisi.length !== attendu.length) return false;
    return timingSafeEqual(Buffer.from(saisi), Buffer.from(attendu));
}
