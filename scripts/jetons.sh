#!/usr/bin/env bash
#
# jetons.sh — ce que la fabrique entiere a consomme, lu dans journal/.
#
#   ./scripts/jetons.sh              le tableau par branche, puis la synthese
#   ./scripts/jetons.sh --leviers    la synthese seule, sans le tableau
#
# cout.sh mesure UNE branche depuis les conversations du conteneur, qui
# disparaissent avec lui ; ce script-ci mesure TOUTES les branches depuis ce que
# cout.sh a fige dans le journal. C'est la seule mesure qui survive aux
# conteneurs, et la seule qu'on puisse refaire le mois prochain pour savoir si
# quelque chose a bouge.
#
# Une entree qui porte un total sans detail par tour n'est pas une erreur : le
# bloc de detail est arrive apres les huit premieres. Elle est comptee dans le
# total du depot et exclue des postes, et le script le DIT — un chiffre partiel
# qu'on prend pour un chiffre complet est pire que pas de chiffre du tout.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/jetons.sh

LEVIERS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --leviers) LEVIERS=1 ;;
    -h|--help) sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

awk -v TARIFS="$(jetons_tarifs)" \
    -v MULT_E="$JETONS_CACHE_ECRITURE" -v MULT_L="$JETONS_CACHE_LECTURE" \
    -v LEVIERS="$LEVIERS" '
  BEGIN {
    n = split(TARIFS, l, ";")
    for (i = 1; i <= n; i++) {
      if (l[i] == "") continue
      split(l[i], c, ":"); prix_e[c[1]] = c[2] + 0; prix_s[c[1]] = c[3] + 0
    }
  }
  FNR == 1 { fichier = FILENAME; sub(/^journal\//, "", fichier); sub(/\.md$/, "", fichier)
             dedans = 0 }
  # ANCRES EN DEBUT DE LIGNE, et ce n est pas une precaution de style : une
  # entree de journal PARLE de ces marqueurs — « le detail (<!-- cout-detail -->)
  # n existe que dans les cinq dernieres » — et le motif non ancre ouvrait le bloc
  # sur cette phrase, faisant lire trois cents lignes de prose comme des tours.
  /^<!-- cout-total:/ { t = $0; gsub(/[^0-9]/, "", t); total_depot += t; a_total[fichier] = 1 }
  /^<!-- cout-detail/ { dedans = 1; a_detail[fichier] = 1; next }
  dedans && /^-->/   { dedans = 0; next }
  dedans && NF == 6 {
    if ($1 !~ /^[0-9]+$/ || $2 !~ /^(principal|agent)$/) next
    m = $3; w = $4 + 0; r = $5 + 0; s = $6 + 0
    # Un modele sans tarif est compte en JETONS et pas en argent — la meme regle
    # que cout.sh. L ecarter des tours fausserait « x des y tours » sans le dire.
    if (!(m in prix_e)) { inconnus[m] = 1; prix_e[m] = 0; prix_s[m] = 0 }
    cc = (w * prix_e[m] * MULT_E + r * prix_e[m] * MULT_L + s * prix_s[m]) / 1000000
    tours[fichier]++; ew[fichier] += w; er[fichier] += r; es[fichier] += s; ec[fichier] += cc
    T_tours++; T_w += w; T_r += r; T_s += s; T_c += cc
    T_we += w * prix_e[m] * MULT_E / 1000000
    T_re += r * prix_e[m] * MULT_L / 1000000
    T_se += s * prix_s[m] / 1000000
    # Un tour qui ne rend qu un appel d outil paie tout le contexte relu pour une
    # sortie de rien. Les grouper est le seul gain sans contrepartie.
    if (s < 300) { courts++; courts_c += cc }
    # L amorce — contrat, outillage, definitions d outils — est ecrite au premier
    # tour de la session, puis relue a chacun des suivants. Son prix se lit sur le
    # modele de CE tour : un tarif ecrit en dur rendrait le levier faux le jour ou
    # une branche tourne sur un autre modele, et le rendrait faux en silence.
    if (tours[fichier] == 1) { amorce[fichier] = w; prix_amorce[fichier] = prix_e[m] }
  }
  # La mise en forme reste ici plutot que dans un sed en aval : un sed qui espace
  # les milliers ne sait pas distinguer un nombre de jetons d un montant en
  # dollars, et decoupe les deux.
  function nb(x,   s, r) {
    s = sprintf("%d", x)
    while (length(s) > 3) { r = " " substr(s, length(s) - 2) r; s = substr(s, 1, length(s) - 3) }
    return s r
  }
  function eur(x,   s) { s = sprintf("%.2f", x); gsub(/\./, ",", s); return s }
  function pc(x, t) { return sprintf("%d %%", int(100 * x / t + 0.5)) }
  END {
    if (T_tours == 0) { print "aucun releve detaille dans journal/ — rien a consolider"; exit }
    if (!LEVIERS) {
      printf "\n-- par branche\n"
      for (f in tours)
        printf "  %-52s %6d tours  %14s jetons  %9s $\n", \
          substr(f, 1, 52), tours[f], nb(ew[f] + er[f] + es[f]), eur(ec[f])
    }
    printf "\n-- la facture\n"
    printf "  ecriture de cache  %9s $  %5s\n", eur(T_we), pc(T_we, T_c)
    printf "  lecture de cache   %9s $  %5s\n", eur(T_re), pc(T_re, T_c)
    printf "  sortie             %9s $  %5s\n", eur(T_se), pc(T_se, T_c)
    printf "  TOTAL              %9s $  sur %s tour(s), %s jetons detailles\n", \
      eur(T_c), nb(T_tours), nb(T_w + T_r + T_s)
    printf "\n-- les leviers\n"
    for (f in amorce) a += amorce[f] * (tours[f] - 1) * prix_amorce[f] * MULT_L / 1000000
    printf "  amorce relue       %9s $  %5s\n", eur(a), pc(a, T_c)
    printf "  tours courts       %9s $  %5s  — %s des %s tours sortent moins de 300 jetons\n", \
      eur(courts_c), pc(courts_c, T_c), nb(courts), nb(T_tours)
    nd = 0; for (f in a_total) if (!(f in a_detail)) nd++
    printf "\n-- ce qui manque\n"
    printf "  %d entree(s) sans detail par tour, comptees hors des postes ci-dessus\n", nd
    printf "  total du depot, detail ou non : %s jetons\n", nb(total_depot)
    for (m in inconnus) printf "  modele hors tarifs, non facture : %s\n", m
  }
' journal/*.md
