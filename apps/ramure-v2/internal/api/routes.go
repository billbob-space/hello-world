// apps/ramure-v2/internal/api/routes.go
// Le routeur unique de l'application (PRP 04). Le PRP 01 a laisse ouverte
// la decision entre variables de paquet et signature elargie ; ce PRP
// tranche pour l'elargissement : Routes prend Dependances en argument, ce
// qui permet a go test -race d'executer plusieurs tests en parallele avec
// des doublures differentes. Les PRP 06 et 07 elargissent Dependances et
// ajoutent leurs routes ICI, jamais en introduisant un second routeur.
package api

import (
	"net/http"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
)

// Version identifie l'image qui repond, posee sur chaque reponse par
// entetes(). Cible du -ldflags "-X .../internal/api.Version=..." pose par
// le Dockerfile ; vaut "dev" hors construction CI. Le tag :main de GHCR
// etant mutable, c'est le seul moyen de savoir QUELLE image est en ligne.
var Version = "dev"

// AccueilHTML est la page d'accueil, embarquee par main.go via go:embed :
// la directive n'accepte pas de chemin hors du repertoire du fichier qui
// la declare, et web/index.html vit au niveau de main.go, pas de ce
// paquet. main() copie les octets embarques ici avant de servir.
var AccueilHTML []byte

// entetes pose sur chaque reponse ce qui ne depend pas de la route. Le
// Header() est ecrit AVANT que le gestionnaire n'appelle WriteHeader :
// une fois le statut envoye, les en-tetes sont figes et l'ajout serait
// perdu sans la moindre erreur.
func entetes(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Ramure-Version", Version)
		suivant.ServeHTTP(w, r)
	})
}

// Routes construit le routeur de l'application. d est cablee une seule
// fois par main() et transporte par fermeture jusqu'a /api/centre.
func Routes(d arbre.Dependances) http.Handler {
	mux := http.NewServeMux()

	// La sonde de sante ne depend d'AUCUNE source externe (N-06) : une
	// sonde qui interrogerait MusicBrainz declarerait le conteneur malsain
	// a la premiere panne de MusicBrainz.
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})

	// {$} impose une correspondance EXACTE sur "/". Sans lui, "GET /" est
	// un motif de prefixe qui capte tout chemin inconnu.
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(AccueilHTML)
	})

	mux.HandleFunc("GET /api/centre", centreHandler(d))

	return entetes(mux)
}
