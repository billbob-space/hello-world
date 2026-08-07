# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Un téléphone dont le code est périmé n'a aucune sortie

**Symptome** — signalé par un utilisateur : *« sur le premier compte impossible
de supprimer ou de reauthentifier le compte avec le bon code. il semble bloqué.
je ne veux pas supprimer mon cache car ceci me semble être un bug de gestion des
comptes »*. L'écran répondait « Ce nom est déjà pris, ou le code ne correspond
pas » à chaque geste.

Un nom supprimé puis recréé prend un nouveau code. Le téléphone qui portait
l'ancien garde un lien mort — et **les trois gestes de cet écran renvoient tous
ce même code stocké** : récupérer sa progression, quitter le classement,
supprimer son profil. Le seul écran où l'on saisit un code, lui, disparaît dès
qu'un nom est enregistré. Aucune sortie, sauf vider le navigateur, donc perdre
toute la progression — exactement ce que l'utilisateur refusait de faire, à
raison.

**Cause** — chaque geste, pris seul, est défendable, et deux d'entre eux portent
en commentaire l'argument qui les justifie. « La reprise ne redemande pas de
code : un second formulaire serait une seconde occasion de se tromper. » « La
suppression n'efface rien localement tant que le serveur n'a pas répondu 200 :
effacer d'abord ferait perdre le code. » Les deux sont vrais. Ce qu'aucun ne
voyait, c'est que **le code stocké peut cesser d'être valable**, et qu'alors les
deux précautions se referment l'une sur l'autre.

La règle qui manquait, et qui les concilie : *un refus du code dit que ce
téléphone n'a **déjà** plus aucun droit sur ce nom.* Garder le lien ne protège
plus rien — il n'y a plus rien à protéger. La précaution ne vaut que tant qu'il
reste quelque chose à perdre.

**Detecte par** — `utilisateur`

**Action** — `comportement` — un état local qui **cite** un état distant peut
devenir faux sans que rien ne bouge de ce côté-ci. Chaque fois qu'un écran
conditionne un geste à une valeur stockée, se demander ce qui reste possible
quand cette valeur a péri. Aucun garde-fou ne voit ça : il faudrait qu'il sache
qu'une clé locale désigne une ressource distante.

### 2. La correction de la veille avait supprimé la sortie de secours

**Symptome** — avant le renommage de la veille, « Changer d'enfant » effaçait le
téléphone **sans rien demander au serveur**. C'était laid — le nom restait au
classement, orphelin — mais c'était une issue : le téléphone repartait propre.
En rendant le geste conditionnel à l'accord du serveur, la correction a fermé
cette porte, un jour avant qu'un utilisateur ne vienne la réclamer.

**Cause** — la correction visait le cas « le serveur accepte » et le cas « le
serveur est en panne ». Le cas « le serveur refuse pour toujours » n'a pas été
distingué du second, alors qu'il appelle la décision inverse : la panne dit
*réessaie*, le refus dit *ce n'est plus à toi*. Une seule branche d'échec là où
il en fallait deux.

Plus général, et c'est la leçon : **rendre un geste plus correct le rend souvent
plus fragile**, parce qu'un geste correct dépend de plus de choses. Ce qui a été
retiré ici n'était pas une négligence, c'était une tolérance — et les tolérances
ne se voient qu'une fois enlevées.

**Detecte par** — `utilisateur`

**Action** — `comportement` — en resserrant un geste destructeur, énumérer les
échecs par ce qu'ils **autorisent ensuite**, pas par leur code HTTP : passager
donc réessayable, ou définitif donc à assumer. Deux branches, jamais une.

### 3. L'application fermait elle-même le compte qu'elle essayait d'atteindre

**Symptome** — la synchronisation rejouait trois fois toute requête échouée, à
5, 15 et 45 secondes. Sur un code refusé, cela fait **quatre refus par minute**,
là où le serveur ferme un nom au cinquième par quart d'heure. Deux ouvertures de
l'app fermaient donc le nom.

Et la fermeture porte sur le **nom**, pas sur l'appareil : le téléphone au code
périmé consommait le quota anti-force-brute du compte, donc bloquait le
propriétaire légitime sur son autre téléphone. Ni l'un ni l'autre ne pouvait
faire le lien — le téléphone fautif ne montre rien, l'autre lit « trop d'essais »
sans en avoir fait un seul.

**Cause** — la reprise a été écrite pour la coupure réseau, et appliquée à tout
échec. Un `!resultat.ok` ne distingue pas « le serveur n'a pas répondu » de « le
serveur a répondu non ». Le premier se rejoue, le second jamais : le rejouer ne
le fera pas passer, et ici il coûtait le compte d'un tiers.

**Detecte par** — `auteur` — trouvée en lisant le code pour l'anomalie 1, pas
signalée : personne ne pouvait la voir depuis un écran.

**Action** — `garde-fou` — une reprise automatique ne devrait jamais se poser
sur un 4xx, dans aucune app de la fabrique. C'est une règle assez générale et
assez peu coûteuse pour valoir une ligne du contrat, à côté de ce qui est déjà
dit du rayon de souffle.

### 4. Un diagnostic juste sur un mécanisme, faux sur le cas

**Symptome** — la première hypothèse était la fermeture par trop d'essais :
mécanisme réel, démontré par les tests du serveur, et qui explique bien « il
semble bloqué ». Elle était fausse pour ce cas-ci — l'utilisateur voyait « ce
nom est déjà pris », pas « trop d'essais ». Une question posée avant d'écrire la
moindre ligne a tranché en un aller-retour.

**Cause** — un mécanisme qui *pourrait* produire le symptôme n'est pas le
mécanisme qui l'a produit. La tentation est forte quand on vient de le trouver
dans le code, et qu'il est réel : la découverte fait office de preuve. Le
message d'erreur exact, lui, était à une question de distance.

**Detecte par** — `utilisateur`

**Action** — `comportement` — demander le message affiché **avant** de raconter
la cause. Il départage en un aller-retour ce que la lecture du code laisse
ouvert, et il coûte moins qu'un correctif à jeter — leçon déjà payée le même
jour, à l'anomalie 3 de l'entrée précédente.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 21:15 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 448 | 0,00 $ |
| Écriture de cache | 851 933 | 3,22 $ |
| Lecture de cache | 46 744 800 | 21,59 $ |
| Sortie | 185 994 | 3,38 $ |
| **Total** | **47 783 175** | **28,19 $ — 24,48 €** |

**Ce qui coûte**

- **248 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 515 jetons, écrits une fois par session puis relus à chaque
  échange : 14 453 205 jetons de relecture, 30 % de tout ce qui a été relu.
- **Tours courts** — 92 des 248 tours (37 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 11,40 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 515 jetons relus au premier appel qui relise
  quelque chose, 369 152 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 47783175 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58515 0 477
2 principal claude-opus-5 4752 58515 149
3 principal claude-opus-5 653 63267 175
4 principal claude-opus-5 2527 63920 219
5 principal claude-opus-5 2698 66447 110
6 principal claude-opus-5 158 69145 71
7 principal claude-opus-5 13511 69303 270
8 principal claude-opus-5 6006 82814 202
9 principal claude-opus-5 1528 88820 368
10 principal claude-opus-5 3377 90348 123
11 principal claude-opus-5 2566 93725 298
12 principal claude-opus-5 684 96291 662
13 principal claude-opus-5 5012 96975 913
14 principal claude-opus-5 946 101987 123
15 principal claude-opus-5 451 102933 162
16 principal claude-opus-5 1850 103384 956
17 principal claude-opus-5 1133 105234 834
18 principal claude-opus-5 1017 106367 1511
19 principal claude-opus-5 1721 107384 1162
20 principal claude-opus-5 47 110266 947
21 principal claude-opus-5 3431 110313 183
22 principal claude-opus-5 1843 113744 180
23 principal claude-opus-5 263 115587 102
24 principal claude-opus-5 3583 115850 1709
25 principal claude-opus-5 5056 119433 2073
26 principal claude-opus-5 2088 124489 114
27 principal claude-opus-5 129 126577 207
28 principal claude-opus-5 1806 126706 818
29 principal claude-opus-5 1448 128512 113
30 principal claude-opus-5 1411 129960 222
31 principal claude-opus-5 1860 131371 206
32 principal claude-opus-5 2093 133231 123
33 principal claude-opus-5 1223 135324 234
34 principal claude-opus-5 527 136547 1452
35 principal claude-opus-5 2442 137074 123
36 principal claude-opus-5 1278 139516 327
37 principal claude-opus-5 1902 140794 2152
38 principal claude-opus-5 4345 142696 958
39 principal claude-opus-5 2129 147041 5277
40 principal claude-opus-5 5336 149170 122
41 principal claude-opus-5 478 154506 825
42 principal claude-opus-5 913 154984 1265
43 principal claude-opus-5 1329 155897 1992
44 principal claude-opus-5 2056 157226 255
45 principal claude-opus-5 319 159282 95
46 principal claude-opus-5 509 159601 269
47 principal claude-opus-5 545 160110 102
48 principal claude-opus-5 652 160655 163
49 principal claude-opus-5 602 161307 318
50 principal claude-opus-5 496 161909 90
51 principal claude-opus-5 179 162405 767
52 principal claude-opus-5 6924 162584 141
53 principal claude-opus-5 363 169508 126
54 principal claude-opus-5 1124 169871 361
55 principal claude-opus-5 551 170995 927
56 principal claude-opus-5 986 171546 253
57 principal claude-opus-5 268 172532 113
58 principal claude-opus-5 116 172800 119
59 principal claude-opus-5 182 172916 82
60 principal claude-opus-5 3616 173098 1908
61 principal claude-opus-5 1974 176714 89
62 principal claude-opus-5 776 178688 100
63 principal claude-opus-5 297 179464 351
64 principal claude-opus-5 4413 179761 1556
65 principal claude-opus-5 1726 184174 96
66 principal claude-opus-4-7 12899 28262 128
67 principal claude-opus-5 4413 185900 212
68 principal claude-opus-4-7 216 41161 79
69 principal claude-opus-4-7 865 41377 95
70 principal claude-opus-4-7 0 41161 156
71 principal claude-opus-4-7 19488 42242 145
72 principal claude-opus-5 370 190313 566
73 principal claude-opus-4-7 7944 61730 132
74 principal claude-opus-4-7 244 41161 123
75 principal claude-opus-4-7 182 41405 85
76 principal claude-opus-4-7 269 69674 198
77 principal claude-opus-4-7 119 41587 95
78 principal claude-opus-4-7 503 69943 131
79 principal claude-opus-4-7 19488 41706 248
80 principal claude-opus-4-7 1583 61194 199
81 principal claude-opus-4-7 1486 70446 3173
82 principal claude-opus-4-7 2308 62777 3266
83 principal claude-opus-4-7 5039 71932 3202
84 principal claude-opus-4-7 3364 65085 1876
85 principal claude-opus-4-7 5194 76971 2287
86 principal claude-opus-4-7 13134 28262 126
87 principal claude-opus-4-7 214 41396 133
88 principal claude-opus-5 150370 40941 2343
89 principal claude-opus-5 10763 191311 181
90 principal claude-opus-5 227 202074 121
91 principal claude-opus-5 222 202301 1658
92 principal claude-opus-5 4 204181 2342
93 principal claude-opus-5 2998 204185 134
94 principal claude-opus-5 1764 207183 2350
95 principal claude-opus-5 3037 208947 6485
96 principal claude-opus-5 6542 211984 591
97 principal claude-opus-5 655 218526 296
98 principal claude-opus-5 360 219181 1011
99 principal claude-opus-5 1075 219541 954
100 principal claude-opus-5 1016 220616 745
101 principal claude-opus-5 807 221632 501
102 principal claude-opus-5 563 222439 2637
103 principal claude-opus-5 2829 223002 286
104 principal claude-opus-5 347 225831 123
105 principal claude-opus-5 503 226178 107
106 principal claude-opus-5 327 226681 1303
107 principal claude-opus-5 1364 227008 120
108 principal claude-opus-5 285 228372 617
109 principal claude-opus-5 681 228657 610
110 principal claude-opus-5 674 229338 97
111 principal claude-opus-5 564 230012 1211
112 principal claude-opus-5 1196 230576 117
113 principal claude-opus-5 303 231772 956
114 principal claude-opus-5 1015 232075 1213
115 principal claude-opus-5 1273 233090 2023
116 principal claude-opus-5 2089 234363 147
117 principal claude-opus-5 478 236452 1233
118 principal claude-opus-5 1270 236930 248
119 principal claude-opus-4-7 17331 28262 449
120 principal claude-opus-4-7 535 45593 126
121 principal claude-opus-4-7 184 46128 74
122 principal claude-opus-4-7 106 46312 93
123 principal claude-opus-4-7 0 45593 281
124 principal claude-opus-5 4305 238200 610
125 principal claude-opus-4-7 471 45593 169
126 principal claude-opus-4-7 22958 46064 218
127 principal claude-opus-4-7 5922 46418 95
128 principal claude-opus-4-7 17018 52340 125
129 principal claude-opus-4-7 153 69358 89
130 principal claude-opus-4-7 7888 69511 360
131 principal claude-opus-4-7 388 77399 89
132 principal claude-opus-5 11 243115 113
133 principal claude-opus-5 458 243126 86
134 principal claude-opus-4-7 14116 69022 4276
135 principal claude-opus-5 480 243584 1242
136 principal claude-opus-5 1886 244064 120
137 principal claude-opus-5 2110 245950 137
138 principal claude-opus-5 159 248060 281
139 principal claude-opus-5 383 248219 186
140 principal claude-opus-5 5868 248602 622
141 principal claude-opus-5 1113 254470 257
142 principal claude-opus-4-7 4658 83138 2804
143 principal claude-opus-5 319 255583 262
144 principal claude-opus-4-7 6151 77787 6247
145 principal claude-opus-4-7 6581 83938 1085
146 principal claude-opus-5 9 256164 182
147 principal claude-opus-5 204 256173 132
148 principal claude-opus-5 1758 256377 414
149 principal claude-opus-5 895 258135 1135
150 principal claude-opus-5 9242 259030 1245
151 principal claude-opus-5 1319 268272 231
152 principal claude-opus-5 265 269591 109
153 principal claude-opus-5 436 269856 541
154 principal claude-opus-5 586 270292 462
155 principal claude-opus-5 531 270878 958
156 principal claude-opus-5 1027 271409 153
157 principal claude-opus-5 257 272436 597
158 principal claude-opus-5 699 272693 104
159 principal claude-opus-5 302 273392 262
160 principal claude-opus-5 369 273694 78
161 principal claude-opus-4-7 26355 28262 333
162 principal claude-opus-4-7 383 54617 93
163 principal claude-opus-5 2991 274063 845
164 principal claude-opus-4-7 163 55000 74
165 principal claude-opus-4-7 106 55163 93
166 principal claude-opus-4-7 5922 55269 95
167 principal claude-opus-4-7 17018 61191 133
168 principal claude-opus-5 908 277054 410
169 principal claude-opus-4-7 7932 78209 147
170 principal claude-opus-5 13 278372 134
171 principal claude-opus-4-7 6209 86141 9540
172 principal claude-opus-5 136 278519 134
173 principal claude-opus-5 242 278655 291
174 principal claude-opus-5 12073 278897 242
175 principal claude-opus-5 551 290970 137
176 principal claude-opus-5 321 291521 93
177 principal <synthetic> 0 0 0
178 principal claude-opus-5 1587 291660 155
179 principal claude-opus-5 772 293247 93
180 principal claude-opus-5 129 294019 364
181 principal claude-opus-5 110 294512 2870
182 principal claude-opus-5 6523 294622 216
183 principal claude-opus-5 9459 301145 362
184 principal claude-opus-5 2671 310604 1837
185 principal claude-opus-5 2068 313275 2161
186 principal claude-opus-5 2938 315343 115
187 principal claude-opus-5 917 318281 3328
188 principal claude-opus-5 1602 318398 2487
189 principal claude-opus-5 2741 320000 3063
190 principal claude-opus-5 4056 322741 1806
191 principal claude-opus-5 2077 326797 179
192 principal claude-opus-5 1018 328874 1004
193 principal claude-opus-5 1062 329892 96
194 principal claude-opus-5 470 330954 506
195 principal claude-opus-5 1795 331424 1905
196 principal claude-opus-5 1987 333219 514
197 principal claude-opus-5 688 335206 155
198 principal claude-opus-5 179 335894 582
199 principal claude-opus-5 685 336073 123
200 principal claude-opus-4-7 26320 28262 276
201 principal claude-opus-4-7 326 54582 90
202 principal claude-opus-4-7 205 54908 83
203 principal claude-opus-4-7 3137 55113 82
204 principal claude-opus-4-7 973 58250 82
205 principal claude-opus-4-7 10669 59223 159
206 principal claude-opus-4-7 2302 69892 75
207 principal claude-opus-4-7 126 72194 92
208 principal claude-opus-4-7 122 72320 104
209 principal claude-opus-4-7 2394 72442 81
210 principal claude-opus-4-7 2925 74836 240
211 principal claude-opus-4-7 6921 77761 155
212 principal claude-opus-4-7 10300 84682 1637
213 principal claude-opus-4-7 2013 94982 3254
214 principal claude-opus-5 22 336881 1597
215 principal claude-opus-4-7 3628 96995 449
216 principal claude-opus-4-7 956 100623 1150
217 principal claude-opus-5 1900 336903 1840
218 principal claude-opus-5 3008 338803 131
219 principal claude-opus-5 1404 341811 719
220 principal claude-opus-5 996 343215 94
221 principal claude-opus-5 1034 344211 1045
222 principal claude-opus-5 1639 345245 5575
223 principal claude-opus-5 5634 346884 128
224 principal claude-opus-5 495 352518 767
225 principal claude-opus-5 866 353013 102
226 principal claude-opus-5 297 353879 422
227 principal claude-opus-5 480 354176 256
228 principal claude-opus-5 314 354656 536
229 principal claude-opus-5 594 354970 531
230 principal claude-opus-5 725 355564 569
231 principal claude-opus-5 632 356289 637
232 principal claude-opus-5 701 356921 402
233 principal claude-opus-5 960 357622 511
234 principal claude-opus-5 575 358582 502
235 principal claude-opus-5 566 359157 274
236 principal claude-opus-5 338 359723 577
237 principal claude-opus-5 639 360061 125
238 principal claude-opus-5 487 360700 111
239 principal claude-opus-5 452 361187 655
240 principal claude-opus-5 717 361639 116
241 principal claude-opus-5 173 362356 565
242 principal claude-opus-5 626 362529 118
243 principal claude-opus-5 174 363155 626
244 principal claude-opus-5 1204 363329 459
245 principal claude-opus-5 519 364533 1346
246 principal claude-opus-5 1406 365052 2625
247 principal claude-opus-5 2694 366458 147
248 principal claude-opus-5 375 369152 1858
-->
<!-- /cout -->
