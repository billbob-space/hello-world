// apps/ramure-v2/internal/api/mesure_api.go
// Point d'entree commun entre les routes et l'agregat de mesure (N-09,
// N-10) : la variable cablee par main(), et la lecture du jeton de
// session — un identifiant OPAQUE genere cote client (web/src/session.ts),
// SANS AUCUN RAPPORT avec X-Forwarded-User. Ce n'est ni une identite ni un
// secret : le perdre ne revele rien de personnel, il ne fait que
// regrouper les evenements d'un meme onglet de navigateur.
package api

import (
	"net/http"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

// Mesure est cable une seule fois par main(), au meme titre que
// Collection et Reglages ; peut rester nil dans les tests des autres
// routes, qui ne le sollicitent jamais.
var Mesure *mesure.Agregat

// EnTeteSession est l'en-tete que le client pose sur chaque appel API
// pour rattacher les evenements a sa session (N-09, N-10) — jamais
// l'identite, jamais un cookie de suivi entre sessions.
const EnTeteSession = "X-Ramure-Session"

func sessionDe(r *http.Request) string {
	return r.Header.Get(EnTeteSession)
}
