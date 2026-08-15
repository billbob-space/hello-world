// tests/liste.test.js — A8 (« Ajouté après les PRP ») : la liste des trente-
// six exercices, atteignable depuis la grille et les réglages.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme, objectifTexte } from '../web/programme.js';
import { monterListe } from '../web/vue-liste.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const prog = chargerProgramme(JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
));

function fait(exercice, semaine, seance, a = '2026-08-03T09:00:00.000Z') {
  return { exercice, semaine, seance, a };
}

function ctxAvec({ faits = [], semaineDeDepart = 1 } = {}) {
  return { etat: { faits, semaineDeDepart }, programme: prog };
}

function texteDe(noeud) {
  let t = noeud.textContent ?? '';
  for (const enfant of noeud.children ?? []) t += texteDe(enfant);
  return t;
}

beforeEach(() => {
  poserDocumentFactice();
  globalThis.location = { hash: '#/liste' };
});

test('les trente-six exercices sont tous là, dans l’ordre du fichier, et rien de plus', () => {
  const hote = creerHote();
  monterListe(hote, ctxAvec());

  const lignes = hote.querySelectorAll('.ligne-programme');
  assert.equal(lignes.length, 36);
  const noms = lignes.map((l) => l.querySelector('.ligne-programme__nom').textContent);
  assert.deepEqual(noms, prog.exercices.map((ex) => ex.libelle));
});

test('les exercices sont groupés par famille, comme sur les deux pages d’origine', () => {
  const hote = creerHote();
  monterListe(hote, ctxAvec());

  const groupes = hote.querySelectorAll('.groupe-programme');
  assert.equal(groupes.length, prog.familles.length);
  const titres = groupes.map((g) => g.querySelector('.groupe-programme__titre').textContent);
  assert.deepEqual(titres, prog.familles.map((f) => f.nom));

  // Chaque groupe porte exactement les exercices de sa famille, dans l’ordre
  // du fichier de données.
  for (const [i, f] of prog.familles.entries()) {
    const attendu = prog.exercices.filter((ex) => ex.famille === f.id).map((ex) => ex.libelle);
    const rendu = groupes[i].querySelectorAll('.ligne-programme__nom').map((n) => n.textContent);
    assert.deepEqual(rendu, attendu, `famille ${f.nom}`);
  }
});

test('chaque ligne porte l’objectif de la semaine en cours, jamais une valeur en dur', () => {
  const hote = creerHote();
  monterListe(hote, ctxAvec({ semaineDeDepart: 8 })); // rien de fait : la semaine courante est la 8e

  const lignes = hote.querySelectorAll('.ligne-programme');
  const objectifs = lignes.map((l) => l.querySelector('.ligne-programme__objectif').textContent);
  const attendus = prog.exercices.map((ex) => objectifTexte(ex, 8));
  assert.deepEqual(objectifs, attendus);
});

test('un exercice fait au moins une fois cette semaine est marqué, un exercice pas fait ne l’est pas', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const premier = s1.exercices[0];
  const hote = creerHote();
  monterListe(hote, ctxAvec({ faits: [fait(premier, 1, 1)] }));

  const faites = hote.querySelectorAll('.ligne-programme--fait');
  assert.equal(faites.length, 1, 'un seul exercice a été validé cette semaine');
  assert.equal(faites[0].querySelector('.ligne-programme__nom').textContent, prog.exercices.find((ex) => ex.id === premier).libelle);
});

test('un exercice repris dans une autre séance de la même semaine (PRD §8.4) est marqué fait lui aussi', () => {
  // e29 (« Écart jambe droite ») est à la fois dans la séance 1 et la
  // séance 4 : validé via la 4, il doit compter pour la liste.
  const hote = creerHote();
  monterListe(hote, ctxAvec({ faits: [fait('e29', 1, 4)] }));

  const ligneE29 = hote.querySelectorAll('.ligne-programme')
    .find((l) => l.querySelector('.ligne-programme__nom').textContent === 'Écart jambe droite');
  assert.ok(ligneE29.className.includes('ligne-programme--fait'));
});

test('un exercice fait une semaine passée ne compte pas pour la semaine en cours', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const premier = s1.exercices[0];
  const hote = creerHote();
  // Semaine de départ 3 : la semaine courante est la 3e ; un fait à la 1re
  // (avant qu'elle n'ait choisi de commencer là) ne doit rien marquer.
  monterListe(hote, ctxAvec({ semaineDeDepart: 3, faits: [fait(premier, 1, 1)] }));

  assert.equal(hote.querySelectorAll('.ligne-programme--fait').length, 0);
});

// --- ce qui reste interdit (PRD §4, §14, A8) --------------------------------

test('aucun compteur, pourcentage ni classement nulle part sur cet écran', () => {
  const hote = creerHote();
  monterListe(hote, ctxAvec());
  const texte = texteDe(hote);
  assert.doesNotMatch(texte, /%/);
  assert.doesNotMatch(texte, /moyenne/i);
  assert.doesNotMatch(texte, /\btotal\b/i);
  assert.doesNotMatch(texte, /classement/i);
});

// --- navigation --------------------------------------------------------------

test('un lien discret ramène à l’écran du jour', () => {
  const hote = creerHote();
  monterListe(hote, ctxAvec());
  const retour = hote.querySelectorAll('a').find((a) => a.href === '#/jour');
  assert.ok(retour, 'le lien de retour vers « #/jour » doit exister');
});

test('demonter() ne lève jamais', () => {
  const hote = creerHote();
  const demonter = monterListe(hote, ctxAvec());
  assert.doesNotThrow(() => demonter());
});
