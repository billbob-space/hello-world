# Contrat de déploiement — billbob.ovh

Cette application est déployée automatiquement sur le serveur `billbob.ovh`.
Les règles ci-dessous sont imposées par l'infrastructure : les enfreindre ne
provoque pas une erreur claire, mais un déploiement qui échoue en silence.

**Le nom de l'application est celui du dépôt.** Dans tout ce document,
`<app>` désigne ce nom. Rien n'est à personnaliser dans ce fichier.

## Démarrage

Lance d'abord le script d'initialisation, qui génère les fichiers
d'infrastructure conformes au contrat :

```bash
./init.sh              # génère compose, workflow CI, .dockerignore
./init.sh --check      # vérifie que le dépôt respecte le contrat
```

Il ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail, et le
choix de la technologie t'appartient.

## Le contrat

| Élément | Valeur | Pourquoi |
|---|---|---|
| URL publique | `https://<app>.apps.billbob.ovh` | routage écrit côté serveur |
| Port d'écoute | `8080`, **HTTP en clair** | le TLS est terminé par Traefik en amont |
| Chemin de santé | `GET /healthz` → `200` quand l'app est prête | vérifié par le healthcheck du conteneur |
| Image publiée | `ghcr.io/billbob-space/<app>:main` | tirée par le serveur à chaque déploiement |
| Utilisateur | non root (`USER` dans le Dockerfile) | le conteneur ne doit pas tourner en root |

## Règles impératives

- **`Dockerfile` à la racine**, construction multi-étapes, image finale
  **< 200 Mo**. Le disque du serveur est à 92 % — une image lourde est refusée
  en revue.
- **Ne publie aucun port.** Pas de section `ports:` dans le compose. Traefik
  joint le conteneur par le réseau Docker interne.
- **Le routage vit dans les labels du `docker-compose.yml`**, générés par
  `init.sh`. N'y touche pas : le middleware `forwardauth` est l'authentification
  Google, et `priority=100` est ce qui empêche un serveur catch-all de capter
  l'URL et de servir un 404 silencieux.
- **Aucun `LABEL traefik.*` dans le `Dockerfile`**, sans exception. Docker
  fusionne les labels de l'image dans ceux du conteneur : un label de routage
  gravé dans l'image publierait un routeur **supplémentaire**, que le compose ne
  peut pas écraser puisqu'il porte un autre nom — donc **sans authentification**,
  ouvert à tous.
- **Aucun secret** dans le dépôt ni dans l'image : pas de clé d'API, pas de mot
  de passe, pas de jeton. Les valeurs sensibles sont injectées par
  l'infrastructure via l'environnement. Déclare les noms attendus dans le
  `README`, jamais les valeurs.
- **N'écris pas de logs dans un fichier** : écris sur la sortie standard.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Authentification

L'application est **derrière une authentification Google**, appliquée par
l'infrastructure avant qu'une requête ne l'atteigne.

**Ne code pas de système de comptes.** L'identité de l'utilisateur connecté
arrive dans l'en-tête HTTP `X-Forwarded-User` (son adresse e-mail). Si tu as
besoin de cloisonner des données par utilisateur, c'est la seule source à
utiliser — et ne fais jamais confiance à un identifiant fourni par le client
(paramètre d'URL, corps de requête, cookie applicatif).

## Ce qui ne t'appartient pas

La topologie réseau, les bases de données partagées et les secrets vivent sur le
serveur, hors de ce dépôt. N'essaie pas de les configurer ici, et ne modifie pas
les fichiers générés par `init.sh` sans raison : ils encodent le contrat.

Le réseau `apps_net` est déclaré `external: true` : il existe déjà côté serveur,
ce dépôt ne le crée pas.

Si tu as besoin de quelque chose que le contrat ne prévoit pas — une base de
données, un cache, un volume persistant, un port supplémentaire — **écris-le
dans le `README` et arrête-toi**. C'est une décision d'infrastructure, elle se
prend côté serveur.

## Avant de pousser

```bash
./init.sh --check
```

Le déploiement se déclenche à chaque fusion sur `main` : construction de
l'image chez GitHub, publication sur GHCR, puis récupération par le serveur.
Compte deux à trois minutes entre la fusion et la mise en ligne.
