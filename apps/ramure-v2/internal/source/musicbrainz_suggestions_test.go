// apps/ramure-v2/internal/source/musicbrainz_suggestions_test.go
// Suggerer (F-01, F-02, F-03) : contrairement a Resoudre, aucune
// correspondance stricte n'est appliquee — plusieurs candidats sont rendus,
// au plus 8, dans l'ordre de pertinence de MusicBrainz.
package source

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
)

func TestSuggererRendPlusieursCandidatsSansCorrespondanceStricte(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100},{"id":"m2","name":"Portishead (tribute)","score":80}]}`)
	})

	suggestions, err := m.Suggerer(context.Background(), "Portis", budget.Centre)
	if err != nil {
		t.Fatalf("Suggerer : %v", err)
	}
	if len(suggestions) != 2 {
		t.Fatalf("len = %d, attendu 2 (aucun filtrage strict)", len(suggestions))
	}
	if suggestions[0].Nom != "Portishead" || suggestions[0].MBID != "m1" {
		t.Errorf("premier candidat = %+v", suggestions[0])
	}
}

func TestSuggererPlafonneAHuit(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var artistes []string
		for i := 0; i < 20; i++ {
			artistes = append(artistes, fmt.Sprintf(`{"id":"m%02d","name":"Artiste%02d","score":100}`, i, i))
		}
		fmt.Fprintf(w, `{"artists":[%s]}`, strings.Join(artistes, ","))
	})

	suggestions, err := m.Suggerer(context.Background(), "Art", budget.Centre)
	if err != nil {
		t.Fatalf("Suggerer : %v", err)
	}
	if len(suggestions) != 8 {
		t.Fatalf("len = %d, attendu 8 au plus", len(suggestions))
	}
}

func TestSuggererMetEnCacheEtNAppelleQuUneFoisLeReseau(t *testing.T) {
	var appels int32
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&appels, 1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100}]}`)
	})

	if _, err := m.Suggerer(context.Background(), "Portishead", budget.Centre); err != nil {
		t.Fatalf("premier Suggerer : %v", err)
	}
	if _, err := m.Suggerer(context.Background(), "Portishead", budget.Centre); err != nil {
		t.Fatalf("second Suggerer : %v", err)
	}
	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Errorf("appels reseau = %d, attendu 1 (mise en cache, N-04)", n)
	}
}

func TestSuggererIgnoreLesNomsVides(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"","score":10},{"id":"m2","name":"Portishead","score":100}]}`)
	})

	suggestions, err := m.Suggerer(context.Background(), "Port", budget.Centre)
	if err != nil {
		t.Fatalf("Suggerer : %v", err)
	}
	if len(suggestions) != 1 {
		t.Fatalf("len = %d, attendu 1 (le nom vide est ignore)", len(suggestions))
	}
}
