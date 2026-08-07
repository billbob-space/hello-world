package main

import (
	"errors"
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

// horlogeTest avance a la demande. Sans horloge injectable, on ne pourrait ni
// dater deux coches differemment — la fenetre de refus et la fusion d'une
// reprise en dependent — ni prouver que l'heure d'envoi ne departage PLUS les ex
// aequo : deux envois du meme test tomberaient dans la meme seconde.
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
		t.Errorf("s1-c1 horodate %s apres renvoi, attendu %s — la date de la premiere coche serait perdue", garde, premier)
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

// cases rend les n premiers identifiants de la premiere seance. Elle existe
// pour que les tests de rang se lisent comme des SCORES et non comme des listes
// d'identifiants : « quatre cases » dit ce qui compte, « s1-c1, s1-c2, ... » le
// cache.
func cases(n int) []string {
	return []string{"s1-c1", "s1-c2", "s1-r1", "s1-r2", "s1-r3"}[:n]
}

// peupler envoie une fiche par pseudonyme, toutes au meme score, en avancant
// l'horloge entre chacune : l'heure ne departage plus rien, et ces tests le
// verifient precisement en la faisant varier.
func peupler(t *testing.T, cl *classement, h *horlogeTest, n int, pseudos ...string) {
	t.Helper()
	for _, pseudo := range pseudos {
		envoyer(t, cl, pseudo, "1234", cases(n)...)
		h.avancer(time.Minute)
	}
}

func TestLesRangsSontPartagesAEgalite(t *testing.T) {
	cl, _, h := magasinDeTest(t)

	// Trois participants a deux cases, arrives a une minute d'intervalle, puis
	// un quatrieme a une seule case. L'heure d'arrivee ne departage plus : les
	// trois premiers PARTAGENT la premiere place (PRD §9).
	peupler(t, cl, h, 2, "Premier", "Deuxieme", "Troisieme")
	peupler(t, cl, h, 1, "Dernier")

	r := cl.lire(jourTest)
	if r.Participants != 4 {
		t.Fatalf("participants = %d, attendu 4", r.Participants)
	}
	for i, attendu := range []int{1, 1, 1, 4} {
		if r.Classement[i].Rang != attendu {
			t.Errorf("ligne %d : rang %d, attendu %d", i, r.Classement[i].Rang, attendu)
		}
	}
	// On compte les ENFANTS devant, jamais les scores : le quatrieme est 4e et
	// non 2e, sans quoi « 2e sur 4 » cacherait que trois enfants le devancent.
	if r.Classement[3].Rang == 2 {
		t.Error("le rang compte les scores et non les enfants devant")
	}
}

func TestLEnvoiRendLeNombreDExAequo(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	peupler(t, cl, h, 2, "Alpha", "Bravo", "Charlie")

	// La reponse a l'envoi porte le rang ET le nombre des AUTRES a ce rang :
	// sans lui, l'ecran dirait « 1er sur 3 » sans pouvoir dire « avec 2 autres »,
	// et le client devrait recalculer un rang qu'il n'a pas le droit de calculer.
	rep := envoyer(t, cl, "Alpha", "1234", cases(2)...)
	if rep.Rang != 1 || rep.ExAequo != 2 {
		t.Errorf("rang %d, exAequo %d — attendu 1 et 2", rep.Rang, rep.ExAequo)
	}

	seul := envoyer(t, cl, "Delta", "1234", cases(1)...)
	if seul.Rang != 4 || seul.ExAequo != 0 {
		t.Errorf("rang %d, exAequo %d — attendu 4 et 0", seul.Rang, seul.ExAequo)
	}
}

func TestLePodiumNommeLesTroisMeilleuresMarches(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	// Quatre marches : deux enfants a 4 cases, un a 3, trois a 2, un a 1.
	peupler(t, cl, h, 4, "Anna", "Bilal")
	peupler(t, cl, h, 3, "Chloe")
	peupler(t, cl, h, 2, "Dan", "Elias", "Fatou")
	peupler(t, cl, h, 1, "Gaspard")

	r := cl.lire(jourTest)
	for _, l := range r.Classement {
		// Une marche porte plusieurs prenoms : le podium en nomme six ici, la
		// ou l'ancienne regle en nommait trois et coupait une marche en deux.
		nomme := l.Cochees >= 2
		if nomme && l.Pseudo == "" {
			t.Errorf("rang %d (%d cases) : la marche doit nommer", l.Rang, l.Cochees)
		}
		if !nomme && l.Pseudo != "" {
			t.Errorf("rang %d : %q ne devrait pas transiter", l.Rang, l.Pseudo)
		}
	}
}

func TestUneMarcheTropPeupleeNeNommeQuePourElle(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	// Neuf enfants a egalite en tete : un de plus que le plafond de noms. Puis
	// un enfant seul sur sa marche.
	peupler(t, cl, h, 2, "Aa", "Bb", "Cc", "Dd", "Ee", "Ff", "Gg", "Hh", "Ii")
	peupler(t, cl, h, 1, "Zz")

	r := cl.lire(jourTest)
	for _, l := range r.Classement {
		// La marche de tete se tait : neuf pseudonymes de mineurs n'ont pas a
		// etre epeles sur une page publique. Celle du dessous nomme quand meme —
		// cacher le prenom d'un enfant SEUL sur sa marche ne protege rien.
		if l.Cochees == 2 && l.Pseudo != "" {
			t.Errorf("rang %d : %q ne devrait pas transiter", l.Rang, l.Pseudo)
		}
		if l.Cochees == 1 && l.Pseudo != "Zz" {
			t.Errorf("rang %d : la marche d'un seul enfant doit nommer, recu %q", l.Rang, l.Pseudo)
		}
	}
}

func TestLePlafondNeVautQuePourSaPropreMarche(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	// Six en tete, puis trois : neuf noms en tout, et pourtant les deux marches
	// nomment — chacune tient seule sous le plafond.
	peupler(t, cl, h, 3, "Aa", "Bb", "Cc", "Dd", "Ee", "Ff")
	peupler(t, cl, h, 2, "Gg", "Hh", "Ii")
	peupler(t, cl, h, 1, "Zz")

	r := cl.lire(jourTest)
	nommes := 0
	for _, l := range r.Classement {
		if l.Pseudo != "" {
			nommes++
		}
	}
	if nommes != 10 {
		t.Errorf("%d noms transitent, attendu 10 — les trois marches tiennent chacune sous le plafond", nommes)
	}
}

func TestSeulesLesTroisPremieresMarchesNomment(t *testing.T) {
	cl, _, h := magasinDeTest(t)
	peupler(t, cl, h, 4, "Aa")
	peupler(t, cl, h, 3, "Bb")
	peupler(t, cl, h, 2, "Cc")
	peupler(t, cl, h, 1, "Zz")

	r := cl.lire(jourTest)
	for _, l := range r.Classement {
		// La quatrieme marche n'est pas un podium, quel que soit son effectif :
		// son nom NE TRANSITE PAS, donc aucun bogue d'affichage ne peut le faire
		// apparaitre.
		if l.Cochees == 1 && l.Pseudo != "" {
			t.Errorf("la quatrieme marche ne doit pas nommer, recu %q", l.Pseudo)
		}
		if l.Cochees > 1 && l.Pseudo == "" {
			t.Errorf("rang %d : les trois premieres marches nomment", l.Rang)
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

// reprendre est l'envoi du SEUL ecran ou l'on saisit un code : celui d'un
// telephone qui se rattache a une fiche qu'il ne connait pas encore.
func reprendre(t *testing.T, cl *classement, pseudo, code string, faits ...string) reponseEnvoi {
	t.Helper()
	if faits == nil {
		faits = []string{}
	}
	rep, _, err := cl.enregistrer(envoiClassement{
		Pseudo: pseudo, Code: code, Faits: faits, Reprise: true,
	}, jourTest)
	if err != nil {
		t.Fatalf("enregistrer(%s, reprise) : %v", pseudo, err)
	}
	return rep
}

func TestUnSecondTelephoneRecupereEtNEffaceRien(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1", "s1-c2", "s1-r1")

	// Le second telephone n'a rien coche : sans le drapeau, son ensemble vide
	// remplacerait la fiche et l'enfant retomberait a zero au classement. C'est
	// exactement le defaut constate en production le 2026-08-07.
	rep := reprendre(t, cl, "Renard", "4821")
	if rep.Cochees != 3 {
		t.Fatalf("cochees = %d apres reprise a vide, attendu 3 — la fiche a ete effacee", rep.Cochees)
	}
	if len(rep.Faits) != 3 {
		t.Fatalf("faits rendus = %d, attendu 3 — le telephone ne peut pas se remettre a jour", len(rep.Faits))
	}
	for _, id := range []string{"s1-c1", "s1-c2", "s1-r1"} {
		if rep.Faits[id] == "" {
			t.Errorf("%s absent de la fiche rendue", id)
		}
	}
}

func TestLaRepriseUnitLesDeuxTelephones(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1")
	// Le second telephone a coche autre chose de son cote, hors ligne.
	rep := reprendre(t, cl, "Renard", "4821", "s1-c2")

	if rep.Cochees != 2 {
		t.Fatalf("cochees = %d, attendu 2 — l'union des deux telephones", rep.Cochees)
	}
	if rep.Faits["s1-c1"] == "" || rep.Faits["s1-c2"] == "" {
		t.Errorf("faits rendus = %v, attendu les deux identifiants", rep.Faits)
	}
}

func TestLaRepriseNeRajeunitPasUneMarque(t *testing.T) {
	cl, _, h := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1")
	premier := cl.parCle["renard"].Faits["s1-c1"]

	h.avancer(time.Hour)
	rep := reprendre(t, cl, "Renard", "4821", "s1-c1")

	// L'horodatage dit QUAND la case a ete cochee pour la premiere fois. Une
	// reprise le rajeunirait de plusieurs jours sans que rien ne le signale : le
	// fichier raconterait alors une histoire fausse, et c'est le seul endroit ou
	// elle se lit.
	if garde := cl.parCle["renard"].Faits["s1-c1"]; garde != premier {
		t.Errorf("s1-c1 horodate %s apres reprise, attendu %s", garde, premier)
	}
	if rep.Faits["s1-c1"] != premier {
		t.Errorf("la fiche rendue porte %s, attendu %s", rep.Faits["s1-c1"], premier)
	}
}

func TestUnEnvoiOrdinaireNeRendJamaisLaFiche(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	// Un enfant qui coche ne recoit pas la liste de ce qu'il a deja coche : il
	// l'a deja, et la fiche ne repart que vers qui vient de prouver qu'il
	// connait le code qui l'ouvre, au moment ou il le demande.
	if rep := envoyer(t, cl, "Renard", "4821", "s1-c1"); rep.Faits != nil {
		t.Errorf("faits rendus sur un envoi ordinaire : %v", rep.Faits)
	}
	if rep := envoyer(t, cl, "Renard", "4821", "s1-c1", "s1-c2"); rep.Faits != nil {
		t.Errorf("faits rendus sur une mise a jour : %v", rep.Faits)
	}
}

func TestLaRepriseExigeLeCodeCommeLeReste(t *testing.T) {
	cl, _, _ := magasinDeTest(t)

	envoyer(t, cl, "Renard", "4821", "s1-c1")

	// Le drapeau ne desserre RIEN : il change ce que l'envoi fait de l'ensemble
	// recu, jamais qui a le droit de l'envoyer. Sans cette assertion, « reprise »
	// serait une porte pour lire la fiche de n'importe quel nom du podium.
	_, _, err := cl.enregistrer(envoiClassement{
		Pseudo: "Renard", Code: "0000", Faits: []string{}, Reprise: true,
	}, jourTest)
	if !errors.Is(err, errCodeRefuse) {
		t.Fatalf("err = %v, attendu code-refuse", err)
	}
	if cl.parCle["renard"].Faits["s1-c1"] == "" {
		t.Error("un code refuse a tout de meme touche a la fiche")
	}
}
