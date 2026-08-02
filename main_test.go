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
	return mux
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
