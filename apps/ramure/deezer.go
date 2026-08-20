// Deezer — role 2 (catalogue de reference), role 1 en repli, role 4 en partie.
//
// Le PRD (§09) fait de la resolution par identifiant le critere decisif du
// role 2 : "une source qui ne sait faire que de la recherche par mots-cles
// produira des discographies polluees d'homonymes". Deezer expose un
// identifiant d'artiste stable, et toute la discographie s'obtient a partir de
// lui — jamais par une seconde recherche textuelle.
//
// Elle a une seconde propriete decisive pour la N-03 : /artist/{id}/related
// rend des fiches d'artiste completes — nom, portrait, identifiant, audience.
// Les branches du canevas ne coutent donc AUCUN appel supplementaire. C'est
// exactement la regle "profondeur maximale au centre, strict minimum sur
// l'entourage", obtenue par le choix de la source plutot que par une
// optimisation ajoutee apres coup.
//
// Enfin elle ne demande aucune cle. Le produit fonctionne donc sans secret
// (N-13), et LASTFM_API_KEY ne fait que l'enrichir.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// baseDeezer est une variable et non une constante pour que les tests puissent
// la pointer vers un serveur simule. La §13 l.impose : "les parcours dependant
// de sources externes sont testes contre un reseau simule. Tester contre des
// sources reelles produit des echecs intermittents qui finissent par etre
// ignores — et masquent alors les vraies regressions."
var baseDeezer = "https://api.deezer.com"

// Durees de vie en cache, calees sur la volatilite reelle de chaque donnee
// (N-04). Une resolution nom -> identifiant ne change jamais ; une liste de
// voisins bouge lentement ; une audience bouge tous les jours mais personne
// ne lit ce nombre a l'unite pres.
const (
	ttlResolution = 30 * 24 * time.Hour
	ttlArtiste    = 24 * time.Hour
	ttlVoisins    = 12 * time.Hour
	ttlAlbums     = 24 * time.Hour
	ttlExtraits   = 24 * time.Hour
	ttlNote       = 7 * 24 * time.Hour
)

// Deezer est le client de la source. Il ne porte aucun etat metier : le cache
// et le compteur de budget lui sont passes, parce qu'ils sont partages avec
// les autres sources.
type Deezer struct {
	http  *http.Client
	cache *Cache
	debit *Debit
}

func NouveauDeezer(cache *Cache) *Deezer {
	return &Deezer{
		http:  &http.Client{Timeout: 8 * time.Second},
		cache: cache,
		// Deezer tolere une cinquantaine d'appels par tranche de cinq
		// secondes. On se tient a huit par seconde avec une rafale de vingt :
		// large sous le plafond, et assez pour qu'une promotion complete ne
		// soit pas ralentie perceptiblement.
		debit: NouveauDebit(8, 20),
	}
}

// appelle execute une requete Deezer et decode sa reponse.
//
// Deezer signale ses erreurs *dans un corps HTTP 200* : un depassement de
// quota arrive avec le meme code de statut qu'un succes. Sans la lecture du
// champ "error", une reponse d'erreur serait prise pour une reponse vide,
// puis — bien pire — mise en cache comme telle. C'est precisement ce que la
// N-05 interdit.
func (d *Deezer) appelle(ctx context.Context, chemin string, cible any, b *Budget) error {
	if err := d.debit.Attends(ctx); err != nil {
		return err
	}
	b.Compte("deezer")

	// baseDeezer+chemin : l'hote appele est TOUJOURS baseDeezer, une adresse
	// fixe ("https://api.deezer.com") qui n'est jamais influencable par une
	// requete entrante — seuls les tests la repointent vers un serveur
	// simule (api_test.go). "chemin" ne peut faire varier que ce qui suit cet
	// hote : soit un terme de recherche passe par url.QueryEscape (Resout,
	// Suggere), soit un identifiant filtre par numeroDeezer, qui n'accepte
	// que ce que strconv.ParseInt reconnait comme un entier (chiffres et
	// signe, jamais "/" ni "://"). Aucun des deux chemins ne peut donc
	// changer le schema ni l'hote appele : ce n'est pas une SSRF.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseDeezer+chemin, nil) //#nosec G704 -- hote fixe (baseDeezer), seule la requete/le chemin varie et il est encode/valide avant concatenation, voir commentaire ci-dessus
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", agentHTTP)

	rep, err := d.http.Do(req) //#nosec G704 -- meme requete que ci-dessus : l'hote appele est baseDeezer, fixe et non influencable par un visiteur
	if err != nil {
		return fmt.Errorf("deezer injoignable : %w", err)
	}
	defer rep.Body.Close()

	if rep.StatusCode != http.StatusOK {
		return fmt.Errorf("deezer a repondu %d", rep.StatusCode)
	}

	// On decode deux fois le meme corps : une passe pour l'enveloppe d'erreur,
	// une pour la charge utile. Le corps tient en memoire sans probleme, et
	// cette approche evite un type d'enveloppe generique par point d'appel.
	brut, err := lisBorne(rep.Body)
	if err != nil {
		return err
	}

	var enveloppe struct {
		Erreur *struct {
			Type    string `json:"type"`
			Message string `json:"message"`
			Code    int    `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(brut, &enveloppe); err == nil && enveloppe.Erreur != nil {
		return fmt.Errorf("deezer %s : %s", enveloppe.Erreur.Type, enveloppe.Erreur.Message)
	}

	return json.Unmarshal(brut, cible)
}

// artisteDeezer est la forme brute d'un artiste chez la source.
type artisteDeezer struct {
	ID           json.Number `json:"id"`
	Nom          string      `json:"name"`
	PortraitMoy  string      `json:"picture_medium"`
	PortraitGros string      `json:"picture_big"`
	Fans         int         `json:"nb_fan"`
	Lien         string      `json:"link"`
}

func (a artisteDeezer) versArtiste() Artiste {
	portrait := a.PortraitGros
	if portrait == "" {
		portrait = a.PortraitMoy
	}
	// Deezer rend une image de repli generique — un disque gris — quand elle
	// n'a pas de portrait. Elle est reconnaissable a son empreinte dans l'URL.
	// La laisser passer produirait un canevas de pastilles identiques ; mieux
	// vaut aucune image et laisser le repli graphique deterministe du client
	// faire son travail (§11, "aucune illustration manquante ne laisse un
	// vide").
	if strings.Contains(portrait, "1f9e1f9e") || strings.Contains(portrait, "/artist//") {
		portrait = ""
	}
	return Artiste{
		ID:         "dz:" + a.ID.String(),
		Nom:        a.Nom,
		Image:      portrait,
		Audience:   a.Fans,
		LienSource: a.Lien,
	}
}

// Resout traduit un nom d'artiste en fiche identifiee.
//
// La correspondance est stricte (§09) : parmi les candidats rendus par la
// recherche, seul celui dont le nom normalise egale le nom demande est retenu.
// Aucun repli sur "le premier resultat" — c'est la regle qui protege de la
// contamination par homonyme.
//
// En cas d'absence, Resout rend aussi la liste des noms candidats : le
// rattrapage orthographique (F-03) s'en sert pour proposer une correction,
// sans avoir a relancer une recherche.
func (d *Deezer) Resout(ctx context.Context, nom string, b *Budget) (Artiste, []string, error) {
	cle := "dz:resout:" + normalise(nom)

	v, err := d.cache.Charge(ctx, cle, ttlResolution, func(ctx context.Context) (any, error) {
		var rep struct {
			Data []artisteDeezer `json:"data"`
		}
		chemin := "/search/artist?limit=12&q=" + url.QueryEscape(nom)
		if err := d.appelle(ctx, chemin, &rep, b); err != nil {
			return nil, err
		}
		return rep.Data, nil
	})
	if err != nil {
		return Artiste{}, nil, err
	}

	candidats, _ := v.([]artisteDeezer)
	noms := make([]string, 0, len(candidats))
	for _, c := range candidats {
		noms = append(noms, c.Nom)
	}

	// A egalite de nom, on prend le plus ecoute. Deezer garde des doublons
	// pour certains artistes — une fiche riche et une fiche fantome sans
	// discographie. La fiche fantome n'a pas d'audience ; ce depart les
	// separe sans jamais changer d'artiste, puisque le nom est deja verifie.
	var meilleur artisteDeezer
	trouve := false
	for _, c := range candidats {
		if !memeNom(c.Nom, nom) {
			continue
		}
		if !trouve || c.Fans > meilleur.Fans {
			meilleur, trouve = c, true
		}
	}
	if !trouve {
		return Artiste{}, noms, nil
	}
	return meilleur.versArtiste(), noms, nil
}

// Suggere alimente les propositions au fil de la frappe (F-01).
//
// Aucune correspondance stricte ici, et c'est voulu : l'utilisateur n'a pas
// fini de taper, donc exiger l'egalite ne rendrait jamais rien. La stricte
// s'applique a la plantation, pas a la suggestion — et comme on plante en
// choisissant une suggestion, on plante bien un nom exact.
func (d *Deezer) Suggere(ctx context.Context, prefixe string, b *Budget) ([]Artiste, error) {
	cle := "dz:suggere:" + normalise(prefixe)

	v, err := d.cache.Charge(ctx, cle, ttlArtiste, func(ctx context.Context) (any, error) {
		var rep struct {
			Data []artisteDeezer `json:"data"`
		}
		chemin := "/search/artist?limit=8&q=" + url.QueryEscape(prefixe)
		if err := d.appelle(ctx, chemin, &rep, b); err != nil {
			return nil, err
		}
		out := make([]Artiste, 0, len(rep.Data))
		for _, a := range rep.Data {
			out = append(out, a.versArtiste())
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	arts, _ := v.([]Artiste)
	return arts, nil
}

// Voisins rend le vivier de proximite pour un artiste (role 1, en repli de
// Last.fm).
//
// Deezer n'expose pas de degre d'affinite : sa liste est simplement ordonnee
// du plus proche au plus lointain. L'affinite est donc *derivee du rang*, de
// facon strictement decroissante. Ce n'est pas une mesure, c'est un ordre —
// mais la F-09 ne demande qu'une variation monotone et perceptible, pas une
// grandeur physique. Last.fm, quand sa cle est presente, fournit la vraie
// mesure et prend le pas.
func (d *Deezer) Voisins(ctx context.Context, idArtiste string, b *Budget) ([]Voisin, error) {
	num, ok := numeroDeezer(idArtiste)
	if !ok {
		return nil, fmt.Errorf("identifiant deezer invalide : %q", idArtiste)
	}
	cle := "dz:voisins:" + num

	v, err := d.cache.Charge(ctx, cle, ttlVoisins, func(ctx context.Context) (any, error) {
		var rep struct {
			Data []artisteDeezer `json:"data"`
		}
		if err := d.appelle(ctx, "/artist/"+num+"/related?limit=40", &rep, b); err != nil {
			return nil, err
		}

		out := make([]Voisin, 0, len(rep.Data))
		n := float64(len(rep.Data))
		for i, a := range rep.Data {
			// Le rang 0 vaut 1.0, le dernier vaut 0.35. Le plancher n'est pas
			// cosmetique : a 0, la pastille aurait une taille nulle et le lien
			// une opacite nulle — le noeud disparaitrait alors qu'il est un
			// candidat legitime.
			affinite := 1.0
			if n > 1 {
				affinite = 1.0 - 0.65*float64(i)/(n-1)
			}
			out = append(out, Voisin{Artiste: a.versArtiste(), Affinite: affinite})
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	vs, _ := v.([]Voisin)
	return vs, nil
}

// Detail complete la fiche du centre : audience et portrait haute definition.
func (d *Deezer) Detail(ctx context.Context, idArtiste string, b *Budget) (Artiste, error) {
	num, ok := numeroDeezer(idArtiste)
	if !ok {
		return Artiste{}, fmt.Errorf("identifiant deezer invalide : %q", idArtiste)
	}

	v, err := d.cache.Charge(ctx, "dz:artiste:"+num, ttlArtiste, func(ctx context.Context) (any, error) {
		var a artisteDeezer
		if err := d.appelle(ctx, "/artist/"+num, &a, b); err != nil {
			return nil, err
		}
		return a.versArtiste(), nil
	})
	if err != nil {
		return Artiste{}, err
	}
	art, _ := v.(Artiste)
	return art, nil
}

// albumDeezer est la forme brute d'une sortie.
type albumDeezer struct {
	ID           json.Number `json:"id"`
	Titre        string      `json:"title"`
	PochetteMoy  string      `json:"cover_medium"`
	PochetteGros string      `json:"cover_big"`
	Sortie       string      `json:"release_date"`
	Genre        string      `json:"record_type"`
	Lien         string      `json:"link"`
}

// Discographie rend le catalogue de l'artiste, resolu par identifiant et non
// par recherche textuelle (F-20 : "la discographie appartient bien a l'artiste
// demande, sans melange avec un homonyme").
func (d *Deezer) Discographie(ctx context.Context, idArtiste string, b *Budget) ([]Album, error) {
	num, ok := numeroDeezer(idArtiste)
	if !ok {
		return nil, fmt.Errorf("identifiant deezer invalide : %q", idArtiste)
	}

	v, err := d.cache.Charge(ctx, "dz:albums:"+num, ttlAlbums, func(ctx context.Context) (any, error) {
		var rep struct {
			Data []albumDeezer `json:"data"`
		}
		if err := d.appelle(ctx, "/artist/"+num+"/albums?limit=100", &rep, b); err != nil {
			return nil, err
		}

		out := make([]Album, 0, len(rep.Data))
		vus := make(map[string]bool, len(rep.Data))
		for _, a := range rep.Data {
			// Les catalogues empilent les reeditions : "Third", "Third
			// (Remastered)", "Third (Deluxe Edition)". Elles portent la meme
			// oeuvre et remplissent la discographie de bruit. On garde la
			// premiere vue par titre canonique — Deezer rend les sorties de la
			// plus recente a la plus ancienne, donc la premiere vue est la
			// reedition la plus recente, celle qui s'ecoute.
			canon := normalise(titreCanonique(a.Titre))
			if canon == "" || vus[canon] {
				continue
			}
			vus[canon] = true

			pochette := a.PochetteGros
			if pochette == "" {
				pochette = a.PochetteMoy
			}
			out = append(out, Album{
				ID:         "dz:" + a.ID.String(),
				Titre:      a.Titre,
				Pochette:   pochette,
				Annee:      annee(a.Sortie),
				Type:       classeSortie(a.Genre, a.Titre),
				LienSource: a.Lien,
			})
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	albums, _ := v.([]Album)
	return albums, nil
}

// Extrait est un morceau court jouable dans le lecteur de la fiche (F-24).
type Extrait struct {
	Titre    string `json:"titre"`
	URL      string `json:"url"`
	Pochette string `json:"pochette,omitempty"`
}

// Extraits rend les titres phares de l'artiste, avec leur apercu de trente
// secondes. C'est ce qui alimente le lecteur de la fiche.
func (d *Deezer) Extraits(ctx context.Context, idArtiste string, b *Budget) ([]Extrait, error) {
	num, ok := numeroDeezer(idArtiste)
	if !ok {
		return nil, fmt.Errorf("identifiant deezer invalide : %q", idArtiste)
	}

	v, err := d.cache.Charge(ctx, "dz:extraits:"+num, ttlExtraits, func(ctx context.Context) (any, error) {
		var rep struct {
			Data []struct {
				Titre  string `json:"title"`
				Apercu string `json:"preview"`
				Album  struct {
					Pochette string `json:"cover_medium"`
				} `json:"album"`
			} `json:"data"`
		}
		if err := d.appelle(ctx, "/artist/"+num+"/top?limit=10", &rep, b); err != nil {
			return nil, err
		}

		out := make([]Extrait, 0, len(rep.Data))
		for _, t := range rep.Data {
			// Un morceau sans apercu n'a rien a faire dans le lecteur : il
			// produirait un bouton inerte, exactement ce que la F-40 interdit.
			if t.Apercu == "" {
				continue
			}
			out = append(out, Extrait{Titre: t.Titre, URL: t.Apercu, Pochette: t.Album.Pochette})
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	ex, _ := v.([]Extrait)
	return ex, nil
}

// numeroDeezer extrait le numero d'un identifiant interne "dz:1069".
func numeroDeezer(id string) (string, bool) {
	num, ok := strings.CutPrefix(id, "dz:")
	if !ok || num == "" {
		return "", false
	}
	if _, err := strconv.ParseInt(num, 10, 64); err != nil {
		return "", false
	}
	return num, true
}

// annee extrait l'annee d'une date "2008-04-28".
func annee(date string) int {
	if len(date) < 4 {
		return 0
	}
	n, err := strconv.Atoi(date[:4])
	if err != nil {
		return 0
	}
	return n
}
