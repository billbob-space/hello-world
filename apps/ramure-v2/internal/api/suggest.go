// apps/ramure-v2/internal/api/suggest.go
// GET /api/suggest?q=<saisie> : suggestions au fil de la frappe (F-01,
// F-02) et rattrapage orthographique (F-03). Au plus 8 candidats.
//
// La regle §09 est appliquee ICI, cote serveur, la ou personne ne la
// relit : aucune correction n'est jamais appliquee en silence. Le champ
// "correction" ne fait QUE signaler, pour le premier candidat, que ce
// n'est pas un echo exact de la saisie mais une proposition plausible
// (source.CorrectionPlausible, PRP 02) — jamais une substitution. C'est
// au client d'afficher "tu voulais dire … ?" et a l'utilisateur de
// valider.
package api

import (
	"net/http"
	"strings"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type suggestionJSON struct {
	Nom        string `json:"nom"`
	MBID       string `json:"mbid"`
	Correction bool   `json:"correction,omitempty"`
}

// suggestHandler construit le gestionnaire de GET /api/suggest. d est
// capturee par fermeture, comme centreHandler.
func suggestHandler(d arbre.Dependances) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" {
			// Une saisie vide n'est pas une erreur de requete (l'utilisateur
			// vient d'effacer le champ) : elle rend simplement une liste vide,
			// sans jamais atteindre le reseau.
			ecrireJSON(w, http.StatusOK, []suggestionJSON{})
			return
		}

		candidats, err := d.Catalogue.Suggerer(r.Context(), q, budget.Centre)
		if err != nil {
			if r.Context().Err() != nil {
				return // reponse tardive (§09) : plus personne n'attend
			}
			// Une source indisponible ne doit pas casser la frappe : liste
			// vide plutot qu'une erreur HTTP, la recherche reste utilisable.
			ecrireJSON(w, http.StatusOK, []suggestionJSON{})
			return
		}

		reponse := make([]suggestionJSON, 0, len(candidats))
		for i, c := range candidats {
			s := suggestionJSON{Nom: c.Nom, MBID: c.MBID}
			if i == 0 && source.Normaliser(c.Nom) != source.Normaliser(q) && source.CorrectionPlausible(q, c.Nom) {
				s.Correction = true
			}
			reponse = append(reponse, s)
		}
		ecrireJSON(w, http.StatusOK, reponse)
	}
}
