# 2026-08-07 — claude/dockerhand-selective-deploy-4h750i

Branche : `claude/dockerhand-selective-deploy-4h750i`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Livrer une application redémarrait les neuf conteneurs de la stack

**Symptome** — question de l'utilisateur : « chaque déploiement relance
l'ensemble des dockers alors qu'un seul est livré ». Vérifié avant de toucher
quoi que ce soit, avec `./scripts/prod.sh` : après une livraison qui ne touchait
que `marcq-handball`, les neuf services de la stack affichaient tous `Up 2
minutes`. Le symptôme n'était pas une impression, c'était mesurable en une
commande — et rien dans le dépôt ne l'avait jamais mesuré.

**Cause** — un enchaînement de trois décisions justes prises séparément. Le tag
d'image était `:main` pour toutes les apps, donc mutable ; `compose.yaml` ne
changeait donc pas d'une livraison de code à l'autre ; `dockhand`, qui ne
redéploie que sur un diff du dépôt, sautait donc tout déploiement ; le réglage
`Force redeployment` était donc obligatoire — et forcer un déploiement, c'est
recréer **tous** les conteneurs. Chaque maillon était documenté, le `README`
allait jusqu'à intituler une section « le piège : `Force redeployment` est
obligatoire ». Ce qui manquait, c'est que personne n'avait écrit ce que le
réglage coûtait : il était présenté comme une contrainte de l'outil, pas comme
un choix ayant un prix. Un contournement documenté cesse d'être vu comme un
défaut.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — le tag d'image de chaque app est désormais le commit
qui l'a construite, écrit par la CI dans `versions.yml` et reporté dans le
compose : la livraison d'une app ne fait bouger qu'une ligne `image:`, et
`docker compose up` ne recrée que ce service. `--check` vérifie chaque ligne du
fichier — clé qui ne désigne aucune app, tag qui n'est pas un commit — et le
contrôle service par service compare le tag du compose à celui du fichier.

### 2. Le contournement était devenu la consigne écrite

**Symptome** — le `README` demandait d'activer `Force redeployment` et le
workflow, en cas de `skipped`, imprimait un message d'erreur qui disait de
l'activer. Le correctif rendait ces deux textes non seulement inutiles mais
nuisibles : suivi à la lettre, le message aurait ramené le défaut qu'on venait
de corriger, et personne n'aurait vu la contradiction — le réglage vit sur le
serveur, pas dans le dépôt.

**Cause** — un message d'erreur est écrit pour la panne du jour et jamais relu
ensuite. Celui-ci nommait un réglage extérieur au dépôt : aucun contrôle du
dépôt ne peut donc dire qu'il a vieilli. C'est la même mécanique que le
commentaire « les deux jobs durent autant l'un que l'autre » de l'entrée
précédente, resté juste dans le fichier et faux dans les faits.

**Detecte par** — `auteur`

**Action** — `contrat` — les deux textes disent maintenant l'inverse, et disent
*pourquoi* : `Force redeployment` doit rester décoché, un `skipped` ne peut plus
vouloir dire « rien à faire » mais « `dockhand` n'a pas vu la poussée ». Le
réglage côté serveur reste le seul point de cette chaîne qu'aucun contrôle du
dépôt n'atteint : il est signalé comme tel dans le `README`.

### 3. Un cas où la CI se serait mise au rouge sans rien de cassé

**Symptome** — en écrivant le workflow, un cas est apparu qu'aucun test
n'aurait attrapé : le premier des deux commits d'un ajout d'application. L'app
naît `enabled: false`, la CI construit et publie son image, mais elle n'a aucun
bloc dans le compose. La version s'épingle, `compose.yaml` ne bouge pas,
`dockhand` répond `skipped` — et le workflow, qui traite `skipped` comme un
échec, aurait mis la CI au rouge pour une livraison parfaitement normale.

**Cause** — avoir raisonné sur le cas courant (« on livre une app active »)
alors que le contrat décrit noir sur blanc une séquence en deux commits dont le
premier ne déploie rien. Le garde-fou hérité — `skipped` est un échec — était
juste tant que toute livraison devait déployer ; il cessait de l'être dès qu'une
livraison pouvait légitimement n'avoir rien à déployer.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le workflow distingue désormais les deux : si aucun
service du compose ne change, il enregistre la version et n'appelle pas le
webhook, en le disant. Le `skipped` reste un échec dans le seul cas où il est
anormal.

### 4. Le plafond du contrat, encore, et pour deux lignes

**Symptome** — `CLAUDE.md` était à 250 lignes sur 250. Ajouter `versions.yml` à
l'arborescence et une phrase au paragraphe du déploiement l'a porté à 254. Il a
fallu recompacter trois paragraphes voisins — sans rien retirer — pour revenir
exactement à 250.

**Cause** — c'est la reprise, à l'identique, de l'anomalie 4 de l'entrée
`claude-dockhand-production-debug` : le plafond empêche bien d'élargir le
contrat, mais il ne dit pas où déplacer ce qui déborde, et `memory/` impose un
`Tenu par` qu'un simple ajout de vocabulaire ne justifie pas à lui seul. Le
sujet a donc atterri dans le `README`, comme la fois précédente. Deux branches
de suite ont payé le même impôt de recompactage ; la troisième le paiera aussi.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la question reste celle posée il y a quatre jours et
elle est maintenant instruite par deux occurrences : soit le plafond monte, soit
`memory/` accepte un sujet sans garde-fou. Aucun agent ne devrait trancher seul
ce qui décide de ce que tous les suivants liront en permanence.

### 5. Ce que le dépôt ne peut pas prouver

**Symptome** — la sélectivité repose sur une propriété de `dockhand` que le
dépôt ne contrôle pas : qu'un déploiement non forcé soit bien un `docker compose
up -d` (qui ne recrée que les services modifiés) et non un `down` suivi d'un
`up`. Aucun contrôle du dépôt ne peut en juger.

**Cause** — la frontière du périmètre passe là, et c'est normal. Mais une
amélioration dont on ne peut pas prouver l'effet depuis le dépôt n'est pas
livrée tant qu'on ne l'a pas regardée en production.

**Detecte par** — `auteur`

**Action** — `comportement` — la preuve est la même commande que celle qui a
mesuré le défaut : après la fusion, `./scripts/prod.sh` doit montrer un seul
conteneur récemment démarré et les huit autres à leur ancienneté d'avant. Tant
que cette lecture n'est pas faite, la branche n'est pas finie. **Lecture faite,
et elle dit deux choses** — voir l'anomalie 6.

### 6. Le réglage forcé recrée aussi ce dont rien n'a changé — mesuré

**Symptome** — première mise en ligne après la fusion, relevée avec
`./scripts/prod.sh` : les neuf conteneurs affichent `Up 31 seconds`. Les six
applications, oui, c'est attendu — elles viennent toutes d'être réépinglées d'un
coup, le workflow ayant changé. Mais `redis`, `ardoise-base` et `compteur-base`
aussi : leurs blocs du compose n'ont pas bougé d'un caractère, et ils ont été
recréés quand même.

**Cause** — `Force redeployment`, toujours coché côté serveur. La mesure vaut
mieux qu'un raisonnement : elle isole exactement ce que le dépôt ne pouvait pas
prouver, et montre que le mécanisme livré ici est complet mais masqué. Le reste
de la chaîne, lui, est prouvé de bout en bout : `versions.yml` est arrivé sur
`main` avec les six commits, le compose a changé de douze lignes et pas une de
plus, et le conteneur `cadran` tourne sur l'image épinglée
`cadran:01acc5a7…`, lue dans l'inspection du conteneur en production.

**Detecte par** — `production`

**Action** — `arbitrage` — un geste humain hors du dépôt, et le seul qui reste :
décocher `Force redeployment` dans les *Deploy options* de la stack. Aucun
contrôle de la CI ne peut le voir ni le faire ; la porte de service vers la
production est en lecture seule par construction, et l'élargir pour ce seul
réglage rouvrirait le droit d'arrêter la stack entière. Le `README` porte
l'instruction ; la sélectivité se vérifiera à la livraison suivante, en
comparant les anciennetés des conteneurs.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 00:09 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 420 | 0,00 $ |
| Écriture de cache | 709 025 | 2,96 $ |
| Lecture de cache | 35 529 075 | 15,68 $ |
| Sortie | 126 596 | 2,05 $ |
| **Total** | **36 365 116** | **20,70 $ — 17,97 €** |

**Ce qui coûte**

- **241 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  59 202 jetons, écrits une fois par session puis relus à chaque
  échange : 14 208 480 jetons de relecture, 39 % de tout ce qui a été relu.
- **Tours courts** — 104 des 241 tours (43 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 12,95 $, soit 62 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 59 202 jetons relus au premier appel qui relise
  quelque chose, 282 875 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 36365116 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 59202 0 492
2 principal claude-opus-5 3547 59202 96
3 principal claude-opus-5 10893 62749 425
4 principal claude-opus-5 4903 73642 276
5 principal claude-opus-5 4495 78545 1846
6 principal claude-opus-5 2702 83040 1825
7 principal claude-opus-5 239 87567 3326
8 principal claude-opus-5 10805 87806 181
9 principal claude-opus-5 3325 98611 275
10 principal claude-opus-5 1617 101936 119
11 principal claude-opus-5 4421 103553 567
12 principal claude-opus-5 3866 107974 1886
13 principal claude-opus-5 6479 111840 2350
14 principal claude-opus-5 4415 118319 100
15 principal claude-opus-5 2624 122734 253
16 principal claude-opus-5 499 125358 229
17 principal claude-opus-5 299 125857 222
18 principal claude-opus-5 292 126156 393
19 principal claude-opus-5 439 126448 546
20 principal claude-opus-5 592 126887 591
21 principal claude-opus-5 637 127479 580
22 principal claude-opus-5 756 128116 1509
23 principal claude-opus-5 1554 128872 507
24 principal claude-opus-5 553 130426 1144
25 principal claude-opus-5 1190 130979 216
26 principal claude-opus-5 262 132169 284
27 principal claude-opus-5 330 132431 97
28 principal claude-opus-5 764 132761 196
29 principal claude-opus-5 553 133525 710
30 principal claude-opus-5 756 134078 238
31 principal claude-opus-5 284 134834 101
32 principal claude-opus-5 413 135118 1118
33 principal claude-opus-5 1238 135531 320
34 principal claude-opus-5 819 136769 239
35 principal claude-opus-5 605 137588 2019
36 principal claude-opus-5 3357 138193 88
37 principal claude-opus-5 402 141550 1875
38 principal claude-opus-5 2602 141952 405
39 principal claude-opus-5 458 144554 687
40 principal claude-opus-5 740 145012 1345
41 principal claude-opus-5 1528 145752 1102
42 principal claude-opus-5 1154 147280 1300
43 principal claude-opus-5 1353 148434 881
44 principal claude-opus-5 934 149787 706
45 principal claude-opus-5 759 150721 227
46 principal claude-opus-5 449 151480 1240
47 principal claude-opus-5 1293 151929 184
48 principal claude-opus-5 237 153222 680
49 principal claude-opus-5 2472 153459 872
50 principal claude-opus-5 920 155931 943
51 principal claude-opus-5 1121 156851 1070
52 principal claude-opus-5 1117 157972 97
53 principal claude-opus-5 406 159089 304
54 principal claude-opus-5 434 159495 910
55 principal claude-opus-5 1781 159929 273
56 principal claude-opus-5 323 161710 102
57 principal claude-opus-5 870 162033 331
58 principal claude-opus-5 381 162903 411
59 principal claude-opus-5 461 163284 132
60 principal claude-opus-5 147 163745 978
61 principal claude-opus-5 2062 163892 3438
62 principal claude-opus-5 3487 165954 716
63 principal claude-opus-5 1122 169441 124
64 principal claude-opus-5 447 170563 1528
65 principal claude-opus-5 1578 171010 692
66 principal claude-opus-5 742 172588 107
67 principal claude-opus-5 186 173330 561
68 principal claude-opus-5 611 173516 85
69 principal claude-opus-5 242 174127 1192
70 principal claude-opus-5 1242 174369 58
71 principal claude-opus-5 203 175611 300
72 principal claude-opus-5 349 175814 92
73 principal claude-opus-5 338 176163 102
74 principal claude-opus-5 769 176501 372
75 principal claude-opus-5 417 177270 1055
76 principal claude-opus-5 1100 177687 1214
77 principal claude-opus-5 1259 178787 114
78 principal claude-opus-5 229 180046 304
79 principal claude-opus-5 593 180275 89
80 principal claude-opus-5 1462 180868 2813
81 principal claude-opus-5 2886 182330 67
82 principal claude-opus-5 274 185216 1856
83 principal claude-opus-5 1894 185490 83
84 principal claude-opus-4-7 12894 28262 128
85 principal claude-opus-4-7 938 41156 114
86 principal claude-opus-4-7 0 41156 127
87 principal claude-opus-4-7 159 42094 97
88 principal claude-opus-4-7 912 42253 121
89 principal claude-opus-4-7 937 41156 110
90 principal claude-opus-4-7 2018 43165 122
91 principal claude-opus-4-7 5252 45183 125
92 principal claude-opus-4-7 156 42093 168
93 principal claude-opus-4-7 873 42249 112
94 principal claude-opus-4-7 421 50435 161
95 principal claude-opus-5 213 187384 1152
96 principal claude-opus-4-7 157 43122 121
97 principal claude-opus-4-7 365 50856 81
98 principal claude-opus-4-7 5900 43279 122
99 principal claude-opus-4-7 6922 51221 151
100 principal claude-opus-4-7 3709 49179 188
101 principal claude-opus-4-7 1215 58143 122
102 principal claude-opus-4-7 17551 28262 221
103 principal claude-opus-4-7 269 45813 93
104 principal claude-opus-5 1197 187597 644
105 principal claude-opus-4-7 218 46082 84
106 principal claude-opus-5 822 188794 82
107 principal claude-opus-4-7 14571 46300 171
108 principal claude-opus-4-7 227 60871 196
109 principal claude-opus-4-7 1646 52888 2342
110 principal claude-opus-4-7 0 45813 216
111 principal claude-opus-4-7 247 61098 150
112 principal claude-opus-4-7 261 45813 97
113 principal claude-opus-4-7 2485 54534 101
114 principal claude-opus-4-7 446 61345 155
115 principal claude-opus-5 4428 189616 350
116 principal claude-opus-4-7 912 46074 84
117 principal claude-opus-4-7 173 61791 192
118 principal claude-opus-4-7 210 57019 163
119 principal claude-opus-4-7 861 61964 158
120 principal claude-opus-4-7 749 57229 232
121 principal claude-opus-5 763 194044 113
122 principal claude-opus-4-7 174 62825 124
123 principal claude-opus-4-7 3391 57978 128
124 principal claude-opus-4-7 14571 46986 428
125 principal claude-opus-4-7 299 62999 263
126 principal claude-opus-4-7 5359 61557 122
127 principal claude-opus-4-7 508 63298 122
128 principal claude-opus-4-7 2838 61369 288
129 principal claude-opus-4-7 2947 66916 149
130 principal claude-opus-4-7 3058 63806 121
131 principal claude-opus-4-7 184 69863 81
132 principal claude-opus-4-7 3645 66864 122
133 principal claude-opus-4-7 6922 70047 116
134 principal claude-opus-4-7 2454 70509 122
135 principal claude-opus-4-7 263 76969 122
136 principal claude-opus-4-7 6968 64207 696
137 principal claude-opus-4-7 740 71175 81
138 principal claude-opus-5 1665 194807 1265
139 principal claude-opus-5 1909 196472 127
140 principal claude-opus-5 240 198381 137
141 principal claude-opus-5 408 198621 83
142 principal claude-opus-5 204 199029 131
143 principal claude-opus-4-7 0 45813 2082
144 principal claude-opus-4-7 2578 72963 1460
145 principal claude-opus-5 143 199233 78
146 principal claude-opus-5 2991 199376 219
147 principal claude-opus-4-7 6922 71915 1683
148 principal claude-opus-4-7 2228 59358 6347
149 principal claude-opus-4-7 7417 61586 122
150 principal claude-opus-5 331 202367 274
151 principal claude-opus-5 1511 202698 253
152 principal claude-opus-4-7 1530 77232 2798
153 principal claude-opus-4-7 4015 78837 738
154 principal claude-opus-5 580 204209 56
155 principal claude-opus-5 501 204789 118
156 principal claude-opus-4-7 7536 78762 756
157 principal claude-opus-4-7 16574 45813 2677
158 principal claude-opus-4-7 2728 62387 136
159 principal claude-opus-4-7 4382 82852 1049
160 principal claude-opus-4-7 296 65115 144
161 principal claude-opus-4-7 160 65411 158
162 principal claude-opus-4-7 582 65571 154
163 principal claude-opus-5 235 205290 1478
164 principal claude-opus-4-7 170 66153 95
165 principal claude-opus-5 1531 205525 67
166 principal claude-opus-4-7 4954 75541 3511
167 principal claude-opus-4-7 127 66323 166
168 principal claude-opus-4-7 3600 69003 3380
169 principal claude-opus-4-7 4555 72603 122
170 principal claude-opus-4-7 1438 77158 309
171 principal claude-opus-5 227 207056 330
172 principal claude-opus-4-7 349 78596 123
173 principal claude-opus-5 390 207283 137
174 principal claude-opus-4-7 3788 28262 134
175 principal claude-opus-5 159 207673 220
176 principal claude-opus-5 673 207832 137
177 principal claude-opus-5 159 208505 97
178 principal claude-opus-5 1675 208664 218
179 principal claude-opus-5 11677 210339 236
180 principal claude-opus-5 637 222016 129
181 principal claude-opus-5 143 222653 137
182 principal claude-opus-5 568 222796 112
183 principal claude-opus-5 224 223364 134
184 principal claude-opus-5 1101 223588 1107
185 principal claude-opus-5 1117 224689 137
186 principal claude-opus-5 1376 225806 271
187 principal claude-opus-5 385 227182 175
188 principal claude-opus-5 1441 227567 128
189 principal claude-opus-4-7 14721 32050 6302
190 principal claude-opus-4-7 6338 46771 69
191 principal claude-opus-5 266 229008 883
192 principal claude-opus-5 917 229274 160
193 principal claude-opus-5 218 230191 118
194 principal claude-opus-5 232 230409 150
195 principal claude-opus-5 158 230641 137
196 principal claude-opus-5 159 230799 132
197 principal claude-opus-5 142 230958 483
198 principal claude-opus-5 489 231100 188
199 principal claude-opus-5 302 231589 272
200 principal claude-opus-5 191578 41045 137
201 principal claude-opus-5 1375 232623 171
202 principal claude-opus-5 181 233998 194
203 principal claude-opus-5 308 234179 46
204 principal claude-opus-5 343 234533 137
205 principal claude-opus-5 2479 234876 253
206 principal claude-opus-5 367 237355 58
207 principal claude-opus-5 387 237780 134
208 principal claude-opus-5 242 238167 160
209 principal claude-opus-5 1629 238409 137
210 principal claude-opus-5 2660 240038 136
211 principal claude-opus-5 574 242698 133
212 principal claude-opus-5 174 243272 137
213 principal claude-opus-5 582 243446 168
214 principal claude-opus-5 561 244028 68
215 principal claude-opus-5 169 244589 153
216 principal claude-opus-5 471 244758 687
217 principal claude-opus-5 6176 245229 251
218 principal claude-opus-5 368 251405 118
219 principal claude-opus-5 183 251773 169
220 principal claude-opus-5 179 251956 201
221 principal claude-opus-5 319 252135 75
222 principal claude-opus-5 341 252529 129
223 principal claude-opus-5 206 252870 163
224 principal claude-opus-5 11102 253076 181
225 principal claude-opus-5 777 264178 233
226 principal claude-opus-5 346 264955 132
227 principal claude-opus-5 486 265301 167
228 principal claude-opus-5 177 265787 207
229 principal claude-opus-5 661 265964 196
230 principal claude-opus-5 206 266625 137
231 principal claude-opus-5 2661 266831 351
232 principal claude-opus-5 491 269492 119
233 principal claude-opus-5 236 269983 43
234 principal claude-opus-5 347 270262 137
235 principal claude-opus-5 457 270609 250
236 principal claude-opus-5 677 271066 909
237 principal claude-opus-5 929 271743 66
238 principal claude-opus-5 681 272672 161
239 principal claude-opus-5 689 273353 1111
240 principal claude-opus-5 8833 274042 1430
241 principal claude-opus-5 2388 282875 90
-->
<!-- /cout -->
