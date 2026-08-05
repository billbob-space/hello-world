# PRP 06 — Le fun, et où il doit être

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `apps/marcq-handball/PRODUCT.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/recompenses` |
| **Dépend de** | PRP 02 (`totauxAccomplis`), PRP 03 (`app.js`, `etat.js`, `dateEnToutesLettres`, les jetons CSS), **PRP 04** (`marcq:seance-complete`, `.barre`, `.exercice.fait`, `.libelle-exercice`) |
| **Débloque** | PRP 10 (le ressenti se pose dans ce panneau, pas à côté) |
| **Sections du PRD** | §10 en entier, §11 (mobile, contraste, aucune installation), §6 lot 1 item 7 |

L'ossature §10 place ce PRP après le PRP 05. C'est un **ordre de livraison, pas
un couplage** : rien ici ne lit ni ne modifie `vue-perso.js`, et les deux
branches ne se croisent que dans `web/style.css`. Le PRP 06 s'exécute dès que le
PRP 04 est fusionné.

**Aucun compteur de l'écran perso ne roule, et c'est une décision.** Les
attributs `data-compteur` et `data-unite` que le PRP 05 pose sur son pourcentage
et ses pastilles ne sont lus par personne ici : le roulement du PRD §10
appartient au panneau de fin de séance, où l'enfant voit le nombre **augmenter**
après son geste. Arriver sur `#/perso` n'est pas grimper — on anime un changement
qu'on a vu arriver, jamais un changement qu'on découvre (même règle qu'au PRP 09,
chantier 4). Les deux attributs du PRP 05 restent des accroches de test, pas un
contrat avec ce document.

## Objectif

Cocher la dernière case d'une séance devient un moment — confettis, compteur de
séances en grand, volume cumulé qui roule sous les yeux — sans qu'une seule
animation retarde un tap, ni ne bouge sur un écran que personne n'a touché, ni
ne s'impose à qui a demandé moins de mouvement.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/recompenses.test.js` affiche
  `# pass 21` et `# fail 0`.
- `./apps/marcq-handball/test.sh` est vert, et `./init.sh --check` aussi.
- Dans un navigateur, cocher la dernière case de la séance du 3 août ouvre le
  panneau : « Séance bouclée. », « **1** séance sur 7 », quatre compteurs de
  volume qui roulent depuis leur valeur d'avant, des confettis. Un tap sur
  « Continuer », un tap hors du panneau, ou la touche `Échap` le ferme.
- Outils de développement → Rendering → `prefers-reduced-motion: reduce`, puis
  le même parcours : **aucun mouvement, aucun confetti**, les compteurs
  affichent directement leur valeur, le panneau se ferme des trois mêmes façons.
- Ouvrir `#/seance/2026-08-03` **déjà entièrement cochée** : rien ne bouge à
  l'ouverture — pas de trait qui se dessine, pas de barre qui monte, pas de
  confettis — et rien ne bouge non plus si on laisse l'écran ouvert une minute.
- Après fermeture du panneau, `document.querySelectorAll('.confettis').length`
  vaut `0` dans la console.

## Périmètre

**Dedans :** `web/recompenses.js` en entier ; le ressort de la coche et le style
du panneau dans `web/style.css` ; le bloc `prefers-reduced-motion` ; une ligne
d'import et une ligne d'appel dans `web/app.js` ; `/recompenses.js` dans la
coque de `web/sw.js` ; `tests/recompenses.test.js` ; une section du `README.md`.

**Dehors, et pourquoi :**
- **L'animation de changement de position au classement (PRD §10)** — elle
  appartient au **PRP 09**, seul écran qui affiche un rang. Rien ici ne connaît
  de rang, et le lot 1 n'a pas de réseau.
- **Le contenu de l'écran perso — PRP 05.** La phrase de volume du PRD §7.5
  (« 112 pompes, 165 squats, 45 burpees, 2 h 10 de course ») est la sienne. Le
  panneau de fin affiche des **nombres**, pas cette phrase : un nombre roule,
  « 2 h 10 » ne roule pas.
- **Le ressenti de fin de séance — PRP 10**, lot 2. Il se branche sur le même
  `marcq:seance-complete` ; le point d'attention en fin de document dit comment
  les deux cohabitent.
- **La ligne qui se barre et la barre qui avance — déjà posées par le PRP 04.**
  Ce PRP ne fait qu'y ajouter la durée et la courbe : il ne récrit pas une ligne
  de `vue-seance.js`.
- **Un son, une vibration.** Le PRD §10 n'en demande pas, et `navigator.vibrate`
  déclenche l'écran de l'ado en pleine séance chez les autres. Hors sujet.

## Ce qui se coupe, et dans quel ordre

Ce PRP est le premier à sauter si l'échéance mord — le programme a commencé le
3 août (PRD §14). Il est donc écrit pour être **coupé par la fin** : arrêter
après n'importe quelle tâche laisse un dépôt cohérent, testé, déployable.

| Tâche | Se coupe ? | Ce qu'on perd |
|---|---|---|
| 1 — `prefers-reduced-motion` | **jamais** | C'est le seul des trois interdits du §10 qui protège un utilisateur et non un confort. Il est écrit **avant** la première animation, et il couvre aussi celles des PRP suivants. |
| 2 — le ressort de la coche | en pratique, non | 14 lignes de CSS, zéro JavaScript, aucun risque — et c'est la récompense la plus fréquente de l'app : 53 fois contre 7. |
| 3 — le roulement d'un compteur | oui, avec 4-5-6 | Sans lui les compteurs sauteraient ; comme le panneau n'existerait pas non plus, il n'y aurait rien à faire rouler. |
| 4 — ce que le panneau annonce | oui, avec 5-6 | — |
| 5 — le panneau de fin | oui, avec 6 | L'écran de séance affiche déjà « Séance complète · 8 / 8 » (PRP 04). L'app reste complète, simplement sobre. |
| 6 — les confettis | **oui, en premier** | Le panneau reste, sans confettis. Deux lignes retirées, aucun test cassé sauf les deux siens. |

## Interfaces

**Consomme :**

```js
// web/vue-seance.js — PRP 04
export const EVT_SEANCE_COMPLETE = 'marcq:seance-complete';
// CustomEvent { bubbles: true, detail: { date, total } }, emis a la TRANSITION
// seulement : rouvrir une seance deja finie ne le rejoue pas.
export const EVT_COCHAGE = 'marcq:exercice-coche';   // pose par le PRP 04, NON consomme ici

// web/domaine.js — PRP 02, ossature §5
totauxAccomplis(prog, faits)   // -> { pompes, squats, burpees, abdos, gainage_s, min_course, fentes, cases }

// web/etat.js — PRP 03
lireFaits()                    // -> { [id]: isoString }, {} si vide ou illisible

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)   // '2026-08-14' -> 'vendredi 14 août'

// web/app.js — PRP 03 : demarrer() est le seul appelant de brancherRecompenses.
```

Du PRP 03, les jetons et classes de `web/style.css` : `--marcq-encre`,
`--marcq-encre-douce`, `--marcq-fond`, `--marcq-carte`, `--marcq-accent`,
`--marcq-trait`, `--marcq-tap`, `.bouton`, `.bouton-principal`. Du PRP 04 :
`.barre`, `.exercice.fait`, `.libelle-exercice`.

**Produit :**

```js
// web/recompenses.js
export const REQUETE_MOUVEMENT_REDUIT = '(prefers-reduced-motion: reduce)';
export const DUREE_ROULEMENT_MS = 900;
export const NOMBRE_CONFETTIS = 24;
export const TITRE_FIN = 'Séance bouclée.';
export const TEXTE_FERMETURE = 'Continuer';
export const UNITES_DU_PANNEAU = [{ cle, libelle }, …];

export function mouvementReduit(fenetre = globalThis)          // -> boolean
export function valeurRoulee(depart, arrivee, part)            // -> entier
export function rouler(noeud, depart, arrivee, options = {})   // -> annuler()
export function seancesTerminees(prog, faits)                  // -> entier
export function faitsSansSeance(prog, faits, dateISO)          // -> nouveaux faits, l'entree n'est pas mutee
export function resumeDeFin(prog, faits)                       // -> Resume
export function lancerConfettis(hote, options = {})            // -> la couche, ou null en mouvement reduit
export function brancherRecompenses(prog, options = {})        // -> debrancher()
```

```js
// Resume — tout ce que le panneau annonce, et rien de plus
{
  seances,        // seances entierement cochees
  seancesTotal,   // prog.seances.length — jamais la constante 7
  compteurs: [ { cle, libelle, valeur } ],   // valeur > 0 seulement
}

// Les options de rouler, toutes injectables — c'est ce qui rend le respect de
// prefers-reduced-motion prouvable par `node --test`, sans navigateur :
{ duree, format, reduit, planifier, maintenant }

// Les options de lancerConfettis :
{ nombre, alea, reduit, doc }

// Les options de brancherRecompenses :
{ racine, fenetre, lire }
```

**Les noms introduits ici, absents de `00-ossature.md` :**

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/recompenses.js` | L'ossature §3 liste les modules connus à sa rédaction ; les récompenses n'en sont pas un. Elles ne sont pas un écran — elles n'ont pas de route, se branchent une fois pour toute la page et débordent de `#ecran`. Les loger dans `vue-seance.js` ferait de la vue le propriétaire d'un panneau qui lui survit ; dans `app.js`, cela mélangerait le routeur et une animation. Le serveur sert tout `web/` à la racine depuis `//go:embed web` (ossature §7) : le fichier est servi sans une ligne de Go en plus. |
| `tests/recompenses.test.js` | Un fichier par PRP : deux branches parallèles qui écrivent chacune dans le sien fusionnent sans conflit (précédent du PRP 04). |
| `mouvementReduit`, `REQUETE_MOUVEMENT_REDUIT` | La préférence système, lue une fois par panneau et injectable. La constante existe pour qu'un test vérifie qu'on interroge **la bonne** requête média : une faute de frappe y rendrait `matches` toujours faux, en silence. |
| `valeurRoulee`, `rouler`, `DUREE_ROULEMENT_MS` | Le roulement du PRD §10, coupé en une fonction pure et une boucle. |
| `seancesTerminees`, `faitsSansSeance`, `resumeDeFin`, `UNITES_DU_PANNEAU` | Le modèle pur du panneau. `faitsSansSeance` est ce qui donne le **point de départ** du roulement : sans lui les compteurs partiraient de zéro et raconteraient une histoire fausse. |
| `lancerConfettis`, `NOMBRE_CONFETTIS` | Vingt-quatre `<i>` et une règle d'animation. Aucune bibliothèque, aucun asset distant (ossature §2). |
| `brancherRecompenses` | Le seul point d'entrée. Rend un `debrancher()` : c'est ce que le contrat d'écran du PRP 03 appelle « ce qui déborde de `hote` ». |
| `TITRE_FIN`, `TEXTE_FERMETURE` | Deux phrases exportées pour être épinglées par un test, comme `PHRASE_RASSURANTE` au PRP 03 : une reformulation bien intentionnée les perdrait en silence. |
| Classes CSS | `.panneau-fin` `.carte-fin` `.fin-date` `.fin-titre` `.fin-seances` `.fin-nombre-seances` `.fin-volume` `.fin-ligne` `.fin-nombre` `.fin-fermer` `.confettis` `.confetti`. Le bouton réutilise `.bouton` et `.bouton-principal` : une jumelle divergerait. |
| Images-clés et jetons | `marcq-monte` `marcq-pop` `marcq-chute` ; `--marcq-ressort`, `--marcq-confetti-1` à `--marcq-confetti-4`. Les couleurs vivent dans la feuille de style, jamais dans le JavaScript : une teinte tirée au hasard produit tôt ou tard un confetti illisible sur fond clair. |

## Fichiers

- Créer : `apps/marcq-handball/web/recompenses.js`,
  `apps/marcq-handball/tests/recompenses.test.js`
- Modifier : `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/recompenses.test.js`, plus les trois
  contrôles à la main de la tâche 5 et de la tâche 6 — deux des trois interdits
  du PRD §10 se constatent à l'écran, le troisième se teste.

## Comment on vérifie les trois interdits

Le PRD §10 les énonce comme des interdits ; ce PRP les traite comme des critères
d'acceptation. Chacun a sa méthode, et elles ne sont pas interchangeables.

**1. « Rien ne bloque l'interaction plus d'une demi-seconde. »** Se **teste** en
partie et se **constate** pour le reste. La partie testable : aucune transition
CSS ne dépasse 400 ms (test 5). La partie qui se constate : outils de
développement → Performances → enregistrer, cocher trois cases aussi vite que
possible, arrêter ; aucune tâche longue, et les trois lignes sont barrées. Ce
qui rend le résultat prévisible n'est pas la mesure mais la conception : **le
cochage n'exécute pas une ligne de ce module**, il est entièrement en CSS.

**2. « Aucune animation sur un écran consulté pendant l'effort. »** L'écran de
séance *est* consulté pendant l'effort, et le PRD y demande pourtant une
récompense au cochage : l'interdit ne vise donc pas l'animation déclenchée par
le doigt de l'enfant, il vise le mouvement qui part **tout seul**. Traduction
opérationnelle : aucune animation en boucle, aucune animation sans geste. La
première moitié se teste (test 6, aucun `infinite` dans la feuille) ; la seconde
se constate : ouvrir une séance déjà entièrement cochée et une séance à venir,
laisser l'écran ouvert une minute sans y toucher, et vérifier que rien ne bouge.

**3. « `prefers-reduced-motion` est respecté — tout reste utilisable sans un
seul mouvement. »** Se **teste**, deux fois et à deux niveaux : la feuille de
style neutralise animations et transitions (test 3) et `rouler` pose la valeur
finale sans demander une seule image (test 10). Se constate aussi, par
l'émulation des outils de développement. Les deux niveaux comptent : le CSS
protège ce qu'un futur PRP ajoutera sans y penser, le JavaScript protège ce que
le CSS ne voit pas — une boucle `requestAnimationFrame` reste une boucle même
quand la transition dure une microseconde.

## Le ton, qui est une contrainte et pas un goût

PRD §10 : *« Le ton est direct et tutoie, sans infantiliser des joueurs de 13-14
ans : ils sont en U15, pas à l'école des poussins. Pas de mascotte, pas de badge
à collectionner, pas de vocabulaire de coach américain. »*

La règle tient en une phrase : **on annonce un fait, on ne commente pas une
performance.** À 13 ans, un chiffre juste vaut mieux qu'un compliment, parce que
le chiffre est vrai et que le compliment est automatique.

| On écrit | On n'écrit pas | Pourquoi |
|---|---|---|
| « Séance bouclée. » | « Bravo champion, séance validée ! » | Le second félicite l'enfant d'avoir tapé sur une case. |
| « 3 séances sur 7 » | « Niveau 3 débloqué ! » | Un niveau est une récompense inventée ; trois séances sur sept est un fait. |
| « 226 pompes » | « 226 pompes, quelle machine ! » | Le nombre parle seul — c'est même exactement le nombre qu'il répétera à table (PRD §9). |
| « Continuer » | « On enchaîne ? C'est parti ! » | Un bouton dit ce qu'il fait. |
| « Séance à venir. Elle s'ouvrira lundi 17 août. » (PRP 04) | « Patience, ça arrive bientôt ! » | Une date est actionnable, un encouragement ne l'est pas. |

Le test 16 épingle les deux phrases exportées et refuse une liste de mots dans
tout le fichier — **commentaires compris**. Ce n'est pas de la pruderie : ces
mots arrivent par la porte du commentaire (« pas de badge ici ») puis passent
dans une chaîne à la retouche suivante.

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/recompenses
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`. Les tâches s'exécutent **dans l'ordre** : chacune ajoute à
`recompenses.js` ce que la suivante utilise.

Chaque étape lance `tests/recompenses.test.js` **nommément** et non le glob : le
total du dépôt dépend du PRP 05, dont ce document ne connaît pas le compte. Les
nombres par fichier donnés ici, eux, sont exacts.

---

### Tâche 1 — `prefers-reduced-motion`, écrit avant la première animation

**Fichiers :** Créer `apps/marcq-handball/tests/recompenses.test.js` · Créer `apps/marcq-handball/web/recompenses.js` · Modifier `apps/marcq-handball/web/style.css`

C'est la tâche irréductible, et elle vient en premier pour une raison
mécanique : un garde-fou écrit après les animations est un garde-fou auquel on
oublie d'ajouter la dernière. Écrit avant, il couvre aussi ce que les PRP 05,
09, 10 et 11 ajouteront sans y penser.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/recompenses.test.js` :

```js
// Les recompenses, prouvees sans navigateur.
//
// Ce qui DECIDE quelque chose — la preference du systeme, la valeur d'un
// compteur en cours de route, ce que le panneau annonce — est pur et teste ici.
// Ce qui reste est de l'assemblage d'elements, verifie a la main aux taches 5
// et 6 : la CI n'a pas de navigateur et n'en aura pas, l'app n'ayant aucune
// dependance (ossature §2).
//
// L'import est un import d'espace de noms — `import * as rec` — et non des
// imports nommes : un export encore absent devient alors `undefined` et donne un
// TypeError sur l'appel, la ou un import nomme ferait echouer le CHARGEMENT du
// fichier entier et masquerait les tests deja verts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rec from '../web/recompenses.js';

const lire = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const css = lire('style.css');

// Une fenetre qui repond ce qu'on lui dit, et qui verifie au passage qu'on lui
// pose LA bonne question : une faute de frappe dans la requete media rendrait
// `matches` toujours faux, sans qu'aucun symptome n'apparaisse.
const fenetreQuiRepond = (matches) => ({
  matchMedia(requete) {
    assert.equal(requete, rec.REQUETE_MOUVEMENT_REDUIT, 'requete media inattendue');
    return { matches };
  },
});

test('la preference du systeme est lue, pas devinee (PRD §10)', () => {
  assert.equal(rec.mouvementReduit(fenetreQuiRepond(true)), true);
  assert.equal(rec.mouvementReduit(fenetreQuiRepond(false)), false);
});

test('un navigateur sans matchMedia n est pas prive d animation', () => {
  // L'absence de matchMedia ne veut pas dire « mouvement reduit », elle veut
  // dire « on ne sait pas ». Le second appel prouve en plus que le module se
  // charge sous Node sans toucher au DOM.
  assert.equal(rec.mouvementReduit({}), false);
  assert.equal(rec.mouvementReduit(), false);
});

test('style.css neutralise tout mouvement quand le systeme le demande (PRD §10)', () => {
  // Un seul bloc dans toute la feuille. Le PRP 01 en avait pose un ; ce PRP le
  // REMPLACE. En laisser deux serait le pire cas : la recherche ci-dessous
  // extrait le premier, les assertions porteraient sur le bloc du PRP 01, et
  // l'echec ne designerait pas le fichier fautif. On le verrouille ici plutot
  // que de le recommander en prose.
  const blocs = css.match(/@media \(prefers-reduced-motion: reduce\)/g) || [];
  assert.equal(blocs.length, 1,
    `style.css doit porter exactement un bloc de mouvement reduit, ${blocs.length} trouve(s) — celui du PRP 01 a-t-il ete supprime ?`);

  const bloc = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(bloc, 'le bloc prefers-reduced-motion manque dans style.css');
  // Les deux proprietes, pas une seule : une transition oubliee suffit a faire
  // bouger un ecran qu'on a demande immobile.
  assert.match(bloc[1], /animation-duration:\s*\.001ms\s*!important/);
  assert.match(bloc[1], /transition-duration:\s*\.001ms\s*!important/);
  assert.match(bloc[1], /animation-iteration-count:\s*1\s*!important/);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 0` et `# fail 1` — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../apps/marcq-handball/web/recompenses.js' imported from .../apps/marcq-handball/tests/recompenses.test.js`

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/recompenses.js` :

```js
// recompenses.js — le fun, et la ou il doit etre (PRD §10).
//
// Une animation est une recompense, jamais un peage : elle vient APRES l'action,
// ne retarde aucun tap, et ne s'interpose jamais entre l'enfant et la case
// suivante. Trois consequences, qui sont des regles de ce fichier :
//
//   1. le cochage n'execute pas une ligne d'ici — il est entierement en CSS,
//      donc il ne PEUT PAS retarder un tap ;
//   2. rien ne demarre sans un geste : pas de minuterie d'ambiance, pas
//      d'animation en boucle ;
//   3. `prefers-reduced-motion` supprime tout mouvement, et tout reste
//      utilisable — c'est verifie a deux niveaux, ici et dans style.css.

// La requete media est nommee : une faute de frappe rendrait `matches` toujours
// faux, et personne ne s'en apercevrait avant qu'un utilisateur ne se plaigne.
export const REQUETE_MOUVEMENT_REDUIT = '(prefers-reduced-motion: reduce)';

// La preference du systeme. `fenetre` est un parametre pour que `node --test`
// puisse repondre a la place du navigateur : le respect de cette preference est
// la seule des trois interdictions du PRD §10 qu'un test peut prouver.
export function mouvementReduit(fenetre = globalThis) {
  // Pas de matchMedia ne veut pas dire « mouvement reduit », mais « on ne sait
  // pas ». Repondre `true` priverait d'animation un navigateur qui n'a rien
  // demande ; le bloc CSS protege de toute facon.
  if (typeof fenetre?.matchMedia !== 'function') return false;
  return fenetre.matchMedia(REQUETE_MOUVEMENT_REDUIT).matches === true;
}
```

**Supprimer** le bloc `@media (prefers-reduced-motion: reduce)` posé par le
PRP 01 (`web/style.css`, en fin de la section du socle), puis ajouter à la fin de
`apps/marcq-handball/web/style.css` :

> **Un seul bloc dans toute la feuille.** Le PRP 01 en a posé un, avec
> `0.01ms`, pour que la règle existe dès la première ligne de CSS. Ce PRP le
> **remplace**, il ne s'y ajoute pas. En laisser deux ferait échouer le test de
> l'étape suivante : sa recherche extrait le **premier** bloc du fichier — donc
> celui du PRP 01 — et l'assertion sur `.001ms` ne peut pas correspondre à
> `0.01ms`. L'échec ne désignerait pas ce fichier-ci, et se chercherait longtemps.

```css
/* ---------------------------------------------------------------------------
   Les recompenses — PRP 06.
   L'animation vient apres l'action et ne retarde aucun tap (PRD §10).
   --------------------------------------------------------------------------- */

/* Le SEUL bloc de mouvement reduit de la feuille : il remplace celui du PRP 01.
   Volontairement universel — il couvre ce qui suit dans ce fichier, mais aussi
   ce qu'un PRP futur y ajoutera sans y penser. Sa position n'a aucun effet,
   `!important` gagnant quel que soit l'ordre ; c'est son EXISTENCE des la
   premiere animation qui compte.
   `.001ms` plutot que `0s` : l'animation se termine a l'image suivante, donc
   `animationend` et `transitionend` sont bien emis, et un code qui attend l'un
   des deux pour nettoyer n'attend pas indefiniment. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 3`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/recompenses.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : le mouvement reduit, avant la premiere animation"
git push
```

---

### Tâche 2 — Le ressort de la coche, sans une ligne de JavaScript

**Fichiers :** Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/recompenses.test.js`

PRD §10 : *« Cocher un exercice : la ligne se barre, la barre de progression
avance d'un cran avec du ressort. Immédiat, court. »* Le PRP 04 a déjà posé les
deux états — `.exercice.fait .libelle-exercice` barré, `<progress>` mis à jour.
Il manque la durée et la courbe, et elles s'écrivent **en CSS seul**.

C'est le choix structurant de ce PRP : la récompense la plus fréquente de l'app
— 53 fois contre 7 pour les confettis — ne passe par aucun code à nous. Un tap
ne peut donc pas être retardé par une erreur de ce module, parce qu'il ne
l'exécute pas. C'est aussi ce qui rend `marcq:exercice-coche` inutile ici.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/recompenses.test.js` :

```js
test('cocher fait rebondir la barre et barre la ligne, sans une ligne de JavaScript', () => {
  assert.match(
    css,
    /\.barre::-webkit-progress-value\s*\{[^}]*transition:/,
    'le remplissage de la barre doit rebondir, pas sauter',
  );
  // Le trait existe des le depart, en transparent : c'est sa COULEUR qui
  // s'anime. Un trait qui pousse de gauche a droite se casse des que le libelle
  // passe sur deux lignes, ce qui arrive au premier telephone etroit.
  assert.match(css, /\.libelle-exercice\s*\{[^}]*text-decoration-color:\s*transparent/);
  assert.match(css, /\.libelle-exercice\s*\{[^}]*transition:[^};]*text-decoration-color/);
});

// Toutes les durees de transition du fichier, en millisecondes.
const dureesDeTransition = () =>
  [...css.matchAll(/transition(?:-duration)?:([^;}]*)/g)]
    .flatMap(([, declaration]) => [...declaration.matchAll(/([\d.]+)(ms|s)\b/g)])
    .map(([, nombre, unite]) => Number(nombre) * (unite === 's' ? 1000 : 1));

test('aucune transition ne depasse 400 ms — premier interdit du PRD §10', () => {
  const durees = dureesDeTransition();
  assert.ok(durees.length >= 3, 'la lecture de style.css a echoue si le compte est bas');
  for (const ms of durees) {
    assert.ok(ms <= 400, `une transition de ${ms} ms retarde la main de l enfant`);
  }
});

test('rien ne bouge tout seul : aucune animation ne boucle — deuxieme interdit', () => {
  // Une animation en boucle est du mouvement pendant l'effort, sur un ecran que
  // personne n'a touche. C'est la moitie testable du deuxieme interdit ; l'autre
  // se constate a la tache 5.
  assert.equal(css.includes('infinite'), false, 'aucune animation ne doit tourner en boucle');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 5` et `# fail 1`. Seul le premier des trois nouveaux
tests tombe :
`AssertionError [ERR_ASSERTION]: The input did not match the regular expression /\.barre::-webkit-progress-value\s*\{[^}]*transition:/`.
Les deux autres passent déjà — ce sont des gardes de régression, pas des manques
présents, et c'est leur rôle : ils tomberont le jour où quelqu'un ajoutera une
transition d'une seconde ou une animation en boucle.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
:root {
  /* Un depassement leger a l'arrivee : c'est ce que l'oeil lit comme du
     ressort. Au-dela, la barre a l'air de rebondir sur un mur. */
  --marcq-ressort: cubic-bezier(.2, .9, .25, 1.25);
}

/* `appearance: none` est ce qui rend le remplissage stylable dans les
   navigateurs WebKit et Blink : sans lui, ::-webkit-progress-value n'existe pas
   et la barre garde son apparence systeme. Le fond et la couleur sont donc
   reposes ici, pour les deux ecrans qui utilisent `.barre` — le jour et la
   seance : une barre stylee d'un cote et systeme de l'autre serait la meme
   information dans deux dialectes. */
.barre {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  border-radius: 999px;
  background: var(--marcq-trait);
  overflow: hidden;
}

.barre::-webkit-progress-bar { background: var(--marcq-trait); }

.barre::-webkit-progress-value {
  border-radius: 999px;
  background: var(--marcq-accent);
  transition: width 260ms var(--marcq-ressort);
}

.barre::-moz-progress-bar { border-radius: 999px; background: var(--marcq-accent); }

/* La ligne se barre : c'est la COULEUR du trait qui s'anime, pas sa largeur. Le
   trait est present des le depart, en transparent, ce qui evite deux ecueils —
   un trait qui pousse de gauche a droite se casse sur un libelle a deux lignes,
   et une transition ne demarre jamais au tout premier calcul de style, donc une
   seance rouverte deja cochee ne rejoue rien (deuxieme interdit, PRD §10). */
.libelle-exercice {
  text-decoration-line: line-through;
  text-decoration-thickness: 2px;
  text-decoration-color: transparent;
  transition: color 220ms ease-out, text-decoration-color 220ms ease-out;
}
```

Le PRP 04 pose déjà `.exercice.fait .libelle-exercice { color: …;
text-decoration: line-through; text-decoration-thickness: 2px; }`, de
spécificité supérieure : c'est lui qui décide de l'état d'arrivée, et rien n'est
à y changer. Ce bloc-ci ne fournit que l'état de départ et la durée.

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 6`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/style.css apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : le ressort de la coche, en CSS seul"
git push
```

---

### Tâche 3 — Un compteur qui augmente ne saute pas, il roule

**Fichiers :** Modifier `apps/marcq-handball/web/recompenses.js` · Tester `apps/marcq-handball/tests/recompenses.test.js`

PRD §10 : *« Un compteur qui augmente ne saute jamais à sa valeur : il roule. »*
Le roulement est coupé en deux : `valeurRoulee`, pure — où en est le nombre à
telle fraction du trajet — et `rouler`, la boucle qui appelle la première. La
coupure n'est pas cosmétique : elle met la courbe, l'arrondi et le bornage à
portée de `node --test`, et laisse dans la boucle uniquement l'appel à
`requestAnimationFrame`.

Les quatre paramètres injectables de `rouler` — `duree`, `reduit`, `planifier`,
`maintenant` — existent pour cette raison, et l'un d'eux prouve le troisième
interdit du PRD §10 : en mouvement réduit, **aucune image n'est demandée**.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/recompenses.test.js` :

```js
test('valeurRoulee part du depart et arrive exactement a l arrivee', () => {
  assert.equal(rec.valeurRoulee(100, 140, 0), 100);
  assert.equal(rec.valeurRoulee(100, 140, 1), 140, 'jamais 139 par arrondi');
  assert.equal(rec.valeurRoulee(0, 226, 1), 226);
});

test('valeurRoulee borne la part : jamais avant le depart, jamais apres l arrivee', () => {
  assert.equal(rec.valeurRoulee(100, 140, -1), 100);
  assert.equal(rec.valeurRoulee(100, 140, 2), 140);
});

test('un compteur passe par des valeurs intermediaires, croissantes et entieres', () => {
  let precedent = 100;
  for (let i = 1; i <= 20; i += 1) {
    const valeur = rec.valeurRoulee(100, 140, i / 20);
    assert.ok(Number.isInteger(valeur), `un compteur affiche des entiers, vu ${valeur}`);
    assert.ok(valeur >= precedent, `un compteur ne recule pas : ${precedent} -> ${valeur}`);
    precedent = valeur;
  }
  assert.equal(precedent, 140);
});

test('rouler avance image par image, puis s arrete', () => {
  const noeud = { textContent: '' };
  const images = [];
  let horloge = 0;

  const annuler = rec.rouler(noeud, 100, 140, {
    duree: 400,
    reduit: false,
    planifier: (rappel) => images.push(rappel),
    maintenant: () => horloge,
  });

  assert.equal(noeud.textContent, '100', 'il part de la valeur d avant, pas de zero');
  horloge = 200;
  images.pop()();
  const milieu = Number(noeud.textContent);
  assert.ok(milieu > 100 && milieu < 140, `valeur intermediaire attendue, vu ${milieu}`);

  horloge = 400;
  images.pop()();
  assert.equal(noeud.textContent, '140');
  assert.equal(images.length, 0, 'la boucle ne redemande pas d image apres l arrivee');
  annuler();
});

test('mouvement reduit : le compteur affiche sa valeur, sans demander une seule image', () => {
  // Le troisieme interdit du PRD §10, prouve. Le CSS ne suffirait pas : une
  // boucle requestAnimationFrame reste une boucle meme quand les transitions
  // durent une microseconde.
  const noeud = { textContent: '' };
  let demandes = 0;
  rec.rouler(noeud, 100, 140, { reduit: true, planifier: () => { demandes += 1; } });
  assert.equal(noeud.textContent, '140');
  assert.equal(demandes, 0);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 6` et `# fail 5` : trois sur
`error: 'rec.valeurRoulee is not a function'` et deux sur
`error: 'rec.rouler is not a function'`, toutes `name: 'TypeError'`.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/recompenses.js` :

```js
// --- le roulement d'un compteur ---------------------------------------------

// Assez long pour qu'on VOIE le nombre monter, assez court pour ne pas faire
// attendre. Au-dela d'une seconde on regarde une animation ; en deca de six
// cents millisecondes on ne lit rien.
export const DUREE_ROULEMENT_MS = 900;

// Ou en est le compteur a `part` du trajet. Pure : c'est ici que vivent la
// courbe, l'arrondi et le bornage, donc c'est ici que `node --test` les attrape.
export function valeurRoulee(depart, arrivee, part) {
  const t = Math.min(1, Math.max(0, part));
  // Sortie amortie : vite au debut, lent a l'arrivee — c'est la que l'oeil lit
  // le nombre. Une progression lineaire se lit comme un compteur casse.
  const adouci = 1 - (1 - t) ** 3;
  // L'arrivee est posee telle quelle : sans ce cas, un arrondi rendrait 225 la
  // ou le programme en prescrit 226, et le chiffre affiche serait faux.
  return t === 1 ? arrivee : Math.round(depart + (arrivee - depart) * adouci);
}

// Fait rouler le texte d'un noeud de `depart` a `arrivee`. Rend une fonction
// qui interrompt le roulement en POSANT la valeur finale : un compteur
// interrompu a mi-chemin afficherait un nombre faux, ce qui est pire qu'un
// nombre pose d'un coup.
//
// `planifier` et `maintenant` sont des parametres parce que Node n'a ni
// requestAnimationFrame ni horloge d'animation : c'est ce qui rend cette boucle
// verifiable sans navigateur.
export function rouler(noeud, depart, arrivee, options = {}) {
  const {
    duree = DUREE_ROULEMENT_MS,
    format = (valeur) => String(valeur),
    reduit = mouvementReduit(),
    planifier = (rappel) => requestAnimationFrame(rappel),
    maintenant = () => performance.now(),
  } = options;

  if (reduit || duree <= 0 || depart === arrivee) {
    noeud.textContent = format(arrivee);
    return () => {};
  }

  const debut = maintenant();
  let vivant = true;

  const pas = () => {
    if (!vivant) return;
    const part = Math.min(1, (maintenant() - debut) / duree);
    noeud.textContent = format(valeurRoulee(depart, arrivee, part));
    if (part < 1) planifier(pas);
  };

  noeud.textContent = format(depart);
  planifier(pas);

  return () => {
    vivant = false;
    noeud.textContent = format(arrivee);
  };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 11`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/recompenses.js apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : un compteur qui augmente roule, il ne saute pas"
git push
```

---

### Tâche 4 — Ce que le panneau annonce, et d'où il part

**Fichiers :** Modifier `apps/marcq-handball/web/recompenses.js` · Tester `apps/marcq-handball/tests/recompenses.test.js`

PRD §10 : *« Terminer une séance : c'est le moment fort. Confettis, le compteur
de séances s'incrémente en grand, le volume cumulé se met à jour sous les
yeux. »* « Sous les yeux » impose un **point de départ** : le volume d'avant
cette séance. Sans lui, les compteurs partiraient de zéro et raconteraient une
histoire fausse — celle d'un enfant qui n'aurait rien fait avant aujourd'hui.

D'où `faitsSansSeance` : on recalcule le résumé avec les cases de cette séance
retirées, et le roulement va de l'un à l'autre. Le calcul reste **pur et sans
horloge** : « aujourd'hui » n'intervient nulle part, une séance terminée l'est
quelle que soit la date à laquelle on la regarde.

- [ ] **Étape 1 — écrire le test qui échoue**

Compléter les imports en tête de `apps/marcq-handball/tests/recompenses.test.js` :

```js
import { chargerProgramme, totauxAccomplis } from '../web/domaine.js';
```

Puis ajouter à la fin du fichier :

```js
const prog = chargerProgramme(JSON.parse(lire('programme.json')));
const T = '2026-08-03T18:22:11.000Z';

const idsDe = (date) =>
  prog.seances.find((s) => s.date === date).blocs.flatMap((b) => b.exercices.map((e) => e.id));
const faitsDe = (dates) => Object.fromEntries(dates.flatMap(idsDe).map((id) => [id, T]));
const toutesLesDates = prog.seances.map((s) => s.date);

test('une seance n est terminee que si toutes ses cases sont tombees', () => {
  assert.equal(rec.seancesTerminees(prog, {}), 0);
  assert.equal(rec.seancesTerminees(prog, faitsDe(['2026-08-03'])), 1);
  assert.equal(rec.seancesTerminees(prog, faitsDe(['2026-08-03', '2026-08-12'])), 2);
  assert.equal(rec.seancesTerminees(prog, faitsDe(toutesLesDates)), 7);

  const presque = faitsDe(['2026-08-03']);
  delete presque[idsDe('2026-08-03').at(-1)];
  assert.equal(rec.seancesTerminees(prog, presque), 0, 'une seule case manquante suffit');
});

test('faitsSansSeance retire une seance, et ne mute pas ce qu on lui donne', () => {
  const faits = faitsDe(['2026-08-03', '2026-08-05']);
  const sans = rec.faitsSansSeance(prog, faits, '2026-08-05');

  assert.equal('s1-r1' in sans, true, 'la seance du 3 aout reste entiere');
  for (const id of idsDe('2026-08-05')) {
    assert.equal(id in sans, false, `${id} devait sortir`);
  }
  assert.equal(Object.keys(faits).length, Object.keys(faitsDe(['2026-08-03', '2026-08-05'])).length,
    'l objet recu survit intact');
  // Une date sans seance ne retire rien plutot que de lever : l'evenement vient
  // de notre propre code, mais un appel egare ne doit pas casser la page.
  assert.deepEqual(rec.faitsSansSeance(prog, faits, '2026-08-04'), faits);
});

test('les compteurs du panneau sont calcules, jamais recopies (PRD §8)', () => {
  const faits = faitsDe(toutesLesDates);
  const resume = rec.resumeDeFin(prog, faits);
  const totaux = totauxAccomplis(prog, faits);

  assert.equal(resume.seances, 7);
  assert.equal(resume.seancesTotal, 7, 'le total vient du fichier, pas d une constante');
  for (const compteur of resume.compteurs) {
    assert.equal(compteur.valeur, totaux[compteur.cle], `${compteur.cle} doit venir du domaine`);
  }
  // Programme entierement coche : les totaux prescrits de l'ossature §4. Cette
  // assertion relie le panneau au fichier de donnees d'un bout a l'autre.
  assert.deepEqual(
    resume.compteurs.map((c) => [c.cle, c.valeur]),
    [['pompes', 226], ['squats', 345], ['burpees', 105], ['min_course', 235]],
  );
});

test('un compteur a zero ne s affiche pas', () => {
  // Une seule case cochee — « 15 pompes », deux tours, donc 30. Afficher
  // « 0 burpees » a cet instant n'apprend rien et donne l'impression d'un
  // tableau de bord vide.
  const resume = rec.resumeDeFin(prog, { 's1-r1': T });
  assert.deepEqual(resume.compteurs, [{ cle: 'pompes', libelle: 'pompes', valeur: 30 }]);
  assert.equal(resume.seances, 0);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 11` et `# fail 4` :
`error: 'rec.seancesTerminees is not a function'`,
`error: 'rec.faitsSansSeance is not a function'`, puis deux fois
`error: 'rec.resumeDeFin is not a function'` — toutes `name: 'TypeError'`.

- [ ] **Étape 3 — l'implémentation minimale**

Compléter les imports en tête de `apps/marcq-handball/web/recompenses.js` :

```js
import { totauxAccomplis } from './domaine.js';
```

Ajouter à la fin du fichier :

```js
// --- ce que le panneau annonce ----------------------------------------------

// Quatre compteurs, pas six. Le panneau tient sur un ecran de telephone tenu a
// bout de bras ; l'inventaire complet — gainage et abdos compris — est l'ecran
// perso (PRP 05, PRD §7.5). Les libelles sont des NOMBRES suivis d'un mot :
// « 2 h 10 de course » ne roule pas, « 130 min de course » roule.
export const UNITES_DU_PANNEAU = [
  { cle: 'pompes', libelle: 'pompes' },
  { cle: 'squats', libelle: 'squats' },
  { cle: 'burpees', libelle: 'burpees' },
  { cle: 'min_course', libelle: 'min de course' },
];

// Combien de seances sont entierement cochees. Sans horloge : une seance
// terminee l'est quelle que soit la date a laquelle on la regarde, et faire
// entrer `aujourdhui` ici rendrait le panneau dependant du fuseau.
export function seancesTerminees(prog, faits) {
  return prog.seances.filter((seance) =>
    seance.blocs.every((bloc) =>
      bloc.exercices.every((ex) => Object.prototype.hasOwnProperty.call(faits, ex.id)))).length;
}

// Les faits tels qu'ils etaient AVANT cette seance. C'est le point de depart du
// roulement : sans lui les compteurs partiraient de zero et raconteraient qu'on
// n'a rien fait avant aujourd'hui. L'objet recu n'est pas mute — regle 1 du
// contrat d'ecran du PRP 03, et un second etat divergerait en silence.
export function faitsSansSeance(prog, faits, dateISO) {
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (seance === undefined) return faits;

  const restant = { ...faits };
  for (const bloc of seance.blocs) {
    for (const ex of bloc.exercices) delete restant[ex.id];
  }
  return restant;
}

// Tout ce que le panneau doit savoir, et rien de plus. Les valeurs viennent du
// domaine : modifier programme.json change ce qui s'affiche sans toucher au
// code (PRD §8).
export function resumeDeFin(prog, faits) {
  const totaux = totauxAccomplis(prog, faits);
  return {
    seances: seancesTerminees(prog, faits),
    seancesTotal: prog.seances.length,
    compteurs: UNITES_DU_PANNEAU
      .map(({ cle, libelle }) => ({ cle, libelle, valeur: totaux[cle] ?? 0 }))
      .filter((compteur) => compteur.valeur > 0),
  };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 15`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/recompenses.js apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : le resume de fin de seance, et d'ou il part"
git push
```

---

### Tâche 5 — Le panneau de fin de séance, et son branchement

**Fichiers :** Modifier `apps/marcq-handball/web/recompenses.js` · Modifier `apps/marcq-handball/web/style.css` · Modifier `apps/marcq-handball/web/app.js` · Modifier `apps/marcq-handball/web/sw.js` · Modifier `apps/marcq-handball/README.md` · Tester `apps/marcq-handball/tests/recompenses.test.js`

Le PRP 04 émet `marcq:seance-complete` **à la transition seulement** ; ce PRP
l'écoute et ouvre le panneau. Trois décisions à justifier ici :

**Un `<dialog>` et `showModal()`.** Le panneau rend le reste de la page inerte —
c'est le seul moment de l'application où quoi que ce soit est modal. Ce n'est
pas un péage au sens du PRD §10 parce qu'à cet instant **il n'y a plus de case
suivante** : la séance vient de se terminer. En échange, `showModal` donne
gratuitement le focus sur le bouton, la fermeture par `Échap`, le fond assombri
et l'inertage du reste — écrire un piège à focus à la main serait plus long et
moins bon. `<dialog>` est supporté par tous les navigateurs depuis mars 2022 ;
l'app en dépend comme elle dépend des modules ES natifs (ossature §2).

**Le compteur de séances ne roule pas, il apparaît.** Il augmente de un ; le
faire rouler de 1 à 2 pendant neuf cents millisecondes ferait attendre un nombre
que l'enfant connaît déjà. Il arrive donc à sa valeur avec un court
agrandissement — « en grand », comme le demande le PRD §10 — pendant que les
compteurs de volume, eux, roulent : c'est là que le trajet vaut d'être vu, parce
qu'il fait quarante ou cent. Le point d'attention en fin de document revient sur
la lecture littérale du PRD.

**Le panneau vit hors de `#ecran`.** Le routeur du PRP 03 vide `#ecran` à chaque
montage ; un panneau posé dedans disparaîtrait au premier changement de route,
au milieu de son animation. Il est donc enfant de `<body>`, et c'est
exactement le cas que le contrat d'écran nomme « ce qui déborde de `hote` » :
`brancherRecompenses` rend un `debrancher()`, et ferme le panneau sur
`hashchange`.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/recompenses.test.js` :

```js
const source = lire('recompenses.js');

test('les recompenses se debranchent proprement', () => {
  const poses = [];
  const faux = {
    addEventListener(nom, fonction) { poses.push([nom, fonction]); },
    removeEventListener(nom, fonction) {
      const rang = poses.findIndex(([n, f]) => n === nom && f === fonction);
      if (rang >= 0) poses.splice(rang, 1);
    },
  };

  const debrancher = rec.brancherRecompenses(prog, { racine: faux, fenetre: faux });
  assert.deepEqual(
    poses.map(([nom]) => nom).sort(),
    ['hashchange', 'marcq:seance-complete'],
    'l ecoute de hashchange est ce qui ferme le panneau quand on change d ecran',
  );

  debrancher();
  assert.deepEqual(poses, [], 'aucun ecouteur ne survit au debranchement');
});

test('le ton reste celui d une equipe U15 (PRD §10)', () => {
  assert.equal(rec.TITRE_FIN, 'Séance bouclée.');
  assert.equal(rec.TEXTE_FERMETURE, 'Continuer');
  // Commentaires compris : ces mots arrivent par la porte du commentaire, puis
  // passent dans une chaine a la retouche suivante.
  const bas = source.toLowerCase();
  for (const mot of ['bravo', 'champion', 'badge', 'félicit', 'waouh', 'mascotte', 'trop fort']) {
    assert.equal(bas.includes(mot), false, `« ${mot} » n a rien a faire dans cette app`);
  }
});

test('le module ne compose pas de HTML et n ouvre aucun dialogue systeme', () => {
  for (const interdit of ['innerHTML', 'confirm(', 'alert(', 'prompt(']) {
    assert.equal(source.includes(interdit), false, `${interdit} : le texte passe par textContent`);
  }
});

test('l app branche les recompenses et les emporte hors ligne', () => {
  assert.match(lire('app.js'), /brancherRecompenses\(prog\)/, 'app.js doit brancher les recompenses');
  // Sans cette entree, la premiere fin de seance hors ligne echoue — et rien ne
  // le signale tant qu'on reste connecte (PRD §11).
  assert.match(lire('sw.js'), /'\/recompenses\.js'/, 'ajoute /recompenses.js a la coque de sw.js');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 16` et `# fail 3` :
- `TypeError: rec.brancherRecompenses is not a function` ;
- `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: undefined !== 'Séance bouclée.'` ;
- `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /brancherRecompenses\(prog\)/`.

Le test « le module ne compose pas de HTML » passe déjà : c'est un garde de
régression posé avant le code qu'il garde.

- [ ] **Étape 3 — l'implémentation minimale**

Compléter les imports en tête de `apps/marcq-handball/web/recompenses.js` :

```js
import { lireFaits } from './etat.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { EVT_SEANCE_COMPLETE } from './vue-seance.js';
```

Le nom de l'événement est **importé**, jamais recopié : une chaîne recopiée dans
deux fichiers se désynchronise sans qu'aucun test ne tombe — le panneau
cesserait simplement de s'ouvrir.

Ajouter à la fin de `apps/marcq-handball/web/recompenses.js` :

```js
// --- le panneau de fin de seance --------------------------------------------

// Deux phrases, exportees pour etre epinglees par un test. On annonce un fait,
// on ne commente pas une performance : a 13 ans un chiffre juste vaut mieux
// qu'un compliment, parce que le chiffre est vrai (PRD §10).
export const TITRE_FIN = 'Séance bouclée.';
export const TEXTE_FERMETURE = 'Continuer';

// Six lignes recopiees de vue-seance.js plutot qu'un export ajoute la-bas :
// faire dependre ce module des rouages internes d'une vue coute plus cher que
// six lignes, et `textContent` — jamais `innerHTML` — est ce qui rend un libelle
// de programme.json inoffensif.
function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Ouvre le panneau et rend la fonction qui le ferme. Toutes les valeurs sont
// calculees avant le premier append : le panneau n'a aucune decision a prendre
// une fois affiche.
function ouvrirPanneauDeFin(prog, faits, dateISO) {
  const avant = resumeDeFin(prog, faitsSansSeance(prog, faits, dateISO));
  const apres = resumeDeFin(prog, faits);
  // Lu une seule fois par panneau : matchMedia force un calcul de style, et
  // l'appeler par compteur le referait quatre fois pour la meme reponse.
  const reduit = mouvementReduit();

  const panneau = el('dialog', 'panneau-fin');
  const carte = el('div', 'carte-fin');

  carte.append(
    el('p', 'fin-date', `Séance du ${dateEnToutesLettres(dateISO)}`),
    el('h2', 'fin-titre', TITRE_FIN),
  );

  // Le compteur de seances arrive a sa valeur, en grand. Il augmente de un : le
  // faire rouler ferait attendre un nombre que l'enfant connait deja. Le mot est
  // un noeud separe et fige au pluriel final, sinon il changerait en cours de
  // route.
  const ligneSeances = el('p', 'fin-seances');
  ligneSeances.append(
    el('span', 'fin-nombre-seances', String(apres.seances)),
    document.createTextNode(
      apres.seances > 1
        ? ` séances sur ${apres.seancesTotal}`
        : ` séance sur ${apres.seancesTotal}`,
    ),
  );
  carte.append(ligneSeances);

  const roulements = [];
  if (apres.compteurs.length > 0) {
    const liste = el('ul', 'fin-volume');
    for (const compteur of apres.compteurs) {
      const depart = avant.compteurs.find((c) => c.cle === compteur.cle)?.valeur ?? 0;
      const item = el('li', 'fin-ligne');
      const nombre = el('span', 'fin-nombre');
      item.append(nombre, document.createTextNode(` ${compteur.libelle}`));
      liste.append(item);
      roulements.push(rouler(nombre, depart, compteur.valeur, { reduit }));
    }
    carte.append(liste);
  }

  const bouton = el('button', 'bouton bouton-principal fin-fermer', TEXTE_FERMETURE);
  bouton.type = 'button';
  carte.append(bouton);

  panneau.append(carte);
  document.body.append(panneau);

  function fermer() {
    // Poser la valeur finale avant de retirer : un roulement interrompu laisse
    // un nombre faux, et le panneau peut etre rouvert.
    for (const arreter of roulements) arreter();
    panneau.remove();
  }

  bouton.addEventListener('click', () => panneau.close());
  // Un tap hors de la carte ferme aussi : la cible est le <dialog> lui-meme,
  // jamais un de ses descendants.
  panneau.addEventListener('click', (evenement) => {
    if (evenement.target === panneau) panneau.close();
  });
  // `close` couvre les trois sorties d'un coup — le bouton, le fond, et la
  // touche Echap que showModal branche pour nous.
  panneau.addEventListener('close', fermer);

  panneau.showModal();

  return () => {
    if (panneau.open) panneau.close();
    else fermer();
  };
}

// Le seul point d'entree. Appele une fois par app.js, apres le premier rendu.
// Rend un `debrancher()` : c'est ce que le contrat d'ecran du PRP 03 appelle
// « ce qui deborde de hote ».
export function brancherRecompenses(prog, options = {}) {
  const { racine = globalThis.document, fenetre = globalThis, lire = lireFaits } = options;

  let fermerPanneau = null;

  function surSeanceComplete(evenement) {
    if (fermerPanneau !== null) fermerPanneau();
    // `lire()` et non le detail de l'evenement : les faits font foi, et ce sont
    // ceux que etat.js vient de relire depuis le stockage (PRP 04).
    fermerPanneau = ouvrirPanneauDeFin(prog, lire(), evenement.detail.date);
  }

  // Changer d'ecran ferme le panneau. Sans cela il survivrait au routeur, qui ne
  // vide que #ecran — et resterait modal sur un ecran qui n'a rien a voir.
  function surNavigation() {
    if (fermerPanneau === null) return;
    fermerPanneau();
    fermerPanneau = null;
  }

  racine.addEventListener(EVT_SEANCE_COMPLETE, surSeanceComplete);
  fenetre.addEventListener('hashchange', surNavigation);

  return function debrancher() {
    racine.removeEventListener(EVT_SEANCE_COMPLETE, surSeanceComplete);
    fenetre.removeEventListener('hashchange', surNavigation);
    surNavigation();
  };
}
```

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
/* Le panneau de fin de seance. `<dialog>` en couche superieure : il passe
   au-dessus de tout sans qu'aucun z-index n'ait a etre arbitre. */
.panneau-fin {
  width: min(22rem, calc(100vw - 2rem));
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
}

.panneau-fin::backdrop { background: rgb(20 24 31 / .55); }

.carte-fin {
  display: flex;
  flex-direction: column;
  gap: .8rem;
  padding: 1.4rem 1.2rem;
  border-radius: 1rem;
  background: var(--marcq-carte);
  text-align: center;
  animation: marcq-monte 260ms var(--marcq-ressort);
}

@keyframes marcq-monte {
  from { transform: translateY(14px) scale(.96); opacity: 0; }
  to   { transform: none; opacity: 1; }
}

.fin-date { margin: 0; color: var(--marcq-encre-douce); font-size: .95rem; }
.fin-titre { margin: 0; font-size: 1.5rem; line-height: 1.2; }
.fin-seances { margin: 0; color: var(--marcq-encre-douce); }

/* « En grand » (PRD §10) : le compteur de seances est le chiffre qu'on retient
   en fermant le panneau. Il arrive a sa valeur avec un agrandissement court, il
   ne roule pas — il augmente de un. */
.fin-nombre-seances {
  display: inline-block;
  color: var(--marcq-encre);
  font-size: 2.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  animation: marcq-pop 320ms var(--marcq-ressort);
}

@keyframes marcq-pop {
  from { transform: scale(.6); }
  to   { transform: none; }
}

.fin-volume {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fin-ligne {
  padding: .5rem .2rem;
  border-radius: .6rem;
  background: var(--marcq-fond);
  color: var(--marcq-encre-douce);
  font-size: .9rem;
}

/* `tabular-nums` : sans chiffres a chasse fixe, la ligne tremble a chaque image
   du roulement — c'est le detail qui fait passer une animation pour un bogue. */
.fin-nombre {
  display: block;
  color: var(--marcq-encre);
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.fin-fermer { align-self: stretch; }
```

**`web/app.js`** — un import et une ligne. Compléter les imports :

```js
import { brancherRecompenses } from './recompenses.js';
```

puis, dans `demarrer()`, insérer l'appel **après** le premier rendu et avant
l'enregistrement du service worker :

```js
  const ctx = creerContexte(prog, hote);
  window.addEventListener('hashchange', () => rendre(hote, ctx));
  rendre(hote, ctx);
  brancherRecompenses(prog);
  enregistrerServiceWorker();
```

Après le premier rendu, pour la même raison que le service worker : l'objectif
du PRD §4 se joue sur la première seconde, et rien de décoratif n'a sa place sur
le chemin de l'affichage. Le `debrancher()` rendu n'est pas conservé : la page
vit aussi longtemps que l'application, il n'y a pas de démontage.

**`web/sw.js`** — ajouter `'/recompenses.js'` à la liste de coque, après
`'/vue-seance.js'`. La vérification du PRP 04, complétée d'une entrée :

```bash
cd /home/user/hello-world/apps/marcq-handball && manquants=0 && \
for f in / /style.css /programme.json /app.js /etat.js /domaine.js \
         /vue-prenom.js /vue-jour.js /vue-reglages.js /vue-seance.js /recompenses.js; do \
  grep -q "'$f'" web/sw.js || { echo "MANQUANT : $f"; manquants=1; }; \
done; [ "$manquants" = 0 ] && echo OK
```

**`apps/marcq-handball/README.md`** — ajouter cette section à la fin :

````markdown
## Les récompenses

`web/recompenses.js` est branché une seule fois, à l'amorçage, par `web/app.js`.
Il écoute `marcq:seance-complete` et ouvre le panneau de fin de séance.

Deux des récompenses n'ont **aucun JavaScript** : la ligne qui se barre et la
barre de progression qui rebondit sont des transitions CSS. C'est ce qui
garantit qu'un tap ne peut pas être retardé par ce module — il ne l'exécute pas.

Trois règles s'appliquent, et ce sont des critères d'acceptation (PRD §10) :

- rien ne bloque l'interaction plus d'une demi-seconde — aucune transition ne
  dépasse 400 ms ;
- rien ne bouge tout seul : aucune animation en boucle, aucune animation sans
  geste. Ouvrir une séance déjà cochée n'anime rien ;
- `prefers-reduced-motion: reduce` supprime tout mouvement et l'application
  reste entièrement utilisable : les compteurs affichent leur valeur, le panneau
  s'affiche sans confettis, et il se ferme des trois mêmes façons.
````

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 19`, `# fail 0`.

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS, `# fail 0` et
`ok  github.com/billbob-space/hello-world/apps/marcq-handball`.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`.

**Les deux interdits qui se constatent**, dans un navigateur — la CI n'en a pas :

```bash
cd apps/marcq-handball && go run .
```

Sur `http://localhost:8080`, en mode téléphone :

1. Ouvrir la séance du jour, cocher toutes les cases sauf une. Rien ne se passe
   d'autre que la ligne qui se barre et la barre qui avance en rebondissant.
2. Cocher la dernière : le panneau monte, « Séance bouclée. », « **1** séance
   sur 7 » en grand, et les quatre compteurs de volume **partent de leur valeur
   d'avant** — pas de zéro — pour rouler jusqu'à la nouvelle.
3. Un tap sur « Continuer » ferme. Rouvrir la séance : rien ne rejoue.
4. Décocher puis recocher la dernière case : le panneau revient. Cette fois,
   fermer par un tap **hors de la carte**, puis recommencer et fermer par
   `Échap`. Les trois sorties fonctionnent.
5. **Deuxième interdit.** Ouvrir `#/seance/2026-08-03` entièrement cochée : à
   l'ouverture, aucun trait ne se dessine, aucune barre ne monte, aucun panneau.
   Laisser l'écran une minute sans y toucher : rien ne bouge.
6. **Premier interdit.** Outils de développement → Performances → enregistrer,
   décocher puis recocher trois lignes aussi vite que possible, arrêter. Aucune
   tâche longue, les trois taps sont enregistrés, les trois lignes suivent.
7. Terminer une séance puis, **panneau ouvert**, appuyer sur le bouton retour du
   navigateur : le panneau se ferme et l'écran du jour s'affiche. Sans l'écoute
   de `hashchange`, il resterait modal par-dessus, et comme `showModal` rend le
   reste inerte, l'application paraîtrait gelée.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/recompenses.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/web/app.js apps/marcq-handball/web/sw.js \
        apps/marcq-handball/README.md apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : le panneau de fin de seance, le moment fort"
git push
```

---

### Tâche 6 — Les confettis

**Fichiers :** Modifier `apps/marcq-handball/web/recompenses.js` · Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/recompenses.test.js`

La dernière tâche, et la première à couper. Vingt-quatre `<i>` et une règle
d'animation : aucune bibliothèque, aucun asset distant, aucun canevas à
redimensionner (ossature §2). Trois propriétés en font une décoration et non une
gêne : la couche ne reçoit aucun pointeur, elle est invisible aux lecteurs
d'écran, et elle meurt avec le panneau — c'est le `<dialog>` qui l'emporte, il
n'y a donc pas de minuterie à annuler ni de fuite possible.

La couche est enfant du `<dialog>` et non de `<body>` : un `<dialog>` ouvert par
`showModal()` est en couche supérieure, et tout ce qui est posé en dehors —
quel que soit son `z-index` — passerait **sous** le fond assombri.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/recompenses.test.js` :

```js
// Un document de substitution : Node n'en a pas, et les trois choses qui
// comptent — le nombre de grains, l'inertie de la couche, la couleur prise dans
// la feuille de style — se verifient sans navigateur.
function fauxDocument() {
  const creer = (balise) => ({
    balise,
    className: '',
    enfants: [],
    attributs: {},
    style: { valeurs: {}, setProperty(nom, valeur) { this.valeurs[nom] = valeur; } },
    append(...noeuds) { this.enfants.push(...noeuds); },
    setAttribute(nom, valeur) { this.attributs[nom] = valeur; },
  });
  return { createElement: creer };
}

test('mouvement reduit : pas un seul confetti (PRD §10)', () => {
  const hote = { append() { throw new Error('rien ne doit etre ajoute'); } };
  assert.equal(rec.lancerConfettis(hote, { reduit: true }), null);
});

test('les confettis sont une couche inerte, invisible aux lecteurs d ecran', () => {
  const doc = fauxDocument();
  const hote = doc.createElement('dialog');
  const couche = rec.lancerConfettis(hote, { doc, reduit: false, alea: () => 0.5 });

  assert.equal(hote.enfants[0], couche, 'la couche est posee DANS le dialog, pas dans body');
  assert.equal(couche.className, 'confettis');
  assert.equal(couche.attributs['aria-hidden'], 'true', 'il n y a rien a y lire');
  assert.equal(couche.enfants.length, rec.NOMBRE_CONFETTIS);
  // La couleur vient de la feuille de style : une teinte tiree au hasard produit
  // tot ou tard un confetti illisible sur fond clair.
  assert.equal(couche.enfants[0].style.valeurs['--couleur'], 'var(--marcq-confetti-3)');
  // Aucun pointeur : la couche ne peut pas intercepter un tap.
  assert.match(css, /\.confettis\s*\{[^}]*pointer-events:\s*none/);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`

Attendu : ÉCHEC, `# pass 19` et `# fail 2`, les deux sur
`error: 'rec.lancerConfettis is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/recompenses.js` :

```js
// --- les confettis ----------------------------------------------------------

// Assez pour que ca fasse quelque chose, assez peu pour qu'un telephone d'entree
// de gamme les anime sans effort : ce sont vingt-quatre elements qui ne changent
// que par transform et opacity, donc composes par le processeur graphique.
export const NOMBRE_CONFETTIS = 24;

// Pose la couche de confettis dans `hote` et la rend. Rend `null` en mouvement
// reduit, sans rien creer : le CSS suffirait a les figer, mais figer vingt-quatre
// elements est encore du travail demande a un telephone pour rien.
//
// `hote` est le <dialog> : ouvert par showModal(), il est en couche superieure,
// et une couche posee ailleurs passerait sous le fond assombri quel que soit son
// z-index. Elle meurt donc avec le panneau — aucune minuterie, aucune fuite.
export function lancerConfettis(hote, options = {}) {
  const {
    nombre = NOMBRE_CONFETTIS,
    alea = Math.random,
    reduit = mouvementReduit(),
    doc = globalThis.document,
  } = options;

  if (reduit) return null;

  const couche = doc.createElement('div');
  couche.className = 'confettis';
  couche.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < nombre; i += 1) {
    const grain = doc.createElement('i');
    grain.className = 'confetti';
    grain.style.setProperty('--x', `${Math.round(alea() * 100)}%`);
    grain.style.setProperty('--derive', `${Math.round(alea() * 160) - 80}px`);
    grain.style.setProperty('--tour', `${Math.round(alea() * 720) - 360}deg`);
    grain.style.setProperty('--retard', `${Math.round(alea() * 260)}ms`);
    grain.style.setProperty('--duree', `${900 + Math.round(alea() * 500)}ms`);
    grain.style.setProperty('--couleur', `var(--marcq-confetti-${1 + Math.floor(alea() * 4)})`);
    couche.append(grain);
  }

  hote.append(couche);
  return couche;
}
```

Dans `ouvrirPanneauDeFin`, insérer cette ligne **juste après**
`  document.body.append(panneau);` :

```js
  lancerConfettis(panneau, { reduit });
```

`reduit` est déjà calculé en tête de la fonction et déjà passé aux roulements :
une seule lecture de `matchMedia` sert tout le panneau.

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
:root {
  /* Quatre couleurs choisies, jamais une teinte tiree au hasard : le hasard
     produit tot ou tard un confetti illisible sur fond clair. */
  --marcq-confetti-1: #0b4fa8;
  --marcq-confetti-2: #f2b705;
  --marcq-confetti-3: #d94f04;
  --marcq-confetti-4: #1f9d55;
}

/* La couche ne recoit aucun pointeur : elle ne peut pas intercepter un tap,
   c'est ce qui la rend compatible avec « jamais un peage ». `overflow: hidden`
   evite qu'un grain derivant sur le cote n'elargisse la page. */
.confettis {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Seuls transform et opacity sont animes : ni l'un ni l'autre ne declenche de
   calcul de mise en page, donc vingt-quatre grains ne coutent pas une image. */
.confetti {
  position: absolute;
  inset-block-start: -14px;
  inset-inline-start: var(--x);
  width: 8px;
  height: 14px;
  border-radius: 2px;
  background: var(--couleur);
  animation: marcq-chute var(--duree, 1200ms) var(--retard, 0ms) ease-in forwards;
}

@keyframes marcq-chute {
  from { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
  to   { transform: translate3d(var(--derive), 100vh, 0) rotate(var(--tour)); opacity: .2; }
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/recompenses.test.js`  ·  Attendu :
SUCCÈS, `# pass 21`, `# fail 0`.

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS, `# fail 0`.
Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`.

**Le contrôle du troisième interdit**, celui qui ne se remplace pas :

```bash
cd apps/marcq-handball && go run .
```

1. Terminer une séance : les confettis tombent devant le panneau — **devant**,
   pas derrière le fond assombri — et sont partis en deux secondes environ.
   Pendant leur chute, le bouton « Continuer » répond au premier tap.
2. Fermer le panneau, puis dans la console : `document.querySelectorAll('.confettis').length`
   → `0`.
3. Outils de développement → **Rendering** → *Emulate CSS media feature
   `prefers-reduced-motion`* → `reduce`. Décocher puis recocher la dernière
   case : le panneau apparaît **sans confettis**, sans agrandissement, les
   compteurs de volume affichent directement leur valeur finale — et les trois
   façons de fermer marchent toujours. Cocher et décocher une ligne : elle se
   barre, la barre avance, aucun mouvement n'est visible.
4. Toujours en mouvement réduit, ouvrir chaque écran : rien n'est illisible,
   rien n'est inatteignable. C'est le sens de *« tout reste utilisable sans un
   seul mouvement »*.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/recompenses.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/tests/recompenses.test.js
git commit -m "marcq-handball : des confettis quand la seance tombe"
git push
```

La pull request vient maintenant, une fois l'ensemble cohérent.
`.github/pull_request_template.md` en donne la forme.

---

## Points d'attention

**Le PRD, lu à la lettre, se contredit sur le compteur de séances.** Le §10 dit
*« un compteur qui augmente ne saute jamais à sa valeur : il roule »* et, trois
lignes plus haut, *« l'animation est une récompense, jamais un péage »*. Le
compteur de séances augmente de un : le faire rouler ferait attendre neuf cents
millisecondes un nombre que l'enfant connaît déjà — un péage, pour rendre
lisible un trajet qui n'a rien à montrer. Ce PRP tranche : le roulement sert les
compteurs dont le trajet fait quarante ou cent, le compteur de séances arrive à
sa valeur avec un agrandissement court. Si l'arbitrage doit être rediscuté,
c'est une modification du PRD §10, pas de ce document.

**Sur Firefox, la barre ne rebondit pas.** `::-moz-progress-bar` n'anime pas sa
largeur de façon fiable ; le remplissage saute. C'est du confort perdu, pas une
régression : la valeur affichée est juste dans les deux cas, la ligne se barre
partout, et rien d'autre n'en dépend. Ne remplace pas `<progress>` par un `div`
mesuré à la main pour récupérer ce ressort — on y perdrait l'annonce native aux
lecteurs d'écran, et le PRP 04 s'appuie dessus.

**Une transition ne se déclenche jamais au premier calcul de style.** C'est ce
qui fait qu'une séance rouverte déjà cochée n'anime rien : les huit `<li>`
arrivent dans le DOM avec `.fait` déjà posé, et le navigateur ne joue pas de
transition depuis un état qui n'a jamais existé. Ne « corrige » pas ce
comportement en ajoutant la classe après le montage — ce serait précisément
créer le mouvement que le deuxième interdit du PRD §10 refuse.

**`marcq:exercice-coche` reste non consommé, et c'est un bon signe.** Le PRP 04
a posé deux points d'accroche ; celui du cochage n'est pas utilisé ici parce que
la récompense du cochage est entièrement en CSS — donc, par construction, elle
ne peut retarder aucun tap. Ne le retire pas de `vue-seance.js` : un test du
PRP 04 vérifie son nom, et le PRP 10 pourra s'en servir.

**Le PRP 10 se branchera sur le même événement, et les deux se disputeraient
l'écran.** Le ressenti de fin de séance (PRD §7.3, lot 2) écoute
`marcq:seance-complete`, exactement comme ce panneau. Deux panneaux modaux
ouverts sur le même événement, c'est un panneau invisible et un enfant coincé.
Le PRP 10 doit poser ses trois émojis **dans** `ouvrirPanneauDeFin`, entre les
compteurs et le bouton — pas ouvrir un second `<dialog>`. C'est la raison pour
laquelle le panneau est construit d'un seul tenant, avec une place évidente pour
une ligne de plus.

**Le panneau vit hors de `#ecran`, donc le routeur ne le nettoie pas.** C'est
l'écoute de `hashchange` qui le ferme, et `debrancher()` qui le ferme aussi.
Sans elle, un panneau ouvert resterait modal par-dessus l'écran des réglages —
et comme `showModal` rend le reste inerte, l'application paraîtrait gelée. Le
symptôme ne ressemble pas à un problème d'animation.

**Le bloc `prefers-reduced-motion` est universel, et il doit le rester.** Sa
position dans le fichier n'a aucun effet — `!important` gagne quel que soit
l'ordre — mais son sélecteur `*, *::before, *::after` en a un : il couvre ce que
les PRP 05, 09, 10 et 11 ajouteront sans y penser. Ne le restreins pas aux
classes de ce PRP « pour la propreté » ; un garde-fou qui ne couvre que ce qui
existait le jour où il a été écrit ne garde rien.

**Le test du ton lit la source, commentaires compris.** Écrire « pas de badge
ici » dans un commentaire de `web/recompenses.js` fait tomber le test 16. Ce
n'est pas un faux positif : ces mots entrent par la porte du commentaire, puis
passent dans une chaîne à la retouche suivante. Les discussions sur le ton vont
dans ce document, qui est un `.md`.

**`style.css` est le seul point de contact avec le PRP 05.** Les deux branches
ajoutent leur bloc à la fin du même fichier : la fusion peut demander un
arbitrage, et il se résout en **gardant les deux blocs**, dans l'ordre où ils
arrivent. Aucune règle de ce PRP n'entre en conflit avec un écran perso : les
seules classes partagées sont `.barre` et `.libelle-exercice`, posées par les
PRP 03 et 04, et ce PRP ne fait qu'y ajouter une durée.

**Ce PRP n'ajoute aucune route HTTP et ne parle à personne.** Rien ici ne lit
`X-Forwarded-User` — l'ossature §2 l'interdit, et `./init.sh --check`
(`init.sh:1444-1452`) refuse la chaîne dans tout fichier suivi de
`apps/marcq-handball/` hors `.md`. Les récompenses ne connaissent que
`localStorage`, à travers `lireFaits()`.
