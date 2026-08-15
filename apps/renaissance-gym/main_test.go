package main

import (
	"io/fs"
	"net/http"
	"strings"
	"testing"
)

func newServeurSansMagasin(t *testing.T) http.Handler {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	return routes(web, nil)
}

func TestSanteRepond200(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("corps %q, attendu \"ok\"", rec.Body.String())
	}
}

func TestRacineSertLaCoque(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type %q, attendu text/html", ct)
	}
	if !strings.Contains(rec.Body.String(), `src="/app.js"`) {
		t.Error("la coque ne charge pas le module d'amorcage")
	}
	// La coque doit prendre la main au rechargement suivant un deploiement.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control de / = %q, attendu no-cache", cc)
	}
}

func TestStyleServiDepuisLaRacine(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/style.css")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/css") {
		t.Errorf("Content-Type %q, attendu text/css", ct)
	}
}

func TestPoliceServieAvecUnCacheLong(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/archivo.woff2")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "font/woff2" {
		t.Errorf("Content-Type %q, attendu font/woff2", ct)
	}
	cc := rec.Header().Get("Cache-Control")
	if !strings.Contains(cc, "max-age=31536000") {
		t.Errorf("Cache-Control de la police = %q, attendu un cache long", cc)
	}
}

// A12 : un manifeste servi en octet-stream fait refuser l'installation par
// certains navigateurs.
func TestManifesteServiAvecLeBonTypeMIME(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/manifest.webmanifest")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/manifest+json") {
		t.Errorf("Content-Type %q, attendu application/manifest+json", ct)
	}
}

// A12 : un cache long sur sw.js figerait le service worker lui-meme, et plus
// rien ne se mettrait jamais a jour ensuite, corrections comprises.
func TestServiceWorkerJamaisServiAvecUnCacheLong(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/sw.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if cc := rec.Header().Get("Cache-Control"); strings.Contains(cc, "max-age=31536000") || strings.Contains(cc, "immutable") {
		t.Errorf("Cache-Control de sw.js = %q, un cache long figerait le service worker", cc)
	}
}

func TestProgrammeJSONEstServi(t *testing.T) {
	rec := get(t, newServeurSansMagasin(t), "/programme.json")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type %q, attendu application/json", ct)
	}
}

// TestLesTestsNeSontPasServis : go:embed n'emporte que web/, jamais tests/.
func TestLesTestsNeSontPasServis(t *testing.T) {
	if code := get(t, newServeurSansMagasin(t), "/tests/domaine.test.js").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404 : tests/ n'a rien a faire dans l'image", code)
	}
}

func TestCheminInconnuRepond404DepuisMain(t *testing.T) {
	if code := get(t, newServeurSansMagasin(t), "/ailleurs-encore").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404", code)
	}
}

func TestEnv(t *testing.T) {
	if v := env("VARIABLE_ABSENTE_DU_TEST", "defaut"); v != "defaut" {
		t.Errorf("env sur une variable absente = %q, attendu \"defaut\"", v)
	}
	t.Setenv("VARIABLE_PRESENTE_DU_TEST", "valeur")
	if v := env("VARIABLE_PRESENTE_DU_TEST", "defaut"); v != "valeur" {
		t.Errorf("env sur une variable presente = %q, attendu \"valeur\"", v)
	}
}
