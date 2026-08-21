#!/usr/bin/env bash
# acceptation.sh <repertoire-de-l-app>  — tests CACHES du banc artisan.
# Boite noire : il construit le binaire et l'interroge. Aucune hypothese sur
# les noms de fonctions choisis par l'artisan.
APP="${1:?usage: acceptation.sh <dir>}"
cd "$APP" || exit 9
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); printf '  OK   %s\n' "$1"; }
ko(){ FAIL=$((FAIL+1)); printf '  KO   %s — %s\n' "$1" "$2"; }

BIN=$(mktemp -d)/app
go build -o "$BIN" . 2>/tmp/build.err || { ko "A1 build" "$(head -3 /tmp/build.err)"; echo "SCORE 0/10"; exit 0; }
ok "A1 build"

PORT=0; lance(){ PORT=$((20000+RANDOM%20000)); PORT=$PORT env HELLO_WARMUP_S="$1" PORT=$PORT "$BIN" >/tmp/app.log 2>&1 &
  APPPID=$!; for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$PORT/healthz" && return 0; perl -e 'select(undef,undef,undef,0.1)'; done; return 1; }
arrete(){ kill "$APPPID" 2>/dev/null; wait "$APPPID" 2>/dev/null; }

# A2 — chauffe nulle : sonde verte, texte brut
if lance 0; then
  h=$(curl -s -o /tmp/b -w '%{http_code}|%{content_type}' "http://127.0.0.1:$PORT/healthz")
  [ "${h%%|*}" = 200 ] && [ "$(cat /tmp/b)" = "ok" -o "$(cat /tmp/b)" = "$(printf 'ok\n')" ] && case "$h" in *text/plain*) true;; *) false;; esac \
    && ok "A2 warmup=0 -> 200 ok text/plain" || ko "A2 warmup=0" "$h corps=$(head -c40 /tmp/b|tr -d '\n')"
  # A7 — la page d'accueil sert toujours
  p=$(curl -s -o /tmp/p -w '%{http_code}' "http://127.0.0.1:$PORT/")
  [ "$p" = 200 ] && grep -qi '<' /tmp/p && ok "A7 GET / intact" || ko "A7 GET /" "code=$p"
  # A8 — /version ne divulgue aucune identite
  curl -s -H 'X-Forwarded-User: espion@exemple.fr' -o /tmp/v "http://127.0.0.1:$PORT/version"
  grep -q 'espion' /tmp/v && ko "A8 fuite d'identite" "l'en-tete se retrouve dans /version" || ok "A8 aucune identite dans /version"
  arrete
else ko "A2/A7/A8" "l'app ne demarre pas avec HELLO_WARMUP_S=0"; fi

# A3/A4 — chauffe longue : sonde rouge, /version vert et ready=false
if lance 60; then
  h=$(curl -s -o /tmp/b -D /tmp/hd -w '%{http_code}' "http://127.0.0.1:$PORT/healthz")
  [ "$h" = 503 ] && grep -q 'starting' /tmp/b && ok "A3 chauffe -> 503 starting" || ko "A3 chauffe" "code=$h corps=$(head -c30 /tmp/b|tr -d '\n')"
  grep -qi '^x-app-version:' /tmp/hd && ok "A3b X-App-Version sur la 503" || ko "A3b X-App-Version" "absent de la 503"
  v=$(curl -s -o /tmp/v -w '%{http_code}|%{content_type}' "http://127.0.0.1:$PORT/version")
  [ "${v%%|*}" = 200 ] && case "$v" in *application/json*) true;; *) false;; esac && ok "A4a /version 200 json" || ko "A4a /version" "$v"
  if command -v python3 >/dev/null; then
    python3 - <<'PY' && ok "A4b cinq clefs, uptime_s entier, ready=false" || ko "A4b schema /version" "voir sortie"
import json,sys
d=json.load(open('/tmp/v'))
assert set(d)=={"version","short","started","uptime_s","ready"}, f"clefs={sorted(d)}"
assert isinstance(d["uptime_s"],int) and not isinstance(d["uptime_s"],bool), f"uptime_s={d['uptime_s']!r}"
assert d["ready"] is False, f"ready={d['ready']!r}"
assert isinstance(d["started"],str) and len(d["started"])>=19
PY
  fi
  arrete
else ko "A3/A4" "l'app ne demarre pas avec HELLO_WARMUP_S=60"; fi

# A5 — variable illisible : defaut 2 s, l'app demarre quand meme
if lance abc; then
  h1=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz")
  sleep 3
  h2=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz")
  [ "$h1" = 503 ] && [ "$h2" = 200 ] && ok "A5 HELLO_WARMUP_S=abc -> defaut 2 s" || ko "A5 valeur illisible" "avant=$h1 apres=$h2 (attendu 503 puis 200)"
  arrete
else ko "A5" "l'app refuse de demarrer sur une valeur illisible"; fi

# A6 — valeur negative : meme repli
if lance "-5"; then
  h1=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz"); sleep 3
  h2=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/healthz")
  [ "$h1" = 503 ] && [ "$h2" = 200 ] && ok "A6 valeur negative -> defaut" || ko "A6 valeur negative" "avant=$h1 apres=$h2"
  arrete
else ko "A6" "l'app refuse de demarrer sur une valeur negative"; fi

# A9 — la suite de l'app passe, et vite. On chauffe d'abord : le premier
# passage compile le module et coute 4,8 s sur une app intacte, ce qui n'a rien
# a voir avec la qualite de la suite ecrite par l'artisan.
./test.sh >/dev/null 2>&1
t0=$(date +%s%N); ./test.sh >/tmp/t.log 2>&1; rc=$?; t1=$(date +%s%N)
ms=$(( (t1-t0)/1000000 ))
[ $rc -eq 0 ] && ok "A9a test.sh vert" || ko "A9a test.sh" "$(tail -3 /tmp/t.log|tr '\n' ' ')"
[ "$ms" -lt 3000 ] && ok "A9b suite sous 3 s (${ms} ms)" || ko "A9b suite lente" "${ms} ms — la suite attend l'horloge reelle"

echo "SCORE $PASS/$((PASS+FAIL))"
