// activite.go — combien de monde s'est servi de l'application, et ou ca a
// echoue. Anonyme, agrege par jour, et DURABLE.
//
// Le journal du conteneur ne repond pas a cette question : dockhand recree la
// stack entiere a chaque deploiement, meme pour une app qu'on n'a pas touchee,
// et les lignes d'avant disparaissent. Trois semaines de programme d'ete, une
// dizaine de deploiements : mesurer l'usage sur les journaux, c'est mesurer les
// heures depuis le dernier redemarrage. Les compteurs vivent donc dans le
// volume nomme, a cote du classement, et lui survivent.
//
// Ce fichier ne stocke QUE des entiers, par jour et par evenement. Aucun
// pseudonyme, aucun identifiant d'exercice, aucune adresse, rien qui distingue
// un visiteur d'un autre : il dit combien de fois, jamais par qui. C'est la
// meme promesse que le reste du serveur (PRD §5), tenue par la FORME du fichier
// et pas par une consigne — il n'a aucun champ ou un nom pourrait entrer.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	schemaActivite = 1
	nomActivite    = "activite.json"

	// Le programme dure trois semaines ; on garde large de quoi comparer une
	// saison a la suivante sans jamais laisser le fichier grossir sans borne.
	joursConserves = 400

	// Les compteurs montent en memoire et descendent sur disque au plus une
	// fois par intervalle. C'est la difference entre un compteur et une
	// amplification d'ecriture : /api/classement est une route PUBLIQUE et sans
	// limite de debit, et compter a l'ecriture synchrone donnerait a n'importe
	// qui le moyen de faire ecrire le disque aussi vite qu'il sait demander.
	intervalleEcriture = 30 * time.Second
)

// compteursJour porte une journee. Tous les champs sont des entiers, et c'est
// ce qui rend le fichier anodin : il n'existe aucune place ou ecrire QUI.
type compteursJour struct {
	// Ouvertures compte les chargements de la coque — « / » ou
	// « /index.html ». Un rechargement compte pour un : c'est un nombre
	// d'ouvertures, jamais un nombre de personnes, et le § README le dit.
	Ouvertures int `json:"ouvertures"`
	// Consultations et Coach comptent les lectures des deux tableaux. Un ecran
	// de classement ouvert en rafraichit plusieurs : cet ecart avec Ouvertures
	// est attendu, il ne mesure pas des visiteurs.
	Consultations int `json:"consultations"`
	Coach         int `json:"coach"`
	// Les quatre issues d'un envoi. Inscriptions est la seule qui compte des
	// enfants : une par pseudonyme cree.
	Inscriptions int `json:"inscriptions"`
	Reprises     int `json:"reprises"`
	MisesAJour   int `json:"misesAJour"`
	Suppressions int `json:"suppressions"`
	// EnvoisVides compte les envois acceptes qui ne portaient AUCUN exercice.
	// C'est le compteur qui a motive ce fichier : une fiche a zero coche ne se
	// distingue pas, sur le disque, d'une fiche jamais remplie, et les deux ne
	// demandent pas la meme reponse — l'une est un enfant qui ne s'entraine
	// pas, l'autre un ecran qui n'envoie pas ce qu'il croit envoyer.
	EnvoisVides int `json:"envoisVides"`
	// Ignores totalise les identifiants d'exercice inconnus du programme. Un
	// nombre qui monte veut dire qu'un telephone sert un programme.json perime
	// depuis le cache de son service worker.
	Ignores int `json:"ignores"`
	// Refus compte par CODE d'erreur — « code-refuse », « pseudo-invalide »,
	// « trop-d-essais »… Le code, jamais la valeur refusee : c'est la meme
	// regle que normaliserPseudo, une entree refusee recopiee dans un journal
	// est un point d'injection.
	Refus map[string]int `json:"refus,omitempty"`
}

// vide dit si la journee n'a rien enregistre. Sert a ne pas ecrire une entree
// pour un jour ou seuls des healthz sont passes.
func (c *compteursJour) vide() bool {
	return c.Ouvertures == 0 && c.Consultations == 0 && c.Coach == 0 &&
		c.Inscriptions == 0 && c.Reprises == 0 && c.MisesAJour == 0 &&
		c.Suppressions == 0 && c.EnvoisVides == 0 && c.Ignores == 0 &&
		len(c.Refus) == 0
}

// fichierActivite est la forme sur disque. Meme motif que fichierMagasin : un
// numero de schema pour refuser un fichier futur plutot que de le mal lire.
type fichierActivite struct {
	Schema int                       `json:"schema"`
	Jours  map[string]*compteursJour `json:"jours"`
}

// activite tient les compteurs. Un *activite NIL est un etat valide et
// silencieux : toutes ses methodes l'absorbent. C'est ce qui permet a la mesure
// d'echouer — volume en lecture seule, fichier illisible — sans jamais empecher
// un enfant de s'entrainer. Mesurer l'usage ne vaut pas de casser l'usage.
type activite struct {
	mu      sync.Mutex
	chemin  string
	horloge func() time.Time
	jours   map[string]*compteursJour
	// jour retient la journee en cours pour reperer le passage a la suivante :
	// c'est la qu'on ecrit le total de la veille dans le journal du conteneur,
	// une ligne par jour, lisible sans ouvrir le fichier.
	jour string
	sale bool
}

// ouvrirActivite relit le fichier s'il existe et rend le compteur pret.
//
// Un fichier absent est le cas normal du premier demarrage. Un fichier ILLISIBLE
// remonte une erreur plutot que d'etre efface : ecraser une mesure qu'on ne sait
// pas relire, c'est perdre en silence la seule trace durable de l'usage.
func ouvrirActivite(dossier string, horloge func() time.Time) (*activite, error) {
	a := &activite{
		chemin:  filepath.Join(dossier, nomActivite),
		horloge: horloge,
		jours:   map[string]*compteursJour{},
	}

	donnees, err := os.ReadFile(a.chemin)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		// Premier demarrage : on verifie tout de suite qu'on saura ecrire,
		// plutot que de le decouvrir trente secondes plus tard dans une
		// goroutine dont personne ne lit l'erreur.
		a.jour = jourParis(horloge())
		if err := a.ecrire(); err != nil {
			return nil, err
		}
		return a, nil
	case err != nil:
		return nil, err
	}

	var f fichierActivite
	if err := json.Unmarshal(donnees, &f); err != nil || f.Schema != schemaActivite {
		// Meme regle que le classement : on met de cote et on repart vide.
		// Reecrire par-dessus detruirait le seul exemplaire de la mesure ;
		// refuser de compter jusqu'au prochain deploiement arreterait la mesure
		// pour de bon, puisque personne ne surveille ce fichier.
		mis := a.chemin + fmt.Sprintf(".corrompu-%s.json", horloge().UTC().Format(time.RFC3339))
		if err := os.Rename(a.chemin, mis); err != nil {
			return nil, fmt.Errorf("%s illisible et impossible a mettre de cote : %w", a.chemin, err)
		}
		log.Printf("activite : %s illisible, mis de cote en %s, on repart vide", a.chemin, mis)
		a.jour = jourParis(horloge())
		return a, nil
	}
	for jour, c := range f.Jours {
		if c != nil {
			a.jours[jour] = c
		}
	}
	a.jour = jourParis(horloge())
	return a, nil
}

// --- Les evenements -------------------------------------------------------
//
// Un verbe par evenement plutot qu'une methode qui prend un nom d'evenement :
// une faute de frappe est alors une erreur de compilation, la ou une chaine
// aurait compte pendant trois semaines dans une case que personne ne lit.

func (a *activite) ouverture()    { a.ajouter(func(c *compteursJour) { c.Ouvertures++ }) }
func (a *activite) consultation() { a.ajouter(func(c *compteursJour) { c.Consultations++ }) }
func (a *activite) coachLu()      { a.ajouter(func(c *compteursJour) { c.Coach++ }) }
func (a *activite) suppression()  { a.ajouter(func(c *compteursJour) { c.Suppressions++ }) }

// envoi enregistre un envoi accepte : sa nature, ce qu'il portait, et ce que le
// serveur en a ignore.
func (a *activite) envoi(cree, reprise bool, cochees, ignores int) {
	a.ajouter(func(c *compteursJour) {
		switch {
		case cree:
			c.Inscriptions++
		case reprise:
			c.Reprises++
		default:
			c.MisesAJour++
		}
		if cochees == 0 {
			c.EnvoisVides++
		}
		c.Ignores += ignores
	})
}

func (a *activite) refus(code string) {
	a.ajouter(func(c *compteursJour) {
		if c.Refus == nil {
			c.Refus = map[string]int{}
		}
		c.Refus[code]++
	})
}

// ajouter applique une modification a la journee courante. C'est le seul point
// qui prend le verrou, et le seul qui detecte le changement de jour.
func (a *activite) ajouter(f func(*compteursJour)) {
	if a == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	jour := jourParis(a.horloge())
	if jour != a.jour {
		a.tournerLaPage(jour)
	}
	c, ok := a.jours[jour]
	if !ok {
		c = &compteursJour{}
		a.jours[jour] = c
	}
	f(c)
	// L'elagage vient APRES l'insertion. Avant, il laissait passer une journee
	// de plus a chaque changement de date : il ramenait a joursConserves, puis
	// la journee neuve faisait joursConserves + 1, indefiniment.
	a.elaguer()
	a.sale = true
}

// tournerLaPage ecrit le total de la journee qui s'acheve dans le journal du
// conteneur. Une ligne par jour, lisible sans ouvrir le fichier. Appelee sous
// verrou.
func (a *activite) tournerLaPage(nouveau string) {
	if c, ok := a.jours[a.jour]; ok && !c.vide() {
		log.Printf("activite %s : %s", a.jour, resume(c))
	}
	a.jour = nouveau
}

// elaguer borne le fichier. Appelee sous verrou.
func (a *activite) elaguer() {
	if len(a.jours) <= joursConserves {
		return
	}
	dates := make([]string, 0, len(a.jours))
	for jour := range a.jours {
		dates = append(dates, jour)
	}
	// Les dates sont en AAAA-MM-JJ : l'ordre lexicographique EST l'ordre
	// chronologique, et c'est pour ca que jourParis rend cette forme-la.
	slices.Sort(dates)
	for _, jour := range dates[:len(dates)-joursConserves] {
		delete(a.jours, jour)
	}
}

// resume met une journee sur une ligne. Les zeros sont tus : une ligne de
// journal ou quinze compteurs sur dix-huit valent zero cache les trois qui
// disent quelque chose.
func resume(c *compteursJour) string {
	champs := []struct {
		nom string
		val int
	}{
		{"ouvertures", c.Ouvertures},
		{"consultations", c.Consultations},
		{"coach", c.Coach},
		{"inscriptions", c.Inscriptions},
		{"reprises", c.Reprises},
		{"mises a jour", c.MisesAJour},
		{"suppressions", c.Suppressions},
		{"envois vides", c.EnvoisVides},
		{"ignores", c.Ignores},
	}
	morceaux := make([]string, 0, len(champs)+len(c.Refus))
	for _, ch := range champs {
		if ch.val > 0 {
			morceaux = append(morceaux, fmt.Sprintf("%d %s", ch.val, ch.nom))
		}
	}
	codes := make([]string, 0, len(c.Refus))
	for code := range c.Refus {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	for _, code := range codes {
		morceaux = append(morceaux, fmt.Sprintf("%d %s", c.Refus[code], code))
	}
	if len(morceaux) == 0 {
		return "rien"
	}
	return strings.Join(morceaux, ", ")
}

// --- L'ecriture -----------------------------------------------------------

// enregistrer descend les compteurs sur le disque, et seulement s'ils ont
// change depuis la derniere fois.
func (a *activite) enregistrer() {
	if a == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.sale {
		return
	}
	if err := a.ecrire(); err != nil {
		// Un echec d'ecriture ne fait pas tomber l'application : la mesure est
		// perdue, l'entrainement continue. Il laisse une ligne, et « sale »
		// reste vrai pour que la tentative suivante reprenne le meme etat.
		log.Printf("activite : ecriture impossible : %v", err)
		return
	}
	a.sale = false
}

// ecrire serialise l'etat. Appelee sous verrou, ou avant tout trafic.
func (a *activite) ecrire() error {
	f := fichierActivite{Schema: schemaActivite, Jours: map[string]*compteursJour{}}
	for jour, c := range a.jours {
		if !c.vide() {
			f.Jours[jour] = c
		}
	}
	donnees, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return ecrireAtomique(a.chemin, append(donnees, '\n'))
}

// veiller descend les compteurs a intervalle regulier, puis une derniere fois a
// l'arret. C'est cette derniere passe qui fait qu'un redeploiement — l'arret le
// plus frequent, et le seul qui soit propre — ne perd pas la journee en cours.
func (a *activite) veiller(ctx context.Context) {
	if a == nil {
		return
	}
	t := time.NewTicker(intervalleEcriture)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			a.enregistrer()
		case <-ctx.Done():
			a.enregistrer()
			return
		}
	}
}
