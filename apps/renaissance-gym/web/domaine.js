// domaine.js — les regles metier du PRD §9, pures (ossature §6).
//
// Aucune fonction d'ici ne lit l'horloge : ce module n'importe ni ne consulte
// jamais Date.now() ni new Date() (ossature §6, PRP 01 chantier C).
//
// A5 (« Ajouté après les PRP ») corrige le §8.5 et la regle §9.6, qui
// disaient l'inverse : une semaine n'avance plus SUR LE CALENDRIER, elle
// avance quand ses QUATRE SEANCES SONT FAITES, et pas avant. `semaineCourante`
// ne prend donc plus ni date de debut ni horloge — elle se DEDUIT DES FAITS
// et de la semaine de depart, rien d'autre. C'est ce qui permet a une reprise
// sur un second telephone de retrouver EXACTEMENT la meme semaine que le
// premier des qu'ils partagent les memes faits : un compteur local qui
// avancerait tout seul, lui, diverguerait d'un appareil a l'autre.
//
// L'avancement est stocke comme une liste de faits dates :
//   { seance: 1..4, semaine: 1..8, exercice: 'e07', a: '2026-08-14T09:12:00.000Z' }
// La date de chaque fait reste enregistree — elle sert toujours a la fusion
// entre deux appareils (§9.8) — mais elle ne sert plus a faire avancer le
// programme.

import { exercicesDeSeance } from './programme.js';

const SEMAINES_DU_PROGRAMME = 8;

// 1..8, ou 9 quand le programme est termine (PRD §9.7, regle 7 : au-dela de la
// semaine 8, le programme est termine). `semaineDeDepart` est celle choisie a
// l'entree (PRD §7.1) ou changee depuis les reglages (A10) : une gymnaste qui
// commence en semaine 5 ne redemarre pas a 1 (PRD §8.3).
//
// A5 : la plus petite semaine, a partir de semaineDeDepart, dont les quatre
// seances ne sont pas ENCORE TOUTES faites. Aucune notion de retard : une
// semaine qui n'avance pas parce qu'elle n'a pas ete faite n'est pas une
// semaine en retard, elle est simplement celle qui compte encore.
export function semaineCourante(prog, faits, semaineDeDepart) {
  let semaine = semaineDeDepart;
  while (semaine <= SEMAINES_DU_PROGRAMME && seancesFaites(prog, faits, semaine) === 4) {
    semaine += 1;
  }
  return semaine;
}

// A5 : la semaine qu'elle vient de boucler, si elle n'a ENCORE RIEN commence
// de la suivante — c'est ce qui fait exister le palier « Ta semaine est
// bouclee » (vue-jour.js) sans le moindre compteur local : tant qu'aucun
// exercice de la nouvelle semaine courante n'est valide, on sait qu'elle
// vient tout juste de finir celle d'avant. Des qu'elle valide quoi que ce
// soit de la nouvelle semaine — meme un seul exercice — ce palier disparait
// de lui-meme, rendu null : ce n'est jamais un etat a part qu'il faudrait
// effacer explicitement, seulement ce que les faits disent a l'instant lu.
// Rend null tant qu'elle n'a jamais rien fini (semaine === semaineDeDepart,
// rien a celebrer) et une fois le programme termine (le palier « termine » de
// vue-jour.js prend le relais).
export function semaineVenantDetreBouclee(prog, faits, semaineDeDepart) {
  const courante = semaineCourante(prog, faits, semaineDeDepart);
  if (courante <= semaineDeDepart || courante > SEMAINES_DU_PROGRAMME) return null;
  // Un seul exercice valide dans la nouvelle semaine suffit a faire
  // disparaitre ce palier — pas seulement une seance entiere : `seancesFaites`
  // ne compterait qu'une seance ACHEVEE, ce qui laisserait le palier affiche
  // pendant toute une seance commencee mais pas finie.
  const dejaCommencee = faits.some((f) => f.semaine === courante);
  if (dejaCommencee) return null;
  return courante - 1;
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

// A8 (« Ajoute apres les PRP ») : vrai si l'exercice a ete valide au moins
// une fois cette semaine, TOUTES SEANCES CONFONDUES — un exercice peut
// apparaitre dans plusieurs seances de la meme semaine (PRD §8.4, la
// souplesse reprise en fin de semaine), et une seule validation suffit a le
// marquer fait pour la liste des trente-six.
export function exerciceFaitCetteSemaine(faits, semaine, idExercice) {
  return faits.some((f) => f.semaine === semaine && f.exercice === idExercice);
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
