#!/usr/bin/env bash
#
# test-jetons.sh — le contrat de test de scripts/jetons.sh.
#
#   ./test-jetons.sh            lance tous les cas
#   ./test-jetons.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Meme raison d'etre que test-cout.sh : le script rend des nombres a sept
# chiffres, et un nombre faux ressemble trait pour trait a un nombre juste. La
# difference est la source — cout.sh lit les conversations du conteneur, celui-ci
# lit ce que cout.sh a fige dans le journal. Le journal factice ci-dessous a ses
# totaux calcules a la main, en commentaire, et c'est tout l'interet du bac.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0

reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# --- le bac a sable --------------------------------------------------------------
#
# Le depot suivi par git, dont journal/ est remplace par deux entrees factices.
#
# Entree A — deux tours, claude-opus-5 (entree 5 $, sortie 25 $ le million) :
#   ecriture 100 000 x 5 x 1,25 / 1e6 = 0,625 $
#   lecture  400 000 x 5 x 0,10 / 1e6 = 0,200 $
#   sortie     2 000 x 25       / 1e6 = 0,050 $
#   total 0,875 $ pour 502 000 jetons ; la lecture y fait 22,9 %, donc 23 %.
#   Le second tour sort 150 jetons : un tour court sur les deux.
#   L'amorce est l'ecriture du premier tour, 100 000, relue une fois :
#   100 000 x 5 x 0,10 / 1e6 = 0,05 $.
# Entree B — un total, sans detail : comptee dans le total du depot, jamais dans
#   les postes. C'est le cas des huit premieres entrees reelles, et le script
#   doit le DIRE plutot que de rendre un chiffre partiel qui a l'air complet.
#   Elle PARLE aussi du marqueur de detail, et porte juste apres une ligne de six
#   champs. C'est le cas reel qui a fait tomber la premiere version : un motif non
#   ancre ouvrait le bloc sur la phrase, et trois cents lignes de prose entraient
#   dans le compte. Les totaux ci-dessus ne doivent pas bouger d'un jeton.
bac() {
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  rm -f "$d"/journal/*.md
  cat > "$d/journal/2026-01-01-fabrique-a.md" <<'FIN'
# 2026-01-01 — fabrique/a

Branche : `fabrique/a`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
<!-- cout-total: 502000 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 100000 0 1850
2 principal claude-opus-5 0 400000 150
-->
<!-- /cout -->
FIN
  cat > "$d/journal/2026-01-02-fabrique-b.md" <<'FIN'
# 2026-01-02 — fabrique/b

Branche : `fabrique/b`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.

Le detail par tour (`<!-- cout-detail -->`) manque a cette entree, et la ligne
qui suit ressemble a un tour sans en etre un :
1 principal claude-opus-5 999999 999999 999999

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
<!-- cout-total: 1000000 -->
<!-- /cout -->
FIN
  git -C "$d" init -q -b main
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  printf '%s' "$d"
}

# porte <nom> <ancre> <motif> — la LIGNE qui porte <ancre> doit porter <motif>.
#
# L'ancre n'est pas une precaution de style, c'est ce qui fait la difference
# entre un test et un test qui a l'air d'en etre un. Cherche « 502 000 » dans
# toute la sortie et l'assertion passe tant que ce nombre subsiste QUELQUE PART :
# mesure, en empechant le total general d'accumuler, la ligne TOTAL est tombee a
# 402 000 et les neuf cas sont restes verts, parce que le meme 502 000 figure
# aussi sur la ligne « par branche », calculee par un autre compteur. Un nombre
# juste ailleurs masquait un nombre faux ici.
#
# Meme piege sur les pourcentages : « 23 % » apparait sur la lecture de cache ET
# sur les tours courts, deux postes sans rapport qui valent le meme chiffre dans
# ce bac. Sans ancre, chacun des deux cas se satisfaisait de la ligne de l'autre.
porte() {
  local nom="$1" ancre="$2" motif="$3" d sortie ligne
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=${BAC:-$(bac)}
  sortie=$( cd "$d" && ./scripts/jetons.sh 2>&1 ) || {
    echec "$nom" "jetons.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  ligne=$(printf '%s\n' "$sortie" | grep -F -- "$ancre" | head -1)
  if [ -z "$ligne" ]; then
    echec "$nom" "aucune ligne ne porte l'ancre « $ancre »"
  elif printf '%s\n' "$ligne" | grep -qF -- "$motif"; then
    reussi "$nom"
  else
    echec "$nom" "la ligne « $ancre » ne porte pas « $motif » :$(printf '\n      %s' "$ligne")"
  fi
}

# Le bac de ce fichier est IMMUABLE — bac() ne prend aucun argument et rend le
# meme arbre a chaque appel — et jetons.sh ne fait que le lire. Les neuf cas le
# reconstruisaient neuf fois pour rien.
BAC=$(bac)

printf '\n-- les chiffres\n'

porte "le total en jetons des entrees detaillees" "TOTAL"             "502 000 jetons detailles"
porte "le cout total"                             "TOTAL"             "0,88 $"
porte "le compte de tours du total"               "TOTAL"             "sur 2 tour(s)"
porte "la part de la lecture de cache"            "lecture de cache"  "23 %"
porte "la part de l ecriture de cache"            "ecriture de cache" "71 %"
porte "le cout de la lecture de cache"            "lecture de cache"  "0,20 $"
porte "le cout de l ecriture de cache"            "ecriture de cache" "0,62 $"
porte "l amorce relue"                            "amorce relue"      "0,05 $"

# La ligne « par branche » est calculee par un compteur DIFFERENT de celui du
# total, et c'est pour cela qu'elle merite ses propres cas : c'est elle qui,
# faute d'ancre, masquait les fautes du total.
porte "le nombre de tours de la branche"          "fabrique-a"        "2 tours"
porte "les jetons de la branche"                  "fabrique-a"        "502 000 jetons"
porte "le cout de la branche"                     "fabrique-a"        "0,88 $"

printf '\n-- ce qui manque\n'

porte "les tours courts"                          "tours courts"      "1 des 2"
porte "l entree sans detail est comptee a part"   "sans detail"       "1 entree(s) sans detail"
porte "le total du depot, detail ou non"          "total du depot"    "1 502 000"
porte "une phrase qui cite le marqueur n ouvre pas le bloc" "TOTAL"   "sur 2 tour(s)"

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
