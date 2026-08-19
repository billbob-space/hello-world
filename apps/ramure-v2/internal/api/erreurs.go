// apps/ramure-v2/internal/api/erreurs.go
// Format uniforme des reponses JSON, succes comme erreur.
package api

import (
	"encoding/json"
	"net/http"
)

// ecrireJSON encode le corps en JSON et pose le Content-Type AVANT
// WriteHeader : une fois le statut envoye, les en-tetes sont figes.
func ecrireJSON(w http.ResponseWriter, statut int, corps any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statut)
	_ = json.NewEncoder(w).Encode(corps)
}

// erreurJSON est le format des erreurs de requete (400, etc.) — distinct
// du contrat de /api/centre, qui porte toujours un etat plutot qu'une
// erreur HTTP, sauf sur une requete malformee.
type erreurJSON struct {
	Erreur string `json:"erreur"`
}

func ecrireErreur(w http.ResponseWriter, statut int, message string) {
	ecrireJSON(w, statut, erreurJSON{Erreur: message})
}
