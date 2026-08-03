// La correspondance des noms d'artistes.
//
// C'est le fichier le plus important du produit pour la confiance, et le moins
// spectaculaire. La §09 du PRD en fait une regle d'integrite qui prime sur le
// taux de couverture :
//
//	"Si aucun resultat ne correspond exactement au nom demande, renvoyer un
//	 resultat vide plutot que le premier candidat approchant."
//
// La raison est dans le risque "homonymes" de la §14 : un mauvais appariement
// ne produit aucun message d'erreur. L'utilisateur voit s'afficher la
// discographie d'un artiste qu'il n'a pas demande, puis explore un sous-arbre
// entier construit sur ce faux depart. Il n'a aucun moyen de s'en apercevoir.
// Un resultat vide, lui, se voit tout de suite et se corrige.
package main

import (
	"strings"
	"unicode"
)

// normalise ramene un nom a une forme comparable : minuscules, sans accents,
// sans ponctuation, espaces reduits.
//
// C'est deliberement tolerant sur la *forme* et strict sur le *contenu* :
// "Sigur Ros" doit apparier "Sigur Rós", et "the beatles" doit apparier
// "The Beatles", mais "Nirvana" ne doit jamais apparier "Nirvana UK".
func normalise(s string) string {
	var b strings.Builder
	b.Grow(len(s))

	espaceEnAttente := false
	for _, r := range strings.ToLower(s) {
		r = sansAccent(r)
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			if espaceEnAttente && b.Len() > 0 {
				b.WriteRune(' ')
			}
			espaceEnAttente = false
			b.WriteRune(r)
		default:
			// Toute ponctuation et tout espace deviennent une seule coupure.
			// "AC/DC" et "AC DC" se rejoignent donc, ce qui est voulu :
			// les catalogues ne s'accordent pas sur la barre oblique.
			espaceEnAttente = true
		}
	}
	return b.String()
}

// sansAccent replie les lettres latines accentuees sur leur lettre de base.
//
// Une table explicite plutot que golang.org/x/text/unicode/norm : cette app
// n'a aucune dependance externe, ce qui lui evite un go.sum, un
// telechargement de modules a la construction, et une surface de mise a jour.
// La table couvre le latin-1 et les rares lettres au-dela qui apparaissent
// vraiment dans des noms d'artistes.
func sansAccent(r rune) rune {
	const accentues = "àáâãäåòóôõöøèéêëçðìíîïùúûüñšýÿžæœß"
	const bases = "aaaaaaooooooeeeecdiiiiuuuunsyyzaos"

	if i := strings.IndexRune(accentues, r); i >= 0 {
		// IndexRune rend un decalage en octets ; la table de base est en ASCII
		// pur, donc son index est le rang de la rune, pas l'octet.
		rang := len([]rune(accentues[:i]))
		return rune(bases[rang])
	}
	return r
}

// memeNom dit si deux noms designent le meme artiste apres normalisation.
// C'est la seule comparaison admise pour valider une resolution (§09).
func memeNom(a, b string) bool {
	return normalise(a) == normalise(b) && normalise(a) != ""
}

// distance est la distance d'edition de Levenshtein entre deux chaines deja
// normalisees. Elle ne sert qu'au rattrapage orthographique (F-03).
func distance(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	if len(ra) == 0 {
		return len(rb)
	}
	if len(rb) == 0 {
		return len(ra)
	}

	// Une seule ligne de la matrice suffit : on n'a jamais besoin de relire
	// plus loin que la ligne precedente.
	ligne := make([]int, len(rb)+1)
	for j := range ligne {
		ligne[j] = j
	}

	for i := 1; i <= len(ra); i++ {
		precedent := ligne[0]
		ligne[0] = i
		for j := 1; j <= len(rb); j++ {
			garde := ligne[j]
			cout := 1
			if ra[i-1] == rb[j-1] {
				cout = 0
			}
			ligne[j] = min3(ligne[j]+1, ligne[j-1]+1, precedent+cout)
			precedent = garde
		}
	}
	return ligne[len(rb)]
}

func min3(a, b, c int) int {
	if b < a {
		a = b
	}
	if c < a {
		a = c
	}
	return a
}

// ecartTolere borne la correction orthographique.
//
// La §09 l'exige : "une correction de nom doit rester plausible [...] bornee
// en ecart et refusee en cas de doute". Sans borne, "Air" se corrigerait en
// "Hair" et "Nas" en "Nash" — le rattrapage deviendrait exactement le
// mecanisme de substitution d'artiste que la regle de correspondance stricte
// existe pour empecher.
//
// La borne croit avec la longueur, parce qu'une faute de frappe dans un nom
// long reste une faute de frappe, alors qu'un caractere d'ecart sur un nom de
// trois lettres change d'artiste. En dessous de cinq caracteres, aucune
// correction n'est acceptee.
func ecartTolere(nom string) int {
	n := len([]rune(nom))
	switch {
	case n < 5:
		return 0
	case n < 9:
		return 1
	case n < 15:
		return 2
	default:
		return 3
	}
}

// meilleureCorrection choisit, parmi des candidats, celui qui corrige le nom
// saisi sans changer d'artiste. Elle rend "" si aucun candidat n'est assez
// proche, ou si deux candidats sont a egalite — le doute vaut refus.
func meilleureCorrection(saisi string, candidats []string) string {
	cible := normalise(saisi)
	if cible == "" {
		return ""
	}
	borne := ecartTolere(cible)
	if borne == 0 {
		return ""
	}

	meilleur, meilleurEcart, exAequo := "", borne+1, false
	for _, c := range candidats {
		d := distance(cible, normalise(c))
		switch {
		case d < meilleurEcart:
			meilleur, meilleurEcart, exAequo = c, d, false
		case d == meilleurEcart && normalise(c) != normalise(meilleur):
			exAequo = true
		}
	}

	if meilleurEcart > borne || exAequo {
		return ""
	}
	return meilleur
}
