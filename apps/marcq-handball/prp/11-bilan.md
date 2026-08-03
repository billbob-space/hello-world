# PRP 11 — Le bilan, après le 21 août

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 3 |
| **Branche** | `marcq-handball/bilan` |
| **Dépend de** | PRP 02 (`seanceDuJour` et son cas `terminee`, `etatSeance` et son `cochable`, `progression`, `totauxAccomplis`), PRP 03 (le contrat d'écran, `ECRANS`, `rendre`, `dateEnToutesLettres`), PRP 05 (`formaterDuree`, `lignesVolume`, `ETATS`), PRP 06 (`seancesTerminees`), PRP 04 (`MOTIF_SEANCE`, `motifVerrou` — vérifiés, pas modifiés). Le chantier 4 seul dépend en plus du PRP 09 (`monterEquipe`, `datationEquipe`) |
| **Débloque** | rien — c'est la dernière feuille du graphe de l'ossature §10 |
| **Sections du PRD** | §9 (« Après le 21 août »), §6 lot 3 item 12, §10 (le ton), et par conséquence §7.5 (le volume accompli) et §8 (le programme est une donnée) |

---

> ⛔ **Verrou partiel — le chantier 4, et lui seul.** Le bloc « classement figé »
> du bilan monte `monterEquipe` du PRP 09, qui ne démarre pas avant que **la
> survie des scores à un redéploiement** soit tranchée. Le PRD §12.1 le pose ; il
> se tranche côté exploitation du serveur, hors de ce dépôt. Tant qu'il tient, le
> chantier 4 est spéculatif : il n'a rien à afficher.
>
> **Les chantiers 1, 2, 3 et 5 n'ont aucun verrou** et ne dépendent que du lot 1.
> Le bilan se livre entier sans eux : sans le lot 2, il n'y a pas de classement à
> figer, et un bilan sans classement reste un bilan complet. C'est délibéré — un
> PRP dont l'échéance est une date ne peut pas dépendre d'une décision qui n'en a
> pas.

## Objectif

Le 22 août au matin, l'application ne montre plus un programme terminé : elle
montre ce que l'enfant a fait pendant trois semaines. La bascule se produit sans
qu'un humain touche à quoi que ce soit et **sans déploiement ce jour-là** — elle
ne dépend que de `fin` dans `programme.json` et de l'horloge du téléphone.

## Ce PRP n'ajoute aucune logique de date, et c'est ce qui le rend petit

Tout est déjà modélisé, déjà testé, ailleurs :

| Ce dont le bilan a besoin | Qui l'a déjà écrit | Ce que ce PRP fait |
|---|---|---|
| Savoir que le programme est fini | `seanceDuJour(prog, aujourdhui)` rend `{ seance: null, cas: 'terminee' }` dès `aujourdhui > prog.fin` (PRP 02, tâche 5) | l'interroge, une fois, dans une fonction pure |
| Que plus rien ne soit cochable | `cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin` (PRP 02, décision 5) | **rien** — il le vérifie au chantier 5 |
| Que l'écran de séance dise pourquoi | `motifVerrou` rend `Le programme est terminé. Rien ne se coche plus.` (PRP 04) | **rien** — il le vérifie au chantier 5 |
| Que le classement soit figé | le serveur écrête `jour` à `p.Fin` et rend `409 classement-fige` sur tout envoi postérieur (PRP 07, chantiers 2 et 4) | **rien** — il l'affiche |

La date de fin n'est **jamais** écrite dans le code de ce PRP. Elle vient de
`prog.fin`, comme le PRD §8 l'exige : *« Le modifier ne doit pas demander de
toucher au code ; il doit rester réutilisable la saison suivante. »* Éditer
`programme.json` pour la saison prochaine défait la bascule tout seul — l'app
repart sur l'écran du jour, sans qu'une ligne change.

Ce PRP branche donc un écran sur un cas déjà modélisé. Il n'y a rien d'autre à y
mettre, et c'est la preuve que la découpe des dix PRP précédents était juste.

**C'est le plus petit des onze, et le seul du lot 3. Il se livre en dernier, il
ne s'oublie pas.** Son échéance n'est pas une préférence d'ordonnancement : après
le 21 août, il est trop tard par définition, et son coût — un module, un fichier
de test, cinq lignes de routeur — n'est jamais une raison de le repousser. La
date limite réelle est plus tôt que le 21 : voir le premier des points
d'attention.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/bilan.test.js` affiche `# fail 0`.
- `bascule(prog, '2026-08-21', '#/')` rend `null` — le 21 août fait encore partie
  du programme ; `bascule(prog, '2026-08-22', '#/')` rend `'#/bilan'` ;
  `bascule(prog, '2026-08-22', '#/perso')` et `bascule(prog, '2026-08-22', '#/bilan')`
  rendent `null`. La bascule ne capture que la racine, et elle ne se rappelle
  jamais elle-même.
- Programme entièrement coché au 22 août : `modeleBilan` rend `resume.seances === 7`,
  `resume.cases === 53`, `resume.pourcent === 100`, sept lignes de séance toutes
  en `statut: 'faite'`, et les phrases de volume de l'écran perso, recalculées
  depuis `programme.json` et jamais écrites dans le code. La comparaison est
  celle du PRP 05 (`tests/perso.test.js`, tâche 3), filtre compris : les phrases
  privées de celle qui se termine par `fentes` valent exactement `226 pompes`,
  `345 squats`, `105 burpees`, `210 abdos`, `24 min de gainage`,
  `3 h 55 de course` ; la ligne écartée est vérifiée par forme,
  `/^\d+ fentes$/`, parce que le total de fentes n'est verrouillé par aucune
  section du PRD — « 15 fentes par jambe » se saisit en une valeur ou en deux.
  Un `deepEqual` sur six phrases échouerait : `VOLUME` (PRP 05) porte sept
  unités et le programme contient des fentes les 3, 7 et 14 août.
- Trois séances sur sept (3, 5 et 7 août) au 22 août : `resume.phrase` vaut
  exactement `3 séances bouclées et 22 exercices cochés. Voilà ce que tu ramènes
  à la reprise.` et `resume.pourcent` vaut `42`.
- Rien de coché : `resume.phrase` vaut `PHRASE_RIEN`, `volume.montrer` vaut
  `false` — un seul message de vide, pas deux —, et **aucune** des chaînes
  affichées du modèle ne contient `manqu`, `dommage`, `seulement`, `raté`,
  `Bravo` ni `champion` — le test du ton, décrit au chantier 3.
- `choisirEcran('#/bilan').nom` vaut `'bilan'`, `choisirEcran('#/bilan/')` vaut
  `null`, et `LIENS` ne contient pas `#/bilan`.
- Dans un navigateur, `#/bilan` tapé à la main le 5 août affiche le bilan de ce
  qui est fait à ce jour, précédé de la ligne
  `Le programme n’est pas fini. Il reste 5 séances d’ici au vendredi 21 août.` ;
  deux séances y figurent — le 5 août en est une —, et celle du jour se lit
  `en cours` tant qu'elle n'est pas entièrement cochée, jamais `non faite`.
- Dans un navigateur, horloge du système avancée au 22 août : ouvrir `/` réécrit
  l'adresse en `#/bilan` sans empiler d'entrée d'historique ; `#/perso`,
  `#/reglages` et `#/seance/2026-08-03` répondent encore ; cette dernière affiche
  `Le programme est terminé. Rien ne se coche plus.` et toutes ses cases sont
  inactives.
- `./apps/marcq-handball/test.sh` est vert et `./init.sh --check` aussi.

## Périmètre

**Dedans :** `web/vue-bilan.js` en entier — la bascule pure, le modèle, les
phrases, le montage ; l'entrée `bilan` dans `ECRANS` et les cinq lignes de
bascule dans `rendre()` ; le style du bilan dans `web/style.css` ;
`/vue-bilan.js` dans la coque de `web/sw.js` ; `tests/bilan.test.js` ; une
assertion de `tests/vues.test.js` ; une section du `README.md`.

**Dehors, et pourquoi :**

- **Toute règle de date.** Elle appartient au PRP 02 et y est déjà testée. Un
  second `aujourdhui > prog.fin` écrit ici serait une seconde source de vérité,
  et la première divergence serait invisible : deux écrans en désaccord d'un jour
  sur la fin du programme.
- **Le verrouillage des cases — PRP 02 et PRP 04.** `cochable` porte déjà le
  second terme, et `motifVerrou` porte déjà la phrase. Ce PRP les vérifie et n'y
  touche pas.
- **Le calendrier des dix-neuf jours — PRP 05.** Il reste sur `#/perso`, où le
  bilan renvoie par un lien. La grille répond à *« quel jour ? »* ; le bilan
  répond à *« qu'est-ce que j'ai fait ? »*. Douze cases de repos sur un bilan
  seraient douze lignes qui ne disent rien.
- **Le calcul du rang, le podium, la jauge — PRP 07 et 09.** Le chantier 4 monte
  le bloc du PRP 09 tel quel ; il ne recalcule rien. Un rang calculé par le
  client est un rang déclaré par le client (ossature §2).
- **Toute animation — PRP 06.** Voir le chantier 3 : le bilan ne bouge pas, et
  c'est une décision du PRD §10, pas un manque de temps.
- **Le ressenti — PRP 10.** `marcq.v1.ressenti` existe et le PRP 10 autorise sa
  lecture ici — *« il peut lire `marcq.v1.ressenti` s'il le veut »* ; **ce PRP ne
  la lit pas.** Le PRD §7.3 fait du ressenti un tap unique en fin de séance, non
  obligatoire, et le PRP 10 écarte nommément son affichage par séance à
  l'enfant : *« le ressenti se dit une fois, il se lit agrégé, il ne se
  collectionne pas. »* Un bilan qui rejouerait trois semaines d'humeurs en ferait
  exactement une collection, et transformerait après coup une réponse facultative
  en note.

## Interfaces

**Consomme — exactement, sans rien redéfinir :**

```js
// web/domaine.js — PRP 02, ossature §5
seanceDuJour(prog, aujourdhui)                     // -> { seance: Seance|null, cas }
                                                   //    cas ∈ { 'aujourd-hui', 'repos', 'terminee' }
etatSeance(prog, dateISO, aujourdhui, faits = {})  // -> { statut, cochable, total, coches } | null
                                                   //    statut ∈ { 'a-venir', 'aujourd-hui',
                                                   //      'faite', 'partielle', 'manquee' }
                                                   //    'a-venir' seul est hors du bilan
progression(prog, aujourdhui, faits = {})          // -> { cochees, programmees, part }
totauxAccomplis(prog, faits = {})                  // -> { cases, pompes, squats, burpees,
                                                   //      abdos, gainage_s, min_course, fentes }

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)                       // '2026-08-21' -> 'vendredi 21 août'

// web/vue-perso.js — PRP 05
lignesVolume(totaux)                               // -> [{ unite, phrase }] ; les unites a 0 sortent
ETATS                                              // { [statut]: { libelle, marque } }, les six du domaine

// web/recompenses.js — PRP 06
seancesTerminees(prog, faits)                      // -> entier ; sans horloge

// web/vue-seance.js — PRP 04 (dans le test seulement)
MOTIF_SEANCE                                       // /^#\/seance\/(\d{4}-…)$/
motifVerrou({ dateISO, aujourdhui, fin })          // -> phrase | null
```

Le **contrat d'écran** du PRP 03 s'applique sans amendement :
`ctx = { prog, aujourdhui, prenom, faits, route, aller(route), rafraichir() }` ;
`hote` est vidé par le routeur avant chaque montage ; un écran ne mute jamais
`ctx` ; un écran n'en monte jamais un autre — il pose un `<a href="#/…">`.

Jetons et classes de `web/style.css` réutilisés, jamais redéfinis :
`--marcq-encre`, `--marcq-encre-douce`, `--marcq-fond`, `--marcq-carte`,
`--marcq-accent`, `--marcq-sur-accent`, `--marcq-trait`, `--marcq-tap`,
`.ecran`, `.titre-ecran`, `.titre-bloc`, `.aide`, `.barre`, `.bouton`,
`.liste-volume`, `.item-volume`, `.lu-seul`, `.jour-faite`, `.jour-aujourd-hui`,
`.jour-partielle`, `.jour-manquee`.

**Produit :**

```js
// web/vue-bilan.js
export const ROUTE_BILAN = '#/bilan';
export const MOTIF_BILAN = /^#\/bilan$/;
export const MOTIF_RACINE = /^(#\/?)?$/;
export const TITRE_BILAN = 'Ton bilan';
export const PHRASE_RIEN = 'Aucune case cochée sur cette période. Le programme reste là, séance par séance, si tu veux le relire.';
export const PHRASE_VOLUME_VIDE = 'Rien à additionner cette fois.';
export const TEXTE_DETAIL = 'Voir le détail jour par jour';
// Les quatre statuts que `etatSeance` peut rendre sur une seance dont la date
// est <= aujourdhui, et eux seuls : 'a-venir' est impossible ici, le filtre de
// `modeleBilan` l'ecarte. Une cle manquante donnerait `undefined` a l'ecran.
export const LIBELLES_BILAN = {
  'faite': 'faite',
  'aujourd-hui': 'en cours',
  'partielle': 'commencée',
  'manquee': 'non faite',
};

// La bascule. Pure : aucune horloge, aucun DOM. Rend ROUTE_BILAN si — et
// seulement si — la route est la racine ET seanceDuJour rend 'terminee'.
export function bascule(prog, aujourdhui, route)   // -> ROUTE_BILAN | null

export function phraseBilan({ seances, cases })    // -> string
export function ligneSeance(prog, seance, aujourdhui, faits)   // -> LigneSeance
export function modeleBilan(ctx)                   // -> ModeleBilan
export function monterBilan(hote, ctx)             // l'ecran, au contrat du PRP 03
```

```js
// LigneSeance — une séance du programme, telle que le bilan la dit
{
  date: '2026-08-07',
  dateLisible: 'vendredi 7 août',
  titre: 'Autre sport + Renforcement',  // seance.titre, tel quel : le PRP 02 le rend obligatoire
  statut: 'partielle',                  // le mot du DOMAINE :
                                        // 'faite' | 'aujourd-hui' | 'partielle' | 'manquee'
  libelle: 'commencée',                 // le mot de l'ÉCRAN : LIBELLES_BILAN[statut]
  marque: '½',                          // ETATS[statut].marque — la forme double la couleur
  coches: 4,
  total: 6,
  detail: '4 exercices sur 6',          // null quand rien n'est coché : 'manquee'
                                        // toujours, 'aujourd-hui' tant que coches vaut 0
  href: '#/seance/2026-08-07',
  nom: 'vendredi 7 août · Autre sport + Renforcement · commencée · 4 exercices sur 6',
}
```

```js
// ModeleBilan — tout ce que le montage doit savoir, et rien de plus
{
  titre: 'Ton bilan',
  periode: 'du lundi 3 août au vendredi 21 août',
  enCours: false,                       // aujourdhui <= prog.fin
  avis: null,                           // une phrase, uniquement quand enCours vaut true
  resume: { seances, seancesTotal, cases, casesTotal, pourcent, echelle, phrase },
  volume: { lignes: [{ unite, phrase }], vide: string | null, montrer: boolean },
  seances: [LigneSeance, …],            // les seances DEJA programmees, dans l'ordre des dates
  detail: { texte: TEXTE_DETAIL, href: '#/perso' },
}
```

```
route  #/bilan          une entree dans ECRANS, inseree AVANT l'entree `jour`
                        AUCUNE entree dans LIENS
```

**Ce que ce PRP élargit chez le PRP 09** — une seule signature, rétrocompatible :

```js
// web/vue-equipe.js — PRP 09, TROISIEME parametre ajoute, optionnel
export function datationEquipe(instantane, aujourdhui, fin = null)
// fin !== null && instantane.jour >= fin
//   -> `Classement arrêté le ${dateEnToutesLettres(instantane.jour)}.`
// instantane.jour === aujourdhui
//   -> `Classement de ${dateEnToutesLettres(instantane.jour)}.`          (inchange)
// sinon
//   -> `Classement de ${dateEnToutesLettres(instantane.jour)} — pas encore actualisé aujourd’hui.`  (inchange)
```

`modeleEquipe` passe `ctx.prog.fin` en troisième argument. Sans cette ligne, le
22 août l'écran d'équipe annoncerait `Classement de vendredi 21 août — pas encore
actualisé aujourd’hui.` : faux, et inquiétant. Le classement **est** actualisé ;
il est arrêté, ce qui n'est pas la même chose. Le paramètre est optionnel et vaut
`null` par défaut, donc les deux assertions de `tests/equipe.test.js` restent
vertes sans être touchées.

**Les noms introduits ici, absents de `00-ossature.md` et des PRP amont :**

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/vue-bilan.js` | L'écran `#/bilan`, un module comme les cinq autres. Le serveur sert tout `web/` à la racine depuis `//go:embed web` (ossature §7) et la route `GET /vue-*.js` existe déjà : le fichier arrive sans une ligne de Go. |
| `tests/bilan.test.js` | Un fichier par PRP, comme `seance.test.js`, `perso.test.js` et `equipe.test.js` : deux branches parallèles fusionnent sans conflit. |
| `bascule` | La seule fonction de ce PRP que `app.js` importe pour décider quelque chose. Elle est **pure** et prend `aujourdhui` en paramètre : c'est ce qui rend la bascule prouvable par `node --test`, un mois avant la date où elle compte. |
| `MOTIF_RACINE` | Le motif de l'adresse sans ancre — aujourd'hui écrit en clair dans l'entrée `jour` d'`ECRANS` (PRP 03). Il devient une constante nommée et **`ECRANS` s'y réfère**, parce que la bascule doit capturer exactement ce que l'entrée `jour` capture. Deux copies du même motif divergeraient au premier ajustement, et l'écart serait muet : le bilan ne prendrait pas la main sur une adresse sans ancre, c'est-à-dire sur le lien que les enfants ont reçu. |
| `LIBELLES_BILAN` | Les quatre mots que le bilan emploie — les quatre statuts qu'`etatSeance` peut rendre sur une séance déjà programmée —, là où `ETATS` (PRP 05) en emploie six pour le calendrier. Deux écarts : `manquee` → **`non faite`** et `aujourd’hui` → **`en cours`**, et ils portent tout le chantier 3 : le domaine constate, l'écran ne reproche pas. Les marques restent celles d'`ETATS` — une seule source pour ce qui se dessine. |
| `phraseBilan`, `PHRASE_RIEN` | La phrase de tête, exportée et pure, donc épinglée au mot près par un test — comme `PHRASE_RASSURANTE` (PRP 03) et `CONSENTEMENT` (PRP 08). Le ton est une décision produit ; une reformulation bien intentionnée doit faire tomber un test. |
| `ligneSeance` | Ce qu'une séance dit sur le bilan. Exportée séparément de `modeleBilan` pour que les quatre statuts se testent un par un, sans fabriquer un programme entier par cas. |
| `enCours` et `avis` | Ce qui rend `#/bilan` ouvrable **avant** le 22 août. Voir le chantier 1 : une route qui n'existerait qu'à partir d'une date ne pourrait être essayée qu'à une date où il est trop tard pour la corriger. |

## Fichiers

- **Créer :** `apps/marcq-handball/web/vue-bilan.js`,
  `apps/marcq-handball/tests/bilan.test.js`
- **Modifier :** `apps/marcq-handball/web/app.js` (un import, une entrée dans
  `ECRANS`, le motif de l'entrée `jour`, les cinq lignes de bascule dans
  `rendre`), `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/sw.js` (une ligne de coque),
  `apps/marcq-handball/tests/vues.test.js` (l'assertion sur la liste d'`ECRANS`),
  `apps/marcq-handball/README.md`
- **Modifier, chantier 4 seulement :** `apps/marcq-handball/web/vue-equipe.js`
  (`datationEquipe` et son appel dans `modeleEquipe`)
- **Ne pas modifier :** `apps/marcq-handball/web/domaine.js`,
  `apps/marcq-handball/web/vue-seance.js`,
  `apps/marcq-handball/tests/domaine.test.js`,
  `apps/marcq-handball/tests/seance.test.js` — le chantier 5 les lit, il ne les
  écrit pas. Si l'un d'eux doit changer, c'est que la règle de date était fausse
  avant ce PRP, et la correction appartient au PRP qui la porte.
- **Tester :** `apps/marcq-handball/tests/bilan.test.js`,
  `apps/marcq-handball/tests/vues.test.js`, plus les deux contrôles à la main du
  chantier 1 (bascule à l'horloge avancée) et du chantier 5 (écran de séance
  verrouillé) — la CI n'a pas de navigateur.

---

# Ce qu'il faut construire

## Chantier 1 — La bascule : cinq lignes dans le routeur, et pas une date

**Ce qu'il fait.** Il fait qu'ouvrir le lien reçu au mois d'août mène au bilan
une fois le programme fini. PRD §9 : *« L'application bascule sur l'écran de
bilan. […] Une app qui reste bloquée sur un programme terminé meurt en silence le
22. »*

**La fonction, entière.**

```js
export const ROUTE_BILAN = '#/bilan';
export const MOTIF_BILAN = /^#\/bilan$/;
// Le motif de l'adresse sans ancre. `ECRANS` l'utilise pour son entree `jour`,
// et la bascule pour savoir ce qu'elle capture : une seule source.
export const MOTIF_RACINE = /^(#\/?)?$/;

// Rend ROUTE_BILAN quand la racine doit mener au bilan, null sinon. Aucune
// comparaison de date ici : `seanceDuJour` (PRP 02) porte deja la regle, et
// `aujourdhui` est un parametre — c'est ce qui rend la bascule testable un mois
// avant la date ou elle compte.
export function bascule(prog, aujourdhui, route) {
  if (!MOTIF_RACINE.test(route)) return null;
  return seanceDuJour(prog, aujourdhui).cas === 'terminee' ? ROUTE_BILAN : null;
}
```

**Seule la racine bascule.** `#/perso`, `#/reglages`, `#/seance/<date>` et, si le
lot 2 est livré, `#/rejoindre` et `#/coach` continuent de répondre. Le PRD §9 dit
que *l'application* bascule, pas qu'elle ferme : après le 21 août on doit encore
pouvoir corriger un prénom, relire une séance et changer d'enfant. La règle la
plus étroite qui satisfasse le §9 est celle-ci, et c'est celle qu'on prend.

**Où, dans `rendre()`.** Juste après `rendreNavigation(ctx)` — donc après que
`ctx.route` a été relu — et **avant** `const ecran = choisirEcran(ctx.route)` :

```js
  // PRD §9 : passe prog.fin, la racine mene au bilan. `replaceState` n'empile
  // pas d'entree — sinon le bouton retour du telephone rejouerait la racine, qui
  // rebasculerait aussitot. Il ne declenche pas `hashchange`, d'ou l'appel
  // direct ; il se termine, `bascule` rendant null sur '#/bilan'.
  const versLeBilan = bascule(ctx.prog, ctx.aujourdhui, ctx.route);
  if (versLeBilan !== null) {
    history.replaceState(null, '', versLeBilan);
    rendre(hote, ctx);
    return;
  }
```

C'est **exactement** le motif déjà employé par le routeur pour une route inconnue
(PRP 03), y compris la récursion à un pas et sa terminaison. Le placer avant
`choisirEcran` est obligatoire : le PRP 10 remonte cet appel au-dessus du verrou
de prénom, et une entrée d'écran calculée puis rendue caduque par la réécriture
serait un bogue silencieux.

**La route est honorée à toute date, et ce n'est pas un détail.** `#/bilan` tapé
le 5 août affiche le bilan de ce qui est fait à ce jour, précédé d'une ligne qui
dit que ce n'est pas fini. Une route qui n'existerait qu'à partir du 22 août ne
pourrait être essayée pour la première fois que le 22 août — c'est-à-dire le jour
où il est trop tard pour la corriger. C'est aussi le seul moyen de faire relire
cet écran par un humain avant qu'il ne serve.

**`modeleJour` garde son cas `terminee`, et il ne devient pas mort.** Le PRP 03 y
affiche `Programme terminé`. Un téléphone dont le service worker sert encore une
coque antérieure à ce PRP n'a pas la bascule : c'est lui qui verra cette page. La
retirer transformerait ce cas en écran vide. Ses six assertions de
`tests/vues.test.js` restent donc en place, inchangées.

**`LIENS` ne bouge pas.** Pas d'onglet « Bilan ». Deux raisons : `rendreNavigation`
ne connaît ni le programme ni la date, et lui apprendre à faire apparaître un
onglet un jour donné remettrait une seconde règle de date dans le routeur — ce
que tout ce PRP s'emploie à éviter ; et un onglet posé dès le 3 août serait un
lien vers un écran vide pendant dix-neuf jours. Le bilan se rejoint par l'onglet
« Aujourd'hui », qui est celui qu'on tape pour savoir où on en est.

**L'entrée d'écran.** `ECRANS` reçoit
`{ nom: 'bilan', motif: MOTIF_BILAN, monter: monterBilan }`, inséré **avant**
l'entrée `jour` comme toute route spécifique, et l'entrée `jour` échange son motif
littéral contre `MOTIF_RACINE`.

**Critère d'acceptation.** `tests/bilan.test.js` couvre les quatre appels de
`bascule` listés en tête de document, plus `bascule(prog, '2026-08-22', '')` et
`bascule(prog, '2026-08-22', '#')` qui rendent tous deux `ROUTE_BILAN`.
`tests/vues.test.js` : `choisirEcran('#/bilan').nom` vaut `'bilan'`,
`choisirEcran('#/bilan/')` vaut `null`, la liste `ECRANS.map((e) => e.nom)` gagne
`'bilan'` immédiatement avant `'jour'`, et `LIENS` ne contient aucun `href` valant
`ROUTE_BILAN`. Un test lit `web/app.js` et échoue si la chaîne `MOTIF_RACINE` n'y
apparaît pas deux fois — une pour l'entrée `jour`, une pour l'import — parce que
c'est précisément la copie oubliée qui rendrait la bascule inopérante sur
l'adresse sans ancre.

À la main, horloge du système avancée au 22 août : ouvrir `http://localhost:8080/`
réécrit l'adresse en `#/bilan` ; le bouton retour du navigateur ne rejoue pas la
racine ; `#/perso` et `#/reglages` répondent.

---

## Chantier 2 — Ce que le bilan raconte : le modèle

**Ce qu'il fait.** Il calcule tout ce que l'écran affiche, sans DOM et sans
horloge. Même coupure qu'aux PRP 04, 05 et 09 : ce qui **décide** est ici et se
prouve par `node --test` ; le montage, au chantier 3, n'ajoute aucune décision,
pas même un `Math.max` de garde.

**Les trois choses que le PRD §9 demande de montrer** — *« chacun voit ce qu'il a
accompli sur les trois semaines »* — et rien de plus : ce qui a été fait, le
volume, et les séances.

### Le résumé

```js
// progression() et non totauxPrescrits() : apres prog.fin les deux donnent 53,
// mais avant, seul le premier respecte le PRD §9 — « pas sur le total du
// programme, sinon tout le monde est a 15 % le 5 aout ». Le bilan ouvert en
// avance reste donc juste, sans un seul cas particulier.
const p = progression(prog, aujourdhui, faits);
resume = {
  seances: seancesTerminees(prog, faits),   // PRP 06 : sans horloge, donc sans fuseau
  seancesTotal: prog.seances.length,
  cases: p.cochees,
  casesTotal: p.programmees,
  pourcent: Math.round(p.part * 100),
  echelle: Math.max(1, p.programmees),      // <progress max="0"> est invalide
  phrase: phraseBilan({ seances, cases }),
};
```

`seancesTerminees` est importée, pas réécrite : le jour où « une séance faite »
changerait de définition, deux copies divergeraient et l'écart de fin d'été
serait invisible.

### Les séances

`modeleBilan` liste les séances **déjà programmées** — `s.date <= aujourdhui` —
dans l'ordre des dates. Après le 21 août, c'est-à-dire dans le seul cas qui
compte, ce sont les sept. Avant, c'est le même filtre que le dénominateur du
§9 : on ne met pas sur un bilan une séance dont le jour n'est pas venu.

**Le `<=` inclut la séance du jour, et c'est délibéré :** `progression` compte
elle aussi `seance.date <= aujourdhui` (PRP 02, `if (seance.date > aujourdhui)
continue`). Un `<` ici mettrait sur le même écran un dénominateur qui compte la
séance du jour et une liste qui ne la montre pas. La conséquence à tenir est
qu'`etatSeance` rend alors `'aujourd-hui'` — son test `dateISO === aujourdhui`
précède `partielle` et `manquee` (PRP 02, tâche 4) — dès que la séance du jour
n'est pas entièrement cochée. Ce statut est donc dans `LIBELLES_BILAN` comme les
trois autres ; c'est exactement la clé qui manquerait sans ce paragraphe, et son
absence ne se verrait qu'à l'écran, en `undefined`.

```js
export function ligneSeance(prog, seance, aujourdhui, faits) {
  const { statut, coches, total } = etatSeance(prog, seance.date, aujourdhui, faits);
  // …
}
// statut vient du DOMAINE et ne prend, sur une seance dont la date est <=
// aujourdhui, que quatre valeurs — 'a-venir' est ecarte par le filtre :
//   'faite'       -> detail = `${total} exercices`       ex. '8 exercices'
//   'aujourd-hui' -> detail = coches > 0
//                      ? `${coches} exercices sur ${total}`
//                      : null                            ex. '2 exercices sur 8'
//   'partielle'   -> detail = `${coches} exercices sur ${total}`  ex. '4 exercices sur 6'
//   'manquee'     -> detail = null
// libelle = LIBELLES_BILAN[statut] ; marque = ETATS[statut].marque
// titre   = seance.titre, tel quel. Aucun repli : `chargerProgramme` refuse deja
//           un titre absent ou vide (PRP 02), donc un `??` ici serait du code
//           mort qui laisserait croire que le champ est facultatif.
// href    = `#/seance/${seance.date}` — toujours, y compris sur une seance non
//           faite : la relire est le seul geste qui reste, et le verrouiller
//           serait punir apres coup.
// nom     = `${dateLisible} · ${titre} · ${libelle}` + ` · ${detail}` si detail
//           existe. C'est le texte `.lu-seul` du PRP 05, meme role, meme forme.
```

**`detail` vaut `null` dès que rien n'est coché, et c'est le choix de ton du
chantier 3, pris ici.** `0 exercices sur 6` est un reproche chiffré ; l'absence
de chiffre est un fait. La ligne reste présente, datée, titrée, avec sa marque et
son lien : rien n'est caché, rien n'est compté. La règle vaut pour `'manquee'`,
où `coches` est nul par définition, et pour `'aujourd-hui'` tant que la séance du
jour n'a pas été entamée — écrire `0 exercices sur 8` à quelqu'un dont la journée
n'est pas finie serait le même reproche, un jour trop tôt. Dès la première case,
`'en cours'` reprend le compte : `2 exercices sur 8` dit ce qui est fait.

### La période, et le cas « pas encore fini »

```js
periode: `du ${dateEnToutesLettres(prog.debut)} au ${dateEnToutesLettres(prog.fin)}`,
enCours: aujourdhui <= prog.fin,
avis:
  // enCours === false                       -> null
  // enCours && il reste des seances a venir -> `Le programme n’est pas fini. Il reste
  //    ${n} séance${s} d’ici au ${dateEnToutesLettres(prog.fin)}.`
  // enCours && plus aucune seance a venir   -> `Le programme se termine le
  //    ${dateEnToutesLettres(prog.fin)}. Plus aucune séance d’ici là.`
```

Le second cas couvre les 18, 19, 20 et 21 août — quatre jours pendant lesquels le
programme n'est pas fini mais n'a plus rien à proposer. C'est exactement le piège
que le PRP 03 a déjà rencontré sur `{ seance: null, cas: 'repos' }` ; il se
présente ici sous une autre forme, et une phrase unique mentirait quatre jours
d'affilée.

### Le volume

```js
const lignes = lignesVolume(totauxAccomplis(prog, faits));   // PRP 05, telle quelle
volume: {
  lignes,
  // PHRASE_VOLUME_VIDE ne sert QUE dans un cas : des cases cochees, mais aucune
  // qui porte un volume mesurable — un exercice en `unite: autre` coche seul
  // (ossature §4). Quand rien n'est coche du tout, `vide` reste null et le bloc
  // n'est pas monte : PHRASE_RIEN a deja tout dit, et deux messages de vide
  // empiles sont exactement le ton que le chantier 3 refuse.
  vide: lignes.length === 0 && p.cochees > 0 ? PHRASE_VOLUME_VIDE : null,
  montrer: lignes.length > 0 || vide !== null,
}
```

`montrer` est dans le modèle et non dans le montage : « si la liste est vide et
qu'aucune case n'est cochée, alors n'affiche rien » est une règle, et une règle
posée dans le montage est hors de portée de `node --test`.

`totauxAccomplis`, jamais `totauxPrescrits` : le bilan additionne ce qui a été
coché. Afficher le prescrit reviendrait à féliciter quelqu'un pour le programme
qu'un autre a écrit — c'est la formulation du PRP 05, et elle vaut deux fois plus
ici. `lignesVolume` est importée et non recopiée : les phrases du bilan sont mot
pour mot celles de `#/perso`, ce qui interdit à un enfant de lire deux chiffres
différents pour la même chose sur deux écrans.

**Critère d'acceptation.** `tests/bilan.test.js`, sur `programme.json` et des
`faits` construits depuis lui — jamais depuis une liste d'identifiants recopiée :
les quatre assertions chiffrées de « Ce qui est vérifiable à la fin » ; les
quatre `detail` de `ligneSeance`, dont les deux formes d'`'aujourd-hui'` — `null`
sans rien de coché, `2 exercices sur 8` avec deux cases ;
`modeleBilan(contexte('2026-08-05')).seances.length`
vaut `2` et `modeleBilan(contexte('2026-08-22')).seances.length` vaut `7` ;
sur ce contexte du 5 août, la dernière ligne — le 5 août est un jour de séance —
porte `statut: 'aujourd-hui'` et `libelle: 'en cours'`, et
`Object.keys(LIBELLES_BILAN)` contient chacun des `statut` rendus par les
`seances` des deux modèles, ce qui fait tomber le test le jour où le domaine
gagnerait un statut de plus ;
`avis` vaut `null` au 22 août, la phrase « il reste 5 séances » au 5 août, et la
phrase « plus aucune séance d'ici là » au 20 août ; chaque `href` satisfait
`MOTIF_SEANCE`, de sorte que le bilan ne peut pas mener à une route que le routeur
ignore ; `echelle` vaut `1` sur un contexte au 2 août, où `programmees` vaut `0` ;
`volume.montrer` vaut `false` sans rien de coché, `true` sur un unique exercice en
`unite: autre` coché, et `volume.vide` porte alors `PHRASE_VOLUME_VIDE`.

---

## Chantier 3 — Le ton, et le montage qui ne le trahit pas

**Ce qu'il fait.** Il écrit les phrases, puis les pose dans le DOM. Le PRD §10
fixe la règle : *« Le ton est direct et tutoie, sans infantiliser des joueurs de
13-14 ans : ils sont en U15, pas à l'école des poussins. Pas de mascotte, pas de
badge à collectionner, pas de vocabulaire de coach américain. »*

**La règle de ce PRP, en une phrase : le bilan raconte ce qui a été fait, il ne
compte pas ce qui a manqué.** Un enfant qui a fait trois séances sur sept doit
avoir envie de lire cet écran. Trois séances, c'est trois séances de plus que
zéro, et c'est le seul cadrage qui soit à la fois vrai et lisible.

### La phrase de tête

```js
export const PHRASE_RIEN = 'Aucune case cochée sur cette période. Le programme reste là, séance par séance, si tu veux le relire.';

export function phraseBilan({ seances, cases })
// cases === 0                -> PHRASE_RIEN
// seances === 0 && cases > 0 -> `${cases} exercice${s} coché${s}. Voilà ce que tu ramènes à la reprise.`
// seances > 0                -> `${seances} séance${s} bouclée${s} et ${cases} exercice${s} coché${s}. Voilà ce que tu ramènes à la reprise.`
```

Quatre sorties à épingler au caractère près dans le test :

| Entrée | Sortie |
|---|---|
| `{ seances: 3, cases: 22 }` | `3 séances bouclées et 22 exercices cochés. Voilà ce que tu ramènes à la reprise.` |
| `{ seances: 1, cases: 8 }` | `1 séance bouclée et 8 exercices cochés. Voilà ce que tu ramènes à la reprise.` |
| `{ seances: 0, cases: 1 }` | `1 exercice coché. Voilà ce que tu ramènes à la reprise.` |
| `{ seances: 0, cases: 0 }` | `PHRASE_RIEN` |

**Le cas du milieu n'est pas une coquetterie.** Quelqu'un qui a coché douze cases
sans jamais finir une séance ne doit pas lire « 0 séance bouclée » : le zéro est
la seule information de la phrase, et elle est fausse — il s'est entraîné. On
compte alors ce qu'il a fait, pas ce qu'il n'a pas terminé.

### Trois formulations justes, trois fausses

**Justes :**

1. `3 séances bouclées et 22 exercices cochés. Voilà ce que tu ramènes à la reprise.`
   — un fait, un chiffre, et une projection vers la suite. Aucun dénominateur.
2. `Autre sport + Renforcement — commencée — 4 exercices sur 6.`
   — un dénominateur, mais sur ce qui a été fait : « 4 exercices » d'abord, le
   cadre ensuite. Le sens de lecture change tout, et le mot est « commencée »,
   jamais « inachevée ».
3. `Aucune case cochée sur cette période. Le programme reste là, séance par séance, si tu veux le relire.`
   — le pire cas, dit sans commentaire, et suivi de la seule chose utile qui
   reste : l'écran est encore là.

**Fausses :**

1. `Tu n’as fait que 3 séances sur 7.`
   — « ne… que » et le dénominateur transforment un fait en reproche. C'est la
   même donnée que la formulation juste n° 1 et ça ne se lit pas pareil.
2. `Dommage, tu as manqué 4 séances. On fait mieux l’an prochain !`
   — compte l'absent, sermonne, et promet un examen de rattrapage. Le coach
   n'a demandé aucune des trois.
3. `Bravo champion, 3 séances, tu es un vrai guerrier ! 🏆`
   — mascotte, badge et vocabulaire de coach américain : les trois interdits du
   PRD §10 dans une seule phrase.

Ces exemples ne sont pas décoratifs : le test du ton les encode. Chacune des
trois fausses contient une sous-chaîne que le test refuse.

### Le test du ton

```js
// Les chaines que l'enfant LIT, et elles seules. `statut` n'en fait pas partie :
// il porte le mot du domaine — 'manquee' — qui pilote la classe CSS et
// n'apparait jamais a l'ecran. C'est toute la raison d'etre de LIBELLES_BILAN.
const dites = (m) => [m.titre, m.periode, m.avis, m.resume.phrase, m.volume.vide,
  ...m.volume.lignes.map((l) => l.phrase),
  ...m.seances.flatMap((s) => [s.libelle, s.detail, s.nom])].filter((x) => x != null);
// Aucune de ces chaines ne contient, quelle que soit la casse :
//   manqu · dommage · seulement · raté · bravo · champion · guerrier
```

Le test tourne sur **trois** modèles — programme entier coché, trois séances sur
sept, rien du tout — parce que c'est le troisième qui est le plus exposé et le
seul qu'on n'aura jamais sous les yeux pendant le développement.

Un second contrôle lit la source de `web/vue-bilan.js` et échoue si elle contient
`mascotte`, `badge`, `🏆`, `🎉` ou `confetti` — commentaires compris, comme les
tests de pureté des PRP 02 et 05. `web/recompenses.js` est importé pour
`seancesTerminees` uniquement : `lancerConfettis` et `rouler` ne sont **pas**
appelés ici.

### Le montage, et pourquoi rien ne bouge

**Aucune animation sur cet écran.** Le PRD §10 le fonde : *« l'animation est une
récompense, jamais un péage : elle vient après l'action »*. Sur le bilan, rien ne
vient de se produire — la dernière case a été cochée il y a des jours. Un
compteur qui roule à l'arrivée sur la page ferait attendre pour lire, ce que le
même §10 interdit (*« rien qui bloque l'interaction pendant plus d'une
demi-seconde »*). Conséquence pratique : ce PRP n'importe ni `rouler` ni
`mouvementReduit`, et n'ajoute aucune règle `prefers-reduced-motion` — il n'a rien
à en protéger.

**La structure, exactement :**

```
<section class="ecran ecran-bilan">
  <h1 class="titre-ecran">Ton bilan</h1>
  <p class="periode-bilan">du lundi 3 août au vendredi 21 août</p>
  <p class="avis-bilan">…</p>                    ← seulement si avis !== null
  <div class="resume-bilan">
    <p class="chiffre-bilan">42 %</p>
    <p class="progression-bilan"><progress class="barre" max="53" value="22"></progress></p>
    <p class="phrase-bilan">3 séances bouclées et 22 exercices cochés. Voilà ce que tu ramènes à la reprise.</p>
  </div>
  <section class="volume-bilan">                 ← seulement si volume.montrer
    <h2 class="titre-bloc">Ce que tu as accumulé</h2>
    <ul class="liste-volume"><li class="item-volume" data-unite="pompes">112 pompes</li>…</ul>
  </section>
  <section class="seances-bilan">
    <h2 class="titre-bloc">Tes séances</h2>
    <ul class="liste-seances">
      <li class="ligne-seance">
        <a class="lien-seance jour-partielle" href="#/seance/2026-08-07">
          <span class="marque-seance" aria-hidden="true">½</span>
          <span class="texte-seance" aria-hidden="true">Autre sport + Renforcement</span>
          <span class="detail-seance" aria-hidden="true">4 exercices sur 6</span>
          <span class="lu-seul">vendredi 7 août · Autre sport + Renforcement · commencée · 4 exercices sur 6</span>
        </a>
      </li>
    </ul>
  </section>
  <a class="bouton" href="#/perso">Voir le détail jour par jour</a>
</section>
```

**Les règles que ce montage applique**, toutes déjà en vigueur ailleurs :
`textContent` et jamais `innerHTML` — `programme.json` est une donnée éditée à la
main, un chevron dans un titre casserait la page ; une zone de tap d'au moins
44 px sur chaque ligne de séance et sur le lien final (PRD §11) ; la marque
double la couleur, pour qui lit au soleil ou distingue mal le rouge du vert ; et
`monterBilan` ne rend **rien** — aucun écouteur ne déborde de `hote`, que le
routeur vide avant chaque montage.

**Critère d'acceptation.** `tests/bilan.test.js` : les quatre sorties de
`phraseBilan` au caractère près ; le test du ton sur les trois modèles ; le
contrôle de source ; l'absence de `innerHTML` dans `web/vue-bilan.js` ; et le
contrôle « toute classe posée par l'écran existe dans `style.css` », repris tel
quel de `tests/perso.test.js` (PRP 05, tâche 4), la liste des classes construites
par gabarit étant ici `jour-faite`, `jour-aujourd-hui`, `jour-partielle`,
`jour-manquee` et `barre` — une par clé de `LIBELLES_BILAN`, puisque
`lien-seance jour-${statut}` les pose toutes les quatre.

---

## Chantier 4 — Le classement figé, si le lot 2 existe

> Ce chantier **ne s'exécute que si le PRP 09 est fusionné**. Sinon il est
> intégralement sauté : le bilan ne perd rien, il n'a simplement pas de bloc
> d'équipe, et les chantiers 1, 2, 3 et 5 se livrent tels quels. C'est le seul
> point de ce PRP qui dépend du verrou du PRD §12.1.

**Ce qu'il fait.** Il monte le bloc d'équipe du PRP 09 dans le bilan. **Il
n'implémente aucun gel** : le gel est acquis depuis le PRP 07, et à deux endroits
distincts, tous deux côté serveur —

- `jour` est écrêté à `p.Fin` avant tout calcul, donc le dénominateur vaut les 53
  cases et ne bouge plus (PRP 07, chantier 2) ;
- tout envoi postérieur à `prog.Fin` rend `409 classement-fige`, ce qui ferme la
  seule route d'écriture pour toute la durée de vie restante de l'application
  (PRP 07, chantiers 4 et 5).

Le classement affiché après le 21 août est donc constant par construction, pas
par un cas particulier d'affichage. Ce PRP n'a rien à ajouter — sauf une phrase.

**Le montage.** Dans `monterBilan`, après le bloc des séances et avant le lien
vers `#/perso` :

```js
const equipe = document.createElement('section');
equipe.className = 'bloc-equipe';
const demonterEquipe = monterEquipe(equipe, ctx);
section.append(equipe);
// monterBilan rend alors demonterEquipe : l'ecouteur de EVT_CLASSEMENT vit sur
// `document`, que le routeur ne vide pas. Sans ce retour, aller et venir entre
// #/bilan et #/perso empilerait un ecouteur par visite.
```

`monterActionClassement` (PRP 08) n'est **pas** appelé ici. Le bouton
« Apparaître au classement » proposerait de rejoindre un classement fermé : la
requête partirait, le serveur rendrait `409 classement-fige`, et l'enfant lirait
un message d'erreur pour un geste que l'écran venait de lui proposer. Le bilan
montre le classement, il n'y fait plus entrer personne. Le bloc reste, lui, sur
`#/perso`, où il continue d'expliquer la situation.

**La datation, seule chose à corriger.** `datationEquipe` gagne son troisième
paramètre, décrit dans les Interfaces. Sans lui, le 22 août l'écran annoncerait
`Classement de vendredi 21 août — pas encore actualisé aujourd’hui.`, ce qui
invite à réessayer une actualisation qui ne changera plus jamais rien. La
formulation retenue, `Classement arrêté le vendredi 21 août.`, dit à la fois la
date et le fait que c'est la dernière.

**Ce qui continue de fonctionner sans rien faire :** `synchroniser` (PRP 08)
appelle `relever()` — un `GET`, jamais refusé — quand rien n'est à envoyer, et
`envoiNecessaire` reste faux tant qu'aucune case ne bouge, ce qui est le cas par
définition après le 21 août. Aucun `POST` ne part donc spontanément, et le `409`
ne se présente que si quelqu'un force la main. Hors ligne, la ligne d'état du
PRP 08 dit déjà `Pas de réseau.` et l'instantané mis en cache s'affiche.

**Critère d'acceptation.** `tests/equipe.test.js` gagne trois assertions :
`datationEquipe(inst, '2026-08-22', '2026-08-21')` rend
`Classement arrêté le vendredi 21 août.` ; les deux appels à deux arguments
rendent les phrases d'origine, inchangées. `tests/bilan.test.js` lit
`web/vue-bilan.js` et échoue si `monterActionClassement` y apparaît. À la main,
en ligne, horloge avancée au 22 août : `#/bilan` affiche podium, position et
jauge, la ligne de datation porte `arrêté`, et l'onglet Réseau ne montre aucun
`POST /api/classement`.

---

## Chantier 5 — Plus rien n'est cochable : vérifier, ne pas réimplémenter

**Ce qu'il fait.** Il prouve que la règle du PRD §9 — *« Le classement est figé,
plus rien n'est cochable »* — est déjà tenue, et il l'écrit une fois pour toutes
là où quelqu'un ira la chercher. **Aucune ligne de code de production n'est
écrite dans ce chantier.**

**La règle, telle qu'elle est écrite au PRP 02, et à reprendre telle quelle :**

```js
const cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin;
```

Le second terme est le gel. Il vient du PRD §9 et il prime sur l'ossature §5, qui
n'écrit que le premier — l'en-tête de l'ossature le prévoit : *« En cas de
désaccord, le PRD gagne et ce fichier est corrigé. »* Le PRP 02 a déjà tranché,
et son test `apres la fin du programme, plus rien n est cochable (PRD §9)` affirme
que le 21 août est encore dedans et que le 22 ne l'est plus.

**Ce que ce chantier ajoute :** rien au code, deux vérifications au parcours de
relecture, et une conséquence à nommer.

1. **`tests/domaine.test.js` et `tests/seance.test.js` couvrent déjà tout.**
   L'agent les **relit** et confirme la présence des trois assertions —
   `etatSeance(prog, '2026-08-03', '2026-08-22').cochable === false`,
   `modeleSeance(contexte('2026-08-22'), '2026-08-03').motif === 'Le programme est terminé. Rien ne se coche plus.'`,
   et l'invariant `motif === null si et seulement si cochable` balayé sur les sept
   séances et les quatre dates dont le 22 août. Si l'une manque, elle est ajoutée
   **dans le PRP qui la porte**, sur sa propre branche, pas ici.
2. **Le contrôle à la main.** Horloge avancée au 22 août, `#/seance/2026-08-03` :
   toutes les cases sont `disabled`, la phrase `Le programme est terminé. Rien ne
   se coche plus.` s'affiche, et la séance reste entièrement lisible — on vient y
   relire ce qu'on a fait.

**La conséquence à nommer, parce qu'elle se déduit et ne se voit pas.** Plus
aucune case ne peut être cochée, donc `EVT_SEANCE_COMPLETE` (PRP 04) ne peut plus
être émis. Le panneau de fin de séance et ses confettis (PRP 06) ne peuvent donc
plus s'ouvrir, et la question du ressenti (PRP 10) ne peut plus être posée. Ce
n'est ni un bogue ni un oubli : c'est la conséquence directe et souhaitable du
gel. Personne n'a à ajouter de garde dans `recompenses.js` ni dans `ressenti.js`,
et c'est écrit ici pour qu'aucun relecteur ne s'inquiète d'un chemin mort.

**Critère d'acceptation.** Les deux vérifications ci-dessus sont faites et
consignées dans le message de commit du chantier. `tests/bilan.test.js` porte une
assertion croisée, qui échoue si quelqu'un desserre la règle sans le vouloir :

```js
// Le bilan et le verrou de cochage disent la meme chose du meme jour. Le jour ou
// l'un des deux glisserait d'une journee, ce test tombe — et il tombe des le 21
// aout, pas apres.
for (const jour of ['2026-08-20', '2026-08-21', '2026-08-22', '2026-09-01']) {
  const auBilan = bascule(prog, jour, '#/') !== null;
  const cochable = etatSeance(prog, '2026-08-03', jour, {}).cochable;
  assert.equal(auBilan, !cochable, `le ${jour}`);
}
```

---

## Ce qui reste à trancher avant d'exécuter

| Question | Qui tranche | Ce qui bouge selon la réponse |
|---|---|---|
| **Un volume persistant existe-t-il, sur quel chemin, inscriptible par l'uid 10001 ?** (PRD §12.1) — la question du PRP 07, reprise telle quelle, et le seul verrou de ce document | l'exploitation du serveur | Le **chantier 4 seul**. « Non » ⇒ pas de lot 2, donc pas de classement à figer, et le bilan se livre sans son bloc d'équipe. Les chantiers 1, 2, 3 et 5 sont indépendants de cette réponse |
| **Le PRP 09 sera-t-il fusionné avant ce PRP ?** | l'ordonnancement des branches, une fois le verrou levé | Si oui, le chantier 4 s'exécute. Si non, il est sauté et se reprend plus tard : il tient en un `<section>`, un appel et une signature élargie, sur une branche `marcq-handball/bilan-equipe` qui ne touche à rien d'autre |
| **Page 3 sur 3 de la note du coach** (PRD §12.3) | le coach, avant le 17 août | **Rien dans ce code.** `programme.json` gagne des séances, la liste du bilan et les dénominateurs suivent, les identifiants déjà cochés restent valides. C'est la propriété que le PRD §8 exige, et ce PRP est l'endroit où elle se vérifie le mieux : aucun des sept nombres, aucune des sept dates n'est écrite ici |

## Points d'attention

**La bascule ne demande pas de déploiement le 22 août, mais elle en demande un
avant.** Le code doit être en ligne, et surtout **dans le cache du service worker
de chaque téléphone**, avant la date de bascule. Or la coque est servie
`cache-first` et le cache ne se renouvelle qu'à un changement de `VERSION`,
c'est-à-dire à une publication d'image (ossature §8). Il faut donc, entre le
déploiement et le 22 août, **au moins une ouverture de l'application avec du
réseau** pour que le nouveau `app.js` remplace l'ancien. Conséquence pratique :
ce PRP se livre **plusieurs jours avant le 21 août**, pas le 20 au soir. Un
téléphone qui n'aurait pas eu cette ouverture verra la page `Programme terminé`
de `modeleJour` — dégradée, mais pas cassée, et c'est exactement pourquoi ce cas
reste dans le code.

**Après la bascule, aucun onglet ne porte `aria-current`.** `#/bilan` n'est pas
dans `LIENS`, et `rendreNavigation` marque l'onglet dont le `href` égale
`ctx.route`. C'est accepté : l'alternative — ajouter `#/bilan` aux onglets —
poserait un lien vers un écran vide pendant les dix-neuf jours du programme. Ne
« corrige » pas ce point en marquant l'onglet « Aujourd'hui » à la main : ce
serait une seconde règle de date dans le routeur.

**`ETATS` fournit la marque, `LIBELLES_BILAN` fournit le mot.** La tentation est
de n'importer que `ETATS` et d'utiliser son `libelle` : trois caractères de moins,
et les mots « manquée » et « aujourd’hui » reviennent à l'écran — le premier
reproche, le second date une ligne déjà datée. C'est le seul endroit du
chantier 3 qui se défait par simplification, et le test du ton est là pour ça —
mais il ne protège que les chaînes de `dites()`, alors relis-le si tu en ajoutes
une. La tentation inverse coûte plus cher : un `LIBELLES_BILAN` plus court que la
liste des statuts rendus par `etatSeance` sort `undefined` à l'écran, en silence,
et seulement les jours de séance. C'est ce que vérifie l'assertion sur
`Object.keys(LIBELLES_BILAN)` du chantier 2.

**`statut` reste le mot du domaine, y compris dans les classes CSS.**
`jour-manquee` est réutilisée depuis `#/perso` et ne s'affiche pas ; la renommer
dupliquerait une règle de style pour une raison de vocabulaire qui ne concerne
que le texte. Le domaine constate, la feuille de style dessine, seul l'écran
parle.

**`MOTIF_RACINE` doit remplacer le motif littéral dans `ECRANS`, pas le
doubler.** Si l'entrée `jour` garde `/^(#\/?)?$/` en clair et que `bascule` lit
`MOTIF_RACINE`, tout marche — jusqu'au jour où l'un des deux change. L'écart est
alors muet dans un sens exactement : la bascule ne prend plus la main sur
l'adresse sans ancre, c'est-à-dire sur le lien que les enfants ont reçu dans le
groupe de l'équipe, et sur lui seul. Personne ne le verra en testant `#/bilan`.

**Le bilan ouvert avant la fin n'est pas un mode de secours, c'est le seul moyen
de le relire à temps.** Ne le referme pas derrière une condition de date « pour
faire propre » : un écran dont la première exécution réelle est le jour où il
compte est un écran non testé.

**La saison prochaine défait la bascule toute seule.** Changer `debut` et `fin`
dans `programme.json` suffit : `seanceDuJour` ne rend plus `terminee`, la racine
cesse de basculer, et `#/bilan` reste honorée à toute date — elle affiche alors
le bilan du programme **actuellement chargé**, c'est-à-dire celui de la saison
qui commence. Le bilan de l'été précédent, lui, n'est pas conservé :
`modeleBilan` recalcule tout depuis `ctx.prog`, et le PRD §6 range
« Historique multi-saisons, comptes durables » hors périmètre. Rien à supprimer,
rien à rééditer — c'est l'exigence du PRD §8, vérifiée par le seul écran qui
aurait pu la trahir.

**`./init.sh --check` refuse la chaîne `x-forwarded-user` dans tout fichier suivi
de `apps/marcq-handball/` hors `.md`** (`init.sh:1444-1452`). Aucun fichier de ce
PRP ne la contient, et n'écris pas non plus dans un commentaire qu'on ne la lit
pas : le garde-fou cherche une sous-chaîne et ne fait pas la différence. Ce
document-ci est un `.md`, il a le droit de la nommer ; `vue-bilan.js` ne l'a pas.

**Les accents vont dans ce que l'enfant lit, pas dans le code.** Les libellés, les
phrases et les noms de mois portent leurs accents ; les commentaires, les noms de
fonctions, de variables et de tests restent en ASCII. C'est la convention des
PRP 01, 04 et 05, et les messages de commit la suivent aussi.

**Le PRD ne se contredit pas sur ce périmètre.** Un point mérite d'être signalé :
le §9 demande que *« chacun voie ce qu'il a accompli »* et le §6 lot 3 parle d'un
*« récapitulatif de ce qui a été accompli »*, tandis que la lecture naturelle d'un
bilan de programme serait un bilan « fait / pas fait ». Les deux formulations du
PRD emploient le même mot — **accompli** — et jamais son contraire. Le chantier 3
en tire la règle de ton, et la liste des séances reste factuelle sans la
contredire : une séance non faite est affichée, datée et relisable, mais elle
n'est comptée nulle part.
