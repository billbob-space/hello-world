# 2026-08-18 — claude/estran-forecast-beyond-5h-0pjzvx

Branche : `claude/estran-forecast-beyond-5h-0pjzvx`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La navigation temporelle a laisse le jour courant tronque a cinq heures

**Symptome** — un aller-retour utilisateur : impossible de voir la fin de
l'apres-midi sans partir sur demain puis revenir. La donnee etait deja
recuperee et deja servie aux autres jours ; seule la journee en cours restait
coupee a cinq vignettes.

**Cause** — prp/01 s'etait donne pour contrainte principale de laisser l'ecran
d'aujourd'hui identique a l'octet pres, et a livre les vingt-quatre heures
« pour un jour autre qu'aujourd'hui ». Cette formulation, ecrite pour proteger
l'ecran d'ouverture, a fige une asymetrie que personne n'avait choisie : le
seul jour qu'on regarde vraiment etait le seul a ne pas avoir le detail.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une capacite s'ajoute « pour les autres
cas », verifier ce qu'elle laisse au cas par defaut : ne pas toucher a l'ecran
d'ouverture est une precaution, pas un objectif.

### 2. Au bord de la fenetre, l'absence se decodait en zero

**Symptome** — application lancee en local et interrogee pour de vrai : le
seizieme jour de tendance annoncait « 0 °C, vent 0 km/h, rafales 0 », et la
journee entiere affichait « pluie 0 % » et « vagues 0,0 m ». Ni la
compilation, ni `go vet`, ni les tests, ni la relecture du diff ne l'avaient
signale — la seule chose qui l'ait montre est un appel a la vraie API.

**Cause** — Open-Meteo rend `null` au bord de sa fenetre, sur des grandeurs
distinctes et a des profondeurs distinctes (journalier au dernier jour, pluie
horaire sur la derniere journee, vagues nulles sur les 24 heures). Decodees en
`float64`, ces absences deviennent la valeur zero, qui est ici **credible** :
« 0 % de pluie » ne ressemble pas a une donnee manquante. Le PRP decrivait
pourtant la degradation attendue en bord de fenetre pour les vagues seules,
heritee de prp/01 — la regle etait ecrite, mais pour un seul champ, et
personne ne l'a generalisee en passant de huit a seize jours.

**Detecte par** — `auteur`

**Action** — `comportement` — elargir une fenetre de donnees, c'est s'approcher
du bord ou le fournisseur cesse de repondre : lancer l'app et regarder le
DERNIER element, pas le premier. Un test sur une donnee figee ne peut pas
trouver ca, il ne contient que ce qu'on a pense a y mettre.

### 3. Deux modeles d'accord affichaient « confiance haute »

**Symptome** — sur la vraie reponse, les jours J+9 a J+12 portaient une
confiance haute alors que quatre modeles sur six ne repondaient plus. L'indice
disait le contraire de ce qu'il est cense dire, precisement la ou l'incertitude
est maximale.

**Cause** — la regle que j'avais ecrite mesurait la DISPERSION entre modeles
survivants sans jamais regarder leur NOMBRE, au-dela d'un plancher a deux. Deux
modeles qui s'accordent ne font pas un accord, mais la formule ne pouvait pas
le savoir. Erreur de conception, pas d'implementation.

**Detecte par** — `auteur`

**Action** — `rien` — reparee par un plafond (« moyenne » au plus sous trois
modeles) ecrit dans le PRP et dans le code ; rien a en tirer pour la fabrique.

### 4. Un test capturait la mauvaise requete sortante, en silence

**Symptome** — rapporte par l'artisan : le test qui verifie la fenetre demandee
au fournisseur meteo capturait la requete dans une variable partagee par un
handler unique. L'appel d'accord entre modeles partageant la meme URL de base,
il ecrasait la requete capturee, et le test aurait continue a passer en
verifiant la mauvaise.

**Cause** — un test double qui ne distingue pas deux appels distincts vers le
meme hote ne verifie pas ce que son nom annonce. Le defaut est apparu quand un
troisieme appel sortant est arrive, pas quand le test a ete ecrit.

**Detecte par** — `auteur`

**Action** — `rien` — repare en distinguant les deux requetes sur la presence
du parametre `models`.

### 5. Un test comparait un nombre d'heures a une constante, avec l'heure reelle

**Symptome** — rapporte par l'artisan : le test de la reponse sans parametre
utilisait `time.Now()` et exigeait exactement cinq vignettes. Avec la nouvelle
regle (les heures restantes du jour, minimum cinq), cette egalite devient
fausse selon l'heure a laquelle la CI tourne — vert en local le soir, rouge en
CI a midi.

**Cause** — un test qui depend de l'horloge reelle et fige une egalite stricte
mesure l'heure autant que le code. Le reste du domaine passe deja `maintenant`
en parametre explicite pour cette raison ; ce test-la ne le faisait pas.

**Detecte par** — `auteur`

**Action** — `rien` — repare en comparant au plancher plutot qu'a l'egalite ;
le vice de forme est connu et deja evite partout ailleurs dans cette app.

### 6. Trois defauts visibles seulement a l'ecran, sous des verifications DOM vertes

**Symptome** — captures prises sur l'app reelle a 390 et 1280 de large : les
barres de l'indice de confiance se superposaient au texte du vent, la tendance
avait acquis un defilement interne qui coupait une ligne en deux au bas du
cadre et cachait dix jours sur quinze derriere une seconde barre de
defilement, et le titre annoncait « Tendance a 16 jours » au-dessus de quinze
lignes. Les verifications faites au selecteur — presence des classes, valeurs
de `getComputedStyle`, comptes d'elements — etaient toutes vertes.

**Cause** — interroger le DOM repond a « l'element est-il la, avec la bonne
regle CSS ? », jamais a « qu'est-ce qu'on voit ? ». Un chevauchement, une
troncature et un titre qui contredit son contenu sont exactement les trois
choses qu'un selecteur ne peut pas voir. Le titre, lui, est un cas a part : il
etait ecrit en dur alors que le nombre de jours rendus depend desormais du
fournisseur — la correction de degradation l'a rendu faux sans le toucher.

**Detecte par** — `relecture`

**Action** — `comportement` — sur un changement d'interface, regarder la
capture avant de conclure ; une assertion DOM verte n'est pas une preuve
visuelle. Et une valeur ecrite en dur dans le HTML devient un mensonge des que
la donnee qu'elle resume se met a varier.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-18 à 10:26 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 644 | 0,00 $ |
| Écriture de cache | 1 211 009 | 5,06 $ |
| Lecture de cache | 72 849 761 | 24,41 $ |
| Sortie | 59 799 | 1,46 $ |
| **Total** | **74 121 213** | **30,93 $ — 26,86 €** |

**Ce qui coûte**

- **322 appel(s) au modèle** — un par réponse, outils compris —, dont 234 par des sous-agents — 61 096 754 jetons, 21,84 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 046 jetons, écrits une fois par session puis relus à chaque
  échange : 5 572 002 jetons de relecture, 7 % de tout ce qui a été relu.
- **Tours courts** — 268 des 322 tours (83 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 24,78 $, soit 80 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 046 jetons relus au premier appel qui relise
  quelque chose, 197 939 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 74121213 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 64046 0 393
2 principal claude-opus-5 1593 64046 193
3 principal claude-opus-5 1969 65639 179
4 principal claude-opus-5 4783 67608 214
5 principal claude-opus-5 2420 72391 222
6 principal claude-opus-5 674 74811 89
7 principal claude-opus-5 1811 75485 830
8 principal claude-opus-5 11016 77296 1550
9 principal claude-opus-5 1901 88312 745
10 principal claude-opus-5 5897 90213 195
11 principal claude-opus-5 3886 96110 292
12 principal claude-opus-5 498 99996 108
13 principal claude-opus-5 1236 100494 762
14 principal claude-opus-5 1095 102494 1003
15 principal claude-opus-5 2579 103589 1936
16 principal claude-opus-5 2134 106168 1134
17 principal claude-opus-5 1653 108302 676
18 principal claude-opus-5 1651 109955 2615
19 principal claude-opus-5 4993 111606 138
20 principal claude-opus-5 2656 116599 137
21 principal claude-opus-5 698 119255 768
22 principal claude-opus-5 1354 119953 339
23 principal claude-opus-5 1307 121307 5347
24 principal claude-opus-5 5377 122614 841
25 principal claude-opus-5 1144 127991 2433
26 principal claude-opus-5 2835 129135 1216
27 principal claude-opus-5 1248 131970 333
28 principal claude-opus-5 616 133218 706
29 principal claude-opus-5 915 133834 401
30 principal claude-opus-5 700 134749 1104
31 principal claude-opus-5 1170 135449 110
32 principal claude-opus-5 332 136619 160
33 principal claude-opus-5 5928 133834 212
34 principal claude-opus-5 663 139762 97
35 principal claude-opus-5 1044 140425 197
36 principal claude-opus-5 2676 141469 328
37 principal claude-opus-5 396 144145 104
38 principal claude-opus-5 1404 144541 638
39 principal claude-opus-5 906 145945 140
40 principal claude-opus-5 194 146851 495
41 principal claude-opus-5 1231 147045 770
42 principal claude-opus-5 1068 148276 1136
43 principal claude-opus-5 1264 149344 2431
44 principal claude-opus-5 2552 150608 1415
45 principal claude-opus-5 1446 153160 1368
46 principal claude-opus-5 1498 154606 836
47 principal claude-opus-5 1187 156104 1976
48 principal claude-opus-5 2358 157291 589
49 principal claude-opus-5 875 159649 162
50 principal claude-opus-5 236 160524 351
51 principal claude-opus-5 3288 160760 942
52 principal claude-opus-5 1190 164048 549
53 principal claude-opus-5 636 165238 910
54 principal claude-opus-5 1013 165874 66
55 principal claude-opus-5 6975 160524 28
56 principal claude-opus-5 447 167499 743
57 principal claude-opus-5 844 167946 57
58 principal claude-opus-5 120 168790 84
59 principal claude-opus-5 286 168910 1188
60 principal claude-opus-5 1380 169196 109
61 principal claude-opus-5 217 170576 71
62 principal claude-opus-5 2427 170864 609
63 principal claude-opus-5 798 173291 372
64 principal claude-opus-5 466 174089 160
65 principal claude-opus-5 298 174555 765
66 principal claude-opus-5 1455 174853 464
67 principal claude-opus-5 1464 176308 87
68 principal claude-opus-5 180 177772 303
69 principal claude-opus-5 711 177952 145
70 principal claude-opus-5 317 178663 676
71 principal claude-opus-5 862 178980 335
72 principal claude-opus-5 1154 179842 381
73 principal claude-opus-5 2432 180996 1558
74 principal claude-opus-5 1688 183428 1243
75 principal claude-opus-5 1791 185116 759
76 principal claude-opus-5 790 186907 78
77 principal claude-opus-5 141 187697 77
78 principal claude-opus-5 279 187838 338
79 principal claude-opus-5 859 188117 62
80 principal claude-opus-5 2160 189038 366
81 principal claude-opus-5 437 191198 264
82 principal claude-opus-5 510 191635 194
83 principal claude-opus-5 414 192145 110
84 principal claude-opus-5 1065 192559 226
85 principal claude-opus-5 3415 193624 513
86 principal claude-opus-5 542 197039 105
87 principal claude-opus-5 358 197581 958
88 principal claude-opus-5 1142 197939 136
89 agent claude-sonnet-5 18761 0 4
90 agent claude-sonnet-5 2297 18761 2
91 agent claude-sonnet-5 3540 21058 9
92 agent claude-sonnet-5 638 24598 20
93 agent claude-sonnet-5 5613 25236 14
94 agent claude-sonnet-5 7112 30849 7
95 agent claude-sonnet-5 4726 37961 3
96 agent claude-sonnet-5 5215 42687 5
97 agent claude-sonnet-5 6668 47902 14
98 agent claude-sonnet-5 6765 54570 5
99 agent claude-sonnet-5 719 61335 6
100 agent claude-sonnet-5 12812 62054 2
101 agent claude-sonnet-5 9784 74866 3
102 agent claude-sonnet-5 17956 84650 14
103 agent claude-sonnet-5 1336 102606 5
104 agent claude-sonnet-5 12386 103942 4
105 agent claude-sonnet-5 6251 116328 2
106 agent claude-sonnet-5 445 122579 17
107 agent claude-sonnet-5 524 123024 16
108 agent claude-sonnet-5 1293 123548 5
109 agent claude-sonnet-5 1223 124841 7
110 agent claude-sonnet-5 1523 126064 14
111 agent claude-sonnet-5 759 127587 17
112 agent claude-sonnet-5 1491 128346 5
113 agent claude-sonnet-5 1853 129837 20
114 agent claude-sonnet-5 550 131690 17
115 agent claude-sonnet-5 4359 132240 5
116 agent claude-sonnet-5 183 136599 1
117 agent claude-sonnet-5 953 136782 3
118 agent claude-sonnet-5 1342 137735 6
119 agent claude-sonnet-5 703 139077 3
120 agent claude-sonnet-5 767 139780 1
121 agent claude-sonnet-5 802 140547 20
122 agent claude-sonnet-5 672 141349 5
123 agent claude-sonnet-5 308 142021 9
124 agent claude-sonnet-5 333 142329 17
125 agent claude-sonnet-5 296 142662 6
126 agent claude-sonnet-5 836 142958 4
127 agent claude-sonnet-5 362 143794 17
128 agent claude-sonnet-5 956 144156 7
129 agent claude-sonnet-5 676 145112 6
130 agent claude-sonnet-5 228 145788 3
131 agent claude-sonnet-5 2433 146016 3
132 agent claude-sonnet-5 1556 148449 9
133 agent claude-sonnet-5 2042 150005 2
134 agent claude-sonnet-5 1699 152047 20
135 agent claude-sonnet-5 598 153746 3
136 agent claude-sonnet-5 922 154344 2
137 agent claude-sonnet-5 627 155266 1307
138 agent claude-sonnet-5 1402 155893 6
139 agent claude-sonnet-5 224 157295 3
140 agent claude-sonnet-5 1343 157519 3
141 agent claude-sonnet-5 1159 158862 3
142 agent claude-sonnet-5 755 160021 4
143 agent claude-sonnet-5 1947 160776 3
144 agent claude-sonnet-5 639 162723 6
145 agent claude-sonnet-5 145 163362 7
146 agent claude-sonnet-5 4100 163507 3
147 agent claude-sonnet-5 1452 167607 3
148 agent claude-sonnet-5 2656 169059 4
149 agent claude-sonnet-5 1879 171715 3
150 agent claude-sonnet-5 1201 173594 3
151 agent claude-sonnet-5 1217 174795 20
152 agent claude-sonnet-5 2752 176012 5
153 agent claude-sonnet-5 711 178764 6
154 agent claude-sonnet-5 2918 179475 6
155 agent claude-sonnet-5 256 182393 20
156 agent claude-sonnet-5 4509 182649 1
157 agent claude-sonnet-5 4703 187158 8
158 agent claude-sonnet-5 298 191861 2
159 agent claude-sonnet-5 438 192159 17
160 agent claude-sonnet-5 400 192597 7
161 agent claude-sonnet-5 795 192997 4
162 agent claude-sonnet-5 782 193792 6
163 agent claude-sonnet-5 772 194574 4
164 agent claude-sonnet-5 1519 195346 20
165 agent claude-sonnet-5 3155 196865 2
166 agent claude-sonnet-5 645 200020 6
167 agent claude-sonnet-5 856 200665 6
168 agent claude-sonnet-5 943 201521 17
169 agent claude-sonnet-5 649 202464 2
170 agent claude-sonnet-5 611 203113 5
171 agent claude-sonnet-5 381 203724 14
172 agent claude-sonnet-5 755 204105 9
173 agent claude-sonnet-5 1358 204860 4
174 agent claude-sonnet-5 2152 206218 2
175 agent claude-sonnet-5 1180 208370 5
176 agent claude-sonnet-5 584 209550 16
177 agent claude-sonnet-5 859 210134 2
178 agent claude-sonnet-5 1607 210993 14
179 agent claude-sonnet-5 514 212600 5
180 agent claude-sonnet-5 816 213114 5
181 agent claude-sonnet-5 571 213930 3
182 agent claude-sonnet-5 1644 214501 3
183 agent claude-sonnet-5 376 216145 20
184 agent claude-sonnet-5 640 216521 4
185 agent claude-sonnet-5 453 217161 20
186 agent claude-sonnet-5 391 217614 17
187 agent claude-sonnet-5 391 218005 8
188 agent claude-sonnet-5 439 218396 9
189 agent claude-sonnet-5 189 218835 8
190 agent claude-sonnet-5 325 219024 3
191 agent claude-sonnet-5 2195 219349 7
192 agent claude-sonnet-5 2598 221544 9
193 agent claude-sonnet-5 1532 224142 1
194 agent claude-sonnet-5 184 225674 20
195 agent claude-sonnet-5 345 225858 2
196 agent claude-sonnet-5 176 226203 8
197 agent claude-sonnet-5 1745 226379 2
198 agent claude-sonnet-5 716 228124 2
199 agent claude-sonnet-5 297 228840 3
200 agent claude-sonnet-5 242 229137 78
201 agent claude-sonnet-5 152 229379 2
202 agent claude-sonnet-5 209276 11469 4
203 agent claude-sonnet-5 6239 220745 2
204 agent claude-sonnet-5 22604 226984 2
205 agent claude-sonnet-5 11737 249588 9
206 agent claude-sonnet-5 2316 261325 5
207 agent claude-sonnet-5 1617 263641 20
208 agent claude-sonnet-5 562 265258 2
209 agent claude-sonnet-5 2536 265820 3
210 agent claude-sonnet-5 546 268356 3
211 agent claude-sonnet-5 1273 268902 3
212 agent claude-sonnet-5 6662 270175 5
213 agent claude-sonnet-5 2110 276837 3
214 agent claude-sonnet-5 3838 278947 4
215 agent claude-sonnet-5 579 282785 5
216 agent claude-sonnet-5 4057 283364 4
217 agent claude-sonnet-5 247 287421 4
218 agent claude-sonnet-5 8693 287668 3
219 agent claude-sonnet-5 3017 296361 17
220 agent claude-sonnet-5 507 299378 4
221 agent claude-sonnet-5 601 299885 3
222 agent claude-sonnet-5 817 300486 9
223 agent claude-sonnet-5 1131 301303 4
224 agent claude-sonnet-5 667 302434 17
225 agent claude-sonnet-5 437 303101 4
226 agent claude-sonnet-5 2327 303538 9
227 agent claude-sonnet-5 263 305865 1
228 agent claude-sonnet-5 349 306128 16
229 agent claude-sonnet-5 2176 306477 3
230 agent claude-sonnet-5 2286 308653 3
231 agent claude-sonnet-5 341 310939 2
232 agent claude-sonnet-5 11326 311280 6
233 agent claude-sonnet-5 782 322606 17
234 agent claude-sonnet-5 682 323388 5
235 agent claude-sonnet-5 1182 324070 21
236 agent claude-sonnet-5 375 325252 3
237 agent claude-sonnet-5 1523 325627 3
238 agent claude-sonnet-5 4310 327150 3
239 agent claude-sonnet-5 1020 331460 5
240 agent claude-sonnet-5 385 332480 2
241 agent claude-sonnet-5 5278 332865 3
242 agent claude-sonnet-5 1317 338143 20
243 agent claude-sonnet-5 1502 339460 3
244 agent claude-sonnet-5 1475 340962 5
245 agent claude-sonnet-5 1396 342437 6
246 agent claude-sonnet-5 1908 343833 9
247 agent claude-sonnet-5 157 345741 20
248 agent claude-sonnet-5 5499 345898 3
249 agent claude-sonnet-5 642 351397 20
250 agent claude-sonnet-5 702 352039 17
251 agent claude-sonnet-5 992 352741 2
252 agent claude-sonnet-5 1204 353733 14
253 agent claude-sonnet-5 391 354937 3
254 agent claude-sonnet-5 2232 355328 4
255 agent claude-sonnet-5 1003 357560 2
256 agent claude-sonnet-5 224 358563 6
257 agent claude-sonnet-5 223 358787 4
258 agent claude-sonnet-5 301 359010 338
259 agent claude-sonnet-5 459 359311 2
260 agent claude-sonnet-5 262 359770 20
261 agent claude-sonnet-5 239 360032 4
262 agent claude-sonnet-5 1411 360271 3
263 agent claude-sonnet-5 314 361682 20
264 agent claude-sonnet-5 131 361996 4
265 agent claude-sonnet-5 183 362127 20
266 agent claude-sonnet-5 661 362310 1
267 agent claude-sonnet-5 252 362971 5
268 agent claude-sonnet-5 380 363223 2
269 agent claude-sonnet-5 346085 11469 7
270 agent claude-sonnet-5 3547 357554 5
271 agent claude-sonnet-5 996 361101 2
272 agent claude-sonnet-5 873 362097 5
273 agent claude-sonnet-5 1371 362970 3
274 agent claude-sonnet-5 4139 364341 3
275 agent claude-sonnet-5 639 368480 7
276 agent claude-sonnet-5 716 369119 3
277 agent claude-sonnet-5 1553 369835 2
278 agent claude-sonnet-5 467 371388 20
279 agent claude-sonnet-5 699 371855 3
280 agent claude-sonnet-5 820 372554 5
281 agent claude-sonnet-5 386 373374 20
282 agent claude-sonnet-5 279 373760 4
283 agent claude-sonnet-5 288 374039 5
284 agent claude-sonnet-5 206 374327 20
285 agent claude-sonnet-5 212 374533 6
286 agent claude-sonnet-5 3039 374745 4
287 agent claude-sonnet-5 2050 377784 2
288 agent claude-sonnet-5 4199 379834 3
289 agent claude-sonnet-5 618 384033 3
290 agent claude-sonnet-5 504 384651 5
291 agent claude-sonnet-5 632 385155 2
292 agent claude-sonnet-5 2315 385787 2
293 agent claude-sonnet-5 2951 388102 20
294 agent claude-sonnet-5 541 391053 7
295 agent claude-sonnet-5 4282 391594 2
296 agent claude-sonnet-5 1010 395876 3
297 agent claude-sonnet-5 715 396886 1
298 agent claude-sonnet-5 814 397601 3
299 agent claude-sonnet-5 1580 398415 3
300 agent claude-sonnet-5 3609 399995 2
301 agent claude-sonnet-5 3519 403604 9
302 agent claude-sonnet-5 5269 407123 3
303 agent claude-sonnet-5 184 412392 20
304 agent claude-sonnet-5 711 412576 2
305 agent claude-sonnet-5 3169 413287 6
306 agent claude-sonnet-5 247 416456 20
307 agent claude-sonnet-5 609 416703 20
308 agent claude-sonnet-5 336 417312 6
309 agent claude-sonnet-5 877 417648 4
310 agent claude-sonnet-5 2138 418525 2
311 agent claude-sonnet-5 477 420663 2
312 agent claude-sonnet-5 2154 421140 2
313 agent claude-sonnet-5 1403 423294 3
314 agent claude-sonnet-5 3659 424697 2
315 agent claude-sonnet-5 1825 428356 20
316 agent claude-sonnet-5 160 430181 2
317 agent claude-sonnet-5 220 430341 20
318 agent claude-sonnet-5 357 430561 5
319 agent claude-sonnet-5 449 430918 2
320 agent claude-sonnet-5 742 431367 3
321 agent claude-sonnet-5 342 432109 4
322 agent claude-sonnet-5 698 432451 1
-->
<!-- /cout -->

## Suite : la mise en ligne, apres la fusion

Perimetre de cette seconde partie : `estran` et la fabrique (chaine de
deploiement).

### 7. La CI ne peut plus enregistrer les versions sur main — rien ne se deploie

**Symptome** — PR #139 fusionnee, tous les jobs verts, image publiee, puis le
job `deploy` echoue a l'etape « enregistrer les versions deployees » :
`GH013: Repository rule violations found for refs/heads/main`, « 2 of 2
required status checks are expected », quatre tentatives, puis
« impossible d'enregistrer les versions sur main — rien n'est deploye ». Le
webhook dockhand n'est pas appele, le conteneur en ligne affiche toujours
`Up 43 hours`.

**Cause** — une regle de protection de `main` exige des controles de statut sur
tout ce qui y est pousse. La CI, elle, pousse un commit d'epinglage
directement, avec `[skip ci]` — donc les controles exiges ne s'executeront
jamais sur ce commit, et la regle le refusera toujours. Ce n'est pas une
condition de course : c'est une impasse structurelle, et la meme panne avait
deja eu lieu le 16 aout (run 31963069804), avant ce travail.

**Ce qui ne repare PAS** — trois pistes essayees sur le papier et ecartees
avant d'ecrire une ligne :

- *ouvrir une pull request depuis la CI et la fusionner automatiquement* :
  GitHub ne declenche aucun workflow pour un evenement produit par
  `GITHUB_TOKEN`. Les controles exiges ne tourneraient donc pas sur cette PR,
  la fusion automatique attendrait indefiniment, et la fusion elle-meme ne
  declencherait pas le deploiement ;
- *rendre l'echec non bloquant et appeler quand meme le webhook* : dockhand
  clone le depot et deploie ce qu'il y lit. Sans le commit d'epinglage, il
  redeploierait l'ancienne image en croyant travailler ;
- *renoncer a l'epinglage* (tag mouvant du genre `:main`) : le compose ne
  changerait plus jamais, et dockhand recreerait les neuf conteneurs a chaque
  appel au lieu du seul service livre.

**Ce qui repare vraiment** — deux gestes, tous deux hors du depot : autoriser
le robot de la CI a contourner la regle (acteur de contournement sur la
ruleset), ou lui donner un jeton qui la contourne. Le depot ne peut pas se
sortir seul d'une regle qui s'applique a lui.

**Contournement applique en attendant** — l'epinglage pousse par pull request
depuis une branche ordinaire, comme le 16 aout : les controles tournent
normalement, la fusion pousse sur `main`, et c'est cette poussee qui declenche
le deploiement.

**Detecte par** — `CI`

**Action** — `arbitrage` — le correctif durable est un reglage GitHub, pas un
changement de code : il appartient a l'exploitant du depot.
