// La couche cache : le redis PARTAGE de la fabrique — le MEME service
// qu'ardoise, ni redeclare ni configure ici. C'est le point de ce PRP.
package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// cleCache est prefixee par l'app : redis est partage entre compteur et
// ardoise (et toute future app qui declarerait needs: [redis]) — sans ce
// prefixe, deux applications ecrivant la meme cle s'ecraseraient en silence.
const cleCache = "compteur:valeur"

const ttlCache = 30 * time.Second

type Cache struct {
	rdb *redis.Client
}

func NewCache(addr string) *Cache {
	return &Cache{rdb: redis.NewClient(&redis.Options{Addr: addr})}
}

// Lire renvoie le compteur en cache, et si le cache a repondu. R3 du PRD :
// une erreur Redis est avalee et journalisee, jamais propagee — importe
// doublement ici puisque redis est partage : une panne ne doit pas non plus
// casser ardoise, ni l'inverse.
func (c *Cache) Lire(ctx context.Context) (Compteur, bool) {
	v, err := c.rdb.Get(ctx, cleCache).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("cache : lecture ignoree (%v)", err)
		}
		return Compteur{}, false
	}
	var cpt Compteur
	if err := json.Unmarshal(v, &cpt); err != nil {
		log.Printf("cache : contenu illisible ignore (%v)", err)
		return Compteur{}, false
	}
	return cpt, true
}

func (c *Cache) Ecrire(ctx context.Context, cpt Compteur) {
	v, err := json.Marshal(cpt)
	if err != nil {
		return
	}
	if err := c.rdb.Set(ctx, cleCache, v, ttlCache).Err(); err != nil {
		log.Printf("cache : ecriture ignoree (%v)", err)
	}
}

// Invalider applique R2 : une incrementation rend la lecture suivante fraiche.
func (c *Cache) Invalider(ctx context.Context) {
	if err := c.rdb.Del(ctx, cleCache).Err(); err != nil {
		log.Printf("cache : invalidation ignoree (%v)", err)
	}
}

func (c *Cache) Close() error { return c.rdb.Close() }
