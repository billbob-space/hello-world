# PRP 04 — Cocher une séance, et le rattrapage

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/seance` |
| **Dépend de** | PRP 01 (coque, serveur, `sw.js`), PRP 02 (`programme.json`, `domaine.js`), **PRP 03** (le contrat d'écran, `etat.js`, `app.js`, `vue-jour.js`, le style) |
| **Débloque** | PRP 05 (perso), PRP 06 (récompenses), PRP 10 (ressenti) |
| **Sections du PRD** | §7.3, §9 (le passé se corrige / l'avenir ne se coche pas), §6 lot 1 items 3, 4 et 6 |

## Objectif

Un tap coche un exercice, l'écrit dans `localStorage` avant de rendre la main, et
fait avancer la progression de la séance — sur n'importe quelle séance passée,
sur aucune séance à venir.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/seance.test.js` affiche
  `# pass 22` et `# fail 0`.
- `node --test tests/vues.test.js` reste vert : `choisirEcran('#/seance/2026-08-03')`
  rend désormais l'écran `seance` là où le PRP 03 attendait `null`.
- `./apps/marcq-handball/test.sh` est vert, et `./init.sh --check` aussi.
- Dans un navigateur, sur `#/seance/2026-08-03` : les 8 exercices sont là,
  groupés en « Course » et « Renforcement » avec « 2 tours · repos 1 min 30
  entre les tours » ; un tap barre la ligne et le compte passe à « 1 / 8 » ;
  **F5 la garde barrée** ; un second tap la débarre sans le moindre dialogue.
- Sur `#/seance/2026-08-17` avant le 17 août : les 8 lignes sont lisibles, les
  cases inactives, la phrase « Séance à venir. Elle s’ouvrira lundi 17 août. »
  s'affiche et le cadre de la liste passe en pointillés.
- `document.addEventListener('marcq:exercice-coche', console.log)` dans la
  console affiche un événement à chaque tap, et `marcq:seance-complete` quand la
  dernière case tombe — c'est par là que le PRP 06 se branche.

## Périmètre

**Dedans :** `web/vue-seance.js` en entier — le modèle pur puis le montage DOM ;
le style de l'écran dans `web/style.css` ; l'entrée `seance` dans `ECRANS`
(`web/app.js`) ; `/vue-seance.js` dans la coque de `web/sw.js` ; la mise à jour
des deux assertions que le PRP 03 a laissées en attente dans
`tests/vues.test.js` ; `tests/seance.test.js` ; une section du `README.md`.

**Dehors, et pourquoi :**
- **`web/etat.js` — PRP 03 en entier.** Il expose déjà `lireFaits`, `cocher` et
  `decocher`, testés chez lui. Ce PRP est le premier à les *appeler*, il n'en
  écrit pas une ligne.
- **L'écriture du lien depuis l'écran du jour — PRP 03.** `modeleJour` rend déjà
  `lien: { texte, href: '#/seance/<date>' }`. Ce PRP se contente de vérifier que
  cette route est bien celle qu'il enregistre.
- **Les animations de récompense — PRP 06.** Ici, la ligne se barre et le
  `<progress>` avance, rien de plus. Ce PRP pose les deux points d'accroche pour
  que le PRP 06 n'ait pas une ligne de cette vue à récrire.
- **Le ressenti de fin de séance — PRP 10**, lot 2. Il se branche sur
  `marcq:seance-complete`.
- **L'écran perso, le volume cumulé, le calendrier — PRP 05.** Le rattrapage
  passe ici par les deux séances voisines, pas par un calendrier.
- **Le réseau — PRP 07.** Rien de ce PRP ne parle au serveur.

## Interfaces

**Consomme :**

```js
// web/domaine.js — PRP 02, ossature §5
etatSeance(prog, dateISO, aujourdhui, faits = {})  // -> { statut, cochable, total, coches } | null
// cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin   (PRP 02, decision 5)

// web/etat.js — PRP 03. cocher et decocher RENDENT LES FAITS A JOUR.
cocher(id, quand = new Date().toISOString())  // -> { [id]: isoString }
decocher(id)                                  // -> { [id]: isoString }

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)   // '2026-08-03' -> 'lundi 3 août'
modeleJour(ctx)                // -> { …, lien: { texte, href: '#/seance/<date>' } | null }

// web/app.js — PRP 03
export const ECRANS = [{ nom, motif, monter }, …]   // le premier motif qui correspond gagne
export function choisirEcran(route)
```

Le **contrat d'écran** du PRP 03, que ce PRP applique sans le modifier :

```js
// Un ecran est une fonction (hote, ctx) => demontage | undefined.
// `hote` est <main id="ecran">, VIDE par le routeur avant chaque montage :
// les ecouteurs poses dedans disparaissent avec lui, il n'y a rien a demonter.
// La valeur rendue ne sert qu'a ce qui deborde de `hote` — ce n'est pas le cas ici.
ctx = {
  prog,          // le Programme gele
  aujourdhui,    // 'YYYY-MM-DD' en Europe/Paris, calcule UNE SEULE FOIS par app.js
  prenom,        // string
  faits,         // { [id]: isoString } relu depuis le stockage a chaque rendu
  route,         // '#/seance/2026-08-03'
  aller(route),  // navigue
  rafraichir(),  // remonte l'ecran courant
}
// Regle 1 : un ecran ne mute JAMAIS ctx. Il ecrit par etat.js et met sa ligne
//           a jour sur place.
// Regle 2 : un ecran n'en monte jamais un autre. Il pose un <a href="#/…">.
```

```
Jetons et classes de web/style.css — PRP 03
  --marcq-encre --marcq-encre-douce --marcq-fond --marcq-carte --marcq-accent
  --marcq-sur-accent --marcq-danger --marcq-trait --marcq-tap (48px)
  .ecran  .titre-ecran  .titre-bloc  .barre (un <progress>)  .compte  .lien-nav
```

**Produit :**

```js
// web/vue-seance.js
export const MOTIF_SEANCE = /^#\/seance\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/;
export const EVT_COCHAGE = 'marcq:exercice-coche';
export const EVT_SEANCE_COMPLETE = 'marcq:seance-complete';
export function dateDeLaRoute(route)          // '#/seance/2026-08-03' -> '2026-08-03' | null
export function dateCourte(dateISO)           // '2026-08-03' -> '3 août'
export function titreBloc(bloc)               // -> bloc.titre, sinon 'Course' | 'Renforcement'
export function sousTitreBloc(bloc)           // -> '2 tours · repos 1 min 30 entre les tours' | ''
export function motifVerrou({ dateISO, aujourdhui, fin })   // -> string | null
export function voisines(prog, dateISO)       // -> { precedente: dateISO|null, suivante: dateISO|null }
export function modeleSeance(ctx, dateISO)    // -> ModeleSeance | null
export function basculerFait(faits, id, quand = new Date().toISOString())   // -> les faits A JOUR
export function monterSeance(hote, ctx)       // l'ecran, au contrat du PRP 03
```

```js
// ModeleSeance — tout ce que le montage doit savoir, et rien de plus
{
  date, titre, semaine,          // recopies de la seance
  dateLisible,                   // 'lundi 3 août'
  cochable,                      // du domaine
  motif,                         // null si cochable, sinon la phrase a afficher
  statut,                        // du domaine : 'a-venir' 'aujourd-hui' 'faite' 'partielle' 'manquee'
  total, coches, part,           // part = coches / total, dans [0,1]
  blocs: [ { titre, sousTitre, exercices: [ { id, libelle, fait } ] } ],
}
```

```
Les deux evenements d'accroche — CustomEvent, bubbles: true, emis sur la section
marcq:exercice-coche     detail { id, fait, coches, total, part, ligne }   // `ligne` = le <li>
marcq:seance-complete    detail { date, total }                            // a la TRANSITION seulement
```

**Quatre noms que ni l'ossature ni les PRP amont ne fixent — ils sont définis
ici et les PRP aval s'y tiennent :**

1. **`MOTIF_SEANCE` et `dateDeLaRoute`.** Le PRP 03 réserve la route
   `#/seance/<YYYY-MM-DD>` sans la définir. L'expression rationnelle vit dans
   `vue-seance.js` et non dans `app.js` : c'est l'écran qui sait lire sa propre
   route, et `app.js` se contente d'une ligne dans `ECRANS`. Le mois et le jour
   y sont bornés — un fragment forgé comme `#/seance/2026-13-45` n'atteint alors
   jamais le rendu, qui n'a pas à se défendre d'une date impossible.
2. **`apps/marcq-handball/tests/seance.test.js`.** `tests/vues.test.js` (PRP 03)
   porte les modèles des écrans de l'entrée ; l'écran de séance a le sien, parce
   que deux branches parallèles qui écrivent chacune dans son fichier fusionnent
   sans conflit. Seules les **deux assertions** que le PRP 03 a explicitement
   laissées en attente sont modifiées chez lui.
3. **Les classes CSS de l'écran** : `.ecran-seance` `.seance-verrouillee`
   `.date-seance` `.progression-seance` `.verrou-seance` `.bloc-seance`
   `.tours-bloc` `.exercices` `.exercice` `.exercice.fait` `.ligne-exercice`
   `.case-exercice` `.libelle-exercice` `.voisines` `.lien-voisine`
   `.vers-suivante`. Les titres réutilisent `.titre-ecran` et `.titre-bloc`, la
   progression réutilise `.barre` et `.compte`, la ligne d'explication `.aide` :
   une classe existante vaut mieux qu'une jumelle. `.salutation` n'est **pas**
   reprise pour la ligne de date — elle nomme un accueil, pas un sur-titre, et
   une classe qui ment coûte plus cher qu'une classe de plus.
4. **`data-exercice`** sur la case à cocher et **`data-seance`** sur la
   section — les deux attributs par lesquels le PRP 06 retrouve une ligne sans
   connaître la structure du DOM.

## Fichiers

- Créer : `apps/marcq-handball/web/vue-seance.js`,
  `apps/marcq-handball/tests/seance.test.js`
- Modifier : `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/tests/vues.test.js` (deux assertions),
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/seance.test.js`,
  `apps/marcq-handball/tests/vues.test.js`, plus le contrôle à la main dans un
  navigateur à la tâche 5 — la CI n'en a pas, et une liste qui ne se pose pas
  correctement à l'écran ne se voit qu'à l'écran.

## La coupure qui structure ce PRP

`vue-seance.js` reprend la coupure que le PRP 03 a posée avec
`modeleJour` / `monterJour`, et c'est ce qui rend l'écran testable sans
navigateur :

- **le modèle** — `modeleSeance` et ses aides. Fonctions pures : mêmes entrées,
  mêmes sorties, aucun DOM. **Toutes** les décisions y sont — quels blocs, quels
  libellés, quelle case est cochée, si l'écran est fermé et avec quelle phrase.
- **le montage** — `monterSeance`. Il pose le modèle dans le DOM et n'y ajoute
  **aucune** décision. Ce qui n'est pas prouvable en CI est ainsi réduit à de
  l'assemblage d'éléments.

Un montage qui déciderait quoi que ce soit — « si la date est passée alors… » —
serait une règle métier hors de portée des tests. Elle est toujours dans le
modèle.

## La convention d'écriture, rappelée

**Les accents vont dans ce que l'enfant lit, pas dans le code** (PRP 01). Les
libellés et les phrases affichées portent leurs accents ; les commentaires, les
noms de fonctions et de variables restent en ASCII.

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/seance
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`. Les tâches s'exécutent **dans l'ordre** : chaque tâche ajoute à
`vue-seance.js` ce que la suivante utilise.

---

### Tâche 1 — Les libellés que le coach a écrits

**Fichiers :** Créer `apps/marcq-handball/tests/seance.test.js` · Créer `apps/marcq-handball/web/vue-seance.js`

PRD §7.3 : *« Les exercices sont groupés comme le coach les a écrits : Course,
puis Renforcement, avec le nombre de tours affiché. »* Trois libellés en
découlent, et ce sont trois fonctions pures.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/seance.test.js` :

```js
// L'ecran de seance, prouve sans navigateur.
//
// Tout ce qui DECIDE quelque chose est dans le modele, donc teste ici. Ce qui
// reste — poser le modele dans le DOM — se verifie a la main, une fois, a la
// tache 5 : la CI n'a pas de navigateur et n'en aura pas, l'app n'ayant aucune
// dependance (ossature §2).
//
// L'import est un import d'espace de noms — `import * as vue` — et non des
// imports nommes : un export encore absent devient alors `undefined` et donne un
// TypeError sur l'appel, la ou un import nomme ferait echouer le CHARGEMENT du
// fichier entier et masquerait les tests deja verts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/domaine.js';
import * as vue from '../web/vue-seance.js';

const prog = chargerProgramme(JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
));

const seanceDu = (date) => prog.seances.find((s) => s.date === date);

test('un bloc porte le nom que le coach lui a donne', () => {
  const [course, renforcement] = seanceDu('2026-08-03').blocs;
  assert.equal(vue.titreBloc(course), 'Course');
  assert.equal(vue.titreBloc(renforcement), 'Renforcement');
  // Un seul bloc du programme porte un titre a lui : le vendredi 7 aout, ou le
  // coach a ecrit « 30 a 40 minutes d'un autre sport » sans le ranger sous
  // « Course » (PRP 02, decision 2).
  assert.equal(vue.titreBloc(seanceDu('2026-08-07').blocs[0]), 'Autre sport');
});

test('le nombre de tours est affiche, jamais « 1 tour » (PRD §7.3)', () => {
  const [course, renforcement] = seanceDu('2026-08-03').blocs;
  assert.equal(vue.sousTitreBloc(course), '', 'un bloc a un tour n a rien a annoncer');
  assert.equal(vue.sousTitreBloc(renforcement), '2 tours · repos 1 min 30 entre les tours');
  // Les six autres seances n'ont pas de repos ecrit : le sous-titre s'arrete aux tours.
  assert.equal(vue.sousTitreBloc(seanceDu('2026-08-10').blocs[1]), '4 tours');
});

test('la date courte retire le jour de semaine, elle ne le recalcule pas', () => {
  assert.equal(vue.dateCourte('2026-08-05'), '5 août');
  assert.equal(vue.dateCourte('2026-08-01'), '1er août');
  assert.equal(vue.dateCourte('2026-08-17'), '17 août');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 0` et `# fail 1` — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../apps/marcq-handball/web/vue-seance.js' imported from .../apps/marcq-handball/tests/seance.test.js`

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/vue-seance.js` :

```js
// vue-seance.js — l'ecran de seance : la LISTE COMPLETE des exercices.
//
// Pas un exercice a la fois : a 13 ans on veut savoir ce qui reste avant de
// commencer (PRD §7.3). Le module reprend la coupure du PRP 03 :
//   - le modele, pur, qui prend toutes les decisions et que node --test prouve ;
//   - le montage, qui pose ce modele dans le DOM et n'y ajoute aucune decision.

import { dateEnToutesLettres } from './vue-jour.js';

// --- les libelles -----------------------------------------------------------

// « lundi 3 août » -> « 3 août ». Le jour de semaine se retire, la table des
// mois ne se recopie pas : une seconde table divergerait a la premiere retouche
// du calendrier, et c'est exactement le genre d'ecart qu'aucun test ne montre.
export function dateCourte(dateISO) {
  return dateEnToutesLettres(dateISO).replace(/^\S+\s/, '');
}

// Le coach a nomme ses blocs « Course » et « Renforcement » ; un seul bloc du
// programme porte un titre a lui (PRP 02, decision 2).
export function titreBloc(bloc) {
  return bloc.titre ?? (bloc.type === 'course' ? 'Course' : 'Renforcement');
}

// Le nombre de tours est affiche (PRD §7.3) — mais pas « 1 tour », qui
// n'apprend rien et alourdirait l'en-tete de chacun des sept blocs de course.
export function sousTitreBloc(bloc) {
  const morceaux = [];
  if (bloc.tours > 1) morceaux.push(`${bloc.tours} tours`);
  if (bloc.repos) morceaux.push(`repos ${bloc.repos}`);
  return morceaux.join(' · ');
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 3`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : les libelles de bloc et de date de l'ecran de seance"
git push
```

---

### Tâche 2 — Le modèle : ce qui reste à faire, et pourquoi c'est fermé

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

PRD §9 : *« Une séance à venir est visible — on peut lire ce qui arrive — mais
ses cases sont inactives. »* Le verrou vient du domaine ; ce qui s'ajoute ici est
la **phrase qui dit pourquoi**. Sur un téléphone il n'y a pas de survol pour
aller chercher l'explication (ossature §9) : un grisement muet laisserait
l'enfant taper trois fois avant de comprendre.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
// Le contexte du contrat d'ecran (PRP 03), reduit a ce que le modele lit.
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

const T = '2026-08-03T18:22:11.000Z';

test('la liste est complete, groupee comme le coach l a ecrite (PRD §7.3)', () => {
  const m = vue.modeleSeance(contexte('2026-08-03'), '2026-08-03');
  assert.equal(m.titre, 'Endurance + Renforcement');
  assert.equal(m.semaine, 1);
  assert.equal(m.dateLisible, 'lundi 3 août');
  assert.deepEqual(m.blocs.map((b) => b.titre), ['Course', 'Renforcement']);
  assert.deepEqual(m.blocs.map((b) => b.exercices.length), [2, 6]);
  assert.equal(m.total, 8, 'les huit cases sont la avant de commencer');
  assert.equal(m.blocs[1].exercices[0].id, 's1-r1');
  assert.equal(m.blocs[1].exercices[0].libelle, '15 pompes');
});

test('la progression de la seance se lit en direct', () => {
  const m = vue.modeleSeance(contexte('2026-08-05', { 's1-r1': T, 's1-r2': T }), '2026-08-03');
  assert.equal(m.coches, 2);
  assert.equal(m.total, 8);
  assert.equal(m.part, 0.25);
  assert.deepEqual(m.blocs[1].exercices.map((e) => e.fait), [true, true, false, false, false, false]);
  assert.deepEqual(m.blocs[0].exercices.map((e) => e.fait), [false, false]);
});

test('l avenir ne se coche pas, et l ecran dit pourquoi (PRD §9)', () => {
  const m = vue.modeleSeance(contexte('2026-08-10'), '2026-08-12');
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Séance à venir. Elle s’ouvrira mercredi 12 août.');
  assert.equal(m.total, 7, 'elle reste entierement lisible : on vient lire ce qui arrive');
});

test('le passe se rattrape jusqu a la fin du programme (PRD §9)', () => {
  for (const jour of ['2026-08-03', '2026-08-10', '2026-08-21']) {
    const m = vue.modeleSeance(contexte(jour), '2026-08-03');
    assert.equal(m.cochable, true, `le 3 aout se coche encore le ${jour}`);
    assert.equal(m.motif, null);
  }
});

test('apres le 21 aout, plus rien ne se coche (PRD §9)', () => {
  const m = vue.modeleSeance(contexte('2026-08-22'), '2026-08-03');
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Le programme est terminé. Rien ne se coche plus.');
});

test('le verrou et son motif disent toujours la meme chose', () => {
  // L'invariant qui compte : une case fermee sans phrase, ou une phrase sur un
  // ecran ouvert, sont deux facons de mentir a l'enfant.
  for (const seance of prog.seances) {
    for (const jour of ['2026-08-01', '2026-08-10', '2026-08-21', '2026-08-22']) {
      const m = vue.modeleSeance(contexte(jour), seance.date);
      assert.equal(m.motif === null, m.cochable, `${seance.date} vu le ${jour}`);
    }
  }
});

test('un jour sans seance n a pas de modele', () => {
  assert.equal(vue.modeleSeance(contexte('2026-08-10'), '2026-08-04'), null);
  assert.equal(vue.modeleSeance(contexte('2026-08-10'), null), null);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 3` et `# fail 7`, chacun sur
`error: 'vue.modeleSeance is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Compléter les imports en tête de `apps/marcq-handball/web/vue-seance.js` :

```js
import { etatSeance } from './domaine.js';
```

Ajouter sous `sousTitreBloc` :

```js
// --- le modele --------------------------------------------------------------

// Pourquoi les cases sont inactives. Rend null quand elles ne le sont pas :
// l'appelant n'a alors rien a afficher, et l'invariant « motif === null si et
// seulement si cochable » se lit d'un coup d'oeil ici.
export function motifVerrou({ dateISO, aujourdhui, fin }) {
  if (aujourdhui > fin) return 'Le programme est terminé. Rien ne se coche plus.';
  if (dateISO > aujourdhui) return `Séance à venir. Elle s’ouvrira ${dateEnToutesLettres(dateISO)}.`;
  return null;
}

// Tout ce que le montage doit savoir, et rien de plus. Pur : memes entrees,
// memes sorties, aucun DOM, aucune horloge — `ctx.aujourdhui` est calcule une
// seule fois par app.js (PRP 03). Rend null si aucune seance n'a lieu ce jour-la.
export function modeleSeance(ctx, dateISO) {
  const { prog, aujourdhui, faits = {} } = ctx;
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (!seance) return null;

  const etat = etatSeance(prog, dateISO, aujourdhui, faits);

  return {
    date: seance.date,
    titre: seance.titre,
    semaine: seance.semaine,
    dateLisible: dateEnToutesLettres(seance.date),
    cochable: etat.cochable,
    motif: motifVerrou({ dateISO, aujourdhui, fin: prog.fin }),
    statut: etat.statut,
    total: etat.total,
    coches: etat.coches,
    // La part de CETTE seance, pas celle du rang : le denominateur du
    // classement est `progression()` du domaine, calcule sur ce qui est
    // programme a ce jour (PRD §9). Confondre les deux ferait afficher 100 %
    // des la premiere seance finie.
    part: etat.total === 0 ? 0 : etat.coches / etat.total,
    blocs: seance.blocs.map((bloc) => ({
      titre: titreBloc(bloc),
      sousTitre: sousTitreBloc(bloc),
      exercices: bloc.exercices.map((ex) => ({
        id: ex.id,
        libelle: ex.libelle,
        fait: Object.prototype.hasOwnProperty.call(faits, ex.id),
      })),
    })),
  };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 10`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : le modele de seance, et pourquoi une case est fermee"
git push
```

---

### Tâche 3 — Le rattrapage, d'une séance à l'autre

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

PRD §6, lot 1, point 4 : *« toute séance passée reste librement cochable et
décochable »*. Encore faut-il pouvoir l'atteindre. Le calendrier des sept
séances est l'écran perso (PRP 05) ; d'ici là, l'écran du jour ne mène qu'à la
séance **du jour**. Sans ces deux liens, une séance oubliée ne serait joignable
qu'en tapant son URL à la main — et le rattrapage serait une promesse du PRD
sans chemin dans l'app.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
test('chaque seance connait ses deux voisines', () => {
  assert.deepEqual(vue.voisines(prog, '2026-08-14'), {
    precedente: '2026-08-12',
    suivante: '2026-08-17',
  });
  // Depuis un jour de repos aussi : les voisines sont les seances qui
  // l'encadrent, ce qui rendra le calendrier du PRP 05 navigable sans cas
  // particulier.
  assert.deepEqual(vue.voisines(prog, '2026-08-04'), {
    precedente: '2026-08-03',
    suivante: '2026-08-05',
  });
});

test('les bords du programme n inventent pas de voisine', () => {
  assert.deepEqual(vue.voisines(prog, '2026-08-03'), { precedente: null, suivante: '2026-08-05' });
  assert.deepEqual(vue.voisines(prog, '2026-08-17'), { precedente: '2026-08-14', suivante: null });
  assert.deepEqual(vue.voisines(prog, '2026-08-21'), { precedente: '2026-08-17', suivante: null });
  assert.deepEqual(vue.voisines(prog, '2026-08-01'), { precedente: null, suivante: '2026-08-03' });
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 10` et `# fail 2`, chacun sur
`error: 'vue.voisines is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/vue-seance.js`, sous `modeleSeance` :

```js
// Les deux seances qui encadrent une date, qu'elle porte une seance ou non.
// `chargerProgramme` valide les seances strictement croissantes : la derniere
// anterieure et la premiere posterieure sont bien les deux voisines.
export function voisines(prog, dateISO) {
  const dates = prog.seances.map((s) => s.date);
  return {
    precedente: dates.filter((d) => d < dateISO).at(-1) ?? null,
    suivante: dates.find((d) => d > dateISO) ?? null,
  };
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 12`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : d'une seance a l'autre, le chemin du rattrapage"
git push
```

---

### Tâche 4 — Un tap, une écriture

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

C'est le geste central de l'app, et le seul endroit où cet écran touche à
l'état. Il est isolé dans une fonction pour une raison : la promesse *« un ado
qui ferme l'onglet entre deux séries ne doit rien perdre »* (PRD §6, lot 1,
point 6) se vérifie alors en CI, plutôt que dans un gestionnaire d'événement que
seul un navigateur peut déclencher.

`basculerFait` **rend** les faits à jour et n'en mute aucun : la règle 1 du
contrat d'écran interdit de toucher à `ctx`, et `cocher`/`decocher` du PRP 03
rendent déjà l'objet relu depuis le stockage. C'est lui qui fait foi — pas une
copie tenue en mémoire par la vue.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
// Node n'expose `localStorage` que derriere un drapeau. Le double est ecrit ici
// plutot qu'importe de tests/etat.test.js : y toucher pour l'exporter
// modifierait le fichier d'un autre PRP sans rien gagner, et douze lignes se
// relisent plus vite qu'une dependance entre fichiers de test.
function poserMagasin() {
  const donnees = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      get length() { return donnees.size; },
      key(i) { return [...donnees.keys()][i] ?? null; },
      getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
      setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
      removeItem(cle) { donnees.delete(cle); },
    },
  });
  return donnees;
}

test('un tap ecrit immediatement, pas a la sortie d ecran (PRD §6, lot 1, point 6)', () => {
  const donnees = poserMagasin();

  const apres = vue.basculerFait({}, 's1-r1', T);
  assert.deepEqual(apres, { 's1-r1': T }, 'les faits a jour sont RENDUS, jamais mutes sur place');
  // Ce qui compte : le stockage est deja a jour, avant tout changement d'ecran.
  assert.deepEqual(JSON.parse(donnees.get('marcq.v1.faits')), { 's1-r1': T });
});

test('decocher coute un tap et efface la cle (PRD §7.3)', () => {
  const donnees = poserMagasin();

  const coche = vue.basculerFait({}, 's1-r1', T);
  const decoche = vue.basculerFait(coche, 's1-r1');
  assert.deepEqual(decoche, {});
  assert.deepEqual(JSON.parse(donnees.get('marcq.v1.faits')), {});
});

test('l objet recu n est jamais mute (regle 1 du contrat d ecran)', () => {
  poserMagasin();
  const depart = { 's1-r1': T };
  vue.basculerFait(depart, 's1-r2', T);
  assert.deepEqual(depart, { 's1-r1': T }, 'ctx.faits doit survivre intact au tap');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 12` et `# fail 3`, chacun sur
`error: 'vue.basculerFait is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Compléter les imports en tête de `apps/marcq-handball/web/vue-seance.js` :

```js
import { cocher, decocher } from './etat.js';
```

L'écriture est appelée **dans la vue** et non remontée à `app.js` par un rappel :
elle est ainsi sur la même ligne que le changement d'apparence, et on ne peut pas
cocher à l'écran sans écrire. Un rappel s'oublie ; `etat.js` ne lève jamais, la
vue ne risque donc rien à l'appeler directement.

Ajouter sous `voisines` :

```js
// Un tap, une ecriture. La persistance ne differe pas a la sortie d'ecran : un
// ado qui ferme l'onglet entre deux series ne doit rien perdre.
// Rend les faits a jour — ceux que `etat.js` vient de relire depuis le
// stockage. `faits` n'est pas mute : le contrat d'ecran du PRP 03 interdit de
// toucher a `ctx`, et un second etat tenu en memoire divergerait en silence.
export function basculerFait(faits, id, quand = new Date().toISOString()) {
  return Object.prototype.hasOwnProperty.call(faits, id) ? decocher(id) : cocher(id, quand);
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 15`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : un tap, une ecriture"
git push
```

---

### Tâche 5 — L'écran, et les deux points d'accroche du PRP 06

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/seance.test.js`

Le montage ne décide rien : il pose le modèle, écoute les changements de case,
appelle `basculerFait`, recalcule le modèle et met à jour ce qui a bougé. Cinq
choses se testent quand même sans navigateur, et ce sont celles qui coûtent cher
à découvrir tard : la lecture de la route, son étanchéité aux dates impossibles,
les noms des deux événements sur lesquels le PRP 06 se branche, l'absence de
dialogue de confirmation et l'absence d'`innerHTML`.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
const source = readFileSync(new URL('../web/vue-seance.js', import.meta.url), 'utf8');

test('la route d une seance porte sa date', () => {
  assert.equal(vue.dateDeLaRoute('#/seance/2026-08-03'), '2026-08-03');
  assert.equal(vue.dateDeLaRoute('#/seance/2026-08-17'), '2026-08-17');
});

test('une date impossible n atteint jamais le rendu', () => {
  for (const route of [
    '#/seance/2026-13-45', '#/seance/2026-00-10', '#/seance/2026-08-32',
    '#/seance/2026-8-3', '#/seance/', '#/seance/2026-08-03/', '#/perso', '#/', '',
  ]) {
    assert.equal(vue.dateDeLaRoute(route), null, route);
    assert.equal(vue.MOTIF_SEANCE.test(route), false, route);
  }
});

test('la vue accroche le PRP 06 par deux evenements nommes', () => {
  // Le PRP 06 ecoute ces deux noms sur `document` pour poser ses animations sans
  // toucher a ce fichier. Les renommer casserait les recompenses sans casser un
  // seul test de comportement : d'ou cette assertion.
  assert.equal(vue.EVT_COCHAGE, 'marcq:exercice-coche');
  assert.equal(vue.EVT_SEANCE_COMPLETE, 'marcq:seance-complete');
  // bubbles : sans quoi un ecouteur pose sur `document` ne verrait jamais rien.
  assert.match(source, /bubbles:\s*true/, 'les evenements doivent remonter');
});

test('aucun dialogue ne s interpose entre le tap et le decochage (PRD §7.3)', () => {
  for (const interdit of ['confirm(', 'alert(', 'prompt(']) {
    assert.equal(
      source.includes(interdit),
      false,
      `${interdit} : l erreur de tap doit couter un tap, pas un dialogue`,
    );
  }
});

test('la vue ne compose jamais de HTML a partir du programme', () => {
  // programme.json est une donnee editable a la main : un libelle contenant un
  // chevron casserait la page, ou pire.
  assert.equal(source.includes('innerHTML'), false, 'le texte passe par textContent');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 17` et `# fail 3`. Les trois qui tombent :
`TypeError: vue.dateDeLaRoute is not a function` (deux fois), puis
`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: undefined !== 'marcq:exercice-coche'`.
Les deux tests de source passent déjà — ils protègent une régression future, pas
un manque présent.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/vue-seance.js` :

```js
// --- la route ---------------------------------------------------------------

// Le mois et le jour sont bornes : un fragment forge comme #/seance/2026-13-45
// n'atteint jamais le rendu, qui n'a donc pas a se defendre d'une date
// impossible. L'expression vit ici et non dans app.js — c'est l'ecran qui sait
// lire sa propre route, app.js n'en tient que le tableau.
export const MOTIF_SEANCE =
  /^#\/seance\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/;

export function dateDeLaRoute(route) {
  const trouve = MOTIF_SEANCE.exec(route);
  return trouve === null ? null : trouve[1];
}

// --- le montage -------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision. Tout ce qui se
// decide est au-dessus, et se prouve sans navigateur.

// Les deux points d'accroche du PRP 06. Ils remontent (bubbles) : les
// recompenses s'ecoutent depuis `document`, sans modifier ce fichier ni la
// signature de monterSeance. Le PRP 10 branchera le ressenti sur le second.
export const EVT_COCHAGE = 'marcq:exercice-coche';
export const EVT_SEANCE_COMPLETE = 'marcq:seance-complete';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // textContent et jamais innerHTML : le programme est une donnee editable a la
  // main, un libelle contenant un chevron casserait la page.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Le pied d'ecran : les deux seances voisines. C'est le chemin du rattrapage
// tant que le calendrier de l'ecran perso n'existe pas (PRP 05). Des liens, pas
// des boutons : le bouton retour du telephone doit rester une navigation.
function piedDeSeance(prog, dateISO) {
  const { precedente, suivante } = voisines(prog, dateISO);
  if (precedente === null && suivante === null) return null;

  const pied = el('nav', 'voisines');
  pied.setAttribute('aria-label', 'Autres séances');
  for (const [date, classe, texte] of [
    [precedente, 'lien-voisine vers-precedente', precedente && `← ${dateCourte(precedente)}`],
    [suivante, 'lien-voisine vers-suivante', suivante && `${dateCourte(suivante)} →`],
  ]) {
    if (date === null) continue;
    const a = el('a', classe, texte);
    a.href = `#/seance/${date}`;
    pied.append(a);
  }
  return pied;
}

// L'ecran de seance, au contrat du PRP 03 : (hote, ctx). Rien ne deborde de
// `hote` — pas de minuterie, pas d'ecouteur sur window — il n'y a donc rien a
// rendre : le routeur vide `hote` avant le montage suivant et les ecouteurs
// poses ici disparaissent avec lui.
export function monterSeance(hote, ctx) {
  const dateISO = dateDeLaRoute(ctx.route);
  const modele = modeleSeance(ctx, dateISO);

  const section = el('section', 'ecran ecran-seance');

  if (modele === null) {
    // Une date sans seance : du repos, pas une erreur (PRD §9). Les voisines
    // restent affichees, sans quoi l'enfant serait coince sur cet ecran.
    section.append(
      el('h1', 'titre-ecran', 'Pas de séance ce jour-là'),
      el('p', 'aide', dateISO === null
        ? 'Cette adresse ne désigne aucune séance.'
        : `Le programme ne prévoit rien le ${dateCourte(dateISO)}. C’est du repos, pas un oubli.`),
    );
    const repli = piedDeSeance(ctx.prog, dateISO ?? ctx.aujourdhui);
    if (repli) section.append(repli);
    hote.append(section);
    return;
  }

  section.dataset.seance = modele.date;

  section.append(
    el('p', 'date-seance', `Semaine ${modele.semaine} · ${modele.dateLisible}`),
    el('h1', 'titre-ecran', modele.titre),
  );

  // <progress> natif, comme l'ecran du jour : annonce par les lecteurs d'ecran,
  // sans calcul de largeur ni bibliotheque. Le ressort du PRD §10 s'ajoutera
  // par le CSS au PRP 06, sans changer une ligne d'ici.
  const progression = el('p', 'progression-seance');
  const barre = el('progress', 'barre');
  barre.max = modele.total;
  const compte = el('span', 'compte');
  progression.append(barre, compte);
  section.append(progression);

  if (modele.motif !== null) {
    section.classList.add('seance-verrouillee');
    section.append(el('p', 'verrou-seance', modele.motif));
  }

  // Les lignes, retenues par identifiant : un tap met a jour SA ligne, jamais
  // toute la liste — un rendu complet perdrait le focus et la position de
  // defilement au milieu d'une seance.
  const lignes = new Map();

  for (const bloc of modele.blocs) {
    const groupe = el('section', 'bloc-seance');
    groupe.append(el('h2', 'titre-bloc', bloc.titre));
    if (bloc.sousTitre !== '') groupe.append(el('p', 'tours-bloc', bloc.sousTitre));

    const liste = el('ul', 'exercices');
    for (const ex of bloc.exercices) {
      const item = el('li', 'exercice');
      if (ex.fait) item.classList.add('fait');

      // Une case native dans une etiquette qui prend toute la largeur : la zone
      // de tap est la LIGNE entiere, et le clavier comme les lecteurs d'ecran
      // fonctionnent sans un attribut ARIA de plus.
      const etiquette = el('label', 'ligne-exercice');
      const boite = document.createElement('input');
      boite.type = 'checkbox';
      boite.className = 'case-exercice';
      boite.checked = ex.fait;
      // Une case desactivee n'emet jamais d'evenement `change` : c'est la
      // traduction DOM de « l'avenir ne se coche pas » (PRD §9).
      boite.disabled = !modele.cochable;
      boite.dataset.exercice = ex.id;

      etiquette.append(boite, el('span', 'libelle-exercice', ex.libelle));
      item.append(etiquette);
      liste.append(item);
      lignes.set(ex.id, item);
    }
    groupe.append(liste);
    section.append(groupe);
  }

  const pied = piedDeSeance(ctx.prog, dateISO);
  if (pied) section.append(pied);

  function majProgression(m) {
    barre.value = m.coches;
    compte.textContent = m.coches === m.total
      ? `Séance complète · ${m.total} / ${m.total}`
      : `${m.coches} / ${m.total}`;
  }
  majProgression(modele);

  // `ctx.faits` n'est jamais mute (regle 1) : la vue tient son propre etat, et
  // c'est le retour de `basculerFait` — relu depuis le stockage — qui fait foi.
  let faits = ctx.faits;
  let complete = modele.coches === modele.total;

  // Une seule ecoute pour toute la liste : le parent sait deja quelle case a
  // change, et cinquante-trois fermetures gardees en vie ne rendraient rien de
  // plus. `change` remonte depuis une case a cocher.
  section.addEventListener('change', (e) => {
    const boite = e.target;
    if (!(boite instanceof HTMLInputElement) || boite.dataset.exercice === undefined) return;

    const id = boite.dataset.exercice;
    faits = basculerFait(faits, id);
    const fait = Object.prototype.hasOwnProperty.call(faits, id);

    // La case affiche ce que le stockage contient, jamais ce que le tap a suppose.
    boite.checked = fait;
    const ligne = lignes.get(id);
    if (ligne) ligne.classList.toggle('fait', fait);

    const suivant = modeleSeance({ ...ctx, faits }, dateISO);
    majProgression(suivant);

    section.dispatchEvent(new CustomEvent(EVT_COCHAGE, {
      bubbles: true,
      detail: {
        id, fait, ligne: ligne ?? null,
        coches: suivant.coches, total: suivant.total, part: suivant.part,
      },
    }));

    // La seance se valide au moment ou la derniere case tombe, et seulement a
    // ce moment : decocher puis recocher rejoue l'evenement, rester complet ne
    // le rejoue pas. Sans ce garde, les confettis du PRP 06 repartiraient a
    // chaque tap sur une seance deja finie.
    if (suivant.coches === suivant.total && !complete) {
      complete = true;
      section.dispatchEvent(new CustomEvent(EVT_SEANCE_COMPLETE, {
        bubbles: true,
        detail: { date: modele.date, total: suivant.total },
      }));
    } else if (suivant.coches < suivant.total) {
      complete = false;
    }
  });

  hote.append(section);
}
```

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
/* ---- l'ecran de seance ----------------------------------------------------
   Ouvert dehors, au soleil, sur un telephone tenu a bout de bras entre deux
   series. D'ou la ligne entiere comme zone de tap et des separations franches
   plutot que des nuances de gris. Les titres, la barre et le compte
   reutilisent les classes de l'ecran du jour : une jumelle divergerait. */

.ecran-seance { gap: 1.1rem; }

/* Le sur-titre : la semaine du coach et la date en toutes lettres. */
.date-seance { margin: 0; color: var(--marcq-encre-douce); font-size: 1.05rem; }

.progression-seance { display: flex; align-items: center; gap: .7rem; margin: 0; }

/* Le motif du verrou. Une phrase, pas une infobulle : il n'y a pas de survol
   sur un telephone. */
.verrou-seance {
  margin: 0;
  padding: .7rem .9rem;
  border-left: 4px solid var(--marcq-encre-douce);
  border-radius: 8px;
  background: var(--marcq-carte);
  color: var(--marcq-encre-douce);
}

.bloc-seance { display: flex; flex-direction: column; gap: .4rem; }

/* `.titre-bloc` porte une marge basse pour les reglages ; ici c'est `gap` qui
   espace, et les deux se cumuleraient. */
.bloc-seance .titre-bloc { margin: 0; }

.tours-bloc {
  margin: 0;
  color: var(--marcq-encre-douce);
  font-size: .95rem;
}

.exercices {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--marcq-trait);
  border-radius: 10px;
  background: var(--marcq-carte);
  overflow: hidden;
}

.exercice + .exercice { border-top: 1px solid var(--marcq-trait); }

/* Plus haut que la cible minimale de l'app : la ligne est atteinte du pouce, en
   mouvement, les mains moites (PRD §11). */
.ligne-exercice {
  display: flex;
  align-items: center;
  gap: .8rem;
  width: 100%;
  min-height: calc(var(--marcq-tap) + 8px);
  padding: .7rem .9rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.case-exercice {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin: 0;
  accent-color: var(--marcq-accent);
}

.case-exercice:focus-visible { outline: 3px solid var(--marcq-accent); outline-offset: 2px; }

.libelle-exercice { flex: 1 1 auto; }

/* Coche : la ligne se barre. C'est tout ce que ce PRP anime — le ressort et les
   confettis sont le PRP 06, branches sur marcq:exercice-coche. */
.exercice.fait .libelle-exercice {
  color: var(--marcq-encre-douce);
  text-decoration: line-through;
  text-decoration-thickness: 2px;
}

/* Une seance a venir : le cadre passe en pointilles et les cases s'effacent,
   mais le texte reste plein contraste — on vient justement lire ce qui arrive
   (PRD §9). */
.seance-verrouillee .exercices { border-style: dashed; background: transparent; }
.seance-verrouillee .ligne-exercice { cursor: default; }
.seance-verrouillee .case-exercice { opacity: .5; }

.voisines {
  display: flex;
  gap: .6rem;
  padding-top: .9rem;
  border-top: 1px solid var(--marcq-trait);
}

.lien-voisine {
  display: inline-flex;
  align-items: center;
  min-height: var(--marcq-tap);
  color: var(--marcq-accent);
  font-weight: 600;
  text-decoration: none;
}

.lien-voisine:focus-visible { outline: 3px solid var(--marcq-accent); outline-offset: 2px; }

/* Sans cela, la seule voisine d'une seance de bord se collerait a gauche, quel
   que soit le sens dans lequel elle emmene. */
.vers-suivante { margin-left: auto; }
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 20`, `# fail 0`.

Puis le contrôle à la main — la CI n'a pas de navigateur, et une liste qui ne se
pose pas correctement à l'écran ne se voit qu'à l'écran. La route n'est branchée
qu'à la tâche 6 ; ici on monte l'écran depuis la console, ce qui a l'avantage de
prouver que `monterSeance` ne dépend d'aucun routeur :

```bash
cd apps/marcq-handball && go run .
```

Sur `http://localhost:8080`, en mode téléphone dans les outils de développement,
donner un prénom si l'app le demande, puis coller dans la console :

```js
const { chargerProgramme } = await import('/domaine.js');
const { lireFaits } = await import('/etat.js');
const { monterSeance } = await import('/vue-seance.js');
const prog = chargerProgramme(await (await fetch('/programme.json')).json());
document.addEventListener('marcq:exercice-coche', (e) => console.log('coche', e.detail));
document.addEventListener('marcq:seance-complete', (e) => console.log('SEANCE', e.detail));
const hote = document.getElementById('ecran');
// lireFaits() et non {} : c'est ce qui rend le point 4 concluant.
hote.replaceChildren();
monterSeance(hote, {
  prog, aujourdhui: '2026-08-03', prenom: 'Lucas',
  faits: lireFaits(), route: '#/seance/2026-08-03',
});
```

Attendu, dans l'ordre :

1. Le sur-titre « Semaine 1 · lundi 3 août », le titre « Endurance +
   Renforcement », deux blocs : « Course » sans sous-titre, puis
   « Renforcement » avec « 2 tours · repos 1 min 30 entre les tours ». Huit
   lignes au total.
2. La barre est vide, le compte affiche « 0 / 8 ».
3. Un tap **n'importe où sur la ligne** — pas seulement sur la case — la coche :
   le libellé se barre, la barre avance, « 1 / 8 », et la console affiche
   `coche { id: 's1-c1', fait: true, coches: 1, total: 8, part: 0.125, … }`.
4. `F5`, puis recoller le script : la ligne est **toujours** barrée. C'est
   l'écriture immédiate, et c'est la promesse du PRD §6, lot 1, point 6.
5. Un second tap sur la même ligne la débarre. Aucun dialogue, aucune
   confirmation. « 0 / 8 ».
6. Cocher les huit lignes : la console affiche `SEANCE { date: '2026-08-03',
   total: 8 }` **une seule fois**, et le compte passe à « Séance complète · 8 /
   8 ». Décocher puis recocher la dernière la rejoue une fois.
7. Outils de développement → Application → Local Storage → `marcq.v1.faits`
   contient bien des horodatages, pas des booléens.
8. Rejouer le script avec `route: '#/seance/2026-08-17'` : les huit lignes sont
   lisibles, les cases inactives, la phrase « Séance à venir. Elle s’ouvrira
   lundi 17 août. » s'affiche et le cadre de la liste est en pointillés. Aucun
   tap ne fait rien.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : l'ecran de seance, la liste complete d'un coup d'oeil"
git push
```

---

### Tâche 6 — L'écran entre dans le routeur

**Fichiers :** Modifier `apps/marcq-handball/web/app.js` · Modifier `apps/marcq-handball/tests/vues.test.js` · Modifier `apps/marcq-handball/web/sw.js` · Modifier `apps/marcq-handball/README.md` · Tester `apps/marcq-handball/tests/seance.test.js`

Le PRP 03 a laissé deux assertions en attente — `ECRANS` vaut
`['reglages', 'jour']` et `choisirEcran('#/seance/2026-08-03')` rend `null` —
avec le commentaire *« la seance arrive au PRP 04 »*. C'est ici qu'elles
changent. Sans l'entrée de coque, la première séance ouverte hors ligne échoue,
et rien ne le signale tant qu'on reste connecté.

- [ ] **Étape 1 — écrire le test qui échoue**

Dans `apps/marcq-handball/tests/vues.test.js`, remplacer les deux assertions du
test `le routeur connait les ecrans de ce lot, et rejette les autres` :

```js
  assert.deepEqual(ECRANS.map((e) => e.nom), ['reglages', 'seance', 'jour']);
```

```js
  assert.equal(choisirEcran('#/seance/2026-08-03').nom, 'seance');
  assert.equal(choisirEcran('#/seance/2026-13-45'), null, 'une date impossible reste inconnue');
```

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
import { modeleJour } from '../web/vue-jour.js';

test('le lien de l ecran du jour correspond a la route de la seance', () => {
  // Le PRP 03 pose ce lien, le PRP 04 pose la route. Rien d'autre ne verifie
  // qu'ils parlent de la meme chose — et l'ecart se solderait par un retour
  // silencieux a l'ecran du jour.
  const m = modeleJour({ prog, aujourdhui: '2026-08-03', prenom: 'Lucas', faits: {} });
  assert.ok(m.lien, 'l ecran du jour propose bien d ouvrir la seance');
  assert.match(m.lien.href, vue.MOTIF_SEANCE);
});

test('le service worker met l ecran de seance en cache', () => {
  // Une seance se coche entierement hors ligne (PRD §11). Sans cette entree, le
  // premier passage hors ligne sur une seance jamais ouverte echoue — et rien
  // ne le signale tant qu'on est connecte.
  assert.match(
    readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8'),
    /'\/vue-seance\.js'/,
    'ajoute /vue-seance.js a la liste de coque de sw.js',
  );
});
```

L'import se place en tête du fichier, avec les autres.

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js tests/vues.test.js`

Attendu : ÉCHEC, `# pass 33` et `# fail 2` :
- dans `seance.test.js`,
  `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /'\/vue-seance\.js'/` ;
- dans `vues.test.js`, `TypeError: Cannot read properties of null (reading 'nom')` —
  `choisirEcran` ne connaît pas encore la route.

- [ ] **Étape 3 — l'implémentation minimale**

**`web/app.js`** — un import et une ligne, exactement ce que le contrat du
PRP 03 annonce. Compléter les imports :

```js
import { MOTIF_SEANCE, monterSeance } from './vue-seance.js';
```

puis insérer l'entrée dans `ECRANS`, **entre `reglages` et `jour`** :

```js
export const ECRANS = [
  { nom: 'reglages', motif: /^#\/reglages$/, monter: monterReglages },
  { nom: 'seance', motif: MOTIF_SEANCE, monter: monterSeance },
  { nom: 'jour', motif: /^(#\/?)?$/, monter: monterJour },
];
```

L'ordre est sans conséquence ici — les trois motifs sont disjoints — mais celui
du jour reste **dernier** : c'est lui qui accepte l'adresse sans ancre, et le
laisser devant en ferait un attrape-tout si un motif futur était moins strict.

Aucune ligne n'est ajoutée à `LIENS` : la séance n'a pas d'onglet, parce qu'un
onglet n'a pas de date. On y arrive depuis l'écran du jour ou depuis une
voisine.

**`web/sw.js`** — ajouter `'/vue-seance.js'` à la liste de coque, après
`'/vue-reglages.js'`. La vérification du PRP 03, complétée d'une entrée :

```bash
cd /home/user/hello-world/apps/marcq-handball && manquants=0 && \
for f in / /style.css /programme.json /app.js /etat.js /domaine.js \
         /vue-prenom.js /vue-jour.js /vue-reglages.js /vue-seance.js; do \
  grep -q "'$f'" web/sw.js || { echo "MANQUANT : $f"; manquants=1; }; \
done; [ "$manquants" = 0 ] && echo OK
```

**`apps/marcq-handball/README.md`** — ajouter la ligne de la séance au tableau
des écrans posé par le PRP 03 :

```markdown
| `#/seance/<YYYY-MM-DD>` | une séance : la liste complète, cochable si sa date est passée ou en cours (PRD §9) |
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js tests/vues.test.js`
Attendu : SUCCÈS, `# pass 35`, `# fail 0` — 22 pour l'écran de séance, 13 pour
les écrans de l'entrée.

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS, `# fail 0` et
`ok  github.com/billbob-space/hello-world/apps/marcq-handball`.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`.

Le parcours complet, dans un navigateur :

```bash
cd apps/marcq-handball && go run .
```

1. L'écran du jour porte « Commencer la séance » ; le suivre affiche la séance
   et l'adresse devient `…/#/seance/<date>`.
2. Cocher deux lignes, puis le bouton **retour du navigateur** : on revient à
   l'écran du jour, sans rechargement, et sa barre de progression affiche
   « 2 / 8 ».
3. Revenir à la séance : les deux lignes sont toujours cochées.
4. En bas, « ← 3 août » ou « 5 août → » selon la séance : c'est le rattrapage,
   et il fonctionne dès le lot 1, avant l'écran perso.
5. `#/seance/2026-08-04` — un mardi sans séance : « Pas de séance ce jour-là »
   et les deux voisines. `#/seance/2026-13-45` : le routeur réécrit l'adresse
   en `#/` et l'écran du jour s'affiche.
6. Outils de développement → Réseau → cocher « Offline », puis `F5` : l'app
   revient et la séance se coche toujours. C'est `/vue-seance.js` dans la coque.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/app.js apps/marcq-handball/web/sw.js \
        apps/marcq-handball/README.md apps/marcq-handball/tests/vues.test.js \
        apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : l'ecran de seance entre dans le routeur"
git push
```

---

## Points d'attention

**Le compte de tests annoncé par les PRP amont est faux de cinq.** Le PRP 02
annonce `# pass 29` et le PRP 03 `# pass 52` (29 + 10 + 13) : ni l'un ni l'autre
ne compte les cinq tests de `tests/coque.test.js`, posés par le PRP 01. Le total
réel de `node --test tests/*.test.js` avant ce PRP est donc **57**, et **79**
après. Les nombres par fichier de ce document, eux, sont exacts — c'est pourquoi
chaque étape lance un fichier nommé plutôt que le glob.

**`ctx.faits` ne se mute pas, et ce n'est pas une politesse.** Le routeur du
PRP 03 relit `lireFaits()` à chaque rendu ; une vue qui muterait `ctx.faits`
créerait un second état, divergent du stockage dès qu'un autre onglet écrit.
`basculerFait` rend l'objet que `etat.js` vient de relire, et la vue garde sa
propre variable `faits`. Le test « l objet recu n est jamais mute » est le seul
à l'attraper.

**`cocher` et `decocher` sont idempotents.** `cocher` sur une case déjà cochée
rend les faits inchangés **sans réécrire l'horodatage** — le PRD §9 départage les
égalités au classement par « le premier arrivé à ce score », et recocher ne doit
pas rajeunir la marque. La vue n'en dépend pas, mais un futur bouton « tout
cocher » y compterait à tort une mise à jour.

**Une case `disabled` n'émet jamais `change`.** C'est la traduction DOM de
« l'avenir ne se coche pas », et elle double le verrou du modèle. Le mécanisme
reste local : un enfant qui retire l'attribut depuis les outils de développement
cochera. C'est assumé — PRD §14, *« une équipe de gamins qui se connaissent, la
triche se voit au vestiaire »* — et le lot 2 y répond côté serveur, qui
recalcule le dénominateur du rang avec sa propre horloge (ossature §5).

**`part` du modèle n'est pas `progression()` du domaine.** Le premier est
`coches / total` de **cette** séance et sert la barre de l'écran ; le second est
la part de ce qui est programmé **à ce jour** et sert le rang (PRD §9). Les
confondre ferait afficher 100 % dès la première séance finie. Le PRP 05 et le
PRP 07 utilisent le second.

**`marcq:seance-complete` ne se déclenche qu'à la transition.** Le drapeau
`complete` est initialisé à l'état d'ouverture : une séance déjà finie qu'on
rouvre ne rejoue rien, décocher puis recocher la dernière case la rejoue une
fois. Sans ce garde, les confettis du PRP 06 repartiraient à chaque tap sur une
séance terminée.

**Un chemin de trop dans la coque du service worker supprime l'hors-ligne, en
silence.** `cache.addAll` est atomique : une seule entrée en 404 fait échouer
l'installation, et le service worker n'active jamais. L'app continue de
fonctionner en ligne — c'est ce qui rend la panne invisible pendant des semaines.
`tests/coque.test.js` du PRP 01 vérifie la liste à chaque exécution ; n'y ajoute
un chemin que le jour où le fichier existe.

**`vue-seance.js` importe `vue-jour.js` pour `dateEnToutesLettres`.** Une vue qui
importe une vue se justifie ici — c'est une mise en forme, pas un écran — et
c'est moins cher qu'une seconde table de mois qui divergerait à la première
retouche. Le jour où un troisième écran en aura besoin (PRP 05, le calendrier),
la fonction déménage dans un `web/format.js` et les deux imports suivent : c'est
un déplacement, pas une reprise.

**Le PRD §7.3 promet une animation de récompense à la validation de la séance ;
ce PRP ne la pose pas.** Ce n'est pas une contradiction du PRD mais le découpage
du lot 1 : l'écran affiche « Séance complète » et émet `marcq:seance-complete`,
le PRP 06 y branche les confettis. Livrer ce PRP seul donne une app complète et
utilisable, simplement sobre.

**Le fragment ne part jamais au serveur.** Ni `main.go` ni Traefik ne voient
`#/seance/2026-08-03` — il n'y a donc aucune route HTTP à ajouter, et le `GET /`
du serveur de fichiers suffit. Une route inconnue ne laisse jamais un écran vide :
le routeur du PRP 03 réécrit l'adresse en `#/` par `replaceState`, sans empiler
d'entrée.

**`./init.sh --check` refuse la chaîne `x-forwarded-user` dans tout fichier suivi
de `apps/marcq-handball/` hors `.md`** (`init.sh:1444-1452`). Rien de ce PRP ne
lit d'identité : l'écran de séance ne connaît que `localStorage`. Si un jour une
vue devait distinguer des utilisateurs, ce ne serait pas par cet en-tête — en
palier `public`, Traefik ne le pose ni ne l'écrase, il est forgé par le client.
