---
name: Renaissance Gym
description: Le programme de vacances de La Renaissance Gymnastique, taillé comme un justaucorps de compétition.
colors:
  bleu-roi: "#1B2FB5"
  bleu-nuit: "#0B1030"
  fuchsia: "#E5197E"
  or: "#F0C24B"
  jersey: "#F4F1EA"
  jersey-ombre: "#E3DED2"
typography:
  decompte:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(5rem, 28vw, 11rem)"
    fontWeight: 800
    fontVariation: "'wdth' 125, 'wght' 800"
    lineHeight: 1.05
  exercice:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 7vw, 2.75rem)"
    fontWeight: 700
    fontVariation: "'wdth' 112, 'wght' 700"
  titre:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 6vw, 2.25rem)"
    fontWeight: 800
    fontVariation: "'wdth' 125, 'wght' 800"
  texte:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    fontVariation: "'wdth' 100, 'wght' 400"
    lineHeight: 1.4
  etiquette:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 100, 'wght' 600"
rounded:
  angle: "4px"
  bout-de-barre: "4px"
spacing:
  demi: "4px"
  pas: "8px"
  un-et-demi: "12px"
  double: "16px"
  triple: "24px"
  quadruple: "32px"
components:
  bouton:
    backgroundColor: "{colors.bleu-roi}"
    textColor: "{colors.jersey}"
    typography: "{typography.texte}"
    padding: "0 24px"
    height: "56px"
    width: "50%"
  bouton-desactive:
    backgroundColor: "{colors.jersey-ombre}"
    textColor: "{colors.bleu-nuit}"
  bouton-discret:
    backgroundColor: "transparent"
    textColor: "{colors.bleu-roi}"
    typography: "{typography.texte}"
    padding: "0 16px"
    height: "56px"
  champ-texte:
    backgroundColor: "{colors.jersey}"
    textColor: "{colors.bleu-nuit}"
    typography: "{typography.texte}"
    rounded: "{rounded.angle}"
    padding: "0 12px"
    height: "56px"
  cible-semaine:
    backgroundColor: "{colors.jersey}"
    textColor: "{colors.bleu-nuit}"
    height: "56px"
  cible-semaine-choisi:
    backgroundColor: "{colors.bleu-roi}"
    textColor: "{colors.jersey}"
  case-seance-faite:
    backgroundColor: "{colors.or}"
    textColor: "{colors.bleu-nuit}"
    height: "56px"
  case-seance-encours:
    backgroundColor: "{colors.jersey}"
    textColor: "{colors.fuchsia}"
    height: "56px"
  case-seance-vide:
    backgroundColor: "{colors.jersey-ombre}"
    textColor: "{colors.bleu-nuit}"
    height: "56px"
  badge-carte:
    backgroundColor: "{colors.jersey-ombre}"
    textColor: "{colors.bleu-nuit}"
    padding: "12px"
---

# Design System: Renaissance Gym

## Overview

**Creative North Star : « Le justaucorps de compétition »**

Un seul tissu, des panneaux coupés différemment. L'application est cousue, pas
empilée : des empiècements de velours bleu roi coupés en diagonale, un passepoil
d'or de 2 px le long de chaque couture, et un champ de lecture en jersey mat où
tout le texte vit. Rien n'est arrondi, parce qu'un justaucorps se coud ; rien
n'est ombré, parce qu'un vêtement n'est pas un empilement de cartes.

La densité est celle d'un objet regardé à un mètre, posé par terre, les paumes
moites. Le PRD §5 gouverne : le décompte et le nom de l'exercice montent jusqu'à
11 rem, aucune cible ne descend sous 56 px, et aucun texte ne descend sous
17 px — mentions légères comprises. C'est un système à très forte amplitude
typographique et à très faible variété : une seule police variable, six
couleurs, un seul angle.

L'anti-référence est nommée dans le contrat de direction et refusée dans le
code : fond presque noir, accent fluo, anneaux de progression, cartes arrondies
empilées. Le fond est clair, l'accent est une région entière, la progression est
une couture, et il n'y a pas une seule ombre portée dans la feuille de style.

**Key Characteristics:**
- Empiècements diagonaux à 12°, passepoil d'or de 2 px, jamais un filet séparé
- Angles coupés à 4 px en `clip-path`, jamais un rayon
- Une seule police variable, pilotée par ses axes `wght` et `wdth`
- Plancher de 17 px sur tout texte, cibles de 56 px minimum
- Zéro ombre : la profondeur est tonale et géométrique
- Le fuchsia dit « en cours », l'or dit « acquis », et rien d'autre

## Colors

Six couleurs, deux d'entre elles portant des régions entières plutôt que des
accents : le bleu roi occupe 30 à 60 % de la surface d'un écran.

### Primary
- **Velours bleu roi** (`{colors.bleu-roi}`) : le tissu des empiècements, des
  en-têtes, du bouton principal, du rang de la semaine en cours dans la grille
  et de la case de semaine choisie. Il est aussi la couleur de la barre du
  navigateur (`theme-color`), pour qu'aucun bandeau neutre ne se pose au-dessus
  d'un écran qui ne l'est pas.

### Secondary
- **Or de passepoil** (`{colors.or}`) : trois emplois et trois seulement — le
  filet de 2 px qui longe chaque couture, le rang de strass, et tout ce qui est
  ACQUIS (case de séance faite, remplissage de la barre de couture, anneau de
  focus clavier).

### Tertiary
- **Fuchsia d'effort** (`{colors.fuchsia}`) : ce qui est EN COURS. Le décompte
  du minuteur, le contour et le chevron d'une séance à faire dans la semaine
  courante, le message d'erreur d'un champ.

### Neutral
- **Jersey mat** (`{colors.jersey}`) : le champ de lecture, le fond de page et
  de `<html>`, et le texte posé sur le velours.
- **Ombre du jersey** (`{colors.jersey-ombre}`) : le second ton du champ —
  cases vides, semaines futures, bordures de champ au repos, bandeau de
  confirmation, carte de badge, bouton désactivé.
- **Bleu nuit** (`{colors.bleu-nuit}`) : tout le texte posé sur le jersey, et le
  décompte au repos.

### Named Rules

**La règle du Fuchsia en cours.** Le fuchsia ne désigne jamais qu'une chose en
train de se faire, et jamais rien d'autre. Le décompte est en bleu nuit au repos
et ne devient fuchsia que pendant qu'il tourne : c'est le CHANGEMENT de couleur
qui constitue le retour de départ, pas une teinte posée avant l'effort.

**La règle de l'Or acquis.** L'or ne se pose que sur ce qui est fini, cousu ou
mis en avant hors effort : passepoil, strass, séance faite, progression
remplie, anneau de focus. Il n'annonce jamais une action à venir.

**La règle de la Double lecture.** Aucune information n'est portée par la seule
couleur. Une case faite porte l'or ET une coche ; une case en cours porte le
fuchsia ET un chevron ; le décompte porte la couleur ET le chiffre.

## Typography

**Police d'affichage :** Archivo Variable (repli `system-ui`, `sans-serif`)
**Police de texte :** Archivo Variable — la même fonte, servie par l'app
elle-même (`/archivo.woff2`), préchargée, jamais par un tiers.

**Character :** un seul tissu coupé différemment. L'affichage tire l'axe `wdth`
jusqu'à 125 et `wght` jusqu'à 800 ; le texte reste à `wdth` 100 et `wght`
400–600. Le contraste vient de la chasse et de la graisse, pas d'une seconde
famille.

### Hierarchy
- **Décompte** (`{typography.decompte}`, `wdth` 125 / `wght` 800,
  interligne 1.05, `tabular-nums`) : le minuteur et l'objectif de la semaine,
  centrés dans le champ jersey. C'est ce qu'elle lit à un mètre.
- **Nom d'exercice** (`{typography.exercice}`, `wdth` 112 / `wght` 700) :
  l'exercice en cours pendant la séance.
- **Titre d'écran** (`{typography.titre}`, `wdth` 125 / `wght` 800) : `h1`,
  `h2`, `h3`, et le pseudonyme des réglages.
- **Texte** (`{typography.texte}`, `wdth` 100 / `wght` 400, interligne 1.4) :
  tout le reste — légendes, explications, état de synchro, phrases de badge.
- **Étiquette** (`{typography.etiquette}`, `wdth` 100 / `wght` 600, capitales,
  interlettrage 0.08em) : les étiquettes de couture posées sur l'empiècement
  (« SEMAINE 3 », « SÉANCE 2 SUR 4 »).

### Named Rules

**La règle du plancher de 17 px.** Aucun texte ne descend sous 1.0625rem, y
compris les mentions légères. La table de l'ossature §5.2 proposait 0.8125rem
pour l'étiquette de couture ; le plancher, explicite et testé, l'a emporté,
parce que le PRD §5 exige la lecture à un mètre, téléphone posé par terre. Une
contradiction entre une table de jetons et le plancher se tranche toujours en
faveur du plancher.

**La règle des Capitales réservées.** Les capitales et l'interlettrage
n'appartiennent qu'à `.etiquette`. Un texte secondaire (la légende des familles
sous le nom de la séance) est une légende en casse normale, jamais un surtitre.

**La règle de la Réduction par le mot le plus long.** Un titre d'affichage se
plie à l'unité qui ne peut pas se couper en fin de ligne, pas à sa longueur
totale : le nom de la séance calcule sa taille depuis son mot le plus long
(`--plus-long-mot`, écrit par la vue) contre sa propre largeur en `cqw`, avec un
multiplicateur de 0.72 mesuré au pixel sur la police réelle.

## Layout

Une colonne pleine hauteur, jamais une grille de page. `#ecran` est une colonne
flex de `100dvh` (repli `100vh`) et ne porte qu'un seul écran à la fois ; chaque
écran est une `<section>` unique en colonne portant trois zones : l'empiècement
en haut, le champ jersey qui grandit, l'action en bas.

**Le rythme d'espacement** part d'un pas unique de 8 px (`--pas: 0.5rem`) ;
toute marge en est un multiple — 0.5, 0.75, 1, 1.5, 2, 3, 4. Le corps d'un
écran est à 24 px en haut, 16 px sur les côtés, 32 px en bas, avec un
interligne de blocs de 16 px.

**L'action colle en bas.** Dans la colonne du champ jersey, une marge haute
automatique sur les boutons ENFANTS DIRECTS pousse le geste principal à portée
de pouce. Les boutons vivant dans une confirmation ou une saisie ne bougent pas.
`.zone-surete` ajoute `max(1.5rem, env(safe-area-inset-bottom))` sur tout écran
qui porte le bouton principal, parce que la barre d'accueil d'iOS mange le bas.

**Responsive.** Un seul point de rupture, à 640px : au-delà, la section est
bornée à 28rem et centrée. En deçà, elle occupe toute la largeur.

### Named Rules

**La règle du Conteneur ancêtre.** `container-type: inline-size` vit sur
`#ecran > section`, JAMAIS sur `.empiecement`. La spécification interdit à un
élément de lire son propre `cqw` (dépendance circulaire) : il retombe alors
silencieusement sur le conteneur ancêtre suivant, ou à défaut sur le viewport.
Posé sur le panneau, l'angle de couture mesurait 12° en mobile et 31,3° à
1280px. Toute mesure relative à la largeur d'un panneau se lit sur l'ANCÊTRE
dont la largeur EST celle du panneau.

**La règle de la Longueur typée.** Toute custom property qui porte une longueur
partagée entre un élément et son pseudo-élément est enregistrée par `@property`
avec `syntax: '<length>'`. Sans ce typage, Chromium 141 résout la même
propriété non typée en deux longueurs différentes pour l'élément (82,90 px) et
pour son `::before` positionné en absolu sous mise en page flex (78,14 px) — ce
qui faisait s'éteindre le passepoil d'or après une vingtaine de pixels.

**La règle de la Mesure bornée.** Au-delà de 640px la coque reste bornée à la
mesure d'un justaucorps tenu à bout de bras (28rem) plutôt que de s'étaler :
sans elle, un champ de saisie dépasse le millier de pixels et un titre se
retrouve à 16 px du bord de la fenêtre.

## Elevation & Depth

**Aucune ombre portée dans tout le système.** La feuille de style ne contient
pas une seule déclaration `box-shadow`, et c'est un invariant, pas un oubli :
l'anti-référence explicite du monde est la carte arrondie ombrée empilée.

La profondeur est obtenue par trois moyens, tous plats :
1. **La superposition tonale** — jersey / ombre du jersey / velours bleu roi.
   Un bandeau de confirmation, une carte de badge ou une case vide sont un ton
   plus sombre que le champ, jamais un plan surélevé.
2. **La découpe** — l'empiècement est détouré en `clip-path`, et c'est la
   diagonale qui crée le relief, pas une élévation.
3. **Le sens de fibre du velours** — une trame de lignes obliques (SVG authoré,
   en `data:`, jamais un dégradé CSS) répétée en 24×24 px sur le calque bleu.

### Named Rules

**La règle Plate.** Une surface ne se soulève jamais. Si un élément doit se
distinguer du champ, il change de ton ou de découpe ; il ne prend ni ombre, ni
flou d'arrière-plan, ni bordure lumineuse.

## Shapes

**Le biseau de 4 px, jamais un rayon.** Un jeton unique `--biseau` porte un
`polygon()` à huit sommets consommant `--angle: 4px`, appliqué en `clip-path` :
boutons, cibles de semaine, cases de séance, cases de saisie de code, rangs de
la grille, bandeaux de confirmation et cartes de badge coupent tous le même
coin. « Un justaucorps se coud, il ne s'arrondit pas. »

**Trois `border-radius` subsistent, et chacun est justifié dans le code**
plutôt que d'être une dérive : les deux règles de champ texte (un `clip-path`
rognerait la bordure de 2 px qui fait le champ) et la barre de progression de
6 px de haut (à cette hauteur, 4 px est un embout, pas un coin). Toute autre
apparition d'un rayon est une régression.

**La couture à 12°.** `--couture: 12deg` est l'angle du monde. La chute est
dérivée — `calc(tan(var(--couture)) * 100cqw)` — et jamais écrite en dur : elle
a navigué à 2° pendant un temps parce qu'elle était notée `3.5vw`, qui ne donne
le bon angle qu'à une seule largeur d'écran. Le dégagement du texte sous
l'empiècement suit la même variable, pour qu'un changement d'angle reste
cohérent.

**Le losange.** La facette de strass est un carré tourné (`polygon(50% 0%,
100% 50%, 50% 100%, 0% 50%)`) de 0.75rem, et c'est aussi la forme du favicon.

**Les icônes sont des traits, jamais des glyphes.** SVG en ligne, `viewBox`
24×24, `stroke-width` 2.5, `stroke: currentColor`, dimensionné en `1em` — un
seul poids de trait et une seule taille optique, là où les caractères ✓ et ›
variaient d'un système à l'autre.

## Components

### Buttons
- **Forme :** biseau de 4 px (`--biseau`), aucune bordure.
- **Principal (`.bouton`) :** velours bleu roi sur texte jersey, `min-width: 50%`,
  `min-height: 56px`, padding horizontal de 24 px, `wght` 700, interligne 1.
- **Désactivé :** ombre du jersey sur bleu nuit, curseur `not-allowed`.
- **Discret (`.bouton--discret`) :** sans fond, texte bleu roi, `wght` 600,
  aligné au début, hauteur de cible conservée à 56 px.

**La règle du Display explicite.** `.bouton--discret` déclare son `display`
lui-même, et ce n'est pas cosmétique : sans lui, un `<button>` est centré par la
feuille de style du navigateur tandis qu'un `<a>` reste en flux en ligne et
s'aligne à gauche. La même classe produisait deux axes d'alignement selon la
balise, et rien dans la CSS ne le disait. Toute classe portée à la fois par un
`<a>` et un `<button>` déclare son `display`.

### Cards / Containers
- **Coins :** biseau de 4 px.
- **Fond :** ombre du jersey (carte de badge, bandeau de confirmation).
- **Ombre :** aucune, voir Elevation & Depth.
- **Padding interne :** 12 px.
- Un emplacement de confirmation vide déclare `display: none` sous `[hidden]` :
  la règle `display: flex` l'emporterait autrement sur le défaut du navigateur
  et laisserait traîner une barre grise vide.

### Inputs / Fields
- **Style :** fond jersey, bordure de 2 px en ombre du jersey, rayon de 4 px,
  hauteur de 56 px, `wght` 500. La règle vise TOUT champ texte de
  l'application, pas seulement ceux de l'écran d'entrée — un champ non couvert
  retombe sur le style brut du navigateur, bordure noire et fond blanc.
- **Cases de code :** six cases plutôt qu'un champ unique, pour qu'on voie
  combien de chiffres il reste ; elles échangent le rayon contre le biseau et
  portent la police d'affichage (`wdth` 110 / `wght` 700).
- **Focus :** bordure qui passe au bleu roi, plus un anneau `outline: 2px solid`
  or avec 2 px d'offset. `outline: none` sans remplacement est une régression
  d'accessibilité.
- **Erreur :** texte fuchsia en `wght` 600, avec `min-height: 1.4em` réservé
  pour que l'apparition du message ne fasse pas sauter la mise en page.

### Navigation
La navigation secondaire est un couple de vrais liens `<a>` en style discret,
centrés, sur l'écran d'accueil uniquement — le seul carrefour de l'application.
Le lien « retour » est un `inline-flex` avec `gap`, chevron SVG plus libellé ;
le soulignement est retiré de l'ancre et posé sur le seul libellé, sinon il
court aussi sous l'espace qui sépare l'icône du mot.

### L'empiècement (composant signature)
Le panneau diagonal et son passepoil d'or sont **UN SEUL élément**, jamais un
panneau plus un `<hr>`. Le fond direct du panneau est l'or ; un `::before`
positionné en absolu porte le velours bleu et sa trame de fibre, découpé par la
MÊME formule, arrêtée `--passepoil` plus tôt (mesuré perpendiculairement à la
couture, via `/ cos(--couture)`). La bande d'or qui reste visible entre les deux
EST le passepoil : elle ne peut plus exister sans la couture qu'elle borde.

La version `<hr>` peignait zéro pixel — un élément flex de 2 px sans
`flex-shrink: 0` s'écrase à zéro dans une colonne — et n'aurait de toute façon
jamais pu suivre une diagonale.

Une variante compacte (`--compact`) réduit le padding vertical pour les écrans
qui doivent porter huit rangs de cases dessous.

### Le rang de strass
Une rangée de losanges d'or de 0.75rem à opacité 0.85. Il ne se monte que sur
une semaine bouclée et sur les badges — **jamais pendant l'effort**. Un balayage
de lumière (`strass-balayage`, 900ms, une seule fois) est déclenché par la
classe `--balaie` posée à l'événement, jamais en boucle ; sous
`prefers-reduced-motion` le mouvement disparaît mais les facettes restent
visibles.

### La barre de couture
La progression de la séance, 6 px de haut, dans l'empiècement : piste en jersey
à 35 % d'opacité, remplissage or. Elle s'anime par `transform: scaleX` depuis
son bord gauche et jamais par `width` — animer une propriété de mise en page
fait recalculer la page à chaque image, et le téléphone visé n'est pas récent.

### Motion
**Une seule animation authorée de transition :** `seance-glisse`, 280ms
`ease-out`, qui fait entrer chaque exercice en `translateX(-6vw)` combiné à un
`skewY(calc(var(--couture) * -1))` — le passage glisse selon l'angle de la
couture, jamais horizontalement. Escape `prefers-reduced-motion` sur les trois
mouvements du système (glisse, balayage de strass, transition de la barre).

## Do's and Don'ts

### Do:
- **Do** dériver toute mesure d'angle de `--couture` (`tan()`, `cos()`) et la
  résoudre contre `100cqw` d'un ancêtre conteneur — jamais un `vw`, jamais une
  valeur en dur.
- **Do** enregistrer par `@property { syntax: '<length>' }` toute longueur
  partagée entre un élément et son pseudo-élément.
- **Do** couper les coins au biseau de 4 px via `var(--biseau)`.
- **Do** tenir le plancher de 17 px et la cible de 56 px, y compris quand une
  table de jetons dit autre chose.
- **Do** déclarer `display` explicitement sur toute classe portée à la fois par
  un `<a>` et un `<button>`.
- **Do** doubler toute couleur porteuse d'information par une forme ou un mot.
- **Do** donner une échappatoire `prefers-reduced-motion` à toute animation.
- **Do** servir la police depuis l'app, préchargée avec `crossorigin`.

### Don't:
- **Don't** poser `container-type` sur l'élément qui doit lire sa propre
  largeur : il ne peut pas être son propre conteneur, et il retombera
  silencieusement sur le viewport.
- **Don't** ajouter un `border-radius` : trois seulement subsistent et chacun
  porte sa raison en commentaire (deux champs texte, une barre de 6 px).
- **Don't** utiliser une `box-shadow`. Il n'y en a aucune dans le système.
- **Don't** séparer le passepoil de sa couture en deux éléments — un filet de
  2 px en flex s'écrase à zéro et ne peut pas suivre une diagonale.
- **Don't** monter un rang de strass pendant l'effort : un test vérifie que
  `vue-seance.js` ne monte jamais `.strass`.
- **Don't** poser du fuchsia sur autre chose qu'un état en cours, ni de l'or
  sur autre chose qu'un acquis.
- **Don't** employer les capitales et l'interlettrage hors de `.etiquette` : un
  texte secondaire est une légende, jamais un surtitre.
- **Don't** utiliser un glyphe de police en guise d'icône (✓, ›) — SVG en trait,
  `currentColor`, dimensionné en `1em`.
- **Don't** animer `width`, `height` ou toute propriété de mise en page ;
  passer par `transform`.

## Deux jetons ajoutés après coup

Le détecteur de design a relevé deux `font-size` littéraux hors gabarit. Les
deux étaient réels, et de natures différentes — la distinction vaut d'être
retenue.

**`--taille-code` — `clamp(1.25rem, 6vw, 1.75rem)`.** Les six cases du code
sont du **texte** : des chiffres larges dans des cases étroites, plus grands
que le texte courant et plus petits qu'un titre. C'est une marche du gabarit
à part entière ; elle est nommée ici plutôt que posée en littéral au fond de
la feuille de style.

**`--taille-icone` — `1.25rem`.** Le tracé SVG des flèches porte
`width="1em" height="1em"`, et le dimensionner par le `font-size` du parent
fonctionnait — en faisant passer une **dimension** pour une taille de texte.
Il se pose désormais en largeur et en hauteur. Ce jeton n'appartient pas au
gabarit typographique et ne doit jamais y entrer : **une icône n'est pas du
texte.**

La règle générale que ces deux cas donnent : un `font-size` littéral est soit
une marche manquante du gabarit, qu'il faut nommer, soit un détournement pour
dimensionner autre chose, qu'il faut corriger. Il n'y a pas de troisième cas.

## Point ouvert (non résolu, non canonisé)

Au-delà de 640px, le plafond de mesure de 28rem s'applique aussi à
l'empiècement : le panneau bleu flotte au milieu du champ au lieu de saigner
jusqu'aux bords de la fenêtre. Ce n'est **pas** une règle du système — c'est un
défaut connu du build, laissé en l'état parce que le corriger demanderait de
rouvrir la relation de conteneur qui garantit l'angle de couture à toutes les
largeurs. Un futur écran ne doit pas hériter de ce comportement comme d'une
intention.
