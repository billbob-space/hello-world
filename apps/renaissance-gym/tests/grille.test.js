// tests/grille.test.js — la grille des huit semaines, les corrections, les
// badges (PRP 05, PRD §7.4, §9.3 à §9.7).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chargerProgramme } from '../web/programme.js';
import * as vueGrille from '../web/vue-grille.js';
import * as etat from '../web/etat.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));
const styleSource = readFileSync(join(web, 'style.css'), 'utf8');

// Debut choisi pour que trois semaines soient deja passees, une soit en
// cours, et quatre restent a venir : de quoi voir les quatre etats de la
// table du chantier A dans le meme rendu.
const DEBUT = '2026-08-03T08:00:00.000Z';
const MAINTENANT = new Date('2026-08-24T08:00:00.000Z'); // trois semaines plus tard : semaine 4

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
  globalThis.location = { hash: '#/grille' };
});

// Ecrit dans le stockage REEL (pas seulement dans l'objet passe a la vue) :
// `vue-grille.js` fusionne chaque correction via `etat.js`, qui lit toujours
// le stockage reel. Un `ctx.etat` qui n'y correspond pas des le depart se
// ferait ecraser des la premiere correction (`debut` reviendrait a `null`).
function demarrerAvec(partiel = {}) {
  const e = etat.ecrireEtat({ debut: DEBUT, semaineDeDepart: 1, ...partiel });
  return { etat: e, programme: prog, maintenant: () => MAINTENANT };
}

function ctxVide() {
  return demarrerAvec();
}

// Concatene tout le texte d'un sous-arbre, recursivement — le `.textContent`
// de dom-factice ne rend que le texte DIRECT d'un noeud (voir tests/dom-factice.js).
function texteDe(noeud) {
  let t = noeud.textContent ?? '';
  for (const enfant of noeud.children ?? []) t += texteDe(enfant);
  return t;
}

function boutonTexte(hote, texte) {
  return hote.querySelectorAll('.bouton').find((b) => b.textContent === texte)
    ?? hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === texte);
}

// --- une case future est inerte (PRD §9.3) ----------------------------------

test('une case de semaine future n’a AUCUN gestionnaire de clic', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());

  const futures = hote.querySelectorAll('.case-seance--future');
  assert.ok(futures.length > 0, 'garde-fou : au moins une case future doit exister (semaine 4 en cours, 5 a 8 a venir)');
  for (const c of futures) {
    assert.equal(c._handlers.has('click'), false, 'une case future ne doit porter aucun gestionnaire de clic');
    assert.equal(c.disabled, true);
  }
});

test('classeDeCase rend les quatre etats de la table du chantier A', () => {
  assert.equal(vueGrille.classeDeCase({ faite: true, semaine: 1, semaineCouranteActuelle: 4 }), 'faite');
  assert.equal(vueGrille.classeDeCase({ faite: false, semaine: 4, semaineCouranteActuelle: 4 }), 'encours');
  assert.equal(vueGrille.classeDeCase({ faite: false, semaine: 2, semaineCouranteActuelle: 4 }), 'passee-vide');
  assert.equal(vueGrille.classeDeCase({ faite: false, semaine: 5, semaineCouranteActuelle: 4 }), 'future');
  // Une seance FAITE d'une semaine future ne devrait jamais exister (l'avenir
  // ne se coche pas), mais le classement reste « future » avant tout : c'est
  // la garantie qui rend la case inerte, quoi que portent les faits.
  assert.equal(vueGrille.classeDeCase({ faite: true, semaine: 5, semaineCouranteActuelle: 4 }), 'future');
});

// --- A3 : toute case ouvrable s'ouvre, la semaine en cours comme les
// semaines passees — l'appui mene au detail de la seance, jamais a un
// bandeau qui coche tout d'un coup (la correction descend a l'exercice,
// PRD A3). ----------------------------------------------------------------

test('une case de la semaine en cours porte desormais un gestionnaire de clic, qui ouvre son detail', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());
  globalThis.location = { hash: '#/grille' };

  const enCours = hote.querySelectorAll('.case-seance--encours');
  assert.equal(enCours.length, 4, 'les quatre seances de la semaine en cours sont a faire');
  for (const c of enCours) {
    assert.equal(c._handlers.has('click'), true, 'une case ouvrable de la semaine en cours doit pouvoir s’ouvrir (A3)');
  }
  enCours[0].declencher('click');
  assert.equal(globalThis.location.hash, '#/grille/seance/4/1', 'semaine 4 est la semaine en cours dans ce jeu de donnees');
});

test('une case de semaine passee ouvre elle aussi son detail, jamais un bandeau de confirmation', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());
  globalThis.location = { hash: '#/grille' };

  const vide = hote.querySelectorAll('.case-seance--passee-vide')[0];
  assert.ok(vide, 'garde-fou : au moins une case passee vide doit exister');
  vide.declencher('click');

  assert.match(globalThis.location.hash, /^#\/grille\/seance\/\d\/\d$/);
  assert.equal(hote.querySelectorAll('.confirmation-case__question').length, 0, 'plus de bandeau de confirmation pour une case (A3)');
});

// --- A3 : la case porte son avancement, trois visages distincts -----------

test('une seance entamee (certains exercices faits, pas tous) se distingue de la vide et de la finie', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const premier = s1.exercices[0];
  etat.ecrireEtat({
    debut: DEBUT,
    semaineDeDepart: 1,
    faits: [{ seance: 1, semaine: 1, exercice: premier, a: '2026-08-03T09:00:00.000Z' }],
  });

  const hote = creerHote();
  vueGrille.monterGrille(hote, { etat: etat.lireEtat(), programme: prog, maintenant: () => MAINTENANT });

  const entamees = hote.querySelectorAll('.case-seance--entamee');
  const finies = hote.querySelectorAll('.case-seance--faite');
  assert.equal(entamees.length, 1, 'exactement une seance a un exercice fait sur plusieurs');
  assert.equal(entamees.some((c) => finies.includes(c)), false, 'entamee n’est jamais finie');
  assert.ok(entamees[0].querySelectorAll('.case-seance__remplissage').length > 0, 'un remplissage doit porter l’avancement');

  // Aucune case en dehors de l’etat entame ne porte de remplissage.
  const toutesLesCases = hote.querySelectorAll('.case-seance');
  const nonEntamees = toutesLesCases.filter((c) => !entamees.includes(c));
  for (const c of nonEntamees) {
    assert.equal(c.querySelectorAll('.case-seance__remplissage').length, 0);
  }
});

test('une seance dont aucun exercice n’est fait n’a pas de remplissage', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());
  const videS = hote.querySelectorAll('.case-seance--passee-vide')[0];
  assert.equal(hote.querySelectorAll('.case-seance--entamee').includes(videS), false);
  assert.equal(videS.querySelectorAll('.case-seance__remplissage').length, 0);
});

// --- aucun total, aucun pourcentage, aucune moyenne (PRD §4, §14) -----------

test('la grille n’affiche jamais de total, de pourcentage ni de moyenne', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());
  const texte = texteDe(hote);
  assert.doesNotMatch(texte, /%/, 'aucun pourcentage ne doit apparaitre');
  assert.doesNotMatch(texte, /moyenne/i);
  assert.doesNotMatch(texte, /\btotal\b/i);
});

// --- la semaine en cours, et elle seule, porte l’empiecement --------------

test('une seule semaine porte la classe « en cours »', () => {
  const hote = creerHote();
  vueGrille.monterGrille(hote, ctxVide());
  assert.equal(hote.querySelectorAll('.rang-semaine--courante').length, 1);
});

// --- la grille tient dans 360 x 640, sans defilement horizontal ------------

test('les cases de la grille sont disposees en colonnes fractionnaires, jamais en pixels fixes', () => {
  const blocCases = /\.rang-semaine__cases\s*\{([^}]*)\}/.exec(styleSource);
  assert.ok(blocCases, 'la regle .rang-semaine__cases est introuvable dans style.css');
  assert.match(blocCases[1], /grid-template-columns:\s*repeat\(4,\s*1fr\)/, 'quatre colonnes fractionnaires, pas des largeurs fixes');

  for (const selecteur of ['.case-seance', '.rang-semaine', '.rang-semaine__cases', '.grille-programme']) {
    const regle = new RegExp(`${selecteur.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(styleSource);
    assert.ok(regle, `regle ${selecteur} introuvable`);
    assert.doesNotMatch(regle[1], /width\s*:\s*\d+px/, `${selecteur} ne doit pas imposer de largeur fixe en pixels`);
  }
});

// --- le programme termine, et « recommencer » n'est jamais automatique -----

test('« Ton programme est terminé » apparait au-dela de la semaine 8, avec un geste confirme pour recommencer', () => {
  const hote = creerHote();
  const treizeSemainesPlusTard = new Date(new Date(DEBUT).getTime() + 13 * 7 * 24 * 60 * 60 * 1000);
  vueGrille.monterGrille(hote, {
    ...demarrerAvec(),
    maintenant: () => treizeSemainesPlusTard,
  });

  assert.match(texteDe(hote), /Ton programme est terminé/);
  const recommencer = boutonTexte(hote, 'Recommencer à zéro');
  assert.ok(recommencer, 'le bouton « Recommencer à zéro » doit exister');

  recommencer.declencher('click');
  // Rien n'est ecrit avant confirmation.
  assert.equal(etat.lireEtat().debut, DEBUT);

  boutonTexte(hote, 'Oui').declencher('click');
  const apres = etat.lireEtat();
  assert.notEqual(apres.debut, DEBUT, 'recommencer reinitialise le debut');
  assert.equal(apres.semaineDeDepart, 1);
  assert.deepEqual(apres.faits, []);
});

// --- les badges : une fois gagnes, gardes, et signales par le strass -------

test('un badge tout juste gagne est persiste et son strass balaie une fois, jamais au tour suivant', () => {
  const hote = creerHote();
  const s1 = prog.seances.find((s) => s.id === 's1');
  const faitsSeance1 = s1.exercices.map((id) => ({
    seance: 1, semaine: 1, exercice: id, a: '2026-08-03T09:00:00.000Z',
  }));
  // L'etat REEL porte deja les faits (comme app.js le fait toujours, via
  // `lireEtat()`) : c'est ce qui garde `ctx.etat` et le stockage coherents
  // d'un montage a l'autre.
  etat.ecrireEtat({ debut: DEBUT, semaineDeDepart: 1, faits: faitsSeance1 });

  vueGrille.monterGrille(hote, {
    etat: etat.lireEtat(),
    programme: prog,
    maintenant: () => MAINTENANT,
  });

  assert.deepEqual(etat.lireEtat().badges, ['premier-jour'], 'le badge doit avoir ete persiste au montage');
  const carteNeuve = hote.querySelectorAll('.badge-carte')[0];
  assert.ok(carteNeuve, 'une carte de badge doit s’afficher');
  assert.equal(carteNeuve.querySelectorAll('.strass--balaie').length, 1, 'le tout premier affichage balaie');

  // Un second montage, avec l'etat REEL (deja ecrit) : le badge est toujours
  // la, mais son strass ne balaie plus.
  const hote2 = creerHote();
  vueGrille.monterGrille(hote2, {
    etat: etat.lireEtat(),
    programme: prog,
    maintenant: () => MAINTENANT,
  });
  assert.deepEqual(etat.lireEtat().badges, ['premier-jour'], 'le badge n’est jamais attribue deux fois');
  const carteReprise = hote2.querySelectorAll('.badge-carte')[0];
  assert.equal(carteReprise.querySelectorAll('.strass--balaie').length, 0, 'un badge deja connu ne balaie plus');
  assert.equal(carteReprise.querySelectorAll('.strass').length, 1, 'mais reste visible, en strass statique');
});

test('demonter() ne leve jamais', () => {
  const hote = creerHote();
  const demonter = vueGrille.monterGrille(hote, ctxVide());
  assert.doesNotThrow(() => demonter());
});
