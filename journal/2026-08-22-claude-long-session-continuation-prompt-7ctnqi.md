# 2026-08-22 — claude/long-session-continuation-prompt-7ctnqi

Branche : `claude/long-session-continuation-prompt-7ctnqi`
Périmètre : fabrique — contrat, `memory/`, `lib/journal.sh`, `scripts/cout.sh`,
`.claude/commands/livrer.md`. Aucune app touchée.
Mode : `chaud`

Sujet : quand la session annonce qu'elle est devenue trop longue, son message
doit se terminer par un prompt de reprise, copiable tel quel dans une session
neuve.

## Anomalies

### 1. La coupe était annoncée sans rien pour la reprendre

**Symptome** — le dépôt sait dire « coupe la session » à trois endroits —
l'avertissement de `cout.sh` à 300 000 jetons, son refus à 600 000, et la
proposition de `/livrer` — et aucun ne dit ce que la session neuve reçoit. Le
contrat décrivait pourtant déjà par quoi elle doit repartir : PRD, PRP, entrée de
journal, messages de commit, « jamais par le fil de la conversation ».

**Cause** — la règle était écrite du côté de la session qui **arrive**, jamais du
côté de celle qui **part**. Or elle seule sait où le travail en est : ce qui est
poussé, ce qui reste, les pistes déjà fermées. Non transmis, cet état meurt avec
le conteneur, et la session neuve le rachète en explorant — soit exactement le
coût qu'on coupait pour éviter. L'utilisateur l'a demandé après l'avoir payé.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la règle entre dans `CLAUDE.md`, son gabarit dans
`memory/travail.md`, et le rappel dans les deux messages d'alerte de `cout.sh` :
c'est le seul moment où elle s'applique, donc le seul endroit où elle sera lue.

### 2. `branche.sh` n'ouvrait plus aucune entrée de journal

**Symptome** — `./scripts/branche.sh claude/<sujet>` sur une branche existante
annonce « branche existante », puis sort en code 1 sans un mot de plus. Aucune
entrée de journal n'est créée. `pret.sh` refuse ensuite le commit pour entrée
manquante, et le geste censé la créer est précisément celui qui échoue.

**Cause** — le suffixe `--2` des noms de branche réutilisés était calculé
**dans** l'affectation du chemin :
`f="…-$slug$([ "$rang" -gt 1 ] && printf -- '--%s' "$rang").md"`. L'affectation
hérite du code de sortie de la substitution ; au rang 1 — la première entrée d'un
nom de branche, c'est-à-dire le cas normal — le test est faux, l'affectation sort
non nulle, et `set -e` tue le script juste avant la création du fichier. Introduit
la veille, en même temps que le suffixe lui-même. Les deux cas de test existants
couvraient le rang 2 et l'entrée déjà présente ; le rang 1 n'en avait aucun, et
un test qui n'aurait pas activé `set -e` serait passé au vert sur le code cassé,
puisque la fonction rendait bien le bon chemin.

**Detecte par** — `auteur`

**Action** — `garde-fou` — suffixe calculé avant l'affectation, par un `if`, et
un troisième cas dans `test-pret.sh` qui lance `journal_ouvre` sous `set -e` sur
un dépôt sans entrée. Vérifié rouge sur le code d'avant, vert après.

### 3. Deux comportements neufs sans assertion, trouvés par la relecture

**Symptome** — le `relecteur` rend trois constats, tous fondés. Deux tiennent à la
même chose : ce qui vient d'être ajouté n'était vérifié par aucun test. Le rappel
du prompt de reprise dans les deux messages d'alerte de `cout.sh` — une
reformulation l'aurait fait disparaître avec 27 cas au vert. Et les deux cas de
journal préexistants lançaient toujours `journal_ouvre` **hors** `set -e` : la même
classe de régression restait possible sur les chemins « rang 2 » et « entrée déjà
présente », seul le troisième cas étant protégé.

**Cause** — le réflexe s'est arrêté au bug corrigé au lieu de couvrir la classe.
Un test écrit pour attraper un bug précis laisse debout tous ses frères ; et une
règle de comportement — ici « le message rappelle le prompt de reprise » — n'est
tenue que si quelque chose rougit quand elle disparaît, ce que le fichier disait
déjà de la règle elle-même.

**Detecte par** — `relecture`

**Action** — `garde-fou` — `set -e` remonté dans `journal_cas`, qui vérifie
désormais le code de sortie autant que le chemin rendu, et les trois cas passent
par lui ; deux cas neufs dans `test-cout.sh` assertent le rappel dans les deux
messages, vérifiés rouges en le retirant. Le troisième constat, une apostrophe
manquante, est corrigé sans suite.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-22 à 09:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 8 666 | 0,04 $ |
| Écriture de cache | 334 236 | 2,09 $ |
| Lecture de cache | 6 797 718 | 3,40 $ |
| Sortie | 43 721 | 1,09 $ |
| **Total** | **7 184 341** | **6,62 $ — 5,75 €** |

**Ce qui coûte**

- **82 appel(s) au modèle** — un par réponse, outils compris —, dont 16 par des sous-agents — 595 554 jetons, 0,65 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 491 jetons, écrits une fois par session puis relus à chaque
  échange : 4 451 915 jetons de relecture, 65 % de tout ce qui a été relu.
- **Tours courts** — 48 des 82 tours (58 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,83 $, soit 42 % de la facture.
  Dont 13 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 1, dont la plus longue fait 16 tours,
  relit 33 733 jetons par tour en moyenne et coûte 0,65 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
- **Croissance** — 68 491 jetons relus au premier appel qui relise
  quelque chose, 29 208 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 7184341 -->
<!-- cout-agent-max: 16 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68491 0 596
2 principal claude-opus-5 3860 68491 319
3 principal claude-opus-5 3297 72351 511
4 principal claude-opus-5 4537 75648 373
5 principal claude-opus-5 1466 80185 223
6 principal claude-opus-5 6215 81651 2035
7 principal claude-opus-5 4042 87866 199
8 principal claude-opus-5 3247 91908 244
9 principal claude-opus-5 703 95155 93
10 principal claude-opus-5 2933 95858 2998
11 principal claude-opus-5 3017 98791 1584
12 principal claude-opus-5 1743 101808 189
13 principal claude-opus-5 568 103551 1826
14 principal claude-opus-5 1910 104119 263
15 principal claude-opus-5 388 106029 135
16 principal claude-opus-5 293 106417 95
17 principal claude-opus-5 764 106710 93
18 principal claude-opus-5 959 107474 746
19 principal claude-opus-5 779 108433 532
20 principal claude-opus-5 759 109212 678
21 principal claude-opus-5 1019 109971 414
22 principal claude-opus-5 604 110990 94
23 principal claude-opus-5 1527 111594 1093
24 principal claude-opus-5 1150 113121 128
25 principal claude-opus-5 614 114271 461
26 principal claude-opus-5 629 114885 1561
27 principal claude-opus-5 1699 115514 437
28 principal claude-opus-5 914 117213 120
29 principal claude-opus-5 793 118127 240
30 principal claude-opus-5 646 118920 900
31 principal claude-opus-4-7 35328 0 228
32 principal claude-opus-4-7 503 35328 205
33 principal claude-opus-5 954 119566 1749
34 principal claude-opus-5 1843 120520 171
35 principal claude-opus-4-7 6120 29208 275
36 principal claude-opus-4-7 429 35328 98
37 principal claude-opus-5 481 122363 141
38 principal claude-opus-4-7 275 35757 205
39 principal claude-opus-5 375 122844 175
40 principal claude-opus-4-7 21970 35831 2060
41 principal claude-opus-4-7 0 35328 106
42 principal claude-opus-4-7 189 35328 96
43 principal claude-opus-4-7 283 35517 82
44 principal claude-opus-5 1487 123219 267
45 principal claude-opus-4-7 16492 35800 81
46 principal claude-opus-4-7 5442 52292 80
47 principal claude-opus-5 1038 124706 832
48 principal claude-opus-4-7 30467 36032 2803
49 principal claude-opus-4-7 8596 57734 2459
50 principal claude-opus-4-7 3314 66330 1188
51 principal claude-opus-5 1215 125744 628
52 principal claude-opus-5 967 126959 309
53 principal claude-opus-5 2033 128235 557
54 principal claude-opus-5 1977 130268 215
55 principal claude-opus-5 359 132245 141
56 principal claude-opus-5 942 132604 393
57 principal claude-opus-5 1563 133546 257
58 principal claude-opus-5 517 135109 2047
59 principal claude-opus-5 2078 135626 1899
60 principal claude-opus-5 2368 137704 242
61 principal claude-opus-5 435 140072 122
62 principal claude-opus-5 507 140507 422
63 principal claude-opus-5 594 141014 154
64 principal claude-opus-5 639 141608 1617
65 principal claude-opus-5 1674 142247 193
66 principal claude-opus-4-7 7334 29208 132
67 agent claude-opus-5 12325 0 220
68 agent claude-opus-5 2612 12325 17
69 agent claude-opus-5 2381 14937 2
70 agent claude-opus-5 7049 17318 334
71 agent claude-opus-5 6658 24367 323
72 agent claude-opus-5 3486 31025 991
73 agent claude-opus-5 2808 34511 3
74 agent claude-opus-5 1822 37319 2
75 agent claude-opus-5 3088 39141 2
76 agent claude-opus-5 696 42229 2
77 agent claude-opus-5 879 42925 3
78 agent claude-opus-5 2235 43804 3
79 agent claude-opus-5 2904 46039 3
80 agent claude-opus-5 2669 48943 2
81 agent claude-opus-5 1621 51612 3
82 agent claude-opus-5 649 53233 2
-->
<!-- /cout -->
