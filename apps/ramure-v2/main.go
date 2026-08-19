// ramure-v2 — le serveur qui portera l'arbre RAMURE.
//
// A ce stade il ne sait qu'une chose : dire qu'il est vivant. C'est
// volontaire. Le socle doit se prouver deployable avant de porter du produit :
// une app qui arrive en meme temps que sa premiere fonctionnalite ne dit pas
// laquelle des deux est cassee.
package main

import (
	"context"
	_ "embed" // pour la directive go:embed ci-dessous
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/api"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// adresse d'ecoute, figee. Le port du conteneur est declare dans
// apps/ramure-v2/app.yml, d'ou init.sh le recopie dans le label Traefik
// loadbalancer.server.port. Le relire ici depuis l'environnement creerait une
// seconde source de verite, qui divergerait sans bruit.
const adresse = ":8080"

// La page est embarquee dans le binaire : l'image finale ne porte qu'un
// executable, aucun fichier a monter, aucun repertoire a creer au demarrage.
// On embarque le FICHIER et non le repertoire web/ : les etapes suivantes y
// ajouteront des sources TypeScript et un repertoire de compilation, qui
// n'ont rien a faire dans le binaire.
//
// L'embed reste ICI et non dans internal/api : go:embed n'accepte pas de
// chemin hors du repertoire du fichier qui le declare, et web/index.html vit
// au niveau de main.go. main() copie les octets dans api.AccueilHTML avant
// de servir.
//
//go:embed web/index.html
var accueilHTML []byte

// Routes construit desormais le routeur complet (PRP 04) : sonde de sante,
// page d'accueil, en-tete X-Ramure-Version et /api/centre y sont tous
// enregistres, cf. internal/api. main() ne fait plus que cabler les
// dependances et demarrer/arreter le serveur.

// dependances cable les sources externes UNE SEULE FOIS par processus : un
// Cache, un Limiteur, un http.Client, une Cascade de proximite. Les PRP 06
// et 07 elargissent arbre.Dependances, jamais un second cablage.
func dependances() arbre.Dependances {
	c := cache.Neuf(time.Now)
	l := budget.Neuf()
	client := &http.Client{Timeout: 8 * time.Second}
	mb := source.NouveauMusicBrainz(c, l, client, "ramure-v2/1.0 ( https://ramure-v2.apps.billbob.ovh )")
	prox := &source.Cascade{Sources: []source.Proximite{
		source.NouveauLastFM(os.Getenv("LASTFM_API_KEY"), c, l, client),
		source.NouveauListenBrainz(c, l, client),
	}}
	dz := source.NouveauDeezer(c, l, client)
	return arbre.Dependances{Catalogue: mb, Proximite: prox, Media: dz, Limiteur: l}
}

// traceur retient le code de reponse, que http.ResponseWriter ne rend pas.
// Le defaut est 200 : un gestionnaire qui ecrit sans appeler WriteHeader
// repond bien 200, et un journal affichant 0 ferait chercher un bogue absent.
type traceur struct {
	http.ResponseWriter
	code int
}

func (t *traceur) WriteHeader(code int) {
	t.code = code
	t.ResponseWriter.WriteHeader(code)
}

// journal ecrit une ligne par requete sur la sortie standard.
//
// Ce qu'il n'ecrit PAS est aussi important que ce qu'il ecrit :
//   - ni X-Forwarded-User ni aucun en-tete : l'app est en palier google, cet
//     en-tete porte une adresse e-mail, et un journal n'est pas l'endroit ou
//     conserver l'identite de quelqu'un ;
//   - ni la chaine de requete : elle portera la graine saisie par
//     l'utilisateur (PRP 04), c'est-a-dire ce qu'il ecoute ;
//   - ni la sonde de sante, appelee toutes les 30 s par Docker.
func journal(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			suivant.ServeHTTP(w, r)
			return
		}
		debut := time.Now()
		tr := &traceur{ResponseWriter: w, code: http.StatusOK}
		suivant.ServeHTTP(tr, r)
		log.Printf("%s %s %d %dms", r.Method, r.URL.Path, tr.code,
			time.Since(debut).Milliseconds())
	})
}

func main() {
	// Journal sur la sortie standard : exigence de la fabrique, les fichiers
	// de log n'existent pas. Sans horodatage, Docker en pose deja un.
	log.SetOutput(os.Stdout)
	log.SetFlags(0)

	// go:embed n'accepte pas de chemin hors du repertoire de ce fichier :
	// les octets sont donc copies dans le paquet api avant de servir.
	api.AccueilHTML = accueilHTML

	srv := &http.Server{
		Addr:    adresse,
		Handler: journal(api.Routes(dependances())),
		// Un client qui ouvre une connexion sans jamais finir ses en-tetes
		// immobiliserait une goroutine indefiniment.
		ReadHeaderTimeout: 10 * time.Second,
	}

	// docker stop envoie SIGTERM puis attend DIX SECONDES avant de tuer le
	// processus. Sans ce gestionnaire, ces dix secondes s'ajoutent a chaque
	// redeploiement de la stack — qui est unique, donc a celui de toutes les
	// applications de la fabrique.
	arret := make(chan os.Signal, 1)
	signal.Notify(arret, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-arret
		log.Println("ramure-v2 : arret demande, fermeture des connexions en cours")
		ctx, annuler := context.WithTimeout(context.Background(), 10*time.Second)
		defer annuler()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("ramure-v2 : fermeture incomplete : %v", err)
		}
	}()

	log.Printf("ramure-v2 %s ecoute sur %s", api.Version, adresse)
	// Shutdown fait rendre ErrServerClosed a ListenAndServe : c'est la sortie
	// NORMALE. La traiter comme une erreur ferait sortir le conteneur en code
	// non nul, donc redemarrer par restart: unless-stopped, en boucle.
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("ramure-v2 : arret du serveur : %v", err)
	}
	log.Println("ramure-v2 : arrete")
}
