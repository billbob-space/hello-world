# La revue outillée — le détail

Quand lire : avant d'instruire un constat de sécurité, de déplacer un seuil de
`app.yml`, d'ajouter un axe à la revue, ou d'écrire un `prepare.sh`.
Tenu par : --check — forme des trois clés `revue_*` (entier de 0 à 100),
`prepare.sh` exécutable s'il existe, présence de `e2e/lancer.sh` ; et
`test-revue.sh`, vingt-cinq cas sur le cliquet et le refus du vert silencieux

Le contrat n'en garde que l'essentiel : cinq axes, un cliquet, aucun vert
silencieux. Ce fichier porte les formes admises et les pièges. Lis-le **avant**
d'instruire un constat, de déplacer un seuil, ou d'ajouter un axe.

```bash
./scripts/revue.sh                  # les apps touchées par la branche
./scripts/revue.sh <app> [<app>…]   # ces apps
./scripts/revue.sh --toutes         # les dix
./scripts/revue.sh --releve         # mesure et écrit les seuils dans app.yml
```

`./scripts/pret.sh` l'appelle sur les apps touchées, la CI la lance app par app.

## Les cinq axes

| Axe | Go | Navigateur | Ce qui bloque |
|---|---|---|---|
| Qualité, simplification, code mort | `staticcheck` | `tsc --noEmit` là où TypeScript existe | le premier constat |
| Sécurité | `gosec` | — | HIGH ou MEDIUM |
| Dépendances vulnérables | `govulncheck` | `npm audit --audit-level=high` | la première vulnérabilité |
| Couverture | `go test -coverprofile` | `node --test --experimental-test-coverage` | sous `revue_couverture` / `revue_couverture_web` |
| Duplication | `jscpd` | `jscpd` | au-dessus de `revue_duplication` |

Les versions des quatre outils sont épinglées dans `fabrique.yml`, sous
`outil_staticcheck`, `outil_gosec`, `outil_govulncheck`, `outil_jscpd`, **et
nulle part ailleurs**. Rien ne s'installe : `go run <module>@<version>` et
`npx --yes <paquet>@<version>`. Sans réseau, la revue est KO — jamais verte.

## Le cliquet

Trois clés **plates** dans `apps/<nom>/app.yml`. Plates parce que `lib/socle.sh`
ne lit que des scalaires en colonne 0 ; y ajouter un parseur de mapping imbriqué
serait, selon ses propres termes, « une source de bogues muets ».

```yaml
revue_couverture: 37        # % de lignes Go, plancher — ne peut que monter
revue_couverture_web: 86    # % de lignes navigateur, si l'app en a
revue_duplication: 1        # % de lignes dupliquées, plafond — ne peut que descendre
```

`--releve` ne les déplace **que dans le sens qui serre**, et un axe KO ne sème
rien — il le dit plutôt que de se taire. Desserrer une barre est une **édition à
la main** : elle apparaît alors dans le diff de la pull request, donc elle se
discute. C'est le même choix que pour le journal — rendre visible plutôt
qu'interdire.

Les barres ont été semées au niveau du jour, pas à un objectif : couverture
arrondie vers le bas, duplication vers le haut. Une barre posée un cran au-dessus
de la mesure serait rouge à l'instant où on l'écrit.

## Instruire un constat de sécurité

**Chaque constat reçoit un verdict. Deux verdicts, jamais un troisième :**

1. **Corrigé** — le défaut est réel.
2. **Écarté avec sa raison écrite**, sur la ligne concernée :

```go
// #nosec G304 -- le nom vient de hacherUtilisateur (SHA-256 hex), jamais de la requête
```

**Le croisillon est obligatoire.** `//nosec` sans `#` est ignoré **en silence**
par gosec : pas d'avertissement, `Nosec: 0` dans le résumé, et le constat reste
remonté. Trois artisans lancés en parallèle s'y sont fait prendre le même jour,
chacun de son côté. L'option `-nosec-tag` le confirme : « Set an alternative
string for #nosec ».

**« Faux positif » n'est pas une raison.** Une analyse par teinte suit une valeur
depuis son entrée sans savoir si un assainissement en chemin la neutralise :
c'est à toi de remonter jusqu'au point d'entrée et d'écrire **ce qui** la
neutralise, en nommant la fonction. Un correctif de traversée de chemin ou
d'injection s'accompagne d'un **test** qui prouve qu'une entrée hostile est
refusée — sans test, il se défait au refactoring suivant.

**Les mises à l'écart sont comptées et affichées** à chaque passage de la revue :
« aucun constat sur 12 fichiers, 3 écarté(s) par #nosec ». Sans ce comptage,
`#nosec` serait le moyen le plus simple de rendre un axe vert sans rien corriger,
et le seul à ne laisser aucune trace à l'écran.

## `prepare.sh` — facultatif, et appelé par deux métiers

Quand `apps/<nom>/prepare.sh` existe et est exécutable, **`test.sh` et
`revue.sh` l'appellent tous les deux**. Il existe pour les apps dont le binaire
embarque un artefact construit : `ramure-v2` ne compile pas sans son client
TypeScript, `//go:embed web/dist` n'acceptant ni chemin absent ni répertoire
vide. Sans lui, `go test` échoue au setup et l'app **paraît non couverte alors
qu'elle n'a pas été lue**.

Une seule copie de la préparation, appelée deux fois — deux copies finiraient par
diverger, et c'est celle que personne ne lance qui aurait raison.

## Le refus du vert silencieux

C'est le principe qui structure tout le script, et il n'est pas théorique :
**quatre verts silencieux ont été trouvés le jour même de son écriture**, aucun
venant du même endroit, aucun visible dans un diff.

| Ce qui s'est passé | Ce que la revue rendait |
|---|---|
| `jscpd` reçoit un nom de format inconnu (`golang` au lieu de `go`) | « 0 % de duplication », rapport bien formé, périmètre vide |
| `jscpd` écarte par défaut les fichiers de plus de 1000 lignes ou 100 ko | 0 %, en n'ayant pas lu les gros fichiers — ceux où la duplication se cache |
| La couverture navigateur lisait un séparateur de colonnes au lieu du chiffre | une clé vide dans le manifeste |
| `//nosec` mal écrit, puis `#nosec` bien écrit mais invisible | un axe vert sans rien de corrigé |

D'où la règle : **pour chaque axe, le périmètre réellement analysé se compare au
périmètre attendu.** Nombre de fichiers pour `jscpd`, `Stats.files` pour `gosec`,
phrase de conclusion pour `govulncheck`, présence du profil pour la couverture,
détection explicite des erreurs de compilation que `staticcheck` rend sous la
forme d'un constat ordinaire suffixé `(compile)`. **Un axe qui ne lit rien doit
crier, pas rendre 0.**

Corollaire pour qui ajoute un axe : un outil indisponible, un outil qui tombe et
un outil qui n'analyse rien sont **trois KO**. Jamais de `|| true` qui couvre un
pipeline entier — le dépôt a déjà payé cette leçon sur l'inspection des labels
Traefik : « un contrôle de sécurité qui échoue en ouvert est pire que pas de
contrôle : il rassure ».

## Ce que la revue ne fait pas

- **Elle ne mesure pas la duplication dans les tests.** Un tableau de cas répété
  est une duplication légitime ; la compter apprendrait à écrire moins de tests.
- **Elle ne lance pas le bout en bout** : il demande Docker et un navigateur, et
  `pret.sh` passe à chaque étape. Il tourne en CI à chaque changement.
- **Elle relance les tests Go** pour en mesurer la couverture — ils tournent donc
  deux fois, une par `test.sh`, une par la revue. Assumé : `test.sh` est le
  contrat de l'app et peut faire plus que du Go, et lui imposer un format de
  sortie pour économiser quelques secondes coûterait plus cher. Si le coût
  devient pénible, c'est la **couverture** qui partira en CI seulement, pas la
  sécurité.

## Ses tests

`./test-revue.sh` — vingt-cinq cas, deux familles : le cliquet, et le refus du
vert silencieux. Les outils y sont des **doublures** pilotées par variables
d'environnement, ce qui rend la suite rapide, hors-ligne, et surtout capable de
fabriquer les situations qu'un outil réel ne produit qu'accidentellement.

**`node` n'est délibérément pas doublé** : la revue s'en sert pour lire les
rapports JSON et la couverture navigateur. Un bouchon aurait rejoué le format
que je *crois* que node produit — or c'est précisément une erreur de lecture de
ce format qui avait été commise. Un bouchon qui reproduit l'erreur la valide.
