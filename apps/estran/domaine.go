package main

import (
	"fmt"
	"time"
)

// Ce fichier assemble les donnees brutes (meteo.go, maree.go) en vues prêtes
// a etre encodees en JSON pour la page. Aucune valeur n'est inventee ici :
// une donnee absente reste absente (omitempty), jamais remplacee par un zero
// qui se lirait comme une mesure.

type VueHeure struct {
	Heure            string   `json:"heure"`
	TemperatureC     float64  `json:"temperature_c"`
	PluiePct         int      `json:"pluie_pct"`
	VentKmh          int      `json:"vent_kmh"`
	VentDirectionDeg int      `json:"vent_direction_deg"`
	VaguesM          *float64 `json:"vagues_m,omitempty"`
	Libelle          string   `json:"libelle"`
	Symbole          string   `json:"symbole"`
}

type VueJour struct {
	Date        string  `json:"date"`
	JourSemaine string  `json:"jour_semaine"`
	TempMinC    float64 `json:"temp_min_c"`
	TempMaxC    float64 `json:"temp_max_c"`
	PluiePctMax int     `json:"pluie_pct_max"`
	Libelle     string  `json:"libelle"`
	Symbole     string  `json:"symbole"`
}

type ReponsePrevisions struct {
	GenereA string     `json:"genere_a"`
	Frais   bool       `json:"frais"`
	Heures  []VueHeure `json:"heures"`
	Jours   []VueJour  `json:"jours"`
	// JourAffiche/JourAfficheLibelle restent absents (omitempty) quand aucune
	// date n'a ete demandee : c'est ce qui garde la reponse par defaut a
	// l'octet pres identique a avant l'ajout de la navigation temporelle
	// (prp/01-navigation-temporelle.md, contrainte principale).
	JourAffiche        string `json:"jour_affiche,omitempty"`
	JourAfficheLibelle string `json:"jour_affiche_libelle,omitempty"`
}

const nombreHeuresAffichees = 5
const nombreJoursAffiches = 7

// joursNavigationArriere/Avant bornent la fenetre de navigation temporelle
// (choisir un autre jour que aujourd'hui) : jusqu'a 7 jours en arriere, 7 en
// avant (prp/01-navigation-temporelle.md). Utilisees a la fois pour decouper
// la fenetre recuperee aupres des fournisseurs (maree.go) et pour valider le
// parametre `date` des routes (main.go).
const joursNavigationArriere = 7
const joursNavigationAvant = 7

// vuePrevisions rend soit les prochaines heures a partir de maintenant (sans
// dateCible, comportement historique, inchange a l'octet pres), soit les 24
// heures de dateCible quand elle est fournie. La tendance a 7 jours, elle,
// reste toujours ancree sur aujourd'hui (maintenant), jamais sur dateCible :
// c'est la meme tendance quel que soit le jour regarde (prp/01-navigation-
// temporelle.md). maintenant est un parametre explicite, jamais time.Now()
// appele ici : la fonction reste testable sans horloge reelle.
func vuePrevisions(p Previsions, maintenant time.Time, frais bool, dateCible *time.Time) ReponsePrevisions {
	v := ReponsePrevisions{
		GenereA: maintenant.Format(time.RFC3339),
		Frais:   frais,
	}

	if dateCible == nil {
		debut := maintenant.Truncate(time.Hour)
		for _, h := range p.Heures {
			if h.Heure.Before(debut) {
				continue
			}
			if len(v.Heures) >= nombreHeuresAffichees {
				break
			}
			v.Heures = append(v.Heures, vueHeureMeteo(h))
		}
	} else {
		debutCible := debutDuJour(*dateCible)
		finCible := debutCible.AddDate(0, 0, 1)
		for _, h := range p.Heures {
			if h.Heure.Before(debutCible) {
				continue
			}
			if !h.Heure.Before(finCible) {
				break
			}
			v.Heures = append(v.Heures, vueHeureMeteo(h))
		}
		v.JourAffiche = debutCible.Format("2006-01-02")
		v.JourAfficheLibelle = libelleJourFr(debutCible)
	}

	// La tendance couvre nombreJoursAffiches jours a partir d'AUJOURD'HUI,
	// jamais a partir de dateCible : p.Jours peut desormais remonter jusqu'a
	// J-7 (past_days=7, meteo.go), d'ou le filtrage explicite plutot que de
	// prendre les nombreJoursAffiches premieres entrees telles quelles.
	debutAujourdhui := debutDuJour(maintenant)
	for _, j := range p.Jours {
		if j.Date.Before(debutAujourdhui) {
			continue
		}
		if len(v.Jours) >= nombreJoursAffiches {
			break
		}
		v.Jours = append(v.Jours, vueJourMeteo(j))
	}

	return v
}

func vueHeureMeteo(h HeureMeteo) VueHeure {
	libelle, symbole := libelleCiel(h.CodeMeteo, h.NebulositeBassePct, h.NebulositeMoyennePct, h.NebulositeHautePct)
	return VueHeure{
		Heure:            h.Heure.Format("15:04"),
		TemperatureC:     arrondi1(h.TemperatureC),
		PluiePct:         int(h.PluiePct + 0.5),
		VentKmh:          int(h.VentKmh + 0.5),
		VentDirectionDeg: int(h.VentDirectionDeg + 0.5),
		VaguesM:          h.VaguesM,
		Libelle:          libelle,
		Symbole:          symbole,
	}
}

func vueJourMeteo(j JourMeteo) VueJour {
	var libelle, symbole string
	if j.CouchesConnues {
		libelle, symbole = libelleCiel(j.CodeMeteo, j.NebulositeBassePct, j.NebulositeMoyennePct, j.NebulositeHautePct)
	} else {
		libelle, symbole = libelleMeteo(j.CodeMeteo)
	}
	return VueJour{
		Date:        j.Date.Format("2006-01-02"),
		JourSemaine: jourSemaineFr(j.Date),
		TempMinC:    arrondi1(j.TempMinC),
		TempMaxC:    arrondi1(j.TempMaxC),
		PluiePctMax: int(j.PluiePctMax + 0.5),
		Libelle:     libelle,
		Symbole:     symbole,
	}
}

type VueExtremum struct {
	Type        string  `json:"type"`
	Heure       string  `json:"heure"`
	HauteurM    float64 `json:"hauteur_m"`
	Coefficient *int    `json:"coefficient,omitempty"`
}

type ReponseMaree struct {
	Configure     bool           `json:"configure"`
	Frais         bool           `json:"frais,omitempty"`
	HauteurM      *float64       `json:"hauteur_m,omitempty"`
	HeureMesure   string         `json:"heure_mesure,omitempty"`
	PositionPct   *float64       `json:"position_pct,omitempty"`
	Sens          string         `json:"sens,omitempty"`
	Precedent     *VueExtremum   `json:"precedent,omitempty"`
	Prochain      *VueExtremum   `json:"prochain,omitempty"`
	Jours         []VueJourMaree `json:"jours,omitempty"`
	SiteReference string         `json:"site_reference,omitempty"`
	Erreur        string         `json:"erreur,omitempty"`
	// Extrema porte les pleines/basses mers du jour demande (parametre
	// `date`) : jamais rempli en meme temps que HauteurM/PositionPct — un
	// autre jour que aujourd'hui n'a pas de position instantanee sensee
	// (prp/01-navigation-temporelle.md). Vide (omis) quand le fournisseur ne
	// couvre pas ce jour, jamais une valeur inventee.
	Extrema []VueExtremum `json:"extrema,omitempty"`
	// JourAffiche/JourAfficheLibelle restent absents quand aucune date n'a
	// ete demandee : la reponse par defaut reste a l'octet pres celle
	// d'avant la navigation temporelle.
	JourAffiche        string `json:"jour_affiche,omitempty"`
	JourAfficheLibelle string `json:"jour_affiche_libelle,omitempty"`
}

// VueJourMaree est le resume de maree d'un jour, pour la tendance a 7 jours.
// HauteM/BasseM/Coefficient restent absents (omitempty) quand le fournisseur
// n'a rien retourne pour ce jour — jamais une valeur inventee.
type VueJourMaree struct {
	Date        string   `json:"date"`
	HauteM      *float64 `json:"haute_m,omitempty"`
	BasseM      *float64 `json:"basse_m,omitempty"`
	Coefficient *int     `json:"coefficient,omitempty"`
}

func vueJoursMaree(jours []JourMaree) []VueJourMaree {
	v := make([]VueJourMaree, len(jours))
	for i, j := range jours {
		v[i] = VueJourMaree{Date: j.Date.Format("2006-01-02"), Coefficient: j.Coefficient}
		if j.HauteM != nil {
			h := arrondi2(*j.HauteM)
			v[i].HauteM = &h
		}
		if j.BasseM != nil {
			b := arrondi2(*j.BasseM)
			v[i].BasseM = &b
		}
	}
	return v
}

func vueExtremum(e Extremum) *VueExtremum {
	return &VueExtremum{
		Type:        e.Type,
		Heure:       e.Heure.Format("15:04"),
		HauteurM:    arrondi2(e.HauteurM),
		Coefficient: e.Coefficient,
	}
}

func vueMaree(m Maree, frais bool, site string) ReponseMaree {
	hauteur := arrondi2(m.HauteurM)
	position := arrondi1(m.PositionPct)
	return ReponseMaree{
		Configure:     true,
		Frais:         frais,
		HauteurM:      &hauteur,
		HeureMesure:   m.HeureMesure.Format(time.RFC3339),
		PositionPct:   &position,
		Sens:          m.Sens,
		Precedent:     vueExtremum(m.Precedent),
		Prochain:      vueExtremum(m.Prochain),
		Jours:         vueJoursMaree(m.Tendance),
		SiteReference: site,
	}
}

// vueMareeJour rend les extrema d'un jour choisi (parametre `date`), jamais
// la jauge instantanee (HauteurM/PositionPct/Sens/Precedent/Prochain restent
// a leur zero-valeur, donc absents du JSON) : une position "maintenant" sur
// un autre jour serait une valeur inventee (prp/01-navigation-temporelle.md).
// m.Extrema porte deja toute la fenetre J-7 a J+7 recuperee en un seul appel
// (maree.go) ; decouper pour jour ne declenche donc aucun appel sortant
// supplementaire. La tendance (Jours) reste incluse, ancree sur aujourd'hui
// comme pour vueMaree, pour que la page puisse mettre en evidence le jour
// regarde sans requete separee.
func vueMareeJour(m Maree, frais bool, site string, jour time.Time) ReponseMaree {
	debutCible := debutDuJour(jour)
	v := ReponseMaree{
		Configure:          true,
		Frais:              frais,
		Jours:              vueJoursMaree(m.Tendance),
		SiteReference:      site,
		JourAffiche:        debutCible.Format("2006-01-02"),
		JourAfficheLibelle: libelleJourFr(debutCible),
	}
	for _, e := range extremaDuJour(m.Extrema, debutCible) {
		v.Extrema = append(v.Extrema, *vueExtremum(e))
	}
	return v
}

var joursFr = [...]string{"dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"}
var moisFr = [...]string{"", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"}

func jourSemaineFr(t time.Time) string {
	return joursFr[int(t.Weekday())]
}

// libelleJourFr rend un libelle complet francais pour un jour, ex. "lundi 17
// aout" : utilise pour le titre de la section horaire et de la section
// maree quand un autre jour qu'aujourd'hui est regarde. La casse (majuscule
// initiale) est laissee a la mise en forme cote page.
func libelleJourFr(t time.Time) string {
	return fmt.Sprintf("%s %d %s", jourSemaineFr(t), t.Day(), moisFr[int(t.Month())])
}

// debutDuJour ramene un instant a minuit, dans le meme fuseau. Utilisee pour
// comparer des instants a un jour calendaire (navigation temporelle,
// decoupage de fenetre) sans jamais dependre de l'heure du jour.
func debutDuJour(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func arrondi1(v float64) float64 {
	return float64(int(v*10+sign(v)*0.5)) / 10
}

func arrondi2(v float64) float64 {
	return float64(int(v*100+sign(v)*0.5)) / 100
}

func sign(v float64) float64 {
	if v < 0 {
		return -1
	}
	return 1
}
