// apps/ramure-v2/internal/collection/reglages.go
//
// Le reglage qui suit son proprietaire d'un appareil a l'autre (F-25) : le
// service d'ecoute choisi. Meme regime nominal/repli que la collection
// (FileStore des que RAMURE_DATA_DIR est definie, MemoryStore sinon), et
// meme hachage de l'identite dans le nom de fichier.
package collection

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// Reglages porte les preferences persistantes d'un utilisateur. Le seul
// reglage du MVP est le service d'ecoute (F-25).
type Reglages struct {
	ServiceEcoute string `json:"serviceEcoute"`
}

// ServiceParDefaut est rendu quand rien n'a ete enregistre, ou que la
// valeur enregistree ne correspond plus a un service connu
// (TestReglageInconnuRetombeSurLeDefaut) — identique a la valeur par
// defaut cote client (web/src/fiche.ts, SERVICE_PAR_DEFAUT).
const ServiceParDefaut = "deezer"

var servicesConnus = map[string]bool{
	"deezer": true, "spotify": true, "apple": true, "youtube": true, "tidal": true,
}

// ReglagesStore cloisonne par utilisateur, au meme titre que
// CollectionStore.
type ReglagesStore interface {
	Lire(ctx context.Context, utilisateur string) (Reglages, error)
	Ecrire(ctx context.Context, utilisateur string, r Reglages) error
}

type reglagesMemoire struct {
	mu   sync.Mutex
	data map[string]Reglages
}

// NouveauReglagesMemoire construit un ReglagesStore volatile, en memoire.
func NouveauReglagesMemoire() ReglagesStore {
	return &reglagesMemoire{data: make(map[string]Reglages)}
}

func (m *reglagesMemoire) Lire(_ context.Context, utilisateur string) (Reglages, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.data[utilisateur]
	if !ok || !servicesConnus[r.ServiceEcoute] {
		return Reglages{ServiceEcoute: ServiceParDefaut}, nil
	}
	return r, nil
}

func (m *reglagesMemoire) Ecrire(_ context.Context, utilisateur string, r Reglages) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[utilisateur] = r
	return nil
}

type reglagesFichier struct {
	repertoire string
	verrous    sync.Map
}

// NouveauReglagesFichier cree (si besoin) le repertoire donne et construit
// un ReglagesStore qui y persiste un fichier par utilisateur.
func NouveauReglagesFichier(repertoire string) (ReglagesStore, error) {
	if err := os.MkdirAll(repertoire, 0o700); err != nil {
		return nil, fmt.Errorf("reglages: repertoire %q : %w", repertoire, err)
	}
	return &reglagesFichier{repertoire: repertoire}, nil
}

func (f *reglagesFichier) verrou(hash string) *sync.Mutex {
	v, _ := f.verrous.LoadOrStore(hash, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func (f *reglagesFichier) chemin(utilisateur string) string {
	return filepath.Join(f.repertoire, hacherUtilisateur(utilisateur)+".json")
}

func (f *reglagesFichier) Lire(_ context.Context, utilisateur string) (Reglages, error) {
	hash := hacherUtilisateur(utilisateur)
	v := f.verrou(hash)
	v.Lock()
	defer v.Unlock()

	octets, err := os.ReadFile(f.chemin(utilisateur))
	if errors.Is(err, os.ErrNotExist) || len(octets) == 0 {
		return Reglages{ServiceEcoute: ServiceParDefaut}, nil
	}
	if err != nil {
		return Reglages{}, err
	}
	var r Reglages
	if err := json.Unmarshal(octets, &r); err != nil || !servicesConnus[r.ServiceEcoute] {
		return Reglages{ServiceEcoute: ServiceParDefaut}, nil
	}
	return r, nil
}

func (f *reglagesFichier) Ecrire(_ context.Context, utilisateur string, r Reglages) error {
	hash := hacherUtilisateur(utilisateur)
	v := f.verrou(hash)
	v.Lock()
	defer v.Unlock()

	octets, err := json.Marshal(r)
	if err != nil {
		return err
	}
	chemin := f.chemin(utilisateur)
	tmp := chemin + ".tmp"
	if err := os.WriteFile(tmp, octets, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, chemin)
}

// ChoisirReglagesStore suit exactement la regle de ChoisirStore
// (collection) : FileStore des que repertoire est non vide, MemoryStore
// sinon, avec la meme annonce explicite sur `sortie`.
func ChoisirReglagesStore(repertoire string, sortie io.Writer) (ReglagesStore, error) {
	if repertoire == "" {
		fmt.Fprintln(sortie, "ramure-v2 : RAMURE_DATA_DIR absente, reglages en memoire (volatile, developpement uniquement)")
		return NouveauReglagesMemoire(), nil
	}
	return NouveauReglagesFichier(repertoire)
}
