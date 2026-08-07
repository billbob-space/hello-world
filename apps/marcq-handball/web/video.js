// video.js — « comment on fait, déjà ? ».
//
// Un enfant de treize ans qui lit « 15 dips sur une chaise » a besoin de VOIR
// le mouvement, pas d'une definition. Chaque exercice porte donc un lien vers
// une demonstration.
//
// DEUX SOURCES, ET LA PREMIERE GAGNE :
//
//   1. `ex.video` dans `programme.json` — une adresse choisie et VERIFIEE par un
//      adulte. C'est la bonne reponse, et le champ existe pour qu'elle puisse
//      etre donnee sans toucher a une ligne de code.
//   2. a defaut, une RECHERCHE sur le mouvement. Elle ouvre toujours quelque
//      chose, ne pointe sur rien qui puisse disparaitre, et n'affirme pas
//      qu'une video precise a ete regardee par quelqu'un.
//
// Le choix de la seconde comme repli est assume : proposer une video precise
// que personne n'a visionnee serait la mettre sous les yeux d'un enfant sur la
// foi de son titre. Une recherche laisse ce dernier pas a l'humain qui regarde
// l'ecran — et le champ `video` est la pour figer sa reponse.

// Les mouvements du programme, du plus precis au plus general : le premier
// motif qui correspond gagne. « squats sautes » DOIT donc passer avant
// « squats », et « gainage de chaque cote » avant « gainage » — sans quoi
// l'enfant recevrait la demonstration du mouvement voisin, ce qui est pire
// qu'aucune.
export const MOUVEMENTS = [
  { motif: /gainage (de chaque c[oô]t[ée]|lat[ée]ral)/i, nom: 'gainage latéral', requete: 'gainage latéral technique débutant' },
  { motif: /gainage/i, nom: 'gainage ventral', requete: 'gainage ventral planche technique débutant' },
  { motif: /chaise contre un mur/i, nom: 'chaise contre un mur', requete: 'exercice chaise contre un mur technique' },
  { motif: /dips/i, nom: 'dips sur une chaise', requete: 'dips sur une chaise technique débutant' },
  { motif: /mountain climbers?/i, nom: 'mountain climbers', requete: 'mountain climber technique débutant' },
  { motif: /burpees?/i, nom: 'burpees', requete: 'burpee technique débutant' },
  { motif: /(squats? saut[ée]s?|jumping squats?)/i, nom: 'squats sautés', requete: 'squat sauté technique débutant' },
  { motif: /squats?/i, nom: 'squats', requete: 'squat technique débutant' },
  { motif: /fentes? saut[ée]es?/i, nom: 'fentes sautées', requete: 'fente sautée technique débutant' },
  { motif: /fentes?/i, nom: 'fentes', requete: 'fente avant technique débutant' },
  { motif: /pompes?/i, nom: 'pompes', requete: 'pompes technique débutant' },
  { motif: /(abdos|crunchs?)/i, nom: 'abdos', requete: 'crunch abdominaux technique débutant' },
  // Les seances de course. « 15-15 » et « 30-30 » sont du vocabulaire de coach :
  // c'est precisement ce qu'un enfant ne peut pas deviner, et donc ce qui merite
  // le plus une demonstration.
  { motif: /\d+\s*-\s*\d+|rapides? [àa] fond|\d+\s*s rapides/i, nom: 'fractionné', requete: 'fractionné 30-30 course à pied expliqué' },
  { motif: /(\d+\s*m [àa] \d+|× ?\d+\s*m)/i, nom: 'sprint', requete: 'technique de sprint course à pied' },
  { motif: /(minutes? rapides|r[ée]cup[ée]ration)/i, nom: 'fractionné', requete: 'fractionné course à pied expliqué' },
  { motif: /(footing|[ée]chauffement)/i, nom: 'footing', requete: 'footing allure endurance fondamentale débutant' },
  { motif: /autre sport/i, nom: 'sport au choix', requete: 'échauffement natation vélo débutant' },
];

// Le mouvement d'un exercice, ou null si aucun motif ne le reconnait. Aucun des
// 53 exercices du programme n'est dans ce cas, et un test le verifie a chaque
// execution : ajouter une seance sans ajouter son mouvement le fait echouer.
export function mouvementDe(libelle) {
  const texte = String(libelle ?? '');
  return MOUVEMENTS.find(({ motif }) => motif.test(texte)) ?? null;
}

// L'adresse d'une recherche. `encodeURIComponent` et non une concatenation : un
// « % » ou un « + » dans une requete casserait l'adresse sans rien dire.
export function lienRecherche(requete) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(requete)}`;
}

// Ce que l'ecran doit poser pour un exercice : une adresse et ce qu'elle
// promet, ou null s'il n'y a rien a montrer. `epingle` distingue les deux
// sources — c'est ce qui permet a l'ecran de ne pas promettre « la video » quand
// il ouvre une recherche.
export function video(ex) {
  const epingle = typeof ex?.video === 'string' && ex.video.trim() !== '' ? ex.video.trim() : null;
  if (epingle !== null) {
    return { href: epingle, epingle: true, nom: mouvementDe(ex?.libelle)?.nom ?? 'ce mouvement' };
  }
  const mouvement = mouvementDe(ex?.libelle);
  if (mouvement === null) return null;
  return { href: lienRecherche(mouvement.requete), epingle: false, nom: mouvement.nom };
}

// Ce que le lien annonce a voix haute. Le libelle visible, lui, tient en un
// symbole : la place a droite d'une ligne est comptee, et « ▶ » se lit sans
// traduction. Les deux formulations different parce que les deux promesses
// different — une video choisie n'est pas une recherche.
export function titreVideo(v) {
  return v.epingle
    ? `Voir la vidéo : ${v.nom}`
    : `Chercher une vidéo qui montre : ${v.nom}`;
}

// --- le montage -------------------------------------------------------------

export const SYMBOLE_VIDEO = '▶';

// Pose le lien d'un exercice dans `hote`, ou rien s'il n'y en a pas. Rend le
// noeud pose, ou null — l'ecran n'a rien a demonter, un lien n'ecoute rien.
export function monterVideo(hote, ex) {
  const v = video(ex);
  if (v === null) return null;

  const lien = document.createElement('a');
  lien.className = 'video-exercice';
  lien.href = v.href;
  lien.textContent = SYMBOLE_VIDEO;
  // Un nouvel onglet, et `noopener` avec : sans lui, la page ouverte garde une
  // poignee sur celle-ci. La seance reste donc ouverte derriere, avec ses cases
  // et son minuteur en cours.
  lien.target = '_blank';
  lien.rel = 'noopener noreferrer';
  lien.title = titreVideo(v);
  lien.setAttribute('aria-label', titreVideo(v));

  hote.append(lien);
  return lien;
}
