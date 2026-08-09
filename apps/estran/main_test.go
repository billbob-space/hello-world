package main

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	handleHealth(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200", rec.Code)
	}
	if rec.Body.String() != "ok\n" {
		t.Fatalf("corps = %q, attendu \"ok\\n\"", rec.Body.String())
	}
}

// TestHandleHealth_NeDependAucunFournisseur verifie que /healthz repond
// meme si les clients meteo et maree pointent vers des adresses injoignables :
// le healthcheck ne doit jamais rendre le conteneur malsain a cause d'une
// panne cote fournisseur externe (prp/00-ossature.md).
func TestHandleHealth_NeDependAucunFournisseur(t *testing.T) {
	s := nouveauServeur(
		&ClientMeteo{BaseForecast: "http://127.0.0.1:1", BaseMarine: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientMaree{BaseURL: "http://127.0.0.1:1", HTTP: http.DefaultClient, Site: "x", CleAPI: "x"},
	)
	var web fs.FS = fstestVide{}
	h := routes(s, web)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200 meme sans fournisseurs joignables", rec.Code)
	}
}

func TestHandleMaree_SansCle(t *testing.T) {
	s := nouveauServeur(
		NouveauClientMeteo(50.517, 1.583),
		NouveauClientMaree("berck-plage-fort-mahon", ""), // pas de cle
	)
	req := httptest.NewRequest(http.MethodGet, "/api/maree", nil)
	rec := httptest.NewRecorder()

	s.handleMaree(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200", rec.Code)
	}
	var reponse ReponseMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Configure {
		t.Error("Configure doit etre false sans API_MAREE_KEY")
	}
}

// fstestVide est un fs.FS vide, suffisant pour les tests qui n'exercent pas
// le service de fichiers statiques.
type fstestVide struct{}

func (fstestVide) Open(name string) (fs.File, error) {
	return nil, fs.ErrNotExist
}
