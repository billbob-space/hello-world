package main

import (
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
