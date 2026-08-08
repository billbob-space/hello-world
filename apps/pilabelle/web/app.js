import { lireProfil, lireJour } from './api.js';
import { vueQuestionnaire } from './vue-questionnaire.js';
import { vueJour } from './vue-jour.js';
import { vueSeance } from './vue-seance.js';

const app = document.querySelector('#app');

function monter(vue, props) {
	app.textContent = '';
	vue(app, props);
}

async function afficherJour() {
	const jour = await lireJour();
	monter(vueJour, {
		jour,
		onCommencer: (seance) => monter(vueSeance, {
			seance,
			onSeanceTerminee: () => {
				// PRP 05 remplace ce bloc par le ressenti et l'ecran de fin.
				app.textContent = 'Séance terminée ! (écran de fin à venir)';
			},
		}),
	});
}

async function amorcer() {
	const profil = await lireProfil();
	if (profil === null) {
		monter(vueQuestionnaire, { onCree: afficherJour });
	} else {
		afficherJour();
	}
}

amorcer();
