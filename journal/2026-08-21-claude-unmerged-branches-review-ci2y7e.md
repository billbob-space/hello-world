# 2026-08-21 — claude/unmerged-branches-review-ci2y7e

Branche : `claude/unmerged-branches-review-ci2y7e`
Périmètre : fabrique
Mode : `chaud`

Passe de tri sur les six branches distantes non fusionnées. `./scripts/fusionnees.sh`
en range une seule dans « supprimables » et laisse les cinq autres en « à regarder,
patchs absents de `main` » — la comparaison, elle, restait à faire. Elle est faite, et
rend trois verdicts que le seul compte de patchs inédits ne distinguait pas :

| Branche | Patchs inédits | Verdict |
|---|---|---|
| `claude/claude-md-caveman-format-ylhb9k` | 0 | supprimable — entièrement dans `main` |
| `claude/touquet-marine-weather-app-wopsyp` | 1 | caduque — fichier réécrit depuis |
| `claude/weather-app-ui-redesign-x7h03f` | 1 | caduque — fichier réécrit depuis |
| `claude/redeploiement-apps-verification-1jhfby` | 1 | caduque — arbitrage démenti depuis |
| `claude/update-project-docs-3ojnjq` | 3 | **session en cours** — ne pas y toucher |
| `claude/bonjour-snxoni` | 10 | **session en cours** — ne pas y toucher |

Détail des trois branches caduques, parce que « patch inédit » les rendait toutes
suspectes et qu'aucune ne l'était :

- Les deux branches `estran` portent chacune un dernier commit sur
  `apps/estran/web/style.css`, gelé à 721 lignes ; `main` en porte 1 753 après la
  refonte typographique et les paliers 640/1024 px. Le patch est inédit parce que le
  fichier qu'il modifiait n'existe plus sous cette forme, pas parce que le travail
  manque. Leurs PR (#114, #116) étaient des brouillons, closes sans fusion.
- `claude/redeploiement-apps-verification-1jhfby` porte `memory/livraison.md` et la
  section de contrat qui l'appelle, absents de `main` : l'arbitrage du 16 août « sur
  un dépôt personnel la CI ne peut pas pousser `versions.yml`, donc la livraison
  s'achève à la main ». Deux jours plus tard, #141 à #146 ont donné à la CI une clé
  de déploiement ; `build.yml` fait aujourd'hui `git push origin HEAD:main` et
  `versions.yml` porte des commits « deploiement : … [skip ci] » jusqu'au 21 août.
  L'arbitrage n'est pas seulement inédit, il est **démenti par le dépôt** : le
  fusionner aurait réintroduit une règle fausse.

Les deux dernières lignes du tableau sont le vrai résultat de la passe, et elles ne
se lisent pas dans `git` : ce sont les branches de deux sessions cloud en train
d'écrire. Elles restent intactes.

## Anomalies

### 1. Rien dans le dépôt ne distingue une branche abandonnée d'une branche en cours d'écriture

**Symptome** — `claude/bonjour-snxoni` et `claude/update-project-docs-3ojnjq`
ressemblaient trait pour trait à du travail en rade : des patchs inédits, aucune PR
ouverte, et pour la première une PR déjà fusionnée (#160) suivie de dix commits
écrits après. Le verdict qui s'imposait était « ouvrir une PR pour récupérer ce qui
traîne ». Il était faux dans les deux cas : ce sont les branches de deux sessions
cloud en cours, l'une en pleine revue de code, l'autre à mi-chemin d'un inventaire
de documentation. Le constat s'est imposé quand un troisième commit est apparu sur
`update-project-docs` **pendant** la passe, entre deux exécutions de
`fusionnees.sh` — le compte de patchs inédits est passé de 2 à 3 sans que rien ne
bouge de mon côté.

**Cause** — le dépôt ne porte aucune trace de qui travaille. L'information existe,
mais dans le harnais : `list_sessions` donne, par branche, une session `RUNNING` et
son résumé de tâche en clair. Une passe qui ne consulte que `git` conclut sur
l'absence de PR, qui ne veut rien dire tant que la session n'a pas fini.

**Detecte par** — `auteur`

**Action** — `comportement` — avant de conclure quoi que ce soit sur une branche de
moins d'un jour, vérifier qu'aucune session ne l'occupe ; le critère « aucune PR »
ne devient un signal qu'ensuite.

### 2. Le compte de patchs inédits ne suffit pas à trancher, et il n'avait pas de quoi

**Symptome** — `fusionnees.sh` range cinq branches en « à regarder » sans les
départager, et prévient à raison qu'un patch inédit ne prouve pas un travail perdu.
Mais quatre des cinq se tranchaient sans ouvrir un seul diff : un dernier commit
vieux de onze ou douze jours sur un fichier réécrit depuis, ou une PR close sans
fusion. La première de ces deux informations, l'outil l'avait sous la main et ne
l'affichait pas.

**Cause** — le script s'est arrêté au critère juste — l'équivalence de patch — sans
lui adjoindre ce qui le qualifie : la **date** du dernier patch inédit, et l'**état
de la pull request**. La première se lit dans `git` et manquait par omission ; la
seconde demande GitHub, ce qui explique son absence sans la justifier.

**Detecte par** — `auteur`

**Action** — `garde-fou` — corrigé dans cette branche : `fusionnees.sh` affiche
désormais la date du dernier patch inédit et son âge en jours, et dit en clair que
l'état de la PR est le second tri.

### 3. Un arbitrage rendu vit dans une branche non fusionnée, et le dépôt le dément sans le dire

**Symptome** — `memory/livraison.md` écrit noir sur blanc « on garde le verrou, on
achève la livraison à la main », et cette règle n'a jamais atteint `main`. Deux jours
plus tard la CI pousse `versions.yml` toute seule. Aucun des deux camps ne sait que
l'autre existe : l'entrée de journal du 16 août reste sur `main` avec son constat de
blocage, et le correctif de #141–#146 ne la mentionne pas.

**Cause** — un arbitrage a été écrit dans une branche au lieu d'être fusionné, et sa
PR (#137, brouillon) a été close sans fusion ni note. Rien ne relie une règle écrite
au constat qui l'a motivée : quand le constat tombe, la règle survit là où elle est.

**Detecte par** — `auteur`

**Action** — `arbitrage` — reste à décider si le journal du 16 août doit porter une
note disant que son blocage a été levé le 18 ; le correctif, lui, est déjà en place.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 18:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 52 | 0,00 $ |
| Écriture de cache | 146 417 | 0,92 $ |
| Lecture de cache | 2 697 606 | 1,35 $ |
| Sortie | 27 774 | 0,69 $ |
| **Total** | **2 871 849** | **2,96 $ — 2,57 €** |

**Ce qui coûte**

- **26 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 030 jetons, écrits une fois par session puis relus à chaque
  échange : 1 675 750 jetons de relecture, 62 % de tout ce qui a été relu.
- **Tours courts** — 6 des 26 tours (23 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,49 $, soit 16 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 030 jetons relus au premier appel qui relise
  quelque chose, 145 802 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 2871849 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 67030 0 609
2 principal claude-opus-5 2713 67030 475
3 principal claude-opus-5 2802 69743 537
4 principal claude-opus-5 10639 72545 674
5 principal claude-opus-5 1804 83184 1365
6 principal claude-opus-5 7745 84988 3032
7 principal claude-opus-5 4005 92733 245
8 principal claude-opus-5 268 96738 413
9 principal claude-opus-5 1427 97006 1431
10 principal claude-opus-5 2771 98433 790
11 principal claude-opus-5 2207 101204 1780
12 principal claude-opus-5 4582 103411 261
13 principal claude-opus-5 830 107993 2280
14 principal claude-opus-5 3267 108823 713
15 principal claude-opus-5 2897 112090 188
16 principal claude-opus-5 352 114987 109
17 principal claude-opus-5 1229 115339 3926
18 principal claude-opus-5 3994 116568 1188
19 principal claude-opus-5 3578 120562 554
20 principal claude-opus-5 700 124140 1495
21 principal claude-opus-5 2221 124840 354
22 principal claude-opus-5 727 127061 880
23 principal claude-opus-5 12680 127788 3600
24 principal claude-opus-5 3662 140468 162
25 principal claude-opus-5 1672 144130 295
26 principal claude-opus-5 615 145802 418
-->
<!-- /cout -->
