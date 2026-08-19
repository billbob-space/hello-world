// apps/ramure-v2/internal/arbre/centre_test.go
package arbre

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// proximiteBouchon simule la source de proximite (role 1), sans reseau.
type proximiteBouchon struct {
	voisins   []source.Voisin
	err       error
	profil    source.Profil
	errProfil error
}

func (p proximiteBouchon) Vivier(ctx context.Context, a source.Artiste, portee budget.Portee) ([]source.Voisin, error) {
	return p.voisins, p.err
}

func (p proximiteBouchon) Profil(ctx context.Context, nom string, portee budget.Portee) (source.Profil, error) {
	return p.profil, p.errProfil
}

// construireCatalogueDeTest cable un *source.MusicBrainz reel contre un
// httptest.Server : Composer prend Catalogue par valeur concrete, pas par
// interface, donc aucune doublure n'est possible ici (PRD §13).
func construireCatalogueDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*source.MusicBrainz, *budget.Limiteur) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	l := budget.Neuf()
	m := source.NouveauMusicBrainz(cache.Neuf(time.Now), l, srv.Client(), "ramure-v2-test/1.0")
	m.BaseURL = srv.URL
	m.CoverArtBaseURL = srv.URL
	return m, l
}

// mbSuccesDiscographieVide repond a la resolution de l'artiste et rend une
// discographie vide (aucun appel Pochette).
func mbSuccesDiscographieVide(nomAttendu string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasPrefix(r.URL.Path, "/ws/2/artist"):
			fmt.Fprintf(w, `{"artists":[{"id":"mbid-1","name":%q,"score":100}]}`, nomAttendu)
		case strings.HasPrefix(r.URL.Path, "/ws/2/release-group"):
			fmt.Fprint(w, `{"release-groups":[]}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

func TestArtisteSansVoisinsNEstPasUnePanne(t *testing.T) {
	mb, l := construireCatalogueDeTest(t, mbSuccesDiscographieVide("Portishead"))
	d := Dependances{Catalogue: mb, Proximite: proximiteBouchon{voisins: []source.Voisin{}}, Limiteur: l}

	centre, err := Composer(context.Background(), d, "Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("Composer : %v", err)
	}
	if centre.Etat != EtatAucunVoisin {
		t.Fatalf("Etat = %q, attendu %q", centre.Etat, EtatAucunVoisin)
	}
	if centre.Reessayable {
		t.Errorf("Reessayable = true, attendu false : un vivier vide n'est pas une panne")
	}
}

func TestSourceEnErreurEstUnePanne(t *testing.T) {
	mb, l := construireCatalogueDeTest(t, mbSuccesDiscographieVide("Portishead"))
	d := Dependances{Catalogue: mb, Proximite: proximiteBouchon{err: errors.New("boum : source indisponible")}, Limiteur: l}

	centre, err := Composer(context.Background(), d, "Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("Composer : %v", err)
	}
	if centre.Etat != EtatPanne {
		t.Fatalf("Etat = %q, attendu %q", centre.Etat, EtatPanne)
	}
	if !centre.Reessayable {
		t.Errorf("Reessayable = false, attendu true : une panne se propose de reessayer")
	}
}

func TestLesDeuxMessagesDifferent(t *testing.T) {
	mbVide, lVide := construireCatalogueDeTest(t, mbSuccesDiscographieVide("Portishead"))
	vide, err := Composer(context.Background(),
		Dependances{Catalogue: mbVide, Proximite: proximiteBouchon{voisins: []source.Voisin{}}, Limiteur: lVide},
		"Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("Composer (vide) : %v", err)
	}

	mbPanne, lPanne := construireCatalogueDeTest(t, mbSuccesDiscographieVide("Portishead"))
	panne, err := Composer(context.Background(),
		Dependances{Catalogue: mbPanne, Proximite: proximiteBouchon{err: errors.New("boum")}, Limiteur: lPanne},
		"Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("Composer (panne) : %v", err)
	}

	if vide.Message == panne.Message {
		t.Fatalf("les deux messages sont identiques : %q", vide.Message)
	}
}

// TestUnEchecNEstJamaisMemorise (F-37) : une premiere requete en panne ne
// doit rien memoriser qui condamnerait la seconde, une fois la source
// retablie. Un vrai adaptateur cache-backed (Last.fm) est utilise ici — une
// simple doublure ne passerait pas par le cache et ne prouverait rien.
func TestUnEchecNEstJamaisMemorise(t *testing.T) {
	mb, l := construireCatalogueDeTest(t, mbSuccesDiscographieVide("Portishead"))

	var appels int32
	lastfmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&appels, 1)
		if n == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Query().Get("method") {
		case "artist.getsimilar":
			fmt.Fprint(w, `{"similarartists":{"artist":[{"name":"Voisin","mbid":"m1","match":"0.9"}]}}`)
		default:
			fmt.Fprint(w, `{"artist":{}}`)
		}
	}))
	t.Cleanup(lastfmSrv.Close)
	lf := source.NouveauLastFM("cle-de-test", cache.Neuf(time.Now), l, lastfmSrv.Client())
	lf.BaseURL = lastfmSrv.URL

	d := Dependances{Catalogue: mb, Proximite: lf, Limiteur: l}

	premier, err := Composer(context.Background(), d, "Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("premier Composer : %v", err)
	}
	if premier.Etat != EtatPanne {
		t.Fatalf("premier appel : Etat = %q, attendu %q", premier.Etat, EtatPanne)
	}

	second, err := Composer(context.Background(), d, "Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err != nil {
		t.Fatalf("second Composer : %v", err)
	}
	if second.Etat != EtatOK {
		t.Fatalf("second appel : Etat = %q, attendu %q (F-37 : l'echec ne doit pas etre memorise)", second.Etat, EtatOK)
	}
}

// TestBudgetRespecteSurUnChargementComplet est le test qui protege N-03.
// Toute regression qui enrichirait les branches par MusicBrainz, ou qui
// ferait partir les extraits avec l'arbre, le fait echouer.
func TestBudgetRespecteSurUnChargementComplet(t *testing.T) {
	const nomArtiste = "Portishead"

	mbSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasPrefix(r.URL.Path, "/ws/2/artist"):
			fmt.Fprintf(w, `{"artists":[{"id":"mbid-centre","name":%q,"score":100}]}`, nomArtiste)
		case strings.HasPrefix(r.URL.Path, "/ws/2/release-group"):
			fmt.Fprint(w, `{"release-groups":[{"id":"rg-1","title":"Album note","primary-type":"Album","secondary-types":[],"rating":{"votes-count":50,"value":4.5}}]}`)
		case strings.HasPrefix(r.URL.Path, "/release-group/"):
			w.Header().Set("Content-Type", "image/jpeg")
			_, _ = w.Write([]byte("image-bidon"))
		default:
			t.Errorf("chemin musicbrainz inattendu : %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(mbSrv.Close)

	lastfmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Query().Get("method") {
		case "artist.getsimilar":
			var voisins []string
			for i := 0; i < 12; i++ {
				voisins = append(voisins, fmt.Sprintf(`{"name":"Voisin%02d","mbid":"m%02d","match":"%.2f"}`, i, i, 1.0-float64(i)*0.05))
			}
			fmt.Fprintf(w, `{"similarartists":{"artist":[%s]}}`, strings.Join(voisins, ","))
		case "artist.getinfo":
			fmt.Fprint(w, `{"artist":{"stats":{"listeners":"1000"},"bio":{"summary":"Bio"},"tags":{"tag":[{"name":"trip-hop"}]}}}`)
		default:
			t.Errorf("methode last.fm inattendue : %s", r.URL.Query().Get("method"))
		}
	}))
	t.Cleanup(lastfmSrv.Close)

	deezerSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query().Get("q")
		fmt.Fprintf(w, `{"data":[{"id":1,"name":%q,"picture_small":"s","picture_medium":"m","picture_big":"b","picture_xl":"xl","nb_fan":10,"link":"https://deezer/artist/1"}]}`, q)
	}))
	t.Cleanup(deezerSrv.Close)

	c := cache.Neuf(time.Now)
	l := budget.Neuf()

	mb := source.NouveauMusicBrainz(c, l, mbSrv.Client(), "ramure-v2-test/1.0")
	mb.BaseURL = mbSrv.URL
	mb.CoverArtBaseURL = mbSrv.URL

	lf := source.NouveauLastFM("cle-de-test", c, l, lastfmSrv.Client())
	lf.BaseURL = lastfmSrv.URL
	lb := source.NouveauListenBrainz(c, l, lastfmSrv.Client())

	dz := source.NouveauDeezer(c, l, deezerSrv.Client())
	dz.BaseURL = deezerSrv.URL

	prox := &source.Cascade{Sources: []source.Proximite{lf, lb}}

	d := Dependances{Catalogue: mb, Proximite: prox, Media: dz, Limiteur: l}

	centre, err := Composer(context.Background(), d, nomArtiste, CadrageLarge, rand.New(rand.NewSource(7)))
	if err != nil {
		t.Fatalf("Composer : %v", err)
	}
	if centre.Etat != EtatOK {
		t.Fatalf("Etat = %q, attendu %q (message %q)", centre.Etat, EtatOK, centre.Message)
	}
	if len(centre.Branches) != 10 {
		t.Fatalf("len(Branches) = %d, attendu 10", len(centre.Branches))
	}

	if got := l.Compte(budget.MusicBrainz); got != 2 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 2", got)
	}
	if got := l.Compte(budget.CoverArt); got > 1 {
		t.Errorf("Compte(CoverArt) = %d, attendu <= 1", got)
	}
	if got := l.Compte(budget.LastFM); got != 2 {
		t.Errorf("Compte(LastFM) = %d, attendu 2", got)
	}
}

func TestReponseTardiveIgnoree(t *testing.T) {
	var appels int32
	mb, l := construireCatalogueDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&appels, 1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"m1","name":"Portishead","score":100}]}`)
	})

	ctx, annuler := context.WithCancel(context.Background())
	annuler()

	d := Dependances{Catalogue: mb, Proximite: proximiteBouchon{}, Limiteur: l}
	_, err := Composer(ctx, d, "Portishead", CadrageLarge, rand.New(rand.NewSource(1)))
	if err == nil {
		t.Fatal("attendu une erreur (contexte annule), obtenu nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("err = %v, attendu context.Canceled", err)
	}
	if n := atomic.LoadInt32(&appels); n != 0 {
		t.Errorf("appels = %d, attendu 0 : le contexte etait deja annule avant tout appel", n)
	}
}
