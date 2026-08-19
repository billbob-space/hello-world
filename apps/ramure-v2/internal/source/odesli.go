// apps/ramure-v2/internal/source/odesli.go
// Odesli : role 4, resolution d'un lien d'ecoute vers le service choisi par
// l'utilisateur. Le repli n'est pas une politesse : le PRD interdit qu'un
// lien mene « a une page vide ou erronee ». Usage strictement a la demande,
// sur clic, jamais au chargement — la limite de debit d'Odesli n'est pas
// documentee publiquement.
package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

const odesliBaseURLDefaut = "https://api.song.link"

// Service nomme les cinq services d'ecoute proposes a l'utilisateur (PRD §07).
type Service string

const (
	ServiceDeezer  Service = "deezer"
	ServiceSpotify Service = "spotify"
	ServiceApple   Service = "apple"
	ServiceYouTube Service = "youtube"
	ServiceTidal   Service = "tidal"
)

// modeleRecherche porte l'URL de recherche pre-remplie de chaque service,
// ecrite en clair dans le code (tache 6).
var modeleRecherche = map[Service]string{
	ServiceDeezer:  "https://www.deezer.com/search/%s",
	ServiceSpotify: "https://open.spotify.com/search/%s",
	ServiceApple:   "https://music.apple.com/search?term=%s",
	ServiceYouTube: "https://music.youtube.com/search?q=%s",
	ServiceTidal:   "https://tidal.com/search?q=%s",
}

// plateformeOdesli fait correspondre nos Service aux cles de
// linksByPlatform renvoyees par l'API Odesli.
var plateformeOdesli = map[Service]string{
	ServiceDeezer:  "deezer",
	ServiceSpotify: "spotify",
	ServiceApple:   "appleMusic",
	ServiceYouTube: "youtubeMusic",
	ServiceTidal:   "tidal",
}

// RecherchePreRemplie rend l'URL de recherche du service choisi, requete deja
// encodee. C'est le repli obligatoire de LienEcoute, qui ne renvoie jamais de
// chaine vide.
func RecherchePreRemplie(s Service, requete string) string {
	modele, connu := modeleRecherche[s]
	if !connu {
		modele = modeleRecherche[ServiceDeezer]
	}
	return fmt.Sprintf(modele, url.QueryEscape(requete))
}

// Odesli adapte le role 4. BaseURL est un champ, pas une constante, pour
// permettre aux tests de la pointer vers httptest.NewServer.
type Odesli struct {
	cache    *cache.Cache
	limiteur *budget.Limiteur
	client   *http.Client
	BaseURL  string
}

// NouveauOdesli construit l'adaptateur. Aucune cle n'est requise.
func NouveauOdesli(c *cache.Cache, l *budget.Limiteur, client *http.Client) *Odesli {
	return &Odesli{cache: c, limiteur: l, client: client, BaseURL: odesliBaseURLDefaut}
}

type odesliReponse struct {
	LinksByPlatform map[string]struct {
		URL string `json:"url"`
	} `json:"linksByPlatform"`
}

// LienEcoute rend le lien vers le service choisi, ou a defaut de resolution
// exacte, une recherche pre-remplie sur ce service. Ne renvoie jamais de
// chaine vide.
func (o *Odesli) LienEcoute(ctx context.Context, s Service, artiste, album, urlDeezer string) string {
	requete := strings.TrimSpace(artiste + " " + album)
	repli := RecherchePreRemplie(s, requete)

	if urlDeezer == "" {
		return repli
	}

	cle := "odesli:lien:" + urlDeezer
	corps, err := o.cache.Obtenir(cle, 24*time.Hour, func() ([]byte, error) {
		if err := o.limiteur.Attendre(ctx, budget.Odesli, budget.Centre); err != nil {
			return nil, err
		}
		return o.appeler(ctx, fmt.Sprintf("%s/v1-alpha.1/links?url=%s", o.BaseURL, url.QueryEscape(urlDeezer)))
	})
	if err != nil {
		return repli
	}

	var reponse odesliReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return repli
	}

	plateforme, connue := plateformeOdesli[s]
	if !connue {
		return repli
	}
	lien, trouve := reponse.LinksByPlatform[plateforme]
	if !trouve || lien.URL == "" {
		return repli
	}
	return lien.URL
}

func (o *Odesli) appeler(ctx context.Context, requete string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requete, nil)
	if err != nil {
		return nil, err
	}
	resp, err := o.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("odesli : statut %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
