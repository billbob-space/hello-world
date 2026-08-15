// tests/detail-seance.test.js — le détail d'une case de la grille (PRD, A3
// et A3 bis, « Ajouté après les PRP »).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chargerProgramme, exercicesDeSeance } from '../web/programme.js';
import * as vueDetail from '../web/vue-detail-seance.js';
import * as etat from '../web/etat.js';
import { seanceEstFaite } from '../web/domaine.js';
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
  globalThis.location = { hash: '#/grille/seance/2/1' };
});

function ctxDe(faits = []) {
  etat.ecrireEtat({ debut: '2026-08-03T08:00:00.000Z', semaineDeDepart: 1, faits });
  return { etat: etat.lireEtat(), programme: prog, maintenant: () => new Date('2026-08-14T09:00:00.000Z') };
}

function texteDe(noeud) {
  let t = noeud.textContent ?? '';
  for (const enfant of noeud.children ?? []) t += texteDe(enfant);
  return t;
}

// --- la route ----------------------------------------------------------------

test('cibleDepuisHash lit « #/grille/seance/<semaine>/<numero> », rend null sinon', () => {
  assert.deepEqual(vueDetail.cibleDepuisHash('#/grille/seance/3/2'), { semaine: 3, numero: 2 });
  assert.equal(vueDetail.cibleDepuisHash('#/grille/seance/9/2'), null, 'semaine hors bornes');
  assert.equal(vueDetail.cibleDepuisHash('#/grille/seance/3/5'), null, 'séance hors bornes');
  assert.equal(vueDetail.cibleDepuisHash('#/grille'), null);
  assert.equal(vueDetail.cibleDepuisHash(undefined), null);
});

test('une route malformée renvoie à la grille plutôt que de rendre un écran cassé', () => {
  globalThis.location = { hash: '#/grille/seance/abc' };
  const hote = creerHote();
  vueDetail.monterDetailSeance(hote, ctxDe());
  assert.equal(globalThis.location.hash, '#/grille');
});

// --- le nom de la séance et sa liste d'exercices ------------------------------

test('affiche le nom de la séance et une ligne par exercice, chacune marquée fait ou pas fait', () => {
  const hote = creerHote();
  const s1 = prog.seances.find((s) => s.id === 's1');
  const exs = exercicesDeSeance(prog, 1);
  const premier = exs[0].id;
  globalThis.location = { hash: '#/grille/seance/1/1' };
  vueDetail.monterDetailSeance(hote, ctxDe([{ seance: 1, semaine: 1, exercice: premier, a: '2026-08-03T09:00:00.000Z' }]));

  assert.match(texteDe(hote), new RegExp(s1.nom));
  const lignes = hote.querySelectorAll('.ligne-exercice');
  assert.equal(lignes.length, exs.length, 'une ligne par exercice de la séance');
  assert.equal(hote.querySelectorAll('.case-exercice--fait').length, 1, 'un seul exercice est déjà fait');
});

// --- cocher / décocher, sans jamais rien lancer -------------------------------

test('cocher depuis le détail ajoute un fait bien formé, avec le marqueur corrigé', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe());

  const premiereCase = hote.querySelectorAll('.case-exercice')[0];
  const premierId = exercicesDeSeance(prog, 1)[0].id;
  premiereCase.declencher('click');

  const faits = etat.lireEtat().faits;
  assert.equal(faits.length, 1);
  assert.deepEqual(
    { seance: faits[0].seance, semaine: faits[0].semaine, exercice: faits[0].exercice },
    { seance: 1, semaine: 2, exercice: premierId },
    'le fait porte exactement la forme { seance, semaine, exercice, a } produite par la séance',
  );
  assert.equal(typeof faits[0].a, 'string');
  assert.ok(faits[0].a.length > 0);
  assert.equal(faits[0].corrige, true, 'une correction depuis la grille porte le marqueur corrigé');
  assert.equal(hote.querySelectorAll('.case-exercice--fait').length, 1);
});

test('décocher depuis le détail retire le fait', () => {
  const hote = creerHote();
  const premierId = exercicesDeSeance(prog, 1)[0].id;
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe([{ seance: 1, semaine: 2, exercice: premierId, a: '2026-08-05T09:00:00.000Z' }]));

  assert.equal(hote.querySelectorAll('.case-exercice--fait').length, 1);
  hote.querySelectorAll('.case-exercice')[0].declencher('click');

  assert.deepEqual(etat.lireEtat().faits, []);
  assert.equal(hote.querySelectorAll('.case-exercice--fait').length, 0);
});

test('cocher un à un chaque exercice d’une séance la rend « faite » (PRD §9.1), quel que soit le chemin', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe());

  // L'ordre des lignes suit celui du programme, jamais l'état fait/pas
  // fait : l'index i désigne donc toujours le même exercice d'un rendu à
  // l'autre. Le DOM est reconstruit après chaque clic (rendreListe), d'où la
  // relecture à chaque tour plutôt qu'une référence périmée.
  const total = exercicesDeSeance(prog, 1).length;
  for (let i = 0; i < total; i += 1) {
    hote.querySelectorAll('.case-exercice')[i].declencher('click');
  }

  assert.equal(seanceEstFaite(prog, etat.lireEtat().faits, 2, 1), true);
});

// --- A16 (« Ajouté après les PRP », lot ludique) : cocher est une validation
// comme une autre ------------------------------------------------------------

test('A16 : cocher depuis le détail met à jour le record du total d’exercices', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe());

  hote.querySelectorAll('.case-exercice')[0].declencher('click');
  assert.equal(etat.lireEtat().records.totalExercices, 1);
});

test('A16 : décocher ne fait jamais redescendre un record déjà acquis', () => {
  const hote = creerHote();
  const premierId = exercicesDeSeance(prog, 1)[0].id;
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe([{ seance: 1, semaine: 2, exercice: premierId, a: '2026-08-05T09:00:00.000Z' }]));

  // Un record déjà acquis avant l'ouverture de cet écran (par exemple une
  // grosse séance faite ailleurs) : décocher ici ne doit jamais l'effacer.
  etat.ecrireEtat({ records: { plusLongueTenue: 0, plusExercicesJour: 0, totalExercices: 9 } });

  hote.querySelectorAll('.case-exercice')[0].declencher('click'); // décoche
  assert.deepEqual(etat.lireEtat().faits, []);
  assert.equal(etat.lireEtat().records.totalExercices, 9, 'décocher n’est pas une validation : le record ne bouge pas');
});

// --- lancer, la deuxième cible, distincte de la première ----------------------

test('lancer depuis la liste mène à l’écran de séance avec l’exercice, la séance ET la semaine de CETTE case dans la route', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/5/3' };
  vueDetail.monterDetailSeance(hote, ctxDe());

  const premierId = exercicesDeSeance(prog, 3)[0].id;
  const lignes = hote.querySelectorAll('.ligne-exercice');
  const lancer = lignes[0].querySelectorAll('.bouton-lancer')[0];
  assert.ok(lancer, 'chaque ligne doit porter un bouton « Lancer »');
  lancer.declencher('click');

  assert.equal(globalThis.location.hash, `#/seance/3/${premierId}/5`);
});

test('cocher/décocher et lancer sont deux cibles distinctes : cliquer la case à cocher ne change jamais la route', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe());

  hote.querySelectorAll('.case-exercice')[0].declencher('click');
  assert.equal(globalThis.location.hash, '#/grille/seance/2/1', 'cocher ne lance jamais rien, ne change jamais la route');
});

// --- aucun total, aucun pourcentage, aucune moyenne (PRD §4, §14) -----------

test('le détail n’affiche jamais de total, de pourcentage ni de moyenne', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  vueDetail.monterDetailSeance(hote, ctxDe());
  const texte = texteDe(hote);
  assert.doesNotMatch(texte, /%/);
  assert.doesNotMatch(texte, /moyenne/i);
  assert.doesNotMatch(texte, /\btotal\b/i);
});

test('demonter() ne lève jamais', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/grille/seance/2/1' };
  const demonter = vueDetail.monterDetailSeance(hote, ctxDe());
  assert.doesNotThrow(() => demonter());
});
