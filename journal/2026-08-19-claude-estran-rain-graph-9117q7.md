# 2026-08-19 — claude/estran-rain-graph-9117q7

Branche : `claude/estran-rain-graph-9117q7`
Périmètre : apps/estran
Mode : `chaud`

## Anomalies

### 1. `minutely_15` d'Open-Meteo rend 15 minutes sur 23 jours, dont 20 inventés

**Symptome** — l'appel `minutely_15=precipitation,precipitation_probability` sur la
fenetre complete de l'app (`past_days=7&forecast_days=16`) rend 2208 pas de quart
d'heure, **sans un seul null**, de J-7 a J+15. Lu tel quel, ce serait un graphe « au
quart d'heure » sur seize jours — exactement ce que la demande utilisateur voulait,
et exactement ce qu'aucun modele meteo ne produit.

**Cause** — Open-Meteo ne rend du vrai quart d'heure que la ou un modele a maille
fine en produit (AROME 1,5 km, ICON-D2, HRRR) ; au-dela, il **interpole depuis
l'horaire** sans le signaler dans la reponse. Le meme appel force sur
`models=meteofrance_arome_france_hd` s'arrete net a J+2 et rend `null` ensuite : la
donnee reelle etait la, la fenetre aussi, seul le mode « seamless » les masquait en
comblant les trous.

**Detecte par** — `auteur`

**Action** — `comportement` — mesurer la fenetre reelle d'une source fine en la
forcant sur un modele nomme, avant de croire une serie sans null.

---

## Suite — relisibilite de la section Pluie (PR #148 deja fusionnee)

La premiere PR de cette branche est fusionnee et deployee. Le travail reprend sur
la meme branche, repartie de `main`, pour retravailler la LISIBILITE de la section
livree (demande utilisateur, mode `/livrer`). Perimetre inchange : `apps/estran`.

Les anomalies de cette seconde partie s'ajoutent ci-dessous, a la suite de la
premiere.

### 2. Une unite de metier servie a quelqu'un qui n'en est pas

**Symptome** — la premiere version du graphe graduait son axe vertical en
« 6,8 mm/h » et « 3,4 mm/h ». Retour de l'utilisateur, apres mise en ligne :
« la lecture du nb de mm par heure n'est pas parlant, difficile de savoir ce
que ceci represente. » Il avait raison : personne ne sait traduire un debit en
millimetres par heure en « faut-il un k-way ».

**Cause** — l'unite a ete reprise telle quelle du fournisseur, sans se demander
qui lit. Le plus penible est qu'elle etait deja traduite DANS LA MEME CARTE :
la bande de l'heure qui vient dit « pluie faible / moderee / forte » depuis le
premier jour. Deux visuels voisins decrivaient la meme grandeur, l'un en mots,
l'autre en unites — et c'est l'unite qui avait ete choisie pour le plus gros
des deux.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une grandeur est deja nommee en mots
quelque part dans l'ecran, la nommer partout : une unite de fournisseur n'est
pas une unite de lecteur. L'axe porte desormais « pluie moderee » et « pluie
forte », traits dessines seulement quand le seuil est franchissable ce jour-la,
et les couleurs des barres suivent les memes seuils (2 et 8 mm/h). Le seul
chiffre garde est le cumul du jour, qui est une quantite d'eau et se comprend.

### 3. Un remede qui coute un tiers de ce qu'il protege

**Symptome** — pour empecher l'etiquette « maintenant » de recouvrir la barre
la plus haute, l'aire des barres avait ete reduite a 68 % de la hauteur du
graphe. Le recouvrement disparaissait, et l'amplitude de la courbe avec : le
graphe se lisait moins bien qu'avant la correction censee l'ameliorer.

**Cause** — la contrainte « une etiquette ne cache jamais la donnee » a ete
resolue en retrecissant la donnee plutot qu'en sortant l'etiquette. Le premier
reflexe reste a l'interieur du cadre pose ; le bon geste etait de deplacer
l'etiquette hors de l'aire tracee, ou rien ne la contraint.

**Detecte par** — `relecture`

**Action** — `comportement` — quand un correctif ampute ce qu'il protege,
c'est que le cadre est mal pose : elargir le cadre avant de rogner le contenu.

### 4. Un binaire perime qui fait croire a un correctif sans effet

**Symptome** — apres modification des fichiers de la page, le navigateur
continuait d'afficher l'ancien texte. Soupcon porte sur un cache navigateur,
temps perdu a le chasser.

**Cause** — un `go run` precedent tenait encore le port : le nouveau `go run`
n'ecoutait pas, et l'ancien binaire — qui embarque les fichiers de la page par
`go:embed` au moment de sa compilation — repondait a sa place. Le `pkill` cense
l'arreter ne correspondait pas, le binaire temporaire de `go run` changeant de
chemin a chaque invocation.

**Detecte par** — `auteur`

**Action** — `comportement` — sur une app qui embarque ses fichiers, liberer le
port par le port (`fuser -k`) et compiler explicitement avant de mesurer :
`go run` en tache de fond ne garantit pas que ce qu'on regarde est ce qu'on
vient d'ecrire.

### 5. La session coupee en plein travail par le fournisseur d'API

**Symptome** — l'agent qui ecrivait la page s'est arrete net sur une erreur
`521` d'infrastructure, entre deux verifications.

**Cause** — panne passagere cote fournisseur, sans rapport avec le depot. Les
modifications sur disque etaient intactes ; l'agent a repris exactement ou il
en etait, sans rien perdre.

**Detecte par** — `auteur`

**Action** — `rien` — reparee d'elle-meme. Notee parce qu'elle dit que reprendre
un agent vaut mieux que le relancer : son contexte, lui, survit.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 15:37 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 645 | 0,00 $ |
| Écriture de cache | 1 575 461 | 6,87 $ |
| Lecture de cache | 57 037 457 | 23,13 $ |
| Sortie | 118 456 | 2,45 $ |
| **Total** | **58 732 019** | **32,45 $ — 28,18 €** |

**Ce qui coûte**

- **318 appel(s) au modèle** — un par réponse, outils compris —, dont 124 par des sous-agents — 21 763 016 jetons, 9,01 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 442 jetons, écrits une fois par session puis relus à chaque
  échange : 12 630 306 jetons de relecture, 22 % de tout ce qui a été relu.
- **Tours courts** — 213 des 318 tours (66 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 22,77 $, soit 70 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 442 jetons relus au premier appel qui relise
  quelque chose, 321 342 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 58732019 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65442 0 329
2 principal claude-opus-5 1515 65442 182
3 principal claude-opus-5 3749 66957 873
4 principal claude-opus-5 941 70706 104
5 principal claude-opus-5 5606 71647 188
6 principal claude-opus-5 2605 77253 88
7 principal claude-opus-5 3973 79858 89
8 principal claude-opus-5 4339 83831 263
9 principal claude-opus-5 1476 88170 1276
10 principal claude-opus-5 2026 89646 851
11 principal claude-opus-5 6238 91672 227
12 principal claude-opus-5 1864 97910 1098
13 principal claude-opus-5 1403 99774 794
14 principal claude-opus-5 3267 101177 803
15 principal claude-opus-5 907 104444 1440
16 principal claude-opus-5 1651 105351 1778
17 principal claude-opus-5 7424 108780 741
18 principal claude-opus-5 3476 116204 116
19 principal claude-opus-5 2687 119680 170
20 principal claude-opus-5 554 122367 101
21 principal claude-opus-5 1215 122921 822
22 principal claude-opus-5 1050 124136 1605
23 principal claude-opus-5 1731 125186 126
24 principal claude-opus-5 2554 126917 3215
25 principal claude-opus-5 3228 129471 2467
26 principal claude-opus-5 3396 132699 5042
27 principal claude-opus-5 5060 136095 3556
28 principal claude-opus-5 3592 141155 132
29 principal claude-opus-5 1346 144747 2265
30 principal claude-opus-5 2464 146093 89
31 principal claude-opus-5 1008 148557 942
32 principal claude-opus-5 1000 149565 373
33 principal claude-opus-5 2413 150565 7308
34 principal claude-opus-5 7366 152978 250
35 principal claude-opus-5 1362 160344 528
36 principal claude-opus-5 836 161706 492
37 principal claude-opus-5 3902 162542 172
38 principal claude-opus-5 240 166444 178
39 principal claude-opus-5 1934 166684 118
40 principal claude-opus-5 1498 168618 422
41 principal claude-opus-5 850 170116 1641
42 principal claude-opus-5 1754 170966 3122
43 principal claude-opus-5 3152 172720 148
44 principal claude-opus-5 544 175872 2031
45 principal claude-opus-5 2106 176416 296
46 principal claude-opus-5 820 178522 302
47 principal claude-opus-5 525 179342 388
48 principal claude-opus-5 489 179867 202
49 principal claude-opus-5 1513 180356 87
50 principal claude-opus-5 180 181869 224
51 principal claude-opus-5 318 182049 147
52 principal claude-opus-5 437 182367 585
53 principal claude-opus-5 621 182804 106
54 principal claude-opus-5 989 183425 860
55 principal claude-opus-5 3977 184414 1296
56 principal claude-opus-5 1332 188391 728
57 principal claude-opus-5 763 189723 106
58 principal claude-opus-5 315 190486 106
59 principal claude-opus-5 488 190801 893
60 principal claude-opus-5 959 191289 1174
61 principal claude-opus-5 1205 192248 1632
62 principal claude-opus-5 2248 193453 201
63 principal claude-opus-5 407 195701 93
64 principal claude-opus-5 337 196108 101
65 principal claude-opus-5 445 196445 2292
66 principal claude-opus-5 2346 196890 488
67 principal claude-opus-4-7 55481 0 109
68 principal claude-opus-5 518 199236 122
69 principal claude-opus-4-7 195 55481 111
70 principal claude-opus-4-7 201 55676 77
71 principal claude-opus-4-7 0 55481 394
72 principal claude-opus-4-7 138 55877 74
73 principal claude-opus-4-7 482 55481 93
74 principal claude-opus-5 357 199754 165
75 principal claude-opus-4-7 5438 56015 72
76 principal claude-opus-4-7 262 55963 82
77 principal claude-opus-4-7 0 55481 117
78 principal claude-opus-4-7 6163 61453 74
79 principal claude-opus-4-7 232 55481 111
80 principal claude-opus-4-7 6173 56225 84
81 principal claude-opus-5 365 200111 84
82 principal claude-opus-4-7 201 55713 74
83 principal claude-opus-4-7 5448 62398 84
84 principal claude-opus-4-7 271 55914 84
85 principal claude-opus-4-7 15180 67616 227
86 principal claude-opus-5 465 200476 103
87 principal claude-opus-4-7 5448 56185 82
88 principal claude-opus-4-7 478 82796 202
89 principal claude-opus-4-7 6173 61633 84
90 principal claude-opus-4-7 2061 83274 118
91 principal claude-opus-4-7 10863 67806 84
92 principal claude-opus-4-7 1270 85335 73
93 principal claude-opus-4-7 840 86605 118
94 principal claude-opus-4-7 15190 78669 221
95 principal claude-opus-4-7 15190 67846 1140
96 principal claude-opus-5 857 200941 1523
97 principal claude-opus-4-7 2348 93859 83
98 principal claude-opus-4-7 706 96207 128
99 principal claude-opus-5 2133 201798 138
100 principal claude-opus-4-7 1317 83036 195
101 principal claude-opus-5 2153 203931 137
102 principal claude-opus-4-7 1994 84353 128
103 principal claude-opus-4-7 1280 86347 111
104 principal claude-opus-5 432 206084 329
105 principal claude-opus-5 370 206516 92
106 principal claude-opus-5 607 206886 222
107 principal claude-opus-5 308 207493 207
108 principal claude-opus-4-7 734 87627 1993
109 principal claude-opus-5 340 207801 515
110 principal claude-opus-4-7 3711 87445 5216
111 principal claude-opus-4-7 2721 88361 1423
112 principal claude-opus-4-7 1309 96913 6934
113 principal claude-opus-5 168290 46581 137
114 principal claude-opus-5 170761 46581 175
115 principal claude-opus-5 2137 217342 137
116 principal claude-opus-5 214 219479 580
117 principal claude-opus-5 664 219693 75
118 principal claude-opus-5 11840 214871 397
119 principal claude-opus-5 8266 220432 328
120 principal claude-opus-5 707 228698 291
121 principal claude-opus-5 431 229405 100
122 principal claude-opus-5 846 229836 133
123 principal claude-opus-5 326 230682 167
124 principal claude-opus-5 1425 231008 286
125 principal claude-opus-5 426 232433 49
126 principal claude-opus-5 85 232859 137
127 principal claude-opus-5 1086 232944 107
128 principal claude-opus-5 245 234030 159
129 principal claude-opus-5 1108 234275 108
130 principal claude-opus-5 246 235383 149
131 principal claude-opus-5 1408 235629 250
132 principal claude-opus-5 335 237037 108
133 principal claude-opus-5 586 237372 141
134 principal claude-opus-5 1116 237958 172
135 principal claude-opus-5 701 239074 244
136 principal claude-opus-5 472 239775 110
137 principal claude-opus-5 246 240247 206
138 principal claude-opus-5 4791 240493 111
139 principal claude-opus-5 584 245284 122
140 principal claude-opus-5 1049 245868 202
141 principal claude-opus-5 6081 246917 137
142 principal claude-opus-5 607 252998 130
143 principal claude-opus-5 560 253605 484
144 principal claude-opus-5 1038 254165 331
145 principal claude-opus-5 373 255203 381
146 principal claude-opus-5 656 255576 199
147 principal claude-opus-5 442 256232 205
148 principal claude-opus-5 376 256879 145
149 principal claude-opus-5 382 257400 21
150 principal claude-opus-5 375 257803 30
151 principal claude-opus-5 6669 258208 268
152 principal claude-opus-5 3900 264877 242
153 principal claude-opus-5 392 268777 334
154 principal claude-opus-5 4653 269505 457
155 principal claude-opus-5 1233 274158 2010
156 principal claude-opus-5 3764 275391 183
157 principal claude-opus-5 1799 279155 5219
158 principal claude-opus-5 5612 280954 292
159 principal claude-opus-5 596 286566 606
160 principal claude-opus-5 974 287162 24
161 principal claude-opus-5 296 288136 606
162 principal claude-opus-5 832 288432 619
163 principal claude-opus-5 814 289264 208
164 principal claude-opus-5 441 290078 33
165 principal claude-opus-5 3303 288432 233
166 principal claude-opus-5 390 291735 432
167 principal claude-opus-5 554 292125 46
168 principal claude-opus-5 318 292679 268
169 principal claude-opus-5 3266 292997 128
170 principal claude-opus-5 493 296263 722
171 principal claude-opus-5 1153 296756 721
172 principal claude-opus-5 998 297909 315
173 principal claude-opus-5 636 298907 521
174 principal claude-opus-5 2112 299543 1512
175 principal claude-opus-5 1634 301655 61
176 principal claude-opus-5 333 303289 74
177 principal claude-opus-5 385 303622 2122
178 principal claude-opus-5 2194 304007 731
179 principal claude-opus-5 1003 306201 84
180 principal claude-opus-5 156 307204 63
181 principal claude-opus-5 498 307204 28
182 principal claude-opus-5 228 307702 273
183 principal claude-opus-5 3679 307930 334
184 principal claude-opus-5 699 311609 2233
185 principal claude-opus-5 2355 312308 271
186 principal claude-opus-5 543 314663 36
187 principal claude-opus-5 315 315206 28
188 principal claude-opus-5 100 315521 194
189 principal claude-opus-5 1062 315621 282
190 principal claude-opus-5 554 316683 30
191 principal claude-opus-5 2937 317237 135
192 principal claude-opus-5 411 320174 392
193 principal claude-opus-5 757 320585 2296
194 principal claude-opus-5 2359 321342 155
195 agent claude-haiku-4-5-20251001 11317 0 4
196 agent claude-haiku-4-5-20251001 1335 11317 2
197 agent claude-haiku-4-5-20251001 4058 12652 2
198 agent claude-haiku-4-5-20251001 536 16710 2
199 agent claude-haiku-4-5-20251001 337 17246 3
200 agent claude-sonnet-5 20265 0 5
201 agent claude-sonnet-5 17475 20265 2
202 agent claude-sonnet-5 17440 37740 8
203 agent claude-sonnet-5 1514 55180 4
204 agent claude-sonnet-5 1234 56694 6
205 agent claude-sonnet-5 1231 57928 5
206 agent claude-sonnet-5 28713 59159 2
207 agent claude-sonnet-5 4267 87872 2
208 agent claude-sonnet-5 978 92139 2
209 agent claude-sonnet-5 3625 93117 3
210 agent claude-sonnet-5 334 96742 20
211 agent claude-sonnet-5 8438 97076 2
212 agent claude-sonnet-5 505 105514 3
213 agent claude-sonnet-5 484 106019 2
214 agent claude-sonnet-5 382 106503 3
215 agent claude-sonnet-5 312 106885 4
216 agent claude-sonnet-5 1967 107197 2
217 agent claude-sonnet-5 902 109164 2
218 agent claude-sonnet-5 2232 110066 5
219 agent claude-sonnet-5 1185 112298 3
220 agent claude-sonnet-5 312 113483 2
221 agent claude-sonnet-5 513 113795 2
222 agent claude-sonnet-5 661 114308 2
223 agent claude-sonnet-5 2767 114969 20
224 agent <synthetic> 0 0 0
225 agent claude-sonnet-5 104691 11465 3
226 agent claude-sonnet-5 1858 116156 5
227 agent claude-sonnet-5 191 118014 2
228 agent claude-sonnet-5 1637 118205 8
229 agent claude-sonnet-5 3055 119842 3
230 agent claude-sonnet-5 2298 122897 5
231 agent claude-sonnet-5 982 125195 2
232 agent claude-sonnet-5 406 126177 2
233 agent claude-sonnet-5 540 126583 3
234 agent claude-sonnet-5 867 127123 2
235 agent claude-sonnet-5 678 127990 3
236 agent claude-sonnet-5 468 128668 2
237 agent claude-sonnet-5 639 129136 17
238 agent claude-sonnet-5 1920 129775 2
239 agent claude-sonnet-5 386 131695 2
240 agent claude-sonnet-5 249 132081 20
241 agent claude-sonnet-5 159 132330 2
242 agent claude-sonnet-5 125505 7831 6
243 agent claude-sonnet-5 26046 133336 2
244 agent claude-sonnet-5 1021 159382 2
245 agent claude-sonnet-5 643 160403 3
246 agent claude-sonnet-5 1094 161046 2
247 agent claude-sonnet-5 5801 162140 6
248 agent claude-sonnet-5 2741 167941 2
249 agent claude-sonnet-5 5487 170682 2
250 agent claude-sonnet-5 585 176169 20
251 agent claude-sonnet-5 2052 176754 2
252 agent claude-sonnet-5 3387 178806 6
253 agent claude-sonnet-5 325 182193 2
254 agent claude-sonnet-5 184 182518 3
255 agent claude-sonnet-5 323 182702 3
256 agent claude-sonnet-5 305 183025 20
257 agent claude-sonnet-5 237 183330 2
258 agent claude-sonnet-5 1794 183567 3
259 agent claude-sonnet-5 467 185361 3
260 agent claude-sonnet-5 934 185828 2
261 agent claude-sonnet-5 4209 186762 2
262 agent claude-sonnet-5 9888 190971 6
263 agent claude-sonnet-5 452 200859 2
264 agent claude-sonnet-5 1780 201311 5
265 agent claude-sonnet-5 1295 203091 20
266 agent claude-sonnet-5 1739 204386 3
267 agent claude-sonnet-5 4886 206125 2
268 agent claude-sonnet-5 2726 211011 20
269 agent claude-sonnet-5 2390 213737 3
270 agent claude-sonnet-5 1613 216127 2
271 agent claude-sonnet-5 711 217740 3
272 agent claude-sonnet-5 535 218451 2
273 agent claude-sonnet-5 627 218986 2
274 agent claude-sonnet-5 545 219613 2
275 agent claude-sonnet-5 287 220158 17
276 agent claude-sonnet-5 1921 220445 3
277 agent claude-sonnet-5 346 222366 5
278 agent claude-sonnet-5 239 222712 2
279 agent claude-sonnet-5 257 222951 3
280 agent claude-sonnet-5 251 223208 2
281 agent claude-sonnet-5 216191 7831 9
282 agent claude-sonnet-5 14457 224022 2
283 agent claude-sonnet-5 638 238479 8
284 agent claude-sonnet-5 551 239117 20
285 agent claude-sonnet-5 1729 239668 2
286 agent claude-sonnet-5 699 241397 6
287 agent claude-sonnet-5 1296 242096 2
288 agent claude-sonnet-5 253 243392 20
289 agent claude-sonnet-5 407 243645 6
290 agent claude-sonnet-5 381 244052 20
291 agent claude-sonnet-5 2254 244433 20
292 agent claude-sonnet-5 660 246687 4
293 agent claude-sonnet-5 307 247347 2
294 agent claude-sonnet-5 5573 247654 3
295 agent claude-sonnet-5 228 253227 9
296 agent claude-sonnet-5 443 253455 20
297 agent claude-sonnet-5 461 253898 2
298 agent claude-sonnet-5 486 254359 2
299 agent claude-sonnet-5 443 254845 20
300 agent claude-sonnet-5 1979 255288 2
301 agent claude-sonnet-5 3188 257267 3
302 agent claude-sonnet-5 1491 260455 20
303 agent claude-sonnet-5 253 261946 20
304 agent claude-sonnet-5 553 262199 2
305 agent claude-sonnet-5 2463 262752 2
306 agent claude-sonnet-5 1058 265215 3
307 agent claude-sonnet-5 807 266273 2
308 agent claude-sonnet-5 731 267080 2
309 agent claude-sonnet-5 584 267811 7
310 agent claude-sonnet-5 1512 268395 2
311 agent claude-sonnet-5 1468 269907 2
312 agent claude-sonnet-5 1208 271375 17
313 agent claude-sonnet-5 421 272583 3
314 agent claude-sonnet-5 514 273004 16
315 agent claude-sonnet-5 1921 273518 2
316 agent claude-sonnet-5 242 275439 2
317 agent claude-sonnet-5 260 275681 3
318 agent claude-sonnet-5 838 275941 1
-->
<!-- /cout -->
