# RAMURE v2 — série de PRP

Neuf PRP, un par étape. Chaque étape produit un livrable démontrable seul et se
termine par une stack qui tient debout. Cette page porte ce qui est **commun aux
neuf** : les contraintes, les décisions tranchées, l'ordre d'exécution et la
couverture du PRD. Chaque PRP s'y réfère plutôt que de la recopier.

**Source :** `docs/PRD-RAMURE.md` — RAMURE, Product Requirements Document v1.0,
30 juillet 2026. Périmètre retenu : **lots MVP et V1**, soit 35 exigences.

## Les neuf étapes

| # | PRP | Livrable démontrable | Exigences |
|---|---|---|---|
| 01 | [Socle déployable](01-socle.md) | l'app répond sur son URL, image publiée, CI verte | contrat fabrique |
| 02 | [Noyau d'appels](02-noyau-appels.md) | cache mutualisé, budget borné, noms stricts | N-03 à N-05, N-07, §09 |
| 03 | [Sources de données](03-sources.md) | les quatre rôles pourvus, cascade de repli | §09, F-20, F-22, F-25, F-26 |
| 04 | [L'arbre](04-arbre.md) | `/api/centre` complet, vide et panne distingués | F-08, F-15, F-16, F-36 à F-39 |
| 05 | [Le canevas](05-canevas.md) | l'arbre s'affiche et se parcourt — **le MVP se voit** | F-09 à F-14, F-17 |
| 06 | [Les écrans](06-ecrans.md) | accueil, recherche, fiche, discographie, lecteur | F-01 à F-07, F-19, F-21, F-24, F-34 |
| 07 | [Identité et collection](07-identite-collection.md) | garder, replanter, cloisonner | F-28 à F-33, N-08 à N-10 |
| 08 | [Parité et accessibilité](08-parite-accessibilite.md) | WCAG 2.2 AA, installation, mise à jour | §07, §12, N-11, N-12, F-41, F-42 |
| 09 | [Recette et mise en ligne](09-recette-mise-en-ligne.md) | bout en bout sur réseau simulé, app en ligne | §13 |

**Ordre :** strictement séquentiel de 01 à 09. Chaque PRP déclare en tête ce
qu'il consomme des précédents, avec les signatures exactes.

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
  variables sont déclarés, dans le `README` de l'app.
- **Logs sur la sortie standard.** Démarrage sans intervention.
- **Port 8080, santé `/healthz`.** Tests dans `apps/ramure-v2/test.sh`.
- **Ne jamais éditer à la main** `compose.yaml`, `.github/`, `.claude/`,
  `go.work` — artefacts régénérés par `./init.sh`.
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

Go 1.23, TypeScript 5 compilé par `esbuild`, `vitest` côté client, `go test`
côté serveur, Playwright pour le bout en bout. Image finale sur `alpine` —
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

## Ce qui relève du serveur et sort de ce dépôt

**F-32 (collection multi-appareils) et F-33 (réconciliation) exigent un stockage
qui survit au redéploiement.** Le contrat est explicite : une base de données ou
un volume persistant est une décision d'infrastructure, prise côté serveur.

La série **ne l'invente pas**. Le PRP 07 :

1. conçoit la persistance derrière une interface `CollectionStore` ;
2. livre `MemoryStore` (par défaut, volatile, avertissement au démarrage) et
   `FileStore` (activée par `RAMURE_DATA_DIR` si fournie) ;
3. **écrit la demande dans `apps/ramure-v2/README.md` et s'arrête là**.

Tant que le volume n'est pas accordé, F-32 est **dégradé, pas cassé** : la
collection reste utilisable localement côté client (F-33), ce que le lot MVP
autorise déjà.

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

**Non résolu dans ce dépôt :** F-32 et F-33 sont implémentés et testés, mais leur
persistance dépend d'un volume qui relève du serveur.
