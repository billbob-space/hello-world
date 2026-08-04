package main

import (
	"net/http/httptest"
	"testing"
)

func TestAuteurEnTete(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/compteur", nil)
	r.Header.Set("X-Forwarded-User", "quelqu'un@example.com")
	if got := Auteur(r); got != "quelqu'un@example.com" {
		t.Fatalf("Auteur() = %q, attendu quelqu'un@example.com", got)
	}
}

func TestAuteurAbsentHorsTraefik(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/compteur", nil)
	if got := Auteur(r); got != "anonyme@local" {
		t.Fatalf("Auteur() = %q, attendu anonyme@local", got)
	}
}
