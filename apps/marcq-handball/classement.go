// classement.go — le magasin du classement : la liste des participants en
// memoire, relue au demarrage, reecrite atomiquement a chaque modification.
//
// Un fichier JSON, pas une base : la borne haute est de 200 participants sur
// trois semaines, et une base de donnees serait une seconde decision
// d'infrastructure la ou le produit n'en demande qu'une.
//
// Ce fichier ne connait pas HTTP. Il rend des erreurs sentinelles que api.go
// traduit en statut et en code — c'est ce qui rend classement_test.go lisible
// sans httptest, et c'est le decoupage de cadran, ou angles ne connait pas http.
package main

import (
	"crypto/hmac"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

// Les bornes du magasin. Le plafond de participants est la vraie borne de
// croissance de cette API : la seule chose qu'un inconnu peut y creer sans
// limite est un pseudonyme.
const (
	schemaCourant   = 1
	maxParticipants = 200
	maxRunesPseudo  = 16
	minRunesPseudo  = 2
	iterationsPBKDF = 100000
	tailleSel       = 16
	tailleEmpreinte = 32
	maxRefus        = 5
	fenetreRefus    = 15 * time.Minute
	nomFichier      = "classement.json"
)

// Les deux bornes du podium (PRD §9). Une MARCHE est un score, pas un enfant :
// depuis que les ex aequo partagent leur place, trois marches peuvent nommer
// plus de trois personnes — d'ou le second plafond, qui borne les noms d'UNE
// marche. Il vise la liste interminable, pas le nombre total de prenoms : une
// marche courte reste nommee meme sous une marche de tete muette.
const (
	marchesPodium = 3
	nomsPodiumMax = 8
)

// Les erreurs sentinelles. Leur texte EST le code d'erreur de l'API : api.go y
// attache un statut et un message francais, et rien d'autre ne les traduit.
var (
	errPseudoInvalide    = errors.New("pseudo-invalide")
	errCodeInvalide      = errors.New("code-invalide")
	errFaitsInvalide     = errors.New("faits-invalide")
	errRessentisInvalide = errors.New("ressentis-invalide")
	errCodeRefuse        = errors.New("code-refuse")
	errTropDEssais       = errors.New("trop-d-essais")
	errClassementPlein   = errors.New("classement-plein")
	errClassementFige    = errors.New("classement-fige")
)

var codeValide = regexp.MustCompile(`^[0-9]{4}$`)

var ressentisAdmis = map[string]bool{"facile": true, "correct": true, "dur": true}

// participant est une fiche telle qu'elle est stockee. Aucun champ ne peut
// accueillir une donnee nominative : quatre champs de fiche, deux horodatages,
// et deux cartes dont les cles sont des identifiants d'exercice et des dates.
type participant struct {
	// Pseudo est la forme affichee, telle que l'enfant l'a saisie.
	Pseudo string `json:"pseudo"`
	// Cle est le pseudonyme normalise, STOCKE et non recalcule : s'il etait
	// recalcule, changer un jour la regle de normalisation ferait entrer en
	// collision deux participants existants — donc fusionner deux enfants — en
	// silence.
	Cle string `json:"cle"`
	// Sel et Empreinte : le code n'est jamais stocke en clair. Le motif n'est
	// pas qu'il protege quelque chose sur le serveur — il n'y a rien a proteger
	// — mais qu'un ado saisira tres probablement le code de deverrouillage de
	// son telephone. Celui-la protege quelque chose.
	Sel       []byte `json:"sel"`
	Empreinte []byte `json:"empreinte"`
	// Iterations est stocke PAR PARTICIPANT : relever le cout plus tard
	// n'invalide alors aucune fiche existante, on verifie avec le cout inscrit.
	Iterations int `json:"iterations"`
	// Faits associe un identifiant a l'horodatage DU SERVEUR, jamais a celui du
	// client. C'est ce qui rend l'ex aequo du PRD §9 incontestable : le client
	// n'a aucun champ ou poser une date.
	Faits     map[string]string `json:"faits"`
	Ressentis map[string]string `json:"ressentis,omitempty"`
	CreeLe    string            `json:"creeLe"`
	VuLe      string            `json:"vuLe"`
}

// fichierMagasin est la forme sur disque. Le numero de schema permet de refuser
// un fichier ecrit par une version future plutot que de le mal interpreter.
type fichierMagasin struct {
	Schema       int            `json:"schema"`
	Participants []*participant `json:"participants"`
}

// classement tient la liste en memoire et l'ecrit sur disque. Un seul Mutex
// protege les deux : un seul conteneur tourne (container_name interdit le
// second exemplaire), donc aucun verrou inter-processus n'est necessaire.
type classement struct {
	mu      sync.Mutex
	chemin  string
	prog    *Programme
	horloge func() time.Time
	parCle  map[string]*participant
	// refus compte les codes refuses par cle, dans une fenetre glissante. Il
	// vit en MEMOIRE et se perd au redemarrage : le persister demanderait un
	// elagage, et une penalite de quinze minutes annulee par un redeploiement
	// ne met rien en danger.
	refus map[string][]time.Time
}

// ouvrirClassement prepare le magasin. Ses quatre cas sont decrits un a un
// ci-dessous ; aucun ne rend le conteneur malsain, parce que /healthz gouverne
// une application qui, a 95 %, fonctionne hors ligne dans le navigateur.
func ouvrirClassement(dossier string, prog *Programme, horloge func() time.Time) (*classement, error) {
	// Cas 1 — dossier vide : le classement est DESACTIVE, pas en panne. C'est
	// l'interrupteur qui decouple la livraison du code de la mise a disposition
	// du volume : l'app sert alors exactement le lot 1.
	if dossier == "" {
		return nil, nil
	}
	if horloge == nil {
		horloge = time.Now
	}

	// Cas 4 — la sonde d'ecriture. Sans elle, un volume appartenant a root ne
	// se manifesterait qu'au premier envoi d'un enfant, un soir, sous la forme
	// d'un 503 que personne ne relie au montage. Avec elle, la ligne apparait
	// au demarrage, dans les journaux du conteneur, avant tout trafic.
	if err := sonderEcriture(dossier); err != nil {
		return nil, err
	}

	c := &classement{
		chemin:  filepath.Join(dossier, nomFichier),
		prog:    prog,
		horloge: horloge,
		parCle:  make(map[string]*participant),
		refus:   make(map[string][]time.Time),
	}

	donnees, err := os.ReadFile(c.chemin)
	if errors.Is(err, os.ErrNotExist) {
		// Cas 2 — aucun fichier : classement vide, cree au premier envoi.
		// « Demarrage sans intervention » : rien a creer a la main.
		return c, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%s illisible : %w", c.chemin, err)
	}

	var f fichierMagasin
	if err := json.Unmarshal(donnees, &f); err != nil || f.Schema != schemaCourant {
		// Cas 3 — fichier illisible ou schema inconnu. On le met de cote et on
		// repart vide. Reecrire par-dessus detruirait le seul exemplaire ;
		// refuser de demarrer emporterait TOUTE l'application pour une
		// fonction optionnelle.
		mis := c.chemin + fmt.Sprintf(".corrompu-%s.json", horloge().UTC().Format(time.RFC3339))
		if err := os.Rename(c.chemin, mis); err != nil {
			return nil, fmt.Errorf("%s illisible et impossible a mettre de cote : %w", c.chemin, err)
		}
		log.Printf("classement : %s illisible, mis de cote en %s, on repart vide", c.chemin, mis)
		return c, nil
	}

	for _, p := range f.Participants {
		if p.Faits == nil {
			p.Faits = make(map[string]string)
		}
		c.parCle[p.Cle] = p
	}
	log.Printf("classement : %d participant(s) relus depuis %s", len(c.parCle), c.chemin)
	return c, nil
}

// sonderEcriture ecrit puis supprime un fichier temoin. Le montage appartenant
// a root est le mode de panne le plus probable, et le plus silencieux : le
// conteneur tourne en uid 10001, toutes les ecritures echouent avec EACCES,
// /healthz reste vert et l'app sert parfaitement.
func sonderEcriture(dossier string) error {
	temoin := filepath.Join(dossier, ".ecriture-test")
	if err := os.WriteFile(temoin, []byte("ok"), 0o600); err != nil {
		return fmt.Errorf("%s n'est pas inscriptible : %w", dossier, err)
	}
	return os.Remove(temoin)
}

// ecrireAtomique ecrit dans un fichier temporaire du MEME repertoire, force
// l'ecriture sur le disque, renomme, puis force le repertoire.
//
// Le temporaire est voisin de la cible parce que os.Rename n'est atomique que
// dans un systeme de fichiers : un temporaire dans os.TempDir() traverserait le
// point de montage du volume et echouerait sur EXDEV. Le Sync avant le
// renommage evite le cas ou la coupure laisse un fichier de la bonne taille et
// vide de contenu.
func ecrireAtomique(chemin string, donnees []byte) error {
	dossier := filepath.Dir(chemin)
	tmp, err := os.CreateTemp(dossier, "classement-*.tmp")
	if err != nil {
		return err
	}
	nom := tmp.Name()
	// Un echec a n'importe quelle etape supprime le temporaire et remonte
	// l'erreur : le fichier en place n'est jamais touche.
	abandonner := func(e error) error {
		tmp.Close()
		os.Remove(nom)
		return e
	}
	if _, err := tmp.Write(donnees); err != nil {
		return abandonner(err)
	}
	if err := tmp.Sync(); err != nil {
		return abandonner(err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(nom)
		return err
	}
	if err := os.Chmod(nom, 0o600); err != nil {
		os.Remove(nom)
		return err
	}
	if err := os.Rename(nom, chemin); err != nil {
		os.Remove(nom)
		return err
	}
	// Forcer le repertoire : sans cela, le renommage lui-meme peut ne pas avoir
	// atteint le disque au moment de la coupure.
	d, err := os.Open(dossier) // #nosec G304 -- dossier derive de MARCQ_DONNEES, une variable d'environnement posee par l'operateur au demarrage (le montage de volume declare dans app.yml), jamais d'une requete HTTP
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// ecrire serialise l'etat courant. L'ecriture est IMMEDIATE, a chaque envoi
// accepte : une equipe produit quelques dizaines d'envois par jour, et un
// tampon qui n'est vide qu'a l'arret est precisement ce qu'un
// « docker compose up » n'attend pas. L'appelant tient deja le verrou.
func (c *classement) ecrire() error {
	f := fichierMagasin{Schema: schemaCourant, Participants: make([]*participant, 0, len(c.parCle))}
	for _, p := range c.parCle {
		f.Participants = append(f.Participants, p)
	}
	// Ordre stable : un fichier dont les lignes dansent d'une ecriture a
	// l'autre est illisible a la main, et c'est la seule facon de reparer.
	sort.Slice(f.Participants, func(i, j int) bool { return f.Participants[i].Cle < f.Participants[j].Cle })

	donnees, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return ecrireAtomique(c.chemin, append(donnees, '\n'))
}

// --- Le pseudonyme et le code -------------------------------------------

var espacesMultiples = regexp.MustCompile(`\s+`)

// normaliserPseudo rogne, reduit les suites d'espaces a un seul, et valide.
// Elle rend la forme affichee et la cle d'unicite.
//
// Rien de la valeur refusee n'apparait dans l'erreur : un message qui renvoie
// l'entree refusee est un point d'injection dans les journaux.
func normaliserPseudo(brut string) (affiche, cle string, err error) {
	affiche = espacesMultiples.ReplaceAllString(strings.TrimSpace(brut), " ")

	n := 0
	for _, r := range affiche {
		n++
		// Les commandes bidirectionnelles reordonnent l'affichage de la ligne
		// voisine sur une page publique ; les caracteres de largeur nulle
		// permettent deux pseudonymes visuellement identiques ; les marques
		// combinantes (Mn) sont refusees faute de normalisation NFC dans la
		// bibliotheque standard — sans elle, deux ecritures de « Lea » accentue
		// seraient deux participants visuellement identiques.
		if unicode.In(r, unicode.Cc, unicode.Cf, unicode.Co, unicode.Cs, unicode.Mn) {
			return "", "", errPseudoInvalide
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			continue
		}
		if r == ' ' || r == '-' || r == '\'' || r == '_' {
			continue
		}
		return "", "", errPseudoInvalide
	}
	// Compte en RUNES et non en octets, sans quoi « Lea » et « Léa » n'auraient
	// pas la meme limite.
	if n < minRunesPseudo || n > maxRunesPseudo {
		return "", "", errPseudoInvalide
	}
	return affiche, strings.ToLower(affiche), nil
}

func derivierEmpreinte(code string, sel []byte, iterations int) ([]byte, error) {
	return pbkdf2.Key(sha256.New, code, sel, iterations, tailleEmpreinte)
}

// verifierCode compare en temps constant. Une comparaison octet a octet
// donnerait, sur une page publique, un canal de mesure gratuit.
func (p *participant) verifierCode(code string) bool {
	empreinte, err := derivierEmpreinte(code, p.Sel, p.Iterations)
	if err != nil {
		return false
	}
	return hmac.Equal(empreinte, p.Empreinte)
}

// trop dit si ce pseudonyme a epuise ses essais, et elague la fenetre au
// passage. Sans ce compteur, 10 000 possibilites a 50 req/s — la limite du
// palier — sont epuisees en 200 secondes.
func (c *classement) trop(cle string) bool {
	maintenant := c.horloge()
	frais := c.refus[cle][:0:0]
	for _, t := range c.refus[cle] {
		if maintenant.Sub(t) < fenetreRefus {
			frais = append(frais, t)
		}
	}
	if len(frais) == 0 {
		delete(c.refus, cle)
	} else {
		c.refus[cle] = frais
	}
	return len(frais) >= maxRefus
}

func (c *classement) noterRefus(cle string) {
	c.refus[cle] = append(c.refus[cle], c.horloge())
}

// --- La lecture -----------------------------------------------------------

// ligne interne : une fiche et ce qu'elle a coche au jour dit.
type ligneInterne struct {
	p       *participant
	cochees int
	part    float64
}

// classer ordonne les participants par nombre de cases cochees. Il n'y a PLUS
// de second critere : deux enfants au meme score sont ex aequo, et l'ordre qui
// les separe ici n'est qu'un ordre d'affichage. L'appelant tient deja le verrou.
//
// L'heure d'arrivee departageait jusqu'au 2026-08-07, et c'etait une erreur de
// conception : dans une equipe ou la plupart cochent tout, elle ne classait plus
// l'assiduite mais la vitesse a sortir son telephone apres la seance — et elle
// recompensait de cocher AVANT d'avoir fait.
func (c *classement) classer(jour string) (lignes []ligneInterne, programmees int) {
	ids := c.prog.programmes(jour)
	programmees = len(ids)

	for _, p := range c.parCle {
		l := ligneInterne{p: p}
		for id := range p.Faits {
			if !ids[id] {
				continue
			}
			l.cochees++
		}
		if programmees > 0 {
			l.part = arrondi3(float64(l.cochees) / float64(programmees))
		}
		lignes = append(lignes, l)
	}

	sort.Slice(lignes, func(i, j int) bool {
		a, b := lignes[i], lignes[j]
		if a.cochees != b.cochees {
			return a.cochees > b.cochees
		}
		// A egalite, PERSONNE n'est devant : ce qui suit ordonne les prenoms
		// d'une meme marche, et rien d'autre. La cle rend l'ordre total et
		// stable d'un redemarrage a l'autre.
		return a.p.Cle < b.p.Cle
	})
	return lignes, programmees
}

// rangsPartages rend le rang de chaque ligne, la tranche etant deja triee.
//
// On compte les ENFANTS DEVANT, jamais les scores : trois premiers a 100 %,
// puis le suivant est 4e et non 2e. « 2e sur 12 » quand onze sont a egalite
// devant serait faux, et le PRD §9 tient a un denominateur honnete.
func rangsPartages(lignes []ligneInterne) []int {
	rangs := make([]int, len(lignes))
	for i := range lignes {
		if i > 0 && lignes[i].cochees == lignes[i-1].cochees {
			rangs[i] = rangs[i-1]
			continue
		}
		rangs[i] = i + 1
	}
	return rangs
}

// nomsDuPodium dit, ligne par ligne, si son pseudonyme part vers le client.
//
// Trois marches au plus, et CHAQUE MARCHE est jugee seule : celle qui depasse le
// plafond se tait, les autres nomment. Une marche muette n'est pas vide — le
// client en connait l'effectif par le nombre de lignes qui portent son rang, et
// affiche « 14 enfants ».
//
// Le plafond existe parce que la page est PUBLIQUE : quatorze pseudonymes de
// mineurs n'ont pas a y etre epeles pour dire une chose qu'un nombre dit mieux.
// Il a d'abord borne le podium ENTIER, en faisant taire les marches sous une
// marche trop grosse ; a l'ecran, cela cachait le prenom d'enfants SEULS sur
// leur marche, ce qui ne protege rien et perd une information.
func nomsDuPodium(lignes []ligneInterne, rangs []int) []bool {
	nommes := make([]bool, len(lignes))
	marches := 0
	for i := 0; i < len(lignes); {
		fin := i
		for fin < len(lignes) && rangs[fin] == rangs[i] {
			fin++
		}
		marches++
		if marches > marchesPodium {
			break
		}
		if fin-i <= nomsPodiumMax {
			for k := i; k < fin; k++ {
				nommes[k] = true
			}
		}
		i = fin
	}
	return nommes
}

// composer construit le corps commun a /api/classement et /api/coach.
// L'appelant tient deja le verrou.
func (c *classement) composer(jour string) (reponseClassement, []ligneInterne) {
	lignes, programmees := c.classer(jour)
	rangs := rangsPartages(lignes)
	nommes := nomsDuPodium(lignes, rangs)

	r := reponseClassement{
		Jour:         jour,
		Programmees:  programmees,
		Participants: len(lignes),
		Classement:   make([]ligneClassement, 0, len(lignes)),
	}

	total := 0
	for i, l := range lignes {
		total += l.cochees
		ligne := ligneClassement{Rang: rangs[i], Cochees: l.cochees, Part: l.part}
		// Le podium nomme trois marches, la position en nomme zero (PRD §9). La
		// regle est appliquee PAR LE SERVEUR : le nom du quatrieme ne transite
		// pas, donc aucun bogue d'affichage ne peut le faire apparaitre.
		if nommes[i] {
			ligne.Pseudo = l.p.Pseudo
		}
		r.Classement = append(r.Classement, ligne)
	}

	denominateur := len(lignes) * programmees
	r.Groupe = jauge{Cochees: total, Programmees: denominateur}
	if denominateur > 0 {
		r.Groupe.Part = arrondi3(float64(total) / float64(denominateur))
	}
	return r, lignes
}

// lire rend le classement du jour. Tout est recalcule a chaque appel, sans
// cache : 200 participants x 53 identifiants font quelques dizaines de
// microsecondes, et un cache serait un etat de plus a invalider — notamment a
// minuit, quand le denominateur change.
func (c *classement) lire(jour string) reponseClassement {
	c.mu.Lock()
	defer c.mu.Unlock()
	r, _ := c.composer(jour)
	return r
}

// coach ajoute des AGREGATS au tableau deja public, jamais un nom au-dela du
// podium : le PRD §7.6 borne cette vue a « rien de plus que la page de stats ».
func (c *classement) coach(jour string) reponseCoach {
	c.mu.Lock()
	defer c.mu.Unlock()

	base, lignes := c.composer(jour)
	r := reponseCoach{reponseClassement: base}

	for _, l := range lignes {
		switch {
		case l.part == 0:
			r.Assiduite.Aucune++
		case l.part < 0.3:
			r.Assiduite.Faible++
		case l.part < 0.6:
			r.Assiduite.Moyenne++
		default:
			// La borne haute est celle du PRD §4 — cible > 60 % — pour que le
			// coach lise sa cible sans la recalculer.
			r.Assiduite.Forte++
		}
		for _, valeur := range l.p.Ressentis {
			switch valeur {
			case "facile":
				r.Ressentis.Facile++
			case "correct":
				r.Ressentis.Correct++
			case "dur":
				r.Ressentis.Dur++
			}
		}
	}

	// Ne listent que les seances deja programmees au jour du serveur.
	jourFige := c.prog.jourEffectif(jour)
	r.Seances = make([]ligneSeanceCoach, 0, len(c.prog.Seances))
	for _, s := range c.prog.Seances {
		if s.Date > jourFige {
			break
		}
		var ids []string
		for _, b := range s.Blocs {
			for _, ex := range b.Exercices {
				ids = append(ids, ex.ID)
			}
		}
		ligne := ligneSeanceCoach{Date: s.Date, Titre: s.Titre, Exercices: len(ids)}
		for _, l := range lignes {
			n := 0
			for _, id := range ids {
				if _, ok := l.p.Faits[id]; ok {
					n++
				}
			}
			ligne.Cochees += n
			if n > 0 {
				ligne.ParticipantsActifs++
			}
			if n == len(ids) {
				ligne.ParticipantsAyantFini++
			}
		}
		r.Seances = append(r.Seances, ligne)
	}
	return r
}

// --- L'ecriture -----------------------------------------------------------

// valider verifie ce qui ne depend pas de l'etat du magasin. Elle rend le
// pseudonyme affiche et sa cle.
func (c *classement) valider(e envoiClassement) (affiche, cle string, err error) {
	affiche, cle, err = normaliserPseudo(e.Pseudo)
	if err != nil {
		return "", "", err
	}
	if !codeValide.MatchString(e.Code) {
		// Aucun code n'est interdit — ni 0000, ni 1234. Interdire serait de la
		// friction sur un jeton qui ne protege rien, et donnerait a croire
		// l'inverse.
		return "", "", errCodeInvalide
	}
	if err := c.validerRessentis(e.Ressentis); err != nil {
		return "", "", err
	}
	return affiche, cle, nil
}

func (c *classement) validerRessentis(ressentis map[string]string) error {
	if len(ressentis) > len(c.prog.Seances) {
		return errRessentisInvalide
	}
	dates := make(map[string]bool, len(c.prog.Seances))
	for _, s := range c.prog.Seances {
		dates[s.Date] = true
	}
	for date, valeur := range ressentis {
		if !dates[date] || !ressentisAdmis[valeur] {
			return errRessentisInvalide
		}
	}
	return nil
}

// enregistrer remplace l'ensemble du participant. L'envoi REMPLACE, il n'ajoute
// pas : decocher se propage. Rend cree=true quand le pseudonyme vient d'etre
// pris.
func (c *classement) enregistrer(e envoiClassement, jour string) (reponseEnvoi, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	affiche, cle, err := c.valider(e)
	if err != nil {
		return reponseEnvoi{}, false, err
	}
	// Faits est nil quand le champ est absent, et une tranche non nulle de
	// longueur 0 pour [] : c'est ce qui distingue « faits absent » d'un
	// navigateur vide qui renvoie un ensemble vide, legitime.
	if e.Faits == nil || len(e.Faits) > totauxPrescrits(c.prog).Cases {
		return reponseEnvoi{}, false, errFaitsInvalide
	}
	if jour > c.prog.Fin {
		// Le gel du PRD §9 ferme l'envoi pour toute la duree de vie restante de
		// l'application. Seule la suppression reste ouverte.
		return reponseEnvoi{}, false, errClassementFige
	}
	if c.trop(cle) {
		return reponseEnvoi{}, false, errTropDEssais
	}

	maintenant := c.horloge().UTC().Format(time.RFC3339)
	p, existe := c.parCle[cle]

	if existe {
		if !p.verifierCode(e.Code) {
			c.noterRefus(cle)
			return reponseEnvoi{}, false, errCodeRefuse
		}
	} else {
		if len(c.parCle) >= maxParticipants {
			return reponseEnvoi{}, false, errClassementPlein
		}
		sel := make([]byte, tailleSel)
		if _, err := rand.Read(sel); err != nil {
			return reponseEnvoi{}, false, err
		}
		empreinte, err := derivierEmpreinte(e.Code, sel, iterationsPBKDF)
		if err != nil {
			return reponseEnvoi{}, false, err
		}
		p = &participant{
			Pseudo: affiche, Cle: cle, Sel: sel, Empreinte: empreinte,
			Iterations: iterationsPBKDF,
			Faits:      make(map[string]string),
			CreeLe:     maintenant,
		}
		c.parCle[cle] = p
	}

	// Le pseudonyme affiche suit la derniere saisie : « Renard » puis « renard »
	// sont le meme enfant, et c'est sa derniere casse qui s'affiche.
	p.Pseudo = affiche
	p.VuLe = maintenant

	autorises := c.prog.programmes(jour)
	recus := make(map[string]bool, len(e.Faits))
	ignores := 0
	for _, id := range e.Faits {
		if recus[id] {
			continue // doublon : compte une fois, ignore zero fois
		}
		recus[id] = true
		// Un identifiant inconnu du programme est IGNORE, pas refuse : un
		// navigateur peut servir une version anterieure de programme.json
		// depuis le cache de son service worker, et refuser l'envoi entier
		// l'exclurait du classement jusqu'au prochain rechargement. Un
		// identifiant futur n'est ni compte ni stocke : le stocker pour le
		// compter le jour venu recompenserait a retardement une horloge de
		// telephone avancee.
		if !autorises[id] {
			ignores++
		}
	}

	// Les horodatages survivent au remplacement : un identifiant deja present
	// garde le sien, un nouveau prend l'instant present, un retire perd le
	// sien. Sans quoi chaque envoi redaterait d'aujourd'hui une case cochee la
	// semaine derniere, et la fiche mentirait sur ce qui s'est passe quand.
	faits := make(map[string]string, len(recus))
	for id := range recus {
		if !autorises[id] {
			continue
		}
		if ancien, ok := p.Faits[id]; ok {
			faits[id] = ancien
		} else {
			faits[id] = maintenant
		}
	}
	// UN ENVOI DE REPRISE N'ENLEVE RIEN. Le remplacement est le bon regime pour
	// un telephone qui tient la fiche — c'est lui qui fait qu'une case decochee
	// par erreur se rattrape. Il est le mauvais pour un telephone qui vient
	// d'arriver : son ensemble est vide parce qu'il ne sait rien encore, pas
	// parce que l'enfant a tout defait. On prend donc l'union, et l'horodatage
	// deja stocke gagne : une reprise ne rajeunit pas une marque, sans quoi la
	// date de la premiere coche serait celle du changement de telephone.
	if e.Reprise {
		for id, quand := range p.Faits {
			if _, ok := faits[id]; !ok {
				faits[id] = quand
			}
		}
	}
	p.Faits = faits
	if e.Ressentis != nil {
		p.Ressentis = e.Ressentis
	}

	if err := c.ecrire(); err != nil {
		return reponseEnvoi{}, false, err
	}

	r, lignes := c.composer(jour)
	rep := reponseEnvoi{
		Pseudo:       p.Pseudo,
		Jour:         jour,
		Participants: r.Participants,
		Programmees:  r.Programmees,
		Ignores:      ignores,
	}
	// La fiche ne repart que vers celui qui vient de prouver qu'il en connait le
	// code, et seulement quand il l'a demandee. Une COPIE, jamais la carte du
	// participant : la rendre telle quelle laisserait un appelant ecrire dans
	// l'etat du serveur sans passer par le verrou.
	if e.Reprise {
		rep.Faits = make(map[string]string, len(p.Faits))
		maps.Copy(rep.Faits, p.Faits)
	}
	for i, l := range lignes {
		if l.p == p {
			rep.Rang = r.Classement[i].Rang
			rep.Cochees = l.cochees
			rep.Part = l.part
			// Les AUTRES a ce rang, moi excepte. C'est ce qui permet a l'ecran
			// d'ecrire « 1er sur 12, avec 7 autres » sans recalculer un rang
			// qu'il n'a pas le droit de calculer (PRP 09).
			for _, autre := range r.Classement {
				if autre.Rang == rep.Rang {
					rep.ExAequo++
				}
			}
			rep.ExAequo--
			break
		}
	}
	return rep, !existe, nil
}

// supprimer retire une fiche entiere. L'operation est IDEMPOTENTE : supprimer
// deux fois n'est pas une erreur, le second appel rend supprime=false. C'est ce
// qui la rend rejouable — un enfant qui appuie deux fois, un reseau qui rejoue
// une requete — sans produire un ecran d'erreur pour une action qui a abouti.
//
// Elle reste ouverte apres le gel du 21 aout : le gel protege le RANG d'une
// modification tardive, pas le droit du PRD §14. Un pseudonyme indesirable qui
// deviendrait ineffacable le 22 aout est precisement le risque que le PRD
// demande d'attenuer.
func (c *classement) supprimer(e envoiClassement, jour string) (reponseSuppression, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	affiche, cle, err := c.valider(e)
	if err != nil {
		return reponseSuppression{}, err
	}
	if c.trop(cle) {
		return reponseSuppression{}, errTropDEssais
	}

	p, existe := c.parCle[cle]
	if !existe {
		// Le pseudonyme est inconnu — jamais cree, ou deja supprime.
		r, _ := c.composer(jour)
		return reponseSuppression{Pseudo: affiche, Supprime: false, Jour: jour, Participants: r.Participants}, nil
	}
	if !p.verifierCode(e.Code) {
		// Meme compteur que l'envoi : sans quoi la suppression serait le chemin
		// le moins cher pour attaquer un code a quatre chiffres.
		c.noterRefus(cle)
		return reponseSuppression{}, errCodeRefuse
	}

	// La fiche entiere disparait : aucune pierre tombale, aucune corbeille,
	// aucune conservation « au cas ou ». Le pseudonyme redevient libre, ce qui
	// est exactement le geste « changer de nom » du PRD §7.4 vu du serveur.
	// Le compteur d'essais, lui, n'est PAS efface : il vit hors du fichier et
	// expire seul, et l'effacer ferait de la suppression le moyen d'annuler une
	// penalite qu'on vient de declencher.
	delete(c.parCle, cle)
	if err := c.ecrire(); err != nil {
		c.parCle[cle] = p // rien n'a ete ecrit : l'etat en memoire reste vrai
		return reponseSuppression{}, err
	}

	r, _ := c.composer(jour)
	return reponseSuppression{Pseudo: p.Pseudo, Supprime: true, Jour: jour, Participants: r.Participants}, nil
}

// jour rend le jour courant du serveur, a l'horloge du magasin.
func (c *classement) jour() string {
	return jourParis(c.horloge())
}

// identifiantsConnus sert aux tests et au diagnostic : la liste triee des cles.
func (c *classement) identifiantsConnus() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	cles := make([]string, 0, len(c.parCle))
	for cle := range c.parCle {
		cles = append(cles, cle)
	}
	slices.Sort(cles)
	return cles
}
