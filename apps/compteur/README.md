# compteur

URL : https://compteur.apps.billbob.ovh — palier d'exposition : `google`.

## Ce que fait cette application

Un compteur partagé : n'importe quel compte Google clique sur un bouton, le
total avance de un, l'écran affiche le total et l'adresse du dernier auteur.
Chaque lecture dit d'où elle vient — « lu dans la base » ou « lu dans le
cache ».

## Pourquoi elle existe

`compteur` est le second passage de la validation de bout en bout de la
fabrique, après [`ardoise`](../ardoise/README.md). Deux angles neufs :
`exposure: google`, qu'aucune application du dépôt n'exerçait encore, et
`needs: [redis]` sur le **même** service partagé qu'`ardoise`, sans toucher
`fabrique.yml` — la preuve qu'un `shared_services` sert vraiment plusieurs
applications sans qu'elles se marchent dessus (clés `compteur:valeur` et
`ardoise:lignes`, testé en conteneur : `TestNeSeMarchePasSurArdoise`).

Le raisonnement complet est dans [`PRODUCT.md`](PRODUCT.md) — fiche produit,
puis le PRD et ses critères d'acceptation ; l'implémentation dans
[`prp/00-ossature-et-implementation.md`](prp/00-ossature-et-implementation.md).

## Les trois services

| Service | Sorte | Rôle |
|---|---|---|
| `compteur` | app, routée | l'interface et l'API |
| `compteur-base` | annexe privée | Postgres 17, volume `compteur-donnees` |
| `redis` | partagé (`fabrique.yml`) | déjà déclaré par `ardoise` — clé `compteur:valeur`, TTL 30 s |

Le cache est une **optimisation, pas une dépendance** : Redis injoignable, la
lecture va en base. La base injoignable au démarrage n'empêche pas
l'application de démarrer : elle réessaie et répond 503 en attendant.

## Variables d'environnement

| Nom | Rôle | Absente ⇒ |
|---|---|---|
| `POSTGRES_PASSWORD` | mot de passe du compte Postgres, côté app **et** côté base | connexion sans mot de passe — la base refusera de s'initialiser |

`COMPTEUR_BASE_URL` (défaut `postgres://postgres@compteur-base:5432/postgres`)
et `COMPTEUR_REDIS_ADDR` (défaut `redis:6379`) ne sont pas des secrets : une
valeur par défaut dans le code plutôt que dans `env:`, dont l'absence
arriverait vide.

## Développement

```bash
./apps/compteur/test.sh          # tests unitaires — aucune infrastructure requise
./apps/compteur/e2e/lancer.sh    # bout en bout — construit l'image, monte la stack
```

Hors Traefik, aucun `X-Forwarded-User` n'arrive : l'application affiche alors
`anonyme@local`.
