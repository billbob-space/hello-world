// apps/ramure-v2/internal/mesure/mesure.go
//
// Agregation cote serveur des metriques du §04 (N-09, dans le perimetre du
// MVP, pas repousse : c'est la mitigation du risque §14 "metriques non
// instrumentees"). Un instantane JSON est ecrit sur la sortie standard
// toutes les 5 minutes par main.go ; ce paquet ne connait ni fichier ni
// reseau, il ne fait que compter.
//
// L'IDENTITE N'ENTRE JAMAIS ICI. Les evenements sont attribues a une
// "session" — un jeton opaque genere cote client (PRP 07, tache 3), sans
// rapport avec X-Forwarded-User — jamais a une identite. C'est ce qui rend
// N-09 vrai : les metriques par session existent, les personnes
// n'apparaissent pas.
package mesure

import (
	"encoding/json"
	"math"
	"sort"
	"sync"
	"time"
)

// Evenement nomme les six actions mesurees par le lot MVP+V1 (§04). Chaque
// evenement est instrumente AVEC la fonction qu'il mesure, jamais apres
// (PRD §04) : AmorceCollection et AmorcePartage arrivent dans CE PRP, en
// meme temps que la collection et le partage qu'ils jugent.
type Evenement string

const (
	// Plantation : une exploration demarre (recherche, lien partage,
	// artiste garde). Une par session, generalement la premiere.
	Plantation Evenement = "plantation"
	// Promotion : un saut de branche en branche (M-01).
	Promotion Evenement = "promotion"
	// LienEcoute : un lien d'ecoute a ete ouvert (M-03).
	LienEcoute Evenement = "lien_ecoute"
	// Signet : un artiste a ete garde (M-04).
	Signet Evenement = "signet"
	// AmorceCollection : la session a demarre depuis un artiste garde
	// (F-31, M-06).
	AmorceCollection Evenement = "amorce_collection"
	// AmorcePartage : la session a demarre depuis un lien recu (F-34,
	// M-07).
	AmorcePartage Evenement = "amorce_partage"
)

type horodatage struct {
	Evenement Evenement `json:"evenement"`
	Horodate  time.Time `json:"horodate"`
}

// Agregat est l'unique instance par processus (comme cache.Cache et
// budget.Limiteur) : deux agregats se partageraient les evenements sans
// le savoir. Sur de l'emploi concurrent.
type Agregat struct {
	mu       sync.Mutex
	horloge  func() time.Time
	sessions map[string][]horodatage
	latences []time.Duration

	// decouvertes (M-02) : compteurs globaux, alimentes par Decouverte.
	// Compter(Evenement, session) ne porte pas l'identifiant de l'artiste
	// affiche (le contrat du PRP ne le lui donne pas) ; M-02 a besoin de
	// savoir si CE centre a deja ete vu DANS LA SESSION, d'ou une methode
	// dediee plutot qu'un septieme Evenement generique.
	visites         map[string]map[string]bool // session -> artiste -> vu
	centresTotal    int64
	centresNouveaux int64
	tauxDeService   func() (succes, total int64)
}

// Neuf construit un agregat vide. horloge est injectee pour rendre les
// tests deterministes ; nil vaut time.Now.
func Neuf(horloge func() time.Time) *Agregat {
	if horloge == nil {
		horloge = time.Now
	}
	return &Agregat{
		horloge:  horloge,
		sessions: make(map[string][]horodatage),
		visites:  make(map[string]map[string]bool),
	}
}

// BrancherTauxDeService cable la source du taux de service du cache
// (cache.Cache.TauxDeService, PRP 02) : c'est ce chiffre qui permet de
// reviser le seuil de bascule N-13, aujourd'hui pose sur une HYPOTHESE de
// 80 %.
func (a *Agregat) BrancherTauxDeService(f func() (succes, total int64)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.tauxDeService = f
}

// Compter attribue un evenement a une session. Une session vide est
// ignoree silencieusement : sans jeton de session, l'evenement ne peut
// etre rattache a rien (jamais a l'identite, qui n'est pas lue ici).
func (a *Agregat) Compter(e Evenement, session string) {
	if session == "" {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sessions[session] = append(a.sessions[session], horodatage{Evenement: e, Horodate: a.horloge()})
}

// Latence enregistre un echantillon de la duree "graine validee ->
// entourage affiche" (M-05). session est acceptee pour une eventuelle
// ventilation future ; le calcul du P75 courant est global, comme la
// cible N-01/M-05 elle-meme (une latence globale, pas par utilisateur).
func (a *Agregat) Latence(session string, d time.Duration) {
	_ = session
	a.mu.Lock()
	defer a.mu.Unlock()
	a.latences = append(a.latences, d)
}

// Decouverte marque que `artiste` a ete affiche comme centre dans
// `session`, et alimente M-02 ("part de centres jamais visites
// auparavant") : un retour vers un artiste deja vu DANS LA MEME SESSION
// n'est pas une decouverte reelle, une exploration qui boucle sur
// elle-meme (PRD §04 "decouverte reelle, pas circulaire").
func (a *Agregat) Decouverte(session, artiste string) {
	if session == "" || artiste == "" {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.visites[session] == nil {
		a.visites[session] = make(map[string]bool)
	}
	a.centresTotal++
	if !a.visites[session][artiste] {
		a.centresNouveaux++
	}
	a.visites[session][artiste] = true
}

func mediane(valeurs []int) float64 {
	if len(valeurs) == 0 {
		return 0
	}
	tri := append([]int(nil), valeurs...)
	sort.Ints(tri)
	n := len(tri)
	if n%2 == 1 {
		return float64(tri[n/2])
	}
	return float64(tri[n/2-1]+tri[n/2]) / 2
}

// percentile75 utilise la methode du rang le plus proche : usuelle,
// simple, suffisante pour un instantane de surveillance (elle n'a pas
// besoin d'interpoler pour etre utile).
func percentile75(valeurs []time.Duration) time.Duration {
	if len(valeurs) == 0 {
		return 0
	}
	tri := append([]time.Duration(nil), valeurs...)
	sort.Slice(tri, func(i, j int) bool { return tri[i] < tri[j] })
	rang := int(math.Ceil(0.75*float64(len(tri)))) - 1
	if rang < 0 {
		rang = 0
	}
	if rang >= len(tri) {
		rang = len(tri) - 1
	}
	return tri[rang]
}

func ratio(compte, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(compte) / float64(total)
}

// Instantane calcule les sept metriques du lot MVP+V1 (M-01 a M-07) plus
// le taux de service du cache — jamais une identite, jamais une adresse
// electronique : les cles ne portent que des jetons de session opaques,
// et meme ceux-ci ne fuient pas hors des compteurs agreges qui suivent.
func (a *Agregat) Instantane() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()

	var sautsParSession []int
	nSessions := len(a.sessions)
	nEcoute, nConservation, nAmorceCollection, nAmorcePartage := 0, 0, 0, 0
	for _, evs := range a.sessions {
		sauts, aEcoute, aSignet, aAmorceCollection, aAmorcePartage := 0, false, false, false, false
		for _, ev := range evs {
			switch ev.Evenement {
			case Promotion:
				sauts++
			case LienEcoute:
				aEcoute = true
			case Signet:
				aSignet = true
			case AmorceCollection:
				aAmorceCollection = true
			case AmorcePartage:
				aAmorcePartage = true
			}
		}
		sautsParSession = append(sautsParSession, sauts)
		if aEcoute {
			nEcoute++
		}
		if aSignet {
			nConservation++
		}
		if aAmorceCollection {
			nAmorceCollection++
		}
		if aAmorcePartage {
			nAmorcePartage++
		}
	}

	instantane := map[string]any{
		"sautsMedianParSession": mediane(sautsParSession),                           // M-01
		"decouverteReelle":      ratio(int(a.centresNouveaux), int(a.centresTotal)), // M-02
		"ecoute":                ratio(nEcoute, nSessions),                          // M-03
		"conservation":          ratio(nConservation, nSessions),                    // M-04
		"latenceP75Ms":          percentile75(a.latences).Milliseconds(),            // M-05
		"collectionReutilisee":  ratio(nAmorceCollection, nSessions),                // M-06
		"partage":               ratio(nAmorcePartage, nSessions),                   // M-07
		"sessions":              nSessions,
	}
	if a.tauxDeService != nil {
		succes, total := a.tauxDeService()
		instantane["tauxService"] = map[string]int64{"succes": succes, "total": total}
	}
	return instantane
}

// evenementExport est la forme JSON d'un evenement de session : jamais
// d'identite, jamais d'adresse electronique — la session elle-meme est
// deja un jeton opaque, sans rapport avec X-Forwarded-User.
type evenementExport struct {
	Evenement string `json:"evenement"`
	Horodate  string `json:"horodate"`
}

// JournalDeSession (N-10) rend les evenements de LA SEULE session
// demandee, jamais ceux d'une autre — ce n'est pas un second journal,
// c'est une vue du meme agregat que Instantane().
func (a *Agregat) JournalDeSession(session string) []byte {
	a.mu.Lock()
	evs := append([]horodatage(nil), a.sessions[session]...)
	a.mu.Unlock()

	export := make([]evenementExport, len(evs))
	for i, ev := range evs {
		export[i] = evenementExport{Evenement: string(ev.Evenement), Horodate: ev.Horodate.Format(time.RFC3339Nano)}
	}
	octets, err := json.Marshal(export)
	if err != nil {
		return []byte("[]")
	}
	return octets
}
