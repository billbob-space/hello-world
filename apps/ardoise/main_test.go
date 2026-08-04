package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// La sonde ne touche ni la base ni le cache : routes(nil, nil) suffit.
func TestSante(t *testing.T) {
	r := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	routes(nil, nil).ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("healthz = %d, attendu 200", w.Code)
	}
}

// La page se sert sans base ni cache : ce sont des fichiers embarques.
func TestPageAccueil(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	routes(nil, nil).ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("/ = %d, attendu 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Ardoise") {
		t.Fatalf("/ ne contient pas 'Ardoise'")
	}
}

// La validation intervient avant tout appel a la base : refuser une ligne
// vide ne doit pas exiger de base ni de cache.
func TestEcritureVideRefuseeSansBase(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/lignes", strings.NewReader(`{"texte":""}`))
	w := httptest.NewRecorder()
	routes(nil, nil).ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", w.Code)
	}
}

func TestEcritureCorpsIllisible(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/lignes", strings.NewReader(`pas du json`))
	w := httptest.NewRecorder()
	routes(nil, nil).ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", w.Code)
	}
}
