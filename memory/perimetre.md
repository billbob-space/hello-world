# Ce qui ne t’appartient pas — le détail

Quand lire : avant d'écrire dans un README une demande adressée au serveur, et
avant de supposer qu'une base, un cache ou un volume n'est pas de ton ressort.
Tenu par : --check — section `ports:` refusée, bind mount refusé, palier sans
authentification inexistant ; les trois refus ont chacun leur alternative générée

D'abord ce qui **t'appartient désormais**, et qui relevait autrefois du serveur : une
base de données, un cache, un volume persistant, un service annexe.
`shared_services`, `services:` et `volumes:` les font entrer dans le contrat — tu les
déclares, `./init.sh` les génère, le déploiement les crée. Ne demande pas dans un
`README` ce que tu peux écrire dans un manifeste.

**Un fait, avec lequel tu vis** — la **topologie réseau** : `apps_net` est
`external: true`, il existe déjà côté serveur, tout comme Traefik, le résolveur TLS,
le DNS et la liste blanche des comptes.

**Une demande, la seule** à laquelle s'applique « écris-le dans ton `README` et
arrête-toi » — les **valeurs** des secrets : tu écris le *nom* de la variable dans
`env:` et dans ton `README`, rien de plus ; l'infrastructure injecte la valeur.

**Trois refus** — pas des demandes négociables : le contrat les refuse et offre déjà
l'alternative, inutile de les écrire dans un `README`.

| Refusé | Pourquoi | À la place |
|---|---|---|
| un **port publié** sur l'hôte | rien ne se publie sur l'hôte ; `--check` refuse une section `ports:` | **Traefik** joint ton conteneur par `apps_net`, sur le `port:` de ton `app.yml` |
| un **bind mount** depuis un chemin de l'hôte | Docker créerait le répertoire absent **en root** et ton app non-root n'y écrirait jamais | un **volume nommé** dans `volumes:` — créé par `docker compose up`, zéro action sur l'hôte |
| une **exposition sans authentification** | il n'existe pas de troisième palier | `private` ou `google`, et `X-Forwarded-User` pour cloisonner par utilisateur |

Le **réglage une fois pour toutes** de la fabrique vit lui aussi hors du dépôt — accès
en lecture aux paquets GHCR, secrets `DOCKHAND_*` du dépôt GitHub, option *Force
redeployment* de la stack `dockhand`, enregistrement DNS du sous-domaine. Il ne se
pose pas app par app, le [`README`](../README.md) le documente, n'écris pas de demande
pour lui.

Quand tu travailles sur une app, **les fichiers des autres apps ne t'appartiennent pas
non plus**, ni les artefacts générés : `compose.yaml`, `.github/`, `.claude/`,
`go.work`. Tu changes `apps/<nom>/app.yml` — ou `fabrique.yml` si c'est un service
partagé, en sachant qu'il est commun à toutes les apps — et tu relances `./init.sh`.
