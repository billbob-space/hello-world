---
name: hello-world
description: Un panneau à volets en tôle noire qui affiche la version en service.
colors:
  room: "#050506"
  frame: "#0e0f11"
  bezel: "#1e2025"
  ink: "#f0ece2"
  silk: "#8f8b80"
  silk-hi: "#bab4a6"
  signal: "#f2a52a"
  engraved: "#a9a396"
  hash-ink: "#b3ada0"
  hairline: "#191a1e"
  flap-face: "#303239"
  flap-gap: "#08090b"
  flap-rear-edge: "#35373e"
  hardware-hi: "#55575e"
  hardware-lo: "#2a2c31"
typography:
  root:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  board-focal:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(1.78rem, 8.59vw, 4.91rem)"
    fontWeight: 600
    lineHeight: "1.42em"
    letterSpacing: "normal"
  board-row:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(0.6307rem, 2.9vw, 1.8rem)"
    fontWeight: 600
    lineHeight: "1.42em"
    letterSpacing: "normal"
  board-hash:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(0.95rem, 2.2vw, 1.25rem)"
    fontWeight: 600
    letterSpacing: "0.02em"
  nameplate:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    letterSpacing: "0.3em"
  silk-lead:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.24em"
  silk:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.63rem"
    fontWeight: 600
    letterSpacing: "0.19em"
  silk-fine:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.6rem"
    fontWeight: 600
    letterSpacing: "0.17em"
  probe:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
rounded:
  card: "1.5px"
  plate: "2px"
  housing: "7px"
spacing:
  cap: "0.5rem"
  hash: "0.85rem"
  row-gap: "clamp(0.85rem, 2.6vw, 1.15rem)"
  plate-gap: "clamp(1rem, 3vw, 1.4rem)"
  block-gap: "clamp(1.3rem, 4vw, 1.9rem)"
  housing-pad-x: "clamp(0.85rem, 3.2vw, 1.5rem)"
  housing-pad-top: "clamp(1.1rem, 3.6vw, 1.7rem)"
  housing-pad-bottom: "clamp(0.9rem, 3vw, 1.3rem)"
  room-pad: "clamp(0.9rem, 3.5vw, 2.5rem)"
components:
  housing:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.ink}"
    rounded: "{rounded.housing}"
    padding: "{spacing.housing-pad-top} {spacing.housing-pad-x} {spacing.housing-pad-bottom}"
    width: "max-content"
  module-focal:
    typography: "{typography.board-focal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "1.42em"
  module-row:
    typography: "{typography.board-row}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "1.42em"
  module-row-identity:
    textColor: "{colors.signal}"
  module-row-identity-unset:
    textColor: "{colors.silk}"
  nameplate:
    textColor: "{colors.engraved}"
    typography: "{typography.nameplate}"
    rounded: "{rounded.plate}"
    padding: "0.3rem 0.7rem 0.34rem"
  probe:
    backgroundColor: "#1a1c20"
    textColor: "{colors.ink}"
    typography: "{typography.probe}"
    rounded: "{rounded.plate}"
    padding: "0.44rem 0.7rem"
  axle-pin:
    background: "linear-gradient(180deg, {colors.hardware-hi}, {colors.hardware-lo})"
    size: "0.17em"
  probe-hover:
    backgroundColor: "#212328"
  probe-active:
    backgroundColor: "#202228"
---

# Design System: hello-world

## Overview

**Creative North Star: "The Departure Board"**

L'écran est un objet, pas un document : un caisson de tôle noire mate, vissé au
mur, dont les modules à volets portent la valeur actuellement en service. La
thèse tient en une phrase — un déploiement, c'est un volet qui tourne — et tout
le système en découle. On ne lit pas un état sur une pastille de couleur : on
lit une valeur, à l'échelle du panneau, dans des cellules de caractères fixes.

Le monde est engagé dans le noir, sans variante claire (`color-scheme: dark`) :
un caisson physique reste noir sous n'importe quelle lumière ambiante, donc une
inversion de thème serait une contradiction matérielle, pas une préférence.
La matière est entièrement peinte en CSS — dégradés de volet, jeu de charnière,
ombre portée, tourillons d'axe, vis de fixation — parce que le contrat interdit
toute requête sortante depuis le navigateur : zéro image, zéro script, une seule
police, embarquée en data URI.

Le panneau est montré **posé**, jamais en train de tourner. Aucune chorégraphie
au chargement, aucune donnée temps réel : l'uptime est rendu au serveur et ne
s'incrémente pas. Le seul mouvement du système est l'enfoncement de la plaque
`/healthz` sous le doigt. Anti-référence confirmée : la carte de statut à
pastille verte, et le voyant d'état sous toutes ses formes.

**Key Characteristics:**
- Caisson noir mat à biseau, vis de fixation, tourillons d'axe sur chaque module
- Volets réels : face éclairée, jeu de charnière sombre, arête arrière, ombre portée
- Lettrage en cellules de caractères fixes, une cellule = une chasse exactement
- Un seul ambre, réservé à l'identité transmise et au focus clavier
- Sombre engagé, sans variante claire ; aucun voyant d'état
- Immobile au repos : le seul mouvement est la pression sur la plaque de sonde

## Colors

Une palette de matière : six gris tirés du noir de caisson vers un blanc chaud
de lettrage, plus un seul ambre de signal qui ne sert que deux fois.

### Primary
- **Ambre de signal** (`{colors.signal}`) : l'unique couleur du système. Elle
  ne se pose que sur la ligne d'identité — et seulement quand Traefik a
  réellement transmis `X-Forwarded-User` — et sur l'anneau de `:focus-visible`.
  Sans en-tête, la valeur retombe en sérigraphie éteinte plutôt que d'ambre :
  la page ne suggère jamais une session qui n'existe pas.

### Neutral
- **Noir de salle** (`{colors.room}`) : le mur derrière le caisson, servi en
  dégradé radial (`115% 80% at 50% 26%`, de `#101114` à la valeur du token) pour
  que le fond soit une surface éclairée, pas un aplat.
- **Noir de caisson** (`{colors.frame}`) : la face du boîtier, milieu du dégradé
  vertical `#131418 → frame → #0a0b0d`.
- **Arête de biseau** (`{colors.bezel}`) : le liseré intérieur du cadre, posé en
  `inset 0 0 0 1px` — la seule bordure du caisson.
- **Blanc chaud d'encre** (`{colors.ink}`) : le lettrage du panneau et le texte
  de la plaque de sonde. Jamais un blanc pur.
- **Sérigraphie courante** (`{colors.silk}`) : étiquettes de champ et légende,
  et l'état éteint de la ligne d'identité.
- **Sérigraphie de tête** (`{colors.silk-hi}`) : l'étiquette qui ouvre le
  panneau, seule à monter d'un rang.
- **Gravure de plaque** (`{colors.engraved}`) : le nom gravé dans la tôle,
  volontairement plus sourd que l'encre du panneau.
- **Encre de hash** (`{colors.hash-ink}`) : le SHA complet sous le module focal,
  un demi-rang sous l'encre pour que le module focal reste la valeur lue.
- **Filet de pied** (`{colors.hairline}`) : l'unique règle horizontale du
  système, entre les modules et la plaque de sonde.

### Tertiary
Trois gris de matériau, réutilisés à l'identique par chaque volet du panneau :
**face de volet** (`{colors.flap-face}`) en pleine lumière au sommet, **jeu de
charnière** (`{colors.flap-gap}`) à 49,2–50,6 %, **arête arrière**
(`{colors.flap-rear-edge}`) qui accroche la lumière juste sous la fente.

### Named Rules

**The Single Amber Rule.** L'ambre a deux emplois et pas un de plus : la ligne
d'identité réellement transmise, et `:focus-visible`. Aucune autre surface ne
devient ambre — ni un lien, ni un titre, ni un survol. Sa rareté *est* le signal.

**The No Lamp Rule.** Aucune couleur de statut. Pas de vert, pas de rouge, pas
de pastille : l'état se lit dans la valeur affichée, jamais dans un voyant.
Un état absent se rend en sérigraphie éteinte, pas en couleur d'alerte.

**The Earned Amber Rule.** Le signal n'est posé que sur une donnée réellement
reçue de l'infrastructure. Une valeur de repli (`inconnu`) prend
`{colors.silk}` : la couleur ne peut pas affirmer plus que la donnée.

## Typography

**Display / Board Font:** Martian Mono 600 (repli `ui-monospace`, `SFMono-Regular`,
`DejaVu Sans Mono`, `Menlo`, `Consolas`, `monospace`) — sous-ensemble des 70
glyphes que la page peut rendre, embarqué en `data:font/woff2;base64` avec sa
notice OFL 1.1. Embarqué et non lié, parce que le contrat interdit toute requête
sortante ; toute police ajoutée doit passer par le même chemin.
**Label Font:** la pile sans-serif du système (`ui-sans-serif, system-ui, …`),
réservée à la sérigraphie : étiquettes, légende, plaque de nom.

**Character:** un mono à chasse large et à graisse pleine, lu comme du lettrage
de panneau plutôt que comme du code ; le sans-serif système, minuscule et très
espacé, joue le rôle de l'étiquette peinte au pochoir à côté du module.

### Hierarchy
- **Board-focal** (600, `{typography.board-focal}`, interligne 1.42em) : la
  version courte, sur le module de onze cellules dont le caisson tire sa largeur.
  Le seul emploi à l'échelle du panneau.
- **Board-row** (600, `{typography.board-row}`, interligne 1.42em) : les quatre
  modules de départ de trente cellules — utilisateur, hôte, démarrage, service.
- **Board-hash** (600, `{typography.board-hash}`, interlettrage 0.02em) : le SHA
  complet sous le module focal, sélectionnable d'un clic (`user-select: all`).
- **Nameplate** (700, `{typography.nameplate}`, capitales, `text-indent` égal à
  l'interlettrage pour compenser la chasse ajoutée au dernier signe).
- **Silk-lead / Silk / Silk-fine** (600, capitales, interlettrage 0.24 / 0.19 /
  0.17em) : trois rangs de sérigraphie — l'étiquette qui ouvre le panneau, les
  étiquettes de champ, la légende de pied.

### Named Rules

**The One Cell One Advance Rule.** Le lettrage de panneau ne porte **jamais**
d'interlettrage. `--cellw: 1ch` suppose que la cellule vaut exactement une
chasse ; toute chasse ajoutée décale du pas de la grille et la dérive
s'accumule sur onze cellules. L'interlettrage appartient à la sérigraphie, qui
n'est pas posée sur des volets.

**The 30/11 Rule.** Les deux corps de panneau sont tenus au rapport 30/11 aux
**trois** régimes du `clamp` (minimum, `vw`, maximum), pour que le module de
onze cellules et celui de trente calculent la même largeur à toute taille
d'écran. Le coefficient des lignes est posé au rapport exact ou légèrement
en-dessous — le moteur arrondit la chasse réelle à chaque corps, et une ligne
doit toujours être un peu plus courte que le module focal, jamais plus longue :
c'est le module focal qui tient le bord du caisson.

**The Board Face Rule.** Toute valeur portée par un volet est composée dans la
police de panneau. Le sans-serif système ne sort jamais de la sérigraphie et ne
monte à aucune échelle d'affichage.

## Layout

Le panneau est centré dans la salle (`display: grid; place-items: center`,
`min-height: 100dvh`, marge de salle `{spacing.room-pad}`). Il n'y a **aucun
point de rupture** : toute la réponse à la largeur passe par des `clamp` en
`vw`, sur les corps de texte comme sur les espacements. La densité ne change
pas d'un téléphone à un poste : c'est le même objet, plus petit.

Le modèle spatial est la matrice de cellules. Une bande vaut
`calc(var(--cells) * var(--cellw))` avec `--cellw: 1ch` ; les cartes sont
posées en `grid-template-columns: repeat(var(--cells), 1fr)` pour que
l'arrondi se **répartisse** sur toute la bande au lieu de s'accumuler cellule
après cellule. Le caisson est en `width: max-content` : sa largeur est dictée
par les modules, jamais l'inverse. Un module fait toujours un nombre entier de
volets — jamais de demi-carte coupée au bord.

Rythme vertical, de haut en bas : plaque de nom puis `{spacing.plate-gap}` ;
étiquette puis `{spacing.cap}` ; module focal puis `{spacing.hash}` avant le
SHA complet ; bloc d'affiche puis `{spacing.block-gap}` ; chaque ligne de départ
suivie de `{spacing.row-gap}` ; pied séparé par son filet.

### Named Rules

**The Matrix Sizes the Housing Rule.** La largeur intrinsèque du caisson
n'appartient qu'aux modules. Tout contenu large ajouté au panneau doit être
neutralisé dans le calcul de `max-content` — le SHA complet le fait par
`width: 0; min-width: 100%`, sinon ses quarante signes insécables étirent le
caisson bien au-delà de l'écran d'un téléphone. Même traitement obligatoire
pour toute future ligne à texte libre.

**The Zero Reset Rule.** Toute marge par défaut du navigateur qui entre dans le
`max-content` est remise à zéro (le retrait de 40px des `dd`) : elle décalerait
le module et traînerait du vide à droite de chaque ligne.

**The No Breakpoint Rule.** Pas de `@media` de mise en page. La seule requête
média du système est `prefers-reduced-motion`.

## Elevation & Depth

Le système est entièrement modelé : aucune ombre « d'interface », mais des
ombres d'objet. La profondeur vient de trois sources — le dégradé de tôle du
caisson, les liserés internes qui figurent une arête éclairée, et l'ombre
portée d'un volet sur celui de derrière. Rien ne flotte : le caisson décolle du
mur, la plaque de nom s'enfonce dans la tôle, la plaque de sonde ressort d'un
pixel.

### Shadow Vocabulary
- **Caisson** (`inset 0 0 0 1px var(--bezel), inset 0 2px 0 rgba(255,255,255,.07), inset 0 -14px 22px -14px rgba(0,0,0,.95), 0 2px 0 #000, 0 34px 66px -28px rgba(0,0,0,.95)`) : arête de cadre, chant supérieur éclairé, ombrage de pied interne, assise noire, et l'ombre longue qui pose le panneau sur le mur.
- **Plaque gravée** (`inset 0 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.045)`) : creusée dans la tôle — le nom est gravé, pas sérigraphié.
- **Plaque saillante** (`inset 0 1px 0 rgba(255,255,255,.09), 0 1px 0 #000`) : la sonde `/healthz`, seul élément qui ressort du plan.
- **Plaque enfoncée** (`inset 0 2px 5px rgba(0,0,0,.75)`) : son état `:active`, avec `transform: translateY(1px)`.
- **Ombre de volet** (`linear-gradient(180deg, rgba(0,0,0,.66), rgba(0,0,0,0))` sur 30 % de hauteur depuis 50.6 %) : l'ombre du volet avant sur le volet arrière, portée par `::after`.
- **Ombre de fente** (`0 .045em .07em -.02em rgba(0,0,0,.55)`) : sous la bande de charnière, sur le module focal uniquement.

### Named Rules

**The Settled Board Rule.** Le panneau est montré posé. Aucune chorégraphie au
chargement, aucune animation de volet qui tourne, aucune valeur qui s'anime
côté client. La seule transition du système est celle de la plaque de sonde
(`background`, `transform`, `box-shadow` en `160ms ease-out`), annulée sous
`prefers-reduced-motion: reduce`.

**The Split Crosses the Glyph Rule.** La fente de charnière passe **devant** le
lettrage (`z-index: 2`), à la même hauteur que le jeu peint dans les cartes, de
sorte qu'elle coupe chaque caractère en deux. Une lettre non coupée est imprimée
sur une grille, pas portée par un volet.

**The Shadow Costs Pixels Rule.** L'ombre de la fente est retirée dès que le
corps ne peut plus la payer : à 12px, bande plus ombre pèsent deux pixels sur
une hauteur de capitale de neuf, et la valeur se lirait **barrée** au lieu de
coupée. Sur les lignes, la fente se passe de son ombre et s'éclaircit à
`rgba(3,3,4,.82)`.

## Shapes

Rayons de tôle, pas de rayons d'interface : `{rounded.housing}` pour le
caisson, `{rounded.plate}` pour les deux plaques (nom et sonde),
`{rounded.card}` pour la matrice de cartes. Rien n'est arrondi au-delà, rien
n'est circulaire sauf les quatre têtes de vis et les tourillons d'axe
(`.17em`, `border-radius: 50%`), posés en `::before`/`::after` de part et
d'autre de chaque module.

Le vocabulaire de forme est celui d'un objet vissé : un rectangle de tôle, un
liseré de biseau d'un pixel, quatre vis en `inset: 7px` (dégradés radiaux
`#4a4c53 → #24262b → #101116`, 7×7px, un par coin), et une seule règle
horizontale — le filet de pied. Aucune bordure d'encadrement, aucune carte
détourée : les groupes se séparent par le rythme vertical.

## Components

### Module à volets (composant signature)
Le porteur de toute valeur. Une bande (`.strip`) de `--cells` cellules, haute de
`1.42em`, contenant trois couches empilées : la matrice de cartes
(`aria-hidden`, un `<i>` par cellule, dégradé vertical à sept arrêts figurant
face avant, jeu de charnière et arête arrière, plus l'ombre portée en
`::after`), la bande de charnière posée par-dessus, et enfin le champ de texte.
Deux tourillons d'axe encadrent chaque module.
- **Focal** : onze cellules, corps `{typography.board-focal}`. Un seul par page,
  c'est lui qui donne sa largeur au caisson.
- **Ligne** : trente cellules, corps `{typography.board-row}`, fente sans ombre.
- **Ligne d'identité** : `{colors.signal}` quand l'en-tête est présent,
  `{colors.silk}` sinon.

### Caisson
- **Coins :** `{rounded.housing}` · **Fond :** dégradé vertical `#131418 → {colors.frame} → #0a0b0d`
- **Bordure :** aucune ; l'arête est un liseré interne `{colors.bezel}`
- **Ombre :** voir *Caisson* dans Elevation & Depth · **Largeur :** `max-content`
- **Retrait interne :** `{spacing.housing-pad-top}` / `{spacing.housing-pad-x}` / `{spacing.housing-pad-bottom}`

### Plaque de nom
Gravée, pas sérigraphiée : fond `#0a0b0d → #131418`, ombre interne, filet clair
d'un pixel dessous, lettrage `{colors.engraved}` en `{typography.nameplate}`.
Un seul exemplaire, en tête du caisson.

### Étiquettes sérigraphiées
Les termes d'une liste de définition, posés au-dessus de leur module à
`{spacing.cap}`. Trois rangs seulement : tête (`{typography.silk-lead}`,
`{colors.silk-hi}`), champ (`{typography.silk}`, `{colors.silk}`), légende
(`{typography.silk-fine}`, `{colors.silk}`). Toujours en capitales, toujours
dans la police d'étiquette.

### Plaque de sonde (lien)
Le seul élément interactif du système.
- **Forme :** `{rounded.plate}`, retrait `0.44rem 0.7rem`, sans soulignement
- **Repos :** dégradé `#2a2c32 → #1a1c20`, chant supérieur éclairé, assise noire
- **Survol :** dégradé éclairci `#34363d → #212328`
- **Actif :** `translateY(1px)` et ombre interne — la plaque s'enfonce
- **Focus clavier :** `outline: 2px solid {colors.signal}` à `2px` de décalage

## Do's and Don'ts

### Do:
- **Do** composer toute valeur portée par un volet dans la police de panneau, sans interlettrage (*The One Cell One Advance Rule*).
- **Do** apparier tout nouveau couple de modules au rapport de cellules exact aux trois régimes du `clamp`, coefficient au plus égal (*The 30/11 Rule*).
- **Do** neutraliser la largeur intrinsèque de tout contenu à texte libre ajouté au caisson (`width: 0; min-width: 100%`).
- **Do** poser chaque couche décorative en élément **frère**, `aria-hidden`, jamais autour ni au travers du nœud de texte du gabarit : `main_test.go` verrouille la version courte comme seul contenu de sa balise, le SHA complet dans `title`, `inconnu` sans en-tête, et l'identité échappée.
- **Do** réserver l'ambre à une donnée réellement transmise par l'infrastructure et au `:focus-visible` (*The Single Amber Rule*, *The Earned Amber Rule*).
- **Do** peindre toute matière en CSS : aucune requête sortante, aucun asset séparé, aucun script.
- **Do** embarquer une police ajoutée en data URI avec sa notice de licence, sous-ensemblée aux glyphes réellement rendus.

### Don't:
- **Don't** ajouter un voyant, une pastille de statut ou une couleur d'alerte (*The No Lamp Rule*).
- **Don't** animer le panneau : pas de volet qui tourne, pas de chorégraphie au chargement, pas de valeur qui s'incrémente côté client (*The Settled Board Rule*).
- **Don't** introduire de variante claire ni de `prefers-color-scheme` : le caisson est noir sous toute lumière.
- **Don't** poser d'interlettrage sur un lettrage de panneau, ni laisser un module se terminer sur une demi-carte.
- **Don't** ajouter de `@media` de mise en page : la réponse à la largeur passe par `clamp`.
- **Don't** monter la pile sans-serif système au-delà de la sérigraphie ; elle ne porte aucune valeur et aucune échelle d'affichage.
- **Don't** garder l'ombre de la fente quand le corps ne peut pas la payer : sous ~14px elle barre le texte au lieu de le couper (*The Shadow Costs Pixels Rule*).
- **Don't** afficher une donnée que l'application ne mesure pas — le panneau ne porte que des valeurs rendues au serveur.
