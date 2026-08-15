// tests/bilan.test.js — A17 (« Ajouté après les PRP », lot ludique) :
// l'instantané du programme terminé (`bilan.js`), et l'écran qui le montre
// (`vue-bilan.js`).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerProgramme } from '../web/programme.js';
import { construireBilan, phraseBilan } from '../web/bilan.js';
import { monterBilan } from '../web/vue-bilan.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));

beforeEach(() => {
  poserDocumentFactice();
});

function faitsDeSeance(numero, semaine) {
  const s = prog.seances.find((x) => x.id === `s${numero}`);
  return s.exercices.map((id) => ({
    seance: numero, semaine, exercice: id, a: '2026-08-03T09:00:00.000Z',
  }));
}

// --- construireBilan, pur -----------------------------------------------------

test('construireBilan compte les séances faites et reprend records.totalExercices, jamais un recalcul de faits.length', () => {
  const faits = [1, 2].flatMap((n) => faitsDeSeance(n, 1));
  const etat = { faits, records: { plusLongueTenue: 45, plusExercicesJour: 6, totalExercices: 40 } };
  const bilan = construireBilan(prog, etat, () => new Date('2026-08-14T09:00:00.000Z'));

  assert.equal(bilan.seancesFaites, 2);
  // 40, pas faits.length (bien plus petit) : le record ne redescend jamais,
  // même si la grille actuelle en montre moins (correction, recommencement).
  assert.equal(bilan.exercicesFaits, 40);
  assert.deepEqual(bilan.records, { plusLongueTenue: 45, plusExercicesJour: 6, totalExercices: 40 });
  assert.equal(bilan.dateISO, '2026-08-14T09:00:00.000Z');
});

test('construireBilan ne lève jamais sans records', () => {
  const bilan = construireBilan(prog, { faits: [] }, () => new Date('2026-08-14T09:00:00.000Z'));
  assert.equal(bilan.exercicesFaits, 0);
});

// --- phraseBilan : sans emphase, sans comparaison ----------------------------

test('phraseBilan nomme le nombre de séances et d’exercices, en toutes lettres', () => {
  const bilan = { seancesFaites: 32, exercicesFaits: 288 };
  assert.equal(phraseBilan(bilan), 'Cet été, tu as fait 32 séances et 288 exercices.');
});

test('phraseBilan accorde le singulier', () => {
  const bilan = { seancesFaites: 1, exercicesFaits: 1 };
  assert.equal(phraseBilan(bilan), 'Cet été, tu as fait 1 séance et 1 exercice.');
});

test('phraseBilan ne compare jamais et ne juge jamais', () => {
  const bilan = { seancesFaites: 10, exercicesFaits: 90 };
  const phrase = phraseBilan(bilan);
  for (const mot of ['mieux', 'meilleur', 'moins bien', 'que la', 'classement', 'record du monde']) {
    assert.doesNotMatch(phrase.toLowerCase(), new RegExp(mot));
  }
});

// --- monterBilan : le DOM ------------------------------------------------------

test('sans bilan (programme pas encore terminé), l’écran le dit sans rien promettre', () => {
  const hote = creerHote();
  monterBilan(hote, { etat: { faits: [], bilan: null }, programme: prog });
  const texte = hote.querySelectorAll('p').map((p) => p.textContent).join(' ');
  assert.match(texte, /apparaîtra ici/);
  assert.equal(hote.querySelectorAll('.bilan__phrase').length, 0);
});

test('avec un bilan, l’écran montre la phrase et le justaucorps, sans bouton de partage', () => {
  const hote = creerHote();
  const bilan = {
    seancesFaites: 32,
    exercicesFaits: 288,
    records: { plusLongueTenue: 60, plusExercicesJour: 11, totalExercices: 288 },
    dateISO: '2026-10-01T09:00:00.000Z',
  };
  monterBilan(hote, { etat: { faits: [], parures: [], bilan }, programme: prog });

  const phrase = hote.querySelector('.bilan__phrase');
  assert.ok(phrase, 'la phrase du bilan doit apparaître');
  assert.equal(phrase.textContent, phraseBilan(bilan));

  const figure = hote.querySelector('.justaucorps__figure');
  assert.ok(figure, 'le justaucorps doit être dessiné');

  // PRD, lot ludique A17 : « Aucun bouton de partage, aucun envoi. »
  const tousLesBoutons = [...hote.querySelectorAll('.bouton'), ...hote.querySelectorAll('.bouton--discret')];
  for (const bouton of tousLesBoutons) {
    assert.doesNotMatch(bouton.textContent.toLowerCase(), /partag|envoyer|envoi/);
  }
});

test('les records à zéro ne s’affichent pas — rien à célébrer, mais pas une faute non plus', () => {
  const hote = creerHote();
  const bilan = {
    seancesFaites: 32,
    exercicesFaits: 288,
    records: { plusLongueTenue: 0, plusExercicesJour: 0, totalExercices: 288 },
    dateISO: '2026-10-01T09:00:00.000Z',
  };
  monterBilan(hote, { etat: { faits: [], parures: [], bilan }, programme: prog });
  assert.equal(hote.querySelectorAll('.bilan__record').length, 0);
});

test('les records non nuls s’affichent en toutes lettres', () => {
  const hote = creerHote();
  const bilan = {
    seancesFaites: 32,
    exercicesFaits: 288,
    records: { plusLongueTenue: 60, plusExercicesJour: 11, totalExercices: 288 },
    dateISO: '2026-10-01T09:00:00.000Z',
  };
  monterBilan(hote, { etat: { faits: [], parures: [], bilan }, programme: prog });
  const lignes = hote.querySelectorAll('.bilan__record').map((p) => p.textContent);
  assert.equal(lignes.length, 2);
  assert.ok(lignes.some((l) => l.includes('60')));
  assert.ok(lignes.some((l) => l.includes('11')));
});

test('le justaucorps du bilan lit les parures PERSISTÉES, pas un recalcul depuis les faits courants', () => {
  const hote = creerHote();
  const bilan = {
    seancesFaites: 32, exercicesFaits: 288, records: { plusLongueTenue: 60, plusExercicesJour: 11, totalExercices: 288 }, dateISO: '2026-10-01T09:00:00.000Z',
  };
  // Un nouveau programme a redémarré depuis (faits vidés), mais le
  // justaucorps du bilan reste entièrement paré (PRD, lot ludique A17).
  const toutesLesParures = ['parure-1', 'parure-2', 'parure-3', 'parure-4', 'parure-5', 'parure-6', 'parure-7', 'parure-8'];
  monterBilan(hote, { etat: { faits: [], parures: toutesLesParures, bilan }, programme: prog });

  const svg = hote.querySelector('.justaucorps__figure').innerHTML;
  const occurrences = svg.match(/justaucorps__parure--/g) ?? [];
  assert.equal(occurrences.length, 8, 'le justaucorps doit rester entièrement paré');
});

test('un lien ramène à l’écran du jour', () => {
  const hote = creerHote();
  monterBilan(hote, { etat: { faits: [], bilan: null }, programme: prog });
  const lien = hote.querySelectorAll('a').find((a) => a.href === '#/jour');
  assert.ok(lien);
});
