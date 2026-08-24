# 2026-08-24 — claude/ramure-v2-context-sessions-nyhvjh

Branche : `claude/ramure-v2-context-sessions-nyhvjh`
Périmètre : fabrique — contrat de pull request. Aucune app touchée.
Mode : `chaud`

## Anomalies

Suite de `journal/2026-08-23-claude-ramure-v2-context-sessions-nyhvjh.md`, fusionné
en `#178`. La branche repart de `main` : on n'empile pas sur de l'historique déjà fusionné.

### 1. Ouvrir la pull request en brouillon fait tourner la CI deux fois, et bloque la fusion

**Symptome** — la `#178`, sortie du brouillon pour être fusionnée, a relancé les
**quatorze contrôles sur un SHA identique** (`71292b8`). Et la fusion a été refusée
pendant tout le rejeu : `405 — Required status check "tests-de-l-outillage" is
expected`, alors que ce même contrôle était **déjà vert** sur ce même commit depuis
la veille.

**Cause** — le harnais cloud demande d'ouvrir la pull request en brouillon. Le
brouillon ne protège de rien dans cette fabrique : la pull request vient déjà en fin
de branche, une fois l'ensemble cohérent et les deux relecteurs passés. Le passage en
revue ré-arme donc les contrôles requis, GitHub considère les résultats précédents
comme périmés bien que le commit n'ait pas bougé, et la branche paie sa CI deux fois.

Le doublement était déjà connu — `journal/2026-08-23-claude-ramure-v2-refonte-suite-l94n9m.md`,
anomalie 22, qui le laissait explicitement en arbitrage : « garder le brouillon, ou
ouvrir directement ? ». Ce qui manquait à l'arbitrage, c'est le second coût : le
brouillon ne retarde pas seulement la relecture, il **retarde la fusion**. Une
anomalie laissée en arbitrage se paie jusqu'à ce que quelqu'un tranche — ici trois
minutes de CI et un aller-retour, à chaque branche de la fabrique depuis qu'elle
ouvre ses pull requests ainsi.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la pull request s'ouvre directement, jamais en brouillon.
La règle est posée dans `CLAUDE.md`, détaillée dans `memory/travail.md` et rappelée
au geste dans `.claude/commands/livrer.md`, seul endroit où elle s'applique.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-24 à 09:13 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 731 | 0,00 $ |
| Écriture de cache | 2 237 478 | 13,63 $ |
| Lecture de cache | 34 510 676 | 17,10 $ |
| Sortie | 115 785 | 2,89 $ |
| **Total** | **36 864 670** | **33,62 $ — 29,19 €** |

**Ce qui coûte**

- **273 appel(s) au modèle** — un par réponse, outils compris —, dont 123 par des sous-agents — 5 126 355 jetons, 4,68 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 722 jetons, écrits une fois par session puis relus à chaque
  échange : 10 239 578 jetons de relecture, 29 % de tout ce qui a été relu.
- **Tours courts** — 188 des 273 tours (68 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 19,41 $, soit 57 % de la facture.
  Dont 123 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Session principale** — 150 tour(s) dans ce conteneur, 150 sur la branche.
  **Au-delà de 60 tours, coupe et repars du PRP** — le prompt de reprise
  est dans `memory/travail.md`.
- **Sessions d'agent** — 10, dont la plus longue fait 28 tours,
  relit 43 102 jetons par tour en moyenne et coûte 1,08 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 68 722 jetons relus au premier appel qui relise
  quelque chose, 375 600 au dernier : une session longue se paie à chaque tour.

<!-- cout-releve a8bf0941fa4e 36864670 33.617906 150 28 -->
<!-- cout-total: 36864670 -->
<!-- cout-principal-tours: 150 -->
<!-- cout-agent-max: 28 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68722 0 650
2 principal claude-opus-5 5115 68722 553
3 principal claude-opus-5 4314 73837 325
4 principal claude-opus-5 4483 78151 905
5 principal claude-opus-5 3129 82634 416
6 principal claude-opus-5 3503 85763 4647
7 principal claude-opus-5 6372 89266 261
8 principal claude-opus-5 402 95638 139
9 principal claude-opus-5 320 96040 110
10 principal claude-opus-5 1236 96360 513
11 principal claude-opus-5 715 97596 447
12 principal claude-opus-5 728 98311 540
13 principal claude-opus-5 743 99039 160
14 principal claude-opus-5 273 99782 63
15 principal claude-opus-5 6149 99039 396
16 principal claude-opus-5 4762 105584 270
17 principal claude-opus-5 7921 110346 272
18 principal claude-opus-5 4919 118539 5957
19 principal claude-opus-5 6630 123458 98
20 principal claude-opus-5 3804 130088 3076
21 principal claude-opus-5 3107 133892 12819
22 principal claude-opus-5 12935 136999 2005
23 principal claude-opus-5 6524 149934 215
24 principal claude-opus-5 605 156458 362
25 principal claude-opus-5 833 157063 177
26 principal claude-opus-5 817 157896 131
27 principal claude-opus-5 974 158713 598
28 principal claude-opus-5 799 159687 117
29 principal claude-opus-5 170 160486 122
30 principal claude-opus-5 327 160656 426
31 principal claude-opus-5 1960 160983 374
32 principal claude-opus-5 539 162943 84
33 principal claude-opus-5 963 163482 975
34 principal claude-opus-5 1373 164445 2079
35 principal claude-opus-5 127888 49348 1978
36 principal claude-opus-5 4589 177236 155
37 principal claude-opus-5 3271 181825 240
38 principal claude-opus-5 581 185096 143
39 principal claude-opus-5 1009 185677 380
40 principal claude-opus-5 958 186686 90
41 principal claude-opus-5 2360 187644 2277
42 principal claude-opus-5 2750 190004 825
43 principal claude-opus-5 3861 192754 735
44 principal claude-opus-5 2118 196615 2293
45 principal claude-opus-5 2327 198733 3282
46 principal claude-opus-5 3326 201060 862
47 principal claude-opus-5 1046 204386 2069
48 principal claude-opus-5 2113 205432 616
49 principal claude-opus-5 655 207545 591
50 principal claude-opus-5 1184 208200 125
51 principal claude-opus-5 889 209384 810
52 principal claude-opus-5 1201 210273 543
53 principal claude-opus-5 1920 211474 1145
54 principal claude-opus-5 1378 213394 193
55 principal claude-opus-5 692 214772 319
56 principal claude-opus-5 2582 215464 618
57 principal claude-opus-5 1016 218046 2587
58 principal claude-opus-5 3038 219062 463
59 principal claude-opus-5 615 222100 109
60 principal claude-opus-5 261 222715 282
61 principal claude-opus-5 2201 222976 594
62 principal claude-opus-5 761 225177 116
63 principal claude-opus-5 616 225938 1369
64 principal claude-opus-5 1522 226554 324
65 principal claude-opus-5 582 228076 295
66 principal claude-opus-5 432 228658 144
67 principal claude-opus-5 478 229090 1437
68 principal claude-opus-5 1486 229568 687
69 principal claude-opus-4-7 45160 0 115
70 principal claude-opus-4-7 228 45160 98
71 principal claude-opus-4-7 275 45388 82
72 principal claude-opus-4-7 20396 45663 82
73 principal claude-opus-4-7 7325 66059 80
74 principal claude-opus-4-7 16881 73384 80
75 principal claude-opus-5 890 231054 131
76 principal claude-opus-5 252 231944 1215
77 principal claude-opus-4-7 9765 90265 3479
78 principal claude-opus-4-7 5781 100030 1992
79 principal claude-opus-5 1609 232196 366
80 principal claude-opus-5 3130 234171 513
81 principal claude-opus-5 2066 237301 1737
82 principal claude-opus-5 1775 239367 807
83 principal claude-opus-5 924 241142 1774
84 principal claude-opus-5 2082 242066 369
85 principal claude-opus-5 501 244148 1508
86 principal claude-opus-5 1605 244649 143
87 principal claude-opus-5 397 246254 656
88 principal claude-opus-4-7 6941 29208 113
89 principal claude-opus-4-7 226 36149 98
90 principal claude-opus-4-7 275 36375 82
91 principal claude-opus-4-7 20844 36650 113
92 principal claude-opus-4-7 18097 57494 2101
93 principal claude-opus-5 840 246651 2006
94 principal claude-opus-4-7 2214 75591 132
95 principal claude-opus-5 2199 247491 124
96 principal claude-opus-4-7 2021 77805 172
97 principal claude-opus-4-7 281 79826 392
98 principal claude-opus-5 229 249690 268
99 principal claude-opus-4-7 2686 80107 1867
100 principal claude-opus-5 450 249919 2287
101 principal claude-opus-4-7 2298 82793 414
102 principal claude-opus-5 2637 250369 30
103 principal claude-opus-5 1312 253006 146
104 principal claude-opus-5 2161 254318 137
105 principal claude-opus-4-7 1061 85091 924
106 principal claude-opus-5 2027 256479 922
107 principal claude-opus-5 1008 258506 125
108 principal claude-opus-5 349 259639 30
109 principal claude-opus-5 660 259988 137
110 principal claude-opus-5 513 260648 313
111 principal claude-opus-5 395 261161 287
112 principal claude-opus-5 7616 261556 337
113 principal claude-opus-5 232959 49348 30
114 principal claude-opus-5 809 282307 265
115 principal claude-opus-5 2714 283116 676
116 principal claude-opus-5 763 285830 31
117 principal claude-opus-5 298946 0 30
118 principal claude-opus-5 907 298946 193
119 principal claude-opus-5 441 299853 492
120 principal claude-opus-5 809 300294 905
121 principal claude-opus-5 991 301103 87
122 principal claude-opus-5 314503 0 30
123 principal claude-opus-5 1041 314503 330
124 principal claude-opus-5 519 315544 572
125 principal claude-opus-5 659 316063 31
126 principal claude-opus-5 329075 0 30
127 principal claude-opus-5 1063 329075 330
128 principal claude-opus-5 647 330138 585
129 principal claude-opus-5 670 330785 31
130 principal claude-opus-5 11221 331486 924
131 principal claude-opus-5 1511 342707 419
132 principal claude-opus-5 1165 344218 133
133 principal claude-opus-5 198 345383 1304
134 principal claude-opus-5 1417 345581 461
135 principal claude-opus-5 2043 346998 418
136 principal claude-opus-5 3355 349041 1062
137 principal claude-opus-5 1275 352396 217
138 principal claude-opus-5 566 353671 30
139 principal claude-opus-5 753 354237 419
140 principal claude-opus-5 6639 354990 104
141 principal claude-opus-5 56 361733 812
142 principal claude-opus-5 1956 361789 1371
143 principal claude-opus-5 3155 363745 210
144 principal claude-opus-5 356 367110 30
145 principal claude-opus-5 1825 367466 200
146 principal claude-opus-5 1916 369291 1317
147 principal claude-opus-5 1394 371207 359
148 principal claude-opus-5 1131 372601 570
149 principal claude-opus-5 1868 373732 1334
150 principal claude-opus-5 1732 375600 1188
151 agent claude-haiku-4-5-20251001 11991 0 4
152 agent claude-haiku-4-5-20251001 1353 11991 2
153 agent claude-haiku-4-5-20251001 481 13344 2
154 agent claude-haiku-4-5-20251001 595 13825 4
155 agent claude-haiku-4-5-20251001 228 14420 1
156 agent claude-haiku-4-5-20251001 312 14648 2
157 agent claude-haiku-4-5-20251001 325 14960 2
158 agent claude-haiku-4-5-20251001 4202 15285 2
159 agent claude-haiku-4-5-20251001 606 19487 4
160 agent claude-haiku-4-5-20251001 286 20093 2
161 agent claude-haiku-4-5-20251001 11972 0 4
162 agent claude-haiku-4-5-20251001 1335 11972 2
163 agent claude-haiku-4-5-20251001 518 13307 2
164 agent claude-haiku-4-5-20251001 644 13825 4
165 agent claude-haiku-4-5-20251001 630 14469 2
166 agent claude-haiku-4-5-20251001 477 15099 4
167 agent claude-haiku-4-5-20251001 233 15576 2
168 agent claude-haiku-4-5-20251001 370 15809 2
169 agent claude-opus-5 13155 0 3
170 agent claude-opus-5 3982 13155 5
171 agent claude-opus-5 4000 17137 2
172 agent claude-opus-5 5731 21137 3
173 agent claude-opus-5 1814 26868 2
174 agent claude-opus-5 9164 28682 3
175 agent claude-opus-5 10603 37846 4
176 agent claude-opus-5 8654 48449 4
177 agent claude-opus-5 12801 0 1
178 agent claude-opus-5 1467 12801 16
179 agent claude-opus-5 1255 14268 17
180 agent claude-opus-5 8812 15523 3
181 agent claude-opus-5 4724 24335 3
182 agent claude-opus-5 6196 29059 3
183 agent claude-opus-5 9483 35255 3
184 agent claude-opus-5 2448 44738 2
185 agent claude-opus-5 6439 47186 5
186 agent claude-opus-5 1881 53625 3
187 agent claude-opus-5 1327 55506 3
188 agent claude-opus-5 8291 56833 3
189 agent claude-opus-5 809 65124 3
190 agent claude-opus-5 1950 65933 2
191 agent claude-opus-5 1390 67883 2
192 agent claude-haiku-4-5-20251001 11889 0 4
193 agent claude-haiku-4-5-20251001 1488 11889 2
194 agent claude-haiku-4-5-20251001 568 13377 2
195 agent claude-haiku-4-5-20251001 1780 13945 2
196 agent claude-haiku-4-5-20251001 2392 15725 2
197 agent claude-haiku-4-5-20251001 1639 18117 2
198 agent claude-haiku-4-5-20251001 316 19756 2
199 agent claude-opus-5 15739 24987 1
200 agent claude-opus-5 3031 40726 3
201 agent claude-opus-5 3318 43757 4
202 agent claude-opus-5 9526 47075 3
203 agent claude-opus-5 2904 56601 3
204 agent claude-opus-5 1930 59505 3
205 agent claude-opus-5 2842 61435 4
206 agent claude-opus-5 3035 64277 2
207 agent claude-opus-5 634 67312 9
208 agent claude-opus-5 2156 67946 2
209 agent claude-opus-5 12683 0 6
210 agent claude-opus-5 2245 12683 5
211 agent claude-opus-5 9618 14928 3
212 agent claude-opus-5 4237 24546 21
213 agent claude-opus-5 1994 28783 3
214 agent claude-opus-5 1379 30777 2
215 agent claude-opus-5 1671 32156 3
216 agent claude-opus-5 1290 33827 20
217 agent claude-opus-5 447 35117 20
218 agent claude-opus-5 812 35564 7
219 agent claude-opus-5 1226 36376 7
220 agent claude-opus-5 663 37602 17
221 agent claude-opus-5 423 38265 3
222 agent claude-opus-5 2672 38688 3
223 agent claude-opus-5 2074 41360 3
224 agent claude-opus-5 1294 43434 3
225 agent claude-opus-5 1817 44728 3
226 agent claude-opus-5 5466 46545 3
227 agent claude-opus-5 3184 52011 3
228 agent claude-opus-5 2649 55195 2
229 agent claude-opus-5 1788 57844 8
230 agent claude-opus-5 3160 59632 3
231 agent claude-opus-5 2193 62792 3
232 agent claude-opus-5 1999 64985 2
233 agent claude-opus-5 2817 66984 3
234 agent claude-opus-5 872 69801 2
235 agent claude-opus-5 902 70673 2
236 agent claude-opus-5 3736 71575 2
237 agent claude-haiku-4-5-20251001 11780 0 4
238 agent claude-haiku-4-5-20251001 1366 11780 2
239 agent claude-haiku-4-5-20251001 440 13146 3
240 agent claude-haiku-4-5-20251001 488 13586 5
241 agent claude-haiku-4-5-20251001 523 14074 4
242 agent claude-haiku-4-5-20251001 378 14597 2
243 agent claude-opus-5 40830 0 1
244 agent claude-opus-5 1575 40830 17
245 agent claude-opus-5 1925 42405 3
246 agent claude-opus-5 3105 44330 3
247 agent claude-opus-5 1868 47435 2
248 agent claude-opus-5 1076 49303 17
249 agent claude-opus-5 1745 50379 3
250 agent claude-opus-5 2354 52124 2
251 agent claude-opus-5 2283 54478 3
252 agent claude-opus-5 1391 56761 3
253 agent claude-opus-5 1110 58152 3
254 agent claude-opus-5 654 59262 2
255 agent claude-opus-5 5123 59916 3
256 agent claude-opus-5 1982 65039 5
257 agent claude-opus-5 2210 67021 3
258 agent claude-opus-5 3625 69231 5
259 agent claude-opus-5 15941 24987 1
260 agent claude-opus-5 1636 40928 2
261 agent claude-opus-5 5109 42564 3
262 agent claude-opus-5 5228 47673 4
263 agent claude-opus-5 4926 52901 4
264 agent claude-opus-5 1591 57827 3
265 agent claude-opus-5 4914 59418 5
266 agent claude-opus-5 3887 64332 3
267 agent claude-opus-5 2383 68219 2
268 agent claude-opus-5 2983 70602 4
269 agent claude-opus-5 3694 73585 3
270 agent claude-opus-5 5321 77279 4
271 agent claude-opus-5 1573 82600 3
272 agent claude-opus-5 1382 84173 2
273 agent claude-opus-5 4345 85555 1
-->
<!-- /cout -->
