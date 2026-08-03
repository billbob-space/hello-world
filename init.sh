#!/usr/bin/env bash
#
# init.sh — la fabrique : plusieurs applications, une seule stack dockhand
#
#   ./init.sh                 regenere les artefacts derives depuis apps/*/app.yml
#   ./init.sh --check         verifie le depot, service par service
#   ./init.sh --add NOM       echafaude apps/NOM/ (ni Dockerfile ni code)
#   ./init.sh --app NOM ...   applique les options ci-dessous a cette app
#   ./init.sh --list          etat des applications de la fabrique
#   ./init.sh --dry-run       n'ecrit rien, affiche le diff de chaque artefact
#   ./init.sh --branche NOM   cree la branche de travail, et son entree de journal
#   ./init.sh --pret          verifie que l'etape en cours est committable
#
# Options — elles ne valent que pour l'app ciblee par --add ou --app :
#
#   --port N            port d'ecoute dans le conteneur      (defaut 8080)
#   --memory X          limite memoire du conteneur          (defaut 128m)
#   --health CHEMIN     chemin HTTP de sante                 (defaut /healthz)
#   --health-cmd CMD    commande de healthcheck, ou "none"   (defaut : wget)
#   --exposure T        private | google | public            (defaut private)
#   --stack S           langage principal, active son LSP    (defaut none)
#   --ui / --no-ui      l'app sert une interface web         (defaut no)
#   --enable / --disable  presente dans le compose, ou non   (defaut : enable)
#
# Les artefacts derives — compose.yaml, le workflow, .claude/, go.work — sont
# TOUJOURS reecrits : c'est ce qui garantit qu'une app ajoutee ne peut pas etre
# absente du deploiement. En revanche apps/NOM/app.yml n'est JAMAIS reecrit ;
# il est la source de verite, edite a la main ou par --app. Il en va de meme des
# entrees de journal/ : echafaudees une fois, ecrites a la main ensuite.
#
# Le script ne genere NI Dockerfile NI code applicatif : le choix de la
# technologie appartient a l'agent. Voir CLAUDE.md.

set -euo pipefail

CHECK=0 ADD="" TARGET="" LIST=0 DRYRUN=0 FORCE=0 BRANCHE="" PRET=0 FUSIONNEES=0
declare -A SET=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)       CHECK=1 ;;
    --list)        LIST=1 ;;
    --dry-run)     DRYRUN=1 ;;
    --force)       FORCE=1 ;;
    --branche)     BRANCHE="$2"; shift ;;
    --pret)        PRET=1 ;;
    --branches-fusionnees) FUSIONNEES=1 ;;
    --add)         ADD="$2"; TARGET="$2"; shift ;;
    --app)         TARGET="$2"; shift ;;
    --port)        SET[port]="$2";        shift ;;
    --memory)      SET[memory]="$2";      shift ;;
    --health)      SET[health_path]="$2"; shift ;;
    --health-cmd)  SET[health_cmd]="$2";  shift ;;
    --exposure)    SET[exposure]="$2";    shift ;;
    --stack)       SET[stack]="$2";       shift ;;
    --ui)          SET[ui]=true ;;
    --no-ui)       SET[ui]=false ;;
    --enable)      SET[enabled]=true ;;
    --disable)     SET[enabled]=false ;;
    -h|--help)     sed -n '2,/^set -euo/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

# FAILED n'est fiable que si bad() n'est jamais appele dans un sous-shell : une
# boucle « ... | while read » perdrait l'increment et --check sortirait en 0 en
# ayant affiche des KO. Toutes les boucles de verification sont des `for`.
FAILED=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mattn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mKO\033[0m    %s\n' "$1"; FAILED=$((FAILED+1)); }

# --- lecture des manifestes -----------------------------------------------------
#
# Parsing plat volontaire : cle en colonne 0, pas de YAML imbrique. Il n'y a
# donc rien a installer pour lancer ce script. Les app.yml n'etant plus reecrits,
# ils sont edites a la main : on retire le CR d'une edition Windows, le
# commentaire de fin de ligne et les guillemets, sans quoi « port: 8080 # todo »
# produirait un compose invalide.

yget() {  # yget <fichier> <cle> <defaut>
  local f="$1" k="$2" d="${3-}" v=""
  [ -f "$f" ] && v=$(tr -d '\r' < "$f" | sed -nE "s/^$k:[[:space:]]*(.*)$/\1/p" | head -1)
  v=$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')
  v="${v#\"}"; v="${v%\"}"; v="${v#\'}"; v="${v%\'}"
  printf '%s' "${v:-$d}"
}

fab() { yget fabrique.yml "$1" "$2"; }

app_get() {  # app_get <app> <cle> <defaut> — l'option CLI ne vaut que pour --app
  local a="$1" k="$2" d="${3-}"
  if [ "$TARGET" = "$a" ] && [ -n "${SET[$k]+x}" ]; then printf '%s' "${SET[$k]}"; return; fi
  yget "apps/$a/app.yml" "$k" "$d"
}

COMPOSE=compose.yaml
LEGACY_COMPOSE=docker-compose.yml

REGISTRY=$(fab registry ghcr.io)
ORG=$(fab org billbob-space)
REPO=$(fab repo "$(basename "$(pwd)")")
DOMAIN=$(fab domain apps.billbob.ovh)
NETWORK=$(fab network apps_net)
ENTRYPOINT=$(fab entrypoint websecure)
CERT_RESOLVER=$(fab cert_resolver letsencrypt)
SECURITY_HEADERS=$(fab security_headers security-headers@file)
MEMORY_BUDGET=$(fab memory_budget 1024m)
IMAGE_MAX_MB=$(fab image_max_mb 200)
LOG_MAX_SIZE=$(fab log_max_size 10m)
LOG_MAX_FILE=$(fab log_max_file 3)

# --- applications ---------------------------------------------------------------

valid_name() {  # label DNS : ni tiret en tete ni tiret en queue
  printf '%s' "$1" | grep -qE '^[a-z0-9]([a-z0-9-]{0,29}[a-z0-9])?$' && return 0
  echo "ERREUR : nom d'app invalide : '$1' — il devient un sous-domaine." >&2
  return 1
}

APPS=() APPS_ACTIVES=()

discover_apps() {
  local d
  APPS=()
  # LC_ALL=C fige l'ordre : un ordre dependant de la locale produirait un diff
  # de compose.yaml d'une machine a l'autre, donc un redeploiement fantome.
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    [ -f "$d/app.yml" ] || { warn "$d : pas d'app.yml, ignore"; continue; }
    APPS+=("$(basename "$d")")
  done < <(LC_ALL=C find apps -mindepth 1 -maxdepth 1 -type d 2>/dev/null | LC_ALL=C sort)
}

load_app() {  # load_app <app> — peuple APP et A_*, valide, sort en erreur sinon
  APP="$1"
  valid_name "$APP" || exit 1
  A_ENABLED=$(app_get "$APP" enabled true)
  A_PORT=$(app_get "$APP" port 8080)
  A_MEMORY=$(app_get "$APP" memory 128m)
  A_HEALTH_PATH=$(app_get "$APP" health_path /healthz)
  A_EXPOSURE=$(app_get "$APP" exposure private)
  A_HEALTH_CMD=$(app_get "$APP" health_cmd "wget --spider -q http://localhost:$A_PORT$A_HEALTH_PATH")
  A_STACK=$(app_get "$APP" stack none)
  A_UI=$(app_get "$APP" ui false)

  # A_MW_NOTE est le commentaire pose juste au-dessus du label middlewares dans
  # compose.yaml : celui qui lit le compose doit savoir ce que le palier garantit
  # sans avoir a ouvrir app.yml.
  case "$A_EXPOSURE" in
    private) A_MW=forwardauth       # whitelist de comptes Google
             A_MW_NOTE="      # forwardauth = authentification Google + liste blanche du serveur
      # (exposure private). La retirer exposerait l'app en clair." ;;
    google)  A_MW=forwardauth-open  # tout compte Google authentifie
             A_MW_NOTE="      # forwardauth-open = tout compte Google, login obligatoire
      # (exposure google). La retirer exposerait l'app en clair." ;;
    public)  A_MW=public            # anonyme : AUCUNE authentification
             A_MW_NOTE="      # public = AUCUNE authentification (exposure public). Acces anonyme,
      # rate-limit seul. Ne pas confondre avec forwardauth-open, qui exige un
      # compte Google. X-Forwarded-User n'est PAS pose sur ce palier." ;;
    *) echo "ERREUR : $APP — exposure doit valoir 'private', 'google' ou 'public' (recu : $A_EXPOSURE)" >&2; exit 1 ;;
  esac
  printf '%s' "$A_PORT"   | grep -qE '^[0-9]{2,5}$'        || { echo "ERREUR : $APP — port invalide : $A_PORT" >&2; exit 1; }
  printf '%s' "$A_MEMORY" | grep -qE '^[0-9]+[bkmgBKMG]?$' || { echo "ERREUR : $APP — memory invalide : $A_MEMORY" >&2; exit 1; }
  case "$A_HEALTH_PATH" in /*) ;; *) echo "ERREUR : $APP — health_path doit commencer par / (recu : $A_HEALTH_PATH)" >&2; exit 1 ;; esac
  case "$A_UI"      in true|false) ;; *) echo "ERREUR : $APP — ui doit valoir true ou false (recu : $A_UI)" >&2; exit 1 ;; esac
  case "$A_ENABLED" in true|false) ;; *) echo "ERREUR : $APP — enabled doit valoir true ou false (recu : $A_ENABLED)" >&2; exit 1 ;; esac
}

mem_to_mb() {  # 128m -> 128, 1g -> 1024
  local v n; v=$(printf '%s' "$1" | tr 'A-Z' 'a-z'); n=${v%%[!0-9]*}
  [ -n "$n" ] || { echo 0; return; }
  case "$v" in
    *g) echo $(( n * 1024 )) ;;
    *m) echo "$n" ;;
    *k) echo $(( n / 1024 )) ;;
    *)  echo $(( n / 1048576 )) ;;
  esac
}

# LSP par langage. STACK_CANON dedoublonne les alias : go et golang sont la meme
# stack, un sort -u naif poserait deux fois gopls-lsp.
#
# LSP_INSTALL sert au setup script cloud : l'image de base fournit les
# compilateurs, jamais les serveurs de langage. Sans cette ligne le plugin est
# installe mais inerte. Vide = pas d'installation en une commande fiable a
# travers l'allowlist reseau ; le setup script genere pose alors un TODO.
lsp_for() {
  case "$1" in
    none)                STACK_CANON=none;       LSP=""; LSP_BIN=""; LSP_INSTALL="" ;;
    typescript|ts|node)  STACK_CANON=typescript; LSP=typescript-lsp;    LSP_BIN=typescript-language-server
                         LSP_INSTALL='npm install -g typescript-language-server typescript' ;;
    python|py)           STACK_CANON=python;     LSP=pyright-lsp;       LSP_BIN=pyright-langserver
                         LSP_INSTALL='npm install -g pyright' ;;
    go|golang)           STACK_CANON=go;         LSP=gopls-lsp;         LSP_BIN=gopls
                         LSP_INSTALL='PATH="/usr/local/go/bin:$PATH" GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@latest' ;;
    rust)                STACK_CANON=rust;       LSP=rust-analyzer-lsp; LSP_BIN=rust-analyzer
                         LSP_INSTALL='rustup component add rust-analyzer' ;;
    java)                STACK_CANON=java;       LSP=jdtls-lsp;         LSP_BIN=jdtls;         LSP_INSTALL="" ;;
    kotlin)              STACK_CANON=kotlin;     LSP=kotlin-lsp;        LSP_BIN=kotlin-language-server; LSP_INSTALL="" ;;
    php)                 STACK_CANON=php;        LSP=php-lsp;           LSP_BIN=intelephense
                         LSP_INSTALL='npm install -g intelephense' ;;
    csharp|dotnet)       STACK_CANON=csharp;     LSP=csharp-lsp;        LSP_BIN=csharp-ls;     LSP_INSTALL="" ;;
    swift)               STACK_CANON=swift;      LSP=swift-lsp;         LSP_BIN=sourcekit-lsp; LSP_INSTALL="" ;;
    c|cpp|c++)           STACK_CANON=cpp;        LSP=clangd-lsp;        LSP_BIN=clangd
                         LSP_INSTALL='apt-get install -y clangd' ;;
    lua)                 STACK_CANON=lua;        LSP=lua-lsp;           LSP_BIN=lua-language-server;    LSP_INSTALL="" ;;
    *) echo "ERREUR : stack inconnue : $1" >&2
       echo "Valeurs : none typescript python go rust java kotlin php csharp swift cpp lua" >&2
       exit 1 ;;
  esac
}

# --- outillage de l'agent : union des langages de toutes les apps ---------------
#
# .claude/settings.json est un reglage de PROJET : il n'existe qu'a la racine.
# L'outillage est donc l'union de ce que demandent les apps — y compris les apps
# desactivees, dont il faut bien pouvoir ecrire le code.

PLUGIN_IDS=() LSP_BINS=() LSP_TRIPLETS=() UI_ANY=false

compute_tooling() {
  local a seen=" " triplet
  PLUGIN_IDS=(
    superpowers@claude-plugins-official        # brainstorming, TDD, debug, plans
    mattpocock-skills@claude-plugins-official  # tdd, code-review, domain-modeling
    code-review@claude-plugins-official
    code-simplifier@claude-plugins-official
    commit-commands@claude-plugins-official    # commit, push, PR
    security-guidance@claude-plugins-official  # revue vulnerabilites a chaque edition
    context7@claude-plugins-official           # doc a jour des bibliotheques (MCP)
    github@claude-plugins-official             # PR, Actions, GHCR (MCP)
  )
  LSP_BINS=() LSP_TRIPLETS=() UI_ANY=false
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_UI" = true ] && UI_ANY=true
    lsp_for "$A_STACK"
    [ -n "$LSP" ] || continue
    case "$seen" in *" $STACK_CANON "*) continue ;; esac
    seen="$seen$STACK_CANON "
    PLUGIN_IDS+=("$LSP@claude-plugins-official")
    LSP_BINS+=("$LSP_BIN")
    LSP_TRIPLETS+=("$LSP:$LSP_BIN:$STACK_CANON")
  done
  if [ "$UI_ANY" = true ]; then
    PLUGIN_IDS+=(
      frontend-design@claude-plugins-official
      playwright@claude-plugins-official       # pilotage navigateur, E2E (MCP)
      impeccable@impeccable                    # finition visuelle — marketplace tierce
    )
  fi
}

# --- gabarits -------------------------------------------------------------------
#
# render remplace des marqueurs __CLE__ dans un gabarit lu sur l'entree standard.
# Les gabarits sont ainsi cites (<<'EOF'), ce qui evite d'echapper un a un les
# ${{ }} de GitHub Actions et les $ des scripts generes — la source d'erreur la
# plus courante de ce fichier.
render() {
  local t r; t=$(cat)
  while [ $# -gt 1 ]; do
    # Depuis bash 5.2, « & » dans le remplacement de ${var//motif/rempl} rappelle
    # le texte matche, comme dans sed : sans protection, un « 2>&1 » du fragment
    # injecte devient « 2>__CLE__1 » et le script genere ne s'analyse meme plus.
    # Le backslash est protege d'abord, sinon il mangerait le suivant.
    #
    # Mais AVANT 5.2 ce rappel n'existe pas : le « \ » y reste litteral et produit
    # « 2>\&1 \& ». Echapper inconditionnellement casse donc .claude/cloud-setup.sh
    # sur tout bash <= 5.1 (Ubuntu 22.04 : 5.1.16) — constate, et refuse ensuite
    # par ./init.sh --check. D'ou le test de version.
    r=$2
    if [ "${BASH_VERSINFO[0]}" -gt 5 ] \
       || { [ "${BASH_VERSINFO[0]}" -eq 5 ] && [ "${BASH_VERSINFO[1]}" -ge 2 ]; }; then
      r=${r//\\/\\\\}
      r=${r//&/\\&}
    fi
    t="${t//$1/$r}"
    shift 2
  done
  printf '%s\n' "$t"
}

service_block() {  # bloc de service de l'app chargee par load_app
  local health
  if [ "$A_HEALTH_CMD" = none ]; then
    health="    # healthcheck desactive (image sans shell)"
  else
    health="    healthcheck:
      test: [\"CMD-SHELL\", \"$A_HEALTH_CMD\"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s"
  fi
  cat <<YAML

  # >>> $APP — apps/$APP/app.yml — https://$APP.$DOMAIN
  $APP:
    image: $REGISTRY/$ORG/$REPO/$APP:main
    container_name: $APP
    restart: unless-stopped
    mem_limit: $A_MEMORY
    # Le tag :main est mutable : l'image locale portant ce nom est presque
    # toujours perimee. Sans ce reglage, un redeploiement relance l'image deja
    # presente et sert silencieusement la version precedente.
    pull_policy: always
    # Aucun port publie : Traefik joint le conteneur par le reseau $NETWORK.
$health
    # Journaux bornes : le disque du serveur est a 92 %, et la fabrique
    # multiplie les services. Un json-file non borne les remplirait.
    logging:
      driver: json-file
      options:
        max-size: "$LOG_MAX_SIZE"
        max-file: "$LOG_MAX_FILE"
    labels:
      # priority=100 est OBLIGATOIRE : un routeur catch-all capte tout
      # *.$DOMAIN par HostRegexp, et sa regle est plus longue que ce
      # Host(). Traefik departageant par longueur de regle, il gagnerait et
      # servirait un 404 silencieux.
      - "traefik.enable=true"
      - "traefik.http.routers.$APP.rule=Host(\`$APP.$DOMAIN\`)"
      - "traefik.http.routers.$APP.entrypoints=$ENTRYPOINT"
      - "traefik.http.routers.$APP.priority=100"
$A_MW_NOTE
      - "traefik.http.routers.$APP.middlewares=$A_MW,$SECURITY_HEADERS"
      - "traefik.http.routers.$APP.tls.certresolver=$CERT_RESOLVER"
      - "traefik.http.services.$APP.loadbalancer.server.port=$A_PORT"
      - "traefik.docker.network=$NETWORK"
    networks: [$NETWORK]
  # <<< $APP
YAML
}

disabled_note() {
  cat <<YAML

  # >>> $APP — DESACTIVEE (enabled: false dans apps/$APP/app.yml)
  # Aucun service n'est emis. La stack est unique : referencer une image qui
  # n'existe pas encore ferait echouer le « compose up » de TOUTES les apps.
  # Publie l'image d'abord, passe enabled a true ensuite.
  # <<< $APP
YAML
}

emit_compose() {
  cat <<YAML
# Genere par init.sh depuis fabrique.yml et apps/*/app.yml.
# NE PAS EDITER — ./init.sh --check refuse un compose desynchronise.
#
# Une seule stack dockhand, un service par application activee. Le rayon de
# souffle est commun : une erreur dans un bloc fait echouer le deploiement de
# toute la fabrique.
services:
YAML
  local a
  for a in "${APPS[@]}"; do
    load_app "$a"
    if [ "$A_ENABLED" = true ]; then service_block; else disabled_note; fi
  done
  cat <<YAML

networks:
  $NETWORK:
    external: true
YAML
}

emit_gowork() {
  local a uses=""
  for a in "${APPS[@]}"; do
    [ -f "apps/$a/go.mod" ] || continue
    uses="$uses
use ./apps/$a"
  done
  [ -n "$uses" ] || return 1
  cat <<EOF
// Genere par init.sh — les apps Go de la fabrique.
// Sans ce fichier, gopls ouvert a la racine du depot ne voit aucun module :
// chaque app est un module distinct sous apps/. Il ne sert qu'a l'outillage
// local, les constructions Docker ayant pour contexte apps/<nom>.
go 1.24
$uses
EOF
}

emit_build_workflow() {
  local a filters="" json="" sep=""
  for a in "${APPS[@]}"; do json="$json$sep\"$a\""; sep=","; done
  render \
    __APPS_JSON__ "[$json]" \
    __REGISTRY__ "$REGISTRY" \
    __ORG__ "$ORG" \
    __REPO__ "$REPO" \
    __IMAGE_MAX_MB__ "$IMAGE_MAX_MB" \
    <<'YAML'
# Genere par init.sh — une construction par app modifiee, un seul deploiement.
# NE PAS EDITER — ./init.sh --check refuse un workflow desynchronise.
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
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: choix
        env:
          EVENT: ${{ github.event_name }}
          TOUTES: ${{ inputs.toutes }}
          AVANT: ${{ github.event.before }}
          BASE_PR: ${{ github.event.pull_request.base.sha }}
          APRES: ${{ github.sha }}
        run: |
          set -euo pipefail
          toutes='__APPS_JSON__'

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
          registry: __REGISTRY__
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
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
            __REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:main
            __REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:${{ github.sha }}
          # Rattache le paquet au depot : ses permissions suivent alors celles
          # du depot, et un seul identifiant de lecture couvre toutes les apps.
          labels: |
            org.opencontainers.image.source=https://github.com/__ORG__/__REPO__
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
          image=__REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:main
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
          graves=$(docker image inspect "$image" \
                     --format '{{range $k, $v := .Config.Labels}}{{println $k}}{{end}}' \
                   | grep -E '^traefik\.' || true)
          if [ -n "$graves" ]; then
            printf '::error::LABEL traefik grave dans l image ${{ matrix.app }} : %s\n' $graves
            echo "::error::Docker le fusionnerait dans les labels du conteneur et publierait un routeur SUPPLEMENTAIRE, sans authentification. Retire-le du Dockerfile, ou change d image de base : ce label n est pas ecrasable depuis le compose."
            exit 1
          fi
          echo "aucun label traefik.* — ni ecrit dans le Dockerfile, ni herite de l image de base"

          size=$(docker image inspect "$image" --format '{{.Size}}')
          echo "Image ${{ matrix.app }} : $((size / 1024 / 1024)) Mo"
          if [ "$size" -gt $((__IMAGE_MAX_MB__ * 1024 * 1024)) ]; then
            echo "::warning::image au-dela de __IMAGE_MAX_MB__ Mo — le serveur est a 92 % de disque"
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
          registry: __REGISTRY__
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
          mapfile -t images < <(sed -nE 's/^[[:space:]]*image:[[:space:]]*(.*)$/\1/p' compose.yaml)
          if [ ${#images[@]} -eq 0 ]; then
            echo "::error::aucune image dans compose.yaml — la stack ne deploierait rien"
            exit 1
          fi
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
            printf '::error::image absente du registre : %s\n' "${manquantes[@]}"
            echo "::error::deploiement refuse — il ferait tomber toutes les apps de la stack"
            exit 1
          fi
          echo "${#images[@]} image(s) verifiee(s)"

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
YAML
}

emit_settings() {
  local enabled="" i sep marketplaces=""
  for i in "${!PLUGIN_IDS[@]}"; do
    sep=","; [ "$i" -eq $(( ${#PLUGIN_IDS[@]} - 1 )) ] && sep=""
    enabled="$enabled    \"${PLUGIN_IDS[$i]}\": true$sep
"
  done
  # claude-plugins-official est enregistree d'office par Claude Code : seule une
  # marketplace tierce doit etre declaree ici.
  if [ "$UI_ANY" = true ]; then
    marketplaces='  "extraKnownMarketplaces": {
    "impeccable": {
      "source": { "source": "github", "repo": "pbakaus/impeccable" }
    }
  },
'
  fi
  render __MARKETPLACES__ "$marketplaces" __ENABLED__ "$enabled" <<'JSON'
{
__MARKETPLACES__  "enabledPlugins": {
__ENABLED__  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR/.claude/check-plugins.sh\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR/.claude/garde-branche.sh\"",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR/.claude/garde-commit.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
JSON
}

emit_check_plugins() {
  render \
    __PLUGINS__ "${PLUGIN_IDS[*]}" \
    __TRIPLETS__ "${LSP_TRIPLETS[*]-}" \
    <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — rapport d'outillage, lance par le hook SessionStart.
#
# Il n'installe rien, et c'est delibere : un hook s'execute APRES que Claude
# Code a charge ses plugins. Il arrive donc toujours trop tard pour reparer
# quoi que ce soit — mais juste a temps pour dire ce qui manque. L'installation
# appartient au setup script de l'environnement (.claude/cloud-setup.sh), seul
# point d'accroche anterieur au lancement de Claude Code.
#
# Sa sortie standard est injectee dans le contexte de l'agent A CHAQUE SESSION :
# une ligne quand tout va bien, quel que soit le nombre d'applications, le
# detail seulement quand il y a un trou.
#
# Pour changer la liste : edite stack/ui dans un apps/*/app.yml, puis ./init.sh

set -u

PLUGINS="__PLUGINS__"
# plugin:binaire:stack — un triplet par serveur de langage attendu
TRIPLETS="__TRIPLETS__"

# Un plugin installe = un repertoire non vide dans le cache local, range sous
# <marketplace>/<nom>. installed_plugins.json n'est pas lu : ce manifeste
# survit a un cache efface, et decrirait alors un outillage disparu.
n=0 total=0 manquants=""
for p in $PLUGINS; do
  total=$(( total + 1 ))
  d="$HOME/.claude/plugins/cache/${p#*@}/${p%@*}"
  if [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    n=$(( n + 1 ))
  else
    manquants="$manquants $p"
  fi
done

# Un plugin LSP peut etre installe et pourtant inerte : Claude Code lance le
# binaire en clair, il doit exister sur la machine. Les deux etats divergent.
lsp_ok=0 lsp_total=0 lsp_detail=""
for t in $TRIPLETS; do
  plugin=${t%%:*}; reste=${t#*:}; bin=${reste%%:*}; stack=${reste##*:}
  # Si le plugin lui-meme manque, il est deja dans la liste ci-dessous :
  # inutile de le dire deux fois, et il serait faux de l'annoncer installe.
  case " $manquants " in *" $plugin@claude-plugins-official "*) continue ;; esac
  lsp_total=$(( lsp_total + 1 ))
  if command -v "$bin" >/dev/null 2>&1; then
    lsp_ok=$(( lsp_ok + 1 ))
  else
    lsp_detail="$lsp_detail
  $bin ABSENT — $plugin est installe mais inerte : aucun diagnostic $stack apres edition."
  fi
done

if [ "$lsp_total" -gt 0 ]; then
  echo "Outillage : $n/$total plugins installes, $lsp_ok/$lsp_total serveurs LSP presents."
else
  echo "Outillage : $n/$total plugins installes."
fi
[ -n "$manquants" ] && {
  echo "  manquants :$manquants"
  echo "  -> colle .claude/cloud-setup.sh dans le champ Setup script de l'environnement : claude.ai/code, icone nuage, engrenage."
}
[ -n "$lsp_detail" ] && {
  echo "$lsp_detail"
  echo "  -> leurs commandes d'installation sont dans .claude/cloud-setup.sh."
}

# Toujours 0 : un rapport ne fait pas echouer l'ouverture d'une session.
exit 0
SH
}

emit_garde_branche() {
  render __BASE__ "$BASE" <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — hook PreToolUse : refuse d'ecrire directement sur __BASE__.
#
# La fabrique ouvre une branche des la PREMIERE modification. Une regle ecrite
# dans CLAUDE.md s'oublie ; un hook, lui, s'execute. Il ne cree pas la branche
# lui-meme : le nom doit dire le sujet, et seul celui qui edite le connait.
#
# Aucune dependance : ni jq ni python. Un garde-fou qui ne demarre pas sur une
# machine depouillee ne garde rien.

set -u
BASE="__BASE__"

entree=$(cat)

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
racine=$(git rev-parse --show-toplevel)
courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$courante" = "$BASE" ] || exit 0

# Un fichier hors du depot ne concerne pas cette regle : le hook n'a pas a
# bloquer l'edition d'un brouillon ou d'une note personnelle. Chemin illisible
# = on protege, par defaut.
cible=$(printf '%s' "$entree" | sed -nE 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -1)
case "$cible" in
  "$racine"/*) ;;
  "")          ;;
  *) exit 0 ;;
esac

raison="Modification refusee : HEAD est sur $BASE.\n\nLa fabrique ouvre une branche des la premiere modification, nommee <app>/<sujet> — ou fabrique/<sujet> pour init.sh, la CI, le contrat ou l'outillage.\n\n  ./init.sh --branche <app>/<sujet>\n\nPuis recommence cette modification."

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$raison"
exit 0
SH
}

emit_garde_commit() {
  render __BASE__ "$BASE" <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — hook Stop : refuse de terminer sur un arbre de travail
# sale.
#
# Committer a chaque etape verifiee est ce qui evite la PR de mille lignes que
# personne ne relit vraiment. Le hook ne committe pas a votre place : il refuse
# seulement de laisser du travail non enregistre derriere lui.

set -u
BASE="__BASE__"

entree=$(cat)

# Garde anti-boucle. Quand ce hook a deja bloque et que la main est revenue,
# stop_hook_active vaut true : bloquer de nouveau ferait tourner en rond. En cas
# de doute on laisse passer — se tromper dans ce sens ne coute qu'un rappel
# manque, se tromper dans l'autre bloque la session.
case "$entree" in *'"stop_hook_active"'*true*) exit 0 ;; esac

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || exit 0

courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$courante" = "$BASE" ] && exit 0

sale=$(git status --porcelain 2>/dev/null)
[ -n "$sale" ] || exit 0
n=$(printf '%s\n' "$sale" | grep -c . || true)

raison="$n fichier(s) non committe(s) sur $courante.\n\nLa fabrique committe a chaque etape verifiee, pour que la relecture se fasse commit par commit plutot qu'en bloc a la fin.\n\n  ./init.sh --pret                    # l'etape est-elle committable ?\n  git add -A && git commit\n  git push -u origin $courante\n\nL'agent greffier fait ces trois gestes d'un coup. Si ce travail ne doit deliberement pas etre committe, dis-le explicitement."

printf '{"decision":"block","reason":"%s"}\n' "$raison"
exit 0
SH
}

emit_pr_template() {
  cat <<'MD'
<!-- Une pull request se lit en trente secondes. Elle sert a decider s'il faut
     relire et par ou commencer — le raisonnement, lui, vit dans les messages de
     commit, ou il reste attache au changement qu'il explique. -->

<!-- Une phrase : ce que ce changement fait. -->

## Ce qui compte

<!-- Trois a cinq puces, la plus importante en premier. Ce qu'un relecteur doit
     savoir pour juger — pas la liste de ce qui a ete fait, le diff la montre
     deja. Mets en gras le mot qui porte l'idee de chaque puce. -->

## Verifie

<!-- Une ou deux lignes : ce qui a ete lance, et le resultat. Des nombres
     plutot que des adjectifs. -->

## Avant de fusionner

<!-- Supprime cette section s'il n'y a rien a signaler. Sinon : points
     d'attention, gestes cote serveur, ce qui n'est pas couvert par la CI. -->
MD
}

emit_analyste() {
  render __DETECTE__ "$JOURNAL_DETECTE" __ACTION__ "$JOURNAL_ACTION" <<'MD'
---
name: analyste
description: Relit journal/ — le journal des anomalies de la fabrique — et en tire un plan d'amelioration ordonne. A lancer periodiquement, ou quand on se demande ou poser le prochain garde-fou. Ne modifie rien.
tools: Bash, Read, Grep
---

Tu relis le journal des anomalies de la fabrique et tu en tires un plan. Tu ne
repares rien et tu n'ecris aucun fichier : tu rends ton plan dans ta reponse.
C'est ce qui te rend lancable en tache de fond sans risque pour le depot.

## Ce que tu lis

`journal/*.md`, une entree par branche. Chaque anomalie porte deux champs a
vocabulaire ferme, faits pour etre agreges :

    Detecte par   __DETECTE__
    Action        __ACTION__

`Detecte par` est **ordonne par cout croissant**. Une anomalie rattrapee par le
compilateur n'a rien coute ; la meme rattrapee par l'utilisateur a coute un
aller-retour, et une rattrapee en production a coute davantage. C'est la
grandeur qui porte le plus d'information du journal.

## Ce que tu produis

**1. La distribution.** Compte les anomalies par `Detecte par` et par `Action` :

    sed -nE 's/^\*\*Detecte par\*\* — `([^`]+)`.*/\1/p' journal/*.md | sort | uniq -c | sort -rn
    sed -nE 's/^\*\*Action\*\* — `([^`]+)`.*/\1/p'      journal/*.md | sort | uniq -c | sort -rn

Le motif est ancre en debut de ligne et prend le **premier** groupe entre
apostrophes inverses, pas le dernier : la prose qui suit le jeton en contient
souvent d'autres. Un `grep | sort | uniq` sur la ligne entiere ne marche pas non
plus, pour la meme raison. Verifie ton total : la somme doit egaler le nombre de
`^### ` dans les memes fichiers, sinon ton extraction laisse des anomalies de
cote.

Ce qui compte n'est pas le total mais **jusqu'ou la distribution glisse vers la
droite**. Une masse sur `utilisateur` et `production` dit que les garde-fous
laissent passer ; une masse sur `compilateur`, `test` et `CI` dit qu'ils
tiennent, quel que soit le nombre d'anomalies.

**2. Les recurrences.** Une meme cause qui revient sur plusieurs branches vaut
plus qu'une anomalie spectaculaire isolee. Cite les entrees qui la portent.

**3. Le plan.** Trois a six actions, la plus rentable en premier. Pour chacune :
ce qu'elle change, quelles anomalies elle aurait evitees, et ou elle vit —
`CLAUDE.md`, `init.sh`, `.claude/`, ou une facon de travailler.

Groupe par `Action` : les `contrat` se corrigent ensemble, les `garde-fou`
aussi. Les `arbitrage` ne sont pas des actions — ce sont des questions a poser a
l'humain : liste-les a part, telles quelles.

**4. Ce que le journal ne dit pas.** Les entrees marquees comme retrospectives
sont reconstituees, donc incompletes du cote des anomalies mineures. Dis-le
plutot que de conclure sur elles.

## Ce que tu ne fais jamais

- ecrire ou modifier un fichier, ouvrir une branche, committer ;
- compter une entree marquee retrospective comme une mesure fiable ;
- proposer un garde-fou pour une anomalie deja rattrapee par le compilateur ou
  par un test : elle ne coute rien, le garde-fou couterait plus.
MD
}

emit_greffier() {
  render __APPS__ "${APPS[*]}" __BASE__ "$BASE" <<'MD'
---
name: greffier
description: Enregistre dans git le travail en cours de la fabrique — ouvre la branche au bon nom si besoin, verifie que l'etape est committable, committe et pousse. A lancer des qu'une etape verifiee est terminee, ou quand l'arbre de travail est sale. Ne modifie jamais le code.
tools: Bash, Read, Grep
model: haiku
---

Tu es le greffier de la fabrique : tu tiens son journal git. Tu n'ecris pas de
code, tu enregistres celui des autres. Sois rapide — peu de commandes, aucune
exploration inutile.

## La sequence, dans cet ordre

**1. Regarde.** `git status --porcelain` et `git rev-parse --abbrev-ref HEAD`.
Si rien n'est modifie, arrete-toi et dis « rien a enregistrer ». N'invente pas
de travail.

**2. La branche.** Si HEAD est sur `__BASE__`, il faut une branche dediee :

    ./init.sh --branche <prefixe>/<sujet>

Le prefixe est l'app touchee — parmi : __APPS__ — ou `fabrique` si le
changement porte sur `init.sh`, `fabrique.yml`, `compose.yaml`, `.github/`,
`.claude/` ou la documentation racine. Si plusieurs apps sont touchees a la
fois, c'est un changement transverse : prefixe `fabrique`.

Le sujet fait deux a quatre mots en minuscules separes par des tirets, et dit
**ce que le changement fait**, pas quels fichiers il touche. Lis le diff pour
le trouver. Si HEAD est deja sur une branche dediee, garde-la.

**3. Verifie.** `./init.sh --pret`. **S'il echoue, tu t'arretes la.** Tu ne
committes pas, tu ne poussses pas : tu rapportes exactement les lignes en echec.
Un commit qui casse quelque chose rend la relecture plus dure, pas plus simple.

Un cas revient souvent : `journal : ... est encore le gabarit nu`. L'entree de
journal de la branche n'a pas ete ecrite, et tu n'as pas d'outil d'edition pour
le faire — c'est voulu. Rapporte-le tel quel, en nommant le fichier : seul celui
qui a fait le travail connait les anomalies qu'il a rencontrees.

**4. Committe.** `git add -A`, puis un message dans le style du depot :

- une premiere ligne de 72 caracteres au plus, en francais **sans accents**,
  de la forme `perimetre : ce que fait le changement` — le perimetre est le nom
  de l'app ou `fabrique`, `outillage`, `ci`, `doc` ;
- un corps qui dit **pourquoi**, et ce que ca evite, quand ce n'est pas evident
  a la lecture du diff. Pas de liste de fichiers : le diff les montre deja ;
- termine par les lignes d'attribution que ton prompt systeme impose.

Lis le diff (`git diff --staged`) avant d'ecrire le message. Un message exact
est la moitie de la valeur d'un commit.

**5. Pousse.** `git push -u origin <branche>`. En cas d'echec reseau, reessaie
jusqu'a quatre fois en doublant l'attente : 2 s, 4 s, 8 s, 16 s.

**6. Rapporte** en trois lignes : la branche, le SHA court et la premiere ligne
du message, le nombre de fichiers.

## Ce que tu ne fais jamais

- committer ou pousser sur `__BASE__` ;
- `--force`, `--amend`, `rebase`, `reset --hard`, `merge`, supprimer une branche —
  tu ajoutes a l'histoire, tu ne la reecris pas ;
- ouvrir une pull request : elle vient a la fin, et ce n'est pas ton geste ;
- modifier un fichier de code. Si `--pret` echoue, ce n'est pas a toi de
  reparer : rapporte et arrete-toi.
MD
}

emit_cloud_setup() {
  local a launches="" todos="" plugin_lines marketplace=""
  # Les installations partent toutes en parallele : le setup script doit tenir
  # sous ~5 minutes, et seul un serveur de langage depasse la minute.
  for a in "${LSP_TRIPLETS[@]-}"; do
    [ -n "$a" ] || continue
    local plugin=${a%%:*} reste=${a#*:} bin stack
    bin=${reste%%:*}; stack=${reste##*:}
    lsp_for "$stack"
    if [ -n "$LSP_INSTALL" ]; then
      launches="$launches
( $LSP_INSTALL ) >/tmp/$bin-setup.log 2>&1 &
pids+=(\$!) noms+=($bin)
"
    else
      todos="$todos
# TODO : installer $bin. Le plugin $plugin est declare, mais sans ce binaire il
# reste inerte — et aucune installation en une commande n'est connue pour la
# stack $stack a travers l'allowlist reseau. Ajoute-la ici, puis recolle.
"
    fi
  done
  plugin_lines=$(printf '    %s \\\n' "${PLUGIN_IDS[@]}")
  plugin_lines=${plugin_lines% \\}
  [ "$UI_ANY" = true ] && marketplace='claude plugin marketplace add pbakaus/impeccable || true'

  render \
    __LAUNCHES__ "$launches" \
    __TODOS__ "$todos" \
    __MARKETPLACE__ "$marketplace" \
    __PLUGIN_LINES__ "$plugin_lines" \
    <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — A COLLER dans le champ "Setup script" de l'environnement
# cloud : claude.ai/code, icone nuage au-dessus de la zone de saisie, engrenage
# de l'environnement. Ce fichier n'est jamais execute par le depot ni par la CI.
#
# Pourquoi il existe. En session cloud, Claude Code charge les plugins AVANT de
# les installer : un hook SessionStart s'execute apres ce chargement, et
# /reload-plugins n'existe pas sur le web. Les plugins y atterriraient sur le
# disque sans jamais servir — et comme chaque session cloud demarre sur une VM
# neuve, le cas se represente a chaque fois. Ce script, lui, tourne avant le
# lancement de Claude Code, et son resultat est fige dans un instantane du
# disque : il ne rejoue qu'apres modification de l'environnement ou expiration
# du cache (~7 jours). C'est le seul endroit qui installe l'outillage ; le hook
# du depot ne fait que le verifier.
#
# Deux contraintes imposees par l'infrastructure cloud :
#   - sortir en 0, sinon la session refuse de demarrer — d'ou les || true ;
#   - tenir sous ~5 minutes, sinon le cache ne se construit pas.
#
# Cette liste vit hors du depot : apres un ./init.sh qui change une stack ou un
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.

set -u

# --- serveurs de langage : absents de l'image de base ---
# L'image cloud fournit les compilateurs, jamais les serveurs de langage. Sans
# ces binaires, les plugins LSP sont installes mais inertes : aucun diagnostic
# apres edition. Toutes les installations partent en parallele.
pids=() noms=()
__LAUNCHES__
__TODOS__
# --- plugins Claude Code ---
# Le setup script tourne en root, avec un PATH plus maigre que celui de la
# session : le binaire vit dans l'image node embarquee par Claude Code.
command -v claude >/dev/null || export PATH="/opt/node22/bin:$PATH"

# Avant le premier lancement de Claude Code, aucune marketplace n'est
# enregistree — pas meme l'officielle. La declarer ici separe un setup script
# qui installe d'un qui echoue en silence.
claude plugin marketplace add anthropics/claude-plugins-official || true
__MARKETPLACE__
for p in \
__PLUGIN_LINES__
do
  claude plugin install "$p" || echo "   echec : $p" >&2
done

for i in "${!pids[@]}"; do
  wait "${pids[$i]}" || { echo "echec ${noms[$i]} :" >&2; tail -3 "/tmp/${noms[$i]}-setup.log" >&2; }
  if command -v "${noms[$i]}" >/dev/null || [ -x "/usr/local/bin/${noms[$i]}" ]; then
    echo "${noms[$i]} present."
  else
    echo "${noms[$i]} absent — son plugin restera inerte." >&2
  fi
done

# Toujours 0 : un outil manquant degrade l'outillage, il ne doit pas empecher
# la session de demarrer.
exit 0
SH
}

# --- artefacts derives ----------------------------------------------------------

emit() {  # emit <chemin> — ecrit sur stdout l'artefact attendu pour ce chemin
  case "$1" in
    compose.yaml)                 emit_compose ;;
    .github/workflows/build.yml)  emit_build_workflow ;;
    .claude/settings.json)        emit_settings ;;
    .claude/check-plugins.sh)     emit_check_plugins ;;
    .claude/cloud-setup.sh)       emit_cloud_setup ;;
    .claude/garde-branche.sh)     emit_garde_branche ;;
    .claude/garde-commit.sh)      emit_garde_commit ;;
    .claude/agents/greffier.md)   emit_greffier ;;
    .claude/agents/analyste.md)   emit_analyste ;;
    .github/pull_request_template.md) emit_pr_template ;;
    go.work)                      emit_gowork ;;
  esac
}

DERIVES=(compose.yaml .github/workflows/build.yml .github/pull_request_template.md
         .claude/settings.json
         .claude/check-plugins.sh .claude/cloud-setup.sh
         .claude/garde-branche.sh .claude/garde-commit.sh
         .claude/agents/greffier.md .claude/agents/analyste.md go.work)

# --- --add ----------------------------------------------------------------------

scaffold_app() {
  local a="$1" dir="apps/$1"
  valid_name "$a" || exit 1
  if [ -d "$dir" ] && [ "$FORCE" = 0 ]; then
    echo "ERREUR : $dir existe deja (--force pour reecrire ses fichiers d'echafaudage)." >&2
    exit 1
  fi
  mkdir -p "$dir"

  # Une app neuve nait desactivee : son image n'existe pas encore, et la stack
  # etant unique, la referencer ferait echouer le deploiement de toutes.
  local port memory health_path health_cmd exposure stack ui enabled
  port=$(app_get "$a" port 8080)
  memory=$(app_get "$a" memory 128m)
  health_path=$(app_get "$a" health_path /healthz)
  exposure=$(app_get "$a" exposure private)
  health_cmd=$(app_get "$a" health_cmd "wget --spider -q http://localhost:$port$health_path")
  stack=$(app_get "$a" stack none)
  ui=$(app_get "$a" ui false)
  enabled=$(app_get "$a" enabled false)

  cat > "$dir/app.yml" <<YAML
# Parametres de deploiement de $a.
# Le nom de l'app — donc son URL — est celui du repertoire : apps/$a/
# Ce fichier n'est JAMAIS reecrit par init.sh : edite-le, puis relance ./init.sh
#
# enabled: false = l'app vit dans le depot mais n'entre pas dans compose.yaml.
# Passe-le a true une fois sa premiere image publiee sur le registre.
enabled: $enabled
port: $port
memory: $memory
health_path: $health_path
health_cmd: $health_cmd
exposure: $exposure          # private | google | public — voir CLAUDE.md
# Outillage de l'agent, sans effet sur le deploiement :
stack: $stack
ui: $ui
YAML
  ok "$dir/app.yml"

  cat > "$dir/.dockerignore" <<EOF
# Genere par init.sh — le contexte de construction est ce repertoire, pas la
# racine du depot. Exclure la doc fige le cache de couches sur les seules
# modifications de code.
.git
*.md
app.yml
test.sh
.dockerignore
$a
node_modules
dist
build
target
__pycache__
.env
.env.*
*.log
EOF
  ok "$dir/.dockerignore"

  cat > "$dir/test.sh" <<'EOF'
#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
# A toi d'y mettre la commande de test de ta technologie.
set -euo pipefail
cd "$(dirname "$0")"

echo "TODO : aucun test declare pour cette application."
EOF
  chmod +x "$dir/test.sh"
  ok "$dir/test.sh"

  cat > "$dir/README.md" <<EOF
# $a

URL : https://$a.$DOMAIN — palier d'exposition : \`$exposure\`.

## Ce que fait cette application

TODO.

## Developpement

TODO : comment la lancer localement.

## Variables d'environnement

Aucun secret n'est attendu. Declare ici les noms des variables injectees par
l'infrastructure, jamais leurs valeurs.
EOF
  ok "$dir/README.md"

  cat > "$dir/PRODUCT.md" <<EOF
# Product — $a

## Users

TODO : qui s'en sert, et dans quelle situation.

## Product Purpose

TODO : a quelle question cette application repond.

## Capabilities and Constraints

TODO : ce qu'elle fait, ce qu'elle ne fait pas.

## Product Principles

TODO.
EOF
  ok "$dir/PRODUCT.md"

  cat <<EOF

apps/$a echafaude. Il te reste a ecrire :

  1. Le code, ecoutant sur le port $port en HTTP clair.
  2. GET $health_path renvoyant 200 quand l'app est prete a servir.
  3. apps/$a/Dockerfile — multi-etapes, USER non root, image < $IMAGE_MAX_MB Mo.
  4. La commande de test dans apps/$a/test.sh.

Puis, dans cet ordre — construire d'abord, brancher ensuite :

  ./init.sh --check
  git add apps/$a && git commit     # commit 1 : la CI publie l'image
  ./init.sh --app $a --enable       # une fois l'image publiee
  git add apps/$a/app.yml compose.yaml && git commit   # commit 2 : le deploiement

Le healthcheck appellera : $health_cmd
Assure-toi que cet outil existe dans l'image finale, sinon le conteneur sera
declare malsain en permanence. Image sans shell : --health-cmd none.
EOF
}

# --- mise a jour ciblee d'un app.yml --------------------------------------------

set_key() {  # set_key <fichier> <cle> <valeur> — preserve commentaires et ordre
  local f="$1" k="$2" v="$3"
  if grep -qE "^$k:" "$f"; then
    local tmp; tmp=$(mktemp)
    awk -v k="$k" -v v="$v" '
      $0 ~ "^" k ":" && !done { print k ": " v; done=1; next } { print }
    ' "$f" > "$tmp" && mv "$tmp" "$f"
  else
    printf '%s: %s\n' "$k" "$v" >> "$f"
  fi
}

apply_target_options() {
  [ -n "$TARGET" ] || return 0
  [ ${#SET[@]} -gt 0 ] || return 0
  local f="apps/$TARGET/app.yml" k
  [ -f "$f" ] || { echo "ERREUR : $f introuvable — ./init.sh --add $TARGET" >&2; exit 1; }
  for k in "${!SET[@]}"; do
    set_key "$f" "$k" "${SET[$k]}"
    ok "apps/$TARGET/app.yml : $k = ${SET[$k]}"
  done
}

# --- la branche de travail ------------------------------------------------------
#
# Convention : <app>/<sujet>, ou fabrique/<sujet> pour ce qui touche init.sh, la
# CI, le contrat ou l'outillage. Le prefixe dit quel perimetre est en jeu — donc
# quel rayon de souffle — avant meme d'ouvrir le diff.
#
# Une exception, subie et non choisie : le harnais cloud assigne des branches
# claude/<sujet>. Voir la validation plus bas.

BASE=$(fab base_branch main)
PREFIXE_HARNAIS=claude

apps_touchees() {  # les apps modifiees depuis la base, travail non committe inclus
  {
    git diff --name-only "origin/$BASE...HEAD" 2>/dev/null || true
    git status --porcelain 2>/dev/null | cut -c4- || true
  } | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u \
    | while IFS= read -r a; do
        # Un if, et non « [ -f ... ] && printf » : sous set -e, un test faux
        # ferait sortir la boucle en code 1, donc la substitution de commande,
        # donc le script entier — et --pret s'arreterait sans rien dire.
        if [ -f "apps/$a/app.yml" ]; then printf '%s\n' "$a"; fi
      done
}

# --- le journal des anomalies ---------------------------------------------------
#
# Une entree par branche, ouverte avec elle et remplie au fil du travail. Ecrite
# a chaud, elle retient les anomalies mineures ; reconstituee a la fin, elle ne
# garde que les spectaculaires — or ce sont les mineures qui disent ou le
# contrat a un trou.
#
# La branche donne le nom du fichier, ce qui rend l'entree retrouvable sans
# index : fabrique/journal-des-anomalies -> journal/<date>-fabrique-journal-des-anomalies.md
# La date est figee a la creation, donc on retrouve par suffixe, jamais par date.

# Deux champs sont a vocabulaire ferme, parce que le lecteur du journal peut
# etre un agent qui en tire des plans d'amelioration : en prose libre, « moi »,
# « la critique impeccable » et « le compilateur » ne s'agregent pas, et la
# distribution que le journal promet n'est pas calculable. Constate sur les deux
# premieres entrees, ou treize valeurs ont donne six categories informelles —
# aucune conforme au gabarit qui les demandait.
#
# DETECTE est ordonne par cout croissant : plus une anomalie est rattrapee tard,
# plus elle a coute. L'agregat utile est « jusqu'ou la distribution glisse vers
# la droite », pas un simple decompte.
#
# Les etiquettes des deux champs s'ecrivent sans accents — « Detecte par », pas
# « Detecte par » accentue — comme tout le markdown genere par ce fichier. Le
# motif de verification reste ainsi en ASCII pur, insensible a la locale, et la
# prose accentuee vit dans Symptome et Cause qui ne sont pas verifies.

JOURNAL_DIR=journal
JOURNAL_MARQUEUR=REMPLIS-MOI   # present = gabarit nu ; retire = entree ecrite
JOURNAL_DETECTE='compilateur|test|CI|relecture|auteur|utilisateur|production'
JOURNAL_ACTION='rien|contrat|garde-fou|outillage|comportement|arbitrage'

journal_slug() { printf '%s' "${1//\//-}"; }

journal_entree() {  # journal_entree <branche> — le chemin de l'entree, ou vide
  local m
  m=$(ls "$JOURNAL_DIR"/*-"$(journal_slug "$1")".md 2>/dev/null | head -1)
  printf '%s' "$m"
}

journal_ouvre() {  # journal_ouvre <branche> — cree l'entree si elle n'existe pas
  local br="$1" f
  f=$(journal_entree "$br")
  [ -n "$f" ] && { ok "journal : entree existante ($f)"; return 0; }

  mkdir -p "$JOURNAL_DIR"
  f="$JOURNAL_DIR/$(date -u +%Y-%m-%d)-$(journal_slug "$br").md"
  render __BRANCHE__ "$br" __DATE__ "$(date -u +%Y-%m-%d)" __MARQUEUR__ "$JOURNAL_MARQUEUR" \
    > "$f" <<'MD'
# __DATE__ — __BRANCHE__

<!-- __MARQUEUR__ : retire ce commentaire quand l'entree dit quelque chose.

     Une anomalie par bloc, ecrite quand tu la rencontres.

     Deux champs sont a vocabulaire ferme et ./init.sh --check les verifie. Ce
     n'est pas de la bureaucratie : le lecteur de ce journal peut etre un agent
     qui en tire des plans d'amelioration, et « moi » ou « le compilateur » ne
     s'agregent pas. La prose va dans Symptome et Cause, qui sont libres.

     Detecte par — qui a rattrape l'anomalie, du moins cher au plus cher :

       compilateur   immediat, cout nul
       test          avant meme de lancer
       CI            avant la fusion
       relecture     humaine ou outillee, avant livraison
       auteur        en cours de travail, apres coup
       utilisateur   apres livraison : un aller-retour, et un garde-fou manquant
       production    apres deploiement

     Action — ce que l'anomalie devrait changer :

       rien          reparee, rien a en tirer
       contrat       CLAUDE.md dit quelque chose de faux, ou ne dit rien
       garde-fou     init.sh --check, --pret, ou un hook devrait le voir
       outillage     un plugin, un LSP, un agent manque
       comportement  facon de travailler, aucun artefact a changer
       arbitrage     demande une decision humaine, pas un correctif

     Une session sans anomalie est une entree valide — ecris « Aucune anomalie »
     et retire ce commentaire. Une entree vide et une entree jamais ouverte ne
     disent pas la meme chose. -->

Branche : `__BRANCHE__`
Perimetre : <apps touchees, ou fabrique>

## Anomalies

### 1. <ce qui a mal tourne, en une ligne>

**Symptome** — ce qui a ete observe.

**Cause** — ce qui l'a produit.

**Detecte par** — `auteur`

**Action** — `rien` — pourquoi, en une ligne.
MD
  ok "journal : entree ouverte ($f)"
}

if [ -n "$BRANCHE" ]; then
  discover_apps
  prefixe=${BRANCHE%%/*}; sujet=${BRANCHE#*/}

  if [ "$prefixe" = "$BRANCHE" ]; then
    echo "ERREUR : '$BRANCHE' n'a pas de prefixe." >&2
    echo "Attendu : <app>/<sujet>, ou fabrique/<sujet> pour l'infrastructure." >&2
    echo "Apps disponibles : ${APPS[*]}" >&2
    exit 1
  fi

  # Le harnais cloud assigne lui-meme le nom de la branche, sous la forme
  # claude/<sujet>, et interdit de pousser ailleurs. Ce prefixe ne dit rien du
  # perimetre — c'est sa limite, pas une faute : la branche n'a pas choisi son
  # nom. Le refuser rendait --branche inutilisable en session cloud, donc
  # empechait d'y ouvrir l'entree de journal. Il est accepte pour rejoindre une
  # branche existante, jamais pour en creer une : personne ne choisit ce prefixe.
  connu=0
  [ "$prefixe" = fabrique ] && connu=1
  for a in "${APPS[@]}"; do [ "$a" = "$prefixe" ] && connu=1; done
  if [ "$prefixe" = "$PREFIXE_HARNAIS" ]; then
    if git show-ref --verify --quiet "refs/heads/$BRANCHE"; then
      connu=1
    else
      echo "ERREUR : le prefixe '$PREFIXE_HARNAIS' est celui du harnais cloud, qui l'assigne lui-meme." >&2
      echo "Il ne se choisit pas : pour une branche neuve, prends <app>/<sujet> ou fabrique/<sujet>." >&2
      echo "Apps disponibles : ${APPS[*]}" >&2
      exit 1
    fi
  fi
  if [ "$connu" = 0 ]; then
    echo "ERREUR : prefixe '$prefixe' inconnu." >&2
    echo "Attendu : <app>/<sujet>, ou fabrique/<sujet> pour l'infrastructure." >&2
    echo "Apps disponibles : ${APPS[*]}" >&2
    exit 1
  fi

  printf '%s' "$sujet" | grep -qE '^[a-z0-9][a-z0-9-]*$' || {
    echo "ERREUR : sujet '$sujet' invalide — minuscules, chiffres et tirets." >&2; exit 1; }

  if git show-ref --verify --quiet "refs/heads/$BRANCHE"; then
    git switch "$BRANCHE"
    ok "branche existante : $BRANCHE"
  else
    # Partir de la base a jour plutot que du HEAD courant : une branche greffee
    # sur une autre branche de travail traine ses commits dans sa PR.
    git fetch origin "$BASE" >/dev/null 2>&1 || warn "origin/$BASE non joignable, depart depuis HEAD"
    if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
      git switch -c "$BRANCHE" "origin/$BASE"
    else
      git switch -c "$BRANCHE"
    fi
    ok "branche creee : $BRANCHE"
  fi
  # L'entree s'ouvre avec la branche : c'est le seul moment ou le geste est
  # gratuit, et le seul qui permette d'ecrire les anomalies a chaud.
  journal_ouvre "$BRANCHE"
  exit 0
fi

# --- --pret : cette etape est-elle committable ? --------------------------------
#
# Le point de passage avant chaque commit. Un commit qui casse quelque chose
# rend la relecture plus dure, pas plus simple : c'est tout l'interet de
# committer par etapes verifiees plutot qu'au kilometre.

if [ "$PRET" = 1 ]; then
  courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  echo "Etape en cours — branche $courante"

  if [ "$courante" = "$BASE" ]; then
    bad "sur $BASE : le travail doit vivre sur une branche dediee (./init.sh --branche <app>/<sujet>)"
  else
    ok "branche dediee"
  fi

  if "$0" --check >/tmp/.pret-check.$$ 2>&1; then
    ok "contrat respecte"
  else
    bad "./init.sh --check echoue :"
    grep -E 'KO' /tmp/.pret-check.$$ | sed 's/^/      /' || true
  fi
  rm -f /tmp/.pret-check.$$

  # Le journal se verifie ici et pas seulement en CI : rendu a la relecture de
  # la PR, le detail des anomalies est deja perdu. Le gabarit nu ne compte pas —
  # sans ce second test, le geste deviendrait une case a cocher vide.
  if [ "$courante" != "$BASE" ]; then
    entree=$(journal_entree "$courante")
    if [ -z "$entree" ]; then
      bad "journal : aucune entree pour $courante (./init.sh --branche $courante l'ouvre)"
    elif grep -q "$JOURNAL_MARQUEUR" "$entree"; then
      bad "journal : $entree est encore le gabarit nu — ecris-y les anomalies de cette branche"
    else
      ok "journal : $entree"
    fi
  fi

  # Seules les apps reellement touchees depuis la base : sur une fabrique qui
  # grandit, tout relancer a chaque commit couterait plus que ca ne rapporte.
  touchees=$(apps_touchees)
  if [ -z "$touchees" ]; then
    ok "aucune app modifiee — pas de test a lancer"
  else
    for a in $touchees; do
      if [ ! -x "apps/$a/test.sh" ]; then
        bad "[$a] test.sh absent ou non executable"
      elif "apps/$a/test.sh" >/tmp/.pret-test.$$ 2>&1; then
        ok "[$a] tests verts"
      else
        bad "[$a] tests en echec :"
        tail -15 /tmp/.pret-test.$$ | sed 's/^/      /'
      fi
      rm -f /tmp/.pret-test.$$
    done
  fi

  echo
  [ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s) — ne committe pas en l'etat."; exit 1; }
  echo "Etape verifiee. Tu peux committer."
  exit 0
fi

# --- --branches-fusionnees : ce qui peut partir, et ce qui ne le peut pas -------
#
# Une session cloud ouvre des branches et ne peut pas en fermer : le relais git
# du harnais refuse la suppression de refs (HTTP 403 sur git-receive-pack), et
# le serveur MCP GitHub expose create_branch sans son inverse. Les branches
# fusionnees s'accumulent donc sans que rien ne le signale. Cette commande ne
# supprime rien — elle n'en a pas le droit — elle dit QUOI supprimer, ce qui est
# la partie qu'on ne peut pas faire de tete.
#
# Le critere n'est pas l'appartenance a l'ascendance de la base : sur ce depot
# il s'est trompe dans les deux sens. Il a classe « non fusionnees » trois
# branches simplement ecrasees en un commit (squash), dont le contenu etait bel
# et bien dans main ; et il n'a rien dit d'une branche dont la PR etait fusionnee
# mais qui portait cinq commits ecrits APRES, jamais repris. C'est l'equivalence
# de patch — git cherry, qui compare les patch-id — qui repond juste dans les
# deux cas. Un commit de fusion n'a pas de patch-id et git cherry l'ignore :
# c'est correct, « merge branch main » n'apporte rien que main n'ait deja.

if [ "$FUSIONNEES" = 1 ]; then
  git fetch --prune origin "+refs/heads/*:refs/remotes/origin/*" >/dev/null 2>&1 \
    || warn "origin non joignable — l'etat ci-dessous peut etre perime"

  # La branche sur laquelle on travaille est exclue : elle peut etre fusionnee
  # et servir malgre tout a l'etape en cours — c'est le cas normal d'une session
  # cloud, dont le nom de branche est impose et reutilise d'une PR a la suivante.
  courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

  fusionnees=() vivantes=() ignoree=""
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
    b=${ref#origin/}
    [ "$b" = "$BASE" ] && continue
    [ "$b" = HEAD ] && continue
    [ "$b" = "$courante" ] && { ignoree="$b"; continue; }
    # git cherry n'imprime que les commits absents de la base : « + » pour un
    # patch inedit, « - » pour un patch deja present sous un autre sha.
    if [ -z "$(git cherry "origin/$BASE" "$ref" 2>/dev/null | grep '^+' || true)" ]; then
      fusionnees+=("$b")
    else
      vivantes+=("$b:$(git cherry "origin/$BASE" "$ref" 2>/dev/null | grep -c '^+' || echo '?')")
    fi
  done

  [ -n "$ignoree" ] && { echo "-- ignoree"; warn "$ignoree — branche courante"; echo; }
  echo "-- fusionnees dans $BASE — supprimables"
  if [ ${#fusionnees[@]} -eq 0 ]; then
    echo "  (aucune)"
  else
    for b in "${fusionnees[@]}"; do ok "$b"; done
  fi

  echo
  echo "-- a regarder — patchs absents de $BASE"
  if [ ${#vivantes[@]} -eq 0 ]; then
    echo "  (aucune)"
  else
    for v in "${vivantes[@]}"; do warn "${v%:*} — ${v##*:} patch(s) inedit(s)"; done
    echo
    # Le titre de cette section dit « a regarder » et non « non fusionnees »,
    # parce que l'equivalence de patch ne sait pas voir un contenu REECRIT. Un
    # travail repris a un autre chemin, ou refait a la main, produit un patch
    # different : la branche est signalee ici alors que son contenu est bien
    # dans la base. La commande ne peut pas trancher ce cas — elle le remonte
    # plutot que de proposer une suppression qu'elle ne sait pas justifier.
    echo "  Un patch inedit ne veut pas dire un travail perdu : un contenu repris"
    echo "  a un autre chemin, ou refait a la main, produit un patch different."
    echo "  Compare avant de conclure :  git log --oneline origin/$BASE..origin/<branche>"
  fi

  if [ ${#fusionnees[@]} -gt 0 ]; then
    echo
    echo "Depuis une machine dont l'acces git n'est pas contraint :"
    echo
    for b in "${fusionnees[@]}"; do echo "  git push origin --delete $b"; done
    echo
    echo "Une suppression ne perd rien : ces patchs sont dans $BASE, et GitHub"
    echo "sait restaurer une branche pendant 90 jours."
  fi
  exit 0
fi

# --- --list ---------------------------------------------------------------------

if [ "$LIST" = 1 ]; then
  discover_apps
  printf '%-24s %-6s %-7s %-9s %-12s %-4s %s\n' APP PORT MEMOIRE EXPOSURE STACK UI ETAT
  for a in "${APPS[@]}"; do
    load_app "$a"
    printf '%-24s %-6s %-7s %-9s %-12s %-4s %s\n' \
      "$APP" "$A_PORT" "$A_MEMORY" "$A_EXPOSURE" "$A_STACK" "$A_UI" \
      "$([ "$A_ENABLED" = true ] && echo active || echo desactivee)"
  done
  exit 0
fi

# --- --check --------------------------------------------------------------------

services_list() {  # noms de service declares dans le compose, dans l'ordre
  awk '
    /^services:[[:space:]]*$/ { s=1; next }
    /^[^[:space:]#]/          { s=0 }
    s && /^  [^[:space:]#]/   { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); print n }
  ' "$1"
}

service_yaml() {  # service_yaml <fichier> <nom> — le bloc du service
  awk -v want="$2" '
    /^services:[[:space:]]*$/ { ins=1; next }
    /^[^[:space:]#]/          { ins=0; cur=0 }
    !ins { next }
    /^  [^[:space:]#]/ { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); cur=(n==want); next }
    cur { print }
  ' "$1"
}

SANS_AUTH=()

check_service() {
  load_app "$1"
  local p="[$APP]" blk
  blk=$(service_yaml "$COMPOSE" "$APP")
  if [ -z "$blk" ]; then bad "$p aucun service dans $COMPOSE"; return; fi
  has() { grep -qF -- "$1" <<<"$blk"; }

  # L'authentification d'abord, et ancree au nom du routeur. La virgule finale
  # est essentielle : sans elle « middlewares=forwardauth » matcherait
  # « middlewares=forwardauth-open,... » et une app declaree private passerait
  # au vert avec l'authentification ouverte a tout compte Google.
  if has "traefik.http.routers.$APP.middlewares=$A_MW,$SECURITY_HEADERS"; then
    ok "$p palier $A_EXPOSURE -> $A_MW"
  else
    bad "$p PALIER NON CONFORME — middleware $A_MW attendu (exposure $A_EXPOSURE)"
    SANS_AUTH+=("$APP")
  fi

  # Palier public : faute d'authentification, Traefik ne pose NI n'ecrase
  # X-Forwarded-User. L'en-tete passe donc sous le controle du client, qui peut
  # y mettre l'adresse de son choix : une app qui le lit croit identifier un
  # utilisateur en lisant une valeur forgee. Bloquant, pas cosmetique.
  # -i : Node, Go et consorts normalisent les en-tetes en minuscules.
  if [ "$A_EXPOSURE" = public ]; then
    warn "$p palier public — accessible SANS authentification"
    if git ls-files -z "apps/$APP" 2>/dev/null | grep -zvE '\.md$' \
         | xargs -0 -r grep -liI 'x-forwarded-user' 2>/dev/null | grep -q .; then
      bad "$p lit X-Forwarded-User en exposure public — en-tete forgeable par n'importe qui"
    else
      ok "$p aucune lecture de X-Forwarded-User"
    fi
  fi

  has "traefik.http.routers.$APP.priority=100"                      && ok "$p priority=100"          || bad "$p priority=100 absent — 404 silencieux garanti"
  has "traefik.http.routers.$APP.rule=Host(\`$APP.$DOMAIN\`)"       && ok "$p Host($APP.$DOMAIN)"    || bad "$p regle Host() absente ou fausse"
  has "traefik.http.services.$APP.loadbalancer.server.port=$A_PORT" && ok "$p server.port=$A_PORT"   || bad "$p server.port different de app.yml"
  has "traefik.http.routers.$APP.tls.certresolver=$CERT_RESOLVER"   && ok "$p certresolver"          || bad "$p certresolver absent — pas de TLS"
  has "traefik.enable=true"                                         && ok "$p routage active"        || bad "$p traefik.enable absent"
  has "traefik.docker.network=$NETWORK"                             && ok "$p reseau annonce"        || bad "$p traefik.docker.network absent"
  has "mem_limit: $A_MEMORY"                                        && ok "$p mem_limit"             || bad "$p mem_limit different de app.yml"
  has "container_name: $APP"                                        && ok "$p container_name"        || bad "$p container_name absent ou different du nom d'app"
  has "pull_policy: always"                                         && ok "$p pull_policy"           || bad "$p pull_policy absent — servirait l'image locale perimee"
  has "image: $REGISTRY/$ORG/$REPO/$APP:"                           && ok "$p image conforme"        || bad "$p image hors convention de nommage"
  has "max-size:"                                                   && ok "$p journaux bornes"       || bad "$p logging absent — journal non borne"
  grep -qE '^[[:space:]]*ports:' <<<"$blk" && bad "$p section ports: interdite — Traefik joint le conteneur par le reseau" || ok "$p aucun port publie"
  grep -qF "$NETWORK" <<<"$blk"            && ok "$p sur $NETWORK" || bad "$p absent du reseau $NETWORK"
}

check_app_files() {
  load_app "$1"
  local p="[$APP]" d="apps/$APP"

  if [ -f "$d/Dockerfile" ]; then
    ok "$p Dockerfile"
    grep -qE '^[[:space:]]*USER[[:space:]]+' "$d/Dockerfile" \
      && ok "$p USER declare (non root)" || bad "$p Dockerfile sans USER : conteneur en root"
    grep -qiE '^[[:space:]]*FROM .* AS ' "$d/Dockerfile" \
      && ok "$p construction multi-etapes" || warn "$p pas de multi-etapes : surveille la taille"
    # Le routage vit dans le compose. Un LABEL traefik.* dans le Dockerfile
    # serait fusionne dans les labels du conteneur et publierait un routeur
    # SUPPLEMENTAIRE, que le compose ne peut pas ecraser puisqu'il porte un
    # autre nom : donc sans aucun middleware d'authentification.
    grep -qi 'traefik\.' "$d/Dockerfile" \
      && bad "$p LABEL traefik.* dans le Dockerfile — publierait une route SANS authentification" \
      || ok "$p aucun label traefik dans le Dockerfile"
    # une image sans shell ne peut pas executer un healthcheck CMD-SHELL
    if grep -qiE '^[[:space:]]*FROM .*(scratch|distroless)' "$d/Dockerfile" && [ "$A_HEALTH_CMD" != none ]; then
      bad "$p image sans shell (scratch/distroless) mais health_cmd defini — mets 'none' ou change de base"
    fi
    if [ "$A_HEALTH_CMD" != none ]; then
      local tool; tool=$(printf '%s' "$A_HEALTH_CMD" | awk '{print $1}')
      grep -q "$tool" "$d/Dockerfile" \
        && ok "$p $tool semble present dans l'image" \
        || warn "$p health_cmd utilise '$tool' : verifie qu'il existe dans l'image finale"
    fi
  elif [ "$A_ENABLED" = true ]; then
    bad "$p $d/Dockerfile absent — l'app est activee mais rien ne peut la construire"
  else
    warn "$p pas encore de Dockerfile (app desactivee)"
  fi

  [ -x "$d/test.sh" ] && ok "$p test.sh executable" \
    || bad "$p $d/test.sh absent ou non executable — ses tests ne tourneront jamais"
  [ -f "$d/.dockerignore" ] && ok "$p .dockerignore" || warn "$p pas de .dockerignore : la doc casse le cache de build"
  [ -f "$d/PRODUCT.md" ]   && ok "$p PRODUCT.md"    || warn "$p pas de PRD"
}

if [ "$CHECK" = 1 ]; then
  discover_apps
  [ ${#APPS[@]} -gt 0 ] || { echo "ERREUR : aucune app sous apps/ — ./init.sh --add <nom>" >&2; exit 1; }
  compute_tooling

  APPS_ACTIVES=()
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_ENABLED" = true ] && APPS_ACTIVES+=("$a")
  done

  echo "Verification — fabrique $ORG/$REPO : ${#APPS[@]} app(s), ${#APPS_ACTIVES[@]} activee(s)"
  echo

  # 1. Reproductibilite : le fichier committe correspond-il aux manifestes ?
  # Ce controle-la est le seul capable de prouver que compose.yaml decrit bien
  # les apps/*/app.yml — aucune liste de grep ne le saura jamais.
  echo "-- artefacts derives"
  for f in "${DERIVES[@]}"; do
    if [ "$f" = go.work ] && ! emit go.work >/dev/null 2>&1; then
      [ -f go.work ] && bad "go.work present mais aucune app Go" || ok "go.work sans objet"
      continue
    fi
    if [ ! -f "$f" ]; then
      bad "$f absent — lance ./init.sh"
    elif diff -q <(emit "$f") "$f" >/dev/null 2>&1; then
      ok "$f a jour"
    else
      bad "$f desynchronise des manifestes — lance ./init.sh (--dry-run pour voir l'ecart)"
    fi
  done

  # 2. Le compose, service par service.
  echo
  echo "-- services"
  if [ ! -f "$COMPOSE" ]; then
    bad "$COMPOSE absent — lance ./init.sh"
  else
    for a in "${APPS_ACTIVES[@]}"; do check_service "$a"; done

    # Un doublon de cle YAML est legal et silencieux : la derniere gagne, la
    # premiere disparait du deploiement sans un mot.
    dup() { LC_ALL=C sort | uniq -d | grep -q .; }
    services_list "$COMPOSE" | dup \
      && bad "un nom de service apparait deux fois dans $COMPOSE" || ok "noms de service uniques"
    grep -o 'rule=Host(`[^`]*`)' "$COMPOSE" | dup \
      && bad "deux apps revendiquent le meme hostname — Traefik en servirait une au hasard" || ok "hostnames uniques"
    grep -hE '^[[:space:]]*container_name:' "$COMPOSE" | awk '{print $2}' | dup \
      && bad "container_name en double — docker compose up echouerait pour TOUTE la stack" || ok "container_name uniques"

    # Les ports, eux, n'ont pas a etre uniques : chaque app ecoute dans son
    # propre conteneur, aucun port n'est publie sur l'hote, et Traefik joint
    # chaque conteneur par son IP sur le reseau. Trois apps sur 8080 sont
    # parfaitement correctes — un controle d'unicite serait un faux positif.

    if diff <(printf '%s\n' "${APPS_ACTIVES[@]-}" | LC_ALL=C sort) \
            <(services_list "$COMPOSE" | LC_ALL=C sort) >/dev/null 2>&1; then
      ok "$COMPOSE couvre exactement les apps activees"
    else
      bad "ecart entre apps/*/app.yml et les services de $COMPOSE — lance ./init.sh"
    fi

    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose -f "$COMPOSE" config -q >/dev/null 2>&1 \
        && ok "$COMPOSE valide pour docker compose" || bad "$COMPOSE invalide pour docker compose"
    fi
  fi

  # 3. Les fichiers de chaque app.
  echo
  echo "-- applications"
  for a in "${APPS[@]}"; do check_app_files "$a"; done

  # 4. Memoire engagee. La stack est unique : tout demarre d'un coup, et un
  # depassement fait tuer un voisin par l'OOM killer.
  echo
  echo "-- fabrique"
  total=0
  for a in "${APPS_ACTIVES[@]-}"; do
    [ -n "$a" ] || continue
    total=$(( total + $(mem_to_mb "$(app_get "$a" memory 128m)") ))
  done
  cap=$(mem_to_mb "$MEMORY_BUDGET")
  if [ "$total" -le "$cap" ]; then
    ok "memoire engagee ${total} Mo / ${cap} Mo"
  else
    warn "memoire engagee ${total} Mo au-dela du plafond ${cap} Mo de fabrique.yml — verifie la RAM du serveur"
  fi

  # Un fichier de routage oublie a cote reste une seconde source de verite, que
  # ./init.sh ne regenere plus : il divergera en silence.
  [ -f "$LEGACY_COMPOSE" ] && bad "$LEGACY_COMPOSE encore present — dockhand ne le lit pas, supprime-le" \
                           || ok "aucun $LEGACY_COMPOSE residuel"
  [ -f .dockerignore ] && bad ".dockerignore a la racine — sans effet avec context: apps/<nom>, supprime-le" \
                       || ok "aucun .dockerignore racine residuel"
  [ -f fabrique.yml ] && ok "fabrique.yml present" || bad "fabrique.yml absent — lance ./init.sh"

  # Un lien vers un fichier disparu est le symptome le plus courant d'une
  # reorganisation incomplete — le risque propre a une fabrique qui deplace des
  # applications. Boucle `for` et non tube : bad() doit rester dans ce shell.
  morts=0
  for src in README.md CLAUDE.md PRODUCT.md apps/*/*.md journal/*.md; do
    [ -f "$src" ] || continue
    for cible in $(grep -oE '\]\([^)#:]+\.md\)' "$src" | sed -E 's/^\]\((.*)\)$/\1/'); do
      [ -f "$(dirname "$src")/$cible" ] || { bad "lien mort : $src -> $cible"; morts=$((morts+1)); }
    done
  done
  [ "$morts" -eq 0 ] && ok "aucun lien mort entre les documents"

  # 5. Outillage de l'agent.
  echo
  echo "-- outillage"
  if [ -f .claude/settings.json ]; then
    if command -v python3 >/dev/null && ! python3 -m json.tool .claude/settings.json >/dev/null 2>&1; then
      bad ".claude/settings.json n'est pas du JSON valide"
    else
      ok ".claude/settings.json present (${#PLUGIN_IDS[@]} plugins)"
    fi
    # Un settings.json versionne qui porterait un bloc env exposerait ses valeurs
    # a quiconque clone le depot : c'est la voie la plus courante de fuite de jeton.
    grep -q '"env"' .claude/settings.json \
      && bad "bloc \"env\" dans .claude/settings.json versionne — n'y mets jamais de secret" \
      || ok "aucun bloc env dans le settings versionne"
  else
    bad ".claude/settings.json absent — lance ./init.sh"
  fi
  [ -x .claude/check-plugins.sh ] && ok "rapport d'outillage executable" \
                                  || bad ".claude/check-plugins.sh absent ou non executable"

  # Les scripts generes le sont par substitution de fragments : une erreur du
  # generateur produit un fichier plausible mais inanalysable, qui echouerait
  # silencieusement au demarrage d'une session cloud. bash -n le voit tout de
  # suite, et coute une milliseconde.
  for s in .claude/check-plugins.sh .claude/cloud-setup.sh .claude/garde-*.sh apps/*/test.sh; do
    [ -f "$s" ] || continue
    bash -n "$s" 2>/dev/null && ok "$s analysable" || bad "$s : erreur de syntaxe shell"
  done

  # Le setup script vit dans l'environnement cloud, hors du depot : rien ne le
  # resynchronise. Signale l'ecart, faute de pouvoir le corriger d'ici.
  if [ -f .claude/cloud-setup.sh ]; then
    drift=0
    for p in "${PLUGIN_IDS[@]}"; do grep -qF "$p" .claude/cloud-setup.sh || drift=1; done
    for b in "${LSP_BINS[@]-}"; do [ -z "$b" ] || grep -qF "$b" .claude/cloud-setup.sh || drift=1; done
    [ "$drift" = 0 ] && ok "cloud-setup.sh aligne sur ${#PLUGIN_IDS[@]} plugins et ${#LSP_BINS[@]} LSP" \
                     || warn "cloud-setup.sh desynchronise — ./init.sh, puis recolle-le sur claude.ai/code"
    # Sans cette ligne le setup script tourne, sort en 0, et n'installe rien :
    # avant le premier lancement de Claude Code aucune marketplace n'existe.
    grep -qF 'marketplace add anthropics/claude-plugins-official' .claude/cloud-setup.sh \
      && ok "cloud-setup.sh declare la marketplace officielle" \
      || bad "cloud-setup.sh n'enregistre pas anthropics/claude-plugins-official — il echouerait en silence"
    [ "${#LSP_BINS[@]}" -le 3 ] || warn "${#LSP_BINS[@]} serveurs LSP a installer — le budget de 5 minutes du setup script devient douteux"
  else
    bad ".claude/cloud-setup.sh absent — les plugins resteraient inertes en session cloud"
  fi

  # 6. Journal des anomalies. Une entree suivie par git est une entree livree :
  # elle doit dire quelque chose. Une entree non suivie est un travail en cours,
  # et ne se juge pas — c'est ce qui laisse --check vert entre l'ouverture de la
  # branche et le premier commit, sans rien relacher en CI, ou tout est suivi.
  echo
  echo "-- journal"
  if [ -d "$JOURNAL_DIR" ]; then
    mauvaises=0 total=0 anomalies=0
    for e in "$JOURNAL_DIR"/[0-9]*.md; do
      [ -f "$e" ] || continue
      git ls-files --error-unmatch "$e" >/dev/null 2>&1 || continue
      total=$((total+1))
      faute=0
      grep -q "$JOURNAL_MARQUEUR" "$e" && { bad "$e : gabarit nu committe"; faute=1; }
      grep -q '^## Anomalies' "$e" || { bad "$e : section '## Anomalies' absente"; faute=1; }

      # Chaque anomalie doit porter ses deux champs fermes. Compter les titres et
      # les champs valides suffit : un jeton hors vocabulaire ne matche pas, donc
      # le compte tombe — pas besoin d'analyser le document.
      n=$(grep -c '^### ' "$e" || true)
      d=$(grep -cE "^\*\*Detecte par\*\* — \`($JOURNAL_DETECTE)\`" "$e" || true)
      a=$(grep -cE "^\*\*Action\*\* — \`($JOURNAL_ACTION)\`" "$e" || true)
      [ "$d" -eq "$n" ] || { bad "$e : $d/$n champ(s) 'Detecte par' valide(s) — $JOURNAL_DETECTE"; faute=1; }
      [ "$a" -eq "$n" ] || { bad "$e : $a/$n champ(s) 'Action' valide(s) — $JOURNAL_ACTION"; faute=1; }

      anomalies=$((anomalies+n))
      [ "$faute" = 0 ] || mauvaises=$((mauvaises+1))
    done
    [ "$mauvaises" -eq 0 ] && ok "$total entree(s), $anomalies anomalie(s), champs agregeables"
  else
    warn "aucun journal/ — la premiere ./init.sh --branche l'ouvrira"
  fi

  # 7. Secrets. Les motifs de jeton sont ecrits avec une classe d'un seul
  # caractere — gh[p]_ — pour que ce script, lui-meme suivi par git, ne se
  # detecte pas comme fuite a chaque lancement.
  echo
  echo "-- secrets"
  if git ls-files -z 2>/dev/null | xargs -0 -r grep -lIE \
       '(gh[p]_|github_pa[t]_|xox[baprs]-|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' \
       2>/dev/null | grep -q .; then
    bad "secret potentiel dans un fichier suivi"
  else
    ok "aucun secret evident dans les fichiers suivis"
  fi

  echo
  if [ ${#SANS_AUTH[@]} -gt 0 ]; then
    printf '\033[41;97m  %d APPLICATION(S) AU PALIER NON CONFORME  \033[0m\n' "${#SANS_AUTH[@]}"
    for a in "${SANS_AUTH[@]}"; do printf '    %s -> https://%s.%s\n' "$a" "$a" "$DOMAIN"; done
    echo "  Le compose ne pose pas le middleware declare dans app.yml. Ne pousse pas."
    echo
  fi
  [ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s)."; exit 1; }
  echo "Contrat respecte. Tu peux pousser sur main."
  exit 0
fi

# --- generation -----------------------------------------------------------------

if [ -n "$ADD" ]; then
  discover_apps
  scaffold_app "$ADD"
  echo
fi

discover_apps
[ ${#APPS[@]} -gt 0 ] || { echo "ERREUR : aucune app sous apps/ — ./init.sh --add <nom>" >&2; exit 1; }

apply_target_options
compute_tooling

if [ ! -f fabrique.yml ]; then
  cat > fabrique.yml <<YAML
# Valeurs communes a toutes les applications de la fabrique.
# Modifie ce fichier puis relance ./init.sh.
org: $ORG
repo: $REPO                 # entre dans le nom des images : $REGISTRY/$ORG/$REPO/<app>
registry: $REGISTRY
domain: $DOMAIN             # chaque app est servie sur <nom-app>.<domain>
network: $NETWORK           # reseau Docker existant cote serveur
entrypoint: $ENTRYPOINT
cert_resolver: $CERT_RESOLVER
security_headers: $SECURITY_HEADERS
memory_budget: $MEMORY_BUDGET   # plafond de la somme des mem_limit
image_max_mb: $IMAGE_MAX_MB
log_max_size: $LOG_MAX_SIZE     # cap des journaux json-file, par service
log_max_file: $LOG_MAX_FILE
YAML
  ok "fabrique.yml"
fi

echo "Fabrique $ORG/$REPO — ${#APPS[@]} application(s)"

if [ "$DRYRUN" = 1 ]; then
  for f in "${DERIVES[@]}"; do
    if [ "$f" = go.work ] && ! emit go.work >/dev/null 2>&1; then continue; fi
    if [ ! -f "$f" ]; then
      warn "$f serait cree"
    elif diff -q <(emit "$f") "$f" >/dev/null 2>&1; then
      ok "$f inchange"
    else
      warn "$f changerait :"
      diff -u "$f" <(emit "$f") | sed 's/^/    /' || true
    fi
  done
  exit 0
fi

# Un fichier de routage laisse a cote divergerait en silence de compose.yaml.
for dead in "$LEGACY_COMPOSE" .dockerignore; do
  if [ -f "$dead" ]; then rm -f "$dead"; ok "$dead supprime (sans effet dans la fabrique)"; fi
done

# Les artefacts derives sont toujours reecrits : c'est ce qui garantit qu'une
# app ajoutee ne peut pas manquer du compose ni de la CI.
for f in "${DERIVES[@]}"; do
  if [ "$f" = go.work ]; then
    if emit go.work > /tmp/.gowork.$$ 2>/dev/null && [ -s /tmp/.gowork.$$ ]; then
      mv /tmp/.gowork.$$ go.work; ok go.work
    else
      rm -f /tmp/.gowork.$$; [ -f go.work ] && { rm -f go.work; ok "go.work supprime (aucune app Go)"; }
    fi
    continue
  fi
  mkdir -p "$(dirname "$f")"
  # Ecriture atomique : un generateur qui echoue a mi-parcours laisserait sinon
  # un artefact tronque, et un compose tronque est un deploiement casse.
  tmp=$(mktemp)
  emit "$f" > "$tmp"
  mv "$tmp" "$f"
  ok "$f"
done
chmod +x .claude/check-plugins.sh .claude/garde-branche.sh .claude/garde-commit.sh

IGNORES=('.claude/settings.local.json' '.env' '.env.*' '*.log')
# `go build` sans -o depose son binaire dans le repertoire courant, sous le nom
# de ce repertoire : apps/cadran/cadran. Un tel artefact se committe tout seul
# au premier `git add -A`, et alourdit le contexte de construction.
for a in "${APPS[@]}"; do IGNORES+=("/apps/$a/$a"); done
for line in "${IGNORES[@]}"; do
  { [ ! -f .gitignore ] || ! grep -qxF "$line" .gitignore; } && echo "$line" >> .gitignore
done
ok ".gitignore complete"

cat <<EOF

Outillage de l'agent : ${#PLUGIN_IDS[@]} plugins, ${#LSP_BINS[@]} serveur(s) LSP.
Declarer n'installe pas — un seul endroit installe :

  colle .claude/cloud-setup.sh dans le champ "Setup script" de ton
  environnement sur claude.ai/code (icone nuage, engrenage).

Puis :  ./init.sh --check
EOF
