# 2026-08-21 — claude/bonjour-snxoni

Branche : `claude/bonjour-snxoni`
Périmètre : fabrique
Mode : `chaud`

Compactage de `CLAUDE.md` avec la compétence `compact-claude-md` : 271 → 222 lignes,
2 418 → 1 823 mots, soit ~1 100 jetons de moins à chaque tour de chaque session.

Le tri a été vérifié contre le dépôt plutôt qu'à vue : `./init.sh --help` pour ce qui
était déjà découvrable, les deux hooks et les en-têtes `Tenu par` de `memory/` pour ce
qui était déjà tenu par un contrôle, et les 364 anomalies des 53 entrées de journal pour
savoir quelles règles avaient déjà servi. Ce dernier point a changé deux verdicts :
« déléguer à `artisan` » (69 mentions) et « grouper les appels d'outils » (30 mentions)
ressemblaient à des évidences, le journal dit qu'elles récidivent — gardées.

L'essentiel du gain vient des justifications (`DROP-HISTORY`) et des sections recopiées
du contrat alors que le sommaire de `memory/` y renvoie déjà. Aucun garde-fou n'est
parti : les 24 termes impératifs du contrat sont présents avant et après.

## Anomalies

### 1. Le contrat a dépassé son propre budget pendant plusieurs branches sans que rien ne l'arrête

**Symptome** — `./init.sh --check` affichait « CLAUDE.md 271 lignes, au-dela de 250 »
à chaque passage, sur une branche puis la suivante. Le contrat a continué de grossir :
l'avertissement était rendu à chaque fois, et à chaque fois rien n'en découlait.

**Cause** — le contrôle est un `warn` et non un `bad`, choix délibéré et commenté dans
`init.sh` (« un contrat a 260 lignes n'est pas un defaut de deploiement »). Le
raisonnement est juste sur le déploiement, mais il laisse le seul signal de dérive dans
un flot d'une centaine de lignes vertes, où il se lit comme du décor. La dérive que le
garde-fou devait rendre visible est redevenue invisible parce qu'il ne bloque pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — arbitrage rendu par l'utilisateur : ne pas rendre le contrôle
bloquant, mais faire remonter les avertissements. `warn()` les accumule désormais dans
`lib/socle.sh`, et `rappel_attn()` les réimprime juste avant le verdict de `--check` et
de `pret.sh`. Le verdict ne change pas — un avertissement ne bloque toujours pas — mais
il n'y a plus de fin de sortie où la dérive puisse se cacher. Le premier passage a fait
remonter **13** avertissements, dont trois que personne n'avait jamais mentionnés. Un
test le tient : `rappelle()` dans `test-init.sh`, vérifié en cassant le rappel exprès.

Une limite trouvée en le posant : le rappel ne couvre que **son** processus. `pret.sh`
délègue à `init.sh --check`, `cout.sh --rappel` et `revue.sh` comme à des processus
séparés — frontière délibérée, documentée en tête de `pret.sh` — donc leurs
avertissements meurent chez eux. Le premier jet annonçait « 1 avertissement » sous deux
lignes `attn`, ce qui se lisait comme un compte faux. L'en-tête nomme désormais le
script dont il rend compte, plutôt que de franchir une frontière posée pour de bonnes
raisons.

### 2. Le gain d'un compactage annoncé en lignes, mesuré en mots : l'annonce était fausse de 40 %

**Symptome** — le tri annonçait « 271 lignes → ~160 ». Le premier passage, qui appliquait
pourtant tous les verdicts annoncés sans exception, a rendu 232 lignes. Un second passage
a été nécessaire pour approcher la promesse, et elle n'a jamais été tenue : 222.

**Cause** — l'estimation a été faite en comptant les lignes que les verdicts allaient
retirer, comme si une ligne supprimée était une ligne de moins. Elle ne l'est pas : le
fichier est en Markdown replié à ~90 colonnes, donc retirer une justification de vingt
mots au milieu d'un paragraphe reflue les lignes suivantes et n'en supprime souvent
qu'une seule ; et ~40 % du fichier est structurel — titres de section, lignes vides,
tables — que le tri ne touche jamais. Le nombre de lignes n'est pas proportionnel à ce
qui est effectivement retiré.

**Detecte par** — `auteur`

**Action** — `comportement` — annoncer un compactage en mots ou en jetons, jamais en
lignes : ce sont les seules unités qui varient avec ce qu'on supprime réellement. Les
lignes ne servent qu'à parler au budget de `--check`, qui compte en lignes lui aussi.

### 3. Un commentaire d'`init.sh` nomme deux artefacts dérivés qui ne le sont plus

**Symptome** — en vérifiant la ligne du contrat qui énumère les artefacts générés, le
commentaire d'en-tête d'`init.sh` la contredit : il annonce « compose.yaml, le workflow,
.claude/, go.work » comme TOUJOURS réécrits, quand `CLAUDE.md` dit du workflow et de
`.claude/` qu'ils sont ordinaires.

**Cause** — `liste_derives()` ne rend que `compose.yaml`, `go.work` et les notices
`apps/*/CLAUDE.md` : c'est le contrat qui dit juste, et le commentaire qui a survécu au
retrait du workflow et de `.claude/` de la génération. Aucun contrôle ne relit les
commentaires, et celui-ci est en tête du fichier que lit quiconque veut comprendre la
génération — il fait croire qu'éditer `.github/workflows/build.yml` à la main serait
écrasé au prochain `./init.sh`, donc inutile.

**Detecte par** — `auteur`

**Action** — `rien` — corrigé dans la foulée, sur la même branche.

### 4. Le contrôle du corps de PR ne peut pas être satisfait sans pousser un commit

**Symptome** — le job `contrat` a échoué sur « la ligne « Code » de la section
« ## Revue » est vide ou sans date ». La ligne a été corrigée dans le corps de la pull
request, et rien ne s'est relancé : le job est resté rouge sur un reproche auquel le
texte affiché sur la PR ne correspondait plus.

**Cause** — deux choses se combinent. Le contrôle lit le corps dans la charge utile de
l'événement (`CORPS: ${{ github.event.pull_request.body }}`,
`.github/workflows/build.yml:61`), et le déclencheur `on: pull_request` est déclaré sans
`types:`, ce qui vaut `[opened, synchronize, reopened]` — `edited` n'en fait pas partie.
Modifier le corps ne déclenche donc aucun run, et relancer le job échoué rejouerait la
charge utile d'origine, donc l'ancien corps. Le seul événement qui fait relire le corps
à jour est `synchronize`, c'est-à-dire un commit poussé. Un contrôle qui porte sur un
texte éditable hors de git ne peut être re-vérifié qu'en modifiant git : la seule issue
mécanique est le commit vide, que le dépôt interdit par ailleurs et à juste titre.

**Detecte par** — `CI`

**Action** — `garde-fou` — arbitrage rendu par l'utilisateur : les deux à la fois, sans
le coût. `edited` entre dans les `types:` du déclencheur, et le job `detect` — qui
commande toute la chaîne en aval — saute sur cet événement, si bien qu'une retouche de
description ne relance que le job `contrat`, quelques secondes. Deux pièges refermés au
passage : `tests-de-l-outillage` juge le résultat de `detect` et devait sauter avec lui,
sans quoi il aurait refusé un « sauté » que personne n'a décidé ; et les runs `edited`
reçoivent leur propre voie de concurrence, sans quoi retoucher la description pendant
une vérification l'aurait **annulée** et remplacée par un run qui ne relit que le
corps — le code serait passé au vert sans avoir été vérifié.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 13:49 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 160 | 0,00 $ |
| Écriture de cache | 369 264 | 1,99 $ |
| Lecture de cache | 7 648 593 | 3,56 $ |
| Sortie | 57 100 | 1,40 $ |
| **Total** | **8 075 117** | **6,95 $ — 6,04 €** |

**Ce qui coûte**

- **80 appel(s) au modèle** — un par réponse, outils compris —, dont 26 par des sous-agents — 1 116 439 jetons, 0,53 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 219 jetons, écrits une fois par session puis relus à chaque
  échange : 3 615 607 jetons de relecture, 47 % de tout ce qui a été relu.
- **Tours courts** — 44 des 80 tours (55 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 3,08 $, soit 44 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 219 jetons relus au premier appel qui relise
  quelque chose, 176 200 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 8075117 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68219 0 183
2 principal claude-opus-5 4024 68219 511
3 principal claude-opus-5 1775 72243 438
4 principal claude-opus-5 9292 74018 762
5 principal claude-opus-5 3674 83310 521
6 principal claude-opus-5 3998 86984 657
7 principal claude-opus-5 2964 90982 1731
8 principal claude-opus-5 2748 93946 2317
9 principal claude-opus-5 4605 96694 4745
10 principal claude-opus-5 5918 101299 3018
11 principal claude-opus-5 155 110235 5652
12 principal claude-opus-5 5686 110390 5525
13 principal claude-opus-5 5561 116076 4569
14 principal claude-opus-5 4616 121637 976
15 principal claude-opus-5 2069 126253 374
16 principal claude-opus-5 833 128322 1059
17 principal claude-opus-5 1743 129155 221
18 principal claude-opus-5 514 130898 304
19 principal claude-opus-5 457 131412 265
20 principal claude-opus-5 2711 131869 3100
21 principal claude-opus-5 3130 134580 104
22 principal claude-opus-5 267 137710 358
23 principal claude-opus-5 605 137977 114
24 principal claude-opus-5 557 138582 1312
25 principal claude-opus-5 1372 139139 429
26 principal claude-opus-5 523 140511 109
27 principal claude-opus-4-7 3774 29200 134
28 principal claude-opus-4-7 242 32974 77
29 principal claude-opus-5 512 141034 177
30 principal claude-opus-5 637 141546 398
31 principal claude-opus-4-7 24339 33216 898
32 principal claude-opus-5 703 142183 185
33 principal claude-opus-5 1485 142886 2314
34 principal claude-opus-5 2379 144371 124
35 principal claude-opus-5 902 146750 99
36 principal claude-opus-5 1022 147652 137
37 principal claude-opus-5 1136 148674 466
38 principal claude-opus-5 550 149810 656
39 principal claude-opus-5 1006 150360 30
40 principal claude-opus-5 1165 151366 286
41 principal claude-opus-5 796 152531 160
42 principal claude-opus-5 3708 153327 1715
43 principal <synthetic> 0 0 0
44 principal claude-opus-5 114815 47678 30
45 principal claude-opus-5 854 162493 2863
46 principal claude-opus-5 3255 163347 229
47 principal claude-opus-5 2325 166602 854
48 principal claude-opus-5 940 168927 38
49 principal claude-opus-5 1482 169905 377
50 principal claude-opus-5 839 171387 1928
51 principal claude-opus-5 2121 172226 249
52 principal claude-opus-5 857 174347 650
53 principal claude-opus-5 996 175204 1795
54 principal claude-opus-5 2112 176200 742
55 agent claude-sonnet-5 15927 0 3
56 agent claude-sonnet-5 1485 15927 2
57 agent claude-sonnet-5 8123 17412 5
58 agent claude-sonnet-5 4680 25535 2
59 agent claude-sonnet-5 1639 30215 6
60 agent claude-sonnet-5 2674 31854 3
61 agent claude-sonnet-5 699 34528 2
62 agent claude-sonnet-5 1269 35227 6
63 agent claude-sonnet-5 3768 36496 6
64 agent claude-sonnet-5 3805 40264 3
65 agent claude-sonnet-5 807 44069 7
66 agent claude-sonnet-5 595 44876 6
67 agent claude-sonnet-5 442 45471 3
68 agent claude-sonnet-5 585 45913 3
69 agent claude-sonnet-5 1316 46498 2
70 agent claude-sonnet-5 660 47814 7
71 agent claude-sonnet-5 348 48474 20
72 agent claude-sonnet-5 935 48822 5
73 agent claude-sonnet-5 438 49757 20
74 agent claude-sonnet-5 445 50195 7
75 agent claude-sonnet-5 429 50640 3
76 agent claude-sonnet-5 2462 51069 3
77 agent claude-sonnet-5 1282 53531 2
78 agent claude-sonnet-5 249 54813 2
79 agent claude-sonnet-5 432 55062 2
80 agent claude-sonnet-5 802 55494 5
-->
<!-- /cout -->
