package main

import (
	"errors"
	"testing"
	"time"
)

func parisTest(t *testing.T, valeur string) time.Time {
	t.Helper()
	tm, err := time.ParseInLocation("2006-01-02 15:04", valeur, parisTZ)
	if err != nil {
		t.Fatal(err)
	}
	return tm
}

func abonnementDeTest() *AbonnementPush {
	return &AbonnementPush{Endpoint: "https://push.example/abc", P256dh: "cle", Auth: "secret"}
}

// TestRappelDu couvre la decision pure du rappel de seance (PRODUIT
// "Notifications : rappel de seance et mots doux", 9 aout 2026) : opt-in, au
// plus une fois par jour, seulement si la seance n'est pas deja faite, a
// l'heure choisie (defaut 18:00).
func TestRappelDu(t *testing.T) {
	cas := []struct {
		nom        string
		profil     Profil
		cas        Cas
		maintenant time.Time
		attendu    bool
	}{
		{
			nom:        "sans abonnement, rien n'est jamais du",
			profil:     Profil{},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    false,
		},
		{
			nom:        "jour de repos : jamais de rappel",
			profil:     Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}},
			cas:        CasRepos,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    false,
		},
		{
			nom:        "seance deja faite : jamais de rappel",
			profil:     Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}},
			cas:        CasDejaFaite,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    false,
		},
		{
			nom:        "a faire, avant l'heure par defaut : pas encore",
			profil:     Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 17:59"),
			attendu:    false,
		},
		{
			nom:        "a faire, a l'heure par defaut pile : du",
			profil:     Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    true,
		},
		{
			nom:        "a faire, apres l'heure par defaut : du",
			profil:     Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 22:00"),
			attendu:    true,
		},
		{
			nom: "heure choisie differente du defaut, respectee",
			profil: Profil{Notifications: Notifications{
				Abonnement:  abonnementDeTest(),
				HeureRappel: "07:30",
			}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 18:00"), // l'heure par defaut est deja passee, mais 07:30 est l'heure choisie
			attendu:    true,
		},
		{
			nom: "heure choisie pas encore atteinte",
			profil: Profil{Notifications: Notifications{
				Abonnement:  abonnementDeTest(),
				HeureRappel: "20:00",
			}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    false,
		},
		{
			nom: "deja envoye aujourd'hui : jamais deux fois, meme apres un redemarrage",
			profil: Profil{Notifications: Notifications{
				Abonnement:    abonnementDeTest(),
				DernierRappel: "2026-08-09",
			}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 23:00"),
			attendu:    false,
		},
		{
			nom: "un jour different du dernier rappel : de nouveau du",
			profil: Profil{Notifications: Notifications{
				Abonnement:    abonnementDeTest(),
				DernierRappel: "2026-08-08",
			}},
			cas:        CasAFaire,
			maintenant: parisTest(t, "2026-08-09 18:00"),
			attendu:    true,
		},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			if got := RappelDu(c.profil, c.cas, c.maintenant); got != c.attendu {
				t.Fatalf("RappelDu() = %v, attendu %v", got, c.attendu)
			}
		})
	}
}

func TestHeureValide(t *testing.T) {
	cas := []struct {
		heure   string
		attendu bool
	}{
		{"18:00", true},
		{"00:00", true},
		{"23:59", true},
		{"9:00", false},  // pas zero-pad
		{"24:00", false}, // heure hors bornes
		{"18:60", false}, // minute hors bornes
		{"", false},
		{"dix-huit heures", false},
	}
	for _, c := range cas {
		t.Run(c.heure, func(t *testing.T) {
			if got := heureValide(c.heure); got != c.attendu {
				t.Fatalf("heureValide(%q) = %v, attendu %v", c.heure, got, c.attendu)
			}
		})
	}
}

// TestMotDouxDuSansAbonnementJamaisDu verifie l'opt-in : quel que soit le
// moment, un profil sans abonnement ne recoit jamais de mot doux.
func TestMotDouxDuSansAbonnementJamaisDu(t *testing.T) {
	profil := Profil{}
	for jour := range 14 {
		maintenant := parisTest(t, "2026-08-09 12:00").AddDate(0, 0, jour)
		if MotDouxDu("un-id", profil, maintenant) {
			t.Fatalf("mot doux du sans abonnement, jour %d", jour)
		}
	}
}

// TestMotDouxDuAuPlusTroisParSemaine parcourt minute par minute une semaine
// entiere (PRODUIT : "jusqu'a trois par semaine") pour un profil abonne, et
// verifie qu'au plus trois instants sont retenus dans la fenetre 9h-21h.
func TestMotDouxDuAuPlusTroisParSemaine(t *testing.T) {
	profil := Profil{Notifications: Notifications{Abonnement: abonnementDeTest()}}
	debut := parisTest(t, "2026-08-03 00:00") // un lundi
	var instants []time.Time
	for cur := debut; cur.Before(debut.AddDate(0, 0, 7)); cur = cur.Add(time.Minute) {
		if MotDouxDu("profil-de-test", profil, cur) {
			instants = append(instants, cur)
			// Simule la persistance immediate (main.go) : plus rien n'est du le
			// meme jour une fois envoye.
			profil.Notifications.DernierMotDoux = cur.Format("2006-01-02")
		}
	}
	if len(instants) == 0 {
		t.Fatal("aucun mot doux du sur une semaine entiere")
	}
	if len(instants) > 3 {
		t.Fatalf("%d mots doux dus sur une semaine, attendu au plus 3 : %v", len(instants), instants)
	}
	for _, inst := range instants {
		if inst.Hour() < 9 || inst.Hour() >= 21 {
			t.Fatalf("mot doux hors fenetre 9h-21h : %v", inst)
		}
	}
	// Deux instants distincts ne tombent jamais le meme jour (DernierMotDoux
	// l'empeche), meme sans la simulation de persistance ci-dessus.
	jours := map[string]bool{}
	for _, inst := range instants {
		j := inst.Format("2006-01-02")
		if jours[j] {
			t.Fatalf("deux mots doux le meme jour : %s", j)
		}
		jours[j] = true
	}
}

// TestMotDouxDuStablePourLeMemeProfilEtLaMemeSemaine verifie que le tirage des
// jours et de l'heure est deterministe (memes id et semaine -> memes jours),
// condition necessaire pour survivre a un redemarrage sans perdre ni doubler
// un envoi programme.
func TestMotDouxDuStablePourLeMemeProfilEtLaMemeSemaine(t *testing.T) {
	a := motDouxJoursDeLaSemaine("profil-x", "2026-W32")
	b := motDouxJoursDeLaSemaine("profil-x", "2026-W32")
	if len(a) == 0 {
		t.Fatal("aucun jour choisi")
	}
	if len(a) != len(b) {
		t.Fatalf("tirages differents entre deux appels : %v puis %v", a, b)
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("tirages differents entre deux appels : %v puis %v", a, b)
		}
	}
}

// TestMotDouxJoursVarieParProfil verifie que deux profils differents ne
// recoivent pas systematiquement leurs mots doux le meme jour — sans quoi la
// fenetre 9h-21h serait sature au meme instant pour tout le monde.
func TestMotDouxJoursVarieParProfil(t *testing.T) {
	a := motDouxJoursDeLaSemaine("profil-a", "2026-W32")
	b := motDouxJoursDeLaSemaine("profil-b", "2026-W32")
	if len(a) == 0 || len(b) == 0 {
		t.Fatal("aucun jour choisi")
	}
	identiques := len(a) == len(b)
	if identiques {
		for i := range a {
			if a[i] != b[i] {
				identiques = false
				break
			}
		}
	}
	if identiques {
		t.Fatalf("deux profils differents tirent exactement les memes jours : %v", a)
	}
}

// mockNotifieur enregistre les envois plutot que d'atteindre un vrai service
// de push (memoire vive uniquement, jamais de reseau) : c'est ce qui rend
// verifierNotifications testable.
type mockNotifieur struct {
	envois []envoiEnregistre
	erreur error // si non nil, renvoye par chaque appel a Envoyer
}

type envoiEnregistre struct {
	abonnement AbonnementPush
	titre      string
	corps      string
}

func (m *mockNotifieur) Envoyer(abonnement AbonnementPush, titre, corps string) error {
	if m.erreur != nil {
		return m.erreur
	}
	m.envois = append(m.envois, envoiEnregistre{abonnement: abonnement, titre: titre, corps: corps})
	return nil
}

// TestVerifierNotificationsEnvoieLeRappelEtPersiste verifie l'integration
// planificateur + decision + persistance (PRODUIT "Notifications") : un profil
// abonne, dont la seance du jour n'est pas faite, apres l'heure choisie, recoit
// exactement un rappel, et la date est persistee pour ne jamais en renvoyer un
// second le meme jour.
func TestVerifierNotificationsEnvoieLeRappelEtPersiste(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfilParID(racine, "abc123", Profil{
		Reponses:      Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:       Niveaux{Ventre: 1, Cuisses: 1},
		Notifications: Notifications{Abonnement: abonnementDeTest()},
	}); err != nil {
		t.Fatal(err)
	}
	notifieur := &mockNotifieur{}
	maintenant := parisTest(t, "2026-08-09 18:00")

	verifierNotifications(chargerDictionnaireDeTest(t), messagesDeTest(), racine, notifieur, maintenant)

	if len(notifieur.envois) != 1 {
		t.Fatalf("%d envoi(s), attendu 1", len(notifieur.envois))
	}
	apres, err := LireProfilParID(racine, "abc123")
	if err != nil {
		t.Fatal(err)
	}
	if apres.Notifications.DernierRappel != "2026-08-09" {
		t.Fatalf("dernier_rappel = %q, attendu 2026-08-09", apres.Notifications.DernierRappel)
	}

	// Une seconde verification la meme minute (redemarrage du conteneur) ne
	// renvoie rien de plus.
	verifierNotifications(chargerDictionnaireDeTest(t), messagesDeTest(), racine, notifieur, maintenant)
	if len(notifieur.envois) != 1 {
		t.Fatalf("apres une seconde verification : %d envoi(s), attendu toujours 1 (pas de doublon)", len(notifieur.envois))
	}
}

// TestVerifierNotificationsJourDeReposNEnvoieRien verifie qu'un jour non actif
// (repos) ne declenche jamais de rappel — PRODUIT : "ce canal ne doit jamais
// devenir une pression".
func TestVerifierNotificationsJourDeReposNEnvoieRien(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfilParID(racine, "repos1", Profil{
		Reponses:      Reponses{JoursActifs: nil}, // aucun jour actif : toujours repos
		Notifications: Notifications{Abonnement: abonnementDeTest()},
	}); err != nil {
		t.Fatal(err)
	}
	notifieur := &mockNotifieur{}
	verifierNotifications(chargerDictionnaireDeTest(t), messagesDeTest(), racine, notifieur, parisTest(t, "2026-08-09 18:00"))
	if len(notifieur.envois) != 0 {
		t.Fatalf("%d envoi(s) un jour de repos, attendu 0", len(notifieur.envois))
	}
}

// TestVerifierNotificationsSansAbonnementNEnvoieRien verifie l'opt-in au
// niveau du planificateur, pas seulement de RappelDu.
func TestVerifierNotificationsSansAbonnementNEnvoieRien(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfilParID(racine, "sansabo", Profil{
		Reponses: Reponses{JoursActifs: tousLesJoursDeTest()},
	}); err != nil {
		t.Fatal(err)
	}
	notifieur := &mockNotifieur{}
	verifierNotifications(chargerDictionnaireDeTest(t), messagesDeTest(), racine, notifieur, parisTest(t, "2026-08-09 18:00"))
	if len(notifieur.envois) != 0 {
		t.Fatalf("%d envoi(s) sans abonnement, attendu 0", len(notifieur.envois))
	}
}

// TestVerifierNotificationsAbonnementExpireEstEfface verifie que le
// planificateur retire un abonnement revoque (ErrAbonnementExpire) du profil,
// pour ne jamais reessayer un envoi voue a l'echec a la minute suivante.
func TestVerifierNotificationsAbonnementExpireEstEfface(t *testing.T) {
	racine := t.TempDir()
	if err := EcrireProfilParID(racine, "expire1", Profil{
		Reponses:      Reponses{JoursActifs: tousLesJoursDeTest()},
		Niveaux:       Niveaux{Ventre: 1, Cuisses: 1},
		Notifications: Notifications{Abonnement: abonnementDeTest()},
	}); err != nil {
		t.Fatal(err)
	}
	notifieur := &mockNotifieur{erreur: ErrAbonnementExpire}
	verifierNotifications(chargerDictionnaireDeTest(t), messagesDeTest(), racine, notifieur, parisTest(t, "2026-08-09 18:00"))

	apres, err := LireProfilParID(racine, "expire1")
	if err != nil {
		t.Fatal(err)
	}
	if apres.Notifications.Abonnement != nil {
		t.Fatal("abonnement expire non efface du profil")
	}
}

// TestNotifieurAbsentNeFaitRienPlanter verifie la regle imperative "l'app
// demarre sans intervention" : sans cles VAPID (nouveauNotifieur rend nil),
// lancerPlanificateurNotifications ne doit jamais paniquer.
func TestNotifieurAbsentNeFaitRienPlanter(t *testing.T) {
	lancerPlanificateurNotifications(Dictionnaire{}, Messages{}, t.TempDir(), nil)
}

func TestNouveauNotifieurSansVariablesEnvironnement(t *testing.T) {
	t.Setenv("VAPID_PUBLIC_KEY", "")
	t.Setenv("VAPID_PRIVATE_KEY", "")
	t.Setenv("VAPID_CONTACT", "")
	n, cle := nouveauNotifieur()
	if n != nil || cle != "" {
		t.Fatalf("notifieur = %v, cle = %q ; attendu (nil, \"\") sans variables d'environnement", n, cle)
	}
}

func TestErrAbonnementExpireEstUneErreurNommee(t *testing.T) {
	if !errors.Is(ErrAbonnementExpire, ErrAbonnementExpire) {
		t.Fatal("ErrAbonnementExpire devrait se reconnaitre lui-meme via errors.Is")
	}
}
