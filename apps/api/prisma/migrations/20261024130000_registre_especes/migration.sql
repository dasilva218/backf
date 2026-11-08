-- Registre des espèces (phase 3 du plan de lancement).
--
-- Additif uniquement : un type, une table, une fonction de trigger. Aucune
-- ligne existante n'est touchée. Les courses déjà terminées (aucune de la
-- flotte find_delivery au 2026-10-24) n'ont pas d'écritures rétroactives.
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).

-- 1. Type -------------------------------------------------------------------
CREATE TYPE "TypeMouvementEspeces" AS ENUM (
    'ENCAISSEMENT', 'REMUNERATION', 'VERSEMENT', 'PAIEMENT_LIVREUR', 'MARCHANDISE', 'REVERSEMENT'
);

-- 2. Table ------------------------------------------------------------------
CREATE TABLE "MouvementEspeces" (
    "id"          TEXT NOT NULL,
    "type"        "TypeMouvementEspeces" NOT NULL,
    "montant"     INTEGER NOT NULL,
    "livreurId"   TEXT,
    "clientId"    TEXT,
    "livraisonId" TEXT,
    "cle"         TEXT NOT NULL,
    "saisiParId"  TEXT,
    "note"        TEXT,
    -- TIMESTAMPTZ et non TIMESTAMP(3) : voir Livraison.dernierEvenementAt.
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MouvementEspeces_pkey" PRIMARY KEY ("id"),

    -- Le sens est porté par le type : un montant nul ou négatif n'a pas de sens.
    CONSTRAINT "MouvementEspeces_montant_positif" CHECK ("montant" > 0),

    -- Une écriture appartient à un seul compte, celui de son type.
    CONSTRAINT "MouvementEspeces_compte_du_type" CHECK (
        ("type" IN ('ENCAISSEMENT', 'REMUNERATION', 'VERSEMENT', 'PAIEMENT_LIVREUR')
            AND "livreurId" IS NOT NULL AND "clientId" IS NULL)
        OR ("type" IN ('MARCHANDISE', 'REVERSEMENT')
            AND "clientId" IS NOT NULL AND "livreurId" IS NULL)
    ),

    -- Écriture de course : rattachée à la course, sans auteur. Règlement : saisi
    -- par un ADMIN, sans course.
    CONSTRAINT "MouvementEspeces_origine" CHECK (
        ("type" IN ('ENCAISSEMENT', 'REMUNERATION', 'MARCHANDISE')
            AND "livraisonId" IS NOT NULL AND "saisiParId" IS NULL)
        OR ("type" IN ('VERSEMENT', 'PAIEMENT_LIVREUR', 'REVERSEMENT')
            AND "livraisonId" IS NULL AND "saisiParId" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "MouvementEspeces_cle_key" ON "MouvementEspeces"("cle");
CREATE INDEX "MouvementEspeces_livreurId_createdAt_idx" ON "MouvementEspeces"("livreurId", "createdAt");
CREATE INDEX "MouvementEspeces_clientId_createdAt_idx" ON "MouvementEspeces"("clientId", "createdAt");
CREATE INDEX "MouvementEspeces_livraisonId_idx" ON "MouvementEspeces"("livraisonId");

-- RESTRICT : ce qui a mouvementé de l'argent ne se supprime pas.
ALTER TABLE "MouvementEspeces"
    ADD CONSTRAINT "MouvementEspeces_livreurId_fkey"
        FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "MouvementEspeces_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "MouvementEspeces_livraisonId_fkey"
        FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "MouvementEspeces_saisiParId_fkey"
        FOREIGN KEY ("saisiParId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Immuabilité ------------------------------------------------------------
-- Un registre de caisse ne se réécrit pas : une erreur se corrige par
-- l'écriture inverse. Le trigger tient même contre un UPDATE lancé à la main.
CREATE FUNCTION "mouvement_especes_immuable"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Le registre des espèces est immuable : passez une écriture inverse';
END;
$$;

CREATE TRIGGER "MouvementEspeces_immuable"
    BEFORE UPDATE OR DELETE ON "MouvementEspeces"
    FOR EACH ROW EXECUTE FUNCTION "mouvement_especes_immuable"();
