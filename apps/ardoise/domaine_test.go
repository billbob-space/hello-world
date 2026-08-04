package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValiderTexte(t *testing.T) {
	cas := []struct {
		nom, entree string
		ok          bool
	}{
		{"vide", "", false},
		{"espaces seuls", "   \t  ", false},
		{"normal", "bonjour la fabrique", true},
		{"140 caracteres", strings.Repeat("a", 140), true},
		{"141 caracteres", strings.Repeat("a", 141), false},
		{"espaces de bord retires avant comptage", "  " + strings.Repeat("a", 140) + "  ", true},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			_, err := ValiderTexte(c.entree)
			if (err == nil) != c.ok {
				t.Fatalf("ValiderTexte(%q) erreur=%v, attendu ok=%v", c.entree, err, c.ok)
			}
		})
	}
}

func TestValiderTexteNettoie(t *testing.T) {
	got, err := ValiderTexte("  bonjour  ")
	if err != nil {
		t.Fatalf("erreur inattendue : %v", err)
	}
	if got != "bonjour" {
		t.Fatalf("ValiderTexte a garde les espaces de bord : %q", got)
	}
}

// R3 : X-Forwarded-User, reecrit par Traefik a chaque requete, est la SEULE
// source d'identite admissible.
func TestAuteurEnTete(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/lignes", nil)
	r.Header.Set("X-Forwarded-User", "quelqu'un@example.com")
	if got := Auteur(r); got != "quelqu'un@example.com" {
		t.Fatalf("Auteur() = %q, attendu quelqu'un@example.com", got)
	}
}

func TestAuteurAbsentHorsTraefik(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/lignes", nil)
	if got := Auteur(r); got != "anonyme@local" {
		t.Fatalf("Auteur() = %q, attendu anonyme@local (une valeur qui se voit)", got)
	}
}
