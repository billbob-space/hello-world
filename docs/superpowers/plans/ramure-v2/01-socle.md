# PRP 01 — Socle déployable

> **Ce PRP livre** : `apps/ramure-v2/` échafaudée par le générateur, un serveur Go
> qui répond sur `/` et sur `/healthz`, une image multi-étages sous 200 Mo, un
> `test.sh` qui échoue vraiment quand le code est faux, et une image publiée sur
> GHCR par la CI. À la fin de l'étape, l'application existe, se construit,
> se teste — et **n'est pas encore dans la stack**.
>
> **Ce PRP consomme** : rien. C'est le premier de la série. Ses seules entrées
> sont le contrat de déploiement (`../../../../CLAUDE.md`), l'index de la série
> ([README.md](README.md)) et le PRD ([PRD-RAMURE.md](../../../PRD-RAMURE.md)).
>
> **Ce PRP produit**, et c'est ce dont les huit PRP suivants dépendent :
>
> ```go
> // apps/ramure-v2/main.go
> func routes() http.Handler
> ```
>
> ```
> module github.com/billbob-space/hello-world/apps/ramure-v2   // go 1.23
>
> apps/ramure-v2/app.yml         enabled:false port:8080 exposure:google stack:go ui:true
> apps/ramure-v2/Dockerfile      golang:1.23-alpine -> alpine:3.20, USER ramure (uid 10001)
> apps/ramure-v2/test.sh         exécutable — go vet ./... && go test ./...
> apps/ramure-v2/README.md       LASTFM_API_KEY, RAMURE_DATA_DIR (noms seulement)
> apps/ramure-v2/PRODUCT.md      copie conforme de docs/PRD-RAMURE.md
> apps/ramure-v2/go.mod
> apps/ramure-v2/web/index.html  page d'accueil provisoire, remplacée par PRP 06
>
> en-tête HTTP X-Ramure-Version sur chaque réponse
> ghcr.io/billbob-space/hello-world/ramure-v2:main
> ```

---

## Pourquoi cette étape existe, et pourquoi elle est séparée

Ce dépôt est une **fabrique** : une seule stack `dockhand`, un seul
`docker compose up`, atomique pour l'ensemble des applications. Une erreur dans
le bloc de `ramure-v2` fait échouer le déploiement de `cadran` et de
`hello-world`, qui n'y sont pour rien. Ce n'est pas une hypothèse pessimiste,
c'est la conséquence mécanique d'un compose unique.

Trois conséquences pratiques structurent tout ce document, et elles sont
contre-intuitives si on arrive d'un dépôt mono-application :

1. **L'application naît `enabled: false`.** Ce n'est pas un brouillon, c'est un
   verrou. Une app activée entre dans `compose.yaml` ; son bloc référence
   `ghcr.io/billbob-space/hello-world/ramure-v2:main`. Tant que cette image
   n'existe pas, `docker compose up` échoue — **pour toutes les apps**. On
   construit d'abord, on branche ensuite. Le branchement est l'affaire du
   PRP 09, pas de celui-ci.
2. **Les artefacts dérivés ne s'écrivent pas à la main.** `compose.yaml`,
   `.github/workflows/build.yml`, `.claude/`, `go.work` sont **régénérés** par
   `./init.sh` depuis `fabrique.yml` et les `apps/*/app.yml`. `./init.sh --check`
   compare octet à octet ce qui est committé avec ce que le générateur produit :
   une édition manuelle est refusée en CI. On modifie `app.yml`, on relance
   `./init.sh`.
3. **L'étage final de l'image est `alpine`, pas `scratch`.** Le `health_cmd`
   déclaré dans `app.yml` s'exécute *dans* le conteneur. `wget` vient de busybox,
   présent dans Alpine ; une image `scratch` ou `distroless` n'a ni shell ni
   wget, et imposerait `health_cmd: none`. Un healthcheck qui échoue rend le
   conteneur malsain en permanence, sans que l'application soit en cause — c'est
   le piège le plus fréquent de la fabrique.

Aucune exigence fonctionnelle du PRD n'est close par ce PRP : il porte le
**contrat de la fabrique**. Il prépare toutefois deux exigences non
fonctionnelles, et les décisions prises ici les rendent atteignables :
**N-06** (une source indisponible dégrade une fonction, jamais l'écran — d'où
une sonde de santé qui ne dépend d'aucune source externe) et **N-09**
(observabilité côté serveur — d'où un journal sur la sortie standard dès le
premier commit, sans identité et sans la sonde).

**Convention de commit** : français, à l'impératif, préfixé `ramure-v2 : `. Les
messages sont écrits **sans accents**, comme le reste des artefacts générés du
dépôt : `git log` reste lisible quelle que soit la locale du terminal qui
l'affiche.

---

### Tâche 1 : échafauder l'application par le générateur

**Fichiers :**
- Créer (par `./init.sh --add`) : `apps/ramure-v2/app.yml`
- Créer (par `./init.sh --add`) : `apps/ramure-v2/.dockerignore`
- Créer (par `./init.sh --add`) : `apps/ramure-v2/test.sh`, `apps/ramure-v2/README.md`, `apps/ramure-v2/PRODUCT.md`
- Modifier (régénérés par `./init.sh`) : `compose.yaml`, `.github/workflows/build.yml`, `.gitignore`
- Créer : `apps/ramure-v2/PRODUCT.md` — écrasé par la copie de `docs/PRD-RAMURE.md`
- Test : bloc bash ci-dessous, lancé depuis la racine du dépôt (non versionné : le livrable est l'échafaudage lui-même)

**Interfaces :**
- Consomme : rien.
- Produit : `apps/ramure-v2/app.yml` portant exactement
  `enabled: false`, `port: 8080`, `memory: 128m`, `health_path: /healthz`,
  `health_cmd: wget --spider -q http://localhost:8080/healthz`,
  `exposure: google`, `stack: go`, `ui: true`.
  Ce fichier est la **source de vérité** de toute la série : `init.sh` ne le
  réécrit jamais, tout le reste en découle.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 1 — depuis la racine du depot.
set -uo pipefail
cd /home/user/hello-world

echoue() { echo "ECHEC : $1"; exit 1; }

A=apps/ramure-v2/app.yml
[ -f "$A" ] || echoue "$A absent"

# Lecture plate, comme le fait init.sh : cle en colonne 0, une seule occurrence.
cle() { sed -nE "s/^$1:[[:space:]]*//p" "$A" | head -1; }

# enabled:false est le garde-fou du rayon de souffle, pas un oubli.
[ "$(cle enabled)"     = "false"    ] || echoue "enabled = '$(cle enabled)', attendu false"
[ "$(cle port)"        = "8080"     ] || echoue "port = '$(cle port)', attendu 8080"
[ "$(cle memory)"      = "128m"     ] || echoue "memory = '$(cle memory)', attendu 128m"
[ "$(cle exposure)"    = "google"   ] || echoue "exposure = '$(cle exposure)', attendu google"
[ "$(cle stack)"       = "go"       ] || echoue "stack = '$(cle stack)', attendu go"
[ "$(cle ui)"          = "true"     ] || echoue "ui = '$(cle ui)', attendu true"
[ "$(cle health_path)" = "/healthz" ] || echoue "health_path = '$(cle health_path)', attendu /healthz"
[ "$(cle health_cmd)"  = "wget --spider -q http://localhost:8080/healthz" ] \
    || echoue "health_cmd = '$(cle health_cmd)'"

[ -x apps/ramure-v2/test.sh ]      || echoue "apps/ramure-v2/test.sh absent ou non executable"
[ -f apps/ramure-v2/.dockerignore ] || echoue "apps/ramure-v2/.dockerignore absent"

# Le PRD devient la propriete de l'app : c'est lui que liront les PRP suivants.
cmp -s docs/PRD-RAMURE.md apps/ramure-v2/PRODUCT.md \
    || echoue "PRODUCT.md n'est pas la copie conforme de docs/PRD-RAMURE.md"

# L'app est connue du compose SANS y avoir de service, et connue de la CI.
grep -q '>>> ramure-v2 — DESACTIVEE' compose.yaml \
    || echoue "compose.yaml ne porte pas la note de desactivation — ./init.sh n'a pas regenere"
grep -qE '^\s*services:' compose.yaml || echoue "compose.yaml illisible"
grep -q 'ramure-v2:' compose.yaml \
    && echoue "un service ramure-v2 existe deja dans compose.yaml — l'image n'est pas publiee"
grep -q '"ramure-v2"' .github/workflows/build.yml \
    || echoue "le workflow ne connait pas ramure-v2 — la CI ne construira jamais son image"

echo "OK : echafaudage conforme, application desactivee comme prevu"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-01.sh
```

Attendu : ÉCHEC avec `ECHEC : apps/ramure-v2/app.yml absent`.

- [ ] **Étape 3 : implémenter**

N'écris pas `app.yml` à la main. `init.sh` en est l'auteur : il pose les
commentaires qui expliquent chaque clé, il fixe les valeurs par défaut, et
surtout il **régénère dans la foulée** `compose.yaml`, le workflow de CI,
`.claude/` et `.gitignore`. Un `app.yml` écrit à la main laisserait ces
artefacts en arrière, et `./init.sh --check` les refuserait en CI.

```bash
cd /home/user/hello-world
./init.sh --add ramure-v2 \
          --stack go --exposure google --ui \
          --port 8080 --health /healthz \
          --health-cmd 'wget --spider -q http://localhost:8080/healthz'
cp docs/PRD-RAMURE.md apps/ramure-v2/PRODUCT.md
```

Ce que chaque option décide, et pourquoi :

| Option | Effet | Pourquoi celle-là |
|---|---|---|
| `--add ramure-v2` | crée `apps/ramure-v2/` | le nom du répertoire **devient** le sous-domaine `ramure-v2.apps.billbob.ovh`, le `container_name` et le nom du routeur Traefik. Il doit rester un label DNS valide : ne le renomme jamais après coup. |
| `--exposure google` | middleware `forwardauth-open` | n'importe quel compte Google authentifié entre. Décision de l'index de la série. **Conséquence non négociable** : le cloisonnement des données par utilisateur devient obligatoire (PRP 07), puisque le visiteur n'est plus un membre de la liste blanche. |
| `--stack go` | déclare gopls dans l'outillage | sans effet sur le déploiement. Go est déjà présent dans la fabrique (`cadran`) : l'outillage ne change pas, il n'y a **rien à recoller** dans le *Setup script* de l'environnement. `./init.sh --check` le confirmera. |
| `--ui` | déclare `frontend-design`, `playwright`, `impeccable` | idem : déjà actif via `cadran`. Le renseigner reste utile — l'outillage est l'union de toutes les apps, y compris désactivées, et l'app ne doit pas dépendre de la présence d'une autre. |
| `--port 8080 --health /healthz` | recopiés dans le label Traefik `loadbalancer.server.port` et dans le healthcheck | une seule source de vérité. Le code ne relit pas ces valeurs depuis l'environnement : deux sources divergeraient en silence. |
| `--health-cmd 'wget …'` | commande exécutée **dans** le conteneur | c'est déjà la valeur par défaut pour ce port et ce chemin ; on l'écrit quand même, parce que c'est elle qui impose l'étage final `alpine` (tâche 7) et qu'un lecteur doit voir la contrainte, pas la deviner. |

Vérifie ensuite que `enabled` vaut bien `false` : c'est le seul point où une
erreur casserait les autres applications.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-01.sh
```

Attendu : PASS — `OK : echafaudage conforme, application desactivee comme prevu`.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2 compose.yaml .github/workflows/build.yml .gitignore .claude
git commit -m "ramure-v2 : echafaude l'application, desactivee jusqu'a sa premiere image"
```

`compose.yaml` et le workflow entrent dans ce commit **parce que le générateur
les a réécrits** : les laisser dehors ferait échouer `./init.sh --check` en CI
avec « artefact désynchronisé des manifestes ».

---

### Tâche 2 : le module Go et la route de santé

**Fichiers :**
- Créer : `apps/ramure-v2/go.mod`
- Créer : `apps/ramure-v2/main.go`
- Modifier (régénéré par `./init.sh`) : `go.work`
- Test : `apps/ramure-v2/main_test.go`

**Interfaces :**
- Consomme : `apps/ramure-v2/app.yml` (tâche 1) — `port: 8080`, `health_path: /healthz`.
- Produit :
  ```go
  // apps/ramure-v2/main.go
  func routes() http.Handler
  ```
  C'est **le point de greffe de toute la série** : PRP 04 y branche
  `GET /api/centre`, PRP 06 `GET /api/suggest`, PRP 07 les routes de collection.
  Produit aussi le chemin de module
  `github.com/billbob-space/hello-world/apps/ramure-v2`, dont découlent les
  imports internes des PRP suivants.

- [ ] **Étape 1 : écrire le test qui échoue**

Crée d'abord le module, puis régénère `go.work` — dans cet ordre.

```bash
cd /home/user/hello-world/apps/ramure-v2
go mod init github.com/billbob-space/hello-world/apps/ramure-v2
go mod edit -go=1.23
cd /home/user/hello-world && ./init.sh
```

Trois choses se jouent dans ces quatre lignes, et chacune casse silencieusement
si on l'ignore :

- **Le chemin de module suit la convention du dépôt** (`cadran` et
  `hello-world` font de même). Les PRP suivants importeront donc
  `github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache`. Un
  module nommé `ramure-v2` compilerait aussi, mais divergerait des deux autres
  applications sans raison.
- **`go mod edit -go=1.23`** : `go mod init` écrit la version du toolchain
  local (1.24.x). L'étage de construction du Dockerfile est `golang:1.23-alpine`
  (tâche 7) ; un `go.mod` réclamant 1.24 y échouerait avec
  `go.mod requires go >= 1.24`, une erreur qui n'apparaît **que dans Docker**,
  jamais sur le poste.
- **`./init.sh` régénère `go.work`**, qui liste les modules Go de la fabrique.
  Sans lui, une commande `go` lancée depuis `apps/ramure-v2` tombe en erreur de
  workspace au lieu de compiler — et le message masque celui qu'on cherche.

```go
// apps/ramure-v2/main_test.go
package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// appeler joue une requete contre le routeur reel, sans ouvrir de socket.
// Aucun test de cette application ne parle au reseau : PRD §13.
func appeler(t *testing.T, methode, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	routes().ServeHTTP(rec, httptest.NewRequest(methode, chemin, nil))
	return rec
}

// La sonde est ce que Traefik et Docker interrogent. Si elle ment, le
// conteneur est declare malsain en permanence et l'app n'est jamais servie.
func TestHealthzRepond200(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if corps := strings.TrimSpace(rec.Body.String()); corps != "ok" {
		t.Errorf("corps = %q, attendu \"ok\"", corps)
	}
}

// wget --spider ne lit pas le corps, mais un navigateur ouvert sur /healthz
// afficherait du HTML devine si le type n'est pas pose.
func TestHealthzEstDuTexteBrut(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("Content-Type = %q, attendu \"text/plain; charset=utf-8\"", ct)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : ÉCHEC avec `./main_test.go:16:2: undefined: routes` puis
`FAIL github.com/billbob-space/hello-world/apps/ramure-v2 [build failed]`.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/main.go
//
// ramure-v2 — le serveur qui portera l'arbre RAMURE.
//
// A ce stade il ne sait qu'une chose : dire qu'il est vivant. C'est
// volontaire. Le socle doit se prouver deployable avant de porter du produit :
// une app qui arrive en meme temps que sa premiere fonctionnalite ne dit pas
// laquelle des deux est cassee.
package main

import (
	"log"
	"net/http"
	"os"
)

// adresse d'ecoute, figee. Le port du conteneur est declare dans
// apps/ramure-v2/app.yml, d'ou init.sh le recopie dans le label Traefik
// loadbalancer.server.port. Le relire ici depuis l'environnement creerait une
// seconde source de verite, qui divergerait sans bruit.
const adresse = ":8080"

// routes construit le routeur de l'application. C'est le point de greffe de
// toutes les etapes suivantes de la serie : chaque PRP y ajoute ses routes,
// et aucun ne construit son propre ServeMux.
func routes() http.Handler {
	mux := http.NewServeMux()

	// La sonde de sante ne depend d'AUCUNE source externe, et c'est une
	// decision : une sonde qui interrogerait MusicBrainz declarerait le
	// conteneur malsain a la premiere panne de MusicBrainz, et Docker le
	// redemarrerait en boucle alors que l'application va bien (N-06).
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})

	return mux
}

func main() {
	// Journal sur la sortie standard : exigence de la fabrique, les fichiers
	// de log n'existent pas. Sans horodatage, parce que Docker en pose deja un
	// et que deux horodatages par ligne rendent le journal illisible.
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	log.Printf("ramure-v2 ecoute sur %s", adresse)
	if err := http.ListenAndServe(adresse, routes()); err != nil {
		log.Fatalf("ramure-v2 : arret du serveur : %v", err)
	}
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : PASS — `ok  github.com/billbob-space/hello-world/apps/ramure-v2`.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/go.mod apps/ramure-v2/main.go apps/ramure-v2/main_test.go go.work
git commit -m "ramure-v2 : sers la sonde de sante depuis un module Go"
```

---

### Tâche 3 : la page d'accueil provisoire et le 404 explicite

**Fichiers :**
- Créer : `apps/ramure-v2/web/index.html`
- Modifier : `apps/ramure-v2/main.go`
- Test : `apps/ramure-v2/main_test.go`

**Interfaces :**
- Consomme : `func routes() http.Handler` (tâche 2).
- Produit : `GET /` → `200`, `text/html; charset=utf-8`, page embarquée dans le
  binaire par `//go:embed web/index.html`. Tout autre chemin → `404`.

**Pourquoi une page, alors que le produit n'existe pas encore.** Servir un 404
sur `/` serait indiscernable de l'échec qu'on veut justement écarter : un
routeur *catch-all* capte `*.apps.billbob.ovh` par `HostRegexp`, et sa règle est
plus longue que le `Host()` de l'application. Traefik départageant par longueur
de règle, il gagnerait — et servirait un 404 silencieux. C'est ce que
`priority=100` dans `compose.yaml` empêche. Une page reconnaissable à la racine
est **la seule preuve visible** que c'est bien le conteneur `ramure-v2` qui
répond, et pas le catch-all.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajoute à `apps/ramure-v2/main_test.go` :

```go
func TestRacineSertLaPageDAccueil(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type = %q, attendu \"text/html; charset=utf-8\"", ct)
	}

	corps := rec.Body.String()
	if !strings.Contains(corps, `lang="fr"`) {
		t.Errorf("la page ne declare pas lang=\"fr\" — le produit est francophone")
	}
	if !strings.Contains(corps, "RAMURE") {
		t.Errorf("la page ne se nomme pas : impossible de distinguer cette reponse d'un catch-all")
	}
}

// Ce test est le seul qui attrape l'oubli de {$} dans le motif de route.
// Sans lui, GET / se comporte en prefixe et TOUT chemin inconnu renverrait la
// page d'accueil en 200 — y compris les futures routes /api mal orthographiees,
// qui repondraient du HTML a un client attendant du JSON.
func TestCheminInconnuRepond404(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/chemin-qui-nexiste-pas")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("code = %d pour un chemin inconnu, attendu 404", rec.Code)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : ÉCHEC avec
`--- FAIL: TestRacineSertLaPageDAccueil` / `code = 404, attendu 200`.

- [ ] **Étape 3 : implémenter**

Crée la page :

```html
<!-- apps/ramure-v2/web/index.html -->
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RAMURE</title>
<style>
  :root { color-scheme: dark light; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 5vw, 3rem);
    background: #0b0b0c;
    color: #ece7dc;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
  }
  main { max-width: 34rem; }
  h1 {
    margin: 0 0 .4rem;
    font-size: clamp(1.6rem, 7vw, 2.4rem);
    letter-spacing: .18em;
    font-weight: 600;
  }
  p.promesse { margin: 0 0 2rem; color: #f0a828; }
  p.etat { color: #8a867c; font-size: .9rem; }
</style>
</head>
<body>
<main>
  <h1>RAMURE</h1>
  <p class="promesse">Plante un nom, saute de branche en branche.</p>
  <p class="etat">
    Le socle est en ligne : le serveur repond, l'image est publiee, la stack
    tient debout. Le canevas et l'arbre arrivent aux etapes suivantes de la
    serie. La version servie est dans l'en-tete <code>X-Ramure-Version</code>.
  </p>
</main>
</body>
</html>
```

Aucune ressource distante, aucune police chargée, aucun script : la page doit
s'afficher entière sur un poste hors réseau, et le sera de toute façon
remplacée par le PRP 06.

Puis modifie `apps/ramure-v2/main.go`. Ajoute l'import `_ "embed"`, la variable
embarquée, et remplace `routes()` :

```go
import (
	_ "embed" // pour la directive go:embed ci-dessous
	"log"
	"net/http"
	"os"
)

// La page est embarquee dans le binaire : l'image finale ne porte qu'un
// executable, aucun fichier a monter, aucun repertoire a creer au demarrage.
// On embarque le FICHIER et non le repertoire web/ : les etapes suivantes y
// ajouteront des sources TypeScript et un repertoire de compilation, qui
// n'ont rien a faire dans le binaire.
//
//go:embed web/index.html
var accueilHTML []byte

func routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})

	// {$} impose une correspondance EXACTE sur "/". Sans lui, "GET /" est un
	// motif de prefixe qui capte tous les chemins inconnus : ils repondraient
	// 200 avec la page d'accueil au lieu de 404.
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(accueilHTML)
	})

	return mux
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : PASS — les quatre tests au vert.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/web/index.html apps/ramure-v2/main.go apps/ramure-v2/main_test.go
git commit -m "ramure-v2 : sers une page d'accueil provisoire et un 404 explicite"
```

---

### Tâche 4 : l'identité de la version dans chaque réponse

**Fichiers :**
- Modifier : `apps/ramure-v2/main.go`
- Test : `apps/ramure-v2/main_test.go`

**Interfaces :**
- Consomme : `func routes() http.Handler` (tâche 2).
- Produit : `var version string` (valeur `"dev"` par défaut, posée à la
  construction par `-ldflags "-X main.version=…"`), et l'en-tête
  **`X-Ramure-Version`** sur **toutes** les réponses, y compris les 404.

**Pourquoi un en-tête plutôt qu'une mention sur la page.** Le tag `:main` de
GHCR est mutable : rien ne distingue visuellement une image d'hier d'une image
de ce matin. Sans marqueur de version, « le correctif est-il en ligne ? » se
répond par une conjecture. L'en-tête est lisible par `curl -I`, survit au
remplacement de la page d'accueil par le PRP 06, et sera l'ancre naturelle des
tests de bout en bout du PRP 09.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajoute à `apps/ramure-v2/main_test.go` :

```go
// Une construction locale ne doit jamais se faire passer pour une image
// deployee : "dev" est la valeur qui le garantit quand -ldflags est absent.
func TestVersionParDefaut(t *testing.T) {
	if version != "dev" {
		t.Fatalf("version = %q, attendu \"dev\" hors construction CI", version)
	}
}

// Y compris sur un 404 : c'est souvent la reponse qu'on capture quand quelque
// chose ne va pas, et c'est donc la ou l'on veut savoir quelle image repond.
func TestChaqueReponsePorteLaVersion(t *testing.T) {
	precedente := version
	version = "essai-42"
	defer func() { version = precedente }()

	for _, chemin := range []string{"/", "/healthz", "/chemin-qui-nexiste-pas"} {
		rec := appeler(t, http.MethodGet, chemin)
		if v := rec.Header().Get("X-Ramure-Version"); v != "essai-42" {
			t.Errorf("%s : X-Ramure-Version = %q, attendu \"essai-42\"", chemin, v)
		}
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : ÉCHEC avec `undefined: version` puis
`FAIL github.com/billbob-space/hello-world/apps/ramure-v2 [build failed]`.

- [ ] **Étape 3 : implémenter**

Dans `apps/ramure-v2/main.go`, ajoute la variable et l'enveloppe, et fais
retourner l'enveloppe par `routes()` :

```go
// version identifie l'image qui repond. Elle est posee a la construction par
// -ldflags "-X main.version=..." — la CI y met le SHA du commit — et vaut
// "dev" en construction locale. Le tag :main de GHCR etant mutable, c'est le
// seul moyen de savoir QUELLE image est en ligne.
var version = "dev"

// entetes pose sur chaque reponse ce qui ne depend pas de la route.
// Le Header() est ecrit AVANT que le gestionnaire n'appelle WriteHeader :
// une fois le statut envoye, les en-tetes sont figes et l'ajout serait perdu
// sans la moindre erreur.
func entetes(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Ramure-Version", version)
		suivant.ServeHTTP(w, r)
	})
}
```

et, à la fin de `routes()`, remplace `return mux` par :

```go
	// L'enveloppe est DANS routes() et non dans main() : les tests appellent
	// routes(), et un en-tete pose ailleurs ne serait jamais verifie.
	return entetes(mux)
```

Enfin, fais dire la version au démarrage — c'est la première ligne du journal
d'un conteneur, celle qu'on lit en cas de doute :

```go
	log.Printf("ramure-v2 %s ecoute sur %s", version, adresse)
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : PASS — six tests au vert.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/main.go apps/ramure-v2/main_test.go
git commit -m "ramure-v2 : pose la version de l'image dans chaque reponse"
```

---

### Tâche 5 : le journal d'accès sur la sortie standard

**Fichiers :**
- Modifier : `apps/ramure-v2/main.go`
- Test : `apps/ramure-v2/main_test.go`

**Interfaces :**
- Consomme : `func routes() http.Handler` (tâche 2).
- Produit :
  ```go
  func journal(suivant http.Handler) http.Handler
  ```
  Appliquée dans `main()` autour de `routes()`. Écrit une ligne
  `MÉTHODE CHEMIN CODE DURÉEms` sur la sortie standard, **ignore `/healthz`**,
  et **n'écrit jamais l'identité de l'utilisateur**.

**Trois décisions, trois raisons.** *(a)* La sortie standard est le seul canal
de journalisation autorisé par la fabrique — pas de fichier, pas de rotation à
gérer, `json-file` borné à 10 Mo × 3 côté serveur. *(b)* La sonde est ignorée :
Docker l'appelle toutes les 30 s, soit 2 880 lignes par jour et par conteneur,
qui noieraient tout le reste. *(c)* L'identité n'est jamais journalisée :
l'application est en palier `google`, donc `X-Forwarded-User` porte l'adresse
e-mail de n'importe quel compte Google — une donnée personnelle qui n'a aucune
raison d'être écrite sur le disque du serveur pour diagnostiquer une requête.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajoute à `apps/ramure-v2/main_test.go` (et l'import `"bytes"` et `"log"`) :

```go
// capturerJournal detourne la sortie du journal le temps du test.
func capturerJournal(t *testing.T) *bytes.Buffer {
	t.Helper()
	var tampon bytes.Buffer
	precedent := log.Writer()
	precedents := log.Flags()
	log.SetOutput(&tampon)
	log.SetFlags(0)
	t.Cleanup(func() { log.SetOutput(precedent); log.SetFlags(precedents) })
	return &tampon
}

func TestLeJournalNoteLaRequeteEtSonCode(t *testing.T) {
	tampon := capturerJournal(t)

	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/inconnu", nil))

	ligne := strings.TrimSpace(tampon.String())
	if !strings.HasPrefix(ligne, "GET /inconnu 404 ") {
		t.Fatalf("journal = %q, attendu un prefixe \"GET /inconnu 404 \"", ligne)
	}
	if !strings.HasSuffix(ligne, "ms") {
		t.Errorf("journal = %q, la duree devrait terminer la ligne", ligne)
	}
}

// Un gestionnaire qui n'appelle jamais WriteHeader repond 200 : le journal
// doit dire 200, pas 0.
func TestLeJournalNoteDeuxCentsSansWriteHeader(t *testing.T) {
	tampon := capturerJournal(t)

	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if ligne := strings.TrimSpace(tampon.String()); !strings.HasPrefix(ligne, "GET / 200 ") {
		t.Fatalf("journal = %q, attendu un prefixe \"GET / 200 \"", ligne)
	}
}

// Palier google : X-Forwarded-User porte l'adresse e-mail d'un compte Google.
// Elle n'a rien a faire dans un journal d'acces.
func TestLeJournalNEcritPasLIdentite(t *testing.T) {
	tampon := capturerJournal(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-User", "amuteau@gmail.com")
	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})).
		ServeHTTP(httptest.NewRecorder(), req)

	if strings.Contains(tampon.String(), "amuteau@gmail.com") {
		t.Fatalf("le journal ecrit l'identite de l'utilisateur : %q", tampon.String())
	}
}

// Docker appelle la sonde toutes les 30 s : 2880 lignes par jour et par
// conteneur, qui noieraient tout ce qu'on cherche a lire.
func TestLeJournalIgnoreLaSonde(t *testing.T) {
	tampon := capturerJournal(t)

	journal(routes()).ServeHTTP(
		httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/healthz", nil),
	)

	if tampon.Len() != 0 {
		t.Fatalf("la sonde est journalisee : %q", tampon.String())
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : ÉCHEC avec `undefined: journal` puis
`FAIL github.com/billbob-space/hello-world/apps/ramure-v2 [build failed]`.

- [ ] **Étape 3 : implémenter**

Ajoute à `apps/ramure-v2/main.go` (imports `"time"` en plus) :

```go
// traceur retient le code de reponse, que http.ResponseWriter ne rend pas.
// Le defaut est 200 : un gestionnaire qui ecrit sans appeler WriteHeader
// repond bien 200, et un journal affichant 0 ferait chercher un bogue absent.
type traceur struct {
	http.ResponseWriter
	code int
}

func (t *traceur) WriteHeader(code int) {
	t.code = code
	t.ResponseWriter.WriteHeader(code)
}

// journal ecrit une ligne par requete sur la sortie standard.
//
// Ce qu'il n'ecrit PAS est aussi important que ce qu'il ecrit :
//   - ni X-Forwarded-User ni aucun en-tete : l'app est en palier google, cet
//     en-tete porte une adresse e-mail, et un journal n'est pas l'endroit ou
//     conserver l'identite de quelqu'un ;
//   - ni la chaine de requete : elle portera la graine saisie par
//     l'utilisateur (PRP 04), c'est-a-dire ce qu'il ecoute ;
//   - ni la sonde de sante, appelee toutes les 30 s par Docker.
func journal(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			suivant.ServeHTTP(w, r)
			return
		}
		debut := time.Now()
		tr := &traceur{ResponseWriter: w, code: http.StatusOK}
		suivant.ServeHTTP(tr, r)
		log.Printf("%s %s %d %dms", r.Method, r.URL.Path, tr.code,
			time.Since(debut).Milliseconds())
	})
}
```

et, dans `main()`, enveloppe le routeur :

```go
	log.Printf("ramure-v2 %s ecoute sur %s", version, adresse)
	if err := http.ListenAndServe(adresse, journal(routes())); err != nil {
		log.Fatalf("ramure-v2 : arret du serveur : %v", err)
	}
```

L'enveloppe est posée dans `main()` et non dans `routes()` : ainsi la suite de
tests, qui appelle `routes()` des centaines de fois, ne noie pas sa propre
sortie sous des lignes de journal.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./...
```

Attendu : PASS — dix tests au vert.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/main.go apps/ramure-v2/main_test.go
git commit -m "ramure-v2 : journalise les acces sans l'identite ni la sonde"
```

---

### Tâche 6 : `test.sh`, le contrat de test de la fabrique

**Fichiers :**
- Modifier : `apps/ramure-v2/test.sh` (créé par l'échafaudage, avec un `TODO`)
- Test : bloc bash ci-dessous, lancé depuis la racine (non versionné : le livrable est `test.sh`)

**Interfaces :**
- Consomme : le module Go et ses tests (tâches 2 à 5).
- Produit : `apps/ramure-v2/test.sh`, exécutable, **seul point d'entrée que la
  CI connaît** pour cette application.

**Ce qui se joue ici.** Le job `test` du workflow lance `./apps/ramure-v2/test.sh`
et rien d'autre : la fabrique n'a pas à savoir que l'application est écrite en
Go. Le fichier échafaudé se contente d'afficher `TODO` et **sort en 0** — il est
donc *vert* alors qu'il ne teste rien. C'est exactement le genre de faux vert
qu'un plan doit éliminer avant qu'il ne s'installe : on écrit donc un test qui
introduit une faute et exige que `test.sh` la voie.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 6 — depuis la racine du depot.
# Un test.sh qui ne detecte pas une faute est pire qu'absent : il rend vert
# un job de CI qui ne verifie rien.
set -uo pipefail
cd /home/user/hello-world

fautif=apps/ramure-v2/fautif_temporaire.go
cat > "$fautif" <<'GO'
package main

// Faute de type volontaire : go vet comme go test doivent la refuser.
func fautif() int { return "une chaine" }
GO

if ./apps/ramure-v2/test.sh >/dev/null 2>&1; then
  rm -f "$fautif"
  echo "ECHEC : test.sh a rendu 0 alors que le paquet ne compile pas"
  exit 1
fi
rm -f "$fautif"

if ! ./apps/ramure-v2/test.sh; then
  echo "ECHEC : test.sh echoue sur un paquet sain"
  exit 1
fi

# La CI l'appelle depuis la racine du depot : le chemin relatif doit tenir.
[ -x apps/ramure-v2/test.sh ] || { echo "ECHEC : test.sh non executable"; exit 1; }

echo "OK : test.sh voit une faute et laisse passer un paquet sain"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-06.sh
```

Attendu : ÉCHEC avec
`ECHEC : test.sh a rendu 0 alors que le paquet ne compile pas`.

- [ ] **Étape 3 : implémenter**

```bash
#!/usr/bin/env bash
# apps/ramure-v2/test.sh
#
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
# Il est appele depuis la racine du depot (./apps/ramure-v2/test.sh), d'ou le
# cd : les commandes Go doivent tourner dans le module, pas au-dessus.
#
# set -e est indispensable : sans lui, l'echec de go vet serait avale par le
# code de sortie de la derniere commande, et la CI resterait verte.
set -euo pipefail
cd "$(dirname "$0")"

# go vet d'abord : il attrape les fautes que le compilateur laisse passer
# (verbes de format, copies de mutex) et coute quelques secondes.
go vet ./...
go test ./...
```

```bash
chmod +x apps/ramure-v2/test.sh
```

Le fichier ne mentionne **ni** TypeScript **ni** Playwright : ils n'existent pas
encore. Les PRP 05 et 06 y ajouteront `tsc` et `vitest`, le PRP 09 y réglera le
sort du bout en bout.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-06.sh
```

Attendu : PASS — `OK : test.sh voit une faute et laisse passer un paquet sain`.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/test.sh
git commit -m "ramure-v2 : declare go vet et go test dans test.sh"
```

---

### Tâche 7 : le `Dockerfile` multi-étages et la taille de l'image

**Fichiers :**
- Créer : `apps/ramure-v2/Dockerfile`
- Test : bloc bash ci-dessous, lancé depuis la racine (non versionné : le livrable est le `Dockerfile`)

**Interfaces :**
- Consomme : `var version` (tâche 4) — cible du `-X main.version` ;
  `apps/ramure-v2/app.yml` (tâche 1) — `health_cmd` fondé sur `wget`.
- Produit : `ghcr.io/billbob-space/hello-world/ramure-v2:main`, construite par la
  CI avec `--build-arg VERSION=<sha>`, contexte `apps/ramure-v2`, utilisateur
  `10001`, taille sous 200 Mo.

**Si le démon Docker n'est pas disponible dans ta session**, cette tâche ne peut
pas être déclarée finie localement. Le job `build` de la CI exécute exactement
la même construction sur la pull request, **sans publier** — ne passe pas à la
suite avant de l'avoir vu au vert.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 7 — depuis la racine du depot.
set -euo pipefail
cd /home/user/hello-world

echoue() { echo "ECHEC : $1"; exit 1; }
nettoyer() { docker rm -f ramure-essai >/dev/null 2>&1 || true; }
trap nettoyer EXIT

# 1. La construction, avec la version injectee comme le fait la CI.
docker build --build-arg VERSION=essai-42 -t ramure-v2:essai apps/ramure-v2

# 2. Aucun LABEL traefik.* : un label de routage grave dans l'image est
#    fusionne dans ceux du conteneur et publie un routeur SUPPLEMENTAIRE, que
#    compose.yaml ne peut pas ecraser puisqu'il porte un autre nom — donc sans
#    aucun middleware d'authentification.
grep -qi 'traefik\.' apps/ramure-v2/Dockerfile \
  && echoue "LABEL traefik.* dans le Dockerfile — publierait une route SANS authentification"

# 3. Construction multi-etapes.
grep -qE '^FROM .+ AS ' apps/ramure-v2/Dockerfile \
  || echoue "pas de construction multi-etapes : la chaine Go finirait dans l'image"

# 4. Taille : le disque du serveur est a 92 %, plafond 200 Mo (fabrique.yml).
mo=$(( $(docker image inspect ramure-v2:essai --format '{{.Size}}') / 1024 / 1024 ))
echo "image : ${mo} Mo"
[ "$mo" -lt 200 ] || echoue "image de ${mo} Mo, plafond 200 Mo"

# 5. Utilisateur non root.
uid=$(docker run --rm --entrypoint id ramure-v2:essai -u)
[ "$uid" = "10001" ] || echoue "l'app tourne sous l'uid $uid, attendu 10001"

# 6. wget existe dans l'image finale : c'est ce que health_cmd appellera.
docker run --rm --entrypoint sh ramure-v2:essai -c 'command -v wget' >/dev/null \
  || echoue "wget absent de l'image finale — le health_cmd d'app.yml echouerait a chaque fois"

# 7. Le binaire sert vraiment, et porte la version injectee.
#    -p 8099:8080 n'est valable QUE pour cet essai local : compose.yaml n'a
#    aucune section ports:, Traefik joint le conteneur par le reseau apps_net.
docker run --rm -d --name ramure-essai -p 8099:8080 ramure-v2:essai >/dev/null
for _ in $(seq 1 20); do
  curl -fsS http://localhost:8099/healthz >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS http://localhost:8099/healthz | grep -qx 'ok' \
  || echoue "/healthz ne repond pas 'ok' depuis le conteneur"
curl -fsS -D- -o /dev/null http://localhost:8099/ | tr -d '\r' \
  | grep -qx 'X-Ramure-Version: essai-42' \
  || echoue "X-Ramure-Version absent ou faux : ARG VERSION n'atteint pas le binaire"

echo "OK : image de ${mo} Mo, uid 10001, wget present, version essai-42 servie"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-07.sh
```

Attendu : ÉCHEC dès la construction, avec
`failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory`.

- [ ] **Étape 3 : implémenter**

```dockerfile
# apps/ramure-v2/Dockerfile
#
# Le contexte de construction est apps/ramure-v2, JAMAIS la racine du depot :
# c'est ce qui empeche une edition dans cadran ou hello-world d'invalider le
# cache de couches de celle-ci, et inversement.

FROM golang:1.23-alpine AS serveur
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod bouge.
# go.sum n'existe pas tant que l'application n'a aucune dependance externe ; le
# motif go.su[m] le rend optionnel sans faire echouer le COPY le jour ou il
# apparaitra (PRP 02 et suivants).
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .

# Identifiant de la version deployee. La CI passe le SHA du commit
# (build-args: VERSION=${{ github.sha }}) ; une construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, donc executable tel quel dans l'image
# finale sans embarquer la libc de l'etage de construction.
# -trimpath retire les chemins du poste de construction du binaire ;
# -s -w retirent la table des symboles : quelques megaoctets de moins.
RUN CGO_ENABLED=0 go build -trimpath \
        -ldflags "-s -w -X main.version=${VERSION}" \
        -o /out/ramure-v2 .

FROM alpine:3.20
# alpine et non scratch : busybox y fournit wget, dont le health_cmd declare
# dans app.yml a besoin. Une image scratch ou distroless n'a aucun shell et
# imposerait health_cmd: none — donc un conteneur dont personne ne sait s'il
# va bien.
RUN adduser -D -H -u 10001 ramure

COPY --from=serveur /out/ramure-v2 /usr/local/bin/ramure-v2

# Aucun port n'est publie : Traefik joint le conteneur par le reseau apps_net,
# et compose.yaml n'a pas de section ports:. EXPOSE ne fait que documenter.
EXPOSE 8080

# L'application ne tourne pas en root : exigence de la fabrique, verifiee par
# ./init.sh --check.
USER ramure
ENTRYPOINT ["/usr/local/bin/ramure-v2"]
```

Deux absences volontaires : **aucun `LABEL traefik.*`** (le routage vit dans
`compose.yaml`, un label gravé dans l'image publierait un routeur parallèle sans
authentification) et **aucune instruction `HEALTHCHECK`** (le healthcheck est
posé par `compose.yaml` depuis `app.yml` ; en graver un second dans l'image
créerait une deuxième source de vérité qui divergerait en silence).

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-07.sh
```

Attendu : PASS —
`OK : image de 15 Mo, uid 10001, wget present, version essai-42 servie`
(la taille exacte varie de quelques mégaoctets, le seuil est 200).

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/Dockerfile
git commit -m "ramure-v2 : construis l'image en deux etages sur alpine"
```

---

### Tâche 8 : le conteneur sain et l'arrêt propre

**Fichiers :**
- Modifier : `apps/ramure-v2/main.go`
- Test : bloc bash ci-dessous, lancé depuis la racine (non versionné)

**Interfaces :**
- Consomme : l'image `ramure-v2:essai` (tâche 7), `health_cmd` d'`app.yml` (tâche 1).
- Produit : un conteneur que Docker déclare `healthy`, et qui s'arrête sur
  `SIGTERM` en moins d'une seconde.

**Pourquoi les deux dans la même tâche.** Ce sont les deux seuls comportements
que seul un vrai conteneur peut prouver, et ils se lisent au même endroit — la
sortie de `docker inspect`. Le `health_cmd` n'est pas testable par `go test` :
il s'exécute *dans* l'image, avec les outils de l'image. Et l'arrêt propre ne se
mesure qu'au chronomètre : sans gestionnaire de `SIGTERM`, `docker stop` attend
**dix secondes** avant de tuer le processus, et ces dix secondes s'ajoutent à
chaque redéploiement de la stack — pour toutes les applications, puisque le
`compose up` est unique.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 8 — depuis la racine du depot.
set -euo pipefail
cd /home/user/hello-world

echoue() { echo "ECHEC : $1"; exit 1; }
nettoyer() { docker rm -f ramure-sante >/dev/null 2>&1 || true; }
trap nettoyer EXIT

docker build -t ramure-v2:essai apps/ramure-v2 >/dev/null

# On lit la commande dans app.yml plutot que de la retaper : c'est celle que
# compose.yaml portera, et c'est elle qu'il faut eprouver.
cmd=$(sed -nE 's/^health_cmd:[[:space:]]*//p' apps/ramure-v2/app.yml | head -1)
[ -n "$cmd" ] || echoue "health_cmd introuvable dans apps/ramure-v2/app.yml"
echo "health_cmd : $cmd"

docker run -d --name ramure-sante \
  --health-cmd "$cmd" --health-interval 2s --health-timeout 5s --health-retries 3 \
  ramure-v2:essai >/dev/null

etat=starting
for _ in $(seq 1 20); do
  etat=$(docker inspect --format '{{.State.Health.Status}}' ramure-sante)
  [ "$etat" = healthy ] && break
  sleep 1
done
[ "$etat" = healthy ] || { docker logs ramure-sante; echoue "conteneur $etat — le health_cmd ne passe pas dans l'image"; }

# Arret propre : SIGTERM doit suffire. Sans gestionnaire, docker stop attend
# dix secondes puis tue le processus.
debut=$(date +%s)
docker stop ramure-sante >/dev/null
duree=$(( $(date +%s) - debut ))
[ "$duree" -lt 3 ] || echoue "docker stop a pris ${duree}s — SIGTERM ignore"

# Et la fermeture doit se dire dans le journal, sinon un arret brutal et un
# arret propre se ressemblent trop pour etre distingues apres coup.
docker logs ramure-sante 2>&1 | grep -q 'arret demande' \
  || echoue "aucune trace d'arret propre dans le journal du conteneur"

echo "OK : conteneur healthy, arret propre en ${duree}s"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-08.sh
```

Attendu : ÉCHEC avec `ECHEC : docker stop a pris 10s — SIGTERM ignore`.
(La partie santé, elle, passe déjà : `wget` est dans l'image depuis la tâche 7.
C'est voulu — le test verrouille les deux comportements, et seul le second
manque.)

- [ ] **Étape 3 : implémenter**

Remplace `main()` dans `apps/ramure-v2/main.go`, et ajoute les imports
`"context"`, `"errors"`, `"os/signal"`, `"syscall"` :

```go
func main() {
	// Journal sur la sortie standard : exigence de la fabrique, les fichiers
	// de log n'existent pas. Sans horodatage, Docker en pose deja un.
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	srv := &http.Server{
		Addr:    adresse,
		Handler: journal(routes()),
		// Un client qui ouvre une connexion sans jamais finir ses en-tetes
		// immobiliserait une goroutine indefiniment.
		ReadHeaderTimeout: 10 * time.Second,
	}

	// docker stop envoie SIGTERM puis attend DIX SECONDES avant de tuer le
	// processus. Sans ce gestionnaire, ces dix secondes s'ajoutent a chaque
	// redeploiement de la stack — qui est unique, donc a celui de toutes les
	// applications de la fabrique.
	arret := make(chan os.Signal, 1)
	signal.Notify(arret, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-arret
		log.Println("ramure-v2 : arret demande, fermeture des connexions en cours")
		ctx, annuler := context.WithTimeout(context.Background(), 10*time.Second)
		defer annuler()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("ramure-v2 : fermeture incomplete : %v", err)
		}
	}()

	log.Printf("ramure-v2 %s ecoute sur %s", version, adresse)
	// Shutdown fait rendre ErrServerClosed a ListenAndServe : c'est la sortie
	// NORMALE. La traiter comme une erreur ferait sortir le conteneur en code
	// non nul, donc redemarrer par restart: unless-stopped, en boucle.
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("ramure-v2 : arret du serveur : %v", err)
	}
	log.Println("ramure-v2 : arrete")
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-08.sh
cd /home/user/hello-world/apps/ramure-v2 && go vet ./... && go test ./...
```

Attendu : PASS — `OK : conteneur healthy, arret propre en 0s`, et les dix tests
Go toujours au vert.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/main.go
git commit -m "ramure-v2 : arrete le serveur proprement sur SIGTERM"
```

---

### Tâche 9 : le `README` — les variables d'environnement par leur nom

**Fichiers :**
- Modifier : `apps/ramure-v2/README.md` (échafaudé avec des `TODO`)
- Test : bloc bash ci-dessous, lancé depuis la racine (non versionné)

**Interfaces :**
- Consomme : rien du code.
- Produit : la déclaration, **par leur nom seulement**, de `LASTFM_API_KEY` et
  `RAMURE_DATA_DIR`. C'est le document que lit l'exploitant du serveur : les
  valeurs sont injectées par l'infrastructure, jamais versionnées.

**Pourquoi maintenant, alors qu'aucune ligne de code ne les lit encore.** Parce
que le `README` d'une application **est** sa demande à l'exploitant, et qu'une
demande formulée après la mise en ligne arrive trop tard : il faut alors un
second déploiement pour la satisfaire. `LASTFM_API_KEY` sera lue par le PRP 03,
`RAMURE_DATA_DIR` par le PRP 07 ; les deux sont facultatives, et leur absence
dégrade une fonction sans casser l'écran (N-06). Écrire une valeur ici — même
« pour essayer » — la publierait : le dépôt est lisible par tous ceux qui le
clonent.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 9 — depuis la racine du depot.
set -uo pipefail
cd /home/user/hello-world

R=apps/ramure-v2/README.md
echoue() { echo "ECHEC : $1"; exit 1; }
exige() { grep -q -- "$1" "$R" || echoue "$2"; }

[ -f "$R" ] || echoue "$R absent"

exige 'LASTFM_API_KEY'  "LASTFM_API_KEY n'est pas declaree"
exige 'RAMURE_DATA_DIR' "RAMURE_DATA_DIR n'est pas declaree"
exige 'ramure-v2.apps.billbob.ovh' "l'URL de l'application n'est pas dite"
exige 'X-Forwarded-User' "la source d'identite n'est pas dite"
exige '/healthz' "la sonde de sante n'est pas documentee"

grep -q 'TODO' "$R" && echoue "des TODO d'echafaudage subsistent dans le README"

# Aucune valeur ne doit accompagner un nom qui ressemble a un secret.
if grep -rniE '(api[_-]?key|token|secret|password)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_-]{12,}' \
     apps/ramure-v2/ ; then
  echoue "une valeur ressemblant a un secret est versionnee dans apps/ramure-v2/"
fi

echo "OK : variables declarees par leur nom, aucune valeur versionnee"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-09.sh
```

Attendu : ÉCHEC avec `ECHEC : LASTFM_API_KEY n'est pas declaree`.

- [ ] **Étape 3 : implémenter**

````markdown
<!-- apps/ramure-v2/README.md -->
# ramure-v2

**Plante un nom, saute de branche en branche.** Exploration généalogique de la
musique : un artiste au centre, ses parents musicaux en orbite, leurs héritiers
autour d'eux ; chaque clic promeut une branche au centre et fait repousser
l'arbre.

URL : <https://ramure-v2.apps.billbob.ovh> — authentification : `google`,
c'est-à-dire **n'importe quel compte Google authentifié**. Traefik authentifie
avant que la requête n'atteigne l'application ; il n'y a pas de palier public
dans cette fabrique, et il n'y a pas de système de comptes à coder ici.

Le produit complet est décrit par [PRODUCT.md](PRODUCT.md) ; la série de plans
qui le construit est dans
[docs/superpowers/plans/ramure-v2/](../../docs/superpowers/plans/ramure-v2/README.md).

## État

Socle déployable. Le serveur répond, l'image se construit et se publie, la
stack tient debout. Le canevas, l'arbre et les sources de données arrivent aux
étapes suivantes de la série.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | la page d'accueil (provisoire à ce stade) |
| `GET /healthz` | `200 ok`, texte brut, dès que le serveur écoute |

Tout autre chemin renvoie 404.

Chaque réponse porte l'en-tête **`X-Ramure-Version`** : le tag `:main` de GHCR
étant mutable, c'est le seul moyen de savoir quelle image est réellement en
ligne.

```bash
curl -sI https://ramure-v2.apps.billbob.ovh/ | grep X-Ramure-Version
```

La sonde `/healthz` ne consulte aucune source externe, volontairement : une
panne de MusicBrainz ne doit pas faire redémarrer le conteneur en boucle.

## Identité

L'identité de l'utilisateur connecté arrive dans l'en-tête HTTP
**`X-Forwarded-User`** (son adresse e-mail), posé par Traefik. C'est la seule
source d'identité admissible : jamais un paramètre d'URL, un corps de requête
ou un cookie applicatif. Le palier étant `google`, le cloisonnement des données
par utilisateur n'est pas optionnel.

Le journal d'accès n'écrit **ni** cette adresse **ni** la chaîne de requête, et
ignore la sonde de santé.

## Variables d'environnement

Aucune valeur n'est versionnée : seuls les noms le sont. Elles sont injectées
par l'infrastructure, côté serveur.

| Nom | Obligatoire | Rôle |
|---|---|---|
| `LASTFM_API_KEY` | non | Clé Last.fm, source de proximité entre artistes. Absente, l'application bascule sur ListenBrainz : l'affinité est moins fine, rien n'est cassé. |
| `RAMURE_DATA_DIR` | non | Répertoire de persistance de la collection. Absent, la collection est volatile et l'application le journalise au démarrage. |

Aucune des deux n'est lue par le code à ce stade : elles sont déclarées
maintenant parce que ce fichier est la demande adressée à l'exploitant, et
qu'une demande formulée après la mise en ligne coûte un déploiement de plus.

## Développement

Depuis ce répertoire :

```bash
go test ./...
go run .                       # ecoute sur :8080
curl -i localhost:8080/healthz
```

Depuis la racine du dépôt, comme le fait la CI :

```bash
./apps/ramure-v2/test.sh
docker build -t ramure-v2 apps/ramure-v2
```

## Technologie

Go 1.23, bibliothèque standard uniquement à ce stade. La page d'accueil est
embarquée dans le binaire par `go:embed` : l'image finale ne porte qu'un
exécutable, aucun fichier à monter, aucun répertoire à créer au démarrage.

Image finale sur `alpine` et non `scratch` : c'est busybox qui fournit le
`wget` du `health_cmd` déclaré dans `app.yml`. Utilisateur `10001`, non root,
aucun port publié.

## Ce que cette application ne fait pas

Elle n'héberge aucune musique, ne gère aucun compte, n'écrit aucun secret et
n'ouvre aucun port sur l'hôte. Elle ne parle à aucune source externe depuis le
navigateur : tous les appels partent du serveur.
````

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-09.sh
```

Attendu : PASS — `OK : variables declarees par leur nom, aucune valeur versionnee`.

- [ ] **Étape 5 : commit**

```bash
git add apps/ramure-v2/README.md
git commit -m "ramure-v2 : declare les variables d'environnement attendues"
```

---

### Tâche 10 : le contrat vérifié et l'image publiée

**Fichiers :**
- Modifier : aucun. Cette tâche fait franchir aux neuf précédentes la frontière
  du dépôt.
- Test : bloc bash ci-dessous, lancé depuis la racine (non versionné)

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : `ghcr.io/billbob-space/hello-world/ramure-v2:main`, tirable — la
  condition d'entrée du PRP 09, qui seul activera l'application dans la stack.

- [ ] **Étape 1 : écrire le test qui échoue**

```bash
#!/usr/bin/env bash
# Verification de la tache 10 — depuis la racine du depot.
set -uo pipefail
cd /home/user/hello-world

echoue() { echo "ECHEC : $1"; exit 1; }

# 1. Le contrat de la fabrique, service par service. C'est le meme controle qui
#    tourne en CI, en verrou de tous les autres jobs.
./init.sh --check || echoue "./init.sh --check signale des points bloquants"

# 2. L'application est presente ET desactivee : l'activer avant la publication
#    de l'image ferait echouer le compose up de TOUTES les apps.
./init.sh --list | grep -E '^ramure-v2 ' | grep -q 'desactivee' \
  || echoue "ramure-v2 n'est pas desactivee — le PRP 09 seul a le droit de l'activer"

# 3. L'image existe sur le registre. C'est le seul point que le depot ne peut
#    pas prouver seul : il faut que la CI soit passee sur main.
docker buildx imagetools inspect \
  ghcr.io/billbob-space/hello-world/ramure-v2:main >/dev/null 2>&1 \
  || echoue "ghcr.io/billbob-space/hello-world/ramure-v2:main introuvable"

echo "OK : contrat respecte, app desactivee, image publiee"
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world && bash /tmp/verif-tache-10.sh
```

Attendu : ÉCHEC avec
`ECHEC : ghcr.io/billbob-space/hello-world/ramure-v2:main introuvable`
(les points 1 et 2 passent déjà : le dépôt est cohérent, l'image seule manque).

- [ ] **Étape 3 : implémenter**

Pousse la branche et ouvre la pull request :

```bash
cd /home/user/hello-world
git push -u origin claude/parallel-dev-versions-8d5g9c
gh pr create --fill --title "ramure-v2 : socle deployable"
gh pr checks --watch
```

Ce que fait la CI, dans cet ordre, et ce que chaque job prouve :

| Job | Ce qu'il lance | Ce qu'il prouve |
|---|---|---|
| `contrat` | `./init.sh --check` | les artefacts dérivés correspondent aux manifestes. Il **verrouille tous les autres jobs** : avec une stack partagée, un compose faux fusionné casserait les trois applications d'un coup. |
| `detect` | un `git diff` sur les chemins `apps/<nom>/` | seule `ramure-v2` a bougé : `cadran` et `hello-world` ne sont ni retestées ni reconstruites. |
| `test` | `./apps/ramure-v2/test.sh` | `go vet` et `go test` au vert, dans un environnement qui n'est pas le tien. |
| `build` | `docker build` sur le contexte `apps/ramure-v2` | le `Dockerfile` construit ailleurs que sur ton poste, et l'image tient sous 200 Mo. **Sur une pull request, `push: false`** : on valide sans publier, pour ne pas bouger le tag `:main` que le serveur suit. |

**Sur la pull request, l'image n'est donc pas publiée.** Elle ne l'est qu'à la
fusion sur `main`, où le même workflow rejoue avec `push: true` et pousse deux
tags : `:main` et `:<sha>`. Le job `deploy`, lui, ne fera rien d'utile pour
cette application — elle n'a pas de service dans `compose.yaml` — et c'est
exactement l'effet recherché : le premier commit **ne peut pas** casser la stack
des autres.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

Après la fusion (étape 5) et deux à trois minutes de CI :

```bash
cd /home/user/hello-world && git checkout main && git pull && bash /tmp/verif-tache-10.sh
```

Attendu : PASS — `OK : contrat respecte, app desactivee, image publiee`.

- [ ] **Étape 5 : commit**

Le commit qui publie l'image est celui de la fusion — les dix tâches y arrivent
déjà committées :

```bash
gh pr merge --squash \
  --subject "ramure-v2 : pose le socle deployable et publie la premiere image"
```

---

## Vérification de l'étape

Ces commandes, dans cet ordre, prouvent que l'étape est finie. Toute autre
sortie que celle annoncée est un point bloquant, pas un détail.

```bash
cd /home/user/hello-world

# 1. Le contrat de la fabrique, service par service.
./init.sh --check
#   attendu : « Contrat respecte. Tu peux pousser sur main. », code de sortie 0
#   et, pour ramure-v2, la ligne « attn  [ramure-v2] pas encore de Dockerfile »
#   ABSENTE (le Dockerfile existe) ; l'app reste hors des services du compose.

# 2. L'application est dans le depot, et desactivee.
./init.sh --list
#   attendu : ramure-v2  8080  128m  google  go  true  desactivee

# 3. Les tests, par le seul point d'entree que la CI connait.
./apps/ramure-v2/test.sh
#   attendu : aucune sortie de go vet, puis « ok  github.com/billbob-space/... »

# 4. L'image, construite localement.
docker build --build-arg VERSION=verif -t ramure-v2:verif apps/ramure-v2
echo $(( $(docker image inspect ramure-v2:verif --format '{{.Size}}') / 1024 / 1024 )) Mo
#   attendu : moins de 200 Mo (ordre de grandeur constate : une quinzaine)

# 5. Le conteneur sert, sous l'uid 10001, et dit sa version.
docker run --rm -d --name ramure-verif -p 8099:8080 ramure-v2:verif
sleep 1
curl -fsS http://localhost:8099/healthz              # attendu : ok
curl -fsS -D- -o /dev/null http://localhost:8099/ | grep -i x-ramure-version
#   attendu : X-Ramure-Version: verif
docker run --rm --entrypoint id ramure-v2:verif -u   # attendu : 10001
docker rm -f ramure-verif

# 6. La CI est verte sur main, et l'image est publiee.
gh run list --branch main --workflow build --limit 1
#   attendu : conclusion « success »
docker buildx imagetools inspect ghcr.io/billbob-space/hello-world/ramure-v2:main
#   attendu : le manifeste s'affiche

# 7. L'outillage de l'agent n'a pas bouge — Go et ui etaient deja dans la
#    fabrique via cadran, il n'y a donc rien a recoller dans le Setup script.
./.claude/check-plugins.sh
#   attendu : « Outillage : N/N plugins installes, 1/1 serveurs LSP presents. »
```

**Ce qui n'est PAS attendu à la fin de cette étape :** un service `ramure-v2`
dans `compose.yaml`, et une réponse sur `https://ramure-v2.apps.billbob.ovh`.
L'application est publiée, pas branchée. Le branchement est la dernière tâche
du PRP 09, et il ne peut pas précéder la publication de l'image — c'est la seule
contrainte dure du contrat de déploiement.

---

## Ce que la suite attend de vous

**Le point de greffe.** `func routes() http.Handler` dans
`apps/ramure-v2/main.go` est le seul routeur de l'application. Les PRP 04, 06 et
07 y ajoutent leurs routes. Attention : la signature **ne prend aucun argument**,
alors que `GET /api/centre` (PRP 04) a besoin de sources injectées. Deux voies
existent — des variables de paquet câblées dans `main()`, ou un élargissement de
la signature — et il faut **en choisir une seule, dans le PRP 04**, pas une par
PRP. Le contrat de la série fixe `routes()` pour cette étape ; le PRP qui greffe
le premier tranche pour tous.

**Les imports internes.** Le module s'appelle
`github.com/billbob-space/hello-world/apps/ramure-v2`. Les paquets des PRP
suivants s'importent donc ainsi :

```go
import (
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)
```

**Le `go.mod` déclare `go 1.23`**, pour rester compatible avec l'étage
`golang:1.23-alpine` du `Dockerfile`. Toute dépendance ajoutée par le PRP 02 ou
suivants doit s'y accommoder ; relever cette version oblige à relever aussi
l'image de construction, dans le même commit.

**Après toute nouvelle dépendance externe** (`go get`), `go.sum` apparaît. Le
`Dockerfile` l'accueille déjà (`COPY go.mod go.su[m] ./`) — il n'y a rien à
modifier.

**Le piège du `.dockerignore`.** Le fichier généré par l'échafaudage exclut
`dist` et `node_modules` du contexte de construction. Dès que le PRP 05 ou 06
compilera le TypeScript vers `web/dist` pour l'embarquer par `go:embed`, **la
ligne `dist` devra être retirée** : sans cela, le répertoire n'entre pas dans le
contexte, `COPY . .` ne le voit pas, et la construction échoue sur
`pattern web/dist: no matching files found` — alors que tout fonctionne sur le
poste, où le répertoire est bien là. `.dockerignore` n'est pas un artefact
régénéré : il s'édite à la main, une fois.

**La page d'accueil est provisoire.** `apps/ramure-v2/web/index.html` et sa
directive `//go:embed web/index.html` appartiennent au PRP 06, qui les remplace.
Deux choses doivent survivre au remplacement : le motif de route **`GET /{$}`**
— sans `{$}`, tout chemin inconnu renvoie 200 au lieu de 404 — et l'attribut
`lang="fr"`, verrouillé par un test.

**L'en-tête `X-Ramure-Version`** est posé sur toutes les réponses par
`entetes()`. Le PRP 09 peut s'en servir pour affirmer, dans un test de bout en
bout, que c'est bien la version attendue qui est en ligne.

**Le journal.** `journal()` ignore `/healthz` et n'écrit ni `X-Forwarded-User`
ni la chaîne de requête. Le PRP 07, qui introduit `internal/mesure`, agrège
côté serveur (N-09) : qu'il n'annule pas cette règle en journalisant l'identité
qu'il vient de lire. Le hachage de l'identité avant comptage est sa réponse.

**`test.sh` ne lance que Go.** Les PRP 05 et 06 y ajoutent `tsc` et `vitest`, le
PRP 09 le réécrit pour le bout en bout. La règle qui doit tenir : `set -euo
pipefail` et une commande par outil, jamais un `|| true` — un `test.sh` qui sort
en 0 sans rien vérifier rend vert un job de CI qui ne vérifie rien.

**`app.yml` reste `enabled: false`.** Ne l'active pas, même « pour voir ». Le
`memory: 128m` mérite en revanche d'être réexaminé au PRP 02 : le cache mutualisé
vit en mémoire dans le processus, et le dépassement de la limite fait tuer le
conteneur par l'OOM killer sans autre message qu'un redémarrage. C'est une
modification d'`app.yml` suivie d'un `./init.sh`, jamais une édition de
`compose.yaml`.
