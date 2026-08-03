// Les reglages qui suivent l'utilisateur d'un appareil a l'autre.
//
// Deux exigences les demandent explicitement cote serveur plutot que dans le
// navigateur :
//
//	F-25  "le choix [du service d'ecoute] le suit d'un appareil a l'autre"
//	F-06  "le choix [de tri du mur] survit au rechargement"
//
// La seconde se contenterait d'un stockage local ; la premiere non, et comme
// les deux se rangent au meme endroit, autant les traiter pareil. La
// partition suit la meme regle que la collection : l'identite vient de
// X-Forwarded-User, jamais du client (N-08).
//
// Meme reserve de persistance que la collection : en memoire, documentee dans
// le README de l'app.
package main

import "sync"

// Reglage est ce que l'utilisateur a choisi.
type Reglage struct {
	// ServiceEcoute est la cle d'un des ServicesEcoute (F-25).
	ServiceEcoute string `json:"serviceEcoute"`
	// TriMur ordonne le mur d'accueil (F-06).
	TriMur string `json:"triMur"`
}

// TrisMur sont les ordres proposes pour le mur d'accueil.
//
// La F-06 en exige "au moins trois dont un aleatoire relancable". Le tirage
// aleatoire est relance par le client sans rien recharger — le critere
// d'acceptation precise que "changer de tri ne recharge aucune illustration",
// donc le tri est une permutation de tuiles deja en place, pas une nouvelle
// requete.
var TrisMur = []struct {
	Cle string `json:"cle"`
	Nom string `json:"nom"`
}{
	{"recents", "Gardés en dernier"},
	{"alpha", "Ordre alphabétique"},
	{"audience", "Les plus écoutés"},
	{"hasard", "Au hasard"},
}

func triValide(cle string) bool {
	for _, t := range TrisMur {
		if t.Cle == cle {
			return true
		}
	}
	return false
}

// ReglageParDefaut est ce que voit un utilisateur qui n'a rien choisi. Deezer
// parce que c'est la source du catalogue, donc le seul service pour lequel les
// liens sont exacts plutot que pre-remplis (F-26).
func ReglageParDefaut() Reglage {
	return Reglage{ServiceEcoute: "deezer", TriMur: "recents"}
}

type Reglages struct {
	mu  sync.RWMutex
	par map[string]Reglage
}

func NouveauxReglages() *Reglages {
	return &Reglages{par: make(map[string]Reglage)}
}

func (r *Reglages) Lis(utilisateur string) Reglage {
	if utilisateur == "" {
		return ReglageParDefaut()
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	reg, ok := r.par[utilisateur]
	if !ok {
		return ReglageParDefaut()
	}
	return reg
}

// Ecris enregistre un reglage, en ignorant les valeurs inconnues plutot qu'en
// les rejetant. Un client d'une version anterieure qui envoie un tri disparu
// ne doit pas voir son enregistrement echouer : il garde simplement l'ancienne
// valeur pour ce champ.
func (r *Reglages) Ecris(utilisateur string, demande Reglage) Reglage {
	if utilisateur == "" {
		return ReglageParDefaut()
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	reg, ok := r.par[utilisateur]
	if !ok {
		reg = ReglageParDefaut()
	}
	if demande.ServiceEcoute != "" {
		for _, s := range ServicesEcoute {
			if s.Cle == demande.ServiceEcoute {
				reg.ServiceEcoute = demande.ServiceEcoute
				break
			}
		}
	}
	if demande.TriMur != "" && triValide(demande.TriMur) {
		reg.TriMur = demande.TriMur
	}

	r.par[utilisateur] = reg
	return reg
}
