// api.go — les trois routes du lot 2, et rien de plus : aucune route
// d'administration, aucune quatrieme route. La suppression d'une fiche qu'exige
// le PRD §14 est un CHAMP du corps du POST, pas un verbe supplementaire : elle
// emprunte ainsi exactement le meme chemin que la mise a jour — meme decodeur,
// meme validation, meme verification du code, meme compteur d'essais — la ou un
// second verbe rouvrirait une deuxieme fois la seule route d'ecriture publique
// du projet, avec deux occasions de rater une validation.
//
// C'est le seul endroit du projet ou un inconnu peut ecrire. Tout ce qu'il peut
// y faire est borne ici.
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
)

// maxCorps borne le corps d'une requete. 8 Kio est large : 53 identifiants font
// environ 600 octets. Un corps d'un gigaoctet est coupe ici et rend 400, jamais
// 500.
const maxCorps = 8 << 10

// --- Les corps de reponse ------------------------------------------------

// ligneClassement est une ligne du tableau « classement », commune a
// /api/classement et /api/coach. Pseudo porte omitempty : au-dela de la
// troisieme ligne, le champ n'est pas emis du tout — le nom ne transite pas.
type ligneClassement struct {
	Rang    int     `json:"rang"`
	Cochees int     `json:"cochees"`
	Part    float64 `json:"part"`
	Pseudo  string  `json:"pseudo,omitempty"`
}

// jauge est la progression collective du PRD §7.5.
type jauge struct {
	Cochees     int     `json:"cochees"`
	Programmees int     `json:"programmees"`
	Part        float64 `json:"part"`
}

// reponseClassement est le corps de la reponse 200 de GET /api/classement.
type reponseClassement struct {
	Jour         string            `json:"jour"`
	Programmees  int               `json:"programmees"`
	Participants int               `json:"participants"`
	Classement   []ligneClassement `json:"classement"`
	Groupe       jauge             `json:"groupe"`
}

// envoiClassement est le corps recu par POST /api/classement, envoi et
// suppression confondus.
//
// Faits est un []string et non un pointeur : json.Decode laisse nil quand le
// champ est absent, et rend une tranche non nulle de longueur 0 pour []. C'est
// ce qui distingue « faits absent » — refuse en 400 faits-invalide hors
// suppression — de « navigateur vide qui renvoie un ensemble vide », legitime.
//
// Reprise distingue le SEUL envoi qui n'est pas une mise a jour : celui d'un
// telephone qui vient de saisir un nom et un code deja connus du serveur. Sans
// ce drapeau, son ensemble vide remplacerait la fiche et effacerait tout ce que
// l'enfant a coche ailleurs. Il est demande par le client, jamais devine ici :
// le serveur ne sait pas distinguer « nouveau telephone » de « telephone qui a
// tout decoche », et deviner reviendrait a choisir la mauvaise moitie du temps.
type envoiClassement struct {
	Pseudo    string            `json:"pseudo"`
	Code      string            `json:"code"`
	Faits     []string          `json:"faits"`
	Ressentis map[string]string `json:"ressentis,omitempty"`
	Supprimer bool              `json:"supprimer,omitempty"`
	Reprise   bool              `json:"reprise,omitempty"`
}

// reponseEnvoi est le corps des reponses 201 (creation) et 200 (mise a jour).
//
// Faits n'est emis QUE sur un envoi de reprise, et c'est ce qui rend le champ
// acceptable : la fiche d'un enfant ne repart vers un navigateur qu'au moment
// ou celui-ci vient de prouver qu'il connait le code qui l'ouvre. Sur tous les
// autres envois, `omitempty` l'efface du corps — un enfant qui coche ne recoit
// jamais la liste de ce qu'il a deja coche, il l'a deja.
type reponseEnvoi struct {
	Pseudo       string            `json:"pseudo"`
	Jour         string            `json:"jour"`
	Rang         int               `json:"rang"`
	Participants int               `json:"participants"`
	Cochees      int               `json:"cochees"`
	Programmees  int               `json:"programmees"`
	Part         float64           `json:"part"`
	Ignores      int               `json:"ignores"`
	Faits        map[string]string `json:"faits,omitempty"`
}

// reponseSuppression est le corps de la reponse 200 d'un POST portant
// supprimer: true. La reponse est 200 dans les deux cas et jamais 204 : il faut
// un corps pour dire lequel des deux s'est produit.
type reponseSuppression struct {
	Pseudo       string `json:"pseudo"`
	Supprime     bool   `json:"supprime"`
	Jour         string `json:"jour"`
	Participants int    `json:"participants"`
}

// assiduite repartit les participants sur leur part. C'est une structure et non
// une carte : une carte omettrait les tranches vides, et le PRP 10 devrait se
// defendre contre quatre valeurs absentes au lieu de lire quatre zeros.
type assiduite struct {
	Aucune  int `json:"aucune"`
	Faible  int `json:"faible"`
	Moyenne int `json:"moyenne"`
	Forte   int `json:"forte"`
}

// agregatRessentis compte les trois valeurs du PRD §6 lot 2 item 10. Meme
// raison qu'assiduite d'etre une structure : les trois cles existent toujours.
type agregatRessentis struct {
	Facile  int `json:"facile"`
	Correct int `json:"correct"`
	Dur     int `json:"dur"`
}

type ligneSeanceCoach struct {
	Date                  string `json:"date"`
	Titre                 string `json:"titre"`
	Exercices             int    `json:"exercices"`
	Cochees               int    `json:"cochees"`
	ParticipantsActifs    int    `json:"participantsActifs"`
	ParticipantsAyantFini int    `json:"participantsAyantFini"`
}

// reponseCoach est le corps de la reponse 200 de GET /api/coach. Le champ
// anonyme aplatit les cinq champs de reponseClassement dans le meme objet
// JSON : c'est ce qui garantit, A LA COMPILATION, que le coach voit exactement
// le tableau des enfants et pas une copie qui derive.
type reponseCoach struct {
	reponseClassement
	Assiduite assiduite          `json:"assiduite"`
	Seances   []ligneSeanceCoach `json:"seances"`
	Ressentis agregatRessentis   `json:"ressentis"`
}

// --- L'enveloppe d'erreur -------------------------------------------------

type enveloppeErreur struct {
	Erreur  string `json:"erreur"`
	Message string `json:"message"`
}

// messages est en francais, destine a etre affiche TEL QUEL par le PRP 08 : une
// API dont le client doit traduire les codes produit deux vocabulaires qui
// divergent. « Ce nom est deja pris » et « ton code est faux » partagent
// volontairement le meme message : les distinguer transformerait la route en
// oracle de disponibilite de pseudonymes.
var messages = map[string]string{
	"json-invalide":           "Envoi illisible.",
	"pseudo-invalide":         "Ce pseudo ne convient pas : de 2 à 16 caractères, lettres, chiffres, espace, tiret ou apostrophe.",
	"code-invalide":           "Le code doit être composé de 4 chiffres.",
	"faits-invalide":          "La liste des exercices faits est illisible.",
	"ressentis-invalide":      "Le ressenti envoyé ne correspond à aucune séance.",
	"code-refuse":             "Ce nom est déjà pris, ou le code ne correspond pas.",
	"trop-d-essais":           "Trop d'essais sur ce nom. Réessaie dans un quart d'heure.",
	"classement-plein":        "Le classement est complet : 200 participants.",
	"classement-fige":         "Le programme est terminé : le classement est figé.",
	"classement-indisponible": "Le classement n'est pas disponible pour le moment.",
}

// statuts attache un statut HTTP a chaque code d'erreur. Le magasin ne connait
// pas HTTP : c'est cette table, et elle seule, qui fait la traduction.
var statuts = map[string]int{
	"json-invalide":           http.StatusBadRequest,
	"pseudo-invalide":         http.StatusBadRequest,
	"code-invalide":           http.StatusBadRequest,
	"faits-invalide":          http.StatusBadRequest,
	"ressentis-invalide":      http.StatusBadRequest,
	"code-refuse":             http.StatusForbidden,
	"trop-d-essais":           http.StatusTooManyRequests,
	"classement-plein":        http.StatusConflict,
	"classement-fige":         http.StatusConflict,
	"classement-indisponible": http.StatusServiceUnavailable,
}

func enteteJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Un classement mis en cache est un classement faux. Aucun en-tete CORS
	// non plus : aucune page tierce ne peut lire ces routes depuis un
	// navigateur.
	w.Header().Set("Cache-Control", "no-store")
}

func repondreJSON(w http.ResponseWriter, statut int, corps any) {
	enteteJSON(w)
	w.WriteHeader(statut)
	if err := json.NewEncoder(w).Encode(corps); err != nil {
		log.Printf("reponse json tronquee : %v", err)
	}
}

func repondreErreur(w http.ResponseWriter, code string) {
	statut, connu := statuts[code]
	if !connu {
		statut = http.StatusInternalServerError
	}
	switch code {
	case "trop-d-essais":
		w.Header().Set("Retry-After", "900")
	case "classement-indisponible":
		w.Header().Set("Retry-After", "60")
	}
	repondreJSON(w, statut, enveloppeErreur{Erreur: code, Message: messages[code]})
}

// indisponible est la reponse des trois routes quand le magasin n'existe pas.
// cl == nil est un ETAT VALIDE : le classement est desactive, pas en panne.
func indisponible(w http.ResponseWriter) {
	repondreErreur(w, "classement-indisponible")
}

// --- Les trois routes -----------------------------------------------------

func handleClassementGet(cl *classement) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		if cl == nil {
			indisponible(w)
			return
		}
		repondreJSON(w, http.StatusOK, cl.lire(cl.jour()))
	}
}

func handleCoach(cl *classement) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		if cl == nil {
			indisponible(w)
			return
		}
		repondreJSON(w, http.StatusOK, cl.coach(cl.jour()))
	}
}

func handleClassementPost(cl *classement) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cl == nil {
			indisponible(w)
			return
		}

		e, err := decoderEnvoi(w, r)
		if err != nil {
			repondreErreur(w, "json-invalide")
			return
		}

		jour := cl.jour()

		if e.Supprimer {
			// faits et ressentis sont acceptes mais IGNORES : la fiche
			// disparait, ce qu'elle contenait n'a plus d'importance, et exiger
			// leur absence ferait echouer un client qui reutilise son gabarit.
			rep, err := cl.supprimer(e, jour)
			if err != nil {
				repondreCodeErreur(w, err)
				return
			}
			repondreJSON(w, http.StatusOK, rep)
			return
		}

		rep, cree, err := cl.enregistrer(e, jour)
		if err != nil {
			repondreCodeErreur(w, err)
			return
		}
		statut := http.StatusOK
		if cree {
			statut = http.StatusCreated
		}
		repondreJSON(w, statut, rep)
	}
}

// repondreCodeErreur traduit une erreur sentinelle du magasin. Une erreur
// inattendue — disque plein, volume passe en lecture seule — rend
// classement-indisponible : c'est la verite du point de vue du client, et le
// detail reste dans les journaux du conteneur.
func repondreCodeErreur(w http.ResponseWriter, err error) {
	code := err.Error()
	if _, connu := statuts[code]; !connu {
		log.Printf("classement : ecriture impossible : %v", err)
		code = "classement-indisponible"
	}
	repondreErreur(w, code)
}

// decoderEnvoi lit le corps d'un POST et refuse tout ce qui n'est pas
// exactement les cinq champs attendus.
func decoderEnvoi(w http.ResponseWriter, r *http.Request) (envoiClassement, error) {
	var e envoiClassement

	corps := http.MaxBytesReader(w, r.Body, maxCorps)
	decodeur := json.NewDecoder(corps)
	// Un corps portant « prenom », « email » ou « telephone » est refuse EN
	// BLOC : la valeur n'est ni decodee, ni stockee, ni tracee. C'est ce qui
	// rend impossible — et pas seulement deconseille — qu'une donnee nominative
	// atteigne ce serveur (PRD §5).
	decodeur.DisallowUnknownFields()

	if err := decodeur.Decode(&e); err != nil {
		var tropGros *http.MaxBytesError
		if errors.As(err, &tropGros) {
			return e, errors.New("corps trop volumineux")
		}
		return e, err
	}
	// Un second objet JSON concatene au premier est refuse.
	var reste any
	if err := decodeur.Decode(&reste); err != io.EOF {
		return e, errors.New("le corps porte plus d'un objet JSON")
	}
	return e, nil
}
