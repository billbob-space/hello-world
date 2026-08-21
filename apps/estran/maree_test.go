package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const extremaJSON = `{
  "site_id": "berck-plage-fort-mahon",
  "data": [
    {"date": "2026-08-09", "extrema": [
      {"type": "BM", "time": "08:12", "height": 1.8},
      {"type": "PM", "time": "14:30", "height": 6.9, "coef": 76},
      {"type": "BM", "time": "20:45", "height": 2.1}
    ]}
  ]
}`

const niveauxJSON = `{
  "site_id": "berck-plage-fort-mahon",
  "data": [
    {"time": "2026-08-09T14:50:00+02:00", "height": 6.7},
    {"time": "2026-08-09T15:00:00+02:00", "height": 6.5},
    {"time": "2026-08-09T15:10:00+02:00", "height": 6.3}
  ]
}`

func serveurMaree(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/tide-extrema", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(extremaJSON))
	})
	mux.HandleFunc("/water-levels", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(niveauxJSON))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// serveurMareeCaptureFenetre se comporte comme serveurMaree mais enregistre
// les parametres `from`/`to` de la requete /tide-extrema recue, pour
// verifier que RecupererA demande desormais toute la fenetre de navigation
// (J-joursNavigationArriere a J+joursNavigationAvant) en un seul appel.
func serveurMareeCaptureFenetre(t *testing.T) (*httptest.Server, *string, *string) {
	t.Helper()
	var from, to string
	mux := http.NewServeMux()
	mux.HandleFunc("/tide-extrema", func(w http.ResponseWriter, r *http.Request) {
		from = r.URL.Query().Get("from")
		to = r.URL.Query().Get("to")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(extremaJSON))
	})
	mux.HandleFunc("/water-levels", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(niveauxJSON))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, &from, &to
}

func TestClientMaree_RecupererA_EncadreEtInterpole(t *testing.T) {
	srv := serveurMaree(t)
	c := &ClientMaree{
		BaseURL: srv.URL,
		HTTP:    srv.Client(),
		CleAPI:  "test-key",
	}
	maintenant := time.Date(2026, 8, 9, 15, 0, 0, 0, parisTZ)

	m, err := c.RecupererA(context.Background(), maintenant, "berck-plage-fort-mahon")
	if err != nil {
		t.Fatalf("RecupererA : %v", err)
	}

	if m.Precedent.Type != "PM" || m.Precedent.HauteurM != 6.9 {
		t.Errorf("precedent = %+v, attendu PM 6.9m a 14:30", m.Precedent)
	}
	if m.Prochain.Type != "BM" || m.Prochain.HauteurM != 2.1 {
		t.Errorf("prochain = %+v, attendu BM 2.1m a 20:45", m.Prochain)
	}
	if m.Prochain.Coefficient != nil {
		t.Errorf("coefficient du prochain (BM) = %v, attendu nil (seules les PM en portent)", *m.Prochain.Coefficient)
	}
	if m.Precedent.Coefficient == nil || *m.Precedent.Coefficient != 76 {
		t.Errorf("coefficient du precedent (PM) absent ou faux : %v", m.Precedent.Coefficient)
	}
	if m.Sens != "descendante" {
		t.Errorf("sens = %q, attendu descendante (le prochain extremum est une basse mer)", m.Sens)
	}
	if m.HauteurM != 6.5 {
		t.Errorf("hauteur mesuree = %v, attendu 6.5 (point le plus proche de 15:00)", m.HauteurM)
	}
	// 15:00 est a 30 min de 14:30 (PM) et 20:45 (BM) est a 6h15 de 14:30 :
	// position = 30 / (6*60+15) * 100 ~= 8%.
	if m.PositionPct < 7 || m.PositionPct > 9 {
		t.Errorf("position = %v%%, attendu ~8%%", m.PositionPct)
	}
	if len(m.Tendance) != nombreJoursAffiches {
		t.Fatalf("tendance = %d jour(s), attendu %d", len(m.Tendance), nombreJoursAffiches)
	}
	if m.Tendance[0].HauteM == nil || *m.Tendance[0].HauteM != 6.9 {
		t.Errorf("tendance jour 0 haute = %v, attendu 6.9", m.Tendance[0].HauteM)
	}
	if len(m.Extrema) != 3 {
		t.Fatalf("Extrema = %d entree(s), attendu 3 (toute la fenetre recuperee)", len(m.Extrema))
	}
}

// TestClientMaree_RecupererA_FenetreNavigation verifie que la requete
// d'extrema couvre desormais J-joursNavigationArriere a J+joursNavigationAvant
// en un seul appel (prp/01-navigation-temporelle.md), et pas seulement la
// marge d'un jour + la tendance a 7 jours d'avant cette capacite.
func TestClientMaree_RecupererA_FenetreNavigation(t *testing.T) {
	srv, from, to := serveurMareeCaptureFenetre(t)
	c := &ClientMaree{BaseURL: srv.URL, HTTP: srv.Client(), CleAPI: "test-key"}
	// L'heure choisie doit rester encadree par les extrema de la fixture
	// (extremaJSON, le 9 aout) : seule la fenetre from/to demandee nous
	// interesse ici, pas l'encadrement lui-meme (deja teste ailleurs).
	maintenant := time.Date(2026, 8, 9, 15, 0, 0, 0, parisTZ)

	if _, err := c.RecupererA(context.Background(), maintenant, "berck-plage-fort-mahon"); err != nil {
		t.Fatalf("RecupererA : %v", err)
	}

	attenduFrom := maintenant.AddDate(0, 0, -joursNavigationArriere).Format("2006-01-02")
	attenduTo := maintenant.AddDate(0, 0, joursNavigationAvant).Format("2006-01-02")
	if *from != attenduFrom {
		t.Errorf("from = %q, attendu %q (J-%d)", *from, attenduFrom, joursNavigationArriere)
	}
	if *to != attenduTo {
		t.Errorf("to = %q, attendu %q (J+%d)", *to, attenduTo, joursNavigationAvant)
	}
}

func TestExtremaDuJour(t *testing.T) {
	coef := 76
	extrema := []Extremum{
		{Type: "BM", Heure: time.Date(2026, 8, 15, 23, 0, 0, 0, parisTZ), HauteurM: 1.2},
		{Type: "BM", Heure: time.Date(2026, 8, 16, 3, 10, 0, 0, parisTZ), HauteurM: 1.5},
		{Type: "PM", Heure: time.Date(2026, 8, 16, 9, 20, 0, 0, parisTZ), HauteurM: 7.2, Coefficient: &coef},
		{Type: "BM", Heure: time.Date(2026, 8, 17, 3, 40, 0, 0, parisTZ), HauteurM: 1.6},
	}

	du := extremaDuJour(extrema, time.Date(2026, 8, 16, 0, 0, 0, 0, parisTZ))
	if len(du) != 2 {
		t.Fatalf("extremaDuJour = %d entree(s), attendu 2", len(du))
	}
	if du[0].HauteurM != 1.5 || du[1].HauteurM != 7.2 {
		t.Errorf("extremaDuJour = %+v, attendu les deux extrema du 16 dans l'ordre", du)
	}

	// Un jour sans aucun extremum rend une liste vide, jamais une valeur
	// inventee.
	vide := extremaDuJour(extrema, time.Date(2026, 8, 20, 0, 0, 0, 0, parisTZ))
	if len(vide) != 0 {
		t.Errorf("extremaDuJour(jour sans donnee) = %+v, attendu vide", vide)
	}
}

func TestClientMaree_Recuperer_SansCle(t *testing.T) {
	c := NouveauClientMaree("")
	_, err := c.Recuperer(context.Background(), "berck-plage-fort-mahon")
	if err != ErrCleAbsente {
		t.Fatalf("erreur = %v, attendu ErrCleAbsente", err)
	}
}

func TestEncadrer(t *testing.T) {
	extrema := []Extremum{
		{Type: "BM", Heure: time.Date(2026, 8, 9, 8, 12, 0, 0, time.UTC), HauteurM: 1.8},
		{Type: "PM", Heure: time.Date(2026, 8, 9, 14, 30, 0, 0, time.UTC), HauteurM: 6.9},
		{Type: "BM", Heure: time.Date(2026, 8, 9, 20, 45, 0, 0, time.UTC), HauteurM: 2.1},
	}

	precedent, prochain, err := encadrer(extrema, time.Date(2026, 8, 9, 10, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("encadrer : %v", err)
	}
	if precedent.Type != "BM" || prochain.Type != "PM" {
		t.Errorf("encadrement de 10h00 = %s/%s, attendu BM/PM", precedent.Type, prochain.Type)
	}

	_, _, err = encadrer(extrema, time.Date(2026, 8, 9, 23, 0, 0, 0, time.UTC))
	if err == nil {
		t.Fatal("attendu une erreur : aucun extremum apres 23h00 dans la liste fournie")
	}
}

func TestClamp(t *testing.T) {
	if v := clamp(150, 0, 100); v != 100 {
		t.Errorf("clamp(150,0,100) = %v, attendu 100", v)
	}
	if v := clamp(-10, 0, 100); v != 0 {
		t.Errorf("clamp(-10,0,100) = %v, attendu 0", v)
	}
	if v := clamp(42, 0, 100); v != 42 {
		t.Errorf("clamp(42,0,100) = %v, attendu 42", v)
	}
}

func TestGrouperParJour(t *testing.T) {
	coef := 76
	extrema := []Extremum{
		{Type: "BM", Heure: time.Date(2026, 8, 9, 8, 12, 0, 0, parisTZ), HauteurM: 1.8},
		{Type: "PM", Heure: time.Date(2026, 8, 9, 14, 30, 0, 0, parisTZ), HauteurM: 6.9, Coefficient: &coef},
		{Type: "BM", Heure: time.Date(2026, 8, 9, 20, 45, 0, 0, parisTZ), HauteurM: 2.1},
		// Deuxieme pleine mer du 9, plus basse : le maximum du jour doit rester 6.9.
		{Type: "PM", Heure: time.Date(2026, 8, 9, 2, 0, 0, 0, parisTZ), HauteurM: 6.5},
		// 10 aout : hors fenetre si nJours=1, dedans si nJours>=2.
		{Type: "PM", Heure: time.Date(2026, 8, 10, 15, 0, 0, 0, parisTZ), HauteurM: 7.1},
	}
	debut := time.Date(2026, 8, 9, 10, 0, 0, 0, parisTZ)

	jours := grouperParJour(extrema, debut, 3)

	if len(jours) != 3 {
		t.Fatalf("attendu 3 jours, recu %d", len(jours))
	}
	if jours[0].HauteM == nil || *jours[0].HauteM != 6.9 {
		t.Errorf("jour 0 (9 aout) haute = %v, attendu 6.9 (max des deux PM)", jours[0].HauteM)
	}
	if jours[0].BasseM == nil || *jours[0].BasseM != 1.8 {
		t.Errorf("jour 0 basse = %v, attendu 1.8", jours[0].BasseM)
	}
	if jours[0].Coefficient == nil || *jours[0].Coefficient != 76 {
		t.Errorf("jour 0 coefficient = %v, attendu 76 (celui de la PM retenue)", jours[0].Coefficient)
	}
	if jours[1].HauteM == nil || *jours[1].HauteM != 7.1 {
		t.Errorf("jour 1 (10 aout) haute = %v, attendu 7.1", jours[1].HauteM)
	}
	if jours[1].BasseM != nil {
		t.Errorf("jour 1 basse = %v, attendu nil (aucune BM fournie ce jour-la)", *jours[1].BasseM)
	}
	if jours[2].HauteM != nil || jours[2].BasseM != nil {
		t.Errorf("jour 2 (11 aout) attendu entierement vide, recu %+v", jours[2])
	}
}
