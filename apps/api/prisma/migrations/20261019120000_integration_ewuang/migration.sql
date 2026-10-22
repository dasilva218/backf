-- Intégration Ewuang : rattachement des courses aux missions, instantané du
-- livreur, et journal des webhooks reçus.
--
-- Tout est additif : aucune colonne retirée, aucune table supprimée, aucune
-- valeur d'énumération touchée. Les colonnes sont nullables, donc les lignes
-- existantes restent valides sans reprise de données.
--
-- Ce qui N'EST PAS fait ici, et qui reste à décider : le retrait des doublons
-- du référentiel livreur (table `Livreur`, `SuiviPosition`, les colonnes de
-- latitude/longitude, la valeur `LIVREUR` du rôle). Ce sont des suppressions,
-- elles attendent un accord explicite.

-- AlterTable
ALTER TABLE "Livraison"
    ADD COLUMN "referenceExterne"     TEXT,
    ADD COLUMN "missionEwuangId"      TEXT,
    ADD COLUMN "statutEwuang"         TEXT,
    ADD COLUMN "codeRemise"           TEXT,
    ADD COLUMN "livreurEwuangId"      TEXT,
    ADD COLUMN "livreurNom"           TEXT,
    ADD COLUMN "livreurContact"       TEXT,
    ADD COLUMN "livreurTypeVehicule"  TEXT,
    ADD COLUMN "destinataireNom"      TEXT,
    ADD COLUMN "destinataireContact"  TEXT,
    ADD COLUMN "tarifEwuang"          INTEGER,
    ADD COLUMN "remunerationLivreur"  INTEGER,
    -- TIMESTAMPTZ et non le TIMESTAMP(3) que Prisma pose par défaut : celui-ci
    -- est SANS fuseau, et le Gabon est à UTC+1. Une date naïve stockée en UTC
    -- puis relue comme locale décale tout filtre par jour d'une heure. Ici elle
    -- casserait en plus la règle d'ordre des événements, qui compare cet
    -- instant à un `emis_at` venu d'Ewuang en UTC explicite.
    ADD COLUMN "dernierEvenementAt"   TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "EvenementEwuangRecu" (
    "id"              TEXT NOT NULL,
    "evenementId"     TEXT NOT NULL,
    "type"            TEXT NOT NULL,
    "missionEwuangId" TEXT,
    -- Les trois dates en TIMESTAMPTZ, même raison que ci-dessus.
    "emisAt"          TIMESTAMPTZ NOT NULL,
    "charge"          JSONB NOT NULL,
    "recuAt"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteAt"        TIMESTAMPTZ,
    "ignoreMotif"     TEXT,

    CONSTRAINT "EvenementEwuangRecu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
--
-- `referenceExterne` unique : c'est l'identifiant que NOUS émettons vers Ewuang,
-- et il est sa clé d'idempotence. Deux courses locales qui le partageraient
-- feraient de deux livraisons une seule chez lui.
CREATE UNIQUE INDEX "Livraison_referenceExterne_key" ON "Livraison"("referenceExterne");

-- `missionEwuangId` unique : une mission Ewuang n'appartient qu'à une course.
CREATE UNIQUE INDEX "Livraison_missionEwuangId_key" ON "Livraison"("missionEwuangId");

CREATE INDEX "Livraison_statutEwuang_idx"    ON "Livraison"("statutEwuang");
CREATE INDEX "Livraison_livreurEwuangId_idx" ON "Livraison"("livreurEwuangId");

-- L'index qui absorbe les relances d'Ewuang. Ses webhooks sont livrés AU MOINS
-- UNE FOIS : les doublons sont certains, pas hypothétiques. Sans cette
-- contrainte, un changement de statut s'applique deux fois.
CREATE UNIQUE INDEX "EvenementEwuangRecu_evenementId_key" ON "EvenementEwuangRecu"("evenementId");

CREATE INDEX "EvenementEwuangRecu_missionEwuangId_idx" ON "EvenementEwuangRecu"("missionEwuangId");
CREATE INDEX "EvenementEwuangRecu_type_idx"            ON "EvenementEwuangRecu"("type");
CREATE INDEX "EvenementEwuangRecu_recuAt_idx"          ON "EvenementEwuangRecu"("recuAt");
CREATE INDEX "EvenementEwuangRecu_traiteAt_idx"        ON "EvenementEwuangRecu"("traiteAt");
