# PRP 07 — Identité, collection persistante, et mesure

> **Ce PRP livre** ce qui appartient à quelqu'un : l'identité lue de
> `X-Forwarded-User` et de nulle part ailleurs (N-08), la collection cloisonnée
> par utilisateur et **persistante** (F-28 à F-33), et l'agrégation de mesure
> côté serveur (N-09, N-10). C'est l'étape où le palier `google` cesse d'être une
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
> package mesure // internal/mesure
> type Evenement string
> const (Plantation, Promotion, LienEcoute, Signet Evenement)
> func (a *Agregat) Compter(e Evenement, session string)
> func (a *Agregat) Instantane() map[string]any
>
> // internal/api/collection.go — GET/PUT/DELETE /api/collection
> ```

**Deux tâches**, indépendantes l'une de l'autre.

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

### Tâche 1 : identité et collection persistante

Porte F-28 à F-33 et N-08.

**Fichiers :**
- Créer : `internal/identite/identite.go`, `internal/collection/store.go`,
  `internal/collection/file.go`, `internal/api/collection.go`
- Modifier : `web/src/collection.ts`, `apps/ramure-v2/README.md`
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
| `RAMURE_DATA_DIR` | non | Répertoire de persistance de la collection. Fixé à `/var/lib/ramure` par le `Dockerfile` ; absent, la collection est volatile (développement local). |

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

- [ ] **Étape 1 : écrire les tests qui échouent**

Médiane sur un nombre pair **et** impair d'échantillons ; P75 sur 4 échantillons ;
sessions distinctes non confondues ; **aucune donnée nominative dans
l'instantané** — le test cherche une adresse électronique dans le JSON produit et
échoue si elle s'y trouve ; le taux de service apparaît dans l'instantané.

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : metriques agregees cote serveur"
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
persistance :

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
2. **La collection est miroitée côté client** (F-33) pour que l'appareil où
   l'utilisateur a gardé un artiste ne perde rien hors ligne. Le serveur reste
   la référence à la reconnexion ; la réconciliation ne doit jamais supprimer
   côté serveur une entrée que le client ignore simplement.
3. **L'instantané de mesure part sur la sortie standard, en une ligne JSON.**
   Le PRP 09 s'en sert pour vérifier en ligne que l'application mesure vraiment.
   Ne l'écrivez pas dans le volume : ce n'est pas de la donnée utilisateur, et
   le volume n'a pas à grossir de journaux.
4. **Le seuil N-13 reste une hypothèse jusqu'à la première mesure.** C'est écrit
   dans le README de la série ; ce PRP fournit enfin l'instrument. Relevez le
   taux de service réel après la mise en ligne et corrigez le chiffre plutôt que
   de le laisser vivre en légende.
