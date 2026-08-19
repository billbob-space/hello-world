// apps/ramure-v2/internal/collection/store_test.go
//
// Cloisonnement strict par utilisateur (N-08) : ces tests attaquent le
// partitionnement plutot que de le supposer. Un test qui reste vert quand
// le cloisonnement casse ne prouve rien — c'est pourquoi chacun lit AVEC
// une identite differente de celle qui a ecrit.
package collection

import (
	"context"
	"testing"
	"time"
)

func nouveauxStoresDeTest(t *testing.T) []struct {
	nom   string
	store CollectionStore
} {
	t.Helper()
	fs, err := NouveauFileStore(t.TempDir())
	if err != nil {
		t.Fatalf("NouveauFileStore : %v", err)
	}
	return []struct {
		nom   string
		store CollectionStore
	}{
		{"MemoryStore", NouveauMemoryStore()},
		{"FileStore", fs},
	}
}

// TestCloisonnementStrict : l'utilisateur a@x ajoute un artiste ;
// l'utilisateur b@x liste et obtient ZERO entree. C'est le test qui doit
// devenir rouge si le cloisonnement saute.
func TestCloisonnementStrict(t *testing.T) {
	for _, essai := range nouveauxStoresDeTest(t) {
		t.Run(essai.nom, func(t *testing.T) {
			ctx := context.Background()
			if err := essai.store.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1"}); err != nil {
				t.Fatalf("ajouter : %v", err)
			}
			entreesA, err := essai.store.Lister(ctx, "a@x")
			if err != nil {
				t.Fatalf("lister a@x : %v", err)
			}
			if len(entreesA) != 1 {
				t.Fatalf("a@x devrait voir 1 entree, en voit %d", len(entreesA))
			}

			entreesB, err := essai.store.Lister(ctx, "b@x")
			if err != nil {
				t.Fatalf("lister b@x : %v", err)
			}
			if len(entreesB) != 0 {
				t.Fatalf("CLOISONNEMENT ROMPU : b@x voit %d entree(s) de a@x, attendu 0", len(entreesB))
			}
		})
	}
}

// TestRetirerNAffectePasLesAutresUtilisateurs.
func TestRetirerNAffectePasLesAutresUtilisateurs(t *testing.T) {
	for _, essai := range nouveauxStoresDeTest(t) {
		t.Run(essai.nom, func(t *testing.T) {
			ctx := context.Background()
			_ = essai.store.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1"})
			_ = essai.store.Ajouter(ctx, "b@x", Entree{Nom: "Portishead", MBID: "m1"})

			if err := essai.store.Retirer(ctx, "a@x", "m1"); err != nil {
				t.Fatalf("retirer : %v", err)
			}

			entreesA, _ := essai.store.Lister(ctx, "a@x")
			if len(entreesA) != 0 {
				t.Fatalf("a@x devrait n'avoir plus rien, a %d entree(s)", len(entreesA))
			}
			entreesB, _ := essai.store.Lister(ctx, "b@x")
			if len(entreesB) != 1 {
				t.Fatalf("le retrait de a@x a efface l'entree de b@x : %d entree(s), attendu 1", len(entreesB))
			}
		})
	}
}

// TestContexteDeDecouverteConserve (F-29) : la lignee complete et la date
// sont relues telles quelles.
func TestContexteDeDecouverteConserve(t *testing.T) {
	for _, essai := range nouveauxStoresDeTest(t) {
		t.Run(essai.nom, func(t *testing.T) {
			ctx := context.Background()
			ajoute := time.Date(2026, 3, 14, 12, 0, 0, 0, time.UTC)
			e := Entree{
				Nom:    "Tricky",
				MBID:   "m9",
				Lignee: []string{"Portishead", "Massive Attack", "Tricky"},
				Ajoute: ajoute,
			}
			if err := essai.store.Ajouter(ctx, "a@x", e); err != nil {
				t.Fatalf("ajouter : %v", err)
			}
			entrees, err := essai.store.Lister(ctx, "a@x")
			if err != nil || len(entrees) != 1 {
				t.Fatalf("lister : %d entrees, err=%v", len(entrees), err)
			}
			relue := entrees[0]
			if len(relue.Lignee) != 3 || relue.Lignee[0] != "Portishead" || relue.Lignee[2] != "Tricky" {
				t.Fatalf("lignee non conservee telle quelle : %+v", relue.Lignee)
			}
			if !relue.Ajoute.Equal(ajoute) {
				t.Fatalf("date non conservee : %v != %v", relue.Ajoute, ajoute)
			}
		})
	}
}

// TestAjouterEstIdempotentSurLeMBID : ajouter deux fois le meme artiste
// remplace l'entree, ne la duplique jamais.
func TestAjouterEstIdempotentSurLeMBID(t *testing.T) {
	ctx := context.Background()
	s := NouveauMemoryStore()
	_ = s.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1", Lignee: []string{"Portishead"}})
	_ = s.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1", Lignee: []string{"Massive Attack", "Portishead"}})
	entrees, _ := s.Lister(ctx, "a@x")
	if len(entrees) != 1 {
		t.Fatalf("attendu 1 entree apres deux ajouts du meme mbid, obtenu %d", len(entrees))
	}
	if len(entrees[0].Lignee) != 2 {
		t.Fatalf("le second ajout aurait du remplacer la lignee : %+v", entrees[0].Lignee)
	}
}
