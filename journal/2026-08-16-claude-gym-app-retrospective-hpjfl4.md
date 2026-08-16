# 2026-08-16 — claude/gym-app-retrospective-hpjfl4

Branche : `claude/gym-app-retrospective-hpjfl4`
Périmètre : fabrique (analyse de la fabrication de renaissance-gym)
Mode : `chaud`

## Anomalies

Rétrospective de la fabrication de `renaissance-gym`, demandée par
l'utilisateur : coût, temps, erreurs évitables, manques fonctionnels,
complétude. Aucun code touché — le livrable est
`apps/renaissance-gym/RETROSPECTIVE.md`, reconstitué depuis l'entrée de journal
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

### 3. `pret.sh` vert, CI rouge : le contrat ne voit pas un fichier non suivi

**Symptome** — la rétrospective a d'abord été écrite dans
`docs/retrospective-renaissance-gym.md`. `./scripts/pret.sh` a répondu « contrat
respecté », le commit est parti, et la CI a refusé : « docs/… parle de l'app
renaissance-gym — son domicile est apps/renaissance-gym/ ». Un aller-retour
complet pour une règle que le contrat énonce noir sur blanc.

**Cause** — deux causes qui se superposent. La mienne : j'ai rangé sous `docs/`
un document mi-app mi-fabrique, alors que le critère du contrat n'est pas le
sujet dominant mais le **nom** — un chemin sous `docs/` qui porte le nom d'une
app déménage, sans discussion. Celle de l'outil : le contrôle des documents
égarés lit `git ls-files 'docs/*.md'`, donc **rien tant que le fichier n'est pas
indexé**. `pret.sh`, dont le rôle est précisément de tourner *avant* le commit,
ne peut structurellement pas l'attraper sur un fichier neuf — et il affiche
« contrat respecté », qui se lit comme une garantie.

**Detecte par** — `CI`

**Action** — `garde-fou` — le même écart existe pour tout contrôle de `--check`
qui passe par `git ls-files` : sur un fichier neuf, `pret.sh` promet plus qu'il
ne vérifie. Le remède est local — indexer avant de contrôler, ou faire lire à ce
contrôle les fichiers non suivis en plus des suivis. C'est le premier contrôle
de la fabrique dont on sait qu'il ne peut rien dire sur ce qui vient d'être
écrit.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 09:07 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 100 | 0,00 $ |
| Écriture de cache | 172 900 | 1,08 $ |
| Lecture de cache | 6 793 670 | 3,40 $ |
| Sortie | 40 545 | 1,01 $ |
| **Total** | **7 007 215** | **5,49 $ — 4,77 €** |

**Ce qui coûte**

- **53 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 960 jetons, écrits une fois par session puis relus à chaque
  échange : 3 169 920 jetons de relecture, 46 % de tout ce qui a été relu.
- **Tours courts** — 26 des 53 tours (49 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,21 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 960 jetons relus au premier appel qui relise
  quelque chose, 172 527 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 7007215 -->
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
31 principal claude-opus-5 2496 141130 96
32 principal claude-opus-5 247 143626 1416
33 principal claude-opus-5 1454 143873 106
34 principal claude-opus-5 285 145327 86
35 principal claude-opus-5 480 145612 157
36 principal claude-opus-5 286 146092 68
37 principal claude-opus-5 477 146378 1519
38 principal claude-opus-5 2106 146855 128
39 principal claude-opus-5 1027 148961 137
40 principal claude-opus-5 410 149988 294
41 principal claude-opus-5 915 150398 169
42 principal claude-opus-5 229 151313 757
43 principal claude-opus-5 1159 151542 152
44 principal claude-opus-5 638 152701 160
45 principal claude-opus-5 3437 153339 197
46 principal claude-opus-5 10980 156776 618
47 principal claude-opus-5 1388 167756 480
48 principal claude-opus-5 938 169144 370
49 principal claude-opus-5 434 170082 211
50 principal claude-opus-5 308 170516 1094
51 principal claude-opus-5 1297 170824 205
52 principal claude-opus-5 406 172121 117
53 principal claude-opus-5 373 172527 680
-->
<!-- /cout -->
