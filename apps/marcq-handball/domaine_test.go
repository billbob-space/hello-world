package main

import (
	"io/fs"
	"testing"
	"time"
)

// programmeDuDepot rend le programme.json embarque, celui-la meme que le
// navigateur charge. Les tests Go et tests/domaine.test.js prouvent donc deux
// implementations sur LA MEME donnee : c'est ce qui interdit a la version Go de
// deriver en silence.
func programmeDuDepot(t *testing.T) *Programme {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	donnees, err := fs.ReadFile(web, "programme.json")
	if err != nil {
		t.Fatalf("programme.json illisible : %v", err)
	}
	p, err := chargerProgramme(donnees)
	if err != nil {
		t.Fatalf("chargerProgramme : %v", err)
	}
	return p
}

func TestChargerProgrammeAccepteLeFichierEmbarque(t *testing.T) {
	p := programmeDuDepot(t)
	if p.Debut == "" || p.Fin == "" || len(p.Seances) == 0 {
		t.Fatalf("programme vide : %+v", p)
	}
	if p.Fin < p.Debut {
		t.Errorf("fin %s anterieure a debut %s", p.Fin, p.Debut)
	}
}

// Les sept assertions de l'ossature §4 — les MEMES constantes que
// tests/domaine.test.js. Elles ne sont ecrites que dans les tests : domaine.go
// ne recopie aucun de ces nombres, il les calcule (PRD §8).
func TestTotauxPrescritsVerrouillentLaSaisie(t *testing.T) {
	tot := totauxPrescrits(programmeDuDepot(t))

	cas := []struct {
		nom     string
		obtenu  int
		attendu int
	}{
		{"pompes", tot.Pompes, 226},
		{"squats", tot.Squats, 345},
		{"burpees", tot.Burpees, 105},
		{"abdos", tot.Abdos, 210},
		{"gainage_s", tot.GainageS, 1425},
		{"min_course", tot.MinCourse, 235},
		{"cases", tot.Cases, 53},
	}
	for _, c := range cas {
		if c.obtenu != c.attendu {
			t.Errorf("%s = %d, attendu %d", c.nom, c.obtenu, c.attendu)
		}
	}
}

// Les 53 identifiants du PRP 02, sans doublon ni manquant. Renumeroter un id
// effacerait la progression de tout le monde : le test le rend impossible en
// silence.
func TestLes53IdentifiantsSontStables(t *testing.T) {
	attendus := []string{
		"s1-c1", "s1-c2", "s1-r1", "s1-r2", "s1-r3", "s1-r4", "s1-r5", "s1-r6",
		"s2-c1", "s2-c2", "s2-c3", "s2-r1", "s2-r2", "s2-r3", "s2-r4", "s2-r5",
		"s3-c1", "s3-r1", "s3-r2", "s3-r3", "s3-r4", "s3-r5",
		"s4-c1", "s4-c2", "s4-r1", "s4-r2", "s4-r3", "s4-r4", "s4-r5",
		"s5-c1", "s5-c2", "s5-r1", "s5-r2", "s5-r3", "s5-r4", "s5-r5",
		"s6-c1", "s6-c2", "s6-c3", "s6-r1", "s6-r2", "s6-r3", "s6-r4", "s6-r5", "s6-r6",
		"s7-c1", "s7-c2", "s7-r1", "s7-r2", "s7-r3", "s7-r4", "s7-r5", "s7-r6",
	}

	p := programmeDuDepot(t)
	var obtenus []string
	for _, s := range p.Seances {
		for _, b := range s.Blocs {
			for _, ex := range b.Exercices {
				obtenus = append(obtenus, ex.ID)
			}
		}
	}

	if len(obtenus) != len(attendus) {
		t.Fatalf("%d identifiants, attendu %d", len(obtenus), len(attendus))
	}
	for i, id := range attendus {
		if obtenus[i] != id {
			t.Errorf("identifiant %d = %s, attendu %s", i, obtenus[i], id)
		}
	}
}

func TestProgrammesEstLeDenominateurDuJour(t *testing.T) {
	p := programmeDuDepot(t)
	premiere := p.Seances[0]

	var casesPremiere int
	for _, b := range premiere.Blocs {
		casesPremiere += len(b.Exercices)
	}

	if n := len(p.programmes(premiere.Date)); n != casesPremiere {
		t.Errorf("programmes(%s) = %d, attendu %d", premiere.Date, n, casesPremiere)
	}
	if n := len(p.programmes("2026-08-02")); n != 0 {
		t.Errorf("programmes(2026-08-02) = %d, attendu 0", n)
	}
	// Apres la fin, le denominateur est fige sur le programme entier (PRD §9).
	if n := len(p.programmes("2026-09-01")); n != totauxPrescrits(p).Cases {
		t.Errorf("programmes(2026-09-01) = %d, attendu %d", n, totauxPrescrits(p).Cases)
	}
}

func TestProgressionIgnoreLesSeancesFutures(t *testing.T) {
	p := programmeDuDepot(t)
	premiere := p.Seances[0]
	derniere := p.Seances[len(p.Seances)-1]

	// Une case de la premiere seance, plus une case de la derniere : au jour de
	// la premiere, seule la premiere compte.
	faits := map[string]bool{
		premiere.Blocs[0].Exercices[0].ID: true,
		derniere.Blocs[0].Exercices[0].ID: true,
	}

	cochees, programmees, part := progression(p, premiere.Date, faits)
	if cochees != 1 {
		t.Errorf("cochees = %d, attendu 1 — une case future a ete comptee", cochees)
	}
	if programmees == 0 {
		t.Fatal("programmees = 0 le jour de la premiere seance")
	}
	if part != arrondi3(1/float64(programmees)) {
		t.Errorf("part = %v, attendu %v", part, arrondi3(1/float64(programmees)))
	}

	// Avant le programme : rien n'est programme, part vaut 0 et non NaN.
	cochees, programmees, part = progression(p, "2026-08-02", faits)
	if cochees != 0 || programmees != 0 || part != 0 {
		t.Errorf("avant le programme : (%d, %d, %v), attendu (0, 0, 0)", cochees, programmees, part)
	}
}

func TestTotauxAccomplisSuiventLesCasesCochees(t *testing.T) {
	p := programmeDuDepot(t)

	if tot := totauxAccomplis(p, map[string]bool{}); tot.Cases != 0 {
		t.Errorf("aucune case cochee : cases = %d, attendu 0", tot.Cases)
	}

	tous := make(map[string]bool)
	for _, s := range p.Seances {
		for _, b := range s.Blocs {
			for _, ex := range b.Exercices {
				tous[ex.ID] = true
			}
		}
	}
	if totauxAccomplis(p, tous) != totauxPrescrits(p) {
		t.Error("tout coche : les accomplis doivent egaler les prescrits")
	}
}

func TestChargerProgrammeRefuseLesProgrammesInvalides(t *testing.T) {
	cas := []struct {
		nom  string
		json string
	}{
		{
			"identifiant duplique",
			`{"titre":"t","debut":"2026-08-03","fin":"2026-08-21","seances":[
			  {"date":"2026-08-03","semaine":1,"titre":"s","blocs":[
			    {"type":"course","tours":1,"exercices":[
			      {"id":"s1-c1","libelle":"a","mesure":{"unite":"pompes","valeur":1}},
			      {"id":"s1-c1","libelle":"b","mesure":{"unite":"pompes","valeur":1}}]}]}]}`,
		},
		{
			"unite inconnue",
			`{"titre":"t","debut":"2026-08-03","fin":"2026-08-21","seances":[
			  {"date":"2026-08-03","semaine":1,"titre":"s","blocs":[
			    {"type":"course","tours":1,"exercices":[
			      {"id":"s1-c1","libelle":"a","mesure":{"unite":"tractions","valeur":1}}]}]}]}`,
		},
		{
			"seances non ordonnees",
			`{"titre":"t","debut":"2026-08-03","fin":"2026-08-21","seances":[
			  {"date":"2026-08-05","semaine":1,"titre":"s","blocs":[
			    {"type":"course","tours":1,"exercices":[
			      {"id":"a","libelle":"a","mesure":{"unite":"pompes","valeur":1}}]}]},
			  {"date":"2026-08-03","semaine":1,"titre":"s","blocs":[
			    {"type":"course","tours":1,"exercices":[
			      {"id":"b","libelle":"b","mesure":{"unite":"pompes","valeur":1}}]}]}]}`,
		},
		{
			"type de bloc inconnu",
			`{"titre":"t","debut":"2026-08-03","fin":"2026-08-21","seances":[
			  {"date":"2026-08-03","semaine":1,"titre":"s","blocs":[
			    {"type":"etirements","tours":1,"exercices":[
			      {"id":"a","libelle":"a","mesure":{"unite":"pompes","valeur":1}}]}]}]}`,
		},
		{"aucune seance", `{"titre":"t","debut":"2026-08-03","fin":"2026-08-21","seances":[]}`},
		{"json illisible", `{`},
	}

	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			if _, err := chargerProgramme([]byte(c.json)); err == nil {
				t.Error("chargerProgramme a accepte un programme invalide")
			}
		})
	}
}

// jourParis fige Europe/Paris. Sans time/tzdata dans le binaire, ce test tombe
// sur l'image Alpine — c'est exactement ce qu'on veut qu'il attrape.
func TestJourParisEstLeJourDuClub(t *testing.T) {
	// 21 h 30 UTC le 6 aout, soit 23 h 30 a Paris le meme jour.
	if j := jourParis(time.Date(2026, 8, 6, 21, 30, 0, 0, time.UTC)); j != "2026-08-06" {
		t.Errorf("jourParis(21h30 UTC) = %s, attendu 2026-08-06", j)
	}
	// 22 h 30 UTC le 6 aout, soit 00 h 30 a Paris le 7 : le serveur a change de
	// jour avant UTC. Sans fuseau, il compterait encore la veille.
	if j := jourParis(time.Date(2026, 8, 6, 22, 30, 0, 0, time.UTC)); j != "2026-08-07" {
		t.Errorf("jourParis(22h30 UTC) = %s, attendu 2026-08-07", j)
	}
}
