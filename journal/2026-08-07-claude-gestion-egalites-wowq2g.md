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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 23:10 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 304 | 0,00 $ |
| Écriture de cache | 376 184 | 1,59 $ |
| Lecture de cache | 27 416 898 | 13,16 $ |
| Sortie | 97 135 | 2,13 $ |
| **Total** | **27 890 521** | **16,89 $ — 14,67 €** |

**Ce qui coûte**

- **164 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 928 jetons, écrits une fois par session puis relus à chaque
  échange : 9 605 264 jetons de relecture, 35 % de tout ce qui a été relu.
- **Tours courts** — 60 des 164 tours (36 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 6,98 $, soit 41 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 928 jetons relus au premier appel qui relise
  quelque chose, 256 248 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 27890521 -->
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
-->
<!-- /cout -->
