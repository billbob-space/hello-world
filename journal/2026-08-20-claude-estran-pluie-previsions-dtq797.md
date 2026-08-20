# 2026-08-20 — claude/estran-pluie-previsions-dtq797

Branche : `claude/estran-pluie-previsions-dtq797`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. Le pourcentage des vignettes horaires se lit comme une quantite de pluie

**Symptome** — l'utilisateur signale une incoherence : la courbe de la section
pluie annonce 0 mm pour tout l'apres-midi du 20 aout, tandis que les vignettes
« les prochaines heures » affichent 98 %, 100 %, 98 % sur les memes heures. La
bande de la prochaine heure (Meteo-France) dit « temps sec ». Verifie en direct
sur les trois sources : aucune ne se trompe.

**Cause** — trois sources alimentent la meme page et deux d'entre elles ne
mesurent pas la meme grandeur. Les millimetres viennent du modele a maille fine
(AROME 1,5 km, `pluie.go`) ; le pourcentage vient de `precipitation_probability`
du « best match » d'Open-Meteo (`meteo.go`), qui est en fait ICON — verifie en
interrogeant les modeles un par un : ICON rend exactement 98/100/98/73/58, AROME
et meteofrance_seamless ne rendent pas ce champ du tout. C'est une probabilite
d'ensemble (« au moins un membre depose 0,1 mm sur cette heure »), incoherente
avec la quantite deterministe du meme modele : ICON annonce lui aussi 0,0 mm sur
ces heures-la. A l'ecran, ce chiffre etait rendu par une goutte et un « % », sans
un mot pour dire que c'etait un risque.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand deux sources de grandeurs differentes
alimentent le meme ecran, l'unite de chacune doit etre ecrite a l'ecran, pas
seulement dans le code ; aucun test ne voit un chiffre affiche sans son unite.

### 2. Le meme defaut, une seconde fois, entre les deux graphes de pluie

**Symptome** — quelques heures apres le premier correctif, l'utilisateur
signale une nouvelle incoherence sur la meme app : la bande de l'heure qui
vient annonce « niveau faible vers 13:50 », la courbe du jour juste en dessous
ne dessine rien a cette heure-la.

**Cause** — le radar de Meteo-France observe une cellule reelle et la prolonge
de quelques minutes ; la courbe restitue un modele calcule des heures plus tot,
qui ne sait pas poser une averse de dix minutes au bon quart d'heure. Verifie :
AROME et meteofrance_seamless rendent tous deux 0,0 mm entre 13 h et 15 h, quand
le radar annonce faible puis moderee. Les deux ont raison. Ce qui les fait lire
comme contradictoires est un choix delibere de prp/03-graphe-de-pluie.md : la
« grammaire commune » — memes cinq bandes, meme vocabulaire, l'un sous l'autre —
voulue pour qu'on les compare d'un coup d'oeil, et qui promet donc qu'ils
s'accordent.

**Detecte par** — `utilisateur`

**Action** — `comportement` — meme lecon que l'anomalie 1, et c'est ce qui la
rend interessante : elle a ete ecrite le matin, appliquee aux vignettes, et pas
etendue aux deux graphes de la meme section trois ecrans plus haut. Une lecon
tiree d'un correctif doit etre passee sur TOUT l'ecran, pas seulement sur
l'endroit qui l'a revelee — sans quoi l'utilisateur la retrouve lui-meme le jour
meme.

### 3. Un harnais de rendu manquait pour verifier un affichage conditionnel

**Symptome** — la phrase qui tranche entre les deux graphes ne paraît que
lorsque les sources divergent. Au moment de la verifier, l'averse etait passee :
la donnee reelle ne produisait plus le cas, et rien ne permettait de voir le
rendu.

**Cause** — les tests Go couvrent la decision (le drapeau `desaccord`), jamais
le rendu HTML, et l'app sert ses fichiers web embarques dans le binaire :
impossible d'y substituer une reponse figee sans toucher au code livre.
Contourne en recopiant `web/` a cote et en interposant un `fetch` de test — dix
lignes, mais reinventees sur place et jetees ensuite.

**Detecte par** — `auteur`

**Action** — `outillage` — un harnais de rendu (servir `web/` avec des reponses
d'API figees, un cas par etat) rendrait verifiable tout affichage conditionnel,
qui est justement celui qu'aucun test n'attrape et qu'on ne voit pas en
naviguant.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-20 à 12:09 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 413 | 0,00 $ |
| Écriture de cache | 962 695 | 5,27 $ |
| Lecture de cache | 41 803 312 | 20,16 $ |
| Sortie | 164 032 | 3,73 $ |
| **Total** | **42 930 452** | **29,15 $ — 25,32 €** |

**Ce qui coûte**

- **213 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 829 jetons, écrits une fois par session puis relus à chaque
  échange : 13 955 748 jetons de relecture, 33 % de tout ce qui a été relu.
- **Tours courts** — 96 des 213 tours (45 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 14,31 $, soit 49 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 829 jetons relus au premier appel qui relise
  quelque chose, 370 960 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 42930452 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65829 0 131
2 principal claude-opus-5 1279 65829 298
3 principal claude-opus-5 3961 67108 129
4 principal claude-opus-5 5020 71069 292
5 principal claude-opus-5 1109 76089 96
6 principal claude-opus-5 164 77198 106
7 principal claude-opus-5 2779 77362 299
8 principal claude-opus-5 3956 80141 621
9 principal claude-opus-5 959 84097 132
10 principal claude-opus-5 1967 85056 495
11 principal claude-opus-5 1743 87023 741
12 principal claude-opus-5 1004 88766 786
13 principal claude-opus-5 1062 89770 241
14 principal claude-opus-5 308 90832 117
15 principal claude-opus-5 343 91140 530
16 principal claude-opus-5 595 91483 466
17 principal claude-opus-5 879 92078 161
18 principal claude-opus-5 282 92957 319
19 principal claude-opus-5 669 93239 346
20 principal claude-opus-5 961 93908 957
21 principal claude-opus-5 1288 94869 1041
22 principal claude-opus-5 1082 96157 99
23 principal claude-opus-5 385 97239 115
24 principal claude-opus-5 403 97624 908
25 principal claude-opus-5 28 98935 426
26 principal claude-opus-5 1448 98963 138
27 principal claude-opus-5 1515 100411 161
28 principal claude-opus-5 1680 101926 162
29 principal claude-opus-5 626 103606 191
30 principal claude-opus-5 3926 104232 185
31 principal claude-opus-5 2686 108158 1152
32 principal claude-opus-5 1395 110844 167
33 principal claude-opus-5 209 112239 170
34 principal claude-opus-5 212 112448 545
35 principal claude-opus-5 586 112660 444
36 principal claude-opus-5 642 113246 652
37 principal claude-opus-5 5067 113888 12649
38 principal claude-opus-5 12761 118955 191
39 principal claude-opus-5 1502 131716 87
40 principal claude-opus-5 180 133218 250
41 principal claude-opus-5 389 133398 242
42 principal claude-opus-5 500 133787 101
43 principal claude-opus-5 1628 134287 950
44 principal claude-opus-5 1000 135915 344
45 principal claude-opus-5 395 136915 210
46 principal claude-opus-5 307 137310 101
47 principal claude-opus-5 980 137617 1808
48 principal claude-opus-5 5951 138597 234
49 principal claude-opus-5 413 144548 102
50 principal claude-opus-5 1198 144961 1872
51 principal claude-opus-5 1927 146159 102
52 principal claude-opus-5 1126 148086 710
53 principal claude-opus-5 1229 149212 1069
54 principal claude-opus-5 1120 150441 102
55 principal claude-opus-5 1270 151561 345
56 principal claude-opus-5 730 152831 384
57 principal claude-opus-5 27 153945 3639
58 principal claude-opus-5 12080 153972 202
59 principal claude-opus-5 394 166052 133
60 principal claude-opus-5 416 166446 103
61 principal claude-opus-5 1221 166862 1525
62 principal claude-opus-5 1731 168083 394
63 principal claude-opus-5 502 169814 156
64 principal claude-opus-5 530 170316 97
65 principal claude-opus-5 165 170846 107
66 principal claude-opus-5 1658 171011 108
67 principal claude-opus-5 1859 172669 538
68 principal claude-opus-5 765 174528 122
69 principal claude-opus-5 3121 175293 5484
70 principal claude-opus-5 6399 178414 154
71 principal claude-opus-5 2588 184813 3691
72 principal claude-opus-5 3750 187401 87
73 principal claude-opus-5 282 191151 240
74 principal claude-opus-5 279 191433 1631
75 principal claude-opus-5 1795 191712 1623
76 principal claude-opus-5 1671 193507 1836
77 principal claude-opus-5 1976 195178 2793
78 principal claude-opus-5 2832 197154 85
79 principal claude-opus-5 940 199986 475
80 principal claude-opus-5 922 200926 731
81 principal claude-opus-5 925 201848 100
82 principal claude-opus-5 338 202773 609
83 principal claude-opus-5 667 203111 1526
84 principal claude-opus-5 3190 203778 328
85 principal claude-opus-5 590 206968 1427
86 principal claude-opus-5 1458 207558 1150
87 principal claude-opus-5 1227 209016 90
88 principal claude-opus-5 135 210243 85
89 principal claude-opus-5 239 210378 1338
90 principal claude-opus-5 1410 210617 486
91 principal claude-opus-5 726 212027 508
92 principal claude-opus-5 608 212753 441
93 principal claude-opus-5 725 213361 1204
94 principal claude-opus-5 1305 214086 2695
95 principal claude-opus-5 2756 215391 481
96 principal claude-opus-5 522 218147 334
97 principal claude-opus-5 2577 218669 289
98 principal claude-opus-5 330 221246 195
99 principal claude-opus-5 384 221576 178
100 principal claude-opus-5 208 221960 470
101 principal claude-opus-5 627 222168 347
102 principal claude-opus-5 526 222795 100
103 principal claude-opus-5 1996 223321 2840
104 principal claude-opus-5 2958 225317 1126
105 principal claude-opus-5 1159 228275 224
106 principal claude-opus-5 265 229434 197
107 principal claude-opus-5 227 229699 231
108 principal claude-opus-5 282 229926 101
109 principal claude-opus-5 2060 230208 277
110 principal claude-opus-5 421 232268 93
111 principal claude-opus-5 2051 232689 131
112 principal claude-opus-5 718 234740 1212
113 principal claude-opus-5 1243 235458 156
114 principal claude-opus-5 197 236701 133
115 principal claude-opus-5 301 236898 157
116 principal claude-opus-5 418 237199 177
117 principal claude-opus-5 235 237617 102
118 principal claude-opus-5 832 237852 95
119 principal claude-opus-5 318 238684 414
120 principal claude-opus-5 455 239002 74
121 principal claude-opus-5 350 239457 1757
122 principal claude-opus-5 1939 239807 109
123 principal claude-opus-5 495 241746 134
124 principal claude-opus-4-7 17531 29200 212
125 principal claude-opus-4-7 298 46731 93
126 principal claude-opus-5 772 242241 94
127 principal claude-opus-4-7 262 47029 82
128 principal claude-opus-4-7 6895 47291 84
129 principal claude-opus-4-7 13651 54186 191
130 principal claude-opus-4-7 265 67837 128
131 principal claude-opus-5 259 243013 214
132 principal claude-opus-4-7 6014 68102 377
133 principal claude-opus-4-7 1936 74116 157
134 principal claude-opus-4-7 1182 76052 83
135 principal claude-opus-5 495 243272 101
136 principal claude-opus-4-7 706 77234 208
137 principal claude-opus-4-7 0 46731 126
138 principal claude-opus-4-7 450 77940 128
139 principal claude-opus-5 482 243767 86
140 principal claude-opus-4-7 241 46731 74
141 principal claude-opus-4-7 271 46972 84
142 principal claude-opus-4-7 13651 47243 82
143 principal claude-opus-4-7 6895 60894 84
144 principal claude-opus-4-7 5448 67789 83
145 principal claude-opus-4-7 706 73237 84
146 principal claude-opus-5 504 244249 1350
147 principal claude-opus-4-7 20811 73943 84
148 principal claude-opus-5 1960 244753 120
149 principal claude-opus-4-7 12838 94754 275
150 principal claude-opus-5 2263 246713 137
151 principal claude-opus-5 432 248976 431
152 principal claude-opus-5 562 249408 529
153 principal claude-opus-4-7 1745 78390 5390
154 principal claude-opus-4-7 511 107592 3949
155 principal claude-opus-4-7 7955 80135 2902
156 principal claude-opus-5 376 250499 137
157 principal claude-opus-5 1268 250875 207
158 principal claude-opus-5 1916 252143 229
159 principal claude-opus-5 315 254059 187
160 principal claude-opus-5 264539 0 159
161 principal claude-opus-5 220904 46707 137
162 principal claude-opus-5 214 267611 137
163 principal claude-opus-5 1396 267825 335
164 principal claude-opus-5 422 269221 62
165 principal claude-opus-5 13152 269705 1250
166 principal claude-opus-5 1521 282857 671
167 principal claude-opus-5 965 284378 817
168 principal claude-opus-5 856 285343 417
169 principal claude-opus-5 811 286199 2478
170 principal claude-opus-5 2881 287010 325
171 principal claude-opus-5 791 289891 1981
172 principal claude-opus-5 2675 290682 2033
173 principal claude-opus-5 4602 293357 90
174 principal claude-opus-5 2063 297959 137
175 principal claude-opus-5 3787 300022 115
176 principal claude-opus-5 1522 303809 14844
177 principal claude-opus-5 14957 305331 233
178 principal claude-opus-5 284 320288 101
179 principal claude-opus-5 1486 320572 2266
180 principal claude-opus-5 6620 322058 563
181 principal claude-opus-5 637 328678 441
182 principal claude-opus-5 492 329315 101
183 principal claude-opus-5 2106 329807 575
184 principal claude-opus-5 626 331913 101
185 principal claude-opus-5 1566 332539 473
186 principal claude-opus-5 859 334105 471
187 principal claude-opus-5 27 335435 4103
188 principal claude-opus-5 4846 335462 3077
189 principal claude-opus-5 3092 340308 1107
190 principal claude-opus-5 1138 343400 2451
191 principal claude-opus-5 2512 344538 201
192 principal claude-opus-5 703 347050 1058
193 principal claude-opus-5 1089 347753 1910
194 principal claude-opus-5 1987 348842 398
195 principal claude-opus-5 601 350829 347
196 principal claude-opus-5 892 351430 1671
197 principal claude-opus-5 1585 352322 856
198 principal claude-opus-5 889 353907 363
199 principal claude-opus-5 516 354796 2211
200 principal claude-opus-5 2267 355312 227
201 principal claude-opus-5 278 357579 101
202 principal claude-opus-5 2256 357857 416
203 principal claude-opus-5 631 360113 1410
204 principal claude-opus-5 1471 360744 101
205 principal claude-opus-5 1604 362215 493
206 principal claude-opus-5 544 363819 103
207 principal claude-opus-5 1396 364363 530
208 principal claude-opus-5 666 365759 2918
209 principal claude-opus-5 2951 366425 150
210 principal claude-opus-5 890 369376 129
211 principal claude-opus-5 524 370266 129
212 principal claude-opus-5 170 370790 1497
213 principal claude-opus-5 1621 370960 233
-->
<!-- /cout -->
