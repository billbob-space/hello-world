// Les messages d'echec de la carte « Notifications » (web/vue-reglages.js).
//
// Ce que ce test garde : un refus de permission ne se rouvre PAS depuis la
// page — le bouton « Activer les rappels » redonnera le meme message a chaque
// tap. Un message qui ne dit que le resultat installe donc un cul-de-sac :
// elle tape, rien ne change, et rien ne lui dit ou aller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageEchecActivation } from '../web/vue-reglages.js';

test('permission refusee : le message dit ou aller, pas seulement ce qui a echoue', () => {
	const message = messageEchecActivation('refuse');
	assert.match(message, /refusée/i);
	assert.match(message, /réglages de ton navigateur/i);
});

test('aucun message d\'echec ne culpabilise ni ne presse', () => {
	for (const motif of ['refuse', 'indisponible', 'autre']) {
		assert.doesNotMatch(messageEchecActivation(motif), /dois|oubli|attention|erreur de ta part/i);
	}
});
