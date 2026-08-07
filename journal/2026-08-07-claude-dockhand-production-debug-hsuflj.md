# 2026-08-07 — claude/dockhand-production-debug-hsuflj

Branche : `claude/dockhand-production-debug-hsuflj`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le dépôt n'avait aucun chemin vers sa propre production

**Symptome** — la question posée était « comment te donner la capacité de débug
sur l'infra de production ». La réponse honnête, avant cette branche, était
« aucune » : ni SSH, ni socket Docker, ni la moindre route HTTP. Tout
`*.billbob.ovh` est derrière Traefik, qui exige un compte Google ; un agent n'a
pas de navigateur, donc pas de compte. Le seul moyen de savoir ce qu'une
application déployée fait vraiment était de demander une capture d'écran.

**Cause** — `memory/perimetre.md` énumère ce qui vit hors du dépôt — Traefik, le
DNS, la liste blanche, les valeurs des secrets — et conclut « n'écris pas de
demande pour lui ». Cette phrase est juste pour la *configuration*, et elle a été
lue comme valant aussi pour l'*observation*. Or les deux ne se ressemblent que de
loin : demander un réglage, c'est demander à quelqu'un d'agir une fois ;
regarder un journal, c'est ce qu'on fait vingt fois par heure quand quelque
chose ne marche pas. Le premier se délègue, le second non — et rien dans le
contrat ne distinguait les deux.

**Detecte par** — `utilisateur`

**Action** — `contrat` — le `README` porte désormais la section « Regarder la
production » : la porte de service, les deux variables, et le contrôle en trois
`curl` qui prouve que la porte reste étroite. `CLAUDE.md` y renvoie depuis le
paragraphe du déploiement, seul endroit où un agent pense à la production.

### 2. `dockhand` en édition libre ne sait pas faire un jeton en lecture seule

**Symptome** — le plan initial annoncé à l'utilisateur était « crée un jeton, je
m'en sers pour lire ». Vérification faite dans la documentation : le contrôle
d'accès par rôles est réservé à l'édition Enterprise, et en édition libre « tout
utilisateur authentifié a un accès administrateur complet ». Le jeton demandé
pouvait donc arrêter les neuf conteneurs de la stack, et rien côté `dockhand` ne
permettait de l'en empêcher.

**Cause** — avoir supposé qu'un outil d'administration moderne offre forcément
un palier de lecture. C'est vrai de la plupart, faux de celui-ci, et la
distinction ne se lit que dans la page des tarifs — pas dans la page de l'API,
qui est celle qu'on ouvre quand on cherche à automatiser.

**Detecte par** — `auteur`

**Action** — `contrat` — la lecture seule est obtenue **avant** `dockhand`, par
la règle du routeur Traefik : `Method(GET)`. Un `POST` ne l'atteint jamais, il
retombe sur le routeur d'origine et repart vers Google. Le `README` dit
explicitement que ce routeur est le seul verrou, pour que personne n'élargisse
la règle en croyant que `dockhand` garde encore quelque chose derrière.

### 3. Le premier test réussi ne prouvait rien : `/api/health` est ouvert

**Symptome** — porte ouverte, premier appel : `GET /api/health` répond `200`
avec un jeton. Conclusion tentante et fausse — « le jeton fonctionne ». Le même
appel **sans** jeton répond `200` lui aussi : cette route est publique dans
`dockhand`, l'en-tête d'autorisation n'a jamais été regardé. Il a fallu
`/api/containers` — `401` sans jeton, `200` avec — pour savoir quoi que ce soit.

**Cause** — une route de santé est faite pour répondre à un superviseur qui n'a
pas d'identité ; elle est donc, par construction, le pire endroit où tester une
authentification. Le réflexe « je commence par le point le plus simple » choisit
pourtant exactement celui-là.

**Detecte par** — `auteur`

**Action** — `comportement` — un contrôle d'accès se vérifie sur une route qui
porte des **données**, et toujours dans les deux sens : avec jeton et sans. Les
trois `curl` du `README` sont écrits comme ça, et le troisième — un `POST` qui
doit être refusé — est celui qui compte, parce qu'il est le seul dont l'échec
serait une urgence.

### 4. Le contrat était à une ligne de son plafond

**Symptome** — `CLAUDE.md` faisait 249 lignes pour un plafond de 250. Mentionner
`prod.sh` — deux phrases — a consommé le dernier crédit. Le sujet a donc été
écrit dans le `README` et seulement *annoncé* dans le contrat, alors que
`memory/` est l'endroit prévu pour ça.

**Cause** — le plafond est une bonne contrainte et il fonctionne : il a bien
empêché d'élargir le contrat. Mais il ne dit pas *où* déplacer ce qui déborde, et
`memory/` impose une contrepartie — `Tenu par : --check|CI|hook` — qu'un sujet
purement documentaire ne peut pas honorer. « Regarder la production » n'est tenu
par aucun contrôle : c'est une capacité, pas une règle. Il n'avait donc sa place
ni dans le contrat, ni dans `memory/`, et le `README` l'a reçu par défaut.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soit le plafond monte, soit `memory/` accepte un
sujet tenu par « rien » à condition qu'il ne porte aucune règle. Les deux se
défendent, et aucun agent ne devrait trancher seul un réglage qui décide de ce
que tous les suivants liront en permanence.

---

*La PR de cette branche a été fusionnée ; le harnais cloud lui a réassigné le même
nom pour un second sujet — l'optimisation de la CI. La branche est repartie de
`main`, l'entrée continue ici.*

### 5. Le job le plus long de la CI bloquait tout le reste sans rien tester de ce qui suivait

**Symptome** — 7 min 18 pour mettre en ligne une correction d'une ligne. Le
relevé jobs par jobs d'un run réel : 3 min 22 pour les tests de l'outillage,
1 min 10 pour les tests des applications, 1 min 43 pour les images, 1 min pour
la mise en ligne. Le premier poste pèse 45 % du total, et il tournait **avant**
les trois autres, qui l'attendaient dans leur `needs`.

**Cause** — le job a été écrit comme un jumeau du job `contrat`, avec un
commentaire qui l'assume : « les deux jobs durent donc autant l'un que l'autre
et tournent en parallèle ». C'était vrai à l'écriture. `contrat` fait
aujourd'hui 10 secondes, l'autre 3 min 22 — un facteur vingt. La phrase est
restée juste dans le fichier et fausse dans les faits, et personne ne relit un
commentaire pour vérifier qu'il vieillit bien. Rien ne mesurait la durée des
jobs : le seul chiffre visible est le total du run, où un poste qui grossit
ressemble à une CI qui grossit.

**Detecte par** — `utilisateur`

**Action** — `rien` — les tests de l'outillage ne testent pas les applications :
`test` et `build` ne les attendent plus, et ils ne tournent plus que si
l'outillage a bougé — 4 fusions sur 20 mesurées sur `main`. Seul `deploy` les
attend encore, parce qu'ils valident le verrou sur la foi duquel on met en ligne.

### 6. On reconstruisait les six images à chaque retouche du générateur, qui ne peut en changer aucune

**Symptome** — la fusion #75 ne touchait aucune application. Elle a fait
retester, reconstruire et republier les six, puis redéployer toute la pile.
Deux fusions sur vingt sont dans ce cas exact.

**Cause** — la règle disait : « le générateur a bougé, plus rien ne garantit que
les images correspondent aux `Dockerfile` courants ». Elle paraît prudente, elle
est simplement fausse : le contexte de construction est `apps/<app>` et rien
d'autre, donc aucun fichier hors de ce répertoire n'entre jamais dans une image.
Le raisonnement de prudence n'avait pas été confronté au fichier qui décide,
trente lignes plus bas dans le même workflow. C'est le piège propre aux
garde-fous larges : ils ne se trompent jamais dans le sens qui se voit.

**Detecte par** — `auteur`

**Action** — `rien` — seuls la recette de construction et `fabrique.yml`
élargissent désormais. Ce que le générateur change réellement, c'est
`compose.yaml`, un artefact committé : il apparaît de lui-même dans le diff et
déclenche déjà le redéploiement.

### 7. `always()` désarme le blocage de `needs`, et un job en échec ne bloquait plus la mise en ligne

**Symptome** — trouvé en relisant la condition de `deploy` pour y admettre le
saut. Le job liste cinq dépendances et n'en teste que quatre : les tests de
l'outillage n'y figuraient nulle part. Ils pouvaient donc échouer — le verrou de
toute la CI déclaré cassé — sans empêcher un déploiement.

**Cause** — `always()` est indispensable ici, pour distinguer « sauté » de
« échoué ». Mais il ne fait pas qu'ajouter cette nuance : il **retire** le
blocage implicite que `needs` pose d'ordinaire, sur *tous* les jobs à la fois.
La condition doit alors renommer chaque dépendance une par une, et la liste
n'est plus tenue par rien : ajouter un job à `needs` sans l'ajouter au `if` le
rend décoratif, en silence. Le commentaire d'origine explique bien pourquoi
`always()` est là, et pas du tout ce qu'il coûte.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le trou est bouché, mais rien n'empêche qu'il se
rouvre au prochain job ajouté. `--check` sait lire ce fichier : il pourrait
vérifier que tout job cité dans le `needs` d'un job en `always()` est aussi
nommé dans son `if`. C'est un contrôle purement textuel, et le seul endroit du
dépôt où une dépendance peut être déclarée puis ignorée sans erreur.

---

*La PR #76 a été fusionnée ; le harnais a réassigné le même nom pour un troisième
sujet — le mode de développement autonome. La branche est repartie de `main`,
l'entrée continue ici.*

### 8. Le contrat était de nouveau au plafond, et l'arbitrage 4 est resté ouvert

**Symptôme** — annoncer les deux commandes dans `CLAUDE.md` demandait trois
lignes. Le fichier en faisait 250 sur un plafond de 250. Il a fallu recomprimer
un paragraphe déjà écrit — celui de `pret.sh` et de la pull request — pour
libérer la place, puis raccourcir l'énumération qui renvoie à
`memory/travail.md`. Le sujet ajouté tient ; deux passages relus l'ont payé.

**Cause** — l'anomalie 4 de cette même entrée a signalé le problème et l'a laissé
en `arbitrage` : le plafond empêche bien le contrat d'enfler, mais il ne dit pas
où va ce qui déborde, et `memory/` exige une contrepartie — `Tenu par:` — qu'un
sujet purement documentaire ne peut pas honorer. Ici la contrepartie existait
(`--check` vérifie la présence des deux fichiers), donc `memory/travail.md` a
pu accueillir le détail. Mais le contrat doit tout de même *annoncer* le sujet,
et cette annonce n'a pas de place à elle : elle se prend sur la prose voisine.

Le coût est invisible dans le diff, et c'est ce qui le rend durable : on y voit
des reformulations, pas une perte. Rien ne compte combien de paragraphes ont été
resserrés pour faire entrer un sujet de plus.

**Detecte par** — `auteur`

**Action** — `arbitrage` — deuxième occurrence du même arbitrage. Soit le
plafond monte, soit le contrat se dote d'une section d'annonces courtes dont la
compression est assumée, soit on accepte que `--check` avertisse. Aucun agent ne
devrait trancher seul un réglage qui décide de ce que tous les suivants liront.

### 9. Avoir écrit dans `memory/` un comportement déduit, jamais observé

**Symptôme** — les deux commandes écrites, j'ai ajouté à `memory/travail.md` :
« une commande écrite en cours de session n'existe qu'à la suivante », et je l'ai
répétée dans le corps de la pull request, sous « Avant de fusionner ». Quelques
minutes plus tard le harnais a listé `/livrer` et `/pas-a-pas` comme disponibles,
dans la session même qui venait de les écrire. La phrase était fausse au moment
où je l'écrivais, et elle était déjà committée.

**Cause** — un raisonnement par symétrie, non vérifié : `memory/travail.md` dit
que le registre des **agents** est lu au démarrage, `memory/outillage.md` dit la
même chose des **plugins**. Les commandes leur ressemblent — même répertoire
`.claude/`, même genre de fichier — donc j'ai conclu au lieu de regarder. Le
comportement réel est l'inverse : le registre des commandes est relu en cours de
session. Trois registres voisins, trois comportements à vérifier séparément.

Ce qui rend l'erreur coûteuse n'est pas la déduction, c'est **l'endroit où je
l'ai écrite**. `memory/` est lu par les sessions suivantes comme un fait établi ;
rien dans le fichier ne distingue ce qui a été observé de ce qui a été supposé.
Une déduction plausible y devient indiscernable d'une mesure, et se propage.

**Detecte par** — `auteur`

**Action** — `comportement` — n'écris dans `memory/` que ce que tu as vu, et
quand tu ne peux pas voir, écris que tu n'as pas vu. Le format des fichiers
`memory/` n'a pas de champ pour ça — chaque phrase s'y lit comme une affirmation
— donc la retenue est le seul garde-fou disponible. La phrase corrigée dit
maintenant le contraire, et dit aussi pourquoi les trois registres ne se
déduisent pas l'un de l'autre.

### 10. `git` annonce « ahead by 1 commit » d'une branche distante qui n'existe plus

**Symptôme** — après `git checkout -B` sur `origin/main`, `git` affiche « Your
branch is ahead of 'origin/claude/...' by 1 commit ». Le `push` a ensuite été
refusé avec `! [rejected] ... (stale info)`, message qui évoque une divergence
avec un travail distant. Il n'y avait aucun travail distant : la branche avait
été supprimée sur GitHub à la fusion de la PR #76. `git fetch` de cette même
branche répond `couldn't find remote ref`, et un `git remote prune origin` suivi
d'un `push` ordinaire a suffi.

**Cause** — la référence de suivi locale survit à la suppression distante
jusqu'au prochain élagage, et les deux messages la lisent comme une réalité.
`--force-with-lease` compare la référence locale au distant, trouve un écart
inexplicable, et refuse — correctement, mais avec un mot qui suggère un conflit
plutôt qu'une référence périmée. Le réflexe qu'il induit est le mauvais : on
regarde ce que l'autre a poussé, alors qu'il faut élaguer.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/travail.md` dit qu'une session cloud ouvre des
branches et ne peut pas en fermer ; il ne disait pas que **GitHub**, lui, en
ferme à la fusion. Le cas est donc fréquent et non décrit : toute branche
`claude/` réassignée après une fusion le rencontre. La phrase manquante est
« élague avant de pousser sur un nom déjà fusionné ».

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 22:57 UTC, sur 3 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 8 786 | 0,04 $ |
| Écriture de cache | 579 991 | 3,59 $ |
| Lecture de cache | 19 477 230 | 9,71 $ |
| Sortie | 34 314 | 0,84 $ |
| **Total** | **20 100 321** | **14,18 $ — 12,32 €** |

**Ce qui coûte**

- **163 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  84 312 jetons, écrits une fois par session puis relus à chaque
  échange : 8 400 618 jetons de relecture, 43 % de tout ce qui a été relu.
- **Tours courts** — 137 des 163 tours (84 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 11,78 $, soit 83 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 33 688 jetons relus au premier appel qui relise
  quelque chose, 31 755 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 20100321 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 25858 33688 619
2 principal claude-opus-5 3982 59546 372
3 principal claude-opus-5 1579 63528 446
4 principal claude-opus-5 8114 65107 1430
5 principal claude-opus-5 1596 73221 776
6 principal claude-opus-5 847 74817 842
7 principal claude-opus-5 1044 75664 2067
8 principal claude-opus-5 15 78774 879
9 principal claude-opus-5 1212 78789 552
10 principal claude-opus-5 8428 80001 394
11 principal claude-opus-5 584 88429 788
12 principal claude-opus-5 1950 89013 1048
13 principal claude-opus-5 3367 90963 2908
14 principal claude-opus-5 3105 94330 4599
15 principal claude-opus-5 4748 97435 490
16 principal claude-opus-5 684 102183 1940
17 principal claude-opus-5 2084 102867 268
18 principal claude-opus-5 346 104951 109
19 principal claude-opus-5 559 105297 2857
20 principal claude-opus-5 2907 105856 91
21 principal claude-opus-5 236 108763 2002
22 principal claude-opus-5 2051 108999 872
23 principal claude-opus-5 1818 111050 1619
24 principal claude-opus-5 1668 112868 1486
25 principal claude-opus-5 1558 114536 96
26 principal claude-opus-5 302 116094 1240
27 principal claude-opus-5 1281 116396 115
28 principal claude-opus-5 220 117677 251
29 principal claude-opus-5 300 117897 217
30 principal claude-opus-5 563 118197 1635
31 principal claude-opus-5 1706 118760 482
32 principal claude-opus-5 531 120466 97
33 principal claude-opus-5 58454 0 0
34 principal claude-opus-5 5396 58454 0
35 principal claude-opus-5 9727 63850 0
36 principal claude-opus-5 5478 73577 0
37 principal claude-opus-5 1640 79055 0
38 principal claude-opus-5 1114 80695 0
39 principal claude-opus-5 1704 81809 0
40 principal claude-opus-5 1260 83513 0
41 principal claude-opus-5 2628 84773 0
42 principal claude-opus-5 2215 87401 0
43 principal claude-opus-5 323 89616 0
44 principal claude-opus-5 993 91327 0
45 principal claude-opus-5 302 92320 0
46 principal claude-opus-5 657 92622 0
47 principal claude-opus-5 910 93279 0
48 principal claude-opus-5 3170 94189 0
49 principal claude-opus-5 772 97359 0
50 principal claude-opus-5 804 99947 0
51 principal claude-opus-5 62302 40936 0
52 principal claude-opus-5 535 103238 0
53 principal claude-opus-5 683 103773 0
54 principal claude-opus-5 1549 104456 0
55 principal claude-opus-5 827 106005 0
56 principal claude-opus-5 1359 106832 0
57 principal claude-opus-5 4233 108191 0
58 principal claude-opus-5 10529 112424 0
59 principal claude-opus-5 2453 122953 0
60 principal claude-opus-5 1996 125406 0
61 principal claude-opus-5 1251 127402 0
62 principal claude-opus-5 1340 128653 0
63 principal claude-opus-5 3523 129993 0
64 principal claude-opus-5 504 133516 0
65 principal claude-opus-5 284 134020 0
66 principal claude-opus-5 838 134304 0
67 principal claude-opus-5 4332 135142 0
68 principal claude-opus-5 418 139474 0
69 principal claude-opus-5 763 139892 0
70 principal claude-opus-5 682 140655 0
71 principal claude-opus-5 4907 141337 0
72 principal claude-opus-5 376 146244 0
73 principal claude-opus-5 830 146620 0
74 principal claude-opus-5 1914 147450 0
75 principal claude-opus-5 1161 149364 0
76 principal claude-opus-5 883 150525 0
77 principal claude-opus-5 1291 151408 0
78 principal claude-opus-5 550 152699 0
79 principal claude-opus-5 492 153249 0
80 principal claude-opus-5 3319 153741 0
81 principal claude-opus-5 1052 157060 0
82 principal claude-opus-5 518 158112 0
83 principal claude-opus-5 1340 158630 0
84 principal claude-opus-5 4392 159970 0
85 principal claude-opus-5 291 164362 0
86 principal claude-opus-5 248 164653 0
87 principal claude-opus-5 462 164901 0
88 principal claude-opus-5 474 166095 0
89 principal claude-opus-5 2784 166569 0
90 principal claude-opus-5 1954 169353 0
91 principal claude-opus-5 3354 171307 0
92 principal claude-opus-5 975 174661 0
93 principal claude-opus-5 281 175880 0
94 principal claude-opus-5 778 176161 0
95 principal claude-opus-5 1195 176939 0
96 principal claude-opus-5 25828 33688 0
97 principal claude-opus-5 1639 59516 0
98 principal claude-opus-5 10491 61155 0
99 principal claude-opus-5 2513 71646 0
100 principal claude-opus-5 927 74159 0
101 principal claude-opus-5 947 75086 0
102 principal claude-opus-5 641 76033 0
103 principal claude-opus-5 729 76674 0
104 principal claude-opus-5 1404 77403 0
105 principal claude-opus-5 17303 78807 0
106 principal claude-opus-5 2932 96110 0
107 principal claude-opus-5 604 99042 0
108 principal claude-opus-5 1317 99646 0
109 principal claude-opus-5 181 105126 0
110 principal claude-opus-5 9627 105307 0
111 principal claude-opus-5 948 114934 0
112 principal claude-opus-5 2207 115882 0
113 principal claude-opus-5 1691 118089 0
114 principal claude-opus-5 1751 119780 0
115 principal claude-opus-5 4486 121531 0
116 principal claude-opus-5 1502 126017 0
117 principal claude-opus-5 1264 127519 0
118 principal claude-opus-5 342 128783 0
119 principal claude-opus-5 1283 129125 0
120 principal claude-opus-5 397 130408 0
121 principal claude-opus-5 308 130805 0
122 principal claude-opus-5 409 131113 0
123 principal claude-opus-5 1350 131522 0
124 principal claude-opus-5 987 132872 0
125 principal claude-opus-5 1412 133859 0
126 principal claude-opus-5 1299 135271 0
127 principal claude-opus-5 370 136570 0
128 principal claude-opus-5 1561 136940 0
129 principal claude-opus-5 1999 138501 0
130 principal claude-opus-5 304 140500 0
131 principal claude-opus-5 4341 140804 0
132 principal claude-opus-5 245 145145 0
133 principal claude-opus-5 1698 145390 0
134 principal claude-opus-5 220 147088 0
135 principal claude-opus-5 410 147308 0
136 principal claude-opus-5 441 147718 0
137 principal claude-opus-5 108199 40934 0
138 principal claude-opus-5 1866 149133 0
139 principal claude-opus-5 402 150999 0
140 principal claude-opus-5 455 151401 0
141 principal claude-opus-5 144 151875 0
142 principal claude-opus-5 745 152019 0
143 principal claude-opus-5 1665 152764 0
144 principal claude-opus-5 1839 154429 0
145 principal claude-opus-5 613 156268 0
146 principal claude-opus-5 3256 156881 0
147 principal claude-opus-5 495 160137 0
148 principal claude-opus-5 759 160632 0
149 principal claude-opus-5 281 161453 0
150 principal claude-opus-5 807 161734 0
151 principal claude-opus-5 1529 162541 0
152 principal claude-opus-5 1024 164070 0
153 principal claude-opus-5 633 165094 0
154 principal claude-opus-5 819 165727 0
155 principal claude-opus-5 386 166546 0
156 principal claude-opus-5 487 166932 0
157 principal claude-opus-5 495 167419 0
158 principal claude-opus-5 530 167914 0
159 principal claude-opus-5 349 168508 0
160 principal claude-opus-5 16714 168857 0
161 principal claude-opus-5 972 185571 0
162 principal claude-opus-4-7 3493 28262 164
163 principal claude-opus-4-7 1714 31755 563
-->
<!-- /cout -->
