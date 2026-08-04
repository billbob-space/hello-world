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

func TestPageAccueil(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	routes(nil, nil).ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("/ = %d, attendu 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Compteur") {
		t.Fatalf("/ ne contient pas 'Compteur'")
	}
}
