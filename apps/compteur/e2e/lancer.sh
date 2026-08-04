#!/usr/bin/env bash
# Bout en bout de compteur : construit l'image, monte compteur + compteur-base
# + redis (le MEME service partage que celui d'ardoise, sur ce reseau dedie il
# n'est utilise QUE par compteur) sur un reseau dedie, attend /healthz, lance
# les tests, demonte tout.
#
# N'est PAS lance par la CI ni par test.sh : voir apps/ardoise/e2e/lancer.sh,
# meme geste, meme raison.
set -euo pipefail
cd "$(dirname "$0")"

RESEAU=compteur-e2e
VOLUME=compteur-e2e-donnees
PORT="${COMPTEUR_E2E_PORT:-18081}"
MDP=e2e-$(date +%s 2>/dev/null || echo test)

nettoyer() {
  docker rm -f compteur-e2e-app compteur-e2e-base compteur-e2e-redis >/dev/null 2>&1 || true
  docker network rm "$RESEAU" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap nettoyer EXIT

nettoyer
docker network create "$RESEAU" >/dev/null
docker volume create "$VOLUME" >/dev/null

echo "==> construction de l'image"
docker build -t compteur:e2e-local --build-arg VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo local)" ..

echo "==> base et cache"
docker run -d --name compteur-e2e-base --network "$RESEAU" --network-alias compteur-base \
  -e POSTGRES_PASSWORD="$MDP" -v "$VOLUME:/var/lib/postgresql/data" \
  postgres:17-alpine >/dev/null

docker run -d --name compteur-e2e-redis --network "$RESEAU" --network-alias redis \
  valkey/valkey:8-alpine valkey-server --maxmemory 64mb --maxmemory-policy allkeys-lru --save "" >/dev/null

echo "==> application"
docker run -d --name compteur-e2e-app --network "$RESEAU" \
  -e POSTGRES_PASSWORD="$MDP" -p "$PORT:8080" \
  compteur:e2e-local >/dev/null

echo "==> attente de /healthz"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://localhost:$PORT/healthz" >/dev/null || {
  echo "l'application ne repond pas sur /healthz" >&2
  docker logs compteur-e2e-app >&2 || true
  exit 1
}

echo "==> tests Playwright"
if [ ! -d node_modules ]; then
  echo "node_modules absent : lance 'npm install' dans apps/compteur/e2e d'abord." >&2
  exit 1
fi
COMPTEUR_E2E_URL="http://localhost:$PORT" npx playwright test
