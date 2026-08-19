// apps/ramure-v2/internal/equite/garde.go
//
// La part equitable du quota entre visiteurs (N-14, critique). Le palier
// d'exposition de l'app est google : n'importe quel compte Google entre,
// ce n'est PAS une liste blanche du serveur. La source la plus contrainte
// (MusicBrainz, budget.Limiteur) tolere un appel par seconde pour TOUS les
// visiteurs confondus ; sans ce garde, un visiteur seul qui enchaine les
// promotions plus vite que le limiteur ne les espace mangerait le quota
// commun.
//
// Garde impose un seul chargement de centre EN VOL par identite : deux
// identites DIFFERENTES ne s'attendent jamais l'une l'autre, seule la MEME
// identite est serialisee. Aucune requete n'echoue jamais ici — ce n'est
// pas une liste blanche qui refuse, c'est un tour de role : la seconde
// requete de la meme identite ATTEND que la premiere se termine, meme si
// elle echoue (defer libere systematiquement), avant d'etre servie a son
// tour.
package equite

import (
	"net/http"
	"sync"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/identite"
)

// verrouParIdentite est le seul etat de ce paquet : un processus ramure-v2
// ne sert qu'une seule stack, une seule fois — un etat de paquet, plutot
// qu'une structure a construire, correspond donc a l'usage reel et
// permet a Garde() de garder la signature simple attendue par les
// appelants (main.go, les tests). Chaque entree est un *sync.Mutex, de
// cout negligeable : la table grandit avec le nombre d'identites
// DISTINCTES vues depuis le demarrage du processus, jamais reduite —
// acceptable au volume vise par la serie (§13), a revisiter si le nombre
// de comptes Google distincts devenait tres grand.
var (
	mu      sync.Mutex
	verrous = make(map[string]*sync.Mutex)
)

func verrouPour(cle string) *sync.Mutex {
	mu.Lock()
	defer mu.Unlock()
	v, ok := verrous[cle]
	if !ok {
		v = &sync.Mutex{}
		verrous[cle] = v
	}
	return v
}

// Garde enveloppe un gestionnaire (destine a GET /api/centre) d'un tour de
// role par identite. Une requete sans identite (X-Forwarded-User absent —
// ne devrait pas arriver derriere Traefik en palier google, mais un appel
// de test ou un maillon d'infrastructure defaillant y reste possible) est
// serialisee dans un compartiment "anonyme" commun, jamais confondue avec
// une identite reelle.
func Garde(suivant http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cle, ok := identite.DepuisRequete(r)
		if !ok {
			cle = "\x00anonyme"
		}
		v := verrouPour(cle)
		v.Lock()
		defer v.Unlock()
		suivant.ServeHTTP(w, r)
	})
}
