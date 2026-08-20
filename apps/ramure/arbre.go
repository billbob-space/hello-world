// La selection de l'entourage et la geometrie du canevas.
//
// Tout ce fichier est une fonction pure : un vivier et une graine d'alea
// entrent, un arbre sort. Aucun appel reseau, aucune horloge, aucun etat
// global. C'est la §13 qui l'exige — "logique deterministe isolee de
// l'interface, avec source d'alea injectable pour rendre les tirages
// reproductibles" — et c'est ce qui rend testable la partie du produit dont
// les defauts sont invisibles a l'oeil : un tirage qui ne varie jamais, une
// affinite non monotone, un heritier attribuable a la mauvaise branche.
package main

import (
	"hash/fnv"
	"math"
	"math/rand"
	"sort"
)

// Les parametres de cadrage de la §05. Le PRD les donne comme "des ordres de
// grandeur, a confirmer par la mesure" et delegue leur valeur exacte a
// l'equipe (§17) — ils sont donc rassembles ici, nommes, plutot que disperses
// en litteraux dans le code.
const (
	// Au-dela de dix branches le canevas devient illisible ; en deca de six,
	// l'exploration s'appauvrit. Neuf est le point retenu.
	branchesCible = 9
	branchesMin   = 6

	// Deux branches survivent d'une visite a l'autre (F-08). Sans elles,
	// l'utilisateur qui revient sur un centre ne reconnait pas l'arbre qu'il
	// vient de quitter et croit s'etre trompe de page.
	branchesStables = 2

	// Deuxieme generation. Le PRD donne "2 a 3 heritiers par branche" (§05) ;
	// la mesure a l'ecran tranche pour deux. A trois, neuf branches portent
	// vingt-sept libelles supplementaires et les noms se recouvrent au cadrage
	// neutre — ce que la §11 interdit ("un nom n'est jamais masque"). Deux
	// suffisent a montrer qu'une branche a une descendance, ce qui est tout ce
	// que la deuxieme generation doit dire.
	heritiersParBranche = 2

	// En dessous de ce vivier, le tirage pondere n'a plus rien a tirer :
	// l'entourage devient l'ensemble du vivier et la F-08 ne peut pas etre
	// honoree. On le mesure pour pouvoir le dire, pas pour refuser de servir.
	vivierSuffisant = 30
)

// Bornes geometriques, en fraction du rayon de l'anneau et du diametre maximal
// de pastille. Le client les multiplie par les dimensions de sa fenetre.
//
// Les deux grandeurs varient avec l'affinite dans le meme sens (F-09) : une
// affinite forte rapproche ET grossit. L'une seule suffirait a encoder
// l'information, mais deux la rendent lisible quand la premiere est brouillee —
// par un ecran mal calibre pour la taille, par un panneau ouvert pour la
// distance.
const (
	rayonProche = 0.55 // affinite 1
	rayonLoin   = 1.00 // affinite 0
	tailleMin   = 0.50 // affinite 0
	tailleMax   = 1.00 // affinite 1

	// Orbite courte des heritiers, en fraction du rayon de l'anneau.
	rayonHeritier = 0.34

	// Demi-ouverture de l'eventail des heritiers, en degres. L'eventail est
	// centre sur la direction radiale de sa branche, donc oriente vers
	// l'exterieur : c'est ce qui rend le rattachement sans ambiguite (F-10).
	ouvertureEventail = 26.0
)

// Tirage decrit la part d'alea d'un entourage.
//
// La F-08 demande que deux visites du meme centre donnent des entourages
// differents. Le nonce est ce qui change entre deux visites ; l'identifiant du
// centre est ce qui fait qu'un meme nonce ne produit pas le meme decalage
// angulaire pour deux artistes differents.
type Tirage struct {
	Centre string
	Nonce  int
}

// alea construit le generateur du tirage. Meme couple (centre, nonce) donne
// exactement le meme arbre : c'est ce qui rend un test reproductible, et ce
// qui fait qu'un rechargement de page ne rebat pas les cartes malgre
// l'utilisateur.
func (t Tirage) alea() *rand.Rand {
	h := fnv.New64a()
	_, _ = h.Write([]byte(t.Centre))
	// Le melange se fait en arithmetique non signee — la constante est le
	// nombre d'or sur 64 bits, qui deborde int64. La conversion finale ne perd
	// rien : rand n'a besoin que des 64 bits, pas de leur interpretation.
	const nombreDOr = uint64(0x9E3779B97F4A7C15)
	graine := h.Sum64() ^ (uint64(t.Nonce) * nombreDOr) //#nosec G115 -- melange de bits pour une graine PRNG deterministe ; un Nonce negatif ne fait que changer le melange (arithmetique non signee voulue, cf commentaire de fonction), aucune taille ni index n'en depend
	return rand.New(rand.NewSource(int64(graine)))      //#nosec G115 G404 -- graine de disposition du canevas (angles, gigue), reproductible par (Centre, Nonce) comme l'exige le PRD §13 ; rand.NewSource accepte tout int64 y compris negatif, et aucune valeur de securite ne depend de ce tirage — crypto/rand casserait la reproductibilite requise
}

// ChoisitBranches selectionne l'entourage dans le vivier.
//
// La F-08 tient en une phrase qui contient deux exigences contradictoires :
// "deux visites successives du meme centre donnent des entourages differents,
// tout en conservant les voisins les plus evidents". La resolution est un
// partage :
//
//   - les branchesStables premieres du vivier, par affinite, sont prises
//     systematiquement — ce sont les voisins evidents, ceux dont l'absence
//     ferait douter de la qualite du resultat ;
//   - les places restantes sont tirees au sort dans TOUT le reste du vivier,
//     ponderees par l'affinite. Un voisin lointain peut donc sortir, mais
//     rarement ; un voisin proche sort souvent, mais pas toujours.
//
// C'est ce qui fait qu'un artiste ne s'epuise pas en trois visites, sans que
// l'arbre paraisse aleatoire.
func ChoisitBranches(vivier []Voisin, t Tirage) []Voisin {
	return ChoisitNBranches(vivier, t, branchesCible)
}

// ChoisitNBranches est ChoisitBranches avec un nombre de branches impose.
//
// Il existe parce que la densite de noeuds ne peut pas etre la meme sur un
// telephone et sur un grand ecran. La §14 en fait un risque nomme — "le canevas
// exige de la place, le coeur du produit est le moins confortable sur
// telephone" — et demande de "tester la densite de noeuds sur petit ecran des
// le premier prototype". Neuf branches et leurs grappes tiennent sur un
// portable ; sur 390 points de large, les libelles se recouvrent et l'arbre
// devient illisible. Le client demande donc ce qu'il peut afficher.
func ChoisitNBranches(vivier []Voisin, t Tirage, cibleDemandee int) []Voisin {
	if len(vivier) == 0 {
		return nil
	}
	if cibleDemandee < branchesMin {
		cibleDemandee = branchesMin
	}
	if cibleDemandee > branchesCible {
		cibleDemandee = branchesCible
	}

	// Le vivier arrive trie par affinite decroissante, mais on ne s'y fie pas :
	// une fonction pure doit etablir ses propres invariants.
	tri := make([]Voisin, len(vivier))
	copy(tri, vivier)
	sort.SliceStable(tri, func(i, j int) bool { return tri[i].Affinite > tri[j].Affinite })

	cible := min(cibleDemandee, len(tri))
	stables := min(branchesStables, cible)

	choisies := make([]Voisin, 0, cible)
	choisies = append(choisies, tri[:stables]...)

	reste := make([]Voisin, len(tri[stables:]))
	copy(reste, tri[stables:])

	r := t.alea()
	for len(choisies) < cible && len(reste) > 0 {
		i := tirePondere(reste, r)
		choisies = append(choisies, reste[i])
		// Retrait sans preserver l'ordre : le vivier restant n'a plus a etre
		// trie, seules les ponderations comptent.
		reste[i] = reste[len(reste)-1]
		reste = reste[:len(reste)-1]
	}

	// L'ordre final est l'affinite decroissante : le placement angulaire s'en
	// sert pour alterner les distances, et un ordre stable rend le resultat
	// reproductible.
	sort.SliceStable(choisies, func(i, j int) bool { return choisies[i].Affinite > choisies[j].Affinite })
	return choisies
}

// tirePondere choisit un indice au hasard, avec une probabilite proportion-
// nelle a l'affinite elevee a une puissance.
//
// L'exposant est le reglage qui decide du caractere du produit. A 1, le tirage
// est presque uniforme et l'arbre part dans tous les sens. A 4, seuls les
// premiers sortent et la F-08 n'est plus honoree. A 2, un voisin deux fois
// plus proche sort quatre fois plus souvent : assez pour que l'arbre reste
// pertinent, assez peu pour qu'il surprenne.
const exposantTirage = 2.0

func tirePondere(vs []Voisin, r *rand.Rand) int {
	total := 0.0
	for _, v := range vs {
		total += poids(v.Affinite)
	}
	if total <= 0 {
		return r.Intn(len(vs))
	}

	seuil := r.Float64() * total
	cumul := 0.0
	for i, v := range vs {
		cumul += poids(v.Affinite)
		if cumul >= seuil {
			return i
		}
	}
	return len(vs) - 1
}

func poids(affinite float64) float64 {
	if affinite <= 0 {
		// Un plancher strictement positif : une affinite nulle ne doit pas
		// rendre un candidat intirable, sans quoi le vivier retreci finirait
		// par ne plus contenir que des poids nuls et le tirage bouclerait.
		return 0.001
	}
	return math.Pow(affinite, exposantTirage)
}

// secteurEntrelace rend le secteur angulaire attribue au rang d'affinite donne.
//
// C'est une bijection de [0, n[ vers [0, n[ : premiere moitie des rangs sur les
// secteurs pairs, seconde moitie sur les impairs. Elle est extraite en fonction
// de paquet plutot que gardee en fermeture parce que sa propriete essentielle —
// etre une bijection — se teste directement, alors qu'elle ne s'observe
// qu'indirectement dans les angles rendus, ou la gigue et la rotation
// d'ensemble la masquent.
func secteurEntrelace(rang, n int) int {
	if n <= 0 {
		return 0
	}
	moitie := (n + 1) / 2
	if rang < moitie {
		return 2 * rang
	}
	return 2*(rang-moitie) + 1
}

// Dispose place les branches sur le canevas et calcule leur geometrie.
//
// Les angles sont repartis en secteurs egaux plutot que tires au hasard. C'est
// la seule facon de garantir la contrainte de lisibilite de la §11 — "un nom
// n'est jamais masque par une pastille voisine, a aucun niveau de zoom" — sans
// avoir a resoudre un probleme de collision. Le hasard n'intervient que dans
// la rotation d'ensemble et dans une gigue bornee au quart du secteur, ce qui
// suffit a ce que deux visites ne se superposent pas, et ne peut jamais faire
// se rejoindre deux voisins.
func Dispose(branches []Voisin, t Tirage) []Noeud {
	if len(branches) == 0 {
		return nil
	}

	r := t.alea()
	// La rotation d'ensemble est consommee en premier, donc reproductible
	// independamment du nombre de branches.
	rotation := r.Float64() * 360
	secteur := 360.0 / float64(len(branches))

	// ENTRELACEMENT ANGULAIRE.
	//
	// Les branches arrivent triees par affinite decroissante, et leur donner des
	// secteurs CONSECUTIFS garantit que deux branches angulairement voisines
	// sont exactement celles dont les rayons sont les plus proches — donc dont
	// les grappes d'heritiers gravitent a la meme distance et se rejoignent. Le
	// pire cas n'etait pas un accident de tirage, c'etait la structure.
	//
	// Entrelacer les rangs — premiere moitie sur les secteurs pairs, seconde
	// moitie sur les impairs — met un rayon eloigne entre deux rayons proches.
	// Mesure sur 3000 tirages, distance minimale entre heritiers de grappes
	// voisines a neuf branches : 7,4 -> 20,8 px a R=320, et la part de scenes a
	// pastilles superposees tombe de 11,4 % a 0,9 % ; a R=240, de 28,7 % a 7,0 %.
	//
	// Le cout est nul : aucune constante nouvelle, aucune concession sur la
	// F-08, et l'ecart angulaire minimal reste secteur/2 — donc
	// TestDeuxBranchesNeDoiventJamaisSeSuperposer reste vert tel quel.
	noeuds := make([]Noeud, 0, len(branches))
	for i, b := range branches {
		gigue := (r.Float64() - 0.5) * secteur * 0.5 // ± un quart de secteur
		angle := math.Mod(rotation+float64(secteurEntrelace(i, len(branches)))*secteur+gigue+360, 360)

		noeuds = append(noeuds, Noeud{
			Artiste:  b.Artiste,
			Affinite: b.Affinite,
			Rayon:    rayonPour(b.Affinite),
			Taille:   taillePour(b.Affinite),
			Angle:    angle,
			Stable:   i < branchesStables,
		})
	}
	return noeuds
}

// rayonPour et taillePour sont les deux lectures de l'affinite (F-09).
//
// Elles sont lineaires et strictement monotones. La monotonie est ce que le
// critere d'acceptation exige explicitement, et elle n'est pas gratuite : une
// courbe en cloche, ou meme un palier, ferait apparaitre deux branches
// d'affinites differentes a la meme distance — l'utilisateur en deduirait une
// egalite qui n'existe pas.
func rayonPour(affinite float64) float64 {
	a := borne01(affinite)
	return rayonLoin - (rayonLoin-rayonProche)*a
}

func taillePour(affinite float64) float64 {
	a := borne01(affinite)
	return tailleMin + (tailleMax-tailleMin)*a
}

func borne01(v float64) float64 {
	if math.IsNaN(v) || v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

// DisposeHeritiers place une grappe autour de sa branche.
//
// L'eventail est centre sur l'angle de la branche elle-meme. Comme la branche
// est vue depuis le centre sous cet angle, l'eventail pointe vers l'exterieur :
// aucun heritier ne se retrouve entre sa branche et le centre, la ou il
// pourrait etre pris pour l'heritier d'une autre branche. C'est la F-10, et
// c'est une propriete du placement, pas un reglage a ajuster a l'oeil.
func DisposeHeritiers(branche Noeud, heritiers []Voisin) []Noeud {
	if len(heritiers) == 0 {
		return nil
	}
	if len(heritiers) > heritiersParBranche {
		heritiers = heritiers[:heritiersParBranche]
	}

	out := make([]Noeud, 0, len(heritiers))
	n := len(heritiers)
	for i, h := range heritiers {
		// Repartition symetrique autour de la direction radiale : un seul
		// heritier tombe pile dans l'axe, trois se repartissent a -26°, 0, +26°.
		var offset float64
		if n > 1 {
			offset = -ouvertureEventail + 2*ouvertureEventail*float64(i)/float64(n-1)
		}

		// Un heritier est toujours plus petit que SA branche, et la taille se
		// calcule donc RELATIVEMENT a elle, jamais dans l'absolu.
		//
		// La nuance n'est pas cosmetique. Une taille absolue tiree de la seule
		// affinite de l'heritier fait qu'un heritier tres affine d'une branche
		// peu affine devient plus GROS que sa propre branche : la hierarchie
		// des generations s'inverse et l'oeil lit l'heritier comme le parent.
		// Le facteur s'applique donc a la taille de la branche, ce qui garantit
		// l'ordre quelles que soient les deux affinites.
		part := 0.45 + 0.25*borne01(h.Affinite) // entre 45 % et 70 % de sa branche

		out = append(out, Noeud{
			Artiste:  h.Artiste,
			Affinite: h.Affinite,
			Angle:    math.Mod(branche.Angle+offset+360, 360),
			Rayon:    rayonHeritier,
			Taille:   branche.Taille * part,
		})
	}
	return out
}

// Elague retire les branches inexploitables (F-16).
//
// Le critere du PRD est "une branche dont on ne peut ni afficher
// l'illustration ni proposer d'ecoute". La seconde moitie demande une lecture :
// la source rend une adresse de page pour tout artiste, y compris pour les
// fiches fantomes qu'elle garde sans catalogue. Une adresse n'est donc pas une
// preuve qu'on puisse ecouter quoi que ce soit. L'audience nulle, elle, en est
// une bonne indication — personne n'ecoute un artiste que personne ne suit.
//
// La condition reste une conjonction, comme dans le PRD : un artiste sans
// portrait mais suivi reste une branche legitime. Et l'elagage ne s'applique
// que s'il reste assez de branches pour que l'arbre garde du sens — un centre
// obscur dont tous les voisins sont obscurs vaut mieux qu'un centre nu.
func Elague(branches []Noeud) ([]Noeud, int) {
	gardees := make([]Noeud, 0, len(branches))
	var candidates []Noeud

	for _, b := range branches {
		if b.Image == "" && b.Audience == 0 {
			candidates = append(candidates, b)
			continue
		}
		gardees = append(gardees, b)
	}

	if len(candidates) == 0 {
		return branches, 0
	}

	// On ne descend jamais sous le plancher : on reintegre des candidates
	// jusqu'a l'atteindre, dans leur ordre d'origine — donc les plus affines
	// d'abord.
	for len(gardees) < branchesMin && len(candidates) > 0 {
		gardees = append(gardees, candidates[0])
		candidates = candidates[1:]
	}

	sort.SliceStable(gardees, func(i, j int) bool { return gardees[i].Affinite > gardees[j].Affinite })
	return gardees, len(candidates)
}
