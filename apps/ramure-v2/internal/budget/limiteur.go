// apps/ramure-v2/internal/budget/limiteur.go
// Budget d'appels borne et documente, par source (N-03, critique).
//
// La promotion est le geste central et le plus couteux du produit : afficher un
// centre, son entourage et les heritiers de chaque branche peut representer
// plusieurs dizaines d'appels externes. La regle « profondeur maximale au
// centre, strict minimum sur l'entourage » est posee ici, dans le type, plutot
// que laissee a la discipline des appelants : c'est la seule facon qu'elle
// survive a la relecture de PRP suivants.
package budget

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Source nomme les six fournisseurs retenus par la serie. Toute autre valeur
// est refusee : une source non declaree n'a ni debit connu, ni portee decidee.
type Source string

const (
	MusicBrainz  Source = "musicbrainz"
	CoverArt     Source = "coverart"
	LastFM       Source = "lastfm"
	ListenBrainz Source = "listenbrainz"
	Deezer       Source = "deezer"
	Odesli       Source = "odesli"
)

// Portee dit pour quelle partie de l'arbre l'appel est emis. Le centre est
// unique et merite la profondeur ; l'entourage compte jusqu'a dix branches et
// trente heritiers, et ne supporte que les sources tolerantes.
type Portee string

const (
	Centre    Portee = "centre"
	Entourage Portee = "entourage"
)

var ErrPorteeInterdite = errors.New(
	"source reservee au centre : appel interdit pour l'entourage")

// Intervalle minimal entre deux appels, par source. C'est la declaration du
// budget N-03 ; la tache 7 la fait respecter.
var intervalle = map[Source]time.Duration{
	MusicBrainz:  time.Second,            // 1/s par adresse IP, la contrainte dure
	CoverArt:     time.Second,            // meme infrastructure, meme prudence
	LastFM:       200 * time.Millisecond, // ~5/s
	ListenBrainz: 200 * time.Millisecond, // meilleur-effort, repli du role 1
	Deezer:       20 * time.Millisecond,  // debit genereux
	Odesli:       time.Second,            // limite non documentee : prudence
}

// Sources dont le debit est trop contraint pour supporter l'entourage.
var centreSeulement = map[Source]bool{
	MusicBrainz: true,
	CoverArt:    true,
}

// file porte le prochain creneau libre d'une source. Le creneau est reserve
// sous verrou avant l'attente : deux goroutines ne peuvent pas obtenir le meme,
// et l'espacement tient donc aussi sous concurrence.
type file struct {
	mu       sync.Mutex
	prochain time.Time
}

type Limiteur struct {
	files   map[Source]*file
	comptes map[Source]*atomic.Int64
}

// Neuf construit un limiteur. Il y en a exactement un par processus : deux
// limiteurs se partageraient le meme quota sans le savoir. La table est
// entierement construite ici, donc jamais ecrite ensuite : sa lecture
// concurrente est sure.
func Neuf() *Limiteur {
	l := &Limiteur{
		files:   make(map[Source]*file, len(intervalle)),
		comptes: make(map[Source]*atomic.Int64, len(intervalle)),
	}
	for s := range intervalle {
		l.files[s] = &file{}
		l.comptes[s] = &atomic.Int64{}
	}
	return l
}

// Attendre bloque jusqu'a ce que l'appel soit autorise par le debit de la
// source, ou refuse immediatement si la portee est interdite.
func (l *Limiteur) Attendre(ctx context.Context, s Source, p Portee) error {
	f, connue := l.files[s]
	if !connue {
		return fmt.Errorf("source inconnue : %q", s)
	}
	if centreSeulement[s] && p == Entourage {
		return ErrPorteeInterdite
	}

	f.mu.Lock()
	maintenant := time.Now()
	creneau := f.prochain
	if creneau.Before(maintenant) {
		creneau = maintenant
	}
	f.prochain = creneau.Add(intervalle[s])
	f.mu.Unlock()

	// Un creneau reserve puis abandonne n'est pas rendu : le rendre supposerait
	// de reordonner la file, et une seconde perdue vaut mieux qu'un depassement
	// de quota qui bloque l'adresse IP du serveur pour tout le monde.
	if attente := time.Until(creneau); attente > 0 {
		minuteur := time.NewTimer(attente)
		defer minuteur.Stop()
		select {
		case <-minuteur.C:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	// Seuls les appels reellement autorises sont comptes : une portee refusee
	// ou une attente interrompue n'a produit aucun trafic.
	l.comptes[s].Add(1)
	return nil
}

// Compte rend le nombre d'appels autorises pour une source depuis la
// construction du limiteur. Une source hors nomenclature vaut 0.
func (l *Limiteur) Compte(s Source) int64 {
	if c, connue := l.comptes[s]; connue {
		return c.Load()
	}
	return 0
}
