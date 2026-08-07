// tests/equipe.test.js — le podium, la position et la jauge, sans navigateur.
//
// Les fonctions du modele sont pures : c'est ce qui rend prouvables les trois
// regles du PRD §9 que cet ecran porte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as equipe from '../web/vue-equipe.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// Un instantane a neuf participants, tel que le serveur l'emet : toutes les
// lignes, celles des trois meilleures marches nommees. Deux enfants a 19 cases
// PARTAGENT le rang 3, et le suivant est 5e — on compte les enfants devant.
const NEUF = {
  jour: '2026-08-07',
  programmees: 22,
  participants: 9,
  classement: [
    { rang: 1, cochees: 22, part: 1, pseudo: 'Renard' },
    { rang: 2, cochees: 20, part: 0.909, pseudo: 'K7' },
    { rang: 3, cochees: 19, part: 0.864, pseudo: 'Bibou' },
    { rang: 3, cochees: 19, part: 0.864, pseudo: 'Tom' },
    { rang: 5, cochees: 14, part: 0.636 },
    { rang: 6, cochees: 12, part: 0.545 },
    { rang: 7, cochees: 9, part: 0.409 },
    { rang: 8, cochees: 6, part: 0.273 },
    { rang: 9, cochees: 0, part: 0 },
  ],
  groupe: { cochees: 121, programmees: 198, part: 0.611 },
};

// Le cas que cette branche traite : toute l'equipe a tout coche. Une seule
// marche, trop peuplee pour etre nommee — le serveur n'envoie aucun pseudonyme.
const TOUS_A_CENT = {
  jour: '2026-08-07',
  programmees: 22,
  participants: 9,
  classement: Array.from({ length: 9 }, () => ({ rang: 1, cochees: 22, part: 1 })),
  groupe: { cochees: 198, programmees: 198, part: 1 },
};

const instantaneDe = (parts) => ({
  jour: '2026-08-07',
  programmees: 22,
  participants: parts.length,
  classement: parts.map((cochees) => ({ rang: 1, cochees, part: cochees / 22 })),
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

test('le podium nomme TROIS MARCHES, et une marche porte tous ses prenoms', () => {
  const podium = equipe.podiumDe(NEUF, null);
  assert.equal(podium.length, equipe.PODIUM_MAX);
  assert.deepEqual(podium.map((m) => m.pseudos), [['Renard'], ['K7'], ['Bibou', 'Tom']]);
  assert.deepEqual(podium.map((m) => m.ordinal), ['1er', '2e', '3e']);
  assert.deepEqual(podium.map((m) => m.pourcent), [100, 91, 86]);
  // Une marche partagee nomme quatre enfants sur trois marches : l'ancienne
  // regle coupait cette marche en deux et laissait Tom dehors sans raison.
  assert.deepEqual(podium.map((m) => m.nombre), [1, 1, 2]);
});

test('une marche muette se compte en enfants, au singulier comme au pluriel', () => {
  // Le singulier ne se rencontre pas sur le podium — une marche d'un seul enfant
  // tient toujours sous le plafond, donc elle nomme. Il est ecrit parce qu'un
  // accord faux se remarque, et qu'un jour cette fonction servira ailleurs.
  assert.equal(equipe.enfants(1), '1 enfant');
  assert.equal(equipe.enfants(14), '14 enfants');
});

test('une marche que le serveur ne nomme pas affiche combien ils sont', () => {
  const podium = equipe.podiumDe(TOUS_A_CENT, null);
  assert.equal(podium.length, 1, 'un seul score, donc une seule marche');
  assert.deepEqual(podium[0].pseudos, [], 'aucun nom recu, aucun nom invente');
  assert.equal(podium[0].nombre, 9);
  assert.equal(podium[0].ordinal, '1er');
  assert.equal(podium[0].pourcent, 100);
});

test('meme si le serveur nommait tout le monde, le podium s arrete a trois marches', () => {
  // Un serveur mal configure, ou un test mal ecrit : la seconde garde tient.
  // La premiere empeche le nom de transiter, celle-ci empeche de l'afficher.
  const tousNommes = {
    ...NEUF,
    classement: NEUF.classement.map((l, i) => ({ ...l, pseudo: `Enfant${i}` })),
  };
  const podium = equipe.podiumDe(tousNommes, null);
  assert.equal(podium.length, equipe.PODIUM_MAX);
  assert.deepEqual(podium.map((m) => m.rang), [1, 2, 3]);
});

test('une marche a moitie nommee se tait entierement', () => {
  // Le serveur nomme une marche entiere ou pas du tout. S'il n'en envoie qu'une
  // partie, afficher ce fragment donnerait un podium qui ment sur sa marche :
  // « 3e : Bibou » quand ils sont deux la, c'est nommer un gagnant qui n'existe
  // pas. On retombe alors sur l'effectif.
  const moitie = {
    ...NEUF,
    classement: NEUF.classement.map((l) => (l.pseudo === 'Tom' ? { ...l, pseudo: undefined } : l)),
  };
  const podium = equipe.podiumDe(moitie, null);
  assert.deepEqual(podium[2].pseudos, []);
  assert.equal(podium[2].nombre, 2);
});

test('ma marche est marquee, et une seule', () => {
  const podium = equipe.podiumDe(NEUF, 'Tom');
  assert.deepEqual(podium.map((m) => m.moi), [false, false, true]);
  // Sans pseudonyme, personne n'est moi — et surtout pas une marche muette.
  assert.deepEqual(equipe.podiumDe(NEUF, null).map((m) => m.moi), [false, false, false]);
  assert.deepEqual(equipe.podiumDe(TOUS_A_CENT, 'Renard').map((m) => m.moi), [false]);
});

// --- la position ------------------------------------------------------------

test('sans classement, il n y a pas de position', () => {
  assert.equal(equipe.positionDe({ instantane: null, moi: null, cochees: 5, inscrit: false }), null);
  // On n'affiche pas « 1er sur 1 » a quelqu'un qui est seul avec lui-meme.
  const vide = { ...NEUF, participants: 0, classement: [] };
  assert.equal(equipe.positionDe({ instantane: vide, moi: null, cochees: 5, inscrit: false }), null);
});

test('la place se lit dans le tableau du jour, pas dans la reponse au dernier envoi', () => {
  // Le tableau est rafraichi a chaque relevé ; `moi` ne l'est qu'a l'envoi
  // suivant. Les deux s'accordent ici, et c'est le tableau qui tranche.
  const moi = { pseudo: 'Tom', jour: '2026-08-07', rang: 3, exAequo: 1, participants: 9, cochees: 19 };
  const p = equipe.positionDe({ instantane: NEUF, moi, cochees: 19, inscrit: true });
  assert.deepEqual(p, { rang: 3, ordinal: '3e', exAequo: 1, participants: 9, inscrit: true });
});

test('un rang perime par la reponse au dernier envoi ne contredit plus le podium', () => {
  // VU EN PRODUCTION le 8 aout, une heure apres la livraison des ex aequo : le
  // podium annonçait « 1er : Alexandre, Snake » et la ligne juste dessous
  // « Tu es 2e sur 2 ». Le telephone avait envoye AVANT la livraison, sa
  // reponse portait le rang de l'ancienne regle, et rien ne la perimait — un
  // enfant qui ne coche plus rien l'aurait gardee jusqu'au soir.
  const deux = {
    jour: '2026-08-08',
    programmees: 22,
    participants: 2,
    classement: [
      { rang: 1, cochees: 22, part: 1, pseudo: 'Alexandre' },
      { rang: 1, cochees: 22, part: 1, pseudo: 'Snake' },
    ],
    groupe: { cochees: 44, programmees: 44, part: 1 },
  };
  const perime = { pseudo: 'Alexandre', jour: '2026-08-08', rang: 2, participants: 2 };
  const p = equipe.positionDe({ instantane: deux, moi: perime, cochees: 22, inscrit: true });
  assert.equal(equipe.phrasePosition(p), 'Tu es 1er sur 2, avec 1 autre.');
});

test('un inscrit ne se compte jamais lui-meme, meme quand son telephone a pris du retard', () => {
  // Trouve en rejouant le cas du dessus dans un navigateur. Ce telephone est
  // inscrit avec 22 cases envoyees — sa ligne est au tableau — mais sa
  // progression locale est vide : navigateur efface, ou second telephone qui
  // n'a pas encore repris sa progression. Sans retirer MA ligne du tableau, je
  // me compte moi-meme comme quelqu'un a battre et je lis « 3e sur 2 ».
  const deux = {
    jour: '2026-08-08',
    programmees: 22,
    participants: 2,
    classement: [
      { rang: 1, cochees: 22, part: 1, pseudo: 'Alexandre' },
      { rang: 1, cochees: 22, part: 1, pseudo: 'Snake' },
    ],
    groupe: { cochees: 44, programmees: 44, part: 1 },
  };
  const moi = { pseudo: 'Alexandre', jour: '2026-08-08', rang: 1, exAequo: 1, participants: 2, cochees: 22 };
  const p = equipe.positionDe({ instantane: deux, moi, cochees: 0, inscrit: true });
  assert.equal(equipe.phrasePosition(p), 'Tu es 2e sur 2.');
  // Et le rang reste atteignable : jamais « 3e sur 2 » (PRD §9).
  assert.ok(p.rang <= p.participants, `${p.rang} sur ${p.participants}`);
});

test('un rang du serveur d un AUTRE jour n est pas repris', () => {
  // A minuit toutes les parts chutent : un rang de la veille ne dit plus rien.
  const hier = { pseudo: 'K7', jour: '2026-08-06', rang: 2, participants: 9 };
  const p = equipe.positionDe({ instantane: NEUF, moi: hier, cochees: 20, inscrit: true });
  // On retombe sur la comparaison locale, stricte puisque je suis dans le tableau.
  assert.equal(p.rang, 2, 'un seul participant a plus de 20 cases');
  assert.equal(p.participants, 9, 'j y suis deja : le denominateur ne bouge pas');
});

test('un inscrit compte ses ex aequo sans se compter lui-meme', () => {
  // 19 cases : deux lignes ont plus (22 et 20), deux ont exactement 19 — dont la
  // mienne. Je suis donc 3e avec UN autre, et non 3e avec deux.
  const p = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 19, inscrit: true });
  assert.equal(p.rang, 3);
  assert.equal(p.exAequo, 1);
  assert.equal(p.participants, 9);
});

test('un NON-participant a egalite partage la place, il ne passe plus derriere', () => {
  // Il n'a aucune date d'arrivee a faire valoir — mais l'heure ne departage plus
  // personne, donc rien ne justifie de le repousser derriere les inscrits.
  const p = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 19, inscrit: false });
  assert.equal(p.rang, 3, 'deux lignes ont STRICTEMENT plus de 19 cases');
  assert.equal(p.exAequo, 2, 'les deux inscrits a 19 cases');
  assert.equal(p.participants, 10, 'les neuf inscrits, plus celui qui regarde');
  assert.equal(p.inscrit, false);
});

test('le rang d un non-participant ne depasse jamais son denominateur', () => {
  // C'est le motif du « + 1 » : « 10e sur 9 » est faux au sens le plus simple.
  const dernier = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 0, inscrit: false });
  assert.deepEqual(dernier, { rang: 9, ordinal: '9e', exAequo: 1, participants: 10, inscrit: false });

  const premier = equipe.positionDe({ instantane: NEUF, moi: null, cochees: 99, inscrit: false });
  assert.deepEqual(premier, { rang: 1, ordinal: '1er', exAequo: 0, participants: 10, inscrit: false });
});

test('tout le monde a 100 % : chacun est 1er, avec tous les autres', () => {
  // Le cas nominal d'une equipe motivee, et celui que l'ancienne regle rendait
  // illisible : « 9e sur 9 » a un enfant qui avait tout fait.
  const moi = { pseudo: 'Renard', jour: '2026-08-07', rang: 1, exAequo: 8, participants: 9 };
  const inscrit = equipe.positionDe({ instantane: TOUS_A_CENT, moi, cochees: 22, inscrit: true });
  assert.equal(equipe.phrasePosition(inscrit), 'Tu es 1er sur 9, avec 8 autres.');

  // Et celui qui n'a pas rejoint, lui aussi a 100 %, lit la meme place.
  const dehors = equipe.positionDe({ instantane: TOUS_A_CENT, moi: null, cochees: 22, inscrit: false });
  assert.equal(equipe.phrasePosition(dehors), 'Tu es 1er sur 10, avec 9 autres.');
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

test('phrasePosition dit le rang, l ensemble, et ceux qui le partagent', () => {
  const dire = (exAequo) => equipe.phrasePosition({ rang: 3, ordinal: '3e', participants: 10, exAequo });
  // Seul a ce niveau : pas de mention. En ajouter une — « avec 0 autre » —
  // ferait lire une egalite qui n'existe pas.
  assert.equal(dire(0), 'Tu es 3e sur 10.');
  assert.equal(dire(1), 'Tu es 3e sur 10, avec 1 autre.');
  assert.equal(dire(4), 'Tu es 3e sur 10, avec 4 autres.');
  // Un vieux corps sans le champ ne fait pas mentir la phrase.
  assert.equal(equipe.phrasePosition({ rang: 3, ordinal: '3e', participants: 10 }), 'Tu es 3e sur 10.');
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
  // Les noms construits par gabarit ou par ternaire, que le motif ci-dessus ne
  // peut pas voir.
  for (const c of [...classes, 'ligne-podium', 'podium-moi', 'nombre-podium', 'rang-monte', 'rang-descend']) {
    assert.ok(css.includes(`.${c}`), `.${c} manque dans style.css`);
  }
});

// --- le branchement ---------------------------------------------------------

test('l equipe se monte AVANT le bloc d action, et la coque la connait', () => {
  // L'equipe a quitte le bas de « Ma progression » pour son propre ecran : elle
  // y etait derriere un calendrier de dix-neuf jours a derouler, donc nulle
  // part. L'ORDRE INTERNE, lui, ne bouge pas — on lit ou l'on en est, puis ce
  // qu'on peut faire.
  const ecran = source('vue-classement.js');
  assert.ok(ecran.includes('monterEquipe('), 'l ecran de l equipe monte le bloc equipe');
  assert.ok(
    ecran.indexOf('monterEquipe(') < ecran.indexOf('monterActionClassement('),
    'podium, position et jauge viennent AU-DESSUS du bouton',
  );
  // Et « Ma progression » ne le monte plus : deux endroits qui montent les memes
  // ecouteurs sur `document` en poseraient deux par visite.
  const perso = source('vue-perso.js');
  assert.equal(perso.includes('monterEquipe('), false, 'un seul ecran monte l equipe');
  assert.equal(perso.includes('monterActionClassement('), false);

  // Sans ces entrees, le premier passage hors ligne sur l'ecran echoue, et rien
  // ne le signale tant qu'on reste connecte.
  assert.match(source('sw.js'), /'\/vue-equipe\.js'/);
  assert.match(source('sw.js'), /'\/vue-classement\.js'/);
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
    // La barre de progression pose sa part dans une propriete personnalisee.
    style: { proprietes: new Map(), setProperty(k, v) { this.proprietes.set(k, v); } },
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
