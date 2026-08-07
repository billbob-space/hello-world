// tests/code-perime.test.js — ce qui arrive quand le code garde par le
// telephone n'est plus celui du serveur.
//
// LE PIEGE, SIGNALE PAR UN UTILISATEUR. Un nom supprime puis recree prend un
// nouveau code. Le telephone qui portait l'ancien garde un lien MORT : le
// serveur repond 403 a tout ce qu'il envoie. Or les trois gestes de cet ecran
// — reprendre sa progression, quitter le classement, supprimer son profil —
// renvoient tous ce meme code stocke, et l'ecran qui permet d'en saisir un
// autre disparait des qu'un nom est enregistre. Aucune sortie, sauf vider le
// navigateur, donc perdre toute la progression.
//
// La regle qui ferme le piege : UN 403 SIGNIFIE QUE CE TELEPHONE N'A DEJA PLUS
// AUCUN DROIT SUR CE NOM. Garder le lien ne protege rien — il n'y a plus rien a
// proteger. Une panne de reseau, elle, garde tout : la fiche est peut-etre
// encore la notre.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as classement from '../web/classement.js';
import * as rejoindre from '../web/vue-rejoindre.js';
import * as reglages from '../web/vue-reglages.js';
import * as etat from '../web/etat.js';
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
    href: '',
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
    // `parent` est tenu a jour, et `remove()` detache pour de vrai : sans cela
    // le faux DOM mentirait sur le seul geste que ces tests verifient — un
    // bouton qui doit disparaitre une fois qu'il n'a plus d'objet.
    parent: null,
    append(...n) { n.forEach((e) => { e.parent = this; }); this.enfants.push(...n); },
    replaceChildren(...n) { n.forEach((e) => { e.parent = this; }); this.enfants = [...n]; },
    focus() {},
    remove() {
      if (this.parent === null) return;
      this.parent.enfants = this.parent.enfants.filter((e) => e !== this);
      this.parent = null;
    },
    setAttribute(n, v) { this.attributs[n] = v; },
    removeAttribute(n) { delete this.attributs[n]; },
    addEventListener(nom, fn) {
      if (!this.ecouteurs.has(nom)) this.ecouteurs.set(nom, []);
      this.ecouteurs.get(nom).push(fn);
    },
    removeEventListener() {},
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

function tous(noeud, predicat, trouves = []) {
  for (const e of noeud.enfants ?? []) {
    if (predicat(e)) trouves.push(e);
    tous(e, predicat, trouves);
  }
  return trouves;
}

const parBalise = (n, balise) => tous(n, (e) => e.balise === balise);
const parClasse = (n, classe) => tous(
  n, (e) => typeof e.className === 'string' && e.className.split(/\s+/).includes(classe),
);
const textes = (n) => tous(n, () => true).map((e) => e.textContent).join(' ');

const boutonDit = (n, texte) => parBalise(n, 'button').find((b) => b.textContent === texte);

// --- le faux serveur --------------------------------------------------------

function reponse(statut, corps) {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => corps,
  };
}

const REFUS_CODE = reponse(403, {
  erreur: 'code-refuse',
  message: 'Ce nom est déjà pris, ou le code ne correspond pas.',
});
const PANNE = reponse(503, {
  erreur: 'classement-indisponible',
  message: 'Le classement n’est pas disponible pour le moment.',
});

function poserFetch(reponses) {
  const appels = [];
  globalThis.fetch = async (url, init) => {
    appels.push({ url, corps: init?.body ? JSON.parse(init.body) : null });
    const suivante = reponses.length > 1 ? reponses.shift() : reponses[0];
    if (suivante === undefined) throw new Error('appel reseau non prevu');
    return suivante;
  };
  return appels;
}

function poserConfirm(reponse_ = true) {
  globalThis.confirm = () => reponse_;
}

const TELEPHONE = {
  [CLE_PRENOM]: 'Alexandre',
  [CLE_FAITS]: '{"s1-r1":"2026-08-03T18:00:00.000Z"}',
  [CLE_CLASSEMENT]: JSON.stringify({ pseudo: 'Alexandre', code: '1111' }),
};

beforeEach(() => {
  poserMagasin(TELEPHONE);
  poserDocumentFactice();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true, value: { onLine: true },
  });
  poserConfirm(true);
  globalThis.fetch = async () => { throw new Error('appel reseau non prevu'); };
});

// --- 1. le magasin : un 403 libere, une panne garde -------------------------

test('un refus de code libere le lien local — il etait deja mort', async () => {
  poserFetch([REFUS_CODE]);
  const r = await classement.retirer({ pseudo: 'Alexandre', code: '1111' });

  assert.equal(r.ok, false);
  assert.equal(r.libere, true, 'le telephone a lache le nom');
  assert.equal(etat.lireClassement().pseudo, null);
  // Ce que le telephone garde par ailleurs n'est pas concerne : on lache un
  // nom, on n'efface pas un profil.
  assert.equal(etat.lirePrenom(), 'Alexandre');
  assert.equal(Object.keys(etat.lireFaits()).length, 1);
});

test('une panne du serveur ne libere rien : la fiche est peut-etre encore la notre', async () => {
  poserFetch([PANNE]);
  const r = await classement.retirer({ pseudo: 'Alexandre', code: '1111' });

  assert.equal(r.ok, false);
  assert.notEqual(r.libere, true);
  assert.equal(etat.lireClassement().pseudo, 'Alexandre',
    'effacer ici ferait perdre le code, donc le seul moyen de retirer le nom');
});

test('trop d essais ne libere rien non plus : la penalite est temporaire', async () => {
  poserFetch([reponse(429, { erreur: 'trop-d-essais', message: 'Trop d’essais sur ce nom.' })]);
  const r = await classement.retirer({ pseudo: 'Alexandre', code: '1111' });

  assert.notEqual(r.libere, true);
  assert.equal(etat.lireClassement().code, '1111', 'le code est peut-etre le bon');
});

// --- 2. la synchronisation ne rejoue plus un refus definitif ----------------

test('un refus definitif n est PAS rejoue', async () => {
  // Trois reprises a 5, 15 et 45 secondes sur un 403 font QUATRE codes refuses
  // en une minute. Le serveur ferme un nom a cinq refus par quart d'heure : deux
  // ouvertures de l'app suffisent donc a fermer le nom — et la fermeture porte
  // sur le NOM, pas sur l'appareil. Ce telephone-ci bloquait ainsi le
  // proprietaire legitime du compte, sur son autre telephone.
  const appels = poserFetch([REFUS_CODE]);
  const differes = [];
  const debrancher = classement.brancherSynchronisation({}, {
    fetch: globalThis.fetch,
    doc: faussElement('html'),
    fenetre: faussElement('window'),
    minuterie: { poser: (fn, ms) => { differes.push({ fn, ms }); return differes.length; }, annuler: () => {} },
    maintenant: () => new Date('2026-08-07T18:00:00.000Z'),
  });
  await new Promise((r) => setImmediate(r));

  assert.equal(appels.length, 1, 'un seul envoi, et pas quatre');
  assert.deepEqual(differes, [], 'aucune reprise n est meme posee');
  debrancher();
});

test('une panne, elle, se rejoue : c est a cela que servent les reprises', async () => {
  poserFetch([PANNE]);
  const differes = [];
  const debrancher = classement.brancherSynchronisation({}, {
    fetch: globalThis.fetch,
    doc: faussElement('html'),
    fenetre: faussElement('window'),
    minuterie: { poser: (fn, ms) => { differes.push({ fn, ms }); return differes.length; }, annuler: () => {} },
    maintenant: () => new Date('2026-08-07T18:00:00.000Z'),
  });
  await new Promise((r) => setImmediate(r));

  assert.equal(differes.length, 1);
  assert.equal(differes[0].ms, classement.REPRISES_MS[0]);
  debrancher();
});

test('estTransitoire trie les statuts, et le fait pour les deux appelants', () => {
  for (const statut of [0, 500, 502, 503, 504]) {
    assert.equal(classement.estTransitoire({ statut }), true, `${statut} merite une reprise`);
  }
  for (const statut of [400, 403, 409, 429]) {
    assert.equal(classement.estTransitoire({ statut }), false, `${statut} ne passera jamais en le rejouant`);
  }
});

// --- 3. les ecrans : la sortie existe, et elle est dite ---------------------

function monterReglages() {
  const hote = faussElement('main');
  const allees = [];
  reglages.monterReglages(hote, { prenom: 'Alexandre', aller: (r) => allees.push(r) });
  return { hote, allees, ecran: hote.enfants[0] };
}

const blocDe = (ecran, titre) => (ecran.enfants ?? []).find(
  (b) => parBalise(b, 'h2').some((h) => h.textContent === titre),
);

test('« quitter le classement » aboutit sur un refus de code, et le dit', async () => {
  poserFetch([REFUS_CODE]);
  const { ecran } = monterReglages();
  const bloc = blocDe(ecran, rejoindre.TITRE_QUITTER_CLASSEMENT);

  await boutonDit(bloc, rejoindre.texteBoutonQuitter('Alexandre')).declencher('click');

  assert.equal(etat.lireClassement().pseudo, null, 'le telephone a lache le nom');
  assert.equal(parClasse(bloc, 'retour')[0].textContent, rejoindre.NOM_ETRANGER);
  assert.equal(boutonDit(bloc, rejoindre.texteBoutonQuitter('Alexandre')), undefined,
    'le bouton part : il n y a plus rien a quitter');
});

test('« supprimer mon profil » aboutit sur un refus de code', async () => {
  poserFetch([REFUS_CODE]);
  const { ecran, allees } = monterReglages();
  const bloc = blocDe(ecran, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDit(bloc, reglages.TITRE_SUPPRIMER_PROFIL).declencher('click');

  // Le serveur n'avait rien a retirer pour ce telephone : le nom ne lui
  // appartient plus. Refuser d'effacer le profil pour autant, c'est enfermer.
  assert.deepEqual(globalThis.localStorage.contenu(), {});
  assert.deepEqual(allees, ['#/']);
});

test('« supprimer mon profil » n efface toujours rien sur une panne', async () => {
  poserFetch([PANNE]);
  const { ecran, allees } = monterReglages();
  const bloc = blocDe(ecran, reglages.TITRE_SUPPRIMER_PROFIL);

  await boutonDit(bloc, reglages.TITRE_SUPPRIMER_PROFIL).declencher('click');

  assert.deepEqual(globalThis.localStorage.contenu(), TELEPHONE);
  assert.deepEqual(allees, []);
});

test('« recuperer ma progression » ouvre la porte pour ressaisir un code', async () => {
  // Le geste ne redemande jamais de code — c'est voulu, un second formulaire
  // serait une seconde occasion de se tromper. Mais quand le serveur vient de
  // REFUSER le code stocke, ce n'est plus une precaution : c'est le mur. On
  // ouvre alors, et alors seulement, le chemin vers l'ecran de saisie.
  poserFetch([REFUS_CODE]);
  const hote = faussElement('section');
  rejoindre.monterActionClassement(hote, { prog: null, rafraichir() {}, aller() {} });

  const bouton = boutonDit(hote, rejoindre.TEXTE_RECUPERER);
  await bouton.declencher('click');

  const lien = parBalise(hote, 'a').find((a) => a.textContent === rejoindre.REPRENDRE_AVEC_UN_CODE);
  assert.ok(lien, 'le chemin de sortie est propose');
  assert.equal(lien.href, '#/rejoindre');
  assert.ok(textes(hote).includes('Ce nom est déjà pris, ou le code ne correspond pas.'));
});

test('sur une panne, aucun chemin de sortie n est propose : il n y a rien a fuir', async () => {
  poserFetch([PANNE]);
  const hote = faussElement('section');
  rejoindre.monterActionClassement(hote, { prog: null, rafraichir() {}, aller() {} });

  await boutonDit(hote, rejoindre.TEXTE_RECUPERER).declencher('click');

  assert.equal(
    parBalise(hote, 'a').some((a) => a.textContent === rejoindre.REPRENDRE_AVEC_UN_CODE), false,
  );
});
