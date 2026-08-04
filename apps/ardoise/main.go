// ardoise — preuve executable du contrat de DONNEES de la fabrique
// billbob.ovh, la ou hello-world l'est du contrat de DEPLOIEMENT.
//
// Quatre etages : une interface (web/, embarquee), un service (ce fichier et
// api.go), une base Postgres privee (base.go, annexe ardoise-base), un cache
// Redis partage par la fabrique (cache.go, service « redis »).
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var version = "dev"

func main() {
	log.Printf("ardoise %s : demarrage", version)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	base, err := NewBase(baseURL())
	if err != nil {
		log.Fatalf("base : configuration invalide : %v", err)
	}
	defer base.Close()
	// En tache de fond : le demarrage du serveur HTTP n'attend pas la base
	// (R6). Une requete arrivee trop tot recoit 503, jamais un plantage.
	go base.Migrer(ctx)

	cache := NewCache(redisAddr())
	defer cache.Close()

	srv := &http.Server{
		Addr:    ":" + port(),
		Handler: routes(base, cache),
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur : %v", err)
		}
	}()
	log.Printf("ardoise : ecoute sur :%s", port())

	<-ctx.Done()
	log.Println("ardoise : arret demande")

	ctxArret, annuler := context.WithTimeout(context.Background(), 5*time.Second)
	defer annuler()
	if err := srv.Shutdown(ctxArret); err != nil {
		log.Printf("serveur : arret force (%v)", err)
	}
}

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// baseURL construit la chaine de connexion Postgres. ARDOISE_BASE_URL, sans
// defaut dans env: (ce n'est pas un secret), permet de la remplacer entierement
// — c'est ainsi que test.sh et le developpement local la pointent ailleurs
// que sur l'annexe ardoise-base. POSTGRES_PASSWORD absent produit une URL sans
// mot de passe : la base refusera alors de s'initialiser (voir le README).
func baseURL() string {
	if u := os.Getenv("ARDOISE_BASE_URL"); u != "" {
		return u
	}
	mdp := os.Getenv("POSTGRES_PASSWORD")
	if mdp == "" {
		return "postgres://postgres@ardoise-base:5432/postgres"
	}
	return "postgres://postgres:" + url.QueryEscape(mdp) + "@ardoise-base:5432/postgres"
}

func redisAddr() string {
	if a := os.Getenv("ARDOISE_REDIS_ADDR"); a != "" {
		return a
	}
	return "redis:6379"
}
