// L'ecran de panne. Avant lui, toute erreur reseau laissait l'application sur
// « Chargement… » indefiniment : aucun message, aucun geste possible, sur le
// seul point d'entree de l'app (mesure : /api/** coupe => « Chargement… »
// pour toujours). Le ton reste celui du PRD §10.1 — jamais un ton d'alarme,
// jamais un code d'erreur, toujours un geste a faire.

export function vueErreur(conteneur, { titre, texte, libelleReessai, onReessayer }) {
	conteneur.textContent = '';

	const carte = document.createElement('div');
	carte.className = 'carte';
	conteneur.appendChild(carte);

	carte.appendChild(Object.assign(document.createElement('h1'), {
		textContent: titre || 'Ça ne répond pas',
	}));
	carte.appendChild(Object.assign(document.createElement('p'), {
		className: 'sous-titre',
		textContent: texte || "L'application n'arrive pas à joindre le serveur. Vérifie ta connexion, puis réessaie.",
	}));

	const bouton = document.createElement('button');
	bouton.type = 'button';
	bouton.textContent = libelleReessai || 'Réessayer';
	bouton.addEventListener('click', () => {
		bouton.disabled = true;
		bouton.textContent = 'Un instant…';
		onReessayer();
	});
	carte.appendChild(bouton);
}
