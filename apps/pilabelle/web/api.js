// Les appels au serveur, un par route. Aucun ne connait X-Forwarded-User :
// c'est Traefik qui le pose, jamais le navigateur.

async function appeler(chemin, options) {
	const reponse = await fetch(chemin, options);
	if (reponse.status === 404) return null;
	if (!reponse.ok) {
		const corps = await reponse.json().catch(() => ({}));
		throw new Error(corps.erreur || `erreur ${reponse.status}`);
	}
	if (reponse.status === 204) return {};
	return reponse.json();
}

export function lireProfil() {
	return appeler('/api/profil');
}

export function creerProfil(reponses) {
	return appeler('/api/profil', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(reponses),
	});
}

export function mettreAJourProfil(reponses) {
	return appeler('/api/profil', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(reponses),
	});
}

export function lireJour() {
	return appeler('/api/jour');
}

export function envoyerRessenti(ressenti) {
	return appeler('/api/ressenti', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ressenti }),
	});
}

export function supprimerProfil() {
	return appeler('/api/profil', { method: 'DELETE' });
}

export function lirePersonnel() {
	return appeler('/api/personnel');
}

// Notifications push, opt-in (PRODUIT, "Notifications : rappel de seance et
// mots doux", 9 aout 2026). La cle publique VAPID n'est pas un secret : c'est
// elle que le navigateur transmet a PushManager.subscribe().
export function lireClePubliqueVAPID() {
	return appeler('/api/notifications/cle-publique');
}

export function activerNotifications(abonnement, heureRappel) {
	return appeler('/api/notifications', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ abonnement, heure_rappel: heureRappel || '' }),
	});
}

export function desactiverNotifications() {
	return appeler('/api/notifications', { method: 'DELETE' });
}
