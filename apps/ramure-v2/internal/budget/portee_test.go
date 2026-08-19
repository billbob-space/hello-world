// apps/ramure-v2/internal/budget/portee_test.go
package budget

import (
	"context"
	"errors"
	"testing"
)

// N-03 : « les sources les plus contraintes en debit sont reservees au centre ;
// l'entourage est servi par les sources les plus tolerantes ».
func TestPorteesAutoriseesEtInterdites(t *testing.T) {
	cas := []struct {
		source   Source
		portee   Portee
		interdit bool
		pourquoi string
	}{
		{MusicBrainz, Centre, false, "2 appels par promotion, c'est le budget prevu"},
		{MusicBrainz, Entourage, true, "1/s : dix branches feraient dix secondes d'attente"},
		{CoverArt, Centre, false, "la pochette du centre, un appel"},
		{CoverArt, Entourage, true, "meme infrastructure que MusicBrainz, meme prudence"},
		{Deezer, Centre, false, "illustration du centre"},
		{Deezer, Entourage, false, "debit genereux : une illustration par branche"},
		{LastFM, Entourage, false, "les heritiers, un appel par branche, differe"},
		{ListenBrainz, Entourage, false, "repli du role 1, sans cle"},
		{Odesli, Entourage, false, "a la demande, sur clic"},
	}

	for _, c := range cas {
		l := Neuf()
		err := l.Attendre(context.Background(), c.source, c.portee)
		if c.interdit {
			if !errors.Is(err, ErrPorteeInterdite) {
				t.Errorf("Attendre(%s, %s) = %v, attendu ErrPorteeInterdite (%s)",
					c.source, c.portee, err, c.pourquoi)
			}
			continue
		}
		if err != nil {
			t.Errorf("Attendre(%s, %s) = %v, attendu nil (%s)",
				c.source, c.portee, err, c.pourquoi)
		}
	}
}

func TestSourceInconnueEstRefusee(t *testing.T) {
	l := Neuf()
	err := l.Attendre(context.Background(), Source("spotify"), Centre)
	if err == nil {
		t.Fatal("une source hors nomenclature doit etre refusee")
	}
	if errors.Is(err, ErrPorteeInterdite) {
		t.Fatalf("err = %v : une source inconnue n'est pas un probleme de portee", err)
	}
}
