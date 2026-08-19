// apps/ramure-v2/internal/api/reglages.go
// GET/PUT /api/reglages : le reglage qui suit son proprietaire d'un
// appareil a l'autre (F-25). Cloisonne par X-Forwarded-User, comme la
// collection.
package api

import (
	"encoding/json"
	"net/http"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/collection"
)

// Reglages est cable une seule fois par main(), au meme titre que
// Collection.
var Reglages collection.ReglagesStore

type reglagesJSON struct {
	Service string `json:"service"`
}

func reglagesLireHandler(w http.ResponseWriter, r *http.Request) {
	utilisateur, ok := exigerIdentite(w, r)
	if !ok {
		return
	}
	if Reglages == nil {
		ecrireJSON(w, http.StatusOK, reglagesJSON{Service: collection.ServiceParDefaut})
		return
	}
	reglages, err := Reglages.Lire(r.Context(), utilisateur)
	if err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "reglages illisibles")
		return
	}
	ecrireJSON(w, http.StatusOK, reglagesJSON{Service: reglages.ServiceEcoute})
}

func reglagesEcrireHandler(w http.ResponseWriter, r *http.Request) {
	utilisateur, ok := exigerIdentite(w, r)
	if !ok {
		return
	}
	var corps reglagesJSON
	if err := json.NewDecoder(r.Body).Decode(&corps); err != nil || corps.Service == "" {
		ecrireErreur(w, http.StatusBadRequest, "le champ service est requis")
		return
	}
	if Reglages == nil {
		ecrireErreur(w, http.StatusServiceUnavailable, "reglages indisponibles")
		return
	}
	if err := Reglages.Ecrire(r.Context(), utilisateur, collection.Reglages{ServiceEcoute: corps.Service}); err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "ecriture impossible")
		return
	}
	// Relit ce qui a ete effectivement enregistre : un service inconnu
	// retombe silencieusement sur le defaut (collection.ReglagesStore),
	// et la reponse doit refleter ce qui sera relu au prochain demarrage,
	// jamais ce que le client a envoye a l'aveugle.
	relu, err := Reglages.Lire(r.Context(), utilisateur)
	if err != nil {
		ecrireErreur(w, http.StatusInternalServerError, "reglages illisibles")
		return
	}
	ecrireJSON(w, http.StatusOK, reglagesJSON{Service: relu.ServiceEcoute})
}
