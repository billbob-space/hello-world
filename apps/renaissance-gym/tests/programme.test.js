// tests/programme.test.js — le fichier de donnees et ses derivations
// (PRP 01, PRD §8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  chargerProgramme, exercices, exercice, seance, exercicesDeSeance,
  palierDeSemaine, objectif, objectifTexte, couvertureComplete,
} from '../web/programme.js';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(racine, 'web');

const brut = JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8'));
const prog = chargerProgramme(brut);

test('chargerProgramme rend un programme valide, et refuse ce qui ne l’est pas', () => {
  assert.equal(prog.semaines, 8);
  assert.equal(prog.seances_par_semaine, 4);
  assert.ok(Array.isArray(prog.familles) && prog.familles.length === 8);

  assert.throws(() => chargerProgramme(null), /programme\.js/);
  assert.throws(() => chargerProgramme({}), /titre manquant/);
  assert.throws(
    () => chargerProgramme({ ...brut, exercices: [{ id: 'e01', libelle: 'x', famille: 'inconnue', mesure: 'repetitions', paliers: [1, 1, 1, 1] }] }),
    /famille inconnue/,
  );
  assert.throws(
    () => chargerProgramme({ ...brut, seances: [{ id: 's1', nom: 'x', exercices: ['e999'] }] }),
    /exercice inconnu/,
  );
});

test('les trente-six exercices sont la, dans l’ordre du fichier, sans doublon', () => {
  const liste = exercices(prog);
  assert.equal(liste.length, 36);
  const ids = liste.map((ex) => ex.id);
  assert.deepEqual(ids, Array.from({ length: 36 }, (_, i) => `e${String(i + 1).padStart(2, '0')}`));
  assert.equal(new Set(ids).size, 36, 'aucun identifiant en double');
});

test('exercice(prog, id) retrouve chaque exercice, et rend undefined sinon', () => {
  assert.equal(exercice(prog, 'e01').libelle, 'Fermetures');
  assert.equal(exercice(prog, 'e36').libelle, 'Pont');
  assert.equal(exercice(prog, 'e99'), undefined);
});

test('les quatre seances existent et exercicesDeSeance resout les identifiants', () => {
  for (let numero = 1; numero <= 4; numero += 1) {
    const s = seance(prog, numero);
    assert.ok(s, `seance ${numero} manquante`);
    const resolus = exercicesDeSeance(prog, numero);
    assert.equal(resolus.length, s.exercices.length);
    for (const ex of resolus) assert.ok(ex && typeof ex.libelle === 'string');
  }
});

// Le test central du PRP 01 et de l'ossature §7 point 1 : l'union des quatre
// seances vaut EXACTEMENT les 36 identifiants du programme, ni plus ni moins —
// la preuve que l'application transpose la grille et n'en selectionne pas un
// morceau (PRD §8.4).
test('l’union des quatre seances vaut exactement les 36 exercices, ni plus ni moins', () => {
  const tous = new Set(exercices(prog).map((ex) => ex.id));
  assert.equal(tous.size, 36);

  const couverts = new Set();
  for (let numero = 1; numero <= 4; numero += 1) {
    for (const ex of exercicesDeSeance(prog, numero)) couverts.add(ex.id);
  }

  assert.equal(couverts.size, 36, 'l’union des seances ne couvre pas exactement 36 exercices');
  for (const id of tous) assert.ok(couverts.has(id), `${id} n’apparait dans aucune seance`);
  for (const id of couverts) assert.ok(tous.has(id), `${id} n’existe pas dans le programme`);

  assert.equal(couvertureComplete(prog), true);
});

test('couvertureComplete detecte une couverture cassee', () => {
  const casse = {
    ...brut,
    seances: brut.seances.map((s, i) => (i === 0 ? { ...s, exercices: s.exercices.slice(1) } : s)),
  };
  assert.equal(couvertureComplete(chargerProgramme(casse)), false);
});

// A4 (« Ajoute apres les PRP ») : le §8.3 d'origine coupait toujours les huit
// semaines en quatre blocs de deux. Ce n'est plus vrai que pour un exercice a
// quatre valeurs — il n'y en a plus dans programme.json, mais la fonction
// reste generale. Ce test fixe le comportement pour 1, 2 et 3 paliers, la
// forme que porte reellement la feuille.
test('palierDeSemaine repartit les huit semaines aussi egalement que possible, le reste aux premiers blocs (A4)', () => {
  // Une valeur unique : un seul bloc, elle ne bouge jamais.
  for (let semaine = 1; semaine <= 8; semaine += 1) {
    assert.equal(palierDeSemaine(1, semaine), 0, `semaine ${semaine}`);
  }

  // Deux valeurs : S1-S4 / S5-S8 (A4, table a deux colonnes).
  assert.deepEqual([1, 2, 3, 4].map((s) => palierDeSemaine(2, s)), [0, 0, 0, 0]);
  assert.deepEqual([5, 6, 7, 8].map((s) => palierDeSemaine(2, s)), [1, 1, 1, 1]);

  // Trois valeurs : S1-S3 / S4-S6 / S7-S8 (A4, table a trois colonnes) — le
  // reste (huit n'est pas un multiple de trois) va aux DEUX PREMIERS blocs,
  // jamais au dernier : c'est ce qui laisse S7-S8 a deux semaines seulement.
  assert.deepEqual([1, 2, 3].map((s) => palierDeSemaine(3, s)), [0, 0, 0]);
  assert.deepEqual([4, 5, 6].map((s) => palierDeSemaine(3, s)), [1, 1, 1]);
  assert.deepEqual([7, 8].map((s) => palierDeSemaine(3, s)), [2, 2]);
});

test('palierDeSemaine ramene une semaine hors bornes a la borne la plus proche', () => {
  assert.equal(palierDeSemaine(2, 0), palierDeSemaine(2, 1));
  assert.equal(palierDeSemaine(2, 9), palierDeSemaine(2, 8));
});

// PRP 01, corrige par A4 : objectif(ex, 1) rend la valeur basse de la feuille
// et objectif(ex, 8) sa valeur haute, pour les 36 exercices — quel que soit
// le nombre de valeurs que la feuille porte pour cet exercice.
test('objectif(ex, 1) est la valeur basse et objectif(ex, 8) la valeur haute, pour les 36 exercices', () => {
  for (const ex of exercices(prog)) {
    const bas = objectif(ex, 1);
    const haut = objectif(ex, 8);
    assert.equal(bas.valeur, ex.paliers[0], `${ex.id} : valeur basse`);
    assert.equal(haut.valeur, ex.paliers[ex.paliers.length - 1], `${ex.id} : valeur haute`);
    const uniteAttendue = ex.mesure === 'tenue' ? 'secondes' : 'repetitions';
    assert.equal(bas.unite, uniteAttendue, `${ex.id} : unite`);
    assert.equal(haut.unite, uniteAttendue, `${ex.id} : unite`);
  }
});

// A4 : « une transposition peut interpoler ce qu'elle affiche EN INTERNE,
// jamais ce qu'elle presente comme la consigne d'un tiers ». Ce test est la
// preuve mecanique de cette phrase : pour les 36 exercices et les huit
// semaines, la valeur affichee est TOUJOURS l'une des valeurs ecrites sur la
// feuille (ex.paliers), jamais une marche fabriquee entre deux d'entre elles.
test('aucune valeur d’objectif affichee n’est absente de la feuille (A4)', () => {
  for (const ex of exercices(prog)) {
    const valeursDeLaFeuille = new Set(ex.paliers);
    for (let semaine = 1; semaine <= 8; semaine += 1) {
      const { valeur } = objectif(ex, semaine);
      assert.ok(
        valeursDeLaFeuille.has(valeur),
        `${ex.id}, semaine ${semaine} : ${valeur} n’est pas une valeur de la feuille (${ex.paliers.join(' / ')})`,
      );
    }
  }
});

test('objectifTexte ecrit « 1 min » et jamais « 60 s », lit la feuille en x et en secondes', () => {
  const gainage = exercice(prog, 'e06'); // 30s / 1min
  assert.equal(objectifTexte(gainage, 1), '30 s');
  assert.equal(objectifTexte(gainage, 8), '1 min');

  const fermetures = exercice(prog, 'e01'); // x10 / x20
  assert.equal(objectifTexte(fermetures, 1), 'x10');
  // A4 : deux valeurs -> S1-S4 / S5-S8, plus de marche fabriquee au milieu.
  assert.equal(objectifTexte(fermetures, 4), 'x10');
  assert.equal(objectifTexte(fermetures, 5), 'x20');
  assert.equal(objectifTexte(fermetures, 8), 'x20');

  const roue = exercice(prog, 'e21'); // x10, valeur unique
  for (let semaine = 1; semaine <= 8; semaine += 1) assert.equal(objectifTexte(roue, semaine), 'x10');
});

// PRD §8.2 : les variantes « grandes » retenues pour les exercices 16 et 25 —
// le seul endroit ou l'application choisit a la place de la feuille (§15.1).
test('les exercices 16 et 25 portent leur variante d’origine (PRD §8.2, §15.1)', () => {
  assert.equal(exercice(prog, 'e16').libelle, 'ATR valse');
  assert.equal(exercice(prog, 'e16').variante, 'ATR 1/2 valse ou valse (pour les grandes)');
  assert.equal(exercice(prog, 'e25').libelle, 'Pivot');
  assert.equal(exercice(prog, 'e25').variante, 'Pivot (pour les grandes)');
});

// Le PRD §8.2 est la seule autorite sur les libelles (Product Principles :
// « La feuille a autorite »). Ce test relit les deux tableaux du §8.2 dans
// PRODUCT.md et compare, exercice par exercice, la transcription attendue.
//
// Pour e16 et e25, le §8.2 (dernier paragraphe) et le PRP 01 documentent la
// SEULE substitution volontaire de tout le programme : l'application retient
// une forme resolue pour la « grande » (le champ `libelle`) et garde le texte
// integral du tableau — celui qui tranche encore entre petites et grandes —
// dans `variante`. C'est donc `variante` qui porte alors la transcription mot
// pour mot, et `libelle` pour les 34 autres.
test('aucun libelle (ou variante, pour les 2 exceptions documentees) ne differe du PRD §8.2', () => {
  const produit = readFileSync(join(racine, 'PRODUCT.md'), 'utf8');
  const motif = /^\|\s*(\d{1,2})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/;

  const parNumero = new Map();
  for (const ligne of produit.split('\n')) {
    const m = ligne.match(motif);
    if (!m) continue;
    const numero = Number(m[1]);
    if (numero < 1 || numero > 36) continue;
    if (parNumero.has(numero)) continue; // la premiere occurrence est celle du §8.2
    parNumero.set(numero, m[2]);
  }

  assert.equal(parNumero.size, 36, 'les 36 lignes du §8.2 n’ont pas toutes ete retrouvees dans PRODUCT.md');

  const exceptions = new Set(['e16', 'e25']);
  exercices(prog).forEach((ex, i) => {
    const numero = i + 1;
    const attendu = parNumero.get(numero);
    assert.ok(attendu, `PRODUCT.md ne porte pas la ligne #${numero}`);
    const transcrit = exceptions.has(ex.id) ? ex.variante : ex.libelle;
    assert.equal(
      transcrit, attendu,
      `${ex.id} : « ${transcrit} » diffère de la transcription du PRD §8.2 : « ${attendu} »`,
    );
  });
});

// PRD §8.1 : le fichier de donnees est la SEULE source des objectifs. Un
// objectif ecrit en dur dans une vue livrerait un second programme, invisible
// et non corrigible depuis programme.json.
test('aucune valeur d’objectif n’est ecrite en dur dans une vue (PRD §8.1)', () => {
  const motifsSuspects = [/['"]x\d+['"]/, /\b\d+\s*(?:s|min)\b/i];
  let fichiers = [];
  try {
    fichiers = readdirSync(web).filter((f) => /^vue-.*\.js$/.test(f));
  } catch {
    fichiers = [];
  }
  // Aucune vue n'existe encore a ce lot (PRP 03 a 05) : le test est deja actif
  // et se declenchera des la premiere vue qui recopierait un objectif.
  for (const fichier of fichiers) {
    const source = readFileSync(join(web, fichier), 'utf8');
    for (const motif of motifsSuspects) {
      assert.doesNotMatch(source, motif, `${fichier} porte une valeur d’objectif en dur`);
    }
  }
});

// Ossature §6 : les modules purs ne touchent ni au DOM, ni au localStorage, ni
// au reseau, ni a l'horloge.
test('programme.js reste pur : ni DOM, ni stockage, ni reseau, ni horloge', () => {
  const source = readFileSync(join(web, 'programme.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const mot of ['document', 'window', 'localStorage', 'Date.now', 'new Date', 'fetch(']) {
    assert.equal(source.includes(mot), false, `programme.js contient « ${mot} »`);
  }
});
