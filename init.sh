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
#
# Options — elles ne valent que pour l'app ciblee par --add ou --app :
#
#   --port N            port d'ecoute dans le conteneur      (defaut 8080)
#   --memory X          limite memoire du conteneur          (defaut 128m)
#   --health CHEMIN     chemin HTTP de sante                 (defaut /healthz)
#   --health-cmd CMD    commande de healthcheck, ou "none"   (defaut : wget)
#   --exposure T        private | google                     (defaut private)
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
# il est la source de verite, edite a la main ou par --app.
#
# Le script ne genere NI Dockerfile NI code applicatif : le choix de la
# technologie appartient a l'agent. Voir CLAUDE.md.

set -euo pipefail

CHECK=0 ADD="" TARGET="" LIST=0 DRYRUN=0 FORCE=0
declare -A SET=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)       CHECK=1 ;;
    --list)        LIST=1 ;;
    --dry-run)     DRYRUN=1 ;;
    --force)       FORCE=1 ;;
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
    function flow(v,   n, i, c, q, cur, e) {
      sub(/^\[/, "", v); sub(/\]$/, "", v)
      # Le decoupage TIENT COMPTE DES GUILLEMETS. Un split naif sur la virgule
      # coupe « "a,b" » en plein milieu et laisse deux guillemets ORPHELINS, qui
      # entrent litteralement dans la valeur, donc dans le conteneur.
      n = length(v); q = ""; cur = ""
      for (i = 1; i <= n; i++) {
        c = substr(v, i, 1)
        if (q != "") { cur = cur c; if (c == q) q = "" }
        else if (c == "\"" || c == Q) { q = c; cur = cur c }
        else if (c == ",") { e = clean(cur); if (e != "") print e; cur = "" }
        else cur = cur c
      }
      e = clean(cur); if (e != "") print e
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
        r = s; sub(/^-[ \t]*/, "", r); r = clean(r)
        if (r != "") print r
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
    function flow(key, v,   n, i, c, q, cur, e) {
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
        else if (c == ",") { e = clean(cur); if (e != "") print idx "\t" key "\t" e; cur = "" }
        else cur = cur c
      }
      e = clean(cur); if (e != "") print idx "\t" key "\t" e
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
        if (ind > dash) { if (pend != "" && r != "") print idx "\t" pend "\t" clean(r); next }
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
    function scan(t, nr,   lc, off, st, ln, kw, v, u) {
      t  = masque(t)
      lc = tolower(t)
      off = 0
      while (match(substr(lc, off + 1), URL)) {
        st = off + RSTART; ln = RLENGTH
        u = substr(t, st, ln); sub(/^:\/\/[^:]*:/, "", u); sub(/@$/, "", u)
        if (!exempte(u))
          say(nr, "url", "identifiants ecrits dans une URL (« ://utilisateur:motdepasse@ ») — le mot de passe y est une valeur litterale, non reimprimee ici." REM)
        off = st + ln - 1
      }
      if (match(lc, KEY)) {
        kw = mot(substr(lc, RSTART, RLENGTH))
        v  = value(substr(t, RSTART + RLENGTH))
        if (!exempte(v))
          say(nr, kw, "la cle « " kw " » porte une valeur litterale et son nom evoque un secret — valeur non reimprimee ici." REM)
      }
      off = 0
      while (match(substr(lc, off + 1), OPT)) {
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

  case "$A_EXPOSURE" in
    private) A_MW=forwardauth ;;       # whitelist de comptes Google
    google)  A_MW=forwardauth-open ;;  # tout compte Google authentifie
    *) echo "ERREUR : $APP — exposure doit valoir 'private' ou 'google' (recu : $A_EXPOSURE)" >&2; exit 1 ;;
  esac
  printf '%s' "$A_PORT"   | grep -qE '^[0-9]{2,5}$'        || { echo "ERREUR : $APP — port invalide : $A_PORT" >&2; exit 1; }
  printf '%s' "$A_MEMORY" | grep -qE '^[0-9]+[bkmgBKMG]?$' || { echo "ERREUR : $APP — memory invalide : $A_MEMORY" >&2; exit 1; }
  case "$A_HEALTH_PATH" in /*) ;; *) echo "ERREUR : $APP — health_path doit commencer par / (recu : $A_HEALTH_PATH)" >&2; exit 1 ;; esac
  case "$A_UI"      in true|false) ;; *) echo "ERREUR : $APP — ui doit valoir true ou false (recu : $A_UI)" >&2; exit 1 ;; esac
  case "$A_ENABLED" in true|false) ;; *) echo "ERREUR : $APP — enabled doit valoir true ou false (recu : $A_ENABLED)" >&2; exit 1 ;; esac
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
    # le texte matche, comme dans sed : sans cette protection, un « 2>&1 » du
    # fragment injecte devient « 2>__CLE__1 » et le script genere ne s'analyse
    # meme plus. Le backslash est protege d'abord, sinon il mangerait le suivant.
    r=${2//\\/\\\\}
    r=${r//&/\\&}
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
  [ -z "$cmd" ] || mapfile -t argv <<<"$cmd"
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
    cmd=""; [ "${#CMD_ARGV[@]}" -eq 0 ] || cmd=$(printf '%s\n' "${CMD_ARGV[@]}")
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
    cmd=""; [ "${#CMD_ARGV[@]}" -eq 0 ] || cmd=$(printf '%s\n' "${CMD_ARGV[@]}")
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
      # $A_MW = authentification Google (exposure $A_EXPOSURE). La retirer
      # exposerait l'app en clair.
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
go 1.24
$uses
EOF
}

emit_build_workflow() {
  local a filters="" json="" sep=""
  for a in "${APPS[@]}"; do json="$json$sep\"$a\""; sep=","; done
  render \
    __APPS_JSON__ "[$json]" \
    __REGISTRY__ "$REGISTRY" \
    __ORG__ "$ORG" \
    __REPO__ "$REPO" \
    __IMAGE_MAX_MB__ "$IMAGE_MAX_MB" \
    <<'YAML'
# Genere par init.sh — une construction par app modifiee, un seul deploiement.
# NE PAS EDITER — ./init.sh --check refuse un workflow desynchronise.
name: build

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      toutes:
        description: reconstruire toutes les apps
        type: boolean
        default: false

# Une seule stack dockhand : deux deploiements concurrents se marcheraient
# dessus. On serialise sans annuler — un deploiement engage doit finir.
concurrency:
  group: fabrique-${{ github.ref }}
  cancel-in-progress: false

jobs:
  # Le contrat devient un verrou de CI, et non plus un geste manuel : avec une
  # stack partagee, un compose faux fusionne casse toutes les apps a la fois.
  contrat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./init.sh --check

  detect:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.choix.outputs.apps }}
      deploy: ${{ steps.choix.outputs.deploy }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: choix
        env:
          EVENT: ${{ github.event_name }}
          TOUTES: ${{ inputs.toutes }}
          AVANT: ${{ github.event.before }}
          BASE_PR: ${{ github.event.pull_request.base.sha }}
          APRES: ${{ github.sha }}
        run: |
          set -euo pipefail
          toutes='__APPS_JSON__'

          if [ "$EVENT" = pull_request ]; then base="$BASE_PR"; else base="$AVANT"; fi

          # Une base absente du depot — premiere poussee d'une branche, greffe,
          # force-push — donnerait un diff vide. On reconstruit tout plutot que
          # de ne rien construire en silence.
          tout=0
          if [ "$EVENT" = workflow_dispatch ] && [ "$TOUTES" = true ]; then
            tout=1
          elif [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
            echo "base de comparaison indisponible ($base) — reconstruction complete"
            tout=1
          fi

          if [ "$tout" = 1 ]; then
            apps="$toutes"; deploy=true
          else
            changed=$(git diff --name-only "$base" "$APRES")
            echo "fichiers modifies :"; printf '  %s\n' $changed

            if printf '%s\n' "$changed" | grep -qE '^(init\.sh|fabrique\.yml|\.github/workflows/)'; then
              # Le generateur ou la CI ont bouge : plus rien ne garantit que les
              # images publiees correspondent aux Dockerfile courants.
              apps="$toutes"
            else
              liste=$(printf '%s\n' "$changed" | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u)
              if [ -n "$liste" ]; then
                apps="[$(printf '%s\n' "$liste" | sed 's/.*/"&"/' | paste -sd, -)]"
              else
                apps='[]'
              fi
            fi

            # Redeployer seulement si une image change ou si le compose change :
            # sinon un commit de documentation redemarrerait toute la stack.
            if [ "$apps" != '[]' ] || printf '%s\n' "$changed" | grep -qx 'compose.yaml'; then
              deploy=true
            else
              deploy=false
            fi
          fi

          echo "apps=$apps"     >> "$GITHUB_OUTPUT"
          echo "deploy=$deploy" >> "$GITHUB_OUTPUT"
          echo "-> apps : $apps   deploy : $deploy"

  # Une matrice vide fait echouer le job : d'ou le garde sur '[]'.
  test:
    needs: [contrat, detect]
    if: needs.detect.outputs.apps != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        app: ${{ fromJSON(needs.detect.outputs.apps) }}
    steps:
      - uses: actions/checkout@v4
      # Chaque app dit comment elle se teste dans un executable, comme elle dit
      # comment elle se construit dans un Dockerfile : la fabrique n'a pas a
      # connaitre les langages. Le runner fournit Go, Node, Python et Java ;
      # pour une autre chaine, testez dans un etage du Dockerfile.
      - name: tests de ${{ matrix.app }}
        run: ./apps/${{ matrix.app }}/test.sh

  build:
    needs: [contrat, detect, test]
    if: needs.detect.outputs.apps != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      fail-fast: false
      matrix:
        app: ${{ fromJSON(needs.detect.outputs.apps) }}
    steps:
      - uses: actions/checkout@v4
      # Sans buildx, le driver par defaut est 'docker', qui ne sait pas
      # exporter de cache : le cache-to gha plus bas ferait echouer la
      # construction avant meme de lire le Dockerfile.
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: __REGISTRY__
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # CONSTRUIRE D'ABORD EN LOCAL, PUBLIER ENSUITE. Entre les deux se glisse le
      # seul controle capable de voir les labels de l'IMAGE. Docker fusionne dans
      # les labels du conteneur ceux qui sont graves dans l'image — y compris
      # ceux HERITES d'une image de BASE ou poses par un etage intermediaire, que
      # la lecture de apps/<app>/Dockerfile faite par « ./init.sh --check » ne
      # peut pas voir. Un « traefik.* » grave la publierait un routeur
      # SUPPLEMENTAIRE : il porte un autre nom que celui de compose.yaml, donc le
      # compose ne l'ecrase pas, et il arrive SANS middleware d'authentification —
      # constate avec Traefik 3.7.10. Le service principal, lui, est route :
      # traefik.enable=false ne le couvre pas, ce controle est sa seule parade.
      # L'etape de publication ci-dessous repart de ce cache : rien n'est
      # reconstruit, et surtout pas une image differente de celle qu'on inspecte.
      - name: construire ${{ matrix.app }} sans publier
        uses: docker/build-push-action@v6
        with:
          # Contexte reduit a l'app : c'est ce qui isole les constructions les
          # unes des autres et empeche une edition dans une app d'invalider le
          # cache de couches des autres.
          context: apps/${{ matrix.app }}
          file: apps/${{ matrix.app }}/Dockerfile
          # Chargee dans le demon local, pas poussee : sans cela il n'y a rien a
          # inspecter avant la publication.
          load: true
          tags: __REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:ci
          # Rattache le paquet au depot : ses permissions suivent alors celles
          # du depot, et un seul identifiant de lecture couvre toutes les apps.
          labels: |
            org.opencontainers.image.source=https://github.com/__ORG__/__REPO__
          # Identifie la version deployee ; le Dockerfile en fait ce qu'il veut,
          # l'ignorer est sans consequence.
          build-args: |
            VERSION=${{ github.sha }}
          # Le scope est obligatoire en matrice : sans lui les constructions
          # paralleles se disputent un cache unique et s'evincent l'une l'autre.
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}

      - name: aucun LABEL traefik.* dans l'image de ${{ matrix.app }}
        run: |
          set -euo pipefail
          image=__REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:ci
          # L'INSPECTION DOIT REUSSIR POUR QUE CE CONTROLE VEUILLE DIRE QUELQUE
          # CHOSE. Un « || true » pose sur le tube couvre aussi l'echec de
          # « docker image inspect » lui-meme : image absente, demon injoignable,
          # tag mal orthographie — la sortie est vide, et une etape qui n'a RIEN
          # inspecte passe au vert. C'est un controle de securite : il echoue
          # ferme, sinon il ne sert a rien.
          if ! cles=$(docker image inspect "$image" \
                        --format '{{range $k, $v := .Config.Labels}}{{println $k}}{{end}}'); then
            echo "::error::docker image inspect a echoue sur $image — les labels de l'image n'ont PAS pu etre verifies, et une image non inspectee ne peut pas etre publiee"
            exit 1
          fi
          echo "labels de l'image :"; printf '%s\n' "$cles"
          # Le grep est INSENSIBLE A LA CASSE, comme celui que ./init.sh --check
          # passe sur le Dockerfile : Docker n'abaisse pas la casse des cles de
          # label, et Traefik lit ses labels sans y prendre garde. Un
          # « LABEL Traefik.enable » herite d'une image de base passerait sinon un
          # controle et pas l'autre — le trou est du cote de celui qui publie.
          graves=$(printf '%s\n' "$cles" | grep -iE '^traefik\.' || true)
          if [ -n "$graves" ]; then
            printf '::error::LABEL traefik grave dans l image : %s\n' $graves
            echo "::error::Docker le fusionnerait dans les labels du conteneur et publierait un routeur SUPPLEMENTAIRE, portant un autre nom que celui de compose.yaml — donc SANS authentification. Retire-le du Dockerfile, ou change d'image de base : ce label n'est pas ecrasable depuis le compose."
            exit 1
          fi
          echo "aucun label traefik.* — ni ecrit dans le Dockerfile, ni herite de l'image de base"

      - name: publier ${{ matrix.app }}
        uses: docker/build-push-action@v6
        with:
          context: apps/${{ matrix.app }}
          file: apps/${{ matrix.app }}/Dockerfile
          # Sur une pull request on construit sans publier : la validation du
          # Dockerfile ne doit pas bouger le tag :main que le serveur suit.
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            __REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:main
            __REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:${{ github.sha }}
          labels: |
            org.opencontainers.image.source=https://github.com/__ORG__/__REPO__
          build-args: |
            VERSION=${{ github.sha }}
          # Tout vient du cache de l'etape de construction : rien n'est
          # reconstruit, et surtout pas une image differente de celle qui vient
          # d'etre inspectee.
          cache-from: type=gha,scope=${{ matrix.app }}
      - name: taille de l'image
        if: github.event_name != 'pull_request'
        run: |
          image=__REGISTRY__/__ORG__/__REPO__/${{ matrix.app }}:main
          docker pull "$image"
          size=$(docker image inspect "$image" --format '{{.Size}}')
          echo "Image ${{ matrix.app }} : $((size / 1024 / 1024)) Mo"
          if [ "$size" -gt $((__IMAGE_MAX_MB__ * 1024 * 1024)) ]; then
            echo "::warning::image au-dela de __IMAGE_MAX_MB__ Mo — le serveur est a 92 % de disque"
          fi

  deploy:
    needs: [contrat, detect, test, build]
    # « sauté » et « échoué » doivent se distinguer : un build saute (rien a
    # reconstruire, mais le compose a change) doit laisser passer, un build en
    # echec doit bloquer. Sinon un commit a moitie construit referencerait une
    # image inexistante et emporterait les apps saines.
    if: >-
      always()
      && github.event_name == 'push'
      && github.ref == 'refs/heads/main'
      && needs.detect.outputs.deploy == 'true'
      && needs.contrat.result == 'success'
      && needs.detect.result == 'success'
      && (needs.test.result == 'success' || needs.test.result == 'skipped')
      && (needs.build.result == 'success' || needs.build.result == 'skipped')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: __REGISTRY__
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Garde-fou propre a la stack unique : « docker compose up » est atomique
      # pour la stack entiere. Une seule image absente du registre le fait
      # echouer et emporte les applications saines. On verifie donc chaque
      # reference du compose AVANT d'appeler le webhook — le pire cas devient
      # « rien n'est deploye » au lieu de « tout tombe ».
      - name: toutes les images du compose sont tirables
        run: |
          set -euo pipefail
          # sort -u : la meme image peut etre referencee par plusieurs services
          # — une app et son worker partagent la leur — et l'inspecter deux fois
          # ne prouve rien de plus.
          mapfile -t images < <(sed -nE 's/^[[:space:]]*image:[[:space:]]*(.*)$/\1/p' compose.yaml | LC_ALL=C sort -u)
          if [ ${#images[@]} -eq 0 ]; then
            echo "::error::aucune image dans compose.yaml — la stack ne deploierait rien"
            exit 1
          fi
          # TOUTES les images sont verifiees, les TIERCES COMPRISES, et un echec
          # bloque. Ne pas les bloquer sous pretexte que ce job « ne s'authentifie
          # que sur __REGISTRY__ » serait faux : « docker buildx imagetools
          # inspect » interroge le registre en ANONYME quand il n'a pas
          # d'identifiants, et l'inspection d'une image publique aboutit sans
          # login — mesure, docker deconnecte de tout registre : l'inspection de
          # valkey/valkey:8-alpine sort en 0, la meme avec une faute de frappe
          # sort en 1. Une image tierce mal orthographiee ou disparue ferait
          # echouer le « docker compose up », atomique pour la stack entiere : la
          # laisser passer, c'est deployer une fabrique qui tombe TOUTE. Une image
          # tierce reellement privee est le seul faux positif possible, et elle
          # n'aurait de toute facon pas sa place dans un compose que le serveur
          # tire sans identifiants.
          manquantes=()
          for img in "${images[@]}"; do
            if docker buildx imagetools inspect "$img" >/dev/null 2>&1; then
              echo "  ok   $img"
            else
              echo "  KO   $img"
              manquantes+=("$img")
            fi
          done
          if [ ${#manquantes[@]} -gt 0 ]; then
            printf '::error::image introuvable dans son registre : %s\n' "${manquantes[@]}"
            echo "::error::deploiement refuse — il ferait tomber toutes les apps de la stack"
            exit 1
          fi
          echo "${#images[@]} image(s) distincte(s) verifiee(s)"

      # Le tag :main est mutable : une image reconstruite ne change pas une
      # ligne du compose, donc l'auto-sync de dockhand ne voit aucun diff et ne
      # redeploie rien. C'est cet appel, apres publication, qui declenche le
      # deploiement — et il vient apres pour que le serveur tire bien la
      # nouvelle image, pas celle d'avant.
      #
      # L'URL est une URL de capacite : qui la connait declenche un
      # deploiement. Elle vit dans un secret du depot, jamais dans ce fichier.
      - name: declencher le deploiement
        env:
          WEBHOOK: ${{ secrets.DOCKHAND_DEPLOY_WEBHOOK }}
          WEBHOOK_SECRET: ${{ secrets.DOCKHAND_WEBHOOK_SECRET }}
        run: |
          if [ -z "$WEBHOOK" ]; then
            echo "::warning::secret DOCKHAND_DEPLOY_WEBHOOK absent — images publiees, deploiement NON declenche"
            exit 0
          fi

          # Un secret colle porte souvent un retour a la ligne invisible. Il
          # casserait la signature comme le jeton, pour un 403 indistinguable
          # d'un mauvais secret.
          secret=$(printf '%s' "$WEBHOOK_SECRET" | tr -d '\r\n')

          # Recette documentee par dockhand pour une CI generique : POST d'un
          # corps quelconque, signe en HMAC-SHA256. Le corps ne sert pas au
          # serveur, qui relit le depot lui-meme ; seule la signature compte.
          payload='{}'
          if [ -n "$secret" ]; then
            sig=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $NF}')
            set -- -H "x-hub-signature-256: sha256=$sig"
          else
            echo "::warning::secret DOCKHAND_WEBHOOK_SECRET absent — appel non signe, il sera refuse"
            set --
          fi

          code=$(curl -sS -o reponse.txt -w '%{http_code}' --retry 3 --retry-delay 5 \
                   -X POST "$WEBHOOK" -H 'content-type: application/json' "$@" -d "$payload")
          echo "reponse HTTP $code :"
          cat reponse.txt; echo

          if [ "$code" = 403 ]; then
            echo "::error::403 — le secret envoye ne correspond pas a celui configure sur la stack dockhand"
            exit 1
          fi
          if [ "$code" -ge 400 ]; then
            echo "::error::le webhook a refuse l'appel — images publiees, rien n'est deploye"
            exit 1
          fi

          # dockhand ne redeploie que s'il voit un commit nouveau. Le tag :main
          # etant mutable, une image reconstruite sans commit le fait sauter le
          # deploiement, en repondant 200 : sans ce test, la CI serait verte et
          # le serveur servirait toujours les images d'avant.
          if grep -q '"skipped":[[:space:]]*true' reponse.txt; then
            echo "::error::dockhand a saute le deploiement (aucun commit nouveau vu)."
            echo "::error::Active « Force redeployment » dans les Deploy options de la stack. « Re-pull images » n'est pas necessaire : pull_policy: always le couvre depuis le depot."
            exit 1
          fi
          echo "deploiement declenche"
YAML
}

emit_settings() {
  local enabled="" i sep marketplaces=""
  for i in "${!PLUGIN_IDS[@]}"; do
    sep=","; [ "$i" -eq $(( ${#PLUGIN_IDS[@]} - 1 )) ] && sep=""
    enabled="$enabled    \"${PLUGIN_IDS[$i]}\": true$sep
"
  done
  # claude-plugins-official est enregistree d'office par Claude Code : seule une
  # marketplace tierce doit etre declaree ici.
  if [ "$UI_ANY" = true ]; then
    marketplaces='  "extraKnownMarketplaces": {
    "impeccable": {
      "source": { "source": "github", "repo": "pbakaus/impeccable" }
    }
  },
'
  fi
  render __MARKETPLACES__ "$marketplaces" __ENABLED__ "$enabled" <<'JSON'
{
__MARKETPLACES__  "enabledPlugins": {
__ENABLED__  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR/.claude/check-plugins.sh\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
JSON
}

emit_check_plugins() {
  render \
    __PLUGINS__ "${PLUGIN_IDS[*]}" \
    __TRIPLETS__ "${LSP_TRIPLETS[*]-}" \
    <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — rapport d'outillage, lance par le hook SessionStart.
#
# Il n'installe rien, et c'est delibere : un hook s'execute APRES que Claude
# Code a charge ses plugins. Il arrive donc toujours trop tard pour reparer
# quoi que ce soit — mais juste a temps pour dire ce qui manque. L'installation
# appartient au setup script de l'environnement (.claude/cloud-setup.sh), seul
# point d'accroche anterieur au lancement de Claude Code.
#
# Sa sortie standard est injectee dans le contexte de l'agent A CHAQUE SESSION :
# une ligne quand tout va bien, quel que soit le nombre d'applications, le
# detail seulement quand il y a un trou.
#
# Pour changer la liste : edite stack/ui dans un apps/*/app.yml, puis ./init.sh

set -u

PLUGINS="__PLUGINS__"
# plugin:binaire:stack — un triplet par serveur de langage attendu
TRIPLETS="__TRIPLETS__"

# Un plugin installe = un repertoire non vide dans le cache local, range sous
# <marketplace>/<nom>. installed_plugins.json n'est pas lu : ce manifeste
# survit a un cache efface, et decrirait alors un outillage disparu.
n=0 total=0 manquants=""
for p in $PLUGINS; do
  total=$(( total + 1 ))
  d="$HOME/.claude/plugins/cache/${p#*@}/${p%@*}"
  if [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    n=$(( n + 1 ))
  else
    manquants="$manquants $p"
  fi
done

# Un plugin LSP peut etre installe et pourtant inerte : Claude Code lance le
# binaire en clair, il doit exister sur la machine. Les deux etats divergent.
lsp_ok=0 lsp_total=0 lsp_detail=""
for t in $TRIPLETS; do
  plugin=${t%%:*}; reste=${t#*:}; bin=${reste%%:*}; stack=${reste##*:}
  # Si le plugin lui-meme manque, il est deja dans la liste ci-dessous :
  # inutile de le dire deux fois, et il serait faux de l'annoncer installe.
  case " $manquants " in *" $plugin@claude-plugins-official "*) continue ;; esac
  lsp_total=$(( lsp_total + 1 ))
  if command -v "$bin" >/dev/null 2>&1; then
    lsp_ok=$(( lsp_ok + 1 ))
  else
    lsp_detail="$lsp_detail
  $bin ABSENT — $plugin est installe mais inerte : aucun diagnostic $stack apres edition."
  fi
done

if [ "$lsp_total" -gt 0 ]; then
  echo "Outillage : $n/$total plugins installes, $lsp_ok/$lsp_total serveurs LSP presents."
else
  echo "Outillage : $n/$total plugins installes."
fi
[ -n "$manquants" ] && {
  echo "  manquants :$manquants"
  echo "  -> colle .claude/cloud-setup.sh dans le champ Setup script de l'environnement : claude.ai/code, icone nuage, engrenage."
}
[ -n "$lsp_detail" ] && {
  echo "$lsp_detail"
  echo "  -> leurs commandes d'installation sont dans .claude/cloud-setup.sh."
}

# Toujours 0 : un rapport ne fait pas echouer l'ouverture d'une session.
exit 0
SH
}

emit_cloud_setup() {
  local a launches="" todos="" plugin_lines marketplace=""
  # Les installations partent toutes en parallele : le setup script doit tenir
  # sous ~5 minutes, et seul un serveur de langage depasse la minute.
  for a in "${LSP_TRIPLETS[@]-}"; do
    [ -n "$a" ] || continue
    local plugin=${a%%:*} reste=${a#*:} bin stack
    bin=${reste%%:*}; stack=${reste##*:}
    lsp_for "$stack"
    if [ -n "$LSP_INSTALL" ]; then
      launches="$launches
( $LSP_INSTALL ) >/tmp/$bin-setup.log 2>&1 &
pids+=(\$!) noms+=($bin)
"
    else
      todos="$todos
# TODO : installer $bin. Le plugin $plugin est declare, mais sans ce binaire il
# reste inerte — et aucune installation en une commande n'est connue pour la
# stack $stack a travers l'allowlist reseau. Ajoute-la ici, puis recolle.
"
    fi
  done
  plugin_lines=$(printf '    %s \\\n' "${PLUGIN_IDS[@]}")
  plugin_lines=${plugin_lines% \\}
  [ "$UI_ANY" = true ] && marketplace='claude plugin marketplace add pbakaus/impeccable || true'

  render \
    __LAUNCHES__ "$launches" \
    __TODOS__ "$todos" \
    __MARKETPLACE__ "$marketplace" \
    __PLUGIN_LINES__ "$plugin_lines" \
    <<'SH'
#!/usr/bin/env bash
#
# Genere par init.sh — A COLLER dans le champ "Setup script" de l'environnement
# cloud : claude.ai/code, icone nuage au-dessus de la zone de saisie, engrenage
# de l'environnement. Ce fichier n'est jamais execute par le depot ni par la CI.
#
# Pourquoi il existe. En session cloud, Claude Code charge les plugins AVANT de
# les installer : un hook SessionStart s'execute apres ce chargement, et
# /reload-plugins n'existe pas sur le web. Les plugins y atterriraient sur le
# disque sans jamais servir — et comme chaque session cloud demarre sur une VM
# neuve, le cas se represente a chaque fois. Ce script, lui, tourne avant le
# lancement de Claude Code, et son resultat est fige dans un instantane du
# disque : il ne rejoue qu'apres modification de l'environnement ou expiration
# du cache (~7 jours). C'est le seul endroit qui installe l'outillage ; le hook
# du depot ne fait que le verifier.
#
# Deux contraintes imposees par l'infrastructure cloud :
#   - sortir en 0, sinon la session refuse de demarrer — d'ou les || true ;
#   - tenir sous ~5 minutes, sinon le cache ne se construit pas.
#
# Cette liste vit hors du depot : apres un ./init.sh qui change une stack ou un
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.

set -u

# --- serveurs de langage : absents de l'image de base ---
# L'image cloud fournit les compilateurs, jamais les serveurs de langage. Sans
# ces binaires, les plugins LSP sont installes mais inertes : aucun diagnostic
# apres edition. Toutes les installations partent en parallele.
pids=() noms=()
__LAUNCHES__
__TODOS__
# --- plugins Claude Code ---
# Le setup script tourne en root, avec un PATH plus maigre que celui de la
# session : le binaire vit dans l'image node embarquee par Claude Code.
command -v claude >/dev/null || export PATH="/opt/node22/bin:$PATH"

# Avant le premier lancement de Claude Code, aucune marketplace n'est
# enregistree — pas meme l'officielle. La declarer ici separe un setup script
# qui installe d'un qui echoue en silence.
claude plugin marketplace add anthropics/claude-plugins-official || true
__MARKETPLACE__
for p in \
__PLUGIN_LINES__
do
  claude plugin install "$p" || echo "   echec : $p" >&2
done

for i in "${!pids[@]}"; do
  wait "${pids[$i]}" || { echo "echec ${noms[$i]} :" >&2; tail -3 "/tmp/${noms[$i]}-setup.log" >&2; }
  if command -v "${noms[$i]}" >/dev/null || [ -x "/usr/local/bin/${noms[$i]}" ]; then
    echo "${noms[$i]} present."
  else
    echo "${noms[$i]} absent — son plugin restera inerte." >&2
  fi
done

# Toujours 0 : un outil manquant degrade l'outillage, il ne doit pas empecher
# la session de demarrer.
exit 0
SH
}

# --- artefacts derives ----------------------------------------------------------

emit() {  # emit <chemin> — ecrit sur stdout l'artefact attendu pour ce chemin
  case "$1" in
    compose.yaml)                 emit_compose ;;
    .github/workflows/build.yml)  emit_build_workflow ;;
    .claude/settings.json)        emit_settings ;;
    .claude/check-plugins.sh)     emit_check_plugins ;;
    .claude/cloud-setup.sh)       emit_cloud_setup ;;
    go.work)                      emit_gowork ;;
  esac
}

DERIVES=(compose.yaml .github/workflows/build.yml .claude/settings.json
         .claude/check-plugins.sh .claude/cloud-setup.sh go.work)

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
  if [ -d "$dir" ] && [ "$FORCE" = 0 ]; then
    echo "ERREUR : $dir existe deja (--force pour reecrire ses fichiers d'echafaudage)." >&2
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
exposure: $exposure
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

URL : https://$a.$DOMAIN — authentification : \`$exposure\`.

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
    ok "$p auth $A_MW (exposure $A_EXPOSURE)"
  else
    bad "$p SANS AUTHENTIFICATION CONFORME — middleware $A_MW attendu"
    SANS_AUTH+=("$APP")
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
  for src in README.md CLAUDE.md PRODUCT.md apps/*/*.md; do
    [ -f "$src" ] || continue
    for cible in $(grep -oE '\]\([^)#:]+\.md\)' "$src" | sed -E 's/^\]\((.*)\)$/\1/'); do
      [ -f "$(dirname "$src")/$cible" ] || { bad "lien mort : $src -> $cible"; morts=$((morts+1)); }
    done
  done
  [ "$morts" -eq 0 ] && ok "aucun lien mort entre les documents"

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
  else
    bad ".claude/settings.json absent — lance ./init.sh"
  fi
  [ -x .claude/check-plugins.sh ] && ok "rapport d'outillage executable" \
                                  || bad ".claude/check-plugins.sh absent ou non executable"

  # Les scripts generes le sont par substitution de fragments : une erreur du
  # generateur produit un fichier plausible mais inanalysable, qui echouerait
  # silencieusement au demarrage d'une session cloud. bash -n le voit tout de
  # suite, et coute une milliseconde.
  for s in .claude/check-plugins.sh .claude/cloud-setup.sh apps/*/test.sh; do
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

  # 6. Secrets. Les motifs de jeton sont ecrits avec une classe d'un seul
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
    printf '\033[41;97m  %d APPLICATION(S) SANS AUTHENTIFICATION CONFORME  \033[0m\n' "${#SANS_AUTH[@]}"
    for a in "${SANS_AUTH[@]}"; do printf '    %s -> https://%s.%s\n' "$a" "$a" "$DOMAIN"; done
    echo "  Le contrat n'a pas de palier public. Ne pousse pas."
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
chmod +x .claude/check-plugins.sh

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
