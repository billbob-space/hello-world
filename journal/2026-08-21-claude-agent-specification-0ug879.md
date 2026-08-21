# 2026-08-21 — claude/agent-specification-0ug879

Branche : `claude/agent-specification-0ug879`
Périmètre : fabrique — `.claude/agents/`, `init.sh --check`, `fabrique.yml`, `memory/travail.md`
Mode : `chaud`

Demande initiale : spécifier les agents pour être efficace et économique. L'utilisateur
a ensuite demandé qu'une équipe d'agents soit lancée et que le choix soit tranché par un
banc de mesure plutôt qu'au jugé.

## Anomalies

### 1. `run_in_background: false` reste sans effet — troisième occurrence

**Symptôme** — l'artisan du banc a été lancé avec `run_in_background: false`, seul
réglage qui traduise la règle « l'artisan ne se lance JAMAIS en tâche de fond ». Le
harnais a répondu « Async agent launched successfully. […] The agent is working in the
background ».

**Cause** — le drapeau n'est pas honoré par le harnais cloud. `memory/travail.md`
le signale déjà : « deux entrées de journal rapportent le harnais démarrant en fond un
artisan lancé avec le drapeau explicite ». C'est la troisième.

**Detecte par** — `auteur` — en lisant la réponse de l'outil juste après l'appel.

**Action** — `arbitrage` — la règle « jamais en tâche de fond » n'a aucun moyen
d'exécution : elle décrit une intention que l'outil ignore. Trois options, et le choix
n'est pas le mien : la retirer et lui substituer l'isolation par arbre de travail, qui
elle est effective ; la garder comme intention en disant explicitement qu'elle n'est pas
tenue ; ou sérialiser côté appelant en n'ayant jamais deux agents écrivains en vol. Ce
banc a pris la troisième par prudence, et elle a coûté du temps de mur pour rien.

### 2. Mon relevé de vérité a perdu une valeur entière, un agent l'a vu

**Symptôme** — la vérité de référence du banc de l'analyste annonçait 355 anomalies.
Les trois analystes ont rendu 381, avec une valeur `CI 26` absente de mon relevé.

**Cause** — mon dépouillement filtrait sur `[a-zé]+`. Les sept valeurs de `Detecte par`
sont en minuscules sauf une, `CI`, en majuscules. Le filtre l'écartait en silence : il ne
rendait pas d'erreur, il rendait un total plus petit et parfaitement plausible.

**Detecte par** — `relecture` — en comparant les trois rendus à ma propre référence.
C'est l'agent mesuré qui a corrigé le banc, pas l'inverse.

**Action** — `comportement` — un vocabulaire fermé ne se dépouille pas par classe de
caractères mais par la liste des valeurs admises, celle-là même que `init.sh` contrôle.
Un filtre qui rend un sous-ensemble plausible est pire qu'un filtre qui échoue.

### 3. Deux moteurs réellement facturés sont absents de `tarifs`

**Symptôme** — `./scripts/jetons.sh --leviers` termine par « modele hors tarifs, non
facture : claude-opus-4-7 » et « claude-haiku-4-5-20251001 ». Ces deux moteurs portent
1 088 et 840 appels dans le journal.

**Cause** — `fabrique.yml` déclare `claude-haiku-4-5` quand le modèle se nomme en réalité
`claude-haiku-4-5-20251001`, et n'a jamais reçu `claude-opus-4-7`. Le rapprochement se
fait sur le nom exact, donc silencieusement à vide.

**Detecte par** — `auteur` — la commande le dit elle-même, sous « ce qui manque ».

**Action** — `garde-fou` — tout le travail des agents en haiku est aujourd'hui compté en
jetons et pas en argent, c'est-à-dire invisible dans la seule mesure qui sert à décider.
`jetons.sh` devrait rendre KO, et non signaler en passant, quand un moteur porte des
appels sans tarif.

### 4. L'esthète écrit hors de son arbre de travail, par son navigateur

**Symptôme** — l'esthète du banc travaillait dans un arbre de travail git dédié, sous
`scratchpad/`, et sa mission le lui disait explicitement. À la fin du relevé, huit
fichiers non suivis étaient apparus **à la racine du vrai dépôt** : `.playwright-mcp/`
et sept captures d'écran.

**Cause** — le serveur MCP du navigateur n'écrit pas relativement au répertoire sur
lequel l'agent travaille, mais relativement à la racine de la session. Un agent peut
donc respecter scrupuleusement son périmètre dans tous ses gestes de fichier et salir
malgré tout le dépôt par un geste de navigateur. La règle « tu ne sors pas de
`apps/<nom>/` » ne couvre que ce que l'agent contrôle.

**Detecte par** — `CI` — le garde-fou de commit, qui a refusé de laisser passer huit
fichiers non enregistrés. Sans lui, ils partaient dans le commit suivant.

**Action** — `garde-fou` — `.gitignore` devrait porter `.playwright-mcp/` et les
captures de racine, car aucune consigne d'agent ne peut empêcher un outil d'écrire où
il veut. Le contrat demande à l'esthète de ne pas sortir de son app ; il faut aussi que
le dépôt survive au cas où il en sort sans le vouloir.

### 5. L'esthète coûte dix à vingt fois n'importe quel autre agent, et personne ne l'avait mesuré

**Symptôme** — une seule critique de `cadran`, une app d'un seul écran, a coûté 6,19 $
sur le moteur intermédiaire : 16 745 072 jetons relus, 94 gestes, quinze minutes. Les
huit autres relevés du banc coûtent entre 0,07 $ et 1,95 $.

**Cause** — chaque geste de navigateur ramène une capture ou un arbre d'accessibilité
dans le contexte, et tout le contexte est relu au geste suivant. Le coût croît donc avec
le carré du nombre de gestes, pas linéairement. Aucun plafond ne borne ce nombre.

**Detecte par** — `auteur` — en chiffrant le banc, poste par poste.

**Action** — `garde-fou` — l'esthète est le seul agent dont le coût justifie un plafond
chiffré dans sa consigne, et il est aujourd'hui le seul, avec l'analyste, à ne déclarer
aucun moteur : il tourne donc sur le plus cher, par défaut et non par décision.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 20:03 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 2 036 | 0,00 $ |
| Écriture de cache | 1 435 811 | 7,25 $ |
| Lecture de cache | 54 909 661 | 24,17 $ |
| Sortie | 119 437 | 2,97 $ |
| **Total** | **56 466 945** | **34,40 $ — 29,87 €** |

**Ce qui coûte**

- **540 appel(s) au modèle** — un par réponse, outils compris —, dont 430 par des sous-agents — 35 390 597 jetons, 17,77 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 044 jetons, écrits une fois par session puis relus à chaque
  échange : 7 307 796 jetons de relecture, 13 % de tout ce qui a été relu.
- **Tours courts** — 460 des 540 tours (85 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 21,14 $, soit 61 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 044 jetons relus au premier appel qui relise
  quelque chose, 282 267 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 56466945 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 67044 0 919
2 principal claude-opus-5 7527 67044 491
3 principal claude-opus-5 4599 74571 282
4 principal claude-opus-5 7665 79170 1300
5 principal claude-opus-5 4221 86835 704
6 principal claude-opus-5 5531 91056 1605
7 principal claude-opus-5 2288 96587 257
8 principal claude-opus-5 404 98875 583
9 principal claude-opus-5 814 99279 1609
10 principal claude-opus-5 1768 100093 2008
11 principal claude-opus-5 2204 101861 326
12 principal claude-opus-5 357 104065 3367
13 principal claude-opus-5 179 107789 385
14 principal claude-opus-5 2017 107968 2739
15 principal claude-opus-5 4372 109985 599
16 principal claude-opus-5 2075 114357 969
17 principal claude-opus-5 2428 116432 2202
18 principal claude-opus-5 3847 118860 585
19 principal claude-opus-5 8668 122707 2134
20 principal claude-opus-5 2443 131375 1110
21 principal claude-opus-5 1327 133818 228
22 principal claude-opus-5 837 135145 626
23 principal claude-opus-5 722 135982 1447
24 principal claude-opus-5 1795 136704 1482
25 principal claude-opus-5 1550 138499 3190
26 principal claude-opus-5 5886 140049 1060
27 principal claude-opus-5 1373 145935 281
28 principal claude-opus-5 2565 147308 3043
29 principal claude-opus-5 3149 149873 3206
30 principal claude-opus-5 8973 153022 1542
31 principal claude-opus-5 7521 161995 2100
32 principal claude-opus-5 4895 169516 1671
33 principal claude-opus-5 5157 174411 2048
34 principal claude-opus-5 3353 179568 584
35 principal claude-opus-5 738 182921 1555
36 principal claude-opus-5 1705 183659 416
37 principal claude-opus-5 886 185364 864
38 principal claude-opus-5 1298 186250 694
39 principal claude-opus-5 1574 187548 893
40 principal claude-opus-5 2124 189122 609
41 principal claude-opus-5 964 191246 862
42 principal claude-opus-5 1250 192210 248
43 principal claude-opus-5 1939 193460 1976
44 principal claude-opus-5 2007 195399 1996
45 principal claude-opus-5 2160 197406 878
46 principal claude-opus-5 1141 199566 354
47 principal claude-opus-5 776 200707 333
48 principal claude-opus-5 735 201483 50
49 principal claude-opus-5 2474 200707 248
50 principal claude-opus-5 364 203181 624
51 principal claude-opus-5 730 203545 38
52 principal claude-opus-5 1169 204275 968
53 principal claude-opus-5 1864 205444 266
54 principal claude-opus-5 2037 207308 947
55 principal claude-opus-5 1246 209345 221
56 principal claude-opus-5 362 210591 49
57 principal claude-opus-5 1769 211002 701
58 principal claude-opus-5 742 212771 236
59 principal claude-opus-5 502 213513 1046
60 principal claude-opus-5 1303 214015 1964
61 principal claude-opus-5 2417 215318 2509
62 principal claude-opus-5 2842 217735 43
63 principal claude-opus-5 1496 220620 1441
64 principal claude-opus-5 1994 222116 983
65 principal claude-opus-5 1014 224110 24
66 principal claude-opus-5 287 225124 182
67 principal claude-opus-5 306 225411 886
68 principal claude-opus-5 984 225717 1168
69 principal claude-opus-5 1473 226701 303
70 principal claude-opus-5 697 228174 68
71 principal claude-opus-5 4433 225411 771
72 principal claude-opus-5 1032 229844 284
73 principal claude-opus-5 497 230876 334
74 principal claude-opus-5 736 231373 39
75 principal claude-opus-5 305 232109 107
76 principal claude-opus-5 227 232414 651
77 principal claude-opus-5 1170 232641 298
78 principal claude-opus-5 527 233811 287
79 principal claude-opus-5 3031 232414 303
80 principal claude-opus-5 367 235445 59
81 principal claude-opus-5 143 235871 207
82 principal claude-opus-5 288 236014 633
83 principal claude-opus-5 2236 236935 1238
84 principal claude-opus-5 1508 239171 2168
85 principal claude-opus-5 2529 240679 413
86 principal claude-opus-5 4248 243208 3508
87 principal claude-opus-5 3562 247456 8881
88 principal claude-opus-5 8996 251018 214
89 principal claude-opus-5 610 260014 566
90 principal claude-opus-5 962 260624 816
91 principal claude-opus-5 1079 261586 96
92 principal claude-opus-5 240 262665 325
93 principal claude-opus-5 667 262905 147
94 principal claude-opus-5 251 263572 83
95 principal claude-opus-5 2040 262665 319
96 principal claude-opus-5 408 264705 125
97 principal claude-opus-4-7 6238 29200 1634
98 principal claude-opus-4-7 1722 35438 114
99 principal claude-opus-4-7 204 37160 89
100 principal claude-opus-4-7 2974 37364 3242
101 principal claude-opus-5 264851 0 2039
102 principal claude-opus-5 3608 264851 2539
103 principal claude-opus-5 2710 268459 2064
104 principal claude-opus-5 2219 271169 788
105 principal claude-opus-5 1404 273388 1666
106 principal claude-opus-5 1788 274792 664
107 principal claude-opus-5 1230 276580 811
108 principal claude-opus-5 1076 277810 3327
109 principal claude-opus-5 3381 278886 341
110 principal claude-opus-5 1038 282267 566
111 agent claude-opus-5 11786 0 1
112 agent claude-opus-5 3448 11786 2
113 agent claude-opus-5 11373 15234 3
114 agent claude-opus-5 3789 26607 3
115 agent claude-opus-5 4348 30396 3
116 agent claude-opus-5 3099 34744 3
117 agent claude-opus-5 2287 37843 3
118 agent claude-opus-5 2031 40130 2
119 agent claude-haiku-4-5-20251001 11297 0 1
120 agent claude-haiku-4-5-20251001 1293 11297 2
121 agent claude-haiku-4-5-20251001 629 12590 2
122 agent claude-haiku-4-5-20251001 2471 13219 1
123 agent claude-opus-5 13793 0 1
124 agent claude-opus-5 3861 13793 5
125 agent claude-opus-5 6439 17654 3
126 agent claude-opus-5 3951 24093 2
127 agent claude-opus-5 7117 28044 7
128 agent claude-opus-5 6122 35161 3
129 agent claude-opus-5 371 41283 16
130 agent claude-opus-5 406 41654 2
131 agent claude-opus-5 2329 42060 3
132 agent claude-opus-5 2190 44389 2
133 agent claude-opus-5 2189 46579 2
134 agent claude-opus-5 1239 48768 2
135 agent claude-opus-5 2104 50007 3
136 agent claude-opus-5 1379 52111 2
137 agent claude-opus-5 2335 53490 2
138 agent claude-opus-5 2410 55825 2
139 agent claude-opus-5 321 58235 17
140 agent claude-opus-5 2195 58556 2
141 agent claude-opus-5 963 60751 3
142 agent claude-opus-5 686 61714 6
143 agent claude-opus-5 309 62400 2
144 agent claude-sonnet-5 17594 0 5
145 agent claude-sonnet-5 3464 17594 4
146 agent claude-sonnet-5 988 21058 21
147 agent claude-sonnet-5 5223 22046 9
148 agent claude-sonnet-5 4533 27269 2
149 agent claude-sonnet-5 661 31802 17
150 agent claude-sonnet-5 828 32463 2
151 agent claude-sonnet-5 563 33291 17
152 agent claude-sonnet-5 1140 33854 3
153 agent claude-sonnet-5 259 34994 20
154 agent claude-sonnet-5 4088 35253 2
155 agent claude-sonnet-5 1071 39341 3
156 agent claude-sonnet-5 1082 40412 2
157 agent claude-sonnet-5 802 41494 17
158 agent claude-sonnet-5 2738 42296 2
159 agent claude-sonnet-5 321 45034 2
160 agent claude-sonnet-5 303 45355 5
161 agent claude-sonnet-5 875 45658 17
162 agent claude-sonnet-5 537 46533 6
163 agent claude-sonnet-5 514 47070 3
164 agent claude-sonnet-5 1088 47584 3
165 agent claude-sonnet-5 500 48672 3
166 agent claude-sonnet-5 1328 49172 5
167 agent claude-sonnet-5 355 50500 6
168 agent claude-sonnet-5 428 50855 1
169 agent claude-opus-5 11447 0 1
170 agent claude-opus-5 4450 11447 2
171 agent claude-opus-5 801 15897 3
172 agent claude-opus-5 1637 16698 3
173 agent claude-opus-5 600 18335 4
174 agent claude-opus-5 4536 18935 3
175 agent claude-opus-5 10114 23471 3
176 agent claude-opus-5 4466 33585 7
177 agent claude-opus-5 2214 38051 2
178 agent claude-sonnet-5 14813 0 3
179 agent claude-sonnet-5 2760 14813 2
180 agent claude-sonnet-5 430 17573 3
181 agent claude-sonnet-5 328 18003 7
182 agent claude-sonnet-5 220 18331 3
183 agent claude-sonnet-5 475 18551 3
184 agent claude-sonnet-5 628 19026 2
185 agent claude-sonnet-5 281 19654 2
186 agent claude-sonnet-5 4726 19935 5
187 agent claude-sonnet-5 950 24661 20
188 agent claude-sonnet-5 2786 25611 2
189 agent claude-sonnet-5 3956 28397 3
190 agent claude-sonnet-5 1871 32353 2
191 agent claude-sonnet-5 1113 34224 2
192 agent claude-sonnet-5 594 35337 2
193 agent claude-sonnet-5 398 35931 4
194 agent claude-sonnet-5 632 36329 8
195 agent claude-sonnet-5 901 36961 4
196 agent claude-sonnet-5 2654 37862 3
197 agent claude-sonnet-5 2327 40516 5
198 agent claude-sonnet-5 34118 0 6
199 agent claude-sonnet-5 5171 34118 2
200 agent claude-sonnet-5 199 39289 2
201 agent claude-sonnet-5 1094 39488 3
202 agent claude-sonnet-5 3487 40582 4
203 agent claude-sonnet-5 17156 44069 2
204 agent claude-sonnet-5 622 61225 20
205 agent claude-sonnet-5 5333 61847 3
206 agent claude-sonnet-5 2159 67180 1
207 agent claude-sonnet-5 399 69339 20
208 agent claude-sonnet-5 7140 69738 2
209 agent claude-sonnet-5 1724 76878 2
210 agent claude-sonnet-5 357 78602 20
211 agent claude-sonnet-5 388 78959 5
212 agent claude-sonnet-5 202 79347 20
213 agent claude-sonnet-5 905 79549 38
214 agent claude-sonnet-5 295 80454 2
215 agent claude-sonnet-5 203 80749 2
216 agent claude-sonnet-5 279 80952 41
217 agent claude-sonnet-5 348 81231 8
218 agent claude-sonnet-5 2242 81579 5
219 agent claude-sonnet-5 264 83821 39
220 agent claude-sonnet-5 380 84085 3
221 agent claude-sonnet-5 338 84465 20
222 agent claude-sonnet-5 644 84803 4
223 agent claude-sonnet-5 787 85447 8
224 agent claude-sonnet-5 1755 86234 2
225 agent claude-sonnet-5 801 87989 2
226 agent claude-sonnet-5 996 88790 40
227 agent claude-sonnet-5 488 89786 2
228 agent claude-sonnet-5 1871 90274 3
229 agent claude-sonnet-5 469 92145 17
230 agent claude-sonnet-5 244 92614 8
231 agent claude-sonnet-5 1349 92858 3
232 agent claude-sonnet-5 525 94207 20
233 agent claude-sonnet-5 314 94732 3
234 agent claude-sonnet-5 217 95046 2
235 agent claude-sonnet-5 376 95263 8
236 agent claude-sonnet-5 334 95639 40
237 agent claude-sonnet-5 235 95973 39
238 agent claude-sonnet-5 324 96208 17
239 agent claude-sonnet-5 226 96532 5
240 agent claude-sonnet-5 220 96758 39
241 agent claude-sonnet-5 290 96978 17
242 agent claude-sonnet-5 1936 97268 3
243 agent claude-sonnet-5 688 99204 3
244 agent claude-sonnet-5 445 99892 7
245 agent claude-sonnet-5 1147 100337 3
246 agent claude-sonnet-5 558 101484 4
247 agent claude-sonnet-5 474 102042 41
248 agent claude-sonnet-5 361 102516 1
249 agent claude-sonnet-5 316 102877 17
250 agent claude-sonnet-5 652 103193 6
251 agent claude-sonnet-5 1938 103845 3
252 agent claude-sonnet-5 3497 105783 6
253 agent claude-sonnet-5 456 109280 3
254 agent claude-sonnet-5 1035 109736 20
255 agent claude-sonnet-5 335 110771 17
256 agent claude-sonnet-5 698 111106 5
257 agent claude-sonnet-5 528 111804 6
258 agent claude-sonnet-5 391 112332 20
259 agent claude-sonnet-5 275 112723 20
260 agent claude-sonnet-5 316 112998 39
261 agent claude-sonnet-5 235 113314 5
262 agent claude-sonnet-5 400 113549 6
263 agent claude-sonnet-5 215 113949 2
264 agent claude-sonnet-5 789 114164 4
265 agent claude-sonnet-5 289 114953 9
266 agent claude-sonnet-5 309 115242 3
267 agent claude-sonnet-5 299 115551 4
268 agent claude-sonnet-5 5358 115850 3
269 agent claude-sonnet-5 939 121208 3
270 agent claude-sonnet-5 362 122147 3
271 agent claude-sonnet-5 391 122509 3
272 agent claude-sonnet-5 4967 122900 3
273 agent claude-sonnet-5 821 127867 20
274 agent claude-sonnet-5 364 128688 3
275 agent claude-sonnet-5 557 129052 6
276 agent claude-sonnet-5 5250 129609 2
277 agent claude-sonnet-5 13194 134859 3
278 agent claude-sonnet-5 341 148053 36
279 agent claude-sonnet-5 284 148394 3
280 agent claude-sonnet-5 266 148678 3
281 agent claude-sonnet-5 423 148944 40
282 agent claude-sonnet-5 262 149367 2
283 agent claude-sonnet-5 196 149629 39
284 agent claude-sonnet-5 274 149825 17
285 agent claude-sonnet-5 3138 150099 5
286 agent claude-sonnet-5 557 153237 3
287 agent claude-sonnet-5 903 153794 2
288 agent claude-sonnet-5 566 154697 2
289 agent claude-sonnet-5 720 155263 3
290 agent claude-sonnet-5 349 155983 3
291 agent claude-sonnet-5 266 156332 2
292 agent claude-sonnet-5 298 156598 2
293 agent claude-opus-5 30301 0 1
294 agent claude-opus-5 4744 30301 1
295 agent claude-opus-5 723 35045 17
296 agent claude-opus-5 2394 35768 4
297 agent claude-opus-5 2469 38162 5
298 agent claude-opus-5 462 40631 0
299 agent claude-opus-5 5146 41093 5
300 agent claude-opus-5 2078 46239 20
301 agent claude-opus-5 1685 48317 5
302 agent claude-opus-5 901 50002 17
303 agent claude-opus-5 6305 50903 4
304 agent claude-opus-5 7909 57208 3
305 agent claude-opus-5 7353 65117 3
306 agent claude-opus-5 1341 72470 17
307 agent claude-opus-5 2157 73811 7
308 agent claude-opus-5 711 75968 2
309 agent claude-opus-5 402 76679 16
310 agent claude-opus-5 522 77081 0
311 agent claude-opus-5 501 77603 40
312 agent claude-opus-5 279 78104 3
313 agent claude-opus-5 187 78383 3
314 agent claude-opus-5 1060 78570 21
315 agent claude-opus-5 134 79630 16
316 agent claude-opus-5 160 79764 2
317 agent claude-opus-5 331 79924 16
318 agent claude-opus-5 1948 80255 3
319 agent claude-opus-5 3670 82203 3
320 agent claude-opus-5 670 85873 40
321 agent claude-opus-5 336 86543 0
322 agent claude-opus-5 262 86879 17
323 agent claude-opus-5 195 87141 16
324 agent claude-opus-5 664 87336 2
325 agent claude-opus-5 1781 88000 2
326 agent claude-opus-5 3236 89781 41
327 agent claude-opus-5 888 93017 2
328 agent claude-opus-5 1045 93905 17
329 agent claude-opus-5 191 94950 16
330 agent claude-opus-5 668 95141 3
331 agent claude-opus-5 1693 95809 3
332 agent claude-opus-5 2524 97502 20
333 agent claude-opus-5 1300 100026 3
334 agent claude-opus-5 1454 101326 41
335 agent claude-opus-5 382 102780 9
336 agent claude-opus-5 3666 103162 2
337 agent claude-opus-5 618 106828 20
338 agent claude-opus-5 1583 107446 3
339 agent claude-opus-5 3533 109029 17
340 agent claude-opus-5 775 112562 16
341 agent claude-opus-5 892 113337 5
342 agent claude-opus-5 1194 114229 20
343 agent claude-opus-5 746 115423 4
344 agent claude-opus-5 1930 116169 3
345 agent claude-opus-5 723 118099 16
346 agent claude-opus-5 231 118822 8
347 agent claude-opus-5 2473 119053 17
348 agent claude-opus-5 246 121526 2
349 agent claude-opus-5 523 121772 20
350 agent claude-opus-5 257 122295 16
351 agent claude-opus-5 322 122552 3
352 agent claude-opus-5 1382 122874 2
353 agent claude-opus-5 971 124256 38
354 agent claude-opus-5 219 125227 40
355 agent claude-opus-5 365 125446 3
356 agent claude-opus-5 398 125811 20
357 agent claude-opus-5 819 126209 20
358 agent claude-opus-5 492 127028 8
359 agent claude-opus-5 1037 127520 17
360 agent claude-opus-5 196 128557 16
361 agent claude-opus-5 666 128753 3
362 agent claude-opus-5 2107 129419 17
363 agent claude-opus-5 613 131526 2
364 agent claude-opus-5 467 132139 17
365 agent claude-opus-5 281 132606 17
366 agent claude-opus-5 233 132887 14
367 agent claude-opus-5 1234 133120 20
368 agent claude-opus-5 520 134354 2
369 agent claude-opus-5 750 134874 17
370 agent claude-opus-5 1950 135624 3
371 agent claude-opus-5 1256 137574 14
372 agent claude-opus-5 1145 138830 20
373 agent claude-opus-5 278 139975 20
374 agent claude-opus-5 378 140253 7
375 agent claude-opus-5 711 140631 20
376 agent claude-opus-5 277 141342 17
377 agent claude-opus-5 355 141619 16
378 agent claude-opus-5 665 141974 3
379 agent claude-opus-5 844 142639 20
380 agent claude-opus-5 831 143483 7
381 agent claude-opus-5 926 144314 3
382 agent claude-opus-5 1490 145240 20
383 agent claude-opus-5 234 146730 20
384 agent claude-opus-5 668 146964 2
385 agent claude-opus-5 415 147632 3
386 agent claude-opus-5 891 148047 20
387 agent claude-opus-5 251 148938 16
388 agent claude-opus-5 519 149189 16
389 agent claude-opus-5 929 149708 14
390 agent claude-opus-5 1117 150637 20
391 agent claude-opus-5 337 151754 20
392 agent claude-opus-5 1359 152091 3
393 agent claude-opus-5 836 153450 8
394 agent claude-opus-5 4822 154286 3
395 agent claude-opus-5 17944 159108 3
396 agent claude-opus-5 382 177052 14
397 agent claude-opus-5 1313 177434 20
398 agent claude-opus-5 684 178747 5
399 agent claude-opus-5 2957 179431 3
400 agent claude-opus-5 2208 182388 17
401 agent claude-opus-5 565 184596 3
402 agent claude-opus-5 1155 185161 20
403 agent claude-opus-5 773 186316 3
404 agent claude-opus-5 7222 187089 3
405 agent claude-opus-5 1148 194311 20
406 agent claude-opus-5 1194 195459 4
407 agent claude-opus-5 786 196653 20
408 agent claude-opus-5 209 197439 17
409 agent claude-opus-5 1933 197648 3
410 agent claude-opus-5 2683 199581 20
411 agent claude-opus-5 376 202264 20
412 agent claude-opus-5 1005 202640 2
413 agent claude-opus-5 5041 203645 17
414 agent claude-opus-5 1933 208686 3
415 agent claude-opus-5 748 210619 2
416 agent claude-opus-5 709 211367 7
417 agent claude-opus-5 250 212076 7
418 agent claude-opus-5 9207 212326 17
419 agent claude-opus-5 484 221533 3
420 agent claude-opus-5 604 222017 17
421 agent claude-opus-5 770 222621 3
422 agent claude-opus-5 376 223391 20
423 agent claude-opus-5 283 223767 3
424 agent claude-opus-5 560 224050 20
425 agent claude-opus-5 688 224610 20
426 agent claude-opus-5 246 225298 20
427 agent claude-opus-5 575 225544 20
428 agent claude-opus-5 787 226119 2
429 agent claude-opus-5 1325 226906 3
430 agent claude-opus-5 825 228231 20
431 agent claude-opus-5 214 229056 17
432 agent claude-opus-5 293 229270 17
433 agent claude-opus-5 302 229563 20
434 agent claude-opus-5 402 229865 6
435 agent claude-sonnet-5 15230 0 3
436 agent claude-sonnet-5 2983 15230 2
437 agent claude-sonnet-5 12002 18213 9
438 agent claude-sonnet-5 11298 30215 3
439 agent claude-sonnet-5 1199 41513 2
440 agent claude-sonnet-5 1105 42712 3
441 agent claude-sonnet-5 1035 43817 3
442 agent claude-sonnet-5 477 44852 2
443 agent claude-sonnet-5 1361 45329 2
444 agent claude-sonnet-5 516 46690 10
445 agent claude-sonnet-5 2309 47206 2
446 agent claude-sonnet-5 1423 49515 2
447 agent claude-sonnet-5 1656 50938 3
448 agent claude-sonnet-5 628 52594 1
449 agent claude-haiku-4-5-20251001 11350 0 4
450 agent claude-haiku-4-5-20251001 1423 11350 2
451 agent claude-haiku-4-5-20251001 528 12773 2
452 agent claude-haiku-4-5-20251001 438 13301 2
453 agent claude-haiku-4-5-20251001 381 13739 2
454 agent claude-haiku-4-5-20251001 470 14120 2
455 agent claude-haiku-4-5-20251001 264 14590 4
456 agent claude-haiku-4-5-20251001 11474 0 0
457 agent claude-haiku-4-5-20251001 3442 11474 1
458 agent claude-haiku-4-5-20251001 4393 14916 2
459 agent claude-haiku-4-5-20251001 908 19309 2
460 agent claude-haiku-4-5-20251001 1564 20217 1
461 agent claude-haiku-4-5-20251001 160 21781 2
462 agent claude-haiku-4-5-20251001 3201 21941 1
463 agent claude-haiku-4-5-20251001 381 25142 2
464 agent claude-haiku-4-5-20251001 770 25523 5
465 agent claude-haiku-4-5-20251001 1013 26293 2
466 agent claude-haiku-4-5-20251001 7515 27306 4
467 agent claude-haiku-4-5-20251001 2702 34821 1
468 agent claude-haiku-4-5-20251001 1825 37523 2
469 agent claude-haiku-4-5-20251001 1761 39348 1
470 agent claude-haiku-4-5-20251001 645 41109 2
471 agent claude-haiku-4-5-20251001 1079 41754 2
472 agent claude-haiku-4-5-20251001 1704 42833 2
473 agent claude-haiku-4-5-20251001 11322 0 4
474 agent claude-haiku-4-5-20251001 1448 11322 2
475 agent claude-haiku-4-5-20251001 581 12770 1
476 agent claude-haiku-4-5-20251001 1670 13351 1
477 agent claude-haiku-4-5-20251001 682 15021 3
478 agent claude-haiku-4-5-20251001 386 15703 1
479 agent claude-haiku-4-5-20251001 717 16089 2
480 agent claude-haiku-4-5-20251001 659 16806 2
481 agent claude-haiku-4-5-20251001 160 17465 2
482 agent claude-haiku-4-5-20251001 4555 6768 4
483 agent claude-haiku-4-5-20251001 1485 11323 1
484 agent claude-haiku-4-5-20251001 2516 12808 2
485 agent claude-haiku-4-5-20251001 715 15324 1
486 agent claude-haiku-4-5-20251001 1034 16039 3
487 agent claude-haiku-4-5-20251001 618 17073 2
488 agent claude-haiku-4-5-20251001 439 17691 2
489 agent claude-haiku-4-5-20251001 342 18130 2
490 agent claude-haiku-4-5-20251001 1631 18472 2
491 agent claude-haiku-4-5-20251001 274 20103 4
492 agent claude-haiku-4-5-20251001 347 20377 2
493 agent claude-haiku-4-5-20251001 13596 0 1
494 agent claude-haiku-4-5-20251001 2910 13596 2
495 agent claude-haiku-4-5-20251001 1812 16506 2
496 agent claude-haiku-4-5-20251001 2233 18318 2
497 agent claude-haiku-4-5-20251001 1882 20551 4
498 agent claude-haiku-4-5-20251001 552 22433 2
499 agent claude-haiku-4-5-20251001 685 22985 2
500 agent claude-haiku-4-5-20251001 585 23670 4
501 agent claude-haiku-4-5-20251001 648 24255 2
502 agent claude-haiku-4-5-20251001 731 24903 2
503 agent claude-haiku-4-5-20251001 683 25634 4
504 agent claude-haiku-4-5-20251001 542 26317 4
505 agent claude-haiku-4-5-20251001 904 26859 2
506 agent claude-haiku-4-5-20251001 1410 27763 2
507 agent claude-haiku-4-5-20251001 1906 29173 2
508 agent claude-haiku-4-5-20251001 279 31079 2
509 agent claude-haiku-4-5-20251001 501 31358 2
510 agent claude-haiku-4-5-20251001 204 31859 2
511 agent claude-haiku-4-5-20251001 252 32063 3
512 agent claude-haiku-4-5-20251001 3634 32315 1
513 agent claude-haiku-4-5-20251001 935 35949 2
514 agent claude-haiku-4-5-20251001 257 36884 3
515 agent claude-haiku-4-5-20251001 550 37141 4
516 agent claude-haiku-4-5-20251001 574 37691 2
517 agent claude-haiku-4-5-20251001 622 38265 2
518 agent claude-haiku-4-5-20251001 401 38887 4
519 agent claude-haiku-4-5-20251001 334 39288 4
520 agent claude-haiku-4-5-20251001 313 39622 2
521 agent claude-haiku-4-5-20251001 231 39935 2
522 agent claude-haiku-4-5-20251001 368 40166 4
523 agent claude-haiku-4-5-20251001 11828 0 4
524 agent claude-haiku-4-5-20251001 13051 11828 2
525 agent claude-haiku-4-5-20251001 2158 24879 1
526 agent claude-haiku-4-5-20251001 1380 27037 2
527 agent claude-haiku-4-5-20251001 3158 28417 1
528 agent claude-haiku-4-5-20251001 1718 31575 2
529 agent claude-haiku-4-5-20251001 2996 33293 0
530 agent claude-haiku-4-5-20251001 1417 36289 1
531 agent claude-haiku-4-5-20251001 485 37706 2
532 agent claude-haiku-4-5-20251001 321 38191 1
533 agent claude-haiku-4-5-20251001 408 38512 2
534 agent claude-haiku-4-5-20251001 1991 38920 2
535 agent claude-haiku-4-5-20251001 2102 40911 1
536 agent claude-haiku-4-5-20251001 281 43013 4
537 agent claude-haiku-4-5-20251001 1080 43294 2
538 agent claude-haiku-4-5-20251001 359 44374 2
539 agent claude-haiku-4-5-20251001 513 44733 2
540 agent claude-haiku-4-5-20251001 265 45246 2
-->
<!-- /cout -->
