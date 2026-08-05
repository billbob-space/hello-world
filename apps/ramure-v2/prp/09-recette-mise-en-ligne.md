# PRP 09 — Recette bout en bout, et mise en ligne

> **Ce PRP livre** la recette du PRD (§13) — les parcours complets joués dans un
> vrai navigateur, sur **réseau simulé**, dans les deux dispositions — puis le
> **branchement** : `enabled: true`, l'app entre dans `compose.yaml`, et
> `ramure-v2.apps.billbob.ovh` répond. C'est la dernière tâche de la série, et
> elle ne peut pas être avancée.
>
> **Ce PRP consomme** l'application entière, et du PRP 01 l'en-tête
> `X-Ramure-Version`, qui permet d'affirmer en bout en bout que c'est bien la
> version attendue qui est en ligne.
>
> **Ce PRP produit :**
>
> ```
> web/tests/e2e/*.spec.ts
> playwright.config.ts
> web/tests/REFERENCE.md        base de référence des tests (§13)
> apps/ramure-v2/test.sh        réécrit : bout en bout derrière RAMURE_E2E
> apps/ramure-v2/app.yml        enabled: true
> compose.yaml                  un service ramure-v2, régénéré
> ```

**Deux tâches**, dans cet ordre et jamais l'inverse.

---

### Tâche 1 : la recette bout en bout, sur réseau simulé

Porte §13. Le PRD est explicite : **tester contre des sources réelles produit des
échecs intermittents qui finissent par être ignorés**, et masquent alors les
vraies régressions. Toutes les sources sont donc simulées, y compris dans le
navigateur.

**Fichiers :** créer `web/tests/e2e/*.spec.ts`, `playwright.config.ts`,
`web/tests/REFERENCE.md` ; modifier `apps/ramure-v2/test.sh`.

**Parcours à couvrir, dans les deux dispositions :**
planter → promouvoir → remonter la lignée → garder → replanter → partager.

**Pannes simulées, une par cas :** source vide, source en erreur, dépassement de
quota, extraits indisponibles, session expirée.

**Vérifications de géométrie mesurées**, viewport large explicite (1920×1080) :
les traits rejoignent leur cible ; les libellés ne se recouvrent pas ; **le zoom
agrandit bien les illustrations** — comparaison de la largeur rendue de l'image
avant et après zoom, pas seulement du rayon de la pastille. C'est précisément ce
que les tests sur DOM simulé du PRP 08 ne peuvent pas voir.

**Accessibilité automatisée** sur chaque écran, plus la vérification manuelle au
clavier du PRP 08, documentée dans le `README`.

**Intégration à `test.sh` — honnêtement bornée :**

```bash
#!/usr/bin/env bash
# apps/ramure-v2/test.sh
set -euo pipefail
cd "$(dirname "$0")"

npm ci --prefix web
npm run --prefix web build
npm run --prefix web typecheck
npm run --prefix web test

go vet ./...
go test -race -count=1 ./...

# Le bout en bout demande un navigateur : hors CI par defaut, sur demande.
if [ "${RAMURE_E2E:-0}" = 1 ]; then
  npm run --prefix web test:e2e
else
  echo "bout en bout ignore (RAMURE_E2E=1 pour l'activer)"
fi
```

Ce `else` n'est pas un `|| true` déguisé : il dit ce qu'il ne fait pas, et le
dit dans le journal de CI. Un `test.sh` qui prétend avoir tout vérifié est pire
qu'un `test.sh` qui déclare sa limite.

**Conséquence à assumer : ainsi écrit, le bout en bout ne tournera jamais en
CI.** Personne n'y définit `RAMURE_E2E`. Ces tests sont donc une recette qu'on
joue à la main avant une mise en ligne, pas un filet permanent. Deux sorties
possibles, à trancher ici plutôt qu'à découvrir dans six mois : l'assumer — et
l'écrire dans `REFERENCE.md` — ou ajouter au workflow une étape qui installe un
navigateur et pose `RAMURE_E2E=1`, ce qui allonge chaque run de la fabrique
entière, pour toutes les apps.

**Base de référence** (§13) : `web/tests/REFERENCE.md`, tenu à jour, donne le
**nombre de tests attendus au vert** et la liste explicite des échecs connus non
applicatifs — pour qu'aucune équipe ne rouvre deux fois la même enquête. Le
PRP 02 avait fixé le premier repère : 26 fonctions de test dans `internal/`.

- [ ] **Étape 1 : écrire les parcours qui échouent**

- [ ] **Étape 2 : les faire passer, chacun contre son serveur simulé**

- [ ] **Étape 3 : committer**

```bash
RAMURE_E2E=1 ./apps/ramure-v2/test.sh
git commit -m "ramure-v2 : recette bout en bout sur reseau simule"
```

---

### Tâche 2 : le branchement

**Le second des deux commits du contrat de la fabrique** (`CLAUDE.md`) :
construire d'abord, brancher ensuite. Le premier a été fait au PRP 01 ; celui-ci
le referme.

- [ ] **Étape 1 : vérifier que l'image est publiée**

```bash
docker buildx imagetools inspect \
  ghcr.io/billbob-space/hello-world/ramure-v2:main
```

**Sans démon Docker** — le cas d'une session cloud — la même preuve se lit dans
la CI : le job `build` de la fusion précédente doit être au vert sur `main`, et
le paquet `ramure-v2` doit apparaître dans les paquets du dépôt. **Ne pas
activer sur une supposition** : c'est le seul geste de toute la série qui peut
faire tomber les autres applications.

Attendu : le manifeste s'affiche. **Si l'image est absente, ne pas continuer** —
activer une app dont l'image n'existe pas fait échouer le `compose up` de
**toutes** les autres, y compris celles que personne n'a touchées.

- [ ] **Étape 2 : activer et régénérer**

```bash
cd /home/user/hello-world
./init.sh --app ramure-v2 --enable
./init.sh --check
```

- [ ] **Étape 3 : vérifier le bloc généré**

```bash
git diff compose.yaml
```

Attendu : un service `ramure-v2` portant `forwardauth-open` — le middleware du
palier `google`, à ne pas confondre avec `public` —, `mem_limit: 128m`, le volume
`ramure-v2-donnees`, et **aucune section `ports:`**. **Ne rien éditer à la
main :** `compose.yaml` est régénéré, une correction manuelle serait refusée en
CI au commit suivant.

`--check` doit maintenant afficher `volume 'ramure-v2-donnees' : name:
ramure-v2-donnees — le nom reel est le nom documente`.

- [ ] **Étape 4 : committer et pousser**

Ce commit ne touche que deux fichiers — c'est ce qui le rend relisable seul et
révocable seul.

```bash
git add apps/ramure-v2/app.yml compose.yaml
git commit -m "ramure-v2 : entree dans la stack"
git push -u origin "$(git branch --show-current)"
```

- [ ] **Étape 5 : vérifier la mise en ligne**

Compter deux à trois minutes après la fusion sur `main`, puis :

```bash
curl -sI https://ramure-v2.apps.billbob.ovh | head -3
```

Attendu : une redirection vers l'authentification Google pour une requête non
authentifiée — c'est le palier qui fonctionne, pas une panne. Puis, dans un
navigateur authentifié, l'écran d'accueil et son mur de pochettes.

```bash
curl -sI https://ramure-v2.apps.billbob.ovh | grep -i x-ramure-version
```

Attendu : le SHA du commit fusionné. C'est la seule preuve que la version en
ligne est bien celle qu'on croit.

---

## Vérification de l'étape

**1 · La suite complète, bout en bout compris.**

```bash
cd /home/user/hello-world && RAMURE_E2E=1 ./apps/ramure-v2/test.sh
```

**2 · Le contrat de la fabrique, service par service.**

```bash
cd /home/user/hello-world && ./init.sh --check
```

Attendu : `Contrat respecte. Tu peux pousser sur main.`

**3 · L'application est active et présente dans la stack.**

```bash
./init.sh --list | grep ramure-v2
```

Attendu : `ramure-v2  8080  128m  google  go  true  active`.

**4 · Elle répond en ligne, sous la bonne version, et sa collection survit.**
Garder un artiste, attendre un redéploiement, vérifier qu'il est toujours là.
C'est la dernière preuve que le volume nommé fait son travail — et la seule qui
ne puisse pas être obtenue avant la mise en ligne.

**5 · Le coût de la branche est relevé.**

```bash
./scripts/cout.sh
```

Non relevé avant la fusion, il est perdu.

---

## Ce que la suite attend de vous

La série s'arrête ici, mais l'application commence. Quatre points restent
ouverts, et aucun n'est un oubli :

1. **Le seuil N-13 est encore une hypothèse.** Le taux de service du cache est
   désormais mesuré (PRP 07) : relevez-le après quelques jours d'usage réel et
   corrigez le chiffre du README de la série — environ 5 promotions par seconde,
   tous utilisateurs confondus, calculé sur une hypothèse de 80 %.
2. **Le lot V2 reste hors périmètre**, et volontairement : F-18 (reprise de la
   lignée), F-23 (signal de nouveauté), F-27 (palmarès de l'arbre), F-35 (export
   de la collection), filtres complémentaires sur les branches. `apps/ramure`,
   la première version, en couvre déjà une partie : c'est là qu'il faut regarder
   avant de les réécrire.
3. **Le cache ne borne pas sa taille** (décision du PRP 02). Si la mesure montre
   une croissance problématique, l'ajout se fait derrière `Obtenir`, sans changer
   sa signature — et `memory: 128m` se relit dans `app.yml`, jamais dans
   `compose.yaml`.
4. **Odesli n'a pas de limite de débit documentée.** C'est le seul fournisseur
   dont le comportement sous charge est inconnu ; le repli de recherche
   pré-remplie (PRP 03) le rend inoffensif, mais si les liens d'écoute se
   dégradent en masse, c'est là qu'il faut regarder en premier.
