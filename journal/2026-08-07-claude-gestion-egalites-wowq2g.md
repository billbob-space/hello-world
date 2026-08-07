# 2026-08-07 — claude/gestion-egalites-wowq2g

Branche : `claude/gestion-egalites-wowq2g`
Périmètre : marcq-handball
Mode : `chaud`

## Anomalies

### 1. La règle de départage transformait le classement en course au chrono

**Symptome** — Le PRD §9 écrivait « à égalité, le premier arrivé à ce score est
devant », et le serveur l'appliquait à la minute près. Dans une équipe où la
plupart des enfants cochent tout, plus aucune ligne du classement ne mesurait
l'assiduité : le podium départageait la vitesse à sortir son téléphone après la
séance. Un enfant à 100 % pouvait lire « 9e sur 12 » sans qu'aucun écran ne lui
dise pourquoi, et la règle récompensait de cocher avant d'avoir fait.

**Cause** — La règle avait été écrite pour que l'ordre soit *total*, pas pour
qu'il soit *juste* : elle répondait à la question technique « comment trier deux
lignes identiques » et personne n'a demandé ce que le tri produirait quand la
majorité des lignes seraient identiques. Le cas dégénéré — tout le monde à
100 % — est le cas nominal d'une équipe motivée, et c'est précisément celui
qu'aucun test ne mettait en scène : les tests de classement comparaient toujours
des scores différents.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — aucun garde-fou ne pouvait voir ça : le code faisait
exactement ce que le PRD demandait. Seul un humain qui se représente douze
enfants réels pouvait juger la règle mauvaise.

### 2. Le plafond de noms fait taire des marches d'un seul enfant

**Symptome** — Vérification au navigateur, sur un jeu de seize participants dont
quatorze à 100 % : le podium affiche « 1er : 14 enfants, 100 % », ce qui est
voulu — puis « 15e : 1 enfant, 82 % » et « 16e : 1 enfant, 64 % », ce qui ne
l'est pas. Deux enfants seuls sur leur marche voient leur prénom caché, alors
que les nommer aurait coûté deux noms.

**Cause** — Le plafond de huit prénoms vaut pour le podium **entier**, et une
marche qui le dépasse fait taire toutes celles du dessous. La clause en cascade
a été écrite contre un cas de lecture — un podium qui nommerait la marche du bas
en sautant celle du milieu — sans qu'on regarde ce qu'elle produit quand la
marche de tête consomme à elle seule tout le budget. Or c'est le cas nominal
d'une équipe motivée, celui-là même que cette branche traite.

**Detecte par** — `auteur`

**Action** — `arbitrage` — trois règles se tiennent (cascade, plafond par
marche, plafond global), et laquelle est la bonne dépend de ce qu'on accepte de
publier sur une page ouverte. Ce n'est pas une question de code.

### 3. Le rang d'avant la livraison survivait dans le téléphone

**Symptome** — Une heure après la mise en ligne, sur son propre téléphone : le
podium annonçait « 1er : Alexandre, Snake — 100 % » et la ligne juste dessous
« Tu es 2e sur 2 ». Le même écran, deux places différentes pour le même enfant.

**Cause** — L'écran lit deux corps de durées de vie distinctes : le tableau du
jour, relu à chaque relevé, et la réponse au dernier envoi de ce téléphone, qui
n'est réécrite qu'à l'envoi suivant. Le rang venait du second. Ce téléphone avait
envoyé **avant** la livraison : sa réponse portait le rang de l'ancienne règle,
et rien ne la périmait — un enfant qui ne coche plus rien l'aurait gardée
jusqu'au soir.

Le raisonnement fautif est le mien, et il est en une phrase : j'ai changé la
règle sans chercher **où son ancien verdict était déjà stocké**. Le client gardait
ce chiffre parce que lui seul ne pouvait pas le recalculer — l'heure de coche,
qui départageait, n'a jamais transité. Cette raison est morte avec la règle : la
place se déduit désormais entièrement du tableau public. La dépendance, elle, est
restée.

**Detecte par** — `utilisateur`

**Action** — `comportement` — aucun garde-fou du dépôt ne voit une donnée écrite
la veille dans un navigateur. Ce qui se change est la façon de travailler : quand
une règle de calcul bouge, chercher d'abord qui en a stocké le résultat, et si
le nouveau calcul rend ce stockage inutile.

### 4. Un inscrit se comptait lui-même parmi ceux à battre

**Symptome** — Trouvée en rejouant l'anomalie 3 dans un navigateur, avant tout
correctif : un téléphone inscrit dont la progression locale était vide lisait
« Tu es **3e sur 2** ». Un rang plus grand que son dénominateur, ce que le PRD §9
interdit explicitement.

**Cause** — Le chemin de secours comparait mes cases à **toutes** les lignes du
tableau, la mienne comprise. Tant que le rang venait du serveur, ce chemin ne
servait presque jamais et le défaut dormait ; en faisant du tableau la source du
rang, je l'ai mis sur le chemin principal. Le correctif retire ma ligne — repérée
au score de mon dernier envoi — avant de compter, et le dénominateur ne peut plus
être inférieur au rang.

**Detecte par** — `auteur`

**Action** — `rien` — réparée, et deux tests la tiennent. La leçon utile est
ailleurs : rejouer le cas réel dans un navigateur a trouvé en trente secondes ce
que trente-six tests de fonction pure ne cherchaient pas.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 23:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 515 | 0,00 $ |
| Écriture de cache | 757 123 | 3,64 $ |
| Lecture de cache | 60 655 651 | 29,70 $ |
| Sortie | 144 779 | 3,20 $ |
| **Total** | **61 558 068** | **36,53 $ — 31,73 €** |

**Ce qui coûte**

- **276 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 928 jetons, écrits une fois par session puis relus à chaque
  échange : 16 205 200 jetons de relecture, 26 % de tout ce qui a été relu.
- **Tours courts** — 144 des 276 tours (52 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 20,65 $, soit 56 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 928 jetons relus au premier appel qui relise
  quelque chose, 365 824 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 61558068 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58928 0 253
2 principal claude-opus-5 1304 58928 329
3 principal claude-opus-5 1474 60232 205
4 principal claude-opus-5 1987 61706 71
5 principal claude-opus-5 13511 63693 491
6 principal claude-opus-5 2023 77204 101
7 principal claude-opus-5 1694 79227 1134
8 principal claude-opus-5 2312 80921 816
9 principal claude-opus-5 4278 83233 1628
10 principal claude-opus-5 1922 87511 1448
11 principal claude-opus-5 1535 89433 1076
12 principal claude-opus-5 1155 90968 892
13 principal claude-opus-5 998 92123 2062
14 principal claude-opus-5 12 95183 662
15 principal claude-opus-5 12301 95195 1017
16 principal claude-opus-5 11406 107496 3055
17 principal claude-opus-5 4935 118902 149
18 principal claude-opus-5 373 123837 85
19 principal claude-opus-5 1320 124210 967
20 principal claude-opus-5 1037 125530 308
21 principal claude-opus-5 3195 126567 140
22 principal claude-opus-5 2140 129762 565
23 principal claude-opus-5 1610 131902 3215
24 principal claude-opus-5 4191 133512 314
25 principal claude-opus-5 960 137703 3471
26 principal claude-opus-5 3553 138663 567
27 principal claude-opus-5 1651 142216 226
28 principal claude-opus-5 594 143867 333
29 principal claude-opus-5 677 144461 2284
30 principal claude-opus-5 2581 145138 360
31 principal claude-opus-5 416 147719 836
32 principal claude-opus-5 892 148135 465
33 principal claude-opus-5 683 149027 411
34 principal claude-opus-5 466 149710 162
35 principal claude-opus-5 834 150176 358
36 principal claude-opus-5 440 151010 229
37 principal claude-opus-5 1774 151450 867
38 principal claude-opus-5 1054 153224 570
39 principal claude-opus-5 626 154278 141
40 principal claude-opus-5 157 154904 710
41 principal claude-opus-5 821 155061 119
42 principal claude-opus-5 448 155882 506
43 principal claude-opus-5 566 156330 745
44 principal claude-opus-5 805 156896 541
45 principal claude-opus-5 601 157701 259
46 principal claude-opus-5 445 158302 1147
47 principal claude-opus-5 1294 158747 104
48 principal claude-opus-4-7 12055 28262 118
49 principal claude-opus-5 217 160041 109
50 principal claude-opus-4-7 0 40317 119
51 principal claude-opus-4-7 198 40317 123
52 principal claude-opus-4-7 198 40317 115
53 principal claude-opus-4-7 182 40515 76
54 principal claude-opus-4-7 213 40697 87
55 principal claude-opus-4-7 228 40515 86
56 principal claude-opus-4-7 13949 40910 86
57 principal claude-opus-4-7 5948 40743 87
58 principal claude-opus-4-7 13949 46691 129
59 principal claude-opus-4-7 16436 60640 88
60 principal claude-opus-5 10457 160258 2944
61 principal claude-opus-4-7 5948 54859 2572
62 principal claude-opus-5 3006 170715 2224
63 principal claude-opus-5 2286 173721 616
64 principal claude-opus-5 678 176007 1919
65 principal claude-opus-4-7 11628 60807 1932
66 principal claude-opus-5 1981 176685 566
67 principal claude-opus-5 628 178666 836
68 principal claude-opus-5 898 179294 1317
69 principal claude-opus-4-7 6213 72435 2037
70 principal claude-opus-5 1509 180192 349
71 principal claude-opus-5 410 181701 1905
72 principal claude-opus-5 1967 182111 1092
73 principal claude-opus-5 1154 184078 401
74 principal claude-opus-5 565 185232 111
75 principal claude-opus-5 455 185797 111
76 principal claude-opus-5 620 186252 1095
77 principal claude-opus-5 13767 186872 475
78 principal claude-opus-5 536 200639 386
79 principal claude-opus-5 448 201175 159
80 principal claude-opus-5 181 201623 725
81 principal claude-opus-5 787 201804 344
82 principal claude-opus-5 406 202591 93
83 principal claude-opus-5 292 202997 262
84 principal claude-opus-5 1298 203289 589
85 principal claude-opus-5 647 204587 189
86 principal claude-opus-5 754 205234 351
87 principal claude-opus-5 1902 205988 355
88 principal claude-opus-5 412 207890 294
89 principal claude-opus-5 352 208302 270
90 principal claude-opus-5 329 208654 351
91 principal claude-opus-5 407 208983 325
92 principal claude-opus-5 381 209390 356
93 principal claude-opus-5 414 209771 717
94 principal claude-opus-5 772 210185 181
95 principal claude-opus-5 545 210957 264
96 principal claude-opus-5 990 211502 461
97 principal claude-opus-5 515 212492 219
98 principal claude-opus-5 280 213007 135
99 principal claude-opus-5 348 213287 931
100 principal claude-opus-4-7 16762 28262 325
101 principal claude-opus-5 1032 213635 674
102 principal claude-opus-5 2463 214667 92
103 principal claude-opus-5 204 217130 93
104 principal claude-opus-4-7 411 45024 124
105 principal claude-opus-4-7 183 45435 83
106 principal claude-opus-4-7 115 45618 93
107 principal claude-opus-5 142 217334 1067
108 principal claude-opus-4-7 8578 45733 355
109 principal claude-opus-5 1277 217476 629
110 principal claude-opus-5 697 218753 268
111 principal claude-opus-5 430 219450 112
112 principal claude-opus-5 431 219880 165
113 principal claude-opus-4-7 1721 54311 1010
114 principal claude-opus-4-7 1645 56032 133
115 principal claude-opus-5 258 220311 1155
116 principal claude-opus-5 3274 220569 86
117 principal claude-opus-4-7 3655 57677 978
118 principal claude-opus-5 155 223843 125
119 principal claude-opus-4-7 1491 61332 1091
120 principal claude-opus-5 163 223998 495
121 principal claude-opus-5 623 224161 155
122 principal claude-opus-5 312 224784 391
123 principal claude-opus-5 591 225096 181
124 principal claude-opus-5 513 225687 161
125 principal claude-opus-5 311 226200 118
126 principal claude-opus-5 893 226511 534
127 principal claude-opus-5 625 227404 161
128 principal claude-opus-5 360 228029 153
129 principal claude-opus-5 503 228389 234
130 principal claude-opus-5 860 228892 1612
131 principal claude-opus-5 1627 229752 175
132 principal claude-opus-5 420 231379 783
133 principal claude-opus-5 799 231799 625
134 principal claude-opus-5 977 232598 267
135 principal claude-opus-5 431 233575 169
136 principal claude-opus-5 335 234006 1264
137 principal claude-opus-5 1622 234341 787
138 principal claude-opus-5 881 235963 96
139 principal claude-opus-5 4494 236844 113
140 principal claude-opus-5 273 241338 319
141 principal claude-opus-5 423 241611 295
142 principal claude-opus-5 650 242034 1214
143 principal claude-opus-5 1294 242684 712
144 principal claude-opus-5 768 243978 1156
145 principal claude-opus-5 1212 244746 2081
146 principal claude-opus-5 2139 245958 127
147 principal claude-opus-5 165 248097 550
148 principal claude-opus-5 610 248262 484
149 principal claude-opus-5 669 248872 415
150 principal claude-opus-5 476 249541 147
151 principal claude-opus-5 217 250017 289
152 principal claude-opus-5 451 250234 171
153 principal claude-opus-5 667 250685 285
154 principal claude-opus-5 479 251352 157
155 principal claude-opus-5 174 251831 101
156 principal claude-opus-5 109 252005 268
157 principal claude-opus-5 428 252114 170
158 principal claude-opus-5 445 252542 895
159 principal claude-opus-5 1252 252987 615
160 principal claude-opus-5 622 254239 271
161 principal claude-opus-5 431 254861 173
162 principal claude-opus-5 329 255292 267
163 principal claude-opus-5 627 255621 108
164 principal claude-opus-5 292 256248 657
165 principal claude-opus-5 760 256540 298
166 principal claude-opus-4-7 6596 28262 303
167 principal claude-opus-4-7 489 34858 231
168 principal claude-opus-5 516 257300 334
169 principal claude-opus-5 217421 40940 406
170 principal claude-opus-5 1187 258361 124
171 principal claude-opus-5 2767 259548 1239
172 principal claude-opus-5 1754 262315 137
173 principal claude-opus-5 406 264069 170
174 principal claude-opus-4-7 43140 35347 2985
175 principal claude-opus-5 3083 264475 165
176 principal claude-opus-5 192 267558 269
177 principal claude-opus-5 386 267750 207
178 principal claude-opus-4-7 3549 78487 1376
179 principal claude-opus-5 828 268136 169
180 principal claude-opus-5 286 268964 134
181 principal claude-opus-5 380 269250 110
182 principal claude-opus-5 144 269630 137
183 principal claude-opus-5 758 269774 211
184 principal claude-opus-5 330 270532 155
185 principal claude-opus-5 776 270862 111
186 principal claude-opus-5 146 271638 164
187 principal claude-opus-5 241 271784 291
188 principal claude-opus-5 912 272025 140
189 principal claude-opus-5 3048 272937 231
190 principal claude-opus-5 245 275985 103
191 principal claude-opus-5 297 276230 248
192 principal claude-opus-5 734 276527 160
193 principal claude-opus-5 1714 277261 208
194 principal claude-opus-5 1788 278975 242
195 principal claude-opus-5 1022 280763 775
196 principal claude-opus-5 1788 281785 137
197 principal claude-opus-5 1047 283573 200
198 principal claude-opus-5 245 284620 214
199 principal claude-opus-5 6304 284865 303
200 principal claude-opus-5 1426 291169 137
201 principal claude-opus-5 917 292595 350
202 principal claude-opus-5 2122 293512 197
203 principal claude-opus-5 1159 295634 155
204 principal claude-opus-5 577 296793 295
205 principal claude-opus-5 1440 297370 387
206 principal claude-opus-5 601 298810 312
207 principal claude-opus-5 5643 299411 620
208 principal claude-opus-5 638 305054 187
209 principal claude-opus-5 306 305692 154
210 principal claude-opus-5 189 305998 146
211 principal claude-opus-5 498 306187 58
212 principal claude-opus-5 309 306685 140
213 principal claude-opus-5 174 306994 108
214 principal claude-opus-5 227 307168 154
215 principal claude-opus-5 284 307395 253
216 principal claude-opus-5 288 307679 202
217 principal claude-opus-5 3539 307967 227
218 principal claude-opus-5 608 311506 124
219 principal claude-opus-5 289 312114 100
220 principal claude-opus-5 225 312403 133
221 principal claude-opus-5 252 312628 137
222 principal claude-opus-5 172 312880 111
223 principal claude-opus-5 146 313052 184
224 principal claude-opus-5 236 313198 222
225 principal claude-opus-5 350 313434 131
226 principal claude-opus-5 250 313784 156
227 principal claude-opus-5 321 314034 184
228 principal claude-opus-5 203 314355 166
229 principal claude-opus-5 172 314558 141
230 principal claude-opus-5 650 314730 197
231 principal claude-opus-5 243 315380 140
232 principal claude-opus-5 175 315623 111
233 principal claude-opus-5 146 315798 160
234 principal claude-opus-5 206 315944 141
235 principal claude-opus-5 269 316150 177
236 principal claude-opus-5 428 316419 142
237 principal claude-opus-5 176 316847 160
238 principal claude-opus-5 206 317023 111
239 principal claude-opus-5 146 317229 113
240 principal claude-opus-5 463 317375 225
241 principal claude-opus-5 1869 317838 184
242 principal claude-opus-5 204 319707 229
243 principal claude-opus-5 587 319911 170
244 principal claude-opus-5 429 320498 390
245 principal claude-opus-5 625 320927 938
246 principal claude-opus-5 1532 321552 159
247 principal claude-opus-5 286 323084 59
248 principal claude-opus-5 278 323370 495
249 principal claude-opus-5 1820 324143 3235
250 principal claude-opus-5 4500 325963 3833
251 principal claude-opus-5 4025 330463 3085
252 principal claude-opus-5 3146 334488 138
253 principal claude-opus-5 148 337634 572
254 principal claude-opus-5 634 337782 140
255 principal claude-opus-5 183 338416 805
256 principal claude-opus-5 899 338599 516
257 principal claude-opus-5 526 339498 266
258 principal claude-opus-5 426 340024 173
259 principal claude-opus-5 291 340450 5038
260 principal claude-opus-5 5230 340741 124
261 principal claude-opus-5 145 345971 1000
262 principal claude-opus-5 1062 346116 116
263 principal claude-opus-5 138 347178 100
264 principal claude-opus-5 454 347316 267
265 principal claude-opus-5 429 347770 167
266 principal claude-opus-5 285 348199 726
267 principal claude-opus-5 1931 348484 162
268 principal claude-opus-5 316 350415 176
269 principal claude-opus-5 237 350731 233
270 principal claude-opus-5 245 350968 169
271 principal claude-opus-5 200 351213 896
272 principal claude-opus-5 1017 351413 1131
273 principal claude-opus-5 1245 352430 130
274 principal claude-opus-5 11784 353675 209
275 principal claude-opus-5 365 365459 1259
276 principal claude-opus-5 1500 365824 119
-->
<!-- /cout -->
