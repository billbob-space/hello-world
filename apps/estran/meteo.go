package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HeureMeteo est un pas horaire de la prevision, tel qu'utilise par la vue
// des heures restantes du jour (minimum nombreHeuresMinimum, domaine.go).
// TemperatureC/PluiePct/VentKmh/VentDirectionDeg sont nullables : Open-Meteo
// rend `null` sur ces grandeurs au bord de sa fenetre (le dernier jour
// entier de forecast_days=16, seuil qui bouge d'une heure a l'autre) —
// decodees en float64 ces absences deviendraient des zeros invente
// (« 0 °C », « 0 km/h »), exactement ce que le principe 3 du PRD interdit
// (prp/02-horizon-confiance-vent.md, section Degradation, verifie en direct
// le 18 aout 2026). VaguesM, deja nullable, reste le modele : absent (nil)
// quand la reponse Marine ne couvre pas cet horodatage exact ou y rend
// `null`.
type HeureMeteo struct {
	Heure                time.Time
	TemperatureC         *float64
	PluiePct             *float64
	NebulositePct        float64
	NebulositeBassePct   float64
	NebulositeMoyennePct float64
	NebulositeHautePct   float64
	EstJour              bool
	VentKmh              *float64
	VentDirectionDeg     *float64
	VaguesM              *float64
	CodeMeteo            int
}

// JourMeteo est un pas journalier de la tendance a 16 jours.
// TempMinC/TempMaxC/PluiePctMax/VentKmhMax/RafalesKmhMax/VentDirectionDeg
// sont nullables pour la meme raison que dans HeureMeteo ci-dessus :
// Open-Meteo rend `null` sur ces grandeurs journalieres au bord de sa
// fenetre (prp/02-horizon-confiance-vent.md, section Degradation). Un jour
// sans TempMinC/TempMaxC n'est pas affiche du tout (domaine.go) ; les autres
// grandeurs, secondaires, laissent seulement leur propre ligne de cote.
// NebulositeBassePct/MoyennePct/HautePct sont l'agregat (moyenne) des heures
// de JOUR (EstJour) de cette date, calcule dans Recuperer a partir de la
// serie horaire — Open-Meteo ne rend pas ces couches en journalier.
// CouchesConnues dit si cet agregat existe (faux si aucune heure de jour
// n'est disponible pour la date, auquel cas les trois champs restent a 0 et
// ne doivent pas etre utilises). Confiance/ConfianceModeles restent a leur
// zero-valeur ("", 0) quand l'indice de confiance n'a pas pu etre calcule
// (moins de deux modeles sur la temperature, ou appel d'accord en echec) :
// jamais une valeur inventee.
type JourMeteo struct {
	Date                 time.Time
	TempMinC             *float64
	TempMaxC             *float64
	PluiePctMax          *float64
	CodeMeteo            int
	NebulositeBassePct   float64
	NebulositeMoyennePct float64
	NebulositeHautePct   float64
	CouchesConnues       bool
	VentKmhMax           *float64
	RafalesKmhMax        *float64
	VentDirectionDeg     *float64
	Confiance            string
	ConfianceModeles     int
}

// Previsions rassemble la prevision horaire complete (la vue n'en garde que
// les heures restantes du jour, minimum nombreHeuresMinimum) et la tendance
// journaliere.
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

// reponseForecastBrute decode la reponse Open-Meteo previsions. Les series
// qui peuvent porter `null` au bord de la fenetre (verifie en direct le 18
// aout 2026, prp/02-horizon-confiance-vent.md section Degradation) sont
// decodees en []*float64 plutot qu'en []float64 : Go range alors nil pour un
// element JSON null, au lieu du zero silencieux que []float64 aurait produit.
// CloudCover*/IsDay/WeatherCode restent non nullables : jamais observes
// absents, et non couverts par le defaut constate.
type reponseForecastBrute struct {
	Hourly struct {
		Time                     []string   `json:"time"`
		Temperature2m            []*float64 `json:"temperature_2m"`
		PrecipitationProbability []*float64 `json:"precipitation_probability"`
		CloudCover               []float64  `json:"cloud_cover"`
		CloudCoverLow            []float64  `json:"cloud_cover_low"`
		CloudCoverMid            []float64  `json:"cloud_cover_mid"`
		CloudCoverHigh           []float64  `json:"cloud_cover_high"`
		IsDay                    []float64  `json:"is_day"`
		WindSpeed10m             []*float64 `json:"wind_speed_10m"`
		WindDirection10m         []*float64 `json:"wind_direction_10m"`
		WeatherCode              []int      `json:"weather_code"`
	} `json:"hourly"`
	Daily struct {
		Time                        []string   `json:"time"`
		Temperature2mMax            []*float64 `json:"temperature_2m_max"`
		Temperature2mMin            []*float64 `json:"temperature_2m_min"`
		PrecipitationProbabilityMax []*float64 `json:"precipitation_probability_max"`
		WeatherCode                 []int      `json:"weather_code"`
		WindSpeed10mMax             []*float64 `json:"wind_speed_10m_max"`
		WindGusts10mMax             []*float64 `json:"wind_gusts_10m_max"`
		WindDirection10mDominant    []*float64 `json:"wind_direction_10m_dominant"`
	} `json:"daily"`
}

// modelesAccord liste les six modeles interroges pour l'indice de confiance
// (prp/02-horizon-confiance-vent.md, section 3) : six services
// meteorologiques nationaux, agreges gratuitement et sans cle par Open-Meteo.
var modelesAccord = []string{
	"icon_seamless", "gfs_seamless", "ecmwf_ifs025",
	"meteofrance_seamless", "gem_seamless", "ukmo_seamless",
}

// reponseAccordBrute decode la reponse de l'appel d'accord entre modeles :
// chaque grandeur porte un champ par modele, suffixe de son nom
// (ex. temperature_2m_max_icon_seamless), avec des valeurs JSON null la ou
// un modele ne porte pas si loin (verifie en direct le 18 aout 2026 :
// au-dela de J+10, seul gfs_seamless rend encore la pluie). Decode en
// map[string]json.RawMessage plutot qu'un champ Go par modele : la liste des
// modeles est une variable (modelesAccord), pas une structure figee.
type reponseAccordBrute struct {
	Daily map[string]json.RawMessage `json:"daily"`
}

// accordJour porte, pour un jour de la fenetre, les valeurs NON NULLES
// rendues par chaque modele pour la temperature maximale et la probabilite
// de pluie — l'ordre des modeles n'est pas garde, seul le compte l'est
// (calculerConfiance).
type accordJour struct {
	Date         time.Time
	Temperatures []float64
	Pluies       []float64
}

// reponseMarineBrute decode la reponse Open-Meteo Marine. WaveHeight en
// []*float64 pour la meme raison que reponseForecastBrute ci-dessus : au
// bord de la fenetre, le fournisseur rend `null` sur toute la derniere
// journee (verifie en direct le 18 aout 2026) — decode en []float64,
// c'etait un 0.0 invente qui passait le test `ok` de la fusion par
// horodatage ci-dessous (Recuperer) comme une vraie mesure.
type reponseMarineBrute struct {
	Hourly struct {
		Time       []string   `json:"time"`
		WaveHeight []*float64 `json:"wave_height"`
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

	// vagues ne retient que les horodatages ou le fournisseur Marine rend une
	// hauteur EFFECTIVE : un `null` (marine.Hourly.WaveHeight[i] == nil) ne
	// doit jamais entrer dans cette carte, sinon la ligne `if v, ok :=
	// vagues[t]; ok` plus bas le prendrait pour une vraie mesure de 0.0
	// (prp/02-horizon-confiance-vent.md, section Degradation).
	vagues := map[string]float64{}
	if marine, err := c.recupererMarine(ctx); err == nil {
		for i, t := range marine.Hourly.Time {
			if i < len(marine.Hourly.WaveHeight) && marine.Hourly.WaveHeight[i] != nil {
				vagues[t] = *marine.Hourly.WaveHeight[i]
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
			TemperatureC:         valeurPtrA(forecast.Hourly.Temperature2m, i),
			PluiePct:             valeurPtrA(forecast.Hourly.PrecipitationProbability, i),
			NebulositePct:        valeurA(forecast.Hourly.CloudCover, i),
			NebulositeBassePct:   valeurA(forecast.Hourly.CloudCoverLow, i),
			NebulositeMoyennePct: valeurA(forecast.Hourly.CloudCoverMid, i),
			NebulositeHautePct:   valeurA(forecast.Hourly.CloudCoverHigh, i),
			EstJour:              valeurA(forecast.Hourly.IsDay, i) == 1,
			VentKmh:              valeurPtrA(forecast.Hourly.WindSpeed10m, i),
			VentDirectionDeg:     valeurPtrA(forecast.Hourly.WindDirection10m, i),
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
			Date:             date,
			TempMinC:         valeurPtrA(forecast.Daily.Temperature2mMin, i),
			TempMaxC:         valeurPtrA(forecast.Daily.Temperature2mMax, i),
			PluiePctMax:      valeurPtrA(forecast.Daily.PrecipitationProbabilityMax, i),
			CodeMeteo:        valeurEntiereA(forecast.Daily.WeatherCode, i),
			VentKmhMax:       valeurPtrA(forecast.Daily.WindSpeed10mMax, i),
			RafalesKmhMax:    valeurPtrA(forecast.Daily.WindGusts10mMax, i),
			VentDirectionDeg: valeurPtrA(forecast.Daily.WindDirection10mDominant, i),
		}
		if bas, moyenne, haute, ok := couchesJour(heures, date); ok {
			j.NebulositeBassePct = bas
			j.NebulositeMoyennePct = moyenne
			j.NebulositeHautePct = haute
			j.CouchesConnues = true
		}
		jours = append(jours, j)
	}

	// L'indice de confiance est un ornement verifiable, jamais une dependance
	// (prp/02-horizon-confiance-vent.md, section Degradation) : sous-contexte
	// a delai court, echec journalise, jours servis sans indice — Recuperer
	// ne doit JAMAIS echouer a cause de cet appel.
	ctxAccord, annulerAccord := context.WithTimeout(ctx, delaiAccord)
	defer annulerAccord()
	if accord, err := c.recupererAccord(ctxAccord); err != nil {
		log.Printf("indice de confiance indisponible : %v", err)
	} else {
		parDate := make(map[string]accordJour, len(accord))
		for _, a := range accord {
			parDate[a.Date.Format("2006-01-02")] = a
		}
		for i := range jours {
			if a, ok := parDate[jours[i].Date.Format("2006-01-02")]; ok {
				jours[i].Confiance, jours[i].ConfianceModeles = calculerConfiance(a.Temperatures, a.Pluies)
			}
		}
	}

	return Previsions{Heures: heures, Jours: jours}, nil
}

// delaiAccord borne l'appel d'accord entre modeles a 4s, en sous-contexte du
// contexte recu par Recuperer : cet appel est un ornement verifiable
// (l'indice de confiance), jamais une dependance — s'il traine, la tendance
// doit tout de meme s'afficher a temps (prp/02-horizon-confiance-vent.md,
// section Degradation).
const delaiAccord = 4 * time.Second

// couchesJour moyenne les trois couches nuageuses des heures de JOUR
// (EstJour) de la date donnee. Open-Meteo ne rend pas cloud_cover_low/mid/
// high en journalier ; on les reconstitue depuis l'horaire, seule serie ou
// ils sont presents, pour que la tendance a 16 jours dise « soleil » quand la
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

// forecast_days=16, pas 15 : Open-Meteo compte aujourd'hui dans sa fenetre,
// si bien que forecast_days=15 s'arreterait a J+14 et laisserait le dernier
// jour navigable (J+15) sans meteo alors que la maree, elle, le couvre deja
// (from/to explicites, maree.go) — piege verifie en direct le 16 aout 2026
// (prp/01-navigation-temporelle.md) et confirme a 16 jours le 18 aout 2026
// (prp/02-horizon-confiance-vent.md : 16 rend bien J0 a J+15, pas J0 a J+16).
// 16 est le maximum qu'Open-Meteo rende sans abonnement. past_days=7 : les 7
// jours precedents, ajoutes pour la navigation temporelle. La tendance a 16
// jours (aujourd'hui a J+15) reste entierement couverte par ce meme appel.
func (c *ClientMeteo) recupererForecast(ctx context.Context) (reponseForecastBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=16&past_days=7"+
			"&hourly=temperature_2m,precipitation_probability,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,is_day,wind_speed_10m,wind_direction_10m,weather_code"+
			"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
		c.BaseForecast, c.Latitude, c.Longitude)
	var r reponseForecastBrute
	err := recupererJSON(ctx, c.HTTP, url, &r)
	return r, err
}

// recupererMarine portait forecast_days=2, suffisant pour les 5 prochaines
// heures d'alors mais pas pour un jour choisi jusqu'a 15 jours en avant :
// porte a 16 (aujourd'hui compte dans la fenetre Open-Meteo, cf.
// recupererForecast ci-dessus), plus past_days=7 pour le passe
// (prp/01-navigation-temporelle.md, prp/02-horizon-confiance-vent.md).
func (c *ClientMeteo) recupererMarine(ctx context.Context) (reponseMarineBrute, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=16&past_days=7&hourly=wave_height",
		c.BaseMarine, c.Latitude, c.Longitude)
	var r reponseMarineBrute
	err := recupererJSON(ctx, c.HTTP, url, &r)
	return r, err
}

// recupererAccord interroge le meme fournisseur (BaseForecast) avec un jeu
// de parametres distinct : plusieurs modeles nommes explicitement
// (modelesAccord) plutot qu'un seul modele implicite, et seulement les deux
// grandeurs journalieres dont l'accord entre modeles nourrit l'indice de
// confiance (prp/02-horizon-confiance-vent.md, section 3). Pas de past_days
// : le passe n'a pas besoin d'indice de confiance, seule la tendance a venir
// (16 jours, comme recupererForecast) en a un.
func (c *ClientMeteo) recupererAccord(ctx context.Context) ([]accordJour, error) {
	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&timezone=Europe%%2FParis&forecast_days=16"+
			"&models=%s&daily=temperature_2m_max,precipitation_probability_max",
		c.BaseForecast, c.Latitude, c.Longitude, strings.Join(modelesAccord, ","))
	var r reponseAccordBrute
	if err := recupererJSON(ctx, c.HTTP, url, &r); err != nil {
		return nil, err
	}

	brutTime, ok := r.Daily["time"]
	if !ok {
		return nil, fmt.Errorf("accord entre modeles : champ time absent")
	}
	var dates []string
	if err := json.Unmarshal(brutTime, &dates); err != nil {
		return nil, fmt.Errorf("accord entre modeles : champ time illisible : %w", err)
	}

	jours := make([]accordJour, 0, len(dates))
	for _, d := range dates {
		date, err := time.ParseInLocation("2006-01-02", d, parisTZ)
		if err != nil {
			continue
		}
		jours = append(jours, accordJour{Date: date})
	}
	for i := range jours {
		for _, modele := range modelesAccord {
			if v, ok := valeurModeleA(r.Daily, "temperature_2m_max_"+modele, i); ok {
				jours[i].Temperatures = append(jours[i].Temperatures, v)
			}
			if v, ok := valeurModeleA(r.Daily, "precipitation_probability_max_"+modele, i); ok {
				jours[i].Pluies = append(jours[i].Pluies, v)
			}
		}
	}
	return jours, nil
}

// valeurModeleA lit la valeur au rang i d'un champ journalier suffixe de
// modele, absente (false) si le champ n'existe pas, si i est hors bornes, ou
// si la valeur JSON est null — c'est ce dernier cas qui dit qu'un modele ne
// porte pas jusque-la (prp/02-horizon-confiance-vent.md, section 3).
func valeurModeleA(daily map[string]json.RawMessage, cle string, i int) (float64, bool) {
	brut, ok := daily[cle]
	if !ok {
		return 0, false
	}
	var valeurs []*float64
	if err := json.Unmarshal(brut, &valeurs); err != nil {
		return 0, false
	}
	if i < 0 || i >= len(valeurs) || valeurs[i] == nil {
		return 0, false
	}
	return *valeurs[i], true
}

// rangConfiance ordonne les trois niveaux du plus au moins confiant : sert a
// choisir "le plus prudent des deux" (temperature, pluie) dans
// calculerConfiance.
var rangConfiance = map[string]int{"haute": 2, "moyenne": 1, "basse": 0}

// plusPrudent rend le niveau le moins confiant des deux.
func plusPrudent(a, b string) string {
	if rangConfiance[a] <= rangConfiance[b] {
		return a
	}
	return b
}

// niveauEcartType classe un ecart-type selon deux seuils (haute <= seuilHaute
// <= moyenne <= seuilMoyenne <= basse).
func niveauEcartType(ecart, seuilHaute, seuilMoyenne float64) string {
	switch {
	case ecart <= seuilHaute:
		return "haute"
	case ecart <= seuilMoyenne:
		return "moyenne"
	default:
		return "basse"
	}
}

// ecartTypePopulation est l'ecart-type de POPULATION (division par n, pas
// n-1) : la variance d'echantillon exagererait l'incertitude avec deux ou
// trois modeles seulement, alors que ce sont precisement les valeurs
// observees qui interessent ici, pas une estimation d'une population plus
// large (prp/02-horizon-confiance-vent.md, section 3).
func ecartTypePopulation(valeurs []float64) float64 {
	n := float64(len(valeurs))
	if n == 0 {
		return 0
	}
	var somme float64
	for _, v := range valeurs {
		somme += v
	}
	moyenne := somme / n
	var carres float64
	for _, v := range valeurs {
		carres += (v - moyenne) * (v - moyenne)
	}
	return math.Sqrt(carres / n)
}

// calculerConfiance implemente exactement la regle de
// prp/02-horizon-confiance-vent.md, section 3 : ecart-type de population des
// valeurs non nulles par grandeur, seuils 1/2 °C (temperature) et 15/30
// points (pluie), niveau du jour = le plus prudent des deux. Moins de deux
// modeles sur la temperature : confiance inconnue ("", 0), jamais remplacee
// par une valeur plausible. La pluie est ignoree (niveau = celui de la
// temperature seule) quand moins de deux modeles la portent — frequent
// au-dela de J+10 (recupererAccord). Moins de TROIS modeles sur la
// temperature : le niveau est plafonne a "moyenne", jamais "haute" — deux
// modeles qui s'accordent ne font pas un accord, constate en direct le 18
// aout 2026 (au-dela de J+10, les deux survivants affichaient "haute" la ou
// l'incertitude est maximale, prp/02-horizon-confiance-vent.md, section
// Degradation). Fonction pure, testable sans reseau.
func calculerConfiance(temperatures, pluies []float64) (niveau string, nbModeles int) {
	if len(temperatures) < 2 {
		return "", 0
	}
	niveau = niveauEcartType(ecartTypePopulation(temperatures), 1, 2)
	if len(pluies) >= 2 {
		niveau = plusPrudent(niveau, niveauEcartType(ecartTypePopulation(pluies), 15, 30))
	}
	if len(temperatures) < 3 {
		niveau = plusPrudent(niveau, "moyenne")
	}
	return niveau, len(temperatures)
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

// valeurPtrA lit l'element au rang i d'une serie nullable, nil si i est hors
// bornes OU si l'element JSON etait `null` (encodage.json a deja mis le
// pointeur a nil dans ce cas) — jamais un zero substitue
// (prp/02-horizon-confiance-vent.md, section Degradation).
func valeurPtrA(s []*float64, i int) *float64 {
	if i < 0 || i >= len(s) {
		return nil
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
