// chrono.js — le minuteur (PRP 04 chantier B, PRD §7.3, ossature §7 point 4).
//
// Pur : il ne touche jamais au DOM. Il reçoit son horloge en paramètre pour
// rester testable sans attendre le temps réel (ossature §6, PRP 01 chantier C).
//
// AUCUNE FONCTION PUBLIQUE NE RÉDUIT LE TEMPS RESTANT. Remettre à zéro (donc
// repartir du début) est permis ; abréger ne l'est pas — un minuteur qu'on
// peut raccourcir n'est plus un minuteur (PRD §7.3). C'est vérifié par
// `tests/chrono.test.js`, qui lit ce fichier et échoue si une fonction
// publique du genre « avancer », « sauter » ou « reglerRestant » y apparaît.
//
// L'HORLOGE MURALE, PAS LES TICS : un onglet mis en arrière-plan ralentit
// `setInterval`, et un gainage d'une minute compté en tics durerait deux
// minutes. Le temps restant se RECALCULE à chaque appel depuis `horloge()` ;
// `tic` ne sert qu'à rafraîchir l'affichage à intervalles réguliers, jamais à
// faire avancer le compte.

export const ETATS = ['pret', 'en-cours', 'pause', 'termine'];

export function creerChrono({ duree, horloge = Date.now, tic } = {}) {
  if (!Number.isFinite(duree) || duree <= 0) {
    throw new Error('chrono.js : « duree » doit être un nombre de millisecondes strictement positif');
  }

  let etatCourant = 'pret';
  let departHorloge = null; // horloge() au dernier demarrage, ou null a l'arret
  let ecouleAvantDepart = 0; // ms deja ecoulees avant le segment courant

  function ecoule() {
    if (etatCourant === 'en-cours' && departHorloge !== null) {
      return ecouleAvantDepart + (horloge() - departHorloge);
    }
    return ecouleAvantDepart;
  }

  // Le seul calcul du temps restant : toujours depuis l'horloge, jamais depuis
  // un compteur de battements.
  function restant() {
    return Math.max(0, duree - ecoule());
  }

  let idIntervalle = null;
  function arreterBattement() {
    if (idIntervalle !== null) {
      clearInterval(idIntervalle);
      idIntervalle = null;
    }
  }

  function avertir() {
    if (typeof tic === 'function') tic(restant(), etatCourant);
  }

  function verifierFin() {
    if (etatCourant === 'en-cours' && restant() <= 0) {
      etatCourant = 'termine';
      ecouleAvantDepart = duree;
      departHorloge = null;
      arreterBattement();
    }
    avertir();
  }

  function demarrer() {
    if (etatCourant === 'en-cours' || etatCourant === 'termine') return;
    etatCourant = 'en-cours';
    departHorloge = horloge();
    arreterBattement();
    idIntervalle = setInterval(verifierFin, 250);
    verifierFin();
  }

  function pause() {
    arreterBattement();
    if (etatCourant !== 'en-cours') return;
    ecouleAvantDepart = ecoule();
    departHorloge = null;
    etatCourant = 'pause';
    avertir();
  }

  // Le SEUL moyen de revenir en arrière : remettre le compte à SA VALEUR DE
  // DÉPART, jamais à une valeur intermédiaire choisie ailleurs — ce qui le
  // distingue d'un « avancer » ou d'un « sauter », qui n'existent pas ici.
  function remettreAZero() {
    arreterBattement();
    etatCourant = 'pret';
    departHorloge = null;
    ecouleAvantDepart = 0;
    avertir();
  }

  return {
    demarrer,
    pause,
    remettreAZero,
    restant,
    etat: () => etatCourant,
  };
}

// « 0:45 », « 1:00 » — chiffres tabulaires côté CSS (ossature §5.2).
export function formater(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes}:${String(secondes).padStart(2, '0')}`;
}
