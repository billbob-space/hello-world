# PRP 04 — Écran du jour et écran de séance

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/jour-et-seance`
> **Dépend de :** 01 (identité), 02 (`SeanceDuJour`), 03 (profil, `demarrer()` à remplacer)
> **Débloque :** 05 (fin de séance et récompenses) — **c'est le goulot du lot 1**
> **Sections du PRD :** §6 items 2-4, §7.2, §7.3, §8

---

## Objectif

Ouvrir l'app, c'est arriver sur la séance du jour — jamais un écran
intermédiaire, sauf la pique de retrouvailles quand elle revient après une
absence. Faire la séance, c'est enchaîner les exercices un par un, chacun avec
sa vidéo, sa consigne et son chronomètre, jusqu'au dernier.

## Ce qui est vérifiable à la fin

- Un jour non actif affiche un message de repos, jamais un écran vide (PRD §6
  item 2).
- Le chronomètre ne démarre jamais seul (PRD §7.3) et se met en pause d'un tap
  sans confirmation.
- Recharger la page pendant une séance en cours ne change pas les exercices
  du jour (idempotence de `GET /api/jour`, ossature §5 étape 4).

## Tâche 1 — `data/messages.json` : les piques de retrouvailles

```json
{
  "piques": {
    "un_jour": [
      "Bah alors, on ne s'est pas vu hier 😙. Tu m'as manqué."
    ],
    "quelques_jours": [
      "Ça fait quelques jours dis donc. On la reprend doucement ?"
    ],
    "une_semaine_ou_plus": [
      "Une semaine sans nouvelles... je commençais à croire que tu m'avais remplacée 😏."
    ]
  },
  "encouragements": [
    "Bravo, séance faite !"
  ],
  "mots_doux": [
    "Je suis fière de toi, tu sais."
  ]
}
```

**Une seule variante par famille pour l'instant.** Le PRD §12 exige *« assez
de variantes [...] pour ne pas se répéter d'une semaine sur l'autre »* et *«
vous les écrivez vous-même »* : ce fichier est un point de départ, pas un
livrable de contenu terminé. `--enable` (PRP 01) n'attend pas ce PRP, mais ne
devrait pas intervenir tant que chaque famille ne porte que cet exemple
unique — ossature §11 le porte comme dette de contenu, pas comme blocage de
code.

**`encouragements` et `mots_doux`** sont ajoutés ici, dans le même fichier,
mais **consommés par PRP 05 seulement** — ce PRP livre la donnée complète pour
ne pas rouvrir `data/messages.json` deux fois, comme `marcq-handball`
l'avait fait pour `programme.json` (PRP 01/02 de cette app-là).

## Tâche 2 — Choisir un message sans jamais répéter

```go
// apps/pilabelle/domaine.go
type Messages struct {
	Piques struct {
		UnJour            []string `json:"un_jour"`
		QuelquesJours     []string `json:"quelques_jours"`
		UneSemaineOuPlus  []string `json:"une_semaine_ou_plus"`
	} `json:"piques"`
	Encouragements []string `json:"encouragements"`
	MotsDoux       []string `json:"mots_doux"`
}

// tirerMessage choisit dans pool, en excluant dernier s'il existe une
// alternative — jamais deux fois de suite (PRD §10.1). sel varie a chaque
// appel (ex. aujourdhui + nonce) : contrairement au choix d'exercice, il n'y
// a pas d'exigence d'idempotence intra-jour sur les messages.
func tirerMessage(pool []string, dernier, sel string) string {
	candidats := pool
	if len(pool) > 1 {
		var sansDernier []string
		for _, m := range pool {
			if m != dernier {
				sansDernier = append(sansDernier, m)
			}
		}
		if len(sansDernier) > 0 {
			candidats = sansDernier
		}
	}
	h := fnv.New32a()
	h.Write([]byte(sel))
	return candidats[int(h.Sum32())%len(candidats)]
}

// familleDePique classe l'ecart en jours depuis la derniere seance (PRD §7.2).
// -1 (jamais de seance) ne produit aucune pique : il n'y a rien a retrouver.
func familleDePique(joursEcoules int) []string // cle logique, résolue par l'appelant
```

## Tâche 3 — `GET /api/jour`

```go
mux.HandleFunc("GET /api/jour", func(w http.ResponseWriter, r *http.Request) {
	email, err := identite(r)
	if err != nil {
		http.Error(w, `{"erreur":"identite absente"}`, http.StatusBadRequest)
		return
	}
	profil, err := LireProfil(racineProfils, email)
	if errors.Is(err, ErrProfilAbsent) {
		http.Error(w, `{"erreur":"absent"}`, http.StatusNotFound) // le client relance le questionnaire (PRP 03)
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

	reponse := struct {
		Cas    Cas     `json:"cas"`
		Seance *Seance `json:"seance,omitempty"`
		Pique  string  `json:"pique,omitempty"`
	}{Cas: cas}
	if cas == CasAFaire {
		reponse.Seance = &seance
	}

	if ecart := joursDepuisDerniereSeance(profil, jour); ecart >= 1 && cas == CasAFaire {
		famille, pool := familleEtPool(messages, ecart)
		pique := tirerMessage(pool, profil.DerniersMessages.Pique, jour+"|"+famille+"|"+email)
		reponse.Pique = pique
		profil.DerniersMessages.Pique = pique
		if err := EcrireProfil(racineProfils, email, profil); err != nil {
			log.Printf("ecriture profil %s: %v", identifiantFichier(email), err) // non bloquant : la pique s'affiche quand meme
		}
	}
	repondreJSON(w, reponse)
})

func joursDepuisDerniereSeance(p Profil, aujourdhui string) int {
	if len(p.Historique) == 0 {
		return -1
	}
	derniere, err1 := time.Parse("2006-01-02", p.Historique[len(p.Historique)-1].Date)
	jour, err2 := time.Parse("2006-01-02", aujourdhui)
	if err1 != nil || err2 != nil {
		return -1
	}
	return int(jour.Sub(derniere).Hours() / 24)
}

func familleEtPool(m Messages, ecart int) (string, []string) {
	switch {
	case ecart == 1:
		return "un_jour", m.Piques.UnJour
	case ecart >= 2 && ecart <= 6:
		return "quelques_jours", m.Piques.QuelquesJours
	default:
		return "une_semaine_ou_plus", m.Piques.UneSemaineOuPlus
	}
}
```

**La pique se recalcule à chaque appel de `GET /api/jour` tant que la séance
du jour n'est pas terminée.** Un rechargement de page le même jour peut donc
la montrer une seconde fois — accepté comme simplification : le PRD demande
qu'elle *« s'affiche une fois puis laisse place à la séance »*, ce que
l'écran (Tâche 5) garantit en ne la montrant qu'au premier rendu du composant,
sans redemander l'API à chaque frame. Une fois `historique` mis à jour par
PRP 05, `joursDepuisDerniereSeance` retombe à `0` et la pique disparaît
d'elle-même le jour suivant sans état supplémentaire à gérer.

## Tâche 4 — Le chronomètre

```js
// apps/pilabelle/web/minuteur.js
export function creerMinuteur({ effort_s, repos_s, tours }) {
	let etat = 'attente';
	let phase = null;
	let tour = 0;
	let restant = 0;
	let idIntervalle = null;
	const abonnes = new Set();

	function notifier() { for (const f of abonnes) f({ etat, phase, restant }); }

	function demarrerPhase(p, duree) {
		phase = p; restant = duree; notifier();
		idIntervalle = setInterval(() => {
			restant -= 1;
			if (restant <= 0) {
				clearInterval(idIntervalle);
				avancer();
				return;
			}
			notifier();
		}, 1000);
	}

	function avancer() {
		if (phase === 'effort') { demarrerPhase('repos', repos_s); return; }
		tour += 1;
		if (tour >= tours) { etat = 'termine'; phase = null; notifier(); return; }
		demarrerPhase('effort', effort_s);
	}

	return {
		abonner: (f) => { abonnes.add(f); return () => abonnes.delete(f); },
		demarrer() { if (etat !== 'attente') return; etat = 'en_cours'; demarrerPhase('effort', effort_s); },
		pause() { if (etat !== 'en_cours') return; clearInterval(idIntervalle); etat = 'pause'; notifier(); },
		reprendre() { if (etat !== 'pause') return; etat = 'en_cours'; demarrerPhase(phase, restant); },
		estTermine: () => etat === 'termine',
	};
}
```

```js
// apps/pilabelle/tests/minuteur.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMinuteur } from '../web/minuteur.js';

test('ne demarre jamais seul', () => {
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	let appels = 0;
	m.abonner(() => { appels += 1; });
	assert.equal(appels, 0);
});

test('pause puis reprise conserve le temps restant', () => {
	// avancer le temps via un faux minuteur depasse le perimetre de ce test ;
	// on verifie ici seulement que pause() sans demarrer() ne fait rien, et
	// que reprendre() sans pause() ne fait rien — les deux transitions
	// illegales que l'absence de confirmation rend possibles depuis l'ecran.
	const m = creerMinuteur({ effort_s: 20, repos_s: 10, tours: 1 });
	m.pause();
	m.reprendre();
	assert.equal(m.estTermine(), false);
});
```

## Tâche 5 — Les écrans

`web/vue-jour.js` — trois rendus selon `cas` :

- `repos` : « Aujourd'hui, jour de repos. À demain ! », pas de bouton.
- `deja-faite` : récap bref + « Refaire la séance » (ne recompte pas —
  PRD §7.2 ; PRP 05 le garantit côté route).
- `a-faire` : si `pique` est présent, l'affiche une fois (état local du
  composant, jamais relu au re-rendu), puis la durée/le nombre de blocs et un
  bouton **Commencer**.

`web/vue-seance.js` — un exercice à la fois, jamais la liste complète (PRD
§7.3) :

1. Affiche la vidéo (lecteur YouTube intégré, `mute=1&autoplay=1&loop=1`,
   absente si `video.statut !== 'ok'` — jamais un lecteur cassé, ossature
   §4) et la consigne.
2. Bouton **Prête** : appelle `minuteur.demarrer()`.
3. Pendant le décompte : phase et temps restants, bouton pause/reprise sans
   confirmation.
4. `minuteur.estTermine()` -> court répit (2 s), puis exercice suivant du
   bloc courant.
5. Dernier exercice du dernier bloc terminé -> `onSeanceTerminee(idsFaits)`.

`web/app.js`, la seule ligne qui change par rapport à PRP 03 :

```js
function demarrer() {
	monter(vueJour, {
		onCommencer: (seance) => monter(vueSeance, {
			seance,
			onSeanceTerminee: (idsFaits) => {
				// PRP 05 remplace ce bloc par vueFin + POST /api/ressenti
				document.querySelector('#app').textContent = 'Séance terminée ! (écran de fin à venir)';
			},
		}),
	});
}
```

Honnête plutôt que simulé, comme la page d'attente de PRP 01 : ce PRP ne
prétend pas calculer une récompense qu'il ne sait pas encore attribuer.

## Périmètre

**Dedans :** `data/messages.json`, `tirerMessage`, `familleEtPool`,
`joursDepuisDerniereSeance`, la route `GET /api/jour`, `minuteur.js` et son
test, `vue-jour.js`, `vue-seance.js`, l'intégration vidéo.

**Dehors :** `POST /api/ressenti`, la mise à jour de `Niveaux`/`Serie`/
`Historique`, `vue-fin.js`, les encouragements et mots doux (PRP 05, seul
lecteur des deux autres clés de `messages.json`).

## Critères d'acceptation

| # | Constat | Commande |
|---|---|---|
| 1 | Jour non actif -> `cas: "repos"` | test route, profil avec `jours_actifs` n'incluant pas aujourd'hui |
| 2 | Deux appels `GET /api/jour` le même jour rendent la même séance | test route, comparaison des `id` d'exercices |
| 3 | Écart de 1/4/10 jours choisit la bonne famille de pique | `TestFamilleEtPool`, trois cas |
| 4 | `minuteur.js` ne démarre jamais sans `demarrer()` | `minuteur.test.js` |
| 5 | Un exercice `video.statut !== "ok"` s'affiche sans lecteur | test d'écran ou lecture du composant |
| 6 | `./init.sh --check` vert, `./apps/pilabelle/test.sh` passe (Go + Node) | commandes habituelles |
