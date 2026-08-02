#!/usr/bin/env bash
#
# init.sh — bootstrap d'une application deployee sur billbob.ovh
#
#   ./init.sh              genere les fichiers d'infrastructure
#   ./init.sh --check      verifie que le depot respecte le contrat
#   ./init.sh --force      regenere en ecrasant les fichiers existants
#
# Ne genere ni Dockerfile ni code applicatif : c'est le travail de l'agent,
# et le choix de la technologie lui appartient. Voir CLAUDE.md.

set -euo pipefail

PORT=8080
MEMORY=128m
HEALTH=/healthz
ORG=billbob-space
FORCE=0
CHECK=0

while [ $# -gt 0 ]; do
  case "$1" in
    --check)   CHECK=1 ;;
    --force)   FORCE=1 ;;
    --port)    PORT="$2"; shift ;;
    --memory)  MEMORY="$2"; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

# --- nom de l'application : celui du depot -----------------------------------

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERREUR : ce script doit tourner dans un depot git." >&2
  exit 1
fi
cd "$(git rev-parse --show-toplevel)"

APP=$(basename -s .git "$(git remote get-url origin 2>/dev/null || pwd)")
if ! printf '%s' "$APP" | grep -qE '^[a-z0-9][a-z0-9-]{1,30}$'; then
  echo "ERREUR : nom d'application invalide : '$APP'" >&2
  echo "Il devient un sous-domaine : minuscules, chiffres et tirets uniquement." >&2
  exit 1
fi

FAILED=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mattn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mKO\033[0m    %s\n' "$1"; FAILED=$((FAILED+1)); }

# --- verification -------------------------------------------------------------

if [ "$CHECK" = 1 ]; then
  echo "Verification du contrat — $APP"

  if [ -f Dockerfile ]; then
    ok "Dockerfile present"
    grep -qE '^[[:space:]]*USER[[:space:]]+' Dockerfile && ok "USER declare (non root)" \
      || bad "Dockerfile sans USER : le conteneur tournerait en root"
    grep -qiE '^[[:space:]]*FROM .* AS ' Dockerfile && ok "construction multi-etapes" \
      || warn "pas de multi-etapes : verifie la taille de l'image finale"
  else
    bad "Dockerfile absent a la racine"
  fi

  if [ -f docker-compose.yml ]; then
    ok "docker-compose.yml present"
    grep -qE '^[[:space:]]*ports:' docker-compose.yml \
      && bad "section ports: interdite — Traefik joint le conteneur par le reseau" \
      || ok "aucun port publie"
    grep -q 'mem_limit:'      docker-compose.yml && ok "mem_limit declare"      || bad "mem_limit absent"
    grep -q 'app.untrusted'   docker-compose.yml && ok "label app.untrusted pose" || bad "label app.untrusted=true absent"
    grep -q 'healthcheck:'    docker-compose.yml && ok "healthcheck declare"    || bad "healthcheck absent"
    grep -q 'container_name:' docker-compose.yml && ok "container_name declare" || bad "container_name absent"
  else
    bad "docker-compose.yml absent — lance ./init.sh"
  fi

  if grep -rqi 'traefik\.' Dockerfile docker-compose.yml 2>/dev/null; then
    bad "label traefik.* detecte — publierait une route SANS authentification"
  else
    ok "aucun label traefik.*"
  fi

  [ -f .github/workflows/build.yml ] && ok "workflow de construction present" \
    || bad "workflow .github/workflows/build.yml absent"

  # secrets grossiers dans les fichiers suivis ; les interpolations ${...} passent
  if git ls-files -z 2>/dev/null | xargs -0 -r grep -lIE \
       '(ghp_|github_pat_|xox[baprs]-|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' \
       2>/dev/null | grep -q .; then
    bad "secret potentiel dans un fichier suivi — inspecte avant de pousser"
  else
    ok "aucun secret evident dans les fichiers suivis"
  fi

  echo
  if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED point(s) bloquant(s). Le deploiement echouerait."
    exit 1
  fi
  echo "Contrat respecte. Tu peux pousser sur main."
  exit 0
fi

# --- generation ---------------------------------------------------------------

write() {
  local path="$1"
  if [ -e "$path" ] && [ "$FORCE" = 0 ]; then
    warn "$path existe deja, conserve (--force pour ecraser)"
    cat > /dev/null
    return
  fi
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  ok "$path"
}

echo "Initialisation — $APP  (port $PORT, memoire $MEMORY)"

write docker-compose.yml <<YAML
# Genere par init.sh — encode le contrat de deploiement de billbob.ovh.
# Ne modifie ce fichier qu'en connaissance de cause : voir CLAUDE.md.
services:
  $APP:
    image: ghcr.io/$ORG/$APP:main
    container_name: $APP
    restart: unless-stopped
    mem_limit: $MEMORY
    # Aucun port publie : Traefik joint le conteneur par le reseau apps_net.
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:$PORT$HEALTH"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    labels:
      # Sort ce conteneur du provider Docker de Traefik : le routage est ecrit
      # cote serveur, dans un fichier que ce depot ne controle pas.
      - "app.untrusted=true"
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

for line in '.env' '.env.*' '*.log'; do
  if [ ! -f .gitignore ] || ! grep -qxF "$line" .gitignore; then
    echo "$line" >> .gitignore
  fi
done
ok ".gitignore complete"

cat <<EOF

Fait. Ce qu'il te reste a ecrire :

  1. Le code de l'application, ecoutant sur le port $PORT en HTTP clair.
  2. Un endpoint GET $HEALTH renvoyant 200 quand l'app est prete a servir.
  3. Un Dockerfile multi-etapes a la racine, avec une directive USER non root.

L'image doit contenir wget pour le healthcheck ; sinon, adapte la ligne
'test:' du docker-compose.yml a un outil present dans ton image.

Puis :  ./init.sh --check   avant de pousser sur main.
EOF
