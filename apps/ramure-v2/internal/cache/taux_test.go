package cache

import (
	"errors"
	"testing"
	"time"
)

func TestTauxDeServiceCompteLesEntreesServies(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) { return []byte("v"), nil }

	if succes, total := c.TauxDeService(); succes != 0 || total != 0 {
		t.Fatalf("cache neuf : succes = %d, total = %d ; attendu 0 et 0", succes, total)
	}

	_, _ = c.Obtenir("k", time.Minute, charger) // manque
	_, _ = c.Obtenir("k", time.Minute, charger) // servi
	_, _ = c.Obtenir("k", time.Minute, charger) // servi

	succes, total := c.TauxDeService()
	if succes != 2 || total != 3 {
		t.Fatalf("succes = %d, total = %d ; attendu 2 et 3", succes, total)
	}
}

// Une erreur n'est pas un service rendu : la compter gonflerait le taux au
// moment precis ou la source est en panne, donc ou le chiffre doit alerter.
func TestUneErreurNeCompteAucunService(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) { return nil, errors.New("panne") }

	_, _ = c.Obtenir("k", time.Minute, charger)
	_, _ = c.Obtenir("k", time.Minute, charger)

	succes, total := c.TauxDeService()
	if succes != 0 || total != 2 {
		t.Fatalf("succes = %d, total = %d ; attendu 0 et 2", succes, total)
	}
}
