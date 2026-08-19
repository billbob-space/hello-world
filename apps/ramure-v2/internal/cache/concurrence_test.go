package cache

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// N-07 : vingt promotions simultanees sur la meme graine ne doivent produire
// qu'un seul appel externe. A defaut, le quota MusicBrainz (1/s) est depasse
// des la premiere minute de trafic reel.
func TestVingtRequetesSimultaneesNAppellentQuUneFoisLeChargeur(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		time.Sleep(20 * time.Millisecond)
		return []byte("8f6bd1e4-fbe1-4f50-aa9b-fb7f4e2b4c6b"), nil
	}

	depart := make(chan struct{})
	recu := make([]string, 20)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-depart
			v, err := c.Obtenir("musicbrainz:artiste:portishead", time.Minute, charger)
			if err != nil {
				t.Errorf("goroutine %d : %v", i, err)
				return
			}
			recu[i] = string(v)
		}(i)
	}
	close(depart)
	wg.Wait()

	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
	for i, v := range recu {
		if v != "8f6bd1e4-fbe1-4f50-aa9b-fb7f4e2b4c6b" {
			t.Fatalf("goroutine %d a recu %q", i, v)
		}
	}
}

// N-05 croise N-07 : l'erreur d'un vol mutualise remonte a tous les attendants,
// et n'est pas davantage memorisee que celle d'un appel solitaire.
func TestLErreurDUnVolMutualiseNEstPasMemorisee(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			time.Sleep(20 * time.Millisecond)
			return nil, errors.New("source indisponible")
		}
		return []byte("retabli"), nil
	}

	depart := make(chan struct{})
	erreurs := make([]error, 10)
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-depart
			_, erreurs[i] = c.Obtenir("k", time.Minute, charger)
		}(i)
	}
	close(depart)
	wg.Wait()

	for i, err := range erreurs {
		if err == nil {
			t.Fatalf("goroutine %d : erreur attendue, l'echec a ete masque", i)
		}
	}
	v, err := c.Obtenir("k", time.Minute, charger)
	if err != nil {
		t.Fatalf("apres retablissement : %v", err)
	}
	if string(v) != "retabli" {
		t.Fatalf("valeur = %q, attendu \"retabli\"", v)
	}
}
