// estran — meteo marine et jauge de maree pour Le Touquet-Paris-Plage /
// Etaples. Une seule stack, un seul secteur : pas de recherche, pas de menu
// de villes (PRODUCT.md, principe 1).
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
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

	srv := nouveauServeur(
		NouveauClientMeteo(latitude, longitude),
		NouveauClientMaree(siteMaree, env("API_MAREE_KEY", "")),
		NouveauClientPluie(latitude, longitude),
		NouveauClientNowcast(latitude, longitude),
	)

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
	// La courbe de pluie et la bande de l'heure ont chacune leur dernier
	// connu, distinct de celui de la meteo : la bande peut etre resservie
	// depuis le cache pendant que la courbe est fraiche, et l'echec de l'une
	// ne doit pas retirer l'autre de l'ecran
	// (prp/03-graphe-de-pluie.md, section 4).
	clientPluie   *ClientPluie
	pluieCache    *dernierConnu[SeriePluie]
	clientNowcast *ClientNowcast
	nowcastCache  *dernierConnu[Nowcast]
}

func nouveauServeur(cm *ClientMeteo, cma *ClientMaree, cp *ClientPluie, cn *ClientNowcast) *serveur {
	return &serveur{
		clientMeteo:   cm,
		meteoCache:    &dernierConnu[Previsions]{},
		clientMaree:   cma,
		mareeCache:    &dernierConnu[Maree]{},
		clientPluie:   cp,
		pluieCache:    &dernierConnu[SeriePluie]{},
		clientNowcast: cn,
		nowcastCache:  &dernierConnu[Nowcast]{},
	}
}

func routes(s *serveur, web fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/previsions", s.handlePrevisions)
	mux.HandleFunc("GET /api/maree", s.handleMaree)
	mux.HandleFunc("GET /api/pluie", s.handlePluie)
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
	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}

	// 12s : le fournisseur meteo fait jusqu'a trois appels sortants
	// sequentiels (previsions+marine, plus l'accord entre modeles borne a
	// 4s, meteo.go) ; 8s s'est revele tangent en pratique sur une connexion
	// qui demarre a froid.
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

	repondreJSON(w, http.StatusOK, vuePrevisions(valeur, maintenant, frais, dateCible))
}

func (s *serveur) handleMaree(w http.ResponseWriter, r *http.Request) {
	if s.clientMaree.CleAPI == "" {
		repondreJSON(w, http.StatusOK, ReponseMaree{Configure: false})
		return
	}

	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
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

	if dateCible == nil {
		repondreJSON(w, http.StatusOK, vueMaree(valeur, frais, siteMaree))
		return
	}
	repondreJSON(w, http.StatusOK, vueMareeJour(valeur, frais, siteMaree, *dateCible))
}

// handlePluie sert la section Pluie, sur une route distincte de
// /api/previsions pour trois raisons (prp/03-graphe-de-pluie.md, section 3) :
// une source lente ne doit pas retarder l'ecran principal, la bande de
// l'heure se rafraichit plus souvent que la tendance a seize jours, et la
// panne de l'une se lit sans contaminer l'autre.
func (s *serveur) handlePluie(w http.ResponseWriter, r *http.Request) {
	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}

	// 12s : le fournisseur de la courbe fait deux appels sortants sequentiels
	// (horaire puis quart d'heure), comme les deux autres routes.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	serie, _, frais, err := s.pluieCache.rafraichir(func() (SeriePluie, error) {
		return s.clientPluie.Recuperer(ctx)
	})
	if err != nil {
		log.Printf("pluie indisponible : %v", err)
	}

	// La bande de l'heure est bornee a part et n'est demandee QUE pour
	// aujourd'hui : sur un autre jour elle ne serait pas affichee, et l'appel
	// serait paye pour rien. Son echec ne remonte jamais — la section garde
	// la courbe.
	var bande *Nowcast
	if dateCible == nil || debutDuJour(*dateCible).Equal(debutDuJour(maintenant)) {
		ctxBande, annulerBande := context.WithTimeout(ctx, delaiNowcast)
		defer annulerBande()
		if n, _, _, err := s.nowcastCache.rafraichir(func() (Nowcast, error) {
			return s.clientNowcast.Recuperer(ctxBande)
		}); err != nil {
			log.Printf("prevision immediate indisponible : %v", err)
		} else {
			bande = &n
		}
	}

	repondreJSON(w, http.StatusOK, vuePluie(serie, bande, maintenant, frais, dateCible))
}

// delaiNowcast borne la bande de l'heure, en sous-contexte du contexte de la
// requete : elle est un supplement, jamais la promesse de la section
// (prp/03-graphe-de-pluie.md, section 4) — si elle traine, la courbe du jour
// doit tout de meme s'afficher a temps.
const delaiNowcast = 4 * time.Second

// parametreDate lit le parametre optionnel `date` (AAAA-MM-JJ, interprete en
// Europe/Paris). Absent, il rend (nil, nil) : la reponse doit alors rester
// celle d'aujourd'hui, a l'octet pres — c'est la contrainte principale de
// prp/01-navigation-temporelle.md. Present mais illisible ou hors de la
// fenetre de navigation (joursNavigationArriere/Avant jours de part et
// d'autre d'aujourd'hui), il rend une erreur explicite : rendre la donnee
// d'un autre jour serait pire que ne rien afficher.
func parametreDate(r *http.Request, maintenant time.Time) (*time.Time, error) {
	brut := r.URL.Query().Get("date")
	if brut == "" {
		return nil, nil
	}
	d, err := time.ParseInLocation("2006-01-02", brut, parisTZ)
	if err != nil {
		return nil, fmt.Errorf("date invalide : attendu AAAA-MM-JJ")
	}
	aujourdhui := debutDuJour(maintenant)
	min := aujourdhui.AddDate(0, 0, -joursNavigationArriere)
	max := aujourdhui.AddDate(0, 0, joursNavigationAvant)
	if d.Before(min) || d.After(max) {
		return nil, fmt.Errorf("date hors de la fenêtre couverte (%s a %s)", min.Format("2006-01-02"), max.Format("2006-01-02"))
	}
	return &d, nil
}

func repondreJSON(w http.ResponseWriter, statut int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statut)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encodage JSON : %v", err)
	}
}

// repondreErreur rend une erreur de requete (parametre `date` illisible ou
// hors fenetre) : distincte des degradations de fournisseur ci-dessus, qui
// restent en 200 avec un champ "erreur" (dernier connu servi malgre tout).
// Ici il n'y a rien a servir : la donnee demandee n'existe pas ou n'a pas de
// sens, jamais remplacee par celle d'un autre jour.
func repondreErreur(w http.ResponseWriter, statut int, message string) {
	repondreJSON(w, statut, map[string]string{"erreur": message})
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
