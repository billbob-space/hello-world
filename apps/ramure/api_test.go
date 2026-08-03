package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// Ce fichier teste la couche HTTP contre un RESEAU SIMULE, jamais contre la
// vraie source. La §13 en fait une regle de recette : "tester contre des
// sources reelles produit des echecs intermittents qui finissent par etre
// ignores — et masquent alors les vraies regressions."
//
// Il couvre les deux exigences que le PRD marque critiques :
//
//	F-36  distinguer « rien a montrer » de « panne »
//	F-37  un echec n'est jamais memorise

// sourceSimulee est un faux Deezer. Chaque champ decide du comportement d'un
// point d'appel, ce qui permet de simuler les pannes de la §13 : source vide,
// source en erreur, depassement de quota.
type sourceSimulee struct {
	*httptest.Server
	appels atomic.Int32

	rechercheVide    bool
	erreurReseau     bool
	quotaDepasse     bool
	voisinsVides     bool
	discographieVide bool
}

func nouvelleSourceSimulee(t *testing.T) *sourceSimulee {
	t.Helper()
	s := &sourceSimulee{}

	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.appels.Add(1)
		w.Header().Set("Content-Type", "application/json")

		if s.erreurReseau {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		// Le depassement de quota arrive chez Deezer AVEC un statut 200 : c'est
		// le piege que le client doit reconnaitre, sans quoi il le prendrait
		// pour une reponse vide et le mettrait en cache.
		if s.quotaDepasse {
			fmt.Fprint(w, `{"error":{"type":"Exception","message":"Quota limit exceeded","code":4}}`)
			return
		}

		chemin := r.URL.Path
		switch {
		case strings.HasPrefix(chemin, "/search/artist"):
			if s.rechercheVide {
				fmt.Fprint(w, `{"data":[]}`)
				return
			}
			fmt.Fprint(w, `{"data":[
				{"id":1069,"name":"Portishead","picture_big":"https://img/p.jpg","nb_fan":578722,"link":"https://deezer/1069"},
				{"id":9999,"name":"Portishead Tribute","picture_big":"https://img/t.jpg","nb_fan":12,"link":"https://deezer/9999"}
			]}`)

		case strings.HasSuffix(chemin, "/related"):
			if s.voisinsVides {
				fmt.Fprint(w, `{"data":[]}`)
				return
			}
			var b strings.Builder
			b.WriteString(`{"data":[`)
			for i := 0; i < 30; i++ {
				if i > 0 {
					b.WriteString(",")
				}
				fmt.Fprintf(&b, `{"id":%d,"name":"Voisin %d","picture_big":"https://img/%d.jpg","nb_fan":%d,"link":"https://deezer/%d"}`,
					2000+i, i, i, 1000-i, 2000+i)
			}
			b.WriteString(`]}`)
			fmt.Fprint(w, b.String())

		case strings.HasSuffix(chemin, "/albums"):
			if s.discographieVide {
				fmt.Fprint(w, `{"data":[]}`)
				return
			}
			fmt.Fprint(w, `{"data":[
				{"id":1,"title":"Dummy","cover_big":"https://img/d.jpg","release_date":"1994-08-22","record_type":"album","link":"https://deezer/a/1"},
				{"id":2,"title":"Roseland NYC Live","cover_big":"https://img/r.jpg","release_date":"1998-10-06","record_type":"album","link":"https://deezer/a/2"},
				{"id":3,"title":"Dummy (Remastered 2024)","cover_big":"https://img/d.jpg","release_date":"2024-01-01","record_type":"album","link":"https://deezer/a/3"},
				{"id":4,"title":"Glory Box","cover_big":"https://img/g.jpg","release_date":"1995-01-09","record_type":"single","link":"https://deezer/a/4"}
			]}`)

		case strings.HasSuffix(chemin, "/top"):
			fmt.Fprint(w, `{"data":[{"title":"Glory Box","preview":"https://preview/1.mp3","album":{"cover_medium":"https://img/g.jpg"}}]}`)

		default: // /artist/{id}
			fmt.Fprint(w, `{"id":1069,"name":"Portishead","picture_big":"https://img/p.jpg","nb_fan":578722,"link":"https://deezer/1069"}`)
		}
	}))

	precedent := baseDeezer
	baseDeezer = s.URL
	t.Cleanup(func() { baseDeezer = precedent; s.Close() })
	return s
}

func serveurDeTest(t *testing.T) *Serveur {
	t.Helper()
	cache := NouveauCache()
	return &Serveur{
		sources:    NouvellesSources(cache, ""),
		collection: NouvelleCollection(),
		reglages:   NouveauxReglages(),
		mesures:    NouvellesMesures(),
		cache:      cache,
		version:    "test",
	}
}

func appelleAPI(t *testing.T, s *Serveur, methode, cible string, corps string, entetes map[string]string) (int, reponse) {
	t.Helper()
	mux := http.NewServeMux()
	s.Routes(mux, http.NotFoundHandler())

	var lecteur *strings.Reader = strings.NewReader(corps)
	r := httptest.NewRequest(methode, cible, lecteur)
	for k, v := range entetes {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	var rep reponse
	if w.Body.Len() > 0 {
		if err := json.Unmarshal(w.Body.Bytes(), &rep); err != nil {
			t.Fatalf("reponse illisible (%d) : %s", w.Code, w.Body.String())
		}
	}
	return w.Code, rep
}

// ═══ F-36 — CRITIQUE ═══════════════════════════════════════════════════
// "Un artiste sans voisins connus et un echec de chargement produisent deux
// messages differents ; SEUL LE SECOND propose de reessayer."

func TestUnArtisteSansVoisinsNeDoitPasProposerDeReessayer(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.voisinsVides = true
	s := serveurDeTest(t)

	code, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Etat != "vide" {
		t.Fatalf("etat = %q, veut \"vide\" (code %d, message %q)", rep.Etat, code, rep.Message)
	}
	if code != http.StatusOK {
		t.Errorf("code = %d, veut 200 : un vide n'est pas une panne", code)
	}
	if rep.Reessayable {
		t.Error("« reessayer » propose sur un artiste sans voisins : l'utilisateur reessaierait en boucle sans jamais rien obtenir")
	}
	if rep.Message == "" {
		t.Error("aucun message : l'utilisateur ne saurait pas ce qui se passe")
	}
}

func TestUnNomIntrouvableEstUnVideEtNonUnePanne(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.rechercheVide = true
	s := serveurDeTest(t)

	code, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Zzzzqqq", "", nil)

	if rep.Etat != "vide" || code != http.StatusOK {
		t.Fatalf("etat = %q, code = %d : un nom introuvable n'est pas une panne", rep.Etat, code)
	}
	if rep.Reessayable {
		t.Error("« reessayer » propose sur un nom introuvable : reessayer ne changera rien tant que le nom est le meme")
	}
}

func TestUneSourceInjoignableDoitProposerDeReessayer(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.erreurReseau = true
	s := serveurDeTest(t)

	code, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Etat != "panne" {
		t.Fatalf("etat = %q, veut \"panne\"", rep.Etat)
	}
	if code != http.StatusBadGateway {
		t.Errorf("code = %d, veut 502", code)
	}
	if !rep.Reessayable {
		t.Error("« reessayer » absent sur une panne : l'utilisateur est bloque alors que la source va revenir")
	}
}

// Le piege Deezer : le depassement de quota arrive avec un statut 200. S'il
// etait pris pour une reponse vide, il serait mis en cache et l'artiste
// resterait degrade longtemps apres le retour a la normale.
func TestUnDepassementDeQuotaEstUnePanneEtNonUnVide(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.quotaDepasse = true
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Etat != "panne" {
		t.Fatalf("etat = %q : un quota depasse serait pris pour « cet artiste n'a pas de voisins »", rep.Etat)
	}
	if !rep.Reessayable {
		t.Error("un quota depasse doit proposer de reessayer : il se resorbe tout seul")
	}
}

// ═══ F-37 — CRITIQUE ═══════════════════════════════════════════════════

func TestReessayerApresUnePanneRelanceUnVraiChargement(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.erreurReseau = true
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)
	if rep.Etat != "panne" {
		t.Fatalf("premiere tentative : etat = %q", rep.Etat)
	}
	apresPanne := simulee.appels.Load()

	// La source revient. Reessayer doit repartir jusqu'a elle.
	simulee.erreurReseau = false
	_, rep = appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Etat != "ok" {
		t.Fatalf("apres retablissement : etat = %q, message %q — l'echec a ete memorise", rep.Etat, rep.Message)
	}
	if simulee.appels.Load() <= apresPanne {
		t.Error("aucun nouvel appel a la source : « reessayer » n'a pas relance de veritable chargement")
	}
}

func TestUnVideNEmpecheJamaisUnCharementUlterieurDeReussir(t *testing.T) {
	simulee := nouvelleSourceSimulee(t)
	simulee.voisinsVides = true
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)
	if rep.Etat != "vide" {
		t.Fatalf("etat = %q", rep.Etat)
	}

	// La source retrouve ses voisins.
	simulee.voisinsVides = false
	_, rep = appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Etat != "ok" {
		t.Fatalf("etat = %q : le vide a ete memorise, l'artiste reste sans arbre pour toujours", rep.Etat)
	}
}

func TestAucuneReponseDApiNEstMiseEnCacheParLeNavigateur(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	mux := http.NewServeMux()
	s.Routes(mux, http.NotFoundHandler())

	for _, cible := range []string{"/api/arbre?graine=Portishead", "/api/collection", "/api/diagnostic"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", cible, nil))

		if got := w.Header().Get("Cache-Control"); got != "no-store" {
			t.Errorf("%s : Cache-Control = %q, veut no-store — le navigateur reservirait une reponse d'echec", cible, got)
		}
	}
}

// ═══ Correspondance stricte, de bout en bout ═══════════════════════════

func TestLaPlantationNeDoitJamaisRetomberSurUnHomonyme(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	// La source rend "Portishead" ET "Portishead Tribute". Demander le tribute
	// exact doit donner le tribute ; demander Portishead doit donner Portishead.
	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)
	if rep.Etat != "ok" {
		t.Fatalf("etat = %q", rep.Etat)
	}

	var arbre Arbre
	rebrancheJSON(t, rep.Donnees, &arbre)
	if arbre.Centre.Nom != "Portishead" {
		t.Errorf("centre = %q, veut « Portishead » : un homonyme a contamine tout le sous-arbre", arbre.Centre.Nom)
	}
}

func TestUnArbreCompletRespecteLesParametresDeCadrage(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	var arbre Arbre
	rebrancheJSON(t, rep.Donnees, &arbre)

	if len(arbre.Branches) != branchesCible {
		t.Errorf("%d branches, veut %d", len(arbre.Branches), branchesCible)
	}
	if arbre.Vivier < vivierSuffisant {
		t.Errorf("vivier de %d, le tirage n'a pas de quoi varier (seuil %d)", arbre.Vivier, vivierSuffisant)
	}
	for _, b := range arbre.Branches {
		if b.Nom == "" {
			t.Error("une branche sans nom : son intitule accessible serait vide")
		}
		if b.Rayon <= 0 || b.Taille <= 0 {
			t.Errorf("branche %q : rayon %.3f, taille %.3f — elle serait invisible", b.Nom, b.Rayon, b.Taille)
		}
	}
}

// N-03 : "chaque promotion a un cout borne et documente en nombre d'appels par
// source". Le compteur remonte dans la reponse, ce qui rend l'exigence
// verifiable au lieu de declarative.
func TestLeCoutDUnePromotionResteBorneEtEstRapporte(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/arbre?graine=Portishead", "", nil)

	if rep.Budget == nil {
		t.Fatal("aucun budget rapporte : la N-03 ne serait pas verifiable")
	}
	if total := rep.Budget["total"]; total > plafondAppels {
		t.Errorf("%d appels pour une plantation, plafond %d", total, plafondAppels)
	}

	// La promotion d'un artiste deja resolu doit couter MOINS qu'une plantation :
	// c'est la regle « profondeur maximale au centre, strict minimum sur
	// l'entourage » qui le garantit.
	_, rep2 := appelleAPI(t, s, "GET", "/api/arbre?id=dz:1069", "", nil)
	if rep2.Budget["total"] > rep.Budget["total"] {
		t.Errorf("promotion (%d appels) plus couteuse qu'une plantation (%d)", rep2.Budget["total"], rep.Budget["total"])
	}
}

// ═══ Identite et cloisonnement (N-08) ══════════════════════════════════

func TestLaCollectionResteLocaleSansIdentiteEtablieParLeServeur(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	_, rep := appelleAPI(t, s, "GET", "/api/collection", "", nil)
	if rep.Etat != "local" {
		t.Errorf("etat = %q, veut \"local\" : sans identite, le client doit basculer sur son miroir local plutot que d'afficher une collection vide", rep.Etat)
	}
}

func TestUnUtilisateurNeVoitJamaisLaCollectionDUnAutre(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	alice := map[string]string{"X-Forwarded-User": "alice@exemple.fr", "Content-Type": "application/json"}
	bob := map[string]string{"X-Forwarded-User": "bob@exemple.fr"}

	appelleAPI(t, s, "POST", "/api/collection", `{"id":"dz:1","nom":"Portishead"}`, alice)

	_, rep := appelleAPI(t, s, "GET", "/api/collection", "", bob)
	var gardes []Garde
	rebrancheJSON(t, rep.Donnees, &gardes)

	if len(gardes) != 0 {
		t.Fatalf("bob voit %d gardes d'alice : fuite de donnees entre utilisateurs", len(gardes))
	}

	_, rep = appelleAPI(t, s, "GET", "/api/collection", "", map[string]string{"X-Forwarded-User": "alice@exemple.fr"})
	rebrancheJSON(t, rep.Donnees, &gardes)
	if len(gardes) != 1 {
		t.Errorf("alice voit %d gardes, veut 1", len(gardes))
	}
}

// L'identite ne doit JAMAIS venir du corps de la requete (N-08).
func TestUneIdentiteDeclareeParLeClientEstIgnoree(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)

	// Un client malveillant tente de se declarer comme alice dans le corps.
	corps := `{"id":"dz:1","nom":"Portishead","utilisateur":"alice@exemple.fr","user":"alice@exemple.fr"}`
	_, rep := appelleAPI(t, s, "POST", "/api/collection", corps, map[string]string{"Content-Type": "application/json"})

	if rep.Etat != "local" {
		t.Errorf("etat = %q : une identite declaree par le client a ete acceptee", rep.Etat)
	}

	_, rep = appelleAPI(t, s, "GET", "/api/collection", "", map[string]string{"X-Forwarded-User": "alice@exemple.fr"})
	var gardes []Garde
	rebrancheJSON(t, rep.Donnees, &gardes)
	if len(gardes) != 0 {
		t.Error("la collection d'alice a ete ecrite par un client non authentifie")
	}
}

// ═══ Instrumentation (N-09) ════════════════════════════════════════════

func TestSeulsLesEvenementsConnusSontAcceptes(t *testing.T) {
	nouvelleSourceSimulee(t)
	s := serveurDeTest(t)
	entetes := map[string]string{"Content-Type": "application/json", "X-Ramure-Session": "s1"}

	code, _ := appelleAPI(t, s, "POST", "/api/mesure", `{"evenement":"promotion"}`, entetes)
	if code != http.StatusNoContent {
		t.Errorf("evenement connu refuse : code %d", code)
	}

	code, _ = appelleAPI(t, s, "POST", "/api/mesure", `{"evenement":"inventé-par-un-client"}`, entetes)
	if code != http.StatusBadRequest {
		t.Errorf("evenement inconnu accepte : code %d — la table des compteurs pourrait grossir sans limite", code)
	}
}

func rebrancheJSON(t *testing.T, src any, cible any) {
	t.Helper()
	brut, err := json.Marshal(src)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(brut, cible); err != nil {
		t.Fatal(err)
	}
}
