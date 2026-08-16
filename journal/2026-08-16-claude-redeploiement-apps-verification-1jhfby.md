# 2026-08-16 — claude/redeploiement-apps-verification-1jhfby

Branche : `claude/redeploiement-apps-verification-1jhfby`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « redéploie toutes les apps maintenant que la CI est
réparée, et vérifie que toutes les dernières évolutions sont bien livrées ».
La vérification vient en premier et elle tient dans une comparaison : pour
chaque app, l'arbre `apps/<nom>` au commit épinglé dans `versions.yml` contre
le même arbre sur `main`. Trois apps diffèrent — `estran`, `renaissance-gym`,
`hello-world` —, les six autres sont identiques au bit près. Le redéploiement
lui-même a buté sur un levier qui n'en était pas un.

## Anomalies

### 1. Les fusions passées pendant la panne de CI ne sont jamais reconstruites

**Symptome** — `estran` tourne en ligne dans une version d'avant sa navigation
temporelle : `versions.yml` l'épingle sur `7c18d32`, alors que `main` porte
trois commits de plus sur `apps/estran` — 1 666 lignes ajoutées, dont
`main_test.go`, `prp/01-navigation-temporelle.md` et la refonte de l'échelle
typographique. Même écart pour `renaissance-gym` (`RETROSPECTIVE.md` et ses
tests) et `hello-world` (un test unitaire). Rien ne le signalait : `main` est
vert, les PR sont fusionnées, le dépôt a l'air à jour.

**Cause** — le déploiement est accroché à l'événement `push` sur `main`, et à
lui seul. Les deux fusions concernées — #133 le 16 août à 12:18 et #130 à
12:30 — ont bien poussé sur `main`, mais leurs runs sont tombés dans la fenêtre
où aucun runner n'était attribué (entrée du 16 août, anomalie 1) : `contrat` et
`detect` en échec en deux secondes, `build` et `deploy` sautés. La CI réparée à
13:03, **rien ne les rejoue** — le déclencheur était l'événement, et l'événement
est passé. Un `git push` ne se rejoue pas ; une panne d'infrastructure laisse
donc des fusions définitivement non construites, et le dépôt ne porte aucune
trace de l'écart puisque `versions.yml` n'est écrit que par les déploiements qui
ont eu lieu.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'écart est calculable sans réseau et sans jeton :
`git rev-parse <épingle>:apps/<nom>` contre le même arbre sur `HEAD` dit en une
comparaison si l'image en ligne correspond au code fusionné. Le mettre dans
`--check` demande cependant l'historique, que le clone superficiel de la CI n'a
pas ; c'est `pret.sh` — qui tourne en local, sur un dépôt complet — qui est la
bonne place, en avertissement.

### 2. L'entrée « toutes » reconstruisait tout et ne déployait rien

**Symptome** — le workflow expose exactement le levier qu'appelle la situation :
`workflow_dispatch` avec `toutes: reconstruire toutes les apps`. Actionné, il
aurait publié les neuf images et laissé la production intacte — `versions.yml`
inchangé, `compose.yaml` inchangé, webhook jamais appelé —, en sortant **vert**.

**Cause** — `detect` traite bien le cas (`tout=1`, liste complète, `deploy=true`)
et `build` publie, puisque sa condition de poussée est `event_name != pull_request`.
Mais le job `deploy` s'ouvrait sur `github.event_name == 'push'` : le dispatch
n'y entrait pas. Les deux moitiés de la chaîne ne s'accordaient pas sur ce que
`toutes` veut dire — construire pour l'une, mettre en ligne pour l'autre. Le
levier de rattrapage de la fabrique, celui-là même qu'on actionne après une
panne de CI, s'arrêtait à mi-chemin sans le dire.

**Detecte par** — `auteur`

**Action** — `rien` — réparé ici : `deploy` admet `workflow_dispatch` à côté de
`push`, la garde qui compte restant `ref == refs/heads/main`, commune aux deux
événements.

### 3. Le dépôt passé en public a réactivé une règle qui bloque la CI elle-même

**Symptome** — fusion faite, les neuf images construites et publiées, puis le
déploiement échoue sur son avant-dernier pas : `GH013: Repository rule
violations found for refs/heads/main — 2 of 2 required status checks are
expected`, quatre fois de suite, puis « impossible d'enregistrer les versions
sur main — rien n'est deploye ». Le webhook est sauté, `versions.yml` garde les
anciens commits, la production tourne inchangée. Tout le reste du run est vert.

**Cause** — le règlement de branche de `main` exige deux vérifications, et il
les exige **de toute poussée**, pas seulement d'une pull request. Or la CI
pousse elle-même sur `main` : c'est ainsi qu'elle enregistre la version des
images qu'elle vient de publier, et c'est le seul écrit de toute la chaîne. Une
poussée directe ne rapporte aucune vérification — elles ne peuvent jamais être
satisfaites, la règle refuse donc **par construction**. Le règlement ne porte
aucun acteur en dérogation : `bypass_actors` est vide.

Ce n'est pas une régression du dépôt et rien n'a changé dans le workflow depuis
le dernier déploiement réussi. Ce qui a changé, c'est la **visibilité** : un
règlement de branche n'est pas appliqué sur un dépôt privé de compte personnel
gratuit, et le devient à la seconde où le dépôt passe en public. L'arbitrage
du matin — passer en public pour retrouver des runners — a donc réveillé une
règle jusque-là inerte, et l'a fait sans un mot. L'entrée précédente notait
cette règle comme cassée dans l'autre sens : elle exigeait un job renommé,
`tests-du-generateur`, ce qui bloquait toutes les pull requests. Les noms ont
été corrigés depuis, et c'est ce qui a laissé passer la fusion — la règle
correcte bloque maintenant la moitié suivante de la chaîne.

Le contournement, trouvé après coup : l'épinglage n'a pas besoin d'être écrit
**par la CI**, il a besoin d'être **sur `main`**. Une pull request qui porte le
`./init.sh --pin` des neuf apps y arrive par la porte que la règle laisse
ouverte — celle qu'elle protège au lieu de la fermer. À la fusion, `detect` ne
voit aucune app changer mais voit `compose.yaml` changer : c'est la distinction
que le workflow écrit noir sur blanc, « il y a quelque chose à redéployer »
n'est pas « on a construit une image ». `test` et `build` sautent, l'étape
d'épinglage saute avec eux, et donc l'étape de poussée aussi ; sans rien à
écrire, il ne reste que la vérification des images et l'appel du webhook. Le
déploiement passe sans qu'une ligne soit poussée sur `main` hors pull request.
C'est le geste que le contrat décrit déjà pour revenir en arrière — « remettre
ici le commit précédent puis lancer ./init.sh » —, employé pour avancer.

**Detecte par** — `CI`

**Action** — `contrat` — le contournement livre, il ne répare pas, et il n'y a
rien à réparer : **la dérogation que j'ai recommandée n'existe pas.** Une liste
d'acteurs en dérogation n'est offerte qu'aux dépôts appartenant à une
organisation, et `billbob-space` est un compte personnel ; « GitHub Actions » ne
figure de toute façon pas parmi les acteurs éligibles. J'ai envoyé l'utilisateur
vers un écran qui ne pouvait pas répondre, et c'est lui qui l'a constaté — la
recommandation était formulée avec l'aplomb d'une vérification, sans en être
une. **Vérifier qu'un réglage existe avant de l'indiquer**, surtout quand on
n'a pas les droits de l'ouvrir soi-même.

Le seul autre levier serait de retirer les vérifications du règlement, donc de
renoncer au verrou qui protège une stack partagée. **Arbitrage rendu : on garde
le verrou et on achève la livraison à la main.** La procédure passe donc du
statut d'improvisation à celui de règle : `memory/livraison.md`, appelé depuis
le contrat. Elle disparaîtra si le dépôt rejoint une organisation.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 16:13 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 277 | 0,00 $ |
| Écriture de cache | 658 158 | 3,61 $ |
| Lecture de cache | 25 128 067 | 12,43 $ |
| Sortie | 76 011 | 1,67 $ |
| **Total** | **25 862 513** | **17,71 $ — 15,38 €** |

**Ce qui coûte**

- **145 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 918 jetons, écrits une fois par session puis relus à chaque
  échange : 8 772 192 jetons de relecture, 34 % de tout ce qui a été relu.
- **Tours courts** — 69 des 145 tours (47 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 7,28 $, soit 41 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 918 jetons relus au premier appel qui relise
  quelque chose, 266 429 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 25862513 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 60918 0 300
2 principal claude-opus-5 4449 60918 365
3 principal claude-opus-5 3951 65367 611
4 principal claude-opus-5 7337 69318 607
5 principal claude-opus-5 3593 76655 392
6 principal claude-opus-5 1126 80248 398
7 principal claude-opus-5 1257 81374 807
8 principal claude-opus-5 7789 82631 720
9 principal claude-opus-5 1417 90420 1161
10 principal claude-opus-5 5467 91837 1675
11 principal claude-opus-5 4659 97304 253
12 principal claude-opus-5 547 101963 255
13 principal claude-opus-5 404 102510 107
14 principal claude-opus-5 676 102914 820
15 principal claude-opus-5 1481 103590 965
16 principal claude-opus-5 2063 105071 1735
17 principal claude-opus-5 2327 107134 204
18 principal claude-opus-5 511 109461 418
19 principal claude-opus-5 1674 109972 170
20 principal claude-opus-5 2241 111646 463
21 principal claude-opus-5 2305 113887 679
22 principal claude-opus-5 1147 116192 1377
23 principal claude-opus-5 1847 117339 219
24 principal claude-opus-5 524 119186 910
25 principal claude-opus-5 1000 119710 491
26 principal claude-opus-5 882 120710 1039
27 principal claude-opus-5 1077 121592 167
28 principal claude-opus-4-7 34434 0 106
29 principal claude-opus-4-7 151 34434 95
30 principal claude-opus-5 482 122669 248
31 principal claude-opus-4-7 226 34585 82
32 principal claude-opus-4-7 0 34434 247
33 principal claude-opus-4-7 5287 34811 84
34 principal claude-opus-5 341 123151 209
35 principal claude-opus-5 811 123492 86
36 principal claude-opus-5 480 124303 1304
37 principal claude-opus-5 1891 124783 267
38 principal claude-opus-5 6938 126674 896
39 principal claude-opus-4-7 15085 40098 3269
40 principal claude-opus-5 3808 133612 406
41 principal claude-opus-5 413 137420 139
42 principal claude-opus-4-7 20495 34434 4581
43 principal claude-opus-4-7 4686 55183 791
44 principal claude-opus-5 218 137833 998
45 principal claude-opus-5 233 139049 535
46 principal claude-opus-5 939 139282 94
47 principal claude-opus-5 111738 34989 320
48 principal claude-opus-5 814 146727 111
49 principal claude-opus-5 382 147541 261
50 principal claude-opus-5 338 147923 113
51 principal claude-opus-5 1839 148261 133
52 principal claude-opus-5 173 150100 228
53 principal claude-opus-5 2281 150273 238
54 principal claude-opus-5 671 152554 202
55 principal claude-opus-5 227 153225 147
56 principal claude-opus-5 223 153452 91
57 principal claude-opus-5 21 153766 376
58 principal claude-opus-5 1492 153787 408
59 principal claude-opus-5 439 155279 164
60 principal claude-opus-5 558 155718 242
61 principal claude-opus-5 368 156518 137
62 principal claude-opus-5 544 156886 286
63 principal claude-opus-5 915 157430 205
64 principal claude-opus-5 725 158345 241
65 principal claude-opus-5 529 159070 183
66 principal claude-opus-5 203 159599 355
67 principal claude-opus-5 386 159802 146
68 principal claude-opus-5 224 160188 109
69 principal claude-opus-5 240 160521 190
70 principal claude-opus-5 23543 160761 404
71 principal claude-opus-5 1020 184304 160
72 principal claude-opus-5 3627 185324 2063
73 principal claude-opus-5 2409 188951 1441
74 principal claude-opus-5 1920 191360 637
75 principal claude-opus-5 687 193280 473
76 principal claude-opus-5 566 193967 286
77 principal claude-opus-5 366 194533 1273
78 principal claude-opus-5 1328 194899 108
79 principal claude-opus-5 445 196227 879
80 principal claude-opus-5 1139 196672 1201
81 principal claude-opus-5 1787 197811 494
82 principal claude-opus-5 888 199598 814
83 principal claude-opus-5 208602 0 349
84 principal claude-opus-5 485 208602 466
85 principal claude-opus-5 527 209087 46
86 principal claude-opus-5 14574 201300 2287
87 principal claude-opus-5 2575 215874 97
88 principal claude-opus-5 385 218449 113
89 principal claude-opus-5 246 218834 434
90 principal claude-opus-5 1387 219080 118
91 principal claude-opus-5 737 220467 1221
92 principal claude-opus-5 1497 221204 316
93 principal claude-opus-5 714 222701 1006
94 principal claude-opus-5 1104 223415 89
95 principal claude-opus-5 204 224519 96
96 principal claude-opus-5 371 224723 1026
97 principal claude-opus-5 1314 225094 847
98 principal claude-opus-5 937 226408 179
99 principal claude-opus-5 627 227345 97
100 principal claude-opus-5 384 227972 82
101 principal claude-opus-5 6745 228356 155
102 principal claude-opus-5 443 235101 75
103 principal claude-opus-5 363 235544 287
104 principal claude-opus-5 371 235907 150
105 principal claude-opus-5 438 236278 139
106 principal claude-opus-5 427 236716 923
107 principal claude-opus-5 935 237143 98
108 principal claude-opus-5 386 238078 99
109 principal claude-opus-5 517 238464 306
110 principal claude-opus-5 390 238981 1342
111 principal claude-opus-5 1383 239371 137
112 principal claude-opus-5 1064 240754 343
113 principal claude-opus-5 358 241818 145
114 principal claude-opus-5 222 242176 324
115 principal claude-opus-5 563 242398 137
116 principal claude-opus-5 549 242961 205
117 principal claude-opus-5 1066 243510 171
118 principal claude-opus-5 191 244576 656
119 principal claude-opus-5 793 244767 146
120 principal claude-opus-5 222 245560 44
121 principal claude-opus-5 240 245826 217
122 principal claude-opus-5 953 246066 323
123 principal claude-opus-5 388 247019 343
124 principal claude-opus-5 506 247407 565
125 principal claude-opus-5 1437 247913 186
126 principal claude-opus-5 221 249350 494
127 principal claude-opus-5 152 250065 1136
128 principal claude-opus-5 17 251352 873
129 principal claude-opus-5 1578 251369 216
130 principal claude-opus-5 453 252947 1054
131 principal claude-opus-5 2284 253400 2168
132 principal claude-opus-5 2363 255684 1091
133 principal claude-opus-5 1196 258047 139
134 principal claude-opus-5 480 259243 2293
135 principal claude-opus-5 2470 259723 417
136 principal claude-opus-5 466 262193 292
137 principal claude-opus-5 342 262659 89
138 principal claude-opus-5 197 263001 101
139 principal claude-opus-5 286 263198 484
140 principal claude-opus-5 736 263484 92
141 principal claude-opus-5 342 264220 558
142 principal claude-opus-5 608 264562 91
143 principal claude-opus-5 200 265170 985
144 principal claude-opus-5 1059 265370 96
145 principal claude-opus-5 446 266429 93
-->
<!-- /cout -->
