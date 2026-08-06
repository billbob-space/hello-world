// marcq-handball — le programme d'ete U15 du Marcq Handball.
//
// Le serveur ne connait aucun utilisateur et n'a aucun etat : il sert la coque
// embarquee et une sonde de sante. L'application est en palier public, ou
// Traefik n'authentifie personne et ne pose donc aucun en-tete d'identite ;
// tout ce qu'un client enverrait sous ce nom serait une valeur qu'il a choisie
// lui-meme. Le domaine et la progression vivent dans le navigateur.
package main

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// L'image finale est Alpine, qui n'embarque pas la base des fuseaux. Sans
	// cet import, time.LoadLocation("Europe/Paris") echoue dans le conteneur
	// alors qu'elle reussit sur un poste de developpement, et jourParis se
	// replierait sur UTC : le denominateur du classement serait faux deux
	// heures par jour, tous les jours. Environ 450 Ko dans le binaire.
	_ "time/tzdata"
)

// go:embed n'emporte que web/ : les tests de tests/ ne sont jamais dans
// l'image, et une edition de test n'invalide pas le cache de couches.
//
//go:embed web
var coque embed.FS

// version identifie l'image deployee. Elle est posee a la construction par
// -ldflags "-X main.version=..." et vaut le SHA du commit en CI ; "dev" en
// construction locale.
var version = "dev"

// jetonVersion est remplace par version au moment ou sw.js est charge. Le
// laisser dans le fichier source garde web/sw.js executable tel quel par un
// navigateur et lisible par node --test, sans etage de construction.
const jetonVersion = "__VERSION__"

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	web, err := fs.Sub(coque, "web")
	if err != nil {
		log.Fatalf("coque illisible : %v", err)
	}

	sw, err := chargerServiceWorker(web)
	if err != nil {
		log.Fatalf("service worker illisible : %v", err)
	}

	cl := ouvrirMagasin(web)

	addr := ":" + env("PORT", "8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           logging(routes(web, sw, cl)),
		ReadHeaderTimeout: 5 * time.Second,
		// Sans ReadTimeout, un corps envoye octet par octet immobilise une
		// connexion indefiniment. C'est le seul endroit du projet ou un inconnu
		// peut envoyer un corps.
		ReadTimeout: 10 * time.Second,
		IdleTimeout: 60 * time.Second,
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

// routes assemble le serveur. main() et les tests appellent cette meme
// fonction : une route ajoutee ici est testee d'office, alors qu'un mux
// reconstruit dans le fichier de test laisserait passer une route non couverte.
//
// La coque est servie A LA RACINE, pas sous /web/ : la portee du service worker
// et les chemins des imports ES doivent coincider avec les URL servies.
// cl == nil est un etat valide : les trois routes /api/* repondent alors 503,
// et l'application sert exactement le lot 1.
func routes(web fs.FS, sw []byte, cl *classement) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleSante)
	mux.HandleFunc("GET /sw.js", handleServiceWorker(sw))
	mux.HandleFunc("GET /programme.json", fichier(web, "programme.json",
		"application/json; charset=utf-8", "no-cache"))
	mux.HandleFunc("GET /api/classement", handleClassementGet(cl))
	mux.HandleFunc("POST /api/classement", handleClassementPost(cl))
	mux.HandleFunc("GET /api/coach", handleCoach(cl))
	// Motif le moins specifique : le ServeMux de Go 1.22 donne la priorite aux
	// trois routes ci-dessus, et celle-ci recoit tout le reste — index.html a
	// la racine, les modules ES, style.css, et un 404 pour l'inconnu.
	mux.Handle("GET /", http.FileServerFS(web))
	return withVersion(mux)
}

// chargerServiceWorker lit sw.js et y injecte la version du binaire. Le nom du
// cache en depend : sans cette substitution, pull_policy: always deploierait
// une image neuve que le navigateur n'afficherait jamais.
//
// L'absence du jeton empeche le demarrage plutot que de passer inapercue : une
// coque figee dans un cache eternel est un defaut qui ne se manifeste que sur
// le telephone de quelqu'un d'autre, trois semaines plus tard.
func chargerServiceWorker(web fs.FS) ([]byte, error) {
	source, err := fs.ReadFile(web, "sw.js")
	if err != nil {
		return nil, err
	}
	if !bytes.Contains(source, []byte(jetonVersion)) {
		return nil, fmt.Errorf("jeton %s absent de web/sw.js : le cache ne serait pas versionne", jetonVersion)
	}
	return bytes.ReplaceAll(source, []byte(jetonVersion), []byte(version)), nil
}

// ouvrirMagasin prepare le classement, et rend nil quand il n'a pas lieu
// d'etre. Aucun de ses echecs n'empeche l'application de demarrer : le
// classement est optionnel, la coque ne l'est pas. Un montage appartenant a
// root — le mode de panne le plus probable et le plus silencieux — se lit ici,
// dans les journaux du conteneur, avant tout trafic.
func ouvrirMagasin(web fs.FS) *classement {
	dossier := env("MARCQ_DONNEES", "")
	if dossier == "" {
		log.Print("classement : MARCQ_DONNEES absent, classement desactive — les routes /api repondent 503")
		return nil
	}

	donnees, err := fs.ReadFile(web, "programme.json")
	if err != nil {
		log.Printf("classement : programme.json illisible, classement desactive : %v", err)
		return nil
	}
	prog, err := chargerProgramme(donnees)
	if err != nil {
		log.Printf("classement : programme invalide, classement desactive : %v", err)
		return nil
	}

	cl, err := ouvrirClassement(dossier, prog, time.Now)
	if err != nil {
		log.Printf("classement : %s inutilisable, classement desactive : %v", dossier, err)
		return nil
	}
	log.Printf("classement : actif sur %s", dossier)
	return cl
}

func handleSante(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func handleServiceWorker(source []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		// no-cache et non no-store : le navigateur revalide a chaque
		// chargement. C'est la condition pour qu'une version deployee prenne
		// la main au rechargement suivant plutot que dans une journee.
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(source)
	}
}

// fichier sert une entree precise de la coque avec un type MIME et une
// directive de cache explicites, la ou le serveur de fichiers ne saurait poser
// que le premier. Un nom absent de la coque rend 404, jamais une panique.
func fichier(web fs.FS, nom, typeMime, cache string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		contenu, err := fs.ReadFile(web, nom)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", typeMime)
		w.Header().Set("Cache-Control", cache)
		_, _ = w.Write(contenu)
	}
}

// withVersion annonce la version deployee sur toutes les reponses, y compris
// celle du healthcheck. Verifier un deploiement ne demande alors pas d'ouvrir
// la page : l'en-tete suffit.
func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

// logging trace chaque requete sur la sortie standard. Rien d'identifiant n'y
// figure : l'app est publique, ses journaux ne doivent rien apprendre de qui
// s'entraine.
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
