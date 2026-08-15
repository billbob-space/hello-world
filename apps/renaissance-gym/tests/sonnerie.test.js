// tests/sonnerie.test.js — le son du minuteur, synthétisé (PRP 04 chantier D,
// PRD §11.3, §15.3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as sonnerie from '../web/sonnerie.js';

afterEach(() => {
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  delete globalThis.navigator;
});

// --- le visuel porte toujours l’information complète : le son n’est jamais
// nécessaire, et ne doit donc jamais lever. -----------------------------------

test('sans AudioContext (node --test, iOS récalcitrant), rien ne lève jamais', () => {
  assert.doesNotThrow(() => sonnerie.debloquerAudio());
  assert.doesNotThrow(() => sonnerie.bip(440));
  assert.doesNotThrow(() => sonnerie.sonnerie());
  assert.equal(sonnerie.estDisponible(), false);
});

test('les quatre exports sont des fonctions', () => {
  assert.equal(typeof sonnerie.debloquerAudio, 'function');
  assert.equal(typeof sonnerie.bip, 'function');
  assert.equal(typeof sonnerie.sonnerie, 'function');
  assert.equal(typeof sonnerie.estDisponible, 'function');
});

// --- deux sons distincts, pas trois nuances : les trois derniers bips
// montent, la sonnerie de fin se distingue par le RYTHME, jamais par la
// hauteur (« Ajouté après les PRP », A2 : un haut-parleur de téléphone ne
// restitue presque rien sous la bande où vivent les bips). -------------------

test('FREQUENCES_BIP est strictement croissante — les trois derniers bips montent', () => {
  assert.equal(sonnerie.FREQUENCES_BIP.length, 3);
  for (let i = 1; i < sonnerie.FREQUENCES_BIP.length; i += 1) {
    assert.ok(sonnerie.FREQUENCES_BIP[i] > sonnerie.FREQUENCES_BIP[i - 1], 'les bips doivent monter');
  }
});

test('A2 : FREQUENCE_SONNERIE reste dans la bande efficace d’un petit haut-parleur, pas en dessous des bips', () => {
  // Le défaut corrigé était une note plus BASSE que les bips ; la sonnerie ne
  // doit plus jamais redescendre sous le plus grave d’entre eux.
  assert.ok(sonnerie.FREQUENCE_SONNERIE >= Math.min(...sonnerie.FREQUENCES_BIP));
});

test('A2 : la sonnerie est une répétition d’impulsions, pas une note unique', () => {
  assert.ok(sonnerie.NB_IMPULSIONS_SONNERIE > 1, 'une seule impulsion ne serait pas « répétée »');
});

test('A2 : la sonnerie est sensiblement plus forte que les bips', () => {
  assert.ok(sonnerie.GAIN_SONNERIE > sonnerie.GAIN_BIP);
});

test('A2 : le motif de vibration alterne au moins deux pulsations', () => {
  assert.ok(Array.isArray(sonnerie.MOTIF_VIBRATION));
  assert.ok(sonnerie.MOTIF_VIBRATION.filter((_, i) => i % 2 === 0).length > 1, 'au moins deux segments « vibre »');
});

// --- avec un AudioContext factice : verifie le cablage, sans navigateur -----

class GainFactice {
  constructor() { this.gain = new ParametreAudioFactice(); }
  connect() {}
}
class ParametreAudioFactice {
  constructor() { this.value = 0; this.appels = []; }
  setValueAtTime(v, t) { this.appels.push(['set', v, t]); this.value = v; }
  exponentialRampToValueAtTime(v, t) { this.appels.push(['rampe', v, t]); this.value = v; }
}
class OscillateurFactice {
  constructor(journal) { this.frequency = { value: 0 }; this.journal = journal; }
  connect() {}
  start(t) { this.journal.push(['start', t]); }
  stop(t) { this.journal.push(['stop', t]); }
}
class ContexteAudioFactice {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.journal = [];
  }
  createOscillator() { const o = new OscillateurFactice(this.journal); this._dernier = o; return o; }
  createGain() { return new GainFactice(); }
  get destination() { return {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

// --- A2 : la sonnerie planifie plusieurs impulsions distinctes -------------
//
// Doit tourner AVANT tout autre test de ce fichier qui active un
// AudioContext : `obtenirContexte()` met en cache le premier contexte
// construit et le réutilise ensuite pour toute la durée du module, y compris
// entre les tests (aucune fonction publique de sonnerie.js ne le réinitialise
// — ce n'est pas un défaut à corriger ici, juste une contrainte d'ordre pour
// ce test précis, qui a besoin d'observer SON PROPRE contexte factice).

test('A2 : sonnerie() demarre NB_IMPULSIONS_SONNERIE oscillateurs, a des instants differents', () => {
  // `jouer()` ne consulte jamais `ctx.state` (seul `estDisponible()` le
  // fait) : inutile de forcer « running » ici, et le laisser à sa valeur de
  // départ garde le contexte mis en cache cohérent pour le test suivant.
  const ctx = new ContexteAudioFactice();
  globalThis.AudioContext = function () { return ctx; };

  sonnerie.sonnerie();

  const departs = ctx.journal.filter(([evt]) => evt === 'start').map(([, t]) => t);
  assert.equal(departs.length, sonnerie.NB_IMPULSIONS_SONNERIE);
  const instantsDistincts = new Set(departs);
  assert.equal(instantsDistincts.size, departs.length, 'chaque impulsion doit partir a un instant different');
  // Chaque impulsion suivante part apres la precedente, jamais en meme temps
  // ni avant (c’est la repetition qui porte le rythme, PRD A2).
  for (let i = 1; i < departs.length; i += 1) {
    assert.ok(departs[i] > departs[i - 1]);
  }
});

test('debloquerAudio relance un contexte suspendu, estDisponible le reflete', async () => {
  globalThis.AudioContext = ContexteAudioFactice;
  assert.equal(sonnerie.estDisponible(), false, 'suspendu au depart');
  sonnerie.debloquerAudio();
  // resume() est asynchrone (Promise) : on laisse le microtask se resoudre.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sonnerie.estDisponible(), true);
});

test('bip et sonnerie jouent une note et s’arretent, sans jamais lever', async () => {
  globalThis.AudioContext = ContexteAudioFactice;
  sonnerie.debloquerAudio();
  await Promise.resolve();
  await Promise.resolve();

  assert.doesNotThrow(() => sonnerie.bip(660));
  assert.doesNotThrow(() => sonnerie.sonnerie());
});

// --- A2 : le second canal, jamais une condition pour que le son joue -------

test('A2 : sonnerie() declenche navigator.vibrate quand l’interface existe', () => {
  const appels = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { vibrate: (motif) => { appels.push(motif); return true; } },
  });

  assert.doesNotThrow(() => sonnerie.sonnerie());
  assert.deepEqual(appels, [sonnerie.MOTIF_VIBRATION]);
});

test('A2 : sans navigator.vibrate, sonnerie() ne lance jamais et ne tente rien', () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  assert.doesNotThrow(() => sonnerie.sonnerie());
});

test('A2 : sans navigator du tout, sonnerie() ne lance jamais', () => {
  delete globalThis.navigator;
  assert.doesNotThrow(() => sonnerie.sonnerie());
});

test('A2 : ni l’audio ni la vibration ne sont disponibles, sonnerie() ne lance toujours jamais', () => {
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  delete globalThis.navigator;
  assert.doesNotThrow(() => sonnerie.sonnerie());
  assert.doesNotThrow(() => sonnerie.bip(440));
});

test('A2 : une vibration qui lève est rattrapée, sans jamais remonter', () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { vibrate: () => { throw new Error('vibration refusée'); } },
  });
  assert.doesNotThrow(() => sonnerie.sonnerie());
});
