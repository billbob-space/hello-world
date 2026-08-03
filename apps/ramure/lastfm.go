// Last.fm — role 1 (affinite mesuree) et role 3 (appreciation communautaire).
//
// Cette source est FACULTATIVE. Sans LASTFM_API_KEY, elle n'est pas instanciee
// du tout et le produit tourne sur Deezer seul : affinite derivee du rang,
// discographie dans l'ordre du catalogue. C'est la N-06 appliquee a la lettre —
// "l'indisponibilite d'une source secondaire degrade une fonction, jamais
// l'ecran" — et la N-13, qui demande que l'architecture tienne sans contrat
// payant.
//
// Trois appels au maximum par centre, et aucun par branche :
//
//	artist.getSimilar    la vraie affinite, normalisee 0..1  (role 1)
//	artist.getInfo       biographie, genres, auditeurs       (F-19)
//	artist.getTopAlbums  l'appreciation de toute la disco     (role 3)
//
// Le troisieme merite un mot. Interroger album.getInfo album par album serait
// la lecture naive du role 3 — et couterait vingt appels pour une seule fiche.
// artist.getTopAlbums rend les ecoutes de toute la discographie en une fois.
// C'est la meme logique que pour Deezer /related : choisir le point d'entree
// qui rend un lot plutot que l'unite.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var baseLastfm = "https://ws.audioscrobbler.com/2.0/"

type Lastfm struct {
	http  *http.Client
	cache *Cache
	debit *Debit
	cle   string
}

func NouveauLastfm(cache *Cache, cle string) *Lastfm {
	return &Lastfm{
		http:  &http.Client{Timeout: 8 * time.Second},
		cache: cache,
		cle:   cle,
		// Last.fm ne publie pas de plafond ferme mais recommande de rester
		// sous cinq appels par seconde et par cle. On se tient a trois.
		debit: NouveauDebit(3, 10),
	}
}

// appelle execute une methode de l'API et decode sa reponse.
//
// Comme Deezer, Last.fm signale certaines erreurs dans un corps HTTP 200 —
// notamment le depassement de quota et la cle invalide. Le champ "error" est
// donc lu avant toute chose. La N-05 en depend : une erreur prise pour une
// reponse vide serait mise en cache, et la degradation deviendrait permanente.
func (l *Lastfm) appelle(ctx context.Context, methode string, params url.Values, cible any, b *Budget) error {
	if err := l.debit.Attends(ctx); err != nil {
		return err
	}
	b.Compte("lastfm")

	q := url.Values{}
	for k, v := range params {
		q[k] = v
	}
	q.Set("method", methode)
	q.Set("api_key", l.cle)
	q.Set("format", "json")
	// autocorrect=1 laisse Last.fm rapprocher une variante orthographique de
	// sa forme canonique. C'est sans risque ici : le nom soumis vient deja de
	// la resolution stricte Deezer, donc d'un artiste confirme. Last.fm ne
	// choisit pas l'artiste, il retrouve celui qu'on lui nomme.
	q.Set("autocorrect", "1")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseLastfm+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", agentHTTP)

	rep, err := l.http.Do(req)
	if err != nil {
		return fmt.Errorf("last.fm injoignable : %w", err)
	}
	defer rep.Body.Close()

	brut, err := lisBorne(rep.Body)
	if err != nil {
		return err
	}

	var enveloppe struct {
		Code    int    `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(brut, &enveloppe); err == nil && enveloppe.Code != 0 {
		return fmt.Errorf("last.fm erreur %d : %s", enveloppe.Code, enveloppe.Message)
	}
	if rep.StatusCode != http.StatusOK {
		return fmt.Errorf("last.fm a repondu %d", rep.StatusCode)
	}

	return json.Unmarshal(brut, cible)
}

// Similaires rend l'affinite mesuree, indexee par nom normalise.
//
// La cle de la table est le nom normalise et non le nom brut : c'est ce qui
// permet l'appariement avec le vivier Deezer, ou "Sigur Rós" et "Sigur Ros"
// designent le meme groupe.
func (l *Lastfm) Similaires(ctx context.Context, nom string, b *Budget) (map[string]float64, error) {
	cle := "lfm:similaires:" + normalise(nom)

	v, err := l.cache.Charge(ctx, cle, ttlVoisins, func(ctx context.Context) (any, error) {
		var rep struct {
			SimilarArtists struct {
				Artist []struct {
					Nom   string `json:"name"`
					Match string `json:"match"`
				} `json:"artist"`
			} `json:"similarartists"`
		}
		params := url.Values{"artist": {nom}, "limit": {"100"}}
		if err := l.appelle(ctx, "artist.getSimilar", params, &rep, b); err != nil {
			return nil, err
		}

		out := make(map[string]float64, len(rep.SimilarArtists.Artist))
		for _, a := range rep.SimilarArtists.Artist {
			// Last.fm rend "match" en chaine, et parfois en notation
			// scientifique pour les tres petites valeurs.
			m, err := strconv.ParseFloat(a.Match, 64)
			if err != nil || math.IsNaN(m) {
				continue
			}
			out[normalise(a.Nom)] = math.Min(math.Max(m, 0), 1)
		}
		if len(out) == 0 {
			return nil, ErrVide
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	m, _ := v.(map[string]float64)
	return m, nil
}

// InfoArtiste est ce que le role 1 doit fournir en plus de la proximite :
// "une presentation textuelle, des genres et un indicateur d'audience" (§09).
type InfoArtiste struct {
	Bio       string
	Genres    []string
	Auditeurs int
}

func (l *Lastfm) Info(ctx context.Context, nom string, b *Budget) (InfoArtiste, error) {
	cle := "lfm:info:" + normalise(nom)

	v, err := l.cache.Charge(ctx, cle, ttlArtiste, func(ctx context.Context) (any, error) {
		var rep struct {
			Artist struct {
				Stats struct {
					Listeners string `json:"listeners"`
				} `json:"stats"`
				Tags struct {
					Tag []struct {
						Nom string `json:"name"`
					} `json:"tag"`
				} `json:"tags"`
				Bio struct {
					Summary string `json:"summary"`
				} `json:"bio"`
			} `json:"artist"`
		}
		params := url.Values{"artist": {nom}}
		if err := l.appelle(ctx, "artist.getInfo", params, &rep, b); err != nil {
			return nil, err
		}

		info := InfoArtiste{Bio: nettoieBio(rep.Artist.Bio.Summary)}
		for _, t := range rep.Artist.Tags.Tag {
			if t.Nom != "" && len(info.Genres) < 5 {
				info.Genres = append(info.Genres, t.Nom)
			}
		}
		if n, err := strconv.Atoi(rep.Artist.Stats.Listeners); err == nil {
			info.Auditeurs = n
		}
		return info, nil
	})
	if err != nil {
		return InfoArtiste{}, err
	}
	info, _ := v.(InfoArtiste)
	return info, nil
}

// Appreciation est une note communautaire et le nombre de suffrages qui la
// fondent (role 3).
type Appreciation struct {
	Note  float64 // 0..1
	Votes int
}

// Appreciations rend l'appreciation de toute la discographie en un appel,
// indexee par titre canonique normalise.
//
// Last.fm ne publie pas de note sur cinq etoiles : il publie un nombre
// d'ecoutes. La note est donc DERIVEE — on rapporte les ecoutes de chaque
// album a celles de l'album le plus ecoute de l'artiste. C'est une appreciation
// *relative a l'artiste*, ce qui est exactement ce dont la discographie a
// besoin : la question posee par l'utilisateur est "par ou entrer chez cet
// artiste", pas "cet artiste vaut-il un autre".
//
// L'echelle est logarithmique. Les ecoutes suivent une loi de puissance
// brutale — l'album phare peut peser cinquante fois le suivant — et une echelle
// lineaire ecraserait toute la discographie a une note quasi nulle, ne laissant
// qu'un seul album visible. Le logarithme rend l'ecart lisible.
func (l *Lastfm) Appreciations(ctx context.Context, nom string, b *Budget) (map[string]Appreciation, error) {
	cle := "lfm:topalbums:" + normalise(nom)

	v, err := l.cache.Charge(ctx, cle, ttlNote, func(ctx context.Context) (any, error) {
		var rep struct {
			TopAlbums struct {
				Album []struct {
					Nom     string `json:"name"`
					Ecoutes int    `json:"playcount"`
				} `json:"album"`
			} `json:"topalbums"`
		}
		params := url.Values{"artist": {nom}, "limit": {"60"}}
		if err := l.appelle(ctx, "artist.getTopAlbums", params, &rep, b); err != nil {
			return nil, err
		}

		maxEcoutes := 0
		for _, a := range rep.TopAlbums.Album {
			if a.Ecoutes > maxEcoutes {
				maxEcoutes = a.Ecoutes
			}
		}
		if maxEcoutes <= 0 {
			return nil, ErrVide
		}

		plafond := math.Log1p(float64(maxEcoutes))
		out := make(map[string]Appreciation, len(rep.TopAlbums.Album))
		for _, a := range rep.TopAlbums.Album {
			if a.Ecoutes <= 0 || a.Nom == "" {
				continue
			}
			note := math.Log1p(float64(a.Ecoutes)) / plafond
			out[normalise(titreCanonique(a.Nom))] = Appreciation{
				Note:  math.Min(math.Max(note, 0), 1),
				Votes: a.Ecoutes,
			}
		}
		if len(out) == 0 {
			return nil, ErrVide
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	m, _ := v.(map[string]Appreciation)
	return m, nil
}

// nettoieBio retire le pied de page promotionnel et le balisage des resumes
// Last.fm, qui se terminent tous par un lien "Read more on Last.fm".
func nettoieBio(s string) string {
	if i := strings.Index(s, "<a href"); i >= 0 {
		s = s[:i]
	}
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)

	// Un resume tres long n'a pas sa place dans un panneau lateral : on coupe
	// a la fin d'une phrase plutot qu'au milieu d'un mot.
	const maxBio = 480
	if len(s) > maxBio {
		coupe := s[:maxBio]
		if i := strings.LastIndexAny(coupe, ".!?"); i > maxBio/2 {
			return coupe[:i+1]
		}
		if i := strings.LastIndex(coupe, " "); i > 0 {
			return coupe[:i] + "…"
		}
	}
	return s
}
