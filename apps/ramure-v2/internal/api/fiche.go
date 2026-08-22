// apps/ramure-v2/internal/api/fiche.go
// GET /api/fiche?nom=<nom>&service=<service> : ce que la fiche coute, et
// quand (PRD §07). Le profil et la discographie du centre voyagent deja
// avec /api/centre, a CHAQUE promotion ; cette route ne charge que ce qui
// ne l'est JAMAIS avant le geste d'ouverture de la fiche : les extraits
// (Deezer.Extraits) et le lien d'ecoute pour le service choisi. Le profil
// est relu ici par commodite d'implementation (meme fonction que
// Composer), mais son cout reel est NUL : la cle de cache
// "lastfm:profil:"+Normaliser(nom) a deja ete remplie par /api/centre pour
// ce meme artiste, donc cet appel est systematiquement un succes de
// cache, jamais un second appel reseau (verifie par
// TestBudgetLOuvertureDeLaFicheNeCouteRienDePlus, internal/api/fiche_test.go).
//
// Parametre "nom" plutot que "mbid" (contrairement au commentaire
// d'origine du PRP) : Last.fm et Deezer interrogent tous deux par NOM, pas
// par MBID, dans toute la serie (cf. LastFM.Profil, Deezer.Chercher) — un
// parametre mbid serait inutilisable ici sans un appel MusicBrainz
// supplementaire, que N-03 interdit explicitement pour l'ouverture d'une
// fiche.
package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

type ficheJSON struct {
	Profil     source.Profil    `json:"profil"`
	Extraits   []source.Extrait `json:"extraits"`
	LienEcoute string           `json:"lienEcoute"`
	// LienDeezer (F-25) : le lien Deezer de l'artiste, deja obtenu par
	// l'appel a d.Media.Chercher ci-dessous pour les extraits — cout NUL.
	// Le client le renvoie tel quel a GET /api/ecouter au clic, pour que
	// cette route resolve le lien PRECIS sans refaire cet appel Deezer.
	LienDeezer string `json:"lienDeezer,omitempty"`
}

// profileur duplique volontairement l'interface non exportee
// d'internal/arbre : un doublon de deux lignes est prefere a
// l'exportation d'un detail d'implementation d'un autre paquet.
type profileur interface {
	Profil(ctx context.Context, nom string, p budget.Portee) (source.Profil, error)
}

var servicesConnus = map[source.Service]bool{
	source.ServiceDeezer:  true,
	source.ServiceSpotify: true,
	source.ServiceApple:   true,
	source.ServiceYouTube: true,
	source.ServiceTidal:   true,
}

// servicePour valide le parametre service : une valeur inconnue ou absente
// retombe sur Deezer — repli documente en attendant le reglage persistant
// du PRP 07 (F-25 n'est close qu'a ce PRP-la).
func servicePour(v string) source.Service {
	s := source.Service(v)
	if servicesConnus[s] {
		return s
	}
	return source.ServiceDeezer
}

func ficheHandler(d arbre.Dependances) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		nom := strings.TrimSpace(r.URL.Query().Get("nom"))
		if nom == "" {
			ecrireErreur(w, http.StatusBadRequest, "le parametre nom est requis")
			return
		}
		service := servicePour(r.URL.Query().Get("service"))
		ctx := r.Context()

		var profil source.Profil
		if pf, ok := d.Proximite.(profileur); ok {
			if p, err := pf.Profil(ctx, nom, budget.Centre); err == nil {
				profil = p
			}
		}
		if ctx.Err() != nil {
			return
		}

		var extraits []source.Extrait
		var lienDeezer string
		if d.Media != nil {
			if fiche, err := d.Media.Chercher(ctx, nom, budget.Centre); err == nil {
				lienDeezer = fiche.LienArtiste
				if ex, err := d.Media.Extraits(ctx, fiche.ID, budget.Centre); err == nil {
					extraits = ex
				}
			}
		}
		if ctx.Err() != nil {
			return
		}

		reponse := ficheJSON{
			Profil:     profil,
			Extraits:   extraits,
			LienEcoute: source.RecherchePreRemplie(service, nom),
			LienDeezer: lienDeezer,
		}
		ecrireJSON(w, http.StatusOK, reponse)
	}
}
