package main

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func serveurAvecMagasin(t *testing.T) (http.Handler, *Magasin, string, *horlogeTest) {
	t.Helper()
	m, dossier, horloge := magasinDeTest(t)
	return serveurSur(t, m), m, dossier, horloge
}

func serveurSur(t *testing.T, m *Magasin) http.Handler {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	return routes(web, m)
}

func get(t *testing.T, h http.Handler, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, chemin, nil))
	return rec
}

func poster(t *testing.T, h http.Handler, corps string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/fiche", strings.NewReader(corps))
	r.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, r)
	return rec
}

func corpsJSON[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("corps illisible (%d) : %v — %s", rec.Code, err, rec.Body.String())
	}
	return v
}

// --- /healthz -----------------------------------------------------------

func TestSanteRepond200SansToucherLeDisque(t *testing.T) {
	// m == nil : le magasin est indisponible, /healthz doit repondre quand
	// meme (PRP 06, chantier C).
	h := serveurSur(t, nil)
	rec := get(t, h, "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
}

func TestApiFicheIndisponibleSansMagasin(t *testing.T) {
	h := serveurSur(t, nil)
	rec := poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920"}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code %d, attendu 503", rec.Code)
	}
}

// --- Le cycle nominal des trois operations ----------------------------------

func TestCreerSynchroniserEffacer(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)

	rec := poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","prenom":"Alice","semaineDepart":1}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("creer : statut %d, attendu 201 — %s", rec.Code, rec.Body.String())
	}
	fiche := corpsJSON[ficheReponse](t, rec)
	if fiche.Pseudo != "Comete-7" || fiche.Prenom != "Alice" || fiche.SemaineDepart != 1 {
		t.Errorf("fiche creee inattendue : %+v", fiche)
	}
	// Ni le sel ni l'empreinte du code ne repartent jamais vers le client.
	for _, champ := range []string{"codeSel", "codeHash", "iterations"} {
		if strings.Contains(rec.Body.String(), champ) {
			t.Errorf("le corps de la reponse porte %q : %s", champ, rec.Body.String())
		}
	}

	horloge.avancer(time.Minute)
	rec = poster(t, h, `{"operation":"synchroniser","pseudo":"Comete-7","code":"481920","faits":[{"exercice":"s1-1","semaine":1,"seance":1}]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("synchroniser : statut %d, attendu 200 — %s", rec.Code, rec.Body.String())
	}
	fiche = corpsJSON[ficheReponse](t, rec)
	if len(fiche.Faits) != 1 || fiche.Faits[0].Exercice != "s1-1" {
		t.Errorf("fusion inattendue : %+v", fiche.Faits)
	}

	rec = poster(t, h, `{"operation":"effacer","pseudo":"Comete-7","code":"481920"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("effacer : statut %d, attendu 204 — %s", rec.Code, rec.Body.String())
	}
	if rec.Body.Len() != 0 {
		t.Errorf("effacer : corps non vide : %s", rec.Body.String())
	}
}

func TestPseudoDejaPrisRend409(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","semaineDepart":1}`)
	rec := poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"999999","semaineDepart":1}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("statut %d, attendu 409 — %s", rec.Code, rec.Body.String())
	}
}

// TestMauvaisCodeEtPseudonymeInexistantMemeReponseHTTP est le test central du
// PRP 06 : un pseudonyme inexistant et un mauvais code sur un pseudonyme
// existant doivent produire EXACTEMENT la meme reponse, corps et statut
// compris, sans quoi l'API devient un oracle d'existence de pseudonymes.
func TestMauvaisCodeEtPseudonymeInexistantMemeReponseHTTP(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","semaineDepart":1}`)

	recMauvaisCode := poster(t, h, `{"operation":"synchroniser","pseudo":"Comete-7","code":"000000"}`)
	recInexistant := poster(t, h, `{"operation":"synchroniser","pseudo":"Fantome-1","code":"000000"}`)

	if recMauvaisCode.Code != recInexistant.Code {
		t.Fatalf("statuts differents : %d contre %d", recMauvaisCode.Code, recInexistant.Code)
	}
	if recMauvaisCode.Code != http.StatusUnauthorized {
		t.Fatalf("statut %d, attendu 401", recMauvaisCode.Code)
	}
	if recMauvaisCode.Body.String() != recInexistant.Body.String() {
		t.Fatalf("corps differents :\n mauvais code : %s\n inexistant   : %s",
			recMauvaisCode.Body.String(), recInexistant.Body.String())
	}

	// Meme verification pour « effacer », qui emprunte le meme chemin. Un
	// AUTRE pseudonyme existant, jamais interroge plus haut : Comete-7 porte
	// deja un echec, et le comparer maintenant testerait la temporisation, pas
	// l'egalite des deux reponses.
	poster(t, h, `{"operation":"creer","pseudo":"Comete-9","code":"481920","semaineDepart":1}`)
	recMauvaisCode = poster(t, h, `{"operation":"effacer","pseudo":"Comete-9","code":"111111"}`)
	recInexistant = poster(t, h, `{"operation":"effacer","pseudo":"Spectre-2","code":"111111"}`)
	if recMauvaisCode.Code != recInexistant.Code || recMauvaisCode.Body.String() != recInexistant.Body.String() {
		t.Fatalf("effacer : reponses differentes entre mauvais code et pseudonyme inexistant")
	}
}

func TestOperationInconnueRend400(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	rec := poster(t, h, `{"operation":"lister","pseudo":"Comete-7","code":"481920"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut %d, attendu 400", rec.Code)
	}
}

func TestChampInconnuEstRefuseEnBloc(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	rec := poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","email":"a@b.fr"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut %d, attendu 400 — un champ inconnu doit etre refuse en bloc", rec.Code)
	}
}

func TestCorpsTropVolumineuxRend400(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	bourrage := strings.Repeat("x", 300<<10) // > 256 Kio
	rec := poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","prenom":"`+bourrage+`"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut %d, attendu 400", rec.Code)
	}
	env := corpsJSON[enveloppeErreur](t, rec)
	if env.Erreur != "corps-trop-volumineux" {
		t.Errorf("erreur %q, attendu corps-trop-volumineux", env.Erreur)
	}
}

func TestFaitsAuDelaDeLaBorneRend400(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)
	poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","semaineDepart":1}`)
	horloge.avancer(time.Second)

	var faits strings.Builder
	faits.WriteByte('[')
	for i := 0; i <= maxFaits; i++ {
		if i > 0 {
			faits.WriteByte(',')
		}
		faits.WriteString(`{"exercice":"ex-x","semaine":1,"seance":1}`)
	}
	faits.WriteByte(']')

	rec := poster(t, h, `{"operation":"synchroniser","pseudo":"Comete-7","code":"481920","faits":`+faits.String()+`}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut %d, attendu 400 — %s", rec.Code, rec.Body.String())
	}
}

// --- Le fichier ne porte jamais le pseudonyme --------------------------------

func TestFichierDeFicheNePorteJamaisLePseudonyme(t *testing.T) {
	h, _, dossier, _ := serveurAvecMagasin(t)
	rec := poster(t, h, `{"operation":"creer","pseudo":"Renarde-14","code":"481920","semaineDepart":1}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("creer : statut %d — %s", rec.Code, rec.Body.String())
	}

	entrees, err := os.ReadDir(dossier)
	if err != nil {
		t.Fatalf("lecture du dossier : %v", err)
	}
	if len(entrees) == 0 {
		t.Fatal("aucun fichier de fiche cree")
	}
	for _, e := range entrees {
		if strings.Contains(strings.ToLower(e.Name()), "renarde") {
			t.Errorf("le fichier %q laisse deviner le pseudonyme", e.Name())
		}
	}
}

// --- Aucune route ne liste, ne compte ni ne recherche -----------------------

// TestAucuneRouteNeListeNiNeCompteNiNeCherche essaie les chemins qu'un
// annuaire de gymnastes emprunterait ; aucun ne doit exister (PRD §10.4 :
// « il n'y a pas d'operation de liste, pas de recherche, pas de compteur
// global »).
func TestAucuneRouteNeListeNiNeCompteNiNeCherche(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"481920","semaineDepart":1}`)

	chemins := []string{
		"/api/fiche",
		"/api/fiches",
		"/api/liste",
		"/api/comptage",
		"/api/recherche?pseudo=Comete-7",
		"/api/pseudos",
	}
	for _, chemin := range chemins {
		rec := get(t, h, chemin)
		if rec.Code == http.StatusOK {
			t.Errorf("GET %s repond 200 : une route de lecture/liste existe", chemin)
		}
	}
}

// --- La temporisation, vue depuis HTTP (PRP 06, chantier D) -----------------

func TestQuatriemeTentativeHTTPRend429AvecUnDelai(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)
	poster(t, h, `{"operation":"creer","pseudo":"Comete-7","code":"111222","semaineDepart":1}`)

	corpsRefuse := `{"operation":"synchroniser","pseudo":"Comete-7","code":"000000"}`

	rec := poster(t, h, corpsRefuse)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("1er essai : statut %d, attendu 401", rec.Code)
	}
	horloge.avancer(5 * time.Second)
	rec = poster(t, h, corpsRefuse)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("2e essai : statut %d, attendu 401", rec.Code)
	}
	horloge.avancer(15 * time.Second)
	rec = poster(t, h, corpsRefuse)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("3e essai : statut %d, attendu 401", rec.Code)
	}

	// Le 4e essai, sans attendre, tombe dans la meme minute.
	rec = poster(t, h, corpsRefuse)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("4e essai : statut %d, attendu 429 — %s", rec.Code, rec.Body.String())
	}
	env := corpsJSON[enveloppeErreur](t, rec)
	if env.Erreur != "trop-d-essais" || env.AttendreMs <= 0 {
		t.Errorf("corps du 429 inattendu : %+v", env)
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	if code := get(t, h, "/ailleurs").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404", code)
	}
}
