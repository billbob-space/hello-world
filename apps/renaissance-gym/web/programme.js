// programme.js — lecture et derivation du fichier de donnees (PRD §8).
//
// Module PUR (ossature §6) : ni DOM, ni localStorage, ni reseau. Il ne fait
// que lire `programme.json` et deriver ce que le PRD demande — objectifs,
// composition des seances — sans jamais recopier une valeur en dur ailleurs
// (ossature §7, point 2).

const MESURES = new Set(['repetitions', 'tenue']);

function estChaineNonVide(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function erreur(message) {
  throw new Error(`programme.js : ${message}`);
}

// Valide la forme du fichier de donnees et rend le programme tel quel — il
// n'est jamais transforme, seulement verifie, pour que `exercices()` rende
// exactement l'ordre du fichier (PRD §8.1 : les totaux sont derives, jamais
// recopies).
export function chargerProgramme(json) {
  if (json === null || typeof json !== 'object') erreur('le programme n’est pas un objet');

  const { titre, semaines, seances_par_semaine: seancesParSemaine, familles, exercices, seances } = json;

  if (!estChaineNonVide(titre)) erreur('titre manquant');
  if (!Number.isInteger(semaines) || semaines < 1) erreur('« semaines » doit etre un entier positif');
  if (!Number.isInteger(seancesParSemaine) || seancesParSemaine < 1) {
    erreur('« seances_par_semaine » doit etre un entier positif');
  }
  if (!Array.isArray(familles) || familles.length === 0) erreur('« familles » doit etre un tableau non vide');
  if (!Array.isArray(exercices) || exercices.length === 0) erreur('« exercices » doit etre un tableau non vide');
  if (!Array.isArray(seances) || seances.length === 0) erreur('« seances » doit etre un tableau non vide');

  const idsFamilles = new Set();
  for (const f of familles) {
    if (!estChaineNonVide(f?.id) || !estChaineNonVide(f?.nom)) erreur('une famille est mal formee');
    if (idsFamilles.has(f.id)) erreur(`famille en double : ${f.id}`);
    idsFamilles.add(f.id);
  }

  const idsExercices = new Set();
  for (const ex of exercices) {
    if (!estChaineNonVide(ex?.id)) erreur('un exercice sans identifiant');
    if (idsExercices.has(ex.id)) erreur(`exercice en double : ${ex.id}`);
    idsExercices.add(ex.id);
    if (!estChaineNonVide(ex.libelle)) erreur(`exercice ${ex.id} : libelle manquant`);
    if (!idsFamilles.has(ex.famille)) erreur(`exercice ${ex.id} : famille inconnue « ${ex.famille} »`);
    if (!MESURES.has(ex.mesure)) erreur(`exercice ${ex.id} : mesure invalide « ${ex.mesure} »`);
    // A4 (« Ajoute apres les PRP ») : le nombre de paliers est celui de la
    // FEUILLE — une, deux ou trois valeurs — jamais fixe a quatre. Un exercice
    // a valeur unique porte un seul nombre ; il n'y a plus de marche
    // fabriquee par l'application (voir `palierDeSemaine` plus bas).
    if (!Array.isArray(ex.paliers) || ex.paliers.length < 1 || ex.paliers.length > 8
      || ex.paliers.some((p) => !Number.isFinite(p))) {
      erreur(`exercice ${ex.id} : « paliers » doit porter entre 1 et 8 nombres`);
    }
    if (ex.variante !== undefined && !estChaineNonVide(ex.variante)) {
      erreur(`exercice ${ex.id} : « variante », si presente, doit etre une chaine non vide`);
    }
  }

  const idsSeances = new Set();
  for (const s of seances) {
    if (!estChaineNonVide(s?.id) || !estChaineNonVide(s?.nom)) erreur('une seance est mal formee');
    if (idsSeances.has(s.id)) erreur(`seance en double : ${s.id}`);
    idsSeances.add(s.id);
    if (!Array.isArray(s.exercices) || s.exercices.length === 0) {
      erreur(`seance ${s.id} : « exercices » doit etre un tableau non vide`);
    }
    for (const id of s.exercices) {
      if (!idsExercices.has(id)) erreur(`seance ${s.id} : exercice inconnu « ${id} »`);
    }
  }

  return json;
}

// Rend les exercices dans l'ordre du fichier — jamais retries, jamais filtres :
// c'est cet ordre que la seance et la grille reprennent.
export function exercices(prog) {
  return prog.exercices;
}

export function exercice(prog, id) {
  return prog.exercices.find((ex) => ex.id === id);
}

// `numero` est 1..4 — la numerotation que le PRD et les ecrans utilisent — et
// non l'index du tableau, pour que « seance 1 » ne suppose jamais que
// `seances[0]` en est la premiere si le fichier de donnees est un jour
// reordonne.
export function seance(prog, numero) {
  return prog.seances.find((s) => s.id === `s${numero}`);
}

export function exercicesDeSeance(prog, numero) {
  const s = seance(prog, numero);
  if (s === undefined) return [];
  return s.exercices.map((id) => exercice(prog, id)).filter((ex) => ex !== undefined);
}

// A15 (« Ajoute apres les PRP », lot ludique) : la premiere seance (1..4) qui
// porte cet exercice, ou null s'il n'appartient a aucune — un garde-fou qui
// ne devrait jamais survenir. Un exercice de souplesse peut appartenir a deux
// seances de la meme semaine (PRD §8.4) ; c'est alors la premiere dans
// l'ordre du fichier qui est retenue, un choix arbitraire mais deterministe,
// puisque le PRD n'attache pas de sens a laquelle des deux compte pour le
// tirage au hasard.
export function seanceContenant(prog, idExercice) {
  const s = prog.seances.find((seance) => seance.exercices.includes(idExercice));
  if (s === undefined) return null;
  const trouve = /^s(\d+)$/.exec(s.id);
  return trouve ? Number(trouve[1]) : null;
}

// A8 (« Ajoute apres les PRP ») : les trente-six exercices groupes par
// famille, dans l'ordre de la feuille — chaque groupe suit l'ordre de
// `familles`, chaque exercice l'ordre de `exercices` (PRD §8.1 : jamais
// recopie, toujours derive du fichier de donnees). C'est ce qui reconstitue
// les deux pages d'origine a l'ecran.
export function exercicesParFamille(prog) {
  return prog.familles.map((f) => ({
    id: f.id,
    nom: f.nom,
    exercices: prog.exercices.filter((ex) => ex.famille === f.id),
  }));
}

// Semaine 1..8 -> index de palier (A4, « Ajoute apres les PRP » : le §8.3
// d'origine fabriquait deux marches intermediaires qui ne venaient d'aucune
// entraineuse — corrige ici, pas seulement dans les donnees). Les huit
// semaines sont reparties en `nombrePaliers` blocs AUSSI EGAUX QUE POSSIBLE,
// le reste allant aux PREMIERS blocs : deux valeurs -> 4 et 4 semaines (S1-S4,
// S5-S8) ; trois valeurs -> 3, 3 et 2 semaines (S1-S3, S4-S6, S7-S8) ; une
// valeur unique -> un seul bloc de huit, elle ne bouge jamais. Une semaine
// hors bornes est ramenee a la borne la plus proche plutot que de lancer :
// une gymnaste en semaine 9 (programme termine, PRD §9.7) continue de voir
// l'objectif du dernier palier si elle rejoue une seance.
export function palierDeSemaine(nombrePaliers, semaine) {
  const n = Math.max(1, Math.trunc(nombrePaliers));
  const s = Math.min(Math.max(Math.trunc(semaine), 1), 8);
  const taille = Math.floor(8 / n);
  const reste = 8 % n;
  let restantes = s;
  for (let i = 0; i < n; i += 1) {
    const tailleDuBloc = taille + (i < reste ? 1 : 0);
    if (restantes <= tailleDuBloc) return i;
    restantes -= tailleDuBloc;
  }
  return n - 1;
}

export function objectif(ex, semaine) {
  const valeur = ex.paliers[palierDeSemaine(ex.paliers.length, semaine)];
  const unite = ex.mesure === 'tenue' ? 'secondes' : 'repetitions';
  return { valeur, unite };
}

// `1 min` et non `60 s` : la feuille ecrit « 1min », et l'utilisatrice lit la
// feuille (PRD §8.1). Le programme ne porte jamais de valeur au-dela de 60 s,
// donc aucune autre conversion n'est necessaire.
export function objectifTexte(ex, semaine) {
  const { valeur, unite } = objectif(ex, semaine);
  if (unite === 'repetitions') return `x${valeur}`;
  return valeur === 60 ? '1 min' : `${valeur} s`;
}

// PRD §8.4 et ossature §7 point 1 : l'union des quatre seances vaut EXACTEMENT
// tous les exercices du fichier, ni plus ni moins.
export function couvertureComplete(prog) {
  const tous = new Set(prog.exercices.map((ex) => ex.id));
  const couverts = new Set();
  for (const s of prog.seances) {
    for (const id of s.exercices) couverts.add(id);
  }
  if (couverts.size !== tous.size) return false;
  for (const id of tous) if (!couverts.has(id)) return false;
  return true;
}
