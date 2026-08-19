// apps/ramure-v2/internal/source/cascade_test.go
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

func nouveauListenBrainzDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*ListenBrainz, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	b := NouveauListenBrainz(cache.Neuf(time.Now), budget.Neuf(), srv.Client())
	b.BaseURL = srv.URL
	return b, srv
}

func TestNormalisationDuScoreBrut(t *testing.T) {
	b, _ := nouveauListenBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[
			{"artist_mbid":"m1","name":"Un","score":11156},
			{"artist_mbid":"m2","name":"Deux","score":5578},
			{"artist_mbid":"m3","name":"Trois","score":0}
		]`))
	})

	voisins, err := b.Vivier(context.Background(), Artiste{MBID: "mbid-source"}, budget.Entourage)
	if err != nil {
		t.Fatalf("Vivier : %v", err)
	}
	if len(voisins) != 3 {
		t.Fatalf("voisins = %d, attendu 3", len(voisins))
	}
	attendu := map[string]float64{"Un": 1.0, "Deux": 0.5, "Trois": 0.0}
	for _, v := range voisins {
		want := attendu[v.Nom]
		if diff := v.Affinite - want; diff > 1e-9 || diff < -1e-9 {
			t.Errorf("affinite(%q) = %v, attendu %v", v.Nom, v.Affinite, want)
		}
	}
}

// proximiteBouchon simule une source de la cascade pour les tests 2 a 4, sans
// aucun reseau.
type proximiteBouchon struct {
	voisins []Voisin
	err     error
}

func (p proximiteBouchon) Vivier(ctx context.Context, a Artiste, portee budget.Portee) ([]Voisin, error) {
	return p.voisins, p.err
}

func TestCascadeBasculeSurErreur(t *testing.T) {
	c := Cascade{Sources: []Proximite{
		proximiteBouchon{err: ErrCleAbsente},
		proximiteBouchon{voisins: []Voisin{{Nom: "Repli", Affinite: 0.5}}},
	}}

	voisins, err := c.Vivier(context.Background(), Artiste{Nom: "X", MBID: "m"}, budget.Centre)
	if err != nil {
		t.Fatalf("Vivier : %v", err)
	}
	if len(voisins) != 1 || voisins[0].Nom != "Repli" {
		t.Fatalf("voisins = %v, attendu le vivier de la seconde source", voisins)
	}
}

func TestCascadeNeMasquePasUnVivierVide(t *testing.T) {
	appelSecond := false
	c := Cascade{Sources: []Proximite{
		proximiteBouchon{voisins: []Voisin{}},
		proximiteBouchonAvecCompteur{&appelSecond},
	}}

	voisins, err := c.Vivier(context.Background(), Artiste{Nom: "X", MBID: "m"}, budget.Centre)
	if err != nil {
		t.Fatalf("Vivier : %v", err)
	}
	if len(voisins) != 0 {
		t.Fatalf("voisins = %v, attendu vide", voisins)
	}
	if appelSecond {
		t.Fatal("la seconde source ne devait pas etre appelee : un vivier vide n'est pas une erreur")
	}
}

type proximiteBouchonAvecCompteur struct {
	appele *bool
}

func (p proximiteBouchonAvecCompteur) Vivier(ctx context.Context, a Artiste, portee budget.Portee) ([]Voisin, error) {
	*p.appele = true
	return []Voisin{{Nom: "Ne devrait pas apparaitre"}}, nil
}

func TestCascadeEpuiseeRemonteLaDerniereErreur(t *testing.T) {
	errFinale := errors.New("panne finale")
	c := Cascade{Sources: []Proximite{
		proximiteBouchon{err: ErrCleAbsente},
		proximiteBouchon{err: errFinale},
	}}

	_, err := c.Vivier(context.Background(), Artiste{Nom: "X", MBID: "m"}, budget.Centre)
	if !errors.Is(err, errFinale) {
		t.Fatalf("err = %v, attendu %v", err, errFinale)
	}
}

func TestSansMBIDListenBrainzNeSortPasSurLeReseau(t *testing.T) {
	var appels int
	b, _ := nouveauListenBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		appels++
	})

	_, err := b.Vivier(context.Background(), Artiste{Nom: "Sans MBID"}, budget.Centre)
	if !errors.Is(err, ErrIntrouvable) {
		t.Fatalf("err = %v, attendu ErrIntrouvable", err)
	}
	if appels != 0 {
		t.Fatalf("appels = %d, attendu 0", appels)
	}
}
