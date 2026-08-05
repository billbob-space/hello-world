# PRP 05 — Le canevas : le MVP se voit

> **Ce PRP livre** l'arbre à l'écran, et le geste qui le fait repousser. C'est
> l'étape où le produit cesse d'être un JSON : géométrie de l'affinité (F-09,
> F-10), rendu SVG et repli d'illustration déterministe (F-38, F-39), caméra
> bornée (F-17, N-02), promotion continue avec lignée et générations (F-11 à
> F-14). Il introduit aussi **la chaîne TypeScript** — c'est le premier PRP qui
> écrit du code client, et le seul qui touche à l'outillage de construction.
>
> **Ce PRP consomme :**
> - du PRP 04 — le contrat de `GET /api/centre` : toujours `200` avec `etat`,
>   `503` en panne totale, `400` sur graine vide ; les héritiers en seconde
>   phase ; `Cadrage` décidé par le serveur à partir de `largeur` ;
> - du PRP 01 — `apps/ramure-v2/web/index.html`, page d'accueil provisoire
>   **qu'il remplace**, et son `//go:embed`. Deux choses doivent survivre au
>   remplacement : le motif de route `GET /{$}` et l'attribut `lang="fr"`,
>   verrouillé par un test.
>
> **Ce PRP produit :**
>
> ```ts
> // web/src/geometrie.ts — pur, testable sans DOM
> export interface Anneau { rayonMin: number; rayonMax: number }
> export interface Taille { min: number; max: number }
> export function rayonPour(affinite: number, a: Anneau): number
> export function taillePour(affinite: number, t: Taille): number
> export function placerBranches(n: number, a: Anneau, affinites: number[]): Array<{x: number; y: number; r: number}>
> export function placerHeritiers(branche: {x: number; y: number}, n: number, ouverture: number): Array<{x: number; y: number}>
>
> // web/src/camera.ts
> export interface Vue { x: number; y: number; echelle: number }
> export const ECHELLE_MIN = 0.4
> export const ECHELLE_MAX = 4
> export function zoomer(v: Vue, facteur: number, pointVise: {x: number; y: number}): Vue
> export function deplacer(v: Vue, dx: number, dy: number): Vue
> export function cadrageNeutre(contenu: Rect, viewport: Rect): Vue
> export function aBouge(v: Vue, neutre: Vue): boolean
>
> // web/src/canevas.ts   rendu SVG dans le DOM
> // web/src/promotion.ts transition, lignée, générations
> // web/src/textes.ts    toutes les chaînes, en un seul endroit
> ```

**Cinq tâches.** La première pose l'outillage, les quatre suivantes forment une
chaîne : géométrie → rendu → caméra → promotion.

---

## Pourquoi du SVG dans le DOM, et pas un `<canvas>`

Décision du README de la série, rappelée ici parce que c'est ce PRP qui la
subit : le canevas est rendu en **SVG dans le DOM**. Un `<canvas>` serait plus
simple à animer et rendrait l'accessibilité au clavier et au lecteur d'écran
(§12, WCAG 2.2 AA sans exception) **presque impossible** — chaque nœud doit être
un élément focalisable portant le nom complet de l'artiste. Le PRP 08 vérifiera
cette propriété ; elle est perdue d'avance si le rendu n'est pas dans le DOM.

---

### Tâche 1 : la chaîne TypeScript, et les cinq pièges de construction

Aucune exigence du PRD n'est close par cette tâche : elle est l'équivalent, pour
le client, de ce que le PRP 01 a fait pour le serveur. Elle est séparée pour la
même raison — un échec ici ne ressemble en rien à un échec applicatif.

**Fichiers :**
- Créer : `apps/ramure-v2/web/package.json`, `web/tsconfig.json`,
  `web/vitest.config.ts`, `web/src/textes.ts`
- Modifier : `apps/ramure-v2/test.sh`, `apps/ramure-v2/Dockerfile`,
  `apps/ramure-v2/.dockerignore`, `apps/ramure-v2/main.go` (`//go:embed`)
- Modifier, **à la main** : `.claude/settings.json`, `.claude/cloud-setup.sh`
  (voir le cinquième piège — ce ne sont pas des artefacts générés)

**Les cinq pièges, dans l'ordre où ils se présentent :**

1. **`.dockerignore` exclut `dist`.** Le fichier écrit par l'échafaudage du
   PRP 01 exclut `dist` et `node_modules` du contexte de construction. Dès que le
   TypeScript est compilé vers `web/dist` pour être embarqué par `go:embed`, **la
   ligne `dist` doit être retirée** : sans cela le répertoire n'entre pas dans le
   contexte, `COPY . .` ne le voit pas, et la construction échoue sur
   `pattern web/dist: no matching files found` — alors que tout fonctionne sur le
   poste, où le répertoire est bien là. `.dockerignore` n'est pas un artefact
   régénéré : il s'édite à la main, une fois. **`node_modules` reste exclu.**
2. **Le `Dockerfile` gagne un étage `node`**, avant l'étage Go : `npm ci` puis
   `npm run build` (esbuild) produisent `web/dist`, que l'étage Go copie avant
   `go build`. L'étage final reste `alpine` + un binaire : **le plafond de 200 Mo
   n'est pas menacé**, à condition que `node_modules` ne soit jamais copié dans
   l'étage final.
3. **`go:embed` ne suit pas les liens et n'accepte pas un répertoire vide.**
   `//go:embed web/dist` échoue à la compilation si `web/dist` n'existe pas —
   donc `go build` seul, sur un poste où `npm run build` n'a pas tourné, ne
   compile plus. `test.sh` doit construire le client **avant** d'appeler `go`.
4. **`test.sh` ne doit jamais rendre vert un job qui ne vérifie rien.**
   `set -euo pipefail`, une commande par outil, aucun `|| true`. Le runner de
   la CI fournit Go **et** Node : `npm ci` y fonctionne sans rien installer.
5. **La fabrique ne connaît qu'un langage par app, et ce sera Go.** Le champ
   `stack:` d'`app.yml` est ce qui fait installer un serveur de langage pour
   l'agent ; il ne prend qu'une valeur. Résultat : à partir de ce PRP, on écrit
   du TypeScript **sans assistance de langage**, et `--check` ne s'en plaint
   pas — il ne réclame que les plugins des `stack:` déclarées. Le remède tient
   en deux gestes, et aucun n'est automatique : ajouter
   `typescript-lsp@claude-plugins-official` à `enabledPlugins` dans
   `.claude/settings.json`, puis **recoller** `.claude/cloud-setup.sh` dans le
   champ *Setup script* de l'environnement — déclarer un plugin ne l'installe
   pas. `gopls` reste en place : il est déclaré par les cinq autres apps Go.

```bash
#!/usr/bin/env bash
# apps/ramure-v2/test.sh
set -euo pipefail
cd "$(dirname "$0")"

npm ci --prefix web
npm run --prefix web build        # esbuild -> web/dist, requis par go:embed
npm run --prefix web typecheck    # tsc --noEmit
npm run --prefix web test         # vitest

go vet ./...
go test -race -count=1 ./...
```

- [ ] **Étape 1 : écrire le test qui échoue**

Un test de bout en bout de la chaîne, pas un test unitaire : depuis la racine du
dépôt, `./apps/ramure-v2/test.sh` doit échouer tant que `web/package.json`
n'existe pas, puis passer une fois la chaîne en place. Ajouter dans
`web/tests/textes.test.ts` un premier test réel — *toutes les chaînes affichées
viennent de `textes.ts`* — pour que `vitest` ait quelque chose à exécuter.

- [ ] **Étape 2 : vérifier l'échec, implémenter, vérifier le vert**

```bash
cd /home/user/hello-world && ./apps/ramure-v2/test.sh
```

Puis, **si un démon Docker est disponible** — il ne l'est pas dans une session
cloud, voir la dernière section du [README de la série](README.md) :

```bash
docker build -t ramure-v2:essai apps/ramure-v2 && \
  docker image inspect ramure-v2:essai --format '{{.Size}}' | awk '{print $1/1024/1024 " Mo"}'
```

Attendu : la suite passe, et l'image reste **sous 200 Mo** (ordre de grandeur
constaté au PRP 01 : une quinzaine). C'est le seul moment où ce plafond se
vérifie vraiment : au-delà, **la CI n'émet qu'un avertissement**, elle ne bloque
pas.

- [ ] **Étape 3 : committer**

```bash
git commit -m "ramure-v2 : chaine TypeScript, esbuild et vitest"
```

---

### Tâche 2 : la géométrie — l'affinité se lit sans texte

Porte F-09 et F-10. Exigence purement visuelle, mais **entièrement testable**
parce que la géométrie est isolée du rendu. Ce fichier et
`internal/arbre/selection.go` (PRP 04) portent les deux exigences les plus
subtiles du produit.

**Fichiers :** créer `web/src/geometrie.ts`, test `web/tests/geometrie.test.ts`.

**Règle F-09 :** distance **et** taille varient toutes deux avec l'affinité, de
façon **monotone** — une affinité plus forte donne un rayon strictement plus
petit et une pastille strictement plus grande. Les deux, jamais une seule : une
seule variable rend l'affinité illisible dès que les pastilles se chevauchent.

```ts
export function rayonPour(affinite: number, a: Anneau): number {
  const f = Math.min(1, Math.max(0, affinite));
  return a.rayonMax - (a.rayonMax - a.rayonMin) * f;
}
export function taillePour(affinite: number, t: Taille): number {
  const f = Math.min(1, Math.max(0, affinite));
  return t.min + (t.max - t.min) * f;
}
```

- [ ] **Étape 1 : écrire les tests qui échouent**

1. `rayon strictement décroissant en affinité` — 100 échantillons croissants.
2. `taille strictement croissante en affinité`.
3. `les deux varient` — un voisin d'affinité 0,9 et un d'affinité 0,1 diffèrent
   sur **les deux** propriétés.
4. `affinité hors bornes est ramenée dans [0,1]`.
5. `les héritiers gravitent autour de leur branche` (F-10) — chaque héritier est
   plus proche de sa branche que de toute autre branche, sur 500 configurations
   aléatoires. **C'est le test qui empêche un héritier d'apparaître détaché ou
   attribuable à la mauvaise branche.**
6. `aucun chevauchement de pastilles` — pour 10 branches, la distance entre deux
   centres dépasse la somme de leurs rayons.

- [ ] **Étapes 2 à 4 : rouge, implémenter, vert, committer**

```bash
git commit -m "ramure-v2 : geometrie du canevas, l'affinite se lit sans texte"
```

---

### Tâche 3 : rendu SVG, liens jointifs et repli d'illustration

Porte §11 « lisibilité », F-38 et F-39.

**Fichiers :** créer `web/src/canevas.ts`, remplacer `web/index.html`, tests
associés.

**Quatre propriétés portées par les tests, jamais par une capture d'écran :**

- **Les liens rejoignent leurs deux extrémités** — le trait part du bord de la
  pastille source et s'arrête au bord de la pastille cible, jamais avant.
  Vérification géométrique sur les coordonnées.
- **Un nom n'est jamais masqué** — les libellés sont rendus après tous les nœuds,
  dans un groupe SVG distinct placé en dernier.
- **Repli d'illustration déterministe** — une illustration absente est remplacée
  par un motif dérivé du nom de l'artiste : même nom, même repli, à chaque fois.
  Il occupe **exactement** la place de l'image, donc son arrivée ne décale rien.
  C'est ce repli qui rend inoffensifs le 404 de Cover Art Archive (PRP 03) et
  une branche sans fiche Deezer.
- **Affichage progressif** (F-39) — le centre et les branches sont rendus avant
  que les illustrations n'arrivent, et les pastilles ont leur **taille finale**
  dès le premier rendu. Les héritiers, chargés en seconde phase par le PRP 04,
  apparaissent sans qu'aucune pastille existante ne bouge.

- [ ] **Étape 1 : écrire les tests qui échouent**

`repli déterministe pour un même nom` ; `l'arrivée d'une image ne change aucune
coordonnée` ; `un lien touche les deux bords` ; `les libellés sont dans le
dernier groupe du SVG` ; `l'arrivée des héritiers ne déplace aucune branche` ;
`index.html porte lang="fr"`.

- [ ] **Étapes 2 à 4**

```bash
git commit -m "ramure-v2 : rendu SVG, liens jointifs et repli deterministe"
```

---

### Tâche 4 : la caméra — zoom borné, centré sur le point visé

Porte F-17, N-02 et la section « caméra » de §11.

**Fichiers :** créer `web/src/camera.ts`, test `web/tests/camera.test.ts`.

**Exigences testées :**

- **Le point visé reste sous le doigt** — après `zoomer`, la coordonnée monde du
  point visé est inchangée à 1e-9 près. C'est le test central : un zoom qui
  dérive rend le canevas impossible à parcourir au doigt, qui est la promesse du
  produit.
- **Le zoom est borné** dans `[ECHELLE_MIN, ECHELLE_MAX]`, quel que soit le
  facteur demandé.
- **Zoom et déplacement sont distincts** — `zoomer` ne modifie jamais la
  translation autrement que pour maintenir le point visé.
- **`aBouge`** est vrai dès que la vue diffère du cadrage neutre : c'est ce qui
  fait apparaître la commande de retour au cadrage neutre.
- **Le zoom agrandit tout, illustrations comprises** — le zoom s'applique par
  `transform` sur le groupe SVG racine, jamais en changeant le rayon des
  pastilles. Test : après un zoom ×2, l'attribut `r` d'une pastille est
  **inchangé**.

- [ ] **Étapes 1 à 4**

```bash
git commit -m "ramure-v2 : camera, zoom borne centre sur le point vise"
```

---

### Tâche 5 : promotion, lignée et réponses tardives

Porte F-11, F-12, F-13, F-14 et la section « transition de promotion » de §11.
C'est **le geste fondamental du produit** (§05) : le reste de l'interface peut
être médiocre sans que le produit disparaisse ; celui-ci, non.

**Fichiers :** créer `web/src/promotion.ts`, tests associés.

**Neuf exigences testées :**

1. **Le nœud choisi reste visible en continu** — l'élément DOM du nœud promu est
   le **même objet** avant et après la transition. Test : conserver la référence,
   vérifier qu'elle est toujours dans le document à la fin. La scène n'est jamais
   reconstruite (F-12).
2. **La génération précédente s'efface sur place** — sa position ne change pas
   pendant la disparition ; seule son opacité varie.
3. **Le nouveau centre est illustré dès son apparition** — l'URL d'illustration
   est reprise du nœud promu, déjà chargée, avant toute nouvelle requête.
4. **Aucun clignotement** — l'attribut `href` de l'image du centre ne repasse
   jamais par une valeur vide.
5. **Gestes rapides** (F-13) — deux promotions enchaînées à 50 ms d'intervalle
   aboutissent au **second** artiste demandé, jamais au premier.
6. **Réponses tardives ignorées** (§09) — un compteur de génération est
   incrémenté à chaque promotion ; une réponse portant une génération périmée est
   **écartée**, pas appliquée au centre courant. Test avec deux promesses
   résolues dans le désordre.
7. **Naviguer dans la lignée pendant une transition** mène à la destination
   demandée (F-13).
8. **La vue ne se recadre que si l'utilisateur l'avait modifiée** — si `aBouge()`
   est faux, la caméra ne bouge pas pendant la promotion.
9. **Mouvement réduit** — sous `prefers-reduced-motion: reduce`, la promotion est
   **appliquée immédiatement, sans délai résiduel**. Test : le centre est à jour
   dans le même tour de boucle, et la durée mesurée est 0. Neutralisée, pas
   accélérée.

**La lignée vit en mémoire et dans l'URL** — décision du README de la série,
question §17 n° 3 : la reprise de la lignée d'une session à l'autre (F-18) est en
lot V2, hors périmètre.

- [ ] **Étapes 1 à 4**

```bash
git commit -m "ramure-v2 : promotion continue, lignee et generations"
```

---

## Vérification de l'étape

**1 · Les deux suites passent, et la chaîne de construction tient.**

```bash
cd /home/user/hello-world && ./apps/ramure-v2/test.sh
```

**2 · L'arbre s'affiche et se parcourt vraiment.** Serveur local, puis un
navigateur sur `http://localhost:8080/?graine=Portishead` : un centre illustré,
dix branches dont les plus proches sont plus grosses et plus près, un clic qui
promeut sans que l'écran clignote.

**3 · L'image se construit toujours, et sous le plafond.**

```bash
docker build -t ramure-v2:essai apps/ramure-v2 && \
  docker image inspect ramure-v2:essai --format '{{.Size}}' | awk '{print $1/1024/1024 " Mo"}'
```

Attendu : moins de 200 Mo, et **aucun `node_modules` dans l'étage final**.
Sans démon Docker, cette vérification passe la main au job `build` de la CI,
qui construit la même image sur la pull request — mais qui, sur la taille, ne
fait qu'avertir.

**4 · Le contrat de la fabrique tient.**

```bash
cd /home/user/hello-world && ./init.sh --check
```

---

## Ce que la suite attend de vous

1. **`textes.ts` est le seul endroit où vivent des chaînes affichées.** Le PRD
   est francophone et son vocabulaire (§05) est contractuel ; la centralisation
   ne sert pas à traduire aujourd'hui, elle sert à ne pas fermer la porte. Le
   PRP 08 y vérifiera qu'aucune chaîne n'a fui dans le rendu.
2. **La géométrie est pure, elle doit le rester.** Un accès au DOM dans
   `geometrie.ts` rendrait F-09 et F-10 non testables sans navigateur, et le
   PRP 09 devrait les vérifier au bout en bout — c'est-à-dire mal.
3. **Le compteur de génération est le garde-fou des réponses tardives.** Les
   PRP 06 et 07 ajoutent des requêtes (suggestions, collection) : elles doivent
   passer par le même mécanisme, sinon une réponse de recherche périmée écrasera
   un centre courant.
4. **L'outillage TypeScript est déclaré, pas installé.** Si le rapport
   d'ouverture de session annonce moins de serveurs de langage que prévu, c'est
   que le *Setup script* de l'environnement n'a pas été recollé. C'est sans
   effet sur le déploiement, et très coûteux sur la vitesse d'écriture.
5. **La parité stricte n'est pas encore vérifiée.** Ce PRP rend l'arbre aux deux
   largeurs, mais c'est le PRP 08 qui teste qu'aucun contrôle n'existe en double.
   N'introduisez pas de variante « mobile » d'un contrôle existant : elle serait
   à défaire.
