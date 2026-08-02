# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

L'exploitant du serveur `billbob.ovh` et les comptes Google inscrits sur sa
liste blanche (palier `private`). Situation type : quelqu'un vient de fusionner
sur `main`, attend deux à trois minutes, ouvre l'URL et veut savoir en un coup
d'œil si l'image déployée est bien la sienne. Second usage, plus rare : vérifier
que l'authentification Traefik transmet correctement l'identité.

Il n'y a pas d'utilisateur anonyme : Traefik authentifie avant que la requête
n'atteigne l'application.

## Product Purpose

`hello-world` est la plus petite application qui respecte intégralement le
contrat de déploiement décrit dans `CLAUDE.md`. Elle sert deux choses : une page
d'accueil qui rend visible l'état du déploiement, et une sonde `/healthz`.

Le succès a deux formes. À l'usage : la page répond à « est-ce que mon
déploiement est passé ? » sans lecture de journal ni accès SSH. Comme gabarit :
un nouveau dépôt part de celle-ci et hérite d'un déploiement qui fonctionne.

## Positioning

Ce n'est pas une démonstration de « hello world » : c'est la preuve exécutable du
contrat de déploiement. Chaque contrainte du contrat — image < 200 Mo,
utilisateur non root, aucun port publié, routage dans `compose.yaml`, identité
issue du seul `X-Forwarded-User` — y est tenue et vérifiable. Une application
voisine peut afficher les mêmes champs ; elle ne peut pas prétendre servir de
référence au contrat sans le respecter ligne à ligne.

## Operating Context

- Déploiement déclenché par la fusion sur `main` : GitHub construit l'image, la
  publie sur GHCR sous le tag mutable `:main`, le serveur la récupère. Deux à
  trois minutes entre la fusion et la mise en ligne.
- La version est le SHA du commit, injecté à la construction par
  `-ldflags "-X main.version=…"`. Une construction locale vaut `dev`.
- Deux moyens de vérifier un déploiement : l'en-tête `X-App-Version`, présent sur
  **toutes** les réponses y compris `/healthz`, et la page d'accueil.
- Traefik applique l'authentification Google (`forwardauth`, palier `private`)
  et pose `X-Forwarded-User` avant de joindre le conteneur par `apps_net`.
- La consultation se fait aussi bien depuis un poste de travail que depuis un
  téléphone, à n'importe quelle heure — un déploiement se vérifie quand il part.
  *(Déduit du mode d'usage ci-dessus, non confirmé par l'utilisateur.)*

## Capabilities and Constraints

Fonctions confirmées :

| Route | Réponse |
|---|---|
| `GET /` | page HTML d'accueil |
| `GET /healthz` | `200 ok`, texte brut, dès que le serveur écoute |

Tout autre chemin renvoie 404.

Champs réellement disponibles à l'affichage, et rien d'autre : identité de
l'utilisateur (`X-Forwarded-User`, ou `inconnu` en local), hôte de la requête,
version complète et version courte à 7 caractères, horodatage de démarrage
(RFC 3339), durée de fonctionnement tronquée à la seconde.

Contraintes techniques :

- Go 1.24, bibliothèque standard uniquement, aucune dépendance externe.
- `page.html` est **un fichier unique** embarqué dans le binaire par `go:embed`,
  rendu par `html/template`. Pas de chaîne de construction front, pas d'asset
  séparé, donc aucune requête réseau sortante depuis le navigateur.
- Image finale Alpine d'environ 12 Mo, utilisateur non root, aucun port publié.
- Les journaux vont sur la sortie standard et n'enregistrent pas l'identité.
- L'identité arrive en HTML et doit rester échappée.
- Aucun secret n'est attendu ni lu. Seule variable d'environnement : `PORT`.
- `main_test.go` verrouille du balisage : la version courte doit être
  directement encadrée par sa balise (`>abcdef1<`), le SHA complet doit rester
  dans un attribut `title`, `inconnu` doit apparaître sans en-tête, et
  l'identité doit être échappée. Toute refonte de la page préserve ces quatre
  invariants.

Décision non prise : aucune donnée temps réel côté navigateur (l'uptime est
rendu au serveur et ne s'incrémente pas). Écarté explicitement lors de la
refonte de la page.

## Brand Commitments

- Nom : `hello-world`. Domaine : `hello-world.apps.billbob.ovh`.
- L'interface, les commentaires et la documentation sont en français.
- Pas de système de comptes : `X-Forwarded-User` est la seule source d'identité
  admissible, jamais un paramètre client.

## Evidence on Hand

Tout ce que la page affiche est réel et rendu au serveur : e-mail de
l'utilisateur authentifié, hôte, SHA de commit, horodatage de démarrage, durée
de fonctionnement.

Ce qui n'existe pas et ne doit pas être inventé : métriques de trafic,
latences, taux d'erreur, nombre d'utilisateurs, historique de déploiements,
état des autres applications du serveur, graphiques de charge. L'application ne
mesure rien de tout cela.

## Product Principles

1. **La page répond à une question, une seule** : est-ce que la version en ligne
   est celle que j'attends ? Tout ce qui n'y concourt pas encombre.
2. **Rien d'affiché qui ne soit mesuré.** Pas d'indicateur décoratif, pas de
   graphique sans donnée derrière.
3. **L'identité vient de l'infrastructure**, jamais du client.
4. **Le gabarit doit rester copiable** : un fichier de page, zéro dépendance,
   zéro asset externe.
5. **Vérifier ne doit pas exiger d'ouvrir la page** : l'en-tête porte la même
   vérité que l'écran.
