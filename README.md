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
| [`ardoise`](apps/ardoise/) | `ardoise.apps.billbob.ovh` | `private` | la plus petite app qui exerce les quatre étages du contrat : interface, service, base, cache |
| [`compteur`](apps/compteur/) | `compteur.apps.billbob.ovh` | `google` | le second passage de la validation de bout en bout, sur ce qu'`ardoise` seule n'exerçait pas |
| [`marcq-handball`](apps/marcq-handball/) | `marcq-handball.apps.billbob.ovh` | `public` | le programme d'avant-reprise d'une équipe U15, qui se coche et se compare |

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
.github/workflows/   ordinaire — construction par app, déploiement unique ;
                     --check en vérifie deux propriétés, pas l'égalité à un modèle
.claude/             outillage de l'agent — settings.json s'édite à la main,
                     cloud-setup.sh est GÉNÉRÉ depuis les langages du dépôt
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
`container_name` — les trois sortes partagent un espace de noms plat — et la
correspondance exacte entre `apps/*/app.yml` et les services du compose.

Puis **chaque application**, hors du compose cette fois : le `Dockerfile`
multi-étapes et son `USER` non root, l'absence de label `traefik.*`, la présence
de l'outil qu'appelle le healthcheck, le `chown` du chemin de chaque volume, le
`test.sh` exécutable, le `.dockerignore` et le `PRODUCT.md`.

Puis la fabrique elle-même : la mémoire totale engagée, les liens morts entre
documents, l'en-tête des fichiers de `memory/` et leur sommaire, la taille du
contrat. Puis l'outillage de l'agent. Puis le journal — chaque entrée committée,
son en-tête et ses deux champs à vocabulaire fermé.

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
5. **`deploy`** — l'épinglage des versions livrées, le garde-fou d'images, la
   poussée de `versions.yml` sur `main`, puis **un seul** appel de webhook.

Sur une *pull request*, tout tourne sauf la publication et le déploiement :
le Dockerfile est validé sans que le tag `:main` bouge.

### Les versions épinglées

Chaque application est déployée sur le **commit qui l'a construite**, et non sur
un tag `:main` commun. Ce commit est écrit par la CI dans `versions.yml` :

```yaml
cadran: 4f21c8e9a1b3...      # la version qui tourne en ligne
marcq-handball: 9c82467...
```

`init.sh` le reporte dans `compose.yaml`. Livrer une application ne fait donc
bouger qu'**une** ligne `image:` de tout le fichier — vérifié : le commit de
déploiement de `hello-world` du 8 août fait exactement deux lignes, une dans
`compose.yaml` et une dans `versions.yml`.

Ce que cela apporte :

- **Le dépôt dit quelle version tourne**, application par application, ce qu'aucun
  tag mutable ne permettait de savoir.
- **Revenir en arrière** ne reconstruit rien : on remet le commit précédent dans
  `versions.yml`, on lance `./init.sh`, on pousse. L'image est déjà sur GHCR.
- **Le déploiement ne dépend plus d'un réglage du serveur** : le `compose.yaml`
  change à chaque livraison, `dockhand` voit donc toujours un diff.

Une application absente de `versions.yml` retombe sur `:main`, le tag mutable :
c'est le cas d'une app dont aucune image n'a encore été publiée, et `--check` le
signale en avertissement. Le fichier est **écrit par la CI**, jamais à la main —
sauf pour un retour en arrière, où l'on change une ligne et relance `./init.sh`.

### Ce que les versions épinglées n'obtiennent PAS : le redémarrage sélectif

L'objectif initial était qu'une livraison ne recrée que le conteneur de l'app
livrée. **Il n'est pas atteint, et le dépôt n'y peut rien.** Mesuré le 8 août, sur
une livraison ne touchant que `hello-world` et avec `Force redeployment` décoché :
les neuf conteneurs de la stack ont été recréés. Le journal de `dockhand` dit
pourquoi, en trois lignes :

```
Will force recreate: true (updated=true)
Force redeploy setting: false
Command: docker compose ... up -d --remove-orphans --force-recreate
```

`dockhand` ajoute `--force-recreate` **de lui-même** dès que sa synchronisation a
mis à jour ne serait-ce qu'un fichier du dépôt — un `README`, une entrée de
journal, n'importe lequel. Le réglage `Force redeployment` est un *second* levier,
indépendant de celui-là : le décocher ne change rien à cette règle interne. Et
puisqu'un déploiement suppose par définition un fichier modifié, la condition est
toujours vraie : **toute livraison recrée toute la stack**.

Trois conséquences pratiques :

- Une livraison coûte quelques secondes d'indisponibilité à **toutes** les apps,
  pas seulement à celle qu'on livre. Elles reviennent seules.
- Un commit de documentation sur `main` fait la même chose, par la
  synchronisation automatique, alors même que la CI ne déclenche aucun
  déploiement.
- Le seul levier restant est côté `dockhand` : une option « ne recréer que les
  services modifiés » si une version l'apporte, ou un autre outil de déploiement.
  Rien de tout cela ne se décide depuis ce dépôt.

### Le webhook

Un tag épinglé change bien le `compose.yaml`, donc `dockhand` a désormais un vrai
diff à voir. C'est pourtant toujours le dernier pas du workflow qui déclenche le
déploiement, en appelant le webhook de la stack **après** la publication des
images et **après** la poussée de `versions.yml` — l'ordre importe : `dockhand`
clone le dépôt lui-même et tire les images qu'il y lit.

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

### Le réglage `Force redeployment`, et pourquoi il doit être décoché

`dockhand` ne redéploie **que s'il voit un changement** dans le dépôt, et ce
qu'il regarde est plus étroit que sa documentation ne le laisse croire. Constaté
par l'expérience sur ce dépôt :

| Commit | Fichiers modifiés | Résultat |
|---|---|---|
| `2ec90f4` | code applicatif | `No changes detected, skipping redeploy` |
| `cb7035b` | `compose.yaml` | déploiement exécuté |

Tant que toutes les apps portaient le tag mutable `:main`, `compose.yaml` ne
changeait pas d'un commit applicatif à l'autre : **sans `Force redeployment`,
aucune modification de code n'était jamais déployée**. Le réglage était donc
obligatoire — et il a un coût, celui qui a motivé les versions épinglées : forcer
un déploiement, c'est recréer **tous** les conteneurs de la stack.

Depuis, chaque livraison change une ligne du `compose.yaml`. `dockhand` voit donc
le diff de lui-même, et le réglage n'a plus lieu d'être :

> Dans les *Deploy options* de la stack, **`Force redeployment` reste décoché**.
> Il ne sert plus à rien — mais le décocher **ne rend pas** le déploiement
> sélectif pour autant : `dockhand` force la recréation de son propre chef dès
> qu'un fichier du dépôt a changé. Voir la section précédente, mesures à l'appui.

`Re-pull images` n'est toujours **pas** nécessaire : le `pull_policy: always` du
`compose.yaml` couvre le même besoin, et le fait depuis le dépôt plutôt que depuis
une case cochée sur le serveur. Le workflow traite toujours un `skipped` comme un
échec — il ne peut désormais plus vouloir dire « rien à faire ».

La stack `dockhand` elle-même ne change pas avec la fabrique : même dépôt, même
`composePath: compose.yaml`, mêmes secrets. Seul son contenu grandit.

## Regarder la production

```bash
./scripts/prod.sh                        # l'état des services de la stack
./scripts/prod.sh journaux cadran 200    # les 200 dernières lignes de journal
./scripts/prod.sh fichiers ardoise /data # ce qu'il y a dans un volume
./scripts/prod.sh lire cadran /etc/hostname
./scripts/prod.sh inspecter redis
```

Un agent n'a **ni SSH ni socket Docker**, et ne peut pas en avoir : tout le
domaine est derrière Traefik, qui exige un compte Google avant de laisser passer
quoi que ce soit, et un agent n'a pas de navigateur. Sans le détour ci-dessous,
la seule façon de savoir ce que fait une application déployée est de demander une
capture d'écran à un humain — un aller-retour par question, sur le seul
environnement où l'on ne peut rien reproduire.

Le détour est une **porte de service** sur l'API de `dockhand`, qui gère la
stack : un routeur Traefik supplémentaire, **sans `ForwardAuth`**, posé sur le
conteneur `dockhand` et restreint au chemin `/api` **et à la méthode `GET`**.

```
- "traefik.http.routers.dockhand-api.rule=Host(`dockhand.billbob.ovh`) && PathPrefix(`/api`) && Method(`GET`)"
- "traefik.http.routers.dockhand-api.priority=200"
- "traefik.http.routers.dockhand-api.entrypoints=websecure"
- "traefik.http.routers.dockhand-api.middlewares=public,security-headers@file"
- "traefik.http.routers.dockhand-api.tls.certresolver=letsencrypt"
- "traefik.http.routers.dockhand-api.service=dockhand"
```

**`Method(GET)` est ce qui rend la lecture seule vraie**, et il n'y a rien
d'autre. `dockhand` en édition libre **ne connaît pas les rôles** : tout jeton
d'API y est administrateur, et un jeton dit « de lecture » n'existe pas. C'est
donc le routeur, et lui seul, qui interdit d'arrêter la stack — un `POST` ne
l'atteint même pas, il retombe sur le routeur d'origine et repart vers Google.
Élargir cette règle, c'est déplacer le seul verrou : la porte est sur Internet,
et le jeton la garde à lui tout seul.

La priorité `200` doit rester **strictement supérieure** à celle du routeur de
l'interface web, sans quoi Traefik continue de servir celui-ci. L'interface, elle,
ne change pas : elle reste derrière la connexion Google.

Le reste vit dans l'environnement, jamais dans ce dépôt — il est public pour
l'outillage, un jeton qui y entre est un jeton perdu :

| Variable | Contenu |
|---|---|
| `DOCKHAND_URL` | l'adresse de `dockhand`, sans barre finale |
| `DOCKHAND_TOKEN` | un jeton créé dans *Settings → API tokens* de `dockhand` |

À poser dans les variables de l'environnement cloud du projet. Une session déjà
ouverte ne les voit pas : il en faut une nouvelle. Sans elles, `prod.sh` s'arrête
en le disant plutôt qu'en échouant à mi-chemin.

**Le contrôle qui prouve que la porte est bien étroite**, à rejouer après toute
retouche du routeur — les trois doivent tomber juste :

```bash
curl -so /dev/null -w '%{http_code}\n' https://dockhand.billbob.ovh/api/health          # 200
curl -so /dev/null -w '%{http_code}\n' https://dockhand.billbob.ovh/api/containers      # 401
curl -so /dev/null -w '%{http_code}\n' -X POST https://dockhand.billbob.ovh/api/containers  # 307
```

`200` sans jeton sur `/api/health` dit que la porte est ouverte ; `401` sur une
route qui porte des données dit que `dockhand` authentifie toujours ; `307` sur
un `POST` dit que l'écriture reste derrière Google. Un `200` ou un `401` à la
troisième ligne signifie que la porte laisse passer l'écriture — c'est la seule
des trois qui soit une urgence.

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

Une base de données, un cache, un volume persistant ou un service annexe se
déclarent dans les manifestes — `volumes:`, `services:`, `needs:` d'un `app.yml`,
`shared_services` de `fabrique.yml` —, `./init.sh` les génère et le déploiement
les crée. Rien de tout cela ne se demande à l'infrastructure. Voir
[`CLAUDE.md`](CLAUDE.md).

La stack en porte aujourd'hui : deux bases annexes (`ardoise-base`,
`compteur-base`), un cache partagé (`redis`, un Valkey pour toutes les apps), et
trois volumes nommés (`ardoise-donnees`, `compteur-donnees`,
`marcq-handball-donnees`).

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

### À vérifier à chaque nouvelle application

- **DNS** : `*.apps.billbob.ovh` est-il un enregistrement joker ? Sinon chaque
  nouvelle application demande un enregistrement, et son URL renverra une erreur
  de résolution jusque-là.
- **Certificats** : Let's Encrypt délivre un certificat par nom d'hôte.
- **Mémoire** : `memory_budget` dans `fabrique.yml` est un plafond déclaratif,
  pas une mesure de la RAM du serveur. **Il est dépassé aujourd'hui** — neuf
  services pour 1216 Mo engagés contre 1024 déclarés, et `--check` l'avertit à
  chaque passage. Ajuste-le à la réalité de la machine, ou réduis les `memory:`.
- **Conteneur orphelin** : si la stack `dockhand` est recréée plutôt que mise à
  jour, l'ancien conteneur survit hors projet et bloque le nouveau
  (`container name already in use`) — la stack entière refuse alors de démarrer.
