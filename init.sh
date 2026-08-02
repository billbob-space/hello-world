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
# avec le meme outillage. Un plugin declare n'est PAS installe pour autant.
#
# L'installation se fait en un seul endroit : le setup script de l'environnement
# cloud, genere ici sous .claude/cloud-setup.sh et a coller sur claude.ai/code.
# C'est le seul point d'accroche anterieur au chargement des plugins par Claude
# Code — un hook, lui, s'execute apres, et /reload-plugins n'existe pas sur le
# web. Le hook SessionStart se borne donc a un rapport : .claude/check-plugins.sh

STACK=$(get stack none)
UI=$(get ui false)

case "$UI" in true|false) ;; *) echo "ERREUR : ui doit valoir true ou false (recu : $UI)" >&2; exit 1 ;; esac

# Le LSP donne a l'agent les diagnostics du compilateur apres chaque edition,
# pour zero token de contexte. Le binaire doit exister sur la machine.
#
# LSP_INSTALL sert au setup script cloud : l'image de base fournit les
# compilateurs, jamais les serveurs de langage. Sans cette ligne le plugin est
# installe mais inerte. Vide = pas d'installation en une commande fiable a
# travers l'allowlist reseau ; le setup script genere pose alors un TODO plutot
# qu'une commande inventee.
case "$STACK" in
  none)                LSP=""; LSP_BIN=""; LSP_INSTALL="" ;;
  typescript|ts|node)  LSP=typescript-lsp;    LSP_BIN=typescript-language-server
                       LSP_INSTALL='npm install -g typescript-language-server typescript' ;;
  python|py)           LSP=pyright-lsp;       LSP_BIN=pyright-langserver
                       LSP_INSTALL='npm install -g pyright' ;;
  go|golang)           LSP=gopls-lsp;         LSP_BIN=gopls
                       LSP_INSTALL='PATH="/usr/local/go/bin:$PATH" GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@latest' ;;
  rust)                LSP=rust-analyzer-lsp; LSP_BIN=rust-analyzer
                       LSP_INSTALL='rustup component add rust-analyzer' ;;
  java)                LSP=jdtls-lsp;         LSP_BIN=jdtls;         LSP_INSTALL="" ;;
  kotlin)              LSP=kotlin-lsp;        LSP_BIN=kotlin-language-server; LSP_INSTALL="" ;;
  php)                 LSP=php-lsp;           LSP_BIN=intelephense
                       LSP_INSTALL='npm install -g intelephense' ;;
  csharp|dotnet)       LSP=csharp-lsp;        LSP_BIN=csharp-ls;     LSP_INSTALL="" ;;
  swift)               LSP=swift-lsp;         LSP_BIN=sourcekit-lsp; LSP_INSTALL="" ;;
  c|cpp|c++)           LSP=clangd-lsp;        LSP_BIN=clangd
                       LSP_INSTALL='apt-get install -y clangd' ;;
  lua)                 LSP=lua-lsp;           LSP_BIN=lua-language-server;    LSP_INSTALL="" ;;
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
    grep -q 'pull_policy: always'         "$COMPOSE" && ok "pull_policy always"           || bad "pull_policy absent — un redeploiement servirait l'image locale perimee"
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
  [ -x .claude/check-plugins.sh ] \
    && ok "rapport d'outillage present (hook SessionStart)" \
    || warn ".claude/check-plugins.sh absent ou non executable"

  # Le setup script vit dans l'environnement cloud, hors du depot : rien ne le
  # resynchronise. Signale l'ecart, faute de pouvoir le corriger d'ici.
  if [ -f .claude/cloud-setup.sh ]; then
    drift=0
    for p in "${PLUGIN_IDS[@]}"; do
      grep -qF "$p" .claude/cloud-setup.sh || drift=1
    done
    [ "$drift" = 0 ] \
      && ok "cloud-setup.sh aligne sur les ${#PLUGIN_IDS[@]} plugins declares" \
      || warn "cloud-setup.sh desynchronise — ./init.sh --force, puis recolle-le sur claude.ai/code"

    # Sans cette ligne le setup script tourne, sort en 0, et n'installe rien :
    # avant le premier lancement de Claude Code aucune marketplace n'existe.
    grep -qF 'marketplace add anthropics/claude-plugins-official' .claude/cloud-setup.sh \
      && ok "cloud-setup.sh declare la marketplace officielle" \
      || bad "cloud-setup.sh n'enregistre pas anthropics/claude-plugins-official — il echouera en silence"
  else
    warn ".claude/cloud-setup.sh absent — les plugins resteront inertes en session cloud"
  fi

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
    # Le tag :main est mutable : l'image locale portant ce nom est presque
    # toujours perimee. Sans ce reglage, un redeploiement relance l'image deja
    # presente et sert silencieusement la version precedente.
    pull_policy: always
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
          # Identifie la version deployee ; le Dockerfile en fait ce qu'il veut,
          # l'ignorer est sans consequence.
          build-args: |
            VERSION=\${{ github.sha }}
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
          WEBHOOK: \${{ secrets.DOCKHAND_DEPLOY_WEBHOOK }}
          WEBHOOK_SECRET: \${{ secrets.DOCKHAND_WEBHOOK_SECRET }}
        run: |
          if [ -z "\$WEBHOOK" ]; then
            echo "::warning::secret DOCKHAND_DEPLOY_WEBHOOK absent — image publiee, deploiement NON declenche"
            exit 0
          fi

          # Un secret colle porte souvent un retour a la ligne invisible. Il
          # casserait la signature comme le jeton, pour un 403 indistinguable
          # d'un mauvais secret.
          secret=\$(printf '%s' "\$WEBHOOK_SECRET" | tr -d '\\r\\n')

          # Recette documentee par dockhand pour une CI generique : POST d'un
          # corps quelconque, signe en HMAC-SHA256. Le corps ne sert pas au
          # serveur, qui relit le depot lui-meme ; seule la signature compte.
          payload='{}'
          if [ -n "\$secret" ]; then
            sig=\$(printf '%s' "\$payload" | openssl dgst -sha256 -hmac "\$secret" | awk '{print \$NF}')
            set -- -H "x-hub-signature-256: sha256=\$sig"
          else
            echo "::warning::secret DOCKHAND_WEBHOOK_SECRET absent — appel non signe, il sera refuse"
            set --
          fi

          code=\$(curl -sS -o reponse.txt -w '%{http_code}' --retry 3 --retry-delay 5 \\
                   -X POST "\$WEBHOOK" -H 'content-type: application/json' "\$@" -d "\$payload")
          echo "reponse HTTP \$code :"
          cat reponse.txt; echo

          if [ "\$code" = 403 ]; then
            echo "::error::403 — le secret envoye ne correspond pas a celui configure sur la stack dockhand"
            exit 1
          fi
          if [ "\$code" -ge 400 ]; then
            echo "::error::le webhook a refuse l'appel — image publiee, rien n'est deploye"
            exit 1
          fi

          # dockhand ne redeploie que s'il voit un commit nouveau. Le tag :main
          # etant mutable, une image reconstruite sans commit le fait sauter le
          # deploiement, en repondant 200 : sans ce test, la CI serait verte et
          # le serveur servirait toujours l'image d'avant.
          if grep -q '"skipped":[[:space:]]*true' reponse.txt; then
            echo "::error::dockhand a saute le deploiement (aucun commit nouveau vu). Active « Re-pull images » et « Force redeployment » sur la stack."
            exit 1
          fi
          echo "deploiement declenche"
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
$ENABLED  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"\$CLAUDE_PROJECT_DIR/.claude/check-plugins.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
JSON

# Fragment du rapport consacre au serveur de langage, interpole tel quel dans le
# heredoc ci-dessous. Un plugin LSP peut etre installe et pourtant inerte :
# Claude Code lance le binaire en clair, il doit exister sur la machine.
REPORT_LSP=""
if [ -n "$LSP" ]; then
  if [ -n "$LSP_INSTALL" ]; then
    LSP_HINT="sa commande d'installation est dans .claude/cloud-setup.sh."
  else
    LSP_HINT="aucune installation en une commande n'est connue — voir le TODO de .claude/cloud-setup.sh."
  fi
  REPORT_LSP="
# Si le plugin lui-meme manque, il est deja dans la liste ci-dessus : inutile de
# le dire deux fois, et il serait faux de l'annoncer installe.
case \" \$manquants \" in
  *\" $LSP@claude-plugins-official \"*) ;;
  *)
    if command -v $LSP_BIN >/dev/null; then
      echo \"  $LSP_BIN present — diagnostics $STACK actifs.\"
    else
      echo \"  $LSP_BIN ABSENT — $LSP est installe mais inerte : aucun diagnostic apres edition.\"
      echo \"  -> $LSP_HINT\"
    fi ;;
esac"
fi

write .claude/check-plugins.sh <<SH
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
# Sa sortie standard est injectee dans le contexte de l'agent : une ligne quand
# tout va bien, le detail seulement quand il y a un trou.
#
# Pour changer la liste : edite stack/ui dans app.yml, puis ./init.sh --force

set -u

PLUGINS="${PLUGIN_IDS[*]}"

# Un plugin installe = un repertoire non vide dans le cache local, range sous
# <marketplace>/<nom>. installed_plugins.json n'est pas lu : ce manifeste
# survit a un cache efface, et decrirait alors un outillage disparu.
n=0 total=0 manquants=""
for p in \$PLUGINS; do
  total=\$(( total + 1 ))
  d="\$HOME/.claude/plugins/cache/\${p#*@}/\${p%@*}"
  if [ -d "\$d" ] && [ -n "\$(ls -A "\$d" 2>/dev/null)" ]; then
    n=\$(( n + 1 ))
  else
    manquants="\$manquants \$p"
  fi
done

echo "Outillage : \$n/\$total plugins installes."
[ -n "\$manquants" ] && {
  echo "  manquants :\$manquants"
  echo "  -> colle .claude/cloud-setup.sh dans le champ Setup script de l'environnement : claude.ai/code, icone nuage, engrenage."
}$REPORT_LSP

# Toujours 0 : un rapport ne fait pas echouer l'ouverture d'une session.
exit 0
SH
[ -f .claude/check-plugins.sh ] && chmod +x .claude/check-plugins.sh

# Un plugin par ligne : ce script se lit dans une textarea, pas dans un editeur.
PLUGIN_LINES=$(printf '    %s \\\n' "${PLUGIN_IDS[@]}")
PLUGIN_LINES=${PLUGIN_LINES% \\}

# Le serveur de langage se telecharge en parallele des plugins : seul il peut
# depasser la minute, et le setup script doit tenir sous les cinq. Ces deux
# fragments sont interpolees tels quels dans le heredoc ci-dessous — leurs $
# ne sont donc pas reevalues.
LSP_LAUNCH="" LSP_WAIT=""
if [ -n "$LSP" ] && [ -n "$LSP_INSTALL" ]; then
  LSP_LAUNCH="# --- $LSP_BIN : absent de l'image de base ---
# L'image cloud fournit les compilateurs, pas les serveurs de langage. Sans ce
# binaire, le plugin $LSP est installe mais inerte : aucun diagnostic apres
# edition. En arriere-plan, pour ne pas serialiser avec les plugins.
(
  $LSP_INSTALL
) >/tmp/$LSP_BIN-setup.log 2>&1 &
lsp_pid=\$!
"
  LSP_WAIT="wait \"\$lsp_pid\" || { echo \"echec $LSP_BIN :\" >&2; tail -3 /tmp/$LSP_BIN-setup.log >&2; }
if command -v $LSP_BIN >/dev/null || [ -x /usr/local/bin/$LSP_BIN ]; then
  echo \"$LSP_BIN present.\"
else
  echo \"$LSP_BIN absent — le plugin $LSP restera inerte.\" >&2
fi
"
elif [ -n "$LSP" ]; then
  LSP_LAUNCH="# TODO : installer $LSP_BIN. Le plugin $LSP est declare, mais sans ce binaire
# il reste inerte — et aucune installation en une commande n'est connue pour la
# stack $STACK a travers l'allowlist reseau. Ajoute-la ici, puis recolle.
"
fi

write .claude/cloud-setup.sh <<SH
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
# Cette liste vit hors du depot : apres un ./init.sh --force qui change stack ou
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.

set -u

$LSP_LAUNCH
# --- plugins Claude Code ---
# Le setup script tourne en root, avec un PATH plus maigre que celui de la
# session : le binaire vit dans l'image node embarquee par Claude Code.
command -v claude >/dev/null || export PATH="/opt/node22/bin:\$PATH"

# Avant le premier lancement de Claude Code, aucune marketplace n'est
# enregistree — pas meme l'officielle. La declarer ici separe un setup script
# qui installe d'un qui echoue en silence.
claude plugin marketplace add anthropics/claude-plugins-official || true
$([ "$UI" = true ] && echo 'claude plugin marketplace add pbakaus/impeccable || true' || true)
for p in \\
$PLUGIN_LINES
do
  claude plugin install "\$p" || echo "   echec : \$p" >&2
done

$LSP_WAIT
# Toujours 0 : un outil manquant degrade l'outillage, il ne doit pas empecher
# la session de demarrer.
exit 0
SH

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
Declarer n'installe pas — un seul endroit installe :

  colle .claude/cloud-setup.sh dans le champ "Setup script" de ton
  environnement sur claude.ai/code (icone nuage, engrenage).

Un hook ne peut pas s'en charger : il s'execute apres que Claude Code a charge
ses plugins, et /reload-plugins n'existe pas sur le web. Le hook SessionStart
se contente donc de rapporter l'etat de l'outillage a chaque session, via
.claude/check-plugins.sh — lance-le a la main pour le voir tout de suite.

Si tu changes de technologie, corrige stack/ui dans app.yml et relance
./init.sh --force pour regenerer la liste — puis recolle le setup script.

Puis :  ./init.sh --check
EOF
