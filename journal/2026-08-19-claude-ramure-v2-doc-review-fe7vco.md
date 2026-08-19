# 2026-08-19 — claude/ramure-v2-doc-review-fe7vco

Branche : `claude/ramure-v2-doc-review-fe7vco`
Périmètre : ramure-v2
Mode : `chaud`

Relecture du PRD (`apps/ramure-v2/PRODUCT.md`, 625 lignes) et de la série de neuf
PRP (`apps/ramure-v2/prp/`, 6 339 lignes) avant le lancement du développement.
Le compte rendu est ci-dessous ; les corrections qu'il appelle ont été écrites
dans la foulée, sur cette même branche, sauf les garde-fous de fabrique — qui
restent à écrire et sont nommés anomalie par anomalie.

La série tient : ordre des étapes, signatures figées d'un PRP à l'autre, tests
nommés avant le code, couverture du périmètre annoncée exigence par exigence,
aucun lien mort, `./init.sh --check` vert. Les anomalies ci-dessous sont ce qui
manque ou ce qui a périmé, pas un jugement d'ensemble.

## Anomalies

### 1. Le premier contrôle exécutable du PRP 01 échoue sur un dépôt sain

**Symptome** — échafaudage rejoué dans une copie du dépôt
(`./init.sh --add ramure-v2 --stack go --exposure google --ui …`, sections
`volumes:` et `env:` décommentées, `PRODUCT.md` recopié) : l'app est créée
conforme, `--check` reste vert et `--list` affiche exactement
`ramure-v2 8080 128m google go true desactivee`. Mais le bloc de vérification de
la tâche 1 sort en `ECHEC : le workflow cite une app` — sa dernière assertion,
`grep -qE 'ramure-v2|cadran|hello-world' .github/workflows/build.yml && echoue`,
matche deux commentaires du workflow (lignes 218-219) qui nomment
`apps/hello-world`, `apps/cadran` et `apps/ramure-v2` pour décrire un cas de
test. `hello-world` est de surcroît le **nom du dépôt** : il apparaîtrait aussi
dans n'importe quel chemin d'image `ghcr.io/billbob-space/hello-world/…`.

**Cause** — l'assertion cherche à prouver une propriété du workflow (« il ne
cite aucune app ») par une recherche de sous-chaîne sur trois noms, dont l'un est
aussi le nom du dépôt et sert donc dans toutes les adresses d'image. Elle a été
écrite le 5 août, en correction d'une assertion inverse qui, elle, cherchait le
nom de l'app dans le workflow ; la correction a changé le sens du test sans
changer sa méthode.

**Detecte par** — `relecture`

**Action** — `garde-fou` — c'est la deuxième fois que ce PRP est pris en défaut
sur un bloc de commande (cf. entrée du 5 août, anomalie 4, même conclusion). Les
blocs bash des PRP sont exécutables : un contrôle qui les rejoue dans une copie
jetable du dépôt les prendrait en défaut immédiatement, là où une relecture à
l'œil ne les voit pas. L'assertion est corrigée sur cette branche ; le contrôle,
lui, reste à écrire — rien ne le reverra la prochaine fois.

### 2. Cinq exigences du périmètre sont annoncées couvertes sans tâche ni test

**Symptome** — le tableau de couverture du README de la série liste bien les 51
exigences des lots MVP et V1 — que son texte d'introduction annonce, lui, à 35 —,
mais cinq d'entre elles n'ont, dans le PRP
désigné, ni tâche, ni fichier, ni test :

- **F-25** (choix du service d'écoute, *« le choix le suit d'un appareil à
  l'autre »*) → renvoyé au PRP 03, qui ne produit que le type `Service` et
  `LienEcoute`. Aucun écran ne propose le choix, et aucun stockage par
  utilisateur ne le transporte d'un appareil à l'autre — alors que le PRP 07
  monte précisément ce stockage pour la collection.
- **F-30** (contexte de découverte affiché) et **F-31** (replanter depuis la
  collection, lot MVP) → renvoyés au PRP 07, dont l'en-tête les couvre par la
  plage « F-28 à F-33 » mais dont les huit tests portent tous sur le magasin
  serveur. Le PRP 07 déclare **modifier** `web/src/collection.ts` — fichier
  qu'aucun PRP ne crée.
- **F-33** (collection utilisable hors ligne, réconciliation sans perte ni
  doublon) → seulement évoqué dans « ce que la suite attend de vous » du PRP 07,
  sans test alors que le README affirme F-32 et F-33 « ni dégradés ni en
  attente ».
- **N-10** (l'utilisateur exporte le journal de sa session) → annoncé dans
  l'en-tête du PRP 07, absent de ses deux tâches.

Deux métriques du lot V1 sont dans le même cas : `mesure.Evenement` ne compte
que `Plantation`, `Promotion`, `LienEcoute` et `Signet`, ce qui laisse **M-06**
(sessions amorcées depuis un artiste gardé) et **M-07** (sessions ouvertes depuis
un lien partagé) incalculables — or M-07 mesure le seul canal d'acquisition du
produit.

**Cause** — les PRP 03 à 09 ont été redistribués depuis un plan monolithique
supprimé (cf. entrée du 5 août, anomalie 1) en suivant le tableau de couverture.
Le tableau a été rempli par **destination** — quel PRP devrait porter quoi — et
non par **vérification** que le PRP écrit porte effectivement la tâche. Une
exigence citée dans un en-tête ressemble beaucoup à une exigence couverte.

**Detecte par** — `relecture`

**Action** — `garde-fou` — mécanisable sans jugement : pour chaque exigence
citée dans le tableau de couverture d'un `prp/README.md`, vérifier que son
identifiant apparaît dans le corps du PRP désigné. Les six trous ci-dessus se
seraient tous signalés seuls, et le septième aussi — un fichier « modifié » que
personne ne crée. Les six trous sont comblés sur cette branche — le PRP 06 gagne
le choix du service, le PRP 07 une tâche pour la collection à l'écran et deux
événements de mesure ; le contrôle, lui, reste à écrire.

### 3. Les décisions du PRD vivent dans le README des PRP, pas dans le PRD

**Symptome** — le PRD §17 pose cinq questions ouvertes « à trancher avant la fin
du MVP ». Les cinq sont tranchées, avec leurs raisons, dans le README de la
série : parité stricte, pas d'accès invité, session jetable, seuil de bascule
chiffré, francophone. Le PRD, lui, les pose toujours. Même chose pour la §16 et
la §04 : le palier `google` rend la promesse d'acquisition de la §03 et la cible
M-07 (≥ 10 % de sessions issues d'un lien partagé) inatteignables telles
qu'écrites, et rien dans le PRD ne le dit.

**Cause** — la série a été écrite comme un document d'exécution complet, y
compris pour ce qui relève de la décision produit. `memory/produit.md` place
pourtant les décisions dans `PRODUCT.md` et rappelle qu'*« un PRP livré ne se
rouvre jamais »* : laisser les arbitrages dans les PRP, c'est les ranger dans le
seul document qui ne se met pas à jour.

**Detecte par** — `relecture`

**Action** — `comportement` — remonter les cinq réponses dans le PRD avant le
premier commit de code, et y délimiter ou lever ce que le palier `google` rend
faux. C'est le mode de défaillance décrit par `memory/produit.md` : le document
ne devient pas faux quand on l'écrit, mais quand on livre autre chose sans le
rouvrir.

### 4. Le tableau des risques du PRD n'a pas la colonne « Test » exigée

**Symptome** — `memory/produit.md` impose une **colonne finale « Test »** à tout
tableau « Risques » d'un PRD et à tout tableau de cas d'échec d'un PRP : soit un
nom de test entre guillemets inverses, soit « non testable » et sa raison. La
§14 du PRD porte trois colonnes — Risque, Gravité, Mitigation exigée — et aucune
mention de test.

**Cause** — le contrôle `check_traces_risques` d'`init.sh` **n'exige pas** la
colonne : il ne juge un tableau que s'il en porte déjà une, faute de quoi toute
cellule entre guillemets inverses serait prise pour un nom de test. La règle est
donc écrite dans `memory/produit.md` et tenue par personne — et ce PRD est passé
au travers.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un tableau dont l'en-tête contient « Risque » peut,
lui, être reconnu sans ambiguïté : c'est le déclencheur qui manque au contrôle
existant. La règle a été écrite après le défaut livré de `renaissance-gym`, où
un refus spécifié trois fois n'était testé nulle part. La colonne est écrite sur
cette branche ; le déclencheur, lui, manque toujours au contrôle.

### 5. Les deux PRD de ramure sont identiques, et rien ne dit ce qui les sépare

**Symptome** — `apps/ramure-v2/PRODUCT.md` est la copie **octet pour octet** de
`apps/ramure/PRODUCT.md`, et le PRP 01 en fait une assertion de test (`cmp -s`).
Or `apps/ramure` est en ligne, couvre selon son README les lots MVP et V1 plus
F-18 et F-27, en 25 Mo et sans dépendance. Aucun des deux documents ne dit ce
que v2 apporte, ni ce que devient v1 après la mise en ligne de v2 — deux
sous-domaines, deux blocs de compose et 256 Mo de plafond mémoire pour un seul
produit. La divergence est mécanique : une correction portée sur l'un des deux
PRD laisse l'autre affirmer le contraire, sans que rien ne le signale.

**Cause** — l'écart réel entre les deux versions (palier `google`, collection
persistante, fournisseur du rôle 1, chaîne TypeScript) est une décision prise
oralement puis consignée dans le README de la série et dans l'entrée du 5 août,
jamais dans le PRD — qui reste celui du produit générique de juillet, écrit avant
que l'app n'ait un palier d'exposition ni un serveur.

**Detecte par** — `relecture`

**Action** — `arbitrage` — trois sorties possibles, et c'est une décision
produit : retirer v1 à la mise en ligne de v2 (le PRD n'a alors qu'un domicile),
donner à v2 un PRD propre qui dise ce qu'il ajoute, ou reporter les trois écarts
sur v1 et abandonner la réécriture. La note du 5 août avait tranché « poursuivre
la série » sans trancher celle-ci.

### 6. Le budget d'appels, exigence critique, n'a pas le même chiffre dans deux documents

**Symptome** — N-03 est marquée *critique* et son test (`Compte(MusicBrainz) ==
2`) est présenté comme le gardien de l'exigence. Deux chiffres divergent
pourtant autour de lui : le README de la série compte **2 appels Last.fm pour le
centre**, le tableau de composition du PRP 04 n'en compte **qu'un** (le vivier).
L'écart, c'est `Profil` — que le PRP 03 et le PRP 06 réservent à l'ouverture de
la fiche, alors que le PRD §07 range le profil du centre parmi les éléments
permanents de l'écran B. Selon la lecture retenue, chaque promotion coûte un
appel Last.fm de plus, et le test qui protège N-03 ne compte que MusicBrainz et
Cover Art Archive : il ne verrait rien.

**Cause** — le chiffre a été recopié dans deux tableaux au lieu d'être tenu à un
seul endroit, et l'ambiguïté du PRD sur le moment où la fiche se charge n'a
jamais été tranchée par écrit.

**Detecte par** — `relecture`

**Action** — `comportement` — trancher « la fiche du centre est-elle chargée
avec l'arbre ou à l'ouverture du panneau ? » dans le PRD, puis ne garder qu'un
seul tableau de budget, cité par les autres.

### 7. Aucun quota par utilisateur, alors que le palier ouvre l'app à tout compte Google

**Symptome** — la source la plus contrainte (MusicBrainz, 1 appel/s par adresse
IP) est partagée par tous les visiteurs, puisqu'ils sortent par le serveur. Le
seuil N-13 est chiffré à ≈ 5 promotions par seconde tous utilisateurs confondus.
Le limiteur du PRP 02 espace les appels **par source**, jamais par utilisateur :
un seul visiteur qui enchaîne les promotions ralentit tous les autres, et rien
dans la série ne borne sa part. Le palier `google` n'est pas la liste blanche du
serveur : c'est n'importe quel compte Google.

**Cause** — le budget a été conçu contre le risque « dépassement de quota »
(§14), pas contre le partage inéquitable de ce quota entre visiteurs. Le PRD
n'ayant pas de palier d'exposition, la question ne s'y posait pas.

**Detecte par** — `relecture`

**Action** — `arbitrage` — soit assumer (usage confidentiel, la file d'attente
suffit), soit borner par identité au PRP 02, qui est le seul endroit où ça se
pose sans se disperser. À écrire dans le PRD, pas seulement dans un PRP.

### 8. Deux affirmations d'outillage du PRP 01 et du PRP 05 ont péri en quatorze jours

**Symptome** — trois vérifications relevées à la relecture :

- le PRP 05 fait de l'ajout de `typescript-lsp@claude-plugins-official` un geste
  à faire à la main dans `.claude/settings.json`, suivi d'un recollage du *setup
  script*. Le plugin **y est déjà déclaré** depuis l'arrivée de
  `marcq-handball` (`stack: typescript`), et le rapport d'ouverture de session
  annonce 2/2 serveurs LSP présents : le geste est devenu un no-op qui ferait
  éditer un fichier partagé pour rien ;
- la vérification finale du PRP 01 attend `1/1 serveurs LSP presents` ; le
  rapport en annonce 2/2 ;
- le PRP 01 pousse et fusionne avec `gh pr create`, `gh pr checks --watch`,
  `gh pr merge` et `gh run list`. **`gh` n'existe pas dans une session cloud**
  (vérifié : introuvable), où les échanges avec GitHub passent par le serveur
  MCP. Et il y pousse sur un nom de branche écrit en dur,
  `claude/parallel-dev-versions-8d5g9c`, hérité de la session qui a rédigé le
  document.

Restent justes, en revanche : le nombre de branches et d'héritiers, le
comportement d'`--add`, le chemin du volume préfixé par le nom de l'app, la
sortie attendue d'`--list`, et le fait que l'échafaudage naisse désactivé.

**Cause** — la même que celle relevée le 5 août : *plus la série est précise,
plus elle a de surface à périmer*. Quatorze jours ont suffi, et l'une des trois
affirmations avait été **corrigée** ce jour-là — la correction elle-même a
vieilli.

**Detecte par** — `relecture`

**Action** — `garde-fou` — même conclusion qu'en 1 : ce sont des blocs de
commande, ils sont exécutables, et rien ne les rejoue. La règle de conduite
écrite le 5 août (« rejouer l'échafaudage dans une copie du dépôt avant
d'exécuter un PRP écrit plus d'une semaine plus tôt ») a fonctionné ici : elle
n'a rien coûté et a trouvé les anomalies 1 et 8, que la lecture seule n'aurait
pas vues. Les trois affirmations sont corrigées sur cette branche ; le contrôle
qui rejouerait les blocs de commande, lui, reste à écrire.

## Ce que la branche a corrigé, et ce qu'elle laisse ouvert

**Corrigé** — le PRD passe en 1.1 : questions tranchées (§17), annexe des quatre
questions (§18), retrait de la v1 et ce que la v2 change (§19), colonne « Test »
au tableau des risques, exigence N-14 neuve, et le moment où la fiche du centre
se charge (§07), qui faisait diverger le budget d'appels. La série gagne les six
tâches et tests qui manquaient, perd ses affirmations d'outillage périmées, et
son README ne fait plus autorité sur les décisions produit.

**Laissé ouvert, et c'est délibéré** — les trois garde-fous de fabrique que ces
anomalies appellent : rejouer les blocs de commande des PRP dans une copie
jetable, vérifier qu'une exigence citée dans un tableau de couverture apparaît
dans le corps du PRP désigné, et réclamer la colonne « Test » sur un tableau dont
l'en-tête dit « Risque ». Les trois valent pour toutes les apps, pas pour
`ramure-v2` : ils appartiennent à une branche `fabrique/`, pas à celle-ci.
`./scripts/pret.sh` le signale à chaque commit — c'est exact, et c'est bien
qu'il le dise.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 15:04 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 190 | 0,00 $ |
| Écriture de cache | 281 387 | 1,76 $ |
| Lecture de cache | 18 509 751 | 9,25 $ |
| Sortie | 84 592 | 2,11 $ |
| **Total** | **18 875 920** | **13,13 $ — 11,40 €** |

**Ce qui coûte**

- **95 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 451 jetons, écrits une fois par session puis relus à chaque
  échange : 6 152 394 jetons de relecture, 33 % de tout ce qui a été relu.
- **Tours courts** — 31 des 95 tours (32 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 3,63 $, soit 27 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 451 jetons relus au premier appel qui relise
  quelque chose, 279 852 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 18875920 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65451 0 224
2 principal claude-opus-5 1216 65451 209
3 principal claude-opus-5 1235 66667 541
4 principal claude-opus-5 4280 67902 134
5 principal claude-opus-5 1190 72182 152
6 principal claude-opus-5 5297 73372 102
7 principal claude-opus-5 7757 78669 102
8 principal claude-opus-5 5030 86426 427
9 principal claude-opus-5 482 91456 312
10 principal claude-opus-5 8203 91938 494
11 principal claude-opus-5 3331 100141 222
12 principal claude-opus-5 297 103472 116
13 principal claude-opus-5 6028 103769 116
14 principal claude-opus-5 4750 109797 137
15 principal claude-opus-5 6318 114547 105
16 principal claude-opus-5 7656 120865 166
17 principal claude-opus-5 9181 128521 172
18 principal claude-opus-5 7365 137702 228
19 principal claude-opus-5 3051 145067 1562
20 principal claude-opus-5 2830 148118 1057
21 principal claude-opus-5 3448 150948 621
22 principal claude-opus-5 1839 154396 456
23 principal claude-opus-5 777 156235 409
24 principal claude-opus-5 2009 157012 393
25 principal claude-opus-5 4064 159021 502
26 principal claude-opus-5 909 163085 219
27 principal claude-opus-5 1134 163994 382
28 principal claude-opus-5 5075 165128 683
29 principal claude-opus-5 4804 170203 554
30 principal claude-opus-5 1137 175007 352
31 principal claude-opus-5 4678 176144 1172
32 principal claude-opus-5 1720 180822 338
33 principal claude-opus-5 568 182542 285
34 principal claude-opus-5 795 183110 1403
35 principal claude-opus-5 1551 183905 354
36 principal claude-opus-5 444 185456 418
37 principal claude-opus-5 781 185900 1011
38 principal claude-opus-5 1399 186681 1425
39 principal claude-opus-5 1492 188080 157
40 principal claude-opus-5 928 189572 343
41 principal claude-opus-5 1273 190500 766
42 principal claude-opus-5 1240 191773 3996
43 principal claude-opus-5 4463 193013 493
44 principal claude-opus-5 562 197476 1572
45 principal claude-opus-5 1605 198038 430
46 principal claude-opus-5 578 199643 228
47 principal claude-opus-5 304 200221 1071
48 principal claude-opus-5 3741 200525 95
49 principal claude-opus-5 1790 204266 1054
50 principal claude-opus-5 1248 206056 105
51 principal claude-opus-5 1355 207304 7569
52 principal claude-opus-5 7667 208659 762
53 principal claude-opus-5 4963 216326 1119
54 principal claude-opus-5 1360 221289 963
55 principal claude-opus-5 1267 222649 120
56 principal claude-opus-5 315 223916 264
57 principal claude-opus-5 1805 224231 86
58 principal claude-opus-5 504 226036 1141
59 principal claude-opus-5 1751 226540 141
60 principal claude-opus-5 1064 228291 137
61 principal claude-opus-5 873 229355 551
62 principal claude-opus-5 636 230228 598
63 principal claude-opus-5 939 230864 4428
64 principal claude-opus-5 4583 231803 117
65 principal claude-opus-5 512 236386 4495
66 principal claude-opus-5 4514 236898 3645
67 principal claude-opus-5 3676 241412 653
68 principal claude-opus-5 834 245088 445
69 principal claude-opus-5 738 245922 112
70 principal claude-opus-5 826 246660 1249
71 principal claude-opus-5 1552 247486 883
72 principal claude-opus-5 1827 249038 208
73 principal claude-opus-5 224 250865 233
74 principal claude-opus-5 590 251089 2433
75 principal claude-opus-5 2464 251679 158
76 principal claude-opus-5 735 254143 951
77 principal claude-opus-5 970 254878 1475
78 principal claude-opus-5 1506 255848 898
79 principal claude-opus-5 929 257354 1326
80 principal claude-opus-5 1485 258283 1113
81 principal claude-opus-5 1144 259768 760
82 principal claude-opus-5 899 260912 1275
83 principal claude-opus-5 1306 261811 2551
84 principal claude-opus-5 2582 263117 1745
85 principal claude-opus-5 1776 265699 1565
86 principal claude-opus-5 1596 267475 466
87 principal claude-opus-5 1018 269071 2442
88 principal claude-opus-5 2473 270089 1414
89 principal claude-opus-5 1651 272562 1153
90 principal claude-opus-5 1856 274213 557
91 principal claude-opus-5 870 276069 1047
92 principal claude-opus-5 1126 276939 297
93 principal claude-opus-5 710 278065 814
94 principal claude-opus-5 1077 278775 1471
95 principal claude-opus-5 1535 279852 897
-->
<!-- /cout -->
