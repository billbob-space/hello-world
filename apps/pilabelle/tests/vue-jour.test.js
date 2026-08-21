import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installerDom } from './faux-dom.js';
import { libelleDefi, vueJour } from '../web/vue-jour.js';

// Seance a deux blocs, utilisee par les tests de rendu ci-dessous : peu
// importe la zone, seule compte la forme (menthe = fait, lavande = a faire).
const SEANCE = { blocs: [{ zone: 'ventre' }, { zone: 'cuisses' }] };

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

// Decision d'ecran du 20 aout 2026 (PRODUCT.md « l'ecran de seance montre le
// programme ») : un seul element par ecran porte l'action principale, les
// autres pavas informent et ne se tapent pas. Ces tests portent sur la
// STRUCTURE (balises, classes) — la couleur elle-meme est verifiee cote CSS
// dans tests/style-ecran-jour.test.js, un vrai DOM n'ayant pas de moteur CSS.

function boutonsTapables(app) {
	// Exclut les liens de navigation (Reglages, Mon activite), qui ne sont pas
	// concernes par la regle : ils sont deja discrets, hors de la carte.
	return app.querySelectorAll('button').filter((b) => b.className !== 'lien-discret');
}

test('cas a-faire : le programme se voit (une li par bloc, jamais de classe) et un seul bouton tape', () => {
	const app = installerDom();
	vueJour(app, { jour: { cas: 'a-faire', seance: SEANCE }, onCommencer: () => {}, onReglages: () => {}, onPersonnel: () => {} });

	// « Le programme en une ligne » (decision du 21 aout 2026) : la liste porte
	// la classe `programme`, qui la met en rangee de pastilles plutot qu'en
	// colonne (regle CSS verifiee cote style dans style-ecran-jour.test.js).
	const liste = app.querySelector('ul');
	assert.equal(liste.className, 'programme');

	const blocs = app.querySelectorAll('ul li');
	assert.equal(blocs.length, 2, 'chaque bloc de la seance doit rester visible');
	for (const bloc of blocs) {
		// Aucune classe : le bloc n'est ni un .pique ni un .defi ni un bouton,
		// il tire sa couleur (lavande = a faire) de la regle generique `ul li`.
		assert.equal(bloc.className, '');
		assert.equal(bloc.tagName, 'LI');
	}

	const tapables = boutonsTapables(app);
	assert.equal(tapables.length, 1, 'un seul element doit porter l\'action principale');
	assert.equal(tapables[0].textContent, 'Commencer');
});

test('cas repos : aucun bloc, aucun bouton tapable dans la carte', () => {
	const app = installerDom();
	vueJour(app, { jour: { cas: 'repos' }, onCommencer: () => {}, onReglages: () => {}, onPersonnel: () => {} });

	assert.equal(app.querySelectorAll('ul li').length, 0);
	assert.equal(boutonsTapables(app).length, 0);
});

test('cas deja-faite : un seul bouton tapable, « Refaire la seance »', () => {
	const app = installerDom();
	vueJour(app, { jour: { cas: 'deja-faite', seance: SEANCE }, onCommencer: () => {}, onReglages: () => {}, onPersonnel: () => {} });

	const tapables = boutonsTapables(app);
	assert.equal(tapables.length, 1);
	assert.equal(tapables[0].textContent, 'Refaire la séance');
});

test('la pique et le defi non releve sont des paragraphes, jamais des boutons', () => {
	const app = installerDom();
	vueJour(app, {
		jour: { cas: 'a-faire', seance: SEANCE, pique: 'Tu peux le faire !', defi: { titre: 'Deux séances', releve: false } },
		onCommencer: () => {}, onReglages: () => {}, onPersonnel: () => {},
	});

	const pique = app.querySelector('.pique');
	assert.equal(pique.tagName, 'P');
	assert.equal(pique.className, 'pique');

	const defi = app.querySelector('.defi');
	assert.equal(defi.tagName, 'P');
	assert.equal(defi.className, 'defi');
	// Ni la pique ni le defi ne portent la classe d'un bouton secondaire :
	// c'etait la confusion visuelle relevee par la critique.
	assert.notEqual(defi.className, 'secondaire');

	assert.equal(boutonsTapables(app).length, 1, 'la pique et le defi ne comptent pas comme boutons');
});

test('le defi releve porte sa classe distincte, coherente avec le vert « fait »', () => {
	const app = installerDom();
	vueJour(app, {
		jour: { cas: 'a-faire', seance: SEANCE, defi: { titre: 'Deux séances', releve: true } },
		onCommencer: () => {}, onReglages: () => {}, onPersonnel: () => {},
	});

	const defi = app.querySelector('.defi.defi-releve');
	assert.notEqual(defi, null);
	assert.equal(defi.tagName, 'P');
});
