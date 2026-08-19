// apps/ramure-v2/internal/budget/espacement_test.go
package budget

import (
	"context"
	"errors"
	"testing"
	"time"
)

// La contrainte dure de N-13 : 1 appel par seconde et par adresse IP, partagee
// par tous les utilisateurs. Trois appels tiennent donc en 2 s au minimum — le
// premier passe sans attendre, les deux suivants attendent chacun leur tour.
func TestMusicBrainzEspaceLesAppelsAUneParSeconde(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	debut := time.Now()
	for i := 0; i < 3; i++ {
		if err := l.Attendre(ctx, MusicBrainz, Centre); err != nil {
			t.Fatalf("attente %d : %v", i, err)
		}
	}
	ecoule := time.Since(debut)

	if ecoule < 1900*time.Millisecond {
		t.Fatalf("3 appels en %v, attendu au moins 1,9 s : le debit n'est pas respecte", ecoule)
	}
	if ecoule > 3*time.Second {
		t.Fatalf("3 appels en %v, attendu moins de 3 s : l'attente est comptee deux fois", ecoule)
	}
}

// L'entourage est servi par les sources tolerantes : si Deezer etait bride
// comme MusicBrainz, dix branches couteraient dix secondes et N-01 tomberait.
func TestDeezerNEstPasBrideCommeMusicBrainz(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	debut := time.Now()
	for i := 0; i < 5; i++ {
		if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
			t.Fatalf("attente %d : %v", i, err)
		}
	}
	ecoule := time.Since(debut)

	if ecoule > 300*time.Millisecond {
		t.Fatalf("5 appels Deezer en %v, attendu moins de 300 ms", ecoule)
	}
}

// §09 : « les reponses tardives sont ignorees, pas appliquees ». Un chargement
// abandonne ne doit pas rester bloque dans la file d'attente.
func TestContexteAnnuleInterromptLAttente(t *testing.T) {
	l := Neuf()
	if err := l.Attendre(context.Background(), MusicBrainz, Centre); err != nil {
		t.Fatalf("premier appel : %v", err)
	}

	ctxCourt, annuler := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer annuler()

	debut := time.Now()
	err := l.Attendre(ctxCourt, MusicBrainz, Centre)
	ecoule := time.Since(debut)

	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, attendu context.DeadlineExceeded", err)
	}
	if ecoule > 500*time.Millisecond {
		t.Fatalf("l'attente a dure %v apres echeance : l'annulation n'est pas ecoutee", ecoule)
	}
}
