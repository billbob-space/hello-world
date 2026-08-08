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

func routes(dico Dictionnaire, racineProfils string) http.Handler {
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
		email, _ := identite(r) // withIdentiteExigeeSurAPI a deja verifie sa presence
		p, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, p)
	})

	mux.HandleFunc("POST /api/profil", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		if _, err := LireProfil(racineProfils, email); err == nil {
			http.Error(w, `{"erreur":"profil existe deja"}`, http.StatusConflict)
			return
		}
		var reponses Reponses
		if err := json.NewDecoder(r.Body).Decode(&reponses); err != nil || !reponsesValides(reponses) {
			http.Error(w, `{"erreur":"reponses invalides"}`, http.StatusBadRequest)
			return
		}
		p := Profil{
			VersionSchema: 1,
			Reponses:      reponses,
			Niveaux:       NiveauInitial(reponses),
		}
		if err := EcrireProfil(racineProfils, email, p); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		repondreJSON(w, p)
	})

	mux.HandleFunc("PUT /api/profil", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		p, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		var reponses Reponses
		if err := json.NewDecoder(r.Body).Decode(&reponses); err != nil || !reponsesValides(reponses) {
			http.Error(w, `{"erreur":"reponses invalides"}`, http.StatusBadRequest)
			return
		}
		p.Reponses = reponses // PRD §7.5 : jamais retroactif sur niveaux, serie ou historique
		if err := EcrireProfil(racineProfils, email, p); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, p)
	})

	return withIdentiteExigeeSurAPI(mux)
}

func reponsesValides(r Reponses) bool {
	if r.NiveauDepart != "debutante" && r.NiveauDepart != "a_deja_pratique" {
		return false
	}
	if len(r.JoursActifs) == 0 {
		return false
	}
	for _, j := range r.JoursActifs {
		if _, ok := joursFR[j]; !ok {
			return false
		}
	}
	for _, d := range r.Douleurs {
		if !contreIndicationsValides[d] {
			return false
		}
	}
	return true
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
	brut, err := dataFS.ReadFile("data/dictionnaire.json")
	if err != nil {
		log.Fatalf("dictionnaire absent de l'image : %v", err)
	}
	dico, err := ChargerDictionnaire(brut)
	if err != nil {
		log.Fatalf("dictionnaire invalide : %v", err)
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
