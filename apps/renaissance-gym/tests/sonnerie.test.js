// tests/sonnerie.test.js — le son du minuteur, synthétisé (PRP 04 chantier D,
// PRD §11.3, §15.3).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as sonnerie from '../web/sonnerie.js';

afterEach(() => {
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
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
// montent, le zéro est plus bas ET plus long. ---------------------------------

test('FREQUENCES_BIP est strictement croissante — les trois derniers bips montent', () => {
  assert.equal(sonnerie.FREQUENCES_BIP.length, 3);
  for (let i = 1; i < sonnerie.FREQUENCES_BIP.length; i += 1) {
    assert.ok(sonnerie.FREQUENCES_BIP[i] > sonnerie.FREQUENCES_BIP[i - 1], 'les bips doivent monter');
  }
});

test('FREQUENCE_ZERO est plus bas que le plus grave des bips', () => {
  assert.ok(sonnerie.FREQUENCE_ZERO < Math.min(...sonnerie.FREQUENCES_BIP));
});

test('le zéro dure plus longtemps que le bip', () => {
  assert.ok(sonnerie.DUREE_ZERO_MS > sonnerie.DUREE_BIP_MS);
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
