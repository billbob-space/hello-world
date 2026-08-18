package main

import (
	"fmt"
	"time"
)

// Ce fichier assemble les donnees brutes (meteo.go, maree.go) en vues prêtes
// a etre encodees en JSON pour la page. Aucune valeur n'est inventee ici :
// une donnee absente reste absente (omitempty), jamais remplacee par un zero
// qui se lirait comme une mesure.

// VueHeure ne porte que des heures dont la temperature est CONNUE (filtrees
// en amont dans vuePrevisions) : TemperatureC reste donc un float64 requis.
// PluiePct/VentKmh/VentDirectionDeg, eux, sont des grandeurs secondaires qui
// peuvent manquer independamment de la temperature (Open-Meteo rend `null`
// au bord de sa fenetre, prp/02-horizon-confiance-vent.md, section
// Degradation) : nullables + omitempty, leur ligne est laissee de cote cote
// page plutot que d'afficher un zero invente. VaguesM reste le modele deja
// en place.
type VueHeure struct {
	Heure            string   `json:"heure"`
	TemperatureC     float64  `json:"temperature_c"`
	PluiePct         *int     `json:"pluie_pct,omitempty"`
	VentKmh          *int     `json:"vent_kmh,omitempty"`
	VentDirectionDeg *int     `json:"vent_direction_deg,omitempty"`
	VaguesM          *float64 `json:"vagues_m,omitempty"`
	Libelle          string   `json:"libelle"`
	Symbole          string   `json:"symbole"`
}

// VueJour ne porte que des jours dont la temperature est CONNUE (filtres en
// amont dans vuePrevisions, qui laisse alors la tendance porter moins de
// nombreJoursAffiches lignes) : TempMinC/TempMaxC restent donc des float64
// requis. PluiePctMax/VentKmhMax/RafalesKmhMax/VentDirectionDeg sont des
// grandeurs secondaires qui peuvent manquer independamment de la
// temperature : nullables + omitempty, chacune laisse seulement sa propre
// ligne de cote plutot que d'afficher un zero invente
// (prp/02-horizon-confiance-vent.md, section Degradation).
type VueJour struct {
	Date             string  `json:"date"`
	JourSemaine      string  `json:"jour_semaine"`
	TempMinC         float64 `json:"temp_min_c"`
	TempMaxC         float64 `json:"temp_max_c"`
	PluiePctMax      *int    `json:"pluie_pct_max,omitempty"`
	Libelle          string  `json:"libelle"`
	Symbole          string  `json:"symbole"`
	VentKmhMax       *int    `json:"vent_kmh_max,omitempty"`
	RafalesKmhMax    *int    `json:"rafales_kmh_max,omitempty"`
	VentDirectionDeg *int    `json:"vent_direction_deg,omitempty"`
	// Confiance/ConfianceModeles restent absents (omitempty) quand l'accord
	// entre modeles n'a pas pu etre calcule (moins de deux modeles sur la
	// temperature, ou appel d'accord en echec, meteo.go) : l'absence se lit,
	// elle ne s'invente pas (prp/02-horizon-confiance-vent.md, section 3).
	Confiance        string `json:"confiance,omitempty"`
	ConfianceModeles int    `json:"confiance_modeles,omitempty"`
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

// nombreHeuresMinimum n'est plus le nombre exact de vignettes horaires
// affichees pour aujourd'hui, mais leur PLANCHER : la vue rend toutes les
// heures restantes du jour (de l'heure en cours a 23h), et deborde sur le
// lendemain seulement si cela ne suffit pas a atteindre ce minimum — le cas
// en soiree, ou s'arreter a minuit laisserait trop peu de vignettes
// (prp/02-horizon-confiance-vent.md, section 1).
const nombreHeuresMinimum = 5
const nombreJoursAffiches = 16

// joursNavigationArriere/Avant bornent la fenetre de navigation temporelle
// (choisir un autre jour que aujourd'hui) : jusqu'a 7 jours en arriere, 15 en
// avant (prp/01-navigation-temporelle.md, prp/02-horizon-confiance-vent.md).
// Utilisees a la fois pour decouper la fenetre recuperee aupres des
// fournisseurs (maree.go) et pour valider le parametre `date` des routes
// (main.go).
const joursNavigationArriere = 7
const joursNavigationAvant = 15

// vuePrevisions rend soit les heures restantes d'aujourd'hui a partir de
// maintenant (sans dateCible, minimum nombreHeuresMinimum, quitte a deborder
// sur le lendemain), soit les 24 heures de dateCible quand elle est fournie.
// La tendance a nombreJoursAffiches jours, elle, reste toujours ancree sur
// aujourd'hui (maintenant), jamais sur dateCible : c'est la meme tendance
// quel que soit le jour regarde (prp/01-navigation-temporelle.md).
// maintenant est un parametre explicite, jamais time.Now() appele ici : la
// fonction reste testable sans horloge reelle.
func vuePrevisions(p Previsions, maintenant time.Time, frais bool, dateCible *time.Time) ReponsePrevisions {
	v := ReponsePrevisions{
		GenereA: maintenant.Format(time.RFC3339),
		Frais:   frais,
	}

	if dateCible == nil {
		debut := maintenant.Truncate(time.Hour)
		finAujourdhui := debutDuJour(maintenant).AddDate(0, 0, 1)
		for _, h := range p.Heures {
			if h.Heure.Before(debut) {
				continue
			}
			if h.TemperatureC == nil {
				// Heure sans temperature (bord de la fenetre Open-Meteo,
				// prp/02-horizon-confiance-vent.md section Degradation) :
				// jamais affichee, et ne compte pas pour le plancher
				// nombreHeuresMinimum ci-dessous — seules les heures
				// REELLEMENT affichees comptent.
				continue
			}
			// Toutes les heures restantes d'aujourd'hui sont gardees, meme
			// au-dela du minimum ; passe minuit, seulement de quoi completer
			// le minimum (deborde sur le lendemain en soiree, exactement le
			// comportement d'avant entre 19h et minuit,
			// prp/02-horizon-confiance-vent.md, section 1).
			if !h.Heure.Before(finAujourdhui) && len(v.Heures) >= nombreHeuresMinimum {
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
			if h.TemperatureC == nil {
				continue
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
		if j.TempMinC == nil || j.TempMaxC == nil {
			// Jour sans temperature (bord de la fenetre Open-Meteo,
			// prp/02-horizon-confiance-vent.md section Degradation) : jamais
			// affiche, et ne consomme pas une des nombreJoursAffiches places
			// — la tendance peut donc porter moins de nombreJoursAffiches
			// lignes plutot que d'inventer un jour.
			continue
		}
		if len(v.Jours) >= nombreJoursAffiches {
			break
		}
		v.Jours = append(v.Jours, vueJourMeteo(j))
	}

	return v
}

// vueHeureMeteo suppose h.TemperatureC non nil : c'est a l'appelant
// (vuePrevisions) de filtrer les heures sans temperature avant d'appeler
// cette fonction, jamais a elle de decider une valeur de repli.
func vueHeureMeteo(h HeureMeteo) VueHeure {
	libelle, symbole := libelleCiel(h.CodeMeteo, h.NebulositeBassePct, h.NebulositeMoyennePct, h.NebulositeHautePct)
	return VueHeure{
		Heure:            h.Heure.Format("15:04"),
		TemperatureC:     arrondi1(*h.TemperatureC),
		PluiePct:         arrondiEntierPtr(h.PluiePct),
		VentKmh:          arrondiEntierPtr(h.VentKmh),
		VentDirectionDeg: arrondiEntierPtr(h.VentDirectionDeg),
		VaguesM:          h.VaguesM,
		Libelle:          libelle,
		Symbole:          symbole,
	}
}

// vueJourMeteo suppose j.TempMinC et j.TempMaxC non nil : c'est a l'appelant
// (vuePrevisions) de filtrer les jours sans temperature avant d'appeler
// cette fonction, jamais a elle de decider une valeur de repli.
func vueJourMeteo(j JourMeteo) VueJour {
	var libelle, symbole string
	if j.CouchesConnues {
		libelle, symbole = libelleCiel(j.CodeMeteo, j.NebulositeBassePct, j.NebulositeMoyennePct, j.NebulositeHautePct)
	} else {
		libelle, symbole = libelleMeteo(j.CodeMeteo)
	}
	return VueJour{
		Date:             j.Date.Format("2006-01-02"),
		JourSemaine:      jourSemaineFr(j.Date),
		TempMinC:         arrondi1(*j.TempMinC),
		TempMaxC:         arrondi1(*j.TempMaxC),
		PluiePctMax:      arrondiEntierPtr(j.PluiePctMax),
		Libelle:          libelle,
		Symbole:          symbole,
		VentKmhMax:       arrondiEntierPtr(j.VentKmhMax),
		RafalesKmhMax:    arrondiEntierPtr(j.RafalesKmhMax),
		VentDirectionDeg: arrondiEntierPtr(j.VentDirectionDeg),
		Confiance:        j.Confiance,
		ConfianceModeles: j.ConfianceModeles,
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

// VueJourMaree est le resume de maree d'un jour, pour la tendance a 16 jours.
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

// arrondiEntierPtr arrondit une grandeur secondaire nullable (pluie, vent,
// rafale, direction) en *int, nil si l'entree est nil : jamais un zero
// invente pour une donnee absente (prp/02-horizon-confiance-vent.md, section
// Degradation). Ces grandeurs sont toutes non negatives (pourcentage,
// vitesse, degres) : arrondi simple, pas besoin du signe de arrondi1/2.
func arrondiEntierPtr(v *float64) *int {
	if v == nil {
		return nil
	}
	n := int(*v + 0.5)
	return &n
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
