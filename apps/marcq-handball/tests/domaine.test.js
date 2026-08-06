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
