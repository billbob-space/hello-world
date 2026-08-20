package main

import (
	"testing"
	"time"
)

// TestVuePrevisions_HeuresRestantesDuJour_MilieuDeJournee verifie la regle
// prp/02-horizon-confiance-vent.md section 1 : en milieu de journee, TOUTES
// les heures restantes du jour sont rendues (pas seulement
// nombreHeuresMinimum) et pas une de plus (rien du lendemain).
func TestVuePrevisions_HeuresRestantesDuJour_MilieuDeJournee(t *testing.T) {
	base := time.Date(2026, 8, 9, 14, 0, 0, 0, parisTZ) // 14h30, tronque a 14h : 10 heures restent avant minuit (14h..23h)
	p := Previsions{}
	for i := -2; i < 14; i++ {
		p.Heures = append(p.Heures, HeureMeteo{
			Heure:        base.Add(time.Duration(i) * time.Hour),
			TemperatureC: floatPtr(float64(i)),
			CodeMeteo:    0,
		})
	}
	for i := range 20 {
		p.Jours = append(p.Jours, JourMeteo{Date: base.AddDate(0, 0, i), TempMinC: floatPtr(10), TempMaxC: floatPtr(20)})
	}

	v := vuePrevisions(p, SeriePluie{}, base.Add(30*time.Minute), true, nil)

	// De 14:00 a 23:00 inclus : 10 heures, largement au-dela du minimum, et
	// rien du lendemain (00:00 du jour suivant n'est pas dans la fixture
	// avant i=10, qui correspond a 00:00 le 10 aout : absent car > 23h ce
	// jour-la).
	if len(v.Heures) != 10 {
		t.Fatalf("nombre d'heures = %d, attendu 10 (14h a 23h inclus, milieu de journee)", len(v.Heures))
	}
	if v.Heures[0].Heure != "14:00" {
		t.Errorf("premiere heure = %s, attendu 14:00 (pas une heure passee)", v.Heures[0].Heure)
	}
	if v.Heures[len(v.Heures)-1].Heure != "23:00" {
		t.Errorf("derniere heure = %s, attendu 23:00 (rien du lendemain en milieu de journee)", v.Heures[len(v.Heures)-1].Heure)
	}
	if len(v.Jours) != nombreJoursAffiches {
		t.Fatalf("nombre de jours = %d, attendu %d", len(v.Jours), nombreJoursAffiches)
	}
	if !v.Frais {
		t.Error("Frais doit refleter le parametre passe a vuePrevisions")
	}
}

// TestVuePrevisions_HeuresRestantesDuJour_MinimumEnSoiree verifie le
// plancher : a 22h, seules deux heures restent avant minuit (22h, 23h), donc
// la vue deborde sur le lendemain jusqu'a atteindre nombreHeuresMinimum —
// exactement le comportement d'avant entre 19h et minuit
// (prp/02-horizon-confiance-vent.md, section 1).
func TestVuePrevisions_HeuresRestantesDuJour_MinimumEnSoiree(t *testing.T) {
	base := time.Date(2026, 8, 9, 22, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := 0; i < 10; i++ {
		p.Heures = append(p.Heures, HeureMeteo{
			Heure:        base.Add(time.Duration(i) * time.Hour),
			TemperatureC: floatPtr(float64(i)),
		})
	}

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)

	if len(v.Heures) != nombreHeuresMinimum {
		t.Fatalf("nombre d'heures = %d, attendu %d (minimum atteint en debordant sur le lendemain)", len(v.Heures), nombreHeuresMinimum)
	}
	if v.Heures[0].Heure != "22:00" {
		t.Errorf("premiere heure = %s, attendu 22:00", v.Heures[0].Heure)
	}
	// 22h, 23h, puis 00h/01h/02h le lendemain pour atteindre 5 : la derniere
	// doit deborder sur le jour suivant.
	if v.Heures[len(v.Heures)-1].Heure != "02:00" {
		t.Errorf("derniere heure = %s, attendu 02:00 (debordement sur le lendemain)", v.Heures[len(v.Heures)-1].Heure)
	}
}

// TestVuePrevisions_SerieQuiSarreteEnCoursDeJournee est le cas de bord
// signale le 18 aout 2026 (prp/02-horizon-confiance-vent.md, section
// Degradation) : Open-Meteo peut rendre `null` sur la temperature d'une
// heure au milieu de la serie (pas seulement en toute fin). Ces heures ne
// doivent ni apparaitre dans la bande, ni compter pour le plancher de cinq
// — vuePrevisions doit continuer a chercher plus loin (deborder davantage
// sur le lendemain) pour l'atteindre quand meme avec les heures REELLEMENT
// affichees.
func TestVuePrevisions_SerieQuiSarreteEnCoursDeJournee(t *testing.T) {
	base := time.Date(2026, 8, 9, 21, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := 0; i < 8; i++ {
		h := HeureMeteo{Heure: base.Add(time.Duration(i) * time.Hour), TemperatureC: floatPtr(float64(i))}
		// La serie s'arrete en cours de journee : les heures i=2 et i=3
		// (23h et 00h) sont sans temperature, exactement comme observe en
		// direct au bord de la fenetre Open-Meteo.
		if i == 2 || i == 3 {
			h.TemperatureC = nil
		}
		p.Heures = append(p.Heures, h)
	}

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)

	if len(v.Heures) != nombreHeuresMinimum {
		t.Fatalf("nombre d'heures = %d, attendu %d (les heures sans temperature ne comptent pas, il faut chercher plus loin)", len(v.Heures), nombreHeuresMinimum)
	}
	for _, h := range v.Heures {
		if h.Heure == "23:00" || h.Heure == "00:00" {
			t.Errorf("heure %s attendue absente (temperature nulle dans la fixture), presente dans %+v", h.Heure, v.Heures)
		}
	}
	// 21h, 22h (temperature connue), 23h/00h sautees (nulles), puis 01h, 02h,
	// 03h : cinq heures REELLEMENT affichees, terminant a 03h — la recherche
	// va plus loin que si les heures nulles avaient ete comptees a tort.
	if v.Heures[len(v.Heures)-1].Heure != "03:00" {
		t.Errorf("derniere heure = %s, attendu 03:00", v.Heures[len(v.Heures)-1].Heure)
	}
}

func TestVuePrevisions_VaguesAbsentesRestentAbsentes(t *testing.T) {
	base := time.Date(2026, 8, 9, 14, 0, 0, 0, parisTZ)
	p := Previsions{Heures: []HeureMeteo{{Heure: base, TemperatureC: floatPtr(18), VaguesM: nil}}}

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)
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

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)
	if v.JourAffiche != "" || v.JourAfficheLibelle != "" {
		t.Errorf("JourAffiche/JourAfficheLibelle = %q/%q, attendu vides sans parametre date", v.JourAffiche, v.JourAfficheLibelle)
	}
}

// TestVuePrevisions_AvecDate_24HeuresDuJour verifie qu'un jour choisi rend
// les 24 heures de CE jour (pas les heures restantes a partir de maintenant)
// et que la tendance a 16 jours reste ancree sur AUJOURD'HUI, pas sur le
// jour regarde.
func TestVuePrevisions_AvecDate_24HeuresDuJour(t *testing.T) {
	aujourdhui := time.Date(2026, 8, 16, 14, 0, 0, 0, parisTZ)
	hier := aujourdhui.AddDate(0, 0, -1)
	demain := aujourdhui.AddDate(0, 0, 1)

	p := Previsions{}
	// Trois jours d'heures (hier, aujourd'hui, demain), 24h chacun.
	for _, jourDebut := range []time.Time{debutDuJour(hier), debutDuJour(aujourdhui), debutDuJour(demain)} {
		for h := 0; h < 24; h++ {
			p.Heures = append(p.Heures, HeureMeteo{Heure: jourDebut.Add(time.Duration(h) * time.Hour), TemperatureC: floatPtr(15)})
		}
	}
	for i := 0; i < nombreJoursAffiches; i++ {
		p.Jours = append(p.Jours, JourMeteo{Date: debutDuJour(aujourdhui).AddDate(0, 0, i), TempMinC: floatPtr(10), TempMaxC: floatPtr(20)})
	}

	dateCible := debutDuJour(demain)
	v := vuePrevisions(p, SeriePluie{}, aujourdhui, true, &dateCible)

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

// TestVuePrevisions_JourEntierementNulNestPasAffiche verifie la regle
// centrale de prp/02-horizon-confiance-vent.md, section Degradation : un
// jour sans temperature (TempMinC/TempMaxC nil, bord de la fenetre
// Open-Meteo) n'est pas affiche DU TOUT — la tendance porte alors moins de
// nombreJoursAffiches lignes, plutot que d'inventer un jour a 0°C.
func TestVuePrevisions_JourEntierementNulNestPasAffiche(t *testing.T) {
	aujourdhui := time.Date(2026, 8, 16, 8, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := 0; i < nombreJoursAffiches; i++ {
		j := JourMeteo{Date: debutDuJour(aujourdhui).AddDate(0, 0, i), TempMinC: floatPtr(10), TempMaxC: floatPtr(20)}
		// Le dernier jour de la fenetre (bord de forecast_days=16) est sans
		// temperature, exactement comme constate en direct le 18 aout 2026.
		if i == nombreJoursAffiches-1 {
			j.TempMinC, j.TempMaxC = nil, nil
		}
		p.Jours = append(p.Jours, j)
	}

	v := vuePrevisions(p, SeriePluie{}, aujourdhui, true, nil)

	if len(v.Jours) != nombreJoursAffiches-1 {
		t.Fatalf("tendance = %d ligne(s), attendu %d (le dernier jour, sans temperature, est omis)", len(v.Jours), nombreJoursAffiches-1)
	}
	dernierDate := debutDuJour(aujourdhui).AddDate(0, 0, nombreJoursAffiches-1).Format("2006-01-02")
	for _, j := range v.Jours {
		if j.Date == dernierDate {
			t.Errorf("le jour sans temperature (%s) ne doit apparaitre nulle part dans la tendance", dernierDate)
		}
	}
}

// TestVuePrevisions_PluieVentAbsentsLaissentLeurLigneDeCote verifie qu'une
// heure avec temperature connue mais pluie et vent absents (nil,
// independamment de la temperature) rend une VueHeure dont PluieMm/VentKmh/
// VentDirectionDeg restent nil — jamais un zero invente
// (prp/02-horizon-confiance-vent.md, section Degradation).
func TestVuePrevisions_PluieVentAbsentsLaissentLeurLigneDeCote(t *testing.T) {
	base := time.Date(2026, 8, 9, 14, 0, 0, 0, parisTZ)
	p := Previsions{Heures: []HeureMeteo{{
		Heure:            base,
		TemperatureC:     floatPtr(19.5),
		PluiePct:         nil,
		VentKmh:          nil,
		VentDirectionDeg: nil,
	}}}

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)

	if len(v.Heures) != 1 {
		t.Fatalf("nombre d'heures = %d, attendu 1", len(v.Heures))
	}
	h := v.Heures[0]
	if h.TemperatureC != 19.5 {
		t.Errorf("TemperatureC = %v, attendu 19.5 (seule grandeur connue)", h.TemperatureC)
	}
	if h.PluieMm != nil {
		t.Errorf("PluieMm = %v, attendu nil (absent, jamais 0)", *h.PluieMm)
	}
	if h.AversePossible {
		t.Error("AversePossible = true sans risque connu : l'absence ne s'interprete pas")
	}
	if h.VentKmh != nil {
		t.Errorf("VentKmh = %v, attendu nil (absent, jamais 0)", *h.VentKmh)
	}
	if h.VentDirectionDeg != nil {
		t.Errorf("VentDirectionDeg = %v, attendu nil (absent, jamais 0)", *h.VentDirectionDeg)
	}
}

// TestVuePrevisions_JoursPasses_TendanceIgnoreLePasse verifie que
// l'ajout de past_days=7 (meteo.go) ne fait pas remonter des jours passes
// dans la tendance : elle doit toujours commencer a aujourd'hui, meme quand
// p.Jours contient des jours anterieurs.
func TestVuePrevisions_JoursPasses_TendanceIgnoreLePasse(t *testing.T) {
	aujourdhui := time.Date(2026, 8, 16, 8, 0, 0, 0, parisTZ)
	p := Previsions{}
	for i := -7; i <= nombreJoursAffiches-1; i++ {
		p.Jours = append(p.Jours, JourMeteo{Date: debutDuJour(aujourdhui).AddDate(0, 0, i), TempMinC: floatPtr(float64(i) - 1), TempMaxC: floatPtr(float64(i))})
	}

	v := vuePrevisions(p, SeriePluie{}, aujourdhui, true, nil)

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
		TempMinC:             floatPtr(15),
		TempMaxC:             floatPtr(22),
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
	j := JourMeteo{TempMinC: floatPtr(15), TempMaxC: floatPtr(22), CodeMeteo: 3, CouchesConnues: false}
	v := vueJourMeteo(j)
	if v.Symbole != "nuage" || v.Libelle != "couvert" {
		t.Errorf("libelle/symbole = %q/%q, attendu couvert/nuage (retombee sur le code OMM)", v.Libelle, v.Symbole)
	}
}

// TestVueJourMeteo_VentEtConfiance verifie que le vent journalier et
// l'indice de confiance (quand connu) survivent a la conversion en vue,
// arrondis a l'entier comme le reste (prp/02-horizon-confiance-vent.md).
func TestVueJourMeteo_VentEtConfiance(t *testing.T) {
	j := JourMeteo{
		TempMinC:         floatPtr(15),
		TempMaxC:         floatPtr(22),
		VentKmhMax:       floatPtr(28.6),
		RafalesKmhMax:    floatPtr(54.4),
		VentDirectionDeg: floatPtr(224.5),
		Confiance:        "moyenne",
		ConfianceModeles: 5,
	}
	v := vueJourMeteo(j)
	if v.VentKmhMax == nil || *v.VentKmhMax != 29 {
		t.Errorf("VentKmhMax = %v, attendu 29 (arrondi de 28.6)", v.VentKmhMax)
	}
	if v.RafalesKmhMax == nil || *v.RafalesKmhMax != 54 {
		t.Errorf("RafalesKmhMax = %v, attendu 54 (arrondi de 54.4)", v.RafalesKmhMax)
	}
	if v.VentDirectionDeg == nil || *v.VentDirectionDeg != 225 {
		t.Errorf("VentDirectionDeg (jour) = %v, attendu 225 (arrondi de 224.5)", v.VentDirectionDeg)
	}
	if v.Confiance != "moyenne" || v.ConfianceModeles != 5 {
		t.Errorf("Confiance/ConfianceModeles = %q/%d, attendu moyenne/5", v.Confiance, v.ConfianceModeles)
	}
}

// TestVueJourMeteo_ConfianceInconnueResteAbsente verifie que Confiance/
// ConfianceModeles restent a leur zero-valeur quand l'indice n'a pas pu etre
// calcule : c'est ce qui les rend absents du JSON (omitempty, domaine.go).
func TestVueJourMeteo_ConfianceInconnueResteAbsente(t *testing.T) {
	v := vueJourMeteo(JourMeteo{TempMinC: floatPtr(15), TempMaxC: floatPtr(22)})
	if v.Confiance != "" || v.ConfianceModeles != 0 {
		t.Errorf("Confiance/ConfianceModeles = %q/%d, attendu vides/0 sans indice calcule", v.Confiance, v.ConfianceModeles)
	}
}

// TestVueJourMeteo_VentPartielLaisseSaLigneDeCote verifie qu'une grandeur de
// vent absente independamment de la temperature (bord de la fenetre
// Open-Meteo, prp/02-horizon-confiance-vent.md section Degradation) reste
// nil (donc omise du JSON), sans faire tomber les autres a zero.
func TestVueJourMeteo_VentPartielLaisseSaLigneDeCote(t *testing.T) {
	j := JourMeteo{
		TempMinC:      floatPtr(15),
		TempMaxC:      floatPtr(22),
		VentKmhMax:    floatPtr(30),
		RafalesKmhMax: nil, // rafale absente ce jour-la
	}
	v := vueJourMeteo(j)
	if v.VentKmhMax == nil || *v.VentKmhMax != 30 {
		t.Errorf("VentKmhMax = %v, attendu 30 (present)", v.VentKmhMax)
	}
	if v.RafalesKmhMax != nil {
		t.Errorf("RafalesKmhMax = %v, attendu nil (absent, jamais un zero invente)", *v.RafalesKmhMax)
	}
	if v.PluiePctMax != nil {
		t.Errorf("PluiePctMax = %v, attendu nil (absent)", *v.PluiePctMax)
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
func intPtr(v int) *int           { return &v }

func TestArrondi(t *testing.T) {
	if v := arrondi2(6.9449999); v != 6.94 {
		t.Errorf("arrondi2(6.9449999) = %v, attendu 6.94", v)
	}
	if v := arrondi1(21.28); v != 21.3 {
		t.Errorf("arrondi1(21.28) = %v, attendu 21.3", v)
	}
}

// --- La lame d'eau des vignettes horaires (variante B) ----------------------
//
// Ces tests tiennent la promesse du changement : la vignette d'une heure et la
// courbe du meme jour sont tirees de la MEME serie, et ne peuvent donc plus se
// contredire. C'est cette contradiction — courbe a 0 mm, vignettes a 100 % —
// qui a ete signalee le 20 aout 2026.

// serieQuartsPleine fabrique une journee entiere au quart d'heure (96 pas, ou
// 92/100 les jours de changement d'heure), en deposant mm sur CHACUN des
// quatre quarts des heures nommees dans lameParHeure.
func serieQuartsPleine(jour time.Time, lameParQuart map[int]float64) []PasPluie {
	fin := jour.AddDate(0, 0, 1)
	var pas []PasPluie
	for t := jour; t.Before(fin); t = t.Add(dureePasFin) {
		pas = append(pas, PasPluie{Instant: t, Mm: lameParQuart[t.Hour()]})
	}
	return pas
}

// TestPluieParHeure_JourCouvertAuQuart_AdditionneLesQuartsDeLHeure : quand la
// serie fine couvre le jour de bout en bout, l'heure vaut la SOMME de ses
// quatre quarts, jamais l'un d'eux.
func TestPluieParHeure_JourCouvertAuQuart_AdditionneLesQuartsDeLHeure(t *testing.T) {
	jour := time.Date(2026, 8, 20, 0, 0, 0, 0, parisTZ)
	s := SeriePluie{Quarts: serieQuartsPleine(jour, map[int]float64{9: 0.25})}

	parHeure := pluieParHeure(s)

	if got := parHeure[cleHeure(jour.Add(9*time.Hour))]; got != 1.0 {
		t.Errorf("09:00 = %v mm, attendu 1 (quatre quarts a 0,25)", got)
	}
	if got, ok := parHeure[cleHeure(jour.Add(10*time.Hour))]; !ok || got != 0 {
		t.Errorf("10:00 = %v (present %v), attendu 0 present : une heure seche d'un jour couvert est CONNUE, pas absente", got, ok)
	}
}

// TestPluieParHeure_JourPartiellementCouvert_ResteSurLHoraire : une serie fine
// qui s'arrete en cours de journee — le cas du jour ou AROME s'arrete — laisse
// le jour entier a l'horaire. Melanger les deux echelles a l'interieur d'une
// meme journee ferait dire aux vignettes autre chose qu'a la courbe, qui
// retombe elle aussi sur l'horaire entier dans ce cas (vuePluie).
func TestPluieParHeure_JourPartiellementCouvert_ResteSurLHoraire(t *testing.T) {
	jour := time.Date(2026, 8, 22, 0, 0, 0, 0, parisTZ)
	quarts := serieQuartsPleine(jour, map[int]float64{6: 0.25})
	s := SeriePluie{
		Quarts: quarts[:40], // s'arrete a 10:00
		Heures: []PasPluie{{Instant: jour.Add(6 * time.Hour), Mm: 2.4}},
	}

	parHeure := pluieParHeure(s)

	if got := parHeure[cleHeure(jour.Add(6*time.Hour))]; got != 2.4 {
		t.Errorf("06:00 = %v mm, attendu 2,4 (l'horaire, pas la somme des quarts d'un jour tronque)", got)
	}
}

// TestVuePrevisions_LaVignetteEtLaCourbeDisentLeMemeChiffre est le test de la
// promesse : additionner la lame d'eau des vignettes d'un jour redonne
// exactement le cumul que la courbe affiche sous elle.
func TestVuePrevisions_LaVignetteEtLaCourbeDisentLeMemeChiffre(t *testing.T) {
	jour := time.Date(2026, 8, 20, 0, 0, 0, 0, parisTZ)
	s := SeriePluie{Quarts: serieQuartsPleine(jour, map[int]float64{8: 0.1, 9: 0.3, 10: 0.075})}

	var p Previsions
	for h := range 24 {
		p.Heures = append(p.Heures, HeureMeteo{
			Heure:        jour.Add(time.Duration(h) * time.Hour),
			TemperatureC: floatPtr(19),
		})
	}

	courbe := vuePluie(s, nil, jour.Add(12*time.Hour), true, &jour).Jour
	if courbe == nil {
		t.Fatal("courbe absente : la fixture couvre pourtant le jour au quart d'heure")
	}

	v := vuePrevisions(p, s, jour.Add(12*time.Hour), true, &jour)

	var cumul float64
	for _, h := range v.Heures {
		if h.PluieMm == nil {
			t.Fatalf("%s : PluieMm absent alors que la serie couvre ce jour", h.Heure)
		}
		cumul += *h.PluieMm
	}
	if arrondi1(cumul) != courbe.TotalMm {
		t.Errorf("somme des vignettes = %v mm, cumul de la courbe = %v mm : les deux sections doivent dire le meme chiffre", arrondi1(cumul), courbe.TotalMm)
	}
}

// TestVuePrevisions_SourceDePluieEnPanne_LaisseLaLigneDeCote : la courbe et les
// vignettes ont des modes de panne independants. Sans serie, la ligne de pluie
// de la vignette est ABSENTE — jamais un 0 mm invente qui se lirait « il ne
// pleuvra pas ».
func TestVuePrevisions_SourceDePluieEnPanne_LaisseLaLigneDeCote(t *testing.T) {
	base := time.Date(2026, 8, 20, 14, 0, 0, 0, parisTZ)
	p := Previsions{Heures: []HeureMeteo{{
		Heure:        base,
		TemperatureC: floatPtr(19.5),
		PluiePct:     floatPtr(98),
	}}}

	v := vuePrevisions(p, SeriePluie{}, base, true, nil)

	if len(v.Heures) != 1 {
		t.Fatalf("nombre d'heures = %d, attendu 1", len(v.Heures))
	}
	if v.Heures[0].PluieMm != nil {
		t.Errorf("PluieMm = %v, attendu nil (absent, jamais 0)", *v.Heures[0].PluieMm)
	}
	if !v.Heures[0].AversePossible {
		t.Error("AversePossible = false a 98 % : le risque vient des previsions et survit a la panne de la courbe")
	}
}

// TestVuePrevisions_AversePossible_AuSeuilEtEnDessous : le risque d'averse ne
// s'affiche plus en pourcentage mais en pastille, et le seuil est ferme.
func TestVuePrevisions_AversePossible_AuSeuilEtEnDessous(t *testing.T) {
	base := time.Date(2026, 8, 20, 14, 0, 0, 0, parisTZ)
	cas := []struct {
		nom     string
		pct     *float64
		attendu bool
	}{
		{"au seuil", floatPtr(seuilAversePossible), true},
		{"juste en dessous", floatPtr(seuilAversePossible - 1), false},
		{"risque inconnu", nil, false},
	}
	for _, c := range cas {
		t.Run(c.nom, func(t *testing.T) {
			p := Previsions{Heures: []HeureMeteo{{Heure: base, TemperatureC: floatPtr(19), PluiePct: c.pct}}}
			v := vuePrevisions(p, SeriePluie{}, base, true, nil)
			if len(v.Heures) != 1 {
				t.Fatalf("nombre d'heures = %d, attendu 1", len(v.Heures))
			}
			if v.Heures[0].AversePossible != c.attendu {
				t.Errorf("AversePossible = %v, attendu %v", v.Heures[0].AversePossible, c.attendu)
			}
		})
	}
}
