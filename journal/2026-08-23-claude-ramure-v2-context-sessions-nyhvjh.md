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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 18:17 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-haiku-4-5-20251001. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 198 | 0,00 $ |
| Écriture de cache | 413 206 | 2,51 $ |
| Lecture de cache | 5 125 926 | 2,54 $ |
| Sortie | 40 022 | 1,00 $ |
| **Total** | **5 579 352** | **6,04 $ — 5,25 €** |

**Ce qui coûte**

- **80 appel(s) au modèle** — un par réponse, outils compris —, dont 55 par des sous-agents — 2 803 143 jetons, 2,88 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 722 jetons, écrits une fois par session puis relus à chaque
  échange : 1 649 328 jetons de relecture, 32 % de tout ce qui a été relu.
- **Tours courts** — 58 des 80 tours (72 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 3,25 $, soit 53 % de la facture.
  Dont 48 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 5, dont la plus longue fait 16 tours,
  relit 51 041 jetons par tour en moyenne et coûte 0,87 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 68 722 jetons relus au premier appel qui relise
  quelque chose, 157 063 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 5579352 -->
<!-- cout-agent-max: 16 -->
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
26 agent claude-opus-5 13155 0 477
27 agent claude-opus-5 3982 13155 5
28 agent claude-opus-5 4000 17137 2
29 agent claude-opus-5 5731 21137 3
30 agent claude-opus-5 1814 26868 2
31 agent claude-opus-5 9164 28682 3
32 agent claude-opus-5 10603 37846 4
33 agent claude-opus-5 8654 48449 4
34 agent claude-opus-5 15739 24987 1
35 agent claude-opus-5 3031 40726 3
36 agent claude-opus-5 3318 43757 4
37 agent claude-opus-5 9526 47075 3
38 agent claude-opus-5 2904 56601 978
39 agent claude-opus-5 1930 59505 886
40 agent claude-opus-5 2842 61435 4
41 agent claude-opus-5 3035 64277 546
42 agent claude-opus-5 634 67312 9
43 agent claude-opus-5 2156 67946 2
44 agent claude-haiku-4-5-20251001 11780 0 4
45 agent claude-haiku-4-5-20251001 1366 11780 2
46 agent claude-haiku-4-5-20251001 440 13146 3
47 agent claude-haiku-4-5-20251001 488 13586 5
48 agent claude-haiku-4-5-20251001 523 14074 4
49 agent claude-haiku-4-5-20251001 378 14597 2
50 agent claude-opus-5 40830 0 1
51 agent claude-opus-5 1575 40830 17
52 agent claude-opus-5 1925 42405 3
53 agent claude-opus-5 3105 44330 3
54 agent claude-opus-5 1868 47435 2
55 agent claude-opus-5 1076 49303 212
56 agent claude-opus-5 1745 50379 3
57 agent claude-opus-5 2354 52124 2
58 agent claude-opus-5 2283 54478 3
59 agent claude-opus-5 1391 56761 3
60 agent claude-opus-5 1110 58152 3
61 agent claude-opus-5 654 59262 2
62 agent claude-opus-5 5123 59916 3
63 agent claude-opus-5 1982 65039 5
64 agent claude-opus-5 2210 67021 3
65 agent claude-opus-5 3625 69231 5
66 agent claude-opus-5 15941 24987 1
67 agent claude-opus-5 1636 40928 417
68 agent claude-opus-5 5109 42564 3
69 agent claude-opus-5 5228 47673 4
70 agent claude-opus-5 4926 52901 462
71 agent claude-opus-5 1591 57827 506
72 agent claude-opus-5 4914 59418 5
73 agent claude-opus-5 3887 64332 3
74 agent claude-opus-5 2383 68219 2
75 agent claude-opus-5 2983 70602 4
76 agent claude-opus-5 3694 73585 3
77 agent claude-opus-5 5321 77279 4
78 agent claude-opus-5 1573 82600 3
79 agent claude-opus-5 1382 84173 2
80 agent claude-opus-5 4345 85555 1
-->
<!-- /cout -->
