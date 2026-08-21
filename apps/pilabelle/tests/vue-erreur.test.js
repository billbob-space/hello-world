import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';
import { vueErreur } from '../web/vue-erreur.js';

test('sans textes fournis, l\'ecran dit quand meme quoi faire', () => {
	const app = installerDom();
	vueErreur(app, { onReessayer: () => {} });
	const titre = app.querySelector('h1');
	assert.equal(titre.textContent, 'Ça ne répond pas');
	assert.match(app.textContent, /Vérifie ta connexion/);
	assert.equal(app.querySelector('button').textContent, 'Réessayer');
});

test('le message n\'est jamais un cul-de-sac : toujours un bouton', () => {
	const app = installerDom();
	vueErreur(app, { onReessayer: () => {} });
	assert.equal(app.querySelectorAll('button').length, 1);
});

test('les textes du cas « seance faite » remplacent les textes par defaut', () => {
	const app = installerDom();
	vueErreur(app, {
		titre: 'Ta séance est bien faite',
		texte: "Elle n'a pas pu être enregistrée.",
		libelleReessai: 'Enregistrer ma séance',
		onReessayer: () => {},
	});
	assert.equal(app.querySelector('h1').textContent, 'Ta séance est bien faite');
	assert.equal(app.querySelector('button').textContent, 'Enregistrer ma séance');
	assert.doesNotMatch(app.textContent, /Ça ne répond pas/);
});

test('le bouton rejoue l\'action', async () => {
	const app = installerDom();
	let rejeux = 0;
	vueErreur(app, { onReessayer: () => { rejeux += 1; } });
	await app.querySelector('button').cliquer();
	assert.equal(rejeux, 1);
});

test('pendant la tentative, le bouton se verrouille et le dit', async () => {
	const app = installerDom();
	vueErreur(app, { onReessayer: () => {} });
	const bouton = app.querySelector('button');
	await bouton.cliquer();
	assert.equal(bouton.disabled, true);
	assert.equal(bouton.textContent, 'Un instant…');
});

test('taper deux fois n\'envoie qu\'une tentative', async () => {
	const app = installerDom();
	let rejeux = 0;
	vueErreur(app, { onReessayer: () => { rejeux += 1; } });
	const bouton = app.querySelector('button');
	await bouton.cliquer();
	await bouton.cliquer();
	await bouton.cliquer();
	assert.equal(rejeux, 1);
});

test('un montage remplace le precedent : jamais deux ecrans de panne empiles', () => {
	const app = installerDom();
	vueErreur(app, { onReessayer: () => {} });
	vueErreur(app, { titre: 'Deuxième panne', onReessayer: () => {} });
	assert.equal(app.querySelectorAll('h1').length, 1);
	assert.equal(app.querySelector('h1').textContent, 'Deuxième panne');
});
