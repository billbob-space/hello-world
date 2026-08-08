package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestLireProfilAbsent(t *testing.T) {
	_, err := LireProfil(t.TempDir(), "test@example.com")
	if !errors.Is(err, ErrProfilAbsent) {
		t.Fatalf("erreur = %v, attendu ErrProfilAbsent", err)
	}
}

func TestEcrireEtRelireProfil(t *testing.T) {
	racine := t.TempDir()
	p := Profil{VersionSchema: 1, Reponses: Reponses{NiveauDepart: "debutante", JoursActifs: []string{"lundi"}}}
	if err := EcrireProfil(racine, "test@example.com", p); err != nil {
		t.Fatal(err)
	}
	relu, err := LireProfil(racine, "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if relu.Reponses.NiveauDepart != "debutante" {
		t.Fatalf("niveau_depart = %q, attendu debutante", relu.Reponses.NiveauDepart)
	}
}

func TestDeuxIdentitesDistinctesDeuxFichiers(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfil(racine, "elle@example.com", Profil{VersionSchema: 1}); err != nil {
		t.Fatal(err)
	}
	if err := EcrireProfil(racine, "vous@example.com", Profil{VersionSchema: 1}); err != nil {
		t.Fatal(err)
	}
	if cheminProfil(racine, "elle@example.com") == cheminProfil(racine, "vous@example.com") {
		t.Fatal("deux identites distinctes produisent le meme chemin de fichier")
	}
	entrees, err := os.ReadDir(racine)
	if err != nil {
		t.Fatal(err)
	}
	if len(entrees) != 2 {
		t.Fatalf("%d fichier(s) sur le volume, attendu 2", len(entrees))
	}
}

func TestEcritureNeLaisseAucunFichierTemporaire(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfil(racine, "test@example.com", Profil{VersionSchema: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(racine, "profil-"+identifiantFichier("test@example.com")+".json.tmp")); !os.IsNotExist(err) {
		t.Fatal("un fichier .tmp subsiste apres une ecriture reussie")
	}
}
