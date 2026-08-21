# Le banc de mesure de la chaîne de développement

Quand lire : avant de chiffrer une évolution de la chaîne — parallélisme, cache,
graphe de CI, remplacement d'un outil. Les gisements que le banc sert à trancher
sont dans [../parallelisme.md](../parallelisme.md) ; les relevés successifs dans
[releves.md](releves.md).

```bash
./docs/banc/mesurer.sh            # les quatre scénarios légers (~2 min)
./docs/banc/mesurer.sh --lourd    # + les deux lourds (~6 min)
./docs/banc/mesurer.sh --liste
```

Il n'écrit rien dans le dépôt : il chronomètre, il affiche un bloc prêt à
recopier dans `releves.md`, et c'est tout.

## Pourquoi il n'est pas dans `scripts/`

`scripts/` ne porte que des métiers que `pret.sh` ou la CI appellent : chaque
entrée y est un point de passage obligé. Le banc ne s'invoque qu'à la main, quand
on veut chiffrer quelque chose. Un exécutable de plus dans `scripts/` serait un
point de passage que rien ne franchit, et une ligne de plus dans le contrat pour
un outil qui sert trois fois par trimestre.

## Le panel : quatre apps sur dix, et pourquoi celles-là

| App | Ce qu'elle apporte au banc | Chiffres qui le justifient |
|---|---|---|
| `hello-world` | le **plancher de bruit** : son temps est dominé par le démarrage des outils, pas par son code. Elle isole le coût fixe de la chaîne | 403 lignes Go, 2 paquets, `test.sh` réduit à `go vet` + `go test` |
| `pilabelle` | la **configuration complète** : elle exerce les cinq axes en grandeur réelle sans être un monstre | 3 397 lignes Go + 2 235 JS, deux planchers de couverture *et* un plafond de duplication dans son `app.yml` |
| `ramure-v2` | le **pire cas** : si une évolution d'outillage se voit quelque part, c'est ici | 8 041 lignes Go sur **10 paquets** (les autres apps en ont 1 ou 2), seule chaîne TS complète, seul `go test -race` |
| `estran` | le seul e2e **hermétique** : phase dégradée sur un port fermé, phase connue contre un stub local. Aucune API tierce, donc chronométrable sur des mois | 4 975 lignes Go dont 2 594 de test |

Écartées : `cadran`, `compteur` et `ardoise` sont dans la même classe de taille
que `hello-world` et n'ajoutent aucun axe — et les e2e de `compteur` et `ardoise`
montent des conteneurs Docker, le coût qu'on cherche justement à éviter.
`marcq-handball` et `renaissance-gym` sont gros du même côté que `ramure-v2`.
`ramure` v1 est redondant avec `ramure-v2`.

## Les scénarios

| Nom | n | Ce qu'il mesure |
|---|---:|---|
| `contrat` | 5 | le vérificateur seul : manifestes + services, aucune compilation |
| `tests-petite` | 5 | `go vet` + `go test` sur la plus petite app — le coût plancher d'un cycle |
| `revue-petite` | 5 | les cinq axes sur 403 lignes — le coût fixe de la revue |
| `revue-moyenne` | 3 | les cinq axes en configuration complète, Go + JS |
| `revue-toutes` | 3 | les dix apps par le chemin par défaut |
| `revue-serie` | 3 | les mêmes, forcées en série — **le témoin** du parallélisme |
| `outillage` | 1 | `test-init.sh`, 40 cas — **le chemin critique de la CI** |
| `tests-grosse` | 3 | `npm ci` + esbuild + `tsc` + vitest + `go test -race` sur 10 paquets |

Le **témoin** est ce qui rend un gain démontrable plutôt que déclaratif : il
rejoue l'ancien chemin dans les conditions du jour. Sans lui, on ne distingue
pas un vrai gain d'une machine devenue plus rapide.

Deux scénarios manquent encore et le relevé doit continuer à le dire :
`e2e-navigateur` (`apps/estran/e2e/lancer.sh`) et `revue-froid` (le coût d'un
poste neuf, `REVUE_CACHE_OUTILS` et `GOCACHE` détournés vers des répertoires
temporaires — jamais par `rm -rf`, d'autres processus se servent des caches).

**`revue.sh --toutes` sans `--releve` n'écrit dans aucun `app.yml`** : le cliquet
ne bouge qu'en mode relevé explicite. Le banc est donc sans effet sur les
manifestes, et c'est vérifié à chaque passage par un `git status` propre.

## La règle de mesure

- **Le premier passage est jeté** — il peuple le cache de pages du disque et
  paie ce que les suivants ne paieront plus. Il est affiché pour être vu, jamais
  compté. Un scénario à un seul passage n'en a pas : il *est* son premier
  passage, et le relevé doit le dire.
- On publie **`médiane [min – max]`**, jamais la médiane seule : une médiane nue
  cache la variance et rend deux relevés faussement comparables.
- **Dispersion supérieure à 20 % : le relevé est invalide, pas « bruité ».** On
  le rejoue machine au repos. Un relevé dispersé publié empoisonne la série pour
  des mois. Le script le signale lui-même.
- **Un gain n'est déclaré que si la nouvelle médiane sort de l'intervalle
  `[min – max]` de la référence**, dans les deux sens. Avec trois à cinq points
  on ne fait pas de test statistique : on fait de la non-superposition, et on le
  dit.

## Ce qui rend deux relevés incomparables

L'en-tête que `mesurer.sh` imprime porte tout ce qui doit être recopié — ce n'est
pas de la décoration, c'est la condition de la comparaison.

- **La machine.** Quatre cœurs seulement. Un relevé pris pendant qu'un agent
  travaille est faux ; regarder la charge avant de lancer.
- **La chaîne Go.** `outil_toolchain` est épinglé dans `fabrique.yml` et le cache
  d'outils **porte son nom** (`.revue-outils/<toolchain>/`). Toute montée de
  version invalide les 96 Mo de binaires et transforme un « chaud » en « froid »
  sans prévenir.
- **Les quatre versions d'outils** (`staticcheck`, `gosec`, `govulncheck`,
  `jscpd`), toutes dans `fabrique.yml` : un bump change la durée **et** le
  verdict.
- **Le réseau.** `govulncheck` interroge la base de vulnérabilités à chaque
  exécution — environ 3 s par app, incompressibles — et `npx --yes` résout sa
  version sur le registre npm. C'est le premier suspect d'un relevé dispersé.
- **Le code mesuré.** Le script signale un arbre de travail sale. Sur le long
  terme, le remède est de jouer le banc sur un point fixe (`git worktree add
  --detach <sha>`) : ce qui doit bouger d'un relevé à l'autre est l'outillage,
  pas les apps. Changer de point fixe **ouvre une nouvelle série**, il ne la
  prolonge pas.
- **CI et local ne se comparent jamais.** Runners différents, caches d'actions,
  images préchauffées : deux séries, jamais une seule. Et, côté CI, un run sur
  `main` avec déploiement ne se compare pas à un run de pull request sans.

## Ce que le banc ne mesure pas

**Les jetons.** Une session d'agent n'est pas rejouable : on ne peut pas refaire
« la même branche » deux fois. Cette mesure-là se lit dans `scripts/cout.sh`
branche par branche, agrégée par `scripts/jetons.sh`, et se compare en **série
longue sur des branches réelles**, jamais en répétitions. Deux postes à suivre
mois par mois parce qu'ils sont déjà instrumentés : la part des tours de moins de
300 jetons, et la croissance du contexte relu.
