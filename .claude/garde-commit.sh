#!/usr/bin/env bash
#
# Genere par init.sh — hook Stop : refuse de terminer sur un arbre de travail
# sale.
#
# Committer a chaque etape verifiee est ce qui evite la PR de mille lignes que
# personne ne relit vraiment. Le hook ne committe pas a votre place : il refuse
# seulement de laisser du travail non enregistre derriere lui.

set -u
BASE="main"

entree=$(cat)

# Garde anti-boucle. Quand ce hook a deja bloque et que la main est revenue,
# stop_hook_active vaut true : bloquer de nouveau ferait tourner en rond. En cas
# de doute on laisse passer — se tromper dans ce sens ne coute qu'un rappel
# manque, se tromper dans l'autre bloque la session.
case "$entree" in *'"stop_hook_active"'*true*) exit 0 ;; esac

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || exit 0

courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$courante" = "$BASE" ] && exit 0

sale=$(git status --porcelain 2>/dev/null)
[ -n "$sale" ] || exit 0
n=$(printf '%s\n' "$sale" | grep -c . || true)

raison="$n fichier(s) non committe(s) sur $courante.\n\nLa fabrique committe a chaque etape verifiee, pour que la relecture se fasse commit par commit plutot qu'en bloc a la fin.\n\n  ./init.sh --pret                    # l'etape est-elle committable ?\n  git add -A && git commit\n  git push -u origin $courante\n\nL'agent greffier fait ces trois gestes d'un coup. Si ce travail ne doit deliberement pas etre committe, dis-le explicitement."

printf '{"decision":"block","reason":"%s"}\n' "$raison"
exit 0
