// La proposition initiale des notifications (PRODUIT, "Notifications : rappel
// de seance et mots doux" > "Proposee une fois, a la creation du profil", 10
// aout 2026) : un ecran intercale une seule fois, juste apres le
// questionnaire, avant le premier ecran du jour. Un ton d'invitation, jamais
// d'urgence — les memes mots que la description des reglages.

import { marquerPropositionInitiale } from './api.js';
import { demanderActivationNotifications } from './notifications-push.js';

const HEURE_RAPPEL_PAR_DEFAUT = '18:00'; // meme defaut que les reglages (domaine.go: heureRappelParDefaut)

// fautIlProposer dit si l'ecran doit s'afficher pour ce profil : jamais si la
// proposition a deja ete faite sur ce profil (pas dans le navigateur). Sert
// aussi de garde-fou pour le double onglet (web/vue-questionnaire.js : le
// second onglet peut recevoir onCree() pour un profil deja cree, et deja
// propose, par le premier).
export function fautIlProposer(profil) {
	return Boolean(profil) && !(profil.notifications && profil.notifications.proposee_initiale);
}

export function vuePropositionNotifications(conteneur, { onSuivant }) {
	const carte = document.createElement('div');
	carte.className = 'carte';
	// h3 : la question etait le seul titre de l'ecran, et le style h3
	// (--encre-douce, 1,05rem) la rendait plus petite et plus pale que le
	// paragraphe qu'elle introduit — et l'ecran n'avait aucun h1. Meme patron
	// que tous les autres ecrans de l'app.
	carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Active les rappels et les mots doux ?' }));

	const description = document.createElement('p');
	description.className = 'sous-titre';
	description.textContent = 'Reçois un rappel discret pour ta séance, et parfois un mot doux — jamais sans ton accord, et modifiable à tout moment dans les réglages.';
	carte.appendChild(description);

	// terminer marque la proposition comme faite, quel que soit le geste, puis
	// enchaine sur l'ecran du jour — jamais reproposee automatiquement.
	async function terminer() {
		try {
			await marquerPropositionInitiale();
		} catch {
			// Echec silencieux : ne bloque jamais l'arrivee sur l'ecran du jour.
			// Au pire, l'ecran sera repropose a une ouverture suivante.
		}
		onSuivant();
	}

	const boutonActiver = document.createElement('button');
	boutonActiver.type = 'button';
	boutonActiver.textContent = 'Activer';
	boutonActiver.addEventListener('click', async () => {
		// Meme flux que le bouton des reglages, meme echec silencieux si la
		// permission est refusee ou qu'une erreur survient (PRODUIT).
		await demanderActivationNotifications(HEURE_RAPPEL_PAR_DEFAUT);
		await terminer();
	});
	carte.appendChild(boutonActiver);

	const boutonPlusTard = document.createElement('button');
	boutonPlusTard.type = 'button';
	boutonPlusTard.className = 'secondaire';
	boutonPlusTard.textContent = 'Plus tard';
	boutonPlusTard.addEventListener('click', terminer);
	carte.appendChild(boutonPlusTard);

	conteneur.appendChild(carte);
}
