// tests/seance.test.js — l'écran de séance (PRP 04 chantier C, PRD §5, §7.3,
// §9.1, §9.2, §11.3 ; A3 bis, « Ajouté après les PRP », le mode « cible
// unique » lancé depuis le détail d'une séance de la grille).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme, objectif } from '../web/programme.js';
import * as vueSeance from '../web/vue-seance.js';
import * as etat from '../web/etat.js';
import { seanceEstFaite } from '../web/domaine.js';
import { formater } from '../web/chrono.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const progReel = chargerProgramme(JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
));

// Un petit programme synthétique : une seule séance, un exercice « tenue »
// suivi d'un exercice « repetitions », pour vérifier que le mode du minuteur
// vient de `mesure` et de rien d'autre — y compris quand le libellé ment.
const progSynthetique = chargerProgramme({
  titre: 'Test',
  semaines: 8,
  seances_par_semaine: 4,
  familles: [{ id: 'f', nom: 'Famille' }],
  exercices: [
    { id: 'e1', libelle: 'x20 fois vite (libellé trompeur)', famille: 'f', mesure: 'tenue', paliers: [10, 15, 20, 30] },
    { id: 'e2', libelle: 'Tenir 1 min (libellé trompeur)', famille: 'f', mesure: 'repetitions', paliers: [10, 13, 16, 20] },
  ],
  seances: [
    { id: 's1', nom: 'Séance test', exercices: ['e1', 'e2'] },
    { id: 's2', nom: 'Séance 2', exercices: ['e1'] },
    { id: 's3', nom: 'Séance 3', exercices: ['e1'] },
    { id: 's4', nom: 'Séance 4', exercices: ['e1'] },
  ],
});

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
  globalThis.location = { hash: '#/seance' };
  delete globalThis.navigator?.wakeLock;
});

function ctxAvec({
  faits = [], debut = null, semaineDeDepart = 1, fileSeance = null,
} = {}, programme = progSynthetique) {
  return {
    etat: { ...etat.ETAT_VIDE, faits, debut, semaineDeDepart, fileSeance },
    programme,
    maintenant: () => new Date('2026-08-14T09:00:00.000Z'),
  };
}

// Un programme synthétique à trois exercices « repetitions », tous dans une
// seule séance : suffisant pour observer la FILE (A1, « Ajouté après les
// PRP ») sans les complications du minuteur, qui a ses propres tests.
const progFile = chargerProgramme({
  titre: 'Test file',
  semaines: 8,
  seances_par_semaine: 4,
  familles: [{ id: 'f', nom: 'Famille' }],
  exercices: [
    { id: 'e1', libelle: 'Exercice un', famille: 'f', mesure: 'repetitions', paliers: [10, 13, 16, 20] },
    { id: 'e2', libelle: 'Exercice deux', famille: 'f', mesure: 'repetitions', paliers: [10, 13, 16, 20] },
    { id: 'e3', libelle: 'Exercice trois', famille: 'f', mesure: 'repetitions', paliers: [10, 13, 16, 20] },
  ],
  seances: [
    { id: 's1', nom: 'Séance test', exercices: ['e1', 'e2', 'e3'] },
    { id: 's2', nom: 'Séance 2', exercices: ['e1'] },
    { id: 's3', nom: 'Séance 3', exercices: ['e1'] },
    { id: 's4', nom: 'Séance 4', exercices: ['e1'] },
  ],
});

function boutonAvecTexte(hote, texte) {
  return [...hote.querySelectorAll('.bouton'), ...hote.querySelectorAll('.bouton--discret')]
    .find((b) => b.textContent === texte) ?? null;
}

// --- fonctions pures ---------------------------------------------------------

test('numeroDepuisHash lit « #/seance/<n> », rend null sinon', () => {
  assert.equal(vueSeance.numeroDepuisHash('#/seance/3'), 3);
  assert.equal(vueSeance.numeroDepuisHash('#/seance/1'), 1);
  assert.equal(vueSeance.numeroDepuisHash('#/seance'), null);
  assert.equal(vueSeance.numeroDepuisHash('#/seance/0'), null);
  assert.equal(vueSeance.numeroDepuisHash('#/seance/9'), null);
  assert.equal(vueSeance.numeroDepuisHash('#/seance/abc'), null);
  assert.equal(vueSeance.numeroDepuisHash('#/jour'), null);
  assert.equal(vueSeance.numeroDepuisHash(undefined), null);
});

test('indexPremierNonFait reprend au bon exercice (PRD §9.1)', () => {
  const s1 = progReel.seances.find((s) => s.id === 's1');
  const premier = s1.exercices[0];
  const second = s1.exercices[1];

  assert.equal(vueSeance.indexPremierNonFait(progReel, [], 1, 1), 0, 'rien de fait : on commence au premier');

  const faits = [{ seance: 1, semaine: 1, exercice: premier, a: '2026-08-14T09:00:00.000Z' }];
  assert.equal(vueSeance.indexPremierNonFait(progReel, faits, 1, 1), 1, 'le premier est fait : on reprend au second');

  const faitsAilleurs = [{ seance: 1, semaine: 2, exercice: premier, a: '2026-08-14T09:00:00.000Z' }];
  assert.equal(
    vueSeance.indexPremierNonFait(progReel, faitsAilleurs, 1, 1),
    0,
    'un fait d’une AUTRE semaine ne doit pas compter pour celle-ci',
  );

  const tousFaits = s1.exercices.map((id) => ({ seance: 1, semaine: 1, exercice: id, a: '2026-08-14T09:00:00.000Z' }));
  assert.equal(vueSeance.indexPremierNonFait(progReel, tousFaits, 1, 1), s1.exercices.length, 'tout fait : au bout');

  assert.equal(second !== undefined, true, 'garde-fou : la séance 1 doit avoir au moins deux exercices');
});

// --- le mode vient de la donnée, jamais du libellé --------------------------

test('un exercice mesure: "tenue" monte un minuteur, même si son libellé n’en parle pas', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progSynthetique));

  assert.equal(hote.querySelectorAll('.decompte').length, 1);
  assert.equal(hote.querySelectorAll('.objectif-seance--minuteur').length, 1);
  assert.equal(hote.querySelectorAll('.objectif-seance--repetitions').length, 0);
});

test('un exercice mesure: "repetitions" ne monte PAS de minuteur, même si son libellé évoque une durée', () => {
  const hote = creerHote();
  // On force l'index sur e2 (repetitions) en marquant e1 déjà fait.
  const ctx = ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e1', a: '2026-08-14T09:00:00.000Z' }],
  }, progSynthetique);
  vueSeance.monterSeance(hote, ctx);

  assert.equal(hote.querySelectorAll('.decompte').length, 0);
  assert.equal(hote.querySelectorAll('.objectif-seance--minuteur').length, 0);
  assert.equal(hote.querySelectorAll('.objectif-seance--repetitions').length, 1);
});

// --- aucun .strass pendant l’effort (ossature §5.3) --------------------------

test('vue-seance.js ne monte jamais .strass, même à la fin d’une séance', () => {
  const hote = creerHote();
  const ctx = ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e1', a: '2026-08-14T09:00:00.000Z' }],
  }, progSynthetique);
  vueSeance.monterSeance(hote, ctx);
  assert.equal(hote.querySelectorAll('.strass').length, 0);

  // On termine le dernier exercice (repetitions, un seul tap) et on revérifie
  // sur l'écran de fin.
  hote.querySelector('.bouton').declencher('click');
  assert.equal(hote.querySelectorAll('.strass').length, 0);
});

// --- le geste unique de répétitions : un tap valide et avance ---------------

test('« C’est fait » enregistre le fait et avance à l’exercice suivant', () => {
  const hote = creerHote();
  const ctx = ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e1', a: '2026-08-14T09:00:00.000Z' }],
  }, progSynthetique);
  vueSeance.monterSeance(hote, ctx);

  assert.equal(hote.querySelector('.bouton').textContent, 'C’est fait');
  hote.querySelector('.bouton').declencher('click');

  const e = etat.lireEtat();
  assert.deepEqual(
    e.faits.find((f) => f.exercice === 'e2'),
    { seance: 1, semaine: 1, exercice: 'e2', a: '2026-08-14T09:00:00.000Z' },
  );
  // La séance ne portait que deux exercices : le second etait le dernier,
  // on doit être sur l'écran de fin.
  assert.equal(hote.querySelector('.bouton').textContent, 'Retour');
});

// --- la séance reprend au bon exercice après rechargement -------------------

test('une séance rechargée avec un exercice déjà validé affiche directement le suivant', () => {
  const hote = creerHote();
  const ctx = ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e1', a: '2026-08-14T09:00:00.000Z' }],
  }, progSynthetique);
  vueSeance.monterSeance(hote, ctx);

  const titre = hote.querySelector('.nom-exercice');
  assert.equal(titre.textContent, 'Tenir 1 min (libellé trompeur)', 'e1 est déjà fait : on affiche e2');
});

// --- l’écran reste allumé pendant la séance, relâché au démontage ----------

test('garderEcranAllume est demandé au montage et relâché au démontage, y compris via le retour du navigateur', async () => {
  const appels = [];
  const verrou = { release: async () => { appels.push('release'); } };
  Object.defineProperty(globalThis.navigator, 'wakeLock', {
    configurable: true,
    value: { request: async (type) => { appels.push(`request:${type}`); return verrou; } },
  });

  const hote = creerHote();
  const demonter = vueSeance.monterSeance(hote, ctxAvec({}, progSynthetique));

  // garderEcranAllume est asynchrone : on laisse les microtasks se résoudre.
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(appels, ['request:screen']);

  demonter(); // simule aussi bien un démontage normal qu’un retour navigateur
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(appels, ['request:screen', 'release']);

  delete globalThis.navigator.wakeLock;
});

test('demonter() n’explose jamais, même sans minuteur actif', () => {
  const hote = creerHote();
  const demonter = vueSeance.monterSeance(hote, ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e1', a: '2026-08-14T09:00:00.000Z' }],
  }, progSynthetique));
  assert.doesNotThrow(() => demonter());
});

// --- « Ajouté après les PRP », A1 : « Passer » un exercice ------------------

test('« Passer » renvoie l’exercice courant à la fin de la file : le suivant s’affiche', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progFile));

  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice un');
  boutonAvecTexte(hote, 'Passer').declencher('click');
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice deux', 'le premier est passé : le deuxième vient');

  // Aucun fait n’a été enregistré : passer n’est ni une validation ni une
  // perte (PRD, A1).
  assert.deepEqual(etat.lireEtat().faits, []);
});

test('« Passer » revient TOUJOURS : elle peut le repasser autant de fois qu’elle veut', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progFile));

  boutonAvecTexte(hote, 'Passer').declencher('click'); // e1 -> fin ; e2 affiché
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice deux');
  boutonAvecTexte(hote, 'Passer').declencher('click'); // e2 -> fin ; e3 affiché
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice trois');
  // Elle a maintenant passé les trois : l’écran d’avis intervient une fois
  // (elle-même testée plus bas), « Continuer » la ramène au premier — une
  // rotation complète, jamais une disparition.
  boutonAvecTexte(hote, 'Passer').declencher('click');
  boutonAvecTexte(hote, 'Continuer').declencher('click');
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice un', 'rien ne disparaît jamais, même passé plusieurs fois');

  // L’avis ne revient plus : elle peut continuer à passer indéfiniment.
  boutonAvecTexte(hote, 'Passer').declencher('click');
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice deux');
});

test('la file d’une séance interrompue retrouve son ordre au rechargement', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progFile));

  boutonAvecTexte(hote, 'Passer').declencher('click'); // file : e2, e3, e1
  const { fileSeance } = etat.lireEtat();
  assert.deepEqual(fileSeance, { semaine: 1, numero: 1, file: ['e2', 'e3', 'e1'], passes: ['e1'] });

  // Un « rechargement » : un nouveau montage, avec l’état tel que
  // localStorage l’a gardé (comme les tests existants le font pour les
  // faits validés).
  const hote2 = creerHote();
  vueSeance.monterSeance(hote2, ctxAvec({ fileSeance }, progFile));
  assert.equal(hote2.querySelector('.nom-exercice').textContent, 'Exercice deux', 'la file reprend là où elle était');
});

test('quand il ne reste que des exercices passés, l’écran le dit et les repropose', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progFile));

  boutonAvecTexte(hote, 'Passer').declencher('click'); // passe e1 : file e2, e3, e1
  boutonAvecTexte(hote, 'C’est fait').declencher('click'); // valide e2 : file e3, e1
  boutonAvecTexte(hote, 'Passer').declencher('click'); // passe e3 : file e1, e3

  // Il ne reste que des exercices déjà passés (e1 et e3) : l’écran le dit,
  // sans jamais les compter comme un manquement — juste un texte et une
  // proposition de continuer.
  assert.equal(hote.querySelector('.nom-exercice'), null, 'ce n’est plus l’écran d’un exercice');
  // On lit l'ECRAN, pas un paragraphe en particulier : le nombre est l'objet
  // focal et la phrase l'explique en dessous, donc l'information est portee
  // par deux noeuds. Exiger qu'un seul les porte tous les deux contraindrait
  // la mise en forme sans rien prouver de plus.
  const paragraphes = hote.querySelectorAll('p').map((p) => p.textContent);
  const ecran = paragraphes.join(' ');
  assert.ok(ecran.includes('2') && ecran.includes('passés'), `l’écran ne mentionne pas les 2 exercices passés : ${paragraphes.join(' | ')}`);
  assert.ok(boutonAvecTexte(hote, 'Continuer') !== null);
  assert.ok(boutonAvecTexte(hote, 'Terminer la séance sans eux') !== null);

  boutonAvecTexte(hote, 'Continuer').declencher('click');
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'Exercice un', 'elle reprend le premier des exercices passés');
});

test('« Terminer la séance sans eux » garde ce qui est fait et ne coche pas la séance (PRD §9.1)', () => {
  const hote = creerHote();
  vueSeance.monterSeance(hote, ctxAvec({}, progFile));

  boutonAvecTexte(hote, 'Passer').declencher('click'); // passe e1
  boutonAvecTexte(hote, 'C’est fait').declencher('click'); // valide e2
  boutonAvecTexte(hote, 'Passer').declencher('click'); // passe e3 : n’en reste que des passés

  boutonAvecTexte(hote, 'Terminer la séance sans eux').declencher('click');
  assert.ok(boutonAvecTexte(hote, 'Retour') !== null);

  const e = etat.lireEtat();
  assert.deepEqual(e.faits.map((f) => f.exercice), ['e2'], 'seul ce qui a été validé est gardé');
  assert.equal(seanceEstFaite(progFile, e.faits, 1, 1), false, 'des exercices passés restent : la séance n’est pas faite');
});

// --- A3 bis : « Lancer » un seul exercice depuis le détail de la grille ----

test('cibleUniqueDepuisHash lit « #/seance/<numero>/<exercice>/<semaine> », rend null sinon', () => {
  assert.deepEqual(vueSeance.cibleUniqueDepuisHash('#/seance/2/e07/5'), { exercice: 'e07', semaine: 5 });
  assert.equal(vueSeance.cibleUniqueDepuisHash('#/seance/2'), null, 'la file entière, sans cible unique');
  assert.equal(vueSeance.cibleUniqueDepuisHash('#/seance/2/e07/0'), null, 'semaine hors bornes');
  assert.equal(vueSeance.cibleUniqueDepuisHash('#/seance/2/e07/9'), null, 'semaine hors bornes');
  assert.equal(vueSeance.cibleUniqueDepuisHash('#/seance/2/e07/abc'), null);
  assert.equal(vueSeance.cibleUniqueDepuisHash(undefined), null);
});

test('numeroDepuisHash lit toujours le numéro sur une route à cible unique', () => {
  assert.equal(vueSeance.numeroDepuisHash('#/seance/3/e07/5'), 3);
});

test('en mode cible unique, un seul exercice est monté, avec l’objectif de LA SEMAINE DE LA CASE et non de la semaine en cours', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/seance/1/e1/7' };
  // La fiche « vit » en semaine 1 (semaineDeDepart, sans date de début) :
  // sans la généralisation, l’objectif serait celui du premier palier.
  vueSeance.monterSeance(hote, ctxAvec({ debut: null, semaineDeDepart: 1 }, progSynthetique));

  assert.equal(hote.querySelectorAll('.nom-exercice').length, 1, 'un seul exercice à l’écran, jamais deux');
  assert.equal(hote.querySelector('.nom-exercice').textContent, 'x20 fois vite (libellé trompeur)');

  const ex = progSynthetique.exercices.find((e) => e.id === 'e1');
  const attenduSemaineDeLaCase = objectif(ex, 7).valeur;
  assert.equal(hote.querySelector('.decompte').textContent, formater(attenduSemaineDeLaCase * 1000));

  // « Passer » n’a de sens que sur une file à réordonner ; sur une cible
  // choisie exprès, elle reste masquée (`[hidden]`, voir style.css).
  const passerBouton = boutonAvecTexte(hote, 'Passer');
  assert.ok(passerBouton, 'garde-fou : le bouton doit exister, juste masqué');
  assert.equal(passerBouton.hidden, true);
});

test('valider un exercice lancé depuis la grille ajoute un fait à la semaine de LA CASE, et ramène à son détail — jamais à l’écran du jour', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/seance/1/e2/7' }; // e2 : repetitions, un seul geste
  vueSeance.monterSeance(hote, ctxAvec({ debut: null, semaineDeDepart: 1 }, progSynthetique));

  hote.querySelector('.bouton').declencher('click');

  const e = etat.lireEtat();
  assert.deepEqual(e.faits, [{ seance: 1, semaine: 7, exercice: 'e2', a: '2026-08-14T09:00:00.000Z' }]);

  boutonAvecTexte(hote, 'Retour').declencher('click');
  assert.equal(globalThis.location.hash, '#/grille/seance/7/1', 'retour au détail de la case, pas à « #/jour »');
});

test('relancer un exercice déjà marqué fait le rejoue quand même (refaire est permis)', () => {
  const hote = creerHote();
  globalThis.location = { hash: '#/seance/1/e2/1' };
  const ctx = ctxAvec({
    faits: [{ seance: 1, semaine: 1, exercice: 'e2', a: '2026-08-14T09:00:00.000Z' }],
    debut: null,
    semaineDeDepart: 1,
  }, progSynthetique);
  vueSeance.monterSeance(hote, ctx);

  assert.equal(
    hote.querySelector('.nom-exercice')?.textContent,
    'Tenir 1 min (libellé trompeur)',
    'un exercice déjà fait doit quand même s’afficher quand il est visé exprès',
  );
});

test('en mode cible unique, la file d’un aparté n’écrase jamais la file partagée d’une séance en cours ailleurs', () => {
  // Une séance normale est en cours à la semaine courante (1), numéro 1 :
  // « Passer » y a déjà réordonné la file.
  const hote1 = creerHote();
  globalThis.location = { hash: '#/seance/1' };
  vueSeance.monterSeance(hote1, ctxAvec({ debut: null, semaineDeDepart: 1 }, progFile));
  boutonAvecTexte(hote1, 'Passer').declencher('click');
  const fileAvant = etat.lireEtat().fileSeance;
  assert.deepEqual(fileAvant, { semaine: 1, numero: 1, file: ['e2', 'e3', 'e1'], passes: ['e1'] });

  // Elle lance un seul exercice d’une AUTRE case depuis la grille, et le
  // termine.
  const hote2 = creerHote();
  globalThis.location = { hash: '#/seance/2/e1/3' };
  vueSeance.monterSeance(hote2, ctxAvec({ debut: null, semaineDeDepart: 1 }, progFile));
  hote2.querySelector('.bouton').declencher('click');

  // La file de la séance normale, en cours ailleurs, n’a pas bougé.
  assert.deepEqual(etat.lireEtat().fileSeance, fileAvant);
});
