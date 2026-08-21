# Gagner du temps : ce qui peut tourner en même temps

Quand lire : avant d'entreprendre d'accélérer la chaîne de développement, et au
moment de conduire une branche qui touche plusieurs apps. Le banc qui chiffre
les gains est dans [banc/README.md](banc/README.md) ; les relevés successifs
dans [banc/releves.md](banc/releves.md).

## Deux horloges, et elles ne s'optimisent pas au même endroit

La fabrique consomme deux ressources sans rapport : des **jetons** (la facture)
et du **temps d'horloge** (l'attente). Une optimisation peut gagner l'une et ne
rien faire à l'autre.

Le dépôt en a déjà payé la démonstration, écrite dans
`journal/2026-08-18-claude-ci-optimization-sfl4f5.md` : accélérer `test-pret.sh`,
`test-cout.sh` et `test-jetons.sh` — « 125 s cumulées, le travail le plus
minutieux de la branche » — n'a **rien** rapporté sur l'horloge, parce qu'aucun
de ces scripts n'était sur le chemin critique. Ça a rapporté des minutes
facturées, ce qui n'est pas rien, mais ce n'est pas ce qu'on croyait acheter.

**Donc : nomme l'horloge que tu vises avant de toucher quoi que ce soit.** Les
gisements ci-dessous portent chacun sa mention.

## La règle zéro : mesurer d'abord, et remesurer après

Le graphe de CI a doublé de largeur le 2026-08-20 — dix shards de `revue`, dix
de `bout-en-bout` — et **aucun chronomètre n'est repassé depuis**. Les seules
durées de CI que porte le dépôt datent du 2026-08-18 et valent pour neuf apps et
deux matrices. Elles ne décrivent plus la chaîne d'aujourd'hui.

**Mesuré le 2026-08-21, et la réponse n'était aucune des deux hypothèses.** On
soupçonnait `contrat → test → build → deploy` ou `contrat → bout-en-bout →
deploy` ; le chemin critique est en réalité **la chaîne de l'outillage**,
`test-init.sh` en tête — 3 min 13 s sur un run de 3 min 50 s. Les dix apps,
leurs tests, leurs revues, leurs suites en navigateur et leurs dix images
tiennent toutes à l'intérieur de ce seul script. **Le prochain gain de CI est
là, et nulle part ailleurs.** Relevé : [banc/releves.md](banc/releves.md).

C'est la démonstration de la règle : les deux gisements de CI listés plus bas
sont réels et valent leur correction pour la facture de runners, mais aucun des
deux ne raccourcira l'attente tant que `test-init.sh` tiendra le chemin. Sans la
mesure, on aurait passé la journée du bon côté du problème — c'est exactement
l'accident du 18 août, à l'identique.

**Traité le 2026-08-21.** Le harnais est parfaitement parallèle — 97 %
d'efficacité mesurée — donc le seul levier était de réduire le travail. La
lecture des manifestes lançait cinq processus par valeur lue, mille cent fois
par vérification ; elle n'en lance plus aucun. La vérification passe de 13,2 s à
7,6 s, le harnais de 131,9 s à 66,3 s, sortie identique octet à octet. Le même
gain vaut pour `pret.sh` et pour le job `contrat`, qui appellent la même
vérification.

Ce que la mesure a écarté mérite d'être retenu autant que ce qu'elle a trouvé :
la boucle qui parcourt 30 000 lignes de documents en bash pur avait l'air du
coupable évident. Elle coûte 0,4 s.

Le banc existe pour ça. Un gain n'est déclaré que si la nouvelle médiane sort de
l'intervalle `[min – max]` de la mesure de référence.

## Étage 1 — la session : le gisement le plus rentable, et il est gratuit

**Horloge visée : les deux.** C'est le seul gisement qui gagne sur les jetons
*et* sur l'attente, sans modifier une ligne du dépôt.

Un tour de conversation paie **tout le contexte relu**, quelle que soit sa
sortie. Deux lectures indépendantes coûtent donc moitié moins groupées dans un
même tour que séparées en deux. Ce que les relevés de `cout.sh` montrent, branche
par branche :

| Branche | Tours | dont moins de 300 jetons rendus | Part de la facture |
|---|---:|---:|---:|
| `gym-pilate-app-prd` | 1 317 | **1 152 (87 %)** | 128 $ sur 138 $ |
| `renaissance-gym` | 2 563 | 1 996 (77 %) | 179 $ sur 283 $ |
| `ramure-v2-doc-review` | 1 868 | 1 453 (77 %) | 98 $ sur 139 $ |
| `dev-chain-code-reviews` | 1 202 | 814 (67 %) | 50 $ sur 98 $ |

Sur `renaissance-gym`, grouper par deux les seuls tours courts **indépendants**
retirerait de l'ordre de **mille allers-retours** de latence à la branche.

**Le mécanisme est une habitude, pas un réglage** : aucun garde-fou ne la tient,
`cout.sh` se contente de compter après coup. Et c'est le poste que le plan
d'amélioration à seize gestes ne vise nulle part.

**Le piège** : une fausse indépendance. Grouper une lecture dont le chemin sort
du `grep` qui la précède produit un tour perdu — l'inverse du gain. Deux éditions
du même fichier ne se groupent pas non plus.

**Le second gisement du même étage : remplir les attentes.** L'intégration prend
quelques minutes, le déploiement deux à trois de plus, et `/livrer` les passe à
boucler sur `Monitor` sans rien faire. Or le relevé de coût, l'entrée de journal
et le corps de la pull request n'ont aucune dépendance sur le verdict de la CI.
`renaissance-gym` a coûté douze pull requests et sept déploiements pour une seule
app : autant d'attentes vides. Réserve honnête : un bloc de coût écrit avant la
fin fige un chiffre en retard, et un corps de PR écrit pendant une CI qui vire au
rouge est à réécrire.

**Le troisième : poser les questions ensemble.** Les trois arrêts de `/livrer`
— `exposure` desserrée, données effacées, débordement sur le partagé — se lisent
tous dans `app.yml` et dans le périmètre de la branche **avant** la première
ligne de code. Posés à l'ouverture, en un tour, ils cessent d'interrompre au
milieu. Même chose pour les maquettes : toutes les variantes de tous les écrans
en une passe, une seule question. C'est le seul gisement qui agisse sur la
latence **humaine**, la plus longue de toutes.

## Étage 2 — la chaîne locale : mesuré, un facteur 2,2

**Horloge visée : le temps d'horloge du développeur.**

**Appliqué.** `./scripts/revue.sh` lance désormais une app par processus,
`nproc` en vol, dès qu'il a plus d'une cible. Mesuré au banc : **55,0 s
[53,3 – 55,9] avant, 26,9 s [26,8 – 27,3] après**, intervalles disjoints, soit
×2,05 — et `pret.sh` en hérite sans rien changer. `REVUE_PARALLELE=1` rend la
série, et sert de témoin au banc. Relevé : [banc/releves.md](banc/releves.md).

**Pourquoi un processus par app et pas un sous-shell.** `revue.sh` fait `cd`
dans le répertoire de l'app *dans le shell principal*, et `bad()` incrémente une
variable globale `FAILED`. Un sous-shell perd le compteur : les KO s'affichent en
rouge et le script sort en 0 — le « vert silencieux » que la fabrique passe son
temps à interdire. Un processus séparé n'a pas ce défaut : son `cd` lui est
propre et son verdict est son code de retour, que `xargs` propage.

Les autres gisements de cet étage, par rentabilité décroissante :

| Gisement | Gain | Ce qui bloque, et le verrou à poser |
|---|---|---|
| Les douze artefacts de `check_artefacts` régénérés en parallèle | ~6 s sur **chaque** `--check`, donc chaque `pret.sh` **et** chaque job de CI (mesuré : `--check` = 13,2 s, dont 8,5 s de régénération) | rien : `emit` est pur et n'écrit que sur stdout. Réafficher dans l'ordre figé, recompter `FAILED` chez le père |
| `pret.sh` : contrat ∥ tests ∥ relevé de coût | ~13 s + les tests ramenés au plus lent au lieu de leur somme | `/tmp/.pret-test.$$` porte **le même nom à chaque itération** : un `&` naïf mélange les sorties et efface le fichier du voisin |
| Mutualiser `prepare.sh` entre `test.sh` et `revue.sh` | 20 à 60 s par `pret.sh` touchant `ramure-v2` — `npm ci` y reconstruit 98 Mo **deux fois** pour un résultat identique | `flock` obligatoire : `npm ci` efface `node_modules` avant de le recréer, une lecture concurrente y voit un arbre à moitié absent |
| Les cinq axes d'une même app en parallèle | ~2,5× sur le cas le plus fréquent (une seule app touchée) | le plus risqué : `VERDICT`/`MESSAGE`/`DETAIL` sont des globales posées par chaque `axe_*`. À sérialiser dans des fichiers et à rendre après jointure |

**Deux amorçages obligatoires avant tout fan-out** : les trois `go install` de
`outil()` et le cache `npx` de `jscpd`. Sans eux, dix processus installent le
même binaire en même temps, et l'axe duplication rend « aucun rapport produit »
— un KO qui ne dit rien du code.

**Le plafond est `nproc`, et il est dur.** Quatre cœurs ici. `gosec`,
`staticcheck` et `go test -race` chargent chacun le graphe complet d'un module :
au-delà, on passe du temps gagné au temps perdu en mémoire, et un OOM rend un
« gosec a échoué (code 137) », donc encore un faux KO. Ne jamais multiplier un
`-P` par app par un `-P` par axe.

## Étage 3 — la CI : une attente inutile, et des caches manquants

**Horloge visée : le temps d'horloge, et la facture de runners — en sens
inverse l'une de l'autre.** Élargir une matrice raccourcit l'attente et alourdit
la facture : trente-cinq runners pendant le plus long job coûtent plus que quatre
runners pendant la somme.

1. **`build` attendait `test` sans raison — coupé le 2026-08-21.** Rien dans
   `build` ne consomme quoi que ce soit produit par `test` ; la dépendance est politique — « ne pas publier
   l'image d'une app dont les tests tombent ». Or `deploy` porte déjà cette
   garantie, plus finement, en testant `needs.test.result` un par un. Une image
   publiée sans test vert n'atteint jamais la production : `deploy` ne tourne
   pas, donc rien n'est épinglé, donc dockhand ne voit rien. Le seul effet
   résiduel serait un tag mutable `:main` déplacé — et **`compose.yaml` n'en
   référence plus aucun**, les dix apps sont épinglées par SHA. C'était la seule
   arête du graphe qui enchaînait deux matrices de dix.

   **Ce qu'il reste à surveiller** : la pointe de jobs simultanés monte d'une
   dizaine. Le plafond de jobs concurrents du compte GitHub n'est écrit nulle
   part dans le dépôt — au premier run après ce changement, comparer la durée du
   **run** et non celle des jobs : c'est là, et seulement là, qu'une file
   saturée se voit.
2. **Le cache de la revue ne couvre pas ses propres binaires.** `revue.sh` pose
   ses outils dans `.revue-outils/<toolchain>/`, que le workflow ne met dans
   aucun `path:` de cache. Trois `go install` sont donc refaits dans **chacun**
   des dix shards, à chaque exécution. La clé du cache porte déjà l'empreinte de
   `fabrique.yml`, où vivent les quatre versions d'outils : elle change
   exactement quand les binaires doivent être refaits. Un chemin à ajouter.
3. **Le job `test` n'a aucun cache du tout.** Ni modules Go, ni cache de build,
   ni npm. Huit shards sur dix compilent de zéro à chaque exécution — et ce job
   est en amont de `build`.
4. **Le job `bout-en-bout` ne cache que le navigateur**, pas les paquets : dix
   `npm install` intégralement repayés, et un `--with-deps` qui réinstalle des
   bibliothèques système qu'`actions/cache` ne capture pas.

**Un plafond à vérifier avant d'élargir quoi que ce soit** : la pointe est
aujourd'hui d'environ trente-cinq jobs simultanés, et passerait à quarante-cinq
en coupant l'arête `build ← test`. Le plafond de jobs concurrents du compte
GitHub n'est écrit nulle part dans le dépôt. S'il est en dessous, le parallélisme
théorique n'existe pas : l'attente se déplace du graphe vers la file, où elle
est invisible dans la durée des jobs et n'apparaît que dans celle du run.

## Étage 4 — les agents : possible, déjà fait, et pas encore outillé

**Horloge visée : le temps d'horloge.**

Les paires qui tiennent sans réserve : `analyste` avec n'importe qui (il ne lit
que `journal/`), et `relecteur` avec `analyste`. Les deux n'ont aucun outil
d'écriture.

**`relecteur` et `esthete` peuvent tourner ensemble**, sous une condition. Leurs
corpus sont disjoints par construction — l'un cherche sur le code ce
qu'aucun outil ne voit, l'autre regarde les écrans dans un vrai navigateur. Mais
l'esthète **corrige** ce qui est objectif, donc il bouge le diff que le relecteur
est en train de lire. Parade : lui interdire de corriger avant que le relecteur
ait rendu. Gain : la plus longue des deux passes au lieu de leur somme, sur le
seul point de la branche où l'utilisateur attend sans que rien d'autre avance.

Correction de doctrine issue de ce constat, **depuis appliquée** dans
`memory/travail.md` : l'innocuité du `greffier` y était fondée sur « l'absence
d'outil d'édition », alors qu'il fait `git add -A` par `Bash`. L'invariant réel
n'est pas qu'il n'édite pas, c'est qu'il n'édite pas de **code** — ça suffit
contre une lecture concurrente, pas contre une écriture. Et l'`esthete` a `Edit`
et `Write` : par la règle du dépôt, il est dans la case de l'artisan, pas dans
celle du relecteur. Les deux points sont écrits au contrat aujourd'hui.

**Deux artisans sur deux apps différentes** : ce n'est pas interdit, c'est déjà
arrivé — trois artisans en parallèle sur `cadran`, `ramure` et `pilabelle`, et
une spec qui le pose en principe : « sept apps indépendantes, un artisan par app,
aucun état partagé ». Ce qui l'empêche aujourd'hui tient en cinq verrous, dont un
seul est l'arbre de travail :

1. le hook `Stop` refuse de terminer un tour sur un arbre sale, et l'artisan
   salit l'arbre — interblocage documenté, résolu la dernière fois en abandonnant
   le parallélisme ;
2. `git add -A` du greffier : aucun chemin pour committer l'app A sans emporter
   l'app B à moitié écrite ;
3. `go.work`, artefact généré, dont la valeur est le **maximum** des directives
   `go:` des apps — une app qui monte de version fait cesser au serveur de
   langage de charger les paquets de **toutes** les autres ;
4. `compose.yaml`, généré lui aussi, une seule stack atomique ;
5. `.revue-outils/` sans verrou : deux `pret.sh` concurrents s'y marchent dessus.

Un arbre de travail par app lève 1, 2 et 5. Restent 3 et 4, qui sont des
**artefacts régénérés** par `./init.sh` : ils se reconstruisent en un geste à la
convergence, ils ne se fusionnent pas à la main.

Deux faits à connaître avant de rouvrir le sujet. Le dépôt a **déjà écarté les
worktrees** le 2026-08-05 — mais au motif qu'ils « ne protègent de rien » en
matière d'**isolation de contexte**, ce qui ne tranche pas la question de la
**concurrence d'écriture**. Et `run_in_background: false` **n'est pas une
garantie** : deux entrées de journal rapportent le harnais démarrant en fond un
artisan lancé avec le drapeau explicite. « Jamais en fond » est une consigne à
l'appelant, pas une propriété de l'agent.

## Ce qu'il ne faut pas paralléliser

Une seule stack, un seul `docker compose up`, atomique : une erreur dans le bloc
d'une app fait échouer le déploiement de toutes les autres.

- **`deploy` avec lui-même** — `cancel-in-progress: false` sur `main` est
  délibéré : un déploiement engagé doit finir, quitte à faire la queue. Le passer
  à `true` pour gagner du temps gagne une stack à moitié déployée.
- **`contrat`** — `init.sh --check` relit le dépôt **entier** à chaque
  exécution, sans égard à la liste des apps touchées, et c'est ce qui rattrape un
  générateur devenu plus sévère. Treize secondes, indivisible, pour verrouiller
  quatre matrices : le rapport est écrasant.
- **La livraison conteneur par conteneur chez dockhand** — elle touche l'hôte de
  production. Le gain se compte en secondes, l'échec se compte en apps.
- **Le rendez-vous `deploy`** — ses sept `needs` doublés d'un test de `result`
  un par un sont la seule chose qui rende sûre la coupure d'arêtes proposée plus
  haut. Chaque `needs` retiré ailleurs doit rester présent **ici**.
- **Faire consommer à `bout-en-bout` l'image publiée par `build`**, pour éviter
  la double construction de l'image d'`ardoise` : ça rétablirait une arête
  matrice → matrice, celle-là même qu'on cherche à supprimer. Mieux vaut payer une
  construction en double que rallonger le graphe.

## Le mode d'échec commun : le vert silencieux

Tous les pièges de cette page se ressemblent. Paralléliser sans y penser ne
produit pas une erreur : ça produit un contrôle qui **passe** sans avoir rien
vérifié.

- `bad()` appelé dans un sous-shell s'affiche en rouge et n'est **pas compté** :
  le script sort en 0 avec des KO à l'écran.
- `wait` sans argument rend 0 même si un job a échoué. `wait "$p" || rc=$?`,
  explicitement — et sous `set -e`, un `wait "$p"` nu tue le père avant qu'il
  affiche ce qu'il fallait corriger.
- `trap 'rm -rf "$TRAVAIL"' EXIT` détruit les rapports que les enfants sont
  **en train** d'écrire, et les laisse orphelins.
- Deux `npm ci` concurrents sur la même app laissent `web/dist` partiel : la
  compilation échoue et l'axe qualité rend « le code ne compile pas ». Un faux KO
  reproductible seulement sous charge apprend à relancer, pas à lire.
- Le cliquet `serre()` réécrit tout `app.yml` par `sed -i` : deux écrivains
  simultanés en perdent une clé — et une clé perdue **desserre** la barre sans
  laisser de ligne dans le diff, le contraire exact de ce que le cliquet promet.

C'est le mode d'échec que le dépôt a déjà nommé ailleurs : « un contrôle de
sécurité qui échoue en ouvert est pire que pas de contrôle : il rassure ».
