// app.js — l'amorcage, le jour courant, et le routeur des ecrans.
//
// Trois decisions vivent ici et nulle part ailleurs : quel jour on est, quel
// ecran est monte, et ce que les ecrans lisent. Une vue ne calcule jamais la
// date et n'en monte jamais une autre.

import { chargerProgramme } from './domaine.js';
import { lireFaits, lirePrenom } from './etat.js';
import { monterJour } from './vue-jour.js';
import { monterPrenom } from './vue-prenom.js';
import { monterReglages } from './vue-reglages.js';
import { MOTIF_SEANCE, monterSeance } from './vue-seance.js';
import { monterPerso } from './vue-perso.js';
import { monterRejoindre } from './vue-rejoindre.js';
import { monterClassement } from './vue-classement.js';
import { brancherSynchronisation } from './classement.js';
import { MOTIF_COACH, monterCoach } from './vue-coach.js';
import { MOTIF_BILAN, MOTIF_RACINE, bascule, monterBilan } from './vue-bilan.js';
import { brancherRecompenses } from './recompenses.js';

// Le jour courant, en Europe/Paris. 'fr-CA' rend YYYY-MM-DD, le format que le
// domaine compare comme des chaines. Le fuseau est fige : un enfant en vacances
// a l'etranger doit voir la seance du jour de son club, pas celle de son fuseau
// (ossature §5).
export const aujourdhui = () =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Le tableau des ecrans. Ajouter un ecran, c'est ajouter un import et une ligne
// ici : le PRP 04 y pose `#/seance/<date>`, le 05 `#/perso`, le 11 `#/bilan`.
// L'ordre compte — le premier motif qui correspond gagne, et celui du jour
// accepte l'adresse sans ancre.
export const ECRANS = [
  { nom: 'reglages', motif: /^#\/reglages$/, monter: monterReglages },
  { nom: 'seance', motif: MOTIF_SEANCE, monter: monterSeance },
  { nom: 'perso', motif: /^#\/perso$/, monter: monterPerso },
  { nom: 'equipe', motif: /^#\/equipe$/, monter: monterClassement },
  { nom: 'rejoindre', motif: /^#\/rejoindre$/, monter: monterRejoindre },
  // `sansPrenom` est l'exception minimale au verrou d'entree ci-dessous. Le
  // coach n'a pas de prenom a saisir et n'en aura jamais : sans elle, il
  // tomberait sur l'ecran de premier lancement d'un enfant. Elle est portee par
  // une DONNEE de l'entree d'ecran, pas par une comparaison de chaine dans le
  // routeur : le jour ou un second ecran la merite, il pose son drapeau.
  // Elle reste sure parce que monterCoach ne lit rien du stockage local, et
  // tests/coach.test.js interdit a ce fichier d'importer etat.js.
  { nom: 'coach', motif: MOTIF_COACH, monter: monterCoach, sansPrenom: true },
  { nom: 'bilan', motif: MOTIF_BILAN, monter: monterBilan },
  // Le motif de la racine vient de vue-bilan.js : la bascule doit capturer
  // EXACTEMENT ce que cette entree capture, et deux copies divergeraient.
  { nom: 'jour', motif: MOTIF_RACINE, monter: monterJour },
];

// Les onglets. Meme regle : un ecran pose son lien ici, jamais avant d'exister —
// un lien mort coute plus cher qu'un lien absent. Le PRP 05 ajoutera « Ma
// progression ».
//
// Exporte, comme `ECRANS` : les PRP 08, 10 et 11 verifient depuis leur fichier
// de test qu'aucun onglet ne pointe vers un ecran qu'ils n'ont pas encore pose.
// Un `import { LIENS }` sur un symbole non exporte ferait echouer le chargement
// du module de test entier, pas une assertion.
//
// « Ma progression » est le second niveau de lecture du PRD §7.5 : il vient
// juste apres ce qu'il y a a faire aujourd'hui. La seance, elle, n'a pas
// d'onglet — un onglet n'a pas de date.
export const LIENS = [
  { href: '#/', texte: 'Aujourd’hui' },
  { href: '#/perso', texte: 'Ma progression' },
  // « L'equipe » a son onglet depuis que la comparaison a quitte le bas de « Ma
  // progression » : elle y etait derriere un calendrier a derouler, donc
  // introuvable. L'onglet mene a l'ecran de LECTURE, jamais au consentement —
  // celui-ci reste derriere un bouton, « au moment ou il y a un vrai choix a
  // faire » (PRD §7.4), et un test le verifie.
  { href: '#/equipe', texte: 'L’équipe' },
  { href: '#/reglages', texte: 'Réglages' },
];

// Rend l'entree d'ecran d'une route, ou null si la route est inconnue. Pure :
// c'est elle que `node --test` interroge, sans navigateur.
export function choisirEcran(route) {
  return ECRANS.find((ecran) => ecran.motif.test(route)) ?? null;
}

let demonterCourant = null;

function routeCourante() {
  return location.hash === '' ? '#/' : location.hash;
}

function commeDemontage(valeur) {
  return typeof valeur === 'function' ? valeur : null;
}

// Le seul point de montage de l'application. Il tranche deux questions : le
// prenom manque-t-il, et quelle route est demandee.
function rendre(hote, ctx) {
  if (typeof demonterCourant === 'function') demonterCourant();
  demonterCourant = null;
  hote.replaceChildren();

  // Le contexte est relu a chaque rendu : un ecran voit l'etat du telephone,
  // jamais un instantane vieux d'un ecran.
  ctx.prenom = lirePrenom();
  ctx.faits = lireFaits();
  ctx.route = routeCourante();
  rendreNavigation(ctx);

  // PRD §9 : passe prog.fin, la racine mene au bilan. Une app qui reste bloquee
  // sur un programme termine meurt en silence le 22. `replaceState` n'empile pas
  // d'entree — sinon le bouton retour rejouerait la racine, qui rebasculerait
  // aussitot — et ne declenche pas `hashchange`, d'ou l'appel direct. La
  // recursion se termine : `bascule` rend null sur '#/bilan'.
  const versLeBilan = bascule(ctx.prog, ctx.aujourdhui, ctx.route);
  if (versLeBilan !== null) {
    history.replaceState(null, '', versLeBilan);
    rendre(hote, ctx);
    return;
  }

  const ecran = choisirEcran(ctx.route);

  // Tant que le prenom manque, aucune route n'est honoree : un lien partage vers
  // `#/reglages` ne doit pas court-circuiter l'accueil (PRD §7.1). Seuls les
  // ecrans marques `sansPrenom` traversent — aujourd'hui la page du coach, et
  // elle seule.
  if (ctx.prenom === null && ecran?.sansPrenom !== true) {
    demonterCourant = commeDemontage(monterPrenom(hote, ctx));
    return;
  }

  if (ecran === null) {
    // Une route inconnue ne laisse jamais un ecran vide. On reecrit l'adresse
    // sans empiler d'entree — sinon le bouton retour du telephone rejouerait la
    // route morte. `replaceState` ne declenche pas `hashchange`, d'ou l'appel
    // direct ; il se termine, `#/` correspondant toujours a un ecran.
    history.replaceState(null, '', '#/');
    rendre(hote, ctx);
    return;
  }

  demonterCourant = commeDemontage(ecran.monter(hote, ctx));
}

function rendreNavigation(ctx) {
  const nav = document.getElementById('nav');
  nav.hidden = ctx.prenom === null;
  nav.replaceChildren();
  if (nav.hidden) return;

  for (const lien of LIENS) {
    const onglet = document.createElement('a');
    onglet.className = 'lien-nav';
    onglet.href = lien.href;
    onglet.textContent = lien.texte;
    if (lien.href === ctx.route) onglet.setAttribute('aria-current', 'page');
    nav.append(onglet);
  }
}

function creerContexte(prog, hote) {
  const ctx = {
    prog,
    aujourdhui: aujourdhui(),
    prenom: null,
    faits: {},
    route: '#/',
    aller(destination) {
      // Ecrire un hash identique a l'actuel ne declenche pas `hashchange` : on
      // remonte alors a la main, sinon le geste resterait sans effet.
      if (routeCourante() === destination) rendre(hote, ctx);
      else location.hash = destination;
    },
    rafraichir() { rendre(hote, ctx); },
  };
  return ctx;
}

async function chargerLeProgramme(hote) {
  try {
    const reponse = await fetch('/programme.json', { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return chargerProgramme(await reponse.json());
  } catch (err) {
    console.error('marcq : programme illisible', err);
    const message = document.createElement('p');
    message.className = 'panne';
    message.textContent =
      'Le programme n’a pas pu être chargé. Reconnecte-toi une fois : il sera ensuite disponible hors ligne.';
    hote.replaceChildren(message);
    return null;
  }
}

// L'enregistrement du service worker vient apres le premier rendu : il n'est pas
// sur le chemin de l'affichage, et l'objectif du PRD §4 se joue sur la premiere
// seconde. Un echec ne casse rien — l'app marche en ligne.
function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('marcq : service worker non enregistre', err);
  });
}

async function demarrer() {
  const hote = document.getElementById('ecran');
  const prog = await chargerLeProgramme(hote);
  if (prog === null) return;

  const ctx = creerContexte(prog, hote);
  window.addEventListener('hashchange', () => rendre(hote, ctx));
  rendre(hote, ctx);
  // Apres le premier rendu, pour la meme raison que le service worker :
  // l'objectif du PRD §4 se joue sur la premiere seconde, et rien de decoratif
  // n'a sa place sur le chemin de l'affichage. Le debrancher() rendu n'est pas
  // conserve : la page vit aussi longtemps que l'application.
  brancherRecompenses(prog);
  enregistrerServiceWorker();
  // Le reseau vient en dernier, apres le premier rendu et apres le service
  // worker : il ne doit pas concourir avec l'affichage, et l'objectif du PRD §4
  // se joue sur la premiere seconde. Le debrancher() rendu n'est pas conserve,
  // pour la meme raison que celui des recompenses.
  brancherSynchronisation(ctx);
}

// L'amorcage ne se declenche que dans un navigateur. Sans ce garde, `node --test`
// executerait `demarrer()` au seul import du module et le routeur ne serait pas
// testable.
if (typeof document !== 'undefined') {
  demarrer().catch((err) => console.error('marcq : demarrage impossible', err));
}
