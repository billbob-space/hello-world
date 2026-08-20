// apps/ramure-v2/internal/api/centre.go
// GET /api/centre?nom=<graine>&largeur=<large|etroit> : le contrat est
// fige (voir le PRP 04) — toujours 200 avec un champ etat, sauf 503 en
// panne totale et 400 sur graine vide. Un artiste sans voisins n'est PAS
// une erreur HTTP (F-36).
package api

import (
	"context"
	"errors"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/mesure"
)

// centreHandler construit le gestionnaire de GET /api/centre. d est
// capturee par fermeture : les sources sont cablees une seule fois par
// main().
//
// Trois parametres de mesure (N-09), tous optionnels et sans effet sur le
// contrat existant si absents (compatibilite totale avec les PRP 04 a 06) :
//   - origine=promotion distingue un saut (Promotion, M-01) d'un
//     plantage de session (Plantation) — la valeur par defaut ;
//   - amorce=collection|partage marque, UNIQUEMENT sur une plantation, le
//     depart depuis un artiste garde (M-06) ou un lien recu (M-07) ;
//   - l'en-tete X-Ramure-Session (EnTeteSession) rattache l'appel a une
//     session cote serveur, sans jamais lire l'identite (mesure_api.go).
func centreHandler(d arbre.Dependances) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		nom := strings.TrimSpace(r.URL.Query().Get("nom"))
		if nom == "" {
			ecrireErreur(w, http.StatusBadRequest, "le parametre nom est requis")
			return
		}

		c := cadragePour(r.URL.Query().Get("largeur"))
		alea := rand.New(rand.NewSource(time.Now().UnixNano())) // #nosec G404 -- tirage purement esthetique pour choisir quelles branches voisines afficher (SelectionnerBranches) ; aucune valeur de securite (jeton, session, mot de passe) n'en depend
		session := sessionDe(r)

		debut := time.Now()
		centre, err := arbre.Composer(r.Context(), d, nom, c, alea)
		if err != nil {
			// Contexte annule (client parti pendant le chargement, §09) :
			// rien a ecrire, la reponse n'interesse plus personne.
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			ecrireErreur(w, http.StatusInternalServerError, "erreur inattendue")
			return
		}

		if Mesure != nil && centre.Etat == arbre.EtatOK {
			if r.URL.Query().Get("origine") == "promotion" {
				Mesure.Compter(mesure.Promotion, session)
			} else {
				Mesure.Compter(mesure.Plantation, session)
				switch r.URL.Query().Get("amorce") {
				case "collection":
					Mesure.Compter(mesure.AmorceCollection, session)
				case "partage":
					Mesure.Compter(mesure.AmorcePartage, session)
				}
				// La latence M-05 ("validation du nom -> entourage
				// affiche") ne concerne que le premier chargement d'une
				// exploration, pas chaque saut ulterieur.
				Mesure.Latence(session, time.Since(debut))
			}
			Mesure.Decouverte(session, centre.Artiste.Nom)
		}

		statut := http.StatusOK
		if centre.Etat == arbre.EtatPanne {
			statut = http.StatusServiceUnavailable
		}
		ecrireJSON(w, statut, centre)
	}
}

// cadragePour choisit le cadrage a partir du parametre largeur — decide
// par le SERVEUR, jamais devine par le client : deux sources de verite
// sur le nombre de branches produiraient un arbre dont l'affichage et les
// donnees ne s'accordent pas. Une valeur inconnue retombe sur large
// plutot que de paniquer.
func cadragePour(largeur string) arbre.Cadrage {
	if largeur == "etroit" {
		return arbre.CadrageEtroit
	}
	return arbre.CadrageLarge
}
