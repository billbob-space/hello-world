// tests/etat.test.js — le contrat de stockage local (ossature §6).
// Ce repertoire n'est jamais embarque dans l'image : voir .dockerignore.
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

// Un faux magasin fidele a l'API Storage — `length` et `key()` comprises, car
// c'est par elles que `toutEffacer` enumere les cles.
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
  // `etat.js` garde un repli en memoire qui survit d'un test a l'autre : sans
  // cet appel, un test heriterait du prenom du precedent.
  etat.toutEffacer();
});

test('le prenom se lit, s ecrit, et se nettoie au passage', () => {
  assert.equal(etat.lirePrenom(), null, 'aucun prenom au premier lancement');
  assert.equal(etat.ecrirePrenom('  Lucas \n'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas');
  assert.equal(etat.ecrirePrenom('Jean   Baptiste'), 'Jean Baptiste', 'espaces internes reduits');
});

test('un prenom vide n est pas enregistre, un prenom trop long est tronque', () => {
  assert.equal(etat.ecrirePrenom('   '), null);
  assert.equal(etat.lirePrenom(), null, 'rien n a ete ecrit');
  assert.equal(etat.ecrirePrenom(''), null);
  assert.equal(etat.ecrirePrenom(42), null, 'une valeur qui n est pas une chaine ne passe pas');
  assert.equal(etat.ecrirePrenom('a'.repeat(30)), 'a'.repeat(24), '24 caracteres au plus');
});

test('les cles sont celles de l ossature §6, au caractere pres', () => {
  etat.ecrirePrenom('Lucas');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.equal(etat.CLE_PRENOM, 'marcq.v1.prenom');
  assert.equal(etat.CLE_FAITS, 'marcq.v1.faits');
  assert.equal(globalThis.localStorage.getItem('marcq.v1.prenom'), 'Lucas');
  assert.equal(
    globalThis.localStorage.getItem('marcq.v1.faits'),
    '{"s1-r1":"2026-08-03T18:22:11.000Z"}',
  );
});

test('cocher pose un horodatage, decocher supprime la cle', () => {
  assert.deepEqual(etat.lireFaits(), {}, 'aucune progression au depart');
  assert.deepEqual(etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z'), {
    's1-r1': '2026-08-03T18:22:11.000Z',
  });
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
  assert.deepEqual(etat.decocher('s1-r1'), {}, 'decocher ne laisse pas un booleen derriere lui');
  assert.deepEqual(etat.lireFaits(), {});
});

test('recocher ne rajeunit pas la marque (PRD §9 : le premier arrive a ce score)', () => {
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  etat.cocher('s1-r1', '2026-08-20T09:00:00.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
});

test('cocher sans horodatage prend l heure courante, au format ISO', () => {
  etat.cocher('s2-c1');
  assert.match(etat.lireFaits()['s2-c1'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('une progression illisible ou d un autre schema rend un objet vide', () => {
  poserMagasin(fauxMagasin({ 'marcq.v1.faits': '{ceci n est pas du JSON' }));
  assert.deepEqual(etat.lireFaits(), {});

  poserMagasin(fauxMagasin({ 'marcq.v1.faits': '["s1-r1"]' }));
  assert.deepEqual(etat.lireFaits(), {}, 'un tableau n est pas la forme attendue');

  poserMagasin(fauxMagasin({
    'marcq.v1.faits': '{"s1-r1": true, "s1-r2": "2026-08-03T18:22:11.000Z"}',
  }));
  assert.deepEqual(
    etat.lireFaits(),
    { 's1-r2': '2026-08-03T18:22:11.000Z' },
    'les couples mal formes sont ignores, les autres survivent',
  );
});

test('changer d enfant efface toutes les cles marcq, et rien d autre (PRD §7.2)', () => {
  poserMagasin(fauxMagasin({
    'marcq.v1.prenom': 'Lucas',
    'marcq.v1.faits': '{"s1-r1":"2026-08-03T18:22:11.000Z"}',
    'marcq.v1.classement': '{"pseudo":"Faucon"}',
    'marcq.v0.vieillerie': 'a jeter aussi',
    'autre-app.reglages': 'ne pas toucher',
  }));
  assert.equal(etat.toutEffacer(), 4, 'quatre cles marcq effacees, la cinquieme est etrangere');
  assert.equal(etat.lirePrenom(), null);
  assert.deepEqual(etat.lireFaits(), {});
  assert.deepEqual(globalThis.localStorage.contenu(), { 'autre-app.reglages': 'ne pas toucher' });
});

test('un stockage refuse ne fait jamais lever, et la seance en cours continue', () => {
  // Navigation privee : l'acces a la propriete elle-meme leve.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('acces au stockage refuse'); },
  });

  assert.equal(etat.lirePrenom(), null, 'rien n a jamais ete ecrit');
  assert.deepEqual(etat.lireFaits(), {});
  assert.equal(etat.ecrirePrenom('Lucas'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas', 'sans repli, l accueil redemanderait le prenom en boucle');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
  etat.decocher('s1-r1');
  assert.deepEqual(etat.lireFaits(), {});
  // Le prenom et la progression sont deux cles, toutes deux dans le repli.
  assert.equal(etat.toutEffacer(), 2, 'ce qui est garde en memoire part aussi');
  assert.equal(etat.lirePrenom(), null);
});

test('un quota plein n empeche pas de finir la seance', () => {
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

  assert.equal(etat.ecrirePrenom('Lucas'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas', 'garde en memoire, relu en priorite');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
});
