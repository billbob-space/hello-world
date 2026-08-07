# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Le seul geste de sortie du produit n'était offert qu'à ceux qui n'en avaient pas besoin

**Symptome** — un parent, après mise en ligne : *« j'ai déjà fait une boulette en
allant voir depuis mon téléphone et en créant un compte pour Charlie que je
n'arrive plus à supprimer pour qu'il me fasse lui-même de son tél »*.

Le serveur savait pourtant faire : `POST /api/classement` avec `supprimer: true`
accepte un nom et son code d'où que vienne la requête, et `classement.go` le dit
en toutes lettres — « le pseudonyme redevient libre », « aucune pierre tombale ».
C'est `monterSuppression` qui sortait par `return null` dès que
`lireClassement().pseudo` valait `null`, c'est-à-dire dès que le téléphone ne
portait plus le nom. Le chemin de sortie n'existait donc que pour celui qui
n'avait rien à réparer.

Pire, le produit **fabrique** lui-même l'état où le bouton disparaît : « Changer
d'enfant » efface la clé locale sans toucher au serveur. Son avertissement le
dit — *« plus personne ne pourra le supprimer. Supprime-le d'abord »* — ce qui
était exact, et aurait dû se lire comme le signalement d'un trou plutôt que comme
une mise en garde suffisante. Une phrase qui décrit une impasse à celui qui va y
entrer n'est pas un garde-fou : c'est la documentation du défaut.

**Cause** — le commentaire qui gardait la condition raisonnait juste sur une
prémisse fausse : « proposer de supprimer un nom qu'on n'a pas serait une
question sans réponse ». Vraie pour un enfant qui n'a jamais rejoint ; fausse
pour quiconque a créé un nom **ailleurs** — l'autre téléphone du foyer, ou le
sien avant d'avoir changé d'enfant. Le cas n'est pas exotique : c'est le premier
retour d'usage reçu sur cet écran.

La règle générale derrière : **un geste de sortie ne se conditionne pas à un état
local**. Le local dit ce que ce téléphone sait, jamais ce qui existe sur le
serveur, et un produit sans compte perd cet état par conception — c'est même la
promesse du § 5. Les deux autres gestes destructeurs de l'app, « changer
d'enfant » et « corriger son prénom », n'agissent que sur le téléphone : la
condition leur convenait, et elle a été reconduite sans être rejugée sur le seul
geste qui, lui, agit sur le serveur.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — aucun garde-fou automatique ne voit qu'un chemin de
sortie est conditionné à un état que le produit efface lui-même : il faudrait
relier une condition d'affichage à ce qu'une autre vue détruit. La question à
poser, elle, se pose à la main et tient en une ligne — *quel écran reste pour
défaire ceci, une fois ce téléphone remis à zéro ?* Elle vaut pour toute app de
la fabrique servant du `public` sans compte.

### 2. Le PRD n'était pas faux, et l'écran ne le tenait quand même pas

**Symptome** — le § 14 promettait un pseudonyme « supprimable », le § 7.4 fait du
code la clé qui commande la fiche. Aucune des deux lignes n'était démentie par
le code : le serveur les tenait toutes les deux. Le manquement vivait
**entre** le document et l'écran, dans une condition d'affichage que le PRD
n'énonçait nulle part et n'avait aucune raison d'énoncer.

**Cause** — le garde-fou de `pret.sh` cherche un fichier de code neuf dans une
app dont le `PRODUCT.md` ne bouge pas, et `memory/produit.md` oppose la
correction — qui « passe par une ligne déjà écrite » — à la capacité neuve. Ce
cas-ci n'est ni l'un ni l'autre proprement : il ne crée aucun fichier de code, et
la ligne du § 14 qu'il traverse était **déjà vraie**. Le rapprochement du
garde-fou reste bon ; c'est la grille à deux cases qui a un troisième cas, et il
est resté sans nom : *une promesse tenue par le serveur et non par l'écran*.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la section « Ce que le PRD dit reste vrai, ou il ment »
n'a que deux registres. Il en manque un troisième, celui-ci, et sa règle
d'écriture : préciser la ligne existante — ici *« supprimable depuis n'importe
quel téléphone »* — plutôt que d'ouvrir une capacité neuve pour ce qui était
déjà promis.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 19:53 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 122 | 0,00 $ |
| Écriture de cache | 184 739 | 1,15 $ |
| Lecture de cache | 8 463 593 | 4,23 $ |
| Sortie | 38 790 | 0,97 $ |
| **Total** | **8 687 244** | **6,36 $ — 5,52 €** |

**Ce qui coûte**

- **65 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 515 jetons, écrits une fois par session puis relus à chaque
  échange : 3 744 960 jetons de relecture, 44 % de tout ce qui a été relu.
- **Croissance** — 58 515 jetons relus au premier appel qui relise
  quelque chose, 184 174 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 8687244 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58515 0 477
2 principal claude-opus-5 4752 58515 149
3 principal claude-opus-5 653 63267 175
4 principal claude-opus-5 2527 63920 219
5 principal claude-opus-5 2698 66447 110
6 principal claude-opus-5 158 69145 71
7 principal claude-opus-5 13511 69303 270
8 principal claude-opus-5 6006 82814 202
9 principal claude-opus-5 1528 88820 368
10 principal claude-opus-5 3377 90348 123
11 principal claude-opus-5 2566 93725 298
12 principal claude-opus-5 684 96291 662
13 principal claude-opus-5 5012 96975 913
14 principal claude-opus-5 946 101987 123
15 principal claude-opus-5 451 102933 162
16 principal claude-opus-5 1850 103384 956
17 principal claude-opus-5 1133 105234 834
18 principal claude-opus-5 1017 106367 1511
19 principal claude-opus-5 1721 107384 1162
20 principal claude-opus-5 47 110266 947
21 principal claude-opus-5 3431 110313 183
22 principal claude-opus-5 1843 113744 180
23 principal claude-opus-5 263 115587 102
24 principal claude-opus-5 3583 115850 1709
25 principal claude-opus-5 5056 119433 2073
26 principal claude-opus-5 2088 124489 114
27 principal claude-opus-5 129 126577 207
28 principal claude-opus-5 1806 126706 818
29 principal claude-opus-5 1448 128512 113
30 principal claude-opus-5 1411 129960 222
31 principal claude-opus-5 1860 131371 206
32 principal claude-opus-5 2093 133231 123
33 principal claude-opus-5 1223 135324 234
34 principal claude-opus-5 527 136547 1452
35 principal claude-opus-5 2442 137074 123
36 principal claude-opus-5 1278 139516 327
37 principal claude-opus-5 1902 140794 2152
38 principal claude-opus-5 4345 142696 958
39 principal claude-opus-5 2129 147041 5277
40 principal claude-opus-5 5336 149170 122
41 principal claude-opus-5 478 154506 825
42 principal claude-opus-5 913 154984 1265
43 principal claude-opus-5 1329 155897 1992
44 principal claude-opus-5 2056 157226 255
45 principal claude-opus-5 319 159282 95
46 principal claude-opus-5 509 159601 269
47 principal claude-opus-5 545 160110 102
48 principal claude-opus-5 652 160655 163
49 principal claude-opus-5 602 161307 318
50 principal claude-opus-5 496 161909 90
51 principal claude-opus-5 179 162405 767
52 principal claude-opus-5 6924 162584 141
53 principal claude-opus-5 363 169508 126
54 principal claude-opus-5 1124 169871 361
55 principal claude-opus-5 551 170995 927
56 principal claude-opus-5 986 171546 253
57 principal claude-opus-5 268 172532 113
58 principal claude-opus-5 116 172800 119
59 principal claude-opus-5 182 172916 82
60 principal claude-opus-5 3616 173098 1908
61 principal claude-opus-5 1974 176714 89
62 principal claude-opus-5 776 178688 100
63 principal claude-opus-5 297 179464 351
64 principal claude-opus-5 4413 179761 1556
65 principal claude-opus-5 1726 184174 96
-->
<!-- /cout -->
