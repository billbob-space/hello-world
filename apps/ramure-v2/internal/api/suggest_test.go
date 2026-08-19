// apps/ramure-v2/internal/api/suggest_test.go
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type suggestionDeTest struct {
	Nom        string `json:"nom"`
	MBID       string `json:"mbid"`
	Correction bool   `json:"correction"`
}

func dependancesSuggestDeTest(t *testing.T, gestionnaire http.HandlerFunc) arbre.Dependances {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	mb := source.NouveauMusicBrainz(c, l, srv.Client(), "ramure-v2-test/1.0")
	mb.BaseURL = srv.URL
	return arbre.Dependances{Catalogue: mb, Proximite: &source.Cascade{}, Limiteur: l}
}

func TestSuggestRendLesCandidatsAuPlusHuit(t *testing.T) {
	d := dependancesSuggestDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100},{"id":"m2","name":"Portico Quartet","score":60}]}`)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/suggest?q=Port", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200, corps = %s", rec.Code, rec.Body.String())
	}
	var suggestions []suggestionDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("decodage : %v (corps = %s)", err, rec.Body.String())
	}
	if len(suggestions) != 2 {
		t.Fatalf("len = %d, attendu 2", len(suggestions))
	}
	if suggestions[0].Nom != "Portishead" || suggestions[0].MBID != "m1" {
		t.Errorf("premiere suggestion = %+v", suggestions[0])
	}
}

func TestSuggestQVideRendUneListeVide(t *testing.T) {
	d := dependancesSuggestDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("aucun appel reseau attendu pour q vide")
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/suggest?q=", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	var suggestions []suggestionDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(suggestions) != 0 {
		t.Fatalf("len = %d, attendu 0", len(suggestions))
	}
}

// TestSuggestSignaleUneCorrectionPlausibleSansSubstituer (F-03, §09) : une
// faute de frappe proche produit un candidat marque "correction", mais
// JAMAIS a la place du candidat exact demande — la substitution reste
// TOUJOURS affichee, jamais appliquee en silence.
func TestSuggestSignaleUneCorrectionPlausibleSansSubstituer(t *testing.T) {
	d := dependancesSuggestDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100}]}`)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/suggest?q=Portishaed", nil))

	var suggestions []suggestionDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(suggestions) != 1 {
		t.Fatalf("len = %d, attendu 1", len(suggestions))
	}
	if !suggestions[0].Correction {
		t.Errorf("correction = false, attendu true pour \"Portishaed\" -> \"Portishead\"")
	}
	if suggestions[0].Nom != "Portishead" {
		t.Errorf("nom = %q, attendu \"Portishead\" (jamais substitue, seulement signale)", suggestions[0].Nom)
	}
}

// TestSuggestNeMarqueAucuneCorrectionSurEcartTropGrand : au-dela des bornes
// de CorrectionPlausible, aucune correction n'est signalee (§09 : mieux
// vaut ne rien proposer qu'un artiste faux).
func TestSuggestNeMarqueAucuneCorrectionSurEcartTropGrand(t *testing.T) {
	d := dependancesSuggestDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Massive Attack","score":100}]}`)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/suggest?q=Portishead", nil))

	var suggestions []suggestionDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(suggestions) != 1 {
		t.Fatalf("len = %d, attendu 1", len(suggestions))
	}
	if suggestions[0].Correction {
		t.Errorf("correction = true, attendu false (ecart trop grand entre Portishead et Massive Attack)")
	}
}

func TestSuggestNeMarqueRienSurCorrespondanceExacte(t *testing.T) {
	d := dependancesSuggestDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100}]}`)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/suggest?q=Portishead", nil))

	var suggestions []suggestionDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if suggestions[0].Correction {
		t.Errorf("correction = true, attendu false : la saisie correspond deja exactement")
	}
}
