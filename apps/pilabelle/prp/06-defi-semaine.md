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

## Critères d'acceptation

| # | Constat |
|---|---|
| 1 | Un profil sans défi de la semaine ne montre rien de cassé sur l'écran du jour ni sur l'écran de fin |
| 2 | Rater un défi n'apparaît dans aucun journal utilisateur, dans aucun message |
| 3 | `EvaluerDefi` est une fonction pure, testée indépendamment de la route |
| 4 | Le tirage hebdomadaire ne répète pas un défi avant d'avoir épuisé le stock (comme les piques, PRP 04) |

## Ce qui bloque ce PRP

| Point | Qui tranche |
|---|---|
| La piste ci-dessus (type de défi, stock initial) | vous — à confirmer avant la première ligne de code |
| Le contenu des défis eux-mêmes | vous, en contenu, comme les piques et les mots doux |
