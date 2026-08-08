package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var ErrProfilAbsent = errors.New("profil absent")

func identifiantFichier(email string) string {
	h := sha256.Sum256([]byte(email))
	return fmt.Sprintf("%x", h)[:16]
}

func cheminProfil(racine, email string) string {
	return filepath.Join(racine, "profil-"+identifiantFichier(email)+".json")
}

func LireProfil(racine, email string) (Profil, error) {
	brut, err := os.ReadFile(cheminProfil(racine, email))
	if errors.Is(err, os.ErrNotExist) {
		return Profil{}, ErrProfilAbsent
	}
	if err != nil {
		return Profil{}, err
	}
	var p Profil
	if err := json.Unmarshal(brut, &p); err != nil {
		return Profil{}, fmt.Errorf("profil corrompu: %w", err)
	}
	return p, nil
}

// EcrireProfil ecrit dans un fichier temporaire puis renomme : jamais une
// ecriture en place, qui laisserait un fichier tronque lisible par la
// requete suivante en cas d'interruption (ossature §7).
func EcrireProfil(racine, email string, p Profil) error {
	if err := os.MkdirAll(racine, 0o700); err != nil {
		return err
	}
	brut, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	dest := cheminProfil(racine, email)
	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, brut, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}
