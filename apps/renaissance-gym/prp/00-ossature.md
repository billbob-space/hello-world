# PRP 00 — Ossature de `renaissance-gym`

> **Lis-moi avant tous les autres.** Ce document n'est pas un lot : il porte ce
> que les sept PRP suivants supposent connu — l'architecture, le partage entre
> le navigateur et le serveur, les conventions de fichiers, et le **contrat de
> direction visuelle**, qui n'est pas décoratif et ne se renégocie pas lot par
> lot.
>
> **PRD :** `apps/renaissance-gym/PRODUCT.md`
> **Notice de l'app :** `apps/renaissance-gym/CLAUDE.md`

## 1. Le partage : le navigateur décide, le serveur garde

C'est l'inverse de `pilabelle` et le même choix que `marcq-handball`, et il
gouverne tout le reste.

| | Navigateur | Serveur (Go) |
|---|---|---|
| Le programme, les objectifs, la composition des séances | **oui** | non |
| L'état d'avancement | **oui**, source de vérité de l'appareil | copie fusionnée |
| Le minuteur, le son, l'écran allumé | **oui** | non |
| L'identité (pseudonyme, code) | garde le couple | **oui**, vérifie |
| La persistance longue | `localStorage` | **volume nommé** |

**Pourquoi.** L'application doit fonctionner réseau coupé, minuteur compris
(PRD §11.2). Un serveur qui composerait la séance rendrait l'entraînement
dépendant du réseau, ce qui est exactement ce que le PRD interdit. Le serveur
n'existe que pour le §2 point 4 du PRD : retrouver sa progression ailleurs.

**Conséquence à ne pas contourner** : aucune règle métier du §9 du PRD ne
s'implémente deux fois. La composition des séances et les objectifs par semaine
vivent dans le navigateur, en modules ES purs et testés ; le serveur ne les
connaît pas et n'en a pas besoin — il stocke une liste d'identifiants
d'exercices validés avec leur date, et il ne l'interprète jamais.

## 2. Arborescence

```
apps/renaissance-gym/
  main.go              serveur HTTP : statique, /healthz, /api/fiche
  fiche.go             le magasin : lecture, ecriture, fusion, empreinte du code
  fiche_test.go
  api.go               les trois operations, la temporisation par pseudonyme
  api_test.go
  main_test.go
  go.mod
  package.json         { "type": "module" } — aucune dependance
  test.sh              node --test tests/*.test.js ; go vet ./... ; go test ./...
  Dockerfile           multi-etapes, non root, volume chown avant USER
  web/
    index.html         la coque, le contrat de direction en commentaire HTML
    style.css          le systeme visuel — §5 de ce document
    archivo.woff2      Archivo Variable, sous-ensemble latin
    archivo-OFL.txt    la licence, obligatoire
    sonnerie.js        le son du minuteur, synthetise
    programme.json     LE FICHIER DE DONNEES — les 36 exercices
    programme.js       lecture et derivation : objectifs, seances
    domaine.js         les regles du §9 du PRD, pures
    etat.js            localStorage, evenements
    app.js             routeur, coque, montage des vues
    chrono.js          le minuteur
    synchro.js         le client de l'API
    vue-entree.js      les trois ecrans d'entree, et « j'ai deja un pseudo »
    vue-jour.js        l'ecran du jour
    vue-seance.js      la seance
    vue-grille.js      les huit semaines
    vue-reglages.js    prenom, pseudonyme, effacement
  tests/
    *.test.js          node --test, aucune dependance
  prp/
```

**Le front est en modules ES natifs, sans outil de construction.** Aucun
`node_modules`, aucun `npm install`, aucun empaqueteur : `package.json` ne sert
qu'à déclarer `"type": "module"` à Node pour les tests. C'est la convention de
`marcq-handball`, et elle est ce qui permet à `test.sh` de tourner sur le runner
de CI sans installation.

## 3. L'ordre des lots

```
01-programme  ─┬─→ 04-seance ─┐
02-socle      ─┤              ├─→ 05-grille
               ├─→ 03-entree ─┘
06-serveur    ─────→ 07-synchro
```

| PRP | Lot PRD | Ce qu'il livre |
|---|---|---|
| `01-programme` | 1 | `programme.json`, `programme.js`, `domaine.js` — testables sans DOM |
| `02-socle` | 1 | `index.html`, `style.css`, `app.js`, `etat.js` — la coque et le système visuel |
| `03-entree` | 1 puis 2 | les trois écrans d'entrée ; la partie compte attend le PRP 06 |
| `04-seance` | 1 | `vue-seance.js`, `chrono.js`, `sonnerie.js` |
| `05-grille` | 1 et 3 | `vue-grille.js`, les corrections, les badges |
| `06-serveur` | 2 | `main.go`, `fiche.go`, `api.go` — le serveur seul, testable sans front |
| `07-synchro` | 2 | `synchro.js`, la fusion, les états de réseau |

Les PRP 01, 02 et 06 n'ont aucune dépendance entre eux et se mènent en
parallèle. Le PRP 03 se livre en deux temps : ses deux premiers écrans
appartiennent au lot 1, son troisième — le compte — attend que l'API existe.

## 4. Le contrat de direction visuelle

Il est reproduit **mot pour mot** en commentaire HTML, premier enfant de
`<body>` dans `web/index.html`. Il n'est pas un commentaire d'auteur : c'est ce
contre quoi la revue de finition juge le rendu.

```html
<!--
THESIS: Cette app est taillée comme un justaucorps de compétition — le seul
objet de ce sport qu'elle ait choisi elle-même. Elle refuse l'arrangement que
la catégorie livre toujours : fond presque noir, accent fluo, anneaux de
progression, cartes arrondies empilées.

OWN-WORLD: Velours bleu roi (#1B2FB5) en empiècements diagonaux coupés à 12°,
passepoil or (#F0C24B) de 2 px le long de chaque couture, champ de lecture en
jersey mat (#F4F1EA), fuchsia (#E5197E) pour ce qui est en cours, rang de
strass réservé à la semaine bouclée. Archivo Variable seule, très large pour
l'affichage et normale pour le texte : un seul tissu, des panneaux coupés
différemment. Angles coupés à 4 px — un justaucorps se coud, il ne s'arrondit
pas.

STORY: Elle comprend en une seconde ce qu'il y a à faire aujourd'hui, elle le
fait sans toucher l'écran plus de dix fois, et elle voit sa grille se remplir.

FIRST VIEWPORT: Un empiècement bleu roi coupé en diagonale occupe le tiers
haut et porte la semaine ; sous la couture passepoilée d'or, sur le jersey,
« Séance 2 sur 4 » puis son nom en Archivo très large ; le bouton de départ
prend la moitié de la largeur, bas de l'écran, à portée de pouce.

FORM: Le justaucorps — candidat 5 de la liste classée par résonance, désigné
par le tirage. Clé : fa4b5a22.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
-->
```

## 5. Le système visuel

Ces jetons sont écrits **une fois** dans `web/style.css` et ne se redéfinissent
nulle part. Un PRP qui a besoin d'une valeur nouvelle l'ajoute ici et le dit.

### 5.1 Couleur

Stratégie : **engagée** — le bleu roi porte 30 à 60 % de la surface. Ce n'est
pas un accent posé sur du neutre, ce sont des régions entières.

```css
--bleu-roi:     #1B2FB5;   /* le velours : empiecements, entetes, boutons */
--bleu-nuit:    #0B1030;   /* le texte sur jersey, le fond des seances */
--fuchsia:      #E5197E;   /* ce qui est EN COURS, et rien d'autre */
--or:           #F0C24B;   /* le passepoil, le strass, ce qui est ACQUIS */
--jersey:       #F4F1EA;   /* le champ de lecture */
--jersey-ombre: #E3DED2;   /* le second ton du jersey : cases vides, bordures */
```

**Clair, et non sombre, et ce n'est pas un défaut.** La scène physique le
tranche : une enfant sur un tapis en août, le téléphone **posé à plat par
terre**, regardé de haut à un mètre. Un fond presque noir posé à plat dans la
lumière d'une pièce est un miroir. Le champ de lecture est donc le jersey ; le
bleu roi porte le décor.

Aucune information n'est portée par la seule couleur : `en cours` porte aussi
un chevron, `acquis` porte aussi une coche.

### 5.2 Typographie

**Archivo Variable**, servie par l'application (`web/archivo.woff2`), axes
`wght` et `wdth`. Une seule famille.

```css
--display: 'Archivo', system-ui, sans-serif;  /* wdth 125, wght 800 */
--texte:   'Archivo', system-ui, sans-serif;  /* wdth 100, wght 400-600 */
```

| Rôle | Taille | Axes |
|---|---|---|
| Le décompte du minuteur | `clamp(5rem, 28vw, 11rem)` | wdth 125, wght 800, chiffres tabulaires |
| Le nom de l'exercice en séance | `clamp(1.75rem, 7vw, 2.75rem)` | wdth 112, wght 700 |
| Titre d'écran | `clamp(1.5rem, 6vw, 2.25rem)` | wdth 125, wght 800 |
| Texte courant | `1.0625rem` minimum | wdth 100, wght 400 |
| Étiquette de couture | `0.8125rem`, capitales, interlettrage `0.08em` | wdth 100, wght 600 |

**Le plancher est 17 px.** Le PRD §5 exige la lecture à un mètre : rien sous
cette taille, jamais, y compris les mentions légères.

### 5.3 La grammaire du justaucorps

Trois gestes, et pas un de plus. Chacun a une règle d'emploi, sans quoi ils
deviennent de la décoration.

**L'empiècement diagonal.** Toute région majeure est séparée de la suivante par
une couture à **12° de l'horizontale**, jamais par un filet droit.

```css
--couture: 12deg;
/* clip-path: polygon(0 0, 100% 0, 100% calc(100% - 3.5vw), 0 100%); */
```

**Le passepoil.** Une ligne d'or de 2 px suit chaque couture, sur toute sa
longueur. C'est le seul filet de l'interface : il n'existe pas d'autre bordure
décorative.

**Le rang de strass.** Une rangée de petites facettes d'or, **réservée à la
semaine bouclée et aux badges**. Jamais pendant l'effort — l'écran de séance
n'en porte aucun. Sous `prefers-reduced-motion`, les facettes sont statiques et
ne balaient pas.

**Les angles sont coupés à 4 px.** Un justaucorps se coud, il ne s'arrondit pas.
Le rayon de 24 px des cartes empilées est précisément ce que le contrat refuse.

### 5.4 Espacement et cibles

```css
--pas: 0.5rem;   /* toute marge est un multiple : 0.5 1 1.5 2 3 4 6 */
```

Toute cible tactile fait **56 px minimum** (PRD §5), et le bouton principal d'un
écran fait au moins la moitié de la largeur. Plus d'espace au-dessus d'un titre
qu'en dessous.

### 5.5 Le mouvement

Un seul mouvement orchestré, celui du tissu : **le balayage de lumière sur le
rang de strass** d'une semaine qui vient d'être bouclée. Il joue une fois, à ce
moment-là, et jamais en boucle.

Le passage d'un exercice au suivant glisse **selon l'angle de la couture**, pas
horizontalement.

Sous `prefers-reduced-motion: reduce`, tout devient instantané. Aucune
information ne dépend d'une transition.

## 6. Conventions communes

**Les clés de `localStorage`** sont préfixées `gym.v1.` — le numéro de version
permet une migration future sans deviner ce qui traîne.

**Le français partout** : identifiants, fonctions, commentaires, messages. Un
code mi-anglais mi-français est le vrai coût d'un choix non tenu.

**Les modules ES sont purs par défaut.** `domaine.js` et `programme.js` ne
touchent ni au DOM, ni à `localStorage`, ni au réseau : c'est ce qui les rend
testables sous `node --test` sans navigateur ni dépendance.

**Le contrat d'écran.** Toute vue exporte
`monterX(hote, contexte) -> demonter()`. Elle écrit dans `hote`, s'abonne à ce
qu'il lui faut, et rend une fonction qui défait tout ce qu'elle a fait. Le
routeur d'`app.js` ne connaît que ce contrat.

**Aucune dépendance tierce**, ni au front ni au back au-delà de la bibliothèque
standard de Go. C'est ce qui tient l'image sous 200 Mo et ce qui rend le dépôt
lisible dans dix-huit mois.

## 7. Ce que le PRD interdit, et qui se vérifie par un test

Ces cinq points sont des tests, pas des intentions. Un PRP qui les casse est
refusé même si son écran est joli.

1. **L'union des quatre séances vaut exactement les 36 exercices** (PRD §8.4).
2. **Aucun objectif n'est écrit en dur dans une vue** : tous se dérivent de
   `programme.json` par `programme.js` (PRD §8.1).
3. **La fusion de deux fiches est une union** : aucune case cochée ne se
   décoche par synchronisation (PRD §9.8).
4. **Le minuteur ne se raccourcit pas** : il n'existe aucune fonction publique
   qui avance le décompte (PRD §7.3).
5. **Le code n'est jamais stocké en clair côté serveur** : un test lit le
   fichier de fiche produit et échoue s'il y trouve le code saisi (PRD §10.3).
