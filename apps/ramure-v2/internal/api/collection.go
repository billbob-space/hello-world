// apps/ramure-v2/internal/api/collection.go
// GET/PUT/DELETE /api/collection : la collection d'artistes gardes
// (F-28, F-29, F-32), cloisonnee par X-Forwarded-User (N-08) et rien
// d'autre — identite.DepuisRequete est la SEULE lecture d'identite,
// jamais un parametre de cette route.
package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/collection"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/identite"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

// Collection est cablee une seule fois par main() (regime FileStore en
// conteneur, MemoryStore en repli de developpement — voir
// collection.ChoisirStore), au meme titre que Dist et AccueilHTML.
var Collection collection.CollectionStore

type ajoutCollectionJSON struct {
	Nom    string   `json:"nom"`
	MBID   string   `json:"mbid"`
	Lignee []string `json:"lignee,omitempty"`
}

func exigerIdentite(w http.ResponseWriter, r *http.Request) (string, bool) {
	utilisateur, ok := identite.DepuisRequete(r)
	if !ok {
		ecrireErreur(w, http.StatusUnauthorized, identite.ErrSansIdentite.Error())
		return "", false
	}
	return utilisateur, true
}

func collectionListerHandler(w http.ResponseWriter, r *http.Request) {
	utilisateur, ok := exigerIdentite(w, r)
	if !ok {
		return
	}
	if Collection == nil {
		ecrireJSON(w, http.StatusOK, []collection.Entree{})
		return
	}
	entrees, err := Collection.Lister(r.Context(), utilisateur)
	if err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "collection illisible")
		return
	}
	if entrees == nil {
		entrees = []collection.Entree{}
	}
	ecrireJSON(w, http.StatusOK, entrees)
}

func collectionAjouterHandler(w http.ResponseWriter, r *http.Request) {
	utilisateur, ok := exigerIdentite(w, r)
	if !ok {
		return
	}
	var corps ajoutCollectionJSON
	if err := json.NewDecoder(r.Body).Decode(&corps); err != nil ||
		strings.TrimSpace(corps.Nom) == "" || strings.TrimSpace(corps.MBID) == "" {
		ecrireErreur(w, http.StatusBadRequest, "nom et mbid sont requis")
		return
	}
	if Collection == nil {
		ecrireErreur(w, http.StatusServiceUnavailable, "collection indisponible")
		return
	}
	e := collection.Entree{
		Nom:    corps.Nom,
		MBID:   corps.MBID,
		Lignee: corps.Lignee,
		Ajoute: time.Now().UTC(), // horodatage pose par le SERVEUR, jamais fourni par le client
	}
	if err := Collection.Ajouter(r.Context(), utilisateur, e); err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "écriture impossible")
		return
	}
	if Mesure != nil {
		Mesure.Compter(mesure.Signet, sessionDe(r))
	}
	ecrireJSON(w, http.StatusOK, e)
}

func collectionRetirerHandler(w http.ResponseWriter, r *http.Request) {
	utilisateur, ok := exigerIdentite(w, r)
	if !ok {
		return
	}
	mbid := strings.TrimSpace(r.URL.Query().Get("mbid"))
	if mbid == "" {
		ecrireErreur(w, http.StatusBadRequest, "le paramètre mbid est requis")
		return
	}
	if Collection == nil {
		ecrireErreur(w, http.StatusServiceUnavailable, "collection indisponible")
		return
	}
	if err := Collection.Retirer(r.Context(), utilisateur, mbid); err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "écriture impossible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
