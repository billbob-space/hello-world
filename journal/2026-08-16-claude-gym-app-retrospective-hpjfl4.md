# 2026-08-16 — claude/gym-app-retrospective-hpjfl4

Branche : `claude/gym-app-retrospective-hpjfl4`
Périmètre : fabrique (analyse de la fabrication de renaissance-gym)
Mode : `chaud`

## Anomalies

Rétrospective de la fabrication de `renaissance-gym`, demandée par
l'utilisateur : coût, temps, erreurs évitables, manques fonctionnels,
complétude. Aucun code touché — le livrable est
`docs/retrospective-renaissance-gym.md`, reconstitué depuis l'entrée de journal
de la branche `claude/gym-la-renaissance-app-xpgswt` (29 anomalies, bloc
`cout-detail` de 2 433 lignes), l'historique de `main` et l'état livré de l'app.

Deux anomalies rencontrées **en menant l'analyse**, toutes deux dans les outils
qui devaient la rendre possible.

### 1. Le relevé de coût figé perd l'avertissement des modèles sans tarif

**Symptome** — le relevé de la branche `renaissance-gym` annonce « Modèle(s) :
claude-opus-5, claude-sonnet-5 » et un total de 266,26 $. Or quatre modèles
apparaissent dans son propre `cout-detail` : s'y ajoutent
`claude-opus-4-7` (108 appels) et `claude-haiku-4-5-20251001` (150 appels).
Recalculé aux tarifs de `fabrique.yml`, le total du bloc ne s'obtient qu'en
excluant ces deux-là — environ 11 $ manquants, 4 % de la facture, sans qu'aucune
ligne du bloc ne le dise.

**Cause** — `cout.sh` sait le voir et le dit : la ligne 359 émet
`warn "modele(s) sans tarif dans fabrique.yml : ..."`. Mais cet avertissement va
sur la console, qui est éphémère, alors que le bloc écrit dans l'entrée de
journal — le seul artefact durable, et celui que `jetons.sh` agrège — ne porte
que la liste des modèles **tarifés**. Le lecteur du dépôt ne peut donc pas
savoir que le total est un plancher. Les deux modèles manquants ont deux causes
distinctes : `claude-opus-4-7` est absent de `tarifs`, et
`claude-haiku-4-5-20251001` ne matche pas l'entrée `claude-haiku-4-5` faute de
comparaison sur préfixe — un modèle daté suffit à sortir du barème.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le bloc figé doit porter la même mention que la
console : un total silencieusement incomplet est pire qu'un total absent,
puisqu'il se compare aux autres branches. Et la correspondance des tarifs
gagnerait à se faire sur préfixe, sans quoi chaque modèle daté sort du barème
sans bruit.

### 2. Les actions du journal ne sont suivies par rien

**Symptome** — la branche `renaissance-gym` a consigné 29 anomalies, dont cinq
portant `Action` — `garde-fou` et cinq `Action` — `contrat`. Vérifié sur le
diff complet de la branche : ni `memory/`, ni `.claude/`, ni `init.sh`, ni
`scripts/` n'ont changé d'une ligne. Rien sur la règle des 400 Hz, rien sur
« quitter n'est pas effacer », rien sur le `go.work` que l'artisan ne peut pas
régénérer, aucun test sur le `catch` vide ni sur `[hidden]`.

**Cause** — le vocabulaire d'`Action` décrit ce que l'anomalie *devrait*
changer, et rien ne relie cette intention à un changement réel. `--check`
vérifie que le champ est dans le vocabulaire, jamais qu'il a eu une suite ;
`pret.sh` ne le regarde pas ; l'`analyste` lit le journal mais ne modifie rien.
Une anomalie bien classée est donc indiscernable d'une anomalie traitée.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le journal se vante d'une distribution mesurable ; il
lui manque la mesure symétrique, celle des actions restées lettre morte. Un
relevé — même un simple décompte des `garde-fou` et `contrat` sans commit
correspondant dans la branche — rendrait visible ce qui s'accumule. En l'état,
le journal enregistre et la boucle ne se referme pas.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 09:02 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 57 | 0,00 $ |
| Écriture de cache | 141 130 | 0,88 $ |
| Lecture de cache | 3 226 789 | 1,61 $ |
| Sortie | 31 328 | 0,78 $ |
| **Total** | **3 399 304** | **3,28 $ — 2,85 €** |

**Ce qui coûte**

- **30 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 960 jetons, écrits une fois par session puis relus à chaque
  échange : 1 767 840 jetons de relecture, 54 % de tout ce qui a été relu.
- **Tours courts** — 11 des 30 tours (36 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,91 $, soit 27 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 960 jetons relus au premier appel qui relise
  quelque chose, 139 000 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 3399304 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 60960 0 579
2 principal claude-opus-5 4307 60960 392
3 principal claude-opus-5 3349 65267 529
4 principal claude-opus-5 9300 68616 320
5 principal claude-opus-5 7730 77916 129
6 principal claude-opus-5 6645 85646 628
7 principal claude-opus-5 3584 92291 955
8 principal claude-opus-5 2504 95875 1144
9 principal claude-opus-5 1581 98379 486
10 principal claude-opus-5 720 99960 467
11 principal claude-opus-5 681 100680 934
12 principal claude-opus-5 1892 101361 2606
13 principal claude-opus-5 3790 103253 1930
14 principal claude-opus-5 4726 107043 181
15 principal claude-opus-5 2311 111769 673
16 principal claude-opus-5 852 114080 4400
17 principal claude-opus-5 6251 114932 803
18 principal claude-opus-5 2510 121183 552
19 principal claude-opus-5 940 123693 9240
20 principal claude-opus-5 9296 124633 299
21 principal claude-opus-5 444 133929 106
22 principal claude-opus-5 344 134373 150
23 principal claude-opus-5 175 134717 99
24 principal claude-opus-5 116 134892 137
25 principal claude-opus-5 1288 135008 229
26 principal claude-opus-5 244 136296 119
27 principal claude-opus-5 378 136540 109
28 principal claude-opus-5 661 136918 961
29 principal claude-opus-5 1421 137579 2060
30 principal claude-opus-5 2130 139000 111
-->
<!-- /cout -->
