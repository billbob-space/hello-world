// apps/ramure-v2/internal/arbre/selection_test.go
package arbre

import (
	"math/rand"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// vivierDeTest construit n voisins d'affinite strictement decroissante, assez
// diversifiee pour que le tirage pondere ne degenere jamais en un choix
// unique.
func vivierDeTest(n int) []source.Voisin {
	vivier := make([]source.Voisin, n)
	for i := 0; i < n; i++ {
		vivier[i] = source.Voisin{
			Nom:      nomDeTest(i),
			MBID:     nomDeTest(i),
			Affinite: 1.0 - float64(i)*(0.9/float64(n)),
		}
	}
	return vivier
}

func nomDeTest(i int) string {
	const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	return string(lettres[i%len(lettres)]) + string(rune('0'+i/len(lettres)))
}

var cadrageDeTest = Cadrage{Branches: 10, Stables: 2, Heritiers: 3, VivierMin: 30}

func TestDeuxVisitesDonnentDesEntouragesDifferents(t *testing.T) {
	vivier := vivierDeTest(40)

	res1 := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(1)))
	res2 := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(2)))

	if ensemblesIdentiques(res1, res2) {
		t.Fatalf("deux graines differentes ont produit le meme entourage")
	}
}

func TestLesDeuxPremiersSontToujoursPresents(t *testing.T) {
	vivier := vivierDeTest(40)
	// les deux voisins de plus forte affinite, une fois vivier trie.
	premier, second := vivier[0].MBID, vivier[1].MBID

	for graine := int64(0); graine < 100; graine++ {
		res := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(graine)))
		if !contientMBID(res, premier) || !contientMBID(res, second) {
			t.Fatalf("graine %d : les deux voisins les plus affines sont absents de %v", graine, noms(res))
		}
	}
}

func TestMemeGraineMemeResultat(t *testing.T) {
	vivier := vivierDeTest(40)

	res1 := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(42)))
	res2 := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(42)))

	if !ensemblesIdentiques(res1, res2) || len(res1) != len(res2) {
		t.Fatalf("la meme graine a produit des resultats differents : %v puis %v", noms(res1), noms(res2))
	}
	for i := range res1 {
		if res1[i].MBID != res2[i].MBID {
			t.Fatalf("meme graine, ordre different a l'indice %d : %v puis %v", i, noms(res1), noms(res2))
		}
	}
}

func TestVivierPlusPetitQueLeCadrage(t *testing.T) {
	vivier := vivierDeTest(4)

	res := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(1)))

	if len(res) != 4 {
		t.Fatalf("len(res) = %d, attendu 4 (vivier plus petit que le cadrage)", len(res))
	}
	if aUnDoublon(res) {
		t.Fatalf("doublon dans %v", noms(res))
	}
}

func TestAucunDoublon(t *testing.T) {
	vivier := vivierDeTest(40)

	for graine := int64(0); graine < 1000; graine++ {
		res := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(graine)))
		if aUnDoublon(res) {
			t.Fatalf("graine %d : doublon dans %v", graine, noms(res))
		}
	}
}

func TestPonderationFavoriseLAffiniteForte(t *testing.T) {
	c := Cadrage{Branches: 3, Stables: 2, Heritiers: 0, VivierMin: 0}
	base := []source.Voisin{
		{Nom: "Stable1", MBID: "s1", Affinite: 1.0},
		{Nom: "Stable2", MBID: "s2", Affinite: 0.99},
		{Nom: "Fort", MBID: "fort", Affinite: 0.9},
		{Nom: "Faible", MBID: "faible", Affinite: 0.1},
	}

	var fortCompte, faibleCompte int
	const tirages = 10000
	for graine := int64(0); graine < tirages; graine++ {
		res := SelectionnerBranches(base, c, rand.New(rand.NewSource(graine)))
		if contientMBID(res, "fort") {
			fortCompte++
		}
		if contientMBID(res, "faible") {
			faibleCompte++
		}
	}

	if fortCompte <= faibleCompte {
		t.Fatalf("fort=%d, faible=%d : l'affinite forte devrait sortir strictement plus souvent", fortCompte, faibleCompte)
	}
}

func TestRebattreConserveLesStablesEtChangeLeReste(t *testing.T) {
	vivier := vivierDeTest(40)
	premier, second := vivier[0].MBID, vivier[1].MBID

	res1 := SelectionnerBranches(vivier, cadrageDeTest, rand.New(rand.NewSource(1)))
	res2 := Rebattre(vivier, cadrageDeTest, rand.New(rand.NewSource(99)))

	if !contientMBID(res2, premier) || !contientMBID(res2, second) {
		t.Fatalf("rebattre a perdu un stable : %v", noms(res2))
	}
	if ensemblesIdentiques(res1, res2) {
		t.Fatalf("rebattre a produit exactement le meme entourage")
	}
}

func TestElagageRetireUneBrancheInexploitable(t *testing.T) {
	branches := []Branche{
		{Voisin: source.Voisin{Nom: "Avec illustration"}, Illustration: source.Illustration{Grande: "https://img"}},
		{Voisin: source.Voisin{Nom: "Avec lien"}, LienDeezer: "https://deezer/x"},
		{Voisin: source.Voisin{Nom: "Sans rien"}},
	}

	res := Elaguer(branches, 1)

	if len(res) != 2 {
		t.Fatalf("len(res) = %d, attendu 2", len(res))
	}
	for _, b := range res {
		if b.Voisin.Nom == "Sans rien" {
			t.Fatalf("la branche inexploitable n'a pas ete retiree : %v", res)
		}
	}
}

func TestElagageRefuseDeDescendreSousLeMinimum(t *testing.T) {
	branches := []Branche{
		{Voisin: source.Voisin{Nom: "Exploitable"}, Illustration: source.Illustration{Grande: "https://img"}},
		{Voisin: source.Voisin{Nom: "Sans rien 1"}},
		{Voisin: source.Voisin{Nom: "Sans rien 2"}},
		{Voisin: source.Voisin{Nom: "Sans rien 3"}},
	}

	res := Elaguer(branches, 3)

	if len(res) != 4 {
		t.Fatalf("len(res) = %d, attendu 4 : rien ne doit etre elague sous le minimum", len(res))
	}
}

// --- aides de test ---

func noms(vivier []source.Voisin) []string {
	n := make([]string, len(vivier))
	for i, v := range vivier {
		n[i] = v.MBID
	}
	return n
}

func contientMBID(vivier []source.Voisin, mbid string) bool {
	for _, v := range vivier {
		if v.MBID == mbid {
			return true
		}
	}
	return false
}

func aUnDoublon(vivier []source.Voisin) bool {
	vu := map[string]bool{}
	for _, v := range vivier {
		if vu[v.MBID] {
			return true
		}
		vu[v.MBID] = true
	}
	return false
}

func ensemblesIdentiques(a, b []source.Voisin) bool {
	if len(a) != len(b) {
		return false
	}
	ensembleA := map[string]bool{}
	for _, v := range a {
		ensembleA[v.MBID] = true
	}
	for _, v := range b {
		if !ensembleA[v.MBID] {
			return false
		}
	}
	return true
}
