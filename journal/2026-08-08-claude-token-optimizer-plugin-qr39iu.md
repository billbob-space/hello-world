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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 12:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 247 | 0,00 $ |
| Écriture de cache | 293 452 | 0,76 $ |
| Lecture de cache | 13 832 773 | 3,95 $ |
| Sortie | 73 250 | 0,74 $ |
| **Total** | **14 199 722** | **5,46 $ — 4,74 €** |

**Ce qui coûte**

- **117 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 918 jetons, écrits une fois par session puis relus à chaque
  échange : 7 762 488 jetons de relecture, 56 % de tout ce qui a été relu.
- **Tours courts** — 46 des 117 tours (39 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,22 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 918 jetons relus au premier appel qui relise
  quelque chose, 204 389 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 14199722 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66918 0 763
2 principal claude-sonnet-5 962 66918 202
3 principal claude-sonnet-5 8833 67880 539
4 principal claude-sonnet-5 6738 76713 531
5 principal claude-sonnet-5 1246 83451 80
6 principal claude-sonnet-5 92 84697 1443
7 principal claude-sonnet-5 2821 84789 233
8 principal claude-sonnet-5 1053 87610 455
9 principal claude-sonnet-5 1026 88663 1329
10 principal claude-sonnet-5 1749 89689 336
11 principal claude-sonnet-5 1939 91438 662
12 principal claude-sonnet-5 1468 93377 164
13 principal claude-sonnet-5 2164 94845 1668
14 principal claude-sonnet-5 5002 97009 210
15 principal claude-sonnet-5 1568 102011 151
16 principal claude-sonnet-5 301 103579 88
17 principal claude-sonnet-5 1329 103880 260
18 principal claude-sonnet-5 357 105209 130
19 principal claude-sonnet-5 1048 105566 274
20 principal claude-sonnet-5 348 106614 228
21 principal claude-sonnet-5 278 106962 750
22 principal claude-sonnet-5 1038 107240 566
23 principal claude-sonnet-5 621 108278 236
24 principal claude-sonnet-5 291 108899 577
25 principal claude-sonnet-5 631 109190 162
26 principal claude-sonnet-5 844 109821 483
27 principal claude-sonnet-5 533 110665 88
28 principal claude-sonnet-5 1498 111198 1020
29 principal claude-sonnet-5 1209 112696 1873
30 principal claude-sonnet-5 1970 113905 67
31 principal claude-sonnet-5 277 115875 111
32 principal claude-sonnet-5 2393 116152 79
33 principal claude-sonnet-5 383 118545 324
34 principal claude-sonnet-5 453 118928 76
35 principal claude-opus-4-7 4488 28233 285
36 principal claude-opus-4-7 531 32721 214
37 principal claude-sonnet-5 303 119381 134
38 principal claude-opus-4-7 4556 33252 2229
39 principal claude-sonnet-5 983 119684 205
40 principal claude-opus-4-7 0 32721 247
41 principal claude-opus-4-7 412 32721 148
42 principal claude-sonnet-5 675 120667 841
43 principal claude-opus-4-7 1119 33133 214
44 principal claude-sonnet-5 1372 121342 286
45 principal claude-sonnet-5 847 122714 314
46 principal claude-sonnet-5 377 123561 319
47 principal claude-opus-4-7 3181 37808 2446
48 principal claude-opus-4-7 4732 28233 277
49 principal claude-opus-4-7 523 32965 214
50 principal claude-opus-4-7 4556 34252 4678
51 principal claude-opus-4-7 4556 33488 3370
52 principal claude-opus-4-7 4711 38808 953
53 principal claude-opus-4-7 30940 0 199
54 principal claude-opus-4-7 4710 28233 237
55 principal claude-opus-4-7 368 30940 148
56 principal claude-opus-4-7 483 32943 214
57 principal claude-opus-4-7 2846 31308 2847
58 principal claude-opus-4-7 4556 33426 3324
59 principal claude-opus-4-7 6648 24453 458
60 principal claude-opus-4-7 1323 31101 390
61 principal claude-sonnet-5 1338 124257 1813
62 principal claude-sonnet-5 2496 125595 249
63 principal claude-sonnet-5 575 128091 243
64 principal claude-sonnet-5 1038 128666 214
65 principal claude-sonnet-5 841 129704 147
66 principal claude-sonnet-5 1261 130545 371
67 principal claude-sonnet-5 882 131806 1009
68 principal claude-sonnet-5 2455 132688 1179
69 principal claude-sonnet-5 1323 135143 288
70 principal claude-sonnet-5 483 136466 472
71 principal claude-sonnet-5 2583 136949 766
72 principal claude-sonnet-5 863 139532 99
73 principal claude-sonnet-5 652 140395 95
74 principal claude-sonnet-5 3926 141047 55
75 principal claude-sonnet-5 104 144973 293
76 principal claude-opus-4-7 3474 28233 128
77 principal claude-sonnet-5 456 145077 325
78 principal claude-opus-4-7 1000 31707 416
79 principal claude-sonnet-5 524 145858 69
80 principal claude-sonnet-5 350 146382 169
81 principal claude-sonnet-5 351 146732 201
82 principal claude-sonnet-5 65 147284 1653
83 principal claude-sonnet-5 6042 147349 664
84 principal claude-sonnet-5 3801 153391 345
85 principal claude-sonnet-5 3718 157192 325
86 principal claude-sonnet-5 2159 160910 1934
87 principal claude-sonnet-5 3163 163069 898
88 principal claude-sonnet-5 1157 166232 755
89 principal claude-sonnet-5 7 168144 626
90 principal claude-sonnet-5 2053 168151 1673
91 principal claude-sonnet-5 1746 170204 178
92 principal claude-sonnet-5 902 171950 555
93 principal claude-sonnet-5 5390 172852 716
94 principal claude-sonnet-5 1184 178242 540
95 principal claude-sonnet-5 2543 179426 1009
96 principal claude-sonnet-5 1488 181969 273
97 principal claude-sonnet-5 478 183457 597
98 principal claude-sonnet-5 637 183935 121
99 principal claude-sonnet-5 169 184572 96
100 principal claude-sonnet-5 466 184741 183
101 principal claude-sonnet-5 232 185207 387
102 principal claude-sonnet-5 1292 185439 1092
103 principal claude-sonnet-5 2976 186731 157
104 principal claude-sonnet-5 544 189707 132
105 principal claude-sonnet-5 336 190251 735
106 principal claude-sonnet-5 1855 190587 454
107 principal claude-sonnet-5 2055 192442 153
108 principal claude-sonnet-5 1014 194497 120
109 principal claude-sonnet-5 324 195511 1583
110 principal claude-sonnet-5 1986 195835 1315
111 principal claude-sonnet-5 2791 197821 710
112 principal claude-sonnet-5 805 200612 178
113 principal claude-sonnet-5 275 201417 1832
114 principal claude-sonnet-5 1905 201692 118
115 principal claude-sonnet-5 145 203597 125
116 principal claude-sonnet-5 647 203742 884
117 principal claude-sonnet-5 950 204389 184
-->
<!-- /cout -->
