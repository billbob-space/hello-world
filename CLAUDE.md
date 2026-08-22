# Contrat de déploiement — billbob.ovh

Ce dépôt est une **fabrique** : plusieurs applications déployées ensemble dans **une seule
stack dockhand**, d'un seul `docker compose up` atomique. Une erreur dans le bloc d'une app
fait échouer le déploiement de **toutes** les autres, y compris celles que tu n'as pas
touchées — et pas avec une erreur claire, mais en silence.

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
  sauf geste à faire — une commande, ou le prompt de reprise d'une session trop longue ;
  alors, seul et exact, ce qui se copie.

**Cette règle vaut pour ce que tu dis, pas pour ce que tu écris dans le dépôt.** Messages
de commit, entrées de `journal/`, `README` et corps de PR gardent toute leur précision
technique : leur lecteur est un développeur ou un agent. **Et entre agents, on écrit en
télégraphique** — des champs, des symboles, un vocabulaire fermé, aucune phrase de
politesse ; missions et rendus ont un format, dans `memory/travail.md`.

## Un choix qui revient à l'utilisateur se montre

**Ne pose pas en prose un choix qui a une forme visible** — mise en page, parcours, écran,
place d'une information. Fabrique **deux ou trois maquettes** avec `frontend-design`, ou
`impeccable` quand le rendu doit être abouti : HTML autonome, contenu plausible plutôt que
texte bouché, variantes assez différentes pour que le choix en soit un. Publie-les en
artefact — à défaut, une capture par variante — et demande laquelle il retient.

**Un choix sans forme visible s'illustre quand même** — un palier, une technologie, un
arbitrage de périmètre ont des **conséquences** qui se montrent : une page de comparaison,
une option par colonne, la conséquence en clair, jamais le mécanisme. Quand rien ne se
montre honnêtement, pose la question en prose.

**Les maquettes sont jetables, la décision ne l'est pas** : ce qui a été retenu **et ce qui
a été écarté** s'écrit dans le `PRODUCT.md` de l'app ou dans son PRP.

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
./init.sh --help   # les autres options, et les sept métiers de scripts/
```

`apps/<nom>/app.yml` est la source de vérité, **jamais réécrit par `init.sh`** : tu l'édites
à la main, puis tu relances `./init.sh`.

## Ajouter une application

**Construire d'abord, brancher ensuite** : un premier commit fait publier l'image, un second
seulement fait entrer l'app dans le compose — d'où sa naissance en `enabled: false`. Le
commit 1 emporte **les artefacts régénérés**, sinon la CI est rouge pour tout le monde.
Détail : `memory/ajouter-une-app.md`.

## Les trois sortes de services — une seule est routée

`compose.yaml` porte l'app, ses annexes `<app>-<nom>` et les `shared_services`, dans un
espace de noms **plat**. **Seule l'app est joignable depuis Internet** ; les deux autres
portent `traefik.enable=false`, et c'est ce label — non l'absence de label — qui les en
retire. Détail : `memory/services.md`.

## Les volumes nommés

Ce qui doit survivre au redéploiement vit dans un **volume nommé**, jamais dans le système
de fichiers du conteneur, et le `Dockerfile` `chown` son chemin avant `USER`.

## Comment on travaille : branche, puis commits par étapes

Une branche s'ouvre dès la **première** modification, nommée `<app>/<sujet>` — ou
`fabrique/<sujet>` pour `init.sh`, `fabrique.yml`, la CI, le contrat ou l'outillage.

```bash
./scripts/branche.sh cadran/fuseaux-multiples
./scripts/pret.sh     # avant CHAQUE commit : branche, contrat, tests, revue
```

**Sur une branche `claude/<sujet>`, assignée par le harnais cloud**, le préfixe ne dit rien
du périmètre : le rayon de souffle se lit dans le champ `Périmètre` de l'entrée de journal,
et nulle part ailleurs. Renseigne-le tôt.

**Un commit par étape vérifiée**, pas un commit au kilomètre. On pousse à chaque commit ;
**la pull request vient à la fin**, une fois l'ensemble cohérent. Le raisonnement détaillé
va dans les **messages de commit**, où il survit à la fusion.

La revue bloque. Ses seuils vivent dans l'`app.yml` de chaque app et **ne se déplacent que
dans le sens qui serre**. **Chaque constat de sécurité reçoit un verdict** : corrigé, ou
écarté par un `// #nosec Gxxx -- <raison>` qui dit *ce qui* neutralise la teinte — « faux
positif » n'est pas une raison. Détail : `memory/revue.md`.

**Avant la pull request, deux relecteurs passent une fois** : `relecteur` sur le code, et
`esthete` sur les écrans quand ils ont bougé ; rien ne part avec des écrans plus récents
que sa critique datée.

**Le code d'une app se délègue à `artisan`, l'enregistrement git au `greffier`** — pas à toi
directement. Toi, tu écris ce qui est partagé (`.claude/`, `scripts/`, `fabrique.yml`,
`init.sh`) et ce qui demande un dialogue déjà eu avec l'utilisateur (PRD, PRP).

**Le premier poste de la facture est la LONGUEUR d'une session d'agent**, et son coût
croît en **carré** : elle fait N tours, dont chacun repaie ce que les N-1 précédents ont
lu. Un chantier tient **sous 60 tours** — `pret.sh` avertit au-delà. Couper veut dire deux
sessions de moitié, la seconde repartant du PRP, jamais de l'exploration de la première.

**Quand tu annonces que la session est trop longue, ton message se TERMINE par le prompt
de reprise** — un bloc à copier tel quel dans une session neuve, rien après lui. Annoncer
la coupe sans le fournir laisse la reconstitution du contexte à celle qui n'en a aucun.
Gabarit : `memory/travail.md`.

**Tes appels indépendants à toi partent dans le MÊME tour** — deux lectures groupées
coûtent moitié moins que séparées. La règle s'arrête là : chez un agent, un tour *est* un
appel d'outil et ne se groupe pas. Ce qui peut tourner en même temps est recensé dans
`docs/parallelisme.md` ; un gain ne se déclare pas, il se chiffre : `./docs/banc/mesurer.sh`.

**Ce que la branche a coûté se relève avec `./scripts/cout.sh`**, qui l'écrit dans son
entrée de journal. Non relevé avant la fusion, il est perdu.

**Par défaut on te consulte** ; `/livrer` t'envoie seul jusqu'à la mise en ligne vérifiée,
trois gestes irréversibles exceptés ; `/pas-a-pas` t'en sort. Journal, garde-fous, agents,
modes et protocole d'échange : `memory/travail.md`.

## Ce que le PRD dit reste vrai, ou il ment

Un ajout qui ne vient d'aucun PRP est normal ; qu'il ne soit écrit nulle part ne l'est pas.
**Une capacité neuve** se déclare dans une section « Ajouté après les PRP » du `PRODUCT.md`,
**dans le même commit que le code**.

## Ton outillage

`.claude/settings.json` est un fichier ordinaire, **versionné** : tout clone repart avec le
même outillage. **Jamais de bloc `env`** dedans : il est public par construction. Déclarer
un plugin ne l'installe pas — détail et rattrapage : `memory/outillage.md`.

## Les trois paliers d'exposition

`exposure`, dans l'`app.yml`, décide qui atteint l'app ; Traefik l'applique avant que la
requête ne parvienne au conteneur.

- **`private`** *(défaut)* — uniquement les comptes de la liste blanche du serveur. Pour
  toute administration, infra, shell, ou donnée personnelle.
- **`google`** — n'importe quel compte Google authentifié. Pour une app qui ne touche que
  des API tierces ou du contenu non sensible, ou dont les données sont cloisonnées par
  utilisateur.
- **`public`** — tout le monde, sans authentification. Pour des gens qui n'ont pas de
  compte, et rien de sensible côté serveur.

**Si tu hésites entre deux paliers, prends le plus fermé** : `private` se desserre en une
ligne, l'inverse a déjà exposé les données. Détail : `memory/exposition.md`.

## Règles impératives

Un `Dockerfile` par app dans `apps/<nom>/`, multi-étapes, image **< 200 Mo**, tournant en
**utilisateur non root**. **Aucun port publié**, **aucun secret**, **aucun `LABEL
traefik.*`**, les logs sur la sortie standard, et l'app démarre sans intervention.

## Ce qui ne t'appartient pas

Une base, un cache, un volume, un service annexe **t'appartiennent désormais** : déclare-les
dans un manifeste plutôt que de les demander dans un `README`. Seule exception, les
**valeurs** des secrets : tu écris le nom dans `env:` et dans ton `README`, l'infrastructure
injecte la valeur. Détail : `memory/perimetre.md`.

## Avant de pousser

```bash
./init.sh --check     # les avertissements ne bloquent pas, les KO si
```

Le même contrôle tourne en CI, en verrou de tous les autres jobs. **Le déploiement ne part
pas à chaque fusion** : il est sauté tant qu'aucune image d'app ni `compose.yaml` n'a changé.
Ce qu'il recrée et les deux réglages serveur qui en dépendent sont au `README`, avec
`./scripts/prod.sh`, qui regarde la production en lecture seule.

## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier — **à la demande, jamais importé
automatiquement**.

| Sujet | Fichier | Quand le lire |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Champs de `app.yml` | `memory/app-yml.md` | avant de créer ou modifier un `app.yml` |
| Trois sortes de services | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
| Journal, garde-fous, agents, modes, protocole | `memory/travail.md` | avant de remplir le journal, d'ouvrir une PR ou de lancer un agent |
| Ajouter une application | `memory/ajouter-une-app.md` | avant `--add`, et avant chacun de ses deux commits |
| Le PRD suit l'app | `memory/produit.md` | avant d'écrire un PRD, avant de livrer un ajout que nul PRP ne prévoyait |
| Outillage, plugins, LSP, compétences | `memory/outillage.md` | quand un plugin ou un LSP manque, avant d'écrire une compétence, avant d'ouvrir une session cloud |
| Paliers d'exposition, détail | `memory/exposition.md` | avant de changer une `exposure` ou de lire une identité |
| Règles impératives, détail | `memory/regles-imperatives.md` | avant d'écrire un `Dockerfile` ou un `test.sh` |
| Ce qui ne t'appartient pas, détail | `memory/perimetre.md` | avant de demander dans un README ce qui se déclare |
| La revue outillée, détail | `memory/revue.md` | avant d'instruire un constat, de déplacer un seuil, d'ajouter un axe |
