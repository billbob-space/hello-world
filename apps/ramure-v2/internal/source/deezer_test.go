// apps/ramure-v2/internal/source/deezer_test.go
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

func nouveauDeezerDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*Deezer, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	d := NouveauDeezer(cache.Neuf(time.Now), budget.Neuf(), srv.Client())
	d.BaseURL = srv.URL
	return d, srv
}

func TestChercherRefuseUnNomApprochant(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"id":1,"name":"Kate Bush"}]}`))
	})

	_, err := d.Chercher(context.Background(), "Bush", budget.Centre)
	if !errors.Is(err, ErrIntrouvable) {
		t.Fatalf("err = %v, attendu ErrIntrouvable", err)
	}
}

func TestExtraitsIgnorentLesPistesSansPreview(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[
			{"title":"Avec preview","preview":"https://cdn/x.mp3","duration":30},
			{"title":"Sans preview","preview":"","duration":30}
		]}`))
	})

	extraits, err := d.Extraits(context.Background(), 42, budget.Centre)
	if err != nil {
		t.Fatalf("Extraits : %v", err)
	}
	if len(extraits) != 1 || extraits[0].Titre != "Avec preview" {
		t.Fatalf("extraits = %+v, attendu un seul, avec preview", extraits)
	}
}

func TestChercherAutoriseEnEntourage(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"id":1,"name":"Portishead"}]}`))
	})

	_, err := d.Chercher(context.Background(), "Portishead", budget.Entourage)
	if errors.Is(err, budget.ErrPorteeInterdite) {
		t.Fatalf("err = %v, ErrPorteeInterdite inattendu en entourage", err)
	}
	if err != nil {
		t.Fatalf("Chercher : %v", err)
	}
}

func TestAucunExtraitRenvoieListeVideSansErreur(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[]}`))
	})

	extraits, err := d.Extraits(context.Background(), 42, budget.Centre)
	if err != nil {
		t.Fatalf("Extraits : %v, attendu nil", err)
	}
	if len(extraits) != 0 {
		t.Fatalf("extraits = %v, attendu vide", extraits)
	}
}
