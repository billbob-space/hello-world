package main

import (
	"fmt"
	"math"
	"sort"
	"testing"
)

// La §13 range la selection de l'entourage et la geometrie du canevas au
// niveau unitaire, "avec source d'alea injectable pour rendre les tirages
// reproductibles". Tirage.Nonce est cette source.

func vivierDeTest(n int) []Voisin {
	vs := make([]Voisin, n)
	for i := range vs {
		vs[i] = Voisin{
			Artiste:  Artiste{ID: fmt.Sprintf("dz:%d", i), Nom: fmt.Sprintf("Artiste %d", i), Image: "https://x/i.jpg", Audience: 1000},
			Affinite: 1 - float64(i)/float64(n),
		}
	}
	return vs
}

// Le symptome interdit : "l'outil s'epuise en trois visites" — le meme artiste
// donne toujours exactement les memes suggestions (§02, F-08).
func TestDeuxVisitesDuMemeCentreNeDoiventPasDonnerLeMemeEntourage(t *testing.T) {
	vivier := vivierDeTest(40)

	a := ChoisitBranches(vivier, Tirage{Centre: "dz:1", Nonce: 0})
	b := ChoisitBranches(vivier, Tirage{Centre: "dz:1", Nonce: 1})

	identiques := 0
	for i := range a {
		for j := range b {
			if a[i].ID == b[j].ID {
				identiques++
				break
			}
		}
	}
	if identiques == len(a) {
		t.Fatal("les deux entourages sont identiques : l'exploration s'epuiserait en trois visites")
	}
}

// L'autre moitie de la F-08 : "tout en conservant les voisins les plus
// evidents". Symptome interdit : l'utilisateur revient sur un centre et ne
// reconnait rien, donc croit s'etre trompe de page.
func TestLesVoisinsLesPlusEvidentsDoiventSurvivreDUneVisiteALAutre(t *testing.T) {
	vivier := vivierDeTest(40)
	attendus := []string{vivier[0].ID, vivier[1].ID}

	for nonce := 0; nonce < 30; nonce++ {
		branches := ChoisitBranches(vivier, Tirage{Centre: "dz:1", Nonce: nonce})
		for _, veut := range attendus {
			trouve := false
			for _, b := range branches {
				if b.ID == veut {
					trouve = true
					break
				}
			}
			if !trouve {
				t.Fatalf("tirage %d : le voisin evident %s a disparu, l'arbre n'est plus reconnaissable", nonce, veut)
			}
		}
	}
}

func TestUnMemeTirageDoitToujoursDonnerLeMemeArbre(t *testing.T) {
	vivier := vivierDeTest(40)
	tirage := Tirage{Centre: "dz:7", Nonce: 3}

	a := Dispose(ChoisitBranches(vivier, tirage), tirage)
	b := Dispose(ChoisitBranches(vivier, tirage), tirage)

	if len(a) != len(b) {
		t.Fatalf("nombre de branches instable : %d puis %d", len(a), len(b))
	}
	for i := range a {
		if a[i].ID != b[i].ID || a[i].Angle != b[i].Angle {
			t.Fatalf("branche %d instable : %s@%.2f puis %s@%.2f — un rechargement rebattrait les cartes",
				i, a[i].ID, a[i].Angle, b[i].ID, b[i].Angle)
		}
	}
}

func TestDeuxCentresDifferentsNeDoiventPasProduireLaMemeDisposition(t *testing.T) {
	vivier := vivierDeTest(40)
	a := Dispose(ChoisitBranches(vivier, Tirage{Centre: "dz:1", Nonce: 0}), Tirage{Centre: "dz:1", Nonce: 0})
	b := Dispose(ChoisitBranches(vivier, Tirage{Centre: "dz:2", Nonce: 0}), Tirage{Centre: "dz:2", Nonce: 0})

	if len(a) > 0 && len(b) > 0 && a[0].Angle == b[0].Angle {
		t.Error("deux centres differents ont la meme rotation d'ensemble : les arbres se ressembleraient tous")
	}
}

func TestLeNombreDeBranchesResteDansLesBornesDeCadrage(t *testing.T) {
	for _, taille := range []int{1, 3, 6, 12, 30, 60} {
		branches := ChoisitBranches(vivierDeTest(taille), Tirage{Centre: "dz:1", Nonce: 0})
		if len(branches) > branchesCible {
			t.Errorf("vivier de %d : %d branches, le canevas devient illisible au-dela de %d", taille, len(branches), branchesCible)
		}
		if taille >= branchesCible && len(branches) != branchesCible {
			t.Errorf("vivier de %d : %d branches, veut %d", taille, len(branches), branchesCible)
		}
		if taille < branchesCible && len(branches) != taille {
			t.Errorf("vivier de %d : %d branches, tout le vivier devrait sortir", taille, len(branches))
		}
	}
}

func TestUnVivierVideNeDoitPasFairePlanterLaSelection(t *testing.T) {
	if b := ChoisitBranches(nil, Tirage{Centre: "dz:1"}); len(b) != 0 {
		t.Errorf("vivier nil rend %d branches", len(b))
	}
	if n := Dispose(nil, Tirage{Centre: "dz:1"}); len(n) != 0 {
		t.Errorf("disposition d'un entourage vide rend %d noeuds", len(n))
	}
}

// F-09 : "distance au centre et taille de pastille varient toutes deux avec
// l'affinite, de facon MONOTONE et perceptible".
//
// Symptome interdit : deux branches d'affinites differentes apparaissent a la
// meme distance, et l'utilisateur en deduit une egalite qui n'existe pas.
func TestLAffiniteDoitSeLireDansLaDistanceEtDansLaTaille(t *testing.T) {
	precedentRayon := math.Inf(1)
	precedenteTaille := math.Inf(-1)

	for i := 0; i <= 20; i++ {
		a := float64(i) / 20

		r := rayonPour(a)
		if r >= precedentRayon {
			t.Errorf("affinite %.2f : rayon %.4f pas strictement inferieur au precedent %.4f", a, r, precedentRayon)
		}
		precedentRayon = r

		taille := taillePour(a)
		if taille <= precedenteTaille {
			t.Errorf("affinite %.2f : taille %.4f pas strictement superieure a la precedente %.4f", a, taille, precedenteTaille)
		}
		precedenteTaille = taille
	}

	// Et l'ecart doit etre PERCEPTIBLE : une variation de 2 % ne se verrait pas.
	if rayonPour(0)-rayonPour(1) < 0.3 {
		t.Error("l'ecart de distance entre affinite 0 et 1 est imperceptible")
	}
	if taillePour(1)-taillePour(0) < 0.3 {
		t.Error("l'ecart de taille entre affinite 0 et 1 est imperceptible")
	}
}

func TestUneAffiniteAberranteNeDoitPasSortirDesBornes(t *testing.T) {
	for _, a := range []float64{-5, -0.001, 1.001, 42, math.NaN()} {
		r, taille := rayonPour(a), taillePour(a)
		if r < rayonProche-1e-9 || r > rayonLoin+1e-9 {
			t.Errorf("rayonPour(%v) = %v, hors bornes", a, r)
		}
		if taille < tailleMin-1e-9 || taille > tailleMax+1e-9 {
			t.Errorf("taillePour(%v) = %v, hors bornes", a, taille)
		}
	}
}

// §11 : "un nom n'est jamais masque par une pastille voisine, a aucun niveau de
// zoom". La garantie vient du placement en secteurs egaux : deux branches ne
// peuvent pas se rejoindre angulairement.
func TestDeuxBranchesNeDoiventJamaisSeSuperposer(t *testing.T) {
	vivier := vivierDeTest(40)

	for nonce := 0; nonce < 50; nonce++ {
		tirage := Tirage{Centre: "dz:1", Nonce: nonce}
		noeuds := Dispose(ChoisitBranches(vivier, tirage), tirage)

		secteur := 360.0 / float64(len(noeuds))
		// La gigue vaut au plus un quart de secteur de chaque cote, donc deux
		// voisins conservent au minimum la moitie d'un secteur.
		minimum := secteur * 0.5

		for i := range noeuds {
			for j := i + 1; j < len(noeuds); j++ {
				ecart := math.Abs(noeuds[i].Angle - noeuds[j].Angle)
				if ecart > 180 {
					ecart = 360 - ecart
				}
				if ecart < minimum-1e-9 {
					t.Fatalf("tirage %d : branches %d et %d a %.2f° d'ecart, minimum %.2f° — les libelles se recouvrent",
						nonce, i, j, ecart, minimum)
				}
			}
		}
	}
}

func TestTousLesAnglesRestentDansLeCercle(t *testing.T) {
	vivier := vivierDeTest(40)
	for nonce := 0; nonce < 20; nonce++ {
		tirage := Tirage{Centre: "dz:1", Nonce: nonce}
		for _, n := range Dispose(ChoisitBranches(vivier, tirage), tirage) {
			if n.Angle < 0 || n.Angle >= 360 {
				t.Errorf("angle %.2f hors de [0, 360[", n.Angle)
			}
		}
	}
}

// F-10 : "chaque heritier gravite autour de SA branche ; aucun heritier
// n'apparait detache ou attribuable a une autre branche".
//
// L'eventail est centre sur l'angle de la branche, donc oriente radialement
// vers l'exterieur : aucun heritier ne se retrouve entre sa branche et le
// centre, la ou il pourrait etre pris pour l'heritier d'une voisine.
func TestUnHeritierNeDoitJamaisEtreAttribuableAUneAutreBranche(t *testing.T) {
	branche := Noeud{Angle: 90, Rayon: 0.7, Artiste: Artiste{ID: "dz:1", Nom: "Branche"}}
	heritiers := []Voisin{
		{Artiste: Artiste{ID: "dz:10", Nom: "H1"}, Affinite: .9},
		{Artiste: Artiste{ID: "dz:11", Nom: "H2"}, Affinite: .6},
		{Artiste: Artiste{ID: "dz:12", Nom: "H3"}, Affinite: .3},
	}

	// On assert contre la constante et non contre un litteral : le nombre
	// d'heritiers est un parametre de cadrage que la §17 delegue a l'equipe,
	// donc il bouge. Ce qui ne doit pas bouger, c'est le RATTACHEMENT — et
	// c'est ce que teste la suite.
	places := DisposeHeritiers(branche, heritiers)
	if len(places) != heritiersParBranche {
		t.Fatalf("%d heritiers places, veut %d", len(places), heritiersParBranche)
	}

	for _, h := range places {
		ecart := math.Abs(h.Angle - branche.Angle)
		if ecart > 180 {
			ecart = 360 - ecart
		}
		if ecart > ouvertureEventail+1e-9 {
			t.Errorf("heritier %s a %.2f° de sa branche, l'eventail ouvre a %.2f° — il paraitrait detache",
				h.Nom, ecart, ouvertureEventail)
		}
	}

	// L'eventail est symetrique autour de la branche : le premier et le dernier
	// s'ecartent autant de part et d'autre.
	dernier := places[len(places)-1]
	if math.Abs((places[0].Angle-branche.Angle)+(dernier.Angle-branche.Angle)) > 1e-9 {
		t.Error("l'eventail n'est pas symetrique : la grappe paraitrait pencher d'un cote")
	}
}

func TestUnHeritierEstToujoursPlusPetitQueSaBranche(t *testing.T) {
	branche := Noeud{Angle: 0, Taille: taillePour(0.1)} // la plus petite branche possible
	places := DisposeHeritiers(branche, []Voisin{{Artiste: Artiste{Nom: "H"}, Affinite: 1}})

	if places[0].Taille >= branche.Taille {
		t.Errorf("heritier de taille %.3f contre branche %.3f : la hierarchie des generations ne se lit plus",
			places[0].Taille, branche.Taille)
	}
}

func TestLeNombreDHeritiersEstBorne(t *testing.T) {
	beaucoup := make([]Voisin, 20)
	for i := range beaucoup {
		beaucoup[i] = Voisin{Artiste: Artiste{Nom: fmt.Sprintf("H%d", i)}, Affinite: .5}
	}
	places := DisposeHeritiers(Noeud{Angle: 0}, beaucoup)
	if len(places) != heritiersParBranche {
		t.Errorf("%d heritiers places, veut au plus %d — la grappe deviendrait illisible", len(places), heritiersParBranche)
	}
	if n := DisposeHeritiers(Noeud{Angle: 0}, nil); n != nil {
		t.Error("une grappe vide devrait rendre nil")
	}
}

func TestUnSeulHeritierTombeDansLAxeDeSaBranche(t *testing.T) {
	places := DisposeHeritiers(Noeud{Angle: 137}, []Voisin{{Artiste: Artiste{Nom: "H"}, Affinite: 1}})
	if math.Abs(places[0].Angle-137) > 1e-9 {
		t.Errorf("heritier unique a %.2f°, veut 137° : il devrait prolonger sa branche", places[0].Angle)
	}
}

// F-16 : l'elagage retire les branches inexploitables "a condition qu'il en
// reste un nombre suffisant".
func TestLElagageRetireLesBranchesInexploitables(t *testing.T) {
	branches := []Noeud{
		{Artiste: Artiste{ID: "1", Nom: "A", Image: "https://x/a.jpg", Audience: 500}, Affinite: .9},
		{Artiste: Artiste{ID: "2", Nom: "B"}, Affinite: .8},                           // ni image ni audience
		{Artiste: Artiste{ID: "3", Nom: "C", Audience: 200}, Affinite: .7},            // suivi mais sans portrait
		{Artiste: Artiste{ID: "4", Nom: "D", Image: "https://x/d.jpg"}, Affinite: .6}, // portrait sans audience
		{Artiste: Artiste{ID: "5", Nom: "E", Image: "https://x/e.jpg", Audience: 9}, Affinite: .5},
		{Artiste: Artiste{ID: "6", Nom: "F", Image: "https://x/f.jpg", Audience: 9}, Affinite: .4},
		{Artiste: Artiste{ID: "7", Nom: "G", Image: "https://x/g.jpg", Audience: 9}, Affinite: .3},
		{Artiste: Artiste{ID: "8", Nom: "H", Image: "https://x/h.jpg", Audience: 9}, Affinite: .2},
	}

	gardees, elague := Elague(branches)
	if elague != 1 {
		t.Errorf("%d branches elaguees, veut 1 (seule B n'a ni image ni audience)", elague)
	}
	for _, g := range gardees {
		if g.ID == "2" {
			t.Error("la branche sans image ni audience a survecu")
		}
	}
}

// "L'elagage ne s'applique que s'il reste assez de branches pour que l'arbre
// garde du sens" (§06) : un centre obscur dont tous les voisins sont obscurs
// vaut mieux qu'un centre nu.
func TestLElagageNeDoitJamaisViderLArbre(t *testing.T) {
	var branches []Noeud
	for i := 0; i < 8; i++ {
		branches = append(branches, Noeud{
			Artiste:  Artiste{ID: fmt.Sprintf("%d", i), Nom: fmt.Sprintf("Obscur %d", i)},
			Affinite: 1 - float64(i)/10,
		})
	}

	gardees, _ := Elague(branches)
	if len(gardees) < branchesMin {
		t.Fatalf("%d branches apres elagage, plancher a %d — l'arbre serait nu", len(gardees), branchesMin)
	}
	// Les reintegrees doivent etre les plus affines, pas des quelconques.
	if gardees[0].ID != "0" {
		t.Errorf("la branche reintegree en tete est %s, veut la plus affine (0)", gardees[0].ID)
	}
}

func TestElaguerUnArbreSainNeChangeRien(t *testing.T) {
	var branches []Noeud
	for i := 0; i < 9; i++ {
		branches = append(branches, Noeud{
			Artiste:  Artiste{ID: fmt.Sprintf("%d", i), Image: "https://x/i.jpg", Audience: 100},
			Affinite: 1 - float64(i)/10,
		})
	}
	gardees, elague := Elague(branches)
	if elague != 0 || len(gardees) != 9 {
		t.Errorf("elagage sur un arbre sain : %d retirees, %d gardees", elague, len(gardees))
	}
}

// Le tirage pondere doit favoriser les affinites fortes sans jamais rendre les
// faibles intirables — sinon la F-08 ne varierait plus au-dela des premiers.
func TestLeTirageFavoriseLesAffinitesFortesSansExclureLesFaibles(t *testing.T) {
	vivier := vivierDeTest(40)
	sorties := map[string]int{}

	for nonce := 0; nonce < 400; nonce++ {
		for _, b := range ChoisitBranches(vivier, Tirage{Centre: "dz:1", Nonce: nonce}) {
			sorties[b.ID]++
		}
	}

	// Un voisin du haut du vivier (hors stables) doit sortir plus souvent qu'un
	// voisin du bas.
	haut, bas := sorties["dz:3"], sorties["dz:35"]
	if haut <= bas {
		t.Errorf("dz:3 sort %d fois, dz:35 %d fois : l'affinite ne pese pas sur le tirage", haut, bas)
	}
	if bas == 0 {
		t.Error("un voisin lointain n'est jamais sorti en 400 tirages : le vivier ne sert a rien")
	}
}

// Regression : un heritier tres affine d'une branche peu affine etait rendu
// PLUS GROS que sa propre branche, inversant la lecture des generations. La
// taille d'un heritier se calcule relativement a sa branche, jamais dans
// l'absolu.
func TestUnHeritierTresAffineResteePlusPetitQuUneBranchePeuAffine(t *testing.T) {
	for _, affiniteBranche := range []float64{0, .1, .3, .5, .8, 1} {
		branche := Noeud{Angle: 0, Taille: taillePour(affiniteBranche)}
		for _, affiniteHeritier := range []float64{0, .3, .7, 1} {
			places := DisposeHeritiers(branche, []Voisin{{Artiste: Artiste{Nom: "H"}, Affinite: affiniteHeritier}})
			if places[0].Taille >= branche.Taille {
				t.Errorf("branche(affinite %.1f, taille %.3f) < heritier(affinite %.1f, taille %.3f) : les generations s'inversent",
					affiniteBranche, branche.Taille, affiniteHeritier, places[0].Taille)
			}
		}
	}
}

// Le symptome interdit : les grappes d'heritiers de deux branches voisines se
// chevauchent systematiquement, parce que les branches angulairement voisines
// sont aussi celles dont les rayons sont les plus proches.
//
// Dispose trie par affinite decroissante ; leur donner des secteurs consecutifs
// place cote a cote les deux rayons les plus semblables — le pire cas possible,
// et il etait structurel plutot qu'accidentel. L'entrelacement met un rayon
// eloigne entre deux rayons proches.
func TestDeuxBranchesVoisinesNontPasDesRayonsVoisins(t *testing.T) {
	vivier := vivierDeTest(40)

	for nonce := range 40 {
		tirage := Tirage{Centre: "dz:1", Nonce: nonce}
		noeuds := Dispose(ChoisitBranches(vivier, tirage), tirage)

		// On reordonne par angle croissant : c'est le voisinage a l'ecran.
		parAngle := make([]Noeud, len(noeuds))
		copy(parAngle, noeuds)
		sort.SliceStable(parAngle, func(i, j int) bool { return parAngle[i].Angle < parAngle[j].Angle })

		// Le rang d'affinite de chaque noeud dans l'ordre de sortie.
		rang := make(map[string]int, len(noeuds))
		for i, n := range noeuds {
			rang[n.ID] = i
		}

		// Sans entrelacement, chaque paire angulairement adjacente aurait des
		// rangs consecutifs. On exige que ce ne soit PAS le cas general.
		consecutifs := 0
		for i := range parAngle {
			a := rang[parAngle[i].ID]
			b := rang[parAngle[(i+1)%len(parAngle)].ID]
			if a-b == 1 || b-a == 1 {
				consecutifs++
			}
		}
		if consecutifs > len(parAngle)/2 {
			t.Fatalf("tirage %d : %d paires angulairement adjacentes sur %d ont des rangs d'affinite consecutifs — "+
				"les grappes d'heritiers des branches voisines vont se rejoindre", nonce, consecutifs, len(parAngle))
		}
	}
}

// L'entrelacement doit rester une BIJECTION : chaque secteur occupe une fois
// et une seule. S'il ne l'etait pas, deux branches partageraient un secteur et
// leurs libelles se recouvriraient de facon garantie.
func TestLEntrelacementEstUneBijection(t *testing.T) {
	for n := 1; n <= 12; n++ {
		vus := make(map[int]int, n)
		for rang := range n {
			s := secteurEntrelace(rang, n)
			if s < 0 || s >= n {
				t.Fatalf("n=%d rang=%d : secteur %d hors de [0, %d[", n, rang, s, n)
			}
			vus[s]++
		}
		for s, k := range vus {
			if k != 1 {
				t.Errorf("n=%d : le secteur %d est attribue %d fois", n, s, k)
			}
		}
		if len(vus) != n {
			t.Errorf("n=%d : %d secteurs distincts attribues", n, len(vus))
		}
	}
	if got := secteurEntrelace(0, 0); got != 0 {
		t.Errorf("n=0 doit rendre 0 sans paniquer, rendu %d", got)
	}
}
