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

Relevé le 2026-08-22 à 09:18 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 71 | 0,00 $ |
| Écriture de cache | 158 194 | 0,99 $ |
| Lecture de cache | 3 221 677 | 1,61 $ |
| Sortie | 21 533 | 0,54 $ |
| **Total** | **3 401 475** | **3,14 $ — 2,73 €** |

**Ce qui coûte**

- **34 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 491 jetons, écrits une fois par session puis relus à chaque
  échange : 2 260 203 jetons de relecture, 70 % de tout ce qui a été relu.
- **Tours courts** — 16 des 34 tours (47 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,16 $, soit 37 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 491 jetons relus au premier appel qui relise
  quelque chose, 120 520 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 3401475 -->
<!-- cout-agent-max: 0 -->
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
-->
<!-- /cout -->
