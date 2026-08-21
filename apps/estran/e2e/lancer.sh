#!/usr/bin/env bash
#
# lancer.sh — le bout en bout de estran.
#
#   ./apps/estran/e2e/lancer.sh
#
# Contrat de la fabrique : la CI lance ce fichier, et rien d'autre. Il est
# AUTONOME — il construit l'app, la demarre, attend qu'elle reponde, joue les
# tests dans un vrai navigateur, et demonte tout. Il ne depend ni de la stack
# partagee, ni d'un service en ligne.
#
# NATIF ET NON DOCKER, comme hello-world : estran n'a ni base ni cache, son
# binaire sert la page embarquee par go:embed. Le lancer directement plutot
# que de construire une image rend ce bout en bout jouable partout et le fait
# passer de deux minutes a quelques secondes.
#
# LE POINT DELICAT : estran interroge six fournisseurs externes (Open-Meteo,
# Open-Meteo Marine, api-maree.fr et son catalogue de sites, la Base Adresse
# Nationale pour le lieu, Meteo-France pour la pluie immediate). Le PRD de la
# fabrique interdit de tester contre des sources reelles : « ca produit des
# echecs intermittents qui finissent par etre ignores, et masquent alors les
# vraies regressions ». meteo.go, maree.go, pluie.go et lieu.go exposent donc
# chacun l'URL de base du fournisseur qu'ils interrogent comme une variable,
# lue une seule fois au demarrage depuis ESTRAN_BASE_METEO_FORECAST /
# _METEO_MARINE / _MAREE / _MAREE_SITES / _PLUIE / _NOWCAST / _GEOCODE —
# inchangee en production, ou aucune de ces sept variables n'est jamais posee.
#
# Ce fichier lance l'app DEUX FOIS, chacune avec ces variables pointees
# ailleurs que sur le reseau reel :
#
#   1. PHASE « degrade » (tests/degrade.spec.js) — les sept variables
#      pointent vers 127.0.0.1:1, un port ferme (meme convention que
#      main_test.go dans le code de l'app) : toute requete sortante echoue
#      IMMEDIATEMENT (connexion refusee), sans jamais toucher un reseau
#      quelconque. Verifie que l'app affiche son etat degrade, jamais un
#      ecran vide, meme a froid.
#
#   2. PHASE « connue » (tests/connu.spec.js, tests/lieu.spec.js) — les sept
#      variables pointent vers stub-serveur.js, un serveur Node local (aucune
#      dependance) qui rend des reponses FIXES imitant la forme des six
#      fournisseurs. Verifie que l'app affiche CORRECTEMENT une donnee
#      reelle : une temperature, une hauteur de maree, un cumul de pluie,
#      trois lieux de test (littoral / interieur / capacite inconnue), tous
#      connus a l'avance (stub-serveur.js).
#
# Aucun paquet ne sort donc jamais vers Internet, dans aucune des deux phases.
set -euo pipefail
cd "$(dirname "$0")"

PORT_DEGRADE="${ESTRAN_E2E_PORT_DEGRADE:-18084}"
PORT_CONNU="${ESTRAN_E2E_PORT:-18083}"
STUB_PORT="${ESTRAN_E2E_STUB_PORT:-18085}"

TMP="$(mktemp -d)"
BIN="$TMP/estran"
LOG_A="$TMP/serveur-degrade.log"
LOG_B="$TMP/serveur-connu.log"
LOG_STUB="$TMP/stub.log"

SRV_A=""
SRV_B=""
STUB=""

nettoyer() {
  [ -n "$SRV_A" ] && kill "$SRV_A" 2>/dev/null || true
  [ -n "$SRV_B" ] && kill "$SRV_B" 2>/dev/null || true
  [ -n "$STUB" ] && kill "$STUB" 2>/dev/null || true
  rm -rf "$TMP"
}
trap nettoyer EXIT

# Le PID est un ARGUMENT, et pas une commodite : sans lui, cette fonction ne
# peut pas distinguer « mon serveur repond » de « quelque chose repond sur ce
# port ». Le scenario est reel, rencontre le 2026-08-21 : le binaire meurt au
# demarrage (« bind: address already in use »), un processus etranger repond,
# curl /healthz reussit, et Playwright joue ses tests contre le serveur du
# voisin. Contre-epreuve faite sur hello-world avec un imposteur : la suite
# partait, et son test de sonde de sante PASSAIT AU VERT contre le mauvais
# serveur pendant que les deux autres echouaient en imitant une regression.
#
# On interroge le PID qu'on a lance, la seule chose que personne ne peut
# usurper. Le controle attrape aussi les morts subites sans rapport avec un
# port : configuration, dependance manquante, permission refusee.
attendre_healthz() {
  local port="$1" log="$2" pid="$3"
  for _ in $(seq 1 30); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "le serveur s'est arrete au demarrage (port $port) — si quelque chose y repond, c'est un AUTRE processus" >&2
      cat "$log" >&2
      return 1
    fi
    curl -fsS "http://localhost:$port/healthz" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "l'application ne repond pas sur /healthz (port $port)" >&2
  cat "$log" >&2
  return 1
}

echo "==> construction"
( cd .. && go build -o "$BIN" . )

echo "==> installation Playwright"
[ -d node_modules ] || npm install --no-audit --no-fund

# --- Phase 1 : degrade, port ferme ------------------------------------------
# 127.0.0.1:1 : personne n'y ecoute (port reserve, jamais bindable sans
# privilege), donc la connexion est refusee tout de suite. Aucune valeur
# litterale, aucun secret : juste une adresse qui ne mene nulle part.
echo "==> phase 1/2 : degrade (port ferme), sur :$PORT_DEGRADE"
ESTRAN_BASE_METEO_FORECAST="http://127.0.0.1:1" \
ESTRAN_BASE_METEO_MARINE="http://127.0.0.1:1" \
ESTRAN_BASE_MAREE="http://127.0.0.1:1" \
ESTRAN_BASE_PLUIE="http://127.0.0.1:1" \
ESTRAN_BASE_NOWCAST="http://127.0.0.1:1" \
ESTRAN_BASE_GEOCODE="http://127.0.0.1:1" \
ESTRAN_BASE_MAREE_SITES="http://127.0.0.1:1" \
PORT="$PORT_DEGRADE" \
"$BIN" >"$LOG_A" 2>&1 &
SRV_A=$!

attendre_healthz "$PORT_DEGRADE" "$LOG_A" "$SRV_A"
ESTRAN_E2E_URL="http://localhost:$PORT_DEGRADE" npx playwright test tests/degrade.spec.js

kill "$SRV_A" 2>/dev/null || true
wait "$SRV_A" 2>/dev/null || true
SRV_A=""

# --- Phase 2 : donnees connues, stub local ----------------------------------
echo "==> demarrage du stub sur :$STUB_PORT"
node stub-serveur.js "$STUB_PORT" >"$LOG_STUB" 2>&1 &
STUB=$!

for _ in $(seq 1 30); do
  if ! kill -0 "$STUB" 2>/dev/null; then
    echo "le stub s'est arrete au demarrage (port $STUB_PORT) — si quelque chose y repond, c'est un AUTRE processus" >&2
    cat "$LOG_STUB" >&2
    exit 1
  fi
  curl -fsS "http://127.0.0.1:$STUB_PORT/marine" >/dev/null 2>&1 && break
  sleep 1
done

echo "==> phase 2/2 : donnees connues (stub local), sur :$PORT_CONNU"
ESTRAN_BASE_METEO_FORECAST="http://127.0.0.1:$STUB_PORT/forecast" \
ESTRAN_BASE_METEO_MARINE="http://127.0.0.1:$STUB_PORT/marine" \
ESTRAN_BASE_MAREE="http://127.0.0.1:$STUB_PORT/maree" \
ESTRAN_BASE_PLUIE="http://127.0.0.1:$STUB_PORT/forecast" \
ESTRAN_BASE_NOWCAST="http://127.0.0.1:$STUB_PORT/nowcast" \
ESTRAN_BASE_GEOCODE="http://127.0.0.1:$STUB_PORT/geocode" \
ESTRAN_BASE_MAREE_SITES="http://127.0.0.1:$STUB_PORT/maree-sites" \
API_MAREE_KEY="cle-locale-e2e-non-secrete" \
PORT="$PORT_CONNU" \
"$BIN" >"$LOG_B" 2>&1 &
SRV_B=$!

attendre_healthz "$PORT_CONNU" "$LOG_B" "$SRV_B"
# lieu.spec.js (prp/05-ecran-de-choix.md) tourne dans la MEME phase : elle a
# besoin du meme stub (routes BAN + catalogue, ajoutees ci-dessus) et de la
# meme cle api-maree.fr que connu.spec.js.
ESTRAN_E2E_URL="http://localhost:$PORT_CONNU" npx playwright test tests/connu.spec.js tests/lieu.spec.js
