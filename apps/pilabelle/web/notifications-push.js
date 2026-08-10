// Le flux d'activation des notifications push (PRODUIT "Notifications :
// rappel de seance et mots doux", 9 aout 2026), rassemble ici pour n'exister
// qu'a un seul endroit : les reglages (web/vue-reglages.js) et la proposition
// initiale (web/vue-proposition-notifications.js) l'appellent tous les deux,
// jamais chacun sa propre copie.

import { lireClePubliqueVAPID, activerNotifications } from './api.js';

// urlBase64VersUint8Array convertit la cle publique VAPID (base64url, telle
// que rendue par le serveur) au format attendu par
// PushManager.subscribe({ applicationServerKey }).
function urlBase64VersUint8Array(base64Url) {
	const rembourrage = '='.repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + rembourrage).replace(/-/g, '+').replace(/_/g, '/');
	const brut = window.atob(base64);
	return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

// notificationsSupportees dit si ce navigateur peut recevoir des notifications
// push (PRODUIT : opt-in, jamais un bouton qui echoue silencieusement).
export function notificationsSupportees() {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// demanderActivationNotifications demande la permission, enregistre le
// service worker, s'abonne au push et enregistre l'abonnement cote serveur —
// le meme geste partout ou il est propose. Ne leve jamais : rend
// { ok: true } si l'abonnement est enregistre, sinon { ok: false, motif }
// avec motif parmi 'non-supporte' | 'refuse' | 'indisponible' | 'erreur', pour
// que chaque appelant choisisse comment (ou si) l'afficher.
export async function demanderActivationNotifications(heureRappel) {
	if (!notificationsSupportees()) return { ok: false, motif: 'non-supporte' };
	try {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return { ok: false, motif: 'refuse' };
		const enregistrement = await navigator.serviceWorker.register('/sw.js');
		await navigator.serviceWorker.ready;
		const clePublique = (await lireClePubliqueVAPID()).cle;
		if (!clePublique) return { ok: false, motif: 'indisponible' };
		let abonnement = await enregistrement.pushManager.getSubscription();
		if (!abonnement) {
			abonnement = await enregistrement.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64VersUint8Array(clePublique),
			});
		}
		const json = abonnement.toJSON();
		await activerNotifications(
			{ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
			heureRappel,
		);
		return { ok: true };
	} catch {
		return { ok: false, motif: 'erreur' };
	}
}
