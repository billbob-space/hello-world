// compteur — second passage de la validation de bout en bout de la fabrique
// billbob.ovh, apres ardoise. Memes quatre etages ; deux angles neufs :
// exposure: google, et needs: [redis] sur un service DEJA declare par
// ardoise, pour verifier qu'un shared_services sert vraiment plusieurs
// applications sans qu'elles se marchent dessus.
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
	log.Printf("compteur %s : demarrage", version)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	base, err := NewBase(baseURL())
	if err != nil {
		log.Fatalf("base : configuration invalide : %v", err)
	}
	defer base.Close()
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
	log.Printf("compteur : ecoute sur :%s", port())

	<-ctx.Done()
	log.Println("compteur : arret demande")

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

func baseURL() string {
	if u := os.Getenv("COMPTEUR_BASE_URL"); u != "" {
		return u
	}
	mdp := os.Getenv("POSTGRES_PASSWORD")
	if mdp == "" {
		return "postgres://postgres@compteur-base:5432/postgres"
	}
	return "postgres://postgres:" + url.QueryEscape(mdp) + "@compteur-base:5432/postgres"
}

func redisAddr() string {
	if a := os.Getenv("COMPTEUR_REDIS_ADDR"); a != "" {
		return a
	}
	return "redis:6379"
}
