# 2026-08-08 — claude/token-optimizer-plugin-qr39iu

Branche : `claude/token-optimizer-plugin-qr39iu`
Périmètre : hello-world, fabrique
Mode : `chaud`

## Anomalies

### 1. Le classificateur a bloqué la première édition de `cloud-setup.sh`, sans raison apparente

**Symptome** — Le premier appel `Edit` sur `.claude/cloud-setup.sh` (ajout de
la ligne `marketplace add alexgreensh/token-optimizer`) a été refusé par « le
classificateur du mode automatique », avec le message générique « Blocked by
classifier ». Le second appel, sur le même fichier, avec un diff de forme
identique (ajout d'une ligne à une liste existante), est passé sans encombre.

**Cause** — Inconnue : rien dans le contenu ajouté ne distingue les deux
appels. Le fichier édité est un script qui *installe* des plugins une fois
collé dans un environnement cloud — le classificateur le traite peut-être
comme plus sensible qu'une édition de fichier ordinaire, et déclenche parfois,
pas systématiquement.

**Detecte par** — `auteur`

**Action** — `rien` — un nouvel essai a suffi. Si le blocage redevenait
systématique sur ce fichier, ce serait à consigner comme `outillage`.

### 2. La clé de `extraKnownMarketplaces` ne correspondait pas au nom réel de la marketplace

**Symptome** — La revue de sécurité automatique du push a signalé que
`extraKnownMarketplaces.token-optimizer` ne correspondait pas au suffixe
`@alexgreensh-token-optimizer` utilisé dans `enabledPlugins` et dans
`cloud-setup.sh` — alors que pour `impeccable`, déjà présent, la clé locale et
le suffixe sont identiques (`impeccable` partout).

**Cause** — J'ai nommé la clé d'après le nom du dépôt (`token-optimizer`) au
lieu du nom déclaré par la marketplace elle-même dans son
`.claude-plugin/marketplace.json` (`alexgreensh-token-optimizer`), sans
vérifier que les deux entrées devaient concorder comme dans le seul autre
exemple du fichier.

**Detecte par** — `relecture` — revue de sécurité automatique sur le push,
avant que la PR ne soit fusionnée.

**Action** — `rien` — corrigé dans le même commit de correction ; le geste
d'installation réel (`cloud-setup.sh`) référençait déjà le bon nom et
n'était pas affecté.

### 3. L'essai mesuré de l'`artisan` (tâche 6 du plan du 7 août), enfin fait

**Symptôme** — Toutes les branches mesurées depuis le 4 août, y compris celle-ci
avant ce test, portaient 0 tour de sous-agent. `docs/superpowers/plans/2026-08-07-gardes-documentaires-et-mesure-des-jetons.md`
prévoyait un essai chiffré (tâche 6) pour savoir si c'est un défaut d'usage ou
un défaut technique, jamais mené. Le chantier prévu (tâches 1/2 de
`marcq-handball`) n'étant plus d'actualité, l'essai a porté sur un chantier
équivalent : ajouter les tests manquants de
`apps/hello-world/devtools/preview/main.go` (0 % de couverture, outil de
développement local, hors image Docker).

**Mesure** — Avant : 189 707 jetons de contexte au dernier tour, 104 appels.
Après un unique appel à l'`artisan` (11 actions, 25 702 jetons côté agent,
49 s, deux fichiers touchés, tests verts) : 194 497 jetons de contexte au
dernier tour, 108 appels — **+4 790 jetons dans la session principale** pour un
chantier qui en a coûté cinq fois plus côté agent. C'est le résultat attendu :
le travail reste dans le contexte de l'agent, la session principale ne garde
que son résumé.

**Cause** — Rien de cassé : la première hypothèse de l'anomalie 4 du
7 août — « rien ne rappelle l'existence des agents » — est confirmée, pas
contredite. Reste ouverte la question inverse : combien des 0 mesurés
avant aujourd'hui étaient de vrais 0, et combien étaient des appels réels
que la mesure ne voyait pas — voir anomalie suivante.

**Detecte par** — `auteur`

**Action** — `rien` — l'essai est fait, le chiffre est dans
`docs/2026-08-07-bilan-jetons-et-journal.md`, levier 4, à côté du chiffre de
départ daté comme le plan le demandait.

### 4. `cout.sh` ne voit pas ce tour de sous-agent qui vient pourtant d'avoir lieu

**Symptôme** — Le relevé lu juste après l'essai ci-dessus dit toujours « aucun
[tour] par des sous-agents », alors que l'`artisan` venait de rendre son
rapport (fichiers touchés, tests verts) quelques secondes plus tôt.

**Cause** — `cout.sh` détecte un tour de sous-agent en cherchant
`"isSidechain":true` dans le fichier de conversation de la session
principale (`scripts/cout.sh:156`). Ce marqueur suppose une architecture où
la conversation de l'agent est ecrite en ligne dans le même fichier que celle
de la session qui l'a lancé. Ce n'est visiblement pas le cas ici : le compte
rendu de l'agent est revenu par l'appel d'outil lui-même
(`subagent_tokens: 25702`), sans laisser de trace `isSidechain` détectable
dans le journal lu par `cout.sh`. Tous les « 0 sous-agent » mesurés depuis le
4 août pourraient donc être un vrai zéro d'usage, ou un angle mort de mesure —
impossible à distinguer avec l'outillage actuel.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `cout.sh` compte un poste qui, sur cette
plateforme, peut rester bloqué à zéro quel que soit l'usage réel : un chiffre
qui ne bouge jamais est indiscernable d'un chiffre qui ne sait pas bouger. Une
prochaine session outillage devrait vérifier où le compte rendu d'un
sous-agent est réellement écrit sur cette plateforme (peut-être un fichier
distinct par agent) avant de faire confiance à ce champ pour trancher si les
agents servent.

### 5. Le fichier distinct de l'anomalie 4, retrouvé et corrigé

**Symptôme** — Suite de l'anomalie 4 : où vit vraiment la conversation d'un
sous-agent sur cette plateforme, si ce n'est pas dans le fichier de la session
qui l'a lancé.

**Cause** — Inspection directe de `~/.claude/projects/<depot>/` : chaque
appel `Agent(...)` écrit dans son propre fichier,
`<id-de-session>/subagents/agent-<id-agent>.jsonl`, jamais dans
`<id-de-session>.jsonl`. Le marqueur `isSidechain:true` que `cout.sh`
cherchait était donc juste — il figure bien dans ces fichiers — mais
`cout_dir()` ne globait que `*.jsonl` à plat dans le répertoire de session, et
ne descendait jamais dans ce sous-répertoire. Un marqueur qu'on ne va jamais
lire ne peut rien déclencher.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `cout_fichiers()` glob désormais aussi
`*/subagents/*.jsonl`. Le compte de sessions, le démarrage et la croissance —
trois mesures propres à la session PRINCIPALE — sont protégés d'une
contamination par le fichier de l'agent via un drapeau `side_fichier`, posé une
fois par fichier plutôt que par ligne. Trois cas neufs dans `test-cout.sh`,
dans le vrai agencement à deux fichiers plutôt que dans l'agencement à un seul
fichier que les cas existants testaient (et qui ne s'est jamais produit en
pratique) : le total compte le sous-agent, la part chiffrée le nomme
explicitement (`dont 1 par des sous-agents`, pas juste la présence du mot), et
le fichier d'agent ne gonfle pas le compte de sessions. Les deux premiers
échouaient avant le correctif ; le troisième a été vérifié en cassant
volontairement la protection dédiée pour s'assurer qu'il la couvrait vraiment.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 12:48 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 416 | 0,00 $ |
| Écriture de cache | 527 979 | 1,91 $ |
| Lecture de cache | 29 808 483 | 8,90 $ |
| Sortie | 32 898 | 0,49 $ |
| **Total** | **30 369 776** | **11,30 $ — 9,82 €** |

**Ce qui coûte**

- **180 appel(s) au modèle** — un par réponse, outils compris —, dont 20 par des sous-agents — 380 362 jetons, 0,21 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 918 jetons, écrits une fois par session puis relus à chaque
  échange : 10 639 962 jetons de relecture, 35 % de tout ce qui a été relu.
- **Tours courts** — 147 des 180 tours (81 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 8,88 $, soit 78 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 918 jetons relus au premier appel qui relise
  quelque chose, 290 588 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 30369776 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66918 0 0
2 principal claude-sonnet-5 962 66918 0
3 principal claude-sonnet-5 8833 67880 0
4 principal claude-sonnet-5 6738 76713 0
5 principal claude-sonnet-5 1246 83451 0
6 principal claude-sonnet-5 92 84697 0
7 principal claude-sonnet-5 2821 84789 0
8 principal claude-sonnet-5 1053 87610 0
9 principal claude-sonnet-5 1026 88663 0
10 principal claude-sonnet-5 1749 89689 0
11 principal claude-sonnet-5 1939 91438 0
12 principal claude-sonnet-5 1468 93377 0
13 principal claude-sonnet-5 2164 94845 0
14 principal claude-sonnet-5 5002 97009 0
15 principal claude-sonnet-5 1568 102011 0
16 principal claude-sonnet-5 301 103579 0
17 principal claude-sonnet-5 1329 103880 0
18 principal claude-sonnet-5 357 105209 0
19 principal claude-sonnet-5 1048 105566 0
20 principal claude-sonnet-5 348 106614 0
21 principal claude-sonnet-5 278 106962 0
22 principal claude-sonnet-5 1038 107240 0
23 principal claude-sonnet-5 621 108278 0
24 principal claude-sonnet-5 291 108899 0
25 principal claude-sonnet-5 631 109190 0
26 principal claude-sonnet-5 844 109821 0
27 principal claude-sonnet-5 533 110665 0
28 principal claude-sonnet-5 1498 111198 0
29 principal claude-sonnet-5 1209 112696 0
30 principal claude-sonnet-5 1970 113905 0
31 principal claude-sonnet-5 277 115875 0
32 principal claude-sonnet-5 2393 116152 0
33 principal claude-sonnet-5 383 118545 0
34 principal claude-sonnet-5 453 118928 0
35 principal claude-sonnet-5 303 119381 0
36 principal claude-sonnet-5 983 119684 0
37 principal claude-sonnet-5 675 120667 0
38 principal claude-sonnet-5 1372 121342 0
39 principal claude-sonnet-5 847 122714 0
40 principal claude-sonnet-5 377 123561 0
41 principal claude-sonnet-5 1338 124257 0
42 principal claude-sonnet-5 2496 125595 0
43 principal claude-sonnet-5 575 128091 0
44 principal claude-sonnet-5 1038 128666 0
45 principal claude-sonnet-5 841 129704 0
46 principal claude-sonnet-5 1261 130545 0
47 principal claude-sonnet-5 882 131806 0
48 principal claude-sonnet-5 2455 132688 0
49 principal claude-sonnet-5 1323 135143 0
50 principal claude-sonnet-5 483 136466 0
51 principal claude-sonnet-5 2583 136949 0
52 principal claude-sonnet-5 863 139532 0
53 principal claude-sonnet-5 652 140395 0
54 principal claude-sonnet-5 3926 141047 0
55 principal claude-sonnet-5 104 144973 0
56 principal claude-sonnet-5 456 145077 0
57 principal claude-sonnet-5 524 145858 0
58 principal claude-sonnet-5 350 146382 0
59 principal claude-sonnet-5 351 146732 0
60 principal claude-sonnet-5 65 147284 0
61 principal claude-sonnet-5 6042 147349 0
62 principal claude-sonnet-5 3801 153391 0
63 principal claude-sonnet-5 3718 157192 0
64 principal claude-sonnet-5 2159 160910 0
65 principal claude-sonnet-5 3163 163069 0
66 principal claude-sonnet-5 1157 166232 0
67 principal claude-sonnet-5 7 168144 0
68 principal claude-sonnet-5 2053 168151 0
69 principal claude-sonnet-5 1746 170204 0
70 principal claude-sonnet-5 902 171950 0
71 principal claude-sonnet-5 5390 172852 0
72 principal claude-sonnet-5 1184 178242 0
73 principal claude-sonnet-5 2543 179426 0
74 principal claude-sonnet-5 1488 181969 0
75 principal claude-sonnet-5 478 183457 0
76 principal claude-sonnet-5 637 183935 0
77 principal claude-sonnet-5 169 184572 0
78 principal claude-sonnet-5 466 184741 0
79 principal claude-sonnet-5 232 185207 0
80 principal claude-sonnet-5 1292 185439 0
81 principal claude-sonnet-5 2976 186731 0
82 principal claude-sonnet-5 544 189707 0
83 principal claude-sonnet-5 336 190251 0
84 principal claude-sonnet-5 1855 190587 0
85 principal claude-sonnet-5 2055 192442 0
86 principal claude-sonnet-5 1014 194497 0
87 principal claude-sonnet-5 324 195511 0
88 principal claude-sonnet-5 1986 195835 0
89 principal claude-sonnet-5 2791 197821 0
90 principal claude-sonnet-5 805 200612 0
91 principal claude-sonnet-5 275 201417 0
92 principal claude-sonnet-5 1905 201692 0
93 principal claude-sonnet-5 145 203597 0
94 principal claude-sonnet-5 647 203742 0
95 principal claude-sonnet-5 950 204389 0
96 principal claude-sonnet-5 4838 205339 0
97 principal claude-sonnet-5 1792 210177 0
98 principal claude-sonnet-5 1116 211969 0
99 principal claude-sonnet-5 1008 213085 0
100 principal claude-sonnet-5 1065 214093 0
101 principal claude-sonnet-5 1257 215158 0
102 principal claude-sonnet-5 6965 216415 0
103 principal claude-sonnet-5 856 223380 0
104 principal claude-sonnet-5 597 224236 0
105 principal claude-sonnet-5 280 224833 0
106 principal claude-sonnet-5 1565 225113 0
107 principal claude-sonnet-5 339 226678 0
108 principal claude-sonnet-5 179169 49054 43
109 principal claude-sonnet-5 324 228223 93
110 principal claude-sonnet-5 129 228547 48
111 principal claude-sonnet-5 22 228724 969
112 principal claude-sonnet-5 1241 228746 128
113 principal claude-sonnet-5 255 229987 288
114 principal claude-sonnet-5 369 230242 102
115 principal claude-sonnet-5 232 230611 254
116 principal claude-sonnet-5 1227 230843 376
117 principal claude-sonnet-5 2256 232070 316
118 principal claude-sonnet-5 2869 234326 1149
119 principal claude-sonnet-5 3573 237195 7453
120 principal claude-sonnet-5 7507 240768 250
121 principal claude-sonnet-5 2665 248275 178
122 principal claude-sonnet-5 2064 250940 564
123 principal claude-sonnet-5 1312 253004 73
124 principal claude-sonnet-5 2137 254316 400
125 principal claude-sonnet-5 2549 256453 1558
126 principal claude-sonnet-5 2279 259002 753
127 principal claude-sonnet-5 973 261281 360
128 principal claude-sonnet-5 681 262254 382
129 principal claude-sonnet-5 433 262935 161
130 principal claude-sonnet-5 1119 263368 666
131 principal claude-sonnet-5 717 264487 159
132 principal claude-sonnet-5 655 265204 835
133 principal claude-sonnet-5 886 265859 124
134 principal claude-sonnet-5 290 266745 243
135 principal claude-sonnet-5 680 267035 247
136 principal claude-sonnet-5 298 267715 163
137 principal claude-sonnet-5 214 268013 810
138 principal claude-sonnet-5 820 268227 78
139 principal claude-sonnet-5 508 269047 423
140 principal claude-sonnet-5 632 269555 721
141 principal claude-sonnet-5 794 270187 1654
142 principal claude-sonnet-5 1790 270981 213
143 principal claude-sonnet-5 2922 272771 146
144 principal claude-sonnet-5 974 275693 2425
145 principal claude-sonnet-5 2812 276667 108
146 principal claude-sonnet-5 299 279479 1723
147 principal claude-sonnet-5 1772 279778 88
148 principal claude-sonnet-5 626 281550 267
149 principal claude-sonnet-5 782 282176 1232
150 principal claude-sonnet-5 1305 282958 500
151 principal claude-sonnet-5 901 284263 282
152 principal claude-sonnet-5 533 285164 189
153 principal claude-sonnet-5 306 285697 253
154 principal claude-sonnet-5 718 286003 161
155 principal claude-sonnet-5 289 286721 452
156 principal claude-sonnet-5 859 287010 808
157 principal claude-sonnet-5 848 287869 132
158 principal claude-sonnet-5 436 288717 1338
159 principal claude-sonnet-5 1435 289153 176
160 principal claude-sonnet-5 336 290588 295
161 agent claude-haiku-4-5-20251001 10922 0 4
162 agent claude-haiku-4-5-20251001 1520 10922 2
163 agent claude-haiku-4-5-20251001 272 12442 4
164 agent claude-haiku-4-5-20251001 4877 12714 2
165 agent claude-haiku-4-5-20251001 905 17591 2
166 agent claude-haiku-4-5-20251001 466 18496 2
167 agent claude-haiku-4-5-20251001 259 18962 2
168 agent claude-haiku-4-5-20251001 409 19221 2
169 agent claude-haiku-4-5-20251001 288 19630 4
170 agent claude-sonnet-5 16049 0 3
171 agent claude-sonnet-5 3186 16049 4
172 agent claude-sonnet-5 772 19235 5
173 agent claude-sonnet-5 2325 20007 4
174 agent claude-sonnet-5 944 22332 2
175 agent claude-sonnet-5 1032 23276 20
176 agent claude-sonnet-5 670 24308 2
177 agent claude-sonnet-5 186 24978 20
178 agent claude-sonnet-5 106 25164 1
179 agent claude-sonnet-5 14110 0 3
180 agent claude-sonnet-5 1442 14110 1
-->
<!-- /cout -->
