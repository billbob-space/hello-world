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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 16:33 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 637 | 0,00 $ |
| Écriture de cache | 1 324 002 | 5,91 $ |
| Lecture de cache | 44 643 950 | 20,38 $ |
| Sortie | 163 224 | 3,48 $ |
| **Total** | **46 131 813** | **29,78 $ — 25,86 €** |

**Ce qui coûte**

- **322 appel(s) au modèle** — un par réponse, outils compris —, dont 120 par des sous-agents — 5 329 687 jetons, 2,67 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 219 jetons, écrits une fois par session puis relus à chaque
  échange : 13 712 019 jetons de relecture, 30 % de tout ce qui a été relu.
- **Tours courts** — 174 des 322 tours (54 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 12,18 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 219 jetons relus au premier appel qui relise
  quelque chose, 375 136 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 46131813 -->
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
203 agent claude-sonnet-5 6517 11464 3
204 agent claude-sonnet-5 23087 17981 2
205 agent claude-sonnet-5 2085 41068 2
206 agent claude-sonnet-5 1586 43153 2
207 agent claude-sonnet-5 535 44739 2
208 agent claude-sonnet-5 984 45274 6
209 agent claude-sonnet-5 662 46258 17
210 agent claude-sonnet-5 523 46920 2
211 agent claude-sonnet-5 1362 47443 2
212 agent claude-sonnet-5 1273 48805 1
213 agent claude-sonnet-5 302 50078 4
214 agent claude-sonnet-5 17814 0 3
215 agent claude-sonnet-5 3687 17814 5
216 agent claude-sonnet-5 2306 21501 3
217 agent claude-sonnet-5 2629 23807 3
218 agent claude-sonnet-5 633 26436 2
219 agent claude-sonnet-5 995 27069 7
220 agent claude-sonnet-5 1860 28064 4
221 agent claude-sonnet-5 1226 29924 5
222 agent claude-sonnet-5 425 31150 3
223 agent claude-sonnet-5 821 31575 5
224 agent claude-sonnet-5 731 32396 1
225 agent claude-sonnet-5 1205 33127 1
226 agent claude-sonnet-5 289 34332 2
227 agent claude-sonnet-5 6876 11464 5
228 agent claude-sonnet-5 4543 18340 5
229 agent claude-sonnet-5 5266 22883 6
230 agent claude-sonnet-5 1145 28149 5
231 agent claude-sonnet-5 962 29294 7
232 agent claude-sonnet-5 1530 30256 7
233 agent claude-sonnet-5 2657 31786 2
234 agent claude-sonnet-5 800 34443 3
235 agent claude-sonnet-5 1082 35243 4
236 agent claude-sonnet-5 5174 36325 2
237 agent claude-sonnet-5 2651 41499 2
238 agent claude-sonnet-5 1308 44150 2
239 agent claude-sonnet-5 1052 45458 2
240 agent claude-sonnet-5 251 46510 1
241 agent claude-sonnet-5 6269 11464 4
242 agent claude-sonnet-5 4723 17733 2
243 agent claude-sonnet-5 10031 22456 4
244 agent claude-sonnet-5 671 32487 2
245 agent claude-sonnet-5 1044 33158 2
246 agent claude-sonnet-5 614 34202 3
247 agent claude-sonnet-5 341 34816 5
248 agent claude-sonnet-5 2619 35157 4
249 agent claude-sonnet-5 3738 37776 2
250 agent claude-sonnet-5 775 41514 2
251 agent claude-sonnet-5 733 42289 1
252 agent claude-sonnet-5 1088 43022 2
253 agent claude-sonnet-5 195 44110 3
254 agent claude-sonnet-5 930 44305 2
255 agent claude-sonnet-5 1808 45235 5
256 agent claude-sonnet-5 297 47043 20
257 agent claude-sonnet-5 447 47340 4
258 agent claude-sonnet-5 717 47787 1
259 agent claude-sonnet-5 497 48504 20
260 agent claude-sonnet-5 162 49001 2
261 agent claude-sonnet-5 16777 0 2
262 agent claude-sonnet-5 1905 16777 6
263 agent claude-sonnet-5 1409 18682 4
264 agent claude-sonnet-5 3383 20091 7
265 agent claude-sonnet-5 2998 23474 3
266 agent claude-sonnet-5 2149 26472 3
267 agent claude-sonnet-5 809 28621 2
268 agent claude-sonnet-5 3515 29430 5
269 agent claude-sonnet-5 627 32945 6
270 agent claude-sonnet-5 759 33572 2
271 agent claude-sonnet-5 462 34331 3
272 agent claude-sonnet-5 1340 34793 2
273 agent claude-sonnet-5 1238 36133 8
274 agent claude-sonnet-5 7230 37371 3
275 agent claude-sonnet-5 1048 44601 20
276 agent claude-sonnet-5 2686 45649 2
277 agent claude-sonnet-5 774 48335 3
278 agent claude-sonnet-5 335 49109 17
279 agent claude-sonnet-5 4485 49444 2
280 agent claude-sonnet-5 4433 53929 2
281 agent claude-sonnet-5 726 58362 2
282 agent claude-sonnet-5 588 59088 14
283 agent claude-sonnet-5 604 59676 9
284 agent claude-sonnet-5 869 60280 2
285 agent claude-sonnet-5 3799 61149 5
286 agent claude-sonnet-5 1043 64948 20
287 agent claude-sonnet-5 1420 65991 3
288 agent claude-sonnet-5 24286 67411 3
289 agent claude-sonnet-5 5681 91697 5
290 agent claude-sonnet-5 3248 97378 2
291 agent claude-sonnet-5 626 100626 3
292 agent claude-sonnet-5 747 101252 3
293 agent claude-sonnet-5 555 101999 8
294 agent claude-sonnet-5 562 102554 3
295 agent claude-sonnet-5 1852 103116 1
296 agent claude-sonnet-5 1309 104968 4
297 agent claude-sonnet-5 15927 0 3
298 agent claude-sonnet-5 1485 15927 2
299 agent claude-sonnet-5 8123 17412 5
300 agent claude-sonnet-5 4680 25535 2
301 agent claude-sonnet-5 1639 30215 6
302 agent claude-sonnet-5 2674 31854 3
303 agent claude-sonnet-5 699 34528 2
304 agent claude-sonnet-5 1269 35227 6
305 agent claude-sonnet-5 3768 36496 6
306 agent claude-sonnet-5 3805 40264 3
307 agent claude-sonnet-5 807 44069 7
308 agent claude-sonnet-5 595 44876 6
309 agent claude-sonnet-5 442 45471 3
310 agent claude-sonnet-5 585 45913 3
311 agent claude-sonnet-5 1316 46498 2
312 agent claude-sonnet-5 660 47814 7
313 agent claude-sonnet-5 348 48474 20
314 agent claude-sonnet-5 935 48822 5
315 agent claude-sonnet-5 438 49757 20
316 agent claude-sonnet-5 445 50195 7
317 agent claude-sonnet-5 429 50640 3
318 agent claude-sonnet-5 2462 51069 3
319 agent claude-sonnet-5 1282 53531 2
320 agent claude-sonnet-5 249 54813 2
321 agent claude-sonnet-5 432 55062 2
322 agent claude-sonnet-5 802 55494 5
-->
<!-- /cout -->
