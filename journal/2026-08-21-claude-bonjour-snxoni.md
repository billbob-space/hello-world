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

**Action** — `arbitrage` — passer ce `warn` en `bad` rendrait le contrat bloquant pour
un dépassement d'une ligne, ce qui gêne au mauvais moment ; l'alternative est de faire
remonter les avertissements en fin de sortie plutôt que dans le flot. Les deux se
défendent, et c'est une décision qui appartient à l'utilisateur, pas un correctif.

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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 13:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 58 | 0,00 $ |
| Écriture de cache | 141 790 | 0,86 $ |
| Lecture de cache | 2 861 641 | 1,42 $ |
| Sortie | 39 488 | 0,98 $ |
| **Total** | **3 042 977** | **3,26 $ — 2,83 €** |

**Ce qui coûte**

- **27 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 219 jetons, écrits une fois par session puis relus à chaque
  échange : 1 773 694 jetons de relecture, 61 % de tout ce qui a été relu.
- **Tours courts** — 6 des 27 tours (22 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,83 $, soit 25 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 219 jetons relus au premier appel qui relise
  quelque chose, 29 200 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 3042977 -->
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
-->
<!-- /cout -->
