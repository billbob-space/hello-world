# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : plusieurs applications déployées ensemble dans **une seule
stack dockhand**, d'un seul `docker compose up` atomique. Une erreur dans le bloc d'une app
fait échouer le déploiement de **toutes** les autres, y compris celles que tu n'as pas
touchées — et elle ne provoque pas une erreur claire, mais un déploiement qui échoue en
silence.

**Le nom d'une application est celui de son répertoire sous `apps/`** : il devient le
sous-domaine, le nom de conteneur et le nom de routeur Traefik, il doit donc être un
label DNS valide. Org, dépôt et domaine sont dans `fabrique.yml`.

## Comment tu réponds

**En français, simplement, pour quelqu'un qui n'est pas technicien.**

- **Toujours en français** — réponses, questions, explications.
- **Court** — quelques phrases, ou trois à cinq puces : ce qui est fait, ce qui reste,
  ce qui bloque.
- **Dis l'effet, pas le mécanisme** — « le site répond à nouveau » plutôt que « le
  healthcheck repasse healthy ». Ni noms de fichiers, ni options, ni extraits de code,
  sauf geste à faire ; alors la commande exacte, seule.

**Cette règle vaut pour ce que tu dis, pas pour ce que tu écris dans le dépôt.** Messages
de commit, entrées de `journal/`, `README` et corps de PR gardent toute leur précision
technique : leur lecteur est un développeur ou un agent.

## Un choix qui revient à l'utilisateur se montre

**Ne pose pas en prose un choix qui a une forme visible** — une mise en page, un parcours,
un écran, la place d'une information. Fabrique **deux ou trois maquettes**, donne un lien
pour les ouvrir, et demande laquelle il retient.

Dessine-les avec `frontend-design`, ou `impeccable` quand le rendu doit être abouti : HTML
autonome, contenu plausible plutôt que texte bouché, les variantes assez différentes pour
que le choix en soit un. Publie-les en artefact ; à défaut, une capture par variante.

**Les maquettes sont jetables, la décision ne l'est pas.** Elles ne s'installent pas dans
le dépôt : ce qui a été retenu, et ce qui a été écarté, s'écrit dans le `PRODUCT.md` de
l'app ou dans son PRP.

**Un choix sans forme visible s'illustre quand même.** Un palier, une technologie, un
arbitrage de périmètre ont des **conséquences** qui se montrent : une page de comparaison,
une option par colonne, la conséquence en clair, jamais le mécanisme.

**Quand rien ne se montre honnêtement, pose la question en prose.**

## Arborescence

```
apps/<nom>/    une application : app.yml, Dockerfile, code, test.sh, README.md
               PRODUCT.md porte le PRD, prp/ les documents d'implémentation
docs/          ce qui n'est propre à aucune app : specs et plans de fabrique
journal/       une entrée par branche : les anomalies rencontrées
memory/        un fichier par sujet sorti du contrat
fabrique.yml   org, dépôt, registre, domaine, réseau, plafonds, shared_services
```

**Quatre artefacts sont GÉNÉRÉS** — ne les édite jamais à la main, édite le manifeste :
`compose.yaml`, la stack entière ; `go.work` ; la notice `apps/<nom>/CLAUDE.md` de chaque
app ; et `versions.yml`, écrit par la CI, qui dit quelle version tourne en ligne app par
app. Le reste, dont le workflow et `.claude/`, est ordinaire.

**Tout ce qui décrit une app vit dans son répertoire** — un répertoire qui ne porte que ces
documents est une app dont le code n'est pas encore écrit. Les compétences `superpowers`
écrivent leurs specs sous `docs/` : déplace-les sous `apps/<nom>/` avant de committer.

## Démarrage

```bash
./init.sh          # régénère les artefacts dérivés depuis les manifestes
./init.sh --check  # vérifie les manifestes, puis le dépôt service par service
./init.sh --help   # les autres options, et les cinq métiers de scripts/
```

`apps/<nom>/app.yml` est la source de vérité, **jamais réécrit par `init.sh`** : tu l'édites
à la main, puis tu relances `./init.sh`.

## Ajouter une application

**Construire d'abord, brancher ensuite** : un premier commit fait publier l'image par la
CI, un second seulement fait entrer l'app dans le compose — c'est pourquoi elle naît
`enabled: false`. Le commit 1 emporte **les artefacts régénérés**, pas seulement
`apps/<nom>` : sinon le job `contrat` échoue, et la CI est rouge pour tout le monde.

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
l'outillage.

```bash
./scripts/branche.sh cadran/fuseaux-multiples
```

**Sur une branche `claude/<sujet>`, assignée par le harnais cloud**, le préfixe ne dit rien
du périmètre : le rayon de souffle se lit dans le champ `Périmètre` de l'entrée de journal,
et nulle part ailleurs. Renseigne-le tôt.

**Un commit par étape vérifiée**, pas un commit au kilomètre. Avant chaque commit :

```bash
./scripts/pret.sh     # branche dédiée ? contrat vert ? tests verts ? revue verte ?
```

La revue bloque. Ses seuils vivent dans l'`app.yml` de chaque app et **ne se déplacent que
dans le sens qui serre**. **Chaque constat de sécurité reçoit un verdict** : corrigé, ou
écarté par un `// #nosec Gxxx -- <raison>` qui dit *ce qui* neutralise la teinte — « faux
positif » n'est pas une raison. Détail : `memory/revue.md`.

On pousse à chaque commit ; **la pull request vient à la fin**, une fois l'ensemble
cohérent. Le raisonnement détaillé va dans les **messages de commit**, où il survit à la
fusion.

**Avant la pull request, deux relecteurs passent une fois** : `relecteur` sur le code —
justesse, simplicité, PRD — et `esthete` sur les écrans quand ils ont bougé, avec la
compétence `impeccable`. L'esthète **corrige seul ce qui est objectif** et **montre le
reste** ; rien ne part avec des écrans plus récents que sa critique datée.

**Le code d'une app se délègue à `artisan`, l'enregistrement git au `greffier`** — pas à toi
directement. Toi, tu écris ce qui est partagé (`.claude/`, `scripts/`, `fabrique.yml`,
`init.sh`) et ce qui demande un dialogue déjà eu avec l'utilisateur (PRD, PRP) ; l'artisan
ne fait ni l'un ni l'autre. Détail : `memory/travail.md`.

**Les appels d'outils indépendants partent dans le MÊME tour.** Un tour paie tout le
contexte relu quelle que soit sa sortie : deux lectures indépendantes coûtent moitié moins
groupées que séparées. C'est le poste le plus cher du dépôt.

**Ce qui peut tourner en même temps** est recensé dans `docs/parallelisme.md`. Un gain de
temps ne se déclare pas, il se chiffre : `./docs/banc/mesurer.sh`.

**Ce que la branche a coûté se relève avec `./scripts/cout.sh`**, qui l'écrit dans son
entrée de journal. Non relevé avant la fusion, il est perdu.

**Par défaut on te consulte** ; `/livrer` t'envoie seul jusqu'à la mise en ligne vérifiée,
trois gestes irréversibles exceptés ; `/pas-a-pas` t'en sort.

## Ce que le PRD dit reste vrai, ou il ment

Un ajout qui ne vient d'aucun PRP est normal ; qu'il ne soit écrit nulle part ne l'est pas.
**Une capacité neuve** se déclare dans une section « Ajouté après les PRP » du `PRODUCT.md`,
**dans le même commit que le code**.

## Ton outillage

`.claude/settings.json` est un fichier ordinaire, **versionné** : tout clone repart avec le
même outillage. **Déclarer un plugin ne l'installe pas** — seul le *setup script* de
l'environnement cloud le fait, et `.claude/cloud-setup.sh` en porte le contenu à recoller
après tout changement de `stack` ou de `ui`. **Jamais de bloc `env` dans
`.claude/settings.json`** : il est public par construction.

## Les trois paliers d'exposition

Qui peut atteindre une application est décidé par `exposure` dans son `app.yml`, appliqué
par Traefik avant que la requête ne parvienne au conteneur.

| `exposure` | Qui entre | Quand l'utiliser |
|---|---|---|
| `private` *(défaut)* | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |
| `public` | **Tout le monde, sans authentification** | Une app destinée à des gens qui n'ont pas de compte, dont rien de sensible ne vit côté serveur |

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
tous les autres jobs.

**Le déploiement ne part pas à chaque fusion** : il est sauté tant qu'aucune image d'app ni
`compose.yaml` n'a changé. Ce qu'il recrée, ce qu'il remplace un par un, et les deux
réglages serveur qui en dépendent, sont au `README` — avec `./scripts/prod.sh`, qui regarde
la production en lecture seule.

## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier — **à la demande, jamais importé
automatiquement**.

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
