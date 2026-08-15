// app.js — le routeur et la coque (PRP 02 chantier D). Il ne connait que le
// contrat d'ecran de l'ossature §6 : toute vue exporte
// `monterX(hote, contexte) -> demonter()`.

import { lireEtat, ETAT_VIDE } from './etat.js';
import { monterEntree } from './vue-entree.js';
import { monterJour } from './vue-jour.js';
import { monterSeance } from './vue-seance.js';
import { monterGrille } from './vue-grille.js';
import { monterDetailSeance } from './vue-detail-seance.js';
import { monterReglages } from './vue-reglages.js';
import { monterListe } from './vue-liste.js';
import * as synchro from './synchro.js';

// Les ecrans de l'application (PRD §6, puis A3 et A8 « Ajoute apres les
// PRP »). Une route hors de cette liste — et hors de ses sous-routes, par
// exemple « #/seance/2026-08-14 » — n'est jamais honoree : elle retombe sur
// « #/jour ». « #/grille/seance » doit precéder « #/grille » : `routeDeBase`
// prend le PREMIER motif qui correspond, et « #/grille/seance/3/2 » commence
// aussi par « #/grille/ ».
export const ROUTES = ['#/jour', '#/seance', '#/grille/seance', '#/grille', '#/reglages', '#/liste'];

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
//
// `surCompteCree` et `reprendreCompte` sont les DEUX POINTS D'ACCROCHE que
// vue-entree.js documente (PRP 03) : c'est ici, et nulle part dans
// vue-entree.js, que le PRP 07 les raccorde a synchro.js.
export function contexte() {
  return {
    etat: lireEtat(),
    programme: programmeCharge,
    maintenant: () => new Date(),
    surCompteCree() {
      // Tentative fixe, sans bloquer la navigation : le compte est deja
      // ecrit localement (PRP 03), le reseau n'est jamais une dependance de
      // fonctionnement (PRD §11.2).
      synchro.creer(lireEtat(), {}).catch(() => {});
    },
    async reprendreCompte(pseudo, code) {
      // « Lire et fusionner » du PRD §10.4 : un appareil neuf apporte des
      // faits vides, et c'est bien une SYNCHRONISATION, pas une creation.
      const resultat = await synchro.synchroniser({ ...ETAT_VIDE, pseudo, code }, {});
      if (!resultat.ok) return { ok: false };
      return { ok: true, fiche: resultat.fiche };
    },
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

// PRD §5, A11 (« Ajouté après les PRP ») : l'ecran ne s'eteint pas pendant une
// seance, et SEULEMENT pendant une seance. L'interface Wake Lock manque sur
// plusieurs navigateurs — son absence ne doit rien casser (PRP 02 chantier D)
// : le PRP 04 l'appelle, il ne l'implemente pas ici.
//
// A11 corrige un defaut, pas seulement une demande : le navigateur relache ce
// verrou DE LUI-MEME des que la page passe en arriere-plan (message recu,
// bascule d'application, ecran eteint une seule fois) et rien ne le reprenait
// au retour — la promesse du §5 tenait a la premiere seconde d'une seance et
// plus ensuite. `verrouVoulu` porte l'etat VOULU (une seance en cours ET
// l'option des reglages activee), independant du verrou REEL (`verrouEcran`,
// qui peut disparaitre a tout moment sans prevenir autrement que par son
// propre evenement `release`) : un `visibilitychange` retente l'acquisition
// des que la page redevient visible tant que le premier est vrai et le
// second absent.
let verrouVoulu = false;
let verrouEcran = null;
let ecouteVisibiliteBranchee = false;

// A11 : « l'ecran dit ce qui est vrai » — vue-reglages.js s'en sert pour ne
// JAMAIS laisser croire que l'option marche sur un navigateur qui ne sait pas
// tenir l'ecran allume. Une promesse non tenue est pire que pas de promesse :
// elle fait poser le telephone loin, en confiance.
export function verrouEcranDisponible() {
  return typeof navigator !== 'undefined' && navigator !== null && 'wakeLock' in navigator;
}

function surRelachementVerrou() {
  // Le navigateur a repris le verrou lui-meme (arriere-plan, bascule
  // d'application, etc.) : on ne le redemande PAS ici — `surVisibilite()` le
  // fera au retour, le seul moment ou `navigator.wakeLock.request()` est de
  // nouveau autorise sur la plupart des navigateurs.
  verrouEcran = null;
}

async function acquerirVerrou() {
  if (!verrouEcranDisponible() || verrouEcran !== null) return;
  try {
    const v = await navigator.wakeLock.request('screen');
    if (!verrouVoulu) {
      // `garderEcranAllume(false)` est arrivee pendant la requete (sortie de
      // seance juste apres son lancement) : rien a tenir.
      Promise.resolve(v.release()).catch(() => {});
      return;
    }
    verrouEcran = v;
    if (typeof v.addEventListener === 'function') v.addEventListener('release', surRelachementVerrou);
  } catch (err) {
    console.warn('renaissance-gym : verrou d’écran indisponible', err);
  }
}

function surVisibilite() {
  if (verrouVoulu && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    acquerirVerrou().catch(() => {});
  }
}

export async function garderEcranAllume(actif) {
  verrouVoulu = Boolean(actif);

  if (verrouVoulu) {
    if (!ecouteVisibiliteBranchee && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', surVisibilite);
      ecouteVisibiliteBranchee = true;
    }
    await acquerirVerrou();
    return;
  }

  if (ecouteVisibiliteBranchee && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
    document.removeEventListener('visibilitychange', surVisibilite);
    ecouteVisibiliteBranchee = false;
  }
  if (verrouEcran !== null) {
    const v = verrouEcran;
    verrouEcran = null;
    if (typeof v.removeEventListener === 'function') v.removeEventListener('release', surRelachementVerrou);
    try {
      await v.release();
    } catch (err) {
      console.warn('renaissance-gym : relâchement du verrou d’écran refusé', err);
    }
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

// Les ecrans du produit (PRD §6, PRP 05, A8) : entree, jour, seance, grille,
// le detail d'une case (A3), reglages, la liste des 36 exercices — la table
// complete.
const TABLE = {
  [ROUTE_ENTREE]: monterEntree,
  '#/jour': monterJour,
  '#/seance': monterSeance,
  '#/grille/seance': monterDetailSeance,
  '#/grille': monterGrille,
  '#/reglages': monterReglages,
  '#/liste': monterListe,
};

async function demarrer() {
  const hote = document.getElementById('ecran');
  const prog = await chargerLeProgramme(hote);
  if (prog !== null) {
    definirProgramme(prog);
    // PRP 07 chantier B, declencheur 3 : « a l'ouverture de l'application »
    // — brancher() tente elle-meme un premier envoi, sans attendre un geste.
    synchro.brancher({ programme: prog, maintenant: () => new Date() });
  }
  router(hote, TABLE);
}

// L'amorcage ne se declenche que dans un navigateur : sans ce garde,
// `node --test` executerait `demarrer()` au seul import du module.
if (typeof document !== 'undefined') {
  demarrer().catch((err) => console.error('renaissance-gym : demarrage impossible', err));
}

// A12 : le service worker qui tient le hors-ligne pour de vrai (PRD §11.2).
// L'enregistrement seul n'installe rien d'invasif — aucune invite, aucune
// banniere : c'est le navigateur qui offre ensuite l'installation, jamais
// cette app qui la reclame. `serviceWorker` manque sur certains navigateurs
// (et sur tout environnement de test) : son absence ne doit rien casser.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('renaissance-gym : service worker indisponible', err);
    });
  });
}
