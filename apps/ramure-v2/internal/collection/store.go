// apps/ramure-v2/internal/collection/store.go
//
// La collection d'un utilisateur : les artistes qu'il a gardes (F-28),
// avec la lignee complete qui y a mene et la date (F-29). Cloisonnee par
// utilisateur (N-08) — toute methode prend l'identite en premier
// argument, et AUCUNE implementation ne doit jamais laisser une entree
// d'un utilisateur visible par un autre.
package collection

import (
	"context"
	"sync"
	"time"
)

// Entree est un artiste garde.
type Entree struct {
	Nom    string    `json:"nom"`
	MBID   string    `json:"mbid"`
	Lignee []string  `json:"lignee,omitempty"` // contexte de decouverte (F-29)
	Ajoute time.Time `json:"ajoute"`
}

// CollectionStore cloisonne par utilisateur. Ajouter est idempotent sur
// le MBID : ajouter deux fois le meme artiste remplace l'entree plutot que
// de la dupliquer.
type CollectionStore interface {
	Lister(ctx context.Context, utilisateur string) ([]Entree, error)
	Ajouter(ctx context.Context, utilisateur string, e Entree) error
	Retirer(ctx context.Context, utilisateur, mbid string) error
}

// memoryStore est le repli de developpement HORS CONTENEUR (go run . sans
// volume) : volatile, perdu a chaque redemarrage du processus. En
// conteneur, donc en production, RAMURE_DATA_DIR est toujours definie par
// le Dockerfile et FileStore est toujours choisi a la place (voir
// ChoisirStore).
type memoryStore struct {
	mu   sync.Mutex
	data map[string][]Entree
}

// NouveauMemoryStore construit un CollectionStore volatile, en memoire.
func NouveauMemoryStore() CollectionStore {
	return &memoryStore{data: make(map[string][]Entree)}
}

func (m *memoryStore) Lister(_ context.Context, utilisateur string) ([]Entree, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	src := m.data[utilisateur]
	out := make([]Entree, len(src))
	copy(out, src)
	return out, nil
}

func (m *memoryStore) Ajouter(_ context.Context, utilisateur string, e Entree) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, existante := range m.data[utilisateur] {
		if existante.MBID == e.MBID {
			m.data[utilisateur][i] = e
			return nil
		}
	}
	m.data[utilisateur] = append(m.data[utilisateur], e)
	return nil
}

func (m *memoryStore) Retirer(_ context.Context, utilisateur, mbid string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	src := m.data[utilisateur]
	out := make([]Entree, 0, len(src))
	for _, e := range src {
		if e.MBID != mbid {
			out = append(out, e)
		}
	}
	m.data[utilisateur] = out
	return nil
}
