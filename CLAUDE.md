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
technique : leur lecteur est un développeur ou un agent. **Et entre agents, on écrit en
télégraphique** — des champs, des symboles, un vocabulaire fermé, aucune phrase de
politesse ; missions et rendus ont un format, dans `memory/travail.md`.

## Un choix qui revient à l'utilisateur se montre

**Ne pose pas en prose un choix qui a une forme visible** — une mise en page, un
parcours, un écran, la place d'une information. Fabrique **deux ou trois maquettes**,
donne-lui un lien pour les ouvrir, et demande laquelle il retient. Deux écrans côte à
côte se comparent d'un coup d'œil ; deux paragraphes qui les décrivent, non — et celui
qui te lit ne lit pas le code.

Elles se dessinent avec la compétence `frontend-design`, ou `impeccable` quand le rendu
doit être abouti : HTML autonome, contenu plausible plutôt que texte bouché, les
variantes assez différentes pour que le choix en soit un. Publie-les en artefact ; à
défaut, une capture par variante.

**Les maquettes sont jetables, la décision ne l'est pas.** Elles ne s'installent pas
dans le dépôt : ce qui survit est ce qui a été retenu, écrit dans le `PRODUCT.md` de
l'app ou dans son PRP, avec ce qui a été écarté. Une variante préférée dont rien ne
garde la trace se rediscute deux mois plus tard.

**Un choix sans forme visible s'illustre quand même.** Un palier d'exposition, une
technologie, un arbitrage de périmètre n'ont pas d'écran à dessiner, mais ils ont des
**conséquences** qui se montrent : qui entre et qui reste dehors, ce que l'utilisateur
verrait dans un cas et dans l'autre, ce qui devient impossible. Une page de comparaison
— une option par colonne, la conséquence en clair, jamais le mécanisme — se tranche plus
vite qu'un paragraphe par option.

**Quand rien ne se montre honnêtement, pose la question en prose** : une illustration
qui n'ajoute rien à ce que trois phrases disaient déjà fait décider sur sa mise en forme.

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
./scripts/pret.sh     # branche dédiée ? contrat vert ? tests verts ? revue verte ?
```

`pret.sh` appelle `./scripts/revue.sh` sur les apps touchées : **sécurité, dépendances
vulnérables, code mort ou compliqué, couverture, duplication**. Elle bloque. La barre de
couverture et le plafond de duplication de chaque app vivent dans son `app.yml`, relevés
au niveau du jour — **ils ne se déplacent que dans le sens qui serre**, et desserrer est
une édition à la main, donc une ligne dans le diff.

**Chaque constat de sécurité reçoit un verdict** : corrigé, ou écarté par un
`// #nosec Gxxx -- <raison>` qui dit *ce qui* neutralise la teinte. « Faux positif » n'est
pas une raison, et les mises à l'écart sont comptées à chaque passage. Détail et pièges :
`memory/revue.md`.

On pousse à chaque commit ; **la pull request vient à la fin**, une fois l'ensemble
cohérent. Le raisonnement détaillé va dans les **messages de commit**, où il survit à la
fusion.

**Avant la pull request, deux relecteurs passent une fois** : l'agent `relecteur` sur
le code — justesse, simplicité, PRD — et l'agent `esthete` sur les écrans, quand ils
ont bougé, avec la compétence `impeccable`. L'esthète **corrige seul ce qui est
objectif** et **montre le reste** ; sa critique datée vit dans l'app, et rien ne part
avec des écrans plus récents qu'elle.

**Le code d'une app se délègue à `artisan`, l'enregistrement git au `greffier`** — pas à
toi directement. Leur contexte réduit (une seule app pour l'un, aucun outil d'édition pour
l'autre, modèle moins cher) évite de charger le tien de diffs et de fichiers relus à
chaque tour qui suit. Toi, tu écris ce qui est partagé (`.claude/`, `scripts/`,
`fabrique.yml`, `init.sh`) et ce qui demande un dialogue déjà eu avec l'utilisateur (PRD,
PRP) ; l'artisan ne fait ni l'un ni l'autre. Détail : `memory/travail.md`.

**Les appels d'outils indépendants partent dans le MÊME tour.** Un tour paie tout le
contexte relu, quelle que soit sa sortie — deux lectures qui ne dépendent pas l'une de
l'autre coûtent donc moitié moins groupées que séparées. Sur la branche la plus lourde du
dépôt, **67 % des tours rendaient moins de 300 jetons et pesaient la moitié de la
facture** : un appel nu qui paie tout le contexte pour ne presque rien rendre. `cout.sh`
compte ces tours courts à chaque relevé — c'est le poste le plus cher, et le seul qui ne
tienne qu'à une habitude.

**Ce qui peut tourner en même temps est recensé une fois pour toutes** dans
`docs/parallelisme.md` : les gisements — session, chaîne locale, CI, agents —, le verrou
que chacun demande, et leur mode d'échec commun, le vert silencieux. Un gain de temps ne
se déclare pas, il se chiffre : `./docs/banc/mesurer.sh` rejoue six scénarios figés et
`docs/banc/releves.md` garde la série. Sans mesure, on accélère la branche qui n'était
pas la plus lente — c'est déjà arrivé ici.

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
prend deux à trois minutes, et **ne recrée que les conteneurs dont l'image a bougé** : la CI
les remplace un par un chez `dockhand`, qui recréerait sinon la stack entière. Un changement
de **structure** — un service qui apparaît, une limite, un volume, un label — retombe sur
l'ancien chemin et recrée tout. Le détail, et les deux réglages serveur qui en dépendent,
sont au `README`. Ce que fait l'app **une fois déployée** se regarde en lecture seule avec
`./scripts/prod.sh`, expliqué là aussi.

## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier. Le contrat n'en garde que l'essentiel ;
le détail, les formes admises et les pièges y sont. Ils se lisent **à la demande, jamais
importés automatiquement** — `--check` le vérifie.

| Sujet | Fichier | Quand le lire |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Champs de `app.yml` | `memory/app-yml.md` | avant de créer ou modifier un `app.yml` |
| Trois sortes de services | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
| Journal, garde-fous, agents, modes | `memory/travail.md` | avant de remplir le journal, d'ouvrir une PR ou de lancer un agent |
| Ajouter une application | `memory/ajouter-une-app.md` | avant `--add`, et avant chacun de ses deux commits |
| Le PRD suit l'app | `memory/produit.md` | avant d'écrire un PRD, avant de livrer un ajout que nul PRP ne prévoyait |
| Outillage, plugins, LSP, compétences | `memory/outillage.md` | quand un plugin ou un LSP manque, avant d'écrire une compétence, avant d'ouvrir une session cloud |
| Paliers d'exposition, détail | `memory/exposition.md` | avant de changer une `exposure` ou de lire une identité |
| Règles impératives, détail | `memory/regles-imperatives.md` | avant d'écrire un `Dockerfile` ou un `test.sh` |
| Ce qui ne t'appartient pas, détail | `memory/perimetre.md` | avant de demander dans un README ce qui se déclare |
| La revue outillée, détail | `memory/revue.md` | avant d'instruire un constat, de déplacer un seuil, d'ajouter un axe |
