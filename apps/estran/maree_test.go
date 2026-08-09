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

func TestClientMaree_RecupererA_EncadreEtInterpole(t *testing.T) {
	srv := serveurMaree(t)
	c := &ClientMaree{
		BaseURL: srv.URL,
		HTTP:    srv.Client(),
		Site:    "berck-plage-fort-mahon",
		CleAPI:  "test-key",
	}
	maintenant := time.Date(2026, 8, 9, 15, 0, 0, 0, parisTZ)

	m, err := c.RecupererA(context.Background(), maintenant)
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
}

func TestClientMaree_Recuperer_SansCle(t *testing.T) {
	c := NouveauClientMaree("berck-plage-fort-mahon", "")
	_, err := c.Recuperer(context.Background())
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
