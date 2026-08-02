// hello-world — application minimale deployee sur billbob.ovh.
//
// Elle sert une page d'accueil et une sonde de sante. L'identite de
// l'utilisateur vient de l'en-tete X-Forwarded-User, pose par Traefik apres
// l'authentification Google : c'est la seule source d'identite admissible,
// jamais un parametre fourni par le client.
package main

import (
	"context"
	"embed"
	"errors"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

//go:embed page.html
var assets embed.FS

// userHeader est pose par Traefik ; le client ne peut pas le forger, Traefik
// ecrasant tout en-tete de meme nom present dans la requete entrante.
const userHeader = "X-Forwarded-User"

var startedAt = time.Now()

type pageData struct {
	User    string
	Host    string
	Started string
	Uptime  string
}

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	page, err := template.ParseFS(assets, "page.html")
	if err != nil {
		log.Fatalf("modele de page illisible : %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /{$}", handleHome(page))

	addr := ":" + env("PORT", "8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           logging(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Arret propre : le serveur cesse d'accepter et laisse les requetes en
	// cours se terminer, pour qu'un redeploiement ne coupe personne.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("ecoute sur %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur arrete : %v", err)
		}
	}()

	<-stop
	log.Print("arret demande, fermeture en cours")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("fermeture forcee : %v", err)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func handleHome(page *template.Template) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := r.Header.Get(userHeader)
		if user == "" {
			user = "inconnu"
		}
		data := pageData{
			User:    user,
			Host:    r.Host,
			Started: startedAt.Format(time.RFC3339),
			Uptime:  time.Since(startedAt).Truncate(time.Second).String(),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := page.Execute(w, data); err != nil {
			// L'en-tete est deja parti : on ne peut que tracer.
			log.Printf("rendu de la page : %v", err)
		}
	}
}

// logging trace chaque requete sur la sortie standard, sans l'identite de
// l'utilisateur : les logs du serveur ne sont pas un journal de frequentation.
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
