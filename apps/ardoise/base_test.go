// Tests contre une base reelle — SAUTES si ARDOISE_TEST_BASE_URL est absent.
// test.sh doit rester vert sans infrastructure : la CI ne lance que lui.
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func baseDeTest(t *testing.T) *Base {
	t.Helper()
	url := os.Getenv("ARDOISE_TEST_BASE_URL")
	if url == "" {
		t.Skip("ARDOISE_TEST_BASE_URL absent")
	}
	base, err := NewBase(url)
	if err != nil {
		t.Fatalf("NewBase : %v", err)
	}
	t.Cleanup(base.Close)

	ctx, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	base.Migrer(ctx)
	if _, err := base.Dernieres(ctx, 1); err != nil {
		t.Fatalf("base pas prete apres Migrer : %v", err)
	}
	return base
}

// A3 du PRD, le critere central du PRP 02 : une ligne ecrite se relit.
func TestEcritureRelecture(t *testing.T) {
	base := baseDeTest(t)
	ctx := context.Background()

	ecrite, err := base.Ajouter(ctx, "test@example.com", "premiere ligne d'ardoise")
	if err != nil {
		t.Fatalf("Ajouter : %v", err)
	}

	lignes, err := base.Dernieres(ctx, 50)
	if err != nil {
		t.Fatalf("Dernieres : %v", err)
	}
	var trouvee bool
	for _, l := range lignes {
		if l.Texte == ecrite.Texte && l.Auteur == ecrite.Auteur {
			trouvee = true
		}
	}
	if !trouvee {
		t.Fatalf("la ligne ecrite n'a pas ete relue parmi %d lignes", len(lignes))
	}
}

// R3 en bout en bout via l'API : X-Forwarded-User gagne sur un auteur forge
// dans le corps de la requete. Redis pointe vers un port fermé — le cache
// n'intervient pas dans ce test, seule la base compte.
func TestEnTeteGagneSurLeCorps(t *testing.T) {
	base := baseDeTest(t)
	cache := NewCache("127.0.0.1:1") // rien n'ecoute : lectures/ecritures ignorees (R5)
	t.Cleanup(func() { _ = cache.Close() })

	corps := `{"texte":"qui a ecrit ceci ?","auteur":"faux@usurpateur.example"}`
	r := httptest.NewRequest("POST", "/api/lignes", strings.NewReader(corps))
	r.Header.Set("X-Forwarded-User", "vrai@example.com")
	w := httptest.NewRecorder()
	routes(base, cache).ServeHTTP(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("code = %d, corps = %s", w.Code, w.Body.String())
	}
	var got Ligne
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if got.Auteur != "vrai@example.com" {
		t.Fatalf("auteur = %q, l'en-tete doit gagner sur le corps", got.Auteur)
	}
}

// A7 du PRD : la base indisponible AU DEMARRAGE n'empeche pas l'application
// de repondre — /healthz reste 200, /api/lignes repond 503 sans paniquer.
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

	rl := httptest.NewRequest("GET", "/api/lignes", nil)
	wl := httptest.NewRecorder()
	h.ServeHTTP(wl, rl)
	if wl.Code != http.StatusServiceUnavailable {
		t.Fatalf("/api/lignes = %d, attendu 503 (base injoignable, pas un plantage)", wl.Code)
	}
}
