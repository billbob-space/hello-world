import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avecPanne } from '../web/reessai.js';

test('action qui reussit -> aucun ecran de panne', async () => {
	let echecs = 0;
	const action = avecPanne(async () => {}, () => { echecs += 1; });
	await action();
	assert.equal(echecs, 0);
});

test('action qui echoue -> l\'echec est signale, jamais propage', async () => {
	let signale = null;
	const action = avecPanne(async () => { throw new Error('reseau'); }, (rejouer) => { signale = rejouer; });
	await action(); // ne doit pas lever : sinon on retombe sur l'ecran fige
	assert.equal(typeof signale, 'function');
});

test('le rejeu repasse les MEMES arguments', async () => {
	const recus = [];
	let rejouer = null;
	const action = avecPanne(
		async (ressenti) => { recus.push(ressenti); throw new Error('reseau'); },
		(r) => { rejouer = r; },
	);
	await action('difficile');
	await rejouer();
	assert.deepEqual(recus, ['difficile', 'difficile']);
});

test('un second echec re-arme le rejeu — une panne dure rarement une requete', async () => {
	let rejouer = null;
	let armements = 0;
	const action = avecPanne(
		async () => { throw new Error('reseau'); },
		(r) => { armements += 1; rejouer = r; },
	);
	await action();
	await rejouer();
	await rejouer();
	assert.equal(armements, 3);
});

test('le rejeu qui reussit ne re-arme rien', async () => {
	let tentatives = 0;
	let rejouer = null;
	let armements = 0;
	const action = avecPanne(
		async () => { tentatives += 1; if (tentatives === 1) throw new Error('reseau'); },
		(r) => { armements += 1; rejouer = r; },
	);
	await action();
	await rejouer();
	assert.equal(tentatives, 2);
	assert.equal(armements, 1);
});

test('les textes fournis suivent le rejeu, pour que le message reste le bon', async () => {
	const vus = [];
	let rejouer = null;
	const textes = { titre: 'Ta séance est bien faite' };
	const action = avecPanne(async () => { throw new Error('reseau'); }, (r, t) => { vus.push(t); rejouer = r; }, textes);
	await action();
	await rejouer();
	assert.deepEqual(vus, [textes, textes]);
});
