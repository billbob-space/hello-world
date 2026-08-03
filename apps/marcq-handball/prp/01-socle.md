# PRP 01 — Le socle déployable

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 1 |
| **Branche** | `marcq-handball/socle` puis `marcq-handball/activation` — deux branches, deux PR, voir Tâches 6 et 7 |
| **Dépend de** | rien |
| **Débloque** | 02 (programme), 03 (entrée) — et par eux tous les autres |
| **Sections du PRD** | §6 préalable non numéroté du lot 1, §11 contraintes, §12 dépendances et prérequis de mise en ligne |

## Objectif

`https://marcq-handball.apps.billbob.ovh` répond 200 sans authentification, en
servant une coque honnête et un service worker versionné, avant qu'une seule
ligne de produit n'existe.

## Ce qui est vérifiable à la fin

- `./init.sh --check` est vert, et `./init.sh --list` montre `marcq-handball`
  en `public` / `typescript` / `ui` / active.
- `./apps/marcq-handball/test.sh` passe **9 tests Go et 5 tests Node**, sans
  qu'aucune dépendance n'ait été installée.
- `curl -s -o /dev/null -w '%{http_code}' https://marcq-handball.apps.billbob.ovh/healthz`
  rend `200`, là où la même commande sur `cadran.apps.billbob.ovh` rend `307` —
  c'est la preuve que le middleware `public` est bien celui qui est posé, et
  que le routeur de l'app a pris le pas sur le catch-all qui répond
  aujourd'hui à cette adresse.
- L'en-tête `X-App-Version` de cette réponse vaut le SHA du commit fusionné.
- `curl -s https://marcq-handball.apps.billbob.ovh/sw.js | grep VERSION` montre
  ce même SHA, et jamais la chaîne `__VERSION__`.
- L'image `ghcr.io/billbob-space/hello-world/marcq-handball:main` existe sur
  GHCR et pèse ~14 Mo, loin des 200 Mo du plafond.

## Périmètre

**Dedans :** l'échafaudage de l'app dans la fabrique et son `app.yml` conforme
à l'ossature §1 ; `main.go` + `main_test.go` (statique à la racine, `/healthz`,
`/sw.js` versionné, `/programme.json` câblé, 404 ailleurs, `withVersion` et
`logging`) ; `web/index.html` (page d'attente), `web/style.css` (les jetons),
`web/sw.js` (ossature §8) ; `package.json`, `tests/coque.test.js`, `test.sh` ;
`Dockerfile` et `.dockerignore` ; `README.md` et `PRODUCT.md` ; **la séquence en
deux commits qui met l'app en ligne**.

**Dehors, et pourquoi :**

- Toute donnée de programme — PRP 02 dépose `web/programme.json`, sa route est
  déjà câblée ici pour que les deux PRP avancent en parallèle sans se disputer
  `main.go` (ossature §10 : « 01 et 02 sont parallélisables »).
- Tout écran produit — PRP 03 à 06. La page d'attente **dit qu'elle est une page
  d'attente** : elle n'imite aucun écran, parce qu'une fausse séance donnerait
  envie de taper dessus et que le premier tap serait un échec.
- `domaine.js`, `etat.js`, les `vue-*.js` — aucun n'est créé ici. Le serveur
  n'aura rien à câbler quand ils arriveront : tout fichier déposé dans `web/`
  est servi à la racine par le serveur de fichiers.
- Le classement et son magasin — PRP 07, bloqué par le PRD §12.1.

## Interfaces

**Consomme** — de l'ossature, tel quel :

- `apps/marcq-handball/app.yml` dans son état final (§1) ; nom d'app, URL,
  `exposure: public`, `stack: typescript`, `ui: true`.
- L'arborescence §3, y compris `web/` embarqué et `tests/` hors de l'image.
- Les routes du lot 1 (§7) et les cinq règles du service worker (§8).
- La règle §2 : aucune chaîne de construction, aucune dépendance npm, aucun
  asset distant.

**Produit** — ce que les PRP aval utilisent :

```go
// apps/marcq-handball/main.go
func routes(web fs.FS, sw []byte) http.Handler          // le seul point d'ajout de route (PRP 07)
func chargerServiceWorker(web fs.FS) ([]byte, error)
func fichier(web fs.FS, nom, typeMime, cache string) http.HandlerFunc
func withVersion(next http.Handler) http.Handler
func logging(next http.Handler) http.Handler
func env(cle, defaut string) string
var version string                                       // -ldflags -X main.version
const jetonVersion = "__VERSION__"
```

```js
// apps/marcq-handball/web/sw.js
const COQUE = [ '/', '/style.css' ];   // tout PRP qui ajoute un fichier de coque ajoute son chemin ICI
```

- `apps/marcq-handball/package.json` = `{"type": "module"}` — c'est lui qui fait
  que tout `.js` de l'app est un module ES **pour Node aussi**, donc que
  `tests/domaine.test.js` (PRP 02) pourra écrire
  `import { totaux } from '../web/domaine.js'`.
- `apps/marcq-handball/tests/coque.test.js` — les invariants de la coque qui ne
  demandent pas de navigateur ; PRP 02 y ajoute `domaine.test.js` à côté.
- `apps/marcq-handball/test.sh` lance, dans cet ordre : `go vet ./...`,
  `go test ./...`, `node --test tests/*.test.js`.
- `GET /programme.json` est **déjà câblé** avec `application/json; charset=utf-8`
  et `Cache-Control: no-cache`. PRP 02 dépose le fichier et remplace
  `TestProgrammeJSONPasEncoreLivre` par l'assertion 200.
- Jetons CSS de `web/style.css` pour la page d'attente :
  `--papier --carte --encre --encre-douce --trait --signal --signal-lisible
  --fait --tap --pas --marge --rayon --texte --chiffres`, plus la classe
  utilitaire `.tap` (hauteur et largeur minimales de 44 px, PRD §11).
  **Ils ne survivent pas au PRP 03**, qui remplace la page d'attente par les
  écrans et déclare sa propre famille `--marcq-*` : ces jetons restent dans la
  feuille mais cessent d'avoir un consommateur (voir PRP 03, « Le style des
  écrans »). N'écris donc rien en aval qui les lise.
- Le bloc `prefers-reduced-motion` global (PRD §10) est posé ici pour que la
  règle existe dès la première ligne de CSS. **Le PRP 06 le remplace** par la
  version définitive, dont il justifie les valeurs — il est le PRP des
  animations, c'est lui qui possède cette règle, et les PRP 09, 10 et 11 la lui
  attribuent. Il doit la **remplacer** et non en ajouter une seconde : deux blocs
  `@media (prefers-reduced-motion: reduce)` dans la même feuille font échouer son
  propre test, qui extrait le premier.

**Noms introduits ici et absents de `00-ossature.md`**, donc définis par ce
document : `apps/marcq-handball/package.json`, `apps/marcq-handball/tests/coque.test.js` ;
les identifiants Go `routes`, `chargerServiceWorker`, `fichier`, `handleSante`,
`handleServiceWorker`, `withVersion`, `logging`, `statusRecorder`, `env`,
`coque`, `jetonVersion` ; les identifiants de `sw.js` `VERSION`, `NOM_CACHE`,
`COQUE`, `cacheDAbord` ; les jetons CSS et la classe `.tap` ci-dessus ; les
classes HTML de la page d'attente `.attente .sur-titre .periode .dit .note`.

## Fichiers

- Créer : `apps/marcq-handball/{go.mod,main.go,main_test.go,Dockerfile,package.json}`,
  `apps/marcq-handball/web/{index.html,style.css,sw.js}`,
  `apps/marcq-handball/tests/coque.test.js`
- Générés puis modifiés : `apps/marcq-handball/{app.yml,.dockerignore,test.sh,README.md,PRODUCT.md}`
- Régénérés par `./init.sh`, jamais à la main : `compose.yaml`, `go.work`,
  `.github/workflows/build.yml`, `.claude/*`, `.gitignore`
- Tester : `apps/marcq-handball/main_test.go`, `apps/marcq-handball/tests/coque.test.js`,
  `./init.sh --check`

## Convention d'écriture — posée ici, portée par l'ossature §9

**Les accents vont dans ce que l'enfant lit, pas dans le code.** Le texte de
`index.html` et de tout écran à venir est du français accentué — « Programme
d'été » sans accent est une faute qui s'affiche. Les commentaires, les noms de
fonctions et de variables restent en ASCII, comme dans `cadran` et
`hello-world` : c'est ce qui garde les identifiants Go et les chemins tapables
au clavier sans réflexion.

---

### Tâche 1 — L'app entre dans la fabrique, désactivée

**Fichiers :** Créer `apps/marcq-handball/{app.yml,.dockerignore,test.sh,README.md,PRODUCT.md}` (par `init.sh`) · Modifier `compose.yaml`, `.github/workflows/build.yml`, `.claude/*`, `.gitignore` (régénérés) · Tester `./init.sh --check`

- [ ] **Étape 1 — écrire le test qui échoue**

Le test de cette tâche est le contrat de la fabrique lui-même : la fabrique
doit connaître l'application.

```bash
./init.sh --list | grep marcq-handball
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `./init.sh --list | grep marcq-handball`
Attendu : ÉCHEC — aucune ligne, sortie 1. `./init.sh --check` affiche par
ailleurs `attn  apps/marcq-handball : pas d'app.yml, ignore` : le répertoire
existe (il porte les PRP) mais n'est pas une application.

- [ ] **Étape 3 — l'implémentation minimale**

Ouvrir la branche **sans `./init.sh --branche`** :

```bash
git fetch origin main
git switch -c marcq-handball/socle origin/main
```

`./init.sh --branche marcq-handball/socle` **échouerait ici** — il valide le
préfixe contre les applications découvertes, et une application se découvre par
la présence de son `app.yml`, qui n'existe pas encore. À partir du PRP 02, la
commande de la fabrique fonctionne normalement.

Échafauder, avec les valeurs de l'ossature §1. `--force` est **obligatoire** :
`apps/marcq-handball/` existe déjà puisqu'il contient `prp/`, et `--add` refuse
un répertoire existant. `--force` ne touche qu'aux fichiers d'échafaudage,
jamais à `prp/` — mais il les réécrit, donc cette commande se lance **une seule
fois, et en premier**.

```bash
./init.sh --add marcq-handball --force \
          --port 8080 --memory 128m \
          --health /healthz \
          --health-cmd 'wget --spider -q http://localhost:8080/healthz' \
          --exposure public --stack typescript --ui
```

`enabled` reste à `false` : la stack est unique, et référencer une image qui
n'existe pas encore ferait échouer le `docker compose up` de **toutes** les
applications. C'est la Tâche 7 qui l'active, une fois l'image publiée.

`stack: typescript` alors que le serveur est en Go : `stack` ne choisit que le
serveur de langage, `gopls` arrive déjà par `cadran`, et l'outillage est
l'union des `stack` du dépôt (ossature §1).

Vérifier que le fichier obtenu est bien celui de l'ossature §1 :

```bash
cat apps/marcq-handball/app.yml
```

Attendu, aux commentaires près : `enabled: false`, `port: 8080`,
`memory: 128m`, `health_path: /healthz`,
`health_cmd: wget --spider -q http://localhost:8080/healthz`,
`exposure: public`, `stack: typescript`, `ui: true`.

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `./init.sh --list | grep marcq-handball`  ·  Attendu : SUCCÈS, une
ligne `marcq-handball 8080 128m public typescript true desactivee`.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`. Deux `attn`
sont normaux et attendus : `pas encore de Dockerfile (app desactivee)`, et
l'avertissement du palier public.

- [ ] **Étape 5 — recoller le setup script de l'environnement**

`typescript` est une **stack nouvelle** dans la fabrique : `./init.sh` vient
d'ajouter `typescript-lsp` à `.claude/settings.json` et l'installation de
`typescript-language-server` à `.claude/cloud-setup.sh`. Cette configuration
vit **hors du dépôt**, dans le compte : aucun script d'ici ne peut la mettre à
jour, et sans ce geste le plugin LSP est déclaré mais son binaire est absent —
donc inerte.

```bash
cat .claude/cloud-setup.sh
```

Coller le contenu dans `claude.ai/code` → icône nuage → engrenage de
l'environnement → champ **Setup script**. Puis vérifier ce qui manque encore :

```bash
./.claude/check-plugins.sh
```

Attendu après que le setup script ait rejoué :
`Outillage : 13/13 plugins installes, 2/2 serveurs LSP presents.` — huit
plugins de socle, deux serveurs de langage (`gopls` et
`typescript-language-server`), et les trois plugins d'interface que `ui: true`
ajoute. Tant qu'il
annonce des manquants, le travail reste possible — l'outillage est un confort,
pas une dépendance — mais les diagnostics du compilateur JavaScript n'arrivent
pas.

- [ ] **Étape 6 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball .claude .github .gitignore compose.yaml
git commit -m "marcq-handball : l'app entre dans la fabrique, desactivee"
git push -u origin marcq-handball/socle
```

`compose.yaml` change bel et bien alors qu'aucun service n'est émis : le
générateur y écrit un bloc de commentaire nommant l'app désactivée et rappelant
pourquoi. `.github/workflows/build.yml` change aussi — le nom de l'app entre
dans la matrice de construction, activée ou non.

Le message de commit dit **pourquoi désactivée** : la stack est unique, une app
entre dans le compose après son image, jamais avant. Les `test.sh`, `README.md`
et `PRODUCT.md` d'échafaudage sont des gabarits ; ils sont remplacés aux Tâches
2, 3 et 6 de ce PRP.

---

### Tâche 2 — La coque que le navigateur charge

**Fichiers :** Créer `apps/marcq-handball/web/{index.html,style.css,sw.js}`, `apps/marcq-handball/package.json`, `apps/marcq-handball/tests/coque.test.js` · Modifier `apps/marcq-handball/test.sh` · Tester `apps/marcq-handball/tests/coque.test.js`

Rien de ce que teste cette tâche ne se voit à l'écran. Une entrée de cache qui
répond 404, une police chargée depuis un domaine tiers, une bannière
d'installation : trois fautes qui laissent une page parfaitement normale.

- [ ] **Étape 1 — écrire le test qui échoue**

`apps/marcq-handball/tests/coque.test.js` :

```js
// Ce que la coque doit verifier sans navigateur.
//
// La CI n'en a pas, et les fautes visees ici ne se voient de toute facon pas a
// l'ecran : elles suppriment l'hors-ligne, ou font charger une ressource
// distante sur une page publique. Les tests du domaine, eux, arrivent au PRP 02.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const lire = (nom) => readFileSync(join(web, nom), 'utf8');

// Le piege le plus couteux du service worker : une entree de COQUE qui repond
// 404 fait echouer cache.addAll, donc l'installation, et le service worker
// n'active jamais. Rien ne le signale — l'app marche, simplement plus hors
// ligne. La liste est lue dans le source parce que sw.js n'est pas un module :
// l'importer dans Node executerait self.addEventListener.
test('chaque chemin de la coque correspond a un fichier livre', () => {
  const bloc = lire('sw.js').match(/const COQUE = \[([^\]]*)\]/);
  assert.ok(bloc, 'sw.js ne declare plus de tableau COQUE');

  const chemins = [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(chemins.length > 0, 'COQUE vide : plus rien ne serait disponible hors ligne');

  for (const chemin of chemins) {
    const fichier = chemin === '/' ? 'index.html' : chemin.replace(/^\//, '');
    assert.doesNotThrow(
      () => lire(fichier),
      `${chemin} est dans COQUE mais web/${fichier} n'existe pas`,
    );
  }
});

test('le cache du service worker est nomme par la version du binaire', () => {
  const source = lire('sw.js');
  assert.match(
    source,
    /const VERSION = '__VERSION__';/,
    'le jeton remplace par le serveur a disparu : le demarrage echouerait',
  );
  assert.match(
    source,
    /marcq-\$\{VERSION\}/,
    'le nom du cache ne depend plus de la version : un deploiement resterait invisible',
  );
});

test('la coque ne charge rien hors de son origine', () => {
  for (const nom of ['index.html', 'style.css']) {
    const source = lire(nom);
    assert.doesNotMatch(
      source,
      /(?:src|href)\s*=\s*["']https?:\/\//i,
      `${nom} charge une ressource distante : la page est publique, tout doit etre en meme origine`,
    );
    assert.doesNotMatch(
      source,
      /@import\s+(?:url\()?\s*["']?https?:/i,
      `${nom} importe une feuille de style distante`,
    );
  }
});

test('aucune invite d installation', () => {
  const source = lire('index.html');
  assert.doesNotMatch(source, /rel\s*=\s*["']manifest["']/i, 'PRD §11 : un lien qui s ouvre, pas une installation');
  assert.doesNotMatch(source, /beforeinstallprompt/i, 'PRD §11 : aucune banniere « ajouter a l ecran d accueil »');
});

// La portee d'un service worker est celle du repertoire d'ou il est servi :
// enregistre depuis un sous-chemin, il ne prendrait pas en charge la racine.
test('le service worker est enregistre depuis la racine', () => {
  assert.match(lire('index.html'), /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
});
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && node --test tests/*.test.js`
Attendu : ÉCHEC — `# fail 5`, chacun sur
`Error: ENOENT: no such file or directory, open '.../web/sw.js'` ou
`.../web/index.html` : la coque n'existe pas.

- [ ] **Étape 3 — l'implémentation minimale**

`apps/marcq-handball/package.json` — trois lignes, et pas une de plus. Ce
n'est **pas** un manifeste de dépendances : il n'y en a aucune, il n'y aura ni
`package-lock.json` ni `node_modules` (ossature §2). Il déclare que les `.js`
de cette application sont des modules ES. Sans lui, un Node antérieur à 22.7
— celui du runner de CI peut l'être — refuse `import` dans un fichier `.js`
avec `SyntaxError: Cannot use import statement outside a module`, et PRP 02 ne
pourrait pas importer `../web/domaine.js` depuis ses tests.

```json
{
  "type": "module"
}
```

`apps/marcq-handball/web/sw.js` :

```js
// Service worker de marcq-handball.
//
// Il sert l'hors-ligne, jamais l'installation : aucun manifest, aucune invite
// « ajouter a l'ecran d'accueil ». Le PRD §11 demande un lien qui s'ouvre.
//
// Le jeton de la ligne VERSION ci-dessous est remplace par la version du
// binaire au moment ou le serveur sert ce fichier. Le nom du cache en depend :
// sans cela, pull_policy: always deploierait une image neuve que le navigateur
// n'afficherait jamais.
const VERSION = '__VERSION__';
const NOM_CACHE = `marcq-${VERSION}`;

// La coque mise en cache a l'installation. Un chemin qui repond 404 fait
// echouer cache.addAll, donc l'installation entiere, et le service worker
// n'active JAMAIS — l'app reste utilisable en ligne, l'hors-ligne disparait
// sans un mot. N'ajoute un chemin ici que le jour ou le fichier existe ;
// tests/coque.test.js verifie cette liste a chaque execution.
const COQUE = [
  '/',
  '/style.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(NOM_CACHE).then((cache) => cache.addAll(COQUE)));
  // La version deployee prend la main au rechargement suivant, pas deux
  // rechargements plus tard.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => n.startsWith('marcq-') && n !== NOM_CACHE)
          .map((n) => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // Le classement (lot 2) et la sonde de sante ne se mettent jamais en cache :
  // resservir un rang perime serait pire que d'annoncer qu'il est indisponible.
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  e.respondWith(cacheDAbord(requete));
});

// Cache d'abord : une seance se coche entierement hors ligne (PRD §11), et le
// reseau ne retarde jamais l'affichage. Le cache etant nomme par la version, un
// deploiement le vide de fait — il n'y a donc rien a invalider a la main.
async function cacheDAbord(requete) {
  const cache = await caches.open(NOM_CACHE);
  const enCache = await cache.match(requete, { ignoreSearch: true });
  if (enCache) return enCache;

  try {
    const reponse = await fetch(requete);
    if (reponse.ok && reponse.type === 'basic') {
      await cache.put(requete, reponse.clone());
    }
    return reponse;
  } catch (e) {
    // Hors ligne et rien en cache. Pour une navigation, la coque suffit a faire
    // demarrer l'app, qui relit ensuite sa progression dans localStorage.
    const repli = await cache.match('/');
    if (requete.mode === 'navigate' && repli) return repli;
    throw e;
  }
}
```

Le `fetch` met aussi en cache **au fil de l'eau** ce qui n'est pas dans `COQUE` :
c'est ce qui rendra `programme.json` et les modules ES disponibles hors ligne
sans qu'aucun PRP n'ait à penser à les précharger, et sans qu'un oubli ne casse
l'installation.

`apps/marcq-handball/web/index.html` :

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Programme d'été U15 — Marcq Handball</title>
<meta name="description" content="Le programme d'été du coach, du 3 au 21 août 2026.">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<main class="attente">
  <p class="sur-titre">Marcq Handball · U15</p>
  <h1>Programme d'été</h1>
  <p class="periode">Du 3 au 21 août 2026</p>

  <p class="dit">L'adresse est la bonne, et elle ne changera plus. Les séances
  du coach arrivent ici dans les prochaines heures.</p>

  <p class="note">Rien n'est encore à cocher : garde le lien, reviens dessus.
  Tu n'auras ni compte à créer, ni application à installer.</p>
</main>

<script>
  // Le service worker est enregistre des le premier deploiement, avant meme
  // qu'il y ait des ecrans : c'est son comportement de cache qu'il faut avoir
  // eprouve en ligne, tant qu'une coque figee ne coute encore rien.
  if ('serviceWorker' in navigator) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        // Navigation privee, stockage refuse, navigateur trop ancien : l'app
        // reste utilisable en ligne. L'echec ne remonte jamais a l'ecran.
        console.warn('service worker non enregistre', e);
      });
    });
  }
</script>
</body>
</html>
```

Le texte tutoie et ne promet rien de faux : il dit que l'adresse est bonne et
qu'il n'y aura ni compte ni installation — les deux seules choses qu'un enfant
a besoin de savoir avant que l'app n'existe (PRD §7.1, §11).

`apps/marcq-handball/web/style.css` :

```css
/* Jetons et socle de marcq-handball.
 *
 * L'app est ouverte dehors, en plein soleil, sur un telephone tenu a bout de
 * bras entre deux series. D'ou un theme CLAIR par defaut et des contrastes
 * eleves : un ecran sombre au soleil ne se lit pas. La variante sombre suit le
 * reglage du telephone, elle ne s'impose pas.
 *
 * Aucune police distante : la page est publique, tout ce qu'elle charge est en
 * meme origine (ossature §2). La pile systeme est deja celle que l'ado lit
 * partout ailleurs sur son telephone. */

:root {
  color-scheme: light dark;

  --papier:      #f6f4ef;  /* le fond */
  --carte:       #ffffff;  /* les surfaces posees dessus */
  --encre:       #14161c;  /* le texte, jamais du noir pur */
  --encre-douce: #545a68;  /* les mentions secondaires */
  --trait:       #ded8cd;  /* les separations */
  --signal:      #d62839;  /* l'accent : progression, validation, et rien d'autre */
  --signal-lisible: #ffffff;  /* ce qui s'ecrit sur le signal */
  --fait:        #16794a;  /* ce qui est accompli */

  /* Zone de tap minimale — PRD §11, mains moites et telephone a bout de bras.
     Aucune cible interactive de l'app ne descend sous cette valeur. */
  --tap: 44px;

  --pas:   0.5rem;
  --marge: clamp(1.25rem, 5vw, 2rem);
  --rayon: 12px;

  --texte: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
           "Helvetica Neue", Arial, sans-serif;
  --chiffres: ui-monospace, SFMono-Regular, Menlo, "DejaVu Sans Mono",
              "Liberation Mono", Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --papier:      #101216;
    --carte:       #191c22;
    --encre:       #edeae3;
    --encre-douce: #9aa1ad;
    --trait:       #2b2f38;
    --signal:      #ff5566;
    --signal-lisible: #14161c;
    --fait:        #4ec98a;
  }
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100dvh;
  padding: var(--marge);
  /* La barre d'adresse du telephone mange le bas de l'ecran : sans cette
     reserve, le dernier exercice d'une seance se cache derriere elle. */
  padding-bottom: calc(var(--marge) + env(safe-area-inset-bottom));
  background: var(--papier);
  color: var(--encre);
  font-family: var(--texte);
  font-size: 17px;
  line-height: 1.5;
}

h1 {
  margin: 0 0 var(--pas);
  font-size: clamp(2rem, 9vw, 2.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}

/* Toute cible interactive, partout dans l'app. Les ecrans des PRP suivants
   s'appuient dessus plutot que de redeclarer une hauteur a chaque bouton. */
.tap {
  min-height: var(--tap);
  min-width: var(--tap);
  display: inline-flex;
  align-items: center;
  gap: var(--pas);
}

:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}

/* ---- la page d'attente ---------------------------------------------------
   Elle dit ce qu'elle est. Elle n'imite aucun ecran de l'application : une
   fausse seance donnerait envie de taper dessus, et le premier tap serait un
   echec. */

.attente {
  max-width: 32rem;
  margin: 0 auto;
  padding-top: clamp(2rem, 12vh, 6rem);
}

.sur-titre {
  margin: 0 0 var(--pas);
  font-family: var(--chiffres);
  font-size: 0.8125rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--signal);
}

.periode {
  margin: 0 0 calc(var(--pas) * 4);
  font-family: var(--chiffres);
  color: var(--encre-douce);
}

.dit {
  margin: 0 0 calc(var(--pas) * 2);
  font-size: 1.125rem;
}

.note {
  margin: 0;
  padding: calc(var(--pas) * 2);
  background: var(--carte);
  border: 1px solid var(--trait);
  border-radius: var(--rayon);
  color: var(--encre-douce);
}

/* PRD §10 : tout reste utilisable sans un seul mouvement. La regle existe des la
   premiere ligne de CSS, pour qu'aucune animation ajoutee ensuite n'ait a y
   penser. Le PRP 06 REMPLACE ce bloc par la version definitive — il est le PRP
   des animations et il justifie ses valeurs. Il ne doit pas en ajouter un
   second : son test extrait le premier bloc du fichier. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`apps/marcq-handball/test.sh` — il n'y a pas encore de code Go, les deux lignes
`go` arrivent à la Tâche 3 :

```bash
#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
#
# Les modules ES du navigateur sont testes par le node --test de la
# bibliotheque standard, sur les fichiers memes que le navigateur charge :
# aucune dependance npm n'est installee, il n'y en a pas.
set -euo pipefail
cd "$(dirname "$0")"

node --test tests/*.test.js
```

Le bit d'exécution est ce que `./init.sh --check` regarde — réécrire le fichier
peut le perdre :

```bash
chmod +x apps/marcq-handball/test.sh
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS,
`# pass 5` / `# fail 0`.

Lancer : `./init.sh --check 2>&1 | grep 'test.sh'`  ·  Attendu :
`ok [marcq-handball] test.sh executable`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/web apps/marcq-handball/tests \
        apps/marcq-handball/package.json apps/marcq-handball/test.sh
git commit -m "marcq-handball : la coque, son service worker et ses invariants"
git push
```

---

### Tâche 3 — Le serveur qui la sert

**Fichiers :** Créer `apps/marcq-handball/{go.mod,main.go,main_test.go}` · Modifier `apps/marcq-handball/test.sh`, `go.work` (régénéré) · Tester `apps/marcq-handball/main_test.go`

- [ ] **Étape 1 — écrire le test qui échoue**

`apps/marcq-handball/go.mod` :

```
module github.com/billbob-space/hello-world/apps/marcq-handball

go 1.24
```

`apps/marcq-handball/main_test.go` :

```go
package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func newServeur(t *testing.T) http.Handler {
	t.Helper()
	web, err := fs.Sub(coque, "web")
	if err != nil {
		t.Fatalf("coque illisible : %v", err)
	}
	sw, err := chargerServiceWorker(web)
	if err != nil {
		t.Fatalf("service worker illisible : %v", err)
	}
	return routes(web, sw)
}

func get(t *testing.T, h http.Handler, chemin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, chemin, nil))
	return rec
}

func TestSanteRepond200(t *testing.T) {
	rec := get(t, newServeur(t), "/healthz")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("corps %q, attendu \"ok\"", rec.Body.String())
	}
}

// La coque est servie a la racine : c'est ce dont depend la portee du service
// worker. Servie sous /web/, elle ne pourrait pas prendre en charge /.
func TestRacineSertLaCoque(t *testing.T) {
	rec := get(t, newServeur(t), "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type %q, attendu text/html", ct)
	}
	if !strings.Contains(rec.Body.String(), "sw.js") {
		t.Error("la coque n'enregistre pas le service worker")
	}
}

func TestStyleServiDepuisLaRacine(t *testing.T) {
	rec := get(t, newServeur(t), "/style.css")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/css") {
		t.Errorf("Content-Type %q, attendu text/css", ct)
	}
}

// Le nom du cache du navigateur derive de cette valeur. Si le jeton sortait tel
// quel, toutes les versions partageraient le meme cache et un deploiement ne
// changerait rien a l'ecran.
func TestServiceWorkerPorteLaVersionDuBinaire(t *testing.T) {
	original := version
	t.Cleanup(func() { version = original })
	version = "abcdef1234567890"

	rec := get(t, newServeur(t), "/sw.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d, attendu 200", rec.Code)
	}
	corps := rec.Body.String()
	if strings.Contains(corps, jetonVersion) {
		t.Errorf("le jeton %s est sorti tel quel : le cache ne serait pas versionne", jetonVersion)
	}
	if !strings.Contains(corps, version) {
		t.Errorf("la version %q est absente du service worker servi", version)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/javascript") {
		t.Errorf("Content-Type %q, attendu application/javascript", ct)
	}
	// Un service worker mis en cache par le navigateur retarderait d'autant la
	// prise en main de la version deployee.
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control %q, attendu no-cache", cc)
	}
}

// Sans jeton, le demarrage doit echouer bruyamment : un cache non versionne ne
// se manifeste que sur le telephone de quelqu'un d'autre, des semaines apres.
func TestServiceWorkerSansJetonRefuseDeDemarrer(t *testing.T) {
	fige := fstest.MapFS{"sw.js": &fstest.MapFile{Data: []byte("const VERSION = 'fige';")}}
	if _, err := chargerServiceWorker(fige); err == nil {
		t.Error("un sw.js sans jeton a ete accepte")
	}
	if _, err := chargerServiceWorker(fstest.MapFS{}); err == nil {
		t.Error("un sw.js absent a ete accepte")
	}
}

// PRP 02 livre web/programme.json et cette assertion devient : 200,
// application/json, Cache-Control no-cache. La route, elle, existe deja — c'est
// ce qui permet aux deux PRP d'avancer en parallele sans se disputer main.go.
func TestProgrammeJSONPasEncoreLivre(t *testing.T) {
	if code := get(t, newServeur(t), "/programme.json").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404 tant que le programme n'est pas livre", code)
	}
}

func TestCheminInconnuRepond404(t *testing.T) {
	if code := get(t, newServeur(t), "/ailleurs").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404", code)
	}
}

// Les tests du navigateur ne doivent jamais atterrir dans l'image, et encore
// moins etre servis : go:embed web les laisse dehors, cette assertion le fige.
func TestLesTestsNeSontPasServis(t *testing.T) {
	if code := get(t, newServeur(t), "/tests/coque.test.js").Code; code != http.StatusNotFound {
		t.Errorf("code %d, attendu 404 : tests/ n'a rien a faire dans l'image", code)
	}
}

// L'en-tete porte la meme verite que l'ecran : verifier un deploiement ne
// demande pas d'ouvrir la page.
func TestEnteteVersionSurToutesLesReponses(t *testing.T) {
	h := newServeur(t)
	for _, chemin := range []string{"/", "/healthz", "/sw.js", "/style.css", "/inconnu"} {
		if v := get(t, h, chemin).Header().Get("X-App-Version"); v != version {
			t.Errorf("%s : X-App-Version %q, attendu %q", chemin, v, version)
		}
	}
}
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `cd apps/marcq-handball && go test ./...`
Attendu : ÉCHEC de compilation —
`undefined: coque`, `undefined: chargerServiceWorker`, `undefined: routes`,
`undefined: version`, `undefined: jetonVersion`.

- [ ] **Étape 3 — l'implémentation minimale**

`apps/marcq-handball/main.go` :

```go
// marcq-handball — le programme d'ete U15 du Marcq Handball.
//
// Le serveur ne connait aucun utilisateur et n'a aucun etat : il sert la coque
// embarquee et une sonde de sante. L'application est en palier public, ou
// Traefik n'authentifie personne et ne pose donc aucun en-tete d'identite ;
// tout ce qu'un client enverrait sous ce nom serait une valeur qu'il a choisie
// lui-meme. Le domaine et la progression vivent dans le navigateur.
package main

import (
	"bytes"
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// go:embed n'emporte que web/ : les tests de tests/ ne sont jamais dans
// l'image, et une edition de test n'invalide pas le cache de couches.
//
//go:embed web
var coque embed.FS

// version identifie l'image deployee. Elle est posee a la construction par
// -ldflags "-X main.version=..." et vaut le SHA du commit en CI ; "dev" en
// construction locale.
var version = "dev"

// jetonVersion est remplace par version au moment ou sw.js est charge. Le
// laisser dans le fichier source garde web/sw.js executable tel quel par un
// navigateur et lisible par node --test, sans etage de construction.
const jetonVersion = "__VERSION__"

func main() {
	log.SetFlags(0) // l'infra horodate les logs ; on ecrit sur la sortie standard

	web, err := fs.Sub(coque, "web")
	if err != nil {
		log.Fatalf("coque illisible : %v", err)
	}

	sw, err := chargerServiceWorker(web)
	if err != nil {
		log.Fatalf("service worker illisible : %v", err)
	}

	addr := ":" + env("PORT", "8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           logging(routes(web, sw)),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Arret propre : le serveur cesse d'accepter et laisse les requetes en
	// cours se terminer, pour qu'un redeploiement ne coupe personne.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("ecoute sur %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur arrete : %v", err)
		}
	}()

	<-stop
	log.Print("arret demande, fermeture en cours")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("fermeture forcee : %v", err)
	}
}

// routes assemble le serveur. main() et les tests appellent cette meme
// fonction : une route ajoutee ici est testee d'office, alors qu'un mux
// reconstruit dans le fichier de test laisserait passer une route non couverte.
//
// La coque est servie A LA RACINE, pas sous /web/ : la portee du service worker
// et les chemins des imports ES doivent coincider avec les URL servies.
func routes(web fs.FS, sw []byte) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleSante)
	mux.HandleFunc("GET /sw.js", handleServiceWorker(sw))
	mux.HandleFunc("GET /programme.json", fichier(web, "programme.json",
		"application/json; charset=utf-8", "no-cache"))
	// Motif le moins specifique : le ServeMux de Go 1.22 donne la priorite aux
	// trois routes ci-dessus, et celle-ci recoit tout le reste — index.html a
	// la racine, les modules ES, style.css, et un 404 pour l'inconnu.
	mux.Handle("GET /", http.FileServerFS(web))
	return withVersion(mux)
}

// chargerServiceWorker lit sw.js et y injecte la version du binaire. Le nom du
// cache en depend : sans cette substitution, pull_policy: always deploierait
// une image neuve que le navigateur n'afficherait jamais.
//
// L'absence du jeton empeche le demarrage plutot que de passer inapercue : une
// coque figee dans un cache eternel est un defaut qui ne se manifeste que sur
// le telephone de quelqu'un d'autre, trois semaines plus tard.
func chargerServiceWorker(web fs.FS) ([]byte, error) {
	source, err := fs.ReadFile(web, "sw.js")
	if err != nil {
		return nil, err
	}
	if !bytes.Contains(source, []byte(jetonVersion)) {
		return nil, fmt.Errorf("jeton %s absent de web/sw.js : le cache ne serait pas versionne", jetonVersion)
	}
	return bytes.ReplaceAll(source, []byte(jetonVersion), []byte(version)), nil
}

func handleSante(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func handleServiceWorker(source []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		// no-cache et non no-store : le navigateur revalide a chaque
		// chargement. C'est la condition pour qu'une version deployee prenne
		// la main au rechargement suivant plutot que dans une journee.
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(source)
	}
}

// fichier sert une entree precise de la coque avec un type MIME et une
// directive de cache explicites, la ou le serveur de fichiers ne saurait poser
// que le premier. Un nom absent de la coque rend 404, jamais une panique.
func fichier(web fs.FS, nom, typeMime, cache string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		contenu, err := fs.ReadFile(web, nom)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", typeMime)
		w.Header().Set("Cache-Control", cache)
		_, _ = w.Write(contenu)
	}
}

// withVersion annonce la version deployee sur toutes les reponses, y compris
// celle du healthcheck. Verifier un deploiement ne demande alors pas d'ouvrir
// la page : l'en-tete suffit.
func withVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-App-Version", version)
		next.ServeHTTP(w, r)
	})
}

// logging trace chaque requete sur la sortie standard. Rien d'identifiant n'y
// figure : l'app est publique, ses journaux ne doivent rien apprendre de qui
// s'entraine.
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		debut := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(debut).Truncate(time.Millisecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func env(cle, defaut string) string {
	if v := os.Getenv(cle); v != "" {
		return v
	}
	return defaut
}
```

Compléter `apps/marcq-handball/test.sh` — les deux chaînes, un seul point
d'entrée :

```bash
#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
#
# Deux chaines, parce que l'app en a deux : le serveur Go, et les modules ES du
# navigateur. Les seconds sont testes par le node --test de la bibliotheque
# standard, sur les fichiers memes que le navigateur charge — aucune dependance
# npm n'est installee, il n'y en a pas.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...
node --test tests/*.test.js
```

```bash
chmod +x apps/marcq-handball/test.sh
```

Régénérer `go.work` : il liste les applications qui portent un `go.mod`, et il
vient d'en apparaître un. Sans ce passage, `./init.sh --check` déclare
`go.work desynchronise des manifestes`.

```bash
./init.sh
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `./apps/marcq-handball/test.sh`  ·  Attendu : SUCCÈS —
`ok  github.com/billbob-space/hello-world/apps/marcq-handball`, puis
`# pass 5` / `# fail 0`.

Lancer : `cd apps/marcq-handball && go test -v ./... | grep -c '^--- PASS'`  ·
Attendu : `9`.

Éprouver le binaire pour de vrai, en une commande — c'est le seul moyen de voir
la substitution du jeton et les en-têtes réels :

```bash
cd apps/marcq-handball
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=essai0123456" -o /tmp/mh .
PORT=8199 /tmp/mh & pid=$!
sleep 1
curl -sI http://localhost:8199/healthz | grep -i 'x-app-version'
curl -s  http://localhost:8199/sw.js | grep 'const VERSION'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8199/ailleurs
kill "$pid"
```

Attendu : `X-App-Version: essai0123456`, puis `const VERSION = 'essai0123456';`,
puis `404`.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/go.mod apps/marcq-handball/main.go \
        apps/marcq-handball/main_test.go apps/marcq-handball/test.sh go.work
git commit -m "marcq-handball : le serveur, la coque a la racine et la version injectee dans sw.js"
git push
```

---

### Tâche 4 — L'image

**Fichiers :** Créer `apps/marcq-handball/Dockerfile` · Modifier `apps/marcq-handball/.dockerignore` · Tester `./init.sh --check`

- [ ] **Étape 1 — écrire le test qui échoue**

Le test est la partie « fichiers d'app » du contrat, qui vérifie le `USER`, le
multi-étapes, l'absence de `LABEL traefik.*` et la présence de l'outil du
healthcheck dans l'image :

```bash
./init.sh --check 2>&1 | grep 'marcq-handball'
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `./init.sh --check 2>&1 | grep 'marcq-handball'`
Attendu : la ligne `attn  [marcq-handball] pas encore de Dockerfile (app desactivee)` —
rien ne peut construire l'image, et l'activer à ce stade la remplacerait par un
`KO` bloquant.

- [ ] **Étape 3 — l'implémentation minimale**

`apps/marcq-handball/Dockerfile` :

```dockerfile
# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique — coque web comprise, embarquee par
# go:embed. Environ 14 Mo, loin des 200 Mo du plafond.
#
# Le contexte de construction est apps/marcq-handball, jamais la racine du
# depot : c'est ce qui isole cette app des autres applications de la fabrique.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod change.
# go.sum n'existe pas — l'application n'a aucune dependance externe — et le
# motif go.su[m] le rend optionnel sans faire echouer le COPY le jour ou il
# apparaitrait.
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .

# Identifiant de la version deployee. Il est annonce en en-tete X-App-Version et
# nomme le cache du service worker : la CI passe le SHA du commit, une
# construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/marcq-handball .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le healthcheck
# declare dans app.yml a besoin. Une image sans shell imposerait health_cmd none.
RUN adduser -D -H -u 10001 app

COPY --from=build /out/marcq-handball /usr/local/bin/marcq-handball

# Aucun port n'est publie ici : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

USER app
ENTRYPOINT ["/usr/local/bin/marcq-handball"]
```

Compléter `apps/marcq-handball/.dockerignore` — ajouter les deux dernières
lignes et leur commentaire, sans toucher au bloc généré au-dessus :

```
# Complete a la main. Ni les tests du navigateur ni les PRP n'entrent dans
# l'image : go:embed n'emporte que web/. « *.md » ne couvre que la racine du
# contexte — prp/ doit donc etre nomme, sans quoi chaque relecture d'un PRP
# invaliderait le cache de couches.
tests/
prp/
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `./init.sh --check 2>&1 | grep 'marcq-handball'`
Attendu : SUCCÈS — `ok [marcq-handball] Dockerfile`,
`ok [marcq-handball] USER declare (non root)`,
`ok [marcq-handball] construction multi-etapes`,
`ok [marcq-handball] aucun label traefik dans le Dockerfile`,
`ok [marcq-handball] wget semble present dans l'image`.

Si un démon Docker est joignable, la construction se vérifie sur place ; sinon
la CI le fera à la Tâche 6, et la taille est annoncée dans son journal.

```bash
docker build --build-arg VERSION=essai -t marcq-handball:essai apps/marcq-handball
docker images marcq-handball:essai --format '{{.Size}}'
```

Attendu : une taille sous 200 Mo — de l'ordre de 14 Mo.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/Dockerfile apps/marcq-handball/.dockerignore
git commit -m "marcq-handball : image alpine multi-etapes, non root, sans tests ni PRP dans le contexte"
git push
```

---

### Tâche 5 — Ce que le dépôt dit de cette application

**Fichiers :** Modifier `apps/marcq-handball/README.md`, `apps/marcq-handball/PRODUCT.md` · Tester `./init.sh --check`

Les deux fichiers sortis de l'échafaudage sont des gabarits. Les laisser tels
quels ferait entrer des `TODO` dans `main`.

- [ ] **Étape 1 — écrire le test qui échoue**

```bash
grep -c 'TODO' apps/marcq-handball/README.md apps/marcq-handball/PRODUCT.md
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `grep -c 'TODO' apps/marcq-handball/README.md apps/marcq-handball/PRODUCT.md`
Attendu : ÉCHEC — `README.md:2` et `PRODUCT.md:4`, six lignes de gabarit.

- [ ] **Étape 3 — l'implémentation minimale**

`apps/marcq-handball/README.md` :

````markdown
# marcq-handball

URL : https://marcq-handball.apps.billbob.ovh — palier d'exposition : `public`.

Le programme d'été U15 du Marcq Handball, du 3 au 21 août 2026 : les séances du
coach, cochables d'un tap, sur le téléphone de l'enfant.

## Le partage serveur / navigateur

Le serveur ne connaît **aucun** utilisateur et n'a **aucun** état. Il sert la
coque embarquée par `go:embed` et une sonde de santé. Le domaine, la
progression et le prénom vivent dans le navigateur, en modules ES natifs — pas
de bundler, pas de `node_modules`, pas de transpilation.

Le palier est `public` : Traefik n'authentifie personne, ne pose donc aucun
en-tête d'identité, et l'application n'en lit aucun. Ce qui est propre à un
visiteur reste sur son appareil (`localStorage`).

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /<fichier>` | le fichier de `web/`, servi à la racine |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache`, version injectée |
| `GET /healthz` | `200 ok`, `text/plain` |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` : vérifier un déploiement ne
demande pas d'ouvrir la page.

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
```

Le service worker met la coque en cache par version. En développement local la
version vaut `dev` et le cache ne change donc jamais de nom : recharger avec le
cache désactivé, ou vider `marcq-dev` dans les outils du navigateur.

## Variables d'environnement

Aucun secret n'est attendu, et rien de sensible ne doit transiter : tout ce que
le navigateur reçoit est public par construction.

| Nom | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute HTTP en clair dans le conteneur | `8080` |

## Besoins d'infrastructure

Aucun pour le lot 1 : ni base de données, ni cache, ni volume, ni port
supplémentaire.

**Le lot 2 en demandera un** : le classement doit survivre à un redéploiement
(PRD §12.1). Un magasin remis à zéro à chaque publication d'image serait pire
que pas de classement. C'est une décision d'exploitation, elle se prend côté
serveur ; le PRP 07 ne démarre pas avant.
````

`apps/marcq-handball/PRODUCT.md` :

```markdown
# Product — marcq-handball

Dérivé de `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`, qui reste
la source. Ce fichier en donne la forme courte ; le PRD tranche.

## Users

**L'enfant de 13-14 ans** est l'utilisateur principal et le seul dont
l'engagement décide du succès. Il ouvre l'app sur son téléphone, dehors,
parfois en 4G, entre deux séries. Il n'a pas nécessairement de compte Google ni
d'adresse à lui, et il abandonnera à la deuxième friction.

**Le parent** est un utilisateur de substitution : c'est lui qui doit être en
position de décider si quelque chose de son enfant part sur un serveur.

**Le coach** est un lecteur, pas un contributeur. Ce qu'il veut savoir le
20 août : dans quel état il récupère son groupe.

## Product Purpose

Le coach a envoyé son programme d'avant-reprise dans une note de téléphone :
trois pages, sept séances du 3 au 21 août. Un document envoyé une fois ne dit
ni où on en est, ni ce qu'il y a à faire aujourd'hui, ne récompense rien, et
n'apprend à personne qui s'entraîne réellement. L'application n'ajoute aucun
contenu : elle transforme ce texte en un parcours qui se coche, se mesure et se
compare.

## Capabilities and Constraints

- Aucun compte, aucun mot de passe, aucune installation. Un lien qui s'ouvre.
- Le prénom de l'enfant ne quitte jamais son appareil. Le serveur ne le connaît
  pas.
- Le programme vit dans un fichier de données éditable, séparé du code : le
  modifier ne demande pas de toucher au code, et les totaux affichés en sont
  recalculés.
- Le passé se corrige, l'avenir ne se coche pas.
- Les jours sans séance sont du repos, pas un trou.
- L'app reste utilisable réseau coupé ; seul le classement demande le réseau, et
  son absence n'empêche jamais de s'entraîner.
- Mobile d'abord : zones de tap larges, contraste lisible en plein soleil,
  aucune interaction dépendant du survol, `prefers-reduced-motion` respecté.
- Hors périmètre, décidé et non oublié : édition du programme depuis l'app,
  chronomètre, vidéos, messagerie, notifications, saisie du nombre réellement
  effectué, historique multi-saisons.

## Product Principles

**Par défaut, rien ne quitte le téléphone.** L'URL est publique et finira par
être trouvée : tout ce qui est envoyé au serveur doit être considéré comme
lisible par tous. Ce qui part se limite à ce que l'enfant a explicitement
choisi d'exposer, sous le nom qu'il a choisi.

**Le système est déclaratif, et assumé comme tel.** Cocher les 15 pompes vaut
déclaration de 15 pompes. Une équipe de gamins qui se connaissent : la triche
se voit au vestiaire.

**L'animation est une récompense, jamais un péage.** Elle vient après l'action,
ne retarde aucun tap, et ne s'interpose jamais entre l'enfant et la case
suivante.

**Le ton tutoie sans infantiliser.** Ce sont des joueurs de U15. Pas de
mascotte, pas de badge à collectionner, pas de vocabulaire de coach américain.
```

- [ ] **Étape 4 — le relancer, vérifier qu'il passe**

Lancer : `grep -c 'TODO' apps/marcq-handball/README.md apps/marcq-handball/PRODUCT.md`
Attendu : SUCCÈS de l'intention — `README.md:0` et `PRODUCT.md:0`, sortie 1
puisque `grep` ne trouve rien. C'est ici l'absence de résultat qui est le
succès.

Lancer : `./init.sh --check`  ·  Attendu : SUCCÈS, aucun `KO`, et
`ok [marcq-handball] PRODUCT.md`.

- [ ] **Étape 5 — committer**

```bash
./init.sh --pret
git add apps/marcq-handball/README.md apps/marcq-handball/PRODUCT.md
git commit -m "marcq-handball : ce que le depot dit de l'app, et le besoin d'infra du lot 2"
git push
```

---

### Tâche 6 — Commit 1 : la CI publie l'image

**Fichiers :** aucun · Tester GHCR

**Pourquoi cet ordre, et pas l'inverse.** La stack est unique : `docker compose
up` est atomique pour l'ensemble. Une application activée dont l'image n'existe
pas au registre ferait échouer le déploiement de **toutes** les autres, y
compris celles qu'on n'a pas touchées. Le garde-fou de CI vérifie que chaque
image du compose est tirable avant d'appeler le webhook, mais il le vérifie
avec **son** jeton : un paquet GHCR fraîchement créé peut être tirable par la CI
et pas encore par le serveur. D'où le point d'arrêt humain entre les deux
commits — c'est exactement ce que la Tâche 6 sert à constater.

Et sur une pull request, la CI **construit sans publier**
(`push: ${{ github.event_name != 'pull_request' }}`) : au moment où la PR est
ouverte, `ghcr.io/billbob-space/hello-world/marcq-handball:main` n'existe pas.
Les deux commits sont donc deux pull requests, pas deux commits d'une même PR.

- [ ] **Étape 1 — ouvrir la pull request**

Le corps suit `.github/pull_request_template.md` : ses sections se remplissent,
elles ne s'inventent pas. Le raisonnement détaillé, lui, reste dans les cinq
messages de commit, où il survit à la fusion.

```bash
cat > /tmp/pr-socle.md <<'MD'
L'application `marcq-handball` entre dans la fabrique, désactivée, avec son
serveur, sa coque et son image — le produit, lui, arrive aux PRP suivants.

## Ce qui compte

- **L'ordre est le sujet.** L'app est `enabled: false` : la stack est unique, et
  une image référencée avant d'exister ferait échouer le `compose up` de toutes
  les autres. Une seconde PR l'activera, une fois l'image publiée sur GHCR.
- **La page servie est une page d'attente**, et elle le dit. Elle n'imite aucun
  écran : une fausse séance donnerait envie de taper dessus.
- **Le service worker est livré dès maintenant**, avec son cache nommé par la
  version du binaire. C'est le seul moment où une coque figée dans un cache ne
  coûte rien, donc le seul moment raisonnable pour éprouver ce comportement.
- **`stack: typescript` alors que le serveur est en Go** : `stack` ne choisit
  que le serveur de langage, `gopls` arrive déjà par `cadran`, et l'outillage
  est l'union des `stack` du dépôt.
- **Aucune dépendance, ni npm ni Go.** `package.json` ne contient que
  `{"type": "module"}`, pour que Node lise les mêmes fichiers que le navigateur.

## Vérifié

`./apps/marcq-handball/test.sh` : 9 tests Go, 5 tests Node, 0 échec.
`./init.sh --check` : aucun `KO`. Binaire 5,7 Mo, image attendue ~14 Mo.

## Avant de fusionner

Cette PR ne met rien en ligne, mais elle modifie
`.github/workflows/build.yml` — le nom de l'app entre dans la matrice. Le job
`detect` reconstruit donc **toutes** les applications, et le serveur redémarre
la stack avec des images identiques à la construction près.

Le paquet GHCR `hello-world/marcq-handball` est créé par cette fusion, et naît
privé. S'il faut le rendre public un par un côté organisation, c'est à faire
avant la PR d'activation.
MD

gh pr create --title "marcq-handball : le socle deployable" --body-file /tmp/pr-socle.md
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer : `curl -s -o /dev/null -w '%{http_code}\n' https://marcq-handball.apps.billbob.ovh/healthz`
Attendu : ÉCHEC — `307`. Pas un 404 : **un routeur catch-all répond déjà à ce
nom d'hôte** et redirige vers l'authentification Google. C'est exactement le cas
que `priority=100` sur le routeur de l'app viendra battre, et la raison pour
laquelle le contrat interdit d'y toucher.

Le DNS, lui, résout déjà — `*.apps.billbob.ovh` est un enregistrement joker :

```bash
getent hosts marcq-handball.apps.billbob.ovh
```

Attendu : l'adresse du serveur, la même que pour `cadran.apps.billbob.ovh`.

- [ ] **Étape 3 — fusionner, et attendre la publication**

Après relecture et fusion sur `main` :

```bash
gh run list --branch main --limit 1
gh run watch
```

Attendu : les jobs `contrat`, `detect`, `test`, `build` verts. L'étape
`taille de l'image` du job `build` écrit `Image marcq-handball : 14 Mo` — un
dépassement des 200 Mo n'y serait qu'un `::warning::`, à traiter quand même.

- [ ] **Étape 4 — vérifier que l'image existe, et qu'elle est tirable par le serveur**

```bash
gh api "/orgs/billbob-space/packages/container/hello-world%2Fmarcq-handball" \
  --jq '{nom: .name, visibilite: .visibility}'
```

Attendu : le paquet existe. **Sa visibilité décide de la suite.** Le dépôt est
privé, donc le paquet naît privé. Deux résolutions, toutes deux hors de ce
dépôt, documentées dans le `README.md` de la racine : soit le serveur est
authentifié sur `ghcr.io` avec un jeton `read:packages` — auquel cas ce nouveau
paquet, rattaché au même dépôt que les autres, est déjà couvert et il n'y a
rien à faire ; soit les paquets ont été rendus publics un par un, et celui-ci
doit l'être à son tour avant la Tâche 7.

**Ne pas passer à la Tâche 7 sans avoir tranché ce point.** C'est le seul
endroit de la séquence où un `compose up` peut échouer pour la stack entière :
le garde-fou de CI teste la pullabilité avec le jeton de la CI, pas avec celui
du serveur.

- [ ] **Étape 5 — reprendre une branche pour le second commit**

```bash
git switch main && git pull
./init.sh --branche marcq-handball/activation
```

`--branche` fonctionne maintenant : `apps/marcq-handball/app.yml` existe, donc
le préfixe est un nom d'application connu.

---

### Tâche 7 — Commit 2 : le déploiement

**Fichiers :** Modifier `apps/marcq-handball/app.yml`, `compose.yaml` (régénéré) · Tester l'URL

- [ ] **Étape 1 — écrire le test qui échoue**

Le test est l'URL elle-même, et le contraste avec une application privée voisine
— c'est la seule vérification qui prouve que le middleware `public` est bien
celui qui a été posé, et pas un `forwardauth` hérité du défaut :

```bash
echo -n 'marcq-handball : '; curl -s -o /dev/null -w '%{http_code}\n' https://marcq-handball.apps.billbob.ovh/healthz
echo -n 'cadran         : '; curl -s -o /dev/null -w '%{http_code}\n' https://cadran.apps.billbob.ovh/healthz
```

- [ ] **Étape 2 — le lancer, vérifier qu'il échoue**

Lancer les deux `curl` ci-dessus.
Attendu : ÉCHEC — `marcq-handball : 307` et `cadran : 307`. Les deux adresses
redirigent vers l'authentification Google : la seconde parce que son palier est
`private`, la première parce qu'un routeur catch-all la capte faute de routeur
à elle. Les deux réponses sont identiques, et c'est bien le problème.

- [ ] **Étape 3 — l'implémentation minimale**

```bash
./init.sh --app marcq-handball --enable
./init.sh --check
```

`--enable` écrit `enabled: true` dans `app.yml`, et la même exécution régénère
`compose.yaml` avec le service `marcq-handball`. Vérifier que le bloc porte bien
le palier public — `--check` le fait service par service, mais le lire une fois
vaut mieux que de le supposer :

```bash
grep 'routers.marcq-handball' compose.yaml
```

Attendu, parmi les labels du routeur :
`traefik.http.routers.marcq-handball.middlewares=public,security-headers@file`
et `traefik.http.routers.marcq-handball.priority=100`. Ne pas confondre
`public` avec `forwardauth-open`, qui exige un compte Google. Et sans
`priority=100`, le catch-all qui répond aujourd'hui à cette adresse continuerait
de la capter.

Le fichier final d'`app.yml` est celui de l'ossature §1, à l'identique.

- [ ] **Étape 4 — committer, pousser, fusionner**

```bash
./init.sh --pret
git add apps/marcq-handball/app.yml compose.yaml
git commit -m "marcq-handball : l'app entre dans le compose, son image etant publiee"
git push -u origin marcq-handball/activation

cat > /tmp/pr-activation.md <<'MD'
`marcq-handball` entre dans le compose : son image est publiée, l'app peut être
activée sans risque pour la stack.

## Ce qui compte

- **Un seul fichier décide**, `app.yml` passe à `enabled: true` ; `compose.yaml`
  est régénéré par `./init.sh`, jamais édité.
- **Le palier est `public`** : middleware `public`, aucune authentification. À
  ne pas confondre avec `forwardauth-open`, qui exige un compte Google.
- **`priority=100`** est ce qui fait passer le routeur de l'app devant le
  catch-all qui répond aujourd'hui à cette adresse.
- **L'image existe déjà** sur GHCR, publiée par la PR précédente : le garde-fou
  de CI qui vérifie la pullabilité de chaque image du compose passera.

## Vérifié

`./init.sh --check` : aucun `KO`, palier `public -> public` sur le service.
`./apps/marcq-handball/test.sh` : 9 tests Go, 5 tests Node, 0 échec.

## Avant de fusionner

Le serveur doit pouvoir tirer `ghcr.io/billbob-space/hello-world/marcq-handball:main`
— vérifié à la PR précédente. Sans cela le `compose up` échoue pour la stack
entière, et pas seulement pour cette app.
MD

gh pr create --title "marcq-handball : l'app entre dans le compose" --body-file /tmp/pr-activation.md
```

- [ ] **Étape 5 — le relancer, vérifier qu'il passe**

Compter deux à trois minutes entre la fusion et la mise en ligne — la CI
construit, publie, puis un unique appel de webhook fait récupérer la stack
entière par le serveur. Puis :

```bash
echo -n 'marcq-handball : '; curl -s -o /dev/null -w '%{http_code}\n' https://marcq-handball.apps.billbob.ovh/healthz
echo -n 'cadran         : '; curl -s -o /dev/null -w '%{http_code}\n' https://cadran.apps.billbob.ovh/healthz
curl -sI https://marcq-handball.apps.billbob.ovh/healthz | grep -i 'x-app-version'
curl -s  https://marcq-handball.apps.billbob.ovh/sw.js | grep 'const VERSION'
curl -s  https://marcq-handball.apps.billbob.ovh/ | grep '<title>'
```

Attendu : SUCCÈS — `marcq-handball : 200` contre `cadran : 307` ;
`X-App-Version` égal au SHA du commit de fusion ; `const VERSION = '<ce même
SHA>';` ; `<title>Programme d'été U15 — Marcq Handball</title>`.

Si `marcq-handball` rend encore `307`, le routeur de l'app n'est pas en place :
relire le journal du job `deploy` de la CI plutôt que de toucher aux labels.
Si l'en-tête `X-App-Version` porte un SHA plus ancien que le commit fusionné,
c'est le serveur qui n'a pas retiré l'image — `pull_policy: always` est bien
dans le compose, le sujet est côté registre.

Enfin, l'arbre est propre, la branche est fusionnée, l'URL répond :

```bash
git switch main && git pull
./init.sh --check
```

Les PRP 02 et 03 peuvent démarrer, en parallèle.

---

## Points d'attention

**La chaîne `x-forwarded-user` est interdite dans cette application, commentaires
compris.** `./init.sh --check` (`init.sh:1444-1452`) refuse le dépôt si elle
apparaît dans un fichier **suivi** de `apps/marcq-handball/` **hors `.md`** — la
recherche est insensible à la casse et ne fait pas la différence entre du code
et un commentaire. En palier `public` Traefik ne pose ni n'écrase cet en-tête :
le lire reviendrait à identifier quelqu'un sur une valeur qu'il a forgée. C'est
pourquoi `main.go` en parle sans jamais l'écrire. Les PRP, eux, sont des `.md`
et peuvent le nommer.

**`./init.sh --add` refuse un répertoire existant.** `apps/marcq-handball/`
existe déjà — il porte les PRP. `--force` est obligatoire, il ne touche pas à
`prp/`, mais il **réécrit** `app.yml`, `test.sh`, `README.md` et `PRODUCT.md` :
le relancer plus tard effacerait sans un mot le travail des Tâches 2, 3 et 5, et
remettrait `enabled` à `false`. Une seule fois, en tout premier.

**`./init.sh --branche marcq-handball/...` ne marche qu'après la Tâche 1.** Une
application se découvre par son `app.yml` ; avant lui, le préfixe est inconnu et
la commande sort en erreur. La première branche s'ouvre donc à la main, depuis
`origin/main`.

**Une entrée de `COQUE` qui répond 404 tue l'hors-ligne en silence.**
`cache.addAll` rejette en bloc, l'installation du service worker échoue, il
n'active jamais — et l'application continue de fonctionner parfaitement tant
qu'il y a du réseau. `tests/coque.test.js` est la seule chose qui l'attrape ;
tout PRP qui ajoute un fichier de coque ajoute son chemin dans `COQUE` **et**
livre le fichier dans le même commit.

**Sans `package.json`, `node --test` échoue selon la version de Node.** La
détection automatique des modules ES n'est activée par défaut qu'à partir de
Node 22.7 ; le runner de la CI peut être plus ancien, et le message
(`Cannot use import statement outside a module`) ne dit pas que c'est une
question de version. `{"type": "module"}` rend le comportement identique
partout, sans introduire la moindre dépendance.

**`*.md` dans un `.dockerignore` ne couvre que la racine du contexte.** Les
motifs Docker ne descendent pas dans les sous-répertoires : sans la ligne
`prp/`, chaque relecture d'un PRP entrerait dans le contexte de construction et
invaliderait le cache de couches.

**La CI ne publie l'image que sur un `push` vers `main`.** Sur une pull request
elle construit sans publier, délibérément, pour ne pas bouger le tag `:main`
que le serveur suit. Le tag n'existe donc qu'après la fusion — c'est ce qui
impose deux pull requests plutôt que deux commits d'une seule.

**La fusion du premier commit redémarre toute la stack.** Il modifie
`.github/workflows/build.yml` (le nom de l'app entre dans la matrice), et le job
`detect` reconstruit alors **toutes** les applications. Rien n'est cassé — les
images sont identiques à la construction près — mais `cadran` et `hello-world`
redémarrent.

**`health_cmd` s'exécute dans le conteneur.** `wget` vient de busybox dans
l'image Alpine. Passer à `scratch` ou `distroless` pour gagner 8 Mo rendrait le
conteneur malsain en permanence, sans que l'application soit en cause : il
faudrait alors `health_cmd: none`.

**`go.work` change dès que `go.mod` apparaît.** C'est un artefact dérivé :
on relance `./init.sh`, on ne l'édite pas. Oublier ce passage fait échouer
`--check` sur `go.work desynchronise des manifestes`, un message qui ne dit pas
qu'il suffit de relancer le générateur.

**Le service worker fige la page d'attente sur les téléphones qui l'ouvrent
avant les écrans.** C'est voulu, et c'est réparé par le versionnage : au
déploiement suivant, `VERSION` change, le cache change de nom, l'ancien est
supprimé à l'activation, et `skipWaiting()` + `clients.claim()` donnent la main
à la nouvelle version dès le rechargement suivant. Ne pas « désactiver le
service worker en attendant » : c'est précisément maintenant, quand une coque
figée ne coûte rien, qu'il faut avoir vérifié ce comportement en ligne.

**`http.FileServerFS` redirige `/index.html` vers `/`.** Aucun lien de l'app ne
doit donc pointer vers `/index.html` : la redirection est correcte, mais elle
coûte un aller-retour et brouille le cache du service worker, qui a mis `/` en
cache et non `/index.html`.

## Point d'attention sur le PRD

**§12.2 décrit un garde-fou qui n'existe pas.** Le PRD affirme que
`./init.sh --check` « refuse l'état par utilisateur en `exposure: public` » et
en conclut que le lot 2 ne peut pas être livré sans desserrer cette règle.
Vérification faite sur `init.sh:1444-1452`, `--check` ne contrôle rien de tel :
il refuse exactement une chose, la présence de la chaîne `x-forwarded-user` dans
un fichier suivi non-`.md` de l'application. Le classement du lot 2, réduit à
des pseudonymes, des scores et un code à 4 chiffres, ne lira jamais cet en-tête
et passera `--check` sans qu'aucune règle soit desserrée. L'ossature §10 tranche
dans le même sens. Le §12.2 est à corriger dans le PRD, il ne bloque personne.

Les deux autres points du §12 restent, eux, entiers : le volume persistant du
classement (§12.1) bloque le PRP 07 et est signalé dans le `README.md` de
l'application comme le contrat l'exige ; la page 3 sur 3 de la note du coach
(§12.3) bloque le PRP 02 avant le 17 août.
