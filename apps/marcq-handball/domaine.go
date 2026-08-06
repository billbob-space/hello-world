// domaine.go — le portage Go de la part de web/domaine.js dont le rang a
// besoin. C'est le seul endroit du projet ou le domaine existe en deux
// langages, et l'ossature §2 dit pourquoi : un rang calcule par le client
// serait un rang declare par le client.
//
// Le portage est PARTIEL, et la frontiere est nette : le serveur compte des
// cases parmi celles deja programmees, il n'affiche pas de calendrier.
// etatSeance, seanceDuJour et calendrier ne sont pas portes — ce seraient trois
// fonctions a maintenir en double sans un seul appelant.
//
// Comme dans domaine.js, les dates sont des jours calendaires 'YYYY-MM-DD'
// compares comme des chaines : l'ordre lexicographique de l'ISO 8601 est
// l'ordre chronologique. Aucune horloge implicite : le jour est un parametre.
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"time"
)

// Les unites mesurables. « autre » existe pour les exercices sans volume
// calculable et n'entre dans aucun total.
var unites = map[string]bool{
	"pompes": true, "squats": true, "burpees": true, "abdos": true,
	"gainage_s": true, "min_course": true, "fentes": true, "autre": true,
}

var typesBloc = map[string]bool{"course": true, "renforcement": true}

type Mesure struct {
	Unite  string `json:"unite"`
	Valeur int    `json:"valeur"`
}

type Exercice struct {
	ID      string `json:"id"`
	Libelle string `json:"libelle"`
	Mesure  Mesure `json:"mesure"`
}

type Bloc struct {
	Type      string     `json:"type"`
	Titre     string     `json:"titre,omitempty"`
	Tours     int        `json:"tours"`
	Repos     string     `json:"repos,omitempty"`
	Exercices []Exercice `json:"exercices"`
}

type Seance struct {
	Date    string `json:"date"`
	Semaine int    `json:"semaine"`
	Titre   string `json:"titre"`
	Blocs   []Bloc `json:"blocs"`
}

type Programme struct {
	Titre   string   `json:"titre"`
	Debut   string   `json:"debut"`
	Fin     string   `json:"fin"`
	Seances []Seance `json:"seances"`
}

// Totaux porte les six volumes prescrits et le nombre de cases. Les champs
// suivent les unites de l'ossature §4 ; « autre » n'y entre pas.
type Totaux struct {
	Pompes    int `json:"pompes"`
	Squats    int `json:"squats"`
	Burpees   int `json:"burpees"`
	Abdos     int `json:"abdos"`
	GainageS  int `json:"gainage_s"`
	MinCourse int `json:"min_course"`
	Fentes    int `json:"fentes"`
	Cases     int `json:"cases"`
}

// ajouter cumule un volume sur l'unite correspondante. Un « autre » ne compte
// nulle part : c'est ce qui fait tomber le gainage sur les ~24 min du PRD
// plutot que sur ~29 (ossature §4).
func (t *Totaux) ajouter(unite string, volume int) {
	switch unite {
	case "pompes":
		t.Pompes += volume
	case "squats":
		t.Squats += volume
	case "burpees":
		t.Burpees += volume
	case "abdos":
		t.Abdos += volume
	case "gainage_s":
		t.GainageS += volume
	case "min_course":
		t.MinCourse += volume
	case "fentes":
		t.Fentes += volume
	}
}

func jourISO(s string) bool {
	if len(s) != 10 || s[4] != '-' || s[7] != '-' {
		return false
	}
	for i, c := range s {
		if i == 4 || i == 7 {
			continue
		}
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// chargerProgramme lit et valide le programme. Elle leve si un identifiant est
// duplique, si une unite est inconnue, ou si les seances ne sont pas en ordre
// de date croissant — les trois memes refus que chargerProgramme du navigateur.
func chargerProgramme(donnees []byte) (*Programme, error) {
	var p Programme
	// Pas de DisallowUnknownFields ici, a la difference du corps des requetes :
	// programme.json est une donnee du depot, pas une entree hostile, et un
	// champ ajoute par le coach ne doit pas empecher le serveur de demarrer.
	// Le navigateur ne les refuse pas non plus (web/domaine.js).
	if err := json.Unmarshal(donnees, &p); err != nil {
		return nil, fmt.Errorf("programme invalide : %w", err)
	}

	if !jourISO(p.Debut) {
		return nil, fmt.Errorf("programme invalide : debut n'est pas une date YYYY-MM-DD : %q", p.Debut)
	}
	if !jourISO(p.Fin) {
		return nil, fmt.Errorf("programme invalide : fin n'est pas une date YYYY-MM-DD : %q", p.Fin)
	}
	if p.Fin < p.Debut {
		return nil, fmt.Errorf("programme invalide : fin est anterieure a debut")
	}
	if len(p.Seances) == 0 {
		return nil, fmt.Errorf("programme invalide : aucune seance")
	}

	identifiants := make(map[string]bool)
	precedente := ""

	for _, s := range p.Seances {
		if !jourISO(s.Date) {
			return nil, fmt.Errorf("programme invalide : date de seance invalide : %q", s.Date)
		}
		// Strictement croissantes : programmes() et le PRP 11 prennent la
		// premiere qui correspond, un desordre les rendrait faux.
		if s.Date <= precedente {
			return nil, fmt.Errorf("programme invalide : seances non ordonnees ou dupliquees : %s", s.Date)
		}
		if s.Date < p.Debut || s.Date > p.Fin {
			return nil, fmt.Errorf("programme invalide : seance hors programme : %s", s.Date)
		}
		precedente = s.Date

		if s.Titre == "" {
			return nil, fmt.Errorf("programme invalide : titre manquant : %s", s.Date)
		}
		if s.Semaine < 1 {
			return nil, fmt.Errorf("programme invalide : semaine invalide : %s", s.Date)
		}
		if len(s.Blocs) == 0 {
			return nil, fmt.Errorf("programme invalide : aucun bloc : %s", s.Date)
		}

		for _, b := range s.Blocs {
			if !typesBloc[b.Type] {
				return nil, fmt.Errorf("programme invalide : type de bloc inconnu : %q", b.Type)
			}
			if b.Tours < 1 {
				return nil, fmt.Errorf("programme invalide : tours invalide : %s / %s", s.Date, b.Type)
			}
			if len(b.Exercices) == 0 {
				return nil, fmt.Errorf("programme invalide : bloc sans exercice : %s / %s", s.Date, b.Type)
			}

			for _, ex := range b.Exercices {
				if ex.ID == "" {
					return nil, fmt.Errorf("programme invalide : identifiant manquant : %s", s.Date)
				}
				if identifiants[ex.ID] {
					return nil, fmt.Errorf("programme invalide : identifiant en double : %s", ex.ID)
				}
				identifiants[ex.ID] = true
				if ex.Libelle == "" {
					return nil, fmt.Errorf("programme invalide : libelle manquant : %s", ex.ID)
				}
				if !unites[ex.Mesure.Unite] {
					return nil, fmt.Errorf("programme invalide : unite inconnue pour %s : %q", ex.ID, ex.Mesure.Unite)
				}
				if ex.Mesure.Valeur < 0 {
					return nil, fmt.Errorf("programme invalide : valeur invalide : %s", ex.ID)
				}
			}
		}
	}

	return &p, nil
}

// cumuler additionne les volumes des exercices retenus par garder. Une ligne
// d'exercice vaut une case, quel que soit le nombre de tours ; les tours ne
// multiplient que le volume.
func cumuler(p *Programme, garder func(Exercice) bool) Totaux {
	var t Totaux
	for _, s := range p.Seances {
		for _, b := range s.Blocs {
			for _, ex := range b.Exercices {
				if !garder(ex) {
					continue
				}
				t.Cases++
				t.ajouter(ex.Mesure.Unite, ex.Mesure.Valeur*b.Tours)
			}
		}
	}
	return t
}

// totauxPrescrits rend le volume prescrit par le programme entier.
func totauxPrescrits(p *Programme) Totaux {
	return cumuler(p, func(Exercice) bool { return true })
}

// totauxAccomplis rend le volume reellement accompli, d'apres les cases cochees.
func totauxAccomplis(p *Programme, faits map[string]bool) Totaux {
	return cumuler(p, func(ex Exercice) bool { return faits[ex.ID] })
}

// jourEffectif ecrete le jour a la fin du programme. PRD §9 : « Apres le
// 21 aout […] le classement est fige. » Au-dela, le denominateur vaut les cases
// du programme entier et ne bouge plus.
func (p *Programme) jourEffectif(jour string) string {
	if jour > p.Fin {
		return p.Fin
	}
	return jour
}

// programmes rend les identifiants des seances dont la date est <= jour. C'est
// le denominateur du PRD §9, et le filtre de tout envoi.
func (p *Programme) programmes(jour string) map[string]bool {
	jour = p.jourEffectif(jour)
	ids := make(map[string]bool)
	for _, s := range p.Seances {
		// Les seances sont validees strictement croissantes : la premiere
		// posterieure au jour termine le parcours.
		if s.Date > jour {
			break
		}
		for _, b := range s.Blocs {
			for _, ex := range b.Exercices {
				ids[ex.ID] = true
			}
		}
	}
	return ids
}

// seanceDe rend la seance portant cet identifiant d'exercice. Sert a la vue
// coach, qui compte par seance.
func (p *Programme) seanceDe(id string) *Seance {
	for i := range p.Seances {
		for _, b := range p.Seances[i].Blocs {
			for _, ex := range b.Exercices {
				if ex.ID == id {
					return &p.Seances[i]
				}
			}
		}
	}
	return nil
}

// arrondi3 arrondit une part a trois decimales. C'est le SEUL arrondi du
// projet, et il est cote serveur : sans lui, le podium afficherait 90,9 % la ou
// l'ecran perso afficherait 91 % pour le meme enfant.
func arrondi3(x float64) float64 {
	return math.Round(x*1000) / 1000
}

// progression compte les cases cochees parmi celles deja programmees. part vaut
// 0 si programmees vaut 0. Aucune horloge ici : jour est un parametre, comme
// dans domaine.js (ossature §5).
func progression(p *Programme, jour string, faits map[string]bool) (cochees, programmees int, part float64) {
	ids := p.programmes(jour)
	programmees = len(ids)
	for id := range ids {
		if faits[id] {
			cochees++
		}
	}
	if programmees == 0 {
		return cochees, programmees, 0
	}
	return cochees, programmees, arrondi3(float64(cochees) / float64(programmees))
}

// parisFuseau est charge une fois. L'import _ "time/tzdata" de main.go rend le
// chargement possible sur Alpine, qui n'embarque pas la base des fuseaux.
var parisFuseau = chargerParis()

func chargerParis() *time.Location {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		// Sans fuseau, jourParis se replierait sur UTC et le serveur compterait
		// la veille chaque soir entre 22 h et minuit : le denominateur du
		// classement serait faux deux heures par jour, tous les jours.
		panic("fuseau Europe/Paris introuvable : l'import time/tzdata manque ? " + err.Error())
	}
	return loc
}

// jourParis rend le jour calendaire du club. Le fuseau est fige : il doit etre
// celui de aujourdhui() dans app.js, sans quoi le denominateur du serveur et
// l'affichage du telephone divergeraient d'un jour chaque soir. La variable TZ
// n'est deliberement pas lue : le jour du classement est celui du club, pas
// celui de la machine.
func jourParis(t time.Time) string {
	return t.In(parisFuseau).Format("2006-01-02")
}
