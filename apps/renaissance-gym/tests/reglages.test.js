// tests/reglages.test.js — l'écran des réglages (PRP 05 chantier D, PRP 07
// chantier D ; A7 et A11, « Ajouté après les PRP »).
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as vueReglages from '../web/vue-reglages.js';
import * as sonnerie from '../web/sonnerie.js';
import * as etat from '../web/etat.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

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
  globalThis.location = { hash: '#/reglages' };
  delete globalThis.navigator?.wakeLock;
});

afterEach(() => {
  delete globalThis.navigator?.wakeLock;
});

function ctxDe() {
  return { maintenant: () => new Date('2026-08-14T09:00:00.000Z') };
}

function boutonAvecTexte(hote, texte) {
  return [...hote.querySelectorAll('.bouton'), ...hote.querySelectorAll('.bouton--discret'), ...hote.querySelectorAll('.choix-sonnerie')]
    .find((b) => b.textContent === texte) ?? null;
}

// --- A7 : choisir sa sonnerie, l’écouter depuis les réglages ----------------

test('les réglages proposent au moins trois sonneries, la sonnerie par défaut est présélectionnée', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const choix = hote.querySelectorAll('.choix-sonnerie');
  assert.equal(choix.length, sonnerie.SONNERIES.length);
  assert.ok(choix.length >= 3);

  const choisi = choix.find((b) => b.getAttribute('aria-pressed') === 'true');
  assert.ok(choisi, 'une sonnerie doit être présélectionnée');
  const defaut = sonnerie.SONNERIES.find((s) => s.id === sonnerie.SONNERIE_PAR_DEFAUT);
  assert.equal(choisi.textContent, defaut.nom);
});

test('choisir une sonnerie l’écrit dans l’état, et suit la fiche comme le reste (A7)', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const autre = sonnerie.SONNERIES.find((s) => s.id !== sonnerie.SONNERIE_PAR_DEFAUT);
  boutonAvecTexte(hote, autre.nom).declencher('click');

  assert.equal(etat.lireEtat().sonnerie, autre.id);
  const choisi = hote.querySelectorAll('.choix-sonnerie').find((b) => b.getAttribute('aria-pressed') === 'true');
  assert.equal(choisi.textContent, autre.nom, 'l’affichage suit le choix');
});

test('« L’écouter maintenant » joue la sonnerie choisie sans lancer de séance ni changer d’écran (A7)', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const ecouter = boutonAvecTexte(hote, 'L’écouter maintenant');
  assert.ok(ecouter, 'garde-fou : le bouton doit exister');
  assert.doesNotThrow(() => ecouter.declencher('click'));
  assert.equal(globalThis.location.hash, '#/reglages', 'aucune navigation ne se produit');
});

test('la phrase du volume média (PRD A7) est affichée mot pour mot', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const paragraphes = hote.querySelectorAll('p').map((p) => p.textContent);
  assert.ok(paragraphes.includes(vueReglages.PHRASE_VOLUME_MEDIA));
});

// --- A11 : garder l’écran allumé, vraiment, et pouvoir le dire --------------

test('l’option « écran allumé » est activée par défaut, et se coupe d’un geste', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  assert.equal(etat.lireEtat().ecranAllume, true);
  const toggle = hote.querySelectorAll('.bouton--discret').find((b) => b.textContent.includes('écran allumé'));
  assert.ok(toggle, 'garde-fou : le bouton doit exister');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');

  toggle.declencher('click');
  assert.equal(etat.lireEtat().ecranAllume, false);
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');

  toggle.declencher('click');
  assert.equal(etat.lireEtat().ecranAllume, true);
});

test('sans wakeLock dans ce navigateur, les réglages le disent franchement plutôt que de faire semblant (A11)', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  delete globalThis.navigator.wakeLock;
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const paragraphes = hote.querySelectorAll('p').map((p) => p.textContent);
  assert.ok(paragraphes.includes(vueReglages.PHRASE_ECRAN_INDISPONIBLE));
});

test('avec un wakeLock disponible, la phrase d’indisponibilité n’est pas affichée', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  Object.defineProperty(globalThis.navigator, 'wakeLock', {
    configurable: true,
    value: { request: async () => ({ release: async () => {} }) },
  });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const paragraphes = hote.querySelectorAll('p').map((p) => p.textContent);
  assert.ok(!paragraphes.includes(vueReglages.PHRASE_ECRAN_INDISPONIBLE));
  delete globalThis.navigator.wakeLock;
});

// --- A10 : changer sa semaine de départ, avec confirmation ------------------

test('les réglages proposent les huit mêmes cibles que l’écran d’entrée, la semaine actuelle est présélectionnée', () => {
  etat.ecrireEtat({ prenom: 'Léa', semaineDeDepart: 3 });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const cibles = hote.querySelectorAll('.cible-semaine');
  assert.equal(cibles.length, 8);
  assert.ok(cibles[2].classList.contains('choisi'), 'la semaine 3 doit être présélectionnée');
  assert.equal(cibles.filter((c) => c.classList.contains('choisi')).length, 1);
});

test('choisir une autre semaine ouvre une confirmation qui dit ce que cela déplace, avant d’écrire quoi que ce soit (A10)', () => {
  etat.ecrireEtat({ prenom: 'Léa', semaineDeDepart: 1 });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const cibles = hote.querySelectorAll('.cible-semaine');
  cibles[4].declencher('click'); // la semaine 5

  assert.equal(etat.lireEtat().semaineDeDepart, 1, 'rien n’est écrit avant confirmation');
  const question = hote.querySelector('.confirmation-case__question');
  assert.ok(question, 'une confirmation doit s’ouvrir');
  assert.match(question.textContent, /semaine 5/);
  assert.match(question.textContent, /Rien n’est effacé/);
});

test('confirmer change la semaine de départ, sans effacer les exercices déjà faits (A10)', () => {
  etat.ecrireEtat({
    prenom: 'Léa',
    semaineDeDepart: 1,
    faits: [{ seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-03T09:00:00.000Z' }],
  });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  hote.querySelectorAll('.cible-semaine')[4].declencher('click'); // semaine 5
  hote.querySelectorAll('.bouton').find((b) => b.textContent === 'Oui').declencher('click');

  const apres = etat.lireEtat();
  assert.equal(apres.semaineDeDepart, 5);
  assert.deepEqual(apres.faits, [{ seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-03T09:00:00.000Z' }], 'rien n’est effacé');

  const cibles = hote.querySelectorAll('.cible-semaine');
  assert.ok(cibles[4].classList.contains('choisi'), 'l’affichage suit le nouveau choix');
});

test('« Non » referme la confirmation sans rien changer', () => {
  etat.ecrireEtat({ prenom: 'Léa', semaineDeDepart: 1 });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  hote.querySelectorAll('.cible-semaine')[4].declencher('click');
  hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Non').declencher('click');

  assert.equal(etat.lireEtat().semaineDeDepart, 1);
  assert.equal(hote.querySelectorAll('.confirmation-case__question').length, 0);
});

test('choisir la semaine déjà en cours ne fait rien : ni écriture, ni confirmation', () => {
  etat.ecrireEtat({ prenom: 'Léa', semaineDeDepart: 3 });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  hote.querySelectorAll('.cible-semaine')[2].declencher('click'); // deja la semaine 3
  assert.equal(hote.querySelectorAll('.confirmation-case__question').length, 0);
});

// --- A19 (« Ajouté après les PRP », défaut de production remonté le
// 15 août 2026) : se déconnecter n'est pas effacer --------------------------

test('A19 : la déconnexion est présentée avant l’effacement définitif', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const boutons = hote.querySelectorAll('.bouton--discret').map((b) => b.textContent);
  const iDeco = boutons.indexOf('Se déconnecter de cet appareil');
  const iEffacer = boutons.indexOf('Effacer ma fiche définitivement');
  assert.ok(iDeco !== -1, 'garde-fou : le bouton de déconnexion doit exister');
  assert.ok(iEffacer !== -1, 'garde-fou : le bouton d’effacement définitif doit exister');
  assert.ok(iDeco < iEffacer, 'la déconnexion, réversible, est présentée en premier (PRD A19)');
});

test('A19 : « Se déconnecter de cet appareil » n’appelle JAMAIS l’effacement serveur', () => {
  etat.ecrireEtat({
    prenom: 'Léa', pseudo: 'Comète-7', code: '482913', faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-03T09:00:00.000Z',
    }],
  });
  let appelsFetch = 0;
  globalThis.fetch = async () => { appelsFetch += 1; return { ok: true, status: 204, json: async () => null }; };

  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());
  boutonAvecTexte(hote, 'Se déconnecter de cet appareil').declencher('click');

  assert.equal(appelsFetch, 0, 'la déconnexion locale ne doit jamais toucher au serveur');
  assert.equal(etat.lireEtat().prenom, null, 'l’état local est bien effacé');
  assert.equal(etat.lireEtat().faits.length, 0);
  assert.equal(globalThis.location.hash, '#/entree');

  delete globalThis.fetch;
});

test('A19 : « Se déconnecter » n’affiche aucune confirmation grave — geste ordinaire, réversible', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const paragraphes = hote.querySelectorAll('p').map((p) => p.textContent);
  assert.ok(paragraphes.includes(vueReglages.PHRASE_DECONNEXION));
  assert.ok(!paragraphes.includes(vueReglages.PHRASE_EFFACEMENT), 'la phrase grave n’apparaît qu’à l’effacement définitif');
});

test('A19 : « Effacer ma fiche définitivement » — confirmation grave, irréversible, pour tous les appareils', () => {
  etat.ecrireEtat({ prenom: 'Léa', pseudo: 'Comète-7', code: '482913' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());
  boutonAvecTexte(hote, 'Effacer ma fiche définitivement').declencher('click');

  const question = hote.querySelector('.confirmation-case__question');
  assert.ok(question, 'une confirmation doit s’ouvrir');
  assert.equal(question.textContent, vueReglages.PHRASE_EFFACEMENT);
  assert.match(question.textContent, /irréversible/);
  assert.match(question.textContent, /TOUS LES APPAREILS/);
});

test('A19 : confirmer l’effacement définitif appelle bien l’opération « effacer » du serveur', async () => {
  etat.ecrireEtat({ prenom: 'Léa', pseudo: 'Comète-7', code: '482913' });
  let appelsFetch = 0;
  let corpsEnvoye = null;
  globalThis.fetch = async (_url, options) => {
    appelsFetch += 1;
    corpsEnvoye = JSON.parse(options.body);
    return { ok: true, status: 204, json: async () => null };
  };

  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());
  boutonAvecTexte(hote, 'Effacer ma fiche définitivement').declencher('click');
  hote.querySelectorAll('.bouton').find((b) => b.textContent === 'Oui, tout effacer définitivement').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(appelsFetch, 1, 'l’effacement définitif doit appeler le serveur, contrairement à la déconnexion');
  assert.equal(corpsEnvoye.operation, 'effacer');
  assert.equal(etat.lireEtat().prenom, null);
  assert.equal(globalThis.location.hash, '#/entree');

  delete globalThis.fetch;
});

// --- A8 : la liste des trente-six exercices, aussi depuis les réglages -----

test('un lien mène à la liste des trente-six exercices', () => {
  etat.ecrireEtat({ prenom: 'Léa' });
  const hote = creerHote();
  vueReglages.monterReglages(hote, ctxDe());

  const lien = hote.querySelectorAll('a').find((a) => a.href === '#/liste');
  assert.ok(lien, 'un lien vers « #/liste » doit exister dans les réglages');
});
