# Les PRP de `renaissance-gym`

Huit documents. `00-ossature.md` se lit avant tous les autres : il porte
l'architecture, les conventions, le contrat de direction visuelle et le système
de jetons que les sept suivants supposent connus.

| PRP | Lot | Sujet | Dépend de |
|---|---|---|---|
| [`00-ossature.md`](00-ossature.md) | — | Architecture, conventions, contrat de direction, système visuel | — |
| [`01-programme.md`](01-programme.md) | 1 | Les 36 exercices en données, les objectifs par semaine, les 4 séances | — |
| [`02-socle.md`](02-socle.md) | 1 | La coque, le routeur, l'état local, les primitives visuelles | — |
| [`03-entree.md`](03-entree.md) | 1 et 2 | Prénom, semaine de départ, compte, reprise sur un second appareil | 02, et 06 pour l'écran 3 |
| [`04-seance.md`](04-seance.md) | 1 | L'écran du jour, la séance, le minuteur, le son | 01, 02 |
| [`05-grille.md`](05-grille.md) | 1 et 3 | Les huit semaines, les corrections, les badges, les réglages | 01, 02, 04 |
| [`06-serveur.md`](06-serveur.md) | 2 | Le serveur Go, le magasin de fiches, l'API, le `Dockerfile` | — |
| [`07-synchro.md`](07-synchro.md) | 2 | Le client de synchronisation, la fusion, les états de réseau | 02, 06 |

## L'ordre d'exécution

```
01-programme  ─┬─→ 04-seance ─┐
02-socle      ─┤              ├─→ 05-grille
               ├─→ 03-entree ─┘
06-serveur    ─────→ 07-synchro
```

Les PRP 01, 02 et 06 démarrent en parallèle : aucun ne dépend des autres.

## Le verrou

Le PRP 06 porte un verrou d'exploitation, hérité du PRD §12.1 : **le volume
nommé doit survivre au redéploiement.** Tant qu'il ne le fait pas, le lot 2
promet une sauvegarde qu'il ne rend pas — et l'application aurait alors cessé de
se suffire à elle-même en échange de rien. Le lot 1 est complet sans lui.

## Les cinq points qui se vérifient par un test

Rappelés ici parce qu'ils traversent plusieurs PRP, et qu'un PRP qui les casse
est refusé même si son écran est réussi. Le détail est dans l'ossature §7.

1. L'union des quatre séances vaut exactement les 36 exercices.
2. Aucun objectif n'est écrit en dur dans une vue.
3. La fusion de deux fiches est une union : aucune case cochée ne se décoche.
4. Le minuteur ne se raccourcit pas.
5. Le code n'est jamais stocké en clair côté serveur.

## Ce qui a autorité, et dans quel ordre

1. **Les deux feuilles du club** — les libellés, les objectifs, les mouvements.
   Elles ne se reformulent pas.
2. **`../PRODUCT.md`** — le PRD. Ce qu'il exclut au §6 reste exclu ; ce qu'il
   tranche au §15 est tranché.
3. **`00-ossature.md`** — le contrat de direction et les jetons. Une valeur
   nouvelle s'y ajoute ; elle ne se redéfinit pas dans un coin.
4. **Le PRP du lot** — pour tout le reste.

Un désaccord entre deux niveaux se règle en faveur du plus haut, et se signale
dans l'entrée de journal de la branche.
