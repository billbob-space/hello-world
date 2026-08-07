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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 22:20 UTC, sur 2 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 867 | 0,00 $ |
| Écriture de cache | 411 653 | 2,10 $ |
| Lecture de cache | 12 308 833 | 5,79 $ |
| Sortie | 89 740 | 1,83 $ |
| **Total** | **12 811 093** | **9,73 $ — 8,45 €** |

**Ce qui coûte**

- **115 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  84 282 jetons, écrits une fois par session puis relus à chaque
  échange : 5 496 018 jetons de relecture, 44 % de tout ce qui a été relu.
- **Tours courts** — 32 des 115 tours (27 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,56 $, soit 26 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 454 jetons relus au premier appel qui relise
  quelque chose, 140 500 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 12811093 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58454 0 584
2 principal claude-opus-5 5396 58454 247
3 principal claude-opus-5 9727 63850 402
4 principal claude-opus-5 5478 73577 648
5 principal claude-opus-5 1640 79055 82
6 principal claude-opus-5 1114 80695 270
7 principal claude-opus-5 1704 81809 490
8 principal claude-opus-5 1260 83513 1415
9 principal claude-opus-5 2628 84773 2027
10 principal claude-opus-5 2215 87401 298
11 principal claude-opus-5 323 89616 1388
12 principal claude-opus-5 993 91327 183
13 principal claude-opus-5 302 92320 303
14 principal claude-opus-5 657 92622 733
15 principal claude-opus-5 910 93279 1997
16 principal claude-opus-5 3170 94189 241
17 principal claude-opus-5 772 97359 1816
18 principal claude-opus-5 804 99947 2477
19 principal claude-opus-5 62302 40936 407
20 principal claude-opus-5 535 103238 392
21 principal claude-opus-5 683 103773 211
22 principal claude-opus-5 1549 104456 348
23 principal claude-opus-5 827 106005 679
24 principal claude-opus-5 1359 106832 819
25 principal claude-opus-5 4233 108191 384
26 principal claude-opus-5 10529 112424 439
27 principal claude-opus-5 2453 122953 223
28 principal claude-opus-5 1996 125406 663
29 principal claude-opus-5 1251 127402 1092
30 principal claude-opus-5 1340 128653 301
31 principal claude-opus-5 3523 129993 455
32 principal claude-opus-5 504 133516 99
33 principal claude-opus-5 284 134020 696
34 principal claude-opus-5 838 134304 4284
35 principal claude-opus-5 4332 135142 106
36 principal claude-opus-5 418 139474 364
37 principal claude-opus-5 763 139892 424
38 principal claude-opus-5 682 140655 561
39 principal claude-opus-5 4907 141337 183
40 principal claude-opus-5 376 146244 125
41 principal claude-opus-5 830 146620 1845
42 principal claude-opus-5 1914 147450 593
43 principal claude-opus-5 1161 149364 285
44 principal claude-opus-5 883 150525 1075
45 principal claude-opus-5 1291 151408 504
46 principal claude-opus-5 550 152699 293
47 principal claude-opus-5 492 153249 3247
48 principal claude-opus-5 3319 153741 97
49 principal claude-opus-5 1052 157060 301
50 principal claude-opus-5 518 158112 1171
51 principal claude-opus-5 1340 158630 97
52 principal claude-opus-5 4392 159970 219
53 principal claude-opus-5 291 164362 98
54 principal claude-opus-5 248 164653 289
55 principal claude-opus-4-7 0 36333 456
56 principal claude-opus-5 462 164901 732
57 principal claude-opus-4-7 603 36333 95
58 principal claude-opus-4-7 220 36936 140
59 principal claude-opus-4-7 8071 28262 4263
60 principal claude-opus-4-7 4311 36333 96
61 principal claude-opus-4-7 221 40644 82
62 principal claude-opus-4-7 4624 40865 196
63 principal claude-opus-5 474 166095 223
64 principal claude-opus-4-7 460 45489 185
65 principal claude-opus-5 2784 166569 290
66 principal claude-opus-4-7 28822 37156 2966
67 principal claude-opus-5 1954 169353 441
68 principal claude-opus-5 3354 171307 783
69 principal claude-opus-4-7 1936 45949 2652
70 principal claude-opus-4-7 3881 47885 81
71 principal claude-opus-4-7 3334 65978 2305
72 principal claude-opus-5 975 174661 245
73 principal claude-opus-4-7 2657 69312 2567
74 principal claude-opus-4-7 8402 28262 192
75 principal claude-opus-4-7 242 36664 110
76 principal claude-opus-4-7 225 36906 82
77 principal claude-opus-4-7 6922 51766 12
78 principal claude-opus-5 281 175880 759
79 principal claude-opus-5 778 176161 451
80 principal claude-opus-5 1195 176939 227
81 principal claude-opus-5 25828 33688 405
82 principal claude-opus-5 1639 59516 182
83 principal claude-opus-5 10491 61155 723
84 principal claude-opus-5 2513 71646 345
85 principal claude-opus-5 927 74159 653
86 principal claude-opus-5 947 75086 236
87 principal claude-opus-5 641 76033 349
88 principal claude-opus-5 729 76674 556
89 principal claude-opus-5 1404 77403 345
90 principal claude-opus-5 17303 78807 2539
91 principal claude-opus-5 2932 96110 350
92 principal claude-opus-5 604 99042 508
93 principal claude-opus-5 1317 99646 4163
94 principal claude-opus-5 181 105126 2232
95 principal claude-opus-5 9627 105307 844
96 principal claude-opus-5 948 114934 1806
97 principal claude-opus-5 2207 115882 1538
98 principal claude-opus-5 1691 118089 95
99 principal claude-opus-5 1751 119780 457
100 principal claude-opus-5 4486 121531 752
101 principal claude-opus-5 1502 126017 1211
102 principal claude-opus-5 1264 127519 289
103 principal claude-opus-5 342 128783 1230
104 principal claude-opus-5 1283 129125 344
105 principal claude-opus-5 397 130408 255
106 principal claude-opus-5 308 130805 226
107 principal claude-opus-5 409 131113 1298
108 principal claude-opus-5 1350 131522 538
109 principal claude-opus-5 987 132872 646
110 principal claude-opus-5 1412 133859 1226
111 principal claude-opus-5 1299 135271 241
112 principal claude-opus-5 370 136570 1422
113 principal claude-opus-5 1561 136940 1927
114 principal claude-opus-5 1999 138501 111
115 principal claude-opus-5 304 140500 97
-->
<!-- /cout -->
