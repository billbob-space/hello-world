package main

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/api"
)

// appeler joue une requete contre le routeur cable par main() (mais sans
// jamais ouvrir de socket ni contacter le reseau : PRD §13), pour verifier
// que le cablage lui-meme produit un routeur qui repond. Le detail des
// routes (healthz, accueil, /api/centre) est verifie dans internal/api, qui
// les possede depuis le PRP 04.
func appeler(t *testing.T, methode, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	api.AccueilHTML = []byte(`<html lang="fr"><body>RAMURE</body></html>`)
	rec := httptest.NewRecorder()
	api.Routes(dependances()).ServeHTTP(rec, httptest.NewRequest(methode, chemin, nil))
	return rec
}

// Le cablage de main() (cache, limiteur, sources, Dependances) doit
// produire un routeur qui repond : c'est ce que les tests d'internal/api,
// construits sur leurs PROPRES dependances de test, ne peuvent pas
// verifier.
func TestLeCablageDeLApplicationRepond(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if corps := strings.TrimSpace(rec.Body.String()); corps != "ok" {
		t.Errorf("corps = %q, attendu \"ok\"", corps)
	}
}

// capturerJournal detourne la sortie du journal le temps du test.
func capturerJournal(t *testing.T) *bytes.Buffer {
	t.Helper()
	var tampon bytes.Buffer
	precedent := log.Writer()
	precedents := log.Flags()
	log.SetOutput(&tampon)
	log.SetFlags(0)
	t.Cleanup(func() { log.SetOutput(precedent); log.SetFlags(precedents) })
	return &tampon
}

func TestLeJournalNoteLaRequeteEtSonCode(t *testing.T) {
	tampon := capturerJournal(t)

	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/inconnu", nil))

	ligne := strings.TrimSpace(tampon.String())
	if !strings.HasPrefix(ligne, "GET /inconnu 404 ") {
		t.Fatalf("journal = %q, attendu un prefixe \"GET /inconnu 404 \"", ligne)
	}
	if !strings.HasSuffix(ligne, "ms") {
		t.Errorf("journal = %q, la duree devrait terminer la ligne", ligne)
	}
}

// Un gestionnaire qui n'appelle jamais WriteHeader repond 200 : le journal
// doit dire 200, pas 0.
func TestLeJournalNoteDeuxCentsSansWriteHeader(t *testing.T) {
	tampon := capturerJournal(t)

	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if ligne := strings.TrimSpace(tampon.String()); !strings.HasPrefix(ligne, "GET / 200 ") {
		t.Fatalf("journal = %q, attendu un prefixe \"GET / 200 \"", ligne)
	}
}

// Palier google : X-Forwarded-User porte l'adresse e-mail d'un compte Google.
// Elle n'a rien a faire dans un journal d'acces.
func TestLeJournalNEcritPasLIdentite(t *testing.T) {
	tampon := capturerJournal(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-User", "amuteau@gmail.com")
	journal(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})).
		ServeHTTP(httptest.NewRecorder(), req)

	if strings.Contains(tampon.String(), "amuteau@gmail.com") {
		t.Fatalf("le journal ecrit l'identite de l'utilisateur : %q", tampon.String())
	}
}

// Docker appelle la sonde toutes les 30 s : 2880 lignes par jour et par
// conteneur, qui noieraient tout ce qu'on cherche a lire.
func TestLeJournalIgnoreLaSonde(t *testing.T) {
	tampon := capturerJournal(t)

	journal(api.Routes(dependances())).ServeHTTP(
		httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/healthz", nil),
	)

	if tampon.Len() != 0 {
		t.Fatalf("la sonde est journalisee : %q", tampon.String())
	}
}
