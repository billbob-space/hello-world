# PRP 02 — Le programme comme donnée

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `apps/marcq-handball/PRODUCT.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/programme` |
| **Dépend de** | PRP 01 — pour le squelette du répertoire (`app.yml`, `go.mod`, `main.go`, `Dockerfile`, `.dockerignore`, `test.sh`). Sur le fond les deux sont parallélisables : ce PRP n'écrit ni Go ni HTML. |
| **Débloque** | PRP 03 (entrée), 04 (séance), 05 (perso), 06 (récompenses), 07 (l'API relit le même `programme.json`), 11 (bilan) |
| **Sections du PRD** | §8 (le programme), §9 (règles métier) |

## Objectif

Le programme du coach devient une donnée vérifiée par ses propres totaux, et le
domaine devient sept fonctions pures que `node --test` prouve sans navigateur.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/*.test.js` affiche `# pass 29` et `# fail 0`.
- Les sept totaux du PRD §8 — 226 pompes, 345 squats, 105 burpees, 210 abdos,
  1425 s de gainage, 235 min de course, 53 cases — sont **recalculés** depuis
  `web/programme.json` et non écrits dans le code : un test échoue si l'un des
  sept nombres apparaît dans `web/domaine.js`.
- Changer une valeur dans `web/programme.json` change le total sans qu'une ligne
  de code bouge (test `les totaux ne sont ecrits nulle part dans le code`).
- `web/domaine.js` ne contient ni `import`, ni `document`, ni `window`, ni
  `localStorage`, ni `new Date`, ni `Date.now`, ni `fetch(` — vérifié par un test,
  pas par relecture.
- `./apps/marcq-handball/test.sh` lance les tests Node **avant** les tests Go.
- `./init.sh --check` est vert.

## Périmètre

**Dedans :** `apps/marcq-handball/package.json` ; `web/programme.json` saisi
intégralement depuis le PRD §8 (7 séances, 53 exercices, tours et repos) ;
`web/domaine.js` avec les sept fonctions exportées de l'ossature §5 ;
`tests/domaine.test.js` ; le branchement de `node --test` dans `test.sh` ; deux
lignes de `.dockerignore` ; une section du `README.md`.

**Dehors, et pourquoi :**
- Tout affichage — ce PRP n'écrit pas une ligne de HTML ni de CSS. Les écrans
  sont les PRP 03, 04, 05, 11.
- `web/etat.js` et `localStorage` — PRP 04. Le domaine reçoit `faits` en
  paramètre, il ne va jamais le chercher.
- Le calcul de « aujourd'hui » en `Europe/Paris` — PRP 03, dans `app.js`
  (ossature §5). Ici, `aujourdhui` est toujours un argument.
- Le rang et le serveur — PRP 07.

## Interfaces

**Consomme :**
- Ossature §3 (arborescence), §4 (format de `programme.json`), §5 (signatures de
  `domaine.js`), §6 (forme de `faits` : `{ [idExercice]: horodatageISO }`).
- PRD §8 (le texte des sept séances et les six volumes prescrits), §9 (les règles
  métier).
- Du PRP 01 : `apps/marcq-handball/test.sh`, `apps/marcq-handball/.dockerignore`,
  `apps/marcq-handball/README.md`.

**Produit :**

```js
// web/domaine.js — les sept exports de l'ossature §5, et rien d'autre.
export function chargerProgramme(json)                       // -> Programme gelé en profondeur ; lève Error si invalide
export function totauxPrescrits(prog)                        // -> { pompes, squats, burpees, abdos, gainage_s, min_course, fentes, cases }
export function totauxAccomplis(prog, faits = {})            // -> même forme
export function etatSeance(prog, dateISO, aujourdhui, faits = {})
//   -> { statut, cochable, total, coches } | null si aucune séance ce jour-là
export function seanceDuJour(prog, aujourdhui)               // -> { seance: Seance|null, cas }
export function calendrier(prog, aujourdhui, faits = {})     // -> [{ date, seance: Seance|null, statut }]
export function progression(prog, aujourdhui, faits = {})    // -> { cochees, programmees, part }
```

```
web/programme.json  — { titre, debut: "2026-08-03", fin: "2026-08-21", seances: [...] }
                      53 identifiants stables : s1-c1 s1-c2 s1-r1..s1-r6
                                                s2-c1..s2-c3 s2-r1..s2-r5
                                                s3-c1 s3-r1..s3-r5
                                                s4-c1 s4-c2 s4-r1..s4-r5
                                                s5-c1 s5-c2 s5-r1..s5-r5
                                                s6-c1..s6-c3 s6-r1..s6-r6
                                                s7-c1 s7-c2 s7-r1..s7-r6
```

**Cinq noms ou décisions que l'ossature ne fixe pas — ils sont définis ici et les
PRP aval s'y tiennent :**

1. **`apps/marcq-handball/package.json`** — `{ "type": "module" }`, sans aucune
   dépendance. Sans lui, Node lit `web/domaine.js` comme du CommonJS et `export`
   est une erreur de syntaxe ; le navigateur, lui, s'en moque. C'est une
   déclaration de format, pas une chaîne de construction : ni script, ni
   `dependencies`, ni `package-lock.json`, ni `node_modules`.
2. **`bloc.titre`** — champ **optionnel** de bloc, chaîne non vide. Le domaine
   l'ignore complètement ; seul l'écran de séance (PRP 04) l'utilise, avec la
   règle : `bloc.titre ?? (bloc.type === 'course' ? 'Course' : 'Renforcement')`.
   Il existe pour un seul bloc du programme — le vendredi 7 août, où le coach a
   écrit « 30 à 40 minutes d'un autre sport » sans le ranger sous « Course ».
3. **`statut: 'repos'`** — valeur rendue par `calendrier` pour un jour sans
   séance. L'ossature §5 énumère cinq statuts pour `etatSeance` ; `calendrier`
   couvre dix-neuf jours dont douze sans séance, il lui en faut un sixième.
   PRD §9 : *« Les jours sans séance sont du repos, pas un trou. »*
4. **`etatSeance` rend `null`** pour une date sans séance. Rendre un état à zéro
   ferait passer un jour de repos pour une séance vide non faite.
5. **`cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin`** — la formule
   de l'ossature §5 s'arrête au premier terme. Le second vient du PRD §9,
   *« Après le 21 août […] plus rien n'est cochable »*, qui prime — l'en-tête de
   l'ossature le dit : *« En cas de désaccord, le PRD gagne et ce fichier est
   corrigé. »* Voir « Points d'attention ».

## Fichiers

- Créer : `apps/marcq-handball/package.json`,
  `apps/marcq-handball/web/programme.json`,
  `apps/marcq-handball/web/domaine.js`,
  `apps/marcq-handball/tests/domaine.test.js`
- Modifier : `apps/marcq-handball/test.sh`,
  `apps/marcq-handball/.dockerignore`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/domaine.test.js`

---

## Les décisions de saisie, et leur conséquence chiffrée

Elles ne sont pas des préférences : chacune déplace un des sept totaux. Un agent
qui saisit sans les appliquer rate les assertions de la tâche 1 et ne saura pas
laquelle des 53 lignes est en cause.

| Cas du PRD §8 | Saisie | Ce qui change sinon |
|---|---|---|
| « 45 s chaise contre un mur » (7 août) | `unite: "autre"`, `valeur: 0` | En `gainage_s` : +45 × 3 tours = **+135 s**, total 1560 s ≈ 26 min au lieu de 1425 s ≈ 24 min |
| « 30 à 40 minutes d'un autre sport » (7 août) | `unite: "min_course"`, `valeur: 35` — la médiane | À 30 : total 230 min ; à 40 : 240 min. Ni l'un ni l'autre ne vaut 235 |
| « 6 × 100 m à 80 % » (3 août) | `unite: "autre"`, `valeur: 0` | On ne convertit **jamais** une distance en durée ; toute valeur inventée casse les 235 min |
| « 30 s gainage de chaque côté » (3 et 14 août) | `unite: "gainage_s"`, `valeur: 60` — les deux côtés | À 30 : 1425 − 300 = 1125 s. C'est le total prescrit qui arbitre : l'enfant tient bien 60 s de gainage par tour |
| « 15 fentes **par jambe** » (3, 7, 14 août) | `valeur` = le nombre écrit par le coach, **non doublé** | Le PRD ne verrouille aucun total de fentes ; doubler rendrait le chiffre affiché incohérent avec le libellé que l'enfant lit |
| « 2 séries de 8 × (30 s / 30 s), 3 min de récup » (5 août) | `min_course: 19` = 2 × 8 × 1 min + 3 min | Sans la récupération : 16, et le total tombe à 232 |
| « 6 × 2 min rapides, récup 1 min entre chaque » (12 août) | `min_course: 17` = 6 × 2 + **5** récupérations | Six récupérations donneraient 18 : il y a N−1 intervalles entre N répétitions |
| « 5 min de 15-15 puis 5 min de 30-30, 1 min de repos » (17 août) | `min_course: 11` = 5 + 1 + 5 | Sans le repos : 10, et le total tombe à 234 |
| « 8 min de 15-15 », « 10 min de 30-30 m » | la durée écrite : 8 et 10 | Le coach l'a écrite, on la prend telle quelle |
| Vendredi 7 août, séance sans titre | `titre: "Autre sport + Renforcement"` | Le coach n'a pas titré cette séance ; le titre sert d'en-tête d'écran (PRP 04) et un titre vide y laisserait un trou |
| Lundi 17 août rangé sous « Semaine 2 » | `semaine: 2` | PRD §8 : le découpage est celui du coach, *« reproduit, pas corrigé »* |

**La règle générale des blocs de course :** on compte la durée totale du bloc,
récupérations comprises, dès que le coach a écrit les durées ; on porte `autre`
dès qu'il n'a écrit qu'une distance.

**Une ligne = une case, quel que soit le nombre de tours.** Les tours multiplient
le volume dans `totauxPrescrits`, jamais le nombre de cases. C'est ce qui donne
53 cases et non 122 — et 122 cases à taper sur trois semaines, c'est l'app que
personne ne finit.

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/programme
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`.

---

### Tâche 1 — le programme saisi, prouvé par ses sept totaux

**Fichiers :** Créer `apps/marcq-handball/package.json` · Créer `apps/marcq-handball/tests/domaine.test.js` · Créer `apps/marcq-handball/web/domaine.js` · Créer `apps/marcq-handball/web/programme.json` · Modifier `apps/marcq-handball/test.sh`

Le test avant la donnée : les assertions de totaux sont écrites en premier, elles
échouent tant que la saisie est incomplète ou fausse, et c'est exactement ce qui
attrape une faute de frappe dans 53 lignes d'exercices. La table par séance sert
à localiser : les sept totaux disent *qu'il y a* une faute, la table dit *où*.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/package.json` (Node doit savoir lire `web/domaine.js`
comme un module ES, sinon le test ne démarre même pas) :

```json
{
  "name": "marcq-handball",
  "private": true,
  "type": "module",
  "description": "Le domaine et l'etat sont des modules ES natifs. Ce fichier ne sert qu'a le dire a Node : aucune dependance, aucun script, aucun node_modules."
}
```

Créer `apps/marcq-handball/tests/domaine.test.js` :

```js
// tests/domaine.test.js — le domaine se prouve ici, sans navigateur.
// Ce repertoire n'est jamais embarque dans l'image : voir .dockerignore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as domaine from '../web/domaine.js';

// Le programme est lu comme un fichier, pas importe : la syntaxe
// `import ... with { type: 'json' }` n'est pas stable d'une version de Node a
// l'autre, readFileSync l'est depuis toujours.
const brut = JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
);
const prog = domaine.chargerProgramme(brut);

test('les sept totaux prescrits, recalcules depuis programme.json (PRD §8)', () => {
  const t = domaine.totauxPrescrits(prog);
  assert.equal(t.pompes, 226, 'pompes');
  assert.equal(t.squats, 345, 'squats, toutes variantes');
  assert.equal(t.burpees, 105, 'burpees');
  assert.equal(t.abdos, 210, 'abdos et crunchs');
  assert.equal(t.gainage_s, 1425, 'gainage en secondes, soit 23 min 45');
  assert.equal(t.min_course, 235, 'course en minutes, soit 3 h 55');
  assert.equal(t.cases, 53, 'cases cochables');
});

test('la repartition seance par seance localise une faute de saisie', () => {
  const attendu = [
    { date: '2026-08-03', pompes: 30, squats: 40, burpees: 30, abdos: 0, gainage_s: 210, min_course: 30, fentes: 30, cases: 8 },
    { date: '2026-08-05', pompes: 0, squats: 60, burpees: 0, abdos: 60, gainage_s: 135, min_course: 39, fentes: 0, cases: 8 },
    { date: '2026-08-07', pompes: 36, squats: 45, burpees: 0, abdos: 0, gainage_s: 180, min_course: 35, fentes: 36, cases: 6 },
    { date: '2026-08-10', pompes: 40, squats: 40, burpees: 0, abdos: 40, gainage_s: 240, min_course: 28, fentes: 40, cases: 7 },
    { date: '2026-08-12', pompes: 45, squats: 60, burpees: 45, abdos: 0, gainage_s: 180, min_course: 32, fentes: 0, cases: 7 },
    { date: '2026-08-14', pompes: 45, squats: 60, burpees: 0, abdos: 60, gainage_s: 360, min_course: 35, fentes: 45, cases: 9 },
    { date: '2026-08-17', pompes: 30, squats: 40, burpees: 30, abdos: 50, gainage_s: 120, min_course: 36, fentes: 40, cases: 8 },
  ];
  assert.equal(prog.seances.length, attendu.length, 'nombre de seances');
  for (const [i, ligne] of attendu.entries()) {
    const { date, ...volumes } = ligne;
    assert.equal(prog.seances[i].date, date, `date de la seance ${i + 1}`);
    // On isole une seance en rejouant totauxPrescrits sur un programme d'une
    // seule seance : aucune API supplementaire a maintenir pour ce test.
    const t = domaine.totauxPrescrits({ ...prog, seances: [prog.seances[i]] });
    assert.deepEqual(t, volumes, `volumes de la seance du ${date}`);
  }
});

test('les 53 identifiants sont uniques et suivent le format s<n>-<c|r><n>', () => {
  const ids = [];
  for (const seance of prog.seances) {
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) ids.push(ex.id);
    }
  }
  assert.equal(ids.length, 53, 'nombre de cases');
  assert.equal(new Set(ids).size, ids.length, 'aucun identifiant en double');
  // Le nombre de seances n'est pas fige dans le motif : la page 3 de la note du
  // coach peut en ajouter (PRD §12.3), et `s8-r1` doit rester valide.
  for (const id of ids) assert.match(id, /^s[1-9]\d*-[cr][1-9]\d*$/, `format de ${id}`);
});

test('domaine.js est pur : ni dependance, ni navigateur, ni horloge', () => {
  const source = readFileSync(new URL('../web/domaine.js', import.meta.url), 'utf8');
  for (const interdit of ['document', 'window', 'localStorage', 'new Date', 'Date.now', 'fetch(']) {
    assert.equal(source.includes(interdit), false, `domaine.js ne doit pas contenir ${interdit}`);
  }
  assert.equal(/^\s*import\s/m.test(source), false, 'domaine.js n importe rien');
});

test('les totaux ne sont ecrits nulle part dans le code (PRD §8)', () => {
  const source = readFileSync(new URL('../web/domaine.js', import.meta.url), 'utf8');
  for (const nombre of ['226', '345', '105', '210', '1425', '235', '53']) {
    assert.equal(source.includes(nombre), false, `${nombre} ne doit pas figurer dans domaine.js`);
  }
  // Editer le fichier de donnees suffit a changer le total : 15 pompes -> 10,
  // sur deux tours, retire 10 pompes aux 226 prescrites.
  const allege = structuredClone(brut);
  allege.seances[0].blocs[1].exercices[0].mesure.valeur = 10;
  assert.equal(domaine.totauxPrescrits(domaine.chargerProgramme(allege)).pompes, 216);
});
```

Modifier `apps/marcq-handball/test.sh` — les tests Node passent **avant** les
tests Go : ils tiennent en une seconde et couvrent la quasi-totalité du produit.
Contenu complet du fichier après modification :

```bash
#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

# Le domaine et l'etat vivent dans le navigateur. Ils se testent avec le
# node --test de la bibliotheque standard : aucune dependance, aucune
# installation, le runner de la CI fournit Node. On lui passe des fichiers et
# non le repertoire : `node --test tests/` traite `tests` comme un fichier.
node --test tests/*.test.js

go vet ./...
go test ./...
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 0` et `# fail 1` — le fichier de test ne se charge même
pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../apps/marcq-handball/web/domaine.js' imported from .../apps/marcq-handball/tests/domaine.test.js`

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/domaine.js`. À ce stade, seul ce que les tests de
cette tâche exigent : le cumul et le point d'entrée. La validation dure arrive à
la tâche 2, avec ses propres tests.

```js
// domaine.js — le domaine de marcq-handball, pur.
//
// Aucun acces au navigateur, aucun stockage, aucune horloge implicite : le jour
// courant est toujours un parametre. C'est ce qui permet a node --test de
// prouver ce module tel que le navigateur le charge, sans transpilation.
//
// Toutes les dates sont des jours calendaires 'YYYY-MM-DD' compares comme des
// chaines : l'ordre lexicographique de l'ISO 8601 est l'ordre chronologique.

// Les unites mesurables. `autre` existe pour les exercices sans volume
// calculable et n'entre dans aucun total.
const UNITES = [
  'pompes', 'squats', 'burpees', 'abdos',
  'gainage_s', 'min_course', 'fentes', 'autre',
];

const UNITES_CUMULEES = UNITES.filter((u) => u !== 'autre');

function totauxVides() {
  const totaux = { cases: 0 };
  for (const unite of UNITES_CUMULEES) totaux[unite] = 0;
  return totaux;
}

function estFait(faits, id) {
  return Object.prototype.hasOwnProperty.call(faits, id);
}

// Une ligne d'exercice vaut une case, quel que soit le nombre de tours ; les
// tours ne multiplient que le volume.
function cumuler(prog, garder) {
  const totaux = totauxVides();
  for (const seance of prog.seances) {
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) {
        if (!garder(ex, seance)) continue;
        totaux.cases += 1;
        if (ex.mesure.unite !== 'autre') {
          totaux[ex.mesure.unite] += ex.mesure.valeur * bloc.tours;
        }
      }
    }
  }
  return totaux;
}

// Point d'entree unique du programme : tout le reste part de sa valeur de retour.
export function chargerProgramme(json) {
  return json;
}

// Volume prescrit par le programme entier, tours compris.
export function totauxPrescrits(prog) {
  return cumuler(prog, () => true);
}
```

Créer `apps/marcq-handball/web/programme.json` — la saisie intégrale du PRD §8,
selon les décisions du tableau ci-dessus :

```json
{
  "titre": "Programme d'été U15 — Marcq Handball",
  "debut": "2026-08-03",
  "fin": "2026-08-21",
  "seances": [
    {
      "date": "2026-08-03",
      "semaine": 1,
      "titre": "Endurance + Renforcement",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s1-c1", "libelle": "30 minutes de footing à allure confortable", "mesure": { "unite": "min_course", "valeur": 30 } },
            { "id": "s1-c2", "libelle": "6 × 100 m à 80 %, récupération en marchant", "mesure": { "unite": "autre", "valeur": 0 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 2,
          "repos": "1 min 30 entre les tours",
          "exercices": [
            { "id": "s1-r1", "libelle": "15 pompes", "mesure": { "unite": "pompes", "valeur": 15 } },
            { "id": "s1-r2", "libelle": "20 squats", "mesure": { "unite": "squats", "valeur": 20 } },
            { "id": "s1-r3", "libelle": "15 fentes par jambe", "mesure": { "unite": "fentes", "valeur": 15 } },
            { "id": "s1-r4", "libelle": "45 s de gainage ventral", "mesure": { "unite": "gainage_s", "valeur": 45 } },
            { "id": "s1-r5", "libelle": "30 s de gainage de chaque côté", "mesure": { "unite": "gainage_s", "valeur": 60 } },
            { "id": "s1-r6", "libelle": "15 burpees", "mesure": { "unite": "burpees", "valeur": 15 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-05",
      "semaine": 1,
      "titre": "Fractionné",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s2-c1", "libelle": "10 minutes de footing", "mesure": { "unite": "min_course", "valeur": 10 } },
            { "id": "s2-c2", "libelle": "2 séries de 8 × (30 s rapides à fond / 30 s lentes), 3 minutes de récupération entre les séries", "mesure": { "unite": "min_course", "valeur": 19 } },
            { "id": "s2-c3", "libelle": "10 minutes de footing pour terminer", "mesure": { "unite": "min_course", "valeur": 10 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 3,
          "exercices": [
            { "id": "s2-r1", "libelle": "20 mountain climbers", "mesure": { "unite": "autre", "valeur": 0 } },
            { "id": "s2-r2", "libelle": "15 dips sur une chaise", "mesure": { "unite": "autre", "valeur": 0 } },
            { "id": "s2-r3", "libelle": "20 jumping squats", "mesure": { "unite": "squats", "valeur": 20 } },
            { "id": "s2-r4", "libelle": "20 abdos", "mesure": { "unite": "abdos", "valeur": 20 } },
            { "id": "s2-r5", "libelle": "45 s de gainage", "mesure": { "unite": "gainage_s", "valeur": 45 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-07",
      "semaine": 1,
      "titre": "Autre sport + Renforcement",
      "blocs": [
        {
          "type": "course",
          "titre": "Autre sport",
          "tours": 1,
          "exercices": [
            { "id": "s3-c1", "libelle": "30 à 40 minutes d'un autre sport (piscine, vélo…)", "mesure": { "unite": "min_course", "valeur": 35 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 3,
          "exercices": [
            { "id": "s3-r1", "libelle": "12 pompes", "mesure": { "unite": "pompes", "valeur": 12 } },
            { "id": "s3-r2", "libelle": "15 squats sautés", "mesure": { "unite": "squats", "valeur": 15 } },
            { "id": "s3-r3", "libelle": "12 fentes sautées par jambe", "mesure": { "unite": "fentes", "valeur": 12 } },
            { "id": "s3-r4", "libelle": "45 s de chaise contre un mur", "mesure": { "unite": "autre", "valeur": 0 } },
            { "id": "s3-r5", "libelle": "1 min de gainage", "mesure": { "unite": "gainage_s", "valeur": 60 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-10",
      "semaine": 2,
      "titre": "Endurance active",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s4-c1", "libelle": "20 minutes de footing", "mesure": { "unite": "min_course", "valeur": 20 } },
            { "id": "s4-c2", "libelle": "8 min de 15-15", "mesure": { "unite": "min_course", "valeur": 8 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 4,
          "exercices": [
            { "id": "s4-r1", "libelle": "10 squats", "mesure": { "unite": "squats", "valeur": 10 } },
            { "id": "s4-r2", "libelle": "10 pompes", "mesure": { "unite": "pompes", "valeur": 10 } },
            { "id": "s4-r3", "libelle": "10 fentes", "mesure": { "unite": "fentes", "valeur": 10 } },
            { "id": "s4-r4", "libelle": "10 crunchs", "mesure": { "unite": "abdos", "valeur": 10 } },
            { "id": "s4-r5", "libelle": "1 min de gainage", "mesure": { "unite": "gainage_s", "valeur": 60 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-12",
      "semaine": 2,
      "titre": "Fractionné long",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s5-c1", "libelle": "15 minutes de footing", "mesure": { "unite": "min_course", "valeur": 15 } },
            { "id": "s5-c2", "libelle": "6 × 2 minutes rapides, récupération 1 minute de footing lent entre chaque répétition", "mesure": { "unite": "min_course", "valeur": 17 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 3,
          "exercices": [
            { "id": "s5-r1", "libelle": "15 burpees", "mesure": { "unite": "burpees", "valeur": 15 } },
            { "id": "s5-r2", "libelle": "20 mountain climbers", "mesure": { "unite": "autre", "valeur": 0 } },
            { "id": "s5-r3", "libelle": "15 pompes", "mesure": { "unite": "pompes", "valeur": 15 } },
            { "id": "s5-r4", "libelle": "20 squats", "mesure": { "unite": "squats", "valeur": 20 } },
            { "id": "s5-r5", "libelle": "1 min de gainage", "mesure": { "unite": "gainage_s", "valeur": 60 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-14",
      "semaine": 2,
      "titre": "Vitesse + Renforcement",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s6-c1", "libelle": "10 minutes d'échauffement", "mesure": { "unite": "min_course", "valeur": 10 } },
            { "id": "s6-c2", "libelle": "10 min de 30-30 m à 80 %", "mesure": { "unite": "min_course", "valeur": 10 } },
            { "id": "s6-c3", "libelle": "15 minutes de footing", "mesure": { "unite": "min_course", "valeur": 15 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 3,
          "exercices": [
            { "id": "s6-r1", "libelle": "15 pompes", "mesure": { "unite": "pompes", "valeur": 15 } },
            { "id": "s6-r2", "libelle": "20 squats sautés", "mesure": { "unite": "squats", "valeur": 20 } },
            { "id": "s6-r3", "libelle": "15 fentes par jambe", "mesure": { "unite": "fentes", "valeur": 15 } },
            { "id": "s6-r4", "libelle": "20 abdos", "mesure": { "unite": "abdos", "valeur": 20 } },
            { "id": "s6-r5", "libelle": "1 min de gainage ventral", "mesure": { "unite": "gainage_s", "valeur": 60 } },
            { "id": "s6-r6", "libelle": "30 s de gainage de chaque côté", "mesure": { "unite": "gainage_s", "valeur": 60 } }
          ]
        }
      ]
    },
    {
      "date": "2026-08-17",
      "semaine": 2,
      "titre": "Séance de validation",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            { "id": "s7-c1", "libelle": "25 minutes de footing", "mesure": { "unite": "min_course", "valeur": 25 } },
            { "id": "s7-c2", "libelle": "5 min de 15-15 puis 5 min de 30-30, 1 min de repos entre les deux séries", "mesure": { "unite": "min_course", "valeur": 11 } }
          ]
        },
        {
          "type": "renforcement",
          "tours": 2,
          "exercices": [
            { "id": "s7-r1", "libelle": "20 squats", "mesure": { "unite": "squats", "valeur": 20 } },
            { "id": "s7-r2", "libelle": "15 pompes", "mesure": { "unite": "pompes", "valeur": 15 } },
            { "id": "s7-r3", "libelle": "20 fentes", "mesure": { "unite": "fentes", "valeur": 20 } },
            { "id": "s7-r4", "libelle": "15 burpees", "mesure": { "unite": "burpees", "valeur": 15 } },
            { "id": "s7-r5", "libelle": "25 crunchs", "mesure": { "unite": "abdos", "valeur": 25 } },
            { "id": "s7-r6", "libelle": "1 min de gainage", "mesure": { "unite": "gainage_s", "valeur": 60 } }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 5`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/package.json apps/marcq-handball/test.sh \
        apps/marcq-handball/web/domaine.js apps/marcq-handball/web/programme.json \
        apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : le programme comme donnee, verifie par ses sept totaux"
git push -u origin HEAD
```

---

### Tâche 2 — `chargerProgramme` refuse une saisie fausse

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

L'ossature §4 le dit : *« Renuméroter un `id` efface la progression de tout le
monde. »* Un doublon d'identifiant est donc une perte de données silencieuse, pas
une coquille — il doit lever, tout de suite, avec le nom du coupable.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
test('chargerProgramme refuse un identifiant en double', () => {
  const copie = structuredClone(brut);
  copie.seances[0].blocs[1].exercices[1].id = copie.seances[0].blocs[1].exercices[0].id;
  assert.throws(() => domaine.chargerProgramme(copie), /identifiant en double : s1-r1/);
});

test('chargerProgramme refuse une unite inconnue', () => {
  const copie = structuredClone(brut);
  copie.seances[0].blocs[1].exercices[3].mesure.unite = 'gainage';
  assert.throws(() => domaine.chargerProgramme(copie), /unite inconnue pour s1-r4 : gainage/);
});

test('chargerProgramme refuse des seances hors bornes ou desordonnees', () => {
  const horsBornes = structuredClone(brut);
  horsBornes.seances[6].date = '2026-08-24';
  assert.throws(() => domaine.chargerProgramme(horsBornes), /seance hors programme : 2026-08-24/);

  const desordre = structuredClone(brut);
  desordre.seances[1].date = '2026-08-03';
  assert.throws(() => domaine.chargerProgramme(desordre), /seances non ordonnees ou dupliquees/);

  const toursNuls = structuredClone(brut);
  toursNuls.seances[0].blocs[1].tours = 0;
  assert.throws(() => domaine.chargerProgramme(toursNuls), /tours invalide/);
});

test('le programme rendu est gele : personne ne le mute par accident', () => {
  const gele = domaine.chargerProgramme(structuredClone(brut));
  assert.throws(() => { gele.seances[0].titre = 'autre'; }, TypeError);
  assert.throws(() => { gele.seances[0].blocs[1].exercices[0].mesure.valeur = 99; }, TypeError);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 5` et `# fail 4`, chacun sur
`error: 'Missing expected exception.'` — `chargerProgramme` rend son argument
sans rien vérifier.

- [ ] **Étape 3 — l'implémentation minimale**

Dans `apps/marcq-handball/web/domaine.js`, ajouter ces constantes et ces
fonctions sous `estFait`, puis **remplacer** le corps de `chargerProgramme` :

```js
const TYPES_BLOC = ['course', 'renforcement'];
const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

function refuser(message) {
  throw new Error(`programme invalide : ${message}`);
}

// Le programme est une donnee, pas un etat : personne ne le mute apres le
// chargement. Le gel rend l'accident bruyant plutot que silencieux, les modules
// ES etant en mode strict.
function gelerEnProfondeur(valeur) {
  if (valeur === null || typeof valeur !== 'object') return valeur;
  for (const enfant of Object.values(valeur)) gelerEnProfondeur(enfant);
  return Object.freeze(valeur);
}

export function chargerProgramme(json) {
  if (json === null || typeof json !== 'object') refuser("la racine n'est pas un objet");
  if (!JOUR_ISO.test(json.debut)) refuser(`debut n'est pas une date YYYY-MM-DD : ${json.debut}`);
  if (!JOUR_ISO.test(json.fin)) refuser(`fin n'est pas une date YYYY-MM-DD : ${json.fin}`);
  if (json.fin < json.debut) refuser('fin est anterieure a debut');
  if (!Array.isArray(json.seances) || json.seances.length === 0) refuser('aucune seance');

  const identifiants = new Set();
  let precedente = '';

  for (const seance of json.seances) {
    if (!JOUR_ISO.test(seance.date)) refuser(`date de seance invalide : ${seance.date}`);
    // Les seances sont strictement croissantes : seanceDuJour et calendrier
    // prennent la premiere qui correspond, un desordre les rendrait faux.
    if (seance.date <= precedente) refuser(`seances non ordonnees ou dupliquees : ${seance.date}`);
    if (seance.date < json.debut || seance.date > json.fin) refuser(`seance hors programme : ${seance.date}`);
    precedente = seance.date;

    if (typeof seance.titre !== 'string' || seance.titre === '') refuser(`titre manquant : ${seance.date}`);
    if (!Number.isInteger(seance.semaine) || seance.semaine < 1) refuser(`semaine invalide : ${seance.date}`);
    if (!Array.isArray(seance.blocs) || seance.blocs.length === 0) refuser(`aucun bloc : ${seance.date}`);

    for (const bloc of seance.blocs) {
      if (!TYPES_BLOC.includes(bloc.type)) refuser(`type de bloc inconnu : ${bloc.type}`);
      if (!Number.isInteger(bloc.tours) || bloc.tours < 1) refuser(`tours invalide : ${seance.date} / ${bloc.type}`);
      if ('titre' in bloc && (typeof bloc.titre !== 'string' || bloc.titre === '')) {
        refuser(`titre de bloc vide : ${seance.date} / ${bloc.type}`);
      }
      if (!Array.isArray(bloc.exercices) || bloc.exercices.length === 0) {
        refuser(`bloc sans exercice : ${seance.date} / ${bloc.type}`);
      }

      for (const ex of bloc.exercices) {
        if (typeof ex.id !== 'string' || ex.id === '') refuser(`identifiant manquant : ${seance.date}`);
        if (identifiants.has(ex.id)) refuser(`identifiant en double : ${ex.id}`);
        identifiants.add(ex.id);
        if (typeof ex.libelle !== 'string' || ex.libelle === '') refuser(`libelle manquant : ${ex.id}`);
        if (ex.mesure === null || typeof ex.mesure !== 'object' || !UNITES.includes(ex.mesure.unite)) {
          refuser(`unite inconnue pour ${ex.id} : ${ex.mesure && ex.mesure.unite}`);
        }
        if (!Number.isFinite(ex.mesure.valeur) || ex.mesure.valeur < 0) refuser(`valeur invalide : ${ex.id}`);
      }
    }
  }

  return gelerEnProfondeur(json);
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 9`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : chargerProgramme refuse une saisie fausse"
git push
```

---

### Tâche 3 — les totaux accomplis

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

PRD §7.5 : le volume affiché sur l'écran perso est *« la somme de ce qui a été
coché, pas le total du programme »*. Cocher une ligne vaut déclaration du volume
complet, tours compris (PRD §9 : cocher les 15 pompes vaut déclaration de
15 pompes — et la ligne porte les deux tours).

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
test('les totaux accomplis ne comptent que les cases cochees, tours compris', () => {
  const faits = {
    's1-r1': '2026-08-03T18:22:11.000Z', // 15 pompes x 2 tours = 30
    's3-r1': '2026-08-07T10:04:00.000Z', // 12 pompes x 3 tours = 36
    's1-c2': '2026-08-03T18:30:00.000Z', // 6 x 100 m : unite `autre`, aucun volume
  };
  const t = domaine.totauxAccomplis(prog, faits);
  assert.equal(t.pompes, 66);
  assert.equal(t.squats, 0);
  assert.equal(t.min_course, 0);
  assert.equal(t.cases, 3, 'une case `autre` reste une case cochee');
});

test('aucun fait : tous les totaux accomplis sont a zero', () => {
  const t = domaine.totauxAccomplis(prog, {});
  for (const [unite, valeur] of Object.entries(t)) assert.equal(valeur, 0, unite);
});

test('tout coche : les accomplis rejoignent exactement les prescrits', () => {
  const faits = {};
  for (const seance of prog.seances) {
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) faits[ex.id] = '2026-08-21T12:00:00.000Z';
    }
  }
  assert.deepEqual(domaine.totauxAccomplis(prog, faits), domaine.totauxPrescrits(prog));
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 9` et `# fail 3`, chacun sur
`error: 'domaine.totauxAccomplis is not a function'` (`name: 'TypeError'`)

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/domaine.js`, sous `totauxPrescrits` :

```js
// Volume reellement accompli, d'apres les cases cochees. `faits` est l'objet
// { [idExercice]: horodatageISO } de l'ossature §6 : la presence de la cle vaut
// coche, sa valeur ne sert qu'a departager les egalites au classement.
export function totauxAccomplis(prog, faits = {}) {
  return cumuler(prog, (ex) => estFait(faits, ex.id));
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 12`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : les totaux accomplis, tours compris"
git push
```

---

### Tâche 4 — `etatSeance` : le passé se corrige, l'avenir ne se coche pas

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

PRD §9 : *« Sans cette règle, n'importe qui coche les sept séances le 3 août au
soir et le classement ne mesure plus rien. »* C'est la fonction que l'écran de
séance (PRP 04) interroge pour décider si un tap fait quelque chose.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
// Deux aides locales, utilisees aussi par les taches suivantes.
const casesDe = (date) =>
  prog.seances.find((s) => s.date === date).blocs.flatMap((b) => b.exercices).map((e) => e.id);
const cocher = (ids) => Object.fromEntries(ids.map((id) => [id, '2026-08-10T08:00:00.000Z']));

test('le passe se corrige, l avenir ne se coche pas (PRD §9)', () => {
  const le10 = '2026-08-10';
  assert.equal(domaine.etatSeance(prog, '2026-08-03', le10).cochable, true, 'seance passee');
  assert.equal(domaine.etatSeance(prog, le10, le10).cochable, true, 'seance du jour');
  assert.equal(domaine.etatSeance(prog, '2026-08-12', le10).cochable, false, 'seance a venir');
});

test('apres la fin du programme, plus rien n est cochable (PRD §9)', () => {
  assert.equal(domaine.etatSeance(prog, '2026-08-03', '2026-08-21').cochable, true, 'le 21 est encore dedans');
  assert.equal(domaine.etatSeance(prog, '2026-08-03', '2026-08-22').cochable, false, 'le 22, le bilan a pris la main');
});

test('les cinq statuts d une seance', () => {
  const le10 = '2026-08-10';
  assert.equal(domaine.etatSeance(prog, '2026-08-12', le10).statut, 'a-venir');
  assert.equal(domaine.etatSeance(prog, le10, le10).statut, 'aujourd-hui');
  assert.equal(domaine.etatSeance(prog, '2026-08-03', le10).statut, 'manquee');
  assert.equal(
    domaine.etatSeance(prog, '2026-08-03', le10, cocher(casesDe('2026-08-03').slice(0, 2))).statut,
    'partielle',
  );
  assert.equal(
    domaine.etatSeance(prog, '2026-08-03', le10, cocher(casesDe('2026-08-03'))).statut,
    'faite',
  );
  assert.equal(
    domaine.etatSeance(prog, le10, le10, cocher(casesDe(le10))).statut,
    'faite',
    'une seance terminee le jour meme est faite, pas en cours',
  );
});

test('etatSeance compte les cases de sa seance, pas celles du programme', () => {
  const e = domaine.etatSeance(prog, '2026-08-07', '2026-08-10', { 's3-r1': '2026-08-07T09:00:00.000Z' });
  assert.equal(e.total, 6);
  assert.equal(e.coches, 1);
});

test('un jour sans seance n a pas d etat de seance', () => {
  assert.equal(domaine.etatSeance(prog, '2026-08-04', '2026-08-10'), null);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 12` et `# fail 5`, chacun sur
`error: 'domaine.etatSeance is not a function'` (`name: 'TypeError'`)

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/domaine.js`, sous `totauxAccomplis` :

```js
// Etat d'une seance a une date donnee. Rend null si aucune seance n'a lieu ce
// jour-la : un jour de repos n'est pas une seance vide non faite.
export function etatSeance(prog, dateISO, aujourdhui, faits = {}) {
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (!seance) return null;

  let total = 0;
  let coches = 0;
  for (const bloc of seance.blocs) {
    for (const ex of bloc.exercices) {
      total += 1;
      if (estFait(faits, ex.id)) coches += 1;
    }
  }

  // Le passe se corrige, l'avenir ne se coche pas (PRD §9) ; et passe la fin du
  // programme plus rien ne bouge, le bilan remplace le cochage (PRD §9, §6 lot 3).
  const cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin;

  // L'ordre compte. Une seance terminee est 'faite' quelle que soit la date.
  // Le jour meme, une seance entamee n'est ni 'partielle' ni 'manquee' : elle
  // est en cours, et c'est 'aujourd-hui' qui porte cette nuance.
  let statut;
  if (total > 0 && coches === total) statut = 'faite';
  else if (dateISO > aujourdhui) statut = 'a-venir';
  else if (dateISO === aujourdhui) statut = 'aujourd-hui';
  else if (coches > 0) statut = 'partielle';
  else statut = 'manquee';

  return { statut, cochable, total, coches };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 17`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : le passe se corrige, l'avenir ne se coche pas"
git push
```

---

### Tâche 5 — `seanceDuJour` : ce qu'on voit en ouvrant l'app

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

PRD §6 (lot 1, point 2) : *« la séance prévue aujourd'hui, ou la prochaine, ou le
message de repos »*. Le troisième cas, `terminee`, existe parce qu'une app figée
sur un programme fini *« meurt en silence le 22 »* (PRD §9).

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
test('les trois cas de seanceDuJour', () => {
  const jour = domaine.seanceDuJour(prog, '2026-08-05');
  assert.equal(jour.cas, 'aujourd-hui');
  assert.equal(jour.seance.date, '2026-08-05');

  const repos = domaine.seanceDuJour(prog, '2026-08-06');
  assert.equal(repos.cas, 'repos');
  assert.equal(repos.seance.date, '2026-08-07', 'le repos annonce la prochaine seance');

  const fini = domaine.seanceDuJour(prog, '2026-08-22');
  assert.equal(fini.cas, 'terminee');
  assert.equal(fini.seance, null);
});

test('la bascule sur le bilan se fait le 22, pas le 21', () => {
  const le21 = domaine.seanceDuJour(prog, '2026-08-21');
  assert.equal(le21.cas, 'repos');
  assert.equal(le21.seance, null, 'plus aucune seance a annoncer apres le 17');
  assert.equal(domaine.seanceDuJour(prog, '2026-08-22').cas, 'terminee');
});

test('avant le debut du programme, on annonce la premiere seance', () => {
  const avant = domaine.seanceDuJour(prog, '2026-08-01');
  assert.equal(avant.cas, 'repos');
  assert.equal(avant.seance.date, '2026-08-03');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 17` et `# fail 3`, chacun sur
`error: 'domaine.seanceDuJour is not a function'` (`name: 'TypeError'`)

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/domaine.js`, sous `etatSeance` :

```js
// La seance a montrer en ouvrant l'app.
//   'aujourd-hui' : il y a seance aujourd'hui
//   'repos'       : pas de seance ce jour ; `seance` porte la prochaine, ou
//                   null s'il n'y en a plus d'ici la fin du programme
//   'terminee'    : le programme est fini, l'ecran de bilan prend la main
export function seanceDuJour(prog, aujourdhui) {
  if (aujourdhui > prog.fin) return { seance: null, cas: 'terminee' };

  const duJour = prog.seances.find((s) => s.date === aujourdhui);
  if (duJour) return { seance: duJour, cas: 'aujourd-hui' };

  // Les seances sont validees strictement croissantes : la premiere posterieure
  // est bien la prochaine.
  const prochaine = prog.seances.find((s) => s.date > aujourdhui) ?? null;
  return { seance: prochaine, cas: 'repos' };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 20`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : la seance du jour, le repos et la fin du programme"
git push
```

---

### Tâche 6 — `calendrier` : dix-neuf jours, jamais un trou

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

PRD §9 : *« Un calendrier majoritairement vide serait culpabilisant et faux. »*
Douze des dix-neuf jours sont du repos : ils portent `statut: 'repos'`, pas une
absence.

L'arithmétique de date se fait à la main sur l'année, le mois et le jour. Aucun
objet d'horodatage n'entre dans ce module : un décalage de fuseau y ferait sauter
ou répéter un jour du calendrier, et le test de pureté de la tâche 1 l'interdit.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
test('le calendrier couvre les dix-neuf jours sans trou (PRD §9)', () => {
  const jours = domaine.calendrier(prog, '2026-08-10');
  assert.equal(jours.length, 19);
  assert.equal(jours[0].date, '2026-08-03');
  assert.equal(jours.at(-1).date, '2026-08-21');
  assert.equal(jours.filter((j) => j.seance !== null).length, 7, 'sept seances');
  assert.equal(jours.filter((j) => j.statut === 'repos').length, 12, 'douze jours de repos');
  for (const j of jours) assert.ok(j.statut, `statut manquant le ${j.date}`);
});

test('le calendrier date chaque jour une fois et dans l ordre', () => {
  const dates = domaine.calendrier(prog, '2026-08-10').map((j) => j.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, dates.length);
});

test('le calendrier porte le statut de chaque seance', () => {
  const faits = cocher(casesDe('2026-08-03'));
  const parDate = new Map(domaine.calendrier(prog, '2026-08-10', faits).map((j) => [j.date, j.statut]));
  assert.equal(parDate.get('2026-08-03'), 'faite');
  assert.equal(parDate.get('2026-08-04'), 'repos');
  assert.equal(parDate.get('2026-08-05'), 'manquee');
  assert.equal(parDate.get('2026-08-10'), 'aujourd-hui');
  assert.equal(parDate.get('2026-08-12'), 'a-venir');
});

test('le calendrier franchit une fin de mois et un 29 fevrier', () => {
  // Le programme doit rester reutilisable la saison suivante (PRD §8) : rien
  // n'interdit qu'il chevauche un changement de mois ou une annee bissextile.
  const autreSaison = domaine.chargerProgramme({
    titre: 'Programme de test',
    debut: '2028-02-27',
    fin: '2028-03-01',
    seances: [{
      date: '2028-02-29',
      semaine: 1,
      titre: 'Test',
      blocs: [{
        type: 'course',
        tours: 1,
        exercices: [
          { id: 't-c1', libelle: '10 minutes de footing', mesure: { unite: 'min_course', valeur: 10 } },
        ],
      }],
    }],
  });
  assert.deepEqual(
    domaine.calendrier(autreSaison, '2028-02-28').map((j) => j.date),
    ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'],
  );
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 20` et `# fail 4`, chacun sur
`error: 'domaine.calendrier is not a function'` (`name: 'TypeError'`)

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/domaine.js` : les aides de calendrier juste
après `JOUR_ISO`, puis l'export sous `seanceDuJour`.

```js
const JOURS_PAR_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function bissextile(annee) {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

function joursDansLeMois(annee, mois) {
  return mois === 2 && bissextile(annee) ? 29 : JOURS_PAR_MOIS[mois - 1];
}

function iso(annee, mois, jour) {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

// Le jour calendaire suivant, en arithmetique pure sur l'annee, le mois et le
// jour — aucun objet d'horodatage, donc aucun fuseau a subir.
function jourSuivant(dateISO) {
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  if (jour < joursDansLeMois(annee, mois)) return iso(annee, mois, jour + 1);
  if (mois < 12) return iso(annee, mois + 1, 1);
  return iso(annee + 1, 1, 1);
}
```

```js
// Tous les jours du programme, de debut a fin inclus : une seance ou du repos,
// jamais un trou (PRD §9).
export function calendrier(prog, aujourdhui, faits = {}) {
  const parDate = new Map(prog.seances.map((s) => [s.date, s]));
  const jours = [];
  for (let date = prog.debut; date <= prog.fin; date = jourSuivant(date)) {
    const seance = parDate.get(date) ?? null;
    jours.push({
      date,
      seance,
      statut: seance ? etatSeance(prog, date, aujourdhui, faits).statut : 'repos',
    });
  }
  return jours;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 24`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : le calendrier des dix-neuf jours, sans trou"
git push
```

---

### Tâche 7 — `progression` : le dénominateur est honnête

**Fichiers :** Modifier `apps/marcq-handball/web/domaine.js` · Tester `apps/marcq-handball/tests/domaine.test.js`

PRD §9 : *« Le rang est établi sur la part d'exercices accomplis parmi ceux déjà
programmés à ce jour — pas sur le total du programme, sinon tout le monde est à
15 % le 5 août. »* C'est la valeur que le PRP 07 enverra au serveur et que le
serveur recalculera avec sa propre horloge.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/domaine.test.js` :

```js
test('le denominateur est ce qui est programme a ce jour (PRD §9)', () => {
  const p = domaine.progression(prog, '2026-08-05');
  assert.equal(p.programmees, 16, 'les seances du 3 et du 5, soit 8 + 8 cases');
  assert.equal(p.cochees, 0);
  assert.equal(p.part, 0);
});

test('la part est celle des cases cochees parmi les programmees', () => {
  const p = domaine.progression(prog, '2026-08-05', cocher(casesDe('2026-08-03')));
  assert.equal(p.cochees, 8);
  assert.equal(p.programmees, 16);
  assert.equal(p.part, 0.5);
});

test('avant la premiere seance, la part vaut 0 sans diviser par zero', () => {
  assert.deepEqual(domaine.progression(prog, '2026-08-02'), { cochees: 0, programmees: 0, part: 0 });
});

test('apres la fin, le denominateur est le programme entier', () => {
  assert.equal(domaine.progression(prog, '2026-08-22').programmees, 53);
});

test('une case cochee dans le futur ne fait pas depasser 100 %', () => {
  // Une horloge de telephone avancee puis remise a l'heure laisse des cases
  // cochees sur des seances a venir. La part doit rester dans [0,1].
  const p = domaine.progression(prog, '2026-08-03', { 's7-r1': '2026-08-03T20:00:00.000Z' });
  assert.equal(p.cochees, 0, 'la seance du 17 n est pas encore programmee');
  assert.equal(p.programmees, 8);
  assert.ok(p.part <= 1);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC, `# pass 24` et `# fail 5`, chacun sur
`error: 'domaine.progression is not a function'` (`name: 'TypeError'`)

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/domaine.js`, sous `calendrier` :

```js
// La part servant au rang : accompli sur programme A CE JOUR (PRD §9).
// Le numerateur est borne au meme perimetre que le denominateur, sinon une
// horloge de telephone avancee puis remise a l'heure produirait un depassement.
export function progression(prog, aujourdhui, faits = {}) {
  let programmees = 0;
  let cochees = 0;
  for (const seance of prog.seances) {
    if (seance.date > aujourdhui) continue;
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) {
        programmees += 1;
        if (estFait(faits, ex.id)) cochees += 1;
      }
    }
  }
  return { cochees, programmees, part: programmees === 0 ? 0 : cochees / programmees };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`  ·  Attendu : SUCCÈS,
`# pass 29`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/domaine.js apps/marcq-handball/tests/domaine.test.js
git commit -m "marcq-handball : la progression se mesure sur ce qui est programme a ce jour"
git push
```

---

### Tâche 8 — le programme reste éditable sans toucher au code

**Fichiers :** Modifier `apps/marcq-handball/.dockerignore` · Modifier `apps/marcq-handball/README.md`

PRD §8 : *« Le modifier ne doit pas demander de toucher au code ; il doit rester
réutilisable la saison suivante. »* Ce qui rend cela vrai n'est pas seulement le
code — c'est qu'un humain trouve les règles de saisie sans relire les tests. Et
le verrou §12.3 est encore ouvert : la page 3 sur 3 de la note du coach manque,
elle ajoutera peut-être des séances avant le 17 août.

- [ ] **Étape 1 — écrire le test qui échoue**

`tests/` et `package.json` n'ont rien à faire dans le contexte de construction :
`//go:embed web` ne les emporte pas, mais une édition de test invaliderait le
cache de couches. Le contrôle :

```bash
cd /home/user/hello-world && grep -qx 'tests' apps/marcq-handball/.dockerignore \
  && grep -qx 'package.json' apps/marcq-handball/.dockerignore \
  && echo OK || echo MANQUANT
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : la commande ci-dessus
Attendu : ÉCHEC avec `MANQUANT`

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter ces deux lignes à `apps/marcq-handball/.dockerignore`, sous la ligne
`test.sh` :

```
tests
package.json
```

Ajouter cette section à la fin de `apps/marcq-handball/README.md` :

````markdown
## Modifier le programme

Le programme vit dans `web/programme.json` et nulle part ailleurs. Le changer ne
demande de toucher à aucune ligne de code : les totaux affichés en sont
recalculés (`web/domaine.js`), et `tests/domaine.test.js` les vérifie.

Le format est fixé par `prp/00-ossature.md` §4. Trois règles suffisent à ne pas
se tromper :

- **Une ligne d'exercice est une case à cocher**, quel que soit le nombre de
  tours. `tours` multiplie le volume, jamais le nombre de cases.
- **`id` est stable et ne se réattribue jamais.** C'est la clé de la progression
  enregistrée sur le téléphone de chaque enfant : renuméroter un identifiant
  efface la progression de tout le monde. Un exercice retiré laisse son
  identifiant à la retraite.
- **`mesure.valeur` est le volume d'un seul tour**, et `mesure.unite` vaut
  `pompes`, `squats`, `burpees`, `abdos`, `gainage_s`, `min_course`, `fentes` ou
  `autre`. Un exercice sans volume calculable — une distance sans durée, une
  chaise contre un mur — porte `autre` et n'entre dans aucun total.

Pour les blocs de course, on retient la durée totale du bloc, récupérations
comprises, dès que le coach a écrit les durées ; `autre` dès qu'il n'a écrit
qu'une distance. On ne convertit jamais une distance en durée.

Après toute modification :

```bash
./test.sh
```

Les assertions de totaux échoueront tant que le fichier ne se recalcule pas sur
les valeurs attendues. Si le programme change vraiment de contenu, ce sont ces
valeurs attendues qu'il faut mettre à jour — dans le test, jamais dans le code.

### Reste à recevoir

La page 3 sur 3 de la note du coach manque (PRD §12.3). La capture reçue
s'arrête après le lundi 17 août ; les sept séances saisies ici couvrent tout ce
qui est connu. Si la troisième page ajoute des séances, elles s'ajoutent à
`web/programme.json` — dates, identifiants `s8-*` et suivants, volumes — et les
totaux attendus du test se recalculent. À lever **avant le 17 août**.
````

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer :

```bash
cd /home/user/hello-world && grep -qx 'tests' apps/marcq-handball/.dockerignore \
  && grep -qx 'package.json' apps/marcq-handball/.dockerignore \
  && echo OK || echo MANQUANT
./init.sh --check
./apps/marcq-handball/test.sh
```

Attendu : SUCCÈS — `OK`, `--check` vert, `# pass 29` et `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/.dockerignore apps/marcq-handball/README.md
git commit -m "marcq-handball : editer le programme sans toucher au code"
git push
```

---

## Points d'attention

**Le test de pureté cherche des sous-chaînes, pas des identifiants.** Il refuse
`document`, `window`, `localStorage`, `new Date`, `Date.now`, `fetch(` **où que
ce soit** dans `web/domaine.js` — commentaires compris. N'écris pas « aucun accès
au `localStorage` » dans un commentaire : le test ne fait pas la différence, et
le message d'échec (`domaine.js ne doit pas contenir localStorage`) ressemble à
un faux positif alors qu'il est exact. Les commentaires de ce PRP sont déjà
rédigés pour éviter ces mots.

**`cochable` est plus strict que la formule de l'ossature §5.** Elle écrit
`cochable = (dateISO <= aujourdhui)` ; ce PRP ajoute `&& aujourdhui <= prog.fin`
parce que le PRD §9 gèle tout après le 21 août, et que le PRD prime — l'en-tête
de l'ossature le prévoit explicitement. Sans ce second terme, l'écran de séance
resterait cochable indéfiniment derrière le bilan du PRP 11. **L'ossature §5 est
à corriger sur cette ligne** — c'est le seul écart de ce PRP avec elle.

**L'ossature §4 chiffre à « ~29 min » le total de gainage si la chaise contre un
mur y était comptée ; le calcul exact donne 1560 s, soit 26 min.** L'écart de
l'approximation ne change rien à ce qui lie : le total prescrit vaut 1425 s, et
c'est cette assertion-là qui échoue si la chaise est mal saisie.

**`assert.deepEqual` sur les totaux compare le jeu de clés, pas seulement les
valeurs.** Le test de répartition par séance échoue si `totauxVides()` gagne ou
perd une unité. Ajouter une unité au domaine impose donc de mettre à jour les
sept lignes de la table — c'est voulu : une unité ajoutée sans total est une
unité qui ne s'affichera nulle part.

**Les tests clonent `brut`, jamais `prog`.** `prog` est gelé en profondeur : le
muter lève une `TypeError`, les modules ES étant en mode strict. `brut` — la
valeur issue de `JSON.parse` — ne l'est pas, c'est donc lui qu'on clone pour
fabriquer un programme volontairement faux. Et le test du gel repart de
`chargerProgramme(structuredClone(brut))` plutôt que de `prog`, pour ne pas
laisser une mutation réussie contaminer les tests suivants.

**L'ordre d'évaluation des statuts n'est pas commutatif.** `'faite'` est testé en
premier : une séance terminée le jour même est `'faite'`, pas `'aujourd-hui'`.
Inverser les deux ferait que l'écran perso n'affiche jamais la séance du jour
comme faite, et l'enfant croirait sa validation perdue.

**`seanceDuJour` peut rendre `{ seance: null, cas: 'repos' }`.** C'est le cas du
18 au 21 août : le programme n'est pas fini, mais il n'y a plus de séance à
annoncer. Le PRP 03 doit gérer ce `null` — un écran du jour qui déréférence
`seance.titre` casse pendant les quatre derniers jours du programme, c'est-à-dire
au pire moment.

**`node --test` n'accepte pas un répertoire — vérifié sur Node 22.22.** `node
--test tests/` traite `tests` comme un *fichier* et échoue sur `Error: Cannot
find module .../tests`, ce qui ressemble à un test cassé alors que rien n'est
cassé. Il faut lui passer des fichiers : `node --test tests/*.test.js`, le glob
étant développé par le shell. C'est aussi la forme qui marche sur les Node 18 et
20, dont la version du runner de la CI n'est pas garantie.

**Le `package.json` doit rester à `apps/marcq-handball/`.** C'est le seul
emplacement qui soit un ancêtre commun de `web/` et de `tests/`, donc le seul qui
fasse lire les deux comme des modules ES. Posé dans `web/`, les tests
redeviennent du CommonJS et `import` casse.

**Le verrou PRD §12.3 n'arrête pas ce PRP, il le date.** Les sept séances
connues sont saisies et vérifiées ; si la page 3 en ajoute, trois choses bougent
et trois seulement : `web/programme.json`, les sept nombres du premier test, et
les lignes de la table de répartition du deuxième. Aucun code ne change — le
motif d'identifiant accepte déjà `s8-*`, et les séances ajoutées doivent
seulement être insérées **dans l'ordre des dates**, que `chargerProgramme`
vérifie. Le point est à lever avant le 17 août, faute de quoi la dernière semaine
du programme sera incomplète en ligne.
