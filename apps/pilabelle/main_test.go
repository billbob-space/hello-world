package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func poster(t *testing.T, h http.Handler, methode, chemin, email string, corps any) *httptest.ResponseRecorder {
	t.Helper()
	var lecteur *bytes.Reader
	if corps != nil {
		brut, err := json.Marshal(corps)
		if err != nil {
			t.Fatal(err)
		}
		lecteur = bytes.NewReader(brut)
	} else {
		lecteur = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(methode, chemin, lecteur)
	r.Header.Set("X-Forwarded-User", email)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestSante(t *testing.T) {
	r := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, t.TempDir()).ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("healthz = %d, attendu 200", w.Code)
	}
}

func TestIdentiteExigeeSurAPI(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, t.TempDir()).ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("sans X-Forwarded-User: %d, attendu 400", w.Code)
	}
}

func TestPageAttente(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, t.TempDir()).ServeHTTP(w, r)
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
	routes(Dictionnaire{}, t.TempDir()).ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("profil absent: %d, attendu 404", w.Code)
	}
}

func reponsesDeTest() Reponses {
	return Reponses{NiveauDepart: "debutante", JoursActifs: []string{"lundi", "mercredi"}}
}

func TestCreerProfil(t *testing.T) {
	h := routes(Dictionnaire{}, t.TempDir())
	w := poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	if w.Code != http.StatusCreated {
		t.Fatalf("creation: %d, attendu 201 — corps: %s", w.Code, w.Body.String())
	}
	var p Profil
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.Niveaux.Ventre != 1 || p.Niveaux.Cuisses != 1 {
		t.Fatalf("niveaux initiaux = %+v, attendu 1/1 pour une debutante", p.Niveaux)
	}
}

func TestCreerProfilDeuxFoisRefuse(t *testing.T) {
	racine := t.TempDir()
	h := routes(Dictionnaire{}, racine)
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	w := poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	if w.Code != http.StatusConflict {
		t.Fatalf("seconde creation: %d, attendu 409", w.Code)
	}
}

func TestReglagesNeTouchentPasNiveauxHistoriqueSerie(t *testing.T) {
	racine := t.TempDir()
	h := routes(Dictionnaire{}, racine)
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())

	// Simule une progression deja ecrite (comme le ferait PRP 05).
	avant, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	avant.Niveaux = Niveaux{Ventre: 3, Cuisses: 2}
	avant.Serie = Serie{Actuelle: 5, Record: 5}
	avant.Historique = []HistoriqueEntree{{Date: "2026-08-07", Ressenti: RessentiCorrect}}
	if err := EcrireProfil(racine, "test@example.com", avant); err != nil {
		t.Fatal(err)
	}

	nouvellesReponses := Reponses{NiveauDepart: "a_deja_pratique", JoursActifs: []string{"samedi"}}
	w := poster(t, h, "PUT", "/api/profil", "test@example.com", nouvellesReponses)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}

	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if apres.Niveaux != (Niveaux{Ventre: 3, Cuisses: 2}) {
		t.Fatalf("niveaux modifies par un PUT: %+v", apres.Niveaux)
	}
	if apres.Serie != (Serie{Actuelle: 5, Record: 5}) {
		t.Fatalf("serie modifiee par un PUT: %+v", apres.Serie)
	}
	if len(apres.Historique) != 1 {
		t.Fatalf("historique modifie par un PUT: %+v", apres.Historique)
	}
	if apres.Reponses.NiveauDepart != "a_deja_pratique" {
		t.Fatalf("reponses non mises a jour: %+v", apres.Reponses)
	}
}
