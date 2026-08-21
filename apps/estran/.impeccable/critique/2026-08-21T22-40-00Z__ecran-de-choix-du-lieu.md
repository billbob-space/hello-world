---
target: l'ecran de choix du lieu (prp/05), et les etats littoral / interieur / capacite inconnue de l'ecran principal
total_score: 31
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-08-21T22-40-00Z
slug: ecran-de-choix-du-lieu
---
⚠️ DEGRADE : contexte unique (aucun outil de sous-agent expose dans ce
harnais). Les deux evaluations — revue de conception et releve navigateur —
ont ete conduites dans le meme contexte, l'une apres l'autre. Le detecteur
mecanique d'impeccable n'a pas ete lance : ses modules d'analyse HTML sont
absents de cet environnement (deja constate le 21 aout 2026, zero constat =
sous-comptage). Ce n'est pas un quitus mecanique.

Method: application REELLE, binaire reconstruit apres chaque edition
(go:embed), lancee contre `e2e/stub-serveur.js` sur un port dedie (19083 /
stub 19085) pour ne pas gener la suite. Onze etats parcourus a 390 px et
1440 px : accueil littoral · ecran de choix ferme puis ouvert · liste par
defaut · recherche littoral / interieur / capacite inconnue / aucun resultat /
recherche en panne (route `/api/lieux` coupee) · les quatre etats de
geolocalisation (refusee via `grantPermissions([])`, indisponible, aboutie
avec nom, aboutie SANS nom via un point que la BAN ne resout pas) · les trois
ecrans principaux qui en decoulent. Mesures au navigateur : `getBoundingClientRect`
sur chaque controle, `elementFromPoint` aux bords des cibles tactiles,
`textContent` des trois lignes de capacite, `getComputedStyle` sur les
pastilles. `axe` NON rejoue : `e2e/tests/lieu.spec.js` le lance deja sur
l'ecran de choix ouvert, et il bloque.

Etat des tests apres correction : `./apps/estran/test.sh` vert ·
`./apps/estran/e2e/lancer.sh` 12/12 (2 degrade + 10 connu/lieu, dont les deux
controles d'accessibilite).

## Design Health Score

| # | Heuristique | Score | Probleme principal |
|---|---|---|---|
| 1 | Visibilite de l'etat | 3 | Le lieu regarde est ecrit partout ou il faut — bouton d'en-tete, `<title>`, lisere eau sur la fiche courante. Mais un lieu dont la capacite est INCONNUE ne porte aucune pastille, alors que ses deux voisins en portent une : l'absence de repere est le seul signal, et elle ne se lit pas. |
| 2 | Correspondance au monde reel | 2 | **Le point faible.** « Pas de maree — cote a 54,5 km » s'affiche sur une fiche marquee LITTORAL. Ce qui est a 54 km n'est pas la cote, c'est le point de mesure de maree le plus proche. Sur une plage, l'ecran affirme que la mer est a 54 km. |
| 3 | Controle et liberte | 4 | `<dialog>` natif, `showModal()`, Echap, clic hors cadre, focus rendu au bouton par un seul ecouteur `close` : verifie aux deux largeurs, aucun piege. Le corps ne defile pas derriere. |
| 4 | Coherence et standards | 3 | Une seule grammaire pour les six etats de capacite depuis la correction ci-dessous (`<Sujet> — <etat>`). Reste que « Recherche indisponible. Reessayez. » est une septieme forme de panne, hors du gabarit unifie le 21 aout — texte nu, ne nomme pas qui ne repond pas. |
| 5 | Prevention de l'erreur | 3 | Aucune valeur inventee : `littoral: null` ne devient jamais `false`, la regle centrale du PRP est tenue. Mais elle est tenue TROP LARGE : la maree, qui vient d'une autre source, est declaree inconnue alors qu'elle est connue (constat 1). |
| 6 | Reconnaitre plutot que se rappeler | 4 | Les huit derniers lieux sont la a l'ouverture, Le Touquet toujours en dernier, tout sous `try/catch`. On ne retape jamais un lieu deja vu. |
| 7 | Souplesse et efficacite | 3 | Debounce sur la recherche, jeton anti-course sur les reponses desordonnees, geolocalisation qui choisit directement sans second geste. Mais changer de lieu coute deux gestes et un ecran entier a chaque fois — cout assume et ecrit au PRP. |
| 8 | Esthetique et sobriete | 3 | La fiche est sobre et lisible ; l'ambre n'y entre pas. A 390 px le cadre n'occupe que 358 px sur 844 et la jauge de maree du lieu qu'on quitte reste PARFAITEMENT lisible dessous — voir « Montre, pas tranche ». |
| 9 | Recuperation d'erreur | 3 | Position refusee dit quoi faire ensuite (« Cherchez la commune ci-dessus ») et ne redemande pas. « Aucune commune trouvee. » ne dit rien de la suite, et la recherche ne couvre que la France sans que rien ne l'ecrive. |
| 10 | Aide et documentation | 3 | Les trois lignes de capacite SONT la documentation, et c'est le bon endroit. Elles ne disent rien de la couverture geographique de la recherche, qui est la premiere chose qui surprendra. |
| **Total** | | **31/40** | **Le geste est solide, ce qu'il annonce l'est moins** |

Un point de plus que le 21 aout matin, et le mouvement est ailleurs que la
note : ce qui montait, c'est la mecanique — le `<dialog>` est irreprochable,
la course des reponses est traitee, le stockage est cloisonne. Ce qui retient,
c'est le **contenu** des trois lignes : l'ecran existe pour annoncer ce qu'un
lieu vaut, et c'est precisement la qu'il est le moins sur de lui.

## Ce qui marche

**Le `<dialog>` est fait comme il faut, et le commentaire qui l'accompagne le
prouve.** `display: flex` pose sur `.dialogue-lieu[open]` et non sur
`.dialogue-lieu` : le piege ou une regle d'auteur efface le `display: none` du
navigateur a ete rencontre, mesure, et documente a l'endroit ou il se
represente. Un seul ecouteur `close` rend le focus, quel que soit le moyen
de fermeture — Echap, clic hors cadre, bouton, selection d'un lieu. Verifie
aux deux largeurs.

**La geolocalisation ne se declenche jamais a l'ouverture**, et les quatre
etats du § 4 existent vraiment. L'etat « abouti, nom inconnu » — celui qui a
motive toute l'evolution — donne bien « Votre position (50.900, 1.100) » avec
les trois lignes de capacite justes : la fiche porte LITTORAL, annonce l'etat
de la mer present, et ne traite jamais l'absence de nom comme une erreur.

**Une absence legitime ne prend jamais le gabarit de panne**, nulle part.
`.indisponible-carte` compte 0 sur l'ecran d'un lieu de l'interieur, aux deux
largeurs, dans les trois lieux de test. La regression que le PRP redoutait le
plus n'a pas eu lieu, et `lieu.spec.js` la garde.

**Le vent, la pluie et les prochaines heures ne changent pas d'un lieu a
l'autre**, et la houle disparait des vignettes sans laisser de trou ni de zero
invente. La regle « une grandeur secondaire absente laisse sa ligne de cote »
est appliquee telle quelle.

## Corrige dans ce passage

Trois defauts objectifs — de ceux dont on peut dire « c'est faux » sans
debattre de gout. Tous mesures au navigateur avant et apres, binaire
reconstruit, `lancer.sh` 12/12 apres.

### [P1] Les deux lignes « on verra sur place » ne disaient pas de quoi elles parlaient

Sur un lieu a capacite inconnue, la fiche affichait, a l'oeil :

    ○ on verra sur place
    ○ on verra sur place
    ● Pluie a la minute — l'heure qui vient

Deux lignes strictement identiques, en italique, sans qu'aucun mot a l'ecran
ne dise laquelle parle de la maree et laquelle de l'etat de la mer. Le sujet
existait bien dans le DOM — `<span class="pour-lecteur">Marée : </span>` — mais
`clip-path` le retirait de la vue : **l'utilisateur voyant en savait moins que
le lecteur d'ecran**, sur l'unique ecran dont le metier est de dire ce qu'un
lieu vaut. `axe` ne pouvait rien voir : les deux textes sont contrastes,
atteignables et nommes.

Le sujet devient visible, avec le cadratin des cinq autres etats
(`Marée — …`, `Pas de marée — …`, `Marée — on ne sait pas pour l'instant`) :
une seule grammaire pour les six, `<Sujet> — <etat>`. Le `<span>` cache
disparait, sans quoi le sujet serait lu deux fois. Mesure apres :
`Marée — on verra sur place`, `État de la mer — on verra sur place`.
`lieu.spec.js` reste vert sans retouche — il verifiait « on verra sur place »
et l'absence de « pas de », les deux tiennent.

### [P1] « Pas de maree a Votre position (50.900, 1.100) — … »

Sur un lieu que la Base Adresse Nationale ne sait pas nommer — le cas d'usage
qui a motive toute cette evolution —, le titre de secours du § 4 etait injecte
tel quel dans le gabarit de phrase de l'absence de maree. Phrase relevee au
navigateur :

> Pas de marée à Votre position (50.900, 1.100) — la côte la plus proche du
> catalogue est à 54,5 km.

Majuscule en plein milieu, coordonnees a trois decimales entre parentheses au
milieu d'un texte, et « à Votre position » qui ne se dit pas. « Votre
position » est un **titre de fiche**, ce que le PRP ecrit ; ce n'en fait pas
un complement de lieu.

`ouEstCe()` separe les deux usages : le titre reste « Votre position (…) » —
bouton d'en-tete, `<title>`, fiche —, la phrase dit « ici », le seul mot juste
quand on vient de donner sa position. Apres : « Pas de marée ici — la côte la
plus proche du catalogue est à 54,5 km. » Le drapeau vient du champ `nom` de
la reponse, jamais d'une expression reguliere sur le nom affiche.

### [P2] Les quatre controles neufs etaient sous la cible de 44 px que l'app se pose deja

Le bandeau de jours pose la reference dans cette meme feuille : `.pastille-jour`
mesure 54,4 x **44** px. Les controles introduits par cette branche, mesures a
390 px :

| controle | avant | apres |
|---|---|---|
| `#bouton-lieu` — le SEUL point d'entree de l'ecran de choix | 287,7 x **26** | rectangle sensible **44** px |
| `#dialogue-lieu-fermer` | 35,2 x **35,2** | 44 x 44 |
| `#lieu-recherche` | 310 x **38** | 44 |
| `#lieu-geoloc` | 175,4 x **36** | 44 |

Le bouton d'en-tete est le cas qui compte : 26 px de haut, le plus petit
element cliquable de la page, pour la seule porte d'entree d'une fonction
entiere. Sa cible est etendue par un pseudo-element (`::before`, `inset: -9px
-8px`) et non par du rembourrage : 26 + 2 x 9 = 44 px **sans deplacer un seul
pixel** — hauteur d'en-tete mesuree a 158 px avant comme apres, ce qui compte
au vu de la question 2 ci-dessous. `::after` portait deja le chevron. Verifie
par `elementFromPoint` aux deux bords : les deux repondent le bouton.

Non touche, hors perimetre de cette branche : `.bandeau-fleche` mesure 38,4 px
depuis le 20 aout.

## Montre, pas tranche

Trois choix de produit, trois variantes chacun, dans le monde visuel d'estran,
rendus a la largeur reelle d'un telephone :
**https://claude.ai/code/artifact/556a16c3-86cc-46a6-a307-701d3a1122dd**

Aucune ne rouvre ce qui a ete tranche : ni l'ecran de choix plein, ni le
partage cadre pointille / carte d'indisponibilite, ni l'ambre reservee a la
maree, ni la date ecrite une seule fois.

### 1 — L'ecran de choix dit « je ne sais pas » d'une chose qu'il sait

C'est le constat le plus lourd de ce passage, et il ne se corrige pas seul
parce que le PRP § 3 prescrit exactement le comportement observe.

`capaciteMaree()` court-circuite sur `lieu.littoral === null` et rend « on
verra sur place » **sans jamais interroger `/api/maree`**. Or les deux
capacites ne viennent pas de la meme source : `littoral` vient de l'appel
marin d'Open-Meteo, la maree du catalogue des sites. Un echec du premier rend
la seconde inconnue alors qu'elle est parfaitement connaissable. Sequence
mesuree, lieu de test « Zone-Test » :

    fiche          ○ Marée — on verra sur place
    1 clic plus tard, ecran principal :
                   Pas de maree ici — la cote la plus proche du catalogue
                   (Le Touquet (site test), a 622,5 km) n'est pas couverte
                   par ce fournisseur.

L'ecran qui existe pour annoncer d'avance ce qu'on va perdre se tait, et
l'ecran d'apres repond du tac au tac. C'est la promesse du § 1 — « elle la dit
AVANT » — prise en defaut sur le seul cas ou elle comptait vraiment.

Le voisin du meme constat : une fiche marquee **LITTORAL** qui porte « Pas de
maree — cote a 54,5 km ». Le mot « cote » est faux — ce qui est a 54 km, c'est
le point de mesure de maree le plus proche. Sur une plage, l'ecran affirme que
la mer est loin.

Variantes : *l'etat actuel corrige* (temoin) · *chaque ligne interroge sa
propre source*, la maree tranchee par le catalogue meme quand le marin est
muet, plus une troisieme pastille « a verifier » en pointille · *trois jetons
plutot que trois phrases*, la fiche en 3 lignes au lieu de 5 — 4 lieux
visibles sans defiler au lieu de 2, au prix d'une raison d'absence descendue
d'un cran.

**A trancher** : jusqu'ou l'ecran doit-il chercher avant de dire qu'il ne sait
pas, et faut-il un troisieme repere pour un lieu dont on ne sait rien ?

### 2 — La hauteur perdue en haut d'un ecran de telephone

Mesure a 390 x 844 : en-tete 0 → **158**, bandeau 158 → 245, titre MARÉE a 277,
jauge de maree a **312**. Il faut descendre 37 % de la hauteur visible avant
que commence la chose qu'on vient voir. L'en-tete empile trois lignes — le mot
« estran », le nom du lieu, l'horloge — parce qu'a cette largeur elles ne
tiennent pas cote a cote. A 1440 px l'horloge remonte sur la ligne du titre et
l'en-tete tombe a 133 px : **c'est l'ecran le plus court qui paie la ligne en
trop.**

Le rapprochement s'impose : le bandeau de lieux a ete ecarte le 21 aout, entre
autres, pour « une rangee de plus (~40 px) en haut d'un ecran de telephone
deja court, au-dessus de la maree qui est la premiere chose qu'on vient voir ».
L'argument etait juste ; il vaut aussi contre 158 px d'en-tete.

Variantes : *trois lignes* (temoin) · *l'horloge sur la ligne du titre*, le
meme arrangement qu'a 1440 px, 52 px rendus, une seule grammaire d'en-tete
pour les deux largeurs · *le lieu devient le titre* et « estran » quitte
l'ecran pour ne vivre que dans l'onglet et l'icone, 104 px rendus, au prix de
la date complete.

**A trancher** : le nom de l'app merite-t-il 40 px de haut a chaque
consultation ?

### 3 — Un lieu de l'interieur, et la place que garde une section vide

A Arras, le premier tiers de l'ecran de telephone porte un titre « MARÉE » et
un cadre qui dit qu'il n'y en a pas : 280 px mesures, du titre a la fin du
cadre. La pluie — la seule section qui ait quelque chose a dire sur ce lieu —
commence a 560 px.

Le cadre pointille est juste, et la decision du 21 aout n'est pas en cause :
une absence legitime ne se presente pas comme une panne, et c'est bien ce qui
se passe (`.indisponible-carte` = 0, verifie). La question est de place, pas
de forme.

Variantes : *la section en tete, vide* (temoin) · *l'absence devient une ligne
sous le nom du lieu* — un fait qui appartient au lieu, pas un trou dans une
rubrique, la pluie remonte de 280 px · *la section descend en bas, entiere* —
rien de neuf a ecrire, seul l'ordre change quand la maree manque.

**A trancher** : une absence merite-t-elle la place que l'app reserve a sa
donnee la plus importante ?

## Ce qu'axe ne peut pas voir

**Le cadre du choix ne prend pas l'ecran, et ce qu'il laisse voir le
contredit.** Mesure a 390 x 844 : le `<dialog>` occupe y 33,8 → 391,6, soit
358 px sur 844 — **42 %**. Le fond est `rgba(3, 12, 18, 0.72)` sur une page
deja tres sombre : la carte de maree du lieu qu'on quitte reste parfaitement
lisible dessous, « PM 20:00 · 5.50 m · basse mer dans 3 h 35 ». On lit donc
« Pas de maree — cote a 89 km » sur la fiche d'Arras avec une jauge de maree
vivante 40 px plus bas. Le PRP § 1 dit « le choix prend tout l'ecran, le temps
de le faire » ; a 390 px, il en prend moins de la moitie. Pire cas rencontre :
quand la liste se reduit a une ligne de panne, le bord bas du cadre tombe en
plein milieu du « 3.14 m » de la jauge derriere.

**Le changement de lieu est muet, comme le changement de jour l'etait.** Le
`<dialog>` se ferme, le focus revient au bouton d'en-tete — c'est bien fait —
mais toute la page se recharge sans qu'aucune region vivante n'annonce le
nouveau lieu. Le bouton retrouve garde son ancien nom une fraction de seconde,
puis change sous le curseur. La question 1 de la critique du 21 aout (« le
focus, ou la voix ? ») se pose desormais deux fois, pour le meme motif, et une
seule reponse devrait servir aux deux.

**La recherche ne couvre que la France, et rien ne l'ecrit.** Le PRODUCT.md le
sait et le nomme « une limite ecrite plutot que masquee » — mais elle n'est
ecrite que dans le PRODUCT.md. A l'ecran, une commune belge ou anglaise donne
« Aucune commune trouvee. », c'est-a-dire le message de la faute de frappe. Un
etat vide qui existe mais ne dit ni pourquoi ni quoi faire.

**Un lieu sans nom deborde des endroits qui ne l'attendent pas.** « Votre
position (50.900, 1.100) » devient le `<title>` de l'onglet — un signet, un
historique, un partage d'onglet portent alors des coordonnees brutes. Dans la
fiche, le nom passe a la ligne et laisse la pastille LITTORAL seule sur la
premiere, ce qui la fait flotter.

## Observations mineures

Le pied de page annonce « Open-Meteo · api-maree.fr » sur un lieu de
l'interieur, ou api-maree.fr n'a rien fourni — meme constat que le 21 aout
dans le cas de panne, nouveau cas de figure. « Recherche indisponible.
Reessayez. » est la seule panne de l'app qui echappe au gabarit unifie et ne
nomme pas qui ne repond pas. La puce de l'etat inconnu est un cercle de 8 px
en `1px dashed` : a cette taille le pointille rend trois taches, la
distinction ne tient que par le texte (ce qui suffit, mais la puce n'aide
pas). Le message de position refusee couvre aussi le delai de 10 secondes,
qu'il presente donc comme un refus. Le detecteur mecanique d'impeccable n'a pu
etre lance dans cet environnement : aucun constat mecanique n'est un
sous-comptage, pas un quitus.
