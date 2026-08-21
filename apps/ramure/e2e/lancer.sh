#!/usr/bin/env bash
#
# lancer.sh — le bout en bout de ramure.
#
#   ./apps/ramure/e2e/lancer.sh
#
# Contrat de la fabrique : la CI lance ce fichier, et rien d'autre. Il est
# AUTONOME — il construit l'app, la demarre, attend qu'elle reponde, joue les
# tests dans un vrai navigateur, et demonte tout. Il ne depend ni de la stack
# partagee, ni d'un service en ligne.
#
# NATIF ET NON DOCKER, comme hello-world/e2e : ramure n'a aucune dependance
# tierce (go.mod est vide de tout "require"), et son binaire embarque son
# frontal.
#
# RESEAU EXTERNE COUPE, MAIS PAS PAR ISOLATION SYSTEME. ramure interroge
# Deezer et Last.fm (deezer.go, lastfm.go) ; leur adresse est lue par
# RAMURE_BASE_DEEZER / RAMURE_BASE_LASTFM (main.go, fonction "env"), dont la
# valeur par defaut reste l'adresse reelle — rien ne bouge en production. Ce
# lancer.sh repointe ces variables :
#
#   - vers fixture-deezer.js, un serveur local minimal et deterministe, pour
#     la plupart des tests : c'est ce qui rend l'ecran B (l'arbre planté)
#     atteignable, avec des reponses figees plutot qu'un reseau simule au
#     hasard des quotas et de la disponibilite d'un tiers (§13 du PRD) ;
#   - vers un port local FERME pour les tests F-36/F-38 (panne, jamais
#     mémorisée) : la connexion echoue immediatement, sans avoir besoin d'un
#     serveur qui simule une erreur.
#
# Un premier essai isolait le reseau avec un espace de noms (unshare --net).
# Abandonne : ca fonctionne sans privilege particulier ICI, mais une suite qui
# en depend echoue en silence — "Operation not permitted" — le jour ou le
# runner de la CI ne l'autorise pas, et une suite bout en bout intermittente
# apprend a ignorer le rouge (§13). Rendre les bases configurables est un vrai
# correctif de testabilite, pas un contournement : il ne depend d'aucune
# capacite du systeme d'exploitation.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${RAMURE_E2E_PORT:-18086}"
FIXTURE_PORT=$((PORT + 1))
PORT_PANNE=$((PORT + 2))
PORT_FERME=$((PORT + 3))   # personne n'ecoute ici : toute connexion echoue.

TRAV="$(mktemp -d)"
BIN="$TRAV/ramure"
FIX_PID=""
SRV_PID=""
SRV_PANNE_PID=""

nettoyer() {
  for pid in "$FIX_PID" "$SRV_PID" "$SRV_PANNE_PID"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  rm -rf "$TRAV"
}
trap nettoyer EXIT

# Le PID est un ARGUMENT, et pas une commodite : sans lui, cette fonction ne
# peut pas distinguer « mon serveur repond » de « quelque chose repond sur ce
# port ». Scenario reel du 2026-08-21 : le binaire meurt au demarrage (« bind:
# address already in use »), un processus etranger repond, curl /healthz
# reussit, et Playwright joue ses tests contre le serveur du voisin.
# Contre-epreuve faite sur hello-world avec un imposteur : la suite partait, et
# son test de sonde de sante PASSAIT AU VERT contre le mauvais serveur pendant
# que les deux autres echouaient en imitant une regression.
attend_healthz() {
  local port="$1" nom="$2" log="$3" pid="$4"
  for _ in $(seq 1 30); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "$nom s'est arrete au demarrage (port $port) — si quelque chose y repond, c'est un AUTRE processus" >&2
      cat "$log" >&2
      exit 1
    fi
    curl -fsS "http://localhost:$port/healthz" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "$nom ne repond pas sur /healthz" >&2
  cat "$log" >&2
  exit 1
}

echo "==> construction"
( cd .. && go build -o "$BIN" . )

echo "==> dependances Playwright"
[ -d node_modules ] || npm install --no-audit --no-fund

echo "==> fixture Deezer locale sur :$FIXTURE_PORT"
FIXTURE_PORT="$FIXTURE_PORT" node fixture-deezer.js >"$TRAV/fixture.log" 2>&1 &
FIX_PID=$!
for _ in $(seq 1 30); do
  if ! kill -0 "$FIX_PID" 2>/dev/null; then
    echo "la fixture Deezer s'est arretee au demarrage (port $FIXTURE_PORT) — si quelque chose y repond, c'est un AUTRE processus" >&2
    cat "$TRAV/fixture.log" >&2
    exit 1
  fi
  curl -fsS "http://localhost:$FIXTURE_PORT/portrait.svg" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://localhost:$FIXTURE_PORT/portrait.svg" >/dev/null || {
  echo "la fixture Deezer ne repond pas" >&2
  cat "$TRAV/fixture.log" >&2
  exit 1; }

echo "==> demarrage sur :$PORT (Deezer -> fixture locale)"
PORT="$PORT" RAMURE_BASE_DEEZER="http://localhost:$FIXTURE_PORT" \
  "$BIN" >"$TRAV/ramure.log" 2>&1 &
SRV_PID=$!
attend_healthz "$PORT" "l'application" "$TRAV/ramure.log" "$SRV_PID"

echo "==> demarrage sur :$PORT_PANNE (Deezer -> port fermé, pour F-36/F-38)"
PORT="$PORT_PANNE" RAMURE_BASE_DEEZER="http://127.0.0.1:$PORT_FERME" \
  "$BIN" >"$TRAV/ramure-panne.log" 2>&1 &
SRV_PANNE_PID=$!
attend_healthz "$PORT_PANNE" "l'application (instance panne)" "$TRAV/ramure-panne.log" "$SRV_PANNE_PID"

echo "==> tests Playwright"
RAMURE_E2E_URL="http://localhost:$PORT" \
RAMURE_E2E_URL_PANNE="http://localhost:$PORT_PANNE" \
  npx playwright test
