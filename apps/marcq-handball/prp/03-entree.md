# PRP 03 — L'entrée sans friction et l'écran du jour

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `apps/marcq-handball/PRODUCT.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/entree` |
| **Dépend de** | PRP 01 (la coque `web/index.html`, `web/style.css`, `web/sw.js`, le serveur qui sert `web/` à la racine) et PRP 02 (`web/domaine.js`, `web/programme.json`, `package.json`, `test.sh` qui lance `node --test tests/*.test.js`) |
| **Débloque** | PRP 04 (séance), 05 (perso), 06 (récompenses), 10 (ressenti), 11 (bilan) — tous montent leur écran par le routeur défini ici |
| **Sections du PRD** | §4 (l'entrée sans friction), §7.1 (premier lancement), §7.2 (retour), §6 lot 1 items 1-2, §14 (perte du téléphone) |

## Objectif

L'enfant ouvre le lien, donne son prénom une fois, et se retrouve devant la
séance du jour — sans compte, sans installation, et sans qu'un stockage refusé
ne le renvoie jamais à l'écran de départ.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/*.test.js` affiche `# pass 52` et `# fail 0`.
- Un stockage refusé (navigation privée) ou plein ne fait lever aucune exception,
  et le prénom n'est **pas redemandé** au rendu suivant — deux assertions de
  `tests/etat.test.js`.
- Les trois cas de `seanceDuJour` produisent trois textes distincts et exacts —
  six assertions sur `modeleJour` dans `tests/vues.test.js`, dont
  `'8 exercices · lundi 3 août'` et `'Prochaine séance mercredi 5 août : Fractionné.'`.
- La phrase du PRD §7.1 — `Ton prénom reste sur ton téléphone.` — et
  l'avertissement du PRD §14 sont comparés **au mot près**, pas relus à l'œil.
- `toutEffacer()` efface les quatre clés `marcq.*` d'un magasin qui en contient
  cinq, et laisse la cinquième intacte.
- Toute classe posée par un écran existe comme sélecteur dans `web/style.css`.
- `./init.sh --check` est vert et `./apps/marcq-handball/test.sh` passe.

## Périmètre

**Dedans :** `web/etat.js` en entier (ossature §6 : les six fonctions, la
tolérance au stockage refusé ou plein) ; `web/vue-prenom.js` (l'écran de premier
lancement) ; `web/vue-jour.js` (les trois cas de `seanceDuJour`) ;
`web/vue-reglages.js` (les deux gestes du PRD §7.2 et l'avertissement §14) ;
`web/app.js` (amorçage, jour courant, routeur, contexte) ; la coque
`web/index.html` ; le style des écrans dans `web/style.css` ; l'entrée des
nouveaux modules dans la coque hors ligne de `web/sw.js` ;
`tests/etat.test.js` et `tests/vues.test.js` ; une section du `README.md`.

**Dehors, et pourquoi :**
- **Cocher quoi que ce soit — PRP 04.** `etat.js` expose `cocher`/`decocher` et
  ils sont testés ici, mais aucun écran ne les appelle : l'écran de séance et sa
  route `#/seance/<date>` sont le PRP 04.
- **Les animations — PRP 06.** Rien ne bouge dans ce PRP, donc rien à protéger
  derrière `prefers-reduced-motion`. Le point de démontage que le routeur rend
  disponible existe pour lui.
- **L'écran perso et le calendrier — PRP 05.** Le lien de navigation
  correspondant n'est pas posé ici : un lien vers un écran qui n'existe pas
  coûte plus qu'un lien absent.
- **Le classement, le ressenti, le bilan — lots 2 et 3.**

## Interfaces

**Consomme :**

```js
// web/domaine.js — PRP 02, ossature §5
seanceDuJour(prog, aujourdhui)          // -> { seance: Seance|null, cas } cas ∈ {aujourd-hui, repos, terminee}
etatSeance(prog, dateISO, aujourdhui, faits = {})  // -> { statut, cochable, total, coches } | null
chargerProgramme(json)                  // -> Programme gelé ; lève si invalide
// Programme : { titre, debut, fin, seances: [{ date, semaine, titre, blocs: [...] }] }
```

Du PRP 01 : `web/index.html` (réécrit ici), `web/style.css` (complété ici),
`web/sw.js` (sa liste de coque est complétée ici), et un serveur qui sert tout
`web/` **à la racine** depuis `//go:embed web` (ossature §7) — ajouter un module
ne demande donc aucune ligne de Go.

Du PRP 02 : `apps/marcq-handball/package.json` (`"type": "module"`, sans quoi
Node lit les modules comme du CommonJS) et `test.sh`, qui lance déjà
`node --test tests/*.test.js` — un fichier de test ajouté est pris d'office.

**Produit :**

```js
// web/etat.js — les six fonctions de l'ossature §6, plus les valeurs de retour
// et les trois constantes de clés, fixées ici.
export const CLE_PRENOM   = 'marcq.v1.prenom';
export const CLE_FAITS    = 'marcq.v1.faits';
export const PREFIXE_CLES = 'marcq.';
export function lirePrenom()      // -> string | null
export function ecrirePrenom(p)   // -> string réellement écrit | null si vide après nettoyage
export function lireFaits()       // -> { [idExercice]: horodatageISO }, {} si vide ou illisible
export function cocher(id, quand = new Date().toISOString())  // -> les faits à jour
export function decocher(id)      // -> les faits à jour
export function toutEffacer()     // -> nombre de clés `marcq.` effacées

// web/app.js
export const aujourdhui = () => 'YYYY-MM-DD'          // Europe/Paris, ossature §5
export const ECRANS = [{ nom, motif, monter }, …]     // le tableau des routes
export const LIENS = [{ href, texte }, …]             // les onglets de la barre de navigation
export function choisirEcran(route)                   // -> entrée d'ECRANS | null

// web/vue-prenom.js
export const PHRASE_RASSURANTE = 'Ton prénom reste sur ton téléphone.';
export function monterPrenom(hote, ctx)

// web/vue-jour.js
export function dateEnToutesLettres(dateISO)  // '2026-08-03' -> 'lundi 3 août'
export function modeleJour(ctx)               // -> { cas, salutation, titre, details, lien, etat }
export function monterJour(hote, ctx)

// web/vue-reglages.js
export const AVERTISSEMENT_SAUVEGARDE;   // PRD §14
export const CONFIRMATION_CHANGEMENT;    // PRD §7.2
export function monterReglages(hote, ctx)
```

Et dans `web/style.css`, la fabrique visuelle que les PRP 04, 05, 06, 08, 09, 10
et 11 consomment telle quelle : neuf jetons, posés à la tâche 7.

```css
:root {
  --marcq-encre;        /* le texte */
  --marcq-encre-douce;  /* le texte secondaire */
  --marcq-fond;         /* le fond de page */
  --marcq-carte;        /* le fond d’un bloc posé sur la page */
  --marcq-accent;       /* l’action, 7,4:1 sur blanc */
  --marcq-sur-accent;   /* le texte posé sur l’accent */
  --marcq-danger;       /* l’irréversible, 7,9:1 sur blanc */
  --marcq-trait;        /* les bordures */
  --marcq-tap;          /* 48px — la zone de tap du PRD §11 */
}
```

Et dix classes partagées : `.ecran` (la colonne d'un écran), `.titre-ecran`,
`.titre-bloc`, `.aide` (une ligne d'explication), `.barre` et `.compte` (une
progression), `.lien-nav` (un onglet), `.bouton` et `.bouton-principal`, `.panne`
(un message d'échec). Les valeurs sont à la tâche 7 : un PRP aval pose ces noms
et n'écrit en dur ni couleur, ni hauteur de zone de tap.

### Le contrat d'écran — c'est lui que les PRP 04, 05, 06, 10 et 11 consomment

Il n'y a pas de bibliothèque, et il n'y en aura pas : l'ossature §2 interdit
toute dépendance. Cinq écrans ne valent ni un routeur ni un moteur de rendu ; ils
valent un tableau, une expression rationnelle par route, et une fonction par
écran.

**Un écran est une fonction `(hote, ctx) => demontage | undefined`.**

- `hote` est l'élément `<main id="ecran">` de la coque. **Le routeur le vide
  avant chaque montage** : tout ce qui est écrit dedans, écouteurs compris,
  disparaît sans qu'un écran ait à s'en occuper.
- La valeur rendue, si c'est une fonction, est appelée **avant** le montage
  suivant. Elle ne sert qu'à ce qui déborde de `hote` — une minuterie, un
  écouteur posé sur `window`. Aucun écran de ce PRP n'en a besoin ; le PRP 06,
  qui pose des animations à minuterie, en aura besoin, et sans ce point
  d'accroche elles continueraient à tourner sur l'écran suivant.

**`ctx` est le contexte, relu par le routeur avant chaque rendu :**

| Champ | Valeur |
|---|---|
| `ctx.prog` | le `Programme` gelé, chargé une fois à l'amorçage |
| `ctx.aujourdhui` | `'YYYY-MM-DD'` en `Europe/Paris`, **calculé une seule fois** |
| `ctx.prenom` | `string` — jamais `null` dans un écran autre que `vue-prenom` |
| `ctx.faits` | `{ [id]: isoString }` relu depuis le stockage à chaque rendu |
| `ctx.route` | la route courante, `'#/'` quand l'adresse n'a pas d'ancre |
| `ctx.aller(route)` | navigue ; remonte à la main si la route est déjà la courante |
| `ctx.rafraichir()` | remonte l'écran courant après une écriture |

**Deux règles que les PRP aval respectent sans qu'on les leur répète :**

1. **Un écran ne mute jamais `ctx`.** Il écrit par `etat.js`, puis met sa ligne à
   jour sur place — ou appelle `ctx.rafraichir()` si le changement déborde de
   l'écran (le prénom, l'effacement). Le rendu suivant relit le stockage de
   toute façon ; muter `ctx` créerait un second état, divergent et invisible.
2. **Un écran n'en monte jamais un autre.** Il pose un `<a href="#/…">` ou
   appelle `ctx.aller`. C'est ce qui fait que le bouton retour du téléphone
   fonctionne : chaque écran est une entrée d'historique.

**Les routes.** `location.hash`, et pas l'API History : le hash ne demande
aucune route côté serveur, survit au service worker, et fait du bouton retour
d'Android une navigation entre écrans plutôt qu'une sortie de l'application.

| Route | Écran | Posée par |
|---|---|---|
| `#/` (ou adresse sans ancre) | le jour | **ce PRP** |
| `#/reglages` | les réglages | **ce PRP** |
| `#/seance/<YYYY-MM-DD>` | la séance | PRP 04 |
| `#/perso` | la progression | PRP 05 |
| `#/bilan` | le bilan | PRP 11 |

Ajouter un écran, c'est ajouter **un import et une ligne** dans `ECRANS`, et une
ligne dans `LIENS` si l'écran mérite un onglet. Une route inconnue n'affiche
jamais un écran vide : le routeur réécrit l'adresse en `#/` par `replaceState` —
sans empiler d'entrée, sinon le bouton retour rejouerait la route morte.

### Les noms introduits ici, absents de `00-ossature.md`

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/vue-prenom.js` | L'écran de premier lancement. L'ossature §3 liste les quatre écrans connus à sa rédaction ; l'accueil est le cinquième, et il a sa propre route de montage. Le fondre dans `vue-reglages.js` ferait mentir le tableau des écrans ; le fondre dans `app.js` mélangerait le routeur et une vue. La route `GET /vue-*.js` de l'ossature §7 le couvre déjà. |
| `tests/vues.test.js` | Les modèles purs des écrans et les phrases que le PRD fixe au mot près. `tests/etat.test.js` porte le stockage ; y loger des assertions d'interface le rendrait faux de nom. |
| `ECRANS`, `choisirEcran`, `LIENS` | Le tableau des routes, sa consultation pure — testable sans navigateur — et les onglets de navigation. |
| `modeleJour`, `dateEnToutesLettres` | Le calcul de ce que l'écran du jour affiche, séparé de son écriture dans le DOM. C'est ce qui rend les trois cas du PRD §6 vérifiables par `node --test`, sans navigateur ni dépendance. |
| `PHRASE_RASSURANTE`, `AVERTISSEMENT_SAUVEGARDE`, `CONFIRMATION_CHANGEMENT` | Trois phrases exigées par le PRD (§7.1, §14, §7.2). Exportées pour être comparées par un test : une reformulation bien intentionnée les perdrait en silence. |
| `CLE_PRENOM`, `CLE_FAITS`, `PREFIXE_CLES` | Les clés de l'ossature §6, nommées une fois. Le lot 2 ajoutera les siennes ; `PREFIXE_CLES` est ce qui fait que « changer d'enfant » les emporte aussi. |
| Les neuf jetons `--marcq-*` et les dix classes partagées de `web/style.css` | `--marcq-encre`, `--marcq-encre-douce`, `--marcq-fond`, `--marcq-carte`, `--marcq-accent`, `--marcq-sur-accent`, `--marcq-danger`, `--marcq-trait`, `--marcq-tap` ; `.ecran`, `.titre-ecran`, `.titre-bloc`, `.aide`, `.barre`, `.compte`, `.lien-nav`, `.bouton`, `.bouton-principal`, `.panne`. L'ossature ne fixe aucune valeur d'apparence : elles sont nommées ici une fois, à la tâche 7, et les PRP 04 à 11 les reprennent au lieu de réinventer chacun sa couleur et sa hauteur de tap. Le préfixe `--marcq-` les distingue de tout jeton d'une autre origine dans la même feuille — ceux du PRP 01, notamment, que cette famille remplace. |
| `<main id="ecran">`, `<nav id="nav">` | Les deux points d'ancrage de la coque. Le premier reçoit les écrans, le second la barre d'onglets — qui vit **hors** de `#ecran` pour ne pas clignoter d'un écran à l'autre. |
| `ecrirePrenom` rend le prénom écrit ou `null` ; `cocher`/`decocher` rendent les faits à jour ; `toutEffacer` rend un nombre | L'ossature §6 fixe les signatures, pas les retours. Les PRP 04 et 05 s'appuient dessus. |

## Fichiers

- Créer : `apps/marcq-handball/web/etat.js`,
  `apps/marcq-handball/web/vue-prenom.js`,
  `apps/marcq-handball/web/vue-jour.js`,
  `apps/marcq-handball/web/vue-reglages.js`,
  `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/tests/etat.test.js`,
  `apps/marcq-handball/tests/vues.test.js`
- Modifier : `apps/marcq-handball/web/index.html`,
  `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/etat.test.js`,
  `apps/marcq-handball/tests/vues.test.js`

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/entree
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`. Les tâches s'exécutent **dans l'ordre** : chaque module en importe
un écrit par la tâche précédente, et un import statique manquant fait échouer le
fichier de test entier, pas seulement une assertion.

---

### Tâche 1 — `etat.js` : le prénom et la progression sur le téléphone

**Fichiers :** Créer `apps/marcq-handball/tests/etat.test.js` · Créer `apps/marcq-handball/web/etat.js`

PRD §5 : *« Le prénom de l'enfant ne quitte jamais son appareil. »* Le serveur ne
connaît aucun utilisateur ; ce module est donc le seul endroit de l'application
où quelque chose persiste, et l'ossature §6 en fixe les clés au caractère près.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/etat.test.js` :

```js
// tests/etat.test.js — le contrat de stockage local (ossature §6).
// Ce repertoire n'est jamais embarque dans l'image : voir .dockerignore.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as etat from '../web/etat.js';

// Node n'expose `localStorage` que derriere un drapeau, et parfois en lecture
// seule : `defineProperty` pose le magasin dans les deux cas, la ou une simple
// affectation leverait.
function poserMagasin(magasin) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: magasin,
  });
}

// Un faux magasin fidele a l'API Storage — `length` et `key()` comprises, car
// c'est par elles que `toutEffacer` enumere les cles.
function fauxMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get length() { return donnees.size; },
    key(i) { return [...donnees.keys()][i] ?? null; },
    getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
    setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
    removeItem(cle) { donnees.delete(cle); },
    contenu() { return Object.fromEntries(donnees); },
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  // `etat.js` garde un repli en memoire qui survit d'un test a l'autre : sans
  // cet appel, un test heriterait du prenom du precedent.
  etat.toutEffacer();
});

test('le prenom se lit, s ecrit, et se nettoie au passage', () => {
  assert.equal(etat.lirePrenom(), null, 'aucun prenom au premier lancement');
  assert.equal(etat.ecrirePrenom('  Lucas \n'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas');
  assert.equal(etat.ecrirePrenom('Jean   Baptiste'), 'Jean Baptiste', 'espaces internes reduits');
});

test('un prenom vide n est pas enregistre, un prenom trop long est tronque', () => {
  assert.equal(etat.ecrirePrenom('   '), null);
  assert.equal(etat.lirePrenom(), null, 'rien n a ete ecrit');
  assert.equal(etat.ecrirePrenom(''), null);
  assert.equal(etat.ecrirePrenom(42), null, 'une valeur qui n est pas une chaine ne passe pas');
  assert.equal(etat.ecrirePrenom('a'.repeat(30)), 'a'.repeat(24), '24 caracteres au plus');
});

test('les cles sont celles de l ossature §6, au caractere pres', () => {
  etat.ecrirePrenom('Lucas');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.equal(etat.CLE_PRENOM, 'marcq.v1.prenom');
  assert.equal(etat.CLE_FAITS, 'marcq.v1.faits');
  assert.equal(globalThis.localStorage.getItem('marcq.v1.prenom'), 'Lucas');
  assert.equal(
    globalThis.localStorage.getItem('marcq.v1.faits'),
    '{"s1-r1":"2026-08-03T18:22:11.000Z"}',
  );
});

test('cocher pose un horodatage, decocher supprime la cle', () => {
  assert.deepEqual(etat.lireFaits(), {}, 'aucune progression au depart');
  assert.deepEqual(etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z'), {
    's1-r1': '2026-08-03T18:22:11.000Z',
  });
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
  assert.deepEqual(etat.decocher('s1-r1'), {}, 'decocher ne laisse pas un booleen derriere lui');
  assert.deepEqual(etat.lireFaits(), {});
});

test('recocher ne rajeunit pas la marque (PRD §9 : le premier arrive a ce score)', () => {
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  etat.cocher('s1-r1', '2026-08-20T09:00:00.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
});

test('cocher sans horodatage prend l heure courante, au format ISO', () => {
  etat.cocher('s2-c1');
  assert.match(etat.lireFaits()['s2-c1'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('une progression illisible ou d un autre schema rend un objet vide', () => {
  poserMagasin(fauxMagasin({ 'marcq.v1.faits': '{ceci n est pas du JSON' }));
  assert.deepEqual(etat.lireFaits(), {});

  poserMagasin(fauxMagasin({ 'marcq.v1.faits': '["s1-r1"]' }));
  assert.deepEqual(etat.lireFaits(), {}, 'un tableau n est pas la forme attendue');

  poserMagasin(fauxMagasin({
    'marcq.v1.faits': '{"s1-r1": true, "s1-r2": "2026-08-03T18:22:11.000Z"}',
  }));
  assert.deepEqual(
    etat.lireFaits(),
    { 's1-r2': '2026-08-03T18:22:11.000Z' },
    'les couples mal formes sont ignores, les autres survivent',
  );
});

test('changer d enfant efface toutes les cles marcq, et rien d autre (PRD §7.2)', () => {
  poserMagasin(fauxMagasin({
    'marcq.v1.prenom': 'Lucas',
    'marcq.v1.faits': '{"s1-r1":"2026-08-03T18:22:11.000Z"}',
    'marcq.v1.classement': '{"pseudo":"Faucon"}',
    'marcq.v0.vieillerie': 'a jeter aussi',
    'autre-app.reglages': 'ne pas toucher',
  }));
  assert.equal(etat.toutEffacer(), 4, 'quatre cles marcq effacees, la cinquieme est etrangere');
  assert.equal(etat.lirePrenom(), null);
  assert.deepEqual(etat.lireFaits(), {});
  assert.deepEqual(globalThis.localStorage.contenu(), { 'autre-app.reglages': 'ne pas toucher' });
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/etat.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/apps/marcq-handball/web/etat.js'`,
`# pass 0`, `# fail 1`.

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/etat.js` :

```js
// etat.js — tout ce qui persiste sur le telephone, et rien d'autre.
//
// Le serveur ne connait aucun utilisateur (PRD §5) : le prenom et la
// progression vivent ici, sous des cles prefixees `marcq.v1.` (ossature §6). Le
// numero de version est dans la cle, pas dans la valeur : changer de schema
// s'ecrit en `v2` et se migre depuis `v1`, sans jamais lire une valeur au
// mauvais format.

export const CLE_PRENOM = 'marcq.v1.prenom';
export const CLE_FAITS = 'marcq.v1.faits';
export const PREFIXE_CLES = 'marcq.';

const PRENOM_MAX = 24;

// Le magasin est relu a chaque appel, jamais capture a l'import : sur certains
// navigateurs en navigation privee, l'acces a la propriete leve au lieu de
// rendre un objet, et un module qui l'aurait capture au chargement serait mort
// avant d'avoir servi.
function magasin() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function lireCle(cle) {
  const m = magasin();
  if (m === null) return null;
  try {
    return m.getItem(cle);
  } catch {
    return null;
  }
}

// Rend true si l'ecriture a eu lieu. Un quota plein leve : on trace, et l'app
// continue — la seance en cours reste utilisable meme sans memoire.
function ecrireCle(cle, valeur) {
  const m = magasin();
  if (m === null) return false;
  try {
    m.setItem(cle, valeur);
    return true;
  } catch (err) {
    console.warn(`marcq : ecriture de ${cle} refusee`, err);
    return false;
  }
}

function effacerCle(cle) {
  const m = magasin();
  if (m === null) return false;
  try {
    m.removeItem(cle);
    return true;
  } catch (err) {
    console.warn(`marcq : suppression de ${cle} refusee`, err);
    return false;
  }
}

const estCleMarcq = (cle) => typeof cle === 'string' && cle.startsWith(PREFIXE_CLES);

// --- le prenom ------------------------------------------------------------

// Espaces de bord retires, espaces internes reduits a un, et 24 caracteres au
// plus. Un prenom colle depuis une suggestion de clavier arrive souvent avec un
// saut de ligne ; il ne doit pas s'afficher sur deux lignes.
function normaliserPrenom(brut) {
  return brut.replace(/\s+/g, ' ').trim().slice(0, PRENOM_MAX).trimEnd();
}

export function lirePrenom() {
  const brut = lireCle(CLE_PRENOM);
  if (typeof brut !== 'string') return null;
  const propre = normaliserPrenom(brut);
  return propre === '' ? null : propre;
}

// Rend le prenom effectivement enregistre, ou null si l'entree est vide une fois
// nettoyee. On tronque plutot que de refuser au-dela de 24 caracteres : a 13
// ans, un prenom trop long est une faute de frappe, pas une demande a rejeter
// par un message d'erreur — et le PRD §4 se joue sur cet ecran.
export function ecrirePrenom(p) {
  const propre = normaliserPrenom(typeof p === 'string' ? p : '');
  if (propre === '') return null;
  ecrireCle(CLE_PRENOM, propre);
  return propre;
}

// --- la progression -------------------------------------------------------

// Rend { [idExercice]: horodatageISO }. Un stockage vide, refuse ou illisible
// rend {} : l'app demarre alors sans memoire, mais elle demarre.
export function lireFaits() {
  const brut = lireCle(CLE_FAITS);
  if (brut === null || brut === '') return {};

  let valeur;
  try {
    valeur = JSON.parse(brut);
  } catch (err) {
    console.warn('marcq : progression illisible, elle est ignoree', err);
    return {};
  }
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return {};

  // On ne retient que les couples bien formes : une cle dont la valeur n'est pas
  // une chaine vient d'un schema qui n'est pas le notre, et la laisser passer
  // ferait echouer le tri des egalites au classement (PRD §9).
  const faits = {};
  for (const [id, quand] of Object.entries(valeur)) {
    if (id !== '' && typeof quand === 'string' && quand !== '') faits[id] = quand;
  }
  return faits;
}

function ecrireFaits(faits) {
  return ecrireCle(CLE_FAITS, JSON.stringify(faits));
}

// Coche un exercice et rend les faits a jour. L'horodatage n'est pas decoratif :
// le PRD §9 departage les egalites au classement par « le premier arrive a ce
// score ». Recocher ne rajeunit donc pas la marque.
export function cocher(id, quand = new Date().toISOString()) {
  const faits = lireFaits();
  if (faits[id] !== undefined) return faits;
  faits[id] = quand;
  ecrireFaits(faits);
  return faits;
}

// Decocher supprime la cle : un booleen `false` trainerait indefiniment et
// gonflerait le stockage pour ne rien dire (ossature §6).
export function decocher(id) {
  const faits = lireFaits();
  if (faits[id] === undefined) return faits;
  delete faits[id];
  ecrireFaits(faits);
  return faits;
}

// « Changer d'enfant » (PRD §7.2). Rend le nombre de cles effacees.
//
// On enumere le magasin au lieu de retirer deux cles connues : sinon la cle
// `marcq.v1.classement` que posera le lot 2 survivrait au changement, et le
// nouvel arrivant heriterait du pseudonyme et du code du precedent. On passe par
// `length` et `key()` — l'API du stockage — plutot que par `Object.keys`, et on
// collecte avant d'effacer : retirer pendant l'enumeration en sauterait une sur
// deux.
export function toutEffacer() {
  const m = magasin();
  if (m === null) return 0;

  const cles = [];
  try {
    for (let i = 0; i < m.length; i += 1) {
      const cle = m.key(i);
      if (estCleMarcq(cle)) cles.push(cle);
    }
  } catch (err) {
    console.warn('marcq : enumeration du stockage impossible', err);
    return 0;
  }

  for (const cle of cles) effacerCle(cle);
  return cles.length;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/etat.test.js` · Attendu :
SUCCÈS, `# pass 8`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/etat.js apps/marcq-handball/tests/etat.test.js
git commit -m "marcq-handball : le prenom et la progression sur le telephone"
git push -u origin HEAD
```

---

### Tâche 2 — un stockage refusé ou plein ne renvoie jamais à l'écran de départ

**Fichiers :** Modifier `apps/marcq-handball/web/etat.js` · Tester `apps/marcq-handball/tests/etat.test.js`

L'ossature §6 l'exige : *« Un `localStorage` illisible ou refusé ne casse jamais
l'app. […] l'app reste utilisable pour la séance en cours. »* La tâche 1 ne jette
pas — mais elle ne suffit pas, et le défaut est vicieux : sans stockage,
`ecrirePrenom` réussit du point de vue de l'écran d'accueil, `lirePrenom` rend
`null` au rendu suivant, et le routeur redemande le prénom. **En boucle.** Une
app qui redemande son prénom à chaque tap est pire qu'une app sans mémoire.

Le remède tient en une ligne de politique : *ce qui n'a pas pu être écrit dans le
stockage est gardé en mémoire pour la durée de l'onglet, et relu en priorité.*

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/etat.test.js` :

```js
test('un stockage refuse ne fait jamais lever, et la seance en cours continue', () => {
  // Navigation privee : l'acces a la propriete elle-meme leve.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('acces au stockage refuse'); },
  });

  assert.equal(etat.lirePrenom(), null, 'rien n a jamais ete ecrit');
  assert.deepEqual(etat.lireFaits(), {});
  assert.equal(etat.ecrirePrenom('Lucas'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas', 'sans repli, l accueil redemanderait le prenom en boucle');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
  etat.decocher('s1-r1');
  assert.deepEqual(etat.lireFaits(), {});
  // Le prenom et la progression sont deux cles, toutes deux dans le repli.
  assert.equal(etat.toutEffacer(), 2, 'ce qui est garde en memoire part aussi');
  assert.equal(etat.lirePrenom(), null);
});

test('un quota plein n empeche pas de finir la seance', () => {
  poserMagasin({
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem() {
      const err = new Error('quota depasse');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem() {},
  });

  assert.equal(etat.ecrirePrenom('Lucas'), 'Lucas');
  assert.equal(etat.lirePrenom(), 'Lucas', 'garde en memoire, relu en priorite');
  etat.cocher('s1-r1', '2026-08-03T18:22:11.000Z');
  assert.deepEqual(etat.lireFaits(), { 's1-r1': '2026-08-03T18:22:11.000Z' });
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/etat.test.js`
Attendu : ÉCHEC, `# pass 8` et `# fail 2`, le premier sur
`AssertionError [ERR_ASSERTION]: sans repli, l accueil redemanderait le prenom en boucle`
(`expected: 'Lucas'`, `actual: null`), le second sur
`garde en memoire, relu en priorite`.

- [ ] **Étape 3 — l'implémentation minimale**

Dans `apps/marcq-handball/web/etat.js`, **remplacer** `lireCle`, `ecrireCle`,
`effacerCle` et `toutEffacer` par les versions suivantes, et ajouter la
déclaration de `memoire` juste au-dessus de `lireCle` :

```js
// Ce qui n'a pas pu etre ecrit dans le stockage est garde ici, le temps de
// l'onglet, et relu en priorite. C'est ce qui evite le pire defaut possible :
// un prenom qui ne s'enregistre pas, donc un ecran d'accueil qui le redemande a
// chaque rendu. Une fois l'ecriture reussie pour de bon, l'entree disparait —
// le repli n'est jamais un second etat durable.
const memoire = new Map();

function lireCle(cle) {
  if (memoire.has(cle)) return memoire.get(cle);
  const m = magasin();
  if (m === null) return null;
  try {
    return m.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireCle(cle, valeur) {
  memoire.set(cle, valeur);
  const m = magasin();
  if (m === null) return false;
  try {
    m.setItem(cle, valeur);
    memoire.delete(cle);
    return true;
  } catch (err) {
    console.warn(`marcq : ecriture de ${cle} refusee, valeur gardee en memoire`, err);
    return false;
  }
}

function effacerCle(cle) {
  memoire.delete(cle);
  const m = magasin();
  if (m === null) return false;
  try {
    m.removeItem(cle);
    return true;
  } catch (err) {
    console.warn(`marcq : suppression de ${cle} refusee`, err);
    return false;
  }
}

// « Changer d'enfant » (PRD §7.2). Rend le nombre de cles effacees, repli en
// memoire compris — sinon un prenom qui n'avait pas pu s'ecrire survivrait au
// changement d'enfant, ce qui est exactement ce que ce geste doit empecher.
//
// On enumere au lieu de retirer deux cles connues : la cle
// `marcq.v1.classement` que posera le lot 2 doit partir aussi. On passe par
// `length` et `key()` — l'API du stockage — plutot que par `Object.keys`, et on
// collecte avant d'effacer : retirer pendant l'enumeration en sauterait une sur
// deux.
export function toutEffacer() {
  const cles = new Set([...memoire.keys()].filter(estCleMarcq));

  const m = magasin();
  if (m !== null) {
    try {
      for (let i = 0; i < m.length; i += 1) {
        const cle = m.key(i);
        if (estCleMarcq(cle)) cles.add(cle);
      }
    } catch (err) {
      console.warn('marcq : enumeration du stockage impossible', err);
    }
  }

  for (const cle of cles) effacerCle(cle);
  return cles.size;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/etat.test.js` · Attendu :
SUCCÈS, `# pass 10`, `# fail 0`. Deux `console.warn` s'impriment au passage :
c'est le comportement attendu, pas un échec.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/etat.js apps/marcq-handball/tests/etat.test.js
git commit -m "marcq-handball : un stockage refuse ou plein ne casse jamais l'app"
git push
```

---

### Tâche 3 — l'écran de premier lancement : un champ, un bouton

**Fichiers :** Créer `apps/marcq-handball/tests/vues.test.js` · Créer `apps/marcq-handball/web/vue-prenom.js`

PRD §7.1 : *« Une seule chose lui est demandée : son prénom. Un champ, un bouton.
Pas de mot de passe, pas d'e-mail, pas de date de naissance, pas d'écran de
bienvenue à faire défiler. »* La cible du PRD §4 — plus de 90 % des enfants
atteignent la première séance — se joue entièrement ici : tout ce qu'on ajoute à
cet écran la fait baisser. Le test compte donc les champs, et compare la phrase
rassurante au mot près.

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/vues.test.js` :

```js
// tests/vues.test.js — ce que les ecrans disent, sans navigateur.
//
// Les fonctions de montage touchent au DOM et ne se testent pas ici. Ce qui se
// teste : les modeles — purs — et les phrases que le PRD fixe au mot pres. Aucun
// module de vue ne touche au DOM a l'evaluation ; c'est ce qui les rend
// importables par `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHRASE_RASSURANTE } from '../web/vue-prenom.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

test('le premier lancement ne demande que le prenom (PRD §7.1)', () => {
  assert.equal(PHRASE_RASSURANTE, 'Ton prénom reste sur ton téléphone.');

  const code = source('vue-prenom.js');
  assert.equal(
    (code.match(/createElement\('input'\)/g) ?? []).length,
    1,
    'un champ, et un seul',
  );
  assert.equal(
    (code.match(/createElement\('button'\)/g) ?? []).length,
    1,
    'un bouton, et un seul',
  );
  for (const interdit of ["'password'", "'email'", "'date'", "'tel'", "'number'"]) {
    assert.equal(code.includes(interdit), false, `le premier lancement ne demande pas ${interdit}`);
  }
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/apps/marcq-handball/web/vue-prenom.js'`,
`# pass 0`, `# fail 1`.

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/vue-prenom.js` :

```js
// vue-prenom.js — le premier lancement. Un champ, un bouton, une phrase.
//
// PRD §7.1. C'est le seul peage de l'application, et il n'est demande qu'une
// fois. Il ne route pas : il ecrit le prenom puis rend la main au routeur, qui
// relit le stockage et monte l'ecran demande.

import { ecrirePrenom } from './etat.js';

// La phrase du PRD §7.1, au mot pres. Elle est ce qui rend l'absence de compte
// credible plutot que suspecte ; un test verifie qu'elle n'a pas ete reformulee.
export const PHRASE_RASSURANTE = 'Ton prénom reste sur ton téléphone.';

export function monterPrenom(hote, ctx) {
  const section = document.createElement('section');
  section.className = 'ecran ecran-prenom';

  // Le titre vient du programme, jamais d'une chaine recopiee : le PRD §8 veut
  // un fichier de donnees reutilisable la saison suivante.
  const titre = document.createElement('h1');
  titre.className = 'titre-accueil';
  titre.textContent = ctx.prog.titre;

  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-prenom';
  // La validation native afficherait une bulle en anglais sur certains
  // navigateurs ; on prefere ne rien reprocher et remettre le curseur.
  formulaire.noValidate = true;

  const etiquette = document.createElement('label');
  etiquette.className = 'etiquette';
  etiquette.htmlFor = 'champ-prenom';
  etiquette.textContent = 'Ton prénom';

  const champ = document.createElement('input');
  champ.className = 'champ';
  champ.id = 'champ-prenom';
  champ.name = 'prenom';
  champ.type = 'text';
  champ.autocomplete = 'given-name';
  champ.maxLength = 24;
  // `enterKeyHint` met « OK » sur la touche de validation du clavier mobile :
  // un tap de moins entre le lien recu et la premiere seance.
  champ.enterKeyHint = 'go';

  const aide = document.createElement('p');
  aide.className = 'aide';
  aide.textContent = PHRASE_RASSURANTE;

  const bouton = document.createElement('button');
  bouton.className = 'bouton bouton-principal';
  bouton.type = 'submit';
  bouton.textContent = 'C’est parti';

  formulaire.append(etiquette, champ, aide, bouton);
  section.append(titre, formulaire);
  hote.append(section);
  champ.focus();

  formulaire.addEventListener('submit', (evt) => {
    evt.preventDefault();
    // `ecrirePrenom` rend null si l'entree est vide une fois nettoyee. On ne
    // reproche rien : on remet simplement le curseur dans le champ.
    if (ecrirePrenom(champ.value) === null) {
      champ.focus();
      return;
    }
    ctx.rafraichir();
  });
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js` · Attendu :
SUCCÈS, `# pass 1`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-prenom.js apps/marcq-handball/tests/vues.test.js
git commit -m "marcq-handball : le premier lancement, un champ et un bouton"
git push
```

---

### Tâche 4 — l'écran du jour et ses trois cas

**Fichiers :** Créer `apps/marcq-handball/web/vue-jour.js` · Tester `apps/marcq-handball/tests/vues.test.js`

PRD §6 (lot 1, point 2) : *« la séance prévue aujourd'hui, ou la prochaine, ou le
message de repos »*. `seanceDuJour` (PRP 02) rend trois cas, et l'un d'eux se
subdivise : entre le 18 et le 21 août le programme n'est pas fini mais il n'y a
plus de séance à annoncer — `{ seance: null, cas: 'repos' }`. Un écran qui
déréférencerait `seance.titre` casserait pendant les quatre derniers jours,
c'est-à-dire au pire moment.

Le calcul est séparé de l'écriture dans le DOM : `modeleJour` est pur, donc
`node --test` prouve les quatre textes sans navigateur ni dépendance.

- [ ] **Étape 1 — écrire le test qui échoue**

Dans `apps/marcq-handball/tests/vues.test.js`, ajouter ces deux lignes au groupe
d'imports, sous celui de `vue-prenom.js` :

```js
import * as domaine from '../web/domaine.js';
import { dateEnToutesLettres, modeleJour } from '../web/vue-jour.js';
```

puis ces deux constantes juste sous la déclaration de `source` :

```js
const prog = domaine.chargerProgramme(
  JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8')),
);
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });
```

Puis ajouter à la fin du fichier :

```js
test('jour de seance : le titre du coach, le compte de cases, le lien vers la seance', () => {
  const m = modeleJour(contexte('2026-08-03'));
  assert.equal(m.cas, 'aujourd-hui');
  assert.equal(m.salutation, 'Salut Lucas');
  assert.equal(m.titre, 'Endurance + Renforcement');
  assert.equal(m.details, '8 exercices · lundi 3 août');
  assert.deepEqual(m.lien, { texte: 'Commencer la séance', href: '#/seance/2026-08-03' });
  assert.deepEqual(m.etat, { statut: 'aujourd-hui', cochable: true, total: 8, coches: 0 });
});

test('seance entamee : on reprend, on ne recommence pas', () => {
  const m = modeleJour(contexte('2026-08-03', { 's1-r1': '2026-08-03T18:22:11.000Z' }));
  assert.equal(m.lien.texte, 'Reprendre la séance');
  assert.equal(m.etat.coches, 1);
});

test('jour de repos : on annonce la prochaine seance (PRD §6, lot 1)', () => {
  const m = modeleJour(contexte('2026-08-04'));
  assert.equal(m.cas, 'repos');
  assert.equal(m.titre, 'Repos aujourd’hui');
  assert.equal(m.details, 'Prochaine séance mercredi 5 août : Fractionné.');
  assert.equal(m.lien.href, '#/seance/2026-08-05');
  assert.equal(m.etat, null, 'aucune barre de progression un jour de repos');
});

test('apres la derniere seance mais avant la fin, il n y a plus rien a annoncer', () => {
  const m = modeleJour(contexte('2026-08-20'));
  assert.equal(m.cas, 'repos');
  assert.equal(m.lien, null, 'aucun ecran a ouvrir');
  assert.match(m.details, /^Plus de séance/);
});

test('apres le 21 aout, l ecran annonce la fin du programme (PRD §9)', () => {
  const m = modeleJour(contexte('2026-08-22'));
  assert.equal(m.cas, 'terminee');
  assert.equal(m.titre, 'Programme terminé');
  assert.equal(m.lien, null);
});

test('la date en toutes lettres ne glisse pas d un jour selon le fuseau', () => {
  assert.equal(dateEnToutesLettres('2026-08-03'), 'lundi 3 août');
  assert.equal(dateEnToutesLettres('2026-08-01'), 'samedi 1er août');
  assert.equal(dateEnToutesLettres('2026-08-21'), 'vendredi 21 août');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/apps/marcq-handball/web/vue-jour.js'`,
`# pass 0`, `# fail 1`. Un import statique manquant emporte tout le fichier, y
compris le test de la tâche 3.

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/vue-jour.js` :

```js
// vue-jour.js — l'ecran du jour : la seance d'aujourd'hui, le repos qui annonce
// la prochaine, ou la fin du programme.
//
// `modeleJour` calcule tout ce qui s'affiche et ne touche a rien ; `monterJour`
// l'ecrit dans le DOM et ne calcule rien. C'est ce partage qui rend les trois
// cas du PRD §6 verifiables sans navigateur.

import { etatSeance, seanceDuJour } from './domaine.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// La date en toutes lettres, a partir du jour calendaire seul. On ancre a midi
// UTC et on relit les composantes en UTC : aucun fuseau ne peut alors faire
// glisser le jour d'un cran, ce qu'un `new Date('2026-08-03')` lu en heure
// locale fait des qu'on est a l'ouest de Greenwich.
export function dateEnToutesLettres(dateISO) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const jour = d.getUTCDate();
  return `${JOURS[d.getUTCDay()]} ${jour === 1 ? '1er' : jour} ${MOIS[d.getUTCMonth()]}`;
}

// Le modele de l'ecran. `lien` et `etat` valent null quand il n'y a rien a
// ouvrir ni rien a mesurer — un jour de repos n'a pas de barre de progression.
export function modeleJour(ctx) {
  const { prog, aujourdhui, prenom, faits } = ctx;
  const { seance, cas } = seanceDuJour(prog, aujourdhui);
  const salutation = `Salut ${prenom}`;

  if (cas === 'terminee') {
    return {
      cas,
      salutation,
      titre: 'Programme terminé',
      details: `Le programme s’est arrêté le ${dateEnToutesLettres(prog.fin)}.`,
      lien: null,
      etat: null,
    };
  }

  if (cas === 'repos') {
    // Entre la derniere seance et la fin du programme, `seance` vaut null : il
    // reste du repos, mais plus rien a annoncer.
    if (seance === null) {
      return {
        cas,
        salutation,
        titre: 'Repos aujourd’hui',
        details: `Plus de séance d’ici la fin du programme, le ${dateEnToutesLettres(prog.fin)}.`,
        lien: null,
        etat: null,
      };
    }
    return {
      cas,
      salutation,
      titre: 'Repos aujourd’hui',
      details: `Prochaine séance ${dateEnToutesLettres(seance.date)} : ${seance.titre}.`,
      // Une seance a venir est visible, pas cochable (PRD §9) : on peut lire ce
      // qui arrive.
      lien: { texte: 'Voir la séance', href: `#/seance/${seance.date}` },
      etat: null,
    };
  }

  const etat = etatSeance(prog, seance.date, aujourdhui, faits);
  return {
    cas,
    salutation,
    titre: seance.titre,
    details: `${etat.total} exercices · ${dateEnToutesLettres(seance.date)}`,
    lien: {
      texte: etat.coches === 0 ? 'Commencer la séance' : 'Reprendre la séance',
      href: `#/seance/${seance.date}`,
    },
    etat,
  };
}

export function monterJour(hote, ctx) {
  const m = modeleJour(ctx);

  const section = document.createElement('section');
  section.className = 'ecran ecran-jour';
  section.classList.add(`cas-${m.cas}`);

  const salutation = document.createElement('p');
  salutation.className = 'salutation';
  // `textContent`, jamais `innerHTML` : le prenom vient du champ de l'enfant, il
  // s'affiche, il ne s'interprete pas.
  salutation.textContent = m.salutation;

  const titre = document.createElement('h1');
  titre.className = 'titre-jour';
  titre.textContent = m.titre;

  const details = document.createElement('p');
  details.className = 'details-jour';
  details.textContent = m.details;

  section.append(salutation, titre, details);
  if (m.etat !== null) section.append(barreProgression(m.etat));

  if (m.lien !== null) {
    // Un vrai lien, pas un bouton : le bouton retour du telephone doit ramener
    // ici depuis l'ecran de seance.
    const lien = document.createElement('a');
    lien.className = 'bouton bouton-principal';
    lien.href = m.lien.href;
    lien.textContent = m.lien.texte;
    section.append(lien);
  }

  hote.append(section);
}

// `<progress>` natif : annonce par les lecteurs d'ecran, sans calcul de largeur
// ni bibliotheque. C'est un etat, pas une recompense — la barre a ressort du
// PRD §10 est celle de l'ecran de seance, et elle appartient au PRP 06.
function barreProgression(etat) {
  const bloc = document.createElement('p');
  bloc.className = 'progression-jour';

  const barre = document.createElement('progress');
  barre.className = 'barre';
  barre.max = etat.total;
  barre.value = etat.coches;

  const compte = document.createElement('span');
  compte.className = 'compte';
  compte.textContent = `${etat.coches} / ${etat.total}`;

  bloc.append(barre, compte);
  return bloc;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js` · Attendu :
SUCCÈS, `# pass 7`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-jour.js apps/marcq-handball/tests/vues.test.js
git commit -m "marcq-handball : l'ecran du jour et ses trois cas"
git push
```

---

### Tâche 5 — les réglages : corriger son prénom, ou changer d'enfant

**Fichiers :** Créer `apps/marcq-handball/web/vue-reglages.js` · Tester `apps/marcq-handball/tests/vues.test.js`

PRD §7.2 : *« il peut **corriger son prénom** (faute de frappe) ou **changer
d'enfant** (un frère, une sœur, un téléphone partagé) — deux gestes distincts :
le premier garde la progression, le second repart à zéro et le dit clairement
avant d'agir. »* Ils ne se ressemblent donc pas à l'écran : le premier est un
formulaire ordinaire, le second une zone à part, qui annonce ce qu'elle efface,
le chiffre, et demande confirmation.

C'est aussi la seule page où le risque du PRD §14 est écrit : *« sans compte, il
n'y a pas de sauvegarde. La page de réglages le dit. »*

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter en tête de `apps/marcq-handball/tests/vues.test.js`, sous les imports
existants :

```js
import { AVERTISSEMENT_SAUVEGARDE, CONFIRMATION_CHANGEMENT } from '../web/vue-reglages.js';
```

Puis ajouter à la fin du fichier :

```js
test('les phrases que le PRD fixe sont intactes', () => {
  // PRD §14 : le risque est « assume et annonce ».
  assert.match(AVERTISSEMENT_SAUVEGARDE, /pas de compte, donc pas de sauvegarde/);
  assert.match(AVERTISSEMENT_SAUVEGARDE, /perdue/);
  // PRD §7.2 : « le second repart a zero et le dit clairement avant d'agir ».
  assert.match(CONFIRMATION_CHANGEMENT, /efface le prénom et toute la progression/);
  assert.match(CONFIRMATION_CHANGEMENT, /\?$/, 'une confirmation pose une question');
});

test('les deux gestes des reglages sont distincts (PRD §7.2)', () => {
  const code = source('vue-reglages.js');
  // Corriger le prenom n'appelle que `ecrirePrenom` : la progression vit sous
  // une autre cle et n'est meme pas lue.
  assert.ok(code.includes('ecrirePrenom('), 'le premier geste ecrit le prenom');
  // Changer d'enfant efface tout, et jamais sans confirmation.
  assert.ok(code.includes('toutEffacer()'), 'le second geste efface tout');
  assert.ok(
    /confirm\(CONFIRMATION_CHANGEMENT\)/.test(code),
    'toutEffacer n est jamais atteint sans confirmation',
  );
  assert.ok(
    code.indexOf('confirm(CONFIRMATION_CHANGEMENT)') < code.indexOf('toutEffacer()'),
    'la confirmation vient avant l effacement',
  );
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/apps/marcq-handball/web/vue-reglages.js'`,
`# pass 0`, `# fail 1`.

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/vue-reglages.js` :

```js
// vue-reglages.js — deux gestes, et un avertissement.
//
// PRD §7.2 : corriger son prenom garde la progression, changer d'enfant repart a
// zero. Les deux ne se ressemblent pas a l'ecran, et c'est le sujet de ce
// fichier : un formulaire ordinaire d'un cote, une zone a part de l'autre.

import { ecrirePrenom, lireFaits, toutEffacer } from './etat.js';

// PRD §14, ligne « Perte du telephone ou vidage du navigateur » : le risque est
// « assume et annonce ». Il est ecrit ici, en clair, et pas au moment ou la
// progression est deja perdue.
export const AVERTISSEMENT_SAUVEGARDE =
  'Il n’y a pas de compte, donc pas de sauvegarde : ta progression vit dans ce '
  + 'navigateur, sur ce téléphone. Si tu changes de téléphone ou que tu vides ton '
  + 'navigateur, elle est perdue.';

export const CONFIRMATION_CHANGEMENT =
  'Changer d’enfant efface le prénom et toute la progression enregistrée sur ce '
  + 'téléphone. C’est définitif. Continuer ?';

export function monterReglages(hote, ctx) {
  const section = document.createElement('section');
  section.className = 'ecran ecran-reglages';

  const titre = document.createElement('h1');
  titre.className = 'titre-ecran';
  titre.textContent = 'Réglages';

  section.append(titre, blocPrenom(ctx), blocSauvegarde(), blocChangerEnfant(ctx));
  hote.append(section);
}

// Geste 1 : corriger son prenom. La progression n'est pas touchee — le prenom et
// les faits sont deux cles distinctes (ossature §6), en changer une ne lit meme
// pas l'autre. On ne remonte pas l'ecran apres coup : la confirmation ecrite
// sous le champ disparaitrait avec lui, et l'enfant n'aurait aucun retour.
function blocPrenom(ctx) {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Mon prénom';

  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-prenom';
  formulaire.noValidate = true;

  const etiquette = document.createElement('label');
  etiquette.className = 'etiquette';
  etiquette.htmlFor = 'champ-prenom-reglages';
  etiquette.textContent = 'Ton prénom';

  const champ = document.createElement('input');
  champ.className = 'champ';
  champ.id = 'champ-prenom-reglages';
  champ.name = 'prenom';
  champ.type = 'text';
  champ.autocomplete = 'given-name';
  champ.maxLength = 24;
  champ.value = ctx.prenom;

  const bouton = document.createElement('button');
  bouton.className = 'bouton';
  bouton.type = 'submit';
  bouton.textContent = 'Enregistrer';

  // `role="status"` fait annoncer le retour par les lecteurs d'ecran sans voler
  // le focus au champ.
  const retour = document.createElement('p');
  retour.className = 'retour';
  retour.setAttribute('role', 'status');

  formulaire.append(etiquette, champ, bouton, retour);
  formulaire.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const enregistre = ecrirePrenom(champ.value);
    if (enregistre === null) {
      retour.textContent = 'Il faut un prénom, même court.';
      champ.focus();
      return;
    }
    champ.value = enregistre;
    retour.textContent = `C’est noté, ${enregistre}.`;
  });

  bloc.append(titre, formulaire);
  return bloc;
}

function blocSauvegarde() {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Où vit ta progression';

  const texte = document.createElement('p');
  texte.className = 'avertissement';
  texte.textContent = AVERTISSEMENT_SAUVEGARDE;

  bloc.append(titre, texte);
  return bloc;
}

// Geste 2 : changer d'enfant. Il « repart a zero, et le dit clairement avant
// d'agir » (PRD §7.2) — d'ou le decompte de ce qui sera efface, puis une
// confirmation. `confirm` est natif, bloquant et impossible a rater ; une modale
// maison couterait trois fois plus de lignes pour moins de garanties. Un
// navigateur qui l'a desactive fait ne rien faire au bouton, ce qui est le bon
// defaut pour un geste destructeur.
function blocChangerEnfant(ctx) {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage bloc-danger';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Changer d’enfant';

  const cochees = Object.keys(lireFaits()).length;
  const pluriel = cochees > 1 ? 's' : '';
  const texte = document.createElement('p');
  texte.className = 'avertissement';
  texte.textContent =
    `Le téléphone repart à zéro : le prénom ${ctx.prenom} et ${cochees} exercice${pluriel} `
    + `coché${pluriel} seront effacés. C’est fait pour un frère, une sœur, un téléphone partagé.`;

  const bouton = document.createElement('button');
  bouton.className = 'bouton bouton-danger';
  bouton.type = 'button';
  bouton.textContent = 'Changer d’enfant';
  bouton.addEventListener('click', () => {
    if (typeof globalThis.confirm !== 'function') return;
    if (!globalThis.confirm(CONFIRMATION_CHANGEMENT)) return;
    toutEffacer();
    // Le routeur relit le prenom a chaque rendu : sans prenom, il monte l'ecran
    // de premier lancement. Aucun rechargement de page, donc aucune attente.
    ctx.aller('#/');
  });

  bloc.append(titre, texte, bouton);
  return bloc;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js` · Attendu :
SUCCÈS, `# pass 9`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-reglages.js apps/marcq-handball/tests/vues.test.js
git commit -m "marcq-handball : corriger son prenom, ou changer d'enfant"
git push
```

---

### Tâche 6 — la coque, le routeur et le contexte des écrans

**Fichiers :** Modifier `apps/marcq-handball/web/index.html` · Créer `apps/marcq-handball/web/app.js` · Modifier `apps/marcq-handball/README.md` · Tester `apps/marcq-handball/tests/vues.test.js`

C'est la tâche dont les PRP 04, 05, 06, 10 et 11 dépendent : elle fixe comment on
change d'écran, comment un écran est monté puis démonté, et où vit l'état
courant. Le contrat complet est en tête de ce document, section « Interfaces » ;
il tient parce qu'il y a cinq écrans, pas cinquante.

Deux choses ne sont calculées qu'ici : le jour courant, une seule fois et en
`Europe/Paris` (ossature §5), et la route courante. Aucune vue ne rappelle
`new Intl.DateTimeFormat` — deux appels de part et d'autre de minuit donneraient
deux jours différents dans le même rendu.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter en tête de `apps/marcq-handball/tests/vues.test.js`, sous les imports
existants :

```js
import { ECRANS, choisirEcran } from '../web/app.js';
```

Puis ajouter à la fin du fichier :

```js
test('la coque porte l hote des ecrans, la navigation et le module d amorcage', () => {
  const coque = source('index.html');
  assert.match(coque, /<html lang="fr">/);
  assert.match(coque, /<main id="ecran"/, 'le point de montage des ecrans');
  assert.match(coque, /<nav id="nav"[^>]*hidden/, 'la navigation est masquee avant le prenom');
  assert.match(coque, /<script type="module" src="\/app\.js">/, 'un module ES, servi a la racine');
  assert.match(coque, /<link rel="stylesheet" href="\/style\.css">/);
  // Ossature §2 : aucun asset distant, la page est publique et ne charge que sa
  // propre origine.
  assert.equal(/(src|href)="(https?:)?\/\//.test(coque), false, 'aucune ressource distante');
});

test('le routeur connait les ecrans de ce lot, et rejette les autres', () => {
  assert.deepEqual(ECRANS.map((e) => e.nom), ['reglages', 'jour']);
  assert.equal(choisirEcran('#/').nom, 'jour');
  assert.equal(choisirEcran('').nom, 'jour', 'une adresse sans ancre ouvre le jour');
  assert.equal(choisirEcran('#').nom, 'jour');
  assert.equal(choisirEcran('#/reglages').nom, 'reglages');
  assert.equal(choisirEcran('#/seance/2026-08-03'), null, 'la seance arrive au PRP 04');
  assert.equal(choisirEcran('#/perso'), null, 'l ecran perso arrive au PRP 05');
  assert.equal(choisirEcran('#/nimporte-quoi'), null);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/apps/marcq-handball/web/app.js'`,
`# pass 0`, `# fail 1`.

- [ ] **Étape 3 — l'implémentation minimale**

Remplacer `apps/marcq-handball/web/index.html` par ce contenu complet :

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="description" content="Le programme d’été de l’équipe U15 de Marcq Handball, à cocher séance par séance.">
<title>Programme d’été — Marcq Handball</title>
<!-- Une icone vide plutot qu'aucune : sans elle, chaque ouverture ajoute un
     404 sur /favicon.ico dans les journaux du serveur. -->
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<!-- Les ecrans se montent ici ; le routeur vide cet element avant chacun. -->
<main id="ecran" class="ecran-hote"></main>
<!-- La navigation vit HORS de #ecran : elle survit aux montages et ne clignote
     pas d'un ecran a l'autre. Masquee tant que le prenom n'est pas donne
     (PRD §7.1 : un champ, un bouton, rien d'autre). -->
<nav id="nav" class="nav-app" aria-label="Navigation principale" hidden></nav>
<noscript><p class="panne">Cette page a besoin de JavaScript pour afficher le programme.</p></noscript>
<script type="module" src="/app.js"></script>
</body>
</html>
```

Créer `apps/marcq-handball/web/app.js` :

```js
// app.js — l'amorcage, le jour courant, et le routeur des ecrans.
//
// Trois decisions vivent ici et nulle part ailleurs : quel jour on est, quel
// ecran est monte, et ce que les ecrans lisent. Une vue ne calcule jamais la
// date et n'en monte jamais une autre.

import { chargerProgramme } from './domaine.js';
import { lireFaits, lirePrenom } from './etat.js';
import { monterJour } from './vue-jour.js';
import { monterPrenom } from './vue-prenom.js';
import { monterReglages } from './vue-reglages.js';

// Le jour courant, en Europe/Paris. 'fr-CA' rend YYYY-MM-DD, le format que le
// domaine compare comme des chaines. Le fuseau est fige : un enfant en vacances
// a l'etranger doit voir la seance du jour de son club, pas celle de son fuseau
// (ossature §5).
export const aujourdhui = () =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Le tableau des ecrans. Ajouter un ecran, c'est ajouter un import et une ligne
// ici : le PRP 04 y pose `#/seance/<date>`, le 05 `#/perso`, le 11 `#/bilan`.
// L'ordre compte — le premier motif qui correspond gagne, et celui du jour
// accepte l'adresse sans ancre.
export const ECRANS = [
  { nom: 'reglages', motif: /^#\/reglages$/, monter: monterReglages },
  { nom: 'jour', motif: /^(#\/?)?$/, monter: monterJour },
];

// Les onglets. Meme regle : un ecran pose son lien ici, jamais avant d'exister —
// un lien mort coute plus cher qu'un lien absent. Le PRP 05 ajoutera « Ma
// progression ».
//
// Exporte, comme `ECRANS` : les PRP 08, 10 et 11 verifient depuis leur fichier
// de test qu'aucun onglet ne pointe vers un ecran qu'ils n'ont pas encore pose.
// Un `import { LIENS }` sur un symbole non exporte ferait echouer le chargement
// du module de test entier, pas une assertion.
export const LIENS = [
  { href: '#/', texte: 'Aujourd’hui' },
  { href: '#/reglages', texte: 'Réglages' },
];

// Rend l'entree d'ecran d'une route, ou null si la route est inconnue. Pure :
// c'est elle que `node --test` interroge, sans navigateur.
export function choisirEcran(route) {
  return ECRANS.find((ecran) => ecran.motif.test(route)) ?? null;
}

let demonterCourant = null;

function routeCourante() {
  return location.hash === '' ? '#/' : location.hash;
}

function commeDemontage(valeur) {
  return typeof valeur === 'function' ? valeur : null;
}

// Le seul point de montage de l'application. Il tranche deux questions : le
// prenom manque-t-il, et quelle route est demandee.
function rendre(hote, ctx) {
  if (typeof demonterCourant === 'function') demonterCourant();
  demonterCourant = null;
  hote.replaceChildren();

  // Le contexte est relu a chaque rendu : un ecran voit l'etat du telephone,
  // jamais un instantane vieux d'un ecran.
  ctx.prenom = lirePrenom();
  ctx.faits = lireFaits();
  ctx.route = routeCourante();
  rendreNavigation(ctx);

  // Tant que le prenom manque, aucune route n'est honoree : un lien partage vers
  // `#/reglages` ne doit pas court-circuiter l'accueil (PRD §7.1).
  if (ctx.prenom === null) {
    demonterCourant = commeDemontage(monterPrenom(hote, ctx));
    return;
  }

  const ecran = choisirEcran(ctx.route);
  if (ecran === null) {
    // Une route inconnue ne laisse jamais un ecran vide. On reecrit l'adresse
    // sans empiler d'entree — sinon le bouton retour du telephone rejouerait la
    // route morte. `replaceState` ne declenche pas `hashchange`, d'ou l'appel
    // direct ; il se termine, `#/` correspondant toujours a un ecran.
    history.replaceState(null, '', '#/');
    rendre(hote, ctx);
    return;
  }

  demonterCourant = commeDemontage(ecran.monter(hote, ctx));
}

function rendreNavigation(ctx) {
  const nav = document.getElementById('nav');
  nav.hidden = ctx.prenom === null;
  nav.replaceChildren();
  if (nav.hidden) return;

  for (const lien of LIENS) {
    const onglet = document.createElement('a');
    onglet.className = 'lien-nav';
    onglet.href = lien.href;
    onglet.textContent = lien.texte;
    if (lien.href === ctx.route) onglet.setAttribute('aria-current', 'page');
    nav.append(onglet);
  }
}

function creerContexte(prog, hote) {
  const ctx = {
    prog,
    aujourdhui: aujourdhui(),
    prenom: null,
    faits: {},
    route: '#/',
    aller(destination) {
      // Ecrire un hash identique a l'actuel ne declenche pas `hashchange` : on
      // remonte alors a la main, sinon le geste resterait sans effet.
      if (routeCourante() === destination) rendre(hote, ctx);
      else location.hash = destination;
    },
    rafraichir() { rendre(hote, ctx); },
  };
  return ctx;
}

async function chargerLeProgramme(hote) {
  try {
    const reponse = await fetch('/programme.json', { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return chargerProgramme(await reponse.json());
  } catch (err) {
    console.error('marcq : programme illisible', err);
    const message = document.createElement('p');
    message.className = 'panne';
    message.textContent =
      'Le programme n’a pas pu être chargé. Reconnecte-toi une fois : il sera ensuite disponible hors ligne.';
    hote.replaceChildren(message);
    return null;
  }
}

// L'enregistrement du service worker vient apres le premier rendu : il n'est pas
// sur le chemin de l'affichage, et l'objectif du PRD §4 se joue sur la premiere
// seconde. Un echec ne casse rien — l'app marche en ligne.
function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('marcq : service worker non enregistre', err);
  });
}

async function demarrer() {
  const hote = document.getElementById('ecran');
  const prog = await chargerLeProgramme(hote);
  if (prog === null) return;

  const ctx = creerContexte(prog, hote);
  window.addEventListener('hashchange', () => rendre(hote, ctx));
  rendre(hote, ctx);
  enregistrerServiceWorker();
}

// L'amorcage ne se declenche que dans un navigateur. Sans ce garde, `node --test`
// executerait `demarrer()` au seul import du module et le routeur ne serait pas
// testable.
if (typeof document !== 'undefined') {
  demarrer().catch((err) => console.error('marcq : demarrage impossible', err));
}
```

Ajouter cette section à la fin de `apps/marcq-handball/README.md` :

````markdown
## Les écrans et leurs routes

Le navigateur porte tout : le domaine, l'état et les écrans. Le serveur sert des
fichiers statiques et une sonde de santé, et ne connaît aucun utilisateur.

| Route | Écran | Fichier |
|---|---|---|
| `#/` (ou adresse sans ancre) | la séance du jour, ou le repos, ou la fin | `web/vue-jour.js` |
| `#/reglages` | corriger le prénom, changer d'enfant | `web/vue-reglages.js` |

Tant qu'aucun prénom n'est enregistré, aucune route n'est honorée :
`web/vue-prenom.js` s'affiche à la place. C'est le seul péage de l'application.

**Ajouter un écran** demande trois lignes dans `web/app.js` — un `import`, une
entrée dans `ECRANS`, et un lien dans `LIENS` si l'écran mérite un onglet — plus
son fichier `web/vue-*.js`. Un écran est une fonction `(hote, ctx) => démontage`,
`hote` étant vidé par le routeur avant chaque montage. Le contexte `ctx` porte
`prog`, `aujourdhui`, `prenom`, `faits`, `route`, `aller(route)` et
`rafraichir()` ; il est relu à chaque rendu, et un écran ne le mute jamais.

**Ce qui est enregistré sur le téléphone**, et rien d'autre (`web/etat.js`) :

| Clé | Valeur |
|---|---|
| `marcq.v1.prenom` | le prénom, 24 caractères au plus |
| `marcq.v1.faits` | `{ "<id d'exercice>": "<horodatage ISO>" }` |

Un stockage refusé — navigation privée — ou plein ne casse rien : les valeurs
sont gardées en mémoire pour la durée de l'onglet. Elles ne survivent alors pas
à la fermeture, ce que la page de réglages annonce.
````

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js` · Attendu :
SUCCÈS, `# pass 11`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/app.js apps/marcq-handball/web/index.html \
        apps/marcq-handball/tests/vues.test.js apps/marcq-handball/README.md
git commit -m "marcq-handball : la coque, le routeur et le contexte des ecrans"
git push
```

---

### Tâche 7 — le style des écrans, mobile d'abord

**Fichiers :** Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/vues.test.js`

PRD §11 : *« L'app est ouverte sur un téléphone, en extérieur, en 4G, parfois en
plein soleil. Zones de tap larges, contraste suffisant en pleine lumière, aucune
interaction dépendant du survol. »* Un écran non stylé n'est pas un détail
esthétique : un champ de 20 px et un bouton de 24 px font échouer l'objectif du
PRD §4 aussi sûrement qu'un écran de connexion.

Le test ne juge pas le goût — il attrape la faute qui coûte le plus cher et se
voit le moins : une classe posée par une vue qui n'existe dans aucune feuille.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/vues.test.js` :

```js
test('toute classe posee par un ecran existe dans style.css', () => {
  const css = source('style.css');
  const classes = new Set();
  for (const nom of ['app.js', 'vue-prenom.js', 'vue-jour.js', 'vue-reglages.js']) {
    // On ne lit que les affectations litterales `className = '...'`. Le seul nom
    // construit par gabarit est `cas-<cas>`, verifie juste apres.
    for (const [, liste] of source(nom).matchAll(/\.className\s*=\s*'([^']*)'/g)) {
      for (const classe of liste.split(/\s+/).filter(Boolean)) classes.add(classe);
    }
  }
  assert.ok(classes.size >= 20, 'la lecture des sources a echoue si le compte est bas');
  for (const classe of [...classes, 'cas-aujourd-hui', 'cas-repos', 'cas-terminee']) {
    assert.ok(css.includes(`.${classe}`), `.${classe} manque dans style.css`);
  }
});

test('les zones de tap et la taille du champ tiennent la promesse du PRD §11', () => {
  const css = source('style.css');
  assert.match(css, /--marcq-tap:\s*4[8-9]px|--marcq-tap:\s*5\dpx/, 'au moins 48 px de tap');
  // En dessous de 16 px, iOS zoome a la mise au point et l'ecran part de travers.
  assert.match(css, /\.champ\b[^}]*font-size:\s*1[7-9]px/s);
  assert.match(
    css,
    /\.bouton\b[^}]*min-height:\s*var\(--marcq-tap\)/s,
    'un bouton occupe une zone de tap pleine',
  );
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js`
Attendu : ÉCHEC, `# pass 11` et `# fail 2`, le premier sur
`AssertionError [ERR_ASSERTION]: .ecran manque dans style.css`.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter ce bloc à la fin de `apps/marcq-handball/web/style.css`. Il vient après
ce qu'a posé le PRP 01 : à spécificité égale, la dernière règle gagne, et c'est
bien celle-ci qui doit s'appliquer.

Les jetons du PRP 01 — `--papier`, `--carte`, `--encre`, `--encre-douce`,
`--trait`, `--signal`, `--signal-lisible`, `--fait`, `--tap`, `--pas`, `--marge`,
`--rayon`, `--texte`, `--chiffres` — et sa classe `.tap` restent dans la feuille
mais cessent d'avoir un consommateur : c'est la famille `--marcq-*` déclarée
ci-dessous que ce PRP et les PRP 04 à 11 lisent. Ne mélange pas les deux dans une
même règle ; le préfixe est là pour que l'écart se voie.

```css
/* ---------------------------------------------------------------------------
   Les ecrans — PRP 03.
   Mobile d'abord : une colonne, des zones de tap d'au moins 48 px, un contraste
   eleve (PRD §11). Le fond est clair et l'encre presque noire : c'est ce qui se
   lit le mieux dehors, ecran a pleine luminosite. Aucune police distante — la
   page est publique et ne charge que sa propre origine (ossature §2).
   --------------------------------------------------------------------------- */

:root {
  --marcq-encre: #14181f;
  --marcq-encre-douce: #4a5364;
  --marcq-fond: #f4f6f9;
  --marcq-carte: #ffffff;
  --marcq-accent: #0b4fa8;      /* 7,4:1 sur blanc */
  --marcq-sur-accent: #ffffff;
  --marcq-danger: #a11221;      /* 7,9:1 sur blanc */
  --marcq-trait: #d7dce4;
  --marcq-tap: 48px;
}

body {
  margin: 0;
  /* La barre d'onglets est fixee en bas : on reserve sa hauteur pour que le
     dernier bouton d'un ecran ne finisse pas dessous. */
  padding: 0 0 calc(var(--marcq-tap) + env(safe-area-inset-bottom, 0px) + 1.5rem);
  background: var(--marcq-fond);
  color: var(--marcq-encre);
  font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}

.ecran-hote { display: block; }

.ecran {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 34rem;
  margin: 0 auto;
  padding: 1.25rem 1.1rem 0;
}
/* Le premier lancement est centre : un champ seul en haut d'un ecran vide a
   l'air d'un formulaire inacheve. */
.ecran-prenom { min-height: 65vh; justify-content: center; }
.ecran-jour { gap: 1.1rem; }
.ecran-reglages { gap: 1.1rem; }

.titre-accueil,
.titre-jour,
.titre-ecran { margin: 0; font-size: 1.6rem; line-height: 1.2; }
.titre-bloc { margin: 0 0 .6rem; font-size: 1.05rem; }

.salutation,
.details-jour { margin: 0; color: var(--marcq-encre-douce); }
.salutation { font-size: 1.05rem; }

.formulaire-prenom { display: flex; flex-direction: column; gap: .7rem; }
.etiquette { display: block; font-weight: 600; }
.aide { margin: 0; color: var(--marcq-encre-douce); font-size: .95rem; }

.champ {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--marcq-tap);
  padding: 0 .8rem;
  border: 2px solid var(--marcq-trait);
  border-radius: .6rem;
  background: var(--marcq-carte);
  color: inherit;
  font: inherit;
  font-size: 17px;
}
.champ:focus-visible { border-color: var(--marcq-accent); outline: none; }

.bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--marcq-tap);
  padding: 0 1.2rem;
  border: 2px solid var(--marcq-trait);
  border-radius: .6rem;
  background: var(--marcq-carte);
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.bouton-principal {
  border-color: var(--marcq-accent);
  background: var(--marcq-accent);
  color: var(--marcq-sur-accent);
}
.bouton-danger { border-color: var(--marcq-danger); color: var(--marcq-danger); }
.bouton:focus-visible,
.lien-nav:focus-visible { outline: 3px solid var(--marcq-accent); outline-offset: 2px; }

.progression-jour { display: flex; align-items: center; gap: .7rem; margin: 0; }
.barre { flex: 1; height: .7rem; }
.compte { font-variant-numeric: tabular-nums; font-weight: 600; }

.bloc-reglage {
  padding: 1rem;
  border: 1px solid var(--marcq-trait);
  border-radius: .8rem;
  background: var(--marcq-carte);
}
.bloc-danger { border-color: var(--marcq-danger); }
.avertissement { margin: 0 0 .8rem; color: var(--marcq-encre-douce); font-size: .95rem; }
/* La hauteur est reservee : sans elle, le retour ferait sauter le bouton. */
.retour { margin: 0; min-height: 1.5rem; color: var(--marcq-accent); font-size: .95rem; }

.panne { max-width: 34rem; margin: 2rem auto; padding: 0 1.1rem; color: var(--marcq-danger); }

.nav-app {
  position: fixed;
  inset: auto 0 0;
  display: flex;
  border-top: 1px solid var(--marcq-trait);
  background: var(--marcq-carte);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.nav-app[hidden] { display: none; }
.lien-nav {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: var(--marcq-tap);
  color: var(--marcq-encre-douce);
  font-weight: 600;
  text-decoration: none;
}
.lien-nav[aria-current="page"] {
  color: var(--marcq-accent);
  box-shadow: inset 0 -3px 0 var(--marcq-accent);
}

/* Les trois cas de l'ecran du jour se lisent a la couleur du titre : un jour de
   seance appelle, un jour de repos rassure, la fin du programme clot. */
.cas-aujourd-hui .titre-jour { color: var(--marcq-accent); }
.cas-repos .titre-jour { color: var(--marcq-encre-douce); }
.cas-terminee .titre-jour { color: var(--marcq-encre); }
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/vues.test.js` · Attendu :
SUCCÈS, `# pass 13`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/style.css apps/marcq-handball/tests/vues.test.js
git commit -m "marcq-handball : le style des ecrans, mobile d'abord"
git push
```

---

### Tâche 8 — les nouveaux modules entrent dans la coque hors ligne

**Fichiers :** Modifier `apps/marcq-handball/web/sw.js`

PRD §11 : *« L'app doit rester utilisable réseau coupé. »* Le PRP 01 a posé
`web/sw.js` et sa liste de coque, mais il ne pouvait pas y inscrire des fichiers
qui n'existaient pas encore. Sans cette tâche, l'app fonctionne hors ligne tant
que l'onglet reste ouvert et affiche une page blanche dès qu'il est rouvert — la
panne la plus silencieuse de tout ce lot, et celle qui frappe exactement le
scénario du PRD : un ado qui ferme son onglet entre deux séances.

- [ ] **Étape 1 — écrire le test qui échoue**

Le service worker ne s'importe pas sous Node — il s'exécute dans une portée qui
n'existe pas hors du navigateur. Le contrôle est textuel, et c'est suffisant : ce
qui manque, ce sont des entrées dans une liste.

```bash
cd /home/user/hello-world/apps/marcq-handball && manquants=0 && \
for f in / /style.css /programme.json /app.js /etat.js /domaine.js \
         /vue-prenom.js /vue-jour.js /vue-reglages.js; do \
  grep -q "'$f'" web/sw.js || { echo "MANQUANT : $f"; manquants=1; }; \
done; [ "$manquants" = 0 ] && echo OK
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : la commande ci-dessus
Attendu : ÉCHEC — au moins `MANQUANT : /app.js`, `MANQUANT : /etat.js`,
`MANQUANT : /domaine.js`, `MANQUANT : /vue-prenom.js`, `MANQUANT : /vue-jour.js`,
`MANQUANT : /vue-reglages.js`, et pas de `OK`.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la liste de la coque de `apps/marcq-handball/web/sw.js` — le tableau de
chemins déclaré en tête du fichier par le PRP 01 — les entrées que le contrôle a
signalées, dans cet ordre :

```js
  '/app.js',
  '/etat.js',
  '/domaine.js',
  '/vue-prenom.js',
  '/vue-jour.js',
  '/vue-reglages.js',
```

`/`, `/style.css` et `/programme.json` y figurent déjà ; si le contrôle en
signale un, il s'ajoute de la même façon — le PRP 01 ne pouvait lister que ce qui
existait alors.

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer :

```bash
cd /home/user/hello-world/apps/marcq-handball && manquants=0 && \
for f in / /style.css /programme.json /app.js /etat.js /domaine.js \
         /vue-prenom.js /vue-jour.js /vue-reglages.js; do \
  grep -q "'$f'" web/sw.js || { echo "MANQUANT : $f"; manquants=1; }; \
done; [ "$manquants" = 0 ] && echo OK
cd /home/user/hello-world && ./init.sh --check
./apps/marcq-handball/test.sh
```

Attendu : SUCCÈS — `OK`, `--check` vert, puis `# pass 52` et `# fail 0` (29 du
PRP 02, 10 de `etat.test.js`, 13 de `vues.test.js`) suivis des tests Go.

**La vérification à l'œil**, qui ne se remplace pas par un test sans navigateur :

```bash
cd /home/user/hello-world/apps/marcq-handball && go run .
```

Puis sur `http://localhost:8080`, en mode téléphone dans les outils de
développement, dans cet ordre :

1. Stockage vidé : l'écran demande le prénom, **rien d'autre**, la barre
   d'onglets est absente.
2. « C'est parti » avec un champ vide ne fait rien ; avec un prénom, l'écran du
   jour arrive **sans rechargement**.
3. L'écran du jour salue par le prénom et propose la séance du jour ; l'onglet
   « Aujourd'hui » est marqué comme courant.
4. Réglages : corriger le prénom affiche « C'est noté, … » et l'écran du jour
   salue le nouveau. La progression n'a pas bougé.
5. Réglages : « Changer d'enfant » demande confirmation, et un refus ne change
   rien. Un accord ramène à l'écran du prénom.
6. `http://localhost:8080/#/nimporte-quoi` retombe sur l'écran du jour, et
   l'adresse est réécrite en `#/`.
7. Le bouton retour du navigateur navigue entre les écrans au lieu de quitter.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/sw.js
git commit -m "marcq-handball : les modules entrent dans la coque hors ligne"
git push
```

La pull request vient maintenant, une fois l'ensemble cohérent — pas à chaque
commit. `.github/pull_request_template.md` en donne la forme.

---

## Points d'attention

**Le repli en mémoire n'est pas un confort, c'est ce qui empêche une boucle.**
Sans lui, un stockage refusé fait échouer `ecrirePrenom`, `lirePrenom` rend
`null` au rendu suivant, et le routeur remonte l'écran d'accueil — qui redemande
le prénom, indéfiniment. Le symptôme ne ressemble pas à un problème de stockage,
et il ne se voit qu'en navigation privée, c'est-à-dire jamais pendant le
développement. Ne simplifie pas `lireCle`/`ecrireCle` en retirant `memoire`.

**Le magasin est relu à chaque appel, jamais capturé à l'import.** `const m =
globalThis.localStorage` en tête de module lèverait au chargement sur un
navigateur qui refuse le stockage — donc avant que la moindre ligne de
l'application ne s'exécute. C'est aussi ce qui permet aux tests de substituer
leur magasin après l'import.

**`beforeEach` doit appeler `etat.toutEffacer()`.** `memoire` est une variable de
module : elle survit d'un test à l'autre dans le même fichier. Sans cet appel, un
test hérite du prénom du précédent et l'assertion `lirePrenom() === null` échoue
sur un test qui n'y est pour rien.

**Les deux tests de tolérance impriment des `console.warn`.** C'est le
comportement spécifié — l'ossature §6 demande une trace avant l'échec silencieux.
Un `# pass 10` accompagné de deux avertissements est un succès.

**Le garde `typeof document !== 'undefined'` autour de `demarrer()` est
structurel.** Sans lui, `node --test` exécute l'amorçage au seul import de
`app.js`, échoue sur `document is not defined`, et le routeur devient
intestable — ce qui reviendrait à livrer sans preuve la seule pièce dont cinq
PRP dépendent.

**`seanceDuJour` peut rendre `{ seance: null, cas: 'repos' }`.** C'est le cas du
18 au 21 août : le programme n'est pas fini, mais il n'y a plus rien à annoncer.
`modeleJour` traite ce cas avant de lire `seance.date` ; ne fusionne pas les deux
branches de `'repos'`, elles casseraient pendant les quatre derniers jours du
programme, c'est-à-dire au pire moment.

**`#/seance/<date>` n'a pas d'écran avant le PRP 04.** Le lien existe pourtant dès
maintenant, et c'est voulu : la route inconnue retombe sur `#/` par
`replaceState`. Un tap qui ramène à l'écran du jour n'est pas un bug à corriger
ici — c'est l'état attendu tant que le PRP 04 n'a pas ajouté sa ligne dans
`ECRANS`.

**La réécriture de `index.html` emporte ce que le PRP 01 y avait mis.** Si
l'enregistrement du service worker y était posé par une balise `<script>` en
ligne, il disparaît — il est repris dans `app.js`, et il ne doit surtout pas
finir en double : deux `register('/sw.js')` sur la même portée ne cassent rien
mais brouillent tout diagnostic d'activation.

**`./init.sh --check` refuse la chaîne `x-forwarded-user` dans tout fichier suivi
de `apps/marcq-handball/` hors `.md`** (`init.sh:1444-1452`). Aucun fichier de ce
PRP ne la contient — et n'écris pas non plus « on ne lit pas `X-Forwarded-User` »
dans un commentaire : le garde-fou cherche une sous-chaîne, il ne fait pas la
différence, et le message d'échec ressemblera à un faux positif alors qu'il est
exact.

**Les chaînes d'interface portent l'apostrophe typographique `’`.** Elle se lit
mieux et évite tout échappement dans une chaîne JavaScript entre apostrophes
droites. Les assertions de `tests/vues.test.js` comparent le caractère exact :
`C'est parti` avec une apostrophe droite fait échouer le test des classes CSS
(la chaîne se coupe) avant même celui du texte.

**Le test des classes CSS ne lit que les affectations littérales `className =
'…'`.** Une classe posée par `classList.add` ou par gabarit lui échappe : c'est
pourquoi `monterJour` sépare `className = 'ecran ecran-jour'` de
`classList.add('cas-…')`, et pourquoi les trois `cas-*` sont vérifiés à part.
Si tu ajoutes une classe construite, ajoute son assertion.

**`ctx.aller(route)` remonte à la main quand la route demandée est déjà la
courante.** Écrire `location.hash` avec la valeur qu'il a déjà ne déclenche pas
`hashchange` : sans ce cas particulier, « changer d'enfant » depuis `#/reglages`
effacerait tout puis laisserait l'écran des réglages affiché, avec un prénom qui
n'existe plus.

**Le PRD ne se contredit pas sur ce périmètre.** Un point mérite d'être signalé :
le §7.2 promet que corriger le prénom « garde la progression », et le §14 annonce
que rien n'est sauvegardé. Les deux sont vrais et ne portent pas sur la même
chose — le prénom et les faits sont deux clés distinctes du même stockage local,
et c'est la perte du navigateur, pas la correction du prénom, qui emporte tout.
Les réglages disent les deux, dans deux blocs séparés, pour que la seconde phrase
ne fasse pas douter de la première.
