// apps/ramure-v2/internal/api/messages_orthographe_test.go
//
// Garde-fou d'orthographe et de ton pour les corps JSON que ce paquet
// renvoie via ecrireErreur (erreurs.go) : meme si un corps d'erreur n'est
// PAS lu par le client aujourd'hui (voir le commentaire d'erreurJSON), il
// est lu par quiconque inspecte la reponse au clavier -- un support, un
// test, un futur client qui l'affiche -- et l'app est francophone,
// tutoiement partout (voir web/src/textes.ts).
//
// Meme analyse que internal/arbre/messages_orthographe_test.go (a lire
// d'abord pour la genese des choix ci-dessous, notamment pourquoi une
// heuristique d'accent generique est ECARTEE) : ce test analyse le SOURCE
// des fichiers .go de ce paquet plutot que d'appeler les gestionnaires HTTP
// avec des requetes malformees pour recolter les messages un par un. Il
// attrape ainsi toute chaine FUTURE passee a ecrireErreur dans un fichier
// existant ou un fichier neuf de ce paquet, meme une qu'aucun test HTTP
// n'a encore declenchee.
//
// Elle en differe sur un point : les appels a ecrireErreur de ce paquet
// vivent dans SIX fichiers (centre.go, collection.go, diagnostic.go,
// ecouter.go, fiche.go, reglages.go), pas un seul -- l'analyse porte donc
// sur parser.ParseDir (tout le paquet, fichiers de test exclus), pas sur
// un unique parser.ParseFile. Un appel qui concatene un litteral et une
// constante (diagnostic.go : "en-tete "+EnTeteSession+" requis") produit
// aussi une forme que centre.go n'a pas : litteralMessage se decompose
// donc sur un ast.BinaryExpr "+" en recolant les fragments STATIQUES de
// chaque cote, comme elle recolait deja le premier argument d'un
// fmt.Sprintf -- jamais la valeur dynamique (ici EnTeteSession, une
// constante de code, jamais saisie par un visiteur).
package api

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// messagesAttendus : la liste EXACTE, mot pour mot, des fragments de
// message que ce paquet peut passer a ecrireErreur aujourd'hui, relus a la
// main pour leur accentuation et leur tutoiement. Toute modification d'un
// de ces six fichiers -- correction, faute de frappe ou message neuf --
// doit se refleter ICI apres relecture, jamais avant : c'est ce qui rend
// la comparaison litterale plus sure qu'une heuristique.
//
// "en-tête " et " requis" (diagnostic.go) figurent en DEUX fragments,
// separes par la constante EnTeteSession que litteralMessage ne resout
// jamais : c'est la forme que produit l'analyse d'un ast.BinaryExpr, pas
// une erreur de decoupage.
var messagesAttendus = map[string]bool{
	`le paramètre nom est requis`:     true,
	`erreur inattendue`:               true,
	`collection illisible`:            true,
	`nom et mbid sont requis`:         true,
	`collection indisponible`:         true,
	`écriture impossible`:             true,
	`le paramètre mbid est requis`:    true,
	`en-tête `:                        true,
	` requis`:                         true,
	`le paramètre artiste est requis`: true,
	`réglages illisibles`:             true,
	`le champ service est requis`:     true,
	`réglages indisponibles`:          true,
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

// litteralMessage rend la ou les parties STATIQUES d'un argument message :
// un litteral de chaine tel quel, le format d'un fmt.Sprintf (son premier
// argument), ou les deux cotes d'une concatenation "+" -- jamais un
// appel dynamique (identite.ErrSansIdentite.Error(), par exemple), dont le
// contenu ne se lit pas par analyse statique et n'a donc rien a comparer
// ici.
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
	case *ast.BinaryExpr:
		if e.Op == token.ADD {
			var fragments []string
			fragments = append(fragments, litteralMessage(e.X)...)
			fragments = append(fragments, litteralMessage(e.Y)...)
			return fragments
		}
	}
	return nil
}

// messagesRendus extrait, par analyse statique de tous les fichiers .go de
// ce paquet (fichiers de test exclus), tous les fragments litteraux passes
// en troisieme argument (message) a ecrireErreur.
func messagesRendus(t *testing.T) []string {
	t.Helper()
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, parser.AllErrors)
	if err != nil {
		t.Fatalf("analyse du paquet api : %v", err)
	}

	var messages []string
	for _, pkg := range pkgs {
		for _, fichier := range pkg.Files {
			ast.Inspect(fichier, func(n ast.Node) bool {
				appel, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				ident, ok := appel.Fun.(*ast.Ident)
				if !ok || ident.Name != "ecrireErreur" || len(appel.Args) < 3 {
					return true
				}
				messages = append(messages, litteralMessage(appel.Args[2])...)
				return true
			})
		}
	}
	if len(messages) == 0 {
		t.Fatal("aucun message trouve dans le paquet api : le test a-t-il perdu la trace de ecrireErreur ?")
	}
	return messages
}

// TestMessagesRendusAccentuesEtTutoient est le garde-fou attendu : tout
// corps d'erreur que ce paquet peut renvoyer -- aujourd'hui comme demain --
// doit rester CONNU (compare litteralement a messagesAttendus, donc deja
// relu pour son accentuation) et tutoyer, comme le reste de l'application
// (web/src/textes.ts).
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
// les rendre muets sans que rien ne le signale. (Journal 2026-08-22,
// anomalie 24 : un garde-fou se verifie sur ce qu'il ACCEPTE autant que sur
// ce qu'il refuse.)
func TestReglesOrthographeEtTonDetectentLesCasConnus(t *testing.T) {
	t.Run("comparaison litterale", func(t *testing.T) {
		cas := []struct {
			nom   string
			msg   string
			connu bool
		}{
			{"message exact de la table", `réglages illisibles`, true},
			{"meme message, un accent avale -- devient un message DIFFERENT, donc inconnu", `reglages illisibles`, false},
			{"message jamais vu", `mot de passe incorrect`, false},
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
			{"vouvoiement explicite, terminaison -ez", "veuillez reessayer dans un instant.", true},
			{"vouvoiement par le seul mot \"vous\"", "vous devez fournir un parametre.", true},
			{"tutoiement correct", "le paramètre nom est requis", false},
			{"exceptions -ez seules -- ne vouvoient pas sans \"vous\" ni verbe conjugue", "assez de requetes, reessaie plus tard.", false},
			{"aucune marque de 2e personne du pluriel", "écriture impossible", false},
		}
		for _, c := range cas {
			if got := trouveVouvoiement(c.msg) != ""; got != c.vouvoie {
				t.Errorf("%s : vouvoiement detecte = %v, attendu %v (msg %q)", c.nom, got, c.vouvoie, c.msg)
			}
		}
	})
}
