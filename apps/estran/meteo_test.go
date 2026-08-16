package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const forecastJSON = `{
  "hourly": {
    "time": ["2026-08-09T14:00", "2026-08-09T15:00", "2026-08-09T16:00"],
    "temperature_2m": [21.3, 21.8, 20.9],
    "precipitation_probability": [10, 20, 5],
    "cloud_cover": [30, 40, 15],
    "wind_speed_10m": [14.2, 15.8, 12.1],
    "wind_direction_10m": [90, 95, 80],
    "weather_code": [1, 2, 0]
  },
  "daily": {
    "time": ["2026-08-09", "2026-08-10"],
    "temperature_2m_max": [24.1, 23.5],
    "temperature_2m_min": [16.2, 15.9],
    "precipitation_probability_max": [20, 40],
    "weather_code": [1, 61]
  }
}`

const marineJSON = `{
  "hourly": {
    "time": ["2026-08-09T14:00", "2026-08-09T15:00"],
    "wave_height": [0.4, 0.5]
  }
}`

func serveurTest(t *testing.T, corps string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(corps))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestClientMeteo_Recuperer_FusionneVagues(t *testing.T) {
	forecast := serveurTest(t, forecastJSON)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{
		BaseForecast: forecast.URL,
		BaseMarine:   marine.URL,
		HTTP:         forecast.Client(),
		Latitude:     50.517,
		Longitude:    1.583,
	}

	p, err := c.Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Heures) != 3 {
		t.Fatalf("attendu 3 heures, recu %d", len(p.Heures))
	}
	if p.Heures[0].VaguesM == nil || *p.Heures[0].VaguesM != 0.4 {
		t.Fatalf("vagues[0] = %v, attendu 0.4", p.Heures[0].VaguesM)
	}
	// La marine API n'a que 2 heures : la troisieme doit degrader sans vagues,
	// pas faire echouer toute la prevision.
	if p.Heures[2].VaguesM != nil {
		t.Fatalf("vagues[2] = %v, attendu nil (hors couverture Marine)", *p.Heures[2].VaguesM)
	}
	if len(p.Jours) != 2 {
		t.Fatalf("attendu 2 jours, recu %d", len(p.Jours))
	}
	if p.Jours[0].TempMaxC != 24.1 {
		t.Fatalf("temp max jour 0 = %v, attendu 24.1", p.Jours[0].TempMaxC)
	}
}

func TestClientMeteo_Recuperer_MarineIndisponibleNeCassePasLaPrevision(t *testing.T) {
	forecast := serveurTest(t, forecastJSON)
	marineIndisponible := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(marineIndisponible.Close)

	c := &ClientMeteo{
		BaseForecast: forecast.URL,
		BaseMarine:   marineIndisponible.URL,
		HTTP:         forecast.Client(),
	}

	p, err := c.Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer ne doit pas echouer quand seule la Marine API est en panne : %v", err)
	}
	if len(p.Heures) != 3 {
		t.Fatalf("attendu 3 heures malgre la panne Marine, recu %d", len(p.Heures))
	}
	for _, h := range p.Heures {
		if h.VaguesM != nil {
			t.Fatalf("vagues attendues absentes (Marine en panne), obtenu %v", *h.VaguesM)
		}
	}
}

func TestClientMeteo_Recuperer_ForecastIndisponibleEstFatal(t *testing.T) {
	forecastIndisponible := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(forecastIndisponible.Close)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{
		BaseForecast: forecastIndisponible.URL,
		BaseMarine:   marine.URL,
		HTTP:         forecastIndisponible.Client(),
	}

	if _, err := c.Recuperer(context.Background()); err == nil {
		t.Fatal("attendu une erreur : sans previsions, il n'y a rien a fusionner")
	}
}

// TestClientMeteo_Recuperer_DemandeLaFenetreDeNavigation verifie que les deux
// appels sortants (previsions, marine) demandent past_days=7 et
// forecast_days=8 : c'est ce qui permet de decouper n'importe quel jour de
// la fenetre de navigation cote serveur, sans appel HTTP supplementaire
// (prp/01-navigation-temporelle.md). forecast_days=8, pas 7 : Open-Meteo
// compte aujourd'hui dans sa fenetre, il faut donc 8 jours pour couvrir
// jusqu'a J+7, le dernier jour navigable en avant.
func TestClientMeteo_Recuperer_DemandeLaFenetreDeNavigation(t *testing.T) {
	var requeteForecast, requeteMarine string
	forecast := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requeteForecast = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(forecastJSON))
	}))
	t.Cleanup(forecast.Close)
	marine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requeteMarine = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(marineJSON))
	}))
	t.Cleanup(marine.Close)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client(), Latitude: 50.517, Longitude: 1.583}
	if _, err := c.Recuperer(context.Background()); err != nil {
		t.Fatalf("Recuperer : %v", err)
	}

	if !strings.Contains(requeteForecast, "past_days=7") || !strings.Contains(requeteForecast, "forecast_days=8") {
		t.Errorf("requete previsions = %q, attendu past_days=7 et forecast_days=8", requeteForecast)
	}
	if !strings.Contains(requeteMarine, "past_days=7") || !strings.Contains(requeteMarine, "forecast_days=8") {
		t.Errorf("requete marine = %q, attendu past_days=7 et forecast_days=8 (portee de 2 a 8)", requeteMarine)
	}
}

// forecastAgregationJSON couvre deux jours : le 2026-08-16, dont les heures
// de NUIT (is_day=0) sont bouchees (cloud_cover_low=100) et les heures de
// JOUR (is_day=1) degagees (tout a 0) — l'agregat journalier ne doit tenir
// compte que des heures de jour, sinon le brouillage nocturne ferait passer
// une journee ensoleillee pour couverte. Le 2026-08-17 n'a aucune heure
// is_day=1 dans cette fixture (jour tronque en fin de fenetre) : son agregat
// doit rester absent (CouchesConnues=false).
const forecastAgregationJSON = `{
  "hourly": {
    "time": ["2026-08-16T00:00", "2026-08-16T12:00", "2026-08-16T18:00", "2026-08-16T23:00", "2026-08-17T00:00"],
    "temperature_2m": [15, 22, 20, 16, 15],
    "precipitation_probability": [0, 0, 0, 0, 0],
    "cloud_cover": [100, 0, 0, 100, 100],
    "cloud_cover_low": [100, 0, 0, 100, 100],
    "cloud_cover_mid": [0, 0, 0, 0, 0],
    "cloud_cover_high": [0, 0, 0, 0, 0],
    "is_day": [0, 1, 1, 0, 0],
    "wind_speed_10m": [10, 10, 10, 10, 10],
    "wind_direction_10m": [90, 90, 90, 90, 90],
    "weather_code": [3, 0, 0, 3, 3]
  },
  "daily": {
    "time": ["2026-08-16", "2026-08-17"],
    "temperature_2m_max": [22, 21],
    "temperature_2m_min": [15, 14],
    "precipitation_probability_max": [0, 0],
    "weather_code": [3, 3]
  }
}`

func TestClientMeteo_Recuperer_AgregeCouchesJournalieresDepuisLesHeuresDeJour(t *testing.T) {
	forecast := serveurTest(t, forecastAgregationJSON)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{
		BaseForecast: forecast.URL,
		BaseMarine:   marine.URL,
		HTTP:         forecast.Client(),
		Latitude:     50.517,
		Longitude:    1.583,
	}

	p, err := c.Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Jours) != 2 {
		t.Fatalf("attendu 2 jours, recu %d", len(p.Jours))
	}

	jour16 := p.Jours[0]
	if !jour16.CouchesConnues {
		t.Fatal("2026-08-16 a deux heures de jour connues, CouchesConnues doit etre vrai")
	}
	if jour16.NebulositeBassePct != 0 {
		t.Errorf("nebulosite basse agregee (jour) = %v, attendu 0 (heures de nuit bouchees ignorees)", jour16.NebulositeBassePct)
	}

	jour17 := p.Jours[1]
	if jour17.CouchesConnues {
		t.Error("2026-08-17 n'a aucune heure de jour dans la fixture, CouchesConnues doit rester faux")
	}
}

func TestLibelleMeteo(t *testing.T) {
	cas := []struct {
		code           int
		libelleAttendu string
		symboleAttendu string
	}{
		{0, "ciel degage", "soleil"},
		{3, "couvert", "nuage"},
		{63, "pluie", "pluie"},
		{95, "orage", "orage"},
	}
	for _, c := range cas {
		libelle, symbole := libelleMeteo(c.code)
		if libelle != c.libelleAttendu || symbole != c.symboleAttendu {
			t.Errorf("libelleMeteo(%d) = (%q, %q), attendu (%q, %q)",
				c.code, libelle, symbole, c.libelleAttendu, c.symboleAttendu)
		}
	}
}

// TestCielApparent_16Aout2026 est le cas reel qui a declenche ce correctif :
// bulletin marine de reference "soleil franc" au Touquet le 16 aout 2026 a
// 18h, alors que weather_code=3 ("couvert") a cause d'un cirrus haut a 100%.
// C'est ce bulletin qui est l'arbitre du resultat attendu, pas l'API.
func TestCielApparent_16Aout2026(t *testing.T) {
	libelle, symbole := cielApparent(0, 45, 100)
	if libelle != "principalement degage" || symbole != "soleil-voile" {
		t.Errorf("cielApparent(0,45,100) = (%q,%q), attendu (\"principalement degage\",\"soleil-voile\") — bulletin marine du 16 aout 2026 18h : soleil franc", libelle, symbole)
	}
}

func TestCielApparent(t *testing.T) {
	cas := []struct {
		nom                 string
		bas, moyenne, haute float64
		libelleAttendu      string
		symboleAttendu      string
	}{
		{"cirrus seul a 100%", 0, 0, 100, "principalement degage", "soleil-voile"},
		{"ciel bouche par le bas", 100, 0, 0, "couvert", "nuage"},
		{"stratocumulus moyen epais", 0, 100, 0, "couvert", "nuage"},
		{"ciel vide", 0, 0, 0, "ciel degage", "soleil"},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			libelle, symbole := cielApparent(c.bas, c.moyenne, c.haute)
			if libelle != c.libelleAttendu || symbole != c.symboleAttendu {
				t.Errorf("cielApparent(%v,%v,%v) = (%q,%q), attendu (%q,%q)",
					c.bas, c.moyenne, c.haute, libelle, symbole, c.libelleAttendu, c.symboleAttendu)
			}
		})
	}
}

func TestLibelleCiel_UnPhenomeneLEmporte(t *testing.T) {
	cas := []struct {
		nom            string
		code           int
		libelleAttendu string
		symboleAttendu string
	}{
		{"pluie malgre ciel vide en entree", 61, "pluie", "pluie"},
		{"brouillard malgre ciel vide en entree", 45, "brouillard", "brouillard"},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			libelle, symbole := libelleCiel(c.code, 0, 0, 0)
			if libelle != c.libelleAttendu || symbole != c.symboleAttendu {
				t.Errorf("libelleCiel(%d,0,0,0) = (%q,%q), attendu (%q,%q)",
					c.code, libelle, symbole, c.libelleAttendu, c.symboleAttendu)
			}
		})
	}
}

func TestValeurA(t *testing.T) {
	s := []float64{1, 2, 3}
	if v := valeurA(s, 1); v != 2 {
		t.Errorf("valeurA(s,1) = %v, attendu 2", v)
	}
	if v := valeurA(s, 5); v != 0 {
		t.Errorf("valeurA hors bornes = %v, attendu 0 plutot qu'un panic", v)
	}
}

// parisTZ est definie dans main.go ; verifie ici qu'elle charge bien avant
// tout test qui en depend (parsing des horodatages Open-Meteo).
func TestParisTZChargee(t *testing.T) {
	if parisTZ == nil || parisTZ == time.UTC {
		t.Fatal("parisTZ doit resoudre Europe/Paris, pas UTC")
	}
}

func TestSansRequete_RetireLaCle(t *testing.T) {
	got := sansRequete("https://api-maree.fr/tide-extrema?site=x&key=SECRET123")
	if got != "https://api-maree.fr/tide-extrema" {
		t.Fatalf("sansRequete = %q, la cle ne doit jamais y figurer", got)
	}
}

func TestRecupererJSON_ErreurNeContientJamaisLaCle(t *testing.T) {
	// Port improbable, injoignable : declenche une erreur *url.Error dont le
	// message brut de Go embarque l'URL demandee, cle comprise.
	cible := "http://127.0.0.1:1/tide-extrema?site=x&key=SECRET123"
	var dest any
	err := recupererJSON(context.Background(), &http.Client{Timeout: time.Second}, cible, &dest)
	if err == nil {
		t.Fatal("attendu une erreur : port injoignable")
	}
	if strings.Contains(err.Error(), "SECRET123") {
		t.Fatalf("l'erreur contient la cle API : %v", err)
	}
}
