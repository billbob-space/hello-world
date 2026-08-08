package main

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// serveurAvecMagasin monte le VRAI routes() sur un magasin de test. Jamais un
// ServeMux reconstruit ici : une route ajoutee a main.go et oubliee dans le
// test passerait alors inapercue.
func serveurAvecMagasin(t *testing.T) (http.Handler, *classement, string, *horlogeTest) {
	t.Helper()
	cl, dossier, h := magasinDeTest(t)
	return serveurSur(t, cl), cl, dossier, h
}

func serveurSur(t *testing.T, cl *classement) http.Handler {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	sw, err := chargerServiceWorker(web)
	if err != nil {
		t.Fatalf("service worker illisible : %v", err)
	}
	return routes(web, sw, cl, nil)
}

func poster(t *testing.T, h http.Handler, corps string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/classement", strings.NewReader(corps))
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

func exigerErreur(t *testing.T, rec *httptest.ResponseRecorder, statut int, code string) {
	t.Helper()
	if rec.Code != statut {
		t.Errorf("statut %d, attendu %d — corps %s", rec.Code, statut, rec.Body.String())
	}
	env := corpsJSON[enveloppeErreur](t, rec)
	if env.Erreur != code {
		t.Errorf("erreur %q, attendu %q", env.Erreur, code)
	}
	if env.Message == "" {
		t.Errorf("erreur %q sans message : le PRP 08 affiche ce texte tel quel", code)
	}
}

// --- Les trois routes en cas nominal --------------------------------------

func TestLesTroisRoutesEnCasNominal(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)

	rec := poster(t, h, `{"pseudo":"Renard","code":"4821","faits":["s1-c1","s1-c2"]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("creation : statut %d, attendu 201 — %s", rec.Code, rec.Body.String())
	}
	envoi := corpsJSON[reponseEnvoi](t, rec)
	if envoi.Pseudo != "Renard" || envoi.Rang != 1 || envoi.Cochees != 2 {
		t.Errorf("reponse d'envoi : %+v", envoi)
	}

	// Le meme pseudonyme, le meme code : 200 et non 201.
	horloge.avancer(time.Minute)
	rec = poster(t, h, `{"pseudo":"Renard","code":"4821","faits":["s1-c1"]}`)
	if rec.Code != http.StatusOK {
		t.Errorf("mise a jour : statut %d, attendu 200", rec.Code)
	}

	rec = get(t, h, "/api/classement")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/classement : statut %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
	// Un classement mis en cache est un classement faux.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
		t.Errorf("Cache-Control = %q, attendu no-store", cc)
	}
	// Toutes les reponses portent X-App-Version, via withVersion du PRP 01.
	if rec.Header().Get("X-App-Version") == "" {
		t.Error("X-App-Version absent")
	}
	cl := corpsJSON[reponseClassement](t, rec)
	if cl.Jour == "" || cl.Participants != 1 || len(cl.Classement) != 1 {
		t.Errorf("classement : %+v", cl)
	}

	rec = get(t, h, "/api/coach")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/coach : statut %d", rec.Code)
	}
	// Le champ anonyme aplatit reponseClassement : le coach lit les memes cles.
	var brut map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &brut); err != nil {
		t.Fatal(err)
	}
	for _, cle := range []string{"jour", "programmees", "participants", "classement", "groupe", "assiduite", "seances", "ressentis"} {
		if _, present := brut[cle]; !present {
			t.Errorf("/api/coach : cle %q absente", cle)
		}
	}
}

func TestSeulLePodiumNommeSurLaRoute(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)

	scores := [][]string{
		{"s1-c1", "s1-c2", "s1-r1", "s1-r2"},
		{"s1-c1", "s1-c2", "s1-r1"},
		{"s1-c1", "s1-c2"},
		{"s1-c1"},
	}
	for i, faits := range scores {
		liste, _ := json.Marshal(faits)
		rec := poster(t, h, `{"pseudo":"Enfant`+string(rune('A'+i))+`","code":"1234","faits":`+string(liste)+`}`)
		if rec.Code != http.StatusCreated {
			t.Fatalf("envoi %d : statut %d — %s", i, rec.Code, rec.Body.String())
		}
		horloge.avancer(time.Minute)
	}

	cl := corpsJSON[reponseClassement](t, get(t, h, "/api/classement"))
	if len(cl.Classement) != 4 {
		t.Fatalf("%d lignes, attendu 4", len(cl.Classement))
	}
	for i, l := range cl.Classement {
		if i < 3 && l.Pseudo == "" {
			t.Errorf("ligne %d : le podium doit nommer", i+1)
		}
		if i >= 3 && l.Pseudo != "" {
			t.Errorf("ligne %d : %q ne devrait pas transiter", i+1, l.Pseudo)
		}
	}

	// Le quatrieme nom n'est nulle part dans le corps, pas meme ailleurs.
	if strings.Contains(get(t, h, "/api/classement").Body.String(), "EnfantD") {
		t.Error("le nom du quatrieme transite malgre tout")
	}
}

// --- Le tableau des erreurs -----------------------------------------------

func TestLeTableauDesErreurs(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)

	// Le pseudonyme existe deja, pour les cas qui en dependent.
	if rec := poster(t, h, `{"pseudo":"Renard","code":"4821","faits":[]}`); rec.Code != http.StatusCreated {
		t.Fatalf("preparation : statut %d", rec.Code)
	}

	cas := []struct {
		nom    string
		corps  string
		statut int
		code   string
	}{
		{"corps illisible", `{`, 400, "json-invalide"},
		{"corps vide", ``, 400, "json-invalide"},
		{"champ inconnu", `{"pseudo":"Loup","code":"1111","faits":[],"prenom":"Lucas"}`, 400, "json-invalide"},
		{"deux objets concatenes", `{"pseudo":"Loup","code":"1111","faits":[]}{"pseudo":"Loup"}`, 400, "json-invalide"},
		{"pseudo vide", `{"pseudo":"","code":"1111","faits":[]}`, 400, "pseudo-invalide"},
		{"pseudo trop long", `{"pseudo":"dix-sept-caracter","code":"1111","faits":[]}`, 400, "pseudo-invalide"},
		{"pseudo caractere refuse", `{"pseudo":"Loup!","code":"1111","faits":[]}`, 400, "pseudo-invalide"},
		{"code trop court", `{"pseudo":"Loup","code":"111","faits":[]}`, 400, "code-invalide"},
		{"code non numerique", `{"pseudo":"Loup","code":"abcd","faits":[]}`, 400, "code-invalide"},
		{"faits absent", `{"pseudo":"Loup","code":"1111"}`, 400, "faits-invalide"},
		{"faits non tableau", `{"pseudo":"Loup","code":"1111","faits":"s1-c1"}`, 400, "json-invalide"},
		{"ressentis mal forme", `{"pseudo":"Loup","code":"1111","faits":[],"ressentis":{"2026-01-01":"dur"}}`, 400, "ressentis-invalide"},
		{"code different", `{"pseudo":"Renard","code":"0000","faits":[]}`, 403, "code-refuse"},
	}

	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			exigerErreur(t, poster(t, h, c.corps), c.statut, c.code)
		})
	}
}

func TestSixEnvoisFermentLePseudonymeAvecRetryAfter(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	poster(t, h, `{"pseudo":"Renard","code":"4821","faits":[]}`)

	mauvais := `{"pseudo":"Renard","code":"0000","faits":[]}`
	for i := 1; i <= maxRefus; i++ {
		if rec := poster(t, h, mauvais); rec.Code != http.StatusForbidden {
			t.Fatalf("essai %d : statut %d, attendu 403", i, rec.Code)
		}
	}
	rec := poster(t, h, mauvais)
	exigerErreur(t, rec, http.StatusTooManyRequests, "trop-d-essais")
	if ra := rec.Header().Get("Retry-After"); ra != "900" {
		t.Errorf("Retry-After = %q, attendu 900", ra)
	}
}

func TestLeGelRendUn409SurLaRoute(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)
	poster(t, h, `{"pseudo":"Renard","code":"4821","faits":["s1-c1"]}`)

	// Apres le 21 aout, l'horloge du serveur passe le programme en revue close.
	horloge.avancer(20 * 24 * time.Hour)
	exigerErreur(t, poster(t, h, `{"pseudo":"Renard","code":"4821","faits":["s1-c1"]}`),
		http.StatusConflict, "classement-fige")

	// La suppression, elle, reste honoree : le gel protege le rang, pas le
	// droit du PRD §14.
	rec := poster(t, h, `{"pseudo":"Renard","code":"4821","supprimer":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("suppression apres le gel : statut %d — %s", rec.Code, rec.Body.String())
	}
	if !corpsJSON[reponseSuppression](t, rec).Supprime {
		t.Error("la suppression apres le gel n'a rien efface")
	}
}

func TestLe201ePseudonymeRend409(t *testing.T) {
	h, cl, _, _ := serveurAvecMagasin(t)

	// Le magasin est rempli DIRECTEMENT : deriver 200 empreintes pbkdf2 par le
	// reseau couterait dix secondes pour verifier une table de statuts.
	// classement_test.go couvre deja le plafond par le chemin normal.
	cl.mu.Lock()
	for i := range maxParticipants {
		cle := "occupe" + string(rune('a'+i%26)) + string(rune('a'+i/26))
		cl.parCle[cle] = &participant{Pseudo: cle, Cle: cle, Faits: map[string]string{}}
	}
	cl.mu.Unlock()

	exigerErreur(t, poster(t, h, `{"pseudo":"Tardif","code":"1234","faits":[]}`),
		http.StatusConflict, "classement-plein")
}

// --- La charge utile hostile ----------------------------------------------

func TestUnCorpsDe64KioRend400(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	gros := `{"pseudo":"Renard","code":"4821","faits":["` + strings.Repeat("a", 64<<10) + `"]}`
	// 400 et jamais 500 : la coupure de MaxBytesReader remonte un
	// *http.MaxBytesError, reconnu par errors.As.
	exigerErreur(t, poster(t, h, gros), http.StatusBadRequest, "json-invalide")
}

func TestUnChampInconnuNAtteintJamaisLeDisque(t *testing.T) {
	h, _, dossier, _ := serveurAvecMagasin(t)

	// Le corps est refuse EN BLOC : la valeur n'est ni decodee, ni stockee, ni
	// tracee. C'est la forme de l'API qui rend impossible — et pas seulement
	// deconseille — qu'un prenom atteigne ce serveur (PRD §5).
	exigerErreur(t, poster(t, h, `{"pseudo":"Renard","code":"4821","faits":[],"prenom":"Lucas"}`),
		http.StatusBadRequest, "json-invalide")

	if _, err := os.Stat(filepath.Join(dossier, nomFichier)); err == nil {
		if strings.Contains(lireFichier(t, dossier), "Lucas") {
			t.Error("la valeur refusee a atteint le disque")
		}
	}
}

func TestUnPseudonymeDe10000CaracteresNEstPasRepete(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	enorme := strings.Repeat("R", 10000)

	rec := poster(t, h, `{"pseudo":"`+enorme+`","code":"4821","faits":[]}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("statut %d, attendu 400", rec.Code)
	}
	// Un message d'erreur qui renvoie l'entree refusee est un point d'injection
	// dans les journaux.
	if strings.Contains(rec.Body.String(), strings.Repeat("R", 20)) {
		t.Error("le message repete l'entree refusee")
	}
}

// --- La suppression, vue de la route --------------------------------------

func TestLaSuppressionSurLaRoute(t *testing.T) {
	h, _, dossier, horloge := serveurAvecMagasin(t)

	poster(t, h, `{"pseudo":"Renard","code":"4821","faits":["s1-c1","s1-c2"]}`)
	horloge.avancer(time.Minute)
	poster(t, h, `{"pseudo":"Bibou","code":"1111","faits":["s1-c1"]}`)
	horloge.avancer(time.Minute)
	poster(t, h, `{"pseudo":"K7","code":"2222","faits":["s1-c1"]}`)

	// Un code refuse n'efface rien.
	exigerErreur(t, poster(t, h, `{"pseudo":"Renard","code":"0000","supprimer":true}`),
		http.StatusForbidden, "code-refuse")
	if corpsJSON[reponseClassement](t, get(t, h, "/api/classement")).Participants != 3 {
		t.Fatal("la fiche a disparu malgre un code refuse")
	}

	rec := poster(t, h, `{"pseudo":"Renard","code":"4821","supprimer":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("suppression : statut %d, attendu 200", rec.Code)
	}
	sup := corpsJSON[reponseSuppression](t, rec)
	if !sup.Supprime || sup.Participants != 2 {
		t.Errorf("suppression : %+v, attendu supprime=true participants=2", sup)
	}

	// Rejouee : 200 et supprime=false, jamais une erreur.
	rec = poster(t, h, `{"pseudo":"Renard","code":"4821","supprimer":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("suppression rejouee : statut %d, attendu 200", rec.Code)
	}
	if sup := corpsJSON[reponseSuppression](t, rec); sup.Supprime || sup.Participants != 2 {
		t.Errorf("suppression rejouee : %+v, attendu supprime=false participants=2", sup)
	}

	// Les deux fiches restantes ont une case chacune : elles sont ex aequo, donc
	// toutes deux 1res. Et le nom a quitte le fichier.
	cl := corpsJSON[reponseClassement](t, get(t, h, "/api/classement"))
	for i, l := range cl.Classement {
		if l.Rang != 1 {
			t.Errorf("ligne %d : rang %d, attendu 1 — les deux restants sont a egalite", i, l.Rang)
		}
		if l.Pseudo == "Renard" {
			t.Error("Renard est encore au classement")
		}
	}
	if strings.Contains(lireFichier(t, dossier), "Renard") {
		t.Error("le fichier porte encore Renard")
	}
}

// --- Le magasin absent ----------------------------------------------------

func TestSansMagasinLesTroisRoutesRepondent503(t *testing.T) {
	h := serveurSur(t, nil)

	for _, cas := range []struct{ methode, chemin string }{
		{http.MethodGet, "/api/classement"},
		{http.MethodGet, "/api/coach"},
	} {
		rec := get(t, h, cas.chemin)
		exigerErreur(t, rec, http.StatusServiceUnavailable, "classement-indisponible")
		if ra := rec.Header().Get("Retry-After"); ra != "60" {
			t.Errorf("%s : Retry-After = %q, attendu 60", cas.chemin, ra)
		}
	}

	exigerErreur(t, poster(t, h, `{"pseudo":"Renard","code":"4821","faits":[]}`),
		http.StatusServiceUnavailable, "classement-indisponible")
	// Une suppression aussi : cl == nil est un etat, pas une exception.
	exigerErreur(t, poster(t, h, `{"pseudo":"Renard","code":"4821","supprimer":true}`),
		http.StatusServiceUnavailable, "classement-indisponible")

	// Pendant ce temps, l'application du lot 1 sert normalement.
	if rec := get(t, h, "/healthz"); rec.Code != http.StatusOK {
		t.Errorf("/healthz : statut %d, attendu 200", rec.Code)
	}
	if rec := get(t, h, "/"); rec.Code != http.StatusOK {
		t.Errorf("GET / : statut %d, attendu 200", rec.Code)
	}
}

// Le 405 vient de http.ServeMux et ne porte PAS l'enveloppe JSON : c'est le
// comportement de la bibliotheque standard, conserve tel quel. Le PRP 08 ne
// doit donc decoder l'enveloppe que si le Content-Type est du JSON.
func TestLaMethodeInterditeRendUn405SansEnveloppe(t *testing.T) {
	h, _, _, _ := serveurAvecMagasin(t)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/coach", strings.NewReader("{}")))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("statut %d, attendu 405", rec.Code)
	}
	if allow := rec.Header().Get("Allow"); allow == "" {
		t.Error("Allow absent du 405")
	}
	if strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Error("le 405 se presente comme du JSON")
	}
}

// Chaque sentinelle du magasin a un statut ET un message. Sans ce test, une
// erreur ajoutee plus tard tomberait silencieusement en 500 avec un corps vide.
func TestChaqueSentinelleEstTraduite(t *testing.T) {
	sentinelles := []error{
		errPseudoInvalide, errCodeInvalide, errFaitsInvalide, errRessentisInvalide,
		errCodeRefuse, errTropDEssais, errClassementPlein, errClassementFige,
	}
	for _, err := range sentinelles {
		code := err.Error()
		if _, connu := statuts[code]; !connu {
			t.Errorf("%q n'a pas de statut HTTP", code)
		}
		if messages[code] == "" {
			t.Errorf("%q n'a pas de message francais", code)
		}
	}
	for _, code := range []string{"json-invalide", "classement-indisponible"} {
		if _, connu := statuts[code]; !connu || messages[code] == "" {
			t.Errorf("%q incomplet dans les tables", code)
		}
	}
}

// La reponse du coach n'expose rien de plus que la page publique : aucun nom
// au-dela du podium, aucun horodatage, aucune empreinte.
func TestLaRouteCoachNExposeRienDePlus(t *testing.T) {
	h, _, _, horloge := serveurAvecMagasin(t)
	// Quatre scores DIFFERENTS, donc quatre marches : le podium en nomme trois,
	// et le quatrieme reste anonyme. A egalite, ils seraient tous les quatre
	// nommes sur la meme marche — c'est la regle, pas une fuite.
	for i, pseudo := range []string{"Un", "Deux", "Trois", "Quatre"} {
		faits, _ := json.Marshal([]string{"s1-c1", "s1-c2", "s1-r1", "s1-r2"}[:4-i])
		poster(t, h, `{"pseudo":"`+pseudo+`","code":"111`+string(rune('1'+i))+`","faits":`+string(faits)+`}`)
		horloge.avancer(time.Minute)
	}

	corps := get(t, h, "/api/coach").Body.String()
	if strings.Contains(corps, "Quatre") {
		t.Error("le coach voit le nom du quatrieme")
	}
	for _, interdit := range []string{"sel", "empreinte", "iterations", "creeLe", "vuLe", "cle"} {
		if strings.Contains(corps, `"`+interdit+`"`) {
			t.Errorf("/api/coach expose %q", interdit)
		}
	}
}
