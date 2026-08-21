// Le formulaire des reponses (web/formulaire-reponses.js), partage par le
// questionnaire initial et les reglages. Ce que ces tests gardent : le refus
// dit CE QUI manque, et il ne le dit pas qu'a l'ecran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';
import { construireFormulaireReponses, messageManque } from '../web/formulaire-reponses.js';

const COMPLET = { niveau_depart: 'debutante', douleurs: [], jours_actifs: ['lundi'] };

test('rien ne manque -> aucun message', () => {
	assert.equal(messageManque(COMPLET), null);
});

test('le message nomme ce qui manque, jamais la regle entiere', () => {
	assert.equal(
		messageManque({ ...COMPLET, jours_actifs: [] }),
		'Choisis au moins un jour de la semaine.',
	);
	assert.equal(
		messageManque({ ...COMPLET, niveau_depart: '' }),
		'Choisis ton niveau de départ.',
	);
	// Les deux manquent : le message le dit, mais il reste une seule phrase.
	const deux = messageManque({ niveau_depart: '', douleurs: [], jours_actifs: [] });
	assert.match(deux, /niveau/);
	assert.match(deux, /jour/);
});

// Un message qui n'existe qu'a l'ecran laisse un lecteur d'ecran devant un
// formulaire qui refuse sans dire pourquoi : le paragraphe doit porter
// role="alert" DES sa construction, alors qu'il est encore masque — une
// region live posee au moment de l'echec n'est pas annoncee.
test('le message d\'erreur est annonce, et il est masque tant qu\'il est vide', () => {
	const conteneur = installerDom();
	construireFormulaireReponses(conteneur, {
		reponsesInitiales: null,
		onValider: async () => {},
		libelleBouton: 'Commencer',
		titre: 'Bienvenue',
	});
	const erreur = conteneur.querySelector('p.erreur');
	assert.ok(erreur, 'le paragraphe d\'erreur existe des la construction');
	assert.equal(erreur.getAttribute('role'), 'alert');
	assert.equal(erreur.hidden, true);
});

test('soumettre sans rien choisir affiche le message, et n\'appelle pas onValider', async () => {
	const conteneur = installerDom();
	let appels = 0;
	construireFormulaireReponses(conteneur, {
		reponsesInitiales: null,
		onValider: async () => { appels += 1; },
		libelleBouton: 'Commencer',
		titre: 'Bienvenue',
	});
	await conteneur.querySelector('form').declencher('submit');
	const erreur = conteneur.querySelector('p.erreur');
	assert.equal(appels, 0);
	assert.equal(erreur.hidden, false);
	assert.match(erreur.textContent, /niveau/);
});
