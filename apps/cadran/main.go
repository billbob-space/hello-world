// cadran — l'heure du serveur billbob.ovh, sur un cadran a aiguilles.
//
// L'heure affichee est celle du SERVEUR, jamais celle du poste qui regarde :
// la page arrive avec l'horodatage du serveur, le navigateur en deduit son
// propre ecart et fait avancer les aiguilles sur cette base. Une horloge de
// poste dereglee n'a donc aucun effet sur ce qui s'affiche.
//
// Les angles des trois aiguilles sont calcules au serveur et poses dans la
// page : sans JavaScript, le cadran est juste mais fige — jamais casse.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Une image Alpine n'embarque pas la base des fuseaux horaires :
	// time.LoadLocation y echouerait pour tout nom autre qu'UTC ou Local.
	// Cet import embarque la base dans le binaire — environ 450 Ko, et aucune
	// dependance ajoutee a l'image.
	_ "time/tzdata"
)

//go:embed page.html
var assets embed.FS

// version identifie l'image deployee. Elle est posee a la construction par
// -ldflags "-X main.version=..." et vaut le SHA du commit en CI ; "dev" en
// construction locale.
var version = "dev"

// zoneDefaut est le fuseau du serveur. TZ le surcharge ; un nom inconnu fait
// tomber sur UTC avec une trace, plutot que d'empecher l'app de demarrer.
const zoneDefaut = "Europe/Paris"

// aiguilles porte les angles des trois aiguilles, en degres depuis midi, sens
// horaire. C'est la seule vraie logique de l'application.
type aiguilles struct {
	Heure   float64
	Minute  float64
	Seconde float64
}

// angles calcule la position des aiguilles a un instant donne.
//
// Les trois aiguilles avancent continument : l'aiguille des heures derive avec
// les minutes, celle des minutes avec les secondes. C'est ce que fait une
// horloge mecanique, et c'est ce qui distingue 6 h 30 — aiguille des heures a
// 195°, a mi-chemin du 6 et du 7 — d'un cadran qui la laisserait sur le 6.
func angles(t time.Time) aiguilles {
	s := float64(t.Second()) + float64(t.Nanosecond())/1e9
	m := float64(t.Minute()) + s/60
	h := float64(t.Hour()%12) + m/60
	return aiguilles{
		Heure:   h * 30, // 360° / 12 h
		Minute:  m * 6,  // 360° / 60 min
		Seconde: s * 6,
	}
}

// rotation formate un angle en transformation CSS. Le type template.CSS dit a
// html/template que la valeur est sure : elle est calculee ici a partir d'une
// heure, jamais d'une entree du client.
func rotation(deg float64) template.CSS {
	return template.CSS(fmt.Sprintf("rotate(%.4fdeg)", deg))
}

type marque struct {
	Rotation template.CSS
	Majeure  bool // les douze heures, plus longues et plus claires
}

type chiffre struct {
	Texte string
	// Placement fait pivoter le chiffre autour du centre, le pousse vers le
	// bord, puis le redresse — sinon un « 6 » arriverait la tete en bas.
	Placement template.CSS
}

type pageData struct {
	Heure        string // 14:03:27, l'heure du serveur au moment du rendu
	Date         string // mardi 2 aout 2026
	Zone         string // Europe/Paris
	Decalage     string // UTC+02:00
	ISO          string // RFC3339 a la nanoseconde : la base de synchronisation
	Aiguilles    aiguilles
	RotHeure     template.CSS
	RotMinute    template.CSS
	RotSeconde   template.CSS
	Marques      []marque
	Chiffres     []chiffre
	Version      string
	VersionShort string
}

// heureJSON est la reponse de /api/heure, que la page appelle pour se
// resynchroniser. Format volontairement minuscule : c'est un battement.
type heureJSON struct {
	ISO      string `json:"iso"`
	Zone     string `json:"zone"`
	Decalage int    `json:"decalage_s"`
}

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	loc := chargerZone(env("TZ", zoneDefaut))

	page, err := template.ParseFS(assets, "page.html")
	if err != nil {
		log.Fatalf("modele de page illisible : %v", err)
	}

	addr := ":" + env("PORT", "8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           logging(routes(page, loc)),
		ReadHeaderTimeout: 5 * time.Second,
		// Sans WriteTimeout, un client qui cesse de lire la reponse retient sa
		// connexion sans limite. La plus grosse reponse est la page, quelques
		// dizaines de kilo-octets rendues en une passe : dix secondes sont
		// larges. IdleTimeout etant pose juste en dessous, c'est lui qui regit
		// l'attente entre deux requetes — le maintien de connexion n'est pas
		// coupe par ce delai d'ecriture.
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Arret propre : le serveur cesse d'accepter et laisse les requetes en
	// cours se terminer, pour qu'un redeploiement ne coupe personne.
	//
	// NotifyContext porte l'abonnement aux signaux dans un contexte plutot que
	// dans un canal : le desabonnement devient un defer, la ou signal.Notify
	// demandait de ne pas l'oublier.
	ctx, neplusEcouter := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer neplusEcouter()

	go func() {
		log.Printf("ecoute sur %s, fuseau %s", addr, loc)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur arrete : %v", err)
		}
	}()

	<-ctx.Done()
	// Rendre les signaux a leur comportement par defaut : un second SIGTERM,
	// envoye parce que la fermeture s'eternise, redevient un arret immediat au
	// lieu d'etre avale par l'abonnement.
	neplusEcouter()
	log.Print("arret demande, fermeture en cours")

	fermeture, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	if err := srv.Shutdown(fermeture); err != nil {
		log.Printf("fermeture forcee : %v", err)
	}
}

// routes assemble le serveur. main() et les tests appellent cette meme
// fonction : une route ajoutee ici est testee d'office, alors qu'un mux
// reconstruit dans le fichier de test laisserait passer une route non couverte
// sans que rien ne le signale.
func routes(page *template.Template, loc *time.Location) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/heure", handleHeure(loc))
	mux.HandleFunc("GET /{$}", handleHome(page, loc))
	return withVersion(mux)
}

// chargerZone resout un nom de fuseau. Un nom inconnu ne doit pas empecher le
// demarrage : le contrat impose une app qui demarre sans intervention.
func chargerZone(nom string) *time.Location {
	loc, err := time.LoadLocation(nom)
	if err != nil {
		log.Printf("fuseau %q inconnu (%v) — repli sur UTC", nom, err)
		return time.UTC
	}
	return loc
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func handleHeure(loc *time.Location) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		t := time.Now().In(loc)
		_, decalage := t.Zone()

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		// Un battement ne se met pas en cache : sans cela un mandataire
		// resservirait une heure ancienne, et la page se resynchroniserait
		// sur le passe.
		w.Header().Set("Cache-Control", "no-store")
		if err := json.NewEncoder(w).Encode(heureJSON{
			ISO:      t.Format(time.RFC3339Nano),
			Zone:     loc.String(),
			Decalage: decalage,
		}); err != nil {
			log.Printf("encodage de /api/heure : %v", err)
		}
	}
}

func handleHome(page *template.Template, loc *time.Location) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		t := time.Now().In(loc)
		a := angles(t)

		data := pageData{
			Heure:        t.Format("15:04:05"),
			Date:         dateFr(t),
			Zone:         loc.String(),
			Decalage:     decalageFr(t),
			ISO:          t.Format(time.RFC3339Nano),
			Aiguilles:    a,
			RotHeure:     rotation(a.Heure),
			RotMinute:    rotation(a.Minute),
			RotSeconde:   rotation(a.Seconde),
			Marques:      marques(),
			Chiffres:     chiffres(),
			Version:      version,
			VersionShort: shortVersion(),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if err := page.Execute(w, data); err != nil {
			// L'en-tete est deja parti : on ne peut que tracer.
			log.Printf("rendu de la page : %v", err)
		}
	}
}

// marques produit les soixante graduations du cadran, majeures aux heures.
func marques() []marque {
	m := make([]marque, 0, 60)
	for i := range 60 {
		m = append(m, marque{
			Rotation: rotation(float64(i) * 6),
			Majeure:  i%5 == 0,
		})
	}
	return m
}

// chiffres pose les quatre cardinaux. Douze chiffres encombreraient un cadran
// dont les aiguilles sont deja de la meme encre ; quatre suffisent a orienter.
func chiffres() []chiffre {
	c := make([]chiffre, 0, 4)
	for _, h := range []int{12, 3, 6, 9} {
		deg := float64(h%12) * 30
		c = append(c, chiffre{
			Texte: fmt.Sprintf("%d", h),
			Placement: template.CSS(fmt.Sprintf(
				"rotate(%.4fdeg) translateY(-34%%) rotate(%.4fdeg)", deg, -deg)),
		})
	}
	return c
}

var joursFr = [...]string{"dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"}

var moisFr = [...]string{"janvier", "fevrier", "mars", "avril", "mai", "juin",
	"juillet", "aout", "septembre", "octobre", "novembre", "decembre"}

// dateFr ecrit la date en toutes lettres. La bibliotheque standard ne connait
// que l'anglais ; deux tables valent mieux qu'une dependance.
func dateFr(t time.Time) string {
	jour := fmt.Sprintf("%d", t.Day())
	if t.Day() == 1 {
		jour = "1er"
	}
	return fmt.Sprintf("%s %s %s %d", joursFr[int(t.Weekday())], jour, moisFr[int(t.Month())-1], t.Year())
}

// decalageFr rend le decalage sous la forme UTC+02:00, lisible sans calcul.
func decalageFr(t time.Time) string {
	_, s := t.Zone()
	signe := "+"
	if s < 0 {
		signe = "-"
		s = -s
	}
	return fmt.Sprintf("UTC%s%02d:%02d", signe, s/3600, (s%3600)/60)
}

// shortVersion raccourcit un SHA de commit a sa forme usuelle. La valeur
// complete reste dans l'attribut title et dans l'en-tete X-App-Version.
func shortVersion() string {
	const court = 7
	if len(version) > court {
		return version[:court]
	}
	return version
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

// logging trace chaque requete sur la sortie standard. L'identite transmise
// par Traefik n'y figure pas : les logs ne sont pas un journal de frequentation.
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
