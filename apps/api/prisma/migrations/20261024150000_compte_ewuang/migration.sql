-- Compte « Ewuang » au registre des espèces (phase 4 du plan de lancement).
--
-- Les livreurs Ewuang encaissent désormais sur nos courses (contrat v2). Ewuang
-- en répond devant nous (R7) : ces sommes, moins ce que nos courses lui
-- coûtent, sont à régler entre nous. Le compte n'a ni livreur ni client.
--
-- Additif pour les données : quatre valeurs d'enum. Les deux CHECK qui
-- disaient à quel compte appartient chaque type sont REMPLACÉS (DROP puis ADD,
-- même nom) pour y faire entrer le compte Ewuang ; la table est vide au
-- 2026-10-24, rien n'est revalidé contre des lignes existantes.
--
-- Les CHECK comparent `type::text` : une valeur ajoutée par ADD VALUE ne peut
-- pas être écrite comme littéral d'enum dans la transaction qui l'ajoute.
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).

ALTER TYPE "TypeMouvementEspeces" ADD VALUE IF NOT EXISTS 'ENCAISSEMENT_EWUANG';
ALTER TYPE "TypeMouvementEspeces" ADD VALUE IF NOT EXISTS 'TARIF_EWUANG';
ALTER TYPE "TypeMouvementEspeces" ADD VALUE IF NOT EXISTS 'REGLEMENT_EWUANG_RECU';
ALTER TYPE "TypeMouvementEspeces" ADD VALUE IF NOT EXISTS 'REGLEMENT_EWUANG_VERSE';

ALTER TABLE "MouvementEspeces"
    DROP CONSTRAINT "MouvementEspeces_compte_du_type",
    DROP CONSTRAINT "MouvementEspeces_origine";

ALTER TABLE "MouvementEspeces"
    -- Une écriture appartient à un seul compte, celui de son type.
    ADD CONSTRAINT "MouvementEspeces_compte_du_type" CHECK (
        ("type"::text IN ('ENCAISSEMENT', 'REMUNERATION', 'VERSEMENT', 'PAIEMENT_LIVREUR')
            AND "livreurId" IS NOT NULL AND "clientId" IS NULL)
        OR ("type"::text IN ('MARCHANDISE', 'REVERSEMENT')
            AND "clientId" IS NOT NULL AND "livreurId" IS NULL)
        OR ("type"::text IN ('ENCAISSEMENT_EWUANG', 'TARIF_EWUANG', 'REGLEMENT_EWUANG_RECU', 'REGLEMENT_EWUANG_VERSE')
            AND "livreurId" IS NULL AND "clientId" IS NULL)
    ),
    -- Écriture de course : rattachée à la course, sans auteur. Règlement : saisi
    -- par un ADMIN, sans course.
    ADD CONSTRAINT "MouvementEspeces_origine" CHECK (
        ("type"::text IN ('ENCAISSEMENT', 'REMUNERATION', 'MARCHANDISE', 'ENCAISSEMENT_EWUANG', 'TARIF_EWUANG')
            AND "livraisonId" IS NOT NULL AND "saisiParId" IS NULL)
        OR ("type"::text IN ('VERSEMENT', 'PAIEMENT_LIVREUR', 'REVERSEMENT', 'REGLEMENT_EWUANG_RECU', 'REGLEMENT_EWUANG_VERSE')
            AND "livraisonId" IS NULL AND "saisiParId" IS NOT NULL)
    );
