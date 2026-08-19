// apps/ramure-v2/internal/identite/identite_test.go
package identite

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestIdentiteRefuseUnParametreDURL : une requete portant ?utilisateur=x
// mais aucun X-Forwarded-User rend ("", false) — jamais "x". Le
// parametre d'URL n'est jamais lu par DepuisRequete.
func TestIdentiteRefuseUnParametreDURL(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/collection?utilisateur=x", nil)
	v, ok := DepuisRequete(r)
	if ok || v != "" {
		t.Fatalf("attendu (\"\", false), obtenu (%q, %v)", v, ok)
	}
}

// TestIdentiteRefuseUnCookieApplicatif : meme principe pour un cookie.
func TestIdentiteRefuseUnCookieApplicatif(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/collection", nil)
	r.AddCookie(&http.Cookie{Name: "utilisateur", Value: "x"})
	v, ok := DepuisRequete(r)
	if ok || v != "" {
		t.Fatalf("attendu (\"\", false), obtenu (%q, %v)", v, ok)
	}
}

// TestIdentiteLitLEnTeteXForwardedUser : la seule voie valide.
func TestIdentiteLitLEnTeteXForwardedUser(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/collection", nil)
	r.Header.Set("X-Forwarded-User", "a@exemple.fr")
	v, ok := DepuisRequete(r)
	if !ok || v != "a@exemple.fr" {
		t.Fatalf("attendu (\"a@exemple.fr\", true), obtenu (%q, %v)", v, ok)
	}
}

// TestIdentiteAbsenteRendErrSansIdentite : le message d'erreur associe.
func TestIdentiteAbsenteRendErrSansIdentite(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/collection", nil)
	if _, ok := DepuisRequete(r); ok {
		t.Fatal("attendu ok=false sans en-tete")
	}
	if ErrSansIdentite == nil || ErrSansIdentite.Error() == "" {
		t.Fatal("ErrSansIdentite doit porter un message")
	}
}
