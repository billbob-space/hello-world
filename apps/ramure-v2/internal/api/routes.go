// apps/ramure-v2/internal/api/routes.go
// Le routeur unique de l'application (PRP 04). Le PRP 01 a laisse ouverte
// la decision entre variables de paquet et signature elargie ; ce PRP
// tranche pour l'elargissement : Routes prend Dependances en argument, ce
// qui permet a go test -race d'executer plusieurs tests en parallele avec
// des doublures differentes. Les PRP 06 et 07 elargissent Dependances et
// ajoutent leurs routes ICI, jamais en introduisant un second routeur.
package api

import (
	"io/fs"
	"net/http"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/equite"
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

// Dist porte le bundle esbuild du client (web/dist, PRP 05), embarque et
// reduit par main.go via fs.Sub avant d'etre confie ici. Meme mecanisme
// que AccueilHTML : go:embed n'accepte pas de chemin hors du repertoire de
// main.go, qui copie donc la reference avant que Routes() ne serve.
var Dist fs.FS

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

	// /api/centre est le geste le plus couteux du produit (§13) : seule
	// route enveloppee par equite.Garde, qui impose un seul chargement en
	// vol par identite (N-14, critique) — le palier google n'est pas une
	// liste blanche, un visiteur seul ne doit pas pouvoir manger le quota
	// commun en enchainant les promotions plus vite que le limiteur ne les
	// espace.
	mux.Handle("GET /api/centre", equite.Garde(http.HandlerFunc(centreHandler(d))))
	mux.HandleFunc("GET /api/suggest", suggestHandler(d))
	mux.HandleFunc("GET /api/fiche", ficheHandler(d))
	mux.HandleFunc("GET /api/ecouter", ecouterHandler(d))

	// Identite, collection, reglages, mesure (PRP 07). Cloisonnees par
	// X-Forwarded-User, jamais par un parametre du client (N-08) : voir
	// internal/identite. Collection/Reglages/Mesure sont des variables de
	// paquet cablees par main() (comme Dist et AccueilHTML plus haut) ;
	// rester nil dans un test qui ne les sollicite pas ne fait rien
	// planter, les gestionnaires le verifient.
	mux.HandleFunc("GET /api/collection", collectionListerHandler)
	mux.HandleFunc("PUT /api/collection", collectionAjouterHandler)
	mux.HandleFunc("DELETE /api/collection", collectionRetirerHandler)
	mux.HandleFunc("GET /api/reglages", reglagesLireHandler)
	mux.HandleFunc("PUT /api/reglages", reglagesEcrireHandler)
	mux.HandleFunc("GET /api/diagnostic", diagnosticHandler)

	// Le bundle client (PRP 05). Servi seulement si Dist a ete cable par
	// main() : les tests de ce paquet, qui construisent leur propre
	// routeur sans jamais appeler main(), n'ont pas besoin d'un
	// repertoire dist et ne doivent pas paniquer pour autant.
	if Dist != nil {
		mux.Handle("GET /dist/", http.StripPrefix("/dist/", http.FileServerFS(Dist)))
	}

	return entetes(mux)
}
