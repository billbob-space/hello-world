# 2026-08-16 — claude/redeploiement-apps-verification-1jhfby

Branche : `claude/redeploiement-apps-verification-1jhfby`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « redéploie toutes les apps maintenant que la CI est
réparée, et vérifie que toutes les dernières évolutions sont bien livrées ».
La vérification vient en premier et elle tient dans une comparaison : pour
chaque app, l'arbre `apps/<nom>` au commit épinglé dans `versions.yml` contre
le même arbre sur `main`. Trois apps diffèrent — `estran`, `renaissance-gym`,
`hello-world` —, les six autres sont identiques au bit près. Le redéploiement
lui-même a buté sur un levier qui n'en était pas un.

## Anomalies

### 1. Les fusions passées pendant la panne de CI ne sont jamais reconstruites

**Symptome** — `estran` tourne en ligne dans une version d'avant sa navigation
temporelle : `versions.yml` l'épingle sur `7c18d32`, alors que `main` porte
trois commits de plus sur `apps/estran` — 1 666 lignes ajoutées, dont
`main_test.go`, `prp/01-navigation-temporelle.md` et la refonte de l'échelle
typographique. Même écart pour `renaissance-gym` (`RETROSPECTIVE.md` et ses
tests) et `hello-world` (un test unitaire). Rien ne le signalait : `main` est
vert, les PR sont fusionnées, le dépôt a l'air à jour.

**Cause** — le déploiement est accroché à l'événement `push` sur `main`, et à
lui seul. Les deux fusions concernées — #133 le 16 août à 12:18 et #130 à
12:30 — ont bien poussé sur `main`, mais leurs runs sont tombés dans la fenêtre
où aucun runner n'était attribué (entrée du 16 août, anomalie 1) : `contrat` et
`detect` en échec en deux secondes, `build` et `deploy` sautés. La CI réparée à
13:03, **rien ne les rejoue** — le déclencheur était l'événement, et l'événement
est passé. Un `git push` ne se rejoue pas ; une panne d'infrastructure laisse
donc des fusions définitivement non construites, et le dépôt ne porte aucune
trace de l'écart puisque `versions.yml` n'est écrit que par les déploiements qui
ont eu lieu.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'écart est calculable sans réseau et sans jeton :
`git rev-parse <épingle>:apps/<nom>` contre le même arbre sur `HEAD` dit en une
comparaison si l'image en ligne correspond au code fusionné. Le mettre dans
`--check` demande cependant l'historique, que le clone superficiel de la CI n'a
pas ; c'est `pret.sh` — qui tourne en local, sur un dépôt complet — qui est la
bonne place, en avertissement.

### 2. L'entrée « toutes » reconstruisait tout et ne déployait rien

**Symptome** — le workflow expose exactement le levier qu'appelle la situation :
`workflow_dispatch` avec `toutes: reconstruire toutes les apps`. Actionné, il
aurait publié les neuf images et laissé la production intacte — `versions.yml`
inchangé, `compose.yaml` inchangé, webhook jamais appelé —, en sortant **vert**.

**Cause** — `detect` traite bien le cas (`tout=1`, liste complète, `deploy=true`)
et `build` publie, puisque sa condition de poussée est `event_name != pull_request`.
Mais le job `deploy` s'ouvrait sur `github.event_name == 'push'` : le dispatch
n'y entrait pas. Les deux moitiés de la chaîne ne s'accordaient pas sur ce que
`toutes` veut dire — construire pour l'une, mettre en ligne pour l'autre. Le
levier de rattrapage de la fabrique, celui-là même qu'on actionne après une
panne de CI, s'arrêtait à mi-chemin sans le dire.

**Detecte par** — `auteur`

**Action** — `rien` — réparé ici : `deploy` admet `workflow_dispatch` à côté de
`push`, la garde qui compte restant `ref == refs/heads/main`, commune aux deux
événements.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 14:24 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 92 | 0,00 $ |
| Écriture de cache | 331 325 | 1,57 $ |
| Lecture de cache | 4 314 185 | 2,02 $ |
| Sortie | 32 065 | 0,57 $ |
| **Total** | **4 677 667** | **4,16 $ — 3,61 €** |

**Ce qui coûte**

- **47 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  60 918 jetons, écrits une fois par session puis relus à chaque
  échange : 2 802 228 jetons de relecture, 64 % de tout ce qui a été relu.
- **Tours courts** — 13 des 47 tours (27 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,93 $, soit 22 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 60 918 jetons relus au premier appel qui relise
  quelque chose, 34 989 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 4677667 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 60918 0 300
2 principal claude-opus-5 4449 60918 365
3 principal claude-opus-5 3951 65367 611
4 principal claude-opus-5 7337 69318 607
5 principal claude-opus-5 3593 76655 392
6 principal claude-opus-5 1126 80248 398
7 principal claude-opus-5 1257 81374 807
8 principal claude-opus-5 7789 82631 720
9 principal claude-opus-5 1417 90420 1161
10 principal claude-opus-5 5467 91837 1675
11 principal claude-opus-5 4659 97304 253
12 principal claude-opus-5 547 101963 255
13 principal claude-opus-5 404 102510 107
14 principal claude-opus-5 676 102914 820
15 principal claude-opus-5 1481 103590 965
16 principal claude-opus-5 2063 105071 1735
17 principal claude-opus-5 2327 107134 204
18 principal claude-opus-5 511 109461 418
19 principal claude-opus-5 1674 109972 170
20 principal claude-opus-5 2241 111646 463
21 principal claude-opus-5 2305 113887 679
22 principal claude-opus-5 1147 116192 1377
23 principal claude-opus-5 1847 117339 219
24 principal claude-opus-5 524 119186 910
25 principal claude-opus-5 1000 119710 491
26 principal claude-opus-5 882 120710 1039
27 principal claude-opus-5 1077 121592 167
28 principal claude-opus-4-7 34434 0 106
29 principal claude-opus-4-7 151 34434 95
30 principal claude-opus-5 482 122669 248
31 principal claude-opus-4-7 226 34585 82
32 principal claude-opus-4-7 0 34434 247
33 principal claude-opus-4-7 5287 34811 84
34 principal claude-opus-5 341 123151 209
35 principal claude-opus-5 811 123492 86
36 principal claude-opus-5 480 124303 1304
37 principal claude-opus-5 1891 124783 267
38 principal claude-opus-5 6938 126674 896
39 principal claude-opus-4-7 15085 40098 3269
40 principal claude-opus-5 3808 133612 406
41 principal claude-opus-5 413 137420 139
42 principal claude-opus-4-7 20495 34434 4581
43 principal claude-opus-4-7 4686 55183 791
44 principal claude-opus-5 218 137833 998
45 principal claude-opus-5 233 139049 535
46 principal claude-opus-5 939 139282 94
47 principal claude-opus-5 111738 34989 320
-->
<!-- /cout -->
