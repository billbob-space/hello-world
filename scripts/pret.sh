#!/usr/bin/env bash
#
# pret.sh — cette etape est-elle committable ?
#
#   ./scripts/pret.sh
#
# Le point de passage avant chaque commit. Un commit qui casse quelque chose
# rend la relecture plus dure, pas plus simple : c'est tout l'interet de
# committer par etapes verifiees plutot qu'au kilometre.
#
# Il juge la branche, le journal et les tests des apps touchees ; le contrat et
# la fraicheur du releve de cout, il les DELEGUE a init.sh --check et a
# cout.sh --rappel, lances comme deux PROCESSUS separes plutot qu'importes. La
# frontiere de processus est deliberee — elle empeche ce script de developper
# une dependance sur l'interieur des deux autres, qui restent libres de changer
# sans le casser.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/journal.sh

BASE=$(fab base_branch main)

apps_touchees() {  # les apps modifiees depuis la base, travail non committe inclus
  {
    git diff --name-only "origin/$BASE...HEAD" 2>/dev/null || true
    git status --porcelain 2>/dev/null | cut -c4- || true
  } | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u \
    | while IFS= read -r a; do
        # Un if, et non « [ -f ... ] && printf » : sous set -e, un test faux
        # ferait sortir la boucle en code 1, donc la substitution de commande,
        # donc le script entier — et pret.sh s'arreterait sans rien dire.
        if [ -f "apps/$a/app.yml" ]; then printf '%s\n' "$a"; fi
      done
}

courante=$(branche_courante)
echo "Etape en cours — branche $courante"

if [ "$courante" = "$BASE" ]; then
  bad "sur $BASE : le travail doit vivre sur une branche dediee (./scripts/branche.sh <app>/<sujet>)"
else
  ok "branche dediee"
fi

if ./init.sh --check >/tmp/.pret-check.$$ 2>&1; then
  ok "contrat respecte"
else
  bad "./init.sh --check echoue :"
  grep -E 'KO' /tmp/.pret-check.$$ | sed 's/^/      /' || true
fi
rm -f /tmp/.pret-check.$$

# Le journal se verifie ici et pas seulement en CI : rendu a la relecture de
# la PR, le detail des anomalies est deja perdu. Le gabarit nu ne compte pas —
# sans ce second test, le geste deviendrait une case a cocher vide.
if [ "$courante" != "$BASE" ]; then
  entree=$(journal_entree "$courante")
  if [ -z "$entree" ]; then
    bad "journal : aucune entree pour $courante (./scripts/branche.sh $courante l'ouvre)"
  elif grep -q "$JOURNAL_MARQUEUR" "$entree"; then
    bad "journal : $entree est encore le gabarit nu — ecris-y les anomalies de cette branche"
  elif ! journal_entete "$entree"; then
    : # journal_entete a deja dit ce qui manque
  else
    ok "journal : $entree"
    # Le rappel de cout avertit sans bloquer. Depuis qu'il est un processus
    # separe, sa panne emporterait pret.sh sous set -e — avant meme le verdict
    # sur les tests, et sans dire pourquoi.
    ./scripts/cout.sh --rappel || true
  fi
fi

# Seules les apps reellement touchees depuis la base : sur une fabrique qui
# grandit, tout relancer a chaque commit couterait plus que ca ne rapporte.
touchees=$(apps_touchees)
if [ -z "$touchees" ]; then
  ok "aucune app modifiee — pas de test a lancer"
else
  for a in $touchees; do
    if [ ! -x "apps/$a/test.sh" ]; then
      bad "[$a] test.sh absent ou non executable"
    elif "apps/$a/test.sh" >/tmp/.pret-test.$$ 2>&1; then
      ok "[$a] tests verts"
    else
      bad "[$a] tests en echec :"
      tail -15 /tmp/.pret-test.$$ | sed 's/^/      /'
    fi
    rm -f /tmp/.pret-test.$$
  done
fi

echo
[ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s) — ne committe pas en l'etat."; exit 1; }
echo "Etape verifiee. Tu peux committer."
