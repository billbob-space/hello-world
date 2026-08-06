# 2026-08-06 — claude/marcq-handball-app-7zqifi

Branche : `claude/marcq-handball-app-7zqifi`
Périmètre : marcq-handball
Mode : `chaud`

Execution du PRP 07 de `apps/marcq-handball/prp/` — le classement cote serveur :
domaine Go, magasin sur fichier, trois routes `/api/*`, et le volume persistant
qui les alimente.

## Anomalies

### 1. Le verrou du PRP 07 est leve depuis que le contrat a change

**Symptome** — le PRP 07 s'ouvre sur un verrou en deux moities : le volume
persistant doit etre tranche « cote serveur », et `init.sh` doit apprendre a
monter un volume, sur une branche `fabrique/<sujet>` distincte. Les deux sont
faux au 2026-08-06.

**Cause** — le PRP a ete redige contre l'etat du depot a sa date. Depuis,
`init.sh` a gagne `check_volume`, `check_volume_list` et `check_volume_noms`
(l'aide en tete de fichier documente `volumes:` dans `app.yml`), et le contrat a
inverse la regle qu'il citait : « Une base, un cache, un volume, un service
annexe **t'appartiennent desormais** : declare-les dans un manifeste plutot que
de les demander dans un `README` ». Le chantier 1 du PRP — ecrire la demande
dans le README puis s'arreter — decrit donc un geste que le contrat interdit
maintenant.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP fige une lecture du contrat a sa date d'ecriture
et rien ne le lui rappelle. Le chantier 1 du PRP 07 est a reecrire : le volume
se declare dans `app.yml`, il ne se demande plus.

### 2. Un test de sous-chaine attrape du base64 aleatoire

**Symptome** — le test « le code n'est jamais stocke en clair » verifie aussi
qu'aucun champ nominatif n'entre dans `classement.json`, en cherchant les
sous-chaines `prenom`, `email`, `telephone` et `ip`. Il echoue sur `ip` — et
seulement parfois, ce qui est pire.

**Cause** — le sel et l'empreinte sont ecrits en base64, soit une suite de
lettres tirees au hasard a chaque execution : n'importe quelle sequence de deux
caracteres y apparait tot ou tard. Le test cherchait une sous-chaine nue la ou
il voulait dire « une cle JSON ». Chercher `"ip"` avec ses guillemets suffit.

**Detecte par** — `test`

**Action** — `comportement` — c'est la quatrieme fois en deux branches qu'un
test de sous-chaine attrape autre chose que sa cible (voir les anomalies 2 a 6
de `2026-08-06-claude-marcq-handball-app-phases-1yk38x.md`). Le filet large est
la bonne technique ; ce qui manque est le reflexe de se demander, en l'ecrivant,
ce que la sous-chaine attrape d'AUTRE. Ici la reponse etait « du hasard », donc
un test qui echoue une fois sur trois.

### 3. Le plafond memoire de la fabrique est depasse, et ce n'est pas cette branche

**Symptome** — `./init.sh --check` avertit : « memoire engagee 1216 Mo sur
9 service(s), au-dela du plafond 1024 Mo de fabrique.yml ». L'avertissement
apparait pendant tout le travail sur cette branche.

**Cause** — il precede la branche : verification faite en remisant les
modifications, il tombe a l'identique sur `main`. C'est l'activation de
`marcq-handball` par la PR #54 qui a fait franchir le seuil, +128 Mo. Un volume
n'ajoute aucune memoire.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le plafond de `fabrique.yml` est un avertissement,
pas un refus, et il n'a donc bloque personne au moment ou il a ete franchi. Soit
la RAM du serveur le supporte et le plafond est a relever, soit elle ne le
supporte pas et une app est a desactiver ; personne ne peut le trancher depuis
le depot.


## Anomalies — deuxieme passe, PRP 08

La PR de la premiere passe a ete fusionnee ; le harnais imposant le meme nom de
branche, le travail du PRP 08 repart de `main` sous ce meme nom, et son journal
est donc ce fichier. Une branche, une entree — mais deux passes.

### 4. Le PRP 08 definit une cle que son propre test interdit

**Symptome** — le chantier C fixe `CONSENTEMENT.prenom` ; trois paragraphes plus
haut, la section « Ce qui est verifiable a la fin » exige un test qui echoue si
la sous-chaine `prenom` apparait dans `web/vue-rejoindre.js`, commentaires
compris. Le code dicte par le PRP ne passe pas le test dicte par le PRP.

**Cause** — quatrieme occurrence de la meme famille en deux branches (voir les
anomalies 2 a 6 de la premiere passe et de la branche `...-phases-1yk38x`) : un
PRP est relu comme de la prose, pas execute, et rien ne verifie que ses blocs de
code passent ses blocs de test.

**Consequence tenue** — la cle est renommee `surLeTelephone`. La chaine visible
par l'enfant, elle, garde son accent : « prénom » ne contient pas la sous-chaine
ASCII cherchee. Le texte du PRD est donc intact et le garde-fou tient.

**Detecte par** — `auteur`

**Action** — `contrat` — la relecture d'un PRP devrait inclure une passe
mecanique : appliquer ses blocs de code et lancer ses blocs de test avant de
figer le document.

### 5. Le PRP 08 donne deux motifs de pseudonyme differents

**Symptome** — la section « Produit » annonce
`/^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u`, le chantier C
`/^[\p{L}\p{N} '\-_]{2,16}$/u`. Le premier accepte le point, que le serveur
refuse ; le second l'interdit et admet l'apostrophe, que le serveur accepte.

**Cause** — le listing de synthese des interfaces a ete ecrit avant que le
chantier ne tranche, et n'a pas ete repris.

**Consequence tenue** — c'est le motif du chantier C qui est retenu, seul aligne
sur le serveur. Un motif client plus large ferait tomber une saisie valide a
l'ecran en 400 au retour du reseau, ce qui est le pire des deux mondes.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP qui recapitule une interface en tete et la
tranche en chantier doit soit renvoyer au chantier, soit se relire.

### 6. Un garde-fou de style ne gardait plus rien depuis le PRP 04

**Symptome** — le test « toute classe posee par un ecran existe dans style.css »
etait vert sur des ecrans dont il ne lisait aucune classe. Elargi aux deux
ecritures reellement employees, il a immediatement attrape `.bloc-equipe`.

**Cause** — il ne cherchait que les affectations litterales
`className = '...'`. Les ecrans depuis le PRP 04 passent par un raccourci
`el('tag', 'classes')` : sur eux, le motif ne trouvait rien, la boucle
parcourait zero classe, et le test passait. C'est le pire mode de defaillance
d'un garde-fou — il ne se tait pas, il rassure.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un test qui parcourt une collection extraite par
expression reguliere doit affirmer que la collection n'est pas vide, fichier par
fichier. Le seuil global `classes.size >= 20` existait deja et n'a rien vu :
trois fichiers bien lus suffisaient a l'atteindre.

### 7. La confirmation de suppression s'effacait a la seconde ou elle s'affichait

**Symptome** — dans un vrai navigateur, la suppression du pseudonyme fonctionne
— le serveur perd bien la fiche — mais l'enfant ne voit rien : le bloc entier
disparait et emporte le message « Ton nom a ete retire du classement. ».

**Cause** — le gestionnaire appelait `ctx.rafraichir()` apres coup. L'ecran se
remonte, `monterSuppression` ne rend plus rien puisqu'il n'y a plus de nom a
retirer, et le message part avec le bloc. Le PRP 03 avait pourtant nomme ce
piege pour le bloc du prenom — « on ne remonte pas l'ecran apres coup, la
confirmation disparaitrait avec lui » — et rien ne l'a rappele ici.

**Detecte par** — `relecture` — aucun test unitaire ne pouvait le voir ; c'est le
parcours dans un navigateur reel, pilote par Playwright, qui l'a montre.

**Action** — `comportement` — les tests de ce depot prouvent des fonctions pures
et des sources ; ce qu'un montage fait apres un appel reseau leur echappe par
construction. Un parcours de bout en bout, meme court, doit accompagner tout
chantier qui touche a un gestionnaire d'evenement.

### 8. Le serveur local sert le JavaScript qu'il avait au demarrage

**Symptome** — apres correction de l'anomalie 7, le parcours Playwright montrait
toujours l'ancien comportement. Trois iterations perdues a chercher un defaut
dans du code deja corrige.

**Cause** — `//go:embed web` fige la coque dans le binaire : un `go run .` lance
avant l'edition continue de servir l'ancien fichier. C'est la contrepartie —
voulue — de l'absence de chaine de construction.

**Detecte par** — `auteur`

**Action** — `contrat` — a ecrire dans le `README` de l'app, section
« Developpement » : toute modification de `web/` demande de relancer `go run .`.
Evident une fois su, invisible avant.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-06 à 13:13 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 455 | 0,00 $ |
| Écriture de cache | 1 222 570 | 5,65 $ |
| Lecture de cache | 57 377 118 | 27,22 $ |
| Sortie | 243 923 | 4,63 $ |
| **Total** | **58 844 066** | **37,50 $ — 32,56 €** |

**Ce qui coûte**

- **241 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 704 jetons, écrits une fois par session puis relus à chaque
  échange : 13 128 960 jetons de relecture, 22 % de tout ce qui a été relu.
- **Croissance** — 54 704 jetons relus au premier appel qui relise
  quelque chose, 483 568 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 58844066 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54704 0 374
2 principal claude-opus-5 1047 54704 178
3 principal claude-opus-5 2487 55751 183
4 principal claude-opus-5 19032 58238 659
5 principal claude-opus-5 2185 77270 379
6 principal claude-opus-5 22097 79455 847
7 principal claude-opus-5 10222 101552 560
8 principal claude-opus-5 8684 111774 2195
9 principal claude-opus-5 9816 120458 139
10 principal claude-opus-5 4469 130274 345
11 principal claude-opus-5 6265 134743 348
12 principal claude-opus-5 3085 141008 124
13 principal claude-opus-5 1361 144093 758
14 principal claude-opus-5 829 145454 861
15 principal claude-opus-5 1095 146283 389
16 principal claude-opus-5 953 147378 5591
17 principal claude-opus-5 5645 148331 705
18 principal claude-opus-5 786 153976 4252
19 principal claude-opus-5 4631 154762 502
20 principal claude-opus-5 581 159393 118
21 principal claude-opus-5 280 159974 129
22 principal claude-opus-5 153 160254 234
23 principal claude-opus-5 4990 160407 1117
24 principal claude-opus-5 1147 165397 149
25 principal claude-opus-4-7 40398 0 126
26 principal claude-opus-4-7 205 40398 86
27 principal claude-opus-4-7 3562 40603 144
28 principal claude-opus-4-7 1019 44165 333
29 principal claude-opus-4-7 1436 45184 260
30 principal claude-opus-4-7 332 46620 197
31 principal claude-opus-5 229 166544 3765
32 principal claude-opus-4-7 3111 46952 2008
33 principal claude-opus-4-7 2061 50063 1507
34 principal claude-opus-4-7 1543 52124 69
35 principal claude-opus-5 3820 166773 11303
36 principal claude-opus-5 11356 170593 5206
37 principal claude-opus-5 5653 181949 758
38 principal claude-opus-5 1144 187602 578
39 principal claude-opus-5 710 188746 684
40 principal claude-opus-5 848 189456 99
41 principal claude-opus-5 116 190304 116
42 principal claude-opus-5 471 190420 233
43 principal claude-opus-5 290 190891 124
44 principal claude-opus-5 503 191181 598
45 principal claude-opus-5 4202 191684 11586
46 principal claude-opus-5 11631 195886 125
47 principal claude-opus-5 4874 207517 761
48 principal claude-opus-5 819 212391 233
49 principal claude-opus-5 4581 213210 10107
50 principal claude-opus-5 10161 217791 592
51 principal claude-opus-5 5002 227952 463
52 principal claude-opus-5 1023 232954 2348
53 principal claude-opus-5 2380 233977 221
54 principal claude-opus-5 338 236357 1091
55 principal claude-opus-5 1114 236695 567
56 principal claude-opus-5 623 237809 771
57 principal claude-opus-5 829 238432 96
58 principal claude-opus-5 863 239261 259
59 principal claude-opus-5 1734 240124 271
60 principal claude-opus-5 4129 241858 3594
61 principal claude-opus-4-7 43442 27342 9068
62 principal claude-opus-4-7 11393 70784 166
63 principal claude-opus-5 3649 245987 1125
64 principal claude-opus-4-7 1231 82177 427
65 principal claude-opus-5 1180 249636 458
66 principal claude-opus-5 513 250816 141
67 principal claude-opus-5 792 251329 320
68 principal claude-opus-5 490 252121 202
69 principal claude-opus-5 1147 252611 1710
70 principal claude-opus-4-7 4660 27342 196
71 principal claude-opus-4-7 3349 32002 113
72 principal claude-opus-5 1815 253758 2238
73 principal claude-opus-4-7 2872 35351 1857
74 principal claude-opus-5 2301 255573 632
75 principal claude-opus-4-7 2323 38223 256
76 principal claude-opus-4-7 928 40546 71
77 principal claude-opus-5 695 257874 492
78 principal claude-opus-4-7 2159 41474 168
79 principal claude-opus-4-7 1951 43633 614
80 principal claude-opus-5 550 258569 873
81 principal claude-opus-5 931 259119 128
82 principal claude-opus-5 329 260050 699
83 principal claude-opus-4-7 1455 45584 2853
84 principal claude-opus-5 739 260379 95
85 principal claude-opus-5 3607 261118 1416
86 principal claude-opus-5 1487 264725 270
87 principal claude-opus-5 469 266212 104
88 principal claude-opus-5 272 266681 75
89 principal claude-opus-5 88 266953 941
90 principal claude-opus-5 8 267982 334
91 principal claude-opus-5 2120 267990 172
92 principal claude-opus-5 683 270110 269
93 principal claude-opus-5 327 270793 252
94 principal claude-opus-5 687 271120 291
95 principal claude-opus-5 3204 271807 594
96 principal claude-opus-5 710 275011 103
97 principal claude-opus-5 344 275824 108
98 principal claude-opus-5 386 276168 343
99 principal claude-opus-5 888 276554 561
100 principal claude-opus-5 922 277442 1032
101 principal claude-opus-5 1336 278364 671
102 principal claude-opus-5 8278 280371 459
103 principal claude-opus-5 4759 288649 231
104 principal claude-opus-5 10085 293408 110
105 principal claude-opus-5 12059 303493 227
106 principal claude-opus-5 3098 315552 208
107 principal claude-opus-5 586 318650 228
108 principal claude-opus-5 6986 319236 396
109 principal claude-opus-5 2825 326222 357
110 principal claude-opus-5 1751 329047 95
111 principal claude-opus-5 967 330798 1229
112 principal claude-opus-5 1886 331765 187
113 principal claude-opus-5 439 333651 1370
114 principal claude-opus-5 1652 334090 322
115 principal claude-opus-5 380 335742 1290
116 principal claude-opus-5 1348 336122 93
117 principal claude-opus-5 133 337470 115
118 principal claude-opus-5 1241 337603 1307
119 principal claude-opus-5 1375 338844 124
120 principal claude-opus-5 408 340219 924
121 principal claude-opus-4-7 6043 27342 120
122 principal claude-opus-4-7 202 33385 89
123 principal claude-opus-4-7 4337 33587 92
124 principal claude-opus-4-7 4922 37924 2818
125 principal claude-opus-4-7 2944 42846 1296
126 principal claude-opus-5 960 340627 10926
127 principal claude-opus-5 10981 341587 1717
128 principal claude-opus-5 2149 352568 488
129 principal claude-opus-5 646 354717 7184
130 principal claude-opus-5 7242 355363 164
131 principal claude-opus-5 180 362605 1123
132 principal claude-opus-5 1184 362785 135
133 principal claude-opus-5 185 363969 1850
134 principal claude-opus-5 2033 364154 149
135 principal claude-opus-4-7 16831 27342 148
136 principal claude-opus-4-7 6467 44173 2135
137 principal claude-opus-4-7 6383 50640 1205
138 principal claude-opus-4-7 1332 57023 197
139 principal claude-opus-4-7 304 58355 151
140 principal claude-opus-5 229 366187 8141
141 principal claude-opus-5 8202 366416 985
142 principal claude-opus-5 1159 374618 543
143 principal claude-opus-4-7 190 58659 4950
144 principal claude-opus-5 607 375777 3972
145 principal claude-opus-5 4029 376384 154
146 principal claude-opus-5 178 380413 161
147 principal claude-opus-5 539 380591 350
148 principal claude-opus-5 789 381130 96
149 principal claude-opus-5 1259 381919 298
150 principal claude-opus-5 1711 383178 115
151 principal claude-opus-5 172 384889 848
152 principal claude-opus-5 864 385061 252
153 principal claude-opus-5 313 385925 114
154 principal claude-opus-5 164 386238 1861
155 principal claude-opus-5 1894 386402 149
156 principal claude-opus-4-7 14290 27342 1526
157 principal claude-opus-5 229 388296 1392
158 principal claude-opus-4-7 1771 41632 85
159 principal claude-opus-4-7 6976 43403 121
160 principal claude-opus-5 1429 388525 136
161 principal claude-opus-4-7 6435 50379 79
162 principal claude-opus-5 585 389954 292
163 principal claude-opus-5 356 390539 1641
164 principal claude-opus-5 1705 390895 531
165 principal claude-opus-4-7 4327 56814 2094
166 principal claude-opus-4-7 2231 61141 188
167 principal claude-opus-4-7 1030 63372 121
168 principal claude-opus-5 595 392600 270
169 principal claude-opus-5 334 393195 1081
170 principal claude-opus-5 1145 393529 720
171 principal claude-opus-5 781 394674 823
172 principal claude-opus-4-7 1382 64402 3765
173 principal claude-opus-5 9563 395455 2057
174 principal claude-opus-4-7 4222 65784 1295
175 principal claude-opus-5 6844 405018 744
176 principal claude-opus-5 791 411862 700
177 principal claude-opus-5 716 412653 1958
178 principal claude-opus-5 5983 413369 890
179 principal claude-opus-5 952 419352 123
180 principal claude-opus-5 611 420304 211
181 principal claude-opus-5 310 420915 1458
182 principal claude-opus-5 1501 421225 149
183 principal claude-opus-4-7 12086 27342 126
184 principal claude-opus-4-7 214 39428 122
185 principal claude-opus-4-7 179 39642 85
186 principal claude-opus-4-7 119 39821 95
187 principal claude-opus-4-7 9719 39940 134
188 principal claude-opus-4-7 3881 49659 89
189 principal claude-opus-4-7 1633 53540 92
190 principal claude-opus-4-7 6407 55173 147
191 principal claude-opus-4-7 6461 61580 89
192 principal claude-opus-5 229 422726 2215
193 principal claude-opus-4-7 4337 68041 650
194 principal claude-opus-4-7 1246 72378 211
195 principal claude-opus-5 6194 422955 884
196 principal claude-opus-5 4085 429149 1821
197 principal claude-opus-5 1871 433234 390
198 principal claude-opus-4-7 1128 73624 3943
199 principal claude-opus-4-7 3979 74752 69
200 principal claude-opus-5 445 435105 1405
201 principal claude-opus-5 1460 435550 136
202 principal claude-opus-5 235 437010 1384
203 principal claude-opus-4-7 8102 27342 142
204 principal claude-opus-4-7 230 35444 110
205 principal claude-opus-4-7 176 35674 79
206 principal claude-opus-5 1420 437245 627
207 principal claude-opus-4-7 505 35850 95
208 principal claude-opus-4-7 11403 36355 93
209 principal claude-opus-4-7 3111 47758 89
210 principal claude-opus-4-7 6403 50869 139
211 principal claude-opus-5 794 438665 186
212 principal claude-opus-4-7 1271 57272 132
213 principal claude-opus-5 1969 439459 74
214 principal claude-opus-5 143 441428 126
215 principal claude-opus-5 0 441737 195
216 principal claude-opus-5 350 441737 1282
217 principal claude-opus-5 1479 442087 123
218 principal claude-opus-5 193 443566 220
219 principal claude-opus-5 573 443759 848
220 principal claude-opus-5 912 444332 166
221 principal claude-opus-5 339 445244 591
222 principal claude-opus-5 946 445583 1851
223 principal claude-opus-4-7 4380 58543 9128
224 principal claude-opus-4-7 9554 62923 69
225 principal claude-opus-5 3119 446529 466
226 principal claude-opus-5 483 449648 153
227 principal claude-opus-5 161 450131 113
228 principal claude-opus-5 131 450292 206
229 principal claude-opus-5 230 450423 412
230 principal claude-opus-5 453 450653 340
231 principal claude-opus-5 422046 37125 178
232 principal claude-opus-5 9723 451106 294
233 principal claude-opus-5 632 460829 170
234 principal claude-opus-5 1335 461461 1511
235 principal claude-opus-5 1703 462796 809
236 principal claude-opus-5 1388 464499 713
237 principal claude-opus-5 987 465887 2905
238 principal claude-opus-5 6773 466874 964
239 principal claude-opus-5 9613 473647 275
240 principal claude-opus-5 308 483260 200
241 principal claude-opus-5 264 483568 211
-->
<!-- /cout -->
