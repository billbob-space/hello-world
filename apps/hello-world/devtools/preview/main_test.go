package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestUsurpeEcraseEnTeteExistant verifie que X-Forwarded-User est pose par
// Set, jamais Add : toute valeur deja presente dans la requete entrante est
// ecrasee, exactement comme le fait Traefik.
func TestUsurpeEcraseEnTeteExistant(t *testing.T) {
	var recu string
	amont := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recu = r.Header.Get("X-Forwarded-User")
		if n := len(r.Header.Values("X-Forwarded-User")); n != 1 {
			t.Fatalf("X-Forwarded-User present %d fois, attendu 1 (Set, pas Add)", n)
		}
	})

	gestionnaire := usurpe("amuteau@gmail.com", "hello-world.apps.billbob.ovh", amont)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-User", "quelquun-dautre@example.com")
	rec := httptest.NewRecorder()
	gestionnaire.ServeHTTP(rec, req)

	if recu != "amuteau@gmail.com" {
		t.Fatalf("X-Forwarded-User = %q, attendu %q (la valeur entrante n'a pas ete ecrasee)", recu, "amuteau@gmail.com")
	}
}

// TestUsurpeRemplaceHote verifie que r.Host est bien remplace par la valeur
// attendue avant que la requete ne soit relayee.
func TestUsurpeRemplaceHote(t *testing.T) {
	var recu string
	amont := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recu = r.Host
	})

	gestionnaire := usurpe("amuteau@gmail.com", "hello-world.apps.billbob.ovh", amont)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "127.0.0.1:8081"
	rec := httptest.NewRecorder()
	gestionnaire.ServeHTTP(rec, req)

	if recu != "hello-world.apps.billbob.ovh" {
		t.Fatalf("Host relaye = %q, attendu %q", recu, "hello-world.apps.billbob.ovh")
	}
}
