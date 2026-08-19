// apps/ramure-v2/internal/api/routes_test.go
package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// init pose une page d'accueil de test : AccueilHTML n'est jamais vide en
// production (main.go l'embarque avant de servir), et les tests de "/"
// verifient son contenu.
func init() {
	AccueilHTML = []byte(`<!DOCTYPE html><html lang="fr"><head><title>RAMURE</title></head><body>RAMURE</body></html>`)
}

// dependancesDeTest construit des dependances qui ne touchent jamais le
// reseau : suffisant pour les routes qui n'appellent pas /api/centre.
func dependancesDeTest() arbre.Dependances {
	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	client := &http.Client{}
	return arbre.Dependances{
		Catalogue: source.NouveauMusicBrainz(c, l, client, "ramure-v2-test/1.0"),
		Proximite: &source.Cascade{},
		Media:     source.NouveauDeezer(c, l, client),
		Limiteur:  l,
	}
}

func appeler(t *testing.T, methode, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	Routes(dependancesDeTest()).ServeHTTP(rec, httptest.NewRequest(methode, chemin, nil))
	return rec
}

func TestHealthzRepond200(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if corps := strings.TrimSpace(rec.Body.String()); corps != "ok" {
		t.Errorf("corps = %q, attendu \"ok\"", corps)
	}
}

func TestHealthzEstDuTexteBrut(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("Content-Type = %q, attendu \"text/plain; charset=utf-8\"", ct)
	}
}

func TestRacineSertLaPageDAccueil(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type = %q, attendu \"text/html; charset=utf-8\"", ct)
	}

	corps := rec.Body.String()
	if !strings.Contains(corps, `lang="fr"`) {
		t.Errorf("la page ne declare pas lang=\"fr\"")
	}
	if !strings.Contains(corps, "RAMURE") {
		t.Errorf("la page ne se nomme pas")
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/chemin-qui-nexiste-pas")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("code = %d pour un chemin inconnu, attendu 404", rec.Code)
	}
}

func TestVersionParDefaut(t *testing.T) {
	if Version != "dev" {
		t.Fatalf("Version = %q, attendu \"dev\" hors construction CI", Version)
	}
}

// Servi=sw.js/manifest.webmanifest (PRP 08, installation et mise a jour) :
// aucune route ajoutee (mux.Handle("GET /dist/", ...) existe deja depuis
// PRP 05), seuls des en-tetes supplementaires sur deux chemins precis.

func TestDistSwJsPorteServiceWorkerAllowed(t *testing.T) {
	precedent := Dist
	Dist = fstest.MapFS{"sw.js": &fstest.MapFile{Data: []byte("// sw")}}
	defer func() { Dist = precedent }()

	rec := appeler(t, http.MethodGet, "/dist/sw.js")

	if v := rec.Header().Get("Service-Worker-Allowed"); v != "/" {
		t.Errorf("Service-Worker-Allowed = %q, attendu \"/\" (sans quoi le worker ne peut pas controler \"/\", N-11)", v)
	}
	if v := rec.Header().Get("Cache-Control"); v != "no-cache" {
		t.Errorf("Cache-Control = %q, attendu \"no-cache\" (defense contre un worker mal cadre qui sert une version perimee)", v)
	}
}

func TestDistAutreFichierNePorteRienDeSwJs(t *testing.T) {
	precedent := Dist
	Dist = fstest.MapFS{"app.js": &fstest.MapFile{Data: []byte("// app")}}
	defer func() { Dist = precedent }()

	rec := appeler(t, http.MethodGet, "/dist/app.js")

	if v := rec.Header().Get("Service-Worker-Allowed"); v != "" {
		t.Errorf("Service-Worker-Allowed = %q sur /dist/app.js, attendu absent", v)
	}
}

func TestDistManifestPorteLeBonContentType(t *testing.T) {
	precedent := Dist
	Dist = fstest.MapFS{"manifest.webmanifest": &fstest.MapFile{Data: []byte(`{"name":"RAMURE"}`)}}
	defer func() { Dist = precedent }()

	rec := appeler(t, http.MethodGet, "/dist/manifest.webmanifest")

	if v := rec.Header().Get("Content-Type"); v != "application/manifest+json" {
		t.Errorf("Content-Type = %q, attendu \"application/manifest+json\" (\".webmanifest\" n'est pas reconnu par mime.TypeByExtension, Go sniffe sinon \"text/plain\")", v)
	}
}

func TestChaqueReponsePorteLaVersion(t *testing.T) {
	precedente := Version
	Version = "essai-42"
	defer func() { Version = precedente }()

	for _, chemin := range []string{"/", "/healthz", "/chemin-qui-nexiste-pas"} {
		rec := appeler(t, http.MethodGet, chemin)
		if v := rec.Header().Get("X-Ramure-Version"); v != "essai-42" {
			t.Errorf("%s : X-Ramure-Version = %q, attendu \"essai-42\"", chemin, v)
		}
	}
}
