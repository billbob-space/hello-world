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
  zoomerArriere: "Dézoomer",

  // Lignee (PRD §05 "Lignee", F-14).
  remonterLaLignee: "Revenir à l'artiste précédent",

  // Repli d'illustration deterministe (F-38, F-39) : le motif remplace une
  // image absente, il n'a pas besoin d'un texte propre puisqu'il occupe la
  // meme pastille nommee que l'image qu'il remplace.

  // Accueil, mur de pochettes et tri (PRD §07 etat A, F-05, F-06, F-07).
  planterDepuisTuile: (nom: string): string => `Planter ${nom}`,
  triLabel: "Trier le mur",
  // §17 Q10 (PRODUCT.md, decision du 23 aout 2026, constat N7) : nomme
  // l'ORDRE "recents" du tri, jamais l'intertitre — les deux repondent a
  // des questions differentes (l'un "dans quel ordre", l'autre "ce que le
  // mur montre") et NE PARTAGENT PLUS leur formulation depuis le constat
  // N7 : les confondre reproduirait le libelle qui ment (une seule chaine
  // dans la bande de 36 px, fausse des que le visiteur trie autrement).
  // Voir accueilIntertitreCollection ci-dessous pour l'intertitre.
  triRecents: "Gardés récemment",
  // Libelle de l'ordre "recents" tant que le mur vient de l'amorcage
  // editorial (aucune collection cablee, F-28/F-30) : "recents" respecte
  // alors l'ordre EDITORIAL fourni par l'appelant (accueil.ts,
  // trierTuiles), qui n'a rien de "garde" — cf. triRecents ci-dessus.
  triSelectionEditoriale: "Sélection éditoriale",
  triAlphabetique: "Ordre alphabétique",
  triAleatoire: "Aléatoire",
  // §17 Q10 : la promesse quitte le haut de l'accueil pour devenir le
  // texte d'attente du champ de recherche — elle continue de dire ce que
  // fait le produit, lue au moment ou elle sert plutot qu'affirmee en
  // permanence au-dessus d'un mur qu'elle ne decrit pas.
  accueilPromesse: "Plante un nom, saute de branche en branche.",
  // Texte d'attente par defaut du champ de recherche HORS accueil (etat
  // B) : restaure par masquerAccueil() (main.ts) quand accueilPromesse
  // cesse de s'appliquer. Identique a la valeur figee dans index.html
  // (attribut `placeholder`, lu avant que ce script ne s'execute) — les
  // deux DOIVENT rester synchrones (defaut deja rencontre, critique
  // 2026-08-22 C2 : un libelle en dur y avait diverge de textes.ts).
  // GARDE (constat 2026-08-23 N3) : accessibilite.test.ts §13 lit le vrai
  // index.html et compare son attribut `placeholder` a cette valeur — une
  // divergence future y fait rougir un test plutot que d'attendre une
  // nouvelle critique visuelle.
  champRecherchePlaceholder: "Planter un artiste…",
  // Intertitre du mur (§17 Q10, decision du 23 aout 2026) : nomme ce qu'on
  // regarde, remplace l'ancien `accueilVide` — ecrit pour "rien de garde"
  // mais jamais appele (critique 2026-08-23 N4). Sert desormais vraiment
  // dans accueil.ts (libelleAccueilIntertitre), etat "amorcage".
  accueilIntertitrePourCommencer: "Pour commencer",
  // Intertitre du mur, etat "collection" (§17 Q10, constat N7). Nomme la
  // COLLECTION elle-meme — ce que le mur montre, quel que soit l'ordre
  // choisi — et non un ordre de tri : DELIBEREMENT distinct de triRecents
  // ci-dessus, qui ne reste vrai qu'en tri "recents". Reprendre triRecents
  // ici affirmerait un classement par date de garde meme quand le
  // visiteur vient de basculer sur l'ordre alphabetique ou aleatoire.
  accueilIntertitreCollection: "Déjà gardés",
  // Intitule accessible du panneau d'accueil (§12, "les panneaux et
  // fenetres sont titres, meme sans titre visible"). L'intertitre du mur
  // (accueilIntertitrePourCommencer / accueilIntertitreCollection
  // ci-dessus) est un heading visible, mais il nomme la LISTE de tuiles,
  // pas la section qui la contient (recherche + tri + mur) : les deux
  // noms sont DISTINCTS et coexistent (l'un sur #accueil, l'autre sur son
  // intertitre), exactement comme un article a un titre et un <nav>
  // distinct pour sa table des matieres.
  accueilTitre: "Accueil",
  retourAccueil: "Retour à l'accueil",

  // Lignee : DEUX actions de retour distinctes (§12 "les actions de retour
  // sont distinguees") — "Retour a l'accueil" (ci-dessus) quitte
  // l'exploration entiere ; celle-ci ne remonte QUE d'un cran, vers
  // l'artiste immediatement precedent (F-14). Un intitule different sur
  // chacune est ce qui empeche la navigation assistee de les confondre.

  // Recherche, suggestions et rattrapage (F-01 a F-04, §09).
  suggestionsLabel: "Suggestions d'artistes",
  correctionQuestion: (nom: string): string => `Tu voulais dire ${nom} ?`,
  correctionAccepter: (nom: string): string => `Oui, planter ${nom}`,
  correctionRefuser: "Non",
  effacerRecherche: "Effacer la recherche",

  // Partage d'un arbre (F-34).
  partagerLien: "Copier le lien de cet arbre",
  lienCopie: "Lien copié dans le presse-papiers.",

  // Fiche du centre, discographie, lecteur, service d'ecoute (F-19 a F-25,
  // F-40).
  ficheTitre: (nom: string): string => `Fiche de ${nom}`,
  // Critique 2026-08-22 C13 : le PRD §07 decrit la fiche large comme
  // « repliable » ; aucune commande de repli n'existait, ni son libelle.
  ficheReplier: "Replier la fiche",
  apercuBrancheTitre: (nom: string): string => `Aperçu de ${nom}`,
  // Critique 2026-08-22 C11 : F-19 exige presentation, genres ET audience.
  // genres et auditeurs etaient TYPES dans fiche.ts et jamais rendus ; et
  // quand la source du profil est indisponible, la fiche n'affichait rien du
  // tout — un profil manquant se lisait comme un artiste sans profil. F-36
  // (marque Critique) demande de distinguer « rien a montrer » de « panne ».
  profilIndisponible: "Le profil de cet artiste n'a pas pu être chargé.",
  auditeurs: (n: number): string => `${n.toLocaleString("fr-FR")} auditeurs`,
  genresTitre: "Genres",
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
  choisirService: "Service d'écoute",
  service: {
    deezer: "Deezer",
    spotify: "Spotify",
    apple: "Apple Music",
    youtube: "YouTube Music",
    tidal: "Tidal",
  },
  ecouterSur: (nom: string, service: string): string => `Écouter ${nom} sur ${service}`,

  // Collection : garder, retirer, replanter, lignee (F-28 a F-33, PRP 07).
  // Le vocabulaire du PRD §05 — collection, replanter, lignee — est
  // employe tel quel, ici comme dans le code.
  collectionTitre: "Collection",
  collectionOuvrir: "Voir la collection",
  collectionFermer: "Fermer la collection",
  collectionVide: "Aucun artiste gardé pour l'instant.",
  garder: "Garder cet artiste",
  garde: "Déjà gardé",
  retirerDeLaCollection: (nom: string): string => `Retirer ${nom} de la collection`,
  replanterDepuisLaCollection: (nom: string): string => `Replanter ${nom}`,
  ligneeDeDecouverte: (lignee: readonly string[]): string => lignee.join(" → "),
  gardeLe: (date: string): string => `Gardé le ${date}`,

  // Echec de plantation (§17 Q6 de PRODUCT.md, decision du 22 aout 2026) :
  // la bande remplace l'ancien artiste fantome (un disque au centre portant
  // le nom mal orthographie saisi par le visiteur, dementi seulement par
  // une ligne de gris a l'autre bout de l'ecran -- critique 2026-08-22
  // C15). Son message dit ce qui s'est passe ET ce qu'on peut faire, jamais
  // un simple constat : voir web/src/echec.ts, qui compose ce texte.
  echecPlantation: (messageServeur: string): string => `${messageServeur} Vérifie l'orthographe, ou plante un autre nom.`,
  echecPlantationGenerique: "Aucun artiste ne correspond à cette recherche.",
  reseauIndisponible: "Le réseau n'a pas répondu. Réessaie dans un instant.",

  // Session expiree (F-41) : Traefik redirige une session expiree vers
  // Google, jamais un JSON — le defaut le plus deroutant serait de laisser
  // croire a une erreur de saisie. Le lien recharge la page courante, ce
  // qui relance l'authentification (§09).
  sessionExpireeMessage: "Ta session a expiré.",
  sessionExpireeLien: "Se reconnecter",

  // Mise a jour signalee (F-42, N-12) : le service worker installe une
  // nouvelle version en arriere-plan mais ne l'active JAMAIS seul — casser
  // une exploration en cours serait pire que de rester une minute de plus
  // sur l'ancienne version.
  miseAJourDisponible: "Une nouvelle version de RAMURE est disponible.",
  miseAJourAppliquer: "Mettre à jour",
} as const;
