# 2026-08-23 — claude/ramure-v2-refonte-suite-l94n9m

Branche : `claude/ramure-v2-refonte-suite-l94n9m`
Périmètre : ramure-v2
Mode : `chaud`

La pull request #174 de `claude/ramure-v2-refonte-suite-w2epqj` est fusionnee et
deployee ; cette suite repart de `main`. Reste a traiter le constat N2 de la
critique du 23 aout — le seul non tranche : ce qui occupe les 548 px de noir du
mur d'accueil — et, dans le meme geste, le rognage silencieux du mur.

## Anomalies

### 10. Le mode autonome et la demande se contredisaient sur le seul point qui revient a l'utilisateur

**Symptome** — la demande d'ouverture porte deux consignes incompatibles : son
reste-a-faire commence par « demander a l'utilisateur laquelle des trois
variantes il retient », et sa derniere ligne fixe le mode a `/livrer`, qui
s'ouvre sur « a partir de maintenant, tu ne poses plus de question ». Les trois
seuls arrets de `/livrer` — exposition, effacement de donnees, debordement sur le
partage — ne couvrent pas un choix de forme.

**Cause** — les deux consignes ont ete ecrites a des moments differents du meme
message : le reste-a-faire decrit l'etat du chantier tel que la session
precedente l'a laisse, hors mode autonome, et le mode est la directive courante.
Le contrat les departage a moitie seulement : « un choix qui revient a
l'utilisateur se montre » exige la maquette, qui EXISTE et est publiee, mais ne
dit pas qui tranche quand le mode retire la question.

**Detecte par** — `auteur`

**Action** — `arbitrage` — tranche ici en faveur du mode, qui est la directive la
plus recente et qui prevoit explicitement ce cas (« si le choix demandait vraiment
une decision humaine, c'est une anomalie `arbitrage` »). La variante retenue est
**C**, pour la raison que la critique avait deja etablie sans oser conclure : elle
est la seule des trois qui ne plafonne pas le mur a 6 pochettes. Le cout d'une
erreur est d'une ligne de CSS, ce qui rend l'arbitrage peu risque — mais le fait
que `/livrer` puisse manger une question que le contrat exige de poser est un
trou du contrat, pas de cette branche.

### 11. « Continuer l'entree de journal » suppose un nom de branche que le harnais venait de changer

**Symptome** — la suite du travail ecrite dans l'entree de la branche
precedente, comme la demande le prescrivait, `pret.sh` refuse tout commit :
« journal : aucune entree pour claude/ramure-v2-refonte-suite-l94n9m ». Le
garde-fou cherche un fichier portant le nom de la branche COURANTE ; le contenu
etait dans celui de la branche fusionnee.

**Cause** — `/livrer` dit, pour une branche dont la pull request est deja
fusionnee : « repars de `main` en gardant le meme nom, et continue l'entree de
journal existante apres un separateur ». La consigne est juste, et sa premiere
moitie est ce qui rend la seconde possible : a nom de branche inchange, l'entree
existante EST celle de la branche courante. Ici le harnais cloud a assigne un
nom neuf — `w2epqj` → `l94n9m` — donc les deux moities se contredisent. Le
prefixe `claude/` que le contrat decrit deja comme « subi et non choisi » emporte
avec lui le suffixe, et personne n'avait relie ce fait a la regle de continuation.

**Detecte par** — `test`

**Action** — `contrat` — `/livrer` devrait dire ou continue une entree quand le
nom de branche N'EST PAS conservable : le contenu va dans l'entree de la branche
courante, l'ancienne ne garde qu'un separateur « Suite » qui pointe vers elle.
C'est ce qui a ete fait ici. La regle actuelle, prise au mot, bloque `pret.sh` et
prive `cout.sh` de l'endroit ou ecrire le releve — un travail correct qu'aucun
commit ne peut enregistrer.

### 12. Le plafond se mesurait sur un mur encore vide, donc ne se declenchait jamais

**Symptome** — la fonction de capacite juste, ses tests verts, et le plafond
inactif au premier rendu : la mesure lisait une tuile de 0 px, retombait sur le
repli « aucun plafond » et n'y revenait plus.

**Cause** — `auto-fit` effondre les pistes ou aucun element n'est place. Mesurer
la grille AVANT d'y avoir pose la moindre tuile ne peut donc rien rendre
d'exploitable : la geometrie que la CSS calcule n'existe qu'une fois le contenu
la. Lire la decision de la CSS plutot que la recalculer — le principe retenu au
§17 q9 — impose de la lire APRES le rendu, ce que la conception n'avait pas
prevu.

**Detecte par** — `auteur`

**Action** — `comportement` — le rendu se fait en deux passes : tout afficher,
mesurer, puis masquer la queue. Un mecanisme qui LIT ce qu'un autre a decide
depend de l'ordre dans lequel les deux s'executent, et cet ordre doit etre pose
explicitement plutot que suppose.

### 13. Le plafond restait inerte en usage reel alors que ses tests passaient

**Symptome** — la deuxieme passe en place et les tests verts, le plafond ne
s'engageait toujours pas dans l'application : chaque premier affichage de
l'accueil repliait sur « aucun plafond ».

**Cause** — le mur etait construit AVANT que la section d'accueil ne soit rendue
visible ; le conteneur mesure avait une hauteur nulle. Le defaut vit dans
l'ordre de deux instructions d'un appelant que la mission ne nommait pas, et
aucun test unitaire ne pouvait le voir : ils construisent le mur dans un
conteneur qu'ils ont eux-memes dimensionne, c'est-a-dire dans la seule situation
ou le defaut n'existe pas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — meme famille que les « verts silencieux » de
`memory/revue.md` : le repli choisi pour ne jamais afficher zero tuile masque
aussi le cas ou la mesure est impossible. Un repli qui protege l'utilisateur
doit rester visible du developpeur — ici, seul un cas de bout en bout mesurant
la page reelle a pu le montrer.

### 14. Deux defauts distincts confondus dans un seul cas de bout en bout

**Symptome** — le cas « plus de tuiles que la capacite » ecrit a 390x300 echouait
pour une raison qui n'etait pas celle qu'il testait : la rangee retenue,
183 px de tuiles carrees dans une zone de 111 px, debordait elle-meme.

**Cause** — le §17 q9 porte deux situations que rien ne distingue a l'oeil :
la rangee excedentaire tabulable, qui est le defaut a corriger, et la fenetre
trop courte pour une seule rangee, que la decision ACCEPTE explicitement
(« la montre quand meme »). Un cas de test qui les reunit ne peut prouver
aucune des deux.

**Detecte par** — `auteur`

**Action** — `comportement` — cas rejoue a 390x400, ou une rangee entiere tient
sans deborder : le second defaut y est isole. Une decision qui contient une
exception assumee demande un cas de test par branche, sans quoi l'exception
avale le cas nominal.

### 15. Le comptage brut des pistes de grille n'est pas le raccourci qu'il parait

**Symptome** — aucun. Deduire le nombre de colonnes de la longueur de
`grid-template-columns` calcule ressemble a un raccourci fragile : avec
`auto-fit`, les pistes vides sont censees s'effondrer, donc le comptage
pourrait varier avec le nombre d'enfants.

**Cause** — verifie plutot que suppose : la valeur calculee conserve toujours le
nombre THEORIQUE maximal de pistes, pistes a 0 px comprises. A 1440 px, 0, 3 et
23 enfants rendent tous 9 pistes.

**Detecte par** — `auteur`

**Action** — `rien` — ecrit ici pour que la question ne soit pas rouverte : le
comptage brut est stable, et le filtrer sur la largeur serait le vrai defaut.

### 16. Le chiffre qui pre-tranchait la question etait faux, et la demande interdisait de le recalculer

**Symptome** — la critique du 23 aout chiffre la capacite du mur a 18 pochettes
pour l'etat actuel comme pour la variante C, « a taille de tuile inchangee », et
c'est ce 18 contre 6 qui departage C des deux autres. La capacite reelle a
1440x900 est **36**, et la tuile n'est pas inchangee : elle passe de 230,7 px a
151,1 px entre 6 et 9 pochettes.

**Cause** — le calcul supposait le nombre de colonnes fige a 6. `auto-fit` ouvre
9 pistes a cette largeur et effondre celles ou rien n'est place : ajouter des
tuiles n'ajoute donc pas seulement des rangees, il ROUVRE des colonnes, et
retrecit la tuile jusqu'au plancher de 9 rem. Le 18 est ce qu'on obtient en
figeant la seule variable que la CSS fait bouger.

**Detecte par** — `relecture`

**Action** — `comportement` — le sens de l'arbitrage tient, et largement : 36
contre 6. Mais la demande d'ouverture portait « ne refais pas — les couts des
trois variantes sont chiffres dans la critique, ne les recalcule pas », et cette
consigne, suivie a la lettre, aurait recopie le chiffre faux dans le PRD ou il
serait devenu la reference. Une consigne d'economie qui protege un chiffre
protege aussi ses erreurs : ce qui ne se recalcule pas doit au moins se
verifier, et un chiffre de geometrie se verifie en trois lignes.

### 17. Le repeint complet au redimensionnement rebattait le mur en continu

**Symptome** — l'ecouteur de redimensionnement rappelait la fonction de peinture
entiere. En tri aleatoire, chaque evenement — glisser une fenetre, tourner un
telephone, faire disparaitre la barre d'URL — relancait un tirage : le mur se
rebattait en continu pendant le geste. A tous les tris, chaque tuile etait
detachee puis reinseree, ce qui relance son animation d'apparition a chaque
trame.

**Cause** — le §17 q9 demande que le PLAFOND soit reevalue au
redimensionnement ; la seule fonction disponible faisait tri, placement et
plafond d'un bloc, et elle a ete rappelee telle quelle. Le defaut est une
regression neuve : aucun ecouteur de redimensionnement n'existait avant.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le trou qui l'a laissee passer est nomme par le meme
constat : le test verifiait que l'ecouteur etait bien retire, jamais ce qu'il
FAIT. Un ecouteur dont on ne teste que la pose et la depose est un ecouteur non
teste. Le PRD dit desormais explicitement que seul le plafond est reevalue.

### 18. L'agent a rapporte comme preexistant un correctif qu'il venait d'ecrire

**Symptome** — le rapport de l'artisan charge de fermer le constat 1 dit : « le
code trouve portait DEJA, non commite, la separation correcte [...] verifie ligne
a ligne contre l'attendu du constat, rien a corriger ». Or le commit 0413d7f
contient bien le defaut — `surRedimensionnement` appelle `peindre` — et l'arbre
de travail contient le correctif. Personne d'autre n'a touche ce fichier entre
les deux : c'est l'artisan qui l'a ecrit, puis relu comme s'il l'avait trouve.

**Cause** — un agent qui edite puis se relit n'a aucun moyen de distinguer ce
qu'il vient d'ecrire de ce qui l'attendait, sauf a comparer au COMMIT. Sa
relecture « ligne a ligne contre l'attendu » etait juste ; c'est son attribution
qui etait fausse.

**Detecte par** — `auteur`

**Action** — `comportement` — le rapport etait dangereux bien au-dela de son
inexactitude : croire « c'etait deja fait, rien a corriger » sur un constat que
le relecteur avait localise a la ligne pres revenait a conclure que le relecteur
s'etait trompe, et a rouvrir un defaut ferme. La verification tient en une
commande — `git show <commit>:<fichier>` contre l'arbre — et elle est desormais
le reflexe des qu'un agent rapporte qu'il n'a rien eu a faire.

### 19. Le tri par defaut affirme une garde que personne n'a faite

**Symptome** — le mur d'accueil est trie par defaut sur « Gardés récemment » et
coiffe six artistes d'amorcage editorial que le visiteur n'a jamais gardes. Le
texte `accueilVide`, ecrit pour ce cas exact, existe dans le catalogue de
chaines et n'est employe nulle part.

**Cause** — le libelle du tri a ete ecrit pour l'etat ou la collection nourrit
le mur (F-28/F-30), qui est le seul prevu par le PRD ; l'amorcage editorial est
un repli que le §07 mentionne en une incise et dont aucun libelle ne tient
compte. La chaine de repli avait ete redigee en meme temps, puis oubliee — elle
n'a jamais eu d'appelant.

**Detecte par** — `relecture`

**Action** — `arbitrage` — NON tranche ici, et c'est deliberé. La critique
esthetique le reunit avec un second constat — qui possede les 121,6 px du haut
de l'ecran — en une seule question de hierarchie, montree en trois variantes.
C'est une question NEUVE, hors du perimetre demande a cette branche, et elle a
une forme visible : elle revient a l'utilisateur, avec ses maquettes.

### 20. Deux agents ont revendique le meme correctif, aucun ne l'a su

**Symptome** — l'artisan rapporte avoir trouve le correctif du redimensionnement
« deja la, non commite, rien a corriger » (anomalie 18) ; l'esthete, lance en
parallele, le rapporte sous « corrige » comme son propre travail. Un seul
correctif existe.

**Cause** — deux agents ont travaille en meme temps sur le meme fichier a partir
du meme constat de relecture, et chacun a relu un arbre de travail que l'autre
avait modifie. Aucun des deux ne pouvait distinguer son edition de celle du
voisin : c'est l'anomalie 18 vue une seconde fois, et sa cause n'est pas la
distraction d'un agent mais le lancement concurrent.

**Detecte par** — `auteur`

**Action** — `comportement` — deux agents qui ECRIVENT ne se lancent pas en
parallele sur la meme app, meme avec des perimetres de fichiers disjoints
annonces : la critique esthetique corrige seule ce qui est objectif, donc elle
ecrit, et l'annonce « ne touche pas a ce fichier » ne l'a pas empechee de
converger sur le meme defaut. Le resultat etait bon ici par chance ; deux
corrections differentes du meme defaut se seraient ecrasees.

### 21. La critique s'est rendue elle-meme suspecte, et c'est ce qui la sauve

**Symptome** — la passe esthetique rapporte deux reserves sur son propre rendu :
aucun outil de sous-agent ne lui etait expose, ses deux evaluations ont donc
tourne en contexte unique, et son detecteur automatique a tourne en repli par
expressions regulieres, ses modules d'analyse HTML etant absents. Ses zero
constat automatiques sont un sous-comptage.

**Cause** — l'outillage attendu par la competence n'etait pas present dans le
conteneur, et rien n'echoue quand il manque : le detecteur retombe sur un mode
degrade qui rend le meme format de sortie.

**Detecte par** — `auteur`

**Action** — `outillage` — meme famille que les faux diagnostics Go du 23 aout
(anomalie 2) : un outil qui se degrade en silence rend un vert qui ressemble a
un vert mesure. Ce qui a fonctionne ici est que l'agent l'ait DIT ; ce qui manque
est que le mode degrade se signale tout seul.

### 22. Sortir la pull request du brouillon rejoue toute la CI sur le meme commit

**Symptome** — la pull request ouverte en brouillon, ses sept controles verts, la
fusion est refusee : « 2 of 2 required status checks have not succeeded ». Le
passage de brouillon a « prete a relire » a declenche un SECOND cycle complet sur
le meme SHA — contrat, detect, outillage, tests — dont les controles obligatoires
etaient a nouveau en attente.

**Cause** — le workflow se declenche sur l'evenement `ready_for_review` comme sur
`opened`. Ouvrir en brouillon puis sortir du brouillon fait donc deux cycles
complets la ou une ouverture directe n'en fait qu'un. La consigne d'ouvrir en
brouillon vient du harnais cloud, pas du contrat ; les deux ne se sont jamais
parle, et personne ne paie visiblement la difference.

**Detecte par** — `CI`

**Action** — `arbitrage` — non corrige ici : toucher aux declencheurs du workflow
est un geste sur le partage, alors que le sujet de cette branche est une app. Mais
le cout est reel et se repete a CHAQUE pull request de la fabrique : le premier
poste de la facture est la longueur des sessions, le second pourrait bien etre ce
doublon que personne ne regarde. Soit le workflow ignore `ready_for_review`
quand un cycle a deja conclu sur le meme SHA, soit la pull request s'ouvre
directement prete. Le choix demande de trancher entre une consigne du harnais et
une consigne du contrat.

---

## Suite — apres la fusion de la PR 175

La PR 175 est fusionnee et deployee (`0929eeb`). L'utilisateur, a qui la question
de hierarchie du haut de l'accueil avait ete rendue avec ses trois maquettes,
repond « je te laisse decider pour moi ». Branche repartie de `main` sous le meme
nom. Perimetre inchange : ramure-v2.

### 23. La question rendue a l'utilisateur revient sans reponse, et ce n'est pas un refus

**Symptome** — la question de hierarchie (§17 q10) a ete montree en trois
variantes, avec leurs couts chiffres et un fait qui retirait un argument a tout
le monde. Reponse : « je te laisse decider pour moi ».

**Cause** — le contrat exige de MONTRER un choix de forme, et il a raison : sans
les maquettes, la question n'aurait pas ete posable. Mais montrer ne suffit pas a
rendre un choix desirable pour celui qui recoit. Les trois variantes etaient
presentees a egalite — « aucune n'est retenue d'avance » — alors qu'une seule
reparait un libelle faux. Une egalite affichee la ou il n'y en a pas transforme
une decision en corvee.

**Detecte par** — `utilisateur`

**Action** — `comportement` — montrer trois variantes n'interdit pas d'en
recommander une et de dire pourquoi. La neutralite du rendu esthetique est juste
a l'interieur de la critique, qui ne doit pas trancher ; elle ne l'est plus dans
le message a l'utilisateur, ou taire une asymetrie connue lui fait porter un
arbitrage que les faits avaient deja fait. La prochaine question de forme sortira
avec les maquettes ET une recommandation motivee.

### 24. Retrecir le champ sur grand ecran a fait grandir le haut sur telephone

**Symptome** — le champ de recherche ramene de 1 000 a 420 px par un
`flex-basis` fixe : a 1440 la cible est atteinte, a 390 le haut passe de 117 a
154 px, soit 37 px de PLUS. Le geste cense degager de la place en enlevait la ou
l'ecran est le plus dispute.

**Cause** — l'algorithme de retour a la ligne teste l'hypothese de largeur AVANT
retrecissement : une base fixe de 420 px, meme limitee a l'accueil, gonfle cette
hypothese et fait passer la barre sur une ligne de plus. Le defaut n'est pas la
valeur, c'est qu'elle n'etait pas bornee au palier large.

**Detecte par** — `auteur`

**Action** — `comportement` — corrige avant livraison en bornant la regle au
palier large. La lecon est celle que le PRP porte deja et que ce cas verifie une
fois de plus : une geometrie se MESURE, elle ne se suppose pas — et elle se
mesure aux DEUX paliers, parce qu'un gain a l'un peut etre une perte a l'autre.
C'est aussi pourquoi le cas de bout en bout neuf asserte la hauteur du haut ET
la hauteur laissee au mur, jamais l'une sans l'autre : mesurer la seule hauteur
du haut n'aurait pas prouve que le mur y gagne.

### 25. La phrase qui explique le produit disparaissait au moment ou elle sert le plus

**Symptome** — apres un echec de plantation, l'accueil revient avec le texte
d'attente ordinaire du champ au lieu de la promesse. C'est-a-dire que
l'application cesse d'expliquer ce qu'elle fait exactement quand le visiteur
vient de se tromper.

**Cause** — trois chemins menent a l'accueil et un seul posait le bon texte.
`afficherAccueil` le posait, `masquerAccueil` remettait l'ordinaire, et le
traitement de l'echec re-affichait la section sans repasser par le premier. Le
defaut est ne du raisonnement « la promesse appartient a l'accueil » : elle
appartient a un ETAT, et un etat se retrouve par plusieurs chemins.

**Detecte par** — `relecture`

**Action** — `comportement` — repare par une fonction unique appelee aux trois
sites, plutot qu'un quatrieme endroit qui repose le texte a la main. La regle
generale : quand un reglage depend d'un etat atteignable par N chemins, il se
pose en UN endroit que les N appellent, jamais dans chacun d'eux.

### 26. Deux tests verifiaient leur propre decor, pas l'application

**Symptome** — le comportement livre — le libelle du tri, l'intertitre, le texte
d'attente — passait pour couvert par deux tests d'accessibilite. Or leur fixture
posait lui-meme les valeurs que les tests assertaient ensuite. Cote bout en bout,
aucune specification ne lisait le libelle rendu. Le cablage reel etait a
couverture NULLE.

**Cause** — le fixture avait ete etendu pour ressembler a l'ecran livre, et
l'assertion a suivi la ressemblance au lieu de suivre l'application. Un test qui
construit lui-meme ce qu'il verifie passe toujours, et il passe d'autant plus
surement que le code de production est casse.

**Detecte par** — `relecture`

**Action** — `garde-fou` — meme famille que les « verts silencieux » de
`memory/revue.md`, et la plus insidieuse : ici le vert etait MESURE, il mesurait
simplement autre chose. Les deux assertions tautologiques sont supprimees et la
preuve portee en bout en bout, ou c'est l'application qui rend le libelle. Un
test dont le fixture pose la valeur attendue n'est pas un test faible, c'est un
test nul.

### 27. Le garde-fou de hauteur etait borne sur l'avant, pas sur l'acquis

**Symptome** — le cas de bout en bout ecrit pour interdire au haut de l'ecran de
grandir sur telephone le bornait a 188,6 px, la mesure d'AVANT la decision. Le
reel apres travaux est 153,0 : l'assertion tolerait 35,6 px de croissance la ou
le document ecrit « ne grandit pas ». La regression `flex-basis` corrigee plus
tot dans cette meme branche donnait 190,0 — elle n'aurait ete rattrapee que par
1,4 px de marge.

**Cause** — borner sur la mesure d'avant semble prudent et parait prouver un
progres ; en realite cela fige le seuil au pire etat connu, et rend le garde-fou
muet sur tout l'espace entre le pire et l'acquis. Un cliquet se pose sur ce qu'on
vient d'obtenir, jamais sur ce qu'on vient de quitter.

**Detecte par** — `relecture`

**Action** — `garde-fou` — borne ramenee sur l'acquis, la valeur d'avant
conservee en commentaire de provenance. C'est exactement la regle que les barres
de couverture de la fabrique appliquent deja — « elles ne se deplacent que dans
le sens qui serre » — et qui n'avait pas ete transposee aux seuils de geometrie.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 14:13 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 551 | 0,01 $ |
| Écriture de cache | 1 547 285 | 7,66 $ |
| Lecture de cache | 69 865 936 | 28,60 $ |
| Sortie | 110 250 | 2,72 $ |
| **Total** | **71 525 022** | **38,98 $ — 33,85 €** |

**Ce qui coûte**

- **664 appel(s) au modèle** — un par réponse, outils compris —, dont 519 par des sous-agents — 47 285 546 jetons, 21,25 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  69 824 jetons, écrits une fois par session puis relus à chaque
  échange : 10 054 656 jetons de relecture, 14 % de tout ce qui a été relu.
- **Tours courts** — 580 des 664 tours (87 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 27,50 $, soit 70 % de la facture.
  Dont 516 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 14, dont la plus longue fait 118 tours,
  relit 109 287 jetons par tour en moyenne et coûte 7,64 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
  **Au-delà de 60 tours, découpe le chantier.**
- **Croissance** — 69 824 jetons relus au premier appel qui relise
  quelque chose, 244 323 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 71525022 -->
<!-- cout-agent-max: 118 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 69824 0 176
2 principal claude-opus-5 1247 69824 247
3 principal claude-opus-5 1439 71071 166
4 principal claude-opus-5 4033 72510 167
5 principal claude-opus-5 1608 76543 128
6 principal claude-opus-5 12465 78151 735
7 principal claude-opus-5 4248 90616 1601
8 principal claude-opus-5 1673 94864 114
9 principal claude-opus-5 554 96537 228
10 principal claude-opus-5 401 97091 149
11 principal claude-opus-5 1735 97492 332
12 principal claude-opus-5 1249 99227 94
13 principal claude-opus-5 1687 100476 1782
14 principal claude-opus-5 4034 102163 144
15 principal claude-opus-5 519 106197 117
16 principal claude-opus-5 1241 106716 2403
17 principal claude-opus-5 3020 107957 403
18 principal claude-opus-5 2266 110977 796
19 principal claude-opus-5 848 113243 1186
20 principal claude-opus-5 1592 114091 249
21 principal claude-opus-5 322 115683 2415
22 principal claude-opus-5 2779 116005 1338
23 principal claude-opus-5 1505 118784 95
24 principal claude-opus-5 351 120289 94
25 principal claude-opus-5 1866 120640 1800
26 principal claude-opus-5 2187 122506 1146
27 principal claude-opus-5 1430 124693 319
28 principal claude-opus-5 393 126123 2146
29 principal claude-opus-5 2341 126516 1397
30 principal claude-opus-5 1701 128857 898
31 principal claude-opus-5 996 130558 521
32 principal claude-opus-5 1081 131554 941
33 principal claude-opus-5 995 132635 276
34 principal claude-opus-5 664 133630 512
35 principal claude-opus-5 10459 126123 763
36 principal claude-opus-5 1465 136582 1827
37 principal claude-opus-5 2200 138047 2300
38 principal claude-opus-5 2685 140247 1221
39 principal claude-opus-5 1618 142932 291
40 principal claude-opus-5 575 144550 233
41 principal claude-opus-5 643 145125 721
42 principal claude-opus-4-7 13664 29208 453
43 principal claude-opus-5 3658 145768 139
44 principal claude-opus-4-7 677 42872 165
45 principal claude-opus-5 936 149426 1406
46 principal claude-opus-5 2316 150362 395
47 principal claude-opus-5 1274 152678 140
48 principal claude-opus-4-7 32261 43549 2437
49 principal claude-opus-4-7 2776 75810 717
50 principal claude-opus-5 12078 145125 3003
51 principal claude-opus-5 3265 157203 1198
52 principal claude-opus-5 1743 160468 931
53 principal claude-opus-5 1537 162211 912
54 principal claude-opus-5 947 163748 1439
55 principal claude-opus-5 1470 164695 293
56 principal claude-opus-5 577 166165 2477
57 principal claude-opus-5 2681 166742 1907
58 principal claude-opus-5 2294 169423 212
59 principal claude-opus-5 6788 166742 815
60 principal claude-opus-5 1041 173530 209
61 principal claude-opus-5 1028 174571 458
62 principal claude-opus-5 1031 175599 1085
63 principal claude-opus-5 1199 176630 783
64 principal claude-opus-5 838 177829 1667
65 principal claude-opus-5 2195 178667 290
66 principal claude-opus-5 379 180862 137
67 principal claude-opus-4-7 9346 29208 213
68 principal claude-opus-5 342 181241 304
69 principal claude-opus-4-7 337 38554 93
70 principal claude-opus-5 972 181583 98
71 principal claude-opus-5 508 182555 740
72 principal claude-opus-4-7 6741 38891 1417
73 principal claude-opus-4-7 1491 45632 69
74 principal claude-opus-5 1845 183803 1542
75 principal claude-opus-5 1693 185648 754
76 principal claude-opus-5 1441 187341 1804
77 principal claude-opus-5 1827 188782 1488
78 principal claude-opus-5 1613 190609 143
79 principal claude-opus-5 434 192222 118
80 principal claude-opus-5 914 192656 400
81 principal claude-opus-5 477 193570 1672
82 principal claude-opus-5 1998 194047 120
83 principal claude-opus-5 1412 196045 2015
84 principal claude-opus-5 2080 197457 152
85 principal claude-opus-5 257 199537 207
86 principal claude-opus-5 306 199794 185
87 principal claude-opus-5 1027 200100 794
88 principal claude-opus-5 880 201127 599
89 principal claude-opus-5 1077 202007 30
90 principal claude-opus-5 1311 203084 170
91 principal claude-opus-5 1371 204395 282
92 principal claude-opus-5 349 206048 30
93 principal claude-opus-5 659 206397 163
94 principal claude-opus-5 1627 207056 284
95 principal claude-opus-5 1030 208683 133
96 principal claude-opus-5 326 209713 199
97 principal claude-opus-5 315 210039 230
98 principal claude-opus-5 310 210354 230
99 principal claude-opus-5 2260 210664 1670
100 principal claude-opus-5 1698 212924 883
101 principal claude-opus-5 1080 214622 39
102 principal claude-opus-5 388 215702 30
103 principal claude-opus-5 758 216090 224
104 principal claude-opus-5 647 216848 379
105 principal claude-opus-5 349 217874 30
106 principal claude-opus-5 662 218223 221
107 principal claude-opus-5 306 218885 466
108 principal claude-opus-5 553 219191 48
109 principal claude-opus-5 397 219744 30
110 principal claude-opus-5 628 220141 189
111 principal claude-opus-5 805 220769 352
112 principal claude-opus-5 1493 221574 172
113 principal claude-opus-5 704 223067 258
114 principal claude-opus-5 327 223771 263
115 principal claude-opus-5 413 224098 174
116 principal claude-opus-5 356 224685 30
117 principal claude-opus-5 733 225041 204
118 principal claude-opus-5 690 225774 587
119 principal claude-opus-5 159502 49343 819
120 principal claude-opus-5 1175 208845 30
121 principal claude-opus-5 853 210020 196
122 principal claude-opus-5 37 211069 638
123 principal claude-opus-5 2472 211106 2027
124 principal claude-opus-5 2102 213578 1596
125 principal claude-opus-5 1911 215680 930
126 principal claude-opus-5 1081 217591 1870
127 principal claude-opus-5 2258 218672 579
128 principal claude-opus-5 863 220930 531
129 principal claude-opus-5 1923 221793 327
130 principal claude-opus-5 1656 223716 359
131 principal claude-opus-5 1303 225372 121
132 principal claude-opus-5 1076 226675 1018
133 principal claude-opus-5 1359 227751 1810
134 principal claude-opus-4-7 14572 29208 980
135 principal claude-opus-4-7 8339 43780 174
136 principal claude-opus-5 2142 229110 1138
137 principal claude-opus-4-7 3520 52119 1148
138 principal claude-opus-5 1537 231252 386
139 principal claude-opus-5 3993 233175 891
140 principal claude-opus-5 1085 237168 792
141 principal claude-opus-5 834 238253 2547
142 principal claude-opus-5 2937 239087 394
143 principal claude-opus-5 678 242024 101
144 principal claude-opus-5 1621 242702 482
145 principal claude-opus-5 1151 244323 2182
146 agent claude-sonnet-5 19159 0 5
147 agent claude-sonnet-5 2382 19159 5
148 agent claude-sonnet-5 800 21541 20
149 agent claude-sonnet-5 1345 22341 20
150 agent claude-sonnet-5 3010 23686 2
151 agent claude-sonnet-5 7360 26696 4
152 agent claude-sonnet-5 1122 34056 8
153 agent claude-sonnet-5 1290 35178 2
154 agent claude-sonnet-5 2679 36468 5
155 agent claude-sonnet-5 2456 39147 4
156 agent claude-sonnet-5 1678 41603 20
157 agent claude-sonnet-5 255 43281 20
158 agent claude-sonnet-5 691 43536 9
159 agent claude-sonnet-5 849 44227 20
160 agent claude-sonnet-5 4707 45076 2
161 agent claude-sonnet-5 2106 49783 4
162 agent claude-sonnet-5 2609 51889 3
163 agent claude-sonnet-5 1856 54498 10
164 agent claude-sonnet-5 1789 56354 2
165 agent claude-sonnet-5 1508 58143 2
166 agent claude-sonnet-5 986 59651 7
167 agent claude-sonnet-5 2768 60637 2
168 agent claude-sonnet-5 947 63405 2
169 agent claude-sonnet-5 547 64352 2
170 agent claude-sonnet-5 2325 64899 1
171 agent claude-sonnet-5 3051 67224 6
172 agent claude-sonnet-5 673 70275 3
173 agent claude-sonnet-5 1784 70948 1
174 agent claude-opus-5 32975 0 1
175 agent claude-opus-5 4712 32975 1
176 agent claude-opus-5 2694 37687 2
177 agent claude-opus-5 1759 40381 3
178 agent claude-opus-5 561 42140 17
179 agent claude-opus-5 880 42701 2
180 agent claude-opus-5 1629 43581 17
181 agent claude-opus-5 2303 45210 3
182 agent claude-opus-5 2112 47513 20
183 agent claude-opus-5 2524 49625 5
184 agent claude-opus-5 3672 52149 8
185 agent claude-opus-5 938 55821 17
186 agent claude-opus-5 2797 56759 3
187 agent claude-opus-5 1211 59556 20
188 agent claude-opus-5 4879 60767 3
189 agent claude-opus-5 862 65646 17
190 agent claude-opus-5 244 66508 16
191 agent claude-opus-5 329 66752 3
192 agent claude-opus-5 209 67081 20
193 agent claude-opus-5 256 67290 3
194 agent claude-opus-5 281 67546 33
195 agent claude-opus-5 169 67827 36
196 agent claude-opus-5 276 67996 2
197 agent claude-opus-5 375 68272 41
198 agent claude-opus-5 276 68647 41
199 agent claude-opus-5 235 68923 16
200 agent claude-opus-5 134 69158 17
201 agent claude-opus-5 156 69292 16
202 agent claude-opus-5 1900 69448 3
203 agent claude-opus-5 2313 71348 3
204 agent claude-opus-5 2376 73661 2
205 agent claude-opus-5 665 76037 17
206 agent claude-opus-5 589 76702 17
207 agent claude-opus-5 924 77291 2
208 agent claude-opus-5 1602 78215 36
209 agent claude-opus-5 1285 79817 3
210 agent claude-opus-5 1103 81102 40
211 agent claude-opus-5 1413 82205 5
212 agent claude-opus-5 532 83618 39
213 agent claude-opus-5 1248 84150 3
214 agent claude-opus-5 921 85398 38
215 agent claude-opus-5 152 86319 44
216 agent claude-opus-5 231 86471 17
217 agent claude-opus-5 616 86702 2
218 agent claude-opus-5 2107 87318 2
219 agent claude-opus-5 621 89425 41
220 agent claude-opus-5 1049 90046 3
221 agent claude-opus-5 1961 91095 3
222 agent claude-opus-5 930 93056 3
223 agent claude-opus-5 2041 93986 20
224 agent claude-opus-5 1743 96027 2
225 agent claude-opus-5 1230 97770 39
226 agent claude-opus-5 152 99000 39
227 agent claude-opus-5 1084 99152 2
228 agent claude-opus-5 517 100236 3
229 agent claude-opus-5 2249 100753 17
230 agent claude-opus-5 2132 103002 3
231 agent claude-opus-5 563 105134 20
232 agent claude-opus-5 394 105697 20
233 agent claude-opus-5 380 106091 2
234 agent claude-opus-5 1957 106471 20
235 agent claude-opus-5 1122 108428 20
236 agent claude-opus-5 1987 109550 2
237 agent claude-opus-5 1023 111537 2
238 agent claude-opus-5 713 112560 2
239 agent claude-opus-5 351 113273 20
240 agent claude-opus-5 448 113624 17
241 agent claude-opus-5 427 114072 36
242 agent claude-opus-5 154 114499 36
243 agent claude-opus-5 276 114653 40
244 agent claude-opus-5 999 114929 3
245 agent claude-opus-5 428 115928 41
246 agent claude-opus-5 288 116356 40
247 agent claude-opus-5 1124 116644 0
248 agent claude-opus-5 287 117768 36
249 agent claude-opus-5 545 118055 2
250 agent claude-opus-5 269 118600 41
251 agent claude-opus-5 377 118869 3
252 agent claude-opus-5 5015 119246 3
253 agent claude-opus-5 2144 124261 5
254 agent claude-opus-5 951 126405 9
255 agent claude-opus-5 19666 127356 5
256 agent claude-opus-5 6497 147022 4
257 agent claude-opus-5 175 153519 41
258 agent claude-opus-5 255 153694 20
259 agent claude-opus-5 234 153949 41
260 agent claude-opus-5 302 154183 41
261 agent claude-opus-5 254 154485 16
262 agent claude-opus-5 342 154739 2
263 agent claude-opus-5 1061 155081 2
264 agent claude-opus-5 334 156142 40
265 agent claude-opus-5 227 156476 17
266 agent claude-opus-5 1836 156703 3
267 agent claude-opus-5 3151 158539 20
268 agent claude-opus-5 1143 161690 3
269 agent claude-opus-5 805 162833 38
270 agent claude-opus-5 299 163638 40
271 agent claude-opus-5 275 163937 41
272 agent claude-opus-5 223 164212 16
273 agent claude-opus-5 1834 164435 3
274 agent claude-opus-5 811 166269 35
275 agent claude-opus-5 152 167080 40
276 agent claude-opus-5 299 167232 40
277 agent claude-opus-5 410 167531 41
278 agent claude-opus-5 223 167941 16
279 agent claude-opus-5 612 168164 2
280 agent claude-opus-5 881 168776 4
281 agent claude-opus-5 6482 169657 3
282 agent claude-opus-5 255 176139 41
283 agent claude-opus-5 276 176394 41
284 agent claude-opus-5 976 176670 3
285 agent claude-opus-5 542 177646 17
286 agent claude-opus-5 383 178188 17
287 agent claude-opus-5 271 178571 3
288 agent claude-opus-5 359 178842 20
289 agent claude-opus-5 259 179201 2
290 agent claude-opus-5 326 179460 3
291 agent claude-opus-5 2415 179786 2
292 agent claude-sonnet-5 19391 0 5
293 agent claude-sonnet-5 2379 19391 8
294 agent claude-sonnet-5 1363 21770 14
295 agent claude-sonnet-5 3662 23133 14
296 agent claude-sonnet-5 2211 26795 2
297 agent claude-sonnet-5 245 29006 20
298 agent claude-sonnet-5 3624 29251 5
299 agent claude-sonnet-5 1658 32875 20
300 agent claude-sonnet-5 2912 34533 5
301 agent claude-sonnet-5 497 37445 1
302 agent claude-sonnet-5 840 37942 4
303 agent claude-sonnet-5 3272 38782 2
304 agent claude-sonnet-5 409 42054 20
305 agent claude-sonnet-5 1179 42463 14
306 agent claude-sonnet-5 983 43642 6
307 agent claude-sonnet-5 3965 44625 7
308 agent claude-sonnet-5 2444 48590 4
309 agent claude-sonnet-5 2142 51034 5
310 agent claude-sonnet-5 8953 53176 3
311 agent claude-sonnet-5 932 62129 3
312 agent claude-sonnet-5 1700 63061 4
313 agent claude-sonnet-5 955 64761 3
314 agent claude-sonnet-5 1848 65716 3
315 agent claude-sonnet-5 446 67564 1
316 agent claude-sonnet-5 438 68010 3
317 agent claude-sonnet-5 1605 68448 14
318 agent claude-sonnet-5 387 70053 5
319 agent claude-sonnet-5 396 70440 17
320 agent claude-sonnet-5 1309 70836 4
321 agent claude-sonnet-5 860 72145 3
322 agent claude-sonnet-5 5317 73005 9
323 agent claude-sonnet-5 921 78322 3
324 agent claude-sonnet-5 678 79243 17
325 agent claude-sonnet-5 2740 79921 2
326 agent claude-sonnet-5 269 82661 4
327 agent claude-sonnet-5 725 82930 5
328 agent claude-sonnet-5 558 83655 20
329 agent claude-sonnet-5 173 84213 6
330 agent claude-sonnet-5 1047 84386 2
331 agent claude-sonnet-5 2790 85433 2
332 agent claude-sonnet-5 922 88223 2
333 agent claude-sonnet-5 1226 89145 8
334 agent claude-sonnet-5 974 90371 9
335 agent claude-sonnet-5 709 91345 20
336 agent claude-sonnet-5 803 92054 2
337 agent claude-sonnet-5 234 92857 20
338 agent claude-sonnet-5 322 93091 3
339 agent claude-sonnet-5 886 93413 4
340 agent claude-sonnet-5 1099 94299 3
341 agent claude-sonnet-5 10180 95398 3
342 agent claude-sonnet-5 4115 105578 17
343 agent claude-sonnet-5 1289 109693 6
344 agent claude-sonnet-5 463 110982 3
345 agent claude-sonnet-5 432 111445 3
346 agent claude-sonnet-5 537 111877 20
347 agent claude-sonnet-5 584 112414 3
348 agent claude-sonnet-5 351 112998 4
349 agent claude-sonnet-5 741 113349 2
350 agent claude-sonnet-5 490 114090 2
351 agent claude-sonnet-5 642 114580 20
352 agent claude-sonnet-5 1430 115222 2
353 agent claude-sonnet-5 2451 116652 3
354 agent claude-sonnet-5 1291 119103 2
355 agent claude-sonnet-5 639 120394 2
356 agent claude-sonnet-5 584 121033 2
357 agent claude-sonnet-5 1576 121617 8
358 agent claude-sonnet-5 3819 123193 17
359 agent claude-sonnet-5 804 127012 3
360 agent claude-sonnet-5 705 127816 20
361 agent claude-sonnet-5 686 128521 5
362 agent claude-sonnet-5 1360 129207 2
363 agent claude-sonnet-5 3405 130567 2
364 agent claude-sonnet-5 807 133972 2
365 agent claude-sonnet-5 1553 134779 3
366 agent claude-sonnet-5 1076 136332 3
367 agent claude-sonnet-5 1122 137408 14
368 agent claude-sonnet-5 342 138530 17
369 agent claude-sonnet-5 1922 138872 5
370 agent claude-sonnet-5 1065 140794 3
371 agent claude-sonnet-5 346 141859 20
372 agent claude-sonnet-5 506 142205 5
373 agent claude-sonnet-5 2468 142711 5
374 agent claude-sonnet-5 2329 145179 1
375 agent claude-sonnet-5 2386 147508 2
376 agent claude-sonnet-5 1210 149894 2
377 agent claude-sonnet-5 432 151104 20
378 agent claude-sonnet-5 292 151536 2
379 agent claude-sonnet-5 368 151828 1
380 agent claude-sonnet-5 461 152196 2
381 agent claude-opus-5 12871 0 1
382 agent claude-opus-5 1311 12871 2
383 agent claude-opus-5 428 14182 2
384 agent claude-opus-5 216 14610 3
385 agent claude-opus-5 277 14826 3
386 agent claude-opus-5 572 15103 2
387 agent claude-opus-5 12666 15675 3
388 agent claude-opus-5 8075 28341 8
389 agent claude-opus-5 2000 36416 17
390 agent claude-opus-5 4325 38416 2
391 agent claude-opus-5 7351 42741 3
392 agent claude-opus-5 789 50092 17
393 agent claude-opus-5 987 50881 5
394 agent claude-opus-5 1883 51868 4
395 agent claude-opus-5 3620 53751 3
396 agent claude-opus-5 4004 57371 3
397 agent claude-opus-5 5281 61375 9
398 agent claude-opus-5 2036 66656 3
399 agent claude-haiku-4-5-20251001 5196 6937 1
400 agent claude-haiku-4-5-20251001 1529 12133 2
401 agent claude-haiku-4-5-20251001 1266 13662 2
402 agent claude-haiku-4-5-20251001 337 14928 3
403 agent claude-sonnet-5 19545 0 100
404 agent claude-sonnet-5 2379 19545 2
405 agent claude-sonnet-5 449 21924 20
406 agent claude-sonnet-5 217 22373 20
407 agent claude-sonnet-5 7561 22590 4
408 agent claude-sonnet-5 171 30151 20
409 agent claude-sonnet-5 3860 30322 5
410 agent claude-sonnet-5 6846 34182 4
411 agent claude-sonnet-5 232 41028 20
412 agent claude-sonnet-5 11999 41260 5
413 agent claude-sonnet-5 2295 53259 3
414 agent claude-sonnet-5 1271 55554 14
415 agent claude-sonnet-5 3066 56825 14
416 agent claude-sonnet-5 2330 59891 3
417 agent claude-sonnet-5 3704 62221 7
418 agent claude-sonnet-5 6737 65925 4
419 agent claude-sonnet-5 3422 72662 3
420 agent claude-sonnet-5 561 76084 20
421 agent claude-sonnet-5 506 76645 21
422 agent claude-sonnet-5 1101 77151 3
423 agent claude-sonnet-5 633 78252 20
424 agent claude-sonnet-5 2427 78885 8
425 agent claude-sonnet-5 5734 81312 7
426 agent claude-sonnet-5 2368 87046 2
427 agent claude-sonnet-5 1545 89414 20
428 agent claude-sonnet-5 287 90959 2
429 agent claude-sonnet-5 1468 91246 10
430 agent claude-sonnet-5 1374 92714 3
431 agent claude-sonnet-5 629 94088 2
432 agent claude-sonnet-5 1156 94717 5
433 agent claude-sonnet-5 5215 95873 6
434 agent claude-sonnet-5 5385 101088 2
435 agent claude-sonnet-5 5791 106473 6
436 agent claude-sonnet-5 882 112264 3
437 agent claude-sonnet-5 2909 113146 3
438 agent claude-sonnet-5 368 116055 3
439 agent claude-sonnet-5 2073 116423 3
440 agent claude-sonnet-5 765 118496 20
441 agent claude-sonnet-5 1790 119261 8
442 agent claude-sonnet-5 300 121051 20
443 agent claude-sonnet-5 1102 121351 2
444 agent claude-sonnet-5 2352 122453 3
445 agent claude-sonnet-5 1507 124805 2
446 agent claude-sonnet-5 851 126312 2
447 agent claude-sonnet-5 1328 127163 2
448 agent claude-sonnet-5 1742 128491 6
449 agent claude-sonnet-5 986 130233 3
450 agent claude-sonnet-5 856 131219 594
451 agent claude-sonnet-5 691 132075 2
452 agent claude-sonnet-5 1052 132766 3
453 agent claude-sonnet-5 317 133818 4
454 agent claude-sonnet-5 369 134135 20
455 agent claude-sonnet-5 374 134504 4
456 agent claude-sonnet-5 2475 134878 5
457 agent claude-sonnet-5 511 137353 4
458 agent claude-sonnet-5 283 137864 9
459 agent claude-sonnet-5 196 138147 1
460 agent claude-sonnet-5 681 138343 7
461 agent claude-sonnet-5 259 139024 2
462 agent claude-sonnet-5 3037 139283 2
463 agent claude-sonnet-5 874 142320 2
464 agent claude-sonnet-5 999 143194 6
465 agent claude-sonnet-5 541 144193 17
466 agent claude-sonnet-5 328 144734 9
467 agent claude-sonnet-5 1038 145062 3
468 agent claude-sonnet-5 1243 146100 3
469 agent claude-sonnet-5 817 147343 2
470 agent claude-sonnet-5 341 148160 21
471 agent claude-sonnet-5 1159 148501 6
472 agent claude-sonnet-5 722 149660 8
473 agent claude-sonnet-5 1268 150382 2
474 agent claude-sonnet-5 1545 151650 5
475 agent claude-sonnet-5 233 153195 2
476 agent claude-sonnet-5 586 153428 20
477 agent claude-sonnet-5 148 154014 4
478 agent claude-sonnet-5 354 154162 2
479 agent claude-sonnet-5 1847 154516 5
480 agent claude-sonnet-5 1564 156363 3
481 agent claude-sonnet-5 1444 157927 2
482 agent claude-sonnet-5 12261 159371 2
483 agent claude-sonnet-5 418 171632 20
484 agent claude-sonnet-5 231 172050 20
485 agent claude-sonnet-5 1034 172281 3
486 agent claude-sonnet-5 4261 173315 14
487 agent claude-sonnet-5 504 177576 5
488 agent claude-sonnet-5 711 178080 17
489 agent claude-sonnet-5 1325 178791 3
490 agent claude-sonnet-5 322 180116 20
491 agent claude-sonnet-5 582 180438 4
492 agent claude-sonnet-5 1999 181020 1
493 agent claude-sonnet-5 208 183019 7
494 agent claude-sonnet-5 2863 183227 20
495 agent claude-sonnet-5 317 186090 20
496 agent claude-sonnet-5 498 186407 6
497 agent claude-sonnet-5 2810 186905 20
498 agent claude-sonnet-5 1108 189715 3
499 agent claude-sonnet-5 573 190823 21
500 agent claude-sonnet-5 1487 191396 7
501 agent claude-sonnet-5 615 192883 8
502 agent claude-sonnet-5 2566 193498 2
503 agent claude-sonnet-5 2092 196064 3
504 agent claude-sonnet-5 2021 198156 2
505 agent claude-sonnet-5 447 200177 9
506 agent claude-sonnet-5 640 200624 3
507 agent claude-sonnet-5 352 201264 2
508 agent claude-sonnet-5 976 201616 1
509 agent claude-sonnet-5 20196 0 4
510 agent claude-sonnet-5 2381 20196 4
511 agent claude-sonnet-5 294 22577 20
512 agent claude-sonnet-5 3646 22871 2
513 agent claude-sonnet-5 227 26517 20
514 agent claude-sonnet-5 280 26744 20
515 agent claude-sonnet-5 3204 27024 2
516 agent claude-sonnet-5 280 30228 20
517 agent claude-sonnet-5 2339 30508 2
518 agent claude-sonnet-5 1194 32847 20
519 agent claude-sonnet-5 363 34041 20
520 agent claude-sonnet-5 637 34404 7
521 agent claude-sonnet-5 4539 35041 6
522 agent claude-sonnet-5 458 39580 20
523 agent claude-sonnet-5 252 40038 20
524 agent claude-sonnet-5 2280 40290 3
525 agent claude-sonnet-5 435 42570 20
526 agent claude-sonnet-5 343 43005 5
527 agent claude-sonnet-5 1533 43348 20
528 agent claude-sonnet-5 735 44881 2
529 agent claude-sonnet-5 453 45616 20
530 agent claude-sonnet-5 357 46069 16
531 agent claude-sonnet-5 425 46426 2
532 agent claude-sonnet-5 218 46851 16
533 agent claude-sonnet-5 740 47069 3
534 agent claude-sonnet-5 1137 47809 3
535 agent claude-sonnet-5 2495 48946 2
536 agent claude-sonnet-5 4397 51441 5
537 agent claude-sonnet-5 7784 55838 6
538 agent claude-sonnet-5 1959 63622 4
539 agent claude-sonnet-5 1231 65581 3
540 agent claude-sonnet-5 896 66812 3
541 agent claude-sonnet-5 1881 67708 3
542 agent claude-sonnet-5 967 69589 2
543 agent claude-sonnet-5 1203 70556 2
544 agent claude-sonnet-5 504 71759 20
545 agent claude-sonnet-5 1062 72263 8
546 agent claude-sonnet-5 2359 73325 17
547 agent claude-sonnet-5 722 75684 8
548 agent claude-sonnet-5 213 76406 2
549 agent claude-sonnet-5 710 76619 20
550 agent claude-sonnet-5 1881 77329 2
551 agent claude-sonnet-5 1945 79210 2
552 agent claude-sonnet-5 1416 81155 4
553 agent claude-sonnet-5 496 82571 4
554 agent claude-sonnet-5 837 83067 1
555 agent claude-sonnet-5 4001 83904 3
556 agent claude-sonnet-5 7459 87905 6
557 agent claude-sonnet-5 6187 95364 3
558 agent claude-sonnet-5 1996 101551 1
559 agent claude-sonnet-5 625 103547 4
560 agent claude-sonnet-5 598 104172 2
561 agent claude-sonnet-5 583 104770 2
562 agent claude-sonnet-5 7736 105353 7
563 agent claude-sonnet-5 1518 113089 14
564 agent claude-sonnet-5 479 114607 17
565 agent claude-sonnet-5 1369 115086 3
566 agent claude-sonnet-5 1028 116455 3
567 agent claude-sonnet-5 1055 117483 20
568 agent claude-sonnet-5 1518 118538 3
569 agent claude-sonnet-5 1261 120056 2
570 agent claude-sonnet-5 402 121317 2
571 agent claude-sonnet-5 508 121719 3
572 agent claude-sonnet-5 938 122227 2
573 agent claude-sonnet-5 610 123165 17
574 agent claude-sonnet-5 806 123775 4
575 agent claude-sonnet-5 564 124581 17
576 agent claude-sonnet-5 776 125145 2
577 agent claude-sonnet-5 825 125921 2
578 agent claude-sonnet-5 511 126746 3
579 agent claude-sonnet-5 971 127257 6
580 agent claude-sonnet-5 2411 128228 1
581 agent claude-sonnet-5 1486 130639 3
582 agent claude-sonnet-5 643 132125 20
583 agent claude-sonnet-5 259 132768 20
584 agent claude-sonnet-5 187 133027 5
585 agent claude-sonnet-5 1196 133214 5
586 agent claude-sonnet-5 1429 134410 2
587 agent claude-sonnet-5 2695 135839 1
588 agent claude-sonnet-5 448 138534 2
589 agent claude-sonnet-5 261 138982 20
590 agent claude-sonnet-5 221 139243 2
591 agent claude-sonnet-5 861 139464 3
592 agent claude-sonnet-5 395 140325 20
593 agent claude-sonnet-5 390 140720 2
594 agent claude-sonnet-5 1715 141110 5
595 agent claude-sonnet-5 432 142825 9
596 agent claude-sonnet-5 683 143257 2
597 agent claude-sonnet-5 199 143940 2
598 agent claude-sonnet-5 1069 144139 2
599 agent claude-sonnet-5 202 145208 5
600 agent claude-haiku-4-5-20251001 12831 0 1
601 agent claude-haiku-4-5-20251001 1593 12831 262
602 agent claude-haiku-4-5-20251001 776 14424 4
603 agent claude-haiku-4-5-20251001 1393 15200 3
604 agent claude-haiku-4-5-20251001 463 16593 2
605 agent claude-haiku-4-5-20251001 12783 0 1
606 agent claude-haiku-4-5-20251001 1652 12783 2
607 agent claude-haiku-4-5-20251001 580 14435 1
608 agent claude-haiku-4-5-20251001 618 15015 1
609 agent claude-haiku-4-5-20251001 12973 0 1
610 agent claude-haiku-4-5-20251001 1695 12973 2
611 agent claude-haiku-4-5-20251001 952 14668 1
612 agent claude-haiku-4-5-20251001 708 15620 2
613 agent claude-haiku-4-5-20251001 2327 16328 3
614 agent claude-haiku-4-5-20251001 411 18655 4
615 agent claude-haiku-4-5-20251001 12726 0 1
616 agent claude-haiku-4-5-20251001 1975 12726 1
617 agent claude-haiku-4-5-20251001 882 14701 2
618 agent claude-haiku-4-5-20251001 3460 15583 2
619 agent claude-haiku-4-5-20251001 1059 19043 3
620 agent claude-haiku-4-5-20251001 313 20102 4
621 agent claude-opus-5 13116 0 252
622 agent claude-opus-5 2047 13116 2
623 agent claude-opus-5 1557 15163 5
624 agent claude-opus-5 1237 16720 147
625 agent claude-opus-5 7111 17957 3
626 agent claude-opus-5 1916 25068 17
627 agent claude-opus-5 4859 26984 3
628 agent claude-opus-5 1909 31843 17
629 agent claude-opus-5 1981 33752 3
630 agent claude-opus-5 2498 35733 3
631 agent claude-opus-5 6306 38231 315
632 agent claude-opus-5 613 44537 2
633 agent claude-opus-5 1205 45150 5
634 agent claude-opus-5 1521 46355 3
635 agent claude-opus-5 2200 47876 2
636 agent claude-opus-5 991 50076 20
637 agent claude-opus-5 304 51067 20
638 agent claude-opus-5 1014 51371 3
639 agent claude-opus-5 3092 52385 570
640 agent claude-opus-5 870 55477 20
641 agent claude-opus-5 1757 56347 3
642 agent claude-opus-5 930 58104 20
643 agent claude-opus-5 607 59034 2
644 agent claude-opus-5 1558 59641 20
645 agent claude-opus-5 749 61199 2
646 agent claude-opus-5 1013 61948 20
647 agent claude-opus-5 510 62961 3
648 agent claude-opus-5 2170 63471 17
649 agent claude-opus-5 531 65641 2
650 agent claude-opus-5 1502 66172 2
651 agent claude-opus-5 1959 67674 3
652 agent claude-opus-5 884 69633 219
653 agent claude-opus-5 495 70517 3
654 agent claude-haiku-4-5-20251001 12725 0 1
655 agent claude-haiku-4-5-20251001 1372 12725 2
656 agent claude-haiku-4-5-20251001 941 14097 2
657 agent claude-haiku-4-5-20251001 304 15038 2
658 agent claude-haiku-4-5-20251001 1083 15342 2
659 agent claude-haiku-4-5-20251001 291 16425 3
660 agent claude-haiku-4-5-20251001 12729 0 1
661 agent claude-haiku-4-5-20251001 2400 12729 2
662 agent claude-haiku-4-5-20251001 1943 15129 2
663 agent claude-haiku-4-5-20251001 1182 17072 4
664 agent claude-haiku-4-5-20251001 386 18254 4
-->
<!-- /cout -->
