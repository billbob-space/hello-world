// apps/ramure-v2/internal/api/mesure_wiring_test.go
// Verifie que les evenements sont reellement EMIS (N-09 : "les evenements
// necessaires au calcul des metriques sont emis"), pas seulement
// calculables en theorie par mesure.Agregat.
package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/collection"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

func routesDeTestMesure(t *testing.T, nomArtiste string, nbVoisins int) (http.Handler, *mesure.Agregat) {
	t.Helper()
	d := construireStackDeTest(t, nomArtiste, nbVoisins)

	ancienMesure, ancienneCollection := Mesure, Collection
	Mesure = mesure.Neuf(nil)
	Collection = collection.NouveauMemoryStore()
	t.Cleanup(func() { Mesure, Collection = ancienMesure, ancienneCollection })

	return Routes(d), Mesure
}

func requeteAvecSession(chemin, session string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, chemin, nil)
	if session != "" {
		r.Header.Set(EnTeteSession, session)
	}
	return r
}

// TestCentreEmetPlantationPuisPromotion : le premier appel (origine par
// defaut) compte une Plantation ; un second appel avec origine=promotion
// compte une Promotion — pas l'inverse.
func TestCentreEmetPlantationPuisPromotion(t *testing.T) {
	mux, agr := routesDeTestMesure(t, "Portishead", 3)

	mux.ServeHTTP(httptest.NewRecorder(), requeteAvecSession("/api/centre?nom=Portishead", "s1"))
	mux.ServeHTTP(httptest.NewRecorder(), requeteAvecSession("/api/centre?nom=Portishead&origine=promotion", "s1"))

	journal := agr.JournalDeSession("s1")
	corps := string(journal)
	if want := `"evenement":"plantation"`; !strings.Contains(corps, want) {
		t.Fatalf("plantation non emise : %s", corps)
	}
	if want := `"evenement":"promotion"`; !strings.Contains(corps, want) {
		t.Fatalf("promotion non emise : %s", corps)
	}
}

// TestCentreEmetAmorceCollectionEtAmorcePartage (M-06, M-07) : les deux
// amorcages distincts, uniquement sur une plantation.
func TestCentreEmetAmorceCollectionEtAmorcePartage(t *testing.T) {
	mux, agr := routesDeTestMesure(t, "Portishead", 3)

	mux.ServeHTTP(httptest.NewRecorder(), requeteAvecSession("/api/centre?nom=Portishead&amorce=collection", "s-collection"))
	mux.ServeHTTP(httptest.NewRecorder(), requeteAvecSession("/api/centre?nom=Portishead&amorce=partage", "s-partage"))

	instantane := agr.Instantane()
	if instantane["collectionReutilisee"].(float64) <= 0 {
		t.Fatalf("M-06 (collectionReutilisee) devrait etre > 0 : %v", instantane)
	}
	if instantane["partage"].(float64) <= 0 {
		t.Fatalf("M-07 (partage) devrait etre > 0 : %v", instantane)
	}
}

// TestEcouterEmetLienEcoute (M-03).
func TestEcouterEmetLienEcoute(t *testing.T) {
	mux, agr := routesDeTestMesure(t, "Portishead", 0)
	req := requeteAvecSession("/api/ecouter?artiste=Portishead&service=deezer", "s1")
	mux.ServeHTTP(httptest.NewRecorder(), req)

	corps := string(agr.JournalDeSession("s1"))
	if want := `"evenement":"lien_ecoute"`; !strings.Contains(corps, want) {
		t.Fatalf("lien_ecoute non emis : %s", corps)
	}
}

// TestAjouterUnSignetEmetSignet (M-04).
func TestAjouterUnSignetEmetSignet(t *testing.T) {
	mux, agr := routesDeTestMesure(t, "Portishead", 0)
	req := requetePUT("/api/collection", `{"nom":"Portishead","mbid":"m1"}`, "a@exemple.fr")
	req.Header.Set(EnTeteSession, "s1")
	mux.ServeHTTP(httptest.NewRecorder(), req)

	corps := string(agr.JournalDeSession("s1"))
	if want := `"evenement":"signet"`; !strings.Contains(corps, want) {
		t.Fatalf("signet non emis : %s", corps)
	}
}
