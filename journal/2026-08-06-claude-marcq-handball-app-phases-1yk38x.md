# 2026-08-06 — claude/marcq-handball-app-phases-1yk38x

Branche : `claude/marcq-handball-app-phases-1yk38x`
Périmètre : marcq-handball
Mode : `chaud`

Execution des PRP du lot 1 de `apps/marcq-handball/prp/` : 01 socle, 02
programme, 03 entree, 04 seance, 05 perso, 06 recompenses.

## Anomalies

### 1. Le harnais impose une branche unique la ou les PRP en prevoient une par lot

**Symptome** — les PRP decoupent le travail en « un PRP = une branche
`marcq-handball/<sujet>` = une pull request », et le PRP 01 en exige meme deux
(`socle` puis `activation`) parce que la CI ne publie l'image que sur un push
vers `main`. La session cloud, elle, ne peut pousser que sur
`claude/marcq-handball-app-phases-1yk38x`.

**Cause** — le harnais assigne le nom de la branche et refuse tout autre
remote ref, exactement le cas deja consigne dans
`journal/2026-08-03-fabrique-prefixe-impose-par-le-harnais.md`. Le contrat
accepte le prefixe `claude/` pour rejoindre une branche, mais rien n'attenue la
consequence en aval : les frontieres de relecture prevues par les PRP
disparaissent.

**Consequence tenue** — tout le lot 1 arrive dans une seule pull request, un
commit par tache de PRP pour garder la relisibilite, et `enabled` reste a
`false` : activer l'app dans la meme PR referencerait une image qui n'existe pas
encore au registre et ferait echouer le `compose up` de toute la stack.
L'activation est un geste separe, apres la fusion et la publication de l'image.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le decoupage en PR des PRP suppose une liberte de
nommage de branche que les sessions cloud n'ont pas ; a trancher une fois pour
toutes plutot qu'a chaque app.

### 2. Le PRP 02 casse un test Go du PRP 01 sans le dire

**Symptome** — deposer `web/programme.json` fait echouer
`TestProgrammeJSONPasEncoreLivre`, qui exige un 404 sur cette route. Le PRP 02
ne mentionne ni `main_test.go` ni ce test, ni dans sa liste « Fichiers », ni
dans aucune de ses huit taches.

**Cause** — la consigne existe, mais elle est ecrite dans le PRP 01 (« PRP 02
depose le fichier et remplace `TestProgrammeJSONPasEncoreLivre` par l'assertion
200 ») et nulle part dans le PRP 02. Un agent qui applique le 02 sans avoir lu
le 01 en entier casse la suite Go et ne sait pas pourquoi.

**Detecte par** — `test`

**Action** — `contrat` — une obligation d'un PRP aval doit etre ecrite dans ce
PRP aval, pas seulement dans celui qui l'anticipe. Le renvoi croise ne suffit
pas quand les deux documents sont censes s'executer separement.

### 3. Le PRP 03 casse deux tests du PRP 01 sans le dire

**Symptome** — la tache 6 du PRP 03 remplace `web/index.html` par une coque qui
ne porte plus le script inline d'enregistrement du service worker : il passe
dans `app.js`. Deux tests ecrits par le PRP 01 tombent alors —
`le service worker est enregistre depuis la racine`, qui lit `index.html`, et
`TestRacineSertLaCoque`, qui cherche la chaine « sw.js » dans le corps servi.

**Cause** — meme forme que l'anomalie 2, dans l'autre sens : le PRP 03 remplace
un fichier ecrit par un PRP amont et ne dit pas quelles assertions ce
remplacement invalide. Le deplacement est justifie — l'enregistrement n'est pas
sur le chemin de l'affichage, et l'objectif du PRD §4 se joue sur la premiere
seconde — mais rien ne le signale au lecteur du PRP 03.

**Detecte par** — `test`

**Action** — `contrat` — un PRP qui REMPLACE un fichier d'un PRP amont doit
lister les assertions qu'il deplace, comme il liste les fichiers qu'il modifie.

### 4. Le code du PRP 04 echoue au test du PRP 04

**Symptome** — la tache 5 fait echouer son propre test
`la vue ne compose jamais de HTML a partir du programme` : il refuse la
sous-chaine `innerHTML` n'importe ou dans `web/vue-seance.js`, commentaires
compris, et le commentaire du bloc `el()` fourni par le PRP dit « textContent et
jamais innerHTML ».

**Cause** — le PRP 02 avait pose la regle exactement pour ce cas — « le test de
purete cherche des sous-chaines, pas des identifiants […] n'ecris pas le mot
interdit dans un commentaire » — et notait que ses propres commentaires etaient
rediges pour l'eviter. Le PRP 04 pose un test de la meme famille et ne se
l'applique pas.

**Detecte par** — `test`

**Action** — `garde-fou` — un test de source qui interdit une sous-chaine
devrait ignorer les commentaires, ou la relecture d'un PRP devrait verifier que
son propre code passe ses propres tests de source. La regle existe deja au
PRP 02 ; c'est son application qui manque.

### 5. Le montage du PRP 05 pose deux classes qui n'existent dans aucune feuille

**Symptome** — le test `toute classe posee par l ecran existe dans style.css`,
ecrit par le PRP 05 lui-meme, echoue sur `.volume-perso` et
`.calendrier-perso` : le montage les pose, le bloc CSS fourni par le meme PRP ne
les declare pas.

**Cause** — le test lit les classes dans la SOURCE du montage ; le bloc CSS,
lui, a ete redige a la main a partir de ce qu'on voulait styler, pas de ce qui
etait pose. Les deux sections n'avaient besoin d'aucun style propre — elles sont
espacees par le `gap` du parent — donc personne ne les a ecrites.

**Detecte par** — `test`

**Action** — `rien` — le garde-fou a fait exactement son travail, et c'est le
troisieme PRP d'affilee ou ce test attrape quelque chose. Rien a changer.

### 6. Trois tests de source des PRP se contredisent avec le code des PRP

**Symptome** — trois fois sur six PRP, un test de source ecrit par un PRP refuse
une chaine que le code du meme PRP contient, ou qu'un PRP amont a laissee :
`innerHTML` dans un commentaire (PRP 04, anomalie 4), les deux assertions du
service worker deplacees (PRP 03, anomalie 3), les classes non declarees
(PRP 05, anomalie 5).

**Cause** — les tests de source sont ecrits comme des filets larges — une
sous-chaine n'importe ou dans le fichier — et c'est leur force : ils sont
triviaux a executer et impossibles a contourner par megarde. Mais un PRP est
relu comme de la prose, pas execute : rien ne verifie que le code qu'il dicte
passe les tests qu'il dicte.

**Detecte par** — `test`

**Action** — `comportement` — la relecture d'un PRP devrait inclure une passe
mecanique : appliquer ses blocs de code et lancer ses blocs de test avant de
figer le document. Aucun artefact a changer, seulement l'ordre des gestes.


### 7. Le PRP 01 croit que `./init.sh` declare le plugin LSP ; il ne le fait pas

**Symptome** — l'etape 5 de la tache 1 du PRP 01 annonce que « `./init.sh` vient
d'ajouter `typescript-lsp` a `.claude/settings.json` et l'installation de
`typescript-language-server` a `.claude/cloud-setup.sh` ». Aucun des deux
fichiers n'a change, et `--check` a averti pendant tout le lot 1 :
`settings.json : 1 plugin attendu absent` et `cloud-setup.sh desynchronise`.

**Cause** — `.claude/` n'est pas un artefact genere. Le contrat le dit
explicitement — « le workflow de CI, `.claude/` est ordinaire, a editer
directement ; `--check` en verifie l'existence et les proprietes qui comptent,
pas l'egalite a un generateur » — et ajoute que le commit qui introduit un
langage nouveau doit editer les deux fichiers a la main. Le PRP 01 a lu
l'avertissement de `--check` comme la trace d'une generation.

**Detecte par** — `auteur`

**Action** — `contrat` — a corriger dans le PRP 01 : `./init.sh` AVERTIT qu'un
plugin manque, il ne l'ajoute pas. Les deux fichiers s'editent a la main, et
c'est ce qui a ete fait ici.

### 8. Le job `deploy` est vert alors que rien n'a ete deploye

**Symptome** — apres la fusion de la PR #53, les six jobs de la CI sont verts, y
compris `deploy` et son etape « declencher le deploiement ». Une heure plus
tard, `https://marcq-handball.apps.billbob.ovh/healthz` rend toujours `307` : le
routeur de l'app n'existe pas, le conteneur non plus. Le journal du job porte la
reponse du serveur, en clair :

    reponse HTTP 200 :
    {"success":false,"error":"Git clone failed: Cloning into
     '/app/data/git-repos/OVH/my-repo'...\nssh: Could not resolve hostname
     github.com: No address associated with hostname\r\nfatal: Could not read
     from remote repository."}

**Cause** — deux causes superposees, et c'est ce qui rend l'anomalie couteuse.
La cause racine est cote serveur : le conteneur `dockhand` ne resout plus
`github.com`, son clone du depot echoue, donc il ne voit jamais le nouveau
`compose.yaml`. Rien dans ce depot ne peut la corriger.

La seconde est ici : le garde-fou de l'etape ne teste que le code HTTP et le
champ `skipped`. dockhand, lui, repond **200 avec `success: false`** et met la
cause dans `error`. Le seul cas d'echec que la CI savait voir etait « aucun
commit nouveau » ; tous les autres passaient pour un succes.

**Consequence tenue** — le test `success: false` est ajoute AVANT celui de
`skipped` : il couvre toutes les causes de refus, la ou l'autre n'en couvre
qu'une. La CI deviendra rouge a chaque fusion tant que le serveur ne resout pas
`github.com` — c'est le comportement voulu : un deploiement qui echoue doit se
voir a la fusion, pas une heure apres en tapant l'URL a la main.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — le garde-fou existait et regardait a cote. Un
controle qui ne lit que le code HTTP d'une API qui repond 200 sur echec ne
controle rien.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-06 à 09:22 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 839 | 0,00 $ |
| Écriture de cache | 1 660 375 | 7,15 $ |
| Lecture de cache | 120 294 502 | 57,28 $ |
| Sortie | 274 476 | 4,96 $ |
| **Total** | **122 230 192** | **69,39 $ — 60,26 €** |

**Ce qui coûte**

- **454 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 713 jetons, écrits une fois par session puis relus à chaque
  échange : 24 784 989 jetons de relecture, 20 % de tout ce qui a été relu.
- **Croissance** — 54 713 jetons relus au premier appel qui relise
  quelque chose, 652 382 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 122230192 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54713 0 375
2 principal claude-opus-5 741 54713 133
3 principal claude-opus-5 1904 55454 178
4 principal claude-opus-5 3326 57358 650
5 principal claude-opus-5 1495 60684 227
6 principal claude-opus-5 9463 62179 98
7 principal claude-opus-5 23401 71642 140
8 principal claude-opus-5 11058 95043 1200
9 principal claude-opus-5 6980 106101 636
10 principal claude-opus-5 3566 113081 368
11 principal claude-opus-5 1788 116647 820
12 principal claude-opus-5 930 118435 82
13 principal claude-opus-5 3616 119365 219
14 principal claude-opus-5 392 122981 241
15 principal claude-opus-5 1484 123373 843
16 principal claude-opus-5 917 124857 139
17 principal claude-opus-5 182 125774 309
18 principal claude-opus-5 1957 125956 324
19 principal claude-opus-5 2010 127913 379
20 principal claude-opus-5 704 129923 234
21 principal claude-opus-5 571 130627 548
22 principal claude-opus-4-7 32591 0 293
23 principal claude-opus-4-7 409 32591 259
24 principal claude-opus-5 570 131198 1525
25 principal claude-opus-5 1583 131768 111
26 principal claude-opus-5 172 133351 124
27 principal claude-opus-4-7 3013 33000 611
28 principal claude-opus-5 176 133523 1305
29 principal claude-opus-5 1360 133699 720
30 principal claude-opus-5 870 135059 2082
31 principal claude-opus-5 2232 135929 253
32 principal claude-opus-5 309 138161 155
33 principal claude-opus-5 197 138470 280
34 principal claude-opus-5 757 138667 710
35 principal claude-opus-5 930 139424 192
36 principal claude-opus-5 199 140354 2463
37 principal claude-opus-4-7 7118 27342 1737
38 principal claude-opus-5 2517 140553 115
39 principal claude-opus-4-7 2000 34460 177
40 principal claude-opus-4-7 261 36460 164
41 principal claude-opus-5 177 143070 263
42 principal claude-opus-4-7 799 36721 435
43 principal claude-opus-4-7 6837 37520 2749
44 principal claude-opus-5 901 143247 3095
45 principal claude-opus-5 3147 144148 299
46 principal claude-opus-5 469 147295 237
47 principal claude-opus-5 375 147764 122
48 principal claude-opus-5 258 148139 312
49 principal claude-opus-5 308 148397 163
50 principal claude-opus-5 187 148705 131
51 principal claude-opus-5 249 148892 201
52 principal claude-opus-5 575 149141 152
53 principal claude-opus-5 169 149716 102
54 principal claude-opus-5 154 149885 792
55 principal claude-opus-4-7 9377 27342 140
56 principal claude-opus-4-7 219 36719 86
57 principal claude-opus-5 919 150039 820
58 principal claude-opus-5 875 150958 73
59 principal claude-opus-4-7 3386 36938 88
60 principal claude-opus-5 370 151833 268
61 principal claude-opus-4-7 2678 40324 87
62 principal claude-opus-5 349 152203 165
63 principal claude-opus-4-7 336 43002 77
64 principal claude-opus-5 444 152552 638
65 principal claude-opus-5 723 152996 134
66 principal claude-opus-4-7 10199 27342 354
67 principal claude-opus-4-7 888 37541 125
68 principal claude-opus-5 175 153719 1099
69 principal claude-opus-4-7 427 38429 82
70 principal claude-opus-5 1154 153894 162
71 principal claude-opus-4-7 127 38856 112
72 principal claude-opus-4-7 203 38983 174
73 principal claude-opus-4-7 137 43338 3595
74 principal claude-opus-4-7 769 39186 86
75 principal claude-opus-4-7 3386 39955 89
76 principal claude-opus-4-7 1476 43341 89
77 principal claude-opus-4-7 906 44817 88
78 principal claude-opus-4-7 811 45723 87
79 principal claude-opus-5 263 155048 563
80 principal claude-opus-4-7 4004 27342 140
81 principal claude-opus-5 693 155311 294
82 principal claude-opus-4-7 222 31346 89
83 principal claude-opus-5 11005 156004 301
84 principal claude-opus-4-7 478 46534 1463
85 principal claude-opus-4-7 906 31568 77
86 principal claude-opus-4-7 606 32474 144
87 principal claude-opus-4-7 1778 47012 88
88 principal claude-opus-4-7 459 33080 87
89 principal claude-opus-5 355 167009 2193
90 principal claude-opus-5 2252 167364 303
91 principal claude-opus-5 359 169616 154
92 principal claude-opus-5 311 169975 881
93 principal claude-opus-4-7 1708 33539 2408
94 principal claude-opus-4-7 2678 48790 2744
95 principal claude-opus-5 937 170286 4014
96 principal claude-opus-5 4069 171223 146
97 principal claude-opus-5 140 175292 304
98 principal claude-opus-5 319 175432 235
99 principal claude-opus-5 458 175751 758
100 principal claude-opus-5 814 176209 149
101 principal claude-opus-5 477 177023 242
102 principal claude-opus-5 3765 177500 158
103 principal claude-opus-5 9467 181265 808
104 principal claude-opus-5 882 190732 928
105 principal claude-opus-4-7 11830 27342 151
106 principal claude-opus-4-7 199 39172 96
107 principal claude-opus-4-7 204 39371 113
108 principal claude-opus-4-7 190 39575 86
109 principal claude-opus-5 989 191614 840
110 principal claude-opus-4-7 3386 39765 128
111 principal claude-opus-4-7 2947 43151 648
112 principal claude-opus-5 3979 192603 1720
113 principal claude-opus-4-7 683 46098 88
114 principal claude-opus-5 1909 196582 104
115 principal claude-opus-4-7 811 46781 219
116 principal claude-opus-5 119 198491 593
117 principal claude-opus-4-7 1036 47592 1921
118 principal claude-opus-4-7 11299 27342 210
119 principal claude-opus-4-7 390 38641 159
120 principal claude-opus-4-7 5485 39031 161
121 principal claude-opus-4-7 3467 44516 86
122 principal claude-opus-5 644 198610 2268
123 principal claude-opus-5 2284 199254 1222
124 principal claude-opus-4-7 3386 47983 1878
125 principal claude-opus-5 4978 201538 1165
126 principal claude-opus-5 1221 206516 121
127 principal claude-opus-4-7 6800 27342 157
128 principal claude-opus-4-7 240 34142 90
129 principal claude-opus-5 4476 207737 1723
130 principal claude-opus-4-7 3747 34382 814
131 principal claude-opus-5 1739 212213 590
132 principal claude-opus-5 649 213952 640
133 principal claude-opus-4-7 7866 38129 605
134 principal claude-opus-4-7 849 45995 660
135 principal claude-opus-5 4773 214601 791
136 principal claude-opus-5 847 219374 226
137 principal claude-opus-4-7 6257 27342 294
138 principal claude-opus-4-7 479 33599 164
139 principal claude-opus-5 753 220221 559
140 principal claude-opus-5 617 220974 1061
141 principal claude-opus-4-7 11972 34078 1339
142 principal claude-opus-5 2349 221591 660
143 principal claude-opus-5 754 223940 293
144 principal claude-opus-5 7923 224694 120
145 principal claude-opus-5 7832 232617 120
146 principal claude-opus-5 8086 240449 3661
147 principal claude-opus-5 3718 248535 155
148 principal claude-opus-5 298 252253 2723
149 principal claude-opus-5 2778 252551 109
150 principal claude-opus-5 125 255329 839
151 principal claude-opus-5 886 255454 1806
152 principal claude-opus-4-7 9533 27342 1014
153 principal claude-opus-5 1864 256340 134
154 principal claude-opus-4-7 1096 36875 89
155 principal claude-opus-4-7 3113 37971 215
156 principal claude-opus-4-7 695 41084 245
157 principal claude-opus-5 256 258204 1175
158 principal claude-opus-5 1234 258460 187
159 principal claude-opus-4-7 320 41779 1271
160 principal claude-opus-5 7011 259694 2156
161 principal claude-opus-5 2213 266705 109
162 principal claude-opus-5 125 268918 901
163 principal claude-opus-4-7 8529 27342 133
164 principal claude-opus-4-7 181 35871 96
165 principal claude-opus-5 960 269043 956
166 principal claude-opus-4-7 204 36052 100
167 principal claude-opus-4-7 157 36256 92
168 principal claude-opus-4-7 2457 36413 93
169 principal claude-opus-4-7 1334 38870 92
170 principal claude-opus-4-7 2668 40204 130
171 principal claude-opus-4-7 4849 42872 89
172 principal claude-opus-5 2444 270003 2408
173 principal claude-opus-4-7 3113 47721 88
174 principal claude-opus-5 2467 272447 109
175 principal claude-opus-5 125 274914 667
176 principal claude-opus-4-7 811 50834 1739
177 principal claude-opus-5 717 275039 144
178 principal claude-opus-4-7 10264 27342 132
179 principal claude-opus-4-7 218 37606 93
180 principal claude-opus-5 8480 275756 606
181 principal claude-opus-4-7 2730 37824 92
182 principal claude-opus-4-7 7123 51645 1583
183 principal claude-opus-4-7 2457 40554 93
184 principal claude-opus-4-7 1334 43011 92
185 principal claude-opus-4-7 2668 44345 145
186 principal claude-opus-5 768 284236 2812
187 principal claude-opus-5 2866 285004 1283
188 principal claude-opus-4-7 3169 47013 2470
189 principal claude-opus-5 1322 287870 172
190 principal claude-opus-5 245 289192 674
191 principal claude-opus-4-7 4300 50182 1374
192 principal claude-opus-5 735 289437 337
193 principal claude-opus-5 394 290172 124
194 principal claude-opus-5 174 290566 273
195 principal claude-opus-5 337 290740 163
196 principal claude-opus-5 426 291077 1666
197 principal claude-opus-5 1932 291503 832
198 principal claude-opus-5 852 293435 921
199 principal claude-opus-5 945 294287 121
200 principal claude-opus-4-7 9193 27342 186
201 principal claude-opus-4-7 364 36535 372
202 principal claude-opus-5 3743 295232 775
203 principal claude-opus-4-7 12122 36899 221
204 principal claude-opus-4-7 4523 49021 672
205 principal claude-opus-5 852 298975 2387
206 principal claude-opus-5 6515 299827 220
207 principal claude-opus-5 339 306342 260
208 principal claude-opus-5 318 306681 280
209 principal claude-opus-4-7 5853 53544 2887
210 principal claude-opus-5 354 306999 348
211 principal claude-opus-5 484 307353 189
212 principal claude-opus-5 1686 307837 86
213 principal claude-opus-5 155 309523 143
214 principal claude-opus-5 214 309678 265
215 principal claude-opus-5 433 309892 1817
216 principal claude-opus-5 2006 310325 152
217 principal claude-opus-5 279 312331 204
218 principal claude-opus-5 539 312610 184
219 principal claude-opus-5 1911 313149 1045
220 principal claude-opus-5 1107 315060 304
221 principal claude-opus-4-7 4209 27342 190
222 principal claude-opus-5 7768 316167 120
223 principal claude-opus-4-7 373 31551 162
224 principal claude-opus-5 8935 323935 120
225 principal claude-opus-4-7 5616 31924 418
226 principal claude-opus-4-7 567 37540 611
227 principal claude-opus-4-7 3444 38107 1126
228 principal claude-opus-5 8279 332870 4694
229 principal claude-opus-5 4752 341149 144
230 principal claude-opus-5 265 345901 5493
231 principal claude-opus-5 5551 346166 109
232 principal claude-opus-5 153 351717 444
233 principal claude-opus-5 505 351870 111
234 principal claude-opus-5 127 352375 1205
235 principal claude-opus-5 1279 352502 1703
236 principal claude-opus-5 1827 353781 121
237 principal claude-opus-5 5925 355608 1030
238 principal claude-opus-5 5135 361533 486
239 principal claude-opus-5 4228 366668 456
240 principal claude-opus-5 473 370896 149
241 principal claude-opus-5 224 371369 186
242 principal claude-opus-5 345 371593 115
243 principal claude-opus-5 458 371938 2164
244 principal claude-opus-5 2580 372396 450
245 principal claude-opus-5 1045 374976 1255
246 principal claude-opus-5 1338 376021 1634
247 principal claude-opus-4-7 14326 27342 194
248 principal claude-opus-5 1680 377359 1190
249 principal claude-opus-4-7 242 41668 79
250 principal claude-opus-4-7 341 41910 87
251 principal claude-opus-4-7 167 42251 92
252 principal claude-opus-4-7 6148 42418 125
253 principal claude-opus-4-7 3149 48566 92
254 principal claude-opus-4-7 0 41668 441
255 principal claude-opus-5 1232 379039 979
256 principal claude-opus-4-7 489 41668 93
257 principal claude-opus-4-7 2457 51715 88
258 principal claude-opus-4-7 201 42157 92
259 principal claude-opus-4-7 6148 42358 467
260 principal claude-opus-5 1076 380271 226
261 principal claude-opus-4-7 3251 54172 1020
262 principal claude-opus-4-7 15435 27342 313
263 principal claude-opus-5 457 381347 120
264 principal claude-opus-5 7980 381804 120
265 principal claude-opus-4-7 3491 48506 1002
266 principal claude-opus-4-7 361 42777 96
267 principal claude-opus-4-7 204 43138 92
268 principal claude-opus-4-7 6148 43342 88
269 principal claude-opus-4-7 3251 49490 89
270 principal claude-opus-4-7 5739 57423 1646
271 principal claude-opus-4-7 3113 52741 90
272 principal claude-opus-4-7 4809 55854 126
273 principal claude-opus-4-7 3367 51997 1196
274 principal claude-opus-4-7 1615 60663 927
275 principal claude-opus-5 6945 389784 3962
276 principal claude-opus-5 4150 396729 134
277 principal claude-opus-4-7 3135 63162 2042
278 principal claude-opus-5 254 400879 3262
279 principal claude-opus-4-7 3292 62278 3127
280 principal claude-opus-5 3320 401133 109
281 principal claude-opus-5 125 404453 1059
282 principal claude-opus-5 1114 404578 120
283 principal claude-opus-4-7 10688 27342 269
284 principal claude-opus-4-7 354 38030 122
285 principal claude-opus-5 7128 405692 907
286 principal claude-opus-4-7 181 38384 82
287 principal claude-opus-4-7 113 38565 82
288 principal claude-opus-4-7 3614 38678 82
289 principal claude-opus-4-7 5111 42292 496
290 principal claude-opus-4-7 5215 47403 141
291 principal claude-opus-5 5057 412820 4467
292 principal claude-opus-4-7 2506 52618 2026
293 principal claude-opus-5 8403 417877 118
294 principal claude-opus-5 176 426280 432
295 principal claude-opus-5 459 426456 343
296 principal claude-opus-5 489 426915 143
297 principal claude-opus-5 2917 427404 769
298 principal claude-opus-5 888 430321 1097
299 principal claude-opus-5 1116 431209 121
300 principal claude-opus-5 1944 432325 737
301 principal claude-opus-5 808 434269 193
302 principal claude-opus-5 210 435077 114
303 principal claude-opus-5 133 435287 190
304 principal claude-opus-5 223 435420 1874
305 principal claude-opus-5 2392 435643 154
306 principal claude-opus-5 1758 438035 806
307 principal claude-opus-5 800 439793 1051
308 principal claude-opus-5 1127 440593 211
309 principal claude-opus-4-7 8675 27342 216
310 principal claude-opus-5 542 441720 122
311 principal claude-opus-5 9088 442262 122
312 principal claude-opus-4-7 332 36017 119
313 principal claude-opus-4-7 188 36349 78
314 principal claude-opus-4-7 380 36537 231
315 principal claude-opus-4-7 11246 36917 523
316 principal claude-opus-4-7 11335 48163 1572
317 principal claude-opus-5 10046 451350 4683
318 principal claude-opus-4-7 7407 59498 1061
319 principal claude-opus-5 4743 461396 2745
320 principal claude-opus-5 2932 466139 1657
321 principal claude-opus-5 1672 469071 142
322 principal claude-opus-5 175 470743 1114
323 principal claude-opus-5 1157 470918 122
324 principal claude-opus-4-7 10929 27342 458
325 principal claude-opus-5 9178 472075 1045
326 principal claude-opus-4-7 506 38271 120
327 principal claude-opus-4-7 176 38777 81
328 principal claude-opus-4-7 111 38953 81
329 principal claude-opus-4-7 3043 39064 591
330 principal claude-opus-4-7 855 42107 175
331 principal claude-opus-5 5048 481253 3997
332 principal claude-opus-4-7 6661 42962 1190
333 principal claude-opus-5 7821 486301 137
334 principal claude-opus-5 4174 494122 901
335 principal claude-opus-5 942 498296 135
336 principal claude-opus-5 259 499238 1109
337 principal claude-opus-5 1190 499497 1634
338 principal claude-opus-5 1650 500687 583
339 principal claude-opus-5 654 502337 194
340 principal claude-opus-5 211 502991 220
341 principal claude-opus-5 228 503202 2336
342 principal claude-opus-5 2639 503430 186
343 principal claude-opus-5 1913 506069 1376
344 principal claude-opus-5 1441 507982 1569
345 principal claude-opus-5 6147 509423 152
346 principal claude-opus-5 474 515570 592
347 principal claude-opus-5 753 516044 164
348 principal claude-opus-5 263 516797 313
349 principal claude-opus-5 326 517060 374
350 principal claude-opus-5 587 517386 568
351 principal claude-opus-5 902 517973 430
352 principal claude-opus-5 528 518875 261
353 principal claude-opus-5 646 519403 498
354 principal claude-opus-5 921 520049 596
355 principal claude-opus-5 2852 520970 130
356 principal claude-opus-5 881 523822 620
357 principal claude-opus-5 2078 524703 654
358 principal claude-opus-5 697 526781 457
359 principal claude-opus-5 493 527478 206
360 principal claude-opus-4-7 3766 27342 198
361 principal claude-opus-5 504 527971 619
362 principal claude-opus-4-7 367 31108 148
363 principal claude-opus-5 636 528475 85
364 principal claude-opus-4-7 2713 31475 1111
365 principal claude-opus-5 92 529111 1053
366 principal claude-opus-5 493089 37128 505
367 principal claude-opus-5 671 530217 196
368 principal claude-opus-5 2405 530888 178
369 principal claude-opus-5 688 533293 272
370 principal claude-opus-5 317 533981 246
371 principal claude-opus-5 789 534298 334
372 principal claude-opus-5 3247 535087 425
373 principal claude-opus-5 543 538334 138
374 principal claude-opus-5 5479 538877 419
375 principal claude-opus-5 529 544356 162
376 principal claude-opus-5 174 544885 163
377 principal claude-opus-5 2536 545059 601
378 principal claude-opus-5 1052 547595 207
379 principal claude-opus-5 456 548647 330
380 principal claude-opus-5 340 549103 232
381 principal claude-opus-5 3466 549443 187
382 principal claude-opus-5 301 552909 204
383 principal claude-opus-5 5545 553210 659
384 principal claude-opus-5 702 558755 603
385 principal claude-opus-5 648 559457 198
386 principal claude-opus-5 680 560105 163
387 principal claude-opus-4-7 4506 27342 211
388 principal claude-opus-5 4488 560785 253
389 principal claude-opus-4-7 10848 31848 1002
390 principal claude-opus-5 977 565273 117
391 principal claude-opus-4-7 1103 42696 245
392 principal claude-opus-5 741 566250 571
393 principal claude-opus-4-7 1422 43799 391
394 principal claude-opus-5 581 566991 110
395 principal claude-opus-5 226 567572 253
396 principal claude-opus-4-7 2922 45221 468
397 principal claude-opus-5 263 567798 138
398 principal claude-opus-5 1439 568061 197
399 principal claude-opus-5 2498 569500 369
400 principal claude-opus-4-7 4201 48143 1444
401 principal claude-opus-5 1573 571998 347
402 principal claude-opus-5 369 573571 303
403 principal claude-opus-5 412 573940 199
404 principal claude-opus-5 284 574352 240
405 principal claude-opus-5 426 574636 106
406 principal claude-opus-5 302 575062 466
407 principal claude-opus-5 341 575830 459
408 principal claude-opus-5 536 576171 81
409 principal claude-opus-5 137 576788 127
410 principal claude-opus-5 827 576925 86
411 principal claude-opus-5 480 577752 1256
412 principal claude-opus-5 1698 578232 164
413 principal claude-opus-5 288 579930 191
414 principal claude-opus-5 12136 580218 288
415 principal claude-opus-5 402 592354 278
416 principal claude-opus-5 341 592756 164
417 principal claude-opus-5 340 593261 163
418 principal claude-opus-5 4220 593601 161
419 principal claude-opus-5 276 597821 200
420 principal claude-opus-5 210 598097 138
421 principal claude-opus-5 1081 598307 190
422 principal claude-opus-5 200 599388 89
423 principal claude-opus-5 133 599588 138
424 principal claude-opus-5 6171 599721 29
425 principal claude-opus-5 342 605921 138
426 principal claude-opus-5 1591 606263 146
427 principal claude-opus-5 128 607999 394
428 principal claude-opus-5 573 608127 181
429 principal claude-opus-5 299 608700 249
430 principal claude-opus-5 262 608999 155
431 principal claude-opus-5 165 609261 220
432 principal claude-opus-5 230 609426 163
433 principal claude-opus-5 372 609656 224
434 principal claude-opus-5 232 610028 34
435 principal claude-opus-5 193 610294 458
436 principal claude-opus-5 522 610487 344
437 principal claude-opus-5 855 611009 255
438 principal claude-opus-5 492 611864 241
439 principal claude-opus-5 6112 612356 426
440 principal claude-opus-5 3759 618468 1001
441 principal claude-opus-5 15366 622227 203
442 principal claude-opus-5 836 637593 109
443 principal claude-opus-5 713 638429 98
444 principal claude-opus-5 615 639142 1903
445 principal claude-opus-5 2413 639757 163
446 principal claude-opus-5 238 642170 992
447 principal claude-opus-5 1104 642408 201
448 principal claude-opus-5 282 643512 673
449 principal claude-opus-5 1530 643794 289
450 principal claude-opus-5 323 645324 178
451 principal claude-opus-5 5499 645647 152
452 principal claude-opus-5 186 651146 1044
453 principal claude-opus-5 1050 651332 113
454 principal claude-opus-5 182 652382 589
-->
<!-- /cout -->
