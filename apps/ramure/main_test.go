package main

import "testing"

// env est ce qui rend baseDeezer et baseLastfm configurables par variable
// d'environnement (deezer.go, lastfm.go) — c'est donc ce qui protege le comp-
// ortement en production : un defaut mal applique romprait le demarrage sans
// aucune cle fournie (N-13).
func TestEnv(t *testing.T) {
	t.Run("variable presente : elle prime", func(t *testing.T) {
		t.Setenv("RAMURE_TEST_CLE", "valeur")
		if got := env("RAMURE_TEST_CLE", "defaut"); got != "valeur" {
			t.Errorf("env() = %q, attendu %q", got, "valeur")
		}
	})

	t.Run("variable absente : le defaut est rendu", func(t *testing.T) {
		if got := env("RAMURE_TEST_CLE_ABSENTE", "defaut"); got != "defaut" {
			t.Errorf("env() = %q, attendu %q", got, "defaut")
		}
	})

	t.Run("variable vide : traitee comme absente", func(t *testing.T) {
		t.Setenv("RAMURE_TEST_CLE_VIDE", "")
		if got := env("RAMURE_TEST_CLE_VIDE", "defaut"); got != "defaut" {
			t.Errorf("env() = %q, attendu %q", got, "defaut")
		}
	})

	t.Run("espaces en trop : retires", func(t *testing.T) {
		t.Setenv("RAMURE_TEST_CLE_ESPACES", "  valeur  ")
		if got := env("RAMURE_TEST_CLE_ESPACES", "defaut"); got != "valeur" {
			t.Errorf("env() = %q, attendu %q", got, "valeur")
		}
	})
}

func TestPort(t *testing.T) {
	t.Run("PORT absent : 8080 par defaut", func(t *testing.T) {
		if got := port(); got != "8080" {
			t.Errorf("port() = %q, attendu %q", got, "8080")
		}
	})

	t.Run("PORT fourni : il prime", func(t *testing.T) {
		t.Setenv("PORT", "9999")
		if got := port(); got != "9999" {
			t.Errorf("port() = %q, attendu %q", got, "9999")
		}
	})
}
