import { construireFormulaireReponses } from './formulaire-reponses.js';
import {
	mettreAJourProfil,
	supprimerProfil,
	lireProfil,
	desactiverNotifications,
} from './api.js';
import { notificationsSupportees, demanderActivationNotifications } from './notifications-push.js';

// messageEchecActivation traduit le motif d'echec de
// demanderActivationNotifications en un texte pour messageEtat, sans jamais
// un ton pressant (PRODUIT).
function messageEchecActivation(motif) {
	switch (motif) {
		case 'refuse':
			return 'Permission refusée : aucune notification ne sera envoyée.';
		case 'indisponible':
			return 'Notifications indisponibles pour le moment.';
		default:
			return "L'activation a échoué. Réessaie plus tard.";
	}
}

// construireCarteNotifications ajoute la section "Notifications" des reglages
// (PRODUIT, "Notifications : rappel de seance et mots doux", 9 aout 2026) :
// opt-in explicite, jamais de notification sans ce geste. Aucun etat visible
// ne ressemble a une pression — juste l'etat actuel et deux gestes possibles.
function construireCarteNotifications(conteneur, profil) {
	const carte = document.createElement('div');
	carte.className = 'carte';
	carte.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Notifications' }));

	if (!notificationsSupportees()) {
		carte.appendChild(paragrapheReglages('Les notifications ne sont pas prises en charge par ce navigateur.'));
		conteneur.appendChild(carte);
		return;
	}

	const abonne = Boolean(profil.notifications && profil.notifications.abonnement);

	const description = document.createElement('p');
	description.className = 'sous-titre';
	description.textContent = abonne
		? 'Rappel de séance et petits mots doux activés sur cet appareil.'
		: 'Reçois un rappel discret pour ta séance, et parfois un mot doux — jamais sans ton accord.';
	carte.appendChild(description);

	const champHeure = document.createElement('label');
	const libelleHeure = document.createElement('span');
	libelleHeure.textContent = 'Heure du rappel';
	const saisieHeure = document.createElement('input');
	saisieHeure.type = 'time';
	saisieHeure.value = (profil.notifications && profil.notifications.heure_rappel) || '18:00';
	champHeure.appendChild(libelleHeure);
	champHeure.appendChild(saisieHeure);
	carte.appendChild(champHeure);

	const messageEtat = document.createElement('p');
	messageEtat.className = 'erreur';
	messageEtat.hidden = true;
	carte.appendChild(messageEtat);

	const boutonActiver = document.createElement('button');
	boutonActiver.type = 'button';
	// « Enregistrer » tout court entrait en collision avec le bouton
	// « Enregistrer » du formulaire de profil, juste au-dessus sur le meme
	// ecran : deux boutons de meme nom pour deux actions differentes.
	boutonActiver.textContent = abonne ? "Enregistrer l'heure du rappel" : 'Activer les rappels';
	boutonActiver.addEventListener('click', async () => {
		messageEtat.hidden = true;
		const resultat = await demanderActivationNotifications(saisieHeure.value);
		if (!resultat.ok) {
			messageEtat.textContent = messageEchecActivation(resultat.motif);
			messageEtat.hidden = false;
			return;
		}
		onNotificationsChangees();
	});
	carte.appendChild(boutonActiver);

	if (abonne) {
		const boutonDesactiver = document.createElement('button');
		boutonDesactiver.type = 'button';
		boutonDesactiver.className = 'secondaire';
		boutonDesactiver.textContent = 'Désactiver les notifications';
		boutonDesactiver.addEventListener('click', async () => {
			try {
				if ('serviceWorker' in navigator) {
					const enregistrement = await navigator.serviceWorker.getRegistration();
					const abonnementActuel = enregistrement && (await enregistrement.pushManager.getSubscription());
					if (abonnementActuel) await abonnementActuel.unsubscribe();
				}
			} finally {
				await desactiverNotifications();
				onNotificationsChangees();
			}
		});
		carte.appendChild(boutonDesactiver);
	}

	conteneur.appendChild(carte);

	// onNotificationsChangees re-rend la carte a partir de l'etat frais du
	// profil, sans recharger toute la vue Reglages.
	async function onNotificationsChangees() {
		const profilAJour = await lireProfil();
		carte.remove();
		construireCarteNotifications(conteneur, profilAJour);
	}
}

function paragrapheReglages(texte) {
	const p = document.createElement('p');
	p.className = 'sous-titre';
	p.textContent = texte;
	return p;
}

export function vueReglages(conteneur, { profil, onEnregistre, onReinitialise, onRetour }) {
	construireFormulaireReponses(conteneur, {
		reponsesInitiales: profil.reponses,
		titre: 'Réglages',
		libelleBouton: 'Enregistrer',
		onValider: async (reponses) => {
			const profilMisAJour = await mettreAJourProfil(reponses);
			onEnregistre(profilMisAJour);
		},
	});

	const retour = document.createElement('button');
	retour.type = 'button';
	retour.className = 'lien-discret';
	retour.textContent = '← Retour';
	retour.addEventListener('click', onRetour);
	conteneur.insertBefore(retour, conteneur.firstChild);

	// Ajoute apres les PRP (PRODUCT.md, "Notifications : rappel de seance et
	// mots doux", 9 aout 2026) : a cote du bouton de reinitialisation deja la,
	// avant la zone sensible.
	construireCarteNotifications(conteneur, profil);

	// Ajoute apres les PRP (PRODUCT.md, "Ajoute apres les PRP") : demande
	// explicite en usage reel, absente du PRD initial. Confirmation native
	// avant un geste irreversible — efface serie, historique et niveaux.
	const carteDanger = document.createElement('div');
	carteDanger.className = 'carte zone-danger';

	carteDanger.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Zone sensible' }));

	const avertissement = document.createElement('p');
	avertissement.textContent = 'Repartir de zéro efface ta série, ton historique et tes niveaux. Cette action est irréversible.';
	carteDanger.appendChild(avertissement);

	const boutonReset = document.createElement('button');
	boutonReset.type = 'button';
	boutonReset.className = 'danger';
	boutonReset.textContent = 'Réinitialiser mon profil';
	boutonReset.addEventListener('click', async () => {
		if (!window.confirm('Vraiment repartir de zéro ? Série, historique et niveaux seront effacés.')) return;
		await supprimerProfil();
		onReinitialise();
	});
	carteDanger.appendChild(boutonReset);

	conteneur.appendChild(carteDanger);
}
