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

const TYPES_BLOC = ['course', 'renforcement'];
const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

function refuser(message) {
  throw new Error(`programme invalide : ${message}`);
}

// Le programme est une donnee, pas un etat : personne ne le mute apres le
// chargement. Le gel rend l'accident bruyant plutot que silencieux, les modules
// ES etant en mode strict.
function gelerEnProfondeur(valeur) {
  if (valeur === null || typeof valeur !== 'object') return valeur;
  for (const enfant of Object.values(valeur)) gelerEnProfondeur(enfant);
  return Object.freeze(valeur);
}

export function chargerProgramme(json) {
  if (json === null || typeof json !== 'object') refuser("la racine n'est pas un objet");
  if (!JOUR_ISO.test(json.debut)) refuser(`debut n'est pas une date YYYY-MM-DD : ${json.debut}`);
  if (!JOUR_ISO.test(json.fin)) refuser(`fin n'est pas une date YYYY-MM-DD : ${json.fin}`);
  if (json.fin < json.debut) refuser('fin est anterieure a debut');
  if (!Array.isArray(json.seances) || json.seances.length === 0) refuser('aucune seance');

  const identifiants = new Set();
  let precedente = '';

  for (const seance of json.seances) {
    if (!JOUR_ISO.test(seance.date)) refuser(`date de seance invalide : ${seance.date}`);
    // Les seances sont strictement croissantes : seanceDuJour et calendrier
    // prennent la premiere qui correspond, un desordre les rendrait faux.
    if (seance.date <= precedente) refuser(`seances non ordonnees ou dupliquees : ${seance.date}`);
    if (seance.date < json.debut || seance.date > json.fin) refuser(`seance hors programme : ${seance.date}`);
    precedente = seance.date;

    if (typeof seance.titre !== 'string' || seance.titre === '') refuser(`titre manquant : ${seance.date}`);
    if (!Number.isInteger(seance.semaine) || seance.semaine < 1) refuser(`semaine invalide : ${seance.date}`);
    if (!Array.isArray(seance.blocs) || seance.blocs.length === 0) refuser(`aucun bloc : ${seance.date}`);

    for (const bloc of seance.blocs) {
      if (!TYPES_BLOC.includes(bloc.type)) refuser(`type de bloc inconnu : ${bloc.type}`);
      if (!Number.isInteger(bloc.tours) || bloc.tours < 1) refuser(`tours invalide : ${seance.date} / ${bloc.type}`);
      if ('titre' in bloc && (typeof bloc.titre !== 'string' || bloc.titre === '')) {
        refuser(`titre de bloc vide : ${seance.date} / ${bloc.type}`);
      }
      if (!Array.isArray(bloc.exercices) || bloc.exercices.length === 0) {
        refuser(`bloc sans exercice : ${seance.date} / ${bloc.type}`);
      }

      for (const ex of bloc.exercices) {
        if (typeof ex.id !== 'string' || ex.id === '') refuser(`identifiant manquant : ${seance.date}`);
        if (identifiants.has(ex.id)) refuser(`identifiant en double : ${ex.id}`);
        identifiants.add(ex.id);
        if (typeof ex.libelle !== 'string' || ex.libelle === '') refuser(`libelle manquant : ${ex.id}`);
        if (ex.mesure === null || typeof ex.mesure !== 'object' || !UNITES.includes(ex.mesure.unite)) {
          refuser(`unite inconnue pour ${ex.id} : ${ex.mesure && ex.mesure.unite}`);
        }
        if (!Number.isFinite(ex.mesure.valeur) || ex.mesure.valeur < 0) refuser(`valeur invalide : ${ex.id}`);
      }
    }
  }

  return gelerEnProfondeur(json);
}

// Volume prescrit par le programme entier, tours compris.
export function totauxPrescrits(prog) {
  return cumuler(prog, () => true);
}

// Volume reellement accompli, d'apres les cases cochees. `faits` est l'objet
// { [idExercice]: horodatageISO } de l'ossature §6 : la presence de la cle vaut
// coche, sa valeur ne sert qu'a departager les egalites au classement.
export function totauxAccomplis(prog, faits = {}) {
  return cumuler(prog, (ex) => estFait(faits, ex.id));
}

// Etat d'une seance a une date donnee. Rend null si aucune seance n'a lieu ce
// jour-la : un jour de repos n'est pas une seance vide non faite.
export function etatSeance(prog, dateISO, aujourdhui, faits = {}) {
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (!seance) return null;

  let total = 0;
  let coches = 0;
  for (const bloc of seance.blocs) {
    for (const ex of bloc.exercices) {
      total += 1;
      if (estFait(faits, ex.id)) coches += 1;
    }
  }

  // Le passe se corrige, l'avenir ne se coche pas (PRD §9) ; et passe la fin du
  // programme plus rien ne bouge, le bilan remplace le cochage (PRD §9, §6 lot 3).
  const cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin;

  // L'ordre compte. Une seance terminee est 'faite' quelle que soit la date.
  // Le jour meme, une seance entamee n'est ni 'partielle' ni 'manquee' : elle
  // est en cours, et c'est 'aujourd-hui' qui porte cette nuance.
  let statut;
  if (total > 0 && coches === total) statut = 'faite';
  else if (dateISO > aujourdhui) statut = 'a-venir';
  else if (dateISO === aujourdhui) statut = 'aujourd-hui';
  else if (coches > 0) statut = 'partielle';
  else statut = 'manquee';

  return { statut, cochable, total, coches };
}

// La seance a montrer en ouvrant l'app.
//   'aujourd-hui' : il y a seance aujourd'hui
//   'repos'       : pas de seance ce jour ; `seance` porte la prochaine, ou
//                   null s'il n'y en a plus d'ici la fin du programme
//   'terminee'    : le programme est fini, l'ecran de bilan prend la main
export function seanceDuJour(prog, aujourdhui) {
  if (aujourdhui > prog.fin) return { seance: null, cas: 'terminee' };

  const duJour = prog.seances.find((s) => s.date === aujourdhui);
  if (duJour) return { seance: duJour, cas: 'aujourd-hui' };

  // Les seances sont validees strictement croissantes : la premiere posterieure
  // est bien la prochaine.
  const prochaine = prog.seances.find((s) => s.date > aujourdhui) ?? null;
  return { seance: prochaine, cas: 'repos' };
}
