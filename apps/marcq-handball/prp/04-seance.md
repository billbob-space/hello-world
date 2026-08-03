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
| **Dépend de** | PRP 01 (la coque, le serveur, `sw.js`, `style.css`), PRP 02 (`programme.json`, `domaine.js`), PRP 03 (`app.js`, `etat.js`, `index.html`, `vue-jour.js`) |
| **Débloque** | PRP 05 (perso), PRP 06 (récompenses), PRP 10 (ressenti) |
| **Sections du PRD** | §7.3, §9 (le passé se corrige / l'avenir ne se coche pas), §6 lot 1 items 3, 4 et 6 |

## Objectif

Un tap coche un exercice, l'écrit dans `localStorage` avant de rendre la main, et
fait avancer la progression de la séance — sur n'importe quelle séance passée,
sur aucune séance à venir.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/seance.test.js` affiche
  `# pass 20` et `# fail 0`.
- `cd apps/marcq-handball && node --test tests/faits.test.js` affiche
  `# pass 6` et `# fail 0`.
- `./apps/marcq-handball/test.sh` est vert, et `./init.sh --check` aussi.
- Dans un navigateur, sur `#/seance/2026-08-03` : les 8 exercices sont là,
  groupés en « Course » et « Renforcement · 2 tours · repos 1 min 30 entre les
  tours » ; un tap barre la ligne et la barre passe à « 1 sur 8 » ; **F5 la
  garde barrée** ; un second tap la débarre sans le moindre dialogue.
- Sur `#/seance/2026-08-17` avant le 17 août : les 8 lignes sont lisibles, les
  cases inactives, la phrase « Séance à venir. Elle s’ouvrira lundi 17 août. »
  s'affiche et le cadre de la liste passe en pointillés.
- `document.addEventListener('marcq:exercice-coche', console.log)` dans la
  console affiche un événement à chaque tap, et `marcq:seance-complete` quand la
  dernière case tombe — c'est par là que le PRP 06 se branche.

## Périmètre

**Dedans :** la moitié « faits » de `web/etat.js` (`lireFaits`, `cocher`,
`decocher`) ; `web/vue-seance.js` en entier — modèle pur puis rendu DOM ; le
style de l'écran de séance dans `web/style.css` ; la route `#/seance/<date>`
dans `web/app.js` ; `/vue-seance.js` dans la coque du service worker ; le lien
de l'écran du jour vers la séance du jour.

**Dehors, et pourquoi :**
- Les animations de récompense — **PRP 06**. Ici, la ligne se barre et la barre
  avance, rien de plus. Ce PRP pose les deux points d'accroche pour que le PRP 06
  n'ait pas une ligne de cette vue à récrire.
- Le ressenti de fin de séance (trois émojis) — **PRP 10**, lot 2. Il se branche
  sur `marcq:seance-complete`.
- L'écran perso, le volume cumulé, le calendrier des sept séances — **PRP 05**.
  Le rattrapage passe ici par les deux séances voisines, pas par un calendrier.
- L'envoi du score au serveur — **PRP 07**. Rien de ce PRP ne parle au réseau.

## Interfaces

**Consomme :**

```js
// de web/domaine.js (PRP 02) — la seule fonction du domaine dont cet écran a besoin
import { etatSeance } from './domaine.js';
etatSeance(prog, dateISO, aujourdhui, faits)  // -> { statut, cochable, total, coches } | null
// cochable = dateISO <= aujourdhui && aujourdhui <= prog.fin   (PRP 02, decision 5)

// de web/programme.json (PRP 02) — la forme lue par le modele
seance = { date, semaine, titre, blocs: [ { type, tours, repos?, titre?, exercices: [ { id, libelle, mesure } ] } ] }

// de web/etat.js (PRP 03) — l'aide qui resout le stockage, partagee avec le prenom
function stockage()                           // -> Storage | null, resolu A CHAQUE APPEL

// de web/app.js (PRP 03)
export const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
function afficher(noeud)                      // remplace le contenu de #ecran
// + une fonction de routage branchee sur `hashchange` et au chargement
```

```
de web/index.html (PRP 03)   <main id="ecran" tabindex="-1"></main>

de web/style.css (PRP 01)    --papier --carte --encre --encre-douce --trait
                             --signal --signal-lisible --fait --tap --pas
                             --marge --rayon --texte --chiffres   ·   .tap
```

**Produit :**

```js
// web/etat.js — la moitie « faits » du contrat localStorage (ossature §6)
export function lireFaits()                   // -> { [id]: isoString } ; {} si vide, illisible ou stockage refuse
export function cocher(id, quand = new Date().toISOString())
export function decocher(id)
// cle interne, jamais exportee : 'marcq.v1.faits'

// web/vue-seance.js
export const EVT_COCHAGE = 'marcq:exercice-coche';
export const EVT_SEANCE_COMPLETE = 'marcq:seance-complete';
export function dateLongue(dateISO)           // '2026-08-03' -> 'lundi 3 août'
export function dateCourte(dateISO)           // '2026-08-03' -> '3 août'
export function titreBloc(bloc)               // -> bloc.titre, sinon 'Course' | 'Renforcement'
export function sousTitreBloc(bloc)           // -> '2 tours · repos 1 min 30 entre les tours' | ''
export function motifVerrou({ dateISO, aujourdhui, fin })   // -> string | null
export function voisines(prog, dateISO)       // -> { precedente: dateISO|null, suivante: dateISO|null }
export function modeleSeance({ prog, dateISO, aujourdhui, faits })   // -> ModeleSeance | null
export function basculerFait(faits, id, quand = new Date().toISOString())   // -> boolean (l'etat APRES le tap)
export function vueSeance({ prog, dateISO, aujourdhui, faits })      // -> HTMLElement detache
```

```js
// ModeleSeance — tout ce que le rendu doit savoir, et rien de plus
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
// Les deux evenements d'accroche — CustomEvent, bubbles: true, emis sur la section
marcq:exercice-coche     detail { id, fait, coches, total, part, ligne }   // `ligne` = le <li>
marcq:seance-complete    detail { date, total }                            // a la TRANSITION seulement
```

**Cinq noms que ni l'ossature ni les PRP amont ne fixent — ils sont définis ici
et les PRP aval s'y tiennent :**

1. **Le routage par fragment.** `#/` est l'écran du jour, `#/seance/<YYYY-MM-DD>`
   une séance, `#/perso` l'écran perso (PRP 05). Le fragment ne part jamais au
   serveur : aucune route HTTP à ajouter à `main.go`, la coque unique suffit, et
   le bouton retour du téléphone retrouve son sens — il ramène à l'écran du jour
   au lieu de fermer l'onglet.
2. **`apps/marcq-handball/tests/faits.test.js`** — les tests de la moitié
   « faits » de `etat.js`. Un fichier à part de `tests/etat.test.js`, que le
   PRP 03 tient pour le prénom : deux branches parallèles qui écrivent chacune
   dans son fichier fusionnent sans conflit, alors que deux jeux de tests dans un
   même fichier se marchent dessus sur l'import et sur le double de stockage.
3. **`apps/marcq-handball/tests/faux-stockage.js`** — le double de `localStorage`
   pour `node --test`, module à part et non copie dans chaque fichier de test :
   les deux fichiers qui s'en servent doivent éprouver exactement le même
   comportement, panne comprise.
4. **Les classes CSS de l'écran** : `.seance` `.seance--verrouillee`
   `.seance-entete` `.retour` `.barre` `.barre-remplissage` `.compte` `.verrou`
   `.bloc` `.bloc-sous-titre` `.exercices` `.exercice` `.exercice.fait` `.ligne`
   `.case` `.libelle` `.voisines` `.vers-precedente` `.vers-suivante`.
5. **`data-exercice`** sur la case à cocher et **`data-seance`** sur la section —
   les deux attributs par lesquels le PRP 06 retrouve une ligne sans connaître la
   structure du DOM.

## Fichiers

- Créer : `apps/marcq-handball/web/vue-seance.js`,
  `apps/marcq-handball/tests/seance.test.js`,
  `apps/marcq-handball/tests/faits.test.js`,
  `apps/marcq-handball/tests/faux-stockage.js`
- Modifier : `apps/marcq-handball/web/etat.js`,
  `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/web/vue-jour.js`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/faits.test.js`,
  `apps/marcq-handball/tests/seance.test.js`, plus le contrôle à la main dans un
  navigateur à la tâche 6 — la CI n'en a pas, et une liste qui ne se pose pas
  correctement à l'écran ne se voit qu'à l'écran.

## La coupure qui structure ce PRP

`vue-seance.js` se coupe en deux moitiés, et c'est ce qui rend l'écran testable
sans navigateur :

- **le modèle** — `modeleSeance` et ses aides. Fonctions pures : mêmes entrées,
  mêmes sorties, aucun DOM. Toutes les décisions y sont — quels blocs, quels
  libellés, quelle case est cochée, si l'écran est fermé et avec quelle phrase.
  `node --test` les prouve.
- **le rendu** — `vueSeance`. Il pose le modèle dans le DOM et n'y ajoute
  **aucune** décision. Ce qui n'est pas prouvable en CI est donc réduit à de
  l'assemblage d'éléments.

Un rendu qui déciderait quoi que ce soit — « si la date est passée alors… » —
serait une règle métier hors de portée des tests. Elle est toujours dans le
modèle.

## La convention d'écriture, rappelée

**Les accents vont dans ce que l'enfant lit, pas dans le code** (PRP 01). Les
libellés, les phrases affichées et les noms de mois portent leurs accents ; les
commentaires, les noms de fonctions et de variables restent en ASCII.

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/seance
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`.

---

### Tâche 1 — Les faits, écrits à chaque tap

**Fichiers :** Créer `apps/marcq-handball/tests/faux-stockage.js` · Créer `apps/marcq-handball/tests/faits.test.js` · Modifier `apps/marcq-handball/web/etat.js`

L'ossature §6 tranche la forme : `faits` associe un **horodatage**, pas un
booléen. Le PRD §9 tranche les égalités au classement par *« le premier arrivé à
ce score »* — il faut une date ; décocher supprime la clé, un `false` traînerait
indéfiniment ; et l'horodatage rend le débogage possible sans instrumenter quoi
que ce soit.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/faux-stockage.js` :

```js
// Un localStorage minimal pour node --test.
//
// Node n'en fournit pas, et l'app n'a pas de dependance : le double est ecrit
// ici. Il est un module a part plutot qu'une copie dans chaque fichier de test,
// parce que les deux fichiers qui s'en servent doivent eprouver exactement le
// meme comportement — la panne comprise.
//
// `enPanne` reproduit ce que font les navigateurs quand le stockage est refuse
// (navigation privee) ou plein (quota) : ils levent, ils ne rendent pas null.
export function fauxStockage({ enPanne = false } = {}) {
  const donnees = new Map();
  return {
    donnees, // ouvert aux tests : c'est ce qui permet de verifier ce qui est ECRIT
    getItem(cle) {
      if (enPanne) throw new Error('stockage refuse');
      return donnees.has(cle) ? donnees.get(cle) : null;
    },
    setItem(cle, valeur) {
      if (enPanne) throw new Error('quota depasse');
      donnees.set(cle, String(valeur));
    },
    removeItem(cle) {
      if (enPanne) throw new Error('stockage refuse');
      donnees.delete(cle);
    },
    clear() { donnees.clear(); },
  };
}
```

Créer `apps/marcq-handball/tests/faits.test.js` :

```js
// La moitie « faits » du contrat localStorage (ossature §6).
//
// L'import est un import d'espace de noms — `import * as etat` — et non des
// imports nommes : un export encore absent devient alors `undefined` et donne un
// TypeError sur l'appel, la ou un import nomme ferait echouer le CHARGEMENT du
// fichier entier et masquerait les tests deja verts.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as etat from '../web/etat.js';
import { fauxStockage } from './faux-stockage.js';

const CLE = 'marcq.v1.faits';
const T1 = '2026-08-03T18:22:11.000Z';
const T2 = '2026-08-03T18:24:02.000Z';

test('sans rien de coche, lireFaits rend un objet vide', () => {
  globalThis.localStorage = fauxStockage();
  assert.deepEqual(etat.lireFaits(), {});
});

test('cocher pose un horodatage, pas un booleen (ossature §6)', () => {
  const magasin = fauxStockage();
  globalThis.localStorage = magasin;

  etat.cocher('s1-r1', T1);
  etat.cocher('s1-r2', T2);

  assert.deepEqual(etat.lireFaits(), { 's1-r1': T1, 's1-r2': T2 });
  // Ecrit tout de suite, pas a la sortie d'ecran : un ado qui ferme l'onglet
  // entre deux series ne doit rien perdre (PRD §6, lot 1, point 6).
  assert.deepEqual(JSON.parse(magasin.donnees.get(CLE)), { 's1-r1': T1, 's1-r2': T2 });
});

test('decocher supprime la cle plutot que d ecrire false', () => {
  const magasin = fauxStockage();
  globalThis.localStorage = magasin;

  etat.cocher('s1-r1', T1);
  etat.decocher('s1-r1');

  assert.deepEqual(etat.lireFaits(), {});
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(magasin.donnees.get(CLE)), 's1-r1'), false);
});

test('un contenu illisible ne casse pas l app, il repart de zero', () => {
  const magasin = fauxStockage();
  globalThis.localStorage = magasin;

  for (const brut of ['{ceci n est pas du json', '[]', 'null', '"lucas"', '42']) {
    magasin.donnees.set(CLE, brut);
    assert.deepEqual(etat.lireFaits(), {}, `contenu rejete : ${brut}`);
  }
});

test('un stockage en panne ou absent ne casse jamais l app (ossature §6)', () => {
  globalThis.localStorage = fauxStockage({ enPanne: true });
  assert.deepEqual(etat.lireFaits(), {});
  assert.doesNotThrow(() => etat.cocher('s1-r1', T1));
  assert.doesNotThrow(() => etat.decocher('s1-r1'));

  delete globalThis.localStorage;
  assert.deepEqual(etat.lireFaits(), {});
  assert.doesNotThrow(() => etat.cocher('s1-r1', T1));
  assert.doesNotThrow(() => etat.decocher('s1-r1'));
});

test('le stockage est resolu a chaque appel, jamais capte a l import', () => {
  // Ce n'est pas une coquetterie de test : certains navigateurs font LEVER le
  // simple acces a localStorage en navigation privee. Capte au chargement du
  // module, l'acces empecherait etat.js de se charger — donc l'app entiere de
  // demarrer, pour une progression qu'on savait deja pouvoir perdre.
  const premier = fauxStockage();
  globalThis.localStorage = premier;
  etat.cocher('s1-r1', T1);

  const second = fauxStockage();
  globalThis.localStorage = second;
  assert.deepEqual(etat.lireFaits(), {}, 'le module lit le stockage courant');

  etat.cocher('s1-r2', T2);
  assert.deepEqual(JSON.parse(second.donnees.get(CLE)), { 's1-r2': T2 });
  assert.deepEqual(JSON.parse(premier.donnees.get(CLE)), { 's1-r1': T1 }, 'l ancien stockage n a pas bouge');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/faits.test.js`

Attendu : ÉCHEC, `# pass 0` et `# fail 6`, chacun sur
`error: 'etat.lireFaits is not a function'` (`name: 'TypeError'`).

Si le PRP 03 n'a pas encore livré `web/etat.js`, l'échec est unique et porte sur
le chargement :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../apps/marcq-handball/web/etat.js' imported from .../apps/marcq-handball/tests/faits.test.js`.
L'étape 3 crée alors le fichier au lieu de le compléter — le reste est identique.

- [ ] **Étape 3 — l'implémentation minimale**

`web/etat.js` porte déjà l'aide `stockage()`, posée par le PRP 03 pour le
prénom. **Ne la redéclare pas** : deux `function stockage()` au niveau d'un
module ES sont une `SyntaxError`, et le module cesse alors de se charger — donc
l'app entière de démarrer. Si le PRP 03 l'a nommée autrement, reprends son nom
dans les trois fonctions ci-dessous. Si elle manque, pose-la en tête de fichier :

```js
// Le stockage est resolu A CHAQUE APPEL, jamais capte a l'import : en
// navigation privee, certains navigateurs font lever le simple acces a
// localStorage, et une exception a l'import empecherait le module de se charger.
function stockage() {
  try {
    return globalThis.localStorage ?? null;
  } catch (e) {
    console.warn('stockage indisponible', e);
    return null;
  }
}
```

Ajouter à `apps/marcq-handball/web/etat.js` :

```js
// Le numero de schema est dans la CLE, pas dans la valeur : changer de format
// se fera en ecrivant marcq.v2.faits et en migrant depuis v1, jamais en
// relisant une valeur au mauvais format (ossature §6).
const CLE_FAITS = 'marcq.v1.faits';

// { [idExercice]: horodatageISO }. Rend {} des que quoi que ce soit cloche :
// stockage refuse, cle absente, JSON casse, valeur du mauvais type. Une app qui
// jette au premier tap est pire qu'une app sans memoire.
export function lireFaits() {
  const magasin = stockage();
  if (!magasin) return {};

  let brut;
  try {
    brut = magasin.getItem(CLE_FAITS);
  } catch (e) {
    console.warn('lecture des faits impossible', e);
    return {};
  }
  if (!brut) return {};

  try {
    const valeur = JSON.parse(brut);
    // Un objet, et rien d'autre. Un tableau ou une chaine heritee d'un
    // bricolage a la main passerait JSON.parse et ferait n'importe quoi ensuite.
    if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return {};
    return valeur;
  } catch (e) {
    console.warn('faits illisibles, on repart de zero', e);
    return {};
  }
}

// Une ecriture qui echoue ne remonte jamais a l'ecran : quota plein ou stockage
// refuse, la seance en cours reste cochable, seule la memoire manque.
function ecrireFaits(faits) {
  const magasin = stockage();
  if (!magasin) return;
  try {
    magasin.setItem(CLE_FAITS, JSON.stringify(faits));
  } catch (e) {
    console.warn('ecriture des faits impossible', e);
  }
}

// Relire avant d'ecrire, a chaque tap. Ca coute un aller-retour JSON sur 53
// cles au plus — invisible — et ca evite qu'un second onglet ouvert sur la meme
// app ecrase d'un coup tout ce que le premier vient de cocher.
export function cocher(id, quand = new Date().toISOString()) {
  const faits = lireFaits();
  faits[id] = quand;
  ecrireFaits(faits);
}

export function decocher(id) {
  const faits = lireFaits();
  // On supprime la cle plutot que d'ecrire false : un booleen traine
  // indefiniment et fausserait tout comptage par nombre de cles.
  delete faits[id];
  ecrireFaits(faits);
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/faits.test.js`  ·  Attendu :
SUCCÈS, `# pass 6`, `# fail 0`. Des lignes `lecture des faits impossible`,
`ecriture des faits impossible` et `faits illisibles, on repart de zero`
s'affichent sur la sortie d'erreur : c'est le repli qui s'annonce, exactement ce
que les quatrième et cinquième tests exigent.

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/etat.js apps/marcq-handball/tests/faits.test.js \
        apps/marcq-handball/tests/faux-stockage.js
git commit -m "marcq-handball : les faits, ecrits a chaque tap"
git push
```

---

### Tâche 2 — Les libellés que le coach a écrits

**Fichiers :** Créer `apps/marcq-handball/tests/seance.test.js` · Créer `apps/marcq-handball/web/vue-seance.js`

PRD §7.3 : *« Les exercices sont groupés comme le coach les a écrits : Course,
puis Renforcement, avec le nombre de tours affiché. »* Trois libellés en
découlent — le titre du bloc, son sous-titre, et la date de la séance en toutes
lettres — et ce sont trois fonctions pures.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/seance.test.js` :

```js
// L'ecran de seance, prouve sans navigateur.
//
// Tout ce qui DECIDE quelque chose est dans le modele, donc teste ici. Ce qui
// reste — poser le modele dans le DOM — se verifie a la main, une fois, a la
// tache 6 : la CI n'a pas de navigateur et n'en aura pas, l'app n'ayant aucune
// dependance (ossature §2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/domaine.js';
import * as vue from '../web/vue-seance.js';

const brut = JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
);
const prog = chargerProgramme(brut);

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

test('les dates s ecrivent en francais sans dependre de l ICU de Node', () => {
  assert.equal(vue.dateLongue('2026-08-03'), 'lundi 3 août');
  assert.equal(vue.dateLongue('2026-08-12'), 'mercredi 12 août');
  assert.equal(vue.dateLongue('2026-08-01'), 'samedi 1er août');
  assert.equal(vue.dateCourte('2026-08-05'), '5 août');
  assert.equal(vue.dateCourte('2026-08-01'), '1er août');
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
// commencer (PRD §7.3). Le module se coupe en deux moities :
//   - le modele, pur, qui prend toutes les decisions et que node --test prouve ;
//   - le rendu, qui pose ce modele dans le DOM et n'y ajoute aucune decision.

// --- les libelles -----------------------------------------------------------

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Deux tables plutot qu'un Intl.DateTimeFormat : la sortie d'Intl depend de la
// construction de Node — sans ICU complet, le runner de CI rendrait
// « Wednesday » et le test partirait en rouge sans que rien ne soit casse. Ce
// que l'enfant lit ne doit dependre d'aucun environnement. Meme choix que
// `cadran` en Go, pour la meme raison.
export function dateLongue(dateISO) {
  const [, mois, jour] = dateISO.split('-').map(Number);
  // Une date ISO sans heure est lue en UTC : getUTCDay ne subit aucun fuseau.
  const semaine = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return `${JOURS[semaine]} ${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}`;
}

export function dateCourte(dateISO) {
  const [, mois, jour] = dateISO.split('-').map(Number);
  return `${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}`;
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

### Tâche 3 — Le modèle : ce qui reste à faire, et pourquoi c'est fermé

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

PRD §9 : *« Une séance à venir est visible — on peut lire ce qui arrive — mais
ses cases sont inactives. »* Le verrou vient du domaine ; ce qui s'ajoute ici est
la **phrase qui dit pourquoi**. Sur un téléphone il n'y a pas de survol pour
aller chercher l'explication (ossature §9) : un grisement muet laisserait
l'enfant taper trois fois avant de comprendre.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
const T = '2026-08-03T18:22:11.000Z';

test('la liste est complete, groupee comme le coach l a ecrite (PRD §7.3)', () => {
  const m = vue.modeleSeance({ prog, dateISO: '2026-08-03', aujourdhui: '2026-08-03' });
  assert.equal(m.titre, 'Endurance + Renforcement');
  assert.equal(m.semaine, 1);
  assert.equal(m.dateLisible, 'lundi 3 août');
  assert.deepEqual(m.blocs.map((b) => b.titre), ['Course', 'Renforcement']);
  assert.deepEqual(m.blocs.map((b) => b.exercices.length), [2, 6]);
  assert.equal(m.total, 8, 'les huit cases sont la avant de commencer');
  assert.equal(m.blocs[1].exercices[0].libelle, '15 pompes');
  assert.equal(m.blocs[1].exercices[0].id, 's1-r1');
});

test('la progression de la seance se lit en direct', () => {
  const m = vue.modeleSeance({
    prog, dateISO: '2026-08-03', aujourdhui: '2026-08-05',
    faits: { 's1-r1': T, 's1-r2': T },
  });
  assert.equal(m.coches, 2);
  assert.equal(m.total, 8);
  assert.equal(m.part, 0.25);
  assert.deepEqual(m.blocs[1].exercices.map((e) => e.fait), [true, true, false, false, false, false]);
  assert.deepEqual(m.blocs[0].exercices.map((e) => e.fait), [false, false]);
});

test('l avenir ne se coche pas, et l ecran dit pourquoi (PRD §9)', () => {
  const m = vue.modeleSeance({ prog, dateISO: '2026-08-12', aujourdhui: '2026-08-10' });
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Séance à venir. Elle s’ouvrira mercredi 12 août.');
  assert.equal(m.total, 7, 'elle reste entierement lisible : on vient lire ce qui arrive');
});

test('le passe se rattrape jusqu a la fin du programme (PRD §9)', () => {
  for (const aujourdhui of ['2026-08-03', '2026-08-10', '2026-08-21']) {
    const m = vue.modeleSeance({ prog, dateISO: '2026-08-03', aujourdhui });
    assert.equal(m.cochable, true, `le 3 aout se coche encore le ${aujourdhui}`);
    assert.equal(m.motif, null);
  }
});

test('apres le 21 aout, plus rien ne se coche (PRD §9)', () => {
  const m = vue.modeleSeance({ prog, dateISO: '2026-08-03', aujourdhui: '2026-08-22' });
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Le programme est terminé. Rien ne se coche plus.');
});

test('le verrou et son motif disent toujours la meme chose', () => {
  // L'invariant qui compte : une case fermee sans phrase, ou une phrase sur un
  // ecran ouvert, sont deux facons de mentir a l'enfant.
  for (const seance of prog.seances) {
    for (const aujourdhui of ['2026-08-01', '2026-08-10', '2026-08-21', '2026-08-22']) {
      const m = vue.modeleSeance({ prog, dateISO: seance.date, aujourdhui });
      assert.equal(m.motif === null, m.cochable, `${seance.date} vu le ${aujourdhui}`);
    }
  }
});

test('un jour sans seance n a pas de modele', () => {
  assert.equal(vue.modeleSeance({ prog, dateISO: '2026-08-04', aujourdhui: '2026-08-10' }), null);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 3` et `# fail 7`, chacun sur
`error: 'vue.modeleSeance is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter en tête de `apps/marcq-handball/web/vue-seance.js`, au-dessus du bloc
« les libelles » :

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
  if (dateISO > aujourdhui) return `Séance à venir. Elle s’ouvrira ${dateLongue(dateISO)}.`;
  return null;
}

// Tout ce que le rendu doit savoir, et rien de plus. Pur : memes entrees, memes
// sorties, aucun DOM, aucune horloge — `aujourdhui` est un parametre.
// Rend null si aucune seance n'a lieu ce jour-la.
export function modeleSeance({ prog, dateISO, aujourdhui, faits = {} }) {
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (!seance) return null;

  const etat = etatSeance(prog, dateISO, aujourdhui, faits);

  return {
    date: seance.date,
    titre: seance.titre,
    semaine: seance.semaine,
    dateLisible: dateLongue(seance.date),
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

### Tâche 4 — Le rattrapage, d'une séance à l'autre

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

PRD §6, lot 1, point 4 : *« toute séance passée reste librement cochable et
décochable »*. Encore faut-il pouvoir l'atteindre. Le calendrier des sept
séances est l'écran perso (PRP 05) ; d'ici là, sans ces deux liens, une séance
oubliée ne serait joignable qu'en tapant son URL à la main — et le rattrapage
serait une promesse du PRD sans chemin dans l'app.

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
// Les seances sont validees strictement croissantes par chargerProgramme : la
// derniere anterieure et la premiere posterieure sont bien les deux voisines.
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

### Tâche 5 — Un tap, une écriture

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Tester `apps/marcq-handball/tests/seance.test.js`

C'est le geste central de l'app, et le seul endroit où le modèle touche à
l'état. Il est isolé dans une fonction pour une raison : la promesse *« un ado
qui ferme l'onglet entre deux séries ne doit rien perdre »* se vérifie ici, en
CI, plutôt que dans un gestionnaire d'événement que seul un navigateur peut
déclencher.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter en tête de `apps/marcq-handball/tests/seance.test.js`, sous les imports
existants :

```js
import { fauxStockage } from './faux-stockage.js';
```

Ajouter à la fin du même fichier :

```js
test('un tap ecrit immediatement, pas a la sortie d ecran (PRD §6, lot 1, point 6)', () => {
  const magasin = fauxStockage();
  globalThis.localStorage = magasin;

  const faits = {};
  assert.equal(vue.basculerFait(faits, 's1-r1', T), true, 'l etat APRES le tap');
  assert.deepEqual(faits, { 's1-r1': T }, 'l objet en memoire suit, pour le modele suivant');
  // Ce qui compte : le stockage est deja a jour, avant tout changement d'ecran.
  assert.deepEqual(JSON.parse(magasin.donnees.get('marcq.v1.faits')), { 's1-r1': T });
});

test('decocher coute un tap et efface la cle (PRD §7.3)', () => {
  const magasin = fauxStockage();
  globalThis.localStorage = magasin;

  const faits = {};
  vue.basculerFait(faits, 's1-r1', T);
  assert.equal(vue.basculerFait(faits, 's1-r1'), false);
  assert.deepEqual(faits, {});
  assert.deepEqual(JSON.parse(magasin.donnees.get('marcq.v1.faits')), {});
});

test('un stockage en panne n empeche pas de cocher a l ecran (ossature §6)', () => {
  globalThis.localStorage = fauxStockage({ enPanne: true });
  const faits = {};
  assert.doesNotThrow(() => vue.basculerFait(faits, 's1-r1', T));
  // La seance reste cochable et la barre avance : seule la memoire manque.
  assert.deepEqual(faits, { 's1-r1': T });
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 12` et `# fail 3`, chacun sur
`error: 'vue.basculerFait is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Compléter l'import en tête de `apps/marcq-handball/web/vue-seance.js` :

```js
import { cocher, decocher } from './etat.js';
```

L'écriture est appelée **dans la vue** et non remontée à `app.js` par un rappel :
elle est ainsi sur la même ligne que le changement d'apparence, et on ne peut
pas cocher à l'écran sans écrire. Un rappel s'oublie ; `etat.js` ne lève jamais,
la vue ne risque donc rien à l'appeler directement.

Ajouter sous `voisines` :

```js
// Un tap, une ecriture. La persistance ne differe pas a la sortie d'ecran : un
// ado qui ferme l'onglet entre deux series ne doit rien perdre.
// `faits` est mis a jour SUR PLACE pour que le modele recalcule juste apres
// reflete la meme verite que le stockage.
export function basculerFait(faits, id, quand = new Date().toISOString()) {
  if (Object.prototype.hasOwnProperty.call(faits, id)) {
    delete faits[id];
    decocher(id);
    return false;
  }
  faits[id] = quand;
  cocher(id, quand);
  return true;
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

### Tâche 6 — L'écran : la liste complète, et les deux points d'accroche

**Fichiers :** Modifier `apps/marcq-handball/web/vue-seance.js` · Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/seance.test.js`

Le rendu ne décide rien : il pose le modèle, écoute les changements de case,
appelle `basculerFait`, recalcule le modèle et met à jour ce qui a bougé. Trois
invariants se testent quand même sans navigateur, et ce sont ceux qui coûtent
cher à découvrir tard : les noms des deux événements sur lesquels le PRP 06 se
branche, l'absence de dialogue de confirmation, et l'absence d'`innerHTML`.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
const source = readFileSync(new URL('../web/vue-seance.js', import.meta.url), 'utf8');

test('la vue accroche le PRP 06 par deux evenements nommes', () => {
  // Le PRP 06 ecoute ces deux noms pour poser ses animations sans toucher a ce
  // fichier. Les renommer casserait les recompenses sans casser un seul test
  // de comportement : d'ou cette assertion.
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

Attendu : ÉCHEC, `# pass 17` et `# fail 1` — seul le premier tombe, sur
`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: undefined !== 'marcq:exercice-coche'`.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/vue-seance.js` :

```js
// --- le rendu ---------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision. Tout ce qui se
// decide est au-dessus, et se prouve sans navigateur.

// Les deux points d'accroche du PRP 06. Ils remontent (bubbles) : les
// recompenses s'ecoutent depuis `document`, sans modifier ce fichier ni la
// signature de vueSeance. Le PRP 10 branchera le ressenti sur le second.
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

function lien(href, classe, texte) {
  const a = el('a', classe, texte);
  a.href = href;
  return a;
}

// Le pied d'ecran : les deux seances voisines. C'est le chemin du rattrapage
// tant que le calendrier de l'ecran perso n'existe pas (PRP 05).
function piedDeSeance(prog, dateISO) {
  const { precedente, suivante } = voisines(prog, dateISO);
  if (!precedente && !suivante) return null;

  const pied = el('nav', 'voisines');
  pied.setAttribute('aria-label', 'Autres séances');
  if (precedente) {
    pied.append(lien(`#/seance/${precedente}`, 'tap vers-precedente', `← ${dateCourte(precedente)}`));
  }
  if (suivante) {
    pied.append(lien(`#/seance/${suivante}`, 'tap vers-suivante', `${dateCourte(suivante)} →`));
  }
  return pied;
}

// L'ecran de seance, rendu detache : il ne connait ni #ecran ni le routeur.
// C'est ce qui permet au PRP 05 de le monter ailleurs sans le toucher.
export function vueSeance({ prog, dateISO, aujourdhui, faits = {} }) {
  const section = el('section', 'seance');
  section.append(lien('#/', 'retour tap', 'Aujourd’hui'));

  const modele = modeleSeance({ prog, dateISO, aujourdhui, faits });

  if (modele === null) {
    // Une date sans seance : du repos, pas une erreur (PRD §9). Les voisines
    // restent affichees, sans quoi l'enfant serait coince sur cet ecran.
    section.append(
      el('h1', null, 'Pas de séance ce jour-là'),
      el('p', 'dit', `Le programme ne prévoit rien le ${dateCourte(dateISO)}. C’est du repos, pas un oubli.`),
    );
    const pied = piedDeSeance(prog, dateISO);
    if (pied) section.append(pied);
    return section;
  }

  section.dataset.seance = modele.date;

  const entete = el('header', 'seance-entete');
  entete.append(
    el('p', 'sur-titre', `Semaine ${modele.semaine} · ${modele.dateLisible}`),
    el('h1', null, modele.titre),
  );

  const barre = el('div', 'barre');
  barre.setAttribute('role', 'progressbar');
  barre.setAttribute('aria-valuemin', '0');
  barre.setAttribute('aria-valuemax', String(modele.total));
  const remplissage = el('div', 'barre-remplissage');
  barre.append(remplissage);

  const compte = el('p', 'compte');
  entete.append(barre, compte);
  section.append(entete);

  if (modele.motif) {
    section.classList.add('seance--verrouillee');
    section.append(el('p', 'verrou', modele.motif));
  }

  // Les lignes, retenues par identifiant : un tap met a jour SA ligne, jamais
  // toute la liste — un rendu complet perdrait le focus et la position de
  // defilement au milieu d'une seance.
  const lignes = new Map();

  for (const bloc of modele.blocs) {
    const groupe = el('section', 'bloc');
    groupe.append(el('h2', null, bloc.titre));
    if (bloc.sousTitre) groupe.append(el('p', 'bloc-sous-titre', bloc.sousTitre));

    const liste = el('ul', 'exercices');
    for (const ex of bloc.exercices) {
      const item = el('li', 'exercice');
      if (ex.fait) item.classList.add('fait');

      // Une case native dans une etiquette qui prend toute la largeur : la zone
      // de tap est la LIGNE entiere, et le clavier comme les lecteurs d'ecran
      // fonctionnent sans un attribut ARIA de plus.
      const etiquette = el('label', 'ligne tap');
      const boite = document.createElement('input');
      boite.type = 'checkbox';
      boite.className = 'case';
      boite.checked = ex.fait;
      // Une case desactivee n'emet jamais d'evenement `change` : c'est la
      // traduction DOM de « l'avenir ne se coche pas » (PRD §9).
      boite.disabled = !modele.cochable;
      boite.dataset.exercice = ex.id;

      etiquette.append(boite, el('span', 'libelle', ex.libelle));
      item.append(etiquette);
      liste.append(item);
      lignes.set(ex.id, item);
    }
    groupe.append(liste);
    section.append(groupe);
  }

  const pied = piedDeSeance(prog, dateISO);
  if (pied) section.append(pied);

  function majProgression(m) {
    remplissage.style.width = `${Math.round(m.part * 100)}%`;
    barre.setAttribute('aria-valuenow', String(m.coches));
    barre.setAttribute('aria-valuetext', `${m.coches} sur ${m.total}`);
    compte.textContent = m.coches === m.total
      ? `Séance complète · ${m.total} sur ${m.total}`
      : `${m.coches} sur ${m.total}`;
  }
  majProgression(modele);

  // Une seule ecoute pour toute la liste : le parent sait deja quelle case a
  // change, et cinquante-trois fermetures gardees en vie ne rendraient rien de
  // plus. `change` remonte depuis une case a cocher.
  let complete = modele.coches === modele.total;

  section.addEventListener('change', (e) => {
    const boite = e.target;
    if (!(boite instanceof HTMLInputElement) || !boite.dataset.exercice) return;

    const id = boite.dataset.exercice;
    const fait = basculerFait(faits, id);
    // La case affiche ce que `faits` contient, jamais ce que le tap a suppose.
    boite.checked = fait;
    const ligne = lignes.get(id);
    if (ligne) ligne.classList.toggle('fait', fait);

    const suivant = modeleSeance({ prog, dateISO, aujourdhui, faits });
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

  return section;
}
```

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
/* ---- l'ecran de seance ----------------------------------------------------
   Ouvert dehors, au soleil, sur un telephone tenu a bout de bras entre deux
   series. D'ou la ligne entiere comme zone de tap et des separations franches
   plutot que des nuances de gris. */

.seance {
  max-width: 34rem;
  margin: 0 auto;
}

.retour {
  min-height: var(--tap);
  color: var(--encre-douce);
  font-family: var(--chiffres);
  font-size: 0.875rem;
  text-decoration: none;
}

.retour::before { content: '\2039\00a0'; }

.seance-entete { margin-bottom: calc(var(--pas) * 4); }

.seance-entete h1 { margin-top: 2px; }

.barre {
  height: 10px;
  margin-top: calc(var(--pas) * 2);
  background: var(--trait);
  border-radius: 999px;
  overflow: hidden;
}

.barre-remplissage {
  width: 0;
  height: 100%;
  background: var(--signal);
  border-radius: inherit;
  /* La barre avance, elle ne saute pas (PRD §10). Rien n'attend la fin de cette
     transition : le tap suivant est possible immediatement. Le bloc
     prefers-reduced-motion pose au PRP 01 la ramene a 0,01 ms. */
  transition: width 220ms ease-out;
}

.compte {
  margin: var(--pas) 0 0;
  font-family: var(--chiffres);
  font-size: 0.9375rem;
  color: var(--encre-douce);
}

/* Le motif du verrou. Une phrase, pas une infobulle : il n'y a pas de survol
   sur un telephone. */
.verrou {
  margin: 0 0 calc(var(--pas) * 3);
  padding: calc(var(--pas) * 1.5) calc(var(--pas) * 2);
  border-left: 4px solid var(--encre-douce);
  border-radius: var(--rayon);
  background: var(--carte);
  color: var(--encre-douce);
}

.bloc { margin-bottom: calc(var(--pas) * 4); }

.bloc h2 {
  margin: 0;
  font-size: 1.125rem;
}

.bloc-sous-titre {
  margin: 2px 0 var(--pas);
  font-family: var(--chiffres);
  font-size: 0.875rem;
  color: var(--encre-douce);
}

.exercices {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--trait);
  border-radius: var(--rayon);
  background: var(--carte);
  overflow: hidden;
}

.exercice + .exercice { border-top: 1px solid var(--trait); }

/* 56 px et non les 44 px minimaux du contrat : la cible est atteinte du pouce,
   en mouvement, les mains moites (PRD §11). */
.ligne {
  display: flex;
  align-items: center;
  gap: calc(var(--pas) * 1.5);
  width: 100%;
  min-height: 56px;
  padding: calc(var(--pas) * 1.5) calc(var(--pas) * 2);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.case {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin: 0;
  accent-color: var(--fait);
}

.libelle { flex: 1 1 auto; }

/* Coche : la ligne se barre. C'est tout ce que ce PRP anime — le ressort et les
   confettis sont le PRP 06, branches sur marcq:exercice-coche. */
.exercice.fait .libelle {
  color: var(--encre-douce);
  text-decoration: line-through;
  text-decoration-color: var(--fait);
  text-decoration-thickness: 2px;
}

/* Une seance a venir : le cadre passe en pointilles et les cases s'effacent,
   mais le texte reste plein contraste — on vient justement lire ce qui arrive
   (PRD §9). */
.seance--verrouillee .exercices {
  border-style: dashed;
  background: transparent;
}

.seance--verrouillee .ligne { cursor: default; }

.seance--verrouillee .case { opacity: 0.45; }

.voisines {
  display: flex;
  gap: var(--pas);
  margin-top: calc(var(--pas) * 4);
  padding-top: calc(var(--pas) * 2);
  border-top: 1px solid var(--trait);
}

.voisines a {
  align-items: center;
  color: var(--signal);
  font-family: var(--chiffres);
  text-decoration: none;
}

/* Sans cela, la seule voisine d'une seance de bord se collerait a gauche,
   quel que soit le sens dans lequel elle emmene. */
.vers-suivante { margin-left: auto; }
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 18`, `# fail 0`.

Puis le contrôle à la main — la CI n'a pas de navigateur, et une liste qui ne se
pose pas correctement à l'écran ne se voit qu'à l'écran. La tâche 7 branche la
route ; ici, on monte la vue à la main depuis la console, ce qui a l'avantage de
prouver que `vueSeance` ne dépend d'aucun routeur :

```bash
cd apps/marcq-handball
CGO_ENABLED=0 go build -trimpath -ldflags="-X main.version=essai" -o /tmp/mh .
PORT=8199 /tmp/mh & pid=$!
sleep 1
echo 'ouvrir http://localhost:8199/ puis coller le script ci-dessous dans la console'
```

```js
const { chargerProgramme } = await import('/domaine.js');
const { lireFaits } = await import('/etat.js');
const { vueSeance } = await import('/vue-seance.js');
const prog = chargerProgramme(await (await fetch('/programme.json')).json());
document.addEventListener('marcq:exercice-coche', (e) => console.log('coche', e.detail));
document.addEventListener('marcq:seance-complete', (e) => console.log('SEANCE', e.detail));
// lireFaits() et non {} : c'est ce qui rend l'etape 4 concluante.
document.querySelector('#ecran').replaceChildren(
  vueSeance({ prog, dateISO: '2026-08-03', aujourdhui: '2026-08-03', faits: lireFaits() }),
);
```

Attendu, dans l'ordre :

1. Le titre « Endurance + Renforcement », le sur-titre « Semaine 1 · lundi
   3 août », deux blocs : « Course » sans sous-titre, puis « Renforcement » avec
   « 2 tours · repos 1 min 30 entre les tours ». Huit lignes au total.
2. La barre est vide, le compte affiche « 0 sur 8 ».
3. Un tap **n'importe où sur la ligne** — pas seulement sur la case — la coche :
   le libellé se barre, la barre avance, « 1 sur 8 », et la console affiche
   `coche { id: 's1-c1', fait: true, coches: 1, total: 8, part: 0.125, … }`.
4. `F5`, puis recoller le script : la ligne est **toujours** barrée. C'est
   l'écriture immédiate, et c'est la promesse du PRD §6, lot 1, point 6.
5. Un second tap sur la même ligne la débarre. Aucun dialogue, aucune
   confirmation. « 0 sur 8 ».
6. Cocher les huit lignes : la console affiche `SEANCE { date: '2026-08-03',
   total: 8 }` **une seule fois**, et le compte passe à « Séance complète · 8
   sur 8 ». Décocher puis recocher la dernière la rejoue une fois.
7. Outils de développement → Application → Local Storage → `marcq.v1.faits`
   contient bien des horodatages, pas des booléens.
8. Rejouer avec `dateISO: '2026-08-17'` et `aujourdhui: '2026-08-03'` : les huit
   lignes sont lisibles, les cases inactives, la phrase « Séance à venir. Elle
   s’ouvrira lundi 17 août. » s'affiche et le cadre de la liste est en
   pointillés. Aucun tap ne fait rien.

```bash
kill "$pid"
```

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-seance.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : l'ecran de seance, la liste complete d'un coup d'oeil"
git push
```

---

### Tâche 7 — L'écran entre dans l'app

**Fichiers :** Modifier `apps/marcq-handball/web/app.js` · Modifier `apps/marcq-handball/web/vue-jour.js` · Modifier `apps/marcq-handball/web/sw.js` · Modifier `apps/marcq-handball/README.md` · Tester `apps/marcq-handball/tests/seance.test.js`

Trois branchements, chacun invisible s'il manque : sans la route, l'écran
n'existe pas ; sans le lien de l'écran du jour, il n'est joignable qu'en tapant
son URL ; sans l'entrée de coque, la première séance ouverte hors ligne échoue —
et rien ne le signale tant qu'on reste connecté.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/seance.test.js` :

```js
const lireWeb = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

test('l ecran du jour mene a la seance du jour', () => {
  assert.match(
    lireWeb('vue-jour.js'),
    /#\/seance\//,
    'sans ce lien, l ecran de seance n est joignable qu en tapant son URL',
  );
});

test('le service worker met l ecran de seance en cache', () => {
  // Une seance se coche entierement hors ligne (PRD §11). Sans cette entree, le
  // premier passage hors ligne sur une seance jamais ouverte echoue — et rien
  // ne le signale tant qu'on est connecte.
  assert.match(
    lireWeb('sw.js'),
    /'\/vue-seance\.js'/,
    'ajoute /vue-seance.js au tableau COQUE de sw.js',
  );
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`

Attendu : ÉCHEC, `# pass 18` et `# fail 2`, sur
`AssertionError [ERR_ASSERTION]: The input did not match the regular expression /#\/seance\//` puis
`… /'\/vue-seance\.js'/`.

Si le PRP 03 a déjà posé le lien vers `#/seance/`, seul le second tombe : passe
directement à la partie `sw.js` de l'étape 3.

- [ ] **Étape 3 — l'implémentation minimale**

**`web/sw.js`** — ajouter l'entrée à `COQUE`, qui devient :

```js
const COQUE = [
  '/',
  '/style.css',
  '/app.js',
  '/domaine.js',
  '/etat.js',
  '/vue-jour.js',
  '/vue-seance.js',
  '/programme.json',
];
```

Seule `/vue-seance.js` appartient à ce PRP ; les autres entrées viennent des
PRP 01 et 03, et si l'une manque encore, cette liste est celle qui vaut au terme
de ce PRP — chacun des fichiers qu'elle nomme existe déjà.
`tests/coque.test.js` (PRP 01) vérifie que chaque chemin correspond à un fichier
livré : un chemin en trop ferait échouer `cache.addAll`, donc l'installation
entière, et le service worker n'activerait **jamais**.

**`web/app.js`** — compléter les imports :

```js
import { vueSeance } from './vue-seance.js';
import { lireFaits } from './etat.js';
```

puis ajouter la branche dans la fonction de routage, **avant** le cas par
défaut :

```js
  // #/seance/2026-08-03 — une seance, passee ou a venir. Le mois et le jour
  // sont bornes dans le motif : un fragment forge du genre #/seance/2026-13-45
  // n'atteint alors jamais le rendu, qui n'a pas a se defendre d'une date
  // impossible.
  const cible = route.match(/^\/seance\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/);
  if (cible) {
    afficher(vueSeance({
      prog,
      dateISO: cible[1],
      aujourdhui: aujourdhui(),
      // Relu a chaque entree dans l'ecran : un autre onglet a pu cocher entre
      // temps, et c'est le stockage qui fait foi, jamais une copie en memoire.
      faits: lireFaits(),
    }));
    return;
  }
```

`route` est le fragment sans son `#`, `/` par défaut :
`const route = location.hash.replace(/^#/, '') || '/';`. Si le PRP 03 a nommé
autrement la variable, la fonction d'affichage ou le conteneur, seules ces
lignes-ci changent — `vue-seance.js` n'en dépend pas, il rend un élément détaché.

**`web/vue-jour.js`** — l'écran du jour doit mener à la séance. Si le lien n'y
est pas, ajouter, là où l'écran du jour annonce la séance :

```js
  const vers = document.createElement('a');
  vers.className = 'tap action';
  vers.href = `#/seance/${seance.date}`;
  vers.textContent = 'Ouvrir la séance';
```

et l'insérer dans l'écran. Le libellé ne promet rien de faux pour une séance à
venir : on l'ouvre, on la lit, on ne la coche pas.

**`apps/marcq-handball/README.md`** — ajouter, sous la section des routes :

```markdown
## Les écrans

Le routage se fait par fragment : il ne part jamais au serveur, et la coque
unique servie à la racine suffit.

| Fragment | Écran |
|---|---|
| `#/` | l'écran du jour |
| `#/seance/<YYYY-MM-DD>` | une séance, passée ou à venir |

Une séance passée reste cochable jusqu'au 21 août ; une séance à venir est
lisible, ses cases sont inactives et l'écran dit pourquoi (PRD §9).
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/seance.test.js`  ·  Attendu :
SUCCÈS, `# pass 20`, `# fail 0`.

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS, `# fail 0` et
`ok  github.com/billbob-space/hello-world/apps/marcq-handball`.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`.

Le parcours complet, dans un navigateur :

```bash
cd apps/marcq-handball
CGO_ENABLED=0 go build -trimpath -ldflags="-X main.version=essai" -o /tmp/mh .
PORT=8199 /tmp/mh & pid=$!
sleep 1
echo 'ouvrir http://localhost:8199/'
```

1. L'écran du jour porte « Ouvrir la séance » ; le suivre affiche la séance et
   l'adresse devient `…/#/seance/<date>`.
2. Cocher deux lignes, puis le bouton **retour du navigateur** : on revient à
   l'écran du jour, sans rechargement.
3. Revenir à la séance : les deux lignes sont toujours cochées.
4. En bas, « ← 3 août » ou « 5 août → » selon la séance : c'est le rattrapage,
   et il fonctionne dès le lot 1, avant l'écran perso.
5. `#/seance/2026-08-04` — un mercredi sans séance : « Pas de séance ce jour-là »
   et les deux voisines.
6. Outils de développement → Réseau → cocher « Offline », puis `F5` : l'app
   revient et la séance se coche toujours. C'est `/vue-seance.js` dans `COQUE`.

```bash
kill "$pid"
```

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/app.js apps/marcq-handball/web/vue-jour.js \
        apps/marcq-handball/web/sw.js apps/marcq-handball/README.md \
        apps/marcq-handball/tests/seance.test.js
git commit -m "marcq-handball : l'ecran de seance entre dans l'app"
git push
```

---

## Points d'attention

**`etat.js` est écrit par deux PRP à la fois.** L'ossature §6 confie
`marcq.v1.prenom` au PRP 03 et `marcq.v1.faits` au PRP 04 — même module, deux
branches. Le seul point de collision est l'aide `stockage()` : **deux
`function stockage()` au niveau d'un module ES sont une `SyntaxError`**, et le
module cesse alors de se charger, donc l'app entière de démarrer. Le symptôme
n'est pas « les faits ne s'enregistrent plus », c'est une page blanche.
Les tests des deux PRP ont chacun leur fichier (`tests/etat.test.js` et
`tests/faits.test.js`) précisément pour que la fusion ne pose ce problème qu'une
fois, au même endroit.

**Le PRP 02 annonce `etat.js` comme relevant du PRP 04 ; l'ossature §6 le
partage entre 03 et 04.** L'ossature gagne : elle est le contrat commun, et le
PRD §7.1 fait du prénom la toute première chose que l'app demande — le PRP 03 ne
peut pas la livrer sans écrire dans `localStorage`. Ce PRP n'écrit donc que la
moitié « faits ».

**Un stockage capté à l'import est une page blanche, pas une progression
perdue.** Certains navigateurs font lever le simple accès à `localStorage` en
navigation privée. `stockage()` doit être appelée à chaque lecture et à chaque
écriture, jamais évaluée au chargement du module. Le sixième test de
`tests/faits.test.js` est là pour ça, et il est le seul à l'attraper.

**Une case `disabled` n'émet jamais `change`.** C'est la traduction DOM de
« l'avenir ne se coche pas », et elle double le verrou du modèle. Le mécanisme
reste local : un enfant qui retire l'attribut depuis les outils de développement
cochera. C'est assumé — PRD §14, *« une équipe de gamins qui se connaissent, la
triche se voit au vestiaire »* — et le lot 2 y répond côté serveur, qui
recalcule le dénominateur du rang avec sa propre horloge (ossature §5).

**`part` du modèle n'est pas `progression()` du domaine.** Le premier est
`coches / total` de **cette** séance et sert la barre de l'écran ; le second est
la part de ce qui est programmée **à ce jour** et sert le rang (PRD §9). Les
confondre ferait afficher 100 % dès la première séance finie. Le PRP 05 et le
PRP 07 utilisent le second.

**`marcq:seance-complete` ne se déclenche qu'à la transition.** Le drapeau
`complete` est initialisé à l'état d'ouverture : une séance déjà finie qu'on
rouvre ne rejoue rien, décocher puis recocher la dernière case la rejoue une
fois. Sans ce garde, les confettis du PRP 06 repartiraient à chaque tap sur une
séance terminée.

**Un chemin de trop dans `COQUE` supprime l'hors-ligne, en silence.**
`cache.addAll` est atomique : une seule entrée en 404 fait échouer
l'installation, et le service worker n'active jamais. L'app continue de
fonctionner en ligne — c'est ce qui rend la panne invisible pendant des semaines.
`tests/coque.test.js` du PRP 01 vérifie la liste à chaque exécution ; n'y ajoute
un chemin que le jour où le fichier existe.

**Le PRD §7.3 promet une animation de récompense à la validation de la séance ;
ce PRP ne la pose pas.** Ce n'est pas une contradiction du PRD mais le découpage
du lot 1 : l'écran affiche « Séance complète » et émet `marcq:seance-complete`,
le PRP 06 y branche les confettis. Livrer ce PRP seul donne une app complète et
utilisable, simplement sobre.

**Le fragment ne part jamais au serveur.** Ni `main.go` ni Traefik ne voient
`#/seance/2026-08-03` — il n'y a donc aucune route HTTP à ajouter, et le
`GET /` du serveur de fichiers suffit. Corollaire à ne pas oublier au PRP 05 :
un lien profond partagé par messagerie s'ouvre bien sur le bon écran, puisque la
coque est la même.

**`./init.sh --check` refuse la chaîne `x-forwarded-user` dans tout fichier
suivi de `apps/marcq-handball/` hors `.md`** (`init.sh:1444-1452`). Rien de ce
PRP ne lit d'identité : l'écran de séance ne connaît que `localStorage`. Si un
jour une vue devait distinguer des utilisateurs, ce ne serait pas par cet
en-tête — en palier `public`, Traefik ne le pose ni ne l'écrase, il est forgé
par le client.
