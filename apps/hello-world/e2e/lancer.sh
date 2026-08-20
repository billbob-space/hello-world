#!/usr/bin/env bash
#
# lancer.sh — le bout en bout de hello-world.
#
#   ./apps/hello-world/e2e/lancer.sh
#
# Contrat de la fabrique : la CI lance ce fichier, et rien d'autre. Il est
# AUTONOME — il construit l'app, la demarre, attend qu'elle reponde, joue les
# tests dans un vrai navigateur, et demonte tout. Il ne depend ni de la stack
# partagee, ni d'un service en ligne.
#
# NATIF ET NON DOCKER. hello-world n'a ni base ni cache : son binaire embarque
# tout ce qu'il sert. Le lancer directement plutot que de construire une image
# rend ce bout en bout jouable partout — poste de developpement sans demon
# Docker compris — et le fait passer de deux minutes a quelques secondes. Les
# apps qui ont VRAIMENT une annexe (ardoise, compteur) montent leurs conteneurs ;
# les autres n'ont pas a payer ce prix pour rien.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${HELLO_WORLD_E2E_PORT:-18081}"
BIN="$(mktemp -d)/hello-world"
SRV=""

nettoyer() {
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null || true
  rm -rf "$(dirname "$BIN")"
}
trap nettoyer EXIT

echo "==> construction"
( cd .. && go build -o "$BIN" . )

echo "==> demarrage sur :$PORT"
PORT="$PORT" "$BIN" >/tmp/hello-world-e2e.log 2>&1 &
SRV=$!

echo "==> attente de /healthz"
for _ in $(seq 1 30); do
  curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://localhost:$PORT/healthz" >/dev/null || {
  echo "l'application ne repond pas sur /healthz" >&2
  cat /tmp/hello-world-e2e.log >&2
  exit 1; }

echo "==> tests Playwright"
[ -d node_modules ] || npm install --no-audit --no-fund
HELLO_WORLD_E2E_URL="http://localhost:$PORT" npx playwright test
