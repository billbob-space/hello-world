#!/usr/bin/env bash
# docs/banc/mesurer.sh — le banc de mesure de la chaine de developpement.
#
#   ./docs/banc/mesurer.sh            # les scenarios legers (quelques minutes)
#   ./docs/banc/mesurer.sh --lourd    # + les scenarios lourds (une dizaine de minutes)
#   ./docs/banc/mesurer.sh <nom>...   # un ou plusieurs scenarios nommes
#   ./docs/banc/mesurer.sh --liste    # les scenarios disponibles
#
# Il n'ecrit RIEN dans le depot : il chronometre, il affiche, et c'est a
# l'operateur de recopier le bloc final dans docs/banc/releves.md. Le protocole,
# le panel d'apps et les pieges de mesure sont dans docs/banc/README.md.
#
# Pourquoi ici et pas dans scripts/ : scripts/ ne porte que des metiers que
# pret.sh ou la CI appellent. Le banc ne s'invoque qu'a la main, quand on veut
# chiffrer une evolution de la chaine. Un executable de plus dans scripts/
# serait un point de passage que rien ne franchit.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

# --- les scenarios -------------------------------------------------------------
#
# Trois champs separes par « | » : repetitions, ce qu'il mesure, commande.
# Les repetitions valent 1 pour les scenarios de plusieurs minutes : cinq
# passages d'un scenario de quatre minutes font un banc que personne ne rejoue.
declare -A SCENARIOS=(
  [contrat]='5|le verificateur seul : manifestes + services, aucune compilation|./init.sh --check'
  [tests-petite]='5|go vet + go test sur la plus petite app : le cout plancher|./apps/hello-world/test.sh'
  [revue-petite]='5|les cinq axes sur 403 lignes : le cout fixe de la revue|./scripts/revue.sh hello-world'
  [revue-moyenne]='3|les cinq axes en configuration complete (Go + JS, 3 seuils)|./scripts/revue.sh pilabelle'
  [revue-toutes]='3|les dix apps par le chemin par defaut — le chiffre a suivre|./scripts/revue.sh --toutes'
  [revue-serie]='3|les memes dix apps forcees en serie — le temoin du parallelisme|REVUE_PARALLELE=1 ./scripts/revue.sh --toutes'
  [tests-grosse]='3|npm ci + esbuild + tsc + vitest + go test -race sur 10 paquets|./apps/ramure-v2/test.sh'
)
LEGERS=(contrat tests-petite revue-petite revue-moyenne)
LOURDS=(revue-toutes revue-serie tests-grosse)
ORDRE=(contrat tests-petite revue-petite revue-moyenne revue-toutes revue-serie tests-grosse)

liste() {
  printf 'Scenarios du banc :\n\n'
  for n in "${ORDRE[@]}"; do
    IFS='|' read -r rep quoi cmd <<< "${SCENARIOS[$n]}"
    printf '  %-14s %sx  %s\n                 %s\n' "$n" "$rep" "$quoi" "$cmd"
  done
}

case "${1-}" in
  -h|--help) sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  --liste)   liste; exit 0 ;;
  --lourd)   CIBLES=("${LEGERS[@]}" "${LOURDS[@]}") ;;
  '')        CIBLES=("${LEGERS[@]}") ;;
  *)         CIBLES=("$@") ;;
esac

for n in "${CIBLES[@]}"; do
  [ -n "${SCENARIOS[$n]-}" ] || { echo "ERREUR : scenario inconnu '$n'. --liste pour les voir." >&2; exit 2; }
done

# --- l'etat de la machine, sans lequel deux releves ne se comparent pas ---------
sha=$(git rev-parse --short HEAD)
sale=$(git status --porcelain | wc -l)
toolchain=$(sed -n 's/^outil_toolchain: *//p' fabrique.yml)
echo "=== banc — $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
printf 'commit        %s%s\n' "$sha" "$( [ "$sale" -gt 0 ] && echo " (+$sale fichiers non committes — releve NON comparable)")"
printf 'machine       %s coeurs, %s Go de RAM, charge %s\n' \
  "$(nproc)" "$(free -g | awk '/^Mem:/{print $2}')" "$(cut -d' ' -f1-3 /proc/loadavg)"
printf 'go            local %s, outil_toolchain %s\n' "$(go version | awk '{print $3}')" "$toolchain"
printf 'node          %s\n' "$(node --version)"
printf 'outils        %s\n' "$(sed -n 's/^outil_\(staticcheck\|gosec\|govulncheck\|jscpd\): */\1 /p' fabrique.yml | tr '\n' ' ')"
printf 'cache outils  %s\n' "$( [ -d .revue-outils ] && du -sh .revue-outils 2>/dev/null | cut -f1 || echo 'absent (a froid)')"

# --- la mesure -----------------------------------------------------------------
mediane() {  # mediane <valeurs triees...>
  local -a v=("$@"); local n=${#v[@]}
  if [ $((n % 2)) -eq 1 ]; then printf '%s' "${v[$((n/2))]}"
  else awk -v a="${v[$((n/2-1))]}" -v b="${v[$((n/2))]}" 'BEGIN{printf "%.1f", (a+b)/2}'; fi
}

RESUME=()
for nom in "${CIBLES[@]}"; do
  IFS='|' read -r rep quoi cmd <<< "${SCENARIOS[$nom]}"
  echo; echo "── $nom  ($rep passage(s) — $quoi)"
  echo "   $cmd"
  duree=(); codes=()
  # Le premier passage est une PRECHAUFFE : il peuple le cache de pages du
  # disque et paie ce que les suivants ne paieront plus. Il est chronometre
  # pour etre montre, jamais compte. Un scenario a un seul passage n'en a pas :
  # il EST son premier passage, et le releve doit le dire.
  n_total=$rep; [ "$rep" -gt 1 ] && n_total=$((rep + 1))
  for i in $(seq 1 "$n_total"); do
    t0=$(date +%s%N)
    ( eval "$cmd" ) >/dev/null 2>&1; rc=$?
    t1=$(date +%s%N)
    s=$(awk -v d="$((t1 - t0))" 'BEGIN{printf "%.2f", d/1000000000}')
    if [ "$rep" -gt 1 ] && [ "$i" -eq 1 ]; then
      printf '   prechauffe  %8ss  (code %s, jetee)\n' "$s" "$rc"
    else
      printf '   passage %-2s  %8ss  (code %s)\n' "$i" "$s" "$rc"
      duree+=("$s"); codes+=("$rc")
    fi
  done

  mapfile -t tri < <(printf '%s\n' "${duree[@]}" | sort -g)
  min=${tri[0]}; max=${tri[-1]}; med=$(mediane "${tri[@]}")
  disp=$(awk -v a="$min" -v b="$max" -v m="$med" 'BEGIN{printf "%.0f", (m>0)?(b-a)*100/m:0}')
  verdict=""
  [ "$disp" -gt 20 ] && verdict="  ⚠ dispersion ${disp} % — releve INVALIDE, rejouer machine au repos"
  rcs=$(printf '%s\n' "${codes[@]}" | sort -u | tr '\n' ',' | sed 's/,$//')
  printf '   médiane %ss  [%s – %s]  dispersion %s %%  codes %s%s\n' "$med" "$min" "$max" "$disp" "$rcs" "$verdict"
  RESUME+=("$(printf '| %-14s | %2s | %8s | %8s | %8s | %3s %% | %s |' \
    "$nom" "${#duree[@]}" "$med" "$min" "$max" "$disp" "$rcs")")
done

echo
echo "=== a recopier dans docs/banc/releves.md ==="
echo "| scénario       |  n | médiane  |    min   |    max   | disp. | codes |"
echo "|----------------|---:|---------:|---------:|---------:|------:|-------|"
printf '%s\n' "${RESUME[@]}"
