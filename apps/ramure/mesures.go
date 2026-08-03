// L'instrumentation produit (N-09) et le journal de diagnostic (N-10).
//
// La N-09 est explicite sur ce qui ne compte pas : "les evenements necessaires
// au calcul des metriques de la §04 sont emis et AGREGES COTE SERVEUR des le
// MVP. Un journal local non agrege ne satisfait pas cette exigence." Le risque
// "metriques non instrumentees" de la §14 dit pourquoi : sans agregation, le
// produit ne peut pas prouver qu'il fonctionne, et la decision de continuer ou
// d'arreter se prend au ressenti.
//
// Ce qui est agrege ici ne contient aucune donnee personnelle : des compteurs,
// des histogrammes de latence, et le nombre de sessions distinctes. Aucun nom
// d'artiste, aucune adresse e-mail, aucun identifiant d'utilisateur. Les
// metriques de la §04 se calculent toutes sans eux.
package main

import (
	"sort"
	"sync"
	"time"
)

// Les evenements admis. Une liste fermee, et non un champ texte libre :
// un client compromis ou un bogue ne doit pas pouvoir faire grossir la table
// des compteurs sans limite, ni polluer les metriques avec des noms inventes.
var evenementsAdmis = map[string]bool{
	"session":             true, // ouverture d'une session
	"plante":              true, // une graine est plantee
	"promotion":           true, // M-01 : un saut
	"centre-nouveau":      true, // M-02 : centre jamais visite auparavant
	"centre-revu":         true, // M-02 : centre deja visite
	"ecoute-ouverte":      true, // M-03 : un lien d'ecoute est ouvert
	"artiste-garde":       true, // M-04 : un artiste est garde
	"depuis-garde":        true, // M-06 : session amorcee depuis la collection
	"depuis-partage":      true, // M-07 : session ouverte depuis un lien partage
	"rebattu":             true, // F-15
	"lignee-remontee":     true, // contre-indicateur : retours en arriere repetes
	"recherche-sans-saut": true, // contre-indicateur : usage en moteur de recherche
	"erreur-affichee":     true, // F-36 : combien de fois une panne est vue
	"vide-affiche":        true, // F-36 : combien de fois "rien a montrer" est vu
}

// Mesures agrege les evenements produit.
type Mesures struct {
	mu sync.Mutex

	compteurs map[string]int
	// sauts compte les promotions par session, pour la mediane de M-01.
	sauts map[string]int
	// sessions retient ce qui qualifie une session pour M-03 et M-04 : elles
	// se mesurent en "part de sessions comportant au moins un ...", donc il
	// faut connaitre l'ensemble des sessions, pas seulement les evenements.
	sessions map[string]*session

	// latences echantillonne le delai entre validation d'un nom et affichage
	// de l'entourage, pour le P75 de M-05 et la N-01.
	latences []float64

	debut      time.Time
	maintenant func() time.Time
}

type session struct {
	vue    time.Time
	sauts  int
	ecoute bool
	garde  bool
}

// tailleEchantillon borne l'histogramme de latence. Un serveur qui tourne des
// semaines accumulerait sinon des millions de mesures pour un percentile qui
// n'en demande que quelques milliers.
const tailleEchantillon = 4096

// sessionsMax borne la table des sessions, pour la meme raison. Au-dela, les
// plus anciennes sont oubliees : elles ont deja ete comptees dans les
// compteurs cumulatifs.
const sessionsMax = 20000

func NouvellesMesures() *Mesures {
	m := time.Now
	return &Mesures{
		compteurs:  make(map[string]int),
		sauts:      make(map[string]int),
		sessions:   make(map[string]*session),
		debut:      m(),
		maintenant: m,
	}
}

// Emet enregistre un evenement. idSession est un identifiant opaque tire par
// le client au chargement de la page : il ne permet pas de remonter a une
// personne, seulement de rattacher les evenements d'une meme visite.
func (m *Mesures) Emet(idSession, evenement string) bool {
	if !evenementsAdmis[evenement] {
		return false
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.compteurs[evenement]++

	if idSession == "" {
		return true
	}
	s, ok := m.sessions[idSession]
	if !ok {
		if len(m.sessions) >= sessionsMax {
			m.oublieLesPlusAnciennes()
		}
		s = &session{vue: m.maintenant()}
		m.sessions[idSession] = s
	}
	s.vue = m.maintenant()

	switch evenement {
	case "promotion":
		s.sauts++
		m.sauts[idSession]++
	case "ecoute-ouverte":
		s.ecoute = true
	case "artiste-garde":
		s.garde = true
	}
	return true
}

// Latence enregistre un delai d'affichage, en millisecondes (M-05, N-01).
func (m *Mesures) Latence(ms float64) {
	if ms <= 0 || ms > 120000 {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.latences) >= tailleEchantillon {
		// Fenetre glissante : on garde la seconde moitie. Le percentile suit
		// alors le comportement recent, ce qui est ce qu'on veut surveiller.
		m.latences = append(m.latences[:0], m.latences[tailleEchantillon/2:]...)
	}
	m.latences = append(m.latences, ms)
}

// Etat calcule les metriques de la §04 sous leur forme publiable.
func (m *Mesures) Etat() map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()

	total := len(m.sessions)
	avecEcoute, avecGarde := 0, 0
	sauts := make([]int, 0, total)
	for _, s := range m.sessions {
		if s.ecoute {
			avecEcoute++
		}
		if s.garde {
			avecGarde++
		}
		sauts = append(sauts, s.sauts)
	}

	nouveaux := m.compteurs["centre-nouveau"]
	revus := m.compteurs["centre-revu"]

	return map[string]any{
		"depuis":    m.debut.UTC().Format(time.RFC3339),
		"compteurs": copieCompteurs(m.compteurs),
		"sessions":  total,

		// M-01 · nombre median de sauts par session · cible ≥ 4
		"M-01-sautsMedians": mediane(sauts),
		// M-02 · part de centres jamais visites · cible ≥ 60 %
		"M-02-partNouveaux": part(nouveaux, nouveaux+revus),
		// M-03 · sessions avec au moins une ecoute · cible ≥ 45 %
		"M-03-partAvecEcoute": part(avecEcoute, total),
		// M-04 · sessions avec au moins un artiste garde · cible ≥ 30 %
		"M-04-partAvecGarde": part(avecGarde, total),
		// M-05 · latence P75 d'affichage de l'entourage · cible ≤ 1500 ms
		"M-05-latenceP75ms": percentile(m.latences, 0.75),
		// M-06 · sessions amorcees depuis la collection · cible ≥ 20 %
		"M-06-partDepuisGarde": part(m.compteurs["depuis-garde"], total),
		// M-07 · sessions ouvertes depuis un lien partage · cible ≥ 10 %
		"M-07-partDepuisPartage": part(m.compteurs["depuis-partage"], total),
	}
}

// oublieLesPlusAnciennes fait de la place dans la table des sessions. Appelee
// avec le verrou tenu.
func (m *Mesures) oublieLesPlusAnciennes() {
	type age struct {
		id string
		t  time.Time
	}
	ages := make([]age, 0, len(m.sessions))
	for id, s := range m.sessions {
		ages = append(ages, age{id, s.vue})
	}
	sort.Slice(ages, func(i, j int) bool { return ages[i].t.Before(ages[j].t) })

	for i := 0; i < len(ages)/4; i++ {
		delete(m.sessions, ages[i].id)
		delete(m.sauts, ages[i].id)
	}
}

func copieCompteurs(src map[string]int) map[string]int {
	out := make(map[string]int, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func part(n, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(n) / float64(total)
}

func mediane(vs []int) float64 {
	if len(vs) == 0 {
		return 0
	}
	tri := make([]int, len(vs))
	copy(tri, vs)
	sort.Ints(tri)

	milieu := len(tri) / 2
	if len(tri)%2 == 1 {
		return float64(tri[milieu])
	}
	return float64(tri[milieu-1]+tri[milieu]) / 2
}

// percentile rend le p-ieme percentile d'un echantillon, par la methode du
// rang le plus proche. Suffisant ici : on surveille un ordre de grandeur
// contre une cible de 1,5 s, pas une valeur au dixieme de milliseconde.
func percentile(vs []float64, p float64) float64 {
	if len(vs) == 0 {
		return 0
	}
	tri := make([]float64, len(vs))
	copy(tri, vs)
	sort.Float64s(tri)

	rang := int(p*float64(len(tri)-1) + 0.5)
	if rang < 0 {
		rang = 0
	}
	if rang >= len(tri) {
		rang = len(tri) - 1
	}
	return tri[rang]
}
