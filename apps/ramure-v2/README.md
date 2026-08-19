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
[prp/](prp/README.md).

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

| Nom | À injecter ? | Rôle |
|---|---|---|
| `LASTFM_API_KEY` | **oui, côté serveur** — facultative | Clé Last.fm, source de proximité entre artistes. Absente, l'application bascule sur ListenBrainz : l'affinité est moins fine, rien n'est cassé. C'est la seule demande de ce fichier. |
| `RAMURE_DATA_DIR` | **non — l'image la fixe** à `/var/lib/ramure` | Répertoire de persistance de la collection, point de montage du volume nommé `ramure-v2-donnees` déclaré dans `app.yml`. Rien à injecter, rien à créer sur l'hôte. La redéfinir côté serveur pointerait **hors** du volume : les données ne survivraient plus au redéploiement. |

Aucune n'est lue par le code à ce stade. `LASTFM_API_KEY` est déclarée
maintenant parce que ce fichier est la demande adressée à l'exploitant, et
qu'une demande formulée après la mise en ligne coûte un déploiement de plus.

## Persistance

La collection vit dans le volume nommé **`ramure-v2-donnees`**, déclaré par
`volumes: [donnees:/var/lib/ramure]` dans `app.yml` et monté sur
`/var/lib/ramure`. `docker compose up` le crée au premier démarrage et le
conserve entre deux déploiements : **aucune action sur l'hôte**, ni `mkdir`, ni
`chown`, ni chemin à valider. Le `Dockerfile` crée ce répertoire et le donne à
l'uid `10001` **avant** `USER` — c'est le contenu de l'image, propriétaire
compris, que Docker recopie dans le volume vide au premier montage. Tout le
reste du système de fichiers du conteneur est jeté à chaque déploiement.

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

Go 1.24, bibliothèque standard uniquement à ce stade. La page d'accueil est
embarquée dans le binaire par `go:embed` : l'image finale ne porte qu'un
exécutable et le répertoire de données décrit ci-dessus, créé par le
`Dockerfile`. Rien n'est à préparer sur l'hôte avant un déploiement.

Image finale sur `alpine` et non `scratch` : c'est busybox qui fournit le
`wget` du `health_cmd` déclaré dans `app.yml`. Utilisateur `10001`, non root,
aucun port publié.

## Ce que cette application ne fait pas

Elle n'héberge aucune musique, ne gère aucun compte, n'écrit aucun secret et
n'ouvre aucun port sur l'hôte. Elle ne parle à aucune source externe depuis le
navigateur : tous les appels partent du serveur.
