// tests/coach.test.js — la page du coach : ce qu'elle montre, et ce qu'elle
// refuse de pouvoir montrer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as coach from '../web/vue-coach.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// La reponse d'exemple du contrat de l'API, telle que le serveur l'emet.
const REPONSE = {
  jour: '2026-08-07',
  programmees: 22,
  participants: 9,
  classement: [
    { rang: 1, cochees: 22, part: 1, pseudo: 'Renard' },
    { rang: 2, cochees: 20, part: 0.909, pseudo: 'K7' },
    { rang: 3, cochees: 19, part: 0.864, pseudo: 'Bibou' },
    { rang: 4, cochees: 19, part: 0.864 },
  ],
  groupe: { cochees: 121, programmees: 198, part: 0.611 },
  assiduite: { aucune: 1, faible: 2, moyenne: 3, forte: 3 },
  seances: [
    { date: '2026-08-03', titre: 'Endurance + Renforcement', exercices: 8, cochees: 61, participantsActifs: 8, participantsAyantFini: 6 },
    { date: '2026-08-05', titre: 'Fractionné', exercices: 8, cochees: 40, participantsActifs: 6, participantsAyantFini: 3 },
  ],
  ressentis: { facile: 4, correct: 11, dur: 6 },
};

function reponseHttp(statut, corps, type = 'application/json; charset=utf-8') {
  return {
    ok: statut >= 200 && statut < 300,
    status: statut,
    headers: { get: (n) => (n.toLowerCase() === 'content-type' ? type : null) },
    json: async () => corps,
  };
}

// --- le modele --------------------------------------------------------------

test('l en-tete dit un denominateur honnete, jamais un effectif d equipe', () => {
  const m = coach.modeleCoach(REPONSE);
  assert.equal(m.entete.jourLisible, 'vendredi 7 août');
  assert.match(m.entete.phrase, /^9 participants au classement/);
  assert.match(m.entete.phrase, /22 exercices programmés à ce jour$/);
});

test('les quatre paliers d assiduite sont toujours la, meme a zero', () => {
  // Masquer un palier vide masquerait precisement « aucune », la seule ligne
  // qui demande une action.
  const m = coach.modeleCoach({ ...REPONSE, assiduite: { forte: 9 } });
  assert.deepEqual(m.assiduite.map((a) => a.cle), ['aucune', 'faible', 'moyenne', 'forte']);
  assert.deepEqual(m.assiduite.map((a) => a.nombre), [0, 0, 0, 9]);
  // Le palier haut nomme la cible, pour que le coach la lise sans la recalculer.
  assert.match(m.assiduite[3].aide, /60 % et plus/);
});

test('le modele ne fabrique JAMAIS un nom absent', () => {
  const m = coach.modeleCoach(REPONSE);
  assert.deepEqual(m.classement.map((l) => l.nomme), [true, true, true, false]);
  assert.deepEqual(m.classement.map((l) => l.etiquette), ['Renard', 'K7', 'Bibou', 'Rang 4']);
  assert.equal(m.classement[3].pseudo, null);
});

test('une ligne de seance par entree recue, et aucune date en dur', () => {
  const m = coach.modeleCoach(REPONSE);
  assert.equal(m.seances.length, 2);
  assert.equal(m.seances[0].dateLisible, 'lundi 3 août');
  // La deuxieme mesure du PRD §4 se lit sur la derniere ligne : combien de
  // l'effectif est encore actif.
  assert.equal(m.seances[1].actifs, 6);
  assert.equal(m.seances[1].finis, 3);
  assert.equal(m.seances[0].possibles, 8 * 9, 'exercices x participants');
});

test('la repartition des ressentis somme a 100 %', () => {
  const m = coach.modeleCoach(REPONSE);
  assert.equal(m.ressentis.total, 21);
  assert.equal(m.ressentis.vide, null);
  const somme = m.ressentis.lignes.reduce((n, l) => n + l.part, 0);
  assert.ok(Math.abs(somme - 1) < 1e-9, `parts = ${somme}`);
  // Les emojis sont ceux du panneau des enfants, jamais une seconde copie.
  assert.deepEqual(m.ressentis.lignes.map((l) => l.cle), ['facile', 'correct', 'dur']);
});

test('on ne dessine pas une repartition de rien', () => {
  const m = coach.modeleCoach({ ...REPONSE, ressentis: {} });
  assert.equal(m.ressentis.total, 0);
  assert.match(m.ressentis.vide, /Aucun ressenti/);
  assert.deepEqual(m.ressentis.lignes.map((l) => l.pourcent), [0, 0, 0]);
});

test('personne n a rejoint n est pas une erreur', () => {
  const m = coach.modeleCoach({
    jour: '2026-08-07', programmees: 22, participants: 0,
    classement: [], groupe: { cochees: 0, programmees: 0, part: 0 },
    assiduite: {}, seances: [], ressentis: {},
  });
  assert.equal(m.entete.participants, 0);
  assert.deepEqual(m.classement, []);
  assert.equal(m.groupe.echelle, 1, '<progress max="0"> est invalide');
  assert.match(m.ressentis.vide, /Aucun ressenti/);
});

// --- les phrases ------------------------------------------------------------

test('les trois etats degrades ont chacun leur phrase, et aucune ne tutoie', () => {
  assert.equal(coach.messageCoach(0, null), coach.PHRASES_COACH['hors-ligne']);
  // C'est l'etat par defaut du serveur tant qu'aucun repertoire n'est monte :
  // la page doit le dire, pas le traiter comme une panne.
  assert.equal(coach.messageCoach(503, 'classement-indisponible'), coach.PHRASES_COACH.indisponible);
  assert.equal(coach.messageCoach(500, null), coach.PHRASES_COACH.echec);
  assert.equal(coach.messageCoach(405, null), coach.PHRASES_COACH.echec);

  for (const p of Object.values(coach.PHRASES_COACH)) {
    assert.equal(/\bTu\b|\bton\b|\bta\b|Réessaie/.test(p), false, `tutoiement dans « ${p} »`);
  }
});

test('la mention dit au coach que sa page est publique', () => {
  // Le PRD §13 ecarte le mot de passe : ne rien dire laisserait croire a une
  // protection, ce qui est exactement le reproche fait au mot de passe.
  assert.match(coach.MENTION_PUBLIQUE, /publique/);
  assert.match(coach.MENTION_PUBLIQUE, /aucun nom d’enfant/);
  assert.ok(source('vue-coach.js').includes('MENTION_PUBLIQUE'), 'et elle est affichee');
});

test('l heure du releve est celle du club', () => {
  // 17 h 04 UTC = 19 h 04 a Paris en aout.
  assert.equal(coach.heureDuReleve(new Date('2026-08-07T17:04:00Z')), '19 h 04');
});

// --- le releve --------------------------------------------------------------

test('un fetch qui rejette rend statut 0 sans jamais jeter', async () => {
  const r = await coach.releverCoach({ fetch: async () => { throw new Error('offline'); } });
  assert.deepEqual(r, { ok: false, statut: 0, erreur: null });
});

test('un 503 remonte son code d erreur, un 405 en texte brut ne fait pas jeter', async () => {
  const r = await coach.releverCoach({
    fetch: async () => reponseHttp(503, { erreur: 'classement-indisponible', message: 'x' }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.erreur, 'classement-indisponible');

  const t = await coach.releverCoach({ fetch: async () => reponseHttp(405, null, 'text/plain') });
  assert.deepEqual(t, { ok: false, statut: 405, erreur: null });
});

test('le releve n interroge que sa propre route, sans parametre', async () => {
  const vus = [];
  await coach.releverCoach({
    fetch: async (url, init) => { vus.push([url, init.cache]); return reponseHttp(200, REPONSE); },
  });
  assert.deepEqual(vus, [['/api/coach', 'no-store']]);
});

// --- ce que la page n expose pas -------------------------------------------

test('la page coach ne peut RIEN lire du telephone de qui que ce soit', () => {
  // La contrainte n'est pas « la page est protegee », c'est « la page n'a rien
  // a proteger ». Elle ne tient que si elle est verifiee, pas seulement voulue —
  // et c'est elle qui rend acceptable l'absence de mot de passe (PRD §7.6, §13).
  const code = source('vue-coach.js');

  const imports = [...code.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./ressenti.js', './vue-jour.js'],
    'deux imports, et aucun ne touche au stockage');

  // Ni directement, ni par un transitif : vue-jour.js n'importe que domaine.js,
  // ressenti.js n'importe rien du tout.
  for (const module of imports) {
    const transitif = [...source(module.replace('./', '')).matchAll(/^import .* from '([^']+)';$/gm)]
      .map((m) => m[1]);
    assert.equal(transitif.includes('./etat.js'), false, `${module} entraine le stockage`);
  }

  for (const interdit of ['etat.js', 'lirePrenom', 'lireFaits', 'lireClassement', 'lireRessentis', 'localStorage']) {
    assert.equal(code.includes(interdit), false, `${interdit} n a rien a faire ici`);
  }
  assert.equal(code.includes('prenom'), false);
  assert.equal(code.includes('innerHTML'), false);
});

test('la page coach ne parle qu a sa propre route', () => {
  const code = source('vue-coach.js');
  const chemins = [...code.matchAll(/'(\/[a-z/-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(chemins)], ['/api/coach'],
    'aucun autre chemin reseau : c est ce qui empeche le « puisqu on y est, montrons aussi »');
});

test('la coque hors ligne connait les deux modules', () => {
  const sw = source('sw.js');
  assert.match(sw, /'\/vue-coach\.js'/);
  assert.match(sw, /'\/ressenti\.js'/);
  // /api/ reste exclu du cache : un etat de groupe resservi s'afficherait comme
  // frais.
  assert.ok(sw.includes("url.pathname.startsWith('/api/')"));
});
