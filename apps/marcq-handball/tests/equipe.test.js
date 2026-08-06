// tests/equipe.test.js — le podium, la position et la jauge, sans navigateur.
//
// Les fonctions du modele sont pures : c'est ce qui rend prouvables les trois
// regles du PRD §9 que cet ecran porte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as equipe from '../web/vue-equipe.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// Un instantane a neuf participants, tel que le PRP 07 l'emet : toutes les
// lignes, nommees jusqu'a la troisieme, rangs stricts de 1 a N.
const NEUF = {
  jour: '2026-08-07',
  programmees: 22,
  participants: 9,
  classement: [
    { rang: 1, cochees: 22, part: 1, pseudo: 'Renard' },
    { rang: 2, cochees: 20, part: 0.909, pseudo: 'K7' },
    { rang: 3, cochees: 19, part: 0.864, pseudo: 'Bibou' },
    { rang: 4, cochees: 19, part: 0.864 },
    { rang: 5, cochees: 14, part: 0.636 },
    { rang: 6, cochees: 12, part: 0.545 },
    { rang: 7, cochees: 9, part: 0.409 },
    { rang: 8, cochees: 6, part: 0.273 },
    { rang: 9, cochees: 0, part: 0 },
  ],
  groupe: { cochees: 121, programmees: 198, part: 0.611 },
};

const instantaneDe = (parts) => ({
  jour: '2026-08-07',
  programmees: 22,
  participants: parts.length,
  classement: parts.map((cochees, i) => ({ rang: i + 1, cochees, part: cochees / 22 })),
  groupe: { cochees: parts.reduce((a, b) => a + b, 0), programmees: 22 * parts.length, part: 0.5 },
});

// --- l ordinal --------------------------------------------------------------

test('rangOrdinal ecrit 1er, et jamais 1e ni 2eme', () => {
  assert.equal(equipe.rangOrdinal(1), '1er');
  assert.equal(equipe.rangOrdinal(2), '2e');
  assert.equal(equipe.rangOrdinal(3), '3e');
  assert.equal(equipe.rangOrdinal(10), '10e');
  assert.equal(equipe.rangOrdinal(21), '21e');
});

// --- le podium --------------------------------------------------------------

test('le podium nomme TROIS personnes, jamais une quatrieme', () => {
  const podium = equipe.podiumDe(NEUF, null);
  assert.equal(podium.length, equipe.PODIUM_MAX);
  assert.deepEqual(podium.map((l) => l.pseudo), ['Renard', 'K7', 'Bibou']);
  assert.deepEqual(podium.map((l) => l.ordinal), ['1er', '2e', '3e']);
  assert.deepEqual(podium.map((l) => l.pourcent), [100, 91, 86]);
});

test('meme si le serveur nommait tout le monde, le podium s arrete a trois', () => {
  // Un serveur mal configure, ou un test mal ecrit : la seconde garde tient.
  // La premiere empeche le nom de transiter, celle-ci empeche de l'afficher.
  const tousNommes = {
    ...NEUF,
    classement: NEUF.classement.map((l, i) => ({ ...l, pseudo: `Enfant${i}` })),
  };
  assert.equal(equipe.podiumDe(tousNommes, null).length, equipe.PODIUM_MAX);
});

test('une ligne anonyme n entre jamais au podium, meme parmi les trois premieres', () => {
  const trou = {
    ...NEUF,
    classement: [
      { rang: 1, cochees: 22, part: 1, pseudo: 'Renard' },
      { rang: 2, cochees: 20, part: 0.909 },
      { rang: 3, cochees: 19, part: 0.864, pseudo: 'Bibou' },
      ...NEUF.classement.slice(3),
    ],
  };
  const podium = equipe.podiumDe(trou, null);
  assert.deepEqual(podium.map((l) => l.pseudo), ['Renard', 'Bibou']);
});

test('ma ligne est marquee, et une seule', () => {
  const podium = equipe.podiumDe(NEUF, 'K7');
  assert.deepEqual(podium.map((l) => l.moi), [false, true, false]);
  // Sans pseudonyme, personne n'est moi — et surtout pas la ligne anonyme.
  assert.deepEqual(equipe.podiumDe(NEUF, null).map((l) => l.moi), [false, false, false]);
});

// --- la position ------------------------------------------------------------

test('sans classement, il n y a pas de position', () => {
  assert.equal(equipe.positionDe({ instantane: null, moi: null, cochees: 5, inscrit: false }), null);
  // On n'affiche pas « 1er sur 1 » a quelqu'un qui est seul avec lui-meme.
  const vide = { ...NEUF, participants: 0, classement: [] };
  assert.equal(equipe.positionDe({ instantane: vide, moi: null, cochees: 5, inscrit: false }), null);
});

test('le rang tranche par le serveur est repris tel quel', () => {
  // Seul le serveur peut departager les ex aequo : il stocke les horodatages de
  // reception, le client n'a aucun champ ou les lire.
  const moi = { pseudo: 'K7', jour: '2026-08-07', rang: 2, participants: 9, cochees: 20 };
  const p = equipe.positionDe({ instantane: NEUF, moi, cochees: 20, inscrit: true });
  assert.deepEqual(p, { rang: 2, ordinal: '2e', participants: 9, inscrit: true });
});

test('un rang du serveur d un AUTRE jour n est pas repris', () => {
  // A minuit toutes les parts chutent : un rang de la veille ne dit plus rien.
  const hier = { pseudo: 'K7', jour: '2026-08-06', rang: 2, participants: 9 };
  const p = equipe.positionDe({ instantane: NEUF, moi: hier, cochees: 20, inscrit: true });
  // On retombe sur la comparaison locale, stricte puisque je suis dans le tableau.
  assert.equal(p.rang, 2, 'un seul participant a plus de 20 cases');
  assert.equal(p.participants, 9, 'j y suis deja : le denominateur ne bouge pas');
});

test('un inscrit se compare STRICTEMENT — sinon il se compterait lui-meme', () => {
  // 19 cases : deux lignes ont plus (22 et 20), deux autres ont exactement 19 —
  // dont la mienne. Une comparaison large me placerait 5e au lieu de 3e.
  const p = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 19, inscrit: true });
  assert.equal(p.rang, 3);
  assert.equal(p.participants, 9);
});

test('un NON-participant se compare largement, et le denominateur le compte', () => {
  // A egalite, le §9 met devant « le premier arrive a ce score », et quelqu'un
  // qui n'a rien publie n'a aucune date d'arrivee a faire valoir.
  const p = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 19, inscrit: false });
  assert.equal(p.rang, 5, 'quatre lignes ont 19 cases ou plus');
  assert.equal(p.participants, 10, 'les neuf inscrits, plus celui qui regarde');
  assert.equal(p.inscrit, false);
});

test('le rang d un non-participant ne depasse jamais son denominateur', () => {
  // C'est le motif du « + 1 » : « 10e sur 9 » est faux au sens le plus simple.
  const dernier = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 0, inscrit: false });
  assert.deepEqual(dernier, { rang: 10, ordinal: '10e', participants: 10, inscrit: false });

  const premier = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 99, inscrit: false });
  assert.deepEqual(premier, { rang: 1, ordinal: '1er', participants: 10, inscrit: false });
});

test('rejoindre ne change pas le denominateur — donc n est pas un moyen de mieux se classer', () => {
  const avant = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 14, inscrit: false });
  // Une fois inscrit, le serveur compte dix participants et ma ligne est dedans.
  const dix = { ...NEUF, participants: 10, classement: [...NEUF.classement, { rang: 10, cochees: 14, part: 0.636 }] };
  const apres = equipe.positionDe({ instantane: dix, moi: null, cochees: 14, inscrit: true });
  assert.equal(avant.participants, 10);
  assert.equal(apres.participants, 10);
});

test('un compte incomparable rend null plutot qu un rang faux', () => {
  // Deux programmes differents — un service worker qui sert l'ancien fichier.
  // Un rang incomparable est pire qu'un rang absent.
  assert.equal(equipe.positionDe({ instantane: NEUF, moi: null, cochees: null, inscrit: false }), null);
  assert.equal(equipe.positionDe({ instantane: NEUF, moi: null, cochees: null, inscrit: true }), null);
});

test('aucun effectif d equipe n est ecrit nulle part', () => {
  // Trois tailles d'equipe, un meme non-participant : le denominateur suit le
  // nombre de participants, et rien d'autre (PRD §4, §15.2).
  const phrases = [3, 9, 20].map((n) => {
    const inst = instantaneDe(Array.from({ length: n }, () => 22));
    const p = equipe.positionDe({ instantane: inst, moi: null, cochees: 0, inscrit: false });
    return equipe.phrasePosition(p);
  });
  assert.deepEqual(phrases, ['Tu es 4e sur 4.', 'Tu es 10e sur 10.', 'Tu es 21e sur 21.']);
});

test('phrasePosition dit le rang et l ensemble', () => {
  assert.equal(
    equipe.phrasePosition({ rang: 3, ordinal: '3e', participants: 10 }),
    'Tu es 3e sur 10.',
  );
});

// --- la jauge et la datation ------------------------------------------------

test('la jauge est celle du serveur, avec ses deux nombres', () => {
  const g = equipe.modeleGroupe(NEUF);
  assert.equal(g.cochees, 121);
  assert.equal(g.programmees, 198);
  assert.equal(g.pourcent, 61);
  assert.equal(g.echelle, 198);
  // Toujours les deux nombres : le pourcentage peut reculer quand une seance
  // nouvelle entre au denominateur, et c'est ce que les deux nombres expliquent.
  assert.equal(g.phrase, 'Ensemble, ceux qui ont rejoint ont coché 121 exercices sur 198.');
});

test('une jauge vide garde une echelle valide', () => {
  // <progress max="0"> est invalide.
  const g = equipe.modeleGroupe({ groupe: { cochees: 0, programmees: 0, part: 0 } });
  assert.equal(g.echelle, 1);
  assert.equal(g.pourcent, 0);
});

test('la datation dit le jour du classement, et s il est perime', () => {
  assert.equal(equipe.datationEquipe(NEUF, '2026-08-07'), 'Classement de vendredi 7 août.');
  assert.equal(
    equipe.datationEquipe(NEUF, '2026-08-08'),
    'Classement de vendredi 7 août — pas encore actualisé aujourd’hui.',
  );
});

// --- le modele complet ------------------------------------------------------

const PROG = JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'));

async function programme() {
  const domaine = await import('../web/domaine.js');
  return domaine.chargerProgramme(PROG);
}

test('rien de recu, rien d affiche — la ligne d etat parle seule', async () => {
  const ctx = { prog: await programme(), aujourdhui: '2026-08-07', faits: {} };
  assert.equal(equipe.modeleEquipe(ctx, { pseudo: null, dernierRangConnu: null }), null);
});

test('personne n a rejoint : une phrase, ni podium ni position ni jauge montee', async () => {
  const ctx = { prog: await programme(), aujourdhui: '2026-08-07', faits: {} };
  const vide = { jour: '2026-08-07', programmees: 22, participants: 0, classement: [], groupe: { cochees: 0, programmees: 0, part: 0 } };
  const m = equipe.modeleEquipe(ctx, {
    pseudo: null,
    dernierRangConnu: { recuA: 'x', instantane: vide, moi: null },
  });
  assert.equal(m.vide, equipe.PHRASE_PERSONNE);
  assert.deepEqual(m.podium, []);
  assert.equal(m.position, null);
});

test('le modele complet porte les trois blocs et le jour du serveur', async () => {
  const prog = await programme();
  // Le 7 aout, trois seances sont programmees : 8 + 8 + 6 = 22 cases, ce qui
  // correspond au `programmees` de l'instantane — les deux sont comparables.
  const faits = { 's1-c1': 'a', 's1-c2': 'b', 's1-r1': 'c' };
  const ctx = { prog, aujourdhui: '2026-08-07', faits };
  const m = equipe.modeleEquipe(ctx, {
    pseudo: null,
    dernierRangConnu: { recuA: 'x', instantane: NEUF, moi: null },
  });
  assert.equal(m.jour, '2026-08-07');
  assert.equal(m.titre, equipe.TITRE_EQUIPE);
  assert.equal(m.podium.length, 3);
  assert.equal(m.position.participants, 10, 'non inscrit : les neuf, plus lui');
  assert.match(m.position.phrase, /^Tu es \d+e sur 10\.$/);
  assert.equal(m.groupe.cochees, 121);
  assert.equal(m.vide, null);
});

test('deux programmes differents font taire la position, pas le podium', async () => {
  const ctx = { prog: await programme(), aujourdhui: '2026-08-07', faits: {} };
  // Le serveur annonce un denominateur que ce telephone ne sait pas reproduire.
  const autre = { ...NEUF, programmees: 999 };
  const m = equipe.modeleEquipe(ctx, {
    pseudo: null,
    dernierRangConnu: { recuA: 'x', instantane: autre, moi: null },
  });
  assert.equal(m.position, null, 'un rang incomparable est pire qu un rang absent');
  assert.equal(m.podium.length, 3, 'le podium ne depend pas de mes cases');
  assert.equal(m.groupe.cochees, 121);
});

// --- les trois refus --------------------------------------------------------

test('aucun second classement sur le volume, aucun total d equipe (PRD §9, §13)', () => {
  const code = source('vue-equipe.js');
  // Le cumul de pompes et de kilometres est « un recit, pas un rang » : il
  // classerait dans le meme ordre que la regularite, a du bruit pres. Deux
  // podiums qui disent la meme chose, c'est un podium plus de la confusion.
  for (const interdit of ['totauxAccomplis', 'lignesVolume', 'pompes', 'effectif']) {
    assert.equal(code.includes(interdit), false, `${interdit} n a rien a faire dans cet ecran`);
  }
});

test('un pseudonyme est du texte hostile jusqu a preuve du contraire', () => {
  const code = source('vue-equipe.js');
  // Il vient d'une page publique, sans authentification. textContent partout, et
  // rien d'autre. La validation d'entree du PRP 07 et le rendu ne sont pas
  // deployes au meme moment.
  for (const interdit of ['innerHTML', 'insertAdjacentHTML', 'outerHTML']) {
    assert.equal(code.includes(interdit), false, interdit);
  }
});

test('toute classe posee par l ecran equipe existe dans style.css', () => {
  const code = source('vue-equipe.js');
  const css = source('style.css');
  const classes = new Set();
  for (const [, liste] of code.matchAll(/\bel\(\s*'[a-z]+'\s*,\s*'([^']*)'/g)) {
    for (const c of liste.split(/\s+/).filter(Boolean)) classes.add(c);
  }
  // FICHIER PAR FICHIER : un test qui parcourt zero classe passe sans rien
  // verifier, et c'est le pire mode de defaillance d'un garde-fou.
  assert.ok(classes.size >= 10, `${classes.size} classes lues : le motif a cesse de correspondre`);
  // Les noms construits par gabarit, que le motif ci-dessus ne peut pas voir.
  for (const c of [...classes, 'ligne-podium', 'podium-moi', 'rang-monte', 'rang-descend']) {
    assert.ok(css.includes(`.${c}`), `.${c} manque dans style.css`);
  }
});

// --- le branchement ---------------------------------------------------------

test('l equipe se monte AVANT le bloc d action, et la coque la connait', () => {
  const perso = source('vue-perso.js');
  assert.ok(perso.includes('monterEquipe('), 'l ecran perso monte le bloc equipe');
  assert.ok(
    perso.indexOf('monterEquipe(') < perso.indexOf('monterActionClassement('),
    'podium, position et jauge viennent AU-DESSUS du bouton',
  );
  // Sans cette entree, le premier passage hors ligne sur #/perso echoue, et rien
  // ne le signale tant qu'on reste connecte.
  assert.match(source('sw.js'), /'\/vue-equipe\.js'/);
});

// --- l animation ------------------------------------------------------------
//
// On anime un changement qu'on a VU ARRIVER, jamais un changement qu'on
// decouvre. Le DOM est un double minimal : ces quatre conditions se prouvent
// sans navigateur.

function faussElement(classe = '') {
  const noeud = {
    className: classe,
    dataset: {},
    enfants: [],
    classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); } },
    append(...n) { this.enfants.push(...n); },
    replaceChildren() { this.enfants = []; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    querySelector(sel) {
      const cible = sel.replace('.', '');
      const chercher = (n) => {
        for (const e of n.enfants ?? []) {
          if (typeof e.className === 'string' && e.className.split(/\s+/).includes(cible)) return e;
          const trouve = chercher(e);
          if (trouve) return trouve;
        }
        return null;
      };
      return chercher(this);
    },
  };
  return noeud;
}

function poserDocumentFactice() {
  globalThis.document = {
    createElement: (balise) => {
      const n = faussElement();
      n.balise = balise;
      Object.defineProperty(n, 'textContent', {
        get() { return this._texte ?? ''; },
        set(v) { this._texte = String(v); },
        configurable: true,
      });
      return n;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function modeleAvecRang(rang, jour = '2026-08-07') {
  return {
    titre: 'L’équipe', jour,
    datation: 'Classement de vendredi 7 août.',
    podium: [],
    position: { rang, ordinal: equipe.rangOrdinal(rang), participants: 10, inscrit: true, phrase: `Tu es ${equipe.rangOrdinal(rang)} sur 10.` },
    groupe: { cochees: 1, programmees: 2, pourcent: 50, echelle: 2, phrase: 'x' },
    vide: null,
  };
}

test('le rang roule quand il change, et la classe dit le sens', () => {
  poserDocumentFactice();
  const bloc = faussElement('equipe');
  const appels = [];
  const rouler = (...args) => { appels.push(args); return () => {}; };

  // Premier appel : c'est le montage. Arriver sur une page n'est pas grimper.
  equipe.majEquipe(bloc, modeleAvecRang(5), { rouler });
  assert.equal(appels.length, 0, 'le premier rendu pose le rang, il ne l anime pas');

  // Second appel, meme jour, rang qui monte.
  equipe.majEquipe(bloc, modeleAvecRang(3), { rouler });
  assert.equal(appels.length, 1);
  assert.equal(appels[0][1], 5, 'depart');
  assert.equal(appels[0][2], 3, 'arrivee');
  assert.equal(appels[0][3].format(1), '1er', 'le nombre roule en ordinal, pas en chiffre nu');
  assert.ok(bloc.classList.classes.has('rang-monte'));
});

test('un rang qui bouge parce que la date a tourne n est PAS anime', () => {
  poserDocumentFactice();
  const bloc = faussElement('equipe');
  const appels = [];
  const rouler = (...args) => { appels.push(args); return () => {}; };

  equipe.majEquipe(bloc, modeleAvecRang(3, '2026-08-07'), { rouler });
  // A 00 h 00, programmees augmente et toutes les parts chutent. Une app ouverte
  // toute la nuit ne doit pas annoncer une degringolade a 00 h 01.
  equipe.majEquipe(bloc, modeleAvecRang(7, '2026-08-08'), { rouler });
  assert.equal(appels.length, 0);
  assert.equal(bloc.classList.classes.size, 0);
  assert.equal(bloc.dataset.jour, '2026-08-08', 'le jour est bien mis a jour');
});

test('un rang inchange n anime rien', () => {
  poserDocumentFactice();
  const bloc = faussElement('equipe');
  const appels = [];
  const rouler = (...args) => { appels.push(args); return () => {}; };
  equipe.majEquipe(bloc, modeleAvecRang(4), { rouler });
  equipe.majEquipe(bloc, modeleAvecRang(4), { rouler });
  assert.equal(appels.length, 0);
  assert.equal(bloc.classList.classes.size, 0);
});

test('passer de rien a un rang est une apparition, pas une montee', () => {
  poserDocumentFactice();
  const bloc = faussElement('equipe');
  const appels = [];
  const rouler = (...args) => { appels.push(args); return () => {}; };

  const sansPosition = { ...modeleAvecRang(3), position: null };
  equipe.majEquipe(bloc, sansPosition, { rouler });
  equipe.majEquipe(bloc, modeleAvecRang(3), { rouler });
  assert.equal(appels.length, 0);
});

test('un modele null vide le bloc equipe et rien d autre', () => {
  poserDocumentFactice();
  const bloc = faussElement('equipe');
  equipe.majEquipe(bloc, modeleAvecRang(3));
  assert.ok(bloc.enfants.length > 0);
  equipe.majEquipe(bloc, null);
  assert.equal(bloc.enfants.length, 0);
  assert.equal(bloc.dataset.jour, undefined);
});

test('le rang et son denominateur viennent de la MEME reponse', () => {
  // Juste apres une inscription, `moi` compte le nouveau participant et
  // `instantane` pas encore : melanger les deux donne « 4e sur 3 », ce qu'aucun
  // enfant ne devrait lire. Trouve dans un navigateur, pas par un test.
  const troisInscrits = { ...NEUF, participants: 3, classement: NEUF.classement.slice(0, 3) };
  const moi = { pseudo: 'Nouveau', jour: '2026-08-07', rang: 4, participants: 4 };
  const p = equipe.positionDe({ instantane: troisInscrits, moi, cochees: 0, inscrit: true });
  assert.equal(p.rang, 4);
  assert.equal(p.participants, 4, 'le rang ne depasse jamais son denominateur');
});
