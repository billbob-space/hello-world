package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestHaversineKm_DistancesDeControle reprend quatre des six distances de
// controle de prp/04-le-lieu-devient-une-donnee.md, section 1.1 (les deux
// bornes du tableau, et deux points intermediaires), avec des coordonnees
// usuelles de ces villes : le PRP ne publie que les distances arrondies au
// dixieme, pas les coordonnees exactes des sites api-maree.fr retenus, d'ou
// une tolerance large plutot qu'une egalite stricte.
func TestHaversineKm_DistancesDeControle(t *testing.T) {
	cas := []struct {
		nom                     string
		lat1, lon1, lat2, lon2  float64
		attendueKm, toleranceKm float64
	}{
		{"Le Touquet -> Berck Plage - Fort Mahon", 50.517, 1.583, 50.335, 1.567, 20.1, 8},
		{"Arras -> Berck Plage - Fort Mahon", 50.2926, 2.7793, 50.335, 1.567, 89.7, 15},
		{"Lille -> Dunkerque", 50.6292, 3.0573, 51.0344, 2.3768, 77.9, 15},
		{"Nice -> Bordeaux", 43.7102, 7.262, 44.8378, -0.5792, 643.8, 30},
	}
	for _, c := range cas {
		d := haversineKm(c.lat1, c.lon1, c.lat2, c.lon2)
		if d < c.attendueKm-c.toleranceKm || d > c.attendueKm+c.toleranceKm {
			t.Errorf("%s : distance = %.1f km, attendu ~%.1f km (+/- %.0f)", c.nom, d, c.attendueKm, c.toleranceKm)
		}
	}
}

// TestHaversineKm_MemePoint verifie le cas degenere : distance nulle entre un
// point et lui-meme (garde-fou minimal de la formule).
func TestHaversineKm_MemePoint(t *testing.T) {
	if d := haversineKm(50.517, 1.583, 50.517, 1.583); d > 0.001 {
		t.Errorf("distance du point a lui-meme = %v, attendu ~0", d)
	}
}

func catalogueDeTest(t *testing.T, sites []siteBrut) *CatalogueMaree {
	t.Helper()
	corps, err := json.Marshal(reponseSitesBrute{Sites: sites})
	if err != nil {
		t.Fatalf("marshal sites : %v", err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(corps)
	}))
	t.Cleanup(srv.Close)
	return &CatalogueMaree{Base: srv.URL, HTTP: srv.Client()}
}

// TestCatalogueMaree_PlusProche_SeuilSiteKm verifie le seuil de 30 km
// (prp/04, section 2.2) : un site strictement sous le seuil est retenu, un
// site au-dela ne l'est pas — c'est siteMareeDuLieu, pas plusProche seul, qui
// applique le seuil ; plusProche doit donc rendre le site ET la distance,
// quel que soit son eloignement.
func TestCatalogueMaree_PlusProche_SeuilSiteKm(t *testing.T) {
	cat := catalogueDeTest(t, []siteBrut{
		{ID: "berck-plage-fort-mahon", Nom: "Berck Plage – Fort Mahon", Lat: 50.335, Lon: 1.567},
		{ID: "bordeaux", Nom: "Bordeaux", Lat: 44.841, Lon: -0.58},
	})

	// Le Touquet : ~20,1 km de Berck, sous le seuil de 30 km.
	site := siteMareeDuLieu(cat, context.Background(), 50.517, 1.583)
	if site == nil {
		t.Fatal("Le Touquet : attendu un site de maree sous 30 km, obtenu nil")
	}
	if site.ID != "berck-plage-fort-mahon" {
		t.Errorf("site = %q, attendu berck-plage-fort-mahon", site.ID)
	}
	if site.DistanceKm < 15 || site.DistanceKm > 25 {
		t.Errorf("distance = %v, attendu ~20,1 km", site.DistanceKm)
	}

	// Nice : le site le plus proche (Bordeaux) est a 643,8 km, tres au-dela
	// du seuil de 30 km : aucun site retenu.
	site = siteMareeDuLieu(cat, context.Background(), 43.7, 7.268)
	if site != nil {
		t.Errorf("Nice : attendu nil (aucun site sous 30 km), obtenu %+v", site)
	}
}

// TestCatalogueMaree_PlusProche_CatalogueIndisponible verifie que plusProche
// rend ok=false, jamais une valeur inventee, quand le catalogue n'a jamais pu
// etre charge (prp/04, section 4).
func TestCatalogueMaree_PlusProche_CatalogueIndisponible(t *testing.T) {
	cat := &CatalogueMaree{Base: "http://127.0.0.1:1", HTTP: &http.Client{Timeout: time.Second}}
	_, _, ok := cat.plusProche(context.Background(), 50.517, 1.583)
	if ok {
		t.Fatal("attendu ok=false, catalogue jamais charge")
	}
}

// --- Le geocodage : ordre lon/lat du GeoJSON (§1.3) -------------------------

// TestReponseBAN_OrdreLonLat verifie que reponseBAN decode bien
// geometry.coordinates dans l'ordre GeoJSON [lon, lat] — piege explicitement
// signale dans le PRP (§1.3) : une inversion silencieuse placerait tous les
// lieux hors de France.
func TestReponseBAN_OrdreLonLat(t *testing.T) {
	corps := `{"features":[{"properties":{"name":"Le Touquet-Paris-Plage","city":"Le Touquet-Paris-Plage","postcode":"62520","context":"62, Pas-de-Calais, Hauts-de-France"},"geometry":{"coordinates":[1.5836,50.5233]}}]}`
	var r reponseBAN
	if err := json.Unmarshal([]byte(corps), &r); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(r.Features) != 1 {
		t.Fatalf("features = %d, attendu 1", len(r.Features))
	}
	f := r.Features[0]
	lon, lat := f.Geometry.Coordinates[0], f.Geometry.Coordinates[1]
	if lon != 1.5836 {
		t.Errorf("coordinates[0] (lon) = %v, attendu 1.5836", lon)
	}
	if lat != 50.5233 {
		t.Errorf("coordinates[1] (lat) = %v, attendu 50.5233", lat)
	}
}

// --- littoral: null a froid (§2.1) ------------------------------------------

// TestResoudreLittoral_AFroid_RendNil verifie qu'un cache jamais alimente
// avec succes rend nil (« on ne sait pas encore »), jamais false
// (« interieur ») : c'est exactement l'erreur qu'un lieu de plage declare
// interieur par une panne reseau, que le PRP interdit (§2.1).
func TestResoudreLittoral_AFroid_RendNil(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)
	ancienneBase := baseMeteoMarine
	baseMeteoMarine = srv.URL
	t.Cleanup(func() { baseMeteoMarine = ancienneBase })

	cache := &dernierConnu[bool]{}
	l := resoudreLittoral(cache, context.Background(), srv.Client(), 43.7, 7.268)
	if l != nil {
		t.Errorf("littoral = %v, attendu nil (rien connu, appel en panne)", *l)
	}
}

// TestResoudreLittoral_ResertLeDernierConnu verifie qu'un echec APRES un
// succes ressert le dernier littoral connu de CE lieu, plutot que de basculer
// vers « interieur » (§2.1).
func TestResoudreLittoral_ResertLeDernierConnu(t *testing.T) {
	enPanne := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if enPanne {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[0.5]}}`))
	}))
	t.Cleanup(srv.Close)
	ancienneBase := baseMeteoMarine
	baseMeteoMarine = srv.URL
	t.Cleanup(func() { baseMeteoMarine = ancienneBase })

	cache := &dernierConnu[bool]{}
	if l := resoudreLittoral(cache, context.Background(), srv.Client(), 50.517, 1.583); l == nil || !*l {
		t.Fatalf("premier appel : littoral = %v, attendu true", l)
	}

	enPanne = true
	l := resoudreLittoral(cache, context.Background(), srv.Client(), 50.517, 1.583)
	if l == nil {
		t.Fatal("deuxieme appel (en panne) : littoral = nil, attendu le dernier connu (true)")
	}
	if !*l {
		t.Errorf("deuxieme appel : littoral = false, attendu true (dernier connu)")
	}
}

// TestLittoralPour_TerreEtMer verifie la regle du §1.2 : littoral se lit dans
// le CONTENU (au moins une hauteur de vague non nulle), jamais dans le code
// HTTP, qui rend 200 dans les deux cas.
func TestLittoralPour_TerreEtMer(t *testing.T) {
	mer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[0.8]}}`))
	}))
	t.Cleanup(mer.Close)
	terre := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"hourly":{"time":["2026-08-21T12:00"],"wave_height":[null]}}`))
	}))
	t.Cleanup(terre.Close)

	ancienneBase := baseMeteoMarine
	t.Cleanup(func() { baseMeteoMarine = ancienneBase })

	baseMeteoMarine = mer.URL
	l, err := littoralPour(context.Background(), mer.Client(), 50.517, 1.583)
	if err != nil || !l {
		t.Errorf("mer : littoral/err = %v/%v, attendu true/nil", l, err)
	}

	baseMeteoMarine = terre.URL
	l, err = littoralPour(context.Background(), terre.Client(), 50.629, 3.058)
	if err != nil || l {
		t.Errorf("terre : littoral/err = %v/%v, attendu false/nil", l, err)
	}
}

// --- Le geocodage : rechercherCommunes / inverserPoint (§1.3) --------------

func TestRechercherCommunes(t *testing.T) {
	var requete string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requete = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[{"properties":{"name":"Le Touquet-Paris-Plage","context":"62, Pas-de-Calais, Hauts-de-France"},"geometry":{"coordinates":[1.5836,50.5233]}}]}`))
	}))
	t.Cleanup(srv.Close)
	ancien := baseGeocode
	baseGeocode = srv.URL
	t.Cleanup(func() { baseGeocode = ancien })

	rep, err := rechercherCommunes(context.Background(), srv.Client(), "Le Touquet")
	if err != nil {
		t.Fatalf("rechercherCommunes : %v", err)
	}
	if len(rep.Features) != 1 || rep.Features[0].Properties.Name != "Le Touquet-Paris-Plage" {
		t.Errorf("features = %+v, attendu Le Touquet-Paris-Plage", rep.Features)
	}
	if !strings.Contains(requete, "type=municipality") || !strings.Contains(requete, "limit=8") {
		t.Errorf("requete = %q, attendu type=municipality et limit=8", requete)
	}
}

// TestInverserPoint_EnMer verifie le cas normal §1.3/§3 : en mer, la BAN rend
// une liste de resultats vide, jamais une erreur ni un nom invente.
func TestInverserPoint_EnMer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[]}`))
	}))
	t.Cleanup(srv.Close)
	ancien := baseGeocode
	baseGeocode = srv.URL
	t.Cleanup(func() { baseGeocode = ancien })

	rep, err := inverserPoint(context.Background(), srv.Client(), 50.7, 1.0)
	if err != nil {
		t.Fatalf("inverserPoint : %v", err)
	}
	if len(rep.Features) != 0 {
		t.Errorf("features = %+v, attendu vide (en mer)", rep.Features)
	}
}

func TestInverserPoint_SurTerre(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[{"properties":{"city":"Wimereux","context":"62, Pas-de-Calais, Hauts-de-France"},"geometry":{"coordinates":[1.611,50.767]}}]}`))
	}))
	t.Cleanup(srv.Close)
	ancien := baseGeocode
	baseGeocode = srv.URL
	t.Cleanup(func() { baseGeocode = ancien })

	rep, err := inverserPoint(context.Background(), srv.Client(), 50.767, 1.611)
	if err != nil {
		t.Fatalf("inverserPoint : %v", err)
	}
	if len(rep.Features) != 1 || rep.Features[0].Properties.City != "Wimereux" {
		t.Errorf("features = %+v, attendu Wimereux", rep.Features)
	}
}
