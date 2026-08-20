#!/usr/bin/env bash
#
# lancer.sh — le bout en bout de ramure-v2.
#
#   ./apps/ramure-v2/e2e/lancer.sh
#
# Contrat de la fabrique : la CI lance ce fichier, et rien d'autre (PRP 09,
# tache 1 — desormais DANS le contrat, plus derriere une variable jamais
# posee : voir apps/ramure-v2/test.sh, qui ne joue plus RAMURE_E2E). Il est
# AUTONOME : il construit le client TypeScript (./prepare.sh — indispensable
# a //go:embed web/dist, qui refuse un repertoire absent ou vide), construit
# le binaire Go, verifie qu'il demarre et repond sur /healthz, puis joue la
# suite Playwright DEJA ECRITE sous web/tests/e2e/ — jamais reecrite ici.
#
# PARTICULARITE DE CETTE APP, a la difference de hello-world : la suite ne
# demarre PAS un serveur partage que ce script poserait pour elle. Chaque
# fichier de specification (web/tests/e2e/support/serveur.ts) lance et
# arrete SON PROPRE « go run . », sur le port que main.go fixe en dur
# (« :8080 » — son propre commentaire : « le relire ici depuis
# l'environnement creerait une seconde source de verite »). mise-a-jour.spec.ts
# (F-42) a meme besoin de le redemarrer EN COURS de fichier ; playwright.config.ts
# impose donc `workers: 1` pour qu'aucun cycle ne chevauche un autre sur ce
# port unique.
#
# Le build+demarrage ci-dessous n'est donc PAS le serveur que les tests
# interrogent : c'est une SONDE DE FUMEE, qui echoue vite et clairement si le
# build ou le demarrage sont casses, avant de payer le temps — nettement plus
# long — de la suite complete. Elle est ARRETEE, et son port verifie libre,
# AVANT Playwright : sinon le premier "go run ." lance par une spec trouverait
# le port deja occupe par CE binaire-ci et echouerait (et le filet de securite
# de serveur.ts le tuerait au passage, faussant tout).
#
# Consequence directe : RAMURE_V2_E2E_PORT ne peut valoir que ce sur quoi le
# binaire ecoute REELLEMENT, c'est-a-dire 8080 — main.go ne lit aucune
# variable d'environnement pour son adresse. Une autre valeur fait echouer la
# sonde tout de suite, volontairement : mieux vaut un echec net qu'un reglage
# qui parait exister sans avoir le moindre effet cote serveur.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${RAMURE_V2_E2E_PORT:-8080}"
BIN="$(mktemp -d)/ramure-v2"
SRV=""

nettoyer() {
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null || true
  rm -rf "$(dirname "$BIN")"
}
trap nettoyer EXIT

echo "==> preparation (client TypeScript, PRP 05)"
./prepare.sh

echo "==> construction du binaire Go"
go build -o "$BIN" .

echo "==> sonde de fumee : demarrage sur :$PORT"
"$BIN" >/tmp/ramure-v2-e2e-fumee.log 2>&1 &
SRV=$!

for _ in $(seq 1 30); do
  curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://localhost:$PORT/healthz" >/dev/null || {
  echo "l'application ne repond pas sur /healthz" >&2
  cat /tmp/ramure-v2-e2e-fumee.log >&2
  exit 1; }

echo "==> sonde de fumee ok — arret (le port doit rester libre pour la suite)"
kill "$SRV"
wait "$SRV" 2>/dev/null || true
SRV=""
for _ in $(seq 1 30); do
  curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1 || break
  sleep 0.2
done

echo "==> tests Playwright (suite existante, web/tests/e2e/)"
# e2e/package.json ne porte AUCUN test : il sert seulement a fixer, pour la CI,
# la version de @playwright/test qui installe Chromium (voir e2e/package.json).
# La suite reelle tourne via web/package.json (npm run --prefix web test:e2e),
# avec la MEME version epinglee — meme cache navigateur, ~/.cache/ms-playwright.
[ -d e2e/node_modules ] || ( cd e2e && npm install --no-audit --no-fund )

# PLAYWRIGHT_CHROMIUM_PATH : un Chromium DEJA present sur la machine (voir
# web/playwright.config.ts) — evite de re-telecharger un navigateur quand ce
# bac a sable en porte deja un. Absent, Playwright retombe sur son propre
# navigateur installe par la CI (`npx playwright install --with-deps chromium`,
# voir .github/workflows/build.yml, job bout-en-bout).
if [ -z "${PLAYWRIGHT_CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium
fi

npm run --prefix web test:e2e
