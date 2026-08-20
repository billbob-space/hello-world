// apps/ramure-v2/internal/source/strict.go
// Correspondance stricte des noms — regle d'integrite du PRD §09.
//
// « Si aucun resultat ne correspond exactement au nom demande, renvoyer un
// resultat vide plutot que le premier candidat approchant. » Cette regle prime
// sur le taux de couverture : mieux vaut un artiste introuvable qu'un artiste
// faux. Un mauvais appariement contamine tout un sous-arbre et detruit la
// confiance sans jamais lever d'erreur — l'utilisateur voit s'afficher la
// discographie d'un artiste qu'il n'a pas demande.
package source

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// Normaliser rend deux ecritures d'un meme nom comparables : casse, accents,
// ponctuation et espaces multiples sont neutralises. Rien d'autre — aucune
// suppression d'article, aucune troncature, aucune approximation. La forme
// produite sert aussi de clef de cache : deux utilisateurs tapant « Sigur Ros »
// et « Sigur Rós » doivent partager la meme entree (N-04).
func Normaliser(s string) string {
	sansAccents, _, err := transform.String(
		transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC), s)
	if err != nil {
		sansAccents = s
	}

	var b strings.Builder
	precedentEspace := true // evite un espace en tete
	for _, r := range strings.ToLower(sansAccents) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			precedentEspace = false
		default:
			if !precedentEspace {
				b.WriteRune(' ')
				precedentEspace = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}

// CorrespondanceStricte rend le premier candidat dont le nom, une fois
// normalise, est identique a la demande normalisee. A defaut : la valeur nulle
// du type et false — jamais le candidat le plus proche, jamais le premier de la
// liste, quel que soit le score renvoye par la source (§09).
//
// L'ordre de la liste est respecte : une source qui classe ses candidats par
// pertinence garde le benefice de son classement entre plusieurs homonymes
// exacts, mais ne peut pas imposer un candidat approchant.
func CorrespondanceStricte[T any](demande string, candidats []T,
	nom func(T) string) (T, bool) {

	var vide T
	cible := Normaliser(demande)
	if cible == "" {
		return vide, false
	}
	for _, c := range candidats {
		if Normaliser(nom(c)) == cible {
			return c, true
		}
	}
	return vide, false
}

// CorrespondancesStrictes rend TOUS les candidats dont le nom normalise est
// identique a la demande, dans l'ordre de la source. C'est la meme regle §09
// que CorrespondanceStricte — un nom approchant n'entre jamais dans le
// resultat —, mais elle laisse a l'appelant le soin de departager les
// homonymes EXACTS quand l'ordre de la source ne suffit pas : la recherche
// d'artiste de Deezer sert des doublons vides avant le vrai artiste, et son
// classement ne peut donc pas etre suivi les yeux fermes (voir
// Deezer.Chercher).
func CorrespondancesStrictes[T any](demande string, candidats []T,
	nom func(T) string) []T {

	cible := Normaliser(demande)
	if cible == "" {
		return nil
	}
	var exacts []T
	for _, c := range candidats {
		if Normaliser(nom(c)) == cible {
			exacts = append(exacts, c)
		}
	}
	return exacts
}

// CorrectionPlausible borne le rattrapage orthographique de F-03. La correction
// n'est acceptee que si elle satisfait les deux bornes a la fois :
//
//   - au plus 2 caracteres d'ecart, quelle que soit la longueur ;
//   - au plus 25 % de la longueur du nom demande.
//
// La premiere borne seule accepterait « air » -> « Hair » ; la seconde seule
// accepterait trois fautes sur un nom long. Sur un nom court, un seul caractere
// d'ecart designe deja un autre artiste : c'est exactement le cas que la
// seconde borne ferme.
func CorrectionPlausible(demande, propose string) bool {
	a, b := Normaliser(demande), Normaliser(propose)
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true // casse, accents ou ponctuation : ce n'est pas une correction
	}
	ecart := levenshtein(a, b)
	if ecart > 2 {
		return false
	}
	return float64(ecart) <= 0.25*float64(len([]rune(a)))
}

// levenshtein rend la distance d'edition entre deux chaines deja normalisees.
// Deux lignes suffisent : seule la ligne precedente sert au calcul de la
// courante.
func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	precedente := make([]int, len(rb)+1)
	courante := make([]int, len(rb)+1)
	for j := range precedente {
		precedente[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		courante[0] = i
		for j := 1; j <= len(rb); j++ {
			cout := 1
			if ra[i-1] == rb[j-1] {
				cout = 0
			}
			courante[j] = min(courante[j-1]+1, precedente[j]+1, precedente[j-1]+cout)
		}
		precedente, courante = courante, precedente
	}
	return precedente[len(rb)]
}
