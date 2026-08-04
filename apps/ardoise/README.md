# ardoise

URL : https://ardoise.apps.billbob.ovh — palier d'exposition : `private`.

## Ce que fait cette application

Une ardoise partagée : les comptes de la liste blanche y écrivent une ligne de
140 caractères au plus, signée de leur adresse et horodatée. Les 50 dernières
s'affichent, de la plus récente à la plus ancienne.

Chaque affichage dit **d'où il vient** — « lu dans la base » ou « lu dans le
cache ». C'est une exigence produit, pas un détail de mise au point : sans elle,
un cache en panne est indiscernable d'un cache qui fonctionne.

## Pourquoi elle existe

`ardoise` est à la donnée ce que `hello-world` est au déploiement : la preuve
exécutable d'une moitié du contrat que rien n'exerçait. C'est la première
application de la fabrique à déclarer un `services:`, un `volumes:`, un `env:`
et un `needs:`, et la première à faire vivre `shared_services`.

Le produit est décrit dans [`PRODUCT.md`](PRODUCT.md), le raisonnement dans
[`docs/superpowers/specs/2026-08-04-ardoise-prd.md`](../../docs/superpowers/specs/2026-08-04-ardoise-prd.md),
l'implémentation dans [`prp/`](prp/README.md).

## Les trois services

| Service | Sorte | Rôle |
|---|---|---|
| `ardoise` | app, routée | l'interface et l'API |
| `ardoise-base` | annexe privée | Postgres 17, volume `ardoise-donnees` |
| `redis` | partagé (`fabrique.yml`) | le cache, clé `ardoise:lignes`, TTL 30 s |

Le cache est une **optimisation, pas une dépendance** : Redis injoignable, la
lecture va en base et rien ne casse. La base injoignable au démarrage n'empêche
pas l'application de démarrer : elle réessaie et répond 503 en attendant.

## Variables d'environnement

Une seule, et c'est un secret : l'infrastructure injecte la valeur, le dépôt ne
porte que le nom.

| Nom | Rôle | Absente ⇒ |
|---|---|---|
| `POSTGRES_PASSWORD` | mot de passe du compte Postgres, côté app **et** côté base | connexion sans mot de passe — la base refusera de s'initialiser |

**À définir côté serveur avant d'activer l'application.** Le contrat émet
`- POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-}` : un nom non défini arrive **vide**,
pas absent. Une base qui refuse de s'initialiser laisse le reste de la stack
debout, mais `ardoise` ne servira rien.

Deux autres valeurs sont lues, avec un défaut dans le code plutôt que dans
`env:` — ce ne sont pas des secrets, et un défaut vide serait pire qu'un défaut
utile : `ARDOISE_BASE_URL` (défaut `postgres://postgres@ardoise-base:5432/postgres`)
et `ARDOISE_REDIS_ADDR` (défaut `redis:6379`).

## Développement

```bash
./apps/ardoise/test.sh          # tests unitaires — aucune infrastructure requise
./apps/ardoise/e2e/lancer.sh    # bout en bout — construit l'image, monte la stack
```

`test.sh` est le seul fichier que la CI lance, et il reste vert sans base ni
cache : les tests qui en ont besoin se **sautent** quand `ARDOISE_TEST_BASE_URL`
ou `ARDOISE_TEST_REDIS_ADDR` sont absents.

Hors Traefik, aucun `X-Forwarded-User` n'arrive : l'application affiche alors
`anonyme@local`. C'est une valeur qui se voit — une chaîne vide ressemblerait à
un bogue.

## Sauvegarder les données

Le volume `ardoise-donnees` ne s'ouvre pas avec un `cat`. Depuis le serveur :

```bash
docker run --rm -v ardoise-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/ardoise-donnees.tgz -C /d .
```

Le cache, lui, se supprime sans précaution : c'est ce que son absence de volume
dit déjà.
