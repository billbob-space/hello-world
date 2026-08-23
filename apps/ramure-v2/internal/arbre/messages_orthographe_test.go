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
// La detection du vouvoiement et l'extraction des fragments STATIQUES d'un
// argument message sont MUTUALISEES avec internal/api/messages_orthographe_
// test.go dans internal/orthographe (a lire pour la genese des choix,
// notamment pourquoi une heuristique d'accent generique est ECARTEE au
// profit d'une table figee -- Critique 2026-08-23 N4). Ce fichier ne garde
// que ce qui lui est PROPRE : la table des messages deja relus pour ce
// paquet, et le nom des constructeurs dont il analyse les appels
// (centreVide, centrePanne, centreVideAvec).
package arbre

import (
	"go/parser"
	"go/token"
	"path/filepath"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/orthographe"
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

// messagesRendus extrait, par analyse statique de centre.go, tous les
// litteraux passes aux trois constructeurs de Centre qui portent un
// message affichable : centreVide, centrePanne, centreVideAvec (l'index
// est celui du parametre "message" dans chaque signature). L'extraction
// elle-meme -- marcher l'AST, reconnaitre un fmt.Sprintf ou une
// concatenation -- est mutualisee dans orthographe.ExtraireAppels.
func messagesRendus(t *testing.T) []string {
	t.Helper()
	fset := token.NewFileSet()
	fichier, err := parser.ParseFile(fset, filepath.Join(".", "centre.go"), nil, parser.AllErrors)
	if err != nil {
		t.Fatalf("analyse de centre.go : %v", err)
	}

	messages := orthographe.ExtraireAppels(fichier, map[string]int{
		"centreVide":     0,
		"centrePanne":    0,
		"centreVideAvec": 3,
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
		{"message exact de la table", `Aucun voisin connu pour cet artiste.`, true},
		{"meme message, un accent avale -- devient un message DIFFERENT, donc inconnu", `Aucun voisin connu pour cet artiste`, false},
		{"message jamais vu", `Cet artiste a disparu de la source.`, false},
	}
	for _, c := range cas {
		if got := messagesAttendus[c.msg]; got != c.connu {
			t.Errorf("%s : connu = %v, attendu %v (msg %q)", c.nom, got, c.connu, c.msg)
		}
	}
}
