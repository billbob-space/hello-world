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

  // Accueil, mur de pochettes et tri (PRD §07 etat A, F-05, F-06, F-07).
  planterDepuisTuile: (nom: string): string => `Planter ${nom}`,
  triLabel: "Trier le mur",
  triRecents: "Gardes recemment",
  triAlphabetique: "Ordre alphabetique",
  triAleatoire: "Aleatoire",
  accueilPromesse: "Plante un nom, saute de branche en branche.",
  accueilVide: "Plante un premier artiste pour commencer l'exploration.",
  retourAccueil: "Retour a l'accueil",

  // Recherche, suggestions et rattrapage (F-01 a F-04, §09).
  suggestionsLabel: "Suggestions d'artistes",
  correctionQuestion: (nom: string): string => `Tu voulais dire ${nom} ?`,
  correctionAccepter: (nom: string): string => `Oui, planter ${nom}`,
  correctionRefuser: "Non",
  effacerRecherche: "Effacer la recherche",

  // Partage d'un arbre (F-34).
  partagerLien: "Copier le lien de cet arbre",
  lienCopie: "Lien copie dans le presse-papiers.",

  // Fiche du centre, discographie, lecteur, service d'ecoute (F-19 a F-25,
  // F-40).
  ficheTitre: (nom: string): string => `Fiche de ${nom}`,
  apercuBrancheTitre: (nom: string): string => `Apercu de ${nom}`,
  discographieTitre: "Discographie",
  filtrerParType: "Filtrer par type de sortie",
  typeTous: "Tous",
  typeStudio: "Studio",
  typeLive: "Live",
  typeCompilation: "Compilation",
  typeFormatCourt: "Format court",
  lecteurLire: (titre: string): string => `Lire ${titre}`,
  lecteurPause: "Mettre en pause",
  lecteurSuivant: "Extrait suivant",
  lecteurAucunExtrait: "Aucun extrait disponible pour cet artiste.",
  choisirService: "Service d'ecoute",
  service: {
    deezer: "Deezer",
    spotify: "Spotify",
    apple: "Apple Music",
    youtube: "YouTube Music",
    tidal: "Tidal",
  },
  ecouterSur: (nom: string, service: string): string => `Ecouter ${nom} sur ${service}`,
} as const;
