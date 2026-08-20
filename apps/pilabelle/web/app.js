import { lireProfil, lireJour, envoyerRessenti, lirePersonnel } from './api.js';
import { vueQuestionnaire } from './vue-questionnaire.js';
import { vueJour } from './vue-jour.js';
import { vueSeance } from './vue-seance.js';
import { vueRessenti } from './vue-ressenti.js';
import { vueFin } from './vue-fin.js';
import { vueReglages } from './vue-reglages.js';
import { vuePersonnel } from './vue-personnel.js';
import { vuePropositionNotifications, fautIlProposer } from './vue-proposition-notifications.js';
import { vueErreur } from './vue-erreur.js';
import { avecPanne as rejouable } from './reessai.js';

const app = document.querySelector('#app');

function monter(vue, props) {
	app.textContent = '';
	vue(app, props);
}

// enPanne monte l'ecran de panne plutot que de laisser l'application figee.
// Sans lui, une coupure reseau immobilisait « Chargement… » sans message ni
// geste possible — sur une app ouverte le matin depuis un telephone, c'est
// l'etat le plus frequent apres l'etat normal.
function enPanne(onReessayer, textes) {
	monter(vueErreur, { ...textes, onReessayer });
}

// avecPanne : la logique de rejeu vit dans reessai.js, testee a part ; ici on
// ne fait que lui dire ou aller en cas d'echec.
const avecPanne = (action, textes) => rejouable(action, enPanne, textes);

const afficherJour = avecPanne(async function afficherJour() {
	const [jour, profil] = await Promise.all([lireJour(), lireProfil()]);
	monter(vueJour, {
		jour,
		onReglages: () => monter(vueReglages, {
			profil,
			onRetour: afficherJour,
			onEnregistre: afficherJour,
			onReinitialise: amorcer,
		}),
		onPersonnel: avecPanne(async () => {
			const donnees = await lirePersonnel();
			monter(vuePersonnel, { donnees, onRetour: afficherJour });
		}),
		onCommencer: (seance) => monter(vueSeance, {
			seance,
			onSeanceTerminee: () => monter(vueRessenti, {
				// Si l'envoi echoue, la seance vient d'etre faite pour de vrai :
				// le message le dit, et le bouton rejoue le meme ressenti — jamais
				// un ecran qui laisse croire que l'effort est perdu.
				onChoix: avecPanne(async (ressenti) => {
					const recap = await envoyerRessenti(ressenti);
					monter(vueFin, { recap, onRetour: afficherJour });
				}, {
					titre: 'Ta séance est bien faite',
					texte: "Elle n'a pas pu être enregistrée : le serveur ne répond pas. Réessaie, rien n'est perdu.",
					libelleReessai: 'Enregistrer ma séance',
				}),
			}),
		}),
	});
});

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

const amorcer = avecPanne(async function amorcer() {
	const profil = await lireProfil();
	if (profil === null) {
		monter(vueQuestionnaire, { onCree: apresCreationProfil });
	} else {
		afficherJour();
	}
});

amorcer();
