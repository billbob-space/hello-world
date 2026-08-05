# RAMURE v2 — série de PRP

Neuf PRP, un par étape. Chaque étape produit un livrable démontrable seul et se
termine par une stack qui tient debout. Cette page porte ce qui est **commun aux
neuf** : les contraintes, les décisions tranchées, l'ordre d'exécution et la
couverture du PRD. Chaque PRP s'y réfère plutôt que de la recopier.

**Source :** [`../PRODUCT.md`](../PRODUCT.md) — RAMURE, Product Requirements Document
v1.0, 30 juillet 2026. Périmètre retenu : **lots MVP et V1**, soit 35 exigences.

## Les neuf étapes

Les neuf sont écrites. **Leur densité n'est pas la même**, et c'est délibéré :
01 et 02 portent le code d'implémentation *in extenso*, parce qu'ils ont été
rédigés étape par étape ; 03 à 09 portent les signatures figées, les requêtes
exactes vérifiées en direct, les tests à écrire et les pièges — le code s'écrit
à l'exécution. Un PRP se développe au moment où il devient le prochain, pas
avant.

| # | PRP | Livrable démontrable | Exigences |
|---|---|---|---|
| 01 | [Socle déployable](01-socle.md) | image publiée sur GHCR, CI verte — **pas encore branchée** : `enabled: false`, aucune réponse sur l'URL | contrat fabrique |
| 02 | [Noyau d'appels](02-noyau-appels.md) | cache mutualisé, budget borné, noms stricts | N-03 à N-05, N-07, §09 |
| 03 | [Les quatre rôles de données](03-sources.md) | les quatre rôles pourvus, cascade de repli | §09, F-20, F-22, F-25, F-26 |
| 04 | [L'arbre, et la première route](04-arbre.md) | `/api/centre` complet, vide et panne distingués | F-08, F-15, F-16, F-36 à F-39 |
| 05 | [Le canevas](05-canevas.md) | l'arbre s'affiche et se parcourt — **le MVP se voit** | F-09 à F-14, F-17 |
| 06 | [Les écrans autour du canevas](06-ecrans.md) | accueil, recherche, fiche, discographie, lecteur | F-01 à F-07, F-19, F-21, F-24, F-34 |
| 07 | [Identité et collection](07-identite-collection.md) | garder, replanter, cloisonner | F-28 à F-33, N-08 à N-10 |
| 08 | [Parité et accessibilité](08-parite-accessibilite.md) | WCAG 2.2 AA, installation, mise à jour | §07, §12, N-11, N-12, F-41, F-42 |
| 09 | [Recette et mise en ligne](09-recette-mise-en-ligne.md) | bout en bout sur réseau simulé, **branchement** (`enabled: true`) et app en ligne | §13 |

**Ordre :** strictement séquentiel de 01 à 09. Chaque PRP déclare en tête ce
qu'il consomme des précédents, avec les signatures exactes.

**Le branchement est la dernière tâche du PRP 09**, jamais avant : l'app naît
`enabled: false` et n'entre dans `compose.yaml` qu'une fois son image publiée.
Aucune étape antérieure ne rend `ramure-v2.apps.billbob.ovh` joignable.

---

## Contraintes globales

Imposées par le contrat de la fabrique (`CLAUDE.md`) et par le PRD. Les
enfreindre ne produit pas une erreur claire mais un déploiement qui échoue en
silence. **Elles s'appliquent aux neuf PRP sans être répétées dans chacun.**

- **Nom de l'app : `ramure-v2`** — donc le sous-domaine, le nom de conteneur et
  le nom de routeur Traefik. `ramure-v2.apps.billbob.ovh`.
- **`exposure: google`** — n'importe quel compte Google authentifié entre. Le
  cloisonnement des données par utilisateur n'est donc **pas optionnel**.
- **Identité : `X-Forwarded-User` uniquement** (N-08). Jamais un paramètre
  d'URL, un corps de requête ou un cookie applicatif.
- **Aucun système de comptes à coder** — Traefik authentifie avant l'app.
- **Image finale < 200 Mo**, multi-étages, contexte de construction
  `apps/ramure-v2` — jamais la racine.
- **`USER` non root**, aucune section `ports:`, aucun `LABEL traefik.*`.
- **Aucun secret dans le dépôt ni dans l'image** — seuls les *noms* des
  variables sont déclarés, dans `env:` de l'`app.yml` et dans le `README` de l'app.
- **Persistance : volume nommé `donnees:/var/lib/ramure`**, déclaré dans
  `app.yml` **dès le PRP 01** ; `RAMURE_DATA_DIR` est fixée par le `Dockerfile`,
  qui crée et `chown` ce chemin avant `USER`.
- **Logs sur la sortie standard.** Démarrage sans intervention.
- **Port 8080, santé `/healthz`.** Tests dans `apps/ramure-v2/test.sh`.
- **Ne jamais éditer à la main** `compose.yaml` et `go.work` — ce sont les deux
  seuls artefacts que `./init.sh` réécrit toujours. Le workflow de CI et
  `.claude/` sont, eux, des **fichiers ordinaires** : on les édite directement,
  et `--check` y vérifie des propriétés, pas l'égalité à un générateur. Le
  workflow **ne cite aucune app** : il les découvre à chaque run en cherchant
  les `apps/*/app.yml`.
- **Vocabulaire contractuel du PRD §05** — *graine, centre, branche, héritier,
  affinité, vivier, promotion, lignée, rebattre, collection, palmarès* — employé
  tel quel dans le code, les tests et l'interface.
- **Parité stricte des dispositions** — étroit et large au même niveau
  d'exigence dès le MVP ; les deux variantes d'un contrôle ne coexistent jamais.
- **WCAG 2.2 AA sans exception** sur l'écran principal.
- **Aucun état d'échec mis en cache** (N-05, §09).
- **Correspondance stricte des noms** (§09) — à défaut d'exact, renvoyer vide.
- **Budget d'appels** (N-03) — profondeur maximale au centre, strict minimum sur
  l'entourage. MusicBrainz et Cover Art Archive ne sont **jamais** appelés pour
  une branche ou un héritier.

**Convention de commit :** français, impératif, préfixé du nom de l'app —
`ramure-v2 : <ce que ça fait>`.

---

## Décisions tranchées

Le PRD §17 délègue ces choix à l'équipe de réalisation. Ils sont tranchés ici et
ne sont plus à rediscuter en cours d'exécution.

### Pile technique

Un binaire Go unique sert les fichiers statiques (embarqués par `embed.FS`) et
une API JSON sous `/api`. Toutes les sources externes sont appelées **depuis le
serveur uniquement** (§09). Le client est du TypeScript sans cadre applicatif,
rendant le canevas en **SVG dans le DOM** — c'est ce qui rend l'accessibilité au
clavier et au lecteur d'écran atteignable (§12), là où un `<canvas>` la rendrait
presque impossible.

Go 1.24 — la version des cinq autres apps du dépôt et de `go.work` —,
TypeScript 5 compilé par `esbuild`, `vitest` côté client, `go test` côté
serveur, Playwright pour le bout en bout. Image finale sur `alpine` —
et non `scratch`, qui priverait le `health_cmd` de `wget`.

### Fournisseurs par rôle de données (§09)

Tous vérifiés en direct le 3 août 2026.

| Rôle | Retenu | Repli | Pourquoi |
|---|---|---|---|
| **1 · Proximité** | **Last.fm** `artist.getSimilar` | **ListenBrainz** `labs.api.listenbrainz.org` | Last.fm renvoie un `match` **déjà normalisé 0–1**, exactement l'affinité du PRD. ListenBrainz couvre le risque §14 « source unique » : sans clé, donc disponible même si `LASTFM_API_KEY` manque. Son `score` est un **entier brut à normaliser**. |
| **2 · Catalogue** | **MusicBrainz** `/ws/2/` | — | Seule source résolvant un nom vers un **MBID non ambigu**, critère décisif du PRD. |
| **2bis · Illustrations, extraits** | **Deezer** + **Cover Art Archive** | repli graphique déterministe | Deezer sert sans authentification les images en quatre tailles, `nb_fan` (audience) et un `preview` mp3 de 30 s par titre. |
| **3 · Appréciation** | **MusicBrainz** `inc=ratings` | ordre d'origine stable | **Zéro appel supplémentaire** : le même `browse` renvoie la discographie, `rating: {value, votes-count}` *et* `primary-type`/`secondary-types`. Une requête couvre F-20, F-21 et F-22. |
| **4 · Liens d'écoute** | **Odesli** `api.song.link` | **recherche pré-remplie, obligatoire** | Fonctionne sans clé, mais **sa limite de débit n'est pas documentée publiquement** — vérifié, non trouvé. Meilleur-effort strict. |

### Budget d'appels par promotion (N-03 · critique)

| Source | Débit toléré | Appelée pour | Appels |
|---|---|---|---|
| MusicBrainz | **1/s** — la plus contrainte | **le centre uniquement** | 2 |
| Cover Art Archive | ~1/s par prudence | **le centre uniquement** | 1 |
| Last.fm | ~5/s | centre + héritiers | 2, puis 1/branche **différé** |
| Deezer | généreux | centre + branches | 1 + 1/branche |
| Odesli | inconnue | à la demande, sur clic | 0 au chargement |

**Invariant testable :** aucun appel MusicBrainz ni Cover Art Archive ne part
pour une branche ou un héritier. La règle est portée par le **type**
(`budget.ErrPorteeInterdite`, PRP 02), pas par la discipline des appelants.

**Seuil de bascule de N-13 :** la contrainte dure est MusicBrainz, 1 appel par
seconde et par adresse IP, partagée par tous les utilisateurs puisqu'ils sortent
par le serveur. Le seuil est donc ≈ **1 nouveau centre non caché par seconde**,
soit, à 80 % de taux de service par le cache, environ **5 promotions par seconde**
tous utilisateurs confondus. Au-delà : miroir MusicBrainz ou contrat. À réviser
dès la première mesure du taux de service.

### Réponses aux questions ouvertes du PRD §17

1. **Mobile ou desktop ?** → **Parité stricte**, décision du commanditaire.
   Conséquence : les paramètres de cadrage §05 sont **fonction de la largeur** —
   10 branches et 3 héritiers sur écran large, 6 branches et 2 héritiers sur
   écran étroit, pour tenir la lisibilité (§11) et les cibles tactiles (§12).
2. **Faut-il un compte pour explorer ?** → **Sans objet.** Traefik impose une
   authentification Google *avant* l'application ; il n'existe pas de palier
   public dans la fabrique. Tout visiteur est authentifié et `X-Forwarded-User`
   est disponible dès la première requête. L'accès invité en lecture seule
   évoqué par le PRD n'est pas réalisable — et pas nécessaire.
3. **La session est-elle jetable ?** → **Oui pour ce périmètre.** F-18 est en
   lot V2, hors périmètre. La lignée vit en mémoire et dans l'URL.
4. **Quel volume est visé ?** → chiffré ci-dessus (N-13).
5. **Francophone ou international ?** → **Francophone.** Le vocabulaire §05 est
   idiomatique et contractuel. Les chaînes restent centralisées dans
   `web/src/textes.ts` pour ne pas fermer la porte.

---

## La persistance : déclarée dans le dépôt, dès le PRP 01

**F-32 (collection multi-appareils) et F-33 (réconciliation) exigent un stockage
qui survit au redéploiement.** Ce n'est plus une décision d'infrastructure à
demander : le contrat l'a fait entrer dans les manifestes. Un **volume nommé** se
déclare dans `apps/ramure-v2/app.yml`, `./init.sh` l'écrit dans `compose.yaml`,
et `docker compose up` le crée — aucune action sur l'hôte, pour personne, jamais.

Ce que la série en fait :

1. **PRP 01** — `volumes: [donnees:/var/lib/ramure]` et `env: [LASTFM_API_KEY]`
   entrent dans `app.yml` dès l'échafaudage, et le `Dockerfile` crée
   `/var/lib/ramure`, le `chown` **avant** `USER` et pose
   `ENV RAMURE_DATA_DIR=/var/lib/ramure`. Le chemin persistant existe donc, et
   appartient à l'app, avant la première ligne de code qui écrit. Sans ce
   `chown`, le volume vide reçoit le répertoire tel qu'il est dans l'image —
   propriétaire compris — l'app non-root ne peut pas y écrire, et le symptôme
   est « elle démarre et perd tout ».
2. **PRP 07** — la persistance vit derrière l'interface `CollectionStore`.
   **`FileStore` est le régime nominal** : il est choisi dès que
   `RAMURE_DATA_DIR` est définie, ce que le `Dockerfile` garantit en conteneur —
   donc en production, toujours. **`MemoryStore` est le repli de développement
   hors conteneur** (`go run .` sans volume) : volatile, et annoncé au démarrage.

F-32 et F-33 ne sont donc **ni dégradés ni en attente** : leur persistance est
tenue par le déploiement lui-même. Le cloisonnement par `X-Forwarded-User` reste
la contrainte qui les gouverne, le palier étant `google`.

---

## Couverture des exigences

| Lot | Exigences | PRP |
|---|---|---|
| **MVP** | F-01, F-02, F-04, F-05, F-07 | 06 |
| | F-08 | 04 |
| | F-09, F-10, F-11, F-12, F-13, F-14, F-17 | 05 |
| | F-19, F-20 | 03, 06 |
| | F-28, F-31 | 07 |
| | F-36, F-37, F-38, F-39 | 04, 05 |
| | N-01, N-02 | 04, 05 |
| | N-03 | 02, 04 |
| | N-04, N-05, N-07 | 02 |
| | N-06 | 03 |
| | N-09 | 07 |
| | N-13 | décisions ci-dessus |
| **V1** | F-03 | 02, 06 |
| | F-06 | 06 |
| | F-15, F-16 | 04 |
| | F-21, F-22 | 03, 06 |
| | F-24, F-40 | 03, 06 |
| | F-25, F-26 | 03 |
| | F-29, F-30, F-32, F-33 | 07 |
| | F-34 | 06 |
| | F-41, F-42 | 08 |
| | N-08 | 07 |
| | N-10 | 07 |
| | N-11, N-12 | 08 |
| **Transverse** | §12 accessibilité, M-08 | 08 |
| | §13 recette | 09 |

**Hors périmètre — lot V2 :** F-18 (reprise de la lignée), F-23 (signal de
nouveauté), F-27 (palmarès de l'arbre), F-35 (export de la collection), filtres
complémentaires sur les branches.

**Rien n'est laissé en attente du serveur :** F-32 et F-33 sont implémentés,
testés, et leur persistance tient au volume nommé déclaré dans `app.yml` dès le
PRP 01.

---

## Ce qui ne se vérifie pas depuis une session cloud

Une session sur `claude.ai/code` **n'a pas de démon Docker** : le binaire est là,
le service ne tourne pas. Sept vérifications de la série en dépendent, et aucune
ne peut être déclarée faite depuis une telle session. Les ignorer en silence
serait pire que la limite elle-même — voici où chacune se rattrape.

| Ce qui se vérifie avec Docker | PRP | Ce qui le remplace |
|---|---|---|
| taille de l'image sous 200 Mo | 01, 05 | le job `build` de la CI mesure et affiche la taille, mais **n'émet qu'un avertissement** au-delà — rien ne bloque |
| aucun `LABEL traefik.*`, hérité compris | 01 | le job `build` **bloque** : c'est le seul endroit où un label hérité d'une image de base se voit |
| l'app tourne bien sous l'uid 10001 | 01 | `--check` lit la directive `USER` du `Dockerfile` — il voit la déclaration, pas l'effet |
| `wget` présent dans l'image finale | 01 | rien : à faire sur un poste avec Docker, sinon le `health_cmd` échouera en production |
| conteneur sain, arrêt propre sur `SIGTERM` | 01 | rien : le symptôme, dix secondes de plus à chaque redéploiement de **toute** la stack |
| le volume appartient bien à l'app | 07 | `--check` vérifie qu'un `chown` du chemin existe dans le `Dockerfile`, avant `USER` |
| la collection survit à un redémarrage | 07 | reporté au PRP 09, après la mise en ligne — la preuve devient un artiste gardé qui survit à un déploiement |

Deux remarques qui vont avec :

- **Même avec un démon**, `docker build` échoue dans cet environnement sur
  `x509: certificate signed by unknown authority` : les sorties HTTPS passent
  par un proxy qui re-signe le trafic, et le conteneur n'en hérite pas. La
  parade — construire depuis un `Dockerfile` hors dépôt qui embarque l'autorité
  locale — est décrite dans `memory/outillage.md`. **Jamais dans le `Dockerfile`
  committé**, dont aucune ligne ne doit dépendre d'un environnement.
- **Le bout en bout (PRP 09) ne tournera pas non plus en CI** : il est derrière
  `RAMURE_E2E`, que personne n'y définit. C'est une recette qu'on joue à la
  main, pas un filet permanent.

---

## Provenance

Cette série remplace un plan monolithique unique de 2282 lignes
(`docs/superpowers/plans/2026-08-03-ramure-v2.md`, écrit le 3 août 2026 et
supprimé le 5), qui couvrait le même périmètre sans jamais renvoyer à la série
ni la série à lui. Deux plans concurrents pour une app qui n'a pas encore une
ligne de code : le contenu qui comptait est ici.

**Les PRP 03 à 09 en sont issus.** Au moment de la suppression, la série ne
couvrait que les tâches 1 à 4 du plan ; ses vingt et une autres tâches — les
sources, l'arbre, le canevas, les écrans, la collection, l'accessibilité, la
recette et le branchement — ne vivaient plus que dans l'historique git. Elles
ont été relues depuis `git show 7de0c51^:docs/superpowers/plans/2026-08-03-ramure-v2.md`
et redistribuées sur les sept PRP manquants, en suivant la répartition annoncée
par le tableau ci-dessus.

**Trois divergences ont été tranchées pendant cette reprise**, parce que le plan
d'origine ne pouvait pas les voir — il précédait l'écriture détaillée des PRP 01
et 02 :

1. **Toute méthode de source prend `p budget.Portee`.** Le plan décrivait des
   signatures sans portée, mais des tests qui l'exigeaient. Le PRP 02 ayant
   figé « la portée vient du site d'appel, jamais d'une valeur par défaut »,
   c'est la signature qui a été corrigée (PRP 03).
2. **La cascade de proximité prend un `Artiste`, pas un nom.** Last.fm
   interroge par nom, ListenBrainz **exige un MBID** : une interface qui ne
   transportait que le nom rendait le repli — donc la mitigation du risque §14 —
   inutilisable (PRP 03).
3. **`routes()` s'élargit en `Routes(d arbre.Dependances) http.Handler`.** Le
   PRP 01 laissait ce choix au premier PRP qui greffe une route ayant besoin de
   sources ; c'est le PRP 04, et il tranche pour tous.

**Quatre affirmations périmées ont été corrigées ensuite**, la fabrique ayant
changé sous les PRP 01 et 02 : le workflow de CI ne cite plus aucune app — le
contrôle d'échafaudage qui y cherchait le nom de l'app aurait échoué sur un
dépôt sain ; le workflow et `.claude/` ne sont plus des artefacts générés ;
le langage passe de 1.23 à **1.24**, version du reste du dépôt ; et le plafond
de 200 Mo n'est qu'un avertissement en CI, jamais un refus.
