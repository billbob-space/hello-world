# 2026-08-05 — claude/token-consumption-stats-e7bb1e

Branche : `claude/token-consumption-stats-e7bb1e`
Périmètre : fabrique
Mode : `chaud`

Sujet : rendre le relevé de coût juste, attribué, et exploitable. Parti d'une
demande de statistiques sur le journal, qui a mis au jour un compteur faux.

## Anomalies

### 1. Le relevé comptait chaque requête deux à trois fois

**Symptome** — les huit entrées de journal déjà relevées portent un total gonflé
d'un facteur voisin de deux. Mesuré sur la session courante : 35 lignes de
facture pour 15 requêtes réelles, soit 2,23x. La fabrique n'a pas coûté 363 $
mais de l'ordre de 150 $, et aucun des chiffres consignés n'est comparable à un
autre — le facteur dépend du nombre d'outils appelés par réponse.

**Cause** — le fichier de conversation écrit **une ligne par bloc de la
réponse** — la réflexion, le texte, chaque appel d'outil — et chacune reporte le
même objet `usage`. Le relevé additionnait toutes les lignes portant le motif
sans jamais se demander si deux d'entre elles décrivaient la même requête. Le
commentaire de la fonction traitait pourtant deux pièges *internes* à `usage`
(`iterations`, `cache_creation`) : l'attention était sur la structure de l'objet,
jamais sur sa multiplicité.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `test-cout.sh`, qui n'existait pas : le relevé rend un
nombre à sept chiffres qu'aucune relecture ne peut vérifier à l'œil, et un nombre
faux ressemble trait pour trait à un nombre juste. La déduplication se fait sur
`requestId`, présent sur 100 % des lignes facturées et unique par requête.

### 2. Deux branches d'un même conteneur se volaient leur consommation

**Symptome** — `2026-08-04-ardoise-activation.md` porte 275 M jetons et
`2026-08-04-compteur-activation.md` 282 M, relevés à **deux minutes d'écart**.
Ce n'est pas deux fois le travail : c'est le même travail, écrit dans deux
entrées, la seconde ayant recompté la première.

**Cause** — `cout_releve` lisait tous les `*.jsonl` du répertoire sans regarder
`gitBranch`, pourtant présent sur chaque ligne. Le champ existait, il n'était pas
lu.

**Detecte par** — `auteur`

**Action** — `garde-fou` — attribution par branche, et ce qui appartient à une
autre branche est **dit** plutôt que tu. Sont retenus la branche courante, la
base et les lignes sans champ : une session cloud ouvre sa branche après
quelques échanges, et les exclure amputerait le relevé de son propre début.

### 3. Le relevé mesurait sans permettre de décider

**Symptome** — question posée : « où optimiser ? ». Les quatre postes — entrée,
écriture, lecture, sortie — n'y répondaient pas. Il a fallu écrire du Python
jetable sur le fichier brut pour découvrir que **le démarrage pèse 54 738 jetons
relus à chaque appel, soit la moitié à 80 % de toute la relecture** selon la
longueur de la session, et que le contrat du dépôt n'en fait que 7 % — le reste
étant l'outillage embarqué.

**Cause** — le relevé avait été conçu pour figer un chiffre avant que le
conteneur disparaisse, pas pour dire où agir. Objectif atteint, question suivante
non anticipée.

**Detecte par** — `utilisateur`

**Action** — `contrat` — section « Ce qui coûte » : appels au modèle, part des
sous-agents, poids du démarrage et sa part de la relecture, croissance du premier
au dernier appel. `memory/travail.md` décrivait les quatre postes comme le
contenu du bloc ; il décrit maintenant ce qui s'y ajoute et pourquoi.

### 4. Rien ne survivait au conteneur, sauf un total

**Symptome** — dix des dix-huit branches n'ont aucun relevé, et les huit qui en
ont un ne gardent qu'un total désormais connu comme faux — donc irrécupérable :
recalculer demanderait le fichier de conversation, qui n'existe plus.

**Cause** — le bloc consignait le résultat, jamais la donnée. Un total ne se
recalcule pas ; une suite d'appels, si.

**Detecte par** — `auteur`

**Action** — `contrat` — le bloc porte désormais `cout-detail`, un appel par
ligne : rang, agent, modèle, écriture, lecture, sortie. Compact et illisible à
dessein, son lecteur est un outil. Les huit relevés antérieurs restent faux et le
resteront ; ils se reconnaissent à l'absence de section « Ce qui coûte ».

### 5. La notice d'une app se désynchronise sans que personne n'y touche

**Symptome** — `./init.sh --check` refusait le dépôt sur
`apps/ramure-v2/CLAUDE.md desynchronise`, sur une branche qui n'a jamais ouvert
`apps/`. L'écart : une ligne, l'entrée `PRODUCT.md` dans « Ses documents ».

**Cause** — ajouter un `PRODUCT.md` à une app change sa notice générée. Le commit
qui l'a ajouté n'a pas relancé `./init.sh`, et le contrat étant le verrou de tous
les autres jobs, cet oubli bloque la CI de **toutes** les apps, sur n'importe
quelle branche.

**Detecte par** — `auteur`

**Action** — `rien` — resynchronisé en commit séparé. Le garde-fou existe déjà et
a fonctionné : `--check` l'a nommé, et `pret.sh` le lance avant chaque commit.

### 6. Le générateur a écrit une anomalie fantôme dans le document qu'il complète

**Symptome** — `pret.sh` a refusé l'étape juste après l'ajout de la section « Ce
qui coûte » : « 5/6 champs `Detecte par` valides ». Rien ne manquait dans les cinq
anomalies écrites — c'est le **titre du bloc généré** qui était compté comme une
sixième.

**Cause** — `--check` dénombre les anomalies sur les lignes `### `, et le bloc de
coût en avait introduit une. Un générateur qui écrit dans un document vérifié
doit se plier à la forme de ce document ; celui-ci ne connaissait que sa propre
mise en page. Le titre est devenu un paragraphe en gras.

**Detecte par** — `test`

**Action** — `garde-fou` — un onzième cas dans `test-cout.sh` : il écrit le bloc
pour de vrai dans une entrée de journal, puis relance `./init.sh --check`. Les
dix autres cas lisaient la sortie affichée, et aucun n'aurait vu celui-là — le
défaut n'était pas dans ce que le relevé calcule, mais dans l'endroit où il
l'écrit.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-05 à 19:49 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 144 | 0,00 $ |
| Écriture de cache | 260 927 | 1,11 $ |
| Lecture de cache | 9 325 674 | 4,52 $ |
| Sortie | 68 893 | 1,54 $ |
| **Total** | **9 655 638** | **7,17 $ — 6,22 €** |

**Ce qui coûte**

- **77 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 738 jetons, écrits une fois par session puis relus à chaque
  échange : 4 160 088 jetons de relecture, 44 % de tout ce qui a été relu.
- **Croissance** — 54 738 jetons relus au premier appel qui relise
  quelque chose, 175 949 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 9655638 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54738 0 359
2 principal claude-opus-5 6615 54738 207
3 principal claude-opus-5 1413 61353 202
4 principal claude-opus-5 4337 62766 2646
5 principal claude-opus-5 2687 67103 846
6 principal claude-opus-5 3265 69790 397
7 principal claude-opus-5 944 73055 1522
8 principal claude-opus-5 2521 73999 764
9 principal claude-opus-5 1050 76520 472
10 principal claude-opus-5 700 77570 2162
11 principal claude-opus-5 2434 78270 363
12 principal claude-opus-5 498 80704 2163
13 principal claude-opus-5 2167 81202 865
14 principal claude-opus-5 5646 83369 329
15 principal claude-opus-5 11936 89015 2167
16 principal claude-opus-5 3365 100951 259
17 principal claude-opus-5 2170 104316 2681
18 principal claude-opus-5 3093 106486 1195
19 principal claude-opus-5 1253 109579 653
20 principal claude-opus-5 713 110832 587
21 principal claude-opus-5 805 111545 154
22 principal claude-opus-5 1398 112350 767
23 principal claude-opus-5 2714 113748 5614
24 principal claude-opus-5 5790 116462 114
25 principal claude-opus-5 629 122252 3182
26 principal claude-opus-5 4811 122881 5009
27 principal claude-opus-5 5084 127692 630
28 principal claude-opus-5 681 132776 110
29 principal claude-opus-5 2095 133457 706
30 principal claude-opus-5 757 135552 110
31 principal claude-opus-5 853 136309 2180
32 principal claude-opus-5 2361 137162 621
33 principal claude-opus-5 671 139523 92
34 principal claude-opus-5 404 140194 125
35 principal claude-opus-5 1432 140598 1032
36 principal claude-opus-5 1083 142030 195
37 principal claude-opus-5 246 143113 298
38 principal claude-opus-5 349 143359 189
39 principal claude-opus-5 238 143708 158
40 principal claude-opus-5 488 143946 771
41 principal claude-opus-5 1578 144434 208
42 principal claude-opus-5 449 146012 491
43 principal claude-opus-5 624 146461 483
44 principal claude-opus-5 981 147085 1837
45 principal claude-opus-5 1988 148066 2482
46 principal claude-opus-5 2525 150054 109
47 principal claude-opus-5 219 152579 2250
48 principal claude-opus-5 2452 152798 100
49 principal claude-opus-5 307 155250 1726
50 principal claude-opus-5 1775 155557 376
51 principal claude-opus-5 425 157332 454
52 principal claude-opus-5 503 157757 294
53 principal claude-opus-5 325 158260 99
54 principal claude-opus-5 548 158585 354
55 principal claude-opus-5 449 159133 716
56 principal claude-opus-5 1443 159582 222
57 principal claude-opus-5 3982 161025 145
58 principal claude-opus-5 391 165007 95
59 principal claude-opus-5 302 165398 509
60 principal claude-opus-5 544 165700 1312
61 principal claude-opus-5 1384 166244 103
62 principal claude-opus-5 4135 167628 100
63 principal claude-opus-4-7 42358 0 116
64 principal claude-opus-4-7 166 42358 88
65 principal claude-opus-4-7 186 42524 82
66 principal claude-opus-4-7 9866 42710 80
67 principal claude-opus-4-7 14888 42710 84
68 principal claude-opus-5 404 171763 580
69 principal claude-opus-5 631 172167 382
70 principal claude-opus-5 433 172798 340
71 principal claude-opus-5 521 173231 1408
72 principal claude-opus-5 1456 173752 101
73 principal claude-opus-5 332 175208 333
74 principal claude-opus-4-7 9546 57598 6541
75 principal claude-opus-5 409 175540 1128
76 principal claude-opus-4-7 6727 67144 147
77 principal claude-opus-5 1241 175949 122
-->
<!-- /cout -->
