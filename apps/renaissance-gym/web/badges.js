// badges.js — les six badges du PRD §6 lot 3, purs (PRP 05 chantier C,
// ossature §6). Aucun DOM, aucun stockage, aucun réseau : ce module ne fait
// que lire un programme et un état, jamais ne les modifie.
//
// Un badge se gagne une fois et se garde, même si la condition qui l'a
// déclenché redevient fausse ensuite (une correction depuis la grille peut
// décocher une séance). C'est pourquoi deux fonctions existent : `badgesGagnes`
// dit ce qui est vrai MAINTENANT, `nouveauxBadges` dit ce qu'il faut AJOUTER à
// la liste déjà conservée dans `etat.badges` — jamais ce qu'il faudrait en
// retirer.
//
// Les phrases ne comparent jamais, ne classent jamais et ne parlent pas du
// corps (PRP 05 chantier C) : chacune décrit ce qui vient d'être fait, point.

import { exercices, exercice, objectif } from './programme.js';
import { progression, seancesFaites } from './domaine.js';

const SEMAINES_DU_PROGRAMME = 8;

// « La moitié » : quatre semaines à au moins trois séances.
const SEMAINES_REQUISES_POUR_LA_MOITIE = 4;
const SEANCES_MIN_PAR_SEMAINE_POUR_LA_MOITIE = 3;

// « Les huit semaines » : la semaine huit atteinte avec au moins les trois
// quarts des séances possibles faites sur l'ensemble du programme.
const SEANCES_MIN_POUR_LES_HUIT_SEMAINES = 24;

// La dernière marche de la progression des tenues (PRD §8.3) : l'objectif
// plein d'une minute, atteint aux deux dernières semaines seulement.
const OBJECTIF_TENUE_PLEIN_EN_SECONDES = 60;

function premierJour(prog, etat) {
  return progression(prog, etat.faits).seancesFaites >= 1;
}

function semaineBouclee(prog, etat) {
  return progression(prog, etat.faits).semainesCompletes >= 1;
}

function laMoitie(prog, etat) {
  let semainesAuSeuil = 0;
  for (let semaine = 1; semaine <= SEMAINES_DU_PROGRAMME; semaine += 1) {
    if (seancesFaites(prog, etat.faits, semaine) >= SEANCES_MIN_PAR_SEMAINE_POUR_LA_MOITIE) {
      semainesAuSeuil += 1;
    }
  }
  return semainesAuSeuil >= SEMAINES_REQUISES_POUR_LA_MOITIE;
}

function les36(prog, etat) {
  return progression(prog, etat.faits).exercicesVus >= exercices(prog).length;
}

// Une tenue n'est jamais enregistrée en cours de route (`vue-seance.js` ne
// valide qu'un chrono arrivé à zéro sans interruption) : tout fait présent
// pour un exercice « tenue » correspond déjà à une tenue menée à son terme.
// Reste à vérifier qu'elle a été menée à SON objectif le plus haut.
function uneMinute(prog, etat) {
  return etat.faits.some((f) => {
    const ex = exercice(prog, f.exercice);
    if (ex === undefined || ex.mesure !== 'tenue') return false;
    return objectif(ex, f.semaine).valeur >= OBJECTIF_TENUE_PLEIN_EN_SECONDES;
  });
}

// L'avenir ne se coche pas (PRD §9.3) : un fait daté de la semaine huit prouve
// à lui seul qu'elle l'a atteinte, sans avoir besoin de l'horloge ici.
function lesHuitSemaines(prog, etat) {
  const semaineHuitAtteinte = etat.faits.some((f) => f.semaine === SEMAINES_DU_PROGRAMME);
  return semaineHuitAtteinte && progression(prog, etat.faits).seancesFaites >= SEANCES_MIN_POUR_LES_HUIT_SEMAINES;
}

export const BADGES = [
  {
    id: 'premier-jour',
    nom: 'Premier jour',
    phrase: 'Tu as fait ta première séance.',
    condition: premierJour,
  },
  {
    id: 'semaine-bouclee',
    nom: 'Semaine bouclée',
    phrase: 'Une semaine entière, toutes les séances faites.',
    condition: semaineBouclee,
  },
  {
    id: 'la-moitie',
    nom: 'La moitié',
    phrase: 'Tu tiens le rythme depuis un moment.',
    condition: laMoitie,
  },
  {
    id: 'les-36',
    nom: 'Les 36',
    phrase: 'Tu as fait chacun des exercices de ta feuille.',
    condition: les36,
  },
  {
    id: 'une-minute',
    nom: 'Une minute',
    phrase: 'Tu as tenu une minute entière.',
    condition: uneMinute,
  },
  {
    id: 'les-huit-semaines',
    nom: 'Les huit semaines',
    phrase: 'Le programme est passé, et tu y es allée.',
    condition: lesHuitSemaines,
  },
];

// Pur, sans effet de bord (PRP 05 chantier C) : dit ce qui est vrai
// maintenant, sans jamais lire ni écrire `etat.badges`.
export function badgesGagnes(prog, etat) {
  return BADGES.filter((b) => b.condition(prog, etat)).map((b) => b.id);
}

// Ce qu'il faut ANNONCER et AJOUTER à `avant.badges` — jamais ce qu'il
// faudrait en retirer. `avant` porte la liste déjà conservée ; `apres` porte
// les faits à jour. Un badge déjà présent dans `avant.badges` n'est plus
// jamais rendu, même si sa condition redevient vraie après une décoche puis
// une recoche : « un badge n'est attribué qu'une fois » (PRP 05).
export function nouveauxBadges(prog, avant, apres) {
  const dejaGagnes = new Set(avant.badges ?? []);
  return badgesGagnes(prog, apres).filter((id) => !dejaGagnes.has(id));
}
