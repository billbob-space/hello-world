// apps/ramure-v2/internal/collection/file_test.go
package collection

import (
	"bytes"
	"context"
	"strings"
	"sync"
	"testing"
)

// TestFileStoreSurvitAUnRedemarrage : deux instances SUCCESSIVES de
// FileStore sur le meme repertoire voient les memes entrees — c'est la
// simulation la plus proche d'un redemarrage de conteneur qu'un test sans
// demon Docker permette (voir le rapport final : la persistance sur le
// VRAI volume nomme reste a prouver en production).
func TestFileStoreSurvitAUnRedemarrage(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()

	premiere, err := NouveauFileStore(dir)
	if err != nil {
		t.Fatalf("premiere instance : %v", err)
	}
	if err := premiere.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1"}); err != nil {
		t.Fatalf("ajouter : %v", err)
	}

	// Nouvelle instance, MEME repertoire : simule un nouveau processus qui
	// repart du volume laisse par le precedent.
	seconde, err := NouveauFileStore(dir)
	if err != nil {
		t.Fatalf("seconde instance : %v", err)
	}
	entrees, err := seconde.Lister(ctx, "a@x")
	if err != nil {
		t.Fatalf("lister : %v", err)
	}
	if len(entrees) != 1 || entrees[0].MBID != "m1" {
		t.Fatalf("la collection n'a pas survecu au redemarrage : %+v", entrees)
	}
}

// TestSansRepertoireOnRetombeSurMemoryStore : repertoire vide -> repli en
// memoire, ET un avertissement explicite est ecrit sur la sortie donnee.
func TestSansRepertoireOnRetombeSurMemoryStore(t *testing.T) {
	var sortie bytes.Buffer
	store, err := ChoisirStore("", &sortie)
	if err != nil {
		t.Fatalf("ChoisirStore : %v", err)
	}
	if _, estFileStore := store.(*fileStore); estFileStore {
		t.Fatal("repertoire vide aurait du rendre un MemoryStore, pas un FileStore")
	}
	if !strings.Contains(sortie.String(), "memoire") {
		t.Fatalf("aucun avertissement explicite ecrit au demarrage : %q", sortie.String())
	}
}

// TestAvecRepertoireOnChoisitFileStore : miroir du test precedent, pour
// verifier que le regime nominal est bien choisi quand RAMURE_DATA_DIR est
// definie.
func TestAvecRepertoireOnChoisitFileStore(t *testing.T) {
	var sortie bytes.Buffer
	store, err := ChoisirStore(t.TempDir(), &sortie)
	if err != nil {
		t.Fatalf("ChoisirStore : %v", err)
	}
	if _, estFileStore := store.(*fileStore); !estFileStore {
		t.Fatal("repertoire non vide aurait du rendre un FileStore")
	}
	if sortie.Len() != 0 {
		t.Fatalf("aucun avertissement attendu en regime nominal, obtenu %q", sortie.String())
	}
}

// TestEcrituresConcurrentesNePerdentRienDeux (sous -race) : deux ajouts
// simultanes pour le MEME utilisateur, deux artistes distincts : les deux
// entrees sont presentes a la fin, aucune perdue par une ecriture qui en
// ecraserait une autre.
func TestEcrituresConcurrentesNePerdentRienDeux(t *testing.T) {
	dir := t.TempDir()
	store, err := NouveauFileStore(dir)
	if err != nil {
		t.Fatalf("NouveauFileStore : %v", err)
	}
	ctx := context.Background()

	var attente sync.WaitGroup
	attente.Add(2)
	go func() {
		defer attente.Done()
		_ = store.Ajouter(ctx, "a@x", Entree{Nom: "Portishead", MBID: "m1"})
	}()
	go func() {
		defer attente.Done()
		_ = store.Ajouter(ctx, "a@x", Entree{Nom: "Massive Attack", MBID: "m2"})
	}()
	attente.Wait()

	entrees, err := store.Lister(ctx, "a@x")
	if err != nil {
		t.Fatalf("lister : %v", err)
	}
	if len(entrees) != 2 {
		t.Fatalf("attendu 2 entrees apres deux ajouts concurrents, obtenu %d : %+v", len(entrees), entrees)
	}
}
