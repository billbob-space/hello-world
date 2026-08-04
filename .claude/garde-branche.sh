#!/usr/bin/env bash
#
# Hook PreToolUse : refuse d'ecrire directement sur main.
#
# La fabrique ouvre une branche des la PREMIERE modification. Une regle ecrite
# dans CLAUDE.md s'oublie ; un hook, lui, s'execute. Il ne cree pas la branche
# lui-meme : le nom doit dire le sujet, et seul celui qui edite le connait.
#
# Aucune dependance : ni jq ni python. Un garde-fou qui ne demarre pas sur une
# machine depouillee ne garde rien.

set -u
BASE="main"

entree=$(cat)

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
racine=$(git rev-parse --show-toplevel)
courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$courante" = "$BASE" ] || exit 0

# Un fichier hors du depot ne concerne pas cette regle : le hook n'a pas a
# bloquer l'edition d'un brouillon ou d'une note personnelle. Chemin illisible
# = on protege, par defaut.
cible=$(printf '%s' "$entree" | sed -nE 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -1)
case "$cible" in
  "$racine"/*) ;;
  "")          ;;
  *) exit 0 ;;
esac

raison="Modification refusee : HEAD est sur $BASE.\n\nLa fabrique ouvre une branche des la premiere modification, nommee <app>/<sujet> — ou fabrique/<sujet> pour init.sh, la CI, le contrat ou l'outillage.\n\n  ./init.sh --branche <app>/<sujet>\n\nPuis recommence cette modification."

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$raison"
exit 0
