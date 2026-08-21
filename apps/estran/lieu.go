// Ce fichier fait du lieu une donnee (prp/04-le-lieu-devient-une-donnee.md) :
// ce qu'est un Lieu, comment on le trouve (recherche BAN, geolocalisation
// inverse BAN), et ce qu'on sait dire de lui (littoral, site de maree le
// plus proche). Il ne touche pas a l'ecran, qui reste hors de ce document.
package main

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// Lieu est ce que l'application sait d'un point : son nom (recherche ou
// geolocalisation), s'il est littoral, et le site de maree le plus proche
// s'il y en a un a moins de seuilSiteKm (prp/04, section 2).
type Lieu struct {
	Nom       string  `json:"nom"`
	Contexte  string  `json:"contexte,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// Littoral est nil quand la grille marine n'a jamais pu etre interrogee
	// avec succes pour ce lieu (§2.1) : « on ne sait pas encore », jamais
	// « interieur » par defaut. Pas de omitempty : le JSON doit porter
	// `"littoral": null` explicitement plutot que d'omettre le champ.
	Littoral *bool `json:"littoral"`
	// Maree est nil des qu'aucun site du catalogue n'est a moins de
	// seuilSiteKm — cas normal de toute la Mediterranee (§2.2), pas une
	// panne : distinct du corps ReponseSansMaree que rend /api/maree, qui
	// porte en plus la RAISON de l'absence.
	Maree *SiteMaree `json:"maree,omitempty"`
}

// SiteMaree est le site api-maree.fr le plus proche d'un lieu. DistanceKm
// s'affiche toujours (§2.2) : c'est ce qui permet a qui lit de juger
// l'approximation lui-meme.
type SiteMaree struct {
	ID         string  `json:"id"`
	Nom        string  `json:"nom"`
	DistanceKm float64 `json:"distance_km"`
}

// seuilSiteKm/seuilFacadeKm bornent §2.2 et §3 : sous seuilSiteKm, le site le
// plus proche est retenu comme site de reference du lieu ; au-dela de
// seuilFacadeKm, le site le plus proche n'est meme plus une facade couverte
// (la Mediterranee vue de Bordeaux, 643,8 km) — /api/maree distingue les deux
// cas par la raison rendue (cote-eloignee / facade-non-couverte).
const (
	seuilSiteKm   = 30.0
	seuilFacadeKm = 200.0
)

// rayonTerreKm est le rayon moyen utilise par la formule de haversine.
const rayonTerreKm = 6371.0

// haversineKm rend la distance en kilometres entre deux points, en degres.
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return rayonTerreKm * c
}

// --- Le catalogue de marees (§1.1, §4) --------------------------------------

// siteBrut decode une entree de la reponse d'api-maree.fr/sites.
type siteBrut struct {
	ID  string  `json:"site_id"`
	Nom string  `json:"site_name"`
	Lat float64 `json:"latitude"`
	Lon float64 `json:"longitude"`
}

type reponseSitesBrute struct {
	Sites []siteBrut `json:"sites"`
}

// ttlCatalogueMaree : le catalogue se rafraichit au plus une fois par 24h
// (§4) — 131 sites qui ne bougent pas d'une heure a l'autre.
const ttlCatalogueMaree = 24 * time.Hour

// baseMareeSites est l'URL de production du catalogue api-maree.fr,
// redirigeable par variable d'environnement pour le bout en bout — meme
// raison que baseMeteoForecast dans meteo.go. En production,
// ESTRAN_BASE_MAREE_SITES n'est jamais posee : le defaut, inchange,
// s'applique. Distincte de baseMaree (maree.go) bien que meme hote par
// defaut : le catalogue (/sites, sans cle) et les horaires (/tide-extrema,
// /water-levels, avec cle) sont deux usages independants, et le bout en bout
// doit pouvoir les rediriger separement.
var baseMareeSites = env("ESTRAN_BASE_MAREE_SITES", "https://api-maree.fr")

// CatalogueMaree charge paresseusement les sites d'api-maree.fr et les garde
// en memoire, rafraichis au plus une fois par ttlCatalogueMaree. Un echec de
// chargement ne casse rien (§4) : sites() ressert la derniere liste connue si
// elle existe, et rend l'erreur seulement a froid — c'est cette erreur qui
// distingue « catalogue jamais charge » (raison catalogue-indisponible,
// main.go) d'un site simplement trop loin.
type CatalogueMaree struct {
	Base string
	HTTP *http.Client

	mu      sync.Mutex
	sites   []siteBrut
	charge  bool
	chargeA time.Time
}

func NouveauCatalogueMaree() *CatalogueMaree {
	return &CatalogueMaree{Base: baseMareeSites, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

func (c *CatalogueMaree) obtenirSites(ctx context.Context) ([]siteBrut, error) {
	c.mu.Lock()
	besoinRafraichissement := !c.charge || time.Since(c.chargeA) > ttlCatalogueMaree
	actuels, dejaCharge := c.sites, c.charge
	c.mu.Unlock()

	if !besoinRafraichissement {
		return actuels, nil
	}

	var r reponseSitesBrute
	err := recupererJSON(ctx, c.HTTP, c.Base, c.Base+"/sites", &r)

	c.mu.Lock()
	defer c.mu.Unlock()
	if err != nil {
		if dejaCharge {
			return c.sites, nil // dernier connu ; l'appelant journalise l'echec s'il le souhaite
		}
		return nil, err
	}
	c.sites, c.charge, c.chargeA = r.Sites, true, time.Now()
	return c.sites, nil
}

// plusProche rend le site le plus proche de (lat,lon) et sa distance en km,
// quel que soit le seuil retenu ensuite par l'appelant (§2.2, §3). ok=false
// seulement si le catalogue n'a jamais pu etre charge — distinct de « aucun
// site » qui n'existe pas ici, api-maree.fr en portant toujours au moins un.
func (c *CatalogueMaree) plusProche(ctx context.Context, lat, lon float64) (site siteBrut, distanceKm float64, ok bool) {
	sites, err := c.obtenirSites(ctx)
	if err != nil || len(sites) == 0 {
		return siteBrut{}, 0, false
	}
	meilleur := sites[0]
	meilleureDist := haversineKm(lat, lon, meilleur.Lat, meilleur.Lon)
	for _, s := range sites[1:] {
		if d := haversineKm(lat, lon, s.Lat, s.Lon); d < meilleureDist {
			meilleur, meilleureDist = s, d
		}
	}
	return meilleur, meilleureDist, true
}

// --- Le geocodage : Base Adresse Nationale (§1.3) ---------------------------

// baseGeocode est l'URL de production de la BAN, redirigeable par variable
// d'environnement pour le bout en bout — meme raison que baseMeteoForecast
// dans meteo.go. En production, ESTRAN_BASE_GEOCODE n'est jamais posee : le
// defaut, inchange, s'applique.
var baseGeocode = env("ESTRAN_BASE_GEOCODE", "https://api-adresse.data.gouv.fr")

// reponseBAN decode le GeoJSON commun a /search et /reverse. Coordinates est
// [lon, lat], PAS [lat, lon] : piege classique du GeoJSON, verifie le 21 aout
// 2026 (§1.3).
type reponseBAN struct {
	Features []struct {
		Properties struct {
			Name     string `json:"name"`
			City     string `json:"city"`
			Postcode string `json:"postcode"`
			Context  string `json:"context"`
		} `json:"properties"`
		Geometry struct {
			Coordinates [2]float64 `json:"coordinates"`
		} `json:"geometry"`
	} `json:"features"`
}

// rechercherCommunes interroge /search (type=municipality, limit=8) : la
// recherche par nom de l'ecran de choix (§1.3, §3).
func rechercherCommunes(ctx context.Context, http *http.Client, texte string) (reponseBAN, error) {
	u := fmt.Sprintf("%s/search/?q=%s&type=municipality&limit=8", baseGeocode, url.QueryEscape(texte))
	var r reponseBAN
	err := recupererJSON(ctx, http, baseGeocode, u, &r)
	return r, err
}

// inverserPoint interroge /reverse : resout un point en adresse. En mer, ou
// hors de France, rend Features vide — cas normal, pas une panne (§1.3, §3).
func inverserPoint(ctx context.Context, http *http.Client, lat, lon float64) (reponseBAN, error) {
	u := fmt.Sprintf("%s/reverse/?lat=%.5f&lon=%.5f", baseGeocode, lat, lon)
	var r reponseBAN
	err := recupererJSON(ctx, http, baseGeocode, u, &r)
	return r, err
}

// --- Le caractere littoral (§1.2, §2.1) -------------------------------------

// littoralPour interroge la grille marine (meme fournisseur qu'Open-Meteo
// Marine, meteo.go) sur une fenetre courte : « littoral » se lit dans le
// CONTENU de la reponse (au moins une hauteur de vague non nulle), jamais
// dans le code HTTP, qui rend 200 partout, y compris a Arras et Lille
// (verifie le 21 aout 2026).
func littoralPour(ctx context.Context, http *http.Client, lat, lon float64) (bool, error) {
	u := fmt.Sprintf("%s?latitude=%.3f&longitude=%.3f&timezone=Europe%%2FParis&forecast_days=1&hourly=wave_height", baseMeteoMarine, lat, lon)
	var r reponseMarineBrute
	if err := recupererJSON(ctx, http, baseMeteoMarine, u, &r); err != nil {
		return false, err
	}
	for _, v := range r.Hourly.WaveHeight {
		if v != nil {
			return true, nil
		}
	}
	return false, nil
}

// resoudreLittoral applique la degradation de §2.1 au dernier connu DE CE
// LIEU (cache deja selectionne par l'appelant, main.go : parLieu[bool].pour) :
// un echec resert le dernier littoral connu de ce lieu, et seulement a froid
// (rien connu) rend nil — jamais « interieur » par defaut.
func resoudreLittoral(cache *dernierConnu[bool], ctx context.Context, http *http.Client, lat, lon float64) *bool {
	v, _, _, err := cache.rafraichir(func() (bool, error) {
		return littoralPour(ctx, http, lat, lon)
	})
	if err != nil {
		return nil
	}
	r := v
	return &r
}

// siteMareeDuLieu construit le SiteMaree d'un Lieu (§2.2) a partir du site le
// plus proche et de sa distance : nil si aucun n'est a moins de seuilSiteKm,
// ou si le catalogue est indisponible (auquel cas ok=false et le Lieu ne dit
// simplement rien de sa maree, plutot que d'inventer un site).
func siteMareeDuLieu(cat *CatalogueMaree, ctx context.Context, lat, lon float64) *SiteMaree {
	site, dist, ok := cat.plusProche(ctx, lat, lon)
	if !ok || dist > seuilSiteKm {
		return nil
	}
	return &SiteMaree{ID: site.ID, Nom: site.Nom, DistanceKm: arrondi1(dist)}
}

// --- Les reponses des routes /api/lieux et /api/maree (sansMaree) ----------

// ReponseLieux est le corps de /api/lieux (§3). Erreur n'est renseignee que
// lorsque la recherche elle-meme a echoue : la liste reste alors vide plutot
// qu'absente, pour que l'ecran garde une forme stable.
type ReponseLieux struct {
	Lieux  []Lieu `json:"lieux"`
	Erreur string `json:"erreur,omitempty"`
}

// ReponseSansMaree est le corps explicite de /api/maree quand le lieu regarde
// n'a pas de site a moins de seuilSiteKm (§3). Les cles JSON reprennent EXACTEMENT
// celles du PRP (camelCase, distinctes du reste de l'API en snake_case) :
// aucune normalisation locale, pour rester l'autorite au mot pres.
type ReponseSansMaree struct {
	Configure        bool     `json:"configure"`
	SansMaree        bool     `json:"sansMaree"`
	Raison           string   `json:"raison"`
	DistanceKm       *float64 `json:"distanceKm,omitempty"`
	SiteLePlusProche string   `json:"siteLePlusProche,omitempty"`
}

// Vocabulaire ferme de ReponseSansMaree.Raison (§3, §4).
const (
	raisonCoteEloignee          = "cote-eloignee"
	raisonFacadeNonCouverte     = "facade-non-couverte"
	raisonCatalogueIndisponible = "catalogue-indisponible"
)
