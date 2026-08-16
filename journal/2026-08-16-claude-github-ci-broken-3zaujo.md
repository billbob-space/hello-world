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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 13:01 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 14 739 | 0,07 $ |
| Écriture de cache | 187 544 | 1,06 $ |
| Lecture de cache | 5 578 783 | 2,75 $ |
| Sortie | 36 157 | 0,90 $ |
| **Total** | **5 817 223** | **4,79 $ — 4,16 €** |

**Ce qui coûte**

- **55 appel(s) au modèle** — un par réponse, outils compris —, dont 6 par des sous-agents — 91 553 jetons, 0,00 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 886 jetons, écrits une fois par session puis relus à chaque
  échange : 2 922 528 jetons de relecture, 52 % de tout ce qui a été relu.
- **Tours courts** — 19 des 55 tours (34 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,36 $, soit 28 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 886 jetons relus au premier appel qui relise
  quelque chose, 169 628 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 5817223 -->
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
50 agent claude-haiku-4-5-20251001 11535 0 1
51 agent claude-haiku-4-5-20251001 1428 11535 2
52 agent claude-haiku-4-5-20251001 3069 12963 1
53 agent claude-haiku-4-5-20251001 444 16032 2
54 agent claude-haiku-4-5-20251001 620 16476 2
55 agent claude-haiku-4-5-20251001 295 17096 2
-->
<!-- /cout -->
