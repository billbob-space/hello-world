// domaine.js — le domaine de marcq-handball, pur.
//
// Aucun acces au navigateur, aucun stockage, aucune horloge implicite : le jour
// courant est toujours un parametre. C'est ce qui permet a node --test de
// prouver ce module tel que le navigateur le charge, sans transpilation.
//
// Toutes les dates sont des jours calendaires 'YYYY-MM-DD' compares comme des
// chaines : l'ordre lexicographique de l'ISO 8601 est l'ordre chronologique.

// Les unites mesurables. `autre` existe pour les exercices sans volume
// calculable et n'entre dans aucun total.
const UNITES = [
  'pompes', 'squats', 'burpees', 'abdos',
  'gainage_s', 'min_course', 'fentes', 'autre',
];

const UNITES_CUMULEES = UNITES.filter((u) => u !== 'autre');

function totauxVides() {
  const totaux = { cases: 0 };
  for (const unite of UNITES_CUMULEES) totaux[unite] = 0;
  return totaux;
}

function estFait(faits, id) {
  return Object.prototype.hasOwnProperty.call(faits, id);
}

// Une ligne d'exercice vaut une case, quel que soit le nombre de tours ; les
// tours ne multiplient que le volume.
function cumuler(prog, garder) {
  const totaux = totauxVides();
  for (const seance of prog.seances) {
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) {
        if (!garder(ex, seance)) continue;
        totaux.cases += 1;
        if (ex.mesure.unite !== 'autre') {
          totaux[ex.mesure.unite] += ex.mesure.valeur * bloc.tours;
        }
      }
    }
  }
  return totaux;
}

// Point d'entree unique du programme : tout le reste part de sa valeur de retour.
export function chargerProgramme(json) {
  return json;
}

// Volume prescrit par le programme entier, tours compris.
export function totauxPrescrits(prog) {
  return cumuler(prog, () => true);
}
