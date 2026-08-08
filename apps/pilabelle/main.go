// pilabelle — programme de pilates doux, quotidien et personnalise.
package main

import (
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

	_ "time/tzdata"
)

//go:embed web
var webFS embed.FS

//go:embed data
var dataFS embed.FS

// version identifie l'image deployee. Posee a la construction par
// -ldflags "-X main.version=..." ; "dev" en construction locale.
var version = "dev"

func identite(r *http.Request) (string, error) {
	u := r.Header.Get("X-Forwarded-User")
	if u == "" {
		return "", errors.New("X-Forwarded-User absent")
	}
	return u, nil
}

func routes(dico []byte, racineProfils string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "ok")
	})

	web, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("web embarque illisible : %v", err)
	}
	mux.Handle("GET /", withVersion(http.FileServer(http.FS(web))))

	mux.HandleFunc("GET /api/profil", func(w http.ResponseWriter, r *http.Request) {
		if _, err := identite(r); err != nil {
			http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
			return
		}
		// PRP 03 remplace ce stub par la lecture reelle du profil.
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
	})

	return withIdentiteExigeeSurAPI(mux)
}

// withIdentiteExigeeSurAPI refuse toute route /api/* sans X-Forwarded-User,
// avant meme d'atteindre le handler — ossature §9 : jamais d'utilisateur
// anonyme silencieux sur l'API.
func withIdentiteExigeeSurAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) >= 5 && r.URL.Path[:5] == "/api/" {
			if _, err := identite(r); err != nil {
				http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

func env(cle, defaut string) string {
	if v := os.Getenv(cle); v != "" {
		return v
	}
	return defaut
}

func repondreJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encodage json: %v", err)
	}
}

func main() {
	racine := env("PILABELLE_DONNEES", "/var/lib/pilabelle")
	dico, err := dataFS.ReadFile("data/dictionnaire.json")
	if err != nil {
		log.Fatalf("dictionnaire absent de l'image : %v", err)
	}

	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: routes(dico, racine)}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	arret := make(chan os.Signal, 1)
	signal.Notify(arret, syscall.SIGTERM, syscall.SIGINT)
	<-arret
	log.Print("arret demande, fermeture propre")
	_ = srv.Close()
}
