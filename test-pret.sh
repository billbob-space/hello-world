#!/usr/bin/env bash
#
# test-pret.sh — le contrat de test du garde-fou « le PRD suit-il ? ».
#
#   ./test-pret.sh            lance tous les cas
#   ./test-pret.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Ce garde-fou est le seul de la fabrique a reposer sur une HEURISTIQUE : il
# deduit « une capacite neuve est arrivee » de « un fichier de code neuf est
# arrive ». Une heuristique ne se relit pas — elle se mesure sur des cas. Deux
# facons de la perdre en silence, et aucune ne se voit dans le diff :
#
#   - trop bavarde : elle se declenche sur les corrections, on l'ignore, elle
#     ne garde plus rien. Quatre des sept changements du 7 aout sur
#     marcq-handball sont des corrections ; aucun ne doit la declencher ;
#   - muette : un motif d'exclusion trop large — « tests? » attrapant aussi
#     « web/ » un jour de refactoring — et elle laisse passer exactement ce
#     qu'elle surveille, sans que la sortie ne change d'un caractere.
#
# COMMENT : chaque cas monte un bac a sable, y pose la situation exacte a
# juger, lance pret.sh EN ENTIER et regarde si la ligne d'avertissement sort.
# pret.sh y echoue par ailleurs — pas de journal, contrat rouge — et c'est sans
# importance : on n'observe que cette ligne, jamais son code de sortie. Le
# lancer en entier plutot que d'extraire la fonction est delibere : c'est le
# chemin reel, celui ou une variable renommee ailleurs casserait le garde-fou.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0
BRANCHE=claude/test-pret
APP=bidon

reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# --- le bac a sable --------------------------------------------------------------
#
# Copie du depot suivi par git, comme dans test-cout.sh, plus une app FACTICE
# deja livree — un app.yml pour que pret.sh la voie, un PRODUCT.md pour qu'elle
# ait un PRD a laisser en arriere, un fichier de code deja la pour distinguer
# « modifie » de « neuf ».
#
# origin/main est pose a la main sur le commit de base. Sans lui, « git diff
# origin/main...HEAD » echoue en silence et le bac ne testerait plus que la
# moitie non committee du garde-fou — celle que git status rapporte.

bac() {  # bac — cree un bac a sable neuf et en imprime le chemin
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  mkdir -p "$d/apps/$APP/web"
  printf 'port: 8080\nenabled: false\n'          > "$d/apps/$APP/app.yml"
  printf '# Product — %s\n\nUne app de test.\n' "$APP" > "$d/apps/$APP/PRODUCT.md"
  printf 'export const deja = 1\n'               > "$d/apps/$APP/web/deja.js"
  printf '#!/bin/sh\nexit 0\n'                   > "$d/apps/$APP/test.sh"
  chmod +x "$d/apps/$APP/test.sh"
  # Une DOUBLURE d'init.sh, et le fichier le plus lent de la suite passe de
  # 2 min 13 a une vingtaine de secondes. Ce que pret.sh fait du verdict de
  # --check ne participe a AUCUNE assertion d'ici — l'en-tete le dit deja plus
  # haut, « on n'observe que cette ligne, jamais son code de sortie » — et le
  # payer dix fois coutait 209 s sur 210. Un vrai --check dure 21 s ; les dix
  # cas n'en tiraient rien.
  #
  # La doublure rejoue le CONTRAT DE PROCESSUS plutot que de rendre 0
  # aveuglement : elle ecrit un KO sur sa sortie et sort en 1, exactement comme
  # le vrai --check dans un bac neuf. La branche rouge de pret.sh — le bad, puis
  # le grep -E 'KO' qui en extrait les lignes — reste donc exercee dix fois.
  #
  # Posee AVANT le commit de base, jamais apres : ecrite ensuite, elle
  # apparaitrait dans « git status », matcherait le motif init\.sh$ de pret.sh
  # et ferait taire a tort l'avertissement « action garde-fou sans suite ». Les
  # deux derniers cas du fichier reposent sur ce point precis.
  case "${CHECK:-rouge}" in
    reel)  : ;;  # le vrai binaire, pour garder un cas sur le chemin reel
    vert)  doublure_check "$d" ok 0 ;;
    rouge) doublure_check "$d" KO 1 ;;
    # Une valeur inconnue tombait dans la branche par defaut et rendait un bac
    # rouge : le cas devenu muet aurait passe pour un cas qui passe.
    *) printf 'test-pret.sh : CHECK inconnu « %s »\n' "${CHECK:-}" >&2; exit 1 ;;
  esac
  git -C "$d" init -q -b main
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  git -C "$d" update-ref refs/remotes/origin/main main
  git -C "$d" checkout -q -b "$BRANCHE"
  printf '%s' "$d"
}

# doublure_check <bac> <verdict> <code> — pose le faux ./init.sh dont bac()
# vient de parler : une ligne de verdict sur sa sortie, puis ce code de retour.
# Il ne reagit qu'a --check et laisse passer tout autre usage en silence, comme
# le vrai.
doublure_check() {
  printf '#!/bin/sh\n[ "$1" = --check ] || exit 0\necho "  %s    doublure"\nexit %s\n' \
    "$2" "$3" > "$1/init.sh"
  chmod +x "$1/init.sh"
}

# cas <nom> <attendu: avertit|silence> <committe: oui|non> — la situation est
# posee par le fragment de shell lu sur l'entree standard, execute a la racine
# du bac. Il est lu AVANT le bac : le filtre par motif ne doit pas laisser un
# heredoc non consomme derriere lui.
cas() {
  local nom="$1" attendu="$2" committe="$3" situation d sortie vu
  situation=$(cat)
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  ( cd "$d" && bash -euo pipefail -c "$situation" )
  if [ "$committe" = oui ]; then
    git -C "$d" add -A
    git -C "$d" -c user.email=test@local -c user.name=test commit -qm etape
  fi
  sortie=$( cd "$d" && ./scripts/pret.sh 2>&1 ) || true
  vu=silence
  grep -q "\[$APP\] du code neuf" <<< "$sortie" && vu=avertit
  if [ "$vu" = "$attendu" ]; then
    reussi "$nom"
  else
    echec "$nom" "attendu : $attendu — obtenu : $vu"
  fi
}

printf '\n-- ce qui doit avertir\n'

# CHECK=reel : ce cas-ci, et lui seul, lance le VRAI ./init.sh --check. Il coute
# les 21 s que les neuf autres ne paient plus, et les rachete : sans lui, plus
# rien n'exercerait le chemin ou pret.sh fork le vrai verificateur, survit a son
# code non nul sous set -e, et en extrait les lignes KO.
CHECK=reel \
cas "code neuf, PRODUCT.md immobile" avertit non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

cas "code neuf deja committe sur la branche" avertit oui <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

# Le cas qui distingue ce garde-fou d'un rappel poli : la capacite neuve arrive
# AVEC son test, comme le veut le contrat. Si le fichier de test suffisait a
# eteindre l'avertissement, il ne se declencherait jamais sur du travail bien
# fait — c'est-a-dire jamais.
cas "code neuf accompagne de son test" avertit non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
  mkdir -p "apps/bidon/tests"
  printf 'test("chrono", () => {})\n' > "apps/bidon/tests/chrono.test.js"
FIN

printf '\n-- ce qui doit se taire\n'

cas "code neuf, PRODUCT.md touche" silence non <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
  printf '\nLe minuteur.\n' >> "apps/bidon/PRODUCT.md"
FIN

cas "fichier existant modifie" silence non <<'FIN'
  printf 'export const deja = 2\n' > "apps/bidon/web/deja.js"
FIN

cas "test Go neuf a cote de son code, sur un correctif" silence non <<'FIN'
  printf 'package bidon\n' > "apps/bidon/domaine_test.go"
FIN

cas "suite bout en bout neuve, sans PRODUCT.md" silence non <<'FIN'
  mkdir -p "apps/bidon/e2e/tests"
  printf '#!/usr/bin/env bash\n' > "apps/bidon/e2e/lancer.sh"
  printf 'module.exports = {}\n'  > "apps/bidon/e2e/playwright.config.js"
  printf 'test("x", () => {})\n'  > "apps/bidon/e2e/tests/bidon.spec.js"
FIN

cas "test neuf seul, sur un correctif" silence non <<'FIN'
  printf 'export const deja = 2\n' > "apps/bidon/web/deja.js"
  mkdir -p "apps/bidon/tests"
  printf 'test("deja", () => {})\n' > "apps/bidon/tests/deja.test.js"
FIN

cas "document neuf seul" silence non <<'FIN'
  printf '# Notes\n' > "apps/bidon/NOTES.md"
FIN

# Une app SANS PRODUCT.md n'a pas de PRD a laisser en arriere : lui reprocher de
# ne pas le mettre a jour serait un avertissement qu'aucun geste n'eteint.
cas "app sans PRODUCT.md" silence non <<'FIN'
  rm -f "apps/bidon/PRODUCT.md"
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

printf '\n-- les promesses du journal\n'

# Une Action « garde-fou » ou « contrat » promet un changement de la surface
# partagee. 96 promesses ecrites dans le journal, 11 commits qui touchent ces
# fichiers : le journal enregistrait sans que rien ne suive. Ces deux cas
# tiennent le rapprochement — et le second existe parce que CLAUDE.md doit
# compter dans la liste, faute de quoi le garde-fou avertirait a tort.
cas_promesse() {  # <nom> <attendu: avertit|silence> — la situation est lue sur l'entree standard
  local nom="$1" attendu="$2" situation d sortie vu
  situation=$(cat)
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  mkdir -p "$d/journal"
  cat > "$d/journal/2026-01-01-claude-test-pret.md" <<'ENTREE'
# 2026-01-01 — claude/test-pret

Branche : `claude/test-pret`
Périmètre : bidon
Mode : `chaud`

## Anomalies

### 1. Une anomalie qui promet un garde-fou

**Symptome** — peu importe.

**Cause** — peu importe.

**Detecte par** — `test`

**Action** — `garde-fou` — le geste promis.
ENTREE
  ( cd "$d" && bash -euo pipefail -c "$situation" )
  sortie=$( cd "$d" && ./scripts/pret.sh 2>&1 ) || true
  vu=silence
  grep -q "action(s) garde-fou/contrat sans suite" <<< "$sortie" && vu=avertit
  if [ "$vu" = "$attendu" ]; then
    reussi "$nom"
  else
    echec "$nom" "attendu : $attendu — obtenu : $vu"
    printf '%s\n' "$sortie" | grep -E "journal" | sed 's/^/      /' | head -3 || true
  fi
}

cas_promesse "une action garde-fou sans rien sous la surface partagee avertit" avertit <<'FIN'
  printf 'export const chrono = 1\n' > "apps/bidon/web/chrono.js"
FIN

cas_promesse "CLAUDE.md compte comme surface partagee, et fait taire l'avertissement" silence <<'FIN'
  printf '\nUne ligne de plus.\n' >> CLAUDE.md
FIN

# --- ce que pret.sh fait du verdict du contrat ---------------------------------
#
# Personne ne testait ces deux lignes-la. Dans un bac neuf le vrai --check echoue
# TOUJOURS — compose.yaml desynchronise, CLAUDE.md de l'app factice absent — si
# bien que la branche verte de pret.sh, le « ok contrat respecte », n'avait
# jamais ete exercee par cette suite. La doublure, elle, sait rendre 0 : c'est
# ce qui rend ces deux cas possibles, et c'est la seconde raison de l'avoir.
printf '\n-- le verdict du contrat\n'

verdict() {  # verdict <nom> <doublure : vert|rouge> <motif attendu>
  local nom=$1 doublure=$2 motif=$3 d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(CHECK="$doublure" bac)
  printf 'export const chrono = 1\n' > "$d/apps/$APP/web/chrono.js"
  sortie=$( cd "$d" && ./scripts/pret.sh 2>&1 ) || true
  if grep -q "$motif" <<< "$sortie"; then
    reussi "$nom"
  else
    echec "$nom" "attendu la ligne : $motif"
  fi
}

verdict "contrat vert : pret.sh l'annonce" vert "contrat respecte"
verdict "contrat rouge : pret.sh le dit et cite le KO" rouge "doublure"

# --- l'entree de journal d'un nom de branche reutilise ----------------------------
#
# Le harnais cloud reassigne le meme nom `claude/<sujet>` au travail suivant des
# que la pull request precedente est fusionnee. L'entree etant indexee par le NOM
# de la branche, le second travail heritait de celle du premier : `journal_ouvre`
# la declarait « existante », `pret.sh` la trouvait remplie — et le second
# travail n'avait aucune entree, silencieusement, sous le perimetre du premier.
#
# La distinction se fait sur l'HISTORIQUE : une entree presente sur la base
# decrit une branche terminee. Le bac de ce fichier pose deja
# `refs/remotes/origin/main`, ce qui rend le cas exercable ici.
printf '\n-- le journal d un nom de branche reutilise\n'

# <motif attendu> est un GLOB, pas un chemin : l'entree neuve porte la date du
# JOUR — c'est un travail neuf — et figer cette date rendrait le cas rouge a
# minuit sans qu'aucun code n'ait bouge.
# <fusionnee> vaut « aucune » quand le bac ne porte PAS d'entree : c'est la
# premiere entree d'un nom de branche, le cas frequent — et le seul qui manquait.
journal_cas() {  # journal_cas <nom> <fusionnee: oui|non|aucune> <glob attendu>
  local nom="$1" fusionnee="$2" attendu="$3" d f sortie trouve code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  f="journal/2026-01-01-claude-test-pret.md"
  [ "$fusionnee" = aucune ] || ( cd "$d" && mkdir -p journal && cat > "$f" <<'ENTREE'
# 2026-01-01 — claude/test-pret

Branche : `claude/test-pret`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.
ENTREE
  )
  # « fusionnee » veut dire : l'entree vit sur la base. On la committe sur main
  # puis on revient sur la branche de travail — c'est exactement l'etat que
  # laisse une pull request fusionnee dont le harnais reassigne le nom.
  if [ "$fusionnee" = oui ]; then
    git -C "$d" checkout -q main
    git -C "$d" add -A
    git -C "$d" -c user.email=test@local -c user.name=test commit -qm journal
    git -C "$d" update-ref refs/remotes/origin/main main
    git -C "$d" checkout -q "$BRANCHE"
    ( cd "$d" && git checkout -q main -- "$f" )
  fi
  # SOUS set -e, et le code de sortie compte autant que le chemin rendu : une
  # fonction qui rend le bon chemin puis meurt laisserait les trois cas verts.
  # C'est exactement l'angle mort qui a laisse vivre un jour entier un
  # journal_ouvre tue par set -e avant de creer le fichier. Le guard « || » est
  # obligatoire — ce fichier tourne en set -euo pipefail, et une affectation nue
  # emporterait la suite au lieu de rapporter l'echec.
  sortie=$( cd "$d" && bash -c 'set -e; . lib/socle.sh; . lib/journal.sh; journal_ouvre claude/test-pret main' 2>&1 ) || code=$?
  trouve=$( cd "$d" && ls $attendu 2>/dev/null | head -1 )
  if [ "$code" != 0 ]; then
    echec "$nom" "journal_ouvre sort en $code : $(printf '%s' "$sortie" | tr -d '\033' | tr '\n' ' ')"
  elif [ -n "$trouve" ] && grep -qF "$trouve" <<< "$sortie"; then
    reussi "$nom"
  else
    echec "$nom" "attendu $attendu — obtenu : $(printf '%s' "$sortie" | tr -d '\033' | tr '\n' ' ')"
  fi
}

journal_cas "une entree deja fusionnee fait ouvrir la suivante" oui \
  "journal/*-claude-test-pret--2.md"
# Le cas NEGATIF, et c'est lui qui compte : sans lui, un journal_ouvre qui
# ouvrirait une entree neuve A CHAQUE APPEL passerait le cas ci-dessus au vert.
journal_cas "une entree en cours de travail est reprise, jamais dupliquee" non \
  "journal/2026-01-01-claude-test-pret.md"

# La PREMIERE entree d'un nom de branche — le cas frequent, et le seul qui
# manquait. Il a ete casse un jour entier sans qu'aucun cas ne rougisse : le
# suffixe « --2 » etait calcule dans l'affectation du chemin, qui heritait donc
# du code de sortie du test « rang > 1 » ; faux au rang 1, il faisait sortir
# l'affectation non nulle et set -e tuait branche.sh avant la creation du
# fichier. Le glob porte la date du JOUR, comme le cas « --2 ».
journal_cas "aucune entree : la premiere est creee, et sous set -e" aucune \
  "journal/*-claude-test-pret.md"

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
