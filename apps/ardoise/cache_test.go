// Tests contre un redis reel — SAUTES si ARDOISE_TEST_REDIS_ADDR (et la base,
// necessaire pour peupler une lecture) sont absents.
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

func pileDeTest(t *testing.T) (*Base, *Cache) {
	t.Helper()
	burl := os.Getenv("ARDOISE_TEST_BASE_URL")
	raddr := os.Getenv("ARDOISE_TEST_REDIS_ADDR")
	if burl == "" || raddr == "" {
		t.Skip("ARDOISE_TEST_BASE_URL ou ARDOISE_TEST_REDIS_ADDR absent")
	}
	base, err := NewBase(burl)
	if err != nil {
		t.Fatalf("NewBase : %v", err)
	}
	t.Cleanup(base.Close)

	ctx, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	base.Migrer(ctx)

	cache := NewCache(raddr)
	t.Cleanup(func() { _ = cache.Close() })
	cache.Invalider(ctx) // etat propre entre deux executions de la suite

	return base, cache
}

func ecrire(t *testing.T, h http.Handler, texte string) {
	t.Helper()
	r := httptest.NewRequest("POST", "/api/lignes", strings.NewReader(`{"texte":"`+texte+`"}`))
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("ecriture : code = %d, corps = %s", w.Code, w.Body.String())
	}
}

func lireViaHandler(t *testing.T, h http.Handler) reponseLignes {
	t.Helper()
	r := httptest.NewRequest("GET", "/api/lignes", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("lecture : code = %d", w.Code)
	}
	var out reponseLignes
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	return out
}

// §5 du PRD : la premiere lecture (cache invalide) vient de la base, la
// deuxieme consecutive vient du cache.
func TestPremiereLectureBaseDeuxiemeCache(t *testing.T) {
	base, cache := pileDeTest(t)
	h := routes(base, cache)
	ecrire(t, h, "de la base au cache")

	r1 := lireViaHandler(t, h)
	if r1.Provenance != "base" {
		t.Fatalf("premiere lecture : provenance = %q, attendu base", r1.Provenance)
	}
	r2 := lireViaHandler(t, h)
	if r2.Provenance != "cache" {
		t.Fatalf("deuxieme lecture : provenance = %q, attendu cache", r2.Provenance)
	}
}

// R4 : une ecriture invalide le cache.
func TestEcritureInvalideLeCache(t *testing.T) {
	base, cache := pileDeTest(t)
	h := routes(base, cache)

	lireViaHandler(t, h) // peuple le cache
	if r := lireViaHandler(t, h); r.Provenance != "cache" {
		t.Fatalf("avant ecriture : provenance = %q, attendu cache", r.Provenance)
	}

	ecrire(t, h, "cette ligne invalide le cache")
	if r := lireViaHandler(t, h); r.Provenance != "base" {
		t.Fatalf("apres ecriture : provenance = %q, attendu base (R4)", r.Provenance)
	}
}

// R5, le critere central du PRP 03 : un cache injoignable ne casse rien, la
// lecture est servie par la base.
func TestCacheInjoignableSertLaBase(t *testing.T) {
	base := baseDeTest(t)
	cache := NewCache("127.0.0.1:1") // rien n'ecoute
	t.Cleanup(func() { _ = cache.Close() })

	h := routes(base, cache)
	r := lireViaHandler(t, h)
	if r.Provenance != "base" {
		t.Fatalf("cache injoignable : provenance = %q, attendu base (R5)", r.Provenance)
	}
}
