# lib/jetons.sh — ce qui sert a passer des jetons a l'argent, et a l'ecrire.
#
# Deux metiers s'en servent, et ils ne lisent pas la meme chose :
#   scripts/cout.sh   mesure UNE branche depuis les conversations du conteneur ;
#   scripts/jetons.sh mesure TOUTES les branches depuis ce que cout.sh a fige
#                     dans le journal.
# Les tarifs, les deux multiplicateurs de cache et la mise en forme des nombres
# sont les seules choses qu'ils partagent — les avoir en double, c'est se
# reveiller un jour avec deux factures differentes pour la meme consommation.
#
# Sourcer lib/socle.sh AVANT ce fichier : jetons_tarifs appelle ymaps().

# Deux multiplicateurs suffisent a passer des jetons a l'argent une fois le prix
# d'entree connu. Ils valent pour toute l'API, quel que soit le modele, et
# vivent donc ici plutot que dans fabrique.yml, ou seuls les tarifs par modele
# et le taux de change ont leur place.
JETONS_CACHE_ECRITURE=1.25   # ecrire dans le cache coute 1,25x le prix d'entree
JETONS_CACHE_LECTURE=0.10    # y lire coute 0,1x

jetons_tarifs() {  # « modele:entree:sortie » separes par « ; », depuis fabrique.yml
  local t n i sep=""
  t=$(ymaps fabrique.yml tarifs)
  n=$(map_count "$t")
  for ((i = 0; i < n; i++)); do
    printf '%s%s:%s:%s' "$sep" \
      "$(map_one "$t" "$i" modele)" "$(map_one "$t" "$i" entree)" "$(map_one "$t" "$i" sortie)"
    sep=";"
  done
}

jetons_nb() {  # 7557412 -> « 7 557 412 »
  printf '%s' "$1" | sed -e :a -e 's/\(.*[0-9]\)\([0-9]\{3\}\)/\1 \2/;ta'
}

virgule() { printf '%s' "${1//./,}"; }  # 1.25 -> « 1,25 »
