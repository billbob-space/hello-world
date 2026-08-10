import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fautIlProposer } from '../web/vue-proposition-notifications.js';

test('profil absent -> jamais de proposition', () => {
	assert.equal(fautIlProposer(null), false);
	assert.equal(fautIlProposer(undefined), false);
});

test('profil frais, jamais propose -> proposition', () => {
	assert.equal(fautIlProposer({ notifications: {} }), true);
	assert.equal(fautIlProposer({ notifications: { proposee_initiale: false } }), true);
});

test('champ notifications absent -> proposition (compatibilite ancien profil)', () => {
	assert.equal(fautIlProposer({}), true);
});

test('deja proposee, acceptee ou non -> jamais reproposee', () => {
	assert.equal(fautIlProposer({ notifications: { proposee_initiale: true } }), false);
	assert.equal(fautIlProposer({ notifications: { proposee_initiale: true, abonnement: { endpoint: 'x' } } }), false);
});
