package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
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
		&ClientMaree{BaseURL: "http://127.0.0.1:1", HTTP: http.DefaultClient, CleAPI: "x"},
		&ClientPluie{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&CatalogueMaree{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
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
		NouveauClientMeteo(),
		NouveauClientMaree(""), // pas de cle
		NouveauClientPluie(),
		NouveauClientNowcast(),
		NouveauCatalogueMaree(),
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
	return &ClientMeteo{BaseForecast: srvForecast.URL, BaseMarine: srvMarine.URL, HTTP: srvForecast.Client()}
}

func serveurEtRequetePrevisions(t *testing.T, urlChemin string) *httptest.ResponseRecorder {
	t.Helper()
	maintenant := time.Now().In(parisTZ)
	// clientPluie/clientNowcast pointent vers une adresse locale injoignable,
	// jamais vers le vrai fournisseur : le PRD de la fabrique interdit le
	// reseau reel dans les tests, meme quand le champ teste (previsions)
	// n'exerce ces clients qu'en parallele (handlePrevisions).
	s := nouveauServeur(
		serveurMeteoDeTest(t, maintenant),
		NouveauClientMaree(""),
		&ClientPluie{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		NouveauCatalogueMaree(),
	)
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
	return &ClientMaree{BaseURL: srv.URL, HTTP: srv.Client(), CleAPI: "test-key"}
}

func requeteMaree(t *testing.T, urlChemin string) *httptest.ResponseRecorder {
	t.Helper()
	maintenant := time.Now().In(parisTZ)
	s := nouveauServeur(
		&ClientMeteo{BaseForecast: "http://127.0.0.1:1", BaseMarine: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		serveurMareeDeTest(t, maintenant),
		&ClientPluie{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		NouveauCatalogueMaree(),
	)
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

// --- prp/04-le-lieu-devient-une-donnee.md -----------------------------------

func TestParametreLatLon(t *testing.T) {
	cas := []struct {
		nom            string
		query          string
		presentAttendu bool
		erreurAttendue bool
	}{
		{"absents", "", false, false},
		{"un seul (lat)", "lat=50.5", false, true},
		{"un seul (lon)", "lon=1.5", false, true},
		{"illisibles", "lat=x&lon=y", false, true},
		{"lat hors bornes", "lat=95&lon=1", false, true},
		{"lon hors bornes", "lat=45&lon=200", false, true},
		// strconv.ParseFloat("NaN", 64) reussit, et toute comparaison avec
		// NaN est fausse : sans garde explicite le controle de bornes laisse
		// passer NaN (+Inf/-Inf, eux, sont deja hors bornes).
		{"lat NaN", "lat=NaN&lon=1", false, true},
		{"lon NaN", "lat=45&lon=NaN", false, true},
		{"lat et lon NaN", "lat=NaN&lon=NaN", false, true},
		{"valides", "lat=50.5178&lon=1.5834", true, false},
	}
	for _, c := range cas {
		req := httptest.NewRequest(http.MethodGet, "/x?"+c.query, nil)
		_, _, present, err := parametreLatLon(req)
		if present != c.presentAttendu {
			t.Errorf("%s : present = %v, attendu %v", c.nom, present, c.presentAttendu)
		}
		if (err != nil) != c.erreurAttendue {
			t.Errorf("%s : err = %v, attendu erreur=%v", c.nom, err, c.erreurAttendue)
		}
	}
}

func TestParametreLatLon_ArrondiA3Decimales(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/x?lat=50.51784&lon=1.58341", nil)
	lat, lon, present, err := parametreLatLon(req)
	if err != nil || !present {
		t.Fatalf("parametreLatLon : lat=%v lon=%v present=%v err=%v", lat, lon, present, err)
	}
	if lat != 50.518 || lon != 1.583 {
		t.Errorf("lat/lon = %v/%v, attendu 50.518/1.583 (arrondi a 3 decimales)", lat, lon)
	}
}

func TestParametreLieuOuDefaut_Absent(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	lat, lon, err := parametreLieuOuDefaut(req)
	if err != nil || lat != latitude || lon != longitude {
		t.Errorf("lat/lon/err = %v/%v/%v, attendu le lieu par defaut", lat, lon, err)
	}
}

func TestArrondi3(t *testing.T) {
	if v := arrondi3(1.58341); v != 1.583 {
		t.Errorf("arrondi3(1.58341) = %v, attendu 1.583", v)
	}
	if v := arrondi3(-1.5836); v != -1.584 {
		t.Errorf("arrondi3(-1.5836) = %v, attendu -1.584", v)
	}
}

// serveurClientsInjoignables rend un serveur dont les quatre clients de
// donnees pointent vers une adresse locale injoignable : utile pour les
// tests qui n'exercent que le catalogue ou le geocodage.
func serveurClientsInjoignables(cat *CatalogueMaree) *serveur {
	return nouveauServeur(
		&ClientMeteo{BaseForecast: "http://127.0.0.1:1", BaseMarine: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientMaree{BaseURL: "http://127.0.0.1:1", HTTP: http.DefaultClient, CleAPI: "test-key"},
		&ClientPluie{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
		cat,
	)
}

// TestHandleMaree_LatLon_SiteProche verifie qu'un lieu present resout son
// site de maree par le catalogue (pas le site par defaut) et sert la jauge
// normalement (prp/04, section 3).
func TestHandleMaree_LatLon_SiteProche(t *testing.T) {
	maintenant := time.Now().In(parisTZ)
	cat := catalogueDeTest(t, []siteBrut{
		{ID: "berck-plage-fort-mahon", Nom: "Berck Plage – Fort Mahon", Lat: 50.335, Lon: 1.567},
	})
	s := serveurClientsInjoignables(cat)
	s.clientMaree = serveurMareeDeTest(t, maintenant)

	req := httptest.NewRequest(http.MethodGet, "/api/maree?lat=50.517&lon=1.583", nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)

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
	if reponse.SiteReference != "berck-plage-fort-mahon" {
		t.Errorf("SiteReference = %q, attendu berck-plage-fort-mahon", reponse.SiteReference)
	}
}

// TestHandleMaree_LatLon_CoteEloignee : Arras est a ~89,7 km de Berck (§1.1),
// au-dela de seuilSiteKm (30) mais en-deca de seuilFacadeKm (200).
func TestHandleMaree_LatLon_CoteEloignee(t *testing.T) {
	cat := catalogueDeTest(t, []siteBrut{
		{ID: "berck-plage-fort-mahon", Nom: "Berck Plage – Fort Mahon", Lat: 50.335, Lon: 1.567},
	})
	s := serveurClientsInjoignables(cat)

	req := httptest.NewRequest(http.MethodGet, "/api/maree?lat=50.2926&lon=2.7793", nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponseSansMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if !reponse.Configure || !reponse.SansMaree || reponse.Raison != raisonCoteEloignee {
		t.Errorf("reponse = %+v, attendu configure/sansMaree/cote-eloignee", reponse)
	}
	if reponse.DistanceKm == nil || *reponse.DistanceKm < 70 || *reponse.DistanceKm > 110 {
		t.Errorf("distanceKm = %v, attendu ~89,7", reponse.DistanceKm)
	}
	if reponse.SiteLePlusProche != "Berck Plage – Fort Mahon" {
		t.Errorf("siteLePlusProche = %q", reponse.SiteLePlusProche)
	}
}

// TestHandleMaree_LatLon_FacadeNonCouverte : Nice, dont le site le plus
// proche du catalogue est Bordeaux a 643,8 km (§1.1), au-dela de
// seuilFacadeKm (200).
func TestHandleMaree_LatLon_FacadeNonCouverte(t *testing.T) {
	cat := catalogueDeTest(t, []siteBrut{
		{ID: "bordeaux", Nom: "Bordeaux", Lat: 44.8378, Lon: -0.5792},
	})
	s := serveurClientsInjoignables(cat)

	req := httptest.NewRequest(http.MethodGet, "/api/maree?lat=43.7102&lon=7.262", nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)

	var reponse ReponseSansMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Raison != raisonFacadeNonCouverte {
		t.Errorf("raison = %q, attendu %q", reponse.Raison, raisonFacadeNonCouverte)
	}
}

// TestHandleMaree_LatLon_CatalogueIndisponible verifie la troisieme valeur du
// vocabulaire ferme (§4) : un catalogue jamais charge avec succes, jamais un
// site invente.
func TestHandleMaree_LatLon_CatalogueIndisponible(t *testing.T) {
	cat := &CatalogueMaree{Base: "http://127.0.0.1:1", HTTP: &http.Client{Timeout: time.Second}}
	s := serveurClientsInjoignables(cat)

	req := httptest.NewRequest(http.MethodGet, "/api/maree?lat=50.517&lon=1.583", nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)

	var reponse ReponseSansMaree
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Raison != raisonCatalogueIndisponible {
		t.Errorf("raison = %q, attendu %q", reponse.Raison, raisonCatalogueIndisponible)
	}
}

func TestHandleMaree_LatLonInvalide(t *testing.T) {
	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/maree?lat=200&lon=1", nil)
	rec := httptest.NewRecorder()
	s.handleMaree(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
}

// --- /api/lieux, /api/lieu ---------------------------------------------------

func TestHandleLieux_Recherche(t *testing.T) {
	ban := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[{"properties":{"name":"Le Touquet-Paris-Plage","context":"62, Pas-de-Calais, Hauts-de-France"},"geometry":{"coordinates":[1.583,50.517]}}]}`))
	}))
	t.Cleanup(ban.Close)
	marine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[0.4]}}`))
	}))
	t.Cleanup(marine.Close)
	ancienGeocode, ancienMarine := baseGeocode, baseMeteoMarine
	baseGeocode, baseMeteoMarine = ban.URL, marine.URL
	t.Cleanup(func() { baseGeocode, baseMeteoMarine = ancienGeocode, ancienMarine })

	cat := catalogueDeTest(t, []siteBrut{
		{ID: "berck-plage-fort-mahon", Nom: "Berck Plage – Fort Mahon", Lat: 50.335, Lon: 1.567},
	})
	s := serveurClientsInjoignables(cat)

	req := httptest.NewRequest(http.MethodGet, "/api/lieux?q=Touquet", nil)
	rec := httptest.NewRecorder()
	s.handleLieux(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var reponse ReponseLieux
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Lieux) != 1 {
		t.Fatalf("lieux = %d, attendu 1", len(reponse.Lieux))
	}
	l := reponse.Lieux[0]
	if l.Nom != "Le Touquet-Paris-Plage" {
		t.Errorf("nom = %q", l.Nom)
	}
	if l.Latitude != 50.517 || l.Longitude != 1.583 {
		t.Errorf("lat/lon = %v/%v, attendu 50.517/1.583", l.Latitude, l.Longitude)
	}
	if l.Littoral == nil || !*l.Littoral {
		t.Errorf("littoral = %v, attendu true", l.Littoral)
	}
	if l.Maree == nil || l.Maree.ID != "berck-plage-fort-mahon" {
		t.Errorf("maree = %+v, attendu berck-plage-fort-mahon", l.Maree)
	}
}

func TestHandleLieux_QueteVide(t *testing.T) {
	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/lieux", nil)
	rec := httptest.NewRecorder()
	s.handleLieux(rec, req)

	var reponse ReponseLieux
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(reponse.Lieux) != 0 {
		t.Errorf("lieux = %+v, attendu vide sans q", reponse.Lieux)
	}
}

func TestHandleLieux_BANIndisponible(t *testing.T) {
	ancien := baseGeocode
	baseGeocode = "http://127.0.0.1:1"
	t.Cleanup(func() { baseGeocode = ancien })

	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/lieux?q=x", nil)
	rec := httptest.NewRecorder()
	s.handleLieux(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200 (degradation, pas une erreur HTTP)", rec.Code)
	}
	var reponse ReponseLieux
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Erreur == "" {
		t.Error("attendu un champ erreur explicite")
	}
	if len(reponse.Lieux) != 0 {
		t.Errorf("lieux = %+v, attendu vide", reponse.Lieux)
	}
}

func TestHandleLieu_SurTerre(t *testing.T) {
	ban := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[{"properties":{"city":"Wimereux","context":"62, Pas-de-Calais, Hauts-de-France"},"geometry":{"coordinates":[1.611,50.767]}}]}`))
	}))
	t.Cleanup(ban.Close)
	marine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[0.6]}}`))
	}))
	t.Cleanup(marine.Close)
	ancienGeocode, ancienMarine := baseGeocode, baseMeteoMarine
	baseGeocode, baseMeteoMarine = ban.URL, marine.URL
	t.Cleanup(func() { baseGeocode, baseMeteoMarine = ancienGeocode, ancienMarine })

	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/lieu?lat=50.767&lon=1.611", nil)
	rec := httptest.NewRecorder()
	s.handleLieu(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200, corps %s", rec.Code, rec.Body.String())
	}
	var l Lieu
	if err := json.NewDecoder(rec.Body).Decode(&l); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if l.Nom != "Wimereux" {
		t.Errorf("nom = %q, attendu Wimereux", l.Nom)
	}
	if l.Littoral == nil || !*l.Littoral {
		t.Errorf("littoral = %v, attendu true", l.Littoral)
	}
}

// TestHandleLieu_EnMer verifie §3/§4 : la BAN rend Features vide en mer, et
// le Lieu sort SANS NOM, jamais un nom invente.
func TestHandleLieu_EnMer(t *testing.T) {
	ban := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[]}`))
	}))
	t.Cleanup(ban.Close)
	marine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[0.9]}}`))
	}))
	t.Cleanup(marine.Close)
	ancienGeocode, ancienMarine := baseGeocode, baseMeteoMarine
	baseGeocode, baseMeteoMarine = ban.URL, marine.URL
	t.Cleanup(func() { baseGeocode, baseMeteoMarine = ancienGeocode, ancienMarine })

	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/lieu?lat=50.7&lon=1.0", nil)
	rec := httptest.NewRecorder()
	s.handleLieu(rec, req)

	var l Lieu
	if err := json.NewDecoder(rec.Body).Decode(&l); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if l.Nom != "" {
		t.Errorf("nom = %q, attendu vide (en mer, aucun nom invente)", l.Nom)
	}
	if l.Littoral == nil || !*l.Littoral {
		t.Errorf("littoral = %v, attendu true (grille marine positive)", l.Littoral)
	}
}

func TestHandleLieu_ParametresManquants(t *testing.T) {
	s := serveurClientsInjoignables(NouveauCatalogueMaree())
	req := httptest.NewRequest(http.MethodGet, "/api/lieu", nil)
	rec := httptest.NewRecorder()
	s.handleLieu(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu %d", rec.Code, http.StatusBadRequest)
	}
}

// TestLogging_CheminEchappeContreInjection couvre G706 : r.URL.Path est le
// chemin DECODE d'une requete HTTP, donc un %0a dans l'URL y arrive en vrai
// saut de ligne. Sans echappement, il forgerait une seconde ligne de journal
// a partir d'une seule requete.
func TestLogging_CheminEchappeContreInjection(t *testing.T) {
	var buf bytes.Buffer
	ancienneSortie := log.Writer()
	ancienFlags := log.Flags()
	log.SetOutput(&buf)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(ancienneSortie)
		log.SetFlags(ancienFlags)
	})

	h := logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/x%0afausse-ligne-forgee", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	sortie := buf.String()
	lignes := strings.Count(sortie, "\n")
	if lignes != 1 {
		t.Fatalf("le chemin injecte a produit %d ligne(s) de journal, attendu 1 : %q", lignes, sortie)
	}
	if !strings.Contains(sortie, `"/x\nfausse-ligne-forgee"`) {
		t.Fatalf("le chemin doit apparaitre echappe (%%q) dans le journal : %q", sortie)
	}
}
