import { lireProfil } from './api.js';
import { vueQuestionnaire } from './vue-questionnaire.js';

const app = document.querySelector('#app');

function monter(vue, props) {
	app.textContent = '';
	vue(app, props);
}

async function demarrer(profil) {
	// PRP 04 remplace ce point d'entree par l'ecran du jour.
	app.textContent = 'Profil enregistré. À très vite pour ta première séance !';
}

async function amorcer() {
	const profil = await lireProfil();
	if (profil === null) {
		monter(vueQuestionnaire, { onCree: demarrer });
	} else {
		demarrer(profil);
	}
}

amorcer();
