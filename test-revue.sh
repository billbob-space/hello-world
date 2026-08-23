#!/usr/bin/env bash
#
# test-revue.sh — le contrat de test de la revue outillee.
#
#   ./test-revue.sh            lance tous les cas
#   ./test-revue.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# POURQUOI CE FICHIER EXISTE. « scripts/revue.sh » est la seule piece de la
# fabrique qui puisse echouer EN OUVERT : rendre vert en n'ayant rien verifie.
# Ce n'est pas une crainte theorique — la premiere mesure de duplication de la
# fabrique a annonce « 0 % » sur du code que jscpd n'avait jamais ouvert, parce
# qu'un nom de format inconnu est ecarte en silence, code de retour 0 et rapport
# parfaitement bien forme. Un tel defaut ne se voit pas dans un diff, ne se voit
# pas dans la sortie, et rassure. Il ne se rattrape que par des cas.
#
# Les cas d'ici tiennent donc DEUX familles, et la seconde compte plus que la
# premiere :
#
#   - le cliquet — il serre, il ne desserre jamais, et il le dit ;
#   - le refus du vert silencieux — un outil qui tombe, qui ne lit rien, ou qui
#     ne lit qu'une partie du perimetre est un KO, jamais un axe vert.
#
# COMMENT. Chaque cas monte un bac a sable — un depot git minimal avec une app
# — et lance « scripts/revue.sh » EN ENTIER. Les outils, eux, sont des
# DOUBLURES : « go » et « npx » sont remplaces par des scripts en tete de PATH,
# pilotes par des variables d'environnement. C'est ce qui rend ces tests rapides
# et hors-ligne — et surtout ce qui permet de fabriquer a volonte les situations
# qu'un outil reel ne produit qu'accidentellement : un rapport sur zero fichier,
# un perimetre a moitie lu, un outil qui tombe.
#
# « node » n'est PAS double : la revue s'en sert pour lire les rapports JSON, et
# doubler le lecteur reviendrait a tester la doublure. Les rapports, eux, sont
# fabriques pour de vrai — donc ce que node lit ici est ce qu'il lira en vrai.

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

# --- le bac a sable ------------------------------------------------------------

# bac <couverture Go> [<lignes de app.yml a ajouter>] — imprime le chemin.
#
# L'app s'appelle toujours « appx ». Son contenu importe peu : les doublures ne
# le lisent pas. Ce qui compte est que les fichiers EXISTENT, parce que le
# controle de perimetre de la duplication les compte pour de vrai — c'est le
# seul endroit ou la revue mesure le monde plutot que de croire un outil.
bac() {
  local d; d=$(mktemp -d "$TEMP/bac.XXXXXX")
  mkdir -p "$d/lib" "$d/scripts" "$d/apps/appx" "$d/bin"
  cp "$SOURCE/lib/socle.sh"     "$d/lib/"
  cp "$SOURCE/scripts/revue.sh" "$d/scripts/"

  cat > "$d/fabrique.yml" <<'YML'
org: test
repo: test
outil_toolchain: go0.0.0
outil_staticcheck: doublure/staticcheck@v0
outil_gosec: doublure/gosec@v0
outil_govulncheck: doublure/govulncheck@v0
outil_jscpd: doublure-jscpd@v0
YML

  printf 'enabled: true\nport: 8080\n' > "$d/apps/appx/app.yml"
  [ $# -lt 2 ] || printf '%s\n' "$2" >> "$d/apps/appx/app.yml"

  # Deux fichiers Go de production, et un test — le test ne compte PAS dans le
  # perimetre de duplication, et c'est precisement une des regles a tenir.
  printf 'package main\n' > "$d/apps/appx/main.go"
  printf 'package main\n' > "$d/apps/appx/autre.go"
  printf 'package main\n' > "$d/apps/appx/main_test.go"
  printf 'module appx\n'  > "$d/apps/appx/go.mod"

  doublures "$d" "$1"
  ( cd "$d" && git init -q . && git config user.email t@t && git config user.name t )
  printf '%s' "$d"
}

# doublures <bac> <couverture Go> — ecrit les faux « go » et « npx ».
#
# Elles obeissent a des variables d'environnement pour que chaque cas fabrique
# SA situation sans toucher au script teste. Les valeurs par defaut decrivent
# une app saine : tout est vert, rien n'est trouve.
doublures() {
  local d="$1" couverture="$2"

  # « go install » plutot que « go run » : c'est ainsi que revue.sh se procure
  # ses outils depuis qu'un « go run » lance dans une app s'est mis a reecrire
  # son go.mod. La doublure depose donc de faux binaires dans GOBIN, et c'est
  # eux que la revue appellera ensuite.
  cat > "$d/bin/go" <<GO
#!/usr/bin/env bash
# Doublure de « go ». Elle ne compile rien : elle rejoue des sorties, et
# JOURNALISE la sous-commande demandee — c'est ce journal qui prouve que la revue
# n'appelle jamais « go run » depuis une app.
set -uo pipefail
printf '%s\n' "\$1" >> "$d/appels-go"
case "\$1" in
  install)
    nom="\${2%@*}"; nom="\${nom##*/}"
    mkdir -p "\$GOBIN"
    cp "$d/bin/faux-\$nom" "\$GOBIN/\$nom" 2>/dev/null || {
      printf '#!/usr/bin/env bash\nexit 0\n' > "\$GOBIN/\$nom"; }
    chmod +x "\$GOBIN/\$nom"
    exit 0 ;;
  test)
    [ "\${FAUX_TESTS_ROUGES:-0}" = 1 ] && { echo "FAIL appx"; exit 1; }
    for arg in "\$@"; do case "\$arg" in
      -coverprofile=*) printf 'mode: set\nappx/main.go:1.1,2.1 1 1\n' > "\${arg#-coverprofile=}" ;;
    esac; done
    exit 0 ;;
  tool)
    printf 'total:\t(statements)\t%s%%\n' "$couverture"; exit 0 ;;
esac
exit 0
GO

  cat > "$d/bin/faux-staticcheck" <<'SC'
#!/usr/bin/env bash
set -uo pipefail
# FAUX_TUE=<app> tue le processus qui a lance cet outil, depuis le repertoire de
# cette app. C'est le seul moyen de fabriquer ce qu'aucun test ne peut demander
# poliment : un enfant du fan-out qui meurt SANS rendre de verdict.
[ "${FAUX_TUE:-}" = "$(basename "$PWD")" ] && kill -9 "$PPID"
[ -n "${FAUX_STATICCHECK:-}" ] && { printf '%s\n' "$FAUX_STATICCHECK"; exit 1; }
exit 0
SC

  cat > "$d/bin/faux-gosec" <<'GS'
#!/usr/bin/env bash
set -uo pipefail
out=""
for arg in "$@"; do case "$arg" in -out=*) out="${arg#-out=}" ;; esac; done
# Le defaut s'ecrit sur sa propre ligne et JAMAIS dans un « ${x:-...} » : les
# accolades du JSON fermeraient l'expansion avant sa fin, et le rapport partirait
# tronque — une doublure fausse qui ferait echouer des cas justes.
# FAUX_GOSEC_MUET rejoue le vrai comportement de « gosec -quiet » sur une app
# saine : sortie 0, et AUCUN fichier de rapport ecrit.
[ "${FAUX_GOSEC_MUET:-0}" = 1 ] && exit 0
if [ -n "${FAUX_GOSEC:-}" ]; then
  printf '%s' "$FAUX_GOSEC" > "$out"
else
  printf '{"Issues":[],"Stats":{"files":2}}' > "$out"
fi
exit 0
GS

  cat > "$d/bin/faux-govulncheck" <<'GV'
#!/usr/bin/env bash
set -uo pipefail
printf '%s\n' "${FAUX_GOVULN:-No vulnerabilities found.}"
exit "${FAUX_GOVULN_RC:-0}"
GV

  # Doublure de « npm audit ». Trois comportements, parce que les trois se
  # distinguent mal a l'oeil et pas du tout dans un code de retour : audit sain,
  # audit qui TROUVE (npm sort en 1, ce qui est normal), et audit qui N'A PAS
  # CONCLU — registre injoignable, ou npm ecrit un objet d'erreur sans metadata
  # et sort en 1 lui aussi.
  cat > "$d/bin/npm" <<'NPM'
#!/usr/bin/env bash
set -uo pipefail
# « npm test » — la chaine de test client vitest. La doublure n'execute pas
# vitest : elle ECRIT le rapport que le rapporteur json-summary aurait ecrit,
# dans son format reel. Trois comportements, parce qu'ils se confondent tous
# dans un code de retour 0 : mesure normale, tests rouges, et l'app dont le
# script `test` ne DEMANDE pas de couverture — celle-la sort en 0 sans rien
# ecrire, et c'est le cas ou un rapport perime se ferait passer pour la mesure
# du jour.
if [ "${1:-}" = test ]; then
  [ "${FAUX_VITEST_RC:-0}" != 0 ] && { echo "FAIL  tests/exemple.test.ts"; exit "${FAUX_VITEST_RC}"; }
  [ "${FAUX_VITEST_MUET:-0}" = 1 ] && exit 0
  mkdir -p coverage
  printf '{"total":{"lines":{"pct":%s}}}' "${FAUX_VITEST_PCT:-71}" > coverage/coverage-summary.json
  exit 0
fi
[ "${1:-}" = audit ] || exit 0
if [ "${FAUX_NPM_MUET:-0}" = 1 ]; then
  printf '{"message":"request to https://registry.npmjs.org failed, reason: ECONNREFUSED"}'
  exit 1
fi
printf '{"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":%s,"critical":%s,"total":0}}}' \
  "${FAUX_NPM_HAUTES:-0}" "${FAUX_NPM_CRITIQUES:-0}"
[ "${FAUX_NPM_HAUTES:-0}" = 0 ] && [ "${FAUX_NPM_CRITIQUES:-0}" = 0 ] && exit 0
exit 1
NPM

  cat > "$d/bin/npx" <<'NPX'
#!/usr/bin/env bash
# Doublure de « npx jscpd ». Elle fabrique un rapport JSON REEL — c'est node,
# le vrai, qui le relira ensuite.
set -uo pipefail
out=""
prochain=0
for arg in "$@"; do
  [ "$prochain" = 1 ] && { out="$arg"; prochain=0; continue; }
  [ "$arg" = "--output" ] && prochain=1
done
mkdir -p "$out"
cat > "$out/jscpd-report.json" <<JSON
{ "statistics": {
    "formats": { "go": { "total": { "sources": ${FAUX_JSCPD_SOURCES:-2} } } },
    "total": { "percentage": ${FAUX_JSCPD_PCT:-0} } } }
JSON
exit 0
NPX

  chmod +x "$d/bin/go" "$d/bin/npx" "$d/bin/npm" "$d/bin/faux-staticcheck" "$d/bin/faux-gosec" "$d/bin/faux-govulncheck"
}

# avec_tests_navigateur <bac> — ajoute a l'app un module et son test node --test.
#
# Ces fichiers-la sont REELS et node n'est pas double : la couverture navigateur
# se lit sur la vraie sortie de « node --test --experimental-test-coverage »,
# dont les colonnes sont separees par des barres verticales. Une doublure aurait
# rejoue le format que je CROIS que node produit — et c'est precisement la
# lecture de ce format qui s'etait trompee, en prenant le separateur pour une
# valeur.
avec_tests_navigateur() {
  local d="$1"
  mkdir -p "$d/apps/appx/tests" "$d/apps/appx/web"
  printf '{"name":"appx","type":"module"}\n' > "$d/apps/appx/package.json"
  # Le corps de jamaisAppelee tient sur PLUSIEURS lignes, et c'est deliberé : une
  # fonction jamais appelee mais declaree sur une seule ligne compte comme
  # couverte — la declaration s'execute au chargement du module. Sur une seule
  # ligne, l'app bouchon mesurait 100 % et aucun plancher n'etait franchissable.
  cat > "$d/apps/appx/web/calc.js" <<'JS'
export function double(n) { return n * 2 }
export function jamaisAppelee(n) {
  if (n > 0) {
    return n + 1
  }
  return 0
}
JS
  cat > "$d/apps/appx/tests/calc.test.js" <<'JS'
import { test } from 'node:test'
import assert from 'node:assert'
import { double } from '../web/calc.js'
test('double', () => { assert.equal(double(2), 4) })
JS
}

# avec_client_vitest <bac> — donne a l'app un client TypeScript sous web/, la
# SECONDE famille de chaine de test reconnue par l'axe couverture. Ce que la
# detection exige : un package.json qui declare vitest ET un script « test ».
# Rien n'est installe — c'est la doublure de npm qui rejoue la mesure.
avec_client_vitest() {
  mkdir -p "$1/apps/appx/web"
  cat > "$1/apps/appx/web/package.json" <<'JSON'
{ "name": "appx-web", "private": true,
  "scripts": { "test": "vitest run --coverage" },
  "devDependencies": { "vitest": "^2.1.5" } }
JSON
}

# avec_client_inconnu <bac> — un client qui n'entre dans AUCUNE des deux
# familles : ni tests/*.test.js, ni vitest. C'est le cas ou l'axe ne peut rien
# mesurer et ou il doit le DIRE, sous peine de rendre le verdict Go seul pour un
# verdict complet.
avec_client_inconnu() {
  printf '{ "name": "appx", "private": true, "scripts": { "build": "true" } }\n' > "$1/apps/appx/package.json"
}

# avec_verrou_npm <bac> — donne a l'app un package.json ET son verrou, ce qui
# est la SEULE condition qui declenche l'audit npm dans revue.sh.
avec_verrou_npm() {
  printf '{"name":"appx","dependencies":{"bidule":"1.0.0"}}\n' > "$1/apps/appx/package.json"
  printf '{"lockfileVersion":3}\n'                             > "$1/apps/appx/package-lock.json"
}

# revue <bac> [<arguments>] — lance la revue dans le bac et rend sa sortie.
# Le code de sortie n'est PAS observe : chaque cas juge une LIGNE precise, parce
# qu'un « 1 » global ne distingue pas l'axe qui a bloque de celui qui a saute.
revue() {
  local d="$1"; shift
  ( cd "$d" && PATH="$d/bin:$PATH" ./scripts/revue.sh appx "$@" 2>&1 ) || true
}

# Le fan-out ne se declenche qu'a partir de DEUX cibles : ces deux aides sont
# ce qui separe le chemin serie du chemin parallele.
bac2() {  # bac2 <couverture> — le bac ordinaire, plus une seconde app « appy »
  local d; d=$(bac "$1")
  cp -r "$d/apps/appx" "$d/apps/appy"
  printf '%s' "$d"
}

revue2() {  # revue2 <bac> [<options>] — les deux apps, donc le fan-out
  local d="$1"; shift
  ( cd "$d" && PATH="$d/bin:$PATH" ./scripts/revue.sh appx appy "$@" 2>&1 ) || true
}

# cas <nom> <motif attendu dans la sortie> — le bac et l'appel viennent de
# l'entree standard, sous forme de code shell ou « $d » designe le bac.
cas() {
  local nom="$1" attendu="$2" corps sortie d
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  corps=$(cat)
  sortie=$(eval "$corps") || true
  if printf '%s' "$sortie" | grep -qE "$attendu"; then
    reussi "$nom"
  else
    echec "$nom" "attendu : /$attendu/ — obtenu : $(printf '%s' "$sortie" | tr '\n' '|' | cut -c1-300)"
  fi
}

echo "-- le cliquet"

cas "sans barre posee, la revue avertit et ne bloque pas" \
    'attn.*couverture.*aucune barre posee' <<'FIN'
d=$(bac 64); revue "$d"
FIN

cas "--releve pose la barre au niveau du jour, tronque vers le bas" \
    'revue_couverture: 64' <<'FIN'
d=$(bac 64.9); revue "$d" --releve >/dev/null; cat "$d/apps/appx/app.yml"
FIN

cas "la couverture sous la barre bloque" \
    'KO.*couverture.*plancher 90 %.*ne redescend pas' <<'FIN'
d=$(bac 64 'revue_couverture: 90'); revue "$d"
FIN

cas "--releve refuse de desserrer la couverture, et le dit" \
    'couverture inchange — la mesure est sous la barre' <<'FIN'
d=$(bac 64 'revue_couverture: 90'); revue "$d" --releve
FIN

cas "--releve ne desserre pas le fichier non plus" \
    'revue_couverture: 90' <<'FIN'
d=$(bac 64 'revue_couverture: 90'); revue "$d" --releve >/dev/null; cat "$d/apps/appx/app.yml"
FIN

cas "--releve serre la couverture quand elle monte" \
    'revue_couverture: 64' <<'FIN'
d=$(bac 64 'revue_couverture: 30'); revue "$d" --releve >/dev/null; cat "$d/apps/appx/app.yml"
FIN

cas "la duplication au-dessus du plafond bloque" \
    'KO.*duplication.*plafond est a 1 %' <<'FIN'
d=$(bac 64 'revue_duplication: 1'); FAUX_JSCPD_PCT=5 revue "$d"
FIN

cas "le plafond de duplication ne remonte pas" \
    'revue_duplication: 1' <<'FIN'
d=$(bac 64 'revue_duplication: 1'); FAUX_JSCPD_PCT=5 revue "$d" --releve >/dev/null
cat "$d/apps/appx/app.yml"
FIN

cas "le plafond de duplication s'arrondit vers le haut" \
    'revue_duplication: 3' <<'FIN'
d=$(bac 64); FAUX_JSCPD_PCT=2.91 revue "$d" --releve >/dev/null; cat "$d/apps/appx/app.yml"
FIN

cas "la couverture navigateur est un nombre, pas le separateur de colonnes" \
    'revue_couverture_web: [0-9]+' <<'FIN'
d=$(bac 64); avec_tests_navigateur "$d"; revue "$d" --releve >/dev/null
cat "$d/apps/appx/app.yml"
FIN

cas "la couverture navigateur sous sa barre bloque" \
    'KO.*couverture.*navigateur.*plancher 99 %' <<'FIN'
d=$(bac 64 'revue_couverture_web: 99'); avec_tests_navigateur "$d"; revue "$d"
FIN

cas "vitest est la seconde chaine cliente, et se lit" \
    'couverture.*navigateur 71' <<'FIN'
d=$(bac 64); avec_client_vitest "$d"; revue "$d"
FIN

cas "la barre navigateur se pose aussi sur une mesure vitest" \
    'revue_couverture_web: 71' <<'FIN'
d=$(bac 64); avec_client_vitest "$d"; revue "$d" --releve >/dev/null
cat "$d/apps/appx/app.yml"
FIN

cas "des tests clients rouges rendent la couverture sans valeur : KO" \
    'KO.*couverture.*tests navigateur echouent' <<'FIN'
d=$(bac 64); avec_client_vitest "$d"; FAUX_VITEST_RC=1 revue "$d"
FIN

cas "un rapport de couverture perime n'est jamais lu comme la mesure du jour" \
    'KO.*couverture.*illisible' <<'FIN'
d=$(bac 64); avec_client_vitest "$d"
mkdir -p "$d/apps/appx/web/coverage"
printf '{"total":{"lines":{"pct":99}}}' > "$d/apps/appx/web/coverage/coverage-summary.json"
FAUX_VITEST_MUET=1 revue "$d"
FIN

cas "un client qu'aucune chaine ne mesure fait crier l'axe" \
    'attn.*couverture.*client non mesure' <<'FIN'
d=$(bac 64); avec_client_inconnu "$d"; revue "$d"
FIN

echo
echo "-- le refus du vert silencieux"

cas "jscpd qui ne lit qu'une partie du perimetre : KO, jamais 0 %" \
    "KO.*duplication.*n'a lu que 1 fichiers sur 2" <<'FIN'
d=$(bac 64); FAUX_JSCPD_SOURCES=1 revue "$d"
FIN

cas "jscpd qui ne lit rien : KO" \
    "KO.*duplication.*n'a lu que 0 fichiers sur 2" <<'FIN'
d=$(bac 64); FAUX_JSCPD_SOURCES=0 revue "$d"
FIN

cas "jscpd qui lit tout le perimetre : vert" \
    'ok.*duplication.*0% sur 2 fichiers' <<'FIN'
d=$(bac 64 'revue_duplication: 0'); revue "$d"
FIN

cas "npm audit qui n'a pas conclu : KO, jamais « 0 vulnerabilite »" \
    "KO.*dependances.*npm audit n'a pas conclu" <<'FIN'
d=$(bac 64); avec_verrou_npm "$d"; FAUX_NPM_MUET=1 revue "$d"
FIN

cas "npm audit qui trouve une haute : bloque et se compte" \
    'KO.*dependances.*0 critique\(s\) et 2 haute\(s\) cote npm' <<'FIN'
d=$(bac 64); avec_verrou_npm "$d"; FAUX_NPM_HAUTES=2 revue "$d"
FIN

cas "npm audit sain : vert et dit" \
    'ok.*dependances.*0 critique\(s\) et 0 haute\(s\) cote npm' <<'FIN'
d=$(bac 64); avec_verrou_npm "$d"; revue "$d"
FIN

cas "gosec sur zero fichier : KO plutot que « aucun constat »" \
    'KO.*securite.*AUCUN fichier' <<'FIN'
d=$(bac 64); FAUX_GOSEC='{"Issues":[],"Stats":{"files":0}}' revue "$d"
FIN

cas "gosec sans rapport ecrit : KO distinct d'un outil tombe" \
    "KO.*securite.*n'a ecrit aucun rapport" <<'FIN'
d=$(bac 64); FAUX_GOSEC_MUET=1 revue "$d"
FIN

cas "le code qui ne compile pas : KO explicite, pas « aucun constat »" \
    'KO.*qualite.*ne compile pas' <<'FIN'
d=$(bac 64); FAUX_STATICCHECK='main.go:1:1: could not import x (compile)' revue "$d"
FIN

cas "des tests rouges rendent la couverture sans valeur : KO" \
    'KO.*couverture.*les tests Go echouent' <<'FIN'
d=$(bac 64); FAUX_TESTS_ROUGES=1 revue "$d"
FIN

cas "govulncheck qui ne conclut pas : KO, pas « 0 vulnerabilite »" \
    "KO.*dependances.*n'a pas conclu" <<'FIN'
d=$(bac 64); FAUX_GOVULN='panic: runtime error' FAUX_GOVULN_RC=2 revue "$d"
FIN

cas "la revue n'appelle jamais « go run » depuis une app" \
    '^(install|test|tool)+$' <<'FIN'
d=$(bac 64); revue "$d" >/dev/null
sort -u "$d/appels-go" | tr -d '\n'
FIN

echo
echo "-- les verdicts ordinaires"

cas "une gravite haute bloque" \
    'KO.*securite.*1 haute' <<'FIN'
d=$(bac 64)
FAUX_GOSEC='{"Issues":[{"severity":"HIGH","confidence":"HIGH","rule_id":"G404","file":"/x/apps/appx/main.go","line":"9","details":"aleatoire faible"}],"Stats":{"files":2}}' \
  revue "$d"
FIN

cas "une gravite haute nomme le fichier et la ligne" \
    'G404 appx/main.go:9' <<'FIN'
d=$(bac 64)
FAUX_GOSEC='{"Issues":[{"severity":"HIGH","confidence":"HIGH","rule_id":"G404","file":"/x/apps/appx/main.go","line":"9","details":"aleatoire faible"}],"Stats":{"files":2}}' \
  revue "$d"
FIN

cas "une gravite basse avertit sans bloquer" \
    'attn.*securite.*1 constat\(s\) de gravite basse' <<'FIN'
d=$(bac 64)
FAUX_GOSEC='{"Issues":[{"severity":"LOW","confidence":"HIGH","rule_id":"G104","file":"/x/apps/appx/main.go","line":"3","details":"erreur ignoree"}],"Stats":{"files":2}}' \
  revue "$d"
FIN

cas "les mises a l'ecart par #nosec se comptent et s'affichent" \
    'securite.*aucun constat sur 2 fichiers, 3 ecarte\(s\) par #nosec' <<'FIN'
d=$(bac 64)
FAUX_GOSEC='{"Issues":[],"Stats":{"files":2,"nosec":3}}' revue "$d"
FIN

cas "une vulnerabilite de dependance bloque et se nomme" \
    'GO-2026-5970' <<'FIN'
d=$(bac 64)
FAUX_GOVULN='Vulnerability #1: GO-2026-5970
    Found in: golang.org/x/text@v0.32.0
    Fixed in: golang.org/x/text@v0.39.0' FAUX_GOVULN_RC=3 revue "$d"
FIN

cas "un package.json sans verrou se dit, et ne bloque pas" \
    'dependances.*aucune dependance a auditer' <<'FIN'
d=$(bac 64); printf '{"name":"appx"}\n' > "$d/apps/appx/package.json"; revue "$d"
FIN

cas "une app sans app.yml n'est pas une app" \
    "KO.*pas d'app.yml" <<'FIN'
d=$(bac 64); rm "$d/apps/appx/app.yml"; revue "$d"
FIN

echo
echo "-- le fan-out"
#
# Une app par processus. Ce qui se teste ici n'est pas la vitesse — elle se
# mesure au banc, docs/banc/ — mais les trois choses que le parallelisme peut
# casser en silence : l'ordre de la sortie, l'agregation des verdicts, et le
# sort d'un enfant qui meurt.

cas "les deux apps sont relues, et dans l'ordre demande" \
    '^── appx ── appy$' <<'FIN'
d=$(bac2 64); revue2 "$d" | grep '^── ' | tr '\n' ' ' | sed 's/ $//'
FIN

cas "un KO dans une seule app fait sortir l'ensemble en rouge" \
    "KO.*\[appy\] pas d'app.yml.*1 point\(s\) bloquant\(s\)" <<'FIN'
d=$(bac2 64); rm "$d/apps/appy/app.yml"; revue2 "$d" | tr '\n' '|'
FIN

cas "les points bloquants des deux apps s'additionnent" \
    '2 point\(s\) bloquant\(s\)' <<'FIN'
d=$(bac2 64); rm "$d/apps/appx/app.yml" "$d/apps/appy/app.yml"; revue2 "$d"
FIN

cas "un enfant tue sans rendre de verdict est un KO, jamais un vert" \
    'KO.*\[appy\].*aucun verdict' <<'FIN'
d=$(bac2 64); FAUX_TUE=appy revue2 "$d"
FIN

cas "un enfant tue fait sortir l'ensemble en rouge" \
    '1 point\(s\) bloquant\(s\)' <<'FIN'
d=$(bac2 64); FAUX_TUE=appy revue2 "$d"
FIN

cas "REVUE_PARALLELE=1 rend la serie, et relit toujours les deux apps" \
    '── appx.*── appy.*Revue verte' <<'FIN'
d=$(bac2 64); REVUE_PARALLELE=1 revue2 "$d" | tr '\n' '|'
FIN

echo
echo "-- resultat"
printf '  %s reussi(s), %s echec(s)\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ] || exit 1
