// etat.js — tout ce qui persiste sur le telephone, et rien d'autre.
//
// Le serveur ne connait aucun utilisateur (PRD §5) : le prenom et la
// progression vivent ici, sous des cles prefixees `marcq.v1.` (ossature §6). Le
// numero de version est dans la cle, pas dans la valeur : changer de schema
// s'ecrit en `v2` et se migre depuis `v1`, sans jamais lire une valeur au
// mauvais format.

export const CLE_PRENOM = 'marcq.v1.prenom';
export const CLE_FAITS = 'marcq.v1.faits';
export const CLE_CLASSEMENT = 'marcq.v1.classement';
export const CLE_RESSENTI = 'marcq.v1.ressenti';
export const CLE_SONNERIE = 'marcq.v1.sonnerie';
export const PREFIXE_CLES = 'marcq.';

const PRENOM_MAX = 24;

// Le magasin est relu a chaque appel, jamais capture a l'import : sur certains
// navigateurs en navigation privee, l'acces a la propriete leve au lieu de
// rendre un objet, et un module qui l'aurait capture au chargement serait mort
// avant d'avoir servi.
function magasin() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Ce qui n'a pas pu etre ecrit dans le stockage est garde ici, le temps de
// l'onglet, et relu en priorite. C'est ce qui evite le pire defaut possible :
// un prenom qui ne s'enregistre pas, donc un ecran d'accueil qui le redemande a
// chaque rendu. Une fois l'ecriture reussie pour de bon, l'entree disparait —
// le repli n'est jamais un second etat durable.
const memoire = new Map();

function lireCle(cle) {
  if (memoire.has(cle)) return memoire.get(cle);
  const m = magasin();
  if (m === null) return null;
  try {
    return m.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireCle(cle, valeur) {
  memoire.set(cle, valeur);
  const m = magasin();
  if (m === null) return false;
  try {
    m.setItem(cle, valeur);
    memoire.delete(cle);
    return true;
  } catch (err) {
    console.warn(`marcq : ecriture de ${cle} refusee, valeur gardee en memoire`, err);
    return false;
  }
}

function effacerCle(cle) {
  memoire.delete(cle);
  const m = magasin();
  if (m === null) return false;
  try {
    m.removeItem(cle);
    return true;
  } catch (err) {
    console.warn(`marcq : suppression de ${cle} refusee`, err);
    return false;
  }
}

const estCleMarcq = (cle) => typeof cle === 'string' && cle.startsWith(PREFIXE_CLES);

// --- le prenom ------------------------------------------------------------

// Espaces de bord retires, espaces internes reduits a un, et 24 caracteres au
// plus. Un prenom colle depuis une suggestion de clavier arrive souvent avec un
// saut de ligne ; il ne doit pas s'afficher sur deux lignes.
function normaliserPrenom(brut) {
  return brut.replace(/\s+/g, ' ').trim().slice(0, PRENOM_MAX).trimEnd();
}

export function lirePrenom() {
  const brut = lireCle(CLE_PRENOM);
  if (typeof brut !== 'string') return null;
  const propre = normaliserPrenom(brut);
  return propre === '' ? null : propre;
}

// Rend le prenom effectivement enregistre, ou null si l'entree est vide une fois
// nettoyee. On tronque plutot que de refuser au-dela de 24 caracteres : a 13
// ans, un prenom trop long est une faute de frappe, pas une demande a rejeter
// par un message d'erreur — et le PRD §4 se joue sur cet ecran.
export function ecrirePrenom(p) {
  const propre = normaliserPrenom(typeof p === 'string' ? p : '');
  if (propre === '') return null;
  ecrireCle(CLE_PRENOM, propre);
  return propre;
}

// --- la progression -------------------------------------------------------

// Rend { [idExercice]: horodatageISO }. Un stockage vide, refuse ou illisible
// rend {} : l'app demarre alors sans memoire, mais elle demarre.
export function lireFaits() {
  const brut = lireCle(CLE_FAITS);
  if (brut === null || brut === '') return {};

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('marcq : progression illisible, elle est ignoree', err);
    return {};
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return {};

  // On ne retient que les couples bien formes : une cle dont la valeur n'est pas
  // une chaine vient d'un schema qui n'est pas le notre, et la laisser passer
  // ferait echouer le tri des egalites au classement (PRD §9).
  const faits = {};
  for (const [id, quand] of Object.entries(valeur)) {
    if (id !== '' && typeof quand === 'string' && quand !== '') faits[id] = quand;
  }
  return faits;
}

function ecrireFaits(faits) {
  return ecrireCle(CLE_FAITS, JSON.stringify(faits));
}

// Coche un exercice et rend les faits a jour. L'horodatage n'est pas decoratif :
// le PRD §9 departage les egalites au classement par « le premier arrive a ce
// score ». Recocher ne rajeunit donc pas la marque.
export function cocher(id, quand = new Date().toISOString()) {
  const faits = lireFaits();
  if (faits[id] !== undefined) return faits;
  faits[id] = quand;
  ecrireFaits(faits);
  return faits;
}

// Fusionne dans la progression locale ce que le serveur rend sur une reprise,
// et rend les faits a jour. C'est le seul endroit du projet ou la progression
// entre par le reseau, et il n'enleve jamais rien : ce qui est deja coche ici
// le reste, ce qui manque est ajoute.
//
// L'HORODATAGE LE PLUS ANCIEN GAGNE, et ce n'est pas un detail de tri : le PRD
// §9 departage les ex aequo par « le premier arrive a ce score ». Reprendre sa
// progression sur un second telephone ne doit donc pas faire reculer l'enfant
// derriere quelqu'un qui a coche apres lui.
//
// Une valeur qui n'est pas une chaine non vide est ignoree, exactement comme
// dans lireFaits : le corps vient du reseau, il se lit avec la meme defiance
// que le stockage.
export function fusionnerFaits(recus) {
  if (recus === null || typeof recus !== 'object' || Array.isArray(recus)) return lireFaits();

  const faits = lireFaits();
  let change = false;
  for (const [id, quand] of Object.entries(recus)) {
    if (id === '' || typeof quand !== 'string' || quand === '') continue;
    if (faits[id] === undefined || quand < faits[id]) {
      faits[id] = quand;
      change = true;
    }
  }
  if (change) ecrireFaits(faits);
  return faits;
}

// Decocher supprime la cle : un booleen `false` trainerait indefiniment et
// gonflerait le stockage pour ne rien dire (ossature §6).
export function decocher(id) {
  const faits = lireFaits();
  if (faits[id] === undefined) return faits;
  delete faits[id];
  ecrireFaits(faits);
  return faits;
}

// --- la sonnerie ----------------------------------------------------------

// La seule preference de l'application. Une CHAINE et non un objet : le jour ou
// un second reglage apparait, il prendra sa propre cle plutot que de faire
// migrer celle-ci — l'ossature §6 tient a des cles independantes, chacune
// lisible seule et illisible sans consequence.
//
// La validation vit chez `sonnerie.js`, qui connait la liste ; ici on ne fait
// que lire et ecrire une chaine.
export function lireSonnerie() {
  const brut = lireCle(CLE_SONNERIE);
  return typeof brut === 'string' && brut !== '' ? brut : null;
}

export function ecrireSonnerie(cle) {
  if (typeof cle !== 'string' || cle === '') return false;
  return ecrireCle(CLE_SONNERIE, cle);
}

// --- le classement --------------------------------------------------------

// La quatrieme cle de l'ossature §6. Elle porte de quoi parler au serveur —
// `pseudo` et `code` — et de quoi afficher sans reseau : la derniere reponse
// d'envoi acceptee et le dernier instantane du classement.
//
//   dernierEnvoi     { at, empreinte }   ce que le serveur a deja recu
//   dernierRangConnu { recuA, instantane, moi }
//     instantane  le corps entier du dernier GET   { jour, programmees,
//                 participants, classement, groupe }
//     moi         le corps entier de la derniere reponse d'envoi acceptee
//                 { pseudo, jour, rang, participants, cochees, programmees,
//                   part, ignores }
//
// Les deux corps sont gardes ENTIERS et non transformes : le PRP 09 compare
// `moi.jour` a `instantane.jour` pour savoir si le rang qu'il affiche date
// d'avant minuit, et un champ retire ici casserait la-bas sans symptome.
export const CLASSEMENT_VIDE = {
  pseudo: null, code: null, dernierEnvoi: null, dernierRangConnu: null,
};

// Rend toujours un objet, jamais null — comme `lireFaits()` rend {} : l'appelant
// n'a pas de branche a ecrire, et un stockage refuse ne casse rien (ossature §6).
export function lireClassement() {
  const brut = lireCle(CLE_CLASSEMENT);
  if (brut === null || brut === '') return { ...CLASSEMENT_VIDE };

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('marcq : etat du classement illisible, il est ignore', err);
    return { ...CLASSEMENT_VIDE };
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) {
    return { ...CLASSEMENT_VIDE };
  }
  return { ...CLASSEMENT_VIDE, ...valeur };
}

// FUSIONNE puis ecrit, et cette fusion n'est pas une commodite. Un remplacement
// complet serait le defaut le plus couteux du produit : le rafraichissement du
// rang n'ecrit que `dernierRangConnu` et effacerait `code`, donc le seul moyen
// pour l'enfant de retirer son pseudonyme (PRD §14). Rien ne casserait, l'app
// continuerait, et le degat n'apparaitrait qu'au moment ou il est irreparable.
export function ecrireClassement(partiel) {
  const a_jour = { ...lireClassement(), ...partiel };
  ecrireCle(CLE_CLASSEMENT, JSON.stringify(a_jour));
  return a_jour;
}

export function effacerClassement() {
  const existait = lireCle(CLE_CLASSEMENT) !== null;
  effacerCle(CLE_CLASSEMENT);
  return existait;
}

// --- le ressenti ----------------------------------------------------------

// La cinquieme cle de l'ossature §6 : une date de seance, une reponse. Ce
// module ne connait AUCUN vocabulaire metier — il n'accepte qu'une chaine non
// vide, exactement comme pour les horodatages de `faits`. Les trois valeurs
// admises vivent dans ressenti.js.
export function lireRessentis() {
  const brut = lireCle(CLE_RESSENTI);
  if (brut === null || brut === '') return {};

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('marcq : ressentis illisibles, ils sont ignores', err);
    return {};
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return {};

  // Les couples mal formes sont ignores, les autres survivent : un schema
  // etranger ne doit pas emporter les reponses valides qui l'accompagnent.
  const ressentis = {};
  for (const [date, dit] of Object.entries(valeur)) {
    if (date !== '' && typeof dit === 'string' && dit !== '') ressentis[date] = dit;
  }
  return ressentis;
}

// La valeur REMPLACE celle du jour, la ou `cocher` refuse de rajeunir une
// marque : un horodatage departage un classement (PRD §9), une reponse est
// juste la derniere donnee.
export function ecrireRessenti(dateISO, valeur) {
  const ressentis = lireRessentis();
  ressentis[dateISO] = valeur;
  ecrireCle(CLE_RESSENTI, JSON.stringify(ressentis));
  return ressentis;
}

export function effacerRessenti(dateISO) {
  const ressentis = lireRessentis();
  if (ressentis[dateISO] === undefined) return ressentis;
  delete ressentis[dateISO];
  ecrireCle(CLE_RESSENTI, JSON.stringify(ressentis));
  return ressentis;
}

// « Changer d'enfant » (PRD §7.2). Rend le nombre de cles effacees, repli en
// memoire compris — sinon un prenom qui n'avait pas pu s'ecrire survivrait au
// changement d'enfant, ce qui est exactement ce que ce geste doit empecher.
//
// On enumere au lieu de retirer deux cles connues : la cle
// `marcq.v1.classement` que posera le lot 2 doit partir aussi. On passe par
// `length` et `key()` — l'API du stockage — plutot que par `Object.keys`, et on
// collecte avant d'effacer : retirer pendant l'enumeration en sauterait une sur
// deux.
export function toutEffacer() {
  const cles = new Set([...memoire.keys()].filter(estCleMarcq));

  const m = magasin();
  if (m !== null) {
    try {
      for (let i = 0; i < m.length; i += 1) {
        const cle = m.key(i);
        if (estCleMarcq(cle)) cles.add(cle);
      }
    } catch (err) {
      console.warn('marcq : enumeration du stockage impossible', err);
    }
  }

  for (const cle of cles) effacerCle(cle);
  return cles.size;
}
