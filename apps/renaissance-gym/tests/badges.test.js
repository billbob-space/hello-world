// tests/badges.test.js — les six badges, purs (PRP 05 chantier C, PRD §6 lot 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chargerProgramme, exercices } from '../web/programme.js';
import { BADGES, badgesGagnes, nouveauxBadges } from '../web/badges.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));

function etatDe(faits, badges = []) {
  return { faits, badges };
}

function faitsDeSeance(numero, semaine, dateISO = '2026-08-03T09:00:00.000Z') {
  const s = prog.seances.find((x) => x.id === `s${numero}`);
  return s.exercices.map((id) => ({
    seance: numero, semaine, exercice: id, a: dateISO,
  }));
}

// --- la forme des six badges -------------------------------------------------

test('BADGES porte exactement six badges, chacun avec un id, un nom, une phrase et une condition', () => {
  assert.equal(BADGES.length, 6);
  const ids = new Set();
  for (const b of BADGES) {
    assert.equal(typeof b.id, 'string');
    assert.ok(b.id.length > 0);
    assert.equal(ids.has(b.id), false, `id en double : ${b.id}`);
    ids.add(b.id);
    assert.equal(typeof b.nom, 'string');
    assert.ok(b.nom.length > 0);
    assert.equal(typeof b.phrase, 'string');
    assert.ok(b.phrase.length > 0);
    assert.equal(typeof b.condition, 'function');
  }
});

// PRP 05 chantier C : « les phrases de badge ne comparent jamais, ne
// classent jamais, et ne parlent pas du corps. »
test('aucune phrase de badge ne compare, ne classe ou ne parle du corps', () => {
  const motsInterdits = [
    'mieux', 'meilleur', 'moins bien', 'plus vite', 'plus fort', 'que la semaine',
    'poids', 'kilo', 'maigr', 'gross', 'corps', 'classement', 'première place',
  ];
  for (const b of BADGES) {
    const phrase = b.phrase.toLowerCase();
    for (const mot of motsInterdits) {
      assert.doesNotMatch(phrase, new RegExp(mot, 'i'), `« ${b.phrase} » porte un mot interdit : ${mot}`);
    }
  }
});

// --- badgesGagnes : pur, sans effet de bord ---------------------------------

test('badgesGagnes rend un tableau vide sur un etat sans aucun fait', () => {
  assert.deepEqual(badgesGagnes(prog, etatDe([])), []);
});

test('« Premier jour » : des la premiere seance terminee', () => {
  const gagnes = badgesGagnes(prog, etatDe(faitsDeSeance(1, 1)));
  assert.ok(gagnes.includes('premier-jour'));
});

test('« Semaine bouclée » : les quatre seances d’une meme semaine', () => {
  const faitsPartiels = [1, 2, 3].flatMap((n) => faitsDeSeance(n, 1));
  assert.ok(!badgesGagnes(prog, etatDe(faitsPartiels)).includes('semaine-bouclee'), 'trois sur quatre ne suffit pas');

  const faitsComplets = [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, 1));
  assert.ok(badgesGagnes(prog, etatDe(faitsComplets)).includes('semaine-bouclee'));
});

test('« La moitié » : quatre semaines a au moins trois seances', () => {
  // Trois semaines a trois seances : pas encore assez de SEMAINES.
  const troisSemaines = [1, 2, 3].flatMap(
    (semaine) => [1, 2, 3].flatMap((n) => faitsDeSeance(n, semaine)),
  );
  assert.ok(!badgesGagnes(prog, etatDe(troisSemaines)).includes('la-moitie'));

  const quatreSemaines = [1, 2, 3, 4].flatMap(
    (semaine) => [1, 2, 3].flatMap((n) => faitsDeSeance(n, semaine)),
  );
  assert.ok(badgesGagnes(prog, etatDe(quatreSemaines)).includes('la-moitie'));
});

test('« Les 36 » : tous les exercices du programme vus au moins une fois', () => {
  const uneSemaine = [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, 1));
  const vus = new Set(uneSemaine.map((f) => f.exercice));
  assert.equal(vus.size, exercices(prog).length, 'garde-fou : une semaine couvre exactement les 36 exercices (PRD §8.4)');
  assert.ok(badgesGagnes(prog, etatDe(uneSemaine)).includes('les-36'));

  // Un des 36 exercices distincts manque (la séance 4 reprend des exercices
  // de souplesse déjà vus dans la semaine, §8.4 : retirer une seule ligne au
  // hasard ne suffirait pas toujours à faire manquer un exercice DISTINCT).
  const unExerciceDistinctManquant = uneSemaine.filter((f) => f.exercice !== uneSemaine[0].exercice);
  assert.equal(new Set(unExerciceDistinctManquant.map((f) => f.exercice)).size, exercices(prog).length - 1);
  assert.ok(!badgesGagnes(prog, etatDe(unExerciceDistinctManquant)).includes('les-36'));
});

test('« Une minute » : une tenue menee a son objectif le plus haut, jamais a un palier intermediaire', () => {
  const exTenue = prog.exercices.find((ex) => ex.mesure === 'tenue');
  assert.ok(exTenue, 'garde-fou : au moins un exercice « tenue » doit exister');

  // Semaine 1 : le palier le plus bas. Pas de badge.
  const semaine1 = etatDe([{
    seance: 1, semaine: 1, exercice: exTenue.id, a: '2026-08-03T09:00:00.000Z',
  }]);
  assert.ok(!badgesGagnes(prog, semaine1).includes('une-minute'));

  // Semaine 8 : le dernier palier, l’objectif plein. Le badge se gagne.
  const semaine8 = etatDe([{
    seance: 1, semaine: 8, exercice: exTenue.id, a: '2026-08-03T09:00:00.000Z',
  }]);
  assert.ok(badgesGagnes(prog, semaine8).includes('une-minute'));
});

test('« Une minute » ignore les exercices « repetitions », meme en semaine 8', () => {
  const exReps = prog.exercices.find((ex) => ex.mesure === 'repetitions');
  const etat = etatDe([{
    seance: 1, semaine: 8, exercice: exReps.id, a: '2026-08-03T09:00:00.000Z',
  }]);
  assert.ok(!badgesGagnes(prog, etat).includes('une-minute'));
});

test('« Les huit semaines » : la semaine huit atteinte avec au moins vingt-quatre seances', () => {
  // Beaucoup de seances, mais jamais en semaine huit : pas de badge.
  const sansSemaineHuit = [1, 2, 3, 4, 5, 6].flatMap(
    (semaine) => [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, semaine)),
  );
  assert.ok(!badgesGagnes(prog, etatDe(sansSemaineHuit)).includes('les-huit-semaines'));

  // La semaine huit atteinte, mais trop peu de seances au total : pas de badge.
  const peuDeSeances = faitsDeSeance(1, 8);
  assert.ok(!badgesGagnes(prog, etatDe(peuDeSeances)).includes('les-huit-semaines'));

  // Les deux conditions reunies.
  const complet = [1, 2, 3, 4, 5, 6].flatMap(
    (semaine) => [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, semaine)),
  ).concat(faitsDeSeance(1, 8));
  assert.ok(badgesGagnes(prog, etatDe(complet)).includes('les-huit-semaines'));
});

// --- nouveauxBadges : ce qu'il faut annoncer, jamais ce qu'il faut retirer --

test('nouveauxBadges rend les badges tout juste gagnes, absents de avant.badges', () => {
  const avant = etatDe([]);
  const apres = etatDe(faitsDeSeance(1, 1));
  assert.deepEqual(nouveauxBadges(prog, avant, apres), ['premier-jour']);
});

test('un badge n’est annonce qu’une fois, meme si la condition se realise a nouveau', () => {
  const faitsComplets = faitsDeSeance(1, 1);
  // Le badge est deja dans `avant.badges` : meme si la condition est encore
  // vraie dans `apres`, il n'est PAS un « nouveau » badge a annoncer.
  const avant = etatDe(faitsComplets, ['premier-jour']);
  const apres = etatDe(faitsComplets, ['premier-jour']);
  assert.deepEqual(nouveauxBadges(prog, avant, apres), []);
});

test('un badge decoche puis recoche ne se re-annonce pas s’il est deja acquis', () => {
  const faitsComplets = faitsDeSeance(1, 1);
  const dejaGagne = etatDe(faitsComplets, ['premier-jour']);
  // Une decoche depuis la grille fait disparaitre les faits, mais le badge
  // GARDE, conforme au PRD : la condition redevient fausse, mais le badge
  // reste dans la liste des acquis (c'est `vue-grille.js` qui la porte).
  const decoche = etatDe([], ['premier-jour']);
  assert.deepEqual(nouveauxBadges(prog, dejaGagne, decoche), []);
  // Une recoche : la condition redevient vraie, mais `avant.badges` la
  // portait deja — toujours rien de nouveau a annoncer.
  const recoche = etatDe(faitsComplets, ['premier-jour']);
  assert.deepEqual(nouveauxBadges(prog, decoche, recoche), []);
});

test('nouveauxBadges peut rendre plusieurs ids a la fois', () => {
  const avant = etatDe([]);
  const complet = [1, 2, 3, 4].flatMap((n) => faitsDeSeance(n, 1));
  const apres = etatDe(complet);
  const nouveaux = nouveauxBadges(prog, avant, apres);
  assert.ok(nouveaux.includes('premier-jour'));
  assert.ok(nouveaux.includes('semaine-bouclee'));
  assert.ok(nouveaux.includes('les-36'));
});

// --- purete du module (ossature §6) -----------------------------------------

test('badges.js reste pur : ni DOM, ni stockage, ni reseau, ni horloge', () => {
  const source = readFileSync(join(web, 'badges.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const mot of ['document', 'window', 'localStorage', 'Date.now', 'new Date', 'fetch(']) {
    assert.equal(source.includes(mot), false, `badges.js contient « ${mot} »`);
  }
});
