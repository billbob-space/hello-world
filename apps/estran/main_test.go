package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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
		&ClientPluie{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
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
		NouveauClientPluie(50.517, 1.583),
		NouveauClientNowcast(50.517, 1.583),
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

// --- Navigation temporelle (prp/01-navigation-temporelle.md) ---

func TestParametreDate_Absent(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/previsions", nil)
	d, err := parametreDate(req, time.Now().In(parisTZ))
	if err != nil || d != nil {
		t.Fatalf("parametreDate sans parametre = (%v, %v), attendu (nil, nil)", d, err)
	}
}

func TestParametreDate_Illisible(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/previsions?date=demain", nil)
	_, err := parametreDate(req, time.Now().In(parisTZ))
	if err == nil {
		t.Fatal("attendu une erreur pour une date illisible")
	}
}

func TestParametreDate_HorsFenetre(t *testing.T) {
	maintenant := time.Date(2026, 8, 16, 12, 0, 0, 0, parisTZ)
	req := httptest.NewRequest(http.MethodGet, "/api/previsions?date=2026-10-15", nil)
	_, err := parametreDate(req, maintenant)
	if err == nil {
		t.Fatal("attendu une erreur pour une date hors de la fenetre -7/+15 jours")
	}
}

func TestParametreDate_Valide(t *testing.T) {
	maintenant := time.Date(2026, 8, 16, 12, 0, 0, 0, parisTZ)
	req := httptest.NewRequest(http.MethodGet, "/api/previsions?date=2026-08-20", nil)
	d, err := parametreDate(req, maintenant)
	if err != nil {
		t.Fatalf("parametreDate : %v", err)
	}
	if d == nil || d.Format("2006-01-02") != "2026-08-20" {
		t.Fatalf("date = %v, attendu 2026-08-20", d)
	}
}

func TestParametreDate_BornesIncluses(t *testing.T) {
	maintenant := time.Date(2026, 8, 16, 12, 0, 0, 0, parisTZ)
	for _, brut := range []string{"2026-08-09", "2026-08-31"} { // J-7 et J+15, exactement sur la borne
		req := httptest.NewRequest(http.MethodGet, "/api/previsions?date="+brut, nil)
		if _, err := parametreDate(req, maintenant); err != nil {
			t.Errorf("date %s (borne incluse) rejetee : %v", brut, err)
		}
	}
	for _, brut := range []string{"2026-08-08", "2026-09-01"} { // un jour au-dela de chaque borne
		req := httptest.NewRequest(http.MethodGet, "/api/previsions?date="+brut, nil)
		if _, err := parametreDate(req, maintenant); err == nil {
			t.Errorf("date %s (hors borne) acceptee, attendu une erreur", brut)
		}
	}
}

// construitFixtureMeteo genere une reponse Open-Meteo brute couvrant
// J-joursNavigationArriere a J+joursNavigationAvant (forecast_days=16,
// past_days=7 : Open-Meteo compte aujourd'hui dans sa fenetre, donc
// forecast_days=16 est necessaire pour que la borne haute reelle du
// fournisseur atteigne bien J+15, cf. meteo.go), une heure par heure et un
// jour par jour. La temperature encode le decalage en jours par rapport a
// `maintenant`, pour reconnaitre facilement quel jour est rendu dans les
// assertions.
func construitFixtureMeteo(maintenant time.Time) reponseForecastBrute {
	debut := debutDuJour(maintenant).AddDate(0, 0, -joursNavigationArriere)
	var r reponseForecastBrute
	for jour := 0; jour < joursNavigationArriere+joursNavigationAvant+1; jour++ {
		decalage := jour - joursNavigationArriere
		jourDebut := debut.AddDate(0, 0, jour)
		for h := 0; h < 24; h++ {
			r.Hourly.Time = append(r.Hourly.Time, jourDebut.Add(time.Duration(h)*time.Hour).Format("2006-01-02T15:04"))
			r.Hourly.Temperature2m = append(r.Hourly.Temperature2m, floatPtr(float64(decalage)))
			r.Hourly.PrecipitationProbability = append(r.Hourly.PrecipitationProbability, floatPtr(10))
			r.Hourly.CloudCover = append(r.Hourly.CloudCover, 20)
			r.Hourly.WindSpeed10m = append(r.Hourly.WindSpeed10m, floatPtr(15))
			r.Hourly.WindDirection10m = append(r.Hourly.WindDirection10m, floatPtr(90))
			r.Hourly.WeatherCode = append(r.Hourly.WeatherCode, 1)
		}
		r.Daily.Time = append(r.Daily.Time, jourDebut.Format("2006-01-02"))
		r.Daily.Temperature2mMax = append(r.Daily.Temperature2mMax, floatPtr(float64(decalage)+1))
		r.Daily.Temperature2mMin = append(r.Daily.Temperature2mMin, floatPtr(float64(decalage)))
		r.Daily.PrecipitationProbabilityMax = append(r.Daily.PrecipitationProbabilityMax, floatPtr(20))
		r.Daily.WeatherCode = append(r.Daily.WeatherCode, 1)
		r.Daily.WindSpeed10mMax = append(r.Daily.WindSpeed10mMax, floatPtr(25))
		r.Daily.WindGusts10mMax = append(r.Daily.WindGusts10mMax, floatPtr(40))
		r.Daily.WindDirection10mDominant = append(r.Daily.WindDirection10mDominant, floatPtr(180))
	}
	return r
}

func construitFixtureMarine(maintenant time.Time) reponseMarineBrute {
	debut := debutDuJour(maintenant).AddDate(0, 0, -joursNavigationArriere)
	var r reponseMarineBrute
	for jour := 0; jour < joursNavigationArriere+joursNavigationAvant+1; jour++ {
		jourDebut := debut.AddDate(0, 0, jour)
		for h := 0; h < 24; h++ {
			r.Hourly.Time = append(r.Hourly.Time, jourDebut.Add(time.Duration(h)*time.Hour).Format("2006-01-02T15:04"))
			r.Hourly.WaveHeight = append(r.Hourly.WaveHeight, floatPtr(0.5))
		}
	}
	return r
}

// serveurMeteoDeTest sert les fixtures ci-dessus quel que soit le contenu de
// la requete (comme le ferait le vrai fournisseur pour la fenetre demandee).
func serveurMeteoDeTest(t *testing.T, maintenant time.Time) *ClientMeteo {
	t.Helper()
	forecast := construitFixtureMeteo(maintenant)
	marine := construitFixtureMarine(maintenant)
	forecastCorps, err := json.Marshal(forecast)
	if err != nil {
		t.Fatalf("marshal forecast : %v", err)
	}
	marineCorps, err := json.Marshal(marine)
	if err != nil {
		t.Fatalf("marshal marine : %v", err)
	}
	srvForecast := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(forecastCorps)
	}))
	t.Cleanup(srvForecast.Close)
	srvMarine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(marineCorps)
	}))
	t.Cleanup(srvMarine.Close)
	return &ClientMeteo{BaseForecast: srvForecast.URL, BaseMarine: srvMarine.URL, HTTP: srvForecast.Client(), Latitude: 50.517, Longitude: 1.583}
}

func serveurEtRequetePrevisions(t *testing.T, urlChemin string) *httptest.ResponseRecorder {
	t.Helper()
	maintenant := time.Now().In(parisTZ)
	s := nouveauServeur(serveurMeteoDeTest(t, maintenant), NouveauClientMaree("berck-plage-fort-mahon", ""), NouveauClientPluie(50.517, 1.583), NouveauClientNowcast(50.517, 1.583))
	req := httptest.NewRequest(http.MethodGet, urlChemin, nil)
	rec := httptest.NewRecorder()
	s.handlePrevisions(rec, req)
	return rec
}

// TestHandlePrevisions_SansParametre_ReponseInchangee est la contrainte
// principale de prp/01-navigation-temporelle.md : sans `date`, la reponse
// doit rester celle d'aujourd'hui (au moins nombreHeuresMinimum heures —
// exactement combien depend de l'heure reelle a laquelle le test tourne,
// prp/02-horizon-confiance-vent.md section 1 —, aucun champ jour_affiche).
func TestHandlePrevisions_SansParametre_ReponseInchangee(t *testing.T) {
	rec := serveurEtRequetePrevisions(t, "/api/previsions")
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200", rec.Code)
	}
	var reponse ReponsePrevisions
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Heures) < nombreHeuresMinimum {
		t.Errorf("nombre d'heures = %d, attendu au moins %d", len(reponse.Heures), nombreHeuresMinimum)
	}
	if len(reponse.Jours) != nombreJoursAffiches {
		t.Errorf("nombre de jours = %d, attendu %d", len(reponse.Jours), nombreJoursAffiches)
	}
	if reponse.JourAffiche != "" || reponse.JourAfficheLibelle != "" {
		t.Errorf("jour_affiche/jour_affiche_libelle = %q/%q, attendu vides sans parametre date", reponse.JourAffiche, reponse.JourAfficheLibelle)
	}
}

func TestHandlePrevisions_JourPasse(t *testing.T) {
	hier := time.Now().In(parisTZ).AddDate(0, 0, -3).Format("2006-01-02")
	rec := serveurEtRequetePrevisions(t, "/api/previsions?date="+hier)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponsePrevisions
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Heures) != 24 {
		t.Fatalf("nombre d'heures = %d, attendu 24 (jour entier)", len(reponse.Heures))
	}
	if reponse.JourAffiche != hier {
		t.Errorf("JourAffiche = %q, attendu %q", reponse.JourAffiche, hier)
	}
	if len(reponse.Jours) != nombreJoursAffiches {
		t.Errorf("tendance = %d jour(s), attendu %d (ancree sur aujourd'hui malgre le jour passe regarde)", len(reponse.Jours), nombreJoursAffiches)
	}
}

func TestHandlePrevisions_JourFutur(t *testing.T) {
	demain := time.Now().In(parisTZ).AddDate(0, 0, 3).Format("2006-01-02")
	rec := serveurEtRequetePrevisions(t, "/api/previsions?date="+demain)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponsePrevisions
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Heures) != 24 {
		t.Fatalf("nombre d'heures = %d, attendu 24 (jour entier)", len(reponse.Heures))
	}
	if reponse.JourAffiche != demain {
		t.Errorf("JourAffiche = %q, attendu %q", reponse.JourAffiche, demain)
	}
}

// TestHandlePrevisions_DernierJourNavigable_A24Heures verifie que le jour le
// plus eloigne dans le futur qu'on puisse regarder (J+15) porte bien sa
// meteo, comme il porte deja sa maree : forecast_days doit valoir 16, pas
// 15, puisque Open-Meteo compte aujourd'hui dans sa propre fenetre (corrige
// dans prp/01-navigation-temporelle.md le 16 aout 2026, porte a 16 le 18
// aout 2026, prp/02-horizon-confiance-vent.md).
func TestHandlePrevisions_DernierJourNavigable_A24Heures(t *testing.T) {
	dernierJour := time.Now().In(parisTZ).AddDate(0, 0, joursNavigationAvant).Format("2006-01-02")
	rec := serveurEtRequetePrevisions(t, "/api/previsions?date="+dernierJour)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponsePrevisions
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Heures) != 24 {
		t.Fatalf("nombre d'heures pour J+%d = %d, attendu 24 (forecast_days doit couvrir jusqu'a ce jour)", joursNavigationAvant, len(reponse.Heures))
	}
}

func TestHandlePrevisions_DateIllisible(t *testing.T) {
	rec := serveurEtRequetePrevisions(t, "/api/previsions?date=pas-une-date")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
	var reponse map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse["erreur"] == "" {
		t.Error("attendu un champ erreur explicite")
	}
}

func TestHandlePrevisions_DateHorsFenetre(t *testing.T) {
	tropLoin := time.Now().In(parisTZ).AddDate(0, 0, 30).Format("2006-01-02")
	rec := serveurEtRequetePrevisions(t, "/api/previsions?date="+tropLoin)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
	var reponse map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse["erreur"] == "" {
		t.Error("attendu un champ erreur explicite")
	}
}

// --- /api/maree avec navigation ---

// construitFixtureExtrema genere un JSON tide-extrema couvrant plusieurs
// jours autour de `maintenant`, sauf un jour delibere sans aucune entree
// (pour tester la degradation "jour sans donnee").
func construitFixtureExtrema(maintenant time.Time) string {
	type extremumJSON struct {
		Type   string  `json:"type"`
		Time   string  `json:"time"`
		Height float64 `json:"height"`
		Coef   *int    `json:"coef,omitempty"`
	}
	type jourJSON struct {
		Date    string         `json:"date"`
		Extrema []extremumJSON `json:"extrema"`
	}
	coef := 70
	var jours []jourJSON
	for i := -joursNavigationArriere; i <= joursNavigationAvant; i++ {
		if i == 5 {
			// Jour delibere sans donnee : le fournisseur ne le couvre pas.
			continue
		}
		date := debutDuJour(maintenant).AddDate(0, 0, i).Format("2006-01-02")
		jours = append(jours, jourJSON{Date: date, Extrema: []extremumJSON{
			{Type: "BM", Time: "03:00", Height: 1.5},
			{Type: "PM", Time: "09:00", Height: 6.8, Coef: &coef},
			{Type: "BM", Time: "15:00", Height: 1.6},
			{Type: "PM", Time: "21:00", Height: 6.6, Coef: &coef},
		}})
	}
	corps, err := json.Marshal(struct {
		Data []jourJSON `json:"data"`
	}{Data: jours})
	if err != nil {
		panic(err)
	}
	return string(corps)
}

func serveurMareeDeTest(t *testing.T, maintenant time.Time) *ClientMaree {
	t.Helper()
	extremaCorps := construitFixtureExtrema(maintenant)
	niveauxCorps := fmt.Sprintf(`{"data":[{"time":%q,"height":4.2}]}`, maintenant.Format(time.RFC3339))
	mux := http.NewServeMux()
	mux.HandleFunc("/tide-extrema", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(extremaCorps))
	})
	mux.HandleFunc("/water-levels", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(niveauxCorps))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &ClientMaree{BaseURL: srv.URL, HTTP: srv.Client(), Site: "berck-plage-fort-mahon", CleAPI: "test-key"}
}

func requeteMaree(t *testing.T, urlChemin string) *httptest.ResponseRecorder {
	t.Helper()
	maintenant := time.Now().In(parisTZ)
	s := nouveauServeur(NouveauClientMeteo(50.517, 1.583), serveurMareeDeTest(t, maintenant), NouveauClientPluie(50.517, 1.583), NouveauClientNowcast(50.517, 1.583))
	req := httptest.NewRequest(http.MethodGet, urlChemin, nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)
	return rec
}

func TestHandleMaree_AvecDate_ExtremaDuJour(t *testing.T) {
	demain := time.Now().In(parisTZ).AddDate(0, 0, 1).Format("2006-01-02")
	rec := requeteMaree(t, "/api/maree?date="+demain)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponseMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if !reponse.Configure {
		t.Fatal("Configure doit etre true")
	}
	if reponse.HauteurM != nil || reponse.PositionPct != nil || reponse.Precedent != nil || reponse.Prochain != nil {
		t.Errorf("aucun champ de jauge instantanee attendu pour un jour choisi, recu %+v", reponse)
	}
	if len(reponse.Extrema) != 4 {
		t.Fatalf("Extrema = %d entree(s), attendu 4", len(reponse.Extrema))
	}
	if reponse.JourAffiche != demain {
		t.Errorf("JourAffiche = %q, attendu %q", reponse.JourAffiche, demain)
	}
}

// TestHandleMaree_JourSansDonneeDeMaree verifie la degradation : un jour
// dans la fenetre mais que le fournisseur ne couvre pas (cf.
// construitFixtureExtrema, decalage +5) rend une liste d'extrema vide,
// jamais une valeur inventee.
func TestHandleMaree_JourSansDonneeDeMaree(t *testing.T) {
	jourSansDonnee := time.Now().In(parisTZ).AddDate(0, 0, 5).Format("2006-01-02")
	rec := requeteMaree(t, "/api/maree?date="+jourSansDonnee)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponseMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if !reponse.Configure {
		t.Fatal("Configure doit etre true : ce n'est pas une panne, juste un jour sans extremum")
	}
	if len(reponse.Extrema) != 0 {
		t.Errorf("Extrema = %+v, attendu vide pour un jour non couvert par le fournisseur", reponse.Extrema)
	}
}

func TestHandleMaree_DateIllisible(t *testing.T) {
	rec := requeteMaree(t, "/api/maree?date=le-16-aout")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleMaree_DateHorsFenetre(t *testing.T) {
	tropLoin := time.Now().In(parisTZ).AddDate(0, 0, 40).Format("2006-01-02")
	rec := requeteMaree(t, "/api/maree?date="+tropLoin)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
}
