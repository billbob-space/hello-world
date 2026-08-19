package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// serveurPluieDeTest rend un ClientPluie pointant vers un serveur local qui
// repond aux DEUX appels (horaire et quart d'heure) sur le meme chemin,
// distingues par leur chaine de requete — exactement comme le vrai
// fournisseur, qui n'a lui aussi qu'une seule route.
func serveurPluieDeTest(t *testing.T, minutely, hourly string, statutMinutely int) *ClientPluie {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(r.URL.RawQuery, "minutely_15") {
			if statutMinutely != http.StatusOK {
				w.WriteHeader(statutMinutely)
				return
			}
			_, _ = w.Write([]byte(minutely))
			return
		}
		_, _ = w.Write([]byte(hourly))
	}))
	t.Cleanup(srv.Close)
	return &ClientPluie{Base: srv.URL, HTTP: srv.Client(), Latitude: 50.517, Longitude: 1.583}
}

func TestClientPluie_Recuperer_FusionneLesDeuxEchelles(t *testing.T) {
	minutely := `{"minutely_15":{"time":["2026-08-19T00:00","2026-08-19T00:15","2026-08-19T00:30"],
	                              "precipitation":[0.4,null,0.2]}}`
	hourly := `{"hourly":{"time":["2026-08-19T00:00","2026-08-19T01:00"],"precipitation":[0.6,0.0]}}`

	s, err := serveurPluieDeTest(t, minutely, hourly, http.StatusOK).Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}

	// Le pas `null` ne produit AUCUN pas : c'est l'absence, pas un 0,0 mm, qui
	// dit ou s'arrete la portee du modele fin (prp/03-graphe-de-pluie.md).
	if len(s.Quarts) != 2 {
		t.Fatalf("quarts = %d, attendu 2 (le null ne compte pas)", len(s.Quarts))
	}
	if s.Quarts[0].Mm != 0.4 || s.Quarts[1].Mm != 0.2 {
		t.Errorf("quarts = %v, attendu 0.4 puis 0.2", s.Quarts)
	}
	if s.Quarts[1].Instant.Format("15:04") != "00:30" {
		t.Errorf("instant du second quart = %s, attendu 00:30 (le null saute, pas le decalage)", s.Quarts[1].Instant)
	}
	if len(s.Heures) != 2 {
		t.Fatalf("heures = %d, attendu 2", len(s.Heures))
	}
	// 0.0 est une VRAIE mesure (heure seche) et doit rester dans la serie :
	// seul `null` est une absence.
	if s.Heures[1].Mm != 0 {
		t.Errorf("seconde heure = %v, attendu 0 conserve", s.Heures[1].Mm)
	}
}

// TestClientPluie_Recuperer_FinEnPanne_DegradeSurHoraire : l'appel fin est un
// supplement, l'horaire est la promesse (prp/03-graphe-de-pluie.md, section 4).
func TestClientPluie_Recuperer_FinEnPanne_DegradeSurHoraire(t *testing.T) {
	hourly := `{"hourly":{"time":["2026-08-19T00:00"],"precipitation":[0.6]}}`

	s, err := serveurPluieDeTest(t, "", hourly, http.StatusInternalServerError).Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer ne doit pas echouer quand seul l'appel fin tombe : %v", err)
	}
	if len(s.Quarts) != 0 {
		t.Errorf("quarts = %d, attendu 0", len(s.Quarts))
	}
	if len(s.Heures) != 1 {
		t.Errorf("heures = %d, attendu 1 : l'horaire doit survivre a la panne du fin", len(s.Heures))
	}
}

func TestClientPluie_Recuperer_HoraireEnPanne_Echoue(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(srv.Close)
	c := &ClientPluie{Base: srv.URL, HTTP: srv.Client()}

	if _, err := c.Recuperer(context.Background()); err == nil {
		t.Fatal("Recuperer doit echouer quand l'horaire tombe : sans lui il n'y a pas de repli")
	}
}

// TestClientPluie_Recuperer_ModeleNommeDansLAppelFin garde le coeur de
// prp/03-graphe-de-pluie.md section 1 : sans `models=`, Open-Meteo comble les
// trous par interpolation et rend un quart d'heure inexistant sur seize jours.
func TestClientPluie_Recuperer_ModeleNommeDansLAppelFin(t *testing.T) {
	var requeteFine string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.RawQuery, "minutely_15") {
			requeteFine = r.URL.RawQuery
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":[],"precipitation":[]},"minutely_15":{"time":[],"precipitation":[]}}`))
	}))
	t.Cleanup(srv.Close)
	c := &ClientPluie{Base: srv.URL, HTTP: srv.Client()}

	if _, err := c.Recuperer(context.Background()); err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if !strings.Contains(requeteFine, "models="+modelePluieFine) {
		t.Errorf("requete fine = %q, attendu models=%s", requeteFine, modelePluieFine)
	}
}

// --- La bande de l'heure ----------------------------------------------------

func serveurNowcastDeTest(t *testing.T, corps string) *ClientNowcast {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(corps))
	}))
	t.Cleanup(srv.Close)
	return &ClientNowcast{Base: srv.URL, HTTP: srv.Client(), Latitude: 50.517, Longitude: 1.583}
}

func TestClientNowcast_Recuperer(t *testing.T) {
	corps := `{"position":{"name":"Le Touquet-Paris-Plage","rain_product_available":1},
	           "updated_on":1787141400,
	           "forecast":[{"dt":1787142300,"rain":2},{"dt":1787142600,"rain":9},
	                       {"dt":1787142900,"rain":null},{"dt":1787143200,"rain":1}]}`

	n, err := serveurNowcastDeTest(t, corps).Recuperer(context.Background())
	if err != nil {
		t.Fatalf("Recuperer : %v", err)
	}
	if n.Lieu != "Le Touquet-Paris-Plage" {
		t.Errorf("lieu = %q", n.Lieu)
	}
	// 9 est hors de l'echelle documentee (1-4) et null est une absence : ni
	// l'un ni l'autre ne doit produire un segment dont on ignore ce qu'il vaut.
	if len(n.Pas) != 2 {
		t.Fatalf("pas = %d, attendu 2 (hors echelle et null ecartes)", len(n.Pas))
	}
	if n.Pas[0].Niveau != 2 || n.Pas[1].Niveau != 1 {
		t.Errorf("niveaux = %v", n.Pas)
	}
	if n.MiseAJour.IsZero() {
		t.Error("mise a jour absente")
	}
}

// TestClientNowcast_Recuperer_ProduitAbsent : le fournisseur repond, mais n'a
// pas de prevision immediate sur ce point. Cas distinct d'une panne reseau —
// il ne doit pas resservir un dernier connu, qui serait une bande perimee.
func TestClientNowcast_Recuperer_ProduitAbsent(t *testing.T) {
	corps := `{"position":{"name":"Ailleurs","rain_product_available":0},"forecast":[]}`

	if _, err := serveurNowcastDeTest(t, corps).Recuperer(context.Background()); err != ErrNowcastIndisponible {
		t.Fatalf("erreur = %v, attendu ErrNowcastIndisponible", err)
	}
}

func TestClientNowcast_Recuperer_AucunPasUtilisable(t *testing.T) {
	corps := `{"position":{"name":"Le Touquet","rain_product_available":1},
	           "forecast":[{"dt":1787142300,"rain":null}]}`

	if _, err := serveurNowcastDeTest(t, corps).Recuperer(context.Background()); err != ErrNowcastIndisponible {
		t.Fatalf("erreur = %v, attendu ErrNowcastIndisponible pour une bande vide", err)
	}
}

// --- La vue -----------------------------------------------------------------

// serieDuJour fabrique une journee entiere de pas d'une duree donnee.
func serieDuJour(jour time.Time, pas time.Duration, mm float64) []PasPluie {
	var s []PasPluie
	for t := jour; t.Before(jour.AddDate(0, 0, 1)); t = t.Add(pas) {
		s = append(s, PasPluie{Instant: t, Mm: mm})
	}
	return s
}

func jourDeTest(t *testing.T, jour string) time.Time {
	t.Helper()
	d, err := time.ParseInLocation("2006-01-02", jour, parisTZ)
	if err != nil {
		t.Fatalf("date de test illisible : %v", err)
	}
	return d
}

func TestVuePluie_JourCouvertParLeFin_PasAuQuartDHeure(t *testing.T) {
	jour := jourDeTest(t, "2026-08-19")
	s := SeriePluie{
		Quarts: serieDuJour(jour, dureePasFin, 0.25),
		Heures: serieDuJour(jour, time.Hour, 1),
	}

	v := vuePluie(s, nil, jour.Add(10*time.Hour), true, nil)

	if v.Jour == nil {
		t.Fatal("courbe absente")
	}
	if v.Jour.Pas != "quart" {
		t.Fatalf("pas = %q, attendu quart", v.Jour.Pas)
	}
	if len(v.Jour.Points) != 96 {
		t.Errorf("points = %d, attendu 96", len(v.Jour.Points))
	}
	if v.Jour.TotalMm != 24 {
		t.Errorf("total = %v, attendu 24 (96 x 0,25)", v.Jour.TotalMm)
	}
	if v.Jour.MaxMm != 0.25 {
		t.Errorf("max = %v, attendu 0.25", v.Jour.MaxMm)
	}
}

// TestVuePluie_JourPartiellementCouvert_RetombeSurLHoraire est le cas du jour
// ou AROME s'arrete en cours de route : une courbe fine tronquee a 11 h se
// lirait « plus rien apres », ce qui est faux (prp/03-graphe-de-pluie.md).
func TestVuePluie_JourPartiellementCouvert_RetombeSurLHoraire(t *testing.T) {
	jour := jourDeTest(t, "2026-08-21")
	quarts := serieDuJour(jour, dureePasFin, 0.25)
	s := SeriePluie{
		Quarts: quarts[:44], // s'arrete a 11h00
		Heures: serieDuJour(jour, time.Hour, 1),
	}

	v := vuePluie(s, nil, jour, true, &jour)

	if v.Jour == nil {
		t.Fatal("courbe absente")
	}
	if v.Jour.Pas != "heure" {
		t.Fatalf("pas = %q, attendu heure : la couverture fine est partielle", v.Jour.Pas)
	}
	if len(v.Jour.Points) != 24 {
		t.Errorf("points = %d, attendu 24", len(v.Jour.Points))
	}
	if v.JourAffiche != "2026-08-21" {
		t.Errorf("jour_affiche = %q", v.JourAffiche)
	}
}

// TestVuePluie_SerieFineTrouee_RetombeSurLHoraire : une serie qui commence et
// finit au bon endroit mais a laquelle il manque des pas au milieu couvrirait
// les bornes sans couvrir la journee.
func TestVuePluie_SerieFineTrouee_RetombeSurLHoraire(t *testing.T) {
	jour := jourDeTest(t, "2026-08-19")
	quarts := serieDuJour(jour, dureePasFin, 0.25)
	trouee := append(append([]PasPluie{}, quarts[:40]...), quarts[48:]...)
	s := SeriePluie{Quarts: trouee, Heures: serieDuJour(jour, time.Hour, 1)}

	v := vuePluie(s, nil, jour, true, nil)

	if v.Jour == nil || v.Jour.Pas != "heure" {
		t.Fatalf("pas = %v, attendu heure pour une serie fine trouee", v.Jour)
	}
}

func TestVuePluie_AucuneSerie_Erreur(t *testing.T) {
	jour := jourDeTest(t, "2026-08-19")

	v := vuePluie(SeriePluie{}, nil, jour, false, nil)

	if v.Jour != nil {
		t.Error("courbe presente alors qu'aucune serie n'est disponible")
	}
	if v.Erreur == "" {
		t.Error("erreur attendue quand ni la courbe ni la bande n'existent")
	}
}

// TestVuePluie_BandeSeulementAujourdhui : la bande decrit les 60 prochaines
// minutes, notion qui n'a pas de sens sur un autre jour ; vide, elle serait
// indistinguable d'une heure seche (prp/03-graphe-de-pluie.md, section 2).
func TestVuePluie_BandeSeulementAujourdhui(t *testing.T) {
	aujourdhui := jourDeTest(t, "2026-08-19")
	demain := aujourdhui.AddDate(0, 0, 1)
	n := Nowcast{
		Lieu:      "Le Touquet-Paris-Plage",
		MiseAJour: aujourdhui.Add(10 * time.Hour),
		Pas:       []PasNowcast{{Instant: aujourdhui.Add(10*time.Hour + 5*time.Minute), Niveau: 3}},
	}
	s := SeriePluie{Heures: append(serieDuJour(aujourdhui, time.Hour, 0), serieDuJour(demain, time.Hour, 0)...)}
	maintenant := aujourdhui.Add(10 * time.Hour)

	if v := vuePluie(s, &n, maintenant, true, nil); v.Heure == nil {
		t.Fatal("bande absente sur aujourd'hui")
	} else if v.Heure.Pas[0].Libelle != "pluie modérée" {
		t.Errorf("libelle = %q, attendu « pluie modérée »", v.Heure.Pas[0].Libelle)
	} else if v.Heure.MiseAJour != "10:00" {
		t.Errorf("mise a jour = %q, attendu 10:00", v.Heure.MiseAJour)
	}

	if v := vuePluie(s, &n, maintenant, true, &demain); v.Heure != nil {
		t.Error("bande presente sur un autre jour que aujourd'hui")
	}
}

// --- La route ---------------------------------------------------------------

func TestHandlePluie_JourEntier(t *testing.T) {
	maintenant := time.Now().In(parisTZ)
	jour := debutDuJour(maintenant)
	var instants []string
	var valeurs []string
	for t := jour; t.Before(jour.AddDate(0, 0, 1)); t = t.Add(time.Hour) {
		instants = append(instants, `"`+t.Format("2006-01-02T15:04")+`"`)
		valeurs = append(valeurs, "0.1")
	}
	hourly := fmt.Sprintf(`{"hourly":{"time":[%s],"precipitation":[%s]}}`,
		strings.Join(instants, ","), strings.Join(valeurs, ","))

	s := nouveauServeur(
		NouveauClientMeteo(50.517, 1.583),
		NouveauClientMaree("berck-plage-fort-mahon", ""),
		serveurPluieDeTest(t, `{"minutely_15":{"time":[],"precipitation":[]}}`, hourly, http.StatusOK),
		&ClientNowcast{Base: "http://127.0.0.1:1", HTTP: http.DefaultClient},
	)
	req := httptest.NewRequest(http.MethodGet, "/api/pluie", nil)
	rec := httptest.NewRecorder()

	s.handlePluie(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d, attendu 200", rec.Code)
	}
	var reponse ReponsePluie
	if err := json.NewDecoder(rec.Body).Decode(&reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Jour == nil {
		t.Fatalf("courbe absente : %s", rec.Body.String())
	}
	if reponse.Jour.Pas != "heure" || len(reponse.Jour.Points) != 24 {
		t.Errorf("courbe = %s / %d points, attendu heure / 24", reponse.Jour.Pas, len(reponse.Jour.Points))
	}
	// La bande pointe vers une adresse injoignable : elle doit manquer sans
	// emporter la courbe ni produire une erreur de section.
	if reponse.Heure != nil {
		t.Error("bande presente alors que son fournisseur est injoignable")
	}
	if reponse.Erreur != "" {
		t.Errorf("erreur = %q, attendu vide : la courbe est la", reponse.Erreur)
	}
}

func TestHandlePluie_DateHorsFenetre(t *testing.T) {
	s := nouveauServeur(
		NouveauClientMeteo(50.517, 1.583),
		NouveauClientMaree("berck-plage-fort-mahon", ""),
		NouveauClientPluie(50.517, 1.583),
		NouveauClientNowcast(50.517, 1.583),
	)
	horsFenetre := time.Now().In(parisTZ).AddDate(0, 0, joursNavigationAvant+3).Format("2006-01-02")
	req := httptest.NewRequest(http.MethodGet, "/api/pluie?date="+horsFenetre, nil)
	rec := httptest.NewRecorder()

	s.handlePluie(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut = %d, attendu 400 hors fenetre de navigation", rec.Code)
	}
}
