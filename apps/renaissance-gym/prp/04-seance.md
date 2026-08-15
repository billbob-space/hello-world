# PRP 04 — La séance : l'écran du jour, le minuteur, le son

| | |
|---|---|
| **Lot** | 1 |
| **Dépend de** | PRP 01 (`programme.js`, `domaine.js`), PRP 02 (contrat d'écran, `etat.js`, `garderEcranAllume`) |
| **Débloque** | PRP 05 (la grille lit les faits que celui-ci produit) |
| **PRD** | §5 en entier, §7.2, §7.3, §9.1, §9.2, §11.3, §15.3 |

## Objectif

C'est l'écran qui décide du succès de l'application. Une enfant à un mètre de
son téléphone posé par terre doit savoir en une seconde quel exercice elle fait,
combien il en reste, et quand s'arrêter — sans toucher l'écran plus de dix fois
sur une séance de vingt minutes.

## Ce qui est vérifiable à la fin

- `node --test tests/chrono.test.js tests/seance.test.js tests/sonnerie.test.js`
  passe.
- Un test lit les sources de `chrono.js` et **échoue s'il existe une fonction
  publique qui réduit le temps restant** — ossature §7 point 4. Remettre à zéro
  est permis, abréger ne l'est pas.
- Un test assert qu'un exercice `mesure: 'tenue'` monte un minuteur et qu'un
  exercice `mesure: 'repetitions'` n'en monte pas : le mode vient de la donnée,
  jamais du libellé.
- Un test assert qu'aucun `.strass` n'est monté par `vue-seance.js` : le rang de
  strass est interdit pendant l'effort (ossature §5.3).
- Une séance interrompue à mi-parcours et rechargée reprend au bon exercice,
  avec les faits déjà validés conservés (PRD §9.1).

## Chantier A — `web/vue-jour.js`

Un seul écran pour les deux cas du PRD §7.2, parce que ce sont deux états du
même écran et non deux écrans.

- **Il reste des séances** : l'empiècement bleu porte « Semaine 3 » ; sous la
  couture, « Séance 2 sur 4 » en étiquette, puis **« L'équilibre »** en Archivo
  très large ; les familles listées en une ligne ; le bouton « Commencer » sur
  la moitié de la largeur, en bas.
- **Les quatre sont faites** : « Ta semaine est bouclée. » Le rang de strass
  joue son balayage une fois. Une action discrète, et discrète pour de bon,
  permet de refaire une séance : elle ne compte pas double (PRD §9.5).

L'écran ne montre **jamais** de rouge, de retard, ni de compte de ce qui n'a pas
été fait. Le PRD §14 le nomme : l'abandon est le risque principal, et rien dans
l'application ne doit y pousser.

## Chantier B — `web/chrono.js`

Pur autant qu'un minuteur peut l'être : il ne touche pas au DOM et reçoit son
horloge.

```js
export function creerChrono({ duree, horloge = Date.now, tic })
  // -> { demarrer, pause, remettreAZero, restant, etat }
export const ETATS = ['pret', 'en-cours', 'pause', 'termine'];
export function formater(ms)   // -> '0:45' | '1:00' — chiffres tabulaires
```

**Il n'existe pas de `avancer()`, pas de `sauter()`, pas de `reglerRestant()`.**
C'est l'ossature §7 point 4, et c'est un test.

Le minuteur s'appuie sur l'horloge murale et non sur un compte de `tic` : un
onglet mis en arrière-plan ralentit `setInterval`, et un gainage d'une minute
compté en tics durerait deux minutes. Le `tic` sert à rafraîchir l'affichage ;
le temps restant se recalcule à chaque fois depuis `horloge()`.

## Chantier C — `web/vue-seance.js`

Un exercice à l'écran, jamais deux. La composition, de haut en bas :

1. l'empiècement bleu, portant la progression — « 4 / 11 » et une barre de
   couture qui se remplit ;
2. sous la couture passepoilée, sur le jersey : le **libellé exact** de
   l'exercice, en Archivo 112 de large, aussi gros que la place le permet ;
3. l'objectif de la semaine, en très grand : `x16` ou le décompte du minuteur ;
4. un geste unique, en bas, sur la moitié de la largeur.

**Le geste unique change de nom, jamais de place.** « Démarrer » pour une tenue,
« C'est fait » pour des répétitions, « Suivant » après validation. Un bouton qui
se déplace entre deux exercices oblige à viser ; le téléphone est à un mètre.

Le passage d'un exercice au suivant glisse **selon l'angle de la couture** (12°),
et sous `prefers-reduced-motion` il est instantané.

**L'écran reste allumé** : `garderEcranAllume(true)` au montage,
`garderEcranAllume(false)` au démontage — y compris sur une sortie par le
bouton retour du navigateur.

À la fin : l'écran de fin de séance, la case cochée, et le badge s'il y a lieu
(PRP 05).

## Chantier D — `web/sonnerie.js`

Le son est **synthétisé**, jamais un fichier : un `.wav` de plus dans l'image
pour trois notes ne se justifie pas, et la synthèse ne dépend d'aucun décodeur.

```js
export function debloquerAudio()    // au PREMIER geste de la seance — PRD §11.3
export function bip(hauteur)        // les trois dernieres secondes
export function sonnerie()          // zero
export function estDisponible()     // -> boolean
```

**Le visuel porte toujours l'information complète** (PRD §15.3). Le son
l'ajoute ; il ne la remplace jamais. Un appareil muet, un iOS récalcitrant, un
casque débranché : la séance reste utilisable, et aucun test ne dépend du son
pour prouver qu'un exercice s'est terminé.

Les trois dernières secondes sonnent en montant, le zéro sonne plus bas et plus
long : elle est tête en bas, elle distingue deux sons, pas trois nuances.
