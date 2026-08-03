# 2026-08-03 — claude/analyze-cleanup-merged-branches-12gta2

Branche : `claude/analyze-cleanup-merged-branches-12gta2`
Périmètre : hello-world — plus un constat d'outillage sur le nettoyage des branches

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
