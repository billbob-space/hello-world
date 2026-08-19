// apps/ramure-v2/main_mesure_test.go
// Cablage de la persistance et de la mesure (PRP 07) au niveau main().
package main

import (
	"bytes"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

// journalSurveille est un io.Writer protege par mutex : contrairement au
// bytes.Buffer nu de capturerJournal (main_test.go), il est sur d'emploi
// concurrent — indispensable ici, ou une goroutine de fond (le minuteur
// d'instantanes) ecrit pendant que le test lit.
type journalSurveille struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (j *journalSurveille) Write(p []byte) (int, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.buf.Write(p)
}

func (j *journalSurveille) Len() int {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.buf.Len()
}

func TestSousRepertoireVideRendVide(t *testing.T) {
	if v := sousRepertoire("", "collection"); v != "" {
		t.Fatalf("attendu \"\", obtenu %q", v)
	}
}

func TestSousRepertoireSepareCollectionEtReglages(t *testing.T) {
	c := sousRepertoire("/var/lib/ramure", "collection")
	r := sousRepertoire("/var/lib/ramure", "reglages")
	if c == r {
		t.Fatalf("collection et reglages partagent le meme sous-repertoire : %q", c)
	}
	if !strings.HasPrefix(c, "/var/lib/ramure") || !strings.HasPrefix(r, "/var/lib/ramure") {
		t.Fatalf("les sous-repertoires devraient rester sous la base : c=%q r=%q", c, r)
	}
}

// TestEcrireInstantaneEcritUneLigneJSONSansIdentite : N-09, "une ligne
// JSON", sans donnee nominative.
func TestEcrireInstantaneEcritUneLigneJSONSansIdentite(t *testing.T) {
	tampon := capturerJournal(t)
	agr := mesure.Neuf(nil)
	agr.Compter(mesure.Promotion, "quelquun@exemple.fr") // meme un jeton nominatif ne doit pas fuiter

	ecrireInstantane(agr)

	sortie := strings.TrimSpace(tampon.String())
	if strings.Count(sortie, "\n") != 0 {
		t.Fatalf("l'instantane doit tenir sur une seule ligne : %q", sortie)
	}
	if strings.Contains(sortie, "@") {
		t.Fatalf("une adresse electronique a fuite dans l'instantane du journal : %q", sortie)
	}
	debut := strings.Index(sortie, "{")
	if debut == -1 {
		t.Fatalf("aucun JSON trouve dans la ligne : %q", sortie)
	}
	var decode map[string]any
	if err := json.Unmarshal([]byte(sortie[debut:]), &decode); err != nil {
		t.Fatalf("la ligne ne porte pas de JSON valide : %v (%q)", err, sortie)
	}
}

// TestDemarrerInstantanesPeriodiquesEcritApresLIntervalle : verifie le
// cablage du minuteur sans attendre 5 minutes reelles.
func TestDemarrerInstantanesPeriodiquesEcritApresLIntervalle(t *testing.T) {
	tampon := &journalSurveille{}
	precedent, precedents := log.Writer(), log.Flags()
	log.SetOutput(tampon)
	log.SetFlags(0)
	t.Cleanup(func() { log.SetOutput(precedent); log.SetFlags(precedents) })

	agr := mesure.Neuf(nil)

	arreter := demarrerInstantanesPeriodiques(agr, 10*time.Millisecond)
	defer arreter()

	deadline := time.After(500 * time.Millisecond)
	for {
		if tampon.Len() > 0 {
			break
		}
		select {
		case <-deadline:
			t.Fatal("aucun instantane ecrit apres l'intervalle")
		case <-time.After(5 * time.Millisecond):
		}
	}
}
