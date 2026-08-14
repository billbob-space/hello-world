# PRP 01 — Le programme et ses règles

| | |
|---|---|
| **Lot** | 1 |
| **Dépend de** | rien — c'est le seul PRP qui démarre sans attendre |
| **Débloque** | 03, 04, 06, 08 : tous lisent le programme ou le domaine |
| **PRD** | §8 en entier, §9 règles 1 à 7 |
| **Ossature** | `00-ossature.md` §6 (modules purs), §7 (points 1 et 2) |

## Objectif

Les deux feuilles du club deviennent une donnée éditable, et les règles qui en
tirent la séance du jour deviennent des fonctions pures, testables sans
navigateur.

## Ce qui est vérifiable à la fin

- `node --test tests/programme.test.js tests/domaine.test.js` passe.
- Un test assert que **l'union des quatre séances vaut exactement les 36
  identifiants** du programme, ni plus ni moins. C'est le test qui prouve que
  l'application transpose la grille et n'en sélectionne pas un morceau.
- Un test assert que `objectif(ex, 1)` rend la valeur basse de la feuille et
  `objectif(ex, 8)` sa valeur haute, pour les 36 exercices.
- Un test lit les sources de `vue-*.js` et **échoue si une valeur d'objectif y
  apparaît en dur** (`'x20'`, `'1min'`, `60`…). Le PRD §8.1 exige que le fichier
  de données soit la seule source.
- Un test vérifie qu'aucun libellé de `programme.json` ne diffère de la
  transcription du PRD §8.2, comparée **au fichier `PRODUCT.md` du dépôt**. Une
  reformulation, même heureuse, fait tomber le test.

## Chantier A — `web/programme.json`

Le fichier de données. Structure :

```json
{
  "titre": "Programme de vacances — La Renaissance Gymnastique",
  "semaines": 8,
  "seances_par_semaine": 4,
  "familles": [
    { "id": "abdominaux", "nom": "Abdominaux" },
    { "id": "gainage",    "nom": "Gainage" },
    { "id": "force",      "nom": "Force" },
    { "id": "equilibres", "nom": "Équilibres" },
    { "id": "placement",  "nom": "Placement du dos" },
    { "id": "acrobatie",  "nom": "Acrobatie" },
    { "id": "sauts",      "nom": "Sauts" },
    { "id": "souplesse",  "nom": "Souplesse" }
  ],
  "exercices": [
    {
      "id": "e01",
      "libelle": "Fermetures",
      "famille": "abdominaux",
      "feuille": 1,
      "mesure": "repetitions",
      "paliers": [10, 13, 16, 20]
    }
  ],
  "seances": [
    { "id": "s1", "nom": "Le socle",      "exercices": ["e01", "…"] }
  ]
}
```

**`mesure`** vaut `repetitions` ou `tenue`. C'est ce qui décide si l'exercice
porte un minuteur (PRD §7.3), et c'est une donnée, pas une devinette faite sur
le libellé.

**`paliers`** porte exactement quatre valeurs, une par palier de deux semaines
(PRD §8.3). Pour une tenue, elles sont en secondes. Pour un exercice à valeur
unique (`x10`), les quatre valeurs sont identiques — l'uniformité de la
structure vaut mieux qu'un cas particulier.

**`variante`**, facultatif, porte le libellé d'origine de la feuille quand
l'application a retenu la version « grandes » (PRD §8.2, exercices 16 et 25) :

```json
{ "id": "e16", "libelle": "ATR valse",
  "variante": "ATR 1/2 valse ou valse (pour les grandes)" }
```

Les 36 exercices et les 4 séances sont ceux du PRD §8.2 et §8.4, dans cet ordre.
Les libellés sont recopiés **mot pour mot**, accents et parenthèses compris.

## Chantier B — `web/programme.js`

Pur : ne touche ni au DOM, ni à `localStorage`, ni au réseau.

```js
export function chargerProgramme(json)        // -> Programme valide, sinon lance
export function exercices(prog)               // -> [Exercice] dans l'ordre du fichier
export function exercice(prog, id)            // -> Exercice | undefined
export function seance(prog, numero)          // numero 1..4 -> Seance
export function exercicesDeSeance(prog, numero)  // -> [Exercice] resolus

export function palierDeSemaine(semaine)      // 1..8 -> 0..3
export function objectif(exercice, semaine)   // -> { valeur, unite: 'repetitions'|'secondes' }
export function objectifTexte(exercice, semaine)  // -> 'x16' | '50 s' | '1 min'

export function couvertureComplete(prog)      // -> true si l'union des seances = tous les exercices
```

`objectifTexte` rend `1 min` et non `60 s` : la feuille écrit « 1min », et
l'utilisatrice lit la feuille. Au-delà de 60 s on n'écrit jamais `90 s`, parce
que le programme n'en contient pas.

`couvertureComplete` existe pour être appelée par un test **et** au chargement,
en développement : une modification du fichier de données qui casse la
couverture doit se voir tout de suite.

## Chantier C — `web/domaine.js`

Les règles du PRD §9, pures. Aucune ne lit l'horloge : le moment courant est
toujours **passé en paramètre**, ce qui les rend testables sans figer le temps.

```js
// L'avancement, tel qu'il est stocke : une liste de faits dates.
// { seance: 1..4, semaine: 1..8, exercice: 'e07', a: '2026-08-14T09:12:00.000Z' }

export function semaineCourante(debutISO, maintenant, semaineDeDepart)
  // -> 1..8, ou 9 quand le programme est termine (PRD §9.7)

export function debutDeSemaine(debutISO, semaine, semaineDeDepart)  // -> Date
export function semaineEstPassee(…) / semaineEstFuture(…)           // PRD §9.3, §9.4

export function faitsDeSeance(faits, semaine, numero)   // -> Set d'identifiants
export function seanceEstFaite(prog, faits, semaine, numero)  // PRD §9.1
export function seancesFaites(prog, faits, semaine)     // -> 0..4
export function prochaineSeance(prog, faits, semaine)   // -> 1..4 | null si les 4 sont faites

export function fusionner(faitsA, faitsB)   // UNION, PRD §9.8 — jamais une soustraction
export function progression(prog, faits)    // -> { seancesFaites, semainesCompletes, exercicesVus }
```

**`fusionner` est le cœur du §9.8** et mérite son propre bloc de tests : deux
listes disjointes, deux listes identiques, deux listes qui se recouvrent
partiellement, une liste vide, et le cas d'un même exercice fait à deux dates
différentes sur deux appareils — la date retenue est la **plus ancienne**, parce
que c'est celle où l'exercice a réellement été fait.

**`prochaineSeance` ne remonte jamais dans le temps** : elle rend la plus petite
séance non faite de la semaine courante, et `null` quand les quatre sont faites
(PRD §7.2, le repos comme résultat).

## Ce qui n'est PAS dans ce PRP

Aucune vue, aucun style, aucun stockage, aucun réseau. Ce PRP se livre
entièrement sans qu'une page s'affiche, et c'est ce qui le rend parallélisable
avec les PRP 02 et 07.
