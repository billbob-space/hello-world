package main

import (
	"os"
	"slices"
	"sort"
	"testing"
	"time"
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
	for range 2 {
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
	for range 3 {
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

func chargerDefisDeTest(t *testing.T) []DefiCatalogue {
	t.Helper()
	brut, err := os.ReadFile("data/defis.json")
	if err != nil {
		t.Fatal(err)
	}
	defis, err := ChargerDefis(brut)
	if err != nil {
		t.Fatal(err)
	}
	return defis
}

func TestDefisComplet(t *testing.T) {
	defis := chargerDefisDeTest(t)
	compte := map[DefiType]int{}
	for _, d := range defis {
		compte[d.Type]++
	}
	if compte[DefiToutesLesSeancesActives] != 3 || compte[DefiRessentiFacileX2] != 3 {
		t.Fatalf("repartition par type = %v, attendu 3/3 (verrou du 9 aout 2026)", compte)
	}
}

func TestChargerDefisRefuseIDDuplique(t *testing.T) {
	_, err := ChargerDefis([]byte(`{"defis":[
		{"id":"x","titre":"a","type":"toutes_les_seances_actives"},
		{"id":"x","titre":"b","type":"ressenti_facile_x2"}
	]}`))
	if err == nil {
		t.Fatal("attendu une erreur sur id duplique")
	}
}

func TestChargerDefisRefuseTypeInconnu(t *testing.T) {
	_, err := ChargerDefis([]byte(`{"defis":[
		{"id":"x","titre":"a","type":"toutes_les_seances_du_mois"}
	]}`))
	if err == nil {
		t.Fatal("attendu une erreur sur type de defi inconnu")
	}
}

func TestChargerDefisRefuseUnSeulTypeRepresente(t *testing.T) {
	_, err := ChargerDefis([]byte(`{"defis":[
		{"id":"x","titre":"a","type":"toutes_les_seances_actives"},
		{"id":"y","titre":"b","type":"toutes_les_seances_actives"}
	]}`))
	if err == nil {
		t.Fatal("attendu une erreur : ressenti_facile_x2 n'a aucun defi")
	}
}

func TestChargerDefisRefuseTitreVide(t *testing.T) {
	_, err := ChargerDefis([]byte(`{"defis":[
		{"id":"x","titre":"","type":"toutes_les_seances_actives"},
		{"id":"y","titre":"b","type":"ressenti_facile_x2"}
	]}`))
	if err == nil {
		t.Fatal("attendu une erreur sur titre vide")
	}
}

func TestDefiDeLaSemaineIdempotentPourLeMemeSel(t *testing.T) {
	defis := chargerDefisDeTest(t)
	a := DefiDeLaSemaine(defis, "", "2026-W33|test@example.com", "2026-W33")
	b := DefiDeLaSemaine(defis, "", "2026-W33|test@example.com", "2026-W33")
	if a.ID != b.ID {
		t.Fatalf("deux tirages du meme sel rendent %s puis %s", a.ID, b.ID)
	}
	if a.Semaine != "2026-W33" {
		t.Fatalf("semaine = %s, attendu 2026-W33", a.Semaine)
	}
	if a.Titre == "" || a.Type == "" {
		t.Fatalf("defi tire incomplet: %+v", a)
	}
}

// TestDefiDeLaSemaineEviteLaRepetitionSiPossible couvre le critere
// d'acceptation 4 : le tirage hebdomadaire ne repete pas un defi avant
// d'avoir epuise le stock, meme mecanique que les piques (PRP 04).
func TestDefiDeLaSemaineEviteLaRepetitionSiPossible(t *testing.T) {
	defis := chargerDefisDeTest(t)
	premier := DefiDeLaSemaine(defis, "", "2026-W33|test@example.com", "2026-W33")
	second := DefiDeLaSemaine(defis, premier.ID, "2026-W34|test@example.com", "2026-W34")
	if second.ID == premier.ID {
		t.Fatalf("meme defi deux semaines de suite alors qu'une alternative existe")
	}
}

func TestSemaineISORoundTrip(t *testing.T) {
	cas := []string{"2026-01-01", "2026-08-03", "2026-08-08", "2026-08-09", "2026-08-10", "2026-12-31", "2027-01-04"}
	for _, dateISO := range cas {
		sem := semaineISODeDate(dateISO)
		dates := datesDeLaSemaineISO(sem)
		if len(dates) != 7 {
			t.Fatalf("%s: %d dates dans la semaine %s, attendu 7", dateISO, len(dates), sem)
		}
		if !slices.Contains(dates, dateISO) {
			t.Fatalf("%s (semaine %s) absente des dates calculees %v", dateISO, sem, dates)
		}
		// Verification independante : le premier jour rendu doit etre le
		// lundi de dateISO, calcule ici par simple arithmetique de jour de
		// semaine plutot que par le meme algorithme que le code teste.
		d, err := time.Parse("2006-01-02", dateISO)
		if err != nil {
			t.Fatal(err)
		}
		delta := (int(d.Weekday()) + 6) % 7
		lundiAttendu := d.AddDate(0, 0, -delta).Format("2006-01-02")
		if dates[0] != lundiAttendu {
			t.Fatalf("%s: lundi calcule %s, attendu %s", dateISO, dates[0], lundiAttendu)
		}
	}
}

// Semaine ISO 2026-W32 : lundi 2026-08-03 a dimanche 2026-08-09 (verifie
// independamment via `date -d 2026-08-03 +%G-W%V`).

func TestEvaluerDefiToutesLesSeancesActivesVrai(t *testing.T) {
	profil := Profil{
		Reponses: Reponses{JoursActifs: []string{"lundi", "mercredi", "vendredi"}},
		Historique: []HistoriqueEntree{
			{Date: "2026-08-03", Ressenti: RessentiCorrect}, // lundi
			{Date: "2026-08-05", Ressenti: RessentiCorrect}, // mercredi
			{Date: "2026-08-07", Ressenti: RessentiFacile},  // vendredi
		},
	}
	defi := DefiSemaine{Type: DefiToutesLesSeancesActives, Semaine: "2026-W32"}
	if !EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("attendu rempli : les trois jours actifs ont chacun une seance")
	}
}

func TestEvaluerDefiToutesLesSeancesActivesFaux(t *testing.T) {
	profil := Profil{
		Reponses: Reponses{JoursActifs: []string{"lundi", "mercredi", "vendredi"}},
		Historique: []HistoriqueEntree{
			{Date: "2026-08-03", Ressenti: RessentiCorrect},
			{Date: "2026-08-05", Ressenti: RessentiCorrect},
			// vendredi 2026-08-07 manque : rate le defi, casse rien d'autre.
		},
	}
	defi := DefiSemaine{Type: DefiToutesLesSeancesActives, Semaine: "2026-W32"}
	if EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("attendu non rempli : vendredi manque")
	}
}

func TestEvaluerDefiToutesLesSeancesActivesSansJourActifJamaisRempli(t *testing.T) {
	profil := Profil{Reponses: Reponses{JoursActifs: nil}}
	defi := DefiSemaine{Type: DefiToutesLesSeancesActives, Semaine: "2026-W32"}
	if EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("aucun jour actif declare : rien a relever, jamais rempli")
	}
}

func TestEvaluerDefiFacileX2Vrai(t *testing.T) {
	profil := Profil{
		Historique: []HistoriqueEntree{
			{Date: "2026-08-03", Ressenti: RessentiFacile},
			{Date: "2026-08-05", Ressenti: RessentiFacile},
			{Date: "2026-08-06", Ressenti: RessentiDifficile},
		},
	}
	defi := DefiSemaine{Type: DefiRessentiFacileX2, Semaine: "2026-W32"}
	if !EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("attendu rempli : deux 'facile' dans la semaine")
	}
}

func TestEvaluerDefiFacileX2Faux(t *testing.T) {
	profil := Profil{
		Historique: []HistoriqueEntree{
			{Date: "2026-08-03", Ressenti: RessentiFacile},
		},
	}
	defi := DefiSemaine{Type: DefiRessentiFacileX2, Semaine: "2026-W32"}
	if EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("attendu non rempli : un seul 'facile' cette semaine")
	}
}

func TestEvaluerDefiFacileX2IgnoreLesAutresSemaines(t *testing.T) {
	profil := Profil{
		Historique: []HistoriqueEntree{
			{Date: "2026-07-27", Ressenti: RessentiFacile}, // semaine 2026-W31
			{Date: "2026-08-03", Ressenti: RessentiFacile}, // semaine 2026-W32
		},
	}
	defi := DefiSemaine{Type: DefiRessentiFacileX2, Semaine: "2026-W32"}
	if EvaluerDefi(defi, profil, "2026-08-09") {
		t.Fatal("un 'facile' d'une autre semaine ne doit pas compter")
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
