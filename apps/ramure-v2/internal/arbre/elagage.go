// apps/ramure-v2/internal/arbre/elagage.go
// Elagage de l'entourage (F-16) : une branche sans aucun materiau
// exploitable ne merite pas sa place, sauf si la retirer ferait descendre
// l'arbre sous un minimum de branches affichees — un arbre a une seule
// branche ne veut plus rien dire.
package arbre

import "github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"

// Elaguer retire les branches sans illustration ET sans lien d'ecoute
// (F-16), sauf si le nombre de branches exploitables restantes
// descendrait sous minimum : dans ce cas rien n'est elague, et TOUTES les
// branches d'origine sont conservees.
func Elaguer(branches []Branche, minimum int) []Branche {
	exploitables := make([]Branche, 0, len(branches))
	for _, b := range branches {
		if brancheExploitable(b) {
			exploitables = append(exploitables, b)
		}
	}
	if len(exploitables) < minimum {
		return branches
	}
	return exploitables
}

func brancheExploitable(b Branche) bool {
	return !illustrationVide(b.Illustration) || b.LienDeezer != ""
}

func illustrationVide(i source.Illustration) bool {
	return i.Petite == "" && i.Moyenne == "" && i.Grande == ""
}
