#!/usr/bin/env bash
#
# init.sh — bootstrap d'une application deployee sur billbob.ovh
#
#   ./init.sh [options]    ecrit app.yml puis genere les fichiers d'infra
#   ./init.sh --check      verifie le depot contre app.yml et contre le contrat
#   ./init.sh --force      regenere en ecrasant les fichiers existants
#
# Options (elles alimentent app.yml ; au second lancement, app.yml fait foi
# et seules les options passees explicitement le modifient) :
#
#   --port N            port d'ecoute dans le conteneur      (defaut 8080)
#   --memory X          limite memoire du conteneur          (defaut 128m)
#   --health CHEMIN     chemin HTTP de sante                 (defaut /healthz)
#   --health-cmd CMD    commande de healthcheck, ou "none"   (defaut : wget)
#   --exposure T        private | google                     (defaut private)
#   --stack S           langage principal, active son LSP    (defaut none)
#   --ui / --no-ui      l'app sert une interface web         (defaut no)
#
# --stack et --ui ne changent rien au deploiement : ils determinent les plugins
# ecrits dans .claude/settings.json. Renseigne-les des que tu as choisi ta
# technologie, puis relance ./init.sh --force.
#
# Le script ne genere NI Dockerfile NI code applicatif : le choix de la
# technologie appartient a l'agent. Voir CLAUDE.md.

set -euo pipefail

CHECK=0
FORCE=0
declare -A SET=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)       CHECK=1 ;;
    --force)       FORCE=1 ;;
    --port)        SET[port]="$2";        shift ;;
    --memory)      SET[memory]="$2";      shift ;;
    --health)      SET[health_path]="$2"; shift ;;
    --health-cmd)  SET[health_cmd]="$2";  shift ;;
    --exposure)    SET[exposure]="$2";    shift ;;
    --stack)       SET[stack]="$2";       shift ;;
    --ui)          SET[ui]=true ;;
    --no-ui)       SET[ui]=false ;;
    -h|--help)     sed -n '2,/^set -euo/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

FAILED=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mattn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mKO\033[0m    %s\n' "$1"; FAILED=$((FAILED+1)); }

# --- identite : deduite du depot, jamais codee en dur -------------------------

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
APP=$(basename -s .git "${REMOTE:-$(pwd)}")
ORG=$(printf '%s' "$REMOTE" | sed -E 's#^(https://github\.com/|git@github\.com:)([^/]+)/.*#\2#')
[ -n "$ORG" ] && [ "$ORG" != "$REMOTE" ] || ORG="billbob-space"

printf '%s' "$APP" | grep -qE '^[a-z0-9][a-z0-9-]{1,30}$' || {
  echo "ERREUR : nom d'application invalide : '$APP'" >&2
  echo "Il devient un sous-domaine : minuscules, chiffres et tirets." >&2
  exit 1; }

# --- manifeste : app.yml fait foi, les options le surchargent -----------------

get() {  # get <cle> <defaut>
  local v=""
  [ -f app.yml ] && v=$(sed -nE "s/^$1:[[:space:]]*(.*)$/\1/p" app.yml | head -1)
  v="${v%\"}"; v="${v#\"}"
  printf '%s' "${SET[$1]:-${v:-$2}}"
}

# dockhand, cote serveur, ouvre le fichier Compose par son nom canonique de la
# Compose Spec — compose.yaml — et rien d'autre : un docker-compose.yml lui
# renvoie "Compose file not found" et le deploiement s'arrete la.
COMPOSE=compose.yaml
LEGACY_COMPOSE=docker-compose.yml

PORT=$(get port 8080)
MEMORY=$(get memory 128m)
HEALTH_PATH=$(get health_path /healthz)
EXPOSURE=$(get exposure private)
HEALTH_CMD=$(get health_cmd "wget --spider -q http://localhost:$PORT$HEALTH_PATH")

case "$EXPOSURE" in
  private) MW=forwardauth ;;       # whitelist de comptes Google
  google)  MW=forwardauth-open ;;  # tout compte Google authentifie
  *) echo "ERREUR : exposure doit valoir 'private' ou 'google' (recu : $EXPOSURE)" >&2; exit 1 ;;
esac
printf '%s' "$PORT" | grep -qE '^[0-9]{2,5}$' || { echo "ERREUR : port invalide : $PORT" >&2; exit 1; }

# --- outillage de l'agent : plugins Claude Code --------------------------------
#
# Ces plugins sont declares dans .claude/settings.json, versionne, pour que tout
# clone du depot — un autre humain, une session cloud, un agent en CI — parte
# avec le meme outillage. Un plugin declare n'est PAS installe pour autant :
# .claude/install-plugins.sh fait l'installation, a lancer une fois par machine.

STACK=$(get stack none)
UI=$(get ui false)

case "$UI" in true|false) ;; *) echo "ERREUR : ui doit valoir true ou false (recu : $UI)" >&2; exit 1 ;; esac

# Le LSP donne a l'agent les diagnostics du compilateur apres chaque edition,
# pour zero token de contexte. Le binaire doit exister sur la machine.
case "$STACK" in
  none)                LSP=""; LSP_BIN="" ;;
  typescript|ts|node)  LSP=typescript-lsp;    LSP_BIN=typescript-language-server ;;
  python|py)           LSP=pyright-lsp;       LSP_BIN=pyright-langserver ;;
  go|golang)           LSP=gopls-lsp;         LSP_BIN=gopls ;;
  rust)                LSP=rust-analyzer-lsp; LSP_BIN=rust-analyzer ;;
  java)                LSP=jdtls-lsp;         LSP_BIN=jdtls ;;
  kotlin)              LSP=kotlin-lsp;        LSP_BIN=kotlin-language-server ;;
  php)                 LSP=php-lsp;           LSP_BIN=intelephense ;;
  csharp|dotnet)       LSP=csharp-lsp;        LSP_BIN=csharp-ls ;;
  swift)               LSP=swift-lsp;         LSP_BIN=sourcekit-lsp ;;
  c|cpp|c++)           LSP=clangd-lsp;        LSP_BIN=clangd ;;
  lua)                 LSP=lua-lsp;           LSP_BIN=lua-language-server ;;
  *) echo "ERREUR : stack inconnue : $STACK" >&2
     echo "Valeurs : none typescript python go rust java kotlin php csharp swift cpp lua" >&2
     exit 1 ;;
esac

# Socle : methode de travail, revue, docs a jour, git, securite. ~1 300 tokens
# de contexte au demarrage de l'agent — a comparer aux 26 000 d'un plugin comme
# ecc, ecarte pour cette raison.
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
[ -n "$LSP" ] && PLUGIN_IDS+=("$LSP@claude-plugins-official")
if [ "$UI" = true ]; then
  PLUGIN_IDS+=(
    frontend-design@claude-plugins-official
    playwright@claude-plugins-official       # pilotage navigateur, E2E (MCP)
    impeccable@impeccable                    # finition visuelle — marketplace tierce
  )
fi

# --- verification --------------------------------------------------------------

if [ "$CHECK" = 1 ]; then
  echo "Verification — $APP  (port $PORT, $MEMORY, $EXPOSURE)"

  [ -f app.yml ] && ok "app.yml present" || bad "app.yml absent — lance ./init.sh"

  if [ -f Dockerfile ]; then
    ok "Dockerfile present"
    grep -qE '^[[:space:]]*USER[[:space:]]+' Dockerfile \
      && ok "USER declare (non root)" || bad "Dockerfile sans USER : conteneur en root"
    grep -qiE '^[[:space:]]*FROM .* AS ' Dockerfile \
      && ok "construction multi-etapes" || warn "pas de multi-etapes : surveille la taille"
    # une image sans shell ne peut pas executer un healthcheck CMD-SHELL
    if grep -qiE '^[[:space:]]*FROM .*(scratch|distroless)' Dockerfile \
       && [ "$HEALTH_CMD" != "none" ]; then
      bad "image sans shell (scratch/distroless) mais health_cmd defini — mets 'none' ou change de base"
    fi
    if [ "$HEALTH_CMD" != none ]; then
      tool=$(printf '%s' "$HEALTH_CMD" | awk '{print $1}')
      grep -q "$tool" Dockerfile \
        && ok "$tool semble present dans l'image" \
        || warn "health_cmd utilise '$tool' : verifie qu'il existe dans l'image finale"
    fi
  else
    bad "Dockerfile absent a la racine"
  fi

  if [ -f "$COMPOSE" ]; then
    ok "$COMPOSE present"
    grep -qE '^[[:space:]]*ports:' "$COMPOSE" \
      && bad "section ports: interdite — Traefik joint le conteneur par le reseau" \
      || ok "aucun port publie"
    grep -q "mem_limit: $MEMORY"          "$COMPOSE" && ok "mem_limit conforme a app.yml" || bad "mem_limit absent ou different de app.yml"
    grep -q 'traefik.enable=true'         "$COMPOSE" && ok "routage declare"              || bad "labels traefik absents"
    grep -q 'priority=100'                "$COMPOSE" && ok "priority=100 pose"            || bad "priority=100 absent — 404 silencieux garanti"
    grep -q "middlewares=$MW"             "$COMPOSE" && ok "auth $MW chainee"             || bad "middleware $MW absent — l'app serait EXPOSEE"
    grep -q "server.port=$PORT"           "$COMPOSE" && ok "port du service conforme"     || bad "port du service different de app.yml"
    grep -q 'container_name:'             "$COMPOSE" && ok "container_name declare"       || bad "container_name absent"
  else
    bad "$COMPOSE absent — lance ./init.sh"
  fi

  # Un docker-compose.yml oublie a cote reste un second fichier de routage, que
  # ./init.sh ne regenere plus : il divergera en silence de compose.yaml.
  [ -f "$LEGACY_COMPOSE" ] \
    && bad "$LEGACY_COMPOSE encore present — dockhand ne le lit pas, supprime-le" \
    || ok "aucun $LEGACY_COMPOSE residuel"

  # Le routage vit dans le compose. Un LABEL traefik.* dans le Dockerfile serait
  # fusionne dans les labels du conteneur et publierait un routeur SUPPLEMENTAIRE,
  # que le compose ne peut pas ecraser puisqu'il porte un autre nom : donc sans
  # aucun middleware d'authentification.
  grep -qi 'traefik\.' Dockerfile 2>/dev/null \
    && bad "LABEL traefik.* dans le Dockerfile — publierait une route SANS authentification" \
    || ok "aucun label traefik.* dans le Dockerfile"

  [ -f .github/workflows/build.yml ] && ok "workflow present" || bad "workflow de construction absent"

  if [ -f .claude/settings.json ]; then
    if command -v python3 >/dev/null && ! python3 -m json.tool .claude/settings.json >/dev/null 2>&1; then
      bad ".claude/settings.json n'est pas du JSON valide"
    else
      ok ".claude/settings.json present"
    fi
    # Un settings.json versionne qui porterait un bloc env exposerait ses valeurs
    # a quiconque clone le depot : c'est la voie la plus courante de fuite de jeton.
    grep -q '"env"' .claude/settings.json \
      && bad "bloc \"env\" dans .claude/settings.json versionne — n'y mets jamais de secret" \
      || ok "aucun bloc env dans le settings versionne"
  else
    warn ".claude/settings.json absent — lance ./init.sh pour l'outillage de l'agent"
  fi
  [ -x .claude/install-plugins.sh ] \
    && ok "script d'installation des plugins present" \
    || warn ".claude/install-plugins.sh absent ou non executable"

  # Les deux motifs de jeton GitHub sont ecrits avec une classe d'un seul
  # caractere — gh[p]_ — pour ne pas contenir le litteral qu'ils recherchent :
  # sans cela ce script, lui-meme suivi par git, se detecterait comme fuite a
  # chaque lancement. La detection est inchangee.
  if git ls-files -z 2>/dev/null | xargs -0 -r grep -lIE \
       '(gh[p]_|github_pa[t]_|xox[baprs]-|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' \
       2>/dev/null | grep -q .; then
    bad "secret potentiel dans un fichier suivi"
  else
    ok "aucun secret evident dans les fichiers suivis"
  fi

  echo
  [ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s)."; exit 1; }
  echo "Contrat respecte. Tu peux pousser sur main."
  exit 0
fi

# --- generation ----------------------------------------------------------------

write() {
  local path="$1"
  if [ -e "$path" ] && [ "$FORCE" = 0 ]; then
    warn "$path conserve (--force pour ecraser)"; cat > /dev/null; return
  fi
  mkdir -p "$(dirname "$path")"; cat > "$path"; ok "$path"
}

echo "Initialisation — $APP  (port $PORT, $MEMORY, exposure $EXPOSURE)"

# app.yml est toujours reecrit : c'est la source de verite des valeurs.
cat > app.yml <<YAML
# Parametres de deploiement de cette application.
# Modifie ce fichier puis relance ./init.sh pour regenerer l'infrastructure.
# Le nom de l'app et l'organisation sont deduits du depot, pas declares ici.
port: $PORT
memory: $MEMORY
health_path: $HEALTH_PATH
health_cmd: $HEALTH_CMD
exposure: $EXPOSURE
# Outillage de l'agent, sans effet sur le deploiement :
stack: $STACK
ui: $UI
YAML
ok "app.yml"

if [ "$HEALTH_CMD" = none ]; then
  HEALTH_BLOCK="    # healthcheck desactive (image sans shell)"
else
  HEALTH_BLOCK="    healthcheck:
      test: [\"CMD-SHELL\", \"$HEALTH_CMD\"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s"
fi

# Depot cree avant le passage a compose.yaml : l'ancien fichier n'est plus
# regenere, le laisser en place ferait diverger deux sources de routage.
if [ -f "$LEGACY_COMPOSE" ]; then
  rm -f "$LEGACY_COMPOSE"
  ok "$LEGACY_COMPOSE supprime (remplace par $COMPOSE)"
fi

write "$COMPOSE" <<YAML
# Genere par init.sh depuis app.yml — encode le contrat de billbob.ovh.
# Pour changer une valeur : edite app.yml et relance ./init.sh --force.
services:
  $APP:
    image: ghcr.io/$ORG/$APP:main
    container_name: $APP
    restart: unless-stopped
    mem_limit: $MEMORY
    # Aucun port publie : Traefik joint le conteneur par le reseau apps_net.
$HEALTH_BLOCK
    labels:
      # priority=100 est OBLIGATOIRE : un routeur catch-all capte tout
      # *.apps.billbob.ovh par HostRegexp, et sa regle est plus longue que ce
      # Host(). Traefik departageant par longueur de regle, il gagnerait et
      # servirait un 404 silencieux.
      - "traefik.enable=true"
      - "traefik.http.routers.$APP.rule=Host(\`$APP.apps.billbob.ovh\`)"
      - "traefik.http.routers.$APP.entrypoints=websecure"
      - "traefik.http.routers.$APP.priority=100"
      # $MW = authentification Google. La retirer expose l'app en clair.
      - "traefik.http.routers.$APP.middlewares=$MW,security-headers@file"
      - "traefik.http.routers.$APP.tls.certresolver=letsencrypt"
      - "traefik.http.services.$APP.loadbalancer.server.port=$PORT"
      - "traefik.docker.network=apps_net"
    networks: [apps_net]

networks:
  apps_net:
    external: true
YAML

write .github/workflows/build.yml <<YAML
# Genere par init.sh — construit l'image et la publie sur GHCR.
# Le serveur la recupere ensuite ; aucun secret de deploiement ici.
name: build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      # Sans buildx, le driver par defaut est 'docker', qui ne sait pas
      # exporter de cache : le cache-to gha plus bas ferait echouer la
      # construction avant meme de lire le Dockerfile.
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/$ORG/$APP:main
            ghcr.io/$ORG/$APP:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: taille de l'image
        run: |
          docker pull ghcr.io/$ORG/$APP:main
          size=\$(docker image inspect ghcr.io/$ORG/$APP:main --format '{{.Size}}')
          echo "Image : \$((size / 1024 / 1024)) Mo"
          if [ "\$size" -gt 209715200 ]; then
            echo "::warning::image au-dela de 200 Mo — le serveur est a 92 % de disque"
          fi
YAML

write .dockerignore <<'EOF'
.git
.github
.claude
node_modules
*.md
.env
.env.*
dist
build
target
__pycache__
*.log
EOF

# --- outillage de l'agent -------------------------------------------------------

ENABLED=""
for i in "${!PLUGIN_IDS[@]}"; do
  sep=","; [ "$i" -eq $(( ${#PLUGIN_IDS[@]} - 1 )) ] && sep=""
  ENABLED="$ENABLED    \"${PLUGIN_IDS[$i]}\": true$sep
"
done

# claude-plugins-official est enregistree d'office par Claude Code : seule une
# marketplace tierce doit etre declaree ici.
if [ "$UI" = true ]; then
  MARKETPLACES='  "extraKnownMarketplaces": {
    "impeccable": {
      "source": { "source": "github", "repo": "pbakaus/impeccable" }
    }
  },
'
else
  MARKETPLACES=""
fi

write .claude/settings.json <<JSON
{
$MARKETPLACES  "enabledPlugins": {
$ENABLED  }
}
JSON

write .claude/install-plugins.sh <<SH
#!/usr/bin/env bash
#
# Genere par init.sh — installe les plugins declares dans .claude/settings.json.
#
# Declarer un plugin ne l'installe pas : Claude Code le signale manquant tant
# qu'il n'a pas ete recupere. Lance ce script une fois par machine ou par
# conteneur d'agent, puis /reload-plugins dans une session deja ouverte.
#
# Pour changer la liste : edite stack/ui dans app.yml, puis ./init.sh --force

set -u

command -v claude >/dev/null || {
  echo "claude introuvable dans le PATH — rien a faire." >&2; exit 1; }

$([ "$UI" = true ] && echo 'claude plugin marketplace add pbakaus/impeccable || true
' || true)
failed=0
for p in ${PLUGIN_IDS[*]}; do
  echo "-> \$p"
  claude plugin install "\$p" || { echo "   echec : \$p" >&2; failed=1; }
done
$([ -n "$LSP" ] && echo "
command -v $LSP_BIN >/dev/null || echo \"note : $LSP_BIN absent du PATH — le plugin $LSP restera inactif tant qu'il n'est pas installe.\" >&2
" || true)
[ "\$failed" = 0 ] && echo "Termine." || echo "Termine avec des echecs." >&2
exit \$failed
SH
[ -f .claude/install-plugins.sh ] && chmod +x .claude/install-plugins.sh

for line in '.claude/settings.local.json' '.env' '.env.*' '*.log'; do
  { [ ! -f .gitignore ] || ! grep -qxF "$line" .gitignore; } && echo "$line" >> .gitignore
done
ok ".gitignore complete"

cat <<EOF

Fait. Il te reste a ecrire :

  1. Le code, ecoutant sur le port $PORT en HTTP clair.
  2. GET $HEALTH_PATH renvoyant 200 quand l'app est prete a servir.
  3. Un Dockerfile multi-etapes a la racine, avec USER non root.

Si ces valeurs ne conviennent pas a ta technologie, relance avec les bonnes :

  ./init.sh --force --port 3000 --health /health \\
            --health-cmd 'curl -fsS http://localhost:3000/health'

Le healthcheck actuel appelle : ${HEALTH_CMD}
Assure-toi que cet outil existe dans l'image finale, sinon le conteneur sera
declare malsain en permanence. Image sans shell : --health-cmd none.

Outillage de l'agent : ${#PLUGIN_IDS[@]} plugins declares (stack $STACK, ui $UI).
Ils ne sont pas installes pour autant — lance une fois :

  ./.claude/install-plugins.sh

Si tu changes de technologie, corrige stack/ui dans app.yml et relance
./init.sh --force pour regenerer la liste.

Puis :  ./init.sh --check
EOF
