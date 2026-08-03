// La classification des types de sortie (F-22) et le nettoyage des titres.
//
// La F-22 pose une contrainte forte et facile a rater : "un album releve d'un
// seul type". C'est donc une classification, pas un jeu d'etiquettes — et
// l'ordre dans lequel les regles s'appliquent decide du resultat. Une
// compilation de concerts doit tomber dans un seul bac, toujours le meme,
// sinon le filtre ment sur le nombre de resultats qu'il annonce.
package main

import (
	"strings"
)

// marqueursLive reconnait un enregistrement public dans un titre. La source ne
// distingue pas le live : elle rend "album" aussi bien pour un disque studio
// que pour un enregistrement de concert. Le titre est le seul signal
// disponible, et il est fiable en pratique parce que les editeurs le
// mentionnent — c'est un argument de vente.
var marqueursLive = []string{
	"live at", "live in", "live from", "live aux", "live a ",
	"en concert", "in concert", "concert at",
	// Le catalogue est international, et la mention de concert suit la langue
	// de la sortie. Sans ces variantes, toute la MPB, la salsa et la canzone
	// italienne se retrouvent classees "studio" — un filtre qui ment sur une
	// scene entiere, sans que rien ne le signale.
	"ao vivo", "en vivo", "en directo", "dal vivo", "live aufnahme",
	"unplugged", "mtv unplugged",
	"live)", "live]", "(live", "[live",
	"aux bouffes", "au zenith", "a l'olympia", "olympia",
	"bbc session", "peel session", "sessions live",
}

// marqueursCompilation reconnait un recueil. Attention a "greatest" seul :
// "Greatest Hits" est une compilation, mais un album studio peut s'appeler
// "The Greatest". Les marqueurs sont donc des locutions, pas des mots.
var marqueursCompilation = []string{
	"greatest hits", "best of", "the best of", "very best",
	"anthology", "anthologie", "collection", "compilation",
	"singles collection", "essential", "l'essentiel",
	"retrospective", "hits", "integrale",
}

// classeSortie range une sortie dans exactement un des quatre types de la
// F-22.
//
// L'ordre des tests est le contrat :
//
//  1. Le type declare par la source prime quand il est net (single, ep,
//     compilation) — c'est une donnee, pas une devinette.
//  2. Sinon, "live" l'emporte sur "compilation" : une compilation de concerts
//     est d'abord ecoutee comme un live. Ce choix est arbitraire, mais il doit
//     etre *stable*, sans quoi le meme disque changerait de bac selon le
//     hasard de l'ecriture des regles.
//  3. Le studio est le cas par defaut, jamais un cas detecte. C'est ce qui
//     garantit qu'aucune sortie ne reste sans type.
func classeSortie(typeSource, titre string) string {
	t := normalise(titre)

	switch strings.ToLower(strings.TrimSpace(typeSource)) {
	case "single", "ep":
		return typeCourt
	case "compilation":
		// Meme ici, un live declare compilation par la source reste un live :
		// c'est ce que l'utilisateur entend en l'ecoutant.
		if contientUn(t, marqueursLive) {
			return typeLive
		}
		return typeCompilation
	}

	if contientUn(t, marqueursLive) {
		return typeLive
	}
	if contientUn(t, marqueursCompilation) {
		return typeCompilation
	}
	return typeStudio
}

func contientUn(s string, marqueurs []string) bool {
	for _, m := range marqueurs {
		if strings.Contains(s, normalise(m)) {
			return true
		}
	}
	return false
}

// suffixesReedition sont les mentions qui distinguent deux pressages de la
// meme oeuvre. Les retirer permet de reconnaitre les doublons.
var suffixesReedition = []string{
	"remaster", "remastered", "remasterise", "remasterisé",
	"deluxe", "deluxe edition", "edition deluxe",
	"anniversary", "anniversaire", "expanded", "reissue", "reedition",
	"special edition", "edition speciale", "bonus track", "bonus tracks",
	"version longue", "extended edition",
}

// titreCanonique retire la mention de reedition d'un titre, pour que "Third",
// "Third (Remastered 2023)" et "Third [Deluxe Edition]" se reconnaissent comme
// une seule oeuvre.
//
// Il ne retire QUE les groupes entre parentheses ou crochets : une mention en
// texte libre ferait courir le risque de tronquer un vrai titre. "Kid A Mnesia"
// ne doit pas devenir "Kid A".
func titreCanonique(titre string) string {
	var b strings.Builder
	profondeur := 0
	debutGroupe := 0

	for i, r := range titre {
		switch r {
		case '(', '[':
			if profondeur == 0 {
				debutGroupe = i
			}
			profondeur++
		case ')', ']':
			if profondeur > 0 {
				profondeur--
				if profondeur == 0 {
					// Le groupe qui vient de se fermer n'est retire que s'il
					// annonce une reedition. "Portishead (Live)" garde son
					// groupe : c'est une autre oeuvre, pas un autre pressage.
					groupe := normalise(titre[debutGroupe : i+1])
					if !contientUn(groupe, suffixesReedition) {
						b.WriteString(titre[debutGroupe : i+1])
					}
				}
			}
		default:
			if profondeur == 0 {
				b.WriteRune(r)
			}
		}
	}

	// Une parenthese jamais refermee : on rend le titre tel quel plutot que
	// de le tronquer a l'ouverture.
	if profondeur > 0 {
		return strings.TrimSpace(titre)
	}
	return strings.TrimSpace(b.String())
}
