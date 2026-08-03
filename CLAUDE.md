# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : plusieurs applications, chacune avec son code,
son PRD, son URL et son palier d'exposition, toutes déployées ensemble dans
**une seule stack dockhand**. Les règles ci-dessous sont imposées par
l'infrastructure : les enfreindre ne provoque pas une erreur claire, mais un
déploiement qui échoue en silence.

**Le nom d'une application est celui de son répertoire sous `apps/`** : il
devient le sous-domaine, le nom de conteneur et le nom de routeur Traefik, il
doit donc être un label DNS valide. Org, dépôt et domaine sont dans
`fabrique.yml`.

## Comment tu réponds

**En français, simplement, pour quelqu'un qui n'est pas technicien.** Celui qui
te lit décide de ce qu'on construit ; il ne lit pas le code. Une réponse qu'il
ne comprend pas ne vaut rien, quelle que soit la qualité du travail décrit.

- **Toujours en français** — réponses, questions, explications.
- **Court** — quelques phrases, ou trois à cinq puces : ce qui est fait, ce qui
  reste, ce qui bloque. Le reste encombre.
- **Vulgarise** — dis l'effet, pas le mécanisme : « le site répond à nouveau »
  plutôt que « le healthcheck repasse healthy ». Un terme technique ne s'emploie
  que s'il est indispensable, et s'explique alors en quelques mots.
- **Pas de jargon décoratif** — ni noms de fichiers, ni options, ni extraits de
  code, sauf demande ou geste à faire ; alors la commande exacte, seule.
- **Dis franchement ce qui ne va pas** — « ça ne marche pas encore, voilà
  pourquoi » est une réponse utile.

**Cette règle vaut pour ce que tu dis, pas pour ce que tu écris dans le dépôt.**
Messages de commit, entrées de `journal/`, `README` et corps de PR gardent toute
leur précision technique : leur lecteur est un développeur ou un agent.

## Arborescence

```
apps/<nom>/    une application. `--add` y écrit app.yml, .dockerignore, test.sh,
               README.md, PRODUCT.md ; le Dockerfile et le code sont à toi
journal/       une entrée par branche : les anomalies rencontrées
compose.yaml   GÉNÉRÉ — la stack entière : les trois sortes de services, plus le
               bloc volumes: si et seulement si un service en monte un
fabrique.yml   valeurs communes : org, dépôt, registre, domaine, réseau,
               plafonds, et shared_services
init.sh        le générateur
```

**Partagé** : la stack, la CI, le réseau, le domaine, `shared_services`,
l'outillage Claude Code. **Propre à chaque app** : son code, son `Dockerfile`,
son PRD, son URL, son palier d'exposition, ses volumes, ses services annexes,
ses tests.

## Démarrage

```bash
./init.sh                          # régénère compose.yaml, la CI et l'outillage
./init.sh --check                  # vérifie les manifestes, puis le dépôt service par service
./init.sh --list                   # état des applications
./init.sh --add <nom>              # échafaude apps/<nom>/
./init.sh --dry-run                # montre ce qui changerait, sans rien écrire
./init.sh --branches-fusionnees    # quelles branches distantes peuvent être supprimées
```

`--dry-run` n'écrit **rien**, pas même l'`app.yml` qu'un `--enable` modifierait :
il affiche l'ancienne et la nouvelle valeur, puis le diff des artefacts.

`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient, app par app. Les artefacts dérivés —
`compose.yaml`, le workflow, `.claude/`, `go.work` — sont **toujours réécrits** :
c'est ce qui garantit qu'une app ajoutée ne peut pas manquer du déploiement.

## `apps/<nom>/app.yml` — les valeurs que tu décides

Un fichier par application. **`init.sh` ne le réécrit jamais** : il est la source
de vérité, tu l'édites à la main.

```yaml
enabled: true              # false = dans le dépôt, mais hors du compose
port: 8080                 # port d'écoute dans le conteneur, HTTP en clair
memory: 128m               # limite mémoire du conteneur
health_path: /healthz      # chemin HTTP renvoyant 200 quand l'app est prête
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private          # private | google | public — voir plus bas
stack: none                # langage principal — active son serveur LSP
ui: false                  # true si l'app sert une interface web
volumes:                   # optionnel — ce qui survit au redéploiement
  - donnees:/var/lib/mon-app
```

Édite-le puis relance `./init.sh`, ou passe les valeurs en options — elles ne
valent alors que pour l'app ciblée :

```bash
./init.sh --app mon-app --port 3000 --health /health \
          --health-cmd 'curl -fsS http://localhost:3000/health' --exposure google
```

**`enabled: false` n'est pas un brouillon, c'est une protection.** La stack étant
unique, référencer une image qui n'existe pas encore ferait échouer le `compose
up` de **toutes** les apps. Une app neuve naît désactivée et n'entre dans le
compose qu'une fois sa première image publiée.

**`health_cmd` est le piège le plus fréquent** : il s'exécute *dans* ton
conteneur, l'outil qu'il appelle doit donc exister dans l'image finale. `wget`
est présent en Alpine et BusyBox, `curl` rarement. Une image `scratch` ou
`distroless` n'a **aucun shell** : mets `health_cmd: none`. Un healthcheck qui
échoue rend le conteneur malsain en permanence, sans que l'app soit en cause.

**`stack` et `ui` ne changent rien au déploiement**, seulement l'outillage décrit
plus bas. `.claude/settings.json` étant un réglage **de projet**, l'outillage est
l'**union** de ce que demandent toutes les apps, y compris les désactivées.

### Quatre sections optionnelles : `volumes:`, `env:`, `needs:`, `services:`

Sans équivalent en ligne de commande : elles s'écrivent à la main. Une app qui
n'en porte aucune produit exactement le bloc compose d'avant leur existence — les
déclarer est une demande explicite, jamais un passage obligé.

```yaml
volumes:
  - donnees:/var/lib/ramure     # devient le volume nommé « ramure-donnees »
  - cache:/var/cache/ramure     # jetable, et son nom le dit
env: [LASTFM_API_KEY]           # des NOMS de variables, jamais de valeurs
needs: [redis]                  # un service de shared_services (fabrique.yml)
services:                       # services annexes, privés de cette app
  - name: worker
    image: ghcr.io/billbob-space/hello-world/ramure:main
    memory: 64m
    command: --mode worker
    volumes:
      - donnees:/var/lib/ramure # le MÊME volume que l'app : partage voulu
```

**Le lecteur YAML d'`init.sh` est volontairement minimal** — listes en ligne
`[a, b]` ou en bloc `- a`, listes de mappings dont chaque élément peut porter une
liste, mais pas un niveau de plus ; ni ancre, ni bloc multi-lignes. Conséquence :
une **clé mal orthographiée est ignorée, pas refusée**. Dans `services:` et
`shared_services:`, `init.sh` l'avertit (`cle inconnue 'labels' ignoree`) sans
bloquer — écrire `labels:` à la main donne le sentiment d'avoir durci un service
sans qu'une ligne du compose bouge. Après avoir édité une de ces sections,
relance `./init.sh` et relis ton bloc dans `compose.yaml` : c'est le seul endroit
qui dise ce qui a vraiment été lu.

**`env:` ne porte que des noms**, conformes à `^[A-Z][A-Z0-9_]*$`. Un `=`, ou un
`lastfm_key`, fait échouer la génération, qui n'écrit alors aucun artefact : le
dépôt est public. `init.sh` émet `- NOM=${NOM:-}`, dont la valeur vient de
l'environnement du serveur. Le défaut vide est délibéré — un nom non défini côté
serveur ferait sinon échouer le `compose up` de la stack entière — mais il se
paie : ta variable arrive **vide** au lieu de manquer, et c'est à ton app de
traiter la chaîne vide comme une absence. Déclare aussi les noms dans ton
`README`.

**`needs:` est vérifié à la génération** : un nom absent de `shared_services`
fait échouer `./init.sh`, plutôt qu'un `depends_on` pointant dans le vide. Mais ce
que `depends_on` garantit s'arrête au **démarrage** du conteneur voisin, pas à sa
disponibilité : ton app doit survivre à un `redis` qui n'accepte pas encore de
connexion.

**`services:` — des annexes privées de l'app.** `name` et `image` sont
obligatoires : la CI ne construit que les `apps/<nom>/`, l'image d'une annexe doit
donc exister ailleurs — le plus souvent celle de l'app, `.../<app>:main`, lancée
avec une `command` différente. `memory` vaut `128m` par défaut. `command` s'écrit
en scalaire — découpée sur les espaces, guillemets respectés — ou en **liste**
YAML, chaque élément étant alors un argument tel quel ; elle est lue et émise **en
entier**, en forme exec. Une annexe devient le service `<app>-<name>`, et **ses
volumes appartiennent à l'app, pas à elle** : `donnees:/var/lib/ramure` dans le
worker monte le même `ramure-donnees` que l'app — c'est ainsi qu'un worker partage
les données de son service principal, et c'est la raison d'être du préfixe.

**Les secrets n'ont qu'une porte, et elle regarde le résultat**, jamais un champ :
un contrôle par nom de clé a autant de trous que le manifeste a de champs. Celui
qui existait sur `command:` a été contourné trois fois — un `sh -c` en jeton
unique, une valeur commençant par `-` prise pour une option, puis `health_cmd`,
qui n'entrait pas par `command:` du tout.

Avant d'écrire quoi que ce soit — et de nouveau dans `--check` — `init.sh`
**scanne `compose.yaml`, `fabrique.yml` et les `apps/*/app.yml`** à la recherche
d'un motif et d'un seul : `<mot-secret><séparateur><valeur littérale>`, où le mot
est `requirepass`, `password`, `passwd`, `secret`, `token`, `api-key`,
`secret-key`, `private-key`, `access-key`, `auth-token`… ou le
`://utilisateur:motdepasse@` d'une URL, et le séparateur l'espace, `=` ou `:`.
**Une valeur commençant par `-` compte comme une valeur.** L'échec nomme le
fichier et la ligne, sans jamais réimprimer la valeur.

Deux formes restent admises, et ce sont les bonnes : `${VAR}` ou `$(...)`,
injectés par l'infrastructure (`--requirepass ${REDIS_PASSWORD}`), et un
**chemin**, forme du secret monté en fichier (`--password-file /run/secrets/pw`).
Les faux positifs sont évités par la **frontière gauche** — le mot doit ouvrir la
ligne en clé YAML ou être collé à la ponctuation d'une option : `key` et `auth`
seuls ne déclenchent rien, et `--notify-keyspace-events Ex`,
`--tls-key-file /certs/k.pem`, `--auth-host=trust` passent.

## Ajouter une application

Deux commits, dans cet ordre : **construire d'abord, brancher ensuite.**

```bash
./init.sh --add ma-nouvelle-app --stack go --exposure private
# écris apps/ma-nouvelle-app/{Dockerfile,test.sh,PRODUCT.md,README.md,code}
./init.sh --check
git add apps/ma-nouvelle-app compose.yaml .github .gitignore .claude go.work
git commit                                    # commit 1 : la CI publie l'image

./init.sh --app ma-nouvelle-app --enable      # une fois l'image publiée
./init.sh --check
git add apps/ma-nouvelle-app/app.yml compose.yaml && git commit   # commit 2 : le déploiement
```

**Le commit 1 emporte les artefacts régénérés, pas seulement `apps/<nom>`** :
`--add` réécrit `compose.yaml`, le workflow et `.gitignore` ; s'il introduit un
langage ou un `ui: true` nouveau, `.claude/` ; et dès que le module Go existe,
`go.work`. N'ajouter que `apps/<nom>` fait échouer le job `contrat` en CI sur
« compose.yaml désynchronisé des manifestes », avant même la construction. Le
commit 2 ne touche que `app.yml` et `compose.yaml`.

Le chemin en un seul commit fonctionne aussi, mais la séquence en deux fait
arriver l'échec « l'image ne se construit pas » sur un commit qui, lui, **ne peut
pas** casser la stack des autres.

Si la nouvelle app introduit un langage absent du dépôt, recolle
`.claude/cloud-setup.sh` dans le champ *Setup script* de ton environnement.

## Les trois sortes de services — une seule est routée

`compose.yaml` porte trois sortes de services dans un espace de noms **plat**, et
une seule est joignable depuis Internet :

| Service | D'où il vient | Labels Traefik |
|---|---|---|
| `<app>` | `apps/<app>/app.yml` | **oui** : un routeur, l'URL `https://<app>.apps.billbob.ovh`, le middleware d'authentification, `priority=100` |
| `<app>-<nom>` | section `services:` du même `app.yml` | `traefik.enable=false`, **et lui seul** |
| `<nom>` | `shared_services` de `fabrique.yml` | `traefik.enable=false`, **et lui seul** |

**Ce qui expose un service à Internet, ce sont ses labels, pas le réseau.** Les
trois sortes vivent sur `apps_net`, se joignent par leur nom de service et ne
publient aucun port sur l'hôte.

**Mais l'absence de label ne retire rien du routage — c'est l'inverse de
l'intuition.** Traefik tourne par défaut avec `exposedByDefault` : un conteneur
**qui ne porte aucun label** obtient quand même un routeur, joignable et **sans
authentification**. Docker fusionne par ailleurs les labels gravés dans l'**image**
avec ceux du conteneur : une image tierce, ou compromise, portant un
`LABEL traefik.*` publierait un routeur que `compose.yaml` ne peut pas écraser,
puisqu'il porte un autre nom.

Un seul label **retire** réellement un service du routage, et `init.sh` le pose
**systématiquement** sur chaque annexe et chaque service partagé :

```yaml
    labels:
      - "traefik.enable=false"
```

Inoffensif si le serveur pose déjà `exposedByDefault: false`, indispensable sinon.
`./init.sh --check` en fait un KO bloquant **dans les deux sens** : un service non
routé qui ne le porte pas est refusé, et tout **autre** label `traefik.*` sur ce
service l'est aussi, puisqu'il publierait une URL qu'aucun middleware ne protège.

**L'espace de noms étant plat**, `<app>`, `<app>-<nom>` et `<nom>` se disputent les
mêmes noms. Une app nommée `redis` face à un `shared_services` nommé `redis` est un
doublon de clé YAML : légal, silencieux, la dernière gagne et la première disparaît
du déploiement sans un mot. `init.sh` refuse la collision au lieu de la générer.

### `shared_services` — un exemplaire pour toute la fabrique

Un service dont plusieurs apps ont besoin ne se duplique pas : il se déclare une
fois dans `fabrique.yml`, avec les mêmes sections `volumes:` et `env:` qu'une app.

```yaml
shared_services:
  - name: redis
    image: valkey/valkey:8-alpine
    memory: 128m
    command: --maxmemory 96mb --maxmemory-policy allkeys-lru
    volumes:
      - donnees:/data            # volume nommé « redis-donnees »
```

Son `image` est tirée telle quelle. Le garde-fou de CI inspecte **chaque** image du
compose, dédoublonnée, avant l'appel du webhook, et les traite **toutes pareil** :
une seule introuvable, fût-elle tierce, refuse le déploiement — `docker buildx
imagetools inspect` interroge le registre en **anonyme** faute d'identifiants, donc
une image tierce mal orthographiée est un fait constatable ici, pas un droit
manquant. La laisser passer ferait tomber **toutes** les apps, le `compose up`
étant atomique.

`fabrique.yml` étant commun, le modifier fait **reconstruire toutes les apps** au
prochain passage en CI : plus rien ne garantit alors que les images publiées
correspondent aux manifestes courants.

**Le budget mémoire compte les trois sortes.** `memory_budget` plafonne la somme de
tous les `mem_limit` : un worker à 64 Mo et un Redis à 128 Mo y pèsent autant qu'une
app, parce que l'OOM killer ne fait pas la différence et que tout démarre d'un coup.
`--check` affiche la somme, le nombre de services, et avertit au-delà.

## Les volumes nommés — ce qui survit au redéploiement

Le système de fichiers d'un conteneur est jeté à chaque déploiement : ce qui doit
persister se déclare dans `volumes:`, et **rien d'autre ne survit**. La forme est
`<nom>:<chemin conteneur>[:ro]` — nom logique à gauche conforme à
`^[a-z0-9][a-z0-9-]*$`, chemin absolu à droite, `:ro` seul suffixe admis.

`donnees:/var/lib/ramure` déclaré par `ramure` devient le volume
**`ramure-donnees`** : c'est le préfixe du propriétaire qui empêche deux apps de se
marcher dessus, et deux propriétaires produisant le même nom réel sont refusés.

**Un `/` à gauche est un bind mount, refusé à la génération.** Il faudrait créer le
chemin d'hôte à la main avant le premier déploiement, et Docker créerait un
répertoire absent **en root** — que l'app, non-root, n'écrirait jamais. Les volumes
nommés existent pour supprimer ce geste : `docker compose up` crée le volume au
premier démarrage et le conserve entre deux déploiements. **Aucune action sur
l'hôte, jamais, pour aucune app.**

**Le piège a déménagé dans ton `Dockerfile`.** Au premier montage, Docker recopie
dans le volume vide le contenu du répertoire **tel qu'il existe dans l'image**,
propriétaire compris : répertoire absent de l'image, ou appartenant à root, et le
volume appartient à root — ton app non-root ne peut pas y écrire. Le symptôme est
« l'app démarre et perd tout », jamais un message clair. La parade tient en une
ligne, **avant** `USER` :

```dockerfile
RUN mkdir -p /var/lib/ramure && chown 10001:10001 /var/lib/ramure
USER 10001:10001
```

`./init.sh --check` relit ton `Dockerfile` et **avertit** — sans bloquer, un `chown`
prenant des formes qu'un grep ne voit pas — quand un chemin monté n'y est jamais
donné à personne. C'est le dernier moment où le piège se rattrape avant la
production. L'avertissement couvre les volumes de l'app **plus** ceux de ses annexes
bâties sur l'image de l'app (`ghcr.io/<org>/<dépôt>/<app>:*`) ; restent hors de
portée, faute de `Dockerfile` ici, une annexe sur image **tierce** et les volumes
des `shared_services`.

**`name:` — pourquoi le compose porte deux fois le même nom.** Compose préfixe par
défaut les volumes de premier niveau par le nom du projet : le volume réel
s'appellerait `<projet>_ramure-donnees`, et la commande de sauvegarde ci-dessous,
montant le nom court, le ferait **créer vide** par Docker — `tar` archiverait un
répertoire vide et **sortirait en 0**, l'illusion parfaite d'une sauvegarde.
`init.sh` émet donc `name: <nom>` sous chaque entrée, et `--check` refuse un bloc où
il manque. Corollaire : le nom devient **global à l'hôte** ; le préfixe par nom
d'app rend une collision avec une autre stack improbable, pas impossible.

**Sauvegarder, effacer, borner.** Un volume nommé ne s'ouvre pas avec un `cat` : son
contenu passe par un conteneur jetable, lancé côté serveur.

```bash
docker run --rm -v ramure-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/ramure-donnees.tgz -C /d .
```

**Le disque du serveur est à 92 %**, et un volume n'a aucune borne : il grossit
jusqu'à ce que la stack entière n'ait plus de place. Un volume de cache doit donc
être **borné par ton code et jetable** — ce que ton app ne sait pas reconstruire n'a
rien à y faire. Et la séparation entre ce qui se sauvegarde et ce qui s'efface doit
se lire **dans les noms** : `donnees` se sauvegarde, `cache` se supprime. Celui qui
fait de la place à trois heures du matin n'aura que ces noms pour décider, et
`docker volume rm` est irréversible.

Le reste est vérifié pour toi, à la génération comme au `--check` : le même nom deux
fois dans une liste, ou deux volumes sur le même chemin conteneur — le second
masquerait le premier — sont refusés ; le bloc `volumes:` de premier niveau doit
déclarer **exactement** les volumes montés, chacun avec son `name:`. Un montage
absent de ce bloc n'est **pas** réinterprété en bind mount : Compose refuse le projet
entier, avant qu'un seul conteneur ne démarre. Une app désactivée ne contribue aucun
volume, puisqu'aucun de ses services n'est émis.

## Comment on travaille : branche, puis commits par étapes

**Jamais de modification directe sur `main`.** Une branche s'ouvre dès la
**première** modification, nommée `<app>/<sujet>` — ou `fabrique/<sujet>` pour ce qui
touche `init.sh`, `fabrique.yml`, la CI, le contrat ou l'outillage. Le préfixe dit
quel rayon de souffle est en jeu, avant même d'ouvrir le diff.

```bash
./init.sh --branche cadran/fuseaux-multiples
./init.sh --branche fabrique/garde-fous-git
```

Le nom est validé avant la création : préfixe connu, sujet en minuscules. La branche
part de `origin/main`, jamais du HEAD courant — greffée sur une autre branche de
travail, elle traînerait ses commits dans sa PR.

**Une exception, subie et non choisie : `claude/<sujet>`.** Le harnais cloud assigne
lui-même le nom de la branche et interdit de pousser ailleurs. Ce préfixe est donc
accepté pour **rejoindre** une branche existante — sans quoi une session cloud ne
pourrait pas ouvrir son entrée de journal — mais refusé pour en **créer** une. Il ne
dit rien du périmètre : sur une telle branche, le rayon de souffle se lit dans le
champ `Périmètre` de l'entrée de journal, et nulle part ailleurs. Renseigne-le tôt.

**Un commit par étape vérifiée**, pas un commit au kilomètre. Avant chaque commit :

```bash
./init.sh --pret     # branche dédiée ? contrat vert ? tests des apps touchées verts ?
```

`--pret` ne relance que les apps réellement modifiées depuis la base. Chaque commit
est ainsi relisable seul et ne casse rien. On pousse à chaque commit ; **la pull
request vient à la fin**, une fois l'ensemble cohérent.

### La fin de vie d'une branche ne t'appartient pas

**Une session cloud ouvre des branches et ne peut pas en fermer.** Le relais git du
harnais refuse la suppression de refs — `HTTP 403` sur `git-receive-pack`, puis `git`
affiche `Everything up-to-date`, qui ressemble à un succès. Le serveur MCP GitHub
expose `create_branch` sans son inverse. Les branches fusionnées s'accumulent donc,
et rien ne le signale.

```bash
./init.sh --branches-fusionnees    # dit quoi supprimer, ne supprime rien
```

Le critère est l'**équivalence de patch**, pas l'appartenance à l'ascendance de
`main` : cette dernière se trompe dans les deux sens — elle classe « non fusionnée »
une branche écrasée en un commit, et ne dit rien d'une branche dont la PR est
fusionnée mais qui porte des commits écrits **après**. Sa limite est dans le nom de
sa seconde section, `à regarder` : un patch inédit ne prouve pas un travail perdu —
un contenu repris ailleurs ou refait à la main produit un patch différent. Compare
avant de conclure.

### Deux garde-fous, parce qu'une règle écrite s'oublie

| Hook | Ce qu'il fait |
|---|---|
| `.claude/garde-branche.sh` (`PreToolUse`) | refuse toute édition tant que HEAD est sur `main`, et donne la commande exacte |
| `.claude/garde-commit.sh` (`Stop`) | refuse de terminer sur un arbre de travail sale |

Générés par `init.sh` comme le reste de `.claude/`, et `--check` refuse qu'ils
divergent de leur générateur. Aucun ne dépend de `jq` ni de `python` : un garde-fou
qui ne démarre pas sur une machine dépouillée ne garde rien. Le garde-fou de branche
n'ouvre pas la branche à ta place : seul celui qui édite connaît le sujet.

### Le journal des anomalies

**Une branche, une entrée dans `journal/`.** Elle s'ouvre avec la branche —
`./init.sh --branche` la crée préremplie — et se remplit **au fil du travail**, pas à
la fin : écrite à chaud elle retient les anomalies mineures, reconstituée elle ne
garde que les spectaculaires. Or ce sont les mineures qui disent où le contrat a un
trou. Le nom du fichier vient de la branche : `fabrique/garde-fous-git` →
`journal/2026-08-03-fabrique-garde-fous-git.md`.

Ce journal enregistre les **anomalies**, pas le déroulé : ce qui a surpris, cassé ou
s'est révélé faux — y compris tes propres erreurs de raisonnement, les plus utiles et
les plus faciles à taire. Ce que le changement fait va dans le message de commit ; ce
qu'il a coûté d'apprendre va ici.

Chaque anomalie porte quatre champs. `Symptôme` et `Cause` sont en prose libre. Les
deux autres ont un **vocabulaire fermé**, et `--check` le vérifie :

```
**Detecte par** — `utilisateur`
**Action** — `garde-fou` — pourquoi, en une ligne.
```

| `Detecte par` | qui a rattrapé, du moins cher au plus cher |
|---|---|
| `compilateur` | immédiat, coût nul |
| `test` | avant même de lancer |
| `CI` | avant la fusion |
| `relecture` | humaine ou outillée, avant livraison |
| `auteur` | en cours de travail, après coup |
| `utilisateur` | après livraison : un aller-retour, et un garde-fou manquant |
| `production` | après déploiement |

| `Action` | ce que l'anomalie devrait changer |
|---|---|
| `rien` | réparée, rien à en tirer |
| `contrat` | ce fichier dit quelque chose de faux, ou ne dit rien |
| `garde-fou` | `--check`, `--pret` ou un hook devrait le voir |
| `outillage` | un plugin, un LSP, un agent manque |
| `comportement` | façon de travailler, aucun artefact à changer |
| `arbitrage` | demande une décision humaine, pas un correctif |

**Le vocabulaire est fermé parce que le lecteur peut être un agent** : en prose libre,
« moi », « la critique impeccable » et « le compilateur » ne s'agrègent pas, et la
distribution que ce journal promet n'est plus calculable. `Detecte par` est **ordonné
par coût croissant**, et c'est ce qui le rentabilise : l'agrégat utile n'est pas le
nombre d'anomalies mais **jusqu'où la distribution glisse vers la droite** — une masse
sur `utilisateur` et `production` dit que les garde-fous laissent passer, une masse
sur `compilateur`, `test` et `CI` dit qu'ils tiennent, quel qu'en soit le nombre.

**L'en-tête porte deux champs, vérifiés eux aussi :**

```
Périmètre : fabrique
Mode : `chaud`
```

`Périmètre` — les apps touchées, ou `fabrique` ; le laisser au gabarit fait échouer
`--check`. `Mode` — vocabulaire fermé : `chaud` (valeur du gabarit et cas normal,
puisque `--branche` ouvre l'entrée en même temps que la branche) ou `retrospective`,
qui dit qu'elle a été reconstituée après coup. L'`analyste` lit une entrée
rétrospective mais s'interdit d'en tirer une mesure — encore faut-il qu'il puisse la
trouver, ce qu'un champ vérifié garantit là où une phrase en prose ne le faisait pas.

Deux vérifications tiennent l'ensemble, dans l'ordre de dureté :

- `./init.sh --pret` **refuse** l'étape si la branche n'a pas d'entrée, si elle est
  encore le gabarit nu, ou si son en-tête est incomplet ;
- `./init.sh --check`, donc la CI, refuse un gabarit nu ou un en-tête incomplet
  **committé**. Une entrée non suivie par git est un travail en cours et ne se juge
  pas — c'est ce qui laisse `--check` vert entre l'ouverture de la branche et le
  premier commit.

Une session sans anomalie écrit « Aucune anomalie » et retire le marqueur : une
entrée vide et une entrée jamais ouverte ne disent pas la même chose.

### Les agents `analyste` et `greffier`

```
Agent(subagent_type: "analyste")   # lit le journal, rend un plan
Agent(subagent_type: "greffier")   # branche, vérifie, committe et pousse
```

Tous deux sont restreints à `Bash`, `Read` et `Grep`, et **lançables en tâche de
fond**. **L'absence d'outil d'édition n'est pas un détail de configuration** : c'est
ce qui garantit qu'un agent lancé en fond ne peut pas modifier le dépôt pendant que
tu travailles dessus.

L'`analyste` agrège les deux champs fermés, cherche les causes qui reviennent d'une
branche à l'autre, et rend **dans sa réponse** un plan de trois à six actions
groupées par `Action` — les `arbitrage` listés à part, tels quels : ce sont des
questions pour toi. Deux consignes le tiennent au réel : ne pas compter une entrée
rétrospective comme une mesure fiable, et ne pas proposer de garde-fou pour une
anomalie déjà rattrapée par le compilateur ou par un test.

Le `greffier` s'arrête et rapporte si `./init.sh --pret` échoue — réparer n'est pas
son rôle. Il ne réécrit jamais l'histoire (`--force`, `--amend`, `rebase`,
`reset --hard`, `merge` lui sont interdits) et n'ouvre pas de pull request. Il ne peut
pas non plus remplir le journal, et c'est délibéré : seul celui qui a fait le travail
connaît les anomalies rencontrées.

**Le registre des agents est lu au démarrage de la session** : un agent ajouté en
cours de session n'est invocable qu'à la suivante — même piège que les plugins.

### La pull request se lit en trente secondes

Un corps de PR n'est pas un compte rendu : il sert à décider **s'il faut relire, et
par où commencer**. Une phrase sur ce que fait le changement, trois à cinq puces sur
ce qui compte, ce qui a été vérifié en chiffres, les points d'attention avant fusion.
`.github/pull_request_template.md`, généré, en donne la forme — remplis ses sections,
ne les invente pas.

Le raisonnement détaillé va dans les **messages de commit**, où il reste attaché au
changement qu'il explique et survit à la fusion. Quatre commits bien décrits valent
mieux qu'un long corps de PR que personne ne relira.

## Le rayon de souffle

Une seule stack, donc un seul `docker compose up`, atomique : une erreur dans le bloc
d'une app fait échouer le déploiement de **toutes** les autres, y compris celles que
tu n'as pas touchées. C'est la raison d'être des trois garde-fous décrits plus haut —
`enabled`, l'inspection des images en CI, et le `--check` service par service — et la
raison pour laquelle aucun ne se contourne.

## Ton outillage — les plugins Claude Code

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone du dépôt — toi,
un autre agent, une session cloud, la CI — repart avec le même outillage.

| Plugin | Ce qu'il apporte |
|---|---|
| `superpowers` | Méthode de travail : brainstorming avant de coder, TDD, débogage systématique, rédaction de plans |
| `mattpocock-skills` | TDD, revue de code, modélisation du domaine, diagnostic de bogues |
| `code-review` / `code-simplifier` | Revue et simplification du code déjà écrit |
| `commit-commands` | Commit, push, ouverture de PR |
| `security-guidance` | Relit chaque modification à la recherche de vulnérabilités |
| `context7` | Documentation **à jour** des bibliothèques — consulte-le plutôt que ta mémoire |
| `github` | PR, Actions, GHCR |

S'y ajoutent, selon les `apps/*/app.yml` : **un serveur LSP par langage présent dans
la fabrique** — les erreurs du compilateur après chaque édition, pour zéro contexte —
et, dès qu'**une seule** app porte `ui: true`, `frontend-design`, `playwright` et
`impeccable`.

**Déclarer un plugin ne l'installe pas**, et aucun script du dépôt ne peut s'en
charger : sur `claude.ai/code`, Claude Code **charge les plugins avant de les
installer**, donc un hook `SessionStart` les déposerait sur le disque sans qu'ils
servent — et `/reload-plugins` n'existe pas sur le web. Le seul point d'accroche assez
tôt est le **setup script de l'environnement**, qui tourne avant le lancement de
Claude Code. `init.sh` en génère le contenu : les plugins, plus **le binaire de chaque
serveur LSP** — l'image cloud fournit les compilateurs, jamais les serveurs de
langage, et sans ce binaire le plugin est installé mais inerte. Les installations
partent en parallèle : le script doit tenir sous cinq minutes.

```bash
cat .claude/cloud-setup.sh     # à coller dans le champ "Setup script"
```

Sur `claude.ai/code` : icône nuage au-dessus de la zone de saisie → engrenage de
l'environnement → champ **Setup script**. Le résultat est figé dans un instantané du
disque : le script ne rejoue qu'après modification de l'environnement ou expiration du
cache (~7 jours). Si le serveur de langage ne s'installe pas en une commande à travers
l'allowlist réseau, le script généré pose un `TODO` explicite plutôt qu'une commande
inventée : complète-le avant de le coller. Cette configuration vit **hors du dépôt**,
dans ton compte, et `init.sh` ne peut pas la mettre à jour : après un `./init.sh` qui
change un `stack` ou un `ui`, recolle le fichier — `--check` signale l'écart.

Puisqu'aucun hook ne peut installer à temps, `.claude/check-plugins.sh` se contente de
rapporter : il s'exécute à chaque ouverture de session et écrit dans ton contexte
`Outillage : 12/12 plugins installes, 1/1 serveurs LSP presents.` — une ligne quand
tout va bien, sinon la liste des manquants et le geste qui répare. Il vérifie deux
choses qui peuvent diverger : le plugin dans le cache local, et le **binaire** de
chaque LSP sur la machine. Un rapport qui annonce des manquants signifie que le setup
script est absent, périmé, ou n'a pas encore rejoué.

`.claude/settings.local.json` est ignoré par git : c'est là que vont tes préférences
personnelles. Et **jamais de bloc `env` dans `.claude/settings.json`** — il est public
par construction, y poser un jeton le publie ; `--check` refuse un settings qui en
contient un.

## Les trois paliers d'exposition

Qui peut atteindre une application est décidé par `exposure` dans son `app.yml`, et
appliqué par Traefik avant que la requête ne parvienne au conteneur. Le choix se fait
app par app.

| `exposure` | Middleware Traefik | Qui entre | Quand l'utiliser |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |
| `public` | `public` | **Tout le monde, sans authentification** | Une app destinée à des gens qui n'ont pas de compte, dont rien de sensible ne vit côté serveur |

Ne confonds pas `forwardauth-open` et `public` : le premier exige un compte Google, le
second n'exige rien.

En `private` et `google`, l'identité de l'utilisateur arrive dans l'en-tête
**`X-Forwarded-User`** (son adresse e-mail). Traefik le **réécrit à chaque requête**,
il n'est donc pas usurpable.

**Ne code pas de système de comptes.** Pour cloisonner des données par utilisateur,
`X-Forwarded-User` est la **seule** source d'identité admissible — jamais un
identifiant fourni par le client (URL, corps de requête, cookie applicatif). En palier
`google`, ce cloisonnement n'est pas optionnel : n'importe qui peut se connecter.

**Ce que `public` implique — à lire avant de le choisir.** Aucune authentification
n'a lieu, **donc Traefik ne pose ni n'écrase `X-Forwarded-User`** : l'en-tête devient
entièrement contrôlé par le client, et une app qui le lirait croirait identifier un
utilisateur sur une valeur forgée. `--check` **refuse** une app qui lit
`X-Forwarded-User` en `exposure: public`. Quatre contraintes non négociables en
découlent :

- **Pas d'état par utilisateur côté serveur** — ni compte, ni session, ni données
  nominatives. Ce qui est propre à un visiteur reste sur son appareil
  (`localStorage`, `IndexedDB`).
- **Rien de sensible ne transite** — clés d'API tierces comprises. Tout ce que le
  navigateur reçoit est, par construction, public.
- **Le rate-limit n'est pas une protection** — le palier en pose un (50 req/s par IP,
  rafale 100), mais l'app doit encaisser du trafic non sollicité.
- **L'URL finira par être trouvée.** Ne compte jamais sur le fait qu'elle n'est pas
  publiée.

Une app publique voisine d'apps privées ne les expose pas : chaque routeur porte son
propre middleware, et `--check` le vérifie service par service. Si tu hésites entre
deux paliers, prends le plus fermé : `private` se desserre en une ligne, l'inverse a
déjà exposé les données.

## Règles impératives

- **Un `Dockerfile` par app, dans `apps/<nom>/`**, construction multi-étapes, image
  finale **< 200 Mo** — le disque du serveur est à 92 %. Le contexte de construction
  est `apps/<nom>`, pas la racine : c'est ce qui empêche une édition dans une app
  d'invalider le cache des autres.
- **L'app tourne en utilisateur non root** (`USER` dans le `Dockerfile`).
- **Ne publie aucun port.** Pas de section `ports:`. Traefik joint le conteneur par
  `apps_net` ; deux apps peuvent écouter sur le même port, rien n'est publié sur
  l'hôte.
- **Le fichier Compose s'appelle `compose.yaml`**, à la racine : c'est le seul nom que
  `dockhand` ouvre côté serveur — un `docker-compose.yml` lui renvoie « Compose file
  not found ». Il est **généré**, ne l'édite jamais à la main.
- **Le routage vit dans les labels du `compose.yaml`**, générés. N'y touche pas : le
  middleware du palier et `priority=100` y sont posés — cette priorité empêche un
  serveur catch-all de capter l'URL et de servir un 404 silencieux.
- **Chaque app déclare ses tests dans `apps/<nom>/test.sh`**, exécutable. La CI ne
  lance que ce fichier ; la fabrique n'a pas à connaître ton langage.
- **Aucun `LABEL traefik.*` dans l'image**, sans exception — ni écrit dans le
  `Dockerfile`, ni **hérité de l'image de base**. Un label de routage gravé dans
  l'image publie un routeur **supplémentaire**, que le compose ne peut pas écraser
  puisqu'il porte un autre nom — donc **sans authentification**. `--check` lit le
  `Dockerfile`, où un label hérité n'apparaît pas ; la CI inspecte donc en plus
  l'**image construite** et refuse la construction. Si l'image de base en porte un, il
  faut en changer.
- **Aucun secret** dans le dépôt ni dans l'image : déclare les noms attendus dans
  `env:` et dans le `README`, jamais les valeurs.
- **Ce qui doit survivre au redéploiement vit dans un volume nommé**, et le
  `Dockerfile` `chown` son chemin avant `USER`.
- **Écris les logs sur la sortie standard**, pas dans un fichier.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Ce qui ne t'appartient pas

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
pose pas app par app, le [`README`](README.md) le documente, n'écris pas de demande
pour lui.

Quand tu travailles sur une app, **les fichiers des autres apps ne t'appartiennent pas
non plus**, ni les artefacts générés : `compose.yaml`, `.github/`, `.claude/`,
`go.work`. Tu changes `apps/<nom>/app.yml` — ou `fabrique.yml` si c'est un service
partagé, en sachant qu'il est commun à toutes les apps — et tu relances `./init.sh`.

## Avant de pousser

```bash
./init.sh --check
```

Il commence par les **manifestes** — `volumes:`, `env:`, `needs:`, `command:`, noms de
service —, parce qu'un `app.yml` faux ne produirait qu'un « compose désynchronisé »
dont le vrai motif serait perdu ; puis il compare chaque artefact dérivé à ce
qu'`init.sh` écrirait aujourd'hui ; puis il relit le compose **service par service**,
les trois sortes, et vérifie que le bloc `volumes:` déclare exactement les volumes
montés, chacun avec son `name:`. Les avertissements — un `chown` introuvable, une clé
inconnue ignorée, un budget mémoire dépassé — ne bloquent pas ; les KO, si.

Le même contrôle tourne en CI, en verrou de tous les autres jobs : avec une stack
partagée, un compose faux fusionné casserait toutes les apps à la fois.

Le déploiement se déclenche à chaque fusion sur `main` : seules les apps modifiées sont
reconstruites et publiées sur GHCR, puis un unique appel de webhook fait récupérer la
stack entière par le serveur. Compte deux à trois minutes entre la fusion et la mise
en ligne.
