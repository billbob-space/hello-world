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

# --- la campagne, jouee en parallele ---------------------------------------------
#
# Les cas sont independants par construction : chacun monte son propre bac sous
# $TEMP et n'en sort pas. Les jouer en serie coutait 5 min 30 en CI — trente-six
# fois un ./init.sh complet, l'un apres l'autre, sur une machine qui a quatre
# coeurs. Mesure : ×3,1 a $(nproc), et sur-souscrire est contre-productif (huit
# --check simultanes coutent plus du double de quatre).
#
# Chaque cas ecrit son rapport dans une FICHE numerotee au lieu de l'imprimer :
# a quatre cas de front, les lignes s'entrelaceraient. Les fiches sont rejouees
# dans l'ordre a la fin, si bien que la sortie est identique a celle d'avant, au
# caractere pres — les titres de section prennent un numero eux aussi, sans quoi
# ils sortiraient tous en tete.
PAR=${PAR:-$(nproc 2>/dev/null || echo 4)}
FICHES=$TEMP/fiches
mkdir -p "$FICHES"
IDX=0
CAS=0

# fiche pose le nom de la prochaine fiche dans $FICHE, et surtout ne l'IMPRIME
# pas : « f=$(fiche) » ferait tourner le compteur dans un sous-shell, ou
# l'increment est perdu des le retour. Les trente-six cas ont ecrit dans la meme
# fiche avant qu'on ne le voie, et la suite a rendu « 1 reussi, 0 echec » sans
# qu'aucun cas n'ait echoue.
#
# $FICHE est aussi ce que lisent reussi() et echec() : un cas detache herite de
# la valeur au moment du fork, et les tours suivants ne peuvent plus la lui
# changer.
FICHE=""
fiche() { IDX=$((IDX+1)); FICHE=$(printf '%s/%04d' "$FICHES" "$IDX"); }

section() { fiche; printf '\n-- %s\n' "$1" > "$FICHE.out"; }

# La porte : jamais plus de $PAR cas en vol. Le « || true » n'est pas
# decoratif — sous set -e, un « wait -n » qui rapporte le code non nul d'un cas
# rouge tuerait la campagne au milieu, et les cas suivants disparaitraient sans
# qu'aucun total ne le signale.
porte() { while [ "$(jobs -rp | wc -l)" -ge "$PAR" ]; do wait -n 2>/dev/null || true; done; }

# detache <corps> <nom> <args...> — retient le cas si son nom porte le motif de
# la ligne de commande, puis le joue en tache de fond. Le sous-shell sort
# toujours en 0 : le verdict ne voyage pas par le code de sortie mais par les
# fichiers temoins .ok / .ko, que reussi() et echec() deposent. Un cas qui
# mourrait sans deposer ni l'un ni l'autre n'apparaitrait nulle part — c'est
# precisement ce que le controle d'integrite de la fin attrape.
detache() {
  case "$2" in *"$MOTIF"*) ;; *) return 0 ;; esac
  fiche
  CAS=$((CAS+1))
  porte
  ( "$@" > "$FICHE.out" 2>&1; exit 0 ) &
}

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

# Les assertions lisent leur sortie par HERESTRING (<<<) et non par un tuyau
# depuis printf. Ce n'est pas une preference de style, c'est une correction :
# « printf ... | grep -q » est une COURSE. grep -q sort des qu'il a trouve, ferme
# le tuyau, printf recoit EPIPE — et sous « set -o pipefail » le pipeline rend
# alors non nul, si bien que le cas est declare ECHOUE alors que le motif a bien
# ete trouve. La course preexistait ; jouer quatre cas de front l'a rendue
# frequente, et la CI l'a attrapee : « printf: write error: Broken pipe », puis
# « aucune ligne ne porte ... » sur un motif pourtant present.
#
# Meme cause pour les « || true » poses sur les pipelines d'affichage : « head -N »
# ferme le tuyau des qu'il a ses N lignes, et sous set -e la fonction mourrait au
# milieu — sans rendre son verdict, donc en s'evanouissant du total.
refuse_corps() {  # refuse_corps <nom> <motif attendu> <mutation>
  local nom="$1" motif="$2" mut="$3" d sortie refus code=0
  d=$(bac)
  bash -c "cd '$d' && $mut" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || code=$?
  refus=$(printf '%s\n' "$sortie" | grep -E 'KO|ERREUR' || true)
  if [ "$code" = 0 ]; then
    echec "$nom" "--check a repondu OUI (sortie 0) — la faute est passee"
  elif [ -z "$refus" ]; then
    echec "$nom" "--check est sorti en $code sans aucune ligne de refus"
  elif ! grep -qi -- "$motif" <<< "$refus"; then
    echec "$nom" "il a refuse, mais aucune ligne de refus ne nomme « $motif »"
    printf '%s\n' "$refus" | sed 's/^/      /' | head -3 || true
  else
    reussi "$nom"
  fi
}

# Les six verbes du fichier — refuse, arrete, genere, genere_dans, accepte,
# avertit — ne font qu'une chose : avaler le heredoc du cas et confier le corps
# a detache, qui filtre et met en tache de fond. La mutation voyage en ARGUMENT
# et non par l'entree standard, parce que le corps tourne dans un sous-shell
# detache, qui n'a plus le heredoc sous la main.
refuse() { detache refuse_corps "$1" "$2" "$(cat)"; }

# arrete <nom> <motif attendu> — le pendant de « refuse » pour le chemin
# d'ECRITURE. « refuse » ne juge que --check, qui regarde un depot deja ecrit ;
# les garde-fous de la generation, eux, doivent arreter AVANT d'ecrire. La
# difference n'est pas theorique : une valeur fausse acceptee ici entre dans un
# fichier suivi par git, et le refus arrive une ligne trop tard.
#
# Le cas exige donc les trois : sortie non nulle, motif dans le message, et
# arbre de travail INTACT — c'est la troisieme qui distingue « il a refuse »
# de « il a ecrit puis s'est plaint ».
arrete_corps() {  # arrete_corps <nom> <motif attendu> <mutation>
  local nom="$1" motif="$2" mut="$3" d sortie code=0 sale
  d=$(bac)
  sortie=$(bash -c "cd '$d' && $mut" 2>&1) || code=$?
  sale=$(git -C "$d" status --porcelain)
  if [ "$code" = 0 ]; then
    echec "$nom" "la commande a reussi — la valeur est passee"
  elif ! grep -qi -- "$motif" <<< "$sortie"; then
    echec "$nom" "elle a echoue, mais son message ne nomme pas « $motif »"
    printf '%s\n' "$sortie" | sed 's/^/      /' | head -3 || true
  elif [ -n "$sale" ]; then
    echec "$nom" "elle a refuse, mais apres avoir ecrit :"
    printf '%s\n' "$sale" | sed 's/^/      /' | head -5 || true
  else
    reussi "$nom"
  fi
}

arrete() { detache arrete_corps "$1" "$2" "$(cat)"; }

# genere <nom> <ligne attendue> — la mutation est un manifeste VALIDE ; on
# regenere et on verifie que compose.yaml porte la ligne attendue. Les cas
# « refuse » ne voient que ce que le script rejette ; celui-ci regarde ce qu'il
# ECRIT, ou vivent les fautes qu'aucun refus n'attrape parce que le resultat
# reste coherent avec lui-meme.
genere_corps() {  # genere_corps <nom> <ligne attendue> <mutation>
  local nom="$1" attendu="$2" mut="$3" d code=0
  d=$(bac)
  bash -c "cd '$d' && $mut" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  ( cd "$d" && ./init.sh >/dev/null 2>&1 ) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "la generation a echoue (sortie $code) sur un manifeste pourtant valide"
  elif ! grep -qF -- "$attendu" "$d/compose.yaml"; then
    echec "$nom" "compose.yaml ne porte pas « $attendu »"
    grep -A2 '^volumes:' "$d/compose.yaml" | sed 's/^/      /' | head -3 || true
  else
    reussi "$nom"
  fi
}

genere() { detache genere_corps "$1" "$2" "$(cat)"; }

# genere_dans <nom> <chemin> <ligne attendue> — comme genere, mais regarde un
# artefact quelconque plutot que compose.yaml. La notice de contexte d'une
# application est un artefact derive comme les autres, et ce qu'elle DIT est
# precisement ce qu'aucun refus n'attrape : une notice coherente avec
# elle-meme mais qui traduit mal un palier d'exposition passerait tous les
# controles en trompant le seul lecteur qu'elle ait.
genere_dans_corps() {  # genere_dans_corps <nom> <chemin> <ligne attendue> <mutation>
  local nom="$1" chemin="$2" attendu="$3" mut="$4" d code=0
  d=$(bac)
  bash -c "cd '$d' && $mut" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  ( cd "$d" && ./init.sh >/dev/null 2>&1 ) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "la generation a echoue (sortie $code) sur un manifeste pourtant valide"
  elif [ ! -f "$d/$chemin" ]; then
    echec "$nom" "$chemin n'a pas ete ecrit"
  elif ! grep -qF -- "$attendu" "$d/$chemin"; then
    echec "$nom" "$chemin ne porte pas « $attendu »"
    sed 's/^/      /' "$d/$chemin" | head -8 || true
  else
    reussi "$nom"
  fi
}

genere_dans() { detache genere_dans_corps "$1" "$2" "$3" "$(cat)"; }

# accepte <nom> — le temoin : le bac intact doit passer le contrat.
accepte_corps() {  # accepte_corps <nom>
  local nom="$1" d sortie code=0
  d=$(bac)
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || code=$?
  if [ "$code" = 0 ]; then
    reussi "$nom"
  else
    echec "$nom" "--check a refuse un depot intact (sortie $code)"
    printf '%s\n' "$sortie" | grep -E 'KO' | sed 's/^/      /' | head -10 || true
  fi
}

accepte() { detache accepte_corps "$1"; }

reussi() { printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; : > "$FICHE.ok"; }
echec()  { printf '  %sKO%s    %s\n        %s%s%s\n' "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"
           : > "$FICHE.ko"; }

# --------------------------------------------------------------------------------

section 'temoin'

accepte "un depot intact passe le contrat"

section 'volumes'

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

section 'secrets'

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

section 'manifestes'

refuse "un palier d'exposition inconnu est refuse" "exposure" <<'FIN'
sed -i 's/^exposure: .*/exposure: ouvert-a-tous/' apps/hello-world/app.yml
FIN

refuse "un needs vers un service partage inexistant est refuse" "needs" <<'FIN'
printf 'needs:\n  - nexistepas\n' >> apps/hello-world/app.yml
FIN

refuse "un nom d'app qui n'est pas un label DNS est refuse" "nom" <<'FIN'
mkdir -p apps/Mon_App && cp apps/hello-world/app.yml apps/Mon_App/app.yml
FIN

section 'artefacts derives'

# Le cas le plus courant : on edite un app.yml et on oublie de relancer init.sh.
# Sans ce controle, le compose committe cesse de decrire les manifestes.
refuse "un compose desynchronise des manifestes est refuse" "desynchronise" <<'FIN'
sed -i 's/^memory: .*/memory: 256m/' apps/hello-world/app.yml
FIN

refuse "un compose absent est refuse" "compose" <<'FIN'
rm -f compose.yaml
FIN

section 'versions epinglees'

# C'est ce qui rend le deploiement selectif : le tag de l'app livree change,
# celui des autres non, et le serveur ne recree que ce conteneur-la. Une faute
# ici ne se verrait qu'au « docker compose up », c'est-a-dire apres le point ou
# les neuf services de la stack sont deja engages.
genere "une version epinglee entre dans le compose" \
       "image: ghcr.io/billbob-space/hello-world/cadran:0123456789abcdef0123456789abcdef01234567" <<'FIN'
printf 'cadran: 0123456789abcdef0123456789abcdef01234567\n' > versions.yml
FIN

# Et elle n'entre QUE la : epingler une app ne doit pas deplacer le tag d'une
# autre, sinon le deploiement redevient global sans que rien ne le dise.
genere "epingler une app laisse les autres sur leur tag" \
       "image: ghcr.io/billbob-space/hello-world/ardoise:main" <<'FIN'
printf 'cadran: 0123456789abcdef0123456789abcdef01234567\n' > versions.yml
FIN

refuse "un tag de version qui n'est pas un commit est refuse" "tag" <<'FIN'
printf 'cadran: derniere-version\n' > versions.yml
FIN

refuse "une version epinglee pour une app inexistante est refusee" "ne designe aucune app" <<'FIN'
printf 'fantome: 0123456789abcdef0123456789abcdef01234567\n' > versions.yml
FIN

arrete "--pin refuse un tag qui n'est pas un commit" "tag" <<'FIN'
./init.sh --pin cadran=v2
FIN

arrete "--pin refuse une app qui n'existe pas" "introuvable" <<'FIN'
./init.sh --pin fantome=0123456789abcdef0123456789abcdef01234567
FIN

# La contrepartie : --pin ecrit bien ce qu'on lui demande, et le reporte dans le
# compose du meme coup. Deux gestes en un appel, c'est ce sur quoi la CI compte.
genere "--pin ecrit la version et la reporte dans le compose" \
       "image: ghcr.io/billbob-space/hello-world/cadran:0123456789abcdef0123456789abcdef01234567" <<'FIN'
./init.sh --pin cadran=0123456789abcdef0123456789abcdef01234567 >/dev/null
FIN

section 'notice de contexte'

# La notice n'existe que pour etre lue par un agent qui ne lira rien d'autre.
# Ce qu'elle dit du palier d'exposition est donc la seule chose qui separera
# « des donnees personnelles derriere une liste blanche » de « ouvert a tout
# internet ». Elle porte la traduction en clair, pas le nom du middleware :
# « forwardauth-open » et « public » se ressemblent et ne garantissent pas la
# meme chose. La mutation est « true » — on ne casse rien, on regarde ce que
# le generateur ECRIT sur un depot sain.
genere_dans "notice : le palier d'exposition est traduit en clair" \
            apps/cadran/CLAUDE.md "uniquement les comptes de la liste blanche" <<'FIN'
true
FIN

# L'URL se compose du nom du repertoire et du domaine de fabrique.yml. Une
# notice qui la figerait cesserait d'etre vraie au premier changement de
# domaine, sans que rien ne le signale.
genere_dans "notice : l'URL est composee du nom et du domaine" \
            apps/cadran/CLAUDE.md "https://cadran.apps.billbob.ovh" <<'FIN'
true
FIN

# discover_apps ecarte un repertoire sans app.yml — il n'entre pas dans le
# compose, et c'est juste. Mais c'est precisement une app dont le code n'est
# pas encore ecrit, donc celle ou un agent va le plus ecrire, donc celle ou le
# bornage sert le plus. Elle recoit une notice degradee.
genere_dans "notice : une app sans app.yml en recoit une, degradee" \
            apps/ramure-v2/CLAUDE.md "le manifeste reste a ecrire" <<'FIN'
true
FIN

refuse "une notice absente est refusee" "apps/cadran/CLAUDE.md absent" <<'FIN'
rm -f apps/cadran/CLAUDE.md
FIN

refuse "une notice desynchronisee est refusee" "apps/cadran/CLAUDE.md desynchronise" <<'FIN'
printf '\nport: 1\n' >> apps/cadran/CLAUDE.md
FIN

section 'outillage'

# Le registre des agents est lu au DEMARRAGE de la session : un agent absent
# du depot ne se remarque qu'a la session suivante, quand quelqu'un l'invoque
# et n'obtient rien. --check est le seul endroit qui puisse le dire tout de
# suite.
refuse "un agent declare mais absent est refuse" "artisan.md absent" <<'FIN'
rm -f .claude/agents/artisan.md
FIN

# avertit <nom> <motif> — le pendant de « refuse » pour ce qui n'est pas une
# faute : --check doit sortir a ZERO et porter l'avertissement. Un tel controle
# ne peut pas se tester avec « refuse », qui exige un code de sortie non nul, et
# sans lui un avertissement peut disparaitre sans que rien ne bouge.
avertit_corps() {  # avertit_corps <nom> <motif attendu> <mutation>
  local nom="$1" motif="$2" mut="$3" d sortie code=0
  d=$(bac)
  bash -c "cd '$d' && $mut" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "--check a refuse (sortie $code) la ou il devait seulement avertir"
  elif ! grep -q -- "$motif" <<< "$sortie"; then
    echec "$nom" "aucune ligne ne porte « $motif »"
  else
    reussi "$nom"
  fi
}

avertit() { detache avertit_corps "$1" "$2" "$(cat)"; }

section 'journal'

# Huit entrees reelles portent deja un total sans detail ; la neuvieme prouve que
# le compte suit, et qu'il ne s'agit pas d'un nombre ecrit en dur.
avertit "un releve de cout sans detail par tour est signale" "9 releve(s) de cout sans detail" <<'FIN'
cat > journal/2026-01-01-fabrique-sans-detail.md <<'ENTREE'
# 2026-01-01 — fabrique/sans-detail

Branche : `fabrique/sans-detail`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
<!-- cout-total: 1000 -->
<!-- /cout -->
ENTREE
git add -A
FIN

section 'documents'

refuse "un lien mort entre documents est refuse" "lien mort" <<'FIN'
printf '\nVoir [le neant](memory/nexistepas.md).\n' >> README.md
FIN

refuse "un fichier de memory/ absent du sommaire est refuse" "sommaire" <<'FIN'
printf 'Quand lire : jamais.\nTenu par : --check\n\n# Sujet\n' > memory/orphelin.md
FIN

# Les deux cas qui suivent n'appellent PAS « git add » : c'est tout leur objet.
# Le 16 aout 2026, pret.sh a rendu « contrat respecte » sur un document d'app
# range sous docs/, et la CI l'a refuse trente secondes plus tard — les deux
# controles d'emplacement ne lisaient que « git ls-files », donc rien tant que
# le fichier n'etait pas indexe, alors que pret.sh tourne AVANT le commit.

# Le refus 409 de renaissance-gym etait promis par trois documents et tenu par
# aucun test. Un tableau qui NOMME son test rend la promesse verifiable ; encore
# faut-il verifier que le nom cite existe.
avertit "un test cite dans un tableau de risques mais absent est signale" "introuvable dans les tests" <<'FIN'
printf '\n## Risques\n\n| Risque | Traitement | Test |\n|---|---|---|\n| Le ciel tombe | On se baisse | `TestCielQuiTombe` |\n' >> apps/renaissance-gym/PRODUCT.md
FIN

# Et le pendant : un nom qui existe vraiment ne doit rien declencher, sans quoi
# le garde-fou serait un bruit permanent.
temoin_trace_corps() {  # temoin_trace_corps <nom>
  local nom="$1" d sortie
  d=$(bac)
  printf '\n## Risques\n\n| Risque | Traitement | Test |\n|---|---|---|\n| Le volume est perdu | Sauvegarde | `TestFicheSurvitAuRedemarrage` |\n' >> "$d/apps/renaissance-gym/PRODUCT.md"
  printf '\nfunc TestFicheSurvitAuRedemarrage(t *testing.T) {}\n' >> "$d/apps/renaissance-gym/api_test.go"
  sortie=$(cd "$d" && ./init.sh --check 2>&1) || true
  if grep -q "introuvable dans les tests" <<< "$sortie"; then
    echec "$nom" "un test present a quand meme ete signale absent"
  else
    reussi "$nom"
  fi
}

detache temoin_trace_corps "un test cite qui existe vraiment ne declenche rien"

# La priorite CSS de [hidden] : trois occurrences dans le depot, dont deux dans
# le meme fichier a une semaine d'intervalle. ramure porte deja la regle globale
# et doit rester silencieuse — c'est ce que ce cas verifie en la retirant.
avertit "une app qui ecrase hidden sans regle globale est signalee" "ramure] declare display sur une classe" <<'FIN'
sed -i 's/^\[hidden\] { display: none !important; }//' apps/ramure/web/ramure.css
FIN

refuse "un document d'app egare sous docs/ est refuse meme non suivi" "son domicile est apps/" <<'FIN'
printf '# Note\nUn document qui parle de renaissance-gym.\n' > docs/note-renaissance-gym.md
FIN

refuse "un doublon de PRODUCT.md est refuse meme non suivi" "doublon exact" <<'FIN'
cp apps/renaissance-gym/PRODUCT.md docs/copie-du-prd.md
FIN

# Un bloc run: peut etre valide en YAML et casse en shell : le delimiteur d'un
# heredoc, indente PLUS que la marge du bloc, ne revient pas en debut de ligne
# apres le depouillage que YAML applique, et n'est jamais reconnu. Le cas
# reproduit exactement cette forme — celle qui a coute une construction entiere
# le 18 aout 2026, YAML valide et contrat vert.
# Le plafond de duree : sans lui un job est au defaut GitHub de six heures, et
# avec cancel-in-progress: false sur main il tient le groupe de concurrence tout
# ce temps. Deux cas, parce que le balayage se fait a l'indentation et qu'il a
# deja rate un job pour une virgule de mise en forme.
refuse "un job de CI sans plafond de duree est refuse" "sans timeout-minutes" <<'FIN'
sed -i '0,/^    timeout-minutes: /{/^    timeout-minutes: /d}' .github/workflows/build.yml
FIN

refuse "un job suivi d'un commentaire ne sort pas du balayage des plafonds" "sans timeout-minutes" <<'FIN'
# le job garde son nom mais gagne un commentaire en fin de ligne, et perd son
# plafond : s'il sortait du balayage, l'absence de plafond passerait inapercue.
sed -i 's/^  build:$/  build:  # la matrice des images/' .github/workflows/build.yml
sed -i '/^  build:  # la matrice des images$/,/^    strategy:$/{/^    timeout-minutes: /d}' .github/workflows/build.yml
FIN

refuse "un bloc run: invalide en shell est refuse" "invalides en shell" <<'FIN'
awk 'BEGIN{f=0} {print}
     !f && /- run: \.\/init\.sh --check/ {
       print "      - name: etape volontairement cassee";
       print "        run: |";
       print "          if true; then";
       print "            cat <<X > /tmp/y";
       print "            bonjour";
       print "            X";
       print "          fi";
       f=1 }' .github/workflows/build.yml > w.tmp && mv w.tmp .github/workflows/build.yml
FIN

# Attendre TOUS les cas en vol, puis rejouer les fiches dans l'ordre : la sortie
# est celle d'avant, au caractere pres.
wait || true
for f in "$FICHES"/[0-9]*.out; do [ -e "$f" ] && cat "$f"; done

REUSSIS=$(find "$FICHES" -name '*.ok' | wc -l)
ECHOUES=$(find "$FICHES" -name '*.ko' | wc -l)

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"

# Un cas qui meurt avant de rendre son verdict ne depose ni .ok ni .ko : il
# DISPARAITRAIT du total, et une suite amputee ressemble trait pour trait a une
# suite verte. On compte donc les cas lances, et on refuse que la somme des
# verdicts s'en ecarte.
rendus=$((REUSSIS + ECHOUES))
if [ "$rendus" -ne "$CAS" ]; then
  printf '  %sKO%s    %s cas lance(s), %s verdict(s) rendu(s) — %s cas se sont evanouis\n\n' \
    "$ROUGE" "$NEUTRE" "$CAS" "$rendus" "$((CAS - rendus))"
  exit 1
fi

[ "$ECHOUES" -eq 0 ]
