// api.go — POST /api/fiche, la SEULE route d'ecriture, et ses trois
// operations (PRP 06, chantier B). Une route unique parce que trois routes
// qui prennent le meme couple pseudonyme/code multiplieraient par trois la
// surface a proteger (marcq-handball a le meme choix).
//
// Aucune route ne liste, ne compte, ni ne recherche de fiches : c'est ce qui
// rend cette API incapable de servir d'annuaire de gymnastes (PRD §10.4).
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"
)

// maxCorps borne le corps d'une requete (PRP 06, chantier B) : un depassement
// rend 400 et n'ecrit rien.
const maxCorps = 256 << 10

// requeteFiche est le corps unique des trois operations. Faits et Badges ne
// servent qu'a « synchroniser » ; Prenom et SemaineDepart servent a « creer »
// et, s'ils sont non vides, mettent a jour la fiche sur « synchroniser »
// (PRD §9.9). Parures, Records et Couleur sont le lot ludique, « Ajoute
// apres les PRP » — memes regles que Badges, Faits et Prenom (voir
// fiche.go, synchroniserFiche).
type requeteFiche struct {
	Operation     string   `json:"operation"`
	Pseudo        string   `json:"pseudo"`
	Code          string   `json:"code"`
	Prenom        string   `json:"prenom,omitempty"`
	SemaineDepart int      `json:"semaineDepart,omitempty"`
	Faits         []Fait   `json:"faits,omitempty"`
	Badges        []string `json:"badges,omitempty"`
	Parures       []string `json:"parures,omitempty"`
	Records       Records  `json:"records,omitempty"`
	Couleur       string   `json:"couleur,omitempty"`
}

// ficheReponse est la fiche telle qu'elle repart vers le client : ni CodeSel
// ni CodeHash n'y figurent jamais, quelle que soit l'operation (PRD §10.3).
type ficheReponse struct {
	Pseudo        string    `json:"pseudo"`
	Prenom        string    `json:"prenom"`
	SemaineDepart int       `json:"semaineDepart"`
	Faits         []Fait    `json:"faits"`
	Badges        []string  `json:"badges"`
	Parures       []string  `json:"parures"`
	Records       Records   `json:"records"`
	Couleur       string    `json:"couleur"`
	CreeeLe       time.Time `json:"creeeLe"`
	MajLe         time.Time `json:"majLe"`
}

func versReponse(f *Fiche) ficheReponse {
	return ficheReponse{
		Pseudo:        f.Pseudo,
		Prenom:        f.Prenom,
		SemaineDepart: f.SemaineDepart,
		Faits:         f.Faits,
		Badges:        f.Badges,
		Parures:       f.Parures,
		Records:       f.Records,
		Couleur:       f.Couleur,
		CreeeLe:       f.CreeeLe,
		MajLe:         f.MajLe,
	}
}

type enveloppeErreur struct {
	Erreur     string `json:"erreur"`
	Message    string `json:"message"`
	AttendreMs int64  `json:"attendreMs,omitempty"`
}

// messages est en francais, affiche tel quel par le front (PRP 07). « Ce
// pseudo est deja pris » et « ton code est faux » partagent VOLONTAIREMENT le
// meme message que « ce pseudo n'existe pas » pour code-refuse : les
// distinguer transformerait la route en oracle d'existence de pseudonymes.
var messages = map[string]string{
	"json-invalide":         "Envoi illisible.",
	"operation-invalide":    "Cette operation n'existe pas.",
	"corps-trop-volumineux": "Envoi trop volumineux.",
	"pseudo-invalide":       "Ce pseudo ne convient pas : 16 caracteres au plus, lettres, chiffres, espace, point, tiret ou souligne.",
	"code-invalide":         "Le code doit etre compose de 6 chiffres.",
	"semaine-invalide":      "La semaine de depart doit etre comprise entre 1 et 8.",
	"faits-invalide":        "La liste des exercices faits est illisible ou trop longue.",
	"pseudo-pris":           "Ce pseudo est deja pris.",
	"code-refuse":           "Ce pseudo n'existe pas, ou le code ne correspond pas.",
	"trop-d-essais":         "Trop d'essais sur ce pseudo. Reessaie dans quelques instants.",
	"magasin-indisponible":  "La sauvegarde n'est pas disponible pour le moment.",
}

var statuts = map[string]int{
	"json-invalide":         http.StatusBadRequest,
	"operation-invalide":    http.StatusBadRequest,
	"corps-trop-volumineux": http.StatusBadRequest,
	"pseudo-invalide":       http.StatusBadRequest,
	"code-invalide":         http.StatusBadRequest,
	"semaine-invalide":      http.StatusBadRequest,
	"faits-invalide":        http.StatusBadRequest,
	"pseudo-pris":           http.StatusConflict,
	"code-refuse":           http.StatusUnauthorized,
	"trop-d-essais":         http.StatusTooManyRequests,
	"magasin-indisponible":  http.StatusServiceUnavailable,
}

func enteteJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Une fiche est une donnee privee : jamais de mise en cache, jamais de
	// lecture par une page tierce.
	w.Header().Set("Cache-Control", "no-store")
}

func repondreJSON(w http.ResponseWriter, statut int, corps any) {
	enteteJSON(w)
	w.WriteHeader(statut)
	if corps == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(corps); err != nil {
		log.Printf("reponse json tronquee : %v", err)
	}
}

// repondreErreur trace le CODE seul, jamais le pseudonyme ni le corps refuse
// (PRP 06, chantier C : les journaux n'ecrivent jamais un pseudonyme, un
// prenom ni un code).
func repondreErreur(w http.ResponseWriter, code string) {
	statut, connu := statuts[code]
	if !connu {
		statut = http.StatusInternalServerError
	}
	log.Printf("fiche refusee : %s", code)
	repondreJSON(w, statut, enveloppeErreur{Erreur: code, Message: messages[code]})
}

func repondreTropDEssais(w http.ResponseWriter, attendre time.Duration) {
	log.Printf("fiche refusee : trop-d-essais")
	ms := attendre.Milliseconds()
	if ms < 0 {
		ms = 0
	}
	repondreJSON(w, http.StatusTooManyRequests, enveloppeErreur{
		Erreur:     "trop-d-essais",
		Message:    messages["trop-d-essais"],
		AttendreMs: ms,
	})
}

// repondreErreurMagasin traduit une erreur du magasin. Une erreur sentinelle
// connue (pseudo-invalide, code-refuse, ...) traduit son propre statut ; le
// reste — disque plein, volume repasse en lecture seule — reste dans les
// journaux du conteneur et rend magasin-indisponible au client, la seule
// verite qu'il peut agir dessus.
func repondreErreurMagasin(w http.ResponseWriter, err error) {
	var tempo *erreurTemporisation
	if errors.As(err, &tempo) {
		repondreTropDEssais(w, tempo.attendre)
		return
	}
	code := err.Error()
	if _, connu := statuts[code]; !connu {
		log.Printf("magasin : erreur inattendue : %v", err)
		code = "magasin-indisponible"
	}
	repondreErreur(w, code)
}

// handleFiche est la route unique. m == nil est un ETAT VALIDE : le magasin
// est indisponible (volume illisible ou inscriptible), pas en panne — l'app
// sert alors le lot 1 seul, reseau coupe comprend deja tout, et /healthz
// n'en depend jamais.
func handleFiche(m *Magasin) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			repondreErreur(w, "magasin-indisponible")
			return
		}

		req, err := decoderRequete(w, r)
		if err != nil {
			var tropGros *http.MaxBytesError
			if errors.As(err, &tropGros) {
				repondreErreur(w, "corps-trop-volumineux")
			} else {
				repondreErreur(w, "json-invalide")
			}
			return
		}

		switch req.Operation {
		case "creer":
			f, err := m.creer(req.Pseudo, req.Code, req.Prenom, req.SemaineDepart)
			if err != nil {
				repondreErreurMagasin(w, err)
				return
			}
			log.Print("fiche : creation acceptee")
			repondreJSON(w, http.StatusCreated, versReponse(f))

		case "synchroniser":
			f, err := m.synchroniserFiche(requeteSynchro{
				Pseudo: req.Pseudo, Code: req.Code, Faits: req.Faits, Badges: req.Badges,
				Prenom: req.Prenom, SemaineDepart: req.SemaineDepart,
				Parures: req.Parures, Records: req.Records, Couleur: req.Couleur,
			})
			if err != nil {
				repondreErreurMagasin(w, err)
				return
			}
			log.Print("fiche : synchronisation acceptee")
			repondreJSON(w, http.StatusOK, versReponse(f))

		case "effacer":
			if err := m.effacer(req.Pseudo, req.Code); err != nil {
				repondreErreurMagasin(w, err)
				return
			}
			log.Print("fiche : effacement accepte")
			repondreJSON(w, http.StatusNoContent, nil)

		default:
			repondreErreur(w, "operation-invalide")
		}
	}
}

// decoderRequete lit le corps et refuse tout ce qui n'est pas exactement les
// champs attendus, comme marcq-handball : un champ portant « email » ou
// « telephone » est refuse EN BLOC, jamais decode ni trace.
func decoderRequete(w http.ResponseWriter, r *http.Request) (requeteFiche, error) {
	var req requeteFiche

	corps := http.MaxBytesReader(w, r.Body, maxCorps)
	decodeur := json.NewDecoder(corps)
	decodeur.DisallowUnknownFields()

	if err := decodeur.Decode(&req); err != nil {
		// L'erreur de depassement de taille est retournee TELLE QUELLE — pas
		// enveloppee — pour que l'appelant la distingue par errors.As et
		// reponde corps-trop-volumineux plutot que json-invalide.
		return req, err
	}
	var reste any
	if err := decodeur.Decode(&reste); err != io.EOF {
		return req, errors.New("le corps porte plus d'un objet JSON")
	}
	return req, nil
}
