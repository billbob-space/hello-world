#!/usr/bin/env bash
#
# test-init.sh — le contrat de test de init.sh LUI-MEME.
#
#   ./test-init.sh            lance tous les cas
#   ./test-init.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# init.sh est le verrou de tous les autres controles : la CI le lance avant de
# construire quoi que ce soit, et un « ok » errone de sa part laisse passer une
# faute dans les quatre applications a la fois. Il etait pourtant le seul
# programme du depot que rien ne testait.
#
# CE QUI EST TESTE, ET SEULEMENT CELA : que --check dise NON quand il doit. Les
# cas positifs (« il dit oui quand tout va bien ») tiennent en un seul, le
# temoin : sans lui, un init.sh qui refuserait TOUT ferait passer tous les
# autres cas au vert pour la pire des raisons.
#
# COMMENT : chaque cas travaille dans un BAC A SABLE — une copie conforme du
# depot, remise a neuf a chaque fois — puis y casse UNE chose et verifie que
# --check la nomme. La copie plutot qu'un depot minimal construit a la main :
# --check verifie le depot entier (workflow, .claude/, memory/, journal/, le
# sommaire du contrat), et un squelette partiel echouerait pour dix raisons
# etrangeres au cas teste. Le temoin garantit que la copie part bien au vert.
#
# Le bac est un depot git a part entiere : init.sh remonte a la racine par
# « git rev-parse », et plusieurs controles lisent « git ls-files ».

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0

# --- le bac a sable --------------------------------------------------------------
#
# Copie du depot SUIVI PAR GIT, et de lui seul : « git ls-files » ignore les
# artefacts de construction et les fichiers ignores, qui n'ont rien a faire la
# et pesent parfois plus que le depot. Le bac recoit ensuite son propre depot
# git, avec un commit : sans commit, « git ls-files » ne rend rien et les
# controles qui s'appuient dessus se croiraient dans un depot vide.

bac() {  # bac — cree un bac a sable neuf et en imprime le chemin
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  git -C "$d" init -q
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  printf '%s' "$d"
}

# --- un cas ----------------------------------------------------------------------
#
# refuse <nom> <motif attendu> <<< <mutation>
#
# La mutation est un fragment de shell lance DANS le bac. Le cas passe si
# --check sort en erreur ET si le motif apparait dans une ligne de REFUS : les
# deux, parce qu'un --check qui echouerait pour une raison etrangere au cas
# teste donnerait un faux vert sur le seul code de sortie.
#
# « ligne de refus », et non la sortie entiere : --check imprime « -- secrets »
# et « -- volumes » comme titres de section a CHAQUE execution, et un motif
# cherche dans toute la sortie les rencontrait donc toujours. Le cas « un secret
# dans la commande d'un service annexe » passait ainsi au vert alors que le scan
# de secrets etait entierement neutralise — decouvert en cassant le scan expres.
#
# Deux formes de refus, toutes deux retenues : une ligne « KO » de --check, et
# le « ERREUR : » d'un manifeste si invalide que la lecture s'arrete avant.

refuse() {  # refuse <nom> <motif attendu> — la mutation est lue sur l'entree standard
  local nom="$1" motif="$2" d sortie refus code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  bash -c "cd '$d' && $(cat)" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || code=$?
  refus=$(printf '%s\n' "$sortie" | grep -E 'KO|ERREUR' || true)
  if [ "$code" = 0 ]; then
    echec "$nom" "--check a repondu OUI (sortie 0) — la faute est passee"
  elif [ -z "$refus" ]; then
    echec "$nom" "--check est sorti en $code sans aucune ligne de refus"
  elif ! printf '%s\n' "$refus" | grep -qi -- "$motif"; then
    echec "$nom" "il a refuse, mais aucune ligne de refus ne nomme « $motif »"
    printf '%s\n' "$refus" | sed 's/^/      /' | head -3
  else
    reussi "$nom"
  fi
}

# genere <nom> <ligne attendue> — la mutation est un manifeste VALIDE ; on
# regenere et on verifie que compose.yaml porte la ligne attendue. Les cas
# « refuse » ne voient que ce que le script rejette ; celui-ci regarde ce qu'il
# ECRIT, ou vivent les fautes qu'aucun refus n'attrape parce que le resultat
# reste coherent avec lui-meme.
genere() {  # genere <nom> <ligne attendue>
  local nom="$1" attendu="$2" d code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  bash -c "cd '$d' && $(cat)" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  ( cd "$d" && ./init.sh >/dev/null 2>&1 ) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "la generation a echoue (sortie $code) sur un manifeste pourtant valide"
  elif ! grep -qF -- "$attendu" "$d/compose.yaml"; then
    echec "$nom" "compose.yaml ne porte pas « $attendu »"
    grep -A2 '^volumes:' "$d/compose.yaml" | sed 's/^/      /' | head -3
  else
    reussi "$nom"
  fi
}

# accepte <nom> — le temoin : le bac intact doit passer le contrat.
accepte() {  # accepte <nom>
  local nom="$1" d sortie code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || code=$?
  if [ "$code" = 0 ]; then
    reussi "$nom"
  else
    echec "$nom" "--check a refuse un depot intact (sortie $code)"
    printf '%s\n' "$sortie" | grep -E 'KO' | sed 's/^/      /' | head -10
  fi
}

reussi() { printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; REUSSIS=$((REUSSIS+1)); }
echec()  { printf '  %sKO%s    %s\n        %s%s%s\n' "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"
           ECHOUES=$((ECHOUES+1)); }

# --------------------------------------------------------------------------------

printf '\n-- temoin\n'

accepte "un depot intact passe le contrat"

printf '\n-- volumes\n'

# Le symptome serait « l'app demarre et perd tout » : Docker cree en root un
# repertoire hote absent, l'app tourne en non-root et ne peut pas y ecrire.
refuse "un bind mount est refuse" "bind mount" <<'FIN'
printf 'volumes:\n  - /srv/donnees:/data\n' >> apps/hello-world/app.yml
FIN

refuse "un volume sans chemin de montage est refuse" "chemin" <<'FIN'
printf 'volumes:\n  - donnees\n' >> apps/hello-world/app.yml
FIN

refuse "un chemin de montage relatif est refuse" "absolu" <<'FIN'
printf 'volumes:\n  - donnees:data\n' >> apps/hello-world/app.yml
FIN

# Le nom REEL du volume, celui qui existe sur l'hote, est « <app>-<nom> ». Il
# est documente comme tel dans memory/volumes.md, et la commande de sauvegarde
# qu'on y lit monte ce nom-la. Un nom reel different de celui qu'on documente ne
# casse rien au demarrage : docker cree le volume manquant, vide, et « tar »
# archive un repertoire vide EN SORTANT EN 0 — l'illusion parfaite d'une
# sauvegarde. D'ou un test sur le nom lui-meme, et pas seulement sur la
# coherence interne du compose, qui elle restait vraie.
genere "un volume d'app porte le nom <app>-<nom>" 'name: hello-world-donnees' <<'FIN'
printf 'volumes:\n  - donnees:/data\n' >> apps/hello-world/app.yml
FIN

# Regression precise : « --save "" » desactive la persistance sur disque de
# redis/valkey. C'est une chaine VIDE mais EXPLICITEMENT citee, dans une liste
# en ligne. Un parseur qui nettoie puis filtre les elements vides la perd EN
# SILENCE — deja arrive une fois, retrouve une seconde fois en deplacant ce
# lecteur dans lib/socle.sh sans reprendre son dernier correctif.
genere 'une chaine vide EXPLICITEMENT citee dans command: est preservee' \
       '"--save", ""]' <<'FIN'
printf 'services:\n  - name: cache\n    image: valkey/valkey:8-alpine\n    command: ["redis-server", "--save", ""]\n' >> apps/hello-world/app.yml
FIN

printf '\n-- secrets\n'

refuse "une valeur de secret en clair dans un app.yml est refusee" "secret" <<'FIN'
printf 'password: hunter2\n' >> apps/hello-world/app.yml
FIN

# Le controle ne connait aucun champ : il lit ce qui EST ECRIT. Un secret glisse
# dans la commande d'un service annexe doit donc etre vu comme les autres.
refuse "un secret dans la commande d'un service annexe est refuse" "secret" <<'FIN'
printf 'services:\n  - name: cache\n    image: valkey/valkey:8-alpine\n    command: ["redis-server", "--requirepass", "hunter2"]\n' >> apps/hello-world/app.yml
FIN

refuse "une valeur dans env: est refusee" "env" <<'FIN'
printf 'env:\n  - CLE=valeur\n' >> apps/hello-world/app.yml
FIN

printf '\n-- manifestes\n'

refuse "un palier d'exposition inconnu est refuse" "exposure" <<'FIN'
sed -i 's/^exposure: .*/exposure: ouvert-a-tous/' apps/hello-world/app.yml
FIN

refuse "un needs vers un service partage inexistant est refuse" "needs" <<'FIN'
printf 'needs:\n  - nexistepas\n' >> apps/hello-world/app.yml
FIN

refuse "un nom d'app qui n'est pas un label DNS est refuse" "nom" <<'FIN'
mkdir -p apps/Mon_App && cp apps/hello-world/app.yml apps/Mon_App/app.yml
FIN

printf '\n-- artefacts derives\n'

# Le cas le plus courant : on edite un app.yml et on oublie de relancer init.sh.
# Sans ce controle, le compose committe cesse de decrire les manifestes.
refuse "un compose desynchronise des manifestes est refuse" "desynchronise" <<'FIN'
sed -i 's/^memory: .*/memory: 256m/' apps/hello-world/app.yml
FIN

refuse "un compose absent est refuse" "compose" <<'FIN'
rm -f compose.yaml
FIN

printf '\n-- documents\n'

refuse "un lien mort entre documents est refuse" "lien mort" <<'FIN'
printf '\nVoir [le neant](memory/nexistepas.md).\n' >> README.md
FIN

refuse "un fichier de memory/ absent du sommaire est refuse" "sommaire" <<'FIN'
printf 'Quand lire : jamais.\nTenu par : --check\n\n# Sujet\n' > memory/orphelin.md
FIN

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
