// app.js — le routeur et la coque (PRP 02 chantier D). Il ne connait que le
// contrat d'ecran de l'ossature §6 : toute vue exporte
// `monterX(hote, contexte) -> demonter()`.

import { lireEtat } from './etat.js';
import { monterEntree } from './vue-entree.js';
import { monterJour } from './vue-jour.js';
import { monterSeance } from './vue-seance.js';

// Les quatre ecrans du lot 1 (PRD §6). Une route hors de cette liste — et hors
// de ses sous-routes, par exemple « #/seance/2026-08-14 » — n'est jamais
// honoree : elle retombe sur « #/jour ».
export const ROUTES = ['#/jour', '#/seance', '#/grille', '#/reglages'];

// L'ecran d'entree n'appartient pas encore a ce PRP (PRP 03 le monte) : router
// s'y aiguille des qu'aucun prenom n'est enregistre, « quelle que soit la
// route demandee » (PRP 02 chantier D). Tant que la table qu'on lui passe ne
// porte pas cette entree, la page reste vide, correctement habillee — c'est le
// livrable de ce PRP.
export const ROUTE_ENTREE = '#/entree';

function normaliser(brute) {
  return brute === '' || brute === '#' || brute === '#/' ? '#/jour' : brute;
}

function correspondAUneRoute(route) {
  return ROUTES.some((motif) => route === motif || route.startsWith(`${motif}/`));
}

// La route DE BASE d'une sous-route : « #/seance/3 » -> « #/seance ». C'est
// elle qui sert de cle dans `table`, jamais la route brute — sans quoi aucune
// sous-route (l'exemple « #/seance/2026-08-14 » cite plus haut) ne
// trouverait jamais son monteur, quelle que soit la table passee a
// `router()`. Une route qui ne correspond a aucun motif (ex. ROUTE_ENTREE,
// hors de `ROUTES`) se rend elle-meme.
function routeDeBase(route) {
  return ROUTES.find((motif) => route === motif || route.startsWith(`${motif}/`)) ?? route;
}

let programmeCharge = null;

// { etat, programme, maintenant() } — jamais Date.now() en dur dans une vue :
// c'est ce qui permet aux tests de vues de faire avancer le temps sans figer
// l'horloge globale (ossature §6, PRP 02 chantier D).
export function contexte() {
  return {
    etat: lireEtat(),
    programme: programmeCharge,
    maintenant: () => new Date(),
  };
}

// Reserve a demarrer() : la seule facon dont ce module apprend le programme.
// Une vue ne l'appelle jamais — elle lit `contexte().programme`.
function definirProgramme(prog) {
  programmeCharge = prog;
}

// Le routeur generique. `table` associe une route exacte (ou son prefixe pour
// une sous-route) a une fonction `monter(hote, contexte) -> demonter()|void` :
// c'est le seul contrat que ce module connaisse (ossature §6). Rend
// `arreter()`, qui defait l'ecoute et demonte l'ecran courant.
export function router(hote, table) {
  let demonterCourant = null;

  function commeDemontage(valeur) {
    return typeof valeur === 'function' ? valeur : null;
  }

  function rendre() {
    if (typeof demonterCourant === 'function') demonterCourant();
    demonterCourant = null;
    hote.replaceChildren();

    const ctx = contexte();
    let route = normaliser(location.hash);

    // Une visite sans prenom enregistre redirige vers l'entree, quelle que
    // soit la route demandee (PRP 02 chantier D) — l'aiguillage seul est de ce
    // lot, l'ecran d'entree est celui du PRP 03.
    if (ctx.etat.prenom === null) {
      route = ROUTE_ENTREE;
    } else if (!correspondAUneRoute(route) && route !== ROUTE_ENTREE) {
      route = '#/jour';
    }

    const monter = table[routeDeBase(route)];
    if (typeof monter === 'function') {
      demonterCourant = commeDemontage(monter(hote, ctx));
    }
  }

  window.addEventListener('hashchange', rendre);
  rendre();

  return function arreter() {
    window.removeEventListener('hashchange', rendre);
    if (typeof demonterCourant === 'function') demonterCourant();
    demonterCourant = null;
  };
}

// PRD §5 : l'ecran ne s'eteint pas pendant une seance, et seulement pendant
// une seance. L'interface Wake Lock manque sur plusieurs navigateurs — son
// absence ne doit rien casser (PRP 02 chantier D) : le PRP 04 l'appelle, il ne
// l'implemente pas ici.
let verrouEcran = null;

export async function garderEcranAllume(actif) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (actif) {
      if (verrouEcran === null) verrouEcran = await navigator.wakeLock.request('screen');
    } else if (verrouEcran !== null) {
      const v = verrouEcran;
      verrouEcran = null;
      await v.release();
    }
  } catch (err) {
    console.warn('renaissance-gym : verrou d’écran indisponible', err);
  }
}

async function chargerLeProgramme(hote) {
  try {
    const reponse = await fetch('/programme.json', { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const { chargerProgramme } = await import('./programme.js');
    return chargerProgramme(await reponse.json());
  } catch (err) {
    console.error('renaissance-gym : programme illisible', err);
    const message = document.createElement('p');
    message.textContent = 'Le programme n’a pas pu être chargé. Reconnecte-toi une fois : il sera ensuite disponible hors ligne.';
    hote.replaceChildren(message);
    return null;
  }
}

// PRP 03 et 04 : l'entree, l'ecran du jour et la seance. Les routes du lot 3
// (grille, reglages) restent a la charge des PRP suivants, qui completent
// cette table sans toucher a la mecanique du routeur ci-dessus.
const TABLE = {
  [ROUTE_ENTREE]: monterEntree,
  '#/jour': monterJour,
  '#/seance': monterSeance,
};

async function demarrer() {
  const hote = document.getElementById('ecran');
  const prog = await chargerLeProgramme(hote);
  if (prog !== null) definirProgramme(prog);
  router(hote, TABLE);
}

// L'amorcage ne se declenche que dans un navigateur : sans ce garde,
// `node --test` executerait `demarrer()` au seul import du module.
if (typeof document !== 'undefined') {
  demarrer().catch((err) => console.error('renaissance-gym : demarrage impossible', err));
}
