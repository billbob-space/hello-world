// tests/records.test.js — A16 (« Ajouté après les PRP », lot ludique) : les
// trois records, purs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECORDS_VIDES, fusionnerRecords, plusExercicesUnJour, recordsDepuisFaits,
} from '../web/records.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');

test('RECORDS_VIDES porte les trois champs, tous à zéro', () => {
  assert.deepEqual(RECORDS_VIDES, { plusLongueTenue: 0, plusExercicesJour: 0, totalExercices: 0 });
});

// --- fusionnerRecords : ne peut que monter -----------------------------------

test('fusionnerRecords rend le plus grand, champ par champ', () => {
  const a = { plusLongueTenue: 30, plusExercicesJour: 5, totalExercices: 10 };
  const b = { plusLongueTenue: 10, plusExercicesJour: 8, totalExercices: 3 };
  assert.deepEqual(fusionnerRecords(a, b), { plusLongueTenue: 30, plusExercicesJour: 8, totalExercices: 10 });
});

test('fusionnerRecords est commutative : l’ordre des deux côtés ne change rien', () => {
  const a = { plusLongueTenue: 30, plusExercicesJour: 5, totalExercices: 10 };
  const b = { plusLongueTenue: 10, plusExercicesJour: 8, totalExercices: 3 };
  assert.deepEqual(fusionnerRecords(a, b), fusionnerRecords(b, a));
});

test('fusionnerRecords tolère un côté absent ou partiel, sans jamais lever', () => {
  assert.deepEqual(fusionnerRecords(undefined, { plusLongueTenue: 5 }), { plusLongueTenue: 5, plusExercicesJour: 0, totalExercices: 0 });
  assert.deepEqual(fusionnerRecords(null, null), RECORDS_VIDES);
  assert.deepEqual(fusionnerRecords({}, {}), RECORDS_VIDES);
});

test('fusionnerRecords ignore un nombre négatif ou invalide, comme un zéro', () => {
  const a = { plusLongueTenue: -5, plusExercicesJour: Number.NaN, totalExercices: 4 };
  assert.deepEqual(fusionnerRecords(a, RECORDS_VIDES), { plusLongueTenue: 0, plusExercicesJour: 0, totalExercices: 4 });
});

test('un record déjà acquis ne redescend jamais, même fusionné avec un instantané plus petit', () => {
  const acquis = { plusLongueTenue: 60, plusExercicesJour: 12, totalExercices: 40 };
  const instantanePlusPetit = { plusLongueTenue: 30, plusExercicesJour: 3, totalExercices: 20 };
  assert.deepEqual(fusionnerRecords(acquis, instantanePlusPetit), acquis);
});

// --- plusExercicesUnJour ------------------------------------------------------

test('plusExercicesUnJour rend zéro sans aucun fait', () => {
  assert.equal(plusExercicesUnJour([]), 0);
});

test('plusExercicesUnJour groupe par jour calendaire, rend le plus grand groupe', () => {
  const faits = [
    { a: '2026-08-03T09:00:00.000Z' },
    { a: '2026-08-03T10:00:00.000Z' },
    { a: '2026-08-03T18:00:00.000Z' },
    { a: '2026-08-04T09:00:00.000Z' },
  ];
  assert.equal(plusExercicesUnJour(faits), 3, 'le 3 août porte trois exercices, le 4 en porte un seul');
});

// --- recordsDepuisFaits : un instantané, pas un cumul à vie ------------------

test('recordsDepuisFaits dérive totalExercices et plusExercicesJour des faits ACTUELS, jamais plusLongueTenue', () => {
  const faits = [
    { a: '2026-08-03T09:00:00.000Z' },
    { a: '2026-08-03T10:00:00.000Z' },
    { a: '2026-08-04T09:00:00.000Z' },
  ];
  assert.deepEqual(recordsDepuisFaits(faits), { plusLongueTenue: 0, plusExercicesJour: 2, totalExercices: 3 });
});

test('un exercice retiré (correction depuis la grille) fait redescendre l’INSTANTANÉ, mais fusionnerRecords protège le record déjà acquis', () => {
  const avant = recordsDepuisFaits([{ a: '2026-08-03T09:00:00.000Z' }, { a: '2026-08-03T10:00:00.000Z' }]);
  const stocke = fusionnerRecords(RECORDS_VIDES, avant);
  assert.equal(stocke.totalExercices, 2);

  // Un exercice retiré : l'instantané redescend à 1...
  const apres = recordsDepuisFaits([{ a: '2026-08-03T09:00:00.000Z' }]);
  assert.equal(apres.totalExercices, 1);
  // ...mais le record STOCKÉ, fusionné avec ce nouvel instantané, ne redescend jamais.
  assert.equal(fusionnerRecords(stocke, apres).totalExercices, 2);
});

// --- purete du module (ossature §6) -----------------------------------------

test('records.js reste pur : ni DOM, ni stockage, ni reseau, ni horloge', () => {
  const source = readFileSync(join(web, 'records.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const mot of ['document', 'window', 'localStorage', 'Date.now', 'new Date', 'fetch(']) {
    assert.equal(source.includes(mot), false, `records.js contient « ${mot} »`);
  }
});
