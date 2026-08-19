// apps/ramure-v2/internal/source/correspondance_test.go
package source

import "testing"

type candidat struct {
	nom  string
	mbid string
}

func nomDuCandidat(c candidat) string { return c.nom }

// §09 : « renvoyer un resultat vide plutot que le premier candidat
// approchant ». MusicBrainz repond « Kate Bush » avec un score de 100 a une
// requete « Bush » : le score de la source ne suffit jamais.
func TestPasDeCorrespondanceApprochante(t *testing.T) {
	candidats := []candidat{
		{"Kate Bush", "4b585938-f271-45e2-b19a-91c634b5e396"},
		{"Bush Tetras", "a2b1a4c9-5e3f-4d76-9b2c-1f0c2b3d4e5f"},
	}

	c, ok := CorrespondanceStricte("Bush", candidats, nomDuCandidat)

	if ok {
		t.Fatalf("candidat approchant accepte (%+v) : contamination par homonyme", c)
	}
	if c.nom != "" || c.mbid != "" {
		t.Fatalf("c = %+v, attendu la valeur nulle du type", c)
	}
}

func TestCorrespondanceExacteAcceptee(t *testing.T) {
	candidats := []candidat{
		{"Kate Bush", "4b585938-f271-45e2-b19a-91c634b5e396"},
		{"Bush", "24f1766e-9635-4d58-a4d4-9413f9f98a4c"},
		{"Bush Tetras", "a2b1a4c9-5e3f-4d76-9b2c-1f0c2b3d4e5f"},
	}

	c, ok := CorrespondanceStricte("bush", candidats, nomDuCandidat)

	if !ok {
		t.Fatal("la correspondance exacte doit etre acceptee")
	}
	if c.nom != "Bush" {
		t.Fatalf("nom = %q, attendu \"Bush\"", c.nom)
	}
	if c.mbid != "24f1766e-9635-4d58-a4d4-9413f9f98a4c" {
		t.Fatalf("mbid = %q : le candidat rendu n'est pas le bon", c.mbid)
	}
}

func TestCorrespondanceInsensibleAuxAccents(t *testing.T) {
	candidats := []candidat{{"Sigur Rós", "f4a31f0a-51dd-4fa7-986d-3095c40c5ed9"}}

	c, ok := CorrespondanceStricte("sigur ros", candidats, nomDuCandidat)

	if !ok {
		t.Fatal("la variante sans accent doit correspondre")
	}
	if c.mbid != "f4a31f0a-51dd-4fa7-986d-3095c40c5ed9" {
		t.Fatalf("mbid = %q", c.mbid)
	}
}

func TestCorrespondanceSurListeOuDemandeVide(t *testing.T) {
	if _, ok := CorrespondanceStricte("Portishead", []candidat{}, nomDuCandidat); ok {
		t.Error("liste vide : aucune correspondance possible")
	}
	if _, ok := CorrespondanceStricte("", []candidat{{"Portishead", "x"}}, nomDuCandidat); ok {
		t.Error("demande vide : aucune correspondance possible")
	}
	// « !!! » se normalise en chaine vide : refuse, comme une demande vide.
	if _, ok := CorrespondanceStricte("!!!", []candidat{{"!!!", "x"}}, nomDuCandidat); ok {
		t.Error("nom entierement ponctue : refuse plutot qu'apparie au hasard")
	}
}

// La regle sert plusieurs types de la serie : voisins Last.fm, fiches Deezer,
// candidats MusicBrainz. Aucun ne doit reecrire — donc pouvoir assouplir — la
// comparaison.
func TestCorrespondanceStricteEstGenerique(t *testing.T) {
	type voisin struct {
		Nom      string
		Affinite float64
	}
	vivier := []voisin{{"Massive Attack", 0.91}, {"Tricky", 0.87}}

	v, ok := CorrespondanceStricte("tricky", vivier, func(v voisin) string { return v.Nom })

	if !ok {
		t.Fatal("correspondance attendue")
	}
	if v.Affinite != 0.87 {
		t.Fatalf("affinite = %v, attendu 0.87", v.Affinite)
	}
}
