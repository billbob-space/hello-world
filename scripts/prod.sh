#!/usr/bin/env bash
#
# prod.sh — regarder la production, sans pouvoir y toucher.
#
#   ./scripts/prod.sh                          l'etat des services de la stack
#   ./scripts/prod.sh --tout                   ... et les autres conteneurs de l'hote
#   ./scripts/prod.sh journaux <service> [n]   les n dernieres lignes (defaut 100)
#   ./scripts/prod.sh fichiers <service> [chemin]
#   ./scripts/prod.sh lire     <service> <chemin>
#   ./scripts/prod.sh inspecter <service>
#
# Le serveur n'est joignable ni en SSH ni par le socket Docker : il est derriere
# Traefik, qui exige un compte Google avant de laisser passer quoi que ce soit.
# Un agent n'a pas de navigateur — donc pas de compte. Le seul chemin est l'API
# de dockhand, qui gere la stack, ouverte par une PORTE DE SERVICE : un routeur
# Traefik supplementaire sur dockhand.billbob.ovh, limite au chemin /api et a la
# METHODE GET, sans ForwardAuth. Voir README.md, « Regarder la production ».
#
# Cette limitation a la methode GET est la raison d'etre de ce script, et sa
# garantie : la lecture seule n'est pas une convention qu'il s'impose, c'est le
# routeur qui la tient. Un POST vers cette porte ne l'atteint meme pas — il
# retombe sur le routeur d'origine et se fait rediriger vers Google. Le jeton
# porte pourtant TOUS les droits (dockhand en edition libre ignore les roles) :
# s'il fuitait, seule la porte empecherait d'arreter la stack. Ne pas elargir la
# regle du routeur sans mesurer ce que cela rouvre.
#
# Deux variables, injectees par l'environnement, jamais ecrites dans le depot :
#   DOCKHAND_URL     https://dockhand.billbob.ovh
#   DOCKHAND_TOKEN   un jeton d'API cree dans les reglages de dockhand
# Ce script ne les imprime jamais, pas meme tronquees.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh

command -v python3 >/dev/null || {
  echo "ERREUR : python3 absent — il lit les reponses JSON de dockhand." >&2; exit 1; }

: "${DOCKHAND_URL:=}" "${DOCKHAND_TOKEN:=}"
if [ -z "$DOCKHAND_URL" ] || [ -z "$DOCKHAND_TOKEN" ]; then
  cat >&2 <<'FIN'
ERREUR : DOCKHAND_URL et DOCKHAND_TOKEN doivent etre dans l'environnement.

Elles ne vivent pas dans le depot — il est public pour l'outillage, un jeton
qui y entre est un jeton perdu. Pose-les dans les variables d'environnement de
la session cloud (claude.ai/code, reglages de l'environnement du projet) :

  DOCKHAND_URL     l'adresse de dockhand, sans barre finale
  DOCKHAND_TOKEN   Settings > API tokens, dans dockhand

Une session deja ouverte ne les voit pas : il faut en ouvrir une nouvelle.
FIN
  exit 1
fi

ENV_ID=${DOCKHAND_ENV:-1}   # 1 = le demon Docker local de l'hote, defaut dockhand

# --- l'API, en lecture seule ---------------------------------------------------
#
# Un seul point de sortie vers le reseau. Il distingue les trois echecs qui ne se
# reparent pas au meme endroit : la porte fermee (307, cote serveur), le jeton
# refuse (401, cote dockhand), et le reste. Sans ce tri, une porte refermee se
# lit comme une panne de dockhand et on cherche au mauvais endroit — c'est ce qui
# est arrive la premiere fois.
api() {  # api <chemin-et-parametres> — imprime le corps, sort non nul si echec
  local chemin="$1" code corps
  corps=$(mktemp); trap 'rm -f "$corps"' RETURN
  code=$(curl -sS -o "$corps" -w '%{http_code}' --max-time 30 \
           -H "Authorization: Bearer $DOCKHAND_TOKEN" "$DOCKHAND_URL$chemin" 2>/dev/null) || {
    echo "ERREUR : $DOCKHAND_URL injoignable — reseau, ou politique de sortie de l'environnement." >&2
    return 1; }

  case "$code" in
    200) cat "$corps"; return 0 ;;
    30*) echo "ERREUR : redirection $code vers l'authentification Google — la porte de service est fermee." >&2
         echo "        Le routeur 'dockhand-api' manque ou ne couvre plus ce chemin ; voir README.md." >&2 ;;
    401) echo "ERREUR : 401 — jeton refuse par dockhand. Il a ete revoque, ou DOCKHAND_TOKEN est perime." >&2 ;;
    404) echo "ERREUR : 404 sur $chemin — chemin inconnu de cette version de dockhand." >&2 ;;
    *)   echo "ERREUR : HTTP $code sur $chemin." >&2
         head -c 400 "$corps" >&2; echo >&2 ;;
  esac
  return 1
}

py() { python3 -c "$1" "${@:2}"; }

# --- les services de la stack ---------------------------------------------------
#
# Lus dans compose.yaml plutot que demandes a dockhand : c'est le depot qui dit
# ce que la fabrique est censee faire tourner. Un service present ici et absent
# la-bas est precisement l'anomalie qu'on veut voir.
services_de_la_stack() {
  awk '/^services:/{d=1;next} /^[a-z]/{d=0} d && /^  [a-z0-9-]+:$/{gsub(/[ :]/,"");print}' compose.yaml
}

conteneurs() {  # le JSON de tous les conteneurs de l'hote, mis en cache le temps du script
  [ -n "${CONTENEURS_JSON:-}" ] || CONTENEURS_JSON=$(api "/api/containers?env=$ENV_ID")
  printf '%s' "$CONTENEURS_JSON"
}

# id_de <nom> — l'identifiant du conteneur, ou un message qui dit quoi taper.
id_de() {
  local nom="$1" id
  id=$(conteneurs | py '
import json,sys
nom=sys.argv[1]
d=json.load(sys.stdin)
for c in d:
    if c["name"] == nom: print(c["id"]); break
' "$nom")
  if [ -z "$id" ]; then
    echo "ERREUR : aucun conteneur nomme '$nom' sur l hote." >&2
    echo "        Les services de la stack : $(services_de_la_stack | paste -sd' ' -)" >&2
    echo "        Pour la liste complete :  ./scripts/prod.sh --tout" >&2
    return 1
  fi
  printf '%s' "$id"
}

# --- les commandes --------------------------------------------------------------

cmd_etat() {  # cmd_etat [--tout]
  local tout="${1:-}" json
  json=$(conteneurs)
  local stack; stack=$(services_de_la_stack | paste -sd, -)

  printf '%s' "$json" | py '
import json,sys
stack = [s for s in sys.argv[1].split(",") if s]
tout  = sys.argv[2] == "--tout"
etat  = {c["name"]: c for c in json.load(sys.stdin)}

def ligne(nom, c):
    if c is None:
        print("  \033[31mKO\033[0m    %-26s absent de l hote" % nom); return
    s = c.get("state", "?")
    st = c.get("status", "")
    marque = "\033[32mok\033[0m  " if s == "running" else "\033[31mKO\033[0m  "
    print("  %s  %-26s %-10s %s" % (marque, nom, s, st))

print("-- la stack de la fabrique")
for nom in stack:
    ligne(nom, etat.get(nom))

if tout:
    print()
    print("-- les autres conteneurs de l hote")
    for nom in sorted(k for k in etat if k not in stack):
        ligne(nom, etat[nom])
else:
    autres = len(etat) - sum(1 for s in stack if s in etat)
    print()
    print("  %d autre(s) conteneur(s) sur l hote — ./scripts/prod.sh --tout" % autres)
' "$stack" "$tout"
}

cmd_journaux() {
  local nom="${1:?usage : ./scripts/prod.sh journaux <service> [lignes]}" n="${2:-100}" id
  id=$(id_de "$nom") || return 1
  api "/api/containers/$id/logs?env=$ENV_ID&tail=$n" \
    | py 'import json,sys; sys.stdout.write(json.load(sys.stdin).get("logs",""))'
}

cmd_fichiers() {
  local nom="${1:?usage : ./scripts/prod.sh fichiers <service> [chemin]}" chemin="${2:-/}" id
  id=$(id_de "$nom") || return 1
  api "/api/containers/$id/files?env=$ENV_ID&path=$chemin" | py '
import json,sys
d = json.load(sys.stdin)
print(d.get("path","/"))
for e in d.get("entries", []):
    marque = "/" if e.get("type") == "directory" else " "
    print("  %-10s %10s  %s%s" % (e.get("permissions",""), e.get("size",""), e.get("name",""), marque))
'
}

cmd_lire() {
  local nom="${1:?usage : ./scripts/prod.sh lire <service> <chemin>}" chemin="${2:?chemin manquant}" id
  id=$(id_de "$nom") || return 1
  api "/api/containers/$id/files/content?env=$ENV_ID&path=$chemin" \
    | py 'import json,sys; sys.stdout.write(json.load(sys.stdin).get("content",""))'
}

cmd_inspecter() {
  local nom="${1:?usage : ./scripts/prod.sh inspecter <service>}" id
  id=$(id_de "$nom") || return 1
  api "/api/containers/$id?env=$ENV_ID" | py 'import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))'
}

case "${1:-}" in
  ''|--tout)    cmd_etat "${1:-}" ;;
  journaux)     shift; cmd_journaux "$@" ;;
  fichiers)     shift; cmd_fichiers "$@" ;;
  lire)         shift; cmd_lire "$@" ;;
  inspecter)    shift; cmd_inspecter "$@" ;;
  -h|--help)    sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//' ;;
  *)            echo "commande inconnue : $1" >&2
                sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//' >&2
                exit 2 ;;
esac
