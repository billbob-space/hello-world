package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// HeureMeteo est un pas horaire de la prevision, tel qu'utilise par la vue a
// 5 heures. VaguesM est absent (nil) quand la reponse Marine ne couvre pas cet
// horodatage exact — cela arrive rarement (les deux fournisseurs partagent la
// meme grille horaire) mais ne doit jamais faire echouer toute la prevision.
type HeureMeteo struct {
	Heure            time.Time
	TemperatureC     float64
	PluiePct         float64
	NebulositePct    float64
	VentKmh          float64
	VentDirectionDeg float64
	VaguesM          *float64
	CodeMeteo        int
}

// JourMeteo est un pas journalier de la tendance a 7 jours.
type JourMeteo struct {
	Date        time.Time
	TempMinC    float64
	TempMaxC    float64
	PluiePctMax float64
	CodeMeteo   int
}

// Previsions rassemble la prevision horaire complete (la vue n'en garde que
// les 5 premieres heures) et la tendance journaliere.
type Previsions struct {
	Heures []HeureMeteo
	Jours  []JourMeteo
}

// ClientMeteo interroge Open-Meteo (previsions) et Open-Meteo Marine (etat de
// mer), sans cle : les deux API sont publiques et gratuites. Les URL de base
// sont des champs, pas des constantes, pour que les tests pointent vers un
// serveur local plutot que vers le reseau.
type ClientMeteo struct {
	BaseForecast string
	BaseMarine   string
	HTTP         *http.Client
	Latitude     float64
	Longitude    float64
}

func NouveauClientMeteo(lat, lon float64) *ClientMeteo {
	return &ClientMeteo{
		BaseForecast: "https://api.open-meteo.com/v1/forecast",
		BaseMarine:   "https://marine-api.open-meteo.com/v1/marine",
		HTTP:         &http.Client{Timeout: 10 * time.Second},
		Latitude:     lat,
		Longitude:    lon,
	}
}

type reponseForecastBrute struct {
	Hourly struct {
		Time                     []string  `json:"time"`
		Temperature2m            []float64 `json:"temperature_2m"`
		PrecipitationProbability []float64 `json:"precipitation_probability"`
		CloudCover               []float64 `json:"cloud_cover"`
		WindSpeed10m             []float64 `json:"wind_speed_10m"`
		WindDirection10m         []float64 `json:"wind_direction_10m"`
		WeatherCode              []int     `json:"weather_code"`
	} `json:"hourly"`
	Daily struct {
		Time                        []string  `json:"time"`
		Temperature2mMax            []float64 `json:"temperature_2m_max"`
		Temperature2mMin            []float64 `json:"temperature_2m_min"`
		PrecipitationProbabilityMax []float64 `json:"precipitation_probability_max"`
		WeatherCode                 []int     `json:"weather_code"`
	} `json:"daily"`
}

type reponseMarineBrute struct {
	Hourly struct {
		Time       []string  `json:"time"`
		WaveHeight []float64 `json:"wave_height"`
	} `json:"hourly"`
}

// Recuperer interroge les deux fournisseurs et fusionne leurs series horaires
// par horodatage. Un echec de la Marine API degrade (vagues absentes) plutot
// que de faire echouer toute la prevision ; un echec de la prevision
// principale, lui, est fatal a l'appel — sans elle il n'y a rien a fusionner.
func (c *ClientMeteo) Recuperer(ctx context.Context) (Previsions, error) {
	forecast, err := c.recupererForecast(ctx)
	if err != nil {
		return Previsions{}, fmt.Errorf("previsions : %w", err)
	}

	vagues := map[string]float64{}
	if marine, err := c.recupererMarine(ctx); err == nil {
		for i, t := range marine.Hourly.Time {
			if i < len(marine.Hourly.WaveHeight) {
				vagues[t] = marine.Hourly.WaveHeight[i]
			}
		}
	}

	heures := make([]HeureMeteo, 0, len(forecast.Hourly.Time))
	for i, t := range forecast.Hourly.Time {
		instant, err := time.ParseInLocation("2006-01-02T15:04", t, parisTZ)
		if err != nil {
			continue
		}
		h := HeureMeteo{
			Heure:            instant,
			TemperatureC:     valeurA(forecast.Hourly.Temperature2m, i),
			PluiePct:         valeurA(forecast.Hourly.PrecipitationProbability, i),
			NebulositePct:    valeurA(forecast.Hourly.CloudCover, i),
			VentKmh:          valeurA(forecast.Hourly.WindSpeed10m, i),
			VentDirectionDeg: valeurA(forecast.Hourly.WindDirection10m, i),
			CodeMeteo:        valeurEntiereA(forecast.Hourly.WeatherCode, i),
		}
		if v, ok := vagues[t]; ok {
			h.VaguesM = &v
		}
		heures = append(heures, h)
	}

	jours := make([]JourMeteo, 0, len(forecast.Daily.Time))
	for i, d := range forecast.Daily.Time {
		date, err := time.ParseInLocation("2006-01-02", d, parisTZ)
		if err != nil {
			continue
		}
		jours = append(jours, JourMeteo{
			Date:        date,
			TempMinC:    valeurA(forecast.Daily.Temperature2mMin, i),
			TempMaxC:    valeurA(forecast.Daily.Temperature2mMax, i),
			PluiePctMax: valeurA(forecast.Daily.PrecipitationProbabilityMax, i),
			CodeMeteo:   valeurEntiereA(forecast.Daily.WeatherCode, i),
		})
	}

	return Previsions{Heures: heures, Jours: jours}, nil
}

func (c *ClientMeteo) recupererForecast(ctx context.Context) (reponseForecastBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=7"+
			"&hourly=temperature_2m,precipitation_probability,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code"+
			"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
		c.BaseForecast, c.Latitude, c.Longitude)
	var r reponseForecastBrute
	err := recupererJSON(ctx, c.HTTP, url, &r)
	return r, err
}

func (c *ClientMeteo) recupererMarine(ctx context.Context) (reponseMarineBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=2&hourly=wave_height",
		c.BaseMarine, c.Latitude, c.Longitude)
	var r reponseMarineBrute
	err := recupererJSON(ctx, c.HTTP, url, &r)
	return r, err
}

// recupererJSON ne laisse jamais fuiter la chaine de requete dans une erreur :
// maree.go y passe la cle api-maree.fr en parametre, et http.Client renvoie
// des erreurs de type *url.Error qui embarquent l'URL complete telle
// qu'appelee. sansRequete() et causeSansURL() gardent l'erreur utile sans le
// secret.
func recupererJSON(ctx context.Context, client *http.Client, cible string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cible, nil)
	if err != nil {
		return fmt.Errorf("%s : requete invalide", sansRequete(cible))
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("%s : %w", sansRequete(cible), causeSansURL(err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s : statut %d", sansRequete(cible), resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}

// sansRequete retire la chaine de requete (donc toute cle d'API) d'une URL,
// pour ne garder que ce qui est sur de journaliser.
func sansRequete(cible string) string {
	u, err := url.Parse(cible)
	if err != nil {
		return "url illisible"
	}
	u.RawQuery = ""
	return u.String()
}

// causeSansURL extrait la cause d'une erreur reseau sans l'URL complete que
// http.Client y accole (*url.Error.Error() reimprime l'URL demandee, cle
// d'API comprise).
func causeSansURL(err error) error {
	var uerr *url.Error
	if errors.As(err, &uerr) {
		return uerr.Err
	}
	return err
}

func valeurA(s []float64, i int) float64 {
	if i < 0 || i >= len(s) {
		return 0
	}
	return s[i]
}

func valeurEntiereA(s []int, i int) int {
	if i < 0 || i >= len(s) {
		return 0
	}
	return s[i]
}

// libelleMeteo traduit un code meteo OMM (WMO) en un libelle et un symbole
// courts, en francais. Source unique cote serveur : la page ne duplique pas
// cette table en JavaScript.
func libelleMeteo(code int) (libelle, symbole string) {
	switch {
	case code == 0:
		return "ciel degage", "soleil"
	case code == 1:
		return "principalement degage", "soleil-voile"
	case code == 2:
		return "partiellement nuageux", "nuage-soleil"
	case code == 3:
		return "couvert", "nuage"
	case code == 45 || code == 48:
		return "brouillard", "brouillard"
	case code >= 51 && code <= 57:
		return "bruine", "pluie-fine"
	case code >= 61 && code <= 67:
		return "pluie", "pluie"
	case code >= 71 && code <= 77:
		return "neige", "neige"
	case code >= 80 && code <= 82:
		return "averses", "pluie"
	case code >= 85 && code <= 86:
		return "averses de neige", "neige"
	case code >= 95:
		return "orage", "orage"
	default:
		return "indetermine", "nuage"
	}
}
