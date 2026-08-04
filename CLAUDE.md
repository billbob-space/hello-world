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
./init.sh                          # régénère compose.yaml et go.work depuis les manifestes
./init.sh --check                  # vérifie les manifestes, puis le dépôt service par service
./init.sh --list                   # état des applications
./init.sh --add <nom>              # échafaude apps/<nom>/
./init.sh --dry-run                # montre ce qui changerait, sans rien écrire
./init.sh --branches-fusionnees    # quelles branches distantes peuvent être supprimées
```

`--dry-run` n'écrit **rien**, pas même l'`app.yml` qu'un `--enable` modifierait :
il affiche l'ancienne et la nouvelle valeur, puis le diff des artefacts.

`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient, app par app. Deux artefacts sont
**toujours réécrits**, fonction directe des manifestes : `compose.yaml` et
`go.work`. Le reste — le workflow de CI, `.claude/` — est ordinaire, à éditer
directement ; `--check` en vérifie l'existence et les propriétés qui comptent,
pas l'égalité à un générateur.

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
git add apps/ma-nouvelle-app compose.yaml .gitignore go.work  # + .claude si édité
git commit                                    # commit 1 : la CI publie l'image

./init.sh --app ma-nouvelle-app --enable      # une fois l'image publiée
./init.sh --check
git add apps/ma-nouvelle-app/app.yml compose.yaml && git commit   # commit 2 : le déploiement
```

**Le commit 1 emporte les artefacts régénérés, pas seulement `apps/<nom>`** : `--add`
réécrit `compose.yaml`, `.gitignore` et, dès que le module Go existe, `go.work`.
N'ajouter que `apps/<nom>` fait échouer le job `contrat` en CI sur « compose.yaml
désynchronisé des manifestes », avant même la construction. S'il introduit un langage
ou un `ui: true` nouveau, édite `.claude/settings.json` et `.claude/cloud-setup.sh` —
`--check` avertit si un plugin manque. Le commit 2 ne touche que `app.yml` et `compose.yaml`.

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
request vient à la fin**, une fois l'ensemble cohérent. Son corps sert à décider
s'il faut relire et par où commencer, pas à rendre compte : une phrase, trois à
cinq puces, ce qui a été vérifié en chiffres — `.github/pull_request_template.md`,
généré, en donne la forme. Le raisonnement détaillé va dans les **messages de
commit**, où il survit à la fusion.

Les vocabulaires fermés du journal, les deux agents, les deux garde-fous et la
fin de vie d’une branche : `memory/travail.md`.

## Le rayon de souffle

Une seule stack, donc un seul `docker compose up`, atomique : une erreur dans le bloc
d'une app fait échouer le déploiement de **toutes** les autres, y compris celles que
tu n'as pas touchées. C'est la raison d'être des trois garde-fous décrits plus haut —
`enabled`, l'inspection des images en CI, et le `--check` service par service — et la
raison pour laquelle aucun ne se contourne.

## Ton outillage

`.claude/settings.json` est un fichier ordinaire, **versionné** : tout clone
repart avec le même outillage. **Déclarer un plugin ne l'installe pas** — seul
le *setup script* de l'environnement cloud le fait, et `.claude/cloud-setup.sh`
en porte le contenu à recoller après tout changement de `stack` ou de `ui`.
Liste des plugins, serveurs LSP, et le rapport d'ouverture de session :
`memory/outillage.md`. **Jamais de bloc `env` dans `.claude/settings.json`** :
il est public par construction.

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

## Ce qui ne t’appartient pas

Une base, un cache, un volume, un service annexe **t'appartiennent désormais** :
déclare-les dans un manifeste plutôt que de les demander dans un `README`. Seule
exception, les **valeurs** des secrets : tu écris le nom dans `env:` et dans ton
`README`, l'infrastructure injecte la valeur. La topologie réseau, les trois
refus et leurs alternatives : `memory/perimetre.md`.

## Avant de pousser

```bash
./init.sh --check
```

Manifestes, puis artefacts dérivés, puis le compose service par service, puis les
documents du dépôt. Les avertissements ne bloquent pas, les KO si. Le même contrôle
tourne en CI, en verrou de tous les autres jobs : avec une stack partagée, un
compose faux fusionné casserait toutes les apps à la fois. Le déploiement se
déclenche à chaque fusion sur `main` — deux à trois minutes jusqu'à la mise en
ligne.

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
| Ce qui ne t'appartient pas, détail | `memory/perimetre.md` | avant de demander dans un README ce qui se déclare |
