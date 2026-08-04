// Les quatre routes de compteur, et le service des fichiers statiques.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"
)

//go:embed web
var webFS embed.FS

type reponse struct {
	Provenance string `json:"provenance"`
	Valeur     int64  `json:"valeur"`
	DernierPar string `json:"dernier_par"`
	MajLe      string `json:"maj_le"`
}

type reponseErreur struct {
	Erreur string `json:"erreur"`
}

func aReponse(prov string, c Compteur) reponse {
	return reponse{Provenance: prov, Valeur: c.Valeur, DernierPar: c.DernierPar, MajLe: c.MajLe.Format("2006-01-02T15:04:05Z07:00")}
}

func routes(base *Base, cache *Cache) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		// Ne sonde ni la base ni le cache, deliberement — meme raison que
		// dans ardoise : /healthz affirme « le serveur ecoute », rien de plus.
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("GET /api/compteur", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if c, ok := cache.Lire(ctx); ok {
			ecrireJSON(w, http.StatusOK, aReponse("cache", c))
			return
		}
		c, err := base.Lire(ctx)
		if err != nil {
			ecrireJSON(w, http.StatusServiceUnavailable, reponseErreur{Erreur: "la base n'est pas encore prete"})
			return
		}
		cache.Ecrire(ctx, c)
		ecrireJSON(w, http.StatusOK, aReponse("base", c))
	})

	mux.HandleFunc("POST /api/compteur", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		// R1 : l'auteur vient de l'en-tete que Traefik reecrit a chaque
		// requete, jamais d'un champ du corps — la requete n'en porte aucun.
		auteur := Auteur(r)
		c, err := base.Incrementer(ctx, auteur)
		if err != nil {
			ecrireJSON(w, http.StatusServiceUnavailable, reponseErreur{Erreur: "la base n'est pas encore prete"})
			return
		}
		cache.Invalider(ctx)
		ecrireJSON(w, http.StatusCreated, aReponse("base", c))
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
