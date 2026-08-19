// apps/ramure-v2/internal/source/correction_test.go
package source

import "testing"

func TestCorrectionPlausibleBornee(t *testing.T) {
	cas := []struct {
		demande, propose string
		attendu          bool
		pourquoi         string
	}{
		{"portished", "Portishead", true, "une lettre manquante sur un nom de 9"},
		{"radiohaed", "Radiohead", true, "deux lettres interverties sur un nom de 9"},
		{"boards of canada", "Boards of Canada", true, "casse seule"},
		{"sigur ros", "Sigur Rós", true, "accents seuls"},
		{"the beatles", "The Beetles", true, "une lettre sur un nom de 11"},
		{"muse", "Motorhead", false, "artiste different, pas une faute de frappe"},
		{"air", "Hair", false, "nom court : un caractere d'ecart change l'artiste"},
		{"u2", "U21", false, "nom tres court : aucune correction possible"},
		{"kate bush", "Bush", false, "cinq caracteres d'ecart : autre artiste"},
		{"godspeed you black emperor", "godspeed you black emperorxyz", false,
			"trois caracteres d'ecart : refuse malgre la longueur"},
		{"", "Portishead", false, "demande vide"},
		{"Portishead", "", false, "proposition vide"},
	}

	for _, c := range cas {
		if got := CorrectionPlausible(c.demande, c.propose); got != c.attendu {
			t.Errorf("CorrectionPlausible(%q, %q) = %v, attendu %v (%s)",
				c.demande, c.propose, got, c.attendu, c.pourquoi)
		}
	}
}
