# 2026-08-23 — claude/ramure-v2-refonte-suite-w2epqj

Branche : `claude/ramure-v2-refonte-suite-w2epqj`
Périmètre : ramure-v2, fabrique
Mode : `chaud`

Suite de `journal/2026-08-22-claude-ramure-v2-refonte-1q0zsr.md`, dont les
anomalies 20, 21 et 23 sont le reste a traiter : le troisieme choix de forme
(les 548 px libres du mur), le rognage du mur, et les deux defauts d'outillage
laisses ouverts parce qu'ils debordaient de la demande d'alors.

## Anomalies

### 1. L'axe de couverture navigateur se taisait au lieu de rendre KO

**Symptome** — `./scripts/revue.sh ramure-v2` rendait « couverture Go 82,0 % » et
rien d'autre. Le client TypeScript de l'app — 15 modules, 16 fichiers de test —
n'etait mesure par aucune revue. Rien dans la sortie ne disait qu'une moitie de
l'app n'avait pas ete lue.

**Cause** — l'axe reconnaissait une seule chaine de test client, `node --test
tests/*.test.js` a la racine de l'app. C'est la chaine des trois apps qui
l'utilisent, et elle a l'avantage de n'installer aucune dependance. Un client en
TypeScript ne peut pas l'utiliser — node n'execute pas de `.ts` — et passe donc
par vitest, sous `web/`. Le `ls tests/*.test.js` echouait, la branche entiere
etait sautee, et `web_pct` restait vide : la variable vide traversait tout le
chemin jusqu'au manifeste, ou `revue_couverture_web` n'etait tout simplement
jamais posee. Un axe qui ne trouve pas ce qu'il cherche rend `ok`.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le defaut n'est pas d'ignorer vitest, c'est de rendre
`ok` en n'ayant rien mesure. Une app qui echappe a un axe doit le FAIRE SAVOIR ;
ici l'app avait du reporter la barre dans son propre `test.sh`, ce qui donne deux
barres pour une mesure, dont une seule alimente le cliquet.

### 2. Les diagnostics du serveur de langage Go sont tous faux dans le conteneur cloud

**Symptome** — a la premiere edition d'un fichier Go, seize diagnostics
identiques : « go.work requires go >= 1.25.0 (running go 1.24.7) », sur des
fichiers qui compilent et dont les tests passent dans le meme conteneur.

**Cause** — deux Go dans l'image. Le shell voit `go1.25.0` ; `gopls`, lance par
le harnais, en trouve un autre en 1.24.7 et refuse de charger les paquets. Aucun
diagnostic Go n'est donc exploitable dans une session cloud, ni les vrais ni les
faux.

**Detecte par** — `auteur`

**Action** — `outillage` — un LSP qui rend seize faux constats sur un depot sain
coute plus qu'il ne rapporte : on apprend a ne plus lire ses sorties, et le jour
ou il en rend un vrai il est ignore. Meme mecanique que les faux « introuvable »
du 22 aout.

### 3. La section qui garde la trace d'un choix citait un artefact qui n'existe plus

**Symptome** — la section « Montre » de la critique du 23 aout pointait un
artefact publie lors d'un essai anterieur, remplace depuis : l'adresse ne rend
plus rien. Elle chiffrait par ailleurs la tuile de la variante A a 373 px, valeur
d'esquisse presentee comme une mesure ; la variante reellement construite donne
377 px. Deux couts de variante manquaient encore : les 293 px de vide lateral que
A rouvre, et le nombre de pochettes que chaque variante tient sans retrecir —
18 aujourd'hui, 6 avec A comme avec B.

**Cause** — les maquettes sont jetables, la trace ne l'est pas, et les deux ont
ete ecrites dans le desordre : la section a ete redigee avant que les variantes
soient baties, donc avec les chiffres de l'esquisse et l'adresse de l'essai
precedent. Republier un artefact lui donne une adresse neuve, et rien ne relie
l'ancienne a la nouvelle.

**Detecte par** — `relecture`

**Action** — `comportement` — la section qui cite un artefact s'ecrit APRES sa
publication, et ne porte que des chiffres releves sur la maquette construite. Un
document de decision qui pointe dans le vide vaut moins qu'une absence de
document : il fait croire que la trace existe.

### 4. Le message de commit est ecrit par le moteur le moins cher, et personne ne le relit

**Symptome** — le premier commit de la branche porte « L'axe detale maintenant
vitest » pour « detecte », et « une chaine reconue » pour « reconnue ». Le corps
reste comprehensible, mais c'est le document ou le raisonnement est cense
survivre a la fusion.

**Cause** — le greffier tourne sur `haiku`, choix delibere et justifie : son
travail est mecanique et son verdict binaire. Ecrire le message ne l'est pas —
c'est la seule partie redactionnelle de sa sequence, et elle est confiee au
moteur le moins outille pour elle. Aucun controle ne lit ce texte : `pret.sh`
verifie l'etape, pas la prose.

**Detecte par** — `auteur`

**Action** — `arbitrage` — non corrige ici : reecrire un commit deja pousse pour
deux fautes coute une reecriture d'historique, ce qui est cher pour du cosmetique.
Mais le partage est a revoir — soit l'appelant fournit la premiere ligne et le
corps, soit le greffier cesse de rediger. Aujourd'hui le fait de le lui laisser
n'a jamais ete decide, il a ete herite.

### 5. Le correctif reproduisait son propre defaut dans le cas frere

**Symptome** — l'axe « couverture » corrige criait bien quand une app avait un
client non mesure ET du Go mesure. Dans le cas plus grave — rien de mesure du
tout, ni Go ni navigateur, alors qu'un client existe — il retombait sur `skip`,
qui s'affiche en VERT. Le pire des deux cas sortait plus vert que le moins pire.

**Cause** — la ligne de repli « rien de mesurable » preexistait au correctif et
n'a pas ete relue avec lui. Elle est juste pour une app qui n'a reellement rien a
mesurer, et fausse des qu'un client existe. Corriger un defaut nomme — « un axe
qui se tait ressemble a un axe qui passe » — sans relire les autres sorties du
meme axe le laisse vivant a cote de son correctif.

**Detecte par** — `relecture`

**Action** — `comportement` — un correctif se relit sur TOUTES les sorties de la
fonction qu'il touche, pas seulement sur le chemin qu'il ajoute. Aucune des dix
apps n'atteint ce cas aujourd'hui — toutes ont un `go.mod` — donc l'execution ne
pouvait pas le montrer.

### 6. Le pourcentage lu n'etait pas prouve venir de l'execution en cours

**Symptome** — l'axe lit `coverage/coverage-summary.json` apres avoir lance les
tests du client. Rien ne verifiait que ce fichier venait de CETTE execution : une
app dont le script `test` ne demande pas de couverture sort en 0 sans rien
produire, et le rapport laisse par une execution anterieure — `test.sh`, une
autre branche, un autre commit — serait lu comme la mesure du jour, puis serre
dans `app.yml` par `--releve`.

**Cause** — la detection ne verifie que la presence de vitest et d'un script
`test`, jamais que ce script produit une couverture. Le cliquet se serait alors
referme sur un chiffre que personne n'a mesure, et il ne se desserre pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — meme famille que les quatre « verts silencieux » de
`memory/revue.md` : un artefact qu'on lit sans l'avoir vu naitre n'est pas une
mesure. Le rapport est desormais efface avant la mesure, ce qui fait retomber son
absence sur le KO deja ecrit.

### 7. La duplication qui compte est celle que l'axe duplication ne voit pas

**Symptome** — le garde-fou d'orthographe ecrit aujourd'hui pour `internal/api`
partage 102 lignes non vides, identiques, avec celui de `internal/arbre`. Les
deux ont deja diverge le jour meme : le neuf sait lire un message compose par
concatenation, l'ancien non — un futur message concatene dans `arbre` ne serait
compare a rien, et le garde-fou se tairait.

**Cause** — l'axe duplication exclut `*_test.go`, choix defendable pour des
tests ordinaires. Un garde-fou n'est pas un test ordinaire : c'est du code
d'analyse, et sa copie diverge comme n'importe quelle copie. Ecrire le second en
partant du premier etait la facon la plus sure de le rendre correct tout de
suite, et la plus sure de le rendre faux ensuite.

**Detecte par** — `relecture`

**Action** — `arbitrage` — tranche ici : la partie commune est mutualisee plutot
que backportee, parce que backporter refait la copie a l'identique et remet la
prochaine divergence a plus tard. Reste ouvert, et non traite dans cette branche :
faut-il que l'axe duplication regarde les fichiers de test qui portent un
garde-fou ? Le distinguer d'un test ordinaire demande un critere que personne n'a.

### 8. Le detecteur mutualise n'etait pas couvert par le meta-test qui le surveille

**Symptome** — la mutualisation faite, la revue passe au rouge : couverture Go
81,2 % contre une barre a 82. Le coupable est la fonction de parcours du code,
`ExtraireAppels`, a 0 %. Les deux autres fonctions du paquet sont a 100 %.

**Cause** — elle n'etait exercee que par ses appelants, dans les tests de `api`
et de `arbre`. Le profil d'un paquet ne compte que ce que ses PROPRES tests
executent : la fonction etait donc largement jouee, et comptee nulle part. Un
detecteur non couvert par le meta-test est exactement ce que le meta-test existe
pour interdire.

**Detecte par** — `relecture`

**Action** — `rien` — repare, et la barre a joue le jour meme ou elle a ete
posee : elle a bloque le code qui venait de la poser. C'est le meilleur usage
qu'on pouvait en attendre.

### 9. J'ai modifie la seule piece qui peut echouer en ouvert sans lancer ses tests

**Symptome** — l'axe de couverture reecrit, relu, corrige de trois constats et
verifie a l'execution sur trois apps ; `./test-revue.sh`, la suite dediee que la
fabrique a payee d'un job de CI a elle seule, n'a ete lancee qu'au moment ou son
nom est apparu dans la liste des controles de la pull request. Elle passait — 36
cas sur 36 — mais aucun de ces 36 ne touchait le chemin ajoute.

**Cause** — `pret.sh` lance les tests des apps TOUCHEES ; `scripts/revue.sh`
n'est l'app de personne, et sa suite vit a la racine sous un nom que rien ne
relie a lui. Le raccourci mental « j'ai verifie a l'execution, donc c'est
verifie » a fait le reste : trois executions reelles prouvent que le chemin
nominal marche, et ne disent rien des chemins d'echec, qui sont precisement ce
que cette suite tient.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `pret.sh` devrait exiger `./test-revue.sh` des que
`scripts/revue.sh` est modifie, comme il exige le test d'une app touchee. Cinq
cas neufs couvrent desormais la seconde chaine cliente : la mesure lue, la barre
posee, les tests rouges, le rapport perime jamais pris pour la mesure du jour, et
le client qu'aucune chaine ne mesure.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 11:57 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 882 | 0,00 $ |
| Écriture de cache | 1 119 731 | 6,06 $ |
| Lecture de cache | 32 763 470 | 15,40 $ |
| Sortie | 139 102 | 3,34 $ |
| **Total** | **34 023 185** | **24,81 $ — 21,54 €** |

**Ce qui coûte**

- **322 appel(s) au modèle** — un par réponse, outils compris —, dont 170 par des sous-agents — 8 588 532 jetons, 7,19 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  69 428 jetons, écrits une fois par session puis relus à chaque
  échange : 10 483 628 jetons de relecture, 31 % de tout ce qui a été relu.
- **Tours courts** — 227 des 322 tours (70 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 12,70 $, soit 51 % de la facture.
  Dont 155 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 9, dont la plus longue fait 45 tours,
  relit 48 840 jetons par tour en moyenne et coûte 0,94 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 69 428 jetons relus au premier appel qui relise
  quelque chose, 255 777 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 34023185 -->
<!-- cout-agent-max: 45 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 69428 0 339
2 principal claude-opus-5 4307 69428 390
3 principal claude-opus-5 1404 73735 387
4 principal claude-opus-5 3106 75139 312
5 principal claude-opus-5 5109 78245 291
6 principal claude-opus-5 1760 83354 115
7 principal claude-opus-5 4229 85114 1400
8 principal claude-opus-5 2972 89343 227
9 principal claude-opus-5 483 92315 283
10 principal claude-opus-5 3752 92798 1436
11 principal claude-opus-5 2540 96550 247
12 principal claude-opus-5 2558 99090 927
13 principal claude-opus-5 1081 101648 321
14 principal claude-opus-5 2518 102729 1025
15 principal claude-opus-5 2151 105247 169
16 principal claude-opus-5 2554 107398 262
17 principal claude-opus-5 3090 109952 1321
18 principal claude-opus-5 2910 113042 313
19 principal claude-opus-5 558 115952 156
20 principal claude-opus-5 392 116510 108
21 principal claude-opus-5 1234 116902 447
22 principal claude-opus-5 466 118136 1982
23 principal claude-opus-5 2373 118602 404
24 principal claude-opus-5 859 120975 645
25 principal claude-opus-5 1252 121834 573
26 principal claude-opus-5 1259 123086 1155
27 principal claude-opus-5 3275 124345 5072
28 principal claude-opus-5 5015 127620 672
29 principal claude-opus-5 1370 132635 257
30 principal claude-opus-5 277 134005 234
31 principal claude-opus-5 882 134282 147
32 principal claude-opus-5 363 135164 558
33 principal claude-opus-5 936 135527 468
34 principal claude-opus-5 1754 136463 1160
35 principal claude-opus-5 1580 138217 163
36 principal claude-opus-5 803 139797 1393
37 principal claude-opus-5 2958 140600 357
38 principal claude-opus-5 487 143558 2129
39 principal claude-opus-5 2160 144045 232
40 principal claude-opus-5 582 146205 319
41 principal claude-opus-5 1314 146787 678
42 principal claude-opus-5 914 148101 127
43 principal claude-opus-5 1385 149015 958
44 principal claude-opus-5 1105 150400 539
45 principal claude-opus-5 1498 151505 1802
46 principal claude-opus-5 1952 153003 644
47 principal claude-opus-5 732 154955 797
48 principal claude-opus-5 1855 155687 626
49 principal claude-opus-5 910 157542 147
50 principal claude-opus-5 466 158452 263
51 principal claude-opus-5 3645 158918 185
52 principal claude-opus-5 219 162563 659
53 principal claude-opus-5 695 162782 755
54 principal claude-opus-5 1842 163477 289
55 principal claude-opus-5 4025 165319 358
56 principal claude-opus-5 1829 169344 1088
57 principal claude-opus-5 1837 171173 1252
58 principal claude-opus-5 2950 173010 1721
59 principal claude-opus-5 2114 175960 171
60 principal claude-opus-5 207 178074 80
61 principal claude-opus-5 130909 49343 485
62 principal claude-opus-5 1096 180252 483
63 principal claude-opus-5 2142 181348 487
64 principal claude-opus-5 603 183490 444
65 principal claude-opus-5 480 184093 999
66 principal claude-opus-5 1283 184573 119
67 principal claude-opus-5 604 185856 480
68 principal claude-opus-4-7 7284 29208 242
69 principal claude-opus-4-7 355 36492 82
70 principal claude-opus-5 583 186460 79
71 principal claude-opus-5 2092 185856 343
72 principal claude-opus-5 1369 187948 2012
73 principal claude-opus-4-7 19385 36847 3543
74 principal claude-opus-5 3331 189317 1529
75 principal claude-opus-4-7 5327 56232 2116
76 principal claude-opus-5 1919 192648 165
77 principal claude-opus-5 201 194567 47
78 principal claude-opus-5 331 194768 121
79 principal claude-opus-5 494 195099 291
80 principal claude-opus-5 394 195593 66
81 principal claude-opus-4-7 10667 29208 616
82 principal claude-opus-5 1777 195099 191
83 principal claude-opus-4-7 741 39875 94
84 principal claude-opus-4-7 935 40616 1098
85 principal claude-opus-5 771 196876 2159
86 principal claude-opus-5 2190 197647 114
87 principal claude-opus-5 150 199837 304
88 principal claude-opus-5 405 199987 78
89 principal claude-opus-5 141 200392 30
90 principal claude-opus-5 66 200533 205
91 principal claude-opus-5 846 200599 650
92 principal claude-opus-5 1262 201445 521
93 principal claude-opus-5 557 202707 561
94 principal claude-opus-5 910 203264 1173
95 principal claude-opus-5 1401 204174 170
96 principal claude-opus-5 272 205745 30
97 principal claude-opus-5 404 206017 125
98 principal claude-opus-5 245 206421 442
99 principal claude-opus-5 544 206666 28
100 principal claude-opus-5 91 207210 30
101 principal claude-opus-5 66 207301 1036
102 principal claude-opus-5 1426 207367 36
103 principal claude-opus-5 283 208829 55
104 principal claude-opus-5 746 209112 558
105 principal claude-opus-5 672 209858 41
106 principal claude-opus-5 325 210530 111
107 principal claude-opus-5 298 210855 134
108 principal claude-opus-5 1263 210855 138
109 principal claude-opus-5 2355 212118 2089
110 principal claude-opus-5 2128 214473 2234
111 principal claude-opus-5 2622 216601 1726
112 principal claude-opus-5 1757 219223 253
113 principal claude-opus-5 537 220980 102
114 principal claude-opus-5 368 221517 352
115 principal claude-opus-5 2716 221517 302
116 principal claude-opus-5 578 224233 755
117 principal claude-opus-5 1547 224811 759
118 principal claude-opus-5 874 226358 46
119 principal claude-opus-5 330 227232 30
120 principal claude-opus-5 66 227562 46
121 principal claude-opus-5 1405 227562 869
122 principal claude-opus-5 900 228967 1031
123 principal claude-opus-5 1416 229867 52
124 principal claude-opus-5 336 231283 112
125 principal claude-opus-5 495 231619 51
126 principal claude-opus-4-7 17697 29208 158
127 principal claude-opus-4-7 286 46905 97
128 principal claude-opus-4-7 2315 47191 126
129 principal claude-opus-5 1361 231619 209
130 principal claude-opus-4-7 3486 49506 209
131 principal claude-opus-4-7 339 52992 126
132 principal claude-opus-4-7 1088 53331 406
133 principal claude-opus-5 699 232980 542
134 principal claude-opus-5 933 233679 61
135 principal claude-opus-4-7 570 54419 1294
136 principal claude-opus-5 345 234612 111
137 principal claude-opus-5 262 234957 12
138 principal claude-opus-5 1086 234957 272
139 principal claude-opus-5 1551 236043 3343
140 principal claude-opus-5 3536 237594 496
141 principal claude-opus-5 1563 241130 137
142 principal claude-opus-5 1881 242693 249
143 principal claude-opus-5 279 244574 101
144 principal claude-opus-5 222 244853 93
145 principal claude-opus-5 1462 245075 236
146 principal claude-opus-5 469 246537 261
147 principal claude-opus-5 1045 247006 508
148 principal claude-opus-5 1784 248051 97
149 principal claude-opus-5 1456 249835 408
150 principal claude-opus-5 2782 251291 1353
151 principal claude-opus-5 1704 254073 2173
152 principal claude-opus-5 2754 255777 1283
153 agent claude-haiku-4-5-20251001 5373 6940 1
154 agent claude-haiku-4-5-20251001 1747 12313 2
155 agent claude-haiku-4-5-20251001 588 14060 2
156 agent claude-haiku-4-5-20251001 359 14648 4
157 agent claude-haiku-4-5-20251001 784 15007 129
158 agent claude-haiku-4-5-20251001 311 15791 2
159 agent claude-haiku-4-5-20251001 12307 0 4
160 agent claude-haiku-4-5-20251001 1540 12307 2
161 agent claude-haiku-4-5-20251001 549 13847 2
162 agent claude-haiku-4-5-20251001 452 14396 2
163 agent claude-haiku-4-5-20251001 584 14848 750
164 agent claude-haiku-4-5-20251001 1603 15432 2
165 agent claude-haiku-4-5-20251001 884 17035 5
166 agent claude-haiku-4-5-20251001 412 17919 4
167 agent claude-haiku-4-5-20251001 341 18331 2
168 agent claude-opus-5 13015 0 174
169 agent claude-opus-5 1507 13015 139
170 agent claude-opus-5 1151 14522 17
171 agent claude-opus-5 6812 15673 3
172 agent claude-opus-5 5800 22485 3
173 agent claude-opus-5 3019 28285 2
174 agent claude-opus-5 3436 31304 726
175 agent claude-opus-5 814 34740 17
176 agent claude-opus-5 811 35554 4
177 agent claude-opus-5 2183 36365 194
178 agent claude-opus-5 224 38548 199
179 agent claude-opus-5 728 38772 17
180 agent claude-opus-5 3620 39500 423
181 agent claude-opus-5 4351 43120 2237
182 agent claude-opus-5 5038 47471 2
183 agent claude-opus-5 3217 52509 2
184 agent claude-opus-5 2235 55726 3
185 agent claude-opus-5 3845 57961 3
186 agent claude-opus-5 1705 61806 10
187 agent claude-opus-5 3752 63511 2704
188 agent claude-opus-5 2785 67263 2
189 agent claude-opus-5 3638 70048 1
190 agent claude-sonnet-5 18977 0 3
191 agent claude-sonnet-5 2379 18977 4
192 agent claude-sonnet-5 959 21356 17
193 agent claude-sonnet-5 4966 22315 3
194 agent claude-sonnet-5 9162 27281 4
195 agent claude-sonnet-5 2285 36443 2
196 agent claude-sonnet-5 2074 38728 2
197 agent claude-sonnet-5 508 40802 2
198 agent claude-sonnet-5 426 41310 2
199 agent claude-sonnet-5 634 41736 2
200 agent claude-sonnet-5 397 42370 2
201 agent claude-sonnet-5 438 42767 196
202 agent claude-sonnet-5 422 43205 2
203 agent claude-sonnet-5 385 43627 2
204 agent claude-sonnet-5 376 44012 17
205 agent claude-sonnet-5 315 44388 17
206 agent claude-sonnet-5 363 44703 2
207 agent claude-sonnet-5 395 45066 17
208 agent claude-sonnet-5 319 45461 17
209 agent claude-sonnet-5 315 45780 2
210 agent claude-sonnet-5 352 46095 17
211 agent claude-sonnet-5 318 46447 17
212 agent claude-sonnet-5 311 46765 2
213 agent claude-sonnet-5 1296 47076 3
214 agent claude-sonnet-5 295 48372 5
215 agent claude-sonnet-5 964 48667 2
216 agent claude-sonnet-5 2787 49631 3
217 agent claude-sonnet-5 4315 52418 2
218 agent claude-sonnet-5 516 56733 2
219 agent claude-sonnet-5 171 57249 20
220 agent claude-sonnet-5 4008 57420 2
221 agent claude-sonnet-5 166 61428 20
222 agent claude-sonnet-5 224 61594 2
223 agent claude-sonnet-5 494 61818 2
224 agent claude-sonnet-5 714 62312 2
225 agent claude-sonnet-5 861 63026 2
226 agent claude-sonnet-5 815 63887 8
227 agent claude-sonnet-5 184 64702 16
228 agent claude-sonnet-5 974 64886 2
229 agent claude-sonnet-5 386 65860 115
230 agent claude-sonnet-5 410 66246 2
231 agent claude-sonnet-5 849 66656 20
232 agent claude-sonnet-5 1989 67505 1
233 agent claude-sonnet-5 1695 69494 7
234 agent claude-sonnet-5 415 71189 1
235 agent claude-opus-5 33388 0 1
236 agent claude-opus-5 4740 33388 415
237 agent claude-opus-5 8135 38128 313
238 agent claude-opus-5 2794 46263 17
239 agent claude-opus-5 2485 49057 6
240 agent claude-opus-5 5559 51542 3
241 agent claude-opus-5 4341 57101 2
242 agent claude-opus-5 1979 61442 17
243 agent claude-opus-5 336 63421 4
244 agent claude-opus-5 1622 63757 2
245 agent claude-opus-5 4516 65379 666
246 agent claude-opus-5 5897 69895 25477
247 agent claude-opus-5 101367 0 3
248 agent claude-opus-5 1253 101367 87
249 agent claude-opus-5 180 102620 17
250 agent claude-opus-5 192 102800 17
251 agent claude-opus-5 253 102992 2
252 agent claude-opus-5 377 103245 20
253 agent claude-opus-5 1118 103622 3
254 agent claude-opus-5 1722 104740 2
255 agent claude-opus-5 1678 106462 3
256 agent claude-opus-5 1532 108140 6
257 agent claude-opus-5 1372 109672 241
258 agent claude-opus-5 1486 111044 5
259 agent claude-opus-5 2017 112530 17
260 agent claude-opus-5 432 114547 16
261 agent claude-opus-5 2372 114979 3
262 agent claude-opus-5 1111 117351 3
263 agent claude-opus-5 98764 19860 6
264 agent claude-opus-5 2587 118624 17
265 agent claude-opus-5 894 121211 1714
266 agent claude-opus-5 1953 122105 20
267 agent claude-opus-5 1990 124058 3
268 agent claude-haiku-4-5-20251001 5178 6940 2
269 agent claude-haiku-4-5-20251001 2058 12118 2
270 agent claude-haiku-4-5-20251001 467 14176 2
271 agent claude-haiku-4-5-20251001 10024 14643 2
272 agent claude-haiku-4-5-20251001 2732 24667 2
273 agent claude-haiku-4-5-20251001 1034 27399 2
274 agent claude-haiku-4-5-20251001 298 28433 2
275 agent claude-sonnet-5 18946 0 5
276 agent claude-sonnet-5 2379 18946 2
277 agent claude-sonnet-5 8749 21325 5
278 agent claude-sonnet-5 329 30074 3
279 agent claude-sonnet-5 3173 30403 3
280 agent claude-sonnet-5 740 33576 7660
281 agent claude-sonnet-5 8604 34316 2
282 agent claude-sonnet-5 2250 42920 4
283 agent claude-sonnet-5 1888 45170 2
284 agent claude-sonnet-5 2521 47058 14
285 agent claude-sonnet-5 2914 49579 457
286 agent claude-sonnet-5 589 52493 17
287 agent claude-sonnet-5 313 53082 2
288 agent claude-sonnet-5 214 53395 20
289 agent claude-sonnet-5 248 53609 2
290 agent claude-sonnet-5 3192 53857 2
291 agent claude-sonnet-5 175 57049 20
292 agent claude-sonnet-5 572 57224 2
293 agent claude-sonnet-5 280 57796 2
294 agent claude-sonnet-5 2244 58076 2
295 agent claude-sonnet-5 1293 60320 2
296 agent claude-sonnet-5 225 61613 1
297 agent claude-sonnet-5 50252 7828 2
298 agent claude-sonnet-5 5705 58080 5
299 agent claude-sonnet-5 417 63785 17
300 agent claude-sonnet-5 1152 64202 2
301 agent claude-sonnet-5 597 65354 5
302 agent claude-sonnet-5 1187 65951 2
303 agent claude-sonnet-5 400 67138 10
304 agent claude-sonnet-5 507 67538 3
305 agent claude-sonnet-5 1086 68045 1
306 agent claude-haiku-4-5-20251001 4896 6940 1
307 agent claude-haiku-4-5-20251001 1422 11836 2
308 agent claude-haiku-4-5-20251001 578 13258 1
309 agent claude-haiku-4-5-20251001 10519 13836 2
310 agent claude-haiku-4-5-20251001 449 24355 2
311 agent claude-haiku-4-5-20251001 285 24804 2
312 agent claude-haiku-4-5-20251001 12276 0 814
313 agent claude-haiku-4-5-20251001 1835 12276 2
314 agent claude-haiku-4-5-20251001 707 14111 368
315 agent claude-haiku-4-5-20251001 422 14818 2
316 agent claude-haiku-4-5-20251001 891 15240 1
317 agent claude-haiku-4-5-20251001 392 16131 2
318 agent claude-haiku-4-5-20251001 1941 16523 2
319 agent claude-haiku-4-5-20251001 917 18464 526
320 agent claude-haiku-4-5-20251001 772 19381 2
321 agent claude-haiku-4-5-20251001 1336 20153 2
322 agent claude-haiku-4-5-20251001 293 21489 2
-->
<!-- /cout -->
