package main

import (
	"testing"
	"time"
)

func TestVuePrevisions_GardeLes5ProchainesHeures(t *testing.T) {
	base := time.Date(2026, 8, 9, 14, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := -2; i < 10; i++ {
		p.Heures = append(p.Heures, HeureMeteo{
			Heure:        base.Add(time.Duration(i) * time.Hour),
			TemperatureC: float64(i),
			CodeMeteo:    0,
		})
	}
	for i := range 10 {
		p.Jours = append(p.Jours, JourMeteo{Date: base.AddDate(0, 0, i)})
	}

	v := vuePrevisions(p, base.Add(30*time.Minute), true, nil)

	if len(v.Heures) != nombreHeuresAffichees {
		t.Fatalf("nombre d'heures = %d, attendu %d", len(v.Heures), nombreHeuresAffichees)
	}
	// maintenant = 14:30, tronque a 14:00 : la premiere heure gardee doit
	// etre celle de 14:00 (i=0), jamais une heure deja passee (i<0).
	if v.Heures[0].Heure != "14:00" {
		t.Errorf("premiere heure = %s, attendu 14:00 (pas une heure passee)", v.Heures[0].Heure)
	}
	if len(v.Jours) != nombreJoursAffiches {
		t.Fatalf("nombre de jours = %d, attendu %d", len(v.Jours), nombreJoursAffiches)
	}
	if !v.Frais {
		t.Error("Frais doit refleter le parametre passe a vuePrevisions")
	}
}

func TestVuePrevisions_VaguesAbsentesRestentAbsentes(t *testing.T) {
	base := time.Date(2026, 8, 9, 14, 0, 0, 0, parisTZ)
	p := Previsions{Heures: []HeureMeteo{{Heure: base, VaguesM: nil}}}

	v := vuePrevisions(p, base, true, nil)
	if v.Heures[0].VaguesM != nil {
		t.Error("vagues_m doit rester nil quand la donnee source est absente, pas devenir 0")
	}
}

// TestVuePrevisions_SansDateAffichePasDeJourAffiche verifie que le champ
// jour_affiche (et son libelle) reste absent sans parametre `date` : la
// reponse par defaut doit rester a l'octet pres identique a avant la
// navigation temporelle (prp/01-navigation-temporelle.md).
func TestVuePrevisions_SansDateAffichePasDeJourAffiche(t *testing.T) {
	base := time.Date(2026, 8, 16, 14, 0, 0, 0, parisTZ)
	p := Previsions{Heures: []HeureMeteo{{Heure: base}}, Jours: []JourMeteo{{Date: base}}}

	v := vuePrevisions(p, base, true, nil)
	if v.JourAffiche != "" || v.JourAfficheLibelle != "" {
		t.Errorf("JourAffiche/JourAfficheLibelle = %q/%q, attendu vides sans parametre date", v.JourAffiche, v.JourAfficheLibelle)
	}
}

// TestVuePrevisions_AvecDate_24HeuresDuJour verifie qu'un jour choisi rend
// les 24 heures de CE jour (pas les 5 prochaines a partir de maintenant) et
// que la tendance a 7 jours reste ancree sur AUJOURD'HUI, pas sur le jour
// regarde.
func TestVuePrevisions_AvecDate_24HeuresDuJour(t *testing.T) {
	aujourdhui := time.Date(2026, 8, 16, 14, 0, 0, 0, parisTZ)
	hier := aujourdhui.AddDate(0, 0, -1)
	demain := aujourdhui.AddDate(0, 0, 1)

	p := Previsions{}
	// Trois jours d'heures (hier, aujourd'hui, demain), 24h chacun.
	for _, jourDebut := range []time.Time{debutDuJour(hier), debutDuJour(aujourdhui), debutDuJour(demain)} {
		for h := 0; h < 24; h++ {
			p.Heures = append(p.Heures, HeureMeteo{Heure: jourDebut.Add(time.Duration(h) * time.Hour)})
		}
	}
	for i := 0; i < 7; i++ {
		p.Jours = append(p.Jours, JourMeteo{Date: debutDuJour(aujourdhui).AddDate(0, 0, i)})
	}

	dateCible := debutDuJour(demain)
	v := vuePrevisions(p, aujourdhui, true, &dateCible)

	if len(v.Heures) != 24 {
		t.Fatalf("nombre d'heures = %d, attendu 24 (le jour choisi entier)", len(v.Heures))
	}
	if v.Heures[0].Heure != "00:00" || v.Heures[23].Heure != "23:00" {
		t.Errorf("bornes des heures = %s..%s, attendu 00:00..23:00", v.Heures[0].Heure, v.Heures[23].Heure)
	}
	if v.JourAffiche != demain.Format("2006-01-02") {
		t.Errorf("JourAffiche = %q, attendu %q", v.JourAffiche, demain.Format("2006-01-02"))
	}
	if v.JourAfficheLibelle == "" {
		t.Error("JourAfficheLibelle ne doit pas etre vide quand une date est demandee")
	}
	if len(v.Jours) != nombreJoursAffiches {
		t.Fatalf("tendance = %d jour(s), attendu %d (toujours ancree sur aujourd'hui)", len(v.Jours), nombreJoursAffiches)
	}
	if v.Jours[0].Date != debutDuJour(aujourdhui).Format("2006-01-02") {
		t.Errorf("premier jour de tendance = %q, attendu aujourd'hui (%s), pas le jour regarde", v.Jours[0].Date, debutDuJour(aujourdhui).Format("2006-01-02"))
	}
}

// TestVuePrevisions_JoursPasses_TendanceIgnoreLePasse verifie que
// l'ajout de past_days=7 (meteo.go) ne fait pas remonter des jours passes
// dans la tendance : elle doit toujours commencer a aujourd'hui, meme quand
// p.Jours contient des jours anterieurs.
func TestVuePrevisions_JoursPasses_TendanceIgnoreLePasse(t *testing.T) {
	aujourdhui := time.Date(2026, 8, 16, 8, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := -7; i <= 6; i++ {
		p.Jours = append(p.Jours, JourMeteo{Date: debutDuJour(aujourdhui).AddDate(0, 0, i), TempMaxC: float64(i)})
	}

	v := vuePrevisions(p, aujourdhui, true, nil)

	if len(v.Jours) != nombreJoursAffiches {
		t.Fatalf("tendance = %d jour(s), attendu %d", len(v.Jours), nombreJoursAffiches)
	}
	if v.Jours[0].Date != debutDuJour(aujourdhui).Format("2006-01-02") {
		t.Errorf("premier jour de tendance = %q, attendu aujourd'hui", v.Jours[0].Date)
	}
	if v.Jours[0].TempMaxC != 0 {
		t.Errorf("TempMaxC du premier jour = %v, attendu 0 (decalage i=0 dans la fixture)", v.Jours[0].TempMaxC)
	}
}

// TestVueJourMeteo_UtiliseLesCouchesQuandConnues verifie que la tendance
// journaliere passe par libelleCiel (comme la vue horaire) des que
// CouchesConnues est vrai, pour ne pas dire "couvert" un jour ou la vue
// horaire du meme jour dirait "soleil" (cas du 16 aout 2026, cf. meteo.go).
func TestVueJourMeteo_UtiliseLesCouchesQuandConnues(t *testing.T) {
	j := JourMeteo{
		CodeMeteo:            3,
		NebulositeBassePct:   0,
		NebulositeMoyennePct: 45,
		NebulositeHautePct:   100,
		CouchesConnues:       true,
	}
	v := vueJourMeteo(j)
	if v.Symbole != "soleil-voile" {
		t.Errorf("symbole = %q, attendu soleil-voile (couches connues, cirrus seul)", v.Symbole)
	}
}

// TestVueJourMeteo_RetombeSurLeCodeOMMSansCouches verifie qu'un jour sans
// agregat de couches (CouchesConnues faux) garde l'ancien comportement :
// libelleMeteo(CodeMeteo), plutot que de traiter des zeros comme un ciel
// vide.
func TestVueJourMeteo_RetombeSurLeCodeOMMSansCouches(t *testing.T) {
	j := JourMeteo{CodeMeteo: 3, CouchesConnues: false}
	v := vueJourMeteo(j)
	if v.Symbole != "nuage" || v.Libelle != "couvert" {
		t.Errorf("libelle/symbole = %q/%q, attendu couvert/nuage (retombee sur le code OMM)", v.Libelle, v.Symbole)
	}
}

func TestVueMaree(t *testing.T) {
	coef := 76
	m := Maree{
		HauteurM:    6.5,
		HeureMesure: time.Date(2026, 8, 9, 15, 0, 0, 0, parisTZ),
		Precedent:   Extremum{Type: "PM", Heure: time.Date(2026, 8, 9, 14, 30, 0, 0, parisTZ), HauteurM: 6.9, Coefficient: &coef},
		Prochain:    Extremum{Type: "BM", Heure: time.Date(2026, 8, 9, 20, 45, 0, 0, parisTZ), HauteurM: 2.1},
		PositionPct: 8.1,
		Sens:        "descendante",
		Tendance: []JourMaree{
			{Date: time.Date(2026, 8, 9, 0, 0, 0, 0, parisTZ), HauteM: floatPtr(6.9), BasseM: floatPtr(1.8), Coefficient: &coef},
			{Date: time.Date(2026, 8, 10, 0, 0, 0, 0, parisTZ)},
		},
	}

	v := vueMaree(m, true, "berck-plage-fort-mahon")

	if !v.Configure {
		t.Error("Configure doit etre true : vueMaree n'est appelee qu'avec une maree effectivement recuperee")
	}
	if v.HauteurM == nil || *v.HauteurM != 6.5 {
		t.Errorf("HauteurM = %v, attendu 6.5", v.HauteurM)
	}
	if v.Precedent.Coefficient == nil || *v.Precedent.Coefficient != 76 {
		t.Error("le coefficient du precedent (PM) doit survivre a la conversion en vue")
	}
	if v.Prochain.Coefficient != nil {
		t.Error("le coefficient du prochain (BM) doit rester absent, jamais invente")
	}
	if v.SiteReference != "berck-plage-fort-mahon" {
		t.Errorf("SiteReference = %q", v.SiteReference)
	}
	if len(v.Jours) != 2 {
		t.Fatalf("Jours = %d entree(s), attendu 2", len(v.Jours))
	}
	if v.Jours[0].Date != "2026-08-09" || v.Jours[0].HauteM == nil || *v.Jours[0].HauteM != 6.9 {
		t.Errorf("Jours[0] = %+v, attendu date 2026-08-09 et haute 6.9", v.Jours[0])
	}
	if v.Jours[1].HauteM != nil || v.Jours[1].BasseM != nil {
		t.Errorf("Jours[1] = %+v, attendu entierement vide (aucune donnee ce jour-la)", v.Jours[1])
	}
}

// TestVueMareeJour verifie que le jour choisi rend ses extrema (heure,
// hauteur, coefficient) sans jauge instantanee (HauteurM/PositionPct/Sens/
// Precedent/Prochain doivent rester absents), et que la tendance reste
// incluse et ancree sur aujourd'hui.
func TestVueMareeJour(t *testing.T) {
	coef := 76
	jourCible := time.Date(2026, 8, 18, 0, 0, 0, 0, parisTZ)
	m := Maree{
		Tendance: []JourMaree{
			{Date: time.Date(2026, 8, 16, 0, 0, 0, 0, parisTZ), HauteM: floatPtr(6.9)},
		},
		Extrema: []Extremum{
			{Type: "BM", Heure: time.Date(2026, 8, 18, 3, 10, 0, 0, parisTZ), HauteurM: 1.5},
			{Type: "PM", Heure: time.Date(2026, 8, 18, 9, 20, 0, 0, parisTZ), HauteurM: 7.2, Coefficient: &coef},
			// Jour voisin : ne doit pas apparaitre dans le decoupage.
			{Type: "BM", Heure: time.Date(2026, 8, 19, 3, 40, 0, 0, parisTZ), HauteurM: 1.6},
		},
	}

	v := vueMareeJour(m, true, "berck-plage-fort-mahon", jourCible)

	if !v.Configure {
		t.Error("Configure doit rester true")
	}
	if v.HauteurM != nil || v.PositionPct != nil || v.Sens != "" || v.Precedent != nil || v.Prochain != nil {
		t.Errorf("aucun champ de jauge instantanee ne doit etre rempli pour un jour choisi, recu %+v", v)
	}
	if v.JourAffiche != "2026-08-18" {
		t.Errorf("JourAffiche = %q, attendu 2026-08-18", v.JourAffiche)
	}
	if len(v.Extrema) != 2 {
		t.Fatalf("Extrema = %d entree(s), attendu 2 (celles du 18, pas celle du 19)", len(v.Extrema))
	}
	if v.Extrema[1].Coefficient == nil || *v.Extrema[1].Coefficient != 76 {
		t.Error("le coefficient doit survivre a la conversion en vue")
	}
	if len(v.Jours) != 1 {
		t.Fatalf("Jours (tendance) = %d entree(s), attendu 1 (celle fournie, ancree sur aujourd'hui)", len(v.Jours))
	}
}

// TestVueMareeJour_JourSansDonnee verifie qu'un jour dans la fenetre mais
// sans extremum retourne par le fournisseur rend une liste vide, jamais une
// valeur inventee (« degrader, jamais casser », PRODUCT.md principe 3).
func TestVueMareeJour_JourSansDonnee(t *testing.T) {
	m := Maree{
		Extrema: []Extremum{
			{Type: "PM", Heure: time.Date(2026, 8, 16, 9, 0, 0, 0, parisTZ), HauteurM: 6.9},
		},
	}
	jourSansDonnee := time.Date(2026, 8, 21, 0, 0, 0, 0, parisTZ)

	v := vueMareeJour(m, true, "berck-plage-fort-mahon", jourSansDonnee)

	if len(v.Extrema) != 0 {
		t.Errorf("Extrema = %+v, attendu vide pour un jour non couvert par le fournisseur", v.Extrema)
	}
	if !v.Configure {
		t.Error("Configure doit rester true : ce n'est pas une panne, juste un jour sans extremum")
	}
}

func TestDebutDuJour(t *testing.T) {
	t2 := time.Date(2026, 8, 16, 23, 59, 59, 0, parisTZ)
	d := debutDuJour(t2)
	if d.Hour() != 0 || d.Minute() != 0 || d.Second() != 0 || d.Day() != 16 {
		t.Errorf("debutDuJour(%v) = %v, attendu minuit le meme jour", t2, d)
	}
}

func TestLibelleJourFr(t *testing.T) {
	got := libelleJourFr(time.Date(2026, 8, 16, 0, 0, 0, 0, parisTZ))
	if got != "dimanche 16 août" {
		t.Errorf("libelleJourFr = %q, attendu %q", got, "dimanche 16 août")
	}
}

func floatPtr(v float64) *float64 { return &v }

func TestArrondi(t *testing.T) {
	if v := arrondi2(6.9449999); v != 6.94 {
		t.Errorf("arrondi2(6.9449999) = %v, attendu 6.94", v)
	}
	if v := arrondi1(21.28); v != 21.3 {
		t.Errorf("arrondi1(21.28) = %v, attendu 21.3", v)
	}
}
