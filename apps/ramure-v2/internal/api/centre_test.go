// apps/ramure-v2/internal/api/centre_test.go
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// reponseCentreDeTest ne decode que ce que ces tests verifient.
type reponseCentreDeTest struct {
	Etat        string        `json:"etat"`
	Reessayable bool          `json:"reessayable"`
	Branches    []interface{} `json:"branches"`
}

// construireStackDeTest cable un jeu complet de sources reelles contre des
// httptest.Server : aucun appel reseau reel (PRD §13). q est echo dans la
// reponse Deezer, ce qui fait reussir la correspondance stricte pour
// n'importe quel nom demande.
func construireStackDeTest(t *testing.T, nomArtiste string, nbVoisins int) arbre.Dependances {
	t.Helper()

	mbSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasPrefix(r.URL.Path, "/ws/2/artist"):
			fmt.Fprintf(w, `{"artists":[{"id":"mbid-1","name":%q,"score":100}]}`, nomArtiste)
		case strings.HasPrefix(r.URL.Path, "/ws/2/release-group"):
			fmt.Fprint(w, `{"release-groups":[]}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(mbSrv.Close)

	lastfmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Query().Get("method") {
		case "artist.getsimilar":
			var voisins []string
			for i := 0; i < nbVoisins; i++ {
				voisins = append(voisins, fmt.Sprintf(`{"name":"Voisin%02d","mbid":"m%02d","match":"%.2f"}`, i, i, 1.0-float64(i)*0.01))
			}
			fmt.Fprintf(w, `{"similarartists":{"artist":[%s]}}`, strings.Join(voisins, ","))
		default:
			fmt.Fprint(w, `{"artist":{}}`)
		}
	}))
	t.Cleanup(lastfmSrv.Close)

	deezerSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query().Get("q")
		fmt.Fprintf(w, `{"data":[{"id":1,"name":%q,"picture_small":"s","picture_medium":"m","picture_big":"b","picture_xl":"xl","nb_fan":1,"link":"https://deezer/artist/1"}]}`, q)
	}))
	t.Cleanup(deezerSrv.Close)

	c := cache.Neuf(time.Now)
	l := budget.Neuf()

	mb := source.NouveauMusicBrainz(c, l, mbSrv.Client(), "ramure-v2-test/1.0")
	mb.BaseURL = mbSrv.URL
	mb.CoverArtBaseURL = mbSrv.URL

	lf := source.NouveauLastFM("cle-de-test", c, l, lastfmSrv.Client())
	lf.BaseURL = lastfmSrv.URL

	dz := source.NouveauDeezer(c, l, deezerSrv.Client())
	dz.BaseURL = deezerSrv.URL

	return arbre.Dependances{
		Catalogue: mb,
		Proximite: &source.Cascade{Sources: []source.Proximite{lf}},
		Media:     dz,
		Limiteur:  l,
	}
}

func TestGraineVideEstUneErreurDeRequete(t *testing.T) {
	d := dependancesDeTest()
	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre?nom=", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", rec.Code)
	}
}

func TestGraineAbsenteEstUneErreurDeRequete(t *testing.T) {
	d := dependancesDeTest()
	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", rec.Code)
	}
}

func TestLargeurInconnueRetombeSurLarge(t *testing.T) {
	d := construireStackDeTest(t, "Portishead", 20)
	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead&largeur=xxl", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200, corps = %s", rec.Code, rec.Body.String())
	}
	var reponse reponseCentreDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
		t.Fatalf("decodage : %v (corps = %s)", err, rec.Body.String())
	}
	if reponse.Etat != "ok" {
		t.Fatalf("etat = %q, attendu \"ok\"", reponse.Etat)
	}
	if len(reponse.Branches) != 10 {
		t.Fatalf("branches = %d, attendu 10 (cadrage large, largeur inconnue)", len(reponse.Branches))
	}
}

// TestCadragePlusEtroitSurEcranEtroit tient le risque « le canevas exige de la
// place » du PRD (tableau des risques, decision §17 « parite stricte ») : sur un
// ecran etroit le serveur rend MOINS de branches et d'heritiers, et c'est LUI
// qui en decide, jamais le client.
//
// Deux sessions ont ecrit ce test le meme jour, chacune a un niveau different :
// l'une sur cadragePour, l'autre a travers la route HTTP. Les deux comptent et
// ne prouvent pas la meme chose — la premiere que le cadrage est bien plus
// etroit, la seconde que le parametre de largeur ATTEINT reellement la
// selection. La resolution les garde toutes les deux.
//
// Aucun nombre en dur, dans aucune des deux : figer « 6 branches » casse au
// premier ajustement produit sans avoir rien protege, alors que la propriete
// « plus etroit sur ecran etroit » doit tenir pour toujours. Le niveau HTTP se
// compare donc a cadragePour, et non a un litteral.
func TestCadragePlusEtroitSurEcranEtroit(t *testing.T) {
	etroit := cadragePour("etroit")

	t.Run("moins de branches que le cadrage large", func(t *testing.T) {
		for _, largeur := range []string{"large", ""} {
			large := cadragePour(largeur)
			if etroit.Branches >= large.Branches {
				t.Errorf("largeur=%q : branches etroit=%d, large=%d ; attendu etroit strictement < large", largeur, etroit.Branches, large.Branches)
			}
		}
	})

	t.Run("moins d'heritiers par branche que le cadrage large", func(t *testing.T) {
		for _, largeur := range []string{"large", ""} {
			large := cadragePour(largeur)
			if etroit.Heritiers >= large.Heritiers {
				t.Errorf("largeur=%q : heritiers etroit=%d, large=%d ; attendu etroit strictement < large", largeur, etroit.Heritiers, large.Heritiers)
			}
		}
	})

	// Le niveau HTTP : le parametre de largeur atteint-il vraiment la selection ?
	// Un cadrage juste que la route n'utiliserait pas laisserait les deux
	// sous-tests ci-dessus au vert sur un produit casse.
	t.Run("la route rend le nombre de branches du cadrage demande", func(t *testing.T) {
		for _, cas := range []struct {
			largeur string
			attendu int
		}{
			{"etroit", etroit.Branches},
			{"large", cadragePour("large").Branches},
		} {
			d := construireStackDeTest(t, "Portishead", 20)
			rec := httptest.NewRecorder()
			Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead&largeur="+cas.largeur, nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("largeur=%q : code = %d, attendu 200, corps = %s", cas.largeur, rec.Code, rec.Body.String())
			}
			var reponse reponseCentreDeTest
			if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
				t.Fatalf("largeur=%q : decodage : %v (corps = %s)", cas.largeur, err, rec.Body.String())
			}
			if len(reponse.Branches) != cas.attendu {
				t.Errorf("largeur=%q : branches rendues = %d, attendu %d (celui de cadragePour)", cas.largeur, len(reponse.Branches), cas.attendu)
			}
		}
	})

	// Repli documente par le commentaire de cadragePour : une largeur inconnue
	// ne panique jamais et retombe sur le cadrage large -- un comportement
	// promis, pas un detail d'implementation. TestLargeurInconnueRetombeSurLarge
	// le tient deja a travers la route ; ici on couvre la CASSE, qu'il ne voit
	// pas : « ETROIT » ne doit pas etre confondu avec « etroit ».
	t.Run("une largeur inconnue retombe sur le cadrage large sans paniquer", func(t *testing.T) {
		large := cadragePour("large")
		for _, largeur := range []string{"", "xxl", "grand", "ETROIT", "moyen"} {
			if got := cadragePour(largeur); got != large {
				t.Errorf("cadragePour(%q) = %+v, attendu le cadrage large %+v", largeur, got, large)
			}
		}
	})
}

func TestArtisteSansVoisinsRepond200(t *testing.T) {
	d := construireStackDeTest(t, "Portishead", 0)
	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200 (un vivier vide n'est pas une erreur HTTP)", rec.Code)
	}
	var reponse reponseCentreDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Etat != "aucun_voisin" {
		t.Fatalf("etat = %q, attendu \"aucun_voisin\"", reponse.Etat)
	}
	if reponse.Reessayable {
		t.Errorf("reessayable = true, attendu false")
	}
}

func TestSourceEnPanneRepond503(t *testing.T) {
	mbSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.HasPrefix(r.URL.Path, "/ws/2/artist") {
			fmt.Fprint(w, `{"artists":[{"id":"mbid-1","name":"Portishead","score":100}]}`)
			return
		}
		fmt.Fprint(w, `{"release-groups":[]}`)
	}))
	t.Cleanup(mbSrv.Close)

	// Last.fm repond toujours 500 : le vivier echoue reellement, ce n'est
	// pas une simple absence de resultat.
	lastfmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(lastfmSrv.Close)

	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	mb := source.NouveauMusicBrainz(c, l, mbSrv.Client(), "ramure-v2-test/1.0")
	mb.BaseURL = mbSrv.URL
	mb.CoverArtBaseURL = mbSrv.URL

	lf := source.NouveauLastFM("cle-de-test", c, l, lastfmSrv.Client())
	lf.BaseURL = lastfmSrv.URL

	d := arbre.Dependances{Catalogue: mb, Proximite: &source.Cascade{Sources: []source.Proximite{lf}}, Limiteur: l}

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, attendu 503, corps = %s", rec.Code, rec.Body.String())
	}
	var reponse reponseCentreDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &reponse); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if reponse.Etat != "panne" {
		t.Fatalf("etat = %q, attendu \"panne\"", reponse.Etat)
	}
	if !reponse.Reessayable {
		t.Errorf("reessayable = false, attendu true")
	}
}

// TestReponseTardiveIgnoree (§09) : un contexte annule pendant le
// chargement ne doit produire AUCUNE ecriture dans la reponse.
func TestReponseTardiveIgnoree(t *testing.T) {
	var appels int32
	mbSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&appels, 1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"artists":[{"id":"mbid-1","name":"Portishead","score":100}]}`)
	}))
	t.Cleanup(mbSrv.Close)

	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	mb := source.NouveauMusicBrainz(c, l, mbSrv.Client(), "ramure-v2-test/1.0")
	mb.BaseURL = mbSrv.URL
	mb.CoverArtBaseURL = mbSrv.URL

	d := arbre.Dependances{Catalogue: mb, Proximite: &source.Cascade{}, Limiteur: l}

	ctx, annuler := context.WithCancel(context.Background())
	annuler()

	req := httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, req)

	if rec.Body.Len() != 0 {
		t.Fatalf("corps = %q, attendu vide (rien ecrit sur un contexte deja annule)", rec.Body.String())
	}
	if n := atomic.LoadInt32(&appels); n != 0 {
		t.Errorf("appels musicbrainz = %d, attendu 0", n)
	}
}
