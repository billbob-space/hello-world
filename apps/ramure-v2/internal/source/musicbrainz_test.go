// apps/ramure-v2/internal/source/musicbrainz_test.go
package source

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

func nouveauMusicBrainzDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*MusicBrainz, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	m := NouveauMusicBrainz(cache.Neuf(time.Now), budget.Neuf(), srv.Client(), "ramure-v2/1.0 ( https://ramure-v2.apps.billbob.ovh )")
	m.BaseURL = srv.URL
	return m, srv
}

func TestResoudreRenvoieLeMBIDSurCorrespondanceExacte(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"artists":[{"id":"8f6bd1f9-…","name":"Portishead","score":100}]}`))
	})

	a, err := m.Resoudre(context.Background(), "Portishead", budget.Centre)
	if err != nil {
		t.Fatalf("Resoudre : %v", err)
	}
	if a.MBID != "8f6bd1f9-…" {
		t.Errorf("MBID = %q, attendu 8f6bd1f9-…", a.MBID)
	}
}

func TestResoudreRefuseUnCandidatApprochant(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"artists":[{"id":"abc","name":"Kate Bush","score":100}]}`))
	})

	_, err := m.Resoudre(context.Background(), "Bush", budget.Centre)
	if !errors.Is(err, ErrIntrouvable) {
		t.Fatalf("err = %v, attendu ErrIntrouvable", err)
	}
}

func TestResoudreEnvoieUnUserAgent(t *testing.T) {
	var recu string
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		recu = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"artists":[{"id":"abc","name":"Portishead","score":100}]}`))
	})

	if _, err := m.Resoudre(context.Background(), "Portishead", budget.Centre); err != nil {
		t.Fatalf("Resoudre : %v", err)
	}
	if recu == "" {
		t.Fatal("User-Agent vide")
	}
	if !strings.Contains(recu, "ramure-v2") {
		t.Errorf("User-Agent = %q, attendu qu'il contienne ramure-v2", recu)
	}
}

func TestResoudreRefuseLaPorteeEntourage(t *testing.T) {
	var appels int32
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&appels, 1)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"artists":[]}`))
	})

	_, err := m.Resoudre(context.Background(), "Portishead", budget.Entourage)
	if !errors.Is(err, budget.ErrPorteeInterdite) {
		t.Fatalf("err = %v, attendu ErrPorteeInterdite", err)
	}
	if n := atomic.LoadInt32(&appels); n != 0 {
		t.Fatalf("appels = %d, attendu 0", n)
	}
}

func TestResoudreNeMetPasEnCacheUne500(t *testing.T) {
	var appels int32
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&appels, 1)
		if n == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"artists":[{"id":"abc","name":"Portishead","score":100}]}`))
	})

	_, err := m.Resoudre(context.Background(), "Portishead", budget.Centre)
	if err == nil {
		t.Fatal("premier appel : attendu une erreur (500), obtenu nil")
	}

	a, err := m.Resoudre(context.Background(), "Portishead", budget.Centre)
	if err != nil {
		t.Fatalf("second appel : %v", err)
	}
	if a.MBID != "abc" {
		t.Errorf("MBID = %q, attendu abc", a.MBID)
	}
}
