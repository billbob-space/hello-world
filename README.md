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
apps/<nom>/          une application : app.yml, Dockerfile, test.sh, PRODUCT.md, code
compose.yaml         GÉNÉRÉ — la stack, un service par app activée
fabrique.yml         org, dépôt, registre, domaine, réseau, plafonds
init.sh              le générateur et le vérificateur
go.work              GÉNÉRÉ — les modules Go, pour gopls
.github/workflows/   GÉNÉRÉ — construction par app, déploiement unique
.claude/             GÉNÉRÉ — outillage de l'agent, union des langages
```

Le nom du répertoire sous `apps/` **est** l'identité de l'application : son
sous-domaine, son nom de conteneur, son nom de routeur Traefik et le dernier
segment de son image. Il doit être un label DNS valide.

## Ajouter une application

Deux commits — **construire d'abord, brancher ensuite** :

```bash
./init.sh --add ma-nouvelle-app --stack go --exposure private
# écrire apps/ma-nouvelle-app/{Dockerfile,test.sh,PRODUCT.md,README.md,code}
./init.sh --check
git add apps/ma-nouvelle-app && git commit     # commit 1 : la CI publie l'image

./init.sh --app ma-nouvelle-app --enable       # une fois l'image publiée
./init.sh --check
git add apps/ma-nouvelle-app/app.yml compose.yaml && git commit    # commit 2 : le déploiement
```

Une app naît `enabled: false`. La raison est dans la section suivante.

## Une seule stack : ce que ça implique

`docker compose up` est **atomique pour la stack entière**. Une image absente du
registre — une app neuve dont l'image n'est pas encore publiée, une construction
échouée — fait échouer le déploiement de **toutes** les applications, y compris
celles qui n'ont pas changé.

Trois garde-fous en découlent :

| Garde-fou | Ce qu'il empêche |
|---|---|
| `enabled: false` par défaut | qu'une app entre dans le compose avant que son image existe |
| garde-fou de CI | que le webhook parte alors qu'une image du compose est introuvable |
| `./init.sh --check` par service | qu'une app se retrouve sans authentification, ou en écart avec son `app.yml` |

Le pire cas est donc « rien n'est déployé », jamais « tout tombe ». Un
déploiement refusé se lit dans les journaux du workflow, pas sur le site.

## Comment on travaille

Une branche dès la première modification, nommée `<app>/<sujet>` — ou
`fabrique/<sujet>` pour l'infrastructure —, puis un commit par étape vérifiée.

```bash
./init.sh --branche cadran/fuseaux-multiples   # nom validé, départ depuis origin/main
./init.sh --pret                               # cette étape est-elle committable ?
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

Il vérifie, **service par service** et non par recherche globale dans le
fichier : le middleware conforme à l'`exposure` de chaque app, la règle
`Host()`, `priority=100`, le port, la mémoire, le `container_name`, le
`pull_policy`, le nommage de l'image, les journaux bornés, l'absence de `ports:`.
Puis, en croisé : l'unicité des noms de service, des hostnames et des
`container_name`, la correspondance exacte entre `apps/*/app.yml` et les
services du compose, la mémoire totale engagée.

Il vérifie enfin que **chaque artefact généré correspond aux manifestes** : si
un `app.yml` a changé sans qu'`./init.sh` ait été relancé, le contrôle échoue.
C'est le seul mécanisme capable de prouver que le `compose.yaml` committé décrit
bien les applications committées.

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

Ni base de données, ni cache, ni volume persistant, ni port supplémentaire.

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
