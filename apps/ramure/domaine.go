// Le vocabulaire du PRD, en types Go.
//
// La §05 du PRD declare son vocabulaire "contractuel" : graine, centre,
// branche, heritier, affinite, vivier, lignee, collection. Les types portent
// donc ces noms-la, en francais, et non leur traduction anglaise. Un lecteur
// qui passe du PRD au code ne change pas de langue, donc ne se demande jamais
// si "neighbour" designe une branche ou un heritier.
package main

// Artiste est la fiche minimale d'un artiste — ce que porte n'importe quel
// noeud du canevas.
//
// Les champs couteux (Bio, Genres, Audience) ne sont remplis que pour le
// centre : c'est la regle "profondeur maximale au centre, strict minimum sur
// l'entourage" de la N-03. Une branche arrive avec son nom et son image, et
// rien de plus, parce que c'est tout ce que le canevas affiche d'elle.
type Artiste struct {
	// ID est l'identifiant interne, prefixe par sa source : "dz:1069".
	// Le prefixe evite qu'un identifiant Deezer et un identifiant d'une
	// source future se telescopent le jour ou une seconde source du role 2
	// entre en cascade.
	ID string `json:"id"`

	Nom   string `json:"nom"`
	Image string `json:"image,omitempty"`

	// Renseignes pour le centre uniquement.
	Bio      string   `json:"bio,omitempty"`
	Genres   []string `json:"genres,omitempty"`
	Audience int      `json:"audience,omitempty"`

	// LienSource est la page de l'artiste chez la source du role 2. Elle sert
	// de repli ultime a la resolution des liens d'ecoute (F-26).
	LienSource string `json:"lienSource,omitempty"`
}

// Noeud est un artiste place sur le canevas.
//
// Les trois grandeurs geometriques sont calculees au serveur et normalisees
// entre 0 et 1 : le client les multiplie par les dimensions de sa fenetre.
// Ce partage n'est pas arbitraire — il met la geometrie de l'arbre dans du
// code testable sans navigateur (§13, "geometrie du canevas" au niveau
// unitaire) tout en laissant le zoom et le redimensionnement au client, ou
// ils doivent etre.
type Noeud struct {
	Artiste

	// Affinite est le degre de proximite avec le centre, entre 0 et 1.
	// Le PRD interdit de l'afficher comme un nombre sur le canevas (§05) :
	// elle voyage jusqu'au client parce qu'elle module l'opacite des liens,
	// pas pour etre ecrite.
	Affinite float64 `json:"affinite"`

	// Rayon est la distance au centre, en fraction du rayon de l'anneau.
	// Taille est le diametre de la pastille, en fraction du diametre maximum.
	// Les deux varient avec l'affinite, dans le meme sens : c'est la F-09,
	// "l'affinite se lit sans texte", et il en faut bien deux pour qu'un
	// daltonien ou un ecran mal calibre ne perde pas l'information.
	Rayon  float64 `json:"rayon"`
	Taille float64 `json:"taille"`

	// Angle est la position sur le cercle, en degres, 0 = midi, sens horaire.
	Angle float64 `json:"angle"`

	// Stable marque les voisins evidents conserves d'une visite a l'autre.
	// La F-08 demande un entourage different a chaque visite *tout en*
	// conservant les plus evidents : sans ce repere, l'utilisateur ne
	// reconnait pas l'arbre qu'il vient de quitter.
	Stable bool `json:"stable,omitempty"`

	// Heritiers gravitent autour de cette branche. Vide pour un heritier :
	// l'arbre s'arrete a la deuxieme generation.
	Heritiers []Noeud `json:"heritiers,omitempty"`
}

// Album est une sortie de la discographie du centre.
type Album struct {
	ID       string `json:"id"`
	Titre    string `json:"titre"`
	Pochette string `json:"pochette,omitempty"`
	Annee    int    `json:"annee,omitempty"`

	// Type vaut exactement une des constantes type* ci-dessous. La F-22 exige
	// qu'un album releve d'un seul type : c'est une classification, pas un
	// jeu d'etiquettes.
	Type string `json:"type"`

	// Note est l'appreciation communautaire normalisee entre 0 et 1, Votes le
	// nombre de suffrages qui la fondent. Note vaut 0 et Votes 0 quand le role
	// 3 n'a rien pour cet album : c'est un etat parfaitement normal, et la
	// F-21 impose alors de conserver l'ordre d'origine plutot que de reléguer
	// l'album en fin de liste.
	Note  float64 `json:"note,omitempty"`
	Votes int     `json:"votes,omitempty"`

	LienSource string `json:"lienSource,omitempty"`
}

// Les quatre types de sortie de la F-22. "court" couvre le single et le EP :
// le PRD dit "format court", pas "single", parce que la frontiere entre les
// deux varie d'un catalogue a l'autre et qu'un filtre qui les separe produit
// deux categories que l'utilisateur ne sait pas distinguer.
const (
	typeStudio      = "studio"
	typeLive        = "live"
	typeCompilation = "compilation"
	typeCourt       = "court"
)

// TypesDeSortie est l'ordre d'affichage du filtre. Il va du plus attendu au
// moins attendu, pas par ordre alphabetique : on cherche d'abord les albums
// studio.
var TypesDeSortie = []string{typeStudio, typeLive, typeCompilation, typeCourt}

// Arbre est la reponse complete a une plantation ou une promotion : le centre,
// son entourage, et de quoi lire la fiche.
type Arbre struct {
	Centre   Artiste `json:"centre"`
	Branches []Noeud `json:"branches"`

	// Graine est le nom effectivement plante. Il differe du nom saisi quand le
	// rattrapage orthographique a corrige la saisie (F-03) — le client s'en
	// sert pour dire "plante sous <Graine>" plutot que de laisser croire que
	// l'utilisateur avait tape juste.
	Graine   string `json:"graine,omitempty"`
	Corrige  bool   `json:"corrige,omitempty"`
	NomSaisi string `json:"nomSaisi,omitempty"`

	// Vivier est la taille du reservoir dans lequel les branches ont ete
	// tirees. Il n'est pas affiche : il sert au diagnostic (N-10) et aux tests,
	// qui verifient que le tirage a bien eu de quoi varier.
	Vivier int `json:"vivier"`

	// Elague compte les branches retirees faute d'illustration et d'ecoute
	// possible (F-16).
	Elague int `json:"elague,omitempty"`
}
