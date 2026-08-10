# 2026-08-09 — claude/weather-app-ui-redesign-x7h03f

Branche : `claude/weather-app-ui-redesign-x7h03f`
Périmètre : estran
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-10 à 05:55 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 840 | 0,00 $ |
| Écriture de cache | 486 370 | 1,76 $ |
| Lecture de cache | 6 417 095 | 1,89 $ |
| Sortie | 20 137 | 0,30 $ |
| **Total** | **6 925 442** | **3,95 $ — 3,43 €** |

**Ce qui coûte**

- **86 appel(s) au modèle** — un par réponse, outils compris —, dont 38 par des sous-agents — 1 502 141 jetons, 0,80 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 887 jetons, écrits une fois par session puis relus à chaque
  échange : 3 143 689 jetons de relecture, 48 % de tout ce qui a été relu.
- **Tours courts** — 62 des 86 tours (72 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,42 $, soit 61 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 887 jetons relus au premier appel qui relise
  quelque chose, 143 273 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 6925442 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66887 0 347
2 principal claude-sonnet-5 1361 66887 231
3 principal claude-sonnet-5 279 68248 123
4 principal claude-sonnet-5 300 68527 385
5 principal claude-sonnet-5 19413 68827 1081
6 principal claude-sonnet-5 10028 88240 476
7 principal claude-sonnet-5 1675 98268 176
8 principal claude-sonnet-5 316 99943 146
9 principal claude-sonnet-5 1389 100259 236
10 principal claude-sonnet-5 334 101648 3754
11 principal claude-sonnet-5 4108 101982 361
12 principal claude-sonnet-5 641 106090 209
13 principal claude-sonnet-5 250 106731 116
14 principal claude-sonnet-5 161 106981 950
15 principal claude-sonnet-5 1152 107142 172
16 principal claude-sonnet-5 3527 106731 119
17 principal claude-sonnet-5 6979 110258 309
18 principal claude-sonnet-5 478 117237 1405
19 principal claude-sonnet-5 1503 117715 67
20 principal claude-sonnet-5 270 119218 105
21 principal claude-sonnet-5 2747 119488 799
22 principal claude-sonnet-5 1029 122235 283
23 principal claude-sonnet-5 1483 123264 154
24 principal claude-sonnet-5 161 124747 144
25 principal claude-sonnet-5 200 124908 68
26 principal claude-sonnet-5 477 125108 895
27 principal claude-sonnet-5 1426 125585 217
28 principal claude-sonnet-5 1394 127011 277
29 principal claude-sonnet-5 340 128405 211
30 principal claude-sonnet-5 79352 49045 203
31 principal claude-sonnet-5 695 128397 127
32 principal <synthetic> 0 0 0
33 principal claude-sonnet-5 949 128602 147
34 principal <synthetic> 0 0 0
35 principal claude-sonnet-5 1380 129125 105
36 principal claude-sonnet-5 308 130505 48
37 principal claude-sonnet-5 130898 0 1587
38 principal claude-sonnet-5 1819 130898 135
39 principal claude-sonnet-5 364 132717 127
40 principal claude-sonnet-5 191 133081 191
41 principal claude-sonnet-5 360 133272 322
42 principal claude-sonnet-5 2374 133632 2238
43 principal claude-sonnet-5 2599 136006 45
44 principal claude-sonnet-5 325 138605 153
45 principal claude-sonnet-5 255 138930 94
46 principal claude-sonnet-5 723 139185 112
47 principal claude-sonnet-5 3365 139908 109
48 principal claude-sonnet-5 310 143273 211
49 agent claude-haiku-4-5-20251001 11461 0 4
50 agent claude-haiku-4-5-20251001 2064 11461 2
51 agent claude-haiku-4-5-20251001 300 13525 2
52 agent claude-haiku-4-5-20251001 2321 13825 2
53 agent claude-haiku-4-5-20251001 540 16146 2
54 agent claude-haiku-4-5-20251001 1038 16686 2
55 agent claude-haiku-4-5-20251001 357 17724 2
56 agent claude-haiku-4-5-20251001 152 18081 4
57 agent claude-sonnet-5 17380 0 3
58 agent claude-sonnet-5 2144 17380 20
59 agent claude-sonnet-5 8018 19524 2
60 agent claude-sonnet-5 6644 27542 2
61 agent claude-sonnet-5 11118 34186 5
62 agent claude-sonnet-5 1917 45304 5
63 agent claude-sonnet-5 1475 47221 3
64 agent claude-sonnet-5 177 48696 6
65 agent claude-sonnet-5 2086 48873 127
66 agent claude-sonnet-5 361 50959 20
67 agent claude-sonnet-5 17743 0 4
68 agent claude-sonnet-5 6908 17743 20
69 agent claude-sonnet-5 13887 24651 2
70 agent claude-sonnet-5 4357 38538 2
71 agent claude-sonnet-5 511 42895 16
72 agent claude-sonnet-5 1220 43406 2
73 agent claude-sonnet-5 362 44626 6
74 agent claude-sonnet-5 7042 44988 9
75 agent claude-sonnet-5 641 52030 2
76 agent claude-sonnet-5 126 52671 20
77 agent claude-sonnet-5 183 52797 5
78 agent claude-sonnet-5 335 52980 8
79 agent claude-sonnet-5 297 53315 20
80 agent claude-sonnet-5 552 53612 2
81 agent claude-sonnet-5 4071 54164 3
82 agent claude-sonnet-5 389 58235 20
83 agent claude-sonnet-5 187 58624 3
84 agent claude-sonnet-5 180 58811 2
85 agent claude-sonnet-5 1030 58991 6
86 agent claude-sonnet-5 221 60021 2
-->
<!-- /cout -->
