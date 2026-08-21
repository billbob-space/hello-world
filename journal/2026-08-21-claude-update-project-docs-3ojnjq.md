# 2026-08-21 — claude/update-project-docs-3ojnjq

Branche : `claude/update-project-docs-3ojnjq`
Périmètre : fabrique, ramure, ramure-v2 — documentation seulement, aucun
comportement applicatif touché
Mode : `chaud`

Sujet : remettre d'aplomb toute la documentation du dépôt sur l'état réel du
code. Relevé d'entrée : le `README` racine décrit 6 applications sur 10, annonce
deux paliers d'exposition sur trois, trois volumes sur six, et un décompte
d'outillage qui date de deux plugins en arrière.

## Anomalies

### 1. Le garde-fou des tests cités ne regarde qu'un seul répertoire

**Symptome** — `./init.sh --check` avertit sept fois que `apps/ramure-v2/PRODUCT.md`
cite un test « introuvable dans les tests de l'app ». Six des sept existent
pourtant, et passent.

**Cause** — `check_traces_risques` construit sa liste de tests par
`ls apps/<n>/*_test.go apps/<n>/tests/*.test.js`. `ramure-v2` range ses tests Go
sous `internal/**/` et ses tests de vue sous `web/tests/*.test.ts` : aucun des
deux motifs ne les atteint. Le contrôle ne dit donc pas « le PRD ment », il dit
« je n'ai pas cherché là ». Sept avertissements dont six faux valent moins que
zéro : ils apprennent à ne plus lire la sortie.

**Detecte par** — `auteur`

**Action** — `garde-fou` — la liste des tests se cherche récursivement, sinon le
contrôle ne vaut que pour les apps dont le code est à plat.

### 2. Un septième avertissement, vrai celui-là, caché par les six faux

**Symptome** — une fois le garde-fou réparé, il reste un seul avertissement :
`TestCadragePlusEtroitSurEcranEtroit`, cité par le tableau de risques du PRD de
`ramure-v2`, n'existe nulle part. Le risque « le canevas exige de la place » —
moins de branches sur écran étroit — n'était donc tenu par aucun test côté
serveur. `TestLargeurInconnueRetombeSurLarge` couvrait le repli, jamais la
réduction elle-même.

**Cause** — le PRD promettait le test, et le bruit des six faux positifs rendait
la sortie du contrôle illisible : sept avertissements identiques dans la forme,
aucune raison de les ouvrir un par un. C'est exactement le défaut que
`memory/produit.md` veut empêcher — une promesse écrite trois fois, tenue zéro
fois — et le garde-fou censé l'attraper le disait, sans être entendu.

**Detecte par** — `relecture`

**Action** — `rien` — le test est écrit et passe ; la réparation du garde-fou,
elle, est l'anomalie 1.

### 3. Le README racine décrivait six applications sur dix

**Symptome** — la table des applications du `README` racine listait
`hello-world`, `cadran`, `ramure`, `ardoise`, `compteur` et `marcq-handball`.
Manquaient `estran`, `pilabelle`, `ramure-v2` et `renaissance-gym`, livrées et en
ligne ; `ramure`, elle, y figurait avec une URL alors qu'elle est retirée de la
stack depuis le 20 août. Même dérive ailleurs : deux paliers d'exposition
annoncés sur trois, trois volumes nommés sur six, un plafond mémoire « dépassé »
qui ne l'est plus, un décompte d'outillage de deux plugins en retard, et
`.claude/cloud-setup.sh` présenté deux fois comme GÉNÉRÉ alors qu'il est édité à
la main.

**Cause** — rien ne rattrapait la dérive documentaire. `--check` lit pourtant ces
fichiers : il y traque les liens morts et les titres en double, mais un lien vers
un **répertoire** (`(apps/estran/)`) n'est pas une cible en `.md` et échappait
donc au contrôle. Ajouter une app touche `app.yml`, `compose.yaml` et
`go.work` — tous régénérés et vérifiés — et jamais le `README`, que personne ne
relit puisque rien ne s'en plaint.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `--check` compare désormais la table des applications
du `README` au contenu de `apps/`, dans les deux sens. Avertissement et non KO :
un `README` incomplet ne casse aucun déploiement, et arrêter la CI de tout le
monde sur une ligne de tableau serait hors de proportion.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 18:17 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 322 | 0,00 $ |
| Écriture de cache | 302 782 | 1,53 $ |
| Lecture de cache | 21 547 112 | 10,11 $ |
| Sortie | 70 877 | 1,47 $ |
| **Total** | **21 921 093** | **13,11 $ — 11,38 €** |

**Ce qui coûte**

- **142 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 959 jetons, écrits une fois par session puis relus à chaque
  échange : 7 749 219 jetons de relecture, 35 % de tout ce qui a été relu.
- **Tours courts** — 41 des 142 tours (28 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 4,60 $, soit 35 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 54 959 jetons relus au premier appel qui relise
  quelque chose, 243 620 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 21921093 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54959 0 408
2 principal claude-opus-5 16488 54959 537
3 principal claude-opus-5 12489 71447 788
4 principal claude-opus-5 3183 83936 419
5 principal claude-opus-5 864 87119 415
6 principal claude-opus-5 4130 87983 640
7 principal claude-opus-5 6520 92113 1028
8 principal claude-opus-5 5683 98633 717
9 principal claude-opus-5 2971 104316 1014
10 principal claude-opus-5 1995 107287 742
11 principal claude-opus-5 3071 109282 860
12 principal claude-opus-5 3190 112353 665
13 principal claude-opus-5 4036 115543 844
14 principal claude-opus-5 1592 119579 93
15 principal claude-opus-5 1171 121171 1074
16 principal claude-opus-5 8065 122342 519
17 principal claude-opus-5 2698 130407 551
18 principal claude-opus-5 8919 133105 904
19 principal claude-opus-5 1168 142024 292
20 principal claude-opus-5 1472 143192 276
21 principal claude-opus-5 714 144664 787
22 principal claude-opus-5 1148 145378 305
23 principal claude-opus-5 365 146526 106
24 principal claude-opus-5 368 146891 384
25 principal claude-opus-5 478 147259 121
26 principal claude-opus-5 292 147737 824
27 principal claude-opus-5 4029 148029 331
28 principal claude-opus-5 1632 152058 880
29 principal claude-opus-5 1317 153690 302
30 principal claude-opus-5 653 155007 870
31 principal claude-opus-5 1105 155660 527
32 principal claude-opus-5 593 156765 853
33 principal claude-opus-5 999 157358 701
34 principal claude-opus-5 1230 158357 357
35 principal claude-opus-5 1320 159587 2722
36 principal claude-opus-5 2741 160907 151
37 principal claude-opus-5 466 163648 149
38 principal claude-opus-5 253 164114 1449
39 principal claude-opus-5 1828 164367 141
40 principal claude-opus-5 528 166195 737
41 principal claude-opus-5 2345 166723 320
42 principal claude-opus-5 2189 169068 605
43 principal claude-opus-5 680 171257 990
44 principal claude-opus-5 1637 171937 215
45 principal claude-opus-5 1173 173574 898
46 principal claude-opus-5 1562 174747 514
47 principal claude-opus-5 1374 176309 832
48 principal claude-opus-5 1454 177683 169
49 principal claude-opus-5 842 179137 840
50 principal claude-opus-5 1783 179979 912
51 principal claude-opus-5 943 181762 485
52 principal claude-opus-5 831 182705 582
53 principal claude-opus-5 2487 183536 469
54 principal claude-opus-5 1662 186023 368
55 principal claude-opus-5 1908 187685 1066
56 principal claude-opus-5 1148 189593 92
57 principal claude-opus-5 627 190741 259
58 principal claude-opus-5 733 191368 403
59 principal claude-opus-5 875 192101 637
60 principal claude-opus-5 1380 192976 821
61 principal claude-opus-5 2120 194356 114
62 principal claude-opus-5 908 196476 393
63 principal claude-opus-5 757 197384 784
64 principal claude-opus-5 1174 198141 822
65 principal claude-opus-5 2351 199315 513
66 principal claude-opus-5 660 201666 90
67 principal claude-opus-5 759 202326 91
68 principal claude-opus-5 1219 203085 965
69 principal claude-opus-5 1271 204304 824
70 principal claude-opus-5 894 205575 148
71 principal claude-opus-5 678 206469 1037
72 principal claude-opus-5 1230 207147 650
73 principal claude-opus-5 2793 208377 169
74 principal claude-opus-5 208 211170 179
75 principal claude-opus-5 317 211378 262
76 principal claude-opus-5 515 211695 587
77 principal claude-opus-5 1767 212210 257
78 principal claude-opus-5 288 213977 205
79 principal claude-opus-5 513 214265 390
80 principal claude-opus-5 494 214778 95
81 principal claude-opus-5 651 215272 215
82 principal claude-opus-5 590 215923 134
83 principal claude-opus-5 514 216513 348
84 principal claude-opus-5 486 217027 129
85 principal claude-opus-5 3594 217513 474
86 principal claude-opus-5 548 221107 227
87 principal claude-opus-5 261 221655 274
88 principal claude-opus-5 412 221916 144
89 principal claude-opus-5 1204 222328 219
90 principal claude-opus-5 529 223532 258
91 principal claude-opus-5 703 224061 622
92 principal claude-opus-5 1234 224764 286
93 principal claude-opus-5 428 225998 264
94 principal claude-opus-5 1245 226426 650
95 principal claude-opus-5 1348 227671 1187
96 principal claude-opus-4-7 5810 29200 155
97 principal claude-opus-4-7 241 35010 93
98 principal claude-opus-4-7 280 35251 94
99 principal claude-opus-4-7 5331 35531 177
100 principal claude-opus-5 1241 229019 1458
101 principal claude-opus-5 1555 230260 119
102 principal claude-opus-4-7 5624 40862 686
103 principal claude-opus-4-7 0 35010 161
104 principal claude-opus-4-7 247 35010 95
105 principal claude-opus-4-7 282 35257 94
106 principal claude-opus-4-7 0 35010 201
107 principal claude-opus-4-7 5331 35539 195
108 principal claude-opus-4-7 320 35010 197
109 principal claude-opus-4-7 262 40870 122
110 principal claude-opus-5 360 231815 1184
111 principal claude-opus-4-7 2424 46486 2068
112 principal claude-opus-4-7 6033 41132 1304
113 principal claude-opus-4-7 12247 35330 1670
114 principal claude-opus-4-7 1724 47577 192
115 principal claude-opus-5 1381 232175 134
116 principal claude-opus-4-7 246 49301 185
117 principal claude-opus-4-7 1583 49547 239
118 principal claude-opus-5 1045 233556 119
119 principal claude-opus-4-7 293 51130 175
120 principal claude-opus-5 942 234601 178
121 principal claude-opus-4-7 3042 47165 1210
122 principal claude-opus-4-7 255 51423 184
123 principal claude-opus-4-7 556 51678 196
124 principal claude-opus-4-7 256 52234 135
125 principal claude-opus-5 1164 235543 756
126 principal claude-opus-4-7 199 52490 153
127 principal claude-opus-5 826 236707 106
128 principal claude-opus-4-7 303 52689 159
129 principal claude-opus-4-7 219 52992 121
130 principal claude-opus-4-7 2923 53211 287
131 principal claude-opus-4-7 417 56134 141
132 principal claude-opus-5 523 237533 1227
133 principal claude-opus-4-7 265 56551 184
134 principal claude-opus-5 1319 238056 91
135 principal claude-opus-5 798 239375 146
136 principal claude-opus-5 964 240173 337
137 principal claude-opus-5 407 241137 134
138 principal claude-opus-4-7 1515 56816 1212
139 principal claude-opus-5 221 241544 746
140 principal claude-opus-5 1330 241765 383
141 principal claude-opus-5 525 243095 259
142 principal claude-opus-5 934 243620 449
-->
<!-- /cout -->
