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

---

### 3. La clé api-maree.fr pouvait fuiter dans les journaux d'erreur

**Symptôme** — la revue de sécurité automatique déclenchée après le commit
signale que `maree.go` construit l'URL des deux appels api-maree.fr avec
`key=<API_MAREE_KEY>` dans la chaîne de requête, puis la transmet à
`recupererJSON`, qui la réimprimait telle quelle dans ses erreurs — ces
erreurs remontant jusqu'aux `log.Printf` de `main.go`, la clé aurait fini en
clair dans les journaux (sortie standard) à la première panne réseau.
**Cause** — deux fuites, pas une seule : le message d'erreur explicite
(`fmt.Errorf("%s : statut %d", url, ...)`) et surtout `*url.Error`, que
`http.Client.Do` renvoie déjà rempli de l'URL complète demandée — un simple
`%w` sur cette erreur aurait suffi à réimprimer la clé même sans jamais
nommer `url` explicitement.
**Detecte par** — `relecture`
**Action** — `garde-fou` — `recupererJSON` (`meteo.go`) ne journalise plus
jamais la chaîne de requête : `sansRequete()` la retire avant tout message
d'erreur, `causeSansURL()` déballe `*url.Error` pour n'en garder que la
cause. Deux tests verrouillent le comportement (`TestSansRequete_RetireLaCle`,
`TestRecupererJSON_ErreurNeContientJamaisLaCle` — ce dernier vérifie sur une
vraie erreur réseau, pas seulement sur le message construit à la main).
Rien dans ce dépôt ne détecte aujourd'hui une clé qui fuiterait par un autre
chemin qu'un appel HTTP échoué : un grep de journaux en CI serait le
garde-fou générique, absent pour l'instant.

---

Retour d'usage réel après mise en ligne : « la lisibilité de l'app est
moyenne, la police est trop petite et le contraste faible » ; demande
d'ajouter la vitesse du vent et la probabilité de pluie à la prévision.
Vérification faite avant de coder : ces deux données étaient déjà présentes
dans `/api/previsions` et rendues dans chaque carte horaire — la demande
« ajoute » se lisait donc comme une conséquence du premier problème (police
0,72 rem, couleur `--sable-300` à ~3,7:1 de contraste sur le fond des
cartes, sous le texte n'importe où sur la page ne se voyait pas comme une
donnée à part entière), pas comme une fonctionnalité manquante.

Branche relancée depuis `main` (PR #108 déjà fusionnée) — même nom, entrée
de journal reprise, pas de nouvelle branche.

Corrections : `--sable-300` relevé de `#c9bb96` (~3,7:1) à `#ddd0ae` (~6,3:1
sur `--encre-700`, ~7,4:1 sur `--encre-900`) ; tailles de police remontées
d'un cran sur tout le texte secondaire (jauge, cartes horaires, tendance à
7 jours, pied de page) ; pluie et vent dans les cartes horaires sortis du
style « détail » discret (0,72 rem, `--sable-300`) pour rejoindre le poids
visuel de l'heure (0,95 rem, `--sable-100`/`--eau-400`, gras) — c'est cette
mise en retrait, plus que leur absence, qui les rendait invisibles.

### 4. Contraste insuffisant sur le texte secondaire, non détecté avant livraison

**Symptôme** — retour d'usage réel : lisibilité moyenne, police trop petite,
contraste faible ; pluie/vent perçus comme absents alors qu'ils étaient
rendus.
**Cause** — vérifié après coup (calcul de luminance relative, formule WCAG) :
`--sable-300` (`#c9bb96`) sur `--encre-700` donnait déjà 7,2:1, au-dessus du
seuil AA (4.5:1) — le ratio seul ne suffisait donc pas à expliquer le
signalement. Le levier réel était la taille de police (0,72–0,85 rem sur les
données les plus utiles, pluie et vent), qui rendait un texte numériquement
contrasté visuellement négligeable. La couleur a quand même été éclaircie
(9:1) en plus de l'agrandissement, par prudence plutôt que par mesure d'un
défaut confirmé.
**Detecte par** — `utilisateur`
**Action** — `garde-fou` — rien dans `impeccable` (détecteur statique lancé à
chaque écriture de fichier `web/`) n'a signalé le contraste insuffisant, il
n'a donc rattrapé ni le problème initial ni sa correction : un contrôle de
contraste WCAG sur les couleurs de texte déclarées serait le garde-fou qui
manque ici, pas seulement pour `estran`.

---

Demande explicite, dans le même échange : « je veux aussi voir les hauteurs
de marée dans la prévision à 7 jours ». Correction du PRD plutôt que capacité
hors périmètre : le PRD (§ Capabilities and Constraints, « Tendance à 7
jours ») annonçait déjà des « grandes lignes » jour par jour, la ligne
bouge pour dire ce qu'elle couvre désormais (`memory/produit.md`).

Choix d'implémentation : plutôt qu'un troisième appel HTTP, la fenêtre déjà
interrogée pour encadrer l'instant présent (jauge) est élargie à
`nombreJoursAffiches` (7) jours — un seul appel `tide-extrema` sert les deux
besoins. `grouperParJour` réduit les extrema à la plus haute pleine mer et la
plus basse basse mer par jour (un jour sans extremum retourné reste à `nil`
sur ses trois champs, jamais un zéro qui se lirait comme une mesure). La
fusion avec la tendance météo se fait côté client par date : `/api/previsions`
et `/api/maree` restent deux endpoints indépendants, dégradés chacun de son
côté, et la ligne de marée d'un jour disparaît simplement si l'une des deux
données manque — jamais une valeur inventée pour combler l'autre.

6 tests ajoutés (`grouperParJour`, `vueJoursMaree`, tendance dans
`RecupererA`), tous verts. Vérification visuelle faite avec les deux
endpoints simulés (`page.route` de Playwright) plutôt qu'avec le réseau réel
de ce conteneur, redevenu indisponible pendant cette étape — confirmé par un
`curl` direct vers `api.open-meteo.com` en échec, donc pas propre au code de
l'app. `Detecte par: auteur` — `Action: rien` : aucune conséquence sur le
code, seulement sur la méthode de vérification de cette étape.

---

Retour d'usage réel après mise en ligne (capture d'écran fournie) : « optimise
la taille pour obtenir des infos en écran plein » — la page laissait un grand
espace vide sous le pied, la capture faisant environ 1900 px pour un contenu
d'environ 1400 px. Vérifié avant de choisir un correctif : à cette hauteur de
contenu, presque tous les téléphones réels ont un viewport PLUS PETIT que le
contenu (mesuré ~900 px sur les gabarits courants) — la page a donc presque
toujours besoin de défiler, et l'espace vide de la capture vient d'un
viewport plus haut que la moyenne (tablette, ou zoom réduit), pas d'un défaut
général. Corrigé pour les deux cas à la fois plutôt que pour un seul :
`body` en colonne flexible, `main` en `flex: 1` avec `justify-content:
center` — sur un viewport plus grand que le contenu, l'espace se répartit
au-dessus et en dessous plutôt que de rester coincé sous le pied ; sur un
viewport plus petit, le centrage n'a aucun effet visible et la page défile
normalement, comme avant. Un premier essai plus agressif (échelle d'espacement
et tailles de police relevées de ~20 %) a été écarté : mesuré à 1680 px de
contenu contre 1400 px avant, il aggravait le défilement sur téléphone sans
rien apporter sur les grands viewports, où le centrage seul suffit déjà.
Vérifié par capture d'écran à deux hauteurs de viewport (892 px et 1700 px,
endpoints simulés) : le contenu défile normalement dans le premier cas, se
centre avec un espace réparti dans le second.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-09 à 16:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 5 147 | 0,01 $ |
| Écriture de cache | 1 947 655 | 6,45 $ |
| Lecture de cache | 111 778 332 | 33,12 $ |
| Sortie | 246 814 | 3,25 $ |
| **Total** | **113 977 948** | **42,85 $ — 37,21 €** |

**Ce qui coûte**

- **355 appel(s) au modèle** — un par réponse, outils compris —, dont 14 par des sous-agents — 241 379 jetons, 0,00 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 265 jetons, écrits une fois par session puis relus à chaque
  échange : 22 870 100 jetons de relecture, 20 % de tout ce qui a été relu.
- **Tours courts** — 158 des 355 tours (44 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 21,99 $, soit 51 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 265 jetons relus au premier appel qui relise
  quelque chose, 533 850 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 113977948 -->
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
148 principal claude-sonnet-5 4402 360603 106
149 principal claude-sonnet-5 307 365005 1125
150 principal claude-sonnet-5 1491 365312 285
151 principal claude-sonnet-5 373 366803 211
152 principal claude-sonnet-5 834 367176 142
153 principal claude-sonnet-5 302 368010 314
154 principal claude-sonnet-5 1688 368312 154
155 principal claude-sonnet-5 161 370000 110
156 principal claude-sonnet-5 1117 370161 1565
157 principal claude-opus-4-7 35788 28233 3747
158 principal claude-sonnet-5 2096 371278 477
159 principal claude-sonnet-5 3064 373374 291
160 principal claude-opus-4-7 4968 64021 718
161 principal claude-sonnet-5 411 376438 200
162 principal claude-sonnet-5 633 376849 1319
163 principal claude-sonnet-5 1386 377482 69
164 principal claude-opus-4-7 1512 68989 2333
165 principal claude-opus-4-7 36025 28233 5866
166 principal claude-opus-4-7 5911 64258 1113
167 principal claude-sonnet-5 331186 49060 997
168 principal claude-sonnet-5 1224 380246 1550
169 principal claude-sonnet-5 1603 381470 1008
170 principal claude-sonnet-5 1061 383073 280
171 principal claude-sonnet-5 470 384134 177
172 principal claude-sonnet-5 574 384604 600
173 principal claude-sonnet-5 628 385178 242
174 principal claude-sonnet-5 338 385806 142
175 principal claude-sonnet-5 144 386144 178
176 principal claude-sonnet-5 323 386288 279
177 principal claude-sonnet-5 719 386611 976
178 principal claude-sonnet-5 1050 387330 129
179 principal claude-sonnet-5 4353 388380 157
180 principal claude-sonnet-5 623 392733 144
181 principal claude-sonnet-5 345 393356 454
182 principal claude-sonnet-5 600 393701 498
183 principal claude-opus-4-7 4975 28233 104
184 principal claude-opus-4-7 152 33208 112
185 principal claude-opus-4-7 164 33360 74
186 principal claude-sonnet-5 565 394301 89
187 principal claude-opus-4-7 97 33524 131
188 principal claude-opus-4-7 7616 33621 118
189 principal claude-opus-4-7 251 41237 73
190 principal claude-opus-4-7 3562 41488 113
191 principal claude-opus-4-7 3651 45050 6606
192 principal claude-opus-4-7 8835 48701 1294
193 principal claude-sonnet-5 426 394955 137
194 principal claude-sonnet-5 907 395381 536
195 principal claude-sonnet-5 603 396288 69
196 principal claude-sonnet-5 279 396960 137
197 principal claude-sonnet-5 1089 397239 162
198 principal claude-sonnet-5 1265 398328 195
199 principal claude-sonnet-5 236 399593 137
200 principal claude-sonnet-5 596 399829 311
201 principal claude-sonnet-5 1126 400425 339
202 principal claude-sonnet-5 856 401551 362
203 principal claude-sonnet-5 527 402407 275
204 principal claude-sonnet-5 6529 402934 772
205 principal claude-sonnet-5 839 409463 61
206 principal claude-sonnet-5 401315 0 71
207 principal claude-sonnet-5 3235 401315 2949
208 principal claude-sonnet-5 8337 404550 595
209 principal claude-sonnet-5 639 412887 102
210 principal claude-sonnet-5 115 413526 159
211 principal claude-sonnet-5 239 413641 161
212 principal claude-sonnet-5 176 413880 213
213 principal claude-sonnet-5 576 414056 204
214 principal claude-sonnet-5 214 414632 440
215 principal claude-sonnet-5 596 414846 625
216 principal claude-sonnet-5 854 415442 527
217 principal claude-sonnet-5 1101 416296 180
218 principal claude-sonnet-5 260 417397 417
219 principal claude-sonnet-5 573 417657 803
220 principal claude-sonnet-5 959 418230 1015
221 principal claude-sonnet-5 1171 419189 1013
222 principal claude-sonnet-5 1169 420360 623
223 principal claude-sonnet-5 779 421529 174
224 principal claude-sonnet-5 638 422308 482
225 principal claude-sonnet-5 535 422946 189
226 principal claude-sonnet-5 223 423481 149
227 principal claude-sonnet-5 556 423704 223
228 principal claude-sonnet-5 236 424260 110
229 principal claude-sonnet-5 782 424496 174
230 principal claude-sonnet-5 403 425278 251
231 principal claude-sonnet-5 1997 425681 296
232 principal claude-sonnet-5 349 427678 147
233 principal claude-sonnet-5 344 428027 383
234 principal claude-sonnet-5 1075 428371 173
235 principal claude-sonnet-5 631 429446 133
236 principal claude-sonnet-5 380 430077 1136
237 principal claude-sonnet-5 1210 430457 1176
238 principal claude-sonnet-5 1250 431667 512
239 principal claude-sonnet-5 610 432917 1292
240 principal claude-sonnet-5 1448 433527 610
241 principal claude-sonnet-5 684 434975 171
242 principal claude-sonnet-5 223 435659 133
243 principal claude-sonnet-5 4854 435882 6031
244 principal claude-sonnet-5 7054 440736 929
245 principal claude-sonnet-5 981 447790 623
246 principal claude-sonnet-5 675 448771 874
247 principal claude-sonnet-5 926 449446 1153
248 principal claude-sonnet-5 1206 450372 276
249 principal claude-sonnet-5 329 451578 385
250 principal claude-sonnet-5 3489 451907 1177
251 principal claude-sonnet-5 2530 455396 176
252 principal claude-sonnet-5 1528 457926 429
253 principal claude-sonnet-5 483 459454 159
254 principal claude-sonnet-5 175 459937 153
255 principal claude-sonnet-5 835 460112 461
256 principal claude-sonnet-5 643 460947 525
257 principal claude-sonnet-5 580 461590 109
258 principal claude-sonnet-5 1303 462170 150
259 principal claude-sonnet-5 1043 463473 180
260 principal claude-sonnet-5 847 464516 112
261 principal claude-sonnet-5 1080 465363 2888
262 principal claude-sonnet-5 2941 466443 176
263 principal claude-sonnet-5 1507 469384 687
264 principal claude-sonnet-5 740 470891 174
265 principal claude-sonnet-5 716 471631 960
266 principal claude-sonnet-5 1116 472347 206
267 principal claude-sonnet-5 371 473463 112
268 principal claude-sonnet-5 343 473834 286
269 principal claude-sonnet-5 442 474177 149
270 principal claude-sonnet-5 583 474619 149
271 principal claude-sonnet-5 138 475202 1130
272 principal claude-sonnet-5 1137 475340 110
273 principal claude-sonnet-5 782 476477 297
274 principal claude-sonnet-5 332 477259 144
275 principal claude-sonnet-5 356 477591 367
276 principal claude-sonnet-5 414 477947 1596
277 principal claude-sonnet-5 1603 478361 111
278 principal claude-sonnet-5 910 479964 575
279 principal claude-sonnet-5 1046 480874 158
280 principal claude-sonnet-5 602 481920 636
281 principal claude-sonnet-5 692 482522 149
282 principal claude-sonnet-5 165 483214 106
283 principal claude-sonnet-5 306 483379 215
284 principal claude-sonnet-5 255 483685 133
285 principal claude-sonnet-5 460 483940 953
286 principal claude-sonnet-5 1027 484400 640
287 principal claude-sonnet-5 5221 485427 142
288 principal claude-sonnet-5 300 490648 582
289 principal claude-sonnet-5 888 490948 121
290 principal claude-sonnet-5 478 491836 86
291 principal claude-opus-4-7 38720 0 308
292 principal claude-opus-4-7 356 38720 93
293 principal claude-sonnet-5 480 492314 1082
294 principal claude-opus-4-7 224 39076 83
295 principal claude-opus-4-7 4574 39300 84
296 principal claude-sonnet-5 1613 492794 424
297 principal claude-opus-4-7 3058 43874 84
298 principal claude-sonnet-5 491 494407 92
299 principal claude-opus-4-7 6631 46932 3485
300 principal claude-opus-4-7 7088 53563 154
301 principal claude-opus-4-7 279 60651 155
302 principal claude-opus-4-7 216 60930 86
303 principal claude-opus-4-7 2188 61146 116
304 principal claude-opus-4-7 4069 63334 934
305 principal claude-opus-4-7 2107 67403 1800
306 principal claude-sonnet-5 446263 49060 137
307 principal claude-sonnet-5 1509 495323 147
308 principal claude-sonnet-5 188 496832 137
309 principal claude-sonnet-5 599 497020 411
310 principal claude-sonnet-5 775 497619 25
311 principal claude-sonnet-5 391 498032 58
312 principal claude-sonnet-5 935 498032 137
313 principal claude-sonnet-5 284 498967 132
314 principal claude-sonnet-5 470 499251 106
315 principal claude-sonnet-5 119 499721 165
316 principal claude-sonnet-5 2585 500005 2127
317 principal claude-sonnet-5 2140 502590 138
318 principal claude-sonnet-5 202 504730 144
319 principal claude-sonnet-5 1662 504932 1280
320 principal claude-sonnet-5 1436 506594 322
321 principal claude-sonnet-5 478 508030 325
322 principal claude-sonnet-5 481 508508 1034
323 principal claude-sonnet-5 5314 508989 263
324 principal claude-sonnet-5 297 514303 126
325 principal claude-sonnet-5 549 514600 1226
326 principal claude-sonnet-5 1233 515149 112
327 principal claude-sonnet-5 706 516382 3793
328 principal claude-sonnet-5 3800 517088 154
329 principal claude-sonnet-5 161 520888 112
330 principal claude-sonnet-5 706 521049 1179
331 principal claude-sonnet-5 1202 521755 2041
332 principal claude-sonnet-5 2183 522957 2763
333 principal claude-sonnet-5 2874 525140 538
334 principal claude-sonnet-5 575 528014 1697
335 principal claude-sonnet-5 2120 528589 113
336 principal claude-sonnet-5 1143 530709 229
337 principal claude-sonnet-5 824 531852 292
338 principal claude-sonnet-5 487 532676 146
339 principal claude-sonnet-5 186 533163 133
340 principal claude-sonnet-5 501 533349 937
341 principal claude-sonnet-5 1011 533850 129
342 agent claude-haiku-4-5-20251001 11416 0 4
343 agent claude-haiku-4-5-20251001 1837 11416 2
344 agent claude-haiku-4-5-20251001 2386 13253 2
345 agent claude-haiku-4-5-20251001 4451 15639 1
346 agent claude-haiku-4-5-20251001 2826 20090 2
347 agent claude-haiku-4-5-20251001 239 22916 2
348 agent claude-haiku-4-5-20251001 11265 0 4
349 agent claude-haiku-4-5-20251001 1480 11265 2
350 agent claude-haiku-4-5-20251001 307 12745 2
351 agent claude-haiku-4-5-20251001 5128 13052 2
352 agent claude-haiku-4-5-20251001 849 18180 3
353 agent claude-haiku-4-5-20251001 528 19029 4
354 agent claude-haiku-4-5-20251001 723 19557 2
355 agent claude-haiku-4-5-20251001 370 20280 4
-->
<!-- /cout -->
