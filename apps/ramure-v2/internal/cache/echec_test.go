package cache

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

// N-05 : « les reponses en erreur ou en depassement de quota ne sont jamais
// mises en cache : le statut reel doit remonter pour que la temporisation cote
// client fonctionne ».
func TestUneErreurNEstJamaisMiseEnCache(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			return nil, errors.New("quota depasse")
		}
		return []byte("retabli"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err == nil {
		t.Fatal("premiere tentative : erreur attendue")
	}
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("seconde tentative : %v", err)
	}
	if string(v) != "retabli" {
		t.Fatalf("valeur = %q, attendu \"retabli\" : l'echec a ete memorise", v)
	}
	if n := atomic.LoadInt32(&appels); n != 2 {
		t.Fatalf("chargeur appele %d fois, attendu 2", n)
	}
}

// §09 : un vivier vide est un etat transitoire, pas un resultat. Le chargeur le
// signale par une erreur — c'est la convention que le PRP 03 applique — et le
// cache ne doit rien retenir, meme si des octets accompagnent l'erreur.
func TestUnVivierVideSignaleParUneErreurNEstPasFige(t *testing.T) {
	c := Neuf(time.Now)
	errVide := errors.New("vivier vide")
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			return []byte("[]"), errVide
		}
		return []byte(`[{"nom":"Massive Attack","affinite":0.91}]`), nil
	}

	if _, err := c.Obtenir("lastfm:vivier:portishead", time.Hour, charger); !errors.Is(err, errVide) {
		t.Fatalf("premiere tentative : err = %v, attendu errVide", err)
	}
	v, err := c.Obtenir("lastfm:vivier:portishead", time.Hour, charger)

	if err != nil {
		t.Fatalf("seconde tentative : %v", err)
	}
	if string(v) != `[{"nom":"Massive Attack","affinite":0.91}]` {
		t.Fatalf("vivier = %s, attendu le vivier retabli", v)
	}
}
