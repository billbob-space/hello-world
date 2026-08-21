package main

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Ce fichier porte les DEUX sources de pluie fine, et elles seules :
// prp/03-graphe-de-pluie.md dit pourquoi elles ne rejoignent pas meteo.go
// (deja trois appels sortants, deja 25 ko, et aucune de ces deux series
// n'entre dans Previsions — elles ont leur propre cadence, leur propre mode
// de panne, et leur propre route).
//
//   - la COURBE DU JOUR, chez Open-Meteo, au quart d'heure la ou un modele a
//     maille fine en produit vraiment, a l'heure partout ailleurs ;
//   - la BANDE DE L'HEURE, chez Meteo-France, par pas de 5 puis 10 minutes
//     sur les 60 minutes qui viennent.

// PasPluie est un pas de la courbe du jour : un instant, et la lame d'eau
// tombee PENDANT ce pas, en millimetres. Un pas dont le fournisseur rend
// `null` n'entre pas dans la serie — c'est cette absence, et non un seuil
// code en dur, qui delimite la portee du quart d'heure
// (prp/03-graphe-de-pluie.md, section 1).
type PasPluie struct {
	Instant time.Time
	Mm      float64
}

// SeriePluie porte les deux echelles de la courbe. Quarts vient du modele a
// maille fine et s'arrete ou il s'arrete ; Heures couvre toute la fenetre de
// navigation et sert de repli. Les deux peuvent etre vides independamment :
// c'est vuePluie qui choisit, jour par jour, laquelle est complete.
type SeriePluie struct {
	Quarts []PasPluie
	Heures []PasPluie
}

// ClientPluie interroge Open-Meteo deux fois, sans cle. Base est un champ,
// pas une constante, pour que les tests pointent vers un serveur local. lat/
// lon ne sont plus des champs (prp/04-le-lieu-devient-une-donnee.md) : ils se
// passent en argument de Recuperer.
type ClientPluie struct {
	Base string
	HTTP *http.Client
}

// basePluie est l'URL de production d'Open-Meteo pour la courbe de pluie,
// redirigeable par variable d'environnement pour le bout en bout
// (apps/estran/e2e/) — voir le commentaire de baseMeteoForecast dans
// meteo.go, meme raison. Distincte de baseMeteoForecast bien que meme hote
// par defaut : ClientPluie et ClientMeteo sont deux clients independants, et
// le bout en bout doit pouvoir les rediriger separement. En production,
// ESTRAN_BASE_PLUIE n'est jamais posee : le defaut, inchange, s'applique.
var basePluie = env("ESTRAN_BASE_PLUIE", "https://api.open-meteo.com/v1/forecast")

func NouveauClientPluie() *ClientPluie {
	return &ClientPluie{
		Base: basePluie,
		HTTP: &http.Client{Timeout: 10 * time.Second},
	}
}

// modelePluieFine nomme EXPLICITEMENT le modele a maille fine (AROME France
// HD, 1,5 km) au lieu de laisser Open-Meteo composer son « seamless ».
// C'est le coeur de prp/03-graphe-de-pluie.md, section 1 : sans `models=`,
// le fournisseur rend 2208 pas de quart d'heure sur vingt-trois jours SANS
// UN SEUL NULL, parce qu'au-dela de la portee d'un modele fin il interpole
// depuis l'horaire sans le dire. Force sur ce modele-ci, il s'arrete net et
// rend `null` : la fenetre du vrai quart d'heure devient lisible dans la
// donnee elle-meme, plutot que d'etre un seuil devine qui aurait vieilli en
// silence.
const modelePluieFine = "meteofrance_arome_france_hd"

// joursPluieFine borne l'appel fin. La portee mesuree d'AROME etait J+2 le
// 19 aout 2026 ; on demande un jour de plus (aujourd'hui compte dans la
// fenetre Open-Meteo, cf. recupererForecast) pour que ce soit le `null` du
// fournisseur, et non ce chiffre, qui dise ou le quart d'heure s'arrete.
const joursPluieFine = 4

type reponseMinutelleBrute struct {
	Minutely15 struct {
		Time          []string   `json:"time"`
		Precipitation []*float64 `json:"precipitation"`
	} `json:"minutely_15"`
}

type reponseHoraireBrute struct {
	Hourly struct {
		Time          []string   `json:"time"`
		Precipitation []*float64 `json:"precipitation"`
	} `json:"hourly"`
}

// Recuperer rend les deux echelles. L'appel HORAIRE est celui qui ne peut pas
// manquer : sans lui il n'y a pas de repli, et la section n'a rien a montrer
// sur les jours qu'AROME ne couvre pas — son echec est donc fatal a l'appel.
// L'appel FIN, lui, degrade : echec journalise, courbe servie au pas horaire
// (prp/03-graphe-de-pluie.md, section 4).
func (c *ClientPluie) Recuperer(ctx context.Context, lat, lon float64) (SeriePluie, error) {
	var s SeriePluie

	horaire, err := c.recupererHoraire(ctx, lat, lon)
	if err != nil {
		return SeriePluie{}, fmt.Errorf("pluie horaire : %w", err)
	}
	s.Heures = pasDepuisSeries(horaire.Hourly.Time, horaire.Hourly.Precipitation)

	fine, err := c.recupererFine(ctx, lat, lon)
	if err != nil {
		return s, nil
	}
	s.Quarts = pasDepuisSeries(fine.Minutely15.Time, fine.Minutely15.Precipitation)
	return s, nil
}

func (c *ClientPluie) recupererFine(ctx context.Context, lat, lon float64) (reponseMinutelleBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&past_days=%d&forecast_days=%d"+
			"&models=%s&minutely_15=precipitation",
		c.Base, lat, lon, joursNavigationArriere, joursPluieFine, modelePluieFine)
	var r reponseMinutelleBrute
	err := recupererJSON(ctx, c.HTTP, c.Base, url, &r)
	return r, err
}

// recupererHoraire couvre TOUTE la fenetre de navigation (7 jours en arriere,
// 16 en avant — aujourd'hui compte dans la fenetre Open-Meteo, cf.
// recupererForecast), pour qu'aucun jour navigable ne se retrouve sans
// courbe. Serie unique et legere : la lame d'eau, rien d'autre.
func (c *ClientPluie) recupererHoraire(ctx context.Context, lat, lon float64) (reponseHoraireBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&past_days=%d&forecast_days=%d&hourly=precipitation",
		c.Base, lat, lon, joursNavigationArriere, joursNavigationAvant+1)
	var r reponseHoraireBrute
	err := recupererJSON(ctx, c.HTTP, c.Base, url, &r)
	return r, err
}

// pasDepuisSeries fusionne les deux tableaux paralleles d'Open-Meteo en une
// serie de pas. Un horodatage illisible ou une valeur `null` ne produit AUCUN
// pas : c'est l'absence, pas un 0,0 mm, qui dit que le fournisseur ne couvre
// pas cet instant (prp/03-graphe-de-pluie.md, section 4).
func pasDepuisSeries(instants []string, valeurs []*float64) []PasPluie {
	pas := make([]PasPluie, 0, len(instants))
	for i, t := range instants {
		v := valeurPtrA(valeurs, i)
		if v == nil {
			continue
		}
		instant, err := time.ParseInLocation("2006-01-02T15:04", t, parisTZ)
		if err != nil {
			continue
		}
		pas = append(pas, PasPluie{Instant: instant, Mm: *v})
	}
	return pas
}

// --- La bande de l'heure qui vient -----------------------------------------

// PasNowcast est un pas de la prevision immediate : un instant, et une
// intensite de 1 (temps sec) a 4 (pluie forte). Meteo-France ne rend pas de
// millimetres ici — c'est une classe d'intensite, pas une lame d'eau, et la
// vue ne doit pas la presenter comme telle.
type PasNowcast struct {
	Instant time.Time
	Niveau  int
}

// Nowcast est la bande de l'heure qui vient, telle que rendue pour un point
// nomme. Lieu est le nom que le fournisseur donne au point le plus proche —
// affiche tel quel, c'est lui qui prouve a l'utilisateur que la prevision
// porte bien sur Le Touquet et non sur un point de grille lointain.
type Nowcast struct {
	Lieu      string
	MiseAJour time.Time
	Pas       []PasNowcast
}

// ClientNowcast interroge la prevision immediate de pluie de Meteo-France.
//
// ARBITRAGE ASSUME, dit a l'utilisateur avant ecriture
// (prp/03-graphe-de-pluie.md, section 1) : cette adresse est celle qu'appelle
// l'application mobile de Meteo-France, avec le jeton public que celle-ci
// embarque — ce n'est pas un contrat d'API. Gratuite, sans inscription, et
// sans garantie : elle peut changer ou disparaitre sans preavis. C'est la
// SEULE source d'un pas de 10 minutes sur ce lieu, et sa panne ne coute rien
// (la bande disparait, la courbe du jour reste), d'ou l'arbitrage.
type ClientNowcast struct {
	Base string
	HTTP *http.Client
}

// jetonNowcast n'est PAS un secret et ne se declare pas en `env:` : c'est le
// jeton public embarque en clair dans une application distribuee a tous,
// identique pour chacun de ses utilisateurs. Le declarer en `env:`
// suggererait a l'exploitant du serveur qu'il a une valeur a fournir, ce qui
// est faux, et ferait afficher « configuration requise » a une section qui
// marche (prp/03-graphe-de-pluie.md, section 1).
const jetonNowcast = "__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__"

// baseNowcast est l'URL de production de la prevision immediate de
// Meteo-France, redirigeable par variable d'environnement pour le bout en
// bout (apps/estran/e2e/) — voir le commentaire de baseMeteoForecast dans
// meteo.go, meme raison. En production, ESTRAN_BASE_NOWCAST n'est jamais
// posee : le defaut, inchange, s'applique.
var baseNowcast = env("ESTRAN_BASE_NOWCAST", "https://webservice.meteofrance.com/rain")

func NouveauClientNowcast() *ClientNowcast {
	return &ClientNowcast{
		Base: baseNowcast,
		HTTP: &http.Client{Timeout: 10 * time.Second},
	}
}

type reponseNowcastBrute struct {
	Position struct {
		Name                 string `json:"name"`
		RainProductAvailable int    `json:"rain_product_available"`
	} `json:"position"`
	UpdatedOn int64 `json:"updated_on"`
	Forecast  []struct {
		Dt   int64 `json:"dt"`
		Rain *int  `json:"rain"`
	} `json:"forecast"`
}

// ErrNowcastIndisponible dit que le fournisseur a repondu, mais qu'il n'a pas
// de prevision immediate pour ce point — cas distinct d'une panne reseau, et
// qui ne doit pas resservir un dernier connu vieux d'une heure : une bande de
// l'heure perimee est pire qu'une bande absente.
var ErrNowcastIndisponible = fmt.Errorf("prevision immediate indisponible sur ce point")

func (c *ClientNowcast) Recuperer(ctx context.Context, lat, lon float64) (Nowcast, error) {
	url := fmt.Sprintf("%s?lat=%.4f&lon=%.4f&token=%s", c.Base, lat, lon, jetonNowcast)
	var r reponseNowcastBrute
	if err := recupererJSON(ctx, c.HTTP, c.Base, url, &r); err != nil {
		return Nowcast{}, err
	}
	if r.Position.RainProductAvailable != 1 {
		return Nowcast{}, ErrNowcastIndisponible
	}

	n := Nowcast{Lieu: r.Position.Name}
	if r.UpdatedOn > 0 {
		n.MiseAJour = time.Unix(r.UpdatedOn, 0).In(parisTZ)
	}
	for _, f := range r.Forecast {
		// Un pas sans intensite, ou hors de l'echelle 1-4 que le fournisseur
		// documente, n'entre pas dans la bande : mieux vaut une bande courte
		// qu'un segment dont on ne sait pas ce qu'il vaut.
		if f.Rain == nil || *f.Rain < 1 || *f.Rain > 4 || f.Dt <= 0 {
			continue
		}
		n.Pas = append(n.Pas, PasNowcast{Instant: time.Unix(f.Dt, 0).In(parisTZ), Niveau: *f.Rain})
	}
	if len(n.Pas) == 0 {
		return Nowcast{}, ErrNowcastIndisponible
	}
	return n, nil
}

// libellesNowcast traduit l'echelle 1-4 de Meteo-France. Traduits ici plutot
// que repris du champ `desc` de la reponse : ce champ est du texte libre d'un
// fournisseur externe, et l'ecran doit dire la meme chose d'une version de
// leur API a l'autre.
var libellesNowcast = map[int]string{
	1: "temps sec",
	2: "pluie faible",
	3: "pluie modérée",
	4: "pluie forte",
}
