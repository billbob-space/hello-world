# hello-world

Application de la fabrique, servie sur `hello-world.apps.billbob.ovh`,
authentification `private` (liste blanche du serveur).

Elle sert une page d'accueil affichant l'utilisateur connecté, et une sonde de
santé. Elle sert surtout de gabarit : c'est la plus petite application qui
respecte le contrat de déploiement décrit dans [`../../CLAUDE.md`](../../CLAUDE.md).

## Technologie

Go 1.24, bibliothèque standard uniquement — aucune dépendance externe. Le
serveur HTTP, le gabarit de page et les tests tiennent dans trois fichiers :

| Fichier | Rôle |
|---|---|
| `main.go` | serveur HTTP, routes, arrêt propre sur SIGTERM |
| `page.html` | page d'accueil, embarquée dans le binaire (`go:embed`) |
| `main_test.go` | tests des routes et de l'échappement de l'identité |

L'image finale est une Alpine portant le binaire statique, environ 12 Mo.

Le module est `github.com/billbob-space/hello-world/apps/hello-world` : chaque
app de la fabrique est un module Go distinct, ce qu'impose le contexte de
construction réduit à `apps/hello-world`. Le `go.work` à la racine du dépôt les
rassemble pour `gopls`, sans entrer dans aucune image.

La page est un **panneau à palettes** : chaque valeur est posée sur une grille
de cellules de caractère, comme sur un tableau des départs. Tout est obtenu en
CSS — le treillis des volets est peint en fond, en unités `ch`, derrière un
simple champ de texte. C'est ce qui permet à `page.html` de rester un gabarit
Go ordinaire : `main_test.go` verrouille `{{.VersionShort}}` collé à sa balise,
donc aucun découpage caractère par caractère n'est possible. Aucun script,
aucune police distante, aucune requête sortante depuis le navigateur.

Le monde visuel et les décisions produit sont consignés dans
[`PRODUCT.md`](PRODUCT.md).

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

Depuis ce répertoire :

```bash
go test ./...          # tests
go run .               # écoute sur :8080
curl localhost:8080/healthz
```

Depuis la racine du dépôt, comme le fait la CI :

```bash
./apps/hello-world/test.sh
docker build -t hello-world apps/hello-world
```

Le contexte de construction est `apps/hello-world`, jamais la racine.

## Invariants verrouillés par les tests

`main_test.go` fige quatre choses que toute refonte de la page doit préserver :
la version courte **collée à sa balise** (`>abcdef1<`), le SHA complet dans un
attribut `title`, `inconnu` affiché sans en-tête `X-Forwarded-User`, et
l'identité **échappée** en HTML.

Piège de dérive : `newMux(t)` reconstruit le mux au lieu de réutiliser celui de
`main()`. Une route ajoutée dans `main()` et pas dans `newMux` serait
silencieusement non testée.
