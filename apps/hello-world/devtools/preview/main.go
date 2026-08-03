// Commande preview : voir la page telle que Traefik la sert.
//
// En local, l'en-tete X-Forwarded-User est absent et la page affiche la valeur
// eteinte "inconnu". C'est un etat legitime — et le seul visible sans ce
// mandataire. Tout travail visuel sur la ligne d'identite, qui est la seule a
// porter l'ambre, se fait donc a l'aveugle sans lui.
//
// Ce programme reproduit exactement ce que Traefik fait devant l'application :
// il pose X-Forwarded-User et l'hote public, puis relaie. Rien de plus.
//
//	go run . &                                  # l'application, sur :8080
//	go run ./devtools/preview                   # le mandataire, sur :8081
//
// La page authentifiee est alors sur http://127.0.0.1:8081/.
//
// Il ne fait pas partie de l'image : le Dockerfile ne construit que le paquet
// racine. Ne t'en sers pas comme d'une brique d'infrastructure — en production,
// l'identite vient de Traefik et de nulle part ailleurs.
package main

import (
	"flag"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

func main() {
	amont := flag.String("amont", "http://127.0.0.1:8080", "adresse de l'application")
	ecoute := flag.String("ecoute", "127.0.0.1:8081", "adresse d'ecoute du mandataire")
	user := flag.String("user", "amuteau@gmail.com", "valeur posee dans X-Forwarded-User")
	hote := flag.String("hote", "hello-world.apps.billbob.ovh", "valeur de l'en-tete Host")
	flag.Parse()

	cible, err := url.Parse(*amont)
	if err != nil {
		log.Fatalf("adresse amont illisible : %v", err)
	}

	mandataire := httputil.NewSingleHostReverseProxy(cible)

	log.Printf("mandataire sur http://%s -> %s (X-Forwarded-User: %s)", *ecoute, *amont, *user)
	log.Fatal(http.ListenAndServe(*ecoute, http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			// Traefik ecrase tout en-tete de meme nom present dans la requete
			// entrante : Set, jamais Add.
			r.Header.Set("X-Forwarded-User", *user)
			r.Host = *hote
			mandataire.ServeHTTP(w, r)
		})))
}
