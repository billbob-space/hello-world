# lib/socle.sh — le socle commun a tous les scripts de la fabrique.
#
# Jamais execute seul : chaque script de la fabrique remonte d'abord a la racine
# du depot, puis le source — « . lib/socle.sh ». Ce qu'il porte est ce qu'AU
# MOINS DEUX scripts utilisent ; une fonction propre a un seul metier vit dans
# ce metier, jamais ici. C'est ce qui garde ce fichier petit : il grossit d'une
# ligne quand un DEUXIEME script a besoin d'une fonction, jamais avant.
#
# Ne definit ni ne lit fabrique.yml au-dela de fab() elle-meme : ORG, DOMAIN,
# REGISTRY et les autres valeurs de la fabrique ne servent qu'a la generation,
# donc restent propres a init.sh.

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }

# Un avertissement s'affiche a sa place, DANS le flot, et se rappelle a la fin.
#
# Le contrat a depasse son plafond de lignes pendant plusieurs branches : le
# « attn » sortait a chaque --check, noye au milieu d'une centaine de lignes
# vertes, ou il se lit comme du decor. Un avertissement qu'on ne voit pas ne
# vaut pas mieux qu'un controle absent — mais le rendre bloquant serait faux,
# puisqu'il ne signale pas un defaut de deploiement. D'ou le rappel : il ne
# change rien au verdict, il rend seulement la derive impossible a manquer.
WARNINGS=()
warn() { printf '  \033[33mattn\033[0m  %s\n' "$1"; WARNINGS+=("$1"); }

# rappel_attn — reimprime les avertissements accumules, juste avant le verdict.
# Ne rend rien quand il n'y en a aucun : une section vide reapprendrait a sauter
# la fin de la sortie, ce que ce rappel cherche justement a defaire.
#
# Le rappel NE COUVRE QUE le processus courant, et son en-tete le nomme pour
# cette raison. pret.sh delegue a init.sh --check, cout.sh --rappel et revue.sh
# comme a des processus SEPARES — frontiere deliberee, qui l'empeche de
# dependre de leur interieur — donc leurs avertissements vivent et meurent chez
# eux, ou chacun rappelle les siens. Sans ce nom, « 1 avertissement » sous deux
# lignes « attn » se lirait comme un compte faux plutot que comme une portee.
#
# Le test de longueur precede l'expansion : sous « set -u », et sur bash < 4.4,
# « ${WARNINGS[@]} » sur un tableau vide est une variable non liee et tuerait le
# script au moment meme ou il annonce que tout va bien.
rappel_attn() {
  [ "${#WARNINGS[@]}" -eq 0 ] && return 0
  echo
  printf '%d avertissement(s) de %s — ils ne bloquent pas, mais rien ne les rattrapera :\n' \
    "${#WARNINGS[@]}" "${0##*/}"
  local w
  for w in "${WARNINGS[@]}"; do printf '  \033[33mattn\033[0m  %s\n' "$w"; done
}

# FAILED et WARNINGS ne sont fiables que si bad() et warn() ne sont jamais
# appeles dans un sous-shell : une boucle « ... | while read » perdrait
# l'increment, et --check sortirait en 0 en ayant affiche des KO. Toutes les
# boucles de verification sont des `for`.
FAILED=0
bad()  { printf '  \033[31mKO\033[0m    %s\n' "$1"; FAILED=$((FAILED+1)); }

# --- git -----------------------------------------------------------------------
#
# Le nom de la branche courante, ou vide si HEAD ne se resout pas — un depot
# sans le moindre commit. Le repli sur le vide n'est pas de la coquetterie :
# sous set -e, l'echec de git rev-parse tuerait pret.sh, cout.sh ou
# fusionnees.sh avant leur premiere ligne de sortie.
branche_courante() { git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""; }

# --- gabarits ----------------------------------------------------------------
#
# render <cle> <valeur> [<cle> <valeur> ...] — lit un gabarit sur l'entree
# standard, remplace chaque occurrence litterale de <cle> par <valeur>, ecrit
# le resultat sur la sortie standard. Utilise par emit_compose (init.sh) et
# journal_ouvre (lib/journal.sh).
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

# --- lecture des manifestes ----------------------------------------------------
#
# Parsing plat volontaire : cle en colonne 0, pas de YAML imbrique. Il n'y a
# donc rien a installer pour lancer ces scripts. Les app.yml n'etant jamais
# reecrits, ils sont edites a la main : on retire le CR d'une edition Windows, le
# commentaire de fin de ligne et les guillemets, sans quoi « port: 8080 # todo »
# produirait un compose invalide.

# SANS AUCUN PROCESSUS, et c'est la seule raison de cette forme un peu raide.
# La version d'avant enchainait « tr | sed | head » puis un second sed : cinq
# processus, plus la substitution qui l'entoure, pour lire UNE valeur. Un
# ./init.sh --check appelle yget 1104 fois — environ sept mille processus pour
# lire des fichiers de trente lignes. Mesure : --check passe de 12,8 s a 7,5 s
# rien qu'en retirant ces processus, et --check est joue 40 fois par
# test-init.sh, qui tient le chemin critique de la CI. Voir docs/banc/.
#
# La semantique est celle d'avant, a la lettre : premiere ligne dont la cle est
# en colonne 0, espaces de tete retires, commentaire de fin precede d'au moins
# une espace retire, espaces de queue retires, une paire de guillemets retiree.
# Verifie en comparant la sortie complete de --check, octet a octet.
yget() {  # yget <fichier> <cle> <defaut>
  local f="$1" k="$2" d="${3-}" v="" ligne
  if [ -f "$f" ]; then
    # « || [ -n "$ligne" ] » : une derniere ligne sans saut final serait
    # autrement perdue, ce que « tr < fichier » ne faisait pas.
    while IFS= read -r ligne || [ -n "$ligne" ]; do
      # TOUS les \r, pas seulement celui de fin : l'ancienne version faisait
      # « tr -d '\r' » sur le fichier entier, et un \r colle au milieu d'une
      # valeur — copier-coller depuis un terminal Windows — disparaissait lui
      # aussi. Retirer le seul suffixe le laissait traverser jusqu'a la sortie.
      # C'est aussi ce que font gsub(/\r/,"") dans les deux lecteurs awk d'a
      # cote : les trois lecteurs de manifeste nettoient pareil, ou l'un d'eux
      # finira par mentir. Trouve en relecture, pas par les manifestes reels —
      # aucun d'eux ne porte de \r, d'ou les cas de test ci-dessous.
      ligne=${ligne//$'\r'/}
      case "$ligne" in
        "$k:"*) v=${ligne#"$k:"}; break ;;
      esac
    done < "$f"
  fi
  v=${v#"${v%%[![:space:]]*}"}
  case "$v" in *[[:space:]]#*) v=${v%%[[:space:]]#*} ;; esac
  v=${v%"${v##*[![:space:]]}"}
  v="${v#\"}"; v="${v%\"}"; v="${v#\'}"; v="${v%\'}"
  printf '%s' "${v:-$d}"
}

fab() { yget fabrique.yml "$1" "$2"; }

# --- listes YAML : un sous-ensemble restreint, et rien de plus -------------------
#
# yget ne lit que des scalaires en colonne 0. Les sections volumes, env, needs,
# services, shared_services et tarifs sont des listes : elles ont leurs propres
# lecteurs. Ce ne sont pas des parseurs YAML generaux — c'est delibere, un
# parseur general dans ces scripts serait une source de bogues muets. Le
# sous-ensemble accepte, et lui seul :
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
  awk -v k="$2" '
    { gsub(/\r/, "") }   # ce que faisait « tr -d \\r » en amont, un processus de moins
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
  ' "$1"
}

ymaps() {  # ymaps <fichier> <cle> — liste de mappings : « index<TAB>cle<TAB>valeur »
  [ -f "$1" ] || return 0
  awk -v k="$2" '
    { gsub(/\r/, "") }   # ce que faisait « tr -d \\r » en amont, un processus de moins
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
  ' "$1"
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

# --- ce que la branche touche ---------------------------------------------------
#
# Ces trois fonctions ont vecu dans pret.sh jusqu'a ce qu'un DEUXIEME metier en
# ait besoin — revue.sh, qui doit relire exactement les apps que pret.sh teste.
# C'est la regle de ce fichier : une chose y entre quand un deuxieme appelant
# arrive, jamais avant. Les garder en double aurait laisse les deux mesures
# diverger, et « teste » aurait cesse de vouloir dire « relu ».
#
# La base est celle de fabrique.yml. Elle est relue a chaque appel plutot que
# figee dans une globale : ces fonctions sont sourcees par des scripts qui ont
# leur propre notion de ce qui est deja calcule, et une globale a moitie posee
# est plus couteuse a debusquer qu'un yget de plus.

fichiers_touches() {  # tout ce que la branche touche, travail non committe inclus
  local base; base=$(fab base_branch main)
  {
    git diff --name-only "origin/$base...HEAD" 2>/dev/null || true
    git status --porcelain 2>/dev/null | cut -c4- || true
  } | LC_ALL=C sort -u
}

fichiers_ajoutes() {  # ceux que la branche CREE — les autres statuts ne comptent pas
  local base; base=$(fab base_branch main)
  {
    git diff --name-status --diff-filter=A "origin/$base...HEAD" 2>/dev/null | cut -f2- || true
    git status --porcelain 2>/dev/null | grep -E '^(A.|\?\?)' | cut -c4- || true
  } | LC_ALL=C sort -u
}

apps_touchees() {  # les apps modifiees depuis la base, travail non committe inclus
  fichiers_touches | sed -nE 's#^apps/([^/]+)/.*#\1#p' | LC_ALL=C sort -u \
    | while IFS= read -r a; do
        # Un if, et non « [ -f ... ] && printf » : sous set -e, un test faux
        # ferait sortir la boucle en code 1, donc la substitution de commande,
        # donc le script entier — et l'appelant s'arreterait sans rien dire.
        if [ -f "apps/$a/app.yml" ]; then printf '%s\n' "$a"; fi
      done
}

# --- applications --------------------------------------------------------------
#
# discover_apps peuple APPS : les repertoires sous apps/ qui portent un app.yml,
# et lui seul — un chemin ne suffit pas. PHANTOM_APP, mis par --add avant
# generation, ajoute une app pas encore ecrite sur disque a l'apercu ; les
# scripts qui n'en ont pas besoin le laissent simplement vide.
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
