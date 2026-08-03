// L'agregateur des quatre roles de donnees de la §09.
//
// Le PRD ne nomme aucun fournisseur : il decrit des *roles*, et delegue le
// choix (§17). Cette app couvre les quatre roles ainsi, et le raisonnement
// vaut d'etre ecrit parce qu'il conditionne tout le budget d'appels :
//
//	role 1  proximite   Deezer /related fournit le vivier, Last.fm repondere
//	role 2  catalogue   Deezer, resolution par identifiant
//	role 3  appreciation Last.fm artist.getTopAlbums, un seul appel
//	role 4  ecoute      Deezer en direct, recherche pre-remplie en repli
//
// Le point non evident est le role 1. Last.fm donne la vraie mesure
// d'affinite — un "match" normalise entre 0 et 1, exactement ce que la §09
// demande — mais ses fiches d'artiste n'ont ni identifiant exploitable ici ni
// portrait utilisable. Batir les branches sur Last.fm imposerait donc une
// resolution Deezer par voisin : dix appels de plus a chaque promotion, pour
// le geste le plus frequent du produit. C'est exactement le mecanisme de
// depassement de quota decrit par l'encadre de la §10.
//
// D'ou la composition retenue : le vivier vient de Deezer, qui rend des fiches
// completes en un appel, et Last.fm ne sert qu'a REPONDERER ce vivier par
// appariement de noms. Un seul appel supplementaire, la vraie affinite la ou
// elle existe, et aucun cout par branche.
//
// Consequence directe : le produit tourne sans aucune cle d'API. LASTFM_API_KEY
// l'enrichit, son absence ne le casse pas (N-06, N-13).
package main

import (
	"context"
	"errors"
	"io"
	"sort"
	"sync"
)

const agentHTTP = "ramure/1.0 (+https://ramure.apps.billbob.ovh)"

// tailleMaxCorps borne la lecture d'une reponse externe. Une source qui
// deraille et repond un flux infini ne doit pas pouvoir epuiser la memoire
// d'un conteneur limite a 128 Mo.
const tailleMaxCorps = 4 << 20 // 4 Mio

func lisBorne(r io.Reader) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, tailleMaxCorps))
}

// Voisin est un artiste proche assorti de son degre d'affinite : la sortie du
// role 1.
type Voisin struct {
	Artiste
	Affinite float64
}

// Budget compte les appels externes d'une operation (N-03).
//
// La N-03 exige que "chaque promotion ait un cout borne et documente en nombre
// d'appels par source". Compter est le seul moyen de rendre cette exigence
// verifiable au lieu de declarative : le compteur remonte dans /api/diagnostic
// et dans le journal de session exportable (N-10).
type Budget struct {
	mu      sync.Mutex
	appels  map[string]int
	plafond int
}

func NouveauBudget(plafond int) *Budget {
	return &Budget{appels: make(map[string]int), plafond: plafond}
}

// Compte enregistre un appel vers une source.
func (b *Budget) Compte(source string) {
	if b == nil {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.appels[source]++
}

// Depasse dit si l'operation a franchi son plafond. Les appels facultatifs —
// les heritiers, l'appreciation — le consultent avant de partir : c'est ainsi
// que le budget devient une contrainte effective plutot qu'une mesure a
// posteriori.
func (b *Budget) Depasse() bool {
	if b == nil || b.plafond <= 0 {
		return false
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	total := 0
	for _, n := range b.appels {
		total += n
	}
	return total >= b.plafond
}

func (b *Budget) Etat() map[string]int {
	if b == nil {
		return nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make(map[string]int, len(b.appels)+1)
	total := 0
	for s, n := range b.appels {
		out[s] = n
		total += n
	}
	out["total"] = total
	return out
}

// ErrVide signale qu'une source a repondu correctement, mais sans resultat.
//
// Ce n'est PAS une erreur de chargement, et la distinction est la F-36, une
// des deux exigences marquees critiques du PRD : "un artiste sans voisins
// connus et un echec de chargement produisent deux messages differents ; seul
// le second propose de reessayer". Confondre les deux fait proposer "reessayer"
// sur un artiste qui n'aura jamais de voisins — l'utilisateur reessaie en
// boucle sans jamais rien obtenir.
var ErrVide = errors.New("aucun resultat")

// Sources compose les fournisseurs des quatre roles.
type Sources struct {
	deezer *Deezer
	lastfm *Lastfm // nil quand aucune cle n'est configuree
	cache  *Cache
}

func NouvellesSources(cache *Cache, cleLastfm string) *Sources {
	s := &Sources{deezer: NouveauDeezer(cache), cache: cache}
	if cleLastfm != "" {
		s.lastfm = NouveauLastfm(cache, cleLastfm)
	}
	return s
}

// RoleActifs decrit la couverture effective des roles, pour /api/diagnostic
// et pour l'ecran de diagnostic de la N-10.
func (s *Sources) RolesActifs() map[string]string {
	proximite := "deezer (affinite derivee du rang)"
	appreciation := "aucune — ordre d'origine conserve"
	if s.lastfm != nil {
		proximite = "deezer + last.fm (affinite mesuree)"
		appreciation = "last.fm"
	}
	return map[string]string{
		"1-proximite":    proximite,
		"2-catalogue":    "deezer (resolution par identifiant)",
		"3-appreciation": appreciation,
		"4-ecoute":       "deezer en direct, recherche pre-remplie en repli",
	}
}

// Resout traduit un nom en centre identifie, avec rattrapage orthographique
// borne (F-03).
//
// Le rattrapage n'est tente qu'apres l'echec de la correspondance stricte, et
// il ne choisit que parmi des candidats deja rendus par la source — il ne peut
// donc pas inventer un artiste. S'il aboutit, l'appelant en est informe par
// corrige=true : la F-03 veut que l'utilisateur voie sous quelle forme son nom
// a ete replante, pas qu'on le lui cache.
func (s *Sources) Resout(ctx context.Context, nom string, b *Budget) (art Artiste, corrige bool, err error) {
	art, candidats, err := s.deezer.Resout(ctx, nom, b)
	if err != nil {
		return Artiste{}, false, err
	}
	if art.ID != "" {
		return art, false, nil
	}

	if corrigeVers := meilleureCorrection(nom, candidats); corrigeVers != "" {
		art, _, err = s.deezer.Resout(ctx, corrigeVers, b)
		if err != nil {
			return Artiste{}, false, err
		}
		if art.ID != "" {
			return art, true, nil
		}
	}

	return Artiste{}, false, ErrVide
}

// Vivier rend l'ensemble des artistes proches d'un centre, trie par affinite
// decroissante.
//
// C'est ici que la reponderation Last.fm s'applique. Elle ne peut qu'ameliorer
// le resultat : si Last.fm est absent, muet, ou ne connait pas l'artiste, le
// vivier Deezer passe tel quel. La N-06 en fait une exigence — "l'indisponibi-
// lite d'une source secondaire degrade une fonction, jamais l'ecran".
func (s *Sources) Vivier(ctx context.Context, centre Artiste, b *Budget) ([]Voisin, error) {
	voisins, err := s.deezer.Voisins(ctx, centre.ID, b)
	if err != nil {
		return nil, err
	}
	if len(voisins) == 0 {
		return nil, ErrVide
	}

	if s.lastfm != nil && !b.Depasse() {
		if mesures, err := s.lastfm.Similaires(ctx, centre.Nom, b); err == nil && len(mesures) > 0 {
			voisins = reponderePar(voisins, mesures)
		}
		// Une erreur Last.fm est deliberement ignoree : le vivier Deezer est
		// deja utilisable. La journaliser suffirait a alerter l'exploitant
		// sans rien changer pour l'utilisateur.
	}

	sort.SliceStable(voisins, func(i, j int) bool {
		return voisins[i].Affinite > voisins[j].Affinite
	})
	return voisins, nil
}

// repondere remplace l'affinite derivee du rang par l'affinite mesuree, la ou
// les deux sources parlent du meme artiste.
//
// L'appariement se fait sur le nom normalise. C'est le seul appariement
// possible entre deux catalogues sans identifiant commun, et il est sur dans ce
// sens-la : on ne cherche pas a decouvrir un artiste par son nom, on cherche a
// retrouver un artiste DEJA presente dans la liste Deezer. Le pire cas d'un
// faux appariement est donc une affinite legerement fausse pour une branche,
// jamais un artiste substitue a un autre.
func reponderePar(voisins []Voisin, mesures map[string]float64) []Voisin {
	out := make([]Voisin, len(voisins))
	copy(out, voisins)

	for i := range out {
		if m, ok := mesures[normalise(out[i].Nom)]; ok {
			// La mesure Last.fm prime, mais on garde un plancher issu du rang
			// Deezer : Last.fm rend parfois des scores tres bas pour des
			// voisins que Deezer juge evidents, et une affinite proche de zero
			// ferait disparaitre visuellement une branche pertinente.
			out[i].Affinite = max(m, out[i].Affinite*0.5)
		} else {
			// Absent de Last.fm : le voisin reste candidat, avec une legere
			// decote. Il vaut moins qu'un voisin confirme par deux sources,
			// mais reste dans le vivier — c'est ce qui garde de la variete
			// pour le tirage de la F-08.
			out[i].Affinite *= 0.85
		}
	}
	return out
}

// Fiche complete le centre : biographie, genres, audience (F-19).
//
// Chaque enrichissement est facultatif et independant. Une biographie
// manquante ne doit pas priver la fiche de sa discographie.
func (s *Sources) Fiche(ctx context.Context, centre Artiste, b *Budget) Artiste {
	if detail, err := s.deezer.Detail(ctx, centre.ID, b); err == nil && detail.ID != "" {
		if detail.Image != "" {
			centre.Image = detail.Image
		}
		if detail.Audience > 0 {
			centre.Audience = detail.Audience
		}
		if detail.LienSource != "" {
			centre.LienSource = detail.LienSource
		}
	}

	if s.lastfm != nil {
		if info, err := s.lastfm.Info(ctx, centre.Nom, b); err == nil {
			centre.Bio = info.Bio
			centre.Genres = info.Genres
			if centre.Audience == 0 {
				centre.Audience = info.Auditeurs
			}
		}
	}
	return centre
}

// Discographie rend le catalogue du centre, classe par appreciation quand elle
// est disponible (F-21).
func (s *Sources) Discographie(ctx context.Context, centre Artiste, b *Budget) ([]Album, error) {
	albums, err := s.deezer.Discographie(ctx, centre.ID, b)
	if err != nil {
		return nil, err
	}
	if len(albums) == 0 {
		return nil, ErrVide
	}

	if s.lastfm != nil {
		if notes, err := s.lastfm.Appreciations(ctx, centre.Nom, b); err == nil {
			appliqueAppreciations(albums, notes)
		}
	}

	return classeParAppreciation(albums), nil
}

// appliqueAppreciations pose la note communautaire sur les albums qui en ont
// une. Les autres gardent Note=0 et Votes=0, ce qui n'est pas "mal note" mais
// "non evalue" — la distinction est ce qui permet a la F-21 de conserver leur
// ordre d'origine au lieu de les reléguer.
func appliqueAppreciations(albums []Album, notes map[string]Appreciation) {
	for i := range albums {
		cle := normalise(titreCanonique(albums[i].Titre))
		if a, ok := notes[cle]; ok {
			albums[i].Note = a.Note
			albums[i].Votes = a.Votes
		}
	}
}

// classeParAppreciation ordonne la discographie.
//
// La F-21 tient en une phrase piegeuse : "les albums non apprecies conservent
// un ordre stable". Un tri naif par note descendante enverrait tous les albums
// non evalues a la fin, dans un ordre arbitraire — et sur les genres mal
// couverts par le role 3, c'est-a-dire ceux que le produit sert le mieux, ca
// donnerait une discographie qui parait melangee au hasard.
//
// Le tri retenu separe donc les deux populations : les albums evalues d'abord,
// par note ; les non evalues ensuite, dans l'ordre d'origine, qui est
// l'anteriorite du catalogue. sort.SliceStable est ce qui garantit la seconde
// moitie du contrat.
func classeParAppreciation(albums []Album) []Album {
	out := make([]Album, len(albums))
	copy(out, albums)

	sort.SliceStable(out, func(i, j int) bool {
		ai, aj := out[i].Votes >= seuilVotes, out[j].Votes >= seuilVotes
		if ai != aj {
			return ai
		}
		if !ai {
			return false // les deux non evalues : ordre d'origine conserve
		}
		return out[i].Note > out[j].Note
	})
	return out
}

// seuilVotes ecarte les notes non significatives (§09, role 3 : "un seuil
// minimal de votes doit etre applicable"). En dessous, un album porte par une
// poignee d'ecoutes remonterait en tete de discographie devant l'album de
// reference de l'artiste.
const seuilVotes = 500

// Extraits alimente le lecteur de la fiche (F-24).
func (s *Sources) Extraits(ctx context.Context, centre Artiste, b *Budget) ([]Extrait, error) {
	ex, err := s.deezer.Extraits(ctx, centre.ID, b)
	if err != nil {
		return nil, err
	}
	if len(ex) == 0 {
		return nil, ErrVide
	}
	return ex, nil
}

// Heritiers charge la deuxieme generation, une grappe par branche (F-10).
//
// C'est l'operation la plus couteuse du produit : un appel par branche. Elle
// est donc separee du chargement de l'arbre et appelee apres lui par le client
// (F-39, affichage progressif), bornee par le budget, et parallelisee avec un
// plafond de concurrence — dix requetes simultanees vers la meme source
// declencheraient la limite de debit que le seau a jetons existe pour eviter.
// dejaDansLArbre est l'ensemble des artistes qu'il ne faut pas reproposer en
// heritier : le centre et toutes les branches.
func (s *Sources) Heritiers(ctx context.Context, branches []Artiste, parBranche int, dejaDansLArbre map[string]bool, b *Budget) map[string][]Voisin {
	out := make(map[string][]Voisin, len(branches))

	// pris grandit au fil des grappes et sert de filtre commun. C'est ce qui
	// empeche le meme artiste d'apparaitre comme heritier de trois branches a
	// la fois — un defaut tres visible sur les scenes musicales denses, ou les
	// memes noms reviennent partout : l'arbre se remplit de doublons, les
	// libelles se recouvrent, et l'utilisateur croit que l'outil bafouille au
	// lieu de lui proposer une deuxieme generation.
	pris := make(map[string]bool, len(dejaDansLArbre)+len(branches)*parBranche)
	for id := range dejaDansLArbre {
		pris[id] = true
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	jetons := make(chan struct{}, 4)

	// Les viviers sont d'abord collectes, puis filtres SEQUENTIELLEMENT.
	// L'ordre importe : un filtrage concurrent donnerait un arbre different a
	// chaque chargement pour un meme entourage, selon qui gagne la course.
	viviers := make(map[string][]Voisin, len(branches))

	for _, br := range branches {
		if b.Depasse() {
			break
		}
		wg.Add(1)
		go func(br Artiste) {
			defer wg.Done()
			jetons <- struct{}{}
			defer func() { <-jetons }()

			vs, err := s.deezer.Voisins(ctx, br.ID, b)
			if err != nil || len(vs) == 0 {
				// Une grappe manquante n'est pas une erreur d'ecran : la
				// branche reste affichee, simplement sans heritiers.
				return
			}
			mu.Lock()
			viviers[br.ID] = vs
			mu.Unlock()
		}(br)
	}
	wg.Wait()

	// Les branches sont parcourues dans leur ordre d'affinite, donc la plus
	// proche du centre se sert la premiere dans le vivier commun.
	for _, br := range branches {
		vs := viviers[br.ID]
		grappe := make([]Voisin, 0, parBranche)

		for _, v := range vs {
			if len(grappe) >= parBranche {
				break
			}
			if pris[v.ID] {
				continue
			}
			pris[v.ID] = true
			grappe = append(grappe, v)
		}

		if len(grappe) > 0 {
			out[br.ID] = grappe
		}
	}

	return out
}

// Suggere alimente la saisie assistee (F-01).
func (s *Sources) Suggere(ctx context.Context, prefixe string, b *Budget) ([]Artiste, error) {
	return s.deezer.Suggere(ctx, prefixe, b)
}

// AlbumClasse est une entree du palmares : un album, plus l'artiste dont il
// vient. La F-27 exige que "selectionner un resultat replante l'arbre sur son
// artiste" — le rattachement doit donc voyager avec l'album.
type AlbumClasse struct {
	Album
	ArtisteID  string `json:"artisteId"`
	ArtisteNom string `json:"artisteNom"`
	Lien       string `json:"lien"`
}

// Palmares classe les meilleurs albums de tous les artistes visibles (F-27).
//
// L'operation est bornee en nombre d'artistes ET par le budget d'appels, parce
// que c'est mecaniquement la plus couteuse du produit : une discographie par
// artiste affiche. Les reponses viennent presque toujours du cache — les
// discographies du centre ont deja ete chargees pour la fiche, et celles des
// branches le seront a leur premiere promotion — mais compter dessus sans
// borne serait exactement l'erreur que l'encadre de la §10 decrit.
//
// Les albums sans appreciation sont ECARTES du palmares, alors qu'ils sont
// conserves dans la discographie. La difference tient a ce que chaque ecran
// promet : une discographie promet l'exhaustivite, un classement promet un
// ordre. Melanger des albums notes et non notes dans un classement produirait
// un ordre arbitraire presente comme un palmares — c'est le risque "couverture
// partielle de l'appreciation" de la §14, qui impose "un etat vide explicite
// plutot qu'un classement trompeur".
func (s *Sources) Palmares(ctx context.Context, ids []string, maxResultats int, cleService string, b *Budget) []AlbumClasse {
	type lot struct {
		artiste Artiste
		albums  []Album
	}

	lots := make([]lot, 0, len(ids))
	var mu sync.Mutex
	var wg sync.WaitGroup
	jetons := make(chan struct{}, 4)

	for _, id := range ids {
		if b.Depasse() {
			break
		}
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			jetons <- struct{}{}
			defer func() { <-jetons }()

			art, err := s.deezer.Detail(ctx, id, b)
			if err != nil {
				return
			}
			albums, err := s.Discographie(ctx, art, b)
			if err != nil {
				return
			}
			mu.Lock()
			lots = append(lots, lot{art, albums})
			mu.Unlock()
		}(id)
	}
	wg.Wait()

	out := make([]AlbumClasse, 0, 64)
	for _, l := range lots {
		for _, a := range l.albums {
			if a.Votes < seuilVotes {
				continue
			}
			out = append(out, AlbumClasse{
				Album:      a,
				ArtisteID:  l.artiste.ID,
				ArtisteNom: l.artiste.Nom,
				Lien:       LienAlbum(a, l.artiste.Nom, cleService),
			})
		}
	}

	// Le tri se fait sur les votes absolus et non sur la note, qui est
	// relative a son artiste : un album mediocre d'un groupe tres ecoute
	// obtiendrait sinon la meme place que le chef-d'oeuvre d'un groupe obscur.
	// Un palmares transversal a l'arbre doit comparer des grandeurs
	// comparables.
	sort.SliceStable(out, func(i, j int) bool { return out[i].Votes > out[j].Votes })

	if len(out) > maxResultats {
		out = out[:maxResultats]
	}
	return out
}

// selectionAmorcage est le mur d'accueil d'un utilisateur qui n'a encore rien
// garde (§07, etat A : "sinon une selection editoriale d'amorcage").
//
// Ce n'est pas une liste de best-sellers. Le persona primaire est "le
// creuseur", qui "a deja epuise les recommandations de son service de
// streaming" (§03) : lui servir le classement du moment serait la
// demonstration exacte de ce que le produit pretend depasser. La selection
// vise donc des artistes qui sont des CARREFOURS — des noms dont l'entourage
// part dans plusieurs directions, sur des genres eloignes les uns des autres.
// C'est la seule facon qu'un mur d'amorcage a de montrer ce que l'arbre sait
// faire des le premier clic.
var selectionAmorcage = []string{
	"Portishead", "Talk Talk", "Fela Kuti", "Can", "Alice Coltrane",
	"Cocteau Twins", "Slint", "Aphex Twin", "Nina Simone", "Broadcast",
	"Sun Ra", "The Fall", "Stereolab", "Burial", "Neu!",
	"Sonic Youth", "Tinariwen", "Arthur Russell", "Godspeed You! Black Emperor",
	"Massive Attack", "Autechre", "Serge Gainsbourg", "The Velvet Underground",
	"Boards of Canada", "Ennio Morricone", "This Heat", "Björk", "Caetano Veloso",
}

// Amorcage resout la selection editoriale en vraies fiches illustrees.
//
// Les resolutions partent en parallele, chacune passant par le cache : au
// deuxieme chargement du mur, l'operation ne coute plus aucun appel externe.
// Une resolution qui echoue est simplement omise — un mur de vingt-six tuiles
// plutot que vingt-huit ne se remarque pas, alors qu'une tuile vide se
// remarque tout de suite (F-05 : "aucune tuile vide ni decalage de mise en
// page").
func (s *Sources) Amorcage(ctx context.Context, b *Budget) []Artiste {
	type resultat struct {
		rang int
		art  Artiste
	}

	trouves := make([]resultat, 0, len(selectionAmorcage))
	var mu sync.Mutex
	var wg sync.WaitGroup
	jetons := make(chan struct{}, 6)

	for i, nom := range selectionAmorcage {
		wg.Add(1)
		go func(rang int, nom string) {
			defer wg.Done()
			jetons <- struct{}{}
			defer func() { <-jetons }()

			art, _, err := s.deezer.Resout(ctx, nom, b)
			if err != nil || art.ID == "" || art.Image == "" {
				return
			}
			mu.Lock()
			trouves = append(trouves, resultat{rang, art})
			mu.Unlock()
		}(i, nom)
	}
	wg.Wait()

	// L'ordre de la selection est retabli : il a ete choisi, alors que l'ordre
	// d'arrivee des reponses ne veut rien dire.
	sort.Slice(trouves, func(i, j int) bool { return trouves[i].rang < trouves[j].rang })

	out := make([]Artiste, 0, len(trouves))
	for _, t := range trouves {
		out = append(out, t.art)
	}
	return out
}
