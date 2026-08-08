# PRP 05 — Ressenti, fin de séance et récompenses

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/fin-et-recompenses`
> **Dépend de :** 02 (`AjusterNiveau`, `MettreAJourSerie`), 03 (stockage), 04 (`onSeanceTerminee`, `data/messages.json`)
> **Débloque :** 06 (défi de la semaine), 07 (écran personnel) — lot 1 est complet après ce PRP
> **Sections du PRD :** §6 items 5, 7, 9, §7.4, §9, §10, §10.1

---

## Objectif

La séance se referme par un ressenti obligatoire, jamais optionnel ; ce
ressenti met à jour le niveau des deux zones travaillées et la série ; et un
écran de récompense varié — jamais deux fois le même message — clôt la
boucle quotidienne.

## Ce qui est vérifiable à la fin

- Refaire la séance du jour librement (PRD §7.2) ne modifie ni l'historique,
  ni les niveaux, ni la série une seconde fois.
- Un ressenti « difficile » fait baisser le niveau **avant** que l'écran de
  récompense ne s'affiche, jamais après coup.
- Deux séances consécutives ne montrent jamais le même message
  d'encouragement.

## Tâche 1 — `POST /api/ressenti`

Le corps n'accepte qu'un champ : `{"ressenti": "facile"|"correct"|"difficile"}`.
**Les exercices faits ne sont pas envoyés par le client** — le serveur les
retrouve en rappelant `SeanceDuJour`, seule source autorisée (ossature §5,
étape 4 : l'appel est idempotent, il rend toujours la séance du jour déjà
montrée).

```go
mux.HandleFunc("POST /api/ressenti", func(w http.ResponseWriter, r *http.Request) {
	email, err := identite(r)
	if err != nil {
		http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
		return
	}
	var corps struct{ Ressenti Ressenti `json:"ressenti"` }
	if err := json.NewDecoder(r.Body).Decode(&corps); err != nil || !ressentiValide(corps.Ressenti) {
		http.Error(w, `{"erreur":"ressenti invalide"}`, http.StatusBadRequest)
		return
	}
	profil, err := LireProfil(racineProfils, email)
	if errors.Is(err, ErrProfilAbsent) {
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("lecture profil %s: %v", identifiantFichier(email), err)
		http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
		return
	}

	jour := aujourdhui()
	seance, cas, err := SeanceDuJour(dico, profil, jour)
	if err != nil {
		log.Printf("selection du jour %s pour %s: %v", jour, identifiantFichier(email), err)
		http.Error(w, `{"erreur":"dictionnaire insuffisant"}`, http.StatusInternalServerError)
		return
	}

	recap := Recap{Serie: profil.Serie}
	if cas == CasDejaFaite {
		recap.DejaCompte = true // PRD §7.2 : refaire librement ne recompte pas
	} else {
		idsFaits := idsDeLaSeance(seance)
		douleurs := profil.Reponses.Douleurs

		niveauVentre, facilesVentre := AjusterNiveau(dico, ZoneVentre, douleurs, profil.Niveaux.Ventre, profil.FacilesConsecutifs.Ventre, corps.Ressenti)
		niveauCuisses, facilesCuisses := AjusterNiveau(dico, ZoneCuisses, douleurs, profil.Niveaux.Cuisses, profil.FacilesConsecutifs.Cuisses, corps.Ressenti)
		recap.NiveauMonte.Ventre = niveauVentre > profil.Niveaux.Ventre
		recap.NiveauMonte.Cuisses = niveauCuisses > profil.Niveaux.Cuisses
		profil.Niveaux.Ventre, profil.FacilesConsecutifs.Ventre = niveauVentre, facilesVentre
		profil.Niveaux.Cuisses, profil.FacilesConsecutifs.Cuisses = niveauCuisses, facilesCuisses

		dernierJourFait := ""
		if len(profil.Historique) > 0 {
			dernierJourFait = profil.Historique[len(profil.Historique)-1].Date
		}
		profil.Serie = MettreAJourSerie(profil.Serie, profil.Reponses.JoursActifs, dernierJourFait, jour)
		recap.Serie = profil.Serie

		profil.Historique = append(profil.Historique, HistoriqueEntree{Date: jour, Ressenti: corps.Ressenti, Exercices: idsFaits})
	}

	sel := jour + "|" + email
	recap.Encouragement = tirerMessage(messages.Encouragements, profil.DerniersMessages.Encouragement, sel+"|enc")
	profil.DerniersMessages.Encouragement = recap.Encouragement
	if motDouxDeTempsEnTemps(sel) {
		recap.MotDoux = tirerMessage(messages.MotsDoux, profil.DerniersMessages.MotDoux, sel+"|doux")
		profil.DerniersMessages.MotDoux = recap.MotDoux
	}

	if err := EcrireProfil(racineProfils, email, profil); err != nil {
		log.Printf("ecriture profil %s: %v", identifiantFichier(email), err)
		http.Error(w, `{"erreur":"interne"}`, http.StatusInternalServerError)
		return
	}
	repondreJSON(w, recap)
})

type Recap struct {
	DejaCompte    bool   `json:"deja_compte,omitempty"`
	Serie         Serie  `json:"serie"`
	NiveauMonte   struct{ Ventre, Cuisses bool } `json:"niveau_monte"`
	Encouragement string `json:"encouragement"`
	MotDoux       string `json:"mot_doux,omitempty"`
}

func ressentiValide(r Ressenti) bool {
	return r == RessentiFacile || r == RessentiCorrect || r == RessentiDifficile
}

func idsDeLaSeance(s Seance) []string {
	var ids []string
	for _, b := range s.Blocs {
		for _, ex := range b.Exercices {
			ids = append(ids, ex.ID)
		}
	}
	return ids
}

// motDouxDeTempsEnTemps — environ une fois sur trois (PRD §10.1 : « pas a
// chaque fois »). La cadence exacte n'est pas prescrite par le PRD ; ce
// tirage se resserre ou se desserre depuis ce seul point si l'usage reel
// montre une frequence mal calibree.
func motDouxDeTempsEnTemps(sel string) bool {
	h := fnv.New32a()
	h.Write([]byte(sel))
	return h.Sum32()%3 == 0
}
```

**L'ordre importe : niveaux et série sont recalculés avant d'écrire, dans la
même transaction fichier.** Une panne entre les deux laisserait un niveau
ajusté sans historique correspondant, ou l'inverse — `EcrireProfil` (PRP 03)
les pose ensemble en une seule écriture atomique.

**Le passage de niveau se détecte en comparant l'ancien et le nouveau, pas en
stockant un drapeau.** `recap.NiveauMonte` n'existe que dans la réponse HTTP
de ce ressenti précis (PRD §10 : *« mis en avant explicitement, une seule
fois, le jour où il se débloque »*) ; rien de plus n'est persisté, puisque le
lendemain la comparaison ne redeviendra vraie que sur un nouveau
franchissement.

## Tâche 2 — L'écran de fin, côté navigateur

`web/vue-fin.js` remplace le bloc temporaire de PRP 04 :

```js
// apps/pilabelle/web/app.js — le remplacement annonce en PRP 04
onSeanceTerminee: () => monter(vueRessenti, {
	onChoix: async (ressenti) => {
		const recap = await api.envoyerRessenti(ressenti);
		monter(vueFin, { recap });
	},
}),
```

`vue-ressenti.js` : trois émojis (facile / correct / difficile), un tap
suffit — jamais un chiffre, jamais de confirmation (PRD §7.4).

`vue-fin.js` : la série (mise en avant si elle vient d'augmenter),
l'encouragement, le mot doux s'il est présent, et — seule fois où une
animation est déclenchée — le passage de niveau si `niveau_monte.ventre` ou
`.cuisses` est vrai. Une série qui vient d'être remise à zéro **n'affiche
aucune pénalité** : le fait, pas un jugement (PRD §9).

`prefers-reduced-motion` : l'animation de passage de niveau est purement
décorative ; son absence ne retire aucune information de l'écran (ossature
§10).

## Périmètre

**Dedans :** `POST /api/ressenti`, la mise à jour de `Niveaux`,
`FacilesConsecutifs`, `Serie`, `Historique` ; `vue-ressenti.js`, `vue-fin.js` ;
la lecture de `messages.encouragements` et `messages.mots_doux` (données déjà
livrées par PRP 04).

**Dehors :** le défi de la semaine et son marquage « relevé » (PRP 06) ;
l'écran personnel qui relit `Serie`/`Historique`/`Niveaux` en lecture seule
(PRP 07).

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | `POST /api/ressenti` deux fois le même jour : la seconde renvoie `deja_compte: true` et ne modifie rien | test route, deux appels |
| 2 | `difficile` fait baisser le niveau, visible dans la réponse suivante de `GET /api/jour` | test d'intégration |
| 3 | Trois `facile` d'affilée sur la même zone déclenchent `niveau_monte` au troisième appel, pas avant | test route |
| 4 | Deux appels consécutifs ne rendent jamais le même `encouragement` (sauf stock à un seul message — voir dette de contenu, ossature §11) | `TestEncouragementJamaisRepete` |
| 5 | `./init.sh --check` vert, `./apps/pilabelle/test.sh` passe | commandes habituelles |

## Lot 1 est complet ici

Avec ce PRP livré et testé, les neuf items du PRD §6 sont en place :
questionnaire (03), écran du jour (04), écran de séance et chronomètre (04),
ressenti (05), dictionnaire et algorithme (02), fin de séance (05),
persistance (01+03), petits mots (04+05). Reste la dette de contenu listée en
ossature §11 avant d'activer réellement l'app pour elle.
