# PRP 02 — Dictionnaire et algorithme de sélection

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/dictionnaire`
> **Dépend de :** rien (parallélisable avec PRP 01)
> **Débloque :** 03 (profil), qui a besoin de `NiveauInitial`
> **Sections du PRD :** §8 en entier (le programme), §9 (règles métier), §12 (dictionnaire, vidéos)

---

## Objectif

Le PRD §6 en fait un seul item du lot 1 : *« Dictionnaire d'exercices et
algorithme de sélection quotidienne [...] le cœur de l'application. »* Ce PRP
livre les deux, comme donnée et comme fonctions Go pures, sans écran ni route
HTTP — PRP 04 les consomme.

## Ce qui est vérifiable à la fin

- `apps/pilabelle/data/dictionnaire.json` contient **exactement 56
  exercices** (8 mise en route + 20 ventre + 20 cuisses + 8 retour au calme),
  fidèles à [`exercices.md`](../exercices.md).
- `go test ./...` couvre `ChargerDictionnaire`, `NiveauInitial`, `JourActif`,
  `SeanceDuJour`, `AjusterNiveau`, `MettreAJourSerie` — un cas par règle du
  PRD §8.2 et §9, pas seulement le chemin heureux.

## Tâche 1 — Convertir `exercices.md` en donnée

### Les familles, et leurs identifiants

| Zone | Famille | Préfixe d'`id` |
|---|---|---|
| `ventre` | Respiration et transverse | `vt-transverse-<niveau>` |
| `ventre` | Gainage ventral | `vt-gainage-<niveau>` |
| `ventre` | Rotation et obliques | `vt-obliques-<niveau>` |
| `ventre` | Gainage latéral | `vt-lateral-<niveau>` |
| `ventre` | Extension et stabilité | `vt-birddog-<niveau>` |
| `cuisses` | Pont fessier | `cu-pont-<niveau>` |
| `cuisses` | Fente et chaise | `cu-fente-<niveau>` |
| `cuisses` | Jambes et hanches | `cu-jambes-<niveau>` |
| `cuisses` | Squat doux | `cu-squat-<niveau>` |
| `cuisses` | Fessier au sol | `cu-fessier-<niveau>` |
| `mise_en_route` | (non nivelé, 8 exercices) | `mr-<slug-du-nom>` |
| `retour_au_calme` | (non nivelé, 8 exercices) | `rc-<slug-du-nom>` |

Chaque famille de `ventre`/`cuisses` porte exactement 4 exercices, niveaux 1 à
4 — comme dans `exercices.md`. `<niveau>` est le chiffre, ex. `vt-pont-3`.

### Le vocabulaire fermé des contre-indications

`exercices.md` emploie des libellés accentués (« épaule », « équilibre ») —
ce sont des étiquettes lues par du code de filtrage, donc traduites en
identifiants ASCII stables (ossature §10, « les accents vont dans ce que
l'utilisatrice lit, pas dans le code ») :

```
genou, dos, epaule, cheville, equilibre, poignet, hanche, cou
```

Une entrée qui porte une nuance entre parenthèses (« dos (réduire
l'amplitude) ») garde l'étiquette seule (`dos`) — la nuance est absorbée dans
le champ `consigne`, jamais perdue.

### Trois exemples convertis, un par forme d'exercice

```json
{
  "id": "mr-mobilisation-bassin",
  "zone": "mise_en_route",
  "famille": null,
  "niveau": null,
  "nom": "Mobilisation du bassin",
  "consigne": "Debout ou assise : cercles doux du bassin, dans un sens puis l'autre.",
  "contre_indications": ["dos"],
  "minutage": { "effort_s": 20, "repos_s": 10, "tours": 1 },
  "video": { "statut": "a_valider", "url": "https://www.youtube.com/shorts/OqR7Tl6SPLQ" }
},
{
  "id": "vt-lateral-1",
  "zone": "ventre",
  "famille": "gainage_lateral",
  "niveau": 1,
  "nom": "Gainage latéral genoux au sol",
  "consigne": "Allongée sur le côté, appui sur l'avant-bras, genoux pliés : soulever légèrement la hanche, tenue courte.",
  "contre_indications": ["epaule"],
  "minutage": null,
  "video": { "statut": "ok", "url": "https://www.youtube.com/shorts/8imTmxwFgRg" }
},
{
  "id": "cu-fente-4",
  "zone": "cuisses",
  "famille": "fente_et_chaise",
  "niveau": 4,
  "nom": "Chaise contre un mur",
  "consigne": "Dos contre un mur, genoux pliés à 90°, tenue.",
  "contre_indications": ["genou"],
  "minutage": null,
  "video": { "statut": "ok", "url": "https://www.youtube.com/shorts/gn1GW7dBoog" }
}
```

**Les deux entrées non résolues restent `a_rechercher`**, `url: ""` :
`Balancement latéral du buste` (mise en route — mauvais match découvert,
`exercices.md` § méthode de vérification) et toute vidéo qu'une relecture au
moment de l'implémentation trouverait entre-temps mauvaise. Ne jamais deviner
une URL de remplacement (PRD §12, condition 1).

Convertis les 53 exercices restants en suivant le même schéma, dans l'ordre
d'`exercices.md`. `echelle_niveaux` (ossature §4) est fixe :

```json
[
  { "niveau": 1, "effort_s": 20, "repos_s": 20, "tours": 1 },
  { "niveau": 2, "effort_s": 25, "repos_s": 15, "tours": 1 },
  { "niveau": 3, "effort_s": 30, "repos_s": 15, "tours": 2 },
  { "niveau": 4, "effort_s": 40, "repos_s": 15, "tours": 2 }
]
```

### Le test qui verrouille la conversion

```go
// apps/pilabelle/domaine_test.go
func TestDictionnaireComplet(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	compte := map[Zone]int{}
	for _, ex := range dico.Exercices {
		compte[ex.Zone]++
	}
	attendu := map[Zone]int{
		ZoneMiseEnRoute: 8, ZoneVentre: 20, ZoneCuisses: 20, ZoneRetourAuCalme: 8,
	}
	for zone, n := range attendu {
		if compte[zone] != n {
			t.Errorf("zone %s: %d exercices, attendu %d", zone, compte[zone], n)
		}
	}
}

func TestChaqueFamilleAQuatreNiveaux(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	parFamille := map[string][]int{}
	for _, ex := range dico.Exercices {
		if ex.Famille == nil {
			continue
		}
		parFamille[*ex.Famille] = append(parFamille[*ex.Famille], *ex.Niveau)
	}
	if len(parFamille) != 10 {
		t.Fatalf("%d familles, attendu 10 (5 ventre + 5 cuisses)", len(parFamille))
	}
	for famille, niveaux := range parFamille {
		sort.Ints(niveaux)
		if !slices.Equal(niveaux, []int{1, 2, 3, 4}) {
			t.Errorf("famille %s: niveaux %v, attendu [1 2 3 4]", famille, niveaux)
		}
	}
}
```

## Tâche 2 — `ChargerDictionnaire` et ses garde-fous

```go
// apps/pilabelle/domaine.go
var contreIndicationsValides = map[string]bool{
	"genou": true, "dos": true, "epaule": true, "cheville": true,
	"equilibre": true, "poignet": true, "hanche": true, "cou": true,
}

func ChargerDictionnaire(brut []byte) (Dictionnaire, error) {
	var d Dictionnaire
	if err := json.Unmarshal(brut, &d); err != nil {
		return Dictionnaire{}, fmt.Errorf("dictionnaire illisible: %w", err)
	}
	vus := map[string]bool{}
	for _, ex := range d.Exercices {
		if vus[ex.ID] {
			return Dictionnaire{}, fmt.Errorf("id duplique: %s", ex.ID)
		}
		vus[ex.ID] = true
		gradee := ex.Zone == ZoneVentre || ex.Zone == ZoneCuisses
		if gradee && (ex.Famille == nil || ex.Niveau == nil) {
			return Dictionnaire{}, fmt.Errorf("%s: zone gradee sans famille/niveau", ex.ID)
		}
		if !gradee && (ex.Famille != nil || ex.Niveau != nil) {
			return Dictionnaire{}, fmt.Errorf("%s: zone non gradee avec famille/niveau", ex.ID)
		}
		for _, ci := range ex.ContreIndications {
			if !contreIndicationsValides[ci] {
				return Dictionnaire{}, fmt.Errorf("%s: contre-indication inconnue: %s", ex.ID, ci)
			}
		}
	}
	return d, nil
}
```

Appelé une fois dans `main()` (PRP 01), avec `log.Fatal` sur erreur : un
dictionnaire invalide ne démarre pas à moitié.

## Tâche 3 — L'algorithme de sélection (PRD §8.2)

```go
// minutageDe resout le minutage effectif d'un exercice (ossature §4).
func minutageDe(dico Dictionnaire, ex Exercice) Minutage {
	if ex.Minutage != nil {
		return *ex.Minutage
	}
	for _, e := range dico.EchelleNiveaux {
		if e.Niveau == *ex.Niveau {
			return Minutage{EffortS: e.EffortS, ReposS: e.ReposS, Tours: e.Tours}
		}
	}
	return Minutage{EffortS: 20, ReposS: 15, Tours: 1} // inatteignable si ChargerDictionnaire a valide le niveau
}

func aUneContreIndication(etiquettes, douleurs []string) bool {
	for _, e := range etiquettes {
		if slices.Contains(douleurs, e) {
			return true
		}
	}
	return false
}

// niveauxViables — les niveaux d'une zone gradee qui ont encore au moins un
// candidat une fois les contre-indications de douleurs retirees. Plancher et
// plafond en sont les bornes : ainsi AjusterNiveau ne peut jamais pousser une
// zone vers un niveau que la selection du lendemain ne pourrait pas honorer.
func niveauxViables(dico Dictionnaire, zone Zone, douleurs []string) []int {
	presents := map[int]bool{}
	for _, ex := range dico.Exercices {
		if ex.Zone != zone || aUneContreIndication(ex.ContreIndications, douleurs) {
			continue
		}
		presents[*ex.Niveau] = true
	}
	var niveaux []int
	for n := range presents {
		niveaux = append(niveaux, n)
	}
	sort.Ints(niveaux)
	return niveaux
}

// choisirExercice applique les quatre etapes du PRD §8.2, dans l'ordre.
func choisirExercice(dico Dictionnaire, zone Zone, douleurs []string, niveauCourant int, idHier, sel string) (Exercice, error) {
	var candidats []Exercice
	for _, ex := range dico.Exercices { // etape 1
		if ex.Zone == zone && !aUneContreIndication(ex.ContreIndications, douleurs) {
			candidats = append(candidats, ex)
		}
	}
	if zone == ZoneVentre || zone == ZoneCuisses { // etape 2 — jamais de repli silencieux
		var graded []Exercice
		for _, ex := range candidats {
			if *ex.Niveau == niveauCourant {
				graded = append(graded, ex)
			}
		}
		if len(graded) == 0 {
			return Exercice{}, fmt.Errorf("aucun exercice %s au niveau %d compatible avec %v", zone, niveauCourant, douleurs)
		}
		candidats = graded
	}
	if len(candidats) == 0 {
		return Exercice{}, fmt.Errorf("aucun exercice disponible pour %s compatible avec %v", zone, douleurs)
	}
	if len(candidats) > 1 { // etape 3
		var sansHier []Exercice
		for _, ex := range candidats {
			if ex.ID != idHier {
				sansHier = append(sansHier, ex)
			}
		}
		if len(sansHier) > 0 {
			candidats = sansHier
		}
	}
	h := fnv.New32a() // etape 4 — deterministe pour un (jour, zone) donne : un GET /api/jour
	h.Write([]byte(sel)) // repete le meme jour rend toujours la meme seance (PRD §7.2)
	return candidats[int(h.Sum32())%len(candidats)], nil
}
```

**Aucun repli silencieux à l'étape 2.** Le PRD §12 est explicit : *« un
dictionnaire trop petit fait échouer l'algorithme en silence »* est le défaut
à ne jamais reproduire. `choisirExercice` renvoie une erreur nommée plutôt que
de servir un niveau approché ; `SeanceDuJour` la propage, et la route (PRP 04)
la transforme en `500` journalisé — jamais en séance dégradée sans le dire.

```go
type Bloc struct {
	Zone      Zone       `json:"zone"`
	Exercices []Exercice `json:"exercices"` // un seul element au lot 1
}

type Seance struct {
	Date  string `json:"date"`
	Blocs []Bloc `json:"blocs"` // dans l'ordre : mise_en_route, ventre, cuisses, retour_au_calme
}

type Cas string

const (
	CasRepos     Cas = "repos"
	CasDejaFaite Cas = "deja-faite"
	CasAFaire    Cas = "a-faire"
)

func SeanceDuJour(dico Dictionnaire, profil Profil, aujourdhui string) (Seance, Cas, error) {
	if !JourActif(profil.Reponses.JoursActifs, aujourdhui) {
		return Seance{}, CasRepos, nil
	}
	if dernierJourHistorique(profil) == aujourdhui {
		return Seance{}, CasDejaFaite, nil
	}
	idHier := map[Zone]string{}
	if h, ok := veille(profil, aujourdhui); ok {
		for _, id := range h.Exercices {
			// une seule zone par id : le prefixe suffit a la retrouver (Tache 1)
			idHier[zoneDeID(dico, id)] = id
		}
	}
	ordre := []Zone{ZoneMiseEnRoute, ZoneVentre, ZoneCuisses, ZoneRetourAuCalme}
	var blocs []Bloc
	for _, zone := range ordre {
		niveau := 0
		if zone == ZoneVentre {
			niveau = profil.Niveaux.Ventre
		} else if zone == ZoneCuisses {
			niveau = profil.Niveaux.Cuisses
		}
		ex, err := choisirExercice(dico, zone, profil.Reponses.Douleurs, niveau, idHier[zone], aujourdhui+"|"+string(zone))
		if err != nil {
			return Seance{}, "", err
		}
		blocs = append(blocs, Bloc{Zone: zone, Exercices: []Exercice{ex}})
	}
	return Seance{Date: aujourdhui, Blocs: blocs}, CasAFaire, nil
}
```

## Tâche 4 — Le niveau initial et son évolution (PRD §8.2)

```go
func NiveauInitial(reponses Reponses) Niveaux {
	depart := 1
	if reponses.NiveauDepart == "a_deja_pratique" {
		depart = 2
	}
	return Niveaux{Ventre: depart, Cuisses: depart}
}

// AjusterNiveau applique le ressenti d'une seance aux DEUX zones travaillees
// (le PRD demande un seul ressenti par seance applique separement, §8.2).
// facilesConsecutifs suit le nombre de "facile" d'affilee sur cette zone ;
// "correct" le remet a zero comme "difficile", car "plusieurs seances DE
// SUITE" (PRD §8.2) casse des qu'autre chose s'intercale.
func AjusterNiveau(dico Dictionnaire, zone Zone, douleurs []string, niveauCourant, facilesConsecutifs int, ressenti Ressenti) (nouveauNiveau, nouveauxFaciles int) {
	viables := niveauxViables(dico, zone, douleurs)
	plancher, plafond := viables[0], viables[len(viables)-1]
	switch ressenti {
	case RessentiDifficile:
		n := niveauCourant - 1
		if n < plancher {
			n = plancher
		}
		return n, 0
	case RessentiFacile:
		fc := facilesConsecutifs + 1
		if fc >= 3 {
			n := niveauCourant + 1
			if n > plafond {
				n = plafond
			}
			return n, 0
		}
		return niveauCourant, fc
	default: // RessentiCorrect
		return niveauCourant, 0
	}
}
```

## Tâche 5 — Jours actifs et série (PRD §6 item 1, §9)

```go
var joursFR = map[string]time.Weekday{
	"dimanche": time.Sunday, "lundi": time.Monday, "mardi": time.Tuesday,
	"mercredi": time.Wednesday, "jeudi": time.Thursday, "vendredi": time.Friday,
	"samedi": time.Saturday,
}

func JourActif(joursActifs []string, dateISO string) bool {
	d, err := time.Parse("2006-01-02", dateISO)
	if err != nil {
		return false
	}
	for _, j := range joursActifs {
		if joursFR[j] == d.Weekday() {
			return true
		}
	}
	return false
}

// MettreAJourSerie ne compte que les jours ACTIFS (ossature §6). Un jour actif
// entre dernierJourFait (exclu) et aujourdhui (exclu) sans seance casse la
// serie ; l'absence de jour actif entre les deux la prolonge.
func MettreAJourSerie(serie Serie, joursActifs []string, dernierJourFait, aujourdhui string) Serie {
	if dernierJourFait != "" && !jourActifManqueEntre(joursActifs, dernierJourFait, aujourdhui) {
		serie.Actuelle++
	} else {
		serie.Actuelle = 1
	}
	if serie.Actuelle > serie.Record {
		serie.Record = serie.Actuelle
	}
	return serie
}

func jourActifManqueEntre(joursActifs []string, debut, fin string) bool {
	d, _ := time.Parse("2006-01-02", debut)
	f, _ := time.Parse("2006-01-02", fin)
	for cur := d.AddDate(0, 0, 1); cur.Before(f); cur = cur.AddDate(0, 0, 1) {
		if JourActif(joursActifs, cur.Format("2006-01-02")) {
			return true
		}
	}
	return false
}
```

## Tests de règles métier — un par phrase du PRD

```go
func TestNiveauDescendImmediatement(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	n, fc := AjusterNiveau(dico, ZoneVentre, nil, 3, 0, RessentiDifficile)
	if n != 2 || fc != 0 {
		t.Fatalf("difficile: niveau %d/facile %d, attendu 2/0", n, fc)
	}
}

func TestNiveauNeMonteQuApresTroisFacilesDeSuite(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	niveau, fc := 2, 0
	for i := 0; i < 2; i++ {
		niveau, fc = AjusterNiveau(dico, ZoneVentre, nil, niveau, fc, RessentiFacile)
	}
	if niveau != 2 {
		t.Fatalf("apres deux faciles: niveau %d, attendu inchange (2)", niveau)
	}
	niveau, fc = AjusterNiveau(dico, ZoneVentre, nil, niveau, fc, RessentiFacile)
	if niveau != 3 || fc != 0 {
		t.Fatalf("apres trois faciles: niveau %d/facile %d, attendu 3/0", niveau, fc)
	}
}

func TestCorrectCasseLaSerieDeFaciles(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	_, fc := AjusterNiveau(dico, ZoneVentre, nil, 2, 0, RessentiFacile)
	_, fc = AjusterNiveau(dico, ZoneVentre, nil, 2, fc, RessentiCorrect)
	if fc != 0 {
		t.Fatalf("facilesConsecutifs = %d apres un correct, attendu 0", fc)
	}
}

func TestPlancherJamaisFranchi(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	n, _ := AjusterNiveau(dico, ZoneVentre, nil, 1, 0, RessentiDifficile)
	if n != 1 {
		t.Fatalf("niveau %d, le plancher (1) ne doit jamais etre franchi", n)
	}
}

func TestContreIndicationExclut(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	ex, err := choisirExercice(dico, ZoneCuisses, []string{"genou"}, 1, "", "2026-08-08|cuisses")
	if err != nil {
		t.Fatal(err)
	}
	if slices.Contains(ex.ContreIndications, "genou") {
		t.Fatalf("%s porte 'genou', declare comme douleur", ex.ID)
	}
}

func TestEviteExerciceDeLaVeilleSiPossible(t *testing.T) {
	dico := chargerDictionnaireDeTest(t)
	hier, err := choisirExercice(dico, ZoneVentre, nil, 1, "", "2026-08-07|ventre")
	if err != nil {
		t.Fatal(err)
	}
	aujourdhui, err := choisirExercice(dico, ZoneVentre, nil, 1, hier.ID, "2026-08-08|ventre")
	if err != nil {
		t.Fatal(err)
	}
	if aujourdhui.ID == hier.ID {
		t.Fatalf("meme exercice deux jours de suite alors qu'une alternative existe")
	}
}

func TestSerieCasseeParJourActifManque(t *testing.T) {
	serie := MettreAJourSerie(Serie{Actuelle: 4, Record: 4}, []string{"lundi", "mercredi"}, "2026-08-03", "2026-08-10") // 2026-08-03 = lundi, 2026-08-10 = lundi suivant
	if serie.Actuelle != 1 {
		t.Fatalf("serie = %d, attendu 1 (mercredi manque entre les deux)", serie.Actuelle)
	}
}

func TestSerieNonCasseeParJourDeRepos(t *testing.T) {
	serie := MettreAJourSerie(Serie{Actuelle: 4, Record: 4}, []string{"lundi"}, "2026-08-03", "2026-08-10")
	if serie.Actuelle != 5 {
		t.Fatalf("serie = %d, attendu 5 (aucun jour actif entre les deux)", serie.Actuelle)
	}
}
```

## Périmètre

**Dedans :** `data/dictionnaire.json` (56 exercices), `domaine.go`,
`domaine_test.go`, les types partagés (`Zone`, `Exercice`, `Dictionnaire`,
`Reponses`, `Niveaux`, `Profil`, `Serie`, `Ressenti`, `Seance`, `Cas`).

**Dehors :** toute route HTTP (PRP 04 les câble), tout écran, la lecture ou
l'écriture du profil sur disque (PRP 03 — ce PRP ne connaît `Profil` que
comme une struct en mémoire, jamais un fichier).

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | 56 exercices, comptes par zone corrects | `TestDictionnaireComplet` |
| 2 | Chaque famille a ses 4 niveaux | `TestChaqueFamilleAQuatreNiveaux` |
| 3 | `ChargerDictionnaire` refuse un id dupliqué, une contre-indication inconnue, une incohérence famille/niveau | tests dédiés, un par cas |
| 4 | Les huit règles du PRD §8.2/§9 ci-dessus sont chacune couvertes par un test qui échoue si on l'inverse | `go test ./... -v` |
| 5 | `./init.sh --check` vert | `./init.sh --check` |
