# La fabrique

Un dépôt, plusieurs applications, **une seule stack dockhand** sur
`billbob.ovh`. Chaque application a son code, son PRD, son URL et son palier
d'exposition ; toutes sont déployées ensemble.

Le contrat que doit respecter chaque application est dans
[`CLAUDE.md`](CLAUDE.md). Ce fichier-ci décrit la fabrique elle-même.

## Applications

```bash
./init.sh --list
```

| App | URL | Auth | Ce qu'elle fait |
|---|---|---|---|
| [`hello-world`](apps/hello-world/) | `hello-world.apps.billbob.ovh` | `private` | rend visible l'état du déploiement |
| [`cadran`](apps/cadran/) | `cadran.apps.billbob.ovh` | `private` | l'heure du serveur, sur un cadran à aiguilles |
| [`ramure`](apps/ramure/) | `ramure.apps.billbob.ovh` | `private` | l'arbre de parenté musicale, qu'on parcourt de branche en branche |

## Arborescence

```
apps/<nom>/          une application : app.yml, .dockerignore, test.sh, README.md,
                     PRODUCT.md (écrits par --add), Dockerfile et code (à toi)
compose.yaml         GÉNÉRÉ — la stack : les apps activées, leurs services annexes,
                     les services partagés, et le bloc volumes: s'il y a des volumes
fabrique.yml         org, dépôt, registre, domaine, réseau, plafonds, et
                     shared_services — les services partagés par plusieurs apps
init.sh              le générateur et le vérificateur
go.work              GÉNÉRÉ — les modules Go, pour gopls
.github/workflows/   GÉNÉRÉ — construction par app, déploiement unique
.claude/             GÉNÉRÉ — outillage de l'agent, union des langages
```

Le nom du répertoire sous `apps/` **est** l'identité de l'application : son
sous-domaine, son nom de conteneur, son nom de routeur Traefik et le dernier
segment de son image. Il doit être un label DNS valide.

## Ajouter une application

Deux commits — **construire d'abord, brancher ensuite** : le premier fait
publier l'image par la CI, le second seulement fait entrer l'app dans le
compose. C'est pourquoi une app naît `enabled: false` ; la raison est dans la
section suivante.

```bash
./init.sh --add ma-nouvelle-app --stack go --exposure private
```

La séquence complète, ce que le commit 1 doit emporter, et la liste de ce que
`--add` réécrit — le workflow et `.claude/` n'en sont pas — vivent en un seul
endroit : [`memory/ajouter-une-app.md`](memory/ajouter-une-app.md). Ce
paragraphe en portait une copie, restée en arrière le jour où le workflow a
cessé d'être généré.

## Une seule stack : ce que ça implique

`docker compose up` est **atomique pour la stack entière**. Une image absente du
registre — une app neuve dont l'image n'est pas encore publiée, une construction
échouée — fait échouer le déploiement de **toutes** les applications, y compris
celles qui n'ont pas changé.

Trois garde-fous en découlent :

| Garde-fou | Ce qu'il empêche |
|---|---|
| `enabled: false` par défaut | qu'une app entre dans le compose avant que son image existe |
| garde-fou de CI | que le webhook parte alors qu'**une seule** image référencée par le compose est introuvable — celles de la fabrique, des annexes, des services partagés, et les **tierces** : `docker buildx imagetools inspect` interroge le registre en anonyme, une image publique s'inspecte sans login et une faute de frappe sort en 1 |
| `./init.sh --check` par service | qu'une app se retrouve sans authentification, qu'un service annexe ou partagé se retrouve routé sans authentification, ou qu'un service soit en écart avec son manifeste |

Le pire cas est donc « rien n'est déployé », jamais « tout tombe ». Un
déploiement refusé se lit dans les journaux du workflow, pas sur le site.

## Comment on travaille

Une branche dès la première modification, nommée `<app>/<sujet>` — ou
`fabrique/<sujet>` pour l'infrastructure —, puis un commit par étape vérifiée.

```bash
./scripts/branche.sh cadran/fuseaux-multiples   # nom validé, départ depuis origin/main
./scripts/pret.sh                               # cette étape est-elle committable ?
```

Deux hooks générés font respecter la règle plutôt que de l'écrire : l'un refuse
toute édition tant que HEAD est sur `main`, l'autre refuse de terminer sur un
arbre de travail sale. L'agent `greffier` enchaîne les trois gestes — brancher,
vérifier, committer et pousser — et se lance en tâche de fond. Le détail est
dans [`CLAUDE.md`](CLAUDE.md).

## Le contrôle avant de pousser

```bash
./init.sh --check
```

Il commence par les **manifestes** — `volumes:`, `env:`, `needs:`, `command:`,
noms de service —, parce qu'un `app.yml` faux ne pourrait produire qu'un
« compose désynchronisé » dont le vrai motif serait perdu.

Il vérifie ensuite, **service par service** et non par recherche globale dans le
fichier : le middleware conforme à l'`exposure` de chaque app, la règle
`Host()`, `priority=100`, le port, la mémoire, le `container_name`, le
`pull_policy`, le nommage de l'image, les journaux bornés, l'absence de `ports:`
— et, sur chaque service non routé, le `traefik.enable=false` qui l'en retire.
Puis, en croisé : l'unicité des noms de service, des hostnames et des
`container_name`, la correspondance exacte entre `apps/*/app.yml` et les
services du compose, la mémoire totale engagée.

Il compare **ensuite** — deuxième section, pas la dernière — chaque **artefact
généré** à ce qu'`./init.sh` écrirait aujourd'hui : si un `app.yml` a changé sans
qu'`./init.sh` ait été relancé, le contrôle échoue. C'est le seul mécanisme
capable de prouver que le `compose.yaml` committé décrit bien les applications
committées. La comparaison est **sautée** si les manifestes ci-dessus sont déjà
en faute : « désynchronisé » masquerait le vrai motif.

Il relit alors le compose **service par service** et non par recherche globale
dans le fichier, pour les **trois sortes** de services :

| Sorte | Ce qui est vérifié |
|---|---|
| `<app>` | l'authentification conforme à l'`exposure`, la règle `Host()`, `priority=100`, le port, la mémoire, le `container_name`, le `pull_policy`, le nommage de l'image, les journaux bornés, l'absence de `ports:` |
| `<app>-<nom>` (annexe) et `<nom>` (partagé) | la **présence** de `traefik.enable=false` — c'est lui, et non l'absence de label, qui retire du routage — et l'**absence** de tout autre label `traefik.*`, plus le réseau, la mémoire, les journaux, l'absence de `ports:` |

Puis les volumes : chaque montage est un volume **nommé** préfixé par son
propriétaire et jamais un bind mount, et le bloc `volumes:` de premier niveau
déclare **exactement** ceux qui sont montés — chacun avec son `name:`, sans quoi
Compose préfixerait le nom du projet et une sauvegarde archiverait un volume vide
en sortant en 0. S'il n'y a aucun volume, il n'y a aucun bloc, et c'est correct.

Puis, en croisé : l'unicité des noms de service, des hostnames et des
`container_name` — les trois sortes partagent un espace de noms plat —, la
correspondance exacte entre `apps/*/app.yml` et les services du compose, la
mémoire totale engagée, les liens morts entre documents, l'outillage de l'agent,
et l'absence de secret évident dans les fichiers suivis.

Puis les secrets, par un scan des **fichiers produits** — `compose.yaml`,
`fabrique.yml`, `apps/*/app.yml` — et non des champs : une clé qui évoque un
secret suivie d'une valeur littérale est refusée, où qu'elle soit écrite. Le même
scan tourne à la génération, qui n'écrit alors aucun artefact. `${VAR}` et un
chemin vers un secret monté en fichier sont exemptés ; le message nomme le
fichier et la ligne, sans jamais réimprimer la valeur.

Les **avertissements** ne bloquent pas — un `chown` introuvable dans un
`Dockerfile`, une clé inconnue ignorée dans une entrée `services:`, un budget
mémoire dépassé, un écart entre le setup script et les langages du dépôt. Les KO,
si.

Ce même contrôle tourne en CI, en verrou de tous les autres jobs.

> Les ports, eux, n'ont pas à être uniques : chaque application écoute dans son
> propre conteneur, aucun port n'est publié sur l'hôte, et Traefik joint chaque
> conteneur par son IP sur `apps_net`. Trois applications sur `8080` sont
> parfaitement correctes.

## Construction et déploiement

À chaque fusion sur `main` :

1. **`contrat`** — `./init.sh --check`.
2. **`detect`** — quelles applications ont changé, et faut-il déployer. Un
   commit qui ne touche que de la documentation ne redémarre rien ; un commit
   qui ne touche que `compose.yaml` déploie sans reconstruire.
3. **`test`** — une matrice, `apps/<nom>/test.sh` par application.
4. **`build`** — une matrice, contexte `apps/<nom>`, publication sur GHCR sous
   `ghcr.io/<org>/<dépôt>/<app>`, cache séparé par app.
5. **`deploy`** — le garde-fou d'images, puis **un seul** appel de webhook.

Sur une *pull request*, tout tourne sauf la publication et le déploiement :
le Dockerfile est validé sans que le tag `:main` bouge.

### Le webhook

Le tag `:main` est **mutable** : une image reconstruite ne change pas une ligne
du `compose.yaml`. L'auto-sync de `dockhand`, qui ne redéploie que s'il voit un
diff dans le répertoire de la stack, ne verrait donc jamais rien passer. C'est
le dernier pas du workflow qui déclenche le déploiement, en appelant le webhook
de la stack **après** la publication des images — l'ordre importe.

L'URL de ce webhook est une *URL de capacité* : qui la connaît peut déclencher
un déploiement. Elle n'est donc pas dans ce dépôt, mais dans un secret :

| Secret du dépôt | Contenu |
|---|---|
| `DOCKHAND_DEPLOY_WEBHOOK` | l'URL de webhook de la stack dans `dockhand` |
| `DOCKHAND_WEBHOOK_SECRET` | le secret du webhook, configuré côté `dockhand` |

À poser dans *Settings → Secrets and variables → Actions*. Sans l'URL, le
workflow publie les images, émet un avertissement et n'appelle rien — la
construction reste verte, mais **rien n'est déployé**.

`dockhand` accepte trois façons de s'authentifier ; le workflow suit celle que
sa documentation recommande pour une CI générique :

| Méthode | En-tête / paramètre | Usage |
|---|---|---|
| **HMAC-SHA256** | `X-Hub-Signature-256: sha256=<hex>` | ce que fait le workflow |
| Jeton en clair | `X-Gitlab-Token: <secret>` | webhooks GitLab |
| Paramètre d'URL | `?secret=<secret>` | **GET uniquement** |

Le corps envoyé est `{}` : `dockhand` ne le lit pas, il relit le dépôt lui-même.
Seule la signature compte.

### Le piège : `Force redeployment` est obligatoire

`dockhand` ne redéploie **que s'il voit un changement** dans le dépôt, et ce
qu'il regarde est plus étroit que sa documentation ne le laisse croire. Constaté
par l'expérience sur ce dépôt :

| Commit | Fichiers modifiés | Résultat |
|---|---|---|
| `2ec90f4` | code applicatif | `No changes detected, skipping redeploy` |
| `cb7035b` | `compose.yaml` | déploiement exécuté |

Le tag `:main` étant mutable, `compose.yaml` ne change pas d'un commit applicatif
à l'autre. **Sans `Force redeployment`, aucune modification de code n'est jamais
déployée** — l'image est construite et publiée, le webhook répond `200`, et le
serveur continue de servir la version précédente.

Le réglage se trouve dans les *Deploy options* de la stack. Le workflow traite
le `skipped` comme un échec. `Re-pull images`, en revanche, n'est **pas**
nécessaire : le `pull_policy: always` du `compose.yaml` couvre le même besoin, et
le fait depuis le dépôt plutôt que depuis une case cochée sur le serveur.

La stack `dockhand` elle-même ne change pas avec la fabrique : même dépôt, même
`composePath: compose.yaml`, mêmes secrets. Seul son contenu grandit.

## Outillage de l'agent

Les plugins sont déclarés dans `.claude/settings.json`, versionné, et l'ensemble
est l'**union** de ce que demandent les applications : un serveur LSP par
langage présent, plus les plugins d'interface dès qu'une seule app porte
`ui: true`.

Le stockage étant local à la machine, chaque conteneur repart de zéro — et
**aucun script du dépôt ne peut combler ce vide à temps** : Claude Code charge
ses plugins avant qu'un hook `SessionStart` ne s'exécute, et `/reload-plugins`
n'existe pas sur le web. L'installation appartient donc au **setup script de
l'environnement**, seul point d'accroche antérieur au lancement. Voir
[`CLAUDE.md`](CLAUDE.md) : il se colle une fois, et `init.sh` en génère le
contenu dans `.claude/cloud-setup.sh`.

Le hook, lui, se borne à dire ce qu'il voit :

```
Outillage : 12/12 plugins installes, 1/1 serveurs LSP presents.
```

### La dépendance aux binaires LSP

Un plugin LSP **lance** le serveur de langage, il ne le **fournit** pas. Sans le
binaire, le plugin s'installe sans erreur et reste inerte : plus de diagnostics
du compilateur après édition, et rien qui l'annonce. D'où le second compteur du
rapport, indépendant du décompte des plugins — les deux divergent.

`cloud-setup.sh` s'en charge côté cloud, en parallèle pour tenir sous les cinq
minutes du budget. Sur une machine ordinaire, l'installation est manuelle, une
fois par langage — pour Go :

```bash
go install golang.org/x/tools/gopls@latest
```

Attention au piège : `go install` dépose le binaire dans `$(go env GOPATH)/bin`,
souvent hors du PATH. Une installation réussie peut laisser le plugin tout aussi
inerte — le rapport du hook continuera à signaler `gopls ABSENT` tant que le
binaire n'est pas résolvable, ce qui est exactement ce qu'il faut savoir. La
commande du setup script cloud diffère : elle tourne **en root**
(`GOBIN=/usr/local/bin`), pour déposer le binaire dans un répertoire déjà
présent dans le PATH de toutes les sessions.

## Besoins d'infrastructure

À ce jour, aucune application de la fabrique ne déclare de volume ni de service
partagé — `shared_services` est vide dans `fabrique.yml` et le `compose.yaml`
généré ne porte donc aucun bloc `volumes:`. C'est un **état**, pas une limite du
contrat : une base de données, un cache, un volume persistant ou un service
annexe se déclarent désormais dans les manifestes (`volumes:`, `services:`,
`needs:` d'un `app.yml`, `shared_services` de `fabrique.yml`), `./init.sh` les
génère et le déploiement les crée. Voir [`CLAUDE.md`](CLAUDE.md).

Ce qui reste **hors de ce dépôt** est plus étroit, et ne se traite pas d'un seul
geste — même règle que [`CLAUDE.md`](CLAUDE.md) :

- **un fait** — la **topologie réseau** (`apps_net` est `external: true`, Traefik,
  TLS, DNS et liste blanche vivent côté serveur) : on vit avec ;
- **une demande** — les **valeurs** des secrets : le dépôt n'en porte que les
  noms, dans `env:` et dans le `README` de l'app, et **on s'arrête là** ;
  l'infrastructure injecte la valeur ;
- **trois refus**, qui ne se demandent pas parce que le contrat offre déjà
  l'alternative — un **port publié** sur l'hôte (c'est Traefik qui joint le
  conteneur par `apps_net`), un **bind mount** depuis un chemin de l'hôte (un
  volume nommé, créé par `docker compose up`), et une **exposition sans
  authentification** (il n'y a que `private` et `google`).

**Un point reste à régler côté serveur : l'accès en lecture aux paquets GHCR.**
La construction publie bien les images, mais `dockhand` échoue à les récupérer :

```
Error response from daemon: Head "https://ghcr.io/v2/billbob-space/hello-world/manifests/main": unauthorized
```

Le dépôt est privé, donc les paquets le sont aussi, et le démon Docker du
serveur tire sans identifiants. Rien dans ce dépôt ne peut corriger cela. Deux
résolutions, toutes deux côté serveur ou côté organisation GitHub :

1. **Authentifier le serveur sur `ghcr.io`** avec un jeton en lecture seule
   (portée `read:packages`) — `docker login ghcr.io`, ou la configuration
   d'identifiants de registre de `dockhand`. Les images restent privées. C'est
   la voie à préférer.
2. **Rendre les paquets publics** (page du paquet → *Package settings* →
   *Change visibility*). Le dépôt reste privé, mais les images publiées
   deviennent téléchargeables par n'importe qui — donc les binaires avec.

Le nommage `ghcr.io/<org>/<dépôt>/<app>` a été choisi pour que ce réglage se
fasse **une seule fois** : les paquets étant tous rattachés au même dépôt, un
identifiant unique couvre toutes les applications présentes et futures. Un
nommage `ghcr.io/<org>/<app>` aurait en plus risqué la collision avec les
paquets des dépôts autonomes de l'organisation.

Le jeton, quelle que soit l'option, vit côté serveur : ni dans ce dépôt, ni dans
une image, ni dans `.claude/settings.json`.

### À vérifier avant d'ajouter la deuxième application

- **DNS** : `*.apps.billbob.ovh` est-il un enregistrement joker ? Sinon chaque
  nouvelle application demande un enregistrement, et son URL renverra une erreur
  de résolution jusque-là.
- **Certificats** : Let's Encrypt délivre un certificat par nom d'hôte.
- **Mémoire** : `memory_budget` dans `fabrique.yml` est un plafond déclaratif,
  pas une mesure de la RAM du serveur. Ajuste-le à la réalité de la machine.
- **Conteneur orphelin** : si la stack `dockhand` est recréée plutôt que mise à
  jour, l'ancien conteneur survit hors projet et bloque le nouveau
  (`container name already in use`) — la stack entière refuse alors de démarrer.
