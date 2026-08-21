#!/usr/bin/env bash
#
# lancer.sh — le bout en bout de marcq-handball.
#
#   ./apps/marcq-handball/e2e/lancer.sh
#
# Contrat de la fabrique : la CI lance ce fichier, et rien d'autre. Il est
# AUTONOME — il construit l'app, la demarre, attend qu'elle reponde, joue les
# tests dans un vrai navigateur, et demonte tout. Il ne depend ni de la stack
# partagee, ni d'un service en ligne.
#
# NATIF ET NON DOCKER. marcq-handball n'a pas de base : son binaire embarque
# toute sa coque (go:embed) et ne parle qu'a un repertoire de donnees local. Le
# lancer directement plutot que de construire une image rend ce bout en bout
# jouable partout — poste de developpement sans demon Docker compris — et le
# fait passer de deux minutes a quelques secondes.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${MARCQ_HANDBALL_E2E_PORT:-18092}"
BIN="$(mktemp -d)/marcq-handball"
DONNEES="$(mktemp -d)"
SRV=""

nettoyer() {
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null || true
  rm -rf "$(dirname "$BIN")" "$DONNEES"
}
trap nettoyer EXIT

echo "==> construction"
( cd .. && go build -o "$BIN" . )

echo "==> demarrage sur :$PORT"
# MARCQ_DONNEES pointe vers un repertoire temporaire, jamais vers le volume de
# production : ce bout en bout ne doit jamais lire ni ecrire de vraies donnees
# d'equipe. Il est detruit dans le trap ci-dessus, avec le binaire.
PORT="$PORT" MARCQ_DONNEES="$DONNEES" "$BIN" >/tmp/marcq-handball-e2e.log 2>&1 &
SRV=$!

echo "==> attente de /healthz"
for _ in $(seq 1 30); do
  curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 1
done
# Notre propre serveur est-il encore vivant ?
#
# Sans ce controle, la suite peut passer au VERT en ayant teste une AUTRE
# application. Le scenario est reel, rencontre le 2026-08-21 : le binaire meurt
# au demarrage (« bind: address already in use »), un processus etranger repond
# sur le meme port, curl /healthz reussit, et Playwright joue ses tests contre
# le serveur du voisin. Les echecs qui en sortent ressemblent trait pour trait a
# une regression du code qu'on vient d'ecrire — ou, sur des assertions assez
# generiques, il n'y a pas d'echec du tout.
#
# On interroge donc le PID qu'on a lance, et pas le port : c'est la seule chose
# que personne d'autre ne peut usurper. Le controle attrape aussi les morts
# subites sans rapport avec un port — panne de configuration, dependance
# manquante, permission refusee.
kill -0 "$SRV" 2>/dev/null || {
  echo "le serveur de marcq-handball s'est arrete au demarrage — si quelque chose repond sur :$PORT, c'est un AUTRE processus" >&2
  cat /tmp/marcq-handball-e2e.log >&2
  exit 1; }

curl -fsS "http://localhost:$PORT/healthz" >/dev/null || {
  echo "l'application ne repond pas sur /healthz" >&2
  cat /tmp/marcq-handball-e2e.log >&2
  exit 1; }

echo "==> tests Playwright"
[ -d node_modules ] || npm install --no-audit --no-fund
MARCQ_HANDBALL_E2E_URL="http://localhost:$PORT" npx playwright test
