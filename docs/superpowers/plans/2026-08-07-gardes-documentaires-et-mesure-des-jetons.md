# Plan — les garde-fous documentaires, et la mesure des jetons

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par
> tâche. Les étapes sont des cases à cocher (`- [ ]`).

**But** — rendre mécaniques trois des quatre familles d'anomalies relevées dans
`docs/2026-08-07-bilan-jetons-et-journal.md`, et rendre mesurables les deux
leviers de coût qui ne le sont pas encore.

**Approche** — aucune règle nouvelle dans le contrat : chaque amélioration est
un **test qui échoue** quand la règle est enfreinte, posé là où la règle vit
déjà. Deux rayons de souffle distincts, donc deux branches : les tâches 1 et 2
ne touchent que `apps/marcq-handball/` (branche `marcq-handball/<sujet>`), les
tâches 3 à 5 touchent l'outillage de la fabrique (branche `fabrique/<sujet>`).
**La tâche 6 n'est pas une sixième modification** : c'est le protocole de mesure
des tâches 1 et 2, et elle se lit **avant** de les commencer — sinon il n'y a
plus rien à mesurer.

**Outils** — Node.js `node:test` pour les tâches 1 et 2 (c'est déjà le harnais
de l'app, 291 tests), bash + awk pour les tâches 3 et 4 (c'est déjà celui de
`scripts/`), et les trois harnais de test racine `test-init.sh`, `test-cout.sh`,
`test-pret.sh` comme modèle de style.

## Contraintes globales

Elles s'appliquent à **toutes** les tâches, sans être répétées dans chacune.

- **Jamais de modification sur `main`.** `./scripts/branche.sh <préfixe>/<sujet>`
  ouvre la branche et son entrée de journal. Sur une branche `claude/` imposée
  par le harnais, le périmètre se déclare dans l'en-tête de l'entrée de journal.
- **`./scripts/pret.sh` avant chaque commit**, et il doit être vert.
- **Un commit par étape vérifiée**, poussé à chaque fois ; la pull request à la
  fin seulement.
- **Le relevé de coût** : `./scripts/cout.sh` avant la dernière étape de la
  branche — non relevé avant la fusion, il est perdu.
- **Les anomalies rencontrées vont dans l'entrée de journal au fil du travail**,
  avec les deux champs à vocabulaire fermé (`Detecte par`, `Action` — sans
  accents, `--check` les cherche ainsi).
- **Aucun test ne doit être écrit après le code qu'il vérifie.** L'ordre est
  toujours : test → échec constaté → code → passage constaté → commit.
- **Un garde-fou doit prouver qu'il attrape encore quelque chose.** C'est la
  famille C du bilan : trois garde-fous de l'app ne gardaient plus rien sans que
  personne ne le voie. Chaque tâche qui pose un garde-fou pose aussi l'étape qui
  le met en défaut exprès et constate l'échec.

## Ce que chaque fichier porte

| Fichier | Créé / modifié | Responsabilité |
|---|---|---|
| `apps/marcq-handball/tests/documents.test.js` | créé | les chiffres et les modules cités par `PRODUCT.md` et `README.md` sont ceux du code |
| `apps/marcq-handball/README.md` | modifié | nomme les trois modules qu'il décrit sans les nommer |
| `apps/marcq-handball/tests/source.js` | créé | `sansCommentaires()` et `interdits()` — le commun des garde-fous de source |
| `apps/marcq-handball/tests/source.test.js` | créé | met les deux fonctions en défaut exprès |
| `apps/marcq-handball/tests/{seance,perso,recompenses,domaine,classement,rejoindre}.test.js` | modifiés | leurs garde-fous passent par `tests/source.js` |
| `lib/jetons.sh` | créé | tarifs, multiplicateurs de cache, mise en forme des nombres — commun à `cout.sh` et `jetons.sh` |
| `scripts/cout.sh` | modifié | source `lib/jetons.sh` ; deux mesures de plus : les tours courts, l'alerte de contexte |
| `scripts/jetons.sh` | créé | consolide **toutes** les entrées de journal : la mesure de fabrique, reproductible |
| `test-jetons.sh` | créé | le contrat de test de `jetons.sh`, sur un journal factice aux chiffres connus |
| `test-cout.sh` | modifié | trois cas de plus : tours courts, alerte franchie, alerte non franchie |
| `init.sh` | modifié | `--check` dit combien d'entrées portent un relevé sans détail par tour |
| `test-init.sh` | modifié | un cas pour cette ligne |
| `.claude/settings.json`, `.claude/cloud-setup.sh`, `memory/outillage.md` | modifiés | l'outillage réduit à ce qui sert — les trois ensemble, toujours |
| `docs/2026-08-07-bilan-jetons-et-journal.md` | modifié | reçoit les résultats chiffrés des tâches 5 et 6 |

---

## Tâche 1 — Les chiffres des documents sont vérifiés contre le programme

**Pourquoi** — famille D du bilan, 9 occurrences. Un document qui affirme le
contraire du code ne casse rien : il induit le lecteur suivant en erreur, et
personne ne s'en aperçoit. L'app sait déjà faire l'inverse — `tests/rejoindre.test.js`
lit le § 7.4 du PRD et vérifie que l'écran en cite le texte au mot près. Cette
tâche étend le procédé aux **nombres**, et l'échéance la rend urgente : quand le
coach livrera la page 3 sur 3 de sa note (PRD § 12.3, avant le 17 août), les 53
exercices, les 24 rebours, les 29 chronomètres et les 19 jours changeront tous,
et **neuf phrases de deux documents deviendront fausses en silence**.

**Le piège à éviter, et il est déjà dans le journal** : chercher `53` ou `24`
dans les documents attrape aussi « ~24 minutes de gainage » et « 24 caractères
au plus », qui n'ont rien à voir. C'est la famille B — un filet large qui
attrape autre chose que sa cible. D'où un motif par affirmation, avec son
contexte.

**Fichiers**
- Créer : `apps/marcq-handball/tests/documents.test.js`
- Modifier : `apps/marcq-handball/README.md` (trois lignes, étape 4)
- Lus, jamais modifiés : `apps/marcq-handball/PRODUCT.md`,
  `apps/marcq-handball/web/programme.json`, `apps/marcq-handball/web/chrono.js`

**Interfaces**
- Consomme : `secondesDe(exercice)` de `web/chrono.js` — rend la durée en
  secondes, ou `null` si l'exercice n'en prescrit aucune. C'est **la** règle qui
  décide rebours ou chronomètre ; la recopier ici ferait diverger le test du code.
- Produit : rien que d'autres tâches consomment.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/marcq-handball/tests/documents.test.js` :

```js
// Les documents de l'app affirment des nombres — 53 exercices, 24 rebours,
// 19 jours. Ils sont TOUS calculables depuis web/programme.json, qui est la
// source. Ce fichier compare les deux, et il existe pour un rendez-vous connu :
// la page 3 sur 3 de la note du coach (PRD §12.3) ajoutera des seances, et sans
// ce test les neuf phrases ci-dessous resteraient a leur ancienne valeur sans
// que rien ne le signale.
//
// UN MOTIF PAR AFFIRMATION, avec son contexte : chercher « 24 » dans le README
// attrape aussi « ~24 minutes de gainage » et « 24 caracteres au plus ». Le
// filet large est la bonne technique pour du code, jamais pour de la prose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { secondesDe } from '../web/chrono.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
// Les documents sont retailles a 80 colonnes : une affirmation traverse les
// retours a la ligne. On compare donc sur un texte a espaces normalises.
const prose = (chemin) => lire(chemin).replace(/\s+/g, ' ');

const programme = JSON.parse(lire('web/programme.json'));
const exercices = programme.seances.flatMap((s) => s.blocs.flatMap((b) => b.exercices));

const CHIFFRES = {
  exercices: exercices.length,
  rebours: exercices.filter((e) => secondesDe(e) !== null).length,
  chrono: exercices.filter((e) => secondesDe(e) === null).length,
  seances: programme.seances.length,
  jours: Math.round(
    (Date.parse(programme.fin) - Date.parse(programme.debut)) / 86400000,
  ) + 1,
};

// document, motif a UNE capture, et le chiffre que la capture doit valoir.
const AFFIRMATIONS = [
  ['PRODUCT.md', /Environ \*\*(\d+) exercices cochables\*\*/g, 'exercices'],
  ['README.md', /pas sur les (\d+) du programme entier/g, 'exercices'],
  ['README.md', /jamais sur les (\d+) du programme entier/g, 'exercices'],
  ['README.md', /participants × (\d+) identifiants/g, 'exercices'],
  ['README.md', /aucun des (\d+) exercices/g, 'exercices'],
  ['README.md', /(\d+) requêtes sur un programme/g, 'exercices'],
  ['README.md', /compte à rebours\*\* — (\d+) des \d+ cases/g, 'rebours'],
  ['README.md', /compte à rebours\*\* — \d+ des (\d+) cases/g, 'exercices'],
  ['README.md', /des \d+ cases ; les (\d+) autres/g, 'chrono'],
];

test('les nombres ecrits dans les documents sont ceux du programme', () => {
  for (const [document, motif, chiffre] of AFFIRMATIONS) {
    const trouves = [...prose(document).matchAll(motif)];
    // Un motif qui n'attrape plus rien est un garde-fou mort : la phrase a ete
    // reecrite, et le nombre qu'elle porte n'est plus verifie par personne.
    assert.notEqual(
      trouves.length, 0,
      `${document} : le motif ${motif} n'attrape plus rien — la phrase a change, corrige le motif`,
    );
    for (const t of trouves) {
      assert.equal(
        Number(t[1]), CHIFFRES[chiffre],
        `${document} ecrit ${t[1]} la ou le programme dit ${CHIFFRES[chiffre]} (${chiffre}) : « ${t[0]} »`,
      );
    }
  }
});

// Deux nombres sont ecrits EN TOUTES LETTRES, et aucune capture ne les lit. Le
// test se contente donc de figer la valeur attendue : le jour ou le programme
// change, il echoue en disant exactement quoi relire.
test('les nombres ecrits en toutes lettres tiennent encore', () => {
  assert.equal(
    CHIFFRES.jours, 19,
    'le programme ne dure plus dix-neuf jours : PRODUCT.md §9 et README.md l ecrivent en toutes lettres',
  );
  assert.equal(
    CHIFFRES.seances, 7,
    'le programme ne compte plus sept seances : PRODUCT.md §8 et §9 l ecrivent en toutes lettres',
  );
  for (const document of ['PRODUCT.md', 'README.md']) {
    assert.match(prose(document), /dix-neuf jours/, `${document} : « dix-neuf jours »`);
  }
  assert.match(prose('PRODUCT.md'), /sept séances/, 'PRODUCT.md : « sept séances »');
});

// Le README est la notice de l'app : un module qu'il ne nomme jamais est un
// module dont personne ne saura ce qu'il fait avant de l'ouvrir.
test('chaque fichier de web/ est nomme au moins une fois dans le README', () => {
  const readme = lire('README.md');
  const fichiers = readdirSync(new URL('../web', import.meta.url))
    .filter((f) => /\.(js|css|json|html|webp|woff2|txt)$/.test(f));
  assert.ok(fichiers.length > 20, 'la liste des fichiers de web/ est suspecte');
  for (const f of fichiers) {
    assert.ok(readme.includes(f), `web/${f} n est nomme nulle part dans le README`);
  }
});

// Et l'inverse : un fichier cite mais disparu envoie le lecteur nulle part.
test('chaque fichier de web/ cite par un document existe', () => {
  const presents = new Set(readdirSync(new URL('../web', import.meta.url)));
  for (const document of ['README.md', 'PRODUCT.md']) {
    for (const t of lire(document).matchAll(/web\/([A-Za-z0-9._-]+\.[a-z0-9]+)/g)) {
      assert.ok(presents.has(t[1]), `${document} cite web/${t[1]}, qui n existe pas`);
    }
  }
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

```bash
cd apps/marcq-handball && node --test tests/documents.test.js
```

Attendu : **un échec**, sur le test « chaque fichier de web/ est nommé au moins
une fois dans le README », avec `web/ressenti.js n est nomme nulle part dans le
README`. Les trois modules manquants sont `ressenti.js`, `vue-bilan.js` et
`vue-coach.js`. Les trois autres tests doivent **passer** du premier coup : si
l'un d'eux échoue, c'est une dérive de plus, et elle se corrige dans le document,
jamais dans le test.

- [ ] **Étape 3 : prouver que le garde-fou n'est pas mort**

Mettre un document en défaut exprès, constater l'échec, puis remettre :

```bash
cd apps/marcq-handball
sed -i 's/pas sur les 53 du programme entier/pas sur les 51 du programme entier/' README.md
node --test tests/documents.test.js   # attendu : ECHEC « README.md ecrit 51 la ou le programme dit 53 »
git checkout README.md
```

- [ ] **Étape 4 : nommer les trois modules dans le README**

Dans `apps/marcq-handball/README.md`, ajouter le nom du module en tête de sa
section, comme le README le fait déjà partout ailleurs :

- section `## Le ressenti de fin de séance` → première phrase :
  `` `web/ressenti.js` porte les trois émojis et l'envoi. ``
- section `## La vue coach — et pourquoi elle n'a pas de mot de passe` →
  `` `web/vue-coach.js` monte cet écran. ``
- section `## Le bilan, après le 21 août` → `` `web/vue-bilan.js` monte cet écran. ``

- [ ] **Étape 5 : lancer les tests et constater le passage**

```bash
cd apps/marcq-handball && ./test.sh
```

Attendu : `pass 295` ou plus, `fail 0`, et le test Go vert. (291 tests avant
cette tâche, 4 ajoutés ici.)

- [ ] **Étape 6 : committer**

```bash
./scripts/pret.sh
git add apps/marcq-handball/tests/documents.test.js apps/marcq-handball/README.md
git commit   # message : ce que le test verifie, et le rendez-vous du 17 aout qui le motive
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Tâche 2 — Un garde-fou de source ne doit pas tomber sur un commentaire

**Pourquoi** — famille B du bilan, 5 occurrences, dont trois le même jour :
« Trois fois de plus, un commentaire a fait tomber son propre garde-fou ». Un
test qui vérifie que `vue-seance.js` ne contient pas `confirm(` lit le fichier
en entier, commentaires compris — si bien que le commentaire qui **explique** le
garde-fou le fait échouer. Chaque fois, la parade a été de réécrire le
commentaire : le défaut est resté.

**Fichiers**
- Créer : `apps/marcq-handball/tests/source.js`
- Créer : `apps/marcq-handball/tests/source.test.js`
- Modifier : `apps/marcq-handball/tests/seance.test.js`, `perso.test.js`,
  `recompenses.test.js`, `domaine.test.js`, `classement.test.js`, `rejoindre.test.js`

**Interfaces**
- Produit : `sansCommentaires(texte)` → `string`, le même code privé de ses
  commentaires `//` et `/* */` ; `interdits(code, mots)` → `string[]`, ceux des
  `mots` que `code` contient, dans l'ordre donné.
- Ce que ces deux fonctions ne font **pas** : retirer les chaînes de caractères.
  Plusieurs garde-fous cherchent justement une chaîne — `texte: 'Classement'`
  dans `rejoindre.test.js` — et les retirer les rendrait tous muets.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/marcq-handball/tests/source.test.js` :

```js
// Le commun des garde-fous de source, mis en defaut expres. Trois fois sur
// marcq-handball, un COMMENTAIRE portant le mot interdit a fait echouer le test
// cense surveiller le CODE ; a chaque fois le commentaire a ete reecrit, et le
// defaut est reste. Ces quatre cas sont sa description.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sansCommentaires, interdits } from './source.js';

test('un commentaire de ligne ne declenche plus le garde-fou', () => {
  const code = "// le texte passe par textContent, jamais par innerHTML\nel.textContent = x\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML']), []);
});

test('un commentaire de bloc non plus', () => {
  const code = "/* ni confirm( ni alert( ici */\nel.addEventListener('click', f)\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['confirm(', 'alert(']), []);
});

test('un emploi reel declenche toujours le garde-fou', () => {
  const code = "el.innerHTML = titre\nif (confirm('sur ?')) f()\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML', 'confirm(']),
    ['innerHTML', 'confirm(']);
});

test('une adresse http ne perd pas sa fin', () => {
  // Le double slash d'une URL n'ouvre pas un commentaire : le tronquer
  // supprimerait du code reel, et un garde-fou muet ne se voit pas.
  const code = "const AIDE = 'https://exemple.test/aide#innerHTML'\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML']), ['innerHTML']);
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

```bash
cd apps/marcq-handball && node --test tests/source.test.js
```

Attendu : ÉCHEC — `Cannot find module './source.js'`.

- [ ] **Étape 3 : écrire le commun**

Créer `apps/marcq-handball/tests/source.js` :

```js
// Le commun des garde-fous qui lisent le CODE d'un module. Voir
// tests/source.test.js pour ce qu'il doit et ne doit pas attraper.

// Les commentaires retires, le reste intact — chaines de caracteres comprises :
// plusieurs garde-fous cherchent justement une chaine, les retirer les rendrait
// muets. Le « [^:] » devant // epargne les adresses http://.
export function sansCommentaires(texte) {
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Ceux des mots que le code contient, dans l'ordre donne. Rendre la LISTE
// plutot qu'un booleen : le message d'echec nomme alors le fautif.
export function interdits(code, mots) {
  return mots.filter((m) => code.includes(m));
}
```

- [ ] **Étape 4 : lancer le test et constater le passage**

```bash
cd apps/marcq-handball && node --test tests/source.test.js
```

Attendu : `pass 4`, `fail 0`.

- [ ] **Étape 5 : brancher les garde-fous existants**

Dans chacun des six fichiers, remplacer la lecture brute par le commun. Exemple
sur `tests/seance.test.js`, où le garde-fou est aujourd'hui :

```js
test('aucun dialogue ne s interpose entre le tap et le decochage (PRD §7.3)', () => {
  for (const interdit of ['confirm(', 'alert(', 'prompt(']) {
    assert.equal(source.includes(interdit), false, `${interdit} : ...`);
  }
});
```

devient :

```js
import { sansCommentaires, interdits } from './source.js';
// ...
test('aucun dialogue ne s interpose entre le tap et le decochage (PRD §7.3)', () => {
  assert.deepEqual(
    interdits(sansCommentaires(source), ['confirm(', 'alert(', 'prompt(']), [],
    'l erreur de tap doit couter un tap, pas un dialogue',
  );
});
```

Les cinq autres emplacements, à traiter à l'identique :
`perso.test.js:166` (`innerHTML`), `recompenses.test.js:256` (liste `interdit`),
`seance.test.js:218` (`innerHTML`), `domaine.test.js:65` (`document`, `window`,
`localStorage`, `new Date`, `Date.now`, `fetch(`), `classement.test.js:101`
(`prenom`), `rejoindre.test.js:484` et `:491`.

**Un cas à ne pas convertir** : `domaine.test.js:73`, qui interdit des *nombres*
(`226`, `345`, …) dans `domaine.js`. Le retrait des commentaires ne change rien à
son défaut propre — un nombre nu se retrouve dans n'importe quelle date ou
longueur. Le laisser tel quel, et l'écrire dans l'entrée de journal.

- [ ] **Étape 6 : prouver que les garde-fous convertis attrapent encore**

```bash
cd apps/marcq-handball
printf '\nel.innerHTML = 1\n' >> web/vue-seance.js
./test.sh 2>&1 | grep -c "^not ok"   # attendu : au moins 1
git checkout web/vue-seance.js
./test.sh                            # attendu : fail 0
```

- [ ] **Étape 7 : committer**

```bash
./scripts/pret.sh
git add apps/marcq-handball/tests/
git commit   # message : le defaut repare, et les trois occurrences qui l'ont paye
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Tâche 3 — `scripts/jetons.sh` : la consolidation devient reproductible

**Pourquoi** — le tableau du bilan (1 454 tours, 234,46 $, la répartition
écriture/lecture/sortie) a été calculé une fois, à la main, par un script jeté.
Il n'est donc ni reproductible, ni vérifiable, ni comparable au mois prochain.
Or c'est le seul chiffre qui dit si les leviers marchent.

**Fichiers**
- Créer : `lib/jetons.sh`, `scripts/jetons.sh`, `test-jetons.sh`
- Modifier : `scripts/cout.sh` (retirer ce qui part dans `lib/jetons.sh`),
  `init.sh` (une ligne dans `--check`), `test-init.sh` (un cas)

**Interfaces**
- `lib/jetons.sh` produit : `JETONS_CACHE_ECRITURE=1.25`,
  `JETONS_CACHE_LECTURE=0.10`, `jetons_tarifs()` (rend
  `« modele:entree:sortie »` séparés par `;`, depuis `fabrique.yml`),
  `jetons_nb <entier>` (`7557412` → `7 557 412`), `virgule <flottant>`.
  Ce sont exactement `COUT_CACHE_ECRITURE`, `COUT_CACHE_LECTURE`,
  `cout_tarifs`, `cout_nb` et `virgule` de `scripts/cout.sh`, déplacés.
- `scripts/jetons.sh` consomme : les blocs `<!-- cout-detail ... -->` des
  entrées de `journal/`, dont chaque ligne vaut
  `rang agent modèle écriture lecture sortie`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `test-jetons.sh`. Il suit le style de `test-cout.sh` : un bac à sable, un
journal factice dont on connaît les totaux à la main, et une comparaison sur la
sortie.

```bash
#!/usr/bin/env bash
#
# test-jetons.sh — le contrat de test de scripts/jetons.sh.
#
# Meme raison d'etre que test-cout.sh : le script rend des nombres a sept
# chiffres, et un nombre faux ressemble trait pour trait a un nombre juste.
# Le journal factice ci-dessous a des totaux calcules a la main, en commentaire.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"
TEMP=$(mktemp -d); trap 'rm -rf "$TEMP"' EXIT
VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0
reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# Un bac : le depot suivi par git, dont on remplace journal/ par le factice.
#
# Entree A — deux tours, opus-5 (entree 5 $, sortie 25 $ le million) :
#   ecriture 100000 x 5 x 1,25 / 1e6 = 0,625 $
#   lecture  400000 x 5 x 0,10 / 1e6 = 0,200 $
#   sortie     2000 x 25       / 1e6 = 0,050 $   -> 0,875 $, 502 000 jetons
#   un tour sort 150 jetons (< 300) : un tour court sur deux.
# Entree B — un total sans detail : comptee a part, jamais dans les postes.
bac() {
  local d; d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  rm -f "$d"/journal/*.md
  cat > "$d/journal/2026-01-01-fabrique-a.md" <<'FIN'
# 2026-01-01 — fabrique/a

Branche : `fabrique/a`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
<!-- cout-total: 502000 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 100000 0 1850
2 principal claude-opus-5 0 400000 150
-->
<!-- /cout -->
FIN
  cat > "$d/journal/2026-01-02-fabrique-b.md" <<'FIN'
# 2026-01-02 — fabrique/b

Branche : `fabrique/b`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
<!-- cout-total: 1000000 -->
<!-- /cout -->
FIN
  git -C "$d" init -q -b main; git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  printf '%s' "$d"
}

verifie() {  # verifie <nom> <motif attendu dans la sortie>
  case "$1" in *"$MOTIF"*) ;; *) return 0 ;; esac
  local d sortie; d=$(bac); sortie=$( cd "$d" && ./scripts/jetons.sh 2>&1 ) || true
  if printf '%s' "$sortie" | grep -qF "$2"; then reussi "$1"
  else echec "$1" "« $2 » absent de la sortie"; fi
}

printf '\n-- les chiffres\n'
verifie "le total en jetons des entrees detaillees" "502 000"
verifie "le cout total"                              "0,88 $"
verifie "la part de la lecture de cache"             "23 %"
verifie "les tours courts"                           "1 des 2"
verifie "l entree sans detail est comptee a part"    "1 entree(s) sans detail"
verifie "le total du depot, detail ou non"           "1 502 000"

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
```

Rendre le fichier exécutable : `chmod +x test-jetons.sh`.

*Les deux valeurs à recalculer avant de figer le test* : « 0,88 $ » est
l'arrondi de 0,875 ; « 23 % » est la part de la lecture (0,200 / 0,875 = 22,9 %).
Si la mise en forme choisie à l'étape 3 arrondit autrement, ce sont **ces
lignes-ci** qu'on ajuste, jamais le calcul.

- [ ] **Étape 2 : lancer le test et constater l'échec**

```bash
./test-jetons.sh
```

Attendu : six échecs, tous parce que `./scripts/jetons.sh` n'existe pas.

- [ ] **Étape 3 : déplacer le commun, puis écrire `jetons.sh`**

D'abord `lib/jetons.sh` : y couper de `scripts/cout.sh` les deux constantes
`COUT_CACHE_ECRITURE` / `COUT_CACHE_LECTURE` (renommées `JETONS_*`), et les
fonctions `cout_tarifs`, `cout_nb`, `virgule` (renommées `jetons_tarifs`,
`jetons_nb`, `virgule` conservé). Dans `scripts/cout.sh`, remplacer par
`. lib/jetons.sh` et les nouveaux noms.

Puis `scripts/jetons.sh` :

```bash
#!/usr/bin/env bash
#
# jetons.sh — ce que la fabrique entiere a consomme, lu dans journal/.
#
#   ./scripts/jetons.sh              le tableau par branche, puis la synthese
#   ./scripts/jetons.sh --leviers    n'affiche que les deux parts qui pilotent
#
# cout.sh mesure UNE branche depuis les conversations du conteneur ; ce
# script-ci mesure TOUTES les branches depuis ce que cout.sh a fige dans le
# journal. C'est la seule mesure qui survive aux conteneurs.
#
# Une entree qui porte un total sans detail par tour n'est pas une erreur :
# le bloc de detail est arrive apres les huit premieres. Elle est comptee dans
# le total du depot et exclue des postes, et le script le dit — un chiffre
# partiel qu'on prend pour un chiffre complet est pire que pas de chiffre.

set -euo pipefail
git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"
. lib/socle.sh
. lib/jetons.sh

LEVIERS=0
[ "${1-}" = "--leviers" ] && LEVIERS=1

awk -v TARIFS="$(jetons_tarifs)" -v MULT_E="$JETONS_CACHE_ECRITURE" \
    -v MULT_L="$JETONS_CACHE_LECTURE" -v LEVIERS="$LEVIERS" '
  BEGIN {
    n = split(TARIFS, l, ";")
    for (i = 1; i <= n; i++) { if (l[i] == "") continue
      split(l[i], c, ":"); prix_e[c[1]] = c[2] + 0; prix_s[c[1]] = c[3] + 0 }
  }
  FNR == 1 { fichier = FILENAME; sub(/^journal\//, "", fichier); sub(/\.md$/, "", fichier)
             dedans = 0; vus[fichier] = 1 }
  /<!-- cout-total:/ { t = $0; gsub(/[^0-9]/, "", t); total_depot += t; a_total[fichier] = 1 }
  /<!-- cout-detail/ { dedans = 1; a_detail[fichier] = 1; next }
  dedans && /^-->/   { dedans = 0; next }
  dedans && NF == 6 {
    m = $3; w = $4 + 0; r = $5 + 0; s = $6 + 0
    if (!(m in prix_e)) { inconnus[m] = 1; next }
    c = (w * prix_e[m] * MULT_E + r * prix_e[m] * MULT_L + s * prix_s[m]) / 1000000
    tours[fichier]++; ew[fichier] += w; er[fichier] += r; es[fichier] += s; ec[fichier] += c
    T_tours++; T_w += w; T_r += r; T_s += s; T_c += c
    T_we += w * prix_e[m] * MULT_E / 1000000
    T_re += r * prix_e[m] * MULT_L / 1000000
    T_se += s * prix_s[m] / 1000000
    if (s < 300) { courts++; courts_c += c }
    if (tours[fichier] == 1) { amorce[fichier] = w; prix_amorce[fichier] = prix_e[m] }
  }
  # La mise en forme reste ici plutot que dans un sed en aval : un sed qui
  # espace les milliers ne sait pas distinguer un nombre de jetons d'un montant
  # en dollars, et decoupe les deux.
  function nb(x,   s, r) {
    s = sprintf("%d", x)
    while (length(s) > 3) { r = " " substr(s, length(s) - 2) r; s = substr(s, 1, length(s) - 3) }
    return s r
  }
  function eur(x,   s) { s = sprintf("%.2f", x); gsub(/\./, ",", s); return s }
  function pc(x, t) { return sprintf("%d %%", int(100 * x / t + 0.5)) }
  END {
    if (T_tours == 0) { print "aucun releve detaille dans journal/ — rien a consolider"; exit }
    if (!LEVIERS) {
      printf "\n-- par branche\n"
      for (f in tours)
        printf "  %-52s %6d tours  %14s jetons  %9s $\n", \
          substr(f, 1, 52), tours[f], nb(ew[f] + er[f] + es[f]), eur(ec[f])
    }
    printf "\n-- la facture\n"
    printf "  ecriture de cache  %9s $  %5s\n", eur(T_we), pc(T_we, T_c)
    printf "  lecture de cache   %9s $  %5s\n", eur(T_re), pc(T_re, T_c)
    printf "  sortie             %9s $  %5s\n", eur(T_se), pc(T_se, T_c)
    printf "  TOTAL              %9s $  sur %s tour(s), %s jetons detailles\n", \
      eur(T_c), nb(T_tours), nb(T_w + T_r + T_s)
    printf "\n-- les leviers\n"
    for (f in amorce) { a += amorce[f] * (tours[f] - 1) * prix_amorce[f] * MULT_L / 1000000 }
    printf "  amorce relue       %9s $  %5s\n", eur(a), pc(a, T_c)
    printf "  tours courts       %9s $  %5s  — %s des %s tours sortent moins de 300 jetons\n", \
      eur(courts_c), pc(courts_c, T_c), nb(courts), nb(T_tours)
    nd = 0; for (f in a_total) if (!(f in a_detail)) nd++
    printf "\n-- ce qui manque\n"
    printf "  %d entree(s) sans detail par tour, comptees hors des postes ci-dessus\n", nd
    printf "  total du depot, detail ou non : %s jetons\n", nb(total_depot)
    for (m in inconnus) printf "  modele hors tarifs, non facture : %s\n", m
  }
' journal/*.md
```

Le prix de l'amorce se lit sur le modèle du **premier tour de chaque branche**,
et non sur un 5 $ écrit en dur : le jour où une branche tourne sur un autre
modèle, un tarif figé rendrait le levier faux sans le dire. D'où, dans le bloc
qui traite les lignes de détail, une ligne de plus à côté de `amorce[fichier]` :

```awk
    if (tours[fichier] == 1) { amorce[fichier] = w; prix_amorce[fichier] = prix_e[m] }
```

Rendre exécutable : `chmod +x scripts/jetons.sh`.

- [ ] **Étape 4 : lancer les deux harnais et constater le passage**

```bash
./test-jetons.sh    # attendu : 6 reussi(s), 0 echec(s)
./test-cout.sh      # attendu : inchange — le deplacement dans lib/ n'a rien casse
```

Le second est le vrai juge de l'étape : `cout.sh` a perdu trois fonctions, et
c'est son propre contrat de test qui prouve qu'il marche encore.

- [ ] **Étape 5 : lancer le script sur le vrai journal**

```bash
./scripts/jetons.sh
```

Attendu : les chiffres du bilan retrouvés — de l'ordre de 1 454 tours,
234 $, lecture de cache au-dessus de 70 %, et « 8 entrée(s) sans détail ». Un
écart de plus de 5 % avec `docs/2026-08-07-bilan-jetons-et-journal.md` est une
anomalie : la chercher avant de continuer, et l'écrire dans le journal.

- [ ] **Étape 6 : `--check` dit ce qui manque**

Dans `init.sh`, à la section `-- journal`, après la ligne qui compte les entrées,
ajouter le décompte des relevés sans détail, en **avertissement** (jamais un KO :
les huit anciennes entrées sont irréparables) :

```bash
sans_detail=0
for j in journal/*.md; do
  grep -q '<!-- cout-total:' "$j" || continue
  grep -q '<!-- cout-detail' "$j" || sans_detail=$((sans_detail+1))
done
[ "$sans_detail" -gt 0 ] && warn "$sans_detail relevé(s) de coût sans détail par tour — hors de portée de ./scripts/jetons.sh"
```

Ajouter dans `test-init.sh` un cas qui pose une entrée avec total sans détail et
vérifie que la ligne sort, sur le modèle des cas existants.

- [ ] **Étape 7 : committer**

```bash
./scripts/pret.sh && ./init.sh --check
git add lib/jetons.sh scripts/jetons.sh scripts/cout.sh test-jetons.sh test-init.sh init.sh
git commit   # message : pourquoi la mesure doit survivre au conteneur
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Tâche 4 — `cout.sh` : les tours courts, et l'alerte de contexte

**Pourquoi** — deux leviers du bilan n'ont aujourd'hui aucun porteur : 59 % des
tours sortent moins de 300 jetons pour la moitié de la facture, et deux branches
ont dépassé 550 000 jetons de contexte sans que rien ne le dise **pendant** le
travail, quand on peut encore agir. Un chiffre qui n'arrive qu'après la fusion
ne change pas la façon de travailler.

**Dépend de la tâche 3** : `cout_nb` s'y appelle désormais `jetons_nb` et vit
dans `lib/jetons.sh`. Menée avant, cette tâche-ci écrirait un nom qui va
disparaître.

**Fichiers**
- Modifier : `scripts/cout.sh` (awk + mise en forme + `cout_alerte`)
- Modifier : `test-cout.sh` (trois cas)

**Interfaces**
- `cout_releve` gagne une ligne de sortie : `COURTS <nombre> <dollars>`.
- Nouvelle fonction `cout_alerte <releve>` : imprime l'avertissement quand la
  dernière relecture dépasse `COUT_CONTEXTE_ALERTE=300000`, et rien sinon. Elle
  est appelée dans les **deux** modes — par `cout_rappel`, donc par `pret.sh`
  avant chaque commit, et à la fin du relevé normal, ce qui la rend observable
  par `test-cout.sh`, dont le harnais lance `--dry-run`.

- [ ] **Étape 1 : écrire les trois cas qui échouent**

Dans `test-cout.sh`, à la suite des cas existants. `porte <nom> <motif>` est le
helper déjà défini : il monte le bac, dépose la conversation lue sur l'entrée
standard, lance `cout.sh --dry-run` et vérifie que la sortie contient le motif.

```bash
printf '\n-- les leviers\n'

# Deux tours sur trois sortent moins de 300 jetons : ce sont des appels d'outil
# nus, qui paient tout le contexte relu pour une sortie de rien.
porte "les tours courts sont comptes" "2 des 3" <<FIN
$(requete c_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 2000)
$(requete c_2 "$BRANCHE" 0 claude-opus-5 0 0 50000 150)
$(requete c_3 "$BRANCHE" 0 claude-opus-5 0 0 60000 100)
FIN

porte "l alerte de contexte se declenche au-dela du seuil" "coupe la session" <<FIN
$(requete a_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete a_2 "$BRANCHE" 0 claude-opus-5 0 0 350000 500)
FIN
```

Le troisième cas est l'inverse du deuxième, et `porte` ne sait pas dire
« absent ». Ajouter à côté de `porte` son jumeau, quinze lignes plus haut dans le
fichier :

```bash
# tait <nom> <motif> — l'inverse de porte. Un avertissement qui se declenche
# toujours ne veut plus rien dire : le cas qui prouve qu'il SAIT se taire vaut
# celui qui prouve qu'il sait parler.
tait() {
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue"; return 0; }
  if printf '%s\n' "$sortie" | grep -qF -- "$motif"; then
    echec "$nom" "la sortie porte « $motif », qu'elle ne devrait pas"
  else
    reussi "$nom"
  fi
}
```

puis le cas lui-même :

```bash
tait "l alerte de contexte se tait en deca du seuil" "coupe la session" <<FIN
$(requete b_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete b_2 "$BRANCHE" 0 claude-opus-5 0 0 100000 500)
FIN
```

- [ ] **Étape 2 : lancer et constater l'échec**

```bash
./test-cout.sh
```

Attendu : **deux** échecs — « les tours courts sont comptes » et « l alerte de
contexte se declenche ». Le troisième, celui qui vérifie le silence, passe dès
maintenant et ne prouve donc encore rien : c'est l'étape 5 qui lui donne sa
valeur.

- [ ] **Étape 3 : compter les tours courts**

Dans le `awk` de `cout_releve`, à côté du bloc `det_*` déjà présent :

```awk
      # Un tour qui ne rend qu'un appel d'outil paie tout le contexte relu pour
      # une sortie de rien. Les grouper est le seul gain sans contrepartie :
      # deux appels independants dans le meme tour coutent une relecture au lieu
      # de deux, et ne changent rien a ce qui est lu.
      if (v_s < 300 && (m in prix_e)) {
        courts++
        courts_d += (v_ce * prix_e[m] * MULT_E + v_cl * prix_e[m] * MULT_L \
                   + v_s * prix_s[m]) / 1000000
      }
```

et dans le `END` : `printf "COURTS %d %.6f\n", courts, courts_d`.

Puis, dans la partie bash qui compose le bloc « Ce qui coûte », une puce de plus,
placée après « Démarrage » :

```
- **Tours courts** — 856 des 1 454 tours (59 %) sortent moins de
  300 jetons : un appel d'outil nu, qui paie tout le contexte relu. Ils
  coutent 120,35 $, soit 51 % de la facture. Grouper les appels
  independants dans un meme tour divise ce poste.
```

(les nombres viennent du relevé, pas du plan ; ce sont `champ COURTS 1`,
`champ ECHANGES 1` et `part`.)

- [ ] **Étape 4 : l'alerte de contexte**

En tête de `scripts/cout.sh`, à côté des deux multiplicateurs :

```bash
# Au-dela de ce contexte, chaque tour coute plus de 0,15 $ AVANT d'avoir rien
# fait. Le seuil n'est pas une limite technique : c'est le point ou couper la
# session ou confier la suite a l'artisan rapporte plus qu'il ne coute.
COUT_CONTEXTE_ALERTE=300000
```

puis la fonction, à côté de `cout_rappel` — `champ` n'existe pas encore à cet
endroit du fichier, on lit donc le relevé par `awk` comme le fait `cout_rappel` :

```bash
cout_alerte() {  # cout_alerte <releve> — l'avertissement de contexte, ou rien
  local dernier
  dernier=$(printf '%s\n' "$1" | awk '$1 == "COURBE" { print $3 }')
  [ -n "$dernier" ] && [ "$dernier" -gt "$COUT_CONTEXTE_ALERTE" ] 2>/dev/null || return 0
  warn "contexte de $(jetons_nb "$dernier") jetons — chaque tour se paie en entier ; coupe la session, ou confie la suite a l'artisan"
}
```

Elle s'appelle à deux endroits. Dans `cout_rappel`, après les avertissements
existants — la variable `actuel` y vient déjà d'un `cout_releve`, qu'on garde
dans une variable locale au lieu de le rejouer :

```bash
  cout_alerte "$releve_courant"
```

et dans le mode normal, juste après l'écriture du bloc dans l'entrée de journal :

```bash
cout_alerte "$releve"
```

- [ ] **Étape 5 : lancer, constater le passage, et mettre l'alerte en défaut**

```bash
./test-cout.sh     # attendu : tous verts, les trois nouveaux compris
```

Puis la preuve que le cas du silence n'est pas un cas mort — abaisser le seuil
sous la valeur du cas « se tait », et constater qu'il échoue :

```bash
sed -i 's/^COUT_CONTEXTE_ALERTE=300000/COUT_CONTEXTE_ALERTE=50000/' scripts/cout.sh
./test-cout.sh   # attendu : ECHEC de « l alerte de contexte se tait en deca du seuil »
git checkout scripts/cout.sh   # puis refaire les etapes 3 et 4, ou stash
```

Plus simple si l'étape est menée avant le commit : `git stash` le fichier, ou
rejouer l'édition. Ne jamais laisser le seuil abaissé.

```bash
./scripts/pret.sh  # l'alerte doit apparaitre si la session courante depasse le seuil
```

- [ ] **Étape 6 : committer**

```bash
git add scripts/cout.sh test-cout.sh
git commit   # message : les deux leviers, et pourquoi l'alerte est AVANT le commit
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Tâche 5 — L'amorce, mesurée avant et après

**Pourquoi** — c'est le plus gros levier chiffré du bilan : 43,89 $, 19 % de la
facture, pour du contexte qui est **relu à chaque tour de chaque session**.
Et le contrat n'y est presque pour rien — `CLAUDE.md` pèse ~4 000 jetons sur les
55 815 mesurés. Le reste est de l'outillage : treize plugins déclarés dans
`.claude/settings.json`, plus les connecteurs du compte, chacun payant ses
définitions d'outils à chaque échange.

**Ce que cette tâche n'est pas** : une coupe à l'aveugle. Un plugin retiré à tort
se paie en travail refait, pas en jetons. D'où une mesure avant, une décision
humaine, une mesure après, et un critère de retour en arrière.

**Fichiers**
- Modifier : `.claude/settings.json`, `.claude/cloud-setup.sh` (les deux
  ensemble, toujours : `--check` vérifie qu'ils déclarent le même compte)
- Modifier : `memory/outillage.md` (la liste et la raison de chaque plugin gardé)

- [ ] **Étape 1 : relever l'amorce d'aujourd'hui**

```bash
./scripts/cout.sh --dry-run | grep -A2 "Démarrage"
```

Noter le nombre exact — sur cette branche il vaut **55 815 jetons**, et la part
relue qu'il représente. C'est la référence.

- [ ] **Étape 2 : établir ce qui sert, plugin par plugin**

```bash
grep -o '"[a-z0-9-]*@[a-z-]*"' .claude/settings.json
grep -rl "superpowers:\|impeccable:\|mattpocock" journal/ docs/ | sort
```

Écrire, dans l'entrée de journal, une ligne par plugin : **utilisé sur quelle
branche, pour quoi**. Un plugin qu'aucune entrée de journal ne mentionne depuis
son installation est un candidat au retrait ; un plugin utilisé une fois pour un
geste qui ne reviendra pas en est un aussi. Les deux serveurs LSP (`gopls`,
`typescript`) ne se retirent pas : ils portent la relecture du code des apps.

- [ ] **Étape 3 : décider — et c'est une décision humaine**

Soumettre la liste des candidats. **Ne rien retirer sans accord** : le coût d'un
plugin est visible et chiffré, sa valeur ne l'est pas.

- [ ] **Étape 4 : retirer, et garder les trois déclarations d'accord**

Retirer les entrées de `enabledPlugins` dans `.claude/settings.json`, la même
liste dans `.claude/cloud-setup.sh`, et la ligne correspondante de
`memory/outillage.md`.

```bash
./init.sh --check
```

Attendu : `settings.json : N plugin(s) attendu(s), tous declares` et
`cloud-setup.sh aligne sur N plugins et 2 LSP`, avec le **nouveau** N. Si l'un
des deux garde l'ancien compte, la session cloud suivante réinstallera ce qui
vient d'être retiré, sans que rien ne le dise.

- [ ] **Étape 5 : mesurer après, dans une session NEUVE**

L'amorce est écrite une fois par session : la session courante garde la sienne
quoi qu'on édite. La mesure ne vaut donc **que** dans une session ouverte après
le commit.

```bash
./scripts/cout.sh --dry-run | grep -A2 "Démarrage"
```

**Critère :** une baisse d'au moins **15 %** de l'amorce (55 815 → 47 000 ou
moins). En deçà, le retrait n'a pas payé son inconvénient : remettre les plugins
et écrire dans le journal que le levier a été mesuré et jugé faible. Un levier
mesuré et faux vaut mieux qu'un levier supposé vrai.

- [ ] **Étape 6 : committer**

```bash
./scripts/pret.sh && ./init.sh --check
git add .claude/settings.json .claude/cloud-setup.sh memory/outillage.md journal/
git commit   # message : l'amorce avant, apres, et ce qui a ete retire
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Tâche 6 — L'essai mesuré de l'`artisan`

**Pourquoi** — zéro tour de sous-agent sur 1 454. C'est le seul levier du bilan
qui n'a **jamais** été essayé, et le seul dont le gain soit inconnu plutôt
qu'estimé. Une mesure vaut mieux qu'un raisonnement : `cout.sh` sait déjà
compter les tours de sous-agent (`ECHANGES <total> <dont sous-agents>`).

**Fichiers**
- Modifier : `docs/2026-08-07-bilan-jetons-et-journal.md` (la section « Les
  quatre leviers », levier 4)
- Modifier : l'entrée de journal de la branche

- [ ] **Étape 1 : choisir le chantier, et le figer**

Le chantier doit être **entier, borné et testable seul**. Les tâches 1 et 2 de
ce plan conviennent exactement : elles ne sortent pas de `apps/marcq-handball/`,
ce qui est la limite que l'`artisan` s'impose déjà. **C'est pourquoi cette tâche
se lit en premier** : menées à la main, les tâches 1 et 2 ne sont plus
mesurables. Si elles sont déjà faites, prendre le chantier d'app suivant — la
semaine 3 du programme, quand le coach livrera sa page 3 sur 3.

- [ ] **Étape 2 : mesurer le point de départ**

```bash
./scripts/cout.sh --dry-run
```

Noter les trois nombres : total en jetons, nombre de tours, contexte du dernier
tour (ligne « Croissance »).

- [ ] **Étape 3 : mener le chantier par l'`artisan`**

Un seul appel, avec la tâche entière : le fichier à créer, les tests à faire
passer, la commande qui les lance. L'agent ne committe pas — c'est le contrat de
l'`artisan` — donc la session principale relit, lance `./scripts/pret.sh` et
committe.

- [ ] **Étape 4 : mesurer l'arrivée, et écrire le résultat**

```bash
./scripts/cout.sh --dry-run
```

**Critère de réussite, à écrire tel quel dans le journal :**

| Mesure | Attendu si le levier marche |
|---|---|
| tours de sous-agent | **> 0** — sinon l'agent n'a pas été utilisé, la mesure est nulle |
| contexte du dernier tour | croît de **moins de 30 000 jetons** sur la durée du chantier |
| coût total du chantier | comparable ou inférieur à celui d'un chantier voisin mené en direct |

Le troisième point n'est pas une égalité stricte : deux chantiers ne sont jamais
identiques. Ce qu'on cherche est l'ordre de grandeur, et surtout la **pente du
contexte principal** — c'est elle que l'agent est censé aplatir.

- [ ] **Étape 5 : reporter dans le bilan**

Remplacer, dans `docs/2026-08-07-bilan-jetons-et-journal.md`, le levier 4 « Les
sous-agents — jamais utilisés » par ce qui a été mesuré, en gardant le chiffre
d'origine (0 sur 1 454) comme point de départ daté. Si le levier ne marche pas,
l'écrire aussi : un levier mesuré et faux vaut mieux qu'un levier supposé vrai.

- [ ] **Étape 6 : committer**

```bash
./scripts/pret.sh
git add docs/2026-08-07-bilan-jetons-et-journal.md journal/
git commit   # message : ce que l'artisan a coute, et ce qu'il a evite
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

---

## Ce que ce plan ne fait pas, et pourquoi

- **Il n'outille pas la famille A** — « un PRP est relu comme de la prose,
  jamais exécuté », 7 occurrences, la plus coûteuse des quatre. Exécuter
  mécaniquement les blocs de code d'un document demanderait une convention
  d'écriture des PRP qui n'existe pas, et l'inventer pour un projet qui n'en
  écrira plus serait du travail à jeter. La parade reste un geste :
  appliquer les blocs et lancer les tests **avant** de figer le document. Elle
  est déjà écrite dans `apps/marcq-handball/prp/README.md`.
- **Il n'étend pas l'avertissement de `pret.sh` au `README.md` de l'app.**
  L'idée paraissait bonne et la vérification l'a démentie : le jour de la dérive,
  le `README.md` **a bougé** dans le commit fautif — incomplètement. Une
  heuristique qui regarde si un fichier a été touché ne peut pas voir ça. C'est
  la tâche 1 qui la voit, parce qu'elle lit ce que le document **dit**.
- **Il ne tranche pas le plafond mémoire** (1216 Mo engagés contre 1024
  déclarés). Aucun test ne remplace un arbitrage humain : relever le plafond ou
  désactiver une app se décide devant la RAM du serveur.

---

## Ce qui a été exécuté, le 7 août

| Tâche | État | Preuve |
|---|---|---|
| 1 — les chiffres des documents | **faite** | `apps/marcq-handball/tests/documents.test.js`, 4 tests ; 51 écrit à la place de 53 fait échouer ; 295 tests verts |
| 2 — les garde-fous de source | **faite** | `tests/source.js` + 4 cas ; cinq emplacements convertis sur les sept prévus ; un emploi réel échoue, un commentaire ne fait plus rien ; 299 tests verts |
| 3 — `scripts/jetons.sh` | **faite** | `test-jetons.sh`, 9 cas ; `test-cout.sh` inchangé, 11 verts ; `test-init.sh` gagne `avertit`, 23 verts |
| 4 — tours courts et alerte | **faite** | `test-cout.sh`, 14 cas ; seuil abaissé à 50 000 → le cas du silence échoue, remis → vert |
| 5 — l'amorce | **analysée, geste abandonné** | le retrait des cinq plugins sans trace vaut ~2 % de l'amorce, pas 15 % : anomalie 10 du journal |
| 6 — l'`artisan` mesuré | **reportée** | les tâches 1 et 2 ont été menées à la main dans la session, il n'y a plus rien à mesurer dessus ; le protocole vaut pour le chantier suivant |

**Trois défauts trouvés en exécutant, et aucun n'était dans le plan** : deux
garde-fous lisent les commentaires exprès (anomalie 6), une phrase du journal qui
cite un marqueur ouvrait le bloc qu'elle décrit (anomalie 7), et le comptage des
anomalies du bilan se faisait par un motif plus court que celui de `--check`, donc
faux (anomalie 8). Les trois sont de la même famille B — un motif qui attrape
autre chose que sa cible —, celle que ce plan prétendait traiter.
