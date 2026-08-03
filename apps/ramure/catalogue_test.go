package main

import (
	"strings"
	"testing"
	"time"
)

// ═══ F-22 — un album releve d'UN SEUL type ═════════════════════════════
//
// Symptome interdit : le filtre annonce « 12 albums studio » et en affiche 9,
// parce qu'un disque est tombe dans deux bacs ou dans aucun.

func TestChaqueSortieRecoitExactementUnType(t *testing.T) {
	cas := []struct {
		typeSource, titre, veut string
	}{
		// Le type declare par la source prime quand il est net.
		{"single", "Glory Box", typeCourt},
		{"ep", "Airbag / How Am I Driving?", typeCourt},
		{"compilation", "Greatest Hits", typeCompilation},

		// Sinon, le titre decide.
		{"album", "Dummy", typeStudio},
		{"album", "Roseland NYC Live", typeLive},
		{"album", "Live at Leeds", typeLive},
		{"album", "MTV Unplugged in New York", typeLive},
		{"album", "The Best of Portishead", typeCompilation},
		{"album", "Anthologie", typeCompilation},
		{"album", "Third", typeStudio},

		// Un live declare compilation reste un live : c'est ce que
		// l'utilisateur entend en l'ecoutant.
		{"compilation", "Live at the BBC", typeLive},

		// Le studio est le defaut, jamais un cas detecte : aucune sortie ne
		// reste sans type.
		{"", "Un titre parfaitement quelconque", typeStudio},
		{"album", "", typeStudio},
	}

	for _, c := range cas {
		got := classeSortie(c.typeSource, c.titre)
		if got != c.veut {
			t.Errorf("classeSortie(%q, %q) = %q, veut %q", c.typeSource, c.titre, got, c.veut)
		}
		// Le type rendu doit TOUJOURS etre un des quatre declares : un
		// cinquieme casserait le filtre sans erreur visible.
		connu := false
		for _, tt := range TypesDeSortie {
			if got == tt {
				connu = true
			}
		}
		if !connu {
			t.Errorf("classeSortie(%q, %q) = %q, hors des quatre types de la F-22", c.typeSource, c.titre, got)
		}
	}
}

// Symptome interdit : la discographie affiche « Dummy », « Dummy (Remastered
// 2024) » et « Dummy (Deluxe Edition) » comme trois albums differents.
func TestLesReeditionsNeDoiventPasApparaitreCommeDesAlbumsDifferents(t *testing.T) {
	memeOeuvre := []string{
		"Dummy",
		"Dummy (Remastered 2024)",
		"Dummy [Deluxe Edition]",
		"Dummy (Expanded)",
		"Dummy (20th Anniversary Edition)",
		"Dummy (Bonus Tracks)",
	}

	canon := normalise(titreCanonique(memeOeuvre[0]))
	for _, titre := range memeOeuvre[1:] {
		if got := normalise(titreCanonique(titre)); got != canon {
			t.Errorf("titreCanonique(%q) = %q, veut %q : la discographie afficherait un doublon", titre, got, canon)
		}
	}
}

// L'inverse est tout aussi important : un vrai titre ne doit pas etre tronque.
func TestUnVraiTitreNeDoitJamaisEtreTronque(t *testing.T) {
	cas := [][2]string{
		{"Kid A Mnesia", "Kid A Mnesia"},
		{"Portishead (Live)", "Portishead (Live)"}, // une autre oeuvre, pas un pressage
		{"The Dark Side of the Moon", "The Dark Side of the Moon"},
		{"(What's the Story) Morning Glory?", "(What's the Story) Morning Glory?"},
		{"Untitled (", "Untitled ("}, // parenthese jamais refermee
	}
	for _, c := range cas {
		if got := titreCanonique(c[0]); got != c[1] {
			t.Errorf("titreCanonique(%q) = %q, veut %q", c[0], got, c[1])
		}
	}
}

// ═══ F-21 — le classement par appreciation ═════════════════════════════
//
// "Les albums NON APPRECIES conservent un ordre stable."
//
// Symptome interdit : sur un genre mal couvert par la source d'appreciation —
// c'est-a-dire exactement ceux que le produit sert le mieux — la discographie
// parait melangee au hasard.

func TestLesAlbumsNonApprecieConserventLeurOrdreDOrigine(t *testing.T) {
	albums := []Album{
		{Titre: "A", Annee: 1990},
		{Titre: "B", Annee: 1992},
		{Titre: "C", Annee: 1994},
		{Titre: "D", Annee: 1996},
	}

	classe := classeParAppreciation(albums)

	for i, a := range classe {
		if a.Titre != albums[i].Titre {
			t.Fatalf("position %d : %q, veut %q — sans appreciation, l'ordre du catalogue doit etre conserve tel quel",
				i, a.Titre, albums[i].Titre)
		}
	}
}

func TestLesAlbumsApprecieRemontentSansReleguerLesAutresAuHasard(t *testing.T) {
	albums := []Album{
		{Titre: "Sans note 1"},
		{Titre: "Moyen", Note: .5, Votes: 10000},
		{Titre: "Sans note 2"},
		{Titre: "Excellent", Note: .95, Votes: 50000},
		{Titre: "Sans note 3"},
	}

	classe := classeParAppreciation(albums)

	if classe[0].Titre != "Excellent" || classe[1].Titre != "Moyen" {
		t.Fatalf("tete du classement : %q puis %q, veut Excellent puis Moyen", classe[0].Titre, classe[1].Titre)
	}
	// Les trois non notes suivent, dans leur ordre d'origine.
	for i, veut := range []string{"Sans note 1", "Sans note 2", "Sans note 3"} {
		if classe[2+i].Titre != veut {
			t.Errorf("position %d : %q, veut %q — l'ordre d'origine des non notes est perdu", 2+i, classe[2+i].Titre, veut)
		}
	}
}

// Une note portee par une poignee d'ecoutes remonterait en tete devant l'album
// de reference de l'artiste : le seuil de votes l'en empeche (§09, role 3).
func TestUneNoteNonSignificativeNeRemontePasEnTete(t *testing.T) {
	albums := []Album{
		{Titre: "Reference", Note: .9, Votes: 100000},
		{Titre: "Obscur", Note: 1.0, Votes: 3}, // note parfaite, 3 ecoutes
	}

	classe := classeParAppreciation(albums)
	if classe[0].Titre != "Reference" {
		t.Errorf("tete = %q : un album a 3 ecoutes passe devant l'album de reference", classe[0].Titre)
	}
}

func TestLAppreciationSePoseSurLeBonAlbumMalgreLesReeditions(t *testing.T) {
	albums := []Album{
		{Titre: "Dummy (Remastered 2024)"},
		{Titre: "Third"},
	}
	notes := map[string]Appreciation{
		normalise("Dummy"): {Note: .9, Votes: 40000},
		normalise("Third"): {Note: .7, Votes: 20000},
	}

	appliqueAppreciations(albums, notes)

	if albums[0].Votes != 40000 {
		t.Errorf("la reedition de Dummy n'a pas recu sa note (%d votes) : le classement l'ignorerait", albums[0].Votes)
	}
	if albums[1].Votes != 20000 {
		t.Errorf("Third n'a pas recu sa note")
	}
}

// ═══ Role 1 — la reponderation ═════════════════════════════════════════

func TestLaMesureDAffiniteRemplaceLOrdreQuandElleExiste(t *testing.T) {
	vivier := []Voisin{
		{Artiste: Artiste{Nom: "Premier selon le rang"}, Affinite: 1.0},
		{Artiste: Artiste{Nom: "Deuxieme selon le rang"}, Affinite: 0.8},
	}
	// La mesure dit l'inverse du rang.
	mesures := map[string]float64{
		normalise("Premier selon le rang"):  0.2,
		normalise("Deuxieme selon le rang"): 0.95,
	}

	out := reponderePar(vivier, mesures)

	if out[1].Affinite <= out[0].Affinite {
		t.Errorf("affinites %.3f et %.3f : la mesure n'a pas pris le pas sur le rang", out[0].Affinite, out[1].Affinite)
	}
}

func TestUnVoisinAbsentDeLaMesureResteDansLeVivier(t *testing.T) {
	vivier := []Voisin{{Artiste: Artiste{Nom: "Inconnu de last.fm"}, Affinite: 0.9}}
	out := reponderePar(vivier, map[string]float64{})

	if len(out) != 1 {
		t.Fatalf("%d voisins, veut 1 : la variete du tirage serait appauvrie", len(out))
	}
	if out[0].Affinite <= 0 {
		t.Error("affinite nulle : la branche serait invisible")
	}
	if out[0].Affinite >= 0.9 {
		t.Error("aucune decote : un voisin confirme par une seule source vaut moins qu'un confirme par deux")
	}
}

func TestLaReponderationNeModifieJamaisLeVivierDOrigine(t *testing.T) {
	vivier := []Voisin{{Artiste: Artiste{Nom: "A"}, Affinite: 0.9}}
	reponderePar(vivier, map[string]float64{normalise("A"): 0.1})

	if vivier[0].Affinite != 0.9 {
		t.Error("le vivier d'origine a ete modifie : il est partage par le cache, donc par tous les utilisateurs")
	}
}

// ═══ F-26 — les liens d'ecoute ═════════════════════════════════════════
//
// "Un lien mene a la page la plus precise atteignable ; a defaut, a une
// recherche pre-remplie — JAMAIS a une page vide ou erronee."

func TestUnLienDEcouteNEstJamaisVide(t *testing.T) {
	art := Artiste{Nom: "Portishead", LienSource: "https://www.deezer.com/artist/1069"}
	alb := Album{Titre: "Dummy", LienSource: "https://www.deezer.com/album/1"}

	for _, s := range ServicesEcoute {
		if lien := LienArtiste(art, s.Cle); lien == "" {
			t.Errorf("%s : lien d'artiste vide — l'utilisateur arrive au bout du parcours sans pouvoir ecouter", s.Nom)
		}
		if lien := LienAlbum(alb, art.Nom, s.Cle); lien == "" {
			t.Errorf("%s : lien d'album vide", s.Nom)
		}
	}
}

func TestLeLienExactEstPrefereALaRechercheQuandIlExiste(t *testing.T) {
	art := Artiste{Nom: "Portishead", LienSource: "https://www.deezer.com/artist/1069"}
	if got := LienArtiste(art, "deezer"); got != art.LienSource {
		t.Errorf("LienArtiste = %q, veut le lien exact %q", got, art.LienSource)
	}
}

func TestUnServiceSansLienExactRetombeSurUneRecherchePreRemplie(t *testing.T) {
	art := Artiste{Nom: "Sigur Rós", LienSource: "https://www.deezer.com/artist/1"}

	lien := LienArtiste(art, "spotify")
	if !strings.HasPrefix(lien, "https://open.spotify.com/search/") {
		t.Fatalf("LienArtiste = %q, veut une recherche Spotify", lien)
	}
	if !strings.Contains(lien, "Sigur") {
		t.Errorf("la recherche n'est pas pre-remplie : %q", lien)
	}
}

// Le repli d'album associe le nom de l'artiste au titre : "Mezzanine" seul
// ramene une dizaine d'oeuvres homonymes, ce qui serait la « page erronee » que
// la F-26 interdit.
func TestLaRechercheDAlbumInclutLeNomDeLArtiste(t *testing.T) {
	alb := Album{Titre: "Mezzanine (Remastered)"}
	lien := LienAlbum(alb, "Massive Attack", "tidal")

	if !strings.Contains(lien, "Massive") || !strings.Contains(lien, "Mezzanine") {
		t.Errorf("lien = %q : sans le nom de l'artiste, la recherche tombe sur un homonyme", lien)
	}
	if strings.Contains(lien, "Remastered") {
		t.Errorf("lien = %q : la mention de reedition pollue la recherche", lien)
	}
}

func TestUnServiceInconnuNePriveJamaisDeLien(t *testing.T) {
	art := Artiste{Nom: "Portishead", LienSource: "https://www.deezer.com/artist/1069"}
	if LienArtiste(art, "un-service-supprime-depuis") == "" {
		t.Error("un reglage perime prive l'utilisateur de tout lien : c'est un reglage perime, pas une panne")
	}
}

// ═══ F-28 à F-33 — la collection ═══════════════════════════════════════

func TestGarderDeuxFoisLeMemeArtisteNeCreePasDeDoublon(t *testing.T) {
	c := NouvelleCollection()
	g := Garde{Artiste: Artiste{ID: "dz:1", Nom: "Portishead"}}

	c.Ajoute("alice", g)
	c.Ajoute("alice", g)
	c.Ajoute("alice", g)

	if n := len(c.Liste("alice")); n != 1 {
		t.Errorf("%d entrees, veut 1 : la collection se remplirait de doublons a chaque reconciliation", n)
	}
}

// F-33 : "se reconcilie a la reconnexion, SANS PERTE NI DOUBLON".
func TestLaReconciliationNePerdNiLesGardesLocauxNiCeuxDunAutreAppareil(t *testing.T) {
	c := NouvelleCollection()

	// Garde depuis un autre appareil, deja sur le serveur.
	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "Depuis le telephone"}})

	// Gardes faits hors ligne sur ce navigateur.
	locales := []Garde{
		{Artiste: Artiste{ID: "dz:2", Nom: "Hors ligne 1"}},
		{Artiste: Artiste{ID: "dz:3", Nom: "Hors ligne 2"}},
		{Artiste: Artiste{ID: "dz:1", Nom: "Depuis le telephone"}}, // deja connu
	}

	fusion := c.Reconcilie("alice", locales)

	if len(fusion) != 3 {
		t.Fatalf("%d entrees apres reconciliation, veut 3 : perte ou doublon", len(fusion))
	}
	ids := map[string]bool{}
	for _, g := range fusion {
		if ids[g.ID] {
			t.Errorf("doublon sur %s", g.ID)
		}
		ids[g.ID] = true
	}
	for _, veut := range []string{"dz:1", "dz:2", "dz:3"} {
		if !ids[veut] {
			t.Errorf("%s a disparu de la collection", veut)
		}
	}
}

// La date de decouverte est ce qui donne son sens au contexte (F-29) : une
// reconciliation ne doit jamais la remplacer par « aujourd'hui ».
func TestLaReconciliationConserveLaDateDeDecouverteLaPlusAncienne(t *testing.T) {
	c := NouvelleCollection()
	ancien := time.Date(2025, 3, 1, 12, 0, 0, 0, time.UTC)
	recent := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)

	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}, AjouteLe: recent})
	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}, AjouteLe: ancien})

	if got := c.Liste("alice")[0].AjouteLe; !got.Equal(ancien) {
		t.Errorf("date = %v, veut %v : la vraie date de decouverte est perdue", got, ancien)
	}
}

func TestLaReconciliationCompleteUneEntreeSansEcraserLaLignee(t *testing.T) {
	c := NouvelleCollection()

	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}, Lignee: []string{"Portishead", "Tricky"}})
	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}}) // sans lignee

	if lignee := c.Liste("alice")[0].Lignee; len(lignee) != 2 {
		t.Errorf("lignee = %v : le contexte de decouverte a ete efface par une entree plus pauvre", lignee)
	}
}

func TestSansIdentiteLaCollectionServeurResteVide(t *testing.T) {
	c := NouvelleCollection()
	c.Ajoute("", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}})

	if n := len(c.Liste("")); n != 0 {
		t.Errorf("%d entrees pour une identite vide : toutes les collections anonymes finiraient dans le meme sac", n)
	}
}

func TestRetirerUnArtisteLeFaitDisparaitreImmediatement(t *testing.T) {
	c := NouvelleCollection()
	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:1", Nom: "A"}})
	c.Ajoute("alice", Garde{Artiste: Artiste{ID: "dz:2", Nom: "B"}})

	reste := c.Retire("alice", "dz:1")
	if len(reste) != 1 || reste[0].ID != "dz:2" {
		t.Errorf("apres retrait : %v", reste)
	}
	// Retirer un artiste absent ne doit rien casser.
	if n := len(c.Retire("alice", "dz:404")); n != 1 {
		t.Errorf("%d entrees apres un retrait sans objet", n)
	}
}

// ═══ F-25, F-06 — les reglages ═════════════════════════════════════════

func TestUnServiceOuUnTriInconnuNeCasseJamaisLesReglages(t *testing.T) {
	r := NouveauxReglages()
	r.Ecris("alice", Reglage{ServiceEcoute: "spotify", TriMur: "alpha"})

	// Un client d'une version anterieure envoie des valeurs disparues.
	got := r.Ecris("alice", Reglage{ServiceEcoute: "myspace", TriMur: "un-tri-supprime"})

	if got.ServiceEcoute != "spotify" || got.TriMur != "alpha" {
		t.Errorf("reglage = %+v : une valeur inconnue a ecrase un choix valide", got)
	}
}

func TestUnUtilisateurSansCompteRecoitLesReglagesParDefaut(t *testing.T) {
	r := NouveauxReglages()
	if got := r.Lis(""); got != ReglageParDefaut() {
		t.Errorf("reglage = %+v, veut le defaut", got)
	}
}

// ═══ N-09 — les metriques ══════════════════════════════════════════════

func TestLaMedianeDesSautsEstCorrecte(t *testing.T) {
	cas := []struct {
		vs   []int
		veut float64
	}{
		{nil, 0},
		{[]int{4}, 4},
		{[]int{1, 2, 3}, 2},
		{[]int{1, 2, 3, 4}, 2.5},
		{[]int{9, 1, 5}, 5},
	}
	for _, c := range cas {
		if got := mediane(c.vs); got != c.veut {
			t.Errorf("mediane(%v) = %v, veut %v", c.vs, got, c.veut)
		}
	}
}

func TestLeP75DeLatenceEstCorrect(t *testing.T) {
	vs := []float64{100, 200, 300, 400, 500, 600, 700, 800, 900, 1000}
	got := percentile(vs, 0.75)
	if got < 700 || got > 800 {
		t.Errorf("percentile(0.75) = %v, veut entre 700 et 800 — c'est la mesure de la M-05", got)
	}
	if percentile(nil, 0.75) != 0 {
		t.Error("un echantillon vide doit rendre 0, pas paniquer")
	}
}

func TestLesMetriquesDeLaSpecificationSontToutesCalculees(t *testing.T) {
	m := NouvellesMesures()

	m.Emet("s1", "session")
	m.Emet("s1", "promotion")
	m.Emet("s1", "promotion")
	m.Emet("s1", "centre-nouveau")
	m.Emet("s1", "ecoute-ouverte")
	m.Emet("s1", "artiste-garde")
	m.Emet("s2", "session")
	m.Emet("s2", "centre-revu")
	m.Latence(1200)

	etat := m.Etat()
	for _, cle := range []string{
		"M-01-sautsMedians", "M-02-partNouveaux", "M-03-partAvecEcoute",
		"M-04-partAvecGarde", "M-05-latenceP75ms", "M-06-partDepuisGarde",
		"M-07-partDepuisPartage",
	} {
		if _, ok := etat[cle]; !ok {
			t.Errorf("%s absente : le produit ne pourrait pas prouver qu'il fonctionne", cle)
		}
	}

	if etat["sessions"].(int) != 2 {
		t.Errorf("sessions = %v, veut 2", etat["sessions"])
	}
	if part := etat["M-03-partAvecEcoute"].(float64); part != 0.5 {
		t.Errorf("M-03 = %v, veut 0.5 (une session sur deux a ouvert une ecoute)", part)
	}
	if part := etat["M-02-partNouveaux"].(float64); part != 0.5 {
		t.Errorf("M-02 = %v, veut 0.5", part)
	}
}

func TestUnEvenementInventeEstRefuse(t *testing.T) {
	m := NouvellesMesures()
	if m.Emet("s1", "evenement-invente") {
		t.Error("un evenement inconnu a ete accepte : la table des compteurs pourrait grossir sans limite")
	}
}

func TestUneLatenceAberranteEstIgnoree(t *testing.T) {
	m := NouvellesMesures()
	m.Latence(-5)
	m.Latence(0)
	m.Latence(999999)

	if got := m.Etat()["M-05-latenceP75ms"].(float64); got != 0 {
		t.Errorf("P75 = %v : une valeur aberrante a pollue la mesure", got)
	}
}
