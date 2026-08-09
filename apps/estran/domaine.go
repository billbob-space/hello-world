package main

import "time"

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
}

const nombreHeuresAffichees = 5
const nombreJoursAffiches = 7

// vuePrevisions garde les prochaines heures (a partir de l'heure en cours,
// incluse) et les prochains jours. maintenant est un parametre explicite,
// jamais time.Now() appele ici : la fonction reste testable sans horloge
// reelle.
func vuePrevisions(p Previsions, maintenant time.Time, frais bool) ReponsePrevisions {
	v := ReponsePrevisions{
		GenereA: maintenant.Format(time.RFC3339),
		Frais:   frais,
	}

	debut := maintenant.Truncate(time.Hour)
	for _, h := range p.Heures {
		if h.Heure.Before(debut) {
			continue
		}
		if len(v.Heures) >= nombreHeuresAffichees {
			break
		}
		libelle, symbole := libelleMeteo(h.CodeMeteo)
		v.Heures = append(v.Heures, VueHeure{
			Heure:            h.Heure.Format("15:04"),
			TemperatureC:     arrondi1(h.TemperatureC),
			PluiePct:         int(h.PluiePct + 0.5),
			VentKmh:          int(h.VentKmh + 0.5),
			VentDirectionDeg: int(h.VentDirectionDeg + 0.5),
			VaguesM:          h.VaguesM,
			Libelle:          libelle,
			Symbole:          symbole,
		})
	}

	for i, j := range p.Jours {
		if i >= nombreJoursAffiches {
			break
		}
		libelle, symbole := libelleMeteo(j.CodeMeteo)
		v.Jours = append(v.Jours, VueJour{
			Date:        j.Date.Format("2006-01-02"),
			JourSemaine: jourSemaineFr(j.Date),
			TempMinC:    arrondi1(j.TempMinC),
			TempMaxC:    arrondi1(j.TempMaxC),
			PluiePctMax: int(j.PluiePctMax + 0.5),
			Libelle:     libelle,
			Symbole:     symbole,
		})
	}

	return v
}

type VueExtremum struct {
	Type        string  `json:"type"`
	Heure       string  `json:"heure"`
	HauteurM    float64 `json:"hauteur_m"`
	Coefficient *int    `json:"coefficient,omitempty"`
}

type ReponseMaree struct {
	Configure     bool         `json:"configure"`
	Frais         bool         `json:"frais,omitempty"`
	HauteurM      *float64     `json:"hauteur_m,omitempty"`
	HeureMesure   string       `json:"heure_mesure,omitempty"`
	PositionPct   *float64     `json:"position_pct,omitempty"`
	Sens          string       `json:"sens,omitempty"`
	Precedent     *VueExtremum `json:"precedent,omitempty"`
	Prochain      *VueExtremum `json:"prochain,omitempty"`
	SiteReference string       `json:"site_reference,omitempty"`
	Erreur        string       `json:"erreur,omitempty"`
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
		SiteReference: site,
	}
}

var joursFr = [...]string{"dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"}

func jourSemaineFr(t time.Time) string {
	return joursFr[int(t.Weekday())]
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
