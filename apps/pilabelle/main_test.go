package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func poster(t *testing.T, h http.Handler, methode, chemin, email string, corps any) *httptest.ResponseRecorder {
	t.Helper()
	var lecteur *bytes.Reader
	if corps != nil {
		brut, err := json.Marshal(corps)
		if err != nil {
			t.Fatal(err)
		}
		lecteur = bytes.NewReader(brut)
	} else {
		lecteur = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(methode, chemin, lecteur)
	r.Header.Set("X-Forwarded-User", email)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestSante(t *testing.T) {
	r := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "").ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("healthz = %d, attendu 200", w.Code)
	}
}

func TestIdentiteExigeeSurAPI(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "").ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("sans X-Forwarded-User: %d, attendu 400", w.Code)
	}
}

func TestPageAttente(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "").ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("/ = %d, attendu 200", w.Code)
	}
	if v := w.Header().Get("X-App-Version"); v == "" {
		t.Fatalf("X-App-Version absent")
	}
}

func TestProfilAbsent(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/profil", nil)
	r.Header.Set("X-Forwarded-User", "test@example.com")
	w := httptest.NewRecorder()
	routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "").ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("profil absent: %d, attendu 404", w.Code)
	}
}

func reponsesDeTest() Reponses {
	return Reponses{NiveauDepart: "debutante", JoursActifs: []string{"lundi", "mercredi"}}
}

func messagesDeTest() Messages {
	m := Messages{}
	m.Piques.UnJour = []string{"un jour de test"}
	m.Piques.QuelquesJours = []string{"quelques jours de test"}
	m.Piques.UneSemaineOuPlus = []string{"une semaine de test"}
	m.Encouragements = []string{"bravo de test"}
	m.MotsDoux = []string{"mot doux de test"}
	return m
}

func defisDeTest() []DefiCatalogue {
	return []DefiCatalogue{
		{ID: "d-toutes-1", Titre: "toutes 1 de test", Type: DefiToutesLesSeancesActives},
		{ID: "d-toutes-2", Titre: "toutes 2 de test", Type: DefiToutesLesSeancesActives},
		{ID: "d-facile-1", Titre: "facile 1 de test", Type: DefiRessentiFacileX2},
		{ID: "d-facile-2", Titre: "facile 2 de test", Type: DefiRessentiFacileX2},
	}
}

func TestCreerProfil(t *testing.T) {
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "")
	w := poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	if w.Code != http.StatusCreated {
		t.Fatalf("creation: %d, attendu 201 — corps: %s", w.Code, w.Body.String())
	}
	var p Profil
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.Niveaux.Ventre != 1 || p.Niveaux.Cuisses != 1 {
		t.Fatalf("niveaux initiaux = %+v, attendu 1/1 pour une debutante", p.Niveaux)
	}
}

func TestCreerProfilDeuxFoisRefuse(t *testing.T) {
	racine := t.TempDir()
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), racine, "")
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	w := poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	if w.Code != http.StatusConflict {
		t.Fatalf("seconde creation: %d, attendu 409", w.Code)
	}
}

func TestReglagesNeTouchentPasNiveauxHistoriqueSerie(t *testing.T) {
	racine := t.TempDir()
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), racine, "")
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())

	// Simule une progression deja ecrite (comme le ferait PRP 05).
	avant, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	avant.Niveaux = Niveaux{Ventre: 3, Cuisses: 2}
	avant.Serie = Serie{Actuelle: 5, Record: 5}
	avant.Historique = []HistoriqueEntree{{Date: "2026-08-07", Ressenti: RessentiCorrect}}
	if err := EcrireProfil(racine, "test@example.com", avant); err != nil {
		t.Fatal(err)
	}

	nouvellesReponses := Reponses{NiveauDepart: "a_deja_pratique", JoursActifs: []string{"samedi"}}
	w := poster(t, h, "PUT", "/api/profil", "test@example.com", nouvellesReponses)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}

	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if apres.Niveaux != (Niveaux{Ventre: 3, Cuisses: 2}) {
		t.Fatalf("niveaux modifies par un PUT: %+v", apres.Niveaux)
	}
	if apres.Serie != (Serie{Actuelle: 5, Record: 5}) {
		t.Fatalf("serie modifiee par un PUT: %+v", apres.Serie)
	}
	if len(apres.Historique) != 1 {
		t.Fatalf("historique modifie par un PUT: %+v", apres.Historique)
	}
	if apres.Reponses.NiveauDepart != "a_deja_pratique" {
		t.Fatalf("reponses non mises a jour: %+v", apres.Reponses)
	}
}

func TestJourRepos(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	// Aucun jour actif declare : quel que soit "aujourd'hui", c'est repos.
	if err := EcrireProfil(racine, "test@example.com", Profil{Reponses: Reponses{JoursActifs: nil}}); err != nil {
		t.Fatal(err)
	}
	w := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/jour: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var reponse struct {
		Cas Cas `json:"cas"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reponse); err != nil {
		t.Fatal(err)
	}
	if reponse.Cas != CasRepos {
		t.Fatalf("cas = %s, attendu repos", reponse.Cas)
	}
}

func TestJourAFaireDeuxAppelsIdempotents(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}); err != nil {
		t.Fatal(err)
	}
	var premiere, seconde struct {
		Cas    Cas     `json:"cas"`
		Seance *Seance `json:"seance"`
	}
	w1 := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if err := json.Unmarshal(w1.Body.Bytes(), &premiere); err != nil {
		t.Fatal(err)
	}
	w2 := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if err := json.Unmarshal(w2.Body.Bytes(), &seconde); err != nil {
		t.Fatal(err)
	}
	if premiere.Cas != CasAFaire || seconde.Cas != CasAFaire {
		t.Fatalf("cas = %s / %s, attendu a-faire / a-faire", premiere.Cas, seconde.Cas)
	}
	if premiere.Seance.Blocs[1].Exercices[0].ID != seconde.Seance.Blocs[1].Exercices[0].ID {
		t.Fatalf("deux appels le meme jour rendent des exercices differents")
	}
}

func TestJourAvecPiqueApresUneAbsence(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	tousLesJours := []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses:   Reponses{JoursActifs: tousLesJours},
		Niveaux:    Niveaux{Ventre: 1, Cuisses: 1},
		Historique: []HistoriqueEntree{{Date: "2026-08-06", Ressenti: RessentiCorrect}}, // avant-hier
	}); err != nil {
		t.Fatal(err)
	}
	w := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	var reponse struct {
		Pique string `json:"pique"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reponse); err != nil {
		t.Fatal(err)
	}
	if reponse.Pique == "" {
		t.Fatal("aucune pique apres une absence de deux jours")
	}
}

func tousLesJoursDeTest() []string {
	return []string{"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"}
}

func TestRessentiDejaCompteNeRecomptePas(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	jourDuTest := aujourdhui()
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses:   Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:    Niveaux{Ventre: 1, Cuisses: 1},
		Serie:      Serie{Actuelle: 3, Record: 3},
		Historique: []HistoriqueEntree{{Date: jourDuTest, Ressenti: RessentiCorrect, Exercices: []string{"x"}}},
	}); err != nil {
		t.Fatal(err)
	}
	w := poster(t, h, "POST", "/api/ressenti", "test@example.com", map[string]string{"ressenti": "facile"})
	if w.Code != http.StatusOK {
		t.Fatalf("POST /api/ressenti: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var recap Recap
	if err := json.Unmarshal(w.Body.Bytes(), &recap); err != nil {
		t.Fatal(err)
	}
	if !recap.DejaCompte {
		t.Fatal("deja_compte = false, attendu true (seance deja faite aujourd'hui)")
	}
	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if len(apres.Historique) != 1 {
		t.Fatalf("historique = %d entrees, attendu 1 (pas de recompte)", len(apres.Historique))
	}
	if apres.Niveaux != (Niveaux{Ventre: 1, Cuisses: 1}) {
		t.Fatalf("niveaux modifies par un ressenti deja compte: %+v", apres.Niveaux)
	}
}

func TestRessentiDifficileFaitBaisserLeNiveau(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:  Niveaux{Ventre: 3, Cuisses: 3},
	}); err != nil {
		t.Fatal(err)
	}
	w := poster(t, h, "POST", "/api/ressenti", "test@example.com", map[string]string{"ressenti": "difficile"})
	if w.Code != http.StatusOK {
		t.Fatalf("POST /api/ressenti: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if apres.Niveaux.Ventre != 2 || apres.Niveaux.Cuisses != 2 {
		t.Fatalf("niveaux apres difficile = %+v, attendu 2/2", apres.Niveaux)
	}
	if len(apres.Historique) != 1 {
		t.Fatalf("%d entree(s) d'historique, attendu 1", len(apres.Historique))
	}
}

func TestRessentiTroisFacilesDeSuiteMontentLeNiveau(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:  Niveaux{Ventre: 2, Cuisses: 2},
	}); err != nil {
		t.Fatal(err)
	}
	jour, _ := time.Parse("2006-01-02", aujourdhui())
	// Trois ressentis "facile" un jour apres l'autre, en avancant l'historique
	// a la main comme le ferait le temps qui passe.
	for i := range 3 {
		date := jour.AddDate(0, 0, i).Format("2006-01-02")
		p, err := LireProfil(racine, "test@example.com")
		if err != nil {
			t.Fatal(err)
		}
		niveauVentre, facilesVentre := AjusterNiveau(chargerDictionnaireDeTest(t), ZoneVentre, nil, p.Niveaux.Ventre, p.FacilesConsecutifs.Ventre, RessentiFacile)
		p.Niveaux.Ventre, p.FacilesConsecutifs.Ventre = niveauVentre, facilesVentre
		p.Historique = append(p.Historique, HistoriqueEntree{Date: date, Ressenti: RessentiFacile})
		if err := EcrireProfil(racine, "test@example.com", p); err != nil {
			t.Fatal(err)
		}
	}
	final, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if final.Niveaux.Ventre != 3 {
		t.Fatalf("niveau ventre = %d apres trois faciles de suite, attendu 3", final.Niveaux.Ventre)
	}
}

func TestEncouragementJamaisRepete(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfil(racine, "a@example.com", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}); err != nil {
		t.Fatal(err)
	}
	messages := messagesDeTest()
	messages.Encouragements = []string{"un", "deux"}
	h2 := routes(chargerDictionnaireDeTest(t), messages, defisDeTest(), racine, "")
	w1 := poster(t, h2, "POST", "/api/ressenti", "a@example.com", map[string]string{"ressenti": "correct"})
	var recap1 Recap
	json.Unmarshal(w1.Body.Bytes(), &recap1)

	// Simule un nouveau jour pour permettre un second ressenti "a-faire".
	p, _ := LireProfil(racine, "a@example.com")
	p.Historique[0].Date = "2020-01-01"
	EcrireProfil(racine, "a@example.com", p)

	w2 := poster(t, h2, "POST", "/api/ressenti", "a@example.com", map[string]string{"ressenti": "correct"})
	var recap2 Recap
	json.Unmarshal(w2.Body.Bytes(), &recap2)

	if recap1.Encouragement == recap2.Encouragement {
		t.Fatalf("meme encouragement deux fois de suite: %q", recap1.Encouragement)
	}
}

// nomJourFR rend le nom francais du jour de semaine de dateISO, pour
// construire un profil dont "aujourd'hui" est toujours un jour actif quel
// que soit le jour ou tourne le test.
func nomJourFR(t *testing.T, dateISO string) string {
	t.Helper()
	d, err := time.Parse("2006-01-02", dateISO)
	if err != nil {
		t.Fatal(err)
	}
	for nom, jourSemaine := range joursFR {
		if jourSemaine == d.Weekday() {
			return nom
		}
	}
	t.Fatalf("jour introuvable pour %s", dateISO)
	return ""
}

// TestJourTireUnDefiLaPremiereFois couvre le critere d'acceptation 1 : un
// profil sans defi de la semaine ne montre rien de casse sur l'ecran du
// jour — il en tire un aussitot.
func TestJourTireUnDefiLaPremiereFois(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	jour := aujourdhui()
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: []string{nomJourFR(t, jour)}},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}); err != nil {
		t.Fatal(err)
	}

	w := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/jour: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var reponse struct {
		Defi *DefiSemaine `json:"defi"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reponse); err != nil {
		t.Fatal(err)
	}
	if reponse.Defi == nil || reponse.Defi.ID == "" {
		t.Fatalf("aucun defi tire alors que le profil n'en avait pas: %+v", reponse.Defi)
	}
	if reponse.Defi.Semaine != semaineISODeDate(jour) {
		t.Fatalf("semaine du defi = %s, attendu %s", reponse.Defi.Semaine, semaineISODeDate(jour))
	}

	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if apres.DefiSemaine == nil || apres.DefiSemaine.ID != reponse.Defi.ID {
		t.Fatal("defi tire non persiste sur le profil")
	}
}

func TestJourDefiStablePourLaMemeSemaine(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}); err != nil {
		t.Fatal(err)
	}
	var premiere, seconde struct {
		Defi *DefiSemaine `json:"defi"`
	}
	w1 := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if err := json.Unmarshal(w1.Body.Bytes(), &premiere); err != nil {
		t.Fatal(err)
	}
	w2 := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	if err := json.Unmarshal(w2.Body.Bytes(), &seconde); err != nil {
		t.Fatal(err)
	}
	if premiere.Defi.ID != seconde.Defi.ID {
		t.Fatalf("le defi change dans la meme semaine: %s puis %s", premiere.Defi.ID, seconde.Defi.ID)
	}
}

// TestJourRedessineLeDefiSiLaSemaineAChange verifie le tirage hebdomadaire
// du verrou du 9 aout 2026 : une semaine differente de celle du profil
// declenche un nouveau tirage, persiste aussitot.
func TestJourRedessineLeDefiSiLaSemaineAChange(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses:    Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:     Niveaux{Ventre: 1, Cuisses: 1},
		DefiSemaine: &DefiSemaine{ID: "d-toutes-1", Titre: "ancien", Type: DefiToutesLesSeancesActives, Semaine: "2000-W01"},
	}); err != nil {
		t.Fatal(err)
	}

	w := poster(t, h, "GET", "/api/jour", "test@example.com", nil)
	var reponse struct {
		Defi *DefiSemaine `json:"defi"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reponse); err != nil {
		t.Fatal(err)
	}
	if reponse.Defi.Semaine == "2000-W01" {
		t.Fatal("defi d'une semaine perimee jamais redessine")
	}
}

// TestRessentiSansDefiNeCassePasEtNeMarqueRien couvre les criteres 1 et 2 :
// sans defi assigne, POST /api/ressenti ne casse rien et ne fait apparaitre
// aucune mention de defi rate.
func TestRessentiSansDefiNeCassePasEtNeMarqueRien(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}); err != nil {
		t.Fatal(err)
	}
	w := poster(t, h, "POST", "/api/ressenti", "test@example.com", map[string]string{"ressenti": "correct"})
	if w.Code != http.StatusOK {
		t.Fatalf("POST /api/ressenti: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var recap Recap
	if err := json.Unmarshal(w.Body.Bytes(), &recap); err != nil {
		t.Fatal(err)
	}
	if recap.DefiReleve != nil {
		t.Fatalf("defi_releve = %v, attendu absent sans defi assigne", *recap.DefiReleve)
	}
}

// TestRessentiDefiReleveToutesLesSeancesActives couvre la transition
// false -> true de Recap.DefiReleve (verrou du 9 aout 2026, meme logique que
// NiveauMonte).
func TestRessentiDefiReleveToutesLesSeancesActives(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	jour := aujourdhui()
	semaine := semaineISODeDate(jour)
	if err := EcrireProfil(racine, "test@example.com", Profil{
		Reponses:    Reponses{JoursActifs: []string{nomJourFR(t, jour)}}, // aujourd'hui, seul jour actif de la semaine
		Niveaux:     Niveaux{Ventre: 1, Cuisses: 1},
		DefiSemaine: &DefiSemaine{ID: "d-toutes-1", Titre: "t", Type: DefiToutesLesSeancesActives, Semaine: semaine},
	}); err != nil {
		t.Fatal(err)
	}

	w := poster(t, h, "POST", "/api/ressenti", "test@example.com", map[string]string{"ressenti": "correct"})
	if w.Code != http.StatusOK {
		t.Fatalf("POST /api/ressenti: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var recap Recap
	if err := json.Unmarshal(w.Body.Bytes(), &recap); err != nil {
		t.Fatal(err)
	}
	if recap.DefiReleve == nil || !*recap.DefiReleve {
		t.Fatalf("defi_releve = %v, attendu true (seul jour actif de la semaine, fait aujourd'hui)", recap.DefiReleve)
	}

	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if apres.DefiSemaine == nil || !apres.DefiSemaine.Releve {
		t.Fatal("defi non marque releve sur le profil persiste")
	}
}

func TestSupprimerProfil(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())

	w := poster(t, h, "DELETE", "/api/profil", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("DELETE /api/profil: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}

	if _, err := LireProfil(racine, "test@example.com"); !errors.Is(err, ErrProfilAbsent) {
		t.Fatalf("profil encore present apres suppression: %v", err)
	}

	wGet := poster(t, h, "GET", "/api/profil", "test@example.com", nil)
	if wGet.Code != http.StatusNotFound {
		t.Fatalf("GET apres suppression: %d, attendu 404", wGet.Code)
	}
}

func TestSupprimerProfilIdempotent(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	// Aucun profil cree : la suppression ne doit pas echouer.
	w := poster(t, h, "DELETE", "/api/profil", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("DELETE sans profil: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
}

func TestSupprimerProfilNeTouchePasUnAutreCompte(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	poster(t, h, "POST", "/api/profil", "elle@example.com", reponsesDeTest())
	poster(t, h, "POST", "/api/profil", "vous@example.com", reponsesDeTest())

	poster(t, h, "DELETE", "/api/profil", "elle@example.com", nil)

	if _, err := LireProfil(racine, "vous@example.com"); err != nil {
		t.Fatalf("profil d'un autre compte affecte: %v", err)
	}
}

// TestCreerProfilProposeeInitialeFalseParDefaut couvre le point de depart de
// PRODUIT "Proposee une fois, a la creation du profil" : un profil fraichement
// cree n'a jamais encore ete propose.
func TestCreerProfilProposeeInitialeFalseParDefaut(t *testing.T) {
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "")
	w := poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())
	var p Profil
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.Notifications.ProposeeInitiale {
		t.Fatal("proposee_initiale = true sur un profil qui vient d'etre cree")
	}
}

// TestMarquerPropositionInitiale verifie que PUT
// /api/notifications/proposee-initiale persiste le marqueur (PRODUIT
// "Proposee une fois, a la creation du profil", 10 aout 2026), qu'il y ait eu
// activation ou non — cette route ne touche jamais a Abonnement.
func TestMarquerPropositionInitiale(t *testing.T) {
	racine := t.TempDir()
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), racine, "")
	poster(t, h, "POST", "/api/profil", "test@example.com", reponsesDeTest())

	w := poster(t, h, "PUT", "/api/notifications/proposee-initiale", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT proposee-initiale: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}

	apres, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if !apres.Notifications.ProposeeInitiale {
		t.Fatal("proposee_initiale non persiste sur le profil")
	}
	if apres.Notifications.Abonnement != nil {
		t.Fatalf("marquer la proposition initiale ne doit jamais creer d'abonnement: %+v", apres.Notifications.Abonnement)
	}
}

// TestMarquerPropositionInitialeSansProfil verifie le meme comportement 404
// que les autres routes de notification quand le profil n'existe pas.
func TestMarquerPropositionInitialeSansProfil(t *testing.T) {
	h := routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), "")
	w := poster(t, h, "PUT", "/api/notifications/proposee-initiale", "test@example.com", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("PUT proposee-initiale sans profil: %d, attendu 404", w.Code)
	}
}

func TestPersonnelAbsent(t *testing.T) {
	w := poster(t, routes(Dictionnaire{}, messagesDeTest(), defisDeTest(), t.TempDir(), ""), "GET", "/api/personnel", "test@example.com", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("profil absent: %d, attendu 404", w.Code)
	}
}

// TestPersonnel verifie que la reponse ne fait que relire Profil (PRP 07 :
// "rien de nouveau a calculer") — serie et niveaux exactement ceux ecrits,
// les deux zones independantes l'une de l'autre (critere 3 et 4), et un
// calendrier non vide, borne par la fenetre par defaut (critere 5 se
// verifie par ailleurs, en lancant test.sh et --check).
func TestPersonnel(t *testing.T) {
	racine := t.TempDir()
	h := routes(chargerDictionnaireDeTest(t), messagesDeTest(), defisDeTest(), racine, "")
	profil := Profil{
		Reponses:   Reponses{JoursActifs: []string{"lundi"}},
		Niveaux:    Niveaux{Ventre: 2, Cuisses: 3},
		Serie:      Serie{Actuelle: 4, Record: 9},
		Historique: []HistoriqueEntree{{Date: "2026-08-03", Ressenti: RessentiCorrect}},
	}
	if err := EcrireProfil(racine, "test@example.com", profil); err != nil {
		t.Fatal(err)
	}

	w := poster(t, h, "GET", "/api/personnel", "test@example.com", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/personnel: %d, attendu 200 — corps: %s", w.Code, w.Body.String())
	}
	var reponse PersonnelReponse
	if err := json.Unmarshal(w.Body.Bytes(), &reponse); err != nil {
		t.Fatal(err)
	}
	if reponse.Serie != profil.Serie {
		t.Fatalf("serie = %+v, attendu %+v (aucun recalcul divergent de PRP 05)", reponse.Serie, profil.Serie)
	}
	if reponse.Niveaux != profil.Niveaux {
		t.Fatalf("niveaux = %+v, attendu %+v (ventre et cuisses independants, jamais moyennes)", reponse.Niveaux, profil.Niveaux)
	}
	if len(reponse.Calendrier) == 0 {
		t.Fatalf("calendrier vide")
	}
}
