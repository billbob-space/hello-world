import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteRecompenseDefi } from '../web/vue-fin.js';

test('pas de transition -> aucune recompense affichee', () => {
	assert.equal(texteRecompenseDefi({}), null);
	assert.equal(texteRecompenseDefi({ defi_releve: false }), null);
	assert.equal(texteRecompenseDefi(undefined), null);
});

test('transition non-releve -> releve produit une recompense visible', () => {
	assert.equal(texteRecompenseDefi({ defi_releve: true }), '🏆 Défi de la semaine relevé !');
});
