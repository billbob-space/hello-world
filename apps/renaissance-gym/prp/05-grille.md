# PRP 05 — La grille des huit semaines, les corrections, les badges

| | |
|---|---|
| **Lot** | 1 pour la grille, 3 pour les badges et les réglages |
| **Dépend de** | PRP 01, PRP 02, PRP 04 (les faits qu'il produit) |
| **Débloque** | rien |
| **PRD** | §7.4, §9.3 à §9.7, §6 lot 3 |

## Objectif

Rendre la feuille du club, en mieux : elle se remplit sans stylo, elle est à
jour partout, et elle se corrige quand la séance a été faite sans le téléphone.

## Ce qui est vérifiable à la fin

- `node --test tests/grille.test.js tests/badges.test.js` passe.
- Un test assert qu'une case d'une semaine **future** est inerte : aucun
  gestionnaire de clic n'y est posé (PRD §9.3).
- Un test assert qu'une case d'une semaine **passée** se coche et se décoche, et
  que la décoche retire bien les faits correspondants (PRD §9.4).
- Un test assert que la grille tient dans un écran de 360 × 640 sans défilement
  horizontal.
- Un test assert qu'un badge n'est attribué qu'une fois, même si la condition se
  réalise à nouveau.

## Chantier A — `web/vue-grille.js`

Huit rangs de quatre cases. C'est le papier, et la ressemblance est voulue : elle
a la feuille du club sous les yeux depuis juillet.

| État de la case | Rendu |
|---|---|
| Séance faite | Fond or, coche. Angles coupés à 4 px |
| Séance à faire, semaine en cours | Contour fuchsia, chevron |
| Séance à faire, semaine passée | Fond jersey ombre, vide, sans jugement |
| Semaine future | Fond jersey ombre, opacité réduite, inerte |

La semaine en cours porte un empiècement bleu sur toute sa largeur — c'est le
seul repère dont elle a besoin pour se situer.

**Aucun total, aucun pourcentage, aucune moyenne.** Le PRD §4 le dit : ces
seuils se constatent en regardant la grille, pas en l'instrumentant. Un « 62 % »
affiché est un jugement, et le §14 dit ce que les jugements coûtent ici.

Sous la grille, quand la semaine 8 est passée : « Ton programme est terminé »,
et l'action de tout recommencer — **confirmée, jamais automatique** (PRD §9.7).

## Chantier B — les corrections

Un appui sur une case corrigeable ouvre une confirmation courte, et pas un
écran : « Tu as fait la séance 2 de la semaine 3 ? » — Oui / Non.

Cocher depuis la grille enregistre les faits de **tous** les exercices de la
séance, à la date du jour où la correction est faite, avec un marqueur
`corrige: true`. Décocher les retire.

Le marqueur existe pour une raison précise : la fusion du PRD §9.8 retient la
date la plus ancienne, et une correction faite trois jours après ne doit pas
faire croire à un entraînement de ce jour-là. Il n'est affiché nulle part.

## Chantier C — les badges

Six badges, pas un de plus. Chacun se gagne une fois, se garde, et n'a aucune
contrepartie.

| Badge | Condition |
|---|---|
| **Premier jour** | La première séance est terminée |
| **Semaine bouclée** | Les quatre séances d'une même semaine |
| **La moitié** | Quatre semaines à au moins trois séances |
| **Les 36** | Tous les exercices du programme vus au moins une fois |
| **Une minute** | Une tenue menée à son objectif de 1 min sans remise à zéro |
| **Les huit semaines** | La semaine 8 atteinte avec au moins 24 séances |

```js
export const BADGES;                       // [{ id, nom, phrase, condition(prog, etat) }]
export function badgesGagnes(prog, etat)   // -> [id] — pur, sans effet de bord
export function nouveauxBadges(prog, avant, apres)  // -> [id] a annoncer
```

Un badge gagné déclenche le **rang de strass** et son balayage, une fois. C'est
le seul endroit de l'application, avec la semaine bouclée, où il apparaît.

Les phrases de badge ne comparent jamais, ne classent jamais, et ne parlent pas
du corps. « Tu as tenu une minute entière » ; jamais « déjà mieux que la semaine
dernière ».

## Chantier D — `web/vue-reglages.js`

Quatre choses, dans cet ordre :

1. **Changer son prénom.** Un champ, sans confirmation : c'est réversible.
2. **Voir son pseudonyme.** Affiché en clair, avec une phrase qui dit à quoi il
   sert. **Le code n'est pas affiché** — il est sur l'appareil, et le montrer
   n'aiderait qu'à le laisser traîner.
3. **L'état de la sauvegarde.** La phrase du PRP 07, en français, sans jargon.
4. **Effacer ma fiche.** Confirmation explicite, avec la phrase exacte de ce qui
   part : la fiche du serveur **et** ce que garde le téléphone. Irréversible, et
   dit comme tel.

Un enseignement de `marcq-handball` est acquis d'entrée : si l'effacement échoue
côté serveur **sur un refus du code**, le geste aboutit quand même côté
appareil. Un appareil dont le code n'est plus le bon ne doit pas rester
prisonnier d'une fiche qu'il ne peut plus atteindre.
