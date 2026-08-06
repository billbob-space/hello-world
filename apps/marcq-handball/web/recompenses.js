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
import { lireFaits } from './etat.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { EVT_SEANCE_COMPLETE } from './vue-seance.js';

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

// --- le panneau de fin de seance --------------------------------------------

// Deux phrases, exportees pour etre epinglees par un test. On annonce un fait,
// on ne commente pas une performance : a 13 ans un chiffre juste vaut mieux
// qu'un compliment, parce que le chiffre est vrai (PRD §10).
export const TITRE_FIN = 'Séance bouclée.';
export const TEXTE_FERMETURE = 'Continuer';

// Six lignes recopiees de vue-seance.js plutot qu'un export ajoute la-bas :
// faire dependre ce module des rouages internes d'une vue coute plus cher que
// six lignes, et `textContent` — jamais du HTML compose — est ce qui rend un
// libelle de programme.json inoffensif.
function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Ouvre le panneau et rend la fonction qui le ferme. Toutes les valeurs sont
// calculees avant le premier append : le panneau n'a aucune decision a prendre
// une fois affiche.
function ouvrirPanneauDeFin(prog, faits, dateISO) {
  const avant = resumeDeFin(prog, faitsSansSeance(prog, faits, dateISO));
  const apres = resumeDeFin(prog, faits);
  // Lu une seule fois par panneau : matchMedia force un calcul de style, et
  // l'appeler par compteur le referait quatre fois pour la meme reponse.
  const reduit = mouvementReduit();

  const panneau = el('dialog', 'panneau-fin');
  const carte = el('div', 'carte-fin');

  carte.append(
    el('p', 'fin-date', `Séance du ${dateEnToutesLettres(dateISO)}`),
    el('h2', 'fin-titre', TITRE_FIN),
  );

  // Le compteur de seances arrive a sa valeur, en grand. Il augmente de un : le
  // faire rouler ferait attendre un nombre que l'enfant connait deja. Le mot est
  // un noeud separe et fige au pluriel final, sinon il changerait en cours de
  // route.
  const ligneSeances = el('p', 'fin-seances');
  ligneSeances.append(
    el('span', 'fin-nombre-seances', String(apres.seances)),
    document.createTextNode(
      apres.seances > 1
        ? ` séances sur ${apres.seancesTotal}`
        : ` séance sur ${apres.seancesTotal}`,
    ),
  );
  carte.append(ligneSeances);

  const roulements = [];
  if (apres.compteurs.length > 0) {
    const liste = el('ul', 'fin-volume');
    for (const compteur of apres.compteurs) {
      const depart = avant.compteurs.find((c) => c.cle === compteur.cle)?.valeur ?? 0;
      const item = el('li', 'fin-ligne');
      const nombre = el('span', 'fin-nombre');
      item.append(nombre, document.createTextNode(` ${compteur.libelle}`));
      liste.append(item);
      roulements.push(rouler(nombre, depart, compteur.valeur, { reduit }));
    }
    carte.append(liste);
  }

  const bouton = el('button', 'bouton bouton-principal fin-fermer', TEXTE_FERMETURE);
  bouton.type = 'button';
  carte.append(bouton);

  panneau.append(carte);
  document.body.append(panneau);
  lancerConfettis(panneau, { reduit });

  function fermer() {
    // Poser la valeur finale avant de retirer : un roulement interrompu laisse
    // un nombre faux, et le panneau peut etre rouvert.
    for (const arreter of roulements) arreter();
    panneau.remove();
  }

  bouton.addEventListener('click', () => panneau.close());
  // Un tap hors de la carte ferme aussi : la cible est le <dialog> lui-meme,
  // jamais un de ses descendants.
  panneau.addEventListener('click', (evenement) => {
    if (evenement.target === panneau) panneau.close();
  });
  // `close` couvre les trois sorties d'un coup — le bouton, le fond, et la
  // touche Echap que showModal branche pour nous.
  panneau.addEventListener('close', fermer);

  panneau.showModal();

  return () => {
    if (panneau.open) panneau.close();
    else fermer();
  };
}

// Le seul point d'entree. Appele une fois par app.js, apres le premier rendu.
// Rend un `debrancher()` : c'est ce que le contrat d'ecran du PRP 03 appelle
// « ce qui deborde de hote ».
export function brancherRecompenses(prog, options = {}) {
  const { racine = globalThis.document, fenetre = globalThis, lire = lireFaits } = options;

  let fermerPanneau = null;

  function surSeanceComplete(evenement) {
    if (fermerPanneau !== null) fermerPanneau();
    // `lire()` et non le detail de l'evenement : les faits font foi, et ce sont
    // ceux que etat.js vient de relire depuis le stockage (PRP 04).
    fermerPanneau = ouvrirPanneauDeFin(prog, lire(), evenement.detail.date);
  }

  // Changer d'ecran ferme le panneau. Sans cela il survivrait au routeur, qui ne
  // vide que #ecran — et resterait modal sur un ecran qui n'a rien a voir.
  function surNavigation() {
    if (fermerPanneau === null) return;
    fermerPanneau();
    fermerPanneau = null;
  }

  racine.addEventListener(EVT_SEANCE_COMPLETE, surSeanceComplete);
  fenetre.addEventListener('hashchange', surNavigation);

  return function debrancher() {
    racine.removeEventListener(EVT_SEANCE_COMPLETE, surSeanceComplete);
    fenetre.removeEventListener('hashchange', surNavigation);
    surNavigation();
  };
}

// --- les confettis ----------------------------------------------------------

// Assez pour que ca fasse quelque chose, assez peu pour qu'un telephone d'entree
// de gamme les anime sans effort : ce sont vingt-quatre elements qui ne changent
// que par transform et opacity, donc composes par le processeur graphique.
export const NOMBRE_CONFETTIS = 24;

// Pose la couche de confettis dans `hote` et la rend. Rend `null` en mouvement
// reduit, sans rien creer : le CSS suffirait a les figer, mais figer vingt-quatre
// elements est encore du travail demande a un telephone pour rien.
//
// `hote` est le <dialog> : ouvert par showModal(), il est en couche superieure,
// et une couche posee ailleurs passerait sous le fond assombri quel que soit son
// z-index. Elle meurt donc avec le panneau — aucune minuterie, aucune fuite.
export function lancerConfettis(hote, options = {}) {
  const {
    nombre = NOMBRE_CONFETTIS,
    alea = Math.random,
    reduit = mouvementReduit(),
    doc = globalThis.document,
  } = options;

  if (reduit) return null;

  const couche = doc.createElement('div');
  couche.className = 'confettis';
  couche.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < nombre; i += 1) {
    const grain = doc.createElement('i');
    grain.className = 'confetti';
    grain.style.setProperty('--x', `${Math.round(alea() * 100)}%`);
    grain.style.setProperty('--derive', `${Math.round(alea() * 160) - 80}px`);
    grain.style.setProperty('--tour', `${Math.round(alea() * 720) - 360}deg`);
    grain.style.setProperty('--retard', `${Math.round(alea() * 260)}ms`);
    grain.style.setProperty('--duree', `${900 + Math.round(alea() * 500)}ms`);
    grain.style.setProperty('--couleur', `var(--marcq-confetti-${1 + Math.floor(alea() * 4)})`);
    couche.append(grain);
  }

  hote.append(couche);
  return couche;
}
