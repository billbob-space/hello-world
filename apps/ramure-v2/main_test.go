package main

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// appeler joue une requete contre le routeur reel, sans ouvrir de socket.
// Aucun test de cette application ne parle au reseau : PRD §13.
func appeler(t *testing.T, methode, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	routes().ServeHTTP(rec, httptest.NewRequest(methode, chemin, nil))
	return rec
}

// La sonde est ce que Traefik et Docker interrogent. Si elle ment, le
// conteneur est declare malsain en permanence et l'app n'est jamais servie.
func TestHealthzRepond200(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/healthz")

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	if corps := strings.TrimSpace(rec.Body.String()); corps != "ok" {
		t.Errorf("corps = %q, attendu \"ok\"", corps)
	}
}

// wget --spider ne lit pas le corps, mais un navigateur ouvert sur /healthz
// afficherait du HTML devine si le type n'est pas pose.
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
		t.Errorf("la page ne declare pas lang=\"fr\" — le produit est francophone")
	}
	if !strings.Contains(corps, "RAMURE") {
		t.Errorf("la page ne se nomme pas : impossible de distinguer cette reponse d'un catch-all")
	}
}

// Ce test est le seul qui attrape l'oubli de {$} dans le motif de route.
// Sans lui, GET / se comporte en prefixe et TOUT chemin inconnu renverrait la
// page d'accueil en 200 — y compris les futures routes /api mal orthographiees,
// qui repondraient du HTML a un client attendant du JSON.
func TestCheminInconnuRepond404(t *testing.T) {
	rec := appeler(t, http.MethodGet, "/chemin-qui-nexiste-pas")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("code = %d pour un chemin inconnu, attendu 404", rec.Code)
	}
}

// Une construction locale ne doit jamais se faire passer pour une image
// deployee : "dev" est la valeur qui le garantit quand -ldflags est absent.
func TestVersionParDefaut(t *testing.T) {
	if version != "dev" {
		t.Fatalf("version = %q, attendu \"dev\" hors construction CI", version)
	}
}

// Y compris sur un 404 : c'est souvent la reponse qu'on capture quand quelque
// chose ne va pas, et c'est donc la ou l'on veut savoir quelle image repond.
func TestChaqueReponsePorteLaVersion(t *testing.T) {
	precedente := version
	version = "essai-42"
	defer func() { version = precedente }()

	for _, chemin := range []string{"/", "/healthz", "/chemin-qui-nexiste-pas"} {
		rec := appeler(t, http.MethodGet, chemin)
		if v := rec.Header().Get("X-Ramure-Version"); v != "essai-42" {
			t.Errorf("%s : X-Ramure-Version = %q, attendu \"essai-42\"", chemin, v)
		}
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

	journal(routes()).ServeHTTP(
		httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/healthz", nil),
	)

	if tampon.Len() != 0 {
		t.Fatalf("la sonde est journalisee : %q", tampon.String())
	}
}
