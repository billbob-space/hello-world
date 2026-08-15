// parures.js — A13 (« Ajouté après les PRP », le lot ludique) : les huit
// parures du justaucorps, pures (ossature §6), sur le même principe que
// `badges.js`.
//
// Une parure se gagne à chaque semaine bouclée et se garde, même si la
// condition qui l'a déclenchée redevient fausse ensuite (une correction
// depuis la grille peut décocher une séance, un programme peut recommencer à
// zéro). C'est pourquoi deux fonctions existent : `paruresAcquises` dit ce
// qui est vrai MAINTENANT à partir des faits, `nouvellesParures` dit ce qu'il
// faut AJOUTER à la liste déjà conservée dans `etat.parures` — jamais ce
// qu'il faudrait en retirer.
//
// Huit semaines, huit parures (PRD, lot ludique A13) : chaque palier
// correspond au nombre de semaines entièrement bouclées, sans se soucier de
// LESQUELLES — une semaine rejouée après un « recommencer à zéro » compte
// comme n'importe quelle autre pour ce décompte, et c'est voulu : la parure
// reste acquise pour toujours, elle ne se rattache à aucune semaine précise.

import { progression } from './domaine.js';

function semainesCompletes(prog, etat) {
  return progression(prog, etat.faits).semainesCompletes;
}

function palierAtteint(n) {
  return (prog, etat) => semainesCompletes(prog, etat) >= n;
}

// `partie` identifie l'élément dessiné par `vue-justaucorps.js` — jamais lu
// ailleurs, c'est le seul lien entre ce catalogue et le dessin.
export const PARURES = [
  { id: 'parure-1', nom: 'Passepoil', partie: 'passepoil', phrase: 'Un passepoil d’or a rejoint la couture.', condition: palierAtteint(1) },
  { id: 'parure-2', nom: 'Rang de strass', partie: 'strass', phrase: 'Un rang de strass est venu se poser.', condition: palierAtteint(2) },
  { id: 'parure-3', nom: 'Chevron', partie: 'chevron', phrase: 'Un chevron s’ajoute à l’épaule.', condition: palierAtteint(3) },
  { id: 'parure-4', nom: 'Empiècement', partie: 'empiecement', phrase: 'Un empiècement de plus habille le buste.', condition: palierAtteint(4) },
  { id: 'parure-5', nom: 'Second passepoil', partie: 'passepoil-2', phrase: 'Un second passepoil suit la première couture.', condition: palierAtteint(5) },
  { id: 'parure-6', nom: 'Second rang de strass', partie: 'strass-2', phrase: 'Un second rang de strass rejoint le premier.', condition: palierAtteint(6) },
  { id: 'parure-7', nom: 'Second chevron', partie: 'chevron-2', phrase: 'Un second chevron rejoint l’autre épaule.', condition: palierAtteint(7) },
  { id: 'parure-8', nom: 'Empiècement complet', partie: 'empiecement-2', phrase: 'Le dernier empiècement referme le justaucorps.', condition: palierAtteint(8) },
];

// Pur, sans effet de bord : dit ce qui est vrai maintenant, sans jamais lire
// ni écrire `etat.parures`.
export function paruresAcquises(prog, etat) {
  return PARURES.filter((p) => p.condition(prog, etat)).map((p) => p.id);
}

// Ce qu'il faut ANNONCER et AJOUTER à `avant.parures` — jamais ce qu'il
// faudrait en retirer. Une parure déjà présente dans `avant.parures` n'est
// plus jamais rendue, même si sa condition redevient vraie après une décoche
// puis une recoche : chaque parure n'est acquise qu'une fois.
export function nouvellesParures(prog, avant, apres) {
  const dejaAcquises = new Set(avant.parures ?? []);
  return paruresAcquises(prog, apres).filter((id) => !dejaAcquises.has(id));
}
