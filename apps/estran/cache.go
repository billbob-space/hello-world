package main

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// dernierConnu retient la derniere reponse reussie d'un fournisseur externe et
// la ressert quand l'appel courant echoue — « degrader, jamais casser »
// (PRODUCT.md, principe 3) applique aux pannes de fournisseur plutot qu'a une
// donnee manquante.
type dernierConnu[T any] struct {
	mu      sync.Mutex
	valeur  T
	obtenuA time.Time
	present bool
	dernier error
}

// rafraichir appelle recuperer ; en cas de succes, la valeur remplace le
// dernier connu. En cas d'echec, le dernier connu est rendu tel quel avec
// l'erreur qui l'a produit — a froid (rien de connu), l'erreur seule remonte.
func (d *dernierConnu[T]) rafraichir(recuperer func() (T, error)) (T, time.Time, bool, error) {
	v, err := recuperer()

	d.mu.Lock()
	defer d.mu.Unlock()

	if err == nil {
		d.valeur = v
		d.obtenuA = time.Now()
		d.present = true
		d.dernier = nil
		return d.valeur, d.obtenuA, true, nil
	}

	d.dernier = err
	if d.present {
		return d.valeur, d.obtenuA, false, nil
	}
	var zero T
	return zero, time.Time{}, false, err
}

// plafondLieux borne le nombre de lieux distincts qu'un parLieu garde en
// memoire : sans plafond, une carte qui grandit a chaque coordonnee vue est
// une fuite lente dans une app a 128 Mo (prp/04-le-lieu-devient-une-donnee.md,
// section 4). Largement suffisant pour l'usage reel : quelques lieux
// epingles, quelques recherches.
const plafondLieux = 32

// parLieu adapte dernierConnu (degradation d'un SEUL fournisseur) a
// plusieurs lieux : un dernierConnu[T] distinct par cle, sous un plafond avec
// eviction du moins recemment servi. La cle est construite par l'appelant —
// lat/lon arrondis, plus le site pour la maree (cleLieu/cleLieuMaree,
// lieu.go) — jamais ici, pour que ce fichier reste independant du domaine.
type parLieu[T any] struct {
	mu      sync.Mutex
	parCle  map[string]*entreeParLieu[T]
	depasse bool // le depassement du plafond se journalise une seule fois, pas a chaque eviction
}

type entreeParLieu[T any] struct {
	cache        *dernierConnu[T]
	dernierAcces time.Time
}

func nouveauParLieu[T any]() *parLieu[T] {
	return &parLieu[T]{parCle: make(map[string]*entreeParLieu[T])}
}

// pour rend le dernierConnu de la cle donnee, le creant si absent. Une
// entree neuve, une fois le plafond atteint, evince d'abord la moins
// recemment servie.
func (p *parLieu[T]) pour(cle string) *dernierConnu[T] {
	p.mu.Lock()
	defer p.mu.Unlock()

	if e, ok := p.parCle[cle]; ok {
		e.dernierAcces = time.Now()
		return e.cache
	}

	if len(p.parCle) >= plafondLieux {
		p.evincerLocked()
	}

	e := &entreeParLieu[T]{cache: &dernierConnu[T]{}, dernierAcces: time.Now()}
	p.parCle[cle] = e
	return e.cache
}

// evincerLocked suppose p.mu deja pris par l'appelant (pour).
func (p *parLieu[T]) evincerLocked() {
	var cleAEvincer string
	var plusAncien time.Time
	premiere := true
	for cle, e := range p.parCle {
		if premiere || e.dernierAcces.Before(plusAncien) {
			cleAEvincer, plusAncien, premiere = cle, e.dernierAcces, false
		}
	}
	if cleAEvincer != "" {
		delete(p.parCle, cleAEvincer)
	}
	if !p.depasse {
		p.depasse = true
		log.Printf("cache par lieu : plafond de %d lieux atteint, eviction du moins recemment servi", plafondLieux)
	}
}

// cleLieu identifie un lieu par ses coordonnees, DEJA arrondies a 3
// decimales par l'appelant (main.go, parametreLatLon) : ce fichier ne
// connait pas cette regle, il ne fait que formater.
func cleLieu(lat, lon float64) string {
	return fmt.Sprintf("%.3f,%.3f", lat, lon)
}

// cleLieuMaree ajoute le site au lieu (§4 : « + le site pour la maree ») —
// deux lieux voisins qui partagent le meme site de maree resteraient sinon
// distincts sans raison, et un meme lieu dont le site resolu changerait
// (catalogue rafraichi) doit repartir d'un cache neuf plutot que de resservir
// une hauteur d'eau d'un autre site sous son nom.
func cleLieuMaree(lat, lon float64, site string) string {
	return cleLieu(lat, lon) + "," + site
}
