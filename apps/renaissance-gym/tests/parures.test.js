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

function etatDe(faits, parures = [], semaineDeDepart) {
  return semaineDeDepart === undefined
    ? { faits, parures }
    : { faits, parures, semaineDeDepart };
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

// --- A20 : la répartition suit les semaines réellement devant elle ----------

test('huit semaines devant elle (semaine de départ 1) : un élément par semaine, comme avant A20', () => {
  for (let n = 1; n <= 8; n += 1) {
    const faits = Array.from({ length: n }, (_, i) => faitsSemaineComplete(i + 1)).flat();
    const acquises = paruresAcquises(prog, etatDe(faits, [], 1));
    assert.equal(acquises.length, n);
    assert.deepEqual(acquises, PARURES.slice(0, n).map((p) => p.id));
  }
});

test('trois semaines devant elle (semaine de départ 6) : les huit parures se répartissent en trois étapes, 3 puis 3 puis 2', () => {
  const etat1 = etatDe(faitsSemaineComplete(6), [], 6);
  assert.equal(paruresAcquises(prog, etat1).length, 3, 'première semaine bouclée : trois parures');

  const etat2 = etatDe([...faitsSemaineComplete(6), ...faitsSemaineComplete(7)], [], 6);
  assert.equal(paruresAcquises(prog, etat2).length, 6, 'deux semaines bouclées : six parures');

  const etat3 = etatDe(
    [...faitsSemaineComplete(6), ...faitsSemaineComplete(7), ...faitsSemaineComplete(8)],
    [],
    6,
  );
  assert.equal(paruresAcquises(prog, etat3).length, 8, 'trois semaines bouclées (toutes) : le justaucorps est complet');
});

test('une seule semaine devant elle (semaine de départ 8) : la boucler complète le justaucorps d’un coup', () => {
  const sansRien = etatDe([], [], 8);
  assert.deepEqual(paruresAcquises(prog, sansRien), [], 'rien avant de boucler sa seule semaine');

  const bouclee = etatDe(faitsSemaineComplete(8), [], 8);
  assert.equal(paruresAcquises(prog, bouclee).length, 8, 'la dernière (et unique) semaine bouclée achève toujours le justaucorps');
});

test('A20 : une parure déjà acquise le reste, même si un changement de semaine de départ ferait recalculer moins en direct', () => {
  // Elle démarre en semaine 6 (trois semaines devant elle) et boucle les deux
  // premières : le §A20 répartit 8 en trois étapes (3, 3, 2), donc six
  // parures — persistées, comme le ferait vue-justaucorps.js.
  const faitsDeuxSemaines = [6, 7].flatMap((s) => faitsSemaineComplete(s));
  const acquisesInitiales = paruresAcquises(prog, etatDe(faitsDeuxSemaines, [], 6));
  assert.equal(acquisesInitiales.length, 6);
  const avant = etatDe(faitsDeuxSemaines, acquisesInitiales, 6);

  // Elle revient ensuite sur sa semaine de départ (A10, réglages) et la
  // remet à 1, sans que ses faits ne bougent : recalculé EN DIRECT avec huit
  // semaines devant elle, ces deux mêmes semaines bouclées ne valent plus que
  // deux parures — MOINS que les six déjà acquises. `nouvellesParures`
  // n'enlève jamais rien : le merge (comme dans vue-justaucorps.js) doit
  // conserver l'intégralité des six.
  const apres = etatDe(faitsDeuxSemaines, acquisesInitiales, 1);
  assert.equal(paruresAcquises(prog, apres).length, 2, 'le calcul en direct, seul, en vaudrait moins');
  const nouvelles = nouvellesParures(prog, avant, apres);
  assert.deepEqual(nouvelles, [], 'aucune parure ne se retire jamais');
  const conservees = new Set([...(avant.parures ?? []), ...nouvelles]);
  assert.equal(conservees.size, 6, 'elle garde les six qu’elle avait déjà, elle n’en perd aucune');
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
