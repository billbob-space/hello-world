// apps/ramure-v2/internal/source/musicbrainz_discographie_test.go
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

func TestDiscographieRattacheeAuMBIDDemande(t *testing.T) {
	const mbid = "b1392450-e572-4084-8c8b-fac1e8b8d21e"

	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("artist"); got != mbid {
			t.Errorf("artist demande = %q, attendu %q", got, mbid)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"release-groups":[
			{"id":"a1","title":"OK Computer","primary-type":"Album","secondary-types":[],"first-release-date":"1997-05-21"}
		]}`))
	})

	albums, err := m.Discographie(context.Background(), mbid, budget.Centre)
	if err != nil {
		t.Fatalf("Discographie : %v", err)
	}
	if len(albums) != 1 || albums[0].Titre != "OK Computer" {
		t.Fatalf("albums = %+v, attendu un seul album OK Computer", albums)
	}
}

func TestClassementParTypeUnSeulType(t *testing.T) {
	cas := []struct {
		nom         string
		primaire    string
		secondaires []string
		attendu     TypeSortie
	}{
		{"live prime", "Album", []string{"Live"}, Live},
		{"compilation prime", "Album", []string{"Compilation"}, Compilation},
		{"single format court", "Single", nil, FormatCourt},
		{"ep format court", "EP", nil, FormatCourt},
		{"album studio", "Album", nil, Studio},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			got := ClasserTypeSortie(c.primaire, c.secondaires)
			if got != c.attendu {
				t.Errorf("ClasserTypeSortie(%q, %v) = %q, attendu %q", c.primaire, c.secondaires, got, c.attendu)
			}
		})
	}
}

func TestAlbumSansNoteConserveUnOrdreStable(t *testing.T) {
	corps := []byte(`{"release-groups":[
		{"id":"a1","title":"Premier","primary-type":"Album","secondary-types":[]},
		{"id":"a2","title":"Second","primary-type":"Album","secondary-types":[]}
	]}`)

	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(corps)
	})

	albums1, err := m.Discographie(context.Background(), "mbid-1", budget.Centre)
	if err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	albums2, err := m.Discographie(context.Background(), "mbid-1", budget.Centre)
	if err != nil {
		t.Fatalf("second appel : %v", err)
	}
	if len(albums1) != 2 || len(albums2) != 2 {
		t.Fatalf("attendu deux albums aux deux appels, obtenu %d et %d", len(albums1), len(albums2))
	}
	if albums1[0].Titre != albums2[0].Titre || albums1[1].Titre != albums2[1].Titre {
		t.Fatalf("ordre instable : %v puis %v", albums1, albums2)
	}
	if albums1[0].Titre != "Premier" || albums1[1].Titre != "Second" {
		t.Fatalf("ordre = %v, attendu l'ordre de la source", albums1)
	}
}

func TestSeuilDeVotesEcarteLesNotesNonSignificatives(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"release-groups":[
			{"id":"a1","title":"Note faible","primary-type":"Album","secondary-types":[],"rating":{"votes-count":2,"value":5.0}},
			{"id":"a2","title":"Note significative","primary-type":"Album","secondary-types":[],"rating":{"votes-count":87,"value":4.55}}
		]}`))
	})

	albums, err := m.Discographie(context.Background(), "mbid-1", budget.Centre)
	if err != nil {
		t.Fatalf("Discographie : %v", err)
	}

	var faible, significatif Album
	for _, a := range albums {
		if a.Titre == "Note faible" {
			faible = a
		}
		if a.Titre == "Note significative" {
			significatif = a
		}
	}
	if faible.Votes != 0 || faible.Note != 0 {
		t.Errorf("album sous le seuil = %+v, attendu note et votes ignores", faible)
	}
	if significatif.Votes != 87 || significatif.Note != 4.55 {
		t.Errorf("album significatif = %+v, attendu note conservee", significatif)
	}
}

func TestUnAppelUnique(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"release-groups":[]}`))
	})

	if _, err := m.Discographie(context.Background(), "mbid-1", budget.Centre); err != nil {
		t.Fatalf("Discographie : %v", err)
	}
	if n := m.limiteur.Compte(budget.MusicBrainz); n != 1 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 1", n)
	}
}

// C'est la garantie que le deplacement d'Attendre a l'interieur de charger
// installe : un appel entierement servi par le cache ne doit pas consommer un
// billet du portillon de debit, sans quoi une fiche deja en cache se paie le
// meme temps d'attente qu'un appel reel (N-13).
func TestAppelServiParLeCacheNeConsommeAucunBilletDeDebit(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"release-groups":[]}`))
	})

	if _, err := m.Discographie(context.Background(), "mbid-1", budget.Centre); err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	if _, err := m.Discographie(context.Background(), "mbid-1", budget.Centre); err != nil {
		t.Fatalf("second appel (servi par le cache) : %v", err)
	}
	if n := m.limiteur.Compte(budget.MusicBrainz); n != 1 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 1 : le second appel est servi par le cache et ne doit consommer aucun billet", n)
	}
}

func TestPochetteRefuseLaPorteeEntourage(t *testing.T) {
	m, _ := nouveauMusicBrainzDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("aucune requete n'est attendue")
	})

	_, err := m.Pochette(context.Background(), "rg-1", budget.Entourage)
	if !errors.Is(err, budget.ErrPorteeInterdite) {
		t.Fatalf("err = %v, attendu ErrPorteeInterdite", err)
	}
}

func TestPochetteAbsenteNEstPasUnePanne(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	m := NouveauMusicBrainz(cache.Neuf(time.Now), budget.Neuf(), srv.Client(), "ramure-v2/1.0 ( https://ramure-v2.apps.billbob.ovh )")
	m.CoverArtBaseURL = srv.URL

	url, err := m.Pochette(context.Background(), "rg-1", budget.Centre)
	if err != nil {
		t.Fatalf("Pochette : %v, attendu nil", err)
	}
	if url != "" {
		t.Errorf("url = %q, attendu chaine vide", url)
	}
}
