import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';

// La bascule vers l'ecran de panne, montee de bout en bout : app.js se lance
// lui-meme a l'import, on lui donne donc un DOM et un serveur avant de le
// charger. Chaque test importe le module sous une URL differente pour repartir
// d'une application neuve — sinon le cache ESM rejouerait le premier demarrage.

const PROFIL = {
	reponses: { niveau_depart: 'debutante', douleurs: [], jours_actifs: ['lundi'] },
	notifications: { proposee_initiale: false },
};

const JOUR = {
	cas: 'a-faire',
	seance: {
		blocs: [{
			zone: 'ventre',
			exercices: [{
				id: 'ex-1', nom: 'Bascule du bassin', consigne: 'Doucement.',
				video: { url: '' }, minutage: { effort_s: 3, repos_s: 2, tours: 1 },
			}],
		}],
	},
};

const RECAP = { encouragement: 'Ça, c\'est fait. Bravo !', serie: { actuelle: 1, record: 1 } };

// serveurFactice imite les seules routes que le navigateur appelle. `panne`
// est un jeu de chemins qui echouent : c'est le levier des tests.
function serveurFactice(etat) {
	return async (chemin, options = {}) => {
		const methode = options.method || 'GET';
		if (etat.panne.has(`${methode} ${chemin}`) || etat.panne.has('*')) throw new TypeError('failed to fetch');
		if (chemin === '/api/profil' && methode === 'GET') {
			return etat.profil
				? { ok: true, status: 200, json: async () => etat.profil }
				: { ok: false, status: 404, json: async () => ({}) };
		}
		if (chemin === '/api/profil' && methode === 'POST') {
			etat.profil = PROFIL;
			return { ok: true, status: 200, json: async () => etat.profil };
		}
		if (chemin === '/api/notifications/proposee-initiale') {
			etat.profil = { ...etat.profil, notifications: { proposee_initiale: true } };
			return { ok: true, status: 204, json: async () => ({}) };
		}
		if (chemin === '/api/jour') return { ok: true, status: 200, json: async () => JOUR };
		if (chemin === '/api/ressenti') {
			etat.ressentisRecus.push(JSON.parse(options.body).ressenti);
			return { ok: true, status: 200, json: async () => RECAP };
		}
		throw new Error(`route non prevue : ${methode} ${chemin}`);
	};
}

const respirer = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const parTexte = (app, texte) => app.querySelectorAll('button').find((b) => b.textContent.includes(texte));

let compteur = 0;
async function demarrer(etat) {
	const app = installerDom();
	globalThis.fetch = serveurFactice(etat);
	await import(`../web/app.js?v=${compteur += 1}`);
	await respirer();
	return app;
}

test('coupure au demarrage : un message et un geste, jamais « Chargement… » a perpetuite', async () => {
	const etat = { profil: null, panne: new Set(['*']), ressentisRecus: [] };
	const app = await demarrer(etat);

	assert.equal(app.querySelector('h1').textContent, 'Ça ne répond pas');
	assert.match(app.textContent, /Vérifie ta connexion/);

	etat.panne.clear();
	await parTexte(app, 'Réessayer').cliquer();
	await respirer();

	assert.equal(app.querySelector('h1').textContent, 'Bienvenue 👋');
});

test('l\'envoi du ressenti qui echoue ne laisse pas croire que la seance est perdue', async (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const etat = { profil: null, panne: new Set(), ressentisRecus: [] };
	const app = await demarrer(etat);

	// Questionnaire
	app.querySelectorAll('input').find((i) => i.value === 'debutante').checked = true;
	app.querySelectorAll('input').find((i) => i.value === 'lundi').checked = true;
	await app.querySelector('form').declencher('submit');
	await respirer();

	// Proposition de notifications, puis ecran du jour
	assert.match(app.textContent, /Active les rappels/);
	await parTexte(app, 'Plus tard').cliquer();
	await respirer();
	assert.equal(app.querySelector('h1').textContent, 'Séance du jour');

	// Seance : un exercice, effort puis repos, puis le repit
	await parTexte(app, 'Commencer').cliquer();
	await respirer();
	await parTexte(app, 'Prête').cliquer();
	t.mock.timers.tick(3000);
	t.mock.timers.tick(2000);
	t.mock.timers.tick(2000);
	await respirer();
	assert.match(app.textContent, /Comment tu as trouvé la séance/);

	// Le reseau tombe pile a l'envoi du ressenti
	etat.panne.add('POST /api/ressenti');
	await parTexte(app, 'Correct').cliquer();
	await respirer();

	assert.equal(app.querySelector('h1').textContent, 'Ta séance est bien faite');
	assert.match(app.textContent, /rien n'est perdu/);

	// Le rejeu renvoie le MEME ressenti, et mene a l'ecran de recompense
	etat.panne.clear();
	await parTexte(app, 'Enregistrer ma séance').cliquer();
	await respirer();

	assert.deepEqual(etat.ressentisRecus, ['correct']);
	assert.match(app.textContent, /Ça, c'est fait\. Bravo !/);
	assert.notEqual(parTexte(app, 'Retour à l\'accueil'), undefined);
});

test('coupure sur « Mon activité » : l\'ecran du jour n\'est pas laisse en plan', async () => {
	const etat = { profil: PROFIL, panne: new Set(), ressentisRecus: [] };
	const app = await demarrer(etat);
	assert.equal(app.querySelector('h1').textContent, 'Séance du jour');

	etat.panne.add('GET /api/personnel');
	await parTexte(app, 'Mon activité').cliquer();
	await respirer();

	assert.equal(app.querySelector('h1').textContent, 'Ça ne répond pas');
	assert.notEqual(parTexte(app, 'Réessayer'), undefined);
});
