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

// accordJSON couvre les memes deux jours que forecastJSON, avec trois
// modeles sur la temperature et deux sur la pluie pour 2026-08-09 (assez
// pour un indice calcule), un seul modele sur la pluie pour 2026-08-10
// (moins de deux : la pluie doit alors etre ignoree pour ce jour-la) — les
// valeurs JSON null representent un modele qui ne porte pas jusque-la
// (prp/02-horizon-confiance-vent.md, section 3).
const accordJSON = `{
  "daily": {
    "time": ["2026-08-09", "2026-08-10"],
    "temperature_2m_max_icon_seamless": [24.0, 23.0],
    "temperature_2m_max_gfs_seamless": [24.5, 23.4],
    "temperature_2m_max_ecmwf_ifs025": [23.8, null],
    "precipitation_probability_max_icon_seamless": [20, 40],
    "precipitation_probability_max_gfs_seamless": [25, null]
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
	}

	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
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
	if p.Jours[0].TempMaxC == nil || *p.Jours[0].TempMaxC != 24.1 {
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

	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
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

	if _, err := c.Recuperer(context.Background(), 50.517, 1.583); err == nil {
		t.Fatal("attendu une erreur : sans previsions, il n'y a rien a fusionner")
	}
}

// forecastVentJSON porte les trois grandeurs journalieres de vent
// (prp/02-horizon-confiance-vent.md, section 4), avec des valeurs distinctes
// pour reconnaitre facilement laquelle est laquelle dans les assertions.
const forecastVentJSON = `{
  "hourly": {
    "time": ["2026-08-09T14:00"],
    "temperature_2m": [21.3],
    "weather_code": [1]
  },
  "daily": {
    "time": ["2026-08-09"],
    "temperature_2m_max": [24.1],
    "temperature_2m_min": [16.2],
    "precipitation_probability_max": [20],
    "weather_code": [1],
    "wind_speed_10m_max": [38.4],
    "wind_gusts_10m_max": [61.2],
    "wind_direction_10m_dominant": [227]
  }
}`

func TestClientMeteo_Recuperer_VentJournalier(t *testing.T) {
	forecast := serveurTest(t, forecastVentJSON)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Jours) != 1 {
		t.Fatalf("attendu 1 jour, recu %d", len(p.Jours))
	}
	j := p.Jours[0]
	if j.VentKmhMax == nil || *j.VentKmhMax != 38.4 {
		t.Errorf("VentKmhMax = %v, attendu 38.4", j.VentKmhMax)
	}
	if j.RafalesKmhMax == nil || *j.RafalesKmhMax != 61.2 {
		t.Errorf("RafalesKmhMax = %v, attendu 61.2", j.RafalesKmhMax)
	}
	if j.VentDirectionDeg == nil || *j.VentDirectionDeg != 227 {
		t.Errorf("VentDirectionDeg = %v, attendu 227", j.VentDirectionDeg)
	}
}

// TestClientMeteo_Recuperer_AccordDefinitLaConfiance verifie que Recuperer
// fusionne l'appel d'accord entre modeles (accordJSON) par date dans les
// jours de la prevision principale : c'est le chemin heureux (l'appel
// reussit) de la degradation testee separement ci-dessous.
func TestClientMeteo_Recuperer_AccordDefinitLaConfiance(t *testing.T) {
	forecast := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("models") != "" {
			_, _ = w.Write([]byte(accordJSON))
			return
		}
		_, _ = w.Write([]byte(forecastJSON))
	}))
	t.Cleanup(forecast.Close)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Jours) != 2 {
		t.Fatalf("attendu 2 jours, recu %d", len(p.Jours))
	}
	// 2026-08-09 : 3 modeles sur la temperature (ecart-type ~0.29°C, haute),
	// 2 sur la pluie (ecart-type 2.5 points, haute) -> haute, 3 modeles (pas
	// de plafond a 3 modeles pile).
	if p.Jours[0].Confiance != "haute" || p.Jours[0].ConfianceModeles != 3 {
		t.Errorf("Jours[0] confiance/modeles = %q/%d, attendu haute/3", p.Jours[0].Confiance, p.Jours[0].ConfianceModeles)
	}
	// 2026-08-10 : seulement 2 modeles sur la temperature (accord serre,
	// ecart-type 0.2°C) : le plafond a moins de trois modeles ramene le
	// niveau a "moyenne", jamais "haute", meme si les deux modeles
	// s'accordent parfaitement (prp/02-horizon-confiance-vent.md, section
	// Degradation). Pluie ignoree (un seul modele).
	if p.Jours[1].Confiance != "moyenne" || p.Jours[1].ConfianceModeles != 2 {
		t.Errorf("Jours[1] confiance/modeles = %q/%d, attendu moyenne/2 (plafond a deux modeles)", p.Jours[1].Confiance, p.Jours[1].ConfianceModeles)
	}
}

// TestClientMeteo_Recuperer_AccordIndisponibleNeCassePasLaPrevision est LE
// test le plus important de ce lot (prp/02-horizon-confiance-vent.md,
// section Degradation) : l'indice de confiance est un ornement verifiable,
// jamais une dependance. Un echec de l'appel d'accord ne doit ni faire
// echouer Recuperer, ni empecher les jours de porter le reste de leurs
// donnees — seule Confiance/ConfianceModeles restent a leur zero-valeur.
func TestClientMeteo_Recuperer_AccordIndisponibleNeCassePasLaPrevision(t *testing.T) {
	forecast := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("models") != "" {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(forecastJSON))
	}))
	t.Cleanup(forecast.Close)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer ne doit jamais echouer a cause de l'accord entre modeles : %v", err)
	}
	if len(p.Jours) != 2 {
		t.Fatalf("attendu 2 jours malgre la panne d'accord, recu %d", len(p.Jours))
	}
	for _, j := range p.Jours {
		if j.Confiance != "" || j.ConfianceModeles != 0 {
			t.Errorf("jour %s : confiance/modeles = %q/%d, attendu vides/0 (accord en panne)", j.Date, j.Confiance, j.ConfianceModeles)
		}
		if j.TempMaxC == nil {
			t.Errorf("jour %s : TempMaxC = nil, la panne d'accord ne doit pas degrader le reste des donnees", j.Date)
		}
	}
}

// TestClientMeteo_Recuperer_DemandeLaFenetreDeNavigation verifie que les
// deux appels sortants (previsions, marine) demandent past_days=7 et
// forecast_days=16 : c'est ce qui permet de decouper n'importe quel jour de
// la fenetre de navigation cote serveur, sans appel HTTP supplementaire
// (prp/01-navigation-temporelle.md, prp/02-horizon-confiance-vent.md).
// forecast_days=16, pas 15 : Open-Meteo compte aujourd'hui dans sa fenetre,
// il faut donc 16 jours pour couvrir jusqu'a J+15, le dernier jour navigable
// en avant. L'appel d'accord entre modeles partage la meme base URL que les
// previsions (BaseForecast) : le serveur de test les distingue par la
// presence du parametre `models`.
func TestClientMeteo_Recuperer_DemandeLaFenetreDeNavigation(t *testing.T) {
	var requeteForecast, requeteMarine, requeteAccord string
	forecast := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("models") != "" {
			requeteAccord = r.URL.RawQuery
			_, _ = w.Write([]byte(accordJSON))
			return
		}
		requeteForecast = r.URL.RawQuery
		_, _ = w.Write([]byte(forecastJSON))
	}))
	t.Cleanup(forecast.Close)
	marine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requeteMarine = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(marineJSON))
	}))
	t.Cleanup(marine.Close)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	if _, err := c.Recuperer(context.Background(), 50.517, 1.583); err != nil {
		t.Fatalf("Recuperer : %v", err)
	}

	if !strings.Contains(requeteForecast, "past_days=7") || !strings.Contains(requeteForecast, "forecast_days=16") {
		t.Errorf("requete previsions = %q, attendu past_days=7 et forecast_days=16", requeteForecast)
	}
	if !strings.Contains(requeteForecast, "wind_speed_10m_max") || !strings.Contains(requeteForecast, "wind_gusts_10m_max") || !strings.Contains(requeteForecast, "wind_direction_10m_dominant") {
		t.Errorf("requete previsions = %q, attendu les trois grandeurs de vent journalier", requeteForecast)
	}
	if !strings.Contains(requeteMarine, "past_days=7") || !strings.Contains(requeteMarine, "forecast_days=16") {
		t.Errorf("requete marine = %q, attendu past_days=7 et forecast_days=16 (portee de 2 a 16)", requeteMarine)
	}
	if requeteAccord == "" {
		t.Fatal("aucune requete d'accord entre modeles recue")
	}
	if !strings.Contains(requeteAccord, "forecast_days=16") || strings.Contains(requeteAccord, "past_days") {
		t.Errorf("requete accord = %q, attendu forecast_days=16 et aucun past_days", requeteAccord)
	}
	for _, modele := range modelesAccord {
		if !strings.Contains(requeteAccord, modele) {
			t.Errorf("requete accord = %q, attendu le modele %q", requeteAccord, modele)
		}
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
	}

	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
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

// forecastBordJSON simule le bord de la fenetre Open-Meteo constate en
// direct le 18 aout 2026 (prp/02-horizon-confiance-vent.md, section
// Degradation) : deux heures, la deuxieme sans temperature ("null") ET sans
// pluie ("null") alors que le reste (vent) reste connu — deux absences
// independantes dans la meme heure. Le jour journalier est lui aussi sans
// temperature (le fournisseur ne porte plus si loin), mais garde son vent.
const forecastBordJSON = `{
  "hourly": {
    "time": ["2026-09-01T22:00", "2026-09-01T23:00"],
    "temperature_2m": [14.2, null],
    "precipitation_probability": [10, null],
    "cloud_cover": [30, 40],
    "wind_speed_10m": [12.1, 13.4],
    "wind_direction_10m": [90, 95],
    "weather_code": [1, 2]
  },
  "daily": {
    "time": ["2026-09-01", "2026-09-02"],
    "temperature_2m_max": [18.4, null],
    "temperature_2m_min": [12.1, null],
    "precipitation_probability_max": [20, null],
    "weather_code": [1, 1],
    "wind_speed_10m_max": [30.0, 28.5],
    "wind_gusts_10m_max": [48.0, 44.0],
    "wind_direction_10m_dominant": [200, 210]
  }
}`

// TestClientMeteo_Recuperer_HeureSansTemperatureResteNulle verifie qu'une
// heure ou Open-Meteo rend `null` sur temperature_2m ET
// precipitation_probability est decodee avec ces deux champs a nil, jamais
// un zero invente — c'est le defaut constate le 18 aout 2026
// (prp/02-horizon-confiance-vent.md, section Degradation).
func TestClientMeteo_Recuperer_HeureSansTemperatureResteNulle(t *testing.T) {
	forecast := serveurTest(t, forecastBordJSON)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Heures) != 2 {
		t.Fatalf("attendu 2 heures decodees, recu %d", len(p.Heures))
	}
	if p.Heures[0].TemperatureC == nil || *p.Heures[0].TemperatureC != 14.2 {
		t.Errorf("heure[0] TemperatureC = %v, attendu 14.2 (connue)", p.Heures[0].TemperatureC)
	}
	if p.Heures[1].TemperatureC != nil {
		t.Errorf("heure[1] TemperatureC = %v, attendu nil (null Open-Meteo, jamais 0)", *p.Heures[1].TemperatureC)
	}
	if p.Heures[1].PluiePct != nil {
		t.Errorf("heure[1] PluiePct = %v, attendu nil (null Open-Meteo, jamais 0)", *p.Heures[1].PluiePct)
	}
	// Le vent, lui, reste connu sur cette heure : une absence n'en entraine
	// pas une autre.
	if p.Heures[1].VentKmh == nil || *p.Heures[1].VentKmh != 13.4 {
		t.Errorf("heure[1] VentKmh = %v, attendu 13.4 (connu malgre l'absence de temperature)", p.Heures[1].VentKmh)
	}
}

// TestClientMeteo_Recuperer_JourEntierementNulResteNul verifie qu'un jour ou
// Open-Meteo rend `null` sur toute la temperature journaliere est decode
// avec TempMinC/TempMaxC a nil (jamais 0), alors que le vent journalier de
// ce meme jour, lui, reste connu.
func TestClientMeteo_Recuperer_JourEntierementNulResteNul(t *testing.T) {
	forecast := serveurTest(t, forecastBordJSON)
	marine := serveurTest(t, marineJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Jours) != 2 {
		t.Fatalf("attendu 2 jours decodes, recu %d", len(p.Jours))
	}
	jourBord := p.Jours[1]
	if jourBord.TempMinC != nil || jourBord.TempMaxC != nil {
		t.Errorf("jour[1] TempMinC/TempMaxC = %v/%v, attendu nil/nil (null Open-Meteo)", jourBord.TempMinC, jourBord.TempMaxC)
	}
	if jourBord.VentKmhMax == nil || *jourBord.VentKmhMax != 28.5 {
		t.Errorf("jour[1] VentKmhMax = %v, attendu 28.5 (connu malgre l'absence de temperature)", jourBord.VentKmhMax)
	}
}

// marineBordJSON reprend les memes horodatages que forecastJSON
// (2026-08-09T14:00/15:00/16:00), dont le deuxieme, seul, est `null` sur
// wave_height : la seule facon dont ce bug s'est manifeste en pratique (une
// vague isolee absente au milieu d'heures couvertes), distincte du cas
// "toute la Marine API en panne" deja teste plus haut.
const marineBordJSON = `{
  "hourly": {
    "time": ["2026-08-09T14:00", "2026-08-09T15:00", "2026-08-09T16:00"],
    "wave_height": [0.6, null, 0.7]
  }
}`

// TestClientMeteo_Recuperer_VagueNulleResteAbsente est LE test de
// non-regression du defaut constate le 18 aout 2026 : avant le correctif,
// wave_height decode en []float64 transformait un `null` en 0.0, et ce 0.0
// passait pour une vraie mesure dans la fusion par horodatage (Recuperer) —
// « 0,0 m » aurait ete affiche a la place d'une absence.
func TestClientMeteo_Recuperer_VagueNulleResteAbsente(t *testing.T) {
	forecast := serveurTest(t, forecastJSON)
	marine := serveurTest(t, marineBordJSON)

	c := &ClientMeteo{BaseForecast: forecast.URL, BaseMarine: marine.URL, HTTP: forecast.Client()}
	p, err := c.Recuperer(context.Background(), 50.517, 1.583)
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if len(p.Heures) < 2 {
		t.Fatalf("attendu au moins 2 heures, recu %d", len(p.Heures))
	}
	if p.Heures[0].VaguesM == nil || *p.Heures[0].VaguesM != 0.6 {
		t.Errorf("heure[0] VaguesM = %v, attendu 0.6", p.Heures[0].VaguesM)
	}
	if p.Heures[1].VaguesM != nil {
		t.Errorf("heure[1] VaguesM = %v, attendu nil (wave_height null, jamais 0.0)", *p.Heures[1].VaguesM)
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
	// message brut de Go embarque l'URL demandee, cle comprise. base = meme
	// hote que cible : c'est bien le dial qui echoue ici, pas cibleAutorisee.
	base := "http://127.0.0.1:1"
	cible := base + "/tide-extrema?site=x&key=SECRET123"
	var dest any
	err := recupererJSON(context.Background(), &http.Client{Timeout: time.Second}, base, cible, &dest)
	if err == nil {
		t.Fatal("attendu une erreur : port injoignable")
	}
	if strings.Contains(err.Error(), "SECRET123") {
		t.Fatalf("l'erreur contient la cle API : %v", err)
	}
}

// TestCibleAutorisee couvre le garde SSRF (G704) de recupererJSON : seule
// une cible qui partage EXACTEMENT le scheme et l'hote de la base attendue
// pour cet appel passe.
func TestCibleAutorisee(t *testing.T) {
	cas := []struct {
		nom      string
		base     string
		cible    string
		attendue bool
	}{
		{"meme scheme et hote, chemin et requete differents", "https://api.open-meteo.com/v1/forecast", "https://api.open-meteo.com/v1/forecast?latitude=50.518", true},
		{"meme hote, chemin different", "https://api-maree.fr", "https://api-maree.fr/sites", true},
		{"hote different (attaquant)", "https://api.open-meteo.com/v1/forecast", "https://attaquant.example/vole?key=SECRET", false},
		{"scheme different, meme hote", "https://api.open-meteo.com/v1/forecast", "http://api.open-meteo.com/v1/forecast", false},
		{"sous-domaine different", "https://api.open-meteo.com/v1/forecast", "https://evil.api.open-meteo.com/v1/forecast", false},
		{"base illisible", "://", "https://api.open-meteo.com/v1/forecast", false},
		{"cible illisible", "https://api.open-meteo.com/v1/forecast", "://", false},
		{"base sans hote", "/relatif", "https://api.open-meteo.com/v1/forecast", false},
	}
	for _, c := range cas {
		if got := cibleAutorisee(c.base, c.cible); got != c.attendue {
			t.Errorf("%s : cibleAutorisee(%q, %q) = %v, attendu %v", c.nom, c.base, c.cible, got, c.attendue)
		}
	}
}

// TestRecupererJSON_RefuseCibleHorsBase est la preuve directe que le garde
// empeche la requete de PARTIR : le serveur "attaquant" ne doit jamais
// recevoir la connexion, alors meme qu'il est reellement joignable — seul un
// blocage avant http.NewRequestWithContext peut l'expliquer.
func TestRecupererJSON_RefuseCibleHorsBase(t *testing.T) {
	appele := false
	attaquant := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		appele = true
		w.WriteHeader(http.StatusOK)
	}))
	defer attaquant.Close()

	base := "https://fournisseur-legitime.example/v1/forecast"
	cible := attaquant.URL + "/vole?key=SECRET123"

	var dest any
	err := recupererJSON(context.Background(), attaquant.Client(), base, cible, &dest)
	if err == nil {
		t.Fatal("attendu un refus : l'hote de cible differe de celui de base")
	}
	if appele {
		t.Fatal("le garde n'a pas empeche la requete : le serveur cible l'a recue")
	}
	if strings.Contains(err.Error(), "SECRET123") {
		t.Fatalf("l'erreur contient la cle : %v", err)
	}
}

// TestCalculerConfiance couvre exactement la regle de
// prp/02-horizon-confiance-vent.md, section 3 : fonction pure, aucun reseau.
func TestCalculerConfiance(t *testing.T) {
	cas := []struct {
		nom              string
		temperatures     []float64
		pluies           []float64
		niveauAttendu    string
		nbModelesAttendu int
	}{
		{
			nom:              "accord serre a trois modeles : haute, pas de plafond",
			temperatures:     []float64{24.0, 24.5, 23.8},
			pluies:           []float64{20, 25},
			niveauAttendu:    "haute",
			nbModelesAttendu: 3,
		},
		{
			nom:              "desaccord franc sur la temperature",
			temperatures:     []float64{15, 20, 25},
			pluies:           []float64{20, 22},
			niveauAttendu:    "basse",
			nbModelesAttendu: 3,
		},
		{
			nom:              "un seul modele sur la temperature : confiance inconnue",
			temperatures:     []float64{20},
			pluies:           []float64{10, 12, 11},
			niveauAttendu:    "",
			nbModelesAttendu: 0,
		},
		{
			nom:              "pluie absente (un seul modele) : ignoree, niveau de la temperature seule, mais plafonne (2 modeles)",
			temperatures:     []float64{20, 20.2},
			pluies:           []float64{10},
			niveauAttendu:    "moyenne",
			nbModelesAttendu: 2,
		},
		{
			nom:              "le niveau du jour est le plus prudent des deux grandeurs",
			temperatures:     []float64{20, 20.1}, // accord serre : haute
			pluies:           []float64{10, 80},   // desaccord franc : basse
			niveauAttendu:    "basse",
			nbModelesAttendu: 2,
		},
		{
			nom:              "plafond a deux modeles : accord quasi parfait reste moyenne, jamais haute",
			temperatures:     []float64{20.0, 20.01},
			pluies:           nil,
			niveauAttendu:    "moyenne",
			nbModelesAttendu: 2,
		},
		{
			nom:              "plafond a deux modeles : ne remonte pas un desaccord franc",
			temperatures:     []float64{10, 30},
			pluies:           nil,
			niveauAttendu:    "basse",
			nbModelesAttendu: 2,
		},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			niveau, nbModeles := calculerConfiance(c.temperatures, c.pluies)
			if niveau != c.niveauAttendu {
				t.Errorf("niveau = %q, attendu %q", niveau, c.niveauAttendu)
			}
			if nbModeles != c.nbModelesAttendu {
				t.Errorf("nbModeles = %d, attendu %d", nbModeles, c.nbModelesAttendu)
			}
		})
	}
}

func TestEcartTypePopulation(t *testing.T) {
	if v := ecartTypePopulation(nil); v != 0 {
		t.Errorf("ecartTypePopulation(nil) = %v, attendu 0", v)
	}
	// Population, pas echantillon : division par n, pas n-1.
	got := ecartTypePopulation([]float64{2, 4, 4, 4, 5, 5, 7, 9})
	if arrondi2(got) != 2.0 {
		t.Errorf("ecartTypePopulation(...) = %v, attendu 2.0 (ecart-type de population connu)", got)
	}
}
