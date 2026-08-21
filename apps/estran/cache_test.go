package main

import (
	"errors"
	"fmt"
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

// TestParLieu_MemeCleRendLeMemeCache verifie que deux appels a pour() avec la
// meme cle rendent le MEME *dernierConnu (pas deux caches distincts pour un
// seul lieu, ce qui romprait la degradation « dernier connu de ce lieu »).
func TestParLieu_MemeCleRendLeMemeCache(t *testing.T) {
	p := nouveauParLieu[int]()
	a := p.pour("lieu-a")
	a.rafraichir(func() (int, error) { return 42, nil })

	b := p.pour("lieu-a")
	if b != a {
		t.Fatal("pour(meme cle) doit rendre le meme *dernierConnu")
	}
	v, _, _, err := b.rafraichir(func() (int, error) { return 0, errors.New("panne") })
	if err != nil || v != 42 {
		t.Fatalf("v/err = %v/%v, attendu 42/nil (dernier connu du meme lieu)", v, err)
	}
}

// TestParLieu_EvictionAuPlafond verifie prp/04, section 4 : un parLieu ne
// grandit jamais au-dela de plafondLieux, et evince le moins recemment servi
// — jamais un lieu qu'on vient d'interroger.
func TestParLieu_EvictionAuPlafond(t *testing.T) {
	p := nouveauParLieu[int]()
	for i := 0; i < plafondLieux; i++ {
		p.pour(fmt.Sprintf("lieu-%d", i))
	}
	if len(p.parCle) != plafondLieux {
		t.Fatalf("apres %d lieux distincts, taille = %d, attendu %d", plafondLieux, len(p.parCle), plafondLieux)
	}

	// Reservir lieu-1 a lieu-(plafondLieux-1) les rend plus recents que
	// lieu-0 : c'est donc lieu-0, jamais revisite depuis sa creation, qui
	// doit etre evince par l'entree suivante.
	for i := 1; i < plafondLieux; i++ {
		p.pour(fmt.Sprintf("lieu-%d", i))
	}
	p.pour("lieu-nouveau")

	if len(p.parCle) != plafondLieux {
		t.Fatalf("apres depassement, taille = %d, attendu %d (plafond respecte)", len(p.parCle), plafondLieux)
	}
	if _, encore := p.parCle["lieu-0"]; encore {
		t.Error("lieu-0 attendu evince (le moins recemment servi)")
	}
	if _, present := p.parCle["lieu-nouveau"]; !present {
		t.Error("lieu-nouveau attendu present")
	}
	if !p.depasse {
		t.Error("depasse doit passer a true au premier depassement du plafond")
	}
}

func TestCleLieu_CleLieuMaree(t *testing.T) {
	if c := cleLieu(50.517, 1.583); c != "50.517,1.583" {
		t.Errorf("cleLieu = %q, attendu 50.517,1.583", c)
	}
	if c := cleLieuMaree(50.517, 1.583, "berck-plage-fort-mahon"); c != "50.517,1.583,berck-plage-fort-mahon" {
		t.Errorf("cleLieuMaree = %q", c)
	}
}
