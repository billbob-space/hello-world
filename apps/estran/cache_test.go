package main

import (
	"errors"
	"testing"
)

func TestDernierConnu_SuccesPuisEchec(t *testing.T) {
	var d dernierConnu[int]

	v, _, frais, err := d.rafraichir(func() (int, error) { return 42, nil })
	if err != nil || !frais || v != 42 {
		t.Fatalf("premier appel : v=%d frais=%v err=%v, attendu 42/true/nil", v, frais, err)
	}

	echecAttendu := errors.New("panne du fournisseur")
	v, _, frais, err = d.rafraichir(func() (int, error) { return 0, echecAttendu })
	if err != nil {
		t.Fatalf("deuxieme appel : erreur inattendue %v (le dernier connu doit masquer l'echec)", err)
	}
	if frais {
		t.Fatalf("deuxieme appel : frais=true attendu false, la valeur vient du cache")
	}
	if v != 42 {
		t.Fatalf("deuxieme appel : v=%d, attendu 42 (dernier connu)", v)
	}
}

func TestDernierConnu_EchecAFroid(t *testing.T) {
	var d dernierConnu[int]
	echecAttendu := errors.New("jamais interroge avec succes")

	_, _, frais, err := d.rafraichir(func() (int, error) { return 0, echecAttendu })
	if err == nil {
		t.Fatal("attendu une erreur : rien n'est connu")
	}
	if frais {
		t.Fatal("frais doit etre false quand l'appel echoue")
	}
}
