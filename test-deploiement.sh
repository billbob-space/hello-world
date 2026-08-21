#!/usr/bin/env bash
#
# test-deploiement.sh — le contrat de test du VERDICT de mise en ligne, dans
# .github/workflows/build.yml, etape « declencher le deploiement ».
#
#   ./test-deploiement.sh            lance tous les cas
#   ./test-deploiement.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Pourquoi ce fichier existe. Ce verdict est le DERNIER mot de la chaine : c'est
# lui qui decide si « la mise en ligne a eu lieu ». Il vit en shell inline dans
# un YAML, il n'a jamais tourne ailleurs qu'en integration continue, et ses trois
# entrees -- le code HTTP, le corps rendu par dockhand, et ce que l'etape
# precedente a etabli -- ne se combinent JAMAIS toutes sur un run reel. Aucune
# relecture ne peut donc voir qu'une de ces combinaisons rend le mauvais verdict.
#
# Ce n'est pas theorique. Le 21 aout 2026, la version precedente affichait
# « verifie que le conteneur dockhand resout github.com » sur une infrastructure
# parfaitement saine, parce qu'elle tenait pour acquis quelque chose qui n'etait
# vrai que sur un de ses chemins d'entree. Un quart d'heure de chasse a une panne
# inexistante -- et l'inverse, un jour, coutera une mise en ligne qu'on croira
# faite.
#
# Il n'y a pas de recopie du verdict ici : les cas EXTRAIENT le bloc du workflow
# et l'executent tel quel. Une recopie se serait desynchronisee au premier
# changement, et aurait continue a rendre vert -- ce que ce depot appelle un vert
# silencieux.

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

# --- l'extraction ----------------------------------------------------------------
#
# Du premier test sur le code HTTP jusqu'a la ligne de succes. Les deux bornes
# sont des lignes du workflow : si l'une disparait, l'extraction echoue FORT
# plutot que de tester un bloc vide -- un test qui ne teste rien passe au vert.
VERDICT="$TEMP/verdict.sh"
python3 - "$VERDICT" <<'PY'
import io, sys
lignes = io.open(".github/workflows/build.yml", encoding="utf-8").read().splitlines()
def seule(motif):
    i = [n for n, l in enumerate(lignes) if l.strip() == motif]
    if len(i) != 1:
        sys.exit("borne « %s » trouvee %d fois dans build.yml, attendu 1" % (motif, len(i)))
    return i[0]
d = seule('if [ "$code" = 403 ]; then')
f = seule('echo "deploiement declenche"')
if f <= d:
    sys.exit("les bornes du verdict sont dans le desordre dans build.yml")
bloc = lignes[d:f + 1]
marge = min(len(l) - len(l.lstrip()) for l in bloc if l.strip())
io.open(sys.argv[1], "w", encoding="utf-8").write(
    "#!/usr/bin/env bash\nset -uo pipefail\n" + "\n".join(l[marge:] for l in bloc) + "\n")
print("  %d lignes de verdict extraites de build.yml" % len(bloc))
PY

# cas <nom> <code HTTP> <etabli> <corps rendu par dockhand> <ok|ko> <motif attendu>
cas() {
  local nom="$1" code="$2" etabli="$3" corps="$4" attendu="$5" motif="$6"
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  local d obtenu r
  d=$(mktemp -d "$TEMP/cas.XXXXXX")
  printf '%s' "$corps" > "$d/reponse.txt"
  set +e
  ( cd "$d" && code="$code" ETABLI="$etabli" bash "$VERDICT" ) > "$d/sortie" 2>&1
  r=$?
  set -e
  obtenu=ko; [ "$r" -eq 0 ] && obtenu=ok
  if [ "$obtenu" != "$attendu" ]; then
    echec "$nom" "verdict $obtenu, attendu $attendu — $(tr '\n' '|' < "$d/sortie" | cut -c1-200)"
    return 0
  fi
  if ! grep -qF "$motif" "$d/sortie"; then
    echec "$nom" "verdict bon mais le message ne porte pas << $motif >> — $(tr '\n' '|' < "$d/sortie" | cut -c1-200)"
    return 0
  fi
  reussi "$nom"
}

SAUTE='{"success":true,"output":"No changes detected, skipping redeploy","skipped":true}'

printf '\n-- « saute » ne veut pas dire la meme chose selon ce qui est etabli\n'

# Le cas qui a coute le quart d'heure du 21 aout : rien n'etablit qu'il y avait
# a deployer, dockhand repond qu'il est deja a jour -- c'est la BONNE reponse.
cas "rien d etabli, deja a jour : pas un echec" \
    200 non "$SAUTE" ok "n'avait rien a deployer"
# ... mais jamais en silence : si la stack N'EST pas a jour, ce message est la
# seule piste qui existera.
cas "rien d etabli : la piste est quand meme donnee" \
    200 non "$SAUTE" ok "ne voit pas la poussee"
cas "rien d etabli : l etat reel se regarde" \
    200 non "$SAUTE" ok "./scripts/prod.sh"

# Le garde-fou d'origine, intact : quand l'etape precedente a ETABLI qu'il y a a
# faire, un saut est une panne, et le job doit rougir.
cas "changement etabli, dockhand saute : echec" \
    200 oui "$SAUTE" ko "n'a pas vu la poussee"

# Le defaut par defaut : une variable absente ne doit pas se lire « oui ».
cas "etabli absent vaut non, jamais oui" \
    200 ""  "$SAUTE" ok "n'avait rien a deployer"
cas "etabli d une valeur inattendue vaut non" \
    200 "peut-etre" "$SAUTE" ok "n'avait rien a deployer"

printf '\n-- les verdicts qui ne doivent pas bouger\n'

cas "dockhand refuse : success false" \
    200 non '{"success":false,"error":"clone failed"}' ko "a refuse le deploiement"
cas "un deploiement reel reste un succes" \
    200 non '{"success":true,"output":"Container pilabelle Recreated"}' ok "deploiement declenche"
cas "403 : le secret ne correspond pas" \
    403 oui '{}' ko "le secret envoye ne correspond pas"
cas "500 : le webhook refuse l appel" \
    500 non '{}' ko "rien n'est deploye"

# « success:false » prime sur « skipped » : il couvre toutes les causes de refus,
# la ou le second n'en couvre qu'une. Les deux ensemble doivent rendre l'echec le
# plus informatif des deux.
cas "refus ET saut : c est le refus qui parle" \
    200 non '{"success":false,"skipped":true,"error":"clone failed"}' ko "a refuse le deploiement"

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
