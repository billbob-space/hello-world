# PRP 06 — Défi de la semaine

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/defi-semaine`
> **Dépend de :** 05 (fin de séance, `Recap`, `POST /api/ressenti`)
> **Lot :** 2 — dès que le lot 1 est en ligne et utilisé
> **Sections du PRD :** §6 item 10, §9 (« optionnel, n'affecte jamais la série »), §10

---

> **Ce PRP est un contrat, pas un plan exécutable** (comme les PRP 07 à 11 de
> `marcq-handball`) : le PRD fixe ce que le défi ne doit jamais faire, mais
> pas ce qu'il annonce ni comment il se génère. Écrire du code détaillé avant
> cette décision serait du travail à jeter. Voir le verrou ci-dessous.

## Objectif

Chaque semaine, un petit objectif optionnel s'affiche à côté de la séance
calculée. Le relever ajoute une récompense en fin de séance ; le rater ne
change rien à la série ni au programme.

## Le verrou : d'où vient le défi ?

Le PRD dit ce qu'un défi **est** (« une variante ou un petit objectif
supplémentaire ») et ce qu'il **n'est pas** (une pénalité, une composante de
la série principale), mais ne dit ni son contenu ni sa règle de génération —
à la différence du dictionnaire d'exercices (PRD §8.1, entièrement spécifié)
ou des piques (PRD §10.1, avec un exemple littéral).

**Piste proposée, à valider avant de coder :** un fichier `data/defis.json`,
sur le même principe que `data/messages.json` — une liste de défis
hand-écrits par vous, tirée une fois par semaine ISO (lundi à dimanche,
cohérent avec `jours_actifs`), sans répétition avant épuisement du stock.
Chaque défi porte un type parmi un petit vocabulaire fermé, pour que
`EvaluerDefi` sache le vérifier sans configuration libre :

```json
{
  "id": "sem-toutes-les-seances",
  "titre": "Zéro séance manquée cette semaine",
  "type": "toutes_les_seances_actives"
}
```

Types envisagés — à confirmer, pas à étendre sans relire ce verrou :
`toutes_les_seances_actives` (chaque jour actif de la semaine a une entrée
dans l'historique), `ressenti_facile_x2` (deux séances « facile » dans la
semaine). Un défi non relevable avant la fin de la semaine (ex. calculé
après coup) doit rester injouable plutôt que faussement gagné.

## Interfaces attendues

```go
type DefiSemaine struct {
	ID      string `json:"id"`
	Titre   string `json:"titre"`
	Releve  bool   `json:"releve"`
	Semaine string `json:"semaine"` // "2026-W33", ISO
}

func DefiDeLaSemaine(defis []DefiCatalogue, semaineISO string) DefiSemaine
func EvaluerDefi(defi DefiSemaine, profil Profil, jour string) bool // appele apres chaque POST /api/ressenti
```

`profil.DefiSemaine` (réservé nil par PRP 03) porte cet objet ; `POST
/api/ressenti` (PRP 05) appelle `EvaluerDefi` juste avant d'écrire le profil
et ajoute `DefiReleve *bool` à `Recap` si un défi vient d'être marqué —
même endroit que `NiveauMonte`, même logique de détection au vol.

## Règles à ne jamais enfreindre (PRD §9)

- Rater le défi **ne casse rien** — ni la série, ni le niveau.
- Le relever **ajoute** une récompense (message ou animation dédiée), **ne
  retire jamais** rien en son absence.
- Il ne doit exister **aucun écran ni notification qui rappelle un défi
  manqué** : le PRD ne prévoit pour lui que des issues positives (relevé /
  silencieux), jamais une issue négative visible.

## Le verrou, tranché le 9 août 2026

`apps/pilabelle/PRODUCT.md` §12 borne la réserve de contenu humain aux piques et
aux mots doux (« le **seul** contenu de l'application qui gagne à être écrit par
vous ») : le contenu des défis n'en fait pas partie, à la différence de ce que
suggérait la première version de ce PRP. Il se déduit du PRD comme le
dictionnaire d'exercices.

**La piste proposée est confirmée telle quelle** — `data/defis.json`, tirage
hebdomadaire ISO sans répétition immédiate. Précisions :

- **Deux types, pas plus pour ce lot** : `toutes_les_seances_actives` (chaque
  jour actif de la semaine ISO a une entrée dans l'historique à cette date) et
  `ressenti_facile_x2` (au moins deux entrées `ressenti: "facile"` dans la
  semaine ISO). Les deux se vérifient entièrement depuis `profil.Historique` et
  `profil.Reponses.JoursActifs`, sans état supplémentaire.
- **Le tirage réutilise `tirerMessage`** (même mécanique que les piques,
  PRP 04) : `sel = semaineISO + "|" + email`, `dernier = profil.DefiSemaine.ID`
  de la semaine précédente si elle existe — même garantie de non-répétition que
  les piques, explicitement acceptée comme équivalente par le critère 4
  ci-dessous.
- **Le stock** : trois défis par type (six au total), titres variés — écrits
  pendant l'implémentation, dans le même esprit que le dictionnaire d'exercices
  (PRD §12) : jamais culpabilisants, cohérents avec le principe « rater ne
  coûte rien ».
- **Le tirage a lieu dans `GET /api/jour`**, comparé à `profil.DefiSemaine.Semaine`
  (l'ISO de la semaine courante) : semaine différente ou champ nil → nouveau
  tirage, persisté aussitôt. `EvaluerDefi` s'appelle dans `POST /api/ressenti`,
  après la mise à jour de la série, uniquement si `cas == CasAFaire` et
  `!profil.DefiSemaine.Releve` — la transition `false → true` seule remplit
  `Recap.DefiReleve`, même logique que `NiveauMonte`.

## Critères d'acceptation

| # | Constat |
|---|---|
| 1 | Un profil sans défi de la semaine ne montre rien de cassé sur l'écran du jour ni sur l'écran de fin |
| 2 | Rater un défi n'apparaît dans aucun journal utilisateur, dans aucun message |
| 3 | `EvaluerDefi` est une fonction pure, testée indépendamment de la route |
| 4 | Le tirage hebdomadaire ne répète pas un défi avant d'avoir épuisé le stock (comme les piques, PRP 04) |

## Ce qui bloquait ce PRP — tranché le 9 août 2026

Plus rien ne bloque : voir « Le verrou, tranché le 9 août 2026 » ci-dessus. Ce
PRP passe donc à l'implémentation.
