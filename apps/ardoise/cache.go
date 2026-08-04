// La couche cache : le redis PARTAGE de la fabrique (shared_services de
// fabrique.yml), joignable depuis n'importe quelle app sous le nom « redis ».
package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// cleCache est prefixee par l'app : le service est partage, et deux
// applications qui ecriraient « lignes » s'ecraseraient mutuellement en
// silence.
const cleCache = "ardoise:lignes"

const ttlCache = 30 * time.Second

type Cache struct {
	rdb *redis.Client
}

func NewCache(addr string) *Cache {
	return &Cache{rdb: redis.NewClient(&redis.Options{Addr: addr})}
}

// Lire renvoie les lignes en cache, et si le cache a repondu. R5 du PRD : une
// erreur Redis est avalee et journalisee, jamais propagee — le cache est une
// optimisation, pas une dependance, et une lecture qui echoue se comporte
// exactement comme un cache absent.
func (c *Cache) Lire(ctx context.Context) ([]Ligne, bool) {
	v, err := c.rdb.Get(ctx, cleCache).Bytes()
	if err != nil {
		if err != redis.Nil {
			log.Printf("cache : lecture ignoree (%v)", err)
		}
		return nil, false
	}
	var lignes []Ligne
	if err := json.Unmarshal(v, &lignes); err != nil {
		log.Printf("cache : contenu illisible ignore (%v)", err)
		return nil, false
	}
	return lignes, true
}

func (c *Cache) Ecrire(ctx context.Context, lignes []Ligne) {
	v, err := json.Marshal(lignes)
	if err != nil {
		return
	}
	if err := c.rdb.Set(ctx, cleCache, v, ttlCache).Err(); err != nil {
		log.Printf("cache : ecriture ignoree (%v)", err)
	}
}

// Invalider applique R4 : une ecriture rend la lecture suivante fraiche.
func (c *Cache) Invalider(ctx context.Context) {
	if err := c.rdb.Del(ctx, cleCache).Err(); err != nil {
		log.Printf("cache : invalidation ignoree (%v)", err)
	}
}

func (c *Cache) Close() error { return c.rdb.Close() }
