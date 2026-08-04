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

Les vocabulaires fermés du journal, les deux agents, les deux garde-fous et la
fin de vie d’une branche : `memory/travail.md`.

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

## Ton outillage

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone repart avec
le même outillage. **Déclarer un plugin ne l'installe pas** — seul le *setup
script* de l'environnement cloud le fait, et `.claude/cloud-setup.sh` en porte le
contenu à recoller après tout changement de `stack` ou de `ui`. Liste des
plugins, serveurs LSP, et le rapport d’ouverture de session :
`memory/outillage.md`. **Jamais de bloc `env` dans `.claude/settings.json`** : il
est public par construction.

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

Ce que `public` implique, `X-Forwarded-User` et le cloisonnement par
utilisateur : `memory/exposition.md`.

Si tu hésites entre deux paliers, prends le plus fermé : `private` se desserre en une
ligne, l'inverse a déjà exposé les données.

## Règles impératives

Un `Dockerfile` par app dans `apps/<nom>/`, multi-étapes, image **< 200 Mo**,
tournant en **utilisateur non root**. **Aucun port publié**, **aucun secret**,
**aucun `LABEL traefik.*`**, les logs sur la sortie standard, et l’app démarre
sans intervention. Chacune de ces règles est refusée par `./init.sh --check` ou
par la CI, avec la raison : `memory/regles-imperatives.md`.

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
| Journal, garde-fous, agents | `memory/travail.md` | avant de remplir le journal ou de lancer un agent |
| Outillage, plugins, LSP | `memory/outillage.md` | quand un plugin ou un LSP manque |
| Paliers d'exposition, détail | `memory/exposition.md` | avant de changer une `exposure` ou de lire une identité |
| Règles impératives, détail | `memory/regles-imperatives.md` | avant d'écrire un `Dockerfile` ou un `test.sh` |
