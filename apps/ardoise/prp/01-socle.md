# PRP 01 — Socle

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `ardoise/socle` — puis `ardoise/activation`
> **Ce qui devient vrai :** `https://ardoise.apps.billbob.ovh` répond, l'image
> est publiée, `./init.sh --check` est vert.

---

## Objectif

La plus petite application qui respecte le contrat de déploiement : un serveur
HTTP Go, une sonde `/healthz`, une page vide, une image de moins de 200 Mo qui
tourne en utilisateur non root. Ni base, ni cache : ils arrivent en 02 et 03.

## Pourquoi deux branches et deux pull requests

**Sur une pull request, la CI construit sans publier.** L'image n'existe sur le
registre qu'une fois la PR fusionnée sur `main`. Une app dont `app.yml` porte
`enabled: true` avant que son image n'existe fait échouer le `docker compose up`
de la **stack entière** — donc des trois applications déjà en ligne.

`enabled: false` n'est pas un brouillon, c'est cette protection-là.

| | Branche | Contenu | Après fusion |
|---|---|---|---|
| PR 1 | `ardoise/socle` | tout le code, `enabled: false` | la CI publie `ghcr.io/billbob-space/hello-world/ardoise:main` |
| PR 2 | `ardoise/activation` | `enabled: true` + `compose.yaml` régénéré | l'app entre dans la stack et se déploie |

## Tâches

### 1. Échafauder

```bash
./init.sh --add ardoise --stack go --ui --exposure private --disable
```

`--add` écrit `app.yml`, `.dockerignore`, `test.sh`, `README.md`, `PRODUCT.md`,
et **réécrit `compose.yaml` et `.gitignore`**. Ces artefacts régénérés entrent
dans le commit : n'ajouter que `apps/ardoise` fait échouer le job `contrat` en
CI sur « compose.yaml désynchronisé des manifestes », avant même la
construction.

`init.sh` n'écrit **ni Dockerfile ni code** : les deux sont à toi.

### 2. Le test avant le code

`apps/ardoise/main_test.go` — la sonde répond 200, la page répond 200 :

```go
func TestSante(t *testing.T) {
    r := httptest.NewRequest("GET", "/healthz", nil)
    w := httptest.NewRecorder()
    routes().ServeHTTP(w, r)
    if w.Code != 200 { t.Fatalf("healthz = %d, attendu 200", w.Code) }
}
```

### 3. Le code

`main.go` : un `http.ServeMux`, `/healthz` et `/`, écoute sur le `port:` de
`app.yml`, arrêt propre sur `SIGTERM`. Les logs sur la **sortie standard**.

### 4. Le Dockerfile

Multi-étapes. Étage de build `golang:1.24-alpine`, étage final `alpine:3.21` —
`alpine` et non `scratch`, parce que le `health_cmd` d'`app.yml` appelle `wget`,
que busybox fournit et qu'une image sans shell n'a pas.

```dockerfile
RUN adduser -D -H -u 10001 ardoise
USER 10001:10001
```

Aucun `LABEL traefik.*`, aucune section `ports:`, aucun secret.

### 5. Vérifier

```bash
./init.sh --check     # doit être vert
./apps/ardoise/test.sh
```

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | `--check` vert, `ardoise` listée mais **absente** du compose | `./init.sh --check && ! grep -q 'ardoise:' compose.yaml` |
| 2 | Les tests passent | `./apps/ardoise/test.sh` |
| 3 | L'image se construit et pèse < 200 Mo | `docker build -t ardoise apps/ardoise && docker image inspect ardoise --format '{{.Size}}'` |
| 4 | Elle tourne en non-root | `docker run --rm ardoise id -u` → ≠ 0 |
| 5 | Après fusion de la PR 1, l'image existe sur le registre | onglet Packages du dépôt |
| 6 | Après `--enable` et fusion de la PR 2, l'URL répond | `https://ardoise.apps.billbob.ovh` |

## Les deux commits

```bash
git add apps/ardoise compose.yaml .gitignore go.work
git commit          # PR 1 : la CI publie l'image

./init.sh --app ardoise --enable && ./init.sh --check
git add apps/ardoise/app.yml compose.yaml
git commit          # PR 2 : le deploiement
```
