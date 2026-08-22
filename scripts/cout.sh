#!/usr/bin/env bash
#
# cout.sh — ce que la branche courante a consomme en jetons, et son prix.
#
#   ./scripts/cout.sh              releve, affiche, et ecrit le bloc dans l'entree de journal
#   ./scripts/cout.sh --dry-run    releve et affiche seulement, n'ecrit rien
#   ./scripts/cout.sh --rappel     n'affiche qu'un avertissement si le releve manque ou
#                                  a derive — le mode qu'utilise pret.sh, jamais un
#                                  geste manuel
#
# La consommation d'une session ne vit PAS dans le depot : elle est ecrite au fil
# de l'echange dans le fichier de conversation du conteneur, sous
# ~/.claude/projects/<chemin-du-depot>/. Ce conteneur est ephemere, et rien ne
# recopie ce fichier avant qu'il disparaisse — d'ou ce script, qui fige le
# chiffre dans l'entree de journal, seul endroit du depot qui appartienne a la
# branche. Un releve manque est un releve perdu : aucun outil ne le reconstitue.

set -euo pipefail

DRYRUN=0 RAPPEL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRYRUN=1 ;;
    --rappel)  RAPPEL=1 ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/jetons.sh
. lib/journal.sh

BASE=$(fab base_branch main)

COUT_TAUX_JOURS=90         # au-dela, le taux de change est signale comme vieux

# Au-dela de ce contexte, chaque tour coute plus de 0,15 $ AVANT d'avoir rien
# fait. Le seuil n'est pas une limite technique : c'est le point ou couper la
# session, ou confier la suite a l'artisan, rapporte plus que ca ne coute.
COUT_CONTEXTE_ALERTE=300000
# Longueur d'une session d'agent au-dela de laquelle pret.sh avertit. Le cout
# d'une session croit en CARRE de sa longueur : elle fait N tours, et chacun
# relit ce que les N-1 precedents ont accumule. Mesure du 21 aout 2026, sur une
# branche a 501 tours d'agent : trois sessions de 88 a 109 tours relisaient 178 k
# a 238 k jetons par tour, contre 11 k a 37 k pour six sessions de 4 a 19 tours.
# Couper une session de cent tours en deux, chacune repartant du document de
# conception plutot que de l'exploration de l'autre, valait la moitie du poste.
#
# 60 n'est pas un rond : c'est la longueur au-dela de laquelle, sur cette
# branche, la relecture moyenne d'une session a depasse 150 000 jetons — soit le
# moment ou un tour coute plus cher que tout ce qu'il rend.
COUT_AGENT_TOURS_ALERTE=60

# Le double du seuil d'alerte, et le seul chiffre du depot qui REFUSE un commit.
# L'alerte ci-dessus a ete ignoree neuf fois sur vingt-deux branches, jusqu'a
# 703 497 jetons : un avertissement qu'on apprend a ignorer ne garde rien. Le
# refus a un cout — il tombe en pleine tache, et la seule issue est d'ouvrir une
# session neuve sur la meme branche — et c'est pourquoi il est place au DOUBLE
# de l'alerte : deux branches du depot l'auraient franchi, les deux plus lourdes.
COUT_CONTEXTE_CRITIQUE=600000

COUT_DEBUT='<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->'
COUT_FIN='<!-- /cout -->'
# Le bloc s'ECRIT avec COUT_DEBUT, mais il se RECONNAIT sur ce prefixe. Les
# entrees deja committees nomment « ./init.sh --cout », qui n'existe plus depuis
# que le releve a son propre script : les reconnaitre a l'identique leur
# ajouterait un second bloc au lieu de remplacer le premier, et cout_total_ecrit
# — qui garde la premiere occurrence — lirait le total perime pour toujours.
COUT_OUVERTURE='<!-- cout : genere par '

cout_dir() {  # le repertoire des conversations de CE depot, ou vide
  local d
  d="${HOME:-}/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')"
  [ -d "$d" ] || return 0
  ls "$d"/*.jsonl >/dev/null 2>&1 || return 0
  printf '%s' "$d"
}

# cout_fichiers <repertoire> — un chemin de conversation par ligne : les
# sessions principales a plat, PUIS les sous-agents. Un sous-agent lance par
# Agent(...) n'ecrit PAS dans le fichier de la session qui l'a lance : il a le
# sien, sous <repertoire>/<id-de-session>/subagents/agent-*.jsonl. Trouve a la
# main le 8 aout 2026 en lancant l'artisan pour de vrai : le releve annoncait
# toujours « aucun [tour] par des sous-agents » juste apres qu'un sous-agent
# ait rendu son rapport, faute de regarder ce sous-repertoire.
#
# Un agent lance par un WORKFLOW ecrit un niveau plus bas encore :
# <session>/subagents/workflows/<run>/agent-*.jsonl. Meme panne, meme cause,
# trouve le 16 aout 2026 : une branche qui avait lance onze agents en workflow
# annoncait 7,24 $ et « aucun sous-agent » pour environ 35 $ reels. Le motif
# doit donc etre ecrit en toutes lettres — un glob ne descend pas tout seul, et
# c'est le seul endroit du script a corriger : la detection de sous-agent teste
# « /subagents/ » n'importe ou dans le chemin, et matche deja le plus profond.
cout_fichiers() {
  local d="$1" f
  for f in "$d"/*.jsonl "$d"/*/subagents/*.jsonl "$d"/*/subagents/workflows/*/agent-*.jsonl; do
    [ -e "$f" ] && printf '%s\n' "$f"
  done
}

# cout_releve <repertoire> <branche> <base> — lit toutes les conversations et
# rend des lignes « CLE valeur... ». Le calcul reste dans awk, ou les flottants
# existent ; la mise en forme reste dans bash, ou les accents et les tableaux se
# relisent.
#
# Le fichier est du JSON par ligne, et une REPONSE Y OCCUPE PLUSIEURS LIGNES :
# une par bloc — la reflexion, le texte, chaque appel d'outil — et chacune
# reporte la MEME facture. Les additionner compte la meme requete deux a trois
# fois, d'autant plus qu'elle a appele d'outils. C'est ce qu'a fait ce script
# pendant huit entrees de journal, qui portent donc toutes un total gonfle d'un
# facteur voisin de deux ; « requestId » les regroupe et une requete deja vue
# est sautee.
#
# Ce qui est extrait de la ligne, et ou :
#
#   AVANT usage (la « tete »)   « model », « isSidechain » — la tete porte aussi
#                               le CONTENU du message, d'ou la premiere
#                               occurrence de model et pas une autre
#   APRES usage (la « queue »)  « requestId », « gitBranch » — usage clot le
#                               message, la queue n'est donc que metadonnee : y
#                               chercher ces cles les met hors d'atteinte d'un
#                               message qui les transporterait dans son texte
#
# Deux pieges dans l'objet usage lui-meme : « iterations » repete input_tokens
# et output_tokens pour chaque tentative — on coupe donc avant lui — et
# « cache_creation » redetaille l'ecriture par duree de vie, sans danger
# celui-la, ses cles commencent par « ephemeral_ » et non par le guillemet que
# les motifs exigent.
#
# L'ATTRIBUTION. Un conteneur voit plusieurs branches, et tout additionner donne
# a la derniere relevee le travail de toutes les autres — c'est ainsi que deux
# entrees du journal portent le meme travail a deux minutes d'ecart. Sont
# retenus les echanges de la branche courante, ceux de la base, et ceux dont le
# champ manque : une session cloud ouvre sa branche apres quelques echanges, et
# les exclure amputerait le releve de son propre debut. Toute AUTRE branche
# nommee est ecartee, et dite.
cout_releve() {
  local fichiers=()
  while IFS= read -r f; do fichiers+=("$f"); done < <(cout_fichiers "$1")
  awk -v TARIFS="$(jetons_tarifs)" \
      -v MULT_E="$JETONS_CACHE_ECRITURE" -v MULT_L="$JETONS_CACHE_LECTURE" \
      -v BRANCHE="$2" -v BASE="$3" '
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
    function texte(s, cle,   re, v) {
      re = "\"" cle "\":[ \t]*\"[^\"]*\""
      if (!match(s, re)) return ""
      v = substr(s, RSTART, RLENGTH); sub(/^[^:]*:[ \t]*\"/, "", v); sub(/\"$/, "", v)
      return v
    }
    # Un fichier de sous-agent n a pas de « demarrage » ni de « croissance » a
    # lui : ce sont des notions de la session PRINCIPALE, et il ne compte pas
    # non plus comme une session de plus dans « N session(s) lisible(s) ». Son
    # cout entre quand meme dans le total et dans le poste SIDE plus bas — la
    # ligne « side » de son premier echange le porte deja.
    FNR == 1 {
      side_fichier = (FILENAME ~ /\/subagents\//) ? 1 : 0
      if (!side_fichier) { sessions++; nf = sessions }
    }
    {
      p = index($0, "\"usage\":{")
      if (!p) next
      # Un message qui TRANSPORTE du JSON — ce script cite dans une reponse, une
      # conversation relue — porte le motif sans porter la facture. Le type le
      # tranche : seul un message d assistant est facture.
      if ($0 !~ /"type":[ \t]*"assistant"/) next
      tete = substr($0, 1, p - 1)
      queue = substr($0, p)

      rid = texte(queue, "requestId")
      if (rid == "") rid = texte(tete, "id")
      if (rid != "" && (rid in vu_req)) next
      if (rid != "") vu_req[rid] = 1

      br = texte(queue, "gitBranch")
      if (br != "" && br != BRANCHE && br != BASE) {
        autres[br] = 1
        autres_j += val(queue, "input_tokens") + val(queue, "cache_creation_input_tokens") \
                  + val(queue, "cache_read_input_tokens") + val(queue, "output_tokens")
        next
      }

      u = queue
      q = index(u, "\"iterations\"")
      if (q) u = substr(u, 1, q - 1)

      m = "?"
      if (match(tete, /"model":[ \t]*"[^"]*"/)) {
        m = substr(tete, RSTART, RLENGTH)
        sub(/^"model":[ \t]*"/, "", m); sub(/"$/, "", m)
      }
      # Le marqueur isSidechain est cense suffire seul, mais un fichier de
      # sous-agent en est l emplacement, pas seulement le contenu de chacune
      # de ses lignes : side_fichier tranche meme si une ligne particuliere
      # ne le portait pas.
      side = (side_fichier || (tete ~ /"isSidechain":[ \t]*true/)) ? 1 : 0

      v_e = val(u, "input_tokens");                  v_ce = val(u, "cache_creation_input_tokens")
      v_cl = val(u, "cache_read_input_tokens");      v_s  = val(u, "output_tokens")

      vus[m] = 1
      e[m] += v_e; ce[m] += v_ce; cl[m] += v_cl; s[m] += v_s
      if (side) { se[m] += v_e; sce[m] += v_ce; scl[m] += v_cl; ss[m] += v_s; ech_side++ }

      ech++
      # Un tour qui ne rend qu un appel d outil paie tout le contexte relu pour
      # une sortie de rien. Les grouper divise le poste — mais SEULEMENT chez la
      # session principale, et c est la correction du 21 aout 2026 : chez un
      # agent, un tour EST un appel d outil, et un test ne se groupe pas avec la
      # correction qui en depend. Mesure de la branche qui l a trouve : 499 des
      # 512 tours courts etaient des tours d agent. La regle du contrat visait
      # donc un levier quasi inexistant la ou etait l argent, ce qui explique
      # qu elle n ait rien deplace en vingt-deux branches. D ou le comptage
      # separe : sans lui, un chiffre juste porte un conseil faux.
      if (v_s < 300 && (m in prix_e)) {
        courts++
        courts_d += (v_ce * prix_e[m] * MULT_E + v_cl * prix_e[m] * MULT_L \
                   + v_s * prix_s[m]) / 1000000
        if (side_fichier) courts_side++
      }
      # Une session d agent se decoupe par FICHIER, jamais par une heuristique
      # sur la retombee de la relecture : deux agents concurrents entrelacent
      # leurs tours, et le fichier est le seul decoupage qui y survive. Ce que
      # cette mesure sert a voir : le cout d une session d agent croit en CARRE
      # de sa longueur — deux fois plus de tours, chacun relisant deux fois plus.
      if (side_fichier) {
        run_ech[FILENAME]++
        run_cl[FILENAME] += v_cl
        if (m in prix_e)
          run_d[FILENAME] += (v_ce * prix_e[m] * MULT_E + v_cl * prix_e[m] * MULT_L \
                            + v_s * prix_s[m]) / 1000000
      }
      det_side[ech] = side; det_m[ech] = m
      det_ce[ech] = v_ce; det_cl[ech] = v_cl; det_s[ech] = v_s

      # Le demarrage et la croissance decrivent la session PRINCIPALE : un
      # sous-agent a son propre demarrage, dans son propre contexte, qui ne
      # dit rien de celui de la session qui l a lance — l y melanger fausserait
      # les deux mesures sans que rien ne le montre.
      if (!side_fichier) {
        # Le demarrage — contrat, outillage, definitions d outils — est ecrit en
        # cache au PREMIER echange de la session, puis relu a chacun des suivants.
        # Il se mesure donc une fois par session, et se facture autant de fois
        # qu il y a d echanges apres lui.
        if (!(nf in sess_ech)) sess_prelude[nf] = v_ce
        sess_ech[nf]++
        # La courbe part du premier echange qui RELIT quelque chose : au tout
        # premier, il n y a rien a relire et le zero qu il rapporte ne dit rien de
        # la pente. C est la pente qui interesse, pas l origine.
        if (!premier_vu && v_cl > 0) { premier_cl = v_cl; premier_vu = 1 }
        dernier_cl = v_cl
      }
    }
    END {
      for (m in vus) {
        j_e += e[m]; j_ce += ce[m]; j_cl += cl[m]; j_s += s[m]
        if (!(m in prix_e)) { inconnus = inconnus sep_i m; sep_i = ", "; continue }
        d_e  += e[m]  * prix_e[m] / 1000000
        d_ce += ce[m] * prix_e[m] * MULT_E / 1000000
        d_cl += cl[m] * prix_e[m] * MULT_L / 1000000
        d_s  += s[m]  * prix_s[m] / 1000000
        d_side += (se[m] * prix_e[m] + sce[m] * prix_e[m] * MULT_E \
                 + scl[m] * prix_e[m] * MULT_L + ss[m] * prix_s[m]) / 1000000
        modeles = modeles sep_m m; sep_m = ", "
      }
      for (m in vus) j_side += se[m] + sce[m] + scl[m] + ss[m]
      for (i in sess_prelude) { prelude += sess_prelude[i]; relu += sess_prelude[i] * (sess_ech[i] - 1) }
      for (b in autres) n_autres++
      for (r in run_ech) {
        n_runs++
        if (run_ech[r] > max_ech) {
          max_ech = run_ech[r]; max_cl = run_cl[r]; max_d = run_d[r]
        }
      }

      printf "SESSIONS %d\n", sessions
      printf "ECHANGES %d %d\n", ech, ech_side
      printf "MODELES %s\n", modeles
      printf "INCONNUS %s\n", inconnus
      printf "AUTRES %d %d\n", n_autres, autres_j
      printf "PRELUDE %d %d\n", prelude, relu
      printf "COURBE %d %d\n", premier_cl, dernier_cl
      printf "SIDE %d %.6f\n", j_side, d_side
      printf "COURTS %d %.6f %d\n", courts, courts_d, courts_side
      printf "AGENTS %d %d %d %.6f\n", n_runs, max_ech, \
        (max_ech > 0 ? int(max_cl / max_ech) : 0), max_d
      printf "POSTE entree %d %.6f\n", j_e, d_e
      printf "POSTE ecriture %d %.6f\n", j_ce, d_ce
      printf "POSTE lecture %d %.6f\n", j_cl, d_cl
      printf "POSTE sortie %d %.6f\n", j_s, d_s
      printf "TOTAL %d %.6f\n", j_e + j_ce + j_cl + j_s, d_e + d_ce + d_cl + d_s
      for (i = 1; i <= ech; i++)
        printf "DETAIL %d %s %s %d %d %d\n", i, \
          (det_side[i] ? "agent" : "principal"), det_m[i], det_ce[i], det_cl[i], det_s[i]
    }
  ' "${fichiers[@]}"
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
  awk -v d="$COUT_OUVERTURE" -v f="$COUT_FIN" '
    index($0, d) == 1 { saute = 1 }
    saute != 1 { print }
    $0 == f { saute = 0 }
  ' "$entree" > "$tmp"
  # « $(cat) » retire les lignes vides de fin : le bloc se recolle toujours a la
  # meme distance du texte, qu'il remplace un bloc precedent ou non.
  printf '%s\n\n%s\n' "$(cat "$tmp")" "$bloc" > "$entree"
  rm -f "$tmp"
}

# cout_rappel <entree> — l'avertissement de pret.sh. Il AVERTIT sans bloquer :
# le releve peut encore etre ecrit au commit suivant, tant que la branche vit,
# et refuser un commit pour un chiffre serait plus couteux que le chiffre.
# Mais il se repete a chaque etape, parce qu'une branche fusionnee sans releve
# a perdu le sien pour de bon.
# L'alerte de contexte, ou rien. Elle sort dans les DEUX modes : par cout_rappel,
# donc par pret.sh avant chaque commit — le seul moment ou l'on peut encore couper
# la session — et a la fin du releve normal, ce qui la rend observable par
# test-cout.sh, dont le harnais lance --dry-run. « champ » n'existe pas encore
# ici, d'ou la lecture directe du releve par awk.
# Rend 3 quand le seuil CRITIQUE est franchi, 0 sinon : c'est ce code que
# pret.sh transforme en refus. Un code dedie plutot qu'une sortie non nulle
# ordinaire, pour qu'une panne du script — qui sortirait en 1 ou 2 — ne se lise
# jamais comme « contexte critique ».
cout_alerte() {  # cout_alerte <releve>
  local dernier
  dernier=$(printf '%s\n' "$1" | awk '$1 == "COURBE" { print $3 }')
  [ -n "$dernier" ] && [ "$dernier" -gt "$COUT_CONTEXTE_ALERTE" ] 2>/dev/null || return 0
  if [ "$dernier" -gt "$COUT_CONTEXTE_CRITIQUE" ] 2>/dev/null; then
    bad "contexte de $(jetons_nb "$dernier") jetons — au-dela du critique ; termine cette session et rouvre-en une sur la MEME branche, qui reprend par le depot"
    return 3
  fi
  warn "contexte de $(jetons_nb "$dernier") jetons — chaque tour le paie en entier ; coupe la session, ou confie la suite a l'artisan"
}

# Prend le releve en argument plutot que de le refaire : l'alerte de contexte,
# elle, ne depend pas de l'entree de journal et se lance meme quand la branche
# n'en a pas encore ouvert une. Les deux etaient lies, et le contexte n'etait
# donc jamais mesure sur une branche neuve.
cout_rappel() {
  local entree="$1" releve="$2" ecrit actuel
  actuel=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $2 }')
  [ -n "$actuel" ] && [ "$actuel" -gt 0 ] 2>/dev/null || return 0
  ecrit=$(cout_total_ecrit "$entree")
  if [ -z "$ecrit" ]; then
    warn "cout : non releve — ./scripts/cout.sh l'ecrit dans l'entree (le chiffre disparait avec le conteneur)"
  elif [ "$((ecrit * 10))" -lt "$((actuel * 9))" ]; then
    warn "cout : releve a $(jetons_nb "$ecrit") jetons, la conversation en compte $(jetons_nb "$actuel") — relance ./scripts/cout.sh"
  fi
  cout_rappel_agents "$releve"
}

# cout_rappel_agents <releve> — l'avertissement sur la LONGUEUR d'une session
# d'agent. Il vit ici, a cote du rappel de cout, parce qu'il repond a la meme
# question — « ou part l'argent » — et qu'il doit sortir au meme moment : avant
# un commit, seul instant ou l'on peut encore decouper le chantier suivant.
#
# Il AVERTIT sans bloquer, comme le rappel de cout : une session deja longue est
# du passe, la refuser ne la raccourcit pas. Ce qu'il change est le chantier
# SUIVANT, et pour ca il suffit qu'il se voie.
#
# La regle qu'il rend visible existait depuis des semaines dans memory/travail.md
# — « un chantier se dimensionne pour tenir sous 100 000 jetons » — sans qu'aucun
# chiffre ne la mette devant les yeux de personne. C'est la lecon de la branche
# qui l'a ajoute : une regle ecrite que rien ne mesure ne deplace rien.
cout_rappel_agents() {  # cout_rappel_agents <releve>
  local tours moyen
  tours=$(printf '%s\n' "$1" | awk '$1 == "AGENTS" { print $3 }')
  moyen=$(printf '%s\n' "$1" | awk '$1 == "AGENTS" { print $4 }')
  [ -n "$tours" ] && [ "$tours" -gt "$COUT_AGENT_TOURS_ALERTE" ] 2>/dev/null || return 0
  warn "agents : la plus longue session fait $tours tours a $(jetons_nb "$moyen") jetons relus chacun — son cout croit en carre de sa longueur ; decoupe le chantier suivant en deux"
}

courante=$(branche_courante)
entree=""
[ "$courante" != "$BASE" ] && entree=$(journal_entree "$courante")

if [ "$RAPPEL" = 1 ]; then
  CRITIQUE=0
  d_rappel=$(cout_dir)
  if [ -n "$d_rappel" ]; then
    releve_rappel=$(cout_releve "$d_rappel" "$courante" "$BASE")
    cout_alerte "$releve_rappel" || CRITIQUE=3
    [ -n "$entree" ] && cout_rappel "$entree" "$releve_rappel"
  fi
  exit "$CRITIQUE"
fi

dir=$(cout_dir)
if [ -z "$dir" ]; then
  echo "Aucune conversation lisible depuis ce conteneur — rien a relever."
  echo "Le fichier vit sous ~/.claude/projects/<chemin-du-depot>/ et disparait avec le conteneur."
  exit 0
fi

releve=$(cout_releve "$dir" "$courante" "$BASE")
sessions=$(printf '%s\n' "$releve" | awk '$1 == "SESSIONS" { print $2 }')
modeles=$(printf '%s\n' "$releve" | sed -n 's/^MODELES //p')
inconnus=$(printf '%s\n' "$releve" | sed -n 's/^INCONNUS //p')
champ() {  # champ <CLE> <rang> — un champ du releve, par son mot-cle et sa position
  printf '%s\n' "$releve" | awk -v k="$1" -v n="$2" '$1 == k { print $(n + 1) }'
}
echanges=$(champ ECHANGES 1);    ech_side=$(champ ECHANGES 2)
n_autres=$(champ AUTRES 1);      autres_j=$(champ AUTRES 2)
prelude=$(champ PRELUDE 1);      prelude_relu=$(champ PRELUDE 2)
cl_premier=$(champ COURBE 1);    cl_dernier=$(champ COURBE 2)
side_j=$(champ SIDE 1);          side_d=$(champ SIDE 2)
courts=$(champ COURTS 1);        courts_d=$(champ COURTS 2)
courts_side=$(champ COURTS 3)
n_runs=$(champ AGENTS 1);        run_max_ech=$(champ AGENTS 2)
run_max_cl=$(champ AGENTS 3);    run_max_d=$(champ AGENTS 4)
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
  lignes="$lignes| $1 | $(jetons_nb "$j") | $(cout_montant "$d" "") |
"
}
ajoute "Entrée" entree
ajoute "Écriture de cache" ecriture
ajoute "Lecture de cache" lecture
ajoute "Sortie" sortie
tot_j=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $2 }')
tot_d=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $3 }')
lecture_j=$(printf '%s\n' "$releve" | awk '$1 == "POSTE" && $2 == "lecture" { print $3 }')

# « Ce qui coute » est un paragraphe en gras et NON un titre de niveau 3 : ce
# bloc vit dans une entree de journal, ou --check denombre les anomalies sur les
# lignes « ### » et comparerait alors six titres a cinq champs « Detecte par ».
# Un generateur qui ecrit dans un document verifie se plie a la forme de ce
# document.
#
# Le tableau des postes dit ce que la branche a coute ; il ne dit pas OU agir.
# Ces quatre lignes-la le disent, et ce sont elles qu'on relit d'une branche a
# l'autre : le demarrage est un cout FIXE paye a chaque echange — donc le seul
# qu'on reduise en elaguant l'outillage plutot qu'en travaillant moins — et la
# croissance de la relecture dit a partir de quand une session devrait etre
# coupee en deux.
part() {  # part <numerateur> <denominateur> — « 80 % », ou vide si indecidable
  awk -v a="${1:-0}" -v b="${2:-0}" 'BEGIN { if (b + 0 > 0) printf "%d %%", 100 * a / b }'
}
# Le meme calcul sur des MONTANTS : « 0 » et « 0,00 » ne sont pas comparables en
# shell, et « part » recevrait des flottants la ou elle attend des entiers.
part_d() { awk -v a="${1:-0}" -v b="${2:-0}" 'BEGIN { if (b + 0 > 0) printf "%d %%", 100 * a / b }'; }
if [ "${ech_side:-0}" -gt 0 ] 2>/dev/null; then
  side_txt="dont $ech_side par des sous-agents — $(jetons_nb "$side_j") jetons, $(cout_montant "$side_d" "")"
else
  side_txt="aucun par des sous-agents"
fi
autres_txt=""
[ "${n_autres:-0}" -gt 0 ] 2>/dev/null && autres_txt="
- **Écarté** — $n_autres autre(s) branche(s) travaillée(s) dans ce conteneur,
  $(jetons_nb "$autres_j") jetons, qui ne sont pas ceux de celle-ci."

# Le conseil qui suit le chiffre des tours courts. Il CHANGE selon qui les fait,
# et c'est tout l'objet de la correction du 21 aout 2026 : « grouper les appels
# independants » est vrai de la session principale et faux d'un agent, dont
# chaque tour EST un appel d'outil. Le meme chiffre portait le meme conseil pour
# les deux, ce qui a laisse le premier poste de la facture intact pendant
# vingt-deux branches.
if [ "${courts_side:-0}" -gt 0 ] 2>/dev/null; then
  courts_txt="Dont $(jetons_nb "$courts_side") chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe."
else
  courts_txt="Grouper les appels indépendants dans un même tour divise ce poste."
fi

# La ligne qui manquait, et qui nomme le premier poste reel quand des agents
# travaillent. Elle ne s'ecrit pas s'il n'y en a pas eu : une rubrique absente et
# une rubrique a zero ne disent pas la meme chose.
agents_txt=""
if [ "${n_runs:-0}" -gt 0 ] 2>/dev/null; then
  agents_txt="
- **Sessions d'agent** — $n_runs, dont la plus longue fait $(jetons_nb "$run_max_ech") tours,
  relit $(jetons_nb "$run_max_cl") jetons par tour en moyenne et coûte $(cout_montant "$run_max_d" "").
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié."
  [ "${run_max_ech:-0}" -gt "$COUT_AGENT_TOURS_ALERTE" ] 2>/dev/null && agents_txt="$agents_txt
  **Au-delà de $COUT_AGENT_TOURS_ALERTE tours, découpe le chantier.**"
fi

# Le detail survit a la branche, et c'est tout son interet : le fichier de
# conversation meurt avec le conteneur, et sans lui plus rien n'est refaisable —
# ni un recalcul aux tarifs du jour, ni une lecture sous un autre angle. Il est
# compact et illisible a dessein : son lecteur est un outil, le tableau au-dessus
# est pour l'oeil.
detail=$(printf '%s\n' "$releve" | awk '$1 == "DETAIL" { $1 = ""; sub(/^ /, ""); print }')

bloc=$(cat <<BLOC
$COUT_DEBUT
## Coût

Relevé le $(date -u '+%Y-%m-%d à %H:%M UTC'), sur $sessions session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
${modeles:-aucun}. Tarifs de \`fabrique.yml\`, en dollars par million de jetons ;
écriture de cache à $(virgule "$JETONS_CACHE_ECRITURE")x le prix d'entrée, lecture à $(virgule "$JETONS_CACHE_LECTURE")x.$([ -n "$taux" ] && printf ' Taux
1 $ = %s € au %s.' "$(virgule "$taux")" "$taux_date")

| Poste | Jetons | Coût |
|---|---:|---:|
$lignes| **Total** | **$(jetons_nb "$tot_j")** | **$(cout_montant "$tot_d" "$taux")** |

**Ce qui coûte**

- **$echanges appel(s) au modèle** — un par réponse, outils compris —, $side_txt.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  $(jetons_nb "$prelude") jetons, écrits une fois par session puis relus à chaque
  échange : $(jetons_nb "$prelude_relu") jetons de relecture, $(part "$prelude_relu" "$lecture_j") de tout ce qui a été relu.
- **Tours courts** — $(jetons_nb "$courts") des $(jetons_nb "$echanges") tours ($(part "$courts" "$echanges")) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent $(cout_montant "$courts_d" ""), soit $(part_d "$courts_d" "$tot_d") de la facture.
  $courts_txt$agents_txt
- **Croissance** — $(jetons_nb "$cl_premier") jetons relus au premier appel qui relise
  quelque chose, $(jetons_nb "$cl_dernier") au dernier : une session longue se paie à chaque tour.$autres_txt

<!-- cout-total: $tot_j -->
<!-- cout-agent-max: ${run_max_ech:-0} -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
$detail
-->
$COUT_FIN
BLOC
)

printf '%s\n' "$bloc"
echo
cout_alerte "$releve"

[ "$DRYRUN" = 1 ] && { ok "--dry-run : rien ecrit"; exit 0; }

if [ -z "$entree" ]; then
  warn "aucune entree de journal pour '$courante' — releve affiche, pas ecrit"
  exit 0
fi
cout_ecrit "$entree" "$bloc"
ok "cout ecrit dans $entree"
