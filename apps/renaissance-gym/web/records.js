// records.js — A16 (« Ajouté après les PRP », le lot ludique) : trois faits
// pris sur ce qu'elle a fait, purs (ossature §6). Aucun DOM, aucun stockage,
// aucun réseau : ce module ne fait que lire des faits et fusionner des
// records, jamais il n'écrit dans `etat.js` lui-même — c'est l'appelant (une
// vue) qui persiste, exactement comme `badges.js`.
//
// LES TROIS RECORDS NE PEUVENT QUE MONTER (PRD, lot ludique A16) : rien ici
// ne les fait redescendre, même quand un fait est retiré depuis la grille
// (§9.4) ou qu'un programme recommence à zéro. C'est pourquoi deux choses
// existent séparément : `recordsDepuisFaits` dit ce que les faits ACTUELS
// racontent, `fusionnerRecords` ne retient jamais que le plus grand,
// champ par champ — la même fonction sert à la mise à jour locale et à la
// fusion entre deux téléphones (PRD §9.8, généralisé par le lot ludique).
//
// Explicitement écarté (PRD, lot ludique A16) : aucune série de jours
// consécutifs, aucun « streak ». Les trois records retenus ne regardent que
// des quantités qui ne peuvent que grandir — jamais un compteur qu'une seule
// journée manquée remettrait à zéro.

export const RECORDS_VIDES = {
  plusLongueTenue: 0, // secondes, la tenue la plus longue menée à son terme
  plusExercicesJour: 0, // le plus d'exercices faits un même jour calendaire
  totalExercices: 0, // le nombre d'exercices faits en tout
};

function nombreValide(v) {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

// Ne retient jamais que le plus grand, champ par champ. `a` et `b` peuvent
// être partiels ou absents (une fiche jamais synchronisée, une réponse de
// serveur antérieure au lot ludique) : chaque champ manquant vaut zéro,
// jamais une exception.
export function fusionnerRecords(a, b) {
  const x = { ...RECORDS_VIDES, ...(a ?? {}) };
  const y = { ...RECORDS_VIDES, ...(b ?? {}) };
  return {
    plusLongueTenue: Math.max(nombreValide(x.plusLongueTenue), nombreValide(y.plusLongueTenue)),
    plusExercicesJour: Math.max(nombreValide(x.plusExercicesJour), nombreValide(y.plusExercicesJour)),
    totalExercices: Math.max(nombreValide(x.totalExercices), nombreValide(y.totalExercices)),
  };
}

// Le plus d'exercices validés un même jour calendaire — les dix premiers
// caractères ISO de chaque fait, la même granularité que le reste de
// l'application. Un jour où rien n'est fait ne compte pas.
export function plusExercicesUnJour(faits) {
  const parJour = new Map();
  for (const f of faits) {
    const jour = String(f.a).slice(0, 10);
    parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
  }
  let max = 0;
  for (const n of parJour.values()) max = Math.max(max, n);
  return max;
}

// Un instantané dérivé des faits ACTUELS — jamais à écrire tel quel, toujours
// à FUSIONNER avec ce qui est déjà enregistré (`etat.records`) : un exercice
// décoché depuis la grille (PRD §9.4), ou un programme qu'on recommence à
// zéro, ne doit jamais faire redescendre un record déjà acquis.
//
// `totalExercices` compte les exercices ACTUELLEMENT cochés (comme
// `faits.length`) : c'est un instantané, pas un cumul à vie — c'est
// précisément pour ça qu'il doit être fusionné, jamais recopié.
export function recordsDepuisFaits(faits) {
  return {
    ...RECORDS_VIDES,
    plusExercicesJour: plusExercicesUnJour(faits),
    totalExercices: faits.length,
  };
}
