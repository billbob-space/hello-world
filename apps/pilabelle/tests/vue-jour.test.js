import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleDefi } from '../web/vue-jour.js';

test('aucun defi -> aucun libelle', () => {
	assert.equal(libelleDefi(null), null);
	assert.equal(libelleDefi(undefined), null);
});

test('defi pas encore releve -> titre sans mention d\'echec ni d\'urgence', () => {
	const libelle = libelleDefi({ titre: 'Deux séances faciles', releve: false });
	assert.equal(libelle, 'Défi de la semaine : Deux séances faciles');
	assert.doesNotMatch(libelle, /manqu|rat|urgent|reste/i);
});

test('defi releve -> libelle positif distinct', () => {
	const libelle = libelleDefi({ titre: 'Zéro séance manquée', releve: true });
	assert.equal(libelle, '✓ Défi relevé : Zéro séance manquée');
});
