// apps/ramure-v2/internal/api/ecouter.go
// GET /api/ecouter?artiste=<nom>&album=<optionnel>&service=<service>&urlDeezer=<optionnel>
//
// Seul point d'entree HTTP qui appelle Odesli.LienEcoute (PRP 03 tache 6).
// Strictement au clic (F-25, F-26 ; N-03 : la limite de debit d'Odesli
// n'est pas documentee publiquement) — ni /api/centre (internal/arbre)
// ni /api/fiche (fiche.go) n'y touchent : c'est l'invariant "0 appel Odesli
// au chargement", garde ici par construction (Composer ne lit jamais
// Dependances.Odesli) et teste par TestOuvrirLaFicheNeCouteAucunAppelOdesli
// (fiche_test.go).
//
// urlDeezer est fourni par le CLIENT, deja connu de /api/centre
// (Branche.LienDeezer) ou de /api/fiche (ficheJSON.LienDeezer) : cette
// route ne refait donc AUCUN appel Deezer, uniquement l'appel Odesli
// lui-meme. Absent — cas des albums de la discographie, qui n'ont pas de
// lien Deezer connu — LienEcoute renvoie immediatement le repli, sans
// requete reseau (cf. internal/source/odesli.go).
package api

import (
	"net/http"
	"strings"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type lienEcouteJSON struct {
	Lien string `json:"lien"`
}

// ecouterHandler construit le gestionnaire de GET /api/ecouter. d est
// capturee par fermeture, comme les autres routes de ce paquet.
func ecouterHandler(d arbre.Dependances) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artiste := strings.TrimSpace(r.URL.Query().Get("artiste"))
		if artiste == "" {
			ecrireErreur(w, http.StatusBadRequest, "le parametre artiste est requis")
			return
		}
		album := strings.TrimSpace(r.URL.Query().Get("album"))
		service := servicePour(r.URL.Query().Get("service"))
		urlDeezer := strings.TrimSpace(r.URL.Query().Get("urlDeezer"))

		var lien string
		if d.Odesli != nil {
			lien = d.Odesli.LienEcoute(r.Context(), service, artiste, album, urlDeezer)
		} else {
			// Odesli non cable (dependances minimales, par ex. les tests des
			// autres routes) : repli seul, jamais une chaine vide (F-26).
			lien = source.RecherchePreRemplie(service, strings.TrimSpace(artiste+" "+album))
		}
		ecrireJSON(w, http.StatusOK, lienEcouteJSON{Lien: lien})
	}
}
