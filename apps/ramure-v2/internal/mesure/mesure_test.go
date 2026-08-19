// apps/ramure-v2/internal/mesure/mesure_test.go
package mesure

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestMedianeSurUnNombreImpairDEchantillons(t *testing.T) {
	if v := mediane([]int{5, 1, 3}); v != 3 {
		t.Fatalf("attendu 3, obtenu %v", v)
	}
}

func TestMedianeSurUnNombrePairDEchantillons(t *testing.T) {
	if v := mediane([]int{1, 2, 3, 4}); v != 2.5 {
		t.Fatalf("attendu 2.5, obtenu %v", v)
	}
}

func TestPercentile75SurQuatreEchantillons(t *testing.T) {
	valeurs := []time.Duration{
		100 * time.Millisecond, 200 * time.Millisecond,
		300 * time.Millisecond, 400 * time.Millisecond,
	}
	if v := percentile75(valeurs); v != 300*time.Millisecond {
		t.Fatalf("attendu 300ms, obtenu %v", v)
	}
}

// TestSessionsDistinctesNonConfondues : les evenements de deux sessions
// n'interferent jamais dans le calcul.
func TestSessionsDistinctesNonConfondues(t *testing.T) {
	a := Neuf(nil)
	a.Compter(Promotion, "s1")
	a.Compter(Promotion, "s1")
	a.Compter(Promotion, "s1")
	a.Compter(Promotion, "s2")

	instantane := a.Instantane()
	// mediane([3, 1]) = 2
	if v := instantane["sautsMedianParSession"]; v != 2.0 {
		t.Fatalf("les sessions ont ete confondues, sautsMedianParSession=%v", v)
	}

	journalS1 := a.JournalDeSession("s1")
	var evsS1 []evenementExport
	if err := json.Unmarshal(journalS1, &evsS1); err != nil {
		t.Fatalf("decodage journal s1 : %v", err)
	}
	if len(evsS1) != 3 {
		t.Fatalf("s1 devrait porter 3 evenements, en porte %d", len(evsS1))
	}
	journalS2 := a.JournalDeSession("s2")
	var evsS2 []evenementExport
	if err := json.Unmarshal(journalS2, &evsS2); err != nil {
		t.Fatalf("decodage journal s2 : %v", err)
	}
	if len(evsS2) != 1 {
		t.Fatalf("s2 devrait porter 1 evenement, en porte %d", len(evsS2))
	}
}

// TestAucuneDonneeNominativeDansLInstantane : le test cherche une adresse
// electronique dans le JSON produit et echoue si elle s'y trouve.
func TestAucuneDonneeNominativeDansLInstantane(t *testing.T) {
	a := Neuf(nil)
	// Les sessions elles-memes ne doivent jamais porter une identite —
	// mais MEME si un appelant negligent y glissait une adresse
	// electronique en guise de jeton de session, Instantane() ne doit
	// JAMAIS republier la cle de la map des sessions : seuls des
	// compteurs agreges en sortent.
	a.Compter(Promotion, "quelquun@exemple.fr")
	a.Compter(LienEcoute, "quelquun@exemple.fr")

	octets, err := json.Marshal(a.Instantane())
	if err != nil {
		t.Fatalf("encodage : %v", err)
	}
	corps := string(octets)
	if strings.Contains(corps, "@") {
		t.Fatalf("une adresse electronique a fuite dans l'instantane : %s", corps)
	}
}

// TestLeTauxDeServiceApparaitDansLInstantane.
func TestLeTauxDeServiceApparaitDansLInstantane(t *testing.T) {
	a := Neuf(nil)
	a.BrancherTauxDeService(func() (int64, int64) { return 42, 50 })
	instantane := a.Instantane()
	taux, ok := instantane["tauxService"].(map[string]int64)
	if !ok {
		t.Fatalf("tauxService absent ou de mauvais type : %#v", instantane["tauxService"])
	}
	if taux["succes"] != 42 || taux["total"] != 50 {
		t.Fatalf("tauxService inattendu : %+v", taux)
	}
}

// TestInstantanePorteLesMetriquesDuLot : les sept metriques du perimetre,
// M-06 et M-07 comprises, sont presentes dans l'instantane.
func TestInstantanePorteLesMetriquesDuLot(t *testing.T) {
	a := Neuf(nil)
	a.Compter(Plantation, "s1")
	a.Compter(Promotion, "s1")
	a.Compter(LienEcoute, "s1")
	a.Compter(Signet, "s1")
	a.Compter(AmorceCollection, "s2")
	a.Compter(AmorcePartage, "s3")
	a.Decouverte("s1", "Portishead")
	a.Latence("s1", 500*time.Millisecond)

	instantane := a.Instantane()
	attendues := []string{
		"sautsMedianParSession", // M-01
		"decouverteReelle",      // M-02
		"ecoute",                // M-03
		"conservation",          // M-04
		"latenceP75Ms",          // M-05
		"collectionReutilisee",  // M-06
		"partage",               // M-07
	}
	for _, cle := range attendues {
		if _, ok := instantane[cle]; !ok {
			t.Errorf("metrique %q absente de l'instantane : %#v", cle, instantane)
		}
	}
	if instantane["collectionReutilisee"].(float64) <= 0 {
		t.Errorf("M-06 devrait etre > 0 : une session a demarre par AmorceCollection")
	}
	if instantane["partage"].(float64) <= 0 {
		t.Errorf("M-07 devrait etre > 0 : une session a demarre par AmorcePartage")
	}
}

// TestDiagnosticNeSortQueLaSessionDemandee (N-10) : deux sessions, deux
// visiteurs — l'export de l'une ne contient rien de l'autre, et aucune
// adresse electronique.
func TestDiagnosticNeSortQueLaSessionDemandee(t *testing.T) {
	a := Neuf(nil)
	a.Compter(Promotion, "session-visiteur-1")
	a.Compter(Promotion, "session-visiteur-1")
	a.Compter(LienEcoute, "session-visiteur-2")

	export1 := a.JournalDeSession("session-visiteur-1")
	if strings.Contains(string(export1), "lien_ecoute") {
		t.Fatalf("l'export de la session 1 contient un evenement de la session 2 : %s", export1)
	}
	if strings.Contains(string(export1), "@") {
		t.Fatalf("une adresse electronique a fuite dans le diagnostic : %s", export1)
	}
	var evs1 []evenementExport
	_ = json.Unmarshal(export1, &evs1)
	if len(evs1) != 2 {
		t.Fatalf("attendu 2 evenements pour la session 1, obtenu %d", len(evs1))
	}

	// Session inconnue : tableau vide, jamais une erreur ni un plantage.
	inconnue := a.JournalDeSession("jamais-vue")
	if string(inconnue) != "[]" {
		t.Fatalf("session inconnue : attendu [], obtenu %s", inconnue)
	}
}

// TestLatenceAvecHorlogeInjectee : Neuf(horloge) rend les horodatages
// deterministes.
func TestHorlogeInjecteeRendLesHorodatagesDeterministes(t *testing.T) {
	fixe := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	a := Neuf(func() time.Time { return fixe })
	a.Compter(Promotion, "s1")
	var evs []evenementExport
	_ = json.Unmarshal(a.JournalDeSession("s1"), &evs)
	if len(evs) != 1 || evs[0].Horodate != fixe.Format(time.RFC3339Nano) {
		t.Fatalf("horodatage non deterministe : %+v", evs)
	}
}
