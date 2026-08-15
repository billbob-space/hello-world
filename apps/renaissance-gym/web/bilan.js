// bilan.js — A17 (« Ajouté après les PRP », le lot ludique) : l'instantané du
// programme terminé, pur (ossature §6). Aucun DOM, aucun stockage, aucun
// réseau : ce module ne fait que lire un programme et un état, jamais il
// n'écrit — c'est `vue-jour.js` qui persiste, exactement comme `badges.js`
// et `parures.js`.
//
// « C'est la trace de son été » (PRD, lot ludique A17) : l'instantané se
// construit UNE SEULE FOIS, au moment précis où le programme se termine
// (`vue-jour.js`, cas « termine »), et ne bouge plus jamais ensuite — y
// compris si un nouveau programme redémarre. C'est pour ça que ce module ne
// recalcule rien à partir des faits COURANTS : il fige ce qui est vrai à
// l'instant où on le lui demande, une fois pour toutes.

import { progression } from './domaine.js';

// `exercicesFaits` reprend le record déjà tenu à jour par `records.js`
// (`totalExercices`) plutôt que de recompter `faits.length` : les deux
// mesurent la même chose, mais le record est celui qui ne redescend jamais,
// même après une correction depuis la grille.
export function construireBilan(prog, etat, maintenant) {
  return {
    seancesFaites: progression(prog, etat.faits).seancesFaites,
    exercicesFaits: etat.records?.totalExercices ?? 0,
    records: { ...etat.records },
    dateISO: maintenant().toISOString(),
  };
}

// Une phrase qui nomme sans emphase et sans comparaison (PRD, lot ludique
// A17) : ce qu'elle a fait, en toutes lettres, rien de plus.
export function phraseBilan(bilan) {
  const seances = bilan.seancesFaites === 1 ? '1 séance' : `${bilan.seancesFaites} séances`;
  const exercices = bilan.exercicesFaits === 1 ? '1 exercice' : `${bilan.exercicesFaits} exercices`;
  return `Cet été, tu as fait ${seances} et ${exercices}.`;
}
