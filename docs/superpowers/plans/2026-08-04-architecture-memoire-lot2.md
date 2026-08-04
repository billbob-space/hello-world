# Lot 2 — l'outillage cesse d'être généré : plan d'implémentation

> **Pour un agent exécutant :** SOUS-COMPÉTENCE REQUISE — utilise
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes sont en cases à cocher (`- [ ]`).

**But :** sortir neuf artefacts d'`init.sh` — le workflow de CI, les deux
hooks, les deux scripts d'outillage, les réglages Claude, les deux agents, le
gabarit de PR — pour qu'ils deviennent des fichiers ordinaires, édités
directement, sans passer par un générateur ni par la comparaison octet à octet
qui le tenait à jour. `compose.yaml` et `go.work` restent seuls générés.

**Architecture :** `--check` cesse de comparer ces neuf fichiers à ce
qu'`init.sh` écrirait, et vérifie à la place une propriété utile — le fichier
existe, porte le bit exécutable s'il doit s'exécuter, ne contient plus de
valeur figée là où une valeur vivante est attendue. Les quatre valeurs de
`fabrique.yml` que le workflow utilisait (`registry`, `org`, `repo`,
`image_max_mb`) sont lues **au moment du run**, par une étape shell, au lieu
d'être recopiées à la génération.

**Outillage :** bash 4, aucune dépendance nouvelle — le job GitHub Actions
tourne sur `ubuntu-latest`, mais le shell qui y lit `fabrique.yml` reste le
même `sed` minimal que le reste du dépôt, pour que la même logique serve des
deux côtés.

**Écart découvert en préparant ce plan, à traiter dedans :** le contrat
(`CLAUDE.md`) et deux fichiers de `memory/` (`outillage.md`, `travail.md`)
affirment aujourd'hui que ces neuf fichiers sont générés — « Générés par
`init.sh`... et `--check` refuse qu'ils divergent de leur générateur » pour
les hooks, « `--add` réécrit... `.claude/` » pour le contrat. Une fois ce lot
posé, ces phrases deviennent fausses. Les corriger fait partie du lot, pas
un suivi : un contrat qui décrit un comportement que le code n'a plus est
exactement l'anomalie que le lot 1 vient de traiter ailleurs dans le dépôt.

**Un deuxième écart, dans les fichiers eux-mêmes :** cinq d'entre eux portent
un en-tête « Genere par init.sh » ou « NE PAS EDITER », qui devient faux dans
le fichier qu'il habite. Deux autres (`.claude/agents/analyste.md` et
`greffier.md`) portent la liste des apps courantes en toutes lettres
(`cadran hello-world ramure`), écrite par le générateur au moment où lot 1 a
été produit — exacte aujourd'hui, fausse dès la prochaine app ajoutée ou
retirée si rien ne la corrige plus. Les deux écarts sont traités fichier par
fichier ci-dessous, pas comme un correctif à part.

## Contraintes globales

- **`init.sh` s'écrit sans accents**, commentaires comme messages. Les
  fichiers modifiés qui ne sont pas du bash (JSON, YAML, Markdown) suivent
  leur propre convention existante, inchangée par ce lot.
- **Aucune dépendance nouvelle**, ni côté dépôt ni côté CI : le nouveau step
  qui lit `fabrique.yml` dans le workflow utilise `sed`, déjà présent sur
  `ubuntu-latest` et déjà la méthode du reste du dépôt.
- **`compose.yaml` et `go.work` ne changent pas de statut** : ils restent
  générés, comparés, réécrits à chaque `./init.sh`. Ce lot ne les touche pas.
- **Le contenu des fichiers qui deviennent ordinaires ne change de sens
  nulle part**, seulement de statut (généré → édité) et des passages
  explicitement listés ci-dessous (en-têtes, listes figées). Un déplacement
  ou un changement de statut doit se relire comme tel.
- **Un commit par étape vérifiée**, `./init.sh --pret` avant chaque commit.
- **Le journal de la branche se remplit au fil du travail** :
  `journal/2026-08-04-claude-factory-memory-architecture-m0dpb5.md` — déjà
  ouvert, déjà porteur des anomalies du lot 1 ; ce lot y ajoute les siennes à
  la suite, sans rouvrir de nouvelle entrée.

## Structure des fichiers

**Modifiés — deviennent ordinaires, contenu ajusté :**

| Fichier | Ce qui change dans son contenu |
|---|---|
| `.github/workflows/build.yml` | en-tête ; `toutes` calculé au run ; `registry`/`org`/`repo`/`image_max_mb` lus depuis `fabrique.yml` par un nouveau step, référencés via `needs.detect.outputs.*` |
| `.claude/settings.json` | aucun — contenu déjà correct, seul le statut change |
| `.claude/check-plugins.sh` | en-tête ; la phrase « puis ./init.sh » |
| `.claude/cloud-setup.sh` | en-tête ; le paragraphe qui promet une resynchronisation par `./init.sh` |
| `.claude/garde-branche.sh` | en-tête seul |
| `.claude/garde-commit.sh` | en-tête seul |
| `.claude/agents/analyste.md` | aucun — pas de liste d'apps, pas d'en-tête « généré » |
| `.claude/agents/greffier.md` | la phrase qui énumère les apps en toutes lettres |
| `.github/pull_request_template.md` | aucun |
| `CLAUDE.md` | trois passages qui décrivent `.claude/` et le workflow comme réécrits |
| `memory/outillage.md` | quatre passages sur la génération de `settings.json` et `cloud-setup.sh` |
| `memory/travail.md` | un passage sur la génération des deux hooks |

**Modifié — le générateur lui-même :**

`init.sh` : suppression de neuf fonctions `emit_*` (≈600 lignes), de leurs
neuf entrées dans `DERIVES` et dans le dispatcher `emit()` ; ajout de
vérifications de propriété dans `--check` (≈40 lignes) ; une ligne de message
corrigée (« lance ./init.sh » devient faux pour `settings.json` absent).
Cible : 3 934 → environ 3 400 lignes après ce lot — l'estimation initiale de
2 900 dans la conception ne comptait pas les lignes de vérification à ajouter
en échange de celles supprimées ; le solde net reste une forte réduction.

**Non modifiés :** `compose.yaml`, `fabrique.yml`, `go.work`, `apps/`,
`memory/*.md` autres que les deux cités, `.claude/settings.local.json`.

---

### Tâche 1 : le workflow de CI devient un fichier ordinaire, sans valeur figée

**Fichiers :**
- Modifier : `.github/workflows/build.yml`
- Modifier : `init.sh` (suppression d'`emit_build_workflow`, de son entrée
  `DERIVES` et `emit()` ; ajout de deux vérifications de propriété)

**Interfaces :**
- Produit : les nouvelles sorties du job `detect` —
  `needs.detect.outputs.registry`, `.org`, `.repo`, `.image_max_mb` —
  consommées par les jobs `build` et `deploy` du même fichier.

- [ ] **Étape 1 : écrire le test négatif — le workflow ne dépend plus de rien, et rien ne le vérifie**

Avant toute édition, montrer que la garantie actuelle est purement mécanique
(comparaison octet à octet) et qu'aucun contrôle ne porterait sur le contenu
si cette comparaison disparaissait sans rien pour la remplacer :

```bash
grep -c 'needs.detect.outputs.registry' .github/workflows/build.yml
```

Attendu : `0` — le fichier ne lit aujourd'hui rien à l'exécution, tout est
figé à la génération. C'est l'état que l'étape 3 doit inverser, et l'étape 5
doit vérifier.

- [ ] **Étape 2 : remplacer le contenu de `.github/workflows/build.yml`**

Remplacer le fichier entier par ce contenu — identique au précédent sauf
l'en-tête, les sorties et le step `fab` du job `detect`, le calcul de
`toutes`, et les quatre points d'usage de `registry`/`org`/`repo`/
`image_max_mb` dans `build` et `deploy` :

```yaml
# Fichier ordinaire, edite directement. Aucune valeur de fabrique.yml n'y est
# figee : le job detect les relit a chaque run et les publie en sortie ; les
# jobs build et deploy les consomment via needs.detect.outputs.*. ./init.sh
# --check verifie que ce fichier existe, que son job contrat lance
# ./init.sh --check, et qu'aucune occurrence figee du registre, de l'org ou
# du depot ne s'y est glissee.
name: build

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      toutes:
        description: reconstruire toutes les apps
        type: boolean
        default: false

# Une seule stack dockhand : deux deploiements concurrents se marcheraient
# dessus. On serialise sans annuler — un deploiement engage doit finir.
concurrency:
  group: fabrique-${{ github.ref }}
  cancel-in-progress: false

jobs:
  # Le contrat devient un verrou de CI, et non plus un geste manuel : avec une
  # stack partagee, un compose faux fusionne casse toutes les apps a la fois.
  contrat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./init.sh --check

  detect:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.choix.outputs.apps }}
      deploy: ${{ steps.choix.outputs.deploy }}
      registry: ${{ steps.fab.outputs.registry }}
      org: ${{ steps.fab.outputs.org }}
      repo: ${{ steps.fab.outputs.repo }}
      image_max_mb: ${{ steps.fab.outputs.image_max_mb }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # Ces quatre valeurs vivaient recopiees dans ce fichier a la generation.
      # Les relire ici, a chaque run, c'est ce qui permet a ce fichier de ne
      # plus dependre d'un generateur : un changement dans fabrique.yml se voit
      # au prochain run, sans repasser par ./init.sh.
      - id: fab
        run: |
          set -euo pipefail
          val() { sed -nE "s/^$1:[[:space:]]*([^[:space:]#]+).*/\1/p" fabrique.yml; }
          echo "registry=$(val registry)"       >> "$GITHUB_OUTPUT"
          echo "org=$(val org)"                 >> "$GITHUB_OUTPUT"
          echo "repo=$(val repo)"                >> "$GITHUB_OUTPUT"
          echo "image_max_mb=$(val image_max_mb)" >> "$GITHUB_OUTPUT"
      - id: choix
        env:
          EVENT: ${{ github.event_name }}
          TOUTES: ${{ inputs.toutes }}
          AVANT: ${{ github.event.before }}
          BASE_PR: ${{ github.event.pull_request.base.sha }}
          APRES: ${{ github.sha }}
        run: |
          set -euo pipefail
          # La liste complete des apps, activees ou non : la CI les teste et
          # les construit sans egard a enabled, qui ne pilote que le compose.
          # Calculee ici plutot que figee a la generation.
          liste_toutes=$(for d in apps/*/; do
                           a="${d%/}"; a="${a#apps/}"
                           [ -f "apps/$a/app.yml" ] && printf '%s\n' "$a"
                         done)
          toutes='[]'
          if [ -n "$liste_toutes" ]; then
            toutes="[$(printf '%s\n' "$liste_toutes" | sed 's/.*/"&"/' | paste -sd, -)]"
          fi

          if [ "$EVENT" = pull_request ]; then base="$BASE_PR"; else base="$AVANT"; fi

          # Une base absente du depot — premiere poussee d'une branche, greffe,
          # force-push — donnerait un diff vide. On reconstruit tout plutot que
          # de ne rien construire en silence.
          tout=0
          if [ "$EVENT" = workflow_dispatch ] && [ "$TOUTES" = true ]; then
            tout=1
          elif [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
            echo "base de comparaison indisponible ($base) — reconstruction complete"
            tout=1
          fi

          if [ "$tout" = 1 ]; then
            apps="$toutes"; deploy=true
          else
            changed=$(git diff --name-only "$base" "$APRES")
            echo "fichiers modifies :"; printf '  %s\n' $changed

            if printf '%s\n' "$changed" | grep -qE '^(init\.sh|fabrique\.yml|\.github/workflows/)'; then
              # Le generateur ou la CI ont bouge : plus rien ne garantit que les
              # images publiees correspondent aux Dockerfile courants.
              apps="$toutes"
            else
              # Un repertoire sous apps/ n'est une application que s'il porte un
              # app.yml : c'est la definition qu'applique discover_apps, et la
              # seule qui vaille. Un chemin ne suffit pas. Sans ce filtre, un
              # fichier depose sous apps/<nom>/ avant que l'application n'existe
              # — une specification, une note — fait reclamer a la CI le test.sh
              # et le Dockerfile d'une app qui n'est pas encore ecrite, et le
              # job echoue sur un repertoire de documentation.
              # Le filtre porte sur l'arbre APRES le commit : une app ajoutee
              # dans ce meme commit a deja son app.yml et reste donc detectee,
              # ce qui fait bien construire sa premiere image.
              # Un if, et non « [ -f ] && printf » : l'etape tourne sous set -e,
              # un test faux ferait sortir la boucle en code 1 et echouer le job.
              liste=$(printf '%s\n' "$changed" | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u \
                        | while IFS= read -r a; do
                            if [ -f "apps/$a/app.yml" ]; then printf '%s\n' "$a"; fi
                          done)
              if [ -n "$liste" ]; then
                apps="[$(printf '%s\n' "$liste" | sed 's/.*/"&"/' | paste -sd, -)]"
              else
                apps='[]'
              fi
            fi

            # Redeployer seulement si une image change ou si le compose change :
            # sinon un commit de documentation redemarrerait toute la stack.
            if [ "$apps" != '[]' ] || printf '%s\n' "$changed" | grep -qx 'compose.yaml'; then
              deploy=true
            else
              deploy=false
            fi
          fi

          echo "apps=$apps"     >> "$GITHUB_OUTPUT"
          echo "deploy=$deploy" >> "$GITHUB_OUTPUT"
          echo "-> apps : $apps   deploy : $deploy"

  # Une matrice vide fait echouer le job : d'ou le garde sur '[]'.
  test:
    needs: [contrat, detect]
    if: needs.detect.outputs.apps != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: ${{ fromJSON(needs.detect.outputs.apps) }}
    steps:
      - uses: actions/checkout@v4
      # Chaque app dit comment elle se teste dans un executable, comme elle dit
      # comment elle se construit dans un Dockerfile : la fabrique n'a pas a
      # connaitre les langages. Le runner fournit Go, Node, Python et Java ;
      # pour une autre chaine, testez dans un etage du Dockerfile.
      - name: tests de ${{ matrix.app }}
        run: ./apps/${{ matrix.app }}/test.sh

  build:
    needs: [contrat, detect, test]
    if: needs.detect.outputs.apps != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      fail-fast: false
      matrix:
        app: ${{ fromJSON(needs.detect.outputs.apps) }}
    steps:
      - uses: actions/checkout@v4
      # Sans buildx, le driver par defaut est 'docker', qui ne sait pas
      # exporter de cache : le cache-to gha plus bas ferait echouer la
      # construction avant meme de lire le Dockerfile.
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ needs.detect.outputs.registry }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # CONSTRUIRE D'ABORD EN LOCAL, PUBLIER ENSUITE. Entre les deux se glisse le
      # seul controle capable de voir les labels de l'IMAGE. Docker fusionne dans
      # les labels du conteneur ceux qui sont graves dans l'image — y compris
      # ceux HERITES d'une image de BASE ou poses par un etage intermediaire, que
      # la lecture de apps/<app>/Dockerfile faite par « ./init.sh --check » ne
      # peut pas voir. Un « traefik.* » grave la publierait un routeur
      # SUPPLEMENTAIRE : il porte un autre nom que celui de compose.yaml, donc le
      # compose ne l'ecrase pas, et il arrive SANS middleware d'authentification —
      # constate avec Traefik 3.7.10. Le service principal, lui, est route :
      # traefik.enable=false ne le couvre pas, ce controle est sa seule parade.
      # L'etape de publication ci-dessous repart de ce cache : rien n'est
      # reconstruit, et surtout pas une image differente de celle qu'on inspecte.
      - name: construire ${{ matrix.app }} sans publier
        uses: docker/build-push-action@v6
        with:
          # Contexte reduit a l'app : c'est ce qui isole les constructions les
          # unes des autres et empeche une edition dans une app d'invalider le
          # cache de couches des autres.
          context: apps/${{ matrix.app }}
          file: apps/${{ matrix.app }}/Dockerfile
          # Sur une pull request on construit sans publier : la validation du
          # Dockerfile ne doit pas bouger le tag :main que le serveur suit.
          push: ${{ github.event_name != 'pull_request' }}
          # ... mais l'image doit alors entrer dans le demon local, sinon
          # l'etape suivante n'a rien a inspecter sur une pull request : sans
          # publication, l'image reste dans le cache de buildx, invisible a
          # « docker image inspect ». push et load s'excluent — jamais vrais
          # ensemble ici, c'est la meme condition inversee.
          load: ${{ github.event_name == 'pull_request' }}
          tags: |
            ${{ needs.detect.outputs.registry }}/${{ needs.detect.outputs.org }}/${{ needs.detect.outputs.repo }}/${{ matrix.app }}:main
            ${{ needs.detect.outputs.registry }}/${{ needs.detect.outputs.org }}/${{ needs.detect.outputs.repo }}/${{ matrix.app }}:${{ github.sha }}
          # Rattache le paquet au depot : ses permissions suivent alors celles
          # du depot, et un seul identifiant de lecture couvre toutes les apps.
          labels: |
            org.opencontainers.image.source=https://github.com/${{ needs.detect.outputs.org }}/${{ needs.detect.outputs.repo }}
          # Identifie la version deployee ; le Dockerfile en fait ce qu'il veut,
          # l'ignorer est sans consequence.
          build-args: |
            VERSION=${{ github.sha }}
          # Le scope est obligatoire en matrice : sans lui les constructions
          # paralleles se disputent un cache unique et s'evincent l'une l'autre.
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
      # Deux controles sur l'image finie, la seule chose que le serveur tirera.
      # Sur une pull request elle vient de « load », sur main du registre.
      - name: labels et taille de l'image
        run: |
          set -euo pipefail
          image=${{ needs.detect.outputs.registry }}/${{ needs.detect.outputs.org }}/${{ needs.detect.outputs.repo }}/${{ matrix.app }}:main
          if [ "${{ github.event_name }}" != pull_request ]; then
            docker pull "$image"
          fi

          # Le contrat interdit tout LABEL traefik.* dans un Dockerfile, et
          # --check le verifie. Mais il lit le Dockerfile, ou un label HERITE
          # d'une image de base n'apparait pas. Docker fusionne pourtant les
          # labels de l'image dans ceux du conteneur : le routeur ainsi publie
          # porte un autre nom que celui du compose, donc le compose ne peut
          # pas l'ecraser — il vivrait SANS middleware d'authentification.
          # L'image construite est le seul endroit ou un label herite se voit.
          # L'inspection est isolee du filtre, et c'est tout l'interet : dans
          # « inspect | grep ... || true », le « || true » couvre le PIPELINE
          # ENTIER. Une inspection en echec — image absente, tag mal forme,
          # demon indisponible — rendait alors une liste vide, indiscernable
          # d'une image saine, et le garde-fou annoncait « aucun label » en
          # sortant en succes. Un controle de securite qui echoue en ouvert est
          # pire que pas de controle : il rassure. Ici l'affectation echoue sous
          # « set -e » et l'etape s'arrete ; le « || true » ne couvre plus que
          # grep, dont le code 1 signifie « aucune correspondance », seul cas
          # ou l'absence de resultat est une bonne nouvelle.
          labels=$(docker image inspect "$image" \
                     --format '{{range $k, $v := .Config.Labels}}{{println $k}}{{end}}')
          graves=$(printf '%s\n' "$labels" | grep -iE '^traefik\.' || true)
          if [ -n "$graves" ]; then
            printf '::error::LABEL traefik grave dans l image ${{ matrix.app }} : %s\n' $graves
            echo "::error::Docker le fusionnerait dans les labels du conteneur et publierait un routeur SUPPLEMENTAIRE, sans authentification. Retire-le du Dockerfile, ou change d image de base : ce label n est pas ecrasable depuis le compose."
            exit 1
          fi
          echo "aucun label traefik.* — ni ecrit dans le Dockerfile, ni herite de l image de base"

          size=$(docker image inspect "$image" --format '{{.Size}}')
          echo "Image ${{ matrix.app }} : $((size / 1024 / 1024)) Mo"
          if [ "$size" -gt $(( ${{ needs.detect.outputs.image_max_mb }} * 1024 * 1024 )) ]; then
            echo "::warning::image au-dela de ${{ needs.detect.outputs.image_max_mb }} Mo — le serveur est a 92 % de disque"
          fi

  deploy:
    needs: [contrat, detect, test, build]
    # « sauté » et « échoué » doivent se distinguer : un build saute (rien a
    # reconstruire, mais le compose a change) doit laisser passer, un build en
    # echec doit bloquer. Sinon un commit a moitie construit referencerait une
    # image inexistante et emporterait les apps saines.
    if: >-
      always()
      && github.event_name == 'push'
      && github.ref == 'refs/heads/main'
      && needs.detect.outputs.deploy == 'true'
      && needs.contrat.result == 'success'
      && needs.detect.result == 'success'
      && (needs.test.result == 'success' || needs.test.result == 'skipped')
      && (needs.build.result == 'success' || needs.build.result == 'skipped')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ needs.detect.outputs.registry }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Garde-fou propre a la stack unique : « docker compose up » est atomique
      # pour la stack entiere. Une seule image absente du registre le fait
      # echouer et emporte les applications saines. On verifie donc chaque
      # reference du compose AVANT d'appeler le webhook — le pire cas devient
      # « rien n'est deploye » au lieu de « tout tombe ».
      - name: toutes les images du compose sont tirables
        run: |
          set -euo pipefail
          # sort -u : la meme image peut etre referencee par plusieurs services
          # — une app et son worker partagent la leur — et l'inspecter deux fois
          # ne prouve rien de plus.
          mapfile -t images < <(sed -nE 's/^[[:space:]]*image:[[:space:]]*(.*)$/\1/p' compose.yaml | LC_ALL=C sort -u)
          if [ ${#images[@]} -eq 0 ]; then
            echo "::error::aucune image dans compose.yaml — la stack ne deploierait rien"
            exit 1
          fi
          # TOUTES les images sont verifiees, les TIERCES COMPRISES, et un echec
          # bloque. « docker buildx imagetools inspect » interroge le registre en
          # ANONYME quand il n'a pas d'identifiants, et l'inspection d'une image
          # publique aboutit sans login — mesure, docker deconnecte de tout
          # registre : l'inspection de valkey/valkey:8-alpine sort en 0, la meme
          # avec une faute de frappe sort en 1. Une image tierce mal
          # orthographiee ou disparue ferait echouer le « docker compose up »,
          # atomique pour la stack entiere : la laisser passer, c'est deployer
          # une fabrique qui tombe TOUTE. Une image tierce reellement privee est
          # le seul faux positif possible, et elle n'aurait de toute facon pas sa
          # place dans un compose que le serveur tire sans identifiants.
          manquantes=()
          for img in "${images[@]}"; do
            if docker buildx imagetools inspect "$img" >/dev/null 2>&1; then
              echo "  ok   $img"
            else
              echo "  KO   $img"
              manquantes+=("$img")
            fi
          done
          if [ ${#manquantes[@]} -gt 0 ]; then
            printf '::error::image introuvable dans son registre : %s\n' "${manquantes[@]}"
            echo "::error::deploiement refuse — il ferait tomber toutes les apps de la stack"
            exit 1
          fi
          echo "${#images[@]} image(s) distincte(s) verifiee(s)"

      # Le tag :main est mutable : une image reconstruite ne change pas une
      # ligne du compose, donc l'auto-sync de dockhand ne voit aucun diff et ne
      # redeploie rien. C'est cet appel, apres publication, qui declenche le
      # deploiement — et il vient apres pour que le serveur tire bien la
      # nouvelle image, pas celle d'avant.
      #
      # L'URL est une URL de capacite : qui la connait declenche un
      # deploiement. Elle vit dans un secret du depot, jamais dans ce fichier.
      - name: declencher le deploiement
        env:
          WEBHOOK: ${{ secrets.DOCKHAND_DEPLOY_WEBHOOK }}
          WEBHOOK_SECRET: ${{ secrets.DOCKHAND_WEBHOOK_SECRET }}
        run: |
          if [ -z "$WEBHOOK" ]; then
            echo "::warning::secret DOCKHAND_DEPLOY_WEBHOOK absent — images publiees, deploiement NON declenche"
            exit 0
          fi

          # Un secret colle porte souvent un retour a la ligne invisible. Il
          # casserait la signature comme le jeton, pour un 403 indistinguable
          # d'un mauvais secret.
          secret=$(printf '%s' "$WEBHOOK_SECRET" | tr -d '\r\n')

          # Recette documentee par dockhand pour une CI generique : POST d'un
          # corps quelconque, signe en HMAC-SHA256. Le corps ne sert pas au
          # serveur, qui relit le depot lui-meme ; seule la signature compte.
          payload='{}'
          if [ -n "$secret" ]; then
            sig=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $NF}')
            set -- -H "x-hub-signature-256: sha256=$sig"
          else
            echo "::warning::secret DOCKHAND_WEBHOOK_SECRET absent — appel non signe, il sera refuse"
            set --
          fi

          code=$(curl -sS -o reponse.txt -w '%{http_code}' --retry 3 --retry-delay 5 \
                   -X POST "$WEBHOOK" -H 'content-type: application/json' "$@" -d "$payload")
          echo "reponse HTTP $code :"
          cat reponse.txt; echo

          if [ "$code" = 403 ]; then
            echo "::error::403 — le secret envoye ne correspond pas a celui configure sur la stack dockhand"
            exit 1
          fi
          if [ "$code" -ge 400 ]; then
            echo "::error::le webhook a refuse l'appel — images publiees, rien n'est deploye"
            exit 1
          fi

          # dockhand ne redeploie que s'il voit un commit nouveau. Le tag :main
          # etant mutable, une image reconstruite sans commit le fait sauter le
          # deploiement, en repondant 200 : sans ce test, la CI serait verte et
          # le serveur servirait toujours les images d'avant.
          if grep -q '"skipped":[[:space:]]*true' reponse.txt; then
            echo "::error::dockhand a saute le deploiement (aucun commit nouveau vu)."
            echo "::error::Active « Force redeployment » dans les Deploy options de la stack. « Re-pull images » n'est pas necessaire : pull_policy: always le couvre depuis le depot."
            exit 1
          fi
          echo "deploiement declenche"
```

Note pour qui exécute cette étape : le seul contenu réellement nouveau est le
step `fab` du job `detect`, le calcul de `liste_toutes`/`toutes`, et les
quatre substitutions `${{ needs.detect.outputs.* }}` dans `build` et
`deploy`. Tout le reste — commentaires compris — est recopié à l'identique
depuis le fichier actuel : un diff qui touche une ligne de logique de
`choix` en dehors de ces points est une erreur de recopie, pas une
simplification voulue.

- [ ] **Étape 2bis : supprimer `emit_build_workflow` et son branchement**

Dans `init.sh` :
- retirer la fonction `emit_build_workflow` en entier (de
  `emit_build_workflow() {` jusqu'à son `}` fermant, juste avant
  `emit_settings()`) ;
- retirer `.github/workflows/build.yml)  emit_build_workflow ;;` du
  dispatcher `emit()` ;
- retirer `.github/workflows/build.yml` du tableau `DERIVES`.

- [ ] **Étape 3 : écrire les deux vérifications de propriété**

Dans la section `-- artefacts derives` du `--check`, juste après la boucle
qui compare les éléments de `DERIVES` (celle qui se termine par
`bad "$f desynchronise des manifestes..."`), ajouter :

```bash
  # Le workflow n'est plus compare a un generateur : il verifie a la place
  # deux proprietes qui, ensemble, prouvent qu'il lit fabrique.yml au run
  # plutot que de porter une copie figee. La premiere aurait manque le lot 1
  # de ce meme travail si elle avait existe avant : le job contrat est ce qui
  # fait de --check un verrou de CI et non un geste manuel.
  WORKFLOW=.github/workflows/build.yml
  if [ -f "$WORKFLOW" ]; then
    grep -qE '^\s*contrat:' "$WORKFLOW" && grep -qF './init.sh --check' "$WORKFLOW" \
      && ok "$WORKFLOW : le job contrat lance ./init.sh --check" \
      || bad "$WORKFLOW : pas de job contrat qui lance ./init.sh --check"
    fige="$REGISTRY/$ORG/$REPO/"
    if grep -qF "$fige" "$WORKFLOW"; then
      bad "$WORKFLOW : '$fige' figee dans le fichier — un changement de fabrique.yml la rendrait fausse en silence"
    else
      ok "$WORKFLOW : aucune occurrence figee du registre, de l'org ou du depot"
    fi
  else
    bad "$WORKFLOW absent"
  fi
```

Poser ce bloc **après** la fin de la boucle `for f in "${DERIVES[@]}"; do
... done` et avant la fermeture du `if [ "$nprobs" -gt 0 ]` qui l'entoure —
même garde que le reste de la section : sauté si les manifestes sont déjà en
échec, pour ne pas empiler une seconde raison sur la même cause.

- [ ] **Étape 4 : constater les deux refus, un par un**

```bash
sed -i 's#run: ./init.sh --check#run: echo pas de check#' .github/workflows/build.yml
./init.sh --check 2>&1 | grep 'contrat'      # attendu : KO, pas de job contrat...
git checkout -- .github/workflows/build.yml  # ou refaire l'etape 2 si deja commite ailleurs

sed -i "s#\${{ needs.detect.outputs.registry }}#ghcr.io#; s#\${{ needs.detect.outputs.org }}#billbob-space#; s#\${{ needs.detect.outputs.repo }}#hello-world#" .github/workflows/build.yml
./init.sh --check 2>&1 | grep 'figee'        # attendu : KO, 'ghcr.io/billbob-space/hello-world/' figee...
```

Restaurer le fichier de l'étape 2 après ce test — ne pas laisser la version
figée committée.

- [ ] **Étape 5 : vérifier et committer**

```bash
./init.sh --check    # attendu : les deux ok, vert
git diff --stat .github/workflows/build.yml init.sh
```

Le diff du workflow doit être petit et localisé (en-tête, step `fab`, calcul
de `toutes`, quatre lignes de substitution) — un diff qui touche par ailleurs
la logique de `choix` ou des jobs `test`/`build`/`deploy` est une erreur de
recopie à corriger avant de committer.

```bash
./init.sh --pret
git add .github/workflows/build.yml init.sh
git commit -m "outillage : le workflow de CI lit fabrique.yml au run, n'est plus genere"
git push
```

---

### Tâche 2 : les hooks et scripts d'outillage deviennent ordinaires

**Fichiers :**
- Modifier : `.claude/garde-branche.sh`, `.claude/garde-commit.sh`,
  `.claude/check-plugins.sh`, `.claude/cloud-setup.sh` (en-têtes, deux
  phrases obsolètes)
- Inchangé en contenu, changé en statut : `.claude/settings.json`
- Modifier : `init.sh` (suppression de quatre fonctions `emit_*` et
  d'`emit_settings`, de leurs entrées `DERIVES`/`emit()` ; ajout de deux
  vérifications d'existence/exécutable, d'un avertissement sur
  `settings.json`, correction d'un message)

**Interfaces :**
- Consomme : `PLUGIN_IDS`, `LSP_BINS` — déjà calculés par `compute_tooling`,
  inchangé par ce lot, toujours nécessaires aux vérifications qui restent.

- [ ] **Étape 1 : corriger les cinq en-têtes qui deviennent faux**

Dans `.claude/garde-branche.sh` et `.claude/garde-commit.sh`, la troisième
ligne de chaque fichier :

```
# Genere par init.sh — hook PreToolUse : refuse d'ecrire directement sur main.
```

devient :

```
# Hook PreToolUse : refuse d'ecrire directement sur main.
```

(et le pendant côté `garde-commit.sh` : « Genere par init.sh — hook Stop :
refuse... » devient « Hook Stop : refuse... », deuxième ligne comprise —
elle continue le commentaire sur la ligne suivante, à garder telle quelle).

Dans `.claude/check-plugins.sh`, ligne 3 :

```
# Genere par init.sh — rapport d'outillage, lance par le hook SessionStart.
```

devient :

```
# Rapport d'outillage, lance par le hook SessionStart.
```

et ligne 15 :

```
# Pour changer la liste : edite stack/ui dans un apps/*/app.yml, puis ./init.sh
```

devient :

```
# Pour changer la liste : edite directement PLUGINS et TRIPLETS ci-dessous.
```

Dans `.claude/cloud-setup.sh`, ligne 3 :

```
# Genere par init.sh — A COLLER dans le champ "Setup script" de l'environnement
```

devient :

```
# Fichier ordinaire, a COLLER dans le champ "Setup script" de l'environnement
```

et les lignes 21-22 :

```
# Cette liste vit hors du depot : apres un ./init.sh qui change une stack ou un
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.
```

deviennent :

```
# Cette liste vit hors du depot : apres avoir edite ce fichier pour une
# stack ou un ui nouveau, recolle-le dans l'environnement. ./init.sh --check
# signale l'ecart entre les plugins declares ici et ceux qu'exigent les apps.
```

- [ ] **Étape 2 : supprimer les quatre fonctions et `emit_settings`, et leur branchement**

Dans `init.sh`, retirer en entier `emit_settings`, `emit_check_plugins`,
`emit_garde_branche`, `emit_garde_commit`, `emit_cloud_setup` (de chaque
`emit_xxx() {` à son `}` fermant). Retirer leurs cinq entrées du dispatcher
`emit()` et du tableau `DERIVES` :
`.claude/settings.json`, `.claude/check-plugins.sh`, `.claude/cloud-setup.sh`,
`.claude/garde-branche.sh`, `.claude/garde-commit.sh`.

- [ ] **Étape 3 : corriger le message d'aide devenu faux**

`bad ".claude/settings.json absent — lance ./init.sh"` — `./init.sh` ne le
recrée plus. Remplacer par :

```bash
bad ".claude/settings.json absent — c'est un fichier ordinaire desormais : recree-le a la main"
```

- [ ] **Étape 4 : écrire le test négatif — un hook sans bit exécutable ne se voit pas**

```bash
chmod -x .claude/garde-branche.sh
./init.sh --check 2>&1 | grep -i 'garde-branche'
```

Attendu aujourd'hui : rien, ou seulement la ligne `garde-branche.sh
analysable` du contrôle de syntaxe (`bash -n` ne regarde pas le bit
exécutable). C'est l'échec du test : un hook non exécutable ne garde rien, et
rien ne le dit.

- [ ] **Étape 5 : ajouter les vérifications d'exécutable pour les deux hooks, et l'avertissement de `settings.json`**

Juste après la ligne existante
`[ -x .claude/check-plugins.sh ] && ok "rapport d'outillage executable" ...` :

```bash
  for h in .claude/garde-branche.sh .claude/garde-commit.sh; do
    [ -x "$h" ] && ok "$h executable" || bad "$h absent ou non executable"
  done
```

Et, après le bloc existant qui affiche `.claude/settings.json present (...)`
et vérifie l'absence de bloc `env` :

```bash
  # settings.json n'est plus regenere a chaque app.yml touchant stack/ui :
  # avertit, sans bloquer, quand un plugin ou un LSP attendu par les apps
  # courantes n'y figure pas — le meme principe deja applique a cloud-setup.sh.
  if [ -f .claude/settings.json ]; then
    manque=0
    for p in "${PLUGIN_IDS[@]}"; do
      grep -qF "\"$p\":" .claude/settings.json || manque=$((manque+1))
    done
    [ "$manque" -eq 0 ] && ok "settings.json : ${#PLUGIN_IDS[@]} plugin(s) attendu(s), tous declares" \
                        || warn "settings.json : $manque plugin(s) attendu(s) absent(s) — une app declare un stack ou un ui sans son plugin"
  fi
```

- [ ] **Étape 6 : constater les refus, restaurer, puis vérifier vert**

```bash
./init.sh --check 2>&1 | grep 'garde-branche.sh absent'   # attendu : KO
chmod +x .claude/garde-branche.sh

python3 -c "
import json
d = json.load(open('.claude/settings.json'))
d['enabledPlugins'].pop('context7@claude-plugins-official')
json.dump(d, open('.claude/settings.json', 'w'), indent=2)
" 2>/dev/null || sed -i '/\"context7@claude-plugins-official\": true,/d' .claude/settings.json
./init.sh --check 2>&1 | grep 'settings.json'              # attendu : attn, 1 plugin(s)... absent(s)
git checkout -- .claude/settings.json
./init.sh --check    # attendu : vert
```

- [ ] **Étape 7 : committer**

```bash
./init.sh --pret
git add .claude/garde-branche.sh .claude/garde-commit.sh .claude/check-plugins.sh \
        .claude/cloud-setup.sh init.sh
git commit -m "outillage : hooks, scripts et reglages Claude deviennent ordinaires"
git push
```

---

### Tâche 3 : les agents et le gabarit de PR deviennent ordinaires

**Fichiers :**
- Modifier : `.claude/agents/greffier.md` (la liste d'apps en toutes lettres)
- Inchangés en contenu, changés en statut : `.claude/agents/analyste.md`,
  `.github/pull_request_template.md`
- Modifier : `init.sh` (suppression de trois fonctions `emit_*`, de leurs
  entrées `DERIVES`/`emit()` ; ajout de trois vérifications d'existence)

- [ ] **Étape 1 : corriger la liste d'apps figée dans `greffier.md`**

```
Le prefixe est l'app touchee — parmi : cadran hello-world ramure — ou `fabrique` si le
```

devient :

```
Le prefixe est l'app touchee — le nom de son repertoire sous `apps/` — ou `fabrique` si le
```

Sans cette correction, la phrase serait exacte aujourd'hui et fausse dès la
prochaine app ajoutée ou retirée, puisque plus rien ne la régénère.

- [ ] **Étape 2 : supprimer les trois fonctions et leur branchement**

Retirer `emit_pr_template`, `emit_analyste`, `emit_greffier` en entier de
`init.sh`, leurs trois entrées du dispatcher `emit()`, et
`.github/pull_request_template.md`, `.claude/agents/greffier.md`,
`.claude/agents/analyste.md` du tableau `DERIVES`.

- [ ] **Étape 3 : écrire le test négatif — un agent supprimé ne se voit pas**

```bash
mv .claude/agents/analyste.md /tmp/analyste.md.bak
./init.sh --check 2>&1 | tail -3
```

Attendu, une fois l'étape 2 faite : vert quand même — plus aucun contrôle ne
porte sur l'existence de ces trois fichiers, la comparaison à `DERIVES` qui
le faisait vient de disparaître. C'est l'échec du test.

- [ ] **Étape 4 : ajouter les trois vérifications d'existence**

Dans la section `-- outillage`, à la suite des vérifications de la Tâche 2 :

```bash
  for f in .claude/agents/analyste.md .claude/agents/greffier.md \
           .github/pull_request_template.md; do
    [ -f "$f" ] && ok "$f present" || bad "$f absent"
  done
```

- [ ] **Étape 5 : constater le refus, restaurer, vérifier vert**

```bash
./init.sh --check 2>&1 | grep 'analyste.md absent'   # attendu : KO
mv /tmp/analyste.md.bak .claude/agents/analyste.md
./init.sh --check    # attendu : vert
```

- [ ] **Étape 6 : committer**

```bash
./init.sh --pret
git add .claude/agents/greffier.md .claude/agents/analyste.md \
        .github/pull_request_template.md init.sh
git commit -m "outillage : agents et gabarit de PR deviennent ordinaires"
git push
```

---

### Tâche 4 : le contrat et `memory/` cessent de décrire un outillage généré

**Fichiers :**
- Modifier : `CLAUDE.md` (trois passages)
- Modifier : `memory/outillage.md` (quatre passages)
- Modifier : `memory/travail.md` (un passage)

**Interfaces :** aucune — changement documentaire pur, aucun contrôle
n'en dépend au-delà de ceux déjà posés par les Tâches 1 à 3.

- [ ] **Étape 1 : `CLAUDE.md` — la phrase sur les artefacts dérivés**

```
`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient, app par app. Les artefacts dérivés —
`compose.yaml`, le workflow, `.claude/`, `go.work` — sont **toujours réécrits** :
c'est ce qui garantit qu'une app ajoutée ne peut pas manquer du déploiement.
```

devient :

```
`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient, app par app. Deux artefacts sont
**toujours réécrits**, fonction directe des manifestes : `compose.yaml` et
`go.work`. Le reste — le workflow de CI, `.claude/` — est ordinaire, à éditer
directement ; `--check` en vérifie l'existence et les propriétés qui comptent,
pas l'égalité à un générateur.
```

- [ ] **Étape 2 : `CLAUDE.md` — le paragraphe sur `--add`**

```
Le commit 1 emporte les artefacts régénérés, pas seulement `apps/<nom>`** :
`--add` réécrit `compose.yaml`, le workflow et `.gitignore` ; s'il introduit un
langage ou un `ui: true` nouveau, `.claude/` ; et dès que le module Go existe,
`go.work`. N'ajouter que `apps/<nom>` fait échouer le job `contrat` en CI sur
« compose.yaml désynchronisé des manifestes », avant même la construction. Le
commit 2 ne touche que `app.yml` et `compose.yaml`.
```

devient :

```
Le commit 1 emporte les artefacts régénérés, pas seulement `apps/<nom>`** :
`--add` réécrit `compose.yaml`, `.gitignore` et, dès que le module Go existe,
`go.work`. N'ajouter que `apps/<nom>` fait échouer le job `contrat` en CI sur
« compose.yaml désynchronisé des manifestes », avant même la construction.
S'il introduit un langage ou un `ui: true` nouveau, édite `.claude/settings.json`
et `.claude/cloud-setup.sh` à la main — `--check` avertit si un plugin attendu
manque. Le commit 2 ne touche que `app.yml` et `compose.yaml`.
```

Et la ligne d'exemple `git add` juste au-dessus :

```
git add apps/ma-nouvelle-app compose.yaml .github .gitignore .claude go.work
```

devient :

```
git add apps/ma-nouvelle-app compose.yaml .gitignore go.work
# + .claude si tu l'as édité pour un langage ou un ui nouveau
```

- [ ] **Étape 3 : `CLAUDE.md` — le chapitre « Ton outillage »**

```
`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone repart avec
le même outillage. **Déclarer un plugin ne l'installe pas** — seul le *setup
script* de l'environnement cloud le fait, et `.claude/cloud-setup.sh` en porte le
contenu à recoller après tout changement de `stack` ou de `ui`. Liste des
plugins, serveurs LSP, et le rapport d'ouverture de session :
`memory/outillage.md`. **Jamais de bloc `env` dans `.claude/settings.json`** : il
est public par construction.
```

devient :

```
`.claude/settings.json` est un fichier ordinaire, **versionné** : tout clone
repart avec le même outillage. **Déclarer un plugin ne l'installe pas** — seul
le *setup script* de l'environnement cloud le fait, et `.claude/cloud-setup.sh`,
édité à la main, en porte le contenu à recoller après tout changement de
`stack` ou de `ui`. Liste des plugins, serveurs LSP, et le rapport d'ouverture
de session : `memory/outillage.md`. **Jamais de bloc `env` dans
`.claude/settings.json`** : il est public par construction.
```

- [ ] **Étape 4 : `memory/outillage.md` — quatre passages**

Ligne 9-10 :

```
`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone du dépôt — toi,
un autre agent, une session cloud, la CI — repart avec le même outillage.
```

devient :

```
`.claude/settings.json` est un fichier ordinaire et **versionné** : tout clone
du dépôt — toi, un autre agent, une session cloud, la CI — repart avec le même
outillage. Il se retouche à la main quand une app introduit un `stack` ou un
`ui` nouveau ; `--check` avertit si un plugin attendu n'y figure pas.
```

Lignes 27-35, le paragraphe qui commence par « Déclarer un plugin ne
l'installe pas » — la phrase « `init.sh` en génère le contenu » devient :

```
`.claude/cloud-setup.sh`, édité à la main, en porte le contenu : les plugins, plus **le binaire de chaque
serveur LSP** — l'image cloud fournit les compilateurs, jamais les serveurs de
langage, et sans ce binaire le plugin est installé mais inerte. Les installations
partent en parallèle : le script doit tenir sous cinq minutes.
```

(le reste du paragraphe, avant et après cette phrase, ne change pas).

Ligne 47, dans le paragraphe suivant :

```
dans ton compte, et `init.sh` ne peut pas la mettre à jour : après un `./init.sh` qui
change un `stack` ou un `ui`, recolle le fichier — `--check` signale l'écart.
```

devient :

```
dans ton compte, et rien ne la met à jour automatiquement : après avoir édité
`.claude/cloud-setup.sh` pour un `stack` ou un `ui` nouveau, recolle le fichier
— `--check` signale l'écart entre ce qui est déclaré et ce que les apps exigent.
```

- [ ] **Étape 5 : `memory/travail.md` — le passage sur les deux hooks**

```
Générés par `init.sh` comme le reste de `.claude/`, et `--check` refuse qu'ils
divergent de leur générateur. Aucun ne dépend de `jq` ni de `python` : un garde-fou
qui ne démarre pas sur une machine dépouillée ne garde rien. Le garde-fou de branche
n'ouvre pas la branche à ta place : seul celui qui édite connaît le sujet.
```

devient :

```
Fichiers ordinaires dans `.claude/`, édités directement ; `--check` vérifie
qu'ils existent et portent le bit exécutable. Aucun ne dépend de `jq` ni de
`python` : un garde-fou qui ne démarre pas sur une machine dépouillée ne garde
rien. Le garde-fou de branche n'ouvre pas la branche à ta place : seul celui
qui édite connaît le sujet.
```

- [ ] **Étape 6 : vérifier et committer**

```bash
grep -rn "génère\|generé\|Générés par\|réécrit" CLAUDE.md memory/outillage.md memory/travail.md
```

Ne doit plus rien trouver qui affirme une génération pour les neuf fichiers de
ce lot — `compose.yaml` et `go.work`, eux, continuent légitimement à être
décrits comme générés partout où ils le sont encore.

```bash
./init.sh --check
./init.sh --pret
git add CLAUDE.md memory/outillage.md memory/travail.md
git commit -m "contrat : le contrat et memory/ cessent de decrire un outillage genere"
git push
```

---

### Tâche 5 : preuve finale et pull request

- [ ] **Étape 1 : la taille d'`init.sh`, et ce qu'elle dit**

```bash
wc -l init.sh
```

Comparer au 3 934 lignes de départ. Le nombre exact importe moins que la
direction : environ 600 lignes de générateurs retirées, contre ~40 lignes de
vérifications ajoutées, pour un solde net très en dessous du point de départ.

- [ ] **Étape 2 : aucune fonction `emit_*` restante ne doit rester orpheline**

```bash
grep -n '^emit_' init.sh
```

Attendu : seuls `emit_compose`, `emit_gowork`, et les fonctions internes
qu'ils utilisent (`aux_block`, `service_block`, etc.) doivent apparaître.
Toute autre `emit_*` encore présente est un oubli de suppression.

- [ ] **Étape 3 : un `./init.sh` nu ne touche plus que les deux fichiers générés**

```bash
git stash -u
./init.sh >/dev/null
git status --short
git stash pop
```

Attendu : `git status --short` après le `./init.sh` nu ne montre aucune
modification (les deux seuls artefacts générés, `compose.yaml` et `go.work`,
sont déjà à jour). Si l'un des neuf fichiers sortis de `DERIVES` apparaît
modifié ici, une entrée `emit_*` ou `DERIVES` a été oubliée.

- [ ] **Étape 4 : vérification complète et pull request**

```bash
./init.sh --check       # vert, toutes les nouvelles lignes ok
./init.sh --pret
```

Compléter le journal de la branche avec les anomalies rencontrées en
déroulant ce plan, comme pour le lot 1. Puis :

```bash
git add -A && git commit -m "journal : les anomalies du lot 2" && git push
```

Ouvrir la pull request en remplissant `.github/pull_request_template.md` :
une phrase, les chiffres (lignes retirées d'`init.sh`, neuf fichiers devenus
ordinaires), et le point d'attention — un `stack` ou un `ui` nouveau demande
désormais une édition manuelle de `.claude/settings.json` et
`.claude/cloud-setup.sh`, là où `--add` s'en chargeait seul.

## Ce que ce plan ne fait pas

- **Ne touche pas `compose.yaml` ni `go.work`**, qui restent générés et
  comparés comme aujourd'hui.
- **N'ajoute aucun mécanisme qui rappellerait automatiquement** d'éditer
  `.claude/settings.json` ou `cloud-setup.sh` à l'ajout d'un `stack` nouveau,
  au-delà de l'avertissement de `--check` : c'est un arbitrage déjà tranché
  dans la conception (le coût, rare, est accepté).
- **Ne change pas le contenu fonctionnel** d'aucun des neuf fichiers — seuls
  leur statut, leurs en-têtes, et les deux passages figés (liste d'apps dans
  `greffier.md`, valeurs `fabrique.yml` dans le workflow) bougent.
