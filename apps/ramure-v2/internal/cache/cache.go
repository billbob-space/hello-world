// Cache mutualise cote serveur, partage entre tous les utilisateurs (N-04).
//
// Un cache par navigateur ne protegerait de rien : le plafond de debit des
// sources externes est commun a tous les utilisateurs, puisqu'ils sortent tous
// par l'adresse IP du serveur. C'est donc ici, et nulle part ailleurs, que se
// gagne le taux de service qui rend le budget d'appels tenable.
//
// Le cache ne connait pas la semantique des octets qu'il transporte : la duree
// de vie adaptee a la volatilite de la donnee (N-04) est choisie par l'appelant,
// argument par argument.
package cache

import (
	"sync"
	"sync/atomic"
	"time"
)

type entree struct {
	valeur []byte
	expire time.Time
}

// vol represente un chargement en cours pour une cle donnee. Les appels
// concurrents portant la meme cle s'y raccrochent au lieu d'emettre une seconde
// requete identique (N-07).
type vol struct {
	attente sync.WaitGroup
	valeur  []byte
	err     error
}

// Cache est sur de l'emploi concurrent. Il ne doit jamais etre copie : on le
// manipule par pointeur, tel que Neuf le rend.
//
// Les compteurs du taux de service (N-04) alimentent la revision du seuil de
// bascule N-13 : le chiffre de 5 promotions par seconde repose sur une
// hypothese de 80 % de service par le cache, qui doit etre mesuree et non
// supposee. Ils sont atomiques et non proteges par mu : leur exactitude
// n'exige aucune coherence avec l'etat de la table.
type Cache struct {
	mu      sync.Mutex
	entrees map[string]entree
	encours map[string]*vol
	horloge func() time.Time
	succes  atomic.Int64
	total   atomic.Int64
}

// Neuf construit un cache vide. L'horloge est injectee pour que l'expiration
// soit testable sans attendre reellement ; nil vaut time.Now.
func Neuf(horloge func() time.Time) *Cache {
	if horloge == nil {
		horloge = time.Now
	}
	return &Cache{
		entrees: make(map[string]entree),
		encours: make(map[string]*vol),
		horloge: horloge,
	}
}

// Obtenir rend la valeur associee a cle, en appelant charger si l'entree est
// absente ou perimee. Le verrou n'est jamais tenu pendant charger : un appel
// externe lent ne doit pas figer les autres cles.
//
// Les appels concurrents portant la meme cle n'invoquent charger qu'une seule
// fois (N-07) et recoivent tous le meme couple (valeur, erreur).
func (c *Cache) Obtenir(cle string, ttl time.Duration,
	charger func() ([]byte, error)) ([]byte, error) {

	c.total.Add(1)

	c.mu.Lock()
	if e, presente := c.entrees[cle]; presente && c.horloge().Before(e.expire) {
		c.mu.Unlock()
		c.succes.Add(1)
		return e.valeur, nil
	}
	if v, enVol := c.encours[cle]; enVol {
		c.mu.Unlock()
		v.attente.Wait()
		// Un attendant a ete servi sans appel externe : c'est un service rendu
		// au meme titre qu'une entree fraiche, et c'est meme la ou la
		// protection joue le plus fort (N-04, N-07). Un vol en erreur, lui,
		// n'a servi personne.
		if v.err == nil {
			c.succes.Add(1)
		}
		return v.valeur, v.err
	}
	v := &vol{}
	v.attente.Add(1)
	c.encours[cle] = v
	c.mu.Unlock()

	// Le verrou est relache pendant le chargement : une source lente ne doit
	// bloquer ni les autres cles, ni la lecture des entrees deja fraiches.
	v.valeur, v.err = charger()

	c.mu.Lock()
	delete(c.encours, cle)
	// L'ecriture n'a lieu qu'en cas de succes (N-05, §09). Une erreur reseau,
	// un depassement de quota ou un resultat vide signale par une erreur sont
	// des etats transitoires : les memoriser condamnerait l'artiste a un
	// affichage degrade pour toute la duree de vie du processus, meme une fois
	// la source retablie. Les octets accompagnant une erreur sont ignores.
	if v.err == nil {
		c.entrees[cle] = entree{valeur: v.valeur, expire: c.horloge().Add(ttl)}
	}
	c.mu.Unlock()

	// Le WaitGroup publie valeur et err aux attendants : sa liberation etablit
	// la relation d'anteriorite qui rend leur lecture sure.
	v.attente.Done()
	return v.valeur, v.err
}

// TauxDeService rend le nombre de requetes servies sans appel externe et le
// nombre total de requetes, depuis le demarrage du processus.
func (c *Cache) TauxDeService() (succes, total int64) {
	return c.succes.Load(), c.total.Load()
}
