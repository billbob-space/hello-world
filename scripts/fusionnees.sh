#!/usr/bin/env bash
#
# fusionnees.sh — quelles branches distantes peuvent partir, et lesquelles pas.
#
#   ./scripts/fusionnees.sh
#
# Une session cloud ouvre des branches et ne peut pas en fermer : le relais git
# du harnais refuse la suppression de refs (HTTP 403 sur git-receive-pack), et
# le serveur MCP GitHub expose create_branch sans son inverse. Les branches
# fusionnees s'accumulent donc sans que rien ne le signale. Ce script ne
# supprime rien — il n'en a pas le droit — il dit QUOI supprimer, ce qui est la
# partie qu'on ne peut pas faire de tete.
#
# Le critere n'est pas l'appartenance a l'ascendance de la base : sur ce depot
# il s'est trompe dans les deux sens. Il a classe « non fusionnees » trois
# branches simplement ecrasees en un commit (squash), dont le contenu etait bel
# et bien dans main ; et il n'a rien dit d'une branche dont la PR etait fusionnee
# mais qui portait cinq commits ecrits APRES, jamais repris. C'est l'equivalence
# de patch — git cherry, qui compare les patch-id — qui repond juste dans les
# deux cas. Un commit de fusion n'a pas de patch-id et git cherry l'ignore :
# c'est correct, « merge branch main » n'apporte rien que main n'ait deja.

set -euo pipefail

git rev-parse --show-toplevel >/dev/null 2>&1 || {
  echo "ERREUR : ce script doit tourner dans un depot git." >&2; exit 1; }
cd "$(git rev-parse --show-toplevel)"

. lib/socle.sh

BASE=$(fab base_branch main)

git fetch --prune origin "+refs/heads/*:refs/remotes/origin/*" >/dev/null 2>&1 \
  || warn "origin non joignable — l'etat ci-dessous peut etre perime"

# La branche sur laquelle on travaille est exclue : elle peut etre fusionnee
# et servir malgre tout a l'etape en cours — c'est le cas normal d'une session
# cloud, dont le nom de branche est impose et reutilise d'une PR a la suivante.
courante=$(branche_courante)

fusionnees=() vivantes=() ignoree=""
for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
  b=${ref#origin/}
  [ "$b" = "$BASE" ] && continue
  [ "$b" = HEAD ] && continue
  [ "$b" = "$courante" ] && { ignoree="$b"; continue; }
  # git cherry n'imprime que les commits absents de la base : « + » pour un
  # patch inedit, « - » pour un patch deja present sous un autre sha.
  cherry=$(git cherry "origin/$BASE" "$ref" 2>/dev/null || true)
  inedits=$(printf '%s\n' "$cherry" | grep -c '^+' || true)
  if [ "$inedits" -eq 0 ]; then
    fusionnees+=("$b")
  else
    # L'age du dernier patch inedit departage plus vite que son contenu : une
    # branche dont le dernier commit propre a douze jours a vu la base bouger
    # sous elle, et son patch est souvent inedit parce que le fichier qu'il
    # modifiait a ete reecrit depuis — pas parce que le travail manque.
    dernier=$(printf '%s\n' "$cherry" | grep '^+' | tail -1 | awk '{print $2}')
    jours=$(( ( $(date +%s) - $(git log -1 --format=%ct "$dernier") ) / 86400 ))
    vivantes+=("$b:$inedits:$(git log -1 --format=%cs "$dernier"):$jours")
  fi
done

[ -n "$ignoree" ] && { echo "-- ignoree"; warn "$ignoree — branche courante"; echo; }
echo "-- fusionnees dans $BASE — supprimables"
if [ ${#fusionnees[@]} -eq 0 ]; then
  echo "  (aucune)"
else
  for b in "${fusionnees[@]}"; do ok "$b"; done
fi

echo
echo "-- a regarder — patchs absents de $BASE"
if [ ${#vivantes[@]} -eq 0 ]; then
  echo "  (aucune)"
else
  for v in "${vivantes[@]}"; do
    IFS=: read -r vb vn vd vj <<<"$v"
    warn "$vb — $vn patch(s) inedit(s), le dernier le $vd (il y a $vj j)"
  done
  echo
  # Le titre de cette section dit « a regarder » et non « non fusionnees »,
  # parce que l'equivalence de patch ne sait pas voir un contenu REECRIT. Un
  # travail repris a un autre chemin, ou refait a la main, produit un patch
  # different : la branche est signalee ici alors que son contenu est bien
  # dans la base. La commande ne peut pas trancher ce cas — elle le remonte
  # plutot que de proposer une suppression qu'elle ne sait pas justifier.
  echo "  Un patch inedit ne veut pas dire un travail perdu : un contenu repris"
  echo "  a un autre chemin, ou refait a la main, produit un patch different."
  echo "  Compare avant de conclure :  git log --oneline origin/$BASE..origin/<branche>"
  echo
  echo "  L'age ci-dessus est le premier tri, l'etat de la pull request le second :"
  echo "  une PR close sans fusion dit un abandon, une PR fusionnee avec des commits"
  echo "  ecrits apres dit du travail reste en rade. Ni l'un ni l'autre ne se lit"
  echo "  dans git — il faut GitHub."
fi

if [ ${#fusionnees[@]} -gt 0 ]; then
  echo
  echo "Depuis une machine dont l'acces git n'est pas contraint :"
  echo
  for b in "${fusionnees[@]}"; do echo "  git push origin --delete $b"; done
  echo
  echo "Une suppression ne perd rien : ces patchs sont dans $BASE, et GitHub"
  echo "sait restaurer une branche pendant 90 jours."
fi
