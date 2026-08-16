#!/usr/bin/env bash
#
# test-pret.sh — le contrat de test du garde-fou « le PRD suit-il ? ».
#
#   ./test-pret.sh            lance tous les cas
#   ./test-pret.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Ce garde-fou est le seul de la fabrique a reposer sur une HEURISTIQUE : il
# deduit « une capacite neuve est arrivee » de « un fichier de code neuf est
# arrive ». Une heuristique ne se relit pas — elle se mesure sur des cas. Deux
# facons de la perdre en silence, et aucune ne se voit dans le diff :
#
#   - trop bavarde : elle se declenche sur les corrections, on l'ignore, elle
#     ne garde plus rien. Quatre des sept changements du 7 aout sur
#     marcq-handball sont des corrections ; aucun ne doit la declencher ;
#   - muette : un motif d'exclusion trop large — « tests? » attrapant aussi
#     « web/ » un jour de refactoring — et elle laisse passer exactement ce
#     qu'elle surveille, sans que la sortie ne change d'un caractere.
#
# COMMENT : chaque cas monte un bac a sable, y pose la situation exacte a
# juger, lance pret.sh EN ENTIER et regarde si la ligne d'avertissement sort.
# pret.sh y echoue par ailleurs — pas de journal, contrat rouge — et c'est sans
# importance : on n'observe que cette ligne, jamais son code de sortie. Le
# lancer en entier plutot que d'extraire la fonction est delibere : c'est le
# chemin reel, celui ou une variable renommee ailleurs casserait le garde-fou.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0
BRANCHE=claude/test-pret
APP=bidon

reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# --- le bac a sable --------------------------------------------------------------
#
# Copie du depot suivi par git, comme dans test-cout.sh, plus une app FACTICE
# deja livree — un app.yml pour que pret.sh la voie, un PRODUCT.md pour qu'elle
# ait un PRD a laisser en arriere, un fichier de code deja la pour distinguer
# « modifie » de « neuf ».
#
# origin/main est pose a la main sur le commit de base. Sans lui, « git diff
# origin/main...HEAD » echoue en silence et le bac ne testerait plus que la
# moitie non committee du garde-fou — celle que git status rapporte.

bac() {  # bac — cree un bac a sable neuf et en imprime le chemin
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  mkdir -p "$d/apps/$APP/web"
  printf 'port: 8080\nenabled: false\n'          > "$d/apps/$APP/app.yml"
  printf '# Product — %s\n\nUne app de test.\n' "$APP" > "$d/apps/$APP/PRODUCT.md"
  printf 'export const deja = 1\n'               > "$d/apps/$APP/web/deja.js"
  printf '#!/bin/sh\nexit 0\n'                   > "$d/apps/$APP/test.sh"
  chmod +x "$d/apps/$APP/test.sh"
  git -C "$d" init -q -b main
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  git -C "$d" update-ref refs/remotes/origin/main main
  git -C "$d" checkout -q -b "$BRANCHE"
  printf '%s' "$d"
}

# cas <nom> <attendu: avertit|silence> <committe: oui|non> — la situation est
# posee par le fragment de shell lu sur l'entree standard, execute a la racine
# du bac. Il est lu AVANT le bac : le filtre par motif ne doit pas laisser un
# heredoc non consomme derriere lui.
cas() {
  local nom="$1" attendu="$2" committe="$3" situation d sortie vu
  situation=$(cat)
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  ( cd "$d" && bash -euo pipefail -c "$situation" )
  if [ "$committe" = oui ]; then
    git -C "$d" add -A
    git -C "$d" -c user.email=test@local -c user.name=test commit -qm etape
  fi
  sortie=$( cd "$d" && ./scripts/pret.sh 2>&1 ) || true
  vu=silence
  printf '%s\n' "$sortie" | grep -q "\[$APP\] du code neuf" && vu=avertit
  if [ "$vu" = "$attendu" ]; then
    reussi "$nom"
  else
    echec "$nom" "attendu : $attendu — obtenu : $vu"
  fi
}

printf '\n-- ce qui doit avertir\n'

cas "code neuf, PRODUCT.md immobile" avertit non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

cas "code neuf deja committe sur la branche" avertit oui <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

# Le cas qui distingue ce garde-fou d'un rappel poli : la capacite neuve arrive
# AVEC son test, comme le veut le contrat. Si le fichier de test suffisait a
# eteindre l'avertissement, il ne se declencherait jamais sur du travail bien
# fait — c'est-a-dire jamais.
cas "code neuf accompagne de son test" avertit non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
  mkdir -p "apps/bidon/tests"
  printf 'test("chrono", () => {})\n' > "apps/bidon/tests/chrono.test.js"
FIN

printf '\n-- ce qui doit se taire\n'

cas "code neuf, PRODUCT.md touche" silence non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
  printf '\nLe minuteur.\n' >> "apps/bidon/PRODUCT.md"
FIN

cas "fichier existant modifie" silence non <<'FIN'
  printf 'export const deja = 2\n' > "apps/bidon/web/deja.js"
FIN

cas "test neuf seul, sur un correctif" silence non <<'FIN'
  printf 'export const deja = 2\n' > "apps/bidon/web/deja.js"
  mkdir -p "apps/bidon/tests"
  printf 'test("deja", () => {})\n' > "apps/bidon/tests/deja.test.js"
FIN

cas "document neuf seul" silence non <<'FIN'
  printf '# Notes\n' > "apps/bidon/NOTES.md"
FIN

# Une app SANS PRODUCT.md n'a pas de PRD a laisser en arriere : lui reprocher de
# ne pas le mettre a jour serait un avertissement qu'aucun geste n'eteint.
cas "app sans PRODUCT.md" silence non <<'FIN'
  rm -f "apps/bidon/PRODUCT.md"
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

printf '\n-- les promesses du journal\n'

# Une Action « garde-fou » ou « contrat » promet un changement de la surface
# partagee. 96 promesses ecrites dans le journal, 11 commits qui touchent ces
# fichiers : le journal enregistrait sans que rien ne suive. Ces deux cas
# tiennent le rapprochement — et le second existe parce que CLAUDE.md doit
# compter dans la liste, faute de quoi le garde-fou avertirait a tort.
cas_promesse() {  # <nom> <attendu: avertit|silence> — la situation est lue sur l'entree standard
  local nom="$1" attendu="$2" situation d sortie vu
  situation=$(cat)
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  mkdir -p "$d/journal"
  cat > "$d/journal/2026-01-01-claude-test-pret.md" <<'ENTREE'
# 2026-01-01 — claude/test-pret

Branche : `claude/test-pret`
Périmètre : bidon
Mode : `chaud`

## Anomalies

### 1. Une anomalie qui promet un garde-fou

**Symptome** — peu importe.

**Cause** — peu importe.

**Detecte par** — `test`

**Action** — `garde-fou` — le geste promis.
ENTREE
  ( cd "$d" && bash -euo pipefail -c "$situation" )
  sortie=$( cd "$d" && ./scripts/pret.sh 2>&1 ) || true
  vu=silence
  printf '%s\n' "$sortie" | grep -q "action(s) garde-fou/contrat sans suite" && vu=avertit
  if [ "$vu" = "$attendu" ]; then
    reussi "$nom"
  else
    echec "$nom" "attendu : $attendu — obtenu : $vu"
    printf '%s\n' "$sortie" | grep -E "journal" | sed 's/^/      /' | head -3
  fi
}

cas_promesse "une action garde-fou sans rien sous la surface partagee avertit" avertit <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

cas_promesse "CLAUDE.md compte comme surface partagee, et fait taire l'avertissement" silence <<'FIN'
  printf '\nUne ligne de plus.\n' >> CLAUDE.md
FIN

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
