#!/usr/bin/env bash
#
# branche.sh — ouvre la branche de travail, et son entree de journal.
#
#   ./scripts/branche.sh <app>/<sujet>       branche propre a une app
#   ./scripts/branche.sh fabrique/<sujet>    branche touchant init.sh, la CI, le
#                                            contrat, l'outillage — tout ce qui
#                                            n'est pas une app
#
# Convention : <app>/<sujet>, ou fabrique/<sujet> pour ce qui touche init.sh, la
# CI, le contrat ou l'outillage. Le prefixe dit quel perimetre est en jeu — donc
# quel rayon de souffle — avant meme d'ouvrir le diff.
#
# Une exception, subie et non choisie : le harnais cloud assigne des branches
# claude/<sujet>. Voir la validation plus bas.

set -euo pipefail

[ $# -eq 1 ] || {
  echo "usage : ./scripts/branche.sh <app>/<sujet>  (ou fabrique/<sujet>)" >&2; exit 2; }
BRANCHE="$1"

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/journal.sh

BASE=$(fab base_branch main)
PREFIXE_HARNAIS=claude

discover_apps
prefixe=${BRANCHE%%/*}; sujet=${BRANCHE#*/}

if [ "$prefixe" = "$BRANCHE" ]; then
  echo "ERREUR : '$BRANCHE' n'a pas de prefixe." >&2
  echo "Attendu : <app>/<sujet>, ou fabrique/<sujet> pour l'infrastructure." >&2
  echo "Apps disponibles : ${APPS[*]}" >&2
  exit 1
fi

# Le harnais cloud assigne lui-meme le nom de la branche, sous la forme
# claude/<sujet>, et interdit de pousser ailleurs. Ce prefixe ne dit rien du
# perimetre — c'est sa limite, pas une faute : la branche n'a pas choisi son
# nom. Le refuser rendait ce script inutilisable en session cloud, donc
# empechait d'y ouvrir l'entree de journal. Il est accepte pour rejoindre une
# branche existante, jamais pour en creer une : personne ne choisit ce prefixe.
connu=0
[ "$prefixe" = fabrique ] && connu=1
for a in "${APPS[@]}"; do [ "$a" = "$prefixe" ] && connu=1; done
if [ "$prefixe" = "$PREFIXE_HARNAIS" ]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCHE"; then
    connu=1
  else
    echo "ERREUR : le prefixe '$PREFIXE_HARNAIS' est celui du harnais cloud, qui l'assigne lui-meme." >&2
    echo "Il ne se choisit pas : pour une branche neuve, prends <app>/<sujet> ou fabrique/<sujet>." >&2
    echo "Apps disponibles : ${APPS[*]}" >&2
    exit 1
  fi
fi
if [ "$connu" = 0 ]; then
  echo "ERREUR : prefixe '$prefixe' inconnu." >&2
  echo "Attendu : <app>/<sujet>, ou fabrique/<sujet> pour l'infrastructure." >&2
  echo "Apps disponibles : ${APPS[*]}" >&2
  exit 1
fi

printf '%s' "$sujet" | grep -qE '^[a-z0-9][a-z0-9-]*$' || {
  echo "ERREUR : sujet '$sujet' invalide — minuscules, chiffres et tirets." >&2; exit 1; }

if git show-ref --verify --quiet "refs/heads/$BRANCHE"; then
  git switch "$BRANCHE"
  ok "branche existante : $BRANCHE"
else
  # Partir de la base a jour plutot que du HEAD courant : une branche greffee
  # sur une autre branche de travail traine ses commits dans sa PR.
  git fetch origin "$BASE" >/dev/null 2>&1 || warn "origin/$BASE non joignable, depart depuis HEAD"
  if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
    git switch -c "$BRANCHE" "origin/$BASE"
  else
    git switch -c "$BRANCHE"
  fi
  ok "branche creee : $BRANCHE"
fi
# L'entree s'ouvre avec la branche : c'est le seul moment ou le geste est
# gratuit, et le seul qui permette d'ecrire les anomalies a chaud.
journal_ouvre "$BRANCHE" "$BASE"
