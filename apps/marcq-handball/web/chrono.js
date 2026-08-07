// chrono.js — le minuteur d'un exercice.
//
// Deux moities, comme partout ici : un noyau PUR — une machine a etats que
// `node --test` interroge sans navigateur — et un montage qui n'ajoute aucune
// decision. Tout ce qui peut se tromper est dans la premiere.
//
// DEUX MODES, ET C'EST LE PROGRAMME QUI TRANCHE, jamais l'enfant : un exercice
// dont la duree est prescrite — le gainage en secondes, la course en minutes —
// recoit un COMPTE A REBOURS, parce que la question qu'il pose est « quand
// est-ce fini ? ». Les autres — quinze pompes, vingt squats — recoivent un
// CHRONOMETRE qui monte, parce que leur question est « en combien de temps ? ».
// Un rebours sur quinze pompes inventerait une limite que le coach n'a pas
// donnee ; un chronometre sur un gainage de 45 s demanderait a l'enfant de
// surveiller un nombre au lieu de tenir sa position.
//
// AUCUNE PERSISTANCE. Un minuteur ne survit ni au changement d'ecran ni au
// rechargement, et c'est voulu : le PRD §5 garde le telephone pour ce qui
// compte, et rien ne serait plus deroutant qu'un rebours qui reprend a 12 s
// deux jours plus tard.

// LA DUREE ECRITE DANS LE LIBELLE GAGNE SUR LA MESURE, et c'est la lecon d'un
// defaut signale : « 45 s de chaise contre un mur » porte `unite: autre,
// valeur: 0` — le programme ne compte cet exercice dans aucun total — et
// recevait donc un chronometre qui monte, alors que son libelle prescrit
// quarante-cinq secondes en toutes lettres.
//
// La mesure sert les TOTAUX (le volume accompli, le classement) ; le libelle
// sert l'ENFANT. Quand les deux different, c'est le second qui a raison, parce
// que c'est celui qu'il lit :
//
//   « 30 s de gainage de chaque cote »  mesure 60 s — les deux cotes ensemble —
//                                       mais on tient 30 s, puis on change ;
//   « 6 × 2 minutes rapides »           mesure 17 min de seance, mais on lance
//                                       un rebours de 2 minutes, six fois ;
//   « 2 series de 8 × (30 s rapides… )» mesure 19 min, mais l'intervalle est 30 s.
//
// On prend la PREMIERE duree ecrite : c'est l'effort, jamais la recuperation
// qui le suit ni le total qui l'englobe.
//
// Le motif exige une unite de temps explicite — `s`, `sec`, `min`, `mn`,
// `minute(s)` — et rien d'autre ne compte : ni le metre de « 6 × 100 m », ni
// celui de « 30-30 m a 80 % ».
//
// LA FIN DE L'UNITE SE GARDE AVEC UN LOOKAHEAD UNICODE, jamais avec `\b`. En
// JavaScript, `\b` ignore les accents : « 2 series » se lit alors « 2 s » suivi
// d'une frontiere de mot devant le « é », et « 2 series de 8 × (30 s rapides) »
// prescrivait deux secondes. Constate a l'essai, et invisible autrement.
const DUREE_ECRITE = /(\d+)(?:\s*[àa]\s*\d+)?\s*(?:(min|mn|minutes?)(?:\s+(\d{1,2})(?![\p{L}\p{N}]))?|(s|sec|secondes?))(?![\p{L}\p{N}])/iu;

export function dureeEcrite(libelle) {
  const trouve = DUREE_ECRITE.exec(String(libelle ?? ''));
  if (trouve === null) return null;
  // Le nombre retenu d'une FOURCHETTE est le premier : « 30 a 40 minutes » vaut
  // trente. Un rebours est une cible a atteindre, et la borne haute d'une
  // fourchette en ferait une cible qu'on rate de justesse en ayant fait ce
  // qu'on demandait.
  const [, nombre, , appoint, secondes] = trouve;
  const valeur = Number(nombre);
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  if (secondes !== undefined) return Math.round(valeur);
  // « 1 min 30 » : l'appoint se lit en secondes, comme sur un chronometre.
  return Math.round(valeur * 60 + (appoint === undefined ? 0 : Number(appoint)));
}

// La duree d'un exercice, en secondes, ou null s'il n'en a pas : ce que le
// libelle ecrit d'abord, ce que la mesure prescrit ensuite.
export function secondesDe(ex) {
  return dureeEcrite(ex?.libelle) ?? secondesPrescrites(ex?.mesure);
}

// La duree prescrite par la MESURE, en secondes, ou null. Les deux seules
// unites de temps du programme (`web/programme.json`) : le gainage se mesure en
// secondes, la course en minutes.
export function secondesPrescrites(mesure) {
  if (mesure === null || typeof mesure !== 'object') return null;
  const valeur = Number(mesure.valeur);
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  if (mesure.unite === 'gainage_s') return Math.round(valeur);
  if (mesure.unite === 'min_course') return Math.round(valeur * 60);
  return null;
}

// « 0:45 », « 12:30 », « 1:05:00 ». Les minutes et les secondes prennent deux
// chiffres des qu'une unite plus grande les precede, comme sur une horloge ;
// la premiere n'en prend qu'un, « 05:00 » se lisant mal pour cinq minutes.
export function formaterChrono(secondes) {
  const s = Math.max(0, Math.round(secondes));
  const heures = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const reste = s % 60;
  const deux = (n) => String(n).padStart(2, '0');
  if (heures > 0) return `${heures}:${deux(minutes)}:${deux(reste)}`;
  return `${minutes}:${deux(reste)}`;
}

// --- la machine a etats -----------------------------------------------------
//
// Un etat est un objet PLAT et immuable ; chaque transition en rend un nouveau.
// `depuis` est l'instant du dernier demarrage, en millisecondes, et `acquis` le
// temps deja ecoule avant lui : le temps courant se CALCULE, il ne s'incremente
// pas a chaque battement. C'est ce qui rend le minuteur juste quand le
// telephone met l'onglet en veille et cesse d'appeler les battements.

export function creerChrono(secondes) {
  return {
    prescrit: secondes,
    mode: secondes === null ? 'chrono' : 'rebours',
    depuis: null, // instant du demarrage, ou null a l'arret
    acquis: 0, // millisecondes ecoulees avant le demarrage courant
  };
}

// Le temps ecoule depuis le debut, en millisecondes.
function ecoule(etat, t) {
  return etat.depuis === null ? etat.acquis : etat.acquis + (t - etat.depuis);
}

// Ce que l'ecran affiche, et rien de plus. `restant` est la valeur montree :
// elle descend en rebours, elle monte en chronometre.
export function lireChrono(etat, t) {
  const ms = ecoule(etat, t);
  if (etat.mode === 'rebours') {
    const restant = Math.max(0, etat.prescrit - ms / 1000);
    const fini = restant <= 0;
    return {
      secondes: restant,
      fini,
      // UN REBOURS FINI N'EST PLUS ACTIF, meme si rien ne l'a arrete : sans
      // cela il continuerait a battre pour afficher zero indefiniment.
      actif: etat.depuis !== null && !fini,
      demarre: etat.depuis !== null || etat.acquis > 0,
    };
  }
  return {
    secondes: ms / 1000,
    fini: false,
    actif: etat.depuis !== null,
    demarre: etat.depuis !== null || etat.acquis > 0,
  };
}

// Le geste unique : demarrer, mettre en pause, reprendre. Un rebours arrive a
// zero ne repart pas — il faut le remettre, sinon un tap distrait relancerait
// quarante-cinq secondes de gainage a la place d'un arret.
export function basculerChrono(etat, t) {
  const vu = lireChrono(etat, t);
  if (etat.mode === 'rebours' && vu.fini) return { ...etat, depuis: null, acquis: etat.prescrit * 1000 };
  if (etat.depuis === null) return { ...etat, depuis: t };
  return { ...etat, depuis: null, acquis: ecoule(etat, t) };
}

export function remettreChrono(etat) {
  return { ...etat, depuis: null, acquis: 0 };
}

// Fige un etat courant : utilise quand un AUTRE minuteur demarre. Un seul
// minuteur tourne a la fois — deux rebours concurrents sur un telephone tenu a
// bout de bras ne se lisent pas, et le second serait toujours celui qu'on
// regarde.
export function figerChrono(etat, t) {
  return etat.depuis === null ? etat : { ...etat, depuis: null, acquis: ecoule(etat, t) };
}

// --- le montage -------------------------------------------------------------

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Le chef d'orchestre : il garde le minuteur qui tourne pour figer celui-la
// quand un autre demarre. Un objet cree par l'ecran et passe a chaque minuteur,
// et non une variable de module : deux ecrans montes en meme temps — ce que les
// tests font — ne doivent pas se marcher dessus.
export function creerOrchestre() {
  let courant = null;
  return {
    prendreLaMain(qui) {
      if (courant !== null && courant !== qui) courant.figer();
      courant = qui;
    },
    rendreLaMain(qui) {
      if (courant === qui) courant = null;
    },
  };
}

const LIBELLE_DEPART = { rebours: 'Démarrer le compte à rebours', chrono: 'Démarrer le chronomètre' };
export const TEXTE_FINI = 'Terminé';

// Monte le minuteur d'UN exercice et rend son demontage. `options` n'existe que
// pour les tests : horloge, battement et vibration s'injectent.
export function monterChrono(hote, ex, options = {}) {
  const secondes = secondesDe(ex);
  const orchestre = options.orchestre ?? creerOrchestre();
  const maintenant = options.maintenant ?? (() => Date.now());
  const poser = options.poser ?? ((rappel, ms) => setInterval(rappel, ms));
  const annuler = options.annuler ?? ((id) => clearInterval(id));
  // Une pulsation a l'arrivee, jamais un son : le PRD §11 veut une app qu'on
  // ouvre au gymnase, et un bip surprendrait tout le monde sauf celui qui
  // regarde son ecran. L'API n'existe pas partout, d'ou le garde.
  const vibrer = options.vibrer
    ?? (() => { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(200); });

  let etat = creerChrono(secondes);
  let battement = null;

  const bouton = el('button', 'chrono');
  bouton.type = 'button';
  const remise = el('button', 'chrono-remise', '↺');
  remise.type = 'button';
  // MASQUE, MAIS PAS RETIRE. `hidden` rendrait la ligne plus etroite tant que le
  // minuteur dort, et son apparition au premier tap decalerait le libelle — sur
  // « 45 s de gainage ventral », cela suffit a le faire passer de deux lignes a
  // trois sous le pouce qui vient d'appuyer. `visibility` reserve la place et
  // retire tout de meme le bouton de l'ordre de tabulation.
  remise.classList.add('chrono-remise-dort');
  remise.setAttribute('aria-label', 'Remettre le minuteur à zéro');

  const groupe = el('div', 'chrono-groupe');
  groupe.append(bouton, remise);

  function battre() {
    if (battement !== null) return;
    battement = poser(dessiner, 250);
  }
  function cesser() {
    if (battement === null) return;
    annuler(battement);
    battement = null;
  }

  let etaitFini = false;

  function dessiner() {
    const t = maintenant();
    const vu = lireChrono(etat, t);

    bouton.textContent = vu.fini ? TEXTE_FINI : formaterChrono(vu.secondes);
    bouton.classList.toggle('chrono-actif', vu.actif);
    bouton.classList.toggle('chrono-fini', vu.fini);
    remise.classList.toggle('chrono-remise-dort', !vu.demarre);
    bouton.setAttribute(
      'aria-label',
      vu.demarre ? `${bouton.textContent} — appuie pour mettre en pause ou reprendre` : LIBELLE_DEPART[etat.mode],
    );

    if (vu.fini && !etaitFini) {
      etaitFini = true;
      vibrer();
      orchestre.rendreLaMain(moi);
    }
    if (!vu.fini) etaitFini = false;

    if (vu.actif) battre(); else cesser();
  }

  const moi = {
    figer() {
      etat = figerChrono(etat, maintenant());
      dessiner();
    },
  };

  bouton.addEventListener('click', () => {
    etat = basculerChrono(etat, maintenant());
    if (lireChrono(etat, maintenant()).actif) orchestre.prendreLaMain(moi);
    else orchestre.rendreLaMain(moi);
    dessiner();
  });

  remise.addEventListener('click', () => {
    etat = remettreChrono(etat);
    orchestre.rendreLaMain(moi);
    etaitFini = false;
    dessiner();
  });

  dessiner();
  hote.append(groupe);

  // Le demontage n'est pas decoratif : sans lui, un battement continue de
  // tourner sur un ecran qui n'existe plus, et le suivant en pose un second.
  return function demonter() {
    cesser();
    orchestre.rendreLaMain(moi);
  };
}
