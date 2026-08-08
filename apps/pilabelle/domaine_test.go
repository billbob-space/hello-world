package main

import (
	"os"
	"slices"
	"sort"
	"testing"
)

func chargerDictionnaireDeTest(t *testing.T) Dictionnaire {
	t.Helper()
	brut, err := os.ReadFile("data/dictionnaire.json")
	if err != nil {
		t.Fatal(err)
	}
	dico, err := ChargerDictionnaire(brut)
	if err != nil {
		t.Fatal(err)
	}
	return dico
}

func TestDictionnaireComplet(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	compte := map[Zone]int{}
	for _, ex := range dico.Exercices {
		compte[ex.Zone]++
	}
	attendu := map[Zone]int{
		ZoneMiseEnRoute: 8, ZoneVentre: 20, ZoneCuisses: 20, ZoneRetourAuCalme: 8,
	}
	for zone, n := range attendu {
		if compte[zone] != n {
			t.Errorf("zone %s: %d exercices, attendu %d", zone, compte[zone], n)
		}
	}
	if total := len(dico.Exercices); total != 56 {
		t.Errorf("%d exercices au total, attendu 56", total)
	}
}

func TestChaqueFamilleAQuatreNiveaux(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	parFamille := map[string][]int{}
	for _, ex := range dico.Exercices {
		if ex.Famille == nil {
			continue
		}
		parFamille[*ex.Famille] = append(parFamille[*ex.Famille], *ex.Niveau)
	}
	if len(parFamille) != 10 {
		t.Fatalf("%d familles, attendu 10 (5 ventre + 5 cuisses)", len(parFamille))
	}
	for famille, niveaux := range parFamille {
		sort.Ints(niveaux)
		if !slices.Equal(niveaux, []int{1, 2, 3, 4}) {
			t.Errorf("famille %s: niveaux %v, attendu [1 2 3 4]", famille, niveaux)
		}
	}
}

func TestChargerDictionnaireRefuseIDDuplique(t *testing.T) {
	_, err := ChargerDictionnaire([]byte(`{
		"echelle_niveaux": [{"niveau":1,"effort_s":20,"repos_s":20,"tours":1}],
		"exercices": [
			{"id":"x","zone":"ventre","famille":"f","niveau":1,"nom":"a","consigne":"c","contre_indications":[],"minutage":null,"video":{"statut":"ok","url":"u"}},
			{"id":"x","zone":"ventre","famille":"f","niveau":1,"nom":"b","consigne":"c","contre_indications":[],"minutage":null,"video":{"statut":"ok","url":"u"}}
		]
	}`))
	if err == nil {
		t.Fatal("attendu une erreur sur id duplique")
	}
}

func TestChargerDictionnaireRefuseContreIndicationInconnue(t *testing.T) {
	_, err := ChargerDictionnaire([]byte(`{
		"echelle_niveaux": [{"niveau":1,"effort_s":20,"repos_s":20,"tours":1}],
		"exercices": [
			{"id":"x","zone":"ventre","famille":"f","niveau":1,"nom":"a","consigne":"c","contre_indications":["coude"],"minutage":null,"video":{"statut":"ok","url":"u"}}
		]
	}`))
	if err == nil {
		t.Fatal("attendu une erreur sur contre-indication inconnue")
	}
}

func TestChargerDictionnaireRefuseIncoherenceFamilleNiveau(t *testing.T) {
	_, err := ChargerDictionnaire([]byte(`{
		"echelle_niveaux": [{"niveau":1,"effort_s":20,"repos_s":20,"tours":1}],
		"exercices": [
			{"id":"x","zone":"mise_en_route","famille":"f","niveau":1,"nom":"a","consigne":"c","contre_indications":[],"minutage":{"effort_s":1,"repos_s":1,"tours":1},"video":{"statut":"ok","url":"u"}}
		]
	}`))
	if err == nil {
		t.Fatal("attendu une erreur : zone non graduee avec famille/niveau")
	}
}

func TestNiveauDescendImmediatement(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	n, fc := AjusterNiveau(dico, ZoneVentre, nil, 3, 0, RessentiDifficile)
	if n != 2 || fc != 0 {
		t.Fatalf("difficile: niveau %d/facile %d, attendu 2/0", n, fc)
	}
}

func TestNiveauNeMonteQuApresTroisFacilesDeSuite(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	niveau, fc := 2, 0
	for i := 0; i < 2; i++ {
		niveau, fc = AjusterNiveau(dico, ZoneVentre, nil, niveau, fc, RessentiFacile)
	}
	if niveau != 2 {
		t.Fatalf("apres deux faciles: niveau %d, attendu inchange (2)", niveau)
	}
	niveau, fc = AjusterNiveau(dico, ZoneVentre, nil, niveau, fc, RessentiFacile)
	if niveau != 3 || fc != 0 {
		t.Fatalf("apres trois faciles: niveau %d/facile %d, attendu 3/0", niveau, fc)
	}
}

func TestCorrectCasseLaSerieDeFaciles(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	_, fc := AjusterNiveau(dico, ZoneVentre, nil, 2, 0, RessentiFacile)
	_, fc = AjusterNiveau(dico, ZoneVentre, nil, 2, fc, RessentiCorrect)
	if fc != 0 {
		t.Fatalf("facilesConsecutifs = %d apres un correct, attendu 0", fc)
	}
}

func TestPlancherJamaisFranchi(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	n, _ := AjusterNiveau(dico, ZoneVentre, nil, 1, 0, RessentiDifficile)
	if n != 1 {
		t.Fatalf("niveau %d, le plancher (1) ne doit jamais etre franchi", n)
	}
}

func TestPlafondJamaisFranchi(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	niveau, fc := 4, 0
	for i := 0; i < 3; i++ {
		niveau, fc = AjusterNiveau(dico, ZoneCuisses, nil, niveau, fc, RessentiFacile)
	}
	if niveau != 4 {
		t.Fatalf("niveau %d, le plafond (4) ne doit jamais etre depasse", niveau)
	}
}

func TestContreIndicationExclut(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	ex, err := choisirExercice(dico, ZoneCuisses, []string{"genou"}, 1, "", "2026-08-08|cuisses")
	if err != nil {
		t.Fatal(err)
	}
	if slices.Contains(ex.ContreIndications, "genou") {
		t.Fatalf("%s porte 'genou', declare comme douleur", ex.ID)
	}
}

func TestEviteExerciceDeLaVeilleSiPossible(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	hier, err := choisirExercice(dico, ZoneVentre, nil, 1, "", "2026-08-07|ventre")
	if err != nil {
		t.Fatal(err)
	}
	aujourdhui, err := choisirExercice(dico, ZoneVentre, nil, 1, hier.ID, "2026-08-08|ventre")
	if err != nil {
		t.Fatal(err)
	}
	if aujourdhui.ID == hier.ID {
		t.Fatalf("meme exercice deux jours de suite alors qu'une alternative existe")
	}
}

func TestChoixIdempotentPourLeMemeJour(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	a, err := choisirExercice(dico, ZoneVentre, nil, 2, "", "2026-08-08|ventre")
	if err != nil {
		t.Fatal(err)
	}
	b, err := choisirExercice(dico, ZoneVentre, nil, 2, "", "2026-08-08|ventre")
	if err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID {
		t.Fatalf("deux appels le meme jour rendent %s puis %s", a.ID, b.ID)
	}
}

func TestSeanceDuJourRepos(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	profil := Profil{Reponses: Reponses{JoursActifs: []string{"lundi"}}}
	_, cas, err := SeanceDuJour(dico, profil, "2026-08-08") // samedi
	if err != nil {
		t.Fatal(err)
	}
	if cas != CasRepos {
		t.Fatalf("cas = %s, attendu repos", cas)
	}
}

func TestSeanceDuJourAFaireQuatreBlocs(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	profil := Profil{
		Reponses: Reponses{JoursActifs: []string{"samedi"}},
		Niveaux:  Niveaux{Ventre: 1, Cuisses: 1},
	}
	s, cas, err := SeanceDuJour(dico, profil, "2026-08-08") // samedi
	if err != nil {
		t.Fatal(err)
	}
	if cas != CasAFaire {
		t.Fatalf("cas = %s, attendu a-faire", cas)
	}
	if len(s.Blocs) != 4 {
		t.Fatalf("%d blocs, attendu 4", len(s.Blocs))
	}
	ordreAttendu := []Zone{ZoneMiseEnRoute, ZoneVentre, ZoneCuisses, ZoneRetourAuCalme}
	for i, b := range s.Blocs {
		if b.Zone != ordreAttendu[i] {
			t.Fatalf("bloc %d = %s, attendu %s", i, b.Zone, ordreAttendu[i])
		}
	}
}

func TestSeanceDuJourDejaFaite(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	profil := Profil{
		Reponses:   Reponses{JoursActifs: []string{"samedi"}},
		Historique: []HistoriqueEntree{{Date: "2026-08-08", Ressenti: RessentiCorrect}},
	}
	_, cas, err := SeanceDuJour(dico, profil, "2026-08-08")
	if err != nil {
		t.Fatal(err)
	}
	if cas != CasDejaFaite {
		t.Fatalf("cas = %s, attendu deja-faite", cas)
	}
}

func TestSerieCasseeParJourActifManque(t *testing.T) {
	// 2026-08-03 est un lundi, 2026-08-10 le lundi suivant : mercredi manque entre les deux.
	serie := MettreAJourSerie(Serie{Actuelle: 4, Record: 4}, []string{"lundi", "mercredi"}, "2026-08-03", "2026-08-10")
	if serie.Actuelle != 1 {
		t.Fatalf("serie = %d, attendu 1 (mercredi manque entre les deux)", serie.Actuelle)
	}
}

func TestSerieNonCasseeParJourDeRepos(t *testing.T) {
	serie := MettreAJourSerie(Serie{Actuelle: 4, Record: 4}, []string{"lundi"}, "2026-08-03", "2026-08-10")
	if serie.Actuelle != 5 {
		t.Fatalf("serie = %d, attendu 5 (aucun jour actif entre les deux)", serie.Actuelle)
	}
}

func TestSerieRecordSuitLActuelle(t *testing.T) {
	serie := MettreAJourSerie(Serie{Actuelle: 9, Record: 9}, []string{"lundi"}, "2026-08-03", "2026-08-10")
	if serie.Record != 10 {
		t.Fatalf("record = %d, attendu 10", serie.Record)
	}
}

func TestJourActif(t *testing.T) {
	if !JourActif([]string{"samedi"}, "2026-08-08") {
		t.Fatal("2026-08-08 est un samedi, attendu actif")
	}
	if JourActif([]string{"samedi"}, "2026-08-09") {
		t.Fatal("2026-08-09 est un dimanche, attendu non actif")
	}
}

func TestNiveauInitial(t *testing.T) {
	n := NiveauInitial(Reponses{NiveauDepart: "debutante"})
	if n.Ventre != 1 || n.Cuisses != 1 {
		t.Fatalf("debutante: %+v, attendu 1/1", n)
	}
	n = NiveauInitial(Reponses{NiveauDepart: "a_deja_pratique"})
	if n.Ventre != 2 || n.Cuisses != 2 {
		t.Fatalf("a_deja_pratique: %+v, attendu 2/2", n)
	}
}
