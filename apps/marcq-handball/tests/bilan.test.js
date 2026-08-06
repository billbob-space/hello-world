// tests/bilan.test.js — le bilan du 22 aout : la bascule, ce qu'il raconte, et
// le ton avec lequel il le raconte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as bilan from '../web/vue-bilan.js';
import * as domaine from '../web/domaine.js';
import { MOTIF_SEANCE } from '../web/vue-seance.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const prog = domaine.chargerProgramme(
  JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8')),
);

// Les faits se construisent DEPUIS le programme, jamais depuis une liste
// d'identifiants recopiee : editer programme.json ne doit pas demander de
// toucher a ce fichier.
const idsDe = (s) => s.blocs.flatMap((b) => b.exercices.map((e) => e.id));
const cocher = (ids) => Object.fromEntries(ids.map((id, i) => [id, `2026-08-03T1${i % 10}:00:00.000Z`]));
const seancesEntieres = (n) => cocher(prog.seances.slice(0, n).flatMap(idsDe));
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

// --- la bascule -------------------------------------------------------------

test('la racine mene au bilan des que le programme est fini, et jamais avant', () => {
  assert.equal(bilan.bascule(prog, '2026-08-21', '#/'), null, 'le dernier jour, on coche encore');
  assert.equal(bilan.bascule(prog, '2026-08-22', '#/'), bilan.ROUTE_BILAN);
  // L'adresse sans ancre est celle du lien que les enfants ont recu.
  assert.equal(bilan.bascule(prog, '2026-08-22', ''), bilan.ROUTE_BILAN);
  assert.equal(bilan.bascule(prog, '2026-08-22', '#'), bilan.ROUTE_BILAN);
});

test('seule la racine bascule : l app ne ferme pas, elle change d ecran', () => {
  // Le PRD §9 dit que l'application bascule, pas qu'elle ferme : apres le
  // 21 aout on doit encore pouvoir corriger un prenom et relire une seance.
  for (const route of ['#/perso', '#/reglages', '#/seance/2026-08-03', '#/rejoindre', '#/coach']) {
    assert.equal(bilan.bascule(prog, '2026-08-22', route), null, route);
  }
  // Et la recursion du routeur se termine : le bilan ne rebascule pas sur
  // lui-meme.
  assert.equal(bilan.bascule(prog, '2026-08-22', bilan.ROUTE_BILAN), null);
});

test('le routeur emploie LE MEME motif de racine que la bascule', () => {
  // Deux copies divergeraient au premier ajustement, et l'ecart serait muet :
  // le bilan ne prendrait pas la main sur l'adresse sans ancre.
  const code = source('app.js');
  assert.equal((code.match(/MOTIF_RACINE/g) ?? []).length, 2, 'un import, un usage');
  assert.equal(/motif: \/\^\(#/.test(code), false, 'plus de motif de racine ecrit en clair');
});

// --- la phrase de tete ------------------------------------------------------

test('les quatre sorties de phraseBilan, au caractere pres', () => {
  assert.equal(
    bilan.phraseBilan({ seances: 3, cases: 22 }),
    '3 séances bouclées et 22 exercices cochés. Voilà ce que tu ramènes à la reprise.',
  );
  assert.equal(
    bilan.phraseBilan({ seances: 1, cases: 8 }),
    '1 séance bouclée et 8 exercices cochés. Voilà ce que tu ramènes à la reprise.',
  );
  // Quelqu'un qui a coche sans jamais finir une seance ne doit pas lire
  // « 0 séance bouclée » : le zero serait la seule information de la phrase.
  assert.equal(
    bilan.phraseBilan({ seances: 0, cases: 1 }),
    '1 exercice coché. Voilà ce que tu ramènes à la reprise.',
  );
  assert.equal(bilan.phraseBilan({ seances: 0, cases: 0 }), bilan.PHRASE_RIEN);
});

// --- les seances ------------------------------------------------------------

test('les quatre statuts, et le detail qui se tait quand rien n est coche', () => {
  const premiere = prog.seances[0];
  const ids = idsDe(premiere);

  // faite : le compte du programme, sans denominateur — il n'y a rien a manquer.
  const faite = bilan.ligneSeance(prog, premiere, '2026-08-22', cocher(ids));
  assert.equal(faite.statut, 'faite');
  assert.equal(faite.libelle, 'faite');
  assert.equal(faite.detail, `${ids.length} exercices`);

  // partielle : le fait d'abord, le cadre ensuite.
  const partielle = bilan.ligneSeance(prog, premiere, '2026-08-22', cocher(ids.slice(0, 4)));
  assert.equal(partielle.statut, 'partielle');
  assert.equal(partielle.libelle, 'commencée');
  assert.equal(partielle.detail, `4 exercices sur ${ids.length}`);

  // manquee : « 0 exercices sur 8 » est un reproche chiffre, l'absence de
  // chiffre est un fait. La ligne reste datee, titree, avec sa marque.
  const manquee = bilan.ligneSeance(prog, premiere, '2026-08-22', {});
  assert.equal(manquee.statut, 'manquee');
  assert.equal(manquee.libelle, 'non faite');
  assert.equal(manquee.detail, null);
  assert.ok(manquee.marque !== undefined && manquee.href === '#/seance/2026-08-03');

  // aujourd-hui : le meme silence tant que la journee n'est pas entamee...
  const vierge = bilan.ligneSeance(prog, premiere, premiere.date, {});
  assert.equal(vierge.statut, 'aujourd-hui');
  assert.equal(vierge.libelle, 'en cours');
  assert.equal(vierge.detail, null, 'ecrire 0 sur 8 a quelqu un dont la journee n est pas finie');
  // ...puis le compte des la premiere case.
  const entamee = bilan.ligneSeance(prog, premiere, premiere.date, cocher(ids.slice(0, 2)));
  assert.equal(entamee.detail, `2 exercices sur ${ids.length}`);
});

test('le bilan ne liste que les seances deja programmees', () => {
  assert.equal(bilan.modeleBilan(contexte('2026-08-05')).seances.length, 2);
  assert.equal(bilan.modeleBilan(contexte('2026-08-22')).seances.length, prog.seances.length);

  // Le 5 aout EST un jour de seance : la derniere ligne est « en cours ».
  const derniere = bilan.modeleBilan(contexte('2026-08-05')).seances.at(-1);
  assert.equal(derniere.statut, 'aujourd-hui');
  assert.equal(derniere.libelle, 'en cours');
});

test('chaque statut rendu a son libelle, et chaque lien mene a une route connue', () => {
  // Le jour ou le domaine gagnerait un statut de plus, ce test tombe plutot que
  // l'ecran n'affiche `undefined`.
  for (const jour of ['2026-08-05', '2026-08-22']) {
    for (const s of bilan.modeleBilan(contexte(jour, seancesEntieres(1))).seances) {
      assert.ok(Object.keys(bilan.LIBELLES_BILAN).includes(s.statut), `statut ${s.statut}`);
      assert.match(s.href, MOTIF_SEANCE, 'le bilan ne mene jamais a une route inconnue');
    }
  }
});

// --- la periode et l avis ---------------------------------------------------

test('l avis dit ou on en est, et se tait une fois le programme fini', () => {
  assert.equal(bilan.modeleBilan(contexte('2026-08-22')).avis, null);
  assert.equal(bilan.modeleBilan(contexte('2026-08-22')).enCours, false);

  const tot = bilan.modeleBilan(contexte('2026-08-05'));
  assert.equal(tot.enCours, true);
  assert.match(tot.avis, /^Le programme n’est pas fini\. Il reste 5 séances d’ici au vendredi 21 août\.$/);

  // Les 18, 19, 20 et 21 aout : pas fini, mais plus rien a proposer. Une phrase
  // unique mentirait quatre jours d'affilee.
  const fin = bilan.modeleBilan(contexte('2026-08-20'));
  assert.equal(fin.enCours, true);
  assert.match(fin.avis, /^Le programme se termine le vendredi 21 août\. Plus aucune séance d’ici là\.$/);

  assert.equal(bilan.modeleBilan(contexte('2026-08-22')).periode,
    'du lundi 3 août au vendredi 21 août');
});

// --- le resume et le volume -------------------------------------------------

test('le resume compte ce qui est fait, sur ce qui est programme A CE JOUR', () => {
  const m = bilan.modeleBilan(contexte('2026-08-22', seancesEntieres(3)));
  assert.equal(m.resume.seances, 3);
  assert.equal(m.resume.seancesTotal, prog.seances.length);
  assert.equal(m.resume.casesTotal, 53, 'apres la fin, tout le programme');
  assert.match(m.resume.phrase, /^3 séances bouclées et \d+ exercices cochés/);

  // Avant la premiere seance, l'echelle reste valide : <progress max="0"> ne
  // l'est pas.
  assert.equal(bilan.modeleBilan(contexte('2026-08-02')).resume.echelle, 1);
  assert.equal(bilan.modeleBilan(contexte('2026-08-02')).resume.casesTotal, 0);
});

test('le volume ne se montre que s il a quelque chose a dire', () => {
  // Rien de coche : PHRASE_RIEN a deja tout dit, deux messages de vide empiles
  // sont exactement le ton que cet ecran refuse.
  const rien = bilan.modeleBilan(contexte('2026-08-22'));
  assert.equal(rien.volume.montrer, false);
  assert.equal(rien.volume.vide, null);

  // Des cases cochees, avec du volume.
  const plein = bilan.modeleBilan(contexte('2026-08-22', seancesEntieres(2)));
  assert.equal(plein.volume.montrer, true);
  assert.ok(plein.volume.lignes.length > 0);
  assert.equal(plein.volume.vide, null);

  // Un seul exercice coche, en unite « autre » : rien a additionner, mais
  // quelque chose a dire.
  const autre = prog.seances.flatMap((s) => s.blocs.flatMap((b) => b.exercices))
    .find((e) => e.mesure.unite === 'autre');
  if (autre) {
    const m = bilan.modeleBilan(contexte('2026-08-22', cocher([autre.id])));
    assert.equal(m.volume.lignes.length, 0);
    assert.equal(m.volume.vide, bilan.PHRASE_VOLUME_VIDE);
    assert.equal(m.volume.montrer, true);
  }
});

// --- le ton -----------------------------------------------------------------

test('le bilan raconte ce qui a ete fait, il ne compte pas ce qui a manque', () => {
  // Les chaines que l'enfant LIT, et elles seules. `statut` n'en fait pas
  // partie : il porte le mot du domaine — « manquee » — qui pilote la classe CSS
  // et n'apparait jamais a l'ecran. C'est toute la raison d'etre de
  // LIBELLES_BILAN.
  const dites = (m) => [m.titre, m.periode, m.avis, m.resume.phrase, m.volume.vide,
    ...m.volume.lignes.map((l) => l.phrase),
    ...m.seances.flatMap((s) => [s.libelle, s.detail, s.nom])].filter((x) => x != null);

  const modeles = [
    // Le troisieme est le plus expose, et le seul qu'on n'aura jamais sous les
    // yeux pendant le developpement.
    bilan.modeleBilan(contexte('2026-08-22', seancesEntieres(prog.seances.length))),
    bilan.modeleBilan(contexte('2026-08-22', seancesEntieres(3))),
    bilan.modeleBilan(contexte('2026-08-22')),
  ];

  for (const m of modeles) {
    for (const phrase of dites(m)) {
      for (const interdit of ['manqu', 'dommage', 'seulement', 'raté', 'bravo', 'champion', 'guerrier']) {
        assert.equal(phrase.toLowerCase().includes(interdit), false, `« ${phrase} » contient ${interdit}`);
      }
    }
  }
});

test('ni mascotte, ni badge, ni vocabulaire de coach americain', () => {
  const code = source('vue-bilan.js');
  for (const interdit of ['mascotte', 'badge', '🏆', '🎉', 'confetti', 'lancerConfettis', 'rouler(']) {
    assert.equal(code.includes(interdit), false, interdit);
  }
  assert.equal(code.includes('innerHTML'), false);
  // Le bilan montre le classement, il n'y fait plus entrer personne : le bouton
  // proposerait de rejoindre un classement ferme, et l'enfant lirait un 409 pour
  // un geste que l'ecran venait de lui proposer.
  assert.equal(code.includes('monterActionClassement'), false);
});

test('toute classe posee par le bilan existe dans style.css', () => {
  const code = source('vue-bilan.js');
  const css = source('style.css');
  const classes = new Set();
  for (const [, liste] of code.matchAll(/\bel\(\s*'[a-z]+'\s*,\s*'([^']*)'/g)) {
    for (const c of liste.split(/\s+/).filter(Boolean)) classes.add(c);
  }
  assert.ok(classes.size >= 10, `${classes.size} classes lues : le motif a cesse de correspondre`);
  // `lien-seance jour-${statut}` pose les quatre, une par cle de LIBELLES_BILAN.
  const parGabarit = Object.keys(bilan.LIBELLES_BILAN).map((s) => `jour-${s}`);
  for (const c of [...classes, ...parGabarit, 'lien-seance']) {
    assert.ok(css.includes(`.${c}`), `.${c} manque dans style.css`);
  }
});

// --- ce que le bilan ne reimplemente pas ------------------------------------

test('plus rien n est cochable, et ce n est pas ce PRP qui le decide', () => {
  // La regle vit dans le domaine depuis le lot 1 : le bilan la verifie, il ne la
  // reecrit pas. Si cette assertion tombe, c'est le domaine qu'il faut corriger.
  for (const s of prog.seances) {
    const { cochable } = domaine.etatSeance(prog, s.date, '2026-08-22', {});
    assert.equal(cochable, false, `${s.date} encore cochable apres la fin`);
  }
  // Et le 21, tout l'est encore.
  assert.equal(domaine.etatSeance(prog, prog.seances[0].date, '2026-08-21', {}).cochable, true);

  // Le bilan ne contient aucune date, aucun des sept nombres : programme.json
  // reste la seule source (PRD §8).
  const code = source('vue-bilan.js');
  assert.equal(/2026-\d\d-\d\d/.test(code), false, 'aucune date en dur');
});

test('le classement fige se dit « arrêté », pas « pas encore actualisé »', async () => {
  const equipe = await import('../web/vue-equipe.js');
  const inst = { jour: '2026-08-21', programmees: 53, participants: 2, classement: [], groupe: {} };
  assert.equal(
    equipe.datationEquipe(inst, '2026-08-22', '2026-08-21'),
    'Classement arrêté le vendredi 21 août.',
    'inviter a reessayer une actualisation qui ne changera plus rien serait inquietant',
  );
  // Les deux appels a deux arguments rendent les phrases d'origine, inchangees.
  assert.equal(equipe.datationEquipe(inst, '2026-08-21'), 'Classement de vendredi 21 août.');
  assert.equal(
    equipe.datationEquipe(inst, '2026-08-22'),
    'Classement de vendredi 21 août — pas encore actualisé aujourd’hui.',
  );
});
