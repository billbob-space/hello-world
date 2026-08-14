// tests/etat.test.js — le contrat de stockage local (PRP 02 chantier C).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as etat from '../web/etat.js';

// Node n'expose `localStorage` que derriere un drapeau, et parfois en lecture
// seule : `defineProperty` pose le magasin dans les deux cas, la ou une simple
// affectation leverait.
function poserMagasin(magasin) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: magasin,
  });
}

function fauxMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get length() { return donnees.size; },
    key(i) { return [...donnees.keys()][i] ?? null; },
    getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
    setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
    removeItem(cle) { donnees.delete(cle); },
    contenu() { return Object.fromEntries(donnees); },
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.effacerEtat();
});

test('lireEtat ne rend jamais null : un premier lancement rend l’etat vide', () => {
  const e = etat.lireEtat();
  assert.notEqual(e, null);
  assert.deepEqual(e, etat.ETAT_VIDE);
});

test('la cle est celle de l’ossature §6, au caractere pres', () => {
  assert.equal(etat.CLE, 'gym.v1.etat');
  etat.ecrireEtat({ prenom: 'Léa' });
  assert.match(globalThis.localStorage.getItem('gym.v1.etat'), /"prenom":"Léa"/);
});

test('ecrireEtat FUSIONNE plutot que de remplacer : un champ pose n’efface pas les autres', () => {
  etat.ecrireEtat({ prenom: 'Léa', pseudo: 'Comète-7', code: '482913' });
  const apres = etat.ecrireEtat({ dernierEnvoi: '2026-08-14T09:00:00.000Z' });
  assert.equal(apres.prenom, 'Léa');
  assert.equal(apres.pseudo, 'Comète-7');
  assert.equal(apres.code, '482913', 'le code n’a pas disparu — c’est le seul moyen de retrouver la fiche');
  assert.equal(apres.dernierEnvoi, '2026-08-14T09:00:00.000Z');
  assert.deepEqual(etat.lireEtat(), apres, 'ce qui est rendu est ce qui est relu');
});

test('ajouterFait ajoute un fait, sans le dupliquer (PRD §9.5 : refaire ne compte pas double)', () => {
  const f = { seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z' };
  assert.deepEqual(etat.ajouterFait(f).faits, [f]);
  assert.deepEqual(etat.ajouterFait(f).faits, [f], 'le meme fait n’est pas ajoute deux fois');
  assert.equal(etat.lireEtat().faits.length, 1);
});

test('ajouterFait ignore un fait mal forme', () => {
  assert.deepEqual(etat.ajouterFait({ exercice: 'e01' }).faits, []);
  assert.deepEqual(etat.ajouterFait(null).faits, []);
});

test('retirerFait retire un fait precis, depuis la grille (PRD §9.2, §9.4)', () => {
  const f1 = { seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z' };
  const f2 = { seance: 1, semaine: 1, exercice: 'e02', a: '2026-08-14T09:01:00.000Z' };
  etat.ajouterFait(f1);
  etat.ajouterFait(f2);
  const apres = etat.retirerFait(f1);
  assert.deepEqual(apres.faits, [f2]);
  assert.deepEqual(etat.retirerFait(f1).faits, [f2], 'retirer un fait absent ne change rien');
});

test('effacerEtat dit si la cle existait, et repart d’un etat vide', () => {
  assert.equal(etat.effacerEtat(), false, 'rien a effacer au premier lancement');
  etat.ecrireEtat({ prenom: 'Léa' });
  assert.equal(etat.effacerEtat(), true);
  assert.deepEqual(etat.lireEtat(), etat.ETAT_VIDE);
});

test('un etat illisible ou d’un autre schema rend l’etat vide', () => {
  poserMagasin(fauxMagasin({ 'gym.v1.etat': '{ceci n’est pas du JSON' }));
  assert.deepEqual(etat.lireEtat(), etat.ETAT_VIDE);

  poserMagasin(fauxMagasin({ 'gym.v1.etat': '["prenom", "Léa"]' }));
  assert.deepEqual(etat.lireEtat(), etat.ETAT_VIDE, 'un tableau n’est pas la forme attendue');

  poserMagasin(fauxMagasin({
    'gym.v1.etat': JSON.stringify({ prenom: 'Léa', faits: [{ exercice: 'e01' }, { seance: 1, semaine: 1, exercice: 'e02', a: '2026-08-14T09:00:00.000Z' }] }),
  }));
  const e = etat.lireEtat();
  assert.equal(e.prenom, 'Léa');
  assert.deepEqual(e.faits, [{ seance: 1, semaine: 1, exercice: 'e02', a: '2026-08-14T09:00:00.000Z' }], 'le fait mal forme est ignore, l’autre survit');
});

// PRP 02 : « lireEtat ne rend jamais null et ne lance jamais : un
// localStorage indisponible (navigation privee) doit degrader vers un etat en
// memoire, pas casser l'application. »
test('un stockage refuse ne fait jamais lever, et la seance en cours continue', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('acces au stockage refuse'); },
  });

  assert.deepEqual(etat.lireEtat(), etat.ETAT_VIDE);
  const apres = etat.ecrireEtat({ prenom: 'Léa' });
  assert.equal(apres.prenom, 'Léa');
  assert.equal(etat.lireEtat().prenom, 'Léa', 'sans repli, l’ecran redemanderait le prenom en boucle');

  const f = { seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z' };
  etat.ajouterFait(f);
  assert.deepEqual(etat.lireEtat().faits, [f]);
  etat.retirerFait(f);
  assert.deepEqual(etat.lireEtat().faits, []);

  assert.equal(etat.effacerEtat(), true, 'le repli en memoire existait bien');
  assert.deepEqual(etat.lireEtat(), etat.ETAT_VIDE);
});

test('un quota plein n’empeche pas de finir la seance', () => {
  poserMagasin({
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem() {
      const err = new Error('quota depasse');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem() {},
  });

  const apres = etat.ecrireEtat({ prenom: 'Léa' });
  assert.equal(apres.prenom, 'Léa');
  assert.equal(etat.lireEtat().prenom, 'Léa', 'garde en memoire, relu en priorite');
});

test('EVT_ETAT est emis a chaque ecriture, quand la plateforme le permet', () => {
  assert.equal(etat.EVT_ETAT, 'gym:etat-maj');
  let recus = 0;
  const cible = new EventTarget();
  const original = globalThis.dispatchEvent;
  const originalCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class extends Event {};
  globalThis.dispatchEvent = (evt) => { recus += 1; cible.dispatchEvent(evt); return true; };
  try {
    etat.ecrireEtat({ prenom: 'Léa' });
    etat.effacerEtat();
  } finally {
    globalThis.dispatchEvent = original;
    globalThis.CustomEvent = originalCustomEvent;
  }
  assert.equal(recus, 2);
});
