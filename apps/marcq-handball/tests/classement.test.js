// tests/classement.test.js — ce qui part au serveur, et quand.
//
// Aucun reseau : `fetch` est injecte. Aucun navigateur : `document`, `window` et
// la minuterie le sont aussi. Ce repertoire n'est jamais embarque dans l'image.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as etat from '../web/etat.js';
import * as classement from '../web/classement.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

function poserMagasin(magasin) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true, value: magasin,
  });
}

function fauxMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get length() { return donnees.size; },
    key(i) { return [...donnees.keys()][i] ?? null; },
    getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
    setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
    removeItem(cle) { donnees.delete(cle); },
    contenu() { return Object.fromEntries(donnees); },
  };
}

// Un faux `fetch` qui note ce qu'il a recu et sert les reponses dans l'ordre.
function fauxFetch(reponses) {
  const appels = [];
  const file = [...reponses];
  const f = async (url, init) => {
    appels.push({ url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(init.body) : null, init });
    const suivante = file.length > 1 ? file.shift() : file[0];
    if (typeof suivante === 'function') return suivante();
    return suivante;
  };
  f.appels = appels;
  return f;
}

function reponse(statut, corps, typeContenu = 'application/json; charset=utf-8') {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    headers: { get: (nom) => (nom.toLowerCase() === 'content-type' ? typeContenu : null) },
    json: async () => corps,
  };
}

const INSTANTANE = {
  jour: '2026-08-07', programmees: 22, participants: 2,
  classement: [
    { rang: 1, cochees: 22, part: 1, pseudo: 'Renard' },
    { rang: 2, cochees: 20, part: 0.909, pseudo: 'Faucon-12' },
  ],
  groupe: { cochees: 42, programmees: 44, part: 0.955 },
};

const MOI = {
  pseudo: 'Faucon-12', jour: '2026-08-07', rang: 2, participants: 2,
  cochees: 20, programmees: 22, part: 0.909, ignores: 3,
};

const horlogeFigee = () => new Date('2026-08-07T18:00:00.000Z');

// Le document minimal dont synchroniser a besoin : il emet, on ecoute.
function fauxDocument() {
  const ecouteurs = new Map();
  return {
    evenements: [],
    addEventListener(nom, fn) { ecouteurs.set(fn, nom); },
    removeEventListener(fn) { ecouteurs.delete(fn); },
    dispatchEvent(evt) { this.evenements.push(evt); return true; },
    declencher(nom) { for (const [fn, n] of ecouteurs) if (n === nom) fn(); },
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.toutEffacer();
});

// --- la garantie qui ne se voit pas a l'ecran ------------------------------

test('la couche reseau ne connait pas le nom garde sur le telephone (PRD §5)', () => {
  // Le contexte du PRP 03 porte ce nom, et il est passe a tout ecran. C'est le
  // seul chemin par lequel il pourrait atteindre le reseau, et il ne sera
  // jamais emprunte par accident — il le sera par commodite, le jour ou
  // quelqu'un voudra ecrire « Salut Lucas » au-dessus du formulaire.
  //
  // Le test lit AUSSI les commentaires : un mot entre par la porte du
  // commentaire finit dans une chaine a la retouche suivante.
  //
  // Le pendant de cette assertion sur web/vue-rejoindre.js vit dans
  // tests/rejoindre.test.js, avec le reste de ce que cet ecran dit.
  assert.equal(
    source('classement.js').includes('prenom'), false,
    'la couche reseau ne doit pas contenir la sous-chaine interdite',
  );
});

test('le corps d envoi porte trois cles, et aucune autre', () => {
  const corps = classement.corpsEnvoi({
    pseudo: 'Faucon-12', code: '4821',
    faits: { 's1-c2': 'b', 's1-c1': 'a' },
    // Un contexte bavard ne fait pas passer une valeur en trop : corpsEnvoi
    // n'en lit que trois, et le serveur refuserait le reste en 400.
    surnom: 'Lucas',
  });
  assert.deepEqual(Object.keys(corps), ['pseudo', 'code', 'faits']);
  assert.deepEqual(corps.faits, ['s1-c1', 's1-c2'], 'identifiants tries');
  assert.equal(JSON.stringify(corps).includes('Lucas'), false);
});

test('le corps de suppression porte trois cles, ni faits ni ressentis', () => {
  const corps = classement.corpsSuppression({ pseudo: 'Faucon-12', code: '4821' });
  assert.deepEqual(Object.keys(corps), ['pseudo', 'code', 'supprimer']);
  assert.equal(corps.supprimer, true);
});

// --- l empreinte, qui remplace la file d attente ---------------------------

test('l empreinte change a chaque cochage ET a chaque decochage', () => {
  assert.equal(classement.empreinte({}), '', 'rien de coche');

  const un = classement.empreinte({ 's1-c1': '2026-08-03T18:00:00.000Z' });
  const deux = classement.empreinte({
    's1-c1': '2026-08-03T18:00:00.000Z', 's1-c2': '2026-08-03T18:05:00.000Z',
  });
  assert.notEqual(un, deux, 'cocher augmente le maximum');

  // Decocher diminue le nombre : le maximum, lui, peut ne pas bouger.
  const apresDecochage = classement.empreinte({ 's1-c2': '2026-08-03T18:05:00.000Z' });
  assert.notEqual(deux, apresDecochage, 'decocher change l empreinte');
});

test('envoiNecessaire est faux juste apres un envoi confirme, vrai apres un cochage', () => {
  const faits = { 's1-c1': '2026-08-03T18:00:00.000Z' };
  const local = {
    pseudo: 'Faucon-12', code: '4821',
    dernierEnvoi: { at: 'peu importe', empreinte: classement.empreinte(faits) },
  };
  assert.equal(classement.envoiNecessaire(local, faits), false);

  const apres = { ...faits, 's1-c2': '2026-08-03T18:05:00.000Z' };
  assert.equal(classement.envoiNecessaire(local, apres), true);

  // Sans pseudonyme, rien ne part : on ne rejoint pas par accident.
  assert.equal(classement.envoiNecessaire({ ...local, pseudo: null }, apres), false);
});

// --- les trois appels ------------------------------------------------------

test('un fetch qui rejette rend statut 0 sans jamais jeter', async () => {
  const f = async () => { throw new Error('offline'); };
  const r = await classement.relever({ fetch: f });
  assert.deepEqual(r, { ok: false, statut: 0, erreur: null, message: null });
});

test('une erreur en texte brut ne fait pas jeter le chemin d erreur (le 405)', async () => {
  // http.ServeMux repond 405 en texte brut : un JSON.parse dessus jetterait la
  // ou plus rien ne rattrape.
  const f = fauxFetch([reponse(405, null, 'text/plain; charset=utf-8')]);
  const r = await classement.relever({ fetch: f });
  assert.deepEqual(r, { ok: false, statut: 405, erreur: null, message: null });

  const g = fauxFetch([reponse(403, null, 'text/plain')]);
  const s = await classement.envoyer({ pseudo: 'Faucon-12', code: '4821', faits: {} }, { fetch: g });
  assert.deepEqual(s, { ok: false, statut: 403, erreur: null, message: null });
});

test('l enveloppe d erreur du serveur remonte telle quelle', async () => {
  const f = fauxFetch([reponse(403, {
    erreur: 'code-refuse', message: 'Ce nom est déjà pris, ou le code ne correspond pas.',
  })]);
  const r = await classement.envoyer({ pseudo: 'Faucon-12', code: '0000', faits: {} }, { fetch: f });
  assert.equal(r.ok, false);
  assert.equal(r.statut, 403);
  assert.equal(r.erreur, 'code-refuse');
  assert.equal(r.message, 'Ce nom est déjà pris, ou le code ne correspond pas.');
});

test('aucun appel ne porte de parametre d URL', async () => {
  const f = fauxFetch([reponse(200, INSTANTANE)]);
  await classement.relever({ fetch: f });
  assert.equal(f.appels[0].url, '/api/classement');
  assert.equal(f.appels[0].init.cache, 'no-store');
});

// --- synchroniser ----------------------------------------------------------

test('sans pseudonyme, on releve sans jamais rejoindre', async () => {
  const f = fauxFetch([reponse(200, INSTANTANE)]);
  const doc = fauxDocument();
  const r = await classement.synchroniser({}, { fetch: f, doc, maintenant: horlogeFigee });

  assert.equal(r.ok, true);
  assert.equal(f.appels.length, 1);
  assert.equal(f.appels[0].methode, 'GET');
  const local = etat.lireClassement();
  assert.deepEqual(local.dernierRangConnu.instantane, INSTANTANE);
  assert.equal(local.dernierRangConnu.moi, null);
  assert.equal(local.dernierEnvoi, null, 'aucun envoi n a eu lieu');
  assert.equal(doc.evenements.length, 1, 'un seul evenement par appel');
});

test('un 201 est traite comme un 200, et un envoi accepte est suivi de son GET', async () => {
  etat.ecrireClassement({ pseudo: 'Faucon-12', code: '4821' });
  etat.cocher('s1-c1', '2026-08-03T18:00:00.000Z');

  const f = fauxFetch([reponse(201, MOI), reponse(200, INSTANTANE)]);
  const doc = fauxDocument();
  const r = await classement.synchroniser({}, { fetch: f, doc, maintenant: horlogeFigee });

  assert.equal(r.ok, true);
  assert.equal(r.cree, true, '201 = le pseudonyme vient d etre pris');
  assert.equal(f.appels.length, 2, 'le POST est suivi d un GET dans le meme appel');
  assert.equal(f.appels[0].methode, 'POST');
  assert.equal(f.appels[1].methode, 'GET');

  // dernierRangConnu porte les DEUX corps : sans le releve, le podium resterait
  // sur la valeur d'avant l'envoi alors que le rang vient de changer.
  const local = etat.lireClassement();
  assert.deepEqual(local.dernierRangConnu.moi, MOI);
  assert.deepEqual(local.dernierRangConnu.instantane, INSTANTANE);
  assert.equal(local.dernierEnvoi.empreinte, classement.empreinte(etat.lireFaits()));
  assert.equal(local.code, '4821', 'le code survit a l ecriture du rang');

  // UN SEUL evenement, sinon le PRP 09 remonterait son bloc deux fois, dont une
  // avec un podium d'avant l'envoi.
  assert.equal(doc.evenements.length, 1);
  assert.deepEqual(doc.evenements[0].detail.moi, MOI);
  assert.deepEqual(doc.evenements[0].detail.instantane, INSTANTANE);
});

test('un 200 sur un envoi laisse cree a faux', async () => {
  etat.ecrireClassement({ pseudo: 'Faucon-12', code: '4821' });
  etat.cocher('s1-c1', '2026-08-03T18:00:00.000Z');

  const f = fauxFetch([reponse(200, MOI), reponse(200, INSTANTANE)]);
  const r = await classement.synchroniser({}, { fetch: f, doc: fauxDocument(), maintenant: horlogeFigee });
  assert.equal(r.cree, false);
});

test('un 503 ne touche pas a dernierEnvoi — le declencheur suivant refera l envoi', async () => {
  etat.ecrireClassement({
    pseudo: 'Faucon-12', code: '4821',
    dernierEnvoi: { at: '2026-08-06T10:00:00.000Z', empreinte: 'ancienne' },
  });
  etat.cocher('s1-c1', '2026-08-03T18:00:00.000Z');

  const f = fauxFetch([reponse(503, { erreur: 'classement-indisponible', message: 'Indisponible.' })]);
  const doc = fauxDocument();
  const r = await classement.synchroniser({}, { fetch: f, doc, maintenant: horlogeFigee });

  assert.equal(r.ok, false);
  assert.equal(etat.lireClassement().dernierEnvoi.empreinte, 'ancienne', 'un envoi perdu ne laisse aucune trace');
  // L'evenement part quand meme, avec ce qu'on savait : l'ecran doit pouvoir
  // dire « ca n'a pas repondu » plutot que de rester muet.
  assert.equal(doc.evenements.length, 1);
  assert.equal(doc.evenements[0].detail.statut, 503);
});

test('un releve conserve moi, un envoi conserve instantane', async () => {
  etat.ecrireClassement({
    pseudo: 'Faucon-12', code: '4821',
    dernierRangConnu: { recuA: '2026-08-06T10:00:00.000Z', instantane: INSTANTANE, moi: MOI },
    dernierEnvoi: { at: '2026-08-06T10:00:00.000Z', empreinte: classement.empreinte({}) },
  });

  // Rien de neuf a envoyer : on releve, et `moi` doit survivre.
  const f = fauxFetch([reponse(200, { ...INSTANTANE, participants: 3 })]);
  await classement.synchroniser({}, { fetch: f, doc: fauxDocument(), maintenant: horlogeFigee });

  const local = etat.lireClassement();
  assert.deepEqual(local.dernierRangConnu.moi, MOI, 'le seul rang que le serveur ait tranche survit');
  assert.equal(local.dernierRangConnu.instantane.participants, 3);
});

// --- le debit --------------------------------------------------------------

test('deux declenchements rapproches ne produisent qu une requete', async () => {
  const f = fauxFetch([reponse(200, INSTANTANE)]);
  const doc = fauxDocument();
  const fenetre = fauxDocument();
  const minuterie = { poser: () => 0, annuler: () => {} };

  const debrancher = classement.brancherSynchronisation({}, {
    fetch: f, doc, fenetre, minuterie, maintenant: horlogeFigee,
  });
  await new Promise((r) => setImmediate(r));

  // L'horloge est figee : le second declencheur tombe dans l'intervalle.
  doc.declencher('marcq:seance-complete');
  fenetre.declencher('online');
  await new Promise((r) => setImmediate(r));

  assert.equal(f.appels.length, 1, 'le debit protege l enfant du rate-limit du palier');
  debrancher();
});

test('debrancher coupe les declencheurs', async () => {
  const f = fauxFetch([reponse(200, INSTANTANE)]);
  const doc = fauxDocument();
  const fenetre = fauxDocument();
  let temps = Date.parse('2026-08-07T18:00:00.000Z');

  const debrancher = classement.brancherSynchronisation({}, {
    fetch: f, doc, fenetre, minuterie: { poser: () => 0, annuler: () => {} },
    maintenant: () => new Date(temps),
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(f.appels.length, 1);

  debrancher();
  temps += classement.INTERVALLE_MIN_MS * 2;
  doc.declencher('marcq:seance-complete');
  await new Promise((r) => setImmediate(r));
  assert.equal(f.appels.length, 1, 'plus rien ne part apres debranchement');
});

// --- la sortie -------------------------------------------------------------

test('la suppression n efface rien localement tant que le serveur n a pas repondu 200', async () => {
  for (const echec of [
    reponse(503, { erreur: 'classement-indisponible', message: 'Indisponible.' }),
    reponse(403, { erreur: 'code-refuse', message: 'Ce nom est déjà pris, ou le code ne correspond pas.' }),
  ]) {
    poserMagasin(fauxMagasin());
    etat.toutEffacer();
    etat.ecrireClassement({ pseudo: 'Faucon-12', code: '4821' });

    const r = await classement.retirer({ pseudo: 'Faucon-12', code: '4821' }, {
      fetch: fauxFetch([echec]), doc: fauxDocument(),
    });
    assert.equal(r.ok, false);
    assert.equal(etat.lireClassement().pseudo, 'Faucon-12',
      'effacer d abord ferait perdre le code, donc le seul moyen de retirer le nom');
  }
});

test('un 200 efface la cle locale, que supprime vaille true ou false', async () => {
  for (const corps of [
    { pseudo: 'Faucon-12', supprime: true, jour: '2026-08-07', participants: 8 },
    { pseudo: 'Faucon-12', supprime: false, jour: '2026-08-07', participants: 9 },
  ]) {
    poserMagasin(fauxMagasin());
    etat.toutEffacer();
    etat.ecrireClassement({ pseudo: 'Faucon-12', code: '4821' });

    const f = fauxFetch([reponse(200, corps)]);
    const doc = fauxDocument();
    const r = await classement.retirer({ pseudo: 'Faucon-12', code: '4821' }, { fetch: f, doc });

    assert.equal(r.ok, true);
    assert.deepEqual(r.suppression, corps);
    assert.equal(etat.lireClassement().pseudo, null,
      'dans les deux cas, plus rien au classement ne se rattache a ce telephone');
    // Le corps envoye ne porte ni faits ni ressentis.
    assert.deepEqual(Object.keys(f.appels[0].corps), ['pseudo', 'code', 'supprimer']);
    // Le bloc du PRP 09 doit cesser de montrer un rang qui n'existe plus.
    assert.deepEqual(doc.evenements[0].detail, { instantane: null, moi: null, statut: 200 });
  }
});
