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
	Heure                time.Time
	TemperatureC         float64
	PluiePct             float64
	NebulositePct        float64
	NebulositeBassePct   float64
	NebulositeMoyennePct float64
	NebulositeHautePct   float64
	EstJour              bool
	VentKmh              float64
	VentDirectionDeg     float64
	VaguesM              *float64
	CodeMeteo            int
}

// JourMeteo est un pas journalier de la tendance a 7 jours.
// NebulositeBassePct/MoyennePct/HautePct sont l'agregat (moyenne) des heures
// de JOUR (EstJour) de cette date, calcule dans Recuperer a partir de la
// serie horaire — Open-Meteo ne rend pas ces couches en journalier.
// CouchesConnues dit si cet agregat existe (faux si aucune heure de jour
// n'est disponible pour la date, auquel cas les trois champs restent a 0 et
// ne doivent pas etre utilises).
type JourMeteo struct {
	Date                 time.Time
	TempMinC             float64
	TempMaxC             float64
	PluiePctMax          float64
	CodeMeteo            int
	NebulositeBassePct   float64
	NebulositeMoyennePct float64
	NebulositeHautePct   float64
	CouchesConnues       bool
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
		CloudCoverLow            []float64 `json:"cloud_cover_low"`
		CloudCoverMid            []float64 `json:"cloud_cover_mid"`
		CloudCoverHigh           []float64 `json:"cloud_cover_high"`
		IsDay                    []float64 `json:"is_day"`
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
			Heure:                instant,
			TemperatureC:         valeurA(forecast.Hourly.Temperature2m, i),
			PluiePct:             valeurA(forecast.Hourly.PrecipitationProbability, i),
			NebulositePct:        valeurA(forecast.Hourly.CloudCover, i),
			NebulositeBassePct:   valeurA(forecast.Hourly.CloudCoverLow, i),
			NebulositeMoyennePct: valeurA(forecast.Hourly.CloudCoverMid, i),
			NebulositeHautePct:   valeurA(forecast.Hourly.CloudCoverHigh, i),
			EstJour:              valeurA(forecast.Hourly.IsDay, i) == 1,
			VentKmh:              valeurA(forecast.Hourly.WindSpeed10m, i),
			VentDirectionDeg:     valeurA(forecast.Hourly.WindDirection10m, i),
			CodeMeteo:            valeurEntiereA(forecast.Hourly.WeatherCode, i),
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
		j := JourMeteo{
			Date:        date,
			TempMinC:    valeurA(forecast.Daily.Temperature2mMin, i),
			TempMaxC:    valeurA(forecast.Daily.Temperature2mMax, i),
			PluiePctMax: valeurA(forecast.Daily.PrecipitationProbabilityMax, i),
			CodeMeteo:   valeurEntiereA(forecast.Daily.WeatherCode, i),
		}
		if bas, moyenne, haute, ok := couchesJour(heures, date); ok {
			j.NebulositeBassePct = bas
			j.NebulositeMoyennePct = moyenne
			j.NebulositeHautePct = haute
			j.CouchesConnues = true
		}
		jours = append(jours, j)
	}

	return Previsions{Heures: heures, Jours: jours}, nil
}

// couchesJour moyenne les trois couches nuageuses des heures de JOUR
// (EstJour) de la date donnee. Open-Meteo ne rend pas cloud_cover_low/mid/
// high en journalier ; on les reconstitue depuis l'horaire, seule serie ou
// ils sont presents, pour que la tendance a 7 jours dise « soleil » quand la
// meme journee vue heure par heure le dit aussi (sinon les deux vues se
// contredisent, cf. le cas du 16 aout 2026 en tete de fichier). Ne compte
// que les heures de jour : melanger les couches nocturnes (souvent bouchees
// sans que cela genere quiconque) fausserait la moyenne.
func couchesJour(heures []HeureMeteo, date time.Time) (bas, moyenne, haute float64, ok bool) {
	debut := debutDuJour(date)
	fin := debut.AddDate(0, 0, 1)
	var n int
	for _, h := range heures {
		if h.Heure.Before(debut) || !h.Heure.Before(fin) || !h.EstJour {
			continue
		}
		bas += h.NebulositeBassePct
		moyenne += h.NebulositeMoyennePct
		haute += h.NebulositeHautePct
		n++
	}
	if n == 0 {
		return 0, 0, 0, false
	}
	return bas / float64(n), moyenne / float64(n), haute / float64(n), true
}

// forecast_days=8, pas 7 : Open-Meteo compte aujourd'hui dans sa fenetre, si
// bien que forecast_days=7 s'arreterait a J+6 et laisserait le dernier jour
// navigable (J+7) sans meteo alors que la maree, elle, le couvre deja
// (from/to explicites, maree.go) — verifie en direct le 16 aout 2026,
// corrige dans prp/01-navigation-temporelle.md. past_days=7 : les 7 jours
// precedents, ajoutes pour la navigation temporelle. La tendance a 7 jours
// (aujourd'hui a J+6) reste entierement couverte par ce meme appel.
func (c *ClientMeteo) recupererForecast(ctx context.Context) (reponseForecastBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=8&past_days=7"+
			"&hourly=temperature_2m,precipitation_probability,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,is_day,wind_speed_10m,wind_direction_10m,weather_code"+
			"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
		c.BaseForecast, c.Latitude, c.Longitude)
	var r reponseForecastBrute
	err := recupererJSON(ctx, c.HTTP, url, &r)
	return r, err
}

// recupererMarine portait forecast_days=2, suffisant pour les 5 prochaines
// heures mais pas pour un jour choisi jusqu'a 7 jours en avant : porte a 8
// (aujourd'hui compte dans la fenetre Open-Meteo, cf. recupererForecast
// ci-dessus), plus past_days=7 pour le passe
// (prp/01-navigation-temporelle.md).
func (c *ClientMeteo) recupererMarine(ctx context.Context) (reponseMarineBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=8&past_days=7&hourly=wave_height",
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

// cielApparent decrit le ciel tel qu'on le voit du sol, a partir des trois
// couches nuageuses plutot que de la nebulosite totale (le weather_code OMM
// des codes 0 a 3 n'est derive que de cette derniere, toutes couches
// confondues, et ment donc des qu'un voile haut se superpose a un ciel bas
// degage). Opacite ressentie = max(bas, 0.85*moyenne, 0.35*haute) : chaque
// coefficient dit combien la couche masque reellement le soleil — le
// stratus/cumulus bas le bouche, l'altostratus moyen l'attenue fortement,
// le cirrus haut ne fait que le voiler. Calage verifie en direct le 16 aout
// 2026 a 18h au Touquet (50.517/1.583), bulletin marine de reference "soleil
// franc" a l'appui : cloud_cover=100 (total, toutes couches), mais
// cloud_cover_low=0, cloud_cover_mid=45, cloud_cover_high=100,
// sunshine_duration=3600s, direct_radiation=157 W/m2 — un cirrus seul a 100%
// (haute=100, bas=moyenne=0) doit rendre "soleil-voile", jamais "couvert" ;
// c'est ce cas qui a fixe le coefficient 0.35 (100*0.35=35, sous le seuil de
// 50 qui bascule en "partiellement nuageux").
func cielApparent(bas, moyenne, haute float64) (libelle, symbole string) {
	opacite := bas
	if v := 0.85 * moyenne; v > opacite {
		opacite = v
	}
	if v := 0.35 * haute; v > opacite {
		opacite = v
	}
	switch {
	case opacite < 20:
		return "ciel degage", "soleil"
	case opacite < 50:
		return "principalement degage", "soleil-voile"
	case opacite < 80:
		return "partiellement nuageux", "nuage-soleil"
	default:
		return "couvert", "nuage"
	}
}

// libelleCiel rend la description affichee : le phenomene (brouillard,
// pluie, neige, orage...) quand le code OMM en decrit un, sinon le ciel vu
// du sol reconstitue depuis les trois couches nuageuses (cielApparent). Les
// codes 0 a 3 ne decrivent qu'une quantite de nuages, pas un phenomene :
// c'est la seule plage ou le code OMM est insuffisant (cf. cielApparent).
func libelleCiel(code int, bas, moyenne, haute float64) (libelle, symbole string) {
	if code <= 3 {
		return cielApparent(bas, moyenne, haute)
	}
	return libelleMeteo(code)
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
