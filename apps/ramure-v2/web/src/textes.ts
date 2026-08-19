// apps/ramure-v2/web/src/textes.ts
//
// Toutes les chaines affichees a l'utilisateur vivent ICI, et nulle part
// ailleurs (PRP 05, "ce que la suite attend de vous" n°1). Le PRD est
// francophone et son vocabulaire (§05) est contractuel ; la centralisation
// ne sert pas a traduire aujourd'hui, elle sert a ne pas fermer la porte.
// Le PRP 08 verifiera qu'aucune chaine n'a fui dans canevas.ts, camera.ts
// ou promotion.ts.
export const textes = {
  titre: "RAMURE",
  promesse: "Plante un nom, saute de branche en branche.",

  // Intitule accessible d'un noeud (centre, branche ou heritier) : le nom
  // complet de l'artiste, jamais une initiale, un identifiant ou une
  // position (PRD §12).
  accessibleNoeud: (nom: string): string => nom,

  // Annonce vocale du changement de centre (PRD §12 : "le changement de
  // centre est annonce aux technologies d'assistance").
  annonceNouveauCentre: (nom: string): string => `Nouveau centre : ${nom}`,

  // Commandes de la camera (PRD §11 "Camera").
  cadrageInitial: "Revenir au cadrage initial",
  zoomerAvant: "Zoomer",
  zoomerArriere: "Dezoomer",

  // Lignee (PRD §05 "Lignee", F-14).
  remonterLaLignee: "Revenir a l'artiste precedent",

  // Repli d'illustration deterministe (F-38, F-39) : le motif remplace une
  // image absente, il n'a pas besoin d'un texte propre puisqu'il occupe la
  // meme pastille nommee que l'image qu'il remplace.
} as const;
