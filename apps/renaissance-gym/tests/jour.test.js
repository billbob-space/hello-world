// tests/jour.test.js — l'écran du jour (PRP 04 chantier A, PRD §7.2 ; A5 et
// A9, « Ajouté après les PRP »).
//
// A5 a corrigé le §8.5 et la règle §9.6 : la semaine n'avance plus sur le
// calendrier, elle avance quand ses quatre séances sont faites — et encore,
// pas directement : tant qu'elle n'a rien commencé de la nouvelle semaine,
// l'écran reste sur le palier « bouclée », qui ne se quitte que d'un geste
// explicite et confirmé. Ces tests remplacent ceux qui auraient fait avancer
// une horloge de sept jours en sept jours.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/programme.js';
import { modeleJour, monterJour } from '../web/vue-jour.js';
import * as etat from '../web/etat.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const prog = chargerProgramme(JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
));

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

function fait(exercice, semaine, seance, a = '2026-08-03T09:00:00.000Z') {
  return { exercice, semaine, seance, a };
}

function faitsSemaineComplete(semaine, a) {
  return prog.seances.flatMap((s) => s.exercices.map((id) => fait(id, semaine, Number(s.id.slice(1)), a)));
}

function ctxAvec({
  faits = [], semaineDeDepart = 1, bilan = null, alea,
} = {}) {
  return {
    etat: { ...etat.ETAT_VIDE, faits, semaineDeDepart, bilan },
    programme: prog,
    maintenant: () => new Date('2026-08-14T09:00:00.000Z'),
    alea,
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.effacerEtat();
  poserDocumentFactice();
  globalThis.location = { hash: '#/jour' };
});

// --- modeleJour, pur ---------------------------------------------------------

test('modeleJour rend « a-faire », semaine 1, séance 1, quand rien n’est fait (A5 : plus de calendrier)', () => {
  const m = modeleJour(ctxAvec());
  assert.equal(m.cas, 'a-faire');
  assert.equal(m.semaine, 1);
  assert.equal(m.numero, 1);
});

test('A9 : « après » annonce la séance suivante quand ce n’est pas la dernière de la semaine', () => {
  const m = modeleJour(ctxAvec());
  const s2 = prog.seances.find((s) => s.id === 's2');
  assert.equal(m.apres, `Après, ce sera ${s2.nom}.`);
});

test('A9 : sur la dernière séance d’une semaine, « après » annonce la semaine suivante', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const s2 = prog.seances.find((s) => s.id === 's2');
  const s3 = prog.seances.find((s) => s.id === 's3');
  const faits = [
    ...s1.exercices.map((id) => fait(id, 1, 1)),
    ...s2.exercices.map((id) => fait(id, 1, 2)),
    ...s3.exercices.map((id) => fait(id, 1, 3)),
  ];
  const m = modeleJour(ctxAvec({ faits }));
  assert.equal(m.numero, 4, 'garde-fou : il ne doit rester que la 4e séance');
  assert.equal(m.apres, 'Après, ce sera la semaine 2.');
});

test('A9 : à la dernière semaine, « après » annonce la fin du programme plutôt qu’une neuvième semaine', () => {
  const septSemaines = Array.from({ length: 7 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  const s1 = prog.seances.find((s) => s.id === 's1');
  const s2 = prog.seances.find((s) => s.id === 's2');
  const s3 = prog.seances.find((s) => s.id === 's3');
  const faits = [
    ...septSemaines,
    ...s1.exercices.map((id) => fait(id, 8, 1)),
    ...s2.exercices.map((id) => fait(id, 8, 2)),
    ...s3.exercices.map((id) => fait(id, 8, 3)),
  ];
  const m = modeleJour(ctxAvec({ faits }));
  assert.equal(m.semaine, 8);
  assert.equal(m.numero, 4);
  assert.equal(m.apres, 'Après, ton programme sera terminé.');
});

test('A5 : une semaine entièrement faite ouvre le palier « bouclee », jamais directement la suivante', () => {
  const faits = faitsSemaineComplete(1);
  const m = modeleJour(ctxAvec({ faits }));
  assert.equal(m.cas, 'bouclee');
  assert.equal(m.semaine, 1, 'la semaine qu’elle vient de boucler');
  assert.equal(m.semaineSuivante, 2);
  const s1 = prog.seances.find((s) => s.id === 's1');
  assert.equal(m.nomSuivant, s1.nom);
});

test('A5 : le palier « bouclee » disparait dès qu’un seul exercice de la nouvelle semaine est validé', () => {
  const faits = [...faitsSemaineComplete(1), fait(prog.seances[0].exercices[0], 2, 1, '2026-08-10T09:00:00.000Z')];
  const m = modeleJour(ctxAvec({ faits }));
  assert.equal(m.cas, 'a-faire');
  assert.equal(m.semaine, 2);
});

test('le programme terminé (huit semaines entièrement faites) rend le cas « termine »', () => {
  const faits = Array.from({ length: 8 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  const m = modeleJour(ctxAvec({ faits }));
  assert.equal(m.cas, 'termine');
});

// --- monterJour, le DOM -------------------------------------------------------

test('le cas « a-faire » affiche la ligne discrète « après », sans jamais de pourcentage ni de total', () => {
  const hote = creerHote();
  monterJour(hote, ctxAvec());
  const apres = hote.querySelector('.apres-jour');
  assert.ok(apres, 'la ligne « après » doit exister');
  assert.match(apres.textContent, /^Après, ce sera /);
});

test('A5 : le palier « bouclee » propose un geste explicite ET confirmé pour passer à la semaine suivante', () => {
  const hote = creerHote();
  const faits = faitsSemaineComplete(1);
  monterJour(hote, ctxAvec({ faits }));

  const continuer = hote.querySelectorAll('.bouton').find((b) => b.textContent.startsWith('Semaine suivante'));
  assert.ok(continuer, 'le bouton « Semaine suivante » doit exister');

  // Rien ne navigue avant la confirmation : le simple appui ouvre le
  // bandeau, il ne fait pas encore avancer la semaine.
  continuer.declencher('click');
  assert.equal(globalThis.location.hash, '#/jour', 'aucune navigation avant confirmation');
  const question = hote.querySelector('.confirmation-case__question');
  assert.ok(question, 'une confirmation doit s’ouvrir');
  assert.match(question.textContent, /Passer à la semaine 2/);

  const oui = hote.querySelectorAll('.bouton').find((b) => b.textContent === 'Oui');
  oui.declencher('click');
  assert.equal(globalThis.location.hash, '#/seance/1', 'confirmer lance la première séance de la semaine suivante');
});

// --- A21 : « Refaire une séance », de retour sur l'écran « ta semaine est
// bouclée » — retirée par A5 parce que « #/seance/<numero> » désignait une
// séance SANS SA SEMAINE. -----------------------------------------------------

test('A21 : « Refaire une séance » existe sur le palier « bouclee » et rejoue la première séance de LA SEMAINE BOUCLÉE, pas la semaine suivante', () => {
  const hote = creerHote();
  const faits = faitsSemaineComplete(1);
  monterJour(hote, ctxAvec({ faits }));

  const refaire = hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Refaire une séance');
  assert.ok(refaire, 'le bouton doit exister sur l’écran « ta semaine est bouclée »');

  refaire.declencher('click');
  assert.equal(
    globalThis.location.hash,
    '#/seance/1/1',
    'la séance ET sa semaine — celle qui vient d’être bouclée (1), jamais la semaine suivante (2)',
  );
});

test('« Refaire une séance » n’apparaît que sur le palier « bouclee », jamais sur « a-faire »', () => {
  const hote = creerHote();
  monterJour(hote, ctxAvec());
  const refaire = hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Refaire une séance');
  assert.equal(refaire, undefined);
});

test('« Non » referme la confirmation sans jamais naviguer', () => {
  const hote = creerHote();
  const faits = faitsSemaineComplete(1);
  monterJour(hote, ctxAvec({ faits }));

  hote.querySelectorAll('.bouton').find((b) => b.textContent.startsWith('Semaine suivante')).declencher('click');
  hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Non').declencher('click');

  assert.equal(globalThis.location.hash, '#/jour');
  assert.equal(hote.querySelectorAll('.confirmation-case__question').length, 0);
});

// --- ossature §5.3 : le rang de strass est réservé à la semaine bouclée et
// aux badges, jamais à l'effort (voir tests/seance.test.js pour l'interdit
// symétrique sur vue-seance.js). --------------------------------------------

test('le cas « bouclee » monte le rang de strass', () => {
  const hote = creerHote();
  const faits = faitsSemaineComplete(1);
  monterJour(hote, ctxAvec({ faits }));
  assert.ok(hote.querySelectorAll('.strass').length > 0);
});

test('le cas « a-faire » ne monte jamais le rang de strass : ce n’est pas un acquis', () => {
  const hote = creerHote();
  monterJour(hote, ctxAvec());
  assert.equal(hote.querySelectorAll('.strass').length, 0);
});

// --- A13 (lot ludique) : un lien mène au justaucorps -------------------------

test('un lien mène au justaucorps, depuis n’importe quel état de l’écran du jour', () => {
  for (const ctx of [ctxAvec(), ctxAvec({ faits: faitsSemaineComplete(1) })]) {
    const hote = creerHote();
    monterJour(hote, ctx);
    const lien = hote.querySelectorAll('a').find((a) => a.href === '#/justaucorps');
    assert.ok(lien, 'garde-fou : le lien vers le justaucorps doit toujours exister');
  }
});

// --- A15 (« Ajouté après les PRP », lot ludique) : « Un exercice au hasard »

test('« Un exercice au hasard » existe sur l’écran du jour, quel que soit son état', () => {
  const huitSemaines = Array.from({ length: 8 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  for (const ctx of [ctxAvec(), ctxAvec({ faits: faitsSemaineComplete(1) }), ctxAvec({ faits: huitSemaines })]) {
    const hote = creerHote();
    monterJour(hote, ctx);
    const bouton = hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Un exercice au hasard');
    assert.ok(bouton, 'garde-fou : le bouton doit toujours exister — même semaine bouclée, même programme terminé');
  }
});

test('« Un exercice au hasard » tire parmi les trente-six et route vers l’écran de séance marqué « hasard »', () => {
  const hote = creerHote();
  monterJour(hote, ctxAvec({ alea: () => 0 }));

  hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Un exercice au hasard').declencher('click');

  assert.match(globalThis.location.hash, /^#\/seance\/[1-4]\/e\d+\/1\/hasard$/);
});

test('« Un exercice au hasard » reçoit son aléa depuis le contexte, jamais Math.random en dur dans la vue', () => {
  const hote1 = creerHote();
  monterJour(hote1, ctxAvec({ alea: () => 0 }));
  hote1.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Un exercice au hasard').declencher('click');
  const premier = globalThis.location.hash;

  globalThis.location = { hash: '#/jour' };
  const hote2 = creerHote();
  monterJour(hote2, ctxAvec({ alea: () => 0.999999 }));
  hote2.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'Un exercice au hasard').declencher('click');
  const second = globalThis.location.hash;

  assert.notEqual(premier, second, 'deux alea différents doivent pouvoir tirer deux exercices différents');
});

// --- A17 (« Ajouté après les PRP », lot ludique) : le bilan des huit semaines

test('le programme terminé fige le bilan UNE SEULE FOIS, et propose de le voir', () => {
  const huitSemaines = Array.from({ length: 8 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  const hote = creerHote();
  monterJour(hote, ctxAvec({ faits: huitSemaines }));

  const bilan = etat.lireEtat().bilan;
  assert.ok(bilan, 'le bilan doit être écrit dès la première fois que « termine » se constate');
  assert.equal(bilan.seancesFaites, 32);

  const versBilan = hote.querySelectorAll('.bouton').find((b) => b.textContent === 'Voir ton été');
  assert.ok(versBilan, 'un bouton doit proposer de voir le bilan');
  versBilan.declencher('click');
  assert.equal(globalThis.location.hash, '#/bilan');
});

test('le bilan déjà figé n’est jamais recalculé à un second montage du cas « termine »', () => {
  const huitSemaines = Array.from({ length: 8 }, (_, i) => faitsSemaineComplete(i + 1)).flat();
  const hote1 = creerHote();
  monterJour(hote1, ctxAvec({ faits: huitSemaines }));
  const premierBilan = etat.lireEtat().bilan;

  const hote2 = creerHote();
  monterJour(hote2, ctxAvec({ faits: huitSemaines, bilan: premierBilan }));
  assert.deepEqual(etat.lireEtat().bilan, premierBilan, 'rien ne doit avoir bougé');
});

test('le bilan, une fois figé, reste accessible depuis l’écran du jour même hors du cas « termine » (nouveau programme redémarré)', () => {
  const bilanExistant = {
    seancesFaites: 32, exercicesFaits: 288, records: etat.ETAT_VIDE.records, dateISO: '2026-08-14T09:00:00.000Z',
  };
  const hote = creerHote();
  // Faits vides, semaine 1 : un programme qui vient de « recommencer à zéro »
  // (vue-grille.js) — le bilan, lui, n'est jamais effacé par ce geste.
  monterJour(hote, ctxAvec({ faits: [], bilan: bilanExistant }));

  const lien = hote.querySelectorAll('a').find((a) => a.href === '#/bilan');
  assert.ok(lien, 'le lien vers le bilan doit rester accessible même en dehors du cas « termine »');
});

test('sans bilan, aucun lien ne le propose — rien à montrer avant l’heure', () => {
  const hote = creerHote();
  monterJour(hote, ctxAvec());
  const lien = hote.querySelectorAll('a').find((a) => a.href === '#/bilan');
  assert.equal(lien, undefined);
});
