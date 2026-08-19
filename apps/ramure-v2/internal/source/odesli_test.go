// apps/ramure-v2/internal/source/odesli_test.go
package source

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache"
)

func nouveauOdesliDeTest(t *testing.T, gestionnaire http.HandlerFunc) (*Odesli, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(gestionnaire)
	t.Cleanup(srv.Close)
	o := NouveauOdesli(cache.Neuf(time.Now), budget.Neuf(), srv.Client())
	o.BaseURL = srv.URL
	return o, srv
}

func TestOdesliIndisponibleDonneLaRecherchePreRemplie(t *testing.T) {
	o, _ := nouveauOdesliDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})

	lien := o.LienEcoute(context.Background(), ServiceTidal, "Portishead", "Dummy", "https://deezer.com/album/1")
	attendu := RecherchePreRemplie(ServiceTidal, "Portishead Dummy")
	if lien != attendu {
		t.Fatalf("lien = %q, attendu %q", lien, attendu)
	}
	if lien == "" {
		t.Fatal("lien vide")
	}
}

func TestOdesliSansLeServiceChoisiDonneLeRepli(t *testing.T) {
	o, _ := nouveauOdesliDeTest(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"linksByPlatform":{"spotify":{"url":"https://open.spotify.com/album/xyz"}}}`))
	})

	lien := o.LienEcoute(context.Background(), ServiceTidal, "Portishead", "Dummy", "https://deezer.com/album/1")
	attendu := RecherchePreRemplie(ServiceTidal, "Portishead Dummy")
	if lien != attendu {
		t.Fatalf("lien = %q, attendu le repli %q", lien, attendu)
	}
}

func TestRequeteEncodee(t *testing.T) {
	lien := RecherchePreRemplie(ServiceSpotify, "Simon & Garfunkel")
	if strings.Contains(lien, " ") || strings.Contains(lien, "&") {
		t.Fatalf("lien = %q, attendu un espace et un & correctement encodes", lien)
	}
	if !strings.Contains(lien, "Simon") || !strings.Contains(lien, "Garfunkel") {
		t.Fatalf("lien = %q, attendu le nom present", lien)
	}
}

func TestJamaisDeChaineVide(t *testing.T) {
	services := []Service{ServiceDeezer, ServiceSpotify, ServiceApple, ServiceYouTube, ServiceTidal}
	plateforme := map[Service]string{
		ServiceDeezer:  "deezer",
		ServiceSpotify: "spotify",
		ServiceApple:   "appleMusic",
		ServiceYouTube: "youtubeMusic",
		ServiceTidal:   "tidal",
	}

	for _, s := range services {
		t.Run(string(s)+"/resolu", func(t *testing.T) {
			o, _ := nouveauOdesliDeTest(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"linksByPlatform":{"` + plateforme[s] + `":{"url":"https://exemple/lien"}}}`))
			})
			lien := o.LienEcoute(context.Background(), s, "Artiste", "Album", "https://deezer.com/album/1")
			if lien == "" {
				t.Fatal("lien vide")
			}
			if lien != "https://exemple/lien" {
				t.Fatalf("lien = %q, attendu la resolution exacte", lien)
			}
		})

		t.Run(string(s)+"/non_resolu", func(t *testing.T) {
			o, _ := nouveauOdesliDeTest(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"linksByPlatform":{}}`))
			})
			lien := o.LienEcoute(context.Background(), s, "Artiste", "Album", "https://deezer.com/album/1")
			if lien == "" {
				t.Fatal("lien vide")
			}
		})

		t.Run(string(s)+"/en_panne", func(t *testing.T) {
			o, _ := nouveauOdesliDeTest(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			})
			lien := o.LienEcoute(context.Background(), s, "Artiste", "Album", "https://deezer.com/album/1")
			if lien == "" {
				t.Fatal("lien vide")
			}
		})
	}
}
