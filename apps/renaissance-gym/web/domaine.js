// domaine.js — les regles metier du PRD §9, pures (ossature §6).
//
// Aucune fonction d'ici ne lit l'horloge : le moment courant est toujours
// PASSE EN PARAMETRE, ce qui les rend testables sans figer le temps
// (ossature §6, PRP 01 chantier C).
//
// L'avancement est stocke comme une liste de faits dates :
//   { seance: 1..4, semaine: 1..8, exercice: 'e07', a: '2026-08-14T09:12:00.000Z' }

import { exercicesDeSeance } from './programme.js';

const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000;
const SEMAINES_DU_PROGRAMME = 8;

function commeInstant(valeur) {
  return valeur instanceof Date ? valeur : new Date(valeur);
}

// 1..8, ou 9 quand le programme est termine (PRD §9.7, regle 7 : au-dela de la
// semaine 8, le programme est termine). `semaineDeDepart` est celle choisie a
// l'entree (PRD §7.1) : une gymnaste qui commence en semaine 5 ne redemarre
// pas a 1 (PRD §8.3).
export function semaineCourante(debutISO, maintenant, semaineDeDepart) {
  if (!debutISO) return semaineDeDepart;
  const debut = commeInstant(debutISO).getTime();
  const now = commeInstant(maintenant).getTime();
  const semainesEcoulees = Math.max(0, Math.floor((now - debut) / SEMAINE_MS));
  const semaine = semaineDeDepart + semainesEcoulees;
  return semaine > SEMAINES_DU_PROGRAMME ? SEMAINES_DU_PROGRAMME + 1 : semaine;
}

// Le premier instant d'une semaine donnee — PRD §8.5 : la semaine court sur
// sept jours depuis le jour ou la gymnaste a demarre, jamais depuis le lundi.
export function debutDeSemaine(debutISO, semaine, semaineDeDepart) {
  const debut = commeInstant(debutISO).getTime();
  const decalage = (semaine - semaineDeDepart) * SEMAINE_MS;
  return new Date(debut + decalage);
}

// PRD §9.3 : l'avenir ne se coche pas.
export function semaineEstFuture(semaine, semaineCouranteActuelle) {
  return semaine > semaineCouranteActuelle;
}

// PRD §9.4 : le passe se corrige — une semaine entierement ecoulee.
export function semaineEstPassee(semaine, semaineCouranteActuelle) {
  return semaine < semaineCouranteActuelle;
}

// Le Set des identifiants d'exercices valides pour une seance d'une semaine
// donnee, tel qu'il ressort des faits — sans jamais consulter le programme :
// c'est la brique dont se servent `seanceEstFaite` et `progression`.
export function faitsDeSeance(faits, semaine, numero) {
  const set = new Set();
  for (const f of faits) {
    if (f.semaine === semaine && f.seance === numero) set.add(f.exercice);
  }
  return set;
}

// PRD §9.1 : une seance est faite quand TOUS ses exercices sont valides.
export function seanceEstFaite(prog, faits, semaine, numero) {
  const attendus = exercicesDeSeance(prog, numero).map((ex) => ex.id);
  if (attendus.length === 0) return false;
  const faitsSet = faitsDeSeance(faits, semaine, numero);
  return attendus.every((id) => faitsSet.has(id));
}

// A3 (« Ajouté après les PRP ») : la proportion d'exercices valides d'une
// seance, entre 0 et 1 — jamais rendue en chiffre nulle part (PRD §4, §14),
// seulement en remplissage progressif de la case dans la grille. 0 si la
// seance n'a aucun exercice attendu (garde-fou, ne devrait jamais survenir).
export function avancementSeance(prog, faits, semaine, numero) {
  const attendus = exercicesDeSeance(prog, numero).map((ex) => ex.id);
  if (attendus.length === 0) return 0;
  const faitsSet = faitsDeSeance(faits, semaine, numero);
  const nFaits = attendus.filter((id) => faitsSet.has(id)).length;
  return nFaits / attendus.length;
}

export function seancesFaites(prog, faits, semaine) {
  let n = 0;
  for (let numero = 1; numero <= 4; numero += 1) {
    if (seanceEstFaite(prog, faits, semaine, numero)) n += 1;
  }
  return n;
}

// PRD §7.2 : la plus petite seance non faite de la semaine, ou null quand les
// quatre sont faites — le repos comme resultat, jamais un retour en arriere.
export function prochaineSeance(prog, faits, semaine) {
  for (let numero = 1; numero <= 4; numero += 1) {
    if (!seanceEstFaite(prog, faits, semaine, numero)) return numero;
  }
  return null;
}

// PRD §9.8 : la fusion de deux fiches est une UNION, jamais une soustraction —
// aucune case cochee ne se decoche par synchronisation. Quand le meme exercice
// est fait aux deux dates sur deux appareils, la date retenue est la PLUS
// ANCIENNE : c'est celle ou l'exercice a reellement ete fait.
export function fusionner(faitsA, faitsB) {
  const cle = (f) => `${f.semaine}|${f.seance}|${f.exercice}`;
  const carte = new Map();
  for (const f of [...faitsA, ...faitsB]) {
    const existant = carte.get(cle(f));
    if (existant === undefined || f.a < existant.a) carte.set(cle(f), f);
  }
  return [...carte.values()].sort((a, b) => cle(a).localeCompare(cle(b)));
}

// --- « Ajouté après les PRP », A1 : « Passer » un exercice -----------------
//
// La file d'une seance en cours : les identifiants des exercices non encore
// valides, dans leur ordre de presentation. « Passer » ne valide rien et ne
// retire rien de la seance — c'est un changement d'ORDRE dans cette file,
// jamais une reduction, jamais un fait. Aucune de ces fonctions ne touche
// `faits` : un exercice passe ne compte ni comme fait ni comme manque, et la
// regle §9.1 (une seance est faite quand TOUS ses exercices sont valides)
// n'a besoin de rien savoir de plus.

// La file initiale d'une seance : ses exercices, dans l'ordre du programme,
// moins ceux deja valides — la meme reprise que `indexPremierNonFait`, mais
// rendue comme une file entiere plutot qu'un seul index, pour que la suite
// puisse la reordonner.
export function fileInitiale(exercicesSeance, faitsSet) {
  return exercicesSeance.filter((ex) => !faitsSet.has(ex.id)).map((ex) => ex.id);
}

// Renvoie l'exercice en tete de file A LA FIN de la file : ni valide, ni
// perdu, seulement reordonne. Elle peut le passer autant de fois qu'elle
// veut : il revient toujours, puisque rien ici ne le retire jamais de la
// file. Une file d'un seul exercice (ou vide) est rendue inchangee.
export function passerEnFile(file) {
  if (file.length <= 1) return [...file];
  const [tete, ...reste] = file;
  return [...reste, tete];
}

// Vrai quand tout ce qui reste dans la file a deja ete passe au moins une
// fois : le signal qui declenche « il ne reste que des exercices que tu as
// passes » a l'ecran.
export function fileNeContientQueDesPasses(file, idsPasses) {
  return file.length > 0 && file.every((id) => idsPasses.has(id));
}

// Un instantane de la progression, pour la grille et les badges (lot 3) :
// combien de seances faites au total, combien de semaines entierement
// bouclees, combien d'exercices distincts deja vus au moins une fois.
export function progression(prog, faits) {
  let totalSeances = 0;
  let semainesCompletes = 0;
  for (let semaine = 1; semaine <= SEMAINES_DU_PROGRAMME; semaine += 1) {
    const n = seancesFaites(prog, faits, semaine);
    totalSeances += n;
    if (n === 4) semainesCompletes += 1;
  }
  const exercicesVus = new Set(faits.map((f) => f.exercice)).size;
  return { seancesFaites: totalSeances, semainesCompletes, exercicesVus };
}
