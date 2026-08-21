// apps/ramure-v2/internal/collection/file.go
//
// FileStore est le regime NOMINAL : choisi des que RAMURE_DATA_DIR est
// definie, ce que le Dockerfile garantit en conteneur — donc toujours en
// production (voir ChoisirStore). Un fichier JSON par utilisateur, nomme
// d'apres un HACHAGE de son identite : jamais l'adresse electronique en
// clair, qui est une donnee personnelle et se retrouverait sinon dans les
// noms de fichiers d'un volume sauvegarde.
package collection

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// fileStore verrouille par UTILISATEUR (via son hachage), pas globalement :
// deux utilisateurs distincts s'ecrivent sans jamais s'attendre. Chaque
// ecriture est ATOMIQUE (fichier temporaire puis rename) : un redemarrage
// au mauvais moment ne laisse donc jamais un fichier tronque, condition qui
// ferait disparaitre la collection pour de bon.
type fileStore struct {
	repertoire string
	verrous    sync.Map // hash(utilisateur) -> *sync.Mutex
}

// NouveauFileStore cree (si besoin) le repertoire donne et construit un
// CollectionStore qui y persiste un fichier par utilisateur.
func NouveauFileStore(repertoire string) (CollectionStore, error) {
	if err := os.MkdirAll(repertoire, 0o700); err != nil {
		return nil, fmt.Errorf("collection: repertoire %q : %w", repertoire, err)
	}
	return &fileStore{repertoire: repertoire}, nil
}

// hacherUtilisateur derive un nom de fichier stable et non reversible de
// l'identite : le fichier ne porte jamais l'adresse electronique en clair.
func hacherUtilisateur(utilisateur string) string {
	somme := sha256.Sum256([]byte(utilisateur))
	return hex.EncodeToString(somme[:])
}

func (f *fileStore) verrou(hash string) *sync.Mutex {
	v, _ := f.verrous.LoadOrStore(hash, &sync.Mutex{})
	return v.(*sync.Mutex)
}

func (f *fileStore) chemin(utilisateur string) string {
	return filepath.Join(f.repertoire, hacherUtilisateur(utilisateur)+".json")
}

func lireEntrees(chemin string) ([]Entree, error) {
	octets, err := os.ReadFile(chemin) // #nosec G304 -- chemin est toujours repertoire+hacherUtilisateur(utilisateur)+".json" : un hex sha256 (64 caracteres [0-9a-f]) ne peut jamais porter "/" ni ".." ; le nom d'utilisateur brut n'est jamais joint au chemin
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(octets) == 0 {
		return nil, nil
	}
	var entrees []Entree
	if err := json.Unmarshal(octets, &entrees); err != nil {
		return nil, err
	}
	return entrees, nil
}

// ecrireEntrees ecrit ATOMIQUEMENT : fichier temporaire puis rename, sur
// le MEME systeme de fichiers (le volume nomme), donc un rename POSIX
// veritablement atomique.
func ecrireEntrees(chemin string, entrees []Entree) error {
	octets, err := json.Marshal(entrees)
	if err != nil {
		return err
	}
	tmp := chemin + ".tmp"
	if err := os.WriteFile(tmp, octets, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, chemin)
}

func (f *fileStore) Lister(_ context.Context, utilisateur string) ([]Entree, error) {
	hash := hacherUtilisateur(utilisateur)
	v := f.verrou(hash)
	v.Lock()
	defer v.Unlock()
	return lireEntrees(f.chemin(utilisateur))
}

func (f *fileStore) Ajouter(_ context.Context, utilisateur string, e Entree) error {
	hash := hacherUtilisateur(utilisateur)
	v := f.verrou(hash)
	v.Lock()
	defer v.Unlock()

	chemin := f.chemin(utilisateur)
	entrees, err := lireEntrees(chemin)
	if err != nil {
		return err
	}
	remplacee := false
	for i, existante := range entrees {
		if existante.MBID == e.MBID {
			entrees[i] = e
			remplacee = true
			break
		}
	}
	if !remplacee {
		entrees = append(entrees, e)
	}
	return ecrireEntrees(chemin, entrees)
}

func (f *fileStore) Retirer(_ context.Context, utilisateur, mbid string) error {
	hash := hacherUtilisateur(utilisateur)
	v := f.verrou(hash)
	v.Lock()
	defer v.Unlock()

	chemin := f.chemin(utilisateur)
	entrees, err := lireEntrees(chemin)
	if err != nil {
		return err
	}
	out := make([]Entree, 0, len(entrees))
	for _, e := range entrees {
		if e.MBID != mbid {
			out = append(out, e)
		}
	}
	return ecrireEntrees(chemin, out)
}

// ChoisirStore decide entre FileStore (regime nominal, des que repertoire
// est non vide) et MemoryStore (repli de developpement hors conteneur,
// volatile) — la meme regle que suit ChoisirReglagesStore. Le repli est
// ANNONCE explicitement sur `sortie` : sans cet avertissement, une
// collection qui se vide a chaque redemarrage ne se distingue en rien
// d'une collection qui persiste, jusqu'a ce que quelqu'un la perde pour de
// bon.
func ChoisirStore(repertoire string, sortie io.Writer) (CollectionStore, error) {
	if repertoire == "" {
		fmt.Fprintln(sortie, "ramure-v2 : RAMURE_DATA_DIR absente, collection en memoire (volatile, developpement uniquement)")
		return NouveauMemoryStore(), nil
	}
	return NouveauFileStore(repertoire)
}
