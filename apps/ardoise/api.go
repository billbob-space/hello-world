// Les quatre routes d'ardoise, et le service des fichiers statiques.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"
)

//go:embed web
var webFS embed.FS

type reponseLignes struct {
	Provenance string  `json:"provenance"`
	Lignes     []Ligne `json:"lignes"`
}

// corpsEcriture porte un champ Auteur que l'API n'utilise jamais : il existe
// pour que api_test.go puisse verifier qu'un auteur force dans le corps ne
// gagne pas contre X-Forwarded-User (R3).
type corpsEcriture struct {
	Texte  string `json:"texte"`
	Auteur string `json:"auteur,omitempty"`
}

type reponseErreur struct {
	Erreur string `json:"erreur"`
}

func routes(base *Base, cache *Cache) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		// Ne sonde ni la base ni le cache, deliberement : ce que /healthz
		// affirme est « le serveur ecoute », rien de plus. Le lier a la base
		// ferait tuer une application capable de servir sa page pendant que
		// la base redemarre.
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("GET /api/lignes", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if lignes, ok := cache.Lire(ctx); ok {
			ecrireJSON(w, http.StatusOK, reponseLignes{Provenance: "cache", Lignes: lignes})
			return
		}
		lignes, err := base.Dernieres(ctx, 50)
		if err != nil {
			ecrireJSON(w, http.StatusServiceUnavailable, reponseErreur{Erreur: "la base n'est pas encore prete"})
			return
		}
		if lignes == nil {
			lignes = []Ligne{}
		}
		cache.Ecrire(ctx, lignes)
		ecrireJSON(w, http.StatusOK, reponseLignes{Provenance: "base", Lignes: lignes})
	})

	mux.HandleFunc("POST /api/lignes", func(w http.ResponseWriter, r *http.Request) {
		var corps corpsEcriture
		if err := json.NewDecoder(r.Body).Decode(&corps); err != nil {
			ecrireJSON(w, http.StatusBadRequest, reponseErreur{Erreur: "corps illisible"})
			return
		}
		texte, err := ValiderTexte(corps.Texte)
		if err != nil {
			ecrireJSON(w, http.StatusBadRequest, reponseErreur{Erreur: err.Error()})
			return
		}

		// R3 : l'auteur vient de l'en-tete que Traefik reecrit a chaque
		// requete, jamais du corps — corps.Auteur n'est lu nulle part ici.
		auteur := Auteur(r)

		ctx := r.Context()
		ligne, err := base.Ajouter(ctx, auteur, texte)
		if err != nil {
			ecrireJSON(w, http.StatusServiceUnavailable, reponseErreur{Erreur: "la base n'est pas encore prete"})
			return
		}
		cache.Invalider(ctx)
		ecrireJSON(w, http.StatusCreated, ligne)
	})

	sousFS, _ := fs.Sub(webFS, "web")
	mux.Handle("GET /", http.FileServerFS(sousFS))

	return mux
}

func ecrireJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
