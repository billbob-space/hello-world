#!/usr/bin/env bash
#
# init.sh — la fabrique : plusieurs applications, une seule stack dockhand
#
#   ./init.sh                 regenere les artefacts derives depuis apps/*/app.yml
#   ./init.sh --check         verifie le depot, service par service
#   ./init.sh --add NOM       echafaude apps/NOM/ (ni Dockerfile ni code)
#   ./init.sh --app NOM ...   applique les options ci-dessous a cette app
#   ./init.sh --list          etat des applications de la fabrique
#   ./init.sh --dry-run       n'ecrit rien, affiche le diff de chaque artefact
#   ./init.sh --branche NOM   cree la branche de travail, et son entree de journal
#   ./init.sh --pret          verifie que l'etape en cours est committable
#   ./init.sh --cout          releve les jetons consommes et leur cout, dans le journal
#
# Options — elles ne valent que pour l'app ciblee par --add ou --app :
#
#   --port N            port d'ecoute dans le conteneur      (defaut 8080)
#   --memory X          limite memoire du conteneur          (defaut 128m)
#   --health CHEMIN     chemin HTTP de sante                 (defaut /healthz)
#   --health-cmd CMD    commande de healthcheck, ou "none"   (defaut : wget)
#   --exposure T        private | google | public            (defaut private)
#   --stack S           langage principal, active son LSP    (defaut none)
#   --ui / --no-ui      l'app sert une interface web         (defaut no)
#   --enable / --disable  presente dans le compose, ou non   (defaut : enable)
#
# Quatre sections OPTIONNELLES, editees a la main dans apps/NOM/app.yml — elles
# n'ont pas d'equivalent en ligne de commande, et une app qui n'en porte aucune
# produit exactement le meme bloc compose qu'avant leur existence :
#
#   volumes:   VOLUMES NOMMES Docker : « <nom>:<chemin conteneur>[:ro] ». <nom>
#              est le nom LOGIQUE du volume, jamais un chemin ni un
#              sous-repertoire ; le volume reel s'appelle <proprietaire>-<nom>
#              et « docker compose up » le cree seul. Les bind mounts ne sont
#              pas supportes : Docker creerait en ROOT un repertoire hote
#              absent, l'app tourne en non-root, et le symptome serait « elle
#              demarre et perd tout ». Un volume vide, lui, recoit une copie du
#              repertoire tel qu'il est dans l'IMAGE — c'est le Dockerfile qui
#              fixe le proprietaire, et l'hote n'a rien a preparer.
#   env:       NOMS des variables a passer depuis l'hote — jamais de valeurs.
#              Un element contenant un « = » est refuse : le depot est public.
#   needs:     services partages de fabrique.yml dont l'app depend. Un nom non
#              declare la-bas est une erreur de generation, pas une panne au
#              demarrage. Emet un depends_on sur le service principal.
#   services:  services annexes propres a l'app — « name », « image », et au
#              choix « memory », « command », « volumes », « env ».
#
# fabrique.yml gagne de son cote une cle : shared_services (services partages
# par plusieurs applications : un Redis commun, un Directus). Elle porte les
# memes sections volumes: et env: qu'une app.
#
# LES SECRETS N'ONT QU'UNE PORTE, ET ELLE REGARDE LE RESULTAT. Avant d'ecrire
# quoi que ce soit, et de nouveau dans --check, init.sh scanne fabrique.yml, les
# apps/*/app.yml et le compose qu'il vient de produire : une cle qui evoque un
# secret suivie d'une valeur litterale arrete tout, en nommant le fichier et la
# ligne sans reimprimer la valeur. Aucun champ n'est privilegie — command:,
# health_cmd, « sh -c » et la porte que quelqu'un ouvrira demain passent par le
# meme controle. Restent admis : « ${NOM} », dont la valeur est injectee par
# l'infrastructure, et un CHEMIN vers un secret monte en fichier.
#
# Le compose genere porte donc TROIS sortes de services, et une seule est
# routee : <app> (labels de routage, authentification, priority=100),
# <app>-<nom> (annexe prive) et <nom> (partage). Les deux dernieres ne portent
# qu'un seul label, « traefik.enable=false » — et c'est bien un label qu'il leur
# faut, pas son absence : avec exposedByDefault, le defaut de Traefik, un
# conteneur sans le moindre label recoit quand meme un routeur, donc une URL, et
# sans authentification.
#
# Les artefacts derives — compose.yaml, le workflow, .claude/, go.work — sont
# TOUJOURS reecrits : c'est ce qui garantit qu'une app ajoutee ne peut pas etre
# absente du deploiement. En revanche apps/NOM/app.yml n'est JAMAIS reecrit ;
# il est la source de verite, edite a la main ou par --app. Il en va de meme des
# entrees de journal/ : echafaudees une fois, ecrites a la main ensuite.
#
# Le script ne genere NI Dockerfile NI code applicatif : le choix de la
# technologie appartient a l'agent. Voir CLAUDE.md.

set -euo pipefail

CHECK=0 ADD="" TARGET="" LIST=0 DRYRUN=0 FORCE=0 BRANCHE="" PRET=0 FUSIONNEES=0 COUT=0
declare -A SET=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)       CHECK=1 ;;
    --list)        LIST=1 ;;
    --dry-run)     DRYRUN=1 ;;
    --force)       FORCE=1 ;;
    --branche)     BRANCHE="$2"; shift ;;
    --pret)        PRET=1 ;;
    --cout)        COUT=1 ;;
    --branches-fusionnees) FUSIONNEES=1 ;;
    --add)         ADD="$2"; TARGET="$2"; shift ;;
    --app)         TARGET="$2"; shift ;;
    --port)        SET[port]="$2";        shift ;;
    --memory)      SET[memory]="$2";      shift ;;
    --health)      SET[health_path]="$2"; shift ;;
    --health-cmd)  SET[health_cmd]="$2";  shift ;;
    --exposure)    SET[exposure]="$2";    shift ;;
    --stack)       SET[stack]="$2";       shift ;;
    --ui)          SET[ui]=true ;;
    --no-ui)       SET[ui]=false ;;
    --enable)      SET[enabled]=true ;;
    --disable)     SET[enabled]=false ;;
    -h|--help)     sed -n '2,/^set -euo/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

# FAILED n'est fiable que si bad() n'est jamais appele dans un sous-shell : une
# boucle « ... | while read » perdrait l'increment et --check sortirait en 0 en
# ayant affiche des KO. Toutes les boucles de verification sont des `for`.
FAILED=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mattn\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mKO\033[0m    %s\n' "$1"; FAILED=$((FAILED+1)); }

# --- lecture des manifestes -----------------------------------------------------
#
# Parsing plat volontaire : cle en colonne 0, pas de YAML imbrique. Il n'y a
# donc rien a installer pour lancer ce script. Les app.yml n'etant plus reecrits,
# ils sont edites a la main : on retire le CR d'une edition Windows, le
# commentaire de fin de ligne et les guillemets, sans quoi « port: 8080 # todo »
# produirait un compose invalide.

yget() {  # yget <fichier> <cle> <defaut>
  local f="$1" k="$2" d="${3-}" v=""
  [ -f "$f" ] && v=$(tr -d '\r' < "$f" | sed -nE "s/^$k:[[:space:]]*(.*)$/\1/p" | head -1)
  v=$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')
  v="${v#\"}"; v="${v%\"}"; v="${v#\'}"; v="${v%\'}"
  printf '%s' "${v:-$d}"
}

fab() { yget fabrique.yml "$1" "$2"; }

app_get() {  # app_get <app> <cle> <defaut> — l'option CLI ne vaut que pour --app
  local a="$1" k="$2" d="${3-}"
  if [ "$TARGET" = "$a" ] && [ -n "${SET[$k]+x}" ]; then printf '%s' "${SET[$k]}"; return; fi
  yget "apps/$a/app.yml" "$k" "$d"
}

# --- listes YAML : un sous-ensemble restreint, et rien de plus -------------------
#
# yget et app_get ne lisent que des scalaires en colonne 0. Les sections
# volumes, env, needs, services et shared_services sont des listes : elles ont
# leurs propres lecteurs. Ce ne sont pas des parseurs YAML generaux — c'est
# delibere, un parseur general dans ce script serait une source de bogues muets.
# Le sous-ensemble accepte, et lui seul :
#
#   cle: [a, b]                 liste en ligne, elements separes par des virgules
#   cle:                        liste en bloc, un « - » par element
#     - a
#     - b
#   cle:                        liste de mappings (services, shared_services)
#     - premiere: valeur        la premiere paire ouvre un element
#       autre: valeur           les suivantes appartiennent au meme element
#       imbriquee:              une liste en bloc sous un element
#         - x
#       en_ligne: [x, y]        ou une liste en ligne
#
# Pas d'ancres, pas de blocs multi-lignes, pas de troisieme niveau. Comme dans
# yget, le CR d'une edition Windows, le commentaire de fin de ligne et les
# guillemets sont retires ; une ligne entierement commentee est ignoree, ce qui
# rend inoffensif l'exemple commente de shared_services dans fabrique.yml.

ylist() {  # ylist <fichier> <cle> — liste de scalaires, une valeur par ligne
  [ -f "$1" ] || return 0
  tr -d '\r' < "$1" | awk -v k="$2" '
    BEGIN { Q = sprintf("%c", 39); inlist = 0 }
    function clean(s,   f, l) {
      sub(/[ \t]+#.*$/, "", s)
      gsub(/^[ \t]+/, "", s); gsub(/[ \t]+$/, "", s)
      f = substr(s, 1, 1); l = substr(s, length(s), 1)
      if (length(s) >= 2 && f == l && (f == "\"" || f == Q)) s = substr(s, 2, length(s) - 2)
      return s
    }
    # emit(raw) — decide si un element nettoye VIDE doit tout de meme etre
    # imprime. Une valeur EXPLICITEMENT citee (« "" », « '' ») est un element
    # reel — c est ainsi que redis/valkey desactivent une option (« --save "" »)
    # — et doit passer meme vide ; un element qui n a jamais porte de guillemets
    # (une virgule finale, une ligne blanche a l interieur d un bloc) ne l est
    # pas et reste tu. Sans cette distinction, « command: […, "--save", ""] »
    # perd son dernier element EN SILENCE, alors que le contrat promet la liste
    # « lue et emise EN ENTIER dans les deux cas ».
    function emit(raw,   t, f, l, quoted, val) {
      t = raw
      sub(/[ \t]+#.*$/, "", t)
      gsub(/^[ \t]+/, "", t); gsub(/[ \t]+$/, "", t)
      f = substr(t, 1, 1); l = substr(t, length(t), 1)
      quoted = (length(t) >= 2 && f == l && (f == "\"" || f == Q))
      val = clean(raw)
      if (val != "" || quoted) print val
    }
    function flow(v,   n, i, c, q, cur) {
      sub(/^\[/, "", v); sub(/\]$/, "", v)
      # Le decoupage TIENT COMPTE DES GUILLEMETS. Un split naif sur la virgule
      # coupe « "a,b" » en plein milieu et laisse deux guillemets ORPHELINS, qui
      # entrent litteralement dans la valeur, donc dans le conteneur.
      n = length(v); q = ""; cur = ""
      for (i = 1; i <= n; i++) {
        c = substr(v, i, 1)
        if (q != "") { cur = cur c; if (c == q) q = "" }
        else if (c == "\"" || c == Q) { q = c; cur = cur c }
        else if (c == ",") { emit(cur); cur = "" }
        else cur = cur c
      }
      emit(cur)
    }
    /^[ \t]*$/ { next }
    {
      p = match($0, /[^ \t]/); ind = p - 1; s = substr($0, p)
      if (substr(s, 1, 1) == "#") next
      if (ind == 0) {
        inlist = 0
        if (index(s, k ":") == 1) {
          v = clean(substr(s, length(k) + 2))
          if (v == "") inlist = 1
          else if (substr(v, 1, 1) == "[") flow(v)
        }
        next
      }
      if (!inlist) next
      if (s ~ /^-([ \t]|$)/) {
        r = s; sub(/^-[ \t]*/, "", r); emit(r)
        next
      }
      inlist = 0
    }
  '
}

ymaps() {  # ymaps <fichier> <cle> — liste de mappings : « index<TAB>cle<TAB>valeur »
  [ -f "$1" ] || return 0
  tr -d '\r' < "$1" | awk -v k="$2" '
    BEGIN { Q = sprintf("%c", 39); st = 0; idx = -1; dash = -1; pend = "" }
    function clean(s,   f, l) {
      sub(/[ \t]+#.*$/, "", s)
      gsub(/^[ \t]+/, "", s); gsub(/[ \t]+$/, "", s)
      f = substr(s, 1, 1); l = substr(s, length(s), 1)
      if (length(s) >= 2 && f == l && (f == "\"" || f == Q)) s = substr(s, 2, length(s) - 2)
      return s
    }
    # emit3(key, raw) — meme distinction que emit() dans ylist : une valeur
    # EXPLICITEMENT citee (« "" », « '' ») est un element reel — c est ainsi que
    # redis/valkey desactivent une option (« --save "" ») — et doit etre emise
    # meme vide ; un element jamais cite (virgule finale, ligne blanche) ne l est
    # pas et reste tu. Sans cette distinction, un « command: […, "--save", ""] »
    # d une annexe ou d un service partage perd son dernier element EN SILENCE.
    function emit3(key, raw,   t, f, l, quoted, val) {
      t = raw
      sub(/[ \t]+#.*$/, "", t)
      gsub(/^[ \t]+/, "", t); gsub(/[ \t]+$/, "", t)
      f = substr(t, 1, 1); l = substr(t, length(t), 1)
      quoted = (length(t) >= 2 && f == l && (f == "\"" || f == Q))
      val = clean(raw)
      if (val != "" || quoted) print idx "\t" key "\t" val
    }
    function flow(key, v,   n, i, c, q, cur) {
      sub(/^\[/, "", v); sub(/\]$/, "", v)
      # Meme decoupage que dans ylist, et pour la meme raison : sans tenir compte
      # des guillemets, « command: ["postgres", "-c", "a=x,y"] » devient trois
      # arguments dont deux portent un guillemet orphelin — et le argv reellement
      # lance par le conteneur cesse alors de correspondre a ce qui est ecrit.
      n = length(v); q = ""; cur = ""
      for (i = 1; i <= n; i++) {
        c = substr(v, i, 1)
        if (q != "") { cur = cur c; if (c == q) q = "" }
        else if (c == "\"" || c == Q) { q = c; cur = cur c }
        else if (c == ",") { emit3(key, cur); cur = "" }
        else cur = cur c
      }
      emit3(key, cur)
    }
    function pair(t,   kk, vv) {
      if (t !~ /^[A-Za-z_][A-Za-z0-9_]*:/) return
      kk = t; sub(/:.*$/, "", kk)
      vv = clean(substr(t, length(kk) + 2))
      if (vv == "") { pend = kk; return }
      pend = ""
      if (substr(vv, 1, 1) == "[") { flow(kk, vv); return }
      print idx "\t" kk "\t" vv
    }
    /^[ \t]*$/ { next }
    {
      p = match($0, /[^ \t]/); ind = p - 1; s = substr($0, p)
      if (substr(s, 1, 1) == "#") next
      if (ind == 0) {
        st = 0
        if (index(s, k ":") == 1 && clean(substr(s, length(k) + 2)) == "") {
          st = 1; idx = -1; dash = -1; pend = ""
        }
        next
      }
      if (!st) next
      if (s ~ /^-([ \t]|$)/) {
        r = s; sub(/^-[ \t]*/, "", r)
        if (dash < 0 || ind == dash) { dash = ind; idx++; pend = ""; if (r != "") pair(r); next }
        if (ind > dash) { if (pend != "") emit3(pend, r); next }
        st = 0; next
      }
      if (idx >= 0 && ind > dash) pair(s)
      else st = 0
    }
  '
}

# Accesseurs sur le flux produit par ymaps. Passer le flux en argument plutot que
# de relire le fichier evite de reparser N fois le meme manifeste.
map_count() {  # map_count <flux> — nombre d'elements
  if [ -z "${1-}" ]; then echo 0; return; fi
  printf '%s\n' "$1" | awk -F'\t' 'BEGIN { m = -1 } { if ($1 + 0 > m) m = $1 + 0 } END { print m + 1 }'
}
map_one() {  # map_one <flux> <index> <cle> — premiere valeur scalaire
  if [ -z "${1-}" ]; then return 0; fi
  printf '%s\n' "$1" | awk -F'\t' -v i="$2" -v k="$3" '$1 == i && $2 == k { print $3; exit }'
}
map_all() {  # map_all <flux> <index> <cle> — toutes les valeurs, une par ligne
  if [ -z "${1-}" ]; then return 0; fi
  printf '%s\n' "$1" | awk -F'\t' -v i="$2" -v k="$3" '$1 == i && $2 == k { print $3 }'
}
map_keys() {  # map_keys <flux> <index> — les cles distinctes de cet element
  if [ -z "${1-}" ]; then return 0; fi
  printf '%s\n' "$1" | awk -F'\t' -v i="$2" '$1 == i && !vu[$2]++ { print $2 }'
}

# Les seules cles lues dans une entree services: ou shared_services:. Toute
# autre est ignoree par le generateur — en silence, ce qui est le probleme :
# « labels: [traefik.enable=false] » ecrit a la main donne le sentiment d'avoir
# durci un service sans qu'une ligne du compose bouge.
AUX_KEYS=" name image memory command volumes env "

COMPOSE=compose.yaml
LEGACY_COMPOSE=docker-compose.yml

REGISTRY=$(fab registry ghcr.io)
ORG=$(fab org billbob-space)
REPO=$(fab repo "$(basename "$(pwd)")")
DOMAIN=$(fab domain apps.billbob.ovh)
NETWORK=$(fab network apps_net)
ENTRYPOINT=$(fab entrypoint websecure)
CERT_RESOLVER=$(fab cert_resolver letsencrypt)
SECURITY_HEADERS=$(fab security_headers security-headers@file)
MEMORY_BUDGET=$(fab memory_budget 1024m)
IMAGE_MAX_MB=$(fab image_max_mb 200)
CLAUDE_MAX_LIGNES=$(fab claude_max_lignes 250)
LOG_MAX_SIZE=$(fab log_max_size 10m)
LOG_MAX_FILE=$(fab log_max_file 3)

# --- applications ---------------------------------------------------------------

valid_name() {  # label DNS : ni tiret en tete ni tiret en queue
  printf '%s' "$1" | grep -qE '^[a-z0-9]([a-z0-9-]{0,29}[a-z0-9])?$' && return 0
  echo "ERREUR : nom d'app invalide : '$1' — il devient un sous-domaine." >&2
  return 1
}

valid_svc_name() {  # nom d'un service annexe ou partage : meme regle qu'une app
  printf '%s' "$1" | grep -qE '^[a-z0-9]([a-z0-9-]{0,29}[a-z0-9])?$'
}

# --- validation des sections optionnelles ---------------------------------------
#
# Chaque validateur pose VERR et rend 1 ; il n'ecrit rien et ne sort jamais. Les
# deux appelants en font ce qu'ils veulent : la generation en meurt avec un
# message explicite, --check en fait une ligne KO parmi les autres. Une seule
# implementation, donc pas de divergence possible entre les deux chemins.
VERR="" VOL_NAME="" VOL_PATH="" VOL_SPEC=""

# Les points de montage sont des VOLUMES NOMMES Docker, et rien d'autre. Un bind
# mount dont le repertoire source n'existe pas est cree par Docker EN ROOT ;
# l'app tourne en non-root et ne peut donc pas y ecrire. Le symptome est « l'app
# demarre et perd tout », sans erreur claire, et la seule parade est une action
# manuelle sur l'hote avant chaque premier deploiement. Un volume nomme n'a pas
# ce defaut : au premier montage, Docker y recopie le contenu du repertoire tel
# qu'il existe dans l'IMAGE — proprietaire compris. C'est donc le Dockerfile qui
# decide, et « docker compose up » cree le volume tout seul : zero action sur
# l'hote, pour aucune app, jamais.
check_volume() {  # check_volume <proprietaire> <spec> — pose VOL_NAME, VOL_PATH, VOL_SPEC
  local owner="$1" spec="$2" name rest cpath mode
  VERR="" VOL_NAME="" VOL_PATH="" VOL_SPEC=""
  case "$spec" in
    *:*) ;;
    *) VERR="volume '$spec' invalide : forme attendue <nom>:<chemin conteneur>[:ro] — le chemin de montage dans le conteneur manque."; return 1 ;;
  esac
  name="${spec%%:*}"; rest="${spec#*:}"
  cpath="${rest%%:*}"
  if [ "$cpath" = "$rest" ]; then mode=""; else mode="${rest#*:}"; fi

  # Un '/' a gauche, c'est un bind mount : refuse, et pour une raison precise.
  case "$name" in
    */*)
      VERR="volume '$spec' invalide : '$name' contient un '/'. Les bind mounts ne sont PAS supportes ici : si le repertoire hote n'existe pas, Docker le cree EN ROOT, l'app tourne en non-root, elle ne peut plus y ecrire — elle demarre et perd tout, sans erreur claire, et il faut une action manuelle sur l'hote avant chaque premier deploiement. Ecris un nom logique de volume nomme : '<nom>:$cpath'."
      return 1 ;;
  esac
  if ! printf '%s' "$name" | grep -qE '^[a-z0-9][a-z0-9-]*$'; then
    VERR="volume '$spec' invalide : le nom '$name' doit correspondre a ^[a-z0-9][a-z0-9-]*\$ — minuscules, chiffres et tirets seulement, donc ni point, ni '..', ni chemin absolu, ni chaine vide. C'est un nom LOGIQUE, pas un sous-repertoire : le volume reel s'appellera '$owner-<nom>'."
    return 1
  fi
  case "$cpath" in
    /*) ;;
    *) VERR="volume '$spec' invalide : le chemin conteneur '$cpath' doit etre absolu (commencer par /)."; return 1 ;;
  esac
  case "$cpath" in
    *..*) VERR="volume '$spec' invalide : '..' interdit dans le chemin conteneur."; return 1 ;;
  esac
  case "$mode" in
    ""|ro) ;;
    *) VERR="volume '$spec' invalide : ':$mode' — le seul suffixe autorise est ':ro'."; return 1 ;;
  esac
  VOL_NAME="$owner-$name"
  VOL_PATH="$cpath"
  VOL_SPEC="$VOL_NAME:$cpath${mode:+:$mode}"
  return 0
}

# Registre des volumes emis : nom reel -> proprietaire. Deux proprietaires
# differents produisant le meme nom reel — « foo » + « bar-baz » et « foo-bar » +
# « baz » donnent tous deux « foo-bar-baz » — partageraient un volume sans le
# savoir. Un meme proprietaire qui reutilise un nom, lui, partage volontairement
# ses donnees entre son service principal et une annexe : c'est la raison d'etre
# de la notion de proprietaire, et ce n'est pas une erreur.
declare -A VOL_OWNER=()

check_volume_list() {  # check_volume_list <proprietaire> <etiquette> <specs> — imprime les problemes
  local owner="$1" label="$2" specs="$3" v
  local -A seen_name=() seen_path=()
  [ -n "$specs" ] || return 0
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    if ! check_volume "$owner" "$v"; then printf '%s %s\n' "$label" "$VERR"; continue; fi
    if [ -n "${seen_name[$VOL_NAME]+x}" ]; then
      printf "%s volume '%s' declare deux fois dans la meme liste — le volume reel '%s' serait monte deux fois\n" \
        "$label" "${v%%:*}" "$VOL_NAME"
    else
      seen_name[$VOL_NAME]=1
    fi
    if [ -n "${seen_path[$VOL_PATH]+x}" ]; then
      printf "%s deux volumes montes sur le meme chemin conteneur '%s' — le second masquerait le premier\n" \
        "$label" "$VOL_PATH"
    else
      seen_path[$VOL_PATH]=1
    fi
    if [ -n "${VOL_OWNER[$VOL_NAME]+x}" ] && [ "${VOL_OWNER[$VOL_NAME]}" != "$owner" ]; then
      printf "%s collision de nom de volume : '%s' est deja produit par le proprietaire '%s' — les deux monteraient le meme volume sans le savoir\n" \
        "$label" "$VOL_NAME" "${VOL_OWNER[$VOL_NAME]}"
    else
      VOL_OWNER[$VOL_NAME]="$owner"
    fi
  done <<<"$specs"
}

# La commande telle qu'elle sera lancee, un argument par ligne. ymaps rend un
# enregistrement PAR ELEMENT des que command: est ecrite en LISTE YAML — forme
# en ligne « [a, b] » comme forme bloc « - a ». La lire avec map_one ne verrait
# que le premier : la commande serait tronquee a son premier mot dans le compose,
# en silence. La forme scalaire, elle, se decoupe sur les espaces comme une ligne
# de shell.
CMD_ARGV=()
cmd_argv() {  # cmd_argv <flux> <index> — pose CMD_ARGV
  local -a elems=()
  CMD_ARGV=()
  mapfile -t elems < <(map_all "$1" "$2" command)
  if [ "${#elems[@]}" -le 1 ]; then
    read -ra CMD_ARGV <<<"${elems[0]-}"
  else
    CMD_ARGV=("${elems[@]}")
  fi
}

# --- les secrets : UNE SEULE PORTE, et elle regarde le RESULTAT ------------------
#
# Il n'y a plus de controle « par champ ». Il y en a eu un — sur command: — et il
# a ete contourne trois fois de suite, chaque fois par une syntaxe que sa lecture
# en jetons ne modelisait pas : « sh -c "… --requirepass X" » (un seul jeton, sans
# tiret ni « = », donc ignore), « --requirepass -X » (une valeur prise pour une
# option), puis health_cmd, qui n'entrait pas par command: du tout. La lecon n'est
# pas qu'il manquait une regle de plus : c'est qu'un controle par NOM DE CHAMP a
# autant de trous que le manifeste a de champs, et un de plus a chaque champ
# ajoute.
#
# Ce scan-ci ne connait aucun champ. Il lit les FICHIERS PRODUITS ET LES
# MANIFESTES — compose.yaml, fabrique.yml, apps/*/app.yml — et y cherche la seule
# chose qui compte : « <mot-secret><separateur><valeur litterale> ». Il attrape
# donc « sh -c », health_cmd, command:, un env: mal ecrit, et la porte que
# quelqu'un ouvrira demain, parce qu'il regarde ce qui EST ECRIT et non par ou
# c'est entre.
#
# Ce qui est EXEMPTE, et pourquoi :
#   - « ${VAR} », « $(...) », « $VAR » : la valeur n'est pas dans le depot, elle
#     est injectee au « compose up ». C'est la forme prevue, celle vers laquelle
#     le message d'erreur renvoie.
#   - une valeur qui est un CHEMIN (« /run/secrets/pw ») : c'est la forme
#     recommandee du secret monte en fichier — « --password-file /run/secrets/pw ».
#     La refuser pousserait a ecrire le secret en clair a la place.
#
# Ce qui compte comme valeur : tout le reste, y compris un jeton commencant par
# « - ». C'est precisement par la qu'on est passe la derniere fois.
#
# Les faux positifs sont evites par la FRONTIERE GAUCHE, pas par une liste
# d'exceptions : le mot-secret doit ouvrir la ligne en cle YAML (« password: X »)
# ou etre colle a la ponctuation d'une option ou d'un identifiant
# (« --requirepass », « POSTGRES_PASSWORD= », « "--api-key", »). « un secret dans
# le depot », en prose, ne matche donc pas — et « key » et « auth » ne sont jamais
# reconnus seuls, mais soudes a un mot qui denonce un secret : « --tls-key-file »,
# « --notify-keyspace-events », « --auth-host=trust » restent admis.
SECRET_WORD='(requirepass|password|passwd|secret|token|api[-_.]?key|secret[-_.]?key|private[-_.]?key|access[-_.]?key|auth[-_.]?(token|pass|key))'

# scan_secrets <etiquette> — lit le texte a inspecter sur l'ENTREE STANDARD et
# ecrit un probleme par ligne, « <etiquette>:<ligne> <message> ». N'imprime
# JAMAIS la valeur trouvee : ce script ecrit dans un terminal, dans un journal de
# CI, et sa sortie est recopiee dans des tickets.
scan_secrets() {
  LC_ALL=C awk -v F="$1" -v W="$SECRET_WORD" '
    BEGIN {
      Q  = sprintf("%c", 39)
      QT = "[\"" Q "]"
      # <separateur> : l espace, « = », « : » — et la ponctuation qui separe deux
      # elements d une liste CITEE, par laquelle passe la forme exec du compose :
      # « "--requirepass", "X" ».
      SEP = "([ \t]*[=:][ \t]*|[ \t]+|" QT "[ \t]*,[ \t]*" QT ")"
      # Frontiere gauche : la ponctuation d une option ou d un identifiant.
      OPT = "[-_.,/[{(" Q "\"]" W SEP
      # ... ou la cle en tete de ligne, forme « cle: valeur » d un manifeste.
      KEY = "^[ \t]*(-[ \t]+)?" W "[ \t]*[=:][ \t]*"
      # Sur une ligne de COMMENTAIRE, le separateur « espace(s) » et « : entoure
      # d espaces » est retire : une phrase qui explique une decision de securite
      # — « Pas de --requirepass : redis n est joignable que depuis apps_net » —
      # matche sinon exactement le meme motif qu une vraie fuite, le mot-secret
      # etant suivi d un « : » puis d un mot. Seuls « = » et la forme listee-citee
      # restent detectes en commentaire : une vraie valeur collee dans un
      # commentaire s ecrit presque toujours "cle=valeur" ou "cle", "valeur", pas
      # en continuant une phrase.
      SEPC = "([ \t]*=[ \t]*|" QT "[ \t]*,[ \t]*" QT ")"
      OPTC = "[-_.,/[{(" Q "\"]" W SEPC
      KEYC = "^[ \t]*#[ \t]*" W "[ \t]*=[ \t]*"
      # L URL a identifiants : « ://utilisateur:motdepasse@ ».
      URL = "://[^:@/ \t]+:[^@/ \t]*@"
      REM = " Un secret n entre pas dans ce depot : declare le NOM de la variable dans env: et reference-la sous la forme ${NOM}, ou monte le secret en fichier cote serveur et passe son CHEMIN (« /run/secrets/… »)."
    }
    function say(nr, kw, msg) {
      if ((nr SUBSEP kw) in vu) return
      vu[nr SUBSEP kw] = 1
      printf "%s:%d %s\n", F, nr, msg
    }
    # La valeur qui suit le separateur — extraite pour etre QUALIFIEE, jamais
    # imprimee.
    function value(s,   v) {
      v = s
      sub("^" QT, "", v)
      if (!match(v, "^[^ \t\"" Q "]+")) return ""
      return substr(v, 1, RLENGTH)
    }
    function exempte(v) {
      if (v == "") return 1                      # cle sans valeur : rien n entre
      if (substr(v, 1, 1) == "$") return 1       # ${VAR}, $(...) : l infrastructure
      if (substr(v, 1, 1) == "/") return 1       # un CHEMIN : secret monte en fichier
      return 0
    }
    function mot(m) {  # le NOM de la cle, pour le message
      sub(/^[ \t]*/, "", m); sub(/^-+[ \t]*/, "", m); sub(/^[^a-z0-9]/, "", m)
      sub(/[^a-z0-9_.-].*$/, "", m)
      return m
    }
    # Toute expansion — ${VAR}, $(...), $VAR — est remplacee par « $XXX » de MEME
    # LONGUEUR. Les deux effets sont necessaires : la valeur reste exemptee, elle
    # commence toujours par « $ » ; et un mot-secret ne peut plus etre lu A L
    # INTERIEUR de l expansion. Sans cela « ${ADMIN_PASSWORD:-} », que emit_env
    # ecrit pour CHAQUE nom declare, se lirait « password: -} » — une valeur
    # litterale — et plus aucun env: ne passerait.
    function masque(t,   out, n, i, j, k, c, d, cl) {
      out = ""; n = length(t); i = 1
      while (i <= n) {
        c = substr(t, i, 1)
        if (c == "$" && i < n) {
          d = substr(t, i + 1, 1)
          if (d == "{" || d == "(") {
            cl = (d == "{") ? "}" : ")"
            j = i + 2
            while (j <= n && substr(t, j, 1) != cl) j++
            if (j > n) j = n
            out = out "$"
            for (k = i + 1; k <= j; k++) out = out "X"
            i = j + 1
            continue
          }
          if (d ~ /[A-Za-z_]/) {
            j = i + 1
            while (j <= n && substr(t, j, 1) ~ /[A-Za-z0-9_]/) j++
            out = out "$"
            for (k = i + 1; k < j; k++) out = out "X"
            i = j
            continue
          }
        }
        out = out c
        i++
      }
      return out
    }
    function scan(t, nr,   lc, off, st, ln, kw, v, u, is_c, opt_re, key_re) {
      t  = masque(t)
      lc = tolower(t)
      # Une ligne de commentaire utilise les motifs restreints (SEPC/OPTC/KEYC) :
      # voir la note en BEGIN.
      is_c = (lc ~ /^[ \t]*#/)
      opt_re = is_c ? OPTC : OPT
      key_re = is_c ? KEYC : KEY
      off = 0
      while (match(substr(lc, off + 1), URL)) {
        st = off + RSTART; ln = RLENGTH
        u = substr(t, st, ln); sub(/^:\/\/[^:]*:/, "", u); sub(/@$/, "", u)
        if (!exempte(u))
          say(nr, "url", "identifiants ecrits dans une URL (« ://utilisateur:motdepasse@ ») — le mot de passe y est une valeur litterale, non reimprimee ici." REM)
        off = st + ln - 1
      }
      if (match(lc, key_re)) {
        kw = mot(substr(lc, RSTART, RLENGTH))
        v  = value(substr(t, RSTART + RLENGTH))
        if (!exempte(v))
          say(nr, kw, "la cle « " kw " » porte une valeur litterale et son nom evoque un secret — valeur non reimprimee ici." REM)
      }
      off = 0
      while (match(substr(lc, off + 1), opt_re)) {
        st = off + RSTART; ln = RLENGTH
        kw = mot(substr(lc, st, ln))
        v  = value(substr(t, st + ln))
        if (!exempte(v))
          say(nr, kw, "la cle « " kw " » porte une valeur litterale et son nom evoque un secret — valeur non reimprimee ici." REM)
        off = st + ln - 1
      }
    }
    {
      scan($0, NR)
      # Une liste en BLOC ecrit l option et sa valeur sur DEUX lignes. On ne
      # recolle que deux elements dont le PREMIER est une option (« - --requirepass ») :
      # recoller deux elements quelconques ferait de « env: [- A_SECRET, - B] »
      # une fausse alerte, alors que ce sont deux noms de variables.
      it = $0; sub(/^[ \t]+/, "", it)
      if (it ~ /^-[ \t]/) {
        e = it; sub(/^-[ \t]*/, "", e)
        if (pend != "") scan(pend " " e, pnr)
        if (substr(e, 1, 1) == "-") { pend = e; pnr = NR } else pend = ""
      } else pend = ""
    }
  '
}

# Les manifestes : fabrique.yml et les apps/*/app.yml decouverts. Le compose,
# lui, est scanne par ses deux appelants — a la generation sur le texte QUI VA
# ETRE ECRIT, dans --check sur le fichier produit.
scan_manifests() {
  local a
  [ -f fabrique.yml ] && scan_secrets fabrique.yml < fabrique.yml
  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    [ -f "apps/$a/app.yml" ] && scan_secrets "apps/$a/app.yml" < "apps/$a/app.yml"
  done
  return 0
}

check_env_name() {  # check_env_name <element> — env: est une liste de NOMS
  VERR=""
  case "$1" in
    *=*) VERR="env : '$1' contient un '=' — env: ne prend que des NOMS de variables, jamais de valeurs. Un secret n'entre pas dans le depot par cette porte : l'infrastructure injecte la valeur."; return 1 ;;
  esac
  if printf '%s' "$1" | grep -qE '^[A-Z][A-Z0-9_]*$'; then return 0; fi
  VERR="env : '$1' n'est pas un nom de variable valide — attendu ^[A-Z][A-Z0-9_]*\$."
  return 1
}

# --- services partages de fabrique.yml ------------------------------------------

SHARED_RECORDS="" SHARED_NAMES=() SHARED_ERRS=()

load_shared() {
  SHARED_NAMES=() SHARED_ERRS=()
  SHARED_RECORDS=$(ymaps fabrique.yml shared_services)
  local n i name image mem
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    if [ -z "$name" ]; then
      SHARED_ERRS+=("fabrique.yml — shared_services[$i] n'a pas de 'name' : il donne le nom de service et le nom d'hote sur $NETWORK")
      continue
    fi
    if ! valid_svc_name "$name"; then
      SHARED_ERRS+=("fabrique.yml — shared_services : nom invalide '$name' — attendu un label DNS (minuscules, chiffres, tirets), il devient un nom de service et un container_name")
    fi
    image=$(map_one "$SHARED_RECORDS" "$i" image)
    if [ -z "$image" ]; then
      SHARED_ERRS+=("fabrique.yml — shared_services '$name' sans 'image' : un service partage n'est pas construit par la CI, son image doit etre nommee")
    fi
    mem=$(map_one "$SHARED_RECORDS" "$i" memory); mem=${mem:-128m}
    if ! printf '%s' "$mem" | grep -qE '^[0-9]+[bkmgBKMG]?$'; then
      SHARED_ERRS+=("fabrique.yml — shared_services '$name' : memory invalide '$mem'")
    fi
    SHARED_NAMES+=("$name")
  done
}

shared_exists() {
  local s
  for s in "${SHARED_NAMES[@]-}"; do
    if [ "$s" = "$1" ]; then return 0; fi
  done
  return 1
}

APPS=() APPS_ACTIVES=()

# --add --dry-run n'ecrit pas apps/<nom>/app.yml : sans precaution, l'app ajoutee
# reste invisible de tout ce qui suit, et l'apercu annonce « .claude/settings.json
# inchange » alors que la meme commande sans --dry-run y ajouterait le serveur LSP
# de la stack demandee. L'app est donc inscrite EN MEMOIRE, avec exactement les
# valeurs que l'echafaudage aurait ecrites — app_get lit SET avant le fichier, et
# le fichier absent rend les memes defauts que le gabarit.
PHANTOM_APP=""

discover_apps() {
  local d a found
  APPS=()
  # LC_ALL=C fige l'ordre : un ordre dependant de la locale produirait un diff
  # de compose.yaml d'une machine a l'autre, donc un redeploiement fantome.
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    [ -f "$d/app.yml" ] || { warn "$d : pas d'app.yml, ignore"; continue; }
    APPS+=("$(basename "$d")")
  done < <(LC_ALL=C find apps -mindepth 1 -maxdepth 1 -type d 2>/dev/null | LC_ALL=C sort)
  if [ -n "$PHANTOM_APP" ]; then
    found=0
    for a in "${APPS[@]-}"; do [ "$a" = "$PHANTOM_APP" ] && found=1; done
    if [ "$found" = 0 ]; then
      APPS+=("$PHANTOM_APP")
      # Meme tri que ci-dessus : l'apercu doit montrer les artefacts tels qu'ils
      # seraient ecrits, l'ordre des blocs du compose compris.
      mapfile -t APPS < <(printf '%s\n' "${APPS[@]}" | LC_ALL=C sort)
    fi
  fi
}

load_app() {  # load_app <app> — peuple APP et A_*, valide, sort en erreur sinon
  APP="$1"
  valid_name "$APP" || exit 1
  A_ENABLED=$(app_get "$APP" enabled true)
  A_PORT=$(app_get "$APP" port 8080)
  A_MEMORY=$(app_get "$APP" memory 128m)
  A_HEALTH_PATH=$(app_get "$APP" health_path /healthz)
  A_EXPOSURE=$(app_get "$APP" exposure private)
  A_HEALTH_CMD=$(app_get "$APP" health_cmd "wget --spider -q http://localhost:$A_PORT$A_HEALTH_PATH")
  A_STACK=$(app_get "$APP" stack none)
  A_UI=$(app_get "$APP" ui false)

  # Les quatre sections optionnelles. Absentes, elles donnent des listes vides
  # et un flux vide : le bloc compose emis est alors, au caractere pres, celui
  # d'avant leur existence.
  mapfile -t A_VOLUMES < <(ylist "apps/$APP/app.yml" volumes)
  mapfile -t A_ENV     < <(ylist "apps/$APP/app.yml" env)
  mapfile -t A_NEEDS   < <(ylist "apps/$APP/app.yml" needs)
  A_SERVICES=$(ymaps "apps/$APP/app.yml" services)

  # A_MW_NOTE est le commentaire pose juste au-dessus du label middlewares dans
  # compose.yaml : celui qui lit le compose doit savoir ce que le palier garantit
  # sans avoir a ouvrir app.yml.
  case "$A_EXPOSURE" in
    private) A_MW=forwardauth       # whitelist de comptes Google
             A_MW_NOTE="      # forwardauth = authentification Google + liste blanche du serveur
      # (exposure private). La retirer exposerait l'app en clair." ;;
    google)  A_MW=forwardauth-open  # tout compte Google authentifie
             A_MW_NOTE="      # forwardauth-open = tout compte Google, login obligatoire
      # (exposure google). La retirer exposerait l'app en clair." ;;
    public)  A_MW=public            # anonyme : AUCUNE authentification
             A_MW_NOTE="      # public = AUCUNE authentification (exposure public). Acces anonyme,
      # rate-limit seul. Ne pas confondre avec forwardauth-open, qui exige un
      # compte Google. X-Forwarded-User n'est PAS pose sur ce palier." ;;
    *) echo "ERREUR : $APP — exposure doit valoir 'private', 'google' ou 'public' (recu : $A_EXPOSURE)" >&2; exit 1 ;;
  esac
  printf '%s' "$A_PORT"   | grep -qE '^[0-9]{2,5}$'        || { echo "ERREUR : $APP — port invalide : $A_PORT" >&2; exit 1; }
  printf '%s' "$A_MEMORY" | grep -qE '^[0-9]+[bkmgBKMG]?$' || { echo "ERREUR : $APP — memory invalide : $A_MEMORY" >&2; exit 1; }
  case "$A_HEALTH_PATH" in /*) ;; *) echo "ERREUR : $APP — health_path doit commencer par / (recu : $A_HEALTH_PATH)" >&2; exit 1 ;; esac
  case "$A_UI"      in true|false) ;; *) echo "ERREUR : $APP — ui doit valoir true ou false (recu : $A_UI)" >&2; exit 1 ;; esac
  case "$A_ENABLED" in true|false) ;; *) echo "ERREUR : $APP — enabled doit valoir true ou false (recu : $A_ENABLED)" >&2; exit 1 ;; esac

  # volumes: — « <nom>:<chemin conteneur>[:ro] ». Le nom logique est prefixe par
  # celui de l'app pour donner le nom reel du volume : c'est ce prefixe qui
  # empeche deux apps de se marcher dessus sans avoir a se concerter.
  A_VOLUMES=() A_VOL_NOMS=() A_VOL_CHEMINS=()
  local v nom reste chemin mode
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    nom=${v%%:*}; reste=${v#*:}
    case "$nom" in
      "" |*/*) echo "ERREUR : $APP — volume '$v' : la partie gauche est un NOM de volume, pas un chemin d'hote. Un bind mount demanderait une action manuelle sur le serveur — c'est precisement ce que les volumes nommes suppriment." >&2; exit 1 ;;
    esac
    printf '%s' "$nom" | grep -qE '^[a-z0-9][a-z0-9-]*$' \
      || { echo "ERREUR : $APP — volume '$v' : nom invalide '$nom' — minuscules, chiffres et tirets." >&2; exit 1; }
    [ "$reste" = "$v" ] \
      && { echo "ERREUR : $APP — volume '$v' : forme attendue <nom>:<chemin conteneur>[:ro]." >&2; exit 1; }
    chemin=${reste%%:*}; mode=${reste#*:}
    [ "$mode" = "$reste" ] && mode=""
    case "$chemin" in /*) ;; *) echo "ERREUR : $APP — volume '$v' : le chemin conteneur doit etre absolu." >&2; exit 1 ;; esac
    case "$mode" in ""|ro) ;; *) echo "ERREUR : $APP — volume '$v' : ':ro' est le seul suffixe admis (recu : ':$mode')." >&2; exit 1 ;; esac
    # A_VOL_NOMS porte le nom REEL — celui du volume sur l'hote, prefixe par
    # l'app — parce qu'il sert a detecter une collision entre deux apps.
    # A_VOLUMES porte le nom LOGIQUE, tel qu'ecrit dans app.yml : tous ses
    # consommateurs le passent a check_volume(), qui prefixe lui-meme. Le
    # prefixer ici aussi le posait DEUX fois — « hello-world-hello-world-donnees »
    # au lieu de « hello-world-donnees ». Rien n'echouait : le compose restait
    # coherent avec lui-meme, mais le nom reel cessait d'etre celui que
    # memory/volumes.md documente, donc celui que la commande de sauvegarde
    # monte — et une sauvegarde lancee sur le nom documente aurait archive un
    # volume vide en sortant en 0.
    A_VOL_NOMS+=("$APP-$nom")
    A_VOL_CHEMINS+=("$chemin")
    A_VOLUMES+=("$nom:$chemin${mode:+:$mode}")
  done < <(ylist "apps/$APP/app.yml" volumes)
}

# Deux apps peuvent produire le meme nom reel — « ramure » avec « donnees-x » et
# « ramure-donnees » avec « x » donnent tous deux « ramure-donnees-x ». Le cas
# est rare, mais il ferait partager un volume a deux apps sans que ni l'une ni
# l'autre ne l'ait demande. Une passe dediee, parce que load_app ne voit qu'une
# app a la fois.
check_volume_noms() {
  local a n; declare -A vu=()
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_ENABLED" = true ] || continue
    for n in "${A_VOL_NOMS[@]}"; do
      if [ -n "${vu[$n]+x}" ]; then
        echo "ERREUR : le volume '$n' est produit par '${vu[$n]}' et par '$a'. Renomme-le dans l'un des deux app.yml : deux apps partageraient un volume sans l'avoir demande." >&2
        exit 1
      fi
      vu[$n]="$a"
    done
  done
}

mem_to_mb() {  # 128m -> 128, 1g -> 1024
  local v n; v=$(printf '%s' "$1" | tr 'A-Z' 'a-z'); n=${v%%[!0-9]*}
  [ -n "$n" ] || { echo 0; return; }
  case "$v" in
    *g) echo $(( n * 1024 )) ;;
    *m) echo "$n" ;;
    *k) echo $(( n / 1024 )) ;;
    *)  echo $(( n / 1048576 )) ;;
  esac
}

# --- validation d'ensemble des manifestes ---------------------------------------
#
# Ecrit un probleme par ligne sur la sortie standard, rien si tout va bien, et ne
# sort jamais en erreur : la generation en meurt (require_clean_manifests),
# --check en fait des lignes KO. Chaque message nomme son service — le controle
# reste par service, jamais par recherche globale dans un fichier.
#
# Le compose est plat : les trois sortes de services — <app>, <app>-<annexe> et
# <partage> — se disputent le meme espace de noms de service ET de
# container_name. Un doublon y est legal en YAML et silencieux : la derniere cle
# gagne, la premiere disparait du deploiement sans un mot. D'ou le registre.
collect_problems() {
  local a i n p name svc img mem v e d
  declare -A owner_of=()
  VOL_OWNER=()

  for e in "${SHARED_ERRS[@]-}"; do
    [ -n "$e" ] && printf '%s\n' "$e"
  done

  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    owner_of[$a]="l'application apps/$a"
  done

  for name in "${SHARED_NAMES[@]-}"; do
    [ -n "$name" ] || continue
    if [ -n "${owner_of[$name]+x}" ]; then
      printf "collision de nom de service : le service partage '%s' de fabrique.yml porte un nom deja pris par %s — le compose est plat, l'un des deux disparaitrait en silence\n" "$name" "${owner_of[$name]}"
    else
      owner_of[$name]="le service partage '$name' de fabrique.yml"
    fi
  done

  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] || continue
    check_volume_list "$name" "[$name]" "$(map_all "$SHARED_RECORDS" "$i" volumes)"
    while IFS= read -r e; do
      [ -n "$e" ] || continue
      check_env_name "$e" || printf "[%s] %s\n" "$name" "$VERR"
    done < <(map_all "$SHARED_RECORDS" "$i" env)
  done

  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    load_app "$a"
    p="[$a]"

    check_volume_list "$a" "$p" "$(printf '%s\n' "${A_VOLUMES[@]-}")"
    for e in "${A_ENV[@]-}"; do
      [ -n "$e" ] || continue
      check_env_name "$e" || printf '%s %s\n' "$p" "$VERR"
    done
    for d in "${A_NEEDS[@]-}"; do
      [ -n "$d" ] || continue
      if ! shared_exists "$d"; then
        printf "%s needs: '%s' ne correspond a aucun shared_services declare dans fabrique.yml (declares : %s) — declare-le la-bas, sinon depends_on pointerait dans le vide\n" \
          "$p" "$d" "$([ ${#SHARED_NAMES[@]} -gt 0 ] && printf '%s ' "${SHARED_NAMES[@]}" || printf 'aucun')"
      fi
    done

    n=$(map_count "$A_SERVICES")
    for (( i = 0; i < n; i++ )); do
      name=$(map_one "$A_SERVICES" "$i" name)
      if [ -z "$name" ]; then
        printf "%s services[%d] n'a pas de 'name' : il donne le nom de service '%s-<name>'\n" "$p" "$i" "$a"
        continue
      fi
      if ! valid_svc_name "$name"; then
        printf "%s services : nom d'annexe invalide '%s' — attendu un label DNS (minuscules, chiffres, tirets), il devient le nom de service et le container_name '%s-%s'\n" "$p" "$name" "$a" "$name"
        continue
      fi
      svc="$a-$name"
      if [ -n "${owner_of[$svc]+x}" ]; then
        printf "%s collision de nom de service : l'annexe '%s' produit '%s', deja pris par %s\n" "$p" "$name" "$svc" "${owner_of[$svc]}"
      else
        owner_of[$svc]="le service annexe '$name' de apps/$a"
      fi
      img=$(map_one "$A_SERVICES" "$i" image)
      [ -n "$img" ] || printf "%s services '%s' sans 'image' : un service annexe n'est pas construit par la CI, son image doit etre nommee\n" "$p" "$name"
      mem=$(map_one "$A_SERVICES" "$i" memory); mem=${mem:-128m}
      printf '%s' "$mem" | grep -qE '^[0-9]+[bkmgBKMG]?$' \
        || printf "%s services '%s' : memory invalide '%s'\n" "$p" "$name" "$mem"
      # Le proprietaire des volumes d'une annexe est l'APP : c'est ce qui permet
      # a un worker de monter le meme volume nomme que son service principal.
      check_volume_list "$a" "$p services '$name' :" "$(map_all "$A_SERVICES" "$i" volumes)"
      while IFS= read -r e; do
        [ -n "$e" ] || continue
        check_env_name "$e" || printf "%s services '%s' : %s\n" "$p" "$name" "$VERR"
      done < <(map_all "$A_SERVICES" "$i" env)
    done
  done
}

# Les avertissements : ce qui ne casse rien, mais ne fait pas ce que son auteur
# croit. Separe de collect_problems, dont chaque ligne est bloquante.
collect_warnings() {
  local a n i name k
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] || continue
    while IFS= read -r k; do
      [ -n "$k" ] || continue
      case "$AUX_KEYS" in *" $k "*) continue ;; esac
      printf "fabrique.yml shared_services '%s' : cle inconnue '%s' ignoree\n" "$name" "$k"
    done < <(map_keys "$SHARED_RECORDS" "$i")
  done
  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    load_app "$a"
    n=$(map_count "$A_SERVICES")
    for (( i = 0; i < n; i++ )); do
      name=$(map_one "$A_SERVICES" "$i" name)
      [ -n "$name" ] || continue
      while IFS= read -r k; do
        [ -n "$k" ] || continue
        case "$AUX_KEYS" in *" $k "*) continue ;; esac
        printf "[%s] services '%s' : cle inconnue '%s' ignoree\n" "$a" "$name" "$k"
      done < <(map_keys "$A_SERVICES" "$i")
    done
  done
}

show_warnings() {  # les affiche via warn(), sans jamais faire echouer
  local avert l
  avert=$(collect_warnings)
  [ -n "$avert" ] || return 0
  while IFS= read -r l; do
    [ -n "$l" ] || continue
    warn "$l"
  done <<<"$avert"
}

require_clean_manifests() {
  local probs l
  probs=$(collect_problems)
  [ -n "$probs" ] || return 0
  echo "ERREUR : manifestes invalides — aucun artefact n'a ete genere." >&2
  while IFS= read -r l; do printf '  %s\n' "$l" >&2; done <<<"$probs"
  exit 1
}

# Le scan des secrets, cote generation. Il porte sur les manifestes ET sur le
# compose TEL QU'IL SERA ECRIT — pas sur celui qui est deja sur le disque, qui
# est encore l'ancien : c'est le texte sortant du generateur qui doit etre
# propre. Rien n'est ecrit tant qu'il n'a pas repondu, ni compose.yaml ni les
# autres artefacts : un secret refuse ne laisse rien derriere lui.
require_no_secrets() {
  local fuites l
  fuites=$( { scan_manifests; emit_compose | scan_secrets 'compose.yaml (genere)'; } )
  [ -n "$fuites" ] || return 0
  echo "ERREUR : valeur ressemblant a un secret — aucun artefact n'a ete genere." >&2
  while IFS= read -r l; do printf '  %s\n' "$l" >&2; done <<<"$fuites"
  exit 1
}

# LSP par langage. STACK_CANON dedoublonne les alias : go et golang sont la meme
# stack, un sort -u naif poserait deux fois gopls-lsp.
#
# LSP_INSTALL sert au setup script cloud : l'image de base fournit les
# compilateurs, jamais les serveurs de langage. Sans cette ligne le plugin est
# installe mais inerte. Vide = pas d'installation en une commande fiable a
# travers l'allowlist reseau ; le setup script genere pose alors un TODO.
lsp_for() {
  case "$1" in
    none)                STACK_CANON=none;       LSP=""; LSP_BIN=""; LSP_INSTALL="" ;;
    typescript|ts|node)  STACK_CANON=typescript; LSP=typescript-lsp;    LSP_BIN=typescript-language-server
                         LSP_INSTALL='npm install -g typescript-language-server typescript' ;;
    python|py)           STACK_CANON=python;     LSP=pyright-lsp;       LSP_BIN=pyright-langserver
                         LSP_INSTALL='npm install -g pyright' ;;
    go|golang)           STACK_CANON=go;         LSP=gopls-lsp;         LSP_BIN=gopls
                         LSP_INSTALL='PATH="/usr/local/go/bin:$PATH" GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@latest' ;;
    rust)                STACK_CANON=rust;       LSP=rust-analyzer-lsp; LSP_BIN=rust-analyzer
                         LSP_INSTALL='rustup component add rust-analyzer' ;;
    java)                STACK_CANON=java;       LSP=jdtls-lsp;         LSP_BIN=jdtls;         LSP_INSTALL="" ;;
    kotlin)              STACK_CANON=kotlin;     LSP=kotlin-lsp;        LSP_BIN=kotlin-language-server; LSP_INSTALL="" ;;
    php)                 STACK_CANON=php;        LSP=php-lsp;           LSP_BIN=intelephense
                         LSP_INSTALL='npm install -g intelephense' ;;
    csharp|dotnet)       STACK_CANON=csharp;     LSP=csharp-lsp;        LSP_BIN=csharp-ls;     LSP_INSTALL="" ;;
    swift)               STACK_CANON=swift;      LSP=swift-lsp;         LSP_BIN=sourcekit-lsp; LSP_INSTALL="" ;;
    c|cpp|c++)           STACK_CANON=cpp;        LSP=clangd-lsp;        LSP_BIN=clangd
                         LSP_INSTALL='apt-get install -y clangd' ;;
    lua)                 STACK_CANON=lua;        LSP=lua-lsp;           LSP_BIN=lua-language-server;    LSP_INSTALL="" ;;
    *) echo "ERREUR : stack inconnue : $1" >&2
       echo "Valeurs : none typescript python go rust java kotlin php csharp swift cpp lua" >&2
       exit 1 ;;
  esac
}

# --- outillage de l'agent : union des langages de toutes les apps ---------------
#
# .claude/settings.json est un reglage de PROJET : il n'existe qu'a la racine.
# L'outillage est donc l'union de ce que demandent les apps — y compris les apps
# desactivees, dont il faut bien pouvoir ecrire le code.

PLUGIN_IDS=() LSP_BINS=() LSP_TRIPLETS=() UI_ANY=false

compute_tooling() {
  local a seen=" " triplet
  PLUGIN_IDS=(
    superpowers@claude-plugins-official        # brainstorming, TDD, debug, plans
    mattpocock-skills@claude-plugins-official  # tdd, code-review, domain-modeling
    code-review@claude-plugins-official
    code-simplifier@claude-plugins-official
    commit-commands@claude-plugins-official    # commit, push, PR
    security-guidance@claude-plugins-official  # revue vulnerabilites a chaque edition
    context7@claude-plugins-official           # doc a jour des bibliotheques (MCP)
    github@claude-plugins-official             # PR, Actions, GHCR (MCP)
  )
  LSP_BINS=() LSP_TRIPLETS=() UI_ANY=false
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_UI" = true ] && UI_ANY=true
    lsp_for "$A_STACK"
    [ -n "$LSP" ] || continue
    case "$seen" in *" $STACK_CANON "*) continue ;; esac
    seen="$seen$STACK_CANON "
    PLUGIN_IDS+=("$LSP@claude-plugins-official")
    LSP_BINS+=("$LSP_BIN")
    LSP_TRIPLETS+=("$LSP:$LSP_BIN:$STACK_CANON")
  done
  if [ "$UI_ANY" = true ]; then
    PLUGIN_IDS+=(
      frontend-design@claude-plugins-official
      playwright@claude-plugins-official       # pilotage navigateur, E2E (MCP)
      impeccable@impeccable                    # finition visuelle — marketplace tierce
    )
  fi
}

# --- gabarits -------------------------------------------------------------------
#
# render remplace des marqueurs __CLE__ dans un gabarit lu sur l'entree standard.
# Les gabarits sont ainsi cites (<<'EOF'), ce qui evite d'echapper un a un les
# ${{ }} de GitHub Actions et les $ des scripts generes — la source d'erreur la
# plus courante de ce fichier.
render() {
  local t r; t=$(cat)
  while [ $# -gt 1 ]; do
    # Depuis bash 5.2, « & » dans le remplacement de ${var//motif/rempl} rappelle
    # le texte matche, comme dans sed : sans protection, un « 2>&1 » du fragment
    # injecte devient « 2>__CLE__1 » et le script genere ne s'analyse meme plus.
    # Le backslash est protege d'abord, sinon il mangerait le suivant.
    #
    # Mais AVANT 5.2 ce rappel n'existe pas : le « \ » y reste litteral et produit
    # « 2>\&1 \& ». Echapper inconditionnellement casse donc .claude/cloud-setup.sh
    # sur tout bash <= 5.1 (Ubuntu 22.04 : 5.1.16) — constate, et refuse ensuite
    # par ./init.sh --check. D'ou le test de version.
    r=$2
    if [ "${BASH_VERSINFO[0]}" -gt 5 ] \
       || { [ "${BASH_VERSINFO[0]}" -eq 5 ] && [ "${BASH_VERSINFO[1]}" -ge 2 ]; }; then
      r=${r//\\/\\\\}
      r=${r//&/\\&}
    fi
    t="${t//$1/$r}"
    shift 2
  done
  printf '%s\n' "$t"
}

json_argv() {  # json_argv --mode worker -> ["--mode", "worker"] — forme exec
  local out="" sep="" x
  for x in "$@"; do
    x=${x//\\/\\\\}; x=${x//\"/\\\"}
    out="$out$sep\"$x\""; sep=", "
  done
  printf '[%s]' "$out"
}

emit_volumes() {  # emit_volumes <proprietaire> <specs, une par ligne>
  local owner="$1" specs="$2" v first=1
  [ -n "$specs" ] || return 0
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    check_volume "$owner" "$v" || { echo "ERREUR : $owner — $VERR" >&2; exit 1; }
    if [ "$first" = 1 ]; then printf '    volumes:\n'; first=0; fi
    printf '      - %s\n' "$VOL_SPEC"
  done <<<"$specs"
}

# Tous les volumes nommes references par le compose, dans l'ordre d'emission et
# dedoublonnes. Sert au bloc volumes: de premier niveau, que la Compose Spec
# exige : un volume monte mais non declare la n'est PAS reinterprete en bind
# mount — Compose refuse le projet entier a la validation (« refers to undefined
# volume ... : invalid compose project »), avant qu'un conteneur ne demarre, et
# le « compose up » de toute la stack s'arrete la. Les apps desactivees n'y
# figurent pas, puisque leurs services ne sont pas emis.
collect_volume_names() {
  local a n i name v
  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    load_app "$a"
    [ "$A_ENABLED" = true ] || continue
    for v in "${A_VOLUMES[@]-}"; do
      [ -n "$v" ] || continue
      check_volume "$a" "$v" && printf '%s\n' "$VOL_NAME"
    done
    n=$(map_count "$A_SERVICES")
    for (( i = 0; i < n; i++ )); do
      name=$(map_one "$A_SERVICES" "$i" name)
      [ -n "$name" ] || continue
      while IFS= read -r v; do
        [ -n "$v" ] || continue
        check_volume "$a" "$v" && printf '%s\n' "$VOL_NAME"
      done < <(map_all "$A_SERVICES" "$i" volumes)
    done
  done
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] || continue
    while IFS= read -r v; do
      [ -n "$v" ] || continue
      check_volume "$name" "$v" && printf '%s\n' "$VOL_NAME"
    done < <(map_all "$SHARED_RECORDS" "$i" volumes)
  done
}

emit_env() {  # emit_env <noms, un par ligne>
  local specs="$1" e first=1
  [ -n "$specs" ] || return 0
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    check_env_name "$e" || { echo "ERREUR : $VERR" >&2; exit 1; }
    if [ "$first" = 1 ]; then printf '    environment:\n'; first=0; fi
    # La valeur vient de l'environnement du serveur, jamais du depot. Le defaut
    # vide evite qu'un nom non defini cote hote fasse echouer le compose entier.
    printf '      - %s=${%s:-}\n' "$e" "$e"
  done <<<"$specs"
}

# Bloc commun aux services annexes et aux services partages : meme forme, meme
# journalisation bornee, meme reseau — et UN SEUL label, « traefik.enable=false ».
# C'est ce label, et non l'absence de label, qui retire du routage : avec
# exposedByDefault, le DEFAUT de Traefik, un conteneur sans le moindre label
# recoit quand meme un routeur, donc une URL, et sans authentification. Un
# service non route n'a pas d'URL parce qu'il porte ce label ; il est alors
# joignable de ses seuls voisins du reseau, par son nom de service.
aux_block() {  # aux_block <service> <proprietaire> <image> <memoire> <argv, un par ligne> <volumes> <env> <legende>
  local svc="$1" owner="$2" image="$3" mem="$4" cmd="$5" vols="$6" envs="$7" legend="$8"
  cat <<YAML

  # >>> $svc — $legend
  $svc:
    image: $image
    container_name: $svc
    restart: unless-stopped
    mem_limit: $mem
    # Le tag est souvent mutable : sans ce reglage, un redeploiement relance
    # l'image locale deja presente et sert silencieusement la version d'avant.
    pull_policy: always
    # Service NON ROUTE : aucune URL, aucun middleware a oublier. Il vit sur
    # $NETWORK, ou ses voisins le joignent par « $svc ». Aucun port publie non
    # plus. Ce n'est PAS l'absence de label qui l'en retire — voir « labels: »
    # plus bas, qui est la seule chose a le faire.
    logging:
      driver: json-file
      options:
        max-size: "$LOG_MAX_SIZE"
        max-file: "$LOG_MAX_FILE"
    networks: [$NETWORK]
    # LE label qui compte sur un service non route : c'est le seul qui RETIRE du
    # routage. Sans lui, exposedByDefault suffit a creer un routeur sans
    # authentification, et un LABEL traefik.* grave dans l'image publierait une
    # route que ce fichier ne peut pas ecraser. Inoffensif si le serveur pose
    # deja exposedByDefault: false, indispensable sinon.
    labels:
      - "traefik.enable=false"
YAML
  # La commande arrive deja decoupee, un argument par ligne : c'est la forme qui
  # survit indifferemment a un scalaire et a une liste YAML. Elle n'a pas de
  # validation propre — c'est le scan du compose PRODUIT, avant ecriture, qui
  # refuse un secret, quelle que soit la syntaxe par laquelle il est arrive.
  local -a argv=()
  # Process substitution, pas un here-string : « <<<"$cmd" » ajoute
  # INCONDITIONNELLEMENT un retour a la ligne final, ce qui compte pour un
  # element vide de plus quand $cmd se termine deja par une chaine vide
  # explicite (« --save "" ») — l'element manquant devient un element en trop.
  [ -z "$cmd" ] || mapfile -t argv < <(printf '%s' "$cmd")
  if [ "${#argv[@]}" -gt 0 ]; then
    printf '    command: %s\n' "$(json_argv "${argv[@]}")"
  fi
  emit_volumes "$owner" "$vols"
  emit_env "$envs"
  printf '  # <<< %s\n' "$svc"
}

aux_services_block() {  # services annexes de l'app chargee par load_app
  local n i name image mem cmd
  n=$(map_count "$A_SERVICES")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$A_SERVICES" "$i" name)
    [ -n "$name" ] || continue
    image=$(map_one "$A_SERVICES" "$i" image)
    mem=$(map_one "$A_SERVICES" "$i" memory); mem=${mem:-128m}
    cmd_argv "$A_SERVICES" "$i"
    # « printf -v », pas « cmd=$(printf ...) » : la substitution de commande
    # retire TOUS les retours a la ligne finaux, donc le dernier argument de
    # CMD_ARGV s'il est une chaine vide explicite (« --save "" ») — exactement
    # ce que ymaps prend soin d'emettre. « printf -v » assigne le texte produit
    # tel quel, sans cette troncature.
    cmd=""; [ "${#CMD_ARGV[@]}" -eq 0 ] || printf -v cmd '%s\n' "${CMD_ARGV[@]}"
    # Le proprietaire des volumes est l'APP, pas l'annexe : le service annexe
    # partage le sous-arbre de donnees de son application.
    aux_block "$APP-$name" "$APP" "$image" "$mem" "$cmd" \
      "$(map_all "$A_SERVICES" "$i" volumes)" \
      "$(map_all "$A_SERVICES" "$i" env)" \
      "service annexe de $APP — apps/$APP/app.yml"
  done
}

shared_services_block() {
  local n i name image mem cmd
  n=$(map_count "$SHARED_RECORDS")
  [ "$n" -gt 0 ] || return 0
  cat <<YAML

  # ===== services partages — fabrique.yml, cle shared_services =====
  # Un seul exemplaire pour toute la fabrique, joignable par son nom de service
  # depuis n'importe quelle app d'$NETWORK, et jamais route vers l'exterieur.
  # Une app declare sa dependance avec « needs: » dans son app.yml.
YAML
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] || continue
    image=$(map_one "$SHARED_RECORDS" "$i" image)
    mem=$(map_one "$SHARED_RECORDS" "$i" memory); mem=${mem:-128m}
    cmd_argv "$SHARED_RECORDS" "$i"
    cmd=""; [ "${#CMD_ARGV[@]}" -eq 0 ] || printf -v cmd '%s\n' "${CMD_ARGV[@]}"
    aux_block "$name" "$name" "$image" "$mem" "$cmd" \
      "$(map_all "$SHARED_RECORDS" "$i" volumes)" \
      "$(map_all "$SHARED_RECORDS" "$i" env)" \
      "service partage — fabrique.yml"
  done
}

service_block() {  # bloc de service de l'app chargee par load_app
  local health
  if [ "$A_HEALTH_CMD" = none ]; then
    health="    # healthcheck desactive (image sans shell)"
  else
    health="    healthcheck:
      test: [\"CMD-SHELL\", \"$A_HEALTH_CMD\"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s"
  fi
  cat <<YAML

  # >>> $APP — apps/$APP/app.yml — https://$APP.$DOMAIN
  $APP:
    image: $REGISTRY/$ORG/$REPO/$APP:main
    container_name: $APP
    restart: unless-stopped
    mem_limit: $A_MEMORY
    # Le tag :main est mutable : l'image locale portant ce nom est presque
    # toujours perimee. Sans ce reglage, un redeploiement relance l'image deja
    # presente et sert silencieusement la version precedente.
    pull_policy: always
    # Aucun port publie : Traefik joint le conteneur par le reseau $NETWORK.
$health
    # Journaux bornes : le disque du serveur est a 92 %, et la fabrique
    # multiplie les services. Un json-file non borne les remplirait.
    logging:
      driver: json-file
      options:
        max-size: "$LOG_MAX_SIZE"
        max-file: "$LOG_MAX_FILE"
    labels:
      # priority=100 est OBLIGATOIRE : un routeur catch-all capte tout
      # *.$DOMAIN par HostRegexp, et sa regle est plus longue que ce
      # Host(). Traefik departageant par longueur de regle, il gagnerait et
      # servirait un 404 silencieux.
      - "traefik.enable=true"
      - "traefik.http.routers.$APP.rule=Host(\`$APP.$DOMAIN\`)"
      - "traefik.http.routers.$APP.entrypoints=$ENTRYPOINT"
      - "traefik.http.routers.$APP.priority=100"
$A_MW_NOTE
      - "traefik.http.routers.$APP.middlewares=$A_MW,$SECURITY_HEADERS"
      - "traefik.http.routers.$APP.tls.certresolver=$CERT_RESOLVER"
      - "traefik.http.services.$APP.loadbalancer.server.port=$A_PORT"
      - "traefik.docker.network=$NETWORK"
    networks: [$NETWORK]
YAML
  # Les trois sections optionnelles, dans cet ordre. Toutes absentes — le cas de
  # toute app qui ignore leur existence — n'ecrivent pas une ligne : le bloc
  # ci-dessus se referme alors exactement comme avant.
  emit_volumes "$APP" "$(printf '%s\n' "${A_VOLUMES[@]-}")"
  emit_env "$(printf '%s\n' "${A_ENV[@]-}")"
  local d needs="" sep=""
  for d in "${A_NEEDS[@]-}"; do
    [ -n "$d" ] || continue
    shared_exists "$d" || {
      echo "ERREUR : $APP — needs: '$d' ne correspond a aucun shared_services de fabrique.yml." >&2; exit 1; }
    needs="$needs$sep$d"; sep=", "
  done
  if [ -n "$needs" ]; then
    printf '    # Services partages dont cette app depend (needs: dans app.yml).\n'
    printf '    depends_on: [%s]\n' "$needs"
  fi
  printf '  # <<< %s\n' "$APP"
}

disabled_note() {
  cat <<YAML

  # >>> $APP — DESACTIVEE (enabled: false dans apps/$APP/app.yml)
  # Aucun service n'est emis. La stack est unique : referencer une image qui
  # n'existe pas encore ferait echouer le « compose up » de TOUTES les apps.
  # Publie l'image d'abord, passe enabled a true ensuite.
  # <<< $APP
YAML
}

emit_compose() {
  # L'en-tete ne decrit QUE ce que ce fichier contient. Un paragraphe qui annonce
  # « trois sortes de services » a un compose qui n'en porte qu'une, ou qui affirme
  # que traefik.enable=false « est pose sur chaque service non route ci-dessous »
  # quand il n'y a pas un seul service non route, fait de l'explication elle-meme
  # une source d'erreur : on cherche dans le fichier ce que le fichier n'a pas, et
  # on finit par douter de ce qu'il dit d'exact. Ces paragraphes sont donc
  # conditionnes, comme l'est deja le bloc volumes: de premier niveau.
  local a n_aux=0 n_partages=0 n_non_routes=0 vols titre
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_ENABLED" = true ] || continue
    n_aux=$(( n_aux + $(map_count "$A_SERVICES") ))
  done
  n_partages=$(map_count "$SHARED_RECORDS")
  n_non_routes=$(( n_aux + n_partages ))
  vols=$(collect_volume_names | awk '!vu[$0]++')

  cat <<YAML
# Genere par init.sh depuis fabrique.yml et apps/*/app.yml.
# NE PAS EDITER — ./init.sh --check refuse un compose desynchronise.
#
# Une seule stack dockhand. Le rayon de souffle est commun : une erreur dans un
# bloc fait echouer le deploiement de toute la fabrique.
YAML

  if [ "$n_non_routes" -gt 0 ]; then
    titre="DEUX SORTES DE SERVICES cohabitent"
    if [ "$n_aux" -gt 0 ] && [ "$n_partages" -gt 0 ]; then
      titre="TROIS SORTES DE SERVICES cohabitent"
    fi
    cat <<YAML
#
# $titre ici, dans un espace de noms plat, et UNE
# SEULE EST ROUTEE :
#
#   <app>          l'application elle-meme, decrite par apps/<app>/app.yml.
#                  Seule sorte a porter des labels de ROUTAGE : un routeur, une
#                  URL https://<app>.$DOMAIN, un middleware
#                  d'authentification Google et priority=100.
YAML
    if [ "$n_aux" -gt 0 ]; then
      cat <<YAML
#   <app>-<nom>    service annexe prive d'une application (section services:
#                  de son app.yml). Un seul label : traefik.enable=false.
YAML
    fi
    if [ "$n_partages" -gt 0 ]; then
      cat <<YAML
#   <nom>          service partage par plusieurs applications (shared_services
#                  dans fabrique.yml). Le meme unique label.
YAML
    fi
    cat <<YAML
#
# Toutes vivent sur le meme reseau $NETWORK et se joignent entre elles par
# leur nom de service ; aucune ne publie de port sur l'hote. Ce qui expose un
# service a Internet, ce sont ses labels Traefik, pas le reseau — mais l'absence
# de label n'est PAS une protection : avec exposedByDefault, qui est le DEFAUT,
# un conteneur sans le moindre label recoit quand meme un routeur, donc une URL,
# et sans middleware d'authentification. Seul traefik.enable=false l'en retire ;
# c'est pourquoi il est pose sur chaque service non route ci-dessous.
YAML
  else
    cat <<YAML
#
# CE FICHIER NE PORTE QUE DES SERVICES D'APPLICATION, decrits par leur
# apps/<app>/app.yml, et TOUS SONT ROUTES : chacun porte ses labels de ROUTAGE —
# un routeur, une URL https://<app>.$DOMAIN, un middleware
# d'authentification Google et priority=100. Ils vivent sur le reseau $NETWORK
# et se joignent entre eux par leur nom de service ; aucun ne publie de port
# sur l'hote.
#
# Deux autres sortes apparaitront ici des qu'un manifeste les declarera :
# <app>-<nom>, annexe privee d'une app (section services: de son app.yml), et
# <nom>, service partage (shared_services dans fabrique.yml). Elles ne sont pas
# routees, et init.sh leur pose alors « traefik.enable=false » — c'est ce label,
# et non l'absence de label, qui retire du routage : avec exposedByDefault, qui
# est le DEFAUT de Traefik, un conteneur sans le moindre label recoit quand meme
# un routeur, donc une URL, et sans authentification. Aucune n'est declaree a ce
# jour : aucun service de ce fichier ne porte donc ce label, et c'est correct.
YAML
  fi

  if [ -n "$vols" ]; then
    cat <<YAML
#
# Les points de montage sont des VOLUMES NOMMES Docker, jamais des bind mounts.
# Un volume s'appelle <proprietaire>-<nom> — le proprietaire etant l'app ou le
# service partage qui le declare — et « docker compose up » le cree tout seul :
# aucune action prealable sur l'hote, pour aucune app, jamais. Au premier
# montage, Docker recopie dans le volume vide le contenu du repertoire tel qu'il
# existe dans l'IMAGE : C'EST DONC LE DOCKERFILE QUI FIXE LE PROPRIETAIRE. Une
# app en non-root doit creer son repertoire et le chown AVANT sa directive
# USER, sinon le volume appartient a root et elle ne peut pas y ecrire.
YAML
  fi

  cat <<YAML
services:
YAML
  for a in "${APPS[@]}"; do
    load_app "$a"
    if [ "$A_ENABLED" = true ]; then service_block; aux_services_block; else disabled_note; fi
  done
  shared_services_block

  # Bloc de premier niveau : chaque volume monte plus haut doit etre declare ici.
  # Il est OMIS entierement si aucun service n'en monte — une app sans volume
  # produit alors le meme compose qu'avant l'existence de cette section.
  if [ -n "$vols" ]; then
    cat <<YAML

# Volumes nommes montes par les services ci-dessus. Docker les cree au premier
# « compose up » et les conserve entre deux deploiements. Leur contenu initial,
# proprietaire compris, est celui du repertoire dans l'image : rien n'est a
# preparer sur l'hote, mais le Dockerfile doit chown le chemin avant son USER.
#
# « name: » est OBLIGATOIRE sous chaque entree. Sans lui, Compose prefixe le nom
# du projet et le volume REEL s'appelle <projet>_<nom> : une sauvegarde lancee
# sur le nom court monterait alors un volume que Docker viendrait de creer VIDE,
# tar archiverait un repertoire vide et la commande sortirait en 0. La stack
# etant unique, le prefixe de projet n'apporte rien — on le retire, et le nom
# reel redevient egal au nom documente.
volumes:
YAML
    local v
    while IFS= read -r v; do
      [ -n "$v" ] || continue
      printf '  %s:\n    name: %s\n' "$v" "$v"
    done <<<"$vols"
  fi

  cat <<YAML

networks:
  $NETWORK:
    external: true
YAML
}

emit_gowork() {
  local a uses=""
  for a in "${APPS[@]}"; do
    [ -f "apps/$a/go.mod" ] || continue
    uses="$uses
use ./apps/$a"
  done
  [ -n "$uses" ] || return 1
  cat <<EOF
// Genere par init.sh — les apps Go de la fabrique.
// Sans ce fichier, gopls ouvert a la racine du depot ne voit aucun module :
// chaque app est un module distinct sous apps/. Il ne sert qu'a l'outillage
// local, les constructions Docker ayant pour contexte apps/<nom>.
//
// Le directif go: EST a trois composants (1.24.0), pas deux (1.24). Un
// go.mod d'app tidyfie par un Go >= 1.21 s'ecrit lui-meme en trois composants
// (« go 1.24.0 » + une ligne « toolchain »), et le mode workspace refuse alors
// un go.work a deux composants avec « requires go >= 1.24.0, but go.work
// lists go 1.24 » — deux ecritures numeriquement egales que le composant
// workspace du toolchain compare comme inegales. Un go.work a trois
// composants reste accepte par les app.mod a deux composants (verifie), donc
// cette forme est la seule qui satisfasse les deux a la fois.
go 1.24.0
$uses
EOF
}



# --- artefacts derives ----------------------------------------------------------

emit() {  # emit <chemin> — ecrit sur stdout l'artefact attendu pour ce chemin
  case "$1" in
    compose.yaml) emit_compose ;;
    go.work)      emit_gowork ;;
  esac
}

DERIVES=(compose.yaml go.work)

# --- --add ----------------------------------------------------------------------

scaffold_app() {
  local a="$1" dir="apps/$1"
  valid_name "$a" || exit 1
  if [ "$DRYRUN" = 1 ]; then
    warn "--dry-run : $dir/ n'est pas echafaude (app.yml, .dockerignore, test.sh, README.md, PRODUCT.md seraient crees)"
    # Une app neuve nait desactivee : l'echafaudage ecrit « enabled: false ». Le
    # meme defaut est pose ici, sans quoi l'apercu ferait entrer dans le compose
    # une app dont l'image n'existe pas — l'inverse de ce que la commande fait.
    [ -n "${SET[enabled]+x}" ] || SET[enabled]=false
    PHANTOM_APP="$a"
    return 0
  fi
  # Teste la presence d'app.yml, pas celle du repertoire : c'est la meme
  # definition d'« application » que discover_apps. Un repertoire qui ne
  # contient que des documents (prp/, PRD) n'est pas encore une application,
  # et --add doit pouvoir l'echafauder sans --force — sans quoi la sequence
  # que le contrat lui-meme recommande, PRP ecrits avant le code, oblige a
  # invoquer une option qui promet d'ecraser un travail qu'elle ne trouvera
  # jamais.
  if [ -f "$dir/app.yml" ] && [ "$FORCE" = 0 ]; then
    echo "ERREUR : $dir/app.yml existe deja (--force pour reecrire les fichiers d'echafaudage)." >&2
    exit 1
  fi
  mkdir -p "$dir"

  # Une app neuve nait desactivee : son image n'existe pas encore, et la stack
  # etant unique, la referencer ferait echouer le deploiement de toutes.
  local port memory health_path health_cmd exposure stack ui enabled
  port=$(app_get "$a" port 8080)
  memory=$(app_get "$a" memory 128m)
  health_path=$(app_get "$a" health_path /healthz)
  exposure=$(app_get "$a" exposure private)
  health_cmd=$(app_get "$a" health_cmd "wget --spider -q http://localhost:$port$health_path")
  stack=$(app_get "$a" stack none)
  ui=$(app_get "$a" ui false)
  enabled=$(app_get "$a" enabled false)

  cat > "$dir/app.yml" <<YAML
# Parametres de deploiement de $a.
# Le nom de l'app — donc son URL — est celui du repertoire : apps/$a/
# Ce fichier n'est JAMAIS reecrit par init.sh : edite-le, puis relance ./init.sh
#
# enabled: false = l'app vit dans le depot mais n'entre pas dans compose.yaml.
# Passe-le a true une fois sa premiere image publiee sur le registre.
enabled: $enabled
port: $port
memory: $memory
health_path: $health_path
health_cmd: $health_cmd
exposure: $exposure          # private | google | public — voir CLAUDE.md
# Outillage de l'agent, sans effet sur le deploiement :
stack: $stack
ui: $ui

# --- Quatre sections OPTIONNELLES. Absentes, elles n'ecrivent pas une ligne
# --- dans compose.yaml. Decommente celles dont tu as besoin.

# Volumes NOMMES Docker : <nom>:<chemin conteneur>[:ro]
# <nom> est le nom LOGIQUE du volume, pas un chemin ni un sous-repertoire : il
# doit correspondre a ^[a-z0-9][a-z0-9-]*\$. Le volume reel s'appelle
# « $a-<nom> » — celui ci-dessous serait « $a-donnees » — et
# « docker compose up » le cree tout seul : rien a preparer sur l'hote. Les bind
# mounts sont refuses : un repertoire hote absent serait cree EN ROOT et l'app,
# qui tourne en non-root, ne pourrait pas y ecrire. Seul suffixe admis : :ro
#
# ATTENTION — le proprietaire du volume vient de ton Dockerfile : au premier
# montage, Docker recopie dans le volume vide le repertoire tel qu'il existe
# dans l'IMAGE. Cree-le et donne-le a ton utilisateur AVANT la directive USER :
#   RUN mkdir -p /var/lib/$a && chown 10001:10001 /var/lib/$a
# volumes:
#   - donnees:/var/lib/$a
#   - cache:/var/cache/$a:ro

# NOMS des variables d'environnement a passer depuis l'hote. JAMAIS de valeurs :
# un element contenant un « = » est refuse a la generation. L'infrastructure
# injecte la valeur cote serveur ; declare le nom attendu dans le README.
# env: [LASTFM_API_KEY]

# Services partages de la fabrique dont cette app depend (shared_services dans
# fabrique.yml). Verifie a la generation : un nom non declare la-bas est une
# erreur, pas une panne au demarrage. Emet un depends_on sur ce service.
# needs: [redis]

# Services annexes propres a cette application. Chacun devient le service
# « $a-<name> », non route : init.sh lui pose « traefik.enable=false », le seul
# label qui RETIRE du routage, et il n'a donc pas d'URL — seuls ses voisins du
# reseau le joignent, par ce nom. « name » et « image » sont obligatoires ;
# « memory » (defaut 128m), « command », « volumes » et « env » sont libres.
# « command » n'a pas de validation propre : c'est le compose PRODUIT, plus ce
# fichier-ci, que init.sh scanne avant d'ecrire. Une cle qui evoque un secret
# suivie d'une valeur litterale arrete la generation, quelle que soit la syntaxe
# par laquelle elle arrive. Ecris « \${NOM} » — le NOM va dans env: — ou le
# CHEMIN d'un secret monte en fichier.
# Ses volumes portent le nom de l'APP, pas le sien : « donnees:/data » ici monte
# le meme volume « $a-donnees » que la section volumes: ci-dessus. C'est ainsi
# qu'un worker partage les donnees de son service principal.
# services:
#   - name: worker
#     image: $REGISTRY/$ORG/$REPO/$a:main
#     memory: 64m
#     command: --mode worker
YAML
  ok "$dir/app.yml"

  cat > "$dir/.dockerignore" <<EOF
# Genere par init.sh — le contexte de construction est ce repertoire, pas la
# racine du depot. Exclure la doc fige le cache de couches sur les seules
# modifications de code.
.git
*.md
app.yml
test.sh
.dockerignore
$a
node_modules
dist
build
target
__pycache__
.env
.env.*
*.log
EOF
  ok "$dir/.dockerignore"

  cat > "$dir/test.sh" <<'EOF'
#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
# A toi d'y mettre la commande de test de ta technologie.
set -euo pipefail
cd "$(dirname "$0")"

echo "TODO : aucun test declare pour cette application."
EOF
  chmod +x "$dir/test.sh"
  ok "$dir/test.sh"

  cat > "$dir/README.md" <<EOF
# $a

URL : https://$a.$DOMAIN — palier d'exposition : \`$exposure\`.

## Ce que fait cette application

TODO.

## Developpement

TODO : comment la lancer localement.

## Variables d'environnement

Aucun secret n'est attendu. Declare ici les noms des variables injectees par
l'infrastructure, jamais leurs valeurs.
EOF
  ok "$dir/README.md"

  cat > "$dir/PRODUCT.md" <<EOF
# Product — $a

## Users

TODO : qui s'en sert, et dans quelle situation.

## Product Purpose

TODO : a quelle question cette application repond.

## Capabilities and Constraints

TODO : ce qu'elle fait, ce qu'elle ne fait pas.

## Product Principles

TODO.
EOF
  ok "$dir/PRODUCT.md"

  cat <<EOF

apps/$a echafaude. Il te reste a ecrire :

  1. Le code, ecoutant sur le port $port en HTTP clair.
  2. GET $health_path renvoyant 200 quand l'app est prete a servir.
  3. apps/$a/Dockerfile — multi-etapes, USER non root, image < $IMAGE_MAX_MB Mo.
  4. La commande de test dans apps/$a/test.sh.

Puis, dans cet ordre — construire d'abord, brancher ensuite :

  ./init.sh --check
  git add apps/$a compose.yaml .github .gitignore .claude go.work
  git commit                        # commit 1 : la CI publie l'image
  ./init.sh --app $a --enable       # une fois l'image publiee
  git add apps/$a/app.yml compose.yaml && git commit   # commit 2 : le deploiement

Le commit 1 emporte les artefacts regeneres : --add vient de reecrire
compose.yaml, le workflow et .gitignore — plus .claude/ si le langage ou ui:
est nouveau, et go.work des que le module Go existe. N'ajouter que apps/$a
fait echouer le job « contrat » sur « compose.yaml desynchronise ».

Le healthcheck appellera : $health_cmd
Assure-toi que cet outil existe dans l'image finale, sinon le conteneur sera
declare malsain en permanence. Image sans shell : --health-cmd none.
EOF
}

# --- mise a jour ciblee d'un app.yml --------------------------------------------

set_key() {  # set_key <fichier> <cle> <valeur> — preserve commentaires et ordre
  local f="$1" k="$2" v="$3"
  if grep -qE "^$k:" "$f"; then
    local tmp; tmp=$(mktemp)
    awk -v k="$k" -v v="$v" '
      $0 ~ "^" k ":" && !done { print k ": " v; done=1; next } { print }
    ' "$f" > "$tmp" && mv "$tmp" "$f"
  else
    printf '%s: %s\n' "$k" "$v" >> "$f"
  fi
}

# --dry-run doit tenir sa promesse ICI aussi : app.yml est la source de verite,
# et l'ecrire est le seul geste de ce script qui ne se regenere pas. On montre
# donc ce qui changerait, sans toucher au fichier. Les artefacts derives affiches
# ensuite refletent bien les valeurs demandees : app_get lit SET avant le fichier.
apply_target_options() {
  [ -n "$TARGET" ] || return 0
  [ ${#SET[@]} -gt 0 ] || return 0
  local f="apps/$TARGET/app.yml" k cur tmp fuites l
  if [ ! -f "$f" ]; then
    [ "$DRYRUN" = 1 ] && { warn "$f n'existe pas — rien a modifier (--dry-run)"; return 0; }
    echo "ERREUR : $f introuvable — ./init.sh --add $TARGET" >&2; exit 1
  fi
  # Le manifeste QUI SERAIT ECRIT passe la porte AVANT de l'etre. Refuser plus
  # loin serait une ligne trop tard : la valeur serait deja dans un fichier suivi
  # par git, et le ok() ci-dessous l'aurait affichee. On applique donc les
  # options a une COPIE — memes lignes, donc memes numeros de ligne dans le
  # message — et on scanne celle-la. --dry-run compris : un apercu ne doit pas
  # etaler la valeur qu'une generation refuserait.
  tmp=$(mktemp); cp "$f" "$tmp"
  for k in "${!SET[@]}"; do set_key "$tmp" "$k" "${SET[$k]}"; done
  fuites=$(scan_secrets "$f" < "$tmp"); rm -f "$tmp"
  if [ -n "$fuites" ]; then
    echo "ERREUR : valeur ressemblant a un secret — $f n'a pas ete modifie, aucun artefact n'a ete genere." >&2
    while IFS= read -r l; do printf '  %s\n' "$l" >&2; done <<<"$fuites"
    exit 1
  fi
  for k in "${!SET[@]}"; do
    if [ "$DRYRUN" = 1 ]; then
      cur=$(yget "$f" "$k" "")
      if [ "$cur" = "${SET[$k]}" ]; then
        ok "$f : $k = ${SET[$k]} (deja cette valeur)"
      else
        warn "$f : $k passerait de '${cur:-absent}' a '${SET[$k]}' — --dry-run n'ecrit rien"
      fi
      continue
    fi
    set_key "$f" "$k" "${SET[$k]}"
    ok "apps/$TARGET/app.yml : $k = ${SET[$k]}"
  done
}

# --- services partages : lus une fois, pour tous les modes -----------------------

load_shared
# --- la branche de travail ------------------------------------------------------
#
# Convention : <app>/<sujet>, ou fabrique/<sujet> pour ce qui touche init.sh, la
# CI, le contrat ou l'outillage. Le prefixe dit quel perimetre est en jeu — donc
# quel rayon de souffle — avant meme d'ouvrir le diff.
#
# Une exception, subie et non choisie : le harnais cloud assigne des branches
# claude/<sujet>. Voir la validation plus bas.

BASE=$(fab base_branch main)
PREFIXE_HARNAIS=claude

apps_touchees() {  # les apps modifiees depuis la base, travail non committe inclus
  {
    git diff --name-only "origin/$BASE...HEAD" 2>/dev/null || true
    git status --porcelain 2>/dev/null | cut -c4- || true
  } | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u \
    | while IFS= read -r a; do
        # Un if, et non « [ -f ... ] && printf » : sous set -e, un test faux
        # ferait sortir la boucle en code 1, donc la substitution de commande,
        # donc le script entier — et --pret s'arreterait sans rien dire.
        if [ -f "apps/$a/app.yml" ]; then printf '%s\n' "$a"; fi
      done
}

# --- le journal des anomalies ---------------------------------------------------
#
# Une entree par branche, ouverte avec elle et remplie au fil du travail. Ecrite
# a chaud, elle retient les anomalies mineures ; reconstituee a la fin, elle ne
# garde que les spectaculaires — or ce sont les mineures qui disent ou le
# contrat a un trou.
#
# La branche donne le nom du fichier, ce qui rend l'entree retrouvable sans
# index : fabrique/journal-des-anomalies -> journal/<date>-fabrique-journal-des-anomalies.md
# La date est figee a la creation, donc on retrouve par suffixe, jamais par date.

# Trois champs sont a vocabulaire ferme, parce que le lecteur du journal peut
# etre un agent qui en tire des plans d'amelioration : en prose libre, « moi »,
# « la critique impeccable » et « le compilateur » ne s'agregent pas, et la
# distribution que le journal promet n'est pas calculable. Constate sur les deux
# premieres entrees, ou treize valeurs ont donne six categories informelles —
# aucune conforme au gabarit qui les demandait.
#
# DETECTE est ordonne par cout croissant : plus une anomalie est rattrapee tard,
# plus elle a coute. L'agregat utile est « jusqu'ou la distribution glisse vers
# la droite », pas un simple decompte.
#
# MODE porte sur l'entree entiere, pas sur une anomalie. Il vaut « chaud » quand
# l'entree a ete remplie au fil du travail, « retrospective » quand elle a ete
# reconstituee apres coup — auquel cas les anomalies mineures manquent, et
# l'analyste doit s'interdire d'en tirer une mesure. Ce champ existe parce que
# cette consigne reposait sur une phrase en prose : le seul moyen de trouver les
# entrees concernees etait un grep sur « retrospectiv|reconstitu », qui matchait
# aussi le titre d'une anomalie *parlant* d'une reconstitution sans en etre une.
# Un vocabulaire suggere n'est pas un vocabulaire — la lecon de l'anomalie 4 de
# fabrique/journal-des-anomalies, rejouee un cran au-dessus.
#
# Les etiquettes de DETECTE et ACTION s'ecrivent sans accents — « Detecte par »,
# pas « Detecte par » accentue — comme tout le markdown genere par ce fichier. Le
# motif de verification reste ainsi en ASCII pur, insensible a la locale, et la
# prose accentuee vit dans Symptome et Cause qui ne sont pas verifies.
#
# PERIMETRE fait exception et porte ses accents : le gabarit l'emettait en ASCII,
# et les trois auteurs sur trois l'ont reecrit « Perimetre » accentue. Un
# vocabulaire que personne n'ecrit comme il est genere n'est pas tenable ; le
# gabarit suit donc l'usage. Le motif reste insensible a la locale parce qu'il
# compare des octets litteraux, pas des classes de caracteres.

JOURNAL_DIR=journal
JOURNAL_MARQUEUR=REMPLIS-MOI   # present = gabarit nu ; retire = entree ecrite
JOURNAL_DETECTE='compilateur|test|CI|relecture|auteur|utilisateur|production'
JOURNAL_ACTION='rien|contrat|garde-fou|outillage|comportement|arbitrage'
JOURNAL_MODE='chaud|retrospective'
JOURNAL_PERIMETRE_VIDE='<apps touchees, ou fabrique>'   # le gabarit, tel quel

# Le vocabulaire ferme de « Tenu par », en-tete des fichiers de memory/. « rien »
# n'y figure pas volontairement : il est refuse, et le message d'aide le rappelle.
MEMORY_TENU='--check|CI|hook'

journal_slug() { printf '%s' "${1//\//-}"; }

journal_entree() {  # journal_entree <branche> — le chemin de l'entree, ou vide
  local m
  m=$(ls "$JOURNAL_DIR"/*-"$(journal_slug "$1")".md 2>/dev/null | head -1)
  printf '%s' "$m"
}

journal_ouvre() {  # journal_ouvre <branche> — cree l'entree si elle n'existe pas
  local br="$1" f
  f=$(journal_entree "$br")
  [ -n "$f" ] && { ok "journal : entree existante ($f)"; return 0; }

  mkdir -p "$JOURNAL_DIR"
  f="$JOURNAL_DIR/$(date -u +%Y-%m-%d)-$(journal_slug "$br").md"
  render __BRANCHE__ "$br" __DATE__ "$(date -u +%Y-%m-%d)" __MARQUEUR__ "$JOURNAL_MARQUEUR" \
         __PERIMETRE__ "$JOURNAL_PERIMETRE_VIDE" \
    > "$f" <<'MD'
# __DATE__ — __BRANCHE__

<!-- __MARQUEUR__ : retire ce commentaire quand l'entree dit quelque chose.

     Une anomalie par bloc, ecrite quand tu la rencontres.

     Deux champs sont a vocabulaire ferme et ./init.sh --check les verifie. Ce
     n'est pas de la bureaucratie : le lecteur de ce journal peut etre un agent
     qui en tire des plans d'amelioration, et « moi » ou « le compilateur » ne
     s'agregent pas. La prose va dans Symptome et Cause, qui sont libres.

     Detecte par — qui a rattrape l'anomalie, du moins cher au plus cher :

       compilateur   immediat, cout nul
       test          avant meme de lancer
       CI            avant la fusion
       relecture     humaine ou outillee, avant livraison
       auteur        en cours de travail, apres coup
       utilisateur   apres livraison : un aller-retour, et un garde-fou manquant
       production    apres deploiement

     Action — ce que l'anomalie devrait changer :

       rien          reparee, rien a en tirer
       contrat       CLAUDE.md dit quelque chose de faux, ou ne dit rien
       garde-fou     init.sh --check, --pret, ou un hook devrait le voir
       outillage     un plugin, un LSP, un agent manque
       comportement  facon de travailler, aucun artefact a changer
       arbitrage     demande une decision humaine, pas un correctif

     Une session sans anomalie est une entree valide — ecris « Aucune anomalie »
     et retire ce commentaire. Une entree vide et une entree jamais ouverte ne
     disent pas la meme chose.

     Deux champs d'en-tete sont verifies eux aussi :

     Perimetre — les apps touchees, ou « fabrique ». Sur une branche claude/*,
     dont le prefixe est impose par le harnais et ne dit rien du perimetre,
     c'est le SEUL endroit ou se lit le rayon de souffle. Remplis-le tot.

     Mode — `chaud` si cette entree est remplie au fil du travail, valeur par
     defaut et cas normal puisque --branche l'ouvre en meme temps que la
     branche ; `retrospective` si elle est reconstituee apres coup. Une entree
     retrospective ne garde que les anomalies spectaculaires : l'analyste la
     lit, mais s'interdit d'en tirer une mesure. Mentir ici ne coute rien a qui
     ecrit et fausse tout ce qui se calcule ensuite. -->

Branche : `__BRANCHE__`
Périmètre : __PERIMETRE__
Mode : `chaud`

## Anomalies

### 1. <ce qui a mal tourne, en une ligne>

**Symptome** — ce qui a ete observe.

**Cause** — ce qui l'a produit.

**Detecte par** — `auteur`

**Action** — `rien` — pourquoi, en une ligne.
MD
  ok "journal : entree ouverte ($f)"
}

# journal_entete <fichier> — verifie les deux champs d'en-tete de l'entree. Un
# bad par manquement, retour non nul si l'un cloche.
#
# Partage entre --check, qui ne juge que les entrees suivies par git, et --pret,
# qui juge celle de la branche courante alors qu'elle est encore non suivie : un
# controle qui ne vaudrait qu'en --check n'arriverait qu'apres le commit qu'il
# aurait du empecher.
journal_entete() {
  local e="$1" faute=0
  grep -qE "^Mode *: *\`($JOURNAL_MODE)\`" "$e" \
    || { bad "$e : champ 'Mode' absent ou hors vocabulaire — $JOURNAL_MODE"; faute=1; }
  grep -qF "$JOURNAL_PERIMETRE_VIDE" "$e" \
    && { bad "$e : 'Périmètre' est reste au gabarit — sur une branche claude/*, c'est le seul endroit ou se lit le rayon de souffle"; faute=1; }
  grep -qE '^Périmètre *: *[^[:space:]]' "$e" \
    || { bad "$e : champ 'Périmètre' absent"; faute=1; }
  return "$faute"
}

if [ -n "$BRANCHE" ]; then
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
  # nom. Le refuser rendait --branche inutilisable en session cloud, donc
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
  journal_ouvre "$BRANCHE"
  exit 0
fi

# --- --cout : ce que cette branche a consomme -----------------------------------
#
# La consommation d'une session ne vit PAS dans le depot : elle est ecrite au fil
# de l'echange dans le fichier de conversation du conteneur, sous
# ~/.claude/projects/<chemin-du-depot>/. Ce conteneur est ephemere, et rien ne
# recopie ce fichier avant qu'il disparaisse — d'ou cette commande, qui fige le
# chiffre dans l'entree de journal, seul endroit du depot qui appartienne a la
# branche. Un releve manque est un releve perdu : aucun outil ne le reconstitue.
#
# Deux multiplicateurs suffisent a passer des jetons a l'argent une fois le prix
# d'entree connu. Ils valent pour toute l'API, quel que soit le modele, et
# vivent donc ici plutot que dans fabrique.yml, ou seuls les tarifs par modele
# et le taux de change ont leur place.
COUT_CACHE_ECRITURE=1.25   # ecrire dans le cache coute 1,25x le prix d'entree
COUT_CACHE_LECTURE=0.10    # y lire coute 0,1x
COUT_TAUX_JOURS=90         # au-dela, le taux de change est signale comme vieux

COUT_DEBUT='<!-- cout : genere par ./init.sh --cout, ne pas editer a la main -->'
COUT_FIN='<!-- /cout -->'

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

cout_total_ecrit() {  # le total en jetons deja consigne dans <entree>, ou vide
  grep -o 'cout-total: [0-9]*' "$1" 2>/dev/null | head -1 | tr -dc '0-9' || true
}

cout_ecrit() {  # cout_ecrit <entree> <bloc> — remplace le bloc existant, ou l'ajoute
  local entree="$1" bloc="$2" tmp
  tmp=$(mktemp)
  awk -v d="$COUT_DEBUT" -v f="$COUT_FIN" '
    $0 == d { saute = 1 }
    saute != 1 { print }
    $0 == f { saute = 0 }
  ' "$entree" > "$tmp"
  # « $(cat) » retire les lignes vides de fin : le bloc se recolle toujours a la
  # meme distance du texte, qu'il remplace un bloc precedent ou non.
  printf '%s\n\n%s\n' "$(cat "$tmp")" "$bloc" > "$entree"
  rm -f "$tmp"
}

# cout_rappel <entree> — l'avertissement de --pret. Il AVERTIT sans bloquer :
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
    warn "cout : non releve — ./init.sh --cout l'ecrit dans l'entree (le chiffre disparait avec le conteneur)"
  elif [ "$((ecrit * 10))" -lt "$((actuel * 9))" ]; then
    warn "cout : releve a $(cout_nb "$ecrit") jetons, la conversation en compte $(cout_nb "$actuel") — relance ./init.sh --cout"
  fi
}

if [ "$COUT" = 1 ]; then
  courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
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
  virgule() { printf '%s' "${1//./,}"; }

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

  entree=""
  [ "$courante" != "$BASE" ] && entree=$(journal_entree "$courante")
  if [ -z "$entree" ]; then
    warn "aucune entree de journal pour '$courante' — releve affiche, pas ecrit"
    exit 0
  fi
  cout_ecrit "$entree" "$bloc"
  ok "cout ecrit dans $entree"
  exit 0
fi

# --- --pret : cette etape est-elle committable ? --------------------------------
#
# Le point de passage avant chaque commit. Un commit qui casse quelque chose
# rend la relecture plus dure, pas plus simple : c'est tout l'interet de
# committer par etapes verifiees plutot qu'au kilometre.

if [ "$PRET" = 1 ]; then
  courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  echo "Etape en cours — branche $courante"

  if [ "$courante" = "$BASE" ]; then
    bad "sur $BASE : le travail doit vivre sur une branche dediee (./init.sh --branche <app>/<sujet>)"
  else
    ok "branche dediee"
  fi

  if "$0" --check >/tmp/.pret-check.$$ 2>&1; then
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
      bad "journal : aucune entree pour $courante (./init.sh --branche $courante l'ouvre)"
    elif grep -q "$JOURNAL_MARQUEUR" "$entree"; then
      bad "journal : $entree est encore le gabarit nu — ecris-y les anomalies de cette branche"
    elif ! journal_entete "$entree"; then
      : # journal_entete a deja dit ce qui manque
    else
      ok "journal : $entree"
      cout_rappel "$entree"
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
  exit 0
fi

# --- --branches-fusionnees : ce qui peut partir, et ce qui ne le peut pas -------
#
# Une session cloud ouvre des branches et ne peut pas en fermer : le relais git
# du harnais refuse la suppression de refs (HTTP 403 sur git-receive-pack), et
# le serveur MCP GitHub expose create_branch sans son inverse. Les branches
# fusionnees s'accumulent donc sans que rien ne le signale. Cette commande ne
# supprime rien — elle n'en a pas le droit — elle dit QUOI supprimer, ce qui est
# la partie qu'on ne peut pas faire de tete.
#
# Le critere n'est pas l'appartenance a l'ascendance de la base : sur ce depot
# il s'est trompe dans les deux sens. Il a classe « non fusionnees » trois
# branches simplement ecrasees en un commit (squash), dont le contenu etait bel
# et bien dans main ; et il n'a rien dit d'une branche dont la PR etait fusionnee
# mais qui portait cinq commits ecrits APRES, jamais repris. C'est l'equivalence
# de patch — git cherry, qui compare les patch-id — qui repond juste dans les
# deux cas. Un commit de fusion n'a pas de patch-id et git cherry l'ignore :
# c'est correct, « merge branch main » n'apporte rien que main n'ait deja.

if [ "$FUSIONNEES" = 1 ]; then
  git fetch --prune origin "+refs/heads/*:refs/remotes/origin/*" >/dev/null 2>&1 \
    || warn "origin non joignable — l'etat ci-dessous peut etre perime"

  # La branche sur laquelle on travaille est exclue : elle peut etre fusionnee
  # et servir malgre tout a l'etape en cours — c'est le cas normal d'une session
  # cloud, dont le nom de branche est impose et reutilise d'une PR a la suivante.
  courante=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

  fusionnees=() vivantes=() ignoree=""
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
    b=${ref#origin/}
    [ "$b" = "$BASE" ] && continue
    [ "$b" = HEAD ] && continue
    [ "$b" = "$courante" ] && { ignoree="$b"; continue; }
    # git cherry n'imprime que les commits absents de la base : « + » pour un
    # patch inedit, « - » pour un patch deja present sous un autre sha.
    if [ -z "$(git cherry "origin/$BASE" "$ref" 2>/dev/null | grep '^+' || true)" ]; then
      fusionnees+=("$b")
    else
      vivantes+=("$b:$(git cherry "origin/$BASE" "$ref" 2>/dev/null | grep -c '^+' || echo '?')")
    fi
  done

  [ -n "$ignoree" ] && { echo "-- ignoree"; warn "$ignoree — branche courante"; echo; }
  echo "-- fusionnees dans $BASE — supprimables"
  if [ ${#fusionnees[@]} -eq 0 ]; then
    echo "  (aucune)"
  else
    for b in "${fusionnees[@]}"; do ok "$b"; done
  fi

  echo
  echo "-- a regarder — patchs absents de $BASE"
  if [ ${#vivantes[@]} -eq 0 ]; then
    echo "  (aucune)"
  else
    for v in "${vivantes[@]}"; do warn "${v%:*} — ${v##*:} patch(s) inedit(s)"; done
    echo
    # Le titre de cette section dit « a regarder » et non « non fusionnees »,
    # parce que l'equivalence de patch ne sait pas voir un contenu REECRIT. Un
    # travail repris a un autre chemin, ou refait a la main, produit un patch
    # different : la branche est signalee ici alors que son contenu est bien
    # dans la base. La commande ne peut pas trancher ce cas — elle le remonte
    # plutot que de proposer une suppression qu'elle ne sait pas justifier.
    echo "  Un patch inedit ne veut pas dire un travail perdu : un contenu repris"
    echo "  a un autre chemin, ou refait a la main, produit un patch different."
    echo "  Compare avant de conclure :  git log --oneline origin/$BASE..origin/<branche>"
  fi

  if [ ${#fusionnees[@]} -gt 0 ]; then
    echo
    echo "Depuis une machine dont l'acces git n'est pas contraint :"
    echo
    for b in "${fusionnees[@]}"; do echo "  git push origin --delete $b"; done
    echo
    echo "Une suppression ne perd rien : ces patchs sont dans $BASE, et GitHub"
    echo "sait restaurer une branche pendant 90 jours."
  fi
  exit 0
fi

# --- --list ---------------------------------------------------------------------

if [ "$LIST" = 1 ]; then
  discover_apps
  printf '%-24s %-6s %-7s %-9s %-12s %-4s %s\n' APP PORT MEMOIRE EXPOSURE STACK UI ETAT
  for a in "${APPS[@]}"; do
    load_app "$a"
    printf '%-24s %-6s %-7s %-9s %-12s %-4s %s\n' \
      "$APP" "$A_PORT" "$A_MEMORY" "$A_EXPOSURE" "$A_STACK" "$A_UI" \
      "$([ "$A_ENABLED" = true ] && echo active || echo desactivee)"
  done
  exit 0
fi

# --- --check --------------------------------------------------------------------

services_list() {  # noms de service declares dans le compose, dans l'ordre
  awk '
    /^services:[[:space:]]*$/ { s=1; next }
    /^[^[:space:]#]/          { s=0 }
    s && /^  [^[:space:]#]/   { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); print n }
  ' "$1"
}

service_yaml() {  # service_yaml <fichier> <nom> — le bloc du service
  awk -v want="$2" '
    /^services:[[:space:]]*$/ { ins=1; next }
    /^[^[:space:]#]/          { ins=0; cur=0 }
    !ins { next }
    /^  [^[:space:]#]/ { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); cur=(n==want); next }
    cur { print }
  ' "$1"
}

SANS_AUTH=() ROUTES_PARASITES=() ROUTAGE_OUVERT=() COMPOSE_VOL_REFS=()

compose_volumes_decl() {  # noms declares par le bloc volumes: de premier niveau
  awk '
    /^volumes:[[:space:]]*$/ { v=1; next }
    /^[^[:space:]#]/         { v=0 }
    v && /^  [^[:space:]#]/  { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); print n }
  ' "$1"
}

# Le nom REEL d'un volume declare au premier niveau, c'est-a-dire la valeur de sa
# cle « name: ». Absente, Compose prefixe le nom du projet et le nom reel n'est
# plus celui qu'on documente — une sauvegarde lancee sur le nom court monterait
# alors un volume vide tout juste cree et sortirait en 0.
compose_volume_realname() {  # compose_volume_realname <fichier> <nom declare>
  awk -v want="$2" '
    /^volumes:[[:space:]]*$/ { v=1; next }
    /^[^[:space:]#]/         { v=0; cur=0 }
    !v { next }
    /^  [^[:space:]#]/ { n=$0; sub(/^  /,"",n); sub(/:.*$/,"",n); cur=(n==want); next }
    cur && /^[[:space:]]*name:/ { s=$0; sub(/^[[:space:]]*name:[[:space:]]*/,"",s); print s; exit }
  ' "$1"
}

# Points de montage d'un bloc de service, verifies dans CE bloc — pas par un
# grep global sur le fichier, qui ne saurait pas a qui appartient la ligne.
# Deux choses, et elles ne sont pas de meme nature : la partie gauche doit etre
# un NOM de volume et non un chemin — un bind mount ici serait cree en root et
# rendrait le volume inaccessible a une app non-root — et ce nom doit vivre dans
# l'espace de nom de son proprietaire.
check_block_volumes() {  # check_block_volumes <service> <proprietaire> <bloc>
  local svc="$1" owner="$2" blk="$3" p="[$1]" v n=0 ko=0 name
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    n=$(( n + 1 ))
    name="${v%%:*}"
    case "$name" in
      */*|.|..|"")
        bad "$p BIND MOUNT dans le compose genere : '$v' — seuls les volumes nommes sont admis. Un repertoire hote absent serait cree EN ROOT et l'app, qui tourne en non-root, ne pourrait pas y ecrire."
        ko=1; continue ;;
    esac
    COMPOSE_VOL_REFS+=("$name")
    case "$name" in
      "$owner"-?*) ;;
      *) bad "$p volume '$name' hors de l'espace de nom de '$owner' — attendu '$owner-<nom>'"; ko=1 ;;
    esac
  done < <(awk '
      /^[[:space:]]*volumes:[[:space:]]*$/ { inv = 1; next }
      inv && /^[[:space:]]*-[[:space:]]/   { s = $0; sub(/^[[:space:]]*-[[:space:]]*/, "", s); print s; next }
      { inv = 0 }
    ' <<<"$blk")
  [ "$n" -eq 0 ] && return 0
  [ "$ko" -eq 0 ] && ok "$p $n volume(s) nomme(s), tous prefixes '$owner-'"
  return 0
}

# Un service annexe ou partage. Le controle qui compte est INVERSE de
# l'intuition : l'etat sain n'est pas « aucun label », c'est « traefik.enable=false ».
# Un conteneur sans le moindre label recoit un routeur des que exposedByDefault
# est actif — le defaut de Traefik — et Docker fusionne dans le conteneur les
# labels graves dans l'IMAGE, qu'aucune ligne du compose ne peut ecraser. Dans
# les deux cas la route est publiee sans middleware : c'est le meme accident que
# « SANS AUTHENTIFICATION CONFORME », vu de l'autre bout. Le label de retrait est
# donc obligatoire, et tout autre label traefik.* reste interdit.
check_aux_service() {  # check_aux_service <service> <proprietaire> <memoire> <sorte>
  local svc="$1" owner="$2" mem="$3" sorte="$4" p="[$1]" blk nocom autres
  blk=$(service_yaml "$COMPOSE" "$svc")
  if [ -z "$blk" ]; then bad "$p aucun service dans $COMPOSE — lance ./init.sh"; return; fi

  # Les commentaires du bloc parlent des labels : les lire comme des labels
  # ferait de l'explication elle-meme une erreur.
  nocom=$(grep -vE '^[[:space:]]*#' <<<"$blk" || true)

  if grep -qE '^[[:space:]]*-[[:space:]]*"?traefik\.enable=false"?[[:space:]]*$' <<<"$nocom"; then
    ok "$p traefik.enable=false ($sorte, retire du routage)"
  else
    bad "$p SANS traefik.enable=false ($sorte) — un service non route DOIT porter ce label : sans lui, exposedByDefault lui cree un routeur sans authentification, et un label grave dans l'image publierait une route que le compose n'ecrase pas"
    ROUTAGE_OUVERT+=("$svc")
  fi

  autres=$(grep -iE 'traefik\.' <<<"$nocom" | grep -vE '^[[:space:]]*-[[:space:]]*"?traefik\.enable=false"?[[:space:]]*$' || true)
  if [ -n "$autres" ]; then
    bad "$p LABEL TRAEFIK SUR UN SERVICE NON ROUTE ($sorte) — il publierait une URL sans authentification : $(printf '%s' "$autres" | tr -s ' \n' ' ')"
    ROUTES_PARASITES+=("$svc")
  else
    ok "$p aucun autre label traefik ($sorte, non route)"
  fi

  grep -qE '^[[:space:]]*ports:' <<<"$blk" \
    && bad "$p section ports: interdite — rien ne se publie sur l'hote" || ok "$p aucun port publie"
  grep -qF "$NETWORK" <<<"$blk"                && ok "$p sur $NETWORK"     || bad "$p absent du reseau $NETWORK"
  grep -qF "container_name: $svc" <<<"$blk"    && ok "$p container_name"   || bad "$p container_name absent ou different"
  grep -qF "mem_limit: $mem" <<<"$blk"         && ok "$p mem_limit"        || bad "$p mem_limit different du manifeste"
  grep -qF "restart: unless-stopped" <<<"$blk" && ok "$p restart"          || bad "$p restart absent"
  grep -qF "pull_policy: always" <<<"$blk"     && ok "$p pull_policy"      || bad "$p pull_policy absent — servirait l'image locale perimee"
  grep -qF "max-size:" <<<"$blk"               && ok "$p journaux bornes"  || bad "$p logging absent — journal non borne"
  check_block_volumes "$svc" "$owner" "$blk"
}

# Les services que compose.yaml doit contenir, les trois sortes confondues.
expected_services() {
  local a n i name
  for a in "${APPS[@]-}"; do
    [ -n "$a" ] || continue
    load_app "$a"
    [ "$A_ENABLED" = true ] || continue
    printf '%s\n' "$a"
    n=$(map_count "$A_SERVICES")
    for (( i = 0; i < n; i++ )); do
      name=$(map_one "$A_SERVICES" "$i" name)
      [ -n "$name" ] && printf '%s-%s\n' "$a" "$name"
    done
  done
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] && printf '%s\n' "$name"
  done
}

check_service() {
  load_app "$1"
  local p="[$APP]" blk
  blk=$(service_yaml "$COMPOSE" "$APP")
  if [ -z "$blk" ]; then bad "$p aucun service dans $COMPOSE"; return; fi
  has() { grep -qF -- "$1" <<<"$blk"; }

  # L'authentification d'abord, et ancree au nom du routeur. La virgule finale
  # est essentielle : sans elle « middlewares=forwardauth » matcherait
  # « middlewares=forwardauth-open,... » et une app declaree private passerait
  # au vert avec l'authentification ouverte a tout compte Google.
  if has "traefik.http.routers.$APP.middlewares=$A_MW,$SECURITY_HEADERS"; then
    ok "$p palier $A_EXPOSURE -> $A_MW"
  else
    bad "$p PALIER NON CONFORME — middleware $A_MW attendu (exposure $A_EXPOSURE)"
    SANS_AUTH+=("$APP")
  fi

  # Palier public : faute d'authentification, Traefik ne pose NI n'ecrase
  # X-Forwarded-User. L'en-tete passe donc sous le controle du client, qui peut
  # y mettre l'adresse de son choix : une app qui le lit croit identifier un
  # utilisateur en lisant une valeur forgee. Bloquant, pas cosmetique.
  # -i : Node, Go et consorts normalisent les en-tetes en minuscules.
  if [ "$A_EXPOSURE" = public ]; then
    warn "$p palier public — accessible SANS authentification"
    if git ls-files -z "apps/$APP" 2>/dev/null | grep -zvE '\.md$' \
         | xargs -0 -r grep -liI 'x-forwarded-user' 2>/dev/null | grep -q .; then
      bad "$p lit X-Forwarded-User en exposure public — en-tete forgeable par n'importe qui"
    else
      ok "$p aucune lecture de X-Forwarded-User"
    fi
  fi

  has "traefik.http.routers.$APP.priority=100"                      && ok "$p priority=100"          || bad "$p priority=100 absent — 404 silencieux garanti"
  has "traefik.http.routers.$APP.rule=Host(\`$APP.$DOMAIN\`)"       && ok "$p Host($APP.$DOMAIN)"    || bad "$p regle Host() absente ou fausse"
  has "traefik.http.services.$APP.loadbalancer.server.port=$A_PORT" && ok "$p server.port=$A_PORT"   || bad "$p server.port different de app.yml"
  has "traefik.http.routers.$APP.tls.certresolver=$CERT_RESOLVER"   && ok "$p certresolver"          || bad "$p certresolver absent — pas de TLS"
  has "traefik.enable=true"                                         && ok "$p routage active"        || bad "$p traefik.enable absent"
  has "traefik.docker.network=$NETWORK"                             && ok "$p reseau annonce"        || bad "$p traefik.docker.network absent"
  has "mem_limit: $A_MEMORY"                                        && ok "$p mem_limit"             || bad "$p mem_limit different de app.yml"
  has "container_name: $APP"                                        && ok "$p container_name"        || bad "$p container_name absent ou different du nom d'app"
  has "pull_policy: always"                                         && ok "$p pull_policy"           || bad "$p pull_policy absent — servirait l'image locale perimee"
  has "image: $REGISTRY/$ORG/$REPO/$APP:"                           && ok "$p image conforme"        || bad "$p image hors convention de nommage"
  has "max-size:"                                                   && ok "$p journaux bornes"       || bad "$p logging absent — journal non borne"
  grep -qE '^[[:space:]]*ports:' <<<"$blk" && bad "$p section ports: interdite — Traefik joint le conteneur par le reseau" || ok "$p aucun port publie"
  grep -qF "$NETWORK" <<<"$blk"            && ok "$p sur $NETWORK" || bad "$p absent du reseau $NETWORK"

  check_block_volumes "$APP" "$APP" "$blk"
  local d
  for d in "${A_NEEDS[@]-}"; do
    [ -n "$d" ] || continue
    if grep -qE "^[[:space:]]*depends_on:.*[][, ]$d[],]" <<<"$blk"; then
      ok "$p depends_on $d (needs:)"
    else
      bad "$p needs: $d n'apparait pas dans le depends_on du compose — lance ./init.sh"
    fi
  done

  # Les services annexes de cette app, un par un.
  local n i name mem
  n=$(map_count "$A_SERVICES")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$A_SERVICES" "$i" name)
    [ -n "$name" ] || continue
    mem=$(map_one "$A_SERVICES" "$i" memory); mem=${mem:-128m}
    check_aux_service "$APP-$name" "$APP" "$mem" "annexe de $APP"
  done
}

check_shared_services() {
  local n i name mem
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    name=$(map_one "$SHARED_RECORDS" "$i" name)
    [ -n "$name" ] || continue
    mem=$(map_one "$SHARED_RECORDS" "$i" memory); mem=${mem:-128m}
    check_aux_service "$name" "$name" "$mem" "partage"
  done
}

check_app_files() {
  load_app "$1"
  local p="[$APP]" d="apps/$APP"

  if [ -f "$d/Dockerfile" ]; then
    ok "$p Dockerfile"
    grep -qE '^[[:space:]]*USER[[:space:]]+' "$d/Dockerfile" \
      && ok "$p USER declare (non root)" || bad "$p Dockerfile sans USER : conteneur en root"
    grep -qiE '^[[:space:]]*FROM .* AS ' "$d/Dockerfile" \
      && ok "$p construction multi-etapes" || warn "$p pas de multi-etapes : surveille la taille"
    # Le routage vit dans le compose. Un LABEL traefik.* dans le Dockerfile
    # serait fusionne dans les labels du conteneur et publierait un routeur
    # SUPPLEMENTAIRE, que le compose ne peut pas ecraser puisqu'il porte un
    # autre nom : donc sans aucun middleware d'authentification.
    grep -qi 'traefik\.' "$d/Dockerfile" \
      && bad "$p LABEL traefik.* dans le Dockerfile — publierait une route SANS authentification" \
      || ok "$p aucun label traefik dans le Dockerfile"
    # Un volume nomme herite du proprietaire du repertoire TEL QU'IL EXISTE dans
    # l'image. Si le chemin monte n'y existe pas, Docker le cree en root, et une
    # app tournant en USER non root ne peut pas y ecrire : elle demarre, puis
    # perd tout, sans erreur claire. C'est le Dockerfile qui fixe ces droits,
    # avant USER — nulle part ailleurs. Avertissement et non refus : le chemin
    # peut etre prepare par une forme que ce grep ne reconnait pas.
    local c
    for c in "${A_VOL_CHEMINS[@]}"; do
      grep -qE "(mkdir|chown)[^\n]*$c" "$d/Dockerfile" \
        && ok "$p $c prepare dans le Dockerfile" \
        || warn "$p $c est monte mais n'est ni cree ni chown dans le Dockerfile — le volume naitrait en root, l'app non root ne pourrait pas y ecrire"
    done
    # une image sans shell ne peut pas executer un healthcheck CMD-SHELL
    if grep -qiE '^[[:space:]]*FROM .*(scratch|distroless)' "$d/Dockerfile" && [ "$A_HEALTH_CMD" != none ]; then
      bad "$p image sans shell (scratch/distroless) mais health_cmd defini — mets 'none' ou change de base"
    fi
    if [ "$A_HEALTH_CMD" != none ]; then
      local tool; tool=$(printf '%s' "$A_HEALTH_CMD" | awk '{print $1}')
      grep -q "$tool" "$d/Dockerfile" \
        && ok "$p $tool semble present dans l'image" \
        || warn "$p health_cmd utilise '$tool' : verifie qu'il existe dans l'image finale"
    fi
    # Le proprietaire d'un volume nomme vient de l'IMAGE : au premier montage,
    # Docker recopie dans le volume vide le repertoire tel qu'il existe dans
    # l'image, droits compris. Si le Dockerfile n'a pas cree ce repertoire et ne
    # l'a pas donne a l'utilisateur non root AVANT sa directive USER, le volume
    # appartient a root et l'app ne peut pas y ecrire. C'est un avertissement et
    # non une erreur — le chown peut prendre des formes que ce grep ne voit pas —
    # mais c'est le dernier moment ou le piege est encore rattrapable : apres, il
    # se manifeste en production par des donnees qui ne s'ecrivent pas.
    #
    # Les volumes de l'app, PLUS ceux de ses services annexes qui tournent sur
    # SON image : le conteneur qui les monte est alors construit par ce meme
    # Dockerfile, et le piege du proprietaire y est identique. Un volume declare
    # uniquement dans une annexe n'aurait sinon aucun filet.
    local vv vlist nsvc isvc simg seen=" "
    vlist=$(
      for vv in "${A_VOLUMES[@]-}"; do
        [ -n "$vv" ] || continue
        printf '%s\n' "$vv"
      done
      nsvc=$(map_count "$A_SERVICES")
      for (( isvc = 0; isvc < nsvc; isvc++ )); do
        simg=$(map_one "$A_SERVICES" "$isvc" image)
        # Les TROIS formes de reference a l'image de l'app : sans tag (« :latest »
        # implicite), « :tag » et « @sha256:... ». Exiger le deux-points laisserait
        # passer la premiere, et une annexe qui monte un volume de l'app sortirait
        # du filet sans qu'on lui dise pourquoi.
        case "$simg" in
          "$REGISTRY/$ORG/$REPO/$APP"|"$REGISTRY/$ORG/$REPO/$APP:"*|"$REGISTRY/$ORG/$REPO/$APP@"*)
            map_all "$A_SERVICES" "$isvc" volumes ;;
        esac
      done
    )
    while IFS= read -r vv; do
      [ -n "$vv" ] || continue
      check_volume "$APP" "$vv" || continue
      case "$seen" in *" $VOL_PATH "*) continue ;; esac
      seen="$seen$VOL_PATH "
      if grep -i 'chown' "$d/Dockerfile" | grep -qF -- "$VOL_PATH"; then
        ok "$p volume '$VOL_NAME' : $VOL_PATH est chown dans le Dockerfile"
      else
        warn "$p volume '$vv' : aucun chown de $VOL_PATH dans $d/Dockerfile — le volume nomme herite du proprietaire du repertoire dans l'image ; sans « mkdir -p $VOL_PATH && chown <uid>:<uid> $VOL_PATH » avant la directive USER, le volume appartiendra a root et l'app non-root ne pourra pas y ecrire"
      fi
    done <<<"$vlist"
  elif [ "$A_ENABLED" = true ]; then
    bad "$p $d/Dockerfile absent — l'app est activee mais rien ne peut la construire"
  else
    warn "$p pas encore de Dockerfile (app desactivee)"
  fi

  [ -x "$d/test.sh" ] && ok "$p test.sh executable" \
    || bad "$p $d/test.sh absent ou non executable — ses tests ne tourneront jamais"
  [ -f "$d/.dockerignore" ] && ok "$p .dockerignore" || warn "$p pas de .dockerignore : la doc casse le cache de build"
  [ -f "$d/PRODUCT.md" ]   && ok "$p PRODUCT.md"    || warn "$p pas de PRD"
}

if [ "$CHECK" = 1 ]; then
  discover_apps
  [ ${#APPS[@]} -gt 0 ] || { echo "ERREUR : aucune app sous apps/ — ./init.sh --add <nom>" >&2; exit 1; }
  compute_tooling

  APPS_ACTIVES=()
  for a in "${APPS[@]}"; do
    load_app "$a"
    [ "$A_ENABLED" = true ] && APPS_ACTIVES+=("$a")
  done

  echo "Verification — fabrique $ORG/$REPO : ${#APPS[@]} app(s), ${#APPS_ACTIVES[@]} activee(s), ${#SHARED_NAMES[@]} service(s) partage(s)"
  echo

  # 0. Les manifestes eux-memes. Ce controle vient en premier : si un app.yml
  # decrit un volume qui sort de sa racine ou un needs vers un service qui
  # n'existe pas, la generation ne peut pas aboutir, et comparer les artefacts
  # derives ne dirait que « desynchronise » — le vrai motif serait perdu.
  echo "-- manifestes"
  probs=$(collect_problems)
  nprobs=0
  if [ -n "$probs" ]; then
    while IFS= read -r l; do bad "$l"; nprobs=$(( nprobs + 1 )); done <<<"$probs"
  else
    ok "volumes, env, needs, noms de service : fabrique.yml et apps/*/app.yml conformes"
  fi
  # Ce qui n'est pas faux, mais ne fait pas ce que son auteur croit.
  show_warnings

  # 1. Reproductibilite : le fichier committe correspond-il aux manifestes ?
  # Ce controle-la est le seul capable de prouver que compose.yaml decrit bien
  # les apps/*/app.yml — aucune liste de grep ne le saura jamais.
  echo
  echo "-- artefacts derives"
  if [ "$nprobs" -gt 0 ]; then
    warn "comparaison sautee : les manifestes ci-dessus doivent d'abord etre corriges"
  else
  for f in "${DERIVES[@]}"; do
    if [ "$f" = go.work ] && ! emit go.work >/dev/null 2>&1; then
      [ -f go.work ] && bad "go.work present mais aucune app Go" || ok "go.work sans objet"
      continue
    fi
    if [ ! -f "$f" ]; then
      bad "$f absent — lance ./init.sh"
    elif diff -q <(emit "$f") "$f" >/dev/null 2>&1; then
      ok "$f a jour"
    else
      bad "$f desynchronise des manifestes — lance ./init.sh (--dry-run pour voir l'ecart)"
    fi
  done
  fi

  # Le workflow n'est plus compare a un generateur : il verifie a la place
  # deux proprietes qui, ensemble, prouvent qu'il lit fabrique.yml au run
  # plutot que de porter une copie figee. La premiere fait de --check un
  # verrou de CI et non un geste manuel ; sans elle, un workflow modifie
  # pourrait ne plus jamais appeler --check sans que rien ne le remarque.
  WORKFLOW=.github/workflows/build.yml
  if [ -f "$WORKFLOW" ]; then
    # Ancre sur une ligne qui EST un step, pas sur une prose de commentaire qui
    # citerait la commande : sans quoi ce controle se satisferait de son propre
    # texte d'explication et ne verifierait jamais rien.
    grep -qE '^\s*contrat:' "$WORKFLOW" && grep -qE '^\s*-?\s*run:\s*\./init\.sh --check\s*$' "$WORKFLOW" \
      && ok "$WORKFLOW : le job contrat lance ./init.sh --check" \
      || bad "$WORKFLOW : pas de job contrat qui lance ./init.sh --check"
    fige="$REGISTRY/$ORG/$REPO/"
    if grep -qF "$fige" "$WORKFLOW"; then
      bad "$WORKFLOW : '$fige' figee dans le fichier — un changement de fabrique.yml la rendrait fausse en silence"
    else
      ok "$WORKFLOW : aucune occurrence figee du registre, de l'org ou du depot"
    fi
  else
    bad "$WORKFLOW absent"
  fi

  # 2. Le compose, service par service — les trois sortes.
  echo
  echo "-- services"
  if [ ! -f "$COMPOSE" ]; then
    bad "$COMPOSE absent — lance ./init.sh"
  else
    for a in "${APPS_ACTIVES[@]}"; do check_service "$a"; done
    check_shared_services

    # Un doublon de cle YAML est legal et silencieux : la derniere gagne, la
    # premiere disparait du deploiement sans un mot.
    dup() { LC_ALL=C sort | uniq -d | grep -q .; }
    services_list "$COMPOSE" | dup \
      && bad "un nom de service apparait deux fois dans $COMPOSE" || ok "noms de service uniques"
    grep -o 'rule=Host(`[^`]*`)' "$COMPOSE" | dup \
      && bad "deux apps revendiquent le meme hostname — Traefik en servirait une au hasard" || ok "hostnames uniques"
    grep -hE '^[[:space:]]*container_name:' "$COMPOSE" | awk '{print $2}' | dup \
      && bad "container_name en double — docker compose up echouerait pour TOUTE la stack" || ok "container_name uniques"

    # Les ports, eux, n'ont pas a etre uniques : chaque app ecoute dans son
    # propre conteneur, aucun port n'est publie sur l'hote, et Traefik joint
    # chaque conteneur par son IP sur le reseau. Trois apps sur 8080 sont
    # parfaitement correctes — un controle d'unicite serait un faux positif.

    if diff <(expected_services | LC_ALL=C sort) \
            <(services_list "$COMPOSE" | LC_ALL=C sort) >/dev/null 2>&1; then
      ok "$COMPOSE couvre exactement les services attendus (apps activees, annexes, partages)"
    else
      bad "ecart entre les manifestes et les services de $COMPOSE — lance ./init.sh"
    fi

    # Le bloc volumes: de premier niveau doit declarer EXACTEMENT les volumes
    # montes par les services, ni plus ni moins. Un volume monte mais non
    # declare fait echouer le « compose up » de toute la stack ; un volume
    # declare mais monte par personne cree un volume orphelin sur l'hote et
    # signale surtout que le compose ne correspond plus aux manifestes.
    vdecl=$(compose_volumes_decl "$COMPOSE" | LC_ALL=C sort -u)
    vref=$(printf '%s\n' "${COMPOSE_VOL_REFS[@]-}" | grep -v '^$' | LC_ALL=C sort -u || true)
    if [ "$vdecl" = "$vref" ]; then
      if [ -z "$vref" ]; then
        ok "aucun volume monte, aucun bloc volumes: de premier niveau"
      else
        ok "bloc volumes: de premier niveau — $(printf '%s\n' "$vref" | wc -l | tr -d ' ') volume(s), exactement ceux montes par les services"
        # Le nom documente doit etre le nom REEL. Sans « name: », Compose
        # prefixe le nom de projet : « docker compose --project-name mastack
        # config » rend alors {"ramure-donnees": {"name": "mastack_ramure-donnees"}},
        # et la commande de sauvegarde documentee monte un volume vide que Docker
        # vient de creer — tar archive un repertoire vide et SORT EN 0.
        for v in $vref; do
          reel=$(compose_volume_realname "$COMPOSE" "$v")
          if [ "$reel" = "$v" ]; then
            ok "volume '$v' : name: $v — le nom reel est le nom documente"
          elif [ -z "$reel" ]; then
            bad "volume '$v' : cle name: absente du bloc de premier niveau — Compose prefixerait le nom de projet, le volume reel s'appellerait <projet>_$v et une sauvegarde lancee sur '$v' archiverait un volume vide en sortant en 0"
          else
            bad "volume '$v' : name: $reel — le nom reel differe du nom declare"
          fi
        done
      fi
    else
      for v in $(comm -13 <(printf '%s\n' "$vdecl") <(printf '%s\n' "$vref")); do
        bad "volume '$v' monte par un service mais absent du bloc volumes: de premier niveau — Compose refuserait le projet ENTIER a la validation (« refers to undefined volume $v : invalid compose project »), avant tout demarrage : le « compose up » de TOUTE la stack echouerait"
      done
      for v in $(comm -23 <(printf '%s\n' "$vdecl") <(printf '%s\n' "$vref")); do
        bad "volume '$v' declare au premier niveau mais monte par aucun service — lance ./init.sh"
      done
    fi

    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose -f "$COMPOSE" config -q >/dev/null 2>&1 \
        && ok "$COMPOSE valide pour docker compose" || bad "$COMPOSE invalide pour docker compose"
    fi
  fi

  # 3. Les fichiers de chaque app.
  echo
  echo "-- applications"
  for a in "${APPS[@]}"; do check_app_files "$a"; done
  check_volume_noms
  ok "noms de volumes distincts entre apps"

  # 4. Memoire engagee. La stack est unique : tout demarre d'un coup, et un
  # depassement fait tuer un voisin par l'OOM killer.
  echo
  echo "-- fabrique"
  # Les trois sortes comptent : un Redis partage et un worker annexe occupent la
  # meme RAM qu'une app, et l'OOM killer ne fait pas la difference.
  total=0 nserv=0
  for a in "${APPS_ACTIVES[@]-}"; do
    [ -n "$a" ] || continue
    load_app "$a"
    total=$(( total + $(mem_to_mb "$A_MEMORY") )); nserv=$(( nserv + 1 ))
    n=$(map_count "$A_SERVICES")
    for (( i = 0; i < n; i++ )); do
      m=$(map_one "$A_SERVICES" "$i" memory)
      total=$(( total + $(mem_to_mb "${m:-128m}") )); nserv=$(( nserv + 1 ))
    done
  done
  n=$(map_count "$SHARED_RECORDS")
  for (( i = 0; i < n; i++ )); do
    m=$(map_one "$SHARED_RECORDS" "$i" memory)
    total=$(( total + $(mem_to_mb "${m:-128m}") )); nserv=$(( nserv + 1 ))
  done
  cap=$(mem_to_mb "$MEMORY_BUDGET")
  if [ "$total" -le "$cap" ]; then
    ok "memoire engagee ${total} Mo / ${cap} Mo sur ${nserv} service(s), les trois sortes comprises"
  else
    warn "memoire engagee ${total} Mo sur ${nserv} service(s), au-dela du plafond ${cap} Mo de fabrique.yml — verifie la RAM du serveur"
  fi

  # Un fichier de routage oublie a cote reste une seconde source de verite, que
  # ./init.sh ne regenere plus : il divergera en silence.
  [ -f "$LEGACY_COMPOSE" ] && bad "$LEGACY_COMPOSE encore present — dockhand ne le lit pas, supprime-le" \
                           || ok "aucun $LEGACY_COMPOSE residuel"
  [ -f .dockerignore ] && bad ".dockerignore a la racine — sans effet avec context: apps/<nom>, supprime-le" \
                       || ok "aucun .dockerignore racine residuel"
  [ -f fabrique.yml ] && ok "fabrique.yml present" || bad "fabrique.yml absent — lance ./init.sh"

  # Un lien vers un fichier disparu est le symptome le plus courant d'une
  # reorganisation incomplete — le risque propre a une fabrique qui deplace des
  # applications. Boucle `for` et non tube : bad() doit rester dans ce shell.
  morts=0
  for src in README.md CLAUDE.md PRODUCT.md memory/*.md apps/*/*.md journal/*.md; do
    [ -f "$src" ] || continue
    for cible in $(grep -oE '\]\([^)#:]+\.md\)' "$src" | sed -E 's/^\]\((.*)\)$/\1/'); do
      [ -f "$(dirname "$src")/$cible" ] || { bad "lien mort : $src -> $cible"; morts=$((morts+1)); }
    done
  done
  [ "$morts" -eq 0 ] && ok "aucun lien mort entre les documents"

  # Deux sections de meme titre dans un meme document sont deux sources de
  # verite sur le meme sujet : le lecteur tombe sur l'une et ignore l'autre,
  # rien ne les tient d'accord, et elles divergent. CLAUDE.md a porte « Les
  # volumes nommes » en double pendant plusieurs fusions, chaque exemplaire
  # ayant fini par contenir un fait que l'autre n'avait pas. Le diff d'une PR ne
  # le montre pas : deux blocs ajoutes a 400 lignes d'ecart ne se ressemblent
  # pas, et le controle de liens morts, seul a lire ces fichiers, ne regardait
  # que les liens.
  #
  # Seul le niveau 2 est verifie. Un sous-titre repete sous deux parents
  # differents est legitime — apps/hello-world/DESIGN.md porte quatre
  # « Named Rules », une par famille — alors que deux chapitres de meme nom dans
  # un meme document ne le sont jamais. Comparaison sur la ligne entiere, octet
  # a octet : pas de normalisation, donc pas de faux positif sur la casse ou les
  # accents.
  doublons=0
  for src in README.md CLAUDE.md PRODUCT.md memory/*.md apps/*/*.md journal/*.md; do
    [ -f "$src" ] || continue
    while IFS= read -r titre; do
      [ -n "$titre" ] || continue
      bad "titre de section en double : $src -> $titre"
      doublons=$((doublons+1))
    done < <(grep -E '^## ' "$src" | LC_ALL=C sort | LC_ALL=C uniq -d)
  done
  [ "$doublons" -eq 0 ] && ok "aucun titre de section en double"

  # Une PRD ou un README d'app n'a qu'un domicile : apps/<nom>/PRODUCT.md ou
  # apps/<nom>/README.md. Un exemplaire identique ailleurs dans le depot a
  # echappe a l'arborescence -- le cas reel : un agent redigeant un plan a
  # copie-colle le PRD d'une app existante dans docs/ au lieu d'y renvoyer,
  # au lieu de lire le fichier a sa place. Comparaison octet a octet (cmp -s),
  # aucune dependance nouvelle. Les autres apps/ sont hors perimetre : deux
  # apps peuvent legitimement partager un PRD a leur amorçage, ce n'est pas ce
  # qu'on detecte ici.
  evades=0
  for canon in apps/*/PRODUCT.md apps/*/README.md; do
    [ -f "$canon" ] || continue
    while IFS= read -r autre; do
      [ -n "$autre" ] || continue
      [ "$autre" = "$canon" ] && continue
      case "$autre" in apps/*) continue ;; esac
      cmp -s "$canon" "$autre" \
        && { bad "$autre est un doublon exact de $canon — un domicile par app, renvoie plutot vers ce fichier"; evades=$((evades+1)); }
    done < <(git ls-files '*.md')
  done
  [ "$evades" -eq 0 ] && ok "aucun PRODUCT.md ou README.md d'app duplique hors de son repertoire"

  # Les fichiers de memory/ portent l'explication des regles que --check tient
  # deja. « Quand lire » les rend utilisables sans etre lus en entier, et « Tenu
  # par » est le critere de sortie rendu executable : une regle que rien ne
  # rattrape n'a pas le droit de quitter le contrat, sinon l'alleger revient a la
  # perdre. C'est le seul controle du depot qui refuse une valeur *correcte* —
  # « rien » est un aveu, pas une faute de frappe.
  if [ -d memory ]; then
    fautes=0 nb=0
    for m in memory/*.md; do
      [ -f "$m" ] || continue
      nb=$((nb+1))
      grep -qE '^Quand lire *: *[^[:space:]]' "$m" \
        || { bad "$m : ligne 'Quand lire :' absente ou vide — le sommaire ne saura pas quand l'ouvrir"; fautes=$((fautes+1)); }
      if grep -qE '^Tenu par *: *`?rien`?([[:space:]]|$)' "$m"; then
        bad "$m : 'Tenu par : rien' — une regle que rien ne rattrape reste dans CLAUDE.md"
        fautes=$((fautes+1))
      elif ! grep -qE "^Tenu par *: *($MEMORY_TENU)" "$m"; then
        bad "$m : champ 'Tenu par' absent ou hors vocabulaire — $MEMORY_TENU|rien"
        fautes=$((fautes+1))
      fi
    done
    [ "$fautes" -eq 0 ] && ok "$nb fichier(s) memory/ : en-tete complet, chaque sujet tenu par un controle"

    # Le sommaire est la seule partie de memory/ chargee en permanence : s'il
    # ment, un sujet devient invisible — un fichier absent du sommaire ne sera
    # jamais ouvert, un fichier promis et absent envoie chercher une page qui
    # n'existe pas. Meme exigence que le bloc volumes: de premier niveau du
    # compose : il declare EXACTEMENT ce qui existe. Seules les lignes de
    # tableau comptent (ancrees sur '|') : une mention en prose n'est pas une
    # entree de sommaire.
    ecart=0
    cites=$(grep -E '^\|' CLAUDE.md | grep -oE 'memory/[a-z0-9-]+\.md' | LC_ALL=C sort -u)
    reels=$(cd memory && ls *.md 2>/dev/null | sed 's#^#memory/#' | LC_ALL=C sort -u)
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      printf '%s\n' "$cites" | grep -qxF "$f" \
        || { bad "sommaire : $f existe mais n'est pas dans le sommaire de CLAUDE.md — il ne sera jamais ouvert"; ecart=$((ecart+1)); }
    done <<<"$reels"
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$f" ] \
        || { bad "sommaire : CLAUDE.md annonce $f, qui n'existe pas"; ecart=$((ecart+1)); }
    done <<<"$cites"
    [ "$ecart" -eq 0 ] && ok "sommaire du contrat : exactement les $(printf '%s\n' "$reels" | grep -c .) fichier(s) de memory/"
  else
    warn "aucun memory/ — le contrat porte tout"
  fi

  # Le contrat a grossi jusqu'a 750 lignes parce que rien ne bornait sa taille :
  # chaque anomalie rattrapee y ajoutait un paragraphe, aucun ne le quittait.
  # Avertissement et non KO — un contrat a 260 lignes n'est pas un defaut de
  # deploiement — mais la derive doit se voir a chaque --check, sinon elle
  # recommence.
  if [ -f CLAUDE.md ]; then
    cl=$(grep -c '' CLAUDE.md)
    [ "$cl" -le "$CLAUDE_MAX_LIGNES" ] \
      && ok "CLAUDE.md $cl lignes / $CLAUDE_MAX_LIGNES" \
      || warn "CLAUDE.md $cl lignes, au-dela de $CLAUDE_MAX_LIGNES — sors un sujet dans memory/ plutot que d'elargir le contrat"
  fi

  # 5. Outillage de l'agent.
  echo
  echo "-- outillage"
  if [ -f .claude/settings.json ]; then
    if command -v python3 >/dev/null && ! python3 -m json.tool .claude/settings.json >/dev/null 2>&1; then
      bad ".claude/settings.json n'est pas du JSON valide"
    else
      ok ".claude/settings.json present (${#PLUGIN_IDS[@]} plugins)"
    fi
    # Un settings.json versionne qui porterait un bloc env exposerait ses valeurs
    # a quiconque clone le depot : c'est la voie la plus courante de fuite de jeton.
    grep -q '"env"' .claude/settings.json \
      && bad "bloc \"env\" dans .claude/settings.json versionne — n'y mets jamais de secret" \
      || ok "aucun bloc env dans le settings versionne"
    # settings.json n'est plus regenere a chaque app.yml touchant stack/ui :
    # avertit, sans bloquer, quand un plugin attendu par les apps courantes n'y
    # figure pas — le meme principe deja applique a cloud-setup.sh plus bas.
    manque=0
    for p in "${PLUGIN_IDS[@]}"; do
      grep -qF "\"$p\":" .claude/settings.json || manque=$((manque+1))
    done
    [ "$manque" -eq 0 ] && ok "settings.json : ${#PLUGIN_IDS[@]} plugin(s) attendu(s), tous declares" \
                        || warn "settings.json : $manque plugin(s) attendu(s) absent(s) — une app declare un stack ou un ui sans son plugin"
  else
    bad ".claude/settings.json absent — c'est un fichier ordinaire desormais : recree-le a la main"
  fi
  [ -x .claude/check-plugins.sh ] && ok "rapport d'outillage executable" \
                                  || bad ".claude/check-plugins.sh absent ou non executable"
  for h in .claude/garde-branche.sh .claude/garde-commit.sh; do
    [ -x "$h" ] && ok "$h executable" || bad "$h absent ou non executable"
  done
  for f in .claude/agents/analyste.md .claude/agents/greffier.md \
           .github/pull_request_template.md; do
    [ -f "$f" ] && ok "$f present" || bad "$f absent"
  done

  # Les scripts generes le sont par substitution de fragments : une erreur du
  # generateur produit un fichier plausible mais inanalysable, qui echouerait
  # silencieusement au demarrage d'une session cloud. bash -n le voit tout de
  # suite, et coute une milliseconde.
  for s in .claude/check-plugins.sh .claude/cloud-setup.sh .claude/garde-*.sh apps/*/test.sh; do
    [ -f "$s" ] || continue
    bash -n "$s" 2>/dev/null && ok "$s analysable" || bad "$s : erreur de syntaxe shell"
  done

  # Le setup script vit dans l'environnement cloud, hors du depot : rien ne le
  # resynchronise. Signale l'ecart, faute de pouvoir le corriger d'ici.
  if [ -f .claude/cloud-setup.sh ]; then
    drift=0
    for p in "${PLUGIN_IDS[@]}"; do grep -qF "$p" .claude/cloud-setup.sh || drift=1; done
    for b in "${LSP_BINS[@]-}"; do [ -z "$b" ] || grep -qF "$b" .claude/cloud-setup.sh || drift=1; done
    [ "$drift" = 0 ] && ok "cloud-setup.sh aligne sur ${#PLUGIN_IDS[@]} plugins et ${#LSP_BINS[@]} LSP" \
                     || warn "cloud-setup.sh desynchronise — ./init.sh, puis recolle-le sur claude.ai/code"
    # Sans cette ligne le setup script tourne, sort en 0, et n'installe rien :
    # avant le premier lancement de Claude Code aucune marketplace n'existe.
    grep -qF 'marketplace add anthropics/claude-plugins-official' .claude/cloud-setup.sh \
      && ok "cloud-setup.sh declare la marketplace officielle" \
      || bad "cloud-setup.sh n'enregistre pas anthropics/claude-plugins-official — il echouerait en silence"
    [ "${#LSP_BINS[@]}" -le 3 ] || warn "${#LSP_BINS[@]} serveurs LSP a installer — le budget de 5 minutes du setup script devient douteux"
  else
    bad ".claude/cloud-setup.sh absent — les plugins resteraient inertes en session cloud"
  fi

  # 6. Journal des anomalies. Une entree suivie par git est une entree livree :
  # elle doit dire quelque chose. Une entree non suivie est un travail en cours,
  # et ne se juge pas — c'est ce qui laisse --check vert entre l'ouverture de la
  # branche et le premier commit, sans rien relacher en CI, ou tout est suivi.
  echo
  echo "-- journal"
  if [ -d "$JOURNAL_DIR" ]; then
    mauvaises=0 total=0 anomalies=0
    for e in "$JOURNAL_DIR"/[0-9]*.md; do
      [ -f "$e" ] || continue
      git ls-files --error-unmatch "$e" >/dev/null 2>&1 || continue
      total=$((total+1))
      faute=0
      grep -q "$JOURNAL_MARQUEUR" "$e" && { bad "$e : gabarit nu committe"; faute=1; }
      grep -q '^## Anomalies' "$e" || { bad "$e : section '## Anomalies' absente"; faute=1; }
      journal_entete "$e" || faute=1

      # Chaque anomalie doit porter ses deux champs fermes. Compter les titres et
      # les champs valides suffit : un jeton hors vocabulaire ne matche pas, donc
      # le compte tombe — pas besoin d'analyser le document.
      n=$(grep -c '^### ' "$e" || true)
      d=$(grep -cE "^\*\*Detecte par\*\* — \`($JOURNAL_DETECTE)\`" "$e" || true)
      a=$(grep -cE "^\*\*Action\*\* — \`($JOURNAL_ACTION)\`" "$e" || true)
      [ "$d" -eq "$n" ] || { bad "$e : $d/$n champ(s) 'Detecte par' valide(s) — $JOURNAL_DETECTE"; faute=1; }
      [ "$a" -eq "$n" ] || { bad "$e : $a/$n champ(s) 'Action' valide(s) — $JOURNAL_ACTION"; faute=1; }

      anomalies=$((anomalies+n))
      [ "$faute" = 0 ] || mauvaises=$((mauvaises+1))
    done
    [ "$mauvaises" -eq 0 ] && ok "$total entree(s), $anomalies anomalie(s), champs agregeables"
  else
    warn "aucun journal/ — la premiere ./init.sh --branche l'ouvrira"
  fi

  # 7. Secrets. Les motifs de jeton sont ecrits avec une classe d'un seul
  # caractere — gh[p]_ — pour que ce script, lui-meme suivi par git, ne se
  # detecte pas comme fuite a chaque lancement.
  echo
  echo "-- secrets"
  # Le meme scan qu'a la generation, sur les memes fichiers — mais ici sur le
  # compose PRODUIT, celui qui est sur le disque et que git suit. Un compose
  # edite a la main est donc couvert lui aussi, alors meme que la generation ne
  # l'a jamais vu.
  # « ; true » n'est pas decoratif : sans lui, un compose.yaml absent fait rendre
  # 1 a la substitution, et set -e arrete --check ici meme — au milieu du
  # rapport, sans total et sans les trois bandeaux rouges de la fin.
  fuites=$( { scan_manifests; [ -f "$COMPOSE" ] && scan_secrets "$COMPOSE" < "$COMPOSE"; true; } )
  if [ -n "$fuites" ]; then
    while IFS= read -r l; do [ -n "$l" ] && bad "$l"; done <<<"$fuites"
  else
    ok "aucune valeur litterale sur une cle qui evoque un secret — $COMPOSE, fabrique.yml, apps/*/app.yml"
  fi
  if git ls-files -z 2>/dev/null | xargs -0 -r grep -lIE \
       '(gh[p]_|github_pa[t]_|xox[baprs]-|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)' \
       2>/dev/null | grep -q .; then
    bad "secret potentiel dans un fichier suivi"
  else
    ok "aucun secret evident dans les fichiers suivis"
  fi

  echo
  if [ ${#SANS_AUTH[@]} -gt 0 ]; then
    printf '\033[41;97m  %d APPLICATION(S) AU PALIER NON CONFORME  \033[0m\n' "${#SANS_AUTH[@]}"
    for a in "${SANS_AUTH[@]}"; do printf '    %s -> https://%s.%s\n' "$a" "$a" "$DOMAIN"; done
    echo "  Le compose ne pose pas le middleware declare dans app.yml. Ne pousse pas."
    echo
  fi
  if [ ${#ROUTAGE_OUVERT[@]} -gt 0 ]; then
    printf '\033[41;97m  %d SERVICE(S) NON ROUTE(S) SANS traefik.enable=false  \033[0m\n' "${#ROUTAGE_OUVERT[@]}"
    for a in "${ROUTAGE_OUVERT[@]}"; do printf '    %s\n' "$a"; done
    echo "  Ce n'est pas l'absence de label qui retire un service du routage : avec"
    echo "  exposedByDefault — le defaut de Traefik — un conteneur sans label recoit"
    echo "  un routeur, donc une URL, et sans middleware d'authentification. Un seul"
    echo "  label la retire : traefik.enable=false. Lance ./init.sh. Ne pousse pas."
    echo
  fi
  if [ ${#ROUTES_PARASITES[@]} -gt 0 ]; then
    printf '\033[41;97m  %d SERVICE(S) NON ROUTE(S) PORTANT DES LABELS TRAEFIK  \033[0m\n' "${#ROUTES_PARASITES[@]}"
    for a in "${ROUTES_PARASITES[@]}"; do printf '    %s\n' "$a"; done
    echo "  Un service annexe ou partage n'a pas d'URL : il ne porte aucun label de"
    echo "  routage. Un label pose ici publierait une route qu'aucun middleware ne"
    echo "  protege. Ne pousse pas."
    echo
  fi
  [ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s)."; exit 1; }
  echo "Contrat respecte. Tu peux pousser sur main."
  exit 0
fi

# --- generation -----------------------------------------------------------------

if [ -n "$ADD" ]; then
  discover_apps
  scaffold_app "$ADD"
  echo
fi

discover_apps
[ ${#APPS[@]} -gt 0 ] || { echo "ERREUR : aucune app sous apps/ — ./init.sh --add <nom>" >&2; exit 1; }

apply_target_options
# Avant d'ecrire quoi que ce soit : une collision de noms de volumes doit
# arreter la generation, pas seulement --check. Un compose ou deux apps
# partagent un volume est deja ecrit quand --check le dit.
check_volume_noms
compute_tooling

# Un manifeste invalide ne doit pas produire un compose « plausible mais faux » :
# la fabrique s'arrete ici, avant d'ecrire quoi que ce soit. Et un secret ne doit
# pas entrer dans un fichier suivi par git : le scan porte sur le compose QUI VA
# ETRE ECRIT, donc sur toutes les syntaxes a la fois, y compris --dry-run — dont
# l'apercu afficherait sinon la valeur que la generation refuse.
require_clean_manifests
require_no_secrets
show_warnings

if [ ! -f fabrique.yml ] && [ "$DRYRUN" = 1 ]; then
  warn "fabrique.yml serait cree — --dry-run n'ecrit rien"
elif [ ! -f fabrique.yml ]; then
  cat > fabrique.yml <<YAML
# Valeurs communes a toutes les applications de la fabrique.
# Modifie ce fichier puis relance ./init.sh.
org: $ORG
repo: $REPO                 # entre dans le nom des images : $REGISTRY/$ORG/$REPO/<app>
registry: $REGISTRY
domain: $DOMAIN             # chaque app est servie sur <nom-app>.<domain>
network: $NETWORK           # reseau Docker existant cote serveur
entrypoint: $ENTRYPOINT
cert_resolver: $CERT_RESOLVER
security_headers: $SECURITY_HEADERS
memory_budget: $MEMORY_BUDGET   # plafond de la somme des mem_limit
image_max_mb: $IMAGE_MAX_MB
log_max_size: $LOG_MAX_SIZE     # cap des journaux json-file, par service
log_max_file: $LOG_MAX_FILE

# Services partages par plusieurs applications. Ils vivent sur $NETWORK, sont
# joignables par leur nom depuis n'importe quelle app, et ne sont JAMAIS routes :
# init.sh leur pose « traefik.enable=false », le seul label qui RETIRE du
# routage — l'absence de label ne suffirait pas, exposedByDefault leur creerait
# un routeur sans authentification. Une app declare sa dependance avec
# « needs: [redis] » dans son app.yml, et un needs vers un service absent d'ici
# est une erreur de generation, pas une panne au demarrage.
#
# « command » s'ecrit en scalaire — decoupee sur les espaces — ou en LISTE, en
# ligne comme en bloc ; elle est lue et emise EN ENTIER dans les deux cas.
#
# Un secret ne se declare pas ici, et aucune syntaxe ne le fait passer : avant
# d'ecrire quoi que ce soit, init.sh scanne ce fichier, les apps/*/app.yml et le
# compose qu'il vient de produire. Une cle qui evoque un secret — requirepass,
# password, token, api-key, ou des identifiants dans une URL — suivie d'une
# VALEUR LITTERALE arrete la generation ; le message nomme le fichier et la
# ligne, sans jamais reimprimer la valeur. Le scan lit le RESULTAT et non les
# champs : « sh -c », health_cmd et command: y passent de la meme facon.
#
# Deux formes restent admises, et ce sont les deux bonnes :
#   « --requirepass \${REDIS_PASSWORD} »   le NOM va dans env:, la valeur est
#                                         injectee par l'infrastructure ;
#   « --password-file /run/secrets/pw »   un CHEMIN, forme du secret monte en
#                                         fichier cote serveur.
# Une option qui ne porte pas de secret passe telle quelle :
# « --notify-keyspace-events Ex », « --tls-key-file /certs/k.pem »,
# « --auth-host=trust ».
#
# Liste vide par defaut. Forme attendue — decommente et adapte pour en declarer :
#
# shared_services:
#   - name: redis
#     image: valkey/valkey:8-alpine
#     memory: 128m
#     command: ["redis-server", "--maxmemory", "96mb", "--notify-keyspace-events", "Ex"]
#     volumes:
#       - donnees:/data
#   - name: directus
#     image: directus/directus:11
#     memory: 512m
#     env: [DIRECTUS_KEY, DIRECTUS_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD]
#     volumes:
#       - base:/directus/database
#       - fichiers:/directus/uploads
YAML
  ok "fabrique.yml"
fi

echo "Fabrique $ORG/$REPO — ${#APPS[@]} application(s)"

if [ "$DRYRUN" = 1 ]; then
  for f in "${DERIVES[@]}"; do
    if [ "$f" = go.work ] && ! emit go.work >/dev/null 2>&1; then continue; fi
    if [ ! -f "$f" ]; then
      warn "$f serait cree"
    elif diff -q <(emit "$f") "$f" >/dev/null 2>&1; then
      ok "$f inchange"
    else
      warn "$f changerait :"
      diff -u "$f" <(emit "$f") | sed 's/^/    /' || true
    fi
  done
  exit 0
fi

# Un fichier de routage laisse a cote divergerait en silence de compose.yaml.
for dead in "$LEGACY_COMPOSE" .dockerignore; do
  if [ -f "$dead" ]; then rm -f "$dead"; ok "$dead supprime (sans effet dans la fabrique)"; fi
done

# Les artefacts derives sont toujours reecrits : c'est ce qui garantit qu'une
# app ajoutee ne peut pas manquer du compose ni de la CI.
for f in "${DERIVES[@]}"; do
  if [ "$f" = go.work ]; then
    if emit go.work > /tmp/.gowork.$$ 2>/dev/null && [ -s /tmp/.gowork.$$ ]; then
      mv /tmp/.gowork.$$ go.work; ok go.work
    else
      rm -f /tmp/.gowork.$$; [ -f go.work ] && { rm -f go.work; ok "go.work supprime (aucune app Go)"; }
    fi
    continue
  fi
  mkdir -p "$(dirname "$f")"
  # Ecriture atomique : un generateur qui echoue a mi-parcours laisserait sinon
  # un artefact tronque, et un compose tronque est un deploiement casse.
  tmp=$(mktemp)
  emit "$f" > "$tmp"
  mv "$tmp" "$f"
  ok "$f"
done
chmod +x .claude/check-plugins.sh .claude/garde-branche.sh .claude/garde-commit.sh

IGNORES=('.claude/settings.local.json' '.env' '.env.*' '*.log')
# `go build` sans -o depose son binaire dans le repertoire courant, sous le nom
# de ce repertoire : apps/cadran/cadran. Un tel artefact se committe tout seul
# au premier `git add -A`, et alourdit le contexte de construction.
for a in "${APPS[@]}"; do IGNORES+=("/apps/$a/$a"); done
for line in "${IGNORES[@]}"; do
  { [ ! -f .gitignore ] || ! grep -qxF "$line" .gitignore; } && echo "$line" >> .gitignore
done
ok ".gitignore complete"

cat <<EOF

Outillage de l'agent : ${#PLUGIN_IDS[@]} plugins, ${#LSP_BINS[@]} serveur(s) LSP.
Declarer n'installe pas — un seul endroit installe :

  colle .claude/cloud-setup.sh dans le champ "Setup script" de ton
  environnement sur claude.ai/code (icone nuage, engrenage).

Puis :  ./init.sh --check
EOF
