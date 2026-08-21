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
// PluieMm/VentKmh/VentDirectionDeg, eux, sont des grandeurs secondaires qui
// peuvent manquer independamment de la temperature (Open-Meteo rend `null`
// au bord de sa fenetre, prp/02-horizon-confiance-vent.md, section
// Degradation) : nullables + omitempty, leur ligne est laissee de cote cote
// page plutot que d'afficher un zero invente. VaguesM reste le modele deja
// en place.
//
// PluieMm a REMPLACE PluiePct le 20 aout 2026 (PRODUCT.md, « Ajoute apres les
// PRP »). Le pourcentage etait une probabilite d'ensemble rendue par une
// goutte et un « % », que l'ecran ne distinguait pas d'une lame d'eau : la
// vignette annoncait 100 % quand la courbe de la section pluie annoncait
// 0 mm sur la meme heure, et les deux avaient raison. Ce que la vignette
// porte est desormais la MEME grandeur, tiree de la MEME serie que la courbe
// (pluieParHeure).
type VueHeure struct {
	Heure        string  `json:"heure"`
	TemperatureC float64 `json:"temperature_c"`
	// PluieMm est la lame d'eau attendue PENDANT cette heure, en millimetres.
	// Absent quand la source de la courbe est en panne ou ne couvre pas cette
	// heure : la ligne est alors laissee de cote, jamais remplacee par un
	// « 0 mm » qui se lirait comme une promesse de temps sec.
	PluieMm *float64 `json:"pluie_mm,omitempty"`
	// AversePossible dit que le risque d'averse de l'heure atteint
	// seuilAversePossible. Un booleen, jamais le pourcentage : c'est
	// precisement le chiffre qui se lisait de travers, et le rendre a nouveau
	// rouvrirait la question que ce champ ferme. Il survit a la panne de la
	// courbe — il vient de l'appel previsions, pas de la serie de pluie.
	AversePossible   bool     `json:"averse_possible,omitempty"`
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
//
// pluie porte la serie de la section Pluie, la MEME que celle dont la courbe
// est tiree : c'est ce partage, et non une seconde source, qui garantit que la
// vignette d'une heure et la courbe du jour ne peuvent plus annoncer deux
// chiffres differents. Une serie vide (source en panne, ou fenetre non
// couverte) laisse simplement les vignettes sans ligne de pluie.
func vuePrevisions(p Previsions, pluie SeriePluie, maintenant time.Time, frais bool, dateCible *time.Time) ReponsePrevisions {
	v := ReponsePrevisions{
		GenereA: maintenant.Format(time.RFC3339),
		Frais:   frais,
	}
	lames := pluieParHeure(pluie)

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
			v.Heures = append(v.Heures, vueHeureMeteo(h, lames))
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
			v.Heures = append(v.Heures, vueHeureMeteo(h, lames))
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
func vueHeureMeteo(h HeureMeteo, lames map[string]float64) VueHeure {
	libelle, symbole := libelleCiel(h.CodeMeteo, h.NebulositeBassePct, h.NebulositeMoyennePct, h.NebulositeHautePct)
	v := VueHeure{
		Heure:            h.Heure.Format("15:04"),
		TemperatureC:     arrondi1(*h.TemperatureC),
		AversePossible:   h.PluiePct != nil && *h.PluiePct >= seuilAversePossible,
		VentKmh:          arrondiEntierPtr(h.VentKmh),
		VentDirectionDeg: arrondiEntierPtr(h.VentDirectionDeg),
		VaguesM:          h.VaguesM,
		Libelle:          libelle,
		Symbole:          symbole,
	}
	// Presence dans la carte, jamais valeur par defaut : une heure que la
	// serie ne couvre pas n'a pas de lame d'eau connue, et 0 mm en tiendrait
	// lieu de reponse.
	//
	// Arrondi au centieme, comme les points de la courbe (courbePluie) et non
	// au dixieme affiche : au dixieme, une bruine a 0,08 mm devenait 0,1 sur
	// la vignette, et vingt-quatre arrondis vers le haut faisaient un cumul
	// superieur de 0,1 mm a celui de la courbe — le meme genre d'ecart
	// inexplicable que ce changement supprime. La page arrondit pour
	// l'affichage, et sait alors distinguer une heure vraiment seche d'une
	// bruine qui s'arrondirait a zero.
	if mm, ok := lames[cleHeure(h.Heure)]; ok {
		arrondie := arrondi2(mm)
		v.PluieMm = &arrondie
	}
	return v
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

// --- La section Pluie -------------------------------------------------------

// VuePasPluie est un pas de la courbe du jour. Mm est la lame d'eau tombee
// PENDANT ce pas — un quart d'heure ou une heure selon VueCourbePluie.Pas,
// jamais un debit ramene a l'heure : additionner les pas doit rendre le
// cumul du jour.
type VuePasPluie struct {
	Heure string  `json:"heure"`
	Mm    float64 `json:"mm"`
}

// VueCourbePluie porte la courbe d'un jour, et surtout SON PAS : « quart »
// quand le modele a maille fine couvre ce jour de bout en bout, « heure »
// sinon. La page l'affiche tel quel — une courbe qui change de finesse d'un
// jour a l'autre sans le dire laisserait croire a une pluie plus reguliere
// qu'elle ne l'est (prp/03-graphe-de-pluie.md, section 2).
type VueCourbePluie struct {
	Pas     string        `json:"pas"`
	Points  []VuePasPluie `json:"points"`
	TotalMm float64       `json:"total_mm"`
	MaxMm   float64       `json:"max_mm"`
}

// VuePasNowcast porte une CLASSE d'intensite (1 a 4) et son libelle, jamais
// des millimetres : Meteo-France n'en rend pas sur cette echelle, et en
// fabriquer serait inventer.
type VuePasNowcast struct {
	Heure   string `json:"heure"`
	Niveau  int    `json:"niveau"`
	Libelle string `json:"libelle"`
}

// VueBandeNowcast est la bande des 60 minutes qui viennent. Lieu est le nom
// que Meteo-France donne au point : affiche tel quel, c'est ce qui montre que
// la prevision porte bien sur Le Touquet.
type VueBandeNowcast struct {
	Lieu      string `json:"lieu"`
	MiseAJour string `json:"mise_a_jour,omitempty"`
	// MiseAJourMinutes est l'age du releve, en minutes. C'est LUI qui dit au
	// lecteur qu'il regarde une observation et non une prevision — « vu au
	// radar il y a dix minutes » ne se lit pas comme « prevu ce matin ».
	// Calcule ici : « 13:30 » ne porte pas de date, et le recalculer cote page
	// se tromperait d'un jour a chaque passage de minuit.
	MiseAJourMinutes *int            `json:"mise_a_jour_minutes,omitempty"`
	Pas              []VuePasNowcast `json:"pas"`
}

// ReponsePluie est la reponse de /api/pluie. Heure et Jour sont absents
// (omitempty) independamment l'un de l'autre : la bande peut tomber sans
// emporter la courbe, et reciproquement (prp/03-graphe-de-pluie.md,
// section 4). Erreur n'est renseigne que lorsque les DEUX manquent — c'est le
// seul cas ou la section n'a rien a montrer.
type ReponsePluie struct {
	Frais bool             `json:"frais"`
	Heure *VueBandeNowcast `json:"heure,omitempty"`
	Jour  *VueCourbePluie  `json:"jour,omitempty"`
	// Desaccord dit que le radar annonce une averse la ou la courbe du jour ne
	// dessine aucune barre (desaccordRadarModele). Un booleen, pas une phrase
	// : le serveur constate, la page ecrit les mots — meme partage que partout
	// ailleurs ici. Signale le 20 aout 2026 (PRODUCT.md, « Ajoute apres les
	// PRP ») : les deux graphes portent la meme grammaire et se lisent donc
	// comme deux mesures comparables, alors que l'un observe et l'autre
	// calcule.
	Desaccord   bool   `json:"desaccord,omitempty"`
	Erreur      string `json:"erreur,omitempty"`
	JourAffiche string `json:"jour_affiche,omitempty"`
}

// dureePasFin est le pas du modele a maille fine. Sert a verifier qu'une
// journee est couverte de bout en bout, sans compter les pas : un jour de
// changement d'heure en porte 92 ou 100, pas 96.
const dureePasFin = 15 * time.Minute

// vuePluie assemble la section. Le choix du pas se lit dans la donnee, jamais
// dans un seuil code en dur : la courbe passe au quart d'heure SEULEMENT si
// la serie fine couvre le jour de la premiere a la derniere minute. Une
// couverture partielle — le cas du jour ou AROME s'arrete — retombe sur
// l'horaire entier plutot que d'afficher une courbe fine tronquee a 11 h qui
// se lirait comme « plus rien apres » (prp/03-graphe-de-pluie.md, section 4).
// maintenant est un parametre explicite, jamais time.Now() appele ici.
func vuePluie(s SeriePluie, n *Nowcast, maintenant time.Time, frais bool, dateCible *time.Time) ReponsePluie {
	v := ReponsePluie{Frais: frais}

	jour := debutDuJour(maintenant)
	if dateCible != nil {
		jour = debutDuJour(*dateCible)
		v.JourAffiche = jour.Format("2006-01-02")
	}
	fin := jour.AddDate(0, 0, 1)

	// pointsCourbe/dureePas retiennent CE QUE LA COURBE DESSINE, pas la serie
	// brute : c'est sur ces pas-la, et sur leur duree, que se juge ensuite le
	// desaccord avec le radar — sans quoi on comparerait le radar a des
	// donnees que l'ecran ne montre pas.
	var pointsCourbe []PasPluie
	var dureePas time.Duration
	if quarts := pasDuJour(s.Quarts, jour, fin); couvreLeJour(quarts, jour, fin, dureePasFin) {
		v.Jour = courbePluie("quart", quarts)
		pointsCourbe, dureePas = quarts, dureePasFin
	} else if heures := pasDuJour(s.Heures, jour, fin); len(heures) > 0 {
		v.Jour = courbePluie("heure", heures)
		pointsCourbe, dureePas = heures, time.Hour
	}

	// La bande de l'heure qui vient n'existe que pour aujourd'hui : elle
	// decrit les 60 prochaines minutes, une notion qui n'a pas de sens sur un
	// autre jour. La montrer vide y serait indistinguable d'une heure seche.
	if n != nil && jour.Equal(debutDuJour(maintenant)) {
		v.Heure = bandeNowcast(*n, maintenant)
		v.Desaccord = desaccordRadarModele(*n, pointsCourbe, dureePas)
	}

	if v.Jour == nil && v.Heure == nil {
		// Meme gabarit de phrase que les trois autres sections (web/app.js,
		// carteIndisponible) : « <Sujet> indisponible : <qui ne repond pas>.
		// Nouvelle tentative automatique dans 5 minutes. »
		v.Erreur = "Pluie indisponible : aucune des deux sources de pluie ne répond. Nouvelle tentative automatique dans 5 minutes."
	}
	return v
}

// niveauPluieNowcast est le premier niveau Meteo-France qui est une pluie :
// 1 est le temps sec, et ne dessine aucune barre (app.js, meme regle).
const niveauPluieNowcast = 2

// desaccordRadarModele dit que le radar annonce une averse sur une fenetre ou
// la courbe du jour ne dessine RIEN. Les deux graphes se ressemblent trait
// pour trait — memes bandes, meme vocabulaire, l'un sous l'autre — ce qui
// promet au lecteur qu'ils s'accordent ; or l'un observe ce qui arrive et
// l'autre restitue un modele calcule des heures plus tot, qui ne sait pas
// poser une averse de dix minutes au bon quart d'heure. Quand ils divergent,
// l'ecran doit le dire et designer le radar (PRODUCT.md, 20 aout 2026).
//
// Le critere est « aucune barre », pas un seuil en millimetres : c'est
// exactement la regle de trace (une barre n'existe que pour une intensite
// strictement positive), donc la phrase paraît quand, et seulement quand, le
// lecteur voit un graphe vide sous un graphe qui annonce de la pluie.
func desaccordRadarModele(n Nowcast, pointsCourbe []PasPluie, dureePas time.Duration) bool {
	if len(n.Pas) == 0 || len(pointsCourbe) == 0 {
		return false
	}

	averse := false
	debut, fin := n.Pas[0].Instant, n.Pas[0].Instant
	for _, p := range n.Pas {
		if p.Niveau >= niveauPluieNowcast {
			averse = true
		}
		if p.Instant.Before(debut) {
			debut = p.Instant
		}
		if p.Instant.After(fin) {
			fin = p.Instant
		}
	}
	if !averse {
		return false
	}

	// Un pas de la courbe couvre [Instant, Instant+dureePas) : il recouvre la
	// fenetre du radar des qu'il commence avant sa fin et se termine apres son
	// debut. Sans cette duree, un pas de quart d'heure commence a 13 h 45
	// paraîtrait etranger a une averse annoncee a 13 h 50.
	for _, p := range pointsCourbe {
		if p.Instant.After(fin) || !p.Instant.Add(dureePas).After(debut) {
			continue
		}
		if p.Mm > 0 {
			return false
		}
	}
	return true
}

// pasDuJour ne garde que les pas dont l'instant tombe dans [jour, fin).
func pasDuJour(pas []PasPluie, jour, fin time.Time) []PasPluie {
	garde := make([]PasPluie, 0, 96)
	for _, p := range pas {
		if p.Instant.Before(jour) || !p.Instant.Before(fin) {
			continue
		}
		garde = append(garde, p)
	}
	return garde
}

// couvreLeJour dit si la serie va bien du premier au dernier pas de la
// journee, sans trou. Compte les pas plutot que de comparer aux seules bornes
// : une serie a laquelle il manquerait deux heures au milieu commencerait et
// finirait pourtant au bon endroit. Le nombre attendu se calcule depuis la
// duree reelle de la journee, qui vaut 23 ou 25 heures deux fois par an.
func couvreLeJour(pas []PasPluie, jour, fin time.Time, duree time.Duration) bool {
	if len(pas) == 0 {
		return false
	}
	return len(pas) == int(fin.Sub(jour)/duree)
}

// seuilAversePossible est le risque a partir duquel la vignette d'une heure
// porte la pastille « averse possible ». Le pourcentage lui-meme ne s'affiche
// plus (VueHeure) : ce qu'il vaut vraiment, c'est de dire s'il faut emporter
// un impermeable, pas de mettre un nombre a deux chiffres a cote d'une lame
// d'eau en millimetres. 60 % est le seuil retenu le 20 aout 2026 avec
// l'utilisateur — sur la journee qui a motive le changement, il allume la
// pastille sur les quatre heures d'averses annoncees et la laisse eteinte sur
// les quatre suivantes.
const seuilAversePossible = 60

// cleHeure identifie une heure de facon stable. Une cle de texte, PAS un
// time.Time : deux time.Time du meme instant ne sont egaux en cle de carte que
// s'ils portent aussi le meme pointeur de fuseau et la meme part monotone, ce
// que rien ne garantit entre une heure venue de meteo.go et un pas venu de
// pluie.go.
func cleHeure(t time.Time) string {
	return t.In(parisTZ).Format("2006-01-02T15")
}

// pluieParHeure rend la lame d'eau attendue, heure par heure, sur toute la
// fenetre couverte par la serie. C'est LA fonction qui tient la promesse du
// 20 aout 2026 : elle applique jour par jour exactement la regle de vuePluie —
// le quart d'heure quand il couvre le jour de bout en bout, l'horaire sinon —
// si bien que la vignette d'une heure et la courbe du meme jour sortent
// toujours de la meme serie.
//
// Une heure absente de la carte rendue est une heure INCONNUE (hors fenetre,
// ou source en panne) ; une heure presente a 0 est une heure connue seche. Les
// deux se lisent differemment a l'ecran, d'ou la carte plutot qu'un tableau de
// zeros.
func pluieParHeure(s SeriePluie) map[string]float64 {
	parHeure := make(map[string]float64, len(s.Heures))

	// L'horaire couvre toute la fenetre de navigation : il pose le fond.
	for _, p := range s.Heures {
		parHeure[cleHeure(p.Instant)] = p.Mm
	}

	// La ou le quart d'heure couvre un jour entier, il REMPLACE l'horaire pour
	// ce jour-la. Remise a zero des vingt-quatre heures d'abord : le jour est
	// desormais connu de bout en bout, y compris ses heures seches, et une
	// valeur horaire laissee la ferait un total different de celui de la
	// courbe.
	for _, jour := range joursCouvertsAuQuart(s.Quarts) {
		fin := jour.AddDate(0, 0, 1)
		for h := jour; h.Before(fin); h = h.Add(time.Hour) {
			parHeure[cleHeure(h)] = 0
		}
		for _, p := range pasDuJour(s.Quarts, jour, fin) {
			parHeure[cleHeure(p.Instant)] += p.Mm
		}
	}
	return parHeure
}

// joursCouvertsAuQuart rend les jours que la serie fine couvre de la premiere
// a la derniere minute. Une couverture PARTIELLE — le jour ou le modele a
// maille fine s'arrete — n'y figure pas : ce jour-la reste entierement a
// l'horaire, comme la courbe (vuePluie). Melanger les deux echelles a
// l'interieur d'une meme journee ferait un cumul que la courbe ne montre nulle
// part.
func joursCouvertsAuQuart(quarts []PasPluie) []time.Time {
	var jours []time.Time
	vus := make(map[string]bool)
	for _, p := range quarts {
		jour := debutDuJour(p.Instant)
		cle := jour.Format("2006-01-02")
		if vus[cle] {
			continue
		}
		vus[cle] = true
		fin := jour.AddDate(0, 0, 1)
		if couvreLeJour(pasDuJour(quarts, jour, fin), jour, fin, dureePasFin) {
			jours = append(jours, jour)
		}
	}
	return jours
}

func courbePluie(pas string, points []PasPluie) *VueCourbePluie {
	c := VueCourbePluie{Pas: pas, Points: make([]VuePasPluie, 0, len(points))}
	var total, max float64
	for _, p := range points {
		c.Points = append(c.Points, VuePasPluie{Heure: p.Instant.Format("15:04"), Mm: arrondi2(p.Mm)})
		total += p.Mm
		if p.Mm > max {
			max = p.Mm
		}
	}
	c.TotalMm = arrondi1(total)
	c.MaxMm = arrondi2(max)
	return &c
}

func bandeNowcast(n Nowcast, maintenant time.Time) *VueBandeNowcast {
	b := VueBandeNowcast{Lieu: n.Lieu, Pas: make([]VuePasNowcast, 0, len(n.Pas))}
	if !n.MiseAJour.IsZero() {
		b.MiseAJour = n.MiseAJour.In(parisTZ).Format("15:04")
		// Un releve date du futur (horloges desaccordees) ne rend pas un age
		// negatif : il n'y a alors rien de sur a dire, et la ligne se tait.
		if age := int(maintenant.Sub(n.MiseAJour).Minutes()); age >= 0 {
			b.MiseAJourMinutes = &age
		}
	}
	for _, p := range n.Pas {
		b.Pas = append(b.Pas, VuePasNowcast{
			Heure:   p.Instant.In(parisTZ).Format("15:04"),
			Niveau:  p.Niveau,
			Libelle: libellesNowcast[p.Niveau],
		})
	}
	return &b
}
