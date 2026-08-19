// apps/ramure-v2/internal/source/lastfm_test.go
package source

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

func nouveauLastFMDeTest(t *testing.T, cle string, gestionnaire http.HandlerFunc) (*LastFM, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	l := NouveauLastFM(cle, cache.Neuf(time.Now), budget.Neuf(), srv.Client())
	l.BaseURL = srv.URL
	return l, srv
}

func TestVivierRenvoieAffiniteEntreZeroEtUn(t *testing.T) {
	l, _ := nouveauLastFMDeTest(t, "cle-test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"similarartists":{"artist":[
			{"name":"Radiohead","mbid":"a1","match":"1"},
			{"name":"Massive Attack","mbid":"a2","match":"0.732"},
			{"name":"Tricky","mbid":"a3","match":"0"}
		]}}`))
	})

	voisins, err := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre)
	if err != nil {
		t.Fatalf("Vivier : %v", err)
	}
	if len(voisins) != 3 {
		t.Fatalf("voisins = %d, attendu 3", len(voisins))
	}
	for _, v := range voisins {
		if v.Affinite < 0 || v.Affinite > 1 {
			t.Errorf("affinite = %v hors bornes [0,1] pour %q", v.Affinite, v.Nom)
		}
	}
}

func TestVivierTrieParAffiniteDecroissante(t *testing.T) {
	l, _ := nouveauLastFMDeTest(t, "cle-test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"similarartists":{"artist":[
			{"name":"Bas","mbid":"a1","match":"0.1"},
			{"name":"Haut","mbid":"a2","match":"0.9"},
			{"name":"Moyen","mbid":"a3","match":"0.5"}
		]}}`))
	})

	voisins, err := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre)
	if err != nil {
		t.Fatalf("Vivier : %v", err)
	}
	for i := 1; i < len(voisins); i++ {
		if voisins[i-1].Affinite < voisins[i].Affinite {
			t.Fatalf("ordre non decroissant : %v", voisins)
		}
	}
}

func TestSansCleRenvoieErrCleAbsente(t *testing.T) {
	var appels int
	l, _ := nouveauLastFMDeTest(t, "", func(w http.ResponseWriter, r *http.Request) {
		appels++
		w.Write([]byte(`{}`))
	})

	_, err := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre)
	if !errors.Is(err, ErrCleAbsente) {
		t.Fatalf("err = %v, attendu ErrCleAbsente", err)
	}
	if appels != 0 {
		t.Fatalf("appels = %d, attendu 0", appels)
	}
}

func TestErreur29NonMiseEnCache(t *testing.T) {
	var appels int
	l, _ := nouveauLastFMDeTest(t, "cle-test", func(w http.ResponseWriter, r *http.Request) {
		appels++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"error":29,"message":"Rate limit exceeded"}`))
	})

	_, err1 := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre)
	if err1 == nil {
		t.Fatal("premier appel : attendu une erreur")
	}
	_, err2 := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre)
	if err2 == nil {
		t.Fatal("second appel : attendu une erreur (pas de mise en cache)")
	}
	if appels != 2 {
		t.Fatalf("appels = %d, attendu 2 (erreur 29 non mise en cache)", appels)
	}
}

func TestAutocorrectDesactive(t *testing.T) {
	l, _ := nouveauLastFMDeTest(t, "cle-test", func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("autocorrect"); got != "0" {
			t.Errorf("autocorrect = %q, attendu \"0\"", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"similarartists":{"artist":[]}}`))
	})

	if _, err := l.Vivier(context.Background(), Artiste{Nom: "Portishead"}, budget.Centre); err != nil {
		t.Fatalf("Vivier : %v", err)
	}
}
