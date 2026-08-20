// ramure — plante un nom, saute de branche en branche.
//
// Une application d'exploration genealogique de la musique : un artiste au
// centre, ses parents musicaux en orbite, leurs heritiers autour d'eux ; chaque
// clic promeut une branche au centre et fait repousser l'arbre.
//
// Le produit est specifie par apps/ramure/PRODUCT.md. Les exigences y sont
// numerotees F-xx et N-xx, et le code les cite par ces numeros la ou il les
// applique — c'est ce qui rend verifiable qu'une exigence a bien ete traitee,
// et retrouvable le code a changer quand elle evolue.
//
// Aucun secret n'est requis pour demarrer. LASTFM_API_KEY, si elle est fournie
// par l'environnement, ameliore la mesure d'affinite et ajoute le classement
// par appreciation ; son absence degrade ces deux fonctions et rien d'autre
// (N-06, N-13).
package main

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

//go:embed web
var fichiers embed.FS

// version identifie l'image deployee. Posee a la construction par
// -ldflags "-X main.version=..." ; "dev" en construction locale.
var version = "dev"

func main() {
	// Les journaux partent sur la sortie standard, sans horodatage : le
	// contrat de la fabrique l'impose, et Docker date deja chaque ligne.
	log.SetFlags(0)
	log.SetOutput(os.Stdout)

	cache := NouveauCache()
	srv := &Serveur{
		sources:    NouvellesSources(cache, env("LASTFM_API_KEY", "")),
		collection: NouvelleCollection(),
		reglages:   NouveauxReglages(),
		mesures:    NouvellesMesures(),
		cache:      cache,
		version:    version,
	}

	pages, err := fs.Sub(fichiers, "web")
	if err != nil {
		log.Fatalf("ressources web illisibles : %v", err)
	}

	mux := http.NewServeMux()
	srv.Routes(mux, servirPages(pages, version))

	adresse := ":" + port()
	serveur := &http.Server{
		Addr:    adresse,
		Handler: journalise(mux),
		// Un client lent ne doit pas pouvoir immobiliser un connecteur.
		ReadHeaderTimeout: 10 * time.Second,
		// Pas de WriteTimeout global : il couperait les chargements d'arbre
		// les plus lents, ceux qui attendent une source externe. Chaque appel
		// externe porte deja sa propre borne, et le contexte de la requete
		// annule le reste.
		IdleTimeout: 90 * time.Second,
	}

	// Le nettoyage du cache tourne en fond. Sans lui, un processus qui vit des
	// semaines garderait toutes les cles jamais demandees.
	arret := make(chan struct{})
	go purgePeriodique(cache, arret)

	go func() {
		log.Printf("ramure %s ecoute sur %s — roles : %v", version, adresse, srv.sources.RolesActifs())
		if err := serveur.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("le serveur s'est arrete : %v", err)
		}
	}()

	// Arret propre : Docker envoie SIGTERM et attend. Sans cette attente, les
	// requetes en cours seraient coupees net a chaque deploiement.
	signaux := make(chan os.Signal, 1)
	signal.Notify(signaux, syscall.SIGINT, syscall.SIGTERM)
	<-signaux
	close(arret)

	log.Println("arret demande, fin des requetes en cours")
	ctx, annule := context.WithTimeout(context.Background(), 10*time.Second)
	defer annule()
	if err := serveur.Shutdown(ctx); err != nil {
		log.Printf("arret force : %v", err)
	}
}

func port() string {
	return env("PORT", "8080")
}

// env lit une variable d'environnement, ou rend defaut si elle est absente ou
// vide une fois les espaces retires.
//
// C'est aussi ce qui rend baseDeezer et baseLastfm (deezer.go, lastfm.go)
// configurables sans toucher au code : leur valeur par defaut reste l'adresse
// reelle de la source, donc rien ne bouge en production, mais le bout en bout
// (apps/ramure/e2e) peut les repointer vers un serveur local et vérifier de
// vrais ecrans — y compris ceux qui dependent d'une reponse figee — sans
// jamais sortir sur le reseau.
func env(cle, defaut string) string {
	if v := strings.TrimSpace(os.Getenv(cle)); v != "" {
		return v
	}
	return defaut
}

func purgePeriodique(cache *Cache, arret <-chan struct{}) {
	tic := time.NewTicker(10 * time.Minute)
	defer tic.Stop()
	for {
		select {
		case <-tic.C:
			if n := cache.Purge(); n > 0 {
				log.Printf("cache : %d entrees perimees retirees", n)
			}
		case <-arret:
			return
		}
	}
}

// servirPages sert les ressources statiques embarquees.
//
// Deux comportements de cache s'y opposent, et les confondre casse la F-42
// ("mise a jour de l'application signalee [...] sans vider son cache
// manuellement") :
//
//   - les ressources versionnees — styles, script, polices — sont demandees
//     avec un parametre de version et peuvent donc etre gardees longtemps ;
//   - la page elle-meme et le service worker ne doivent JAMAIS etre gardes,
//     sinon le navigateur continue de servir l'ancienne version et n'apprend
//     jamais qu'une nouvelle existe.
func servirPages(pages fs.FS, version string) http.Handler {
	fichiers := http.FileServer(http.FS(pages))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chemin := strings.TrimPrefix(r.URL.Path, "/")

		switch {
		case chemin == "" || chemin == "index.html" || chemin == "sw.js":
			w.Header().Set("Cache-Control", "no-cache")
		case strings.HasPrefix(chemin, "fonts/"):
			// Les polices sont immuables : leur nom change si leur contenu
			// change, parce qu'elles sont livrees avec l'image.
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		default:
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}

		// La version est exposee au client pour que le bandeau de mise a jour
		// (F-42) sache comparer sans avoir a deviner.
		w.Header().Set("X-Ramure-Version", version)

		// Surtout ne PAS reecrire "/" en "/index.html" : http.FileServer sert
		// deja l'index d'un repertoire, et il redirige tout chemin finissant
		// par "/index.html" vers "./" pour canoniser l'URL. Reecrire ici
		// fabriquerait donc la boucle / -> /index.html -> / -> ..., et le
		// navigateur rendrait ERR_TOO_MANY_REDIRECTS sur la page d'accueil.
		fichiers.ServeHTTP(w, r)
	})
}

// journalise ecrit une ligne par requete sur la sortie standard.
//
// Ni l'identite de l'utilisateur ni la chaine de recherche n'y figurent : le
// premier est une donnee personnelle, la seconde en revele une. Le chemin et
// le statut suffisent a diagnostiquer un deploiement.
func journalise(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		debut := time.Now()
		capteur := &capteurStatut{ResponseWriter: w, statut: http.StatusOK}
		suivant.ServeHTTP(capteur, r)

		// La sonde de sante passe toutes les dix secondes : la journaliser
		// noierait tout le reste.
		if r.URL.Path == "/healthz" {
			return
		}
		log.Printf("%s %s %d %dms", r.Method, r.URL.Path, capteur.statut, time.Since(debut).Milliseconds())
	})
}

type capteurStatut struct {
	http.ResponseWriter
	statut int
}

func (c *capteurStatut) WriteHeader(code int) {
	c.statut = code
	c.ResponseWriter.WriteHeader(code)
}
