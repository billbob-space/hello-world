#!/usr/bin/env bash
#
# test-cout.sh — le contrat de test de scripts/cout.sh.
#
#   ./test-cout.sh            lance tous les cas
#   ./test-cout.sh <motif>    ne lance que les cas dont le nom contient <motif>
#
# Le releve de cout est le seul programme du depot dont PERSONNE ne peut
# verifier le resultat a l'oeil : il rend un nombre a sept chiffres, et un
# nombre faux ressemble trait pour trait a un nombre juste. C'est exactement la
# forme d'erreur qu'un test attrape et qu'aucune relecture n'attrape — le
# sur-comptage d'un facteur deux a vecu huit entrees de journal sans se voir.
#
# COMMENT : chaque cas ecrit une conversation FACTICE dont on connait le total
# a la main, la depose la ou cout.sh la cherchera, puis compare le total releve
# a celui qu'on attend. La conversation factice plutot qu'une vraie : une vraie
# conversation ne se replique pas, et son total change a chaque tour.
#
# Le bac est un depot git a part entiere, comme dans test-init.sh : cout.sh
# remonte a la racine par « git rev-parse » et lit la branche courante.

set -euo pipefail
cd "$(dirname "$0")"
SOURCE=$(pwd)
MOTIF="${1-}"

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

VERT=$'\033[32m' ROUGE=$'\033[31m' GRIS=$'\033[90m' NEUTRE=$'\033[0m'
REUSSIS=0 ECHOUES=0
BRANCHE=claude/test-cout

reussi() { REUSSIS=$((REUSSIS+1)); printf '  %sok%s    %s\n' "$VERT" "$NEUTRE" "$1"; }
echec()  { ECHOUES=$((ECHOUES+1)); printf '  %sKO%s    %s\n         %s%s%s\n' \
             "$ROUGE" "$NEUTRE" "$1" "$GRIS" "$2" "$NEUTRE"; }

# --- le bac a sable --------------------------------------------------------------
#
# Copie du depot suivi par git, puis une branche de travail : sur la base,
# cout.sh n'a pas d'entree de journal ou ecrire et se contente d'afficher.

bac() {  # bac — cree un bac a sable neuf et en imprime le chemin
  local d
  d=$(mktemp -d "$TEMP/bac.XXXXXX")
  ( cd "$SOURCE" && git ls-files -z | xargs -0 tar cf - ) | ( cd "$d" && tar xf - )
  git -C "$d" init -q -b main
  git -C "$d" add -A
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm base
  git -C "$d" checkout -q -b "$BRANCHE"
  printf '%s' "$d"
}

# conversation <bac> <fichier> — lit des lignes « requete » sur l'entree standard
# et ecrit le .jsonl correspondant la ou cout.sh ira le chercher : sous
# $HOME/.claude/projects/<chemin-du-bac-aplati>. Le HOME est detourne vers le
# bac, donc chaque cas est isole du vrai poste.
#
#   requete <id> <branche> <sidechain 0|1> <modele> <entree> <ecriture> <lecture> <sortie> [lignes]
#
# « lignes » est le nombre de fois que la MEME requete est ecrite dans le
# fichier, ce que fait le harnais reel : une ligne par bloc de la reponse — la
# reflexion, le texte, chaque appel d'outil — et chacune reporte la facture
# entiere. Une requete facturee une fois peut donc apparaitre cinq fois.
requete() {
  local id="$1" br="$2" side="$3" modele="$4" e="$5" ce="$6" cl="$7" s="$8" n="${9:-1}" i
  local vrai=false; [ "$side" = 1 ] && vrai=true
  for ((i = 0; i < n; i++)); do
    printf '{"parentUuid":null,"isSidechain":%s,"message":{"id":"msg_%s","type":"message","role":"assistant","model":"%s","content":[{"type":"text","text":"x"}],"usage":{"input_tokens":%s,"cache_creation_input_tokens":%s,"cache_read_input_tokens":%s,"output_tokens":%s}},"requestId":"%s","type":"assistant","timestamp":"2026-08-05T10:00:0%sZ","gitBranch":"%s"}\n' \
      "$vrai" "$id" "$modele" "$e" "$ce" "$cl" "$s" "$id" "$((i % 10))" "$br"
  done
}

pose() {  # pose <bac> — lit le .jsonl sur l'entree standard et le depose
  local d="$1" p
  p="$d/home/.claude/projects/$(printf '%s' "$d" | sed 's/[^A-Za-z0-9]/-/g')"
  mkdir -p "$p"
  cat > "$p/session.jsonl"
}

# pose_agent <bac> — comme pose, mais dans le sous-repertoire ou le harnais
# ecrit vraiment un sous-agent : <session>/subagents/agent-*.jsonl, JAMAIS
# dans le fichier de la session qui l'a lance. cout.sh cherchait « aucun [tour]
# par des sous-agents » juste apres qu'un vrai sous-agent ait rendu son
# rapport, le 8 aout 2026, parce qu'il ne regardait que le fichier a plat.
pose_agent() {
  local d="$1" p
  p="$d/home/.claude/projects/$(printf '%s' "$d" | sed 's/[^A-Za-z0-9]/-/g')/session/subagents"
  mkdir -p "$p"
  cat > "$p/agent-1.jsonl"
}

# pose_agent_n <bac> <n> — un SECOND (troisieme...) fichier de sous-agent. Le
# decoupage en sessions d'agent se fait par FICHIER, pas par une heuristique sur
# la retombee de la relecture : deux agents concurrents entrelacent leurs tours,
# et seul le fichier y survit. Il faut donc pouvoir en poser plusieurs pour
# exercer ce decoupage — avec un seul, la mesure serait juste par accident.
pose_agent_n() {
  local d="$1" n="$2" p
  p="$d/home/.claude/projects/$(printf '%s' "$d" | sed 's/[^A-Za-z0-9]/-/g')/session/subagents"
  mkdir -p "$p"
  cat > "$p/agent-$n.jsonl"
}

# --- le bac partage des cas en lecture seule -------------------------------------
#
# Dix-neuf des vingt cas ne touchent NI l'arbre suivi par git NI le journal :
# ils deposent une conversation sous $d/home, lancent cout.sh --dry-run, et
# lisent sa sortie. Leur reconstruire un depot chacun coutait 0,9 s vingt fois
# pour un arbre qu'aucun d'eux ne modifie.
#
# Seul $d/home change d'un cas a l'autre, et on le vide entre deux : sans cela,
# la conversation d'un cas et les sous-agents poses par un autre s'additionnent,
# et un cas qui verifie qu'on ne compte PAS quelque chose passerait au vert en
# comptant ce que son voisin a laisse.
#
# Le bac est construit au niveau superieur, jamais paresseusement dans la
# fonction : « d=$(bac_partage) » s'execute dans un SOUS-SHELL, ou une
# affectation est perdue des le retour — chaque cas reconstruirait, et le gain
# serait nul sans que rien ne le dise.
#
# « :? » et non une valeur par defaut vide : $BAC_PARTAGE vide ferait de la
# ligne suivante un « rm -rf /home ». Mieux vaut refuser bruyamment.
bac_partage() {
  rm -rf "${BAC_PARTAGE:?bac partage pas encore construit}/home"
  printf '%s' "$BAC_PARTAGE"
}

releve() {  # releve <bac> — lance cout.sh en HOME detourne, rend sa sortie
  ( cd "$1" && HOME="$1/home" ./scripts/cout.sh --dry-run 2>&1 )
}

# --- un cas ----------------------------------------------------------------------
#
# total <nom> <attendu> — la conversation est lue sur l'entree standard. On
# compare au marqueur « cout-total », ecrit en chiffres bruts : le tableau, lui,
# separe les milliers pour l'oeil et ne se compare pas.
total() {
  local nom="$1" attendu="$2" d sortie vu
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  vu=$(grep -m1 -o 'cout-total: [0-9]*' <<< "$sortie" | tr -dc '0-9')
  if [ -z "$vu" ]; then
    echec "$nom" "aucun total dans la sortie"
  elif [ "$vu" != "$attendu" ]; then
    echec "$nom" "total $vu, attendu $attendu"
  else
    reussi "$nom"
  fi
}

# porte <nom> <motif> — la sortie doit contenir <motif>. Pour ce que le releve
# DIT et qui ne se resume pas a un total : la part des sous-agents, le poids du
# demarrage, le nombre d'echanges.
porte() {
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if grep -qF -- "$motif" <<< "$sortie"; then
    reussi "$nom"
  else
    echec "$nom" "la sortie ne porte pas « $motif »"
  fi
}

# --------------------------------------------------------------------------------

BAC_PARTAGE=$(bac)

printf '\n-- le compte\n'

# Le temoin : sans lui, un cout.sh qui rendrait zero partout ferait passer au
# vert tous les cas qui verifient qu'on ne compte PAS quelque chose.
total "une requete unique est comptee entiere" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
FIN

# Le bug fondateur de ce fichier. Le harnais ecrit une ligne par bloc de la
# reponse et recopie la facture sur chacune ; les additionner facture la meme
# requete deux a trois fois selon le nombre d'outils appeles. Huit entrees de
# journal ont ete relevees ainsi.
total "la meme requete ecrite sur trois lignes n'est comptee qu'une fois" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 3)
FIN

total "deux requetes distinctes s'additionnent" 2230 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 2)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 1000 5 3)
FIN

printf '\n-- l attribution\n'

# Deux branches travaillees dans le meme conteneur : le releve de la seconde
# additionnait la premiere. C'est ce qui a produit « ardoise » et « compteur »
# a deux minutes d'ecart, avec 275 et 282 millions de jetons — le meme travail,
# compte deux fois, dans deux entrees de journal differentes.
total "le travail d'une autre branche n'entre pas dans le total" 1115 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 fabrique/autre-sujet 0 claude-opus-5 10 100 1000 5)
FIN

porte "ce qui appartient a une autre branche est dit, pas tu" "1 autre(s) branche(s)" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 fabrique/autre-sujet 0 claude-opus-5 10 100 1000 5)
FIN

# Un sous-agent consomme sur la branche courante : il compte dans le total. Mais
# il se distingue, sans quoi « lancer un agent » reste un geste dont personne ne
# connait le prix.
total "un sous-agent compte dans le total de la branche" 2230 <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)
FIN

porte "la part des sous-agents est chiffree" "sous-agents" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)
$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)
FIN

# Les quatre cas ci-dessus ecrivent le sous-agent DANS le fichier de la session
# courante — ce que le harnais ne fait jamais. Trouve en lancant l'artisan pour
# de vrai le 8 aout 2026 : le releve annoncait toujours « aucun [tour] par des
# sous-agents » juste apres qu'un vrai sous-agent ait rendu son rapport. Le
# marqueur isSidechain etait bien pose, cout.sh regardait juste le mauvais
# fichier — le vrai vit sous <session>/subagents/agent-*.jsonl.

sous_agent_fichier_total() {  # <nom> <attendu> — sous-agent dans son propre fichier
  local nom="$1" attendu="$2" d sortie vu
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<<"$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)"
  pose_agent "$d" <<<"$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)"
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  vu=$(grep -m1 -o 'cout-total: [0-9]*' <<< "$sortie" | tr -dc '0-9')
  if [ "$vu" != "$attendu" ]; then
    echec "$nom" "total $vu, attendu $attendu"
  else
    reussi "$nom"
  fi
}
sous_agent_fichier_total "un sous-agent dans son propre fichier compte dans le total" 2230

sous_agent_fichier_porte() {  # <nom> <motif>
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<<"$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)"
  pose_agent "$d" <<<"$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)"
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if grep -qF -- "$motif" <<< "$sortie"; then
    reussi "$nom"
  else
    echec "$nom" "la sortie ne porte pas « $motif »"
  fi
}
sous_agent_fichier_porte "la part des sous-agents est chiffree depuis son propre fichier" "dont 1 par des sous-agents"
# Le sous-agent a son propre demarrage, dans son propre contexte : melange au
# compte de sessions de la session principale, il en ferait 2 au lieu de 1.
sous_agent_fichier_porte "un fichier de sous-agent ne compte pas comme une session de plus" "1 session(s)"

# Meme panne, un niveau plus bas, trouvee le 16 aout 2026 : un agent lance par
# un WORKFLOW n'ecrit pas sous <session>/subagents/ mais sous
# <session>/subagents/workflows/<run>/. La branche qui a produit le plan
# d'amelioration annoncait 7,24 $ et « aucun sous-agent » pour environ 35 $
# reels. Le glob ne descend pas tout seul : ce cas tient le motif.
pose_agent_workflow() {  # <bac> — la ou un agent de workflow ecrit vraiment
  local d="$1" p
  p="$d/home/.claude/projects/$(printf '%s' "$d" | sed 's/[^A-Za-z0-9]/-/g')/session/subagents/workflows/wf_1"
  mkdir -p "$p"
  cat > "$p/agent-1.jsonl"
}

agent_workflow_total() {  # <nom> <attendu>
  local nom="$1" attendu="$2" d sortie vu
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<<"$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 100 1000 5)"
  pose_agent_workflow "$d" <<<"$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 1000 5)"
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  vu=$(grep -m1 -o 'cout-total: [0-9]*' <<< "$sortie" | tr -dc '0-9')
  if [ "$vu" != "$attendu" ]; then
    echec "$nom" "total $vu, attendu $attendu"
  else
    reussi "$nom"
  fi
}
agent_workflow_total "un agent de workflow compte dans le total" 2230

printf '\n-- ce qui coute\n'

# Le demarrage — contrat, outillage, definitions d'outils — est ecrit en cache
# au premier echange puis RELU a chaque echange suivant. Mesure sur une session
# reelle : 80 % de toute la relecture. C'est le premier levier d'optimisation du
# depot, et rien ne le montrait.
porte "le poids du demarrage est chiffre" "Démarrage" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
$(requete req_3 "$BRANCHE" 0 claude-opus-5 10 100 5100 5)
FIN

porte "le nombre d'appels au modele est dit" "3 appel" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
$(requete req_3 "$BRANCHE" 0 claude-opus-5 10 100 5100 5)
FIN

# Le detail echange par echange survit dans l'entree de journal : le fichier de
# conversation meurt avec le conteneur, et sans lui aucune analyse n'est
# refaisable — ni avec d'autres tarifs, ni sous un autre angle.
porte "le detail echange par echange est conserve" "cout-detail" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 0 claude-opus-5 10 100 5000 5)
FIN

printf '\n-- ce qui est ecrit dans le journal\n'

# Le bloc n'est pas affiche : il est INSERE dans un document que --check
# verifie. Un titre de niveau 3 y a suffi a faire compter une anomalie de plus
# que de champs « Detecte par », et donc a rendre le depot entier rouge — la CI
# de toutes les apps avec lui. Ce cas ecrit pour de vrai, puis relance le
# contrat.
ecrit_puis_check() {  # ecrit_puis_check <nom>
  local nom="$1" d entree sortie code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  pose "$d" < <(cat)
  entree="$d/journal/2026-01-01-$(printf '%s' "$BRANCHE" | tr '/' '-').md"
  cat > "$entree" <<'ENTREE'
# 2026-01-01 — claude/test-cout

Branche : `claude/test-cout`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie.
ENTREE
  git -C "$d" add "$entree"
  git -C "$d" -c user.email=test@local -c user.name=test commit -qm entree
  ( cd "$d" && HOME="$d/home" ./scripts/cout.sh >/dev/null 2>&1 ) \
    || { echec "$nom" "cout.sh a echoue"; return 0; }
  grep -q 'cout-total' "$entree" || { echec "$nom" "le bloc n'a pas ete ecrit dans l'entree"; return 0; }
  sortie=$( cd "$d" && ./init.sh --check 2>&1 ) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "--check refuse le depot apres le releve : $(grep -m1 -E 'KO' <<< "$sortie")"
  else
    reussi "$nom"
  fi
}

ecrit_puis_check "le bloc ecrit laisse le contrat vert" <<FIN
$(requete req_1 "$BRANCHE" 0 claude-opus-5 10 5000 0 5)
$(requete req_2 "$BRANCHE" 1 claude-opus-5 10 100 5000 5)
FIN

# tait <nom> <motif> — l'inverse de porte. Un avertissement qui se declenche
# toujours ne veut plus rien dire : le cas qui prouve qu'il SAIT se taire vaut
# celui qui prouve qu'il sait parler.
tait() {
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" < <(cat)
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue"; return 0; }
  if grep -qF -- "$motif" <<< "$sortie"; then
    echec "$nom" "la sortie porte « $motif », qu'elle ne devrait pas"
  else
    reussi "$nom"
  fi
}

printf '\n-- les leviers\n'

# Deux tours sur trois sortent moins de 300 jetons : ce sont des appels d'outil
# nus, qui paient tout le contexte relu pour une sortie de rien.
porte "les tours courts sont comptes" "2 des 3" <<FIN
$(requete c_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 2000)
$(requete c_2 "$BRANCHE" 0 claude-opus-5 0 0 50000 150)
$(requete c_3 "$BRANCHE" 0 claude-opus-5 0 0 60000 100)
FIN

porte "l alerte de contexte se declenche au-dela du seuil" "coupe la session" <<FIN
$(requete a_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete a_2 "$BRANCHE" 0 claude-opus-5 0 0 350000 500)
FIN

tait "l alerte de contexte se tait en deca du seuil" "coupe la session" <<FIN
$(requete b_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete b_2 "$BRANCHE" 0 claude-opus-5 0 0 100000 500)
FIN

# Le seuil CRITIQUE, le seul chiffre du depot qui refuse un commit. Le code de
# sortie compte autant que le message : c'est lui que pret.sh transforme en
# refus, et un 3 rendu par erreur bloquerait tout le monde. La paire verifie les
# deux sens — 650 000 bloque, 350 000 avertit sans bloquer.
code_rappel() {  # code_rappel <nom> <code attendu> — la conversation est lue sur l'entree standard
  local nom="$1" attendu="$2" d code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" < <(cat)
  ( cd "$d" && HOME="$d/home" ./scripts/cout.sh --rappel >/dev/null 2>&1 ) || code=$?
  if [ "$code" = "$attendu" ]; then
    reussi "$nom"
  else
    echec "$nom" "code $code, attendu $attendu"
  fi
}

code_rappel "au-dela du critique, --rappel rend 3" 3 <<FIN
$(requete k_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete k_2 "$BRANCHE" 0 claude-opus-5 0 0 650000 500)
FIN

code_rappel "sous le critique, --rappel rend 0 meme s il avertit" 0 <<FIN
$(requete l_1 "$BRANCHE" 0 claude-opus-5 0 1000 0 500)
$(requete l_2 "$BRANCHE" 0 claude-opus-5 0 0 350000 500)
FIN

# --- une requete sur plusieurs lignes ---------------------------------------------
#
# Une reponse occupe plusieurs lignes — une par bloc — et l'on n'en garde qu'une
# facture. Ce script gardait la PREMIERE, sur la foi d'un commentaire affirmant
# que toutes portaient la meme. Vrai des sessions principales, FAUX des fichiers
# de sous-agent, ou l'usage s'ACCUMULE : mesure du 22 aout 2026 sur un fichier
# reel, output_tokens montant de 17 a 249 sur la meme requete, sortie des agents
# comptee 646 jetons pour 11 621 reels.
#
# Les deux cas doivent tenir a la fois, d'ou deux tests : la repetition (ou le
# MAX vaut la premiere) et l'accumulation (ou il ne la vaut pas).

total "une requete repetee a l identique ne compte qu une fois" 1000 <<FIN
$(requete rep_1 "$BRANCHE" 0 claude-opus-5 0 0 0 1000)
$(requete rep_1 "$BRANCHE" 0 claude-opus-5 0 0 0 1000)
FIN

# Le cas qui ECHOUAIT : garder la premiere ligne rendait 5 au lieu de 500.
total "une requete dont l usage s accumule compte son maximum" 500 <<FIN
$(requete acc_1 "$BRANCHE" 0 claude-opus-5 0 0 0 5)
$(requete acc_1 "$BRANCHE" 0 claude-opus-5 0 0 0 500)
FIN

# Et le classement « tour court » en depend : a 5 jetons de sortie le tour est
# court, a 500 il ne l est pas. Un tour mal classe fausse le poste que cette
# branche existe pour mesurer.
porte "un tour dont la sortie s accumule au-dela de 300 n est plus un tour court" "- **Tours courts** — 0 des 1 tours" <<FIN
$(requete cc_1 "$BRANCHE" 0 claude-opus-5 0 0 0 5)
$(requete cc_1 "$BRANCHE" 0 claude-opus-5 0 0 0 500)
FIN

# --- les sessions d'agent --------------------------------------------------------
#
# Le poste que ce releve ne nommait pas, et qui pesait deux tiers de la facture
# sur la branche du 21 aout 2026. Ce qui compte n'est pas le nombre d'agents mais
# la LONGUEUR de la plus longue session : son cout croit en carre, puisqu'elle
# fait N tours dont chacun relit ce que les N-1 precedents ont accumule.
#
# Les trois cas ci-dessous exercent le decoupage, son ABSENCE, et la correction
# du conseil sur les tours courts. Le deuxieme est le cas negatif, et c'est celui
# qui compte : un decoupage qui ne sait pas ne rien trouver trouverait n'importe
# quoi.

agents() {  # agents <nom> <motif> — deux sessions d'agent de longueurs differentes
  local nom="$1" motif="$2" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<<"$(requete ag_p "$BRANCHE" 0 claude-opus-5 10 1000 0 5000)"
  # trois tours dans un fichier, un seul dans l'autre : la plus longue fait 3
  pose_agent "$d" <<FIN
$(requete ag_a1 "$BRANCHE" 1 claude-opus-5 0 100 30000 50)
$(requete ag_a2 "$BRANCHE" 1 claude-opus-5 0 100 60000 50)
$(requete ag_a3 "$BRANCHE" 1 claude-opus-5 0 100 90000 50)
FIN
  pose_agent_n "$d" 2 <<<"$(requete ag_b1 "$BRANCHE" 1 claude-opus-5 0 100 10000 50)"
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if grep -qF -- "$motif" <<< "$sortie"; then
    reussi "$nom"
  else
    echec "$nom" "la sortie ne porte pas « $motif » — vu : $(grep -A1 "Sessions d'agent" <<< "$sortie" | tr '\n' ' ')"
  fi
}

agents "deux fichiers d'agent font deux sessions, la plus longue est nommee" "- **Sessions d'agent** — 2, dont la plus longue fait 3 tours,"
agents "la relecture moyenne de la plus longue est celle de SES tours" "relit 60 000 jetons par tour en moyenne"

# Le cas NEGATIF, et il vaut les deux autres : sans agent, la rubrique doit etre
# ABSENTE et non a zero. Une rubrique a zero se lit « on a mesure, il n'y en a
# pas » ; une rubrique absente se lit « il n'y en a pas eu ». Sur un releve dont
# le lecteur decide ou couper un chantier, la confusion coute une decision.
sans_agent() {
  local nom="$1" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<FIN
$(requete sa_1 "$BRANCHE" 0 claude-opus-5 10 1000 0 5000)
$(requete sa_2 "$BRANCHE" 0 claude-opus-5 10 100 20000 5000)
FIN
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if grep -qF "Sessions d'agent" <<< "$sortie"; then
    echec "$nom" "la rubrique est presente alors qu'aucun agent n'a tourne"
  elif ! grep -qF "Grouper les appels" <<< "$sortie"; then
    echec "$nom" "sans agent, le conseil de groupement doit rester celui d'origine"
  else
    reussi "$nom"
  fi
}
sans_agent "sans agent, la rubrique est absente et le conseil de groupement tient"

# « Grouper les appels independants » est vrai de la session principale et FAUX
# d'un agent, dont chaque tour EST un appel d'outil. Le meme chiffre portait le
# meme conseil pour les deux, ce qui a laisse le premier poste de la facture
# intact pendant vingt-deux branches.
courts_agent() {
  local nom="$1" d sortie
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac_partage)
  pose "$d" <<<"$(requete ca_p "$BRANCHE" 0 claude-opus-5 10 1000 0 5000)"
  pose_agent "$d" <<FIN
$(requete ca_1 "$BRANCHE" 1 claude-opus-5 0 100 30000 50)
$(requete ca_2 "$BRANCHE" 1 claude-opus-5 0 100 60000 50)
FIN
  sortie=$(releve "$d") || { echec "$nom" "cout.sh a echoue : $(printf '%s' "$sortie" | tail -2)"; return 0; }
  if ! grep -qF "Dont 2 chez des agents" <<< "$sortie"; then
    echec "$nom" "les tours courts d'agent ne sont pas comptes a part"
  elif grep -qF "Grouper les appels" <<< "$sortie"; then
    echec "$nom" "le conseil de groupement est servi alors que les tours courts sont ceux d'agents"
  else
    reussi "$nom"
  fi
}
courts_agent "les tours courts d'un agent ne recoivent pas le conseil de groupement"

printf '\n-- resultat\n'
printf '  %s reussi(s), %s echec(s)\n\n' "$REUSSIS" "$ECHOUES"
[ "$ECHOUES" -eq 0 ]
