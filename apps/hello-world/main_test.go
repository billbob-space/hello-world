package main

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newMux(t *testing.T) http.Handler {
	t.Helper()
	page, err := template.ParseFS(assets, "page.html")
	if err != nil {
		t.Fatalf("modele illisible : %v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /{$}", handleHome(page))
	return withVersion(mux)
}

func get(t *testing.T, h http.Handler, path string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealthzRepond200(t *testing.T) {
	rec := get(t, newMux(t), "/healthz", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != "ok" {
		t.Fatalf("corps = %q, attendu \"ok\"", got)
	}
}

func TestAccueilAfficheUtilisateurTransmis(t *testing.T) {
	rec := get(t, newMux(t), "/", map[string]string{userHeader: "amuteau@gmail.com"})
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "amuteau@gmail.com") {
		t.Fatal("la page ne contient pas l'utilisateur de X-Forwarded-User")
	}
}

func TestAccueilSansEnTeteResteLisible(t *testing.T) {
	rec := get(t, newMux(t), "/", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "inconnu") {
		t.Fatal("sans X-Forwarded-User, la page devrait afficher \"inconnu\"")
	}
}

// La version affichee est ce qui permet de constater qu'un deploiement a
// remplace la precedente : si elle disparait de la page, la validation d'un
// deploiement devient impossible.
func TestAccueilAfficheLaVersion(t *testing.T) {
	origine := version
	version = "abcdef1234567890"
	defer func() { version = origine }()

	rec := get(t, newMux(t), "/", nil)
	corps := rec.Body.String()
	if !strings.Contains(corps, ">abcdef1<") {
		t.Fatal("la page n'affiche pas la version raccourcie")
	}
	if !strings.Contains(corps, `title="abcdef1234567890"`) {
		t.Fatal("la version complete devrait rester accessible en infobulle")
	}
}

// Verifier un deploiement ne doit pas obliger a ouvrir la page : l'en-tete
// porte la version sur toutes les reponses, healthcheck compris.
func TestEnTeteDeVersionSurToutesLesReponses(t *testing.T) {
	origine := version
	version = "abcdef1234567890"
	defer func() { version = origine }()

	mux := newMux(t)
	for _, chemin := range []string{"/", "/healthz"} {
		rec := get(t, mux, chemin, nil)
		if got := rec.Header().Get("X-App-Version"); got != version {
			t.Fatalf("%s : X-App-Version = %q, attendu %q", chemin, got, version)
		}
	}
}

// L'identite arrive dans du HTML : une adresse forgee ne doit pas pouvoir
// injecter de balise dans la page servie aux autres.
func TestIdentiteEchappeeDansLeHTML(t *testing.T) {
	rec := get(t, newMux(t), "/", map[string]string{userHeader: `<script>alert(1)</script>`})
	if strings.Contains(rec.Body.String(), "<script>alert(1)</script>") {
		t.Fatal("l'identite est injectee telle quelle dans la page")
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	rec := get(t, newMux(t), "/nexiste-pas", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("code = %d, attendu 404", rec.Code)
	}
}

// Un pattern enregistre par methode (ex: "GET /healthz") fait repondre le
// ServeMux 405 pour toute autre methode sur ce meme chemin, automatiquement.
func TestMethodePostSurHealthzRepond405(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	rec := httptest.NewRecorder()
	newMux(t).ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("code = %d, attendu 405", rec.Code)
	}
}
