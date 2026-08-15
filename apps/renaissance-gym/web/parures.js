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
// A20 (« Ajouté après les PRP ») corrige A13 croisé avec le §7.1 : les huit
// parures ne sont plus au rythme d'UNE PAR SEMAINE BOUCLÉE dans l'absolu,
// mais réparties sur les semaines qu'elle a RÉELLEMENT DEVANT ELLE — celle
// qui démarre en semaine 6 n'a que trois semaines pour huit parures, sinon
// son justaucorps ne peut jamais se compléter. `taillesEtapes` fait cette
// répartition : huit éléments en `n` étapes aussi égales que possible, les
// premières étapes recevant l'élément en trop quand huit ne se divise pas
// exactement (3 semaines : 3, 3, 2) — et la dernière étape totalise toujours
// les huit, quel que soit `n`, ce qui est tout le point : la dernière semaine
// bouclée achève toujours le justaucorps.
//
// Le nombre de semaines bouclées compte, sans se soucier de LESQUELLES — une
// semaine rejouée après un « recommencer à zéro » compte comme n'importe
// quelle autre pour ce décompte, et c'est voulu : la parure reste acquise
// pour toujours, elle ne se rattache à aucune semaine précise.

import { progression } from './domaine.js';

const NB_SEMAINES_PROGRAMME = 8;
const NB_PARURES = 8;

function semainesCompletes(prog, etat) {
  return progression(prog, etat.faits).semainesCompletes;
}

// 1..8 : celle choisie à l'entrée (PRD §7.1) ou changée depuis les réglages
// (A10). Une valeur absente ou hors bornes (état construit à la main dans les
// tests, par exemple) retombe sur 1 — le programme complet, huit semaines
// devant elle, exactement le comportement d'avant A20.
function semaineDeDepart(etat) {
  const v = etat.semaineDeDepart;
  return Number.isInteger(v) && v >= 1 && v <= NB_SEMAINES_PROGRAMME ? v : 1;
}

// Le nombre de semaines qu'elle a réellement devant elle, à partir de sa
// semaine de départ jusqu'à la huitième incluse.
function semainesDevantElle(etat) {
  return NB_SEMAINES_PROGRAMME - semaineDeDepart(etat) + 1;
}

// La taille de chaque étape d'une répartition de `NB_PARURES` éléments en `n`
// étapes : la base (division entière), et le reste distribué une unité par
// étape en commençant par la première — 8 en 3 étapes donne [3, 3, 2], 8 en 8
// étapes donne huit fois [1].
function taillesEtapes(n) {
  const base = Math.floor(NB_PARURES / n);
  const reste = NB_PARURES % n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
}

// Le total de parures que `k` semaines bouclées valent, pour une gymnaste qui
// a `n` semaines devant elle — la somme des `k` premières étapes.
function totalPourSemainesBouclees(n, k) {
  const tailles = taillesEtapes(n);
  let total = 0;
  for (let i = 0; i < k && i < tailles.length; i += 1) total += tailles[i];
  return total;
}

// Le nombre de parures que les faits ACTUELS valent, compte tenu de la
// semaine de départ actuelle. Les semaines bouclées au-delà de ce qu'elle a
// devant elle ne comptent pas davantage que le maximum : le justaucorps ne
// porte jamais plus de huit éléments.
function totalParuresDues(prog, etat) {
  const n = semainesDevantElle(etat);
  const k = Math.min(semainesCompletes(prog, etat), n);
  return totalPourSemainesBouclees(n, k);
}

function palierAtteint(rang) {
  return (prog, etat) => totalParuresDues(prog, etat) >= rang;
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
