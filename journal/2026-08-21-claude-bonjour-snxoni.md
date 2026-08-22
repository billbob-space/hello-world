# 2026-08-21 — claude/bonjour-snxoni

Branche : `claude/bonjour-snxoni`
Périmètre : fabrique
Mode : `chaud`

Compactage de `CLAUDE.md` avec la compétence `compact-claude-md` : 271 → 222 lignes,
2 418 → 1 823 mots, soit ~1 100 jetons de moins à chaque tour de chaque session.

Le tri a été vérifié contre le dépôt plutôt qu'à vue : `./init.sh --help` pour ce qui
était déjà découvrable, les deux hooks et les en-têtes `Tenu par` de `memory/` pour ce
qui était déjà tenu par un contrôle, et les 364 anomalies des 53 entrées de journal pour
savoir quelles règles avaient déjà servi. Ce dernier point a changé deux verdicts :
« déléguer à `artisan` » (69 mentions) et « grouper les appels d'outils » (30 mentions)
ressemblaient à des évidences, le journal dit qu'elles récidivent — gardées.

L'essentiel du gain vient des justifications (`DROP-HISTORY`) et des sections recopiées
du contrat alors que le sommaire de `memory/` y renvoie déjà. Aucun garde-fou n'est
parti : les 24 termes impératifs du contrat sont présents avant et après.

## Anomalies

### 1. Le contrat a dépassé son propre budget pendant plusieurs branches sans que rien ne l'arrête

**Symptome** — `./init.sh --check` affichait « CLAUDE.md 271 lignes, au-dela de 250 »
à chaque passage, sur une branche puis la suivante. Le contrat a continué de grossir :
l'avertissement était rendu à chaque fois, et à chaque fois rien n'en découlait.

**Cause** — le contrôle est un `warn` et non un `bad`, choix délibéré et commenté dans
`init.sh` (« un contrat a 260 lignes n'est pas un defaut de deploiement »). Le
raisonnement est juste sur le déploiement, mais il laisse le seul signal de dérive dans
un flot d'une centaine de lignes vertes, où il se lit comme du décor. La dérive que le
garde-fou devait rendre visible est redevenue invisible parce qu'il ne bloque pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — arbitrage rendu par l'utilisateur : ne pas rendre le contrôle
bloquant, mais faire remonter les avertissements. `warn()` les accumule désormais dans
`lib/socle.sh`, et `rappel_attn()` les réimprime juste avant le verdict de `--check` et
de `pret.sh`. Le verdict ne change pas — un avertissement ne bloque toujours pas — mais
il n'y a plus de fin de sortie où la dérive puisse se cacher. Le premier passage a fait
remonter **13** avertissements, dont trois que personne n'avait jamais mentionnés. Un
test le tient : `rappelle()` dans `test-init.sh`, vérifié en cassant le rappel exprès.

Une limite trouvée en le posant : le rappel ne couvre que **son** processus. `pret.sh`
délègue à `init.sh --check`, `cout.sh --rappel` et `revue.sh` comme à des processus
séparés — frontière délibérée, documentée en tête de `pret.sh` — donc leurs
avertissements meurent chez eux. Le premier jet annonçait « 1 avertissement » sous deux
lignes `attn`, ce qui se lisait comme un compte faux. L'en-tête nomme désormais le
script dont il rend compte, plutôt que de franchir une frontière posée pour de bonnes
raisons.

### 2. Le gain d'un compactage annoncé en lignes, mesuré en mots : l'annonce était fausse de 40 %

**Symptome** — le tri annonçait « 271 lignes → ~160 ». Le premier passage, qui appliquait
pourtant tous les verdicts annoncés sans exception, a rendu 232 lignes. Un second passage
a été nécessaire pour approcher la promesse, et elle n'a jamais été tenue : 222.

**Cause** — l'estimation a été faite en comptant les lignes que les verdicts allaient
retirer, comme si une ligne supprimée était une ligne de moins. Elle ne l'est pas : le
fichier est en Markdown replié à ~90 colonnes, donc retirer une justification de vingt
mots au milieu d'un paragraphe reflue les lignes suivantes et n'en supprime souvent
qu'une seule ; et ~40 % du fichier est structurel — titres de section, lignes vides,
tables — que le tri ne touche jamais. Le nombre de lignes n'est pas proportionnel à ce
qui est effectivement retiré.

**Detecte par** — `auteur`

**Action** — `comportement` — annoncer un compactage en mots ou en jetons, jamais en
lignes : ce sont les seules unités qui varient avec ce qu'on supprime réellement. Les
lignes ne servent qu'à parler au budget de `--check`, qui compte en lignes lui aussi.

### 3. Un commentaire d'`init.sh` nomme deux artefacts dérivés qui ne le sont plus

**Symptome** — en vérifiant la ligne du contrat qui énumère les artefacts générés, le
commentaire d'en-tête d'`init.sh` la contredit : il annonce « compose.yaml, le workflow,
.claude/, go.work » comme TOUJOURS réécrits, quand `CLAUDE.md` dit du workflow et de
`.claude/` qu'ils sont ordinaires.

**Cause** — `liste_derives()` ne rend que `compose.yaml`, `go.work` et les notices
`apps/*/CLAUDE.md` : c'est le contrat qui dit juste, et le commentaire qui a survécu au
retrait du workflow et de `.claude/` de la génération. Aucun contrôle ne relit les
commentaires, et celui-ci est en tête du fichier que lit quiconque veut comprendre la
génération — il fait croire qu'éditer `.github/workflows/build.yml` à la main serait
écrasé au prochain `./init.sh`, donc inutile.

**Detecte par** — `auteur`

**Action** — `rien` — corrigé dans la foulée, sur la même branche.

### 4. Le contrôle du corps de PR ne peut pas être satisfait sans pousser un commit

**Symptome** — le job `contrat` a échoué sur « la ligne « Code » de la section
« ## Revue » est vide ou sans date ». La ligne a été corrigée dans le corps de la pull
request, et rien ne s'est relancé : le job est resté rouge sur un reproche auquel le
texte affiché sur la PR ne correspondait plus.

**Cause** — deux choses se combinent. Le contrôle lit le corps dans la charge utile de
l'événement (`CORPS: ${{ github.event.pull_request.body }}`,
`.github/workflows/build.yml:61`), et le déclencheur `on: pull_request` est déclaré sans
`types:`, ce qui vaut `[opened, synchronize, reopened]` — `edited` n'en fait pas partie.
Modifier le corps ne déclenche donc aucun run, et relancer le job échoué rejouerait la
charge utile d'origine, donc l'ancien corps. Le seul événement qui fait relire le corps
à jour est `synchronize`, c'est-à-dire un commit poussé. Un contrôle qui porte sur un
texte éditable hors de git ne peut être re-vérifié qu'en modifiant git : la seule issue
mécanique est le commit vide, que le dépôt interdit par ailleurs et à juste titre.

**Detecte par** — `CI`

**Action** — `garde-fou` — arbitrage rendu par l'utilisateur : les deux à la fois, sans
le coût. `edited` entre dans les `types:` du déclencheur, et le job `detect` — qui
commande toute la chaîne en aval — saute sur cet événement, si bien qu'une retouche de
description ne relance que le job `contrat`, quelques secondes. Deux pièges refermés au
passage : `tests-de-l-outillage` juge le résultat de `detect` et devait sauter avec lui,
sans quoi il aurait refusé un « sauté » que personne n'a décidé ; et les runs `edited`
reçoivent leur propre voie de concurrence, sans quoi retoucher la description pendant
une vérification l'aurait **annulée** et remplacée par un run qui ne relit que le
corps — le code serait passé au vert sans avoir été vérifié.

## Seconde manche — les 13 avertissements que le rappel avait sortis de l'ombre

La première manche a été fusionnée (PR #160). Le rappel des avertissements y faisait
remonter 13 lignes que personne ne lisait plus. L'utilisateur a demandé de les traiter.
Le tri est brutal : **6 des 13 étaient un garde-fou cassé**, 4 sont de vrais défauts,
3 ne sont pas réparables et n'ont jamais prétendu l'être.

### 5. Le contrôle des tests cités ne regardait que la racine de l'app, et criait à tort six fois sur sept

**Symptome** — `--check` déclarait introuvables les sept tests que le `PRODUCT.md` de
`ramure-v2` cite dans son tableau de risques. Six d'entre eux existent : vérifiés un par
un, `TestCascadeBasculeSurErreur` est dans `internal/source/cascade_test.go`,
`TestBudgetRespecteSurUnChargementComplet` dans `internal/arbre/centre_test.go`, et
ainsi de suite. Seul `TestCadragePlusEtroitSurEcranEtroit` manque réellement.

**Cause** — deux défauts dans le même contrôle, et ils se cachaient l'un l'autre.

Le premier : `tests=$(ls "$d"*_test.go "$d"tests/*.test.js)` ne listait que la **racine**
de l'app. Or les tests d'une app Go vivent à côté du paquet qu'ils couvrent, sous
`internal/` — c'est la disposition normale, pas une exception. Toute app Go structurée
en paquets voyait donc l'ensemble de ses tests cités déclarés absents.

Le second, inverse et plus discret : `grep -F` sur le nom nu trouvait aussi une mention
en **commentaire**. Un test promis par le PRD et seulement évoqué par un `// TODO:
écrire TestX` passait pour écrit — le garde-fou validait exactement ce qu'il était censé
attraper.

Le premier défaut noyait le second : avec six faux positifs sur sept, plus personne ne
lisait la ligne, et le seul test réellement absent s'y perdait. C'est le mode d'échec
d'un garde-fou qui crie à tort — il n'est pas ignoré par négligence, il est ignoré
**parce qu'il a tort**.

**Detecte par** — `auteur`

**Action** — `garde-fou` — recherche récursive (`grep -r` avec `--include`, en écartant
`node_modules`), et forme exigée plutôt que mention : une déclaration `func <nom>(` pour
Go, un nom entre guillemets pour JavaScript. Le nom cité est échappé avant de servir de
motif, sans quoi une cellule contenant `.` ou `*` ferait correspondre n'importe quoi et
un test absent passerait pour présent — le sens où l'erreur ne se voit pas. Deux tests
le tiennent : un test sous `internal/` doit être trouvé, un test seulement mentionné en
commentaire ne doit pas compter. Vérifiés en re-cassant le contrôle exprès.

**Consequence** — 13 avertissements → 7.

**Le reste des 13, et ce qu'il en advient.**

**Trois ne sont pas des défauts et ne partiront jamais.** Deux apps en palier `public`
(`marcq-handball`, `renaissance-gym`) : `memory/exposition.md` demande explicitement un
avertissement sur *tout* palier public, c'est un rappel permanent et voulu. Et huit
relevés de coût sans détail par tour : le commentaire d'`init.sh` le dit lui-même, le
bloc de détail est arrivé après ces huit entrées et les conversations qui les ont
produites ont disparu avec leurs conteneurs — « il n'y a rien à réparer, seulement à
savoir ».

**Quatre sont de vrais défauts d'application**, traités app par app dans la suite de
cette entrée : la règle globale `[hidden]` manquante sur `marcq-handball`, `pilabelle`
et `renaissance-gym`, et le test `TestCadragePlusEtroitSurEcranEtroit` que le PRD de
`ramure-v2` promet sans qu'il existe.

### 6. L'interblocage artisan / hook `Stop`, deux fois sur cette branche, drapeau explicite compris

**Symptome** — deux fois de suite, le hook `Stop` a refusé de terminer le tour sur
« 1 fichier(s) non committé(s) » alors que le fichier en question était en cours
d'écriture par un artisan lancé quelques secondes plus tôt. Committer aurait capturé
un demi-fichier ; ne rien faire était refusé.

**Cause** — c'est le verrou n° 1 de `docs/parallelisme.md`, mot pour mot : « le hook
`Stop` refuse de terminer un tour sur un arbre sale, et l'artisan salit l'arbre —
interblocage documenté, résolu la dernière fois en abandonnant le parallélisme ». Sauf
qu'ici il n'y a **aucun parallélisme** : un seul artisan, lancé avec
`run_in_background: false`. Le harnais l'a mis au fond quand même — exactement ce que
la même page annonce deux paragraphes plus bas (« `run_in_background: false` n'est pas
une garantie ; deux entrées de journal rapportent le harnais démarrant en fond un
artisan lancé avec le drapeau explicite »). Ces deux occurrences portent le compte à
quatre au moins.

La sortie existe et le hook la donne lui-même : « Si ce travail ne doit délibérément
pas être committé, dis-le explicitement. » Dire pourquoi débloque le tour sans rien
committer. C'est la bonne réponse, mais elle demande de connaître à la fois le verrou
et sa porte de sortie — un agent qui ne les connaît pas committera un fichier à moitié
écrit, ce que le garde-fou cherchait précisément à empêcher.

**Detecte par** — `auteur`

**Action** — `arbitrage` — trois issues, et le choix n'appartient pas à celui qui code.
Faire que le hook `Stop` ignore un arbre sali pendant qu'un sous-agent tourne demande
au hook de connaître l'état du harnais, qu'il ne voit pas. Attendre l'artisan avant de
rendre la main suppose que le drapeau soit tenu, ce qu'il n'est pas. Renoncer à
l'artisan pour les changements d'une ligne contredit le contrat. Aucune n'est
gratuite ; les trois se défendent.

**Le travail d'application, app par app.** Trois artisans lancés l'un après l'autre —
jamais en parallèle, les cinq verrous de `docs/parallelisme.md` étant toujours en place.

`marcq-handball` portait un correctif classe par classe (`.nav-app[hidden]`), retiré au
profit de la règle globale. `renaissance-gym` en portait **deux**, chacun avec son
symptôme écrit dans le commentaire — « une barre grise vide traîne au bas de l'écran »,
« "Remettre à zéro" restait affiché sur les exercices qui se comptent » : le même défaut
rencontré et rustiné deux fois sur place, ce que l'avertissement désigne exactement en
disant que le remède est une seule règle globale.

`pilabelle` est le cas honnête à écrire : **l'avertissement y était une heuristique
large**. Ses deux seuls usages de `hidden` portent la classe `.erreur` sur un `<p>`, et
ni `p` ni `.erreur` ne déclarent `display` — rien n'était concrètement affecté. Le
contrôle se déclenche dès qu'un usage de `.hidden` en JS coexiste avec *n'importe
quelle* règle de classe posant `display` dans le fichier, pas nécessairement sur
l'élément concerné. La règle reste bonne à poser — elle ferme la classe de défaut pour
tout élément futur — mais elle ne réparait aucun symptôme visible. Le dire évite qu'on
croie plus tard avoir corrigé un bug qui n'existait pas.

### 7. Une exigence de critique visuelle declenchee par un changement qui ne change rien a l'ecran

**Symptome** — la règle `[hidden]` touche `apps/<nom>/web/*.css` sur trois apps. La CI
exige alors une critique UX fraîche pour chacune, faute de quoi la pull request est
refusée. Trois esthètes ont donc tourné — environ une heure et demie cumulée, et
plusieurs centaines de milliers de jetons — pour un changement dont les trois mesures
de non-régression ont conclu qu'il ne modifie **rien** à l'écran.

**Cause** — le contrôle est une **coïncidence de diff**, et c'est délibéré : le
commentaire de `build.yml` explique que la première version comparait des horodatages et
ne pouvait jamais passer, puisqu'on écrit la critique avant de committer. Le diff, lui,
ne ment pas. Mais il ne sait pas non plus distinguer un changement visuel d'un
durcissement invisible : un `!important` défensif et une refonte de mise en page entrent
tous deux par la même porte.

**Ce que ça a quand même rapporté, et qui interdit de conclure trop vite.** Les trois
critiques ont trouvé, chacune, un défaut réel qu'aucun outil du dépôt ne voyait : sur
`marcq-handball`, le seul bouton du premier écran ne répondait rien sur un champ vide ;
sur `pilabelle`, deux messages de refus invisibles pour un lecteur d'écran ; sur
`renaissance-gym`, deux écrans sans issue, dont celui où une gymnaste arrivant sur un
autre téléphone n'a plus aucun repère. Un garde-fou qui déclenche « pour la mauvaise
raison » et rapporte à chaque fois n'est pas un garde-fou à supprimer.

**Detecte par** — `auteur`

**Action** — `arbitrage` — trois issues, et aucune n'est gratuite. Laisser tel quel : on
paie une critique complète pour toute ligne de CSS, y compris un correctif de robustesse.
Ajouter une porte de sortie explicite — une mention dans le message de commit qui déclare
le changement visuellement neutre — rouvre exactement le contournement que la
coïncidence de diff fermait. Restreindre le déclencheur aux fichiers de gabarit et aux
règles de mise en page, en laissant passer les règles globales, demande de décider ce
qui est « visuel » dans du CSS, ce qu'aucune heuristique ne fait bien.

**Cinq occurrences de l'interblocage du hook `Stop`, pas quatre.** L'anomalie 6 en
comptait deux, toutes deux avec l'artisan. Trois de plus se sont produites ensuite avec
l'**esthète**, qui écrit lui aussi. Cela confirme que le problème tient à la classe des
agents qui modifient le dépôt, et non à l'un d'eux : `memory/travail.md` le disait déjà
(« tous deux ne se lancent jamais en tâche de fond, pour la même raison »), la pratique
le vérifie cinq fois en une branche.

### 8. Le garde-fou repare rouvrait, par sa porte principale, le defaut qu'il fermait

**Symptome** — constat du relecteur sur cette branche. La correction de l'anomalie 5
exigeait « une déclaration `func`, **ou** un nom entre guillemets ». Or un nom entre
guillemets est la forme même sous laquelle un test s'écrit — donc celle sous laquelle il
est **commenté** quand on le désactive :

    // test('TestFileBornee', () => { ... })
    // t.Run("TestVerrouTenu", func(t *testing.T) {})

Les deux répondaient « présent ». Un test mis de côté pendant que le `PRODUCT.md`
continue de le citer serait resté vert.

**Cause** — j'ai fermé la porte que j'avais vue — la mention en prose, `// TODO: écrire
TestX` — et laissé grande ouverte celle qui compte. Le test que j'avais écrit pour m'en
assurer utilisait justement la forme sans guillemets, déjà rejetée **avant** la refonte :
il passait au vert sans rien exercer. Un test qui ne peut pas échouer donne une confiance
qui vaut moins que pas de test du tout, parce qu'on cesse de regarder.

Ce que j'aurais dû faire, et que j'ai fait pour la récursion mais pas pour la forme :
recasser le contrôle exprès et vérifier que le cas rougit. Appliqué à la moitié du
correctif seulement, le rite ne protège que cette moitié.

**Detecte par** — `relecture`

**Action** — `garde-fou` — deux exigences cumulées : un **contexte d'appel** avant le
guillemet (`test(`, `it(`, `describe(`, `t.Run(` — nul ne commente `test(` par accident)
et `^[^/]*`, qui interdit tout `/` avant la correspondance et écarte les lignes
commentées. Conservateur dans le bon sens : une ligne écartée à tort produit un
avertissement, jamais un silence. Deux cas de test remplacent celui qui ne prouvait rien,
un JS et un Go, tous deux sur la forme désactivée réelle — vérifiés en remettant la forme
d'avant : 56 réussis, 2 échecs, les deux bons.

**Deux correctifs d'esthète que rien ne tenait.** Le relecteur les a trouvés tous les
deux : le bouton muet de `marcq-handball` et le refus de forme de `renaissance-gym`
avaient été corrigés sans test. Comblés depuis, chacun avec sa preuve de rougissement —
correctif retiré, test rouge, fichier restauré. C'est le même défaut que l'anomalie 5
sous un autre jour : une promesse tenue par rien, sauf qu'ici la promesse venait d'être
écrite.

**Un brief faux, et un artisan qui ne l'a pas suivi.** J'affirmais que le refus de forme
de `renaissance-gym` mentionne le geste de sortie (« Retour »). Il ne le mentionne pas —
seul le refus serveur le fait. L'artisan a testé le message réel plutôt que celui que je
décrivais, et l'a dit. Sans ce réflexe, le test aurait figé une promesse que le code ne
tient pas, et le garde-fou aurait protégé une fiction. Reste une question ouverte, non
tranchée : faut-il ajouter « Retour » à ce refus, ou est-ce délibéré — une faute de
frappe se corrige seule, une reprise refusée par le serveur non ?

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 18:45 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 470 | 0,01 $ |
| Écriture de cache | 2 162 805 | 10,19 $ |
| Lecture de cache | 97 181 805 | 45,35 $ |
| Sortie | 213 930 | 4,44 $ |
| **Total** | **99 560 010** | **59,98 $ — 52,09 €** |

**Ce qui coûte**

- **732 appel(s) au modèle** — un par réponse, outils compris —, dont 467 par des sous-agents — 39 349 783 jetons, 22,27 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 219 jetons, écrits une fois par session puis relus à chaque
  échange : 18 009 816 jetons de relecture, 18 % de tout ce qui a été relu.
- **Tours courts** — 540 des 732 tours (73 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 35,86 $, soit 59 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 219 jetons relus au premier appel qui relise
  quelque chose, 439 198 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 99560010 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68219 0 183
2 principal claude-opus-5 4024 68219 511
3 principal claude-opus-5 1775 72243 438
4 principal claude-opus-5 9292 74018 762
5 principal claude-opus-5 3674 83310 521
6 principal claude-opus-5 3998 86984 657
7 principal claude-opus-5 2964 90982 1731
8 principal claude-opus-5 2748 93946 2317
9 principal claude-opus-5 4605 96694 4745
10 principal claude-opus-5 5918 101299 3018
11 principal claude-opus-5 155 110235 5652
12 principal claude-opus-5 5686 110390 5525
13 principal claude-opus-5 5561 116076 4569
14 principal claude-opus-5 4616 121637 976
15 principal claude-opus-5 2069 126253 374
16 principal claude-opus-5 833 128322 1059
17 principal claude-opus-5 1743 129155 221
18 principal claude-opus-5 514 130898 304
19 principal claude-opus-5 457 131412 265
20 principal claude-opus-5 2711 131869 3100
21 principal claude-opus-5 3130 134580 104
22 principal claude-opus-5 267 137710 358
23 principal claude-opus-5 605 137977 114
24 principal claude-opus-5 557 138582 1312
25 principal claude-opus-5 1372 139139 429
26 principal claude-opus-5 523 140511 109
27 principal claude-opus-4-7 3774 29200 134
28 principal claude-opus-4-7 242 32974 77
29 principal claude-opus-5 512 141034 177
30 principal claude-opus-5 637 141546 398
31 principal claude-opus-4-7 24339 33216 898
32 principal claude-opus-5 703 142183 185
33 principal claude-opus-5 1485 142886 2314
34 principal claude-opus-5 2379 144371 124
35 principal claude-opus-5 902 146750 99
36 principal claude-opus-5 1022 147652 137
37 principal claude-opus-5 1136 148674 466
38 principal claude-opus-5 550 149810 656
39 principal claude-opus-5 1006 150360 30
40 principal claude-opus-5 1165 151366 286
41 principal claude-opus-5 796 152531 160
42 principal claude-opus-5 3708 153327 1715
43 principal <synthetic> 0 0 0
44 principal claude-opus-5 114815 47678 30
45 principal claude-opus-5 854 162493 2863
46 principal claude-opus-5 3255 163347 229
47 principal claude-opus-5 2325 166602 854
48 principal claude-opus-5 940 168927 38
49 principal claude-opus-5 1482 169905 377
50 principal claude-opus-5 839 171387 1928
51 principal claude-opus-5 2121 172226 249
52 principal claude-opus-5 857 174347 650
53 principal claude-opus-5 996 175204 1795
54 principal claude-opus-5 2112 176200 742
55 principal claude-opus-5 894 178312 275
56 principal claude-opus-5 521 179206 263
57 principal claude-opus-5 351 179727 439
58 principal claude-opus-5 652 180078 451
59 principal claude-opus-5 7747 181181 30
60 principal claude-opus-5 860 188928 134
61 principal claude-opus-5 222 189788 259
62 principal claude-opus-5 1400 190010 210
63 principal claude-opus-5 1824 191410 799
64 principal claude-opus-5 7747 194033 30
65 principal claude-opus-5 858 201780 207
66 principal claude-opus-5 2561 202638 639
67 principal claude-opus-5 850 205199 42
68 principal claude-opus-5 6649 206091 271
69 principal claude-opus-5 1885 212740 424
70 principal claude-opus-5 31 215049 2109
71 principal claude-opus-5 4596 215080 1602
72 principal claude-opus-5 2106 219676 509
73 principal claude-opus-5 797 221782 217
74 principal claude-opus-5 2195 222579 1889
75 principal claude-opus-5 3366 224774 1942
76 principal claude-opus-5 2005 228140 682
77 principal claude-opus-5 749 230145 108
78 principal claude-opus-5 1171 230894 2007
79 principal claude-opus-5 2057 232065 128
80 principal claude-opus-5 1556 234122 619
81 principal claude-opus-5 917 235678 341
82 principal claude-opus-5 549 236595 266
83 principal claude-opus-5 328 237144 544
84 principal claude-opus-5 778 237472 178
85 principal claude-opus-5 866 238250 686
86 principal claude-opus-5 1684 239116 1164
87 principal claude-opus-5 1666 240800 110
88 principal claude-opus-5 352 242466 1454
89 principal claude-opus-5 1509 242818 250
90 principal claude-opus-5 336 244327 628
91 principal claude-opus-5 790 244663 2250
92 principal claude-opus-5 2779 245453 461
93 principal claude-opus-5 497 248232 120
94 principal claude-opus-5 354 248729 652
95 principal claude-opus-5 1206 249083 964
96 principal claude-opus-5 2086 250289 2192
97 principal claude-opus-5 2335 252375 711
98 principal claude-opus-5 798 254710 307
99 principal claude-opus-5 409 255508 2142
100 principal claude-opus-4-7 7667 29200 100
101 principal claude-opus-5 2211 255917 272
102 principal claude-opus-4-7 183 36867 95
103 principal claude-opus-4-7 272 37050 84
104 principal claude-opus-4-7 0 36867 128
105 principal claude-opus-4-7 23172 37322 131
106 principal claude-opus-4-7 1049 36867 113
107 principal claude-opus-4-7 9740 60494 126
108 principal claude-opus-4-7 252 37916 77
109 principal claude-opus-4-7 1974 70234 122
110 principal claude-opus-4-7 160 38168 84
111 principal claude-opus-4-7 1210 72208 123
112 principal claude-opus-4-7 23172 38328 128
113 principal claude-opus-5 625 258128 2022
114 principal claude-opus-5 2414 258753 606
115 principal claude-opus-4-7 9818 61500 3397
116 principal claude-opus-4-7 3284 73418 3821
117 principal claude-opus-4-7 3450 71318 126
118 principal claude-opus-4-7 324 74768 81
119 principal claude-opus-4-7 9690 75092 400
120 principal claude-opus-4-7 3570 84782 214
121 principal claude-opus-4-7 1186 88352 231
122 principal claude-opus-4-7 1006 89538 181
123 principal claude-opus-5 1898 261773 1166
124 principal claude-opus-5 1228 263671 475
125 principal claude-opus-4-7 3889 29200 114
126 principal claude-opus-4-7 9785 33089 288
127 principal claude-opus-5 809 264899 2376
128 principal claude-opus-5 2441 265708 219
129 principal claude-opus-5 3745 268149 726
130 principal claude-opus-5 940 271894 417
131 principal claude-opus-5 349 273251 30
132 principal claude-opus-5 695 273600 376
133 principal claude-opus-5 3015 274295 523
134 principal claude-opus-5 1058 277310 251
135 principal claude-opus-5 742 278368 433
136 principal <synthetic> 0 0 0
137 principal claude-opus-5 286618 0 30
138 principal claude-opus-5 859 286618 465
139 principal claude-opus-5 530 287477 842
140 principal claude-opus-5 1055 288007 30
141 principal claude-opus-5 6970 289092 30
142 principal claude-opus-5 827 296062 249
143 principal claude-opus-5 2730 296889 325
144 principal claude-opus-5 6963 299944 30
145 principal claude-opus-5 1025 306907 375
146 principal claude-opus-5 1822 307932 409
147 principal claude-opus-5 2945 309754 92
148 principal claude-opus-5 845 312699 356
149 principal claude-opus-5 166 313900 1308
150 principal claude-opus-5 2336 314066 963
151 principal claude-opus-5 4334 316402 1064
152 principal claude-opus-5 2487 320736 1837
153 principal claude-opus-5 2789 323223 3936
154 principal claude-opus-5 4473 326012 573
155 principal claude-opus-5 1156 330485 109
156 principal claude-opus-5 883 331641 239
157 principal claude-opus-5 852 332524 1268
158 principal claude-opus-5 1314 333376 268
159 principal claude-opus-5 520 334690 856
160 principal claude-opus-5 1181 335210 1347
161 principal claude-opus-5 3300 336391 790
162 principal claude-opus-5 1281 339691 114
163 principal claude-opus-5 911 340972 1040
164 principal claude-opus-5 1205 341883 2217
165 principal claude-opus-5 2589 343088 178
166 principal claude-opus-5 424 345677 623
167 principal claude-opus-5 1086 346101 467
168 principal claude-opus-5 956 347187 301
169 principal claude-opus-5 352 348143 1139
170 principal claude-opus-5 1198 348495 1570
171 principal claude-opus-4-7 34839 0 3268
172 principal claude-opus-4-7 3416 34839 117
173 principal claude-opus-4-7 220 38255 122
174 principal claude-opus-4-7 2415 38475 162
175 principal claude-opus-4-7 2247 40890 996
176 principal claude-opus-4-7 1401 43137 122
177 principal claude-opus-4-7 769 44538 1179
178 principal claude-opus-5 2399 349693 1009
179 principal claude-opus-5 1128 352092 1031
180 principal claude-opus-5 1559 353220 599
181 principal claude-opus-5 863 354779 377
182 principal claude-opus-5 458 355642 629
183 principal claude-opus-5 2777 355642 184
184 principal claude-opus-5 275 358419 673
185 principal claude-opus-5 738 358694 1283
186 principal claude-opus-5 2359 359432 818
187 principal claude-opus-5 1153 361791 887
188 principal claude-opus-4-7 25077 29200 230
189 principal claude-opus-5 2346 362944 361
190 principal claude-opus-4-7 429 54277 295
191 principal claude-opus-4-7 16839 54706 278
192 principal claude-opus-4-7 11062 71545 176
193 principal claude-opus-5 1064 365290 1627
194 principal claude-opus-4-7 7906 82607 5310
195 principal claude-opus-5 2797 366354 621
196 principal claude-opus-5 885 369151 249
197 principal claude-opus-5 340 370036 274
198 principal claude-opus-5 2516 370036 382
199 principal claude-opus-5 1699 372552 480
200 principal claude-opus-5 885 374251 2458
201 principal claude-opus-4-7 4460 29200 318
202 principal claude-opus-5 2713 375136 1989
203 principal claude-opus-5 2051 377849 671
204 principal claude-opus-5 1025 379900 1161
205 principal claude-opus-5 1436 380925 2568
206 principal claude-opus-5 2960 382361 781
207 principal claude-opus-5 38 386102 532
208 principal claude-opus-5 801 386140 516
209 principal claude-opus-5 780 386941 237
210 principal claude-opus-5 344 387721 248
211 principal claude-opus-5 859 387721 505
212 principal claude-opus-5 3442 388580 249
213 principal claude-opus-5 377 392022 71
214 principal claude-opus-5 335 392399 125
215 principal claude-opus-5 597 392734 331
216 principal claude-opus-5 614 393331 718
217 principal claude-opus-5 2320 393945 912
218 principal claude-opus-5 1075 396265 891
219 principal claude-opus-4-7 5144 29200 330
220 principal claude-opus-4-7 556 34344 167
221 principal claude-opus-5 955 397340 1389
222 principal claude-opus-4-7 8447 34900 1258
223 principal claude-opus-5 1781 398295 278
224 principal claude-opus-5 477 400076 68
225 principal claude-opus-5 332 400553 262
226 principal claude-opus-5 562 400885 193
227 principal claude-opus-5 317 401447 126
228 principal claude-opus-5 2823 400885 282
229 principal claude-opus-5 460 403708 1189
230 principal claude-opus-4-7 6725 29200 309
231 principal claude-opus-4-7 535 35925 167
232 principal claude-opus-5 1315 404168 1432
233 principal claude-opus-4-7 5504 36460 828
234 principal claude-opus-5 1830 405483 273
235 principal claude-opus-5 468 407313 216
236 principal claude-opus-5 480 407781 70
237 principal claude-opus-5 2283 408261 280
238 principal claude-opus-5 457 410544 1339
239 principal claude-opus-4-7 6039 29200 344
240 principal claude-opus-4-7 573 35239 170
241 principal claude-opus-5 1532 411001 1764
242 principal claude-opus-4-7 14630 35812 2038
243 principal claude-opus-5 1821 412533 732
244 principal claude-opus-5 1239 414354 1778
245 principal claude-opus-5 2161 415593 256
246 principal claude-opus-5 4573 417754 2354
247 principal claude-opus-5 2557 422327 1292
248 principal claude-opus-5 1377 424884 254
249 principal claude-opus-5 444 426261 936
250 principal claude-opus-5 1143 426705 1223
251 principal claude-opus-4-7 5091 29200 220
252 principal claude-opus-4-7 342 34291 98
253 principal claude-opus-4-7 275 34633 122
254 principal claude-opus-5 1777 427848 1687
255 principal claude-opus-4-7 2254 34908 3462
256 principal claude-opus-4-7 3867 37162 122
257 principal claude-opus-4-7 1302 41029 1384
258 principal claude-opus-5 2079 429625 269
259 principal claude-opus-5 2223 431704 929
260 principal claude-opus-4-7 4097 29200 535
261 principal claude-opus-5 1213 433927 1218
262 principal claude-opus-5 1949 435140 269
263 principal claude-opus-5 2109 437089 1142
264 principal claude-opus-4-7 4433 29200 368
265 principal claude-opus-5 1292 439198 1606
266 agent claude-sonnet-5 6517 11464 3
267 agent claude-sonnet-5 23087 17981 2
268 agent claude-sonnet-5 2085 41068 2
269 agent claude-sonnet-5 1586 43153 2
270 agent claude-sonnet-5 535 44739 2
271 agent claude-sonnet-5 984 45274 6
272 agent claude-sonnet-5 662 46258 17
273 agent claude-sonnet-5 523 46920 2
274 agent claude-sonnet-5 1362 47443 2
275 agent claude-sonnet-5 1273 48805 1
276 agent claude-sonnet-5 302 50078 4
277 agent claude-sonnet-5 17814 0 3
278 agent claude-sonnet-5 3687 17814 5
279 agent claude-sonnet-5 2306 21501 3
280 agent claude-sonnet-5 2629 23807 3
281 agent claude-sonnet-5 633 26436 2
282 agent claude-sonnet-5 995 27069 7
283 agent claude-sonnet-5 1860 28064 4
284 agent claude-sonnet-5 1226 29924 5
285 agent claude-sonnet-5 425 31150 3
286 agent claude-sonnet-5 821 31575 5
287 agent claude-sonnet-5 731 32396 1
288 agent claude-sonnet-5 1205 33127 1
289 agent claude-sonnet-5 289 34332 2
290 agent claude-sonnet-5 6876 11464 5
291 agent claude-sonnet-5 4543 18340 5
292 agent claude-sonnet-5 5266 22883 6
293 agent claude-sonnet-5 1145 28149 5
294 agent claude-sonnet-5 962 29294 7
295 agent claude-sonnet-5 1530 30256 7
296 agent claude-sonnet-5 2657 31786 2
297 agent claude-sonnet-5 800 34443 3
298 agent claude-sonnet-5 1082 35243 4
299 agent claude-sonnet-5 5174 36325 2
300 agent claude-sonnet-5 2651 41499 2
301 agent claude-sonnet-5 1308 44150 2
302 agent claude-sonnet-5 1052 45458 2
303 agent claude-sonnet-5 251 46510 1
304 agent claude-sonnet-5 17916 0 4
305 agent claude-sonnet-5 4594 17916 4
306 agent claude-sonnet-5 2380 22510 5
307 agent claude-sonnet-5 471 24890 7
308 agent claude-sonnet-5 431 25361 20
309 agent claude-sonnet-5 1406 25792 5
310 agent claude-sonnet-5 1969 27198 7
311 agent claude-sonnet-5 1188 29167 8
312 agent claude-sonnet-5 4187 30355 3
313 agent claude-sonnet-5 1042 34542 2
314 agent claude-sonnet-5 2205 35584 3
315 agent claude-sonnet-5 244 37789 2
316 agent claude-sonnet-5 1101 38033 2
317 agent claude-sonnet-5 1042 39134 2
318 agent claude-sonnet-5 263 40176 2
319 agent claude-sonnet-5 157 40439 20
320 agent claude-sonnet-5 330 40596 20
321 agent claude-sonnet-5 664 40926 2
322 agent claude-sonnet-5 354 41590 20
323 agent claude-sonnet-5 222 41944 1
324 agent claude-opus-5 30716 0 1
325 agent claude-opus-5 4734 30716 7
326 agent claude-opus-5 2586 35450 2
327 agent claude-opus-5 4045 38036 2
328 agent claude-opus-5 3482 42081 3
329 agent claude-opus-5 1815 45563 3
330 agent claude-opus-5 1851 47378 3
331 agent claude-opus-5 872 49229 2
332 agent claude-opus-5 357 50101 4
333 agent claude-opus-5 681 50458 3
334 agent claude-opus-5 3113 51139 3
335 agent claude-opus-5 555 54252 17
336 agent claude-opus-5 236 54807 3
337 agent claude-opus-5 2759 55043 4
338 agent claude-opus-5 2370 57802 2
339 agent claude-opus-5 428 60172 17
340 agent claude-opus-5 277 60600 16
341 agent claude-opus-5 2101 60877 2
342 agent claude-opus-5 743 62978 2
343 agent claude-opus-5 1244 63721 3
344 agent claude-opus-5 1637 64965 20
345 agent claude-opus-5 1273 66602 17
346 agent claude-opus-5 1333 67875 3
347 agent claude-opus-5 1772 69208 4
348 agent claude-opus-5 1178 70980 3
349 agent claude-opus-5 689 72158 6
350 agent claude-opus-5 1607 72847 17
351 agent claude-opus-5 1391 74454 2
352 agent claude-opus-5 1822 75845 2
353 agent claude-opus-5 2315 77667 3
354 agent claude-opus-5 4278 79982 2
355 agent claude-opus-5 4451 84260 3
356 agent claude-opus-5 2149 88711 2
357 agent claude-opus-5 3165 90860 3
358 agent claude-opus-5 837 94025 20
359 agent claude-opus-5 2147 94862 2
360 agent claude-opus-5 1079 97009 20
361 agent claude-opus-5 469 98088 3
362 agent claude-opus-5 448 98557 20
363 agent claude-opus-5 315 99005 20
364 agent claude-opus-5 1756 99320 3
365 agent claude-opus-5 502 101076 20
366 agent claude-opus-5 761 101578 20
367 agent claude-opus-5 1592 102339 4
368 agent claude-opus-5 1437 103931 14
369 agent claude-opus-5 1349 105368 2
370 agent claude-opus-5 1165 106717 20
371 agent claude-opus-5 1441 107882 2
372 agent claude-opus-5 645 109323 20
373 agent claude-opus-5 1170 109968 2
374 agent claude-opus-5 3689 111138 5
375 agent claude-opus-5 927 114827 20
376 agent claude-opus-5 858 115754 3
377 agent claude-opus-5 2415 116612 3
378 agent claude-opus-5 4095 119027 3
379 agent claude-opus-5 2530 123122 3
380 agent claude-opus-5 1387 125652 5
381 agent claude-opus-5 2047 127039 3
382 agent claude-opus-5 690 129086 20
383 agent claude-opus-5 2540 129776 2
384 agent claude-opus-5 1753 132316 3
385 agent claude-opus-5 1575 134069 20
386 agent claude-opus-5 1836 135644 3
387 agent claude-opus-5 1914 137480 3
388 agent claude-opus-5 1002 139394 3
389 agent claude-opus-5 535 140396 3
390 agent claude-opus-5 1610 140931 2
391 agent claude-opus-5 1644 142541 4
392 agent claude-opus-5 2577 144185 2
393 agent claude-opus-5 2303 146762 3
394 agent claude-opus-5 764 149065 3
395 agent claude-opus-5 1852 149829 2
396 agent claude-opus-5 296 151681 21
397 agent claude-opus-5 642 151977 17
398 agent claude-opus-5 1492 152619 3
399 agent claude-opus-5 817 154111 20
400 agent claude-opus-5 585 154928 20
401 agent claude-opus-5 679 155513 2
402 agent claude-opus-5 482 156192 9
403 agent claude-opus-5 482 156674 195
404 agent claude-opus-5 231 157156 16
405 agent claude-opus-5 315 157387 20
406 agent claude-opus-5 1756 157702 3
407 agent claude-opus-5 796 159458 3
408 agent claude-opus-5 1205 160254 2
409 agent claude-opus-5 1724 161459 7
410 agent claude-opus-5 3941 163183 6
411 agent claude-opus-5 3809 167124 3
412 agent claude-opus-5 2414 170933 20
413 agent claude-opus-5 2335 173347 2
414 agent claude-opus-5 1372 175682 17
415 agent claude-opus-5 6473 177054 3
416 agent claude-opus-5 5277 183527 20
417 agent claude-opus-5 5997 188804 20
418 agent claude-opus-5 619 194801 2
419 agent claude-opus-5 383 195420 20
420 agent claude-opus-5 1070 195803 3
421 agent claude-opus-5 1522 196873 2
422 agent claude-opus-5 3839 198395 2
423 agent claude-opus-5 282 202234 16
424 agent claude-opus-5 429 202516 21
425 agent claude-opus-5 1142 202945 10
426 agent claude-opus-5 1773 204087 17
427 agent claude-opus-5 652 205860 16
428 agent claude-opus-5 1403 206512 3
429 agent claude-opus-5 1586 207915 14
430 agent claude-opus-5 1403 209501 6
431 agent claude-opus-5 924 210904 14
432 agent claude-opus-5 1023 211828 2
433 agent claude-opus-5 2306 212851 3
434 agent claude-opus-5 3274 215157 3
435 agent claude-opus-5 1621 218431 17
436 agent claude-opus-5 1288 220052 3
437 agent claude-opus-5 831 221340 4
438 agent claude-opus-5 490 222171 20
439 agent claude-opus-5 6862 222661 3
440 agent claude-opus-5 1494 229523 16
441 agent claude-opus-5 10505 231017 4
442 agent claude-opus-5 505 241522 17
443 agent claude-opus-5 334 242027 17
444 agent claude-opus-5 183 242361 17
445 agent claude-opus-5 217 242544 17
446 agent claude-opus-5 441 242761 20
447 agent claude-opus-5 322 243202 3
448 agent claude-opus-5 369 243524 2
449 agent claude-sonnet-5 16675 0 3
450 agent claude-sonnet-5 2015 16675 5
451 agent claude-sonnet-5 1217 18690 6
452 agent claude-sonnet-5 2890 19907 2
453 agent claude-sonnet-5 342 22797 2
454 agent claude-sonnet-5 5093 23139 4
455 agent claude-sonnet-5 2214 28232 7
456 agent claude-sonnet-5 637 30446 9
457 agent claude-sonnet-5 2630 31083 20
458 agent claude-sonnet-5 1200 33713 2
459 agent claude-sonnet-5 1318 34913 2
460 agent claude-sonnet-5 1153 36231 2
461 agent claude-sonnet-5 2444 37384 6
462 agent claude-sonnet-5 1038 39828 21
463 agent claude-sonnet-5 296 40866 16
464 agent claude-sonnet-5 3017 41162 2
465 agent claude-sonnet-5 1373 44179 5
466 agent claude-sonnet-5 3533 45552 6
467 agent claude-sonnet-5 410 49085 14
468 agent claude-sonnet-5 2696 49495 2
469 agent claude-sonnet-5 542 52191 8
470 agent claude-sonnet-5 1619 52733 3
471 agent claude-sonnet-5 2482 54352 6
472 agent claude-sonnet-5 691 56834 2
473 agent claude-sonnet-5 3688 57525 3
474 agent claude-sonnet-5 726 61213 3
475 agent claude-sonnet-5 535 61939 3
476 agent claude-sonnet-5 2050 62474 5
477 agent claude-sonnet-5 285 64524 20
478 agent claude-sonnet-5 3775 64809 2
479 agent claude-sonnet-5 3794 68584 2
480 agent claude-sonnet-5 1712 72378 3
481 agent claude-sonnet-5 891 74090 4
482 agent claude-sonnet-5 256 74981 20
483 agent claude-sonnet-5 495 75237 2
484 agent claude-sonnet-5 3116 75732 2
485 agent claude-sonnet-5 921 78848 20
486 agent claude-sonnet-5 470 79769 2
487 agent claude-sonnet-5 1540 80239 7
488 agent claude-sonnet-5 333 81779 5
489 agent claude-sonnet-5 372 82112 20
490 agent claude-sonnet-5 1502 82484 3
491 agent claude-sonnet-5 1443 83986 8
492 agent claude-sonnet-5 1180 85429 20
493 agent claude-sonnet-5 8558 86609 3
494 agent claude-sonnet-5 12265 95167 2
495 agent claude-sonnet-5 1947 107432 5
496 agent claude-sonnet-5 460 109379 21
497 agent claude-sonnet-5 6341 109839 4
498 agent claude-sonnet-5 435 116180 20
499 agent claude-sonnet-5 1274 116615 3
500 agent claude-sonnet-5 890 117889 3
501 agent claude-sonnet-5 444 118779 3
502 agent claude-sonnet-5 1807 119223 3
503 agent claude-sonnet-5 1500 121030 3
504 agent claude-sonnet-5 1506 122530 8
505 agent claude-sonnet-5 2873 124036 4
506 agent claude-sonnet-5 18004 0 2
507 agent claude-sonnet-5 4612 18004 4
508 agent claude-sonnet-5 4027 22616 3
509 agent claude-sonnet-5 1636 26643 2
510 agent claude-sonnet-5 2149 28279 2
511 agent claude-sonnet-5 1981 30428 3
512 agent claude-sonnet-5 1885 32409 3
513 agent claude-sonnet-5 728 34294 20
514 agent claude-sonnet-5 159 35022 2
515 agent claude-sonnet-5 500 35181 3
516 agent claude-sonnet-5 1043 35681 20
517 agent claude-sonnet-5 825 36724 2
518 agent claude-sonnet-5 712 37549 1
519 agent claude-sonnet-5 511 38261 2
520 agent claude-sonnet-5 588 38772 21
521 agent claude-sonnet-5 342 39360 20
522 agent claude-sonnet-5 1259 39702 2
523 agent claude-sonnet-5 2556 40961 2
524 agent claude-sonnet-5 723 43517 2
525 agent claude-sonnet-5 236 44240 1
526 agent claude-sonnet-5 6269 11464 4
527 agent claude-sonnet-5 4723 17733 2
528 agent claude-sonnet-5 10031 22456 4
529 agent claude-sonnet-5 671 32487 2
530 agent claude-sonnet-5 1044 33158 2
531 agent claude-sonnet-5 614 34202 3
532 agent claude-sonnet-5 341 34816 5
533 agent claude-sonnet-5 2619 35157 4
534 agent claude-sonnet-5 3738 37776 2
535 agent claude-sonnet-5 775 41514 2
536 agent claude-sonnet-5 733 42289 1
537 agent claude-sonnet-5 1088 43022 2
538 agent claude-sonnet-5 195 44110 3
539 agent claude-sonnet-5 930 44305 2
540 agent claude-sonnet-5 1808 45235 5
541 agent claude-sonnet-5 297 47043 20
542 agent claude-sonnet-5 447 47340 4
543 agent claude-sonnet-5 717 47787 1
544 agent claude-sonnet-5 497 48504 20
545 agent claude-sonnet-5 162 49001 2
546 agent claude-opus-5 30648 0 2
547 agent claude-opus-5 20638 30648 5
548 agent claude-opus-5 3792 51286 17
549 agent claude-opus-5 3872 55078 3
550 agent claude-opus-5 1473 58950 3
551 agent claude-opus-5 6038 60423 5
552 agent claude-opus-5 966 66461 2
553 agent claude-opus-5 2842 67427 2
554 agent claude-opus-5 811 70269 20
555 agent claude-opus-5 701 71080 3
556 agent claude-opus-5 1430 71781 2
557 agent claude-opus-5 382 73211 3
558 agent claude-opus-5 2404 73593 3
559 agent claude-opus-5 669 75997 2
560 agent claude-opus-5 4157 76666 4
561 agent claude-opus-5 605 80823 2
562 agent claude-opus-5 265 81428 16
563 agent claude-opus-5 218 81693 16
564 agent claude-opus-5 215 81911 3
565 agent claude-opus-5 364 82126 2
566 agent claude-opus-5 330 82490 17
567 agent claude-opus-5 2004 82820 17
568 agent claude-opus-5 862 84824 4
569 agent claude-opus-5 348 85686 20
570 agent claude-opus-5 512 86034 254
571 agent claude-opus-5 342 86546 16
572 agent claude-opus-5 781 86888 2
573 agent claude-opus-5 1385 87669 3
574 agent claude-opus-5 892 89054 2
575 agent claude-opus-5 521 89946 3
576 agent claude-opus-5 888 90467 3
577 agent claude-opus-5 2498 91355 7
578 agent claude-opus-5 2496 93853 3
579 agent claude-opus-5 2793 96349 20
580 agent claude-opus-5 1777 99142 3
581 agent claude-opus-5 2437 100919 2
582 agent claude-opus-5 3393 103356 2
583 agent claude-opus-5 553 106749 5
584 agent claude-opus-5 1343 107302 20
585 agent claude-opus-5 836 108645 2
586 agent claude-opus-5 1113 109481 20
587 agent claude-opus-5 667 110594 3
588 agent claude-opus-5 2131 111261 20
589 agent claude-opus-5 1728 113392 20
590 agent claude-opus-5 550 115120 20
591 agent claude-opus-5 365 115670 5
592 agent claude-opus-5 1084 116035 20
593 agent claude-opus-5 362 117119 2
594 agent claude-opus-5 356 117481 20
595 agent claude-opus-5 469 117837 16
596 agent claude-opus-5 353 118306 16
597 agent claude-opus-5 1216 118659 3
598 agent claude-opus-5 975 119875 2
599 agent claude-opus-5 769 120850 20
600 agent claude-opus-5 305 121619 2
601 agent claude-opus-5 585 121924 3
602 agent claude-opus-5 8076 122509 3
603 agent claude-opus-5 467 130585 20
604 agent claude-opus-5 935 131052 2
605 agent claude-opus-5 558 131987 3
606 agent claude-opus-5 13289 17657 1
607 agent claude-opus-5 5154 30946 5
608 agent claude-opus-5 4560 36100 5
609 agent claude-opus-5 1261 40660 17
610 agent claude-opus-5 1453 41921 3
611 agent claude-opus-5 2316 43374 2
612 agent claude-opus-5 942 45690 17
613 agent claude-opus-5 3884 46632 3
614 agent claude-opus-5 4129 50516 3
615 agent claude-opus-5 361 54645 2
616 agent claude-opus-5 1121 55006 17
617 agent claude-opus-5 270 56127 6
618 agent claude-opus-5 256 56397 6
619 agent claude-opus-5 3151 56653 6
620 agent claude-opus-5 1951 59804 3
621 agent claude-opus-5 792 61755 4
622 agent claude-opus-5 7425 62547 3
623 agent claude-opus-5 1954 69972 3
624 agent claude-opus-5 2027 71926 3
625 agent claude-opus-5 747 73953 3
626 agent claude-opus-5 1600 74700 2
627 agent claude-opus-5 1748 76300 2
628 agent claude-opus-5 2647 78048 3
629 agent claude-opus-5 1644 80695 2
630 agent claude-opus-5 2209 82339 3
631 agent claude-opus-5 2205 84548 8
632 agent claude-opus-5 709 86753 3
633 agent claude-opus-5 1617 87462 3
634 agent claude-opus-5 1268 89079 2
635 agent claude-opus-5 690 90347 17
636 agent claude-opus-5 1568 91037 3
637 agent claude-opus-5 1942 92605 3
638 agent claude-opus-5 2917 94547 2
639 agent claude-opus-5 1888 97464 20
640 agent claude-opus-5 429 99352 8
641 agent claude-opus-5 989 99781 17
642 agent claude-opus-5 887 100770 2
643 agent claude-opus-5 1599 101657 3
644 agent claude-opus-5 1264 103256 17
645 agent claude-opus-5 463 104520 2
646 agent claude-opus-5 882 104983 20
647 agent claude-opus-5 420 105865 4
648 agent claude-opus-5 551 106285 20
649 agent claude-opus-5 673 106836 20
650 agent claude-opus-5 1102 107509 3
651 agent claude-opus-5 844 108611 20
652 agent claude-opus-5 921 109455 20
653 agent claude-opus-5 1146 110376 2
654 agent claude-opus-5 347 111522 20
655 agent claude-opus-5 605 111869 20
656 agent claude-opus-5 466 112474 20
657 agent claude-opus-5 2699 112940 3
658 agent claude-opus-5 1526 115639 20
659 agent claude-opus-5 1453 117165 3
660 agent claude-opus-5 701 118618 17
661 agent claude-opus-5 820 119319 3
662 agent claude-opus-5 1731 120139 2
663 agent claude-opus-5 7383 121870 2
664 agent claude-opus-5 397 129253 20
665 agent claude-opus-5 2055 129650 3
666 agent claude-opus-5 418 131705 16
667 agent claude-opus-5 331 132123 20
668 agent claude-opus-5 208 132454 2
669 agent claude-opus-5 583 132662 20
670 agent claude-opus-5 329 133245 2
671 agent claude-sonnet-5 16777 0 2
672 agent claude-sonnet-5 1905 16777 6
673 agent claude-sonnet-5 1409 18682 4
674 agent claude-sonnet-5 3383 20091 7
675 agent claude-sonnet-5 2998 23474 3
676 agent claude-sonnet-5 2149 26472 3
677 agent claude-sonnet-5 809 28621 2
678 agent claude-sonnet-5 3515 29430 5
679 agent claude-sonnet-5 627 32945 6
680 agent claude-sonnet-5 759 33572 2
681 agent claude-sonnet-5 462 34331 3
682 agent claude-sonnet-5 1340 34793 2
683 agent claude-sonnet-5 1238 36133 8
684 agent claude-sonnet-5 7230 37371 3
685 agent claude-sonnet-5 1048 44601 20
686 agent claude-sonnet-5 2686 45649 2
687 agent claude-sonnet-5 774 48335 3
688 agent claude-sonnet-5 335 49109 17
689 agent claude-sonnet-5 4485 49444 2
690 agent claude-sonnet-5 4433 53929 2
691 agent claude-sonnet-5 726 58362 2
692 agent claude-sonnet-5 588 59088 14
693 agent claude-sonnet-5 604 59676 9
694 agent claude-sonnet-5 869 60280 2
695 agent claude-sonnet-5 3799 61149 5
696 agent claude-sonnet-5 1043 64948 20
697 agent claude-sonnet-5 1420 65991 3
698 agent claude-sonnet-5 24286 67411 3
699 agent claude-sonnet-5 5681 91697 5
700 agent claude-sonnet-5 3248 97378 2
701 agent claude-sonnet-5 626 100626 3
702 agent claude-sonnet-5 747 101252 3
703 agent claude-sonnet-5 555 101999 8
704 agent claude-sonnet-5 562 102554 3
705 agent claude-sonnet-5 1852 103116 1
706 agent claude-sonnet-5 1309 104968 4
707 agent claude-sonnet-5 15927 0 3
708 agent claude-sonnet-5 1485 15927 2
709 agent claude-sonnet-5 8123 17412 5
710 agent claude-sonnet-5 4680 25535 2
711 agent claude-sonnet-5 1639 30215 6
712 agent claude-sonnet-5 2674 31854 3
713 agent claude-sonnet-5 699 34528 2
714 agent claude-sonnet-5 1269 35227 6
715 agent claude-sonnet-5 3768 36496 6
716 agent claude-sonnet-5 3805 40264 3
717 agent claude-sonnet-5 807 44069 7
718 agent claude-sonnet-5 595 44876 6
719 agent claude-sonnet-5 442 45471 3
720 agent claude-sonnet-5 585 45913 3
721 agent claude-sonnet-5 1316 46498 2
722 agent claude-sonnet-5 660 47814 7
723 agent claude-sonnet-5 348 48474 20
724 agent claude-sonnet-5 935 48822 5
725 agent claude-sonnet-5 438 49757 20
726 agent claude-sonnet-5 445 50195 7
727 agent claude-sonnet-5 429 50640 3
728 agent claude-sonnet-5 2462 51069 3
729 agent claude-sonnet-5 1282 53531 2
730 agent claude-sonnet-5 249 54813 2
731 agent claude-sonnet-5 432 55062 2
732 agent claude-sonnet-5 802 55494 5
-->
<!-- /cout -->
