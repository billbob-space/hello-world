// apps/ramure-v2/internal/budget/comptage_test.go
package budget

import (
	"context"
	"sync"
	"testing"
)

func TestComptageParSource(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
		t.Fatalf("Deezer 1 : %v", err)
	}
	if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
		t.Fatalf("Deezer 2 : %v", err)
	}
	if err := l.Attendre(ctx, LastFM, Centre); err != nil {
		t.Fatalf("LastFM : %v", err)
	}

	if n := l.Compte(Deezer); n != 2 {
		t.Errorf("Compte(Deezer) = %d, attendu 2", n)
	}
	if n := l.Compte(LastFM); n != 1 {
		t.Errorf("Compte(LastFM) = %d, attendu 1", n)
	}
	if n := l.Compte(MusicBrainz); n != 0 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 0", n)
	}
	if n := l.Compte(Source("spotify")); n != 0 {
		t.Errorf("Compte(source inconnue) = %d, attendu 0", n)
	}
}

// C'est l'assertion que le PRP 04 reprendra sur un centre complet : un appel
// refuse pour cause de portee n'a pas eu lieu, et ne doit donc rien couter.
func TestUnAppelRefusePourPorteeNeComptePas(t *testing.T) {
	l := Neuf()
	_ = l.Attendre(context.Background(), MusicBrainz, Entourage)
	_ = l.Attendre(context.Background(), CoverArt, Entourage)

	if n := l.Compte(MusicBrainz); n != 0 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 0", n)
	}
	if n := l.Compte(CoverArt); n != 0 {
		t.Errorf("Compte(CoverArt) = %d, attendu 0", n)
	}
}

func TestComptageSousConcurrence(t *testing.T) {
	l := Neuf()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = l.Attendre(context.Background(), Deezer, Entourage)
		}()
	}
	wg.Wait()

	if n := l.Compte(Deezer); n != 20 {
		t.Fatalf("Compte(Deezer) = %d, attendu 20", n)
	}
}
