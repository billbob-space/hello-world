#!/usr/bin/env bash
#
# test-cout.sh — le contrat de test de scripts/cout.sh.
#
#   ./test-cout.sh            lance tous les cas
#   ./test-cout.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Le releve de cout est le seul programme du depot dont PERSONNE ne peut
# verifier le resultat a l'oeil : il rend un nombre a sept chiffres, et un
# nombre faux ressemble trait pour trait a un nombre juste. C'est exactement la
# forme d'erreur qu'un test attrape et qu'aucune relecture n'attrape — le
# sur-comptage d'un facteur deux a vecu huit entrees de journal sans se voir.
#
# COMMENT : chaque cas ecrit une conversation FACTICE dont on connait le total
# a la main, la depose la ou cout.sh la cherchera, puis compare le total releve
# a celui qu'on attend. La conversation factice plutot qu'une vraie : une vraie
# conversation ne se replique pas, et son total change a chaque tour.
#
# Le bac est un depot git a part entiere, comme dans test-init.sh : cout.sh
# remonte a la racine par « git rev-parse » et lit la branche courante.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0
BRANCHE=claude/test-cout

reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# --- le bac a sable --------------------------------------------------------------
#
# Copie du depot suivi par git, puis une branche de travail : sur la base,
# cout.sh n'a pas d'entree de journal ou ecrire et se contente d'afficher.

bac() {  # bac — cree un bac a sable neuf et en imprime le chemin
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  git -C "$d" init -q -b main
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  git -C "$d" checkout -q -b "$BRANCHE"
  printf '%s' "$d"
}

# conversation <bac> <fichier> — lit des lignes « requete » sur l'entree standard
# et ecrit le .jsonl correspondant la ou cout.sh ira le chercher : sous
# $HOME/.claude/projects/<chemin-du-bac-aplati>. Le HOME est detourne vers le
# bac, donc chaque cas est isole du vrai poste.
#
#   requete <id> <branche> <sidechain 0|1> <modele> <entree> <ecriture> <lecture> <sortie> [lignes]
#
# « lignes » est le nombre de fois que la MEME requete est ecrite dans le
# fichier, ce que fait le harnais reel : une ligne par bloc de la reponse — la
# reflexion, le texte, chaque appel d'outil — et chacune reporte la facture
# entiere. Une requete facturee une fois peut donc apparaitre cinq fois.
requete() {
  local id="$1" br="$2" side="$3" modele="$4" e="$5" ce="$6" cl="$7" s="$8" n="${9:-1}" i
  local vrai=false; [ "$side" = 1 ] && vrai=true
  for ((i = 0; i < n; i++)); do
    printf '{"parentUuid":null,"isSidechain":%s,"message":{"id":"msg_%s","type":"message","role":"assistant","model":"%s","content":[{"type":"text","text":"x"}],"usage":{"input_tokens":%s,"cache_creation_input_tokens":%s,"cache_read_input_tokens":%s,"output_tokens":%s}},"requestId":"%s","type":"assistant","timestamp":"2026-08-05T10:00:0%sZ","gitBranch":"%s"}\n' \
      "$vrai" "$id" "$modele" "$e" "$ce" "$cl" "$s" "$id" "$((i % 10))" "$br"
  done
}

pose() {  # pose <bac> — lit le .jsonl sur l'entree standard et le depose
  local d="$1" p
  p="$d/home/.claude/projects/$(printf '%s' "$d" | sed 's/[^A-Za-z0-9]/-/g')"
  mkdir -p "$p"
  cat > "$p/session.jsonl"
}

releve() {  # releve <bac> — lance cout.sh en HOME detourne, rend sa sortie
  ( cd "$1" && HOME="$1/home" ./scripts/cout.sh --dry-run 2>&1 )
}

# --- un cas ----------------------------------------------------------------------
#
# total <nom> <attendu> — la conversation est lue sur l'entree standard. On
# compare au marqueur « cout-total », ecrit en chiffres bruts : le tableau, lui,
# separe les milliers pour l'oeil et ne se compare pas.
total() {
  local nom="$1" attendu="$2" d sortie vu
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  vu=$(printf '%s\n' "$sortie" | grep -o 'cout-total: [0-9]*' | head -1 | tr -dc '0-9')
  if [ -z "$vu" ]; then
    echec "$nom" "aucun total dans la sortie"
  elif [ "$vu" != "$attendu" ]; then
    echec "$nom" "total $vu, attendu $attendu"
  else
    reussi "$nom"
  fi
}

# porte <nom> <motif> — la sortie doit contenir <motif>. Pour ce que le releve
# DIT et qui ne se resume pas a un total : la part des sous-agents, le poids du
# demarrage, le nombre d'echanges.
porte() {
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if printf '%s\n' "$sortie" | grep -qF -- "$motif"; then
    reussi "$nom"
  else
    echec "$nom" "la sortie ne porte pas « $motif »"
  fi
}

# --------------------------------------------------------------------------------

printf '\n-- le compte\n'

# Le temoin : sans lui, un cout.sh qui rendrait zero partout ferait passer au
# vert tous les cas qui verifient qu'on ne compte PAS quelque chose.
total "une requete unique est comptee entiere" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
FIN

# Le bug fondateur de ce fichier. Le harnais ecrit une ligne par bloc de la
# reponse et recopie la facture sur chacune ; les additionner facture la meme
# requete deux a trois fois selon le nombre d'outils appeles. Huit entrees de
# journal ont ete relevees ainsi.
total "la meme requete ecrite sur trois lignes n'est comptee qu'une fois" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 3)
FIN

total "deux requetes distinctes s'additionnent" 2230 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 2)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 3)
FIN

printf '\n-- l attribution\n'

# Deux branches travaillees dans le meme conteneur : le releve de la seconde
# additionnait la premiere. C'est ce qui a produit « ardoise » et « compteur »
# a deux minutes d'ecart, avec 275 et 282 millions de jetons — le meme travail,
# compte deux fois, dans deux entrees de journal differentes.
total "le travail d'une autre branche n'entre pas dans le total" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 fabrique/autre-sujet 0 claude-opus-5 10 100 1000 5)
FIN

porte "ce qui appartient a une autre branche est dit, pas tu" "1 autre(s) branche(s)" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 fabrique/autre-sujet 0 claude-opus-5 10 100 1000 5)
FIN

# Un sous-agent consomme sur la branche courante : il compte dans le total. Mais
# il se distingue, sans quoi « lancer un agent » reste un geste dont personne ne
# connait le prix.
total "un sous-agent compte dans le total de la branche" 2230 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)
FIN

porte "la part des sous-agents est chiffree" "sous-agents" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)
FIN

printf '\n-- ce qui coute\n'

# Le demarrage — contrat, outillage, definitions d'outils — est ecrit en cache
# au premier echange puis RELU a chaque echange suivant. Mesure sur une session
# reelle : 80 % de toute la relecture. C'est le premier levier d'optimisation du
# depot, et rien ne le montrait.
porte "le poids du demarrage est chiffre" "Démarrage" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
$(requete req_3 "$BRANCHE" 0 claude-opus-5 10 100 5100 5)
FIN

porte "le nombre d'appels au modele est dit" "3 appel" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
$(requete req_3 "$BRANCHE" 0 claude-opus-5 10 100 5100 5)
FIN

# Le detail echange par echange survit dans l'entree de journal : le fichier de
# conversation meurt avec le conteneur, et sans lui aucune analyse n'est
# refaisable — ni avec d'autres tarifs, ni sous un autre angle.
porte "le detail echange par echange est conserve" "cout-detail" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
FIN

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
