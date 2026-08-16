# 2026-08-16 — claude/weather-app-unfinished-features-r3p4d2

Branche : `claude/weather-app-unfinished-features-r3p4d2`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La branche à reprendre n'existait nulle part

**Symptome** — demande initiale : reprendre `claude/weather-app-unfinished-features-nrzal0`,
ouverte par une autre session cloud restée bloquée sur la même question. Ni `git fetch`
ni `list_branches` ne connaissent cette référence : la session tournait encore, n'avait
rien committé, rien poussé. Il n'y avait donc rien à reprendre — seulement un sujet.
Même constat pour la session « Navigation historique météo » du 15 août, archivée sur une
question sans réponse : sa branche `claude/meteo-historical-navigation-vemabz` n'a jamais
atteint le dépôt, et son conteneur ayant disparu, ce travail est définitivement perdu.

**Cause** — une session cloud qui dialogue sans jamais committer ne laisse aucune trace
hors de son conteneur. Le contrat impose de pousser à chaque commit, mais rien ne dit
quand faire le premier : une session qui tourne longtemps avant de produire un artefact
est indistinguable, vue du dépôt, d'une session qui n'a jamais existé.

**Detecte par** — `utilisateur`

**Action** — `comportement` — pousser un premier commit (entrée de journal, spec) dès que
le sujet est arrêté, avant tout dialogue long : c'est le seul point de reprise qu'une
autre session pourra retrouver.

### 2. Deux retouches abandonnées qui ne se combinent pas

**Symptome** — les deux évolutions d'affichage laissées en brouillon les 9 et 10 août
touchent le même fichier de style et, appliquées ensemble, produisent une échelle non
monotone : la hauteur de marée passerait à 3rem en base et retomberait à 2,6rem au palier
tablette, soit plus petit sur un écran plus large.

**Cause** — les deux branches ont été écrites en parallèle depuis la même base, chacune
ignorant l'autre, et aucune n'a été rejouée sur la mise en page pleine largeur fusionnée
depuis. Une pull request brouillon laissée ouverte ne vieillit pas visiblement : rien ne
signale qu'elle a cessé d'être applicable.

**Detecte par** — `auteur`

**Action** — `comportement` — reprendre une branche abandonnée, c'est en relire l'intention
puis la réécrire sur la base courante, jamais la fusionner telle quelle.

### 3. Un PRP qui fixe un paramètre de fournisseur sans l'avoir appelé

**Symptome** — le PRP de la navigation temporelle demandait `forecast_days=7` pour couvrir
sept jours vers l'avant. À l'implémentation, le dernier jour navigable rendait une liste
d'heures vide : Open-Meteo compte **aujourd'hui** dans sa fenêtre, donc `forecast_days=7`
s'arrête à J+6. La marée, dont la fenêtre se déclare en dates de début et de fin, couvrait
bien J+7 — l'écran aurait affiché un jour à moitié rempli, dégradé sans être cassé, donc
sans rien signaler.

**Cause** — la valeur a été déduite de l'intention (« sept jours ») au lieu d'être vérifiée
par un appel réel, alors que `past_days=7` l'avait été le jour même. La vérification a
porté sur le paramètre nouveau et pas sur celui qu'on croyait connaître.

**Detecte par** — `auteur`

**Action** — `comportement` — un paramètre de fournisseur écrit dans un PRP se vérifie par
un appel réel, y compris quand il était déjà dans le code : ce qui semblait acquis est
justement ce qu'on ne relit pas.

### 4. Le garde-fou de commit bloque pendant qu'un agent travaille

**Symptome** — `garde-commit.sh` refuse de terminer un tour tant que l'arbre est sale. Or
une étape déléguée à l'`artisan` dure plusieurs minutes, pendant lesquelles l'arbre est
sale en permanence et le travail n'est pas committable : le tour s'est terminé trois fois
sur le même refus, et il a fallu ranger une modification en attente hors de l'arbre pour
en sortir. Le garde-fou dit pourtant « si ce travail ne doit délibérément pas être
committé, dis-le explicitement » — le dire ne change rien, il ne lit pas la réponse.

**Cause** — le hook a été écrit pour un agent qui édite lui-même, où arbre sale et étape
finie coïncident. Le contrat impose par ailleurs de déléguer le code des apps à
l'`artisan` : les deux règles se contredisent pendant toute la durée de l'agent, et c'est
la plus mécanique des deux qui gagne.

**Detecte par** — `auteur`

**Action** — `garde-fou` — laisser passer un arbre sale quand un sous-agent d'édition
tourne encore, ou accepter une phrase convenue qui vaut renoncement explicite pour ce
tour-là. Sinon la règle apprend à contourner : ranger le travail ailleurs pour faire
taire le garde-fou est exactement ce qu'il devrait empêcher.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 10:06 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 7 220 | 0,02 $ |
| Écriture de cache | 919 821 | 4,27 $ |
| Lecture de cache | 31 008 694 | 11,77 $ |
| Sortie | 55 710 | 1,38 $ |
| **Total** | **31 991 445** | **17,44 $ — 15,15 €** |

**Ce qui coûte**

- **230 appel(s) au modèle** — un par réponse, outils compris —, dont 149 par des sous-agents — 19 101 163 jetons, 7,63 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 858 jetons, écrits une fois par session puis relus à chaque
  échange : 4 868 640 jetons de relecture, 15 % de tout ce qui a été relu.
- **Tours courts** — 173 des 230 tours (75 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 10,81 $, soit 61 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 858 jetons relus au premier appel qui relise
  quelque chose, 215 133 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 31991445 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 60858 0 585
2 principal claude-opus-5 2321 60858 225
3 principal claude-opus-5 523 63179 409
4 principal claude-opus-5 2079 63702 303
5 principal claude-opus-5 993 65781 595
6 principal claude-opus-5 16908 66774 1672
7 principal claude-opus-5 3787 83682 629
8 principal claude-opus-5 1838 87469 689
9 principal claude-opus-5 1041 89307 719
10 principal claude-opus-5 7576 90348 1809
11 principal claude-opus-5 1976 97924 424
12 principal claude-opus-5 803 99900 1683
13 principal claude-opus-5 1779 100703 661
14 principal claude-opus-5 1050 102482 911
15 principal claude-opus-5 4174 103532 832
16 principal claude-opus-5 1421 107706 2747
17 principal claude-opus-5 11258 109127 397
18 principal claude-opus-5 631 120385 90
19 principal claude-opus-5 1335 121016 1603
20 principal claude-opus-5 1678 122351 1220
21 principal claude-opus-5 10724 124029 1794
22 principal claude-opus-5 2176 134753 213
23 principal claude-opus-5 1753 136929 2887
24 principal claude-opus-5 2946 138682 250
25 principal claude-opus-5 2734 141628 1252
26 principal claude-opus-5 5406 144362 771
27 principal claude-opus-5 858 149768 295
28 principal claude-opus-5 875 150626 255
29 principal claude-opus-5 3613 151501 250
30 principal claude-opus-5 393 155114 486
31 principal claude-opus-5 768 155507 176
32 principal claude-opus-5 316 156275 486
33 principal claude-opus-5 533 156591 178
34 principal claude-opus-5 2374 157124 415
35 principal claude-opus-5 536 159498 144
36 principal claude-opus-5 1021 160034 86
37 principal claude-opus-5 155 161055 269
38 principal claude-opus-5 384 161210 175
39 principal claude-opus-5 268 161594 448
40 principal claude-opus-5 527 161862 206
41 principal claude-opus-5 3270 162389 537
42 principal claude-opus-5 941 165659 430
43 principal claude-opus-5 1640 166600 743
44 principal claude-opus-5 848 168240 447
45 principal claude-opus-5 1523 169088 203
46 principal claude-opus-5 1158 170611 441
47 principal claude-opus-5 1881 171769 484
48 principal claude-opus-5 133061 42858 380
49 principal claude-opus-5 397 175919 154
50 principal claude-opus-5 183 176316 360
51 principal claude-opus-5 518 176499 135
52 principal claude-opus-5 213 177017 105
53 principal claude-opus-5 2333 177230 1661
54 principal claude-opus-5 2565 179563 2262
55 principal claude-opus-5 2538 182128 198
56 principal claude-opus-5 442 184666 948
57 principal claude-opus-5 1004 185108 2970
58 principal claude-opus-5 3329 186112 305
59 principal claude-opus-5 587 189441 2001
60 principal claude-opus-5 5655 190028 115
61 principal claude-opus-5 9084 190028 399
62 principal claude-opus-5 442 199112 553
63 principal claude-opus-5 656 199554 884
64 principal claude-opus-5 947 200210 644
65 principal claude-opus-5 733 201157 906
66 principal claude-opus-5 915 201890 186
67 principal claude-opus-5 468 202805 140
68 principal claude-opus-5 392 203273 287
69 principal claude-opus-5 602 203665 273
70 principal claude-opus-5 3046 203273 284
71 principal claude-opus-5 500 206319 295
72 principal claude-opus-5 311 206819 244
73 principal claude-opus-5 252 207130 474
74 principal claude-opus-5 533 207382 299
75 principal claude-opus-5 671 207915 240
76 principal claude-opus-5 1340 208586 958
77 principal claude-opus-5 1262 209926 199
78 principal claude-opus-5 908 211188 968
79 principal claude-opus-5 1152 212096 1810
80 principal claude-opus-5 1885 213248 93
81 principal claude-opus-5 428 215133 225
82 agent claude-sonnet-5 17018 0 5
83 agent claude-sonnet-5 3918 17018 5
84 agent claude-sonnet-5 5599 20936 6
85 agent claude-sonnet-5 6945 26535 6
86 agent claude-sonnet-5 1335 33480 3
87 agent claude-sonnet-5 1725 34815 5
88 agent claude-sonnet-5 14937 36540 3
89 agent claude-sonnet-5 715 51477 2
90 agent claude-sonnet-5 2954 52192 17
91 agent claude-sonnet-5 741 55146 17
92 agent claude-sonnet-5 525 55887 17
93 agent claude-sonnet-5 417 56412 2
94 agent claude-sonnet-5 647 56829 17
95 agent claude-sonnet-5 645 57476 17
96 agent claude-sonnet-5 477 58121 17
97 agent claude-sonnet-5 457 58598 17
98 agent claude-sonnet-5 633 59055 2
99 agent claude-sonnet-5 516 59688 2
100 agent claude-sonnet-5 2687 60204 2
101 agent claude-sonnet-5 9028 62891 2
102 agent claude-sonnet-5 137 71919 20
103 agent claude-sonnet-5 1559 72056 3
104 agent claude-sonnet-5 1296 73615 2
105 agent claude-sonnet-5 142 74911 2
106 agent claude-sonnet-5 280 75053 1
107 agent claude-sonnet-5 183 75333 1
108 agent claude-sonnet-5 64573 10792 2
109 agent claude-sonnet-5 21999 75365 5
110 agent claude-sonnet-5 713 97364 17
111 agent claude-sonnet-5 368 98077 2
112 agent claude-sonnet-5 651 98445 6
113 agent claude-sonnet-5 10400 99096 90
114 agent claude-sonnet-5 111 109496 20
115 agent claude-sonnet-5 108 109607 20
116 agent claude-sonnet-5 638 109715 5
117 agent claude-sonnet-5 7006 10792 4
118 agent claude-sonnet-5 4480 17798 4
119 agent claude-sonnet-5 1036 22278 2
120 agent claude-sonnet-5 19886 23314 6
121 agent claude-sonnet-5 18188 43200 2
122 agent claude-sonnet-5 8337 61388 4
123 agent claude-sonnet-5 6830 69725 3
124 agent claude-sonnet-5 13054 76555 7
125 agent claude-sonnet-5 25648 89609 20
126 agent claude-sonnet-5 2890 115257 2
127 agent claude-sonnet-5 1125 118147 20
128 agent claude-sonnet-5 1800 119272 2
129 agent claude-sonnet-5 681 121072 20
130 agent claude-sonnet-5 644 121753 17
131 agent claude-sonnet-5 444 122397 2
132 agent claude-sonnet-5 572 122841 20
133 agent claude-sonnet-5 574 123413 2
134 agent claude-sonnet-5 1464 123987 2
135 agent claude-sonnet-5 375 125451 20
136 agent claude-sonnet-5 2986 125826 2
137 agent claude-sonnet-5 137 128812 4
138 agent claude-sonnet-5 494 128949 2
139 agent claude-sonnet-5 295 129443 17
140 agent claude-sonnet-5 2343 129738 10
141 agent claude-sonnet-5 1146 132081 20
142 agent claude-sonnet-5 722 133227 3
143 agent claude-sonnet-5 2018 133949 3
144 agent claude-sonnet-5 187 135967 2
145 agent claude-sonnet-5 955 136154 9
146 agent claude-sonnet-5 1392 137109 2
147 agent claude-sonnet-5 569 138501 6
148 agent claude-sonnet-5 1663 139070 6
149 agent claude-sonnet-5 1152 140733 2
150 agent claude-sonnet-5 155 141885 20
151 agent claude-sonnet-5 208 142040 6
152 agent claude-sonnet-5 673 142248 20
153 agent claude-sonnet-5 114 142921 2
154 agent claude-sonnet-5 7780 143035 2
155 agent claude-sonnet-5 269 150815 17
156 agent claude-sonnet-5 292 151084 20
157 agent claude-sonnet-5 95 151376 20
158 agent claude-sonnet-5 2612 151471 9
159 agent claude-sonnet-5 316 154083 2
160 agent claude-sonnet-5 1037 154399 4
161 agent claude-sonnet-5 405 155436 2
162 agent claude-sonnet-5 1592 155841 3
163 agent claude-sonnet-5 606 157433 2
164 agent claude-sonnet-5 808 158039 6
165 agent claude-sonnet-5 819 158847 2
166 agent claude-sonnet-5 1182 159666 5
167 agent claude-sonnet-5 1628 160848 2
168 agent claude-sonnet-5 894 162476 6
169 agent claude-sonnet-5 1138 163370 20
170 agent claude-sonnet-5 624 164508 17
171 agent claude-sonnet-5 552 165132 2
172 agent claude-sonnet-5 931 165684 17
173 agent claude-sonnet-5 754 166615 6
174 agent claude-sonnet-5 1911 167369 20
175 agent claude-sonnet-5 468 169280 10
176 agent claude-sonnet-5 806 169748 2
177 agent claude-sonnet-5 933 170554 20
178 agent claude-sonnet-5 448 171487 17
179 agent claude-sonnet-5 1370 171935 3
180 agent claude-sonnet-5 224 173305 9
181 agent claude-sonnet-5 129 173529 20
182 agent claude-sonnet-5 4364 173658 2
183 agent claude-sonnet-5 149 178022 2
184 agent claude-sonnet-5 144 178171 2
185 agent claude-sonnet-5 169 178315 20
186 agent claude-sonnet-5 3867 178484 3
187 agent claude-sonnet-5 851 182351 2
188 agent claude-sonnet-5 227 183202 20
189 agent claude-sonnet-5 1264 183429 2
190 agent claude-sonnet-5 143 184693 20
191 agent claude-sonnet-5 75 184836 2
192 agent claude-sonnet-5 184 184911 2
193 agent claude-sonnet-5 1775 185095 1
194 agent claude-sonnet-5 1086 186870 2
195 agent claude-sonnet-5 442 187956 2
196 agent claude-sonnet-5 519 188398 2
197 agent claude-sonnet-5 191 188917 1
198 agent claude-sonnet-5 258 189108 1
199 agent claude-sonnet-5 177593 8120 2
200 agent claude-sonnet-5 2909 185713 8
201 agent claude-sonnet-5 1909 188622 2
202 agent claude-sonnet-5 1711 190531 20
203 agent claude-sonnet-5 568 192242 17
204 agent claude-sonnet-5 606 192810 5
205 agent claude-sonnet-5 656 193416 20
206 agent claude-sonnet-5 1400 194072 5
207 agent claude-sonnet-5 957 195472 17
208 agent claude-sonnet-5 420 196429 7
209 agent claude-sonnet-5 880 196849 17
210 agent claude-sonnet-5 772 197729 8
211 agent claude-sonnet-5 1944 198501 2
212 agent claude-sonnet-5 181 200445 9
213 agent claude-sonnet-5 313 200626 9
214 agent claude-sonnet-5 134 200939 3
215 agent claude-sonnet-5 206 201073 3
216 agent claude-sonnet-5 2244 201279 2
217 agent claude-sonnet-5 167 203523 20
218 agent claude-sonnet-5 573 203690 1
219 agent claude-sonnet-5 280 204263 20
220 agent claude-sonnet-5 75 204543 2
221 agent claude-sonnet-5 276 204618 5
222 agent claude-sonnet-5 268 204894 5
223 agent claude-haiku-4-5-20251001 12367 0 2
224 agent claude-haiku-4-5-20251001 1307 12367 1
225 agent claude-haiku-4-5-20251001 337 13674 1
226 agent claude-haiku-4-5-20251001 659 14011 3
227 agent claude-haiku-4-5-20251001 152 14670 1
228 agent claude-haiku-4-5-20251001 807 14822 3
229 agent claude-haiku-4-5-20251001 348 15629 3
230 agent claude-haiku-4-5-20251001 149 15977 2
-->
<!-- /cout -->
