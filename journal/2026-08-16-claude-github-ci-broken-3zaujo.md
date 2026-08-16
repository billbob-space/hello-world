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

**Action** — `arbitrage` — demande un geste humain hors du dépôt, sur
`github.com/settings/billing` : relever la limite de dépense, ou attendre la
remise à zéro des minutes le 1er du mois. Aucun correctif de code ne peut
rendre un runner.

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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 12:40 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 14 651 | 0,07 $ |
| Écriture de cache | 116 816 | 0,73 $ |
| Lecture de cache | 2 656 909 | 1,33 $ |
| Sortie | 15 151 | 0,38 $ |
| **Total** | **2 803 527** | **2,51 $ — 2,18 €** |

**Ce qui coûte**

- **29 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 886 jetons, écrits une fois par session puis relus à chaque
  échange : 1 704 808 jetons de relecture, 64 % de tout ce qui a été relu.
- **Tours courts** — 14 des 29 tours (48 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,96 $, soit 38 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 886 jetons relus au premier appel qui relise
  quelque chose, 116 491 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 2803527 -->
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
-->
<!-- /cout -->
