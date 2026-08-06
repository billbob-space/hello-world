// etat.js — tout ce qui persiste sur le telephone, et rien d'autre.
//
// Le serveur ne connait aucun utilisateur (PRD §5) : le prenom et la
// progression vivent ici, sous des cles prefixees `marcq.v1.` (ossature §6). Le
// numero de version est dans la cle, pas dans la valeur : changer de schema
// s'ecrit en `v2` et se migre depuis `v1`, sans jamais lire une valeur au
// mauvais format.

export const CLE_PRENOM = 'marcq.v1.prenom';
export const CLE_FAITS = 'marcq.v1.faits';
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

// Decocher supprime la cle : un booleen `false` trainerait indefiniment et
// gonflerait le stockage pour ne rien dire (ossature §6).
export function decocher(id) {
  const faits = lireFaits();
  if (faits[id] === undefined) return faits;
  delete faits[id];
  ecrireFaits(faits);
  return faits;
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
