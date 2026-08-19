// apps/ramure-v2/internal/equite/garde_test.go
package equite_test

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/equite"
)

func requeteDe(identite string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/api/centre?nom=x", nil)
	if identite != "" {
		r.Header.Set("X-Forwarded-User", identite)
	}
	return r
}

// TestUnSeulChargementEnVolParIdentite (N-14, critique) : deux
// chargements demandes par la MEME identite s'executent l'un apres
// l'autre ; deux identites differentes ne s'attendent PAS. Aucun n'echoue.
func TestUnSeulChargementEnVolParIdentite(t *testing.T) {
	t.Run("meme identite : serialisee", func(t *testing.T) {
		var mu sync.Mutex
		var ordre []string
		marquer := func(id string, mot string) {
			mu.Lock()
			ordre = append(ordre, mot+":"+id)
			mu.Unlock()
		}

		h := equite.Garde(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get("X-Forwarded-User")
			marquer(id, "debut")
			time.Sleep(30 * time.Millisecond)
			marquer(id, "fin")
			w.WriteHeader(http.StatusOK)
		}))

		var codes [2]int
		var attente sync.WaitGroup
		attente.Add(2)
		go func() {
			defer attente.Done()
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, requeteDe("a@x"))
			codes[0] = rec.Code
		}()
		time.Sleep(10 * time.Millisecond) // garantit l'ordre de depart
		go func() {
			defer attente.Done()
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, requeteDe("a@x"))
			codes[1] = rec.Code
		}()
		attente.Wait()

		if codes[0] != http.StatusOK || codes[1] != http.StatusOK {
			t.Fatalf("aucun chargement ne doit echouer, obtenu %v", codes)
		}
		if len(ordre) != 4 {
			t.Fatalf("attendu 4 marques, obtenu %d : %v", len(ordre), ordre)
		}
		// La seconde execution ne doit JAMAIS demarrer avant que la
		// premiere ne soit terminee : pas de "debut" avant le "fin" qui le
		// precede immediatement.
		if !(ordre[0] == "debut:a@x" && ordre[1] == "fin:a@x" &&
			ordre[2] == "debut:a@x" && ordre[3] == "fin:a@x") {
			t.Fatalf("les deux chargements de la meme identite se sont chevauches : %v", ordre)
		}
	})

	t.Run("identites differentes : aucune attente", func(t *testing.T) {
		h := equite.Garde(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(40 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		}))

		debut := time.Now()
		var attente sync.WaitGroup
		attente.Add(2)
		for _, id := range []string{"a@x", "b@x"} {
			id := id
			go func() {
				defer attente.Done()
				h.ServeHTTP(httptest.NewRecorder(), requeteDe(id))
			}()
		}
		attente.Wait()
		duree := time.Since(debut)

		// Si les deux s'etaient attendues, la duree totale aurait ete
		// proche de 80ms. Deux identites distinctes doivent tourner en
		// parallele : nettement moins que deux fois 40ms.
		if duree >= 70*time.Millisecond {
			t.Fatalf("deux identites differentes se sont attendues : %v", duree)
		}
	})
}

// TestGardeEquiteLibereApresPanne : un chargement qui echoue (ici, une
// panique recuperee comme le ferait net/http) rend la place. Un garde qui
// fuit condamnerait le visiteur suivant, MEME identite, a attendre
// indefiniment.
func TestGardeEquiteLibereApresPanne(t *testing.T) {
	quiPanique := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { _ = recover() }() // simule le recover() de net/http par requete
		panic("echec simule")
	})
	h := equite.Garde(quiPanique)

	// Premier appel : panique, recuperee.
	func() {
		defer func() { _ = recover() }()
		h.ServeHTTP(httptest.NewRecorder(), requeteDe("a@x"))
	}()

	// Second appel, MEME identite : ne doit pas rester bloque.
	fini := make(chan struct{})
	go func() {
		h.ServeHTTP(httptest.NewRecorder(), requeteDe("a@x"))
		close(fini)
	}()

	select {
	case <-fini:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("le garde a fui apres une panne : le visiteur suivant attend indefiniment")
	}
}
