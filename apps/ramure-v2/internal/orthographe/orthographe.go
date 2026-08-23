// apps/ramure-v2/internal/orthographe/orthographe.go
//
// Détecteurs communs aux garde-fous d'orthographe et de ton de ce dépôt --
// internal/api/messages_orthographe_test.go et
// internal/arbre/messages_orthographe_test.go, qui les important tous les
// deux. Ce paquet porte ce qui est IDENTIQUE dans les deux garde-fous : la
// détection du vouvoiement, et l'extraction des fragments de message
// STATIQUES d'un appel Go analysé par AST -- jamais un argument dynamique
// (un nom saisi par le visiteur, une erreur enveloppée), jamais contrôlé
// par un dépôt de messages relus.
//
// Ce que chaque garde-fou GARDE en propre, volontairement hors de ce
// paquet : sa table de messages déjà relus (messagesAttendus) et le nom de
// la ou des fonctions dont il analyse les appels (centreVide/centrePanne/
// centreVideAvec d'un côté, ecrireErreur de l'autre) -- ce n'est identique
// dans aucun des deux garde-fous, donc ça ne se mutualise pas.
//
// Seuls des fichiers `_test.go` importent ce paquet (voir les deux fichiers
// cités ci-dessus) : aucun code de production ne le fait, donc `go build .`
// (le Dockerfile, ligne du go build final) ne le lie jamais dans le binaire
// livré -- Go ne compile que ce qui est transitivement importé depuis
// main.go, et main.go ne connaît pas ce paquet. Confirmé par
// `go list -deps .` depuis la racine du module : internal/orthographe n'y
// figure pas.
package orthographe

import (
	"go/ast"
	"go/token"
	"regexp"
	"strconv"
	"strings"
)

// Vouvoiement : "vous", ou un verbe conjugué à la 2e personne du pluriel
// (terminaison -ez) -- une règle systématique en français, donc valable
// pour un message qu'aucune table d'aujourd'hui ne connaît encore. "chez",
// "assez" et "nez" ne sont pas des verbes : ils sont exclus via
// ExceptionsVouvoiement.
var Vouvoiement = regexp.MustCompile(`(?i)\bvous\b|\b[a-zàâäéèêëïîôöùûüç]{3,}ez\b`)

// ExceptionsVouvoiement : les mots qui correspondent à Vouvoiement sans
// être des verbes conjugués à la 2e personne du pluriel.
var ExceptionsVouvoiement = map[string]bool{"chez": true, "assez": true, "nez": true}

// TrouveVouvoiement rend le premier mot qui vouvoie dans msg, ou "" si rien
// ne ressort.
func TrouveVouvoiement(msg string) string {
	for _, mot := range Vouvoiement.FindAllString(msg, -1) {
		if ExceptionsVouvoiement[strings.ToLower(mot)] {
			continue
		}
		return mot
	}
	return ""
}

// LitteralMessage rend la ou les parties STATIQUES d'un argument message :
// un littéral de chaîne tel quel, le format d'un fmt.Sprintf (son premier
// argument), ou les deux côtés d'une concaténation "+" -- jamais un appel
// dynamique (identite.ErrSansIdentite.Error(), par exemple) ni un
// identifiant seul, dont le contenu ne se lit pas par analyse statique et
// n'a donc rien à comparer à une table de messages relus.
func LitteralMessage(expr ast.Expr) []string {
	switch e := expr.(type) {
	case *ast.BasicLit:
		if e.Kind == token.STRING {
			if v, err := strconv.Unquote(e.Value); err == nil {
				return []string{v}
			}
		}
	case *ast.CallExpr:
		if sel, ok := e.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Sprintf" && len(e.Args) > 0 {
			return LitteralMessage(e.Args[0])
		}
	case *ast.BinaryExpr:
		if e.Op == token.ADD {
			var fragments []string
			fragments = append(fragments, LitteralMessage(e.X)...)
			fragments = append(fragments, LitteralMessage(e.Y)...)
			return fragments
		}
	}
	return nil
}

// ExtraireAppels parcourt fichier et rend, pour chaque appel à une fonction
// nommée dans constructeurs (valeur = index de l'argument message), les
// fragments STATIQUES de cet argument -- extraits par LitteralMessage.
//
// C'est la partie de l'analyse identique entre les deux garde-fous : seul
// le contenu de constructeurs (les noms de fonctions à surveiller, et
// l'index de leur paramètre message) leur est propre.
func ExtraireAppels(fichier *ast.File, constructeurs map[string]int) []string {
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
		messages = append(messages, LitteralMessage(appel.Args[idx])...)
		return true
	})
	return messages
}
