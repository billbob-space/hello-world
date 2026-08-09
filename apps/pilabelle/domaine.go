package main

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"slices"
	"sort"
	"time"
)

// Messages porte les trois stocks de contenu ecrits une fois pour toutes
// (PRD §10.1, §12) : piques de retrouvailles, encouragements neutres, mots
// doux. Charge une fois au demarrage, comme le dictionnaire.
type Messages struct {
	Piques struct {
		UnJour           []string `json:"un_jour"`
		QuelquesJours    []string `json:"quelques_jours"`
		UneSemaineOuPlus []string `json:"une_semaine_ou_plus"`
	} `json:"piques"`
	Encouragements []string `json:"encouragements"`
	MotsDoux       []string `json:"mots_doux"`
}

func ChargerMessages(brut []byte) (Messages, error) {
	var m Messages
	if err := json.Unmarshal(brut, &m); err != nil {
		return Messages{}, fmt.Errorf("messages illisibles: %w", err)
	}
	if len(m.Piques.UnJour) == 0 || len(m.Piques.QuelquesJours) == 0 || len(m.Piques.UneSemaineOuPlus) == 0 {
		return Messages{}, fmt.Errorf("chaque famille de pique doit porter au moins un message")
	}
	if len(m.Encouragements) == 0 || len(m.MotsDoux) == 0 {
		return Messages{}, fmt.Errorf("encouragements et mots doux doivent porter au moins un message")
	}
	return m, nil
}

// tirerMessage choisit dans pool, en excluant dernier s'il existe une
// alternative — jamais deux fois de suite (PRD §10.1).
func tirerMessage(pool []string, dernier, sel string) string {
	candidats := pool
	if len(pool) > 1 {
		var sansDernier []string
		for _, m := range pool {
			if m != dernier {
				sansDernier = append(sansDernier, m)
			}
		}
		if len(sansDernier) > 0 {
			candidats = sansDernier
		}
	}
	h := fnv.New32a()
	h.Write([]byte(sel))
	return candidats[int(h.Sum32())%len(candidats)]
}

// familleEtPool classe l'ecart en jours depuis la derniere seance dans l'une
// des trois familles de pique (PRD §7.2).
func familleEtPool(m Messages, ecartJours int) (string, []string) {
	switch {
	case ecartJours == 1:
		return "un_jour", m.Piques.UnJour
	case ecartJours >= 2 && ecartJours <= 6:
		return "quelques_jours", m.Piques.QuelquesJours
	default:
		return "une_semaine_ou_plus", m.Piques.UneSemaineOuPlus
	}
}

// joursDepuisDerniereSeance rend -1 si aucune seance n'a encore ete faite :
// il n'y a alors rien a retrouver, jamais de pique.
func joursDepuisDerniereSeance(p Profil, aujourdhui string) int {
	if len(p.Historique) == 0 {
		return -1
	}
	derniere, err1 := time.Parse("2006-01-02", p.Historique[len(p.Historique)-1].Date)
	jour, err2 := time.Parse("2006-01-02", aujourdhui)
	if err1 != nil || err2 != nil {
		return -1
	}
	return int(jour.Sub(derniere).Hours() / 24)
}

// Zone est l'une des quatre zones d'une seance (PRD §8).
type Zone string

const (
	ZoneMiseEnRoute   Zone = "mise_en_route"
	ZoneVentre        Zone = "ventre"
	ZoneCuisses       Zone = "cuisses"
	ZoneRetourAuCalme Zone = "retour_au_calme"
)

type VideoStatut string

const (
	VideoOK          VideoStatut = "ok"
	VideoAValider    VideoStatut = "a_valider"
	VideoARechercher VideoStatut = "a_rechercher"
)

type Video struct {
	Statut VideoStatut `json:"statut"`
	URL    string      `json:"url"`
}

type Minutage struct {
	EffortS int `json:"effort_s"`
	ReposS  int `json:"repos_s"`
	Tours   int `json:"tours"`
}

type Exercice struct {
	ID                string    `json:"id"`
	Zone              Zone      `json:"zone"`
	Famille           *string   `json:"famille"`
	Niveau            *int      `json:"niveau"`
	Nom               string    `json:"nom"`
	Consigne          string    `json:"consigne"`
	ContreIndications []string  `json:"contre_indications"`
	Minutage          *Minutage `json:"minutage"`
	Video             Video     `json:"video"`
}

type EchelonNiveau struct {
	Niveau  int `json:"niveau"`
	EffortS int `json:"effort_s"`
	ReposS  int `json:"repos_s"`
	Tours   int `json:"tours"`
}

type Dictionnaire struct {
	EchelleNiveaux []EchelonNiveau `json:"echelle_niveaux"`
	Exercices      []Exercice      `json:"exercices"`
}

// Reponses, Niveaux, Serie, Ressenti, HistoriqueEntree, DerniersMessages et
// Profil sont les types partages du profil (ossature §7). Definis ici en
// entier plutot qu'ajoutes champ par champ PRP apres PRP : un fichier Go se
// compile comme un tout, et une struct coupee entre plusieurs commits serait
// une source d'erreur, pas une fidelite utile au decoupage des PRP.

type Reponses struct {
	NiveauDepart string   `json:"niveau_depart"` // "debutante" | "a_deja_pratique"
	Douleurs     []string `json:"douleurs"`      // sous-ensemble de contreIndicationsValides
	JoursActifs  []string `json:"jours_actifs"`  // sous-ensemble de joursFR
}

type Niveaux struct {
	Ventre  int `json:"ventre"`
	Cuisses int `json:"cuisses"`
}

type FacilesConsecutifs struct {
	Ventre  int `json:"ventre"`
	Cuisses int `json:"cuisses"`
}

type Serie struct {
	Actuelle int `json:"actuelle"`
	Record   int `json:"record"`
}

type Ressenti string

const (
	RessentiFacile    Ressenti = "facile"
	RessentiCorrect   Ressenti = "correct"
	RessentiDifficile Ressenti = "difficile"
)

type HistoriqueEntree struct {
	Date      string   `json:"date"`
	Ressenti  Ressenti `json:"ressenti"`
	Exercices []string `json:"exercices"`
}

type DerniersMessages struct {
	Pique         string `json:"pique"`
	Encouragement string `json:"encouragement"`
	MotDoux       string `json:"mot_doux"`
}

// DefiSemaine porte le defi tire pour une semaine ISO donnee (PRP 06). Le
// champ Type voyage avec le defi tire (recopie de DefiCatalogue) pour
// qu'EvaluerDefi reste pur : profil + jour suffisent, sans reconsulter le
// catalogue.
type DefiSemaine struct {
	ID      string   `json:"id"`
	Titre   string   `json:"titre"`
	Type    DefiType `json:"type"`
	Releve  bool     `json:"releve"`
	Semaine string   `json:"semaine"` // "2026-W33", ISO
}

type Profil struct {
	VersionSchema      int                `json:"version_schema"`
	Reponses           Reponses           `json:"reponses"`
	Niveaux            Niveaux            `json:"niveaux"`
	FacilesConsecutifs FacilesConsecutifs `json:"faciles_consecutifs"`
	Serie              Serie              `json:"serie"`
	Historique         []HistoriqueEntree `json:"historique"`
	DerniersMessages   DerniersMessages   `json:"derniers_messages"`
	DefiSemaine        *DefiSemaine       `json:"defi_semaine"`
}

var contreIndicationsValides = map[string]bool{
	"genou": true, "dos": true, "epaule": true, "cheville": true,
	"equilibre": true, "poignet": true, "hanche": true, "cou": true,
}

// ChargerDictionnaire valide le contenu au chargement (ossature §4) : un
// dictionnaire invalide ne doit jamais tourner a moitie.
func ChargerDictionnaire(brut []byte) (Dictionnaire, error) {
	var d Dictionnaire
	if err := json.Unmarshal(brut, &d); err != nil {
		return Dictionnaire{}, fmt.Errorf("dictionnaire illisible: %w", err)
	}
	vus := map[string]bool{}
	for _, ex := range d.Exercices {
		if vus[ex.ID] {
			return Dictionnaire{}, fmt.Errorf("id duplique: %s", ex.ID)
		}
		vus[ex.ID] = true
		gradee := ex.Zone == ZoneVentre || ex.Zone == ZoneCuisses
		if gradee && (ex.Famille == nil || ex.Niveau == nil) {
			return Dictionnaire{}, fmt.Errorf("%s: zone gradee sans famille/niveau", ex.ID)
		}
		if !gradee && (ex.Famille != nil || ex.Niveau != nil) {
			return Dictionnaire{}, fmt.Errorf("%s: zone non gradee avec famille/niveau", ex.ID)
		}
		if gradee {
			trouve := false
			for _, e := range d.EchelleNiveaux {
				if e.Niveau == *ex.Niveau {
					trouve = true
					break
				}
			}
			if !trouve {
				return Dictionnaire{}, fmt.Errorf("%s: niveau %d hors de l'echelle", ex.ID, *ex.Niveau)
			}
		}
		if !gradee && ex.Minutage == nil {
			return Dictionnaire{}, fmt.Errorf("%s: zone non gradee sans minutage explicite", ex.ID)
		}
		for _, ci := range ex.ContreIndications {
			if !contreIndicationsValides[ci] {
				return Dictionnaire{}, fmt.Errorf("%s: contre-indication inconnue: %s", ex.ID, ci)
			}
		}
		switch ex.Video.Statut {
		case VideoOK, VideoAValider, VideoARechercher:
		default:
			return Dictionnaire{}, fmt.Errorf("%s: statut video inconnu: %s", ex.ID, ex.Video.Statut)
		}
		if ex.Video.Statut == VideoARechercher && ex.Video.URL != "" {
			return Dictionnaire{}, fmt.Errorf("%s: video a_rechercher porte une url", ex.ID)
		}
	}
	return d, nil
}

// minutageDe resout le minutage effectif d'un exercice (ossature §4) :
// explicite s'il est pose, sinon l'echelon du niveau de l'exercice.
func minutageDe(dico Dictionnaire, ex Exercice) Minutage {
	if ex.Minutage != nil {
		return *ex.Minutage
	}
	for _, e := range dico.EchelleNiveaux {
		if e.Niveau == *ex.Niveau {
			return Minutage{EffortS: e.EffortS, ReposS: e.ReposS, Tours: e.Tours}
		}
	}
	return Minutage{EffortS: 20, ReposS: 15, Tours: 1} // inatteignable si ChargerDictionnaire a valide le niveau
}

func aUneContreIndication(etiquettes, douleurs []string) bool {
	for _, e := range etiquettes {
		if slices.Contains(douleurs, e) {
			return true
		}
	}
	return false
}

// niveauxViables — les niveaux d'une zone graduee qui ont encore au moins un
// candidat une fois les contre-indications de douleurs retirees. Plancher et
// plafond en sont les bornes : ainsi AjusterNiveau ne peut jamais pousser une
// zone vers un niveau que la selection du lendemain ne pourrait pas honorer.
func niveauxViables(dico Dictionnaire, zone Zone, douleurs []string) []int {
	presents := map[int]bool{}
	for _, ex := range dico.Exercices {
		if ex.Zone != zone || aUneContreIndication(ex.ContreIndications, douleurs) {
			continue
		}
		presents[*ex.Niveau] = true
	}
	var niveaux []int
	for n := range presents {
		niveaux = append(niveaux, n)
	}
	sort.Ints(niveaux)
	return niveaux
}

// choisirExercice applique les quatre etapes du PRD §8.2, dans l'ordre.
// Aucun repli silencieux a l'etape 2 (ossature §5) : un dictionnaire trop
// petit pour honorer le niveau courant est une erreur nommee, jamais un
// exercice approche.
func choisirExercice(dico Dictionnaire, zone Zone, douleurs []string, niveauCourant int, idHier, sel string) (Exercice, error) {
	var candidats []Exercice
	for _, ex := range dico.Exercices { // etape 1 : contre-indications
		if ex.Zone == zone && !aUneContreIndication(ex.ContreIndications, douleurs) {
			candidats = append(candidats, ex)
		}
	}
	if zone == ZoneVentre || zone == ZoneCuisses { // etape 2 : niveau, jamais de repli
		var graded []Exercice
		for _, ex := range candidats {
			if *ex.Niveau == niveauCourant {
				graded = append(graded, ex)
			}
		}
		if len(graded) == 0 {
			return Exercice{}, fmt.Errorf("aucun exercice %s au niveau %d compatible avec %v", zone, niveauCourant, douleurs)
		}
		candidats = graded
	}
	if len(candidats) == 0 {
		return Exercice{}, fmt.Errorf("aucun exercice disponible pour %s compatible avec %v", zone, douleurs)
	}
	if len(candidats) > 1 { // etape 3 : eviter la veille si une alternative existe
		var sansHier []Exercice
		for _, ex := range candidats {
			if ex.ID != idHier {
				sansHier = append(sansHier, ex)
			}
		}
		if len(sansHier) > 0 {
			candidats = sansHier
		}
	}
	h := fnv.New32a() // etape 4 : choix deterministe pour un (jour, zone) donne
	h.Write([]byte(sel))
	return candidats[int(h.Sum32())%len(candidats)], nil
}

type Bloc struct {
	Zone      Zone       `json:"zone"`
	Exercices []Exercice `json:"exercices"` // un seul element au lot 1
}

type Seance struct {
	Date  string `json:"date"`
	Blocs []Bloc `json:"blocs"` // dans l'ordre : mise_en_route, ventre, cuisses, retour_au_calme
}

type Cas string

const (
	CasRepos     Cas = "repos"
	CasDejaFaite Cas = "deja-faite"
	CasAFaire    Cas = "a-faire"
)

// SeanceDuJour calcule la seance du jour, ou l'etat de repos/deja-faite
// (PRD §7). Idempotent pour un (profil, jour) donne : deux appels le meme
// jour rendent toujours la meme seance (PRD §7.2).
func SeanceDuJour(dico Dictionnaire, profil Profil, aujourdhui string) (Seance, Cas, error) {
	if !JourActif(profil.Reponses.JoursActifs, aujourdhui) {
		return Seance{}, CasRepos, nil
	}
	if len(profil.Historique) > 0 && profil.Historique[len(profil.Historique)-1].Date == aujourdhui {
		return Seance{}, CasDejaFaite, nil
	}

	idHier := map[Zone]string{}
	if len(profil.Historique) > 0 {
		derniere := profil.Historique[len(profil.Historique)-1]
		for _, id := range derniere.Exercices {
			if ex, ok := trouverExercice(dico, id); ok {
				idHier[ex.Zone] = id
			}
		}
	}

	ordre := []Zone{ZoneMiseEnRoute, ZoneVentre, ZoneCuisses, ZoneRetourAuCalme}
	var blocs []Bloc
	for _, zone := range ordre {
		niveau := 0
		switch zone {
		case ZoneVentre:
			niveau = profil.Niveaux.Ventre
		case ZoneCuisses:
			niveau = profil.Niveaux.Cuisses
		}
		ex, err := choisirExercice(dico, zone, profil.Reponses.Douleurs, niveau, idHier[zone], aujourdhui+"|"+string(zone))
		if err != nil {
			return Seance{}, "", err
		}
		blocs = append(blocs, Bloc{Zone: zone, Exercices: []Exercice{ex}})
	}
	return Seance{Date: aujourdhui, Blocs: blocs}, CasAFaire, nil
}

func trouverExercice(dico Dictionnaire, id string) (Exercice, bool) {
	for _, ex := range dico.Exercices {
		if ex.ID == id {
			return ex, true
		}
	}
	return Exercice{}, false
}

// NiveauInitial deduit le niveau de depart de chaque zone du questionnaire
// initial (PRD §8.2).
func NiveauInitial(reponses Reponses) Niveaux {
	depart := 1
	if reponses.NiveauDepart == "a_deja_pratique" {
		depart = 2
	}
	return Niveaux{Ventre: depart, Cuisses: depart}
}

// AjusterNiveau applique le ressenti d'une seance aux deux zones travaillees
// (PRD §8.2). "correct" remet a zero le compteur de facile consecutifs comme
// "difficile" : "plusieurs seances DE SUITE" (PRD) casse des qu'autre chose
// s'intercale.
func AjusterNiveau(dico Dictionnaire, zone Zone, douleurs []string, niveauCourant, facilesConsecutifs int, ressenti Ressenti) (nouveauNiveau, nouveauxFaciles int) {
	viables := niveauxViables(dico, zone, douleurs)
	if len(viables) == 0 {
		return niveauCourant, 0 // inatteignable : PRD §12 exige un dictionnaire toujours suffisant
	}
	plancher, plafond := viables[0], viables[len(viables)-1]
	switch ressenti {
	case RessentiDifficile:
		return max(niveauCourant-1, plancher), 0
	case RessentiFacile:
		fc := facilesConsecutifs + 1
		if fc >= 3 {
			return min(niveauCourant+1, plafond), 0
		}
		return niveauCourant, fc
	default: // RessentiCorrect
		return niveauCourant, 0
	}
}

var joursFR = map[string]time.Weekday{
	"dimanche": time.Sunday, "lundi": time.Monday, "mardi": time.Tuesday,
	"mercredi": time.Wednesday, "jeudi": time.Thursday, "vendredi": time.Friday,
	"samedi": time.Saturday,
}

// JourActif dit si dateISO est un jour d'entrainement declare (PRD §6 item 1,
// §7.5). Un jour non declare actif est un jour de repos automatique.
func JourActif(joursActifs []string, dateISO string) bool {
	d, err := time.Parse("2006-01-02", dateISO)
	if err != nil {
		return false
	}
	for _, j := range joursActifs {
		if joursFR[j] == d.Weekday() {
			return true
		}
	}
	return false
}

// MettreAJourSerie ne compte que les jours ACTIFS (ossature §6, decision
// documentee) : un jour actif entre dernierJourFait (exclu) et aujourdhui
// (exclu) sans seance casse la serie ; l'absence de jour actif entre les
// deux la prolonge.
func MettreAJourSerie(serie Serie, joursActifs []string, dernierJourFait, aujourdhui string) Serie {
	if dernierJourFait != "" && !jourActifManqueEntre(joursActifs, dernierJourFait, aujourdhui) {
		serie.Actuelle++
	} else {
		serie.Actuelle = 1
	}
	if serie.Actuelle > serie.Record {
		serie.Record = serie.Actuelle
	}
	return serie
}

func jourActifManqueEntre(joursActifs []string, debut, fin string) bool {
	d, errD := time.Parse("2006-01-02", debut)
	f, errF := time.Parse("2006-01-02", fin)
	if errD != nil || errF != nil {
		return false
	}
	for cur := d.AddDate(0, 0, 1); cur.Before(f); cur = cur.AddDate(0, 0, 1) {
		if JourActif(joursActifs, cur.Format("2006-01-02")) {
			return true
		}
	}
	return false
}

func idsDeLaSeance(s Seance) []string {
	var ids []string
	for _, b := range s.Blocs {
		for _, ex := range b.Exercices {
			ids = append(ids, ex.ID)
		}
	}
	return ids
}

// motDouxDeTempsEnTemps rend vrai environ une fois sur deux (PRD §10.1 :
// « pas a chaque fois »). La cadence n'est pas prescrite par le PRD ; ce
// tirage se resserre ou se desserre depuis ce seul point si l'usage reel
// montre une frequence mal calibree — resserree le 9 aout 2026, retour
// d'usage : la frequence a 1/3 la rendait trop rare.
func motDouxDeTempsEnTemps(sel string) bool {
	h := fnv.New32a()
	h.Write([]byte(sel))
	return h.Sum32()%2 == 0
}

func ressentiValide(r Ressenti) bool {
	return r == RessentiFacile || r == RessentiCorrect || r == RessentiDifficile
}

// DefiType est le petit vocabulaire ferme du PRP 06 (verrou du 9 aout 2026) :
// deux types, pas plus pour ce lot, chacun verifiable depuis
// profil.Historique et profil.Reponses.JoursActifs seuls.
type DefiType string

const (
	// Chaque jour actif de la semaine ISO a une entree dans l'historique a
	// cette date.
	DefiToutesLesSeancesActives DefiType = "toutes_les_seances_actives"
	// Au moins deux entrees ressenti "facile" dans la semaine ISO.
	DefiRessentiFacileX2 DefiType = "ressenti_facile_x2"
)

// DefiCatalogue est une entree de data/defis.json — le stock hand-ecrit
// (verrou §"Le verrou, tranche le 9 aout 2026") : six defis, trois par type.
type DefiCatalogue struct {
	ID    string   `json:"id"`
	Titre string   `json:"titre"`
	Type  DefiType `json:"type"`
}

type defisFichier struct {
	Defis []DefiCatalogue `json:"defis"`
}

// ChargerDefis valide le catalogue au chargement, sur le meme principe que
// ChargerMessages : un id duplique ou un type hors du vocabulaire ferme sont
// fatals au demarrage, jamais absorbes en silence.
func ChargerDefis(brut []byte) ([]DefiCatalogue, error) {
	var f defisFichier
	if err := json.Unmarshal(brut, &f); err != nil {
		return nil, fmt.Errorf("defis illisibles: %w", err)
	}
	vus := map[string]bool{}
	parType := map[DefiType]int{}
	for _, d := range f.Defis {
		if d.ID == "" {
			return nil, fmt.Errorf("defi sans id")
		}
		if vus[d.ID] {
			return nil, fmt.Errorf("id de defi duplique: %s", d.ID)
		}
		vus[d.ID] = true
		if d.Titre == "" {
			return nil, fmt.Errorf("%s: titre vide", d.ID)
		}
		switch d.Type {
		case DefiToutesLesSeancesActives, DefiRessentiFacileX2:
		default:
			return nil, fmt.Errorf("%s: type de defi inconnu: %s", d.ID, d.Type)
		}
		parType[d.Type]++
	}
	if parType[DefiToutesLesSeancesActives] == 0 || parType[DefiRessentiFacileX2] == 0 {
		return nil, fmt.Errorf("chaque type de defi doit porter au moins un defi")
	}
	return f.Defis, nil
}

// DefiDeLaSemaine tire le defi d'une semaine ISO donnee (verrou du 9 aout
// 2026) : reutilise tirerMessage telle quelle, meme mecanique et meme
// garantie de non-repetition que les piques (PRP 04). dernier est l'ID du
// defi de la semaine precedente ("" s'il n'y en a pas encore) ; sel doit
// valoir semaineISO + "|" + email pour que le tirage varie par semaine et
// par compte, comme prescrit par le verrou.
func DefiDeLaSemaine(catalogue []DefiCatalogue, dernier, sel, semaineISO string) DefiSemaine {
	ids := make([]string, len(catalogue))
	for i, d := range catalogue {
		ids[i] = d.ID
	}
	choisi := tirerMessage(ids, dernier, sel)
	for _, d := range catalogue {
		if d.ID == choisi {
			return DefiSemaine{ID: d.ID, Titre: d.Titre, Type: d.Type, Semaine: semaineISO}
		}
	}
	return DefiSemaine{} // inatteignable : ChargerDefis garantit un catalogue non vide
}

// EvaluerDefi dit si le defi vient d'etre rempli (verrou du 9 aout 2026) :
// une fonction pure, sans acces disque ni horloge implicite, verifiee
// entierement depuis profil.Historique et profil.Reponses.JoursActifs.
// jour borne les entrees prises en compte a celles qui ne sont pas
// posterieures a aujourd'hui, par precaution defensive. Appelee apres
// chaque POST /api/ressenti ; rater un defi ne fait jamais rendre vrai un
// echec explicite, cette fonction ne renvoie que "rempli" ou "pas encore".
func EvaluerDefi(defi DefiSemaine, profil Profil, jour string) bool {
	switch defi.Type {
	case DefiToutesLesSeancesActives:
		return toutesLesSeancesActivesFaites(profil, defi.Semaine, jour)
	case DefiRessentiFacileX2:
		return auMoinsDeuxFacilesDansLaSemaine(profil, defi.Semaine, jour)
	default:
		return false
	}
}

// semaineISODeDate rend l'identifiant de semaine ISO ("2026-W33") de
// dateISO, ou "" si dateISO est illisible.
func semaineISODeDate(dateISO string) string {
	d, err := time.Parse("2006-01-02", dateISO)
	if err != nil {
		return ""
	}
	annee, semaine := d.ISOWeek()
	return fmt.Sprintf("%04d-W%02d", annee, semaine)
}

// lundiDeLaSemaineISO inverse semaineISODeDate : le lundi qui ouvre la
// semaine ISO donnee. Le 4 janvier appartient toujours a la semaine ISO 1
// (regle ISO 8601), ce qui donne un point de depart fiable pour compter les
// semaines suivantes.
func lundiDeLaSemaineISO(semaineISO string) (time.Time, bool) {
	var annee, semaine int
	if _, err := fmt.Sscanf(semaineISO, "%d-W%d", &annee, &semaine); err != nil {
		return time.Time{}, false
	}
	jan4 := time.Date(annee, 1, 4, 0, 0, 0, 0, time.UTC)
	joursDepuisLundi := (int(jan4.Weekday()) + 6) % 7 // dimanche=0 -> 6, lundi=1 -> 0
	lundiSemaine1 := jan4.AddDate(0, 0, -joursDepuisLundi)
	return lundiSemaine1.AddDate(0, 0, (semaine-1)*7), true
}

// datesDeLaSemaineISO rend les sept dates YYYY-MM-DD (lundi a dimanche) de
// la semaine ISO donnee.
func datesDeLaSemaineISO(semaineISO string) []string {
	lundi, ok := lundiDeLaSemaineISO(semaineISO)
	if !ok {
		return nil
	}
	dates := make([]string, 7)
	for i := range dates {
		dates[i] = lundi.AddDate(0, 0, i).Format("2006-01-02")
	}
	return dates
}

// toutesLesSeancesActivesFaites verifie le type toutes_les_seances_actives :
// chaque jour actif de la semaine ISO porte une entree dans l'historique a
// cette date. Aucun jour actif declare -> rien a relever, jamais rempli.
func toutesLesSeancesActivesFaites(profil Profil, semaineISO, jour string) bool {
	var attendues []string
	for _, d := range datesDeLaSemaineISO(semaineISO) {
		if d <= jour && JourActif(profil.Reponses.JoursActifs, d) {
			attendues = append(attendues, d)
		}
	}
	if len(attendues) == 0 {
		return false
	}
	faites := map[string]bool{}
	for _, h := range profil.Historique {
		faites[h.Date] = true
	}
	for _, d := range attendues {
		if !faites[d] {
			return false
		}
	}
	return true
}

// auMoinsDeuxFacilesDansLaSemaine verifie le type ressenti_facile_x2 : au
// moins deux entrees "facile" dans la semaine ISO donnee.
func auMoinsDeuxFacilesDansLaSemaine(profil Profil, semaineISO, jour string) bool {
	n := 0
	for _, h := range profil.Historique {
		if h.Date <= jour && h.Ressenti == RessentiFacile && semaineISODeDate(h.Date) == semaineISO {
			n++
		}
	}
	return n >= 2
}

// StatutJour est l'etat d'un jour dans le calendrier de l'ecran personnel
// (PRP 07).
type StatutJour string

const (
	StatutFait   StatutJour = "fait"
	StatutManque StatutJour = "manque"
	StatutRepos  StatutJour = "repos"
	StatutAVenir StatutJour = "avenir"
)

type JourCalendrier struct {
	Date   string     `json:"date"`
	Statut StatutJour `json:"statut"`
}

// Calendrier couvre [debut, fin], inclusif, sans trou (PRP 07). Un jour non
// actif (JourActif faux) est toujours repos, jamais manque. Un jour actif
// qui n'est pas apres aujourdhui sans entree d'historique a cette date est
// manque ; un jour actif apres aujourdhui est avenir, jamais manque — le
// calendrier ne pretend jamais qu'un jour qui n'est pas encore arrive a ete
// rate. debut, fin et aujourdhui sont des YYYY-MM-DD, comparables comme des
// chaines.
func Calendrier(profil Profil, debut, fin, aujourdhui string) []JourCalendrier {
	d, errD := time.Parse("2006-01-02", debut)
	f, errF := time.Parse("2006-01-02", fin)
	if errD != nil || errF != nil {
		return nil
	}
	faites := map[string]bool{}
	for _, h := range profil.Historique {
		faites[h.Date] = true
	}
	var jours []JourCalendrier
	for cur := d; !cur.After(f); cur = cur.AddDate(0, 0, 1) {
		date := cur.Format("2006-01-02")
		var statut StatutJour
		switch {
		case !JourActif(profil.Reponses.JoursActifs, date):
			statut = StatutRepos
		case date > aujourdhui:
			statut = StatutAVenir
		case faites[date]:
			statut = StatutFait
		default:
			statut = StatutManque
		}
		jours = append(jours, JourCalendrier{Date: date, Statut: statut})
	}
	return jours
}

// fenetreCalendrier calcule la fenetre par defaut de l'ecran personnel (PRP
// 07, "a ajuster a l'usage plutot qu'a figer ici") : les quatre semaines
// ecoulees plus la semaine en cours, du lundi de la semaine courante moins
// 28 jours au dimanche de la semaine courante — ce qui montre aussi les
// jours a venir de la semaine en cours (statut "avenir").
func fenetreCalendrier(aujourdhui string) (debut, fin string) {
	d, err := time.Parse("2006-01-02", aujourdhui)
	if err != nil {
		return "", ""
	}
	joursDepuisLundi := (int(d.Weekday()) + 6) % 7 // dimanche=0 -> 6, lundi=1 -> 0
	lundi := d.AddDate(0, 0, -joursDepuisLundi)
	return lundi.AddDate(0, 0, -28).Format("2006-01-02"), lundi.AddDate(0, 0, 6).Format("2006-01-02")
}
