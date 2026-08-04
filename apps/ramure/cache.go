// Le cache mutualise, la mutualisation des requetes identiques, et le debit.
//
// Ces trois mecanismes repondent a un seul risque, le plus grave du produit
// apres la panne de la source de proximite : le depassement de quota (§14).
// Tous les utilisateurs sortent par l'adresse IP du serveur, et le geste
// central — la promotion — est le plus couteux. Sans ces trois garde-fous,
// le produit se casse a la premiere heure de pointe, et se casse visiblement :
// pochettes manquantes, branches absentes.
//
// Le cache est volontairement en memoire du processus : sa donnee est
// jetable par construction, un volume nomme n'y ajouterait rien. La fabrique
// offre desormais des volumes nommes (voir apps/ardoise, ../../CLAUDE.md) —
// ce n'est plus une contrainte d'infrastructure ici, c'est un choix, et le
// README precise que la reserve equivalente sur la COLLECTION, elle, est a
// moitie levee : l'infra est prete, le travail applicatif ne l'est pas
// encore. Un redemarrage vide le cache : c'est une perte de performance,
// jamais une perte de correction.
package main

import (
	"context"
	"sync"
	"time"
)

// entree est une valeur en cache avec sa date de peremption.
type entree struct {
	valeur any
	expire time.Time
	poserA time.Time
}

// Cache est un cache a duree de vie, partage par tous les utilisateurs
// (N-04). Un cache par navigateur ne protegerait de rien : le plafond de
// debit est commun a tout le serveur, donc la mutualisation doit l'etre aussi.
//
// Il porte egalement la mutualisation des requetes identiques simultanees
// (N-07) : quand dix utilisateurs plantent le meme artiste en meme temps, une
// seule requete part vers la source et les dix attendent sa reponse.
type Cache struct {
	mu      sync.Mutex
	entrees map[string]entree
	envol   map[string]*vol // les chargements en cours

	// maintenant est injectable pour que les tests puissent faire vieillir le
	// cache sans dormir. La §13 demande une logique deterministe isolee.
	maintenant func() time.Time

	// Compteurs de diagnostic, lus par /api/diagnostic.
	touches, manques int64
}

// vol est un chargement en cours, partage par tous les appelants qui
// demandent la meme cle pendant qu'il dure.
type vol struct {
	fait   chan struct{}
	valeur any
	err    error
}

func NouveauCache() *Cache {
	return &Cache{
		entrees:    make(map[string]entree),
		envol:      make(map[string]*vol),
		maintenant: time.Now,
	}
}

// Charge retourne la valeur en cache pour cle, ou appelle produire pour
// l'obtenir.
//
// Trois proprietes, et chacune repond a une exigence nommee :
//
//   - Une erreur n'est JAMAIS mise en cache (N-05, et §09 "aucun etat d'echec
//     n'est conserve"). Memoriser un echec condamne durablement un artiste a
//     un affichage degrade, meme une fois la source retablie — et l'utilisateur
//     n'a aucun moyen de comprendre pourquoi, ni de s'en sortir.
//   - Un resultat vide n'est pas mis en cache non plus, pour la meme raison.
//     "Cet artiste n'a pas de voisins" est presque toujours une panne
//     deguisee ; le memoriser la rend permanente.
//   - Les appels concurrents sur la meme cle sont mutualises (N-07).
func (c *Cache) Charge(ctx context.Context, cle string, ttl time.Duration, produire func(context.Context) (any, error)) (any, error) {
	c.mu.Lock()

	if e, ok := c.entrees[cle]; ok && c.maintenant().Before(e.expire) {
		c.touches++
		c.mu.Unlock()
		return e.valeur, nil
	}
	c.manques++

	// Un chargement est deja en vol pour cette cle : on s'y accroche plutot
	// que d'en lancer un second.
	if v, ok := c.envol[cle]; ok {
		c.mu.Unlock()
		select {
		case <-v.fait:
			return v.valeur, v.err
		case <-ctx.Done():
			// L'appelant abandonne — mais le vol continue pour les autres.
			return nil, ctx.Err()
		}
	}

	v := &vol{fait: make(chan struct{})}
	c.envol[cle] = v
	c.mu.Unlock()

	// Le chargement tourne sur un contexte detache de celui de l'appelant :
	// si le premier arrivant se deconnecte, les suivants ne doivent pas voir
	// leur requete annulee avec lui. La borne de temps reste, elle, appliquee.
	ctxVol, annule := context.WithTimeout(context.WithoutCancel(ctx), 12*time.Second)
	defer annule()

	v.valeur, v.err = produire(ctxVol)

	c.mu.Lock()
	delete(c.envol, cle)
	if v.err == nil && !estVide(v.valeur) {
		c.entrees[cle] = entree{valeur: v.valeur, expire: c.maintenant().Add(ttl), poserA: c.maintenant()}
	}
	c.mu.Unlock()

	close(v.fait)
	return v.valeur, v.err
}

// estVide reconnait les resultats qu'il ne faut pas memoriser. Une liste vide
// de voisins est presque toujours le symptome d'une source muette plutot
// qu'un fait sur l'artiste ; la mettre en cache fige la panne.
func estVide(v any) bool {
	switch t := v.(type) {
	case nil:
		return true
	case []Artiste:
		return len(t) == 0
	case []Album:
		return len(t) == 0
	case []Voisin:
		return len(t) == 0
	}
	return false
}

// Purge retire les entrees perimees. Appelee periodiquement par main : sans
// elle, un cache en memoire d'un processus qui vit des semaines finit par
// garder toutes les cles jamais demandees.
func (c *Cache) Purge() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	n := 0
	maintenant := c.maintenant()
	for cle, e := range c.entrees {
		if maintenant.After(e.expire) {
			delete(c.entrees, cle)
			n++
		}
	}
	return n
}

// Etat rend les compteurs pour /api/diagnostic. Le taux de service par le
// cache est ce qui permet de voir venir un depassement de quota avant qu'il
// n'arrive (§14).
func (c *Cache) Etat() map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()

	total := c.touches + c.manques
	var taux float64
	if total > 0 {
		taux = float64(c.touches) / float64(total)
	}
	return map[string]any{
		"entrees":   len(c.entrees),
		"envol":     len(c.envol),
		"touches":   c.touches,
		"manques":   c.manques,
		"tauxServi": taux,
	}
}

// Debit est un seau a jetons : il lisse les rafales vers une source externe.
//
// Deezer tolere une cinquantaine d'appels par tranche de cinq secondes et par
// adresse IP. Une promotion qui charge les heritiers de dix branches d'un coup
// passe juste sous ce plafond ; deux utilisateurs simultanes le franchissent.
// Le seau transforme ce franchissement en attente de quelques dizaines de
// millisecondes, ce que personne ne voit, au lieu d'une rafale de 429, que
// tout le monde voit.
type Debit struct {
	mu         sync.Mutex
	jetons     float64
	max        float64
	parSec     float64
	dernier    time.Time
	maintenant func() time.Time
}

func NouveauDebit(parSeconde, rafale float64) *Debit {
	m := time.Now
	return &Debit{
		jetons:     rafale,
		max:        rafale,
		parSec:     parSeconde,
		dernier:    m(),
		maintenant: m,
	}
}

// Attends bloque jusqu'a ce qu'un jeton soit disponible, ou que le contexte
// soit annule.
func (d *Debit) Attends(ctx context.Context) error {
	for {
		d.mu.Lock()
		maintenant := d.maintenant()
		d.jetons += maintenant.Sub(d.dernier).Seconds() * d.parSec
		if d.jetons > d.max {
			d.jetons = d.max
		}
		d.dernier = maintenant

		if d.jetons >= 1 {
			d.jetons--
			d.mu.Unlock()
			return nil
		}

		// Temps qu'il faut pour reconstituer un jeton entier.
		attente := time.Duration((1 - d.jetons) / d.parSec * float64(time.Second))
		d.mu.Unlock()

		if attente > 2*time.Second {
			attente = 2 * time.Second
		}
		select {
		case <-time.After(attente):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
