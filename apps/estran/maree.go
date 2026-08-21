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
	// Tendance resume chaque jour de la fenetre affichee (nombreJoursAffiches
	// jours a partir d'aujourd'hui) : la plus haute pleine mer et la plus
	// basse basse mer du jour. nil pour un jour sans extremum retourne par
	// le fournisseur, jamais une valeur inventee.
	Tendance []JourMaree
	// Extrema porte la fenetre entiere recuperee aupres du fournisseur
	// (aujourd'hui -joursNavigationArriere a +joursNavigationAvant jours,
	// triee par heure croissante) : elle permet de decouper les extrema d'un
	// jour choisi (navigation temporelle) sans appel HTTP supplementaire —
	// « un seul appel sortant par fournisseur, quel que soit le jour
	// demande » (prp/01-navigation-temporelle.md).
	Extrema []Extremum
}

// JourMaree resume un jour pour la tendance a 16 jours. HauteM/BasseM/
// Coefficient restent nil quand le fournisseur n'a rien retourne pour ce
// jour-la, plutot que de tomber a zero — un zero se lirait comme une mesure.
type JourMaree struct {
	Date        time.Time
	HauteM      *float64
	BasseM      *float64
	Coefficient *int
}

// ClientMaree interroge api-maree.fr. Sans cle, Recuperer rend ErrCleAbsente
// sans jamais contacter le reseau : c'est un etat normal de l'application
// (secret non encore pose cote serveur), pas une panne. Le site n'est plus un
// champ du client (prp/04-le-lieu-devient-une-donnee.md) : il varie desormais
// avec le lieu regarde, et se passe en argument de Recuperer/RecupererA.
type ClientMaree struct {
	BaseURL string
	HTTP    *http.Client
	CleAPI  string
}

// baseMaree est l'URL de production d'api-maree.fr, redirigeable par
// variable d'environnement pour le bout en bout (apps/estran/e2e/) — voir le
// commentaire de baseMeteoForecast dans meteo.go, meme raison. En production,
// ESTRAN_BASE_MAREE n'est jamais posee : le defaut, inchange, s'applique.
var baseMaree = env("ESTRAN_BASE_MAREE", "https://api-maree.fr")

func NouveauClientMaree(cleAPI string) *ClientMaree {
	return &ClientMaree{
		BaseURL: baseMaree,
		HTTP:    &http.Client{Timeout: 10 * time.Second},
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
// reproductibles sans dependre de l'horloge du poste qui les execute. site
// est l'identifiant api-maree.fr du site le plus proche du lieu regarde
// (lieu.go) : ce n'est plus un champ fixe du client.
func (c *ClientMaree) Recuperer(ctx context.Context, site string) (Maree, error) {
	return c.RecupererA(ctx, time.Now().In(parisTZ), site)
}

func (c *ClientMaree) RecupererA(ctx context.Context, maintenant time.Time, site string) (Maree, error) {
	if c.CleAPI == "" {
		return Maree{}, ErrCleAbsente
	}

	// Une seule requete d'extrema couvre desormais trois besoins : encadrer
	// l'instant present pour la jauge, couvrir la fenetre de tendance
	// affichee (nombreJoursAffiches jours) et couvrir toute la fenetre de
	// navigation temporelle (joursNavigationArriere/Avant jours de part et
	// d'autre d'aujourd'hui) — sans appel HTTP supplementaire quel que soit
	// le jour ensuite regarde (prp/01-navigation-temporelle.md).
	extrema, err := c.recupererExtrema(ctx, maintenant.AddDate(0, 0, -joursNavigationArriere), maintenant.AddDate(0, 0, joursNavigationAvant), site)
	if err != nil {
		return Maree{}, fmt.Errorf("horaires de maree : %w", err)
	}
	precedent, prochain, err := encadrer(extrema, maintenant)
	if err != nil {
		return Maree{}, err
	}

	hauteur, heureMesure, err := c.recupererHauteurActuelle(ctx, maintenant, site)
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
		Tendance:    grouperParJour(extrema, maintenant, nombreJoursAffiches),
		Extrema:     extrema,
	}, nil
}

// grouperParJour reduit les extrema a un resume par jour : la plus haute
// pleine mer et la plus basse basse mer, sur nJours a partir du jour de
// debut (heure locale). Un jour que le fournisseur n'a pas couvert reste a
// nil sur ses trois champs plutot que de tomber a zero.
func grouperParJour(extrema []Extremum, debut time.Time, nJours int) []JourMaree {
	debutJ := debutDuJour(debut)

	jours := make([]JourMaree, nJours)
	for i := range jours {
		jours[i].Date = debutJ.AddDate(0, 0, i)
	}

	for _, e := range extrema {
		i := int(e.Heure.Sub(debutJ).Hours() / 24)
		if i < 0 || i >= nJours {
			continue
		}
		switch e.Type {
		case "PM":
			if jours[i].HauteM == nil || e.HauteurM > *jours[i].HauteM {
				h := e.HauteurM
				jours[i].HauteM = &h
				if e.Coefficient != nil {
					c := *e.Coefficient
					jours[i].Coefficient = &c
				}
			}
		case "BM":
			if jours[i].BasseM == nil || e.HauteurM < *jours[i].BasseM {
				b := e.HauteurM
				jours[i].BasseM = &b
			}
		}
	}
	return jours
}

// extremaDuJour decoupe la fenetre complete d'extrema (recuperee en un seul
// appel par RecupererA) pour ne garder que ceux du jour donne, triee par
// heure croissante (deja le cas de la liste source). Un jour que le
// fournisseur n'a pas couvert rend une liste vide, jamais une valeur
// inventee (« degrader, jamais casser », PRODUCT.md principe 3).
func extremaDuJour(extrema []Extremum, jour time.Time) []Extremum {
	debut := debutDuJour(jour)
	fin := debut.AddDate(0, 0, 1)
	var du []Extremum
	for _, e := range extrema {
		if e.Heure.Before(debut) || !e.Heure.Before(fin) {
			continue
		}
		du = append(du, e)
	}
	return du
}

func (c *ClientMaree) recupererExtrema(ctx context.Context, de, a time.Time, site string) ([]Extremum, error) {
	url := fmt.Sprintf("%s/tide-extrema?site=%s&from=%s&to=%s&tz=Europe/Paris&key=%s",
		c.BaseURL, site, de.Format("2006-01-02"), a.Format("2006-01-02"), c.CleAPI)
	var r reponseExtremaBrute
	if err := recupererJSON(ctx, c.HTTP, c.BaseURL, url, &r); err != nil {
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

func (c *ClientMaree) recupererHauteurActuelle(ctx context.Context, maintenant time.Time, site string) (float64, time.Time, error) {
	de := maintenant.Add(-30 * time.Minute)
	a := maintenant.Add(30 * time.Minute)
	url := fmt.Sprintf("%s/water-levels?site=%s&from=%s&to=%s&step=10&tz=Europe/Paris&key=%s",
		c.BaseURL, site,
		de.Format("2006-01-02T15:04"), a.Format("2006-01-02T15:04"), c.CleAPI)
	var r reponseNiveauxBrute
	if err := recupererJSON(ctx, c.HTTP, c.BaseURL, url, &r); err != nil {
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
