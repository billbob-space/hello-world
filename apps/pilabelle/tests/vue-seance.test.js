import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';
import { vueSeance } from '../web/vue-seance.js';

// Le repit de 2s entre deux exercices (PRD §7.3) est le seul moment ou l'ecran
// n'est pilote par rien : le minuteur est termine, le suivant n'existe pas
// encore. C'est la qu'il affichait une phase perimee, un decompte fige sur
// « 1 » et un bouton « Pause » qu'aucun etat n'ecoutait.

function seanceDe(...noms) {
	return {
		blocs: [{
			zone: 'ventre',
			exercices: noms.map((nom, i) => ({
				id: `ex-${i}`,
				nom,
				consigne: 'Consigne courte.',
				video: { url: '' },
				minutage: { effort_s: 3, repos_s: 2, tours: 1 },
			})),
		}],
	};
}

function ecran(app) {
	return {
		phase: app.querySelector('.phase').textContent,
		minuteur: app.querySelector('.minuteur').textContent,
		bouton: app.querySelector('.carte > button'),
	};
}

// jusquAuBout consomme l'effort puis le repos du minuteur en cours.
function jusquAuBout(t) { t.mock.timers.tick(3000); t.mock.timers.tick(2000); }

test('le repit entre deux exercices annonce le suivant, verrou mis', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	vueSeance(app, { seance: seanceDe('Bascule du bassin', 'Pont fessier'), onSeanceTerminee: () => {} });

	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);

	const e = ecran(app);
	assert.equal(e.phase, '', 'la phase perimee doit disparaitre');
	assert.equal(e.minuteur, '', 'le decompte fige sur « 1 » doit disparaitre');
	assert.equal(e.bouton.textContent, 'Exercice suivant…');
	assert.equal(e.bouton.disabled, true);
});

test('sur le DERNIER exercice, le repit annonce la fin, pas un suivant', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	vueSeance(app, { seance: seanceDe('Étirement du chat'), onSeanceTerminee: () => {} });

	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);

	assert.equal(app.querySelector('.carte > button').textContent, 'Séance terminée ✓');
});

test('le bouton du repit est inerte : un tap ne relance rien', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	let fins = 0;
	vueSeance(app, { seance: seanceDe('Bascule du bassin', 'Pont fessier'), onSeanceTerminee: () => { fins += 1; } });

	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);

	// Le tap qui, avant, ne declenchait rien sans le dire : aucun etat du
	// minuteur ne correspondait, et l'ecran gardait « 😮‍💨 Repos » et « 1 ».
	app.querySelector('.carte > button').cliquer();
	assert.equal(app.querySelector('.minuteur').textContent, '');
	assert.equal(app.querySelector('.phase').textContent, '');

	t.mock.timers.tick(2000);
	assert.equal(app.querySelector('h2').textContent, 'Pont fessier', 'le repit doit mener au suivant');
	assert.equal(fins, 0);
});

test('le dernier repit ecoule termine la seance, avec les exercices faits', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	let faits = null;
	vueSeance(app, { seance: seanceDe('Bascule du bassin', 'Pont fessier'), onSeanceTerminee: (ids) => { faits = ids; } });

	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);
	t.mock.timers.tick(2000);
	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);
	assert.equal(faits, null, 'jamais avant le repit');
	t.mock.timers.tick(2000);

	assert.deepEqual(faits, ['ex-0', 'ex-1']);
});

test('la barre de progression suit l\'exercice courant', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	vueSeance(app, { seance: seanceDe('Un', 'Deux', 'Trois'), onSeanceTerminee: () => {} });

	assert.equal(app.querySelectorAll('.progression span').length, 3);
	assert.equal(app.querySelectorAll('.progression span.courante').length, 1);
	assert.equal(app.querySelectorAll('.progression span.faite').length, 0);

	app.querySelector('.carte > button').cliquer();
	jusquAuBout(t);
	t.mock.timers.tick(2000);

	assert.equal(app.querySelectorAll('.progression span.faite').length, 1);
});

test('une video absente ne laisse pas de lecteur casse', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	vueSeance(app, { seance: seanceDe('Sans vidéo'), onSeanceTerminee: () => {} });
	assert.equal(app.querySelectorAll('iframe').length, 0);
});

test('une video presente porte un nom accessible qui la nomme', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	const seance = seanceDe('Pont fessier');
	seance.blocs[0].exercices[0].video = { url: 'https://www.youtube.com/shorts/abc123XYZ_-' };
	vueSeance(app, { seance, onSeanceTerminee: () => {} });
	const cadre = app.querySelector('iframe');
	assert.equal(cadre.title, 'Vidéo de démonstration : Pont fessier');
});

test('sans minutage, l\'exercice tourne quand meme sur le repli', (t) => {
	t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
	const app = installerDom();
	const seance = seanceDe('Respiration');
	seance.blocs[0].exercices[0].minutage = null;
	vueSeance(app, { seance, onSeanceTerminee: () => {} });

	app.querySelector('.carte > button').cliquer();
	assert.equal(app.querySelector('.minuteur').textContent, '20'); // repli effort_s: 20
});
