#!/usr/bin/env bash
#
# pret.sh — cette etape est-elle committable ?
#
#   ./scripts/pret.sh
#
# Le point de passage avant chaque commit. Un commit qui casse quelque chose
# rend la relecture plus dure, pas plus simple : c'est tout l'interet de
# committer par etapes verifiees plutot qu'au kilometre.
#
# Il juge la branche, le journal et les tests des apps touchees ; le contrat et
# la fraicheur du releve de cout, il les DELEGUE a init.sh --check et a
# cout.sh --rappel, lances comme deux PROCESSUS separes plutot qu'importes. La
# frontiere de processus est deliberee — elle empeche ce script de developper
# une dependance sur l'interieur des deux autres, qui restent libres de changer
# sans le casser.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh
. lib/journal.sh

BASE=$(fab base_branch main)

# fichiers_touches, fichiers_ajoutes et apps_touchees vivent desormais dans
# lib/socle.sh : revue.sh doit relire exactement les apps que ce script teste,
# et deux copies de la meme mesure finissent par diverger.

courante=$(branche_courante)
echo "Etape en cours — branche $courante"

if [ "$courante" = "$BASE" ]; then
  bad "sur $BASE : le travail doit vivre sur une branche dediee (./scripts/branche.sh <app>/<sujet>)"
else
  ok "branche dediee"
fi

if ./init.sh --check >/tmp/.pret-check.$$ 2>&1; then
  ok "contrat respecte"
else
  bad "./init.sh --check echoue :"
  grep -E 'KO' /tmp/.pret-check.$$ | sed 's/^/      /' || true
fi
rm -f /tmp/.pret-check.$$

# Le journal se verifie ici et pas seulement en CI : rendu a la relecture de
# la PR, le detail des anomalies est deja perdu. Le gabarit nu ne compte pas —
# sans ce second test, le geste deviendrait une case a cocher vide.
if [ "$courante" != "$BASE" ]; then
  entree=$(journal_entree "$courante")
  if [ -z "$entree" ]; then
    bad "journal : aucune entree pour $courante (./scripts/branche.sh $courante l'ouvre)"
  elif grep -q "$JOURNAL_MARQUEUR" "$entree"; then
    bad "journal : $entree est encore le gabarit nu — ecris-y les anomalies de cette branche"
  elif ! journal_entete "$entree"; then
    : # journal_entete a deja dit ce qui manque
  else
    ok "journal : $entree"
    # Le rappel de cout avertit sans bloquer. Depuis qu'il est un processus
    # separe, sa panne emporterait pret.sh sous set -e — avant meme le verdict
    # sur les tests, et sans dire pourquoi.
    # Le « || true » d'origine protegeait d'une panne du script, qui aurait
    # emporte pret.sh sous set -e avant meme le verdict sur les tests. Il
    # avalait du meme coup le seul refus que cout.sh sache produire : le code 3
    # du seuil critique. Les deux cas se distinguent maintenant — 3 bloque,
    # tout autre incident passe comme avant.
    rc=0; ./scripts/cout.sh --rappel || rc=$?
    if [ "$rc" = 3 ]; then
      bad "contexte critique — ouvre une session neuve sur cette branche avant de committer"
    fi

    # Une Action « garde-fou » ou « contrat » PROMET un changement de la surface
    # partagee. Sur 41 entrees, 96 de ces promesses ont ete ecrites et 11 commits
    # seulement ont touche init.sh, scripts/, memory/ ou .claude/ : le journal
    # enregistre, et la boucle ne se referme pas. renaissance-gym en a consigne
    # dix, et son entree dit elle-meme qu'aucun de ces fichiers n'a bouge.
    #
    # CLAUDE.md compte dans la liste : un commit du depot le touche sans toucher
    # aucun des quatre autres, et l'oublier ferait avertir a tort. Avertissement
    # et jamais KO : une action peut legitimement se traiter ailleurs.
    promesses=$(grep -cE '^\*\*Action\*\* — `(garde-fou|contrat)`' "$entree" || true)
    if [ "$promesses" -gt 0 ]; then
      if fichiers_touches | grep -qE '^(memory/|\.claude/|scripts/|init\.sh$|CLAUDE\.md$)'; then
        ok "journal : $promesses action(s) garde-fou/contrat, et la surface partagee bouge"
      else
        warn "journal : $promesses action(s) garde-fou/contrat sans suite — rien sous memory/, .claude/, scripts/, init.sh ni CLAUDE.md. Si le correctif vit dans une autre branche, dis-le dans le champ Action"
      fi
    fi
  fi
fi

# Seules les apps reellement touchees depuis la base : sur une fabrique qui
# grandit, tout relancer a chaque commit couterait plus que ca ne rapporte.
touchees=$(apps_touchees)
if [ -z "$touchees" ]; then
  ok "aucune app modifiee — pas de test a lancer"
else
  for a in $touchees; do
    if [ ! -x "apps/$a/test.sh" ]; then
      bad "[$a] test.sh absent ou non executable"
    elif "apps/$a/test.sh" >/tmp/.pret-test.$$ 2>&1; then
      ok "[$a] tests verts"
    else
      bad "[$a] tests en echec :"
      tail -15 /tmp/.pret-test.$$ | sed 's/^/      /'
    fi
    rm -f /tmp/.pret-test.$$
  done
fi

# La revue outillee, sur les memes apps que les tests ci-dessus. PROCESSUS
# SEPARE, comme init.sh --check et cout.sh --rappel : la frontiere empeche ce
# script de developper une dependance sur l'interieur de revue.sh, qui reste
# libre de changer sans le casser.
#
# Elle relance les tests Go pour en mesurer la couverture, donc ils tournent
# DEUX fois — une fois par test.sh, une fois par la revue. C'est assume : test.sh
# est le contrat de l'app et peut faire davantage que du Go, la revue a besoin
# d'un profil de couverture que test.sh ne produit pas, et faire produire ce
# profil par test.sh reviendrait a imposer un format de sortie a dix apps pour
# economiser quelques secondes. Si le cout devient penible, c'est la couverture
# qui partira en CI seulement — pas la securite.
#
# Le bout en bout N'ENTRE PAS ici : il demande Docker et un navigateur, et
# pret.sh passe a chaque etape. Il tourne en CI a chaque changement.
if [ -n "$touchees" ]; then
  if ./scripts/revue.sh $touchees >/tmp/.pret-revue.$$ 2>&1; then
    ok "revue outillee verte"
  else
    bad "revue outillee :"
    grep -E 'KO' /tmp/.pret-revue.$$ | sed 's/^/      /' || true
  fi
  rm -f /tmp/.pret-revue.$$
fi

# Le PRD ne suit pas tout seul. Une CORRECTION passe par une ligne deja ecrite
# du document, donc la fait bouger ; une CAPACITE NEUVE ne passe par aucune —
# elle s'ajoute A COTE du PRD, et le document continue d'affirmer le contraire
# de ce que l'app fait. C'est arrive trois fois le meme jour sur
# marcq-handball : un minuteur et des liens video livres alors que le PRD les
# listait « hors perimetre, decide et non oublie ».
#
# Le signal retenu est le fichier de code NEUF — chrono.js, video.js,
# vue-classement.js sont les trois, et les quatre corrections du meme jour n'en
# ont cree aucun. Les .md et les tests sont exclus : un test qui accompagne un
# correctif est un fichier neuf et ne dit rien du perimetre.
#
# « e2e/ » est exclu au meme titre que « tests/ », et pour la meme raison. Le
# jour ou les dix suites bout en bout ont ete ecrites, cet avertissement s'est
# allume sur les dix apps a la fois — un lancer.sh, un playwright.config.js et
# un package.json sont des fichiers de code NEUFS, et aucun ne dit quoi que ce
# soit du perimetre du produit. Un garde-fou heuristique qui crie sur dix apps
# le meme jour n'apprend rien ; il apprend a ne plus le lire.
#
# « _test.go » manquait aussi, et depuis l'origine : le commentaire ci-dessus
# annoncait que « les tests sont exclus », mais le motif ne couvrait que les
# REPERTOIRES tests/ — or un test Go vit a cote du code qu'il teste, jamais dans
# un repertoire dedie. Un correctif Go accompagne de son test declenchait donc
# l'avertissement, ce que ce garde-fou promet explicitement de ne pas faire.
#
# Avertissement et non blocage, deliberement : le rapprochement est bon, il
# n'est pas infaillible — un refactoring qui deplace du code dans un fichier
# neuf le declenchera sans rien devoir au PRD. Bloquer sur un signal
# heuristique apprend a le contourner ; le montrer suffit a ce qu'on y pense.
#
# Son angle mort est l'autre bout de la meme mesure : la comparaison porte sur
# la BRANCHE ENTIERE depuis origin/main. Un PRODUCT.md touche au premier commit
# eteint l'avertissement pour tous les suivants, capacite neuve comprise. Le
# resserrer sur le dernier commit rendrait la moitie non committee inobservable,
# ce qui est pire : c'est la seule moitie qu'on peut encore corriger avant de
# committer. Ce que ce garde-fou rattrape ne dispense donc pas de relire le PRD
# avant la pull request — il rattrape l'oubli, pas la negligence.
# ./test-pret.sh tient les huit cas, en CI comme en local.
touches=$(fichiers_touches)
ajoutes=$(fichiers_ajoutes)
for a in $touchees; do
  [ -f "apps/$a/PRODUCT.md" ] || continue
  if grep -qxF "apps/$a/PRODUCT.md" <<< "$touches"; then continue; fi
  neufs=$(printf '%s\n' "$ajoutes" \
    | grep -E "^apps/$a/" | grep -vE '\.md$|(^|/)tests?/|(^|/)e2e/|_test\.go$|(^|/)\.impeccable/' || true)
  [ -n "$neufs" ] || continue
  warn "[$a] du code neuf, et apps/$a/PRODUCT.md ne bouge pas — une capacite neuve se declare dans le PRD :"
  printf '%s\n' "$neufs" | sed 's/^/          /'
done

# La critique UX suit-elle les ecrans ? AVERTISSEMENT ici, KO en CI sur la pull
# request — le meme dedoublement que pour le journal, et pour la meme raison :
# la critique vient en FIN de branche, bloquer des le premier commit apprendrait
# a contourner ; ne bloquer nulle part laisserait la regle a l'etat d'intention.
#
# Seules les apps dont CETTE BRANCHE touche les ecrans sont concernees. Les sept
# apps qui n'ont jamais eu de critique ne sont pas rattrapees : c'est l'arbitrage
# de l'utilisateur, « seulement les nouveaux ».
#
# L'horodatage est lu dans le NOM du fichier et jamais dans sa date de
# modification : un clone git remet toutes les mtime a l'heure du clone, et le
# controle passerait alors toujours.
for a in $touchees; do
  # Ce qui est un ECRAN, et ce qui n'en est pas. « web/ » en entier attraperait
  # aussi les configurations, les tests et la documentation qui y vivent — et un
  # garde-fou qui crie sur un fichier de doc apprend a etre ignore, ce que cette
  # branche a deja constate une fois. La liste d'exclusion est explicite : elle
  # se relit, et elle se corrige quand un cas manque.
  ecrans=$(printf '%s\n' "$touches" \
    | grep -E "^apps/$a/(web/|page\.html|.*\.html$|.*\.css$)" \
    | grep -vE '\.md$|(^|/)tests?/|\.config\.[jt]s$|(^|/)package(-lock)?\.json$|(^|/)tsconfig[^/]*\.json$' \
    || true)
  [ -n "$ecrans" ] || continue
  derniere=$(ls -1 "apps/$a/.impeccable/critique/" 2>/dev/null | LC_ALL=C sort | tail -1 || true)
  if [ -z "$derniere" ]; then
    warn "[$a] les ecrans bougent et aucune critique UX n'existe — l'agent esthete la rend avant la pull request"
    continue
  fi
  jour=$(printf '%s' "$derniere" | sed -nE 's/^([0-9]{4}-[0-9]{2}-[0-9]{2})T.*/\1/p')
  if [ -z "$jour" ]; then
    warn "[$a] la critique UX la plus recente ($derniere) n'a pas un nom horodate — sa fraicheur ne se mesure pas"
  elif [ "$jour" \< "$(date -u +%Y-%m-%d)" ]; then
    warn "[$a] les ecrans bougent et la critique UX date du $jour — l'agent esthete la rafraichit avant la pull request"
  else
    ok "[$a] critique UX du jour ($derniere)"
  fi
done

# Ce qui est fusionne sur main tourne-t-il en ligne ? La CI epingle dans
# versions.yml le commit qui a construit chaque image, et le fait UNIQUEMENT
# quand elle deploie. Une fusion dont le run est tombe — panne de runner le
# 16 aout, quota epuise, job annule — ne laisse donc AUCUNE trace : main est
# vert, la PR est fusionnee, et l'app tourne dans sa version d'avant. C'est
# arrive a estran, qui a passe l'apres-midi en ligne sans sa navigation
# temporelle, et rien dans le depot ne le disait.
#
# La comparaison est celle des ARBRES et non des commits : « apps/<nom> » a
# l'epingle contre le meme repertoire sur origin/main. Un commit de fabrique
# qui ne touche pas l'app ne la fait donc pas passer pour en retard, et deux
# commits qui se rattrapent l'un l'autre non plus.
#
# Contre origin/main, jamais HEAD : le travail non fusionne de la branche
# courante n'est PAS cense etre deploye, et le mesurer ferait avertir a chaque
# commit de chaque branche — un avertissement toujours allume ne se lit plus.
#
# Ici et pas dans --check, pour une raison mecanique : --check tourne en CI sur
# un clone superficiel, ou les commits epingles sont absents. pret.sh tourne en
# local sur un depot complet. Quand l'historique manque quand meme, on se tait
# plutot que d'annoncer un retard qu'on ne sait pas mesurer.
retard=""
if [ -f versions.yml ] && git rev-parse --verify -q "origin/$BASE" >/dev/null; then
  for d in apps/*/; do
    a="${d%/}"; a="${a#apps/}"
    [ -f "apps/$a/app.yml" ] || continue
    # Une app absente de versions.yml n'a pas encore d'image publiee : elle
    # retombe sur le tag mutable « :main », il n'y a pas de retard a mesurer.
    epingle=$(sed -nE "s/^$a:[[:space:]]*([0-9a-f]{7,})[[:space:]]*$/\1/p" versions.yml)
    [ -n "$epingle" ] || continue
    git cat-file -e "$epingle^{commit}" 2>/dev/null || continue
    livre=$(git rev-parse -q --verify "$epingle:apps/$a" 2>/dev/null) || continue
    fusionne=$(git rev-parse -q --verify "origin/$BASE:apps/$a" 2>/dev/null) || continue
    if [ "$livre" != "$fusionne" ]; then retard="$retard $a"; fi
  done
fi
if [ -n "$retard" ]; then
  warn "livraison :$retard — fusionne sur $BASE, mais l'image en ligne est celle d'un commit anterieur. Relance le workflow build sur $BASE avec « toutes »"
fi

echo
[ "$FAILED" -gt 0 ] && { echo "$FAILED point(s) bloquant(s) — ne committe pas en l'etat."; exit 1; }
echo "Etape verifiee. Tu peux committer."
