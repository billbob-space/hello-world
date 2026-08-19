// apps/ramure-v2/internal/arbre/selection.go
// Selection de l'entourage (F-08) et rebattage (F-15). Logique deterministe
// et isolee de l'interface : ni reseau, ni HTTP, avec source d'alea
// injectable pour rendre les tirages reproductibles (§13). Ce fichier et
// web/src/geometrie.ts (PRP 05) portent les deux exigences les plus
// subtiles du produit : ils doivent rester libres de toute dependance au
// reseau et a l'interface.
package arbre

import (
	"math/rand"
	"sort"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// Cadrage fixe le nombre de branches, de voisins stables, d'heritiers par
// branche et la taille minimale du vivier brut, pour une largeur d'ecran
// donnee. Consequence directe de la parite stricte decidee par le
// commanditaire (README de la serie, §17 n°1).
type Cadrage struct {
	Branches  int
	Stables   int
	Heritiers int
	VivierMin int
}

// CadrageLarge et CadrageEtroit sont les deux seules valeurs de cadrage
// retenues par le produit : le serveur les choisit a partir du parametre
// largeur, jamais le client.
var (
	CadrageLarge  = Cadrage{Branches: 10, Stables: 2, Heritiers: 3, VivierMin: 30}
	CadrageEtroit = Cadrage{Branches: 6, Stables: 2, Heritiers: 2, VivierMin: 30}
)

// SelectionnerBranches choisit l'entourage affiche pour une visite : les
// c.Stables voisins de plus forte affinite sont TOUJOURS retenus — les
// « voisins les plus evidents », qui donnent un repere d'une visite a
// l'autre (§02) — et le reste est tire sans remise, pondere par
// l'affinite, dans tout le reste du vivier (F-08). alea est injectable
// pour rendre le tirage reproductible (§13).
func SelectionnerBranches(vivier []source.Voisin, c Cadrage, alea *rand.Rand) []source.Voisin {
	return selectionner(vivier, c, alea)
}

// Rebattre retire un nouvel entourage a partir du meme vivier brut : les
// stables restent identiques d'un rebattage a l'autre, le reste change
// (F-15).
func Rebattre(vivier []source.Voisin, c Cadrage, alea *rand.Rand) []source.Voisin {
	return selectionner(vivier, c, alea)
}

func selectionner(vivier []source.Voisin, c Cadrage, alea *rand.Rand) []source.Voisin {
	trie := trierParAffiniteDecroissante(vivier)

	// Un vivier plus petit que le cadrage se rend tel quel, deja trie : ni
	// panique, ni doublon possible.
	if len(trie) <= c.Branches {
		return trie
	}

	stables := append([]source.Voisin{}, trie[:c.Stables]...)
	reste := append([]source.Voisin{}, trie[c.Stables:]...)

	tires := tirerSansRemise(reste, c.Branches-c.Stables, alea)

	resultat := append(stables, tires...)
	return trierParAffiniteDecroissante(resultat)
}

func trierParAffiniteDecroissante(vivier []source.Voisin) []source.Voisin {
	copie := append([]source.Voisin{}, vivier...)
	sort.SliceStable(copie, func(i, j int) bool { return copie[i].Affinite > copie[j].Affinite })
	return copie
}

// tirerSansRemise choisit n candidats sans remise, ponderes par
// l'affinite, par selection cumulative : somme des affinites restantes,
// tirage uniforme dans cette somme, retrait du candidat choisi.
func tirerSansRemise(candidats []source.Voisin, n int, alea *rand.Rand) []source.Voisin {
	restants := append([]source.Voisin{}, candidats...)
	resultat := make([]source.Voisin, 0, n)
	for i := 0; i < n && len(restants) > 0; i++ {
		idx := tirerUnIndex(restants, alea)
		resultat = append(resultat, restants[idx])
		restants = append(restants[:idx], restants[idx+1:]...)
	}
	return resultat
}

// tirerUnIndex tire un index pondere par l'affinite. Une affinite nulle
// reste tirable — sinon un vivier entierement a zero, que ListenBrainz
// peut produire apres normalisation, ne rendrait aucune branche : dans ce
// cas le tirage devient uniforme.
func tirerUnIndex(candidats []source.Voisin, alea *rand.Rand) int {
	somme := 0.0
	for _, c := range candidats {
		somme += c.Affinite
	}
	if somme <= 0 {
		return alea.Intn(len(candidats))
	}
	cible := alea.Float64() * somme
	cumul := 0.0
	for i, c := range candidats {
		cumul += c.Affinite
		if cible < cumul {
			return i
		}
	}
	// Garde-fou d'arrondi flottant : la somme cumulee peut manquer la cible
	// de tres peu sur le dernier candidat.
	return len(candidats) - 1
}
