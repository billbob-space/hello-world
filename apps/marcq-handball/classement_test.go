package main

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Le jour de reference des tests : la troisieme seance du programme. A cette
// date, trois seances sont programmees — c'est un denominateur non trivial, qui
// n'est ni 0 ni le programme entier.
const jourTest = "2026-08-07"

// horlogeTest avance a la demande. Sans horloge injectable, l'ordre des ex
// aequo — « le premier arrive a ce score est devant » — ne serait pas
// verifiable : deux envois du meme test tomberaient dans la meme seconde.
type horlogeTest struct {
	mu         sync.Mutex
	maintenant time.Time
}

func nouvelleHorloge() *horlogeTest {
	return &horlogeTest{maintenant: time.Date(2026, 8, 7, 10, 0, 0, 0, time.UTC)}
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

func magasinDeTest(t *testing.T) (*classement, string, *horlogeTest) {
	t.Helper()
	dossier := t.TempDir()
	h := nouvelleHorloge()
	cl, err := ouvrirClassement(dossier, programmeDuDepot(t), h.maintenantFn)
	if err != nil {
		t.Fatalf("ouvrirClassement : %v", err)
	}
	if cl == nil {
		t.Fatal("ouvrirClassement a rendu nil sur un dossier valide")
	}
	return cl, dossier, h
}

func envoyer(t *testing.T, cl *classement, pseudo, code string, faits ...string) reponseEnvoi {
	t.Helper()
	if faits == nil {
		faits = []string{}
	}
	rep, _, err := cl.enregistrer(envoiClassement{Pseudo: pseudo, Code: code, Faits: faits}, jourTest)
	if err != nil {
		t.Fatalf("enregistrer(%s) : %v", pseudo, err)
	}
	return rep
}

func lireFichier(t *testing.T, dossier string) string {
	t.Helper()
	donnees, err := os.ReadFile(filepath.Join(dossier, nomFichier))
	if err != nil {
		t.Fatalf("classement.json illisible : %v", err)
	}
	return string(donnees)
}

// --- Les quatre cas d'ouverture -------------------------------------------

func TestOuvrirClassementSansDossierDesactiveLeClassement(t *testing.T) {
	cl, err := ouvrirClassement("", programmeDuDepot(t), nil)
	if err != nil {
		t.Fatalf("dossier vide : erreur %v, attendu aucune", err)
	}
	if cl != nil {
		t.Error("dossier vide : le classement doit etre desactive, pas ouvert")
	}
}

func TestOuvrirClassementSansFichierDemarreVide(t *testing.T) {
	cl, dossier, _ := magasinDeTest(t)
	if n := len(cl.identifiantsConnus()); n != 0 {
		t.Errorf("%d participant(s) sur un dossier vide", n)
	}
	// « Demarrage sans intervention » : aucun fichier n'est cree tant que
	// personne n'a rien envoye.
	if _, err := os.Stat(filepath.Join(dossier, nomFichier)); err == nil {
		t.Error("classement.json a ete cree avant le premier envoi")
	}
}

func TestOuvrirClassementMetDeCoteUnFichierIllisible(t *testing.T) {
	dossier := t.TempDir()
	chemin := filepath.Join(dossier, nomFichier)
	if err := os.WriteFile(chemin, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}

	cl, err := ouvrirClassement(dossier, programmeDuDepot(t), nouvelleHorloge().maintenantFn)
	if err != nil {
		t.Fatalf("ouvrirClassement : %v", err)
	}
	if n := len(cl.identifiantsConnus()); n != 0 {
		t.Errorf("%d participant(s) apres un fichier illisible", n)
	}

	entrees, err := os.ReadDir(dossier)
	if err != nil {
		t.Fatal(err)
	}
	var misDeCote bool
	for _, e := range entrees {
		if strings.Contains(e.Name(), ".corrompu-") {
			misDeCote = true
		}
		if e.Name() == nomFichier {
			t.Error("classement.json est toujours la : le seul exemplaire a ete ecrase")
		}
	}
	if !misDeCote {
		t.Error("le fichier illisible n'a pas ete mis de cote")
	}
}

func TestOuvrirClassementRefuseUnDossierNonInscriptible(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root ecrit partout : la sonde ne peut rien detecter")
	}
	dossier := filepath.Join(t.TempDir(), "lecture-seule")
	if err := os.Mkdir(dossier, 0o500); err != nil {
		t.Fatal(err)
	}
	if _, err := ouvrirClassement(dossier, programmeDuDepot(t), nil); err == nil {
		t.Error("la sonde d'ecriture n'a pas vu un dossier non inscriptible")
	}
}

// --- La persistance --------------------------------------------------------

func TestLeClassementSurvitAUneReouverture(t *testing.T) {
	cl, dossier, h := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1", "s1-c2", "s1-r1")
	h.avancer(time.Minute)
	envoyer(t, cl, "Bibou", "1234", "s1-c1")

	avant := cl.lire(jourTest)

	// Le processus tue puis relance sur le meme repertoire.
	rouvert, err := ouvrirClassement(dossier, programmeDuDepot(t), h.maintenantFn)
	if err != nil {
		t.Fatalf("reouverture : %v", err)
	}
	apres := rouvert.lire(jourTest)

	if apres.Participants != avant.Participants {
		t.Fatalf("%d participant(s) apres reouverture, %d avant", apres.Participants, avant.Participants)
	}
	for i := range avant.Classement {
		if avant.Classement[i] != apres.Classement[i] {
			t.Errorf("ligne %d : %+v apres reouverture, %+v avant", i, apres.Classement[i], avant.Classement[i])
		}
	}
}

func TestLeCodeNEstJamaisStockeEnClair(t *testing.T) {
	cl, dossier, _ := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")

	contenu := lireFichier(t, dossier)
	if strings.Contains(contenu, "4821") {
		t.Error("le code apparait en clair dans classement.json")
	}
	if !strings.Contains(contenu, `"sel"`) || !strings.Contains(contenu, `"empreinte"`) {
		t.Error("sel ou empreinte manque : le code n'a pas ete derive")
	}
	// Aucun champ ne peut accueillir une donnee nominative : la fiche stockee
	// n'a que quatre champs, deux horodatages et deux cartes. On cherche la
	// forme CLE — « "prenom": » — et non la sous-chaine nue : le sel et
	// l'empreinte sont du base64 aleatoire, ou n'importe quelle suite de deux
	// lettres finit par apparaitre.
	for _, interdit := range []string{`"prenom"`, `"email"`, `"telephone"`, `"ip"`, `"agent"`} {
		if strings.Contains(contenu, interdit) {
			t.Errorf("le fichier porte un champ %s", interdit)
		}
	}
}

func TestDeuxEnregistrementsConcurrentsLaissentUnFichierValide(t *testing.T) {
	cl, dossier, _ := magasinDeTest(t)

	var attente sync.WaitGroup
	for i, pseudo := range []string{"Renard", "Bibou", "K7", "Lynx", "Ourson"} {
		attente.Add(1)
		go func(pseudo string, i int) {
			defer attente.Done()
			_, _, err := cl.enregistrer(envoiClassement{
				Pseudo: pseudo, Code: "1234", Faits: []string{"s1-c1", "s1-c2"},
			}, jourTest)
			if err != nil {
				t.Errorf("enregistrer(%s) : %v", pseudo, err)
			}
		}(pseudo, i)
	}
	attente.Wait()

	rouvert, err := ouvrirClassement(dossier, programmeDuDepot(t), nil)
	if err != nil {
		t.Fatalf("le fichier ecrit en concurrence est illisible : %v", err)
	}
	if n := len(rouvert.identifiantsConnus()); n != 5 {
		t.Errorf("%d participant(s) relus, attendu 5", n)
	}
}

// --- L'envoi ---------------------------------------------------------------

func TestLEnvoiRemplaceEtNAjoutePas(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	if rep := envoyer(t, cl, "Renard", "4821", "s1-c1", "s1-c2", "s1-r1"); rep.Cochees != 3 {
		t.Fatalf("cochees = %d, attendu 3", rep.Cochees)
	}
	// Decocher se propage : l'ensemble recu DEVIENT l'ensemble du participant.
	if rep := envoyer(t, cl, "Renard", "4821", "s1-c1"); rep.Cochees != 1 {
		t.Errorf("cochees = %d apres decochage, attendu 1", rep.Cochees)
	}
	if rep := envoyer(t, cl, "Renard", "4821"); rep.Cochees != 0 {
		t.Errorf("cochees = %d sur un ensemble vide, attendu 0", rep.Cochees)
	}
}

func TestLesHorodatagesSurviventAuRemplacement(t *testing.T) {
	cl, _, h := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1")
	premier := cl.parCle["renard"].Faits["s1-c1"]

	h.avancer(time.Hour)
	envoyer(t, cl, "Renard", "4821", "s1-c1", "s1-c2")

	if garde := cl.parCle["renard"].Faits["s1-c1"]; garde != premier {
		t.Errorf("s1-c1 horodate %s apres renvoi, attendu %s — le departage des ex aequo serait remis a zero", garde, premier)
	}
	if cl.parCle["renard"].Faits["s1-c2"] == premier {
		t.Error("s1-c2 a herite de l'horodatage du premier envoi")
	}
}

func TestLesIdentifiantsFutursEtInconnusSontIgnores(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	// s4-c1 appartient a la seance du 10 aout, posterieure au jour du serveur ;
	// « invente » n'existe dans aucun programme.
	rep := envoyer(t, cl, "Renard", "4821", "s1-c1", "s4-c1", "invente")
	if rep.Cochees != 1 {
		t.Errorf("cochees = %d, attendu 1", rep.Cochees)
	}
	if rep.Ignores != 2 {
		t.Errorf("ignores = %d, attendu 2", rep.Ignores)
	}
	// Ni comptes ni STOCKES : les stocker pour les compter le jour venu
	// recompenserait a retardement une horloge de telephone avancee.
	if _, present := cl.parCle["renard"].Faits["s4-c1"]; present {
		t.Error("un identifiant futur a ete stocke")
	}
}

func TestLeCodeAttacheLePseudonyme(t *testing.T) {
	cl, _, _ := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")

	_, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "0000", Faits: []string{}}, jourTest)
	if err != errCodeRefuse {
		t.Errorf("erreur = %v, attendu %v", err, errCodeRefuse)
	}
	// « renard » et « Renard » ne sont pas deux enfants sur un podium.
	_, _, err = cl.enregistrer(envoiClassement{Pseudo: "  renard  ", Code: "0000", Faits: []string{}}, jourTest)
	if err != errCodeRefuse {
		t.Errorf("cle d'unicite : erreur = %v, attendu %v", err, errCodeRefuse)
	}
}

func TestCinqRefusFermentLePseudonymeUnQuartDHeure(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")

	mauvais := envoiClassement{Pseudo: "Renard", Code: "0000", Faits: []string{}}
	for i := 1; i <= maxRefus; i++ {
		if _, _, err := cl.enregistrer(mauvais, jourTest); err != errCodeRefuse {
			t.Fatalf("essai %d : erreur = %v, attendu %v", i, err, errCodeRefuse)
		}
	}
	// Le sixieme est ferme, code correct ou non.
	if _, _, err := cl.enregistrer(mauvais, jourTest); err != errTropDEssais {
		t.Errorf("sixieme essai : erreur = %v, attendu %v", err, errTropDEssais)
	}
	if _, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821", Faits: []string{}}, jourTest); err != errTropDEssais {
		t.Error("le bon code passe pendant la penalite")
	}

	// La fenetre glisse : passe le quart d'heure, le pseudonyme rouvre.
	h.avancer(fenetreRefus + time.Second)
	if _, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821", Faits: []string{}}, jourTest); err != nil {
		t.Errorf("apres la fenetre : erreur = %v, attendu aucune", err)
	}
}

func TestLeGelFermeLEnvoiApresLaFinDuProgramme(t *testing.T) {
	cl, _, _ := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")

	apresLaFin := "2026-08-22"
	_, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821", Faits: []string{"s7-r6"}}, apresLaFin)
	if err != errClassementFige {
		t.Errorf("erreur = %v, attendu %v", err, errClassementFige)
	}
	// La suppression, elle, reste honoree : le gel protege le RANG, pas le
	// droit du PRD §14 d'effacer sa fiche.
	rep, err := cl.supprimer(envoiClassement{Pseudo: "Renard", Code: "4821", Supprimer: true}, apresLaFin)
	if err != nil {
		t.Fatalf("suppression apres le gel : %v", err)
	}
	if !rep.Supprime {
		t.Error("la suppression apres le gel n'a rien efface")
	}
}

func TestLePlafondBorneLesPseudonymesNouveaux(t *testing.T) {
	cl, _, _ := magasinDeTest(t)
	for i := range maxParticipants {
		envoyer(t, cl, "p"+string(rune('a'+i%26))+string(rune('a'+i/26)), "1234", "s1-c1")
	}
	if n := len(cl.identifiantsConnus()); n != maxParticipants {
		t.Fatalf("%d participant(s), attendu %d", n, maxParticipants)
	}
	_, _, err := cl.enregistrer(envoiClassement{Pseudo: "Tardif", Code: "1234", Faits: []string{}}, jourTest)
	if err != errClassementPlein {
		t.Errorf("erreur = %v, attendu %v", err, errClassementPlein)
	}
	// Les participants existants continuent normalement.
	envoyer(t, cl, "paa", "1234", "s1-c1", "s1-c2")
}

// --- La suppression --------------------------------------------------------

func TestLaSuppressionEstIdempotenteEtLibereLePseudonyme(t *testing.T) {
	cl, dossier, _ := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")
	envoyer(t, cl, "Bibou", "1111", "s1-c1")

	retrait := envoiClassement{Pseudo: "Renard", Code: "4821", Supprimer: true}
	rep, err := cl.supprimer(retrait, jourTest)
	if err != nil {
		t.Fatalf("supprimer : %v", err)
	}
	if !rep.Supprime || rep.Participants != 1 {
		t.Errorf("premiere suppression : %+v, attendu supprime=true participants=1", rep)
	}
	if contenu := lireFichier(t, dossier); strings.Contains(contenu, "Renard") {
		t.Error("le fichier porte encore Renard")
	}

	// Rejouee : 200 et supprime=false, jamais une erreur.
	rep, err = cl.supprimer(retrait, jourTest)
	if err != nil {
		t.Fatalf("suppression rejouee : %v", err)
	}
	if rep.Supprime || rep.Participants != 1 {
		t.Errorf("suppression rejouee : %+v, attendu supprime=false participants=1", rep)
	}

	// Le pseudonyme redevient libre, avec un AUTRE code : c'est le geste
	// « changer de nom » du PRD §7.4 vu depuis le serveur.
	if _, cree, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "9999", Faits: []string{}}, jourTest); err != nil || !cree {
		t.Errorf("recreation : cree=%v erreur=%v, attendu cree=true sans erreur", cree, err)
	}

	rouvert, err := ouvrirClassement(dossier, programmeDuDepot(t), nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, cle := range rouvert.identifiantsConnus() {
		if cle == "renard" {
			// La fiche recreee est legitime ; ce qu'on verifie est qu'elle
			// porte le nouveau code.
			if rouvert.parCle["renard"].verifierCode("4821") {
				t.Error("l'ancien code ouvre encore la fiche recreee")
			}
		}
	}
}

func TestLaSuppressionExigeLeCode(t *testing.T) {
	cl, _, _ := magasinDeTest(t)
	envoyer(t, cl, "Renard", "4821", "s1-c1")

	_, err := cl.supprimer(envoiClassement{Pseudo: "Renard", Code: "0000", Supprimer: true}, jourTest)
	if err != errCodeRefuse {
		t.Fatalf("erreur = %v, attendu %v", err, errCodeRefuse)
	}
	if len(cl.identifiantsConnus()) != 1 {
		t.Error("la fiche a ete effacee malgre un code refuse")
	}
	// Meme compteur que l'envoi : sans quoi la suppression serait le chemin le
	// moins cher pour attaquer un code a quatre chiffres.
	for range maxRefus {
		cl.supprimer(envoiClassement{Pseudo: "Renard", Code: "0000", Supprimer: true}, jourTest)
	}
	if _, err := cl.supprimer(envoiClassement{Pseudo: "Renard", Code: "0000", Supprimer: true}, jourTest); err != errTropDEssais {
		t.Errorf("erreur = %v, attendu %v", err, errTropDEssais)
	}
}

// --- Le classement ---------------------------------------------------------

func TestLesRangsSontStrictsEtLePremierArriveEstDevant(t *testing.T) {
	cl, _, h := magasinDeTest(t)

	// Trois participants a deux cases chacun : seul l'instant ou ils y sont
	// arrives les departage (PRD §9).
	envoyer(t, cl, "Premier", "1111", "s1-c1", "s1-c2")
	h.avancer(time.Minute)
	envoyer(t, cl, "Deuxieme", "2222", "s1-c1", "s1-c2")
	h.avancer(time.Minute)
	envoyer(t, cl, "Troisieme", "3333", "s1-c1", "s1-c2")

	r := cl.lire(jourTest)
	if r.Participants != 3 {
		t.Fatalf("participants = %d, attendu 3", r.Participants)
	}
	for i, attendu := range []string{"Premier", "Deuxieme", "Troisieme"} {
		if r.Classement[i].Rang != i+1 {
			t.Errorf("ligne %d : rang %d, attendu %d — les rangs doivent etre stricts", i, r.Classement[i].Rang, i+1)
		}
		if r.Classement[i].Pseudo != attendu {
			t.Errorf("ligne %d : %q, attendu %q", i, r.Classement[i].Pseudo, attendu)
		}
	}
}

func TestSeulesLesTroisPremieresLignesNomment(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	for i, pseudo := range []string{"Un", "Deux", "Trois", "Quatre", "Cinq"} {
		// Des scores decroissants, pour que l'ordre soit sans ambiguite.
		faits := []string{"s1-c1", "s1-c2", "s1-r1", "s1-r2", "s1-r3"}[:5-i]
		envoyer(t, cl, pseudo, "1234", faits...)
		h.avancer(time.Minute)
	}

	r := cl.lire(jourTest)
	for i, l := range r.Classement {
		// Le nom du quatrieme NE TRANSITE PAS : la regle est appliquee par le
		// serveur, donc aucun bogue d'affichage ne peut le faire apparaitre.
		if i < 3 && l.Pseudo == "" {
			t.Errorf("ligne %d : le podium doit nommer", i)
		}
		if i >= 3 && l.Pseudo != "" {
			t.Errorf("ligne %d : %q ne devrait pas transiter", i, l.Pseudo)
		}
	}
}

func TestLaJaugeDeGroupeEstVideSansParticipant(t *testing.T) {
	cl, _, _ := magasinDeTest(t)
	r := cl.lire(jourTest)
	if r.Participants != 0 || r.Groupe.Cochees != 0 || r.Groupe.Programmees != 0 || r.Groupe.Part != 0 {
		t.Errorf("classement vide : %+v", r)
	}
	if r.Classement == nil {
		t.Error("classement doit etre un tableau vide, pas null")
	}
}

func TestLaVueCoachNAjouteQueDesAgregats(t *testing.T) {
	cl, _, h := magasinDeTest(t)

	// Renard fait toute la premiere seance, Bibou une seule case, Muet rien.
	envoyer(t, cl, "Renard", "1111", "s1-c1", "s1-c2", "s1-r1", "s1-r2", "s1-r3", "s1-r4", "s1-r5", "s1-r6")
	h.avancer(time.Minute)
	envoyer(t, cl, "Bibou", "2222", "s1-c1")
	h.avancer(time.Minute)
	envoyer(t, cl, "Muet", "3333")

	c := cl.coach(jourTest)
	base := cl.lire(jourTest)

	// Le coach voit EXACTEMENT le tableau des enfants (PRD §7.6).
	if len(c.Classement) != len(base.Classement) {
		t.Fatalf("%d lignes chez le coach, %d chez les enfants", len(c.Classement), len(base.Classement))
	}
	for i := range base.Classement {
		if c.Classement[i] != base.Classement[i] {
			t.Errorf("ligne %d : %+v chez le coach, %+v chez les enfants", i, c.Classement[i], base.Classement[i])
		}
	}

	if c.Assiduite.Aucune != 1 {
		t.Errorf("assiduite.aucune = %d, attendu 1", c.Assiduite.Aucune)
	}
	if c.Assiduite.Aucune+c.Assiduite.Faible+c.Assiduite.Moyenne+c.Assiduite.Forte != 3 {
		t.Errorf("l'assiduite ne totalise pas les 3 participants : %+v", c.Assiduite)
	}

	// Trois seances sont programmees au jour du test.
	if len(c.Seances) != 3 {
		t.Fatalf("%d seance(s), attendu 3", len(c.Seances))
	}
	premiere := c.Seances[0]
	if premiere.Exercices != 8 || premiere.Cochees != 9 {
		t.Errorf("premiere seance : %+v, attendu 8 exercices et 9 cases cochees", premiere)
	}
	if premiere.ParticipantsActifs != 2 || premiere.ParticipantsAyantFini != 1 {
		t.Errorf("premiere seance : actifs=%d finis=%d, attendu 2 et 1", premiere.ParticipantsActifs, premiere.ParticipantsAyantFini)
	}
	// Le champ existe et reste a zero tant que le PRP 10 n'envoie rien.
	if c.Ressentis != (agregatRessentis{}) {
		t.Errorf("ressentis = %+v, attendu trois zeros", c.Ressentis)
	}
}

func TestLesRessentisSontAgregesEtValides(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	_, _, err := cl.enregistrer(envoiClassement{
		Pseudo: "Renard", Code: "4821", Faits: []string{"s1-c1"},
		Ressentis: map[string]string{"2026-08-03": "dur", "2026-08-05": "facile"},
	}, jourTest)
	if err != nil {
		t.Fatalf("enregistrer : %v", err)
	}
	c := cl.coach(jourTest)
	if c.Ressentis != (agregatRessentis{Facile: 1, Dur: 1}) {
		t.Errorf("ressentis = %+v, attendu 1 facile et 1 dur", c.Ressentis)
	}

	// Une date qui n'est pas une seance, ou une valeur hors des trois admises.
	for _, mauvais := range []map[string]string{
		{"2026-08-04": "dur"},
		{"2026-08-03": "epuisant"},
	} {
		_, _, err := cl.enregistrer(envoiClassement{
			Pseudo: "Renard", Code: "4821", Faits: []string{}, Ressentis: mauvais,
		}, jourTest)
		if err != errRessentisInvalide {
			t.Errorf("%v : erreur = %v, attendu %v", mauvais, err, errRessentisInvalide)
		}
	}
}

// --- Le pseudonyme et le code ---------------------------------------------

func TestNormaliserPseudo(t *testing.T) {
	cas := []struct {
		brut    string
		affiche string
		cle     string
		refuse  bool
	}{
		{brut: "Renard", affiche: "Renard", cle: "renard"},
		{brut: "  Le  Renard  ", affiche: "Le Renard", cle: "le renard"},
		{brut: "K7", affiche: "K7", cle: "k7"},
		{brut: "Léa", affiche: "Léa", cle: "léa"},
		{brut: "jean-luc_9", affiche: "jean-luc_9", cle: "jean-luc_9"},
		{brut: "R", refuse: true},
		{brut: "", refuse: true},
		{brut: "dix-sept-caracteres", refuse: true},
		{brut: "Renard‮", refuse: true}, // commande bidirectionnelle
		{brut: "Re​nard", refuse: true}, // largeur nulle
		{brut: "Léa", refuse: true},    // marque combinante
		{brut: "Renard!", refuse: true},
		{brut: "<script>", refuse: true},
	}

	for _, c := range cas {
		affiche, cle, err := normaliserPseudo(c.brut)
		if c.refuse {
			if err == nil {
				t.Errorf("%q accepte, attendu refuse", c.brut)
			}
			continue
		}
		if err != nil {
			t.Errorf("%q refuse : %v", c.brut, err)
			continue
		}
		if affiche != c.affiche || cle != c.cle {
			t.Errorf("%q -> (%q, %q), attendu (%q, %q)", c.brut, affiche, cle, c.affiche, c.cle)
		}
	}
}

func TestLeCodeEstQuatreChiffresEtAucunNEstInterdit(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	// Ni 0000 ni 1234 ne sont interdits : ce jeton ne protege rien, et
	// interdire donnerait a croire l'inverse.
	for _, code := range []string{"0000", "1234", "9999"} {
		if _, _, err := cl.enregistrer(envoiClassement{Pseudo: "P" + code, Code: code, Faits: []string{}}, jourTest); err != nil {
			t.Errorf("code %s refuse : %v", code, err)
		}
	}
	for _, code := range []string{"", "123", "12345", "abcd", "12 4", "١٢٣٤"} {
		_, _, err := cl.enregistrer(envoiClassement{Pseudo: "Autre", Code: code, Faits: []string{}}, jourTest)
		if err != errCodeInvalide {
			t.Errorf("code %q : erreur = %v, attendu %v", code, err, errCodeInvalide)
		}
	}
}

func TestFaitsAbsentEstRefuseMaisFaitsVideEstLegitime(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	// nil = champ absent ; [] = navigateur vide qui renvoie un ensemble vide.
	_, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821"}, jourTest)
	if err != errFaitsInvalide {
		t.Errorf("faits absent : erreur = %v, attendu %v", err, errFaitsInvalide)
	}
	if _, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821", Faits: []string{}}, jourTest); err != nil {
		t.Errorf("faits vide : erreur = %v, attendu aucune", err)
	}

	// Plus d'entrees que le programme n'a d'exercices : refuse AVANT toute
	// allocation par identifiant.
	trop := make([]string, totauxPrescrits(cl.prog).Cases+1)
	for i := range trop {
		trop[i] = "s1-c1"
	}
	if _, _, err := cl.enregistrer(envoiClassement{Pseudo: "Renard", Code: "4821", Faits: trop}, jourTest); err != errFaitsInvalide {
		t.Errorf("faits trop long : erreur = %v, attendu %v", err, errFaitsInvalide)
	}
}
