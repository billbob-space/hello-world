import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMinuteur } from '../web/minuteur.js';

test('ne demarre jamais seul', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	let appels = 0;
	m.abonner(() => { appels += 1; });
	assert.equal(appels, 0);
	assert.equal(m.etat(), 'attente');
});

test('pause sans avoir demarre ne fait rien', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	m.pause();
	assert.equal(m.etat(), 'attente');
});

test('reprendre sans etre en pause ne fait rien', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	m.demarrer();
	m.reprendre(); // deja en_cours, pas en pause
	assert.equal(m.etat(), 'en_cours');
	m.pause();
});

test('demarrer passe en effort', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	let dernier = null;
	m.abonner((etat) => { dernier = etat; });
	m.demarrer();
	assert.equal(dernier.phase, 'effort');
	assert.equal(dernier.restant, 20);
	m.pause();
});

test('pause puis reprise conserve le temps restant et la phase', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	m.demarrer();
	m.pause();
	assert.equal(m.etat(), 'pause');
	let dernier = null;
	m.abonner((etat) => { dernier = etat; });
	m.reprendre();
	assert.equal(m.etat(), 'en_cours');
	assert.equal(dernier.phase, 'effort');
	assert.equal(dernier.restant, 20);
	m.pause();
});

test('un seul tour termine apres la phase de repos', async () => {
	const m = creerMinuteur({ effort_s: 0, repos_s: 0, tours: 1 });
	await new Promise((resolve) => {
		m.abonner((etat) => { if (etat.etat === 'termine') resolve(); });
		m.demarrer();
	});
	assert.equal(m.estTermine(), true);
});
