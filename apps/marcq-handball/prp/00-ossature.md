# Ossature — marcq-handball

> Contrat technique partagé par les onze PRP. Tout PRP le lit avant de
> commencer, et n'invente aucun nom qui n'y figure pas.
>
> **Source produit :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`
> — le PRD tranche le *quoi* et le *pourquoi*. Ce fichier tranche le *où* et
> le *comment nommer*. En cas de désaccord, le PRD gagne et ce fichier est
> corrigé.

---

## 1. Identité de l'application

| | |
|---|---|
| Nom (donc répertoire, sous-domaine, conteneur, routeur) | `marcq-handball` |
| URL | `https://marcq-handball.apps.billbob.ovh` |
| Palier d'exposition | `public` — aucune authentification |
| Image | `ghcr.io/billbob-space/hello-world/marcq-handball:main` |
| Branches | `marcq-handball/<sujet>` |

`apps/marcq-handball/app.yml`, dans son état final :

```yaml
enabled: true
port: 8080
memory: 128m
health_path: /healthz
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: public
stack: typescript
ui: true
```

**`stack: typescript` et non `go`**, alors que le serveur est en Go. `stack`
n'a aucun effet sur le déploiement : il choisit le serveur de langage. La
quasi-totalité du code de cette app est du JavaScript de navigateur ; `gopls`
arrive déjà par `cadran` et `hello-world`, et l'outillage est l'**union** des
`stack` du dépôt. Déclarer `typescript` ici donne les deux LSP ; déclarer `go`
n'en donnerait qu'un.

**Conséquence à ne pas oublier :** `typescript` est un langage nouveau dans la
fabrique. Après le premier `./init.sh`, `.claude/cloud-setup.sh` change et doit
être **recollé** dans le champ *Setup script* de l'environnement — cette
configuration vit hors du dépôt, `init.sh` ne peut pas la mettre à jour.
`./init.sh --check` signale l'écart.

`ui: true` ajoute `frontend-design`, `playwright` et `impeccable` à
l'outillage du dépôt.

---

## 2. Le partage serveur / navigateur

C'est la décision qui structure tous les PRP.

**Le serveur ne connaît aucun utilisateur.** Au lot 1 il sert des fichiers
statiques et une sonde de santé, et il n'a aucun état. Il ne lit **jamais**
`X-Forwarded-User` : en palier `public` Traefik ne le pose ni ne l'écrase, il
est donc forgeable — et `init.sh:1444-1452` refuse le dépôt si la chaîne
`x-forwarded-user` apparaît dans un fichier suivi de `apps/marcq-handball/`
hors `.md`.

**Tout le domaine et tout l'état vivent dans le navigateur**, en modules ES
natifs, sans chaîne de construction : pas de bundler, pas de `node_modules`
dans l'image, pas de transpilation. Le navigateur charge les modules tels
qu'ils sont écrits, `node --test` les teste tels qu'ils sont écrits.

**Le lot 2 ajoute au serveur un magasin de classement**, et lui seul.  Le
serveur y relit le **même `programme.json`** pour recalculer un rang avec sa
propre horloge. C'est le seul endroit où le domaine existe en deux langages, et
c'est délibéré : un rang calculé par le client serait un rang déclaré par le
client.

### Ce qui découle de « aucune chaîne de construction »

- Aucune dépendance npm, ni au développement ni à l'exécution. Pas de
  `package-lock.json`, pas de `node_modules`.
- Aucun asset distant : pas de police Google, pas de CDN, pas de bibliothèque
  d'animation. La page est publique, tout ce qu'elle charge est en même origine.
- Les tests tournent avec le `node --test` de la bibliothèque standard. Le
  runner de la CI fournit Node (`.github/workflows/`, job `test` : *« Le runner
  fournit Go, Node, Python et Java »*).

---

## 3. Arborescence

```
apps/marcq-handball/
  app.yml            déclaré, jamais réécrit par init.sh
  Dockerfile         multi-étapes, USER non root, image < 200 Mo
  .dockerignore      généré par --add, complété : exclure tests/
  test.sh            exécutable — le seul point d'entrée que la CI connaît
  README.md          usage, variables d'environnement attendues (noms seuls)
  PRODUCT.md         le PRD de l'app, dérivé du spec produit
  go.mod             module github.com/billbob-space/hello-world/apps/marcq-handball
  main.go            serveur : statique + /healthz. Aucun état.
  main_test.go
  web/               EMBARQUÉ dans le binaire par go:embed
    index.html       coque unique, <script type="module" src="/app.js">
    app.js           amorçage, routage d'écran, câblage des vues
    domaine.js       PUR : totaux, calendrier, états de séance, progression
    etat.js          localStorage : lecture, écriture, migration de schéma
    vue-jour.js      écran du jour
    vue-seance.js    écran de séance
    vue-perso.js     écran perso
    vue-reglages.js  réglages
    style.css
    programme.json   LE PROGRAMME — donnée éditable, jamais du code
    sw.js            service worker, cache-first, nom de cache versionné
  tests/             HORS de l'image : jamais embarqué, exclu du contexte
    domaine.test.js
    etat.test.js
  prp/               ces documents
```

**`web/` est embarqué, `tests/` ne l'est pas.** `//go:embed web` n'emporte que
`web/`. Ajouter `tests/` à `.dockerignore` évite en plus qu'une édition de test
invalide le cache de couches.

Les modules ES s'importent par chemin relatif : `import { totaux } from
'./domaine.js'` depuis `web/`, `import { totaux } from '../web/domaine.js'`
depuis `tests/`. Le navigateur et Node lisent le même fichier.

---

## 4. `programme.json` — le contrat de données

Le PRD §8 l'exige : *« Le programme vit dans un fichier de données éditable,
séparé du code, livré avec l'application. Le modifier ne doit pas demander de
toucher au code. »* Rien dans le code ne recopie une valeur qui s'y trouve.

```json
{
  "titre": "Programme d'été U15 — Marcq Handball",
  "debut": "2026-08-03",
  "fin": "2026-08-21",
  "seances": [
    {
      "date": "2026-08-03",
      "semaine": 1,
      "titre": "Endurance + Renforcement",
      "blocs": [
        {
          "type": "course",
          "tours": 1,
          "exercices": [
            {
              "id": "s1-c1",
              "libelle": "30 minutes de footing à allure confortable",
              "mesure": { "unite": "min_course", "valeur": 30 }
            }
          ]
        },
        {
          "type": "renforcement",
          "tours": 2,
          "repos": "1 min 30 entre les tours",
          "exercices": [
            {
              "id": "s1-r1",
              "libelle": "15 pompes",
              "mesure": { "unite": "pompes", "valeur": 15 }
            }
          ]
        }
      ]
    }
  ]
}
```

### Les règles que ce format porte

**Une ligne d'exercice = une case à cocher, quel que soit le nombre de tours.**
Les tours multiplient le *volume*, jamais le nombre de cases. C'est ce qui donne
les **53 cases** du PRD §8 : 8 + 8 + 6 + 7 + 7 + 9 + 8 sur les sept séances.

**`id` est stable et n'est jamais réattribué.** Format `s<n>-<c|r><n>` : séance,
puis `c` pour course / `r` pour renforcement, puis rang dans le bloc. C'est la
clé de la progression en `localStorage` et, au lot 2, la clé envoyée au serveur.
Renuméroter un `id` efface la progression de tout le monde.

**`mesure` est ce qui rend le volume calculable.** `unite` ∈ `{ pompes, squats,
burpees, abdos, gainage_s, min_course, fentes, autre }`. `valeur` est le nombre
pour **un** tour. Un exercice sans volume mesurable porte `"unite": "autre"`,
et n'entre dans aucun total.

**Ce qui n'est pas du gainage n'est pas compté comme tel.** « 45 s chaise contre
un mur » porte `unite: autre`, pas `gainage_s` : c'est ce qui fait tomber le
total sur les ~24 min du PRD plutôt que sur ~29.

**« 30 à 40 minutes d'un autre sport »** porte `unite: min_course, valeur: 35`
— la valeur médiane. C'est ce qui fait tomber le total course sur les ~4 h du
PRD.

**Les sprints sans durée** (`6 × 100 m`, `10 min de 30-30 m`) portent la durée
quand le coach l'a écrite, `autre` quand il ne l'a pas écrite. On ne convertit
jamais une distance en durée.

### Les six totaux qui verrouillent la saisie

Recalculés depuis le fichier, tours compris, ils doivent valoir exactement :

| Unité | Total prescrit |
|---|---|
| `pompes` | 226 |
| `squats` (toutes variantes) | 345 |
| `burpees` | 105 |
| `abdos` (abdos + crunchs) | 210 |
| `gainage_s` | 1425 s (≈ 24 min) |
| `min_course` | 235 min (≈ 3 h 55) |
| **cases cochables** | **53** |

Ces sept assertions sont le meilleur test de l'application : elles attrapent
toute faute de saisie dans les 53 exercices. Elles vivent dans
`tests/domaine.test.js` et le PRD §8 en est la contre-vérification.

**Le code ne recopie jamais ces nombres.** Ils sont *calculés*, et le test les
compare. Modifier `programme.json` change les totaux affichés sans toucher au
code — c'est exactement l'exigence du §8.

---

## 5. `domaine.js` — l'interface pure

Aucun accès au `localStorage`, aucun accès au DOM, aucune horloge implicite :
« aujourd'hui » est toujours un **paramètre**. C'est ce qui rend le module
testable et le rend réutilisable par la vue coach.

```js
// Charge et valide le programme. Lève si un id est dupliqué ou une unité inconnue.
export function chargerProgramme(json)            // -> Programme

// Totaux prescrits sur tout le programme, tours compris.
export function totauxPrescrits(prog)             // -> { pompes: 226, ... , cases: 53 }

// Totaux réellement accomplis, d'après les cases cochées.
export function totauxAccomplis(prog, faits)      // -> même forme

// État d'une séance à une date donnée.
export function etatSeance(prog, dateISO, aujourdhui, faits)
//   -> { statut, cochable, total, coches }
//   statut  ∈ { 'a-venir', 'aujourd-hui', 'faite', 'partielle', 'manquee' }
//   cochable = (dateISO <= aujourdhui)      // le passé se corrige, l'avenir ne se coche pas

// La séance à montrer en ouvrant l'app.
export function seanceDuJour(prog, aujourdhui)
//   -> { seance, cas } avec cas ∈ { 'aujourd-hui', 'repos', 'terminee' }
//   'repos'    : pas de séance ce jour, on annonce la prochaine
//   'terminee' : aujourdhui > prog.fin  → bascule sur le bilan (PRP 11)

// Le calendrier des 19 jours, du 3 au 21 août : séance ou repos, jamais un trou.
export function calendrier(prog, aujourdhui, faits)  // -> [{ date, seance|null, statut }]

// La part servant au rang : accomplis / programmés À CE JOUR, pas sur le total.
export function progression(prog, aujourdhui, faits)
//   -> { cochees, programmees, part }        part ∈ [0,1], 0 si programmees === 0
```

`faits` est toujours l'objet décrit en §6 : `{ [idExercice]: horodatageISO }`.

### Les dates, précisément

Toutes les dates du domaine sont des **jours calendaires** au format
`YYYY-MM-DD`, comparés comme des chaînes — l'ordre lexicographique de l'ISO
8601 est l'ordre chronologique. Aucun `Date` n'entre dans `domaine.js`.

Le jour courant est calculé **une seule fois**, dans `app.js`, dans le fuseau
`Europe/Paris` :

```js
export const aujourdhui = () =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
// 'fr-CA' rend YYYY-MM-DD. Le fuseau est figé : un enfant en vacances à
// l'étranger doit voir la séance du jour de son club, pas celle de son fuseau.
```

**L'horloge du téléphone décide de l'affichage, celle du serveur décide du
rang.** Avancer l'horloge de son téléphone déverrouille des séances futures en
local ; au lot 2 le serveur recalcule le dénominateur avec sa propre date et le
rang ne bouge pas. Le PRD §14 assume la triche locale ; il ne l'assume pas au
classement.

---

## 6. `etat.js` — le contrat `localStorage`

Toutes les clés sont préfixées `marcq.v1.`. Le numéro de version est dans la
clé, pas dans la valeur : changer de schéma se fait en écrivant `v2` et en
migrant depuis `v1`, sans jamais lire une valeur au mauvais format.

| Clé | Valeur | Écrit par | Lot |
|---|---|---|---|
| `marcq.v1.prenom` | `"Lucas"` | PRP 3 | 1 |
| `marcq.v1.faits` | `{ "s1-r1": "2026-08-03T18:22:11.000Z", … }` | PRP 4 | 1 |
| `marcq.v1.ressenti` | `{ "2026-08-03": "correct" }` | PRP 10 | 2 |
| `marcq.v1.classement` | `{ pseudo, code, dernierEnvoi, dernierRangConnu }` | PRP 8 | 2 |

**`faits` associe un horodatage, pas un booléen.** Trois raisons, et aucune
n'est optionnelle :

1. Le PRD §9 tranche les égalités au classement par *« le premier arrivé à ce
   score »* — il faut une date.
2. Décocher supprime la clé ; un booléen `false` traînerait indéfiniment.
3. L'horodatage rend le débogage possible sans instrumenter quoi que ce soit.

```js
export function lirePrenom()                 // -> string | null
export function ecrirePrenom(p)              // trim, 1..24 caractères
export function lireFaits()                  // -> { [id]: isoString }, {} si vide ou illisible
export function cocher(id, quand = new Date().toISOString())
export function decocher(id)
export function toutEffacer()                // « changer d'enfant » : efface TOUTES les clés marcq.*
```

**Un `localStorage` illisible ou refusé ne casse jamais l'app.** Navigation
privée, quota plein, stockage bloqué : `lireFaits()` rend `{}`, les écritures
échouent en silence après une trace sur la console, l'app reste utilisable pour
la séance en cours. Une app qui jette une exception au premier tap est pire
qu'une app sans mémoire.

---

## 7. Les routes HTTP

**Lot 1** — le serveur n'a aucun état :

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /app.js`, `/domaine.js`, `/etat.js`, `/vue-*.js`, `/style.css` | le fichier de `web/`, type MIME correct |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache` — **servi à la racine**, sans quoi sa portée ne couvre pas `/` |
| `GET /healthz` | `200 ok`, `text/plain` |
| tout le reste | `404` |

`web/` est servi **à la racine**, pas sous `/web/` : les chemins du service
worker et ceux des imports ES doivent coïncider.

**Lot 2** — ajoutées par le PRP 7, contrat détaillé dans ce PRP :
`GET /api/classement`, `POST /api/classement`, `GET /api/coach`.

Toutes les réponses portent `X-App-Version`, comme dans `hello-world` : c'est ce
qui rend un déploiement vérifiable sans ouvrir la page.

---

## 8. Le service worker

Le PRD §11 exige que *« l'app reste utilisable réseau coupé »*. Sans service
worker, une app ouverte fonctionne hors ligne mais ne se **recharge** pas — or
un ado ferme son onglet.

Règles, toutes contraignantes :

- **Cache-first sur la coque** (`/`, les modules, `style.css`,
  `programme.json`), réseau pour le reste.
- **Nom de cache versionné** : `marcq-${VERSION}`, `VERSION` étant injecté au
  moment du service de `sw.js` depuis `main.version` du binaire. À l'activation,
  tout cache dont le nom diffère est supprimé. Sans cela, `pull_policy: always`
  déploie une image neuve que le navigateur n'affiche jamais.
- `skipWaiting()` + `clients.claim()` : la version déployée prend la main au
  rechargement suivant, pas deux rechargements plus tard.
- **Aucun `manifest.json`, aucune invite d'installation, aucun bandeau
  « ajouter à l'écran d'accueil ».** Le PRD §11 l'interdit : *« Un lien qui
  s'ouvre. »* Le service worker sert l'hors-ligne, pas l'installation.

---

## 9. Ce que chaque PRP doit respecter sans qu'on le lui répète

Ces contraintes viennent du contrat de la fabrique (`CLAUDE.md`) et du PRD §11.
Elles s'appliquent à **tous** les PRP.

- **Français** pour l'interface, les commentaires, la documentation, les
  messages de commit et les noms de fonctions.
- **Aucun secret** dans le dépôt ni dans l'image. Les noms des variables
  attendues vont dans le `README`, jamais les valeurs.
- **Aucune section `ports:`**, aucun `LABEL traefik.*` dans le `Dockerfile`.
- **`USER` non root**, construction multi-étapes, image finale < 200 Mo.
- **Les journaux sur la sortie standard**, et ils n'enregistrent aucune
  identité — l'app est publique, ses journaux ne doivent rien apprendre.
- **Démarrage sans intervention** : ni migration, ni fichier à créer, ni
  question interactive.
- **`compose.yaml`, `.github/`, `.claude/`, `go.work` ne s'éditent jamais à la
  main.** On change `app.yml` et on relance `./init.sh`.
- **`./init.sh --check` doit être vert avant chaque commit**, et
  `./init.sh --pret` avant de committer.
- **Mobile d'abord** : zones de tap ≥ 44 px, contraste lisible en plein soleil,
  aucune interaction dépendant du survol.
- **`prefers-reduced-motion` est respecté** : tout reste utilisable sans un
  seul mouvement.

---

## 10. La séquence des PRP et ce qui bloque quoi

```
01 socle ──┬─> 03 entree ──> 04 seance ──┬─> 05 perso ──> 06 recompenses
           │                              │
02 programme┘                             └─> 10 ressenti+coach
                                          │
07 classement-api ──> 08 rejoindre ──> 09 equipe
                                          │
                                       11 bilan
```

- **01 et 02 sont parallélisables** : l'un est du déploiement, l'autre de la
  donnée pure. Ils se rejoignent au PRP 3.
- **04 est le goulot du lot 1** : 05, 06 et 10 en dépendent tous.
- **07 porte un point d'arrêt d'infrastructure** (volume persistant, PRD
  §12.1). Il ne démarre pas avant que ce point soit tranché côté serveur.
- **11 dépend de 02 seul** (la date de fin) mais se livre en dernier : il n'a
  d'effet qu'après le 21 août.

### Ce qui reste ouvert, et pour qui

| Point | PRD | Qui tranche | Bloque |
|---|---|---|---|
| Volume persistant pour les scores | §12.1 | exploitation du serveur | PRP 07 |
| Page 3 sur 3 de la note du coach | §12.3 | le coach | PRP 02, avant le 17 août |
| Le coach regardera-t-il son écran ? | §15.3 | le coach | PRP 10 |

**Le blocage §12.2 du PRD n'existe pas.** Vérification faite sur
`init.sh:1444-1452` : `--check` ne refuse pas « l'état par utilisateur en
`exposure: public` ». Il refuse exactement une chose — qu'un fichier suivi de
`apps/marcq-handball/`, hors `.md`, contienne la chaîne `x-forwarded-user`. Le
classement, réduit à des pseudonymes, des scores et un code à 4 chiffres, ne lit
jamais cet en-tête. Il passera `--check` sans qu'aucune règle soit desserrée.
