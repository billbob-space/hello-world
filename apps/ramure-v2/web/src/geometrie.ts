// apps/ramure-v2/web/src/geometrie.ts
//
// Geometrie pure du canevas, testable sans DOM. Porte F-09 (l'affinite se
// lit sans texte) et F-10 (heritiers rattaches visuellement). Ce fichier et
// internal/arbre/selection.go (Go, PRP 04) portent les deux exigences les
// plus subtiles du produit : aucun acces au DOM ici, sous peine de rendre
// F-09/F-10 verifiables seulement au bout en bout (PRP 05, "ce que la
// suite attend de vous" n°2).

/** Bande de rayons dans laquelle une branche est placee autour du centre. */
export interface Anneau {
  rayonMin: number;
  rayonMax: number;
}

/** Bande de tailles (rayon de pastille) qu'une affinite peut produire. */
export interface Taille {
  min: number;
  max: number;
}

/** Une branche ou un heritier positionne, pret a etre dessine. */
export interface NoeudPlace {
  x: number;
  y: number;
  r: number;
}

// Bande de taille des pastilles de BRANCHE (pas des heritiers, plus petits
// et fixes, cf. RAYON_HERITIER). Constante de conception partagee par
// placerBranches et par canevas.ts (PRP 05, tache 3), pour que le rayon
// dessine soit toujours celui utilise pour placer les noeuds voisins :
// changer l'un sans l'autre romprait la garantie de non-chevauchement.
export const TAILLE_PASTILLE: Taille = { min: 14, max: 40 };

function borner01(affinite: number): number {
  return Math.min(1, Math.max(0, affinite));
}

// rayonPour : F-09, moitie "distance". Une affinite plus forte (proche de 1)
// donne un rayon plus PETIT — le noeud se rapproche du centre — donc le
// terme decroissant est soustrait de rayonMax.
export function rayonPour(affinite: number, a: Anneau): number {
  const f = borner01(affinite);
  return a.rayonMax - (a.rayonMax - a.rayonMin) * f;
}

// taillePour : F-09, moitie "taille". Une affinite plus forte donne une
// pastille strictement plus grande.
export function taillePour(affinite: number, t: Taille): number {
  const f = borner01(affinite);
  return t.min + (t.max - t.min) * f;
}

// placerBranches distribue n branches en couronne autour du centre (0,0),
// reparties uniformement en angle. Le rayon ET la taille de chacune
// dependent de son affinite (F-09) ; l'espacement angulaire uniforme,
// combine a un rayon croissant avec la distance, garantit qu'aucune paire
// de pastilles ne se chevauche pour les cadrages du produit (8 a 10
// branches, PRD §05) : c'est verifie par test plutot que suppose.
export function placerBranches(
  n: number,
  anneau: Anneau,
  affinites: number[],
): NoeudPlace[] {
  const resultat: NoeudPlace[] = [];
  for (let i = 0; i < n; i++) {
    const affinite = affinites[i] ?? 0;
    const distance = rayonPour(affinite, anneau);
    const rayonPastille = taillePour(affinite, TAILLE_PASTILLE);
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    resultat.push({
      x: distance * Math.cos(angle),
      y: distance * Math.sin(angle),
      r: rayonPastille,
    });
  }
  return resultat;
}

// placerHeritiers (F-10) : les heritiers d'une branche sont places en
// eventail, sur un petit rayon fixe AUTOUR de la branche, dans la direction
// oppose au centre (0,0) — donc du cote exterieur de l'arbre, jamais entre
// le centre et la branche, ce qui les eloignerait visuellement des autres
// branches et les rapprocherait de la seule branche a laquelle ils
// appartiennent.
const RAYON_HERITIER = 34;

export function placerHeritiers(
  branche: { x: number; y: number },
  n: number,
  ouverture: number,
): Array<{ x: number; y: number }> {
  const angleBranche = Math.atan2(branche.y, branche.x);
  const resultat: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    // Repartition symetrique autour de angleBranche, sur [-ouverture/2, +ouverture/2].
    const t = n === 1 ? 0.5 : i / (n - 1);
    const angle = angleBranche - ouverture / 2 + ouverture * t;
    resultat.push({
      x: branche.x + RAYON_HERITIER * Math.cos(angle),
      y: branche.y + RAYON_HERITIER * Math.sin(angle),
    });
  }
  return resultat;
}
