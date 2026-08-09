package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"time"
)

// ErrCleAbsente distingue « pas encore configure » d'une panne du
// fournisseur : la jauge de maree affiche alors « configuration requise »
// plutot qu'une erreur ou une valeur inventee (PRODUCT.md, capacites et
// contraintes).
var ErrCleAbsente = errors.New("API_MAREE_KEY absente")

// Extremum est une pleine ou basse mer. Coefficient est absent (nil) sur une
// basse mer : api-maree.fr ne le porte que sur les pleines mers, convention
// heritee du SHOM.
type Extremum struct {
	Type        string // "PM" (pleine mer) ou "BM" (basse mer)
	Heure       time.Time
	HauteurM    float64
	Coefficient *int
}

// Maree est l'etat de la jauge a l'instant de l'appel.
type Maree struct {
	HauteurM    float64
	HeureMesure time.Time
	Precedent   Extremum
	Prochain    Extremum
	// PositionPct est la fraction de TEMPS ecoulee entre Precedent et
	// Prochain (0 a 100), pas une fraction de hauteur : la maree n'est pas
	// lineaire en hauteur sur un cycle semi-diurne (00-ossature.md).
	PositionPct float64
	// Sens vaut "montante" quand Prochain est une pleine mer, "descendante"
	// sinon.
	Sens string
}

// ClientMaree interroge api-maree.fr pour un site fixe. Sans cle, Recuperer
// rend ErrCleAbsente sans jamais contacter le reseau : c'est un etat normal
// de l'application (secret non encore pose cote serveur), pas une panne.
type ClientMaree struct {
	BaseURL string
	HTTP    *http.Client
	Site    string
	CleAPI  string
}

func NouveauClientMaree(site, cleAPI string) *ClientMaree {
	return &ClientMaree{
		BaseURL: "https://api-maree.fr",
		HTTP:    &http.Client{Timeout: 10 * time.Second},
		Site:    site,
		CleAPI:  cleAPI,
	}
}

type extremumBrut struct {
	Type   string  `json:"type"`
	Time   string  `json:"time"`
	Height float64 `json:"height"`
	Coef   *int    `json:"coef"`
}

type reponseExtremaBrute struct {
	Data []struct {
		Date    string         `json:"date"`
		Extrema []extremumBrut `json:"extrema"`
	} `json:"data"`
}

type reponseNiveauxBrute struct {
	Data []struct {
		Time   string  `json:"time"`
		Height float64 `json:"height"`
	} `json:"data"`
}

// Recuperer utilise l'heure reelle. RecupererA, ci-dessous, prend l'heure en
// parametre explicite : c'est elle que les tests appellent, pour rester
// reproductibles sans dependre de l'horloge du poste qui les execute.
func (c *ClientMaree) Recuperer(ctx context.Context) (Maree, error) {
	return c.RecupererA(ctx, time.Now().In(parisTZ))
}

func (c *ClientMaree) RecupererA(ctx context.Context, maintenant time.Time) (Maree, error) {
	if c.CleAPI == "" {
		return Maree{}, ErrCleAbsente
	}

	// Une journee de part et d'autre de maintenant : large marge pour ne
	// jamais manquer l'extremum encadrant, y compris pres de minuit.
	extrema, err := c.recupererExtrema(ctx, maintenant.AddDate(0, 0, -1), maintenant.AddDate(0, 0, 1))
	if err != nil {
		return Maree{}, fmt.Errorf("horaires de maree : %w", err)
	}
	precedent, prochain, err := encadrer(extrema, maintenant)
	if err != nil {
		return Maree{}, err
	}

	hauteur, heureMesure, err := c.recupererHauteurActuelle(ctx, maintenant)
	if err != nil {
		return Maree{}, fmt.Errorf("hauteur d'eau : %w", err)
	}

	sens := "descendante"
	if prochain.Type == "PM" {
		sens = "montante"
	}

	total := prochain.Heure.Sub(precedent.Heure)
	ecoule := maintenant.Sub(precedent.Heure)
	position := 0.0
	if total > 0 {
		position = clamp(ecoule.Seconds()/total.Seconds()*100, 0, 100)
	}

	return Maree{
		HauteurM:    hauteur,
		HeureMesure: heureMesure,
		Precedent:   precedent,
		Prochain:    prochain,
		PositionPct: position,
		Sens:        sens,
	}, nil
}

func (c *ClientMaree) recupererExtrema(ctx context.Context, de, a time.Time) ([]Extremum, error) {
	url := fmt.Sprintf("%s/tide-extrema?site=%s&from=%s&to=%s&tz=Europe/Paris&key=%s",
		c.BaseURL, c.Site, de.Format("2006-01-02"), a.Format("2006-01-02"), c.CleAPI)
	var r reponseExtremaBrute
	if err := recupererJSON(ctx, c.HTTP, url, &r); err != nil {
		return nil, err
	}

	var extrema []Extremum
	for _, jour := range r.Data {
		for _, e := range jour.Extrema {
			heure, err := time.ParseInLocation("2006-01-02 15:04", jour.Date+" "+e.Time, parisTZ)
			if err != nil {
				continue
			}
			extrema = append(extrema, Extremum{
				Type:        e.Type,
				Heure:       heure,
				HauteurM:    e.Height,
				Coefficient: e.Coef,
			})
		}
	}
	sort.Slice(extrema, func(i, j int) bool { return extrema[i].Heure.Before(extrema[j].Heure) })
	return extrema, nil
}

func (c *ClientMaree) recupererHauteurActuelle(ctx context.Context, maintenant time.Time) (float64, time.Time, error) {
	de := maintenant.Add(-30 * time.Minute)
	a := maintenant.Add(30 * time.Minute)
	url := fmt.Sprintf("%s/water-levels?site=%s&from=%s&to=%s&step=10&tz=Europe/Paris&key=%s",
		c.BaseURL, c.Site,
		de.Format("2006-01-02T15:04"), a.Format("2006-01-02T15:04"), c.CleAPI)
	var r reponseNiveauxBrute
	if err := recupererJSON(ctx, c.HTTP, url, &r); err != nil {
		return 0, time.Time{}, err
	}
	if len(r.Data) == 0 {
		return 0, time.Time{}, fmt.Errorf("aucun point de hauteur d'eau retourne")
	}

	meilleur := r.Data[0]
	meilleurEcart := time.Duration(1<<63 - 1)
	for _, p := range r.Data {
		t, err := time.Parse(time.RFC3339, p.Time)
		if err != nil {
			continue
		}
		ecart := t.Sub(maintenant)
		if ecart < 0 {
			ecart = -ecart
		}
		if ecart < meilleurEcart {
			meilleur = p
			meilleurEcart = ecart
		}
	}
	t, err := time.Parse(time.RFC3339, meilleur.Time)
	if err != nil {
		return 0, time.Time{}, err
	}
	return meilleur.Height, t, nil
}

// encadrer trouve l'extremum precedent et le suivant autour de maintenant.
// Erreur si la liste ne les encadre pas (ex : fournisseur en panne partielle).
func encadrer(extrema []Extremum, maintenant time.Time) (precedent, prochain Extremum, err error) {
	trouvePrecedent, trouveProchain := false, false
	for _, e := range extrema {
		if !e.Heure.After(maintenant) {
			precedent = e
			trouvePrecedent = true
		}
		if e.Heure.After(maintenant) && !trouveProchain {
			prochain = e
			trouveProchain = true
		}
	}
	if !trouvePrecedent || !trouveProchain {
		return Extremum{}, Extremum{}, fmt.Errorf("horaires de maree incomplets autour de %s", maintenant.Format(time.RFC3339))
	}
	return precedent, prochain, nil
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
