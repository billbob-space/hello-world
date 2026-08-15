package main

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Une horloge injectable, comme dans marcq-handball/classement_test.go --

type horlogeTest struct {
	mu         sync.Mutex
	maintenant time.Time
}

func nouvelleHorloge() *horlogeTest {
	return &horlogeTest{maintenant: time.Date(2026, 8, 14, 10, 0, 0, 0, time.UTC)}
}

func (h *horlogeTest) maintenantFn() time.Time {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.maintenant
}

func (h *horlogeTest) avancer(d time.Duration) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.maintenant = h.maintenant.Add(d)
}

func magasinDeTest(t *testing.T) (*Magasin, string, *horlogeTest) {
	t.Helper()
	dossier := t.TempDir()
	h := nouvelleHorloge()
	m, err := ouvrirMagasin(dossier, h.maintenantFn)
	if err != nil {
		t.Fatalf("ouvrirMagasin : %v", err)
	}
	return m, dossier, h
}

// --- La derivation PBKDF2-HMAC-SHA256, ecrite a la main --------------------

// TestPBKDF2CorrespondALaBibliothequeStandard verifie l'implementation ecrite
// a la main contre crypto/pbkdf2, ajoute a la bibliotheque standard en
// Go 1.24 : elle n'est PAS utilisee par l'application (le PRP 06 demande une
// implementation manuelle sur crypto/hmac et crypto/sha256), mais elle sert
// ici d'oracle de correction, sur des vecteurs connus (RFC 7914 et un cas
// arbitraire).
func TestPBKDF2CorrespondALaBibliothequeStandard(t *testing.T) {
	cas := []struct {
		mot, sel   string
		iterations int
		taille     int
	}{
		{"password", "salt", 1, 32},
		{"password", "salt", 2, 32},
		{"password", "salt", 4096, 32},
		{"481920", "unSelDeSeizeOctets!", 200000, 32},
		{"", "salt", 3, 16},
	}
	for _, c := range cas {
		mine := pbkdf2HMACSHA256([]byte(c.mot), []byte(c.sel), c.iterations, c.taille)
		attendu, err := pbkdf2.Key(sha256.New, c.mot, []byte(c.sel), c.iterations, c.taille)
		if err != nil {
			t.Fatalf("pbkdf2.Key : %v", err)
		}
		if hex.EncodeToString(mine) != hex.EncodeToString(attendu) {
			t.Errorf("pbkdf2HMACSHA256(%q, %q, %d, %d) = %x, attendu %x",
				c.mot, c.sel, c.iterations, c.taille, mine, attendu)
		}
	}
}

// TestPBKDF2VecteurConnu fige un vecteur publie (draft-josefsson-scrypt-kdf) :
// si l'implementation derive un jour, ce test le dit sans dependre du reseau
// ni d'un import qui n'existe pas avant Go 1.24.
func TestPBKDF2VecteurConnu(t *testing.T) {
	obtenu := pbkdf2HMACSHA256([]byte("password"), []byte("salt"), 1, 32)
	attendu := "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b"
	if hex.EncodeToString(obtenu) != attendu {
		t.Errorf("pbkdf2HMACSHA256 = %x, attendu %s", obtenu, attendu)
	}
}

// --- Le pseudonyme -----------------------------------------------------------

func TestNormaliserPseudo(t *testing.T) {
	cas := []struct {
		brut    string
		affiche string
		cle     string
		valide  bool
	}{
		{"Renarde-14", "Renarde-14", "renarde-14", true},
		{"  Comete   7  ", "Comete 7", "comete 7", true},
		{"a.b_c-D3", "a.b_c-D3", "a.b_c-d3", true},
		{"", "", "", false},
		{"dix-sept-caracteres", "", "", false}, // 19 caracteres, > 16
		{"pseudo@mail", "", "", false},
		{"pseudo/slash", "", "", false},
	}
	for _, c := range cas {
		affiche, cle, err := normaliserPseudo(c.brut)
		if c.valide && err != nil {
			t.Errorf("normaliserPseudo(%q) : erreur inattendue %v", c.brut, err)
			continue
		}
		if !c.valide {
			if err == nil {
				t.Errorf("normaliserPseudo(%q) : accepte a tort", c.brut)
			}
			continue
		}
		if affiche != c.affiche || cle != c.cle {
			t.Errorf("normaliserPseudo(%q) = (%q, %q), attendu (%q, %q)", c.brut, affiche, cle, c.affiche, c.cle)
		}
	}
}

// TestEmpreintePseudoNestPasLisibleCommeLePseudo verifie que le nom de
// fichier n'est ni le pseudonyme ni une transformation triviale — le listing
// du repertoire ne doit rendre aucun pseudonyme lisible (PRP 06, chantier A).
func TestEmpreintePseudoNestPasLisibleCommeLePseudo(t *testing.T) {
	empreinte := empreintePseudo("renarde-14")
	if strings.Contains(strings.ToLower(empreinte), "renarde") {
		t.Errorf("l'empreinte %q laisse deviner le pseudonyme", empreinte)
	}
	if len(empreinte) != 64 { // sha256 hex
		t.Errorf("empreinte de longueur %d, attendu 64 (sha256 hex)", len(empreinte))
	}
	// Deterministe : la meme cle rend toujours la meme empreinte, ce dont
	// depend la relecture d'une fiche.
	if empreintePseudo("renarde-14") != empreinte {
		t.Error("empreintePseudo n'est pas deterministe")
	}
	// Deux cles differentes ne doivent pas entrer en collision dans ce test.
	if empreintePseudo("comete-7") == empreinte {
		t.Error("deux pseudonymes distincts rendent la meme empreinte")
	}
}

// --- Le magasin : creer, synchroniser, effacer ------------------------------

func TestCreerPuisEffacer(t *testing.T) {
	m, _, _ := magasinDeTest(t)

	f, err := m.creer("Comete-7", "481920", "Alice", 1)
	if err != nil {
		t.Fatalf("creer : %v", err)
	}
	if f.Pseudo != "Comete-7" || f.Prenom != "Alice" || f.SemaineDepart != 1 {
		t.Errorf("fiche creee inattendue : %+v", f)
	}
	if len(f.Faits) != 0 || len(f.Badges) != 0 {
		t.Errorf("une fiche neuve doit etre vide : %+v", f)
	}

	if err := m.effacer("Comete-7", "481920"); err != nil {
		t.Fatalf("effacer : %v", err)
	}
	// La fiche a disparu : la recreer avec un autre code doit reussir.
	if _, err := m.creer("Comete-7", "111111", "Alice", 1); err != nil {
		t.Fatalf("recreation apres effacement : %v", err)
	}
}

func TestCreerPseudoDejaPrisNeReveleRien(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}
	_, err := m.creer("Comete-7", "999999", "Bob", 1)
	if !errors.Is(err, errPseudoPris) {
		t.Errorf("creer un pseudo pris = %v, attendu errPseudoPris", err)
	}
}

// TestCreerPseudonymeCasseIndifferente : deux ecritures qui ne different que
// par la casse sont LE MEME compte, comme dans marcq-handball — sinon un
// pseudonyme se ferait squatter en variant la casse.
func TestCreerPseudonymeCasseIndifferente(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Renard", "111111", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}
	if _, err := m.creer("renard", "222222", "Bob", 1); !errors.Is(err, errPseudoPris) {
		t.Errorf("creer avec une autre casse = %v, attendu errPseudoPris", err)
	}
}

// TestLeCodeNestJamaisStockeEnClair est le test central du PRD §10.3 et de
// l'ossature §7.5 : on ecrit une fiche avec un code connu, on relit le
// FICHIER PRODUIT SUR LE DISQUE — pas la structure en memoire — et on echoue
// si le code y apparait, sous quelque forme que ce soit.
func TestLeCodeNestJamaisStockeEnClair(t *testing.T) {
	m, dossier, _ := magasinDeTest(t)
	const code = "481920"

	if _, err := m.creer("Comete-7", code, "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	_, cle, err := normaliserPseudo("Comete-7")
	if err != nil {
		t.Fatalf("normaliserPseudo : %v", err)
	}
	chemin := filepath.Join(dossier, empreintePseudo(cle)+".json")
	donnees, err := os.ReadFile(chemin)
	if err != nil {
		t.Fatalf("fichier de fiche illisible : %v", err)
	}
	contenu := string(donnees)
	if strings.Contains(contenu, code) {
		t.Fatalf("le fichier sur le disque contient le code en clair : %s", contenu)
	}
	// Une empreinte hexadecimale du code n'a aucune raison d'apparaitre non
	// plus : elle serait le signe d'un hachage sans sel ou reversible.
	if strings.Contains(contenu, hex.EncodeToString([]byte(code))) {
		t.Fatalf("le fichier contient une forme lisible du code : %s", contenu)
	}
}

// TestMauvaisCodeEtPseudonymeInexistantMemeErreur : le magasin doit rendre la
// MEME erreur sentinelle pour un code faux et pour un pseudonyme qui n'existe
// pas, sans quoi l'API serait un oracle d'existence de pseudonymes.
func TestMauvaisCodeEtPseudonymeInexistantMemeErreur(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	_, errMauvaisCode := m.synchroniser("Comete-7", "000000", nil, nil, "", 0)
	_, errInexistant := m.synchroniser("Fantome-1", "000000", nil, nil, "", 0)

	if !errors.Is(errMauvaisCode, errCodeRefuse) {
		t.Errorf("mauvais code : %v, attendu errCodeRefuse", errMauvaisCode)
	}
	if !errors.Is(errInexistant, errCodeRefuse) {
		t.Errorf("pseudonyme inexistant : %v, attendu errCodeRefuse", errInexistant)
	}
}

// --- La fusion (PRD §9.8) ----------------------------------------------------

func TestFusionEstUneUnionQuelQueSoitLOrdre(t *testing.T) {
	t0 := time.Date(2026, 8, 1, 8, 0, 0, 0, time.UTC)
	t1 := t0.Add(24 * time.Hour)

	a := []Fait{
		{Exercice: "ex-1", Semaine: 1, Seance: 1, A: t0},
		{Exercice: "ex-2", Semaine: 1, Seance: 1, A: t0},
	}
	// b porte un doublon de ex-1, mais date PLUS TARD : la plus ancienne doit
	// gagner, quel que soit l'ordre d'arrivee.
	b := []Fait{
		{Exercice: "ex-1", Semaine: 1, Seance: 1, A: t1},
		{Exercice: "ex-3", Semaine: 1, Seance: 2, A: t1},
	}

	fusionAB := fusionnerFaits(a, b)
	fusionBA := fusionnerFaits(b, a)

	if len(fusionAB) != 3 || len(fusionBA) != 3 {
		t.Fatalf("fusion : %d et %d elements, attendu 3 dans les deux cas", len(fusionAB), len(fusionBA))
	}
	// Meme contenu, quel que soit l'ordre d'arrivee.
	dateDe := func(fusion []Fait, id string) time.Time {
		for _, f := range fusion {
			if f.Exercice == id {
				return f.A
			}
		}
		t.Fatalf("exercice %s absent de la fusion", id)
		return time.Time{}
	}
	if !dateDe(fusionAB, "ex-1").Equal(t0) || !dateDe(fusionBA, "ex-1").Equal(t0) {
		t.Error("la date la plus ancienne n'a pas gagne sur le doublon ex-1")
	}
}

func TestSynchroniserEstUneUnionEtNePerdRien(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	horloge.avancer(time.Minute)
	f1, err := m.synchroniser("Comete-7", "481920",
		[]Fait{{Exercice: "s1-1", Semaine: 1, Seance: 1}}, nil, "", 0)
	if err != nil {
		t.Fatalf("premiere synchronisation : %v", err)
	}
	if len(f1.Faits) != 1 {
		t.Fatalf("apres la premiere synchro : %d faits, attendu 1", len(f1.Faits))
	}

	// Un second telephone envoie un ensemble DIFFERENT : rien de ce qui etait
	// deja coche ne doit disparaitre (PRD §9.8).
	horloge.avancer(time.Minute)
	f2, err := m.synchroniser("Comete-7", "481920",
		[]Fait{{Exercice: "s1-2", Semaine: 1, Seance: 1}}, nil, "", 0)
	if err != nil {
		t.Fatalf("seconde synchronisation : %v", err)
	}
	if len(f2.Faits) != 2 {
		t.Fatalf("apres la seconde synchro : %d faits, attendu 2 (union, pas remplacement)", len(f2.Faits))
	}
}

// TestPrenomEtSemaineDepartSuiventLeDernierEcrit (PRD §9.9) : contrairement
// aux faits, ces deux champs ne sont pas fusionnes — le dernier envoi NON VIDE
// gagne.
func TestPrenomEtSemaineDepartSuiventLeDernierEcrit(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	horloge.avancer(time.Minute)
	f, err := m.synchroniser("Comete-7", "481920", nil, nil, "Alicia", 3)
	if err != nil {
		t.Fatalf("synchroniser : %v", err)
	}
	if f.Prenom != "Alicia" || f.SemaineDepart != 3 {
		t.Errorf("prenom=%q semaineDepart=%d, attendu Alicia/3", f.Prenom, f.SemaineDepart)
	}

	// Un envoi qui ne porte pas ces champs (chaine vide, zero) ne les efface
	// pas.
	horloge.avancer(time.Minute)
	f, err = m.synchroniser("Comete-7", "481920", nil, nil, "", 0)
	if err != nil {
		t.Fatalf("synchroniser : %v", err)
	}
	if f.Prenom != "Alicia" || f.SemaineDepart != 3 {
		t.Errorf("un envoi vide a efface prenom/semaineDepart : %+v", f)
	}
}

// --- Le lot ludique, « Ajoute apres les PRP » : les nouveaux champs suivent
// la fiche et se fusionnent sans perte entre deux appareils --------------

// TestParuresSontUneUnionCommeLesBadges (PRD A13) : une parure acquise reste
// acquise, quel que soit l'ordre d'arrivee des deux tranches.
func TestParuresSontUneUnionCommeLesBadges(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	horloge.avancer(time.Minute)
	f1, err := m.synchroniserFiche(requeteSynchro{
		Pseudo: "Comete-7", Code: "481920", Parures: []string{"parure-1"},
	})
	if err != nil {
		t.Fatalf("premiere synchronisation : %v", err)
	}
	if len(f1.Parures) != 1 || f1.Parures[0] != "parure-1" {
		t.Fatalf("parures apres la premiere synchro : %+v, attendu [parure-1]", f1.Parures)
	}

	// Un second appareil apporte une AUTRE parure : rien de ce qui etait deja
	// acquis ne doit disparaitre.
	horloge.avancer(time.Minute)
	f2, err := m.synchroniserFiche(requeteSynchro{
		Pseudo: "Comete-7", Code: "481920", Parures: []string{"parure-3"},
	})
	if err != nil {
		t.Fatalf("seconde synchronisation : %v", err)
	}
	attendu := map[string]bool{"parure-1": true, "parure-3": true}
	if len(f2.Parures) != 2 {
		t.Fatalf("parures apres la seconde synchro : %+v, attendu 2 elements (union)", f2.Parures)
	}
	for _, p := range f2.Parures {
		if !attendu[p] {
			t.Errorf("parure inattendue : %s", p)
		}
	}
}

// TestRecordsNeRedescendentJamais (PRD A16) : chaque champ se fusionne par le
// plus grand, jamais par ecrasement — un appareil qui envoie un record plus
// PETIT que celui deja garde ne doit jamais le faire regresser.
func TestRecordsNeRedescendentJamais(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	horloge.avancer(time.Minute)
	f1, err := m.synchroniserFiche(requeteSynchro{
		Pseudo: "Comete-7", Code: "481920",
		Records: Records{PlusLongueTenue: 30, PlusExercicesJour: 5, TotalExercices: 10},
	})
	if err != nil {
		t.Fatalf("premiere synchronisation : %v", err)
	}
	if f1.Records != (Records{PlusLongueTenue: 30, PlusExercicesJour: 5, TotalExercices: 10}) {
		t.Fatalf("records apres la premiere synchro : %+v", f1.Records)
	}

	// Un second appareil, en retard, envoie des records plus PETITS sur deux
	// champs et plus GRAND sur le troisieme : chaque champ doit se fusionner
	// independamment, jamais l'objet entier remplace.
	horloge.avancer(time.Minute)
	f2, err := m.synchroniserFiche(requeteSynchro{
		Pseudo: "Comete-7", Code: "481920",
		Records: Records{PlusLongueTenue: 10, PlusExercicesJour: 2, TotalExercices: 15},
	})
	if err != nil {
		t.Fatalf("seconde synchronisation : %v", err)
	}
	attendu := Records{PlusLongueTenue: 30, PlusExercicesJour: 5, TotalExercices: 15}
	if f2.Records != attendu {
		t.Errorf("records = %+v, attendu %+v (le plus grand, champ par champ)", f2.Records, attendu)
	}
}

// TestCouleurSuitLeDernierEcritCommeLePrenom (PRD A14).
func TestCouleurSuitLeDernierEcritCommeLePrenom(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	horloge.avancer(time.Minute)
	f, err := m.synchroniserFiche(requeteSynchro{Pseudo: "Comete-7", Code: "481920", Couleur: "fuchsia"})
	if err != nil {
		t.Fatalf("synchroniser : %v", err)
	}
	if f.Couleur != "fuchsia" {
		t.Fatalf("couleur = %q, attendu fuchsia", f.Couleur)
	}

	// Un envoi qui ne porte pas la couleur (chaine vide) ne l'efface pas —
	// exactement la meme regle que le prenom.
	horloge.avancer(time.Minute)
	f, err = m.synchroniserFiche(requeteSynchro{Pseudo: "Comete-7", Code: "481920"})
	if err != nil {
		t.Fatalf("synchroniser : %v", err)
	}
	if f.Couleur != "fuchsia" {
		t.Errorf("un envoi vide a efface la couleur : %+v", f)
	}
}

// TestSynchroniserSansLotLudiqueSeComporteExactementCommeAvant : la signature
// historique de synchroniser() ne doit RIEN changer pour un appelant qui
// l'ignore — c'est ce qui garde tous les appels existants valides.
func TestSynchroniserSansLotLudiqueSeComporteExactementCommeAvant(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}
	f, err := m.synchroniser("Comete-7", "481920", []Fait{{Exercice: "ex-1", Semaine: 1, Seance: 1}}, nil, "", 0)
	if err != nil {
		t.Fatalf("synchroniser : %v", err)
	}
	if len(f.Parures) != 0 || f.Records != (Records{}) || f.Couleur != "" {
		t.Errorf("le lot ludique n'a jamais ete envoye : la fiche devrait rester neutre, %+v", f)
	}
}

func TestFaitsAuDelaDeLaBorneRendErreurEtNecritRien(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	trop := make([]Fait, maxFaits+1)
	for i := range trop {
		trop[i] = Fait{Exercice: "ex-" + strconv.Itoa(i), Semaine: 1, Seance: 1}
	}

	horloge.avancer(time.Minute)
	_, err := m.synchroniser("Comete-7", "481920", trop, nil, "", 0)
	if !errors.Is(err, errFaitsInvalide) {
		t.Fatalf("synchroniser avec trop de faits = %v, attendu errFaitsInvalide", err)
	}

	// Rien n'a ete ecrit : la fiche relue est toujours vide.
	f, err := m.lire(empreintePseudo("comete-7"))
	if err != nil {
		t.Fatalf("lire : %v", err)
	}
	if f == nil || len(f.Faits) != 0 {
		t.Errorf("la fiche a ete modifiee malgre le refus : %+v", f)
	}
}

func TestSemaineDepartHorsBornesEstRefusee(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 0); !errors.Is(err, errSemaineInvalide) {
		t.Errorf("semaine 0 = %v, attendu errSemaineInvalide", err)
	}
	if _, err := m.creer("Comete-8", "481920", "Alice", 9); !errors.Is(err, errSemaineInvalide) {
		t.Errorf("semaine 9 = %v, attendu errSemaineInvalide", err)
	}
}

func TestCodeInvalideEstRefuse(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	for _, code := range []string{"1234", "12345678", "abcdef", ""} {
		if _, err := m.creer("Comete-7", code, "Alice", 1); !errors.Is(err, errCodeInvalide) {
			t.Errorf("code %q = %v, attendu errCodeInvalide", code, err)
		}
	}
}

// --- Le verrou par pseudonyme (PRP 06, chantier A) --------------------------

// TestSynchronisationsConcurrentesNePerdentAucunFait simule deux telephones
// qui synchronisent la MEME fiche en meme temps : le verrou par pseudonyme
// doit serialiser les ecritures, et la fusion doit garder chaque fait envoye
// par chaque goroutine.
func TestSynchronisationsConcurrentesNePerdentAucunFait(t *testing.T) {
	m, _, _ := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "481920", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	const n = 20
	var attente sync.WaitGroup
	attente.Add(n)
	for i := 0; i < n; i++ {
		go func(i int) {
			defer attente.Done()
			fait := []Fait{{Exercice: "ex-" + strconv.Itoa(i), Semaine: 1, Seance: 1}}
			if _, err := m.synchroniser("Comete-7", "481920", fait, nil, "", 0); err != nil {
				t.Errorf("synchronisation %d : %v", i, err)
			}
		}(i)
	}
	attente.Wait()

	f, err := m.lire(empreintePseudo("comete-7"))
	if err != nil {
		t.Fatalf("lire : %v", err)
	}
	if f == nil || len(f.Faits) != n {
		t.Fatalf("apres %d synchronisations concurrentes : %d faits stockes, attendu %d", n, len(f.Faits), n)
	}
}

// --- L'ecriture atomique -----------------------------------------------------

func TestOuvrirMagasinEchoueSurUnDossierInutilisable(t *testing.T) {
	// Un chemin qui est deja un FICHIER ne peut pas devenir un dossier :
	// os.MkdirAll echoue, et ouvrirMagasin doit le remonter plutot que de
	// demarrer sur un magasin qui n'ecrira jamais rien en silence.
	dossierParent := t.TempDir()
	cheminFichier := filepath.Join(dossierParent, "pas-un-dossier")
	if err := os.WriteFile(cheminFichier, []byte("x"), 0o600); err != nil {
		t.Fatalf("preparation : %v", err)
	}
	if _, err := ouvrirMagasin(cheminFichier, time.Now); err == nil {
		t.Error("ouvrirMagasin sur un fichier existant a reussi, attendu une erreur")
	}
}

// --- La temporisation (PRP 06, chantier D) -----------------------------------

// TestQuatriemeTentativeDansLaMemeMinuteEstRefusee reproduit le scenario du
// PRP 06 : trois codes refuses, chacun soumis apres le delai que le precedent
// impose (5, 15 s), donnent chacun une vraie reponse ; le quatrieme, soumis
// sans attendre le troisieme delai (45 s), est refuse — et le tout tient dans
// la meme minute (20 s ecoulees).
func TestQuatriemeTentativeDansLaMemeMinuteEstRefusee(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "111222", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	if _, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0); !errors.Is(err, errCodeRefuse) {
		t.Fatalf("1er essai : %v, attendu errCodeRefuse", err)
	}

	horloge.avancer(5 * time.Second)
	if _, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0); !errors.Is(err, errCodeRefuse) {
		t.Fatalf("2e essai : %v, attendu errCodeRefuse", err)
	}

	horloge.avancer(15 * time.Second)
	if _, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0); !errors.Is(err, errCodeRefuse) {
		t.Fatalf("3e essai : %v, attendu errCodeRefuse", err)
	}

	// Le 4e essai arrive 20 s apres le premier — dans la meme minute — sans
	// avoir attendu les 45 s que le 3e refus impose.
	_, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0)
	var tempo *erreurTemporisation
	if !errors.As(err, &tempo) {
		t.Fatalf("4e essai : %v, attendu une erreurTemporisation", err)
	}
	if tempo.attendre <= 0 {
		t.Errorf("attendre = %s, attendu strictement positif", tempo.attendre)
	}

	// Le delai est PAR PSEUDONYME : un autre pseudonyme n'est pas concerne
	// (aucune gymnaste ne peut etre bloquee en pilonnant un pseudonyme
	// different depuis ailleurs).
	if _, err := m.creer("Comete-8", "111222", "Bob", 1); err != nil {
		t.Fatalf("creer un second pseudonyme : %v", err)
	}
	if _, err := m.synchroniser("Comete-8", "000000", nil, nil, "", 0); !errors.Is(err, errCodeRefuse) {
		t.Errorf("le pseudonyme voisin est bloque a tort : %v", err)
	}
}

// TestSuccesRemetLeCompteurAZero verifie que la temporisation ne survit pas a
// un code correct (PRP 06, chantier D).
func TestSuccesRemetLeCompteurAZero(t *testing.T) {
	m, _, horloge := magasinDeTest(t)
	if _, err := m.creer("Comete-7", "111222", "Alice", 1); err != nil {
		t.Fatalf("creer : %v", err)
	}

	if _, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0); !errors.Is(err, errCodeRefuse) {
		t.Fatalf("essai rate : %v", err)
	}
	horloge.avancer(5 * time.Second)
	if _, err := m.synchroniser("Comete-7", "111222", nil, nil, "", 0); err != nil {
		t.Fatalf("essai reussi : %v", err)
	}
	// Immediatement apres le succes, un nouvel essai n'est PAS bloque.
	_, err := m.synchroniser("Comete-7", "000000", nil, nil, "", 0)
	var tempo *erreurTemporisation
	if errors.As(err, &tempo) {
		t.Error("le compteur n'a pas ete remis a zero par le succes")
	}
}
