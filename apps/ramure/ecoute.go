// Role 4 — la resolution des liens d'ecoute (F-25, F-26).
//
// Le PRD range ce role en "souhaitable, repli systematique" et fixe une regle
// nette pour la F-26 : "un lien mene a la page la plus precise atteignable ;
// a defaut, a une recherche pre-remplie — jamais a une page vide ou erronee".
//
// La consequence de conception est qu'il n'existe pas de cas "pas de lien".
// Une recherche pre-remplie aboutit toujours quelque part d'utile, alors qu'un
// bouton absent laisse l'utilisateur devant un cul-de-sac apres avoir fait tout
// le chemin d'exploration. Le repli n'est donc pas un pis-aller : c'est le
// comportement nominal pour tous les services sauf celui qui a servi de
// catalogue.
package main

import (
	"net/url"
	"strings"
)

// Service est une plateforme d'ecoute proposee a l'utilisateur (F-25).
type Service struct {
	Cle string `json:"cle"`
	Nom string `json:"nom"`
	// Recherche est le gabarit de repli. %s recoit la requete encodee.
	recherche string
}

// ServicesEcoute est la liste proposee dans les reglages. Elle est
// deliberement courte : au-dela, le choix devient une corvee de configuration
// pour un produit qu'on ouvre pour explorer.
var ServicesEcoute = []Service{
	{Cle: "deezer", Nom: "Deezer", recherche: "https://www.deezer.com/search/%s"},
	{Cle: "spotify", Nom: "Spotify", recherche: "https://open.spotify.com/search/%s"},
	{Cle: "apple", Nom: "Apple Music", recherche: "https://music.apple.com/fr/search?term=%s"},
	{Cle: "youtube", Nom: "YouTube Music", recherche: "https://music.youtube.com/search?q=%s"},
	{Cle: "tidal", Nom: "Tidal", recherche: "https://tidal.com/search?q=%s"},
	{Cle: "qobuz", Nom: "Qobuz", recherche: "https://www.qobuz.com/fr-fr/search?q=%s"},
	{Cle: "bandcamp", Nom: "Bandcamp", recherche: "https://bandcamp.com/search?q=%s"},
}

// serviceParCle retrouve un service, en tombant sur Deezer pour une cle
// inconnue. Un service inconnu ne doit pas priver l'utilisateur de tout lien :
// c'est un reglage perime, pas une panne.
func serviceParCle(cle string) Service {
	for _, s := range ServicesEcoute {
		if s.Cle == cle {
			return s
		}
	}
	return ServicesEcoute[0]
}

// LienArtiste rend l'adresse d'ecoute d'un artiste sur le service choisi.
//
// Le lien exact n'est disponible que pour le service qui a servi de catalogue —
// resoudre l'adresse exacte chez les six autres demanderait un fournisseur de
// role 4 a part entiere, un appel reseau par lien, et une cle. Le PRD autorise
// explicitement le repli, et le rapport cout/benefice tranche : la recherche
// pre-remplie sur le nom de l'artiste tombe sur la bonne page au premier
// resultat, pour zero appel.
func LienArtiste(art Artiste, cleService string) string {
	s := serviceParCle(cleService)
	if s.Cle == "deezer" && art.LienSource != "" {
		return art.LienSource
	}
	return rechercheSur(s, art.Nom)
}

// LienAlbum rend l'adresse d'ecoute d'un album.
//
// La requete de repli associe le nom de l'artiste au titre : "Mezzanine" seul
// ramene une dizaine d'oeuvres homonymes chez tous les services, ce qui serait
// exactement la "page erronee" que la F-26 interdit.
func LienAlbum(alb Album, nomArtiste, cleService string) string {
	s := serviceParCle(cleService)
	if s.Cle == "deezer" && alb.LienSource != "" {
		return alb.LienSource
	}
	return rechercheSur(s, nomArtiste+" "+titreCanonique(alb.Titre))
}

func rechercheSur(s Service, requete string) string {
	requete = strings.TrimSpace(requete)
	if requete == "" {
		return ""
	}
	return strings.Replace(s.recherche, "%s", url.QueryEscape(requete), 1)
}
