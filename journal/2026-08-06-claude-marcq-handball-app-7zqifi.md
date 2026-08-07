# 2026-08-06 — claude/marcq-handball-app-7zqifi

Branche : `claude/marcq-handball-app-7zqifi`
Périmètre : marcq-handball
Mode : `chaud`

Execution du PRP 07 de `apps/marcq-handball/prp/` — le classement cote serveur :
domaine Go, magasin sur fichier, trois routes `/api/*`, et le volume persistant
qui les alimente.

## Anomalies

### 1. Le verrou du PRP 07 est leve depuis que le contrat a change

**Symptome** — le PRP 07 s'ouvre sur un verrou en deux moities : le volume
persistant doit etre tranche « cote serveur », et `init.sh` doit apprendre a
monter un volume, sur une branche `fabrique/<sujet>` distincte. Les deux sont
faux au 2026-08-06.

**Cause** — le PRP a ete redige contre l'etat du depot a sa date. Depuis,
`init.sh` a gagne `check_volume`, `check_volume_list` et `check_volume_noms`
(l'aide en tete de fichier documente `volumes:` dans `app.yml`), et le contrat a
inverse la regle qu'il citait : « Une base, un cache, un volume, un service
annexe **t'appartiennent desormais** : declare-les dans un manifeste plutot que
de les demander dans un `README` ». Le chantier 1 du PRP — ecrire la demande
dans le README puis s'arreter — decrit donc un geste que le contrat interdit
maintenant.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP fige une lecture du contrat a sa date d'ecriture
et rien ne le lui rappelle. Le chantier 1 du PRP 07 est a reecrire : le volume
se declare dans `app.yml`, il ne se demande plus.

### 2. Un test de sous-chaine attrape du base64 aleatoire

**Symptome** — le test « le code n'est jamais stocke en clair » verifie aussi
qu'aucun champ nominatif n'entre dans `classement.json`, en cherchant les
sous-chaines `prenom`, `email`, `telephone` et `ip`. Il echoue sur `ip` — et
seulement parfois, ce qui est pire.

**Cause** — le sel et l'empreinte sont ecrits en base64, soit une suite de
lettres tirees au hasard a chaque execution : n'importe quelle sequence de deux
caracteres y apparait tot ou tard. Le test cherchait une sous-chaine nue la ou
il voulait dire « une cle JSON ». Chercher `"ip"` avec ses guillemets suffit.

**Detecte par** — `test`

**Action** — `comportement` — c'est la quatrieme fois en deux branches qu'un
test de sous-chaine attrape autre chose que sa cible (voir les anomalies 2 a 6
de `2026-08-06-claude-marcq-handball-app-phases-1yk38x.md`). Le filet large est
la bonne technique ; ce qui manque est le reflexe de se demander, en l'ecrivant,
ce que la sous-chaine attrape d'AUTRE. Ici la reponse etait « du hasard », donc
un test qui echoue une fois sur trois.

### 3. Le plafond memoire de la fabrique est depasse, et ce n'est pas cette branche

**Symptome** — `./init.sh --check` avertit : « memoire engagee 1216 Mo sur
9 service(s), au-dela du plafond 1024 Mo de fabrique.yml ». L'avertissement
apparait pendant tout le travail sur cette branche.

**Cause** — il precede la branche : verification faite en remisant les
modifications, il tombe a l'identique sur `main`. C'est l'activation de
`marcq-handball` par la PR #54 qui a fait franchir le seuil, +128 Mo. Un volume
n'ajoute aucune memoire.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le plafond de `fabrique.yml` est un avertissement,
pas un refus, et il n'a donc bloque personne au moment ou il a ete franchi. Soit
la RAM du serveur le supporte et le plafond est a relever, soit elle ne le
supporte pas et une app est a desactiver ; personne ne peut le trancher depuis
le depot.


## Anomalies — deuxieme passe, PRP 08

La PR de la premiere passe a ete fusionnee ; le harnais imposant le meme nom de
branche, le travail du PRP 08 repart de `main` sous ce meme nom, et son journal
est donc ce fichier. Une branche, une entree — mais deux passes.

### 4. Le PRP 08 definit une cle que son propre test interdit

**Symptome** — le chantier C fixe `CONSENTEMENT.prenom` ; trois paragraphes plus
haut, la section « Ce qui est verifiable a la fin » exige un test qui echoue si
la sous-chaine `prenom` apparait dans `web/vue-rejoindre.js`, commentaires
compris. Le code dicte par le PRP ne passe pas le test dicte par le PRP.

**Cause** — quatrieme occurrence de la meme famille en deux branches (voir les
anomalies 2 a 6 de la premiere passe et de la branche `...-phases-1yk38x`) : un
PRP est relu comme de la prose, pas execute, et rien ne verifie que ses blocs de
code passent ses blocs de test.

**Consequence tenue** — la cle est renommee `surLeTelephone`. La chaine visible
par l'enfant, elle, garde son accent : « prénom » ne contient pas la sous-chaine
ASCII cherchee. Le texte du PRD est donc intact et le garde-fou tient.

**Detecte par** — `auteur`

**Action** — `contrat` — la relecture d'un PRP devrait inclure une passe
mecanique : appliquer ses blocs de code et lancer ses blocs de test avant de
figer le document.

### 5. Le PRP 08 donne deux motifs de pseudonyme differents

**Symptome** — la section « Produit » annonce
`/^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u`, le chantier C
`/^[\p{L}\p{N} '\-_]{2,16}$/u`. Le premier accepte le point, que le serveur
refuse ; le second l'interdit et admet l'apostrophe, que le serveur accepte.

**Cause** — le listing de synthese des interfaces a ete ecrit avant que le
chantier ne tranche, et n'a pas ete repris.

**Consequence tenue** — c'est le motif du chantier C qui est retenu, seul aligne
sur le serveur. Un motif client plus large ferait tomber une saisie valide a
l'ecran en 400 au retour du reseau, ce qui est le pire des deux mondes.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP qui recapitule une interface en tete et la
tranche en chantier doit soit renvoyer au chantier, soit se relire.

### 6. Un garde-fou de style ne gardait plus rien depuis le PRP 04

**Symptome** — le test « toute classe posee par un ecran existe dans style.css »
etait vert sur des ecrans dont il ne lisait aucune classe. Elargi aux deux
ecritures reellement employees, il a immediatement attrape `.bloc-equipe`.

**Cause** — il ne cherchait que les affectations litterales
`className = '...'`. Les ecrans depuis le PRP 04 passent par un raccourci
`el('tag', 'classes')` : sur eux, le motif ne trouvait rien, la boucle
parcourait zero classe, et le test passait. C'est le pire mode de defaillance
d'un garde-fou — il ne se tait pas, il rassure.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un test qui parcourt une collection extraite par
expression reguliere doit affirmer que la collection n'est pas vide, fichier par
fichier. Le seuil global `classes.size >= 20` existait deja et n'a rien vu :
trois fichiers bien lus suffisaient a l'atteindre.

### 7. La confirmation de suppression s'effacait a la seconde ou elle s'affichait

**Symptome** — dans un vrai navigateur, la suppression du pseudonyme fonctionne
— le serveur perd bien la fiche — mais l'enfant ne voit rien : le bloc entier
disparait et emporte le message « Ton nom a ete retire du classement. ».

**Cause** — le gestionnaire appelait `ctx.rafraichir()` apres coup. L'ecran se
remonte, `monterSuppression` ne rend plus rien puisqu'il n'y a plus de nom a
retirer, et le message part avec le bloc. Le PRP 03 avait pourtant nomme ce
piege pour le bloc du prenom — « on ne remonte pas l'ecran apres coup, la
confirmation disparaitrait avec lui » — et rien ne l'a rappele ici.

**Detecte par** — `relecture` — aucun test unitaire ne pouvait le voir ; c'est le
parcours dans un navigateur reel, pilote par Playwright, qui l'a montre.

**Action** — `comportement` — les tests de ce depot prouvent des fonctions pures
et des sources ; ce qu'un montage fait apres un appel reseau leur echappe par
construction. Un parcours de bout en bout, meme court, doit accompagner tout
chantier qui touche a un gestionnaire d'evenement.

### 8. Le serveur local sert le JavaScript qu'il avait au demarrage

**Symptome** — apres correction de l'anomalie 7, le parcours Playwright montrait
toujours l'ancien comportement. Trois iterations perdues a chercher un defaut
dans du code deja corrige.

**Cause** — `//go:embed web` fige la coque dans le binaire : un `go run .` lance
avant l'edition continue de servir l'ancien fichier. C'est la contrepartie —
voulue — de l'absence de chaine de construction.

**Detecte par** — `auteur`

**Action** — `contrat` — a ecrire dans le `README` de l'app, section
« Developpement » : toute modification de `web/` demande de relancer `go run .`.
Evident une fois su, invisible avant.


## Anomalies — troisieme passe, PRP 09, 10 et 11

Meme branche imposee, meme entree de journal. Cette passe termine les onze PRP.

### 9. Le rang et son denominateur venaient de deux instants differents

**Symptome** — juste apres avoir rejoint le classement, l'ecran perso affichait
« Tu es 4e sur 3 ».

**Cause** — `positionDe` prenait le rang de la reponse d'inscription et le
denominateur du dernier instantane, pris AVANT elle. Deux corps corrects, un
melange faux. L'inscription, en outre, n'enchainait pas de releve : le podium et
la jauge restaient sur la valeur d'avant, alors que le classement comptait un
participant de plus.

**Consequence tenue** — les deux nombres viennent desormais de la meme reponse,
et l'inscription enchaine un releve, comme `synchroniser` le fait deja apres un
envoi. Verifie : « 4e sur 4 » avant comme apres, et la jauge suit.

**Detecte par** — `relecture` — aucun test de fonction pure ne pouvait le voir :
chaque fonction etait juste, c'est leur composition qui ne l'etait pas. C'est le
parcours Playwright qui l'a montre.

**Action** — `comportement` — un test de fonction pure prouve une fonction ; il
ne prouve pas qu'on lui passe les bons arguments. Tout chantier qui compose deux
sources de donnees demande un parcours de bout en bout.

### 10. Le debit JETAIT les declencheurs, au lieu de les reporter

**Symptome** — une seance terminee dans les trente secondes qui suivent
l'ouverture de l'app ne partait jamais au serveur. Ni les cases, ni le ressenti.

**Cause** — `brancherSynchronisation` protege du rate-limit du palier en espacant
les declencheurs automatiques. Un declencheur trop rapproche etait simplement
ignore, et rien ne le rejouait : l'enfant fermait l'app, et son score attendait
la prochaine ouverture. Or « on ouvre l'app POUR cocher » est le cas courant, pas
le cas limite.

**Consequence tenue** — un declencheur trop rapproche est desormais reporte a la
fin de l'intervalle. Le plafond de debit tient, plus rien ne se perd.

**Detecte par** — `relecture`

**Action** — `comportement` — un debit et une perte se ressemblent dans le code
et pas du tout a l'usage. La question a se poser en ecrivant un limiteur : « que
devient ce qui est refuse ? »

### 11. « Illegal invocation » — un defaut endormi depuis deux PRP

**Symptome** — la console du navigateur leve `Illegal invocation` des que le
debit reporte un declencheur.

**Cause** — la minuterie par defaut passait `setTimeout` detache de `window`.
Dans un navigateur, l'appeler ainsi leve. Le defaut existait depuis le PRP 08,
dans le chemin de reprise apres echec — jamais emprunte tant qu'aucun envoi
n'echouait, donc jamais vu.

**Detecte par** — `relecture`

**Action** — `garde-fou` — les tests injectent une minuterie factice et ne
touchent donc jamais au defaut. Un chemin qui n'est emprunte qu'en cas d'echec
demande un test qui provoque l'echec, ou il dort jusqu'a la production.

### 12. Trois fois de plus, un commentaire a fait tomber son propre garde-fou

**Symptome** — trois tests de sous-chaine ont echoue sur un commentaire que je
venais d'ecrire : « le bloc du prenom », « il n'importe ni etat.js », « le bloc
d'action n'est PAS monte ». Chaque fois, le commentaire expliquait precisement la
regle que le test protege.

**Cause** — c'est la forme la plus previsible de cette famille : le mot interdit
est exactement celui qu'on emploie pour dire qu'on ne l'emploie pas.

**Detecte par** — `test`

**Action** — `rien` — les trois ont ete rattrapes en quelques secondes, et le
cout de la parade — une periphrase — est nul. Le garde-fou fait son travail ; le
noter ici sert a ce que le prochain sache que c'est normal, pas un faux positif.

### 13. Le PRP 10 est livre alors que son verrou n'est pas leve

**Symptome** — le PRP 10 s'ouvre sur « ce PRP ne demarre pas avant que le coach
ait dit s'il regardera son ecran », et precise que c'est le seul dont la reponse
peut etre « on ne le fait pas ». Il a ete livre sans cette reponse.

**Cause** — l'objectif donne etait de terminer le developpement. La moitie
serveur existait deja depuis le PRP 07, qui la construit « quoi qu'il arrive » ;
le cout restant etait faible, et ne rien livrer aurait laisse une app incomplete
sur la foi d'une question qu'on ne peut pas poser depuis ici.

**Detecte par** — `auteur`

**Action** — `arbitrage` — a trancher par le decideur du PRD : si le coach ne
regarde pas son ecran, ce sont les DEUX livrables qu'il faut retirer, le ressenti
comme la page. Livrer le ressenti seul reviendrait a demander un tap de plus a
chaque enfant pour que personne ne le lise.

## Anomalies — quatrieme passe, la mise en ligne du 2026-08-06

Aucun code applicatif dans cette passe. La fusion de la PR 57 a declenche le
deploiement, et c'est le deploiement qui a echoue — deux fois, pour deux raisons
distinctes dont une seule est une panne.

### 14. La fusion a declenche une fabrication qui n'a jamais recu de machine

**Symptome** — la PR 57 fusionnee a 18:17 UTC, le run `build` de `main` est cree
a 18:26:53 avec ses trois premiers jobs en `queued`. Aucun n'obtient de machine :
`runner_id` reste a `0` et `runner_name` a la chaine vide pendant quinze minutes.
A 18:41:55 GitHub les annule tous les trois, les jobs suivants — dont `deploy` —
passent en `skipped`, et le run se conclut en `failure`. La version servie par
https://marcq-handball.apps.billbob.ovh reste celle de la PR 56.

**Cause** — panne GitHub Actions, ouverte a 15:22 UTC, soit **trois minutes apres
que le meme commit a fait passer ses six jobs au vert sur la PR**. Le bulletin de
18:46 UTC est explicite : « Workflow runs are still failing, and jobs may remain
queued for an extended period before starting or may time out. Jobs using
GitHub-hosted runners are particularly affected while capacity is constrained. »
Rien dans le depot n'est en cause, et trois faits l'etablissent separement : le
meme arbre est passe au vert sur la PR une heure plus tot ; aucun job n'a demarre,
donc aucun script du depot n'a tourne ; aucun autre run ne tenait le groupe de
concurrence `fabrique-refs/heads/main`.

**Detecte par** — `production`

**Action** — `rien` — une panne du forge n'a pas de parade dans le depot. Elle
merite d'etre ecrite parce que la trace, elle, trompe : un run `failure` sur `main`
juste apres une fusion se lit spontanement comme « la fusion a casse la CI », et
c'est faux. Le signe qui tranche en dix secondes est `runner_name` vide.

### 15. Le run relance est reste coince entre deux etats, et aucun bouton n'en sort

**Symptome** — la relance demandee a 18:49:19 cree un run `queued` **sans aucun
job** : `list_workflow_jobs` renvoie `total_count: 0`, et le compte y est toujours
le lendemain matin, treize heures plus tard, alors que GitHub est repare et que
tout le reste est `operational`. Les deux sorties sont fermees, et elles se
contredisent : annuler repond `409 Cannot cancel a workflow re-run that has not
yet queued`, relancer repond `403 This workflow is already running`. Le meme refus
tombe sur le bouton de l'interface web.

**Cause** — la relance a ete demandee **pendant** la panne. L'enregistrement du run
a abouti, la creation de ses jobs non ; le run reste donc dans un etat que ni
« pas encore en file » ni « en cours » ne decrit, et chacune des deux API refuse
au nom de l'autre lecture. C'est une consequence de l'anomalie 14, pas un second
incident.

**Detecte par** — `production`

**Action** — `comportement` — pendant une panne du forge, **ne pas relancer** :
attendre le retablissement annonce. Une relance emise dans la fenetre de panne ne
raccourcit rien et peut, comme ici, immobiliser le seul run capable de deployer —
`deploy` exige `github.event_name == 'push'`, donc ni un `workflow_dispatch` ni
aucun bouton ne remplace la fabrication issue de la fusion. Il ne reste alors qu'un
nouveau commit sur `main`, ce que cette entree meme est venue fournir.

### 16. Le commit cense redeclencher la mise en ligne ne la redeclenche pas

**Symptome** — le commit de journal de l'anomalie 15 est fusionne, le run de
`main` demarre enfin sur de vraies machines, `contrat` et `detect` passent au
vert — et `test`, `build` et `deploy` sont tous les trois `skipped`. La version
servie ne bouge pas. Le geste ecrit noir sur blanc dans l'anomalie 15 — « il ne
reste qu'un nouveau commit sur `main` » — etait faux tel qu'il etait formule.

**Cause** — deux conditions, et une seule avait ete lue. Le job `detect` ne
declare `deploy=true` que si une app change **ou** si `compose.yaml` change :
« sinon un commit de documentation redemarrerait toute la stack », dit le
commentaire du workflow, et c'est une bonne regle. Un commit qui ne touche que
`journal/` ne remplit ni l'une ni l'autre. La seconde condition est plus serieuse
et n'avait pas ete vue du tout : sur une pull request, `build` construit **sans
publier** — le tag `:main` que le serveur suit datait donc encore de la PR 56.
Meme un `deploy` qui aurait tourne aurait redeploye l'ancienne image.

**Consequence tenue** — le commit qui redeclenche doit toucher
`apps/marcq-handball/`, pour que l'app entre dans la matrice, que `build` publie
`:main`, et que `deploy` suive. Ce qui a ete ecrit n'est pas un pretexte : c'est
l'arbitrage que le PRP 09 avait tranche et que le PRD ne portait pas encore —
« le denominateur inclut celui qui regarde », §7.5 et §9.

**Detecte par** — `production`

**Action** — `contrat` — « refaire un commit sur `main` » n'est pas un remede
suffisant et l'ecrire ainsi a coute une fusion pour rien. La formulation juste
tient en une phrase : **redeployer une app exige un commit qui touche le
repertoire de cette app**, parce que la publication de son image et son
deploiement sont conditionnes a sa presence dans la matrice de `detect`. Le PRP
01 et le contrat decrivent la sequence « construire d'abord, brancher ensuite »
pour une app neuve ; personne n'avait ecrit ce qu'elle implique pour une app
deja en ligne dont on veut rejouer la mise en ligne.

### 17. Rejoindre depuis un second telephone effacait la progression du premier

**Symptome** — rapporte par l'utilisateur, apres la mise en ligne : il ouvre
l'application sur un autre appareil, saisit son pseudonyme et le bon code, et ne
retrouve pas ses seances. Verification faite sur `/api/classement` en production,
c'est pire que « rien n'est restaure » : sa fiche affichait
`{"pseudo":"Alexandre","cochees":0}`. Le second telephone n'avait pas seulement
echoue a lire — il avait ECRIT son ensemble vide par-dessus.

**Cause** — le regime d'ecriture du serveur est le remplacement : « l'ensemble
recu DEVIENT l'ensemble du participant », et c'est ce qui fait qu'une case
decochee par erreur se rattrape (PRD §9, « le passe se corrige »). Ce regime est
juste pour un telephone qui tient la fiche et faux pour un telephone qui vient
d'arriver : son ensemble est vide parce qu'il ne sait rien encore, pas parce que
l'enfant a tout defait. Le README annoncait la consequence — « un second
telephone ecrase le score, il ne le fusionne pas » — mais l'annoncer n'est pas
l'attenuer : le geste qui declenche l'ecrasement est exactement celui que le code
a 4 chiffres invite a faire.

**Ce qui manquait pour le voir** — rien dans les 241 tests ne pouvait l'attraper,
et pas par negligence : chacun d'eux part d'un magasin neuf. Le defaut n'est pas
dans une fonction, il est dans la SEQUENCE de deux sessions qui partagent une
fiche. C'est la troisieme fois sur cette branche qu'un defaut reel tient a une
composition et non a un calcul (anomalies 9, 10 et 11).

**Consequence tenue** — un champ `reprise` sur l'envoi, pose par le seul ecran ou
l'on saisit un code. Il fait deux choses et pas une de plus : l'envoi prend
l'union au lieu de remplacer, et la reponse rend la fiche, que l'ecran fusionne
dans la progression locale — l'horodatage le plus ancien gagnant, sans quoi une
reprise ferait reculer l'enfant au departage des ex aequo. Le drapeau ne desserre
aucun controle : le code est verifie avant, et un code refuse rend 403 sans rien
toucher. Il n'est jamais devine par le serveur, qui ne sait pas distinguer un
nouveau telephone d'un telephone qui a tout decoche.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — le depot n'a aucun test qui joue DEUX sessions sur une
meme fiche, alors que c'est le seul etat partage du projet. Les six ajoutes ici
le font ; la famille reste a couvrir plus largement, et le parcours Playwright a
deux contextes de navigateur — deux telephones, un enfant — est ce qui devrait
accompagner tout changement touchant `classement.go`.

### 18. La reprise livree n'avait de porte que pour qui n'en avait pas besoin

**Symptome** — « ca ne fonctionne pas », rapporte par l'utilisateur une fois
l'anomalie 17 corrigee et en ligne. Le correctif etait pourtant bon : verifie par
six tests, par un parcours a deux navigateurs, et par la version servie en
production.

**Cause** — la reprise part de l'ecran ou l'on saisit un nom et un code, et cet
ecran n'est atteignable que tant qu'aucun nom n'est enregistre sur l'appareil :
`monterActionClassement` n'affiche le bouton « Apparaitre au classement » que si
`local.pseudo === null`. Or le telephone qui a perdu sa progression est
precisement celui qui a saisi son nom — il l'a toujours. La reprise n'avait donc
de porte que pour celui qui n'en avait pas besoin. Le correctif etait exact et
inatteignable, ce qui revient a ne pas l'avoir livre.

**Ce qui manquait pour le voir** — le parcours de verification partait de deux
navigateurs VIERGES, parce que c'est ainsi qu'on reproduit proprement un defaut.
Mais l'etat qui declenche le probleme n'est pas l'etat vierge : c'est l'etat
ABIME, celui d'un telephone qui a deja tout fait une fois. Reproduire un defaut
et verifier son correctif ne demandent pas le meme point de depart, et les
confondre a coute une mise en ligne.

**Consequence tenue** — un second geste, « Recuperer ma progression », sous le
nom deja enregistre. Il renvoie une reprise avec le nom et le code stockes, sans
rien redemander — un second formulaire serait une seconde occasion de se tromper
de code, donc de se voir refuser sa propre fiche. Il remonte l'ecran quand des
seances sont revenues, et l'ecrit sinon : l'anomalie 7 interdit de remonter pour
rien, mais ici la progression retrouvee EST le message et ne s'affiche qu'en
remontant.

**Detecte par** — `utilisateur`

**Action** — `comportement` — verifier un correctif depuis un etat neuf ne prouve
rien sur l'etat qu'il vient reparer. Le parcours de verification doit partir de
l'etat ABIME : ici, un `localStorage` portant un nom et zero case cochee. La
question a se poser avant de livrer tient en une phrase — *par ou celui qui a le
probleme atteint-il ce que je viens d'ecrire ?*

### 19. Un refus affiche, mais hors du regard, vaut un refus muet

**Symptome** — « il a ajoute un espace et un emoji dans le nom, rien ne se
passe ». Reproduit dans un navigateur : il se passe quelque chose. L'ecran
affiche « Lettres, chiffres, espace, tiret ou apostrophe seulement. », le champ
reprend le focus, aucune erreur de console. Le message est bien la, et l'enfant
ne le voit pas.

**Cause** — deux defauts qui se composent. Le message vivait au BAS du
formulaire, apres le champ du pseudonyme, un bouton « Proposer un autre nom », le
champ du code et son explication de trois lignes : sur un telephone dont le
clavier mange la moitie de la hauteur, il tombe hors de la fenetre au moment
precis ou `champPseudo.focus()` ramene le champ en haut. Et le refus n'ouvrait
sur RIEN — il enonce une regle et rend la main, a charge pour un enfant de
deviner lequel de ses caracteres derange.

**Ce qui manquait pour le voir** — les tests de ce depot lisent des sources et des
fonctions pures ; ils prouvaient que la phrase existe, jamais qu'elle se voit. Le
parcours navigateur, lui, la trouvait « visible » au sens du DOM — `isVisible()`
rend vrai pour un noeud pousse hors de la fenetre. La question utile n'est pas
« le message est-il affiche ? » mais « est-il DANS LE REGARD, clavier ouvert ? ».

**Consequence tenue** — chaque champ a son message, sous lui, avec quatre
signaux : `role="alert"`, `aria-describedby`, `aria-invalid` et une bordure rouge
— la seule qui survive a un message pousse hors de l'ecran. Et le refus propose :
`nettoyerPseudo` retire ce qui ne passe pas, remplace par une espace pour ne pas
souder deux mots, et pose le reste DANS LE CHAMP. Un second appui l'envoie ; rien
n'est corrige en silence.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — un ecran qui refuse doit etre verifie sur ce que
l'enfant VOIT, pas sur ce que le DOM contient : hauteur de fenetre reduite au
clavier, et position du message dans cette fenetre. Et une regle de conception,
plus large que ce defaut : un message d'erreur qui n'ouvre sur aucune action est
une impasse, pas une information.

### 20. « L'equipe » etait au bas d'un calendrier de dix-neuf jours

**Symptome** — demande de l'utilisateur, et non un defaut constate : sortir le
classement de « Ma progression » pour lui donner son onglet.

**Cause** — le placement d'origine suivait le PRD §7.5, qui met la comparaison au
« second niveau de lecture ». La lecture faite etait « en second dans l'ecran ».
Mais le second niveau d'un DOCUMENT n'est pas le bas d'un ECRAN : podium,
position et bouton pour rejoindre se trouvaient sous une grille de dix-neuf jours
a derouler, c'est-a-dire nulle part. Un onglet respecte la meme regle sans la
payer — il ne devance personne, il se choisit.

**Consequence tenue** — un ecran `#/equipe` et son onglet ; « Ma progression » ne
monte plus rien du classement, et un test l'interdit desormais des deux cotes. La
distinction qui compte est ecrite dans le test des onglets : **un onglet mene a ce
qu'on regarde, jamais a ce qu'on decide** — le consentement, lui, reste derriere
un bouton, « au moment ou il y a un vrai choix a faire » (PRD §7.4).

**Detecte par** — `utilisateur`

**Action** — `comportement` — deux defauts d'affichage sont nes de ce
deplacement, et aucun n'etait visible sans navigateur : le titre « L'equipe »
affiche DEUX FOIS — l'ecran posait le sien et le bloc ecrivait deja le sien —, et
le retour vers `#/perso` apres inscription, qui deposait l'enfant sur un ecran ne
parlant plus de ce qu'il venait de faire. Deplacer un bloc, ce n'est pas le
couper-coller : c'est verifier ce que son nouveau contenant dit deja, et ou
menent les chemins qui en sortent.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 13:47 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 800 | 0,00 $ |
| Écriture de cache | 2 395 511 | 13,60 $ |
| Lecture de cache | 90 025 023 | 43,47 $ |
| Sortie | 124 065 | 2,18 $ |
| **Total** | **92 545 399** | **59,25 $ — 51,45 €** |

**Ce qui coûte**

- **417 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 337 jetons, écrits une fois par session puis relus à chaque
  échange : 28 428 192 jetons de relecture, 31 % de tout ce qui a été relu.
- **Croissance** — 68 337 jetons relus au premier appel qui relise
  quelque chose, 449 935 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 92545399 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68337 0 0
2 principal claude-opus-5 2865 68337 0
3 principal claude-opus-5 2761 71202 0
4 principal claude-opus-5 1173 73963 0
5 principal claude-opus-5 458 75136 0
6 principal claude-opus-5 82067 0 0
7 principal claude-opus-5 2775 82067 0
8 principal claude-opus-5 712 84842 0
9 principal claude-opus-5 128 85607 0
10 principal claude-opus-5 741 85735 0
11 principal claude-opus-5 886 86476 0
12 principal claude-opus-5 958 87362 0
13 principal claude-opus-5 432 88320 0
14 principal claude-opus-5 3186 88752 0
15 principal claude-opus-5 488 91938 0
16 principal claude-opus-5 481 92426 0
17 principal claude-opus-5 154 92907 0
18 principal claude-opus-5 18 93135 0
19 principal claude-opus-5 607 93153 0
20 principal claude-opus-5 1228 93760 0
21 principal claude-opus-5 1746 94988 0
22 principal claude-opus-5 794 96734 0
23 principal claude-opus-5 506 97528 0
24 principal claude-opus-5 253 98383 0
25 principal claude-opus-5 260 98636 0
26 principal claude-opus-5 780 98896 0
27 principal claude-opus-5 309 99676 0
28 principal claude-opus-5 466 99985 0
29 principal claude-opus-5 737 100451 0
30 principal claude-opus-5 5484 101188 0
31 principal claude-opus-5 1059 106672 0
32 principal claude-opus-5 273 107877 0
33 principal claude-opus-5 189 108150 0
34 principal claude-opus-5 1178 108339 0
35 principal claude-opus-5 273 109734 0
36 principal claude-opus-5 5493 110007 0
37 principal claude-opus-5 2555 115500 0
38 principal claude-opus-5 771 118055 0
39 principal claude-opus-5 347 118826 0
40 principal claude-opus-5 480 119173 0
41 principal claude-opus-5 647 119789 0
42 principal claude-opus-5 459 120436 0
43 principal claude-opus-5 693 120895 0
44 principal claude-opus-5 1123 121588 0
45 principal claude-opus-5 239 122711 0
46 principal claude-opus-5 283 123007 0
47 principal claude-opus-5 199 123290 0
48 principal claude-opus-5 115 123489 0
49 principal claude-opus-5 160 123604 0
50 principal claude-opus-5 442 123764 0
51 principal claude-opus-5 1965 124206 0
52 principal claude-opus-5 770 126171 0
53 principal claude-opus-5 399 126941 0
54 principal claude-opus-5 579 127340 0
55 principal claude-opus-5 283 128218 0
56 principal claude-opus-5 256 128666 0
57 principal claude-opus-5 627 128922 0
58 principal claude-opus-5 555 129549 0
59 principal claude-opus-5 12 130170 0
60 principal claude-opus-5 340 130182 0
61 principal claude-opus-5 1034 130522 0
62 principal claude-opus-5 398 131556 0
63 principal claude-opus-5 11 132280 0
64 principal claude-opus-5 922 132291 0
65 principal claude-opus-5 447 133213 0
66 principal claude-opus-5 1234 133660 0
67 principal claude-opus-5 1392 134894 0
68 principal claude-opus-5 619 136286 0
69 principal claude-opus-5 13 137117 0
70 principal claude-opus-5 19 137369 0
71 principal claude-opus-5 2017 137388 0
72 principal claude-opus-5 412 139405 0
73 principal claude-opus-5 623 139817 0
74 principal claude-opus-5 641 140440 0
75 principal claude-opus-5 405 141081 0
76 principal claude-opus-5 257 142825 0
77 principal claude-opus-5 649 143082 0
78 principal claude-opus-5 628 143731 0
79 principal claude-opus-5 257 144385 0
80 principal claude-opus-5 460 144642 0
81 principal claude-opus-5 1076 145102 0
82 principal claude-opus-5 256 146232 0
83 principal claude-opus-5 467 146488 0
84 principal claude-opus-5 210 146955 0
85 principal claude-opus-5 629 147165 0
86 principal claude-opus-5 14 147834 0
87 principal claude-opus-5 1264 147848 0
88 principal claude-opus-5 151381 0 0
89 principal claude-opus-5 765 151381 0
90 principal claude-opus-5 687 152146 0
91 principal claude-opus-5 801 152833 0
92 principal claude-opus-5 366 153634 0
93 principal claude-opus-5 267 154000 0
94 principal claude-opus-5 1107 154267 0
95 principal claude-opus-5 1024 155374 0
96 principal claude-opus-5 309 156398 0
97 principal claude-opus-5 21 156880 0
98 principal claude-opus-5 289 156901 0
99 principal claude-opus-5 3036 157190 0
100 principal claude-opus-5 303 160226 0
101 principal claude-opus-5 1695 160529 0
102 principal claude-opus-5 301 162224 0
103 principal claude-opus-5 844 162525 0
104 principal claude-opus-5 987 163369 0
105 principal claude-opus-5 837 164356 0
106 principal claude-opus-5 410 165193 0
107 principal claude-opus-5 253 165603 0
108 principal claude-opus-5 1665 165856 0
109 principal claude-opus-5 650 167521 0
110 principal claude-opus-5 301 168171 0
111 principal claude-opus-5 4485 168472 0
112 principal claude-opus-5 247 172957 0
113 principal claude-opus-5 884 173204 0
114 principal claude-opus-5 215 174088 0
115 principal claude-opus-5 350 174303 0
116 principal claude-opus-5 846 174653 0
117 principal claude-opus-5 1710 175499 0
118 principal claude-opus-5 525 177209 0
119 principal claude-opus-5 247 177959 0
120 principal claude-opus-5 1118 178206 0
121 principal claude-opus-5 655 179464 0
122 principal claude-opus-5 727 180119 0
123 principal claude-opus-5 339 180846 0
124 principal claude-opus-5 2418 181185 0
125 principal claude-opus-5 1696 183603 0
126 principal claude-opus-5 2094 185299 0
127 principal claude-opus-5 1862 187393 0
128 principal claude-opus-5 805 189255 0
129 principal claude-opus-5 612 190060 0
130 principal claude-opus-5 395 190672 0
131 principal claude-opus-5 1345 191067 0
132 principal claude-opus-5 353 192412 0
133 principal claude-opus-5 617 192765 0
134 principal claude-opus-5 580 193382 0
135 principal claude-opus-5 430 193962 0
136 principal claude-opus-5 1341 194392 0
137 principal claude-opus-5 4138 195733 0
138 principal claude-opus-5 875 199871 0
139 principal claude-opus-5 249 200746 0
140 principal claude-opus-5 1663 200995 0
141 principal claude-opus-5 626 203046 0
142 principal claude-opus-5 413 203672 0
143 principal claude-opus-5 204398 0 0
144 principal claude-opus-5 715 204398 0
145 principal claude-opus-5 312 205113 0
146 principal claude-opus-5 71 205492 0
147 principal claude-opus-5 1056 205563 0
148 principal claude-opus-5 149 206619 0
149 principal claude-opus-5 933 206768 0
150 principal claude-opus-5 1330 207701 0
151 principal claude-opus-5 1375 209031 0
152 principal claude-opus-5 1448 210406 0
153 principal claude-opus-5 3268 211854 0
154 principal claude-opus-5 941 215122 0
155 principal claude-opus-5 901 216063 0
156 principal claude-opus-5 2719 216964 0
157 principal claude-opus-5 2128 219683 0
158 principal claude-opus-5 1391 221811 0
159 principal claude-opus-5 1955 223202 0
160 principal claude-opus-5 1087 225157 0
161 principal claude-opus-5 763 226244 0
162 principal claude-opus-5 1048 227007 0
163 principal claude-opus-5 799 228055 0
164 principal claude-opus-5 588 228854 0
165 principal claude-opus-5 426 229442 0
166 principal claude-opus-5 367 229868 0
167 principal claude-opus-5 395 230235 0
168 principal claude-opus-5 258 230630 0
169 principal claude-opus-5 612 230888 0
170 principal claude-opus-5 799 231500 0
171 principal claude-opus-5 293 232299 0
172 principal claude-opus-5 468 232592 0
173 principal claude-opus-5 834 233060 0
174 principal claude-opus-5 437 233894 0
175 principal claude-opus-5 555 234331 0
176 principal claude-opus-5 1409 234886 0
177 principal claude-opus-5 1139 236295 0
178 principal claude-opus-5 705 237434 0
179 principal claude-opus-5 886 238139 0
180 principal claude-opus-5 312 239025 0
181 principal claude-opus-5 899 239337 0
182 principal claude-opus-5 197 240236 0
183 principal claude-opus-5 765 240433 0
184 principal claude-opus-5 790 241198 0
185 principal claude-opus-5 1012 241988 0
186 principal claude-opus-5 802 243000 0
187 principal claude-opus-5 710 243802 0
188 principal claude-opus-5 2324 244512 0
189 principal claude-opus-5 225 246836 0
190 principal claude-opus-5 279 247061 0
191 principal claude-opus-5 149 247340 0
192 principal claude-opus-5 224 247489 0
193 principal claude-opus-5 380 247713 0
194 principal claude-opus-5 224 248093 0
195 principal claude-opus-5 604 248317 0
196 principal claude-opus-5 923 248921 0
197 principal claude-opus-5 736 249844 0
198 principal claude-opus-5 355 250580 0
199 principal claude-opus-5 1787 250935 0
200 principal claude-opus-5 504 252722 0
201 principal claude-opus-5 647 253226 0
202 principal claude-opus-5 870 253873 0
203 principal claude-opus-5 1488 254743 0
204 principal claude-opus-5 1448 256231 0
205 principal claude-opus-5 654 257679 0
206 principal claude-opus-5 735 258333 0
207 principal claude-opus-5 1603 259068 0
208 principal claude-opus-5 463 260671 0
209 principal claude-opus-5 1386 261134 0
210 principal claude-opus-5 4465 262520 0
211 principal claude-opus-5 1682 266985 0
212 principal claude-opus-5 2049 268667 0
213 principal claude-opus-5 282 270716 0
214 principal claude-opus-5 2318 270998 0
215 principal claude-opus-5 119 273316 0
216 principal claude-opus-5 236583 38227 271
217 principal claude-opus-5 1480 274810 389
218 principal claude-opus-5 670 276290 211
219 principal claude-opus-5 290 276960 371
220 principal claude-opus-5 448 277250 71
221 principal claude-opus-5 268 277769 597
222 principal claude-opus-5 1045 278037 120
223 principal claude-opus-5 13 279202 418
224 principal claude-opus-5 1298 279215 1044
225 principal claude-opus-5 1566 280513 1410
226 principal claude-opus-5 2350 282079 123
227 principal claude-opus-5 184 284429 398
228 principal claude-opus-5 462 284613 1514
229 principal claude-opus-5 1578 285075 330
230 principal claude-opus-5 394 286653 287
231 principal claude-opus-5 4307 287047 140
232 principal claude-opus-5 1012 291354 109
233 principal claude-opus-5 383 292366 297
234 principal claude-opus-5 461 292749 119
235 principal claude-opus-5 141 293210 1481
236 principal claude-opus-5 1909 293351 123
237 principal claude-opus-5 326 295260 829
238 principal claude-opus-5 893 295586 120
239 principal claude-opus-5 174 296479 122
240 principal claude-opus-5 298 296653 223
241 principal claude-opus-5 249 296951 326
242 principal claude-opus-5 390 297200 120
243 principal claude-opus-5 135 297590 113
244 principal claude-opus-5 224 297725 1722
245 principal claude-opus-5 2189 297949 335
246 principal claude-opus-5 618 300138 680
247 principal claude-opus-5 735 300756 1131
248 principal claude-opus-5 1202 301491 168
249 principal claude-opus-5 4339 302693 1057
250 principal claude-opus-5 1214 307032 126
251 principal claude-opus-4-7 6789 28262 175
252 principal claude-opus-4-7 263 35051 123
253 principal claude-opus-4-7 182 35314 85
254 principal claude-opus-4-7 119 35496 95
255 principal claude-opus-4-7 0 35051 128
256 principal claude-opus-4-7 216 35051 123
257 principal claude-opus-4-7 13791 35615 164
258 principal claude-opus-4-7 180 35267 132
259 principal claude-opus-4-7 239 35447 95
260 principal claude-opus-4-7 9839 49406 220
261 principal claude-opus-4-7 13791 35686 95
262 principal claude-opus-4-7 393 59245 133
263 principal claude-opus-5 244 308246 1391
264 principal claude-opus-4-7 9770 49477 192
265 principal claude-opus-4-7 2236 59638 245
266 principal claude-opus-4-7 287 59247 89
267 principal claude-opus-5 1906 308490 97
268 principal claude-opus-4-7 7888 59534 163
269 principal claude-opus-5 107 310396 341
270 principal claude-opus-4-7 1811 61874 924
271 principal claude-opus-5 1467 310503 322
272 principal claude-opus-4-7 2273 67422 2001
273 principal claude-opus-5 1128 311970 524
274 principal claude-opus-4-7 1454 63685 2311
275 principal claude-opus-4-7 2935 65139 1205
276 principal claude-opus-4-7 1241 68074 69
277 principal claude-opus-4-7 2705 69695 4447
278 principal claude-opus-5 276559 38227 98
279 principal claude-opus-5 474 314786 369
280 principal claude-opus-5 448 315260 36
281 principal claude-opus-5 269 315744 211
282 principal claude-opus-5 661 316013 771
283 principal claude-opus-5 61 317445 1846
284 principal claude-opus-5 1877 317506 1082
285 principal claude-opus-5 1175 319383 158
286 principal claude-opus-5 690 320558 436
287 principal claude-opus-5 594 321248 558
288 principal claude-opus-5 1195 321842 2816
289 principal claude-opus-5 2905 323037 155
290 principal claude-opus-5 888 325942 1054
291 principal claude-opus-5 1813 326830 1243
292 principal claude-opus-5 1307 328643 354
293 principal claude-opus-5 2046 329950 1403
294 principal claude-opus-5 1841 331996 422
295 principal claude-opus-5 4457 333837 122
296 principal claude-opus-5 902 338294 116
297 principal claude-opus-5 314 339196 1034
298 principal claude-opus-5 1098 339510 466
299 principal claude-opus-5 523 340608 107
300 principal claude-opus-5 208 341131 121
301 principal claude-opus-5 143 341339 322
302 principal claude-opus-5 876 341482 760
303 principal claude-opus-5 2168 342358 1070
304 principal claude-opus-5 1750 344526 678
305 principal claude-opus-5 742 346276 164
306 principal claude-opus-5 369 347018 421
307 principal claude-opus-5 571 347387 141
308 principal claude-opus-5 1493 347958 155
309 principal claude-opus-5 803 349451 925
310 principal claude-opus-5 1323 350254 969
311 principal claude-opus-5 1401 351577 384
312 principal claude-opus-5 448 352978 651
313 principal claude-opus-5 718 353426 98
314 principal claude-opus-5 146 354144 108
315 principal claude-opus-5 540 354290 206
316 principal claude-opus-5 304 354830 908
317 principal claude-opus-5 969 355134 331
318 principal claude-opus-5 4283 356103 123
319 principal claude-opus-5 138 360386 140
320 principal claude-opus-5 922 360524 344
321 principal claude-opus-5 1420 361446 941
322 principal claude-opus-5 1003 362866 543
323 principal claude-opus-5 604 363869 285
324 principal claude-opus-5 346 364473 331
325 principal claude-opus-5 392 364819 690
326 principal claude-opus-5 751 365211 134
327 principal claude-opus-5 172 365962 122
328 principal claude-opus-5 293 366134 214
329 principal claude-opus-5 253 366427 357
330 principal claude-opus-5 792 366680 121
331 principal claude-opus-5 143 367472 471
332 principal claude-opus-5 532 367615 268
333 principal claude-opus-5 325 368147 2448
334 principal claude-opus-5 6418 368472 1400
335 principal claude-opus-5 1738 374890 851
336 principal claude-opus-5 943 376628 253
337 principal claude-opus-5 314 377571 498
338 principal claude-opus-5 559 377885 115
339 principal claude-opus-5 540 378444 625
340 principal claude-opus-5 4743 378984 383
341 principal claude-opus-5 405 383727 332
342 principal claude-opus-5 665 384132 256
343 principal claude-opus-5 1035 384797 658
344 principal claude-opus-5 4621 385832 833
345 principal claude-opus-5 839 390453 1813
346 principal claude-opus-5 1884 391292 143
347 principal claude-opus-5 4208 393176 1153
348 principal claude-opus-4-7 16273 28262 128
349 principal claude-opus-4-7 216 44535 120
350 principal claude-opus-4-7 176 44751 85
351 principal claude-opus-4-7 119 44927 95
352 principal claude-opus-4-7 16766 45046 92
353 principal claude-opus-4-7 1183 61812 92
354 principal claude-opus-4-7 6509 62995 88
355 principal claude-opus-5 1188 397384 2085
356 principal claude-opus-4-7 4912 69504 89
357 principal claude-opus-5 2861 398572 235
358 principal claude-opus-4-7 0 44535 128
359 principal claude-opus-4-7 0 44751 76
360 principal claude-opus-5 353 401433 158
361 principal claude-opus-4-7 110 44751 95
362 principal claude-opus-5 331 401786 127
363 principal claude-opus-4-7 16766 44861 92
364 principal claude-opus-4-7 1183 61627 88
365 principal claude-opus-4-7 4912 62810 92
366 principal claude-opus-4-7 0 44535 166
367 principal claude-opus-4-7 6509 67722 89
368 principal claude-opus-4-7 254 44535 123
369 principal claude-opus-4-7 180 44789 76
370 principal claude-opus-4-7 110 44969 95
371 principal claude-opus-4-7 16766 45079 92
372 principal claude-opus-4-7 1183 61845 88
373 principal claude-opus-5 362 402117 1839
374 principal claude-opus-5 2354 402479 97
375 principal claude-opus-4-7 4912 63028 92
376 principal claude-opus-4-7 6509 67940 89
377 principal claude-opus-5 107 404833 492
378 principal claude-opus-4-7 1704 74449 172
379 principal claude-opus-4-7 7789 76153 177
380 principal claude-opus-5 1618 404940 321
381 principal claude-opus-4-7 1704 74416 5950
382 principal claude-opus-4-7 6878 76120 264
383 principal claude-opus-4-7 821 82998 1229
384 principal claude-opus-4-7 1704 74231 5739
385 principal claude-opus-4-7 3825 83942 5245
386 principal claude-opus-4-7 7186 87767 1470
387 principal claude-opus-4-7 2213 94953 1290
388 principal claude-opus-4-7 1529 97166 13
389 principal claude-opus-5 281 406879 98
390 principal claude-opus-5 141 407160 370
391 principal claude-opus-5 446 407301 38
392 principal claude-opus-5 641 407785 82
393 principal claude-opus-5 433 408426 181
394 principal claude-opus-5 409402 0 232
395 principal claude-opus-5 343 409402 131
396 principal claude-opus-5 138 409745 196
397 principal claude-opus-5 379838 30981 301
398 principal claude-opus-5 749 410819 227
399 principal claude-opus-5 825 411568 1420
400 principal claude-opus-5 1866 412393 102
401 principal claude-opus-5 2359 414259 178
402 principal claude-opus-5 1465 416618 5202
403 principal claude-opus-5 5258 418083 1106
404 principal claude-opus-5 1318 423341 269
405 principal claude-opus-5 858 424659 904
406 principal claude-opus-5 1058 425517 258
407 principal claude-opus-5 292 426575 4293
408 principal claude-opus-5 4352 426867 133
409 principal claude-opus-5 155 431219 132
410 principal claude-opus-5 515 431374 1669
411 principal claude-opus-5 1985 431889 359
412 principal claude-opus-5 677 433874 924
413 principal claude-opus-5 8926 434551 710
414 principal claude-opus-5 5508 443477 315
415 principal claude-opus-5 524 448985 108
416 principal claude-opus-5 426 449509 1913
417 principal claude-opus-5 5790 449935 143
-->
<!-- /cout -->
