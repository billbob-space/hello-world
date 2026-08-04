// Regles pures d'ardoise — aucune E/S, aucun appel reseau. Verifiees par
// domaine_test.go sans base ni cache : elles sont les seules a n'exiger aucune
// infrastructure pour s'executer.
package main

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"
)

// longueurMax est la regle R2 du PRD : une ligne plus longue est refusee,
// jamais tronquee — tronquer deforme le propos sans le dire.
const longueurMax = 140

// ValiderTexte applique R1 et R2. Elle renvoie le texte nettoye des espaces de
// bord, jamais le texte brut : un texte fait uniquement d'espaces doit etre
// refuse comme vide (R1), pas accepte comme non-vide.
func ValiderTexte(brut string) (string, error) {
	t := strings.TrimSpace(brut)
	if t == "" {
		return "", errors.New("la ligne est vide")
	}
	if n := utf8.RuneCountInString(t); n > longueurMax {
		return "", errors.New("la ligne depasse 140 caracteres")
	}
	return t, nil
}

// Auteur applique R3 : X-Forwarded-User, pose par Traefik apres
// authentification et reecrit a chaque requete, est la SEULE source
// d'identite admissible — jamais un champ envoye par le client. Hors Traefik
// (developpement local), la valeur est absente : anonyme@local se voit,
// une chaine vide ressemblerait a un bogue.
func Auteur(r *http.Request) string {
	if v := r.Header.Get("X-Forwarded-User"); v != "" {
		return v
	}
	return "anonyme@local"
}
