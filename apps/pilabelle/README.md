# pilabelle

URL : https://pilabelle.apps.billbob.ovh — palier d'exposition : `private`.

## Ce que fait cette application

Un programme de pilates doux, quotidien et personnalisé : une séance du jour
déjà choisie, chronométrée et illustrée par vidéo, qui s'ajuste séance après
séance au ressenti de l'utilisatrice. Le produit et le raisonnement sont dans
[`PRODUCT.md`](PRODUCT.md) ; l'implémentation dans [`prp/`](prp/README.md).

## Identité

Aucun compte applicatif : `X-Forwarded-User`, posé par Traefik avant que la
requête n'atteigne le conteneur (palier `private`), est la seule source
d'identité. Chaque route `/api/*` l'exige et répond `400` en son absence.

## Ce qu'elle garde

Volume `pilabelle-donnees`, monté sur `/var/lib/pilabelle` — il survit au
redéploiement. Un fichier JSON par compte (nommé par le hash de son identité,
jamais l'adresse en clair), écrit atomiquement.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html`, coque unique |
| `GET /api/profil` | `404` si absent, sinon la fiche (réponses, niveaux, série) |
| `POST /api/profil` | crée le profil depuis le questionnaire, `409` si déjà créé |
| `PUT /api/profil` | modifie les réponses (réglages), jamais rétroactif sur la progression |
| `GET /api/jour` | l'état du jour (`repos` / `deja-faite` / `a-faire`), la séance résolue et une éventuelle pique de retrouvailles |

Le dictionnaire d'exercices (`data/dictionnaire.json`, dérivé d'`exercices.md`)
et les stocks de messages (`data/messages.json`) sont des données embarquées,
jamais recalculées à la volée.

## Variables d'environnement

Aucun secret. `PORT` (défaut `8080`) et `PILABELLE_DONNEES` (défaut
`/var/lib/pilabelle`) ont des défauts utiles dans le code, pas dans `env:`.

## Développement

```bash
./apps/pilabelle/test.sh
```

Sans `X-Forwarded-User`, toute route `/api/*` répond `400` — il n'y a pas de
mode « sans identité » ; les tests posent l'en-tête eux-mêmes.
