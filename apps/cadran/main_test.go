package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newServeur(t *testing.T, loc *time.Location) http.Handler {
	t.Helper()
	page, err := template.ParseFS(assets, "page.html")
	if err != nil {
		t.Fatalf("modele illisible : %v", err)
	}
	return routes(page, loc)
}

func paris(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		// Sans time/tzdata, ce chargement echoue dans une image sans base de
		// fuseaux : c'est precisement ce que l'import blanc doit garantir.
		t.Fatalf("Europe/Paris introuvable — l'import time/tzdata a-t-il disparu ? %v", err)
	}
	return loc
}

func get(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

// C'est ici qu'est la seule vraie logique de l'application, et c'est ici qu'on
// se trompe : une aiguille des heures qui saute d'un trait a l'autre au lieu
// de deriver avec les minutes donne un cadran faux cinquante-neuf minutes sur
// soixante, et juste au moment ou on le regarde pour verifier.
func TestAnglesDesAiguilles(t *testing.T) {
	cas := []struct {
		nom              string
		h, m, s          int
		heure, min, secs float64
	}{
		{"minuit", 0, 0, 0, 0, 0, 0},
		{"midi, retour a zero", 12, 0, 0, 0, 0, 0},
		{"3 h pile", 3, 0, 0, 90, 0, 0},
		{"9 h pile", 9, 0, 0, 270, 0, 0},
		{"6 h 30 : l'aiguille des heures est a mi-chemin", 6, 30, 0, 195, 180, 0},
		{"15 h 45 : apres-midi ramene sur douze heures", 15, 45, 0, 112.5, 270, 0},
		{"23 h 59 min 59 s", 23, 59, 59, 359.9916666666667, 359.9, 354},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			a := angles(time.Date(2026, 8, 2, c.h, c.m, c.s, 0, time.UTC))
			proche(t, "heure", a.Heure, c.heure)
			proche(t, "minute", a.Minute, c.min)
			proche(t, "seconde", a.Seconde, c.secs)
		})
	}
}

func proche(t *testing.T, quoi string, obtenu, attendu float64) {
	t.Helper()
	const marge = 1e-6
	if d := obtenu - attendu; d > marge || d < -marge {
		t.Errorf("aiguille %s : %g°, attendu %g°", quoi, obtenu, attendu)
	}
}

// Les angles ne doivent jamais sortir de [0, 360) : une valeur negative ou
// au-dela d'un tour reste juste a l'ecran, mais trahit un calcul qui a derape.
func TestAnglesRestentDansUnTour(t *testing.T) {
	base := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	for i := range 24 * 60 {
		a := angles(base.Add(time.Duration(i) * time.Minute))
		for quoi, deg := range map[string]float64{"heure": a.Heure, "minute": a.Minute, "seconde": a.Seconde} {
			if deg < 0 || deg >= 360 {
				t.Fatalf("%s a %s : %g° hors de [0, 360)", quoi, base.Add(time.Duration(i)*time.Minute).Format("15:04"), deg)
			}
		}
	}
}

func TestHealthzRepond200(t *testing.T) {
	rec := get(t, newServeur(t, time.UTC), "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("corps %q, attendu \"ok\"", rec.Body.String())
	}
}

func TestApiHeureRendUnHorodatageExploitable(t *testing.T) {
	loc := paris(t)
	rec := get(t, newServeur(t, loc), "/api/heure")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}

	var h heureJSON
	if err := json.Unmarshal(rec.Body.Bytes(), &h); err != nil {
		t.Fatalf("reponse illisible en JSON : %v — %s", err, rec.Body.String())
	}
	if _, err := time.Parse(time.RFC3339Nano, h.ISO); err != nil {
		t.Errorf("iso %q n'est pas du RFC3339 : %v", h.ISO, err)
	}
	if h.Zone != "Europe/Paris" {
		t.Errorf("zone %q, attendu Europe/Paris", h.Zone)
	}
	// Paris est a UTC+1 ou UTC+2 selon la saison, jamais ailleurs.
	if h.Decalage != 3600 && h.Decalage != 7200 {
		t.Errorf("decalage %d s, attendu 3600 ou 7200", h.Decalage)
	}
	// Un battement mis en cache resynchroniserait la page sur le passe.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("Cache-Control %q, attendu no-store", cc)
	}
}

// La page doit porter les angles calcules au serveur : c'est ce qui fait
// qu'un cadran sans JavaScript est juste et fige, plutot que sans aiguilles.
func TestPagePorteLesAnglesCalculesAuServeur(t *testing.T) {
	rec := get(t, newServeur(t, paris(t)), "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	corps := rec.Body.String()

	for _, id := range []string{`id="aig-h"`, `id="aig-m"`, `id="aig-s"`} {
		if !strings.Contains(corps, id) {
			t.Errorf("aiguille absente de la page : %s", id)
		}
	}
	if !strings.Contains(corps, "transform: rotate(") {
		t.Error("aucune rotation dans la page : les aiguilles n'ont pas d'angle")
	}
	// html/template remplace par ZgotmplZ toute valeur qu'il juge douteuse en
	// contexte CSS. Le type template.CSS est justement la pour l'eviter.
	if strings.Contains(corps, "ZgotmplZ") {
		t.Error("html/template a neutralise une valeur CSS — les angles ne sont pas passes")
	}
	// L'horodatage de synchronisation, sur lequel le navigateur cale son ecart.
	if !strings.Contains(corps, `data-iso="`) {
		t.Error("data-iso absent : la page ne peut pas se synchroniser sur le serveur")
	}
}

func TestPagePorteLesGraduationsEtLesChiffres(t *testing.T) {
	corps := get(t, newServeur(t, time.UTC), "/").Body.String()
	if n := strings.Count(corps, `class="mark`); n != 60 {
		t.Errorf("%d graduations, attendu 60", n)
	}
	if n := strings.Count(corps, `class="mark major`); n != 12 {
		t.Errorf("%d graduations majeures, attendu 12", n)
	}
	if n := strings.Count(corps, `class="numeral"`); n != 4 {
		t.Errorf("%d chiffres, attendu 4", n)
	}
}

// L'en-tete porte la meme verite que l'ecran : verifier un deploiement ne
// demande pas d'ouvrir la page.
func TestEnteteVersionSurToutesLesReponses(t *testing.T) {
	h := newServeur(t, time.UTC)
	for _, chemin := range []string{"/", "/healthz", "/api/heure"} {
		if v := get(t, h, chemin).Header().Get("X-App-Version"); v != version {
			t.Errorf("%s : X-App-Version %q, attendu %q", chemin, v, version)
		}
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	if code := get(t, newServeur(t, time.UTC), "/ailleurs").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404", code)
	}
}

// Le contrat impose une app qui demarre sans intervention : un TZ mal
// orthographie doit degrader l'affichage, pas empecher le service.
func TestFuseauInconnuTombeSurUTC(t *testing.T) {
	if loc := chargerZone("Mars/Olympus_Mons"); loc != time.UTC {
		t.Errorf("fuseau inconnu resolu en %v, attendu UTC", loc)
	}
	if loc := chargerZone("Europe/Paris"); loc.String() != "Europe/Paris" {
		t.Errorf("fuseau connu resolu en %v", loc)
	}
}

func TestDateEnFrancais(t *testing.T) {
	cas := []struct {
		t       time.Time
		attendu string
	}{
		{time.Date(2026, 8, 2, 14, 3, 27, 0, time.UTC), "dimanche 2 aout 2026"},
		{time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), "samedi 1er aout 2026"},
		{time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC), "samedi 31 janvier 2026"},
	}
	for _, c := range cas {
		if got := dateFr(c.t); got != c.attendu {
			t.Errorf("dateFr(%s) = %q, attendu %q", c.t.Format("2006-01-02"), got, c.attendu)
		}
	}
}

func TestDecalageLisible(t *testing.T) {
	cas := []struct {
		secondes int
		attendu  string
	}{
		{0, "UTC+00:00"},
		{7200, "UTC+02:00"},
		{-18000, "UTC-05:00"},
		{19800, "UTC+05:30"}, // un fuseau a la demi-heure : Inde
	}
	for _, c := range cas {
		zone := time.FixedZone("test", c.secondes)
		if got := decalageFr(time.Date(2026, 8, 2, 0, 0, 0, 0, zone)); got != c.attendu {
			t.Errorf("decalage %d s = %q, attendu %q", c.secondes, got, c.attendu)
		}
	}
}

// Le format doit rester exactement celui que sait relire la page : la
// regex de litDecalage attend UTC(+|-)HH:MM, rien d'autre.
func TestDecalageSuitLeFormatAttenduParLaPage(t *testing.T) {
	got := decalageFr(time.Date(2026, 8, 2, 0, 0, 0, 0, time.FixedZone("test", 7200)))
	if len(got) != len("UTC+02:00") {
		t.Fatalf("format %q : la page ne saura pas le relire", got)
	}
}

func TestVersionRaccourcie(t *testing.T) {
	original := version
	t.Cleanup(func() { version = original })

	version = "abcdef1234567890"
	if got := shortVersion(); got != "abcdef1" {
		t.Errorf("shortVersion() = %q, attendu abcdef1", got)
	}
	version = "dev"
	if got := shortVersion(); got != "dev" {
		t.Errorf("shortVersion() = %q, attendu dev", got)
	}
}
