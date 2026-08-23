#!/usr/bin/env bash
#
# revue.sh — la revue outillee d'une application.
#
#   ./scripts/revue.sh                  les apps touchees par la branche
#   ./scripts/revue.sh <app> [<app>…]   ces apps
#   ./scripts/revue.sh --toutes         les dix
#   ./scripts/revue.sh --releve         mesure et ecrit les seuils dans app.yml
#
# Le sixieme metier de scripts/. Il juge les APPS et jamais la fabrique : ce que
# la fabrique se doit a elle-meme se verifie dans ./init.sh --check.
#
# CINQ AXES, un verdict par axe : qualite, securite, dependances vulnerables,
# couverture, duplication. La langue de l'app se deduit de go.mod et de
# package.json, jamais d'un champ de manifeste — la fabrique n'a pas a connaitre
# les langages, elle a a connaitre les axes.
#
# LE CLIQUET. Le plancher de couverture et le plafond de duplication vivent dans
# apps/<nom>/app.yml, releves au niveau du jour. « --releve » ne les deplace que
# dans le sens qui SERRE : la couverture monte, la duplication descend. Desserrer
# est une edition a la main, donc une ligne dans le diff, donc une discussion en
# relecture. C'est le meme choix que le journal : rendre visible plutot
# qu'interdire.
#
# AUCUN VERT SILENCIEUX. Un outil indisponible, un outil qui tombe, un outil qui
# n'analyse RIEN sont trois KO — jamais un axe saute sans le dire. Ce n'est pas
# de la prudence de principe : la premiere mesure de duplication de la fabrique a
# annonce « 0 % » sur du code que jscpd n'avait jamais ouvert, parce qu'un nom de
# format inconnu est ecarte en silence, code de retour 0 et rapport bien forme.
# Le depot avait deja nomme ce mode d'echec sur l'inspection des labels Traefik :
# « un controle de securite qui echoue en ouvert est pire que pas de controle :
# il rassure ». D'ou, pour chaque axe, la comparaison du PERIMETRE REELLEMENT
# ANALYSE au perimetre attendu. Un axe qui ne lit rien doit crier, pas rendre 0.
#
# Les outils ne s'installent pas : « go run <module>@<version> » et
# « npx --yes <paquet>@<version> », versions epinglees dans fabrique.yml et
# nulle part ailleurs. Le premier appel telecharge ; sans reseau, c'est un KO.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"
RACINE="$PWD"   # les axes changent de repertoire ; les chemins du depot non

. lib/socle.sh

RELEVE=0
CIBLES=()

usage() {
  sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --toutes)  discover_apps; CIBLES=("${APPS[@]-}") ;;
    --releve)  RELEVE=1 ;;
    -h|--help) usage 0 ;;
    -*)        echo "ERREUR : option inconnue '$1'." >&2; usage 2 >&2 ;;
    *)         CIBLES+=("$1") ;;
  esac
  shift
done

# Sans cible explicite : les apps que la branche touche, travail non committe
# inclus. Meme mesure que pret.sh — d'ou son deplacement dans lib/socle.sh le
# jour ou un DEUXIEME metier en a eu besoin.
if [ "${#CIBLES[@]}" -eq 0 ]; then
  mapfile -t CIBLES < <(apps_touchees)
fi

if [ "${#CIBLES[@]}" -eq 0 ]; then
  echo "Aucune app touchee — rien a relire."
  exit 0
fi

# --- les outils, epingles dans fabrique.yml et nulle part ailleurs -------------

# La chaine Go de la relecture, epinglee dans fabrique.yml. EXPORTEE avant tout
# appel : elle vaut pour l'installation des outils, pour les outils eux-memes —
# qui relancent « go list » en sous-processus — et pour « go test ». Sans elle,
# le verdict depend du Go installe sur la machine : constate, 27 vulnerabilites
# de bibliotheque standard sur une app saine avec un Go local trop ancien, zero
# avec une chaine a jour. Un verdict qui change de poste en poste n'est pas un
# verdict.
GOTOOLCHAIN=$(fab outil_toolchain "")
[ -n "$GOTOOLCHAIN" ] || { echo "ERREUR : outil_toolchain absent de fabrique.yml." >&2; exit 1; }
export GOTOOLCHAIN

STATICCHECK=$(fab outil_staticcheck "")
GOSEC=$(fab outil_gosec "")
GOVULNCHECK=$(fab outil_govulncheck "")
JSCPD=$(fab outil_jscpd "")

for v in STATICCHECK:outil_staticcheck GOSEC:outil_gosec \
         GOVULNCHECK:outil_govulncheck JSCPD:outil_jscpd; do
  n="${v%%:*}"; k="${v#*:}"
  [ -n "${!n}" ] || { echo "ERREUR : $k absent de fabrique.yml." >&2; exit 1; }
done

# Les extensions que jscpd sait lire ET que la fabrique lui donne a lire. Elles
# servent DEUX fois : a l'appeler, et a compter ce qu'il aurait du analyser.
# Deriver les deux du meme endroit est ce qui rend le controle de perimetre
# vrai — deux listes qui derivent l'une de l'autre finissent par diverger, et le
# garde-fou se met alors a valider son propre angle mort.
JSCPD_FORMATS="go,javascript,typescript,css,scss,markup"
JSCPD_EXTS="go js mjs cjs ts tsx css scss html htm xml svg vue"
# Le code de PRODUCTION seulement. Un tableau de cas repete dans un test est une
# duplication legitime et frequente ; la compter apprendrait a ecrire MOINS de
# tests, exactement l'inverse du but.
JSCPD_IGNORE='**/node_modules/**,**/dist/**,**/*_test.go,**/tests/**,**/e2e/**,**/vendor/**,**/.impeccable/**,**/devtools/**'

TRAVAIL=$(mktemp -d)
trap 'rm -rf "$TRAVAIL"' EXIT

# --- les outils, installes UNE fois et JAMAIS lances depuis une app ------------
#
# « go run <module>@<version> » lance depuis le repertoire d'une app REECRIT son
# go.mod et son go.sum : l'outil exige un toolchain plus recent, et Go propage la
# directive dans le module courant. La revue modifiait donc les manifestes des
# apps qu'elle relit — trois artisans l'ont constate le meme jour, et l'un d'eux
# a annule au passage une montee de dependance voulue, en croyant nettoyer.
#
# Un outil de relecture qui modifie ce qu'il relit n'est pas un outil de
# relecture. D'ou : « go install » lance depuis un repertoire VIDE, sans go.mod,
# donc sans module courant a corrompre ; puis on appelle le binaire.
# Le cache porte le nom de la chaine : changer « outil_toolchain » doit
# reconstruire les binaires, pas resservir ceux d'avant.
OUTILS="${REVUE_CACHE_OUTILS:-$RACINE/.revue-outils}/$GOTOOLCHAIN"

outil() {  # outil <module@version> — imprime le chemin du binaire, l'installe au besoin
  local mod="$1" nom bin
  nom="${mod%@*}"; nom="${nom##*/}"
  bin="$OUTILS/bin/$nom"
  if [ ! -x "$bin" ]; then
    mkdir -p "$OUTILS/bin" "$TRAVAIL/vide"
    # Depuis un repertoire vide : aucun go.mod alentour, donc rien a reecrire.
    ( cd "$TRAVAIL/vide" && GOBIN="$OUTILS/bin" go install "$mod" ) \
      >"$TRAVAIL/install-$nom.log" 2>&1 || {
        echo "ERREUR : installation de $mod impossible :" >&2
        tail -5 "$TRAVAIL/install-$nom.log" >&2
        exit 1; }
  fi
  printf '%s' "$bin"
}

BIN_STATICCHECK=$(outil "$STATICCHECK")
BIN_GOSEC=$(outil "$GOSEC")
BIN_GOVULNCHECK=$(outil "$GOVULNCHECK")

# --- rendu --------------------------------------------------------------------
#
# Un axe rend trois choses : un verdict (ok/warn/bad, via le socle), une mesure
# quand il en produit une, et la trace complete dans $TRAVAIL pour qui veut lire.

# rendre <nom de l'axe> — imprime VERDICT/MESSAGE, poses par le dernier axe_*.
# Le nom est cadre a douze colonnes pour que les cinq verdicts d'une app
# s'alignent : une colonne qui bouge se relit ligne a ligne au lieu d'un coup.
rendre() {
  local n; n=$(printf '%-12s' "$1")
  case "$VERDICT" in
    ok)   ok   "$n $MESSAGE" ;;
    warn) warn "$n $MESSAGE" ;;
    skip) ok   "$n $MESSAGE" ;;
    bad)  bad  "$n $MESSAGE" ;;
  esac
  # Un KO qui ne dit pas QUOI corriger fait rouvrir l'outil a la main, donc
  # finit par se contourner. Le detail sort sous le verdict, borne a dix lignes :
  # au-dela on ne lit plus, on relance l'outil — et c'est tres bien.
  if [ -n "$DETAIL" ]; then
    printf '%s\n' "$DETAIL" | head -10 | sed 's/^/          /'
    local reste; reste=$(printf '%s\n' "$DETAIL" | wc -l)
    [ "$reste" -gt 10 ] && printf '          … %s de plus\n' "$((reste - 10))"
  fi
  return 0
}

# json <fichier> <corps javascript sur « r »> — lit un rapport JSON. node est
# une dependance ASSUMEE de la revue : jscpd en exige un pour toute app, quelle
# que soit sa langue. Autant s'en servir partout plutot que d'extraire du JSON
# imbrique a coups de sed, qui marche jusqu'au jour ou il se trompe en silence.
json() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(eval(process.argv[2])));
  ' "$1" "$2" 2>/dev/null || true
}

# pourcent_entier <flottant> — « 87.1 » -> « 87 ». Tronque et n'arrondit pas :
# la barre doit etre AU NIVEAU du jour, jamais un cran au-dessus, sans quoi elle
# serait rouge a l'instant ou elle est posee.
pourcent_entier() { printf '%s' "${1%%.*}"; }

# --- les cinq axes -------------------------------------------------------------

# « local a="$1"; local out=".../$a" » en DEUX instructions, jamais une seule :
# le shell developpe tous les mots d'un « local » AVANT de creer la moindre
# variable, donc « local a="$1" out="$a.txt" » lit la GLOBALE a — absente, donc
# fatale sous set -u. Ne les refusionne pas.
#
# Chaque axe_* pose VERDICT (ok|warn|bad), MESSAGE, et MESURE quand il en a une.
# Aucun n'appelle ok()/bad() lui-meme : c'est relire_app qui decide, et c'est
# ainsi que « --releve » peut mesurer sans juger.

axe_qualite() {  # <app>
  local a="$1"; local out="$TRAVAIL/$a.staticcheck" rc=0
  VERDICT=ok MESSAGE="" MESURE="" DETAIL=""
  [ -f go.mod ] || { VERDICT=skip; MESSAGE="pas de go.mod"; return 0; }

  "$BIN_STATICCHECK" ./... >"$out" 2>&1 || rc=$?

  # Une erreur de COMPILATION sort de staticcheck comme un constat ordinaire,
  # suffixe « (compile) ». Confondue avec un constat de style, elle ferait
  # croire a un defaut mineur alors qu'AUCUN paquet n'a ete analyse : le
  # perimetre est vide et le verdict ne vaut rien.
  if grep -q '(compile)' "$out"; then
    VERDICT=bad
    MESSAGE="le code ne compile pas — rien n'a ete analyse : $(grep -m1 '(compile)' "$out")"
    return 0
  fi

  local n
  n=$(grep -cE '^[^ ]+\.go:[0-9]+:[0-9]+:' "$out" || true)
  if [ "$n" -gt 0 ]; then
    VERDICT=bad; MESSAGE="$n constat(s) :"
    DETAIL=$(grep -E '^[^ ]+\.go:[0-9]+:[0-9]+:' "$out")
  elif [ "$rc" -ne 0 ]; then
    VERDICT=bad; MESSAGE="staticcheck a echoue (code $rc) : $(head -3 "$out" | tr '\n' ' ')"
  else
    MESSAGE="aucun constat"
  fi
  MESURE="$n"
}

axe_securite() {  # <app>
  local a="$1"; local out="$TRAVAIL/$a.gosec.json" log="$TRAVAIL/$a.gosec.log" rc=0
  VERDICT=ok MESSAGE="" MESURE="" DETAIL=""
  [ -f go.mod ] || { VERDICT=skip; MESSAGE="pas de go.mod"; return 0; }

  # -no-fail : gosec sort en 1 des qu'il TROUVE quelque chose, ce qui ne se
  # distingue pas d'un outil qui TOMBE. On lui demande de toujours sortir en 0
  # et on juge sur le rapport — la seule facon de separer les deux.
  #
  # PAS de -quiet : « only show output when errors are found » couvre AUSSI le
  # fichier de rapport, qui n'est alors pas ecrit du tout quand l'app est saine.
  # Le controle de perimetre le lisait comme un rapport absent, donc comme un
  # outil tombe, et mettait KO l'app la plus propre de la fabrique.
  "$BIN_GOSEC" -no-fail -fmt=json -out="$out" ./... >"$log" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    VERDICT=bad; MESSAGE="gosec a echoue (code $rc) : $(tail -3 "$log" | tr '\n' ' ')"
    return 0
  fi
  if [ ! -s "$out" ]; then
    VERDICT=bad; MESSAGE="gosec n'a ecrit aucun rapport : $(tail -3 "$log" | tr '\n' ' ')"
    return 0
  fi

  # Controle de perimetre : un rapport sur zero fichier est bien forme et ne
  # vaut rien.
  local lus
  lus=$(json "$out" 'r.Stats && r.Stats.files || 0')
  lus="${lus:-0}"
  if [ "$lus" -eq 0 ]; then
    VERDICT=bad; MESSAGE="gosec n'a analyse AUCUN fichier — rapport sans valeur"
    return 0
  fi

  # HIGH et MEDIUM bloquent ; LOW s'affiche. La confiance n'entre PAS dans le
  # verdict : une analyse par teinte ne sait pas si un assainissement en chemin
  # neutralise la valeur qu'elle suit, donc un constat s'INSTRUIT — il se
  # corrige, ou il s'ecarte avec sa raison ecrite. Le classer par avance sur la
  # confiance de l'outil, c'est lui deleguer l'arbitrage qu'on lui demande.
  local hauts moyens bas ecartes
  hauts=$(json  "$out" '(r.Issues||[]).filter(i=>i.severity=="HIGH").length')
  moyens=$(json "$out" '(r.Issues||[]).filter(i=>i.severity=="MEDIUM").length')
  bas=$(json    "$out" '(r.Issues||[]).filter(i=>i.severity=="LOW").length')
  # Les mises a l'ecart se COMPTENT et s'affichent. Un « #nosec » eteint un
  # controle de securite depuis l'interieur du code : invisible dans la sortie de
  # la revue, il devient le moyen le plus simple de rendre un axe vert sans rien
  # corriger — et personne ne le verrait, puisque justement plus rien ne sort.
  # Les compter les remet sous les yeux a chaque passage ; leur RAISON, elle,
  # reste dans le diff, ou la relecture la juge.
  ecartes=$(json "$out" 'r.Stats && r.Stats.nosec || 0')
  ecartes="${ecartes:-0}"
  MESURE="$hauts/$moyens/$bas"
  if [ "$hauts" -gt 0 ] || [ "$moyens" -gt 0 ]; then
    VERDICT=bad
    MESSAGE="$hauts haute(s), $moyens moyenne(s), $bas basse(s) sur $lus fichiers :"
    DETAIL=$(json "$out" '(r.Issues||[]).filter(i=>i.severity!="LOW")
      .map(i=>`${i.severity}/${i.confidence} ${i.rule_id} ${i.file.split("/apps/").pop()}:${i.line} ${i.details}`)
      .join("\n")')
  elif [ "$bas" -gt 0 ]; then
    VERDICT=warn; MESSAGE="$bas constat(s) de gravite basse sur $lus fichiers"
  else
    MESSAGE="aucun constat sur $lus fichiers"
  fi
  [ "$ecartes" -gt 0 ] && MESSAGE="$MESSAGE, $ecartes ecarte(s) par #nosec"
  return 0
}

axe_dependances() {  # <app>
  local a="$1"; local out="$TRAVAIL/$a.govuln" rc=0 n=0 aud="$TRAVAIL/$a.audit"
  VERDICT=ok MESSAGE="" MESURE="" DETAIL=""
  local go_dit="" npm_dit=""

  if [ -f go.mod ]; then
    "$BIN_GOVULNCHECK" ./... >"$out" 2>&1 || rc=$?
    n=$(grep -cE '^Vulnerability #' "$out" || true)
    # Perimetre : govulncheck le dit lui-meme. Sans l'une de ces deux phrases,
    # il n'a pas mene son analyse a terme — quel que soit son code de sortie.
    if [ "$n" -eq 0 ] && ! grep -qE 'No vulnerabilities found' "$out"; then
      VERDICT=bad
      MESSAGE="govulncheck n'a pas conclu (code $rc) : $(tail -3 "$out" | tr '\n' ' ')"
      return 0
    fi
    go_dit="$n vulnerabilite(s) Go"
  fi

  if [ -f package.json ]; then
    if [ -f package-lock.json ]; then
      # « || true » est INDISPENSABLE — npm audit sort en 1 des qu'il TROUVE
      # quelque chose au-dela du seuil — et c'est justement pour ca qu'il ne
      # suffit pas : il avale aussi l'echec de l'outil. Registre injoignable,
      # ECONNREFUSED, delai depasse : npm ecrit alors un objet d'ERREUR, sans
      # champ « metadata », et les compteurs retombaient sur zero. L'axe
      # annoncait « aucune dependance vulnerable » sans avoir audite quoi que ce
      # soit.
      #
      # D'ou le meme controle de perimetre que partout ailleurs : on exige la
      # PREUVE que l'audit a conclu — le bloc metadata.vulnerabilities — avant
      # de croire un zero. C'est exactement ce que la branche govulncheck fait
      # dix lignes plus haut avec sa phrase « No vulnerabilities found ».
      npm audit --audit-level=high --json >"$aud" 2>"$aud.err" || true
      local conclu hautes critiques
      conclu=$(json "$aud" 'r.metadata && r.metadata.vulnerabilities ? "oui" : ""')
      if [ "$conclu" != oui ]; then
        VERDICT=bad
        MESSAGE="npm audit n'a pas conclu : $(head -2 "$aud.err" "$aud" 2>/dev/null | tr '\n' ' ' | cut -c1-160)"
        return 0
      fi
      hautes=$(json    "$aud" 'r.metadata.vulnerabilities.high || 0')
      critiques=$(json "$aud" 'r.metadata.vulnerabilities.critical || 0')
      hautes="${hautes:-0}"; critiques="${critiques:-0}"
      n=$((n + hautes + critiques))
      npm_dit="$critiques critique(s) et $hautes haute(s) cote npm"
    else
      # « rien a auditer » et « audit non fait » sont deux phrases differentes,
      # que le silence confondrait. Trois apps de la fabrique portent un
      # package.json sans la moindre dependance, seulement pour declarer
      # « type: module » a Node : npm audit y sort en ENOLOCK, ce qui, lu
      # naivement, ressemble a un KO de securite sur une app saine.
      npm_dit="aucun package-lock.json, donc aucune dependance a auditer"
    fi
  fi

  MESURE="$n"
  MESSAGE=$(printf '%s' "${go_dit}${go_dit:+${npm_dit:+, }}${npm_dit}")
  [ -n "$MESSAGE" ] || { VERDICT=skip; MESSAGE="ni go.mod ni package.json"; return 0; }
  if [ "$n" -gt 0 ]; then
    VERDICT=bad; MESSAGE="$MESSAGE :"
    [ -f "$out" ] && DETAIL=$(grep -E '^(Vulnerability #|    (Found|Fixed) in)' "$out" || true)
  fi
  return 0
}

# repertoire_vitest : le repertoire de l'app, relatif a elle, dont le
# package.json declare vitest ET un script `test` -- ou rien. `web/` d'abord,
# parce que c'est la convention de la fabrique pour un client compile ; la
# racine ensuite, pour une app qui serait entierement du navigateur. Deux
# conditions et non une : un package.json qui depend de vitest sans script
# `test` ne sait pas se lancer, et l'axe ne doit pas inventer sa commande.
repertoire_vitest() {
  local d
  for d in web .; do
    [ -f "$d/package.json" ] || continue
    grep -q '"vitest"' "$d/package.json" || continue
    grep -qE '"test"[[:space:]]*:' "$d/package.json" || continue
    printf '%s' "$d"; return 0
  done
  return 0
}

axe_couverture() {  # <app>
  local a="$1"; local prof="$TRAVAIL/$a.cover" log="$TRAVAIL/$a.gotest" rc=0
  VERDICT=ok MESSAGE="" MESURE="" DETAIL=""
  local go_pct="" web_pct="" dit=""

  if [ -f go.mod ]; then
    go test -coverprofile="$prof" ./... >"$log" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then
      VERDICT=bad
      MESSAGE="les tests Go echouent, la couverture ne veut rien dire : $(grep -m2 -E '^(FAIL|.*\.go:)' "$log" | tr '\n' ' ')"
      return 0
    fi
    [ -s "$prof" ] || { VERDICT=bad; MESSAGE="aucun profil de couverture produit"; return 0; }
    go_pct=$(go tool cover -func="$prof" 2>/dev/null | awk '$1=="total:"{print $NF}' | tr -d '%')
    [ -n "$go_pct" ] || { VERDICT=bad; MESSAGE="profil de couverture illisible"; return 0; }
  fi

  # Le navigateur. DEUX chaines de test client coexistent dans la fabrique, et
  # cet axe ne lisait que la premiere :
  #  - `node --test tests/*.test.js` a la racine de l'app, qui porte sa propre
  #    couverture depuis Node 22 sans aucune dependance a installer -- c'est la
  #    raison pour laquelle la plupart des apps l'utilisent ;
  #  - vitest sous `web/`, quand le client est en TypeScript : node ne sait pas
  #    executer du .ts, `tests/*.test.js` n'existe donc simplement pas.
  # Une app de la seconde famille ressortait avec un verdict Go SEUL, sans que
  # rien ne dise que son client n'avait pas ete mesure -- et un axe qui se tait
  # ressemble a un axe qui passe (ramure-v2, critique du 2026-08-23). Elle
  # portait sa propre barre dans son test.sh, faute de mieux : deux barres pour
  # une seule mesure, dont une seule alimente le cliquet.
  local dweb="" muet=""
  if ls tests/*.test.js >/dev/null 2>&1; then
    local nlog="$TRAVAIL/$a.nodetest"
    rc=0
    node --test --experimental-test-coverage tests/*.test.js >"$nlog" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then
      VERDICT=bad; MESSAGE="les tests navigateur echouent : $(grep -m2 'not ok' "$nlog" | tr '\n' ' ')"
      return 0
    fi
    # « # all files | 86.83 | 91.70 | 88.84 » — les barres verticales sont des
    # SEPARATEURS de colonnes, pas des champs. Les effacer d'abord, sinon $4
    # vaut « | » : une valeur non numerique qui traverse tout le chemin et
    # ressort en « revue_couverture_web: » vide dans le manifeste.
    web_pct=$(awk '/^# all files/{gsub(/\|/, " "); print $4}' "$nlog" | tail -1)
  elif dweb=$(repertoire_vitest); [ -n "$dweb" ]; then
    local vlog="$TRAVAIL/$a.vitest"
    rc=0
    # Le rapport de couverture est EFFACE avant la mesure. Sans cela, une app
    # dont le script `test` ne demande pas de couverture sortirait en 0 sans
    # rien produire, et le rapport laisse par une execution anterieure --
    # test.sh, une autre branche, un autre commit -- serait lu comme la mesure
    # du jour, puis serre dans app.yml par `--releve` : le cliquet se refermerait
    # sur un chiffre que personne n'a mesure. Efface, l'absence de rapport
    # retombe sur le KO ecrit plus bas.
    rm -rf "$dweb/coverage"
    # Les dependances sont deja la : prepare.sh a fait le `npm ci` avant les
    # axes. Un axe n'installe rien lui-meme -- il mesure ce que l'app livre.
    ( cd "$dweb" && npm test --silent ) >"$vlog" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then
      VERDICT=bad
      MESSAGE="les tests navigateur echouent : $(grep -m2 -E '(FAIL|× |ERROR)' "$vlog" | tr '\n' ' ')"
      return 0
    fi
    # Le rapporteur `json-summary` ecrit coverage/coverage-summary.json, dont
    # total.lines.pct est la MEME grandeur que la colonne lue chez node --test :
    # un pourcentage de LIGNES. Les deux familles restent donc comparables, et
    # `revue_couverture_web` garde un sens unique d'une app a l'autre.
    web_pct=$(node -e 'process.stdout.write(String(require(process.argv[1]).total.lines.pct))' \
                "$PWD/$dweb/coverage/coverage-summary.json" 2>/dev/null) || web_pct=""
    # Repli, pour une app qui n'aurait declare que le rapporteur texte :
    # « All files | 57.12 | 85.71 | 65.21 | 57.12 | », memes barres-separateurs
    # qu'au-dessus, et % Lines en QUATRIEME colonne (donc $6 une fois « All »
    # et « files » comptes) -- pas en premiere comme chez node.
    [ -n "$web_pct" ] || web_pct=$(awk '/^All files/{gsub(/\|/, " "); print $6}' "$vlog" | tail -1)
    [ -n "$web_pct" ] || {
      VERDICT=bad
      MESSAGE="couverture navigateur illisible : ni coverage-summary.json ni tableau texte dans $dweb"
      return 0; }
  elif [ -f package.json ] || [ -f web/package.json ]; then
    # Troisieme famille : un client existe, et sa chaine de test n'entre dans
    # aucune des deux precedentes. C'est LE cas qui a fait taire cet axe, et se
    # taire une seconde fois sous un autre nom serait le meme defaut. L'axe dit
    # donc ce qu'il n'a pas mesure, plutot que de rendre un verdict Go seul qui
    # ressemble a un verdict complet.
    muet="client non mesure — ni « node --test tests/*.test.js », ni vitest sous web/"
  fi

  local plancher plancher_web depasse=0
  plancher=$(yget "app.yml" revue_couverture "")
  plancher_web=$(yget "app.yml" revue_couverture_web "")

  if [ -n "$go_pct" ]; then
    dit="Go ${go_pct}%"
    if [ -n "$plancher" ] && [ "$(pourcent_entier "$go_pct")" -lt "$plancher" ]; then
      dit="$dit (plancher $plancher %)"; depasse=1
    fi
  fi
  if [ -n "$web_pct" ]; then
    dit="${dit}${dit:+, }navigateur ${web_pct}%"
    if [ -n "$plancher_web" ] && [ "$(pourcent_entier "$web_pct")" -lt "$plancher_web" ]; then
      dit="$dit (plancher $plancher_web %)"; depasse=1
    fi
  fi

  # Rien de mesurable du tout. `skip` s'affiche en VERT, et c'est correct pour
  # une app qui n'a rien a mesurer. Mais si un client existe et qu'aucune chaine
  # n'a ete reconnue, c'est le cas le PLUS grave -- rien n'a ete lu, ni Go ni
  # navigateur -- et il sortirait plus vert que le cas ou seul le client manque.
  # L'inversion serait le defaut meme que cet axe vient de corriger.
  if [ -z "$dit" ]; then
    if [ -n "$muet" ]; then VERDICT=warn; else VERDICT=skip; fi
    MESSAGE="rien de mesurable${muet:+ — $muet}"
    return 0
  fi
  MESURE="${go_pct:--};${web_pct:--}"
  MESSAGE="$dit"
  if [ "$depasse" = 1 ]; then
    VERDICT=bad; MESSAGE="$MESSAGE — la barre ne redescend pas"
  elif [ -n "$muet" ]; then
    VERDICT=warn; MESSAGE="$MESSAGE — $muet"
  elif [ -z "$plancher$plancher_web" ]; then
    VERDICT=warn; MESSAGE="$MESSAGE — aucune barre posee (./scripts/revue.sh --releve)"
  fi
}

axe_duplication() {  # <app> — appele depuis la RACINE, pas depuis l'app
  local a="$1"; local dir="$TRAVAIL/jscpd-$a" rap
  VERDICT=ok MESSAGE="" MESURE="" DETAIL=""
  rap="$dir/jscpd-report.json"

  # Ce que jscpd AURAIT du lire. Meme liste d'extensions et memes exclusions que
  # l'appel lui-meme, derivees des memes constantes : c'est ce qui rend le
  # controle de perimetre vrai plutot que decoratif.
  # Un TABLEAU et non une chaine : « -name *.go » construit par expansion de
  # chaine serait globbe par le shell contre le repertoire courant AVANT
  # d'atteindre find, et le perimetre attendu deviendrait n'importe quoi — donc
  # le garde-fou anti-vert-silencieux, lui-meme silencieux.
  local motifs=() e attendus
  for e in $JSCPD_EXTS; do motifs+=(-o -name "*.$e"); done
  motifs[0]='('; motifs+=(')')   # « ( -name *.go -o -name *.js … ) »
  attendus=$(find "apps/$a" -type f "${motifs[@]}" \
      -not -path '*/node_modules/*' -not -path '*/dist/*' \
      -not -name '*_test.go'        -not -path '*/tests/*' \
      -not -path '*/e2e/*'          -not -path '*/vendor/*' \
      -not -path '*/.impeccable/*'  -not -path '*/devtools/*' \
      2>/dev/null | wc -l | tr -d ' ')

  if [ "$attendus" -eq 0 ]; then
    VERDICT=skip; MESSAGE="aucun fichier a comparer"; return 0
  fi

  # --max-lines et --max-size : jscpd ecarte par DEFAUT tout fichier de plus de
  # 1000 lignes ou de plus de 100 ko, sans un mot. Ce sont exactement les gros
  # fichiers — ceux ou la duplication se cache — et le rapport reste bien forme.
  # Constate sur estran : style.css, 1471 lignes, absent du rapport ; le format
  # « css » n'apparaissait meme pas dans les resultats, ce qui ressemblait a un
  # nom de format faux et n'en etait pas. Bornes levees, la mesure passe de
  # 0,27 % a 0,47 % sur la meme app.
  npx --yes "$JSCPD" "apps/$a" --reporters json --output "$dir" \
      --format "$JSCPD_FORMATS" --ignore "$JSCPD_IGNORE" --silent \
      --max-lines 100000 --max-size 5mb \
      >"$TRAVAIL/$a.jscpd.log" 2>&1 || true

  [ -s "$rap" ] || {
    VERDICT=bad
    MESSAGE="jscpd n'a produit aucun rapport : $(tail -3 "$TRAVAIL/$a.jscpd.log" | tr '\n' ' ')"
    return 0; }

  local lus pct
  lus=$(node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const f = (r.statistics && r.statistics.formats) || {};
    console.log(Object.values(f).reduce((n, x) => n + ((x.total && x.total.sources) || 0), 0));
  ' "$rap" 2>/dev/null || echo 0)
  pct=$(node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    console.log(((r.statistics && r.statistics.total && r.statistics.total.percentage) || 0));
  ' "$rap" 2>/dev/null || echo "")

  # LE CONTROLE QUI MANQUAIT. Un format inconnu — « golang » au lieu de « go »,
  # « html » au lieu de « markup » — est ecarte par jscpd EN SILENCE : code de
  # retour 0, rapport bien forme, perimetre vide. La fabrique l'a constate sur
  # ramure, qui declarait 132 lignes analysees pour environ 150 Ko de Go.
  if [ "$lus" -lt "$attendus" ]; then
    VERDICT=bad
    MESSAGE="jscpd n'a lu que $lus fichiers sur $attendus — verdict sans valeur (nom de format ecarte en silence ?)"
    return 0
  fi
  [ -n "$pct" ] || { VERDICT=bad; MESSAGE="rapport jscpd illisible"; return 0; }

  local plafond
  plafond=$(yget "apps/$a/app.yml" revue_duplication "")
  MESURE="$pct"
  MESSAGE="${pct}% sur $lus fichiers"
  if [ -n "$plafond" ] && [ "$(pourcent_entier "$pct")" -gt "$plafond" ]; then
    VERDICT=bad; MESSAGE="$MESSAGE — le plafond est a $plafond %, et il ne remonte pas"
  elif [ -z "$plafond" ]; then
    VERDICT=warn; MESSAGE="$MESSAGE — aucun plafond pose (./scripts/revue.sh --releve)"
  fi
}

# --- le cliquet ---------------------------------------------------------------
#
# app.yml n'est JAMAIS reecrit par init.sh — c'est la regle du contrat, et elle
# tient : le manifeste est la source de verite, editee a la main. « --releve »
# est l'exception, etroite et nommee : il ne touche QUE les trois cles revue_*,
# et seulement dans le sens qui SERRE. Un desserrage reste une edition humaine.

serre() {  # serre <fichier> <cle> <valeur> <sens: monte|descend>
  local f="$1" k="$2" v="$3" sens="$4" actuel
  actuel=$(yget "$f" "$k" "")
  if [ -n "$actuel" ]; then
    if [ "$sens" = monte ] && [ "$v" -le "$actuel" ]; then
      printf '%s inchange (%s)\n' "$k" "$actuel"; return 0; fi
    if [ "$sens" = descend ] && [ "$v" -ge "$actuel" ]; then
      printf '%s inchange (%s)\n' "$k" "$actuel"; return 0; fi
    sed -i -E "s|^$k:.*|$k: $v|" "$f"
    printf '%s : %s -> %s\n' "$k" "$actuel" "$v"
  else
    # L'en-tete une seule fois pour les trois cles, et non une fois par cle :
    # un manifeste edite a la main se relit, et trois fois le meme paragraphe
    # apprend a sauter le paragraphe.
    grep -qE '^revue_' "$f" || {
      printf '\n# Seuils de revue, releves par ./scripts/revue.sh --releve.\n' >> "$f"
      printf '# Ils ne se deplacent que dans le sens qui SERRE : la couverture monte,\n' >> "$f"
      printf '# la duplication descend. Desserrer est une edition a la main, donc une\n' >> "$f"
      printf '# ligne dans le diff de la pull request, donc une discussion.\n' >> "$f"
    }
    printf '%s: %s\n' "$k" "$v" >> "$f"
    printf '%s pose a %s\n' "$k" "$v"
  fi
}

# --- une app ------------------------------------------------------------------

relire_app() {  # relire_app <app>
  local a="$1"; local d="apps/$a"
  echo
  echo "── $a"

  [ -f "$d/app.yml" ] || { bad "[$a] pas d'app.yml — ce n'est pas une app"; return 0; }

  # La preparation, quand l'app en declare une. Une app dont le binaire embarque
  # un artefact CONSTRUIT ne se mesure pas a froid : ramure-v2 ne compile pas
  # sans son client TypeScript. test.sh et revue.sh l'appellent tous les deux,
  # donc elle s'ecrit UNE fois.
  if [ -x "$d/prepare.sh" ]; then
    if ( cd "$d" && ./prepare.sh ) >"$TRAVAIL/$a.prepare" 2>&1; then
      ok   "$(printf '%-12s' preparation) faite"
    else
      bad  "$(printf '%-12s' preparation) prepare.sh echoue : $(tail -3 "$TRAVAIL/$a.prepare" | tr '\n' ' ')"
      return 0
    fi
  fi

  # Les quatre premiers axes tournent DANS l'app : go, node et npm veulent le
  # module sous le pied. JAMAIS dans un sous-shell — un axe pose VERDICT,
  # MESSAGE et MESURE, et un sous-shell les perdrait en silence, exactement le
  # mode d'echec que bad() documente dans lib/socle.sh a propos de FAILED.
  local racine="$PWD" nom
  cd "$d"
  for nom in qualite securite dependances couverture; do
    VERDICT= MESSAGE= MESURE= DETAIL=
    "axe_$nom" "$a"
    rendre "$nom"
    releve_axe "$a" "$nom"
  done
  cd "$racine"

  # Le cinquieme voit l'app DEPUIS LA RACINE : jscpd recoit un chemin, et le
  # comptage du perimetre attendu parcourt « apps/<nom> ».
  VERDICT= MESSAGE= MESURE= DETAIL=
  axe_duplication "$a"
  rendre "duplication"
  releve_axe "$a" duplication
}

# releve_axe <app> <axe> — n'ecrit rien hors du mode « --releve », et n'y ecrit
# que si l'axe a produit une mesure exploitable.
releve_axe() {
  local a="$1" nom="$2"; local f="$RACINE/apps/$a/app.yml" go_pct web_pct
  [ "$RELEVE" = 1 ] || return 0
  # Un axe KO ne seme rien, et le DIT. Se taire ici laisserait croire que la
  # barre a suivi la mesure : c'est exactement ce que le cliquet refuse.
  case "$nom" in
    couverture|duplication)
      [ "$VERDICT" != bad ] || {
        printf '      %s inchange — la mesure est sous la barre, le cliquet ne desserre pas\n' "$nom"
        return 0; } ;;
    *) [ "$VERDICT" != bad ] || return 0 ;;
  esac

  case "$nom" in
    couverture)
      [ -n "$MESURE" ] || return 0
      go_pct="${MESURE%%;*}"; web_pct="${MESURE##*;}"
      [ "$go_pct"  = "-" ] || printf '      %s\n' "$(serre "$f" revue_couverture     "$(pourcent_entier "$go_pct")"  monte)"
      [ "$web_pct" = "-" ] || printf '      %s\n' "$(serre "$f" revue_couverture_web "$(pourcent_entier "$web_pct")" monte)"
      ;;
    duplication)
      [ -n "$MESURE" ] || return 0
      # Le plafond s'arrondit vers le HAUT : 2,91 % mesures donnent 3, sans quoi
      # la barre serait rouge a l'instant ou elle est posee.
      local ent="${MESURE%%.*}"
      [ "${MESURE#*.}" = "$MESURE" ] || ent=$((ent + 1))
      printf '      %s\n' "$(serre "$f" revue_duplication "$ent" descend)"
      ;;
  esac
}

# --- la boucle ----------------------------------------------------------------
#
# Une app par PROCESSUS, jamais par sous-shell. Deux raisons, et aucune n'est de
# style : relire_app fait « cd » dans le shell courant, et bad() incremente une
# globale. Un sous-shell perdrait le compteur — les KO s'afficheraient en rouge
# et le script sortirait en 0. C'est le vert silencieux que tout ce fichier
# passe son temps a interdire. Un processus separe, lui, a son propre repertoire
# courant et rend son verdict par un CODE DE SORTIE, qui remonte.
#
# Mesure du 2026-08-21, dix apps, caches chauds, quatre coeurs : 55,0 s en serie
# [53,3-55,9] contre 25,4 s [24,6-25,9] ici. Protocole et serie : docs/banc/.
# Les gisements restants et leurs verrous : docs/parallelisme.md.
#
# DEUX AMORCAGES AVANT LE FAN-OUT, sans lesquels le parallelisme fabrique de
# faux KO : les trois binaires Go — deja poses plus haut par outil(), c'est
# pourquoi ces appels sont AVANT la boucle et doivent y rester — et le cache de
# npx, sinon dix « npx --yes » installent le meme paquet dans le meme repertoire
# en meme temps, et l'axe duplication rend « aucun rapport produit », un KO qui
# ne dit rien du code.
#
# LE PLAFOND EST nproc, ET IL EST DUR. gosec, staticcheck et « go test -race »
# chargent chacun le graphe complet d'un module. Au-dela, on echange du temps
# gagne contre du temps perdu en memoire, et un OOM rend « gosec a echoue
# (code 137) » : encore un faux KO.

if [ "${REVUE_ENFANT:-0}" != 1 ]; then
  echo "Revue — ${#CIBLES[@]} app(s)"
  if [ "$RELEVE" = 1 ]; then
    echo "  (mode releve : les seuils de app.yml sont serres, jamais desserres)"
  fi
fi

# REVUE_PARALLELE=1 rend la serie — pour comparer au banc, ou pour lire une
# sortie qui s'ecrit au fil de l'eau plutot qu'app par app.
COEURS=${REVUE_PARALLELE:-$(nproc 2>/dev/null || echo 1)}

if [ "${#CIBLES[@]}" -le 1 ] || [ "$COEURS" -le 1 ]; then
  for cible in "${CIBLES[@]}"; do
    relire_app "$cible"
  done
else
  npx --yes "$JSCPD" --version >"$TRAVAIL/amorce-npx.log" 2>&1 || true

  OPT=()
  if [ "$RELEVE" = 1 ]; then OPT=(--releve); fi

  actifs=0
  for cible in "${CIBLES[@]}"; do
    if [ "$actifs" -ge "$COEURS" ]; then
      # « || true » : sous set -e, un enfant qui sort en 1 tuerait le pere ici,
      # avant qu'il ait affiche ce qu'il fallait corriger. Le verdict de cet
      # enfant n'est pas perdu pour autant — il est dans son fichier de compte.
      wait -n || true
      actifs=$((actifs-1))
    fi
    REVUE_ENFANT=1 REVUE_COMPTE="$TRAVAIL/compte-$cible"       "$RACINE/scripts/revue.sh" "${OPT[@]}" "$cible"       >"$TRAVAIL/sortie-$cible" 2>&1 &
    actifs=$((actifs+1))
  done
  wait

  # L'affichage suit l'ordre des CIBLES, jamais celui des fins de processus :
  # deux relevés du meme depot doivent se comparer ligne a ligne.
  #
  # ET LE COMPTE NE SE DEDUIT PAS DU CODE DE SORTIE. Chaque enfant ecrit son
  # nombre de points bloquants dans un fichier ; un fichier ABSENT ou illisible
  # est un KO, jamais un zero. Un enfant tue — OOM, interruption, disque plein —
  # sortirait sinon sans un mot, et la revue rendrait vert en n'ayant rien lu.
  # Meme decompte que l'inspection des images du compose, pour la meme raison.
  for cible in "${CIBLES[@]}"; do
    cat "$TRAVAIL/sortie-$cible" 2>/dev/null || true
    compte=$(cat "$TRAVAIL/compte-$cible" 2>/dev/null || echo "")
    if printf '%s' "$compte" | grep -qE '^[0-9]+$'; then
      FAILED=$((FAILED + compte))
    else
      echo
      bad "[$cible] la revue n'a rendu aucun verdict — processus interrompu ?"
    fi
  done
fi

if [ "${REVUE_ENFANT:-0}" = 1 ]; then
  # Enfant d'un fan-out : ni en-tete ni verdict d'ensemble, le pere les rend.
  # Son compte part dans un fichier, et son code de sortie avec.
  printf '%s\n' "$FAILED" > "$REVUE_COMPTE"
  [ "$FAILED" -eq 0 ] || exit 1
  exit 0
fi

echo
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED point(s) bloquant(s) — corrige, ou ecarte avec la raison ecrite."
  exit 1
fi
echo "Revue verte."
