// fiche.go — le magasin des fiches : un fichier JSON par gymnaste, sous
// $GYM_DONNEES, nomme d'apres l'EMPREINTE du pseudonyme et non le pseudonyme
// lui-meme, pour que le listing du repertoire ne rende aucun pseudonyme
// lisible (PRP 06, chantier A).
//
// Ce fichier ne connait pas HTTP : il rend des erreurs sentinelles qu'api.go
// traduit en statut et en message, comme dans marcq-handball/classement.go.
//
// PRD §9.8 : la fusion d'une synchronisation est une UNION, jamais un
// ecrasement ; §9.9 : prenom et semaine de depart suivent le dernier ecrit.
package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

// Les bornes du magasin (PRP 06, chantier B).
const (
	schemaCourant  = 1
	nomExtension   = ".json"
	maxRunesPseudo = 16
	minRunesPseudo = 1
	nbSemaines     = 8
	maxFaits       = 2000

	// Le code n'est jamais stocke en clair. scrypt et argon2id de la
	// bibliotheque etendue ne sont pas disponibles sans golang.org/x/crypto,
	// exclu par l'ossature §6 : PBKDF2-HMAC-SHA256, ecrit a la main sur
	// crypto/hmac et crypto/sha256, est le seul choix qui tienne les deux
	// contraintes a la fois.
	iterationsPBKDF = 200000
	tailleSel       = 16
	tailleEmpreinte = 32
)

// Les erreurs sentinelles. Leur texte EST le code d'erreur de l'API, comme
// dans marcq-handball.
var (
	errPseudoInvalide  = errors.New("pseudo-invalide")
	errCodeInvalide    = errors.New("code-invalide")
	errSemaineInvalide = errors.New("semaine-invalide")
	errFaitsInvalide   = errors.New("faits-invalide")
	errPseudoPris      = errors.New("pseudo-pris")
	errCodeRefuse      = errors.New("code-refuse")
)

var codeValide = regexp.MustCompile(`^[0-9]{6}$`)

// --- La fiche, telle qu'elle est stockee -----------------------------------

// Fait est un exercice valide, date par le SERVEUR, jamais par le client :
// c'est ce qui rend la date la plus ancienne du §9.8 incontestable.
type Fait struct {
	Exercice string    `json:"exercice"`
	Semaine  int       `json:"semaine"`
	Seance   int       `json:"seance"`
	A        time.Time `json:"a"`
}

// cle identifie un fait pour la fusion : le PRD §9.8 dedoublonne sur
// (exercice, semaine, seance), jamais sur la date.
type cleFait struct {
	exercice string
	semaine  int
	seance   int
}

// Fiche est la forme sur le disque ET la forme rendue au client — CodeSel et
// CodeHash exceptes, retires par api.go avant l'envoi (PRD §10.3 : le serveur
// ne rend jamais le code, ni son empreinte).
type Fiche struct {
	Schema        int       `json:"schema"`
	Pseudo        string    `json:"pseudo"`
	CodeSel       string    `json:"codeSel"`    // 16 octets, base64
	CodeHash      string    `json:"codeHash"`   // PBKDF2-HMAC-SHA256(code, sel), base64
	Iterations    int       `json:"iterations"` // stocke par fiche : relever le cout plus tard n'invalide pas les anciennes
	Prenom        string    `json:"prenom"`
	SemaineDepart int       `json:"semaineDepart"`
	Faits         []Fait    `json:"faits"`
	Badges        []string  `json:"badges"`
	CreeeLe       time.Time `json:"creeeLe"`
	MajLe         time.Time `json:"majLe"`
}

// verifierCode compare en temps constant : une comparaison octet a octet
// donnerait, sur une page publique, un canal de mesure gratuit.
func (f *Fiche) verifierCode(code string) bool {
	sel, err := base64.StdEncoding.DecodeString(f.CodeSel)
	if err != nil {
		return false
	}
	attendu, err := base64.StdEncoding.DecodeString(f.CodeHash)
	if err != nil {
		return false
	}
	iterations := f.Iterations
	if iterations <= 0 {
		iterations = iterationsPBKDF
	}
	obtenu := pbkdf2HMACSHA256([]byte(code), sel, iterations, len(attendu))
	return hmac.Equal(obtenu, attendu)
}

// --- PBKDF2-HMAC-SHA256, ecrit a la main (RFC 8018) -------------------------

// pbkdf2HMACSHA256 derive une cle de tailleCle octets a partir de mot et sel,
// par iterations tours de HMAC-SHA256. C'est le coeur de la contrainte
// « aucune dependance tierce » de l'ossature §6 : golang.org/x/crypto/scrypt
// et golang.org/x/crypto/argon2 en sont exclus, et la bibliotheque standard ne
// fournit que les deux briques d'en dessous.
func pbkdf2HMACSHA256(mot, sel []byte, iterations, tailleCle int) []byte {
	creerPRF := func() hash.Hash { return hmac.New(sha256.New, mot) }
	tailleBloc := creerPRF().Size()
	nBlocs := (tailleCle + tailleBloc - 1) / tailleBloc

	cle := make([]byte, 0, nBlocs*tailleBloc)
	for i := 1; i <= nBlocs; i++ {
		prf := creerPRF()
		prf.Write(sel)
		var indice [4]byte
		binary.BigEndian.PutUint32(indice[:], uint32(i))
		prf.Write(indice[:])
		u := prf.Sum(nil)

		t := make([]byte, len(u))
		copy(t, u)
		for j := 1; j < iterations; j++ {
			prf := creerPRF()
			prf.Write(u)
			u = prf.Sum(nil)
			for k := range t {
				t[k] ^= u[k]
			}
		}
		cle = append(cle, t...)
	}
	return cle[:tailleCle]
}

func derivierEmpreinteCode(code string, sel []byte) []byte {
	return pbkdf2HMACSHA256([]byte(code), sel, iterationsPBKDF, tailleEmpreinte)
}

// selFactice sert a la verification factice d'un pseudonyme inexistant : elle
// paie le meme cout PBKDF2 qu'une verification reelle, pour qu'un « pseudonyme
// inconnu » et un « mauvais code » ne se distinguent pas non plus par le
// temps de reponse.
var selFactice = sha256.Sum256([]byte("renaissance-gym/sel-factice"))

func verifierCodeFactice(code string) {
	_ = pbkdf2HMACSHA256([]byte(code), selFactice[:tailleSel], iterationsPBKDF, tailleEmpreinte)
}

// --- Le pseudonyme -----------------------------------------------------------

var espacesMultiples = regexp.MustCompile(`\s+`)

// normaliserPseudo rogne, reduit les suites d'espaces a un seul, et valide.
// PRD §10.1 : « le meme motif que marcq-handball : lettres, chiffres, espace,
// point, tiret, souligne, seize caracteres au plus. »
func normaliserPseudo(brut string) (affiche, cle string, err error) {
	affiche = espacesMultiples.ReplaceAllString(strings.TrimSpace(brut), " ")

	n := 0
	for _, r := range affiche {
		n++
		// Les commandes bidirectionnelles, les caracteres de largeur nulle et
		// les marques combinantes sont refuses, comme dans marcq-handball : la
		// bibliotheque standard ne normalise pas en NFC.
		if unicode.In(r, unicode.Cc, unicode.Cf, unicode.Co, unicode.Cs, unicode.Mn) {
			return "", "", errPseudoInvalide
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			continue
		}
		if r == ' ' || r == '.' || r == '-' || r == '_' {
			continue
		}
		return "", "", errPseudoInvalide
	}
	if n < minRunesPseudo || n > maxRunesPseudo {
		return "", "", errPseudoInvalide
	}
	return affiche, strings.ToLower(affiche), nil
}

// empreintePseudo rend le nom de fichier d'une fiche : le listing du
// repertoire ne doit jamais rendre un pseudonyme lisible (PRP 06, chantier A).
func empreintePseudo(cle string) string {
	somme := sha256.Sum256([]byte("renaissance-gym/pseudo/" + cle))
	return hex.EncodeToString(somme[:])
}

// --- Le magasin --------------------------------------------------------------

// Magasin tient un fichier par fiche sous dossier, et un verrou par
// pseudonyme qui serialise les ecritures concurrentes (PRP 06, chantier A) :
// deux telephones qui synchronisent en meme temps ne doivent pas s'ecraser.
type Magasin struct {
	dossier string
	horloge func() time.Time

	muVerrous sync.Mutex
	verrous   map[string]*sync.Mutex

	temporisation *temporisation
}

// ouvrirMagasin prepare le magasin et sonde qu'il peut ecrire : un volume
// monte appartenant a root est le mode de panne le plus probable et le plus
// silencieux, et il vaut mieux le voir au demarrage, dans les journaux du
// conteneur, qu'au premier envoi d'une gymnaste.
func ouvrirMagasin(dossier string, horloge func() time.Time) (*Magasin, error) {
	if horloge == nil {
		horloge = time.Now
	}
	if err := os.MkdirAll(dossier, 0o700); err != nil {
		return nil, fmt.Errorf("%s : %w", dossier, err)
	}
	if err := sonderEcriture(dossier); err != nil {
		return nil, err
	}
	return &Magasin{
		dossier:       dossier,
		horloge:       horloge,
		verrous:       make(map[string]*sync.Mutex),
		temporisation: nouvelleTemporisation(),
	}, nil
}

func sonderEcriture(dossier string) error {
	temoin := filepath.Join(dossier, ".ecriture-test")
	if err := os.WriteFile(temoin, []byte("ok"), 0o600); err != nil {
		return fmt.Errorf("%s n'est pas inscriptible : %w", dossier, err)
	}
	return os.Remove(temoin)
}

func (m *Magasin) verrouPour(empreinte string) *sync.Mutex {
	m.muVerrous.Lock()
	defer m.muVerrous.Unlock()
	v, ok := m.verrous[empreinte]
	if !ok {
		v = &sync.Mutex{}
		m.verrous[empreinte] = v
	}
	return v
}

func (m *Magasin) chemin(empreinte string) string {
	return filepath.Join(m.dossier, empreinte+nomExtension)
}

// lire rend nil, nil quand la fiche n'existe pas — un etat valide, jamais une
// erreur : un pseudonyme inconnu se traite exactement comme un mauvais code.
func (m *Magasin) lire(empreinte string) (*Fiche, error) {
	donnees, err := os.ReadFile(m.chemin(empreinte))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var f Fiche
	if err := json.Unmarshal(donnees, &f); err != nil {
		return nil, fmt.Errorf("%s illisible : %w", m.chemin(empreinte), err)
	}
	return &f, nil
}

// ecrire ecrit la fiche de facon ATOMIQUE : fichier temporaire dans le meme
// repertoire, puis os.Rename. Un redemarrage au mauvais moment ne doit pas
// laisser une fiche tronquee — c'est huit semaines d'entrainement.
func (m *Magasin) ecrire(empreinte string, f *Fiche) error {
	f.Schema = schemaCourant
	donnees, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return ecrireAtomique(m.chemin(empreinte), append(donnees, '\n'))
}

// ecrireAtomique ecrit dans un temporaire VOISIN de la cible — os.Rename n'est
// atomique que dans un meme systeme de fichiers — force l'ecriture sur le
// disque avant de renommer, puis force le repertoire.
func ecrireAtomique(chemin string, donnees []byte) error {
	dossier := filepath.Dir(chemin)
	tmp, err := os.CreateTemp(dossier, "fiche-*.tmp")
	if err != nil {
		return err
	}
	nom := tmp.Name()
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
	d, err := os.Open(dossier)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

func (m *Magasin) supprimerFichier(empreinte string) error {
	err := os.Remove(m.chemin(empreinte))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

// --- Validation commune -------------------------------------------------

func validerCode(code string) error {
	if !codeValide.MatchString(code) {
		return errCodeInvalide
	}
	return nil
}

func validerSemaine(semaine int) error {
	if semaine < 1 || semaine > nbSemaines {
		return errSemaineInvalide
	}
	return nil
}

func validerFaits(faits []Fait) error {
	if len(faits) > maxFaits {
		return errFaitsInvalide
	}
	for _, f := range faits {
		if strings.TrimSpace(f.Exercice) == "" {
			return errFaitsInvalide
		}
	}
	return nil
}

// --- Les trois operations ----------------------------------------------

// creer cree une fiche vide. Un pseudonyme deja pris est refuse SANS dire si
// le code aurait convenu (PRD §10.4).
func (m *Magasin) creer(pseudoBrut, code, prenom string, semaineDepart int) (*Fiche, error) {
	affiche, cle, err := normaliserPseudo(pseudoBrut)
	if err != nil {
		return nil, err
	}
	if err := validerCode(code); err != nil {
		return nil, err
	}
	if err := validerSemaine(semaineDepart); err != nil {
		return nil, err
	}

	empreinte := empreintePseudo(cle)
	verrou := m.verrouPour(empreinte)
	verrou.Lock()
	defer verrou.Unlock()

	existante, err := m.lire(empreinte)
	if err != nil {
		return nil, err
	}
	if existante != nil {
		return nil, errPseudoPris
	}

	sel := make([]byte, tailleSel)
	if _, err := rand.Read(sel); err != nil {
		return nil, err
	}
	empreinteCode := derivierEmpreinteCode(code, sel)

	maintenant := m.horloge()
	f := &Fiche{
		Pseudo:        affiche,
		CodeSel:       base64.StdEncoding.EncodeToString(sel),
		CodeHash:      base64.StdEncoding.EncodeToString(empreinteCode),
		Iterations:    iterationsPBKDF,
		Prenom:        prenom,
		SemaineDepart: semaineDepart,
		Faits:         []Fait{},
		Badges:        []string{},
		CreeeLe:       maintenant,
		MajLe:         maintenant,
	}
	if err := m.ecrire(empreinte, f); err != nil {
		return nil, err
	}
	return f, nil
}

// verifierAcces est partagee par synchroniser et effacer : c'est le SEUL
// endroit ou pseudonyme et code se verifient, et c'est ce qui garantit qu'un
// mauvais code et un pseudonyme inexistant rendent la meme erreur partout.
//
// L'appelant tient deja le verrou du pseudonyme.
func (m *Magasin) verifierAcces(empreinte, code string) (*Fiche, error) {
	f, err := m.lire(empreinte)
	if err != nil {
		return nil, err
	}
	if f == nil {
		// Pseudonyme inconnu : on paie quand meme le cout d'une derivation,
		// pour que le temps de reponse ne soit pas l'oracle que le corps et le
		// statut refusent deja d'etre.
		verifierCodeFactice(code)
		return nil, errCodeRefuse
	}
	if !f.verifierCode(code) {
		return nil, errCodeRefuse
	}
	return f, nil
}

// synchroniser lit, fusionne et reecrit une fiche. La fusion est une UNION
// (PRD §9.8) : aucune case cochee ne se decoche par synchronisation, quel que
// soit l'ordre d'arrivee. prenom et semaineDepart suivent le dernier ecrit
// s'ils sont non vides (PRD §9.9).
func (m *Magasin) synchroniser(pseudoBrut, code string, faits []Fait, badges []string, prenom string, semaineDepart int) (*Fiche, error) {
	affiche, cle, err := normaliserPseudo(pseudoBrut)
	if err != nil {
		return nil, err
	}
	if err := validerCode(code); err != nil {
		return nil, err
	}
	if err := validerFaits(faits); err != nil {
		return nil, err
	}
	if semaineDepart != 0 {
		if err := validerSemaine(semaineDepart); err != nil {
			return nil, err
		}
	}

	empreinte := empreintePseudo(cle)
	maintenant := m.horloge()

	if bloque, attendre := m.temporisation.bloque(empreinte, maintenant); bloque {
		return nil, &erreurTemporisation{attendre: attendre}
	}

	verrou := m.verrouPour(empreinte)
	verrou.Lock()
	defer verrou.Unlock()

	f, err := m.verifierAcces(empreinte, code)
	if err != nil {
		if errors.Is(err, errCodeRefuse) {
			m.temporisation.noterEchec(empreinte, maintenant)
		}
		return nil, err
	}
	m.temporisation.reussite(empreinte)

	fusion := fusionnerFaits(f.Faits, faits)
	if len(fusion) > maxFaits {
		return nil, errFaitsInvalide
	}

	f.Pseudo = affiche
	f.Faits = fusion
	f.Badges = fusionnerBadges(f.Badges, badges)
	if prenom != "" {
		f.Prenom = prenom
	}
	if semaineDepart != 0 {
		f.SemaineDepart = semaineDepart
	}
	f.MajLe = maintenant

	if err := m.ecrire(empreinte, f); err != nil {
		return nil, err
	}
	return f, nil
}

// effacer retire une fiche entiere, definitivement : aucune pierre tombale,
// aucune corbeille.
func (m *Magasin) effacer(pseudoBrut, code string) error {
	_, cle, err := normaliserPseudo(pseudoBrut)
	if err != nil {
		return err
	}
	if err := validerCode(code); err != nil {
		return err
	}

	empreinte := empreintePseudo(cle)
	maintenant := m.horloge()

	if bloque, attendre := m.temporisation.bloque(empreinte, maintenant); bloque {
		return &erreurTemporisation{attendre: attendre}
	}

	verrou := m.verrouPour(empreinte)
	verrou.Lock()
	defer verrou.Unlock()

	if _, err := m.verifierAcces(empreinte, code); err != nil {
		if errors.Is(err, errCodeRefuse) {
			m.temporisation.noterEchec(empreinte, maintenant)
		}
		return err
	}
	m.temporisation.reussite(empreinte)

	return m.supprimerFichier(empreinte)
}

// --- La fusion (PRD §9.8) -----------------------------------------------

// fusionnerFaits rend l'union de deux ensembles de faits, dedoublonnes sur
// (exercice, semaine, seance) : la date la PLUS ANCIENNE gagne sur un
// doublon, quel que soit l'ordre d'arrivee des deux tranches.
func fusionnerFaits(stockes, recus []Fait) []Fait {
	parCle := make(map[cleFait]Fait, len(stockes)+len(recus))
	var ordre []cleFait

	ajouter := func(f Fait) {
		c := cleFait{f.Exercice, f.Semaine, f.Seance}
		existant, ok := parCle[c]
		if !ok {
			parCle[c] = f
			ordre = append(ordre, c)
			return
		}
		if f.A.Before(existant.A) {
			existant.A = f.A
			parCle[c] = existant
		}
	}
	for _, f := range stockes {
		ajouter(f)
	}
	for _, f := range recus {
		ajouter(f)
	}

	fusion := make([]Fait, 0, len(ordre))
	for _, c := range ordre {
		fusion = append(fusion, parCle[c])
	}
	// Ordre stable : un fichier dont les lignes dansent d'une ecriture a
	// l'autre est illisible a la main.
	sort.Slice(fusion, func(i, j int) bool {
		if fusion[i].Semaine != fusion[j].Semaine {
			return fusion[i].Semaine < fusion[j].Semaine
		}
		if fusion[i].Seance != fusion[j].Seance {
			return fusion[i].Seance < fusion[j].Seance
		}
		return fusion[i].Exercice < fusion[j].Exercice
	})
	return fusion
}

// fusionnerBadges rend l'union des deux listes, sans doublon.
func fusionnerBadges(stockes, recus []string) []string {
	ens := make(map[string]bool, len(stockes)+len(recus))
	for _, b := range stockes {
		ens[b] = true
	}
	for _, b := range recus {
		ens[b] = true
	}
	fusion := make([]string, 0, len(ens))
	for b := range ens {
		fusion = append(fusion, b)
	}
	sort.Strings(fusion)
	return fusion
}

// --- La temporisation (PRP 06, chantier D) -------------------------------

// delaisTemporisation sont ceux du PRD §7.5 : 5, 15, 45 s. Le delai croit avec
// le nombre d'echecs CONSECUTIFS et se remet a zero sur un succes.
var delaisTemporisation = []time.Duration{5 * time.Second, 15 * time.Second, 45 * time.Second}

type etatEchecs struct {
	echecs  int
	dernier time.Time
}

// temporisation vit en MEMOIRE et non sur le disque : un redemarrage la perd,
// ce qui est accepte (PRP 06, chantier D) — le vrai rempart est le million de
// combinaisons du PRD §10.2, pas ce compteur.
type temporisation struct {
	mu    sync.Mutex
	etats map[string]*etatEchecs
}

func nouvelleTemporisation() *temporisation {
	return &temporisation{etats: make(map[string]*etatEchecs)}
}

// bloque dit si le pseudonyme doit encore attendre, et combien de temps. La
// cle est l'EMPREINTE du pseudonyme, jamais le pseudonyme en clair : le delai
// est donc PAR PSEUDONYME, et un attaquant qui pilonne depuis mille adresses
// ne bloque jamais la gymnaste elle-meme sur un AUTRE pseudonyme.
func (t *temporisation) bloque(empreinte string, maintenant time.Time) (bool, time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()
	e, ok := t.etats[empreinte]
	if !ok || e.echecs == 0 {
		return false, 0
	}
	indice := e.echecs
	if indice > len(delaisTemporisation) {
		indice = len(delaisTemporisation)
	}
	delai := delaisTemporisation[indice-1]
	ecoule := maintenant.Sub(e.dernier)
	if ecoule >= delai {
		return false, 0
	}
	return true, delai - ecoule
}

func (t *temporisation) noterEchec(empreinte string, maintenant time.Time) {
	t.mu.Lock()
	defer t.mu.Unlock()
	e, ok := t.etats[empreinte]
	if !ok {
		e = &etatEchecs{}
		t.etats[empreinte] = e
	}
	e.echecs++
	e.dernier = maintenant
}

// reussite remet le compteur a zero (PRP 06, chantier D).
func (t *temporisation) reussite(empreinte string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.etats, empreinte)
}

// erreurTemporisation porte le delai a attendre, renvoye au client dans le
// champ « attendreMs » (PRP 06, chantier B).
type erreurTemporisation struct {
	attendre time.Duration
}

func (e *erreurTemporisation) Error() string { return "trop-d-essais" }
