// apps/ramure-v2/internal/api/ecouter_test.go
// GET /api/ecouter : seul point d'entree qui appelle Odesli.LienEcoute,
// strictement au clic (PRP 03 tache 6, PRP 06 tache 3, F-25, F-26).
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type lienEcouteDeTest struct {
	Lien string `json:"lien"`
}

func dependancesEcouterDeTest(t *testing.T, odesliH http.HandlerFunc) (arbre.Dependances, *budget.Limiteur) {
	t.Helper()
	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	srv := httptest.NewServer(odesliH)
	t.Cleanup(srv.Close)
	od := source.NouveauOdesli(c, l, srv.Client())
	od.BaseURL = srv.URL
	return arbre.Dependances{Odesli: od, Limiteur: l}, l
}

func requeteEcouter(artiste, album, service, urlDeezer string) *http.Request {
	q := url.Values{}
	q.Set("artiste", artiste)
	if album != "" {
		q.Set("album", album)
	}
	if service != "" {
		q.Set("service", service)
	}
	if urlDeezer != "" {
		q.Set("urlDeezer", urlDeezer)
	}
	return httptest.NewRequest(http.MethodGet, "/api/ecouter?"+q.Encode(), nil)
}

// TestClicSurUnLienDEcouteResoutLeLienPrecis (F-25) : avec un urlDeezer
// connu et Odesli disponible, la route rend la resolution EXACTE renvoyee
// par Odesli, pas le repli de recherche.
func TestClicSurUnLienDEcouteResoutLeLienPrecis(t *testing.T) {
	d, l := dependancesEcouterDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"linksByPlatform":{"spotify":{"url":"https://open.spotify.com/album/xyz"}}}`))
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, requeteEcouter("Portishead", "Dummy", "spotify", "https://deezer.com/album/1"))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200, corps = %s", rec.Code, rec.Body.String())
	}
	var reponse lienEcouteDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
		t.Fatalf("decodage : %v (corps = %s)", err, rec.Body.String())
	}
	if reponse.Lien != "https://open.spotify.com/album/xyz" {
		t.Fatalf("lien = %q, attendu la resolution precise d'Odesli", reponse.Lien)
	}
	if got := l.Compte(budget.Odesli); got != 1 {
		t.Errorf("Compte(Odesli) = %d, attendu 1 (un clic = un appel)", got)
	}
}

// TestOdesliEnPanneRendLaRecherchePreRemplieJamaisUnePageVide (F-26) : une
// panne d'Odesli ne remonte jamais comme erreur HTTP, et le lien rendu
// n'est jamais vide — c'est toujours la recherche pre-remplie du service
// demande.
func TestOdesliEnPanneRendLaRecherchePreRemplieJamaisUnePageVide(t *testing.T) {
	d, _ := dependancesEcouterDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, requeteEcouter("Portishead", "", "tidal", "https://deezer.com/album/1"))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200 (le repli n'est pas une erreur HTTP)", rec.Code)
	}
	var reponse lienEcouteDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Lien == "" {
		t.Fatal("lien vide : F-26 interdit une page vide")
	}
	attendu := source.RecherchePreRemplie(source.ServiceTidal, "Portishead")
	if reponse.Lien != attendu {
		t.Fatalf("lien = %q, attendu la recherche pre-remplie %q", reponse.Lien, attendu)
	}
}

// TestChangerDeServiceChangeLeLienResolu (F-25) : le meme urlDeezer, deux
// services differents, deux liens differents — le service choisi gouverne
// la resolution precise, pas seulement le repli.
func TestChangerDeServiceChangeLeLienResolu(t *testing.T) {
	d, _ := dependancesEcouterDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"linksByPlatform":{
			"spotify":{"url":"https://open.spotify.com/album/xyz"},
			"tidal":{"url":"https://tidal.com/album/xyz"}
		}}`))
	})
	const urlDeezer = "https://deezer.com/album/1"

	recSpotify := httptest.NewRecorder()
	Routes(d).ServeHTTP(recSpotify, requeteEcouter("Portishead", "", "spotify", urlDeezer))
	var spotify lienEcouteDeTest
	_ = json.Unmarshal(recSpotify.Body.Bytes(), &spotify)

	recTidal := httptest.NewRecorder()
	Routes(d).ServeHTTP(recTidal, requeteEcouter("Portishead", "", "tidal", urlDeezer))
	var tidal lienEcouteDeTest
	_ = json.Unmarshal(recTidal.Body.Bytes(), &tidal)

	if spotify.Lien == tidal.Lien {
		t.Errorf("le lien ne change pas selon le service : %q", spotify.Lien)
	}
	if spotify.Lien != "https://open.spotify.com/album/xyz" || tidal.Lien != "https://tidal.com/album/xyz" {
		t.Fatalf("resolutions inattendues : spotify=%q tidal=%q", spotify.Lien, tidal.Lien)
	}
}

// TestEcouterArtisteVideEstUneErreurDeRequete garde le meme contrat que
// /api/fiche : un parametre requis absent est un 400, pas un repli silencieux.
func TestEcouterArtisteVideEstUneErreurDeRequete(t *testing.T) {
	d, _ := dependancesEcouterDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("Odesli ne doit pas etre appele sur une requete invalide")
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, requeteEcouter("", "", "deezer", ""))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", rec.Code)
	}
}

// TestEcouterSansUrlDeezerRendLeRepliSansAppelReseau (N-03, F-26) : sans
// urlDeezer connu (cas des albums de la discographie), LienEcoute ne part
// jamais sur le reseau — Odesli.LienEcoute le garantit deja (source/odesli.go),
// ce test le verifie a l'echelle de la route.
func TestEcouterSansUrlDeezerRendLeRepliSansAppelReseau(t *testing.T) {
	d, l := dependancesEcouterDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("Odesli ne doit pas etre appele sans urlDeezer")
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, requeteEcouter("Portishead", "Dummy", "deezer", ""))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	var reponse lienEcouteDeTest
	_ = json.Unmarshal(rec.Body.Bytes(), &reponse)
	if reponse.Lien == "" {
		t.Fatal("lien vide")
	}
	if got := l.Compte(budget.Odesli); got != 0 {
		t.Errorf("Compte(Odesli) = %d, attendu 0 (aucun urlDeezer, aucun appel)", got)
	}
}
