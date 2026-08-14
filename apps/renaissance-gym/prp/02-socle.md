# PRP 02 — Le socle : la coque, l'état, le système visuel

| | |
|---|---|
| **Lot** | 1 |
| **Dépend de** | rien |
| **Débloque** | 03, 04, 05 : toute vue suppose le contrat d'écran et les jetons |
| **PRD** | §5 (le principe directeur), §11.3 |
| **Ossature** | §4 (le contrat de direction), §5 (le système visuel), §6 |

## Objectif

Poser le monde visuel du justaucorps et la mécanique minimale qui porte les
vues : une coque, un routeur, un état local. Aucun écran de produit ici — c'est
le tissu, pas le vêtement.

## Ce qui est vérifiable à la fin

- `node --test tests/etat.test.js tests/coque.test.js` passe.
- Un test lit `web/index.html` et **échoue si le contrat de direction de
  l'ossature §4 n'y est pas, mot pour mot**, comme premier commentaire de
  `<body>`. Un contrat qu'un remaniement efface est un contrat que personne
  n'audite.
- Un test lit `web/style.css` et échoue s'il y trouve un `border-radius`
  supérieur à `4px` : le rayon de 24 px des cartes empilées est ce que le
  contrat refuse nommément.
- Un test lit `web/style.css` et échoue s'il y trouve une taille de police
  inférieure à `1.0625rem` (17 px) hors `clamp()` — PRD §5.
- La page se charge sans réseau après une première visite, et sans aucune
  requête vers un domaine tiers : un test lit les sources et échoue sur toute
  URL absolue hors de l'origine.

## Chantier A — `web/index.html`

La coque : le contrat de direction en premier commentaire de `<body>`, une
balise `<main id="ecran">`, et rien d'autre. Pas de contenu écrit en dur — les
vues le montent.

`<meta name="viewport" content="width=device-width, initial-scale=1,
viewport-fit=cover">` et `<meta name="theme-color" content="#1B2FB5">` :
l'empiècement bleu déborde jusque dans la barre du navigateur.

La police est préchargée (`<link rel="preload" as="font">`) et déclarée en
`font-display: swap` : un premier affichage en police système vaut mieux qu'un
écran blanc sur un réseau de vacances.

## Chantier B — `web/style.css`

Les jetons de l'ossature §5, puis les primitives — et **seulement** les
primitives. Une vue qui a besoin d'un style propre l'écrit chez elle.

```css
.empiecement      /* region a couture diagonale 12°, fond bleu roi */
.passepoil        /* le filet d'or de 2 px le long d'une couture */
.jersey           /* le champ de lecture */
.bouton           /* le bouton principal : moitie de largeur, 56 px de haut, angles 4 px */
.bouton--discret  /* l'action secondaire, sans fond */
.strass           /* le rang de facettes — semaine bouclee et badges UNIQUEMENT */
.etiquette        /* capitales, interlettrage, taille de couture */
```

**L'empiècement diagonal** se fait en `clip-path`, jamais en image ni en
pseudo-élément incliné : c'est ce qui le rend net à toute densité de pixels et
correct en mode portrait comme paysage.

**Le rang de strass** porte son balayage de lumière dans une animation nommée,
déclenchée par une classe posée à l'événement, jamais en boucle. Sous
`prefers-reduced-motion: reduce`, l'animation est annulée et les facettes
restent visibles : c'est le mouvement qui disparaît, pas l'information.

**La zone sûre.** `padding-bottom: max(1.5rem, env(safe-area-inset-bottom))` sur
tout écran portant un bouton principal : le téléphone est posé par terre et la
barre d'accueil d'iOS mange le bas.

## Chantier C — `web/etat.js`

Le seul module qui touche `localStorage`. Tout le reste passe par lui.

```js
export const CLE = 'gym.v1.etat';
export const ETAT_VIDE = {
  prenom: null,
  semaineDeDepart: 1,
  debut: null,            // ISO du premier lancement
  faits: [],              // les faits dates du PRP 01
  pseudo: null, code: null,
  dernierEnvoi: null, dernierSucces: null,
  badges: []
};

export function lireEtat()               // -> la forme ci-dessus, JAMAIS null
export function ecrireEtat(partiel)      // FUSIONNE puis ecrit -> l'etat a jour
export function ajouterFait(fait)        // ajoute si absent -> l'etat a jour
export function retirerFait(fait)        // PRD §9.4, la correction depuis la grille
export function effacerEtat()            // -> true si la cle existait
export const EVT_ETAT = 'gym:etat-maj';  // emis sur window a chaque ecriture
```

`lireEtat` ne rend jamais `null` et ne lance jamais : un `localStorage`
indisponible (navigation privée sur certains navigateurs) doit dégrader vers un
état en mémoire, pas casser l'application. Un test le prouve en remplaçant
`localStorage` par un objet qui lance.

## Chantier D — `web/app.js`

Le routeur et la coque. Il ne connaît que le contrat d'écran de l'ossature §6.

```js
export const ROUTES = ['#/jour', '#/seance', '#/grille', '#/reglages'];
export function router(hote, table)   // -> arreter()
export function contexte()            // { etat, programme, maintenant() }
```

**Le contexte porte `maintenant()` et non `Date.now()` en dur** : c'est ce qui
permet aux tests de vues de faire avancer le temps sans figer l'horloge globale.

Une route inconnue redirige vers `#/jour`. Une visite sans prénom enregistré
redirige vers l'entrée, quelle que soit la route demandée — c'est le PRP 03 qui
la monte, ce PRP-ci se contente de l'aiguillage.

**L'écran ne s'éteint pas pendant une séance** (PRD §5) : `app.js` expose
`garderEcranAllume(actif)` qui prend et relâche un `wakeLock`, et **ne lance pas
si l'interface n'existe pas** — elle manque sur plusieurs navigateurs, et son
absence ne doit rien casser. Le PRP 04 l'appelle ; il ne l'implémente pas.

## Ce qui n'est PAS dans ce PRP

Aucun écran de produit, aucune règle métier, aucun appel réseau. À la fin de ce
PRP, l'application affiche une page vide correctement habillée — et c'est le
livrable attendu.
