// apps/ramure-v2/internal/source/deezer_test.go
package source

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

func nouveauDeezerDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*Deezer, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	d := NouveauDeezer(cache.Neuf(time.Now), budget.Neuf(), srv.Client())
	d.BaseURL = srv.URL
	return d, srv
}

func TestChercherRefuseUnNomApprochant(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"id":1,"name":"Kate Bush"}]}`))
	})

	_, err := d.Chercher(context.Background(), "Bush", budget.Centre)
	if !errors.Is(err, ErrIntrouvable) {
		t.Fatalf("err = %v, attendu ErrIntrouvable", err)
	}
}

func TestExtraitsIgnorentLesPistesSansPreview(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[
			{"title":"Avec preview","preview":"https://cdn/x.mp3","duration":30},
			{"title":"Sans preview","preview":"","duration":30}
		]}`))
	})

	extraits, err := d.Extraits(context.Background(), 42, budget.Centre)
	if err != nil {
		t.Fatalf("Extraits : %v", err)
	}
	if len(extraits) != 1 || extraits[0].Titre != "Avec preview" {
		t.Fatalf("extraits = %+v, attendu un seul, avec preview", extraits)
	}
}

func TestChercherAutoriseEnEntourage(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"id":1,"name":"Portishead"}]}`))
	})

	_, err := d.Chercher(context.Background(), "Portishead", budget.Entourage)
	if errors.Is(err, budget.ErrPorteeInterdite) {
		t.Fatalf("err = %v, ErrPorteeInterdite inattendu en entourage", err)
	}
	if err != nil {
		t.Fatalf("Chercher : %v", err)
	}
}

func TestAucunExtraitRenvoieListeVideSansErreur(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[]}`))
	})

	extraits, err := d.Extraits(context.Background(), 42, budget.Centre)
	if err != nil {
		t.Fatalf("Extraits : %v, attendu nil", err)
	}
	if len(extraits) != 0 {
		t.Fatalf("extraits = %v, attendu vide", extraits)
	}
}

// TestChercherDepartageLesHomonymesParAudience : Deezer sert plusieurs
// artistes portant EXACTEMENT le meme nom, et son classement ne met pas le
// vrai en tete. Releve en production le 20 aout 2026 : « Radiohead » rend
// d'abord un doublon a 486 fans, sans illustration (le hachage
// d41d8cd98f00b204e9800998ecf8427e est celui de la chaine vide, l'image par
// defaut de Deezer), avant le vrai a plus de quatre millions. Prendre le
// premier, c'est afficher un centre sans photo dont le lien d'ecoute mene a
// une page vide.
func TestChercherDepartageLesHomonymesParAudience(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[
			{"id":323887691,"name":"Radiohead","nb_fan":486,
			 "picture_medium":"https://cdn/d41d8cd98f00b204e9800998ecf8427e/250.jpg",
			 "link":"https://www.deezer.com/artist/323887691"},
			{"id":399,"name":"Radiohead","nb_fan":4077099,
			 "picture_medium":"https://cdn/96b688020014a21cb80a0268b90287f5/250.jpg",
			 "link":"https://www.deezer.com/artist/399"}
		]}`))
	})

	fiche, err := d.Chercher(context.Background(), "Radiohead", budget.Centre)
	if err != nil {
		t.Fatalf("Chercher : %v", err)
	}
	if fiche.ID != 399 {
		t.Fatalf("ID = %d, attendu 399 (l'homonyme le plus ecoute)", fiche.ID)
	}
	if fiche.Auditeurs != 4077099 {
		t.Fatalf("Auditeurs = %d, attendu 4077099", fiche.Auditeurs)
	}
}

// TestChercherNePromeutJamaisUnNomApprochantMemeTresEcoute : le departage par
// audience s'applique ENTRE homonymes exacts, jamais au-dessus de la regle
// §09. Un artiste approchant, meme mille fois plus ecoute, reste refuse.
func TestChercherNePromeutJamaisUnNomApprochantMemeTresEcoute(t *testing.T) {
	d, _ := nouveauDeezerDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[
			{"id":1,"name":"Portishead","nb_fan":100},
			{"id":2,"name":"Portishead Tribute","nb_fan":9000000}
		]}`))
	})

	fiche, err := d.Chercher(context.Background(), "Portishead", budget.Centre)
	if err != nil {
		t.Fatalf("Chercher : %v", err)
	}
	if fiche.ID != 1 {
		t.Fatalf("ID = %d, attendu 1 : seul le nom exact est eligible", fiche.ID)
	}
}
