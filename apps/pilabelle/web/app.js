import { lireProfil, lireJour, envoyerRessenti, lirePersonnel } from './api.js';
import { vueQuestionnaire } from './vue-questionnaire.js';
import { vueJour } from './vue-jour.js';
import { vueSeance } from './vue-seance.js';
import { vueRessenti } from './vue-ressenti.js';
import { vueFin } from './vue-fin.js';
import { vueReglages } from './vue-reglages.js';
import { vuePersonnel } from './vue-personnel.js';
import { vuePropositionNotifications, fautIlProposer } from './vue-proposition-notifications.js';

const app = document.querySelector('#app');

function monter(vue, props) {
	app.textContent = '';
	vue(app, props);
}

async function afficherJour() {
	const [jour, profil] = await Promise.all([lireJour(), lireProfil()]);
	monter(vueJour, {
		jour,
		onReglages: () => monter(vueReglages, {
			profil,
			onRetour: afficherJour,
			onEnregistre: afficherJour,
			onReinitialise: amorcer,
		}),
		onPersonnel: async () => {
			const donnees = await lirePersonnel();
			monter(vuePersonnel, { donnees, onRetour: afficherJour });
		},
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

// apresCreationProfil enchaine sur la proposition initiale de notifications
// une seule fois, juste apres le questionnaire (PRODUIT, "Proposee une fois,
// a la creation du profil", 10 aout 2026) — jamais aux ouvertures suivantes,
// ou pour un profil deja marque propose (double onglet, cf.
// web/vue-questionnaire.js).
function apresCreationProfil(profil) {
	if (fautIlProposer(profil)) {
		monter(vuePropositionNotifications, { onSuivant: afficherJour });
	} else {
		afficherJour();
	}
}

async function amorcer() {
	const profil = await lireProfil();
	if (profil === null) {
		monter(vueQuestionnaire, { onCree: apresCreationProfil });
	} else {
		afficherJour();
	}
}

amorcer();
