// apps/ramure-v2/internal/arbre/messages_orthographe_test.go
//
// Garde-fou d'orthographe et de ton pour les messages que Composer rend
// dans Centre.Message : l'app est francophone (PRD §05) et tutoie partout
// ailleurs (voir web/src/textes.ts, "Réessaie dans un instant.") -- un
// message serveur qui vouvoie ou avale ses accents est REELLEMENT lu par
// le visiteur qui se trompe de nom, contrairement a un commentaire.
//
// Ce test analyse le SOURCE de centre.go plutot que d'appeler Composer
// avec des pannes simulees pour recolter les messages un par un : il
// attrape ainsi toute chaine FUTURE passee a centreVide, centrePanne ou
// centreVideAvec, meme une que personne n'a encore declenchee en test.
// C'est la difference entre reparer les deux chaines d'aujourd'hui et
// empecher la prochaine.
package arbre

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// motsSansAccentInterdits : formes ASCII qui ne correspondent a AUCUN mot
// francais correct dans un message d'etat -- leur presence signale un
// accent avale (etre -> être, verifiee -> vérifiée), pas une variante
// orthographique legitime.
var motsSansAccentInterdits = regexp.MustCompile(`(?i)\b(etre|etait|ete|deja|tres|apres|egalement|necessaire|probleme|problemes|derniere|dernieres|premiere|premieres|entiere|entierement|meme|memes|reessaye|reessayer|reessai|verifie|verifiee|verifies|verifiees|identite|chargee|chargees|generee|generees|creee|creees|annee|annees|donnee|donnees|systeme|methode|reponse|reponses|requete|requetes|echec|echecs|echoue|echouee|genere|controle|precedent|precedente|immediat|immediate|utilisee|utilisees)\b`)

// motElideAvoir et ilYA neutralisent les deux formes ou "a" est un VERBE
// (avoir), pas la preposition "à" : l'elision ("n'a", "qu'a", "l'a") et
// "il y a". Sans ce nettoyage, "n'a pas pu être chargée" -- pourtant
// correcte -- se ferait accuser d'avaler l'accent de "à".
var motElideAvoir = regexp.MustCompile(`(?i)\b\w+'a\b`)
var ilYA = regexp.MustCompile(`(?i)\bil y a\b`)
var aSeul = regexp.MustCompile(`\ba\b`)

// vouvoiement : "vous", ou un verbe conjugue a la 2e personne du pluriel
// (terminaison -ez) -- une regle systematique en francais, donc valable
// pour un verbe qu'aucune chaine d'aujourd'hui n'emploie encore. "chez",
// "assez" et "nez" ne sont pas des verbes : ils sont exclus.
var vouvoiement = regexp.MustCompile(`(?i)\bvous\b|\b[a-zàâäéèêëïîôöùûüç]{3,}ez\b`)

var exceptionsVouvoiement = map[string]bool{"chez": true, "assez": true, "nez": true}

// trouveAccentManquant rend le premier indice d'accent avale dans msg, ou
// "" si rien ne ressort.
func trouveAccentManquant(msg string) string {
	if m := motsSansAccentInterdits.FindString(msg); m != "" {
		return m
	}
	nettoye := motElideAvoir.ReplaceAllString(msg, "")
	nettoye = ilYA.ReplaceAllString(nettoye, "")
	if aSeul.MatchString(nettoye) {
		return "a"
	}
	return ""
}

// trouveVouvoiement rend le premier mot qui vouvoie dans msg, ou "" si
// rien ne ressort.
func trouveVouvoiement(msg string) string {
	for _, mot := range vouvoiement.FindAllString(msg, -1) {
		if exceptionsVouvoiement[strings.ToLower(mot)] {
			continue
		}
		return mot
	}
	return ""
}

// litteralMessage rend la partie STATIQUE d'un argument message : un
// litteral de chaine tel quel, ou le format d'un fmt.Sprintf (son premier
// argument) -- jamais les arguments dynamiques qui suivent, un nom
// d'artiste saisi par le visiteur, jamais controle par ce paquet.
func litteralMessage(expr ast.Expr) []string {
	switch e := expr.(type) {
	case *ast.BasicLit:
		if e.Kind == token.STRING {
			if v, err := strconv.Unquote(e.Value); err == nil {
				return []string{v}
			}
		}
	case *ast.CallExpr:
		if sel, ok := e.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Sprintf" && len(e.Args) > 0 {
			return litteralMessage(e.Args[0])
		}
	}
	return nil
}

// messagesRendus extrait, par analyse statique de centre.go, tous les
// litteraux passes aux trois constructeurs de Centre qui portent un
// message affichable : centreVide, centrePanne, centreVideAvec (l'index
// est celui du parametre "message" dans chaque signature).
func messagesRendus(t *testing.T) []string {
	t.Helper()
	fset := token.NewFileSet()
	fichier, err := parser.ParseFile(fset, filepath.Join(".", "centre.go"), nil, parser.AllErrors)
	if err != nil {
		t.Fatalf("analyse de centre.go : %v", err)
	}

	constructeurs := map[string]int{
		"centreVide":     0,
		"centrePanne":    0,
		"centreVideAvec": 3,
	}

	var messages []string
	ast.Inspect(fichier, func(n ast.Node) bool {
		appel, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		ident, ok := appel.Fun.(*ast.Ident)
		if !ok {
			return true
		}
		idx, connu := constructeurs[ident.Name]
		if !connu || idx >= len(appel.Args) {
			return true
		}
		messages = append(messages, litteralMessage(appel.Args[idx])...)
		return true
	})
	if len(messages) == 0 {
		t.Fatal("aucun message trouve dans centre.go : le test a-t-il perdu la trace des constructeurs centreVide/centrePanne/centreVideAvec ?")
	}
	return messages
}

// TestMessagesRendusAccentuesEtTutoient est le garde-fou attendu : tout
// message que Composer peut renvoyer au visiteur -- aujourd'hui comme
// demain -- doit rester accentue et tutoyer, comme le reste de
// l'application (web/src/textes.ts).
func TestMessagesRendusAccentuesEtTutoient(t *testing.T) {
	for _, msg := range messagesRendus(t) {
		if mot := trouveAccentManquant(msg); mot != "" {
			t.Errorf("message %q : %q ressemble a un accent avale (l'app est francophone, PRD §05)", msg, mot)
		}
		if mot := trouveVouvoiement(msg); mot != "" {
			t.Errorf("message %q : %q vouvoie (l'app tutoie partout ailleurs, voir web/src/textes.ts)", msg, mot)
		}
	}
}

// TestReglesOrthographeEtTonDetectentLesCasConnus verifie les detecteurs
// eux-memes contre des cas positifs ET negatifs connus : sans ce test, un
// futur refactor des regex ci-dessus pourrait les rendre muettes sans que
// rien ne le signale.
func TestReglesOrthographeEtTonDetectentLesCasConnus(t *testing.T) {
	cas := []struct {
		nom            string
		msg            string
		accentManquant bool
		vouvoie        bool
	}{
		{"accent avale sur a preposition", "Aucun artiste ne correspond a %q.", true, false},
		{"vouvoiement", "L'identite n'a pas pu etre verifiee, reessayez dans un instant.", true, true},
		{"correct et accentue", "Réessaie dans un instant.", false, false},
		{"n'a pas est correct sans accent", "La discographie n'a pas pu être chargée.", false, false},
		{"il y a est correct sans accent", "Il y a un instant, tout allait bien.", false, false},
		{"phrase correcte sans diacritique necessaire", "Aucun voisin connu pour cet artiste.", false, false},
	}
	for _, c := range cas {
		if got := trouveAccentManquant(c.msg) != ""; got != c.accentManquant {
			t.Errorf("%s : accent manquant detecte = %v, attendu %v (msg %q)", c.nom, got, c.accentManquant, c.msg)
		}
		if got := trouveVouvoiement(c.msg) != ""; got != c.vouvoie {
			t.Errorf("%s : vouvoiement detecte = %v, attendu %v (msg %q)", c.nom, got, c.vouvoie, c.msg)
		}
	}
}
