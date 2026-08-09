package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var ErrProfilAbsent = errors.New("profil absent")

func identifiantFichier(email string) string {
	h := sha256.Sum256([]byte(email))
	return fmt.Sprintf("%x", h)[:16]
}

func cheminProfil(racine, email string) string {
	return cheminProfilID(racine, identifiantFichier(email))
}

func LireProfil(racine, email string) (Profil, error) {
	return LireProfilParID(racine, identifiantFichier(email))
}

// EcrireProfil ecrit dans un fichier temporaire puis renomme : jamais une
// ecriture en place, qui laisserait un fichier tronque lisible par la
// requete suivante en cas d'interruption (ossature §7).
func EcrireProfil(racine, email string, p Profil) error {
	return EcrireProfilParID(racine, identifiantFichier(email), p)
}

func cheminProfilID(racine, id string) string {
	return filepath.Join(racine, "profil-"+id+".json")
}

// LireProfilParID et EcrireProfilParID sont les pendants de LireProfil et
// EcrireProfil qui travaillent directement sur l'identifiant de fichier —
// utilises par le planificateur de notifications (main.go, PRODUIT
// "Notifications : rappel de seance et mots doux", 9 aout 2026), qui enumere
// des profils (ListerProfils) sans jamais connaitre l'email en clair qui les a
// produits : identifiantFichier est un hash a sens unique.
func LireProfilParID(racine, id string) (Profil, error) {
	brut, err := os.ReadFile(cheminProfilID(racine, id))
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

func EcrireProfilParID(racine, id string, p Profil) error {
	if err := os.MkdirAll(racine, 0o700); err != nil {
		return err
	}
	brut, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	dest := cheminProfilID(racine, id)
	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, brut, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}

// ListerProfils enumere les identifiants de tous les profils enregistres sous
// racine (PRODUIT "Notifications") : le planificateur verifie tous les
// profils, pas seulement celui de la requete en cours. Rend une liste vide,
// jamais une erreur, si racine n'existe pas encore (aucun profil cree).
func ListerProfils(racine string) ([]string, error) {
	entrees, err := os.ReadDir(racine)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var ids []string
	for _, e := range entrees {
		nom := e.Name()
		if e.IsDir() || !strings.HasPrefix(nom, "profil-") || !strings.HasSuffix(nom, ".json") {
			continue // ignore repertoires et fichiers .tmp d'une ecriture interrompue
		}
		ids = append(ids, strings.TrimSuffix(strings.TrimPrefix(nom, "profil-"), ".json"))
	}
	return ids, nil
}

// SupprimerProfil efface le profil de CE compte, et seulement le sien —
// identite() garantit deja que l'appelant ne peut agir que sur son propre
// fichier (ossature §7). Idempotent : un profil deja absent n'est pas une
// erreur.
func SupprimerProfil(racine, email string) error {
	err := os.Remove(cheminProfil(racine, email))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
