// recompenses.js — le fun, et la ou il doit etre (PRD §10).
//
// Une animation est une recompense, jamais un peage : elle vient APRES l'action,
// ne retarde aucun tap, et ne s'interpose jamais entre l'enfant et la case
// suivante. Trois consequences, qui sont des regles de ce fichier :
//
//   1. le cochage n'execute pas une ligne d'ici — il est entierement en CSS,
//      donc il ne PEUT PAS retarder un tap ;
//   2. rien ne demarre sans un geste : pas de minuterie d'ambiance, pas
//      d'animation en boucle ;
//   3. `prefers-reduced-motion` supprime tout mouvement, et tout reste
//      utilisable — c'est verifie a deux niveaux, ici et dans style.css.

import { totauxAccomplis } from './domaine.js';

// La requete media est nommee : une faute de frappe rendrait `matches` toujours
// faux, et personne ne s'en apercevrait avant qu'un utilisateur ne se plaigne.
export const REQUETE_MOUVEMENT_REDUIT = '(prefers-reduced-motion: reduce)';

// La preference du systeme. `fenetre` est un parametre pour que `node --test`
// puisse repondre a la place du navigateur : le respect de cette preference est
// la seule des trois interdictions du PRD §10 qu'un test peut prouver.
export function mouvementReduit(fenetre = globalThis) {
  // Pas de matchMedia ne veut pas dire « mouvement reduit », mais « on ne sait
  // pas ». Repondre `true` priverait d'animation un navigateur qui n'a rien
  // demande ; le bloc CSS protege de toute facon.
  if (typeof fenetre?.matchMedia !== 'function') return false;
  return fenetre.matchMedia(REQUETE_MOUVEMENT_REDUIT).matches === true;
}

// --- le roulement d'un compteur ---------------------------------------------

// Assez long pour qu'on VOIE le nombre monter, assez court pour ne pas faire
// attendre. Au-dela d'une seconde on regarde une animation ; en deca de six
// cents millisecondes on ne lit rien.
export const DUREE_ROULEMENT_MS = 900;

// Ou en est le compteur a `part` du trajet. Pure : c'est ici que vivent la
// courbe, l'arrondi et le bornage, donc c'est ici que `node --test` les attrape.
export function valeurRoulee(depart, arrivee, part) {
  const t = Math.min(1, Math.max(0, part));
  // Sortie amortie : vite au debut, lent a l'arrivee — c'est la que l'oeil lit
  // le nombre. Une progression lineaire se lit comme un compteur casse.
  const adouci = 1 - (1 - t) ** 3;
  // L'arrivee est posee telle quelle : sans ce cas, un arrondi rendrait 225 la
  // ou le programme en prescrit 226, et le chiffre affiche serait faux.
  return t === 1 ? arrivee : Math.round(depart + (arrivee - depart) * adouci);
}

// Fait rouler le texte d'un noeud de `depart` a `arrivee`. Rend une fonction
// qui interrompt le roulement en POSANT la valeur finale : un compteur
// interrompu a mi-chemin afficherait un nombre faux, ce qui est pire qu'un
// nombre pose d'un coup.
//
// `planifier` et `maintenant` sont des parametres parce que Node n'a ni
// requestAnimationFrame ni horloge d'animation : c'est ce qui rend cette boucle
// verifiable sans navigateur.
export function rouler(noeud, depart, arrivee, options = {}) {
  const {
    duree = DUREE_ROULEMENT_MS,
    format = (valeur) => String(valeur),
    reduit = mouvementReduit(),
    planifier = (rappel) => requestAnimationFrame(rappel),
    maintenant = () => performance.now(),
  } = options;

  if (reduit || duree <= 0 || depart === arrivee) {
    noeud.textContent = format(arrivee);
    return () => {};
  }

  const debut = maintenant();
  let vivant = true;

  const pas = () => {
    if (!vivant) return;
    const part = Math.min(1, (maintenant() - debut) / duree);
    noeud.textContent = format(valeurRoulee(depart, arrivee, part));
    if (part < 1) planifier(pas);
  };

  noeud.textContent = format(depart);
  planifier(pas);

  return () => {
    vivant = false;
    noeud.textContent = format(arrivee);
  };
}

// --- ce que le panneau annonce ----------------------------------------------

// Quatre compteurs, pas six. Le panneau tient sur un ecran de telephone tenu a
// bout de bras ; l'inventaire complet — gainage et abdos compris — est l'ecran
// perso (PRP 05, PRD §7.5). Les libelles sont des NOMBRES suivis d'un mot :
// « 2 h 10 de course » ne roule pas, « 130 min de course » roule.
export const UNITES_DU_PANNEAU = [
  { cle: 'pompes', libelle: 'pompes' },
  { cle: 'squats', libelle: 'squats' },
  { cle: 'burpees', libelle: 'burpees' },
  { cle: 'min_course', libelle: 'min de course' },
];

// Combien de seances sont entierement cochees. Sans horloge : une seance
// terminee l'est quelle que soit la date a laquelle on la regarde, et faire
// entrer `aujourdhui` ici rendrait le panneau dependant du fuseau.
export function seancesTerminees(prog, faits) {
  return prog.seances.filter((seance) =>
    seance.blocs.every((bloc) =>
      bloc.exercices.every((ex) => Object.prototype.hasOwnProperty.call(faits, ex.id)))).length;
}

// Les faits tels qu'ils etaient AVANT cette seance. C'est le point de depart du
// roulement : sans lui les compteurs partiraient de zero et raconteraient qu'on
// n'a rien fait avant aujourd'hui. L'objet recu n'est pas mute — regle 1 du
// contrat d'ecran du PRP 03, et un second etat divergerait en silence.
export function faitsSansSeance(prog, faits, dateISO) {
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (seance === undefined) return faits;

  const restant = { ...faits };
  for (const bloc of seance.blocs) {
    for (const ex of bloc.exercices) delete restant[ex.id];
  }
  return restant;
}

// Tout ce que le panneau doit savoir, et rien de plus. Les valeurs viennent du
// domaine : modifier programme.json change ce qui s'affiche sans toucher au
// code (PRD §8).
export function resumeDeFin(prog, faits) {
  const totaux = totauxAccomplis(prog, faits);
  return {
    seances: seancesTerminees(prog, faits),
    seancesTotal: prog.seances.length,
    compteurs: UNITES_DU_PANNEAU
      .map(({ cle, libelle }) => ({ cle, libelle, valeur: totaux[cle] ?? 0 }))
      .filter((compteur) => compteur.valeur > 0),
  };
}
