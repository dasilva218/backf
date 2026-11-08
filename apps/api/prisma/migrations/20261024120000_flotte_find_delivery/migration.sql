-- La flotte propre de find_delivery (phase 2 du plan de lancement).
--
-- Additif uniquement : nouveaux types, nouvelles valeurs d'enum, colonnes
-- nullables ou à défaut. Aucune ligne existante n'est réécrite, sauf le
-- rattachement à la flotte Ewuang des courses qu'un livreur Ewuang a déjà
-- prises (§3).
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).
-- Les deux `ADD VALUE` passent dans une transaction parce qu'aucune requête de
-- ce fichier n'utilise les nouvelles valeurs.

-- 1. Types ------------------------------------------------------------------
ALTER TYPE "StatutLivraison" ADD VALUE IF NOT EXISTS 'RETOUR_EXPEDITEUR';
ALTER TYPE "StatutLivraison" ADD VALUE IF NOT EXISTS 'RETOURNEE';

CREATE TYPE "Flotte" AS ENUM ('FIND_DELIVERY', 'EWUANG');
CREATE TYPE "StatutDossier" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REFUSE');

-- 2. Livreur : le dossier ---------------------------------------------------
ALTER TABLE "Livreur"
    ADD COLUMN "statutDossier"   "StatutDossier" NOT NULL DEFAULT 'EN_ATTENTE',
    ADD COLUMN "motifRefus"      TEXT,
    ADD COLUMN "dossierTraiteAt" TIMESTAMPTZ;

-- 3. Livraison : la flotte et l'exécution -----------------------------------
ALTER TABLE "Livraison"
    ADD COLUMN "flotte"                    "Flotte",
    ADD COLUMN "tentativesCode"            INTEGER NOT NULL DEFAULT 0,
    -- TIMESTAMPTZ et non TIMESTAMP(3) : voir dernierEvenementAt.
    ADD COLUMN "arriveeDestinationAt"      TIMESTAMPTZ,
    ADD COLUMN "montantEncaisseEnlevement" INTEGER,
    ADD COLUMN "encaisseEnlevementAt"      TIMESTAMPTZ,
    ADD COLUMN "montantEncaisseRemise"     INTEGER,
    ADD COLUMN "encaisseRemiseAt"          TIMESTAMPTZ,
    ADD COLUMN "dateRetour"                TIMESTAMPTZ,
    -- Frais de l'aller payés par l'expéditeur au retour du colis (règle R3).
    ADD COLUMN "montantEncaisseRetour"     INTEGER,
    ADD COLUMN "encaisseRetourAt"          TIMESTAMPTZ;

-- Une course déjà attribuée par Ewuang lui appartient. Au 2026-10-24, aucune :
-- le webhook n'étant pas encore branché, aucun `livreurEwuangId` n'est arrivé.
UPDATE "Livraison" SET "flotte" = 'EWUANG' WHERE "livreurEwuangId" IS NOT NULL;

ALTER TABLE "Livraison"
    -- La flotte find_delivery a toujours un livreur à elle.
    ADD CONSTRAINT "Livraison_flotte_find_delivery_a_un_livreur"
        CHECK ("flotte" IS DISTINCT FROM 'FIND_DELIVERY' OR "livreurId" IS NOT NULL),
    ADD CONSTRAINT "Livraison_tentativesCode_positif"
        CHECK ("tentativesCode" >= 0),
    ADD CONSTRAINT "Livraison_montants_encaisses_positifs"
        CHECK (
            COALESCE("montantEncaisseEnlevement", 0) >= 0
            AND COALESCE("montantEncaisseRemise", 0) >= 0
            AND COALESCE("montantEncaisseRetour", 0) >= 0
        );

CREATE INDEX "Livraison_flotte_idx" ON "Livraison"("flotte");
