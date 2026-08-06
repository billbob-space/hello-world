package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func newServeur(t *testing.T) http.Handler {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	sw, err := chargerServiceWorker(web)
	if err != nil {
		t.Fatalf("service worker illisible : %v", err)
	}
	return routes(web, sw)
}

func get(t *testing.T, h http.Handler, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, chemin, nil))
	return rec
}

func TestSanteRepond200(t *testing.T) {
	rec := get(t, newServeur(t), "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("corps %q, attendu \"ok\"", rec.Body.String())
	}
}

// La coque est servie a la racine : c'est ce dont depend la portee du service
// worker. Servie sous /web/, elle ne pourrait pas prendre en charge /.
func TestRacineSertLaCoque(t *testing.T) {
	rec := get(t, newServeur(t), "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type %q, attendu text/html", ct)
	}
	if !strings.Contains(rec.Body.String(), "sw.js") {
		t.Error("la coque n'enregistre pas le service worker")
	}
}

func TestStyleServiDepuisLaRacine(t *testing.T) {
	rec := get(t, newServeur(t), "/style.css")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/css") {
		t.Errorf("Content-Type %q, attendu text/css", ct)
	}
}

// Le nom du cache du navigateur derive de cette valeur. Si le jeton sortait tel
// quel, toutes les versions partageraient le meme cache et un deploiement ne
// changerait rien a l'ecran.
func TestServiceWorkerPorteLaVersionDuBinaire(t *testing.T) {
	original := version
	t.Cleanup(func() { version = original })
	version = "abcdef1234567890"

	rec := get(t, newServeur(t), "/sw.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	corps := rec.Body.String()
	if strings.Contains(corps, jetonVersion) {
		t.Errorf("le jeton %s est sorti tel quel : le cache ne serait pas versionne", jetonVersion)
	}
	if !strings.Contains(corps, version) {
		t.Errorf("la version %q est absente du service worker servi", version)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/javascript") {
		t.Errorf("Content-Type %q, attendu application/javascript", ct)
	}
	// Un service worker mis en cache par le navigateur retarderait d'autant la
	// prise en main de la version deployee.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control %q, attendu no-cache", cc)
	}
}

// Sans jeton, le demarrage doit echouer bruyamment : un cache non versionne ne
// se manifeste que sur le telephone de quelqu'un d'autre, des semaines apres.
func TestServiceWorkerSansJetonRefuseDeDemarrer(t *testing.T) {
	fige := fstest.MapFS{"sw.js": &fstest.MapFile{Data: []byte("const VERSION = 'fige';")}}
	if _, err := chargerServiceWorker(fige); err == nil {
		t.Error("un sw.js sans jeton a ete accepte")
	}
	if _, err := chargerServiceWorker(fstest.MapFS{}); err == nil {
		t.Error("un sw.js absent a ete accepte")
	}
}

// Le programme est une donnee, pas du code : le navigateur la relit a chaque
// chargement, et le lot 2 la relira cote serveur pour recalculer un rang avec sa
// propre horloge. D'ou le no-cache — une seance ajoutee par le coach doit
// arriver au rechargement suivant, pas au prochain deploiement.
func TestProgrammeJSONEstServi(t *testing.T) {
	rec := get(t, newServeur(t), "/programme.json")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type %q, attendu application/json", ct)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control %q, attendu no-cache", cc)
	}
	if !strings.Contains(rec.Body.String(), `"s1-c1"`) {
		t.Error("le programme servi ne porte pas le premier identifiant d'exercice")
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	if code := get(t, newServeur(t), "/ailleurs").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404", code)
	}
}

// Les tests du navigateur ne doivent jamais atterrir dans l'image, et encore
// moins etre servis : go:embed web les laisse dehors, cette assertion le fige.
func TestLesTestsNeSontPasServis(t *testing.T) {
	if code := get(t, newServeur(t), "/tests/coque.test.js").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404 : tests/ n'a rien a faire dans l'image", code)
	}
}

// L'en-tete porte la meme verite que l'ecran : verifier un deploiement ne
// demande pas d'ouvrir la page.
func TestEnteteVersionSurToutesLesReponses(t *testing.T) {
	h := newServeur(t)
	for _, chemin := range []string{"/", "/healthz", "/sw.js", "/style.css", "/inconnu"} {
		if v := get(t, h, chemin).Header().Get("X-App-Version"); v != version {
			t.Errorf("%s : X-App-Version %q, attendu %q", chemin, v, version)
		}
	}
}
