// apps/ramure-v2/internal/api/fiche_test.go
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type ficheDeTest struct {
	Profil struct {
		Presentation string   `json:"presentation"`
		Genres       []string `json:"genres"`
		Auditeurs    int      `json:"auditeurs"`
	} `json:"profil"`
	Extraits []struct {
		Titre string `json:"titre"`
		URL   string `json:"url"`
		Duree int    `json:"duree"`
	} `json:"extraits"`
	LienEcoute string `json:"lienEcoute"`
}

func dependancesFicheDeTest(t *testing.T, lastfmH, deezerH http.HandlerFunc) arbre.Dependances {
	t.Helper()
	c := cache.Neuf(time.Now)
	l := budget.Neuf()

	lastfmSrv := httptest.NewServer(lastfmH)
	t.Cleanup(lastfmSrv.Close)
	lf := source.NouveauLastFM("cle-de-test", c, l, lastfmSrv.Client())
	lf.BaseURL = lastfmSrv.URL

	deezerSrv := httptest.NewServer(deezerH)
	t.Cleanup(deezerSrv.Close)
	dz := source.NouveauDeezer(c, l, deezerSrv.Client())
	dz.BaseURL = deezerSrv.URL

	// Odesli cable mais jamais interroge par /api/fiche (voir
	// TestOuvrirLaFicheNeCouteAucunAppelOdesli) : un gestionnaire qui ferait
	// echouer le test s'il etait appele rendrait la regression evidente,
	// mais un comptage du limiteur est un garde-fou plus direct et suffit.
	odesliSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"linksByPlatform":{"deezer":{"url":"https://deezer.com/resolu"}}}`)
	}))
	t.Cleanup(odesliSrv.Close)
	od := source.NouveauOdesli(c, l, odesliSrv.Client())
	od.BaseURL = odesliSrv.URL

	return arbre.Dependances{
		Proximite: &source.Cascade{Sources: []source.Proximite{lf}},
		Media:     dz,
		Odesli:    od,
		Limiteur:  l,
	}
}

func lastfmFicheOK(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"artist":{"stats":{"listeners":"42"},"bio":{"summary":"Bio"},"tags":{"tag":[{"name":"trip-hop"}]}}}`)
}

func deezerFicheOK(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.URL.Path == "/search/artist" {
		fmt.Fprint(w, `{"data":[{"id":1,"name":"Portishead","picture_small":"s","picture_medium":"m","picture_big":"b","picture_xl":"xl","nb_fan":1,"link":"https://deezer/artist/1"}]}`)
		return
	}
	fmt.Fprint(w, `{"data":[{"title":"Glory Box","preview":"https://deezer/preview/1.mp3","duration":30}]}`)
}

func TestFicheRendProfilExtraitsEtLienEcoute(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, deezerFicheOK)

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200, corps = %s", rec.Code, rec.Body.String())
	}
	var fiche ficheDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &fiche); err != nil {
		t.Fatalf("decodage : %v (corps = %s)", err, rec.Body.String())
	}
	if fiche.Profil.Presentation != "Bio" {
		t.Errorf("profil.presentation = %q, attendu \"Bio\"", fiche.Profil.Presentation)
	}
	if len(fiche.Extraits) != 1 || fiche.Extraits[0].URL != "https://deezer/preview/1.mp3" {
		t.Fatalf("extraits = %+v", fiche.Extraits)
	}
	if fiche.LienEcoute == "" {
		t.Errorf("lienEcoute est vide, attendu un lien (F-26 : jamais de page vide)")
	}
}

func TestFicheRespecteLeServiceDemande(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, deezerFicheOK)

	recDeezer := httptest.NewRecorder()
	Routes(d).ServeHTTP(recDeezer, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead&service=deezer", nil))
	var ficheDeezer ficheDeTest
	_ = json.Unmarshal(recDeezer.Body.Bytes(), &ficheDeezer)

	recSpotify := httptest.NewRecorder()
	Routes(d).ServeHTTP(recSpotify, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead&service=spotify", nil))
	var ficheSpotify ficheDeTest
	_ = json.Unmarshal(recSpotify.Body.Bytes(), &ficheSpotify)

	if ficheDeezer.LienEcoute == ficheSpotify.LienEcoute {
		t.Errorf("le lien ne change pas selon le service : %q", ficheDeezer.LienEcoute)
	}
}

func TestFicheServiceInconnuRetombeSurLeDefaut(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, deezerFicheOK)

	recDefaut := httptest.NewRecorder()
	Routes(d).ServeHTTP(recDefaut, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead", nil))
	var ficheDefaut ficheDeTest
	_ = json.Unmarshal(recDefaut.Body.Bytes(), &ficheDefaut)

	recInconnu := httptest.NewRecorder()
	Routes(d).ServeHTTP(recInconnu, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead&service=napster", nil))
	var ficheInconnu ficheDeTest
	_ = json.Unmarshal(recInconnu.Body.Bytes(), &ficheInconnu)

	if ficheDefaut.LienEcoute != ficheInconnu.LienEcoute {
		t.Errorf("service inconnu = %q, defaut = %q : attendu la meme valeur (repli)", ficheInconnu.LienEcoute, ficheDefaut.LienEcoute)
	}
}

func TestFicheNomVideEstUneErreurDeRequete(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, deezerFicheOK)

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=", nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, attendu 400", rec.Code)
	}
}

// TestBudgetLOuvertureDeLaFicheNeCouteRienDePlus est le test qui protege
// N-03 pour ce PRP : ouvrir la fiche APRES avoir compose le centre ne doit
// ajouter AUCUN appel MusicBrainz ni Last.fm au-dela des deux deja
// comptes par le chargement du centre (TestBudgetRespecteSurUnChargementComplet,
// internal/arbre) — seuls les extraits, jamais charges avec l'arbre, sont
// un cout reellement nouveau.
func TestBudgetLOuvertureDeLaFicheNeCouteRienDePlus(t *testing.T) {
	d := construireStackDeTest(t, "Portishead", 12)

	recCentre := httptest.NewRecorder()
	Routes(d).ServeHTTP(recCentre, httptest.NewRequest(http.MethodGet, "/api/centre?nom=Portishead", nil))
	if recCentre.Code != http.StatusOK {
		t.Fatalf("code centre = %d, attendu 200, corps = %s", recCentre.Code, recCentre.Body.String())
	}

	avantMB := d.Limiteur.Compte(budget.MusicBrainz)
	avantLastFM := d.Limiteur.Compte(budget.LastFM)
	if avantMB != 2 {
		t.Fatalf("Compte(MusicBrainz) apres /api/centre = %d, attendu 2", avantMB)
	}

	recFiche := httptest.NewRecorder()
	Routes(d).ServeHTTP(recFiche, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead", nil))
	if recFiche.Code != http.StatusOK {
		t.Fatalf("code fiche = %d, attendu 200, corps = %s", recFiche.Code, recFiche.Body.String())
	}

	if got := d.Limiteur.Compte(budget.MusicBrainz); got != avantMB {
		t.Errorf("Compte(MusicBrainz) apres /api/fiche = %d, attendu %d (aucun appel supplementaire)", got, avantMB)
	}
	if got := d.Limiteur.Compte(budget.LastFM); got != avantLastFM {
		t.Errorf("Compte(LastFM) apres /api/fiche = %d, attendu %d (le profil est deja en cache)", got, avantLastFM)
	}
}

// TestOuvrirLaFicheNeCouteAucunAppelOdesli (N-03, PRP 03 tache 6, PRP 06
// tache 3) : Odesli n'est appele QU'AU CLIC, via GET /api/ecouter — jamais
// a l'ouverture de la fiche. Le compteur du limiteur est le juge, pas une
// inspection du corps de la reponse : c'est lui que N-03 engage.
func TestOuvrirLaFicheNeCouteAucunAppelOdesli(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, deezerFicheOK)

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200, corps = %s", rec.Code, rec.Body.String())
	}

	if got := d.Limiteur.Compte(budget.Odesli); got != 0 {
		t.Errorf("Compte(Odesli) apres /api/fiche = %d, attendu 0 (Odesli n'est appele qu'au clic, /api/ecouter)", got)
	}
}

// TestFicheSansExtraitRendUneListeVide (F-40) : un artiste sans extrait
// Deezer disponible n'est pas une panne HTTP, seulement une liste vide —
// c'est au client de desactiver la commande de lecture explicitement.
func TestFicheSansExtraitRendUneListeVide(t *testing.T) {
	d := dependancesFicheDeTest(t, lastfmFicheOK, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/search/artist" {
			fmt.Fprint(w, `{"data":[{"id":1,"name":"Portishead"}]}`)
			return
		}
		fmt.Fprint(w, `{"data":[]}`)
	})

	rec := httptest.NewRecorder()
	Routes(d).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/fiche?nom=Portishead", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, attendu 200", rec.Code)
	}
	var fiche ficheDeTest
	if err := json.Unmarshal(rec.Body.Bytes(), &fiche); err != nil {
		t.Fatalf("decodage : %v", err)
	}
	if len(fiche.Extraits) != 0 {
		t.Fatalf("extraits = %+v, attendu vide", fiche.Extraits)
	}
}
