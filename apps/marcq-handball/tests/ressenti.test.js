// tests/ressenti.test.js — le vocabulaire du ressenti, son filtrage, son envoi.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ressenti from '../web/ressenti.js';
import * as etat from '../web/etat.js';
import * as domaine from '../web/domaine.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const prog = domaine.chargerProgramme(
  JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8')),
);

function poserMagasin(m) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: m });
}
function fauxMagasin(initial = {}) {
  const d = new Map(Object.entries(initial));
  return {
    get length() { return d.size; },
    key(i) { return [...d.keys()][i] ?? null; },
    getItem(c) { return d.has(c) ? d.get(c) : null; },
    setItem(c, v) { d.set(String(c), String(v)); },
    removeItem(c) { d.delete(c); },
    contenu() { return Object.fromEntries(d); },
  };
}

beforeEach(() => { poserMagasin(fauxMagasin()); etat.toutEffacer(); });

// --- le vocabulaire ---------------------------------------------------------

test('trois choix, du plus leger au plus dur, et les cles sont celles du serveur', () => {
  // facile, correct, dur : le serveur les valide en dur. Les renommer cote
  // client ferait repondre 400 a chaque envoi d'un enfant qui a repondu, sans
  // qu'aucun test de comportement ne tombe.
  assert.deepEqual(ressenti.CLES_RESSENTI, ['facile', 'correct', 'dur']);
  assert.equal(ressenti.RESSENTIS.length, 3);
  for (const r of ressenti.RESSENTIS) {
    assert.ok(r.emoji && r.libelle, `${r.cle} : emoji et libelle`);
  }
  assert.equal(ressenti.estRessentiValide('dur'), true);
  assert.equal(ressenti.estRessentiValide('bof'), false);
  assert.equal(ressenti.estRessentiValide(undefined), false);
});

test('l aide dit qu on peut ne pas repondre', () => {
  // Un enfant devant trois boutons ne devine pas qu'il peut fermer.
  assert.match(ressenti.AIDE_RESSENTI, /sans répondre/);
});

// --- le stockage ------------------------------------------------------------

test('les ressentis se lisent meme absents, meme illisibles', () => {
  assert.deepEqual(etat.lireRessentis(), {});
  poserMagasin(fauxMagasin({ 'marcq.v1.ressenti': '{{' }));
  assert.deepEqual(etat.lireRessentis(), {});
  poserMagasin(fauxMagasin({ 'marcq.v1.ressenti': '{"2026-08-03":"dur","x":5}' }));
  assert.deepEqual(etat.lireRessentis(), { '2026-08-03': 'dur' },
    'les couples mal formes sont ignores, les autres survivent');
});

test('une reponse REMPLACE celle du jour, et s efface', () => {
  etat.ecrireRessenti('2026-08-03', 'dur');
  assert.deepEqual(JSON.parse(globalThis.localStorage.contenu()['marcq.v1.ressenti']), { '2026-08-03': 'dur' });
  // Un horodatage departage un classement ; une reponse est juste la derniere
  // donnee.
  etat.ecrireRessenti('2026-08-03', 'facile');
  assert.deepEqual(etat.lireRessentis(), { '2026-08-03': 'facile' });
  etat.effacerRessenti('2026-08-03');
  assert.deepEqual(etat.lireRessentis(), {});
});

test('changer d enfant emporte aussi le ressenti', () => {
  etat.ecrirePrenom('Lucas');
  etat.ecrireRessenti('2026-08-03', 'dur');
  etat.toutEffacer();
  assert.deepEqual(etat.lireRessentis(), {});
});

// --- le filtre --------------------------------------------------------------

test('seul ce que le serveur accepte a le droit de partir', () => {
  // Le serveur refuse le champ EN BLOC : une entree deformee ne perd pas le
  // ressenti, elle perd l'envoi ENTIER, classement compris, et l'enfant sort du
  // podium sans qu'aucun ecran ne l'explique.
  const garde = ressenti.ressentisPourEnvoi(prog, {
    '2026-08-03': 'correct',
    '2026-08-04': 'dur',   // pas une seance
    '2026-08-05': 'bof',   // pas une valeur
  });
  assert.deepEqual(garde, { '2026-08-03': 'correct' });
  assert.deepEqual(ressenti.ressentisPourEnvoi(prog, {}), {});
  assert.deepEqual(ressenti.ressentisPourEnvoi(prog, null), {});
  assert.deepEqual(ressenti.ressentisPourEnvoi(null, { '2026-08-03': 'dur' }), {});
});

test('l empreinte change des que quelque chose change, et ignore l ordre', () => {
  assert.equal(ressenti.empreinteRessentis({}), '');
  const a = ressenti.empreinteRessentis({ '2026-08-03': 'correct', '2026-08-05': 'dur' });
  const b = ressenti.empreinteRessentis({ '2026-08-05': 'dur', '2026-08-03': 'correct' });
  assert.equal(a, b, 'deux objets de memes couples rendent la meme chaine');
  assert.equal(a, '2026-08-03=correct,2026-08-05=dur');
  assert.notEqual(a, ressenti.empreinteRessentis({ '2026-08-03': 'dur', '2026-08-05': 'dur' }));
});

// --- la ligne d emojis ------------------------------------------------------

function faussElement() {
  const n = {
    enfants: [], dataset: {}, className: '',
    append(...e) { this.enfants.push(...e); },
    setAttribute(k, v) { this[k] = v; },
    addEventListener(nom, fn) { if (nom === 'click') this.cliquer = fn; },
  };
  return n;
}

test('un seul tap ecrit et ferme, dans cet ordre', () => {
  globalThis.document = { createElement: () => faussElement() };
  const ecrits = [];
  const fermetures = [];
  const hote = faussElement();

  ressenti.monterRessenti(hote, '2026-08-03', {
    lire: () => ({}),
    ecrire: (d, v) => { ecrits.push([d, v]); },
    surChoix: () => fermetures.push(ecrits.length),
  });

  const bloc = hote.enfants[0];
  const choix = bloc.enfants.find((e) => e.className === 'ressenti-choix');
  assert.equal(choix.enfants.length, 3, 'trois boutons');

  choix.enfants[2].cliquer();
  assert.deepEqual(ecrits, [['2026-08-03', 'dur']]);
  assert.deepEqual(fermetures, [1], 'surChoix est appele APRES l ecriture, une seule fois');
});

test('une reponse deja donnee se voit', () => {
  globalThis.document = { createElement: () => faussElement() };
  const hote = faussElement();
  ressenti.monterRessenti(hote, '2026-08-03', {
    lire: () => ({ '2026-08-03': 'correct' }),
    ecrire: () => {}, surChoix: () => {},
  });
  const choix = hote.enfants[0].enfants.find((e) => e.className === 'ressenti-choix');
  assert.deepEqual(choix.enfants.map((b) => b['aria-pressed']), ['false', 'true', 'false']);
  assert.ok(choix.enfants[1].className.includes('choisi'));
});

// --- les garde-fous de source ----------------------------------------------

test('ressenti.js n importe rien, et ne connait pas le nom garde sur le telephone', () => {
  const code = source('ressenti.js');
  assert.equal(/^import\s/m.test(code), false, 'aucun import : ni stockage, ni vue');
  assert.equal(code.includes('prenom'), false);
  assert.equal(code.includes('innerHTML'), false);
  assert.equal(code.includes('confirm('), false);
});

test('la question est posee ENTRE les compteurs et le bouton de fermeture', () => {
  // Le PRP 06 l'exige : deux panneaux modaux ouverts sur le meme evenement,
  // c'est un panneau invisible et un enfant coince.
  const code = source('recompenses.js');
  assert.ok(code.includes('monterRessenti('), 'le panneau pose la question');
  assert.ok(
    code.indexOf('carte.append(liste)') < code.indexOf('monterRessenti('),
    'apres les compteurs',
  );
  assert.ok(
    code.indexOf('monterRessenti(') < code.indexOf('fin-fermer'),
    'avant le bouton de fermeture',
  );
  // Sans autofocus, showModal focalise le premier bouton — un emoji — et une
  // touche Entree machinale enregistrerait « Facile ».
  assert.ok(code.includes('bouton.autofocus = true'));
});
