// tests/seance.test.js — l'écran de séance (PRP 04 chantier C, PRD §5, §7.3,
// §9.1, §9.2, §11.3).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/programme.js';
import * as vueSeance from '../web/vue-seance.js';
import * as etat from '../web/etat.js';
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

function ctxAvec({ faits = [], debut = null, semaineDeDepart = 1 } = {}, programme = progSynthetique) {
  return {
    etat: { ...etat.ETAT_VIDE, faits, debut, semaineDeDepart },
    programme,
    maintenant: () => new Date('2026-08-14T09:00:00.000Z'),
  };
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
