// apps/ramure-v2/internal/source/musicbrainz.go
// MusicBrainz : resolution d'un nom vers un MBID non ambigu (role 2), et
// discographie notee et classee (role 3), plus la pochette du centre via
// Cover Art Archive.
package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

const (
	jour = 24 * time.Hour

	musicBrainzBaseURLDefaut = "https://musicbrainz.org"
	coverArtBaseURLDefaut    = "https://coverartarchive.org"
)

// MusicBrainz adapte les roles 2 et 3 du PRD, plus la pochette du centre via
// Cover Art Archive. BaseURL et CoverArtBaseURL sont des champs, pas des
// constantes : c'est ce qui permet aux tests de les pointer vers
// httptest.NewServer.
type MusicBrainz struct {
	cache           *cache.Cache
	limiteur        *budget.Limiteur
	client          *http.Client
	userAgent       string
	BaseURL         string
	CoverArtBaseURL string
}

// NouveauMusicBrainz construit l'adaptateur. userAgent doit identifier
// l'application et un contact : MusicBrainz bloque l'adresse IP en son
// absence, et cette adresse est partagee par tous les utilisateurs.
func NouveauMusicBrainz(c *cache.Cache, l *budget.Limiteur, client *http.Client, userAgent string) *MusicBrainz {
	return &MusicBrainz{
		cache:           c,
		limiteur:        l,
		client:          client,
		userAgent:       userAgent,
		BaseURL:         musicBrainzBaseURLDefaut,
		CoverArtBaseURL: coverArtBaseURLDefaut,
	}
}

type mbArtisteReponse struct {
	Artists []mbArtiste `json:"artists"`
}

type mbArtiste struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Score int    `json:"score"`
}

// Resoudre cherche un artiste par nom et ne rend que la correspondance
// stricte : le score de MusicBrainz ne suffit pas, il vaut 100 pour un
// candidat approchant.
func (m *MusicBrainz) Resoudre(ctx context.Context, nom string, p budget.Portee) (Artiste, error) {
	cle := "musicbrainz:artiste:" + Normaliser(nom)
	corps, err := m.cache.Obtenir(cle, 30*jour, func() ([]byte, error) {
		if err := m.limiteur.Attendre(ctx, budget.MusicBrainz, p); err != nil {
			return nil, err
		}
		return m.appeler(ctx, fmt.Sprintf("%s/ws/2/artist?query=artist:%%22%s%%22&limit=5&fmt=json",
			m.BaseURL, url.QueryEscape(nom)))
	})
	if err != nil {
		return Artiste{}, err
	}

	var reponse mbArtisteReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return Artiste{}, fmt.Errorf("decodage reponse musicbrainz : %w", err)
	}

	candidat, trouve := CorrespondanceStricte(nom, reponse.Artists, func(a mbArtiste) string { return a.Name })
	if !trouve {
		return Artiste{}, ErrIntrouvable
	}
	return Artiste{MBID: candidat.ID, Nom: candidat.Name}, nil
}

// suggestionsMax borne le nombre de candidats rendus par Suggerer (F-01) :
// une liste de suggestions plus longue n'aide plus a choisir, elle noie.
const suggestionsMax = 8

// Suggerer cherche des candidats par nom approchant, pour le fil de la
// frappe (F-01, F-02) et le rattrapage orthographique (F-03).
// Contrairement a Resoudre, AUCUNE correspondance stricte n'est appliquee
// ici : plusieurs candidats sont rendus, dans l'ordre de pertinence de
// MusicBrainz, et c'est a l'utilisateur — jamais au serveur en silence —
// de choisir celui qui convient (§09, "aucune substitution silencieuse").
func (m *MusicBrainz) Suggerer(ctx context.Context, q string, p budget.Portee) ([]Artiste, error) {
	cle := "musicbrainz:suggestions:" + Normaliser(q)
	corps, err := m.cache.Obtenir(cle, jour, func() ([]byte, error) {
		if err := m.limiteur.Attendre(ctx, budget.MusicBrainz, p); err != nil {
			return nil, err
		}
		return m.appeler(ctx, fmt.Sprintf("%s/ws/2/artist?query=%s&limit=%d&fmt=json",
			m.BaseURL, url.QueryEscape(q), suggestionsMax))
	})
	if err != nil {
		return nil, err
	}

	var reponse mbArtisteReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return nil, fmt.Errorf("decodage suggestions musicbrainz : %w", err)
	}

	suggestions := make([]Artiste, 0, len(reponse.Artists))
	for _, a := range reponse.Artists {
		if a.Name == "" {
			continue
		}
		if len(suggestions) >= suggestionsMax {
			break
		}
		suggestions = append(suggestions, Artiste{MBID: a.ID, Nom: a.Name})
	}
	return suggestions, nil
}

type mbReleaseGroupReponse struct {
	ReleaseGroups []mbReleaseGroup `json:"release-groups"`
}

type mbReleaseGroup struct {
	ID               string    `json:"id"`
	Title            string    `json:"title"`
	FirstReleaseDate string    `json:"first-release-date"`
	PrimaryType      string    `json:"primary-type"`
	SecondaryTypes   []string  `json:"secondary-types"`
	Rating           *mbRating `json:"rating"`
}

type mbRating struct {
	VotesCount int     `json:"votes-count"`
	Value      float64 `json:"value"`
}

// TypeSortie classe un album selon la regle de la tache 2 : un seul type par
// album, les types secondaires priment sur le type primaire (F-22).
type TypeSortie string

const (
	Studio      TypeSortie = "studio"
	Live        TypeSortie = "live"
	Compilation TypeSortie = "compilation"
	FormatCourt TypeSortie = "format-court"
)

// MinVotes est le seuil sous lequel une note n'est pas jugee significative
// (F-21).
const MinVotes = 5

// ClasserTypeSortie applique la table de la tache 2 : les types secondaires
// priment sur le type primaire, et chaque album releve d'un seul type.
func ClasserTypeSortie(primaire string, secondaires []string) TypeSortie {
	for _, s := range secondaires {
		if s == "Live" {
			return Live
		}
	}
	for _, s := range secondaires {
		if s == "Compilation" {
			return Compilation
		}
	}
	switch primaire {
	case "Single", "EP":
		return FormatCourt
	case "Album":
		return Studio
	default:
		return Studio
	}
}

// Discographie rend les albums rattaches au MBID demande, classes par type et
// notes quand le seuil de votes est atteint. F-20, F-21 et F-22 en un seul
// appel.
func (m *MusicBrainz) Discographie(ctx context.Context, mbid string, p budget.Portee) ([]Album, error) {
	cle := "musicbrainz:discographie:" + mbid
	corps, err := m.cache.Obtenir(cle, 30*jour, func() ([]byte, error) {
		if err := m.limiteur.Attendre(ctx, budget.MusicBrainz, p); err != nil {
			return nil, err
		}
		return m.appeler(ctx, fmt.Sprintf("%s/ws/2/release-group?artist=%s&limit=100&inc=ratings&fmt=json",
			m.BaseURL, mbid))
	})
	if err != nil {
		return nil, err
	}

	var reponse mbReleaseGroupReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return nil, fmt.Errorf("decodage discographie musicbrainz : %w", err)
	}

	albums := make([]Album, 0, len(reponse.ReleaseGroups))
	for _, rg := range reponse.ReleaseGroups {
		album := Album{
			MBID:   rg.ID,
			Titre:  rg.Title,
			Sortie: rg.FirstReleaseDate,
			Type:   ClasserTypeSortie(rg.PrimaryType, rg.SecondaryTypes),
		}
		if rg.Rating != nil && rg.Rating.VotesCount >= MinVotes {
			album.Note = rg.Rating.Value
			album.Votes = rg.Rating.VotesCount
		}
		albums = append(albums, album)
	}
	// Tri par cle unique, pas par comparaison a deux branches : une comparaison
	// qui rend faux des qu'un seul des deux albums est sous le seuil n'est pas
	// un ordre strict faible (elle n'est pas transitive — deux albums notes
	// peuvent devenir « egaux » via un album non note intercale entre eux), et
	// Go trie alors de travers sans jamais le signaler. La cle rend ce risque
	// impossible : un album sous MinVotes recoit une cle strictement
	// inferieure a toute note reelle (les notes MusicBrainz sont >= 0), donc
	// tous les albums notes et significatifs passent avant, tries par note
	// decroissante ; les non-notes (memes cles) suivent, departages par
	// sort.SliceStable dans l'ordre de la source (F-21, mitigation §14).
	cleTri := func(a Album) float64 {
		if a.Votes >= MinVotes {
			return a.Note
		}
		return -1
	}
	sort.SliceStable(albums, func(i, j int) bool {
		return cleTri(albums[i]) > cleTri(albums[j])
	})
	return albums, nil
}

// Pochette rend l'URL de l'illustration frontale d'un release-group via Cover
// Art Archive. Une absence n'est pas une panne : elle rend une chaine vide
// sans erreur, et le repli graphique deterministe du PRP 05 prend le relais.
func (m *MusicBrainz) Pochette(ctx context.Context, releaseGroupMBID string, p budget.Portee) (string, error) {
	url := fmt.Sprintf("%s/release-group/%s/front-500", m.CoverArtBaseURL, releaseGroupMBID)
	cle := "coverart:pochette:" + releaseGroupMBID
	_, err := m.cache.Obtenir(cle, 30*jour, func() ([]byte, error) {
		if err := m.limiteur.Attendre(ctx, budget.CoverArt, p); err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", m.userAgent)
		resp, err := m.client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			// Marque explicitement : ni erreur (pas de mise en cache), ni octets
			// vides confondus avec un succes reel. On renvoie une erreur locale
			// jamais exposee a l'appelant pour eviter de memoriser une absence.
			return nil, errPochetteAbsente
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("cover art archive : statut %d", resp.StatusCode)
		}
		corps, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		return corps, nil
	})
	if err != nil {
		if err == errPochetteAbsente {
			return "", nil
		}
		return "", err
	}
	return url, nil
}

var errPochetteAbsente = fmt.Errorf("pochette absente")

// appeler emet une requete GET avec le User-Agent obligatoire et rend le corps
// sur statut 200 uniquement : la validation vient avant le cache, jamais
// apres, pour qu'une 500 ne soit jamais memorisee (regle 1 du PRP).
func (m *MusicBrainz) appeler(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", m.userAgent)
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("musicbrainz : statut %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
