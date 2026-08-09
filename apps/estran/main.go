// estran — meteo marine et jauge de maree pour Le Touquet-Paris-Plage /
// Etaples. Une seule stack, un seul secteur : pas de recherche, pas de menu
// de villes (PRODUCT.md, principe 1).
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Une image Alpine n'embarque pas la base des fuseaux horaires : ce
	// paquet blanc l'embarque dans le binaire (cf. apps/cadran/main.go).
	_ "time/tzdata"
)

//go:embed web
var webFS embed.FS

// version identifie l'image deployee. Posee a la construction par
// -ldflags "-X main.version=..." ; "dev" en construction locale.
var version = "dev"

// latitude, longitude : Le Touquet-Paris-Plage, coordonnees du port de
// reference du bulletin marine consulte pour construire ce produit. Fixes,
// non configurables — PRODUCT.md exclut explicitement plusieurs lieux.
const (
	latitude  = 50.517
	longitude = 1.583
	// siteMaree est le point le plus proche disponible chez api-maree.fr,
	// faute d'entree pour Etaples/Le Touquet — approximation assumee et
	// documentee, cf. prp/00-ossature.md.
	siteMaree = "berck-plage-fort-mahon"
)

var parisTZ = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		log.Fatalf("fuseau Europe/Paris introuvable : %v", err)
	}
	return loc
}()

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	srv := nouveauServeur(NouveauClientMeteo(latitude, longitude), NouveauClientMaree(siteMaree, env("API_MAREE_KEY", "")))

	web, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("web embarque illisible : %v", err)
	}

	httpSrv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           logging(withVersion(routes(srv, web))),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, neplusEcouter := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer neplusEcouter()

	go func() {
		log.Printf("ecoute sur %s", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur arrete : %v", err)
		}
	}()

	<-ctx.Done()
	neplusEcouter()
	log.Print("arret demande, fermeture en cours")

	fermeture, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	if err := httpSrv.Shutdown(fermeture); err != nil {
		log.Printf("fermeture forcee : %v", err)
	}
}

// serveur porte les clients de donnees et le dernier connu de chacun. Un
// champ par fournisseur : la meteo et la maree se degradent independamment
// l'une de l'autre.
type serveur struct {
	clientMeteo *ClientMeteo
	meteoCache  *dernierConnu[Previsions]
	clientMaree *ClientMaree
	mareeCache  *dernierConnu[Maree]
}

func nouveauServeur(cm *ClientMeteo, cma *ClientMaree) *serveur {
	return &serveur{
		clientMeteo: cm,
		meteoCache:  &dernierConnu[Previsions]{},
		clientMaree: cma,
		mareeCache:  &dernierConnu[Maree]{},
	}
}

func routes(s *serveur, web fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/previsions", s.handlePrevisions)
	mux.HandleFunc("GET /api/maree", s.handleMaree)
	mux.Handle("GET /", http.FileServer(http.FS(web)))
	return mux
}

// handleHealth ne depend d'aucun fournisseur externe : un `wget` local ne
// doit pas rendre le conteneur malsain parce qu'Open-Meteo ou api-maree.fr
// sont indisponibles (prp/00-ossature.md, « degrader, jamais casser »).
func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func (s *serveur) handlePrevisions(w http.ResponseWriter, r *http.Request) {
	// 12s : chaque fournisseur fait deux appels sortants sequentiels
	// (previsions+marine, ou extrema+niveaux) ; 8s s'est revele tangent en
	// pratique sur une connexion qui demarre a froid.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	valeur, _, frais, err := s.meteoCache.rafraichir(func() (Previsions, error) {
		return s.clientMeteo.Recuperer(ctx)
	})
	if err != nil {
		log.Printf("previsions indisponibles : %v", err)
		repondreJSON(w, http.StatusOK, map[string]string{"erreur": "previsions indisponibles pour le moment"})
		return
	}

	repondreJSON(w, http.StatusOK, vuePrevisions(valeur, time.Now().In(parisTZ), frais))
}

func (s *serveur) handleMaree(w http.ResponseWriter, r *http.Request) {
	if s.clientMaree.CleAPI == "" {
		repondreJSON(w, http.StatusOK, ReponseMaree{Configure: false})
		return
	}

	// 12s : chaque fournisseur fait deux appels sortants sequentiels
	// (previsions+marine, ou extrema+niveaux) ; 8s s'est revele tangent en
	// pratique sur une connexion qui demarre a froid.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	valeur, _, frais, err := s.mareeCache.rafraichir(func() (Maree, error) {
		return s.clientMaree.Recuperer(ctx)
	})
	if err != nil {
		log.Printf("maree indisponible : %v", err)
		repondreJSON(w, http.StatusOK, ReponseMaree{Configure: true, Erreur: "marée indisponible pour le moment"})
		return
	}

	repondreJSON(w, http.StatusOK, vueMaree(valeur, frais, siteMaree))
}

func repondreJSON(w http.ResponseWriter, statut int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statut)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encodage JSON : %v", err)
	}
}

// withVersion annonce la version deployee sur toutes les reponses : verifier
// un deploiement ne demande pas d'ouvrir la page.
func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Truncate(time.Millisecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
