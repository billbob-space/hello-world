#!/usr/bin/env bash
#
# cout.sh — ce que la branche courante a consomme en jetons, et son prix.
#
#   ./scripts/cout.sh              releve, affiche, et ecrit le bloc dans l'entree de journal
#   ./scripts/cout.sh --dry-run    releve et affiche seulement, n'ecrit rien
#   ./scripts/cout.sh --rappel     n'affiche qu'un avertissement si le releve manque ou
#                                  a derive — le mode qu'utilise pret.sh, jamais un
#                                  geste manuel
#
# La consommation d'une session ne vit PAS dans le depot : elle est ecrite au fil
# de l'echange dans le fichier de conversation du conteneur, sous
# ~/.claude/projects/<chemin-du-depot>/. Ce conteneur est ephemere, et rien ne
# recopie ce fichier avant qu'il disparaisse — d'ou ce script, qui fige le
# chiffre dans l'entree de journal, seul endroit du depot qui appartienne a la
# branche. Un releve manque est un releve perdu : aucun outil ne le reconstitue.

set -euo pipefail

DRYRUN=0 RAPPEL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRYRUN=1 ;;
    --rappel)  RAPPEL=1 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/journal.sh

BASE=$(fab base_branch main)

# Deux multiplicateurs suffisent a passer des jetons a l'argent une fois le prix
# d'entree connu. Ils valent pour toute l'API, quel que soit le modele, et
# vivent donc ici plutot que dans fabrique.yml, ou seuls les tarifs par modele
# et le taux de change ont leur place.
COUT_CACHE_ECRITURE=1.25   # ecrire dans le cache coute 1,25x le prix d'entree
COUT_CACHE_LECTURE=0.10    # y lire coute 0,1x
COUT_TAUX_JOURS=90         # au-dela, le taux de change est signale comme vieux

COUT_DEBUT='<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->'
COUT_FIN='<!-- /cout -->'
# Le bloc s'ECRIT avec COUT_DEBUT, mais il se RECONNAIT sur ce prefixe. Les
# entrees deja committees nomment « ./init.sh --cout », qui n'existe plus depuis
# que le releve a son propre script : les reconnaitre a l'identique leur
# ajouterait un second bloc au lieu de remplacer le premier, et cout_total_ecrit
# — qui garde la premiere occurrence — lirait le total perime pour toujours.
COUT_OUVERTURE='<!-- cout : genere par '

cout_dir() {  # le repertoire des conversations de CE depot, ou vide
  local d
  d="${HOME:-}/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')"
  [ -d "$d" ] || return 0
  ls "$d"/*.jsonl >/dev/null 2>&1 || return 0
  printf '%s' "$d"
}

cout_tarifs() {  # « modele:entree:sortie » separes par « ; », depuis fabrique.yml
  local t n i sep=""
  t=$(ymaps fabrique.yml tarifs)
  n=$(map_count "$t")
  for ((i = 0; i < n; i++)); do
    printf '%s%s:%s:%s' "$sep" \
      "$(map_one "$t" "$i" modele)" "$(map_one "$t" "$i" entree)" "$(map_one "$t" "$i" sortie)"
    sep=";"
  done
}

# cout_releve <repertoire> — lit toutes les conversations et rend des lignes
# « CLE valeur... ». Le calcul reste dans awk, ou les flottants existent ; la
# mise en forme reste dans bash, ou les accents et les tableaux se relisent.
#
# Le fichier est du JSON par ligne. On n'en extrait que ce qui est stable : la
# ligne porte un objet « usage », precede du modele qui l'a produite. Deux
# pieges, tous deux dans l'objet usage lui-meme : « iterations » repete
# input_tokens et output_tokens pour chaque tentative — on coupe donc la ligne
# avant lui — et « cache_creation » redetaille l'ecriture par duree de vie, sans
# danger celui-la, ses cles commencent par « ephemeral_ » et non par le
# guillemet que les motifs exigent.
cout_releve() {
  awk -v TARIFS="$(cout_tarifs)" \
      -v MULT_E="$COUT_CACHE_ECRITURE" -v MULT_L="$COUT_CACHE_LECTURE" '
    BEGIN {
      n = split(TARIFS, lignes, ";")
      for (i = 1; i <= n; i++) {
        if (lignes[i] == "") continue
        split(lignes[i], c, ":")
        prix_e[c[1]] = c[2] + 0; prix_s[c[1]] = c[3] + 0
      }
    }
    function val(s, cle,   re, v) {
      re = "\"" cle "\":[ \t]*[0-9]+"
      if (!match(s, re)) return 0
      v = substr(s, RSTART, RLENGTH); sub(/^[^:]*:[ \t]*/, "", v); return v + 0
    }
    FNR == 1 { sessions++ }
    {
      p = index($0, "\"usage\":{")
      if (!p) next
      u = substr($0, p)
      q = index(u, "\"iterations\"")
      if (q) u = substr(u, 1, q - 1)

      # Le modele se lit AVANT usage, et la premiere occurrence est la bonne :
      # « model » est la premiere cle du message, tout « model » plus loin
      # appartient au texte que le message transporte.
      m = "?"
      tete = substr($0, 1, p - 1)
      if (match(tete, /"model":[ \t]*"[^"]*"/)) {
        m = substr(tete, RSTART, RLENGTH)
        sub(/^"model":[ \t]*"/, "", m); sub(/"$/, "", m)
      }
      vus[m] = 1
      e[m]  += val(u, "input_tokens")
      ce[m] += val(u, "cache_creation_input_tokens")
      cl[m] += val(u, "cache_read_input_tokens")
      s[m]  += val(u, "output_tokens")
    }
    END {
      for (m in vus) {
        j_e += e[m]; j_ce += ce[m]; j_cl += cl[m]; j_s += s[m]
        if (!(m in prix_e)) { inconnus = inconnus sep_i m; sep_i = ", "; continue }
        d_e  += e[m]  * prix_e[m] / 1000000
        d_ce += ce[m] * prix_e[m] * MULT_E / 1000000
        d_cl += cl[m] * prix_e[m] * MULT_L / 1000000
        d_s  += s[m]  * prix_s[m] / 1000000
        modeles = modeles sep_m m; sep_m = ", "
      }
      printf "SESSIONS %d\n", sessions
      printf "MODELES %s\n", modeles
      printf "INCONNUS %s\n", inconnus
      printf "POSTE entree %d %.6f\n", j_e, d_e
      printf "POSTE ecriture %d %.6f\n", j_ce, d_ce
      printf "POSTE lecture %d %.6f\n", j_cl, d_cl
      printf "POSTE sortie %d %.6f\n", j_s, d_s
      printf "TOTAL %d %.6f\n", j_e + j_ce + j_cl + j_s, d_e + d_ce + d_cl + d_s
    }
  ' "$1"/*.jsonl
}

cout_nb() {  # 7557412 -> « 7 557 412 »
  printf '%s' "$1" | sed -e :a -e 's/\(.*[0-9]\)\([0-9]\{3\}\)/\1 \2/;ta'
}

cout_montant() {  # cout_montant <dollars> <taux|vide> — « 11,44 $ — 9,93 € »
  awk -v d="$1" -v t="$2" 'BEGIN {
    s = sprintf("%.2f $", d)
    if (t != "") s = s sprintf(" — %.2f €", d * t)
    gsub(/\./, ",", s); print s
  }'
}

virgule() { printf '%s' "${1//./,}"; }  # 1.25 -> « 1,25 »

cout_total_ecrit() {  # le total en jetons deja consigne dans <entree>, ou vide
  grep -o 'cout-total: [0-9]*' "$1" 2>/dev/null | head -1 | tr -dc '0-9' || true
}

cout_ecrit() {  # cout_ecrit <entree> <bloc> — remplace le bloc existant, ou l'ajoute
  local entree="$1" bloc="$2" tmp
  tmp=$(mktemp)
  awk -v d="$COUT_OUVERTURE" -v f="$COUT_FIN" '
    index($0, d) == 1 { saute = 1 }
    saute != 1 { print }
    $0 == f { saute = 0 }
  ' "$entree" > "$tmp"
  # « $(cat) » retire les lignes vides de fin : le bloc se recolle toujours a la
  # meme distance du texte, qu'il remplace un bloc precedent ou non.
  printf '%s\n\n%s\n' "$(cat "$tmp")" "$bloc" > "$entree"
  rm -f "$tmp"
}

# cout_rappel <entree> — l'avertissement de pret.sh. Il AVERTIT sans bloquer :
# le releve peut encore etre ecrit au commit suivant, tant que la branche vit,
# et refuser un commit pour un chiffre serait plus couteux que le chiffre.
# Mais il se repete a chaque etape, parce qu'une branche fusionnee sans releve
# a perdu le sien pour de bon.
cout_rappel() {
  local entree="$1" d ecrit actuel
  d=$(cout_dir); [ -n "$d" ] || return 0
  actuel=$(cout_releve "$d" | awk '$1 == "TOTAL" { print $2 }')
  [ -n "$actuel" ] && [ "$actuel" -gt 0 ] 2>/dev/null || return 0
  ecrit=$(cout_total_ecrit "$entree")
  if [ -z "$ecrit" ]; then
    warn "cout : non releve — ./scripts/cout.sh l'ecrit dans l'entree (le chiffre disparait avec le conteneur)"
  elif [ "$((ecrit * 10))" -lt "$((actuel * 9))" ]; then
    warn "cout : releve a $(cout_nb "$ecrit") jetons, la conversation en compte $(cout_nb "$actuel") — relance ./scripts/cout.sh"
  fi
}

courante=$(branche_courante)
entree=""
[ "$courante" != "$BASE" ] && entree=$(journal_entree "$courante")

if [ "$RAPPEL" = 1 ]; then
  [ -n "$entree" ] && cout_rappel "$entree"
  exit 0
fi

dir=$(cout_dir)
if [ -z "$dir" ]; then
  echo "Aucune conversation lisible depuis ce conteneur — rien a relever."
  echo "Le fichier vit sous ~/.claude/projects/<chemin-du-depot>/ et disparait avec le conteneur."
  exit 0
fi

releve=$(cout_releve "$dir")
sessions=$(printf '%s\n' "$releve" | awk '$1 == "SESSIONS" { print $2 }')
modeles=$(printf '%s\n' "$releve" | sed -n 's/^MODELES //p')
inconnus=$(printf '%s\n' "$releve" | sed -n 's/^INCONNUS //p')
taux=$(fab taux_usd_eur "")
taux_date=$(fab taux_date "")

# Un taux vieux fausse le montant en silence : mieux vaut n'ecrire aucun euro
# qu'un euro faux. Le dollar, lui, ne depend que des tarifs.
if [ -n "$taux_date" ] && command -v date >/dev/null; then
  if age=$(( ( $(date -u +%s) - $(date -u -d "$taux_date" +%s 2>/dev/null || echo 0) ) / 86400 )) \
     && [ "$age" -gt "$COUT_TAUX_JOURS" ] 2>/dev/null; then
    warn "taux de change du $taux_date, vieux de $age jours — mets a jour taux_usd_eur dans fabrique.yml"
  fi
fi
[ -n "$inconnus" ] && warn "modele(s) sans tarif dans fabrique.yml : $inconnus — comptes en jetons, pas en argent"

# Les euros ne figurent que sur le total : repetes ligne a ligne, ils doublent
# la largeur du tableau sans rien apprendre.
lignes=""
ajoute() {  # ajoute <etiquette> <cle du releve>
  local j d
  j=$(printf '%s\n' "$releve" | awk -v k="$2" '$1 == "POSTE" && $2 == k { print $3 }')
  d=$(printf '%s\n' "$releve" | awk -v k="$2" '$1 == "POSTE" && $2 == k { print $4 }')
  lignes="$lignes| $1 | $(cout_nb "$j") | $(cout_montant "$d" "") |
"
}
ajoute "Entrée" entree
ajoute "Écriture de cache" ecriture
ajoute "Lecture de cache" lecture
ajoute "Sortie" sortie
tot_j=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $2 }')
tot_d=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $3 }')

bloc=$(cat <<BLOC
$COUT_DEBUT
## Coût

Relevé le $(date -u '+%Y-%m-%d à %H:%M UTC'), sur $sessions session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
${modeles:-aucun}. Tarifs de \`fabrique.yml\`, en dollars par million de jetons ;
écriture de cache à $(virgule "$COUT_CACHE_ECRITURE")x le prix d'entrée, lecture à $(virgule "$COUT_CACHE_LECTURE")x.$([ -n "$taux" ] && printf ' Taux
1 $ = %s € au %s.' "$(virgule "$taux")" "$taux_date")

| Poste | Jetons | Coût |
|---|---:|---:|
$lignes| **Total** | **$(cout_nb "$tot_j")** | **$(cout_montant "$tot_d" "$taux")** |

<!-- cout-total: $tot_j -->
$COUT_FIN
BLOC
)

printf '%s\n' "$bloc"
echo

[ "$DRYRUN" = 1 ] && { ok "--dry-run : rien ecrit"; exit 0; }

if [ -z "$entree" ]; then
  warn "aucune entree de journal pour '$courante' — releve affiche, pas ecrit"
  exit 0
fi
cout_ecrit "$entree" "$bloc"
ok "cout ecrit dans $entree"
