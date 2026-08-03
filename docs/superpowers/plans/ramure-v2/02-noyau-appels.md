# PRP 02 — Noyau d'appels

> **Ce PRP livre** les trois invariants qui protègent tout le reste, **avant**
> qu'une seule source externe ne soit écrite : un cache mutualisé côté serveur
> qui ne mémorise jamais un échec et mutualise les requêtes identiques
> simultanées (N-04, N-05, N-07, §09) ; un budget d'appels dont la règle
> « profondeur maximale au centre, strict minimum sur l'entourage » est **portée
> par le type** et non par la discipline des appelants (N-03, critique) ; et la
> correspondance stricte des noms, avec le bornage de la correction
> orthographique de F-03 (§09).
>
> **Ce PRP consomme** — du PRP 01 uniquement :
> - le module Go `github.com/billbob-space/hello-world/apps/ramure-v2`, soit
>   `apps/ramure-v2/go.mod` ;
> - `apps/ramure-v2/test.sh`, exécutable, contenant `go vet ./...` puis
>   `go test ./...` ;
> - `func routes() http.Handler` dans `apps/ramure-v2/main.go` — **non modifié
>   par ce PRP** : aucune route n'est ajoutée ici.
>
> **Ce PRP produit** — trois paquets internes, sans aucune dépendance entre eux
> (`cache` et `budget` n'importent rien du dépôt ; `source/strict.go`
> n'importe ni `cache` ni `budget`), ce qui garantit l'absence de cycle
> lorsque le PRP 03 fera importer `cache` et `budget` par `source` :
>
> ```go
> package cache // apps/ramure-v2/internal/cache/cache.go
> func Neuf(horloge func() time.Time) *Cache
> func (c *Cache) Obtenir(cle string, ttl time.Duration,
>     charger func() ([]byte, error)) ([]byte, error)
> func (c *Cache) TauxDeService() (succes, total int64)
>
> package budget // apps/ramure-v2/internal/budget/limiteur.go
> type Source string
> const (MusicBrainz, CoverArt, LastFM, ListenBrainz, Deezer, Odesli Source)
> type Portee string
> const (Centre, Entourage Portee)
> var ErrPorteeInterdite error
> func Neuf() *Limiteur
> func (l *Limiteur) Attendre(ctx context.Context, s Source, p Portee) error
> func (l *Limiteur) Compte(s Source) int64
>
> package source // apps/ramure-v2/internal/source/strict.go
> func Normaliser(s string) string
> func CorrespondanceStricte[T any](demande string, candidats []T,
>     nom func(T) string) (T, bool)
> func CorrectionPlausible(demande, propose string) bool
> ```
>
> Les contraintes globales (nom de l'app, palier d'authentification, image,
> vocabulaire §05, convention de commit) sont posées une fois pour toutes dans
> [le README de la série](README.md) et dans `CLAUDE.md`. Elles ne sont pas
> répétées ici.

**Onze tâches.** Chacune porte son propre cycle rouge–vert et se termine par un
commit. Aucune ne dépend du réseau : ce PRP ne fait aucun appel HTTP, ni réel ni
simulé — c'est le PRP 03 qui branche `httptest.NewServer` sur ces trois paquets.

---

### Tâche 1 : le cache mutualisé — mémoriser et expirer

Porte N-04. *« Les réponses des sources externes sont mises en cache côté
serveur, partagé entre tous les utilisateurs, avec des durées adaptées à la
volatilité de chaque donnée. Un cache par navigateur ne protège pas d'un plafond
de débit commun. »* L'horloge est injectée : sans elle, tester l'expiration
imposerait de dormir une minute dans la suite de tests.

**Fichiers :**
- Créer : `apps/ramure-v2/internal/cache/cache.go`
- Test : `apps/ramure-v2/internal/cache/cache_test.go`

**Interfaces :**
- Consomme : le module `github.com/billbob-space/hello-world/apps/ramure-v2`
  (PRP 01). Rien d'autre.
- Produit :
  ```go
  func Neuf(horloge func() time.Time) *Cache
  func (c *Cache) Obtenir(cle string, ttl time.Duration,
      charger func() ([]byte, error)) ([]byte, error)
  ```

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/cache/cache_test.go
package cache

import (
	"sync/atomic"
	"testing"
	"time"
)

func TestSecondAppelServiParLeCache(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		return []byte("valeur"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("second appel : %v", err)
	}
	if string(v) != "valeur" {
		t.Fatalf("valeur = %q, attendu \"valeur\"", v)
	}
	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
}

func TestEntreeExpireeEstRechargee(t *testing.T) {
	instant := time.Unix(1754200000, 0)
	c := Neuf(func() time.Time { return instant })
	var appels int32
	charger := func() ([]byte, error) {
		n := atomic.AddInt32(&appels, 1)
		if n == 1 {
			return []byte("ancienne"), nil
		}
		return []byte("fraiche"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err != nil {
		t.Fatalf("premier appel : %v", err)
	}
	instant = instant.Add(2 * time.Minute)
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("apres expiration : %v", err)
	}
	if string(v) != "fraiche" {
		t.Fatalf("valeur = %q, attendu \"fraiche\"", v)
	}
	if n := atomic.LoadInt32(&appels); n != 2 {
		t.Fatalf("chargeur appele %d fois, attendu 2", n)
	}
}

func TestClesDistinctesNeSePartagentPasUneEntree(t *testing.T) {
	c := Neuf(time.Now)
	charger := func(valeur string) func() ([]byte, error) {
		return func() ([]byte, error) { return []byte(valeur), nil }
	}

	a, _ := c.Obtenir("musicbrainz:artiste:portishead", time.Minute, charger("portishead"))
	b, _ := c.Obtenir("musicbrainz:artiste:radiohead", time.Minute, charger("radiohead"))

	if string(a) != "portishead" {
		t.Fatalf("cle portishead = %q", a)
	}
	if string(b) != "radiohead" {
		t.Fatalf("cle radiohead = %q", b)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -v
```

Attendu : ÉCHEC de compilation —
`internal/cache/cache_test.go:10:7: undefined: Neuf`, répété pour chaque appel,
puis `FAIL … [build failed]`. Le paquet `cache` n'a encore aucun fichier
non-test.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/cache/cache.go
// Cache mutualise cote serveur, partage entre tous les utilisateurs (N-04).
//
// Un cache par navigateur ne protegerait de rien : le plafond de debit des
// sources externes est commun a tous les utilisateurs, puisqu'ils sortent tous
// par l'adresse IP du serveur. C'est donc ici, et nulle part ailleurs, que se
// gagne le taux de service qui rend le budget d'appels tenable.
//
// Le cache ne connait pas la semantique des octets qu'il transporte : la duree
// de vie adaptee a la volatilite de la donnee (N-04) est choisie par l'appelant,
// argument par argument.
package cache

import (
	"sync"
	"time"
)

type entree struct {
	valeur []byte
	expire time.Time
}

// Cache est sur de l'emploi concurrent. Il ne doit jamais etre copie : on le
// manipule par pointeur, tel que Neuf le rend.
type Cache struct {
	mu      sync.Mutex
	entrees map[string]entree
	horloge func() time.Time
}

// Neuf construit un cache vide. L'horloge est injectee pour que l'expiration
// soit testable sans attendre reellement ; nil vaut time.Now.
func Neuf(horloge func() time.Time) *Cache {
	if horloge == nil {
		horloge = time.Now
	}
	return &Cache{
		entrees: make(map[string]entree),
		horloge: horloge,
	}
}

// Obtenir rend la valeur associee a cle, en appelant charger si l'entree est
// absente ou perimee. Le verrou n'est jamais tenu pendant charger : un appel
// externe lent ne doit pas figer les autres cles.
func (c *Cache) Obtenir(cle string, ttl time.Duration,
	charger func() ([]byte, error)) ([]byte, error) {

	c.mu.Lock()
	e, presente := c.entrees[cle]
	fraiche := presente && c.horloge().Before(e.expire)
	c.mu.Unlock()
	if fraiche {
		return e.valeur, nil
	}

	valeur, err := charger()

	c.mu.Lock()
	c.entrees[cle] = entree{valeur: valeur, expire: c.horloge().Add(ttl)}
	c.mu.Unlock()

	return valeur, err
}
```

> **Cette version mémorise ce que le chargeur renvoie, échec compris.** C'est la
> plus petite implémentation qui passe les trois tests ci-dessus, et c'est
> exactement ce que la tâche 2 vient corriger, test à l'appui. Ne pas anticiper :
> la correction doit être portée par un test qui échoue d'abord.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -v
```

Attendu : PASS — `--- PASS: TestSecondAppelServiParLeCache`,
`--- PASS: TestEntreeExpireeEstRechargee`,
`--- PASS: TestClesDistinctesNeSePartagentPasUneEntree`, puis `ok`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/cache && \
git commit -m "ramure-v2 : memoriser les reponses des sources cote serveur"
```

---

### Tâche 2 : aucun état d'échec n'est jamais mémorisé

Porte N-05 et la règle §09 *« Aucun état d'échec n'est conservé. Résultat vide,
note absente, erreur réseau : ce sont des états transitoires. Les mémoriser
condamne durablement un artiste à un affichage dégradé, même une fois la source
rétablie. »* C'est la seule tâche du PRP dont l'oubli ne se voit pas en
développement : le défaut n'apparaît qu'après un incident de la source, et
persiste jusqu'au redémarrage du serveur.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/cache/cache.go`
- Test : `apps/ramure-v2/internal/cache/echec_test.go`

**Interfaces :**
- Consomme : `cache.Neuf`, `(*cache.Cache).Obtenir` (tâche 1).
- Produit : aucune signature nouvelle. Une garantie de plus sur `Obtenir` — une
  valeur n'est mémorisée que si `charger` a renvoyé une erreur nulle. Le PRP 03
  s'appuie dessus pour renvoyer `ErrIntrouvable` sur un résultat vide sans
  figer l'artiste.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/cache/echec_test.go
package cache

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

// N-05 : « les reponses en erreur ou en depassement de quota ne sont jamais
// mises en cache : le statut reel doit remonter pour que la temporisation cote
// client fonctionne ».
func TestUneErreurNEstJamaisMiseEnCache(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			return nil, errors.New("quota depasse")
		}
		return []byte("retabli"), nil
	}

	if _, err := c.Obtenir("k", time.Minute, charger); err == nil {
		t.Fatal("premiere tentative : erreur attendue")
	}
	v, err := c.Obtenir("k", time.Minute, charger)

	if err != nil {
		t.Fatalf("seconde tentative : %v", err)
	}
	if string(v) != "retabli" {
		t.Fatalf("valeur = %q, attendu \"retabli\" : l'echec a ete memorise", v)
	}
	if n := atomic.LoadInt32(&appels); n != 2 {
		t.Fatalf("chargeur appele %d fois, attendu 2", n)
	}
}

// §09 : un vivier vide est un etat transitoire, pas un resultat. Le chargeur le
// signale par une erreur — c'est la convention que le PRP 03 applique — et le
// cache ne doit rien retenir, meme si des octets accompagnent l'erreur.
func TestUnVivierVideSignaleParUneErreurNEstPasFige(t *testing.T) {
	c := Neuf(time.Now)
	errVide := errors.New("vivier vide")
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			return []byte("[]"), errVide
		}
		return []byte(`[{"nom":"Massive Attack","affinite":0.91}]`), nil
	}

	if _, err := c.Obtenir("lastfm:vivier:portishead", time.Hour, charger); !errors.Is(err, errVide) {
		t.Fatalf("premiere tentative : err = %v, attendu errVide", err)
	}
	v, err := c.Obtenir("lastfm:vivier:portishead", time.Hour, charger)

	if err != nil {
		t.Fatalf("seconde tentative : %v", err)
	}
	if string(v) != `[{"nom":"Massive Attack","affinite":0.91}]` {
		t.Fatalf("vivier = %s, attendu le vivier retabli", v)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test ./internal/cache/ -run 'TestUneErreurNEstJamaisMiseEnCache|TestUnVivierVideSignaleParUneErreurNEstPasFige' -v
```

Attendu : ÉCHEC —
`valeur = "", attendu "retabli" : l'echec a ete memorise` pour le premier test,
`vivier = [], attendu le vivier retabli` pour le second. Dans les deux cas la
seconde tentative a été servie par l'entrée écrite lors de l'échec.

- [ ] **Étape 3 : implémenter**

Remplacer la fin d'`Obtenir` — l'écriture devient conditionnelle :

```go
// apps/ramure-v2/internal/cache/cache.go — Obtenir, version 2
func (c *Cache) Obtenir(cle string, ttl time.Duration,
	charger func() ([]byte, error)) ([]byte, error) {

	c.mu.Lock()
	e, presente := c.entrees[cle]
	fraiche := presente && c.horloge().Before(e.expire)
	c.mu.Unlock()
	if fraiche {
		return e.valeur, nil
	}

	valeur, err := charger()

	// L'ecriture n'a lieu qu'en cas de succes (N-05, §09). Une erreur reseau,
	// un depassement de quota ou un resultat vide signale par une erreur sont
	// des etats transitoires : les memoriser condamnerait l'artiste a un
	// affichage degrade pour toute la duree de vie du processus, meme une fois
	// la source retablie. Les octets accompagnant une erreur sont ignores.
	if err == nil {
		c.mu.Lock()
		c.entrees[cle] = entree{valeur: valeur, expire: c.horloge().Add(ttl)}
		c.mu.Unlock()
	}

	return valeur, err
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -v
```

Attendu : PASS — les cinq tests du paquet `cache`, dont
`--- PASS: TestUneErreurNEstJamaisMiseEnCache` et
`--- PASS: TestUnVivierVideSignaleParUneErreurNEstPasFige`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/cache && \
git commit -m "ramure-v2 : ne jamais memoriser un etat d'echec"
```

---

### Tâche 3 : mutualiser les requêtes identiques simultanées

Porte N-07. *« Les requêtes identiques simultanées sont mutualisées ; les
enchaînements rapides de promotions ne produisent ni requêtes redondantes ni
états incohérents. »* Sans cette tâche, vingt utilisateurs plantant la même
graine au même instant émettent vingt appels MusicBrainz — soit vingt fois le
quota d'une seconde, et le blocage de l'adresse IP du serveur.

Le test décisif ne vaut que sous `-race` : c'est ici que `test.sh` gagne le
détecteur de concurrence, pour toutes les tâches suivantes de la série.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/cache/cache.go`
- Modifier : `apps/ramure-v2/test.sh`
- Test : `apps/ramure-v2/internal/cache/concurrence_test.go`

**Interfaces :**
- Consomme : `cache.Neuf`, `(*cache.Cache).Obtenir` (tâches 1 et 2).
- Produit : aucune signature nouvelle. Une garantie de plus sur `Obtenir` — les
  appels concurrents portant la même clé n'invoquent `charger` qu'une fois et
  reçoivent tous le même couple `(valeur, erreur)`.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/cache/concurrence_test.go
package cache

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// N-07 : vingt promotions simultanees sur la meme graine ne doivent produire
// qu'un seul appel externe. A defaut, le quota MusicBrainz (1/s) est depasse
// des la premiere minute de trafic reel.
func TestVingtRequetesSimultaneesNAppellentQuUneFoisLeChargeur(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		time.Sleep(20 * time.Millisecond)
		return []byte("8f6bd1e4-fbe1-4f50-aa9b-fb7f4e2b4c6b"), nil
	}

	depart := make(chan struct{})
	recu := make([]string, 20)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-depart
			v, err := c.Obtenir("musicbrainz:artiste:portishead", time.Minute, charger)
			if err != nil {
				t.Errorf("goroutine %d : %v", i, err)
				return
			}
			recu[i] = string(v)
		}(i)
	}
	close(depart)
	wg.Wait()

	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
	for i, v := range recu {
		if v != "8f6bd1e4-fbe1-4f50-aa9b-fb7f4e2b4c6b" {
			t.Fatalf("goroutine %d a recu %q", i, v)
		}
	}
}

// N-05 croise N-07 : l'erreur d'un vol mutualise remonte a tous les attendants,
// et n'est pas davantage memorisee que celle d'un appel solitaire.
func TestLErreurDUnVolMutualiseNEstPasMemorisee(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		if atomic.AddInt32(&appels, 1) == 1 {
			time.Sleep(20 * time.Millisecond)
			return nil, errors.New("source indisponible")
		}
		return []byte("retabli"), nil
	}

	depart := make(chan struct{})
	erreurs := make([]error, 10)
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-depart
			_, erreurs[i] = c.Obtenir("k", time.Minute, charger)
		}(i)
	}
	close(depart)
	wg.Wait()

	for i, err := range erreurs {
		if err == nil {
			t.Fatalf("goroutine %d : erreur attendue, l'echec a ete masque", i)
		}
	}
	v, err := c.Obtenir("k", time.Minute, charger)
	if err != nil {
		t.Fatalf("apres retablissement : %v", err)
	}
	if string(v) != "retabli" {
		t.Fatalf("valeur = %q, attendu \"retabli\"", v)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test ./internal/cache/ -race -run TestVingtRequetesSimultaneesNAppellentQuUneFoisLeChargeur -v
```

Attendu : ÉCHEC — `chargeur appele 20 fois, attendu 1`. Le nombre exact peut
varier selon l'ordonnancement (2 à 20) ; ce qui prouve l'absence de
mutualisation est qu'il soit supérieur à 1.

- [ ] **Étape 3 : implémenter**

Ajouter le type `vol`, le registre des vols en cours, et réécrire `Obtenir` :

```go
// apps/ramure-v2/internal/cache/cache.go — ajouts, version 3

// vol represente un chargement en cours pour une cle donnee. Les appels
// concurrents portant la meme cle s'y raccrochent au lieu d'emettre une seconde
// requete identique (N-07).
type vol struct {
	attente sync.WaitGroup
	valeur  []byte
	err     error
}

type Cache struct {
	mu      sync.Mutex
	entrees map[string]entree
	encours map[string]*vol
	horloge func() time.Time
}

func Neuf(horloge func() time.Time) *Cache {
	if horloge == nil {
		horloge = time.Now
	}
	return &Cache{
		entrees: make(map[string]entree),
		encours: make(map[string]*vol),
		horloge: horloge,
	}
}

func (c *Cache) Obtenir(cle string, ttl time.Duration,
	charger func() ([]byte, error)) ([]byte, error) {

	c.mu.Lock()
	if e, presente := c.entrees[cle]; presente && c.horloge().Before(e.expire) {
		c.mu.Unlock()
		return e.valeur, nil
	}
	if v, enVol := c.encours[cle]; enVol {
		c.mu.Unlock()
		v.attente.Wait()
		return v.valeur, v.err
	}
	v := &vol{}
	v.attente.Add(1)
	c.encours[cle] = v
	c.mu.Unlock()

	// Le verrou est relache pendant le chargement : une source lente ne doit
	// bloquer ni les autres cles, ni la lecture des entrees deja fraiches.
	v.valeur, v.err = charger()

	c.mu.Lock()
	delete(c.encours, cle)
	if v.err == nil {
		c.entrees[cle] = entree{valeur: v.valeur, expire: c.horloge().Add(ttl)}
	}
	c.mu.Unlock()

	// Le WaitGroup publie valeur et err aux attendants : sa liberation etablit
	// la relation d'anteriorite qui rend leur lecture sure.
	v.attente.Done()
	return v.valeur, v.err
}
```

Puis armer le détecteur de concurrence dans le contrat de test de l'app — le
runner de CI fournit `gcc`, donc `-race` y fonctionne :

```bash
#!/usr/bin/env bash
# apps/ramure-v2/test.sh
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
# -race : la mutualisation des requetes (N-07) est la seule partie du produit
# dont le defaut ne se voit pas sans detecteur de concurrence.
# -count=1 : jamais de resultat servi par le cache de test.
go test -race -count=1 ./...
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -race -count=1 -v && ./test.sh
```

Attendu : PASS — les sept tests du paquet `cache`, aucun `WARNING: DATA RACE`,
puis `test.sh` se termine sans erreur.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/cache apps/ramure-v2/test.sh && \
git commit -m "ramure-v2 : mutualiser les requetes identiques simultanees"
```

---

### Tâche 4 : mesurer le taux de service

Le seuil de bascule de N-13 est chiffré dans le README de la série à partir d'une
hypothèse — *« à 80 % de taux de service par le cache, environ 5 promotions par
seconde »* — assortie de la consigne « à réviser dès la première mesure ». Sans
compteur, cette révision n'a jamais lieu et le chiffre reste une croyance.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/cache/cache.go`
- Test : `apps/ramure-v2/internal/cache/taux_test.go`

**Interfaces :**
- Consomme : `cache.Neuf`, `(*cache.Cache).Obtenir` (tâches 1 à 3).
- Produit :
  ```go
  func (c *Cache) TauxDeService() (succes, total int64)
  ```
  `total` compte les appels à `Obtenir` ; `succes` ceux servis sans invoquer le
  chargeur.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/cache/taux_test.go
package cache

import (
	"errors"
	"testing"
	"time"
)

func TestTauxDeServiceCompteLesEntreesServies(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) { return []byte("v"), nil }

	if succes, total := c.TauxDeService(); succes != 0 || total != 0 {
		t.Fatalf("cache neuf : succes = %d, total = %d ; attendu 0 et 0", succes, total)
	}

	_, _ = c.Obtenir("k", time.Minute, charger) // manque
	_, _ = c.Obtenir("k", time.Minute, charger) // servi
	_, _ = c.Obtenir("k", time.Minute, charger) // servi

	succes, total := c.TauxDeService()
	if succes != 2 || total != 3 {
		t.Fatalf("succes = %d, total = %d ; attendu 2 et 3", succes, total)
	}
}

// Une erreur n'est pas un service rendu : la compter gonflerait le taux au
// moment precis ou la source est en panne, donc ou le chiffre doit alerter.
func TestUneErreurNeCompteAucunService(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) { return nil, errors.New("panne") }

	_, _ = c.Obtenir("k", time.Minute, charger)
	_, _ = c.Obtenir("k", time.Minute, charger)

	succes, total := c.TauxDeService()
	if succes != 0 || total != 2 {
		t.Fatalf("succes = %d, total = %d ; attendu 0 et 2", succes, total)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -run TauxDeService -v
```

Attendu : ÉCHEC de compilation —
`c.TauxDeService undefined (type *Cache has no field or method TauxDeService)`.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/cache/cache.go — ajouts, version 4

// Compteurs du taux de service (N-04). Ils alimentent la revision du seuil de
// bascule N-13 : le chiffre de 5 promotions par seconde repose sur une
// hypothese de 80 % de service par le cache, qui doit etre mesuree et non
// supposee. Ils sont atomiques et non proteges par c.mu : leur exactitude
// n'exige aucune coherence avec l'etat de la table.
type Cache struct {
	mu      sync.Mutex
	entrees map[string]entree
	encours map[string]*vol
	horloge func() time.Time
	succes  atomic.Int64
	total   atomic.Int64
}

func (c *Cache) Obtenir(cle string, ttl time.Duration,
	charger func() ([]byte, error)) ([]byte, error) {

	c.total.Add(1)

	c.mu.Lock()
	if e, presente := c.entrees[cle]; presente && c.horloge().Before(e.expire) {
		c.mu.Unlock()
		c.succes.Add(1)
		return e.valeur, nil
	}
	if v, enVol := c.encours[cle]; enVol {
		c.mu.Unlock()
		v.attente.Wait()
		return v.valeur, v.err
	}
	v := &vol{}
	v.attente.Add(1)
	c.encours[cle] = v
	c.mu.Unlock()

	v.valeur, v.err = charger()

	c.mu.Lock()
	delete(c.encours, cle)
	if v.err == nil {
		c.entrees[cle] = entree{valeur: v.valeur, expire: c.horloge().Add(ttl)}
	}
	c.mu.Unlock()

	v.attente.Done()
	return v.valeur, v.err
}

// TauxDeService rend le nombre de requetes servies sans appel externe et le
// nombre total de requetes, depuis le demarrage du processus.
func (c *Cache) TauxDeService() (succes, total int64) {
	return c.succes.Load(), c.total.Load()
}
```

Ajouter `"sync/atomic"` aux imports de `cache.go`.

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -race -count=1 -v
```

Attendu : PASS — neuf tests, dont
`--- PASS: TestTauxDeServiceCompteLesEntreesServies` et
`--- PASS: TestUneErreurNeCompteAucunService`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/cache && \
git commit -m "ramure-v2 : mesurer le taux de service du cache"
```

---

### Tâche 5 : une requête mutualisée est une requête servie

Une requête raccrochée à un vol en cours est servie **sans appel externe** :
c'est exactement ce que N-04 cherche à maximiser. La compter comme un manque
sous-estime la protection réelle au moment où elle joue le plus — une pointe de
trafic sur la même graine — et fausse la révision du seuil N-13 dans le sens
dangereux, celui qui fait croire le cache inefficace.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/cache/cache.go`
- Test : `apps/ramure-v2/internal/cache/taux_concurrence_test.go`

**Interfaces :**
- Consomme : `(*cache.Cache).Obtenir`, `(*cache.Cache).TauxDeService`
  (tâches 3 et 4).
- Produit : aucune signature nouvelle. La définition arrêtée de `succes` —
  *toute requête servie sans invoquer le chargeur*, entrée fraîche **ou** vol
  mutualisé réussi.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/cache/taux_concurrence_test.go
package cache

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestLesRequetesMutualiseesComptentCommeServies(t *testing.T) {
	c := Neuf(time.Now)
	var appels int32
	charger := func() ([]byte, error) {
		atomic.AddInt32(&appels, 1)
		time.Sleep(20 * time.Millisecond)
		return []byte("v"), nil
	}

	depart := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-depart
			_, _ = c.Obtenir("meme-cle", time.Minute, charger)
		}()
	}
	close(depart)
	wg.Wait()

	if n := atomic.LoadInt32(&appels); n != 1 {
		t.Fatalf("chargeur appele %d fois, attendu 1", n)
	}
	succes, total := c.TauxDeService()
	if total != 20 {
		t.Fatalf("total = %d, attendu 20", total)
	}
	if succes != 19 {
		t.Fatalf("succes = %d, attendu 19 : les requetes mutualisees ne sont pas comptees", succes)
	}
}

// Symetrie du meme principe : un vol qui echoue n'a servi personne.
func TestUnVolEnErreurNeCompteAucunService(t *testing.T) {
	c := Neuf(time.Now)
	charger := func() ([]byte, error) {
		time.Sleep(20 * time.Millisecond)
		return nil, errors.New("source indisponible")
	}

	depart := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-depart
			_, _ = c.Obtenir("k", time.Minute, charger)
		}()
	}
	close(depart)
	wg.Wait()

	succes, total := c.TauxDeService()
	if succes != 0 {
		t.Fatalf("succes = %d, attendu 0 : une panne mutualisee a ete comptee comme servie", succes)
	}
	if total != 10 {
		t.Fatalf("total = %d, attendu 10", total)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test ./internal/cache/ -race -run TestLesRequetesMutualiseesComptentCommeServies -v
```

Attendu : ÉCHEC —
`succes = 0, attendu 19 : les requetes mutualisees ne sont pas comptees`.

- [ ] **Étape 3 : implémenter**

Une seule branche change dans `Obtenir` — celle des attendants :

```go
// apps/ramure-v2/internal/cache/cache.go — branche des attendants, version 5
	if v, enVol := c.encours[cle]; enVol {
		c.mu.Unlock()
		v.attente.Wait()
		// Un attendant a ete servi sans appel externe : c'est un service rendu
		// au meme titre qu'une entree fraiche, et c'est meme la ou la
		// protection joue le plus fort (N-04, N-07). Un vol en erreur, lui,
		// n'a servi personne.
		if v.err == nil {
			c.succes.Add(1)
		}
		return v.valeur, v.err
	}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/cache/ -race -count=1 -v
```

Attendu : PASS — onze tests du paquet `cache`, aucun `WARNING: DATA RACE`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/cache && \
git commit -m "ramure-v2 : compter les requetes mutualisees comme servies"
```

---

### Tâche 6 : le budget d'appels — réserver les sources contraintes au centre

Porte N-03, seule exigence marquée **critique** par le PRD. *« Enrichir chaque
branche avec la même profondeur que le centre conduit mécaniquement au
dépassement de quota, donc à des illustrations et des branches manquantes —
c'est-à-dire à un produit visiblement cassé. »*

La règle est posée **dans le type**, et non laissée à la discipline des
appelants : un développeur du PRP 03 ou du PRP 04 qui appelle MusicBrainz pour un
héritier obtient une erreur immédiate, pas un dépassement de quota trois semaines
plus tard en production.

**Fichiers :**
- Créer : `apps/ramure-v2/internal/budget/limiteur.go`
- Test : `apps/ramure-v2/internal/budget/portee_test.go`

**Interfaces :**
- Consomme : rien.
- Produit :
  ```go
  type Source string
  const (MusicBrainz, CoverArt, LastFM, ListenBrainz, Deezer, Odesli Source)
  type Portee string
  const (Centre, Entourage Portee)
  var ErrPorteeInterdite error
  func Neuf() *Limiteur
  func (l *Limiteur) Attendre(ctx context.Context, s Source, p Portee) error
  ```

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/budget/portee_test.go
package budget

import (
	"context"
	"errors"
	"testing"
)

// N-03 : « les sources les plus contraintes en debit sont reservees au centre ;
// l'entourage est servi par les sources les plus tolerantes ».
func TestPorteesAutoriseesEtInterdites(t *testing.T) {
	cas := []struct {
		source   Source
		portee   Portee
		interdit bool
		pourquoi string
	}{
		{MusicBrainz, Centre, false, "2 appels par promotion, c'est le budget prevu"},
		{MusicBrainz, Entourage, true, "1/s : dix branches feraient dix secondes d'attente"},
		{CoverArt, Centre, false, "la pochette du centre, un appel"},
		{CoverArt, Entourage, true, "meme infrastructure que MusicBrainz, meme prudence"},
		{Deezer, Centre, false, "illustration du centre"},
		{Deezer, Entourage, false, "debit genereux : une illustration par branche"},
		{LastFM, Entourage, false, "les heritiers, un appel par branche, differe"},
		{ListenBrainz, Entourage, false, "repli du role 1, sans cle"},
		{Odesli, Entourage, false, "a la demande, sur clic"},
	}

	for _, c := range cas {
		l := Neuf()
		err := l.Attendre(context.Background(), c.source, c.portee)
		if c.interdit {
			if !errors.Is(err, ErrPorteeInterdite) {
				t.Errorf("Attendre(%s, %s) = %v, attendu ErrPorteeInterdite (%s)",
					c.source, c.portee, err, c.pourquoi)
			}
			continue
		}
		if err != nil {
			t.Errorf("Attendre(%s, %s) = %v, attendu nil (%s)",
				c.source, c.portee, err, c.pourquoi)
		}
	}
}

func TestSourceInconnueEstRefusee(t *testing.T) {
	l := Neuf()
	err := l.Attendre(context.Background(), Source("spotify"), Centre)
	if err == nil {
		t.Fatal("une source hors nomenclature doit etre refusee")
	}
	if errors.Is(err, ErrPorteeInterdite) {
		t.Fatalf("err = %v : une source inconnue n'est pas un probleme de portee", err)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -v
```

Attendu : ÉCHEC de compilation —
`internal/budget/portee_test.go: undefined: Source`, puis `undefined: Neuf`,
`undefined: ErrPorteeInterdite`, `undefined: MusicBrainz`. Le paquet `budget`
n'existe pas encore.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/budget/limiteur.go
// Budget d'appels borne et documente, par source (N-03, critique).
//
// La promotion est le geste central et le plus couteux du produit : afficher un
// centre, son entourage et les heritiers de chaque branche peut representer
// plusieurs dizaines d'appels externes. La regle « profondeur maximale au
// centre, strict minimum sur l'entourage » est posee ici, dans le type, plutot
// que laissee a la discipline des appelants : c'est la seule facon qu'elle
// survive a la relecture de PRP suivants.
package budget

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// Source nomme les six fournisseurs retenus par la serie. Toute autre valeur
// est refusee : une source non declaree n'a ni debit connu, ni portee decidee.
type Source string

const (
	MusicBrainz  Source = "musicbrainz"
	CoverArt     Source = "coverart"
	LastFM       Source = "lastfm"
	ListenBrainz Source = "listenbrainz"
	Deezer       Source = "deezer"
	Odesli       Source = "odesli"
)

// Portee dit pour quelle partie de l'arbre l'appel est emis. Le centre est
// unique et merite la profondeur ; l'entourage compte jusqu'a dix branches et
// trente heritiers, et ne supporte que les sources tolerantes.
type Portee string

const (
	Centre    Portee = "centre"
	Entourage Portee = "entourage"
)

var ErrPorteeInterdite = errors.New(
	"source reservee au centre : appel interdit pour l'entourage")

// Intervalle minimal entre deux appels, par source. C'est la declaration du
// budget N-03 ; la tache 7 la fait respecter.
var intervalle = map[Source]time.Duration{
	MusicBrainz:  time.Second,            // 1/s par adresse IP, la contrainte dure
	CoverArt:     time.Second,            // meme infrastructure, meme prudence
	LastFM:       200 * time.Millisecond, // ~5/s
	ListenBrainz: 200 * time.Millisecond, // meilleur-effort, repli du role 1
	Deezer:       20 * time.Millisecond,  // debit genereux
	Odesli:       time.Second,            // limite non documentee : prudence
}

// Sources dont le debit est trop contraint pour supporter l'entourage.
var centreSeulement = map[Source]bool{
	MusicBrainz: true,
	CoverArt:    true,
}

type Limiteur struct{}

// Neuf construit un limiteur. Il y en a exactement un par processus : deux
// limiteurs se partageraient le meme quota sans le savoir.
func Neuf() *Limiteur {
	return &Limiteur{}
}

// Attendre bloque jusqu'a ce que l'appel soit autorise par le debit de la
// source, ou refuse immediatement si la portee est interdite.
func (l *Limiteur) Attendre(ctx context.Context, s Source, p Portee) error {
	if _, connue := intervalle[s]; !connue {
		return fmt.Errorf("source inconnue : %q", s)
	}
	if centreSeulement[s] && p == Entourage {
		return ErrPorteeInterdite
	}
	return nil
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -race -count=1 -v
```

Attendu : PASS — `--- PASS: TestPorteesAutoriseesEtInterdites`,
`--- PASS: TestSourceInconnueEstRefusee`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/budget && \
git commit -m "ramure-v2 : reserver les sources contraintes au centre"
```

---

### Tâche 7 : espacer réellement les appels, et respecter l'annulation

La portée refusée protège du gros gaspillage ; l'espacement protège du reste.
MusicBrainz bloque l'adresse IP au-delà d'un appel par seconde — et cette adresse
est **partagée par tous les utilisateurs**, puisqu'ils sortent tous par le
serveur (§09). Le créneau est réservé sous verrou avant l'attente : deux
goroutines ne peuvent pas obtenir le même.

L'annulation est le pendant obligatoire : quand l'utilisateur enchaîne les
promotions, le chargement abandonné ne doit pas continuer à consommer des
créneaux pour un centre que plus personne ne regarde (§09, *« les réponses
tardives sont ignorées, pas appliquées »*).

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/budget/limiteur.go`
- Test : `apps/ramure-v2/internal/budget/espacement_test.go`

**Interfaces :**
- Consomme : `budget.Neuf`, `(*budget.Limiteur).Attendre` (tâche 6).
- Produit : aucune signature nouvelle. Deux garanties de plus sur `Attendre` —
  deux appels autorisés d'une même source sont séparés d'au moins son
  intervalle ; un contexte échu interrompt l'attente et renvoie `ctx.Err()`.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/budget/espacement_test.go
package budget

import (
	"context"
	"errors"
	"testing"
	"time"
)

// La contrainte dure de N-13 : 1 appel par seconde et par adresse IP, partagee
// par tous les utilisateurs. Trois appels tiennent donc en 2 s au minimum — le
// premier passe sans attendre, les deux suivants attendent chacun leur tour.
func TestMusicBrainzEspaceLesAppelsAUneParSeconde(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	debut := time.Now()
	for i := 0; i < 3; i++ {
		if err := l.Attendre(ctx, MusicBrainz, Centre); err != nil {
			t.Fatalf("attente %d : %v", i, err)
		}
	}
	ecoule := time.Since(debut)

	if ecoule < 1900*time.Millisecond {
		t.Fatalf("3 appels en %v, attendu au moins 1,9 s : le debit n'est pas respecte", ecoule)
	}
	if ecoule > 3*time.Second {
		t.Fatalf("3 appels en %v, attendu moins de 3 s : l'attente est comptee deux fois", ecoule)
	}
}

// L'entourage est servi par les sources tolerantes : si Deezer etait bride
// comme MusicBrainz, dix branches couteraient dix secondes et N-01 tomberait.
func TestDeezerNEstPasBrideCommeMusicBrainz(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	debut := time.Now()
	for i := 0; i < 5; i++ {
		if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
			t.Fatalf("attente %d : %v", i, err)
		}
	}
	ecoule := time.Since(debut)

	if ecoule > 300*time.Millisecond {
		t.Fatalf("5 appels Deezer en %v, attendu moins de 300 ms", ecoule)
	}
}

// §09 : « les reponses tardives sont ignorees, pas appliquees ». Un chargement
// abandonne ne doit pas rester bloque dans la file d'attente.
func TestContexteAnnuleInterromptLAttente(t *testing.T) {
	l := Neuf()
	if err := l.Attendre(context.Background(), MusicBrainz, Centre); err != nil {
		t.Fatalf("premier appel : %v", err)
	}

	ctxCourt, annuler := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer annuler()

	debut := time.Now()
	err := l.Attendre(ctxCourt, MusicBrainz, Centre)
	ecoule := time.Since(debut)

	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, attendu context.DeadlineExceeded", err)
	}
	if ecoule > 500*time.Millisecond {
		t.Fatalf("l'attente a dure %v apres echeance : l'annulation n'est pas ecoutee", ecoule)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -run 'TestMusicBrainzEspaceLesAppelsAUneParSeconde|TestContexteAnnuleInterromptLAttente' -v
```

Attendu : ÉCHEC — `3 appels en 4.1µs, attendu au moins 1,9 s : le debit n'est
pas respecte`, puis `err = <nil>, attendu context.DeadlineExceeded`. La durée
exacte varie ; elle est de l'ordre de la microseconde.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/budget/limiteur.go — remplace Limiteur, Neuf et
// Attendre ; les constantes, la table intervalle et centreSeulement ne bougent
// pas. Ajouter "sync" aux imports.

// file porte le prochain creneau libre d'une source. Le creneau est reserve
// sous verrou avant l'attente : deux goroutines ne peuvent pas obtenir le meme,
// et l'espacement tient donc aussi sous concurrence.
type file struct {
	mu       sync.Mutex
	prochain time.Time
}

type Limiteur struct {
	files map[Source]*file
}

// Neuf construit un limiteur. Il y en a exactement un par processus : deux
// limiteurs se partageraient le meme quota sans le savoir. La table est
// entierement construite ici, donc jamais ecrite ensuite : sa lecture
// concurrente est sure.
func Neuf() *Limiteur {
	l := &Limiteur{files: make(map[Source]*file, len(intervalle))}
	for s := range intervalle {
		l.files[s] = &file{}
	}
	return l
}

func (l *Limiteur) Attendre(ctx context.Context, s Source, p Portee) error {
	f, connue := l.files[s]
	if !connue {
		return fmt.Errorf("source inconnue : %q", s)
	}
	if centreSeulement[s] && p == Entourage {
		return ErrPorteeInterdite
	}

	f.mu.Lock()
	maintenant := time.Now()
	creneau := f.prochain
	if creneau.Before(maintenant) {
		creneau = maintenant
	}
	f.prochain = creneau.Add(intervalle[s])
	f.mu.Unlock()

	// Un creneau reserve puis abandonne n'est pas rendu : le rendre supposerait
	// de reordonner la file, et une seconde perdue vaut mieux qu'un depassement
	// de quota qui bloque l'adresse IP du serveur pour tout le monde.
	if attente := time.Until(creneau); attente > 0 {
		minuteur := time.NewTimer(attente)
		defer minuteur.Stop()
		select {
		case <-minuteur.C:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -race -count=1 -v
```

Attendu : PASS — cinq tests, dont
`--- PASS: TestMusicBrainzEspaceLesAppelsAUneParSeconde` (environ 2,0 s),
`--- PASS: TestDeezerNEstPasBrideCommeMusicBrainz`,
`--- PASS: TestContexteAnnuleInterromptLAttente`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/budget && \
git commit -m "ramure-v2 : espacer les appels par source et respecter l'annulation"
```

---

### Tâche 8 : compter les appels par source

N-03 exige un coût *« borné **et documenté** en nombre d'appels par source »*.
Le compteur est ce qui rend l'invariant vérifiable, et c'est lui que le PRP 04
interrogera pour prouver, sur un chargement de centre complet, qu'aucun appel
MusicBrainz ni Cover Art Archive n'est parti pour une branche ou un héritier.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/budget/limiteur.go`
- Test : `apps/ramure-v2/internal/budget/comptage_test.go`

**Interfaces :**
- Consomme : `budget.Neuf`, `(*budget.Limiteur).Attendre` (tâches 6 et 7).
- Produit :
  ```go
  func (l *Limiteur) Compte(s Source) int64
  ```
  Ne comptent que les appels **autorisés** : ni une portée refusée, ni une
  attente interrompue, ni une source inconnue n'incrémentent le compteur.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/budget/comptage_test.go
package budget

import (
	"context"
	"sync"
	"testing"
)

func TestComptageParSource(t *testing.T) {
	l := Neuf()
	ctx := context.Background()

	if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
		t.Fatalf("Deezer 1 : %v", err)
	}
	if err := l.Attendre(ctx, Deezer, Entourage); err != nil {
		t.Fatalf("Deezer 2 : %v", err)
	}
	if err := l.Attendre(ctx, LastFM, Centre); err != nil {
		t.Fatalf("LastFM : %v", err)
	}

	if n := l.Compte(Deezer); n != 2 {
		t.Errorf("Compte(Deezer) = %d, attendu 2", n)
	}
	if n := l.Compte(LastFM); n != 1 {
		t.Errorf("Compte(LastFM) = %d, attendu 1", n)
	}
	if n := l.Compte(MusicBrainz); n != 0 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 0", n)
	}
	if n := l.Compte(Source("spotify")); n != 0 {
		t.Errorf("Compte(source inconnue) = %d, attendu 0", n)
	}
}

// C'est l'assertion que le PRP 04 reprendra sur un centre complet : un appel
// refuse pour cause de portee n'a pas eu lieu, et ne doit donc rien couter.
func TestUnAppelRefusePourPorteeNeComptePas(t *testing.T) {
	l := Neuf()
	_ = l.Attendre(context.Background(), MusicBrainz, Entourage)
	_ = l.Attendre(context.Background(), CoverArt, Entourage)

	if n := l.Compte(MusicBrainz); n != 0 {
		t.Errorf("Compte(MusicBrainz) = %d, attendu 0", n)
	}
	if n := l.Compte(CoverArt); n != 0 {
		t.Errorf("Compte(CoverArt) = %d, attendu 0", n)
	}
}

func TestComptageSousConcurrence(t *testing.T) {
	l := Neuf()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = l.Attendre(context.Background(), Deezer, Entourage)
		}()
	}
	wg.Wait()

	if n := l.Compte(Deezer); n != 20 {
		t.Fatalf("Compte(Deezer) = %d, attendu 20", n)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -run Comptage -v
```

Attendu : ÉCHEC de compilation —
`l.Compte undefined (type *Limiteur has no field or method Compte)`.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/budget/limiteur.go — ajouts. Ajouter "sync/atomic"
// aux imports.

type Limiteur struct {
	files   map[Source]*file
	comptes map[Source]*atomic.Int64
}

func Neuf() *Limiteur {
	l := &Limiteur{
		files:   make(map[Source]*file, len(intervalle)),
		comptes: make(map[Source]*atomic.Int64, len(intervalle)),
	}
	for s := range intervalle {
		l.files[s] = &file{}
		l.comptes[s] = &atomic.Int64{}
	}
	return l
}
```

Puis, dans `Attendre`, remplacer le `return nil` final par l'incrément :

```go
	if attente := time.Until(creneau); attente > 0 {
		minuteur := time.NewTimer(attente)
		defer minuteur.Stop()
		select {
		case <-minuteur.C:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	// Seuls les appels reellement autorises sont comptes : une portee refusee
	// ou une attente interrompue n'a produit aucun trafic.
	l.comptes[s].Add(1)
	return nil
```

Et ajouter l'accesseur :

```go
// Compte rend le nombre d'appels autorises pour une source depuis la
// construction du limiteur. Une source hors nomenclature vaut 0.
func (l *Limiteur) Compte(s Source) int64 {
	if c, connue := l.comptes[s]; connue {
		return c.Load()
	}
	return 0
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/budget/ -race -count=1 -v
```

Attendu : PASS — huit tests du paquet `budget`, aucun `WARNING: DATA RACE`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/budget && \
git commit -m "ramure-v2 : compter les appels par source"
```

---

### Tâche 9 : normaliser les noms d'artistes

Premier des trois morceaux de la règle d'intégrité §09. La normalisation est ce
qui rend deux écritures d'un même nom comparables — et **rien d'autre** : elle ne
rapproche pas, elle ne devine pas. `Sigur Rós` et `sigur ros` désignent le même
artiste ; `Bush` et `Kate Bush` restent deux chaînes différentes, et c'est
précisément ce qu'on veut.

Elle sert aussi de fabrique de clés de cache : sans elle, deux utilisateurs
tapant le même nom avec et sans accent produiraient deux entrées, deux vols et
deux appels externes — le taux de service de la tâche 4 s'effondrerait sans que
personne ne comprenne pourquoi.

**Fichiers :**
- Créer : `apps/ramure-v2/internal/source/strict.go`
- Modifier : `apps/ramure-v2/go.mod`, `apps/ramure-v2/go.sum`
- Test : `apps/ramure-v2/internal/source/normalisation_test.go`

**Interfaces :**
- Consomme : le module `github.com/billbob-space/hello-world/apps/ramure-v2`
  (PRP 01).
- Produit :
  ```go
  func Normaliser(s string) string
  ```

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/source/normalisation_test.go
package source

import "testing"

func TestNormalisationIgnoreCasseAccentsEtPonctuation(t *testing.T) {
	cas := []struct {
		entree, attendu string
	}{
		{"Sigur Rós", "sigur ros"},
		{"MÚM", "mum"},
		{"Godspeed You! Black Emperor", "godspeed you black emperor"},
		{"  Air   ", "air"},
		{"Anne-Marie", "anne marie"},
		{"Motörhead", "motorhead"},
		{"Beyoncé", "beyonce"},
		{"AC/DC", "ac dc"},
		{"Sum 41", "sum 41"},
		{"portishead", "portishead"},
		{"", ""},
		// Un nom entierement ponctue se normalise en chaine vide : le groupe
		// « !!! » n'est pas resoluble par correspondance stricte. Limitation
		// assumee, connue, et testee plutot que decouverte en production.
		{"!!!", ""},
	}

	for _, c := range cas {
		if got := Normaliser(c.entree); got != c.attendu {
			t.Errorf("Normaliser(%q) = %q, attendu %q", c.entree, got, c.attendu)
		}
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -v
```

Attendu : ÉCHEC de compilation —
`internal/source/normalisation_test.go:8:14: undefined: Normaliser`.

- [ ] **Étape 3 : implémenter**

Ajouter d'abord la dépendance qui retire les diacritiques, **à version
épinglée** :

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go get golang.org/x/text@v0.32.0 && go mod tidy && grep '^go ' go.mod
```

> **Pourquoi épingler, et pourquoi ce `grep`.** `go get golang.org/x/text` sans
> version prend la dernière — et les versions à partir de `v0.36.0` exigent
> `go 1.25`, ce que `go get` applique en **relevant silencieusement la directive
> `go` de `go.mod`**. L'étage de construction du `Dockerfile` écrit au PRP 01
> (`golang:1.23-alpine`) refuserait alors le module, et l'échec n'apparaîtrait
> qu'à la construction de l'image, plusieurs tâches plus loin, sans rapport
> visible avec cette commande. `v0.32.0` laisse la directive à `go 1.24.0`. Le
> `grep` est là pour le voir tout de suite : si la ligne affichée dépasse la
> version de l'image de construction, changez l'un ou l'autre — jamais l'un sans
> l'autre. `go get` ajoute aussi une ligne `toolchain` : c'est normal, elle
> n'impose rien à l'image de construction tant que la directive `go` est
> tenable.
>
> Si l'espace de travail de la racine (`go.work`, généré par `./init.sh`) gêne
> la résolution, `GOWORK=off go get golang.org/x/text@v0.32.0` fait le même
> travail sur le seul module de l'app.

```go
// apps/ramure-v2/internal/source/strict.go
// Correspondance stricte des noms — regle d'integrite du PRD §09.
//
// « Si aucun resultat ne correspond exactement au nom demande, renvoyer un
// resultat vide plutot que le premier candidat approchant. » Cette regle prime
// sur le taux de couverture : mieux vaut un artiste introuvable qu'un artiste
// faux. Un mauvais appariement contamine tout un sous-arbre et detruit la
// confiance sans jamais lever d'erreur — l'utilisateur voit s'afficher la
// discographie d'un artiste qu'il n'a pas demande.
package source

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// Normaliser rend deux ecritures d'un meme nom comparables : casse, accents,
// ponctuation et espaces multiples sont neutralises. Rien d'autre — aucune
// suppression d'article, aucune troncature, aucune approximation. La forme
// produite sert aussi de clef de cache : deux utilisateurs tapant « Sigur Ros »
// et « Sigur Rós » doivent partager la meme entree (N-04).
func Normaliser(s string) string {
	sansAccents, _, err := transform.String(
		transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC), s)
	if err != nil {
		sansAccents = s
	}

	var b strings.Builder
	precedentEspace := true // evite un espace en tete
	for _, r := range strings.ToLower(sansAccents) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			precedentEspace = false
		default:
			if !precedentEspace {
				b.WriteRune(' ')
				precedentEspace = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -race -count=1 -v && \
go list -m golang.org/x/text
```

Attendu : PASS — `--- PASS: TestNormalisationIgnoreCasseAccentsEtPonctuation`,
puis `golang.org/x/text v0.32.0` — sans la mention `// indirect`, que
`go mod tidy` retire dès lors que `strict.go` importe réellement le paquet.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && \
git add apps/ramure-v2/internal/source apps/ramure-v2/go.mod apps/ramure-v2/go.sum && \
git commit -m "ramure-v2 : normaliser les noms d'artistes"
```

---

### Tâche 10 : n'accepter qu'une correspondance exacte

Le cœur de la mitigation du risque « homonymes d'artistes », coté gravité
**élevée** au §14. La fonction est générique parce qu'elle s'appliquera à des
listes de types différents — candidats MusicBrainz au PRP 03, voisins Last.fm,
fiches Deezer — sans que chacun ait à réécrire la règle, donc sans qu'aucun
puisse l'assouplir localement.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/source/strict.go`
- Test : `apps/ramure-v2/internal/source/correspondance_test.go`

**Interfaces :**
- Consomme : `source.Normaliser` (tâche 9).
- Produit :
  ```go
  func CorrespondanceStricte[T any](demande string, candidats []T,
      nom func(T) string) (T, bool)
  ```

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/source/correspondance_test.go
package source

import "testing"

type candidat struct {
	nom  string
	mbid string
}

func nomDuCandidat(c candidat) string { return c.nom }

// §09 : « renvoyer un resultat vide plutot que le premier candidat
// approchant ». MusicBrainz repond « Kate Bush » avec un score de 100 a une
// requete « Bush » : le score de la source ne suffit jamais.
func TestPasDeCorrespondanceApprochante(t *testing.T) {
	candidats := []candidat{
		{"Kate Bush", "4b585938-f271-45e2-b19a-91c634b5e396"},
		{"Bush Tetras", "a2b1a4c9-5e3f-4d76-9b2c-1f0c2b3d4e5f"},
	}

	c, ok := CorrespondanceStricte("Bush", candidats, nomDuCandidat)

	if ok {
		t.Fatalf("candidat approchant accepte (%+v) : contamination par homonyme", c)
	}
	if c.nom != "" || c.mbid != "" {
		t.Fatalf("c = %+v, attendu la valeur nulle du type", c)
	}
}

func TestCorrespondanceExacteAcceptee(t *testing.T) {
	candidats := []candidat{
		{"Kate Bush", "4b585938-f271-45e2-b19a-91c634b5e396"},
		{"Bush", "24f1766e-9635-4d58-a4d4-9413f9f98a4c"},
		{"Bush Tetras", "a2b1a4c9-5e3f-4d76-9b2c-1f0c2b3d4e5f"},
	}

	c, ok := CorrespondanceStricte("bush", candidats, nomDuCandidat)

	if !ok {
		t.Fatal("la correspondance exacte doit etre acceptee")
	}
	if c.nom != "Bush" {
		t.Fatalf("nom = %q, attendu \"Bush\"", c.nom)
	}
	if c.mbid != "24f1766e-9635-4d58-a4d4-9413f9f98a4c" {
		t.Fatalf("mbid = %q : le candidat rendu n'est pas le bon", c.mbid)
	}
}

func TestCorrespondanceInsensibleAuxAccents(t *testing.T) {
	candidats := []candidat{{"Sigur Rós", "f4a31f0a-51dd-4fa7-986d-3095c40c5ed9"}}

	c, ok := CorrespondanceStricte("sigur ros", candidats, nomDuCandidat)

	if !ok {
		t.Fatal("la variante sans accent doit correspondre")
	}
	if c.mbid != "f4a31f0a-51dd-4fa7-986d-3095c40c5ed9" {
		t.Fatalf("mbid = %q", c.mbid)
	}
}

func TestCorrespondanceSurListeOuDemandeVide(t *testing.T) {
	if _, ok := CorrespondanceStricte("Portishead", []candidat{}, nomDuCandidat); ok {
		t.Error("liste vide : aucune correspondance possible")
	}
	if _, ok := CorrespondanceStricte("", []candidat{{"Portishead", "x"}}, nomDuCandidat); ok {
		t.Error("demande vide : aucune correspondance possible")
	}
	// « !!! » se normalise en chaine vide : refuse, comme une demande vide.
	if _, ok := CorrespondanceStricte("!!!", []candidat{{"!!!", "x"}}, nomDuCandidat); ok {
		t.Error("nom entierement ponctue : refuse plutot qu'apparie au hasard")
	}
}

// La regle sert plusieurs types de la serie : voisins Last.fm, fiches Deezer,
// candidats MusicBrainz. Aucun ne doit reecrire — donc pouvoir assouplir — la
// comparaison.
func TestCorrespondanceStricteEstGenerique(t *testing.T) {
	type voisin struct {
		Nom      string
		Affinite float64
	}
	vivier := []voisin{{"Massive Attack", 0.91}, {"Tricky", 0.87}}

	v, ok := CorrespondanceStricte("tricky", vivier, func(v voisin) string { return v.Nom })

	if !ok {
		t.Fatal("correspondance attendue")
	}
	if v.Affinite != 0.87 {
		t.Fatalf("affinite = %v, attendu 0.87", v.Affinite)
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -v
```

Attendu : ÉCHEC de compilation —
`internal/source/correspondance_test.go:18:11: undefined: CorrespondanceStricte`
(la compilation du paquet de test échoue en bloc, le test de normalisation ne
s'exécute donc pas non plus).

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/source/strict.go — ajout

// CorrespondanceStricte rend le premier candidat dont le nom, une fois
// normalise, est identique a la demande normalisee. A defaut : la valeur nulle
// du type et false — jamais le candidat le plus proche, jamais le premier de la
// liste, quel que soit le score renvoye par la source (§09).
//
// L'ordre de la liste est respecte : une source qui classe ses candidats par
// pertinence garde le benefice de son classement entre plusieurs homonymes
// exacts, mais ne peut pas imposer un candidat approchant.
func CorrespondanceStricte[T any](demande string, candidats []T,
	nom func(T) string) (T, bool) {

	var vide T
	cible := Normaliser(demande)
	if cible == "" {
		return vide, false
	}
	for _, c := range candidats {
		if Normaliser(nom(c)) == cible {
			return c, true
		}
	}
	return vide, false
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -race -count=1 -v
```

Attendu : PASS — six tests, dont `--- PASS: TestPasDeCorrespondanceApprochante`
et `--- PASS: TestCorrespondanceStricteEstGenerique`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/source && \
git commit -m "ramure-v2 : n'accepter qu'une correspondance exacte de nom"
```

---

### Tâche 11 : borner la correction orthographique

Porte F-03 et la seconde règle d'intégrité du §09 : *« une correction de nom doit
rester plausible. Le rattrapage orthographique ne doit jamais substituer un
artiste à un autre : la correction est bornée en écart et refusée en cas de
doute. »*

La borne est **double, et c'est une conjonction** : distance de Levenshtein ≤ 2
**et** ≤ 25 % de la longueur du nom demandé. La première seule laisserait passer
`air` → `Hair` ; la seconde seule laisserait passer trois fautes sur un nom long.
La tâche 10 refuse tout ce qui n'est pas exact ; celle-ci rouvre une porte, et
mesure exactement de combien.

**Fichiers :**
- Modifier : `apps/ramure-v2/internal/source/strict.go`
- Test : `apps/ramure-v2/internal/source/correction_test.go`

**Interfaces :**
- Consomme : `source.Normaliser` (tâche 9).
- Produit :
  ```go
  func CorrectionPlausible(demande, propose string) bool
  ```
  Le PRP 06 s'en sert pour proposer la forme correcte sans que l'utilisateur
  retape ; il ne replante **jamais** une proposition que cette fonction refuse.

- [ ] **Étape 1 : écrire le test qui échoue**

```go
// apps/ramure-v2/internal/source/correction_test.go
package source

import "testing"

func TestCorrectionPlausibleBornee(t *testing.T) {
	cas := []struct {
		demande, propose string
		attendu          bool
		pourquoi         string
	}{
		{"portished", "Portishead", true, "une lettre manquante sur un nom de 9"},
		{"radiohaed", "Radiohead", true, "deux lettres interverties sur un nom de 9"},
		{"boards of canada", "Boards of Canada", true, "casse seule"},
		{"sigur ros", "Sigur Rós", true, "accents seuls"},
		{"the beatles", "The Beetles", true, "une lettre sur un nom de 11"},
		{"muse", "Motorhead", false, "artiste different, pas une faute de frappe"},
		{"air", "Hair", false, "nom court : un caractere d'ecart change l'artiste"},
		{"u2", "U21", false, "nom tres court : aucune correction possible"},
		{"kate bush", "Bush", false, "cinq caracteres d'ecart : autre artiste"},
		{"godspeed you black emperor", "godspeed you black emperorxyz", false,
			"trois caracteres d'ecart : refuse malgre la longueur"},
		{"", "Portishead", false, "demande vide"},
		{"Portishead", "", false, "proposition vide"},
	}

	for _, c := range cas {
		if got := CorrectionPlausible(c.demande, c.propose); got != c.attendu {
			t.Errorf("CorrectionPlausible(%q, %q) = %v, attendu %v (%s)",
				c.demande, c.propose, got, c.attendu, c.pourquoi)
		}
	}
}
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -run TestCorrectionPlausibleBornee -v
```

Attendu : ÉCHEC de compilation —
`internal/source/correction_test.go:26:14: undefined: CorrectionPlausible`.

- [ ] **Étape 3 : implémenter**

```go
// apps/ramure-v2/internal/source/strict.go — ajout

// CorrectionPlausible borne le rattrapage orthographique de F-03. La correction
// n'est acceptee que si elle satisfait les deux bornes a la fois :
//
//   - au plus 2 caracteres d'ecart, quelle que soit la longueur ;
//   - au plus 25 % de la longueur du nom demande.
//
// La premiere borne seule accepterait « air » -> « Hair » ; la seconde seule
// accepterait trois fautes sur un nom long. Sur un nom court, un seul caractere
// d'ecart designe deja un autre artiste : c'est exactement le cas que la
// seconde borne ferme.
func CorrectionPlausible(demande, propose string) bool {
	a, b := Normaliser(demande), Normaliser(propose)
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true // casse, accents ou ponctuation : ce n'est pas une correction
	}
	ecart := levenshtein(a, b)
	if ecart > 2 {
		return false
	}
	return float64(ecart) <= 0.25*float64(len([]rune(a)))
}

// levenshtein rend la distance d'edition entre deux chaines deja normalisees.
// Deux lignes suffisent : seule la ligne precedente sert au calcul de la
// courante.
func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	precedente := make([]int, len(rb)+1)
	courante := make([]int, len(rb)+1)
	for j := range precedente {
		precedente[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		courante[0] = i
		for j := 1; j <= len(rb); j++ {
			cout := 1
			if ra[i-1] == rb[j-1] {
				cout = 0
			}
			courante[j] = min(courante[j-1]+1, precedente[j]+1, precedente[j-1]+cout)
		}
		precedente, courante = courante, precedente
	}
	return precedente[len(rb)]
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go test ./internal/source/ -race -count=1 -v
```

Attendu : PASS — sept tests du paquet `source`, dont
`--- PASS: TestCorrectionPlausibleBornee`.

- [ ] **Étape 5 : commit**

```bash
cd /home/user/hello-world && git add apps/ramure-v2/internal/source && \
git commit -m "ramure-v2 : borner la correction orthographique"
```

---

## Vérification de l'étape

Les quatre commandes ci-dessous, dans cet ordre, prouvent que l'étape est finie.
Aucune ne touche le réseau.

**1 · La suite complète passe, sous détecteur de concurrence.**

```bash
cd /home/user/hello-world/apps/ramure-v2 && go vet ./... && go test -race -count=1 ./...
```

Attendu :

```
ok  	github.com/billbob-space/hello-world/apps/ramure-v2
ok  	github.com/billbob-space/hello-world/apps/ramure-v2/internal/budget
ok  	github.com/billbob-space/hello-world/apps/ramure-v2/internal/cache
ok  	github.com/billbob-space/hello-world/apps/ramure-v2/internal/source
```

Aucune ligne `WARNING: DATA RACE`. L'ensemble tourne en moins de dix secondes,
dont environ deux secondes d'espacement MusicBrainz volontaire.

**2 · Le décompte des tests est celui attendu — 26 fonctions.**

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test -race -count=1 -v ./internal/... | grep -c '^--- PASS'
```

Attendu : `26` — 11 dans `cache`, 8 dans `budget`, 7 dans `source`. Un nombre
inférieur signale une tâche non terminée ; c'est ce chiffre que le PRP 09
reprendra dans `web/tests/REFERENCE.md`.

**3 · Aucun test ne sort sur le réseau** (PRD §13 : *« tester contre des sources
réelles produit des échecs intermittents qui finissent par être ignorés »*).

```bash
cd /home/user/hello-world && \
! grep -rn 'https\?://' apps/ramure-v2/internal --include='*_test.go'
```

Attendu : la commande réussit — aucune adresse HTTP dans les tests de l'étape.

**4 · Le contrat de la fabrique et le contrat de test de l'app tiennent.**

```bash
cd /home/user/hello-world && ./init.sh --check && ./apps/ramure-v2/test.sh
```

Attendu : `./init.sh --check` sans erreur (le compose n'a pas bougé : cette étape
n'ajoute ni route, ni port, ni variable d'environnement), puis `test.sh` se
termine sans erreur — c'est exactement ce que la CI exécutera.

**5 · Le journal des commits raconte l'étape.**

```bash
cd /home/user/hello-world && git log --oneline -11
```

Attendu : onze commits préfixés `ramure-v2 : `, du plus récent au plus ancien —
`borner la correction orthographique` … `memoriser les reponses des sources cote
serveur`.

---

## Ce que la suite attend de vous

**Le PRP 03 consomme les trois paquets et rien d'autre de cette étape.** Les
signatures sont figées ; toute divergence casse neuf documents rédigés en
parallèle.

```go
cache.Neuf(horloge func() time.Time) *Cache
(*cache.Cache).Obtenir(cle string, ttl time.Duration, charger func() ([]byte, error)) ([]byte, error)
(*cache.Cache).TauxDeService() (succes, total int64)

budget.Neuf() *Limiteur
(*budget.Limiteur).Attendre(ctx context.Context, s budget.Source, p budget.Portee) error
(*budget.Limiteur).Compte(s budget.Source) int64
budget.ErrPorteeInterdite

source.Normaliser(s string) string
source.CorrespondanceStricte[T any](demande string, candidats []T, nom func(T) string) (T, bool)
source.CorrectionPlausible(demande, propose string) bool
```

Six conventions ne sont pas dans les signatures et doivent être tenues par les
appelants — elles sont la raison d'être de cette étape :

1. **Un `Cache` et un `Limiteur` par processus, pas par requête.** Deux
   limiteurs se partageraient le même quota sans le savoir, et l'espacement de
   la tâche 7 ne protégerait plus rien. Ils sont construits une seule fois au
   démarrage — ce câblage appartient au PRP qui introduit le premier
   consommateur, **pas à celui-ci** : cette étape ne modifie pas `main.go` et ne
   change pas la signature de `routes()`.
2. **La portée vient du site d'appel, jamais d'une valeur par défaut.** Un
   adaptateur qui code `budget.Centre` en dur dans sa méthode rend
   `ErrPorteeInterdite` inatteignable et vide N-03 de son sens. Le PRP 04 devra
   pouvoir écrire un test qui compte `Compte(MusicBrainz)` après un chargement
   de centre complet, avec ses dix branches et ses trente héritiers, et trouver
   exactement `2`.
3. **Un résultat vide se signale par une erreur, pas par une valeur.** Le cache
   ne connaît pas la sémantique des octets qu'il transporte : c'est
   l'adaptateur qui doit renvoyer `ErrIntrouvable` — ou toute autre erreur — pour
   qu'un vivier vide ou une pochette absente reste un état transitoire (§09).
   Une réponse `200` au corps vide mise en cache condamne l'artiste jusqu'au
   redémarrage.
4. **La clé de cache est préfixée par la source et bâtie sur `Normaliser`.**
   Forme retenue : `"<source>:<role>:<nom normalise ou mbid>"`, par exemple
   `"musicbrainz:artiste:sigur ros"` ou
   `"lastfm:vivier:portishead"`. Sans préfixe, deux sources se marchent dessus ;
   sans normalisation, `Sigur Rós` et `Sigur Ros` paient deux fois.
5. **Les durées de vie sont choisies par l'appelant, argument par argument**
   (N-04, *« adaptées à la volatilité de chaque donnée »*). Ordres de grandeur
   recommandés, à ajuster à la première mesure : discographie et résolution
   d'artiste **30 jours** — un MBID ne bouge pas ; vivier et profil **7 jours** ;
   illustrations **30 jours** ; liens d'écoute **24 heures**.
6. **`CorrespondanceStricte` s'applique avant tout usage d'un candidat**, y
   compris quand la source renvoie un score de 100. `CorrectionPlausible` ne
   s'utilise **jamais** pour choisir un candidat en silence : elle n'autorise
   qu'une proposition affichée à l'utilisateur (F-03, PRP 06).

**Ce qui reste ouvert pour plus tard, et qui n'est pas un oubli :**

- `TauxDeService` n'est encore exposé nulle part. Le PRP 07 tient l'agrégat de
  mesure (`mesure.Instantane() map[string]any`) : c'est là que le couple
  (succès, total) devient visible, et c'est ce chiffre qui permet de réviser le
  seuil de bascule N-13 — aujourd'hui posé sur une hypothèse de 80 %.
- Le cache ne borne pas sa taille. Volontaire à ce stade : une entrée pèse
  quelques kilo-octets, la limite mémoire du conteneur est déclarée dans
  `app.yml`, et une éviction mal réglée coûterait plus cher en appels externes
  qu'elle ne rapporte en mémoire. Si la mesure montre une croissance
  problématique, l'ajout se fait derrière `Obtenir`, sans changer sa signature.
- Aucun appel HTTP n'existe encore : `httptest.NewServer` apparaît au PRP 03,
  qui branchera ces trois paquets sur des serveurs simulés. Le PRD §13 est
  explicite — aucune source réelle n'est jamais contactée depuis la suite de
  tests.
