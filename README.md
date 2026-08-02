# hello-world

Application minimale déployée sur `hello-world.apps.billbob.ovh`.

Elle sert une page d'accueil affichant l'utilisateur connecté, et une sonde de
santé. Elle sert surtout de gabarit : c'est la plus petite application qui
respecte le contrat de déploiement décrit dans [`CLAUDE.md`](CLAUDE.md).

## Technologie

Go 1.24, bibliothèque standard uniquement — aucune dépendance externe. Le
serveur HTTP, le gabarit de page et les tests tiennent dans trois fichiers :

| Fichier | Rôle |
|---|---|
| `main.go` | serveur HTTP, routes, arrêt propre sur SIGTERM |
| `page.html` | page d'accueil, embarquée dans le binaire (`go:embed`) |
| `main_test.go` | tests des routes et de l'échappement de l'identité |

L'image finale est une Alpine portant le binaire statique, environ 12 Mo.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | page HTML d'accueil |
| `GET /healthz` | `200 ok` en texte brut, dès que le serveur écoute |

Tout autre chemin renvoie 404.

## Identité de l'utilisateur

L'application est derrière l'authentification Google de Traefik en palier
`private` : seuls les comptes de la liste blanche du serveur y accèdent.
L'adresse de l'utilisateur connecté arrive dans l'en-tête HTTP
`X-Forwarded-User`, posé par Traefik. C'est la seule source d'identité utilisée
— jamais un paramètre d'URL, un corps de requête ou un cookie applicatif.

En développement local, l'en-tête est absent et la page affiche `inconnu`.

## Variables d'environnement

| Nom | Défaut | Rôle |
|---|---|---|
| `PORT` | `8080` | port d'écoute dans le conteneur |

Aucun secret n'est attendu ni lu par cette application.

## Développement

```bash
go test ./...          # tests
go run .               # écoute sur :8080
curl localhost:8080/healthz
```

Construction de l'image, à l'identique de la CI :

```bash
docker build -t hello-world .
```

## Avant de pousser

```bash
./init.sh --check
```

Le déploiement part de chaque fusion sur `main` : GitHub construit l'image, la
publie sur GHCR, puis le serveur la récupère. Compter deux à trois minutes.

L'infrastructure (`compose.yaml`, `.github/workflows/build.yml`,
`.dockerignore`) est générée par `./init.sh` depuis `app.yml` — ne pas l'éditer
à la main, modifier `app.yml` et relancer `./init.sh --force`.

## Besoins d'infrastructure

Ni base de données, ni cache, ni volume persistant, ni port supplémentaire.

**Un point reste à régler côté serveur : l'accès en lecture au paquet GHCR.**
La construction réussit et publie bien `ghcr.io/billbob-space/hello-world:main`
(image de 15 Mo), mais `dockhand` échoue à la récupérer :

```
Error response from daemon: Head "https://ghcr.io/v2/billbob-space/hello-world/manifests/main": unauthorized
```

Ce dépôt est privé, donc le paquet GHCR l'est aussi, et le démon Docker du
serveur tire sans identifiants. Rien dans ce dépôt ne peut corriger cela : ni
le `Dockerfile`, ni le `compose.yaml`, ni le workflow. Deux résolutions, toutes
deux côté serveur ou côté organisation GitHub :

1. **Authentifier le serveur sur `ghcr.io`** avec un jeton en lecture seule
   (portée `read:packages`) — `docker login ghcr.io`, ou la configuration
   d'identifiants de registre de `dockhand`. L'image reste privée. C'est la
   voie à préférer pour un dépôt privé.
2. **Rendre le paquet public** (page du paquet → *Package settings* → *Change
   visibility*). Le dépôt reste privé, mais l'image publiée devient
   téléchargeable par n'importe qui — donc le binaire de l'application avec.

Le jeton, quelle que soit l'option, vit côté serveur : ni dans ce dépôt, ni
dans l'image, ni dans `.claude/settings.json`.

Comme le paquet de toute application créée depuis ce contrat est privé par
défaut, cette étape concerne l'ensemble des dépôts, pas seulement celui-ci.
