// apps/ramure-v2/internal/api/reglages_test.go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/collection"
)

func routesDeTestReglages(t *testing.T) http.Handler {
	t.Helper()
	ancienne := Reglages
	Reglages = collection.NouveauReglagesMemoire()
	t.Cleanup(func() { Reglages = ancienne })
	return Routes(dependancesDeTest())
}

// TestReglagesSansIdentiteRefuse401.
func TestReglagesSansIdentiteRefuse401(t *testing.T) {
	mux := routesDeTestReglages(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requeteGET("/api/reglages", ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("attendu 401, obtenu %d", rec.Code)
	}
}

// TestReglagesParDefautSansEcriturePrealable.
func TestReglagesParDefautSansEcriturePrealable(t *testing.T) {
	mux := routesDeTestReglages(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requeteGET("/api/reglages", "a@exemple.fr"))
	var corps struct {
		Service string `json:"service"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &corps)
	if corps.Service != collection.ServiceParDefaut {
		t.Fatalf("attendu %q par defaut, obtenu %q", collection.ServiceParDefaut, corps.Service)
	}
}

// TestReglageEcritParAEstRelusParAJamaisParB (F-25) : le choix suit
// l'identite, jamais les autres utilisateurs.
func TestReglageEcritParAEstRelusParAJamaisParB(t *testing.T) {
	mux := routesDeTestReglages(t)
	mux.ServeHTTP(httptest.NewRecorder(), requetePUT("/api/reglages", `{"service":"spotify"}`, "a@exemple.fr"))

	recA := httptest.NewRecorder()
	mux.ServeHTTP(recA, requeteGET("/api/reglages", "a@exemple.fr"))
	var corpsA struct {
		Service string `json:"service"`
	}
	_ = json.Unmarshal(recA.Body.Bytes(), &corpsA)
	if corpsA.Service != "spotify" {
		t.Fatalf("a@exemple.fr devrait relire spotify, obtenu %q", corpsA.Service)
	}

	recB := httptest.NewRecorder()
	mux.ServeHTTP(recB, requeteGET("/api/reglages", "b@exemple.fr"))
	var corpsB struct {
		Service string `json:"service"`
	}
	_ = json.Unmarshal(recB.Body.Bytes(), &corpsB)
	if corpsB.Service != collection.ServiceParDefaut {
		t.Fatalf("CLOISONNEMENT ROMPU : b@exemple.fr obtient %q au lieu du defaut", corpsB.Service)
	}
}

// TestEcrireUnServiceInconnuRefuseRienDeCasse : le serveur accepte
// l'ecriture (elle n'est pas malformee), mais la relecture retombe sur le
// defaut — jamais un lien vide.
func TestEcrireUnServiceInconnuRefuseRienDeCasse(t *testing.T) {
	mux := routesDeTestReglages(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requetePUT("/api/reglages", `{"service":"napster"}`, "a@exemple.fr"))
	if rec.Code != http.StatusOK {
		t.Fatalf("attendu 200, obtenu %d : %s", rec.Code, rec.Body)
	}
	var corps struct {
		Service string `json:"service"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &corps)
	if corps.Service != collection.ServiceParDefaut {
		t.Fatalf("un service inconnu doit retomber sur le defaut, obtenu %q", corps.Service)
	}
}

// TestEcrireSansCorpsRefuse400.
func TestEcrireSansCorpsRefuse400(t *testing.T) {
	mux := routesDeTestReglages(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requetePUT("/api/reglages", `{}`, "a@exemple.fr"))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("attendu 400, obtenu %d", rec.Code)
	}
}
