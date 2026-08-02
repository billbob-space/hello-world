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

La page affiche la **version déployée** : le SHA du commit, posé à la
construction par `-ldflags "-X main.version=…"` depuis le `build-arg` `VERSION`.
Une construction locale affiche `dev`. C'est ce qui permet de constater qu'un
déploiement a bien remplacé la version précédente, sans se fier au seul journal
du serveur.

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

## Déclenchement du déploiement

Le tag `:main` est **mutable** : une image reconstruite ne change pas une ligne
du `compose.yaml`. L'auto-sync de `dockhand`, qui ne redéploie que s'il voit un
diff dans le répertoire de la stack, ne verrait donc jamais rien passer. C'est
le dernier pas du workflow qui déclenche le déploiement, en appelant le webhook
de la stack **après** la publication de l'image — l'ordre importe, sinon le
serveur retire l'image précédente.

L'URL de ce webhook est une *URL de capacité* : qui la connaît peut déclencher
un déploiement. Elle n'est donc pas dans ce dépôt, mais dans un secret :

| Secret du dépôt | Contenu |
|---|---|
| `DOCKHAND_DEPLOY_WEBHOOK` | l'URL de webhook de la stack dans `dockhand` |
| `DOCKHAND_WEBHOOK_SECRET` | le secret du webhook, configuré côté `dockhand` |

À poser dans *Settings → Secrets and variables → Actions → New repository
secret*. Sans l'URL, le workflow publie l'image, émet un avertissement et
n'appelle rien — la construction reste verte, mais **rien n'est déployé**.

`dockhand` accepte trois façons de s'authentifier ; le workflow suit celle que
sa documentation recommande pour une CI générique :

| Méthode | En-tête / paramètre | Usage |
|---|---|---|
| **HMAC-SHA256** | `X-Hub-Signature-256: sha256=<hex>` | ce que fait le workflow |
| Jeton en clair | `X-Gitlab-Token: <secret>` | webhooks GitLab |
| Paramètre d'URL | `?secret=<secret>` | **GET uniquement** |

Le corps envoyé est `{}` : `dockhand` ne le lit pas, il relit le dépôt lui-même.
Seule la signature compte.

### Deux réglages obligatoires sur la stack

`dockhand` ne redéploie **que s'il voit un commit nouveau** — sinon il répond
`200` avec `{"success":true,"skipped":true}` et ne touche à rien. Comme l'image
est publiée sur un tag fixe, sa documentation demande d'activer, sur la stack :

- **Re-pull images** — sans quoi le serveur redéploie l'image déjà présente ;
- **Force redeployment** — sans quoi le déploiement est sauté.

Le workflow traite ce `skipped` comme un échec : une image publiée sans
déploiement ne doit pas passer pour une construction verte. De même, un `403`
est signalé explicitement comme une non-correspondance de secret.

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
