package main

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// F-37, marquee CRITIQUE par le PRD : "reessayer relance un veritable
// chargement : aucun resultat vide ni aucune erreur transitoire n'est conserve
// en memoire ou sur le poste."
//
// C'est le fichier qui la tient. Le symptome que ces tests interdisent est le
// pire du produit : un artiste reste durablement en affichage degrade apres un
// incident de quelques secondes chez la source, et l'utilisateur n'a aucun
// moyen de s'en sortir — reessayer reservirait la meme reponse memorisee.

func cacheDeTest() (*Cache, *time.Time) {
	maintenant := time.Now()
	c := NouveauCache()
	c.maintenant = func() time.Time { return maintenant }
	return c, &maintenant
}

func TestUneErreurNeDoitJamaisEtreMiseEnCache(t *testing.T) {
	c, _ := cacheDeTest()
	var appels atomic.Int32

	produire := func(context.Context) (any, error) {
		appels.Add(1)
		return nil, errors.New("source injoignable")
	}

	for i := 0; i < 3; i++ {
		if _, err := c.Charge(context.Background(), "cle", time.Hour, produire); err == nil {
			t.Fatal("l'erreur n'a pas ete remontee")
		}
	}

	if n := appels.Load(); n != 3 {
		t.Errorf("%d appels a la source pour 3 tentatives : une erreur a ete memorisee, l'artiste reste degrade a jamais", n)
	}
}

func TestUnResultatVideNeDoitJamaisEtreMisEnCache(t *testing.T) {
	c, _ := cacheDeTest()
	var appels atomic.Int32

	produire := func(context.Context) (any, error) {
		appels.Add(1)
		return []Voisin{}, nil
	}

	for i := 0; i < 3; i++ {
		if _, err := c.Charge(context.Background(), "cle", time.Hour, produire); err != nil {
			t.Fatalf("erreur inattendue : %v", err)
		}
	}

	if n := appels.Load(); n != 3 {
		t.Errorf("%d appels pour 3 tentatives : un vide a ete memorise. « Cet artiste n'a pas de voisins » "+
			"est presque toujours une panne deguisee ; la memoriser la rend permanente", n)
	}
}

func TestUnResultatVideDeChaqueTypeEstReconnu(t *testing.T) {
	cas := []any{
		nil,
		[]Artiste{},
		[]Album{},
		[]Voisin{},
	}
	for _, v := range cas {
		if !estVide(v) {
			t.Errorf("estVide(%T) = false : ce vide serait mis en cache", v)
		}
	}

	nonVides := []any{
		[]Artiste{{Nom: "A"}},
		[]Album{{Titre: "A"}},
		[]Voisin{{Artiste: Artiste{Nom: "A"}}},
		"une chaine",
		42,
	}
	for _, v := range nonVides {
		if estVide(v) {
			t.Errorf("estVide(%v) = true : un resultat valide ne serait jamais mis en cache", v)
		}
	}
}

func TestUnResultatValideEstBienServiDepuisLeCache(t *testing.T) {
	c, _ := cacheDeTest()
	var appels atomic.Int32

	produire := func(context.Context) (any, error) {
		appels.Add(1)
		return []Artiste{{Nom: "Portishead"}}, nil
	}

	for i := 0; i < 5; i++ {
		v, err := c.Charge(context.Background(), "cle", time.Hour, produire)
		if err != nil {
			t.Fatal(err)
		}
		if arts := v.([]Artiste); arts[0].Nom != "Portishead" {
			t.Fatalf("valeur inattendue : %v", arts)
		}
	}

	if n := appels.Load(); n != 1 {
		t.Errorf("%d appels pour 5 lectures : le cache ne sert pas, le quota partage sauterait a la premiere heure de pointe", n)
	}
}

func TestUneEntreePerimeeEstRechargee(t *testing.T) {
	c, horloge := cacheDeTest()
	var appels atomic.Int32

	produire := func(context.Context) (any, error) {
		appels.Add(1)
		return []Artiste{{Nom: "A"}}, nil
	}

	c.Charge(context.Background(), "cle", time.Minute, produire)
	*horloge = horloge.Add(2 * time.Minute)
	c.Charge(context.Background(), "cle", time.Minute, produire)

	if n := appels.Load(); n != 2 {
		t.Errorf("%d appels : l'entree perimee n'a pas ete rechargee", n)
	}
}

// N-07 : "les requetes identiques simultanees sont mutualisees".
//
// Symptome interdit : dix utilisateurs plantent le meme artiste a la meme
// seconde et dix requetes partent vers la source, epuisant le quota commun.
func TestDixDemandesSimultaneesNeDoiventPartirQuUneFoisVersLaSource(t *testing.T) {
	c, _ := cacheDeTest()
	var appels atomic.Int32
	depart := make(chan struct{})

	produire := func(context.Context) (any, error) {
		appels.Add(1)
		// Assez long pour que les dix appelants se rejoignent sur le meme vol.
		time.Sleep(60 * time.Millisecond)
		return []Artiste{{Nom: "A"}}, nil
	}

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-depart
			if _, err := c.Charge(context.Background(), "cle", time.Hour, produire); err != nil {
				t.Error(err)
			}
		}()
	}
	close(depart)
	wg.Wait()

	if n := appels.Load(); n != 1 {
		t.Errorf("%d appels pour 10 demandes simultanees : le quota partage serait epuise dix fois plus vite", n)
	}
}

// Un appelant qui se deconnecte ne doit pas emporter la requete des autres :
// c'est ce que garantit le contexte detache dans Charge.
func TestUnAppelantQuiAbandonneNeDoitPasAnnulerLeVolDesAutres(t *testing.T) {
	c, _ := cacheDeTest()
	var appels atomic.Int32
	commence := make(chan struct{})

	produire := func(ctx context.Context) (any, error) {
		appels.Add(1)
		close(commence)
		time.Sleep(80 * time.Millisecond)
		// Si le contexte du premier appelant avait ete transmis, il serait
		// annule ici.
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return []Artiste{{Nom: "A"}}, nil
	}

	ctxAbandon, annule := context.WithCancel(context.Background())
	go func() { c.Charge(ctxAbandon, "cle", time.Hour, produire) }()

	<-commence
	annule() // le premier appelant se deconnecte

	// Un second appelant demande la meme cle : il doit obtenir la valeur.
	v, err := c.Charge(context.Background(), "cle", time.Hour, produire)
	if err != nil {
		t.Fatalf("le vol a ete emporte par l'abandon du premier appelant : %v", err)
	}
	if arts, ok := v.([]Artiste); !ok || len(arts) == 0 {
		t.Fatalf("valeur inattendue : %v", v)
	}
}

func TestLaPurgeRetireLesEntreesPerimeesEtGardeLesAutres(t *testing.T) {
	c, horloge := cacheDeTest()
	produire := func(v any) func(context.Context) (any, error) {
		return func(context.Context) (any, error) { return v, nil }
	}

	c.Charge(context.Background(), "courte", time.Minute, produire([]Artiste{{Nom: "A"}}))
	c.Charge(context.Background(), "longue", time.Hour, produire([]Artiste{{Nom: "B"}}))

	*horloge = horloge.Add(10 * time.Minute)

	if n := c.Purge(); n != 1 {
		t.Errorf("%d entrees purgees, veut 1", n)
	}
	if etat := c.Etat(); etat["entrees"].(int) != 1 {
		t.Errorf("%v entrees restantes, veut 1 : la purge a emporte une entree encore valide", etat["entrees"])
	}
}

func TestLeTauxDeServiceParLeCacheEstMesure(t *testing.T) {
	c, _ := cacheDeTest()
	produire := func(context.Context) (any, error) { return []Artiste{{Nom: "A"}}, nil }

	// 1 manque puis 3 touches.
	for i := 0; i < 4; i++ {
		c.Charge(context.Background(), "cle", time.Hour, produire)
	}

	etat := c.Etat()
	if etat["manques"].(int64) != 1 || etat["touches"].(int64) != 3 {
		t.Errorf("compteurs : %v", etat)
	}
	if taux := etat["tauxServi"].(float64); taux < 0.74 || taux > 0.76 {
		t.Errorf("tauxServi = %v, veut 0.75 — c'est l'indicateur qui fait voir venir le depassement de quota", taux)
	}
}

// Le seau a jetons lisse les rafales sans jamais bloquer indefiniment.
func TestLeDebitLaisseLaRafaleInitialePasserSansAttente(t *testing.T) {
	d := NouveauDebit(5, 10)
	debut := time.Now()

	for i := 0; i < 10; i++ {
		if err := d.Attends(context.Background()); err != nil {
			t.Fatal(err)
		}
	}

	if ecoule := time.Since(debut); ecoule > 50*time.Millisecond {
		t.Errorf("la rafale de 10 a pris %v : le seau devrait la laisser passer d'un coup", ecoule)
	}
}

func TestLeDebitRespecteLAnnulationDuContexte(t *testing.T) {
	d := NouveauDebit(1, 1)
	d.Attends(context.Background()) // consomme le seul jeton

	ctx, annule := context.WithCancel(context.Background())
	annule()

	if err := d.Attends(ctx); !errors.Is(err, context.Canceled) {
		t.Errorf("Attends = %v, veut context.Canceled : une requete abandonnee ne doit pas tenir un connecteur", err)
	}
}
