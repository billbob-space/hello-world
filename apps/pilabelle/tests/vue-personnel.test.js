import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoupeEnSemaines } from '../web/vue-personnel.js';

function joursDe(n) {
	return Array.from({ length: n }, (_, i) => ({ date: `jour-${i}`, statut: 'repos' }));
}

test('calendrier vide -> aucune semaine', () => {
	assert.deepEqual(decoupeEnSemaines([]), []);
});

test('calendrier plus court qu\'une semaine -> une seule ligne incomplete', () => {
	const semaines = decoupeEnSemaines(joursDe(3));
	assert.equal(semaines.length, 1);
	assert.equal(semaines[0].length, 3);
});

test('calendrier de plusieurs semaines pleines -> une ligne de 7 par semaine, dans l\'ordre', () => {
	const semaines = decoupeEnSemaines(joursDe(14));
	assert.equal(semaines.length, 2);
	assert.equal(semaines[0].length, 7);
	assert.equal(semaines[1].length, 7);
	assert.equal(semaines[0][0].date, 'jour-0');
	assert.equal(semaines[1][6].date, 'jour-13');
});

test('derniere semaine incomplete -> ligne courte a la fin, jamais une ligne vide', () => {
	const semaines = decoupeEnSemaines(joursDe(10));
	assert.equal(semaines.length, 2);
	assert.equal(semaines[0].length, 7);
	assert.equal(semaines[1].length, 3);
});
