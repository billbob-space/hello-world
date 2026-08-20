import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';
import { vueFin } from '../web/vue-fin.js';

const RECAP = {
	encouragement: 'Ça, c\'est fait. Bravo !',
	serie: { actuelle: 3, record: 9 },
	niveau_monte: { ventre: false, cuisses: false },
};

test('l\'ecran de fin offre une sortie — sinon une seance reussie finit en cul-de-sac', async () => {
	const app = installerDom();
	let retours = 0;
	vueFin(app, { recap: RECAP, onRetour: () => { retours += 1; } });
	const sortie = app.querySelector('button');
	assert.notEqual(sortie, null);
	assert.equal(sortie.textContent, 'Retour à l\'accueil');
	await sortie.cliquer();
	assert.equal(retours, 1);
});

test('sans onRetour, aucun bouton mort n\'est dessine', () => {
	const app = installerDom();
	vueFin(app, { recap: RECAP });
	assert.equal(app.querySelectorAll('button').length, 0);
});

test('l\'encouragement est un titre, pas un paragraphe anonyme', () => {
	const app = installerDom();
	vueFin(app, { recap: RECAP, onRetour: () => {} });
	const titre = app.querySelector('h1');
	assert.equal(titre.textContent, 'Ça, c\'est fait. Bravo !');
	assert.equal(titre.className, 'encouragement');
});

test('la sortie existe aussi quand la seance etait deja comptee', () => {
	const app = installerDom();
	vueFin(app, { recap: { deja_compte: true }, onRetour: () => {} });
	assert.match(app.textContent, /Bravo pour cette reprise/);
	assert.equal(app.querySelector('button').textContent, 'Retour à l\'accueil');
});

test('une serie remise a zero ne montre aucune penalite', () => {
	const app = installerDom();
	vueFin(app, { recap: { ...RECAP, serie: { actuelle: 1, record: 9 } }, onRetour: () => {} });
	assert.match(app.textContent, /Série : 1 jour — record 9/);
	assert.doesNotMatch(app.textContent, /perdu|casse|manqu|rat/i);
});

test('le mot doux et la sortie coexistent, dans cet ordre', () => {
	const app = installerDom();
	vueFin(app, { recap: { ...RECAP, mot_doux: 'Tu es belle, tiens.' }, onRetour: () => {} });
	const carte = app.querySelector('.carte');
	const derniers = carte.enfants.slice(-2);
	assert.equal(derniers[0].className, 'mot-doux');
	assert.equal(derniers[1].tagName, 'BUTTON');
});
