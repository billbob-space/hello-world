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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 14:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 218 | 0,00 $ |
| Écriture de cache | 738 033 | 3,55 $ |
| Lecture de cache | 15 441 490 | 6,55 $ |
| Sortie | 86 528 | 1,66 $ |
| **Total** | **16 266 269** | **11,77 $ — 10,22 €** |

**Ce qui coûte**

- **119 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 442 jetons, écrits une fois par session puis relus à chaque
  échange : 7 722 156 jetons de relecture, 50 % de tout ce qui a été relu.
- **Tours courts** — 42 des 119 tours (35 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 6,02 $, soit 51 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 442 jetons relus au premier appel qui relise
  quelque chose, 220 432 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 16266269 -->
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
-->
<!-- /cout -->
