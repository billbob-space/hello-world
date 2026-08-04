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
memory/        un fichier par sujet sorti du contrat : ce que `--check` tient déjà
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

Un fichier par application, **jamais réécrit par `init.sh`** : il est la source
de vérité, tu l’édites à la main puis tu relances `./init.sh`. Les valeurs
décidées là — port, mémoire, healthcheck, palier, volumes, services annexes —
sont toutes vérifiées : détail et pièges dans `memory/app-yml.md`.

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

`compose.yaml` porte trois sortes de services dans un espace de noms **plat** :
l'app, ses annexes `<app>-<nom>`, et les `shared_services` de la fabrique. **Seule
l'app est joignable depuis Internet** ; les deux autres portent
`traefik.enable=false`, et c’est ce label — non l’absence de label — qui les en
retire. Détail, budget mémoire et collisions de noms :
`memory/services.md`.

## Les volumes nommés

Ce qui doit survivre au redéploiement vit dans un **volume nommé**, jamais dans
le système de fichiers du conteneur, et le `Dockerfile` `chown` son chemin avant
`USER`. Formes admises, préfixe du propriétaire, sauvegarde et pièges :
`memory/volumes.md`.

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
montés, chacun avec son `name:`. Il relit enfin les documents du dépôt — contrat,
`README`, PRD, entrées de journal — pour y refuser un lien mort et **deux titres `##`
identiques dans un même fichier** : deux chapitres de même nom sont deux sources de
vérité sur le même sujet, et elles finissent par diverger. Les avertissements — un
`chown` introuvable, une clé inconnue ignorée, un budget mémoire dépassé — ne bloquent
pas ; les KO, si.

Le même contrôle tourne en CI, en verrou de tous les autres jobs : avec une stack
partagée, un compose faux fusionné casserait toutes les apps à la fois.

Le déploiement se déclenche à chaque fusion sur `main` : seules les apps modifiées sont
reconstruites et publiées sur GHCR, puis un unique appel de webhook fait récupérer la
stack entière par le serveur. Compte deux à trois minutes entre la fusion et la mise
en ligne.

## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier. Le contrat n'en garde que
l'essentiel ; le détail, les formes admises et les pièges y sont.

| Sujet | Fichier | Quand le lire |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Champs de `app.yml` | `memory/app-yml.md` | avant de créer ou modifier un `app.yml` |
| Trois sortes de services | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
