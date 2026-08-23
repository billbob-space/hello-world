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
//
// Critique 2026-08-23 N4 : la premiere version detectait un "accent avale"
// par heuristique generique (une liste de formes ASCII interdites, plus
// une regle qui accusait tout "a" seul de manquer son accent grave). Verifie
// en execution, cette regle sur "a" seul est FAUSSE dans les deux sens : elle
// accusait a tort "Cet artiste a disparu de la source." (le "a" du verbe
// avoir, 3e personne du singulier, s'ecrit SANS accent -- seule la
// preposition "à" en porte un, et rien ne les distingue de facon fiable par
// regex courte) ; et elle laissait passer "repondu", "resultat", "acces",
// "cree" -- des accents REELLEMENT avales qu'aucun mot de la liste ne
// couvrait, faute d'y avoir pense. Cent soixante-dix-huit lignes d'AST et
// d'heuristique pour cinq litteraux d'un seul fichier, avec des faux
// positifs ET des faux negatifs : un garde-fou qui crie a tort sur du code
// correct finit ignore -- c'est deja arrive dans ce depot (six faux
// "introuvable" qui cachaient un vrai, meme categorie de defaut).
//
// La correction ne tente pas une meilleure heuristique : le francais ne se
// verifie pas par regex generique. Elle COMPARE les litteraux extraits a une
// table figee de messages deja relus (messagesAttendus, ci-dessous) --
// litteralement, sans marge d'erreur possible dans un sens ou l'autre. Un
// message qui n'y figure pas EXACTEMENT (neuf, ou existant mais modifie,
// meme d'un seul accent) fait echouer le test : il n'a jamais ete relu, la
// regle force une revue humaine plutot que de deviner. Le vouvoiement, lui,
// RESTE detecte par regle : "vous" et les terminaisons -ez sont un signal
// systematique en francais, fiable quel que soit le message, y compris un
// message futur qu'aucune table n'a encore vu.
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

// messagesAttendus : la liste EXACTE, mot pour mot, des messages que
// Composer peut rendre aujourd'hui (centre.go), relus a la main pour leur
// accentuation et leur tutoiement. Toute modification de centre.go --
// correction, faute de frappe ou message neuf -- doit se refleter ICI apres
// relecture, jamais avant : c'est ce qui rend la comparaison litterale plus
// sure qu'une heuristique.
var messagesAttendus = map[string]bool{
	`Aucun artiste ne correspond à %q.`:                                               true,
	`L'identité de l'artiste n'a pas pu être vérifiée. Réessaie dans un instant.`:     true,
	`La discographie n'a pas pu être chargée. Réessaie dans un instant.`:              true,
	`Aucun voisin connu pour cet artiste.`:                                            true,
	`Les voisins de cet artiste n'ont pas pu être chargés. Réessaie dans un instant.`: true,
}

// vouvoiement : "vous", ou un verbe conjugue a la 2e personne du pluriel
// (terminaison -ez) -- une regle systematique en francais, donc valable
// pour un message qu'aucune table d'aujourd'hui ne connait encore. "chez",
// "assez" et "nez" ne sont pas des verbes : ils sont exclus.
var vouvoiement = regexp.MustCompile(`(?i)\bvous\b|\b[a-zàâäéèêëïîôöùûüç]{3,}ez\b`)

var exceptionsVouvoiement = map[string]bool{"chez": true, "assez": true, "nez": true}

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
// demain -- doit rester CONNU (compare litteralement a messagesAttendus,
// donc deja relu pour son accentuation) et tutoyer, comme le reste de
// l'application (web/src/textes.ts).
func TestMessagesRendusAccentuesEtTutoient(t *testing.T) {
	for _, msg := range messagesRendus(t) {
		if !messagesAttendus[msg] {
			t.Errorf("message %q : absent de messagesAttendus -- message neuf ou modifie (meme d'un accent), a relire puis ajouter a la table", msg)
		}
		if mot := trouveVouvoiement(msg); mot != "" {
			t.Errorf("message %q : %q vouvoie (l'app tutoie partout ailleurs, voir web/src/textes.ts)", msg, mot)
		}
	}
}

// TestReglesOrthographeEtTonDetectentLesCasConnus verifie les detecteurs
// eux-memes contre des cas positifs ET negatifs connus : sans ce test, un
// futur refactor de messagesAttendus ou de la regle de vouvoiement pourrait
// les rendre muets sans que rien ne le signale.
func TestReglesOrthographeEtTonDetectentLesCasConnus(t *testing.T) {
	t.Run("comparaison litterale", func(t *testing.T) {
		cas := []struct {
			nom   string
			msg   string
			connu bool
		}{
			{"message exact de la table", `Aucun voisin connu pour cet artiste.`, true},
			{"meme message, un accent avale -- devient un message DIFFERENT, donc inconnu", `Aucun voisin connu pour cet artiste`, false},
			{"message jamais vu", `Cet artiste a disparu de la source.`, false},
		}
		for _, c := range cas {
			if got := messagesAttendus[c.msg]; got != c.connu {
				t.Errorf("%s : connu = %v, attendu %v (msg %q)", c.nom, got, c.connu, c.msg)
			}
		}
	})

	t.Run("vouvoiement", func(t *testing.T) {
		cas := []struct {
			nom     string
			msg     string
			vouvoie bool
		}{
			{"vouvoiement explicite, terminaison -ez", "L'identite n'a pas pu etre verifiee, reessayez dans un instant.", true},
			{"vouvoiement par le seul mot \"vous\"", "Vous devriez recommencer.", true},
			{"tutoiement correct", "Réessaie dans un instant.", false},
			{"exceptions -ez seules -- ne vouvoient pas sans \"vous\" ni verbe conjugue", "Il habite assez pres du nez, juste a cote de chez lui.", false},
			{"aucune marque de 2e personne du pluriel", "Aucun voisin connu pour cet artiste.", false},
		}
		for _, c := range cas {
			if got := trouveVouvoiement(c.msg) != ""; got != c.vouvoie {
				t.Errorf("%s : vouvoiement detecte = %v, attendu %v (msg %q)", c.nom, got, c.vouvoie, c.msg)
			}
		}
	})
}
