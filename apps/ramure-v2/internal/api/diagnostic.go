// apps/ramure-v2/internal/api/diagnostic.go
// GET /api/diagnostic : le journal de LA SEULE session de l'appelant
// (N-10), pour qu'il puisse l'attacher a un signalement — indispensable
// aux anomalies mobiles qu'on ne reproduit pas. Ni l'identite (elle n'est
// jamais lue ici : la route n'exige pas X-Forwarded-User, un visiteur non
// authentifie derriere un maillon d'infrastructure defaillant doit quand
// meme pouvoir exporter SA session), ni les evenements d'un autre
// visiteur : c'est une vue de l'agregat de mesure.Agregat, pas un second
// journal.
package api

import (
	"net/http"
)

func diagnosticHandler(w http.ResponseWriter, r *http.Request) {
	session := sessionDe(r)
	if session == "" {
		ecrireErreur(w, http.StatusBadRequest, "en-tete "+EnTeteSession+" requis")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if Mesure == nil {
		_, _ = w.Write([]byte("[]"))
		return
	}
	_, _ = w.Write(Mesure.JournalDeSession(session)) // #nosec G705 -- reponse Content-Type application/json produite par encoding/json.Marshal dans JournalDeSession, jamais du HTML ; session ne sert que de cle de lookup dans l'agregat, sa valeur n'est jamais reinjectee brute dans le corps
}
