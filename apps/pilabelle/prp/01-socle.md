# PRP 01 — Le socle déployable

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/socle` — puis `pilabelle/activation`
> **Dépend de :** rien
> **Débloque :** 03 (profil), et par lui tout le reste
> **Sections du PRD :** §11 contraintes, §12 dépendances et prérequis de mise en ligne

---

## Objectif

`https://pilabelle.apps.billbob.ovh` répond 200, authentifiée par le palier
`private`, en lisant `X-Forwarded-User` et en écrivant sur un volume qui
survit à un redéploiement — avant qu'une seule ligne de produit n'existe. Une
page d'attente honnête, pas un écran de séance simulé.

## Pourquoi deux branches et deux pull requests

**Sur une pull request, la CI construit sans publier.** L'image n'existe sur
le registre qu'une fois la première PR fusionnée sur `main`. Une app dont
`app.yml` porte `enabled: true` avant que son image n'existe fait échouer le
`docker compose up` de la **stack entière**.

| | Branche | Contenu | Après fusion |
|---|---|---|---|
| PR 1 | `pilabelle/socle` | tout le code de ce PRP, `enabled: false` | la CI publie `ghcr.io/billbob-space/hello-world/pilabelle:main` |
| PR 2 | `pilabelle/activation` | `enabled: true` + `compose.yaml` régénéré | l'app entre dans la stack et se déploie |

**La PR 2 de ce PRP attend en plus une décision de contenu** (ossature §11) :
n'active pas tant que les vidéos `a_rechercher` d'`exercices.md` n'ont pas été
traitées par PRP 02 — ce n'est pas un blocage technique de ce PRP, mais le
bon endroit pour s'en souvenir puisque c'est ici que se trouve `--enable`.

## Tâches

### 1. Échafauder

```bash
./init.sh --add pilabelle --stack go --ui --exposure private --disable
```

`--add` écrit `app.yml`, `.dockerignore`, `test.sh`, et **réécrit
`compose.yaml` et `.gitignore`**. Il n'écrit **ni `PRODUCT.md` ni `README.md`
déjà présents** (`memory/ajouter-une-app.md`) — `apps/pilabelle/PRODUCT.md`
existe déjà et n'est pas touché ; `README.md` est créé puisqu'il n'existe pas
encore.

Édite ensuite `app.yml` à la main pour ajouter la section optionnelle
`volumes:`, qu'aucune option de `--add` ne pose :

```yaml
volumes:
  - name: donnees
    source: donnees
    target: /var/lib/pilabelle
```

(vérifie la forme exacte contre `memory/volumes.md` au moment d'écrire — le
nom logique `donnees` produit le volume réel `pilabelle-donnees`.)

`init.sh` n'écrit **ni Dockerfile ni code** : les deux sont à toi.

### 2. Le test avant le code

`apps/pilabelle/main_test.go` :

```go
package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSante(t *testing.T) {
	r := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	routes(nil, "").ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("healthz = %d, attendu 200", w.Code)
	}
}

func TestIdentiteExigee(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatalf("sans X-Forwarded-User: %d, attendu 400", w.Code)
	}
}

func TestPageAttente(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("/ = %d, attendu 200", w.Code)
	}
}
```

### 3. Le code

`identite()` (ossature §9) et le squelette de routage :

```go
// apps/pilabelle/main.go
package main

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	_ "time/tzdata"
)

//go:embed web
var webFS embed.FS

//go:embed data
var dataFS embed.FS

var version = "dev" // injecte par -ldflags -X main.version=... en CI

func identite(r *http.Request) (string, error) {
	u := r.Header.Get("X-Forwarded-User")
	if u == "" {
		return "", errors.New("X-Forwarded-User absent")
	}
	return u, nil
}

func routes(dico []byte, racineProfils string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "ok")
	})

	web, _ := fs.Sub(webFS, "web")
	mux.Handle("GET /", withVersion(http.FileServer(http.FS(web))))

	mux.HandleFunc("GET /api/profil", func(w http.ResponseWriter, r *http.Request) {
		if _, err := identite(r); err != nil {
			http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound) // PRP 03 le remplace
	})

	return mux
}

func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

func env(cle, defaut string) string {
	if v := os.Getenv(cle); v != "" {
		return v
	}
	return defaut
}

func main() {
	racine := env("PILABELLE_DONNEES", "/var/lib/pilabelle")
	dico, err := dataFS.ReadFile("data/dictionnaire.json")
	if err != nil {
		log.Fatalf("dictionnaire absent de l'image : %v", err)
	}

	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: routes(dico, racine)}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	arret := make(chan os.Signal, 1)
	signal.Notify(arret, syscall.SIGTERM, syscall.SIGINT)
	<-arret
	log.Print("arret demande, fermeture propre")
	_ = srv.Close()
}
```

`data/dictionnaire.json` n'existe pas encore (PRP 02) : pose un fichier vide
`{"echelle_niveaux":[],"exercices":[]}` dans ce PRP pour que `go:embed`
compile, sans plus — PRP 02 le remplace entièrement.

`web/index.html` — une page d'attente qui **dit qu'elle est une page
d'attente** (comme `marcq-handball` PRP 01) :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pilabelle</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 4rem 1.5rem; color: #555; }
  </style>
</head>
<body>
  <p>pilabelle se construit. Reviens bientôt pour ta séance du jour.</p>
</body>
</html>
```

### 4. Le Dockerfile

Multi-étapes, comme `ardoise` et `cadran`. Étage de build
`golang:1.24-alpine`, étage final `alpine:3.21` (`wget` du `health_cmd` vient
de busybox, absent de `scratch`).

```dockerfile
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags "-X main.version=${VERSION:-dev}" -o /pilabelle .

FROM alpine:3.21
RUN adduser -D -H -u 10001 pilabelle \
 && mkdir -p /var/lib/pilabelle \
 && chown 10001:10001 /var/lib/pilabelle
COPY --from=build /pilabelle /pilabelle
USER 10001:10001
ENTRYPOINT ["/pilabelle"]
```

`mkdir` + `chown` **avant** `USER`, sur le chemin exact du volume (ossature
§7, `memory/volumes.md`) : sans cette ligne, le premier montage donnerait le
répertoire à `root` et l'app non-root ne pourrait jamais y écrire.

Aucun `LABEL traefik.*`, aucune section `ports:`, aucun secret.

### 5. Vérifier

```bash
./init.sh --check
./apps/pilabelle/test.sh
```

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | `--check` vert, `pilabelle` listée mais **absente** du compose | `./init.sh --check && ! grep -q 'pilabelle:' compose.yaml` |
| 2 | Les tests passent | `./apps/pilabelle/test.sh` |
| 3 | Sans identité, l'API refuse | `TestIdentiteExigee` |
| 4 | L'image se construit et pèse < 200 Mo | `docker build -t pilabelle apps/pilabelle && docker image inspect pilabelle --format '{{.Size}}'` |
| 5 | Elle tourne en non-root | `docker run --rm pilabelle id -u` → ≠ 0 |
| 6 | Après fusion de la PR 1, l'image existe sur le registre | onglet Packages du dépôt |
| 7 | Après `--enable` et fusion de la PR 2, l'URL répond et exige l'authentification du palier `private` | `https://pilabelle.apps.billbob.ovh` |

## Les deux commits

```bash
git add apps/pilabelle compose.yaml .gitignore go.work
git commit          # PR 1 : la CI publie l'image

./init.sh --app pilabelle --enable && ./init.sh --check
git add apps/pilabelle/app.yml compose.yaml
git commit          # PR 2 : le deploiement — apres la decision de contenu, ossature §11
```
