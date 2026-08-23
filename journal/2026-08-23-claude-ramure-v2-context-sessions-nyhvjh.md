# 2026-08-23 — claude/ramure-v2-context-sessions-nyhvjh

Branche : `claude/ramure-v2-context-sessions-nyhvjh`
Périmètre : fabrique — analyse de la chaîne de développement (longueur des sessions,
coupe, reprise). `ramure-v2` sert de cas d'étude sur ses quatre branches ; aucun
fichier d'app n'est modifié.
Mode : `chaud`

Quatre analyses parallèles : forensique des coûts (`cout-detail` des quatre branches),
forensique du déroulé (100 anomalies des cinq entrées), volumétrie des documents
d'autorité, et état de la chaîne de coupe et de reprise.

Synthèse publiée en artefact : https://claude.ai/code/artifact/61fa503f-642d-47c6-9c5c-56efd5926533

## Anomalies

### 1. Le relevé de coût sous-compte, et ne dit pas de combien

**Symptome** — l'entrée `fe7vco` annonce 139,17 $. Le recalcul depuis son propre
bloc `cout-detail`, aux tarifs courants de `fabrique.yml`, donne **151,01 $** :
11,84 $ manquants, 8,5 % du montant. Les trois autres branches se rejouent exact.
Le total des quatre branches est 342,50 $, non 330,69 $.

**Cause** — au 2026-08-19, `claude-opus-4-7` et `claude-haiku-4-5-20251001`
n'avaient pas de ligne dans `tarifs`. `memory/travail.md` documente le
comportement — « un modèle absent de `tarifs` est compté en jetons mais **pas en
argent** » — mais le bloc écrit n'en porte aucune trace : ni le nom du modèle non
tarifé, ni le nombre de tours concernés (209 tours d'opus-4-7, 13,6 M jetons, et
63 tours de haiku). Le montant est donc lu comme un total alors qu'il est un
minorant, et l'écart grandit avec chaque modèle neuf.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le relevé doit nommer dans le bloc les modèles vus sans
tarif et le volume qu'ils portent ; un total silencieusement partiel n'est pas un total.

### 2. Le plafond de 60 tours ne regarde que les sous-agents

**Symptome** — les sessions principales des quatre branches font 470, 271, 246 et
152 tours, soit 2,5 à 8 fois le plafond du contrat. Elles portent **162,87 $, 48 %
de la facture**. Aucun avertissement ne s'est déclenché sur cette longueur.

**Cause** — `cout.sh` compare au seuil `COUT_AGENT_TOURS_ALERTE` le seul champ
`max_ech`, calculé sur les fichiers de sous-agents. La session principale n'est
mesurée que par son contexte relu — deux seuils, 300 k et 600 k, qui disent la
largeur du dernier tour et non le nombre de tours. Le contrat écrit « un chantier
tient sous 60 tours » sans distinguer les deux, et l'outil n'en surveille qu'un.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le nombre de tours de la session principale se compare
au même seuil, et s'écrit dans le bloc comme `cout-agent-max`.

### 3. Le compteur de longueur repart à zéro à chaque coupe

**Symptome** — trois reprises successives sur ramure-v2, et pas une alerte réarmée
sur les sessions 2 et 3. Chacune est repartie « courte » aux yeux de l'outil alors
que le chantier, lui, continuait.

**Cause** — `cout.sh` lit les transcripts du **conteneur courant** ; ceux des
conteneurs précédents sont perdus, ce que le bloc écrit honnêtement. Mais le
mécanisme d'alerte hérite de cette cécité sans la corriger : la seule donnée qui
survive à la coupe est le bloc `cout` déjà écrit dans l'entrée de journal, et
personne ne le relit. La conséquence est exactement inverse de l'intention : plus
un chantier est coupé, moins ses seuils se déclenchent.

**Detecte par** — `auteur`

**Action** — `garde-fou` — cumuler depuis les blocs `cout` déjà écrits dans
l'entrée de branche, seule mémoire qui traverse le conteneur.

### 4. Les plafonds des agents sont des phrases, rien ne les fait tenir

**Symptome** — plafonds écrits : 30 k à 100 k jetons selon l'agent. Longueurs
constatées : 207, 169, 168, 158, 140, 126 tours — **22 sessions au-dessus de 60
tours, 142,72 $, 42 % de la facture des quatre branches**.

**Cause** — `init.sh --check` vérifie la **présence** d'une section `## Plafond` et
d'un champ `model:`, jamais leur valeur ni la consommation réelle. Aucun hook
`SubagentStop`, aucun compteur pendant l'exécution. Le plafond est un texte que
l'agent lit sur lui-même : il tient par bonne volonté. Et le harnais n'expose pas
d'interruption d'agent en vol — poser la borne **à l'ouverture** de la mission est
donc le seul point d'action, pas la mesure après coup.

**Detecte par** — `auteur`

**Action** — `garde-fou` — la mission porte un plafond de tours, et l'agent rend un
rapport partiel plutôt que de continuer au-delà.

### 5. Le seul refus dur de la chaîne se saute quand le journal est incomplet

**Symptome** — un commit peut passer au-delà de 600 k jetons de contexte sans que
rien ne le refuse.

**Cause** — `pret.sh` ne lance `cout.sh --rappel` que dans la branche `else` de sa
chaîne journal : entrée présente, gabarit retiré, en-tête `Périmètre`/`Mode`
valide. Entrée absente ou en-tête incomplet, et le seul contrôle qui rend un code
d'échec n'est jamais appelé. Le garde-fou de longueur est donc conditionné par un
garde-fou de forme, alors que les deux sont indépendants — et la condition tombe
précisément dans le cas pressé, celui où on n'a pas rempli le journal.

**Detecte par** — `auteur`

**Action** — `garde-fou` — sortir le contrôle de longueur de la chaîne journal.

### 6. Aucune des trois reprises n'a transporté ce que le gabarit exige

**Symptome** — `memory/travail.md` fixe sept champs au prompt de reprise. Les deux
entrées de suite de ramure-v2 en portent trois : `Périmètre`, `Reste` en prose, et
`Mode`. **`Fait` vérifié, `Pièges` et `Ne refais pas` sont absents des deux.**
`Lis d'abord` pointe une entrée de journal dans un cas, une pull request dans
l'autre — jamais un PRP ni le PRD.

**Cause** — le prompt est composé de mémoire, à la main, en fin de message, et rien
ne le vérifie : aucun contrôle sur `init.sh`, `scripts/`, `lib/`. Ce qui manque est
exactement ce qui évite de repayer — les pistes fermées et les fichiers ouverts
pour rien. La session neuve les rachète en explorant, ce qui est le coût que la
coupe cherchait à éviter.

**Detecte par** — `auteur`

**Action** — `garde-fou` — composer le bloc depuis git (commits poussés, entrée de
journal, PRP touchés) plutôt que depuis la mémoire de la session : `Fait` devient
vrai par construction.

### 7. Deux listes fermées différentes portent le même nom, `Mode`

**Symptome** — les deux entrées de suite portent `Mode : chaud`. Impossible d'y
lire si la session coupée était en mode autonome, information que le gabarit de
reprise demande explicitement.

**Cause** — `Mode` désigne dans l'en-tête de journal la façon dont l'entrée est
remplie (`chaud`/`retrospective`, contrôlé par `journal_entete`), et dans le prompt
de reprise le mode de développement (`/livrer`). Même mot, deux vocabulaires
fermés disjoints : celui qui écrit remplit le champ qu'il connaît, et l'autre
information ne transite pas.

**Detecte par** — `auteur`

**Action** — `contrat` — renommer le champ du prompt de reprise.

### 8. Les documents de ramure-v2 promettent neuf étapes et en contiennent douze

**Symptome** — les documents d'autorité de l'app pèsent 341,7 Ko, soit 3,7 fois
ceux d'`estran` et 2 fois ceux de `renaissance-gym`. Deux d'entre eux font 40 % du
corpus. Pour quatre des neuf étapes, une session doit lire **25 000 à 37 000
jetons avant sa première ligne écrite**, puis mener dix à onze tâches.

**Cause** — la découpe a été faite par sujet, pas par ce qui tient dans une
session. Les neuf étapes contiennent 45 tâches vérifiables ; à 60 tours par
chantier il en faut douze, et les frontières existent déjà à l'intérieur des
documents. Le dépassement des 168 tours n'est donc pas un accident de conduite :
il est inscrit dans la découpe, et il se serait reproduit à chaque session.

S'y ajoute que quatre étapes ne se suffisent pas à elles-mêmes — elles citent des
noms de types sans les redonner, obligeant à ouvrir l'étape amont entière. Le
mécanisme qui l'évite existe pourtant : chaque document finit par « Ce que la suite
attend de vous », que ces quatre-là n'utilisent pas.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la redécoupe et le dégraissage des documents changent le
plan de travail de l'app : c'est une décision de l'utilisateur, pas un correctif.

### 9. Le relevé ne dit pas quel agent a dépensé

**Symptome** — impossible de répondre « combien coûte le relecteur » : le bloc
`cout-detail` porte `agent` ou `principal`, jamais le nom de l'agent. Toute analyse
par type reste une inférence à partir du modèle.

**Cause** — `cout.sh` connaît le fichier de transcript du sous-agent, d'où il tire
déjà le modèle et le nombre de tours, mais n'en extrait pas le rôle. Une colonne
manquante à la source rend inexploitable une donnée déjà présente.

**Detecte par** — `auteur`

**Action** — `outillage` — ajouter la colonne au bloc.

### 10. Un tiers des anomalies des quatre branches viennent d'outils qui se taisent

**Symptome** — sur les cent anomalies relevées, **34 sont un outil rendant vert
sans mesurer**. Le cas le plus cher revient six fois sur deux branches : la moitié
du code de ramure-v2 — son client, 1 157 lignes dans un seul fichier à 0 % — n'était
lue par aucune revue, qui annonçait pourtant « couverture 81,7 % ».

**Cause** — un axe qui ne sait pas mesurer une forme qu'il ne connaît pas rend
vide, et vide se lit comme zéro défaut. `memory/revue.md` interdit déjà ce vert
silencieux ; il est réapparu sous une forme que ses cas connus ne couvraient pas —
non pas un outil qui tombe ou qui lit de travers, mais un outil jamais appelé.
C'est la première source de rallongement du corpus : le travail refait vient
derrière (21 anomalies), et il est souvent la conséquence de celle-ci.

**Detecte par** — `relecture`

**Action** — `garde-fou` — aucun axe ne rend vide en silence : ne pas savoir mesurer
est un KO, jamais un vert.

### 11. Rendre le total cumulatif a desactive, en silence, l'alerte de peremption

**Symptome** — apres avoir fait de `cout-total` le total de la BRANCHE et non
plus celui du conteneur, l'avertissement « relevé à X jetons, la conversation en
compte Y — relance cout.sh » ne pouvait plus se declencher. Aucun test ne l'a dit
: les 29 cas existants passaient au vert.

**Cause** — `cout_rappel` comparait le total ecrit au total de la conversation
courante. Un cumul de branche est superieur ou egal a ce que le conteneur courant
compte, par construction : la condition `ecrit * 10 < actuel * 9` devenait
impossible. Le correctif d'un garde-fou en avait donc eteint un autre, sans que
rien ne le signale — la forme exacte du vert silencieux que l'anomalie 10 decrit,
rencontree ici en la corrigeant. La comparaison porte desormais sur la ligne de
releve du conteneur courant, qui est bien la grandeur homogene.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un marqueur agrege et une mesure de session ne se
comparent jamais ; le cas est tenu par `test-cout.sh`.

### 12. Le nouveau plafond s'est declenche sur la session qui l'ecrivait

**Symptome** — `./scripts/pret.sh`, lance pour valider le garde-fou, rend
« session principale : 66 tours sur cette branche, plafond 60 ».

**Cause** — aucune : c'est le comportement attendu, et la seule verification
possible en vrai. Elle est notee parce qu'elle mesure ce que le contrat annonce
depuis des semaines sans que rien ne le montre — une session d'analyse et
d'outillage, sans code d'app, franchit le plafond en 66 tours. Le chiffre a
comparer est celui des quatre branches ramure-v2 : 470, 271, 246 et 152.

**Detecte par** — `test`

**Action** — `rien` — le garde-fou fait ce pour quoi il est ecrit.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 19:12 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-haiku-4-5-20251001. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 396 | 0,00 $ |
| Écriture de cache | 696 731 | 4,18 $ |
| Lecture de cache | 14 576 291 | 7,22 $ |
| Sortie | 68 668 | 1,72 $ |
| **Total** | **15 342 086** | **13,12 $ — 11,39 €** |

**Ce qui coûte**

- **157 appel(s) au modèle** — un par réponse, outils compris —, dont 90 par des sous-agents — 4 194 051 jetons, 3,88 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 722 jetons, écrits une fois par session puis relus à chaque
  échange : 4 535 652 jetons de relecture, 31 % de tout ce qui a été relu.
- **Tours courts** — 115 des 157 tours (73 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 6,33 $, soit 48 % de la facture.
  Dont 90 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Session principale** — 67 tour(s) dans ce conteneur, 67 sur la branche.
  **Au-delà de 60 tours, coupe et repars du PRP** — le prompt de reprise
  est dans `memory/travail.md`.
- **Sessions d'agent** — 7, dont la plus longue fait 28 tours,
  relit 43 102 jetons par tour en moyenne et coûte 1,08 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 68 722 jetons relus au premier appel qui relise
  quelque chose, 229 090 au dernier : une session longue se paie à chaque tour.

<!-- cout-releve fb3d9c8e0236 15342086 13.121010 67 28 -->
<!-- cout-total: 15342086 -->
<!-- cout-principal-tours: 67 -->
<!-- cout-agent-max: 28 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68722 0 650
2 principal claude-opus-5 5115 68722 553
3 principal claude-opus-5 4314 73837 325
4 principal claude-opus-5 4483 78151 905
5 principal claude-opus-5 3129 82634 416
6 principal claude-opus-5 3503 85763 4647
7 principal claude-opus-5 6372 89266 261
8 principal claude-opus-5 402 95638 139
9 principal claude-opus-5 320 96040 110
10 principal claude-opus-5 1236 96360 513
11 principal claude-opus-5 715 97596 447
12 principal claude-opus-5 728 98311 540
13 principal claude-opus-5 743 99039 160
14 principal claude-opus-5 273 99782 63
15 principal claude-opus-5 6149 99039 396
16 principal claude-opus-5 4762 105584 270
17 principal claude-opus-5 7921 110346 272
18 principal claude-opus-5 4919 118539 5957
19 principal claude-opus-5 6630 123458 98
20 principal claude-opus-5 3804 130088 3076
21 principal claude-opus-5 3107 133892 12819
22 principal claude-opus-5 12935 136999 2005
23 principal claude-opus-5 6524 149934 215
24 principal claude-opus-5 605 156458 362
25 principal claude-opus-5 833 157063 177
26 principal claude-opus-5 817 157896 131
27 principal claude-opus-5 974 158713 598
28 principal claude-opus-5 799 159687 117
29 principal claude-opus-5 170 160486 122
30 principal claude-opus-5 327 160656 426
31 principal claude-opus-5 1960 160983 374
32 principal claude-opus-5 539 162943 84
33 principal claude-opus-5 963 163482 975
34 principal claude-opus-5 1373 164445 2079
35 principal claude-opus-5 127888 49348 1978
36 principal claude-opus-5 4589 177236 155
37 principal claude-opus-5 3271 181825 240
38 principal claude-opus-5 581 185096 143
39 principal claude-opus-5 1009 185677 380
40 principal claude-opus-5 958 186686 90
41 principal claude-opus-5 2360 187644 2277
42 principal claude-opus-5 2750 190004 825
43 principal claude-opus-5 3861 192754 735
44 principal claude-opus-5 2118 196615 2293
45 principal claude-opus-5 2327 198733 3282
46 principal claude-opus-5 3326 201060 862
47 principal claude-opus-5 1046 204386 2069
48 principal claude-opus-5 2113 205432 616
49 principal claude-opus-5 655 207545 591
50 principal claude-opus-5 1184 208200 125
51 principal claude-opus-5 889 209384 810
52 principal claude-opus-5 1201 210273 543
53 principal claude-opus-5 1920 211474 1145
54 principal claude-opus-5 1378 213394 193
55 principal claude-opus-5 692 214772 319
56 principal claude-opus-5 2582 215464 618
57 principal claude-opus-5 1016 218046 2587
58 principal claude-opus-5 3038 219062 463
59 principal claude-opus-5 615 222100 109
60 principal claude-opus-5 261 222715 282
61 principal claude-opus-5 2201 222976 594
62 principal claude-opus-5 761 225177 116
63 principal claude-opus-5 616 225938 1369
64 principal claude-opus-5 1522 226554 324
65 principal claude-opus-5 582 228076 295
66 principal claude-opus-5 432 228658 144
67 principal claude-opus-5 478 229090 1437
68 agent claude-opus-5 13155 0 3
69 agent claude-opus-5 3982 13155 5
70 agent claude-opus-5 4000 17137 2
71 agent claude-opus-5 5731 21137 3
72 agent claude-opus-5 1814 26868 2
73 agent claude-opus-5 9164 28682 3
74 agent claude-opus-5 10603 37846 4
75 agent claude-opus-5 8654 48449 4
76 agent claude-haiku-4-5-20251001 11889 0 4
77 agent claude-haiku-4-5-20251001 1488 11889 2
78 agent claude-haiku-4-5-20251001 568 13377 2
79 agent claude-haiku-4-5-20251001 1780 13945 2
80 agent claude-haiku-4-5-20251001 2392 15725 2
81 agent claude-haiku-4-5-20251001 1639 18117 2
82 agent claude-haiku-4-5-20251001 316 19756 2
83 agent claude-opus-5 15739 24987 1
84 agent claude-opus-5 3031 40726 3
85 agent claude-opus-5 3318 43757 4
86 agent claude-opus-5 9526 47075 3
87 agent claude-opus-5 2904 56601 3
88 agent claude-opus-5 1930 59505 3
89 agent claude-opus-5 2842 61435 4
90 agent claude-opus-5 3035 64277 2
91 agent claude-opus-5 634 67312 9
92 agent claude-opus-5 2156 67946 2
93 agent claude-opus-5 12683 0 6
94 agent claude-opus-5 2245 12683 5
95 agent claude-opus-5 9618 14928 3
96 agent claude-opus-5 4237 24546 21
97 agent claude-opus-5 1994 28783 3
98 agent claude-opus-5 1379 30777 2
99 agent claude-opus-5 1671 32156 3
100 agent claude-opus-5 1290 33827 20
101 agent claude-opus-5 447 35117 20
102 agent claude-opus-5 812 35564 7
103 agent claude-opus-5 1226 36376 7
104 agent claude-opus-5 663 37602 17
105 agent claude-opus-5 423 38265 3
106 agent claude-opus-5 2672 38688 3
107 agent claude-opus-5 2074 41360 3
108 agent claude-opus-5 1294 43434 3
109 agent claude-opus-5 1817 44728 3
110 agent claude-opus-5 5466 46545 3
111 agent claude-opus-5 3184 52011 3
112 agent claude-opus-5 2649 55195 2
113 agent claude-opus-5 1788 57844 8
114 agent claude-opus-5 3160 59632 3
115 agent claude-opus-5 2193 62792 3
116 agent claude-opus-5 1999 64985 2
117 agent claude-opus-5 2817 66984 3
118 agent claude-opus-5 872 69801 2
119 agent claude-opus-5 902 70673 2
120 agent claude-opus-5 3736 71575 2
121 agent claude-haiku-4-5-20251001 11780 0 4
122 agent claude-haiku-4-5-20251001 1366 11780 2
123 agent claude-haiku-4-5-20251001 440 13146 3
124 agent claude-haiku-4-5-20251001 488 13586 5
125 agent claude-haiku-4-5-20251001 523 14074 4
126 agent claude-haiku-4-5-20251001 378 14597 2
127 agent claude-opus-5 40830 0 1
128 agent claude-opus-5 1575 40830 17
129 agent claude-opus-5 1925 42405 3
130 agent claude-opus-5 3105 44330 3
131 agent claude-opus-5 1868 47435 2
132 agent claude-opus-5 1076 49303 17
133 agent claude-opus-5 1745 50379 3
134 agent claude-opus-5 2354 52124 2
135 agent claude-opus-5 2283 54478 3
136 agent claude-opus-5 1391 56761 3
137 agent claude-opus-5 1110 58152 3
138 agent claude-opus-5 654 59262 2
139 agent claude-opus-5 5123 59916 3
140 agent claude-opus-5 1982 65039 5
141 agent claude-opus-5 2210 67021 3
142 agent claude-opus-5 3625 69231 5
143 agent claude-opus-5 15941 24987 1
144 agent claude-opus-5 1636 40928 2
145 agent claude-opus-5 5109 42564 3
146 agent claude-opus-5 5228 47673 4
147 agent claude-opus-5 4926 52901 4
148 agent claude-opus-5 1591 57827 3
149 agent claude-opus-5 4914 59418 5
150 agent claude-opus-5 3887 64332 3
151 agent claude-opus-5 2383 68219 2
152 agent claude-opus-5 2983 70602 4
153 agent claude-opus-5 3694 73585 3
154 agent claude-opus-5 5321 77279 4
155 agent claude-opus-5 1573 82600 3
156 agent claude-opus-5 1382 84173 2
157 agent claude-opus-5 4345 85555 1
-->
<!-- /cout -->
