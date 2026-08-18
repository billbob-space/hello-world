#!/usr/bin/env bash
#
# init.sh — la fabrique : plusieurs applications, une seule stack dockhand
#
#   ./init.sh                 regenere les artefacts derives depuis apps/*/app.yml
#   ./init.sh --check         verifie le depot, service par service
#   ./init.sh --add NOM       echafaude apps/NOM/ (ni Dockerfile ni code)
#   ./init.sh --app NOM ...   applique les options ci-dessous a cette app
#   ./init.sh --pin NOM=SHA   epingle la version deployee d'une app (repetable)
#   ./init.sh --list          etat des applications de la fabrique
#   ./init.sh --dry-run       n'ecrit rien, affiche le diff de chaque artefact
#
# Cinq autres metiers vivent dans leur propre script, chacun son sujet :
#
#   ./scripts/branche.sh <app>/<sujet>   cree la branche de travail, et son entree de journal
#   ./scripts/pret.sh                    l'etape en cours est-elle committable ?
#   ./scripts/cout.sh                    releve les jetons consommes et leur cout, dans le journal
#   ./scripts/fusionnees.sh              quelles branches distantes peuvent partir
#   ./scripts/prod.sh                    l'etat, les journaux et les fichiers de la production
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
# versions.yml — LA VERSION DEPLOYEE DE CHAQUE APP, une ligne « <app>: <sha> ».
# Le fichier est ecrit par la CI (--pin), lu ici, et c'est lui qui rend le
# deploiement SELECTIF : le tag d'image cesse d'etre le meme a chaque livraison,
# si bien qu'un « docker compose up » ne recree que les services dont la ligne
# image: a bouge — les autres conteneurs ne sont pas touches. Une app absente du
# fichier retombe sur « :main », le tag mutable : c'est le cas d'une app dont
# aucune image n'a encore ete publiee, et le seul ou la fabrique deploie a
# l'aveugle.
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

CHECK=0 ADD="" TARGET="" LIST=0 DRYRUN=0 FORCE=0
declare -A SET=()
PINS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)       CHECK=1 ;;
    --list)        LIST=1 ;;
    --dry-run)     DRYRUN=1 ;;
    --force)       FORCE=1 ;;
    --add)         ADD="$2"; TARGET="$2"; shift ;;
    --app)         TARGET="$2"; shift ;;
    --pin)         PINS+=("$2"); shift ;;
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

. lib/socle.sh
. lib/journal.sh

# Le vocabulaire ferme de « Tenu par », en-tete des fichiers de memory/. « rien »
# n'y figure pas volontairement : il est refuse, et le message d'aide le rappelle.
# Reste ici plutot que dans lib/ : aucun autre script de la fabrique n'en a besoin.
MEMORY_TENU='--check|CI|hook'

# --- applications ---------------------------------------------------------------

valid_svc_name() {  # label DNS : ni tiret en tete ni tiret en queue
  printf '%s' "$1" | grep -qE '^[a-z0-9]([a-z0-9-]{0,29}[a-z0-9])?$'
}

valid_name() {  # meme regle pour une app, mais elle dit pourquoi elle refuse
  valid_svc_name "$1" && return 0
  echo "ERREUR : nom d'app invalide : '$1' — il devient un sous-domaine." >&2
  return 1
}

VERSIONS=versions.yml

# La version epinglee d'une app, ou « main » si aucune ne l'est. Ce n'est PAS un
# manifeste edite a la main : la CI y ecrit le commit qu'elle vient de publier,
# et c'est tout l'interet — un tag different a chaque livraison fait bouger la
# seule ligne image: de l'app livree, donc recreer le seul conteneur concerne.
# Les --pin de la ligne de commande passent AVANT le fichier, comme SET passe
# avant app.yml dans app_get : sans quoi « --dry-run --pin » annoncerait le
# changement puis afficherait des artefacts qui ne le portent pas.
app_tag() {  # app_tag <app>
  local p
  for p in "${PINS[@]-}"; do
    [ "${p%%=*}" = "$1" ] && { printf '%s' "${p#*=}"; return; }
  done
  yget "$VERSIONS" "$1" main
}

# Un tag d'image accepte ici : un commit git complet, ou le repli « main ». Une
# forme libre serait admise par Docker et rendrait le deploiement muet en cas de
# faute de frappe — l'image serait introuvable au « compose up », donc apres le
# point ou toutes les apps sont deja engagees.
valid_tag() {  # valid_tag <tag>
  [ "$1" = main ] || printf '%s' "$1" | grep -qE '^[0-9a-f]{40}$'
}

app_get() {  # app_get <app> <cle> <defaut> — l'option CLI ne vaut que pour --app
  local a="$1" k="$2" d="${3-}"
  if [ "$TARGET" = "$a" ] && [ -n "${SET[$k]+x}" ]; then printf '%s' "${SET[$k]}"; return; fi
  yget "apps/$a/app.yml" "$k" "$d"
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
    image: $REGISTRY/$ORG/$REPO/$APP:$(app_tag "$APP")
    container_name: $APP
    restart: unless-stopped
    mem_limit: $A_MEMORY
    # Le tag vient de versions.yml, ou la CI ecrit le commit qu'elle vient de
    # publier. Il change donc a chaque livraison de CETTE app, et de celle-la
    # seule : « docker compose up » ne recree que les services dont la ligne
    # image: a bouge. Une app encore absente de versions.yml retombe sur le tag
    # mutable « :main », et c'est le seul cas ou pull_policy sert vraiment —
    # sans lui, un redeploiement relancerait l'image locale, donc la version
    # precedente. Sur un tag epingle il ne coute qu'une verification d'empreinte.
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

# La notice de contexte d'une application — apps/<nom>/CLAUDE.md.
#
# POURQUOI CE NOM DE FICHIER. L'outillage charge un CLAUDE.md de sous-repertoire
# au moment ou un fichier de ce repertoire est lu ou modifie, et seulement
# alors. C'est exactement la propriete cherchee : la notice de cadran ne pese
# rien tant qu'on travaille sur ardoise. Aucun autre nom ne l'obtient — un
# README n'est lu que si quelqu'un pense a l'ouvrir.
#
# POURQUOI GENEREE. Elle ne dit rien qui ne soit deja decide dans app.yml et
# fabrique.yml. Ecrite a la main, elle serait un troisieme document d'app a
# tenir a jour, et le premier a vieillir en silence. Generee, elle ne coute
# rien et --check refuse qu'elle derive.
#
# DEUX CONTRAINTES QUE --check IMPOSE A SON CONTENU, et qui expliquent sa forme :
# aucun lien markdown — le controle de liens morts lit apps/*/*.md, et
# marcq-handball comme ramure-v2 n'ont pas tous leurs documents — d'ou des
# chemins entre apostrophes inverses ; et aucun titre de niveau 2 en double.
#
# Les blocs statiques sont en heredoc QUOTE, les lignes variables en printf :
# un heredoc non quote interpreterait les apostrophes inverses du markdown
# comme des substitutions de commande.
emit_notice() {  # emit_notice <app> — suppose load_app deja appele si le manifeste existe
  local a="$1" d="apps/$1" qui n i nom vol

  printf '# %s — notice de contexte\n\n' "$a"
  if [ -f "$d/app.yml" ]; then
    printf '<!-- GENERE par ./init.sh depuis %s/app.yml et fabrique.yml.\n' "$d"
  else
    printf '<!-- GENERE par ./init.sh. Cette app n a pas encore de manifeste.\n'
  fi
  printf "     Ne l'edite pas : --check refuse une notice qui a derive. -->\n\n"

  printf '## Ton perimetre\n\n'
  printf 'Tu travailles dans `%s/` et nulle part ailleurs. Si ton changement demande\n' "$d"
  cat <<'FIN'
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

FIN

  printf '## Ce que tu ecris\n\n'
  if [ ! -f "$d/app.yml" ]; then
    # Version degradee : une app dont le code n'est pas encore ecrit. Cas
    # legitime que le contrat prevoit, et surtout celui ou le plus de code
    # reste a ecrire — donc celui ou le bornage sert le plus.
    printf "Cette application n'a pas encore de manifeste : le manifeste reste a ecrire.\n"
    printf 'Son nom — donc son sous-domaine, son conteneur et sa route — sera `%s`.\n' "$a"
    printf 'Echafaude-le avec `./init.sh --add %s`, puis relance `./init.sh`.\n\n' "$a"
  else
    case "$A_EXPOSURE" in
      private) qui="uniquement les comptes de la liste blanche du serveur" ;;
      google)  qui="n'importe quel compte Google authentifie" ;;
      public)  qui="tout le monde, sans authentification" ;;
    esac
    printf -- '- Nom : `%s` — c'"'"'est aussi son sous-domaine, son conteneur et sa route.\n' "$a"
    printf -- '- URL : https://%s.%s\n' "$a" "$DOMAIN"
    printf -- '- Qui entre : %s (`exposure: %s`).\n' "$qui" "$A_EXPOSURE"
    if [ "$A_ENABLED" = true ]; then
      printf -- '- Deployee : oui.\n\n'
    else
      printf -- '- Deployee : pas encore — son bloc n'"'"'entre pas dans `compose.yaml`.\n\n'
    fi

    printf '## Comment elle tourne\n\n'
    printf -- '- Technologie : `%s`\n' "$A_STACK"
    printf -- '- Port : `%s`\n' "$A_PORT"
    printf -- '- Memoire : `%s`\n' "$A_MEMORY"
    if [ "$A_HEALTH_CMD" = none ]; then
      printf -- '- Healthcheck : aucun.\n\n'
    else
      printf -- '- Healthcheck : `%s` — `%s`\n\n' "$A_HEALTH_PATH" "$A_HEALTH_CMD"
    fi

    # Section entiere omise quand l'app ne garde rien : une rubrique vide se lit
    # comme une rubrique oubliee.
    n=$(map_count "$A_SERVICES")
    if [ "${#A_VOL_NOMS[@]}" -gt 0 ] || [ "$n" -gt 0 ] \
       || [ "${#A_NEEDS[@]}" -gt 0 ] || [ "${#A_ENV[@]}" -gt 0 ]; then
      printf "## Ce qu'elle garde\n\n"
      for i in "${!A_VOL_NOMS[@]}"; do
        printf -- '- Volume `%s`, monte sur `%s` — il survit au redeploiement.\n' \
                  "${A_VOL_NOMS[$i]}" "${A_VOL_CHEMINS[$i]}"
      done
      for (( i = 0; i < n; i++ )); do
        nom=$(map_one "$A_SERVICES" "$i" name)
        [ -n "$nom" ] || continue
        printf -- '- Service annexe `%s-%s` (`%s`) — prive, sans URL.\n' \
                  "$a" "$nom" "$(map_one "$A_SERVICES" "$i" image)"
        # Le volume d'un service annexe appartient a l'APP : son nom reel est
        # prefixe par elle. C'est celui-la qui se sauvegarde, et le taire
        # laisserait croire que l'app ne garde rien.
        while IFS= read -r vol; do
          [ -n "$vol" ] || continue
          printf -- '  - Volume `%s-%s`, monte sur `%s` — il survit au redeploiement.\n' \
                    "$a" "${vol%%:*}" "$(printf '%s' "${vol#*:}" | cut -d: -f1)"
        done < <(map_all "$A_SERVICES" "$i" volumes)
      done
      for nom in "${A_NEEDS[@]}"; do
        [ -n "$nom" ] || continue
        printf -- '- Depend de `%s`, service partage de la fabrique — un exemplaire pour toutes les apps.\n' "$nom"
      done
      for nom in "${A_ENV[@]}"; do
        [ -n "$nom" ] || continue
        printf -- '- Attend le secret `%s` : le NOM est dans le depot, la VALEUR est injectee par l'"'"'infrastructure.\n' "$nom"
      done
      printf '\n'
    fi
  fi

  if [ -f "$d/test.sh" ]; then
    printf '## Comment la tester\n\n'
    printf '    ./%s/test.sh\n\n' "$d"
  fi

  if [ -f "$d/PRODUCT.md" ] || [ -f "$d/README.md" ] || [ -d "$d/prp" ]; then
    printf '## Ses documents\n\n'
    [ -f "$d/PRODUCT.md" ] && printf -- '- `%s/PRODUCT.md` — la fiche produit, puis les exigences.\n' "$d"
    [ -f "$d/README.md" ]  && printf -- '- `%s/README.md` — le mode d'"'"'emploi technique.\n' "$d"
    [ -d "$d/prp" ]        && printf -- '- `%s/prp/` — les documents d'"'"'implementation.\n' "$d"
    printf '\n'
  fi

  cat <<'FIN'
## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.
FIN
}

emit() {  # emit <chemin> — ecrit sur stdout l'artefact attendu pour ce chemin
  local a
  case "$1" in
    compose.yaml) emit_compose ;;
    go.work)      emit_gowork ;;
    apps/*/CLAUDE.md)
      a=$(basename "$(dirname "$1")")
      [ -f "apps/$a/app.yml" ] && load_app "$a"
      emit_notice "$a" ;;
  esac
}

# La liste des artefacts derives est une FONCTION et non un tableau : elle
# depend desormais des applications, qui ne sont connues qu'apres
# discover_apps. Ses trois consommateurs — l'ecriture, l'apercu --dry-run et la
# comparaison de --check — la parcourent a l'identique, ce qui donne a la
# notice les trois comportements d'un coup.
liste_derives() {  # un chemin d'artefact par ligne, ordre fige
  printf '%s\n' compose.yaml go.work
  # repertoires_apps et non APPS : une app sans app.yml est ecartee du compose
  # mais recoit quand meme sa notice.
  local a
  while IFS= read -r a; do
    [ -n "$a" ] && printf 'apps/%s/CLAUDE.md\n' "$a"
  done < <(repertoires_apps)
}

repertoires_apps() {  # tout repertoire de apps/, avec ou sans manifeste
  local d
  while IFS= read -r d; do
    [ -n "$d" ] && basename "$d"
  done < <(LC_ALL=C find apps -mindepth 1 -maxdepth 1 -type d 2>/dev/null | LC_ALL=C sort)
}

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

  # README.md et PRODUCT.md sont les deux seuls artefacts d'echafaudage qu'un
  # humain ou un agent peut avoir ecrits AVANT le code : c'est la sequence que
  # le contrat recommande — PRD, puis PRP, puis l'app. Les ecraser detruirait
  # un document de plusieurs centaines de lignes pour y remettre des TODO, et
  # --force ne rachete rien ici : personne n'invoque --force pour perdre un
  # PRD. Les autres artefacts (app.yml, .dockerignore, test.sh) restent regis
  # par --force, eux sont derives.
  if [ -f "$dir/README.md" ]; then
    ok "$dir/README.md conserve — --add n'ecrase jamais un document ecrit a la main"
  else
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
  fi

  if [ -f "$dir/PRODUCT.md" ]; then
    ok "$dir/PRODUCT.md conserve — --add n'ecrase jamais un PRD ecrit a la main"
  else
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
  fi

  cat <<EOF

apps/$a echafaude. Il te reste a ecrire :

  1. Le code, ecoutant sur le port $port en HTTP clair.
  2. GET $health_path renvoyant 200 quand l'app est prete a servir.
  3. apps/$a/Dockerfile — multi-etapes, USER non root, image < $IMAGE_MAX_MB Mo.
  4. La commande de test dans apps/$a/test.sh.

Puis, dans cet ordre — construire d'abord, brancher ensuite :

  ./init.sh --check
  git add apps/$a compose.yaml .gitignore go.work
  git commit                        # commit 1 : la CI publie l'image
  ./init.sh --app $a --enable       # une fois l'image publiee
  git add apps/$a/app.yml compose.yaml && git commit   # commit 2 : le deploiement

Le commit 1 emporte les artefacts regeneres : --add vient de reecrire
compose.yaml, .gitignore et, des que le module Go existe, go.work. N'ajouter
que apps/$a fait echouer le job « contrat » sur « compose.yaml desynchronise ».
Le workflow et .claude/ sont des fichiers ORDINAIRES, que --add ne touche pas :
si cette app introduit un langage ou un ui: nouveau, edite .claude/ a la main.
Le detail : memory/ajouter-une-app.md.

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

# --pin NOM=SHA — ecrit dans versions.yml la version que la CI vient de publier,
# puis la generation ordinaire reporte le tag dans compose.yaml. Deux gestes en
# un seul appel, et c'est voulu : versions.yml sans le compose qui va avec est un
# fichier que personne ne lit, et le commit de livraison doit porter les deux.
#
# Meme discipline que apply_target_options : --dry-run montre l'ecart et n'ecrit
# rien, et une valeur invalide arrete tout AVANT d'ecrire — un tag fautif ne se
# verrait sinon qu'au « docker compose up », c'est-a-dire apres le point ou
# toutes les apps de la stack sont deja engagees.
apply_pins() {
  [ ${#PINS[@]} -gt 0 ] || return 0
  local p a t cur
  for p in "${PINS[@]}"; do
    a="${p%%=*}"; t="${p#*=}"
    if [ "$a" = "$p" ] || [ -z "$a" ] || [ -z "$t" ]; then
      echo "ERREUR : --pin attend NOM=SHA, recu '$p'" >&2; exit 1
    fi
    if [ ! -f "apps/$a/app.yml" ]; then
      echo "ERREUR : --pin $a — apps/$a/app.yml introuvable, ce n'est pas une app." >&2; exit 1
    fi
    if ! valid_tag "$t"; then
      echo "ERREUR : --pin $a=$t — un tag est un commit git complet (40 caracteres hexadecimaux), ou 'main'." >&2; exit 1
    fi
  done
  if [ ! -f "$VERSIONS" ] && [ "$DRYRUN" = 0 ]; then
    cat > "$VERSIONS" <<YAML
# La version de chaque application deployee en production : « <app>: <commit> ».
#
# ECRIT PAR LA CI, pas a la main — « ./init.sh --pin <app>=<sha> ». Le tag ainsi
# fige entre dans compose.yaml, ou il ne bouge que pour l'app qu'on vient de
# livrer : le serveur ne recree alors que ce conteneur-la, et les autres
# applications de la stack ne sont pas redemarrees.
#
# Une app absente d'ici retombe sur « :main », le tag mutable — le cas d'une app
# dont aucune image n'a encore ete publiee.
#
# Revenir en arriere, c'est remettre ici le commit precedent puis lancer
# ./init.sh : l'image est deja dans le registre, rien n'est reconstruit.
YAML
  fi
  for p in "${PINS[@]}"; do
    a="${p%%=*}"; t="${p#*=}"
    cur=$(yget "$VERSIONS" "$a" main)   # le fichier, pas app_tag : celui-ci rend deja le --pin
    if [ "$DRYRUN" = 1 ]; then
      if [ "$cur" = "$t" ]; then ok "$VERSIONS : $a = $t (deja cette valeur)"
      else warn "$VERSIONS : $a passerait de '$cur' a '$t' — --dry-run n'ecrit rien"; fi
      continue
    fi
    set_key "$VERSIONS" "$a" "$t"
    ok "$VERSIONS : $a = $t"
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
  has "image: $REGISTRY/$ORG/$REPO/$APP:$(app_tag "$APP")"          && ok "$p image sur $(app_tag "$APP")" || bad "$p image hors convention, ou tag different de $VERSIONS — lance ./init.sh"
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

# --- les huit sections de --check -----------------------------------------------
#
# Une fonction par section, dans l'ordre ou --check les imprime. Elles etaient un
# seul bloc de 464 lignes en ligne droite, hors de toute fonction : on ne pouvait
# en exercer aucune sans lancer les sept autres, ce qui interdisait de tester le
# verrou de CI autrement qu'en entier.
#
# Aucune ne declare de variable locale, et c'est VOULU : « probs » et « nprobs »,
# poses par check_manifestes, sont relus par check_artefacts, qui saute la
# comparaison quand les manifestes sont deja faux. FAILED, lui, doit rester celui
# du shell appelant — d'ou des appels ordinaires, jamais un tube ni un sous-shell,
# faute de quoi --check sortirait en 0 en ayant affiche des KO.

# versions.yml n'est compare a aucun generateur — il est une ENTREE, comme les
# app.yml. On verifie donc ce qu'il dit, ligne par ligne : une cle qui ne
# designe aucune app, un tag qui n'est ni un commit ni « main ». Le compose,
# lui, reste tenu par la comparaison au generateur : un tag change ici et non
# reporte la-bas ressort en « desynchronise ».
check_versions() {
  [ -f "$VERSIONS" ] || { ok "$VERSIONS absent — toutes les apps sur le tag mutable :main"; return; }
  local cle val n=0 flou=0
  while IFS= read -r cle; do
    val=$(yget "$VERSIONS" "$cle" "")
    n=$(( n + 1 ))
    if [ ! -f "apps/$cle/app.yml" ]; then
      bad "$VERSIONS : '$cle' ne designe aucune app — retire la ligne, ou l'app est partie sans elle"
    elif ! valid_tag "$val"; then
      bad "$VERSIONS : $cle = '$val' — un tag est un commit git complet, ou 'main'"
    elif [ "$val" = main ]; then
      flou=$(( flou + 1 ))
    fi
  done < <(sed -nE 's/^([a-z0-9][a-z0-9-]*):[[:space:]].*/\1/p' "$VERSIONS")
  [ "$flou" = 0 ] || warn "$VERSIONS : $flou app(s) encore sur :main — leur livraison redeploiera a l'aveugle"
  ok "$VERSIONS : $n version(s) epinglee(s)"
}

check_manifestes() {
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
  check_versions

  # 1. Reproductibilite : le fichier committe correspond-il aux manifestes ?
  # Ce controle-la est le seul capable de prouver que compose.yaml decrit bien
  # les apps/*/app.yml — aucune liste de grep ne le saura jamais.
}

check_artefacts() {
  echo
  echo "-- artefacts derives"
  if [ "$nprobs" -gt 0 ]; then
    warn "comparaison sautee : les manifestes ci-dessus doivent d'abord etre corriges"
  else
  while IFS= read -r f; do
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
  done < <(liste_derives)
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

    # Un bloc `run:` peut etre parfaitement valide en YAML et casse en shell.
    # Vu le 18 aout 2026 : un heredoc dont le delimiteur, indente par le bloc,
    # n'etait jamais reconnu. Le YAML etait bon, --check vert, et la CI ne l'a
    # dit qu'apres dix minutes de construction — l'etape morte avant sa
    # premiere commande, neuf images publiees pour rien. Un analyseur YAML ne
    # lit pas le shell qu'il transporte ; celui-ci le lit.
    #
    # Les blocs sont numerotes dans l'ordre du fichier plutot que nommes : le
    # nom d'une etape vit sur une autre ligne que son `run:`, et un garde-fou
    # qui se trompe de nom envoie chercher au mauvais endroit.
    run_dir=$(mktemp -d)
    awk -v d="$run_dir" '
      /^[[:space:]]*(-[[:space:]]+)?run:[[:space:]]*[|>]/ {
        n++; f = sprintf("%s/%03d.sh", d, n); marge = -1; dans = 1; next
      }
      dans && /^[[:space:]]*$/ { if (f != "") print "" >> f; next }
      dans {
        i = match($0, /[^ ]/)
        if (marge < 0) marge = i
        if (i < marge) { dans = 0; next }
        print substr($0, marge) >> f
        next
      }
    ' "$WORKFLOW"
    run_casses=""
    for run_f in "$run_dir"/*.sh; do
      [ -e "$run_f" ] || continue
      # Les expressions ${{ }} ne sont pas du shell : elles sont remplacees par
      # une valeur inerte, sinon chaque bloc qui en porte une serait declare
      # casse a tort.
      sed 's/\${{[^}]*}}/X/g' "$run_f" > "$run_f.shell"
      bash -n "$run_f.shell" 2>/dev/null || run_casses="$run_casses $(basename "$run_f" .sh)"
    done
    if [ -n "$run_casses" ]; then
      bad "$WORKFLOW : bloc(s) run: invalides en shell —$run_casses (numerotes dans l'ordre du fichier) ; l'etape mourrait avant sa premiere commande"
    else
      ok "$WORKFLOW : chaque bloc run: passe bash -n"
    fi
    rm -rf "$run_dir"

    # Chaque job doit porter un plafond de duree. Sans « timeout-minutes », un
    # job est au defaut GitHub de SIX HEURES — et le workflow porte
    # « cancel-in-progress: false » sur main, si bien qu'un seul job pendu tient
    # le groupe de concurrence tout ce temps : plus aucun deploiement de la
    # fabrique, sans qu'aucune alerte ne parte. Le vecteur n'est pas theorique :
    # le job test lance ./apps/<nom>/test.sh, du code applicatif quelconque, et
    # l'appel du webhook dockhand n'etait pas borne.
    #
    # Les jobs se lisent a l'indentation : deux espaces sous « jobs: », et rien
    # d'autre dans le fichier n'a cette forme. On lit les noms, puis on cherche
    # un timeout-minutes avant le job suivant.
    sans_plafond=$(awk '
      /^jobs:[[:space:]]*$/ { dans = 1; next }
      dans && /^[^[:space:]#]/ { dans = 0 }
      dans && /^  [a-zA-Z_][a-zA-Z0-9_-]*:[[:space:]]*$/ {
        if (job != "" && !vu) print job
        job = $0; sub(/^  /, "", job); sub(/:.*$/, "", job); vu = 0; next
      }
      dans && /^    timeout-minutes:/ { vu = 1 }
      END { if (job != "" && !vu) print job }
    ' "$WORKFLOW" | tr '\n' ' ' | sed 's/ $//')
    if [ -n "$sans_plafond" ]; then
      bad "$WORKFLOW : job(s) sans timeout-minutes — $sans_plafond ; au defaut de six heures, un job pendu tient le groupe de concurrence et bloque tout deploiement"
    else
      ok "$WORKFLOW : chaque job porte un plafond de duree"
    fi
  else
    bad "$WORKFLOW absent"
  fi

  # 2. Le compose, service par service — les trois sortes.
}

check_services() {
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
}

check_applications() {
  echo
  echo "-- applications"
  for a in "${APPS[@]}"; do check_app_files "$a"; done
  check_traces_risques
  check_hidden
  check_volume_noms
  ok "noms de volumes distincts entre apps"

  # 4. Memoire engagee. La stack est unique : tout demarre d'un coup, et un
  # depassement fait tuer un voisin par l'OOM killer.
}

# Un tableau de risques ou de cas d'echec PROMET qu'un test tient chaque ligne.
# memory/produit.md impose une derniere colonne « Test » portant le nom exact du
# test entre guillemets inverses. Ici on verifie que ce nom existe pour de vrai
# dans les tests de l'app.
#
# Ce que ca aurait attrape : sur renaissance-gym, le refus « pseudonyme deja
# pris » etait specifie dans le PRD §14, dans le PRP 03 ET dans le PRP 06, et
# livre cote client sans le moindre test. Trois documents le promettaient, zero
# ligne le tenait.
#
# La colonne d'en-tete sert de declencheur, et c'est ce qui rend le controle
# sur : sans elle, n'importe quelle cellule entre guillemets inverses — une
# valeur de app.yml, un nom de fichier — serait prise pour un test. Un tableau
# sans colonne « Test » n'est donc pas juge ; c'est memory/produit.md qui
# demande de l'ecrire, pas ce controle qui l'impose.
check_traces_risques() {
  local n f ligne cellule nom dans_table cites=0 manquants=0 tests
  for d in apps/*/; do
    [ -d "$d" ] || continue
    n=${d#apps/}; n=${n%/}
    tests=$(ls "$d"*_test.go "$d"tests/*.test.js 2>/dev/null || true)
    for f in "$d"PRODUCT.md "$d"prp/*.md; do
      [ -f "$f" ] || continue
      dans_table=0
      while IFS= read -r ligne; do
        case "$ligne" in
          '|'*'|') ;;
          *) dans_table=0; continue ;;
        esac
        cellule=${ligne%|}; cellule=${cellule##*|}
        cellule=${cellule#"${cellule%%[![:space:]]*}"}
        cellule=${cellule%"${cellule##*[![:space:]]}"}
        # L'en-tete arme la lecture ; la ligne de separation la laisse armee.
        case "$cellule" in
          Test|test) dans_table=1; continue ;;
          -*|:*) continue ;;
        esac
        [ "$dans_table" = 1 ] || continue
        case "$cellule" in '`'*'`') ;; *) continue ;; esac
        nom=${cellule#\`}; nom=${nom%\`}
        cites=$((cites+1))
        if [ -z "$tests" ] || ! grep -qF -- "$nom" $tests 2>/dev/null; then
          warn "[$n] $f cite le test « $nom » — introuvable dans les tests de l'app"
          manquants=$((manquants+1))
        fi
      done < "$f"
    done
  done
  [ "$cites" -gt 0 ] && [ "$manquants" -eq 0 ] \
    && ok "$cites test(s) cite(s) dans un tableau de risques, tous presents"
  return 0
}

# La priorite CSS de l'attribut « hidden » : une classe qui declare « display »
# ecrase le « display: none » que le navigateur applique a [hidden], et
# l'attribut cesse silencieusement de cacher quoi que ce soit. Trois occurrences
# dans le depot — ramure le 3 aout, renaissance-gym deux fois le 14, dans le
# meme fichier et pour la meme cause, la seconde n'ayant pas ete vue en
# corrigeant la premiere. Le remede est UNE regle globale, pas un correctif
# classe par classe.
#
# Le filtre sur l'usage reel en JS n'est pas decoratif : sans lui, six apps sur
# dix seraient signalees a tort — un « aria-hidden » ou un « overflow: hidden »
# n'a rien a voir avec ce defaut de priorite.
check_hidden() {
  local n js css expose=0
  for d in apps/*/; do
    [ -d "$d" ] || continue
    n=${d#apps/}; n=${n%/}
    [ -d "$d"web ] || continue
    js=$(grep -rlE '\.hidden *= *(true|false)|setAttribute\( *.hidden.' "$d"web --include='*.js' 2>/dev/null || true)
    [ -n "$js" ] || continue
    css=$(ls "$d"web/*.css 2>/dev/null || true)
    [ -n "$css" ] || continue
    # Aplati : une regle CSS tient sur plusieurs lignes, et une recherche ligne
    # a ligne ne verrait ni le selecteur ni sa propriete dans le meme motif.
    plat=$(cat $css 2>/dev/null | tr '\n' ' ')
    # La regle GLOBALE, et elle seule : « [hidden] » seul en tete de selecteur.
    # « .bouton--discret[hidden] » est justement le correctif classe par classe
    # qu'on veut signaler, pas celui qui eteint l'avertissement.
    printf '%s' "$plat" | grep -qE '(^|[^A-Za-z0-9_.#)-])\[hidden\] *\{[^{}]*display *: *none *!important' && continue
    printf '%s' "$plat" | grep -qE '\.[a-zA-Z0-9_-]+[^{};]*\{[^{}]*display *:' || continue
    warn "[$n] declare display sur une classe sans regle globale [hidden]{display:none!important} — deja vu 3 fois ; le remede est une seule regle globale, pas un correctif classe par classe"
    expose=$((expose+1))
  done
  [ "$expose" -eq 0 ] && ok "aucune app n'expose l'attribut hidden a un ecrasement de display"
  return 0
}

check_fabrique() {
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

  # Les deux controles qui suivent jugent l'EMPLACEMENT d'un document, jamais
  # son contenu : un fichier mal range est deja une faute avant d'etre indexe,
  # et le detecter plus tot n'en cree aucune. Ils lisent donc les fichiers
  # suivis ET les non suivis non ignores -- pret.sh, qui tourne AVANT le commit,
  # rendait sinon « contrat respecte » sur un document que la CI refusait
  # trente secondes plus tard, faute de le voir.
  #
  # Les trois autres « git ls-files » de ce script gardent leur restriction aux
  # fichiers suivis, et c'est delibere : une entree de journal non suivie est un
  # travail en cours et ne se juge pas.
  fichiers_md() {
    { git ls-files "$@"; git ls-files --others --exclude-standard -- "$@"; } | LC_ALL=C sort -u
  }

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
    done < <(fichiers_md '*.md')
  done
  [ "$evades" -eq 0 ] && ok "aucun PRODUCT.md ou README.md d'app duplique hors de son repertoire"

  # Le controle ci-dessus n'attrape qu'une copie CONFORME. Le cas courant est
  # plus discret : un document d'app -- PRD, PRP, plan -- redige directement
  # sous docs/ et qui n'y ressemble a rien d'autre. Les competences superpowers
  # y ecrivent leurs specs et leurs plans par defaut, ce qui est juste pour un
  # sujet de fabrique et faux pour un sujet d'app : trois PRD et neuf PRP y
  # avaient echoue, hors de portee du controle de liens morts, qui ne lit que
  # apps/*/*.md. Le critere est le NOM : un chemin sous docs/ qui contient le
  # nom d'un repertoire d'apps/ parle d'une app et doit demenager dans
  # apps/<nom>/ ; un document de fabrique n'en porte aucun. Les repertoires
  # d'apps/ sont lus directement, pas via discover_apps : une app encore
  # reduite a ses documents n'a pas d'app.yml, et c'est precisement elle dont
  # les documents s'egarent.
  egares=0
  while IFS= read -r doc; do
    [ -n "$doc" ] || continue
    for d in apps/*/; do
      [ -d "$d" ] || continue
      n=${d#apps/}; n=${n%/}
      case "$doc" in
        *"$n"*) bad "$doc parle de l'app $n — son domicile est apps/$n/ (PRODUCT.md pour le PRD, prp/ pour les PRP)"
                egares=$((egares+1)); break ;;
      esac
    done
  done < <(fichiers_md 'docs/*.md' 'docs/**/*.md')
  [ "$egares" -eq 0 ] && ok "aucun document d'app egare sous docs/"

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
}

check_outillage() {
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
           .claude/agents/artisan.md \
           .claude/commands/livrer.md .claude/commands/pas-a-pas.md \
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

  # Le rapport d'ouverture de session porte sa PROPRE liste de plugins et de
  # serveurs de langage, en dur. settings.json et cloud-setup.sh etaient
  # verifies, lui non : typescript-lsp y a manque pendant que marcq-handball
  # etait deja en typescript, et un artisan pouvait donc perdre les diagnostics
  # du compilateur sans que rien ne le dise. Un defaut silencieux coute plus en
  # allers-retours qu'aucune economie de jetons ne rapporte.
  if [ -f .claude/check-plugins.sh ]; then
    drift=0
    for p in "${PLUGIN_IDS[@]}"; do grep -qF "$p" .claude/check-plugins.sh || drift=1; done
    for t in "${LSP_TRIPLETS[@]-}"; do [ -z "$t" ] || grep -qF "$t" .claude/check-plugins.sh || drift=1; done
    [ "$drift" = 0 ] && ok "check-plugins.sh aligne sur ${#PLUGIN_IDS[@]} plugins" \
                     || warn "check-plugins.sh desynchronise — un plugin ou un LSP attendu n'y est pas verifie"
  fi

  # memory/ pese ~15 000 jetons, cinq fois le contrat lui-meme, et ne coute
  # RIEN par tour : il est lu a la demande, sur le declencheur du sommaire. Un
  # « @memory/... » dans un fichier charge d'office — le contrat, une notice
  # d'app, la definition d'un agent — le transformerait en charge fixe, relue a
  # chaque echange de chaque session. Le controle porte sur un comportement qui
  # n'existe pas encore : il est vert aujourd'hui, et c'est le but.
  if grep -l '@memory/' CLAUDE.md apps/*/CLAUDE.md .claude/agents/*.md 2>/dev/null | grep -q .; then
    bad "import automatique @memory/ — memory/ se lit a la demande ; importe, il serait relu a chaque tour"
  else
    ok "aucun import automatique de memory/"
  fi

  # 6. Journal des anomalies. Une entree suivie par git est une entree livree :
  # elle doit dire quelque chose. Une entree non suivie est un travail en cours,
  # et ne se juge pas — c'est ce qui laisse --check vert entre l'ouverture de la
  # branche et le premier commit, sans rien relacher en CI, ou tout est suivi.
}

check_journal() {
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

    # Un releve de cout sans son detail par tour est hors de portee de
    # ./scripts/jetons.sh : il entre dans le total du depot et dans aucun poste.
    # AVERTISSEMENT et jamais KO — le bloc de detail est arrive apres les huit
    # premieres entrees, et le fichier de conversation qui les a produites a
    # disparu avec son conteneur. Il n'y a rien a reparer, seulement a savoir.
    sans_detail=0
    for e in journal/*.md; do
      [ -f "$e" ] || continue
      grep -q '^<!-- cout-total:' "$e" || continue
      grep -q '^<!-- cout-detail' "$e" || sans_detail=$((sans_detail+1))
    done
    [ "$sans_detail" -gt 0 ] && warn "$sans_detail releve(s) de cout sans detail par tour — hors de portee de ./scripts/jetons.sh"
  else
    warn "aucun journal/ — la premiere ./scripts/branche.sh l'ouvrira"
  fi

  # 7. Secrets. Les motifs de jeton sont ecrits avec une classe d'un seul
  # caractere — gh[p]_ — pour que ce script, lui-meme suivi par git, ne se
  # detecte pas comme fuite a chaque lancement.
}

check_secrets() {
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


  check_manifestes
  check_artefacts
  check_services
  check_applications
  check_fabrique
  check_outillage
  check_journal
  check_secrets

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
apply_pins
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
  while IFS= read -r f; do
    if [ "$f" = go.work ] && ! emit go.work >/dev/null 2>&1; then continue; fi
    if [ ! -f "$f" ]; then
      warn "$f serait cree"
    elif diff -q <(emit "$f") "$f" >/dev/null 2>&1; then
      ok "$f inchange"
    else
      warn "$f changerait :"
      diff -u "$f" <(emit "$f") | sed 's/^/    /' || true
    fi
  done < <(liste_derives)
  exit 0
fi

# Un fichier de routage laisse a cote divergerait en silence de compose.yaml.
for dead in "$LEGACY_COMPOSE" .dockerignore; do
  if [ -f "$dead" ]; then rm -f "$dead"; ok "$dead supprime (sans effet dans la fabrique)"; fi
done

# Les artefacts derives sont toujours reecrits : c'est ce qui garantit qu'une
# app ajoutee ne peut pas manquer du compose ni de la CI.
while IFS= read -r f; do
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
done < <(liste_derives)
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
