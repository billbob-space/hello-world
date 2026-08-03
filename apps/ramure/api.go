// La couche HTTP.
//
// Un point de conception domine ce fichier, et c'est une des deux exigences que
// le PRD marque critiques :
//
//	F-36  "Un artiste sans voisins connus et un echec de chargement produisent
//	       deux messages differents ; seul le second propose de reessayer."
//
// La distinction doit donc survivre au transport. Elle est portee par le code
// de statut ET par un champ "etat" explicite, jamais par l'interpretation d'un
// tableau vide cote client : un tableau vide est exactement ce que produisent
// les deux situations, et c'est precisement la confusion a eviter.
//
//	200 + etat "ok"     il y a quelque chose a montrer
//	200 + etat "vide"   la source a repondu, il n'y a rien. Pas de "reessayer".
//	502 + etat "panne"  la source n'a pas repondu. "Reessayer" a un sens.
//
// La F-37 complete : "reessayer relance un veritable chargement". Elle est
// tenue par le cache, qui refuse de memoriser aussi bien une erreur qu'un
// resultat vide (voir cache.go), et par les en-tetes anti-cache poses ci-
// dessous — sans quoi le cache du navigateur reservirait la reponse vide et
// le bouton "reessayer" ne relancerait rien du tout.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// plafondAppels borne le cout d'une operation (N-03). Il couvre le pire cas
// documente dans le README : centre complet plus heritiers de dix branches.
const plafondAppels = 24

type Serveur struct {
	sources    *Sources
	collection *Collection
	reglages   *Reglages
	mesures    *Mesures
	cache      *Cache
	version    string
}

// --- enveloppes de reponse ---------------------------------------------

type reponse struct {
	Etat    string `json:"etat"`
	Message string `json:"message,omitempty"`
	// Reessayable n'est vrai que pour une panne. Le client s'en sert pour
	// decider d'afficher ou non l'action de reprise — jamais d'une heuristique
	// sur le message.
	Reessayable bool           `json:"reessayable,omitempty"`
	Donnees     any            `json:"donnees,omitempty"`
	Budget      map[string]int `json:"budget,omitempty"`
}

func (s *Serveur) ecris(w http.ResponseWriter, code int, rep reponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Aucune reponse d'API n'est mise en cache par le navigateur. Le cache
	// mutualise du serveur (N-04) est le seul cache legitime : lui sait ne pas
	// memoriser les echecs, ce qu'un cache HTTP ne sait pas faire.
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(rep); err != nil {
		log.Printf("reponse non ecrite : %v", err)
	}
}

func (s *Serveur) ok(w http.ResponseWriter, donnees any, b *Budget) {
	s.ecris(w, http.StatusOK, reponse{Etat: "ok", Donnees: donnees, Budget: b.Etat()})
}

// vide signale "rien a montrer" — une reponse valide de la source.
func (s *Serveur) vide(w http.ResponseWriter, message string) {
	s.ecris(w, http.StatusOK, reponse{Etat: "vide", Message: message})
}

// panne signale "la source n'a pas repondu" — le seul cas ou reessayer a un
// sens.
func (s *Serveur) panne(w http.ResponseWriter, message string, err error) {
	log.Printf("panne : %s : %v", message, err)
	s.ecris(w, http.StatusBadGateway, reponse{Etat: "panne", Message: message, Reessayable: true})
}

func (s *Serveur) refus(w http.ResponseWriter, message string) {
	s.ecris(w, http.StatusBadRequest, reponse{Etat: "refus", Message: message})
}

// repondSource traduit une erreur de source en reponse HTTP. C'est le point
// unique ou la F-36 se decide, pour qu'aucun appelant ne puisse l'oublier.
func (s *Serveur) repondSource(w http.ResponseWriter, err error, messageVide, messagePanne string) {
	if errors.Is(err, ErrVide) {
		s.vide(w, messageVide)
		return
	}
	s.panne(w, messagePanne, err)
}

// --- routes ------------------------------------------------------------

func (s *Serveur) Routes(mux *http.ServeMux, pages http.Handler) {
	mux.Handle("GET /", pages)

	mux.HandleFunc("GET /api/suggestions", s.suggestions)
	mux.HandleFunc("GET /api/arbre", s.arbre)
	mux.HandleFunc("GET /api/heritiers", s.heritiers)
	mux.HandleFunc("GET /api/fiche", s.fiche)
	mux.HandleFunc("GET /api/palmares", s.palmares)
	mux.HandleFunc("GET /api/accueil", s.accueil)

	mux.HandleFunc("GET /api/collection", s.collectionLis)
	mux.HandleFunc("POST /api/collection", s.collectionAjoute)
	mux.HandleFunc("DELETE /api/collection", s.collectionRetire)
	mux.HandleFunc("POST /api/collection/reconcilie", s.collectionReconcilie)

	mux.HandleFunc("GET /api/reglages", s.reglagesLis)
	mux.HandleFunc("PUT /api/reglages", s.reglagesEcris)

	mux.HandleFunc("POST /api/mesure", s.mesure)
	mux.HandleFunc("GET /api/mesures", s.mesuresLis)
	mux.HandleFunc("GET /api/diagnostic", s.diagnostic)

	mux.HandleFunc("GET /healthz", s.sante)
}

// sante repond a la sonde du conteneur. Elle ne consulte AUCUNE source
// externe : une sonde qui dependrait de Deezer ferait redemarrer le conteneur
// a chaque incident chez un tiers, transformant une degradation en panne.
func (s *Serveur) sante(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte("ok " + s.version + "\n"))
}

// suggestions alimente la saisie assistee (F-01).
func (s *Serveur) suggestions(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) < 2 {
		// Moins de deux caracteres : on ne consulte pas la source. Ce n'est ni
		// un vide ni une panne, c'est une saisie qui n'a pas commence.
		s.ok(w, []Artiste{}, nil)
		return
	}

	b := NouveauBudget(4)
	arts, err := s.sources.Suggere(r.Context(), q, b)
	if err != nil {
		s.panne(w, "La recherche n'a pas répondu.", err)
		return
	}
	s.ok(w, arts, b)
}

// arbre plante une graine ou promeut une branche : le geste central.
//
// Deux entrees possibles, et la difference compte. Par "id", on connait deja
// l'artiste — c'est une promotion, aucune resolution n'est necessaire. Par
// "graine", il faut resoudre un nom, avec correspondance stricte puis
// rattrapage borne (F-03).
func (s *Serveur) arbre(w http.ResponseWriter, r *http.Request) {
	debut := time.Now()
	q := r.URL.Query()
	b := NouveauBudget(plafondAppels)
	ctx := r.Context()

	var centre Artiste
	var corrige bool
	nomSaisi := strings.TrimSpace(q.Get("graine"))

	switch {
	case q.Get("id") != "":
		art, err := s.sources.deezer.Detail(ctx, q.Get("id"), b)
		if err != nil {
			s.panne(w, "Cet artiste n'a pas pu être chargé.", err)
			return
		}
		centre = art

	case nomSaisi != "":
		art, c, err := s.sources.Resout(ctx, nomSaisi, b)
		if errors.Is(err, ErrVide) {
			// Un nom introuvable est un VIDE, pas une panne : reessayer ne
			// changera rien tant que le nom reste le meme. Le message doit
			// donc proposer autre chose qu'une reprise.
			s.vide(w, "Aucun artiste ne porte ce nom. Vérifie l'orthographe, ou choisis une suggestion.")
			return
		}
		if err != nil {
			s.panne(w, "La recherche n'a pas répondu.", err)
			return
		}
		centre, corrige = art, c

	default:
		s.refus(w, "Il faut une graine ou un identifiant.")
		return
	}

	vivier, err := s.sources.Vivier(ctx, centre, b)
	if err != nil {
		s.repondSource(w, err,
			"Aucun voisin connu pour cet artiste. L'arbre s'arrête ici.",
			"Les voisins n'ont pas pu être chargés.")
		return
	}

	tirage := Tirage{Centre: centre.ID, Nonce: entier(q.Get("tirage"), 0)}
	// Le client annonce combien de branches sa disposition peut porter. La
	// valeur est bornee cote serveur : elle vient du client, donc elle n'est
	// pas de confiance, et un arbre de mille branches ferait exploser le
	// budget d'appels des heritiers.
	cible := entier(q.Get("branches"), branchesCible)
	branches := Dispose(ChoisitNBranches(vivier, tirage, cible), tirage)
	branches, elague := Elague(branches)

	// La fiche du centre est completee ici parce que la F-19 la veut des
	// l'affichage ; la discographie et les extraits, eux, sont demandes
	// separement par le client (F-39, affichage progressif).
	centre = s.sources.Fiche(ctx, centre, b)

	s.mesures.Latence(float64(time.Since(debut).Milliseconds()))

	s.ok(w, Arbre{
		Centre:   centre,
		Branches: branches,
		Graine:   centre.Nom,
		Corrige:  corrige,
		NomSaisi: nomSaisi,
		Vivier:   len(vivier),
		Elague:   elague,
	}, b)
}

// heritiers charge la deuxieme generation, apres coup.
//
// C'est l'operation la plus couteuse du produit — un appel par branche — et
// c'est pour cela qu'elle est separee de /api/arbre plutot que servie avec lui.
// L'arbre s'affiche donc sans attendre les grappes (F-39), et une panne ici
// coute des heritiers, jamais l'ecran (N-06).
func (s *Serveur) heritiers(w http.ResponseWriter, r *http.Request) {
	bruts := strings.Split(r.URL.Query().Get("ids"), ",")

	// Le centre et les branches sont exclus de la deuxieme generation : un
	// heritier qui est deja le centre, ou deja une branche voisine, n'apporte
	// aucune information et occupe une place rare.
	dejaDansLArbre := make(map[string]bool, len(bruts)+1)
	if centre := strings.TrimSpace(r.URL.Query().Get("centre")); centre != "" {
		dejaDansLArbre[centre] = true
	}

	branches := make([]Artiste, 0, len(bruts))
	for _, id := range bruts {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := numeroDeezer(id); !ok {
			continue
		}
		dejaDansLArbre[id] = true
		branches = append(branches, Artiste{ID: id})
	}
	if len(branches) == 0 {
		s.refus(w, "Aucune branche valide demandée.")
		return
	}
	// Borne dure : le client ne demande jamais plus que ses branches, mais
	// l'API est ouverte et le budget d'appels ne doit pas dependre de sa bonne
	// volonte.
	if len(branches) > branchesCible+1 {
		branches = branches[:branchesCible+1]
	}

	b := NouveauBudget(plafondAppels)
	grappes := s.sources.Heritiers(r.Context(), branches, heritiersParBranche, dejaDansLArbre, b)

	// La geometrie des heritiers depend de l'angle de leur branche, que seul
	// le client connait a cet instant : il l'a recu avec l'arbre. On rend donc
	// les voisins bruts et le client appelle sa propre disposition — la meme
	// formule, portee en JavaScript, testee ici en Go.
	out := make(map[string][]Voisin, len(grappes))
	for id, vs := range grappes {
		out[id] = vs
	}

	if len(out) == 0 {
		s.vide(w, "Aucun héritier connu pour ces branches.")
		return
	}
	s.ok(w, out, b)
}

// fiche rend le profil complet du centre : discographie, extraits, liens.
func (s *Serveur) fiche(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if _, ok := numeroDeezer(id); !ok {
		s.refus(w, "Identifiant d'artiste invalide.")
		return
	}

	ctx := r.Context()
	b := NouveauBudget(plafondAppels)
	reg := s.reglages.Lis(utilisateurDe(r))

	centre, err := s.sources.deezer.Detail(ctx, id, b)
	if err != nil {
		s.panne(w, "Cette fiche n'a pas pu être chargée.", err)
		return
	}
	centre = s.sources.Fiche(ctx, centre, b)

	albums, errDisco := s.sources.Discographie(ctx, centre, b)
	extraits, errEx := s.sources.Extraits(ctx, centre, b)

	// Une discographie absente ne doit pas emporter la fiche : la F-19 et la
	// F-20 sont deux exigences distinctes, et le profil vaut d'etre lu meme
	// sans catalogue. On rapporte donc l'etat de chaque bloc separement, ce
	// qui laisse le client afficher le bon message au bon endroit (F-36).
	type lienAlbum struct {
		Album
		Lien string `json:"lien"`
	}
	liens := make([]lienAlbum, 0, len(albums))
	for _, a := range albums {
		liens = append(liens, lienAlbum{Album: a, Lien: LienAlbum(a, centre.Nom, reg.ServiceEcoute)})
	}

	s.ok(w, map[string]any{
		"centre":        centre,
		"lienArtiste":   LienArtiste(centre, reg.ServiceEcoute),
		"albums":        liens,
		"discoEtat":     etatDe(errDisco),
		"extraits":      extraits,
		"extraitsEtat":  etatDe(errEx),
		"serviceEcoute": reg.ServiceEcoute,
	}, b)
}

// etatDe traduit l'erreur d'un bloc facultatif en etat lisible par le client.
// La distinction de la F-36 s'applique aussi a l'interieur d'une fiche : une
// discographie vide et une discographie qui n'a pas charge n'appellent pas le
// meme message.
func etatDe(err error) string {
	switch {
	case err == nil:
		return "ok"
	case errors.Is(err, ErrVide):
		return "vide"
	default:
		return "panne"
	}
}

// palmaresMax borne le nombre de resultats (F-27 : "nombre de resultats
// borne"). Au-dela, ce n'est plus un palmares mais une seconde discographie.
const palmaresMax = 30

// palmares classe les meilleurs albums de tous les artistes visibles (F-27).
func (s *Serveur) palmares(w http.ResponseWriter, r *http.Request) {
	ids := make([]string, 0, branchesCible+1)
	for _, id := range strings.Split(r.URL.Query().Get("ids"), ",") {
		id = strings.TrimSpace(id)
		if _, ok := numeroDeezer(id); ok {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		s.refus(w, "Aucun artiste valide demandé.")
		return
	}
	if len(ids) > branchesCible+1 {
		ids = ids[:branchesCible+1]
	}

	b := NouveauBudget(plafondAppels * 2)
	reg := s.reglages.Lis(utilisateurDe(r))
	classe := s.sources.Palmares(r.Context(), ids, palmaresMax, reg.ServiceEcoute, b)

	// Un palmares vide n'est pas une panne : c'est ce qui arrive sur les genres
	// que le role 3 couvre mal, et le PRD impose alors "un etat vide explicite
	// plutot qu'un classement trompeur" (§14).
	if len(classe) == 0 {
		s.vide(w, "Aucun album assez apprécié parmi les artistes affichés. Le classement a besoin de la source d'appréciation, qui ne couvre pas tous les genres.")
		return
	}
	s.ok(w, classe, b)
}

// accueil alimente le mur de l'etat A (F-05).
//
// La §07 fixe la priorite : "les artistes deja gardes en priorite, sinon une
// selection editoriale d'amorcage". Un utilisateur qui revient retrouve donc
// sa collection en plein ecran, ce qui est aussi ce qui sert la M-06.
func (s *Serveur) accueil(w http.ResponseWriter, r *http.Request) {
	utilisateur := utilisateurDe(r)
	gardes := s.collection.Liste(utilisateur)

	if len(gardes) >= 6 {
		tuiles := make([]Artiste, 0, len(gardes))
		for _, g := range gardes {
			tuiles = append(tuiles, g.Artiste)
		}
		s.ok(w, map[string]any{"tuiles": tuiles, "origine": "collection"}, nil)
		return
	}

	// Amorçage : la selection editoriale est resolue par la source pour
	// obtenir de vraies pochettes et de vrais identifiants. Elle est mise en
	// cache comme tout le reste, donc ce cout n'est paye qu'une fois par
	// duree de vie.
	b := NouveauBudget(len(selectionAmorcage) + 2)
	tuiles := s.sources.Amorcage(r.Context(), b)

	// La collection, meme courte, passe devant l'amorcage : ce sont les
	// artistes de l'utilisateur.
	for _, g := range gardes {
		tuiles = append([]Artiste{g.Artiste}, tuiles...)
	}

	if len(tuiles) == 0 {
		s.panne(w, "Le mur n'a pas pu être chargé.", errors.New("amorcage vide"))
		return
	}
	s.ok(w, map[string]any{"tuiles": tuiles, "origine": "amorcage"}, b)
}

// --- collection --------------------------------------------------------

// sansCompte signale au client qu'aucune identite n'a ete etablie par le
// serveur. Le client bascule alors sur son miroir local (F-33) au lieu
// d'afficher une collection vide, ce qui serait mensonger.
func (s *Serveur) sansCompte(w http.ResponseWriter) {
	s.ecris(w, http.StatusOK, reponse{
		Etat:    "local",
		Message: "Aucun compte identifié : la collection reste sur cet appareil.",
		Donnees: []Garde{},
	})
}

func (s *Serveur) collectionLis(w http.ResponseWriter, r *http.Request) {
	u := utilisateurDe(r)
	if u == "" {
		s.sansCompte(w)
		return
	}
	s.ok(w, s.collection.Liste(u), nil)
}

func (s *Serveur) collectionAjoute(w http.ResponseWriter, r *http.Request) {
	u := utilisateurDe(r)
	if u == "" {
		s.sansCompte(w)
		return
	}

	var g Garde
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&g); err != nil {
		s.refus(w, "Requête illisible.")
		return
	}
	if g.ID == "" || g.Nom == "" {
		s.refus(w, "Il faut au moins un identifiant et un nom.")
		return
	}
	// La lignee est bornee : elle vient du client, donc elle n'est pas de
	// confiance. Une lignee de dix mille entrees ferait grossir la memoire du
	// serveur sans qu'aucun ecran ne l'affiche.
	if len(g.Lignee) > 64 {
		g.Lignee = g.Lignee[len(g.Lignee)-64:]
	}

	s.mesures.Emet(idSessionDe(r), "artiste-garde")
	s.ok(w, s.collection.Ajoute(u, g), nil)
}

func (s *Serveur) collectionRetire(w http.ResponseWriter, r *http.Request) {
	u := utilisateurDe(r)
	if u == "" {
		s.sansCompte(w)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		s.refus(w, "Il faut un identifiant.")
		return
	}
	s.ok(w, s.collection.Retire(u, id), nil)
}

func (s *Serveur) collectionReconcilie(w http.ResponseWriter, r *http.Request) {
	u := utilisateurDe(r)
	if u == "" {
		s.sansCompte(w)
		return
	}

	var locales []Garde
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512<<10)).Decode(&locales); err != nil {
		s.refus(w, "Requête illisible.")
		return
	}
	if len(locales) > 500 {
		locales = locales[:500]
	}
	s.ok(w, s.collection.Reconcilie(u, locales), nil)
}

// --- reglages ----------------------------------------------------------

func (s *Serveur) reglagesLis(w http.ResponseWriter, r *http.Request) {
	s.ok(w, map[string]any{
		"reglage":  s.reglages.Lis(utilisateurDe(r)),
		"services": ServicesEcoute,
		"tris":     TrisMur,
		"compte":   utilisateurDe(r) != "",
	}, nil)
}

func (s *Serveur) reglagesEcris(w http.ResponseWriter, r *http.Request) {
	var demande Reglage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&demande); err != nil {
		s.refus(w, "Requête illisible.")
		return
	}
	s.ok(w, map[string]any{"reglage": s.reglages.Ecris(utilisateurDe(r), demande)}, nil)
}

// --- mesures et diagnostic ---------------------------------------------

// idSessionDe lit l'identifiant de session emis par le client. Il ne designe
// personne : c'est un jeton opaque tire au chargement de la page, qui permet
// seulement de rattacher entre eux les evenements d'une meme visite.
func idSessionDe(r *http.Request) string {
	id := r.Header.Get("X-Ramure-Session")
	if len(id) > 64 {
		return id[:64]
	}
	return id
}

func (s *Serveur) mesure(w http.ResponseWriter, r *http.Request) {
	var corps struct {
		Evenement string  `json:"evenement"`
		LatenceMs float64 `json:"latenceMs,omitempty"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&corps); err != nil {
		s.refus(w, "Requête illisible.")
		return
	}

	if corps.LatenceMs > 0 {
		s.mesures.Latence(corps.LatenceMs)
	}
	if corps.Evenement != "" && !s.mesures.Emet(idSessionDe(r), corps.Evenement) {
		s.refus(w, "Événement inconnu.")
		return
	}
	// Pas de corps de reponse : le client n'attend rien et ne doit pas etre
	// ralenti par l'instrumentation.
	w.WriteHeader(http.StatusNoContent)
}

func (s *Serveur) mesuresLis(w http.ResponseWriter, r *http.Request) {
	s.ok(w, s.mesures.Etat(), nil)
}

// diagnostic sert la N-03 (budget documente et verifiable), la N-10 (journal
// exportable a joindre a un signalement) et la surveillance du taux de service
// par le cache (§14).
func (s *Serveur) diagnostic(w http.ResponseWriter, r *http.Request) {
	s.ok(w, map[string]any{
		"version":       s.version,
		"roles":         s.sources.RolesActifs(),
		"cache":         s.cache.Etat(),
		"plafondAppels": plafondAppels,
		"cadrage": map[string]int{
			"branchesCible":       branchesCible,
			"branchesMin":         branchesMin,
			"branchesStables":     branchesStables,
			"heritiersParBranche": heritiersParBranche,
			"vivierSuffisant":     vivierSuffisant,
		},
		"compte": utilisateurDe(r) != "",
	}, nil)
}

func entier(s string, defaut int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaut
	}
	return n
}
