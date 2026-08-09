# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : plusieurs applications, chacune avec son code, son
PRD, son URL et son palier d'exposition, déployées ensemble dans **une seule stack
dockhand**, d'un seul `docker compose up` atomique. Une erreur dans le bloc d'une app
fait donc échouer le déploiement de **toutes** les autres, y compris celles que tu n'as
pas touchées — d'où trois garde-fous qu'on ne contourne pas : `enabled`, l'inspection
des images en CI, le `--check` service par service. Enfreindre une règle ne provoque
pas une erreur claire, mais un déploiement qui échoue en silence.

**Le nom d'une application est celui de son répertoire sous `apps/`** : il devient le
sous-domaine, le nom de conteneur et le nom de routeur Traefik, il doit donc être un
label DNS valide. Org, dépôt et domaine sont dans `fabrique.yml`.

## Comment tu réponds

**En français, simplement, pour quelqu'un qui n'est pas technicien** — celui qui te lit
décide de ce qu'on construit, et ne lit pas le code.

- **Toujours en français** — réponses, questions, explications.
- **Court** — quelques phrases, ou trois à cinq puces : ce qui est fait, ce qui reste,
  ce qui bloque.
- **Dis l'effet, pas le mécanisme** — « le site répond à nouveau » plutôt que « le
  healthcheck repasse healthy ». Ni noms de fichiers, ni options, ni extraits de code,
  sauf geste à faire ; alors la commande exacte, seule.

**Cette règle vaut pour ce que tu dis, pas pour ce que tu écris dans le dépôt.** Messages
de commit, entrées de `journal/`, `README` et corps de PR gardent toute leur précision
technique : leur lecteur est un développeur ou un agent.

## Arborescence

```
apps/<nom>/    une application : app.yml, Dockerfile, code, test.sh, README.md
               PRODUCT.md porte le PRD, prp/ les documents d'implémentation
docs/          ce qui n'est propre à aucune app : specs et plans de fabrique
journal/       une entrée par branche : les anomalies rencontrées
memory/        un fichier par sujet sorti du contrat
fabrique.yml   org, dépôt, registre, domaine, réseau, plafonds, shared_services
init.sh        le générateur et le vérificateur ; scripts/ les cinq autres métiers
```

**Quatre artefacts sont GÉNÉRÉS** — ne les édite jamais à la main, édite le manifeste :
`compose.yaml`, la stack entière ; `go.work` ; la notice `apps/<nom>/CLAUDE.md` de chaque
app ; et `versions.yml`, écrit par la CI, qui dit quelle version tourne en ligne app par
app. Le reste, dont le workflow et `.claude/`, est ordinaire.

**Partagé** : la stack, la CI, le réseau, le domaine, `shared_services`, l'outillage
Claude Code. **Propre à chaque app** : son code, son `Dockerfile`, son PRD, son URL, son
palier d'exposition, ses volumes, ses services annexes, ses tests.

**Tout ce qui décrit une app vit dans son répertoire.** Un répertoire qui ne porte que
ces documents est légitime : c'est une app dont le code n'est pas encore écrit. Les
compétences `superpowers` écrivent leurs specs sous `docs/` — déplace-les sous
`apps/<nom>/` avant de committer.

## Démarrage

```bash
./init.sh          # régénère les artefacts dérivés depuis les manifestes
./init.sh --check  # vérifie les manifestes, puis le dépôt service par service
./init.sh --help   # les autres options, et les cinq métiers de scripts/
```

`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : le choix de la technologie
t'appartient, app par app.

## `apps/<nom>/app.yml` — les valeurs que tu décides

Un fichier par application, **jamais réécrit par `init.sh`** : il est la source de vérité,
tu l'édites à la main puis tu relances `./init.sh`. Port, mémoire, healthcheck, palier,
volumes, services annexes — toutes ces valeurs sont vérifiées.

## Ajouter une application

**Construire d'abord, brancher ensuite** : un premier commit fait publier l'image par la
CI, un second seulement fait entrer l'app dans le compose — c'est pourquoi elle naît
`enabled: false`. Le commit 1 emporte **les artefacts régénérés**, pas seulement
`apps/<nom>` : sinon le job `contrat` échoue sur « compose.yaml désynchronisé », et la CI
est rouge pour tout le monde.

## Les trois sortes de services — une seule est routée

`compose.yaml` porte trois sortes de services dans un espace de noms **plat** : l'app, ses
annexes `<app>-<nom>`, et les `shared_services` de la fabrique. **Seule l'app est joignable
depuis Internet** ; les deux autres portent `traefik.enable=false`, et c'est ce label — non
l'absence de label — qui les en retire.

## Les volumes nommés

Ce qui doit survivre au redéploiement vit dans un **volume nommé**, jamais dans le système
de fichiers du conteneur, et le `Dockerfile` `chown` son chemin avant `USER`.

## Comment on travaille : branche, puis commits par étapes

Une branche s'ouvre dès la **première** modification, nommée `<app>/<sujet>` — ou
`fabrique/<sujet>` pour ce qui touche `init.sh`, `fabrique.yml`, la CI, le contrat ou
l'outillage. Le préfixe dit quel rayon de souffle est en jeu, avant même d'ouvrir le diff.

```bash
./scripts/branche.sh cadran/fuseaux-multiples
```

**Une exception, subie et non choisie : `claude/<sujet>`**, que le harnais cloud assigne
lui-même. Ce préfixe **ne dit rien du périmètre** : sur une telle branche, le rayon de
souffle se lit dans le champ `Périmètre` de l'entrée de journal, et nulle part ailleurs.
Renseigne-le tôt.

**Un commit par étape vérifiée**, pas un commit au kilomètre. Avant chaque commit :

```bash
./scripts/pret.sh     # branche dédiée ? contrat vert ? tests des apps touchées verts ?
```

On pousse à chaque commit ; **la pull request vient à la fin**, une fois l'ensemble
cohérent. Le raisonnement détaillé va dans les **messages de commit**, où il survit à la
fusion.

**Le code d'une app se délègue à `artisan`, l'enregistrement git au `greffier`** — pas à
toi directement. Leur contexte réduit (une seule app pour l'un, aucun outil d'édition pour
l'autre, modèle moins cher) évite de charger le tien de diffs et de fichiers relus à
chaque tour qui suit. Toi, tu écris ce qui est partagé (`.claude/`, `scripts/`,
`fabrique.yml`, `init.sh`) et ce qui demande un dialogue déjà eu avec l'utilisateur (PRD,
PRP) ; l'artisan ne fait ni l'un ni l'autre. Détail : `memory/travail.md`.

**Ce que la branche a coûté se relève avec `./scripts/cout.sh`**, qui l'écrit dans son
entrée de journal. Non relevé avant la fusion, il est perdu.

**Par défaut on te consulte** ; `/livrer` t'envoie seul jusqu'à la mise en ligne vérifiée,
trois gestes irréversibles exceptés ; `/pas-a-pas` t'en sort.

## Ce que le PRD dit reste vrai, ou il ment

Un ajout qui ne vient d'aucun PRP est normal — l'usage réel en produit. Qu'il ne soit écrit
nulle part ne l'est pas : le `PRODUCT.md` décrit alors une application qui n'existe plus, et
rien ne le signale. **Une capacité neuve** se déclare dans une section « Ajouté après les
PRP », **dans le même commit que le code**.

## Ton outillage

`.claude/settings.json` est un fichier ordinaire, **versionné** : tout clone repart avec le
même outillage. **Déclarer un plugin ne l'installe pas** — seul le *setup script* de
l'environnement cloud le fait, et `.claude/cloud-setup.sh` en porte le contenu à recoller
après tout changement de `stack` ou de `ui`. **Jamais de bloc `env` dans
`.claude/settings.json`** : il est public par construction.

## Les trois paliers d'exposition

Qui peut atteindre une application est décidé par `exposure` dans son `app.yml`, appliqué
par Traefik avant que la requête ne parvienne au conteneur.

| `exposure` | Middleware Traefik | Qui entre | Quand l'utiliser |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |
| `public` | `public` | **Tout le monde, sans authentification** | Une app destinée à des gens qui n'ont pas de compte, dont rien de sensible ne vit côté serveur |

**Si tu hésites entre deux paliers, prends le plus fermé** : `private` se desserre en une
ligne, l'inverse a déjà exposé les données.

## Règles impératives

Un `Dockerfile` par app dans `apps/<nom>/`, multi-étapes, image **< 200 Mo**, tournant en
**utilisateur non root**. **Aucun port publié**, **aucun secret**, **aucun `LABEL
traefik.*`**, les logs sur la sortie standard, et l'app démarre sans intervention.

## Ce qui ne t'appartient pas

Une base, un cache, un volume, un service annexe **t'appartiennent désormais** : déclare-les
dans un manifeste plutôt que de les demander dans un `README`. Seule exception, les
**valeurs** des secrets : tu écris le nom dans `env:` et dans ton `README`, l'infrastructure
injecte la valeur.

## Avant de pousser

```bash
./init.sh --check
```

Les avertissements ne bloquent pas, les KO si. Le même contrôle tourne en CI, en verrou de
tous les autres jobs : avec une stack partagée, un compose faux fusionné casserait toutes
les apps à la fois.

**Le déploiement ne part pas à chaque fusion** : il est sauté tant qu'aucune image d'app ni
`compose.yaml` n'a changé — un commit de documentation ne redémarre rien. Quand il part, il
prend deux à trois minutes, et `dockhand` recrée alors **toute** la stack, pas seulement les
apps livrées : le dépôt n'y peut rien, c'est mesuré au `README`. Ce que fait l'app **une fois
déployée** se regarde en lecture seule avec `./scripts/prod.sh`, expliqué là aussi.

## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier. Le contrat n'en garde que l'essentiel ;
le détail, les formes admises et les pièges y sont.

| Sujet | Fichier | Quand le lire |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Champs de `app.yml` | `memory/app-yml.md` | avant de créer ou modifier un `app.yml` |
| Trois sortes de services | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
| Journal, garde-fous, agents, modes | `memory/travail.md` | avant de remplir le journal, d'ouvrir une PR ou de lancer un agent |
| Ajouter une application | `memory/ajouter-une-app.md` | avant `--add`, et avant chacun de ses deux commits |
| Le PRD suit l'app | `memory/produit.md` | avant de livrer un ajout que nul PRP ne prévoyait |
| Outillage, plugins, LSP, compétences | `memory/outillage.md` | quand un plugin ou un LSP manque, avant d'écrire une compétence |
| Paliers d'exposition, détail | `memory/exposition.md` | avant de changer une `exposure` ou de lire une identité |
| Règles impératives, détail | `memory/regles-imperatives.md` | avant d'écrire un `Dockerfile` ou un `test.sh` |
| Ce qui ne t'appartient pas, détail | `memory/perimetre.md` | avant de demander dans un README ce qui se déclare |
