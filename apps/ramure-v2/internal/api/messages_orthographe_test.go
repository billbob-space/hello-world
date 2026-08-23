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
// un unique parser.ParseFile.
//
// La detection du vouvoiement et l'extraction des fragments STATIQUES d'un
// argument message (dont la concatenation "+" -- diagnostic.go :
// "en-tete "+EnTeteSession+" requis") sont MUTUALISEES avec
// internal/arbre/messages_orthographe_test.go dans internal/orthographe.
// Ce fichier ne garde que ce qui lui est PROPRE : la table des messages
// deja relus pour ce paquet, et le nom de la fonction dont il analyse les
// appels (ecrireErreur).
package api

import (
	"go/parser"
	"go/token"
	"io/fs"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/orthographe"
)

// messagesAttendus : la liste EXACTE, mot pour mot, des fragments de
// message que ce paquet peut passer a ecrireErreur aujourd'hui, relus a la
// main pour leur accentuation et leur tutoiement. Toute modification d'un
// de ces six fichiers -- correction, faute de frappe ou message neuf --
// doit se refleter ICI apres relecture, jamais avant : c'est ce qui rend
// la comparaison litterale plus sure qu'une heuristique.
//
// "en-tête " et " requis" (diagnostic.go) figurent en DEUX fragments,
// separes par la constante EnTeteSession que LitteralMessage ne resout
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

// messagesRendus extrait, par analyse statique de tous les fichiers .go de
// ce paquet (fichiers de test exclus), tous les fragments litteraux passes
// en troisieme argument (message) a ecrireErreur. L'extraction elle-meme --
// marcher l'AST, reconnaitre un fmt.Sprintf ou une concatenation -- est
// mutualisee dans orthographe.ExtraireAppels.
func messagesRendus(t *testing.T) []string {
	t.Helper()
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, parser.AllErrors)
	if err != nil {
		t.Fatalf("analyse du paquet api : %v", err)
	}

	constructeurs := map[string]int{"ecrireErreur": 2}
	var messages []string
	for _, pkg := range pkgs {
		for _, fichier := range pkg.Files {
			messages = append(messages, orthographe.ExtraireAppels(fichier, constructeurs)...)
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
		if mot := orthographe.TrouveVouvoiement(msg); mot != "" {
			t.Errorf("message %q : %q vouvoie (l'app tutoie partout ailleurs, voir web/src/textes.ts)", msg, mot)
		}
	}
}

// TestMessagesAttendusReconnaissentLesCasConnus verifie messagesAttendus
// lui-meme, sur ce qu'il ACCEPTE (un message deja relu) autant que sur ce
// qu'il refuse (un message absent, ou modifie meme d'un seul accent) --
// Journal 2026-08-22, anomalie 24. La detection du vouvoiement, elle, est
// mutualisee : voir internal/orthographe/orthographe_test.go.
func TestMessagesAttendusReconnaissentLesCasConnus(t *testing.T) {
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
}
