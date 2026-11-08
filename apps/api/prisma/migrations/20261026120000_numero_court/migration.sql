-- Numéro de course court (« AV-10427 »), pour les humains.
--
-- La seule référence affichée jusqu'ici était `referenceExterne` (FD-<uuid>,
-- 39 signes) : impossible à dicter au téléphone lors d'une réclamation.
--
-- `referenceExterne` n'est PAS remplacée : c'est la clé d'idempotence d'Ewuang
-- (POST /partenaires/missions). Un compteur à sa place réémettrait une clé déjà
-- connue d'Ewuang si la séquence repartait de zéro (base recréée), et Ewuang
-- rendrait alors l'ANCIENNE mission. Le UUID reste la couture technique, le
-- numéro sert à l'écran, au téléphone et au relevé des espèces.
--
-- Posé par la base (DEFAULT nextval) : aucune création de course n'a à s'en
-- occuper. Les courses existantes sont numérotées par ordre de création, puis
-- la séquence reprend après elles.
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).

CREATE SEQUENCE "Livraison_numero_seq" START WITH 10000;

ALTER TABLE "Livraison" ADD COLUMN "numero" TEXT;

UPDATE "Livraison" l
   SET "numero" = 'AV-' || (9999 + o."rang")
  FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS "rang" FROM "Livraison") o
 WHERE l."id" = o."id";

SELECT setval('"Livraison_numero_seq"',
              9999 + GREATEST((SELECT count(*) FROM "Livraison"), 1),
              (SELECT count(*) > 0 FROM "Livraison"));

ALTER TABLE "Livraison"
    ALTER COLUMN "numero" SET DEFAULT ('AV-'::text || nextval('"Livraison_numero_seq"'::regclass)),
    ALTER COLUMN "numero" SET NOT NULL;

ALTER SEQUENCE "Livraison_numero_seq" OWNED BY "Livraison"."numero";

CREATE UNIQUE INDEX "Livraison_numero_key" ON "Livraison"("numero");
