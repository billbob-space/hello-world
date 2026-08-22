// estran — meteo marine et jauge de maree pour Le Touquet-Paris-Plage /
// Etaples. Une seule stack, un seul secteur : pas de recherche, pas de menu
// de villes (PRODUCT.md, principe 1).
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	// Une image Alpine n'embarque pas la base des fuseaux horaires : ce
	// paquet blanc l'embarque dans le binaire (cf. apps/cadran/main.go).
	_ "time/tzdata"
)

//go:embed web
var webFS embed.FS

// version identifie l'image deployee. Posee a la construction par
// -ldflags "-X main.version=..." ; "dev" en construction locale.
var version = "dev"

// latitude, longitude : Le Touquet-Paris-Plage, coordonnees du port de
// reference du bulletin marine consulte pour construire ce produit. Ne sont
// plus les SEULES coordonnees possibles (prp/04-le-lieu-devient-une-donnee.md
// en fait un parametre de requete, lat/lon) mais restent le lieu par DEFAUT :
// sans lat/lon dans la requete, le comportement reste celui d'avant ce
// document, a l'octet pres.
const (
	latitude  = 50.517
	longitude = 1.583
	// siteMaree est le site de maree par defaut, associe au lieu par defaut
	// ci-dessus — le point le plus proche disponible chez api-maree.fr, faute
	// d'entree pour Etaples/Le Touquet (approximation assumee et documentee,
	// cf. prp/00-ossature.md). Pour tout autre lieu, le site se resout
	// desormais par le catalogue (lieu.go).
	siteMaree = "berck-plage-fort-mahon"
)

var parisTZ = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		log.Fatalf("fuseau Europe/Paris introuvable : %v", err)
	}
	return loc
}()

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	srv := nouveauServeur(
		NouveauClientMeteo(),
		NouveauClientMaree(env("API_MAREE_KEY", "")),
		NouveauClientPluie(),
		NouveauClientNowcast(),
		NouveauCatalogueMaree(),
	)

	web, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("web embarque illisible : %v", err)
	}

	httpSrv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           logging(withVersion(routes(srv, web))),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, neplusEcouter := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer neplusEcouter()

	go func() {
		log.Printf("ecoute sur %s", httpSrv.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur arrete : %v", err)
		}
	}()

	<-ctx.Done()
	neplusEcouter()
	log.Print("arret demande, fermeture en cours")

	fermeture, annuler := context.WithTimeout(context.Background(), 10*time.Second)
	defer annuler()
	if err := httpSrv.Shutdown(fermeture); err != nil {
		log.Printf("fermeture forcee : %v", err)
	}
}

// serveur porte les clients de donnees et le dernier connu de chacun, PAR
// LIEU depuis prp/04-le-lieu-devient-une-donnee.md (section 4) : un champ par
// fournisseur, chacun degrade independamment des autres, et desormais aussi
// independamment d'un lieu a l'autre — la meteo du Touquet ne doit jamais
// resservir sous le nom d'Arras.
type serveur struct {
	clientMeteo *ClientMeteo
	meteoCache  *parLieu[Previsions]
	clientMaree *ClientMaree
	mareeCache  *parLieu[Maree]
	// La courbe de pluie et la bande de l'heure ont chacune leur dernier
	// connu, distinct de celui de la meteo : la bande peut etre resservie
	// depuis le cache pendant que la courbe est fraiche, et l'echec de l'une
	// ne doit pas retirer l'autre de l'ecran
	// (prp/03-graphe-de-pluie.md, section 4).
	clientPluie   *ClientPluie
	pluieCache    *parLieu[SeriePluie]
	clientNowcast *ClientNowcast
	nowcastCache  *parLieu[Nowcast]

	// catalogue et httpLieu servent la resolution d'un lieu (lieu.go) :
	// recherche/geolocalisation (BAN) et site de maree le plus proche.
	// littoralCache retient le dernier caractere littoral connu, par lieu
	// (§2.1) : un HTTP propre plutot que celui, deja timeouté a 10s, des
	// autres clients — les appels de littoral sont bornes bien plus court
	// (delaiLittoral).
	catalogue     *CatalogueMaree
	httpLieu      *http.Client
	littoralCache *parLieu[bool]
}

func nouveauServeur(cm *ClientMeteo, cma *ClientMaree, cp *ClientPluie, cn *ClientNowcast, cat *CatalogueMaree) *serveur {
	return &serveur{
		clientMeteo:   cm,
		meteoCache:    nouveauParLieu[Previsions](),
		clientMaree:   cma,
		mareeCache:    nouveauParLieu[Maree](),
		clientPluie:   cp,
		pluieCache:    nouveauParLieu[SeriePluie](),
		clientNowcast: cn,
		nowcastCache:  nouveauParLieu[Nowcast](),
		catalogue:     cat,
		httpLieu:      &http.Client{Timeout: 10 * time.Second},
		littoralCache: nouveauParLieu[bool](),
	}
}

func routes(s *serveur, web fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/previsions", s.handlePrevisions)
	mux.HandleFunc("GET /api/maree", s.handleMaree)
	mux.HandleFunc("GET /api/pluie", s.handlePluie)
	mux.HandleFunc("GET /api/lieux", s.handleLieux)
	mux.HandleFunc("GET /api/lieu", s.handleLieu)
	mux.Handle("GET /", http.FileServer(http.FS(web)))
	return mux
}

// handleHealth ne depend d'aucun fournisseur externe : un `wget` local ne
// doit pas rendre le conteneur malsain parce qu'Open-Meteo ou api-maree.fr
// sont indisponibles (prp/00-ossature.md, « degrader, jamais casser »).
func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func (s *serveur) handlePrevisions(w http.ResponseWriter, r *http.Request) {
	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	lat, lon, err := parametreLieuOuDefaut(r)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	cle := cleLieu(lat, lon)

	// 12s : le fournisseur meteo fait jusqu'a trois appels sortants
	// sequentiels (previsions+marine, plus l'accord entre modeles borne a
	// 4s, meteo.go) ; 8s s'est revele tangent en pratique sur une connexion
	// qui demarre a froid.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	// Les vignettes horaires portent desormais la lame d'eau attendue, tiree
	// de la MEME serie que la courbe de la section pluie (domaine.go,
	// pluieParHeure) : c'est ce partage qui les empeche de se contredire. La
	// serie est donc demandee ici aussi — mais EN PARALLELE de la meteo et
	// bornee plus court qu'elle, parce que prp/03-graphe-de-pluie.md section 3
	// tient toujours : une source lente ne doit pas retarder l'ecran
	// principal. Si elle traine ou tombe, les vignettes sortent sans leur
	// ligne de pluie et le reste de l'ecran est intact.
	serie := make(chan SeriePluie, 1)
	go func() {
		ctxPluie, annulerPluie := context.WithTimeout(ctx, delaiPluieVignettes)
		defer annulerPluie()
		v, _, _, err := s.pluieCache.pour(cle).rafraichir(func() (SeriePluie, error) {
			return s.clientPluie.Recuperer(ctxPluie, lat, lon)
		})
		if err != nil {
			log.Printf("lame d'eau des vignettes indisponible : %v", err)
		}
		serie <- v
	}()

	valeur, _, frais, err := s.meteoCache.pour(cle).rafraichir(func() (Previsions, error) {
		return s.clientMeteo.Recuperer(ctx, lat, lon)
	})
	if err != nil {
		log.Printf("previsions indisponibles : %v", err)
		// Message LU PAR L'UTILISATEUR, pas une trace : accents compris (il
		// s'affichait « previsions » sans accent, seul de tous les messages
		// visibles de l'app), et il dit ce qui se passe ensuite. Une section
		// muette pendant qu'une autre fonctionne est un etat ordinaire ici
		// (README, « Degradation ») : sans cette derniere phrase, l'utilisateur
		// conclut que l'application est cassee et recharge pour rien.
		//
		// MEME GABARIT DE PHRASE que les trois autres sections (web/app.js,
		// carteIndisponible) : « <Sujet> indisponible : <qui ne repond pas>.
		// Nouvelle tentative automatique dans 5 minutes. » Plus de « le reste
		// de la page est a jour » : une section ne sait rien des trois autres,
		// et en panne totale cette phrase s'affichait trois fois alors qu'elle
		// etait fausse les trois fois (mesure au navigateur, 21 aout 2026).
		repondreJSON(w, http.StatusOK, map[string]string{"erreur": "Prévisions indisponibles : Open-Meteo ne répond pas. Nouvelle tentative automatique dans 5 minutes."})
		return
	}

	repondreJSON(w, http.StatusOK, vuePrevisions(valeur, <-serie, maintenant, frais, dateCible))
}

// delaiPluieVignettes borne la serie de pluie DANS la route previsions, en
// sous-contexte du contexte de la requete — meme forme que delaiNowcast dans
// la section pluie, et pour la meme raison : la lame d'eau est un supplement
// de la vignette, jamais sa promesse. Plus court que les 12 s de la route
// entiere pour qu'un fournisseur qui traine coute au pire ce delai-la, et non
// l'ecran. Deux appels legers, en parallele de la meteo qui en fait trois : en
// pratique la serie est prete avant elle et n'ajoute rien au temps de reponse.
const delaiPluieVignettes = 6 * time.Second

func (s *serveur) handleMaree(w http.ResponseWriter, r *http.Request) {
	if s.clientMaree.CleAPI == "" {
		repondreJSON(w, http.StatusOK, ReponseMaree{Configure: false})
		return
	}

	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	lat, lon, present, err := parametreLatLon(r)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}

	// 12s : chaque fournisseur fait deux appels sortants sequentiels
	// (previsions+marine, ou extrema+niveaux) ; 8s s'est revele tangent en
	// pratique sur une connexion qui demarre a froid.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	// Sans lat/lon, le lieu et le site restent ceux d'avant ce document, a
	// l'octet pres (prp/04-le-lieu-devient-une-donnee.md, section 3) : le
	// catalogue n'est meme pas interroge.
	site := siteMaree
	if present {
		siteProche, distanceKm, ok := s.catalogue.plusProche(ctx, lat, lon)
		switch {
		case !ok:
			repondreJSON(w, http.StatusOK, ReponseSansMaree{Configure: true, SansMaree: true, Raison: raisonCatalogueIndisponible})
			return
		case distanceKm > seuilFacadeKm:
			d := arrondi1(distanceKm)
			repondreJSON(w, http.StatusOK, ReponseSansMaree{Configure: true, SansMaree: true, Raison: raisonFacadeNonCouverte, DistanceKm: &d, SiteLePlusProche: siteProche.Nom})
			return
		case distanceKm > seuilSiteKm:
			d := arrondi1(distanceKm)
			repondreJSON(w, http.StatusOK, ReponseSansMaree{Configure: true, SansMaree: true, Raison: raisonCoteEloignee, DistanceKm: &d, SiteLePlusProche: siteProche.Nom})
			return
		default:
			site = siteProche.ID
		}
	} else {
		lat, lon = latitude, longitude
	}

	valeur, _, frais, err := s.mareeCache.pour(cleLieuMaree(lat, lon, site)).rafraichir(func() (Maree, error) {
		return s.clientMaree.Recuperer(ctx, site)
	})
	if err != nil {
		log.Printf("maree indisponible : %v", err)
		// La carte d'indisponibilite n'a plus de titre depuis l'unification du
		// 20 aout 2026 (web/app.js, carteIndisponible) : ce message etait donc
		// le seul des quatre a ne pas dire de QUOI il parle — il commencait par
		// « api-maree.fr ». Il porte desormais le meme gabarit de phrase que
		// les trois autres : « <Sujet> indisponible : <qui ne repond pas>.
		// Nouvelle tentative automatique dans 5 minutes. »
		repondreJSON(w, http.StatusOK, ReponseMaree{Configure: true, Erreur: "Marée indisponible : api-maree.fr ne répond pas. Nouvelle tentative automatique dans 5 minutes."})
		return
	}

	if dateCible == nil {
		repondreJSON(w, http.StatusOK, vueMaree(valeur, frais, site))
		return
	}
	repondreJSON(w, http.StatusOK, vueMareeJour(valeur, frais, site, *dateCible))
}

// handlePluie sert la section Pluie, sur une route distincte de
// /api/previsions pour trois raisons (prp/03-graphe-de-pluie.md, section 3) :
// une source lente ne doit pas retarder l'ecran principal, la bande de
// l'heure se rafraichit plus souvent que la tendance a seize jours, et la
// panne de l'une se lit sans contaminer l'autre.
func (s *serveur) handlePluie(w http.ResponseWriter, r *http.Request) {
	maintenant := time.Now().In(parisTZ)
	dateCible, err := parametreDate(r, maintenant)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	lat, lon, err := parametreLieuOuDefaut(r)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	cle := cleLieu(lat, lon)

	// 12s : le fournisseur de la courbe fait deux appels sortants sequentiels
	// (horaire puis quart d'heure), comme les deux autres routes.
	ctx, annuler := context.WithTimeout(r.Context(), 12*time.Second)
	defer annuler()

	serie, _, frais, err := s.pluieCache.pour(cle).rafraichir(func() (SeriePluie, error) {
		return s.clientPluie.Recuperer(ctx, lat, lon)
	})
	if err != nil {
		log.Printf("pluie indisponible : %v", err)
	}

	// La bande de l'heure est bornee a part et n'est demandee QUE pour
	// aujourd'hui : sur un autre jour elle ne serait pas affichee, et l'appel
	// serait paye pour rien. Son echec ne remonte jamais — la section garde
	// la courbe.
	var bande *Nowcast
	if dateCible == nil || debutDuJour(*dateCible).Equal(debutDuJour(maintenant)) {
		ctxBande, annulerBande := context.WithTimeout(ctx, delaiNowcast)
		defer annulerBande()
		if n, _, _, err := s.nowcastCache.pour(cle).rafraichir(func() (Nowcast, error) {
			return s.clientNowcast.Recuperer(ctxBande, lat, lon)
		}); err != nil {
			log.Printf("prevision immediate indisponible : %v", err)
		} else {
			bande = &n
		}
	}

	repondreJSON(w, http.StatusOK, vuePluie(serie, bande, maintenant, frais, dateCible))
}

// delaiRechercheLieu borne l'appel de geocodage (BAN) lui-meme, distinct de
// delaiLittoral ci-dessous qui borne les appels marine paralleles declenches
// par ses resultats.
const delaiRechercheLieu = 8 * time.Second

// delaiLittoral borne A 4S AU TOTAL les appels marine paralleles d'une
// recherche (prp/04-le-lieu-devient-une-donnee.md, section 3) : jusqu'a 8
// resultats, chacun un lieu dont l'appel n'a pas abouti sort avec
// littoral: null plutot que de retarder toute la reponse.
const delaiLittoral = 4 * time.Second

// handleLieux sert /api/lieux?q= : la recherche de lieux (§1.3, §3). Rend
// pour chaque resultat le Lieu complet (caractere littoral, site de maree)
// — c'est ce qui permet a l'ecran d'annoncer ce qu'on va trouver avant de
// changer de lieu.
func (s *serveur) handleLieux(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		repondreJSON(w, http.StatusOK, ReponseLieux{Lieux: []Lieu{}})
		return
	}

	ctx, annuler := context.WithTimeout(r.Context(), delaiRechercheLieu)
	defer annuler()

	rep, err := rechercherCommunes(ctx, s.httpLieu, q)
	if err != nil {
		log.Printf("recherche de lieux indisponible : %v", err)
		repondreJSON(w, http.StatusOK, ReponseLieux{Lieux: []Lieu{}, Erreur: "Recherche indisponible : la base adresse nationale ne répond pas."})
		return
	}

	lieux := make([]Lieu, len(rep.Features))
	ctxMarine, annulerMarine := context.WithTimeout(ctx, delaiLittoral)
	defer annulerMarine()
	var attente sync.WaitGroup
	for i, f := range rep.Features {
		lat, lon := arrondi3(f.Geometry.Coordinates[1]), arrondi3(f.Geometry.Coordinates[0]) // GeoJSON : [lon, lat]
		lieux[i] = Lieu{Nom: f.Properties.Name, Contexte: f.Properties.Context, Latitude: lat, Longitude: lon}
		lieux[i].Maree = siteMareeDuLieu(s.catalogue, ctx, lat, lon)

		attente.Add(1)
		go func(i int, lat, lon float64) {
			defer attente.Done()
			lieux[i].Littoral = resoudreLittoral(s.littoralCache.pour(cleLieu(lat, lon)), ctxMarine, s.httpLieu, lat, lon)
		}(i, lat, lon)
	}
	attente.Wait()

	repondreJSON(w, http.StatusOK, ReponseLieux{Lieux: lieux})
}

// handleLieu sert /api/lieu?lat=&lon= : resout un point en Lieu (nom par
// geolocalisation inverse BAN, caractere littoral, site de maree). En mer ou
// hors de France, la BAN rend Features vide : le Lieu sort SANS NOM, jamais
// un nom invente — c'est a l'ecran de choisir quoi ecrire (§3, prp/05).
func (s *serveur) handleLieu(w http.ResponseWriter, r *http.Request) {
	lat, lon, present, err := parametreLatLon(r)
	if err != nil {
		repondreErreur(w, http.StatusBadRequest, err.Error())
		return
	}
	if !present {
		repondreErreur(w, http.StatusBadRequest, "les paramètres lat et lon sont requis")
		return
	}

	ctx, annuler := context.WithTimeout(r.Context(), delaiRechercheLieu)
	defer annuler()

	l := Lieu{Latitude: lat, Longitude: lon}
	if rep, err := inverserPoint(ctx, s.httpLieu, lat, lon); err != nil {
		log.Printf("résolution de lieu indisponible : %v", err)
	} else if len(rep.Features) > 0 {
		l.Nom = rep.Features[0].Properties.City
		l.Contexte = rep.Features[0].Properties.Context
	}
	l.Maree = siteMareeDuLieu(s.catalogue, ctx, lat, lon)

	ctxMarine, annulerMarine := context.WithTimeout(ctx, delaiLittoral)
	defer annulerMarine()
	l.Littoral = resoudreLittoral(s.littoralCache.pour(cleLieu(lat, lon)), ctxMarine, s.httpLieu, lat, lon)

	repondreJSON(w, http.StatusOK, l)
}

// delaiNowcast borne la bande de l'heure, en sous-contexte du contexte de la
// requete : elle est un supplement, jamais la promesse de la section
// (prp/03-graphe-de-pluie.md, section 4) — si elle traine, la courbe du jour
// doit tout de meme s'afficher a temps.
const delaiNowcast = 4 * time.Second

// parametreDate lit le parametre optionnel `date` (AAAA-MM-JJ, interprete en
// Europe/Paris). Absent, il rend (nil, nil) : la reponse doit alors rester
// celle d'aujourd'hui, a l'octet pres — c'est la contrainte principale de
// prp/01-navigation-temporelle.md. Present mais illisible ou hors de la
// fenetre de navigation (joursNavigationArriere/Avant jours de part et
// d'autre d'aujourd'hui), il rend une erreur explicite : rendre la donnee
// d'un autre jour serait pire que ne rien afficher.
func parametreDate(r *http.Request, maintenant time.Time) (*time.Time, error) {
	brut := r.URL.Query().Get("date")
	if brut == "" {
		return nil, nil
	}
	d, err := time.ParseInLocation("2006-01-02", brut, parisTZ)
	if err != nil {
		return nil, fmt.Errorf("date invalide : attendu AAAA-MM-JJ")
	}
	aujourdhui := debutDuJour(maintenant)
	min := aujourdhui.AddDate(0, 0, -joursNavigationArriere)
	max := aujourdhui.AddDate(0, 0, joursNavigationAvant)
	if d.Before(min) || d.After(max) {
		return nil, fmt.Errorf("date hors de la fenêtre couverte (%s a %s)", min.Format("2006-01-02"), max.Format("2006-01-02"))
	}
	return &d, nil
}

// parametreLatLon lit les parametres optionnels `lat`/`lon`
// (prp/04-le-lieu-devient-une-donnee.md, section 3). Absents tous les deux,
// present=false et err=nil : c'est alors a l'appelant de retomber sur le lieu
// par defaut, EXACTEMENT le comportement d'avant ce document — la meme regle
// que parametreDate s'etait deja donnee pour `date`. Un seul des deux, une
// valeur illisible, ou hors de [-90,90]/[-180,180], est une erreur. Arrondis
// a 3 decimales avant tout usage (~110 m, sous la maille de tous les
// fournisseurs) : ce qui borne les cles de cache et evite qu'un GPS qui
// derive de quelques metres ne cree une entree neuve a chaque
// rafraichissement.
func parametreLatLon(r *http.Request) (lat, lon float64, present bool, err error) {
	brutLat := r.URL.Query().Get("lat")
	brutLon := r.URL.Query().Get("lon")
	if brutLat == "" && brutLon == "" {
		return 0, 0, false, nil
	}
	if brutLat == "" || brutLon == "" {
		return 0, 0, false, fmt.Errorf("les paramètres lat et lon doivent être fournis ensemble")
	}
	lat, errLat := strconv.ParseFloat(brutLat, 64)
	lon, errLon := strconv.ParseFloat(brutLon, 64)
	if errLat != nil || errLon != nil {
		return 0, 0, false, fmt.Errorf("lat/lon illisibles : attendu des nombres")
	}
	// strconv.ParseFloat("NaN", 64) reussit, et toute comparaison avec NaN
	// est fausse : le controle de bornes ci-dessous ne l'aurait pas arrete,
	// laissant passer NaN jusqu'au fournisseur (+Inf/-Inf, eux, sont deja
	// hors bornes et donc deja rejetes).
	if math.IsNaN(lat) || math.IsNaN(lon) {
		return 0, 0, false, fmt.Errorf("lat/lon illisibles : attendu des nombres")
	}
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return 0, 0, false, fmt.Errorf("lat/lon hors des bornes valides ([-90,90] / [-180,180])")
	}
	return arrondi3(lat), arrondi3(lon), true, nil
}

// parametreLieuOuDefaut est parametreLatLon suivi du repli sur le lieu par
// defaut quand lat/lon sont absents — la forme dont ont besoin les trois
// routes existantes (previsions/maree/pluie), qui n'ont jamais a distinguer
// « absent » de « lieu par defaut » au-dela de ce point.
func parametreLieuOuDefaut(r *http.Request) (lat, lon float64, err error) {
	lat, lon, present, err := parametreLatLon(r)
	if err != nil {
		return 0, 0, err
	}
	if !present {
		return latitude, longitude, nil
	}
	return lat, lon, nil
}

// arrondi3 arrondit a 3 decimales (~110 m), sous la maille de tous les
// fournisseurs de cette application (prp/04, section 3).
func arrondi3(v float64) float64 {
	return float64(int(v*1000+sign(v)*0.5)) / 1000
}

func repondreJSON(w http.ResponseWriter, statut int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(statut)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encodage JSON : %v", err)
	}
}

// repondreErreur rend une erreur de requete (parametre `date` illisible ou
// hors fenetre) : distincte des degradations de fournisseur ci-dessus, qui
// restent en 200 avec un champ "erreur" (dernier connu servi malgre tout).
// Ici il n'y a rien a servir : la donnee demandee n'existe pas ou n'a pas de
// sens, jamais remplacee par celle d'un autre jour.
func repondreErreur(w http.ResponseWriter, statut int, message string) {
	repondreJSON(w, statut, map[string]string{"erreur": message})
}

// withVersion annonce la version deployee sur toutes les reponses : verifier
// un deploiement ne demande pas d'ouvrir la page.
func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		// %q, pas %s : r.URL.Path est DECODE (un %0a dans l'URL y arrive en
		// vrai saut de ligne) et forgerait une ligne de journal si on
		// l'ecrivait tel quel (G706). %q echappe les caracteres de controle
		// et garde la ligne lisible.
		log.Printf("%s %q %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Truncate(time.Millisecond))
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
