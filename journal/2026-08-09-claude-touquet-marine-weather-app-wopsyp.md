# 2026-08-09 — claude/touquet-marine-weather-app-wopsyp

Branche : `claude/touquet-marine-weather-app-wopsyp`
Périmètre : estran
Mode : `chaud`

## Anomalies

Aucune anomalie. Rédaction du PRD de `estran` (météo marine et jauge de
marée pour Étaples–Le Touquet, palier `private`), après un brainstorming
avec l'utilisateur sur le nom, la source des données (Open-Meteo plutôt que
l'extraction de meteoconsult.fr), l'inclusion du vent/état de mer, et la
stack (Go, alignée sur le reste de la fabrique). Recherche faite
(`WebSearch`/`WebFetch`) pour confirmer la disponibilité réelle des sources
de données avant de les inscrire au PRD : Open-Meteo et Open-Meteo Marine
sont gratuites et sans clé, le SHOM ne l'est pas pour son API de marée
(abonnement payant), point qu'`Evidence on Hand` documente comme décision
ouverte plutôt que comme fait acquis. Aucun code écrit à ce stade — seul
`PRODUCT.md` est livré, conformément à `memory/produit.md` (« un répertoire
qui ne porte que ces documents est légitime »).

---

Reprise en mode `/livrer` pour construire et mettre en ligne `estran`.
Écriture de `prp/00-ossature.md` d'abord, pour trancher ce que le PRD
laissait ouvert : la source de marée. Recherche réelle (`WebSearch`/`WebFetch`,
appels effectifs aux API) plutôt que suppositions — le SHOM confirmé payant
pour son API, `api-maree.fr` retenu (gratuit, clé simple par inscription,
dérivé SHOM), mais Étaples/Le Touquet absents de son catalogue de ports :
`berck-plage-fort-mahon` (~20 km au sud, même façade ouverte) est le point
le plus proche disponible, retenu comme approximation assumée et documentée
(PRODUCT.md § Evidence on Hand, plutôt que présentée comme une précision non
tenue — principe 2 du PRD). `PRODUCT.md` corrigé en conséquence dans le même
esprit qu'une correction ordinaire (`memory/produit.md`) : la ligne « à
arbitrer à l'implémentation » est celle qui bouge.

Application écrite en Go (confirmé par l'utilisateur), alignée sur
`cadran`/`pilabelle` : `meteo.go` (client Open-Meteo + Open-Meteo Marine,
fusion des séries horaires par horodatage), `maree.go` (client api-maree.fr,
`ErrCleAbsente` distinct d'une panne fournisseur), `domaine.go` (vues JSON,
calcul de la jauge en fraction de TEMPS écoulé entre deux extrema, pas de
hauteur), `cache.go` (dernier connu générique, « dégrader jamais casser »).
19 tests (`go test ./...`), tous verts, y compris la fusion météo/vagues
avec Marine API en panne partielle et l'encadrement d'extrema. Page en
`web/` (HTML/CSS/JS, aucune dépendance externe, police système), thème
« nuit sur la Manche » avec un seul signal ambre réservé à la position de
marée. Détecteur statique `impeccable` lancé à chaque écriture de fichier
`web/`, aucun avertissement.

Vérification réelle avant de committer plutôt qu'une confiance aveugle aux
tests : `go run .` lancé localement, endpoints interrogés en vrai (les API
Open-Meteo et api-maree.fr répondent depuis ce conteneur), puis rendu
vérifié dans un navigateur — mobile et desktop — avec captures d'écran,
y compris la jauge de marée avec des données simulées (aucune vraie clé
`API_MAREE_KEY` disponible dans cette session) et son état d'erreur.

### 1. Outil Playwright MCP inutilisable tel quel dans cet environnement

**Symptôme** — `browser_navigate`/`browser_resize` échouent avec « Chromium
distribution 'chrome' is not found at /opt/google/chrome/chrome ».
**Cause** — le serveur MCP Playwright de cette session est configuré sur le
canal `chrome`, absent de l'image ; seul le Chromium embarqué par Playwright
(`/opt/pw-browsers/chromium-*`) est présent, comme l'indique le contexte de
session sur `PLAYWRIGHT_BROWSERS_PATH`.
**Detecte par** — `auteur`
**Action** — `outillage` — contournement trouvé (le paquet npm global
`playwright` avec `executablePath` explicite vers le Chromium embarqué), mais
l'outil MCP par défaut ne fonctionne pas pour une vérification visuelle
directe ; un administrateur devrait aligner sa configuration sur le
Chromium déjà présent plutôt que sur un canal `chrome` absent.

### 2. Délai de 8 s trop juste pour les appels sortants

**Symptôme** — premier appel à `/api/previsions` en test local terminé en
échec (« context deadline exceeded ») à 8,002 s, alors qu'un appel isolé à
la même API répondait en moins d'une seconde.
**Cause** — `handlePrevisions`/`handleMaree` font chacun deux appels HTTP
sortants séquentiels (prévisions+marine, ou extrema+niveaux) sous un même
contexte à 8 s ; un démarrage à froid de connexion (constaté sur le premier
appel seulement) suffit à dépasser ce budget.
**Detecte par** — `auteur`
**Action** — `rien` — délai porté à 12 s, second appel et tous les suivants
réussis sans lenteur mesurable.

Décidé seul, non escaladé (aucun des trois arrêts du mode `/livrer` ne
s'applique) : activer `estran` (`enabled: true`) dans la MÊME pull request
que le code, plutôt que la séquence prudente en deux PR décrite dans
`memory/ajouter-une-app.md`. Même raisonnement déjà vérifié et exécuté sur
`pilabelle` (journal du 2026-08-08) : `deploy` ne tourne jamais sur une
`pull_request`, seulement sur un `push` vers `main` après fusion, et `build`
(qui publie l'image) précède toujours `deploy` dans le même run via `needs`
— le risque qu'évite la séquence en deux PR (compose référençant une image
absente du registre) ne peut donc pas se produire ici, et `deploy` porte de
toute façon son propre contrôle (`docker buildx imagetools inspect` sur
chaque image du compose) avant tout redéploiement.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-09 à 12:49 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 4 716 | 0,01 $ |
| Écriture de cache | 380 847 | 1,35 $ |
| Lecture de cache | 36 698 622 | 10,98 $ |
| Sortie | 128 899 | 1,93 $ |
| **Total** | **37 213 084** | **14,27 $ — 12,40 €** |

**Ce qui coûte**

- **155 appel(s) au modèle** — un par réponse, outils compris —, dont 8 par des sous-agents — 134 847 jetons, 0,00 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 265 jetons, écrits une fois par session puis relus à chaque
  échange : 9 820 690 jetons de relecture, 26 % de tout ce qui a été relu.
- **Tours courts** — 61 des 155 tours (39 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 5,48 $, soit 38 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 265 jetons relus au premier appel qui relise
  quelque chose, 360 258 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 37213084 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 67265 0 76
2 principal claude-sonnet-5 605 67265 1466
3 principal claude-sonnet-5 4770 67870 593
4 principal claude-sonnet-5 7897 72640 194
5 principal claude-sonnet-5 264 80537 240
6 principal claude-sonnet-5 4565 80801 201
7 principal claude-sonnet-5 3642 85366 4262
8 principal claude-sonnet-5 4731 89008 2405
9 principal claude-sonnet-5 3884 93739 153
10 principal claude-sonnet-5 1093 97623 659
11 principal claude-sonnet-5 3111 98716 251
12 principal claude-sonnet-5 630 101827 2388
13 principal claude-sonnet-5 4737 102457 125
14 principal claude-sonnet-5 133 107194 128
15 principal claude-sonnet-5 4435 107327 223
16 principal claude-sonnet-5 438 111762 91
17 principal claude-sonnet-5 3258 112200 850
18 principal claude-sonnet-5 943 115458 431
19 principal claude-sonnet-5 892 116401 3358
20 principal claude-sonnet-5 3453 117293 2869
21 principal claude-sonnet-5 2922 120746 1016
22 principal claude-sonnet-5 9254 123668 376
23 principal claude-sonnet-5 954 132922 251
24 principal claude-sonnet-5 24988 133876 404
25 principal claude-sonnet-5 1597 158864 429
26 principal claude-sonnet-5 1012 160461 244
27 principal claude-sonnet-5 426 161473 154
28 principal claude-sonnet-5 1397 161899 722
29 principal claude-sonnet-5 820 163296 114
30 principal claude-sonnet-5 361 164116 560
31 principal claude-sonnet-5 965 164477 1151
32 principal claude-sonnet-5 1249 165442 135
33 principal claude-sonnet-5 629 166691 657
34 principal claude-sonnet-5 1246 167320 139
35 principal claude-sonnet-5 351 168566 141
36 principal claude-sonnet-5 2630 168917 816
37 principal claude-sonnet-5 1170 171547 406
38 principal claude-sonnet-5 2496 173123 5751
39 principal claude-sonnet-5 8037 175619 404
40 principal claude-sonnet-5 914 183656 351
41 principal claude-sonnet-5 1965 184570 1532
42 principal claude-sonnet-5 1749 186535 212
43 principal claude-sonnet-5 482 188284 1163
44 principal claude-sonnet-5 1667 188766 4301
45 principal claude-sonnet-5 19021 190433 3095
46 principal claude-sonnet-5 5527 209454 1123
47 principal claude-sonnet-5 1592 214981 632
48 principal claude-sonnet-5 1583 216573 719
49 principal claude-sonnet-5 1581 218156 312
50 principal claude-sonnet-5 325 219737 96
51 principal claude-sonnet-5 111 220062 2644
52 principal claude-sonnet-5 2699 220173 324
53 principal claude-sonnet-5 3377 222872 699
54 principal claude-sonnet-5 779 226249 733
55 principal claude-sonnet-5 789 227028 336
56 principal claude-sonnet-5 1999 227817 566
57 principal claude-sonnet-5 1981 229816 112
58 principal claude-sonnet-5 1680 231797 170
59 principal claude-sonnet-5 246 233477 237
60 principal claude-sonnet-5 717 233723 550
61 principal claude-sonnet-5 8686 234440 1158
62 principal claude-sonnet-5 1207 243126 614
63 principal claude-sonnet-5 663 244333 4960
64 principal claude-sonnet-5 5099 244996 1315
65 principal claude-sonnet-5 1879 250095 5030
66 principal claude-sonnet-5 5273 251974 376
67 principal claude-sonnet-5 610 257247 432
68 principal claude-sonnet-5 608 257857 3393
69 principal claude-sonnet-5 3443 258465 4128
70 principal claude-sonnet-5 4256 261908 1833
71 principal claude-sonnet-5 2229 266164 359
72 principal claude-sonnet-5 513 268393 770
73 principal claude-sonnet-5 922 268906 4989
74 principal claude-sonnet-5 5141 269828 5418
75 principal claude-sonnet-5 5615 274969 1619
76 principal claude-sonnet-5 1672 280584 919
77 principal claude-sonnet-5 972 282256 265
78 principal claude-sonnet-5 318 283228 311
79 principal claude-sonnet-5 364 283546 609
80 principal claude-sonnet-5 662 283910 202
81 principal claude-sonnet-5 621 284572 248
82 principal claude-sonnet-5 1116 285193 126
83 principal claude-sonnet-5 141 286309 144
84 principal claude-sonnet-5 147 286450 155
85 principal claude-sonnet-5 7098 286597 666
86 principal claude-sonnet-5 717 293695 2636
87 principal claude-sonnet-5 2688 294412 634
88 principal claude-sonnet-5 4343 297100 578
89 principal claude-sonnet-5 630 301443 3213
90 principal claude-sonnet-5 3264 302073 1724
91 principal claude-sonnet-5 1776 305337 1467
92 principal claude-sonnet-5 1611 307113 333
93 principal claude-sonnet-5 388 308724 135
94 principal claude-sonnet-5 1151 309112 154
95 principal claude-sonnet-5 538 310263 327
96 principal claude-sonnet-5 3216 310801 189
97 principal claude-sonnet-5 1655 314017 607
98 principal claude-sonnet-5 658 315672 170
99 principal claude-sonnet-5 222 316330 128
100 principal claude-sonnet-5 162 316552 1027
101 principal claude-sonnet-5 1078 316714 213
102 principal claude-sonnet-5 2003 317792 218
103 principal claude-sonnet-5 439 319795 236
104 principal claude-sonnet-5 274 320234 285
105 principal claude-sonnet-5 2270 320508 1346
106 principal claude-sonnet-5 1357 322778 369
107 principal claude-sonnet-5 1965 324135 403
108 principal claude-sonnet-5 1001 326100 1029
109 principal claude-sonnet-5 1077 327101 709
110 principal claude-sonnet-5 1010 328178 317
111 principal claude-sonnet-5 1857 329188 86
112 principal claude-sonnet-5 155 331045 331
113 principal claude-sonnet-5 1135 331200 878
114 principal claude-sonnet-5 947 332335 675
115 principal claude-sonnet-5 745 333282 500
116 principal claude-sonnet-5 876 334027 171
117 principal claude-sonnet-5 190 334903 797
118 principal claude-sonnet-5 835 335093 191
119 principal claude-sonnet-5 821 335928 668
120 principal claude-sonnet-5 2285 336749 1375
121 principal claude-sonnet-5 1763 339034 110
122 principal claude-sonnet-5 339 340797 243
123 principal claude-sonnet-5 424 341136 576
124 principal claude-sonnet-5 591 341560 638
125 principal claude-sonnet-5 818 342151 255
126 principal claude-sonnet-5 272 342969 109
127 principal claude-sonnet-5 165 343241 178
128 principal claude-sonnet-5 225 343406 109
129 principal claude-sonnet-5 452 343631 941
130 principal claude-sonnet-5 1880 344083 285
131 principal claude-sonnet-5 346 345963 262
132 principal claude-sonnet-5 402 346309 253
133 principal claude-sonnet-5 370 346711 89
134 principal claude-sonnet-5 2262 347081 2821
135 principal claude-sonnet-5 2919 349343 233
136 principal claude-sonnet-5 418 352262 134
137 principal claude-sonnet-5 210 352680 112
138 principal claude-sonnet-5 506 352890 155
139 principal claude-sonnet-5 813 353396 102
140 principal claude-sonnet-5 833 354209 146
141 principal claude-sonnet-5 617 355042 666
142 principal claude-sonnet-5 1261 355659 187
143 principal claude-sonnet-5 569 356920 130
144 principal claude-sonnet-5 1176 357489 388
145 principal claude-sonnet-5 1223 358665 296
146 principal claude-sonnet-5 370 359888 271
147 principal claude-sonnet-5 345 360258 289
148 agent claude-haiku-4-5-20251001 11265 0 4
149 agent claude-haiku-4-5-20251001 1480 11265 2
150 agent claude-haiku-4-5-20251001 307 12745 2
151 agent claude-haiku-4-5-20251001 5128 13052 2
152 agent claude-haiku-4-5-20251001 849 18180 3
153 agent claude-haiku-4-5-20251001 528 19029 4
154 agent claude-haiku-4-5-20251001 723 19557 2
155 agent claude-haiku-4-5-20251001 370 20280 4
-->
<!-- /cout -->
