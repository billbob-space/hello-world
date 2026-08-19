// apps/ramure-v2/internal/source/listenbrainz.go
// ListenBrainz : role 1 de repli, mitigation du risque §14 « source unique de
// proximite ». Interroge par MBID, jamais par nom — c'est pourquoi la
// cascade transporte un Artiste et non un simple nom (tache 4).
package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

const listenBrainzBaseURLDefaut = "https://labs.api.listenbrainz.org"

const algorithmeListenBrainz = "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30"

// ListenBrainz adapte le repli du role 1. BaseURL est un champ, pas une
// constante, pour permettre aux tests de la pointer vers httptest.NewServer.
type ListenBrainz struct {
	cache    *cache.Cache
	limiteur *budget.Limiteur
	client   *http.Client
	BaseURL  string
}

// NouveauListenBrainz construit l'adaptateur. Aucune cle n'est requise :
// ListenBrainz s'interroge sans authentification.
func NouveauListenBrainz(c *cache.Cache, l *budget.Limiteur, client *http.Client) *ListenBrainz {
	return &ListenBrainz{cache: c, limiteur: l, client: client, BaseURL: listenBrainzBaseURLDefaut}
}

type lbVoisin struct {
	ArtistMBID string `json:"artist_mbid"`
	Name       string `json:"name"`
	Score      int64  `json:"score"`
}

// Vivier interroge similar-artists par MBID. Sans MBID, aucune requete
// n'atteint le reseau : l'appel rend ErrIntrouvable, un etat vide et non une
// panne. Le score brut est normalise par le maximum de la liste, ce qui rend
// 1,0 au voisin le plus proche tout en conservant la monotonie exigee (F-09).
func (b *ListenBrainz) Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error) {
	if a.MBID == "" {
		return nil, ErrIntrouvable
	}

	cle := "listenbrainz:vivier:" + a.MBID
	corps, err := b.cache.Obtenir(cle, 7*jour, func() ([]byte, error) {
		if err := b.limiteur.Attendre(ctx, budget.ListenBrainz, p); err != nil {
			return nil, err
		}
		requete := fmt.Sprintf("%s/similar-artists/json?artist_mbids=%s&algorithm=%s",
			b.BaseURL, url.QueryEscape(a.MBID), algorithmeListenBrainz)
		return b.appeler(ctx, requete)
	})
	if err != nil {
		return nil, err
	}

	var candidats []lbVoisin
	if err := json.Unmarshal(corps, &candidats); err != nil {
		return nil, fmt.Errorf("decodage vivier listenbrainz : %w", err)
	}

	var maxScore int64
	for _, c := range candidats {
		if c.Score > maxScore {
			maxScore = c.Score
		}
	}

	voisins := make([]Voisin, 0, len(candidats))
	for _, c := range candidats {
		var affinite float64
		if maxScore > 0 {
			affinite = float64(c.Score) / float64(maxScore)
		}
		voisins = append(voisins, Voisin{Nom: c.Name, MBID: c.ArtistMBID, Affinite: affinite})
	}
	sort.SliceStable(voisins, func(i, j int) bool { return voisins[i].Affinite > voisins[j].Affinite })
	return voisins, nil
}

func (b *ListenBrainz) appeler(ctx context.Context, requete string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requete, nil)
	if err != nil {
		return nil, err
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("listenbrainz : statut %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
