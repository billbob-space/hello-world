// apps/ramure-v2/internal/api/forme_json_test.go
// Garantit que le document JSON de GET /api/centre porte une seule
// convention d'etiquetage — camelCase minuscule — sur TOUS ses champs, pas
// seulement sur Centre et Branche : Artiste, Voisin, Illustration, Profil et
// Album traversent eux aussi la frontiere HTTP, et doivent porter la meme
// convention. La forme du JSON devient ainsi une propriete testee, et non
// une consequence du nom des champs Go.
package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/arbre"
	"github.com/billbob-space/hello-world/apps/ramure-v2/internal/source"
)

// TestReponseCentreNUtiliseQueDesClesJSONMinuscules construit un Centre
// complet (identite, profil, illustration, discographie, branches avec
// affinite et heritiers) et verifie que le document produit par ecrireJSON
// — le meme encodeur que centreHandler — n'emploie que des cles en
// camelCase minuscule, sur tous les niveaux d'imbrication.
func TestReponseCentreNUtiliseQueDesClesJSONMinuscules(t *testing.T) {
	centre := arbre.Centre{
		Artiste: source.Artiste{
			MBID:             "mbid-artiste",
			Nom:              "Portishead",
			Pays:             "GB",
			Desambiguisation: "groupe de Bristol",
		},
		Profil: source.Profil{
			Presentation: "Groupe trip hop de Bristol.",
			Genres:       []string{"trip hop"},
			Auditeurs:    123456,
		},
		Illustration: source.Illustration{
			Petite:  "https://exemple/petite.jpg",
			Moyenne: "https://exemple/moyenne.jpg",
			Grande:  "https://exemple/grande.jpg",
		},
		Discographie: []source.Album{
			{
				MBID:   "mbid-album",
				Titre:  "Dummy",
				Sortie: "1994-08-22",
				Type:   source.Studio,
				Note:   4.5,
				Votes:  42,
			},
		},
		Branches: []arbre.Branche{
			{
				Voisin: source.Voisin{
					Nom:      "Massive Attack",
					MBID:     "mbid-voisin",
					Affinite: 0.87,
				},
				Illustration: source.Illustration{
					Petite:  "https://exemple/b-petite.jpg",
					Moyenne: "https://exemple/b-moyenne.jpg",
					Grande:  "https://exemple/b-grande.jpg",
				},
				LienDeezer: "https://deezer.com/artist/1",
				Heritiers: []source.Voisin{
					{Nom: "Tricky", MBID: "mbid-heritier", Affinite: 0.7},
				},
			},
		},
		Etat: arbre.EtatOK,
	}

	rec := httptest.NewRecorder()
	ecrireJSON(rec, 200, centre)
	corps := rec.Body.String()

	var brut map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &brut); err != nil {
		t.Fatalf("decodage : %v (corps = %s)", err, corps)
	}

	// Cles de premier niveau : deja en minuscules avant ce chantier (Centre
	// porte deja des etiquettes json), elles doivent le rester.
	for _, cle := range []string{"artiste", "profil", "illustration", "discographie", "branches", "etat"} {
		if _, ok := brut[cle]; !ok {
			t.Errorf("cle de premier niveau %q absente, corps = %s", cle, corps)
		}
	}

	// Aucune cle capitalisee (nom de champ Go tel quel) ne doit survivre, a
	// quelque niveau d'imbrication que ce soit.
	for _, interdite := range []string{
		`"Nom":`, `"MBID":`, `"Affinite":`, `"Pays":`, `"Desambiguisation":`,
		`"Presentation":`, `"Genres":`, `"Auditeurs":`,
		`"Petite":`, `"Moyenne":`, `"Grande":`,
		`"Titre":`, `"Sortie":`, `"Type":`, `"Note":`, `"Votes":`,
	} {
		if strings.Contains(corps, interdite) {
			t.Errorf("cle capitalisee %s presente dans le JSON : %s", interdite, corps)
		}
	}

	// Cles camelCase minuscule attendues sur les types internes qui
	// traversent desormais la frontiere HTTP avec la meme convention que
	// Centre et Branche — deja servie et prise pour reference.
	for _, attendue := range []string{
		`"mbid":`, `"nom":`, `"pays":`, `"desambiguisation":`, // Artiste
		`"presentation":`, `"genres":`, `"auditeurs":`, // Profil
		`"petite":`, `"moyenne":`, `"grande":`, // Illustration
		`"titre":`, `"sortie":`, `"type":`, `"note":`, `"votes":`, // Album
		`"affinite":`, // Voisin
		`"voisin":`, `"lienDeezer":`, `"heritiers":`, // Branche, deja bonne
	} {
		if !strings.Contains(corps, attendue) {
			t.Errorf("cle attendue %s absente du JSON : %s", attendue, corps)
		}
	}
}
