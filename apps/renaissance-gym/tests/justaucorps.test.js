// tests/justaucorps.test.js — A13 et A14 (« Ajouté après les PRP », lot
// ludique) : le justaucorps qui se pare, et ses couleurs.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerProgramme } from '../web/programme.js';
import { PARURES } from '../web/parures.js';
import {
  COULEURS, couleurParId, construireSvgJustaucorps, monterJustaucorps,
} from '../web/vue-justaucorps.js';
import * as etat from '../web/etat.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));

function poserMagasin(magasin) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: magasin });
}
function fauxMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get length() { return donnees.size; },
    key(i) { return [...donnees.keys()][i] ?? null; },
    getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
    setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
    removeItem(cle) { donnees.delete(cle); },
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.effacerEtat();
  poserDocumentFactice();
  globalThis.location = { hash: '#/justaucorps' };
});

function faitsDeSeance(numero, semaine) {
  const s = prog.seances.find((x) => x.id === `s${numero}`);
  return s.exercices.map((id) => ({
    seance: numero, semaine, exercice: id, a: '2026-08-03T09:00:00.000Z',
  }));
}
function faitsSemaineComplete(semaine) {
  return [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, semaine));
}

// --- A14 : les six couleurs --------------------------------------------------

test('COULEURS porte exactement six combinaisons, toutes différentes, toutes associées à l’or', () => {
  assert.equal(COULEURS.length, 6);
  const ids = new Set(COULEURS.map((c) => c.id));
  assert.equal(ids.size, 6);
  for (const c of COULEURS) {
    assert.match(c.nom, /et or$/, `« ${c.nom} » devrait s’associer à l’or, comme le reste du système`);
  }
});

test('COULEURS ne touche à aucun jeton du système visuel au-delà de ceux déjà existants ou dédiés à cet écran', () => {
  for (const c of COULEURS) {
    assert.match(c.jeton, /^--(bleu-roi|fuchsia|bleu-nuit|parure-grenat|parure-emeraude|parure-violine)$/);
  }
});

test('couleurParId rend la première couleur pour un identifiant inconnu, jamais une exception', () => {
  assert.equal(couleurParId('inexistante'), COULEURS[0]);
  assert.equal(couleurParId(undefined), COULEURS[0]);
});

// --- construireSvgJustaucorps : pur, aucune parure verrouillée à vue --------

test('sans aucune parure acquise, le dessin ne porte aucune couche', () => {
  const svg = construireSvgJustaucorps([]);
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /justaucorps__parure/, 'aucune parure verrouillée ne doit apparaître, même masquée');
});

test('chaque parure acquise ajoute EXACTEMENT une couche, et rien pour ce qui manque', () => {
  const acquises = ['parure-1', 'parure-3', 'parure-5'];
  const svg = construireSvgJustaucorps(acquises);
  for (const id of acquises) {
    assert.match(svg, new RegExp(`justaucorps__parure--${id}"`), `${id} devrait apparaître dans le dessin`);
  }
  const manquantes = PARURES.map((p) => p.id).filter((id) => !acquises.includes(id));
  for (const id of manquantes) {
    assert.doesNotMatch(svg, new RegExp(`justaucorps__parure--${id}"`), `${id} ne devrait JAMAIS apparaître, même en creux`);
  }
});

test('les huit parures acquises donnent huit couches', () => {
  const tous = PARURES.map((p) => p.id);
  const svg = construireSvgJustaucorps(tous);
  const occurrences = svg.match(/justaucorps__parure--/g) ?? [];
  assert.equal(occurrences.length, 8);
});

test('construireSvgJustaucorps ne porte jamais d’URL absolue (aucun xmlns littéral)', () => {
  const svg = construireSvgJustaucorps(PARURES.map((p) => p.id));
  assert.doesNotMatch(svg, /https?:\/\//i);
});

// --- monterJustaucorps : le DOM ------------------------------------------------

test('l’écran monte le dessin, atteignable depuis « Aujourd’hui »', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  assert.ok(hote.querySelector('.justaucorps__figure'), 'la figure doit être montée');
  const retour = hote.querySelectorAll('a').find((a) => a.href === '#/jour');
  assert.ok(retour, 'un lien doit ramener à l’écran du jour');
});

test('le dessin lit les parures PERSISTÉES, pas un recalcul depuis les faits : un programme recommencé à zéro garde son justaucorps', () => {
  // Exactement le scénario de « Recommencer à zéro » (vue-grille.js) : les
  // faits sont vidés, mais les parures déjà acquises, elles, ne le sont pas.
  etat.ecrireEtat({
    prenom: 'Léa', faits: [], parures: ['parure-1', 'parure-2', 'parure-3'],
  });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  const svg = hote.querySelector('.justaucorps__figure').innerHTML;
  for (const id of ['parure-1', 'parure-2', 'parure-3']) {
    assert.match(svg, new RegExp(`justaucorps__parure--${id}"`), `${id} doit rester visible malgré des faits vidés`);
  }
});

test('une parure méritée mais jamais encore constatée se persiste au montage, définitivement', () => {
  etat.ecrireEtat({ prenom: 'Léa', faits: faitsSemaineComplete(1), parures: [] });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  assert.deepEqual(etat.lireEtat().parures, ['parure-1']);
});

test('les six couleurs sont proposées, toutes cliquables dès le premier jour', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  const boutons = hote.querySelectorAll('.justaucorps__couleur');
  assert.equal(boutons.length, 6);
  for (const c of COULEURS) {
    assert.ok(boutons.some((b) => b.textContent === c.nom));
  }
});

test('choisir une couleur l’écrit dans l’état, et suit la fiche comme le prénom (A14)', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  const fuchsia = hote.querySelectorAll('.justaucorps__couleur').find((b) => b.textContent === 'Fuchsia et or');
  fuchsia.declencher('click');

  assert.equal(etat.lireEtat().couleurJustaucorps, 'fuchsia');
  assert.equal(fuchsia.getAttribute('aria-pressed'), 'true');
  assert.ok(fuchsia.classList.contains('justaucorps__couleur--choisie'));
});

test('la couleur par défaut est présélectionnée au montage', () => {
  etat.ecrireEtat({ prenom: 'Léa', couleurJustaucorps: 'nuit' });
  const hote = creerHote();
  monterJustaucorps(hote, { etat: etat.lireEtat(), programme: prog });

  const nuit = hote.querySelectorAll('.justaucorps__couleur').find((b) => b.textContent === 'Nuit et or');
  assert.equal(nuit.getAttribute('aria-pressed'), 'true');
});
