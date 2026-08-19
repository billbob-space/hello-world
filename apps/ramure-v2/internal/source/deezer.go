// apps/ramure-v2/internal/source/deezer.go
// Deezer : illustrations, taille d'audience et extraits ecoutables. Avec
// Last.fm, la seule source autorisee pour l'entourage — d'ou un debit
// genereux qui supporte une illustration par branche.
package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

const deezerBaseURLDefaut = "https://api.deezer.com"

// FicheDeezer porte ce que Chercher rend pour un artiste : ses illustrations,
// sa taille d'audience et le lien vers sa page Deezer.
type FicheDeezer struct {
	ID           int64
	Illustration Illustration
	Auditeurs    int // nb_fan
	LienArtiste  string
}

// Deezer adapte les illustrations, l'audience et les extraits. BaseURL est un
// champ, pas une constante, pour permettre aux tests de la pointer vers
// httptest.NewServer.
type Deezer struct {
	cache    *cache.Cache
	limiteur *budget.Limiteur
	client   *http.Client
	BaseURL  string
}

// NouveauDeezer construit l'adaptateur. Aucune cle n'est requise : Deezer
// s'interroge sans authentification.
func NouveauDeezer(c *cache.Cache, l *budget.Limiteur, client *http.Client) *Deezer {
	return &Deezer{cache: c, limiteur: l, client: client, BaseURL: deezerBaseURLDefaut}
}

type deezerRechercheReponse struct {
	Data []deezerArtiste `json:"data"`
}

type deezerArtiste struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	PictureSmall  string `json:"picture_small"`
	PictureMedium string `json:"picture_medium"`
	PictureBig    string `json:"picture_big"`
	PictureXL     string `json:"picture_xl"`
	NbFan         int    `json:"nb_fan"`
	Link          string `json:"link"`
}

// Chercher recherche un artiste par nom et ne rend que la correspondance
// stricte : la recherche Deezer est par mots-clefs, donc contaminante par
// nature.
func (d *Deezer) Chercher(ctx context.Context, nom string, p budget.Portee) (FicheDeezer, error) {
	cle := "deezer:fiche:" + Normaliser(nom)
	corps, err := d.cache.Obtenir(cle, 30*jour, func() ([]byte, error) {
		if err := d.limiteur.Attendre(ctx, budget.Deezer, p); err != nil {
			return nil, err
		}
		return d.appeler(ctx, fmt.Sprintf("%s/search/artist?q=%s&limit=5", d.BaseURL, url.QueryEscape(nom)))
	})
	if err != nil {
		return FicheDeezer{}, err
	}

	var reponse deezerRechercheReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return FicheDeezer{}, fmt.Errorf("decodage recherche deezer : %w", err)
	}

	candidat, trouve := CorrespondanceStricte(nom, reponse.Data, func(a deezerArtiste) string { return a.Name })
	if !trouve {
		return FicheDeezer{}, ErrIntrouvable
	}

	return FicheDeezer{
		ID: candidat.ID,
		Illustration: Illustration{
			Petite:  candidat.PictureSmall,
			Moyenne: candidat.PictureMedium,
			Grande:  candidat.PictureXL,
		},
		Auditeurs:   candidat.NbFan,
		LienArtiste: candidat.Link,
	}, nil
}

type deezerTopReponse struct {
	Data []deezerPiste `json:"data"`
}

type deezerPiste struct {
	Title    string `json:"title"`
	Preview  string `json:"preview"`
	Duration int    `json:"duration"`
}

// Extraits rend les pistes ecoutables d'un artiste. Une piste dont preview est
// vide est ecartee, pas rendue avec un bouton inerte (F-40) ; aucun extrait
// n'est une liste vide, pas une panne (F-36).
func (d *Deezer) Extraits(ctx context.Context, id int64, p budget.Portee) ([]Extrait, error) {
	cle := fmt.Sprintf("deezer:extraits:%d", id)
	corps, err := d.cache.Obtenir(cle, 30*jour, func() ([]byte, error) {
		if err := d.limiteur.Attendre(ctx, budget.Deezer, p); err != nil {
			return nil, err
		}
		return d.appeler(ctx, fmt.Sprintf("%s/artist/%d/top?limit=10", d.BaseURL, id))
	})
	if err != nil {
		return nil, err
	}

	var reponse deezerTopReponse
	if err := json.Unmarshal(corps, &reponse); err != nil {
		return nil, fmt.Errorf("decodage extraits deezer : %w", err)
	}

	extraits := make([]Extrait, 0, len(reponse.Data))
	for _, p := range reponse.Data {
		if p.Preview == "" {
			continue
		}
		extraits = append(extraits, Extrait{Titre: p.Title, URL: p.Preview, Duree: p.Duration})
	}
	return extraits, nil
}

func (d *Deezer) appeler(ctx context.Context, requete string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requete, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezer : statut %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
