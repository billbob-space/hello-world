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
  // A1 (« Ajouté après les PRP ») : la file de la seance en cours, pour
  // qu'une seance interrompue puis reprise retrouve son ordre — y compris
  // les exercices passes. Jamais envoyee au serveur (voir synchro.js) : ce
  // n'est pas un fait, seulement l'ordre local d'une seance qui n'est pas
  // finie.
  fileSeance: null, // { semaine, numero, file: [id...], passes: [id...] }
  // A7 (« Ajouté après les PRP ») : la sonnerie choisie dans les reglages —
  // garde ici comme le reste de l'etat, jamais envoyee au serveur (ce n'est
  // pas un fait). L'identifiant par defaut est celui de `sonnerie.js`
  // (`SONNERIE_PAR_DEFAUT`), recopie en litteral plutot qu'importe : ce
  // module reste pur et ne depend d'aucun autre (ossature §6).
  sonnerie: 'classique',
  // A11 (« Ajoute apres les PRP ») : l'option des reglages qui demande — ou
  // non — le verrou d'ecran pendant une seance. Active par defaut (PRD §5) ;
  // jamais envoyee au serveur, ce n'est pas un fait.
  ecranAllume: true,
  // Le lot ludique, « Ajoute apres les PRP » : A13 porte huit parures,
  // acquises DEFINITIVEMENT, sur le meme principe que `badges` — un
  // identifiant present dans cette liste n'en sort plus jamais, meme si un
  // fait qui l'avait declenchee est ensuite decoche depuis la grille ou
  // qu'un programme recommence a zero (PRD, lot ludique A13 : « une semaine
  // bouclee ne se debloque pas »). Suit la fiche comme les badges : union a
  // la synchronisation, jamais un ecrasement.
  parures: [],
  // A16 : les trois records ne peuvent que MONTER (records.js les fusionne,
  // jamais ne les remplace). Suit la fiche : fusionne par le plus grand,
  // champ par champ, cote client comme cote serveur.
  records: { plusLongueTenue: 0, plusExercicesJour: 0, totalExercices: 0 },
  // A14 : la couleur du justaucorps, PAS celle de l'application (elle ne
  // touche a aucun jeton de style.css). Six combinaisons, toutes disponibles
  // des le premier jour ; celle-ci suit sa fiche comme le prenom — le
  // dernier ecrit gagne, elle n'a pas de sens en union.
  couleurJustaucorps: 'bleu-roi',
  // A17 : l'instantane du programme termine, fige UNE SEULE FOIS par
  // `bilan.js` (vue-jour.js) — « la trace de son ete » ne bouge plus ensuite,
  // meme si un nouveau programme redemarre. Local a l'appareil : jamais
  // envoye au serveur (ce n'est pas un fait, et §9.9 ne dit rien d'un
  // instantane fige).
  bilan: null, // { seancesFaites, exercicesFaits, records, dateISO }
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

function estListeIdentifiants(v) {
  return Array.isArray(v) && v.every((id) => typeof id === 'string' && id !== '');
}

function estFileSeanceValide(f) {
  return (
    f !== null && typeof f === 'object'
    && Number.isInteger(f.semaine) && f.semaine >= 1 && f.semaine <= 8
    && Number.isInteger(f.numero) && f.numero >= 1 && f.numero <= 4
    && estListeIdentifiants(f.file)
    && estListeIdentifiants(f.passes)
  );
}

// A16 (lot ludique) : un record hors bornes (negatif, absent, corrompu) ne
// rejette jamais l'ensemble — chaque champ retombe individuellement sur zero,
// exactement comme `records.js` le ferait a la fusion.
function nombrePositifOuZero(v) {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function sanitiserRecords(r) {
  if (r === null || typeof r !== 'object') return { ...ETAT_VIDE.records };
  return {
    plusLongueTenue: nombrePositifOuZero(r.plusLongueTenue),
    plusExercicesJour: nombrePositifOuZero(r.plusExercicesJour),
    totalExercices: nombrePositifOuZero(r.totalExercices),
  };
}

// A17 : un bilan corrompu ou mal forme (stockage bricolé a la main, version
// anterieure au lot ludique) degrade vers « pas encore de bilan » plutot que
// de casser l'ecran qui le lit.
function sanitiserBilan(b) {
  if (b === null || typeof b !== 'object') return null;
  if (!Number.isFinite(b.seancesFaites) || !Number.isFinite(b.exercicesFaits)) return null;
  if (typeof b.dateISO !== 'string' || b.dateISO === '') return null;
  return {
    seancesFaites: nombrePositifOuZero(b.seancesFaites),
    exercicesFaits: nombrePositifOuZero(b.exercicesFaits),
    records: sanitiserRecords(b.records),
    dateISO: b.dateISO,
  };
}

// Ne rend JAMAIS null et ne lance jamais : un stockage indisponible degrade
// vers l'etat en memoire, il ne casse jamais l'application (PRP 02).
export function lireEtat() {
  const brut = lireBrut();
  if (brut === null || brut === '') return { ...ETAT_VIDE, faits: [], badges: [], parures: [] };

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('renaissance-gym : état illisible, remplacé par l’état vide', err);
    return { ...ETAT_VIDE, faits: [], badges: [], parures: [] };
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) {
    return { ...ETAT_VIDE, faits: [], badges: [], parures: [] };
  }

  const faits = Array.isArray(valeur.faits) ? valeur.faits.filter(estFaitValide) : [];
  const badges = Array.isArray(valeur.badges) ? valeur.badges.filter((b) => typeof b === 'string' && b !== '') : [];
  const fileSeance = estFileSeanceValide(valeur.fileSeance) ? valeur.fileSeance : null;
  const parures = estListeIdentifiants(valeur.parures) ? valeur.parures : [];
  const records = sanitiserRecords(valeur.records);
  const couleurJustaucorps = typeof valeur.couleurJustaucorps === 'string' && valeur.couleurJustaucorps !== ''
    ? valeur.couleurJustaucorps
    : ETAT_VIDE.couleurJustaucorps;
  const bilan = sanitiserBilan(valeur.bilan);
  return {
    ...ETAT_VIDE, ...valeur, faits, badges, fileSeance, parures, records, couleurJustaucorps, bilan,
  };
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

// A1 : ecrit la file d'une seance en cours (et les exercices deja passes au
// moins une fois) — c'est ce qui permet a une seance interrompue de
// retrouver son ordre au rechargement. Un fichier vide (plus rien a valider)
// efface l'entree plutot que de garder une file finie qui generait une
// future relecture de cette meme seance.
export function ecrireFileSeance(semaine, numero, file, passes) {
  const valeur = file.length === 0 ? null : { semaine, numero, file: [...file], passes: [...passes] };
  return ecrireEtat({ fileSeance: valeur });
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
