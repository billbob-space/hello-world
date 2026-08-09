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

	v := vuePrevisions(p, base.Add(30*time.Minute), true)

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

	v := vuePrevisions(p, base, true)
	if v.Heures[0].VaguesM != nil {
		t.Error("vagues_m doit rester nil quand la donnee source est absente, pas devenir 0")
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

func floatPtr(v float64) *float64 { return &v }

func TestArrondi(t *testing.T) {
	if v := arrondi2(6.9449999); v != 6.94 {
		t.Errorf("arrondi2(6.9449999) = %v, attendu 6.94", v)
	}
	if v := arrondi1(21.28); v != 21.3 {
		t.Errorf("arrondi1(21.28) = %v, attendu 21.3", v)
	}
}
