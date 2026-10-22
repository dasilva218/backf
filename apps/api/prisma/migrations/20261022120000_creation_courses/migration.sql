-- Création des courses par les boutiques : ce que la demande porte et que
-- `Livraison` ne savait pas encore garder.
--
-- Additif uniquement, colonnes nullables : les lignes existantes restent
-- valides sans reprise de données.

-- AlterTable
ALTER TABLE "Livraison"
    ADD COLUMN "typeCourse"   TEXT,
    ADD COLUMN "zoneDepart"   TEXT,
    ADD COLUMN "zoneArrivee"  TEXT,
    -- Le corps exact envoyé à Ewuang. Ewuang n'est idempotent qu'à corps
    -- identique (sinon 409) : c'est ce corps-ci qu'on rejoue après un échec.
    ADD COLUMN "chargeEwuang" JSONB,
    ADD COLUMN "erreurEwuang" TEXT;
