// tests/domaine.test.js — les regles metier du PRD §9, prouvees sans horloge
// figee ni navigateur (PRP 01, ossature §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chargerProgramme } from '../web/programme.js';
import {
  semaineCourante, debutDeSemaine, semaineEstPassee, semaineEstFuture,
  faitsDeSeance, seanceEstFaite, seancesFaites, prochaineSeance,
  fusionner, progression, avancementSeance,
  fileInitiale, passerEnFile, fileNeContientQueDesPasses,
} from '../web/domaine.js';
import { exercicesDeSeance } from '../web/programme.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const prog = chargerProgramme(JSON.parse(readFileSync(join(web, 'programme.json'), 'utf8')));

const DEBUT = '2026-08-03T08:00:00.000Z'; // un lundi, choisi arbitrairement

function fait(exercice, semaine, seance, a) {
  return { exercice, semaine, seance, a };
}

// --- semaineCourante, debutDeSemaine ---------------------------------------

test('semaineCourante avance de sept jours en sept jours (PRD §8.5)', () => {
  assert.equal(semaineCourante(DEBUT, DEBUT, 1), 1, 'le premier jour est la semaine 1');
  assert.equal(semaineCourante(DEBUT, '2026-08-09T08:00:00.000Z', 1), 1, 'six jours plus tard, encore la semaine 1');
  assert.equal(semaineCourante(DEBUT, '2026-08-10T08:00:00.000Z', 1), 2, 'sept jours pile, la semaine 2');
  assert.equal(semaineCourante(DEBUT, '2026-09-14T08:00:00.000Z', 1), 7, '6 semaines plus tard');
});

test('semaineCourante part de la semaine de depart choisie, pas toujours de 1 (PRD §8.3)', () => {
  assert.equal(semaineCourante(DEBUT, DEBUT, 5), 5, 'elle a choisi de commencer semaine 5');
  assert.equal(semaineCourante(DEBUT, '2026-08-10T08:00:00.000Z', 5), 6);
});

test('au-dela de la semaine 8, le programme est termine : semaineCourante rend 9 (PRD §9.7)', () => {
  const treizeSemainesPlusTard = new Date(new Date(DEBUT).getTime() + 13 * 7 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(semaineCourante(DEBUT, treizeSemainesPlusTard, 1), 9);
  // meme partie d'une semaine de depart avancee : jamais au-dela de 9.
  assert.equal(semaineCourante(DEBUT, treizeSemainesPlusTard, 8), 9);
});

test('sans debut enregistre, semaineCourante rend la semaine de depart', () => {
  assert.equal(semaineCourante(null, DEBUT, 3), 3);
});

test('debutDeSemaine rend le premier instant de chaque semaine, ancree sur le jour de depart', () => {
  assert.equal(debutDeSemaine(DEBUT, 1, 1).toISOString(), DEBUT);
  assert.equal(debutDeSemaine(DEBUT, 2, 1).toISOString(), '2026-08-10T08:00:00.000Z');
  assert.equal(debutDeSemaine(DEBUT, 5, 5).toISOString(), DEBUT, 'commencer en semaine 5 : le debut EST la semaine 5');
});

test('semaineEstPassee et semaineEstFuture, symetriques et exclusives de la semaine courante (PRD §9.3, §9.4)', () => {
  const courante = 4;
  assert.equal(semaineEstPassee(3, courante), true);
  assert.equal(semaineEstPassee(4, courante), false, 'la semaine courante n’est pas « passee »');
  assert.equal(semaineEstPassee(5, courante), false);
  assert.equal(semaineEstFuture(5, courante), true);
  assert.equal(semaineEstFuture(4, courante), false);
  assert.equal(semaineEstFuture(3, courante), false);
});

// --- faitsDeSeance, seanceEstFaite, seancesFaites, prochaineSeance ---------

test('faitsDeSeance isole les faits d’une seance et d’une semaine precises', () => {
  const faits = [
    fait('e01', 1, 1, '2026-08-03T09:00:00.000Z'),
    fait('e02', 1, 1, '2026-08-03T09:01:00.000Z'),
    fait('e14', 1, 2, '2026-08-03T09:02:00.000Z'), // autre seance, meme semaine
    fait('e01', 2, 1, '2026-08-10T09:00:00.000Z'), // meme seance, autre semaine
  ];
  assert.deepEqual(faitsDeSeance(faits, 1, 1), new Set(['e01', 'e02']));
  assert.deepEqual(faitsDeSeance(faits, 1, 2), new Set(['e14']));
  assert.deepEqual(faitsDeSeance(faits, 2, 1), new Set(['e01']));
});

test('une seance est faite quand TOUS ses exercices sont valides, pas avant (PRD §9.1)', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const faitsPartiels = s1.exercices.slice(0, -1).map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(seanceEstFaite(prog, faitsPartiels, 1, 1), false, 'il manque le dernier exercice');

  const faitsComplets = s1.exercices.map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(seanceEstFaite(prog, faitsComplets, 1, 1), true);
});

// A3 (« Ajouté après les PRP ») : l'avancement d'une séance, entre 0 et 1 —
// jamais rendu en chiffre par les vues (PRD §4, §14), seulement en
// remplissage progressif de la case dans la grille.
test('avancementSeance rend la proportion d’exercices valides, entre 0 et 1', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  assert.equal(avancementSeance(prog, [], 1, 1), 0, 'rien de fait : aucun avancement');

  const unSeul = [fait(s1.exercices[0], 1, 1, '2026-08-03T09:00:00.000Z')];
  assert.equal(avancementSeance(prog, unSeul, 1, 1), 1 / s1.exercices.length);

  const faitsComplets = s1.exercices.map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(avancementSeance(prog, faitsComplets, 1, 1), 1, 'tout fait : avancement complet');
});

test('avancementSeance s’accorde toujours avec seanceEstFaite : 1 exactement quand faite', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const faitsComplets = s1.exercices.map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(avancementSeance(prog, faitsComplets, 1, 1) === 1, seanceEstFaite(prog, faitsComplets, 1, 1));

  const faitsPartiels = s1.exercices.slice(0, -1).map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(avancementSeance(prog, faitsPartiels, 1, 1) === 1, seanceEstFaite(prog, faitsPartiels, 1, 1));
});

test('une seance abandonnee reste inachevee, mais ce qui a ete valide n’est pas perdu (PRD §9.1)', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const faitsPartiels = [fait(s1.exercices[0], 1, 1, '2026-08-03T09:00:00.000Z')];
  assert.equal(seanceEstFaite(prog, faitsPartiels, 1, 1), false);
  assert.deepEqual(faitsDeSeance(faitsPartiels, 1, 1), new Set([s1.exercices[0]]), 'le fait valide reste present');
});

test('seancesFaites compte les seances faites d’une semaine, de 0 a 4', () => {
  assert.equal(seancesFaites(prog, [], 1), 0);

  const toutesLesSeancesDeLaSemaine1 = prog.seances.flatMap((s) => s.exercices.map((id) => fait(id, 1, Number(s.id.slice(1)), '2026-08-03T09:00:00.000Z')));
  assert.equal(seancesFaites(prog, toutesLesSeancesDeLaSemaine1, 1), 4);
});

test('prochaineSeance rend la plus petite seance non faite, et null quand les quatre le sont (PRD §7.2)', () => {
  assert.equal(prochaineSeance(prog, [], 1), 1, 'rien de fait : on commence a la 1');

  const s1 = prog.seances.find((s) => s.id === 's1');
  const s1Faite = s1.exercices.map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(prochaineSeance(prog, s1Faite, 1), 2, 'la 1 est faite : on propose la 2');

  const toutesFaites = prog.seances.flatMap((s) => s.exercices.map((id) => fait(id, 1, Number(s.id.slice(1)), '2026-08-03T09:00:00.000Z')));
  assert.equal(prochaineSeance(prog, toutesFaites, 1), null, 'les quatre sont faites : le repos est un resultat');
});

test('prochaineSeance ne remonte jamais dans le temps : faire la 3 sans la 2 ne fait pas revenir a la 2 avant elle', () => {
  const s3 = prog.seances.find((s) => s.id === 's3');
  const s3Faite = s3.exercices.map((id) => fait(id, 1, 3, '2026-08-03T09:00:00.000Z'));
  // La 1 et la 2 restent a faire : prochaineSeance rend la plus petite NON
  // FAITE, ici la 1 — ce n'est pas « revenir en arriere », c'est n'avoir
  // jamais avance au-dela.
  assert.equal(prochaineSeance(prog, s3Faite, 1), 1);
});

// --- fusionner : le coeur du §9.8 -------------------------------------------

test('fusionner : deux listes disjointes s’additionnent', () => {
  const a = [fait('e01', 1, 1, '2026-08-03T09:00:00.000Z')];
  const b = [fait('e02', 1, 1, '2026-08-03T09:01:00.000Z')];
  const resultat = fusionner(a, b);
  assert.equal(resultat.length, 2);
  assert.deepEqual(new Set(resultat.map((f) => f.exercice)), new Set(['e01', 'e02']));
});

test('fusionner : deux listes identiques ne se dupliquent pas', () => {
  const a = [fait('e01', 1, 1, '2026-08-03T09:00:00.000Z')];
  const resultat = fusionner(a, [...a]);
  assert.equal(resultat.length, 1);
});

test('fusionner : un recouvrement partiel garde tout, sans double', () => {
  const a = [
    fait('e01', 1, 1, '2026-08-03T09:00:00.000Z'),
    fait('e02', 1, 1, '2026-08-03T09:01:00.000Z'),
  ];
  const b = [
    fait('e02', 1, 1, '2026-08-03T09:01:00.000Z'),
    fait('e03', 1, 1, '2026-08-03T09:02:00.000Z'),
  ];
  const resultat = fusionner(a, b);
  assert.equal(resultat.length, 3);
  assert.deepEqual(new Set(resultat.map((f) => f.exercice)), new Set(['e01', 'e02', 'e03']));
});

test('fusionner : une liste vide ne perd rien et n’ajoute rien', () => {
  const a = [fait('e01', 1, 1, '2026-08-03T09:00:00.000Z')];
  assert.deepEqual(fusionner(a, []), a);
  assert.deepEqual(fusionner([], a), a);
  assert.deepEqual(fusionner([], []), []);
});

test('fusionner : le meme exercice fait a deux dates sur deux appareils garde la PLUS ANCIENNE', () => {
  const surCeTelephone = [fait('e01', 1, 1, '2026-08-05T10:00:00.000Z')];
  const surLAutre = [fait('e01', 1, 1, '2026-08-03T09:00:00.000Z')]; // fait plus tot, ailleurs
  const resultat = fusionner(surCeTelephone, surLAutre);
  assert.equal(resultat.length, 1);
  assert.equal(resultat[0].a, '2026-08-03T09:00:00.000Z', 'la date la plus ancienne l’emporte, dans les deux sens');
  assert.equal(fusionner(surLAutre, surCeTelephone)[0].a, '2026-08-03T09:00:00.000Z');
});

test('fusionner ne decoche jamais : aucune case presente d’un cote ne disparait de l’union', () => {
  const a = [
    fait('e01', 1, 1, '2026-08-03T09:00:00.000Z'),
    fait('e02', 1, 1, '2026-08-03T09:01:00.000Z'),
    fait('e03', 2, 1, '2026-08-10T09:00:00.000Z'),
  ];
  const b = []; // un appareil qui n'a rien envoye encore
  const resultat = fusionner(a, b);
  for (const f of a) {
    assert.ok(resultat.some((r) => r.exercice === f.exercice && r.semaine === f.semaine && r.seance === f.seance), `${f.exercice} a disparu de la fusion`);
  }
});

// --- progression -------------------------------------------------------------

test('progression compte les seances faites, les semaines completes, et les exercices vus', () => {
  assert.deepEqual(progression(prog, []), { seancesFaites: 0, semainesCompletes: 0, exercicesVus: 0 });

  const semaine1Complete = prog.seances.flatMap((s) => s.exercices.map((id) => fait(id, 1, Number(s.id.slice(1)), '2026-08-03T09:00:00.000Z')));
  const p = progression(prog, semaine1Complete);
  assert.equal(p.seancesFaites, 4);
  assert.equal(p.semainesCompletes, 1);
  assert.equal(p.exercicesVus, 36, 'la semaine 1 couvre exactement les 36 exercices (PRD §8.4)');
});

// --- « Ajouté après les PRP », A1 : la file de « Passer » ------------------

test('fileInitiale rend les exercices non faits, dans l’ordre du programme', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const exs1 = exercicesDeSeance(prog, 1);
  assert.deepEqual(fileInitiale(exs1, new Set()), s1.exercices, 'rien de fait : la file complète, dans l’ordre');

  const premier = s1.exercices[0];
  assert.deepEqual(
    fileInitiale(exs1, new Set([premier])),
    s1.exercices.slice(1),
    'le premier déjà fait : il n’est plus dans la file',
  );
});

test('passerEnFile renvoie la tête de file à la fin, sans rien perdre ni dupliquer', () => {
  const file = ['e01', 'e02', 'e03'];
  const apres = passerEnFile(file);
  assert.deepEqual(apres, ['e02', 'e03', 'e01']);
  assert.deepEqual(file, ['e01', 'e02', 'e03'], 'la file d’origine n’est pas mutée');
});

test('passerEnFile : elle revient TOUJOURS — passer indéfiniment ne le fait jamais disparaître', () => {
  let file = ['e01', 'e02', 'e03'];
  for (let i = 0; i < 20; i += 1) {
    file = passerEnFile(file);
    assert.ok(file.includes('e01'), `« e01 » a disparu après ${i + 1} passages`);
  }
  // Trois passages ramènent exactement à l’ordre de départ (une rotation
  // complète d’une file de trois éléments).
  assert.deepEqual(passerEnFile(passerEnFile(passerEnFile(['e01', 'e02', 'e03']))), ['e01', 'e02', 'e03']);
});

test('passerEnFile : une file d’un seul exercice (ou vide) est rendue inchangée', () => {
  assert.deepEqual(passerEnFile(['e01']), ['e01']);
  assert.deepEqual(passerEnFile([]), []);
});

test('fileNeContientQueDesPasses est vrai seulement quand TOUT ce qui reste a déjà été passé', () => {
  const file = ['e01', 'e02'];
  assert.equal(fileNeContientQueDesPasses(file, new Set()), false, 'rien n’a encore été passé');
  assert.equal(fileNeContientQueDesPasses(file, new Set(['e01'])), false, 'un exercice « frais » reste dans la file');
  assert.equal(fileNeContientQueDesPasses(file, new Set(['e01', 'e02'])), true, 'les deux ont déjà été passés');
  assert.equal(fileNeContientQueDesPasses([], new Set(['e01'])), false, 'une file vide n’est plus « en cours »');
});

test('A1 : passer un exercice ne le valide jamais — une séance finie sans lui n’est pas comptée comme faite (PRD §9.1)', () => {
  const s1 = prog.seances.find((s) => s.id === 's1');
  const [premier, ...reste] = s1.exercices;

  // Elle passe le premier exercice (il retourne en fin de file) puis valide
  // tout le reste de la séance, sans jamais revenir sur celui qu’elle a
  // passé.
  const faits = reste.map((id) => fait(id, 1, 1, '2026-08-03T09:00:00.000Z'));
  assert.equal(seanceEstFaite(prog, faits, 1, 1), false, 'l’exercice passé, jamais validé, manque toujours');

  // La file elle-même le confirme : il reste exactement l’exercice passé,
  // et rien d’autre — « il ne reste que des exercices que tu as passés ».
  const exs1 = exercicesDeSeance(prog, 1);
  const file = passerEnFile(fileInitiale(exs1, new Set()));
  assert.deepEqual(new Set(faitsDeSeance(faits, 1, 1)), new Set(reste));
  assert.equal(fileNeContientQueDesPasses(file.filter((id) => !faitsDeSeance(faits, 1, 1).has(id)), new Set([premier])), true);
});

// --- purete du module (ossature §6) -----------------------------------------

test('domaine.js reste pur : ni DOM, ni stockage, ni reseau, ni horloge en dur', () => {
  const source = readFileSync(join(web, 'domaine.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const mot of ['document', 'window', 'localStorage', 'Date.now', 'fetch(']) {
    assert.equal(source.includes(mot), false, `domaine.js contient « ${mot} »`);
  }
});
