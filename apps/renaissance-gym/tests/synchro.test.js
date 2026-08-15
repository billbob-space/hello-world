// tests/synchro.test.js — le client de l'API (PRP 07, PRD §7.5, §9.8, §9.9,
// §11.2, §14).
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as etat from '../web/etat.js';
import * as synchro from '../web/synchro.js';
import { chargerProgramme } from '../web/programme.js';

const source = readFileSync(new URL('../web/synchro.js', import.meta.url), 'utf8');
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

let cible;
let originalDispatch;
let originalAdd;
let originalRemove;
let originalCustomEvent;

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.effacerEtat();

  // Un vrai EventTarget de Node sert de « window » factice pour EVT_ETAT et
  // 'online' (etat.js et synchro.js passent tous les deux par `globalThis`).
  cible = new EventTarget();
  originalDispatch = globalThis.dispatchEvent;
  originalAdd = globalThis.addEventListener;
  originalRemove = globalThis.removeEventListener;
  originalCustomEvent = globalThis.CustomEvent;
  globalThis.dispatchEvent = cible.dispatchEvent.bind(cible);
  globalThis.addEventListener = cible.addEventListener.bind(cible);
  globalThis.removeEventListener = cible.removeEventListener.bind(cible);
  globalThis.CustomEvent = class extends Event {};
});

afterEach(() => {
  globalThis.dispatchEvent = originalDispatch;
  globalThis.addEventListener = originalAdd;
  globalThis.removeEventListener = originalRemove;
  globalThis.CustomEvent = originalCustomEvent;
});

function compteAvecPseudo(partiel = {}) {
  return {
    ...etat.ETAT_VIDE, pseudo: 'Comète-7', code: '482913', ...partiel,
  };
}

function ficheReponse(partiel = {}) {
  return {
    pseudo: 'Comète-7',
    prenom: 'Léa',
    semaineDepart: 1,
    faits: [],
    badges: [],
    creeeLe: '2026-08-01T09:00:00.000Z',
    majLe: '2026-08-01T09:00:00.000Z',
    ...partiel,
  };
}

function fetchOk(corps, statut = 200) {
  return async () => ({
    ok: true,
    status: statut,
    json: async () => corps,
  });
}

function fetchRefus(code, statut = 401) {
  return async () => ({
    ok: false,
    status: statut,
    json: async () => ({ erreur: code, message: 'refuse' }),
  });
}

function fetchCasse() {
  return async () => { throw new Error('coupure reseau'); };
}

// --- les corps envoyés -------------------------------------------------------

test('corpsSynchronisation porte operation, pseudo, code, prenom, semaineDepart, faits, badges', () => {
  const e = compteAvecPseudo({
    prenom: 'Léa', semaineDeDepart: 3, faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z',
    }], badges: ['premier-jour'],
  });
  const corps = synchro.corpsSynchronisation(e);
  assert.equal(corps.operation, 'synchroniser');
  assert.equal(corps.pseudo, 'Comète-7');
  assert.equal(corps.code, '482913');
  assert.equal(corps.prenom, 'Léa');
  assert.equal(corps.semaineDepart, 3);
  assert.deepEqual(corps.faits, e.faits);
  assert.deepEqual(corps.badges, ['premier-jour']);
});

test('le code n’apparait dans le corps envoyé QUE dans le champ « code »', () => {
  const e = compteAvecPseudo({ prenom: 'Léa', semaineDeDepart: 1 });
  const corps = synchro.corpsSynchronisation(e);
  const chaine = JSON.stringify(corps);
  const occurrences = chaine.split('482913').length - 1;
  assert.equal(occurrences, 1, 'le code ne doit apparaitre qu’une seule fois dans tout le corps');
  assert.match(chaine, /"code":"482913"/);
});

test('synchro.js n’ecrit jamais le code dans un console.*', () => {
  const lignesConsole = source.split('\n').filter((l) => /console\.(log|warn|error|info)/.test(l));
  for (const ligne of lignesConsole) {
    assert.doesNotMatch(ligne, /\betat\.code\b/, `une ligne de journal semble porter le code : ${ligne}`);
    assert.doesNotMatch(ligne, /\bcode\b.*\betat\b|\betat\b.*\bcode\b/, `une ligne de journal semble porter le code : ${ligne}`);
  }
});

// --- envoiNecessaire ----------------------------------------------------------

test('envoiNecessaire est faux sans compte', () => {
  assert.equal(synchro.envoiNecessaire(etat.ETAT_VIDE), false);
});

test('envoiNecessaire est vrai des qu’un compte existe et n’a jamais reussi', () => {
  assert.equal(synchro.envoiNecessaire(compteAvecPseudo()), true);
});

test('envoiNecessaire est faux si tout ce qui existe est deja plus ancien que le dernier succes', () => {
  const e = compteAvecPseudo({
    dernierSucces: '2026-08-14T10:00:00.000Z',
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z',
    }],
  });
  assert.equal(synchro.envoiNecessaire(e), false);
});

test('envoiNecessaire est vrai si un fait est plus recent que le dernier succes', () => {
  const e = compteAvecPseudo({
    dernierSucces: '2026-08-14T09:00:00.000Z',
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T10:00:00.000Z',
    }],
  });
  assert.equal(synchro.envoiNecessaire(e), true);
});

// --- la fusion : le coeur du test « aucune reponse ne retire un fait local » -

test('synchroniser() FUSIONNE la reponse : aucun fait local ne disparait, meme absent de la reponse', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7',
    code: '482913',
    prenom: 'Léa',
    semaineDeDepart: 1,
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z',
    }],
  });
  const e = etat.lireEtat();

  // La reponse du serveur ne porte PAS le fait local — un serveur qui aurait
  // perdu une ecriture concurrente, par exemple.
  const resultat = await synchro.synchroniser(e, {
    fetch: fetchOk(ficheReponse({ faits: [] })),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });

  assert.equal(resultat.ok, true);
  const apres = etat.lireEtat();
  assert.deepEqual(apres.faits, e.faits, 'le fait local doit survivre, quoi que rende le serveur');
});

test('synchroniser() ajoute par union ce que le serveur apporte de nouveau', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7',
    code: '482913',
    prenom: 'Léa',
    semaineDeDepart: 1,
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z',
    }],
  });
  const e = etat.lireEtat();

  const resultat = await synchro.synchroniser(e, {
    fetch: fetchOk(ficheReponse({
      faits: [
        { seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z' },
        { seance: 1, semaine: 1, exercice: 'e02', a: '2026-08-13T09:00:00.000Z' },
      ],
    })),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });

  assert.equal(resultat.ok, true);
  const exercices = etat.lireEtat().faits.map((f) => f.exercice).sort();
  assert.deepEqual(exercices, ['e01', 'e02']);
});

test('la fusion garde le code local, jamais rendu par le serveur (reprise sur un second telephone)', async () => {
  const etatSynthetique = { ...etat.ETAT_VIDE, pseudo: 'Comète-7', code: '482913' };
  const resultat = await synchro.synchroniser(etatSynthetique, {
    fetch: fetchOk(ficheReponse({ prenom: 'Léa', semaineDepart: 3 })),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });
  assert.equal(resultat.ok, true);
  const apres = etat.lireEtat();
  assert.equal(apres.code, '482913');
  assert.equal(apres.prenom, 'Léa');
  assert.equal(apres.semaineDeDepart, 3);
  assert.equal(apres.debut, '2026-08-01T09:00:00.000Z', 'debut s’ancre sur creeeLe quand l’appareil n’en avait pas');
});

test('un prenom local deja renseigne n’est pas ecrase par un serveur pas plus recent', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1, dernierSucces: '2026-08-14T09:00:00.000Z',
  });
  const e = etat.lireEtat();
  const resultat = await synchro.synchroniser(e, {
    fetch: fetchOk(ficheReponse({ prenom: 'Autre', majLe: '2026-08-14T08:00:00.000Z' })), // plus ancien
    maintenant: () => new Date('2026-08-14T09:30:00.000Z'),
  });
  assert.equal(resultat.ok, true);
  assert.equal(etat.lireEtat().prenom, 'Léa', 'le serveur n’est pas plus recent : le local doit gagner');
});

test('un serveur plus recent que le dernier succes local reprend la main sur le prenom', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1, dernierSucces: '2026-08-14T09:00:00.000Z',
  });
  const e = etat.lireEtat();
  const resultat = await synchro.synchroniser(e, {
    fetch: fetchOk(ficheReponse({ prenom: 'Changé ailleurs', majLe: '2026-08-14T10:00:00.000Z' })), // plus recent
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });
  assert.equal(resultat.ok, true);
  assert.equal(etat.lireEtat().prenom, 'Changé ailleurs');
});

// --- reseau coupe : jamais d'exception, jamais de perte --------------------

test('reseau coupe : synchroniser() ne leve jamais et garde les faits locaux', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7',
    code: '482913',
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T09:00:00.000Z',
    }],
  });
  const e = etat.lireEtat();

  await assert.doesNotReject(() => synchro.synchroniser(e, {
    fetch: fetchCasse(),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  }));

  const resultat = await synchro.synchroniser(e, {
    fetch: fetchCasse(),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });
  assert.equal(resultat.ok, false);
  assert.deepEqual(etat.lireEtat().faits, e.faits, 'rien ne doit avoir bougé côté faits locaux');
  assert.equal(etat.lireEtat().dernierEnvoi, '2026-08-14T11:00:00.000Z');
  assert.equal(etat.lireEtat().dernierSucces, null);
});

test('un code refuse par le serveur ne leve jamais non plus', async () => {
  const e = compteAvecPseudo();
  const resultat = await synchro.synchroniser(e, {
    fetch: fetchRefus('code-refuse'),
    maintenant: () => new Date('2026-08-14T11:00:00.000Z'),
  });
  assert.equal(resultat.ok, false);
  assert.equal(resultat.code, 'code-refuse');
});

// --- effacer() n'ecrit rien localement --------------------------------------

test('effacer() ne touche jamais au stockage local : c’est a l’appelant de le faire', async () => {
  etat.ecrireEtat({ pseudo: 'Comète-7', code: '482913', prenom: 'Léa' });
  await synchro.effacer(etat.lireEtat(), { fetch: fetchOk(null, 204) });
  assert.equal(etat.lireEtat().prenom, 'Léa', 'effacer() seul ne doit rien changer localement');
});

test('effacer() rend ok:false sur un refus, sans lever', async () => {
  const resultat = await synchro.effacer(compteAvecPseudo(), { fetch: fetchRefus('code-refuse') });
  assert.equal(resultat.ok, false);
  assert.equal(resultat.code, 'code-refuse');
});

// --- formaterFraicheur --------------------------------------------------------

test('formaterFraicheur rend « à l’instant », des minutes, des heures, ou « hier »', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  assert.equal(synchro.formaterFraicheur('2026-08-14T11:59:30.000Z', () => t), 'à l’instant');
  assert.equal(synchro.formaterFraicheur('2026-08-14T11:58:00.000Z', () => t), 'il y a 2 min');
  assert.equal(synchro.formaterFraicheur('2026-08-14T10:00:00.000Z', () => t), 'il y a 2 h');
  assert.equal(synchro.formaterFraicheur('2026-08-13T12:00:00.000Z', () => t), 'hier');
  assert.equal(synchro.formaterFraicheur('2026-08-10T12:00:00.000Z', () => t), 'il y a 4 j');
});

// --- etatSynchro : les cinq statuts, jamais bloquants -----------------------

test('etatSynchro : « jamais » sans compte ou avant tout envoi', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  assert.equal(synchro.etatSynchro(etat.ETAT_VIDE, () => t, true).statut, 'jamais');
  assert.equal(synchro.etatSynchro(compteAvecPseudo(), () => t, true).statut, 'jamais');
});

test('etatSynchro : « hors-ligne » avec la phrase exacte du PRP 07', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  const e = compteAvecPseudo({ dernierEnvoi: '2026-08-14T09:00:00.000Z', dernierSucces: '2026-08-14T09:00:00.000Z' });
  const info = synchro.etatSynchro(e, () => t, false);
  assert.equal(info.statut, 'hors-ligne');
  assert.equal(info.phrase, 'Pas de réseau — ce sera sauvegardé plus tard');
});

test('etatSynchro : « echec » quand le dernier essai n’a pas reussi', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  const e = compteAvecPseudo({ dernierEnvoi: '2026-08-14T09:00:00.000Z', dernierSucces: null });
  const info = synchro.etatSynchro(e, () => t, true);
  assert.equal(info.statut, 'echec');
});

test('etatSynchro : « en-attente » quand un fait attend d’etre envoyé', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  const e = compteAvecPseudo({
    dernierEnvoi: '2026-08-14T09:00:00.000Z',
    dernierSucces: '2026-08-14T09:00:00.000Z',
    faits: [{
      seance: 1, semaine: 1, exercice: 'e01', a: '2026-08-14T10:00:00.000Z',
    }],
  });
  const info = synchro.etatSynchro(e, () => t, true);
  assert.equal(info.statut, 'en-attente');
});

test('etatSynchro : « a-jour » avec la fraicheur composee dans la phrase', () => {
  const t = new Date('2026-08-14T12:00:00.000Z');
  const e = compteAvecPseudo({ dernierEnvoi: '2026-08-14T11:58:00.000Z', dernierSucces: '2026-08-14T11:58:00.000Z' });
  const info = synchro.etatSynchro(e, () => t, true);
  assert.equal(info.statut, 'a-jour');
  assert.equal(info.phrase, 'Sauvegardé il y a 2 min');
});

test('aucun des cinq statuts n’est un texte qui bloque ou qui alarme', () => {
  for (const phrase of Object.values(synchro.PHRASES)) {
    assert.doesNotMatch(phrase, /erreur fatale|reessayer maintenant|echec critique/i);
  }
});

// --- brancher() : les trois declencheurs, bornes par INTERVALLE_MIN_MS -----

test('brancher() tente un envoi a l’ouverture si un compte existe deja', async () => {
  etat.ecrireEtat({ pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1 });
  let appels = 0;
  const debrancher = synchro.brancher(
    { programme: prog },
    { fetch: fetchOk(ficheReponse()), maintenant: () => new Date('2026-08-14T12:00:00.000Z') },
  );
  // brancher() declenche une tentative asynchrone : laisser les microtasks
  // se resoudre avant de constater l'effet.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  appels = etat.lireEtat().dernierSucces !== null ? 1 : 0;
  assert.equal(appels, 1, 'un compte deja present doit declencher une tentative des l’ouverture');
  debrancher();
});

test('brancher() ne tente rien a l’ouverture sans compte', async () => {
  const debrancher = synchro.brancher(
    { programme: prog },
    { fetch: fetchOk(ficheReponse()), maintenant: () => new Date('2026-08-14T12:00:00.000Z') },
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(etat.lireEtat().dernierEnvoi, null);
  debrancher();
});

test('brancher() : la fin d’une seance declenche un envoi, un exercice seul jamais', async () => {
  etat.ecrireEtat({
    pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1, dernierSucces: '2026-08-01T00:00:00.000Z',
  });
  let horloge = new Date('2026-08-14T12:00:00.000Z');
  const debrancher = synchro.brancher(
    { programme: prog },
    { fetch: fetchOk(ficheReponse()), maintenant: () => horloge },
  );
  await Promise.resolve();
  await Promise.resolve();
  const avantExercices = etat.lireEtat().dernierEnvoi;

  const s1 = prog.seances.find((s) => s.id === 's1');
  // Tous les exercices sauf le dernier : la seance n'est pas encore finie.
  for (const id of s1.exercices.slice(0, -1)) {
    etat.ajouterFait({
      seance: 1, semaine: 1, exercice: id, a: '2026-08-14T09:00:00.000Z',
    });
  }
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(etat.lireEtat().dernierEnvoi, avantExercices, 'aucun exercice seul ne doit declencher un envoi');

  // Le dernier exercice de la seance : elle est terminee, ca part.
  horloge = new Date('2026-08-14T12:01:00.000Z'); // + INTERVALLE_MIN_MS
  etat.ajouterFait({
    seance: 1, semaine: 1, exercice: s1.exercices.at(-1), a: '2026-08-14T09:00:00.000Z',
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.notEqual(etat.lireEtat().dernierEnvoi, avantExercices, 'la fin de la seance doit declencher un envoi');

  debrancher();
});

test('brancher() : deux declenchements rapproches n’envoient qu’une fois (INTERVALLE_MIN_MS)', async () => {
  etat.ecrireEtat({ pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1 });
  let nombreAppels = 0;
  const fetchCompteur = async (...args) => {
    nombreAppels += 1;
    return fetchOk(ficheReponse())(...args);
  };
  const horloge = new Date('2026-08-14T12:00:00.000Z');
  const debrancher = synchro.brancher(
    { programme: prog },
    { fetch: fetchCompteur, maintenant: () => horloge },
  );
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(nombreAppels, 1);

  // 'online' juste apres : l'intervalle minimal n'est pas ecoule.
  globalThis.dispatchEvent(new Event('online'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(nombreAppels, 1, 'deux declenchements rapproches ne doivent envoyer qu’une fois');

  debrancher();
});

test('debrancher() arrete d’ecouter : plus aucun envoi apres', async () => {
  etat.ecrireEtat({ pseudo: 'Comète-7', code: '482913', prenom: 'Léa', semaineDeDepart: 1 });
  const debrancher = synchro.brancher(
    { programme: prog },
    { fetch: fetchOk(ficheReponse()), maintenant: () => new Date('2026-08-14T12:00:00.000Z') },
  );
  await new Promise((r) => { setTimeout(r, 0); });
  debrancher();

  const dernierEnvoiAvant = etat.lireEtat().dernierEnvoi;
  assert.notEqual(dernierEnvoiAvant, null, 'garde-fou : le premier envoi doit avoir eu lieu avant de debrancher');
  globalThis.dispatchEvent(new Event('online'));
  await new Promise((r) => { setTimeout(r, 0); });
  assert.equal(etat.lireEtat().dernierEnvoi, dernierEnvoiAvant, 'debrancher() doit couper toute reaction future');
});

// --- purete de forme : jamais d'exception qui remonte -----------------------

test('creer(), synchroniser(), effacer() ne levent jamais, quoi qu’il arrive au reseau', async () => {
  const e = compteAvecPseudo();
  await assert.doesNotReject(() => synchro.creer(e, { fetch: fetchCasse() }));
  await assert.doesNotReject(() => synchro.synchroniser(e, { fetch: fetchCasse() }));
  await assert.doesNotReject(() => synchro.effacer(e, { fetch: fetchCasse() }));
  await assert.doesNotReject(() => synchro.creer(e, { fetch: undefined }));
});
