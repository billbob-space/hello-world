// apps/ramure-v2/internal/arbre/centre.go
// Composition d'un centre complet, et distinction du vide et de la panne
// (F-36, F-37) : un vivier vide n'est pas une erreur, et une source en
// panne n'est pas un vivier vide. Porte F-36, F-37, F-38, F-39, N-01 et
// N-03.
package arbre

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// Etat distingue un centre normalement charge (EtatOK), un artiste sans
// voisin connu (EtatAucunVoisin, F-36) et une source indisponible
// (EtatPanne, F-37). Ce sont deux messages differents, et seul le second
// propose de reessayer : confondre les deux, c'est proposer de reessayer
// indefiniment quelque chose qui n'existe pas.
type Etat string

const (
	EtatOK          Etat = "ok"
	EtatAucunVoisin Etat = "aucun_voisin"
	EtatPanne       Etat = "panne"
)

// Branche est un voisin promu a l'affichage : son illustration, son lien
// d'ecoute et — charges en seconde phase, hors de Composer (F-39) — ses
// propres heritiers.
type Branche struct {
	Voisin       source.Voisin       `json:"voisin"`
	Illustration source.Illustration `json:"illustration"`
	LienDeezer   string              `json:"lienDeezer,omitempty"`
	Heritiers    []source.Voisin     `json:"heritiers,omitempty"`
}

// Centre est la reponse complete de GET /api/centre : identite, profil,
// discographie et entourage, plus l'etat qui distingue vide et panne.
type Centre struct {
	Artiste      source.Artiste      `json:"artiste"`
	Profil       source.Profil       `json:"profil"`
	Illustration source.Illustration `json:"illustration"`
	Discographie []source.Album      `json:"discographie,omitempty"`
	Branches     []Branche           `json:"branches,omitempty"`
	Etat         Etat                `json:"etat"`
	Message      string              `json:"message,omitempty"`
	Reessayable  bool                `json:"reessayable,omitempty"`
}

// Dependances rassemble les sources necessaires a la composition d'un
// centre, cablees une seule fois dans main() : un Cache, un Limiteur, un
// http.Client, une Cascade. Les PRP 06 et 07 elargissent cette structure,
// jamais en introduisant un second cablage.
//
// Odesli n'est JAMAIS lu par Composer ni par illustrerBranches : c'est
// l'invariant N-03 "0 appel Odesli au chargement" (PRP 03, tableau de
// budget). Le seul lecteur de ce champ est internal/api/ecouter.go, appele
// strictement au clic — jamais depuis ce fichier.
type Dependances struct {
	Catalogue *source.MusicBrainz
	Proximite source.Proximite
	Media     *source.Deezer
	Odesli    *source.Odesli
	Limiteur  *budget.Limiteur
}

// profileur est l'extension optionnelle de Proximite qui porte le profil
// (presentation, genres, audience). Seul Last.fm l'implemente dans la
// serie ; a la difference du vivier, Profil ne cascade JAMAIS vers
// ListenBrainz (PRD §07 : c'est une donnee propre a Last.fm, pas un repli
// entre sources equivalentes). Voir source.Cascade.Profil.
type profileur interface {
	Profil(ctx context.Context, nom string, p budget.Portee) (source.Profil, error)
}

// brancheParallelisme borne le nombre d'appels Deezer concurrents pour les
// illustrations de l'entourage : suffisant pour tenir la latence N-01,
// insuffisant pour faire exploser le debit de Deezer.
const brancheParallelisme = 4

// Composer construit un centre complet dans l'ordre du tableau de budget
// du PRP 04 : identite, discographie, pochette du mieux note, vivier,
// profil, puis l'illustration et le lien d'ecoute de chaque branche
// retenue. Les heritiers de chaque branche restent vides : F-39 les
// charge dans une seconde phase, separee de cette fonction.
//
// L'erreur rendue par Composer signale UNIQUEMENT un contexte annule
// pendant le chargement (§09) : toute panne de source est capturee dans
// Centre.Etat, jamais remontee comme erreur Go, pour que l'appelant HTTP
// puisse toujours repondre avec un etat plutot qu'une erreur opaque.
func Composer(ctx context.Context, d Dependances, nom string, c Cadrage, alea *rand.Rand) (Centre, error) {
	artiste, err := d.Catalogue.Resoudre(ctx, nom, budget.Centre)
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}
	if err != nil {
		if errors.Is(err, source.ErrIntrouvable) {
			return centreVide(fmt.Sprintf("Aucun artiste ne correspond à %q.", nom)), nil
		}
		return centrePanne("L'identité de l'artiste n'a pas pu être vérifiée. Réessaie dans un instant."), nil
	}

	discographie, err := d.Catalogue.Discographie(ctx, artiste.MBID, budget.Centre)
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}
	if err != nil {
		return centrePanne("La discographie n'a pas pu être chargée. Réessaie dans un instant."), nil
	}

	var illustrationCentre source.Illustration
	if rg := meilleurAlbumNote(discographie); rg != "" {
		if url, err := d.Catalogue.Pochette(ctx, rg, budget.Centre); err == nil && url != "" {
			illustrationCentre.Grande = url
		}
		if annule := ctx.Err(); annule != nil {
			return Centre{}, annule
		}
	}

	vivier, err := d.Proximite.Vivier(ctx, artiste, budget.Centre)
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}
	if err != nil {
		if errors.Is(err, source.ErrIntrouvable) {
			return centreVideAvec(artiste, discographie, illustrationCentre,
				"Aucun voisin connu pour cet artiste."), nil
		}
		return centrePanne("Les voisins de cet artiste n'ont pas pu être chargés. Réessaie dans un instant."), nil
	}
	if len(vivier) == 0 {
		return centreVideAvec(artiste, discographie, illustrationCentre,
			"Aucun voisin connu pour cet artiste."), nil
	}

	var profil source.Profil
	if pf, ok := d.Proximite.(profileur); ok {
		if p, err := pf.Profil(ctx, artiste.Nom, budget.Centre); err == nil {
			profil = p
		}
	}
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}

	if d.Media != nil {
		if fiche, err := d.Media.Chercher(ctx, artiste.Nom, budget.Entourage); err == nil {
			illustrationCentre = fiche.Illustration
		}
	}
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}

	choisis := SelectionnerBranches(vivier, c, alea)
	branches := illustrerBranches(ctx, d, choisis)
	if annule := ctx.Err(); annule != nil {
		return Centre{}, annule
	}
	branches = Elaguer(branches, c.Stables)

	return Centre{
		Artiste:      artiste,
		Profil:       profil,
		Illustration: illustrationCentre,
		Discographie: discographie,
		Branches:     branches,
		Etat:         EtatOK,
	}, nil
}

// meilleurAlbumNote rend le MBID de l'album le mieux note et significatif
// (seuil de votes atteint), ou "" si aucun n'est significatif — c'est ce
// qui rend l'appel Pochette au plus 1, jamais systematique.
func meilleurAlbumNote(albums []source.Album) string {
	var meilleur source.Album
	trouve := false
	for _, a := range albums {
		if a.Votes < source.MinVotes {
			continue
		}
		if !trouve || a.Note > meilleur.Note {
			meilleur = a
			trouve = true
		}
	}
	if !trouve {
		return ""
	}
	return meilleur.MBID
}

// illustrerBranches charge en parallele, borne a brancheParallelisme,
// l'illustration et le lien d'ecoute de chaque voisin retenu. Un echec
// Deezer sur une branche particuliere n'est pas fatal : la branche reste
// affichable sans illustration (ou est elaguee ensuite si elle n'a aucun
// autre materiau).
func illustrerBranches(ctx context.Context, d Dependances, voisins []source.Voisin) []Branche {
	branches := make([]Branche, len(voisins))
	for i, v := range voisins {
		branches[i] = Branche{Voisin: v}
	}
	if d.Media == nil {
		return branches
	}

	jetons := make(chan struct{}, brancheParallelisme)
	var attente sync.WaitGroup
	for i := range branches {
		attente.Add(1)
		jetons <- struct{}{}
		go func(i int) {
			defer attente.Done()
			defer func() { <-jetons }()
			fiche, err := d.Media.Chercher(ctx, branches[i].Voisin.Nom, budget.Entourage)
			if err != nil {
				return
			}
			branches[i].Illustration = fiche.Illustration
			branches[i].LienDeezer = fiche.LienArtiste
		}(i)
	}
	attente.Wait()
	return branches
}

func centreVide(message string) Centre {
	return Centre{Etat: EtatAucunVoisin, Message: message}
}

func centreVideAvec(a source.Artiste, discographie []source.Album, illustration source.Illustration, message string) Centre {
	return Centre{
		Artiste:      a,
		Discographie: discographie,
		Illustration: illustration,
		Etat:         EtatAucunVoisin,
		Message:      message,
	}
}

func centrePanne(message string) Centre {
	return Centre{Etat: EtatPanne, Message: message, Reessayable: true}
}
