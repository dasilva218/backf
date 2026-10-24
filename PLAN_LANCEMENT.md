# Plan de lancement — find_delivery

Rédigé le 2026-10-23, à partir des décisions de Franck. Ce document fait foi pour le
chantier : chaque phase terminée y est cochée, chaque décision nouvelle y est ajoutée.

Le contrat avec Ewuang évolue en parallèle : brouillon de la v2 dans
[`../../ewuang-web/docs/contrat-api-partenaires-v2-brouillon.md`](../../ewuang-web/docs/contrat-api-partenaires-v2-brouillon.md).

---

## 1. Ce qui change

Jusqu'ici, find_delivery n'avait **pas de flotte** : il transmettait chaque course à
Ewuang. Désormais, **find_delivery devient le répartiteur** :

```
                       ┌──▶ find_delivery_mobile (indépendants find_delivery)
client ──▶ find_delivery ┤
                       └──▶ API Ewuang ──▶ ewuang_livreur (livreurs Ewuang)
```

La course est proposée **en même temps** aux deux flottes. Le premier livreur qui
l'accepte la prend.

## 2. Décisions

| # | Décision | Date |
|---|---|---|
| D1 | Une boutique est un **client** comme un autre : particulier, entreprise ou boutique. | 2026-10-23 |
| D2 | Au lancement, **paiement en espèces uniquement**, encaissé par le livreur. | 2026-10-23 |
| D3 | **Le client choisit le payeur à la commande** : l'expéditeur à l'enlèvement, ou le destinataire à la remise. | 2026-10-23 |
| D4 | Le livreur encaisse les frais et, **en option, le prix de la marchandise** pour le compte du client (contre-remboursement, payé par le destinataire à la remise). *Interprétation à confirmer.* | 2026-10-23 |
| D5 | Les livreurs `find_delivery_mobile` sont des **indépendants payés à la course**. | 2026-10-23 |
| D6 | Un indépendant touche **95 % du prix client**, soit la même part qu'un livreur Ewuang (grille `partenaire_tarifs`). Le livreur gagne autant quelle que soit sa flotte. find_delivery garde 5 %. | 2026-10-23 |
| D7 | Ewuang est une **flotte à égalité** avec find_delivery_mobile : pas de priorité entre les deux. | 2026-10-23 |
| D8 | Les flottes sont départagées par **réservation** : avant d'attribuer une mission, Ewuang demande à find_delivery de la lui réserver. | 2026-10-23 |
| D9 | Au lancement, seule **find_delivery_mobile** se branche au hub. Pas d'applications tierces. | 2026-10-23 |
| D10 | **La v2 du contrat est terminée avant le lancement** : Ewuang participe dès le premier jour. La phase 4 devient bloquante pour le lancement. | 2026-10-23 |
| D11 | **find_delivery garde les 5 %, Ewuang ne garde rien.** Chez Ewuang, `tarif_partenaire` de find_delivery = `remuneration_livreur` (Akanda standard : 1 425 → 1 425). | 2026-10-23 |

Conséquence de D6 : la course à 2 000 rapporte 1 900 au livreur et 100 à find_delivery.

## 3. Points ouverts

P1 et P2 sont tranchés (D10, D11).

Rappel sur P2 : jusqu'au 2026-10-23, les 5 % étaient comptés des deux côtés. Sur une
mission Akanda standard, find_delivery enregistrait 75 de commission, et le trigger
`livraisons_remunerer_mission()` d'Ewuang écrivait admin +1 500, admin −1 425 et livreur
+1 425, soit 75 de marge pour Ewuang aussi. D11 aligne la grille d'Ewuang, ce qui ramène
sa marge à 0.

**P3. Les cas d'échec avec des espèces. Règles validées par Franck le 2026-10-23.**
Les montants sont des valeurs de départ, réglables sans redéploiement (table de
paramètres).

*R1. Le livreur ne rend jamais d'argent sur place.* Il encaisse, il ne rembourse pas.
Tout remboursement ou geste commercial passe par un ADMIN : virement Mobile Money ou
avoir sur la prochaine course. Cela évite les litiges d'argent liquide entre le livreur
et le client.

*R2. Pas de remise partielle.* Si le destinataire doit payer et ne paie pas tout (frais
et marchandise), le colis n'est pas remis. Pas de remise « on verra plus tard ».

*R3. Échec de remise (destinataire absent, injoignable ou qui refuse de payer).*
- Le livreur attend **10 minutes** sur place et appelle au moins deux fois. L'application
  enregistre les appels.
- Il déclare ensuite l'échec avec un motif. La course passe à **« Retour expéditeur »**
  et le colis revient à l'adresse d'enlèvement.
- **Le client doit les frais de l'aller**, que le destinataire n'a pas payés. Ils sont
  encaissés auprès de l'expéditeur au retour du colis.
- **Le retour n'est pas facturé** au lancement. Le livreur est payé pour l'aller (95 %)
  et touche en plus un **forfait retour de 500 FCFA**, à la charge de find_delivery.
- Si les frais avaient déjà été payés à l'enlèvement, ils ne sont pas remboursés.
- Au lieu du retour, le client peut demander **une nouvelle tentative dans les 48 h**,
  facturée comme une nouvelle course à 50 %.

*R4. Annulation.*
- Avant l'enlèvement : gratuite, rien n'a été encaissé.
- Après l'enlèvement : ce n'est plus une annulation, c'est un retour à l'expéditeur (R3).
  Les frais sont dus.
- Annulation à cause d'un incident chez nous (colis perdu, abîmé, livreur défaillant) :
  find_delivery rembourse intégralement les frais payés, par un ADMIN (R1).
  L'indemnisation du colis relève des conditions générales, à rédiger.

*R5. Plafond d'encours du livreur.*
- L'**encours** est l'argent que le livreur détient et doit reverser : ce qu'il a
  encaissé moins sa rémunération.
- Plafond de **50 000 FCFA**. Au-delà, il ne voit plus de nouvelles courses tant qu'il
  n'a pas reversé.
- Une course dont l'encaissement ferait dépasser le plafond n'est pas proposée à ce
  livreur. Une grosse marchandise ira donc à un livreur dont l'encours est bas.
- Le livreur reverse **au plus tard 48 h** après chaque encaissement : Mobile Money vers
  le compte find_delivery, ou espèces au bureau. Un ADMIN saisit le versement et sa
  référence. Après 48 h, le compte est suspendu automatiquement jusqu'au versement.

*R6. Plafond du contre-remboursement.* **50 000 FCFA par course** au lancement, soit le
plafond d'encours (R5). Au-delà, aucun livreur ne pourrait accepter la course.

*R7. Côté Ewuang.* Ewuang répond devant find_delivery de l'argent encaissé par ses
livreurs. Leur plafond et leurs versements internes sont l'affaire d'Ewuang. Le relevé
entre les deux sociétés porte sur les missions, pas sur les livreurs.

## 4. Phases

Les quatre phases sont nécessaires au lancement (D10). La phase 4 peut avancer en
parallèle des phases 2 et 3 : elle touche surtout `ewuang-web` et `ewuang_livreur`.

### Phase 1 — Le client et la commande

Objectif : n'importe quel client peut commander une course et choisir comment elle se paie.

Terminée le 2026-10-23. Migration `20261023120000_client_generique`, appliquée sur Neon
via `pg` et inscrite dans `_prisma_migrations`.

- [x] Généraliser `Boutique` en `Client`, avec un champ `type` (`PARTICULIER`,
      `ENTREPRISE`, `BOUTIQUE`) et une raison sociale, obligatoire hors particulier
      (DTO). Le rôle `BOUTIQUE` devient `CLIENT`. Uniquement des renommages, aucune
      donnée supprimée : les 2 profils existants sont passés `BOUTIQUE`. Route
      `/clients/moi` à la place de `/boutiques/moi`.
- [x] Ajouter à `Livraison` :
  - `payeur` : `EXPEDITEUR | DESTINATAIRE`, **nullable** : `null` = réglée hors course,
    pour les 2 courses créées avant ce jour. L'API l'exige pour toute nouvelle course.
  - `montantMarchandise` : `Int`, 0 si pas de contre-remboursement. CHECK en base :
    positif, et jamais sans payeur. Plafond de 50 000 vérifié par le DTO
    (`PLAFOND_MARCHANDISE`), en attendant la table de paramètres.
  - `flotte` : **reporté en phase 2**, où se trouve le verrou d'attribution qui l'écrit.
- [x] Formulaire de l'espace client (`apps/web`) : choix du payeur (sans valeur par
      défaut) et montant de la marchandise. Le récapitulatif affiche ce qui est encaissé
      à l'enlèvement et à la remise. La fiche de course affiche le paiement.
- [x] « Espace boutique » devient « Espace client » dans le front.

Pas encore transmis à Ewuang : `payeur` et `montantMarchandise` restent chez nous. La v1
du contrat ne sait pas les porter. Ils rejoindront `chargeEwuang` avec le bloc
`paiement` de la v2 (phase 4).

### Phase 2 — La flotte find_delivery

Objectif : un indépendant reçoit les courses sur `find_delivery_mobile`, en accepte
une, la livre et encaisse.

Livrée le 2026-10-24. Migration `20261024120000_flotte_find_delivery`, appliquée sur
Neon via `pg`. Code dans `apps/api/src/livreurs/`, application dans
`../find_delivery_mobile`.

**Choix faits en cours de route** (à corriger si besoin) :
- **Dossier vérifié au bureau**, pièces en main, puis validé par un ADMIN
  (`POST /admin/livreurs/:id/valider`). Pas de dépôt de photos : find_delivery n'a pas
  de stockage de fichiers. `Document` reste inutilisé.
- **Session livreur de 12 h** (`JWT_EXPIRES_IN_LIVREUR`), au lieu de 30 min. Le statut
  du compte est relu à chaque requête : une suspension coupe l'accès sur-le-champ.
- **Code de remise = celui d'Ewuang**, déjà transmis au destinataire par le client, et
  vérifié chez nous (5 essais). Conséquence : seule une course **transmise** à Ewuang
  est proposée à la flotte find_delivery. Si Ewuang est injoignable à la création, la
  course n'a pas de code et attend d'être renvoyée. À revoir avec la v2 (le partenaire
  pourrait fournir son propre code).
- **Avant la réservation (phase 4)** : quand un livreur find_delivery accepte, la
  mission est annulée chez Ewuang. Si Ewuang refuse (colis déjà récupéré par un des
  siens) ou ne répond pas, l'acceptation est défaite. Il n'y a jamais deux livreurs
  sur une course, mais un livreur Ewuang qui avait accepté sans avoir récupéré le colis
  se le voit retirer. Une course rendue par un livreur find_delivery ne revient qu'à
  notre flotte : sa mission Ewuang est annulée.
- **Comparaison du code en JS, mais après consommation atomique de l'essai**
  (`updateMany` conditionné par `tentativesCode < 5`). Le brute-force par requêtes
  parallèles reste fermé : chaque requête prend son essai sous le verrou de ligne.

**API (`apps/api`, module `livreurs`)** :
- [x] `Livraison.flotte` : `FIND_DELIVERY | EWUANG | null`. Posé par `accepter` (notre
      flotte) ou par le webhook `mission.attribuee` (Ewuang), toujours sous la condition
      `flotte` libre. `mission.rendue` la libère. Le webhook ignore désormais une course
      de notre flotte.
- [x] Inscription : `POST /auth/register/livreur`, compte `LIVREUR` + profil `Livreur`
      (véhicule moto / voiture / camionnette, zones, téléphone).
- [x] Dossier : `Livreur.statutDossier` (EN_ATTENTE / VALIDE / REFUSE), routes ADMIN
      `GET /admin/livreurs`, `POST /admin/livreurs/:id/valider|refuser`. Aucune course
      avant VALIDE.
- [x] `GET /livreurs/courses/disponibles` : courses ouvertes et payées en espèces,
      filtrées par véhicule et zone d'enlèvement, express en tête, **sans les contacts**.
- [x] `POST /livreurs/courses/:id/accepter` : verrou `flotte IS NULL`, retrait chez
      Ewuang, acceptation défaite en cas d'échec.
- [x] Étapes : `recuperer`, `arrivee`, `livrer`, `echec` (10 min après l'arrivée),
      `retourner`, `rendre` (avant l'enlèvement). Chaque transition est conditionnée par
      l'état de départ et le livreur.
- [x] Code de remise : 5 essais, compteur consommé avant la comparaison, comparaison à
      temps constant.
- [x] Encaissement : montant **exact** exigé à l'enlèvement, à la remise et au retour (R2).
      Gain du livreur = 95 % (D6), + 500 FCFA de forfait au retour (R3).
- [x] Position pendant une course (`SuiviPosition`), état en service.
- [x] Côté client : annulation tant que le colis n'est pas récupéré, quelle que soit la
      flotte (R4) ; le statut affiché suit la flotte.

**Application `find_delivery_mobile`** :
- [x] Connexion, inscription, écran du dossier (en attente / refusé) avec actualisation.
- [x] Accueil : en service / hors service, courses en main, courses disponibles
      rafraîchies toutes les 20 s.
- [x] Fiche de course : gain, montants à encaisser par étape, appel de l'expéditeur et
      du destinataire, action de l'étape avec confirmation de l'encaissement.
- [x] Position envoyée toutes les 30 s pendant une course, écran ouvert.
- [x] Solde : espèces détenues, reste à reverser (fait avec la phase 3).

**Reporté** :
- Notifications push des nouvelles courses. Sans elles, la liste se rafraîchit toutes
  les 20 s quand l'application est ouverte.
- Écran ADMIN de validation des dossiers : seulement l'API pour l'instant (Swagger).
- Position en arrière-plan (écran éteint).
- Dépôt des pièces du dossier depuis l'application.

### Phase 3 — Le registre des espèces

Objectif : savoir à tout moment qui doit combien à qui.

Les tables `Transaction` et `Gain` existent mais ne servent pas. Elles n'ont pas de
notion de sens (débit ou crédit) ni d'idempotence. Proposition : un registre en
écritures, sur le modèle de `mouvements_solde` côté Ewuang, avec une clé d'idempotence
par course.

Exemple : course à 2 000 + 15 000 de marchandise, payée par le destinataire, faite par
un indépendant.

| Écriture | Compte | Montant |
|---|---|---|
| Espèces reçues du destinataire | livreur | −17 000 (il détient de l'argent qui n'est pas à lui) |
| Rémunération de la course | livreur | +1 900 |
| Commission | find_delivery | +100 |
| Marchandise due au client | client | +15 000 |

Le livreur doit alors **15 100** à find_delivery, qui doit **15 000** au client.

**Choix faits en cours de route (à confirmer par Franck)** :
- **« Suspension » = plus de nouvelle course**, pas le compte suspendu. Le blocage est
  calculé à chaque appel et se lève seul dès que le versement est saisi. Les courses
  en main continuent (un colis ne reste pas en route), et le livreur garde l'accès à
  son relevé pour savoir quoi verser.
- **Plafond** : bloqué dès que le solde atteint 50 000 FCFA. Une course de 50 000 de
  marchandise est donc toujours acceptable par un livreur à zéro, et le bloque ensuite.
- **48 h, premier entré premier sorti** : l'échéance part de l'encaissement le plus
  ancien qui n'est pas encore couvert par ses gains et ses versements. Verser une
  partie recule l'échéance d'autant d'encaissements que le versement en couvre.
- **Rémunération écrite à la fin de la course** (LIVREE ou RETOURNEE), pas à
  l'acceptation. Pendant une course, le livreur détient donc tout ce qu'il a encaissé.
- **Reçu papier obligatoire** pour tout règlement : son numéro est la clé
  d'idempotence. Un même reçu ne s'enregistre qu'une fois (409).
- **Pas de table de paramètres** : les plafonds, le délai et le forfait retour sont
  des constantes (`src/especes/especes.ts`, `encaissement.ts`). Une table n'a de sens
  qu'avec un écran ADMIN qui l'édite ; changer une valeur reste un déploiement.
- **Registre immuable** (trigger) : une erreur de saisie se corrige par l'écriture
  inverse (un versement de trop par un paiement au livreur, par exemple).

- [x] Registre `MouvementEspeces` (migration `20261024130000_registre_especes`) :
      écritures de l'enlèvement, de la remise et du retour posées dans la transaction
      de l'étape, clé d'idempotence par étape.
- [x] Versement d'un livreur à find_delivery et paiement d'un livreur à solde
      négatif : saisis par un ADMIN, avec un reçu, au plus le solde, sous verrou.
- [x] Reversement au client du montant de la marchandise, au plus ce qui lui est dû.
- [x] API ADMIN : encours par livreur, dû par client, journal
      (`/admin/especes/*`). **Les écrans web ADMIN restent à faire**, comme pour les
      dossiers (Swagger en attendant).
- [x] Écritures du retour (R3) : frais de l'aller encaissés, gain + forfait au livreur.
- [x] Plafond de 50 000 FCFA et délai de 48 h (R5) : plus de course proposée ni
      acceptée, motif affiché dans l'application.
- [x] Relevé du livreur dans `find_delivery_mobile` (carte de l'accueil, écran « Mes
      espèces ») ; relevé du client par l'API (`GET /clients/moi/especes`).
- [x] Afficher au client, dans l'espace web, la marchandise encaissée pour lui et
      pas encore reversée (encart en tête de « Mes courses »).
- [x] Migration `20261024130000_registre_especes` appliquée sur Neon le 2026-10-24
      (après un essai à blanc) : table vide, trigger d'immuabilité en place.
- [ ] Table de paramètres : reportée (voir ci-dessus).

### Phase 4 — Ewuang, flotte à égalité (contrat v2)

Voir le brouillon de la v2. Code écrit et vérifié le 2026-10-24 (tests, types, lint).
Schémas appliqués le 2026-10-24 (étapes 1 et 3 ci-dessous) ; **le code n'est pas
encore déployé**.

**Choix faits en cours de route (à confirmer par Franck)** :
- **`paiement.frais` ajouté au contrat** : le livreur Ewuang encaisse le prix de NOTRE
  client (2 000), pas le tarif Ewuang (1 900 depuis D11). Sans ce champ, la commission
  de find_delivery était perdue sur chaque course livrée par Ewuang.
- **Expiration d'une réservation : 10 min**, pas 2 (cron des webhooks à 1 min, relances
  à 1, 2, 4 min). Passé ce délai sans `mission.attribuee`, la course redevient libre
  pour notre flotte.
- **Arrivée signalée côté Ewuang aussi** (`POST /api/livraisons/[id]/arrivee`) : sans
  elle, la règle des 10 minutes sur place (R3) n'était pas opposable au livreur Ewuang.
- **Forfait retour par partenaire** (`partenaires.forfait_retour`, 500), figé sur la
  mission comme le tarif. Le partenaire doit `tarif + forfait` sur un retour.
- **Pas de registre d'espèces des livreurs côté Ewuang** : la v2 dit que c'est son
  affaire interne (R7). Les montants encaissés sont sur la mission
  (`encaisse_enlevement/remise/retour`) et dans les webhooks : c'est la base du relevé.

- [x] Côté find_delivery : `POST /api/v1/ewuang/reservations`, signé comme les
      webhooks, sous le verrou `sansFlotte` (src/livraisons/flotte.ts), idempotent pour
      le même livreur. Migration `20261024140000_reservation_ewuang` (une colonne).
- [x] Côté find_delivery : le bloc `paiement` (payeur, frais = notre prix, marchandise)
      part dans chaque création de mission. Un Ewuang encore en v1 l'ignore.
- [x] Côté find_delivery : webhooks `mission.echec_remise` / `mission.retournee` et
      `encaissement` lus ; statuts affichés au client.
- [x] Côté Ewuang : `accepter.ts` appelle la réservation avant le verrou (409 = prise
      ailleurs, autre réponse ou 5 s = 503, jamais d'attribution).
- [x] Côté Ewuang : bloc `paiement` à la création, montants sur la mission, montant
      exact exigé à l'enlèvement, à la remise et au retour (`update.ts`), écriture
      conditionnée par le statut de départ.
- [x] Côté Ewuang : états « Retour expéditeur » / « Retournée », motif, arrivée, 10 min,
      rémunération + forfait au retour (trigger), webhooks enrichis
      (`sql/partenaires_contrat_v2.sql`).
- [x] Côté Ewuang : `/dashboard/partenaires` → « Liaisons » : URL de webhook (elle ne
      se modifiait pas après la création : c'est pour ça que le suivi de find_delivery
      ne remontait pas), URL de réservation, forfait retour.
- [x] Côté `ewuang_livreur` : montant à encaisser dans chaque confirmation, arrivée,
      échec de remise avec motif, retour.
- [ ] Règlement périodique entre Ewuang et find_delivery (relevé) : à écrire à partir
      des missions terminées (encaissé − tarif − forfait, par mission).
- [x] Côté find_delivery : compte « Ewuang » au registre (migration
      `20261024150000_compte_ewuang`, appliquée le 2026-10-24 après un essai à blanc).
      Le webhook écrit, dans la transaction de l'événement : l'encaissement de son
      livreur (+), le coût de la course à la fin (− `tarifEwuang`, + forfait sur un
      retour), la marchandise due au client. API ADMIN : `GET /admin/especes/ewuang`,
      règlements reçus et versés contre reçu. Le solde du compte EST le relevé.

**Ordre de mise en service — à respecter, chaque étape casse si la précédente manque** :
1. ✅ Neon : migrations `20261024130000_registre_especes` puis
   `20261024140000_reservation_ewuang`, puis `20261024150000_compte_ewuang`
   (toutes appliquées le 2026-10-24).
2. Déployer l'API find_delivery (le bloc `paiement` est ignoré par Ewuang v1).
3. ✅ Supabase : `ewuang-web/sql/partenaires_contrat_v2.sql` (appliqué le 2026-10-24).
   Additif : le code d'Ewuang actuellement en ligne continue de fonctionner.
4. Déployer ewuang-web.
5. `/dashboard/partenaires` → find_delivery → Liaisons : URL de webhook et URL de
   réservation de l'API find_delivery.
6. Publier `ewuang_livreur` (l'ancienne version ne montre pas le montant à encaisser :
   le serveur refuse alors l'étape, sans perte d'argent).
- [x] Aligner la grille `partenaire_tarifs` de find_delivery chez Ewuang (D11) :
      `tarif_partenaire` = `remuneration_livreur` pour les 9 lignes. Appliqué le
      2026-10-24 (`ewuang-web/sql/partenaire_tarifs_find_delivery_sans_marge.sql`).
- [ ] Échec de remise et retour à l'expéditeur côté Ewuang (nouvel état du contrat).

## 5. Ce qui n'est pas dans ce plan

- Le paiement en ligne (Mobile Money, carte). Le cash d'abord (D2).
- Les applications de livreurs tierces (D9). L'API de la phase 2 est écrite pour
  `find_delivery_mobile`. L'ouvrir à des tiers demandera des clés d'API et des scopes,
  comme côté Ewuang.
- L'envoi du code de remise par SMS au destinataire. Le client le transmet lui-même,
  comme aujourd'hui.
