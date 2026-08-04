// Tests contre une base reelle — SAUTES si COMPTEUR_TEST_BASE_URL est absent.
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func baseDeTest(t *testing.T) *Base {
	t.Helper()
	url := os.Getenv("COMPTEUR_TEST_BASE_URL")
	if url == "" {
		t.Skip("COMPTEUR_TEST_BASE_URL absent")
	}
	base, err := NewBase(url)
	if err != nil {
		t.Fatalf("NewBase : %v", err)
	}
	t.Cleanup(base.Close)

	ctx, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	base.Migrer(ctx)
	if _, err := base.Lire(ctx); err != nil {
		t.Fatalf("base pas prete apres Migrer : %v", err)
	}
	return base
}

// A3 du PRD : une incrementation survit a la relecture, et est atomique.
func TestIncrementerEtRelire(t *testing.T) {
	base := baseDeTest(t)
	ctx := context.Background()

	avant, err := base.Lire(ctx)
	if err != nil {
		t.Fatalf("Lire avant : %v", err)
	}
	apres, err := base.Incrementer(ctx, "test@example.com")
	if err != nil {
		t.Fatalf("Incrementer : %v", err)
	}
	if apres.Valeur != avant.Valeur+1 {
		t.Fatalf("valeur = %d, attendu %d", apres.Valeur, avant.Valeur+1)
	}
	if apres.DernierPar != "test@example.com" {
		t.Fatalf("dernier_par = %q, attendu test@example.com", apres.DernierPar)
	}

	relue, err := base.Lire(ctx)
	if err != nil {
		t.Fatalf("Lire apres : %v", err)
	}
	if relue.Valeur != apres.Valeur {
		t.Fatalf("relecture = %d, attendu %d", relue.Valeur, apres.Valeur)
	}
}

// R1 en bout en bout via l'API : X-Forwarded-User est le seul auteur possible
// — la requete POST ne porte d'ailleurs aucun champ pour en forger un autre.
func TestEnTeteEstLAuteur(t *testing.T) {
	base := baseDeTest(t)
	cache := NewCache("127.0.0.1:1") // rien n'ecoute : R3
	t.Cleanup(func() { _ = cache.Close() })

	r := httptest.NewRequest("POST", "/api/compteur", nil)
	r.Header.Set("X-Forwarded-User", "vrai@example.com")
	w := httptest.NewRecorder()
	routes(base, cache).ServeHTTP(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("code = %d, corps = %s", w.Code, w.Body.String())
	}
	var got reponse
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if got.DernierPar != "vrai@example.com" {
		t.Fatalf("dernier_par = %q, attendu vrai@example.com", got.DernierPar)
	}
}

// A7 du PRD : la base indisponible AU DEMARRAGE n'empeche pas l'application
// de repondre.
func TestBaseIndisponibleNeCassePasLeDemarrage(t *testing.T) {
	base, err := NewBase("postgres://postgres@127.0.0.1:1/postgres")
	if err != nil {
		t.Fatalf("NewBase : %v", err)
	}
	t.Cleanup(base.Close)
	cache := NewCache("127.0.0.1:1")
	t.Cleanup(func() { _ = cache.Close() })

	h := routes(base, cache)

	rs := httptest.NewRequest("GET", "/healthz", nil)
	ws := httptest.NewRecorder()
	h.ServeHTTP(ws, rs)
	if ws.Code != http.StatusOK {
		t.Fatalf("healthz = %d, attendu 200 meme base injoignable", ws.Code)
	}

	rl := httptest.NewRequest("GET", "/api/compteur", nil)
	wl := httptest.NewRecorder()
	h.ServeHTTP(wl, rl)
	if wl.Code != http.StatusServiceUnavailable {
		t.Fatalf("/api/compteur = %d, attendu 503", wl.Code)
	}
}
