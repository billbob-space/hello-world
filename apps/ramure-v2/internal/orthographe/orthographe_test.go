// apps/ramure-v2/internal/orthographe/orthographe_test.go
//
// Garde-fou des détecteurs eux-mêmes : TrouveVouvoiement et LitteralMessage
// sont importés par les deux garde-fous d'orthographe du dépôt
// (internal/api et internal/arbre), donc vérifiés UNE SEULE FOIS ici plutôt
// que dans chacun -- un futur refactor de l'un ou l'autre qui les rendrait
// muets se verrait ici, sans devoir être répété deux fois.
//
// Journal 2026-08-22, anomalie 24 : un garde-fou se vérifie sur ce qu'il
// ACCEPTE autant que sur ce qu'il refuse -- chaque table ci-dessous porte
// donc des cas positifs ET négatifs.
package orthographe

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"
)

func parseExpr(t *testing.T, src string) ast.Expr {
	t.Helper()
	expr, err := parser.ParseExpr(src)
	if err != nil {
		t.Fatalf("analyse de %q : %v", src, err)
	}
	return expr
}

func TestTrouveVouvoiementDetecteLesCasConnus(t *testing.T) {
	cas := []struct {
		nom     string
		msg     string
		vouvoie bool
	}{
		{"vouvoiement explicite, terminaison -ez", "Réessayez dans un instant.", true},
		{"vouvoiement par le seul mot \"vous\"", "Vous devriez recommencer.", true},
		{"tutoiement correct", "Réessaie dans un instant.", false},
		{"exceptions -ez seules -- ne vouvoient pas sans \"vous\" ni verbe conjugue", "Il habite assez pres du nez, juste a cote de chez lui.", false},
		{"aucune marque de 2e personne du pluriel", "Aucun voisin connu pour cet artiste.", false},
	}
	for _, c := range cas {
		if got := TrouveVouvoiement(c.msg) != ""; got != c.vouvoie {
			t.Errorf("%s : vouvoiement detecte = %v, attendu %v (msg %q)", c.nom, got, c.vouvoie, c.msg)
		}
	}
}

// TestLitteralMessageExtraitLesFragmentsStatiques couvre les deux
// constructeurs Go que centre.go (internal/arbre) et le paquet internal/api
// utilisent réellement pour composer un message : le littéral simple, le
// premier argument d'un fmt.Sprintf, et la concaténation "+" -- ce dernier
// cas sur ses DEUX côtés (X et Y), pas un seul, et avec un fragment
// dynamique entre les deux comme le fait réellement diagnostic.go
// ("en-tête " + EnTeteSession + " requis"). Les cas négatifs (littéral
// non-chaîne, appel dynamique, identifiant seul) vérifient que le
// détecteur reste muet sur ce qu'il ne doit PAS comparer.
func TestLitteralMessageExtraitLesFragmentsStatiques(t *testing.T) {
	cas := []struct {
		nom  string
		src  string
		veut []string
	}{
		{"litteral simple", `"bonjour"`, []string{"bonjour"}},
		{"format Sprintf, arguments dynamiques ignores", `fmt.Sprintf("bonjour %q", nom)`, []string{"bonjour %q"}},
		{"concatenation, les DEUX fragments statiques -- pas un seul", `"en-tête " + " requis"`, []string{"en-tête ", " requis"}},
		{"concatenation a trois avec une constante dynamique au milieu, les deux fragments statiques survivent", `"en-tête " + EnTeteSession + " requis"`, []string{"en-tête ", " requis"}},
		{"litteral non-chaine -- rien a comparer", `42`, nil},
		{"appel dynamique non-Sprintf -- rien a comparer", `err.Error()`, nil},
		{"identifiant seul -- rien a comparer", `nom`, nil},
	}
	for _, c := range cas {
		expr := parseExpr(t, c.src)
		got := LitteralMessage(expr)
		if !slicesEgales(got, c.veut) {
			t.Errorf("%s : LitteralMessage(%s) = %#v, attendu %#v", c.nom, c.src, got, c.veut)
		}
	}
}

// TestExtraireAppelsParcourtLAST couvre le parcours d'AST lui-meme -- pas
// seulement LitteralMessage et TrouveVouvoiement qu'il appelle : sans ce
// test, ExtraireAppels n'etait exerce que depuis les tests de internal/api
// et internal/arbre, jamais depuis ce paquet, et le profil de couverture de
// internal/orthographe le montrait a 0,0 % (revue du 2026-08-23) -- un
// detecteur non couvert par son propre meta-test est exactement ce que ce
// fichier existe pour eviter.
//
// Elle rejoue, sur un petit source construit a la main, le cas qui a fait
// diverger les deux copies avant mutualisation : un argument message
// construit par concatenation "+" (diagnostic.go : "en-tete "+EnTeteSession+
// " requis"). ExtraireAppels ne rend pas d'erreur -- son seul "chemin
// d'erreur" est de rester muet sur ce qu'il ne doit pas extraire, couvert
// ici par les quatre negatifs : fonction non surveillee, appel via une
// selection (fmt.Println) plutot qu'un identifiant nu, et arite
// insuffisante (l'index du parametre message depasse les arguments reels).
func TestExtraireAppelsParcourtLAST(t *testing.T) {
	const src = `package exemple

import "fmt"

const Constante = "X"

func centrePanne(message string) {}
func autreFonction(message string) {}

func exemple() {
	centrePanne("littéral simple")
	centrePanne("préfixe " + Constante + " suffixe")
	autreFonction("jamais surveillee -- absente de constructeurs, doit rester absente du resultat")
	fmt.Println("appel par selection, pas par identifiant nu -- ignore")
	centrePanne()
}
`
	fset := token.NewFileSet()
	fichier, err := parser.ParseFile(fset, "exemple.go", src, 0)
	if err != nil {
		t.Fatalf("analyse du source d'exemple : %v", err)
	}

	got := ExtraireAppels(fichier, map[string]int{"centrePanne": 0})
	veut := []string{"littéral simple", "préfixe ", " suffixe"}
	if !slicesEgales(got, veut) {
		t.Errorf("ExtraireAppels = %#v, attendu %#v", got, veut)
	}
}

func slicesEgales(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
