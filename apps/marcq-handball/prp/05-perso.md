# PRP 05 — L'écran perso : se lire sans se comparer

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/perso` |
| **Dépend de** | PRP 04 (la route `#/seance/<date>` et `MOTIF_SEANCE`), et par lui PRP 01 (la coque, `sw.js`), 02 (`domaine.js`, `programme.json`), 03 (`app.js` et son contrat d'écran, `vue-jour.js`, les jetons de `style.css`) |
| **Débloque** | PRP 06 (les compteurs de cet écran sont ceux qui roulent), PRP 09 (« L'équipe » s'ajoute sous le calendrier), PRP 11 (le bilan réutilise `formaterDuree` et `lignesVolume`) |
| **Sections du PRD** | §7.5 « Ma progression », §9 (le volume est un récit, pas un rang ; les jours sans séance sont du repos), §6 lot 1 item 5, §10 (le ton), §11 (mobile d'abord) |

## Objectif

L'enfant voit d'un écran ce qu'il a accompli — la part, le volume en langage
d'ado, les dix-neuf jours — sans qu'aucun chiffre ne le compare à qui que ce
soit.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/perso.test.js` affiche
  `# pass 19` et `# fail 0`.
- La phrase du PRD §7.5 est reproduite **au mot près** par un test :
  `lignesVolume` sur `{ pompes: 112, squats: 165, burpees: 45, min_course: 130 }`
  rend exactement `112 pompes, 165 squats, 45 burpees, 2 h 10 de course`.
- Programme entièrement coché, le volume affiche `226 pompes`, `345 squats`,
  `105 burpees`, `210 abdos`, `24 min de gainage`, `3 h 55 de course` —
  recalculés depuis `programme.json`, jamais écrits dans le code.
- Le modèle du calendrier rend **19 jours**, dont **7 séances** et **12 repos**,
  et aucune date ne manque entre `prog.debut` et `prog.fin`.
- Chaque lien de jour de séance satisfait `MOTIF_SEANCE` du PRP 04 — le
  calendrier ne peut donc pas mener à une route que le routeur ignore.
- `./apps/marcq-handball/test.sh` est vert et `./init.sh --check` aussi.
- Dans un navigateur, sur `#/perso` : un pourcentage en grand, des pastilles de
  volume, une grille de dix-neuf cases alignée sur le lundi, et l'onglet
  « Ma progression » actif ; l'onglet Réseau ne montre **aucune** requête après
  le montage.

## Périmètre

**Dedans :** `web/vue-perso.js` en entier — le formatage des durées, les phrases
de volume, le modèle de l'écran, puis son montage ; le style de l'écran dans
`web/style.css` ; l'entrée `perso` dans `ECRANS` et l'onglet dans `LIENS` ;
`/vue-perso.js` dans la coque du service worker ; `tests/perso.test.js` ; les
deux assertions de `tests/vues.test.js` que les PRP 03 et 04 ont laissées en
attente pour cet écran ; une section du `README.md`.

**Dehors, et pourquoi :**

- **Le classement, le podium, la position — PRP 08 et 09, lot 2.** Le PRD §7.5
  ordonne « Ma progression » puis « L'équipe » ; ce PRP livre la première moitié,
  et l'écran s'arrête après le calendrier. **Aucune zone désactivée n'annonce le
  lot 2** — voir la décision 6 des interfaces.
- **Les compteurs animés — PRP 06.** Rien ne roule ici : le pourcentage est posé
  à sa valeur. Ce PRP pose les deux attributs par lesquels le PRP 06 retrouvera
  les nombres, et rien d'autre (PRD §10 : *« un compteur qui augmente ne saute
  jamais à sa valeur »*).
- **Tout calcul de domaine — PRP 02.** Cet écran ne recompte rien : il appelle
  `progression`, `totauxAccomplis`, `calendrier` et `etatSeance`, et met en forme.
- **Cocher — PRP 04.** Les cases du calendrier mènent à l'écran de séance ; elles
  ne cochent pas. Un tap sur une case de calendrier est une navigation, pas une
  déclaration.

## Interfaces

**Consomme :**

```js
// web/domaine.js — PRP 02, ossature §5
progression(prog, aujourdhui, faits = {})     // -> { cochees, programmees, part }  part ∈ [0,1]
totauxAccomplis(prog, faits = {})             // -> { cases, pompes, squats, burpees, abdos, gainage_s, min_course, fentes }
calendrier(prog, aujourdhui, faits = {})      // -> [{ date, seance: Seance|null, statut }]  19 entrées
etatSeance(prog, dateISO, aujourdhui, faits = {})  // -> { statut, cochable, total, coches } | null
// statut ∈ { 'faite', 'partielle', 'aujourd-hui', 'a-venir', 'manquee' } + 'repos' (calendrier seul)

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)   // '2026-08-03' -> 'lundi 3 août'

// web/vue-seance.js — PRP 04 (dans le test seulement)
MOTIF_SEANCE                   // /^#\/seance\/(\d{4}-…)$/
```

Le **contrat d'écran** du PRP 03, que ce PRP applique sans le modifier :

```js
// Un ecran est une fonction (hote, ctx) => demontage | undefined.
// `hote` est <main id="ecran">, VIDE par le routeur avant chaque montage.
// La valeur rendue ne sert qu'a ce qui deborde de `hote` — ce n'est pas le cas ici.
ctx = { prog, aujourdhui, prenom, faits, route, aller(route), rafraichir() }
// Regle 1 : un ecran ne mute JAMAIS ctx.
// Regle 2 : un ecran n'en monte jamais un autre. Il pose un <a href="#/…">.
export const ECRANS = [{ nom, motif, monter }, …]   // le premier motif qui correspond gagne
export function choisirEcran(route)
```

```
Jetons et classes de web/style.css — PRP 01 et 03
  --marcq-encre --marcq-encre-douce --marcq-fond --marcq-carte --marcq-accent
  --marcq-sur-accent --marcq-danger --marcq-trait --marcq-tap (48px)
  .ecran  .titre-ecran  .titre-bloc  .aide  .barre (un <progress>)  .lien-nav
web/sw.js — PRP 01, complété par 03 et 04
  la liste de coque, à laquelle ce PRP ajoute une ligne
```

**Produit :**

```js
// web/vue-perso.js
export function formaterDuree(secondes)   // 45 -> '45 s' · 1425 -> '24 min' · 7800 -> '2 h 10'
export function lignesVolume(totaux)      // -> [{ unite, phrase }] ; les unités à 0 sortent
export function decalageInitial(dateISO)  // -> 0..6, cases vides avant le premier jour (lundi = 0)
export const ETATS                        // { [statut]: { libelle, marque } }, les six du domaine
export function modelePerso(ctx)          // -> ModelePerso
export function monterPerso(hote, ctx)    // l'ecran, au contrat du PRP 03
```

```js
// ModelePerso — tout ce que le montage doit savoir, et rien de plus
{
  titre: 'Ma progression',
  part:   { cochees, programmees, pourcent, echelle, phrase },
  volume: { lignes: [{ unite, phrase }], vide: string | null },
  calendrier: {
    decalage,                                   // 0..6
    resume,                                     // '19 jours · 7 séances'
    legende: [{ statut, libelle, marque }],     // seulement les états présents
    jours: [{ date, numero, statut, marque, estSeance, estAujourdhui, href, detail, nom }],
  },
}
```

```
route #/perso            une entrée dans ECRANS, un onglet dans LIENS (« Ma progression »)
data-compteur            sur le pourcentage — l'accroche du PRP 06
data-unite               sur chaque pastille de volume — l'accroche du PRP 06
<section class="ecran ecran-perso">   le conteneur où le PRP 09 ajoutera
                                      « L'équipe », APRÈS le calendrier
```

**Six noms ou décisions que ni l'ossature ni les PRP amont ne fixent — ils sont
définis ici et les PRP aval s'y tiennent :**

1. **`formaterDuree` prend des secondes et rend du texte.** Le gainage est en
   secondes, la course en minutes : une seule fonction, une seule unité d'entrée,
   et l'appelant multiplie les minutes par 60. Deux fonctions de formatage
   divergeraient au premier ajustement.
2. **`lignesVolume` rend des objets `{ unite, phrase }`, pas des chaînes.** La
   phrase est ce que l'enfant lit ; `unite` est ce par quoi le PRP 06 retrouve la
   ligne à animer sans analyser du texte.
3. **`ETATS` porte les six statuts du domaine**, pas les quatre du PRD §7.5. Le
   calendrier n'invente aucun état et n'en fusionne aucun — voir « Points
   d'attention », qui dit pourquoi c'est l'écart le plus honnête.
4. **`.lu-seul`** — la classe du texte lu par les lecteurs d'écran et invisible à
   l'œil. Une case de calendrier montre un numéro et une marque ; elle doit
   *annoncer* « lundi 3 août · Endurance + Renforcement · faite · 8 sur 8 ». Un
   `aria-label` sur un `<span>` sans rôle n'est pas restitué partout ; du texte
   l'est, et l'application n'a aucune classe de ce genre à ce jour.
5. **`tests/perso.test.js`** — un fichier à part, comme `seance.test.js` du
   PRP 04 : deux branches qui écrivent chacune dans son fichier fusionnent sans
   conflit. Seules les **deux assertions** que les PRP amont ont explicitement
   laissées en attente pour cet écran sont modifiées chez eux.
6. **Aucune zone « L'équipe » désactivée.** Le PRD §7.5 met « L'équipe » après
   « Ma progression », et c'est là que le PRP 09 l'ajoutera. En attendant, rien —
   pas un bloc grisé, pas un « bientôt ». Trois raisons : le lot 2 est suspendu à
   une décision d'infrastructure (PRD §12.1), et une promesse affichée qu'on ne
   tient pas coûte plus qu'une absence ; un bloc grisé remet la comparaison dans
   le cadre de l'écran fait précisément pour *« se lire sans se comparer à
   personne »* (§7.5) ; et le PRD §10 interdit ce qui s'interpose sans rien rendre.

## Fichiers

- Créer : `apps/marcq-handball/web/vue-perso.js`,
  `apps/marcq-handball/tests/perso.test.js`
- Modifier : `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/tests/vues.test.js`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/perso.test.js`,
  `apps/marcq-handball/tests/vues.test.js`, plus le contrôle à la main dans un
  navigateur à la tâche 5 — la CI n'a pas de navigateur, et une grille de sept
  colonnes qui déborde ne se voit qu'à l'écran.

## La coupure qui structure ce PRP

La même qu'à l'écran de séance, et pour la même raison :

- **le modèle** — `formaterDuree`, `lignesVolume`, `decalageInitial`,
  `modelePerso`. Fonctions pures : aucun DOM, aucune horloge, `aujourdhui` arrive
  par `ctx`. Toutes les décisions y sont — quel chiffre, quelle phrase, quel
  état, quel lien. `node --test` les prouve.
- **le montage** — `monterPerso`. Il pose le modèle dans le DOM et n'y ajoute
  **aucune** décision, pas même un `Math.max` de garde.

Un montage qui déciderait quoi que ce soit — « si le dénominateur est nul
alors… » — serait une règle métier hors de portée des tests. Elle est toujours
dans le modèle.

## La convention d'écriture, rappelée

**Les accents vont dans ce que l'enfant lit, pas dans le code** (PRP 01, PRP 04).
Les libellés, les phrases affichées et les noms de mois portent leurs accents ;
les commentaires, les noms de fonctions, de variables et de tests restent en
ASCII.

---

## Avant de commencer

```bash
./init.sh --branche marcq-handball/perso
```

Le garde-fou `.claude/garde-branche.sh` refuse toute édition tant que HEAD est
sur `main`. Les tâches s'exécutent **dans l'ordre** : chacune complète le fichier
de la précédente, et un import manquant fait échouer le fichier de test entier,
pas une assertion.

---

### Tâche 1 — Le volume en langage d'ado

**Fichiers :** Créer `apps/marcq-handball/tests/perso.test.js` · Créer `apps/marcq-handball/web/vue-perso.js`

PRD §7.5 : *« volume cumulé accompli, en langage d'ado : "112 pompes, 165 squats,
45 burpees, 2 h 10 de course" »*. Deux décisions de formatage s'y cachent, et
elles se prennent ici parce qu'elles sont du texte, donc prouvables sans
navigateur : les répétitions restent des entiers, et les durées basculent en
heures dès qu'elles se lisent mieux ainsi — « 2 h 10 », jamais « 130 min ».

- [ ] **Étape 1 — écrire le test qui échoue**

Créer `apps/marcq-handball/tests/perso.test.js` :

```js
// L'ecran perso, prouve sans navigateur.
//
// Meme coupure qu'a l'ecran de seance (PRP 04) : tout ce qui DECIDE est dans le
// modele, donc teste ici ; ce qui reste — poser le modele dans le DOM — se
// verifie a la main a la tache 5. La CI n'a pas de navigateur et n'en aura pas,
// l'app n'ayant aucune dependance (ossature §2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/domaine.js';
import * as vue from '../web/vue-perso.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const prog = chargerProgramme(JSON.parse(source('programme.json')));

// Le contexte d'ecran du PRP 03, reduit a ce que cet ecran lit.
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

// Les identifiants d'une seance, et ceux du programme entier. Les scenarios
// « tout coche » partent de la donnee, jamais d'une liste recopiee.
const casesDe = (date) =>
  prog.seances.find((s) => s.date === date).blocs.flatMap((b) => b.exercices).map((e) => e.id);
const toutesLesCases = prog.seances.flatMap((s) =>
  s.blocs.flatMap((b) => b.exercices.map((e) => e.id)));
const cocher = (ids) => Object.fromEntries(ids.map((id) => [id, '2026-08-10T08:00:00.000Z']));

test('les durees se lisent comme un ado les raconte (PRD §7.5)', () => {
  assert.equal(vue.formaterDuree(0), '0 s');
  assert.equal(vue.formaterDuree(45), '45 s', 'sous la minute, la seconde est l unite du gainage');
  assert.equal(vue.formaterDuree(60), '1 min');
  // Le gainage du programme entier. Le PRD §8 l'arrondit lui-meme a la minute.
  assert.equal(vue.formaterDuree(1425), '24 min');
  assert.equal(vue.formaterDuree(3600), '1 h', 'jamais « 60 min »');
  assert.equal(vue.formaterDuree(65 * 60), '1 h 05', 'les minutes se lisent sur deux chiffres');
  assert.equal(vue.formaterDuree(130 * 60), '2 h 10', 'la duree de la phrase du PRD §7.5');
  assert.equal(vue.formaterDuree(235 * 60), '3 h 55', 'la course du programme entier');
});

test('les repetitions restent des entiers, et le pluriel suit', () => {
  const lignes = vue.lignesVolume({ pompes: 1, squats: 20 });
  assert.deepEqual(lignes.map((l) => l.phrase), ['1 pompe', '20 squats']);
  assert.deepEqual(lignes.map((l) => l.unite), ['pompes', 'squats']);
});

test('la phrase du PRD §7.5 se reproduit au mot pres', () => {
  const totaux = { pompes: 112, squats: 165, burpees: 45, min_course: 130 };
  assert.equal(
    vue.lignesVolume(totaux).map((l) => l.phrase).join(', '),
    '112 pompes, 165 squats, 45 burpees, 2 h 10 de course',
  );
});

test('une unite a zero ne raconte rien', () => {
  assert.deepEqual(vue.lignesVolume({ pompes: 0, squats: 0, min_course: 0 }), []);
  // `cases` compte les cases cochees : c'est une mesure de progression, pas un
  // volume. Il n'entre jamais dans le recit.
  assert.deepEqual(vue.lignesVolume({ cases: 53 }), []);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js`
Attendu : ÉCHEC — le fichier ne se charge pas :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../apps/marcq-handball/web/vue-perso.js' imported from .../apps/marcq-handball/tests/perso.test.js`,
`# pass 0`, `# fail 1`.

- [ ] **Étape 3 — l'implémentation minimale**

Créer `apps/marcq-handball/web/vue-perso.js` :

```js
// vue-perso.js — ce que l'enfant a accompli, et personne d'autre.
//
// PRD §7.5 : « Ma progression » vient AVANT « L'equipe ». Cet ecran ne compare
// rien, il lit. La comparaison aux autres est le lot 2 (PRP 09) et s'ajoutera
// SOUS le calendrier, sans toucher a une ligne de ce fichier.
//
// Deux moities, comme a l'ecran de seance : un modele pur que node --test
// prouve, puis un montage qui n'ajoute aucune decision.

// --- le langage d'ado -------------------------------------------------------

// « 2 h 10 », pas « 130 min » (PRD §7.5). Sous la minute la seconde compte —
// c'est l'unite du gainage ; au-dela elle n'apprend plus rien, et le PRD §8
// arrondit lui-meme le gainage a la minute (« ~24 minutes »).
export function formaterDuree(secondes) {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  // Deux chiffres pour les minutes, comme sur une horloge : « 1 h 05 » et
  // jamais « 1 h 5 ».
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}

// Le pluriel se pose ici et pas au montage : c'est du texte, et le texte se
// prouve sans navigateur. Zero prend le singulier, comme en francais.
function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

// L'ordre est celui de la phrase du PRD §7.5 — « 112 pompes, 165 squats,
// 45 burpees, 2 h 10 de course » — complete par les trois unites que cette
// phrase n'illustre pas. La course ferme la liste : c'est la seule qui se lit
// en heures, et c'est la chute du recit.
const VOLUME = [
  { unite: 'pompes', dire: (n) => pluriel(n, 'pompe') },
  { unite: 'squats', dire: (n) => pluriel(n, 'squat') },
  { unite: 'burpees', dire: (n) => pluriel(n, 'burpee') },
  { unite: 'abdos', dire: (n) => pluriel(n, 'abdo') },
  { unite: 'fentes', dire: (n) => pluriel(n, 'fente') },
  { unite: 'gainage_s', dire: (s) => `${formaterDuree(s)} de gainage` },
  { unite: 'min_course', dire: (min) => `${formaterDuree(min * 60)} de course` },
];

// Les unites a zero sortent de la liste : « 0 burpee » n'est pas un recit, et le
// 3 aout au matin il y en aurait six sur sept. `cases` n'est pas un volume et
// n'apparait pas ici — il sert a la part, au-dessus.
export function lignesVolume(totaux) {
  return VOLUME
    .filter(({ unite }) => (totaux[unite] ?? 0) > 0)
    .map(({ unite, dire }) => ({ unite, phrase: dire(totaux[unite]) }));
}
```

Aucune mise en forme de nombre ne passe par `Intl` : sa sortie dépend de la
construction de Node, et le runner de CI rendrait autre chose que le navigateur —
c'est la raison qui a déjà écarté `Intl.DateTimeFormat` au PRP 04. Les totaux de
ce programme restent sous le millier, un séparateur de milliers n'a pas de client.

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js` · Attendu :
SUCCÈS, `# pass 4`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-perso.js apps/marcq-handball/tests/perso.test.js
git commit -m "marcq-handball : le volume accompli, en langage d'ado"
git push
```

---

### Tâche 2 — La part et le volume : le modèle

**Fichiers :** Modifier `apps/marcq-handball/web/vue-perso.js` · Tester `apps/marcq-handball/tests/perso.test.js`

PRD §7.5 : *« part du programme accompli à ce jour »*, et §9 : *« pas sur le total
du programme, sinon tout le monde est à 15 % le 5 août »*. Le dénominateur est
donc celui de `progression`, pas les 53 cases. Le volume, lui, est le cumul de
**ce qui a été coché** — `totauxAccomplis`, jamais `totauxPrescrits` : afficher le
prescrit sur cet écran reviendrait à féliciter quelqu'un pour le programme qu'un
autre a écrit.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/perso.test.js` :

```js
test('la part se mesure sur ce qui est programme a ce jour (PRD §9)', () => {
  const m = vue.modelePerso(contexte('2026-08-05', cocher(casesDe('2026-08-03'))));
  assert.equal(m.titre, 'Ma progression');
  assert.equal(m.part.cochees, 8);
  assert.equal(m.part.programmees, 16, 'les seances du 3 et du 5, pas les 53 cases du programme');
  assert.equal(m.part.pourcent, 50);
  assert.equal(m.part.echelle, 16);
  assert.equal(m.part.phrase, '8 exercices sur 16 programmés à ce jour.');
});

test('avant la premiere seance, la part ne divise pas par zero', () => {
  const m = vue.modelePerso(contexte('2026-08-02'));
  assert.equal(m.part.cochees, 0);
  assert.equal(m.part.programmees, 0);
  assert.equal(m.part.pourcent, 0);
  assert.equal(m.part.echelle, 1, '<progress max="0"> est invalide');
  assert.equal(m.part.phrase, 'Le programme commence lundi 3 août.');
});

test('tout coche, le volume raconte le programme entier (PRD §8)', () => {
  const m = vue.modelePerso(contexte('2026-08-21', cocher(toutesLesCases)));
  const phrases = m.volume.lignes.map((l) => l.phrase);
  assert.deepEqual(phrases.filter((p) => !p.endsWith('fentes')), [
    '226 pompes', '345 squats', '105 burpees', '210 abdos',
    '24 min de gainage', '3 h 55 de course',
  ]);
  // Le total de fentes n'est verrouille par aucune section du PRD : « 15 fentes
  // par jambe » se saisit en une valeur ou en deux, et c'est le PRP 02 qui
  // tranche. On verifie la forme, pas le nombre.
  assert.match(phrases.find((p) => p.endsWith('fentes')), /^\d+ fentes$/);
  assert.equal(m.part.pourcent, 100);
  assert.equal(m.volume.vide, null);
});

test('sans rien de coche, l ecran dit par ou ca commence', () => {
  const m = vue.modelePerso(contexte('2026-08-03'));
  assert.deepEqual(m.volume.lignes, []);
  assert.equal(m.volume.vide, 'Rien de coché pour l’instant. La première case ouvre le compteur.');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js`
Attendu : ÉCHEC, `# pass 4` et `# fail 4`, chacun sur
`error: 'vue.modelePerso is not a function'` (`name: 'TypeError'`).

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter en tête de `apps/marcq-handball/web/vue-perso.js`, **sous** le
commentaire d'en-tête et **avant** `// --- le langage d'ado` :

```js
import { calendrier, etatSeance, progression, totauxAccomplis } from './domaine.js';
import { dateEnToutesLettres } from './vue-jour.js';
```

`dateEnToutesLettres` vient de l'écran du jour et n'est pas recopiée : deux tables
de mois qui divergent est une panne bien plus sournoise qu'un import.

Puis ajouter à la fin du fichier :

```js
// --- le modele --------------------------------------------------------------

// Il ne recalcule rien : il appelle le domaine (PRP 02) et met en forme. Le
// calendrier arrive a la tache 3.
export function modelePerso(ctx) {
  const { prog, aujourdhui, faits = {} } = ctx;
  const p = progression(prog, aujourdhui, faits);
  const lignes = lignesVolume(totauxAccomplis(prog, faits));

  return {
    titre: 'Ma progression',
    part: {
      cochees: p.cochees,
      programmees: p.programmees,
      pourcent: Math.round(p.part * 100),
      // <progress max="0"> est invalide. Avant la premiere seance l'echelle vaut
      // 1 et la barre est vide : exactement ce qu'il faut montrer, sans laisser
      // le montage decider quoi que ce soit.
      echelle: Math.max(1, p.programmees),
      phrase: p.programmees === 0
        ? `Le programme commence ${dateEnToutesLettres(prog.debut)}.`
        : `${pluriel(p.cochees, 'exercice')} sur ${p.programmees} programmés à ce jour.`,
    },
    volume: {
      lignes,
      // Un ecran vide n'est pas une punition : il dit par ou ca commence.
      vide: lignes.length === 0
        ? 'Rien de coché pour l’instant. La première case ouvre le compteur.'
        : null,
    },
  };
}
```

`calendrier` et `etatSeance` sont importés dès maintenant : la tâche 3 les
utilise, et un import ajouté seul ferait un commit qui ne prouve rien.

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js` · Attendu :
SUCCÈS, `# pass 8`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-perso.js apps/marcq-handball/tests/perso.test.js
git commit -m "marcq-handball : la part accomplie a ce jour, et le volume qui va avec"
git push
```

---

### Tâche 3 — Le calendrier des dix-neuf jours

**Fichiers :** Modifier `apps/marcq-handball/web/vue-perso.js` · Tester `apps/marcq-handball/tests/perso.test.js`

PRD §9 : *« Les jours sans séance sont du repos, pas un trou. […] Un calendrier
majoritairement vide serait culpabilisant et faux. »* Le domaine rend déjà les
dix-neuf jours sans trou ; ce qui s'ajoute ici est ce que chaque case **dit** :
son numéro, sa marque, son état en toutes lettres, et le lien vers sa séance.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter l'import en tête de `apps/marcq-handball/tests/perso.test.js`, avec les
autres :

```js
import { MOTIF_SEANCE } from '../web/vue-seance.js';
```

Puis ajouter à la fin du fichier :

```js
test('le calendrier couvre les dix-neuf jours, jamais un trou (PRD §9)', () => {
  const { jours } = vue.modelePerso(contexte('2026-08-10')).calendrier;
  assert.equal(jours.length, 19);
  assert.equal(jours[0].date, prog.debut);
  assert.equal(jours.at(-1).date, prog.fin);
  assert.equal(jours.filter((j) => j.estSeance).length, 7);
  assert.equal(jours.filter((j) => j.statut === 'repos').length, 12);
});

test('les quatre etats du PRD §7.5, plus les deux que le domaine distingue', () => {
  const faits = { ...cocher(casesDe('2026-08-03')), ...cocher(casesDe('2026-08-07').slice(0, 2)) };
  const { jours } = vue.modelePerso(contexte('2026-08-10', faits)).calendrier;
  const par = (date) => jours.find((j) => j.date === date);
  assert.equal(par('2026-08-03').statut, 'faite');
  assert.equal(par('2026-08-05').statut, 'manquee');
  assert.equal(par('2026-08-07').statut, 'partielle', 'deux cases sur six : ni faite, ni manquee');
  assert.equal(par('2026-08-10').statut, 'aujourd-hui');
  assert.equal(par('2026-08-12').statut, 'a-venir');
  assert.equal(par('2026-08-11').statut, 'repos');
  // La marque double la couleur : au soleil, et pour qui distingue mal le rouge
  // du vert, la forme doit suffire.
  assert.equal(par('2026-08-03').marque, '✓');
  assert.equal(par('2026-08-11').marque, '');
  assert.equal(par('2026-08-10').estAujourdhui, true);
  assert.equal(par('2026-08-11').estAujourdhui, false);
});

test('chaque jour porte son compte, son lien et son nom lisible', () => {
  const { jours } = vue.modelePerso(contexte('2026-08-10', cocher(casesDe('2026-08-03')))).calendrier;

  const lundi = jours.find((j) => j.date === '2026-08-03');
  assert.equal(lundi.numero, 3);
  assert.equal(lundi.detail, '8 sur 8');
  assert.equal(lundi.href, '#/seance/2026-08-03');
  // Le calendrier ne peut pas mener a une route que le routeur ignore.
  assert.match(lundi.href, MOTIF_SEANCE);
  assert.equal(lundi.nom, 'lundi 3 août · Endurance + Renforcement · faite · 8 sur 8');

  const mardi = jours.find((j) => j.date === '2026-08-04');
  assert.equal(mardi.href, null, 'un jour de repos n ouvre aucune seance');
  assert.equal(mardi.detail, null);
  assert.equal(mardi.nom, 'mardi 4 août · repos');
});

test('la grille s aligne sur le lundi, quel que soit le jour de depart', () => {
  assert.equal(vue.decalageInitial('2026-08-03'), 0, 'le programme commence un lundi');
  assert.equal(vue.decalageInitial('2026-08-05'), 2);
  assert.equal(vue.decalageInitial('2026-08-09'), 6, 'un dimanche ferme la semaine');
  // programme.json est editable : la saison suivante peut commencer un mercredi.
  assert.equal(vue.modelePerso(contexte('2026-08-10')).calendrier.decalage, 0);
});

test('la legende ne montre que les etats presents ce jour-la', () => {
  const debut = vue.modelePerso(contexte('2026-08-03')).calendrier;
  assert.deepEqual(debut.legende.map((e) => e.libelle), ['aujourd’hui', 'à venir', 'repos']);
  assert.equal(debut.resume, '19 jours · 7 séances');

  const fin = vue.modelePerso(contexte('2026-08-21', cocher(toutesLesCases))).calendrier;
  assert.deepEqual(fin.legende.map((e) => e.libelle), ['faite', 'repos']);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js`
Attendu : ÉCHEC, `# pass 8` et `# fail 5`. Quatre tombent sur
`TypeError: Cannot destructure property 'jours' of '....calendrier' as it is undefined.`
ou `Cannot read properties of undefined (reading 'legende')` ; celui du décalage
sur `error: 'vue.decalageInitial is not a function'`.

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à `apps/marcq-handball/web/vue-perso.js`, **au-dessus** de
`modelePerso` :

```js
// --- le calendrier ----------------------------------------------------------

// Les six etats viennent du domaine (PRP 02) : cet ecran n'en invente aucun et
// n'en fusionne aucun. Le PRD §7.5 en nomme quatre — faite, manquee, a venir,
// repos ; les deux autres sont ceux que le domaine distingue et qu'aucun des
// quatre ne dirait sans mentir (voir « Points d'attention » du PRP).
// L'ordre des cles est celui de la legende.
export const ETATS = {
  'faite': { libelle: 'faite', marque: '✓' },
  'partielle': { libelle: 'commencée', marque: '½' },
  'aujourd-hui': { libelle: 'aujourd’hui', marque: '●' },
  'a-venir': { libelle: 'à venir', marque: '○' },
  'manquee': { libelle: 'manquée', marque: '—' },
  'repos': { libelle: 'repos', marque: '' },
};

// Le lundi ouvre la semaine : zero case vide quand le programme commence un
// lundi — le cas de 2026 — et jusqu'a six sinon. Calcule, jamais suppose :
// programme.json est editable et la saison suivante peut commencer autrement
// (PRD §8). Une date ISO sans heure est lue en UTC, `getUTCDay` ne subit donc
// aucun fuseau.
export function decalageInitial(dateISO) {
  const depuisDimanche = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return (depuisDimanche + 6) % 7;
}

// Ce qu'une case du calendrier montre et annonce.
function decrireJour(prog, jour, aujourdhui, faits) {
  const { libelle, marque } = ETATS[jour.statut];
  const commun = {
    date: jour.date,
    numero: Number(jour.date.slice(8, 10)),
    statut: jour.statut,
    marque,
    estSeance: jour.seance !== null,
    estAujourdhui: jour.date === aujourdhui,
  };

  if (jour.seance === null) {
    return {
      ...commun,
      href: null,
      detail: null,
      nom: `${dateEnToutesLettres(jour.date)} · ${libelle}`,
    };
  }

  // `calendrier` rend le statut, pas le compte. Plutot que de recompter les
  // cases ici, on interroge `etatSeance` — deja exportee par le domaine
  // (ossature §5) — sur les seuls jours de seance.
  const { coches, total } = etatSeance(prog, jour.date, aujourdhui, faits);
  const detail = `${coches} sur ${total}`;
  return {
    ...commun,
    href: `#/seance/${jour.date}`,
    detail,
    nom: `${dateEnToutesLettres(jour.date)} · ${jour.seance.titre} · ${libelle} · ${detail}`,
  };
}

// Seulement les etats presents : le 3 aout au matin, une legende de six lignes
// en expliquerait quatre qui ne sont nulle part sur la grille.
function legendeDe(jours) {
  const presents = new Set(jours.map((j) => j.statut));
  return Object.entries(ETATS)
    .filter(([statut]) => presents.has(statut))
    .map(([statut, { libelle, marque }]) => ({ statut, libelle, marque }));
}
```

Puis, dans `modelePerso`, ajouter les deux constantes sous celles qui existent :

```js
  const jours = calendrier(prog, aujourdhui, faits)
    .map((jour) => decrireJour(prog, jour, aujourdhui, faits));
  const seances = jours.filter((j) => j.estSeance).length;
```

et la quatrième clé de l'objet rendu, après `volume` :

```js
    calendrier: {
      decalage: decalageInitial(prog.debut),
      // Compte, jamais ecrit : « 19 jours · 7 seances » suit programme.json.
      resume: `${jours.length} jours · ${pluriel(seances, 'séance')}`,
      jours,
      legende: legendeDe(jours),
    },
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js` · Attendu :
SUCCÈS, `# pass 13`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-perso.js apps/marcq-handball/tests/perso.test.js
git commit -m "marcq-handball : le calendrier des dix-neuf jours et ses six etats"
git push
```

---

### Tâche 4 — Le montage, et son style

**Fichiers :** Modifier `apps/marcq-handball/web/vue-perso.js` · Modifier `apps/marcq-handball/web/style.css` · Tester `apps/marcq-handball/tests/perso.test.js`

Le modèle est complet : le montage ne décide plus rien. Les trois tests qui
suivent n'ont pas de navigateur et n'en ont pas besoin — ils attrapent les trois
fautes qui coûtent le plus et se voient le moins : du HTML composé à partir d'une
donnée éditable, une classe posée qui n'existe dans aucune feuille, et une
requête réseau sur un écran qui doit fonctionner hors ligne.

- [ ] **Étape 1 — écrire le test qui échoue**

Ajouter à la fin de `apps/marcq-handball/tests/perso.test.js` :

```js
test('le montage ne compose jamais de HTML a partir du programme', () => {
  // programme.json est une donnee editable a la main : un libelle contenant un
  // chevron casserait la page, ou pire.
  assert.equal(source('vue-perso.js').includes('innerHTML'), false, 'le texte passe par textContent');
});

test('toute classe posee par l ecran existe dans style.css', () => {
  const code = source('vue-perso.js');
  const css = source('style.css');
  const classes = new Set();
  // Les classes litterales passent toutes par le second argument de `el` et de
  // `lien`.
  for (const re of [/\bel\('[a-z0-9]+',\s*'([^']+)'/g, /\blien\('[^']*',\s*'([^']+)'/g]) {
    for (const [, liste] of code.matchAll(re)) {
      for (const classe of liste.split(/\s+/).filter(Boolean)) classes.add(classe);
    }
  }
  assert.ok(classes.size >= 12, 'la lecture de la source a echoue si le compte est bas');
  // Les classes construites par gabarit, que la lecture ci-dessus ne voit pas.
  classes.add('barre');
  for (const statut of Object.keys(vue.ETATS)) classes.add(`jour-${statut}`);
  for (const classe of classes) {
    assert.ok(css.includes(`.${classe}`), `.${classe} manque dans style.css`);
  }
});

test('l ecran perso ne parle a personne et ne compare a personne', () => {
  // PRD §11 : l'app reste utilisable reseau coupe, et cet ecran ne lit que le
  // telephone. PRD §7.5 : la comparaison est le second niveau, donc le lot 2.
  // Le controle porte sur la source entiere, commentaires compris — c'est ce qui
  // le rend trivial a executer et impossible a contourner par megarde.
  const code = source('vue-perso.js');
  for (const interdit of ['fetch(', 'classement', 'podium']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » n appartient pas a cet ecran`);
  }
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js`
Attendu : ÉCHEC, `# pass 15` et `# fail 1` — seul le test des classes tombe, sur
`AssertionError [ERR_ASSERTION]: la lecture de la source a echoue si le compte est bas`
(le montage n'existe pas encore, aucune classe n'est posée).

- [ ] **Étape 3 — l'implémentation minimale**

Ajouter à la fin de `apps/marcq-handball/web/vue-perso.js` :

```js
// --- le montage -------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision. Tout ce qui se
// decide est au-dessus, et se prouve sans navigateur.

// Les six memes lignes qu'a l'ecran de seance. `vue-seance.js` ne les exporte
// pas, et les hisser dans un module partage changerait une interface que le
// PRP 04 a fixee : beaucoup de bruit pour six lignes.
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

// La part accomplie, en grand : c'est le chiffre qu'on vient chercher.
function blocPart(part) {
  const bloc = el('div', 'part-perso');

  const chiffre = el('p', 'chiffre-part', `${part.pourcent} %`);
  // Le PRP 06 fait rouler ce nombre au lieu de le poser d'un coup (PRD §10). Il
  // le retrouve par cet attribut, sans rien savoir de la structure de l'ecran.
  chiffre.dataset.compteur = String(part.pourcent);

  // Une <progress> native, comme aux ecrans du jour et de seance : annoncee par
  // les lecteurs d'ecran sans un attribut ARIA de plus.
  const jauge = el('p', 'progression-perso');
  const barre = document.createElement('progress');
  barre.className = 'barre';
  barre.max = part.echelle;
  barre.value = part.cochees;
  jauge.append(barre);

  bloc.append(chiffre, jauge, el('p', 'phrase-part', part.phrase));
  return bloc;
}

function blocVolume(volume) {
  const bloc = el('section', 'volume-perso');
  bloc.append(el('h2', 'titre-bloc', 'Ce que tu as fait'));

  if (volume.vide !== null) {
    bloc.append(el('p', 'aide', volume.vide));
    return bloc;
  }

  const liste = el('ul', 'liste-volume');
  for (const ligne of volume.lignes) {
    const item = el('li', 'item-volume', ligne.phrase);
    // La seconde accroche du PRP 06 : la ligne se retrouve par son unite, sans
    // analyser le texte qu'elle affiche.
    item.dataset.unite = ligne.unite;
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

function blocCalendrier(cal) {
  const bloc = el('section', 'calendrier-perso');
  bloc.append(
    el('h2', 'titre-bloc', 'Le calendrier'),
    el('p', 'resume-calendrier', cal.resume),
  );

  // Les initiales n'apprennent rien a qui n'a pas la grille sous les yeux :
  // chaque case annonce deja sa date en toutes lettres.
  const entete = el('div', 'entete-calendrier');
  entete.setAttribute('aria-hidden', 'true');
  for (const initiale of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) {
    entete.append(el('span', null, initiale));
  }
  bloc.append(entete);

  const grille = el('div', 'grille-calendrier');
  for (let i = 0; i < cal.decalage; i += 1) {
    // Les cases d'avant le premier jour alignent la grille sur la semaine ;
    // elles ne portent aucune information.
    const vide = el('span', 'jour-calendrier jour-hors');
    vide.setAttribute('aria-hidden', 'true');
    grille.append(vide);
  }

  for (const jour of cal.jours) {
    const classe = `jour-calendrier jour-${jour.statut}`;
    // Un jour de seance est un lien — le calendrier est l'autre chemin du
    // rattrapage (PRD §6, lot 1 point 4). Un jour de repos n'est pas cliquable :
    // il n'y a rien a ouvrir, et un lien mort se tape trois fois avant qu'on
    // comprenne.
    const cellule = jour.href === null ? el('span', classe) : lien(jour.href, classe);

    const numero = el('span', 'numero-jour', String(jour.numero));
    numero.setAttribute('aria-hidden', 'true');
    const marque = el('span', 'marque-jour', jour.marque);
    marque.setAttribute('aria-hidden', 'true');
    // Ce que l'oeil lit dans la couleur et la marque, le lecteur d'ecran le lit
    // ici. Un aria-label sur un <span> sans role n'est pas restitue partout ;
    // du texte l'est.
    cellule.append(numero, marque, el('span', 'lu-seul', jour.nom));
    if (jour.estAujourdhui) cellule.setAttribute('aria-current', 'date');
    grille.append(cellule);
  }
  bloc.append(grille);

  const legende = el('ul', 'legende-calendrier');
  for (const etat of cal.legende) {
    const item = el('li', 'item-legende');
    const marque = el('span', 'marque-legende', etat.marque);
    marque.classList.add(`jour-${etat.statut}`);
    item.append(marque, el('span', null, etat.libelle));
    legende.append(item);
  }
  bloc.append(legende);
  return bloc;
}

// L'ecran, au contrat du PRP 03. Rien a demonter : aucun ecouteur ne deborde de
// `hote`, que le routeur vide avant chaque montage.
export function monterPerso(hote, ctx) {
  const m = modelePerso(ctx);
  const section = el('section', 'ecran ecran-perso');
  section.append(
    el('h1', 'titre-ecran', m.titre),
    blocPart(m.part),
    blocVolume(m.volume),
    blocCalendrier(m.calendrier),
  );
  // Le PRP 09 ajoutera « L'equipe » ici, apres le calendrier : le PRD §7.5 met
  // la comparaison au second niveau, jamais avant.
  hote.append(section);
}
```

Ajouter à la fin de `apps/marcq-handball/web/style.css` :

```css
/* ---- l'ecran perso --------------------------------------------------------
   « Ma progression » (PRD §7.5) : on se lit, on ne se compare pas. Un chiffre en
   grand, le volume en pastilles, et dix-neuf jours qui tiennent sur la largeur
   d'un telephone sans defilement horizontal. Les titres, la barre et le bloc
   d'aide reutilisent les classes des ecrans precedents : une jumelle
   divergerait. */

.ecran-perso { gap: 1.4rem; }

.part-perso {
  padding: 1rem;
  border: 1px solid var(--marcq-trait);
  border-radius: 10px;
  background: var(--marcq-carte);
}

.chiffre-part {
  margin: 0;
  font-size: clamp(2.5rem, 14vw, 3.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.progression-perso { display: flex; align-items: center; margin: .6rem 0; }

.phrase-part { margin: 0; color: var(--marcq-encre-douce); font-size: .95rem; }

/* Le volume en pastilles : une liste de choses a dire a table, pas un tableau
   de bord. */
.liste-volume {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item-volume {
  padding: .35rem .8rem;
  border: 1px solid var(--marcq-trait);
  border-radius: 999px;
  background: var(--marcq-carte);
  font-size: .95rem;
  font-variant-numeric: tabular-nums;
}

.resume-calendrier {
  margin: 0 0 .6rem;
  color: var(--marcq-encre-douce);
  font-size: .95rem;
}

.entete-calendrier,
.grille-calendrier {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.entete-calendrier {
  margin-bottom: 4px;
  color: var(--marcq-encre-douce);
  font-size: .75rem;
  text-align: center;
}

/* La hauteur ne descend jamais sous la zone de tap ; la largeur suit la
   colonne — sept colonnes de 48 px ne tiennent sur aucun telephone, et aucune
   action de l'app ne depend de cette grille (voir « Points d'attention »). */
.jour-calendrier {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: var(--marcq-tap);
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.numero-jour { font-size: .875rem; line-height: 1; font-variant-numeric: tabular-nums; }
.marque-jour { font-size: .75rem; line-height: 1; }

.jour-hors { visibility: hidden; }
.jour-repos { color: var(--marcq-encre-douce); }
.jour-a-venir { border-color: var(--marcq-trait); background: var(--marcq-carte); }
.jour-manquee {
  border-style: dashed;
  border-color: var(--marcq-trait);
  color: var(--marcq-encre-douce);
}
.jour-partielle {
  border-color: var(--marcq-accent);
  background: var(--marcq-carte);
  color: var(--marcq-accent);
}
.jour-faite {
  border-color: var(--marcq-accent);
  background: var(--marcq-accent);
  color: var(--marcq-sur-accent);
}
.jour-aujourd-hui {
  border-color: var(--marcq-danger);
  background: var(--marcq-carte);
  box-shadow: inset 0 0 0 1px var(--marcq-danger);
  font-weight: 700;
}

.jour-calendrier:focus-visible { outline: 3px solid var(--marcq-accent); outline-offset: 2px; }

.legende-calendrier {
  display: flex;
  flex-wrap: wrap;
  gap: .6rem;
  margin: .8rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--marcq-encre-douce);
  font-size: .8125rem;
}

.item-legende { display: inline-flex; align-items: center; gap: .3rem; }

.marque-legende {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: .75rem;
}

/* Lu par les lecteurs d'ecran, invisible a l'oeil. `display: none` le retirerait
   aussi de leur restitution : ce qui doit etre annonce reste dans le flux,
   reduit a un pixel. */
.lu-seul {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js` · Attendu :
SUCCÈS, `# pass 16`, `# fail 0`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/vue-perso.js apps/marcq-handball/web/style.css \
        apps/marcq-handball/tests/perso.test.js
git commit -m "marcq-handball : l'ecran perso, un chiffre en grand et dix-neuf jours"
git push
```

---

### Tâche 5 — L'écran entre dans le routeur

**Fichiers :** Modifier `apps/marcq-handball/web/app.js` · Modifier `apps/marcq-handball/tests/vues.test.js` · Modifier `apps/marcq-handball/web/sw.js` · Modifier `apps/marcq-handball/README.md` · Tester `apps/marcq-handball/tests/perso.test.js`

Le PRP 03 a laissé une assertion en attente — `choisirEcran('#/perso')` rend
`null`, *« l'écran perso arrive au PRP 05 »* — et le PRP 04 a laissé la liste des
écrans à `['reglages', 'seance', 'jour']`. C'est ici qu'elles changent. Trois
branchements, chacun invisible s'il manque : sans la route, l'écran n'existe pas ;
sans l'onglet, il n'est joignable qu'en tapant son adresse ; sans l'entrée de
coque, le premier passage hors ligne sur `#/perso` échoue, et rien ne le signale
tant qu'on reste connecté.

- [ ] **Étape 1 — écrire le test qui échoue**

Dans `apps/marcq-handball/tests/vues.test.js`, test
`le routeur connait les ecrans de ce lot, et rejette les autres`, remplacer :

```js
  assert.deepEqual(ECRANS.map((e) => e.nom), ['reglages', 'seance', 'jour']);
```

par :

```js
  assert.deepEqual(ECRANS.map((e) => e.nom), ['reglages', 'seance', 'perso', 'jour']);
```

et, dans le même test, remplacer :

```js
  assert.equal(choisirEcran('#/perso'), null, 'l ecran perso arrive au PRP 05');
```

par :

```js
  assert.equal(choisirEcran('#/perso').nom, 'perso');
```

Ajouter l'import en tête de `apps/marcq-handball/tests/perso.test.js`, avec les
autres :

```js
import { choisirEcran } from '../web/app.js';
```

Puis ajouter à la fin du fichier :

```js
test('la route #/perso monte l ecran perso', () => {
  assert.equal(choisirEcran('#/perso').nom, 'perso');
  assert.equal(choisirEcran('#/perso').monter, vue.monterPerso);
});

test('l onglet « Ma progression » mene a l ecran', () => {
  // PRD §7.5 nomme ce niveau « Ma progression » ; c'est ce mot qui va sur
  // l'onglet, pas « Stats » ni « Moi ».
  const code = source('app.js');
  assert.match(code, /#\/perso/);
  assert.match(code, /Ma progression/);
});

test('le service worker met l ecran perso en cache', () => {
  // PRD §11 : l'app reste utilisable reseau coupe. Sans cette entree, le premier
  // passage hors ligne sur un ecran jamais ouvert echoue.
  assert.match(source('sw.js'), /'\/vue-perso\.js'/, 'ajoute /vue-perso.js a la liste de coque');
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js tests/vues.test.js`
Attendu : ÉCHEC, `# fail 4` :
- dans `perso.test.js`, `TypeError: Cannot read properties of null (reading 'nom')`,
  puis deux `AssertionError [ERR_ASSERTION]: The input did not match the regular expression`
  — `/#\/perso/` et `/'\/vue-perso\.js'/` ;
- dans `vues.test.js`, l'écart de `deepEqual` sur la liste des écrans.

- [ ] **Étape 3 — l'implémentation minimale**

**`web/app.js`** — un import et deux lignes, exactement ce que le contrat du
PRP 03 annonce. Compléter les imports :

```js
import { monterPerso } from './vue-perso.js';
```

puis insérer l'entrée dans `ECRANS`, **entre `seance` et `jour`** :

```js
export const ECRANS = [
  { nom: 'reglages', motif: /^#\/reglages$/, monter: monterReglages },
  { nom: 'seance', motif: MOTIF_SEANCE, monter: monterSeance },
  { nom: 'perso', motif: /^#\/perso$/, monter: monterPerso },
  { nom: 'jour', motif: /^(#\/?)?$/, monter: monterJour },
];
```

Les quatre motifs sont disjoints, l'ordre est donc sans conséquence — mais celui
du jour reste **dernier** : c'est lui qui accepte l'adresse sans ancre.

Et l'onglet dans `LIENS`, **entre le jour et les réglages** : le PRD §7.5 met
« Ma progression » juste après ce qu'il y a à faire aujourd'hui.

```js
const LIENS = [
  { href: '#/', texte: 'Aujourd’hui' },
  { href: '#/perso', texte: 'Ma progression' },
  { href: '#/reglages', texte: 'Réglages' },
];
```

Contrairement à la séance, cet écran **a** un onglet : il n'a pas de paramètre,
il est le second niveau de lecture du PRD §7.5, et il doit être atteignable
depuis n'importe où sans repasser par l'écran du jour.

**`web/sw.js`** — ajouter `'/vue-perso.js'` à la liste de coque, après
`'/vue-seance.js'`. La vérification des PRP 03 et 04, complétée d'une entrée :

```bash
cd /home/user/hello-world/apps/marcq-handball && manquants=0 && \
for f in / /style.css /programme.json /app.js /etat.js /domaine.js \
         /vue-prenom.js /vue-jour.js /vue-reglages.js /vue-seance.js /vue-perso.js; do \
  grep -q "'$f'" web/sw.js || { echo "MANQUANT : $f"; manquants=1; }; \
done; [ "$manquants" = 0 ] && echo OK
```

Un chemin **en trop** ferait échouer `cache.addAll`, donc l'installation entière,
et le service worker n'activerait jamais ; `tests/coque.test.js` (PRP 01) vérifie
que chaque chemin correspond à un fichier livré.

**`apps/marcq-handball/README.md`** — ajouter la ligne au tableau des écrans :

```markdown
| `#/perso` | ma progression : la part, le volume accompli, le calendrier |
```

puis la section qui suit, à la fin du fichier :

````markdown
## L'écran « Ma progression »

Trois choses, dans cet ordre (PRD §7.5) : la **part** des exercices accomplis
parmi ceux **programmés à ce jour** — jamais sur les 53 du programme entier,
sinon tout le monde est à 15 % le 5 août (PRD §9) ; le **volume cumulé
accompli**, somme de ce qui a été coché, en langage d'ado (« 112 pompes, …
2 h 10 de course ») ; et le **calendrier des dix-neuf jours**, où les jours sans
séance sont du repos et non un trou.

Les six états d'une case viennent du domaine et ne sont ni fusionnés ni
inventés : `faite`, `commencée`, `aujourd’hui`, `à venir`, `manquée`, `repos`.
Une case de séance ouvre sa séance ; une case de repos n'est pas cliquable.

Le volume ne produit **aucun classement** (PRD §9) : il est déduit du programme,
il classerait dans le même ordre que la régularité. La comparaison à l'équipe est
le second niveau du §7.5 et arrive au lot 2, sous le calendrier.
````

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `cd apps/marcq-handball && node --test tests/perso.test.js tests/vues.test.js`
Attendu : SUCCÈS, `# pass 32`, `# fail 0` — 19 pour l'écran perso, 13 pour les
écrans de l'entrée.

Lancer : `./apps/marcq-handball/test.sh` · Attendu : SUCCÈS, `# fail 0` et
`ok  github.com/billbob-space/hello-world/apps/marcq-handball`.

Lancer : `./init.sh --check` · Attendu : SUCCÈS, aucun `KO`.

Le parcours complet, dans un navigateur :

```bash
cd apps/marcq-handball && go run .
```

1. L'onglet « Ma progression » est présent, et le suivre affiche l'écran : un
   pourcentage en grand, la phrase « … exercices sur … programmés à ce jour. »,
   puis « Ce que tu as fait ».
2. Sans rien de coché : « Rien de coché pour l’instant. La première case ouvre le
   compteur. » Aucune pastille, aucun zéro affiché.
3. Cocher une séance depuis `#/seance/2026-08-03`, revenir sur `#/perso` : les
   pastilles apparaissent, le pourcentage a bougé, la case du 3 est pleine et
   porte `✓`.
4. La grille tient sur la largeur de l'écran **sans défilement horizontal**, en
   mode responsive à 360 px comme à 414 px. Dix-neuf cases, la première sous le
   « L », les deux dernières colonnes de la dernière ligne vides.
5. Taper la case du 5 août ouvre `#/seance/2026-08-05` ; taper une case de repos
   ne fait rien et ne montre aucun curseur de lien.
6. Le bouton retour du navigateur ramène à `#/perso`, puis à l'écran du jour :
   chaque écran est une entrée d'historique (PRP 03, règle 2).
7. Outils de développement → Réseau, vider, puis changer d'onglet et revenir :
   **aucune requête**. Cocher « Offline » et `F5` : l'écran revient — c'est
   `/vue-perso.js` dans la liste de coque.
8. Réglages du système → thème sombre : les six états restent distinguables et le
   texte des cases pleines reste lisible.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web/app.js apps/marcq-handball/web/sw.js \
        apps/marcq-handball/tests/perso.test.js apps/marcq-handball/tests/vues.test.js \
        apps/marcq-handball/README.md
git commit -m "marcq-handball : l'ecran perso entre dans le routeur"
git push
```

---

## Points d'attention

**Le PRD §7.5 nomme quatre états, le domaine en distingue six.** Les deux
supplémentaires ne sont pas une invention de cet écran : `etatSeance` (PRP 02)
rend `partielle` et `aujourd-hui`, et aucun des quatre ne les dirait sans mentir.
Une séance entamée le 7 août puis abandonnée n'est pas « manquée » — cela
effacerait un travail réel, alors que le PRD §9 tient justement que *« le volume
est un récit »* ; elle n'est pas « faite » non plus. La séance du jour à 8 h du
matin n'est ni « manquée » ni tout à fait « à venir » : elle est la seule qu'on
puisse encore faire. Les fusionner produirait un calendrier qui ment dans les
deux sens ; c'est l'unique écart avec la lettre du §7.5, et il est assumé ici.

**`calendrier` ne porte pas le compte des cases.** Le périmètre de ce PRP veut
que tout vienne de `totauxAccomplis` et `calendrier` ; or `calendrier` rend
`{ date, seance, statut }` et le détail « 5 sur 8 » d'une case demande
`{ coches, total }`. `modelePerso` appelle donc `etatSeance` — **déjà exportée
par le domaine (ossature §5)** — sur les seuls jours de séance : c'est consommer
une interface amont, pas dupliquer un calcul. Si le PRP 02 est un jour amendé
pour que `calendrier` porte `coches` et `total`, `decrireJour` perd cet appel et
rien d'autre ne bouge.

**Le pourcentage peut reculer.** Le dénominateur grandit à chaque nouvelle séance
programmée : quelqu'un à 100 % le 3 août au soir sera à 50 % le 5 au matin sans
rien avoir décoché. C'est voulu (PRD §9, le classement mesure la régularité) mais
c'est contre-intuitif à l'écran — d'où la phrase « … sur N programmés à ce jour. »
qui accompagne toujours le chiffre. Ne l'abrège pas en « … sur N » : c'est
exactement ce qu'elle explique qui disparaîtrait.

**Sept colonnes de 48 px ne tiennent sur aucun téléphone.** C'est géométrique :
7 × 48 + 6 × 4 = 360 px de grille, plus les marges du corps. La case garde donc
toujours sa hauteur de `--marcq-tap` et prend la largeur de sa colonne ; sur un
écran de 360 px elle descend vers 40 px de large. Aucune action de l'app n'en
dépend : la séance du jour s'ouvre depuis l'écran du jour, et les séances
voisines depuis le pied de l'écran de séance (PRP 04). Si tu touches à cette
grille, vérifie d'abord qu'aucun défilement horizontal n'apparaît sur le corps de
la page — c'est la panne la plus détestée et la moins signalée sur mobile.

**Deux jeux de jetons CSS coexistent dans `style.css`.** Le PRP 01 a posé
`--papier --carte --encre --trait --signal --fait --tap --pas --rayon` ; le
PRP 03 a posé `--marcq-*` dans un `:root` qui vient après, et c'est celui que les
écrans utilisent — l'écran de séance comme celui-ci. Ne mélange pas les deux au
milieu d'une règle : une couleur qui devient `var(--introuvable)` tombe en
`inherit` sans une seule erreur en console, et la faute ne se voit qu'à l'œil, sur
un écran qu'aucun test ne regarde.

**`vue-perso.js` importe `vue-jour.js` pour `dateEnToutesLettres`.** Deux
conséquences : l'écran perso ne se charge pas si `/vue-jour.js` manque de la
coque hors ligne — il y est depuis le PRP 03 — et renommer cet export casse cet
écran. C'est le prix à ne pas payer deux tables de mois dans l'application ; deux
tables qui divergent est une panne bien plus sournoise qu'un import.

**Les mots `fetch(`, `classement` et `podium` sont interdits dans la source**,
commentaires compris, et un test le vérifie littéralement. Une phrase bien
intentionnée du genre « pas de classement ici » ferait passer la suite au rouge.
C'est le prix d'un contrôle qui ne demande ni analyseur syntaxique ni
dépendance ; si tu dois parler du lot 2 dans un commentaire, écris « la
comparaison aux autres ».

**`programme.json` reste éditable, et le §12.3 du PRD est encore ouvert.** La
page 3 sur 3 de la note du coach manque : si elle ajoute des séances avant le
17 août, le calendrier passe de dix-neuf cases à autant qu'il en faut, la légende
et le résumé suivent, et **aucune ligne de cet écran ne bouge** — c'est ce que
garantissent `decalageInitial`, le `resume` calculé et le test des dix-neuf
jours, qui lit `prog.debut` et `prog.fin` plutôt que des dates écrites en dur.
