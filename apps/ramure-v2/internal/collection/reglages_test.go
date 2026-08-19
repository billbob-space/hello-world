// apps/ramure-v2/internal/collection/reglages_test.go
package collection

import (
	"bytes"
	"context"
	"testing"
)

func nouveauxReglagesDeTest(t *testing.T) []struct {
	nom   string
	store ReglagesStore
} {
	t.Helper()
	fs, err := NouveauReglagesFichier(t.TempDir())
	if err != nil {
		t.Fatalf("NouveauReglagesFichier : %v", err)
	}
	return []struct {
		nom   string
		store ReglagesStore
	}{
		{"ReglagesMemoire", NouveauReglagesMemoire()},
		{"ReglagesFichier", fs},
	}
}

// TestReglageServiceSuitLIdentite (F-25) : le service ecrit par a@x est
// relu par a@x depuis une autre "session" (une seconde instance du
// store) ; b@x obtient le service par defaut, jamais celui de a@x. C'est
// ce qui rend vraie la promesse "le choix le suit d'un appareil a
// l'autre", qu'un stockage de navigateur ne tiendrait pas.
func TestReglageServiceSuitLIdentite(t *testing.T) {
	for _, essai := range nouveauxReglagesDeTest(t) {
		t.Run(essai.nom, func(t *testing.T) {
			ctx := context.Background()
			if err := essai.store.Ecrire(ctx, "a@x", Reglages{ServiceEcoute: "spotify"}); err != nil {
				t.Fatalf("ecrire : %v", err)
			}
			relu, err := essai.store.Lire(ctx, "a@x")
			if err != nil {
				t.Fatalf("lire a@x : %v", err)
			}
			if relu.ServiceEcoute != "spotify" {
				t.Fatalf("a@x devrait relire spotify, obtenu %q", relu.ServiceEcoute)
			}

			reglagesB, err := essai.store.Lire(ctx, "b@x")
			if err != nil {
				t.Fatalf("lire b@x : %v", err)
			}
			if reglagesB.ServiceEcoute != ServiceParDefaut {
				t.Fatalf("CLOISONNEMENT ROMPU : b@x obtient %q, attendu le defaut %q",
					reglagesB.ServiceEcoute, ServiceParDefaut)
			}
		})
	}
}

// TestReglageInconnuRetombeSurLeDefaut : un service absent ou inconnu ne
// casse rien et ne vide aucun lien.
func TestReglageInconnuRetombeSurLeDefaut(t *testing.T) {
	for _, essai := range nouveauxReglagesDeTest(t) {
		t.Run(essai.nom, func(t *testing.T) {
			ctx := context.Background()

			// Absent : jamais ecrit.
			r, err := essai.store.Lire(ctx, "jamais-vu@x")
			if err != nil || r.ServiceEcoute != ServiceParDefaut {
				t.Fatalf("service absent : attendu (%q, nil), obtenu (%q, %v)", ServiceParDefaut, r.ServiceEcoute, err)
			}

			// Inconnu : un service qui n'existe plus dans la liste.
			if err := essai.store.Ecrire(ctx, "b@x", Reglages{ServiceEcoute: "napster"}); err != nil {
				t.Fatalf("ecrire un service inconnu ne doit pas echouer : %v", err)
			}
			r2, err := essai.store.Lire(ctx, "b@x")
			if err != nil || r2.ServiceEcoute != ServiceParDefaut {
				t.Fatalf("service inconnu : attendu repli sur %q, obtenu (%q, %v)", ServiceParDefaut, r2.ServiceEcoute, err)
			}
		})
	}
}

// TestSansRepertoireLesReglagesRetombentSurLaMemoire : miroir de
// TestSansRepertoireOnRetombeSurMemoryStore pour ChoisirReglagesStore.
func TestSansRepertoireLesReglagesRetombentSurLaMemoire(t *testing.T) {
	var sortie bytes.Buffer
	store, err := ChoisirReglagesStore("", &sortie)
	if err != nil {
		t.Fatalf("ChoisirReglagesStore : %v", err)
	}
	if _, estFichier := store.(*reglagesFichier); estFichier {
		t.Fatal("repertoire vide aurait du rendre un store en memoire")
	}
	if sortie.Len() == 0 {
		t.Fatal("aucun avertissement explicite ecrit au demarrage")
	}
}
