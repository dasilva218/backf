import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeMouvementEspeces } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MouvementsQueryDto, ReglementDto } from './especes.dto.js';
import { etatLivreur, sens, solde, TYPES_CLIENT, TYPES_EWUANG, TYPES_LIVREUR, type EtatLivreur } from './especes.js';

/**
 * Le registre des espèces : écritures des courses, règlements saisis par un
 * ADMIN, soldes. Voir le modèle `MouvementEspeces` pour les comptes et les sens.
 */

const T = TypeMouvementEspeces;

/** Une écriture causée par une étape de course. */
export interface EcritureCourse {
    type:
        | typeof T.ENCAISSEMENT
        | typeof T.REMUNERATION
        | typeof T.MARCHANDISE
        | typeof T.ENCAISSEMENT_EWUANG
        | typeof T.TARIF_EWUANG;
    livraisonId: string;
    /**
     * Distingue les écritures d'une même course dans la clé d'idempotence. Les
     * étapes `ewuang:*` sont celles d'une course livrée par Ewuang (webhook).
     */
    etape:
        | 'enlevement'
        | 'remise'
        | 'retour'
        | 'remuneration'
        | 'marchandise'
        | 'ewuang:enlevement'
        | 'ewuang:remise'
        | 'ewuang:retour'
        | 'ewuang:tarif';
    montant: number;
    livreurId?: string;
    clientId?: string;
}

/** Ce qu'il faut d'un mouvement pour l'afficher. */
const CHAMPS_MOUVEMENT = {
    id: true,
    type: true,
    montant: true,
    cle: true,
    note: true,
    createdAt: true,
    livraisonId: true,
    livraison: { select: { referenceExterne: true } },
} satisfies Prisma.MouvementEspecesSelect;

type Mouvement = Prisma.MouvementEspecesGetPayload<{ select: typeof CHAMPS_MOUVEMENT }>;

/** Mouvements montés dans un relevé de livreur ou de client. */
const LIMITE_RELEVE = 30;

/** Écarts d'encaissement Ewuang servis à l'écran, les plus récents d'abord. */
const LIMITE_ECARTS = 100;

/** Une étape de course Ewuang dont l'encaissement au registre n'est pas celui attendu. */
export interface EcartEwuang {
    livraisonId: string;
    referenceExterne: string | null;
    statutEwuang: string | null;
    livreurNom: string | null;
    etape: 'enlevement' | 'remise' | 'retour';
    attendu: number;
    inscrit: number;
    faitAt: Date;
}

@Injectable()
export class EspecesService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Écritures des courses ────────────────────────────────────────────

    /**
     * À appeler DANS la transaction de l'étape : l'étape et son argent sont
     * écrits ensemble ou pas du tout. Les montants nuls sont ignorés.
     */
    async ecrireCourse(tx: Prisma.TransactionClient, ecritures: EcritureCourse[]): Promise<void> {
        const data = ecritures
            .filter((e) => e.montant > 0)
            .map((e) => ({
                type: e.type,
                montant: e.montant,
                livraisonId: e.livraisonId,
                livreurId: e.livreurId ?? null,
                clientId: e.clientId ?? null,
                cle: `${e.livraisonId}:${e.etape}`,
            }));
        if (data.length > 0) await tx.mouvementEspeces.createMany({ data });
    }

    // ─── Livreurs ─────────────────────────────────────────────────────────

    async etatLivreur(livreurId: string): Promise<EtatLivreur> {
        const ligne = (await this.soldesLivreurs(livreurId))[0];
        return etatLivreur(ligne?.solde ?? 0, ligne?.depuis ?? null, new Date());
    }

    /** R5 : refuse une nouvelle course au livreur au-delà du plafond ou en retard de versement. */
    async exigerPeutPrendre(livreurId: string): Promise<void> {
        const { blocage } = await this.etatLivreur(livreurId);
        if (blocage) throw new ForbiddenException(blocage);
    }

    async releveLivreur(livreurId: string) {
        const [etat, mouvements] = await Promise.all([
            this.etatLivreur(livreurId),
            this.prisma.mouvementEspeces.findMany({
                where: { livreurId },
                select: CHAMPS_MOUVEMENT,
                orderBy: { createdAt: 'desc' },
                take: LIMITE_RELEVE,
            }),
        ]);
        return { ...etat, mouvements: mouvements.map(vueMouvement) };
    }

    /** Encours de chaque livreur qui a mouvementé de l'argent, les plus gros d'abord. */
    async encoursLivreurs() {
        const soldes = await this.soldesLivreurs();
        const livreurs = await this.prisma.livreur.findMany({
            where: { id: { in: soldes.map((s) => s.livreurId) } },
            select: { id: true, firstname: true, lastname: true, phoneAirtel: true, phoneMoov: true },
        });
        const parId = new Map(livreurs.map((l) => [l.id, l]));
        const maintenant = new Date();
        return soldes
            .map((s) => ({ livreur: parId.get(s.livreurId) ?? null, ...etatLivreur(s.solde, s.depuis, maintenant) }))
            .sort((a, b) => b.solde - a.solde);
    }

    /** Le livreur remet des espèces à find_delivery. Au plus son solde. */
    verser(livreurId: string, dto: ReglementDto, saisiParId: string) {
        return this.reglerLivreur(livreurId, T.VERSEMENT, dto, saisiParId);
    }

    /** find_delivery paie le livreur quand son solde est négatif. Au plus ce qui lui est dû. */
    payer(livreurId: string, dto: ReglementDto, saisiParId: string) {
        return this.reglerLivreur(livreurId, T.PAIEMENT_LIVREUR, dto, saisiParId);
    }

    private async reglerLivreur(
        livreurId: string,
        type: typeof T.VERSEMENT | typeof T.PAIEMENT_LIVREUR,
        dto: ReglementDto,
        saisiParId: string,
    ) {
        await this.reglerSousVerrou(dto, async (tx) => {
            // Verrou sur le livreur : deux saisies simultanées ne vérifient pas
            // le plafond contre le même solde.
            const verrou = await tx.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM "Livreur" WHERE "id" = ${livreurId} FOR UPDATE`;
            if (verrou.length === 0) throw new NotFoundException('Livreur introuvable');

            const actuel = solde(await sommes(tx, { livreurId }));
            const maximum = type === T.VERSEMENT ? actuel : -actuel;
            exigerAuPlus(dto.montant, maximum, type === T.VERSEMENT ? 'à verser par ce livreur' : 'dû à ce livreur');
            await tx.mouvementEspeces.create({ data: reglement(type, dto, saisiParId, { livreurId }) });
        });
        return this.releveLivreur(livreurId);
    }

    /**
     * Solde et plus ancien encaissement non couvert, par livreur.
     *
     * Premier entré, premier sorti : rémunérations et versements couvrent les
     * encaissements dans l'ordre. `depuis` est la date du premier encaissement
     * dont le cumul dépasse ce qui a été couvert ; c'est de lui que part le
     * délai de 48 h (R5). Un versement partiel recule donc l'échéance d'autant
     * qu'il couvre d'encaissements.
     */
    private soldesLivreurs(livreurId?: string) {
        const filtre = livreurId ? Prisma.sql`AND "livreurId" = ${livreurId}` : Prisma.empty;
        return this.prisma.$queryRaw<{ livreurId: string; solde: number; depuis: Date | null }[]>`
            WITH m AS (
                SELECT "livreurId", "id", "createdAt", "montant",
                       "type" IN ('ENCAISSEMENT', 'PAIEMENT_LIVREUR') AS "debit"
                  FROM "MouvementEspeces"
                 WHERE "livreurId" IS NOT NULL ${filtre}
            ), t AS (
                SELECT "livreurId",
                       COALESCE(SUM("montant") FILTER (WHERE "debit"), 0)     AS "debits",
                       COALESCE(SUM("montant") FILTER (WHERE NOT "debit"), 0) AS "credits"
                  FROM m GROUP BY "livreurId"
            ), d AS (
                SELECT "livreurId", "createdAt",
                       SUM("montant") OVER (PARTITION BY "livreurId" ORDER BY "createdAt", "id") AS "cumul"
                  FROM m WHERE "debit"
            )
            SELECT t."livreurId",
                   (t."debits" - t."credits")::int AS "solde",
                   (SELECT MIN(d."createdAt") FROM d
                     WHERE d."livreurId" = t."livreurId" AND d."cumul" > t."credits") AS "depuis"
              FROM t`;
    }

    // ─── Clients ──────────────────────────────────────────────────────────

    async releveClient(clientId: string) {
        const [du, mouvements] = await Promise.all([
            sommes(this.prisma, { clientId }).then(solde),
            this.prisma.mouvementEspeces.findMany({
                where: { clientId },
                select: CHAMPS_MOUVEMENT,
                orderBy: { createdAt: 'desc' },
                take: LIMITE_RELEVE,
            }),
        ]);
        return { du, mouvements: mouvements.map(vueMouvement) };
    }

    /** Ce que find_delivery doit à chaque client, les plus gros d'abord. Les comptes soldés sont omis. */
    async dusClients() {
        const lignes = await this.prisma.mouvementEspeces.groupBy({
            by: ['clientId', 'type'],
            where: { clientId: { not: null } },
            _sum: { montant: true },
        });
        const dus = new Map<string, number>();
        for (const l of lignes) {
            if (!l.clientId) continue;
            dus.set(l.clientId, (dus.get(l.clientId) ?? 0) + sens(l.type) * (l._sum.montant ?? 0));
        }
        const ouverts = [...dus].filter(([, du]) => du !== 0);
        const clients = await this.prisma.client.findMany({
            where: { id: { in: ouverts.map(([id]) => id) } },
            select: { id: true, type: true, raisonSociale: true, firstname: true, lastname: true, phoneAirtel: true, phoneMoov: true },
        });
        const parId = new Map(clients.map((c) => [c.id, c]));
        return ouverts
            .map(([id, du]) => ({ client: parId.get(id) ?? null, du }))
            .sort((a, b) => b.du - a.du);
    }

    /** find_delivery remet au client la marchandise encaissée pour lui. Au plus ce qui lui est dû. */
    async reverser(clientId: string, dto: ReglementDto, saisiParId: string) {
        await this.reglerSousVerrou(dto, async (tx) => {
            const verrou = await tx.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE`;
            if (verrou.length === 0) throw new NotFoundException('Client introuvable');

            exigerAuPlus(dto.montant, solde(await sommes(tx, { clientId })), 'dû à ce client');
            await tx.mouvementEspeces.create({ data: reglement(T.REVERSEMENT, dto, saisiParId, { clientId }) });
        });
        return this.releveClient(clientId);
    }

    // ─── Ewuang ───────────────────────────────────────────────────────────

    /** Ce qu'Ewuang nous doit (> 0) ou ce que nous lui devons (< 0), et ses derniers mouvements. */
    async releveEwuang() {
        const [du, mouvements] = await Promise.all([
            sommes(this.prisma, 'ewuang').then(solde),
            this.prisma.mouvementEspeces.findMany({
                where: { type: { in: TYPES_EWUANG } },
                select: CHAMPS_MOUVEMENT,
                orderBy: { createdAt: 'desc' },
                take: LIMITE_RELEVE,
            }),
        ]);
        return { du, mouvements: mouvements.map(vueMouvement) };
    }

    /**
     * Étapes de courses Ewuang payées en espèces dont l'encaissement inscrit au
     * registre diffère de ce que le livreur Ewuang devait encaisser.
     *
     * Le cas visé : un `mission.livree` sans bloc `encaissement` (Ewuang encore en
     * v1, ancienne application livreur, champ illisible). Le coût de la course est
     * alors inscrit sans l'encaissement, et le relevé penche à tort vers Ewuang.
     * Rien n'est stocké : l'écart disparaît dès que le registre porte le montant.
     *
     * Les montants attendus sont le miroir SQL de `calculerEncaissements` et
     * `aEncaisserAuRetour` (src/livraisons/encaissement.ts) : à modifier ensemble.
     * Ewuang encaisse `tarif`, notre prix client (`paiement.frais`).
     */
    ecartsEwuang() {
        return this.prisma.$queryRaw<EcartEwuang[]>`
            WITH c AS (
                SELECT "id", "referenceExterne", "statutEwuang", "livreurNom",
                       COALESCE("tarif", 0) AS "tarif", "payeur"::text AS "payeur",
                       "montantMarchandise", "dateRecuperation", "dateLivraison", "dateRetour"
                  FROM "Livraison"
                 WHERE "flotte"::text = 'EWUANG' AND "payeur" IS NOT NULL
                   AND ("dateRecuperation" IS NOT NULL OR "dateLivraison" IS NOT NULL OR "dateRetour" IS NOT NULL)
            ), e AS (
                SELECT c."id", c."referenceExterne", c."statutEwuang", c."livreurNom", v."etape", v."attendu", v."faitAt"
                  FROM c CROSS JOIN LATERAL (VALUES
                    ('enlevement', CASE WHEN c."payeur" = 'EXPEDITEUR' THEN c."tarif" ELSE 0 END, c."dateRecuperation"),
                    ('remise', CASE WHEN c."payeur" = 'EXPEDITEUR' THEN c."montantMarchandise"
                                    ELSE c."tarif" + c."montantMarchandise" END, c."dateLivraison"),
                    ('retour', CASE WHEN c."payeur" = 'DESTINATAIRE' THEN c."tarif" ELSE 0 END, c."dateRetour")
                  ) AS v("etape", "attendu", "faitAt")
                 WHERE v."faitAt" IS NOT NULL
            )
            SELECT e."id" AS "livraisonId", e."referenceExterne", e."statutEwuang", e."livreurNom",
                   e."etape", e."attendu"::int AS "attendu", COALESCE(m."montant", 0)::int AS "inscrit", e."faitAt"
              FROM e
              LEFT JOIN "MouvementEspeces" m ON m."cle" = e."id" || ':ewuang:' || e."etape"
             WHERE COALESCE(m."montant", 0) <> e."attendu"
             ORDER BY e."faitAt" DESC
             LIMIT ${LIMITE_ECARTS}`;
    }

    /** Ewuang nous règle le relevé. Au plus ce qu'il nous doit. */
    recevoirDEwuang(dto: ReglementDto, saisiParId: string) {
        return this.reglerEwuang(T.REGLEMENT_EWUANG_RECU, dto, saisiParId);
    }

    /** Nous réglons Ewuang quand le relevé est en sa faveur. Au plus ce que nous lui devons. */
    verserAEwuang(dto: ReglementDto, saisiParId: string) {
        return this.reglerEwuang(T.REGLEMENT_EWUANG_VERSE, dto, saisiParId);
    }

    private async reglerEwuang(
        type: typeof T.REGLEMENT_EWUANG_RECU | typeof T.REGLEMENT_EWUANG_VERSE,
        dto: ReglementDto,
        saisiParId: string,
    ) {
        await this.reglerSousVerrou(dto, async (tx) => {
            // Pas de ligne à verrouiller pour ce compte : un verrou consultatif
            // de transaction sérialise les règlements simultanés.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('especes:ewuang'))`;
            const actuel = solde(await sommes(tx, 'ewuang'));
            exigerAuPlus(
                dto.montant,
                type === T.REGLEMENT_EWUANG_RECU ? actuel : -actuel,
                type === T.REGLEMENT_EWUANG_RECU ? 'dû par Ewuang' : 'dû à Ewuang',
            );
            await tx.mouvementEspeces.create({ data: reglement(type, dto, saisiParId, {}) });
        });
        return this.releveEwuang();
    }

    // ─── Journal ──────────────────────────────────────────────────────────

    async mouvements(filtre: MouvementsQueryDto) {
        const lignes = await this.prisma.mouvementEspeces.findMany({
            where: {
                ...(filtre.livreurId ? { livreurId: filtre.livreurId } : {}),
                ...(filtre.clientId ? { clientId: filtre.clientId } : {}),
            },
            select: { ...CHAMPS_MOUVEMENT, livreurId: true, clientId: true, saisiParId: true },
            orderBy: { createdAt: 'desc' },
            take: filtre.limite,
        });
        return lignes.map((l) => ({
            ...vueMouvement(l),
            livreurId: l.livreurId,
            clientId: l.clientId,
            saisiParId: l.saisiParId,
        }));
    }

    // ─── Outils ───────────────────────────────────────────────────────────

    /** Transaction d'un règlement ; un reçu déjà enregistré répond 409. */
    private async reglerSousVerrou(
        dto: ReglementDto,
        corps: (tx: Prisma.TransactionClient) => Promise<void>,
    ): Promise<void> {
        try {
            await this.prisma.$transaction(corps);
        } catch (erreur) {
            if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
                throw new ConflictException(`Le reçu ${dto.reference} est déjà enregistré`);
            }
            throw erreur;
        }
    }
}

async function sommes(
    db: Prisma.TransactionClient,
    compte: { livreurId: string } | { clientId: string } | 'ewuang',
): Promise<{ type: TypeMouvementEspeces; montant: number }[]> {
    const where: Prisma.MouvementEspecesWhereInput =
        compte === 'ewuang'
            ? { type: { in: TYPES_EWUANG } }
            : { ...compte, type: { in: 'livreurId' in compte ? TYPES_LIVREUR : TYPES_CLIENT } };
    const lignes = await db.mouvementEspeces.groupBy({
        by: ['type'],
        where,
        _sum: { montant: true },
    });
    return lignes.map((l) => ({ type: l.type, montant: l._sum.montant ?? 0 }));
}

function exigerAuPlus(montant: number, maximum: number, quoi: string): void {
    if (maximum <= 0) throw new BadRequestException(`Rien n'est ${quoi}`);
    if (montant > maximum) {
        throw new BadRequestException(`Au plus ${maximum.toLocaleString('fr-FR')} FCFA ${quoi}`);
    }
}

function reglement(
    type: TypeMouvementEspeces,
    dto: ReglementDto,
    saisiParId: string,
    /** Vide pour le compte Ewuang, qui n'a ni livreur ni client. */
    compte: { livreurId: string } | { clientId: string } | Record<string, never>,
): Prisma.MouvementEspecesUncheckedCreateInput {
    return { type, montant: dto.montant, cle: `recu:${dto.reference}`, note: dto.note ?? null, saisiParId, ...compte };
}

function vueMouvement(m: Mouvement) {
    return {
        id: m.id,
        type: m.type,
        montant: m.montant,
        /** +1 : augmente le solde du compte ; −1 : le diminue. */
        sens: sens(m.type),
        livraisonId: m.livraisonId,
        referenceCourse: m.livraison?.referenceExterne ?? null,
        recu: m.cle.startsWith('recu:') ? m.cle.slice('recu:'.length) : null,
        note: m.note,
        createdAt: m.createdAt,
    };
}
