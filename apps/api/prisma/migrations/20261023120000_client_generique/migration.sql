-- La boutique devient un client parmi d'autres, et la course dit qui la paie.
--
-- Décisions du 2026-10-23 (PLAN_LANCEMENT.md, D1 à D4) : un particulier ou
-- une entreprise commande comme une boutique, et le lancement se fait en
-- espèces, encaissées par le livreur.
--
-- Uniquement des RENOMMAGES et des ajouts : aucune ligne n'est supprimée, aucune
-- table recréée. Prisma, laissé à lui-même, aurait traduit le renommage de
-- `Boutique` en DROP + CREATE et perdu les profils existants.
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).

-- 1. Rôle -------------------------------------------------------------------
-- RENAME VALUE garde l'OID de la valeur : les lignes `user` existantes et le
-- DEFAULT de la colonne suivent sans reprise.
ALTER TYPE "UserRole" RENAME VALUE 'BOUTIQUE' TO 'CLIENT';

-- 2. Nouveaux types ---------------------------------------------------------
CREATE TYPE "TypeClient" AS ENUM ('PARTICULIER', 'ENTREPRISE', 'BOUTIQUE');
CREATE TYPE "Payeur" AS ENUM ('EXPEDITEUR', 'DESTINATAIRE');

-- 3. Boutique -> Client -----------------------------------------------------
ALTER TABLE "Boutique" RENAME TO "Client";
ALTER TABLE "Client" RENAME COLUMN "userBoutiqueId" TO "userClientId";
ALTER TABLE "Client" RENAME CONSTRAINT "Boutique_pkey" TO "Client_pkey";
ALTER TABLE "Client" RENAME CONSTRAINT "Boutique_userBoutiqueId_fkey" TO "Client_userClientId_fkey";
ALTER INDEX "Boutique_userBoutiqueId_key" RENAME TO "Client_userClientId_key";

-- Postgres 18 nomme aussi les contraintes NOT NULL (`Boutique_firstname_not_null`…),
-- et ne les renomme pas avec la table. Prisma les ignore : c'est seulement pour
-- ne pas laisser de nom trompeur en base.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = '"Client"'::regclass AND conname LIKE 'Boutique\_%'
    LOOP
        EXECUTE format(
            'ALTER TABLE "Client" RENAME CONSTRAINT %I TO %I',
            c.conname,
            replace(replace(c.conname, 'Boutique_', 'Client_'), 'userBoutiqueId', 'userClientId')
        );
    END LOOP;
END $$;

-- Les profils existants sont tous des boutiques : c'était le seul type possible.
-- Le DEFAULT ne sert qu'à les remplir, il est retiré aussitôt : un nouveau
-- client doit déclarer son type.
ALTER TABLE "Client"
    ADD COLUMN "type" "TypeClient" NOT NULL DEFAULT 'BOUTIQUE',
    ADD COLUMN "raisonSociale" TEXT;
ALTER TABLE "Client" ALTER COLUMN "type" DROP DEFAULT;

-- 4. Livraison ------------------------------------------------------------
ALTER TABLE "Livraison" RENAME COLUMN "boutiqueId" TO "clientId";
ALTER TABLE "Livraison" RENAME COLUMN "noteBoutique" TO "noteClient";
ALTER TABLE "Livraison" RENAME CONSTRAINT "Livraison_boutiqueId_fkey" TO "Livraison_clientId_fkey";
ALTER INDEX "Livraison_boutiqueId_idx" RENAME TO "Livraison_clientId_idx";

-- `payeur` nullable : NULL = course réglée hors course, ce que sont les courses
-- créées avant ce jour. On n'invente pas de payeur pour elles. L'API l'exige
-- pour toute nouvelle course.
ALTER TABLE "Livraison"
    ADD COLUMN "payeur" "Payeur",
    ADD COLUMN "montantMarchandise" INTEGER NOT NULL DEFAULT 0;

-- Le plafond (50 000 FCFA au lancement, règle R6) vit dans le code, pas ici :
-- il doit pouvoir changer sans migration.
ALTER TABLE "Livraison"
    ADD CONSTRAINT "Livraison_montantMarchandise_positif"
        CHECK ("montantMarchandise" >= 0),
    -- Une marchandise à encaisser suppose une course payée en espèces.
    ADD CONSTRAINT "Livraison_marchandise_exige_payeur"
        CHECK ("montantMarchandise" = 0 OR "payeur" IS NOT NULL);

-- 5. Tables liées (vides au 2026-10-23) -------------------------------------
ALTER TABLE "Document" RENAME COLUMN "boutiqueId" TO "clientId";
ALTER TABLE "Document" RENAME CONSTRAINT "Document_boutiqueId_fkey" TO "Document_clientId_fkey";
ALTER INDEX "Document_boutiqueId_idx" RENAME TO "Document_clientId_idx";

ALTER TABLE "Evaluation" RENAME COLUMN "noteVersBoutique" TO "noteVersClient";
ALTER TABLE "Evaluation" RENAME COLUMN "commentaireVersBoutique" TO "commentaireVersClient";
ALTER TABLE "Evaluation" RENAME COLUMN "boutiqueEvaluateurId" TO "clientEvaluateurId";
ALTER TABLE "Evaluation" RENAME COLUMN "boutiqueEvalueId" TO "clientEvalueId";
ALTER TABLE "Evaluation" RENAME CONSTRAINT "Evaluation_boutiqueEvaluateurId_fkey" TO "Evaluation_clientEvaluateurId_fkey";
ALTER TABLE "Evaluation" RENAME CONSTRAINT "Evaluation_boutiqueEvalueId_fkey" TO "Evaluation_clientEvalueId_fkey";
ALTER INDEX "Evaluation_boutiqueEvalueId_idx" RENAME TO "Evaluation_clientEvalueId_idx";

ALTER TABLE "Transaction" RENAME COLUMN "boutiqueId" TO "clientId";
ALTER TABLE "Transaction" RENAME CONSTRAINT "Transaction_boutiqueId_fkey" TO "Transaction_clientId_fkey";
ALTER INDEX "Transaction_boutiqueId_idx" RENAME TO "Transaction_clientId_idx";
