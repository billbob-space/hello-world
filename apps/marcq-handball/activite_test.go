package main

import (
	"context"
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

func compteurDeTest(t *testing.T) (*activite, string, *horlogeTest) {
	t.Helper()
	dossier := t.TempDir()
	h := nouvelleHorloge()
	act, err := ouvrirActivite(dossier, h.maintenantFn)
	if err != nil {
		t.Fatalf("ouvrirActivite : %v", err)
	}
	return act, dossier, h
}

// relire rend le contenu du fichier tel qu'il est sur le disque. Jamais l'etat
// en memoire : ce qui est mesure est ce qui SURVIT au redeploiement, et c'est
// le disque qui le dit.
func relire(t *testing.T, dossier string) fichierActivite {
	t.Helper()
	donnees, err := os.ReadFile(filepath.Join(dossier, nomActivite))
	if err != nil {
		t.Fatalf("lecture de %s : %v", nomActivite, err)
	}
	var f fichierActivite
	if err := json.Unmarshal(donnees, &f); err != nil {
		t.Fatalf("%s illisible : %v", nomActivite, err)
	}
	return f
}

func TestActiviteEcritDesLePremierDemarrage(t *testing.T) {
	_, dossier, _ := compteurDeTest(t)

	// Le fichier existe AVANT tout trafic : un volume ou l'on ne peut pas
	// ecrire — le mode de panne le plus probable et le plus silencieux — se
	// signale au demarrage, pas trente secondes plus tard dans une goroutine.
	f := relire(t, dossier)
	if f.Schema != schemaActivite {
		t.Fatalf("schema %d, attendu %d", f.Schema, schemaActivite)
	}
	if len(f.Jours) != 0 {
		t.Fatalf("un demarrage sans trafic a ecrit %d journee(s)", len(f.Jours))
	}
}

func TestActiviteCompteChaqueEvenement(t *testing.T) {
	act, dossier, h := compteurDeTest(t)
	jour := jourParis(h.maintenantFn())

	act.ouverture()
	act.ouverture()
	act.consultation()
	act.coachLu()
	act.envoi(true, false, 3, 0)  // inscription
	act.envoi(false, true, 5, 0)  // reprise
	act.envoi(false, false, 0, 2) // mise a jour vide, deux identifiants perimes
	act.suppression()
	act.refus("code-refuse")
	act.refus("code-refuse")
	act.refus("trop-d-essais")
	act.enregistrer()

	c := relire(t, dossier).Jours[jour]
	if c == nil {
		t.Fatalf("aucune journee %s dans le fichier", jour)
	}
	attendu := compteursJour{
		Ouvertures: 2, Consultations: 1, Coach: 1,
		Inscriptions: 1, Reprises: 1, MisesAJour: 1, Suppressions: 1,
		EnvoisVides: 1, Ignores: 2,
		Refus: map[string]int{"code-refuse": 2, "trop-d-essais": 1},
	}
	if !memeJournee(*c, attendu) {
		t.Fatalf("compteurs %+v, attendus %+v", *c, attendu)
	}
}

// memeJournee compare deux journees. Une comparaison directe echouerait sur la
// carte Refus, que == ne sait pas comparer.
func memeJournee(a, b compteursJour) bool {
	if a.Ouvertures != b.Ouvertures || a.Consultations != b.Consultations ||
		a.Coach != b.Coach || a.Inscriptions != b.Inscriptions ||
		a.Reprises != b.Reprises || a.MisesAJour != b.MisesAJour ||
		a.Suppressions != b.Suppressions || a.EnvoisVides != b.EnvoisVides ||
		a.Ignores != b.Ignores || len(a.Refus) != len(b.Refus) {
		return false
	}
	for code, n := range b.Refus {
		if a.Refus[code] != n {
			return false
		}
	}
	return true
}

func TestActiviteRelueAuRedemarrage(t *testing.T) {
	act, dossier, h := compteurDeTest(t)
	jour := jourParis(h.maintenantFn())
	act.ouverture()
	act.envoi(true, false, 4, 0)
	act.enregistrer()

	// C'est TOUTE la raison d'etre de ce fichier : dockhand recree la stack a
	// chaque deploiement, et le journal du conteneur repart de zero. Les
	// compteurs, eux, doivent traverser.
	repris, err := ouvrirActivite(dossier, h.maintenantFn)
	if err != nil {
		t.Fatalf("reouverture : %v", err)
	}
	repris.ouverture()
	repris.enregistrer()

	c := relire(t, dossier).Jours[jour]
	if c == nil || c.Ouvertures != 2 || c.Inscriptions != 1 {
		t.Fatalf("apres redemarrage : %+v, attendu 2 ouvertures et 1 inscription", c)
	}
}

func TestActiviteMetDeCoteUnFichierIllisible(t *testing.T) {
	for _, cas := range []struct {
		nom, contenu string
	}{
		{"json invalide", "{ceci n'est pas du json"},
		{"schema futur", `{"schema":99,"jours":{}}`},
	} {
		t.Run(cas.nom, func(t *testing.T) {
			dossier := t.TempDir()
			chemin := filepath.Join(dossier, nomActivite)
			if err := os.WriteFile(chemin, []byte(cas.contenu), 0o600); err != nil {
				t.Fatal(err)
			}
			h := nouvelleHorloge()

			// Le fichier est mis de cote, jamais ecrase : c'est la regle du
			// classement, et la mesure reprend au lieu de s'arreter jusqu'au
			// prochain deploiement — personne ne surveille ce fichier.
			act, err := ouvrirActivite(dossier, h.maintenantFn)
			if err != nil {
				t.Fatalf("ouvrirActivite : %v", err)
			}
			act.ouverture()
			act.enregistrer()
			if c := relire(t, dossier).Jours[jourParis(h.maintenantFn())]; c == nil || c.Ouvertures != 1 {
				t.Fatalf("la mesure n'a pas repris : %+v", c)
			}

			mis, err := filepath.Glob(chemin + ".corrompu-*.json")
			if err != nil || len(mis) != 1 {
				t.Fatalf("%d fichier(s) mis de cote, attendu 1 (%v)", len(mis), err)
			}
			garde, err := os.ReadFile(mis[0])
			if err != nil || string(garde) != cas.contenu {
				t.Fatalf("le contenu mis de cote a change : %q, %v", garde, err)
			}
		})
	}
}

func TestActiviteChangeDeJournee(t *testing.T) {
	act, dossier, h := compteurDeTest(t)
	veille := jourParis(h.maintenantFn())
	act.ouverture()

	h.avancer(24 * time.Hour)
	act.ouverture()
	act.enregistrer()

	f := relire(t, dossier)
	lendemain := jourParis(h.maintenantFn())
	if lendemain == veille {
		t.Fatal("l'horloge de test n'a pas change de jour")
	}
	if f.Jours[veille] == nil || f.Jours[veille].Ouvertures != 1 {
		t.Fatalf("la veille %s : %+v", veille, f.Jours[veille])
	}
	if f.Jours[lendemain] == nil || f.Jours[lendemain].Ouvertures != 1 {
		t.Fatalf("le lendemain %s : %+v", lendemain, f.Jours[lendemain])
	}
}

func TestActiviteElagueAuDelaDuPlafond(t *testing.T) {
	act, dossier, h := compteurDeTest(t)
	premier := jourParis(h.maintenantFn())
	for i := 0; i <= joursConserves; i++ {
		act.ouverture()
		h.avancer(24 * time.Hour)
	}
	act.ouverture()
	act.enregistrer()

	f := relire(t, dossier)
	if len(f.Jours) > joursConserves {
		t.Fatalf("%d journees conservees, plafond %d", len(f.Jours), joursConserves)
	}
	if _, present := f.Jours[premier]; present {
		t.Fatalf("la journee la plus ancienne (%s) n'a pas ete elaguee", premier)
	}
}

func TestActiviteNilAbsorbeTout(t *testing.T) {
	// Le nil n'est pas un oubli, c'est l'etat « on ne mesure pas » : volume
	// absent, fichier illisible. Aucune de ces situations ne doit empecher un
	// enfant de cocher une case.
	var act *activite
	act.ouverture()
	act.consultation()
	act.coachLu()
	act.suppression()
	act.envoi(true, false, 1, 0)
	act.refus("code-refuse")
	act.enregistrer()
	act.veiller(contexteAnnule())
}

func contexteAnnule() context.Context {
	ctx, annuler := context.WithCancel(context.Background())
	annuler()
	return ctx
}

func TestActiviteEcritALArret(t *testing.T) {
	act, dossier, h := compteurDeTest(t)
	act.ouverture()

	// veiller rend la main sur un contexte annule, apres avoir ecrit : c'est ce
	// qui fait qu'un redeploiement — l'arret le plus frequent — ne perd pas la
	// journee en cours.
	act.veiller(contexteAnnule())

	c := relire(t, dossier).Jours[jourParis(h.maintenantFn())]
	if c == nil || c.Ouvertures != 1 {
		t.Fatalf("l'arret n'a pas descendu les compteurs : %+v", c)
	}
}

// --- Les compteurs vus depuis les routes ---------------------------------

func serveurCompte(t *testing.T) (http.Handler, *activite, string) {
	t.Helper()
	cl, _, _ := magasinDeTest(t)
	act, dossier, _ := compteurDeTest(t)
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	sw, err := chargerServiceWorker(web)
	if err != nil {
		t.Fatalf("service worker illisible : %v", err)
	}
	return routes(web, sw, cl, act), act, dossier
}

func TestRoutesComptentCeQuiCompte(t *testing.T) {
	h, act, dossier := serveurCompte(t)

	demander := func(methode, chemin, corps string) int {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(methode, chemin, strings.NewReader(corps)))
		return rec.Code
	}

	demander(http.MethodGet, "/", "")
	demander(http.MethodGet, "/style.css", "") // un fichier de la coque : pas une ouverture
	demander(http.MethodGet, "/healthz", "")   // la sonde : jamais comptee
	demander(http.MethodGet, "/api/classement", "")
	demander(http.MethodGet, "/api/coach", "")
	if code := demander(http.MethodPost, "/api/classement",
		`{"pseudo":"Renard","code":"1234","faits":["s1-c1"]}`); code != http.StatusCreated {
		t.Fatalf("inscription : statut %d", code)
	}
	if code := demander(http.MethodPost, "/api/classement",
		`{"pseudo":"Renard","code":"9999","faits":["s1-c1"]}`); code != http.StatusForbidden {
		t.Fatalf("code errone : statut %d", code)
	}
	act.enregistrer()

	f := relire(t, dossier)
	if len(f.Jours) != 1 {
		t.Fatalf("%d journees, attendu 1", len(f.Jours))
	}
	for _, c := range f.Jours {
		if c.Ouvertures != 1 {
			t.Errorf("%d ouvertures, attendu 1 — seuls / et /index.html comptent", c.Ouvertures)
		}
		if c.Consultations != 1 || c.Coach != 1 {
			t.Errorf("%d consultations et %d coach, attendu 1 et 1", c.Consultations, c.Coach)
		}
		if c.Inscriptions != 1 {
			t.Errorf("%d inscriptions, attendu 1", c.Inscriptions)
		}
		if c.Refus["code-refuse"] != 1 {
			t.Errorf("refus %v, attendu un code-refuse", c.Refus)
		}
	}
}
