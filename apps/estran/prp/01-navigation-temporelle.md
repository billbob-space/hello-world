# 01 — Navigation temporelle : remonter et avancer d'un jour à l'autre

Dérivé de `PRODUCT.md`. Ce document fige la conception d'une capacité absente
de `00-ossature.md` : l'écran ne montrait que l'instant présent et ce qui vient
après, sans aucun moyen de regarder un autre jour — ni celui d'hier, ni le
détail horaire d'un jour de la tendance.

Une première tentative a eu lieu le 15 août 2026 dans une session cloud dont la
branche n'a jamais atteint le dépôt : ce travail est perdu, celui-ci repart de
zéro.

## Ce que la capacité ajoute

Un seul geste nouveau : **choisir le jour regardé**. Reculer jusqu'à sept jours
en arrière, avancer jusqu'à sept jours en avant, revenir à aujourd'hui.

Ce qui ne change pas, et qui est la contrainte principale :

- **À l'ouverture, l'écran est celui d'aujourd'hui**, identique à aujourd'hui —
  jauge de marée en position courante, cinq prochaines heures, tendance à sept
  jours. La navigation est un ajout, jamais un détour imposé avant de voir la
  marée (`PRODUCT.md`, principes 2 et 4).
- Le lieu reste unique et fixe.
- Aucun compte, aucune préférence conservée : le jour choisi ne survit pas au
  rechargement de la page. Ce n'est pas un « historique personnel » — celui-là
  reste explicitement exclu par le PRD ; c'est la même donnée publique, lue à
  une autre date.

## Ce qu'affiche un jour qui n'est pas aujourd'hui

La jauge de marée mesure une position **à l'instant présent** : sur un autre
jour, elle n'a pas de sens et ne doit pas être maquillée en valeur plausible.
La section marée montre alors **les marées du jour** — chaque pleine et basse
mer, heure, hauteur, et le coefficient là où le fournisseur le porte.

La section horaire, elle, passe des « cinq prochaines heures » aux **vingt-
quatre heures du jour**, mêmes vignettes, défilables horizontalement.

La tendance à sept jours reste affichée, avec le jour regardé mis en évidence,
et chacune de ses lignes devient un moyen d'y aller directement.

## Fenêtre couverte, et ce qui la limite

| Source | Passé | Avenir |
|---|---|---|
| Open-Meteo (horaire, journalier) | `past_days=7` | `forecast_days=8` |
| Open-Meteo Marine (vagues) | `past_days=7` | `forecast_days=8` |
| api-maree.fr (`/tide-extrema`) | `from` reculé de 7 jours | `to` avancé de 7 jours |

`past_days` a été vérifié en direct le 2026-08-16 sur les deux API Open-Meteo,
aux coordonnées du Touquet : la série horaire remonte bien de sept jours.

**`forecast_days` vaut 8, pas 7, et c'est le seul chiffre piégeux du tableau** :
Open-Meteo compte aujourd'hui dans sa fenêtre, si bien que `forecast_days=7`
s'arrête à J+6 et laisse le dernier jour navigable sans météo alors que la
marée, dont la fenêtre se déclare en dates, le couvre. La navigation aurait
mené à un jour à moitié vide — pas cassé, mais faux. Vérifié en direct le
2026-08-16 : `forecast_days=8` rend bien J0 à J+7 sur les deux API.

La hauteur d'eau instantanée (`/water-levels`) n'est demandée **que pour
aujourd'hui** : elle ne sert qu'à la jauge.

Hors fenêtre, la navigation s'arrête — le bouton du jour manquant est inactif
plutôt que menant à un écran vide.

## Routes

Les deux routes existantes prennent un paramètre optionnel. Sans lui, la
réponse est exactement celle d'aujourd'hui : aucun appelant existant ne change.

| Route | Réponse |
|---|---|
| `GET /api/previsions` | inchangé : cinq prochaines heures + tendance |
| `GET /api/previsions?date=AAAA-MM-JJ` | les vingt-quatre heures de ce jour + la même tendance |
| `GET /api/maree` | inchangé : jauge en position courante + tendance des marées |
| `GET /api/maree?date=AAAA-MM-JJ` | les extrema de ce jour, sans jauge instantanée |

Une date hors fenêtre ou illisible rend une erreur explicite, jamais une
réponse d'un autre jour : afficher les marées du mauvais jour serait pire que
ne rien afficher.

## Dégradation

Inchangée (`PRODUCT.md`, principe 3), et elle le reste sans effort parce que
**la fenêtre entière est récupérée en un seul appel par fournisseur** : sept
jours en arrière, sept en avant, puis le jour demandé est découpé dedans côté
serveur. Naviguer ne déclenche donc aucun appel sortant supplémentaire, le
dernier connu garde son sens — c'est toujours la même réponse — et le quota du
fournisseur de marée ne dépend pas du nombre de jours consultés.

Seule exception, la hauteur d'eau instantanée de la jauge : elle ne concerne
qu'aujourd'hui et garde son appel propre.

## Ce qui est écarté

- **Un sélecteur de date libre** (calendrier, champ de saisie) : la fenêtre
  utile fait quinze jours, deux flèches et un retour à aujourd'hui suffisent.
- **Un graphique d'évolution** sur plusieurs jours : la promesse du produit est
  une lecture en un coup d'œil, pas une station météo.
- **Conserver le jour choisi** entre deux visites : l'écran d'ouverture doit
  rester celui de maintenant.
- **Élargir la fenêtre au-delà de sept jours en arrière** : l'archive
  Open-Meteo le permettrait par une autre API, mais rien ne l'a demandé.
