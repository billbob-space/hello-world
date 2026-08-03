# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : il héberge plusieurs applications, chacune avec
son code, son PRD, son URL et son palier d'authentification, toutes déployées
ensemble dans **une seule stack dockhand**. Les règles ci-dessous sont imposées
par l'infrastructure : les enfreindre ne provoque pas une erreur claire, mais un
déploiement qui échoue en silence.

**Le nom d'une application est celui de son répertoire sous `apps/`.** C'est lui
qui devient le sous-domaine, le nom de conteneur et le nom de routeur Traefik ;
il doit donc être un label DNS valide. L'organisation, le dépôt et le domaine
sont dans `fabrique.yml`.

## Arborescence

```
apps/<nom>/          une application. `--add` y écrit app.yml, .dockerignore,
                     test.sh, README.md, PRODUCT.md ; le Dockerfile et le code
                     sont à toi
compose.yaml         GÉNÉRÉ — la stack entière : les trois sortes de services, et —
                     seulement si au moins un service monte un volume — le bloc
                     volumes: qui les déclare
fabrique.yml         valeurs communes : org, dépôt, registre, domaine, réseau, plafonds,
                     et shared_services — les services partagés par plusieurs apps
init.sh              le générateur
```

Ce qui est **partagé** : la stack, la CI, le réseau, le domaine, les services de
`shared_services`, l'outillage Claude Code. Ce qui **appartient à chaque app** :
son code, son `Dockerfile`, son PRD, son URL, son palier d'authentification, ses
volumes, ses services annexes, ses tests.

## Démarrage

```bash
./init.sh                 # régénère compose.yaml, la CI et l'outillage
./init.sh --check         # vérifie les manifestes, puis le dépôt service par service
./init.sh --list          # état des applications
./init.sh --add <nom>     # échafaude apps/<nom>/
./init.sh --dry-run       # montre ce qui changerait, sans rien écrire
```

`--dry-run` n'écrit **rien**, y compris l'`app.yml` qu'un `--app <nom> --enable`
modifierait : il affiche l'ancienne et la nouvelle valeur, puis le diff des
artefacts tels qu'ils seraient avec elle.

`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient, app par app.

Les artefacts dérivés — `compose.yaml`, le workflow, `.claude/`, `go.work` —
sont **toujours réécrits**. C'est ce qui garantit qu'une app ajoutée ne peut pas
manquer du déploiement.

## `apps/<nom>/app.yml` — les valeurs que tu décides

Un fichier par application. **`init.sh` ne le réécrit jamais** : il est la
source de vérité, tu l'édites à la main.

```yaml
enabled: true              # false = dans le dépôt, mais hors du compose
port: 8080                 # port d'écoute dans le conteneur, HTTP en clair
memory: 128m               # limite mémoire du conteneur
health_path: /healthz      # chemin HTTP renvoyant 200 quand l'app est prête
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private          # private | google — voir plus bas
stack: none                # langage principal — active son serveur LSP
ui: false                  # true si l'app sert une interface web
```

Édite-le puis relance `./init.sh`, ou passe les valeurs en options — elles ne
valent alors que pour l'app ciblée :

```bash
./init.sh --app mon-app --port 3000 --health /health \
          --health-cmd 'curl -fsS http://localhost:3000/health' \
          --exposure google
```

**`enabled: false` n'est pas un brouillon, c'est une protection.** La stack est
unique : référencer une image qui n'existe pas encore ferait échouer le
`compose up` de **toutes** les apps. Une app neuve naît donc désactivée, et
n'entre dans le compose qu'une fois sa première image publiée.

**`health_cmd` est le piège le plus fréquent.** Il s'exécute *dans* ton
conteneur : l'outil qu'il appelle doit exister dans l'image finale. `wget` est
présent dans les images Alpine et BusyBox, `curl` rarement sans installation.
Une image `scratch` ou `distroless` n'a **aucun shell** : mets alors
`health_cmd: none`. Un healthcheck qui échoue rend le conteneur malsain en
permanence, sans que l'app soit en cause.

**`stack` et `ui` ne changent rien au déploiement.** Ils déterminent l'outillage
décrit plus bas. Renseigne-les dès que tu as choisi ta technologie, puis relance
`./init.sh`. `.claude/settings.json` étant un réglage **de projet**, l'outillage
est l'**union** de ce que demandent toutes les apps du dépôt — y compris les
apps désactivées, dont il faut bien pouvoir écrire le code.

### Quatre sections optionnelles : `volumes:`, `env:`, `needs:`, `services:`

Elles n'ont **aucun équivalent en ligne de commande** : elles s'écrivent à la
main dans `app.yml`. Une app qui n'en porte aucune produit exactement le bloc
compose d'avant leur existence — les déclarer n'est jamais un passage obligé,
c'est une demande explicite.

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

Le lecteur YAML d'`init.sh` est volontairement minimal — listes en ligne
`[a, b]` ou en bloc `- a`, et des listes de mappings dont chaque élément peut
porter une liste, mais pas un niveau de plus ; ni ancre, ni bloc multi-lignes :
un parseur général serait ici une source de bogues muets. La contrepartie est
qu'une **clé mal orthographiée n'est pas une erreur, elle est ignorée**. Dans une
entrée `services:` ou `shared_services:`, `init.sh` l'**avertit** — `[ramure]
services 'worker' : cle inconnue 'labels' ignoree` — parce que le piège y est
double : écrire `labels: [traefik.enable=false]` à la main donne le sentiment
d'avoir durci un service sans qu'une ligne du compose bouge. L'avertissement ne
bloque pas : après avoir édité une de ces sections, relance `./init.sh` et relis
ton bloc dans `compose.yaml` — c'est le seul endroit qui dise ce qui a vraiment
été lu.

**`env:` ne porte que des noms.** Un élément contenant un `=` est refusé à la
génération, qui n'écrit alors aucun artefact : le dépôt est public, et un secret
y entrerait par cette porte pour toujours. Le nom lui-même doit correspondre à
`^[A-Z][A-Z0-9_]*$` — majuscules, chiffres et tirets bas, une lettre en tête :
`lastfm_key` est refusé au même titre qu'un `=`, et le message le dit. `init.sh`
émet `- NOM=${NOM:-}`, dont
la valeur vient de l'environnement du serveur. Le défaut vide est délibéré — un
nom non défini côté serveur ferait sinon échouer le `compose up` de la stack
entière —, mais il se paie : ta variable arrive **vide** au lieu de manquer, et
c'est à ton app de traiter la chaîne vide comme une absence plutôt que de partir
avec une clé d'API vide. Les noms attendus se déclarent aussi dans ton `README`.

**`needs:` est vérifié à la génération.** Un nom qui ne correspond à aucun
`shared_services` de `fabrique.yml` fait échouer `./init.sh` en listant les
services déclarés : le partage oublié devient une erreur de génération, pas un
`depends_on` pointant dans le vide ni une panne au démarrage. Ce que `depends_on`
garantit s'arrête au **démarrage** du conteneur voisin, pas à sa disponibilité :
ton app doit survivre à un `redis` qui n'accepte pas encore de connexion.

**`services:` — des annexes privées de l'app.** `name` et `image` sont
obligatoires : une annexe n'est pas construite pour elle-même par la CI, son
image doit exister quelque part — le plus souvent celle de l'app,
`.../<app>:main`, lancée avec une `command` différente. `memory` vaut `128m` par
défaut, `command` est découpée sur les espaces et émise en forme exec, `volumes:`
et `env:` obéissent aux mêmes règles que ci-dessus. Une annexe devient le service
`<app>-<name>` — et **ses volumes appartiennent à l'app, pas à elle** :
`donnees:/var/lib/ramure` dans le worker monte le même `ramure-donnees` que
l'app. C'est ainsi qu'un worker partage les données de son service principal, et
c'est la raison d'être du préfixe.

**`command:` n'est pas une porte dérobée vers les secrets.** Elle est validée
comme `env:`, ici comme dans `shared_services`. Tout jeton dont la clé évoque un
secret — `requirepass`, `password`, `passwd`, `secret`, `token`, `api-key`,
`auth`, `key` — et qui porte une **valeur littérale** fait échouer la génération,
sous les trois formes `--clé valeur`, `--clé=valeur` et `CLÉ=valeur`. Sans ce
contrôle, `command: --requirepass p4ssw0rd` écrivait la valeur en clair dans
`fabrique.yml` **et** dans `compose.yaml`, deux fichiers suivis par git — par la
porte même que `env:` ferme. Les formes sans valeur littérale restent admises,
`--maxmemory 96mb` comme `--requirepass ${REDIS_PASSWORD}` : un secret passe par
`env:` et par l'environnement du serveur, jamais par une valeur écrite ici.

## Ajouter une application

Deux commits, dans cet ordre : **construire d'abord, brancher ensuite.**

```bash
./init.sh --add ma-nouvelle-app --stack go --exposure private
# écris apps/ma-nouvelle-app/{Dockerfile,test.sh,PRODUCT.md,README.md,code}
./init.sh --check
git add apps/ma-nouvelle-app && git commit    # commit 1 : la CI publie l'image

./init.sh --app ma-nouvelle-app --enable      # une fois l'image publiée
./init.sh --check
git add apps/ma-nouvelle-app/app.yml compose.yaml && git commit   # commit 2 : le déploiement
```

Le chemin en un seul commit fonctionne aussi — la construction précède le
garde-fou dans la même exécution — mais la séquence en deux commits fait
arriver l'échec « l'image ne se construit pas » sur un commit qui, lui, **ne
peut pas** casser la stack des autres.

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
trois sortes vivent sur `apps_net`, se joignent entre elles par leur nom de
service et ne publient aucun port sur l'hôte.

**Mais l'absence de label ne retire rien du routage — c'est l'inverse de
l'intuition, et ça se vérifie.** Traefik tourne par défaut avec
`exposedByDefault`, et il crée alors un routeur pour un conteneur **qui ne porte
aucun label** : un `nginx` sans le moindre label posé sur `apps_net` apparaît
dans l'API Traefik en `vr-redis@docker | Host(vr-redis) | middlewares None` —
donc joignable, et **sans authentification**. Docker fusionne par ailleurs les
labels gravés dans l'**image** avec ceux du conteneur : une image tierce, ou
compromise, portant un `LABEL traefik.*` publierait un routeur que `compose.yaml`
ne peut pas écraser, puisqu'il porte un autre nom. C'est exactement le mécanisme
qui fait interdire tout `LABEL traefik.*` dans un `Dockerfile` — sauf que
l'image d'une annexe ou d'un service partagé, elle, ne vient pas de toi.

Un seul label **retire** réellement un service du routage, et `init.sh` le pose
**systématiquement** sur chaque annexe et chaque service partagé :

```yaml
    labels:
      - "traefik.enable=false"
```

Il est inoffensif si le serveur pose déjà `exposedByDefault: false`, et
indispensable sinon. `./init.sh --check` en fait donc un KO bloquant **dans les
deux sens** : un service non routé qui ne le porte pas est refusé — au même titre
qu'une app sans authentification conforme —, et tout **autre** label `traefik.*`
sur ce même service l'est aussi, puisqu'il publierait une URL qu'aucun middleware
ne protège.

L'espace de noms étant plat, `<app>`, `<app>-<nom>` et `<nom>` se disputent les
mêmes noms de service et de conteneur. Une app nommée `redis` face à un
`shared_services` nommé `redis` est un doublon de clé YAML : légal, silencieux,
la dernière gagne et la première disparaît du déploiement sans un mot. `init.sh`
refuse donc la collision au lieu de la générer.

### `shared_services` — un exemplaire pour toute la fabrique

Un service dont plusieurs apps ont besoin ne se duplique pas : il se déclare une
fois dans `fabrique.yml`, avec les mêmes sections `volumes:` et `env:` qu'une
app.

```yaml
shared_services:
  - name: redis
    image: valkey/valkey:8-alpine
    memory: 128m
    command: --maxmemory 96mb --maxmemory-policy allkeys-lru
    volumes:
      - donnees:/data            # volume nommé « redis-donnees »
```

Son `image` est tirée telle quelle : la CI ne construit que les `apps/<nom>/`. Le
garde-fou de CI inspecte **chaque** image du compose, dédoublonnée, avant l'appel
du webhook — mais il ne les traite pas toutes pareil. Une image **de la fabrique**
introuvable est bloquante : le job vient de la publier et s'est authentifié sur le
registre, son absence est un fait. Une image **tierce** introuvable ne l'est pas :
ce job ne s'authentifie que sur `ghcr.io`, une inspection qui échoue n'y prouve
donc rien de plus qu'un droit manquant. Elle produit un `::warning::` et le
déploiement continue. En revanche
`fabrique.yml` est commun : le modifier fait **reconstruire toutes les apps** au
prochain passage en CI, puisque plus rien ne garantit que les images publiées
correspondent aux manifestes courants.

**Le budget mémoire compte les trois sortes.** `memory_budget` plafonne la somme
de tous les `mem_limit` : un worker à 64 Mo et un Redis à 128 Mo y pèsent autant
qu'une app, parce que l'OOM killer ne fait pas la différence et que tout démarre
d'un coup. `./init.sh --check` affiche la somme, le nombre de services et
avertit au-delà du plafond.

## Les volumes nommés — ce qui survit au redéploiement

Le système de fichiers d'un conteneur est jeté à chaque déploiement : ce qui doit
persister se déclare dans `volumes:`, et rien d'autre ne survit. La forme est
`<nom>:<chemin conteneur>[:ro]` — le nom logique à gauche doit correspondre à
`^[a-z0-9][a-z0-9-]*$`, le chemin à droite être absolu, `:ro` est le seul suffixe
admis. `donnees:/var/lib/ramure` déclaré par `ramure` devient le volume
**`ramure-donnees`** : c'est le préfixe du propriétaire qui empêche deux apps de
se marcher dessus, et deux propriétaires qui produiraient le même nom réel sont
refusés. Un `/` à gauche est un bind mount, et il est refusé à la génération.

**Ce que tu y gagnes : zéro action sur l'hôte, jamais, pour aucune app.**
`docker compose up` crée le volume au premier démarrage et le conserve entre deux
déploiements. Pas de `mkdir` sur le serveur avant une première mise en ligne, pas
de `chown` manuel, pas de chemin d'hôte à valider — donc pas de premier
déploiement qui échoue parce que personne n'a préparé le répertoire. C'est
exactement ce que coûtait un bind mount : quand le répertoire source n'existe
pas, Docker le crée **en root**, l'app tourne en non-root, elle n'y écrit jamais.

**Le piège n'a pas disparu pour autant : il a déménagé dans ton `Dockerfile`.**
Au premier montage, Docker recopie dans le volume vide le contenu du répertoire
**tel qu'il existe dans l'image**, propriétaire compris — c'est donc l'image qui
décide à qui appartient le volume. Répertoire absent de l'image, ou appartenant à
root : le volume appartient à root, et ton app non-root ne peut pas y écrire. Le
symptôme est « l'app démarre et perd tout » — jamais un message clair, juste des
données qui ne s'écrivent pas. La parade tient en une ligne, **avant** `USER` :

```dockerfile
RUN mkdir -p /var/lib/ramure && chown 10001:10001 /var/lib/ramure
USER 10001:10001
```

`./init.sh --check` relit ton `Dockerfile` et **avertit** — sans bloquer, un
`chown` prenant des formes qu'un grep ne voit pas — quand un chemin monté n'y est
jamais donné à personne. C'est le dernier moment où le piège se rattrape avant la
production.

Ce que cet avertissement couvre exactement : les volumes de l'app, **plus** ceux
de ses services annexes dont l'`image` est celle de l'app
(`ghcr.io/<org>/<dépôt>/<app>:*`) — le conteneur qui les monte est alors construit
par ce même `Dockerfile`, et le piège du propriétaire y est identique. Un volume
déclaré **uniquement** dans une annexe est donc couvert lui aussi. Les chemins
sont dédoublonnés, et l'avertissement suppose un `Dockerfile` présent. Restent
hors de sa portée, faute de `Dockerfile` dans ce dépôt : une annexe qui tourne sur
une image **tierce**, et les volumes des `shared_services`.

**Le nom réel est le nom documenté — et c'est `name:` qui le garantit.** Compose
préfixe par défaut toute entrée du bloc `volumes:` de premier niveau par le nom du
projet : `docker compose --project-name mastack config` rend alors
`{"ramure-donnees": {"name": "mastack_ramure-donnees"}}`. La commande de
sauvegarde ci-dessous monterait `ramure-donnees`, que Docker **créerait vide** au
passage, `tar` archiverait un répertoire vide et la commande **sortirait en 0** —
l'illusion parfaite d'une sauvegarde. `init.sh` émet donc `name: <nom>` sous
chaque entrée : la stack étant unique, le préfixe de projet n'apporte rien, et le
nom réel redevient égal au nom documenté. `--check` refuse un bloc où il manque.

**Sauvegarder, et effacer.** Un volume nommé ne s'ouvre pas avec un `cat` : son
contenu passe par un conteneur jetable, lancé côté serveur.

```bash
docker run --rm -v ramure-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/ramure-donnees.tgz -C /d .
```

**Le disque du serveur est à 92 %**, et un volume, contrairement à un journal,
n'a aucune borne : il grossit jusqu'à ce que la stack entière n'ait plus de place.
Un volume de cache doit donc être **borné par ton code et jetable** — ce que ton
app ne sait pas reconstruire n'a rien à y faire. Et la séparation entre ce qui se
sauvegarde et ce qui s'efface doit se lire **dans les noms** : `donnees` se
sauvegarde, `cache` se supprime. Celui qui fait de la place à trois heures du
matin n'aura que ces noms pour décider, et `docker volume rm` est irréversible.

Le reste est vérifié pour toi, à la génération comme au `--check` : le même nom
deux fois dans une liste, ou deux volumes sur le même chemin conteneur — le
second masquerait le premier — sont refusés ; le bloc `volumes:` de premier
niveau du compose est généré et doit déclarer **exactement** les volumes montés,
faute de quoi Docker traiterait le manquant comme un bind mount et ferait échouer
le `compose up` de toute la stack. Une app désactivée ne contribue aucun volume,
puisqu'aucun de ses services n'est émis.

## Le rayon de souffle

Une seule stack, donc un seul `docker compose up`, atomique pour l'ensemble.
Une erreur dans le bloc d'une app fait échouer le déploiement de **toutes** les
autres, y compris celles que tu n'as pas touchées. Trois garde-fous en
découlent, et c'est pour cela qu'ils existent :

- `enabled` — une app entre dans le compose après son image, jamais avant ;
- le garde-fou de CI — le webhook n'est appelé qu'après avoir vérifié que
  **chaque** image de la fabrique référencée par le compose est tirable, celles
  des annexes et des services partagés comprises ; une image tierce injoignable
  n'est qu'un avertissement, faute d'y être authentifié. Le pire cas devient
  « rien n'est déployé » au lieu de « tout tombe » ;
- `./init.sh --check` — vérification **par service**, les trois sortes, jamais
  par recherche globale dans le fichier.

## Ton outillage — les plugins Claude Code

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone du dépôt —
toi, un autre agent, une session cloud, la CI — repart avec le même outillage.

Le socle, présent dans tous les dépôts :

| Plugin | Ce qu'il apporte |
|---|---|
| `superpowers` | Méthode de travail : brainstorming avant de coder, TDD, débogage systématique, rédaction de plans |
| `mattpocock-skills` | TDD, revue de code, modélisation du domaine, diagnostic de bogues |
| `code-review` / `code-simplifier` | Revue et simplification du code déjà écrit |
| `commit-commands` | Commit, push, ouverture de PR |
| `security-guidance` | Relit chaque modification à la recherche de vulnérabilités |
| `context7` | Documentation **à jour** des bibliothèques — consulte-le plutôt que ta mémoire |
| `github` | PR, Actions, GHCR |

S'y ajoutent, selon les `apps/*/app.yml` : **un serveur LSP par langage présent
dans la fabrique** — il te donne les erreurs du compilateur après chaque
édition, pour zéro contexte — et, dès qu'**une seule** app porte `ui: true`,
`frontend-design`, `playwright` et `impeccable`.

### Un seul endroit installe : le setup script de l'environnement

**Déclarer un plugin ne l'installe pas**, et aucun script du dépôt ne peut s'en
charger. Sur `claude.ai/code`, **Claude Code charge les plugins avant de les
installer** : un hook `SessionStart` s'exécute après ce chargement, donc les
plugins atterriraient sur le disque sans jamais servir. Et `/reload-plugins` est
une commande du terminal, absente du web — comme `/plugin`, `/resume` ou
`/clear`. Chaque session cloud démarrant sur une VM neuve, le cas se
représenterait à chaque fois.

Le seul point d'accroche assez tôt est le **setup script de l'environnement**,
qui tourne avant le lancement de Claude Code. `init.sh` en génère le contenu —
les plugins, plus **le binaire de chaque serveur LSP** de la fabrique : l'image
cloud fournit les compilateurs, jamais les serveurs de langage, et sans ce
binaire le plugin est installé mais inerte. Les installations partent en
parallèle — le setup script doit tenir sous cinq minutes.

```bash
cat .claude/cloud-setup.sh     # à coller dans le champ "Setup script"
```

Sur `claude.ai/code` : icône nuage au-dessus de la zone de saisie → engrenage de
l'environnement → champ **Setup script**. Le résultat est figé dans un instantané
du disque, donc le script ne rejoue qu'après modification de l'environnement ou
expiration du cache (~7 jours) — les sessions suivantes démarrent avec
l'outillage déjà en place.

Pour les stacks dont le serveur de langage ne s'installe pas en une commande à
travers l'allowlist réseau, le script généré pose un `TODO` explicite plutôt
qu'une commande inventée : complète-le avant de le coller.

Cette configuration vit **hors du dépôt**, dans ton compte : `init.sh` ne peut
pas la mettre à jour. Après un `./init.sh` qui change un `stack` ou un `ui` —
donc après l'ajout d'une app dans un langage nouveau — recolle le fichier.
`./init.sh --check` signale l'écart entre les deux listes.

### Le hook `SessionStart` ne fait que rapporter

Puisqu'aucun hook ne peut installer à temps, celui du dépôt se contente de dire
ce qui manque. `.claude/check-plugins.sh` s'exécute à chaque ouverture de
session et écrit son rapport sur la sortie standard — donc dans ton contexte :

```
Outillage : 12/12 plugins installes, 1/1 serveurs LSP presents.
```

Une ligne quand tout va bien, quel que soit le nombre d'applications ; sinon la
liste des manquants et le geste qui répare. Il vérifie deux choses distinctes :
le plugin présent dans le cache local, et — pour chaque LSP — **le binaire
présent sur la machine**, les deux pouvant diverger. Lance-le à la main pour le voir tout de suite :

```bash
./.claude/check-plugins.sh
```

Un rapport qui annonce des manquants signifie que le setup script de ton
environnement est absent, périmé, ou n'a pas encore rejoué.

`.claude/settings.local.json` est ignoré par git : c'est là que vont tes
préférences personnelles, jamais dans le fichier versionné. Et **jamais de bloc
`env` dans `.claude/settings.json`** : il est public par construction, y poser un
jeton le publie. `./init.sh --check` refuse un settings qui en contient un.

## Les deux paliers d'authentification

Chaque application est **toujours derrière une authentification Google**,
appliquée par Traefik avant qu'une requête ne l'atteigne. Deux paliers existent,
choisis app par app par `exposure` dans son `app.yml` — deux applications de la
fabrique peuvent parfaitement ne pas avoir le même :

| `exposure` | Middleware Traefik | Qui entre | Quand l'utiliser |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |

**Il n'existe pas de troisième palier.** L'exposition publique sans
authentification n'est pas disponible ; ne cherche pas à la configurer.

Dans les deux cas, l'identité de l'utilisateur connecté arrive dans l'en-tête
HTTP **`X-Forwarded-User`** (son adresse e-mail), posé par Traefik.

**Ne code pas de système de comptes.** Si tu dois cloisonner des données par
utilisateur, `X-Forwarded-User` est la **seule** source d'identité admissible —
et jamais un identifiant fourni par le client (paramètre d'URL, corps de
requête, cookie applicatif). En palier `google`, ce cloisonnement n'est pas
optionnel : n'importe qui peut se connecter, donc chaque utilisateur ne doit
voir que ses propres données.

Si tu hésites entre les deux paliers, prends `private` : c'est réversible en
une ligne, l'inverse expose des données.

## Règles impératives

- **Un `Dockerfile` par app, dans `apps/<nom>/`**, construction multi-étapes,
  image finale **< 200 Mo**. Le disque du serveur est à 92 % — une image lourde
  est refusée. Le contexte de construction est `apps/<nom>`, pas la racine :
  c'est ce qui empêche une édition dans une app d'invalider le cache des autres.
- **L'app tourne en utilisateur non root** (`USER` dans le `Dockerfile`).
- **Ne publie aucun port.** Pas de section `ports:`. Traefik joint le conteneur
  par le réseau Docker `apps_net`. Deux apps peuvent écouter sur le même port :
  chacune est dans son conteneur, rien n'est publié sur l'hôte.
- **Le fichier Compose s'appelle `compose.yaml`**, à la racine. C'est le nom
  canonique de la Compose Spec, et le seul que `dockhand` ouvre côté serveur :
  un `docker-compose.yml` lui renvoie « Compose file not found » et le
  déploiement s'arrête là. Il est **généré** et porte N services des trois
  sortes, plus — **uniquement si au moins un service monte un volume** — le bloc
  `volumes:` de premier niveau : une fabrique sans volume produit un compose qui
  n'en porte aucun, et `--check` valide alors « aucun volume monté, aucun bloc
  `volumes:` ». Ne l'édite jamais à la main, `./init.sh --check` refuse un
  compose désynchronisé.
- **Le routage vit dans les labels du `compose.yaml`**, générés par
  `init.sh`. N'y touche pas : le middleware d'authentification et
  `priority=100` y sont posés — cette priorité est ce qui empêche un serveur
  catch-all de capter l'URL et de servir un 404 silencieux. Ton bloc est un
  parmi N : une erreur dedans fait échouer le déploiement de toutes les apps.
- **Chaque app déclare ses tests dans `apps/<nom>/test.sh`**, exécutable. La CI
  ne lance que ce fichier ; la fabrique n'a pas à connaître ton langage.
- **Aucun `LABEL traefik.*` dans le `Dockerfile`**, sans exception. Docker
  fusionne les labels de l'image dans ceux du conteneur : un label de routage
  gravé dans l'image publierait un routeur **supplémentaire**, que le compose ne
  peut pas écraser puisqu'il porte un autre nom — donc **sans authentification**.
- **Aucun secret** dans le dépôt ni dans l'image. Les valeurs sensibles sont
  injectées par l'infrastructure via l'environnement ; déclare les noms attendus
  dans `env:` et dans le `README`, jamais les valeurs — un `=` dans `env:` fait
  échouer la génération, précisément pour que ce chemin reste fermé.
- **Ce qui doit survivre au redéploiement vit dans un volume nommé**, déclaré
  dans `volumes:`, et le `Dockerfile` `chown` son chemin avant `USER`. Le reste
  du système de fichiers du conteneur est jeté à chaque déploiement.
- **Écris les logs sur la sortie standard**, pas dans un fichier.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Ce qui ne t'appartient pas

D'abord ce qui **t'appartient désormais**, et qui relevait autrefois du serveur :
une base de données, un cache, un volume persistant, un service annexe. Ce ne
sont **plus** des décisions d'infrastructure. `shared_services`, `services:` et
`volumes:` les font entrer dans le contrat — tu les déclares, `./init.sh` les
génère, le déploiement les crée. Ne demande pas dans un `README` ce que tu peux
écrire dans un manifeste.

Restent hors de ce dépôt exactement cinq choses. Les deux premières sont des
faits — tu vis avec ; les trois suivantes sont des demandes — tu les écris dans
ton `README` et **tu t'arrêtes là**, la décision se prend côté serveur :

| Hors du dépôt | Pourquoi |
|---|---|
| les **valeurs** des secrets | tu n'écris que des noms, dans `env:` et dans ton `README` ; l'infrastructure injecte la valeur |
| la **topologie réseau** | `apps_net` est `external: true`, il existe déjà côté serveur ; Traefik, le résolveur TLS, le DNS et la liste blanche des comptes vivent au même endroit |
| un **port publié** sur l'hôte | aucune section `ports:` ; c'est Traefik qui joint le conteneur par `apps_net` |
| un **bind mount** depuis un chemin de l'hôte | Docker créerait le répertoire absent **en root** et ton app non-root n'y écrirait jamais ; refusé à la génération — écris un volume nommé |
| une **exposition sans authentification** | il n'existe pas de troisième palier ; `private` et `google` sont les deux seuls |

Quand tu travailles sur une app, **les fichiers des autres apps ne t'appartiennent
pas non plus**, ni les artefacts générés : `compose.yaml`, `.github/`, `.claude/`,
`go.work`. Tu changes `apps/<nom>/app.yml` — ou `fabrique.yml` si c'est un
service partagé, en sachant qu'il est commun à toutes les apps — et tu relances
`./init.sh`.

## Avant de pousser

```bash
./init.sh --check
```

Il commence par les **manifestes** — `volumes:`, `env:`, `needs:`, noms de
service —, parce qu'un `app.yml` faux ne pourrait produire qu'un « compose
désynchronisé » dont le vrai motif serait perdu ; puis il compare chaque artefact
dérivé à ce qu'`init.sh` écrirait aujourd'hui ; puis il relit le compose
**service par service**, les trois sortes — dont le `traefik.enable=false` de
chaque service non routé —, et vérifie que le bloc `volumes:` déclare exactement
les volumes montés, chacun avec son `name:`. Les avertissements — un `chown` qu'il
ne trouve pas, une clé inconnue ignorée, un budget mémoire dépassé — ne bloquent
pas ; les KO, si.

Le même contrôle tourne en CI, en verrou de tous les autres jobs : avec une
stack partagée, un compose faux fusionné casserait toutes les apps à la fois.

Le déploiement se déclenche à chaque fusion sur `main` : seules les apps
modifiées sont reconstruites et publiées sur GHCR, puis un unique appel de
webhook fait récupérer la stack entière par le serveur. Compte deux à trois
minutes entre la fusion et la mise en ligne.
