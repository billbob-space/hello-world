# 2026-08-07 — claude/marcq-handball-review-jlo3pz

Branche : `claude/marcq-handball-review-jlo3pz`
Périmètre : marcq-handball, fabrique
Mode : `chaud`

Revue de fin de projet de `marcq-handball` : état réel contre documents,
relecture du journal de la fabrique, et consolidation des relevés de jetons.
Deux dérives de documentation corrigées, le reste porté dans
`docs/2026-08-07-bilan-jetons-et-journal.md`.

## Anomalies

### 1. Le § 16 du PRD annonçait sept ajouts et en portait huit

**Symptôme** — l'introduction du § 16 de `apps/marcq-handball/PRODUCT.md` dit
« sept changements ont suivi dans la journée », puis répartit trois plus quatre
entre les § 16.1 à § 16.4. Le § 16.5 — le thème du club, écrit le lendemain —
n'entre dans aucun des deux comptes. La même phrase date la livraison des onze
PRP du 7 août ; les commits la datent du 6, et `prp/README.md` aussi.

**Cause** — un compte écrit en toutes lettres à côté de la liste qu'il compte.
La section suivante a été ajoutée sans que son introduction ne soit relue : rien
ne relie les deux, et aucun contrôle ne compare un nombre écrit à un nombre de
sous-sections.

**Detecte par** — `relecture`

**Action** — `comportement` — le § 16 est précisément la section qui existe pour
empêcher le PRD de mentir, et elle a menti la première. Ajouter une sous-section
à une liste comptée oblige à rouvrir son introduction ; le contrat le dit déjà
pour l'app, il vaut aussi pour le document.

### 2. Le README de l'app décrivait une récompense retirée le jour même

**Symptôme** — `apps/marcq-handball/README.md` affirmait que « la barre de
progression qui rebondit » est une transition CSS. Le rebond a été retiré le
7 août : le ressort est remplacé par une décélération franche, sans dépassement.

**Cause** — le commit qui a retiré le ressort a corrigé les deux endroits qui
l'avaient motivé — le § 10 du PRD, qui décrivait « du ressort », et le
commentaire de `web/style.css` — mais pas le troisième, qui n'était pas sous les
yeux. Une propriété change, ses mentions sont ailleurs.

**Detecte par** — `relecture`

**Action** — `garde-fou` — première idée, et elle est fausse : étendre au
`README.md` l'avertissement de `pret.sh` sur le `PRODUCT.md`. Vérification faite
sur le commit `57a22de`, le `README.md` **a bougé** — 85 lignes — dans le commit
fautif ; il a bougé incomplètement. Un garde-fou qui regarde si un fichier a été
touché ne peut pas voir ça. Ce qui le voit est un test qui lit ce que le
document **dit** et le compare au code, comme `tests/rejoindre.test.js` le fait
déjà pour le § 7.4 du PRD. C'est la tâche 1 de
`docs/superpowers/plans/2026-08-07-gardes-documentaires-et-mesure-des-jetons.md`.

### 3. Huit relevés de coût sur treize ne sont qu'un total

**Symptôme** — la consolidation des jetons de la fabrique ne peut se faire que
sur cinq entrées de journal. Treize portent un relevé, mais le détail par tour
(`<!-- cout-detail -->`) n'existe que dans les cinq dernières.

**Cause** — le bloc de détail a été ajouté à `cout.sh` après coup. Le total, lui,
ne se décompose pas : le fichier de conversation qui l'a produit vivait dans un
conteneur détruit depuis. Un relevé incomplet est aussi définitif qu'un relevé
manquant.

**Detecte par** — `auteur`

**Action** — `comportement` — une mesure d'outillage s'écrit dans sa forme
définitive dès le premier relevé. Ce qu'elle n'enregistre pas le premier jour est
perdu pour toutes les branches antérieures, et aucune version ultérieure ne le
rattrape.

### 4. Zéro tour de sous-agent sur 1 454

**Symptôme** — sur les cinq branches mesurables, aucun tour n'a été exécuté par
un sous-agent. La fabrique définit pourtant trois agents dont l'isolation de
contexte est la raison d'être, et `docs/superpowers/plans/2026-08-05-isolation-contexte-agents.md`
en porte le plan.

**Cause** — rien ne rappelle l'existence des agents au moment où un chantier
s'ouvre, et leur bénéfice est invisible tant que le coût n'est pas mesuré. Il
l'est maintenant : la relecture de contexte fait 73 % de la facture, et deux
branches ont dépassé 550 000 jetons de contexte.

**Detecte par** — `auteur`

**Action** — `outillage` — l'agent existe et ne sert jamais ; c'est un défaut
d'outillage, pas de discipline. Confier un chantier à l'`artisan` et comparer le
relevé de la branche à celui d'une branche comparable est le seul moyen de savoir
ce qu'il fait gagner.

### 5. Le plafond mémoire est dépassé depuis le 6 août, et rien n'a bougé

**Symptôme** — `./init.sh --check` avertit toujours : « mémoire engagée 1216 Mo
sur 9 service(s), au-delà du plafond 1024 Mo de `fabrique.yml` ».

**Cause** — l'anomalie 3 de `2026-08-06-claude-marcq-handball-app-7zqifi.md`
avait déjà porté le constat et conclu qu'il demandait un arbitrage humain. Cet
arbitrage n'a pas été rendu, et l'avertissement traverse les branches sans que
personne ne le voie comme le sien.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soit la RAM du serveur porte les 1216 Mo et le
plafond de `fabrique.yml` est à relever, soit elle ne les porte pas et une app
est à désactiver. Un avertissement qui dure trois jours cesse d'être lu.

### 6. Deux garde-fous lisent les commentaires exprès, et le plan voulait les en priver

**Symptôme** — la tâche 2 du plan listait sept emplacements à faire passer par
le nouveau `tests/source.js`, qui retire les commentaires. Deux d'entre eux —
`classement.test.js:101` (la sous-chaîne `prenom` dans la couche réseau) et
`recompenses.test.js:250` (le vocabulaire « bravo », « champion », « badge »)
— portent chacun un commentaire disant l'inverse : « le test lit AUSSI les
commentaires : un mot entré par la porte du commentaire finit dans une chaîne à
la retouche suivante ».

**Cause** — deux familles de garde-fous se ressemblent trait pour trait. L'un
surveille une **propriété du code** — pas de `innerHTML`, pas de `confirm(` — et
un commentaire qui la nomme est un faux positif. L'autre surveille un
**vocabulaire** — un mot qui n'a rien à faire dans cette app, où qu'il soit — et
le commentaire est alors une cible, pas un faux positif. Le plan a été écrit en
lisant les lignes d'assertion, pas les commentaires au-dessus.

**Conséquence tenue** — cinq emplacements convertis, deux laissés tels quels, et
la raison écrite dans `recompenses.test.js` à côté des deux voisins, qui sont
maintenant de familles différentes dans le même fichier.

**Detecte par** — `relecture`

**Action** — `comportement` — avant de convertir un garde-fou, lire le
commentaire qui le précède : dans ce dépôt, il dit souvent pourquoi la forme
naïve a été écartée. Un plan écrit sur les seules lignes de code aurait retiré
deux surveillances en croyant les réparer.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 19:25 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 360 | 0,00 $ |
| Écriture de cache | 368 557 | 2,30 $ |
| Lecture de cache | 11 884 267 | 5,94 $ |
| Sortie | 88 382 | 2,21 $ |
| **Total** | **12 341 566** | **10,46 $ — 9,08 €** |

**Ce qui coûte**

- **83 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  55 815 jetons, écrits une fois par session puis relus à chaque
  échange : 4 576 830 jetons de relecture, 38 % de tout ce qui a été relu.
- **Croissance** — 55 815 jetons relus au premier appel qui relise
  quelque chose, 231 061 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 12341566 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 55815 0 500
2 principal claude-opus-5 2371 55815 282
3 principal claude-opus-5 3321 58186 369
4 principal claude-opus-5 5668 61507 351
5 principal claude-opus-5 796 67175 207
6 principal claude-opus-5 916 67971 366
7 principal claude-opus-5 4058 68887 553
8 principal claude-opus-5 3566 72945 425
9 principal claude-opus-5 4127 76511 630
10 principal claude-opus-5 4900 80638 328
11 principal claude-opus-5 3784 85538 371
12 principal claude-opus-5 6087 89322 387
13 principal claude-opus-5 2548 95409 1651
14 principal claude-opus-5 2354 97957 2837
15 principal claude-opus-5 3339 100311 504
16 principal claude-opus-5 2186 103650 1438
17 principal claude-opus-5 1693 105836 301
18 principal claude-opus-5 368 107529 433
19 principal claude-opus-5 620 107897 939
20 principal claude-opus-5 1644 108517 326
21 principal claude-opus-5 362 110161 224
22 principal claude-opus-5 1131 110523 261
23 principal claude-opus-5 281 111654 509
24 principal claude-opus-5 524 111935 118
25 principal claude-opus-5 1562 112459 640
26 principal claude-opus-5 1119 114021 949
27 principal claude-opus-5 1033 115140 374
28 principal claude-opus-5 458 116173 276
29 principal claude-opus-5 331 116631 303
30 principal claude-opus-5 762 116962 124
31 principal claude-opus-5 1386 117724 1336
32 principal claude-opus-5 1732 119110 1752
33 principal claude-opus-5 2412 120842 446
34 principal claude-opus-5 519 123254 3590
35 principal claude-opus-5 3653 123773 467
36 principal claude-opus-5 830 127426 2200
37 principal claude-opus-5 2269 128256 348
38 principal claude-opus-5 478 130525 107
39 principal claude-opus-5 155 131003 220
40 principal claude-opus-5 547 131158 428
41 principal claude-opus-5 2921 131705 143
42 principal claude-opus-5 346 134626 93
43 principal claude-opus-5 571 134972 1313
44 principal claude-opus-5 1356 135543 105
45 principal claude-opus-5 278 136899 1133
46 principal claude-opus-5 145242 0 1440
47 principal claude-opus-5 3894 145242 2011
48 principal claude-opus-5 3705 149136 135
49 principal claude-opus-5 3081 152841 637
50 principal claude-opus-5 1320 155922 2489
51 principal claude-opus-5 3194 157242 1348
52 principal claude-opus-5 1800 160436 129
53 principal claude-opus-5 1315 162236 464
54 principal claude-opus-5 2172 163551 92
55 principal claude-opus-5 2651 165723 446
56 principal claude-opus-5 1226 168374 91
57 principal claude-opus-5 592 169600 2401
58 principal claude-opus-5 2491 170192 253
59 principal claude-opus-5 635 172683 2069
60 principal claude-opus-5 2614 173318 4582
61 principal claude-opus-5 6794 175932 18769
62 principal claude-opus-5 18848 182726 1724
63 principal claude-opus-5 4258 201574 1238
64 principal claude-opus-5 2711 205832 180
65 principal claude-opus-5 378 208543 141
66 principal claude-opus-5 2614 208921 2460
67 principal claude-opus-5 2696 211535 474
68 principal claude-opus-5 555 214231 1252
69 principal claude-opus-5 1334 214786 1877
70 principal claude-opus-5 1959 216120 481
71 principal claude-opus-5 563 218079 792
72 principal claude-opus-5 988 218642 141
73 principal claude-opus-5 500 219630 474
74 principal claude-opus-5 556 220130 465
75 principal claude-opus-5 547 220686 1042
76 principal claude-opus-5 1114 221233 486
77 principal claude-opus-5 682 222347 325
78 principal claude-opus-5 390 223029 988
79 principal claude-opus-5 3137 223419 2300
80 principal claude-opus-5 2382 226556 725
81 principal claude-opus-5 807 228938 1157
82 principal claude-opus-5 1316 229745 118
83 principal claude-opus-5 319 231061 1529
-->
<!-- /cout -->
