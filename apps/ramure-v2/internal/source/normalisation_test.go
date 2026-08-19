// apps/ramure-v2/internal/source/normalisation_test.go
package source

import "testing"

func TestNormalisationIgnoreCasseAccentsEtPonctuation(t *testing.T) {
	cas := []struct {
		entree, attendu string
	}{
		{"Sigur Rós", "sigur ros"},
		{"MÚM", "mum"},
		{"Godspeed You! Black Emperor", "godspeed you black emperor"},
		{"  Air   ", "air"},
		{"Anne-Marie", "anne marie"},
		{"Motörhead", "motorhead"},
		{"Beyoncé", "beyonce"},
		{"AC/DC", "ac dc"},
		{"Sum 41", "sum 41"},
		{"portishead", "portishead"},
		{"", ""},
		// Un nom entierement ponctue se normalise en chaine vide : le groupe
		// « !!! » n'est pas resoluble par correspondance stricte. Limitation
		// assumee, connue, et testee plutot que decouverte en production.
		{"!!!", ""},
	}

	for _, c := range cas {
		if got := Normaliser(c.entree); got != c.attendu {
			t.Errorf("Normaliser(%q) = %q, attendu %q", c.entree, got, c.attendu)
		}
	}
}
