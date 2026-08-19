// apps/ramure-v2/internal/source/source.go
// Types partages entre les six adaptateurs, et rien d'autre : chaque
// fournisseur vit dans son propre fichier (musicbrainz.go, lastfm.go,
// listenbrainz.go, deezer.go, odesli.go), qui ne fait que produire ou
// consommer ces types.
package source

import (
	"context"
	"errors"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
)

// Artiste porte assez d'identite pour que la cascade du role 1 (tache 4)
// puisse basculer de Last.fm, qui interroge par nom, vers ListenBrainz, qui
// exige un MBID.
type Artiste struct {
	MBID             string
	Nom              string
	Pays             string
	Desambiguisation string
}

// Voisin est un candidat de proximite, quelle que soit la source qui l'a
// produit. Affinite est toujours ramenee entre 0 et 1 par l'adaptateur, meme
// quand la source d'origine ne le fait pas (ListenBrainz, tache 4).
type Voisin struct {
	Nom      string
	MBID     string
	Affinite float64
}

// Profil accompagne le centre a l'ecran (PRD §07) : presentation textuelle,
// genres et taille d'audience.
type Profil struct {
	Presentation string
	Genres       []string
	Auditeurs    int
}

// Illustration porte les trois tailles usuelles d'une image d'artiste.
type Illustration struct {
	Petite string
	Moyenne string
	Grande  string
}

// Album resume une entree de discographie, deja classee par ClasserTypeSortie
// et notee par MusicBrainz quand le seuil de votes est atteint.
type Album struct {
	MBID   string
	Titre  string
	Sortie string
	Type   TypeSortie
	Note   float64
	Votes  int
}

// Extrait est une piste ecoutable a la demande (role 4), jamais chargee tant
// que l'utilisateur ne l'a pas demandee.
type Extrait struct {
	Titre string
	URL   string
	Duree int
}

// ErrIntrouvable signale un vide plutot qu'une panne : aucun candidat ne
// correspond strictement a la demande (§09), ou l'entree necessaire (un MBID,
// par exemple) est absente. Le PRP 04 le distingue explicitement d'un etat de
// panne.
var ErrIntrouvable = errors.New("introuvable")

// Proximite est l'interface commune aux sources du role 1, ce qui permet la
// cascade de repli de la tache 4 : Last.fm interroge par nom, ListenBrainz
// exige un MBID, d'ou un Artiste complet en argument plutot qu'un simple nom.
type Proximite interface {
	Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error)
}

// Cascade essaie chaque source dans l'ordre et s'arrete a la premiere qui
// repond sans erreur — y compris quand cette reponse est un vivier vide : un
// vivier vide et une source indisponible sont deux etats distincts (F-36), et
// confondre les deux en poursuivant sur la source suivante masquerait une
// vraie absence de voisins derriere le resultat d'une source de repli.
type Cascade struct {
	Sources []Proximite
}

// Vivier essaie chaque source de la cascade dans l'ordre et rend la premiere
// reponse sans erreur, y compris vide. Si toutes echouent, la derniere erreur
// rencontree est remontee.
func (c Cascade) Vivier(ctx context.Context, a Artiste, p budget.Portee) ([]Voisin, error) {
	var derniereErr error
	for _, s := range c.Sources {
		voisins, err := s.Vivier(ctx, a, p)
		if err == nil {
			return voisins, nil
		}
		derniereErr = err
	}
	return nil, derniereErr
}

// profileur est l'extension optionnelle de Proximite qui porte le profil
// (presentation, genres, audience). Seul Last.fm l'implemente dans la serie
// (PRP 04) : a la difference du vivier, le profil n'est pas un repli entre
// plusieurs sources equivalentes — c'est une donnee propre a Last.fm (PRD
// §07), et ListenBrainz n'a simplement pas de methode Profil.
type profileur interface {
	Profil(ctx context.Context, nom string, p budget.Portee) (Profil, error)
}

// Profil rend le profil de la premiere source de la cascade qui
// l'implemente, sans repli vers les suivantes : contrairement a Vivier, ce
// n'est pas une cascade de tolerance entre sources equivalentes, seule
// Last.fm porte cette donnee. ErrIntrouvable si aucune source de la cascade
// n'implemente Profil.
func (c Cascade) Profil(ctx context.Context, nom string, p budget.Portee) (Profil, error) {
	for _, s := range c.Sources {
		if pf, ok := s.(profileur); ok {
			return pf.Profil(ctx, nom, p)
		}
	}
	return Profil{}, ErrIntrouvable
}
