// tests/suppression.test.js — retirer un nom du classement depuis un telephone
// qui ne le connait pas.
//
// Le bloc des reglages n'existait QUE sur le telephone porteur du nom. Un parent
// qui cree un nom pour son enfant depuis son propre telephone, puis fait
// « changer d'enfant », laisse un nom que plus personne ne peut retirer : le
// serveur l'accepterait — POST /api/classement avec le nom et son code —, mais
// aucun ecran ne le proposait plus. Ce fichier tient l'autre moitie du geste.
//
// Le montage touche au DOM, donc le DOM est faux : un `createElement` minimal
// qui garde les enfants et les ecouteurs, comme tests/equipe.test.js.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as rejoindre from '../web/vue-rejoindre.js';
import { CLE_CLASSEMENT } from '../web/etat.js';

// --- le faux telephone ------------------------------------------------------

function poserMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      get length() { return donnees.size; },
      key(i) { return [...donnees.keys()][i] ?? null; },
      getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
      setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
      removeItem(cle) { donnees.delete(cle); },
      contenu() { return Object.fromEntries(donnees); },
    },
  });
}

function faussElement(balise) {
  return {
    balise,
    className: '',
    enfants: [],
    ecouteurs: new Map(),
    attributs: {},
    hidden: false,
    disabled: false,
    value: '',
    id: '',
    textContent: '',
    classList: {
      classes: new Set(),
      add(...c) { c.forEach((x) => this.classes.add(x)); },
      remove(...c) { c.forEach((x) => this.classes.delete(x)); },
      contains(c) { return this.classes.has(c); },
    },
    append(...n) { this.enfants.push(...n); },
    focus() {},
    setAttribute(n, v) { this.attributs[n] = v; },
    removeAttribute(n) { delete this.attributs[n]; },
    addEventListener(nom, fn) {
      if (!this.ecouteurs.has(nom)) this.ecouteurs.set(nom, []);
      this.ecouteurs.get(nom).push(fn);
    },
    removeEventListener() {},
    remove() {},
    async declencher(nom, evt = { preventDefault() {} }) {
      for (const fn of this.ecouteurs.get(nom) ?? []) await fn(evt);
    },
  };
}

function poserDocumentFactice() {
  globalThis.document = {
    createElement: (balise) => faussElement(balise),
    addEventListener() {},
    removeEventListener() {},
  };
}

// Parcours en profondeur : le bloc est un arbre, et les tests cherchent dedans
// par balise ou par classe sans connaitre l'imbrication choisie au montage.
function tous(noeud, predicat, trouves = []) {
  for (const e of noeud.enfants ?? []) {
    if (predicat(e)) trouves.push(e);
    tous(e, predicat, trouves);
  }
  return trouves;
}

const parBalise = (noeud, balise) => tous(noeud, (e) => e.balise === balise);
const parClasse = (noeud, classe) => tous(
  noeud,
  (e) => typeof e.className === 'string' && e.className.split(/\s+/).includes(classe),
);
const textes = (noeud) => tous(noeud, () => true).map((e) => e.textContent).join(' ');

// --- le faux serveur --------------------------------------------------------

function poserFetch(reponses) {
  const appels = [];
  globalThis.fetch = async (url, init) => {
    appels.push({ url, corps: JSON.parse(init.body) });
    const r = reponses.shift();
    if (r === undefined) throw new Error('appel reseau non prevu');
    if (r === 'panne') throw new Error('reseau coupe');
    return {
      ok: r.statut < 400,
      status: r.statut,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => r.corps,
    };
  };
  return appels;
}

function poserEnLigne(enLigne) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true, value: { onLine: enLigne },
  });
}

let confirmations = [];
function poserConfirm(reponse) {
  confirmations = [];
  globalThis.confirm = (question) => { confirmations.push(question); return reponse; };
}

// Monte le bloc dans un hote neuf et le rend.
function monter() {
  const hote = faussElement('section');
  rejoindre.monterSuppression(hote, { aller() {} });
  return hote;
}

beforeEach(() => {
  poserMagasin();
  poserDocumentFactice();
  poserEnLigne(true);
  poserConfirm(true);
  globalThis.fetch = async () => { throw new Error('appel reseau non prevu'); };
});

// --- ce qui manquait --------------------------------------------------------

test('le bloc existe meme quand ce telephone ne connait aucun nom', () => {
  const hote = monter();

  assert.equal(hote.enfants.length, 1, 'le bloc est monte, et une seule fois');
  const [bloc] = hote.enfants;
  assert.ok(bloc.className.includes('bloc-danger'), 'il porte la zone de danger des reglages');
  assert.equal(parBalise(bloc, 'h2')[0].textContent, rejoindre.TITRE_BLOC_SUPPRESSION);

  // Deux champs : le nom, et son code. C'est la seule facon de designer une
  // fiche que ce telephone ne connait pas.
  const champs = parBalise(bloc, 'input');
  assert.equal(champs.length, 2);
  assert.equal(champs[1].inputMode, 'numeric', 'le code appelle le pave numerique');
  assert.equal(champs[1].maxLength, 4);
  assert.equal(parBalise(bloc, 'button').length, 1, 'un bouton, et un seul');
});

test('le telephone qui porte le nom garde son bouton d un seul tap', () => {
  poserMagasin({ [CLE_CLASSEMENT]: JSON.stringify({ pseudo: 'Renard-14', code: '1234' }) });
  const hote = monter();
  const [bloc] = hote.enfants;

  assert.equal(parBalise(bloc, 'input').length, 0, 'rien a retaper : le telephone sait deja');
  const boutons = parBalise(bloc, 'button');
  assert.equal(boutons.length, 1);
  assert.equal(boutons[0].textContent, 'Supprimer « Renard-14 »');
});

test('le nom et le code tapes partent en suppression, et le nom est normalise', async () => {
  const appels = poserFetch([{
    statut: 200,
    corps: { pseudo: 'Charlie', supprime: true, jour: '2026-08-07', participants: 7 },
  }]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');

  // Deux espaces et une apostrophe de clavier : ce que produit un telephone.
  champPseudo.value = '  Charlie  ';
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0].corps, { pseudo: 'Charlie', code: '4242', supprimer: true });
  assert.equal(parClasse(bloc, 'retour')[0].textContent, rejoindre.RETIRE);

  // Le geste est confirme avant d'agir, et la question nomme la fiche.
  assert.deepEqual(confirmations, [rejoindre.phraseSuppression('Charlie')]);
});

test('un nom que le serveur ne connait plus n est pas une erreur', async () => {
  poserFetch([{
    statut: 200,
    corps: { pseudo: 'Charlie', supprime: false, jour: '2026-08-07', participants: 7 },
  }]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(parClasse(bloc, 'retour')[0].textContent, rejoindre.DEJA_RETIRE);
});

test('un code qui ne correspond pas affiche la phrase du serveur, et rien d autre', async () => {
  poserFetch([{
    statut: 403,
    corps: { erreur: 'code-refuse', message: 'Ce nom est déjà pris, ou le code ne correspond pas.' },
  }]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '0000';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(
    parClasse(bloc, 'retour')[0].textContent,
    'Ce nom est déjà pris, ou le code ne correspond pas.',
  );
  // UN ECHEC NE VIDE AUCUN CHAMP : retaper quatre chiffres apres un refus est la
  // friction qui fait abandonner (PRD §14).
  assert.equal(champPseudo.value, 'Charlie');
  assert.equal(champCode.value, '0000');
  assert.equal(parBalise(bloc, 'button')[0].disabled, false, 'on peut retenter');
});

// --- ce qui n atteint jamais le reseau --------------------------------------

test('un code a trois chiffres ne part pas, et le dit sous le champ', async () => {
  const appels = poserFetch([]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '424';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(appels.length, 0);
  assert.ok(textes(bloc).includes(rejoindre.ERREURS_CODE.longueur));
  assert.deepEqual(confirmations, [], 'on ne demande pas confirmation d un geste impossible');
});

test('un nom vide ne part pas', async () => {
  const appels = poserFetch([]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [, champCode] = parBalise(bloc, 'input');
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(appels.length, 0);
  assert.ok(textes(bloc).includes(rejoindre.ERREURS_PSEUDO.vide));
});

test('hors ligne, la suppression ne se met pas en attente : elle le dit', async () => {
  poserEnLigne(false);
  const appels = poserFetch([]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(appels.length, 0);
  assert.equal(parClasse(bloc, 'retour')[0].textContent, rejoindre.SANS_RESEAU_SUPPRESSION);
});

test('une confirmation refusee n envoie rien', async () => {
  poserConfirm(false);
  const appels = poserFetch([]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.equal(appels.length, 0);
});

// --- ce que le bloc ne fait surtout pas -------------------------------------

test('supprimer un nom etranger ne touche pas au telephone', async () => {
  // Ce telephone n'a pas de nom au classement — c'est la definition de ce
  // chemin —, mais il garde le reste de son etat. Retirer un nom du serveur
  // n'est pas se deconnecter : rien de local ne doit disparaitre.
  poserMagasin({ 'marcq.v1.prenom': 'Papa', 'marcq.v1.faits': '{"s1-r1":"2026-08-03T18:00:00.000Z"}' });
  poserFetch([{
    statut: 200,
    corps: { pseudo: 'Charlie', supprime: true, jour: '2026-08-07', participants: 7 },
  }]);
  const hote = monter();
  const [bloc] = hote.enfants;
  const [champPseudo, champCode] = parBalise(bloc, 'input');
  champPseudo.value = 'Charlie';
  champCode.value = '4242';
  await parBalise(bloc, 'form')[0].declencher('submit');

  assert.deepEqual(globalThis.localStorage.contenu(), {
    'marcq.v1.prenom': 'Papa',
    'marcq.v1.faits': '{"s1-r1":"2026-08-03T18:00:00.000Z"}',
  });
});

test('la saisie ne passe pas par retirer : elle n a rien a effacer ni a annoncer', () => {
  // `retirer` efface la cle locale ET emet un EVT_CLASSEMENT a instantane nul,
  // qui viderait le podium deja affiche sur l'ecran de l'equipe. Le chemin de
  // saisie appelle `supprimer`, qui ne fait que la requete.
  const code = rejoindre.monterSuppression.toString();
  assert.equal(code.includes('retirer('), false, 'le montage delegue, il ne choisit pas ici');
});
