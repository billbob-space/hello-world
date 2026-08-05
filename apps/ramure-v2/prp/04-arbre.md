# PRP 04 — L'arbre, et la première route

> **Ce PRP livre** la logique qui fait de six adaptateurs un arbre : la sélection
> de l'entourage (F-08, l'exigence qui distingue le produit d'un annuaire), le
> rebattage (F-15) et l'élagage (F-16), la composition d'un centre complet, et la
> route `GET /api/centre` qui distingue **vide** et **panne** — F-36 et F-37, les
> deux seules exigences que le PRD marque *critiques* dans les états d'erreur.
> À la fin de l'étape, l'application répond en JSON un arbre complet ; **rien ne
> s'affiche encore**, le canevas est l'affaire du PRP 05.
>
> **Ce PRP consomme :**
> - du PRP 01 — `func routes() http.Handler` dans `main.go`, qu'il **modifie**
>   (voir ci-dessous), et le journal sur la sortie standard ;
> - du PRP 02 — `budget.Compte`, `budget.ErrPorteeInterdite`, `cache.Neuf` ;
> - du PRP 03 — les types `Artiste`, `Voisin`, `Profil`, `Illustration`, `Album`,
>   l'interface `Proximite`, `Cascade`, et les six adaptateurs.
>
> **Ce PRP produit :**
>
> ```go
> package arbre // apps/ramure-v2/internal/arbre
> type Cadrage struct{ Branches, Stables, Heritiers, VivierMin int }
> func SelectionnerBranches(vivier []source.Voisin, c Cadrage, alea *rand.Rand) []source.Voisin
> func Rebattre(vivier []source.Voisin, c Cadrage, alea *rand.Rand) []source.Voisin
> func Elaguer(branches []Branche, minimum int) []Branche
>
> type Etat string
> const (EtatOK, EtatAucunVoisin, EtatPanne Etat)
> type Branche struct {
>     Voisin       source.Voisin
>     Illustration source.Illustration
>     LienDeezer   string
>     Heritiers    []source.Voisin
> }
> type Centre struct {
>     Artiste      source.Artiste
>     Profil       source.Profil
>     Illustration source.Illustration
>     Discographie []source.Album
>     Branches     []Branche
>     Etat         Etat
>     Message      string
>     Reessayable  bool
> }
> type Dependances struct {
>     Catalogue *source.MusicBrainz
>     Proximite source.Proximite
>     Media     *source.Deezer
>     Limiteur  *budget.Limiteur
> }
> func Composer(ctx context.Context, d Dependances, nom string, c Cadrage, alea *rand.Rand) (Centre, error)
>
> package api // apps/ramure-v2/internal/api
> func Routes(d arbre.Dependances) http.Handler   // remplace routes() du PRP 01
> // GET /api/centre?nom=<graine>&largeur=<large|etroit>
> ```

**Deux tâches.** La première est pure — aucun réseau, aucun HTTP — et porte
l'exigence la plus subtile du produit. La seconde assemble et expose.

---

## La décision que le PRP 01 a laissée ouverte

Le PRP 01 a posé `func routes() http.Handler` **sans argument**, en notant que le
premier PRP qui greffe une route ayant besoin de sources doit trancher pour
tous — variables de paquet, ou élargissement de la signature. **C'est ce PRP, et
il tranche pour l'élargissement :**

```go
// apps/ramure-v2/internal/api/routes.go
func Routes(d arbre.Dependances) http.Handler
```

Raison : des variables de paquet rendraient impossible d'exécuter deux tests en
parallèle avec des doublures différentes, et `go test -race` est le seul outil
qui attrape les défauts de mutualisation. Le câblage — un `Cache`, un
`Limiteur`, un `http.Client`, une `Cascade`, tous construits **une seule fois**
— vit dans `main()`. Les PRP 06 et 07 ajoutent leurs routes à `Routes`, en
élargissant `Dependances`, jamais en introduisant un second routeur.

Ce qui **ne change pas** : le motif `GET /{$}` du PRP 01 (sans `{$}`, tout
chemin inconnu renvoie 200 au lieu de 404), l'en-tête `X-Ramure-Version` sur
toutes les réponses, et le journal qui ignore `/healthz` et n'écrit jamais
l'identité.

---

### Tâche 1 : sélection de l'entourage, rebattage et élagage

Porte F-08, F-15 et F-16. Logique **déterministe et isolée de l'interface**, avec
source d'aléa injectable pour rendre les tirages reproductibles (§13). Ce fichier
et `web/src/geometrie.ts` (PRP 05) portent les deux exigences les plus subtiles
du produit : ils doivent rester libres de toute dépendance au réseau et à
l'interface.

**Fichiers :**
- Créer : `apps/ramure-v2/internal/arbre/selection.go`,
  `apps/ramure-v2/internal/arbre/elagage.go`
- Test : `apps/ramure-v2/internal/arbre/selection_test.go`

**Interfaces :**
- Consomme : `source.Voisin`.
- Produit : `Cadrage`, `SelectionnerBranches`, `Rebattre`, `Elaguer`.

**Valeurs de cadrage** — conséquence directe de la parité stricte décidée par le
commanditaire (README de la série, question §17 n° 1) :

| | écran large | écran étroit |
|---|---|---|
| `Branches` | 10 | 6 |
| `Stables` | 2 | 2 |
| `Heritiers` | 3 | 2 |
| `VivierMin` | 30 | 30 |

**Algorithme :**

1. trier le vivier par affinité décroissante ;
2. les `c.Stables` premiers sont **toujours** retenus — ce sont les « voisins les
   plus évidents » qui donnent un repère d'une visite à l'autre (§02) ;
3. les `c.Branches - c.Stables` restants sont tirés **sans remise**, pondérés par
   l'affinité, dans tout le reste du vivier ;
4. le résultat est retrié par affinité décroissante, pour un placement stable.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestDeuxVisitesDonnentDesEntouragesDifferents` — deux graines d'aléa
   différentes, même vivier : les ensembles diffèrent (F-08).
2. `TestLesDeuxPremiersSontToujoursPresents` — sur 100 tirages avec 100 graines,
   les deux voisins de plus forte affinité sont dans les 100 résultats.
3. `TestMemeGraineMemeResultat` — reproductibilité, exigence de §13.
4. `TestVivierPlusPetitQueLeCadrage` — un vivier de 4 voisins renvoie 4 branches,
   sans panique ni doublon.
5. `TestAucunDoublon` — tirage sans remise, vérifié sur 1000 exécutions.
6. `TestPonderationFavoriseLAffiniteForte` — sur 10 000 tirages, un voisin
   d'affinité 0,9 sort strictement plus souvent qu'un voisin d'affinité 0,1.
7. `TestRebattreConserveLesStablesEtChangeLeReste` (F-15) — les deux voisins de
   plus forte affinité sont identiques, l'ensemble complet diffère.
8. `TestElagageRetireUneBrancheInexploitable` (F-16) — une branche sans
   illustration **et** sans lien d'écoute disparaît.
9. `TestElagageRefuseDeDescendreSousLeMinimum` — sur 4 branches dont 3
   inexploitables et un minimum de 3, **rien n'est élagué** : un arbre à une
   branche ne veut plus rien dire.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/arbre/ -v
```

Attendu : ÉCHEC de compilation — `undefined: SelectionnerBranches`,
`undefined: Cadrage`.

- [ ] **Étape 3 : implémenter**

Le tirage pondéré sans remise se fait par sélection cumulative : somme des
affinités restantes, tirage uniforme dans cette somme, retrait du candidat
choisi. Une affinité nulle reste tirable — sinon un vivier entièrement à zéro,
que ListenBrainz peut produire après normalisation, ne rendrait aucune branche.

- [ ] **Étape 4 : vérifier au vert, puis committer**

```bash
git commit -m "ramure-v2 : selection, rebattage et elagage de l'entourage"
```

---

### Tâche 2 : composer un centre, et distinguer le vide de la panne

Porte F-36, F-37, F-38, F-39, N-01 et N-03.

**Fichiers :**
- Créer : `internal/arbre/centre.go`, `internal/api/routes.go`,
  `internal/api/centre.go`, `internal/api/erreurs.go`
- Modifier : `apps/ramure-v2/main.go` (câblage, et `Routes` à la place de
  `routes`)
- Tests : `internal/arbre/centre_test.go`, `internal/api/centre_test.go`

**Règle non négociable :** `EtatAucunVoisin` porte `Reessayable: false`,
`EtatPanne` porte `Reessayable: true`. Ce sont **deux messages différents**, et
seul le second propose de réessayer. Confondre les deux, c'est proposer de
réessayer indéfiniment quelque chose qui n'existe pas.

**Réponse HTTP :** `GET /api/centre?nom=<graine>&largeur=<large|etroit>` renvoie
toujours `200` avec un champ `etat` — **sauf** panne totale, qui renvoie `503`.
Un artiste sans voisins n'est **pas** une erreur HTTP.

**Ordre de composition, et budget** — c'est là que N-03 se joue :

| Étape | Source | Portée | Appels |
|---|---|---|---|
| résoudre la graine | MusicBrainz | `Centre` | 1 |
| discographie + notes + types | MusicBrainz | `Centre` | 1 |
| pochette du mieux noté | Cover Art Archive | `Centre` | ≤ 1 |
| vivier du centre | Last.fm, sinon ListenBrainz | `Centre` | 1 |
| illustration du centre et de chaque branche | Deezer | `Entourage` | 1 + 1/branche |
| héritiers de chaque branche | Last.fm | `Entourage` | 1/branche, **différé** |

**Les héritiers sont chargés après l'affichage de l'arbre** (F-39) et bornés par
le budget : ils ne retardent jamais le premier rendu, qui doit tenir la latence
N-01. `Composer` renvoie donc un `Centre` dont les `Heritiers` sont vides, et une
seconde phase les remplit — c'est le PRP 05 qui décide de la forme du transport
(seconde requête ou flux), ce PRP se contente de rendre les deux phases
séparables.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestArtisteSansVoisinsNEstPasUnePanne` — `Etat == EtatAucunVoisin`,
   `Reessayable == false`, code HTTP 200.
2. `TestSourceEnErreurEstUnePanne` — `Etat == EtatPanne`, `Reessayable == true`,
   code HTTP 503.
3. `TestLesDeuxMessagesDifferent` — comparaison stricte des chaînes.
4. `TestUnEchecNEstJamaisMemorise` (F-37) — première requête en panne, seconde
   avec la source rétablie : la seconde renvoie `EtatOK`. **Ce test échoue si le
   cache du PRP 02 mémorise l'erreur.**
5. `TestBudgetRespecteSurUnChargementComplet` — **le test qui protège N-03** :
   après `Composer` avec 10 branches, `budget.Compte(MusicBrainz) == 2` et
   `budget.Compte(CoverArt) <= 1`. Toute régression qui enrichirait les branches
   par MusicBrainz le fait échouer.
6. `TestReponseTardiveIgnoree` — un contexte annulé pendant le chargement ne
   produit aucune écriture dans la réponse (§09).
7. `TestLargeurInconnueRetombeSurLarge` — `?largeur=xxl` ne panique pas.
8. `TestGraineVideEstUneErreurDeRequete` — `400`, distinct d'une panne.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/... -v
```

- [ ] **Étape 3 : implémenter**

`Composer` prend ses sources par `Dependances`, ce qui la rend testable contre
des doublures sans toucher au réseau (§13). Les illustrations des branches se
chargent **en parallèle**, bornées à quatre à la fois : c'est ce qui tient la
latence N-01 sans faire exploser le débit Deezer.

`main.go` construit le câblage une fois :

```go
c := cache.Neuf(time.Now)
l := budget.Neuf()
client := &http.Client{Timeout: 8 * time.Second}
mb := source.NouveauMusicBrainz(c, l, client, "ramure-v2/1.0 ( https://ramure-v2.apps.billbob.ovh )")
prox := &source.Cascade{Sources: []source.Proximite{
    source.NouveauLastFM(os.Getenv("LASTFM_API_KEY"), c, l, client),
    source.NouveauListenBrainz(c, l, client),
}}
```

- [ ] **Étape 4 : vérifier au vert, puis committer**

```bash
git commit -m "ramure-v2 : composition d'un centre, vide et panne distingues"
```

---

## Vérification de l'étape

**1 · La suite passe sous détecteur de concurrence.**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go vet ./... && go test -race -count=1 ./...
```

**2 · L'arbre se demande vraiment, en local, sans réseau externe.** Un serveur
simulé branché sur les quatre sources, puis :

```bash
curl -s 'http://localhost:8080/api/centre?nom=Portishead&largeur=large' | head -c 400
```

Attendu : un JSON portant `"etat":"ok"`, un `artiste`, et dix `branches`.

**3 · Le budget est celui annoncé.** C'est la vérification qui compte le plus de
cette étape :

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test -race -count=1 -run TestBudgetRespecteSurUnChargementComplet -v ./internal/arbre/
```

**4 · Le contrat de la fabrique tient, et l'app reste désactivée.**

```bash
cd /home/user/hello-world && ./init.sh --check && ./init.sh --list | grep ramure-v2
```

Attendu : `ramure-v2  8080  128m  google  go  true  desactivee`.

---

## Ce que la suite attend de vous

1. **`Routes(d arbre.Dependances) http.Handler` est le seul routeur.** Les PRP 06
   et 07 élargissent `Dependances` et ajoutent leurs routes ici. Un second
   routeur ferait diverger les en-têtes et le journal posés au PRP 01.
2. **Le contrat de `/api/centre` est figé** : toujours `200` avec `etat`, sauf
   `503` en panne totale et `400` sur graine vide. Le PRP 05 s'y appuie pour
   décider quoi peindre ; changer ce contrat après coup casse silencieusement la
   distinction vide/panne côté client.
3. **Les héritiers arrivent en seconde phase.** Le PRP 05 doit rendre l'arbre
   sans eux et les faire apparaître ensuite, sans qu'aucune pastille ne bouge —
   c'est F-39, et c'est ce qui rend la latence N-01 tenable.
4. **`Cadrage` est décidé par le serveur à partir de `largeur`**, jamais deviné
   par le client. Deux sources de vérité sur le nombre de branches produiraient
   un arbre dont l'affichage et les données ne s'accordent pas.
5. **Le `memory: 128m` mérite un réexamen ici.** Le cache mutualisé vit dans le
   processus et se remplit vraiment à partir de ce PRP. Un dépassement fait tuer
   le conteneur par l'OOM killer, sans autre message qu'un redémarrage. C'est une
   modification d'`app.yml` suivie d'un `./init.sh`, jamais une édition de
   `compose.yaml`.
