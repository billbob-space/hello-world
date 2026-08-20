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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-20 à 09:59 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 244 | 0,00 $ |
| Écriture de cache | 240 454 | 1,50 $ |
| Lecture de cache | 19 678 637 | 9,84 $ |
| Sortie | 85 613 | 2,14 $ |
| **Total** | **20 004 948** | **13,48 $ — 11,71 €** |

**Ce qui coûte**

- **122 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 829 jetons, écrits une fois par session puis relus à chaque
  échange : 7 965 309 jetons de relecture, 40 % de tout ce qui a été relu.
- **Tours courts** — 65 des 122 tours (53 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 6,48 $, soit 48 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 829 jetons relus au premier appel qui relise
  quelque chose, 239 807 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 20004948 -->
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
-->
<!-- /cout -->
