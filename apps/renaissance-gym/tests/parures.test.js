// tests/parures.test.js — A13 (« Ajouté après les PRP », lot ludique) : les
// huit parures du justaucorps, pures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerProgramme } from '../web/programme.js';
import { PARURES, paruresAcquises, nouvellesParures } from '../web/parures.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));

function faitsDeSeance(numero, semaine, dateISO = '2026-08-03T09:00:00.000Z') {
  const s = prog.seances.find((x) => x.id === `s${numero}`);
  return s.exercices.map((id) => ({
    seance: numero, semaine, exercice: id, a: dateISO,
  }));
}

function faitsSemaineComplete(semaine) {
  return [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, semaine));
}

function etatDe(faits, parures = []) {
  return { faits, parures };
}

test('PARURES porte exactement huit parures, chacune avec un id, un nom, une partie, une phrase et une condition', () => {
  assert.equal(PARURES.length, 8);
  const ids = new Set();
  const parties = new Set();
  for (const p of PARURES) {
    assert.equal(typeof p.id, 'string');
    assert.ok(p.id.length > 0);
    assert.equal(ids.has(p.id), false, `id en double : ${p.id}`);
    ids.add(p.id);
    assert.equal(typeof p.partie, 'string');
    assert.ok(p.partie.length > 0);
    assert.equal(parties.has(p.partie), false, `partie du dessin en double : ${p.partie}`);
    parties.add(p.partie);
    assert.equal(typeof p.nom, 'string');
    assert.ok(p.nom.length > 0);
    assert.equal(typeof p.phrase, 'string');
    assert.ok(p.phrase.length > 0);
    assert.equal(typeof p.condition, 'function');
  }
});

// --- paruresAcquises : pur, sans effet de bord -------------------------------

test('paruresAcquises rend un tableau vide sans aucune semaine bouclée', () => {
  assert.deepEqual(paruresAcquises(prog, etatDe([])), []);
});

test('une parure de plus à chaque semaine entièrement bouclée, dans l’ordre', () => {
  for (let n = 1; n <= 8; n += 1) {
    const faits = Array.from({ length: n }, (_, i) => faitsSemaineComplete(i + 1)).flat();
    const acquises = paruresAcquises(prog, etatDe(faits));
    assert.equal(acquises.length, n, `${n} semaine(s) bouclée(s) devrait donner ${n} parure(s)`);
    assert.deepEqual(acquises, PARURES.slice(0, n).map((p) => p.id));
  }
});

test('trois séances sur quatre ne suffisent pas à gagner la première parure', () => {
  const faits = [1, 2, 3].flatMap((n) => faitsDeSeance(n, 1));
  assert.deepEqual(paruresAcquises(prog, etatDe(faits)), []);
});

test('le nombre de semaines bouclées compte, pas LESQUELLES : semaines 5 à 8 bouclées donnent quatre parures', () => {
  const faits = [5, 6, 7, 8].flatMap((semaine) => faitsSemaineComplete(semaine));
  assert.equal(paruresAcquises(prog, etatDe(faits)).length, 4);
});

// --- nouvellesParures : ce qu'il faut annoncer, jamais ce qu'il faut retirer -

test('nouvellesParures rend les parures tout juste gagnées, absentes de avant.parures', () => {
  const avant = etatDe([]);
  const apres = etatDe(faitsSemaineComplete(1));
  assert.deepEqual(nouvellesParures(prog, avant, apres), ['parure-1']);
});

test('une parure décochée puis recochée ne se re-annonce pas si elle est déjà acquise (elle ne se déboucle jamais)', () => {
  const complet = faitsSemaineComplete(1);
  const dejaGagnee = etatDe(complet, ['parure-1']);
  // Une correction depuis la grille fait disparaître les faits — la parure
  // reste, conforme au PRD : « une semaine bouclée ne se débloque pas ».
  const decochee = etatDe([], ['parure-1']);
  assert.deepEqual(nouvellesParures(prog, dejaGagnee, decochee), []);
  const recochee = etatDe(complet, ['parure-1']);
  assert.deepEqual(nouvellesParures(prog, decochee, recochee), []);
});

test('un programme qui recommence à zéro (faits vidés) ne perd aucune parure déjà acquise', () => {
  const huitSemaines = Array.from({ length: 8 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  const toutesAcquises = paruresAcquises(prog, etatDe(huitSemaines));
  assert.equal(toutesAcquises.length, 8);

  // « Recommencer à zéro » (vue-grille.js) vide les faits, mais ne touche
  // jamais `etat.parures` — c'est ce que ce test vérifie côté domaine.
  const apresRecommencement = etatDe([], toutesAcquises);
  assert.deepEqual(nouvellesParures(prog, apresRecommencement, apresRecommencement), []);
  assert.deepEqual(paruresAcquises(prog, apresRecommencement).length, 0, 'plus aucune semaine bouclée dans le nouveau cycle');
});

test('nouvellesParures peut rendre plusieurs ids à la fois', () => {
  const avant = etatDe([]);
  const troisSemaines = [1, 2, 3].flatMap((s) => faitsSemaineComplete(s));
  const apres = etatDe(troisSemaines);
  assert.deepEqual(nouvellesParures(prog, avant, apres), ['parure-1', 'parure-2', 'parure-3']);
});

// --- purete du module (ossature §6) -----------------------------------------

test('parures.js reste pur : ni DOM, ni stockage, ni reseau, ni horloge', () => {
  const source = readFileSync(join(web, 'parures.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const mot of ['document', 'window', 'localStorage', 'Date.now', 'new Date', 'fetch(']) {
    assert.equal(source.includes(mot), false, `parures.js contient « ${mot} »`);
  }
});
