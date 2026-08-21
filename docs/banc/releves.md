# Relevés du banc

Un bloc par relevé, le plus récent en tête. Le protocole, le panel et les pièges
de mesure sont dans [README.md](README.md) ; ce que ces chiffres servent à
trancher, dans [../parallelisme.md](../parallelisme.md).

Chaque bloc porte l'en-tête imprimé par `mesurer.sh` : sans lui, deux relevés ne
se comparent pas.

## 2026-08-21 (3) — la lecture des manifestes perd ses processus

Même machine, mêmes outils, même code applicatif. Seuls `lib/socle.sh` et une
fonction d'`init.sh` ont changé : `yget`, `ylist` et `valid_svc_name` ne lancent
plus un seul processus.

| scénario | avant | après | verdict |
|---|---:|---:|---|
| `contrat` | 13,24 s [12,89 – 13,53] | **7,59 s** [7,43 – 7,86] | intervalles disjoints — **gain déclaré, ×1,74** |
| `outillage` *(`test-init.sh`, 40 cas)* | 131,9 s | **66,3 s** | **×1,99** |

**Pourquoi c'est le bon endroit.** Le relevé CI de la veille avait nommé le
chemin critique : `test-init.sh`, 3 min 13 s sur un run de 3 min 50 s. Ce
harnais est **parfaitement parallèle et purement lié au calcul** — 40 cas, une
vérification complète chacun, quatre en vol, 97 % d'efficacité mesurée. Le seul
levier était donc de réduire le *travail*, pas de mieux le répartir.

**Où était le travail.** Une vérification complète exécutait **258 000 commandes**
et lisait 1 104 valeurs de manifeste. Chaque lecture enchaînait `tr | sed | head`
puis un second `sed` : cinq processus, plus la substitution qui l'entoure, pour
lire une ligne dans un fichier de trente. Environ **sept mille processus par
vérification** — et la vérification est jouée quarante fois.

**Ce que la mesure a écarté en chemin** : `check_traces_risques` parcourt 30 000
lignes de documents en bash pur et semblait le suspect idéal. Neutralisée, elle
ne fait gagner que 0,4 s. Sans la mesure, c'est là qu'on aurait passé la journée.

**Deux gisements restants, chiffrés et volontairement non pris** : la
duplication de `load_app`, appelée 128 fois pour 10 apps, et les substitutions
`$(...)` qui entourent chaque lecture — environ 2 100 forks résiduels. Le second
demanderait de changer des centaines de sites d'appel dans un script de 150 Ko
qui garde les dix apps. Le rapport gain/risque ne le justifie pas aujourd'hui.

---

## Série CI — à ne jamais comparer à la série locale

Runners GitHub, caches d'actions, images préchauffées : une durée de CI ne se
compare qu'à une autre durée de CI. Et, à l'intérieur même de cette série, un run
sur `main` **avec** déploiement ne se compare pas à un run de pull request sans.

### 2026-08-21 (2) — après la réécriture des lecteurs de manifeste

```
run 387 (32480595299) — pull_request, PR #158, head bb9dae1
10 apps, 49 contrôles, conclusion success
```

| | run 383 | run 387 |
|---|---:|---:|
| **Durée du run** | 3 min 50 s | **3 min 05 s** |
| `outillage (test-init.sh)` | **3 min 13 s** | **1 min 14 s** |
| `./init.sh --check` dans le job `contrat` | — | **6 s** |
| Nouveau chemin critique | — | `outillage (test-pret.sh)`, **2 min 44 s** |

**Le harnais qui tenait le chemin critique est divisé par 2,6** — mieux qu'en
local (×2,0), les runners ayant des processus plus coûteux que cette machine.
C'est cohérent : ce qui a été retiré, ce sont des processus.

**Le chemin critique a donc bougé, et c'est le résultat attendu.** Il est
désormais `test-pret.sh`, 2 min 44 s — ce harnais lance `pret.sh`, qui lance
lui-même contrat, tests et revue. Derrière lui vient une deuxième couche, les
dix jobs `revue`, entre 84 s et 125 s.

**Ce relevé sous-estime le gain de cache**, et il faut le dire : `.revue-outils`
vient d'être ajouté aux chemins mis en cache, mais l'entrée restaurée sur ce run
date d'avant et ne le contient pas. Les dix jobs `revue` ont donc encore
réinstallé leurs outils. Le premier run à en profiter est le suivant — c'est là
qu'il faudra reprendre la mesure, et **là seulement** que le chiffre des jobs
`revue` voudra dire quelque chose.

---

### 2026-08-21 — premier relevé du graphe élargi, après le retrait de `build ← test`

```
run 383 (32476316321) — pull_request, PR #158, head 966f044
10 apps, 49 contrôles, conclusion success
```

| | |
|---|---:|
| **Durée du run** | **3 min 50 s** (11:14:42 → 11:18:32) |
| Chemin critique | `outillage (test-init.sh)` **3 min 13 s**, puis `tests-de-l-outillage` 4 s, puis `deploy` |
| Deuxième plus long | `outillage (test-pret.sh)` 2 min 41 s |
| Fin du dernier job d'app | `bout-en-bout (ramure)` à 11:17:58 — **34 s avant** la fin du chemin critique |
| Fin de la matrice `build` | 11:17:10 au plus tard, largement hors du chemin critique |

**Le chemin critique est désormais connu, et ce n'est aucune des deux chaînes
qu'on soupçonnait.** Ni `test → build`, ni `bout-en-bout` : c'est la chaîne de
l'outillage, `test-init.sh` en tête. Les dix apps, leurs tests, leurs revues,
leurs suites en navigateur et leurs images tiennent toutes dans les trois
minutes que ce seul script consomme. **C'est là qu'il faut chercher le prochain
gain de CI**, et nulle part ailleurs.

**Le retrait de `build ← test` a produit ce qu'on attendait**, et une ligne
suffit à le montrer : `build (renaissance-gym)` finit à 11:15:41 alors que
`test (renaissance-gym)` tourne encore jusqu'à 11:16:08. La construction ne
patiente plus.

**La file d'attente n'a pas saturé** : les démarrages s'échelonnent sur environ
86 s pour une trentaine de jobs, ce qui est un allumage, pas un plafond. Le
risque signalé au moment du changement ne s'est pas matérialisé sur ce run — il
reste à surveiller sur un run `main`, qui porte `deploy` en plus.

**Ce relevé ne se compare PAS aux 196 s du 2026-08-18** : ce chiffre valait pour
neuf apps et deux matrices, avant que `revue` et `bout-en-bout` n'en ajoutent
vingt shards. Il n'y a rien à diviser. Cette ligne-ci ouvre la série ; la
suivante s'y comparera.

---

## 2026-08-21 (2) — la revue passe en parallèle

Même machine, mêmes outils, même commit de code applicatif que la référence
ci-dessous. Seul `scripts/revue.sh` a changé : une app par **processus**, quatre
en vol, plafonné à `nproc`.

| scénario | avant | après | verdict |
|---|---:|---:|---|
| `revue-toutes` | 55,01 s [53,33 – 55,90] | **26,88 s** [26,80 – 27,29] | intervalles disjoints — **gain déclaré, ×2,05** |
| `revue-serie` *(témoin, `REVUE_PARALLELE=1`)* | — | 55,79 s [55,78 – 56,03] | recouvre l'ancienne mesure : le témoin dit la vérité |

Le témoin est ce qui rend ce relevé démontrable plutôt que déclaratif : il rejoue
l'ancien chemin dans les conditions du jour, et retombe sur l'ancien chiffre.
Sans lui, on ne saurait pas distinguer un vrai gain d'une machine devenue plus
rapide.

**Deux secondes d'écart avec la mesure brute** du 21 août (25,4 s en `xargs`
direct) : chaque enfant refait le contrôle de présence des trois binaires et
l'amorçage du cache `npx`. C'est le prix du garde-fou, il est payé une fois par
app, et il est visible plutôt que caché.

Les autres scénarios ne sont pas rejoués : aucun ne traverse le code modifié.

---

## 2026-08-21 — référence initiale

```
commit        8037826  (+ docs/banc/ non committé — sans effet sur le code mesuré)
machine       4 cœurs, 15 Go de RAM, charge 0.15 au démarrage
go            local go1.25.0, outil_toolchain go1.26.7
node          v22.22.2
outils        staticcheck 2025.1.1, gosec v2.28.0, govulncheck v1.7.0, jscpd 4.0.5
cache outils  96 Mo (chaud) — GOCACHE 2,8 Go (chaud)
```

| scénario        |  n | médiane |    min |    max | disp. | codes |
|-----------------|---:|--------:|-------:|-------:|------:|-------|
| `contrat`       |  5 |  13,24 s | 12,89 | 13,53 |   5 % | 0 |
| `tests-petite`  |  5 |   0,26 s |  0,24 |  0,27 |  12 % | 0 |
| `revue-petite`  |  5 |   4,07 s |  3,95 |  4,75 |  20 % | 0 |
| `revue-moyenne` |  3 |   7,61 s |  7,50 |  7,66 |   2 % | 0 |
| `revue-toutes`  |  3 |  55,01 s | 53,33 | 55,90 |   5 % | 0 |
| `tests-grosse`  |  3 |  17,03 s | 16,87 | 17,36 |   3 % | 0 |

**Non mesurés** : `e2e-navigateur` et `revue-froid`. Aucun chiffre de CI dans
cette série — la CI est une série séparée, et elle n'a pas été rechronométrée
depuis l'élargissement du graphe le 2026-08-20.

**`revue-petite` est à la limite** : 20 % de dispersion, exactement le seuil.
Sur un scénario de quatre secondes, quelques dixièmes suffisent à l'atteindre.
À rejouer machine au repos avant de s'en servir comme base de comparaison.

### Mesure annexe — le plafond du parallélisme local

Les dix apps lancées comme dix **processus séparés**, quatre en vol :

```bash
ls apps | xargs -P 4 -n 1 ./scripts/revue.sh
```

| | médiane | min | max | code |
|---|---:|---:|---:|---|
| `revue-toutes` en série | 55,01 s | 53,33 | 55,90 | 0 |
| les mêmes dix apps, `-P 4` | **25,39 s** | 24,59 | 25,93 | 0 |

**Facteur 2,2 sur quatre cœurs**, sans modifier une ligne de `revue.sh` : le
fan-out se fait à l'extérieur, par processus. Les deux intervalles ne se
recouvrent pas, donc le gain est déclaré.

Vérifié au même passage : `go.work` et `go.work.sum` **inchangés**, aucun `app.yml`
touché, `git status` propre. Ce n'est pas un acquis pour autant — les verrous à
poser avant d'en faire le comportement par défaut (amorçage des outils, cache
`npx`, ordre d'affichage, agrégation des codes de retour) sont listés dans
[../parallelisme.md](../parallelisme.md).
