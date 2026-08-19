// apps/ramure-v2/internal/api/collection_test.go
// GET/PUT/DELETE /api/collection sur le VRAI chemin HTTP (pas seulement le
// store en test unitaire) : c'est ici que le cloisonnement doit tenir
// jusqu'au bout, en-tetes compris.
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/collection"
)

func routesDeTestCollection(t *testing.T) http.Handler {
	t.Helper()
	ancienne := Collection
	Collection = collection.NouveauMemoryStore()
	t.Cleanup(func() { Collection = ancienne })
	return Routes(dependancesDeTest())
}

func requetePUT(chemin, corps, identite string) *http.Request {
	r := httptest.NewRequest(http.MethodPut, chemin, strings.NewReader(corps))
	if identite != "" {
		r.Header.Set("X-Forwarded-User", identite)
	}
	return r
}

func requeteGET(chemin, identite string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, chemin, nil)
	if identite != "" {
		r.Header.Set("X-Forwarded-User", identite)
	}
	return r
}

// TestSansIdentiteLaCollectionEstRefusee : 401, jamais la collection de
// personne.
func TestSansIdentiteLaCollectionEstRefusee(t *testing.T) {
	mux := routesDeTestCollection(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requeteGET("/api/collection", ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("attendu 401, obtenu %d : %s", rec.Code, rec.Body)
	}
}

// TestUnParametreDURLNeSubstituePasLIdentite : ?utilisateur=a@exemple.fr
// sans en-tete ne doit JAMAIS rendre la collection de a@exemple.fr — la
// route doit refuser (401), pas deviner une identite dans la requete.
func TestUnParametreDURLNeSubstituePasLIdentite(t *testing.T) {
	mux := routesDeTestCollection(t)

	// a@exemple.fr garde reellement quelque chose, via le SEUL canal valide.
	recAjout := httptest.NewRecorder()
	mux.ServeHTTP(recAjout, requetePUT("/api/collection", `{"nom":"Portishead","mbid":"m1"}`, "a@exemple.fr"))
	if recAjout.Code != http.StatusOK {
		t.Fatalf("ajout : attendu 200, obtenu %d : %s", recAjout.Code, recAjout.Body)
	}

	// Une requete SANS en-tete, mais avec un parametre d'URL qui PRETEND
	// etre a@exemple.fr, ne doit rien obtenir.
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requeteGET("/api/collection?utilisateur=a@exemple.fr", ""))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("l'identite s'est invitee par un parametre d'URL : code %d, corps %s", rec.Code, rec.Body)
	}
}

// TestLeCloisonnementTientSurLeVraiCheminHTTP : reprend le scenario du
// script de verification de l'etape (curl) en test Go — a@exemple.fr
// ajoute, b@exemple.fr liste une collection VIDE.
func TestLeCloisonnementTientSurLeVraiCheminHTTP(t *testing.T) {
	mux := routesDeTestCollection(t)

	recAjout := httptest.NewRecorder()
	mux.ServeHTTP(recAjout, requetePUT("/api/collection", `{"nom":"Portishead","mbid":"8f6bd1e4"}`, "a@exemple.fr"))
	if recAjout.Code != http.StatusOK {
		t.Fatalf("ajout : attendu 200, obtenu %d : %s", recAjout.Code, recAjout.Body)
	}

	recA := httptest.NewRecorder()
	mux.ServeHTTP(recA, requeteGET("/api/collection", "a@exemple.fr"))
	var entreesA []collection.Entree
	if err := json.Unmarshal(recA.Body.Bytes(), &entreesA); err != nil {
		t.Fatalf("decodage a@exemple.fr : %v (%s)", err, recA.Body)
	}
	if len(entreesA) != 1 {
		t.Fatalf("a@exemple.fr devrait voir 1 entree, en voit %d", len(entreesA))
	}

	recB := httptest.NewRecorder()
	mux.ServeHTTP(recB, requeteGET("/api/collection", "b@exemple.fr"))
	var entreesB []collection.Entree
	if err := json.Unmarshal(recB.Body.Bytes(), &entreesB); err != nil {
		t.Fatalf("decodage b@exemple.fr : %v (%s)", err, recB.Body)
	}
	if len(entreesB) != 0 {
		t.Fatalf("CLOISONNEMENT ROMPU sur le chemin HTTP : b@exemple.fr voit %d entree(s), attendu 0 (corps : %s)",
			len(entreesB), recB.Body)
	}
}

// TestRetirerParHTTP : DELETE ?mbid=... retire, jamais chez l'autre
// utilisateur (deja couvert par internal/collection, ici sur le chemin
// HTTP complet, corps JSON compris).
func TestRetirerParHTTP(t *testing.T) {
	mux := routesDeTestCollection(t)
	mux.ServeHTTP(httptest.NewRecorder(), requetePUT("/api/collection", `{"nom":"Portishead","mbid":"m1"}`, "a@exemple.fr"))

	del := httptest.NewRequest(http.MethodDelete, "/api/collection?mbid=m1", nil)
	del.Header.Set("X-Forwarded-User", "a@exemple.fr")
	recDel := httptest.NewRecorder()
	mux.ServeHTTP(recDel, del)
	if recDel.Code != http.StatusNoContent {
		t.Fatalf("attendu 204, obtenu %d : %s", recDel.Code, recDel.Body)
	}

	recListe := httptest.NewRecorder()
	mux.ServeHTTP(recListe, requeteGET("/api/collection", "a@exemple.fr"))
	var entrees []collection.Entree
	_ = json.Unmarshal(recListe.Body.Bytes(), &entrees)
	if len(entrees) != 0 {
		t.Fatalf("apres retrait, attendu 0 entree, obtenu %d", len(entrees))
	}
}

// TestAjoutSansNomOuMbidRefuse400.
func TestAjoutSansNomOuMbidRefuse400(t *testing.T) {
	mux := routesDeTestCollection(t)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requetePUT("/api/collection", `{"nom":"Portishead"}`, "a@exemple.fr"))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("attendu 400, obtenu %d", rec.Code)
	}
}

// TestContexteDeDecouverteAffichableViaHTTP (F-29, moitie serveur) : la
// lignee envoyee par le client est relue telle quelle depuis la route.
func TestContexteDeDecouverteAffichableViaHTTP(t *testing.T) {
	mux := routesDeTestCollection(t)
	corps := `{"nom":"Tricky","mbid":"m9","lignee":["Portishead","Massive Attack","Tricky"]}`
	mux.ServeHTTP(httptest.NewRecorder(), requetePUT("/api/collection", corps, "a@exemple.fr"))

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, requeteGET("/api/collection", "a@exemple.fr"))
	var entrees []collection.Entree
	_ = json.Unmarshal(rec.Body.Bytes(), &entrees)
	if len(entrees) != 1 || len(entrees[0].Lignee) != 3 || entrees[0].Lignee[2] != "Tricky" {
		t.Fatalf("lignee non relue telle quelle : %+v", entrees)
	}
}
