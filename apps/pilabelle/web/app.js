import { lireProfil, lireJour, envoyerRessenti } from './api.js';
import { vueQuestionnaire } from './vue-questionnaire.js';
import { vueJour } from './vue-jour.js';
import { vueSeance } from './vue-seance.js';
import { vueRessenti } from './vue-ressenti.js';
import { vueFin } from './vue-fin.js';

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
			onSeanceTerminee: () => monter(vueRessenti, {
				onChoix: async (ressenti) => {
					const recap = await envoyerRessenti(ressenti);
					monter(vueFin, { recap });
				},
			}),
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
