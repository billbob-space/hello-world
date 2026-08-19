package cache

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestLesRequetesMutualiseesComptentCommeServies(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		time.Sleep(20 * time.Millisecond)
		return []byte("v"), nil
	}

	depart := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-depart
			_, _ = c.Obtenir("meme-cle", time.Minute, charger)
		}()
	}
	close(depart)
	wg.Wait()

	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
	succes, total := c.TauxDeService()
	if total != 20 {
		t.Fatalf("total = %d, attendu 20", total)
	}
	if succes != 19 {
		t.Fatalf("succes = %d, attendu 19 : les requetes mutualisees ne sont pas comptees", succes)
	}
}

// Symetrie du meme principe : un vol qui echoue n'a servi personne.
func TestUnVolEnErreurNeCompteAucunService(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) {
		time.Sleep(20 * time.Millisecond)
		return nil, errors.New("source indisponible")
	}

	depart := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-depart
			_, _ = c.Obtenir("k", time.Minute, charger)
		}()
	}
	close(depart)
	wg.Wait()

	succes, total := c.TauxDeService()
	if succes != 0 {
		t.Fatalf("succes = %d, attendu 0 : une panne mutualisee a ete comptee comme servie", succes)
	}
	if total != 10 {
		t.Fatalf("total = %d, attendu 10", total)
	}
}
