# 2026-08-16 — claude/github-ci-broken-3zaujo

Branche : `claude/github-ci-broken-3zaujo`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « la CI GitHub est cassée, analyse et répare ». Le diagnostic
tient en une phrase : **il n'y a rien à réparer dans le dépôt**. Aucun job ne
reçoit de machine ; la cause est dans la facturation du compte GitHub, hors de
portée d'un commit.

## Anomalies

### 1. La CI ne démarre plus : aucun runner n'est attribué depuis 10:53 UTC

**Symptome** — depuis le run de 10:53 UTC le 16 août, **tous** les runs échouent,
sur `main` comme sur les pull requests, et de façon identique : `contrat` et
`detect` — les deux seuls jobs sans `needs` — passent en `failure` en **deux
secondes**, les quatre autres en `skipped`. Aucune ligne de log : l'API rend
`HTTP 404` sur leur téléchargement, et la sortie de la check-run est vide.
La rupture est nette dans l'historique — les onze runs précédents, du 15 août
10:40 au 16 août 10:34, sont tous verts ou annulés ; les sept suivants, tous
rouges. Vérifié encore à 12:36 UTC par un `workflow_dispatch` déclenché
explicitement sur `main` : même échec en deux secondes, sans un log.

**Cause** — hors du dépôt, et l'objet le dit lui-même : le job porte
`runner_id: 0` et `runner_name: ""`. Aucune machine ne lui a jamais été
attribuée, donc rien n'a démarré — ni `actions/checkout`, ni la première ligne
de `./init.sh --check`. Le dépôt est exonéré par trois faits indépendants :
le workflow n'a pas bougé depuis le dernier run vert (le commit qui ouvre la
série rouge, `3ca5fde`, ne touche pas `.github/workflows/`) ; les deux jobs qui
échouent sont les plus simples de la chaîne et échouent **avant** d'exécuter
quoi que ce soit ; et `./init.sh --check`, que le job `contrat` se contente de
lancer, est vert en local sur `2ddf439`, tête de `main`. Le dépôt est privé et
appartient à un compte personnel : les minutes Actions y sont facturées, et la
limite de dépense par défaut d'un compte personnel est de zéro. L'épuisement du
quota mensuel — ou un moyen de paiement refusé — produit exactement cette
signature, à l'heure près.

**Detecte par** — `CI`

**Action** — `arbitrage` — demande un geste humain hors du dépôt. Quatre voies
ont été mises devant l'utilisateur : un runner auto-hébergé sur le serveur de la
fabrique, relever la limite de dépense, **rendre le dépôt public** — GitHub ne
facture pas les runners hébergés d'un dépôt public —, ou une chaîne de livraison
manuelle depuis une machine équipée de Docker. **Arbitrage rendu : dépôt
public.** Aucun correctif de code ne peut rendre un runner ; le seul geste qui
débloque est dans les réglages GitHub.

### 2. Un agent ne peut pas lire pourquoi un job n'a pas démarré

**Symptome** — la cause d'un job qui ne démarre pas est écrite quelque part chez
GitHub, mais aucune des trois portes n'est ouverte depuis une session cloud :
le téléchargement des logs rend `404` (il n'y a pas de log, le job n'a pas
tourné), l'endpoint des annotations de check-run rend `403 Resource not
accessible by integration`, et les chemins `/actions/permissions`,
`/actions/runners` et `/settings/billing/actions` sont refusés en amont par le
proxy du harnais — « Access to this GitHub Actions path is not permitted through
this proxy ». La bannière que GitHub affiche à un humain sur la page du run
(« The job was not started because... ») n'a aucun équivalent lisible par l'API
accessible ici.

**Cause** — le jeton de la session est portée dépôt, et le proxy restreint
davantage les chemins Actions. C'est un choix de sécurité du harnais, pas un
défaut : le prix en est qu'un échec d'**infrastructure** se présente à l'agent
sous exactement le même masque qu'un échec de **contenu** — rouge, sans log.

**Detecte par** — `auteur`

**Action** — `comportement` — la signature se reconnaît sans les logs, et la
voici pour la prochaine session : `runner_id: 0`, `runner_name: ""`, durée de
deux secondes, logs en `404`, et seuls les jobs sans `needs` en `failure`.
Ces cinq signes ensemble veulent dire « aucune machine attribuée » et rien
d'autre. Chercher la cause dans le dépôt, dans ce cas, ne peut que faire perdre
du temps — la vérification utile est `./init.sh --check` en local, qui dit en
une minute si le dépôt aurait été vert.

### 3. Passer le dépôt en public n'expose aucun secret, mais deux choses irréversibles

**Symptome** — l'arbitrage retenu — rendre le dépôt public pour retrouver des
runners gratuits — publie **tout l'historique**, pas l'état d'aujourd'hui. Un
audit était donc dû avant la bascule, et `--check` ne le couvre pas : il lit
l'arbre suivi, jamais les 133 commits derrière.

**Cause** — la garantie du contrat, « aucun secret dans le dépôt », est **tenue
et vérifiable sur tout le passé** : aucun jeton, clé privée ou mot de passe dans
les patches des 133 commits ; les seules occurrences sont des **noms** de
secrets, ce que le contrat prescrit précisément. Ce n'est pas ce qui pose
question. Deux autres choses deviennent publiques **sans retour possible**,
parce qu'elles vivent dans l'historique et qu'une correction faite aujourd'hui
ne les en retirerait pas :

- **L'adresse du décideur**, `amuteau@gmail.com` — auteur de tous les commits,
  et présente en clair dans les `PRODUCT.md`, des fixtures de test et un
  `design.json`. C'est aussi **l'identité de la liste blanche** du palier
  `private` : la publier dit quel compte ouvre les applications fermées.
- **La carte de l'infrastructure** — les sous-domaines `billbob.ovh`, la porte
  de service `dockhand.billbob.ovh/api` que le `README` décrit en détail (routeur
  Traefik sans `ForwardAuth`, restreint à `GET`), et l'état du disque du serveur.
  Rien là-dedans n'ouvre une porte à soi seul ; l'ensemble dessine où frapper.

Vérifié aussi, parce que la bascule aurait pu casser la livraison : les paquets
`ghcr.io` sont **privés** — un jeton anonyme est refusé en `401` — et le serveur
tire avec un identifiant en lecture seule, comme le `README` le prescrit. La
visibilité d'un paquet ne suit pas celle du dépôt : rien ne se casse, mais le
point est à revérifier après bascule.

**Detecte par** — `auteur`

**Action** — `arbitrage` — les deux expositions sont un choix, pas un défaut, et
il appartient à l'utilisateur. Nettoyer l'adresse ou les noms d'hôte dans
l'arbre courant serait un geste vide : l'historique les garde. Le seul geste
utile côté serveur, après bascule, est de renouveler le jeton d'API de
`dockhand`, dont l'emplacement devient public même si sa valeur ne l'a jamais
été.

### 4. Le verrou de fusion exige un job qui n'existe plus depuis huit jours

**Symptome** — la CI redevenue verte, la PR reste `mergeable_state: blocked`.
La règle de branche de `main` exige deux checks : `contrat`, qui existe, et
**`tests-du-generateur`, qui n'existe plus**. Le job porte le nom
`tests-de-l-outillage` depuis le 8 août ; l'ancien nom ne survit que dans une
entrée de journal du 4 août. Un check requis qui n'est jamais rapporté ne passe
jamais : **toute** pull request est bloquée depuis huit jours, et les fusions de
cette période sont donc passées en contournant la règle.

**Cause** — le nom du job est la clé du verrou, et il a été renommé d'un côté
sans l'être de l'autre. Rien ne pouvait le signaler : la règle vit dans les
réglages GitHub, le job dans `.github/workflows/build.yml`, et aucun des deux
ne lit l'autre. `--check` vérifie que le workflow existe et que son job
`contrat` lance `./init.sh --check` ; il ne connaît pas les checks exigés.

Le dommage n'est pas le blocage, qui se voit — c'est ce que le blocage
**enseigne**. Une règle qu'on ne peut jamais satisfaire s'écarte à chaque
fusion, et le geste d'écarter devient l'ordinaire ; le jour où `contrat` tombe
pour de bonnes raisons, il s'écartera du même geste. Un verrou impossible à
ouvrir ne protège rien : il apprend à passer par la fenêtre.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le correctif est dans les réglages GitHub, hors du
dépôt : remplacer `tests-du-generateur` par `tests-de-l-outillage` dans les
checks requis du ruleset de `main`. Aucun garde-fou du dépôt ne peut rattraper
cette classe d'écart, puisque la valeur à comparer n'est pas dans le dépôt —
sauf à faire lire l'API des rulesets par `--check`, ce qui lui ferait dépendre
du réseau et d'un jeton, prix qu'on ne paie pas pour un contrôle qui doit
tourner partout et hors ligne.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 13:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 14 869 | 0,07 $ |
| Écriture de cache | 261 968 | 1,39 $ |
| Lecture de cache | 12 559 963 | 6,18 $ |
| Sortie | 53 797 | 1,34 $ |
| **Total** | **12 890 597** | **8,99 $ — 7,81 €** |

**Ce qui coûte**

- **97 appel(s) au modèle** — un par réponse, outils compris —, dont 14 par des sous-agents — 238 610 jetons, 0,00 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 886 jetons, écrits une fois par session puis relus à chaque
  échange : 4 992 652 jetons de relecture, 39 % de tout ce qui a été relu.
- **Tours courts** — 32 des 97 tours (32 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,78 $, soit 30 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 886 jetons relus au premier appel qui relise
  quelque chose, 224 096 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 12890597 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 60886 0 335
2 principal claude-opus-5 4856 60886 298
3 principal claude-opus-5 3343 65742 216
4 principal claude-opus-5 764 69085 536
5 principal claude-opus-5 16391 69849 229
6 principal claude-opus-5 2508 86240 243
7 principal claude-opus-5 556 88748 232
8 principal claude-opus-5 866 89304 248
9 principal claude-opus-5 891 90170 383
10 principal claude-opus-5 1419 91061 117
11 principal claude-opus-5 1003 92480 1258
12 principal claude-opus-5 1740 93483 741
13 principal claude-opus-5 1251 95223 163
14 principal claude-opus-5 238 96474 374
15 principal claude-opus-5 757 96712 412
16 principal claude-opus-5 624 97469 181
17 principal claude-opus-5 261 98093 315
18 principal claude-opus-5 832 98354 238
19 principal claude-opus-5 374 99186 373
20 principal claude-opus-5 2655 99560 292
21 principal claude-opus-5 452 102215 1021
22 principal claude-opus-5 1323 102667 1756
23 principal claude-opus-5 2801 103990 898
24 principal claude-opus-5 1478 106791 1011
25 principal claude-opus-5 3679 108269 300
26 principal claude-opus-5 602 111948 85
27 principal claude-opus-5 1319 112550 2552
28 principal claude-opus-5 2622 113869 121
29 principal claude-opus-5 325 116491 223
30 principal claude-opus-5 3964 116816 1034
31 principal claude-opus-5 1204 120780 156
32 principal claude-opus-5 358 121984 122
33 principal claude-opus-5 531 122342 86
34 principal claude-opus-5 480 122873 1135
35 principal claude-opus-5 1722 123353 853
36 principal claude-opus-5 1851 125075 530
37 principal claude-opus-5 2898 126926 766
38 principal claude-opus-5 9757 130590 1276
39 principal claude-opus-5 6510 140347 982
40 principal claude-opus-5 4289 146857 1712
41 principal claude-opus-5 2418 151146 2313
42 principal claude-opus-5 2509 153564 1578
43 principal claude-opus-5 2043 156073 2154
44 principal claude-opus-5 3222 158116 1088
45 principal claude-opus-5 3324 161338 2176
46 principal claude-opus-5 2660 164662 100
47 principal claude-opus-5 658 167322 1554
48 principal claude-opus-5 1648 167980 1221
49 principal claude-opus-5 1291 169628 160
50 principal claude-opus-5 4287 170919 1026
51 principal claude-opus-5 2110 175206 936
52 principal claude-opus-5 13 178252 298
53 principal claude-opus-5 318 178265 401
54 principal claude-opus-5 593 178583 112
55 principal claude-opus-5 236 179176 202
56 principal claude-opus-5 1193 179412 623
57 principal claude-opus-5 1183 180605 202
58 principal claude-opus-5 2297 181788 778
59 principal claude-opus-5 1295 184085 218
60 principal claude-opus-5 276 185380 229
61 principal claude-opus-5 309 185656 341
62 principal claude-opus-5 16316 185965 811
63 principal claude-opus-5 931 202281 298
64 principal claude-opus-5 349 203510 318
65 principal claude-opus-5 5930 203859 639
66 principal claude-opus-5 937 209789 894
67 principal claude-opus-5 1044 210726 581
68 principal claude-opus-5 709 211770 118
69 principal claude-opus-5 236 212479 263
70 principal claude-opus-5 348 212978 654
71 principal claude-opus-5 1060 213326 748
72 principal claude-opus-5 12 215134 239
73 principal claude-opus-5 1551 215146 133
74 principal claude-opus-5 174 216697 1301
75 principal claude-opus-5 1807 216871 189
76 principal claude-opus-5 429 218678 384
77 principal claude-opus-5 414 219107 504
78 principal claude-opus-5 865 219521 1021
79 principal claude-opus-5 1145 220386 664
80 principal claude-opus-5 759 221531 443
81 principal claude-opus-5 766 222290 790
82 principal claude-opus-5 1040 223056 1112
83 principal claude-opus-5 1182 224096 146
84 agent claude-haiku-4-5-20251001 11535 0 1
85 agent claude-haiku-4-5-20251001 1428 11535 2
86 agent claude-haiku-4-5-20251001 3069 12963 1
87 agent claude-haiku-4-5-20251001 444 16032 2
88 agent claude-haiku-4-5-20251001 620 16476 2
89 agent claude-haiku-4-5-20251001 295 17096 2
90 agent claude-haiku-4-5-20251001 11680 0 5
91 agent claude-haiku-4-5-20251001 1334 11680 2
92 agent claude-haiku-4-5-20251001 4380 13014 2
93 agent claude-haiku-4-5-20251001 533 17394 2
94 agent claude-haiku-4-5-20251001 3113 17927 2
95 agent claude-haiku-4-5-20251001 484 21040 4
96 agent claude-haiku-4-5-20251001 554 21524 2
97 agent claude-haiku-4-5-20251001 232 22078 5
-->
<!-- /cout -->
