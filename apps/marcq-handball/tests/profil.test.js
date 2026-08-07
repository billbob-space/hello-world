// tests/profil.test.js — les deux gestes de sortie des reglages, et ce qui les
// separe.
//
// « Changer d'enfant » etait nomme par sa RAISON — un frere, une soeur, un
// telephone partage — et pas par son effet. Il effacait tout le telephone et
// laissait le nom au classement, que plus personne ne pouvait alors retirer :
// le code partait avec le reste. Il s'appelle « Supprimer mon profil » et
// emporte desormais le nom aussi.
//
// L'ORDRE EST LE SUJET DE CE FICHIER. Le serveur d'abord, le telephone ensuite,
// et rien n'est efface tant que le nom n'est pas retire — sans quoi le geste
// recree exactement le trou qu'il repare.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as reglages from '../web/vue-reglages.js';
import * as rejoindre from '../web/vue-rejoindre.js';
import { CLE_CLASSEMENT, CLE_FAITS, CLE_PRENOM } from '../web/etat.js';

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
  // Pas de `dispatchEvent` : les modules qui emettent EVT_CLASSEMENT le
  // verifient et se taisent. Un ecouteur d'ecran n'a rien a faire ici.
  globalThis.document = {
    createElement: (balise) => faussElement(balise),
    addEventListener() {},
    removeEventListener() {},
  };
}

function tous(noeud, predicat, trouves = []) {
  for (const e of noeud.enfants ?? []) {
    if (predicat(e)) trouves.push(e);
    tous(e, predicat, trouves);
  }
  return trouves;
}

const parBalise = (noeud, balise) => tous(noeud, (e) => e.balise === balise);
const parTexte = (noeud, texte) => tous(noeud, (e) => e.textContent === texte);

// Le bloc dont le titre <h2> porte ce texte.
function blocIntitule(hote, titre) {
  const ecran = hote.enfants[0];
  const bloc = (ecran.enfants ?? []).find(
    (b) => parBalise(b, 'h2').some((h) => h.textContent === titre),
  );
  assert.ok(bloc, `aucun bloc intitule « ${titre} » dans les reglages`);
  return bloc;
}

const boutonDe = (bloc, texte) => {
  const b = parBalise(bloc, 'button').find((x) => x.textContent === texte);
  assert.ok(b, `aucun bouton « ${texte} »`);
  return b;
};

// --- le faux serveur --------------------------------------------------------

function poserFetch(reponses) {
  const appels = [];
  globalThis.fetch = async (url, init) => {
    appels.push({ url, corps: JSON.parse(init.body) });
    const r = reponses.shift();
    if (r === undefined) throw new Error('appel reseau non prevu');
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

const TELEPHONE_INSCRIT = {
  [CLE_PRENOM]: 'Charlie',
  [CLE_FAITS]: '{"s1-r1":"2026-08-03T18:00:00.000Z","s1-r2":"2026-08-03T18:05:00.000Z"}',
  [CLE_CLASSEMENT]: JSON.stringify({ pseudo: 'Renard-14', code: '1234' }),
};

let allees = [];
function monter() {
  allees = [];
  const hote = faussElement('main');
  reglages.monterReglages(hote, { prenom: 'Charlie', aller: (r) => allees.push(r) });
  return hote;
}

const RETRAIT_OK = {
  statut: 200,
  corps: { pseudo: 'Renard-14', supprime: true, jour: '2026-08-07', participants: 7 },
};

beforeEach(() => {
  poserMagasin();
  poserDocumentFactice();
  poserEnLigne(true);
  poserConfirm(true);
  globalThis.fetch = async () => { throw new Error('appel reseau non prevu'); };
});

// --- les deux gestes portent enfin le nom de leur effet ----------------------

test('le geste total s appelle par son effet, pas par sa raison', () => {
  poserMagasin(TELEPHONE_INSCRIT);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  assert.equal(reglages.TITRE_SUPPRIMER_PROFIL, 'Supprimer mon profil');
  boutonDe(bloc, 'Supprimer mon profil');
  // Le frere, la soeur et le telephone partage restent dits — c'est a quoi ce
  // geste sert —, mais dans l'explication, plus dans le titre.
  assert.match(tous(bloc, () => true).map((e) => e.textContent).join(' '), /frère, une sœur/);
});

test('le geste partiel dit qu on quitte le classement, et lui seul', () => {
  poserMagasin(TELEPHONE_INSCRIT);
  const hote = monter();
  const bloc = blocIntitule(hote, rejoindre.TITRE_QUITTER_CLASSEMENT);

  assert.equal(rejoindre.TITRE_QUITTER_CLASSEMENT, 'Quitter le classement');
  boutonDe(bloc, rejoindre.texteBoutonQuitter('Renard-14'));
  assert.equal(rejoindre.texteBoutonQuitter('Renard-14'), 'Retirer « Renard-14 » du classement');
});

test('les deux blocs coexistent, le plus doux avant le plus total', () => {
  poserMagasin(TELEPHONE_INSCRIT);
  const ecran = monter().enfants[0];
  const titres = tous(ecran, (e) => e.balise === 'h2').map((h) => h.textContent);

  assert.ok(
    titres.indexOf(rejoindre.TITRE_QUITTER_CLASSEMENT) < titres.indexOf(reglages.TITRE_SUPPRIMER_PROFIL),
    'quitter le classement se propose avant de tout supprimer',
  );
});

// --- l ordre, qui est tout le sujet -----------------------------------------

test('le nom part du classement AVANT que le telephone ne soit efface', async () => {
  poserMagasin(TELEPHONE_INSCRIT);
  const appels = poserFetch([RETRAIT_OK]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.deepEqual(appels[0].corps, { pseudo: 'Renard-14', code: '1234', supprimer: true });
  assert.deepEqual(globalThis.localStorage.contenu(), {}, 'le telephone est vide ensuite');
  assert.deepEqual(allees, ['#/'], 'et on repart sur le premier lancement');
});

test('le serveur refuse : RIEN n est efface, et l ecran le dit', async () => {
  poserMagasin(TELEPHONE_INSCRIT);
  poserFetch([{
    statut: 503,
    corps: { erreur: 'classement-indisponible', message: 'Le classement n’est pas disponible pour le moment.' },
  }]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  // C'est ici que se joue la correction : effacer malgre l'echec perdrait le
  // code, donc le seul moyen de retirer un nom qui, lui, resterait en ligne.
  assert.deepEqual(globalThis.localStorage.contenu(), TELEPHONE_INSCRIT);
  assert.deepEqual(allees, [], 'on ne quitte pas les reglages sur un echec');
  const retour = tous(bloc, (e) => e.className === 'retour')[0];
  assert.match(retour.textContent, /Le classement n’est pas disponible pour le moment\./);
  assert.match(retour.textContent, /Rien n’a été effacé\./);
});

test('hors ligne avec un nom au classement, le geste n agit pas et le dit', async () => {
  poserEnLigne(false);
  poserMagasin(TELEPHONE_INSCRIT);
  const appels = poserFetch([]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.equal(appels.length, 0);
  assert.deepEqual(globalThis.localStorage.contenu(), TELEPHONE_INSCRIT);
  assert.equal(
    tous(bloc, (e) => e.className === 'retour')[0].textContent,
    reglages.PROFIL_SANS_RESEAU,
  );
});

// --- le telephone sans nom au classement n a besoin de personne -------------

test('sans nom au classement, supprimer son profil n appelle pas le reseau', async () => {
  poserMagasin({ [CLE_PRENOM]: 'Charlie', [CLE_FAITS]: '{"s1-r1":"2026-08-03T18:00:00.000Z"}' });
  const appels = poserFetch([]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.equal(appels.length, 0, 'il n y a rien a retirer nulle part');
  assert.deepEqual(globalThis.localStorage.contenu(), {});
  assert.deepEqual(allees, ['#/']);
});

test('sans nom au classement, le geste marche hors ligne', async () => {
  poserEnLigne(false);
  poserMagasin({ [CLE_PRENOM]: 'Charlie' });
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  // Le reseau n'est exige que par ce qui vit sur le serveur. Rien ici n'y vit.
  assert.deepEqual(globalThis.localStorage.contenu(), {});
});

// --- ce qui est annonce avant d agir ----------------------------------------

test('la confirmation annonce le nom au classement quand il y en a un', async () => {
  poserMagasin(TELEPHONE_INSCRIT);
  poserFetch([RETRAIT_OK]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.equal(confirmations.length, 1);
  // La question du PRD §7.2 vient EN PREMIER — elle porte le « ? » et decide —,
  // et l'autre moitie du geste s'annonce dessous. L'ordre inverse ferait lire la
  // conséquence avant de savoir de quoi il s'agit.
  assert.ok(confirmations[0].startsWith(reglages.CONFIRMATION_SUPPRESSION_PROFIL));
  assert.match(confirmations[0], /efface le prénom et toute la progression/);
  assert.match(confirmations[0], /« Renard-14 »/, 'le nom retire est nomme');
  assert.match(confirmations[0], /disparaît\s+pour tout le monde/, 'et ce qu il lui arrive');
});

test('sans nom au classement, la confirmation ne parle pas de classement', async () => {
  poserMagasin({ [CLE_PRENOM]: 'Charlie' });
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.equal(confirmations[0], reglages.CONFIRMATION_SUPPRESSION_PROFIL);
  assert.equal(/classement/.test(confirmations[0]), false);
});

test('une confirmation refusee n efface rien et n appelle rien', async () => {
  poserConfirm(false);
  poserMagasin(TELEPHONE_INSCRIT);
  const appels = poserFetch([]);
  const hote = monter();
  const bloc = blocIntitule(hote, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDe(bloc, 'Supprimer mon profil').declencher('click');

  assert.equal(appels.length, 0);
  assert.deepEqual(globalThis.localStorage.contenu(), TELEPHONE_INSCRIT);
});

// --- ce que le geste ne laisse plus derriere lui -----------------------------

test('plus aucune phrase n avertit d un nom orpheline : le cas n existe plus', () => {
  // L'avertissement « plus personne ne pourra le supprimer » decrivait une
  // impasse a celui qui allait y entrer. Ce n'etait pas un garde-fou, c'etait la
  // documentation du defaut — et le defaut est corrige.
  assert.equal('avertissementChangementEnfant' in rejoindre, false);
  assert.equal(
    parTexte(monter().enfants[0], 'Changer d’enfant').length, 0,
    'le geste ne se nomme plus par sa raison',
  );
});
