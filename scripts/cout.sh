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
    FNR == 1 { sessions++; nf = sessions }
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
      side = (tete ~ /"isSidechain":[ \t]*true/) ? 1 : 0

      v_e = val(u, "input_tokens");                  v_ce = val(u, "cache_creation_input_tokens")
      v_cl = val(u, "cache_read_input_tokens");      v_s  = val(u, "output_tokens")

      vus[m] = 1
      e[m] += v_e; ce[m] += v_ce; cl[m] += v_cl; s[m] += v_s
      if (side) { se[m] += v_e; sce[m] += v_ce; scl[m] += v_cl; ss[m] += v_s; ech_side++ }

      ech++
      # Un tour qui ne rend qu un appel d outil paie tout le contexte relu pour
      # une sortie de rien. Les grouper est le seul gain sans contrepartie : deux
      # appels independants dans le meme tour coutent une relecture au lieu de
      # deux, et ne changent rien a ce qui est lu.
      if (v_s < 300 && (m in prix_e)) {
        courts++
        courts_d += (v_ce * prix_e[m] * MULT_E + v_cl * prix_e[m] * MULT_L \
                   + v_s * prix_s[m]) / 1000000
      }
      det_side[ech] = side; det_m[ech] = m
      det_ce[ech] = v_ce; det_cl[ech] = v_cl; det_s[ech] = v_s

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

      printf "SESSIONS %d\n", sessions
      printf "ECHANGES %d %d\n", ech, ech_side
      printf "MODELES %s\n", modeles
      printf "INCONNUS %s\n", inconnus
      printf "AUTRES %d %d\n", n_autres, autres_j
      printf "PRELUDE %d %d\n", prelude, relu
      printf "COURBE %d %d\n", premier_cl, dernier_cl
      printf "SIDE %d %.6f\n", j_side, d_side
      printf "COURTS %d %.6f\n", courts, courts_d
      printf "POSTE entree %d %.6f\n", j_e, d_e
      printf "POSTE ecriture %d %.6f\n", j_ce, d_ce
      printf "POSTE lecture %d %.6f\n", j_cl, d_cl
      printf "POSTE sortie %d %.6f\n", j_s, d_s
      printf "TOTAL %d %.6f\n", j_e + j_ce + j_cl + j_s, d_e + d_ce + d_cl + d_s
      for (i = 1; i <= ech; i++)
        printf "DETAIL %d %s %s %d %d %d\n", i, \
          (det_side[i] ? "agent" : "principal"), det_m[i], det_ce[i], det_cl[i], det_s[i]
    }
  ' "$1"/*.jsonl
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
cout_alerte() {  # cout_alerte <releve>
  local dernier
  dernier=$(printf '%s\n' "$1" | awk '$1 == "COURBE" { print $3 }')
  [ -n "$dernier" ] && [ "$dernier" -gt "$COUT_CONTEXTE_ALERTE" ] 2>/dev/null || return 0
  warn "contexte de $(jetons_nb "$dernier") jetons — chaque tour le paie en entier ; coupe la session, ou confie la suite a l'artisan"
}

cout_rappel() {
  local entree="$1" d ecrit actuel releve
  d=$(cout_dir); [ -n "$d" ] || return 0
  releve=$(cout_releve "$d" "$(branche_courante)" "$BASE")
  cout_alerte "$releve"
  actuel=$(printf '%s\n' "$releve" | awk '$1 == "TOTAL" { print $2 }')
  [ -n "$actuel" ] && [ "$actuel" -gt 0 ] 2>/dev/null || return 0
  ecrit=$(cout_total_ecrit "$entree")
  if [ -z "$ecrit" ]; then
    warn "cout : non releve — ./scripts/cout.sh l'ecrit dans l'entree (le chiffre disparait avec le conteneur)"
  elif [ "$((ecrit * 10))" -lt "$((actuel * 9))" ]; then
    warn "cout : releve a $(jetons_nb "$ecrit") jetons, la conversation en compte $(jetons_nb "$actuel") — relance ./scripts/cout.sh"
  fi
}

courante=$(branche_courante)
entree=""
[ "$courante" != "$BASE" ] && entree=$(journal_entree "$courante")

if [ "$RAPPEL" = 1 ]; then
  [ -n "$entree" ] && cout_rappel "$entree"
  exit 0
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
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — $(jetons_nb "$cl_premier") jetons relus au premier appel qui relise
  quelque chose, $(jetons_nb "$cl_dernier") au dernier : une session longue se paie à chaque tour.$autres_txt

<!-- cout-total: $tot_j -->
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
