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
