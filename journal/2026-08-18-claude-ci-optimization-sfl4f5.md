# 2026-08-18 — claude/ci-optimization-sfl4f5

Branche : `claude/ci-optimization-sfl4f5`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. La CI dure dix minutes, et personne ne mesurait où

**Symptome** — l'utilisateur signale une CI « extraordinairement longue ». Mesure
sur le run 32162296876 (push sur `main`, 9 min 49 s) : le job
`tests-de-l-outillage` occupe 8 min 12 s à lui seul, en quatre scripts joués en
séquence — `test-init.sh` 5 min 30, `test-cout.sh` 21 s, `test-pret.sh` 2 min 13,
`test-jetons.sh` 2 s. Tout le reste du graphe — `contrat` 19 s, la matrice `test`
des neuf apps, la matrice `build` des neuf images — est terminé à 2 min 15. Le job
`deploy`, qui a `tests-de-l-outillage` dans ses `needs`, attend donc six minutes
sans rien faire.

**Cause** — le job qui teste l'outillage a grossi script par script sans que rien
ne mesure sa durée. Il est resté un job unique et séquentiel là où ses quatre
scripts sont indépendants, et il verrouille `deploy`.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — aucun contrôle ne dit qu'un job de CI dépasse un
plafond de durée ; la dérive s'installe sans signal.

### 2. Le test le plus lent passait 209 secondes sur 210 dans un controle dont il ignore le verdict

**Symptome** — `test-pret.sh` mettait 2 min 13 en CI pour dix cas rigoureusement
equivalents : 20 s chacun, aucun cas cher. Chronometrage interne : 99,4 % de
chaque cas est le `./init.sh --check` que `scripts/pret.sh` lance a la ligne 62.
Or aucune des dix assertions ne regarde ce verdict — elles ne cherchent qu'une
ligne d'avertissement dans la sortie, et l'en-tete du fichier le disait deja :
« on n'observe que cette ligne, jamais son code de sortie ».

**Cause** — « lancer `pret.sh` en entier » etait un choix delibere et juste — le
chemin reel est celui ou une variable renommee ailleurs casse le garde-fou — mais
personne n'avait remarque que le payer DIX fois n'achete rien de plus que le
payer une. Une doublure d'`init.sh` dans le bac a sable, sauf pour un cas qui
garde le vrai binaire, ramene le fichier a 29 s.

**Detecte par** — `auteur`

**Action** — `rien` — reparee ; le cout venait d'un effet de bord, pas d'une regle
manquante.

### 3. La branche verte de pret.sh n'avait jamais ete exercee

**Symptome** — dans un bac a sable neuf, `./init.sh --check` echoue TOUJOURS :
`compose.yaml` desynchronise, `CLAUDE.md` de l'app factice absent. La ligne
`ok "contrat respecte"` de `scripts/pret.sh` etait donc morte pour la suite de
tests, qui n'a jamais pu la voir s'imprimer.

**Cause** — le bac est construit pour tester un autre garde-fou, et son etat
rouge est un effet de bord accepte. Il fallait pouvoir rendre un verdict vert a
volonte pour l'atteindre — ce que la doublure de l'anomalie 2 permet, et c'est sa
seconde raison d'etre. Deux cas neufs couvrent desormais les deux verdicts ; le
fichier passe de dix a douze cas en tournant sept fois plus vite.

**Detecte par** — `auteur`

**Action** — `rien` — reparee dans le meme commit.

### 4. Un nombre juste ailleurs masquait un nombre faux ici

**Symptome** — `scripts/jetons.sh` sabote de quatre facons independantes —
compteur de tours bloque, total general qui n'accumule plus l'ecriture, lecture
de cache non comptee, cout par branche fige — laissait `test-jetons.sh` a
« 9 reussi(s), 0 echec(s) », code de sortie 0.

**Cause** — et ce n'est PAS celle que cette entree affirmait d'abord. J'avais
ecrit que les cas « cherchent des motifs dans la sortie, jamais des valeurs » :
c'est faux, ils comparent bel et bien des nombres — `502 000`, `0,88 $`,
`1 502 000`. Le defaut est ailleurs, et plus interessant. Chaque cas cherchait sa
valeur **n'importe ou dans la sortie**, au lieu de la chercher sur la ligne qui la
porte. Or `jetons.sh` imprime le meme nombre a deux endroits calcules par deux
compteurs differents : en empechant le total general d'accumuler, la ligne TOTAL
tombe a `402 000` — mais `502 000` subsiste sur la ligne « par branche », et
l'assertion passe. Meme piege sur les pourcentages : `23 %` figure sur la lecture
de cache ET sur les tours courts, deux postes sans rapport qui valent le meme
chiffre dans ce bac ; chacun des deux cas se satisfaisait de la ligne de l'autre.

Ma premiere lecture s'etait arretee au verdict vert sans regarder la sortie du
script sabote. C'est la meme faute que celle que le fichier lui-meme commettait —
conclure d'une correspondance sans verifier ou elle tombe.

Corrige : `porte` prend desormais une ancre et n'examine que la ligne qui la
porte. La ligne « par branche », precisement parce qu'elle masquait les fautes du
total, gagne ses propres cas. Neuf cas -> quinze, et les quatre sabotages
ci-dessus rendent tous une suite rouge et une sortie 1.

**Detecte par** — `auteur`

**Action** — `rien` — reparee dans la meme branche ; l'entree portait un
diagnostic faux, reecrit ici plutot qu'ajoute a la suite.

### 5. Une suite de tests qui perd trente-cinq cas sur trente-six et s'affiche verte

**Symptome** — premiere version parallelisee de `test-init.sh` : « 1 reussi(s),
0 echec(s) ». Aucun cas rouge, aucun message d'erreur, code de sortie 0. Trente-
cinq cas sur trente-six avaient disparu sans laisser de trace.

**Cause** — le compteur de fiches etait appele en substitution de commande,
`f=$(numero)`, si bien que son `IDX=$((IDX+1))` tournait dans un sous-shell et
etait perdu au retour. Les trente-six cas ont donc ecrit dans la meme fiche, et
le decompte des verdicts a lu un seul temoin. Le meme piege — une affectation
faite dans `$( )` ne survit pas — avait deja ete rencontre le meme jour sur le
bac partage de `test-cout.sh` : deux fois dans une seule branche, sur deux
fichiers sans rapport.

Ce qui l'a attrape n'est pas une relecture mais un controle ecrit *avant* d'en
avoir besoin, par simple mefiance envers le parallelisme : compter les cas
lances, et refuser que la somme des verdicts s'en ecarte. Sans lui, une suite de
tests vide serait entree dans la CI en s'affichant verte — et y serait restee,
puisqu'une suite qui ne teste rien ne peut plus jamais devenir rouge.

**Detecte par** — `test`

**Action** — `rien` — reparee, et le garde-fou qui l'a vue est dans le meme
commit que le defaut qu'il a attrape.


### 6. Un rouge imaginaire sur une pull request, faute d'avoir distingue « annule » de « echoue »

**Symptome** — la CI signale l'echec du controle `tests-de-l-outillage` sur la
PR 147. Les quatre shards de la matrice sont pourtant vertes ou `cancelled`, et
aucun test n'a echoue. Cause reelle : deux commits pousses a une minute
d'intervalle, `cancel-in-progress` annule le premier run, et le job agregateur —
ecrit avec `if: always()` — se reveille quand meme, lit `cancelled`, tombe dans sa
branche par defaut et affiche un rouge.

**Cause** — `always()` est trop large. On le voulait pour une raison juste : un
controle requis qui reste muet bloque la PR au lieu de la refuser, donc
l'agregateur doit se prononcer meme quand la matrice echoue. Mais « meme quand
elle echoue » n'est pas « meme quand le run est annule » : dans ce second cas il
n'y a rien a dire, et le dire quand meme decore la PR d'un echec qui n'existe
pas. `!cancelled()` couvre exactement le besoin.

Le raisonnement etait ecrit en toutes lettres au-dessus du job, et il etait juste
sur les trois cas auxquels il pensait — vert, saute, rouge. Le quatrieme etat
d'un job GitHub, `cancelled`, n'y figurait simplement pas.

**Detecte par** — `CI`

**Action** — `rien` — reparee ; l'oubli portait sur une valeur possible, pas sur
une regle du contrat.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-18 à 21:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 189 | 0,00 $ |
| Écriture de cache | 1 144 975 | 4,74 $ |
| Lecture de cache | 51 142 678 | 23,97 $ |
| Sortie | 163 051 | 2,79 $ |
| **Total** | **52 451 893** | **31,50 $ — 27,35 €** |

**Ce qui coûte**

- **416 appel(s) au modèle** — un par réponse, outils compris —, dont 166 par des sous-agents — 9 761 594 jetons, 6,97 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  0 jetons, écrits une fois par session puis relus à chaque
  échange : 0 jetons de relecture, 0 % de tout ce qui a été relu.
- **Tours courts** — 178 des 416 tours (42 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 16,04 $, soit 50 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 80 777 jetons relus au premier appel qui relise
  quelque chose, 322 026 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 52451893 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal <synthetic> 0 0 0
2 principal <synthetic> 0 0 0
3 principal <synthetic> 0 0 0
4 principal <synthetic> 0 0 0
5 principal <synthetic> 0 0 0
6 principal claude-opus-5 80777 0 215
7 principal claude-opus-5 2388 80777 336
8 principal claude-opus-5 419 83165 221
9 principal claude-opus-5 329 83584 490
10 principal claude-opus-5 966 83913 193
11 principal claude-opus-5 1835 84879 199
12 principal claude-opus-5 731 86714 282
13 principal claude-opus-5 962 87445 229
14 principal claude-opus-5 23304 88407 1069
15 principal claude-opus-5 1567 111711 4587
16 principal claude-opus-5 5781 113278 239
17 principal claude-opus-5 2921 119059 150
18 principal claude-opus-5 2574 121980 192
19 principal claude-opus-5 377 124554 101
20 principal claude-opus-5 1215 124931 832
21 principal claude-opus-5 1155 126146 1127
22 principal claude-opus-5 1302 127301 161
23 principal claude-opus-5 250 128603 56
24 principal claude-opus-5 92 128853 784
25 principal claude-opus-5 10022 129729 412
26 principal claude-opus-5 821 139751 570
27 principal claude-opus-5 913 140572 167
28 principal claude-opus-5 265 141485 86
29 principal claude-opus-5 868 141750 1121
30 principal claude-opus-5 2722 142618 229
31 principal claude-opus-5 423 145340 93
32 principal claude-opus-5 1312 145763 628
33 principal claude-opus-5 815 147075 2295
34 principal claude-opus-5 2500 147890 201
35 principal claude-opus-5 336 150390 530
36 principal claude-opus-5 705 150726 640
37 principal claude-opus-5 805 151431 156
38 principal claude-opus-5 291 152236 139
39 principal claude-opus-5 534 152527 738
40 principal claude-opus-5 921 153061 1274
41 principal claude-opus-5 1466 153982 1108
42 principal claude-opus-5 1463 155448 430
43 principal claude-opus-5 1200 156911 182
44 principal claude-opus-5 550 158111 548
45 principal claude-opus-5 943 158661 1525
46 principal claude-opus-4-7 36209 0 137
47 principal claude-opus-5 1731 159604 281
48 principal claude-opus-5 1035 161335 999
49 principal claude-opus-5 1079 162370 484
50 principal claude-opus-4-7 23985 36209 5202
51 principal claude-opus-5 790 163449 667
52 principal claude-opus-5 982 164239 902
53 principal claude-opus-4-7 4261 29200 234
54 principal claude-opus-4-7 354 33461 70
55 principal claude-opus-4-7 124 33815 99
56 principal claude-opus-5 1101 165221 87
57 principal claude-opus-4-7 156 33939 117
58 principal claude-opus-4-7 220 34095 122
59 principal claude-opus-5 123 166322 349
60 principal claude-opus-4-7 2714 34315 201
61 principal claude-opus-5 1099 166445 854
62 principal claude-opus-4-7 274 37029 947
63 principal claude-opus-4-7 1001 37303 193
64 principal claude-opus-4-7 327 38304 203
65 principal claude-opus-4-7 257 38631 163
66 principal claude-opus-4-7 426 38888 164
67 principal claude-opus-4-7 218 39314 172
68 principal claude-opus-4-7 625 39532 172
69 principal claude-opus-4-7 380 40157 121
70 principal claude-opus-5 1037 167544 847
71 principal claude-opus-4-7 2854 40537 203
72 principal claude-opus-4-7 257 43391 162
73 principal claude-opus-4-7 216 43648 162
74 principal claude-opus-4-7 232 43864 169
75 principal claude-opus-5 1349 168581 487
76 principal claude-opus-5 605 169930 191
77 principal claude-opus-5 491 170535 903
78 principal claude-opus-4-7 4317 29200 183
79 principal claude-opus-4-7 2625 33517 162
80 principal claude-opus-4-7 2468 36142 159
81 principal claude-opus-5 1095 171026 30
82 principal claude-opus-5 66 172121 884
83 principal claude-opus-5 1062 172187 84
84 principal claude-opus-5 465 173249 86
85 principal claude-opus-5 504 173714 1614
86 principal claude-opus-5 2352 174218 324
87 principal claude-opus-4-7 0 33517 159
88 principal claude-opus-4-7 274 33517 128
89 principal claude-opus-5 6451 176570 546
90 principal claude-opus-4-7 2635 38610 6055
91 principal claude-opus-4-7 3035 33791 2434
92 principal claude-opus-4-7 4740 36826 502
93 principal claude-opus-4-7 10515 41245 1817
94 principal claude-opus-4-7 1891 51760 69
95 principal claude-opus-4-7 3743 41566 1773
96 principal claude-opus-5 5724 183567 557
97 principal claude-opus-5 1662 189291 216
98 principal claude-opus-5 943 190953 837
99 principal claude-opus-5 1896 191896 1926
100 principal claude-opus-5 1966 193792 304
101 principal claude-opus-5 797 195758 733
102 principal claude-opus-5 912 196555 360
103 principal claude-opus-5 1502 197467 274
104 principal claude-opus-5 1116 198969 1459
105 principal claude-opus-5 1664 200085 249
106 principal claude-opus-5 619 201749 590
107 principal claude-opus-5 748 202368 228
108 principal claude-opus-5 352 203116 924
109 principal claude-opus-5 1240 203468 273
110 principal claude-opus-5 1061 204708 549
111 principal claude-opus-5 725 205769 586
112 principal claude-opus-5 799 206494 2583
113 principal claude-opus-5 2616 207293 125
114 principal claude-opus-5 565 209909 2218
115 principal claude-opus-4-7 8364 29200 152
116 principal claude-opus-4-7 238 37564 95
117 principal claude-opus-4-7 264 37802 80
118 principal claude-opus-5 2559 210474 163
119 principal claude-opus-4-7 10268 38066 81
120 principal claude-opus-4-7 2942 48334 80
121 principal claude-opus-5 695 213033 455
122 principal claude-opus-5 1137 213728 514
123 principal claude-opus-5 550 214865 652
124 principal claude-opus-5 751 215415 416
125 principal claude-opus-4-7 5991 51276 4495
126 principal claude-opus-4-7 4569 57267 69
127 principal claude-opus-5 6330 216582 595
128 principal claude-opus-5 1152 222912 92
129 principal claude-opus-5 529 224064 1272
130 principal claude-opus-5 1458 224593 566
131 principal claude-opus-5 881 226051 968
132 principal claude-opus-5 1092 226932 98
133 principal claude-opus-5 1443 228024 1637
134 principal claude-opus-5 2198 229467 2124
135 principal claude-opus-5 2259 231665 177
136 principal claude-opus-5 1904 233924 130
137 principal claude-opus-5 1324 235828 3844
138 principal claude-opus-5 3876 237152 233
139 principal claude-opus-5 325 241028 369
140 principal claude-opus-5 3306 241353 226
141 principal claude-opus-5 365 244659 24
142 principal claude-opus-5 296 245024 307
143 principal claude-opus-5 448 245320 767
144 principal claude-opus-5 867 245768 409
145 principal claude-opus-5 2357 245320 234
146 principal claude-opus-5 1363 247677 1138
147 principal claude-opus-4-7 4670 29200 215
148 principal claude-opus-4-7 311 33870 113
149 principal claude-opus-4-7 196 34181 112
150 principal claude-opus-4-7 202 34377 70
151 principal claude-opus-4-7 124 34579 112
152 principal claude-opus-5 1384 249040 250
153 principal claude-opus-5 302 250424 128
154 principal claude-opus-4-7 3495 34703 1782
155 principal claude-opus-4-7 1911 38198 175
156 principal claude-opus-4-7 229 40109 184
157 principal claude-opus-5 943 250726 402
158 principal claude-opus-4-7 1625 40338 717
159 principal claude-opus-4-7 771 41963 166
160 principal claude-opus-5 858 251669 707
161 principal claude-opus-4-7 394 42734 160
162 principal claude-opus-4-7 244 43128 169
163 principal claude-opus-4-7 223 43372 143
164 principal claude-opus-4-7 227 43595 185
165 principal claude-opus-4-7 403 43822 970
166 principal claude-opus-4-7 1092 44225 305
167 principal claude-opus-4-7 470 45317 894
168 principal claude-opus-4-7 966 45787 989
169 principal claude-opus-5 860 252527 303
170 principal claude-opus-5 403 253387 36
171 principal claude-opus-5 308 253790 241
172 principal claude-opus-5 783 254098 737
173 principal claude-opus-5 838 254881 186
174 principal claude-opus-5 2438 254098 147
175 principal claude-opus-5 899 256536 1349
176 principal claude-opus-5 1439 257435 1506
177 principal claude-opus-5 1609 258874 159
178 principal claude-opus-5 242 260483 415
179 principal claude-opus-5 682 260725 40
180 principal claude-opus-5 312 261407 207
181 principal claude-opus-5 244 261719 418
182 principal claude-opus-5 518 261963 303
183 principal claude-opus-5 1698 261719 383
184 principal claude-opus-5 1102 263417 957
185 principal claude-opus-5 1098 264519 599
186 principal claude-opus-5 725 265617 387
187 principal claude-opus-5 600 266342 873
188 principal claude-opus-5 1000 266942 812
189 principal claude-opus-5 1058 267942 1320
190 principal claude-opus-5 1552 269000 1659
191 principal claude-opus-4-7 11133 29200 138
192 principal claude-opus-4-7 0 40333 130
193 principal claude-opus-5 1850 270552 379
194 principal claude-opus-5 619 272402 143
195 principal claude-opus-5 809 273021 164
196 principal claude-opus-4-7 13492 40333 1078
197 principal claude-opus-4-7 13500 40333 3038
198 principal claude-opus-5 636 273830 209
199 principal claude-opus-5 617 274466 720
200 principal claude-opus-5 898 275083 214
201 principal claude-opus-5 746 275981 235
202 principal claude-opus-5 317 276727 243
203 principal claude-opus-5 453 277044 736
204 principal claude-opus-5 1247 277497 197
205 principal claude-opus-5 369 278744 163
206 principal claude-opus-5 695 279113 347
207 principal claude-opus-5 701 279808 1573
208 principal claude-opus-5 1777 280509 725
209 principal claude-opus-5 991 282286 856
210 principal claude-opus-4-7 4009 29200 174
211 principal claude-opus-5 1288 283277 262
212 principal claude-opus-5 508 284565 309
213 principal claude-opus-5 382 285073 292
214 principal claude-opus-5 824 285455 341
215 principal claude-opus-5 599 286279 552
216 principal claude-opus-5 1084 286878 454
217 principal claude-opus-5 1136 287962 592
218 principal claude-opus-5 1054 289098 2216
219 principal claude-opus-5 2281 290152 221
220 principal claude-opus-5 753 292433 373
221 principal claude-opus-5 518 293186 346
222 principal claude-opus-4-7 24649 33209 9559
223 principal claude-opus-5 576 293704 916
224 principal claude-opus-4-7 9775 57858 1703
225 principal claude-opus-4-7 4224 29200 190
226 principal claude-opus-5 270 295196 120
227 principal claude-opus-5 471 295466 57
228 principal claude-opus-5 354 295937 138
229 principal claude-opus-5 6210 296291 285
230 principal claude-opus-5 386 302501 41
231 principal claude-opus-5 269 302928 230
232 principal claude-opus-5 1099 303197 328
233 principal claude-opus-5 427 304296 474
234 principal claude-opus-5 561 304723 930
235 principal claude-opus-5 1340 305284 281
236 principal claude-opus-5 707 306624 154
237 principal claude-opus-5 28 307485 805
238 principal claude-opus-5 1439 307513 230
239 principal claude-opus-5 1564 308952 91
240 principal claude-opus-5 554 310516 1277
241 principal claude-opus-5 1390 311070 498
242 principal claude-opus-5 830 312460 687
243 principal claude-opus-5 987 313290 312
244 principal claude-opus-5 624 314277 1460
245 principal claude-opus-5 1833 314901 2121
246 principal claude-opus-5 2492 316734 842
247 principal claude-opus-5 1070 319226 1401
248 principal claude-opus-5 1730 320296 1428
249 principal claude-opus-4-7 5324 29200 202
250 principal claude-opus-5 1622 322026 204
251 agent claude-haiku-4-5-20251001 11894 0 4
252 agent claude-haiku-4-5-20251001 1147 11894 2
253 agent claude-haiku-4-5-20251001 340 13041 2
254 agent claude-haiku-4-5-20251001 303 13381 2
255 agent claude-haiku-4-5-20251001 998 13684 2
256 agent claude-haiku-4-5-20251001 339 14682 2
257 agent claude-haiku-4-5-20251001 163 15021 2
258 agent claude-haiku-4-5-20251001 5023 6500 4
259 agent claude-haiku-4-5-20251001 1538 11523 2
260 agent claude-haiku-4-5-20251001 976 13061 2
261 agent claude-haiku-4-5-20251001 347 14037 4
262 agent claude-haiku-4-5-20251001 621 14384 2
263 agent claude-haiku-4-5-20251001 369 15005 2
264 agent claude-haiku-4-5-20251001 172 15374 4
265 agent claude-haiku-4-5-20251001 5000 6500 4
266 agent claude-haiku-4-5-20251001 1316 11500 2
267 agent claude-haiku-4-5-20251001 883 12816 2
268 agent claude-haiku-4-5-20251001 391 13699 1
269 agent claude-haiku-4-5-20251001 639 14090 3
270 agent claude-haiku-4-5-20251001 340 14729 4
271 agent claude-opus-5 16680 25869 1
272 agent claude-opus-5 1760 42549 5
273 agent claude-opus-5 2606 44309 105
274 agent claude-opus-5 4043 46915 20
275 agent claude-opus-5 4412 50958 105
276 agent claude-opus-5 5727 55370 17
277 agent claude-opus-5 4587 61097 5
278 agent claude-opus-5 1118 65684 17
279 agent claude-opus-5 716 66802 2
280 agent claude-opus-5 2563 67518 5
281 agent claude-opus-5 8097 70081 146
282 agent claude-opus-5 1588 78178 3
283 agent claude-opus-5 2139 79766 3
284 agent claude-opus-5 965 81905 4
285 agent claude-opus-5 847 82870 8
286 agent claude-opus-5 3928 83717 7
287 agent claude-haiku-4-5-20251001 12488 0 4
288 agent claude-haiku-4-5-20251001 1585 12488 2
289 agent claude-haiku-4-5-20251001 522 14073 4
290 agent claude-haiku-4-5-20251001 1218 14595 1
291 agent claude-haiku-4-5-20251001 1754 15813 3
292 agent claude-haiku-4-5-20251001 349 17567 4
293 agent claude-haiku-4-5-20251001 12086 0 4
294 agent claude-haiku-4-5-20251001 1310 12086 2
295 agent claude-haiku-4-5-20251001 321 13396 2
296 agent claude-haiku-4-5-20251001 176 13717 3
297 agent claude-haiku-4-5-20251001 265 13893 2
298 agent claude-haiku-4-5-20251001 339 14158 4
299 agent claude-haiku-4-5-20251001 1330 14497 2
300 agent claude-haiku-4-5-20251001 283 15827 5
301 agent claude-opus-5 16102 25869 1
302 agent claude-opus-5 5714 41971 3
303 agent claude-opus-5 5782 47685 3
304 agent claude-opus-5 13799 53467 3
305 agent claude-opus-5 853 67266 3
306 agent claude-opus-5 2167 68119 2
307 agent claude-opus-5 169 70286 195
308 agent claude-opus-5 997 70455 3
309 agent claude-opus-5 852 71452 3
310 agent claude-opus-5 649 72304 3
311 agent claude-opus-5 4003 72953 5
312 agent claude-opus-5 3756 76956 21
313 agent claude-opus-5 515 80712 20
314 agent claude-opus-5 1353 81227 4
315 agent claude-opus-5 1357 82580 2
316 agent claude-opus-5 1614 83937 3
317 agent claude-opus-5 1501 85551 20
318 agent claude-opus-5 1585 87052 7
319 agent claude-opus-5 931 88637 2
320 agent claude-opus-5 423 89568 2
321 agent claude-opus-5 482 89991 2
322 agent claude-opus-5 849 90473 3
323 agent claude-opus-5 693 91322 2
324 agent claude-opus-5 1068 92015 3
325 agent claude-opus-5 585 93083 3
326 agent claude-opus-5 2426 93668 2
327 agent claude-opus-5 1423 96094 3
328 agent claude-opus-5 1016 97517 20
329 agent claude-opus-5 904 98533 3
330 agent claude-opus-5 1352 99437 3
331 agent claude-opus-5 1156 100789 20
332 agent claude-opus-5 458 101945 2
333 agent claude-opus-5 1174 102403 3
334 agent claude-opus-5 1211 103577 3
335 agent claude-opus-5 1185 104788 164
336 agent claude-opus-5 310 105973 3
337 agent claude-opus-5 3354 106283 2
338 agent claude-opus-5 843 109637 5
339 agent claude-opus-5 1224 110480 2
340 agent claude-haiku-4-5-20251001 11679 0 2
341 agent claude-haiku-4-5-20251001 2546 11679 2
342 agent claude-haiku-4-5-20251001 1283 14225 2
343 agent claude-haiku-4-5-20251001 397 15508 2
344 agent claude-haiku-4-5-20251001 12013 0 4
345 agent claude-haiku-4-5-20251001 2412 12013 2
346 agent claude-haiku-4-5-20251001 412 14425 4
347 agent claude-haiku-4-5-20251001 334 14837 2
348 agent claude-haiku-4-5-20251001 1089 15171 3
349 agent claude-haiku-4-5-20251001 308 16260 4
350 agent claude-opus-5 42122 0 1
351 agent claude-opus-5 12834 42122 3
352 agent claude-opus-5 1768 54956 3
353 agent claude-opus-5 991 56724 2
354 agent claude-opus-5 1198 57715 2
355 agent claude-opus-5 404 58913 20
356 agent claude-opus-5 224 59317 2
357 agent claude-opus-5 683 59541 2
358 agent claude-opus-5 1444 60224 3
359 agent claude-opus-5 579 61668 20
360 agent claude-opus-5 639 62247 3
361 agent claude-opus-5 2794 62886 4
362 agent claude-opus-5 861 65680 2
363 agent claude-opus-5 894 66541 2
364 agent claude-opus-5 2460 67435 3
365 agent claude-opus-5 648 69895 2
366 agent claude-opus-5 4581 70543 3
367 agent claude-opus-5 279 75124 3
368 agent claude-opus-5 5345 75403 3
369 agent claude-opus-5 761 80748 7
370 agent claude-opus-5 1170 81509 2
371 agent claude-opus-5 501 82679 3
372 agent claude-opus-5 738 83180 17
373 agent claude-opus-5 1251 83918 2
374 agent claude-opus-5 965 85169 6
375 agent claude-opus-5 1944 86134 2
376 agent claude-opus-5 1576 88078 3
377 agent claude-opus-5 407 89654 3
378 agent claude-opus-5 1342 90061 3
379 agent claude-opus-5 536 91403 2
380 agent claude-opus-5 450 91939 3
381 agent claude-opus-5 67467 25869 17
382 agent claude-opus-5 1510 93336 3
383 agent claude-opus-5 764 94846 2
384 agent claude-opus-5 2620 95610 2
385 agent claude-opus-5 99090 0 17
386 agent claude-opus-5 1334 99090 8
387 agent claude-opus-5 1874 100424 3
388 agent claude-opus-5 5151 102298 20
389 agent claude-opus-5 490 107449 2
390 agent claude-opus-5 1861 107939 2
391 agent claude-opus-5 831 109800 2
392 agent claude-opus-5 1627 110631 2
393 agent claude-opus-5 945 112258 3
394 agent claude-opus-5 756 113203 3
395 agent claude-opus-5 779 113959 2
396 agent claude-opus-5 1506 114738 218
397 agent claude-opus-5 313 116244 3
398 agent claude-opus-5 1810 116557 2
399 agent claude-opus-5 1311 118367 3
400 agent claude-opus-5 1081 119678 2
401 agent claude-haiku-4-5-20251001 11520 0 4
402 agent claude-haiku-4-5-20251001 1344 11520 2
403 agent claude-haiku-4-5-20251001 784 12864 2
404 agent claude-haiku-4-5-20251001 548 13648 1
405 agent claude-haiku-4-5-20251001 576 14196 2
406 agent claude-haiku-4-5-20251001 369 14772 4
407 agent claude-haiku-4-5-20251001 4981 6500 4
408 agent claude-haiku-4-5-20251001 1531 11481 2
409 agent claude-haiku-4-5-20251001 1243 13012 2
410 agent claude-haiku-4-5-20251001 289 14255 4
411 agent claude-haiku-4-5-20251001 4856 6500 4
412 agent claude-haiku-4-5-20251001 1317 11356 2
413 agent claude-haiku-4-5-20251001 9956 12673 1
414 agent claude-haiku-4-5-20251001 381 22629 2
415 agent claude-haiku-4-5-20251001 486 23010 2
416 agent claude-haiku-4-5-20251001 259 23496 4
-->
<!-- /cout -->

### 7. Un motif present, declare absent, parce que grep a trouve trop vite

**Symptome** — la CI refuse la branche sur un cas qui passait en local :

```
./test-init.sh: line 453: printf: write error: Broken pipe
  KO    une app qui ecrase hidden sans regle globale est signalee
        aucune ligne ne porte « ramure] declare display sur une classe »
```

La ligne etait bel et bien la. `35 reussi(s), 1 echec(s)`.

**Cause** — `printf '%s\n' "$sortie" | grep -q -- "$motif"` est une COURSE.
`grep -q` sort des qu'il a trouve et ferme le tuyau ; `printf`, qui a encore de
quoi ecrire, recoit `EPIPE` et rend non nul ; sous `set -o pipefail` le pipeline
rend donc non nul **alors que le motif a ete trouve**, et l'assertion conclut
l'inverse de ce qu'elle observe.

La course preexistait — la forme est dans ces fichiers depuis toujours — mais
elle ne se declenchait qu'a la faveur d'un ordonnancement rare. Jouer quatre cas
de front l'a rendue frequente. C'est donc une faute a moi : je n'ai pas cree le
defaut, j'ai supprime les conditions qui le cachaient.

Reproduit hors CI, de facon deterministe : une sortie de 200 000 lignes dont le
motif est sur la PREMIERE, et l'ancienne forme le declare absent trois fois sur
trois ; la nouvelle le trouve trois fois sur trois.

Corrige dans les quatre fichiers de test, pas seulement la ou il s'est
manifeste : douze assertions lisent desormais par herestring (`<<<`), qui n'a pas
de tuyau a casser. Les pipelines d'AFFICHAGE ont la meme faille par leur
`head -N` final — il ferme le tuyau des qu'il a ses N lignes — et sous `set -e`
la fonction mourrait au milieu, sans rendre son verdict : sept d'entre eux
recoivent une garde.

Le garde-fou d'integrite de `test-init.sh` aurait signale ce second cas — un cas
qui meurt sans verdict s'evanouit du total — mais pas le premier : un faux rouge
se compte comme un rouge.

**Detecte par** — `CI`

**Action** — `contrat` — la forme se represente et rien ne la decrivait ; elle
entre dans `memory/regles-imperatives.md`. **Pas** un garde-fou : distinguer la
petite valeur de la grande demanderait de deviner ce que contient une variable,
et le motif est employe LEGITIMEMENT douze fois sur treize dans le depot, sur des
chaines courtes ou il ne peut pas se declencher. Un `--check` qui les signalerait
toutes crierait a tort douze fois sur treize, et on apprendrait a l'ignorer.

Les trois occurrences reellement exposees — deux sur le contenu d'une feuille de
style dans `init.sh`, une sur une liste de fichiers dans `scripts/pret.sh` — sont
corrigees dans le meme commit, verdicts compares a la version d'origine.

### 8. Un gain annonce a 3,3x, mesure a 2,7x — je comparais deux choses differentes

**Symptome** — j'ai annonce « la CI passe de 9 min 45 a 2 min 56 », dans mes
reponses et dans le corps de la pull request. Le banc d'essai, monte ensuite,
donne 521 s -> 196 s en mediane sur douze runs comparables : un vrai gain, mais
pas celui-la.

**Cause** — les deux nombres ne mesuraient pas la meme chose. Le 9 min 45 vient
d'un run de `main`, qui execute `deploy` ; le 2 min 56 d'un run de pull request,
ou `deploy` est saute. J'ai compare un trajet avec sa derniere etape a un trajet
sans. Les deux nombres etaient exacts ; leur rapport ne voulait rien dire.

Ce qui l'a rendu facile : les deux chiffres venaient de mesures REELLES, prises
avec soin, et chacun etait defendable isolement. Rien dans une mesure juste ne
signale qu'on la compare a autre chose qu'elle-meme.

Le banc d'essai a aussi corrige une seconde croyance : l'acceleration de
`test-pret.sh`, `test-cout.sh` et `test-jetons.sh` — 125 s cumulees, le travail
le plus minutieux de la branche — n'a **rien** rapporte sur l'horloge, parce
qu'aucun de ces scripts n'etait sur le chemin critique. Elle rapporte des minutes
facturees. Je l'aurais compte comme un gain de duree sans le mesurer par etape.

**Detecte par** — `relecture`

**Action** — `comportement` — un rapport avant/apres nomme la METRIQUE avant les
nombres, et deux mesures ne se divisent pas tant qu'on n'a pas dit qu'elles
couvrent le meme perimetre.
