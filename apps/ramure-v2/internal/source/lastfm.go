// apps/ramure-v2/internal/source/lastfm.go
// Last.fm : role 1, premiere source de la cascade de proximite. Son affinite
// est deja normalisee entre 0 et 1 par la source elle-meme.
package source

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

const lastFMBaseURLDefaut = "https://ws.audioscrobbler.com"

// ErrCleAbsente signale que LASTFM_API_KEY n'est pas configuree. C'est ce qui
// rend la cascade possible sans que l'app ait a savoir si la cle est
// configuree : Vivier la renvoie a chaque appel, sans requete reseau.
var ErrCleAbsente = errors.New("LASTFM_API_KEY absente")

// LastFM adapte le role 1. BaseURL est un champ, pas une constante, pour
// permettre aux tests de la pointer vers httptest.NewServer.
type LastFM struct {
	cle      string
	cache    *cache.Cache
	limiteur *budget.Limiteur
	client   *http.Client
	BaseURL  string
}

// NouveauLastFM construit l'adaptateur. cle vide n'est pas une erreur de
// construction : c'est Vivier et Profil qui la refusent, a chaque appel, pour
// que l'app demarre sans aucun secret (N-06).
func NouveauLastFM(cle string, c *cache.Cache, l *budget.Limiteur, client *http.Client) *LastFM {
	return &LastFM{cle: cle, cache: c, limiteur: l, client: client, BaseURL: lastFMBaseURLDefaut}
}

type lastfmErreur struct {
	Error   int    `json:"error"`
	Message string `json:"message"`
}

type lastfmSimilaireReponse struct {
	SimilarArtists struct {
		Artist []lastfmArtisteSimilaire `json:"artist"`
	} `json:"similarartists"`
}

type lastfmArtisteSimilaire struct {
	Name  string `json:"name"`
	MBID  string `json:"mbid"`
	Match string `json:"match"`
}

// Vivier interroge artist.getsimilar. autocorrect=0 est delibere : la
// correction de Last.fm n'est pas bornee et substituerait silencieusement un
// artiste a un autre (§09) ; le rattrapage orthographique se fait au PRP 06,
// sous CorrectionPlausible, affiche a l'utilisateur.
func (l *LastFM) Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error) {
	if l.cle == "" {
		return nil, ErrCleAbsente
	}

	cle := "lastfm:vivier:" + Normaliser(a.Nom)
	corps, err := l.cache.Obtenir(cle, 7*jour, func() ([]byte, error) {
		if err := l.limiteur.Attendre(ctx, budget.LastFM, p); err != nil {
			return nil, err
		}
		return l.appeler(ctx, fmt.Sprintf(
			"%s/2.0/?method=artist.getsimilar&artist=%s&api_key=%s&format=json&limit=60&autocorrect=0",
			l.BaseURL, url.QueryEscape(a.Nom), url.QueryEscape(l.cle)))
	})
	if err != nil {
		return nil, err
	}

	var reponse lastfmSimilaireReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return nil, fmt.Errorf("decodage vivier last.fm : %w", err)
	}

	voisins := make([]Voisin, 0, len(reponse.SimilarArtists.Artist))
	for _, ar := range reponse.SimilarArtists.Artist {
		affinite, err := strconv.ParseFloat(ar.Match, 64)
		if err != nil {
			affinite = 0
		}
		voisins = append(voisins, Voisin{Nom: ar.Name, MBID: ar.MBID, Affinite: affinite})
	}
	sort.SliceStable(voisins, func(i, j int) bool { return voisins[i].Affinite > voisins[j].Affinite })
	return voisins, nil
}

type lastfmInfoReponse struct {
	Artist struct {
		Stats struct {
			Listeners string `json:"listeners"`
		} `json:"stats"`
		Bio struct {
			Summary string `json:"summary"`
		} `json:"bio"`
		Tags struct {
			Tag []struct {
				Name string `json:"name"`
			} `json:"tag"`
		} `json:"tags"`
	} `json:"artist"`
}

// Profil interroge artist.getinfo pour la presentation, les genres et la
// taille d'audience affiches en permanence sur le centre (PRD §07).
func (l *LastFM) Profil(ctx context.Context, nom string, p budget.Portee) (Profil, error) {
	if l.cle == "" {
		return Profil{}, ErrCleAbsente
	}

	cle := "lastfm:profil:" + Normaliser(nom)
	corps, err := l.cache.Obtenir(cle, 7*jour, func() ([]byte, error) {
		if err := l.limiteur.Attendre(ctx, budget.LastFM, p); err != nil {
			return nil, err
		}
		return l.appeler(ctx, fmt.Sprintf(
			"%s/2.0/?method=artist.getinfo&artist=%s&api_key=%s&format=json&autocorrect=0",
			l.BaseURL, url.QueryEscape(nom), url.QueryEscape(l.cle)))
	})
	if err != nil {
		return Profil{}, err
	}

	var reponse lastfmInfoReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return Profil{}, fmt.Errorf("decodage profil last.fm : %w", err)
	}

	genres := make([]string, 0, len(reponse.Artist.Tags.Tag))
	for _, tg := range reponse.Artist.Tags.Tag {
		genres = append(genres, tg.Name)
	}
	auditeurs, _ := strconv.Atoi(reponse.Artist.Stats.Listeners)

	return Profil{
		Presentation: reponse.Artist.Bio.Summary,
		Genres:       genres,
		Auditeurs:    auditeurs,
	}, nil
}

// appeler emet la requete et decode l'enveloppe d'erreur eventuelle de
// Last.fm avant de rendre le corps : un code d'erreur — dont 29, trop de
// requetes — remonte tel quel et n'est jamais memorise, la validation venant
// avant le cache (regle 1 du PRP).
func (l *LastFM) appeler(ctx context.Context, requete string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requete, nil)
	if err != nil {
		return nil, err
	}
	resp, err := l.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("last.fm : statut %d", resp.StatusCode)
	}
	corps, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var erreur lastfmErreur
	if err := json.Unmarshal(corps, &erreur); err == nil && erreur.Error != 0 {
		return nil, fmt.Errorf("last.fm : erreur %d : %s", erreur.Error, erreur.Message)
	}
	return corps, nil
}
