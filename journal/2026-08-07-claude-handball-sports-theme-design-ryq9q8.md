# 2026-08-07 — claude/handball-sports-theme-design-ryq9q8

Branche : `claude/handball-sports-theme-design-ryq9q8`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Un arc CSS invisible parce qu'il était trop grand, et pas trop petit

**Symptome** — la surface de but de l'écran du jour est dessinée par deux
pseudo-éléments circulaires centrés sur le bord haut du bandeau. Premier rendu :
rien. Aucune erreur, aucune règle ignorée, les deux éléments présents dans
l'inspecteur avec les bonnes dimensions.

**Cause** — erreur de raisonnement géométrique, pas erreur de CSS. Un cercle
centré au milieu du bord haut d'un bloc n'est visible dans ce bloc que si son
rayon est **inférieur** à la demi-largeur du bloc ; au-delà, la portion de
courbe qui traverse la hauteur du bloc passe entièrement à gauche et à droite de
ses bords. J'avais choisi `width: 260%` en pensant « plus large, donc plus
visible » — c'est l'inverse. La correction est arithmétique : l'arc entre dans
le cadre à l'ordonnée `h/2 × √(1 − (L/2 ÷ l/2)²)`, ce qui se calcule avant
d'écrire la règle.

**Detecte par** — `auteur`

**Action** — `comportement` — une géométrie CSS se vérifie sur une capture, pas
dans la tête. Le cycle « écrire, rendre, regarder » a coûté deux minutes ; le
raisonnement seul aurait conclu que la règle était juste.

### 2. Une apostrophe dans un commentaire casse la liste de la coque

**Symptome** — ajout de `/anton.woff2` à `COQUE` dans `web/sw.js`, précédé d'un
commentaire de deux lignes. `tests/coque.test.js` échoue avec
« affichage. Absente du cache, l est dans COQUE mais web/affichage. Absente du
cache, l n'existe pas » — un message qui ne nomme ni le fichier fautif ni la
cause.

**Cause** — `sw.js` n'est pas un module (l'importer exécuterait
`self.addEventListener`), donc le test lit la liste **dans le source**, au motif
`/'([^']+)'/g`. Toute apostrophe française à l'intérieur du bloc `COQUE` devient
une entrée de la liste. Le garde-fou a fait son travail — il a refusé en moins
d'une seconde — mais son diagnostic pointait vers un fichier manquant plutôt que
vers sa propre façon de lire.

**Detecte par** — `test`

**Action** — `rien` — réparé en retirant les apostrophes, et le commentaire posé
dans le bloc dit désormais pourquoi il n'en porte pas. Durcir le motif du test
pour ignorer les commentaires coûterait plus que ce que ça évite : la contrainte
est locale à quinze lignes et elle y est maintenant écrite.

### 3. Cent trente lignes de style pour un écran supprimé en juillet

**Symptome** — `web/style.css` ouvrait sur un jeu de jetons complet
(`--papier`, `--encre`, `--signal`, `--fait`), une variante `prefers-color-scheme:
dark` et cinq règles (`.attente`, `.sur-titre`, `.periode`, `.dit`, `.note`).
Aucune de ces classes n'est posée par un seul fichier de `web/` : elles
habillaient la page d'attente, remplacée par le routeur au PRP 03. Le second
jeu de jetons, `--marcq-*`, écrasait le premier trente lignes plus bas.

**Cause** — les tests vérifient que **toute classe posée par une vue existe dans
`style.css`**. Le contrôle ne vaut que dans ce sens ; une règle dont plus
personne n'est l'auteur n'a rien qui la signale. Elle survit d'autant mieux
qu'elle est en tête de fichier, là où on croit lire le socle.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'inverse du contrôle existant se calcule sur les
mêmes données : une classe de `style.css` qu'aucune vue ne pose. Il faudrait une
liste d'exceptions pour les classes d'état composées à l'exécution, ce qui en
fait un avertissement et non un refus.

### 4. La barre d'onglets débordait de l'écran depuis le PRP 05, et aucun test ne pouvait le voir

**Symptome** — sur un téléphone de 390 px, « Réglages » était coupé au bord
droit : « Ma progression » passait sur deux lignes et poussait le quatrième
onglet hors du cadre. Défaut présent en ligne, visible à la première capture
prise sur cette branche.

**Cause** — la suite de tests de l'app ne rend rien. `tests/perso.test.js`
vérifie que les zones de tap tiennent la promesse du PRD §11, mais en lisant des
**hauteurs déclarées dans la feuille de style**, jamais une largeur mesurée. Un
débordement horizontal n'existe qu'une fois la page mise en page : il ne se
déduit d'aucun texte de CSS.

**Detecte par** — `auteur`

**Action** — `garde-fou` — Chromium et Playwright sont présents dans
l'environnement cloud et ne sont utilisés par aucun `test.sh`. Une seule
assertion — `document.scrollingElement.scrollWidth <= innerWidth` sur les sept
écrans, à 320 px — aurait attrapé celui-ci et attrapera les suivants, pour un
coût de démarrage bien plus élevé que le reste de la suite : c'est l'arbitrage à
poser avant de l'ajouter.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 17:39 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 246 | 0,00 $ |
| Écriture de cache | 298 373 | 1,86 $ |
| Lecture de cache | 26 012 229 | 13,01 $ |
| Sortie | 95 838 | 2,40 $ |
| **Total** | **26 406 686** | **17,27 $ — 15,00 €** |

**Ce qui coûte**

- **130 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  56 281 jetons, écrits une fois par session puis relus à chaque
  échange : 7 260 249 jetons de relecture, 27 % de tout ce qui a été relu.
- **Croissance** — 56 281 jetons relus au premier appel qui relise
  quelque chose, 296 001 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 26406686 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 56281 0 257
2 principal claude-opus-5 4105 56281 228
3 principal claude-opus-5 3995 60386 339
4 principal claude-opus-5 1361 64381 116
5 principal claude-opus-5 4019 65742 150
6 principal claude-opus-5 9854 69761 166
7 principal claude-opus-5 917 79615 72
8 principal claude-opus-5 20269 80532 1039
9 principal claude-opus-5 8734 100801 199
10 principal claude-opus-5 2046 109535 1164
11 principal claude-opus-5 3246 111581 202
12 principal claude-opus-5 3256 114827 308
13 principal claude-opus-5 5085 118083 287
14 principal claude-opus-5 2715 123168 239
15 principal claude-opus-5 274 125883 131
16 principal claude-opus-5 146 126157 157
17 principal claude-opus-5 362 126303 430
18 principal claude-opus-5 438 126665 177
19 principal claude-opus-5 752 127103 139
20 principal claude-opus-5 1308 127855 387
21 principal claude-opus-5 719 129163 1227
22 principal claude-opus-5 1315 129882 160
23 principal claude-opus-5 573 131197 198
24 principal claude-opus-5 765 131770 120
25 principal claude-opus-5 213 132535 221
26 principal claude-opus-5 402 132748 634
27 principal claude-opus-5 651 133150 148
28 principal claude-opus-5 169 133801 189
29 principal claude-opus-5 197 133970 110
30 principal claude-opus-5 1837 134167 291
31 principal claude-opus-5 2428 136004 110
32 principal claude-opus-5 1948 138432 4912
33 principal claude-opus-5 5674 140380 466
34 principal claude-opus-5 568 146054 867
35 principal claude-opus-5 938 146622 269
36 principal claude-opus-5 1509 147560 400
37 principal claude-opus-5 648 149069 328
38 principal claude-opus-5 465 149717 1229
39 principal claude-opus-5 1319 150182 476
40 principal claude-opus-5 503 151501 106
41 principal claude-opus-5 1667 152004 4127
42 principal claude-opus-5 5432 153671 174
43 principal claude-opus-5 1901 159103 638
44 principal claude-opus-5 1225 161004 411
45 principal claude-opus-5 760 162229 1091
46 principal claude-opus-5 2238 162989 4861
47 principal claude-opus-5 5053 165227 199
48 principal claude-opus-5 346 170280 19800
49 principal claude-opus-5 19963 170626 397
50 principal claude-opus-5 608 190589 1267
51 principal claude-opus-5 1454 191197 255
52 principal claude-opus-5 313 192651 515
53 principal claude-opus-5 1476 192964 451
54 principal claude-opus-5 506 194440 183
55 principal claude-opus-5 238 194946 126
56 principal claude-opus-5 528 195184 105
57 principal claude-opus-5 670 195712 517
58 principal claude-opus-5 575 196382 118
59 principal claude-opus-5 165 196957 713
60 principal claude-opus-5 931 197122 110
61 principal claude-opus-5 1836 198053 1939
62 principal claude-opus-5 3722 199889 822
63 principal claude-opus-5 2549 203611 558
64 principal claude-opus-5 2285 206160 362
65 principal claude-opus-5 1755 208445 138
66 principal claude-opus-5 1319 210200 242
67 principal claude-opus-5 1429 211519 2172
68 principal claude-opus-5 2326 212948 338
69 principal claude-opus-5 395 215274 257
70 principal claude-opus-5 444 215669 780
71 principal claude-opus-5 867 216113 110
72 principal claude-opus-5 1837 216980 2905
73 principal claude-opus-5 3060 218817 1823
74 principal claude-opus-5 1880 221877 423
75 principal claude-opus-5 480 223757 561
76 principal claude-opus-5 618 224237 298
77 principal claude-opus-5 355 224855 148
78 principal claude-opus-5 233 225210 110
79 principal claude-opus-5 1837 225443 2625
80 principal claude-opus-5 2907 227280 253
81 principal claude-opus-5 309 230187 251
82 principal claude-opus-5 308 230496 148
83 principal claude-opus-5 233 230804 110
84 principal claude-opus-5 1837 231037 1660
85 principal claude-opus-5 5838 232874 110
86 principal claude-opus-5 1837 238712 283
87 principal claude-opus-5 2010 240549 823
88 principal claude-opus-5 1040 242559 502
89 principal claude-opus-5 2077 243599 172
90 principal claude-opus-5 2029 245676 449
91 principal claude-opus-5 2095 247705 645
92 principal claude-opus-5 702 249800 897
93 principal claude-opus-5 924 250502 111
94 principal claude-opus-5 750 251426 1008
95 principal claude-opus-5 3015 252176 842
96 principal claude-opus-5 4939 255191 357
97 principal claude-opus-5 403 260130 223
98 principal claude-opus-5 280 260533 867
99 principal claude-opus-5 894 260813 108
100 principal claude-opus-5 1965 261707 946
101 principal claude-opus-5 5039 263672 111
102 principal claude-opus-5 2006 268711 268
103 principal claude-opus-5 430 270717 104
104 principal claude-opus-5 1054 271147 672
105 principal claude-opus-5 1560 272201 158
106 principal claude-opus-5 173 273761 112
107 principal claude-opus-5 396 273934 89
108 principal claude-opus-5 772 274330 3522
109 principal claude-opus-5 3593 275102 543
110 principal claude-opus-5 1159 278695 1370
111 principal claude-opus-5 1429 279854 362
112 principal claude-opus-5 422 281283 137
113 principal claude-opus-5 1079 281705 104
114 principal claude-opus-5 1147 282784 995
115 principal claude-opus-5 980 283931 147
116 principal claude-opus-5 642 284911 256
117 principal claude-opus-5 344 285553 110
118 principal claude-opus-5 1893 285897 226
119 principal claude-opus-5 1953 287790 197
120 principal claude-opus-5 2054 289743 412
121 principal claude-opus-5 428 291797 145
122 principal claude-opus-5 158 292225 299
123 principal claude-opus-5 415 292383 617
124 principal claude-opus-5 634 292798 205
125 principal claude-opus-5 301 293432 359
126 principal claude-opus-5 452 293733 266
127 principal claude-opus-5 407 294185 101
128 principal claude-opus-5 117 294592 1033
129 principal claude-opus-5 1292 294709 515
130 principal claude-opus-5 2372 296001 321
-->
<!-- /cout -->
