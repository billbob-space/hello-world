// renaissance-gym — le programme de vacances de La Renaissance Gymnastique.
//
// Le serveur sert la coque web/ en statique et porte l'API de sauvegarde du
// lot 2 (PRD §6). Le navigateur decide de tout ce qui touche au programme et
// a l'entrainement (ossature §1) : le serveur ne connait qu'un pseudonyme, un
// code, et une liste d'identifiants d'exercices valides avec leur date. Il ne
// les interprete jamais.
package main

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// La directive ci-dessous n'emporte que web/ : les tests de tests/ ne sont
// jamais dans l'image, et une edition de test n'invalide pas le cache de
// couches. Ne commence PAS cette phrase par le mot-cle de la directive : un
// commentaire qui lui ressemble sans en etre une est signale par staticcheck
// (SA9009) comme une directive inoperante, et c'est un vrai piege — la
// vraie directive est la ligne collee au « var » ci-dessous.
//
//go:embed web
var coque embed.FS

// init declare le type MIME de la police : l'image finale est Alpine, qui
// n'embarque aucune table /etc/mime.types, et celle que Go compile en dur ne
// couvre pas .woff2. Sans cela le prechargement declare dans index.html
// serait rejete.
func init() {
	if err := mime.AddExtensionType(".woff2", "font/woff2"); err != nil {
		log.Printf("type .woff2 non declare, le fichier sera servi en octet-stream : %v", err)
	}
}

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	web, err := fs.Sub(coque, "web")
	if err != nil {
		log.Fatalf("coque illisible : %v", err)
	}

	dossier := env("GYM_DONNEES", "/var/lib/renaissance-gym")
	m, err := ouvrirMagasin(dossier, time.Now)
	if err != nil {
		// Aucun echec du magasin n'empeche l'application de demarrer : la
		// gymnaste continue de s'entrainer, reseau coupe compris (PRD §11.1),
		// et /healthz n'en depend jamais. Seule la route /api/fiche en patit,
		// avec magasin-indisponible.
		log.Printf("magasin : %s inutilisable, sauvegarde desactivee : %v", dossier, err)
		m = nil
	} else {
		log.Printf("magasin : actif sur %s", dossier)
	}

	addr := ":" + env("PORT", "8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           logging(routes(web, m)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Arret propre sur SIGTERM : le serveur cesse d'accepter et laisse les
	// requetes en cours se terminer, pour qu'un redeploiement ne coupe
	// personne en pleine synchronisation.
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

// routes assemble le serveur. main() et les tests appellent cette meme
// fonction : une route ajoutee ici est testee d'office.
//
// m == nil est un etat valide : /api/fiche rend alors 503 pour toute
// operation, et le reste de l'application — coque et /healthz — est
// inchange.
func routes(web fs.FS, m *Magasin) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleSante)
	mux.HandleFunc("POST /api/fiche", handleFiche(m))
	// Motif le moins specifique : le ServeMux de Go 1.22 donne la priorite aux
	// deux routes ci-dessus, et celle-ci recoit tout le reste — index.html a
	// la racine, les modules ES, style.css, la police, et un 404 pour
	// l'inconnu.
	mux.Handle("GET /", avecCache(http.FileServerFS(web)))
	return mux
}

// avecCache pose un Cache-Control court sur la coque et long sur la police
// (PRP 06, chantier C) : la coque doit prendre la main au rechargement
// suivant un deploiement, la police ne change jamais entre deux versions.
func avecCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/" || r.URL.Path == "/index.html":
			w.Header().Set("Cache-Control", "no-cache")
		case len(r.URL.Path) > 6 && r.URL.Path[len(r.URL.Path)-6:] == ".woff2":
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		next.ServeHTTP(w, r)
	})
}

// handleSante rend 200 sans toucher au disque (PRP 06, chantier C) : la
// sonde ne doit jamais dependre du volume, qui n'est qu'une sauvegarde.
func handleSante(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

// logging trace chaque requete sur la sortie standard, SANS le corps ni la
// requete complete : le pseudonyme, le prenom et le code voyagent dans le
// corps de /api/fiche, jamais dans une ligne de journal (PRP 06, chantier C).
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		debut := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(debut).Truncate(time.Millisecond))
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

func env(cle, defaut string) string {
	if v := os.Getenv(cle); v != "" {
		return v
	}
	return defaut
}
