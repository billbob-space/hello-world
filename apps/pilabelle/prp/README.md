# Les PRP de pilabelle

Huit documents d'implémentation, dérivés du PRD
[`apps/pilabelle/PRODUCT.md`](../PRODUCT.md).

**Commence par [`00-ossature.md`](00-ossature.md).** C'est le contrat
technique commun — partage serveur/navigateur, formats de données, interfaces
du domaine, routes, identité. Aucun PRP ne s'exécute sans l'avoir lu, et aucun
n'introduit un nom qui n'y figure pas.

## Le niveau de découpe

**Un PRP = une branche `pilabelle/<sujet>` = une pull request = un état
déployable de plus** — même règle que `marcq-handball`. Une exception, et une
seule : le PRP 01, qui porte deux branches et deux pull requests (`socle` puis
`activation`), parce que sur une pull request la CI construit sans publier —
l'app ne peut entrer dans le compose qu'une fois son image publiée.

Le PRD §6 groupe déjà « dictionnaire et algorithme » en un seul item : PRP 02
les livre ensemble plutôt que de les séparer artificiellement. À l'inverse,
« écran du jour », « écran de séance » et « chronomètre » (items 2 à 4) sont
trois items mais un seul geste utilisateur ininterrompu — ils tiennent dans
le même PRP 04, dont c'est le goulot du lot 1.

## Ce qu'ils couvrent

### Lot 1 — le socle quotidien

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [01](01-socle.md) | `socle` | L'URL répond, authentifiée. L'image est publiée, `--check` est vert, le volume persiste. |
| [02](02-dictionnaire.md) | `dictionnaire` | Les 56 exercices sont une donnée vérifiée ; l'algorithme de sélection et l'évolution de niveau sont des fonctions pures, testées règle par règle. |
| [03](03-profil.md) | `profil` | Elle répond au questionnaire une fois ; son profil survit à un redéploiement, cloisonné par compte. |
| [04](04-jour-et-seance.md) | `jour-et-seance` | Elle ouvre l'app et fait sa séance du jour, guidée par vidéo et chronomètre, jusqu'au bout. |
| [05](05-fin-et-recompenses.md) | `fin-et-recompenses` | Le ressenti met à jour son niveau et sa série ; l'écran de fin varie et ne juge jamais. |

### Lot 2 — dès que le lot 1 est en ligne

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [06](06-defi-semaine.md) | `defi-semaine` | Un objectif optionnel par semaine, qui ne peut jamais pénaliser — **contrat**, un verrou de contenu reste ouvert. |
| [07](07-ecran-personnel.md) | `ecran-personnel` | Série, calendrier et niveaux se relisent sur un écran dédié. |

## L'ordre d'exécution

```
01 socle ──┬─> 03 profil ──> 04 jour-et-seance ──> 05 fin-et-recompenses ──┬─> 06 defi-semaine
02 dictionnaire ┘                                                          └─> 07 ecran-personnel
```

01 et 02 se mènent en parallèle — l'un est du déploiement, l'autre de la
donnée et du domaine purs. Ils se rejoignent au PRP 03. **04 est le goulot du
lot 1** : 05 en dépend, et par lui tout le lot 2. 06 et 07 sont
parallélisables entre eux une fois 05 en ligne.

## Deux profondeurs, et pourquoi

Les PRP du **lot 1 (01 à 05) sont exécutables** : tâches, tests écrits avant
le code, code réel, commandes exactes, critères d'acceptation vérifiables. Un
agent les applique sans rien décider — hormis le seul choix documenté à
l'ossature §6 (la série compte les jours actifs, pas les jours calendaires),
retenu par lecture du PRD plutôt qu'escaladé.

Les PRP du **lot 2 (06, 07) sont des contrats** : objectif, interfaces,
règles métier citées, critères d'acceptation. Le PRP 06 porte un verrou
ouvert et nommé — le PRD ne dit ni le contenu ni la génération du défi de la
semaine, à la différence du dictionnaire ou des piques qui sont entièrement
spécifiés. Écrire du code détaillé avant cette décision serait du travail à
jeter.

## Dettes de contenu — closes le 8 août 2026

Les PRP ci-dessus ont été écrits avant que ces deux points ne soient
fermés ; le PRP livré ne se rouvre pas pour les y noter (`memory/produit.md`),
d'où ce compte rendu ici plutôt que dans `02-dictionnaire.md` ou
`04-jour-et-seance.md` :

- **Les deux vidéos non résolues d'`exercices.md`** (`Mobilisation du
  bassin`, `Balancement latéral du buste`) sont closes : la première
  confirmée par le titre de sa vidéo existante ; la seconde, faute d'un
  bon remplaçant trouvable pour le geste décrit, **renommée**
  `Étirement latéral debout` avec une nouvelle vidéo réelle et vérifiée
  (Cleveland Clinic) — jamais une URL devinée pour coller à l'ancien nom.
- **Les stocks de piques, encouragements et mots doux**
  (`data/messages.json`) portent désormais 4 à 6 variantes par famille au
  lieu d'un seul exemple.

Ces dettes ne se voyaient pas dans `--check` : rien dans le contrat de la
fabrique ne vérifie la variété d'un contenu éditorial — c'est resté une
relecture humaine (ici, une demande explicite en conversation) qui les a
fermées, après la mise en ligne du lot 1.
