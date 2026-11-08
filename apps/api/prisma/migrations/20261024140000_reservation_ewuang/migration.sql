-- Réservation des courses par Ewuang (v2 du contrat partenaires, §1 ; phase 4).
--
-- Additif : une colonne nullable. Aucune ligne existante n'est touchée.
--
-- Appliquée via `pg`, en une transaction, puis inscrite à la main dans
-- `_prisma_migrations` : la CLI Prisma répond P1001 sur Neon (voir CLAUDE.md).

-- TIMESTAMPTZ et non TIMESTAMP(3) : voir Livraison.dernierEvenementAt.
ALTER TABLE "Livraison" ADD COLUMN "reserveeEwuangAt" TIMESTAMPTZ;
