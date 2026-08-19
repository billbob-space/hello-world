package cache

import (
	"sync/atomic"
	"testing"
	"time"
)

func TestSecondAppelServiParLeCache(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		return []byte("valeur"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("second appel : %v", err)
	}
	if string(v) != "valeur" {
		t.Fatalf("valeur = %q, attendu \"valeur\"", v)
	}
	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
}

func TestEntreeExpireeEstRechargee(t *testing.T) {
	instant := time.Unix(1754200000, 0)
	c := Neuf(func() time.Time { return instant })
	var appels int32
	charger := func() ([]byte, error) {
		n := atomic.AddInt32(&appels, 1)
		if n == 1 {
			return []byte("ancienne"), nil
		}
		return []byte("fraiche"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	instant = instant.Add(2 * time.Minute)
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("apres expiration : %v", err)
	}
	if string(v) != "fraiche" {
		t.Fatalf("valeur = %q, attendu \"fraiche\"", v)
	}
	if n := atomic.LoadInt32(&appels); n != 2 {
		t.Fatalf("chargeur appele %d fois, attendu 2", n)
	}
}

func TestClesDistinctesNeSePartagentPasUneEntree(t *testing.T) {
	c := Neuf(time.Now)
	charger := func(valeur string) func() ([]byte, error) {
		return func() ([]byte, error) { return []byte(valeur), nil }
	}

	a, _ := c.Obtenir("musicbrainz:artiste:portishead", time.Minute, charger("portishead"))
	b, _ := c.Obtenir("musicbrainz:artiste:radiohead", time.Minute, charger("radiohead"))

	if string(a) != "portishead" {
		t.Fatalf("cle portishead = %q", a)
	}
	if string(b) != "radiohead" {
		t.Fatalf("cle radiohead = %q", b)
	}
}
