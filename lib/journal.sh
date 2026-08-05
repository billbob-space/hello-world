# lib/journal.sh — l'entree de journal, lue et ecrite par plusieurs metiers.
#
# branche.sh l'ouvre, pret.sh en verifie l'en-tete AVANT le commit, init.sh la
# revalide dans --check APRES : le premier juge l'entree de la branche courante
# alors qu'elle est encore non suivie par git, le second ne juge que les entrees
# deja suivies (voir journal_entete). Un controle qui ne vaudrait qu'en --check
# n'arriverait qu'apres le commit qu'il aurait du empecher — d'ou trois
# consommateurs pour un seul jeu de regles.
#
# Sourcer lib/socle.sh AVANT ce fichier : journal_ouvre appelle render(), et
# journal_entete appelle bad().
#
# Une entree par branche, ouverte avec elle et remplie au fil du travail. Ecrite
# a chaud, elle retient les anomalies mineures ; reconstituee a la fin, elle ne
# garde que les spectaculaires — or ce sont les mineures qui disent ou le
# contrat a un trou.
#
# La branche donne le nom du fichier, ce qui rend l'entree retrouvable sans
# index : fabrique/journal-des-anomalies -> journal/<date>-fabrique-journal-des-anomalies.md
# La date est figee a la creation, donc on retrouve par suffixe, jamais par date.

# Trois champs sont a vocabulaire ferme, parce que le lecteur du journal peut
# etre un agent qui en tire des plans d'amelioration : en prose libre, « moi »,
# « la critique impeccable » et « le compilateur » ne s'agregent pas, et la
# distribution que le journal promet n'est pas calculable. Constate sur les deux
# premieres entrees, ou treize valeurs ont donne six categories informelles —
# aucune conforme au gabarit qui les demandait.
#
# DETECTE est ordonne par cout croissant : plus une anomalie est rattrapee tard,
# plus elle a coute. L'agregat utile est « jusqu'ou la distribution glisse vers
# la droite », pas un simple decompte.
#
# MODE porte sur l'entree entiere, pas sur une anomalie. Il vaut « chaud » quand
# l'entree a ete remplie au fil du travail, « retrospective » quand elle a ete
# reconstituee apres coup — auquel cas les anomalies mineures manquent, et
# l'analyste doit s'interdire d'en tirer une mesure. Ce champ existe parce que
# cette consigne reposait sur une phrase en prose : le seul moyen de trouver les
# entrees concernees etait un grep sur « retrospectiv|reconstitu », qui matchait
# aussi le titre d'une anomalie *parlant* d'une reconstitution sans en etre une.
# Un vocabulaire suggere n'est pas un vocabulaire — la lecon de l'anomalie 4 de
# fabrique/journal-des-anomalies, rejouee un cran au-dessus.
#
# Les etiquettes de DETECTE et ACTION s'ecrivent sans accents — « Detecte par »,
# pas « Detecte par » accentue — comme tout le markdown genere par ces scripts. Le
# motif de verification reste ainsi en ASCII pur, insensible a la locale, et la
# prose accentuee vit dans Symptome et Cause qui ne sont pas verifies.
#
# PERIMETRE fait exception et porte ses accents : le gabarit l'emettait en ASCII,
# et les trois auteurs sur trois l'ont reecrit « Perimetre » accentue. Un
# vocabulaire que personne n'ecrit comme il est genere n'est pas tenable ; le
# gabarit suit donc l'usage. Le motif reste insensible a la locale parce qu'il
# compare des octets litteraux, pas des classes de caracteres.

JOURNAL_DIR=journal
JOURNAL_MARQUEUR=REMPLIS-MOI   # present = gabarit nu ; retire = entree ecrite
JOURNAL_DETECTE='compilateur|test|CI|relecture|auteur|utilisateur|production'
JOURNAL_ACTION='rien|contrat|garde-fou|outillage|comportement|arbitrage'
JOURNAL_MODE='chaud|retrospective'
JOURNAL_PERIMETRE_VIDE='<apps touchees, ou fabrique>'   # le gabarit, tel quel

journal_slug() { printf '%s' "${1//\//-}"; }

journal_entree() {  # journal_entree <branche> — le chemin de l'entree, ou vide
  local m
  m=$(ls "$JOURNAL_DIR"/*-"$(journal_slug "$1")".md 2>/dev/null | head -1)
  printf '%s' "$m"
}

journal_ouvre() {  # journal_ouvre <branche> — cree l'entree si elle n'existe pas
  local br="$1" f
  f=$(journal_entree "$br")
  [ -n "$f" ] && { ok "journal : entree existante ($f)"; return 0; }

  mkdir -p "$JOURNAL_DIR"
  f="$JOURNAL_DIR/$(date -u +%Y-%m-%d)-$(journal_slug "$br").md"
  render __BRANCHE__ "$br" __DATE__ "$(date -u +%Y-%m-%d)" __MARQUEUR__ "$JOURNAL_MARQUEUR" \
         __PERIMETRE__ "$JOURNAL_PERIMETRE_VIDE" \
    > "$f" <<'MD'
# __DATE__ — __BRANCHE__

<!-- __MARQUEUR__ : retire ce commentaire quand l'entree dit quelque chose.

     Une anomalie par bloc, ecrite quand tu la rencontres.

     Deux champs sont a vocabulaire ferme et ./scripts/pret.sh les verifie. Ce
     n'est pas de la bureaucratie : le lecteur de ce journal peut etre un agent
     qui en tire des plans d'amelioration, et « moi » ou « le compilateur » ne
     s'agregent pas. La prose va dans Symptome et Cause, qui sont libres.

     Detecte par — qui a rattrape l'anomalie, du moins cher au plus cher :

       compilateur   immediat, cout nul
       test          avant meme de lancer
       CI            avant la fusion
       relecture     humaine ou outillee, avant livraison
       auteur        en cours de travail, apres coup
       utilisateur   apres livraison : un aller-retour, et un garde-fou manquant
       production    apres deploiement

     Action — ce que l'anomalie devrait changer :

       rien          reparee, rien a en tirer
       contrat       CLAUDE.md dit quelque chose de faux, ou ne dit rien
       garde-fou     init.sh --check, pret.sh, ou un hook devrait le voir
       outillage     un plugin, un LSP, un agent manque
       comportement  facon de travailler, aucun artefact a changer
       arbitrage     demande une decision humaine, pas un correctif

     Une session sans anomalie est une entree valide — ecris « Aucune anomalie »
     et retire ce commentaire. Une entree vide et une entree jamais ouverte ne
     disent pas la meme chose.

     Deux champs d'en-tete sont verifies eux aussi :

     Perimetre — les apps touchees, ou « fabrique ». Sur une branche claude/*,
     dont le prefixe est impose par le harnais et ne dit rien du perimetre,
     c'est le SEUL endroit ou se lit le rayon de souffle. Remplis-le tot.

     Mode — `chaud` si cette entree est remplie au fil du travail, valeur par
     defaut et cas normal puisque branche.sh l'ouvre en meme temps que la
     branche ; `retrospective` si elle est reconstituee apres coup. Une entree
     retrospective ne garde que les anomalies spectaculaires : l'analyste la
     lit, mais s'interdit d'en tirer une mesure. Mentir ici ne coute rien a qui
     ecrit et fausse tout ce qui se calcule ensuite. -->

Branche : `__BRANCHE__`
Périmètre : __PERIMETRE__
Mode : `chaud`

## Anomalies

### 1. <ce qui a mal tourne, en une ligne>

**Symptome** — ce qui a ete observe.

**Cause** — ce qui l'a produit.

**Detecte par** — `auteur`

**Action** — `rien` — pourquoi, en une ligne.
MD
  ok "journal : entree ouverte ($f)"
}

# journal_entete <fichier> — verifie les deux champs d'en-tete de l'entree. Un
# bad par manquement, retour non nul si l'un cloche.
#
# Partage entre init.sh --check, qui ne juge que les entrees suivies par git, et
# pret.sh, qui juge celle de la branche courante alors qu'elle est encore non
# suivie : un controle qui ne vaudrait qu'en --check n'arriverait qu'apres le
# commit qu'il aurait du empecher.
journal_entete() {
  local e="$1" faute=0
  grep -qE "^Mode *: *\`($JOURNAL_MODE)\`" "$e" \
    || { bad "$e : champ 'Mode' absent ou hors vocabulaire — $JOURNAL_MODE"; faute=1; }
  grep -qF "$JOURNAL_PERIMETRE_VIDE" "$e" \
    && { bad "$e : 'Périmètre' est reste au gabarit — sur une branche claude/*, c'est le seul endroit ou se lit le rayon de souffle"; faute=1; }
  grep -qE '^Périmètre *: *[^[:space:]]' "$e" \
    || { bad "$e : champ 'Périmètre' absent"; faute=1; }
  return "$faute"
}
