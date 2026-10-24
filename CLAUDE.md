# CLAUDE.md

Ce fichier guide Claude Code (claude.ai/code) dans ce dépôt.

## Le projet

**find_delivery** (« trouver un livreur ») : plateforme où un **client** (particulier, entreprise ou boutique) soumet une course de livraison. Aujourd'hui, chaque course est dispatchée à **Ewuang** via son API partenaires, et le suivi revient par webhook. Ewuang exécute, find_delivery facture le client (`Livraison.tarif`) et paie Ewuang (`Livraison.tarifEwuang`).

**Le chantier en cours fait foi : [PLAN_LANCEMENT.md](PLAN_LANCEMENT.md).** find_delivery y devient un répartiteur avec sa propre flotte d'indépendants (`../find_delivery_mobile`), Ewuang devient une flotte à égalité, et le lancement se fait en **espèces** encaissées par le livreur. Décisions, règles R1 à R7 et phases y sont tenues à jour.

État actuel : authentification, utilisateurs, profil client, intégration Ewuang (client + webhook), grille de tarifs (devis), création / lecture / annulation des courses avec le choix du payeur (phase 1 du plan, terminée le 2026-10-23), et la flotte propre : inscription et dossier des livreurs, attribution, exécution et encaissement des courses (phase 2, livrée le 2026-10-24, API pour [../find_delivery_mobile](../find_delivery_mobile/)). `apps/web` est l'espace client (inscription, profil, courses). Pas encore de registre des espèces, de réservation côté Ewuang (v2 du contrat), ni d'envoi du code de remise par SMS.

Code, commentaires, messages d'erreur et Swagger sont **en français**. Conserve-le.

## Organisation du monorepo

Turborepo + **pnpm** (`pnpm@11`, Node ≥ 24), workspaces `apps/*` et `packages/*`.

- [apps/api/](apps/api/) : API **NestJS 12**, ESM (`"type": "module"`), Prisma 7 + PostgreSQL. C'est là que se trouve tout le code métier.
- [apps/web/](apps/web/) : Next.js 16 / React 19, espace client (port 3000). Voir « apps/web — Espace client ».
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
# ⚠️ Sans terminal (agent, CI), `pnpm exec`/`pnpm test` lancent une vérification d'installation qui veut
# PURGER node_modules (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). Appeler les binaires directement :
# .\node_modules\.bin\vitest.cmd run, .\node_modules\.bin\prisma.cmd generate, .\node_modules\.bin\tsc.cmd --noEmit
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
2. `JwtAuthGuard` : Bearer JWT (`JWT_SECRET`, expiration `JWT_EXPIRES_IN`, 30 min par défaut ; **12 h pour un LIVREUR**, `JWT_EXPIRES_IN_LIVREUR`, posé dans `AuthService.generateToken`). **Une route est protégée par défaut** ; `@Public()` la rend publique.
3. `RolesGuard` : `@Roles(UserRole.ADMIN, …)` ; sans décorateur, pas de contrainte de rôle.

`JwtStrategy.validate` relit l'utilisateur en base (sans `password`) et le place dans `req.user`, lu par `@CurrentUser()`. Mots de passe hachés en bcrypt. Le login refuse un compte dont `status !== 'ACTIVE'`.

Rôles : `CLIENT | LIVREUR | ADMIN` (`BOUTIQUE` renommé en `CLIENT` le 2026-10-23). Profil métier 1-1 par rôle : `Admin`, `Client`, `Livreur`. Un `Client` porte un `type` (`PARTICULIER | ENTREPRISE | BOUTIQUE`) et une `raisonSociale`, obligatoire hors particulier (contrôlée par le DTO).

### Base de données

Postgres **propre à ce projet** (`DATABASE_URL`). Ce n'est **pas** la base Supabase d'Ewuang : les deux systèmes ne communiquent que par HTTP. Accès via `PrismaService` (global), qui étend `PrismaClient` avec l'adaptateur `@prisma/adapter-pg` sur un `Pool` `pg`. Le `datasource` du schéma n'a pas d'`url` : elle vient de `prisma7.config.ts`.

Règles du schéma ([prisma/schema.prisma](apps/api/prisma/schema.prisma)) :
- **Toute nouvelle colonne de date porte `@db.Timestamptz`.** Le défaut Prisma (`TIMESTAMP(3)`, sans fuseau) décale d'une heure les filtres par jour au Gabon (UTC+1) et casse la comparaison avec les `emis_at` d'Ewuang. Les anciennes colonnes sont encore en `TIMESTAMP(3)`.
- Le modèle `Livreur` et `SuiviPosition` datent d'avant le choix « flotte Ewuang ». Ils **reprennent du service** avec la flotte propre de find_delivery (phase 2 du plan, décision D5) : c'est sur eux qu'on bâtit. Les lat/lng de `Livraison` restent sans usage.
- ⚠️ **Le schéma et les migrations divergent** sur `user` : la migration initiale crée `name NOT NULL`, `isActive` et `status DEFAULT 'PENDING'`, alors que le schéma porte `name String?`, pas d'`isActive` et `@default(ACTIVE)`, sans migration correspondante. La base Neon, elle, **suit le schéma** (vérifié le 2026-10-22) : c'est la chaîne de migrations qui ne la recréerait pas à l'identique. Vérifie l'état réel de la base avant toute nouvelle migration.
- **La base est sur Neon** (`DATABASE_URL` dans `apps/api/.env`).
- ⚠️ **Le moteur de migration Prisma répond `P1001` sur Neon depuis le poste de Franck**, pooler comme hôte direct, alors que `pg` (Node) s'y connecte (encore vrai le 2026-10-23). `integration_ewuang`, `creation_courses` (2026-10-22) et `client_generique` (2026-10-23) ont donc été appliquées via `pg`, en une transaction, et inscrites à la main dans `_prisma_migrations`. La somme de contrôle Prisma est le SHA-256 du `migration.sql` **en fins de ligne LF** (les deux premières migrations sont en CRLF dans le dépôt).
- Un renommage de table ou de colonne s'écrit **à la main** (`RENAME`) : Prisma le traduit en DROP + CREATE et perd les données. Voir `client_generique`, qui renomme aussi les contraintes `NOT NULL` nommées par Postgres 18.

## Tarifs ([src/tarifs/](apps/api/src/tarifs/))

Le client paie le prix de la grille, **sans majoration**. find_delivery ne prend rien sur le client : c'est **Ewuang qui lui reverse 5 %** du prix (`COMMISSION_POURCENT`). Exemple : course à 2 000 → find_delivery touche 100, Ewuang garde 1 900.

Ces tarifs sont propres à find_delivery. Ils ne sont **pas** les frais de livraison de la marketplace Ewuang, qui vivent dans la base d'Ewuang et ne nous concernent pas.

Le calcul vit en fonctions pures dans [grille-tarifs.ts](apps/api/src/tarifs/grille-tarifs.ts) et alimente les trois colonnes de `Livraison` : `tarif` (prix client), `commission` (5 % du prix, arrondi à l'entier) et `tarifEwuang` (= `tarif − commission`, la part d'Ewuang).

Prix **par zone d'arrivée** (`PRIX_STANDARD[arrivée]`), plus un supplément selon le type : express +1 000, volumineux +2 000. Prix standard : Akanda 1 500, Libreville 2 000, Owendo 2 000. Leurs 95 % doivent rester **égaux à `remuneration_livreur` côté Ewuang** (tableau plus bas).

- **Pourquoi pas par trajet.** Jusqu'au 2026-10-22 la grille suivait l'affiche « Octobre Rose » par trajet (départ → arrivée, non symétrique). Mais Ewuang ne reçoit que la zone d'arrivée et paie le livreur au prix de cette zone : Libreville → Owendo express était facturé 4 000 au client et le livreur touchait 2 850 au lieu de 3 800, l'écart gonflant notre commission. Choix de Franck : facturer au prix de la zone d'arrivée plutôt que de faire évoluer le contrat. Revenir au prix par trajet exige d'ajouter `zone_depart` au contrat et une grille départ × arrivée dans `partenaire_tarifs`, des deux côtés.
- Le départ reste dans le devis, la course et l'affichage ; il n'entre simplement pas dans le prix.
- **`volumineux` et le véhicule requis `camionnette` sont retirés pour l'instant** (décision de Franck, 2026-10-24) : absents de `TYPES_COURSE` / `VEHICULES` (API `grille-tarifs.ts`, `creer-livraison.dto.ts` ; web `lib/types.ts`), donc ni devisés, ni proposés, ni acceptés à la création (400). Les types `TypeCourse`/`Vehicule` et `SUPPLEMENT` les gardent pour les courses existantes ; un livreur peut toujours s'inscrire en camionnette. Les rétablir = les remettre dans ces trois listes.
- `GET /api/v1/tarifs` : grille complète (27 trajets × types, le prix ne variant qu'avec l'arrivée), **publique** (affichée sur la page d'accueil du front). `GET /api/v1/tarifs/devis?zone_depart=…&zone_arrivee=…&type_course=…` : un devis, exige un JWT. Les deux ne servent que le **prix client** (`prixClient` dans le contrôleur) : `commission` et `tarifEwuang` ne sortent jamais par ces routes.
- Zones acceptées : `Akanda | Libreville | Owendo`. **PK** figure sur l'affiche mais est exclue tant qu'Ewuang ne la sert pas (absente de `zones_livraison`) : elle répond 400.
- **La grille sert à deviser, elle ne fait pas foi.** À la création de la course, stocker comme `tarifEwuang` la `remuneration_livreur` **renvoyée par Ewuang** (pas son `tarif`, qui est le prix de la zone) ; la commission réelle est alors `tarif client − tarifEwuang`.
- **Toute modification de prix se reporte des deux côtés.** Les prix sont dans le code : un changement de prix demande un redéploiement.
- [grille-tarifs.spec.ts](apps/api/src/tarifs/grille-tarifs.spec.ts) écrit les neuf prix standard en dur : à mettre à jour en même temps que la grille.

## Courses ([src/livraisons/](apps/api/src/livraisons/), [src/clients/](apps/api/src/clients/))

- **Profil client obligatoire.** `register` ne crée que le `User` ; `PUT /clients/moi` crée ou met à jour la ligne `Client`. Sans elle, `POST /livraisons` répond 403 (`Livraison.clientId` pointe sur `Client.id`). Adresse et téléphone du profil servent d'enlèvement par défaut.
- **Paiement en espèces** : `POST /livraisons` exige `paiement.payeur` (`expediteur` | `destinataire`) et accepte `paiement.montant_marchandise` (contre-remboursement, payé par le destinataire à la remise, 50 000 au plus : `PLAFOND_MARCHANDISE`). Stockés dans `Livraison.payeur` / `montantMarchandise`. `payeur = null` = course réglée hors course (créée avant le 2026-10-23). **Pas encore transmis à Ewuang** (v1 du contrat) : à ajouter à `chargeEwuang` avec la v2.
- `@ValidateNested` seul laisse passer un bloc **absent** : un bloc obligatoire porte aussi `@IsDefined`, sinon la requête atteint le service et lève une 500. `destinataire` et `colis` n'en ont pas encore.
- `POST /livraisons` (CLIENT) : prix = grille, zone d'arrivée + type. **La course est écrite avant l'appel à Ewuang**, avec `referenceExterne = FD-<uuid>` et le corps exact envoyé dans `chargeEwuang`. Issue : 201 transmise ; **202** Ewuang injoignable (`transmise: false`, motif dans `erreurEwuang`) ; 400 refus définitif d'Ewuang → course passée `ANNULEE`.
- `POST /livraisons/:id/renvoyer` rejoue `chargeEwuang` **tel quel** : Ewuang n'est idempotent qu'à corps identique (sinon 409). Ne jamais reconstruire le corps depuis les colonnes ou le profil.
- Zone envoyée à Ewuang = **`zone_arrivee`** (chez lui, `zone` est la ville de destination). `zoneDepart`/`zoneArrivee`/`typeCourse` restent chez nous (le départ pour l'affichage seulement).
- À la transmission, `tarifEwuang` = `remuneration_livreur` renvoyée par Ewuang et `commission` = `tarif client − tarifEwuang`. `statutEwuang` n'est posé que s'il est encore null (un webhook peut arriver avant la réponse).
- `DELETE /livraisons/:id` : annule chez Ewuang d'abord. Une course **non transmise** est d'abord rejouée (idempotent) pour récupérer la mission peut-être créée malgré un timeout — l'annuler seulement en local laisserait une mission vivante dans la flotte. Ewuang injoignable → 503, rien n'est annulé.
- Portée : un CLIENT ne voit que ses courses (404 sur celle d'un autre, pas 403) ; l'ADMIN voit tout. `commission`, `tarifEwuang`, `remunerationLivreur` ne sont servis qu'à l'ADMIN.
- Le `codeRemise` est renvoyé au client ; **aucun SMS n'est envoyé au destinataire** pour l'instant.

## Flotte find_delivery ([src/livreurs/](apps/api/src/livreurs/))

L'API de [../find_delivery_mobile](../find_delivery_mobile/). Choix et limites : PLAN_LANCEMENT.md, phase 2.

- **Le verrou de flotte.** `Livraison.flotte` (`FIND_DELIVERY | EWUANG | null`) ne passe de null à une valeur que par un `updateMany` conditionné par `flotte: null` : `accepter` pour notre flotte, le webhook `mission.attribuee` pour Ewuang. `mission.rendue` la libère. Une course de notre flotte n'écoute plus Ewuang : `statut` fait foi, ses événements sont ignorés (`ignoreMotif`), y compris l'annulation que nous avons demandée.
- `accepter` annule ensuite la mission chez Ewuang. Refus (400 : un livreur Ewuang a le colis) → acceptation défaite, `flotte = EWUANG`, 409. Ewuang injoignable → défaite, `flotte = null`, 503. **Jamais deux livreurs sur une course.**
- Une course n'est proposée à notre flotte que si elle est `EN_ATTENTE`, libre, **payée en espèces** (`payeur` non null) et **transmise** (`codeRemise` non null : c'est le code d'Ewuang, déjà donné au destinataire).
- Transitions (`StatutLivraison`) : `EN_ATTENTE → ACCEPTEE → EN_COURS → LIVREE`, `EN_COURS → RETOUR_EXPEDITEUR → RETOURNEE`, `ACCEPTEE → EN_ATTENTE` (rendre). Chacune est un `updateMany` conditionné par l'état de départ et le livreur.
- **Code de remise** : l'essai est consommé AVANT la comparaison (`tentativesCode < 5`), puis comparaison à temps constant. Ne pas inverser l'ordre : comparer d'abord laisserait passer autant d'essais que de requêtes simultanées.
- **Argent** : calcul unique dans [encaissement.ts](apps/api/src/livraisons/encaissement.ts). Montant exact exigé à chaque étape où quelque chose est dû (R2), refusé quand rien ne l'est. Gain = 95 % du prix (D6), + `FORFAIT_RETOUR` (500) au retour, et la commission peut alors être négative.
- **Dossier** : `Livreur.statutDossier`, validé par un ADMIN (`/admin/livreurs`). Aucune course avant `VALIDE` (`LivreursService.exigerValide`). Pas de dépôt de pièces.
- Une course disponible est servie **sans contacts** ; le code de remise n'est jamais servi au livreur.
- `Livreur.moyenTransport` est l'enum d'origine : seuls `MOTO`, `VOITURE`, `CANTER` (= camionnette) sont utilisés ([vehicules.ts](apps/api/src/livreurs/vehicules.ts)). La création de course ne propose plus `camionnette`, mais l'inscription l'accepte.

## Registre des espèces ([src/especes/](apps/api/src/especes/))

Qui doit combien à qui. Choix et limites : PLAN_LANCEMENT.md, phase 3.

- Table `MouvementEspeces`, **immuable** (trigger `MouvementEspeces_immuable` : ni UPDATE ni DELETE, même à la main). Une erreur se corrige par l'écriture inverse. FK en `RESTRICT` : un livreur, un client ou une course qui a mouvementé de l'argent ne se supprime plus.
- `montant` toujours > 0, **le sens est dans le type** (`SENS` dans [especes.ts](apps/api/src/especes/especes.ts)). Compte livreur : `ENCAISSEMENT`, `PAIEMENT_LIVREUR` (+) ; `REMUNERATION`, `VERSEMENT` (−). Solde > 0 = à verser à find_delivery ; < 0 = find_delivery doit au livreur. Compte client : `MARCHANDISE` (+), `REVERSEMENT` (−). Des CHECK en base imposent le compte et l'origine de chaque type.
- **Les écritures d'une étape se posent dans la transaction de l'étape** (`EspecesService.ecrireCourse(tx, …)`), après le `updateMany` qui la garde. `cle` unique `<livraisonId>:<etape>` est le filet. Ne jamais écrire au registre hors de cette transaction.
- Règlements (`/admin/especes/*`) : saisis par un ADMIN contre un **reçu papier**, `cle = recu:<numéro>` (même reçu → 409), au plus le solde, sous `SELECT … FOR UPDATE` du livreur ou du client.
- **Compte Ewuang** (ni livreur ni client) : le webhook y écrit ce que les livreurs Ewuang encaissent sur nos courses (+) et ce que la course lui coûte à la fin (−), avec la marchandise due au client, dans la transaction qui applique l'événement (`ecrituresEwuang`, [ewuang-webhook.service.ts](apps/api/src/ewuang/ewuang-webhook.service.ts)). Son solde est le relevé entre Ewuang et nous.
- **R5 sans état** : `etatLivreur` calcule le blocage à chaque appel (solde ≥ 50 000, ou encaissement non couvert depuis 48 h, en premier entré premier sorti, dans la requête SQL de `soldesLivreurs`). Il bloque `disponibles` (renvoie `blocage`) et `accepter` (403), jamais les courses en main.

## Intégration Ewuang ([src/ewuang/](apps/api/src/ewuang/))

**Contrat v2 (réservation, espèces, retour)** — écrit le 2026-10-24, schémas appliqués des deux côtés (Neon, Supabase), code pas encore déployé ; ordre de mise en service dans PLAN_LANCEMENT.md, phase 4.
- `POST /api/v1/ewuang/reservations` ([ewuang-reservation.service.ts](apps/api/src/ewuang/ewuang-reservation.service.ts)) : même signature que le webhook, mais la réponse PORTE la décision (200 réservée, 409 refusée), calculée avant de répondre. Elle pose `flotte = EWUANG` + `reserveeEwuangAt` sous `sansFlotte` ([src/livraisons/flotte.ts](apps/api/src/livraisons/flotte.ts)), le verrou partagé avec l'acceptation d'un livreur find_delivery. Une réservation non confirmée par `mission.attribuee` expire au bout de 10 min.
- Le bloc `paiement` de chaque mission porte `frais` = **notre prix client**, pas le tarif Ewuang : c'est ce que son livreur encaisse.

Côté Ewuang, find_delivery est enregistré comme partenaire depuis le 2026-10-22 (`partenaires.nom = 'find_delivery'`, préfixe de clé `ewp_e4a8f6ad` depuis sa régénération le 2026-10-22, les quatre scopes). Reste à renseigner dans `/dashboard/partenaires` : l'URL du webhook (une fois le service déployé).

Grille `partenaire_tarifs` côté Ewuang, en FCFA : prix client → part d'Ewuang = 95 %, qui revient entièrement au livreur. **Depuis le 2026-10-24 (décision D11), Ewuang ne garde aucune marge** : `tarif_partenaire` = `remuneration_livreur` (= la colonne de droite) sur les 9 lignes, et seul find_delivery garde les 5 % ([ewuang-web/sql/partenaire_tarifs_find_delivery_sans_marge.sql](../../ewuang-web/sql/partenaire_tarifs_find_delivery_sans_marge.sql), rollback inclus). Avant, les 5 % étaient comptés des deux côtés. Conséquence : le `tarif` renvoyé par `POST /partenaires/missions` vaut désormais la part d'Ewuang, plus le prix client. On ne le lit pas : c'est `remuneration_livreur` qui alimente `tarifEwuang`. Les missions créées avant gardent leurs montants figés.

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

## apps/web — Espace client

Next 16 App Router, Tailwind v4 + primitives shadcn recopiées d'`ewuang-web` ([components/ui/](apps/web/components/ui/)). `<select>` natif plutôt que Radix Select (alimente `FormData` sans champ caché). Mode sombre = celui du système.

- **Next 16 : `middleware.ts` s'appelle `proxy.ts`.** [proxy.ts](apps/web/proxy.ts) ne fait qu'un aiguillage optimiste sur le cookie (lecture de la charge du JWT, **sans** vérifier la signature : le secret reste dans l'API). La vraie barrière est l'API.
- **Session = le JWT de l'API dans un cookie httpOnly `fd_session`** ([lib/session.ts](apps/web/lib/session.ts)), qui expire avec le jeton. Pas de jeton de rafraîchissement côté API : reconnexion toutes les 30 min (`JWT_EXPIRES_IN`).
- **Le navigateur n'appelle jamais l'API.** Tout passe par [lib/api.ts](apps/web/lib/api.ts) (`server-only`) depuis les Server Components et les Server Actions ([app/actions/](apps/web/app/actions/)). D'où `API_URL` sans `NEXT_PUBLIC_` (défaut en dev : `http://localhost:3001/api/v1`, obligatoire en prod) et aucun CORS à ouvrir.
- Un 401 de l'API ou un jeton expiré/d'un autre rôle mène à **`/deconnexion`** (Route Handler) : un Server Component ne peut pas effacer de cookie, et sans ce détour `proxy.ts` renverrait vers l'espace en boucle.
- L'inscription n'envoie **aucun rôle** : l'API crée toujours un `CLIENT` (`auth.service.ts`) et rejette un champ `role` (`forbidNonWhitelisted`). La connexion refuse tout jeton d'un autre rôle ; un jeton émis avant le 2026-10-23 (rôle `BOUTIQUE`) mène à `/deconnexion?motif=role`, puis la reconnexion en délivre un neuf.
- Le formulaire de course n'a **pas de payeur par défaut** (décision D3 : le client choisit). Ce qui est encaissé à l'enlèvement et à la remise se calcule dans `calculerEncaissements` ([lib/affichage.ts](apps/web/lib/affichage.ts)).
- **Formulaires : `onSubmit` + `startTransition`, jamais `<form action={…}>`** ([use-retour-action.ts](apps/web/components/use-retour-action.ts)). React 19 vide les champs d'un `<form action>` à chaque fin d'action, erreur comprise.
- Règle UX : toute action serveur affiche l'**overlay plein écran** ([overlay-chargement.tsx](apps/web/components/overlay-chargement.tsx), 400 ms minimum) puis un toast sonner.
- Le devis s'affiche en direct depuis `GET /tarifs`, chargé une fois côté serveur. Seul `tarif` est montré.
- Dates formatées avec `timeZone: 'Africa/Libreville'` ([lib/affichage.ts](apps/web/lib/affichage.ts)) ; la date souhaitée saisie (`datetime-local`) est envoyée en `+01:00`.
- Statut affiché : `statutEwuang` fait foi dès que la course est transmise ; avant, « Non transmise » (bouton Renvoyer) ou « Annulée ».

## Points connus à ne pas prendre pour des régressions

- [test/app.e2e-spec.ts](apps/api/test/app.e2e-spec.ts) est le test du scaffold (`GET /` → « Hello World! ») : aucune route ne lui correspond, il échoue.
- `pnpm lint` échoue sur [src/main.ts](apps/api/src/main.ts) (`no-floating-promises` : le bootstrap n'est pas attendu), et `users.*` / `auth.service.ts` portent des imports et variables inutilisés.
- Sans `prisma generate`, `tsc` signale des dizaines d'erreurs sur `@prisma/client` (le script d'installation de Prisma est bloqué, voir plus haut). Ce n'est pas une régression du code.
- `typescript` vaut `7.0.2` à la racine et dans `web`, mais `^6.0.2` dans `api`.
- `eslint` dans `apps/web` échoue sur `eslint.config.js`, `next.config.js` et `postcss.config.mjs` (`Cannot find package '@babel/preset-typescript'`) : problème d'installation, aucun fichier `.ts`/`.tsx` n'est en cause (constaté le 2026-10-23).
- [.oxlintrc.json](apps/api/.oxlintrc.json) désactive `no-explicit-any`. Le typage strict reste la règle (`strict: true`).

## Environnement

`apps/api/.env` (non versionné, modèle dans `.env.example`) : `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (optionnel), `JWT_EXPIRES_IN_LIVREUR` (optionnel, `12h`), `PORT`, `EWUANG_API_URL`, `EWUANG_API_KEY` (`ewp_…`, affichée une seule fois dans `/dashboard/partenaires` côté Ewuang), `EWUANG_WEBHOOK_SECRET` (`whsec_…`, distinct de la clé).

Prettier dans `api` : guillemets simples, virgules finales.
