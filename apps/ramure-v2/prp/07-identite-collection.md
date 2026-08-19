# PRP 07 — Identité, collection persistante, et mesure

> **Ce PRP livre** ce qui appartient à quelqu'un : l'identité lue de
> `X-Forwarded-User` et de nulle part ailleurs (N-08), la collection cloisonnée,
> **persistante** et **affichée** (F-28 à F-33), le réglage qui suit son
> propriétaire d'un appareil à l'autre (F-25), la part équitable du quota entre
> visiteurs (N-14), et l'agrégation de mesure côté serveur avec l'export de
> session (N-09, N-10). C'est l'étape où le palier `google` cesse d'être une
> ligne d'`app.yml` et devient une contrainte de code.
>
> **Ce PRP consomme :**
> - du PRP 01 — le volume nommé `donnees:/var/lib/ramure` déclaré dans `app.yml`
>   **dès l'échafaudage**, et `ENV RAMURE_DATA_DIR=/var/lib/ramure` posé par le
>   `Dockerfile`, qui `chown` ce chemin **avant** `USER` ; le journal sur la
>   sortie standard, qui n'écrit **ni** l'identité **ni** la chaîne de requête ;
> - du PRP 02 — `(*cache.Cache).TauxDeService() (succes, total int64)`, encore
>   exposé nulle part : c'est ici qu'il devient visible ;
> - du PRP 04 — `Routes(d arbre.Dependances) http.Handler`, élargi ;
> - du PRP 05 — le compteur de génération, pour que l'ajout d'un signet
>   n'écrase pas un centre en cours de chargement.
>
> **Ce PRP produit :**
>
> ```go
> package identite // internal/identite
> func DepuisRequete(r *http.Request) (string, bool) // X-Forwarded-User, et rien d'autre
> var ErrSansIdentite = errors.New("X-Forwarded-User absent")
>
> package collection // internal/collection
> type Entree struct {
>     Nom, MBID string
>     Lignee    []string  // contexte de découverte, F-29
>     Ajoute    time.Time
> }
> type CollectionStore interface {
>     Lister(ctx context.Context, utilisateur string) ([]Entree, error)
>     Ajouter(ctx context.Context, utilisateur string, e Entree) error
>     Retirer(ctx context.Context, utilisateur, mbid string) error
> }
> func NouveauMemoryStore() CollectionStore
> func NouveauFileStore(repertoire string) (CollectionStore, error)
>
type Reglages struct{ ServiceEcoute string }
> type ReglagesStore interface {
>     Lire(ctx context.Context, utilisateur string) (Reglages, error)
>     Ecrire(ctx context.Context, utilisateur string, r Reglages) error
> }
>
> package equite // internal/equite
> func Garde(suivant http.Handler) http.Handler // un chargement en vol par identite
>
> package mesure // internal/mesure
> type Evenement string
> const (Plantation, Promotion, LienEcoute, Signet,
>        AmorceCollection, AmorcePartage Evenement)
> func (a *Agregat) Compter(e Evenement, session string)
> func (a *Agregat) Instantane() map[string]any
> func (a *Agregat) JournalDeSession(session string) []byte // N-10
>
> // internal/api/collection.go — GET/PUT/DELETE /api/collection
> // internal/api/reglages.go   — GET/PUT     /api/reglages   (F-25)
> // internal/api/diagnostic.go — GET         /api/diagnostic (N-10)
> ```
>
> ```ts
> // web/src/collection.ts  le panneau : lignée de découverte, replanter, miroir hors ligne
> ```

**Trois tâches.** Les deux premières sont serveur et indépendantes l'une de
l'autre ; la troisième est l'écran, et elle consomme la première.

---

## La persistance ne se demande pas, elle est déjà déclarée

Le PRP 01 a fait entrer dans les manifestes ce qui aurait été, dans une autre
fabrique, une demande d'infrastructure. Il ne reste ici qu'à écrire dedans.

**`FileStore` est le régime nominal**, choisi dès que `RAMURE_DATA_DIR` est
définie — ce que le `Dockerfile` garantit en conteneur, donc en production,
toujours. **`MemoryStore` est le repli de développement hors conteneur**
(`go run .` sans volume) : volatile, et **annoncé au démarrage** sur la sortie
standard.

F-32 et F-33 ne sont donc ni dégradés ni en attente. Le piège qui reste est
celui du propriétaire du volume : au **premier** montage, Docker recopie dans le
volume vide le répertoire tel qu'il existe **dans l'image**, propriétaire
compris. Sans le `chown` du PRP 01, le volume appartient à root, l'app tourne en
10001, et le symptôme est *« elle démarre et perd tout »* — sans une erreur.

---

### Tâche 1 : identité, collection persistante, réglage et part équitable

Porte F-28, F-29, F-32, N-08, **F-25** (la mémoire du choix, dont l'écran est au
PRP 06) et **N-14**. L'affichage de la collection est la tâche 3.

**Fichiers :**
- Créer : `internal/identite/identite.go`, `internal/collection/store.go`,
  `internal/collection/file.go`, `internal/api/collection.go`,
  `internal/collection/reglages.go`, `internal/api/reglages.go`,
  `internal/equite/garde.go`
- Modifier : `apps/ramure-v2/README.md`
- Tests : associés à chacun

**Exigence critique de cloisonnement.** L'app est en `exposure: google` :
n'importe quel compte Google entre. Le partitionnement se fait **uniquement** par
`X-Forwarded-User`, jamais par un identifiant fourni par le client — ni
paramètre d'URL, ni corps de requête, ni cookie applicatif. C'est la seule
barrière entre deux utilisateurs, et elle tient en une fonction de dix lignes :
qu'elle soit lue par tout le monde et contournée par personne.

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `TestIdentiteRefuseUnParametreDURL` — une requête portant `?utilisateur=x`
   mais aucun `X-Forwarded-User` renvoie `ErrSansIdentite`, et **pas** `x`.
2. `TestIdentiteRefuseUnCookieApplicatif` — même principe.
3. `TestCloisonnementStrict` — l'utilisateur `a@x` ajoute un artiste ;
   l'utilisateur `b@x` liste et obtient **zéro** entrée.
4. `TestRetirerNAffectePasLesAutresUtilisateurs`.
5. `TestContexteDeDecouverteConserve` (F-29) — la lignée complète et la date sont
   relues telles quelles.
6. `TestFileStoreSurvitAUnRedemarrage` — deux instances successives de
   `FileStore` sur le même répertoire voient les mêmes entrées.
7. `TestSansRepertoireOnRetombeSurMemoryStore` — et un avertissement explicite
   est écrit sur la sortie standard au démarrage.
8. `TestEcrituresConcurrentesNePerdentRienDeux` — deux ajouts simultanés pour le
   même utilisateur, sous `-race` : les deux entrées sont présentes.
9. `TestReglageServiceSuitLIdentite` (F-25) — le service écrit par `a@x` est relu
   par `a@x` depuis une autre session ; `b@x` obtient le service par défaut, pas
   celui de `a@x`. C'est ce qui rend vraie la promesse *« le choix le suit d'un
   appareil à l'autre »*, qu'un stockage de navigateur ne tiendrait pas.
10. `TestReglageInconnuRetombeSurLeDefaut` — un service absent ou inconnu ne
    casse rien et ne vide aucun lien.
11. `TestUnSeulChargementEnVolParIdentite` (N-14) — deux chargements de centre
    demandés par la **même** identité s'exécutent l'un après l'autre ; deux
    identités différentes ne s'attendent pas, et **aucun n'échoue** : le second
    attend son tour. Sans ce garde, un visiteur seul mange le quota commun — le
    palier `google` n'est pas la liste blanche du serveur.
12. `TestGardeEquiteLibereApresPanne` — un chargement qui échoue rend la place ;
    un garde qui fuit condamnerait le visiteur à attendre indéfiniment.

- [ ] **Étape 2 : vérifier l'échec, puis implémenter**

`FileStore` écrit **un fichier par utilisateur**, nommé d'après un hachage de
l'identité — pas d'après l'adresse électronique en clair, qui est une donnée
personnelle et se retrouverait dans les noms de fichiers d'un volume sauvegardé.
Écriture atomique : fichier temporaire puis `rename`, sinon un redémarrage au
mauvais moment laisse un fichier tronqué et la collection disparaît pour de bon.

- [ ] **Étape 3 : vérifier que le volume est bien déclaré, puis documenter**

```bash
grep -n 'volumes:' apps/ramure-v2/app.yml                # donnees:/var/lib/ramure
grep -n 'chown 10001:10001' apps/ramure-v2/Dockerfile    # AVANT la directive USER
./init.sh && ./init.sh --check
```

`--check` doit afficher `[ramure-v2] volume 'ramure-v2-donnees' : /var/lib/ramure
est chown dans le Dockerfile`, et **aucun** avertissement `aucun chown de
/var/lib/ramure`. Cet avertissement, s'il apparaît, est le dernier filet avant
la production.

Le bloc `volumes:` du compose, lui, n'existe pas encore : l'app est toujours
`enabled: false`. C'est au PRP 09, une fois l'image publiée et l'app activée, que
`--check` affichera `volume 'ramure-v2-donnees' : name: ramure-v2-donnees — le
nom reel est le nom documente`.

Le `README` de l'app ne porte alors que ce qui reste hors du dépôt — les **noms**
des variables, jamais leurs valeurs :

```markdown
## Variables d'environnement attendues

| Nom | Obligatoire | Rôle |
|---|---|---|
| `LASTFM_API_KEY` | non | Clé Last.fm (rôle 1). Absente, l'application bascule sur ListenBrainz : l'affinité est moins fine, rien n'est cassé. |
| `RAMURE_DATA_DIR` | non | Répertoire de persistance de la collection **et des réglages**. Fixé à `/var/lib/ramure` par le `Dockerfile` ; absent, les deux sont volatils (développement local). |

## Persistance

La collection (**F-32**, **F-33**) survit au redéploiement : `app.yml` déclare
`volumes: [donnees:/var/lib/ramure]`, ce qui produit le volume nommé
`ramure-v2-donnees`. Rien n'est à préparer côté serveur.

Sauvegarde :

    docker run --rm -v ramure-v2-donnees:/d -v "$PWD":/sortie alpine \
      tar czf /sortie/ramure-v2-donnees.tgz -C /d .
```

- [ ] **Étape 4 : vérifier au vert, puis committer**

```bash
git commit -m "ramure-v2 : collection cloisonnee par X-Forwarded-User"
```

---

### Tâche 2 : mesure agrégée et journal de diagnostic

Porte N-09 — **dans le périmètre du MVP, pas repoussé**, parce que c'est la
mitigation du risque §14 — et N-10.

**Fichiers :** créer `internal/mesure/mesure.go`, test associé.

**Ce que l'agrégat doit calculer** — exactement les métriques §04 du lot MVP :

| Métrique | Calcul |
|---|---|
| M-01 sauts par session | médiane du nombre de `Promotion` par session |
| M-02 découverte réelle | part de centres jamais visités auparavant |
| M-03 écoute | part de sessions avec ≥ 1 `LienEcoute` |
| M-04 conservation | part de sessions avec ≥ 1 `Signet` |
| M-05 latence P75 | 75ᵉ centile du temps graine → entourage affiché |
| M-06 collection réutilisée | part de sessions ouvertes par `AmorceCollection` |
| M-07 partage | part de sessions ouvertes par `AmorcePartage` |

**M-06 et M-07 sont du lot V1, et elles arrivent ici** — avec les fonctions
qu'elles mesurent, jamais après. Une collection et un partage livrés sans leur
compteur, ce sont deux fonctions dont personne ne saura jamais si elles ont
servi ; c'est le risque §14 « métriques non instrumentées », appliqué au lot qui
suit. `AmorceCollection` est émis quand une session démarre depuis un artiste
gardé (F-31), `AmorcePartage` quand elle démarre depuis un lien reçu (F-34) —
deux amorçages que le PRP 06 distingue déjà pour ne pas replanter deux fois.

**Agrégation côté serveur, pas un journal local** — N-09 est explicite. Un
instantané est écrit sur la sortie standard **toutes les 5 minutes**, en une
ligne JSON : c'est le seul canal de sortie autorisé par la fabrique.

**L'identité est hachée avant comptage.** Le PRP 01 a posé la règle — le journal
n'écrit ni `X-Forwarded-User` ni la chaîne de requête — et ce PRP est le seul qui
pourrait l'annuler, puisqu'il vient justement de lire l'identité. Le hachage est
la réponse : les métriques par session existent, les personnes n'apparaissent
pas.

**Le taux de service du cache entre ici.** `TauxDeService()`, posé au PRP 02 et
jusqu'ici exposé nulle part, rejoint `Instantane()`. C'est ce chiffre qui permet
de réviser le seuil de bascule N-13, aujourd'hui posé sur une **hypothèse** de
80 % de taux de service — soit environ 5 promotions par seconde tous
utilisateurs confondus. À réviser dès la première mesure réelle.

**N-10, le journal de session que l'utilisateur emporte.** `GET /api/diagnostic`
renvoie les événements de **sa seule** session, en JSON, pour qu'il puisse
l'attacher à un signalement : c'est l'exigence, et c'est indispensable aux
anomalies mobiles qu'on ne reproduit pas. Trois règles le tiennent : jamais les
événements d'un autre visiteur, jamais l'identité en clair, et rien qui ne soit
déjà dans l'agrégat — ce n'est pas un second journal, c'est une vue du premier.

- [ ] **Étape 1 : écrire les tests qui échouent**

Médiane sur un nombre pair **et** impair d'échantillons ; P75 sur 4 échantillons ;
sessions distinctes non confondues ; **aucune donnée nominative dans
l'instantané** — le test cherche une adresse électronique dans le JSON produit et
échoue si elle s'y trouve ; le taux de service apparaît dans l'instantané ;
`TestInstantanePorteLesMetriquesDuLot` — les sept métriques du périmètre,
M-06 et M-07 comprises, sont présentes dans l'instantané ;
`TestDiagnosticNeSortQueLaSessionDemandee` (N-10) — deux sessions, deux
visiteurs : l'export de l'une ne contient rien de l'autre, et aucune adresse
électronique.

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : metriques agregees cote serveur"
```

---

### Tâche 3 : la collection à l'écran, et son miroir hors ligne

Porte **F-30**, **F-31** et **F-33** — les trois moitiés client des exigences que
la tâche 1 a rangées côté serveur. Sans cette tâche, la collection existe et ne
se voit pas : F-31 est du lot MVP, et l'oublier laisserait le MVP incomplet.

**Fichiers :** créer `web/src/collection.ts` — le fichier n'existe pas avant ce
PRP, aucun autre ne le crée — et ses tests.

**Exigences testées :**

- **le chemin parcouru s'affiche** (F-30) — chaque artiste gardé montre la lignée
  qui y a mené et la date, pas seulement son nom. C'est le contexte de découverte
  que la tâche 1 conserve ; le garder sans le montrer ne sert personne ;
- **replanter d'un clic** (F-31) — sélectionner un artiste ferme le panneau et
  recentre l'arbre sur lui, **sans passer par l'accueil**, et l'amorçage émet
  `AmorceCollection` (M-06). Il passe par le compteur de génération du PRP 05 :
  une réponse en vol pour un autre centre ne doit pas écraser celui-ci ;
- **garder n'interrompt rien** — ajouter un signet ne réinitialise pas le lecteur
  d'extraits, seul élément à état persistant de l'interface (PRP 06) ;
- **le miroir hors ligne** (F-33) — la collection reste utilisable sans réseau,
  et se réconcilie à la reconnexion **sans perte ni doublon**. Trois tests, et
  ce sont les seuls qui comptent vraiment ici :
  `un ajout hors ligne remonte a la reconnexion` ;
  `un retrait hors ligne ne ressuscite pas a la reconnexion` ;
  `une entree presente des deux cotes ne produit pas de doublon`.
  La règle qui les tient : **le serveur est la référence, mais la
  réconciliation ne supprime jamais côté serveur une entrée que le client ignore
  simplement** — un appareil resté longtemps hors ligne ne doit pas effacer ce
  qu'un autre a gardé entre-temps.

- [ ] **Étapes 1 à 4 : rouge, implémenter, vert, committer**

```bash
git commit -m "ramure-v2 : la collection a l'ecran, lignee et miroir hors ligne"
```

---

## Vérification de l'étape

**1 · Les deux suites passent, sous détecteur de concurrence.**

```bash
cd /home/user/hello-world && ./apps/ramure-v2/test.sh
```

**2 · Le cloisonnement tient sur le vrai chemin HTTP**, pas seulement en test
unitaire :

```bash
curl -s -H 'X-Forwarded-User: a@exemple.fr' -X PUT localhost:8080/api/collection -d '{"nom":"Portishead","mbid":"8f6bd1e4"}'
curl -s -H 'X-Forwarded-User: b@exemple.fr' localhost:8080/api/collection
```

Attendu : la seconde commande renvoie une liste **vide**.

**3 · L'identité ne s'invente pas.**

```bash
curl -s -i 'localhost:8080/api/collection?utilisateur=a@exemple.fr' | head -1
```

Attendu : `401`, jamais la collection de `a@exemple.fr`.

**4 · La collection survit à un redémarrage**, sur le vrai chemin de
persistance. **Cette vérification exige un démon Docker**, absent des sessions
cloud : c'est la seule preuve que F-32 et F-33 tiennent vraiment, et rien dans
la CI ne la remplace — le job `build` construit l'image, il ne la fait pas
tourner. À défaut, elle se reporte au PRP 09, après la mise en ligne.

```bash
docker run -d --name ramure-essai -v ramure-essai-donnees:/var/lib/ramure -p 8099:8080 ramure-v2:essai
# ajouter une entrée, puis :
docker restart ramure-essai && sleep 2
curl -s -H 'X-Forwarded-User: a@exemple.fr' localhost:8099/api/collection
```

Attendu : l'entrée est toujours là. **Si elle a disparu, c'est le `chown` du
`Dockerfile` qu'il faut regarder, pas le code.**

**5 · Le contrat de la fabrique tient.**

```bash
cd /home/user/hello-world && ./init.sh --check
```

---

## Ce que la suite attend de vous

1. **`DepuisRequete` est la seule lecture d'identité de toute l'application.**
   Si une seconde apparaît, le cloisonnement n'a plus de gardien unique. Le
   PRP 08 et le PRP 09 ne doivent pas en introduire une pour leurs besoins de
   test : ils injectent l'en-tête.
2. **Le miroir hors ligne (F-33) est écrit, pas promis** — c'est la tâche 3, et
   ses trois tests de réconciliation sont ce qui distingue une collection qui
   survit d'une collection qui se vide au premier appareil resté hors ligne.
3. **L'instantané de mesure part sur la sortie standard, en une ligne JSON.**
   Le PRP 09 s'en sert pour vérifier en ligne que l'application mesure vraiment.
   Ne l'écrivez pas dans le volume : ce n'est pas de la donnée utilisateur, et
   le volume n'a pas à grossir de journaux.
4. **Le seuil N-13 reste une hypothèse jusqu'à la première mesure.** C'est écrit
   dans le README de la série ; ce PRP fournit enfin l'instrument. Relevez le
   taux de service réel après la mise en ligne et corrigez le chiffre plutôt que
   de le laisser vivre en légende.
