// etat.js — le seul module qui touche localStorage (ossature §6, PRP 02
// chantier C). Tout le reste passe par lui.
//
// La cle est prefixee `gym.v1.` (ossature §6) : le numero de version permet
// une migration future sans deviner ce qui traine dans un stockage laisse par
// une version anterieure.

export const CLE = 'gym.v1.etat';

export const ETAT_VIDE = {
  prenom: null,
  semaineDeDepart: 1,
  debut: null, // ISO du premier lancement
  faits: [], // les faits dates du PRP 01 : { seance, semaine, exercice, a }
  pseudo: null,
  code: null,
  dernierEnvoi: null,
  dernierSucces: null,
  badges: [],
};

export const EVT_ETAT = 'gym:etat-maj';

// Le magasin est relu a chaque appel, jamais capture a l'import : sur certains
// navigateurs en navigation privee, l'acces a la propriete elle-meme leve au
// lieu de rendre un objet, et un module qui l'aurait capture au chargement
// serait mort avant d'avoir servi une seule lecture.
function magasin() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Ce qui n'a pas pu etre ecrit dans le stockage est garde ici, le temps de
// l'onglet, et relu en priorite — c'est ce qui evite le pire defaut possible :
// une progression qui ne s'enregistre pas, donc qui redemande le prenom ou
// perd une seance en cours a chaque rendu. Une fois l'ecriture reussie, le
// repli disparait : il n'est jamais un second etat durable.
const memoire = new Map();

function lireBrut() {
  if (memoire.has(CLE)) return memoire.get(CLE);
  const m = magasin();
  if (m === null) return null;
  try {
    return m.getItem(CLE);
  } catch {
    return null;
  }
}

function ecrireBrut(valeur) {
  memoire.set(CLE, valeur);
  const m = magasin();
  if (m === null) return false;
  try {
    m.setItem(CLE, valeur);
    memoire.delete(CLE);
    return true;
  } catch (err) {
    console.warn('renaissance-gym : écriture de l’état refusée, gardée en mémoire', err);
    return false;
  }
}

function emettre() {
  if (typeof globalThis.dispatchEvent !== 'function') return;
  try {
    const Evenement = typeof globalThis.CustomEvent === 'function' ? globalThis.CustomEvent : globalThis.Event;
    globalThis.dispatchEvent(new Evenement(EVT_ETAT));
  } catch (err) {
    console.warn('renaissance-gym : l’evenement d’etat n’a pas pu etre emis', err);
  }
}

function estFaitValide(f) {
  return (
    f !== null && typeof f === 'object'
    && Number.isInteger(f.seance) && f.seance >= 1 && f.seance <= 4
    && Number.isInteger(f.semaine) && f.semaine >= 1 && f.semaine <= 8
    && typeof f.exercice === 'string' && f.exercice !== ''
    && typeof f.a === 'string' && f.a !== ''
  );
}

function memeFait(a, b) {
  return a.seance === b.seance && a.semaine === b.semaine && a.exercice === b.exercice;
}

// Ne rend JAMAIS null et ne lance jamais : un stockage indisponible degrade
// vers l'etat en memoire, il ne casse jamais l'application (PRP 02).
export function lireEtat() {
  const brut = lireBrut();
  if (brut === null || brut === '') return { ...ETAT_VIDE, faits: [], badges: [] };

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('renaissance-gym : état illisible, remplacé par l’état vide', err);
    return { ...ETAT_VIDE, faits: [], badges: [] };
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) {
    return { ...ETAT_VIDE, faits: [], badges: [] };
  }

  const faits = Array.isArray(valeur.faits) ? valeur.faits.filter(estFaitValide) : [];
  const badges = Array.isArray(valeur.badges) ? valeur.badges.filter((b) => typeof b === 'string' && b !== '') : [];
  return { ...ETAT_VIDE, ...valeur, faits, badges };
}

// FUSIONNE puis ecrit -> l'etat a jour. Un remplacement complet serait le
// defaut le plus couteux du produit : une ecriture qui ne pose qu'un champ
// (par exemple le dernier essai de synchronisation) effacerait sinon le
// pseudonyme et le code, le seul moyen de retrouver la fiche sur un autre
// telephone (PRD §10).
export function ecrireEtat(partiel) {
  const aJour = { ...lireEtat(), ...partiel };
  ecrireBrut(JSON.stringify(aJour));
  emettre();
  return aJour;
}

// Ajoute un fait s'il est absent, sans le dupliquer — un exercice deja valide
// pour cette seance et cette semaine n'est pas revalide deux fois (PRD §9.5 :
// refaire une seance deja faite est permis et ne compte pas double).
export function ajouterFait(f) {
  if (!estFaitValide(f)) return lireEtat();
  const actuel = lireEtat();
  if (actuel.faits.some((existant) => memeFait(existant, f))) return actuel;
  return ecrireEtat({ faits: [...actuel.faits, f] });
}

// PRD §9.2, §9.4 : la correction depuis la grille — le seul geste qui retire
// une case, jamais depuis l'ecran de seance.
export function retirerFait(f) {
  const actuel = lireEtat();
  const faits = actuel.faits.filter((existant) => !memeFait(existant, f));
  if (faits.length === actuel.faits.length) return actuel;
  return ecrireEtat({ faits });
}

// Rend true si la cle existait avant l'effacement.
export function effacerEtat() {
  const existait = lireBrut() !== null;
  memoire.delete(CLE);
  const m = magasin();
  if (m !== null) {
    try {
      m.removeItem(CLE);
    } catch (err) {
      console.warn('renaissance-gym : effacement de l’état refusé', err);
    }
  }
  emettre();
  return existait;
}
