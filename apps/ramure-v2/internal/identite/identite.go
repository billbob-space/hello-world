// apps/ramure-v2/internal/identite/identite.go
//
// L'app est en palier google (exposure: google) : n'importe quel compte
// Google authentifie entre. Traefik authentifie AVANT que la requete
// n'atteigne le conteneur, et pose l'identite verifiee dans l'en-tete
// X-Forwarded-User. C'est la SEULE source d'identite de toute
// l'application (PRP 07, "ce que la suite attend de vous" n°1) : si une
// seconde lecture d'identite apparait ailleurs dans le code, le
// cloisonnement entre utilisateurs n'a plus de gardien unique.
package identite

import (
	"errors"
	"net/http"
)

// ErrSansIdentite signale l'absence de X-Forwarded-User. Les gestionnaires
// HTTP qui exigent une identite renvoient son message en 401.
var ErrSansIdentite = errors.New("X-Forwarded-User absent")

// DepuisRequete lit l'identite de l'en-tete X-Forwarded-User, et de RIEN
// D'AUTRE : ni parametre d'URL (?utilisateur=...), ni corps de requete, ni
// cookie applicatif — n'importe lequel de ces trois canaux serait
// modifiable par le client, et rendrait le cloisonnement contournable en
// changeant une simple valeur. Rend ("", false) si l'en-tete est absent ou
// vide.
func DepuisRequete(r *http.Request) (string, bool) {
	v := r.Header.Get("X-Forwarded-User")
	if v == "" {
		return "", false
	}
	return v, true
}
