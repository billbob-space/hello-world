# PRP 07 — Écran personnel

> Lis [`00-ossature.md`](00-ossature.md) d'abord.
> **Branche :** `pilabelle/ecran-personnel`
> **Dépend de :** 03 (profil), 05 (historique et niveaux réellement écrits)
> **Lot :** 2 — dès que le lot 1 est en ligne
> **Sections du PRD :** §6 item 11

---

> Contrairement à PRP 06, le PRD spécifie entièrement ce que cet écran
> montre : pas de verrou de contenu ici, seulement une lecture des données déjà
> écrites par le lot 1. Ce PRP reste néanmoins de profondeur « contrat » —
> objectif, interface, critères — plutôt qu'exécutable ligne à ligne : il
> gagnera à être écrit après un peu d'usage réel du lot 1, pour caler la
> présentation (quel calendrier, quelle mise en avant) sur ce qui se lit
> vraiment bien sur un téléphone tenu en main.

## Objectif

Un écran en lecture seule : série actuelle et record, calendrier des séances
faites / manquées / repos, niveau courant de chaque zone. Rien de nouveau à
calculer — tout existe déjà dans `Profil` depuis PRP 03 et 05.

## Interface

```go
type StatutJour string

const (
	StatutFait   StatutJour = "fait"
	StatutManque StatutJour = "manque"
	StatutRepos  StatutJour = "repos"
	StatutAVenir StatutJour = "avenir"
)

type JourCalendrier struct {
	Date   string     `json:"date"`
	Statut StatutJour `json:"statut"`
}

// Calendrier couvre [debut, fin], inclusif, sans trou (PRD implicite : un
// calendrier troue serait aussi trompeur qu'un ecran vide, meme esprit que
// §6 item 2 pour l'ecran du jour).
func Calendrier(profil Profil, debut, fin, aujourdhui string) []JourCalendrier
```

```
GET /api/personnel
{
  "serie": { "actuelle": 4, "record": 9 },
  "niveaux": { "ventre": 2, "cuisses": 3 },
  "calendrier": [ { "date": "2026-08-01", "statut": "fait" }, ... ]
}
```

**Un jour non actif (`JourActif` faux) est `repos`, jamais `manque`.** Un
jour actif sans entrée d'historique et déjà passé est `manque`. Un jour actif
futur est `avenir`, distinct de `manque` — le calendrier ne doit jamais
prétendre qu'un jour qui n'est pas encore arrivé a été raté.

## Fenêtre du calendrier

Le PRD ne fixe pas de longueur. Proposition : les quatre semaines écoulées
plus la semaine en cours, rendu compact sur un écran de téléphone (PRD §11,
« gros boutons, lisible à distance ») — à ajuster à l'usage plutôt qu'à
figer ici.

## Critères d'acceptation

| # | Constat |
|---|---|
| 1 | Un jour de repos déclaré n'apparaît jamais comme manqué |
| 2 | Un jour futur n'apparaît jamais comme manqué |
| 3 | La série et le record affichés sont exactement ceux du profil, sans recalcul divergent de celui de PRP 05 |
| 4 | Les deux niveaux (ventre, cuisses) s'affichent indépendamment, jamais un niveau unique moyenné |
| 5 | `./init.sh --check` vert, `./apps/pilabelle/test.sh` passe |

## Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| Longueur exacte du calendrier affiché | vous, sur retour d'usage du lot 1 |
