# 2026-09-01 — claude/analyse-mise-en-place-640g51

Branche : `claude/analyse-mise-en-place-640g51`
Périmètre : fabrique — évaluation d'un outil d'indexation externe
(`codebase-memory-mcp`) et relevé de jetons. Aucune app modifiée : `ramure-v2` est
lue et indexée, son arbre reste propre. Seul artefact écrit : cette entrée.
Mode : `chaud`

## Le sujet

Un article de presse annonce « −45,6 % de jetons » pour `DeusData/codebase-memory-mcp`,
un graphe de connaissances du code interrogé par MCP à la place de l'exploration fichier
par fichier — Journal du Net, « Vous payez trop cher Claude Code : ce MCP peut réduire la
facture de 45 % », `journaldunet.com/intelligence-artificielle/1553687-…`, lu le
2026-09-01.

**Ce qui est mesuré, exactement.** L'outil compilé depuis ses sources au commit
`17786374dfc39b8c751933d34d269501f2b4d6b7` (`main`, cloné le 2026-09-01) ; l'index
construit avec `gopls v0.23.0` présent sur la machine. Le verdict ci-dessous ne vaut que
pour cette version : une version ultérieure est une version postérieure à ce commit. L'utilisateur a demandé de l'essayer sur
une app et de chiffrer avant/après.

**Protocole.** Le banc de `docs/banc/` chronomètre et ne compte pas les jetons ; celui
de `docs/banc/agents/` compte les jetons mais compare des *moteurs*, pas des *moyens*.
On reprend sa forme : même mission, même app, deux moyens, un passage chacun — une
session d'agent n'est pas rejouable, `docs/banc/README.md` le dit, donc pas de médiane.

- **App** : `ramure-v2`, la plus grosse de la fabrique (18 540 lignes, 10 paquets Go) —
  le cas que l'article dit favorable au graphe.
- **Mission** : une question relationnelle ciblée, celle où l'article annonce son gain —
  recenser tous les sites d'appel de `(*budget.Limiteur).Attendre` hors tests, avec les
  valeurs de `budget.Source` passées.
- **Vérité terrain** : `internal/budget/limiteur.go:95`, **10 sites d'appel** dans 5
  fichiers de `internal/source`, **6 sources distinctes**.
- **Témoin** : `general-purpose`/sonnet, outils ordinaires (Read, Grep, Glob, Bash).
- **Traitement** : `general-purpose`/sonnet, graphe **seul** — Read, Grep, Glob et toute
  commande de recherche de texte interdits.
- **Comptage** : `subagents/agent-*.jsonl`, règle de `scripts/cout.sh` (max de chaque
  champ d'`usage` par `requestId`, puis somme). Tarif Sonnet 3 / 3,75 / 0,30 / 15 $ par
  million.

## Le relevé

| | témoin (outils ordinaires) | graphe seul |
|---|---:|---:|
| tours | 3 | 10 |
| appels d'outils | 3 | 9 |
| contexte neuf (cache écrit) | 52 039 | **26 392** |
| contexte relu (cache lu) | 97 410 | **488 066** |
| **total jetons** | **149 466** | **514 579** |
| prix estimé (plancher) | 0,2246 $ | 0,2470 $ |
| durée | 15 s | 66 s |
| sites d'appel trouvés | **10 / 10** | 8 / 10 |
| sources trouvées | **6 / 6** | 5 / 6 |

Les deux prix sont des **planchers** : ils incluent une sortie de 11 et 101 jetons,
dont l'anomalie 3 établit qu'elle n'est pas enregistrée. La sortie se facture 15 $ le
million, et c'est le bras « graphe », avec ses dix tours, qui est le plus sous-déclaré
des deux — la correction irait donc dans le sens du verdict, pas contre lui. Les autres
lignes sont mesurées.

Dans le bloc `## Coût` en fin d'entrée, les deux bras sont les **seules lignes
`claude-sonnet-5`** du `cout-detail` — tout le reste de la branche tourne en `opus-5` ou
`haiku`. Le bras « graphe » est le bloc de **dix** lignes consécutives, le témoin celui
de **trois**, qui s'ouvre sur une écriture de cache de 46 604. On les repère ainsi et non
par leur rang, qui se renumérote à chaque passage de `cout.sh`. C'est la seule preuve du
relevé qui survive au conteneur : les fichiers `subagents/agent-*.jsonl` sont perdus
avec lui.

Coût d'indexation, hors jetons : 12,9 s pour 1 636 nœuds et 5 625 arêtes, une fois.
La compilation depuis les sources prend environ trois minutes.

**Le gain annoncé existe, et il est au mauvais endroit.** Le graphe divise bien par deux
le contexte *neuf* — 26 k contre 52 k, c'est le chiffre que l'article mesure. Mais il
demande 10 tours au lieu de 3, et chaque tour repaie tout ce que les précédents ont lu :
le contexte *relu* est multiplié par cinq, et le total par 3,4. C'est exactement le coût
en carré du nombre de tours que le contrat énonce — la mesure ne fait que le confirmer
sur un cas neuf. Un article qui ne compte que les jetons neufs ne peut pas voir ça.

**Le ×3,4 est en jetons, pas en argent : la colonne des dollars, elle, est quasi plate,
+10 %.** La lecture de cache se facture 0,1× l'entrée, et c'est précisément là que le
graphe dépense — l'écart de jetons s'écrase donc au moment de payer. Citer « 3,4 fois
plus cher » propagerait un facteur trente sur le seul poste qui se règle. **Ce qui
disqualifie l'outil ici n'est pas son prix, c'est sa réponse fausse** ; le prix dit
seulement qu'il n'y a rien à gagner en échange.

## Anomalies

### 1. Le graphe perd le récepteur des méthodes Go, et répond faux sans le dire

**Symptome** — sur la question même où l'outil est censé exceller, il rend 8 sites
d'appel sur 10. Manquent `internal/source/lastfm.go:73` et
`internal/source/listenbrainz.go:56`, et avec eux la source `budget.ListenBrainz`. Pire
que l'omission : la requête Cypher `MATCH (a)-[r:CALLS]->(b) WHERE b.name='Attendre'`
rend une arête `Vivier → Attendre` **située dans `internal/source/cascade_test.go`**,
alors que l'appel réel est dans `lastfm.go`. La réponse n'est pas incomplète, elle est
fausse, et rien dans le rendu ne la signale comme douteuse. Les trois lignes qui le
montrent, telles que le graphe les rend (`a.qualified_name`, `a.file_path`, `r.line`) :

```
  …internal.source.Vivier   internal/source/cascade_test.go  "73"   <- l'appel est en lastfm.go:73
  …internal.source.Profil   internal/source/lastfm.go        "126"
  (aucune ligne pour listenbrainz.go:56)
```


**Cause** — les noms qualifiés du graphe ne portent pas le récepteur :
`…internal.source.Vivier`, sans `(*LastFM)` ni `(*ListenBrainz)`. `ramure-v2` définit
**cinq** méthodes `Vivier` dans le seul paquet `internal/source` — sur `LastFM`,
`ListenBrainz`, `Cascade`, et deux bouchons de `cascade_test.go`. Elles se replient sur
un nœud unique, qui hérite du fichier de l'une d'elles ; les arêtes des autres sont
perdues ou réattribuées. Une sixième `Vivier` homonyme vit dans `internal/arbre` : le
paquet la distingue, elle n'entre pas dans la collision. Ce n'est pas un défaut de
configuration : `gopls` est présent sur la machine, l'index se déclare `ready`, aucun
fichier n'est signalé partiellement analysé.

**Detecte par** — `auteur`

**Action** — `outillage` — verdict : ne pas installer. Le motif est la réponse fausse
sur du Go idiomatique, pas le prix : à +10 % en argent, l'outil serait discutable, pas
disqualifié. Mais il n'offre rien en échange de ces 10 % — il est aussi 3,4 fois plus
gourmand en jetons et 4,4 fois plus lent. À revoir si une version postérieure au commit
cité plus haut qualifie les méthodes par leur récepteur.

### 2. Le harnais cloud refuse d'installer un outil externe, et il a raison de le faire

**Symptome** — trois gestes refusés d'affilée par le classifieur du mode automatique :
`curl | bash` de l'installeur, téléchargement du binaire publié, puis `make` sur les
sources clonées. Le troisième est passé après autorisation explicite de l'utilisateur.

**Cause** — évaluer un outil tiers demande de télécharger et d'exécuter du code
extérieur au dépôt, ce que le mode automatique bloque par construction. Le contrat
décrit l'outillage comme quelque chose qu'on *déclare* dans `.claude/settings.json` ; il
ne dit rien du cas « essayer un outil qu'on n'a pas encore choisi », qui est pourtant le
préalable de toute décision d'outillage.

**Detecte par** — `auteur`

**Action** — `comportement` — une évaluation d'outil externe se demande à l'utilisateur
avant de commencer, pas au troisième refus. Le geste utile est la compilation depuis les
sources : elle est passée là où le binaire publié et l'installeur ont été refusés, et
elle est de toute façon la seule des trois qui laisse lire ce qu'on exécute.

### 3. La sortie des sous-agents n'est pas enregistrée dans ce harnais, et `cout.sh` la compte donc à zéro

**Symptome** — dans les deux fichiers `subagents/agent-*.jsonl` de cette session,
`output_tokens` vaut 3, 2 et 6 pour des réponses de douze lignes ; total 11 et 101
jetons de sortie. Dans le fichier de la session principale, le même champ vaut 166, 458,
1 145… — des valeurs plausibles. Le champ n'est pas juste bruité côté sous-agent : il
est vide.

**Cause** — non établie. Ce n'est pas le piège que `scripts/cout.sh` a déjà corrigé le
22 août : la règle du max par `requestId` est appliquée ici, et elle ne rattrape rien
puisque toutes les lignes d'une requête portent la même valeur minuscule. L'hypothèse la
plus simple est que le harnais écrit l'`usage` du sous-agent avant que sa réponse soit
complète, et ne le réécrit pas ensuite.

**Detecte par** — `auteur`

**Action** — `outillage` — la sortie est facturée 15 $ le million, cinq fois l'entrée :
une branche qui lance des agents sous-déclare son coût, du même ordre de grandeur que
l'erreur d'un facteur deux corrigée en août. Le commentaire de `cout.sh` affirme que le
max par requête « répond aux deux cas à la fois » ; il en existe un troisième, et le
script ne peut pas le distinguer d'un agent réellement laconique. À vérifier sur une
branche qui lance l'`artisan` pour de vrai avant d'y toucher — n = 2 ici.

## Ce qui reste

- Les mesures valent pour **un** passage chacune, comme le banc des agents : une session
  d'agent ne se rejoue pas. Elles ne se comparent pas non plus à un relevé pris sur une
  autre machine.
- Le graphe a été interrogé par sa **ligne de commande**, pas par MCP : la session ne
  peut pas enregistrer un serveur MCP en cours de route. La charge utile JSON est la
  même ; ce qui n'est pas mesuré, c'est le coût des descriptions d'outils MCP en tête de
  contexte, qui joue **contre** le graphe et n'est donc pas comptée à son avantage.
- Le traitement s'est vu interdire `grep` : la mesure répond à « le graphe **au lieu**
  des outils ordinaires », pas à « le graphe **en plus** ». C'est la question qui décide
  d'une installation.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-09-01 à 20:08 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 248 | 0,00 $ |
| Écriture de cache | 511 582 | 2,89 $ |
| Lecture de cache | 10 784 033 | 5,24 $ |
| Sortie | 54 983 | 1,32 $ |
| **Total** | **11 350 846** | **9,45 $ — 8,21 €** |

**Ce qui coûte**

- **105 appel(s) au modèle** — un par réponse, outils compris —, dont 29 par des sous-agents — 1 105 876 jetons, 1,12 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 684 jetons, écrits une fois par session puis relus à chaque
  échange : 5 151 300 jetons de relecture, 47 % de tout ce qui a été relu.
- **Tours courts** — 48 des 105 tours (45 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,97 $, soit 31 % de la facture.
  Dont 25 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Session principale** — 76 tour(s) dans ce conteneur, 76 sur la branche.
  **Au-delà de 60 tours, coupe et repars du PRP** — le prompt de reprise
  est dans `memory/travail.md`.
- **Sessions d'agent** — 4, dont la plus longue fait 10 tours,
  relit 27 303 jetons par tour en moyenne et coûte 0,60 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 68 684 jetons relus au premier appel qui relise
  quelque chose, 189 080 au dernier : une session longue se paie à chaque tour.

<!-- cout-releve 82c20b9c7a25 11350846 9.449489 76 10 -->
<!-- cout-total: 11350846 -->
<!-- cout-principal-tours: 76 -->
<!-- cout-agent-max: 10 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68684 0 166
2 principal claude-opus-5 895 68684 130
3 principal claude-opus-5 401 69579 138
4 principal claude-opus-5 494 69980 222
5 principal claude-opus-5 956 70474 458
6 principal claude-opus-5 1741 71430 335
7 principal claude-opus-5 949 73171 1145
8 principal claude-opus-5 46750 35567 583
9 principal claude-opus-5 1575 82317 181
10 principal claude-opus-5 6561 83892 328
11 principal claude-opus-5 4646 90453 373
12 principal claude-opus-5 1567 95099 1060
13 principal claude-opus-5 1372 96666 380
14 principal claude-opus-5 1851 98038 487
15 principal claude-opus-5 799 99889 593
16 principal claude-opus-5 905 100688 390
17 principal claude-opus-5 456 101593 277
18 principal claude-opus-5 3769 102049 343
19 principal claude-opus-5 1043 105818 343
20 principal claude-opus-5 655 106861 470
21 principal claude-opus-5 2208 107516 266
22 principal claude-opus-5 1375 109724 242
23 principal claude-opus-5 554 111099 1269
24 principal claude-opus-5 1535 111653 573
25 principal claude-opus-5 6769 113188 346
26 principal claude-opus-5 1335 119957 391
27 principal claude-opus-5 938 121292 597
28 principal claude-opus-5 2099 122230 361
29 principal claude-opus-5 2893 124329 353
30 principal claude-opus-5 1145 127222 360
31 principal claude-opus-5 410 128367 431
32 principal claude-opus-5 1042 128777 1217
33 principal claude-opus-5 1414 129819 445
34 principal claude-opus-5 1720 131233 438
35 principal claude-opus-5 1059 132953 382
36 principal claude-opus-5 1067 134012 361
37 principal claude-opus-5 520 135079 218
38 principal claude-opus-5 1420 135599 297
39 principal claude-opus-5 338 137019 347
40 principal claude-opus-5 1530 137357 441
41 principal claude-opus-5 1461 138887 634
42 principal claude-opus-5 1451 140348 814
43 principal claude-opus-5 855 141799 414
44 principal claude-opus-5 767 142654 465
45 principal claude-opus-5 593 143421 1078
46 principal claude-opus-5 1111 144014 2339
47 principal claude-opus-5 3908 145125 3
48 principal claude-opus-5 1632 147466 228
49 principal claude-opus-5 545 149098 297
50 principal claude-opus-5 431 149643 675
51 principal claude-opus-5 1183 150074 813
52 principal claude-opus-5 3689 151257 435
53 principal claude-opus-5 660 154946 1366
54 principal claude-opus-5 1503 155606 125
55 principal claude-opus-5 1011 157109 355
56 principal claude-opus-5 483 158120 145
57 principal claude-opus-5 539 158603 107
58 principal claude-opus-5 1223 159142 886
59 principal claude-opus-5 1015 160365 4160
60 principal claude-opus-5 4255 161380 173
61 principal claude-opus-5 390 165635 121
62 principal claude-opus-5 4651 166025 330
63 principal claude-opus-5 1402 170676 506
64 principal claude-opus-5 2026 172078 1884
65 principal claude-opus-5 2082 174104 170
66 principal claude-opus-5 299 176186 221
67 principal claude-opus-5 1428 176485 184
68 principal claude-opus-5 218 177913 188
69 principal claude-opus-5 267 178131 84
70 principal claude-opus-5 963 178398 1702
71 principal claude-opus-5 2092 179361 684
72 principal claude-opus-5 729 181453 772
73 principal claude-opus-5 139604 45985 818
74 principal claude-opus-5 938 185589 2525
75 principal claude-opus-5 2553 186527 826
76 principal claude-opus-5 1264 189080 537
77 agent claude-opus-5 13202 0 1
78 agent claude-opus-5 2482 13202 7
79 agent claude-opus-5 8319 15684 3317
80 agent claude-opus-5 7596 24003 1645
81 agent claude-opus-5 2436 31599 3
82 agent claude-opus-5 1620 34035 3
83 agent claude-opus-5 995 35655 2646
84 agent claude-opus-5 3882 36650 3
85 agent claude-opus-5 1145 40532 3
86 agent claude-opus-5 1709 41677 2
87 agent claude-sonnet-5 16435 30576 4
88 agent claude-sonnet-5 2047 47011 3
89 agent claude-sonnet-5 771 49058 20
90 agent claude-sonnet-5 442 49829 5
91 agent claude-sonnet-5 363 50271 20
92 agent claude-sonnet-5 445 50634 20
93 agent claude-sonnet-5 952 51079 3
94 agent claude-sonnet-5 599 52031 3
95 agent claude-sonnet-5 2317 52630 20
96 agent claude-sonnet-5 2021 54947 3
97 agent claude-sonnet-5 46604 0 3
98 agent claude-sonnet-5 4202 46604 2
99 agent claude-sonnet-5 1233 50806 6
100 agent claude-haiku-4-5-20251001 12652 0 2
101 agent claude-haiku-4-5-20251001 1608 12652 213
102 agent claude-haiku-4-5-20251001 5757 14260 2217
103 agent claude-haiku-4-5-20251001 2397 20017 2
104 agent claude-haiku-4-5-20251001 407 22414 2
105 agent claude-haiku-4-5-20251001 283 22821 4
-->
<!-- /cout -->
