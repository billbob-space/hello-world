# 2026-08-22 — claude/estran-location-selection-fsizzf

Branche : `claude/estran-location-selection-fsizzf`
Périmètre : marcq-handball, fabrique
Mode : `chaud`

## Anomalies

### 1. Un test de bout en bout qui devient rouge en changeant de jour

**Symptome** — `bout-en-bout (marcq-handball)` echoue depuis le 2026-08-22 :
« Salut Lea » n'apparait jamais apres la saisie du prenom. Le contexte capture
par Playwright dit pourquoi — l'app affiche « Ton bilan », « du lundi 3 aout au
vendredi 21 aout ».

**Cause** — l'app fait exactement ce que son PRD demande : « §9 : passe
prog.fin, la racine mene au bilan » (`web/app.js`). Le programme courait jusqu'au
21 aout ; le 22, la racine mene au bilan, et le test suppose le programme en
cours. **L'app n'est pas cassee — le test l'est.** Il passait la veille, il
echoue tous les jours depuis, et rien dans son ecriture ne disait qu'il portait
une date.

Le remede existe deja dans le depot, applique ailleurs : les tests d'`estran`
appellent `RecupererA`, qui prend l'heure en PARAMETRE, « pour rester
reproductibles sans dependre de l'horloge du poste qui les execute ». Personne
ne l'avait porte au navigateur, ou l'horloge reste celle de la machine.

**Detecte par** — `CI`

**Action** — `garde-fou` — corrige en figeant l'horloge du navigateur. Le
principe manque au contrat plutot qu'a cette app : **un test qui lit l'heure sans
la figer est une bombe a retardement**, et rien ne le signale tant que la date
n'est pas passee.

### 2. Une app non touchee peut rester cassee sans que rien ne le dise

**Symptome** — ce rouge datait du matin meme et n'a ete vu que parce qu'une
branche touchant l'outillage partage a force la matrice complete. Sans elle, il
aurait attendu le prochain changement partage.

**Cause** — la CI ne lance la matrice que sur les apps MODIFIEES. C'est le bon
choix pour le cout, et il a un angle mort exact : une app que personne ne touche
n'est jamais rejouee. `main` reste vert pendant ce temps.

**Detecte par** — `CI`

**Action** — `garde-fou` — corrige dans cette branche, en
`.github/workflows/build.yml` (que `pret.sh` ne compte pas parmi les surfaces
partagees qu'il surveille — il regarde `memory/`, `.claude/`, `scripts/`,
`init.sh` et `CLAUDE.md`, pas le workflow). Tranche par l'utilisateur le
2026-08-22 : un passage complet **hebdomadaire**, toutes apps. Une app peut alors rester cassee jusqu'a
six jours, contre un temps non borne aujourd'hui, pour un septieme du cout d'un
passage quotidien.

### 3. La barre de progression annonce son role sans dire ce qu'elle mesure

**Symptome** — releve par l'artisan en figeant l'horloge : sur un jour PORTANT
une seance, `axe` leve `aria-progressbar-name`, gravite **serious**.
`web/barre.js` pose `role="progressbar"` sans nom accessible des que la barre
n'est pas muette, et `web/vue-jour.js` l'appelle ainsi sur l'ecran du jour.

**Cause** — un role ARIA sans nom laisse un lecteur d'ecran annoncer « barre de
progression » et rien d'autre. Le defaut existe depuis la creation de l'app.
S'il n'a jamais ete vu, c'est que la suite lisait l'horloge de la machine et
tombait, **par hasard**, sur des jours de repos ou la barre n'est pas montee.

**Detecte par** — `test`

**Action** — `rien` — corrige : `creerBarre` prend un `nom`, et l'ecran du jour
lui passe « Avancement des exercices de la seance : n sur total ».

**Ce qui a failli arriver, et qui est la vraie lecon** : le premier correctif
avait figé l'horloge sur un jour de REPOS, ce qui rendait la suite verte en
EVITANT le defaut. Un test qui passe parce qu'il ne rencontre pas le cas est un
test qui ment, et c'est la meme faute que desactiver un test pour reverdir. La
date figee porte donc une contrainte ecrite — un jour qui porte une seance, ni
le premier ni le dernier du programme — sans quoi le prochain qui la deplacera
rouvrira le trou sans le savoir.

### 4. Le meme defaut vivait sur deux ecrans que la mesure ne regardait pas

**Symptome** — releve par l'`esthete` apres la correction de l'ecran du jour :
`vue-seance.js` et `vue-perso.js` appellent la meme barre **sans nom**. Mesure :
`#/seance` porte `aria-progressbar-name` (serious) et trois `color-contrast`
(serious), `#/perso` un `aria-progressbar-name`. **Cinq constats serious en
ligne**, avec une CI verte.

**Cause** — `e2e` n'appelait `verifierAccessibilite` que sur trois ecrans sur
cinq. La mesure d'accessibilite bloque, elle ne se discute pas — mais elle ne
bloque que la ou on la lance. Un controle qui ne couvre qu'une partie de son
objet donne la meme confiance qu'un controle complet, et c'est ce qui le rend
plus dangereux qu'une absence de controle.

**Detecte par** — `relecture`

**Action** — `garde-fou` — les deux ecrans sont nommes ET la mesure les couvre
desormais. Le troisieme geste est le seul qui compte dans le temps : sans lui,
les deux premiers redeviennent invisibles au prochain changement.

### 5. Un contraste casse par une DOUBLE attenuation, pas par une couleur mal choisie

**Symptome** — trois constats `color-contrast` sur `#/seance` :
`.exercice.fait .chrono` tombait a 2,56:1.

**Cause** — la couleur etait bonne (7,4:1 sur blanc) ; une regle
`opacity: .55` posee par-dessus la ramenait sous le seuil. Chercher la faute
dans la palette n'aurait rien donne.

**Detecte par** — `relecture`

**Action** — `rien` — l'opacite est retiree plutot que reglee : une valeur
d'opacite choisie juste au-dessus du seuil serait restee fragile au premier
changement de teinte. `.exercice.fait .video-exercice` portait le meme calcul et
n'etait pas mesure — aucun exercice coche du jour de test ne porte de lien video
— donc corrige par coherence, sinon le trou se serait deplace sur un autre jour.

### 6. Un libelle invente faute de PRD

**Symptome** — la barre de `#/perso` mesure le PROGRAMME entier, pas une seance.
L'artisan l'a donc nommee « Avancement des exercices du programme », distincte de
celle de la seance, pour ne pas dire une fausse chose a la voix.

**Cause** — rien dans le PRD ne fixe ces libelles. Le choix est juste, et il
reste un choix fait par un agent a la place de l'utilisateur.

**Detecte par** — `auteur`

**Action** — `arbitrage` — a confirmer par l'utilisateur ; ecrit ici plutot que
tu, pour qu'il ne reste pas un mot pose par defaut que plus personne n'interroge.

### 7. La fiche produit a decrit du code qui n'existait pas encore

**Symptome** — releve par le `relecteur`. J'avais ecrit dans `PRODUCT.md`
« **Ce qui existe maintenant** : l'ecran du jour dit en toutes lettres... »
alors que l'artisan etait encore en train de le construire : `vue-jour.js`
n'avait que deux etats, aucun « Revoir » n'existait, et le total restait ecrit
deux fois.

**Cause** — j'ai ecrit la section produit AU MOMENT de la decision de
l'utilisateur, et non au moment de la livraison. L'intention etait bonne — la
decision est reelle, tranchee sur maquettes — mais un PRD qui dit « maintenant »
d'un code absent ment des la fusion, et rien ne distingue a la lecture une
decision prise d'une decision prise ET livree.

**Detecte par** — `relecture`

**Action** — `comportement` — la section produit s'ecrit quand le code existe, et
part dans LE MEME commit que lui. Le contrat le disait deja (« dans le meme
commit que le code ») ; ce que cette anomalie ajoute, c'est qu'ecrire d'avance
dans l'arbre de travail suffit a creer le mensonge, meme sans committer.

### 8. Mes deux sections de PRD etaient placees hors de la section qui les accueille

**Symptome** — releve par le `relecteur` : ecrites en `###`, elles atterrissaient
APRES « 16. Ajoute apres les PRP » au lieu d'etre dedans, ou les neuf
precedentes sont en `####`.

**Cause** — je n'ai pas regarde le niveau de titre des sections voisines avant
d'ecrire.

**Detecte par** — `relecture`

**Action** — `rien` — renumerotees `16.10` et `16.11`.

### 9. Le garde-fou de contexte a bloque un commit deja verifie

**Symptome** — `pret.sh` a refuse l'etape : « contexte de 643 821 jetons — au-dela
du critique ». Le seuil est 600 000 (`COUT_CONTEXTE_CRITIQUE`, `scripts/cout.sh`).
Le travail etait pourtant **fini et vert** — tests 339/339, e2e 5/5 aujourd'hui et
sous une horloge de novembre, revue outillee verte, critique UX rendue — et
simplement pas encore enregistre.

**Cause** — le garde-fou vise a empecher de CONTINUER a travailler dans une
session saturee. Il attrape aussi le dernier geste d'une session qui, elle, a
fini : son message dit « rouvre une session sur la MEME branche, qui reprend par
le depot », alors que precisement le travail n'y est pas encore. La session neuve
ne trouverait rien a reprendre.

**Detecte par** — `auteur`

**Action** — `arbitrage` — pose a l'utilisateur, qui a tranche : enregistrer,
puis couper. Le contournement est assume et ecrit ici plutot que tu, parce qu'un
garde-fou contourne en silence est pire qu'un garde-fou absent — il donne
l'illusion qu'il tient.

**Ce qu'il faudrait changer, et qui n'est pas fait ici** : le refus devrait
porter sur l'ouverture d'un CHANTIER, pas sur l'enregistrement de ce qui est
deja verifie. Un `pret.sh` qui laisse passer un arbre vert tout en refusant la
suite dirait la meme chose sans pousser a le contourner. A porter par une branche
`fabrique/` — pas par celle-ci, dont le perimetre est deja large et le contexte
justement sature.

**Et la mesure elle-meme est juste** : cette session a fait bien plus que ce
qu'une branche devrait porter. Elle est partie d'un test rouge et a livre six
corrections d'accessibilite, deux decisions d'ecran, un filet hebdomadaire et
trois regles de contrat. C'est le garde-fou qui avait raison sur le fond ; c'est
son POINT D'APPLICATION qui est mal choisi.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 09:40 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 3 119 | 0,01 $ |
| Écriture de cache | 5 744 596 | 30,80 $ |
| Lecture de cache | 260 109 786 | 111,84 $ |
| Sortie | 362 160 | 9,00 $ |
| **Total** | **266 219 661** | **151,65 $ — 131,70 €** |

**Ce qui coûte**

- **1410 appel(s) au modèle** — un par réponse, outils compris —, dont 971 par des sous-agents — 113 903 911 jetons, 48,87 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 892 jetons, écrits une fois par session puis relus à chaque
  échange : 30 174 696 jetons de relecture, 11 % de tout ce qui a été relu.
- **Tours courts** — 1 167 des 1 410 tours (82 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 91,22 $, soit 60 % de la facture.
  Dont 971 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 27, dont la plus longue fait 109 tours,
  relit 180 153 jetons par tour en moyenne et coûte 6,88 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
  **Au-delà de 60 tours, découpe le chantier.**
- **Croissance** — 68 892 jetons relus au premier appel qui relise
  quelque chose, 109 792 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 266219661 -->
<!-- cout-agent-max: 109 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68892 0 158
2 principal claude-opus-5 3273 68892 317
3 principal claude-opus-5 2922 72165 272
4 principal claude-opus-5 11410 75087 671
5 principal claude-opus-5 12140 86497 1216
6 principal claude-opus-5 8426 98637 454
7 principal claude-opus-5 1107 107063 936
8 principal claude-opus-5 1860 108170 306
9 principal claude-opus-5 1426 110030 260
10 principal claude-opus-5 3439 111456 372
11 principal claude-opus-5 1126 114895 194
12 principal claude-opus-5 367 116021 280
13 principal claude-opus-5 488 116388 445
14 principal claude-opus-5 544 116876 190
15 principal claude-opus-5 1713 117420 584
16 principal claude-opus-5 793 119133 987
17 principal claude-opus-5 1352 119926 138
18 principal claude-opus-5 331 121278 145
19 principal claude-opus-5 1259 121609 784
20 principal claude-opus-5 1099 122868 900
21 principal claude-opus-5 1296 123967 125
22 principal claude-opus-5 3888 125263 855
23 principal claude-opus-5 5260 129151 2034
24 principal claude-opus-5 2293 134411 16153
25 principal claude-opus-5 16268 136704 194
26 principal claude-opus-5 582 152972 1634
27 principal claude-opus-5 8278 153554 1579
28 principal claude-opus-5 1942 161832 356
29 principal claude-opus-5 1328 163774 779
30 principal claude-opus-5 1000 165102 5721
31 principal claude-opus-5 5811 166102 4642
32 principal claude-opus-5 4726 171913 1079
33 principal claude-opus-5 6856 176557 999
34 principal claude-opus-5 1389 183413 1252
35 principal claude-opus-5 1370 184802 784
36 principal claude-opus-5 3383 186172 1931
37 principal claude-opus-5 2484 189555 14704
38 principal claude-opus-5 15959 192039 386
39 principal claude-opus-5 5041 207998 220
40 principal claude-opus-5 612 213039 980
41 principal claude-opus-5 1252 213651 611
42 principal claude-opus-5 766 214903 386
43 principal claude-opus-5 3590 214903 378
44 principal claude-opus-5 423 218493 194
45 principal claude-opus-5 411 218916 350
46 principal claude-opus-5 869 219327 1289
47 principal claude-opus-5 2467 220196 2409
48 principal claude-opus-5 2797 222663 483
49 principal claude-opus-5 3420 225460 148
50 principal claude-opus-5 288 228880 52
51 principal claude-opus-5 324 229168 178
52 principal claude-opus-5 539 229492 565
53 principal claude-opus-5 1943 229492 368
54 principal claude-opus-5 613 231435 97
55 principal claude-opus-5 948 232048 635
56 principal claude-opus-5 1765 232996 147
57 principal claude-opus-5 2160 234761 1256
58 principal claude-opus-5 1948 236921 3278
59 principal claude-opus-5 3669 238869 522
60 principal claude-opus-5 661 242538 121
61 principal claude-opus-5 466 243199 2692
62 principal claude-opus-5 2898 243665 1151
63 principal claude-opus-5 1310 246563 322
64 principal claude-opus-5 594 247873 188
65 principal claude-opus-5 2531 248467 298
66 principal claude-opus-5 483 250998 1308
67 principal claude-opus-5 1775 251481 1283
68 principal claude-opus-5 1481 253256 2910
69 principal claude-opus-5 3435 254737 283
70 principal claude-opus-5 373 258172 1202
71 principal claude-opus-4-7 85530 0 9274
72 principal claude-opus-4-7 9484 85530 257
73 principal claude-opus-5 1729 258545 279
74 principal claude-opus-5 60 260553 389
75 principal claude-opus-5 1321 261002 456
76 principal claude-opus-5 581 262323 944
77 principal claude-opus-5 1484 262904 224
78 principal claude-opus-5 976 264388 2716
79 principal claude-opus-4-7 22282 29208 116
80 principal claude-opus-4-7 231 51490 73
81 principal claude-opus-4-7 3291 51721 84
82 principal claude-opus-5 2906 265364 719
83 principal claude-opus-5 1238 268270 934
84 principal claude-opus-4-7 23815 55012 3133
85 principal claude-opus-4-7 3306 78827 129
86 principal claude-opus-4-7 6378 82133 1709
87 principal claude-opus-4-7 7471 88511 5002
88 principal claude-opus-4-7 5076 95982 69
89 principal claude-opus-5 1328 269508 96
90 principal claude-opus-5 599 270836 204
91 principal claude-opus-5 832 271435 740
92 principal claude-opus-5 837 272267 563
93 principal claude-opus-5 1724 273667 486
94 principal claude-opus-5 581 275391 280
95 principal claude-opus-5 1606 276252 642
96 principal claude-opus-5 1099 277858 131
97 principal claude-opus-5 2294 278957 471
98 principal claude-opus-5 1690 281251 5325
99 principal claude-opus-5 5672 282941 2091
100 principal claude-opus-5 2487 288613 254
101 principal claude-opus-5 717 291100 204
102 principal claude-opus-5 3142 291354 474
103 principal claude-opus-5 744 294496 2168
104 principal claude-opus-5 2553 295240 1193
105 principal claude-opus-5 1400 297793 259
106 principal claude-opus-5 908 299193 184
107 principal claude-opus-5 1144 300101 244
108 principal claude-opus-5 487 301245 2197
109 principal claude-opus-4-7 17150 29208 137
110 principal claude-opus-4-7 252 46358 111
111 principal claude-opus-4-7 201 46610 77
112 principal claude-opus-4-7 138 46811 84
113 principal claude-opus-4-7 23888 46949 231
114 principal claude-opus-5 2381 301732 358
115 principal claude-opus-4-7 9500 70837 1048
116 principal claude-opus-5 858 304113 128
117 principal claude-opus-5 2588 304971 329
118 principal claude-opus-4-7 4528 80337 1249
119 principal claude-opus-4-7 5673 84865 655
120 principal claude-opus-5 1536 307559 2316
121 principal claude-opus-5 2381 309095 124
122 principal claude-opus-4-7 1711 90538 1938
123 principal claude-opus-5 229 311476 291
124 principal claude-opus-5 357 311705 336
125 principal claude-opus-5 543 312062 576
126 principal claude-opus-5 793 312605 272
127 principal claude-opus-5 344 313398 502
128 principal claude-opus-5 757 313742 240
129 principal claude-opus-5 1163 314499 137
130 principal claude-opus-5 1585 315662 597
131 principal claude-opus-5 1471 317247 133
132 principal claude-opus-5 198 318718 137
133 principal claude-opus-5 253 318916 445
134 principal claude-opus-5 523 319169 137
135 principal claude-opus-5 2724 319692 542
136 principal claude-opus-5 680 322416 35
137 principal claude-opus-5 385 323096 30
138 principal claude-opus-5 2036 323481 190
139 principal claude-opus-5 1584 325517 160
140 principal claude-opus-5 637 327101 30
141 principal claude-opus-5 686 327738 154
142 principal claude-opus-5 236 328424 405
143 principal claude-opus-5 545 328660 37
144 principal claude-opus-5 386 329205 30
145 principal claude-opus-5 628 329591 158
146 principal claude-opus-5 1299 330219 199
147 principal claude-opus-5 740 331518 264
148 principal claude-opus-5 474 332258 254
149 principal claude-opus-5 377 332732 185
150 principal claude-opus-5 382 333294 357
151 principal claude-opus-5 577 333676 94
152 principal claude-opus-5 515 334253 510
153 principal claude-opus-5 654 334768 46
154 principal claude-opus-5 435 335422 178
155 principal claude-opus-5 668 335857 425
156 principal claude-opus-5 741 336525 1273
157 principal claude-opus-5 1743 337266 1511
158 principal claude-opus-5 1893 339009 182
159 principal claude-opus-5 248 340902 60
160 principal claude-opus-5 287656 49342 2572
161 principal claude-opus-5 2679 336998 747
162 principal claude-opus-5 863 339677 1835
163 principal claude-opus-5 2048 340540 2388
164 principal claude-opus-5 33 344976 1782
165 principal claude-opus-5 2214 345009 560
166 principal claude-opus-5 1898 347223 617
167 principal claude-opus-5 1234 349121 93
168 principal claude-opus-5 1777 350355 2884
169 principal claude-opus-5 2966 352132 311
170 principal claude-opus-5 527 355098 171
171 principal claude-opus-5 780 355625 94
172 principal claude-opus-5 2016 356405 781
173 principal claude-opus-5 4028 358421 377
174 principal claude-opus-5 2899 362449 2876
175 principal claude-opus-5 2916 365348 219
176 principal claude-opus-5 798 368264 844
177 principal claude-opus-5 966 369062 2158
178 principal claude-opus-5 2201 370028 124
179 principal claude-opus-5 764 372229 295
180 principal claude-opus-5 642 372993 1083
181 principal claude-opus-5 1242 373635 3405
182 principal claude-opus-5 3600 374877 336
183 principal claude-opus-5 574 378477 745
184 principal claude-opus-5 1022 379051 356
185 principal claude-opus-5 1609 380073 91
186 principal claude-opus-5 1479 381682 216
187 principal claude-opus-5 1866 383161 215
188 principal claude-opus-5 1073 385027 521
189 principal claude-opus-5 1756 386100 2904
190 principal claude-opus-5 3218 387856 628
191 principal claude-opus-5 1017 391074 487
192 principal claude-opus-5 631 392091 146
193 principal claude-opus-5 968 392722 442
194 principal claude-opus-5 1719 393690 359
195 principal claude-opus-5 850 395409 459
196 principal claude-opus-5 1568 396259 357
197 principal claude-opus-5 596 397827 1549
198 principal claude-opus-5 1672 398423 157
199 principal claude-opus-5 430 400095 1418
200 principal claude-opus-5 1664 400525 2009
201 principal claude-opus-5 2162 402189 113
202 principal claude-opus-5 776 404351 885
203 principal claude-opus-5 1064 405127 779
204 principal claude-opus-5 916 406191 371
205 principal claude-opus-5 466 407107 1566
206 principal claude-opus-5 1784 407573 873
207 principal claude-opus-5 1085 409357 144
208 principal claude-opus-5 471 410442 1192
209 principal claude-opus-5 1300 410913 647
210 principal claude-opus-5 799 412213 1732
211 principal claude-opus-5 2050 413012 908
212 principal claude-opus-5 1025 415062 197
213 principal claude-opus-5 577 416087 270
214 principal claude-opus-5 414 416664 139
215 principal claude-opus-5 226 417078 244
216 principal claude-opus-5 861 417304 1077
217 principal claude-opus-5 1119 418165 250
218 principal claude-opus-5 307 419284 2381
219 principal claude-opus-5 2418 419591 339
220 principal claude-opus-5 731 422009 156
221 principal claude-opus-5 195 422740 37
222 principal claude-opus-5 309 422935 235
223 principal claude-opus-5 753 423244 420
224 principal claude-opus-5 690 423997 53
225 principal claude-opus-5 9731 423244 177
226 principal claude-opus-5 570 432975 692
227 principal claude-opus-5 748 433545 236
228 principal claude-opus-5 762 434293 1076
229 principal claude-opus-5 1151 435055 2591
230 principal claude-opus-4-7 16297 29208 101
231 principal claude-opus-4-7 184 45505 93
232 principal claude-opus-4-7 280 45689 81
233 principal claude-opus-4-7 5230 45969 81
234 principal claude-opus-4-7 10477 51199 82
235 principal claude-opus-4-7 6946 61676 82
236 principal claude-opus-4-7 15298 68622 82
237 principal claude-opus-5 2786 436206 192
238 principal claude-opus-4-7 2099 83920 80
239 principal claude-opus-4-7 12868 86019 80
240 principal claude-opus-4-7 7930 98887 128
241 principal claude-opus-5 293 438992 716
242 principal claude-opus-5 1235 439285 490
243 principal claude-opus-4-7 1485 106817 2245
244 principal claude-opus-4-7 5349 108302 125
245 principal claude-opus-4-7 969 113651 4807
246 principal claude-opus-5 3186 441010 1586
247 principal claude-opus-5 1881 444196 1648
248 principal claude-opus-5 1787 446077 97
249 principal claude-opus-5 1549 447864 2875
250 principal claude-opus-5 2930 449413 1387
251 principal claude-opus-5 1449 452343 132
252 principal claude-opus-5 412 453792 681
253 principal claude-opus-5 825 454204 443
254 principal claude-opus-5 1029 455029 180
255 principal claude-opus-5 849 456058 2712
256 principal claude-opus-5 2835 456907 1668
257 principal claude-opus-5 1763 459742 1590
258 principal claude-opus-5 1627 461505 928
259 principal claude-opus-5 1180 463132 295
260 principal claude-opus-5 660 464312 1166
261 principal claude-opus-5 1276 464972 555
262 principal claude-opus-5 697 466248 2107
263 principal claude-opus-5 2140 466945 43
264 principal claude-opus-5 315 469085 228
265 principal claude-opus-5 260 469400 588
266 principal claude-opus-5 842 469660 187
267 principal claude-opus-5 251 470502 563
268 principal claude-opus-5 1099 470753 360
269 principal claude-opus-5 814 471852 2447
270 principal claude-opus-4-7 11720 29208 114
271 principal claude-opus-4-7 226 40928 81
272 principal claude-opus-4-7 10997 41154 82
273 principal claude-opus-4-7 7125 52151 84
274 principal claude-opus-5 2634 472666 2373
275 principal claude-opus-5 2438 475300 124
276 principal claude-opus-5 229 477738 543
277 principal claude-opus-5 429765 49342 30
278 principal claude-opus-4-7 22939 59276 4942
279 principal claude-opus-5 1307 479107 160
280 principal claude-opus-4-7 21097 82215 234
281 principal claude-opus-5 1765 480414 290
282 principal claude-opus-5 430 482179 57
283 principal claude-opus-5 535 482609 30
284 principal claude-opus-5 1392 483144 235
285 principal claude-opus-4-7 2453 103312 2708
286 principal claude-opus-5 724 484536 160
287 principal claude-opus-5 2230 485260 1703
288 principal claude-opus-5 1809 487490 1636
289 principal claude-opus-5 1905 489299 980
290 principal claude-opus-5 1252 491204 973
291 principal claude-opus-5 1025 492456 179
292 principal claude-opus-5 257 493481 430
293 principal claude-opus-5 1201 493738 1134
294 principal claude-opus-4-7 4278 29208 111
295 principal claude-opus-4-7 11569 33486 1219
296 principal claude-opus-5 1324 494939 210
297 principal claude-opus-5 560 496263 30
298 principal claude-opus-5 1054 496823 508
299 principal claude-opus-4-7 1900 45055 1753
300 principal claude-opus-5 2031 497877 634
301 principal claude-opus-4-7 3600 46955 1318
302 principal claude-opus-5 1661 499908 288
303 principal claude-opus-5 428 501569 105
304 principal claude-opus-5 349 502102 30
305 principal claude-opus-5 714 502451 554
306 principal claude-opus-5 632 503165 306
307 principal claude-opus-5 1201 503797 679
308 principal claude-opus-5 814 504998 202
309 principal claude-opus-5 7134 505812 607
310 principal claude-opus-5 6257 512946 495
311 principal claude-opus-5 744 519203 1352
312 principal claude-opus-5 1411 519947 132
313 principal claude-opus-5 2971 521358 1311
314 principal claude-opus-5 1512 524329 388
315 principal claude-opus-5 595 525841 476
316 principal claude-opus-5 986 526436 160
317 principal claude-opus-5 7712 527422 1164
318 principal <synthetic> 0 0 0
319 principal claude-opus-5 537007 0 30
320 principal claude-opus-5 767 537007 498
321 principal claude-opus-5 577 537774 111
322 principal claude-opus-5 253 538351 1066
323 principal claude-opus-5 1354 538604 931
324 principal claude-opus-5 3888 539958 266
325 principal claude-opus-5 358 543846 133
326 principal claude-opus-5 198 544204 137
327 principal claude-opus-5 253 544402 305
328 principal claude-opus-5 443 544655 61
329 principal claude-opus-5 410 545098 30
330 principal claude-opus-5 752 545508 202
331 principal claude-opus-5 255 546260 137
332 principal claude-opus-5 378 546515 670
333 principal claude-opus-5 1505 546893 640
334 principal claude-opus-5 1293 548398 177
335 principal claude-opus-5 580 549691 555
336 principal claude-opus-5 1237 550271 366
337 principal claude-opus-5 774 551508 848
338 principal claude-opus-5 1167 552282 755
339 principal claude-opus-5 996 553449 380
340 principal claude-opus-5 729 554445 30
341 principal claude-opus-5 701 555174 242
342 principal claude-opus-5 384 555875 51
343 principal claude-opus-5 386 556310 137
344 principal claude-opus-5 221 556696 547
345 principal claude-opus-5 820 556917 606
346 principal claude-opus-5 1065 557737 1501
347 principal claude-opus-5 1757 558802 103
348 principal claude-opus-5 222 560559 1372
349 principal claude-opus-5 1469 560781 1145
350 principal claude-opus-5 1873 562250 162
351 principal claude-opus-5 711 564123 146
352 principal claude-opus-5 1101 564834 497
353 principal claude-opus-5 1392 565935 95
354 principal claude-opus-5 553 567327 2241
355 principal claude-opus-5 2441 567880 144
356 principal claude-opus-5 283 570321 52
357 principal claude-opus-5 324 570604 405
358 principal claude-opus-5 1225 570928 30
359 principal claude-opus-5 629 572153 520
360 principal claude-opus-5 662 572782 178
361 principal claude-opus-5 450 573444 341
362 principal claude-opus-5 1572 573894 723
363 principal claude-opus-5 1100 575466 1235
364 principal claude-opus-5 1757 576566 171
365 principal claude-opus-5 5977 573894 208
366 principal claude-opus-5 809 579871 921
367 principal claude-opus-5 1163 580680 94
368 principal claude-opus-5 392 581843 1546
369 principal claude-opus-5 1598 582235 795
370 principal claude-opus-5 1186 583833 186
371 principal claude-opus-5 458 585019 234
372 principal claude-opus-5 2145 585477 1551
373 principal claude-opus-5 1939 587622 370
374 principal claude-opus-5 642 589561 142
375 principal claude-opus-5 1789 590203 255
376 principal claude-opus-5 574 591992 1243
377 principal claude-opus-5 1358 592566 2152
378 principal claude-opus-4-7 10450 29208 291
379 principal claude-opus-4-7 406 39658 84
380 principal claude-opus-4-7 22965 40064 283
381 principal claude-opus-4-7 2563 63029 805
382 principal claude-opus-5 2353 593924 969
383 principal claude-opus-4-7 1650 65592 2018
384 principal claude-opus-5 1488 596277 1419
385 principal claude-opus-5 1764 597765 1587
386 principal claude-opus-5 1984 599529 138
387 principal claude-opus-5 294 601513 1411
388 principal claude-opus-5 1444 601807 52
389 principal claude-opus-5 324 603251 180
390 principal claude-opus-5 3669 603575 1425
391 principal claude-opus-5 2580 607244 1387
392 principal claude-opus-5 1442 609824 218
393 principal claude-opus-5 563 611266 1104
394 principal claude-opus-5 1293 611829 451
395 principal claude-opus-5 723 613122 309
396 principal claude-opus-5 2210 613845 1471
397 principal claude-opus-5 1870 616055 212
398 principal claude-opus-5 484 617925 88
399 principal claude-opus-5 1708 618409 253
400 principal claude-opus-5 572 620117 881
401 principal claude-opus-5 1274 620689 60
402 principal claude-opus-5 332 621963 114
403 principal claude-opus-5 1872 622295 1655
404 principal claude-opus-5 630568 0 1856
405 principal claude-opus-5 2247 630568 293
406 principal claude-opus-5 565 632815 88
407 principal claude-opus-5 335 633380 301
408 principal claude-opus-5 9820 633380 268
409 principal claude-opus-5 621 643200 1810
410 principal claude-opus-5 1872 643821 96
411 principal claude-opus-5 492 645693 1486
412 principal claude-opus-5 1541 646185 690
413 principal claude-opus-5 878 647726 2839
414 principal claude-opus-5 2903 648604 142
415 principal claude-opus-4-7 44520 0 1080
416 principal claude-opus-4-7 1166 44520 93
417 principal claude-opus-4-7 280 45686 89
418 principal claude-opus-4-7 2657 45966 92
419 principal claude-opus-5 306 651507 2484
420 principal claude-opus-4-7 4976 48623 90
421 principal claude-opus-4-7 5069 53599 159
422 principal claude-opus-4-7 2518 58668 169
423 principal claude-opus-5 2677 651813 541
424 principal claude-opus-4-7 1506 61186 1611
425 principal claude-opus-4-7 1685 62692 69
426 principal claude-opus-5 26708 49342 43
427 principal claude-opus-5 1324 76050 234
428 principal claude-opus-5 2119 77374 160
429 principal claude-opus-5 6605 79493 444
430 principal claude-opus-5 665 86098 268
431 principal claude-opus-5 716 86763 810
432 principal claude-opus-5 8471 87479 261
433 principal claude-opus-5 2833 95950 446
434 principal claude-opus-5 1881 98783 564
435 principal claude-opus-5 3151 100664 846
436 principal claude-opus-5 3828 103815 1540
437 principal claude-opus-5 1909 107643 189
438 principal claude-opus-5 240 109552 210
439 principal claude-opus-5 778 109792 1283
440 agent claude-sonnet-5 18575 0 4
441 agent claude-sonnet-5 2325 18575 5
442 agent claude-sonnet-5 2866 20900 20
443 agent claude-sonnet-5 6095 23766 2
444 agent claude-sonnet-5 2741 29861 0
445 agent claude-sonnet-5 2349 32602 6
446 agent claude-sonnet-5 22587 34951 3
447 agent claude-sonnet-5 2733 57538 20
448 agent claude-sonnet-5 5835 60271 8
449 agent claude-sonnet-5 3882 66106 2
450 agent claude-sonnet-5 1143 69988 2
451 agent claude-sonnet-5 5984 71131 3
452 agent claude-sonnet-5 6853 77115 14
453 agent claude-sonnet-5 921 83968 2
454 agent claude-sonnet-5 284 84889 3
455 agent claude-sonnet-5 2745 85173 3
456 agent claude-sonnet-5 2646 87918 20
457 agent claude-sonnet-5 1694 90564 3
458 agent claude-sonnet-5 2511 92258 2
459 agent claude-sonnet-5 5303 94769 5
460 agent claude-sonnet-5 3766 100072 3
461 agent claude-sonnet-5 1036 103838 3
462 agent claude-sonnet-5 1346 104874 2
463 agent claude-sonnet-5 352 106220 20
464 agent claude-sonnet-5 1292 106572 2
465 agent claude-sonnet-5 3636 107864 2
466 agent claude-sonnet-5 817 111500 2
467 agent claude-sonnet-5 349 112317 8
468 agent claude-sonnet-5 616 112666 20
469 agent claude-sonnet-5 3867 113282 5
470 agent claude-sonnet-5 2141 117149 4
471 agent claude-sonnet-5 1478 119290 1
472 agent claude-sonnet-5 194 120768 1
473 agent claude-sonnet-5 360 120962 1
474 agent claude-sonnet-5 550 121322 1
475 agent claude-sonnet-5 429 121872 4
476 agent claude-sonnet-5 631 122301 4
477 agent claude-sonnet-5 2540 122932 3
478 agent claude-sonnet-5 341 125472 20
479 agent claude-sonnet-5 1543 125813 3
480 agent claude-sonnet-5 665 127356 4
481 agent claude-sonnet-5 807 128021 20
482 agent claude-sonnet-5 644 128828 3
483 agent claude-sonnet-5 1636 129472 3
484 agent claude-sonnet-5 2369 131108 3
485 agent claude-sonnet-5 1158 133477 2
486 agent claude-sonnet-5 182 134635 20
487 agent claude-sonnet-5 182 134817 20
488 agent claude-sonnet-5 121 134999 20
489 agent claude-sonnet-5 141 135120 6
490 agent claude-sonnet-5 207 135261 2
491 agent claude-sonnet-5 250 135468 2
492 agent claude-sonnet-5 1368 135718 3
493 agent claude-sonnet-5 683 137086 2
494 agent claude-sonnet-5 821 137769 3
495 agent claude-sonnet-5 248 138590 1
496 agent claude-sonnet-5 18843 0 5
497 agent claude-sonnet-5 8312 18843 4
498 agent claude-sonnet-5 2471 27155 20
499 agent claude-sonnet-5 1015 29626 20
500 agent claude-sonnet-5 8440 30641 3
501 agent claude-sonnet-5 28706 39081 5
502 agent claude-sonnet-5 2700 67787 4
503 agent claude-sonnet-5 10380 70487 3
504 agent claude-sonnet-5 1315 80867 20
505 agent claude-sonnet-5 162 82182 20
506 agent claude-sonnet-5 10263 82344 8
507 agent claude-sonnet-5 449 92607 3
508 agent claude-sonnet-5 4505 93056 3
509 agent claude-sonnet-5 2159 97561 2
510 agent claude-sonnet-5 7208 99720 9
511 agent claude-sonnet-5 352 106928 17
512 agent claude-sonnet-5 1032 107280 3
513 agent claude-sonnet-5 2146 108312 3
514 agent claude-sonnet-5 1507 110458 14
515 agent claude-sonnet-5 377 111965 16
516 agent claude-sonnet-5 348 112342 17
517 agent claude-sonnet-5 993 112690 2
518 agent claude-sonnet-5 1561 113683 3
519 agent claude-sonnet-5 681 115244 2
520 agent claude-sonnet-5 714 115925 3
521 agent claude-sonnet-5 538 116639 2
522 agent claude-sonnet-5 421 117177 9
523 agent claude-sonnet-5 4988 117598 1
524 agent claude-sonnet-5 3530 122586 3
525 agent claude-sonnet-5 606 126116 3
526 agent claude-sonnet-5 800 126722 20
527 agent claude-sonnet-5 358 127522 6
528 agent claude-sonnet-5 1133 127880 5
529 agent claude-sonnet-5 653 129013 5
530 agent claude-sonnet-5 1644 129666 1
531 agent claude-sonnet-5 709 131310 1
532 agent claude-sonnet-5 521 132019 119
533 agent claude-sonnet-5 269 132540 20
534 agent claude-sonnet-5 502 132809 1
535 agent claude-sonnet-5 418 133311 8
536 agent claude-sonnet-5 284 133729 20
537 agent claude-sonnet-5 306 134013 3
538 agent claude-sonnet-5 521 134319 5
539 agent claude-sonnet-5 627 134840 5
540 agent claude-sonnet-5 364 135467 17
541 agent claude-sonnet-5 910 135831 2
542 agent claude-sonnet-5 1815 136741 3
543 agent claude-sonnet-5 1181 138556 5
544 agent claude-sonnet-5 212 139737 5
545 agent claude-sonnet-5 1807 139949 2
546 agent claude-sonnet-5 440 141756 6
547 agent claude-sonnet-5 959 142196 2
548 agent claude-sonnet-5 759 143155 2
549 agent claude-sonnet-5 1559 143914 2
550 agent claude-sonnet-5 329 145473 2
551 agent claude-opus-5 12440 0 7
552 agent claude-opus-5 2031 12440 17
553 agent claude-opus-5 3512 14471 3
554 agent claude-opus-5 15715 17983 8
555 agent claude-opus-5 17113 33698 3
556 agent claude-opus-5 5662 50811 3
557 agent claude-opus-5 3761 56473 9
558 agent claude-opus-5 1859 60234 3
559 agent claude-opus-5 2713 62093 2
560 agent claude-opus-5 1433 64806 2
561 agent claude-opus-5 621 66239 7
562 agent claude-opus-5 2843 66860 3
563 agent claude-opus-5 3585 69703 3
564 agent claude-opus-5 5028 73288 3
565 agent claude-opus-5 1445 78316 17
566 agent claude-opus-5 1555 79761 2
567 agent claude-opus-5 2551 81316 3
568 agent claude-opus-5 1148 83867 3
569 agent claude-opus-5 246 85015 4
570 agent claude-opus-5 2154 85261 3
571 agent claude-opus-5 1208 87415 3
572 agent claude-opus-5 699 88623 3
573 agent claude-opus-5 868 89322 3
574 agent claude-opus-5 631 90190 3
575 agent claude-opus-5 690 90821 2
576 agent claude-opus-5 3920 91511 3
577 agent claude-opus-5 1838 95431 17
578 agent claude-opus-5 1712 97269 2
579 agent claude-opus-5 2963 98981 3
580 agent claude-opus-5 941 101944 3
581 agent claude-opus-5 504 102885 4
582 agent claude-opus-5 2034 103389 3
583 agent claude-opus-5 1321 105423 3
584 agent claude-opus-5 1532 106744 3
585 agent claude-opus-5 2145 108276 2
586 agent claude-opus-5 602 110421 4
587 agent claude-opus-5 283 111023 17
588 agent claude-opus-5 322 111306 20
589 agent claude-opus-5 254 111628 20
590 agent claude-opus-5 776 111882 2
591 agent claude-opus-5 641 112658 17
592 agent claude-opus-5 168 113299 20
593 agent claude-opus-5 247 113467 16
594 agent claude-opus-5 298 113714 3
595 agent claude-opus-5 2183 114012 2
596 agent claude-opus-5 2734 116195 1
597 agent claude-sonnet-5 18124 0 5
598 agent claude-sonnet-5 8253 18124 4
599 agent claude-sonnet-5 765 26377 3
600 agent claude-sonnet-5 23210 27142 4
601 agent claude-sonnet-5 18601 50352 4
602 agent claude-sonnet-5 6686 68953 9
603 agent claude-haiku-4-5-20251001 13211 0 1
604 agent claude-haiku-4-5-20251001 2153 13211 2
605 agent claude-haiku-4-5-20251001 487 15364 2
606 agent claude-haiku-4-5-20251001 3859 15851 3
607 agent claude-haiku-4-5-20251001 430 19710 4
608 agent claude-sonnet-5 18636 0 3
609 agent claude-sonnet-5 2325 18636 3
610 agent claude-sonnet-5 6480 20961 4
611 agent claude-sonnet-5 5117 27441 2
612 agent claude-sonnet-5 13455 32558 6
613 agent claude-sonnet-5 3171 46013 3
614 agent claude-sonnet-5 846 49184 2
615 agent claude-sonnet-5 518 50030 2
616 agent claude-sonnet-5 993 50548 2
617 agent claude-sonnet-5 611 51541 2
618 agent claude-sonnet-5 25638 52152 4
619 agent claude-sonnet-5 517 77790 20
620 agent claude-sonnet-5 4952 78307 7
621 agent claude-sonnet-5 259 83259 20
622 agent claude-sonnet-5 253 83518 3
623 agent claude-sonnet-5 278 83771 2
624 agent claude-sonnet-5 824 84049 20
625 agent claude-sonnet-5 471 84873 6
626 agent claude-sonnet-5 475 85344 20
627 agent claude-sonnet-5 202 85819 2
628 agent claude-sonnet-5 1171 86021 7
629 agent claude-sonnet-5 644 87192 2
630 agent claude-sonnet-5 782 87836 5
631 agent claude-sonnet-5 830 88618 3
632 agent claude-sonnet-5 1045 89448 14
633 agent claude-sonnet-5 1184 90493 3
634 agent claude-sonnet-5 379 91677 20
635 agent claude-sonnet-5 920 92056 4
636 agent claude-sonnet-5 1095 92976 3
637 agent claude-sonnet-5 226 94071 20
638 agent claude-sonnet-5 962 94297 2
639 agent claude-sonnet-5 1585 95259 3
640 agent claude-sonnet-5 1929 96844 3
641 agent claude-sonnet-5 4922 98773 5
642 agent claude-sonnet-5 1314 103695 3
643 agent claude-sonnet-5 1423 105009 3
644 agent claude-sonnet-5 6988 106432 3
645 agent claude-sonnet-5 1281 113420 2
646 agent claude-sonnet-5 1106 114701 8
647 agent claude-sonnet-5 2015 115807 2
648 agent claude-sonnet-5 547 117822 3
649 agent claude-sonnet-5 387 118369 20
650 agent claude-sonnet-5 192 118756 10
651 agent claude-sonnet-5 320 118948 2
652 agent claude-sonnet-5 200 119268 1
653 agent claude-sonnet-5 1079 119468 2
654 agent claude-sonnet-5 1398 120547 6
655 agent claude-sonnet-5 897 121945 5
656 agent claude-sonnet-5 1190 122842 5
657 agent claude-sonnet-5 1174 124032 5
658 agent claude-sonnet-5 1483 125206 6
659 agent claude-sonnet-5 439 126689 2
660 agent claude-sonnet-5 215 127128 9
661 agent claude-sonnet-5 570 127343 1
662 agent claude-sonnet-5 189 127913 9
663 agent claude-sonnet-5 713 128102 2
664 agent claude-sonnet-5 394 128815 20
665 agent claude-sonnet-5 189 129209 9
666 agent claude-sonnet-5 1725 129398 3
667 agent claude-sonnet-5 645 131123 1
668 agent claude-sonnet-5 303 131768 2
669 agent claude-sonnet-5 186 132071 9
670 agent claude-sonnet-5 248 132257 2
671 agent claude-sonnet-5 1717 132505 5
672 agent claude-sonnet-5 344 134222 5
673 agent claude-sonnet-5 529 134566 2
674 agent claude-haiku-4-5-20251001 12974 0 3
675 agent claude-haiku-4-5-20251001 3164 12974 2
676 agent claude-haiku-4-5-20251001 1275 16138 4
677 agent claude-haiku-4-5-20251001 1787 17413 2
678 agent claude-haiku-4-5-20251001 374 19200 4
679 agent claude-haiku-4-5-20251001 330 19574 4
680 agent claude-sonnet-5 10186 7831 3
681 agent claude-sonnet-5 8258 18017 2
682 agent claude-sonnet-5 2402 26275 2
683 agent claude-sonnet-5 23795 28677 6
684 agent claude-sonnet-5 18588 52472 2
685 agent claude-sonnet-5 11513 71060 7
686 agent claude-sonnet-5 13173 82573 5
687 agent claude-sonnet-5 24829 95746 9
688 agent claude-sonnet-5 3232 120575 2
689 agent claude-sonnet-5 14848 123807 3
690 agent claude-sonnet-5 1495 138655 2
691 agent claude-sonnet-5 687 140150 17
692 agent claude-sonnet-5 470 140837 17
693 agent claude-sonnet-5 862 141307 17
694 agent claude-sonnet-5 386 142169 17
695 agent claude-sonnet-5 916 142555 17
696 agent claude-sonnet-5 608 143471 17
697 agent claude-sonnet-5 572 144079 1
698 agent claude-sonnet-5 599 144651 17
699 agent claude-sonnet-5 436 145250 17
700 agent claude-sonnet-5 1547 145686 20
701 agent claude-sonnet-5 528 147233 17
702 agent claude-sonnet-5 650 147761 1
703 agent claude-sonnet-5 516 148411 17
704 agent claude-sonnet-5 405 148927 16
705 agent claude-sonnet-5 1204 149332 20
706 agent claude-sonnet-5 554 150536 2
707 agent claude-sonnet-5 323 151090 17
708 agent claude-sonnet-5 415 151413 17
709 agent claude-sonnet-5 432 151828 2
710 agent claude-sonnet-5 478 152260 17
711 agent claude-sonnet-5 1733 152738 4
712 agent claude-sonnet-5 5420 154471 3
713 agent claude-sonnet-5 1049 159891 17
714 agent claude-sonnet-5 813 160940 2
715 agent claude-sonnet-5 467 161753 17
716 agent claude-sonnet-5 2163 162220 3
717 agent claude-sonnet-5 698 164383 17
718 agent claude-sonnet-5 756 165081 4
719 agent claude-sonnet-5 2398 165837 3
720 agent claude-sonnet-5 422 168235 2
721 agent claude-sonnet-5 1591 168657 3
722 agent claude-sonnet-5 1379 170248 2
723 agent claude-sonnet-5 466 171627 3
724 agent claude-sonnet-5 1255 172093 14
725 agent claude-sonnet-5 990 173348 2
726 agent claude-sonnet-5 2171 174338 3
727 agent claude-sonnet-5 217 176509 2
728 agent claude-sonnet-5 232 176726 3
729 agent claude-sonnet-5 757 176958 17
730 agent claude-sonnet-5 434 177715 4
731 agent claude-sonnet-5 926 178149 17
732 agent claude-sonnet-5 638 179075 3
733 agent claude-sonnet-5 659 179713 3
734 agent claude-sonnet-5 576 180372 17
735 agent claude-sonnet-5 686 180948 17
736 agent claude-sonnet-5 385 181634 2
737 agent claude-sonnet-5 882 182019 5
738 agent claude-sonnet-5 515 182901 4
739 agent claude-sonnet-5 682 183416 2
740 agent claude-sonnet-5 1310 184098 2
741 agent claude-sonnet-5 1188 185408 20
742 agent claude-sonnet-5 587 186596 17
743 agent claude-sonnet-5 534 187183 2
744 agent claude-sonnet-5 161 187717 3
745 agent claude-sonnet-5 4721 187878 2
746 agent claude-sonnet-5 569 192599 3
747 agent claude-sonnet-5 793 193168 6
748 agent claude-sonnet-5 3682 193961 2
749 agent claude-sonnet-5 168 197643 20
750 agent claude-sonnet-5 8502 197811 2
751 agent claude-sonnet-5 311 206313 20
752 agent claude-sonnet-5 531 206624 6
753 agent claude-sonnet-5 2471 207155 3
754 agent claude-sonnet-5 1025 209626 20
755 agent claude-sonnet-5 573 210651 17
756 agent claude-sonnet-5 503 211224 4
757 agent claude-sonnet-5 1537 211727 5
758 agent claude-sonnet-5 440 213264 20
759 agent claude-sonnet-5 389 213704 3
760 agent claude-sonnet-5 210 214093 2
761 agent claude-sonnet-5 1607 214303 2
762 agent claude-sonnet-5 1654 215910 3
763 agent claude-sonnet-5 5380 217564 10
764 agent claude-sonnet-5 1660 222944 2
765 agent claude-sonnet-5 354 224604 2
766 agent claude-sonnet-5 293 224958 17
767 agent claude-sonnet-5 1763 225251 3
768 agent claude-sonnet-5 563 227014 3
769 agent claude-sonnet-5 10131 227577 20
770 agent claude-sonnet-5 139 237708 20
771 agent claude-sonnet-5 4435 237847 2
772 agent claude-sonnet-5 1970 242282 3
773 agent claude-sonnet-5 1478 244252 20
774 agent claude-sonnet-5 388 245730 17
775 agent claude-sonnet-5 388 246118 16
776 agent claude-sonnet-5 388 246506 4
777 agent claude-sonnet-5 348 246894 4
778 agent claude-sonnet-5 347 247242 2
779 agent claude-sonnet-5 205 247589 1
780 agent claude-sonnet-5 3103 247794 2
781 agent claude-sonnet-5 577 250897 4
782 agent claude-sonnet-5 435 251474 2
783 agent claude-sonnet-5 743 251909 7
784 agent claude-sonnet-5 12142 252652 2
785 agent claude-sonnet-5 1165 264794 8
786 agent claude-sonnet-5 472 265959 2
787 agent claude-sonnet-5 977 266431 2
788 agent claude-sonnet-5 342 267408 1
789 agent claude-sonnet-5 18525 0 6
790 agent claude-sonnet-5 6164 18525 4
791 agent claude-sonnet-5 264 24689 20
792 agent claude-sonnet-5 2937 24953 7
793 agent claude-sonnet-5 2836 27890 5
794 agent claude-sonnet-5 1104 30726 3
795 agent claude-sonnet-5 1434 31830 3
796 agent claude-sonnet-5 224 33264 7
797 agent claude-sonnet-5 802 33488 1
798 agent claude-sonnet-5 1108 34290 9
799 agent claude-sonnet-5 5929 35398 2
800 agent claude-sonnet-5 499 41327 2
801 agent claude-sonnet-5 3364 41826 2
802 agent claude-sonnet-5 4752 45190 10
803 agent claude-sonnet-5 1419 49942 3
804 agent claude-sonnet-5 2901 51361 3
805 agent claude-sonnet-5 1778 54262 3
806 agent claude-sonnet-5 6305 56040 2
807 agent claude-sonnet-5 436 62345 1
808 agent claude-sonnet-5 594 62781 4
809 agent claude-sonnet-5 938 63375 20
810 agent claude-sonnet-5 1208 64313 2
811 agent claude-sonnet-5 535 65521 2
812 agent claude-sonnet-5 1021 66056 3
813 agent claude-sonnet-5 245 67077 5
814 agent claude-sonnet-5 1753 67322 17
815 agent claude-sonnet-5 1864 69075 5
816 agent claude-sonnet-5 251 70939 7
817 agent claude-sonnet-5 5229 71190 3
818 agent claude-sonnet-5 603 76419 2
819 agent claude-sonnet-5 1264 77022 4
820 agent claude-sonnet-5 315 78286 9
821 agent claude-sonnet-5 1172 78601 3
822 agent claude-sonnet-5 201 79773 20
823 agent claude-sonnet-5 747 79974 1
824 agent claude-sonnet-5 199 80721 20
825 agent claude-sonnet-5 579 80920 20
826 agent claude-sonnet-5 810 81499 5
827 agent claude-sonnet-5 487 82309 2
828 agent claude-sonnet-5 545 82796 17
829 agent claude-sonnet-5 1468 83341 3
830 agent claude-sonnet-5 436 84809 17
831 agent claude-sonnet-5 711 85245 2
832 agent claude-sonnet-5 494 85956 2
833 agent claude-sonnet-5 612 86450 6
834 agent claude-sonnet-5 1083 87062 20
835 agent claude-sonnet-5 139 88145 20
836 agent claude-sonnet-5 362 88284 6
837 agent claude-sonnet-5 1237 88646 5
838 agent claude-sonnet-5 128 89883 2
839 agent claude-sonnet-5 160 90011 5
840 agent claude-sonnet-5 218 90171 6
841 agent claude-sonnet-5 171 90389 5
842 agent claude-sonnet-5 222 90560 20
843 agent claude-sonnet-5 1359 90782 2
844 agent claude-sonnet-5 840 92141 20
845 agent claude-sonnet-5 136 92981 1
846 agent claude-sonnet-5 500 93117 3
847 agent claude-sonnet-5 178 93617 5
848 agent claude-sonnet-5 483 93795 3
849 agent claude-sonnet-5 1407 94278 9
850 agent claude-sonnet-5 380 95685 20
851 agent claude-sonnet-5 734 96065 20
852 agent claude-sonnet-5 314 96799 3
853 agent claude-sonnet-5 758 97113 2
854 agent claude-sonnet-5 849 97871 21
855 agent claude-sonnet-5 728 98720 8
856 agent claude-sonnet-5 1186 99448 2
857 agent claude-sonnet-5 794 100634 20
858 agent claude-sonnet-5 351 101428 3
859 agent claude-sonnet-5 876 101779 20
860 agent claude-sonnet-5 318 102655 2
861 agent claude-sonnet-5 387 102973 1
862 agent claude-sonnet-5 186 103360 20
863 agent claude-sonnet-5 145 103546 20
864 agent claude-sonnet-5 216 103691 4
865 agent claude-sonnet-5 244 103907 9
866 agent claude-sonnet-5 1158 104151 1
867 agent claude-sonnet-5 409 105309 4
868 agent claude-sonnet-5 1012 105718 2
869 agent claude-sonnet-5 371 106730 1
870 agent claude-opus-5 31971 0 1
871 agent claude-opus-5 4738 31971 1
872 agent claude-opus-5 2845 36709 3
873 agent claude-opus-5 4875 39554 6
874 agent claude-opus-5 6887 44429 3
875 agent claude-opus-5 8656 51316 4
876 agent claude-opus-5 3983 59972 3
877 agent claude-opus-5 2011 63955 20
878 agent claude-opus-5 6546 65966 4
879 agent claude-opus-5 1186 72512 17
880 agent claude-opus-5 2987 73698 17
881 agent claude-opus-5 942 76685 3
882 agent claude-opus-5 272 77627 17
883 agent claude-opus-5 805 77899 2
884 agent claude-opus-5 196 78704 3
885 agent claude-opus-5 257 78900 17
886 agent claude-opus-5 1336 79157 17
887 agent claude-opus-5 3899 80493 3
888 agent claude-opus-5 6266 84392 3
889 agent claude-opus-5 5071 90658 4
890 agent claude-opus-5 3374 95729 5
891 agent claude-opus-5 4043 99103 3
892 agent claude-opus-5 3845 103146 6
893 agent claude-opus-5 2305 106991 2
894 agent claude-opus-5 4989 109296 2
895 agent claude-opus-5 5948 114285 3
896 agent claude-opus-5 1518 120233 20
897 agent claude-opus-5 536 121751 3
898 agent claude-opus-5 3119 122287 3
899 agent claude-opus-5 1280 125406 2
900 agent claude-opus-5 805 126686 16
901 agent claude-opus-5 760 127491 17
902 agent claude-opus-5 633 128251 17
903 agent claude-opus-5 343 128884 16
904 agent claude-opus-5 351 129227 3
905 agent claude-opus-5 1636 129578 7
906 agent claude-opus-5 534 131214 20
907 agent claude-opus-5 680 131748 2
908 agent claude-opus-5 2070 132428 6
909 agent claude-opus-5 1457 134498 17
910 agent claude-opus-5 1478 135955 2
911 agent claude-opus-5 354 137433 2
912 agent claude-opus-5 2111 137787 3
913 agent claude-opus-5 3788 139898 2
914 agent claude-opus-5 20766 143686 17
915 agent claude-opus-5 592 164452 4
916 agent claude-opus-5 8235 165044 3
917 agent claude-opus-5 597 173279 3
918 agent claude-opus-5 997 173876 17
919 agent claude-opus-5 166 174873 2
920 agent claude-haiku-4-5-20251001 12858 0 4
921 agent claude-haiku-4-5-20251001 1948 12858 2
922 agent claude-haiku-4-5-20251001 1915 14806 2
923 agent claude-haiku-4-5-20251001 274 16721 2
924 agent claude-sonnet-5 18814 0 5
925 agent claude-sonnet-5 2307 18814 2
926 agent claude-sonnet-5 5601 21121 20
927 agent claude-sonnet-5 8590 26722 8
928 agent claude-sonnet-5 5517 35312 2
929 agent claude-sonnet-5 24002 40829 3
930 agent claude-sonnet-5 14246 64831 4
931 agent claude-sonnet-5 3058 79077 7
932 agent claude-sonnet-5 1249 82135 20
933 agent claude-sonnet-5 4809 83384 14
934 agent claude-sonnet-5 7019 88193 20
935 agent claude-sonnet-5 2234 95212 3
936 agent claude-sonnet-5 883 97446 3
937 agent claude-sonnet-5 1520 98329 3
938 agent claude-sonnet-5 6240 99849 4
939 agent claude-sonnet-5 2133 106089 3
940 agent claude-sonnet-5 1390 108222 3
941 agent claude-sonnet-5 393 109612 20
942 agent claude-sonnet-5 3049 110005 3
943 agent claude-sonnet-5 916 113054 20
944 agent claude-sonnet-5 6331 113970 2
945 agent claude-sonnet-5 13507 120301 3
946 agent claude-sonnet-5 332 133808 3
947 agent claude-sonnet-5 507 134140 1
948 agent claude-sonnet-5 5114 134647 2
949 agent claude-sonnet-5 4784 139761 2
950 agent claude-sonnet-5 2862 144545 3
951 agent claude-sonnet-5 29106 147407 3
952 agent claude-sonnet-5 2285 176513 2
953 agent claude-sonnet-5 3227 178798 20
954 agent claude-sonnet-5 346 182025 5
955 agent claude-sonnet-5 2994 182371 5
956 agent claude-sonnet-5 2312 185365 3
957 agent claude-sonnet-5 785 187677 2
958 agent claude-sonnet-5 2512 188462 10
959 agent claude-sonnet-5 2376 190974 3
960 agent claude-sonnet-5 634 193350 3
961 agent claude-sonnet-5 791 193984 9
962 agent claude-sonnet-5 1334 194775 4
963 agent claude-sonnet-5 2540 196109 3
964 agent claude-sonnet-5 696 198649 3
965 agent claude-sonnet-5 226 199345 20
966 agent claude-sonnet-5 383 199571 17
967 agent claude-sonnet-5 342 199954 20
968 agent claude-sonnet-5 292 200296 17
969 agent claude-sonnet-5 344 200588 9
970 agent claude-sonnet-5 598 200932 9
971 agent claude-sonnet-5 749 201530 5
972 agent claude-sonnet-5 962 202279 16
973 agent claude-sonnet-5 1768 203241 6
974 agent claude-sonnet-5 502 205009 21
975 agent claude-sonnet-5 197 205511 21
976 agent claude-sonnet-5 369 205708 16
977 agent claude-sonnet-5 542 206077 2
978 agent claude-sonnet-5 519 206619 20
979 agent claude-sonnet-5 1299 207138 3
980 agent claude-sonnet-5 4577 208437 7
981 agent claude-sonnet-5 251 213014 3
982 agent claude-sonnet-5 344 213265 2
983 agent claude-sonnet-5 7684 213609 9
984 agent claude-sonnet-5 4230 221293 3
985 agent claude-sonnet-5 1209 225523 2
986 agent claude-sonnet-5 262 226732 20
987 agent claude-sonnet-5 699 226994 20
988 agent claude-sonnet-5 3543 227693 3
989 agent claude-sonnet-5 3034 231236 4
990 agent claude-sonnet-5 1372 234270 17
991 agent claude-sonnet-5 461 235642 6
992 agent claude-sonnet-5 765 236103 20
993 agent claude-sonnet-5 708 236868 4
994 agent claude-sonnet-5 1969 237576 2
995 agent claude-sonnet-5 2433 239545 9
996 agent claude-sonnet-5 918 241978 2
997 agent claude-sonnet-5 1537 242896 3
998 agent claude-sonnet-5 530 244433 7
999 agent claude-sonnet-5 491 244963 9
1000 agent claude-sonnet-5 259 245454 1
1001 agent claude-sonnet-5 201 245713 20
1002 agent claude-sonnet-5 1077 245914 1
1003 agent claude-sonnet-5 325 246991 5
1004 agent claude-sonnet-5 3193 247316 3
1005 agent claude-sonnet-5 2641 250509 20
1006 agent claude-sonnet-5 537 253150 3
1007 agent claude-sonnet-5 1153 253687 1
1008 agent claude-sonnet-5 307 254840 3
1009 agent claude-sonnet-5 331 255147 4
1010 agent claude-sonnet-5 548 255478 3
1011 agent claude-sonnet-5 381 256026 4
1012 agent claude-sonnet-5 6194 12328 5
1013 agent claude-sonnet-5 2325 18522 4
1014 agent claude-sonnet-5 4218 20847 6
1015 agent claude-sonnet-5 1171 25065 3
1016 agent claude-sonnet-5 1802 26236 2
1017 agent claude-sonnet-5 3755 28038 3
1018 agent claude-sonnet-5 4526 31793 3
1019 agent claude-sonnet-5 5060 36319 3
1020 agent claude-sonnet-5 503 41379 3
1021 agent claude-sonnet-5 2220 41882 3
1022 agent claude-sonnet-5 3203 44102 8
1023 agent claude-sonnet-5 1102 47305 2
1024 agent claude-sonnet-5 1568 48407 2
1025 agent claude-sonnet-5 676 49975 2
1026 agent claude-sonnet-5 884 50651 4
1027 agent claude-sonnet-5 602 51535 1
1028 agent claude-sonnet-5 219 52137 20
1029 agent claude-sonnet-5 620 52356 1
1030 agent claude-sonnet-5 1058 52976 1
1031 agent claude-sonnet-5 387 54034 2
1032 agent claude-haiku-4-5-20251001 12625 0 1
1033 agent claude-haiku-4-5-20251001 1703 12625 2
1034 agent claude-haiku-4-5-20251001 384 14328 3
1035 agent claude-haiku-4-5-20251001 437 14712 1
1036 agent claude-haiku-4-5-20251001 451 15149 1
1037 agent claude-haiku-4-5-20251001 542 15600 2
1038 agent claude-haiku-4-5-20251001 739 16142 3
1039 agent claude-opus-5 32590 0 1
1040 agent claude-opus-5 4762 32590 1
1041 agent claude-opus-5 2037 37352 3
1042 agent claude-opus-5 3087 39389 4
1043 agent claude-opus-5 907 42476 2
1044 agent claude-opus-5 3636 43383 4
1045 agent claude-opus-5 10114 47019 2
1046 agent claude-opus-5 2565 57133 3
1047 agent claude-opus-5 1083 59698 3
1048 agent claude-opus-5 1809 60781 3
1049 agent claude-opus-5 1795 62590 3
1050 agent claude-opus-5 1630 64385 2
1051 agent claude-opus-5 808 66015 16
1052 agent claude-opus-5 963 66823 20
1053 agent claude-opus-5 917 67786 3
1054 agent claude-opus-5 808 68703 6
1055 agent claude-opus-5 283 69511 20
1056 agent claude-opus-5 466 69794 7
1057 agent claude-opus-5 486 70260 5
1058 agent claude-opus-5 186 70746 20
1059 agent claude-opus-5 3896 70932 2
1060 agent claude-opus-5 1161 74828 20
1061 agent claude-opus-5 1547 75989 4
1062 agent claude-opus-5 2349 77536 3
1063 agent claude-opus-5 2245 79885 2
1064 agent claude-opus-5 912 82130 2
1065 agent claude-opus-5 2674 83042 3
1066 agent claude-opus-5 1593 85716 3
1067 agent claude-opus-5 2497 87309 20
1068 agent claude-opus-5 1894 89806 3
1069 agent claude-opus-5 290 91700 2
1070 agent claude-opus-5 1367 91990 2
1071 agent claude-opus-5 1966 93357 3
1072 agent claude-opus-5 1486 95323 20
1073 agent claude-opus-5 438 96809 2
1074 agent claude-opus-5 1236 97247 4
1075 agent claude-opus-5 515 98483 2
1076 agent claude-opus-5 221 98998 20
1077 agent claude-opus-5 716 99219 3
1078 agent claude-opus-5 4885 99935 20
1079 agent claude-opus-5 2543 104820 2
1080 agent claude-opus-5 4148 107363 2
1081 agent claude-opus-5 1778 111511 17
1082 agent claude-opus-5 270 113289 6
1083 agent claude-opus-5 8054 113559 3
1084 agent claude-opus-5 643 121613 17
1085 agent claude-opus-5 3655 122256 3
1086 agent claude-opus-5 4192 125911 14
1087 agent claude-opus-5 3915 130103 7
1088 agent claude-opus-5 1313 134018 2
1089 agent claude-opus-5 847 135331 17
1090 agent claude-opus-5 579 136178 3
1091 agent claude-opus-5 1272 136757 4
1092 agent claude-opus-5 231 138029 3
1093 agent claude-opus-5 889 138260 21
1094 agent claude-opus-5 5629 139149 4
1095 agent claude-opus-5 575 144778 2
1096 agent claude-haiku-4-5-20251001 4885 6939 2
1097 agent claude-haiku-4-5-20251001 1390 11824 2
1098 agent claude-haiku-4-5-20251001 572 13214 2
1099 agent claude-haiku-4-5-20251001 1205 13786 3
1100 agent claude-haiku-4-5-20251001 259 14991 4
1101 agent claude-haiku-4-5-20251001 12697 0 1
1102 agent claude-haiku-4-5-20251001 2282 12697 2
1103 agent claude-haiku-4-5-20251001 2336 14979 2
1104 agent claude-haiku-4-5-20251001 274 17315 3
1105 agent claude-opus-5 32679 0 1
1106 agent claude-opus-5 4726 32679 16
1107 agent claude-opus-5 564 37405 6
1108 agent claude-opus-5 2099 37969 2
1109 agent claude-opus-5 5695 40068 4
1110 agent claude-opus-5 224 45763 16
1111 agent claude-opus-5 220 45987 17
1112 agent claude-opus-5 1768 46207 3
1113 agent claude-opus-5 4769 47975 3
1114 agent claude-opus-5 675 52744 16
1115 agent claude-opus-5 3183 53419 4
1116 agent claude-opus-5 481 56602 17
1117 agent claude-opus-5 249 57083 3
1118 agent claude-opus-5 796 57332 20
1119 agent claude-opus-5 995 58128 17
1120 agent claude-opus-5 867 59123 4
1121 agent claude-opus-5 503 59990 20
1122 agent claude-opus-5 815 60493 2
1123 agent claude-opus-5 1473 61308 2
1124 agent claude-opus-5 1291 62781 2
1125 agent claude-opus-5 678 64072 8
1126 agent claude-opus-5 3006 64750 17
1127 agent claude-opus-5 629 67756 20
1128 agent claude-opus-5 5604 68385 3
1129 agent claude-opus-5 1280 73989 3
1130 agent claude-opus-5 1994 75269 2
1131 agent claude-opus-5 2179 77263 3
1132 agent claude-opus-5 4294 79442 2
1133 agent claude-opus-5 2257 83736 3
1134 agent claude-opus-5 1146 85993 3
1135 agent claude-opus-5 717 87139 20
1136 agent claude-opus-5 468 87856 3
1137 agent claude-opus-5 1298 88324 20
1138 agent claude-opus-5 492 89622 2
1139 agent claude-opus-5 1395 90114 3
1140 agent claude-opus-5 1706 91509 17
1141 agent claude-opus-5 934 93215 3
1142 agent claude-opus-5 1882 94149 17
1143 agent claude-opus-5 854 96031 2
1144 agent claude-opus-5 1645 96885 3
1145 agent claude-opus-5 4094 98530 20
1146 agent claude-opus-5 2561 102624 3
1147 agent claude-opus-5 685 105185 3
1148 agent claude-opus-5 4239 105870 2
1149 agent claude-opus-5 1208 110109 2
1150 agent claude-opus-5 9950 111317 20
1151 agent claude-opus-5 292 121267 3
1152 agent claude-opus-5 668 121559 21
1153 agent claude-opus-5 1787 122227 10
1154 agent claude-opus-5 6114 124014 3
1155 agent claude-opus-5 622 130128 3
1156 agent claude-opus-5 217 130750 16
1157 agent claude-opus-5 5521 130967 20
1158 agent claude-opus-5 156 136488 16
1159 agent claude-opus-5 324 136644 3
1160 agent claude-haiku-4-5-20251001 12787 0 1
1161 agent claude-haiku-4-5-20251001 1253 12787 2
1162 agent claude-haiku-4-5-20251001 692 14040 4
1163 agent claude-haiku-4-5-20251001 1762 14732 2
1164 agent claude-haiku-4-5-20251001 1811 16494 2
1165 agent claude-haiku-4-5-20251001 278 18305 4
1166 agent claude-haiku-4-5-20251001 428 18583 4
1167 agent claude-sonnet-5 6649 12328 5
1168 agent claude-sonnet-5 2322 18977 4
1169 agent claude-sonnet-5 4885 21299 4
1170 agent claude-sonnet-5 483 26184 2
1171 agent claude-sonnet-5 458 26667 2
1172 agent claude-sonnet-5 1983 27125 2
1173 agent claude-sonnet-5 323 29108 5
1174 agent claude-sonnet-5 450 29431 3
1175 agent claude-sonnet-5 818 29881 2
1176 agent claude-sonnet-5 753 30699 17
1177 agent claude-sonnet-5 660 31452 2
1178 agent claude-sonnet-5 2001 32112 3
1179 agent claude-sonnet-5 1003 34113 2
1180 agent claude-sonnet-5 575 35116 2
1181 agent claude-sonnet-5 308 35691 20
1182 agent claude-sonnet-5 390 35999 2
1183 agent claude-sonnet-5 289 36389 20
1184 agent claude-sonnet-5 496 36678 3
1185 agent claude-sonnet-5 412 37174 2
1186 agent claude-sonnet-5 621 37586 2
1187 agent claude-sonnet-5 144 38207 20
1188 agent claude-sonnet-5 490 38351 2
1189 agent claude-sonnet-5 1313 38841 1
1190 agent claude-sonnet-5 312 40154 2
1191 agent claude-opus-5 11765 0 1
1192 agent claude-opus-5 4687 11765 2
1193 agent claude-opus-5 863 16452 2
1194 agent claude-opus-5 3791 17315 3
1195 agent claude-opus-5 1538 21106 2
1196 agent claude-opus-5 3413 22644 4
1197 agent claude-opus-5 4150 26057 2
1198 agent claude-opus-5 3150 30207 2
1199 agent claude-opus-5 3827 33357 3
1200 agent claude-opus-5 2621 37184 5
1201 agent claude-opus-5 5198 39805 2
1202 agent claude-opus-5 2569 45003 3
1203 agent claude-opus-5 6096 47572 3
1204 agent claude-opus-5 1560 53668 6
1205 agent claude-opus-5 2010 55228 4
1206 agent claude-opus-5 5107 57238 2
1207 agent claude-opus-5 2380 62345 2
1208 agent claude-opus-5 3663 64725 3
1209 agent claude-opus-5 1220 68388 2
1210 agent claude-haiku-4-5-20251001 12066 0 4
1211 agent claude-haiku-4-5-20251001 1570 12066 2
1212 agent claude-haiku-4-5-20251001 448 13636 2
1213 agent claude-haiku-4-5-20251001 1509 14084 2
1214 agent claude-haiku-4-5-20251001 282 15593 3
1215 agent claude-haiku-4-5-20251001 218 15875 4
1216 agent claude-sonnet-5 10476 7831 7
1217 agent claude-sonnet-5 7212 18307 5
1218 agent claude-sonnet-5 627 25519 21
1219 agent claude-sonnet-5 57474 26146 2
1220 agent claude-sonnet-5 18128 83620 3
1221 agent claude-sonnet-5 13825 101748 4
1222 agent claude-sonnet-5 20302 115573 5
1223 agent claude-sonnet-5 25515 135875 6
1224 agent claude-sonnet-5 2064 161390 5
1225 agent claude-sonnet-5 2528 163454 3
1226 agent claude-sonnet-5 1947 165982 2
1227 agent claude-sonnet-5 11061 167929 17
1228 agent claude-sonnet-5 609 178990 8
1229 agent claude-sonnet-5 1912 179599 4
1230 agent claude-sonnet-5 20918 181511 2
1231 agent claude-sonnet-5 3463 202429 3
1232 agent claude-sonnet-5 937 205892 1
1233 agent claude-sonnet-5 497 206829 3
1234 agent claude-sonnet-5 1701 207326 6
1235 agent claude-sonnet-5 1023 209027 2
1236 agent claude-sonnet-5 7531 210050 5
1237 agent claude-sonnet-5 1465 217581 15
1238 agent claude-sonnet-5 181 219046 20
1239 agent claude-sonnet-5 210 219227 5
1240 agent claude-sonnet-5 771 219437 5
1241 agent claude-sonnet-5 1587 220208 4
1242 agent claude-sonnet-5 858 221795 20
1243 agent claude-sonnet-5 428 222653 17
1244 agent claude-sonnet-5 741 223081 7
1245 agent claude-sonnet-5 563 223822 2
1246 agent claude-sonnet-5 175 224385 2
1247 agent claude-sonnet-5 222 224560 2
1248 agent claude-sonnet-5 2259 224782 2
1249 agent claude-sonnet-5 725 227041 17
1250 agent claude-sonnet-5 1088 227766 3
1251 agent claude-sonnet-5 153 228854 2
1252 agent claude-sonnet-5 789 229007 17
1253 agent claude-sonnet-5 1264 229796 3
1254 agent claude-sonnet-5 999 231060 20
1255 agent claude-sonnet-5 1737 232059 2
1256 agent claude-sonnet-5 145 233796 2
1257 agent claude-sonnet-5 2694 233941 3
1258 agent claude-sonnet-5 3994 236635 3
1259 agent claude-sonnet-5 174 240629 2
1260 agent claude-sonnet-5 218 240803 1
1261 agent claude-sonnet-5 2647 241021 3
1262 agent claude-sonnet-5 2913 243668 5
1263 agent claude-sonnet-5 439 246581 3
1264 agent claude-sonnet-5 1002 247020 20
1265 agent claude-sonnet-5 701 248022 20
1266 agent claude-sonnet-5 491 248723 7
1267 agent claude-sonnet-5 2877 249214 8
1268 agent claude-sonnet-5 1994 252091 6
1269 agent claude-sonnet-5 7675 254085 20
1270 agent claude-sonnet-5 253 261760 3
1271 agent claude-sonnet-5 1822 262013 3
1272 agent claude-sonnet-5 1279 263835 17
1273 agent claude-sonnet-5 886 265114 2
1274 agent claude-sonnet-5 1466 266000 8
1275 agent claude-sonnet-5 900 267466 20
1276 agent claude-sonnet-5 490 268366 2
1277 agent claude-sonnet-5 311 268856 20
1278 agent claude-sonnet-5 1005 269167 2
1279 agent claude-sonnet-5 185 270172 20
1280 agent claude-sonnet-5 3068 270357 2
1281 agent claude-sonnet-5 1308 273425 20
1282 agent claude-sonnet-5 1471 274733 20
1283 agent claude-sonnet-5 413 276204 6
1284 agent claude-sonnet-5 1426 276617 3
1285 agent claude-sonnet-5 1115 278043 7
1286 agent claude-sonnet-5 2318 279158 20
1287 agent claude-sonnet-5 1333 281476 2
1288 agent claude-sonnet-5 2527 282809 3
1289 agent claude-sonnet-5 146 285336 20
1290 agent claude-sonnet-5 776 285482 20
1291 agent claude-sonnet-5 281 286258 4
1292 agent claude-sonnet-5 2219 286539 2
1293 agent claude-sonnet-5 3626 288758 14
1294 agent claude-sonnet-5 312 292384 9
1295 agent claude-sonnet-5 1235 292696 2
1296 agent claude-sonnet-5 1583 293931 2
1297 agent claude-sonnet-5 1032 295514 21
1298 agent claude-sonnet-5 520 296546 20
1299 agent claude-sonnet-5 776 297066 20
1300 agent claude-sonnet-5 1233 297842 3
1301 agent claude-sonnet-5 5828 299075 20
1302 agent claude-sonnet-5 1443 304903 2
1303 agent claude-sonnet-5 2001 306346 5
1304 agent claude-sonnet-5 336 308347 2
1305 agent claude-sonnet-5 1222 308683 1
1306 agent claude-sonnet-5 933 309905 20
1307 agent claude-sonnet-5 413 310838 5
1308 agent claude-sonnet-5 628 311251 17
1309 agent claude-sonnet-5 508 311879 20
1310 agent claude-sonnet-5 930 312387 3
1311 agent claude-sonnet-5 973 313317 2
1312 agent claude-sonnet-5 807 314290 4
1313 agent claude-sonnet-5 277 315097 2
1314 agent claude-haiku-4-5-20251001 13147 0 4
1315 agent claude-haiku-4-5-20251001 1778 13147 2
1316 agent claude-haiku-4-5-20251001 469 14925 2
1317 agent claude-haiku-4-5-20251001 2303 15394 3
1318 agent claude-haiku-4-5-20251001 332 17697 4
1319 agent claude-haiku-4-5-20251001 153 18029 2
1320 agent claude-sonnet-5 18640 0 4
1321 agent claude-sonnet-5 2322 18640 4
1322 agent claude-sonnet-5 7199 20962 3
1323 agent claude-sonnet-5 337 28161 20
1324 agent claude-sonnet-5 1561 28498 20
1325 agent claude-sonnet-5 5940 30059 5
1326 agent claude-sonnet-5 6412 35999 2
1327 agent claude-sonnet-5 1409 42411 20
1328 agent claude-sonnet-5 1404 43820 5
1329 agent claude-sonnet-5 444 45224 2
1330 agent claude-sonnet-5 1836 45668 3
1331 agent claude-sonnet-5 1458 47504 17
1332 agent claude-sonnet-5 419 48962 17
1333 agent claude-sonnet-5 441 49381 2
1334 agent claude-sonnet-5 1278 49822 2
1335 agent claude-sonnet-5 1210 51100 20
1336 agent claude-sonnet-5 1792 52310 3
1337 agent claude-sonnet-5 1046 54102 6
1338 agent claude-sonnet-5 1313 55148 2
1339 agent claude-sonnet-5 2733 56461 2
1340 agent claude-sonnet-5 3839 59194 20
1341 agent claude-sonnet-5 485 63033 1
1342 agent claude-sonnet-5 409 63518 9
1343 agent claude-sonnet-5 772 63927 1
1344 agent claude-sonnet-5 224 64699 2
1345 agent claude-sonnet-5 1009 64923 1
1346 agent claude-sonnet-5 693 65932 6
1347 agent claude-sonnet-5 433 66625 2
1348 agent claude-sonnet-5 1167 67058 1
1349 agent claude-opus-5 12629 0 1
1350 agent claude-opus-5 4430 12629 5
1351 agent claude-opus-5 1251 17059 17
1352 agent claude-opus-5 9161 18310 8
1353 agent claude-opus-5 3683 27471 3
1354 agent claude-opus-5 2581 31154 2
1355 agent claude-opus-5 3112 33735 4
1356 agent claude-opus-5 5693 36847 2
1357 agent claude-opus-5 1746 42540 3
1358 agent claude-opus-5 723 44286 3
1359 agent claude-opus-5 2520 45009 3
1360 agent claude-opus-5 1615 47529 3
1361 agent claude-opus-5 4021 49144 3
1362 agent claude-opus-5 5378 53165 2
1363 agent claude-opus-5 1901 58543 3
1364 agent claude-opus-5 2686 60444 2
1365 agent claude-opus-5 3223 63130 3
1366 agent claude-opus-5 2236 66353 17
1367 agent claude-opus-5 513 68589 3
1368 agent claude-opus-5 3744 69102 2
1369 agent claude-opus-5 2995 72846 3
1370 agent claude-opus-5 2314 75841 2
1371 agent claude-opus-5 2175 78155 3
1372 agent claude-opus-5 1864 80330 2
1373 agent claude-opus-5 1214 82194 2
1374 agent claude-opus-5 3516 83408 3
1375 agent claude-opus-5 4677 86924 8
1376 agent claude-opus-5 1172 91601 7
1377 agent claude-opus-5 3235 92773 3
1378 agent claude-sonnet-5 15491 0 4
1379 agent claude-sonnet-5 2521 15491 4
1380 agent claude-sonnet-5 11610 18012 2
1381 agent claude-sonnet-5 14531 29622 20
1382 agent claude-sonnet-5 5383 44153 5
1383 agent claude-sonnet-5 8094 49536 3
1384 agent claude-sonnet-5 12338 57630 2
1385 agent claude-sonnet-5 25796 69968 6
1386 agent claude-sonnet-5 1642 95764 2
1387 agent claude-sonnet-5 23899 97406 5
1388 agent claude-sonnet-5 695 121305 3
1389 agent claude-sonnet-5 804 122000 5
1390 agent claude-sonnet-5 6611 122804 2
1391 agent claude-sonnet-5 8591 129415 2
1392 agent claude-sonnet-5 1439 138006 8
1393 agent claude-sonnet-5 406 139445 3
1394 agent claude-sonnet-5 2006 139851 3
1395 agent claude-sonnet-5 4670 141857 3
1396 agent claude-sonnet-5 6960 146527 2
1397 agent claude-sonnet-5 1515 153487 2
1398 agent claude-sonnet-5 3433 155002 1
1399 agent claude-sonnet-5 806 158435 7
1400 agent claude-sonnet-5 1121 159241 4
1401 agent claude-sonnet-5 2240 160362 3
1402 agent claude-sonnet-5 759 162602 2
1403 agent claude-sonnet-5 216 163361 20
1404 agent claude-sonnet-5 381 163577 3
1405 agent claude-sonnet-5 322 163958 2
1406 agent claude-sonnet-5 441 164280 6
1407 agent claude-sonnet-5 1884 164721 2
1408 agent claude-sonnet-5 2199 166605 1
1409 agent claude-sonnet-5 1087 168804 1
1410 agent claude-sonnet-5 483 169891 1
-->
<!-- /cout -->
