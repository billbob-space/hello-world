# PRP 03 — Les quatre rôles de données

> **Ce PRP livre** les six adaptateurs qui pourvoient les quatre rôles de la §09
> du PRD, et la cascade de repli qui couvre le risque §14 « source unique de
> proximité » : MusicBrainz (rôles 2 et 3), Cover Art Archive (illustration du
> centre), Last.fm (rôle 1), ListenBrainz (rôle 1 de repli), Deezer
> (illustrations, audience, extraits) et Odesli (rôle 4, liens d'écoute).
> À la fin de l'étape, **aucune route HTTP n'existe encore** : ce PRP ne produit
> que des paquets appelables, tous testés contre `httptest.NewServer`.
>
> **Ce PRP consomme** — du PRP 02 uniquement, avec les signatures figées par
> [sa section finale](02-noyau-appels.md) :
>
> ```go
> cache.Neuf(horloge func() time.Time) *Cache
> (*cache.Cache).Obtenir(cle string, ttl time.Duration, charger func() ([]byte, error)) ([]byte, error)
> budget.Neuf() *Limiteur
> (*budget.Limiteur).Attendre(ctx context.Context, s budget.Source, p budget.Portee) error
> (*budget.Limiteur).Compte(s budget.Source) int64
> budget.ErrPorteeInterdite
> source.Normaliser(s string) string
> source.CorrespondanceStricte[T any](demande string, candidats []T, nom func(T) string) (T, bool)
> ```
>
> Du PRP 01 : le module Go et `apps/ramure-v2/test.sh`. **`main.go` n'est pas
> modifié par ce PRP** — le câblage des sources appartient au PRP 04, qui
> introduit le premier consommateur.
>
> **Ce PRP produit** — un seul paquet, `internal/source`, où chaque fichier porte
> un fournisseur :
>
> ```go
> package source // apps/ramure-v2/internal/source
>
> // types partagés — source.go
> type Artiste struct{ MBID, Nom, Pays, Desambiguisation string }
> type Voisin struct{ Nom, MBID string; Affinite float64 }
> type Profil struct{ Presentation string; Genres []string; Auditeurs int }
> type Illustration struct{ Petite, Moyenne, Grande string }
> type Album struct{ MBID, Titre, Sortie string; Type TypeSortie; Note float64; Votes int }
> type Extrait struct{ Titre, URL string; Duree int }
> var ErrIntrouvable = errors.New("introuvable")
>
> type Proximite interface {
>     Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error)
> }
> type Cascade struct{ Sources []Proximite }
>
> // musicbrainz.go — rôles 2 et 3, plus Cover Art Archive
> func NouveauMusicBrainz(c *cache.Cache, l *budget.Limiteur, client *http.Client, userAgent string) *MusicBrainz
> func (m *MusicBrainz) Resoudre(ctx context.Context, nom string, p budget.Portee) (Artiste, error)
> func (m *MusicBrainz) Discographie(ctx context.Context, mbid string, p budget.Portee) ([]Album, error)
> func (m *MusicBrainz) Pochette(ctx context.Context, releaseGroupMBID string, p budget.Portee) (string, error)
> func ClasserTypeSortie(primaire string, secondaires []string) TypeSortie
>
> // lastfm.go — rôle 1
> func NouveauLastFM(cle string, c *cache.Cache, l *budget.Limiteur, client *http.Client) *LastFM
> func (l *LastFM) Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error)
> func (l *LastFM) Profil(ctx context.Context, nom string, p budget.Portee) (Profil, error)
> var ErrCleAbsente = errors.New("LASTFM_API_KEY absente")
>
> // listenbrainz.go — rôle 1 de repli
> func NouveauListenBrainz(c *cache.Cache, l *budget.Limiteur, client *http.Client) *ListenBrainz
> func (b *ListenBrainz) Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error)
>
> // deezer.go — illustrations, audience, extraits
> func NouveauDeezer(c *cache.Cache, l *budget.Limiteur, client *http.Client) *Deezer
> func (d *Deezer) Chercher(ctx context.Context, nom string, p budget.Portee) (FicheDeezer, error)
> func (d *Deezer) Extraits(ctx context.Context, id int64, p budget.Portee) ([]Extrait, error)
>
> // odesli.go — rôle 4
> func NouveauOdesli(c *cache.Cache, l *budget.Limiteur, client *http.Client) *Odesli
> func (o *Odesli) LienEcoute(ctx context.Context, s Service, artiste, album, urlDeezer string) string
> func RecherchePreRemplie(s Service, requete string) string
> ```
>
> Les contraintes globales (nom de l'app, palier, image, vocabulaire §05,
> convention de commit) sont posées dans [le README de la série](README.md).

**Six tâches**, séquentielles : 1 → 2 (MusicBrainz), puis 3 → 4 (rôle 1 et sa
cascade), puis 5 et 6, indépendantes l'une de l'autre. Chacune finit par un
commit.

---

## Trois règles qui valent pour les six adaptateurs

Elles découlent des six conventions figées par le PRP 02 et ne sont pas répétées
tâche par tâche. Les enfreindre ne casse aucun test de l'adaptateur concerné :
ça casse N-03 ou N-05 trois PRP plus loin.

**1 · Le cache transporte des octets, la validation vient avant lui.** `Obtenir`
ne connaît pas la sémantique de ce qu'il mémorise. La fonction `charger` passée
en argument doit donc **échouer** — et ne rien renvoyer — sur tout ce qui n'est
pas une réponse exploitable : code HTTP différent de 200, corps illisible, JSON
qui ne se décode pas. Décoder *après* `Obtenir` et mémoriser avant est la faute
qui condamne un artiste jusqu'au redémarrage (N-05, F-37).

**2 · La portée est un argument, jamais une valeur par défaut.** Toute méthode
qui consomme du budget prend `p budget.Portee` et le transmet tel quel à
`Attendre`. Un adaptateur qui code `budget.Centre` en dur rend
`ErrPorteeInterdite` inatteignable et vide N-03 de son sens — c'est
explicitement ce que le PRP 04 testera en comptant les appels.

**3 · Clés de cache et durées de vie.** Forme
`"<source>:<role>:<nom normalisé ou mbid>"`, le nom toujours passé par
`source.Normaliser` — sans quoi `Sigur Rós` et `Sigur Ros` paient deux fois.
Durées retenues : résolution d'artiste et discographie **30 jours**, vivier et
profil **7 jours**, illustrations **30 jours**, liens d'écoute **24 heures**.

---

### Tâche 1 : MusicBrainz — résoudre un nom vers un MBID non ambigu

C'est le rôle 2 du PRD, et le PRD en fait *« le critère décisif »* : une source
qui ne sait chercher que par mots-clés produit des discographies polluées
d'homonymes.

**Fichiers :**
- Créer : `apps/ramure-v2/internal/source/source.go` (types partagés,
  `ErrIntrouvable`)
- Créer : `apps/ramure-v2/internal/source/musicbrainz.go`
- Test : `apps/ramure-v2/internal/source/musicbrainz_test.go`

**Interfaces :**
- Consomme : `cache`, `budget`, `Normaliser`, `CorrespondanceStricte`.
- Produit : `Artiste`, `ErrIntrouvable`, `NouveauMusicBrainz`, `Resoudre`.

**Points de vigilance, vérifiés en direct le 3 août 2026 :**

- `GET https://musicbrainz.org/ws/2/artist?query=artist:"<nom>"&limit=5&fmt=json`
  renvoie `{"artists":[{"id":"…","name":"Portishead","score":100,…}]}`.
- **L'en-tête `User-Agent` est obligatoire** et doit identifier l'application et
  un contact : `ramure-v2/1.0 ( https://ramure-v2.apps.billbob.ovh )`. Sans lui,
  MusicBrainz bloque l'adresse IP — et l'adresse est partagée par tous les
  utilisateurs, puisqu'ils sortent par le serveur.
- La portée passée par les appelants sera **toujours** `budget.Centre` ; c'est le
  limiteur qui le fait respecter, pas l'adaptateur.
- **Le `score` de MusicBrainz ne suffit pas** : il vaut 100 pour un candidat
  approchant. Le résultat passe par `CorrespondanceStricte` sur `name`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Tous contre `httptest.NewServer`, jamais contre la vraie source (§13).

1. `TestResoudreRenvoieLeMBIDSurCorrespondanceExacte` — réponse simulée contenant
   `Portishead`, attendu le MBID de la réponse.
2. `TestResoudreRefuseUnCandidatApprochant` — la réponse ne contient que
   `Kate Bush` pour une demande `Bush` : attendu `ErrIntrouvable`.
3. `TestResoudreEnvoieUnUserAgent` — le serveur simulé vérifie que l'en-tête est
   non vide et contient `ramure-v2`.
4. `TestResoudreRefuseLaPorteeEntourage` — un appel avec `budget.Entourage`
   renvoie `budget.ErrPorteeInterdite`, et **aucune requête n'atteint le serveur
   simulé** (compteur à zéro).
5. `TestResoudreNeMetPasEnCacheUne500` — deux appels, le premier renvoyant 500,
   le second 200 : le second doit réussir.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -run Resoudre -v
```

Attendu : ÉCHEC de compilation — `undefined: NouveauMusicBrainz`,
`undefined: Artiste`, `undefined: ErrIntrouvable`.

- [ ] **Étape 3 : implémenter**

L'adresse de base est un champ de la structure, pas une constante : c'est ce qui
permet aux tests de la pointer vers `httptest.NewServer`. Ordre imposé dans
`Resoudre` : `Attendre(ctx, budget.MusicBrainz, p)` **avant** toute requête,
puis `Obtenir` avec la clé `"musicbrainz:artiste:<nom normalisé>"` et 30 jours,
puis décodage, puis `CorrespondanceStricte`.

- [ ] **Étape 4 : vérifier au vert, puis committer**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test -race -count=1 ./internal/source/
git commit -m "ramure-v2 : resolution MusicBrainz par MBID, stricte"
```

---

### Tâche 2 : MusicBrainz — discographie, notes, types, et la pochette du centre

Couvre F-20, F-21 et F-22 **en un seul appel** : c'est le cœur de l'économie de
budget décrite par le README de la série. Le même `browse` renvoie la
discographie, `rating` et `primary-type`/`secondary-types`.

**Fichiers :** modifier `internal/source/musicbrainz.go`, test
`internal/source/musicbrainz_discographie_test.go`.

**Interfaces — produit :**

```go
type TypeSortie string
const (
    Studio      TypeSortie = "studio"
    Live        TypeSortie = "live"
    Compilation TypeSortie = "compilation"
    FormatCourt TypeSortie = "format-court"
)
const MinVotes = 5
func (m *MusicBrainz) Discographie(ctx context.Context, mbid string, p budget.Portee) ([]Album, error)
func (m *MusicBrainz) Pochette(ctx context.Context, releaseGroupMBID string, p budget.Portee) (string, error)
func ClasserTypeSortie(primaire string, secondaires []string) TypeSortie
```

**Requête exacte :**
`GET /ws/2/release-group?artist=<MBID>&limit=100&inc=ratings&fmt=json`

Réponse vérifiée le 3 août 2026 :

```json
{"release-groups":[{"title":"OK Computer",
  "rating":{"votes-count":87,"value":4.55},
  "primary-type":"Album","secondary-types":[],
  "first-release-date":"1997-05-21","id":"b1392450-…"}]}
```

**Règle de classification** — F-22 exige qu'un album relève d'**un seul** type ;
les types secondaires priment sur le type primaire :

| Condition | `TypeSortie` |
|---|---|
| `secondary-types` contient `Live` | `live` |
| `secondary-types` contient `Compilation` | `compilation` |
| `primary-type` vaut `Single` ou `EP` | `format-court` |
| `primary-type` vaut `Album` | `studio` |
| tout le reste | `studio` |

**Pochette du centre.** Cover Art Archive s'adresse par MBID de *release-group* :
l'appel n'a de sens qu'ici, après la discographie, sur l'album le mieux noté.
`GET https://coverartarchive.org/release-group/<MBID>/front-500`.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestDiscographieRattacheeAuMBIDDemande` — aucun album d'un homonyme.
2. `TestClassementParTypeUnSeulType` — table des cinq cas ci-dessus ; un album
   `primary-type: Album` + `secondary-types: [Live]` est `live`, jamais les deux.
3. `TestAlbumSansNoteConserveUnOrdreStable` — deux albums sans `rating` gardent
   l'ordre de la source entre deux appels (F-21, mitigation §14).
4. `TestSeuilDeVotesEcarteLesNotesNonSignificatives` — une note à 2 votes est
   ignorée pour le classement, seuil `MinVotes = 5`.
5. `TestUnAppelUnique` — `budget.Compte(MusicBrainz)` vaut 1 après un appel à
   `Discographie`.
6. `TestPochetteRefuseLaPorteeEntourage` — `budget.ErrPorteeInterdite`. C'est ce
   qui garde le budget N-03 tenable.
7. `TestPochetteAbsenteNEstPasUnePanne` — un 404 de Cover Art Archive renvoie une
   **chaîne vide sans erreur** : le repli graphique déterministe du PRP 05 prend
   le relais, et rien ne se décale (§11).

- [ ] **Étapes 2 à 4 : rouge, implémenter, vert, committer**

```bash
git commit -m "ramure-v2 : discographie, notes, types et pochette du centre"
```

---

### Tâche 3 : Last.fm — le rôle 1, une affinité déjà normalisée

**Fichiers :** créer `internal/source/lastfm.go`, test
`internal/source/lastfm_test.go`.

**Requête :**
`GET https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=<nom>&api_key=<cle>&format=json&limit=60&autocorrect=0`

**`autocorrect=0` est délibéré** : la correction de Last.fm n'est pas bornée et
substituerait silencieusement un artiste à un autre, ce que la §09 interdit. Le
rattrapage orthographique se fait au PRP 06, sous le contrôle de
`CorrectionPlausible`, et il est **affiché** à l'utilisateur.

Le champ `match` est **déjà normalisé entre 0 et 1** : aucune transformation.
C'est la raison pour laquelle Last.fm est le premier de la cascade.

**Vivier d'au moins 30 candidats** (§05) : `limit=60` laisse de la marge après
élagage.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestVivierRenvoieAffiniteEntreZeroEtUn` — bornes vérifiées sur chaque voisin.
2. `TestVivierTrieParAffiniteDecroissante`.
3. `TestSansCleRenvoieErrCleAbsente` — c'est ce qui rend la cascade possible
   sans que l'app ait à savoir si la clé est configurée.
4. `TestErreur29NonMiseEnCache` — le code d'erreur Last.fm 29 (*too many
   requests*) remonte tel quel et n'est **pas** mémorisé.
5. `TestAutocorrectDesactive` — le serveur simulé vérifie `autocorrect=0`.

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : voisins Last.fm, affinite deja normalisee"
```

---

### Tâche 4 : ListenBrainz et la cascade du rôle 1

Mitigation directe du risque §14 « dépendance à une source unique de
proximité », et couverture de N-06 : une source indisponible dégrade une
fonction, jamais l'écran.

**Fichiers :** créer `internal/source/listenbrainz.go`, modifier
`internal/source/source.go`, test `internal/source/cascade_test.go`.

**Requête ListenBrainz** — sans authentification, vérifiée le 3 août 2026 :

```
GET https://labs.api.listenbrainz.org/similar-artists/json
    ?artist_mbids=<MBID>
    &algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30
```

```json
[{"artist_mbid":"5b11f4ce-…","name":"Nirvana","score":11156,
  "reference_mbid":"a74b1b7f-…"}]
```

**Le `score` est un entier brut, pas une affinité.** Normalisation obligatoire :
`affinite = score / score_max_de_la_liste`, ce qui donne 1,0 au voisin le plus
proche et conserve la monotonie exigée par F-09.

**Correction apportée à la spécification d'origine.** La cascade prend un
`Artiste`, pas un nom : Last.fm interroge par nom, ListenBrainz **exige un
MBID**. Une interface qui ne transporterait que le nom rendrait le repli
inutilisable — c'est le défaut le plus coûteux qu'aurait porté ce PRP. D'où :

```go
type Proximite interface {
    Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error)
}
```

Conséquence pour les héritiers (PRP 04) : une branche n'a d'héritiers par
ListenBrainz que si son `Voisin` porte un MBID. Sans MBID et sans clé Last.fm,
la branche n'a **pas** d'héritiers — c'est un état vide, pas une panne.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestNormalisationDuScoreBrut` — entrée `[11156, 5578, 0]`, attendu
   `[1.0, 0.5, 0.0]` à 1e-9 près.
2. `TestCascadeBasculeSurErreur` — la première source renvoie `ErrCleAbsente`, la
   seconde répond : le vivier de la seconde est renvoyé.
3. `TestCascadeNeMasquePasUnVivierVide` — **si une source répond correctement
   avec zéro voisin, la cascade s'arrête là** et renvoie vide. « Aucun voisin »
   et « source indisponible » sont deux états distincts (F-36) ; basculer sur la
   source suivante confondrait les deux.
4. `TestCascadeEpuiseeRemonteLaDerniereErreur`.
5. `TestSansMBIDListenBrainzNeSortPasSurLeReseau` — un `Artiste` sans MBID
   renvoie `ErrIntrouvable` sans requête.

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : ListenBrainz en repli, score brut normalise"
```

---

### Tâche 5 : Deezer — illustrations, audience, extraits

**Fichiers :** créer `internal/source/deezer.go`, test
`internal/source/deezer_test.go`.

**Interfaces — produit :**

```go
type FicheDeezer struct {
    ID           int64
    Illustration Illustration
    Auditeurs    int    // nb_fan
    LienArtiste  string
}
```

**Requêtes vérifiées, sans authentification :**

- `GET https://api.deezer.com/search/artist?q=<nom>&limit=5` → `picture_small`,
  `picture_medium`, `picture_big`, `picture_xl`, `nb_fan`, `link`.
- `GET https://api.deezer.com/artist/<id>/top?limit=10` → chaque piste porte un
  champ `preview` (mp3 de 30 s) et `duration`.

`Chercher` passe **obligatoirement** par `CorrespondanceStricte` sur `name` : la
recherche Deezer est par mots-clés, donc contaminante par nature.

**C'est, avec Last.fm, la seule source autorisée pour l'entourage** — d'où le
paramètre `p budget.Portee` explicite, et un débit généreux qui supporte une
illustration par branche.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestChercherRefuseUnNomApprochant`.
2. `TestExtraitsIgnorentLesPistesSansPreview` — une piste dont `preview` est vide
   est écartée, pas rendue avec un bouton inerte (F-40).
3. `TestChercherAutoriseEnEntourage` — aucune `ErrPorteeInterdite`.
4. `TestAucunExtraitRenvoieListeVideSansErreur` — « rien à montrer » n'est pas
   une panne (F-36).

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : Deezer, illustrations, audience et extraits"
```

---

### Tâche 6 : le rôle 4 — liens d'écoute et repli obligatoire

Porte F-25 et F-26. Le repli n'est pas une politesse : le PRD interdit qu'un lien
mène *« à une page vide ou erronée »*. Odesli fonctionne sans clé, mais **sa
limite de débit n'est pas documentée publiquement** — vérifié, non trouvé. D'où
un usage strictement à la demande, sur clic, et jamais au chargement.

**Fichiers :** créer `internal/source/odesli.go`, test
`internal/source/odesli_test.go`.

**Interfaces — produit :**

```go
type Service string
const (
    ServiceDeezer  Service = "deezer"
    ServiceSpotify Service = "spotify"
    ServiceApple   Service = "apple"
    ServiceYouTube Service = "youtube"
    ServiceTidal   Service = "tidal"
)
```

`LienEcoute` **ne renvoie jamais de chaîne vide** : à défaut de résolution
exacte, elle renvoie `RecherchePreRemplie`.

**Modèles de recherche pré-remplie**, écrits en clair dans le code :

| Service | Modèle |
|---|---|
| Deezer | `https://www.deezer.com/search/<requete>` |
| Spotify | `https://open.spotify.com/search/<requete>` |
| Apple Music | `https://music.apple.com/search?term=<requete>` |
| YouTube Music | `https://music.youtube.com/search?q=<requete>` |
| Tidal | `https://tidal.com/search?q=<requete>` |

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestOdesliIndisponibleDonneLaRecherchePreRemplie` — le serveur simulé renvoie
   503 ; le résultat est l'URL de recherche du service choisi, non vide.
2. `TestOdesliSansLeServiceChoisiDonneLeRepli` — la réponse contient Spotify mais
   l'utilisateur a choisi Tidal.
3. `TestRequeteEncodee` — un nom contenant `&` et un espace est correctement
   encodé.
4. `TestJamaisDeChaineVide` — table couvrant les cinq services × trois cas
   (résolu, non résolu, source en panne).

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : liens d'ecoute, repli de recherche obligatoire"
```

---

## Vérification de l'étape

**1 · La suite passe, sous détecteur de concurrence, sans toucher au réseau.**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go vet ./... && go test -race -count=1 ./...
```

**2 · Aucun test ne sort sur le réseau** (§13 : *« tester contre des sources
réelles produit des échecs intermittents qui finissent par être ignorés »*).

```bash
cd /home/user/hello-world && \
! grep -rn 'https\?://\(musicbrainz\|ws\.audioscrobbler\|api\.deezer\|labs\.api\|api\.song\)' \
  apps/ramure-v2/internal --include='*_test.go'
```

Attendu : la commande réussit. Les adresses réelles n'apparaissent que dans le
code de production, comme valeur par défaut du champ d'adresse de base.

**3 · Les six adaptateurs sont bien six fichiers.**

```bash
ls apps/ramure-v2/internal/source/
```

Attendu : `source.go`, `strict.go` (PRP 02), `musicbrainz.go`, `lastfm.go`,
`listenbrainz.go`, `deezer.go`, `odesli.go`, et leurs tests.

**4 · Le contrat de la fabrique et le contrat de test tiennent.**

```bash
cd /home/user/hello-world && ./init.sh --check && ./apps/ramure-v2/test.sh
```

Attendu : aucune erreur. Le compose n'a pas bougé — cette étape n'ajoute ni
route, ni port, ni variable d'environnement au-delà de `LASTFM_API_KEY`, déclarée
dès le PRP 01.

---

## Ce que la suite attend de vous

**Le PRP 04 consomme les types et les six adaptateurs, et rien d'autre.** Les
signatures listées en tête de ce document sont figées.

1. **`Dependances` est le point d'assemblage, et il appartient au PRP 04.** Ce
   PRP ne construit ni `Cascade`, ni client HTTP partagé, ni `Cache`, ni
   `Limiteur` : il les reçoit. Un `Cache` et un `Limiteur` **par processus**,
   construits une seule fois au démarrage — deux limiteurs se partageraient le
   même quota sans le savoir.
2. **La clé Last.fm se lit dans l'environnement, une seule fois, au câblage.**
   Absente, `NouveauLastFM("")` renvoie `ErrCleAbsente` à chaque appel et la
   cascade bascule sur ListenBrainz. **Rien ne doit paniquer, rien ne doit
   s'arrêter** : c'est N-06, et c'est aussi ce qui permet à l'app de démarrer
   sans aucun secret.
3. **Le budget de N-03 n'est pas encore prouvé.** Ce PRP prouve qu'un appel
   interdit échoue ; c'est le PRP 04 qui doit prouver qu'un chargement complet —
   un centre, dix branches, trente héritiers — consomme exactement 2 appels
   MusicBrainz et au plus 1 Cover Art Archive. Ce test est le gardien de
   l'exigence critique.
4. **`Profil` et `Extraits` ne sont pas appelés au chargement de l'arbre.** Ils
   servent la fiche artiste (PRP 06). Les appeler dans `Composer` doublerait le
   coût du geste le plus fréquent du produit.
5. **`ErrIntrouvable` signale un vide, pas une panne.** Le PRP 04 traduit cette
   distinction en `EtatAucunVoisin` contre `EtatPanne` : ne la perdez pas en
   route en enveloppant toutes les erreurs dans un type unique.
