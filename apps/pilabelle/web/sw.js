// Service worker minimal : reception des notifications push (PRODUIT,
// "Notifications : rappel de seance et mots doux", 9 aout 2026). Aucun cache
// hors-ligne — ce n'est pas une PWA installable, seulement le porteur du push.
// Servi a la racine (/sw.js) par le meme routeur que /app.js et /style.css
// (main.go), donc son scope couvre bien toute l'application.

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (evenement) => {
	evenement.waitUntil(self.clients.claim());
});

self.addEventListener('push', (evenement) => {
	let titre = 'pilabelle';
	let corps = '';
	try {
		const donnees = evenement.data ? evenement.data.json() : {};
		titre = donnees.titre || titre;
		corps = donnees.corps || '';
	} catch {
		corps = evenement.data ? evenement.data.text() : '';
	}
	evenement.waitUntil(
		self.registration.showNotification(titre, {
			body: corps,
			tag: 'pilabelle', // une notification en remplace une autre, jamais une pile qui s'accumule
		}),
	);
});

// Un tap sur la notification ramène simplement à l'écran du jour — jamais un
// écran dédié aux notifications, cohérent avec « zéro décision à l'ouverture ».
self.addEventListener('notificationclick', (evenement) => {
	evenement.notification.close();
	evenement.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
			for (const client of liste) {
				if ('focus' in client) return client.focus();
			}
			if (self.clients.openWindow) return self.clients.openWindow('/');
		}),
	);
});
