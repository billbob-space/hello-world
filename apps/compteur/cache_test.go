// Tests contre un redis reel — SAUTES si COMPTEUR_TEST_REDIS_ADDR (et la
// base) sont absents.
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func pileDeTest(t *testing.T) (*Base, *Cache) {
	t.Helper()
	burl := os.Getenv("COMPTEUR_TEST_BASE_URL")
	raddr := os.Getenv("COMPTEUR_TEST_REDIS_ADDR")
	if burl == "" || raddr == "" {
		t.Skip("COMPTEUR_TEST_BASE_URL ou COMPTEUR_TEST_REDIS_ADDR absent")
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
	cache.Invalider(ctx)

	return base, cache
}

func lireViaHandler(t *testing.T, h http.Handler) reponse {
	t.Helper()
	r := httptest.NewRequest("GET", "/api/compteur", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("lecture : code = %d", w.Code)
	}
	var out reponse
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	return out
}

func incrementerViaHandler(t *testing.T, h http.Handler) {
	t.Helper()
	r := httptest.NewRequest("POST", "/api/compteur", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("incrementation : code = %d, corps = %s", w.Code, w.Body.String())
	}
}

// Premiere lecture (cache invalide) -> base, deuxieme consecutive -> cache.
func TestPremiereLectureBaseDeuxiemeCache(t *testing.T) {
	base, cache := pileDeTest(t)
	h := routes(base, cache)
	incrementerViaHandler(t, h)

	r1 := lireViaHandler(t, h)
	if r1.Provenance != "base" {
		t.Fatalf("premiere lecture : provenance = %q, attendu base", r1.Provenance)
	}
	r2 := lireViaHandler(t, h)
	if r2.Provenance != "cache" {
		t.Fatalf("deuxieme lecture : provenance = %q, attendu cache", r2.Provenance)
	}
}

// R2 : une incrementation invalide le cache.
func TestIncrementerInvalideLeCache(t *testing.T) {
	base, cache := pileDeTest(t)
	h := routes(base, cache)

	lireViaHandler(t, h) // peuple le cache
	if r := lireViaHandler(t, h); r.Provenance != "cache" {
		t.Fatalf("avant incrementation : provenance = %q, attendu cache", r.Provenance)
	}
	incrementerViaHandler(t, h)
	if r := lireViaHandler(t, h); r.Provenance != "base" {
		t.Fatalf("apres incrementation : provenance = %q, attendu base (R2)", r.Provenance)
	}
}

// R3 : un cache injoignable ne casse rien.
func TestCacheInjoignableSertLaBase(t *testing.T) {
	base := baseDeTest(t)
	cache := NewCache("127.0.0.1:1")
	t.Cleanup(func() { _ = cache.Close() })

	h := routes(base, cache)
	r := lireViaHandler(t, h)
	if r.Provenance != "base" {
		t.Fatalf("cache injoignable : provenance = %q, attendu base (R3)", r.Provenance)
	}
}

// A5 du PRD, le critere central de ce run : compteur et ardoise partagent le
// MEME redis (needs: [redis] sur les deux, sans redeclarer le service). Ce
// test ecrit sous la cle d'ardoise (ardoise:lignes) A COTE de la cle de
// compteur (compteur:valeur) et verifie qu'aucune des deux n'efface l'autre —
// la preuve que le prefixe par app protege reellement le partage.
func TestNeSeMarchePasSurArdoise(t *testing.T) {
	_, cache := pileDeTest(t)
	ctx := context.Background()

	cleArdoise := "ardoise:lignes"
	valeurArdoise := `[{"auteur":"voisin@example.com","texte":"je n'ai rien a voir avec compteur"}]`
	if err := cache.rdb.Set(ctx, cleArdoise, valeurArdoise, 30*time.Second).Err(); err != nil {
		t.Fatalf("ecriture de la cle voisine : %v", err)
	}

	cache.Ecrire(ctx, Compteur{Valeur: 42, DernierPar: "moi@example.com"})

	relu, ok := cache.Lire(ctx)
	if !ok || relu.Valeur != 42 {
		t.Fatalf("compteur:valeur corrompue par la cle voisine : ok=%v valeur=%d", ok, relu.Valeur)
	}
	v, err := cache.rdb.Get(ctx, cleArdoise).Result()
	if err != nil || v != valeurArdoise {
		if err == redis.Nil {
			t.Fatalf("ardoise:lignes a disparu apres une ecriture de compteur:valeur")
		}
		t.Fatalf("ardoise:lignes alteree : err=%v v=%q", err, v)
	}
}
