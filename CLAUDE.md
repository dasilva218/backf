# CLAUDE.md

Ce fichier guide Claude Code (claude.ai/code) dans ce dépôt.

## Le projet

**find_delivery** (« trouver un livreur ») : plateforme où une boutique soumet une course de livraison. Elle **n'a pas de flotte propre** : chaque course est dispatchée à **Ewuang** via son API partenaires, et le suivi revient par webhook. Ewuang exécute, find_delivery facture la boutique (`Livraison.tarif`) et paie Ewuang (`Livraison.tarifEwuang`).

État actuel : début de projet. Il y a l'authentification, les utilisateurs, le profil boutique, l'intégration Ewuang (client + webhook), la grille de tarifs (devis) et la création / lecture / annulation des courses. Ni paiement de la boutique, ni envoi du code de remise par SMS pour l'instant. `apps/web` est encore le starter create-turbo.

Code, commentaires, messages d'erreur et Swagger sont **en français**. Conserve-le.

## Organisation du monorepo

Turborepo + **pnpm** (`pnpm@11`, Node ≥ 24), workspaces `apps/*` et `packages/*`.

- [apps/api/](apps/api/) : API **NestJS 12**, ESM (`"type": "module"`), Prisma 7 + PostgreSQL. C'est là que se trouve tout le code métier.
- [apps/web/](apps/web/) : Next.js 16 / React 19, starter non modifié (port 3000).
- [packages/ui/](packages/ui/) (`@repo/ui`), [packages/eslint-config/](packages/eslint-config/), [packages/typescript-config/](packages/typescript-config/) : partagés par `web`. `api` ne les utilise pas : il a son propre oxlint et son propre tsconfig.

[AGENTS.md](AGENTS.md) est un bloc géré par `turbo` : avant de toucher à `turbo.json` ou aux commandes turbo, lis la doc embarquée dans le package `turbo` installé, pas ta mémoire.

## Commandes

```bash
# racine
pnpm install
pnpm dev            # turbo run dev (api en watch + web)
pnpm build | pnpm lint | pnpm check-types
pnpm dev --filter=api

# apps/api
pnpm dev            # nest start --watch (port PORT, défaut 3001)
pnpm build          # nest build → dist/
pnpm lint           # oxlint --type-aware src/ test/
pnpm test           # vitest run (unitaires : **/*.spec.ts)
pnpm test -- src/ewuang/ewuang-signature.spec.ts   # un seul fichier
pnpm test:e2e       # vitest, **/*.e2e-spec.ts

# Prisma (apps/api) : config dans prisma7.config.ts, détectée automatiquement par la CLI
pnpm exec prisma generate
pnpm exec prisma migrate dev     # exige DATABASE_URL (apps/api/.env), sinon « datasource.url is required »
```

`pnpm-workspace.yaml` bloque les scripts d'installation (`allowBuilds: false`) de `prisma`, `@prisma/engines` et `bcrypt`. Si `bcrypt` ou le client Prisma manquent à l'exécution, la cause est là.

## apps/api — Architecture

### Démarrage ([src/main.ts](apps/api/src/main.ts))

- Préfixe global `api/v1`. Swagger servi sur `/api`, sans le préfixe.
- `ValidationPipe` global avec `whitelist` + **`forbidNonWhitelisted`** : un champ absent du DTO fait rejeter la requête.
- **`rawBody: true`** : indispensable à la signature des webhooks Ewuang (voir plus bas). Ne pas le retirer.
- CORS `origin: '*'`, en-têtes `Content-Type` et `Authorization`.

### Modules ESM

Les imports relatifs portent le suffixe **`.js`** (`'./auth.service.js'`), imposé par `module: nodenext`. Un import sans suffixe compile mais casse au runtime.

### Auth : trois guards globaux ([src/app.module.ts](apps/api/src/app.module.ts))

Ils s'appliquent dans cet ordre à **toutes** les routes :
1. `ThrottlerGuard` : 100 requêtes/min. `@SkipThrottle()` pour y échapper.
2. `JwtAuthGuard` : Bearer JWT (`JWT_SECRET`, expiration `JWT_EXPIRES_IN`, 30 min par défaut). **Une route est protégée par défaut** ; `@Public()` la rend publique.
3. `RolesGuard` : `@Roles(UserRole.ADMIN, …)` ; sans décorateur, pas de contrainte de rôle.

`JwtStrategy.validate` relit l'utilisateur en base (sans `password`) et le place dans `req.user`, lu par `@CurrentUser()`. Mots de passe hachés en bcrypt. Le login refuse un compte dont `status !== 'ACTIVE'`.

Rôles : `BOUTIQUE | LIVREUR | ADMIN`. Profil métier 1-1 par rôle : `Admin`, `Boutique`, `Livreur`.

### Base de données

Postgres **propre à ce projet** (`DATABASE_URL`). Ce n'est **pas** la base Supabase d'Ewuang : les deux systèmes ne communiquent que par HTTP. Accès via `PrismaService` (global), qui étend `PrismaClient` avec l'adaptateur `@prisma/adapter-pg` sur un `Pool` `pg`. Le `datasource` du schéma n'a pas d'`url` : elle vient de `prisma7.config.ts`.

Règles du schéma ([prisma/schema.prisma](apps/api/prisma/schema.prisma)) :
- **Toute nouvelle colonne de date porte `@db.Timestamptz`.** Le défaut Prisma (`TIMESTAMP(3)`, sans fuseau) décale d'une heure les filtres par jour au Gabon (UTC+1) et casse la comparaison avec les `emis_at` d'Ewuang. Les anciennes colonnes sont encore en `TIMESTAMP(3)`.
- Le modèle `Livreur`, `SuiviPosition` et les lat/lng de `Livraison` datent d'avant le choix « flotte Ewuang ». Leur suppression est **en attente d'un accord explicite** (voir l'en-tête de la migration `20261019120000_integration_ewuang`). Ne pas les supprimer d'office, et ne pas bâtir dessus.
- ⚠️ **Le schéma et les migrations divergent** sur `user` : la migration initiale crée `name NOT NULL`, `isActive` et `status DEFAULT 'PENDING'`, alors que le schéma porte `name String?`, pas d'`isActive` et `@default(ACTIVE)`, sans migration correspondante. La base Neon, elle, **suit le schéma** (vérifié le 2026-10-22) : c'est la chaîne de migrations qui ne la recréerait pas à l'identique. Vérifie l'état réel de la base avant toute nouvelle migration.
- **La base est sur Neon** (`DATABASE_URL` dans `apps/api/.env`).
- ⚠️ **Le moteur de migration Prisma répond `P1001` sur Neon depuis le poste de Franck**, pooler comme hôte direct, alors que `pg` (Node) s'y connecte. Le 2026-10-22, `integration_ewuang` et `creation_courses` ont donc été appliquées via `pg`, en une transaction, et inscrites à la main dans `_prisma_migrations`. La somme de contrôle Prisma est le SHA-256 du `migration.sql` **en fins de ligne LF** (les deux premières migrations sont en CRLF dans le dépôt).

## Tarifs ([src/tarifs/](apps/api/src/tarifs/))

Le client paie le prix de la grille, **sans majoration**. find_delivery ne prend rien sur le client : c'est **Ewuang qui lui reverse 5 %** du prix (`COMMISSION_POURCENT`). Exemple : course à 2 000 → find_delivery touche 100, Ewuang garde 1 900.

Ces tarifs sont propres à find_delivery. Ils ne sont **pas** les frais de livraison de la marketplace Ewuang, qui vivent dans la base d'Ewuang et ne nous concernent pas.

Le calcul vit en fonctions pures dans [grille-tarifs.ts](apps/api/src/tarifs/grille-tarifs.ts) et alimente les trois colonnes de `Livraison` : `tarif` (prix client), `commission` (5 % du prix, arrondi à l'entier) et `tarifEwuang` (= `tarif − commission`, la part d'Ewuang).

Prix **par trajet**, zone de départ → zone d'arrivée (`PRIX_STANDARD[départ][arrivée]`, lignes de l'affiche = départ), plus un supplément selon le type : express +1 000, volumineux +2 000. Prix standard :

| Départ ↓ / Arrivée → | Akanda | Libreville | Owendo |
|---|---|---|---|
| **Akanda** | 1 500 | 2 000 | 3 500 |
| **Libreville** | 2 500 | 2 000 | 3 000 |
| **Owendo** | 3 500 | 2 500 | 2 000 |

- **La grille n'est pas symétrique** (Akanda → Libreville 2 000, Libreville → Akanda 2 500) : c'est voulu, ne pas « corriger » un sens sur l'autre.
- `GET /api/v1/tarifs` : grille complète (27 trajets × types). `GET /api/v1/tarifs/devis?zone_depart=…&zone_arrivee=…&type_course=…` : un devis. Les deux exigent un JWT (pas de `@Public()`).
- Zones acceptées : `Akanda | Libreville | Owendo`. **PK** figure sur l'affiche mais est exclue tant qu'Ewuang ne la sert pas (absente de `zones_livraison`) : elle répond 400.
- **La grille sert à deviser, elle ne fait pas foi.** À la création de la course, stocker comme `tarifEwuang` la `remuneration_livreur` **renvoyée par Ewuang** (pas son `tarif`, qui est le prix de la zone) ; la commission réelle est alors `tarif client − tarifEwuang`.
- ⚠️ **Ewuang ne facture pas encore par trajet** : son contrat ne connaît qu'une `zone` par mission, et `partenaire_tarifs` un prix par zone (voir ci-dessous). Sur une course entre deux zones, la part renvoyée par Ewuang ne vaudra donc pas 95 % du prix client, et la commission ne sera pas de 5 %. Il faut faire évoluer le contrat (zone de départ + zone d'arrivée) des deux côtés.
- **Toute modification de prix se reporte des deux côtés.** Les prix sont dans le code : un changement de prix demande un redéploiement.
- [grille-tarifs.spec.ts](apps/api/src/tarifs/grille-tarifs.spec.ts) écrit les neuf prix standard en dur : à mettre à jour en même temps que la grille.

## Courses ([src/livraisons/](apps/api/src/livraisons/), [src/boutiques/](apps/api/src/boutiques/))

- **Profil boutique obligatoire.** `register` ne crée que le `User` ; `PUT /boutiques/moi` crée ou met à jour la ligne `Boutique`. Sans elle, `POST /livraisons` répond 403 (`Livraison.boutiqueId` pointe sur `Boutique.id`). Adresse et téléphone du profil servent d'enlèvement par défaut.
- `POST /livraisons` (BOUTIQUE) : prix = grille par trajet. **La course est écrite avant l'appel à Ewuang**, avec `referenceExterne = FD-<uuid>` et le corps exact envoyé dans `chargeEwuang`. Issue : 201 transmise ; **202** Ewuang injoignable (`transmise: false`, motif dans `erreurEwuang`) ; 400 refus définitif d'Ewuang → course passée `ANNULEE`.
- `POST /livraisons/:id/renvoyer` rejoue `chargeEwuang` **tel quel** : Ewuang n'est idempotent qu'à corps identique (sinon 409). Ne jamais reconstruire le corps depuis les colonnes ou le profil.
- Zone envoyée à Ewuang = **`zone_arrivee`** (chez lui, `zone` est la ville de destination). `zoneDepart`/`zoneArrivee`/`typeCourse` restent chez nous pour le prix par trajet.
- À la transmission, `tarifEwuang` = `remuneration_livreur` renvoyée par Ewuang et `commission` = `tarif client − tarifEwuang`. `statutEwuang` n'est posé que s'il est encore null (un webhook peut arriver avant la réponse).
- `DELETE /livraisons/:id` : annule chez Ewuang d'abord. Une course **non transmise** est d'abord rejouée (idempotent) pour récupérer la mission peut-être créée malgré un timeout — l'annuler seulement en local laisserait une mission vivante dans la flotte. Ewuang injoignable → 503, rien n'est annulé.
- Portée : une BOUTIQUE ne voit que ses courses (404 sur celle d'une autre, pas 403) ; l'ADMIN voit tout. `commission`, `tarifEwuang`, `remunerationLivreur` ne sont servis qu'à l'ADMIN.
- Le `codeRemise` est renvoyé à la boutique ; **aucun SMS n'est envoyé au destinataire** pour l'instant.

## Intégration Ewuang ([src/ewuang/](apps/api/src/ewuang/))

Côté Ewuang, find_delivery est enregistré comme partenaire depuis le 2026-10-22 (`partenaires.nom = 'find_delivery'`, préfixe de clé `ewp_e4a8f6ad` depuis sa régénération le 2026-10-22, les quatre scopes). Reste à renseigner dans `/dashboard/partenaires` : l'URL du webhook (une fois le service déployé).

Grille `partenaire_tarifs` côté Ewuang, en FCFA (prix client → part d'Ewuang = 95 %, après les 5 % reversés à find_delivery). Dans la base Ewuang, `tarif_partenaire` est le **prix** (colonne de gauche) et `remuneration_livreur` la **part d'Ewuang** (colonne de droite), qui revient entièrement au livreur. Vérifié le 2026-10-22 sur une vraie mission (Akanda standard : `tarif` 1 500, `remuneration_livreur` 1 425). C'est donc `remuneration_livreur` qui alimente `tarifEwuang`.

| Zone | standard | express | volumineux |
|---|---|---|---|
| Akanda | 1 500 → 1 425 | 2 500 → 2 375 | 3 500 → 3 325 |
| Libreville | 2 000 → 1 900 | 3 000 → 2 850 | 4 000 → 3 800 |
| Owendo | 2 000 → 1 900 | 3 000 → 2 850 | 4 000 → 3 800 |

Elle vient de la grille moto publique d'Ewuang (« Octobre Rose »), réduite à son prix **intra-zone** : le contrat ne connaît qu'une `zone` par mission, donc une course entre deux zones est facturée au prix de la zone envoyée. Express = +1 000, volumineux = +2 000. La zone PK de la grille publique n'existe pas dans `zones_livraison`. C'est Ewuang qui calcule le prix, jamais nous : un montant envoyé dans la requête est ignoré.

Contrat de référence : **`../ewuang-web/docs/contrat-api-partenaires.md`** (dépôt voisin). Toute divergence entre le code et ce document est un bug du code. Variables : voir [apps/api/.env.example](apps/api/.env.example).

**Client sortant** ([ewuang.client.ts](apps/api/src/ewuang/ewuang.client.ts)) : `EWUANG_API_URL` (`https://ewuang.ga/api`).
- Authentification par l'en-tête **`X-Ewuang-Cle`**, jamais `Authorization`. La clé n'est jamais journalisée.
- Timeout de 10 s. Erreur réseau → 503. 401/403 (clé, scopes) et 429 → 503 (rejouable : la requête n'est pas en cause). Autres 4xx d'Ewuang → 400 (ne pas rejouer). 5xx → 502 (rejouable). Le service des courses s'appuie sur cette distinction : un 400 **annule** la course.
- `POST /partenaires/missions` est **idempotent sur `reference_externe`**. Après un timeout, on rejoue le même corps. Un même `reference_externe` avec un corps différent donne un 409.
- `GET /partenaires/flotte` : polling à 15 s au plus serré (sinon 429). Une position de plus de 5 min doit être traitée comme périmée **de notre côté**. Une flotte qui rétrécit n'est pas une panne. Un 404 sur `/livreurs/{id}` est normal.

**Webhook entrant** `POST /api/v1/ewuang/webhook` ([controller](apps/api/src/ewuang/ewuang-webhook.controller.ts), [service](apps/api/src/ewuang/ewuang-webhook.service.ts)) :
- `@Public()` + `@SkipThrottle()`. L'authentification passe par la signature HMAC `X-Ewuang-Signature: t=…,v1=…`, calculée sur le **corps brut** (`req.rawBody`). Ne jamais re-sérialiser le JSON : les accents (« Colis récupéré ») changent les octets.
- Sans `EWUANG_WEBHOOK_SECRET`, l'endpoint **refuse tout**. Le motif du refus va dans les logs, jamais dans la réponse.
- **Pas de DTO** sur ce corps : `forbidNonWhitelisted` rejetterait tout nouveau champ ou type d'événement.
- Le 200 part **avant** le traitement, qui est détaché et ne lève jamais.
- Livraison « au moins une fois » : dédoublonnage par l'unicité de `EvenementEwuangRecu.evenementId` (`create` + P2002, pas de lecture préalable). Chaque événement est conservé brut (`charge`) pour pouvoir être rejoué.
- Les événements sont ordonnés par **`emis_at`**, pas par ordre d'arrivée : un événement dont `emis_at <= Livraison.dernierEvenementAt` est ignoré, avec son `ignoreMotif`.
- `statutEwuang` (texte libre, repris tel quel) **fait foi**. On ne l'écrit jamais localement. `statut` (enum) reste le vocabulaire de l'écran.
- Instantané du livreur (`livreurEwuangId`, `livreurNom`…) : posé à l'attribution et jamais effacé. L'état vivant (position, en ligne) se lit sur `/partenaires/flotte` ; on ne le stocke pas.
- `codeRemise` (4 chiffres) : c'est à nous de le transmettre au destinataire, sinon la course ne peut pas être clôturée.

Côté Ewuang, seul le vérificateur de signature est couvert par des tests ([ewuang-signature.spec.ts](apps/api/src/ewuang/ewuang-signature.spec.ts)).

## Points connus à ne pas prendre pour des régressions

- `POST /auth/register` est public et accepte `role` dans le corps, **`ADMIN` compris**. C'est une faille ouverte, pas encore traitée.
- [test/app.e2e-spec.ts](apps/api/test/app.e2e-spec.ts) est le test du scaffold (`GET /` → « Hello World! ») : aucune route ne lui correspond, il échoue.
- `pnpm lint` échoue sur [src/main.ts](apps/api/src/main.ts) (`no-floating-promises` : le bootstrap n'est pas attendu), et `users.*` / `auth.service.ts` portent des imports et variables inutilisés.
- Sans `prisma generate`, `tsc` signale des dizaines d'erreurs sur `@prisma/client` (le script d'installation de Prisma est bloqué, voir plus haut). Ce n'est pas une régression du code.
- `typescript` vaut `7.0.2` à la racine et dans `web`, mais `^6.0.2` dans `api`.
- [.oxlintrc.json](apps/api/.oxlintrc.json) désactive `no-explicit-any`. Le typage strict reste la règle (`strict: true`).

## Environnement

`apps/api/.env` (non versionné, modèle dans `.env.example`) : `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (optionnel), `PORT`, `EWUANG_API_URL`, `EWUANG_API_KEY` (`ewp_…`, affichée une seule fois dans `/dashboard/partenaires` côté Ewuang), `EWUANG_WEBHOOK_SECRET` (`whsec_…`, distinct de la clé).

Prettier dans `api` : guillemets simples, virgules finales.
