// La collection — les artistes gardes, avec leur contexte de decouverte.
//
// Le point non negociable de ce fichier est l'identite. La N-08 :
//
//	"L'identite qui partitionne les donnees conservees est etablie cote
//	 serveur et non declaree par le client."
//
// Et le contrat de la fabrique (CLAUDE.md) designe la seule source admissible :
// l'en-tete X-Forwarded-User, pose par Traefik apres l'authentification Google,
// "et jamais un identifiant fourni par le client". Aucune fonction de ce
// fichier n'accepte donc un identifiant d'utilisateur en parametre depuis le
// corps d'une requete : il vient toujours de l'en-tete, lu par une seule
// fonction, utilisateurDe.
//
// PERSISTANCE — a lire avant de deployer. Le stockage est en memoire du
// processus. La fabrique n'offre ni base de donnees ni volume persistant
// (README de la fabrique : "Ni base de donnees, ni cache, ni volume
// persistant"), et le contrat impose d'ecrire ce besoin dans le README plutot
// que de le provisionner soi-meme. C'est fait : apps/ramure/README.md le
// declare. En attendant, un redemarrage du conteneur vide les collections
// serveur — d'ou le miroir local du client (F-33), qui les reconstitue a la
// reconnexion et rend cette perte invisible a l'utilisateur.
package main

import (
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// Garde est un artiste conserve par un utilisateur, avec le chemin qui y a
// mene.
//
// La lignee n'est pas un ornement : la F-29 et la F-30 en font le coeur de la
// fonction. "La collection montre le chemin parcouru jusqu'a chaque artiste,
// pas seulement le nom" — parce qu'un nom seul, retrouve trois semaines plus
// tard, ne dit plus rien, alors que "trouve depuis Portishead, via Massive
// Attack" rappelle instantanement pourquoi il etait interessant.
type Garde struct {
	Artiste
	// Lignee est la suite des noms de centres traversés jusqu'a cet artiste,
	// de la graine au centre depuis lequel il a ete garde.
	Lignee []string `json:"lignee,omitempty"`
	// AjouteLe date la decouverte. Il sert au tri, et surtout a la
	// reconciliation du miroir local (F-33) : en cas de conflit, l'entree la
	// plus ancienne gagne, ce qui preserve la date de decouverte reelle.
	AjouteLe time.Time `json:"ajouteLe"`
}

// Collection est le magasin des gardes, partitionne par utilisateur.
type Collection struct {
	mu  sync.RWMutex
	par map[string][]Garde

	maintenant func() time.Time
}

func NouvelleCollection() *Collection {
	return &Collection{par: make(map[string][]Garde), maintenant: time.Now}
}

// utilisateurDe extrait l'identite de la requete. C'est le SEUL point du
// programme qui decide de qui parle.
//
// Sans en-tete — en developpement local, ou si Traefik est mal configure —
// l'identite est vide et l'appelant doit traiter la collection comme purement
// locale au navigateur. On ne fabrique surtout pas d'identite de repli
// partagee : elle mettrait toutes les collections dans le meme sac, ce qui est
// exactement la fuite que la N-08 interdit.
func utilisateurDe(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-Forwarded-User"))
}

// Liste rend la collection d'un utilisateur, la plus recente d'abord.
func (c *Collection) Liste(utilisateur string) []Garde {
	if utilisateur == "" {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()

	gardes := make([]Garde, len(c.par[utilisateur]))
	copy(gardes, c.par[utilisateur])
	sort.SliceStable(gardes, func(i, j int) bool {
		return gardes[i].AjouteLe.After(gardes[j].AjouteLe)
	})
	return gardes
}

// Ajoute garde un artiste. L'operation est idempotente : garder deux fois le
// meme artiste ne cree pas de doublon et ne recrit pas la date de decouverte
// d'origine — c'est ce qui rend la reconciliation de la F-33 sure, quel que
// soit le nombre de fois qu'elle rejoue.
func (c *Collection) Ajoute(utilisateur string, g Garde) []Garde {
	if utilisateur == "" || g.ID == "" {
		return c.Liste(utilisateur)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if g.AjouteLe.IsZero() {
		g.AjouteLe = c.maintenant()
	}

	for i, existant := range c.par[utilisateur] {
		if existant.ID != g.ID {
			continue
		}
		// Deja garde : on complete ce qui manque sans ecraser l'anteriorite.
		if len(existant.Lignee) == 0 {
			c.par[utilisateur][i].Lignee = g.Lignee
		}
		if existant.Image == "" {
			c.par[utilisateur][i].Image = g.Image
		}
		if g.AjouteLe.Before(existant.AjouteLe) {
			c.par[utilisateur][i].AjouteLe = g.AjouteLe
		}
		return c.listeVerrouillee(utilisateur)
	}

	c.par[utilisateur] = append(c.par[utilisateur], g)
	return c.listeVerrouillee(utilisateur)
}

// Retire enleve un artiste de la collection.
func (c *Collection) Retire(utilisateur, id string) []Garde {
	if utilisateur == "" {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	gardes := c.par[utilisateur]
	for i, g := range gardes {
		if g.ID == id {
			c.par[utilisateur] = append(gardes[:i:i], gardes[i+1:]...)
			break
		}
	}
	return c.listeVerrouillee(utilisateur)
}

// Reconcilie fusionne un lot d'entrees locales dans la collection serveur
// (F-33 : "se reconcilie a la reconnexion, sans perte ni doublon").
//
// La fusion est une union, jamais un remplacement. Le client peut avoir garde
// des artistes hors ligne que le serveur ignore ; le serveur peut en avoir que
// ce navigateur-la n'a jamais vus, parce qu'ils viennent d'un autre appareil
// (F-32). Un remplacement dans un sens ou dans l'autre perdrait la moitie de
// la collection, et l'utilisateur n'aurait aucun moyen de savoir laquelle.
func (c *Collection) Reconcilie(utilisateur string, locales []Garde) []Garde {
	if utilisateur == "" {
		return nil
	}
	for _, g := range locales {
		c.Ajoute(utilisateur, g)
	}
	return c.Liste(utilisateur)
}

// listeVerrouillee est Liste, appelee avec le verrou deja tenu.
func (c *Collection) listeVerrouillee(utilisateur string) []Garde {
	gardes := make([]Garde, len(c.par[utilisateur]))
	copy(gardes, c.par[utilisateur])
	sort.SliceStable(gardes, func(i, j int) bool {
		return gardes[i].AjouteLe.After(gardes[j].AjouteLe)
	})
	return gardes
}
