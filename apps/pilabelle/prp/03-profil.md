# PRP 03 — Profil : questionnaire, persistance, réglages

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/profil`
> **Dépend de :** 01 (socle, identité, volume), 02 (`NiveauInitial`, types partagés)
> **Débloque :** 04 (jour et séance)
> **Sections du PRD :** §6 item 1, §7.1, §7.5, §11 (identité, rien de sensible)

---

## Objectif

Au premier lancement, elle répond à un petit questionnaire et son profil est
créé, cloisonné par `X-Forwarded-User`, et survit à un redéploiement. Elle
peut ensuite le revoir depuis un écran de réglages séparé, sans jamais
repasser par le questionnaire.

## Ce qui est vérifiable à la fin

- Deux comptes différents (deux valeurs d'en-tête) créent deux fichiers de
  profil distincts sur le volume, jamais l'un sur l'autre.
- Un redémarrage du conteneur (`docker compose restart pilabelle`) ne perd
  aucun profil.
- Modifier les réponses dans les réglages ne touche ni l'historique ni la
  série déjà enregistrés.

## Tâche 1 — Les types du profil et le stockage atomique

```go
// apps/pilabelle/domaine.go (complète les types de PRP 02)
type Reponses struct {
	NiveauDepart string   `json:"niveau_depart"` // "debutante" | "a_deja_pratique"
	Douleurs     []string `json:"douleurs"`      // sous-ensemble du vocabulaire fixe (PRP 02)
	JoursActifs  []string `json:"jours_actifs"`  // sous-ensemble de {lundi..dimanche}
}

type Niveaux struct {
	Ventre  int `json:"ventre"`
	Cuisses int `json:"cuisses"`
}

type FacilesConsecutifs struct {
	Ventre  int `json:"ventre"`
	Cuisses int `json:"cuisses"`
}

type Serie struct {
	Actuelle int `json:"actuelle"`
	Record   int `json:"record"`
}

type Ressenti string

const (
	RessentiFacile    Ressenti = "facile"
	RessentiCorrect   Ressenti = "correct"
	RessentiDifficile Ressenti = "difficile"
)

type HistoriqueEntree struct {
	Date      string   `json:"date"`
	Ressenti  Ressenti `json:"ressenti"`
	Exercices []string `json:"exercices"`
}

type DerniersMessages struct {
	Pique         string `json:"pique"`
	Encouragement string `json:"encouragement"`
	MotDoux       string `json:"mot_doux"`
}

type Profil struct {
	VersionSchema      int                `json:"version_schema"`
	Reponses           Reponses           `json:"reponses"`
	Niveaux            Niveaux            `json:"niveaux"`
	FacilesConsecutifs FacilesConsecutifs `json:"faciles_consecutifs"`
	Serie              Serie              `json:"serie"`
	Historique         []HistoriqueEntree `json:"historique"`
	DerniersMessages   DerniersMessages   `json:"derniers_messages"`
	DefiSemaine        *DefiSemaine       `json:"defi_semaine"` // nil jusqu'a PRP 06
}
```

```go
// apps/pilabelle/stockage.go
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
```

## Tâche 2 — Les routes

```go
// apps/pilabelle/main.go, dans routes()
mux.HandleFunc("GET /api/profil", func(w http.ResponseWriter, r *http.Request) {
	email, err := identite(r)
	if err != nil {
		http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
		return
	}
	p, err := LireProfil(racineProfils, email)
	if errors.Is(err, ErrProfilAbsent) {
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
		http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
		return
	}
	repondreJSON(w, p)
})

mux.HandleFunc("POST /api/profil", func(w http.ResponseWriter, r *http.Request) {
	email, err := identite(r)
	if err != nil {
		http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
		return
	}
	if _, err := LireProfil(racineProfils, email); err == nil {
		http.Error(w, `{"erreur":"profil existe deja"}`, http.StatusConflict)
		return
	}
	var reponses Reponses
	if err := json.NewDecoder(r.Body).Decode(&reponses); err != nil || !reponsesValides(reponses) {
		http.Error(w, `{"erreur":"reponses invalides"}`, http.StatusBadRequest)
		return
	}
	p := Profil{
		VersionSchema: 1,
		Reponses:      reponses,
		Niveaux:       NiveauInitial(reponses),
	}
	if err := EcrireProfil(racineProfils, email, p); err != nil {
		log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
		http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	repondreJSON(w, p)
})

mux.HandleFunc("PUT /api/profil", func(w http.ResponseWriter, r *http.Request) {
	email, err := identite(r)
	if err != nil {
		http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
		return
	}
	p, err := LireProfil(racineProfils, email)
	if errors.Is(err, ErrProfilAbsent) {
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
		return
	}
	var reponses Reponses
	if err := json.NewDecoder(r.Body).Decode(&reponses); err != nil || !reponsesValides(reponses) {
		http.Error(w, `{"erreur":"reponses invalides"}`, http.StatusBadRequest)
		return
	}
	p.Reponses = reponses // PRD §7.5 : jamais retroactif sur niveaux, serie ou historique
	if err := EcrireProfil(racineProfils, email, p); err != nil {
		log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
		http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
		return
	}
	repondreJSON(w, p)
})
```

**`POST` refuse un profil déjà existant (409).** Le questionnaire initial ne
s'exécute qu'une fois ; toute modification ultérieure passe par `PUT`, jamais
en écrasant `Niveaux`, `Serie` ou `Historique` — c'est `reponsesValides` et le
fait que seul `p.Reponses` est réassigné qui le garantissent.

```go
var joursValides = map[string]bool{"lundi": true, "mardi": true, "mercredi": true, "jeudi": true, "vendredi": true, "samedi": true, "dimanche": true}

func reponsesValides(r Reponses) bool {
	if r.NiveauDepart != "debutante" && r.NiveauDepart != "a_deja_pratique" {
		return false
	}
	if len(r.JoursActifs) == 0 {
		return false
	}
	for _, j := range r.JoursActifs {
		if !joursValides[j] {
			return false
		}
	}
	for _, d := range r.Douleurs {
		if !contreIndicationsValides[d] { // PRP 02
			return false
		}
	}
	return true
}
```

## Tâche 3 — Le questionnaire et les réglages, côté écran

`web/vue-questionnaire.js` : trois questions à choix simples, aucun champ
libre (PRD §7.1) — niveau de départ (deux boutons), douleurs (cases à cocher,
huit libellés français mappés sur le vocabulaire fixe de PRP 02), jours actifs
(sept cases, une par jour). `POST /api/profil` à la validation ; en cas de
`409` (profil déjà créé entre-temps, ex. double onglet), on relit simplement
`GET /api/profil` au lieu d'afficher une erreur.

`web/vue-reglages.js` : le même formulaire, préremplit avec `GET /api/profil`,
`PUT` à l'enregistrement. Accessible depuis un lien discret de l'écran du jour
(PRP 04 pose le point d'entrée ; ce PRP fournit l'écran et sa route).

`web/app.js` — l'amorçage minimal de ce PRP :

```js
const profil = await api.lireProfil();
if (profil === null) {
  monter(vueQuestionnaire, { onCree: demarrer });
} else {
  demarrer(); // PRP 04 remplace ce point d'entree par l'ecran du jour
}

function demarrer() {
  document.querySelector('#app').textContent =
    'Profil enregistré. À très vite pour ta première séance !';
}
```

`api.lireProfil()` rend `null` sur un `404`, lève sur toute autre erreur —
c'est la seule branche que ce PRP doit distinguer.

## Périmètre

**Dedans :** `stockage.go`, `stockage_test.go`, les trois routes `/api/profil`,
`vue-questionnaire.js`, `vue-reglages.js`, l'amorçage minimal d'`app.js`.

**Dehors :** l'écran du jour et la séance (PRP 04, qui remplace le message de
confirmation ci-dessus) ; le calcul de `Serie`, `Historique`,
`FacilesConsecutifs` au-delà de leur valeur initiale à zéro (PRP 05, seul
point d'écriture après la création).

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | Deux identités distinctes -> deux fichiers distincts | `stockage_test.go`, deux e-mails de test |
| 2 | `POST` deux fois avec la même identité -> `409` la seconde fois | test route dédié |
| 3 | `PUT` change `Reponses` sans toucher `Niveaux`/`Historique`/`Serie` | test route dédié |
| 4 | Une écriture interrompue (simulateur : tuer le process entre `WriteFile` et `Rename` n'est pas testable directement — vérifier que `Rename` est bien l'ultime étape) | lecture du code, `stockage_test.go` sur le fichier `.tmp` absent après succès |
| 5 | `./init.sh --check` vert, `./apps/pilabelle/test.sh` passe | commandes habituelles |
