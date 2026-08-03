# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : il héberge plusieurs applications, chacune avec
son code, son PRD, son URL et son palier d'exposition, toutes déployées
ensemble dans **une seule stack dockhand**. Les règles ci-dessous sont imposées
par l'infrastructure : les enfreindre ne provoque pas une erreur claire, mais un
déploiement qui échoue en silence.

**Le nom d'une application est celui de son répertoire sous `apps/`.** C'est lui
qui devient le sous-domaine, le nom de conteneur et le nom de routeur Traefik ;
il doit donc être un label DNS valide. L'organisation, le dépôt et le domaine
sont dans `fabrique.yml`.

## Comment tu réponds

**En français, simplement, et pour quelqu'un qui n'est pas technicien.** Celui
qui te lit décide de ce qu'on construit ; il ne lit pas le code. Une réponse
qu'il ne comprend pas ne vaut rien, quelle que soit la qualité du travail
qu'elle décrit.

- **Toujours en français** — les réponses, les questions, les explications.
- **Court.** Quelques phrases, ou une liste de trois à cinq puces. Ce qui a été
  fait, ce qui reste, ce qui bloque. Le reste encombre.
- **Vulgarise.** Dis l'effet, pas le mécanisme : « le site répond à nouveau »
  plutôt que « le healthcheck du conteneur repasse healthy ». Un terme technique
  ne s'emploie que s'il est indispensable, et il s'explique alors en quelques
  mots, la première fois.
- **Pas de jargon décoratif** — ni noms de fichiers, ni options de commande, ni
  extraits de code, sauf si on te les demande ou s'il y a un geste à faire, et
  alors la commande exacte, seule.
- **Dis franchement ce qui ne va pas.** Un échec annoncé en clair vaut mieux
  qu'un succès prudent : « ça ne marche pas encore, voilà pourquoi » est une
  réponse utile.

**Cette règle vaut pour ce que tu dis, pas pour ce que tu écris dans le dépôt.**
Les messages de commit, les entrées de `journal/`, les `README` et les corps de
PR gardent toute leur précision technique : leur lecteur est un développeur ou un
agent, et ils ont chacun leur exigence propre, décrite plus bas. Vulgariser un
message de commit lui ferait perdre ce qui le rend utile.

## Arborescence

```
apps/<nom>/          une application : app.yml, Dockerfile, test.sh, PRODUCT.md, code
journal/             une entrée par branche : les anomalies rencontrées
compose.yaml         GÉNÉRÉ — la stack, un service par app activée
fabrique.yml         valeurs communes : org, dépôt, registre, domaine, réseau, plafonds
init.sh              le générateur
```

Ce qui est **partagé** : la stack, la CI, le réseau, le domaine, l'outillage
Claude Code. Ce qui **appartient à chaque app** : son code, son `Dockerfile`,
son PRD, son URL, son palier d'exposition, ses tests.

## Démarrage

```bash
./init.sh                 # régénère compose.yaml, la CI et l'outillage
./init.sh --check         # vérifie le dépôt, service par service
./init.sh --list          # état des applications
./init.sh --add <nom>     # échafaude apps/<nom>/
./init.sh --dry-run       # montre ce qui changerait, sans rien écrire
./init.sh --branches-fusionnees   # quelles branches distantes peuvent être supprimées
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

**Une exception, subie et non choisie : `claude/<sujet>`.** Le harnais cloud
assigne lui-même le nom de la branche et interdit de pousser ailleurs. Ce préfixe
est donc accepté pour **rejoindre** une branche existante — sans quoi une session
cloud ne pourrait pas ouvrir son entrée de journal — mais refusé pour en **créer**
une : personne ne le choisit.

Il ne dit rien du périmètre, et c'est sa seule limite. Sur une branche
`claude/<sujet>`, le rayon de souffle se lit dans le champ `Périmètre` de
l'entrée de journal et dans le diff, pas dans le nom. Renseigne-le tôt.

### La fin de vie d'une branche ne t'appartient pas

**Une session cloud ouvre des branches et ne peut pas en fermer.** Le relais git
du harnais refuse la suppression de refs — `HTTP 403` sur `git-receive-pack`, et
`git` affiche ensuite `Everything up-to-date`, qui ressemble à un succès. Le
serveur MCP GitHub expose `create_branch` sans son inverse. Les branches
fusionnées s'accumulent donc, et rien ne le signale.

```bash
./init.sh --branches-fusionnees    # dit quoi supprimer, ne supprime rien
```

Le critère est l'**équivalence de patch**, pas l'appartenance à l'ascendance de
`main` : cette dernière se trompe dans les deux sens. Elle classe « non
fusionnée » une branche simplement écrasée en un commit, et ne dit rien d'une
branche dont la PR est fusionnée mais qui porte des commits écrits **après**.

Sa limite est dans le nom de sa seconde section, `à regarder` : un patch inédit
ne prouve pas un travail perdu. Un contenu repris à un autre chemin, ou refait à
la main, produit un patch différent — la commande le remonte plutôt que de
proposer une suppression qu'elle ne sait pas justifier. Compare avant de conclure.

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

### Le journal des anomalies

**Une branche, une entrée dans `journal/`.** Elle s'ouvre avec la branche —
`./init.sh --branche` la crée préremplie, il n'y a pas de geste à retenir — et se
remplit **au fil du travail**, pas à la fin. Écrite à chaud, elle retient les
anomalies mineures ; reconstituée en fin de branche, elle ne garde que les
spectaculaires. Or ce sont les mineures qui disent où le contrat a un trou.

Le nom du fichier vient de la branche, ce qui le rend retrouvable sans index :
`fabrique/garde-fous-git` → `journal/2026-08-03-fabrique-garde-fous-git.md`.

Chaque anomalie porte quatre champs. `Symptôme` et `Cause` sont en prose libre.
Les deux autres ont un **vocabulaire fermé**, et `./init.sh --check` le vérifie :

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

**Le vocabulaire est fermé parce que le lecteur peut être un agent.** En prose
libre, « moi », « la critique impeccable » et « le compilateur » ne s'agrègent
pas : la distribution que ce journal promet n'est plus calculable. Ce n'est pas
une crainte théorique — les deux premières entrées ont produit treize valeurs en
six catégories informelles, dont aucune ne suivait le vocabulaire que le gabarit
proposait déjà. Un vocabulaire non vérifié n'est pas un vocabulaire.

`Detecte par` est **ordonné par coût croissant**, et c'est ce qui rentabilise le
journal. L'agrégat utile n'est pas le nombre d'anomalies mais **jusqu'où la
distribution glisse vers la droite** : une masse sur `utilisateur` et
`production` dit que les garde-fous laissent passer ; une masse sur
`compilateur`, `test` et `CI` dit qu'ils tiennent, quel qu'en soit le nombre.

Ce journal enregistre les **anomalies**, pas le déroulé : ce qui a surpris, cassé,
ou s'est révélé faux — y compris tes propres erreurs de raisonnement, qui sont
les plus utiles et les plus faciles à taire. Ce que le changement fait va dans le
message de commit ; ce qu'il a coûté d'apprendre va ici.

### L'en-tête : `Périmètre` et `Mode`

Deux champs portent sur l'**entrée entière**, et `--check` les vérifie comme les
deux précédents :

```
Périmètre : fabrique
Mode : `chaud`
```

`Périmètre` — les apps touchées, ou `fabrique`. Sur une branche `claude/<sujet>`,
dont le préfixe est imposé par le harnais et ne dit rien du rayon de souffle,
c'est le **seul** endroit où il se lit. Le laisser au gabarit fait échouer
`--check`.

`Mode` — vocabulaire fermé, `chaud` ou `retrospective`. `chaud` est la valeur du
gabarit et le cas normal, puisque `--branche` ouvre l'entrée en même temps que la
branche ; `retrospective` dit qu'elle a été reconstituée après coup, donc qu'elle
ne garde que les anomalies spectaculaires. L'`analyste` la lit mais s'interdit
d'en tirer une mesure — et pour cela il faut qu'il puisse la **trouver** :
la consigne reposait auparavant sur une phrase en prose, dont le seul filet était
un `grep` sur « rétrospectiv|reconstitu » qui attrapait aussi le titre d'une
anomalie *parlant* d'une reconstitution sans en être une.

Deux vérifications le tiennent, dans l'ordre de dureté :

- `./init.sh --pret` **refuse** l'étape si la branche n'a pas d'entrée, si
  l'entrée est encore le gabarit nu, ou si son en-tête est incomplet — sans ces
  tests, le geste deviendrait une case à cocher vide ;
- `./init.sh --check`, donc la CI, refuse un gabarit nu ou un en-tête incomplet
  **committé**. Une entrée non suivie par git est un travail en cours et ne se
  juge pas : c'est ce qui laisse `--check` vert entre l'ouverture de la branche et
  le premier commit.

Une session sans anomalie écrit « Aucune anomalie » et retire le marqueur. Une
entrée vide et une entrée jamais ouverte ne disent pas la même chose.

Le `greffier` ne peut pas remplir le journal — il n'a pas d'outil d'édition, et
c'est délibéré. Il butera sur `--pret` et rapportera : seul celui qui a fait le
travail connaît les anomalies qu'il a rencontrées.

### L'agent `analyste`

Un journal que personne ne relit est un coût sans contrepartie. L'`analyste` est
le lecteur :

```
Agent(subagent_type: "analyste")   # lançable en tâche de fond
```

Il agrège les deux champs fermés, cherche les causes qui reviennent d'une branche
à l'autre, et rend un plan de trois à six actions groupées par `Action` — les
`contrat` ensemble, les `garde-fou` ensemble. Les `arbitrage` ne sont pas des
actions : il les liste à part, telles quelles, ce sont des questions pour toi.

Comme le `greffier`, il est restreint à `Bash`, `Read` et `Grep` : **il rend son
plan dans sa réponse, il n'écrit aucun fichier.** C'est ce qui le rend lançable
en tâche de fond sans risque, et ce qui laisse la décision à qui la doit.

Deux consignes le tiennent au réel : ne pas compter une entrée marquée
rétrospective comme une mesure fiable, et ne pas proposer de garde-fou pour une
anomalie déjà rattrapée par le compilateur ou par un test — elle ne coûte rien,
le garde-fou coûterait plus.

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

### La pull request se lit en trente secondes

Un corps de PR n'est pas un compte rendu. Il sert à décider **s'il faut relire,
et par où commencer** : une phrase sur ce que fait le changement, trois à cinq
puces sur ce qui compte, ce qui a été vérifié en chiffres, et les points
d'attention avant fusion. Le reste encombre.

`.github/pull_request_template.md`, généré, en donne la forme — remplis ses
sections, ne les invente pas.

Le raisonnement détaillé, lui, va dans les **messages de commit**, où il reste
attaché au changement qu'il explique et survit à la fusion. C'est aussi ce qui
rend le découpage en étapes payant : quatre commits bien décrits valent mieux
qu'un long corps de PR que personne ne relira.

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

## Les volumes nommés — ce qui survit au redéploiement

Le système de fichiers d'un conteneur est jeté à chaque déploiement. Ce qui doit
persister se déclare dans `volumes:`, et **rien d'autre ne survit**. La forme est
`<nom>:<chemin conteneur>[:ro]` : le nom logique à gauche en minuscules, chiffres
et tirets, le chemin à droite absolu, `:ro` seul suffixe admis.

`donnees:/var/lib/ramure` déclaré par `ramure` devient le volume
**`ramure-donnees`**. C'est le préfixe du propriétaire qui empêche deux apps de
se marcher dessus sans s'être concertées, et deux apps qui produiraient le même
nom réel sont refusées — à la génération, pas seulement à `--check`.

**Un `/` à gauche est refusé.** Ce serait un bind mount, donc un chemin d'hôte à
créer à la main sur le serveur avant le premier déploiement. Les volumes nommés
existent précisément pour supprimer ce geste : `docker compose up` crée le volume
seul et le conserve entre deux déploiements. **Aucune action sur l'hôte, jamais.**

### Le piège : c'est le `Dockerfile` qui fixe les droits

Un volume nommé hérite du propriétaire du répertoire **tel qu'il existe dans
l'image**. Si le chemin monté n'y existe pas, Docker le crée en `root` — et ton
app, qui tourne en `USER` non root, ne peut pas y écrire. Le symptôme est « l'app
démarre et perd tout », sans erreur claire.

Crée donc le répertoire et donne-le à ton utilisateur **avant `USER`** :

```dockerfile
RUN mkdir -p /var/lib/mon-app && chown 10001 /var/lib/mon-app
USER app
```

`./init.sh --check` avertit quand un chemin monté n'est ni créé ni `chown` dans
le `Dockerfile`. C'est un avertissement et non un refus : la préparation peut
prendre une forme que le contrôle ne reconnaît pas.

### `name:` — pourquoi le compose porte deux fois le même nom

Compose préfixe les volumes de premier niveau par le nom du projet. Sans `name:`,
le volume réel s'appellerait `<projet>_ramure-donnees`, et une commande de
sauvegarde montant le nom court archiverait un volume **vide en sortant en
succès**. `init.sh` émet donc `name:` sous chaque volume : ce qui est écrit dans
`compose.yaml` est ce qui existe sur l'hôte.

Corollaire à connaître avant d'ajouter un premier volume à une stack déjà en
service : le nom devient **global à l'hôte**. Si d'autres stacks tournent sur le
même serveur, un nom déjà pris serait partagé. Le préfixe par nom d'app rend la
collision improbable, il ne la rend pas impossible.

## Les trois paliers d'exposition

Qui peut atteindre une application est décidé par `exposure` dans son `app.yml`,
et appliqué par Traefik avant que la requête ne parvienne au conteneur. Le choix
se fait app par app — deux applications de la fabrique peuvent parfaitement ne
pas avoir le même :

| `exposure` | Middleware Traefik | Qui entre | Quand l'utiliser |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |
| `public` | `public` | **Tout le monde, sans authentification** | Une app destinée à des gens qui n'ont pas de compte, dont rien de sensible ne vit côté serveur |

Ne confonds pas `forwardauth-open` et `public` : le premier exige un compte
Google, le second n'exige rien.

En `private` et `google`, l'identité de l'utilisateur connecté arrive dans
l'en-tête HTTP **`X-Forwarded-User`** (son adresse e-mail). Traefik le **réécrit
à chaque requête**, il n'est donc pas usurpable.

**Ne code pas de système de comptes.** Si tu dois cloisonner des données par
utilisateur, `X-Forwarded-User` est la **seule** source d'identité admissible —
et jamais un identifiant fourni par le client (paramètre d'URL, corps de
requête, cookie applicatif). En palier `google`, ce cloisonnement n'est pas
optionnel : n'importe qui peut se connecter, donc chaque utilisateur ne doit
voir que ses propres données.

### Ce que `public` implique — à lire avant de le choisir

Aucune authentification n'a lieu, **donc Traefik ne pose ni n'écrase
`X-Forwarded-User`**. L'en-tête devient entièrement contrôlé par le client :
n'importe qui peut l'envoyer avec la valeur qu'il veut. Une app qui le lirait
sur ce palier croirait identifier un utilisateur en lisant une valeur forgée.
`./init.sh --check` **refuse** une app qui lit `X-Forwarded-User` en
`exposure: public`.

Il en découle quatre contraintes, non négociables :

- **Pas d'état par utilisateur côté serveur** — ni compte, ni session, ni
  données nominatives. Ce qui est propre à un visiteur reste sur son appareil
  (`localStorage`, `IndexedDB`).
- **Rien de sensible ne transite** — clés d'API tierces comprises. Tout ce que
  le navigateur reçoit est, par construction, public.
- **Le rate-limit n'est pas une protection** — le palier en pose un (50 req/s
  par IP, rafale 100), mais l'app doit encaisser du trafic non sollicité :
  robots d'indexation, scanners, curieux.
- **L'URL finira par être trouvée.** Ne compte jamais sur le fait qu'elle n'est
  pas publiée.

La stack étant unique, une app publique voisine d'apps privées ne les expose
pas : chaque routeur porte son propre middleware, et `--check` le vérifie
service par service.

Si tu hésites entre deux paliers, prends le plus fermé : `private` se desserre
en une ligne, l'inverse a déjà exposé les données.

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
  `init.sh`. N'y touche pas : le middleware du palier d'exposition et
  `priority=100` y sont posés — cette priorité est ce qui empêche un serveur
  catch-all de capter l'URL et de servir un 404 silencieux. Ton bloc est un
  parmi N : une erreur dedans fait échouer le déploiement de toutes les apps.
- **Chaque app déclare ses tests dans `apps/<nom>/test.sh`**, exécutable. La CI
  ne lance que ce fichier ; la fabrique n'a pas à connaître ton langage.
- **Aucun `LABEL traefik.*` dans l'image**, sans exception — ni écrit dans le
  `Dockerfile`, ni **hérité de l'image de base**. Docker fusionne les labels de
  l'image dans ceux du conteneur : un label de routage gravé dans l'image
  publierait un routeur **supplémentaire**, que le compose ne peut pas écraser
  puisqu'il porte un autre nom — donc **sans authentification**. `--check` lit le
  `Dockerfile`, où un label hérité n'apparaît pas ; la CI inspecte donc en plus
  l'**image construite**, seul endroit où il se voit, et refuse la construction.
  Si l'image de base en porte un, il faut en changer : ce label ne se retire pas
  depuis le compose.
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
données, un cache partagé, un port supplémentaire — **écris-le
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
