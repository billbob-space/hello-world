package main

import "testing"

// Les tests de ce fichier couvrent le risque le plus grave du PRD (§14) :
// "homonymes d'artistes — un mauvais appariement contamine tout un sous-arbre
// sans aucun signal d'erreur".
//
// Ils sont nommes d'apres le SYMPTOME que l'utilisateur observerait, comme
// l'exige la regle de recette de la §13 : "chaque anomalie corrigee donne lieu
// a un test qui l'aurait detectee, nomme d'apres le symptome observe par
// l'utilisateur. La suite de tests devient ainsi une liste lisible de
// regressions interdites."

func TestUnAccentNeDoitPasEmpecherDeTrouverLArtiste(t *testing.T) {
	cas := [][2]string{
		{"Sigur Ros", "Sigur Rós"},
		{"Bjork", "Björk"},
		{"Beyonce", "Beyoncé"},
		{"Motorhead", "Motörhead"},
		{"Caetano Veloso", "Caetano Veloso"},
	}
	for _, c := range cas {
		if !memeNom(c[0], c[1]) {
			t.Errorf("memeNom(%q, %q) = false, l'artiste serait introuvable", c[0], c[1])
		}
	}
}

func TestLaCasseEtLaPonctuationNeDoiventPasEmpecherDeTrouverLArtiste(t *testing.T) {
	cas := [][2]string{
		{"the beatles", "The Beatles"},
		{"AC/DC", "AC DC"},
		{"Godspeed You! Black Emperor", "Godspeed You Black Emperor"},
		{"  Portishead  ", "Portishead"},
		{"Sun Ra", "SUN RA"},
	}
	for _, c := range cas {
		if !memeNom(c[0], c[1]) {
			t.Errorf("memeNom(%q, %q) = false, l'artiste serait introuvable", c[0], c[1])
		}
	}
}

// Le symptome que ce test interdit : l'utilisateur demande "Nirvana" et voit
// s'afficher la discographie de "Nirvana UK", sans aucun signal d'erreur.
func TestUnHomonymeNeDoitJamaisEtreServiALaPlaceDeLArtisteDemande(t *testing.T) {
	cas := [][2]string{
		{"Nirvana", "Nirvana UK"},
		{"Air", "Air Supply"},
		{"Portishead", "Portishead Tribute Band"},
		{"Can", "Canned Heat"},
		{"Yes", "Yesterday"},
		{"The Fall", "The Fall of Troy"},
	}
	for _, c := range cas {
		if memeNom(c[0], c[1]) {
			t.Errorf("memeNom(%q, %q) = true : un sous-arbre entier serait construit sur le mauvais artiste", c[0], c[1])
		}
	}
}

func TestUnNomVideNeDoitJamaisApparierQuoiQueCeSoit(t *testing.T) {
	if memeNom("", "") {
		t.Error("deux noms vides s'apparient : une recherche vide planterait un artiste au hasard")
	}
	if memeNom("!!!", "???") {
		// Les deux se normalisent en chaine vide.
		t.Error("deux noms sans lettre s'apparient")
	}
}

func TestUneFauteDeFrappeDoitEtreRattrapee(t *testing.T) {
	candidats := []string{"Portishead", "Massive Attack", "Tricky"}

	cas := [][2]string{
		{"Portishaed", "Portishead"},
		{"Massiv Attack", "Massive Attack"},
		{"portished", "Portishead"},
	}
	for _, c := range cas {
		if got := meilleureCorrection(c[0], candidats); got != c[1] {
			t.Errorf("meilleureCorrection(%q) = %q, veut %q : l'utilisateur devrait retaper", c[0], got, c[1])
		}
	}
}

// Le symptome interdit : l'utilisateur tape "Air" et le produit lui plante
// "Hair" sans le prevenir. La §09 l'exige — "le rattrapage orthographique ne
// doit jamais substituer un artiste a un autre".
func TestUnNomCourtNeDoitJamaisEtreCorrigeVersUnAutreArtiste(t *testing.T) {
	cas := []struct {
		saisi     string
		candidats []string
	}{
		{"Air", []string{"Hair", "Fair", "Airs"}},
		{"Nas", []string{"Nash", "Naas", "Gas"}},
		{"Can", []string{"Man", "Cane", "Cant"}},
		{"Yes", []string{"Yves", "Yen"}},
	}
	for _, c := range cas {
		if got := meilleureCorrection(c.saisi, c.candidats); got != "" {
			t.Errorf("meilleureCorrection(%q) = %q : un artiste a ete substitue a un autre", c.saisi, got)
		}
	}
}

// Le doute vaut refus : deux candidats a egalite de distance ne permettent pas
// de choisir, donc on ne choisit pas.
func TestUneCorrectionAmbigueDoitEtreRefusee(t *testing.T) {
	// "Portishesd" est a distance 1 de deux candidats fabriques exprès.
	got := meilleureCorrection("Portishesd", []string{"Portishead", "Portishesq"})
	if got != "" {
		t.Errorf("meilleureCorrection = %q, veut \"\" : en cas de doute, aucune correction", got)
	}
}

func TestUneCorrectionTropEloigneeDoitEtreRefusee(t *testing.T) {
	if got := meilleureCorrection("Portishead", []string{"Radiohead"}); got != "" {
		t.Errorf("meilleureCorrection = %q : Radiohead n'est pas une faute de frappe de Portishead", got)
	}
}

func TestLaBorneDeCorrectionCroitAvecLaLongueur(t *testing.T) {
	cas := []struct {
		nom  string
		veut int
	}{
		{"Air", 0},
		{"Nas", 0},
		{"Tricky", 1},
		{"Portishead", 2},
		{"Godspeed You Black Emperor", 3},
	}
	for _, c := range cas {
		if got := ecartTolere(c.nom); got != c.veut {
			t.Errorf("ecartTolere(%q) = %d, veut %d", c.nom, got, c.veut)
		}
	}
}

func TestLaDistanceDEditionEstCorrecte(t *testing.T) {
	cas := []struct {
		a, b string
		veut int
	}{
		{"", "", 0},
		{"", "abc", 3},
		{"abc", "", 3},
		{"abc", "abc", 0},
		{"abc", "abd", 1},
		{"chat", "chats", 1},
		{"portishead", "portishaed", 2},
	}
	for _, c := range cas {
		if got := distance(c.a, c.b); got != c.veut {
			t.Errorf("distance(%q, %q) = %d, veut %d", c.a, c.b, got, c.veut)
		}
	}
}

func TestLaNormalisationEstStable(t *testing.T) {
	// Normaliser deux fois doit donner le meme resultat : sans cette propriete,
	// une cle de cache construite sur un nom normalise pourrait differer d'un
	// appel a l'autre.
	for _, nom := range []string{"Sigur Rós", "AC/DC", "  The   Fall  ", "Björk", "Anna Ternheim"} {
		une := normalise(nom)
		deux := normalise(une)
		if une != deux {
			t.Errorf("normalise(%q) = %q puis %q : la cle de cache serait instable", nom, une, deux)
		}
	}
}
