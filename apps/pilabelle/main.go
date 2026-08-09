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
	"time"

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

// parisTZ est figee pour tous les calculs de jour (ossature §5) : l'heure du
// telephone decide de l'affichage, jamais du jour retenu par le serveur.
var parisTZ = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		log.Fatalf("fuseau Europe/Paris introuvable : %v", err)
	}
	return loc
}()

func aujourdhui() string {
	return time.Now().In(parisTZ).Format("2006-01-02")
}

func routes(dico Dictionnaire, messages Messages, defis []DefiCatalogue, racineProfils string, clePubliqueVAPID string) http.Handler {
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

	// Ajoute apres les PRP (PRODUCT.md, "Ajoute apres les PRP") : reinitialiser
	// son propre profil depuis les reglages, demande explicite en usage reel.
	mux.HandleFunc("DELETE /api/profil", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		if err := SupprimerProfil(racineProfils, email); err != nil {
			log.Printf("suppression profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, map[string]bool{"supprime": true})
	})

	mux.HandleFunc("GET /api/jour", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		profil, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}

		jour := aujourdhui()
		seance, cas, err := SeanceDuJour(dico, profil, jour)
		if err != nil {
			log.Printf("selection du jour %s pour %s: %v", jour, identifiantFichier(email), err)
			http.Error(w, `{"erreur":"dictionnaire insuffisant"}`, http.StatusInternalServerError)
			return
		}

		reponse := struct {
			Cas    Cas          `json:"cas"`
			Seance *Seance      `json:"seance,omitempty"`
			Pique  string       `json:"pique,omitempty"`
			Defi   *DefiSemaine `json:"defi,omitempty"`
		}{Cas: cas}
		if cas == CasAFaire {
			reponse.Seance = &seance
		}

		profilModifie := false

		// Tirage hebdomadaire du defi (PRP 06, verrou du 9 aout 2026) : une
		// semaine differente de celle du profil, ou aucun defi encore tire,
		// declenche un nouveau tirage, persiste aussitot.
		semaineCourante := semaineISODeDate(jour)
		if profil.DefiSemaine == nil || profil.DefiSemaine.Semaine != semaineCourante {
			dernier := ""
			if profil.DefiSemaine != nil {
				dernier = profil.DefiSemaine.ID
			}
			nouveauDefi := DefiDeLaSemaine(defis, dernier, semaineCourante+"|"+email, semaineCourante)
			profil.DefiSemaine = &nouveauDefi
			profilModifie = true
		}
		reponse.Defi = profil.DefiSemaine

		if ecart := joursDepuisDerniereSeance(profil, jour); ecart >= 1 && cas == CasAFaire {
			famille, pool := familleEtPool(messages, ecart)
			pique := tirerMessage(pool, profil.DerniersMessages.Pique, jour+"|"+famille+"|"+email)
			reponse.Pique = pique
			profil.DerniersMessages.Pique = pique
			profilModifie = true
		}

		if profilModifie {
			if err := EcrireProfil(racineProfils, email, profil); err != nil {
				log.Printf("ecriture profil %s: %v", identifiantFichier(email), err) // non bloquant : la reponse s'affiche quand meme
			}
		}
		repondreJSON(w, reponse)
	})

	mux.HandleFunc("POST /api/ressenti", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		var corps struct {
			Ressenti Ressenti `json:"ressenti"`
		}
		if err := json.NewDecoder(r.Body).Decode(&corps); err != nil || !ressentiValide(corps.Ressenti) {
			http.Error(w, `{"erreur":"ressenti invalide"}`, http.StatusBadRequest)
			return
		}
		profil, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}

		jour := aujourdhui()
		seance, cas, err := SeanceDuJour(dico, profil, jour)
		if err != nil {
			log.Printf("selection du jour %s pour %s: %v", jour, identifiantFichier(email), err)
			http.Error(w, `{"erreur":"dictionnaire insuffisant"}`, http.StatusInternalServerError)
			return
		}

		recap := Recap{Serie: profil.Serie}
		if cas != CasAFaire {
			recap.DejaCompte = true // PRD §7.2 : refaire librement (ou repos) ne recompte pas
		} else {
			douleurs := profil.Reponses.Douleurs

			niveauVentre, facilesVentre := AjusterNiveau(dico, ZoneVentre, douleurs, profil.Niveaux.Ventre, profil.FacilesConsecutifs.Ventre, corps.Ressenti)
			niveauCuisses, facilesCuisses := AjusterNiveau(dico, ZoneCuisses, douleurs, profil.Niveaux.Cuisses, profil.FacilesConsecutifs.Cuisses, corps.Ressenti)
			recap.NiveauMonte.Ventre = niveauVentre > profil.Niveaux.Ventre
			recap.NiveauMonte.Cuisses = niveauCuisses > profil.Niveaux.Cuisses
			profil.Niveaux.Ventre, profil.FacilesConsecutifs.Ventre = niveauVentre, facilesVentre
			profil.Niveaux.Cuisses, profil.FacilesConsecutifs.Cuisses = niveauCuisses, facilesCuisses

			dernierJourFait := ""
			if len(profil.Historique) > 0 {
				dernierJourFait = profil.Historique[len(profil.Historique)-1].Date
			}
			profil.Serie = MettreAJourSerie(profil.Serie, profil.Reponses.JoursActifs, dernierJourFait, jour)
			recap.Serie = profil.Serie

			profil.Historique = append(profil.Historique, HistoriqueEntree{Date: jour, Ressenti: corps.Ressenti, Exercices: idsDeLaSeance(seance)})

			// Defi de la semaine (PRP 06, verrou du 9 aout 2026) : seule la
			// transition false -> true remplit Recap.DefiReleve, meme logique
			// que NiveauMonte. Rater ne produit jamais rien de visible.
			if profil.DefiSemaine != nil && !profil.DefiSemaine.Releve {
				if EvaluerDefi(*profil.DefiSemaine, profil, jour) {
					profil.DefiSemaine.Releve = true
					releve := true
					recap.DefiReleve = &releve
				}
			}
		}

		sel := jour + "|" + email
		recap.Encouragement = tirerMessage(messages.Encouragements, profil.DerniersMessages.Encouragement, sel+"|enc")
		profil.DerniersMessages.Encouragement = recap.Encouragement
		if motDouxDeTempsEnTemps(sel) {
			recap.MotDoux = tirerMessage(messages.MotsDoux, profil.DerniersMessages.MotDoux, sel+"|doux")
			profil.DerniersMessages.MotDoux = recap.MotDoux
		}

		if err := EcrireProfil(racineProfils, email, profil); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, recap)
	})

	mux.HandleFunc("GET /api/personnel", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		profil, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		jour := aujourdhui()
		debut, fin := fenetreCalendrier(jour)
		repondreJSON(w, PersonnelReponse{
			Serie:      profil.Serie,
			Niveaux:    profil.Niveaux,
			Calendrier: Calendrier(profil, debut, fin, jour),
		})
	})

	// Ajoute apres les PRP (PRODUIT.md, "Notifications : rappel de seance et
	// mots doux", 9 aout 2026) : la cle publique VAPID n'est pas un secret —
	// c'est elle que le navigateur transmet a PushManager.subscribe(). Vide si
	// les cles VAPID sont absentes de l'environnement (nouveauNotifieur) : le
	// bouton d'activation des reglages reste alors inoperant, sans planter.
	mux.HandleFunc("GET /api/notifications/cle-publique", func(w http.ResponseWriter, r *http.Request) {
		repondreJSON(w, map[string]string{"cle": clePubliqueVAPID})
	})

	// Opt-in, un seul abonnement par profil (PRODUIT) : cree ou remplace
	// l'abonnement du compte appelant, et accessoirement son heure de rappel.
	mux.HandleFunc("PUT /api/notifications", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		profil, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		var corps struct {
			Abonnement  *AbonnementPush `json:"abonnement"`
			HeureRappel string          `json:"heure_rappel"`
		}
		if err := json.NewDecoder(r.Body).Decode(&corps); err != nil || corps.Abonnement == nil ||
			corps.Abonnement.Endpoint == "" || corps.Abonnement.P256dh == "" || corps.Abonnement.Auth == "" {
			http.Error(w, `{"erreur":"abonnement invalide"}`, http.StatusBadRequest)
			return
		}
		if corps.HeureRappel != "" && !heureValide(corps.HeureRappel) {
			http.Error(w, `{"erreur":"heure invalide"}`, http.StatusBadRequest)
			return
		}
		profil.Notifications.Abonnement = corps.Abonnement
		if corps.HeureRappel != "" {
			profil.Notifications.HeureRappel = corps.HeureRappel
		}
		if err := EcrireProfil(racineProfils, email, profil); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, map[string]string{"heure_rappel": heureRappelEffective(profil.Notifications)})
	})

	// Revoquer arrete tout (PRODUIT : "permission retiree ou geste inverse dans
	// les reglages"). Idempotent, sur le meme modele que DELETE /api/profil.
	mux.HandleFunc("DELETE /api/notifications", func(w http.ResponseWriter, r *http.Request) {
		email, _ := identite(r)
		profil, err := LireProfil(racineProfils, email)
		if errors.Is(err, ErrProfilAbsent) {
			http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		profil.Notifications.Abonnement = nil
		if err := EcrireProfil(racineProfils, email, profil); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
			http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
			return
		}
		repondreJSON(w, map[string]bool{"desabonne": true})
	})

	return withIdentiteExigeeSurAPI(mux)
}

// PersonnelReponse est la reponse de GET /api/personnel (PRP 07) : rien de
// nouveau a calculer, tout vient deja de Profil.
type PersonnelReponse struct {
	Serie      Serie            `json:"serie"`
	Niveaux    Niveaux          `json:"niveaux"`
	Calendrier []JourCalendrier `json:"calendrier"`
}

// Recap est la reponse de POST /api/ressenti (PRD §7.4, §10).
type Recap struct {
	DejaCompte  bool  `json:"deja_compte,omitempty"`
	Serie       Serie `json:"serie"`
	NiveauMonte struct {
		Ventre  bool `json:"ventre"`
		Cuisses bool `json:"cuisses"`
	} `json:"niveau_monte"`
	Encouragement string `json:"encouragement"`
	MotDoux       string `json:"mot_doux,omitempty"`
	DefiReleve    *bool  `json:"defi_releve,omitempty"`
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

// lancerPlanificateurNotifications demarre, en arriere-plan, la verification
// des rappels et mots doux dus (PRODUIT "Notifications : rappel de seance et
// mots doux", 9 aout 2026) : un time.Ticker verifie tous les profils
// enregistres une fois par minute. Ne fait rien si notifieur est nil (cles
// VAPID absentes de l'environnement) — deja logue par l'appelant, main().
func lancerPlanificateurNotifications(dico Dictionnaire, messages Messages, racine string, notifieur Notifieur) {
	if notifieur == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			verifierNotifications(dico, messages, racine, notifieur, time.Now().In(parisTZ))
		}
	}()
}

// verifierNotifications examine chaque profil abonne et declenche l'envoi des
// notifications dues (PRODUIT "Notifications"). Prend maintenant en
// parametre — jamais time.Now() directement — pour rester appelable depuis
// les tests sans dependre de l'horloge reelle ni d'un vrai appel reseau
// (notifieur y est un mock dans notifications_test.go).
func verifierNotifications(dico Dictionnaire, messages Messages, racine string, notifieur Notifieur, maintenant time.Time) {
	ids, err := ListerProfils(racine)
	if err != nil {
		log.Printf("planificateur notifications: lecture %s: %v", racine, err)
		return
	}
	jour := maintenant.Format("2006-01-02")
	for _, id := range ids {
		profil, err := LireProfilParID(racine, id)
		if err != nil {
			log.Printf("planificateur notifications: profil %s illisible: %v", id, err)
			continue
		}
		if profil.Notifications.Abonnement == nil {
			continue // opt-in : jamais de notification implicite
		}
		modifie := false

		_, cas, err := SeanceDuJour(dico, profil, jour)
		if err != nil {
			log.Printf("planificateur notifications: seance du jour pour %s: %v", id, err)
		} else if RappelDu(profil, cas, maintenant) {
			if err := notifieur.Envoyer(*profil.Notifications.Abonnement, "C'est l'heure de ta séance", "Ta séance du jour t'attend, quand tu veux."); err != nil {
				log.Printf("planificateur notifications: rappel %s: %v", id, err)
				if errors.Is(err, ErrAbonnementExpire) {
					profil.Notifications.Abonnement = nil
					modifie = true
				}
			} else {
				profil.Notifications.DernierRappel = jour
				modifie = true
			}
		}

		if profil.Notifications.Abonnement != nil && MotDouxDu(id, profil, maintenant) {
			motDoux := tirerMessage(messages.MotsDoux, profil.DerniersMessages.MotDoux, id+"|"+jour+"|push-doux")
			if err := notifieur.Envoyer(*profil.Notifications.Abonnement, "Petit mot doux", motDoux); err != nil {
				log.Printf("planificateur notifications: mot doux %s: %v", id, err)
				if errors.Is(err, ErrAbonnementExpire) {
					profil.Notifications.Abonnement = nil
					modifie = true
				}
			} else {
				profil.Notifications.DernierMotDoux = jour
				profil.DerniersMessages.MotDoux = motDoux
				modifie = true
			}
		}

		if modifie {
			if err := EcrireProfilParID(racine, id, profil); err != nil {
				log.Printf("planificateur notifications: ecriture %s: %v", id, err)
			}
		}
	}
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
	brutMessages, err := dataFS.ReadFile("data/messages.json")
	if err != nil {
		log.Fatalf("messages absents de l'image : %v", err)
	}
	messages, err := ChargerMessages(brutMessages)
	if err != nil {
		log.Fatalf("messages invalides : %v", err)
	}
	brutDefis, err := dataFS.ReadFile("data/defis.json")
	if err != nil {
		log.Fatalf("defis absents de l'image : %v", err)
	}
	defis, err := ChargerDefis(brutDefis)
	if err != nil {
		log.Fatalf("defis invalides : %v", err)
	}

	// Ajoute apres les PRP (PRODUIT.md, "Notifications : rappel de seance et
	// mots doux", 9 aout 2026) : absence de VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
	// ou VAPID_CONTACT desactive silencieusement l'envoi, jamais le demarrage
	// (regle imperative "l'app demarre sans intervention").
	notifieur, clePubliqueVAPID := nouveauNotifieur()
	if notifieur == nil {
		log.Print("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_CONTACT absent(e) : notifications push desactivees")
	}

	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: routes(dico, messages, defis, racine, clePubliqueVAPID)}

	lancerPlanificateurNotifications(dico, messages, racine, notifieur)

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
