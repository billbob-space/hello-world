# 2026-08-09 — claude/weather-app-ui-redesign-x7h03f

Branche : `claude/weather-app-ui-redesign-x7h03f`
Périmètre : estran
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-09 à 18:39 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 80 | 0,00 $ |
| Écriture de cache | 181 293 | 0,68 $ |
| Lecture de cache | 2 784 030 | 0,84 $ |
| Sortie | 11 596 | 0,17 $ |
| **Total** | **2 976 999** | **1,69 $ — 1,47 €** |

**Ce qui coûte**

- **40 appel(s) au modèle** — un par réponse, outils compris —, dont 20 par des sous-agents — 984 208 jetons, 0,52 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 887 jetons, écrits une fois par session puis relus à chaque
  échange : 1 270 853 jetons de relecture, 45 % de tout ce qui a été relu.
- **Tours courts** — 30 des 40 tours (75 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,89 $, soit 52 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 887 jetons relus au premier appel qui relise
  quelque chose, 119 218 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 2976999 -->
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
21 agent claude-sonnet-5 17743 0 4
22 agent claude-sonnet-5 6908 17743 20
23 agent claude-sonnet-5 13887 24651 2
24 agent claude-sonnet-5 4357 38538 2
25 agent claude-sonnet-5 511 42895 16
26 agent claude-sonnet-5 1220 43406 2
27 agent claude-sonnet-5 362 44626 6
28 agent claude-sonnet-5 7042 44988 9
29 agent claude-sonnet-5 641 52030 2
30 agent claude-sonnet-5 126 52671 177
31 agent claude-sonnet-5 183 52797 5
32 agent claude-sonnet-5 335 52980 8
33 agent claude-sonnet-5 297 53315 537
34 agent claude-sonnet-5 552 53612 2
35 agent claude-sonnet-5 4071 54164 3
36 agent claude-sonnet-5 389 58235 20
37 agent claude-sonnet-5 187 58624 3
38 agent claude-sonnet-5 180 58811 2
39 agent claude-sonnet-5 1030 58991 6
40 agent claude-sonnet-5 221 60021 2
-->
<!-- /cout -->
