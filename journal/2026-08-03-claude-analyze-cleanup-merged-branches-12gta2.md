# 2026-08-03 — claude/analyze-cleanup-merged-branches-12gta2

Branche : `claude/analyze-cleanup-merged-branches-12gta2`
Périmètre : hello-world — plus un constat d'outillage sur le nettoyage des branches
Mode : `chaud`

Demande initiale : analyser les branches et supprimer celles qui sont fusionnées.
La suppression s'est révélée impossible depuis une session cloud ; l'analyse a en
revanche exhumé une branche dont le travail était perdu de vue, et c'est ce que
cette branche rapatrie.

## Anomalies

### 1. Le harnais cloud interdit la suppression de branches distantes

**Symptôme** — `git push origin --delete <branche>` sort en échec avec
`HTTP 403` sur `git-receive-pack`, puis affiche `Everything up-to-date`. Douze
branches entièrement fusionnées restent en place.

**Cause** — le relais git de la session (`127.0.0.1:41729`) n'autorise que le
push sur la branche assignée ; la suppression de ref est refusée par la même
politique. Le serveur MCP GitHub n'expose pas non plus de `delete_branch` —
`create_branch` existe, son inverse non. Une session cloud peut donc ouvrir des
branches et jamais en fermer : les branches fusionnées s'accumulent sans que
rien ne le signale.

**Detecte par** — `auteur` — en tentant la suppression. Rien dans le contrat ne
laissait prévoir que ce geste serait indisponible.

**Action** — `contrat` — le contrat décrit l'ouverture d'une branche
(`--branche`) et sa fusion, jamais sa fin de vie. Il devrait dire que le
nettoyage n'est pas faisable depuis une session cloud, et à qui il revient. Un
`./init.sh --branches-fusionnees` qui *liste* sans supprimer rendrait le geste
outillable sans dépendre d'un droit que la session n'a pas.

### 2. J'ai annoncé douze suppressions qui n'avaient pas eu lieu

**Symptôme** — ma boucle affichait `supprime : <branche>` pour les douze
branches. Aucune n'avait été supprimée.

**Cause** — `if git push ... 2>&1 | tail -1; then` teste le code de sortie de
`tail`, pas celui de `git`. Dans un pipeline, le code retenu est celui de la
dernière commande, et `tail` réussit toujours. Le `Everything up-to-date` que
`git` écrit après l'échec a achevé de rendre la sortie plausible. Erreur de
raisonnement de ma part, pas défaut d'outil : j'ai construit la vérification de
façon à ce qu'elle ne puisse pas échouer.

**Detecte par** — `auteur` — en revérifiant par `git ls-remote`, par doute sur
le `Everything up-to-date` qui n'est pas la sortie attendue d'une suppression.

**Action** — `comportement` — ne jamais tirer un état d'une commande dont on
maquille la sortie par un pipe. L'état des refs distants se lit avec
`git ls-remote`, pas avec le code de sortie du push. Rectifié auprès de
l'utilisateur avant toute autre action.

### 3. Cinq commits de design étaient orphelins sans que rien ne l'indique

**Symptôme** — `claude/plugins-installed-available-xm5qvt` porte cinq commits
postérieurs à la fusion de sa PR #14 : la refonte du volet, `DESIGN.md`,
`.impeccable/design.json`, le mandataire de prévisualisation. Aucune PR ne les
couvre, et la branche paraissait « déjà fusionnée » puisque son numéro de PR
l'était.

**Cause** — le travail a continué sur la branche après la fusion de la PR. Rien
ne distingue, dans la liste des branches, celle dont la PR est fusionnée *et* le
contenu repris, de celle dont la PR est fusionnée et le contenu dépassé depuis.
`git branch --merged` répond faux dans les deux sens ici : il classe non
fusionnées trois branches squashées (PR #11, #12, #13) et ne dit rien de
l'écart réel.

**Detecte par** — `auteur` — en comparant commit par commit, après que
`git branch --merged` eut donné une réponse incohérente avec l'état des PR.

**Action** — `garde-fou` — le critère fiable est `git cherry` (équivalence de
patch) doublé d'une lecture des PR, pas l'appartenance à l'ascendance de `main`.
C'est ce que devrait faire l'outil de listage évoqué en anomalie 1 : sans lui,
un travail fini peut rester invisible indéfiniment sur une branche qu'on croit
close.

### 4. Le README de l'app décrivait une technique que la page n'emploie plus

**Symptôme** — `apps/hello-world/README.md` expliquait que « le treillis des
volets est peint en fond, en unités `ch`, derrière un simple champ de texte ».
La page rapatriée construit les volets comme des éléments réels, frères du champ
de texte.

**Cause** — la refonte a été faite sur la branche orpheline ; `main` a hérité de
la page d'avant et de sa description. Le texte est resté juste au moment où il a
été écrit, puis a cessé de l'être sans que rien ne le touche. Aucun test ne lie
la prose du README au fichier qu'elle décrit.

**Detecte par** — `auteur` — en relisant le README avant de porter le contenu,
et non en portant les fichiers, qui eux passaient les tests sans rien dire.

**Action** — `rien` — corrigé dans le même commit que le portage. Non
généralisable : vérifier qu'une prose décrit encore son fichier n'est pas
automatisable à un coût raisonnable, et les quatre invariants qui comptent
vraiment sont déjà verrouillés par `main_test.go`.

### 5. La branche `parallel-dev-versions` se déclare elle-même non fusionnable

**Symptôme** — huit commits jamais passés en PR, dont le message du commit de
tête porte « RESTE OUVERT, refonte en cours : le contrôle anti-secret par champ
est contournable par conception ». Le commit précédent porte
« ETAT INTERMEDIAIRE », et un autre « NE PAS FUSIONNER EN L'ETAT ».

**Cause** — la branche a été abandonnée au milieu d'une passe de correction, avec
un défaut de conception identifié et son remplacement non écrit. Elle porte par
ailleurs `docs/PRD-RAMURE.md`, strictement identique à
`apps/ramure/PRODUCT.md` déjà dans `main`, et deux PRP sur neuf que son propre
message déclare périmés.

**Detecte par** — `auteur` — à la lecture des messages de commit, qui ont fait
tout le travail d'analyse. C'est le seul endroit où cette information existait.

**Action** — `arbitrage` — cette branche n'est pas rapatriable en l'état et n'est
pas jetable sans décision : le travail sur `init.sh` (services annexes, volumes
nommés, `traefik.enable=false` sur les services non routés, contrôle anti-secret)
répond à des besoins réels et vaut d'être repris, mais `init.sh` a divergé de
+636 lignes côté `main` contre +1346 côté branche depuis la même base. Reprendre
signifie réécrire, pas fusionner. Question pour l'utilisateur : réécrire sur la
base actuelle, ou abandonner ?

### 6. J'ai chiffré un portage sans avoir lu l'étape que je proposais de modifier

**Symptôme** — j'ai annoncé le garde-fou de labels d'image comme « ~10 lignes
dans une étape existante, l'image est déjà construite et inspectable
localement ». En ouvrant l'étape : elle **tire l'image publiée** depuis le
registre et porte `if: github.event_name != 'pull_request'`. Sur une pull
request, aucune image n'existe dans le démon — `push: false` la laisse dans le
cache de buildx. Le contrôle tel que je le décrivais n'aurait rien gardé au
moment utile.

**Cause** — j'avais lu la ligne `docker image inspect` dans le workflow généré et
conclu que l'image était disponible, sans lire les deux lignes au-dessus. Un
`grep` qui trouve le mot attendu ressemble beaucoup à une vérification.

**Detecte par** — `auteur` — en ouvrant le fichier pour écrire le correctif,
c'est-à-dire une étape trop tard : l'estimation était déjà annoncée.

**Action** — `comportement` — ne pas chiffrer un changement à partir d'un `grep`.
Le coût réel s'est révélé plus élevé mais le correctif meilleur : `load:` sur les
pull requests fait entrer l'image dans le démon, et l'étape devient
inconditionnelle.

### 7. Aucun contrôle ne portait sur l'image construite avant la fusion

**Symptôme** — l'unique inspection d'image de la CI ne tournait qu'après fusion
sur `main`. Une image trop lourde n'était donc signalée qu'une fois publiée, et
un `LABEL traefik.*` hérité d'une image de base n'était vu **nulle part** :
`--check` lit le `Dockerfile`, où un label hérité n'apparaît pas.

**Cause** — la construction sur pull request a été conçue pour valider le
`Dockerfile` sans bouger le tag `:main`, ce qui est juste. Mais `push: false`
laisse l'image hors du démon, et personne n'a remarqué que cela retirait aussi
toute possibilité de l'inspecter. Le garde-fou existant — « aucun `LABEL
traefik.*` dans le Dockerfile » — donnait l'impression que le cas était couvert,
alors qu'il ne couvre que la moitié écrite à la main.

**Detecte par** — `auteur` — en analysant `claude/parallel-dev-versions-8d5g9c`,
dont un commit portait ce contrôle. Aucune app de la fabrique n'utilise
aujourd'hui d'image de base tierce, donc rien ne l'aurait révélé avant le premier
service annexe.

**Action** — `garde-fou` — corrigé : `load:` sur les pull requests, étape
d'inspection inconditionnelle, refus dur sur un label `traefik.*`, et le contrôle
de taille profite du même passage. Logique vérifiée sur trois cas simulés — image
saine, label hérité, aucun label — Docker n'étant pas disponible dans le
conteneur de développement.

### 8. Le critère que j'avais qualifié de fiable sous-déclare les branches supprimables

**Symptôme** — j'avais annoncé « 14 branches supprimables », dont
`claude/list-installed-plugins-ax5jk8` et
`claude/plugins-installed-available-xm5qvt`. `--branches-fusionnees`, qui
applique l'équivalence de patch — le critère que j'avais moi-même désigné comme
le bon — en classe 11 supprimables et renvoie ces deux-là dans la seconde
section.

**Cause** — l'équivalence de patch ne voit pas un contenu **réécrit**. `ax5jk8` a
été écrasée en un commit contre une base plus récente, donc son patch diffère de
celui de `main` ; `xm5qvt`, je l'ai portée moi-même sous `apps/hello-world/`,
donc à d'autres chemins — le contenu est octet pour octet dans `main`, le patch
non. Mes deux conclusions venaient d'une comparaison manuelle fichier par
fichier, pas du critère que j'ai ensuite recommandé comme s'il les couvrait.

**Detecte par** — `auteur` — en lançant la commande sur le dépôt réel, ce qui est
la seule raison de l'avoir écrite avant de la documenter.

**Action** — `contrat` — la limite est écrite là où elle se lit : la section
s'intitule `à regarder` et non `non fusionnées`, la commande dit pourquoi et
donne le `git log` de comparaison, et `CLAUDE.md` porte le même avertissement.
Aucun critère automatique ne tranche ce cas — un contenu réécrit n'est
reconnaissable qu'en le lisant. Une commande qui proposerait quand même la
suppression serait pire que celle qui s'abstient.

**Ce que cela change concrètement** — les 11 branches de la première section
partent sans discussion. `ax5jk8` et `xm5qvt` partent aussi, mais sur la foi des
vérifications manuelles consignées aux anomalies 3 et 5 de cette entrée, pas sur
celle de l'outil.

### 9. Ajouter `volumes:` rendait faux un `README` qui n'était pas dans le périmètre

**Symptôme** — `apps/ramure/README.md` affirmait « la fabrique n'offre ni base de
données ni volume persistant » et « c'est une décision d'infrastructure, elle se
prend côté serveur ». Les deux phrases deviennent fausses à la seconde où ce
commit entre dans `main`.

**Cause** — le contrat demande d'écrire dans le `README` ce que la fabrique ne
prévoit pas. C'est un bon mécanisme, mais il crée une dette invisible : une
demande satisfaite plus tard laisse derrière elle une prose qui affirme le
contraire, et rien ne relie les deux. Le périmètre annoncé de l'étape était « la
fabrique seulement » — j'ai failli m'y tenir littéralement et laisser le mensonge
en place.

**Detecte par** — `auteur` — en cherchant où la nouvelle capacité était réclamée,
pour vérifier qu'elle répondait bien à une demande réelle. C'est la même lecture
qui a montré que la demande allait cesser d'être vraie.

**Action** — `garde-fou` — corrigé ici, mais le mécanisme reste sans filet :
`--check` vérifie déjà qu'aucun lien entre documents n'est mort, il ne peut pas
vérifier qu'une affirmation est encore vraie. Piste concrète : une section
`Besoins d'infrastructure` pourrait porter un marqueur repris par `--check` avec
la liste des capacités de la fabrique, pour signaler qu'une demande porte sur
quelque chose qui existe désormais. Non fait — à arbitrer, le coût n'est pas
évident.

### 10. Le refus de collision de noms de volumes n'était branché nulle part

**Symptôme** — `check_volume_noms` était écrite, testée dans ma tête, et jamais
appelée. Le premier lancement l'a traversée sans rien vérifier.

**Cause** — j'ai écrit la fonction au moment où j'écrivais la validation, dans le
même mouvement, et je l'ai comptée comme faite. Une fonction définie ressemble
beaucoup à une fonction appelée quand on relit son propre diff.

**Detecte par** — `auteur` — en cherchant où la brancher pour la tester, pas en
la testant : le test serait passé au vert sans rien exécuter si je ne m'étais pas
posé la question du point d'appel.

**Action** — `rien` — branchée à deux endroits, et c'est le choix qui compte :
dans `--check`, et **avant l'écriture** dans la génération. Un compose où deux
apps partagent un volume est déjà écrit quand `--check` le dit. Vérifiée ensuite
sur une vraie collision fabriquée pour l'occasion (`cadran` + `x-y` contre
`cadran-x` + `y`), pas seulement sur le cas nominal.

### 11. Le garde-fou de labels que j'ai livré échouait en ouvert

**Symptôme** — dans `graves=$(docker image inspect … | grep -E '^traefik\.' ||
true)`, le `|| true` couvre le **pipeline entier**. Une inspection en échec —
image absente, tag mal formé, démon indisponible — rendait une liste vide,
indiscernable d'une image saine. L'étape annonçait « aucun label traefik.* » et
sortait en succès. Vérifié : la version fusionnée en #28 sort en 0 quand
`docker image inspect` échoue.

**Cause** — j'ai éprouvé le garde-fou sur trois cas — image saine, label hérité,
aucun label — c'est-à-dire trois cas où la commande **réussit**. Je n'ai jamais
posé la question « et si l'inspection elle-même échoue ? ». C'est le mode de
défaillance le plus banal d'un contrôle en CI, et le seul que mon jeu d'essais
ne couvrait pas.

**Detecte par** — `auteur` — mais il a fallu, pour le voir, lire le message de
commit d'une autre session sur `claude/parallel-dev-versions-8d5g9c`, qui
mentionnait « l'inspection des labels de l'image en CI n'échoue plus en ouvert ».
Sans cette phrase, rien ne l'aurait révélé : le contrôle est vert dans les deux
cas. La branche que je proposais de supprimer a rattrapé un défaut de la branche
que j'avais fait fusionner.

**Action** — `garde-fou` — corrigé : l'inspection est isolée du filtre, son échec
tombe sous `set -e`, et le `|| true` ne couvre plus que `grep`, dont le code 1
signifie « aucune correspondance ». **Un contrôle de sécurité qui échoue en
ouvert est pire que pas de contrôle : il rassure.** La règle générale à en tirer
est dans la cause, pas dans le correctif — tout jeu d'essais d'un garde-fou doit
comporter le cas où l'outil qu'il appelle ne répond pas.

### 12. Mon premier test du correctif a donné un faux négatif

**Symptôme** — après correction, le cas « inspection en échec » sortait encore en
0. J'ai failli conclure que le correctif ne marchait pas et le réécrire.

**Cause** — le harnais, pas le code. Je sourçais le script (`. ./t.sh`) dans un
sous-shell avec une fonction `docker` de substitution ; ce contexte ne reproduit
pas `set -e` comme le fait un `run:` de GitHub Actions. Rejoué avec un vrai
exécutable `docker` sur le `PATH` et `bash script.sh`, les quatre cas répondent
juste. C'est le même harnais que j'avais utilisé pour valider le garde-fou
initial — donc la raison pour laquelle l'anomalie 11 m'a échappé deux fois.

**Detecte par** — `auteur` — en refusant le premier résultat plutôt qu'en le
croyant, parce que le code corrigé était trop simple pour se tromper.

**Action** — `comportement` — un harnais qui ne reproduit pas le contexte
d'exécution réel ne prouve rien, dans les deux sens : il masque un défaut et il
en invente. Pour un `run:` de CI, la reproduction fidèle est un fichier lancé par
`bash`, avec les dépendances substituées **sur le `PATH`** et non par des
fonctions shell.

### 13. J'ai recommandé de supprimer une branche qui était en cours de travail

**Symptôme** — `claude/parallel-dev-versions-8d5g9c` portait 8 commits lors de
mon analyse, dont le dernier disait « RESTE OUVERT, refonte en cours ». J'en ai
conclu « abandonnée, inachevée, supprimable », et l'utilisateur a tranché sur
cette base. Elle en porte 9 aujourd'hui : le commit manquant est précisément la
refonte annoncée, poussée pendant que je travaillais.

**Cause** — j'ai lu « reste ouvert » comme un état final alors que c'était une
note d'étape. Une branche sans PR ressemble à une branche morte, mais rien ne
distingue l'abandon du travail en cours : c'est la même absence. Deux autres
branches inconnues de mon inventaire sont apparues dans le même intervalle.

**Detecte par** — `auteur` — en relançant `--branches-fusionnees` depuis le
`main` fusionné, qui a compté 9 patchs là où j'en avais annoncé 8. L'outil écrit
au commit précédent a rattrapé l'erreur d'analyse du commit d'avant.

**Action** — `arbitrage` — la décision de suppression prise pour cette branche
repose sur une prémisse devenue fausse ; elle est à reprendre par l'utilisateur,
pas par moi. Note de méthode : un inventaire de branches se périme en minutes
quand plusieurs sessions travaillent en parallèle, et aucune de mes analyses n'a
porté de date.
