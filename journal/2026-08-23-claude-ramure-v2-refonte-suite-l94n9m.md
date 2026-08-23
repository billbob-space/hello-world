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
