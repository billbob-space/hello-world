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
| `DELETE /api/profil` | efface le profil du compte appelant — irréversible, idempotent |
| `GET /api/jour` | l'état du jour (`repos` / `deja-faite` / `a-faire`), la séance résolue et une éventuelle pique de retrouvailles |
| `POST /api/ressenti` | referme la séance du jour, met à jour niveaux/série/historique, renvoie le récap (série, passage de niveau, encouragement, mot doux) |
| `GET /api/personnel` | série actuelle et record, niveaux courants (ventre, cuisses), calendrier fait/manqué/repos/à venir des quatre semaines écoulées plus la semaine en cours — lecture seule, rien de recalculé |
| `GET /api/notifications/cle-publique` | la clé publique VAPID (pas un secret : c'est elle que le navigateur transmet à `PushManager.subscribe()`), vide si les clés VAPID sont absentes de l'environnement |
| `PUT /api/notifications` | crée ou remplace l'abonnement push du compte appelant, et éventuellement son heure de rappel |
| `DELETE /api/notifications` | révoque l'abonnement push du compte appelant — idempotent |

Le dictionnaire d'exercices (`data/dictionnaire.json`, dérivé d'`exercices.md`)
et les stocks de messages (`data/messages.json`) sont des données embarquées,
jamais recalculées à la volée.

## Notifications

Web Push, opt-in, un seul abonnement par profil (`PRODUCT.md`, « Notifications :
rappel de séance et mots doux »). Un `time.Ticker` en arrière-plan (`main.go`)
vérifie une fois par minute tous les profils enregistrés et déclenche :

- un **rappel de séance**, au plus une fois par jour actif, à l'heure choisie
  dans les réglages (défaut `18:00`), seulement si la séance du jour n'est pas
  déjà faite ;
- un **mot doux**, indépendant de la séance, jusqu'à trois fois par semaine, à
  un moment aléatoire entre 9h et 21h (Europe/Paris).

Sans abonnement sur le profil, rien n'est jamais envoyé — comportement par
défaut. L'envoi passe par [`github.com/SherClockHolmes/webpush-go`](https://github.com/SherClockHolmes/webpush-go).

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `VAPID_PUBLIC_KEY` | clé publique VAPID (identité de l'app auprès des services de push des navigateurs) |
| `VAPID_PRIVATE_KEY` | clé privée VAPID correspondante |
| `VAPID_CONTACT` | contact de l'app, exigé par le protocole VAPID — une adresse `mailto:` ou une URL `https:` |

Les trois sont optionnelles au démarrage : absentes, l'app démarre normalement
et désactive silencieusement l'envoi de notifications (un avertissement est
loggé). Pour générer la paire de clés :

```bash
npx web-push generate-vapid-keys
```

`PORT` (défaut `8080`) et `PILABELLE_DONNEES` (défaut `/var/lib/pilabelle`) ont
des défauts utiles dans le code, pas dans `env:`.

## Développement

```bash
./apps/pilabelle/test.sh
```

Sans `X-Forwarded-User`, toute route `/api/*` répond `400` — il n'y a pas de
mode « sans identité » ; les tests posent l'en-tête eux-mêmes.
