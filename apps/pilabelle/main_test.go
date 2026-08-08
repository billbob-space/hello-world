package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSante(t *testing.T) {
	r := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("healthz = %d, attendu 200", w.Code)
	}
}

func TestIdentiteExigeeSurAPI(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("sans X-Forwarded-User: %d, attendu 400", w.Code)
	}
}

func TestPageAttente(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("/ = %d, attendu 200", w.Code)
	}
	if v := w.Header().Get("X-App-Version"); v == "" {
		t.Fatalf("X-App-Version absent")
	}
}

func TestProfilAbsent(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(nil, t.TempDir()).ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("profil absent: %d, attendu 404", w.Code)
	}
}
