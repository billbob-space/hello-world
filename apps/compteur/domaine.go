// Regles pures de compteur — aucune E/S. R1 : l'auteur vient de
// X-Forwarded-User et de nulle part ailleurs, non negociable en exposure:
// google puisque n'importe qui entre.
package main

import "net/http"

func Auteur(r *http.Request) string {
	if v := r.Header.Get("X-Forwarded-User"); v != "" {
		return v
	}
	return "anonyme@local"
}
