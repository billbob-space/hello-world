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
apps/<nom>/          une application : app.yml, Dockerfile, test.sh, PRODUCT.md, code
compose.yaml         GÉNÉRÉ — la stack, un service par app activée
fabrique.yml         valeurs communes : org, dépôt, registre, domaine, réseau, plafonds
init.sh              le générateur
```

Ce qui est **partagé** : la stack, la CI, le réseau, le domaine, l'outillage
Claude Code. Ce qui **appartient à chaque app** : son code, son `Dockerfile`,
son PRD, son URL, son palier d'authentification, ses tests.

## Démarrage

```bash
./init.sh                 # régénère compose.yaml, la CI et l'outillage
./init.sh --check         # vérifie le dépôt, service par service
./init.sh --list          # état des applications
./init.sh --add <nom>     # échafaude apps/<nom>/
./init.sh --dry-run       # montre ce qui changerait, sans rien écrire
```

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

## Comment on travaille : branche, puis commits par étapes

**Jamais de modification directe sur `main`.** Une branche s'ouvre dès la
**première** modification, et elle est nommée `<app>/<sujet>` — ou
`fabrique/<sujet>` pour ce qui touche `init.sh`, `fabrique.yml`, la CI, le
contrat ou l'outillage. Le préfixe dit quel périmètre est en jeu, donc quel
rayon de souffle, avant même d'ouvrir le diff.

```bash
./init.sh --branche cadran/fuseaux-multiples
./init.sh --branche fabrique/garde-fous-git
```

Le nom est validé avant la création : préfixe connu, sujet en minuscules. La
branche part de `origin/main`, jamais du HEAD courant — greffée sur une autre
branche de travail, elle traînerait ses commits dans sa PR.

**Un commit par étape vérifiée**, pas un commit au kilomètre. Avant chaque
commit :

```bash
./init.sh --pret     # branche dédiée ? contrat vert ? tests des apps touchées verts ?
```

`--pret` ne relance que les apps réellement modifiées depuis la base : sur une
fabrique qui grandit, tout relancer à chaque commit coûterait plus que ça ne
rapporte. Chaque commit est ainsi relisable seul et ne casse rien — c'est ce qui
rend la relecture simple, et c'est le seul intérêt de committer souvent. On
pousse à chaque commit ; **la pull request vient à la fin**, une fois l'ensemble
cohérent.

### Deux garde-fous, parce qu'une règle écrite s'oublie

| Hook | Ce qu'il fait |
|---|---|
| `.claude/garde-branche.sh` (`PreToolUse`) | refuse toute édition tant que HEAD est sur `main`, et donne la commande exacte |
| `.claude/garde-commit.sh` (`Stop`) | refuse de terminer sur un arbre de travail sale |

Ils sont générés par `init.sh` comme le reste de `.claude/`, et `--check` refuse
qu'ils divergent de leur générateur. Aucun des deux ne dépend de `jq` ni de
`python` : un garde-fou qui ne démarre pas sur une machine dépouillée ne garde
rien.

Le garde-fou de branche n'ouvre pas la branche à ta place : le nom doit dire le
sujet, et seul celui qui édite le connaît.

### L'agent `greffier`

Les trois gestes — brancher, vérifier, committer et pousser — se délèguent :

```
Agent(subagent_type: "greffier")   # lançable en tâche de fond
```

Il est restreint à `Bash`, `Read` et `Grep`. **L'absence d'outil d'édition n'est
pas un détail de configuration** : c'est ce qui garantit qu'un agent lancé en
fond ne peut pas modifier le dépôt pendant que tu travailles dessus. Si
`./init.sh --pret` échoue, il s'arrête et rapporte — réparer n'est pas son rôle.
Il ne réécrit jamais l'histoire (`--force`, `--amend`, `rebase`, `reset --hard`,
`merge` lui sont interdits) et n'ouvre pas de pull request.

**Le registre des agents est lu au démarrage de la session.** Un agent ajouté en
cours de session n'est donc invocable qu'à la session suivante — exactement le
même piège que les plugins, et pour la même raison. En attendant, sa séquence
s'exécute à la main, elle tient en quatre commandes.

## Le rayon de souffle

Une seule stack, donc un seul `docker compose up`, atomique pour l'ensemble.
Une erreur dans le bloc d'une app fait échouer le déploiement de **toutes** les
autres, y compris celles que tu n'as pas touchées. Trois garde-fous en
découlent, et c'est pour cela qu'ils existent :

- `enabled` — une app entre dans le compose après son image, jamais avant ;
- le garde-fou de CI — le webhook n'est appelé qu'après avoir vérifié que
  **chaque** image du compose est tirable ; le pire cas devient « rien n'est
  déployé » au lieu de « tout tombe » ;
- `./init.sh --check` — vérification **par service**, jamais par recherche
  globale dans le fichier.

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
  déploiement s'arrête là. Il est **généré** et porte N services : ne l'édite
  jamais à la main, `./init.sh --check` refuse un compose désynchronisé.
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
  dans le `README`, jamais les valeurs.
- **Écris les logs sur la sortie standard**, pas dans un fichier.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Ce qui ne t'appartient pas

La topologie réseau, les bases de données partagées et les secrets vivent sur le
serveur, hors de ce dépôt. Le réseau `apps_net` est déclaré `external: true` : il
existe déjà côté serveur, ce dépôt ne le crée pas.

Quand tu travailles sur une app, **les fichiers des autres apps ne t'appartiennent
pas non plus**, ni les artefacts générés : `compose.yaml`, `.github/`, `.claude/`,
`go.work`. Tu changes `apps/<nom>/app.yml` et tu relances `./init.sh`.

Si tu as besoin de quelque chose que le contrat ne prévoit pas — une base de
données, un cache, un volume persistant, un port supplémentaire — **écris-le
dans le `README` et arrête-toi**. C'est une décision d'infrastructure, elle se
prend côté serveur.

## Avant de pousser

```bash
./init.sh --check
```

Le même contrôle tourne en CI, en verrou de tous les autres jobs : avec une
stack partagée, un compose faux fusionné casserait toutes les apps à la fois.

Le déploiement se déclenche à chaque fusion sur `main` : seules les apps
modifiées sont reconstruites et publiées sur GHCR, puis un unique appel de
webhook fait récupérer la stack entière par le serveur. Compte deux à trois
minutes entre la fusion et la mise en ligne.
