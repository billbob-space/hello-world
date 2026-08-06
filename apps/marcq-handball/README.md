# marcq-handball

URL : https://marcq-handball.apps.billbob.ovh — palier d'exposition : `public`.

Le programme d'été U15 du Marcq Handball, du 3 au 21 août 2026 : les séances du
coach, cochables d'un tap, sur le téléphone de l'enfant.

## Le partage serveur / navigateur

Le serveur ne connaît **aucun** utilisateur et n'a **aucun** état. Il sert la
coque embarquée par `go:embed` et une sonde de santé. Le domaine, la
progression et le prénom vivent dans le navigateur, en modules ES natifs — pas
de bundler, pas de `node_modules`, pas de transpilation.

Le palier est `public` : Traefik n'authentifie personne, ne pose donc aucun
en-tête d'identité, et l'application n'en lit aucun. Ce qui est propre à un
visiteur reste sur son appareil (`localStorage`).

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /<fichier>` | le fichier de `web/`, servi à la racine |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache`, version injectée |
| `GET /healthz` | `200 ok`, `text/plain` |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` : vérifier un déploiement ne
demande pas d'ouvrir la page.

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
```

Le service worker met la coque en cache par version. En développement local la
version vaut `dev` et le cache ne change donc jamais de nom : recharger avec le
cache désactivé, ou vider `marcq-dev` dans les outils du navigateur.

## Variables d'environnement

Aucun secret n'est attendu, et rien de sensible ne doit transiter : tout ce que
le navigateur reçoit est public par construction.

| Nom | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute HTTP en clair dans le conteneur | `8080` |

## Besoins d'infrastructure

Aucun pour le lot 1 : ni base de données, ni cache, ni volume, ni port
supplémentaire.

**Le lot 2 en demandera un** : le classement doit survivre à un redéploiement
(PRD §12.1). Un magasin remis à zéro à chaque publication d'image serait pire
que pas de classement. C'est une décision d'exploitation, elle se prend côté
serveur ; le PRP 07 ne démarre pas avant.
