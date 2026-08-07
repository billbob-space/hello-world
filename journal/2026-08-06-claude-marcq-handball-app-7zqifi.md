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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 08:05 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 979 | 0,00 $ |
| Écriture de cache | 3 198 824 | 16,23 $ |
| Lecture de cache | 133 375 528 | 63,72 $ |
| Sortie | 424 827 | 8,35 $ |
| **Total** | **137 000 158** | **88,30 $ — 76,68 €** |

**Ce qui coûte**

- **516 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 704 jetons, écrits une fois par session puis relus à chaque
  échange : 28 172 560 jetons de relecture, 21 % de tout ce qui a été relu.
- **Croissance** — 54 704 jetons relus au premier appel qui relise
  quelque chose, 194 392 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 137000158 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54704 0 374
2 principal claude-opus-5 1047 54704 178
3 principal claude-opus-5 2487 55751 183
4 principal claude-opus-5 19032 58238 659
5 principal claude-opus-5 2185 77270 379
6 principal claude-opus-5 22097 79455 847
7 principal claude-opus-5 10222 101552 560
8 principal claude-opus-5 8684 111774 2195
9 principal claude-opus-5 9816 120458 139
10 principal claude-opus-5 4469 130274 345
11 principal claude-opus-5 6265 134743 348
12 principal claude-opus-5 3085 141008 124
13 principal claude-opus-5 1361 144093 758
14 principal claude-opus-5 829 145454 861
15 principal claude-opus-5 1095 146283 389
16 principal claude-opus-5 953 147378 5591
17 principal claude-opus-5 5645 148331 705
18 principal claude-opus-5 786 153976 4252
19 principal claude-opus-5 4631 154762 502
20 principal claude-opus-5 581 159393 118
21 principal claude-opus-5 280 159974 129
22 principal claude-opus-5 153 160254 234
23 principal claude-opus-5 4990 160407 1117
24 principal claude-opus-5 1147 165397 149
25 principal claude-opus-4-7 40398 0 126
26 principal claude-opus-4-7 205 40398 86
27 principal claude-opus-4-7 3562 40603 144
28 principal claude-opus-4-7 1019 44165 333
29 principal claude-opus-4-7 1436 45184 260
30 principal claude-opus-4-7 332 46620 197
31 principal claude-opus-5 229 166544 3765
32 principal claude-opus-4-7 3111 46952 2008
33 principal claude-opus-4-7 2061 50063 1507
34 principal claude-opus-4-7 1543 52124 69
35 principal claude-opus-5 3820 166773 11303
36 principal claude-opus-5 11356 170593 5206
37 principal claude-opus-5 5653 181949 758
38 principal claude-opus-5 1144 187602 578
39 principal claude-opus-5 710 188746 684
40 principal claude-opus-5 848 189456 99
41 principal claude-opus-5 116 190304 116
42 principal claude-opus-5 471 190420 233
43 principal claude-opus-5 290 190891 124
44 principal claude-opus-5 503 191181 598
45 principal claude-opus-5 4202 191684 11586
46 principal claude-opus-5 11631 195886 125
47 principal claude-opus-5 4874 207517 761
48 principal claude-opus-5 819 212391 233
49 principal claude-opus-5 4581 213210 10107
50 principal claude-opus-5 10161 217791 592
51 principal claude-opus-5 5002 227952 463
52 principal claude-opus-5 1023 232954 2348
53 principal claude-opus-5 2380 233977 221
54 principal claude-opus-5 338 236357 1091
55 principal claude-opus-5 1114 236695 567
56 principal claude-opus-5 623 237809 771
57 principal claude-opus-5 829 238432 96
58 principal claude-opus-5 863 239261 259
59 principal claude-opus-5 1734 240124 271
60 principal claude-opus-5 4129 241858 3594
61 principal claude-opus-4-7 43442 27342 9068
62 principal claude-opus-4-7 11393 70784 166
63 principal claude-opus-5 3649 245987 1125
64 principal claude-opus-4-7 1231 82177 427
65 principal claude-opus-5 1180 249636 458
66 principal claude-opus-5 513 250816 141
67 principal claude-opus-5 792 251329 320
68 principal claude-opus-5 490 252121 202
69 principal claude-opus-5 1147 252611 1710
70 principal claude-opus-4-7 4660 27342 196
71 principal claude-opus-4-7 3349 32002 113
72 principal claude-opus-5 1815 253758 2238
73 principal claude-opus-4-7 2872 35351 1857
74 principal claude-opus-5 2301 255573 632
75 principal claude-opus-4-7 2323 38223 256
76 principal claude-opus-4-7 928 40546 71
77 principal claude-opus-5 695 257874 492
78 principal claude-opus-4-7 2159 41474 168
79 principal claude-opus-4-7 1951 43633 614
80 principal claude-opus-5 550 258569 873
81 principal claude-opus-5 931 259119 128
82 principal claude-opus-5 329 260050 699
83 principal claude-opus-4-7 1455 45584 2853
84 principal claude-opus-5 739 260379 95
85 principal claude-opus-5 3607 261118 1416
86 principal claude-opus-5 1487 264725 270
87 principal claude-opus-5 469 266212 104
88 principal claude-opus-5 272 266681 75
89 principal claude-opus-5 88 266953 941
90 principal claude-opus-5 8 267982 334
91 principal claude-opus-5 2120 267990 172
92 principal claude-opus-5 683 270110 269
93 principal claude-opus-5 327 270793 252
94 principal claude-opus-5 687 271120 291
95 principal claude-opus-5 3204 271807 594
96 principal claude-opus-5 710 275011 103
97 principal claude-opus-5 344 275824 108
98 principal claude-opus-5 386 276168 343
99 principal claude-opus-5 888 276554 561
100 principal claude-opus-5 922 277442 1032
101 principal claude-opus-5 1336 278364 671
102 principal claude-opus-5 8278 280371 459
103 principal claude-opus-5 4759 288649 231
104 principal claude-opus-5 10085 293408 110
105 principal claude-opus-5 12059 303493 227
106 principal claude-opus-5 3098 315552 208
107 principal claude-opus-5 586 318650 228
108 principal claude-opus-5 6986 319236 396
109 principal claude-opus-5 2825 326222 357
110 principal claude-opus-5 1751 329047 95
111 principal claude-opus-5 967 330798 1229
112 principal claude-opus-5 1886 331765 187
113 principal claude-opus-5 439 333651 1370
114 principal claude-opus-5 1652 334090 322
115 principal claude-opus-5 380 335742 1290
116 principal claude-opus-5 1348 336122 93
117 principal claude-opus-5 133 337470 115
118 principal claude-opus-5 1241 337603 1307
119 principal claude-opus-5 1375 338844 124
120 principal claude-opus-5 408 340219 924
121 principal claude-opus-4-7 6043 27342 120
122 principal claude-opus-4-7 202 33385 89
123 principal claude-opus-4-7 4337 33587 92
124 principal claude-opus-4-7 4922 37924 2818
125 principal claude-opus-4-7 2944 42846 1296
126 principal claude-opus-5 960 340627 10926
127 principal claude-opus-5 10981 341587 1717
128 principal claude-opus-5 2149 352568 488
129 principal claude-opus-5 646 354717 7184
130 principal claude-opus-5 7242 355363 164
131 principal claude-opus-5 180 362605 1123
132 principal claude-opus-5 1184 362785 135
133 principal claude-opus-5 185 363969 1850
134 principal claude-opus-5 2033 364154 149
135 principal claude-opus-4-7 16831 27342 148
136 principal claude-opus-4-7 6467 44173 2135
137 principal claude-opus-4-7 6383 50640 1205
138 principal claude-opus-4-7 1332 57023 197
139 principal claude-opus-4-7 304 58355 151
140 principal claude-opus-5 229 366187 8141
141 principal claude-opus-5 8202 366416 985
142 principal claude-opus-5 1159 374618 543
143 principal claude-opus-4-7 190 58659 4950
144 principal claude-opus-5 607 375777 3972
145 principal claude-opus-5 4029 376384 154
146 principal claude-opus-5 178 380413 161
147 principal claude-opus-5 539 380591 350
148 principal claude-opus-5 789 381130 96
149 principal claude-opus-5 1259 381919 298
150 principal claude-opus-5 1711 383178 115
151 principal claude-opus-5 172 384889 848
152 principal claude-opus-5 864 385061 252
153 principal claude-opus-5 313 385925 114
154 principal claude-opus-5 164 386238 1861
155 principal claude-opus-5 1894 386402 149
156 principal claude-opus-4-7 14290 27342 1526
157 principal claude-opus-5 229 388296 1392
158 principal claude-opus-4-7 1771 41632 85
159 principal claude-opus-4-7 6976 43403 121
160 principal claude-opus-5 1429 388525 136
161 principal claude-opus-4-7 6435 50379 79
162 principal claude-opus-5 585 389954 292
163 principal claude-opus-5 356 390539 1641
164 principal claude-opus-5 1705 390895 531
165 principal claude-opus-4-7 4327 56814 2094
166 principal claude-opus-4-7 2231 61141 188
167 principal claude-opus-4-7 1030 63372 121
168 principal claude-opus-5 595 392600 270
169 principal claude-opus-5 334 393195 1081
170 principal claude-opus-5 1145 393529 720
171 principal claude-opus-5 781 394674 823
172 principal claude-opus-4-7 1382 64402 3765
173 principal claude-opus-5 9563 395455 2057
174 principal claude-opus-4-7 4222 65784 1295
175 principal claude-opus-5 6844 405018 744
176 principal claude-opus-5 791 411862 700
177 principal claude-opus-5 716 412653 1958
178 principal claude-opus-5 5983 413369 890
179 principal claude-opus-5 952 419352 123
180 principal claude-opus-5 611 420304 211
181 principal claude-opus-5 310 420915 1458
182 principal claude-opus-5 1501 421225 149
183 principal claude-opus-4-7 12086 27342 126
184 principal claude-opus-4-7 214 39428 122
185 principal claude-opus-4-7 179 39642 85
186 principal claude-opus-4-7 119 39821 95
187 principal claude-opus-4-7 9719 39940 134
188 principal claude-opus-4-7 3881 49659 89
189 principal claude-opus-4-7 1633 53540 92
190 principal claude-opus-4-7 6407 55173 147
191 principal claude-opus-4-7 6461 61580 89
192 principal claude-opus-5 229 422726 2215
193 principal claude-opus-4-7 4337 68041 650
194 principal claude-opus-4-7 1246 72378 211
195 principal claude-opus-5 6194 422955 884
196 principal claude-opus-5 4085 429149 1821
197 principal claude-opus-5 1871 433234 390
198 principal claude-opus-4-7 1128 73624 3943
199 principal claude-opus-4-7 3979 74752 69
200 principal claude-opus-5 445 435105 1405
201 principal claude-opus-5 1460 435550 136
202 principal claude-opus-5 235 437010 1384
203 principal claude-opus-4-7 8102 27342 142
204 principal claude-opus-4-7 230 35444 110
205 principal claude-opus-4-7 176 35674 79
206 principal claude-opus-5 1420 437245 627
207 principal claude-opus-4-7 505 35850 95
208 principal claude-opus-4-7 11403 36355 93
209 principal claude-opus-4-7 3111 47758 89
210 principal claude-opus-4-7 6403 50869 139
211 principal claude-opus-5 794 438665 186
212 principal claude-opus-4-7 1271 57272 132
213 principal claude-opus-5 1969 439459 74
214 principal claude-opus-5 143 441428 126
215 principal claude-opus-5 0 441737 195
216 principal claude-opus-5 350 441737 1282
217 principal claude-opus-5 1479 442087 123
218 principal claude-opus-5 193 443566 220
219 principal claude-opus-5 573 443759 848
220 principal claude-opus-5 912 444332 166
221 principal claude-opus-5 339 445244 591
222 principal claude-opus-5 946 445583 1851
223 principal claude-opus-4-7 4380 58543 9128
224 principal claude-opus-4-7 9554 62923 69
225 principal claude-opus-5 3119 446529 466
226 principal claude-opus-5 483 449648 153
227 principal claude-opus-5 161 450131 113
228 principal claude-opus-5 131 450292 206
229 principal claude-opus-5 230 450423 412
230 principal claude-opus-5 453 450653 340
231 principal claude-opus-5 422046 37125 178
232 principal claude-opus-5 9723 451106 294
233 principal claude-opus-5 632 460829 170
234 principal claude-opus-5 1335 461461 1511
235 principal claude-opus-5 1703 462796 809
236 principal claude-opus-5 1388 464499 713
237 principal claude-opus-5 987 465887 2905
238 principal claude-opus-5 6773 466874 964
239 principal claude-opus-5 9613 473647 275
240 principal claude-opus-5 308 483260 200
241 principal claude-opus-5 264 483568 211
242 principal claude-opus-5 347 483832 1236
243 principal claude-opus-5 1449 484179 112
244 principal claude-opus-4-7 4122 27342 194
245 principal claude-opus-4-7 383 31464 168
246 principal claude-opus-5 215 485628 195
247 principal claude-opus-5 298 485843 240
248 principal claude-opus-4-7 16479 31847 825
249 principal claude-opus-4-7 1706 48326 133
250 principal claude-opus-5 792 486141 213
251 principal claude-opus-4-7 0 31464 126
252 principal claude-opus-4-7 214 31464 95
253 principal claude-opus-4-7 11521 31678 121
254 principal claude-opus-5 485 486933 884
255 principal claude-opus-4-7 4969 43199 1154
256 principal claude-opus-4-7 2607 50032 1845
257 principal claude-opus-4-7 2018 48168 133
258 principal claude-opus-4-7 1686 50186 736
259 principal claude-opus-4-7 1707 51872 93
260 principal claude-opus-4-7 3111 53579 1728
261 principal claude-opus-4-7 5020 56690 881
262 principal claude-opus-4-7 917 61710 69
263 principal claude-opus-5 4 488302 132
264 principal claude-opus-5 489 488306 86
265 principal claude-opus-5 480 488795 1830
266 principal claude-opus-5 2272 489275 213
267 principal claude-opus-5 12620 491547 430
268 principal claude-opus-5 546 504167 185
269 principal claude-opus-5 340 504898 165
270 principal claude-opus-5 5314 505238 380
271 principal claude-opus-5 815 510552 149
272 principal claude-opus-5 482573 37125 254
273 principal claude-opus-5 10073 511516 419
274 principal claude-opus-5 867 521589 77
275 principal claude-opus-5 347 522533 202
276 principal claude-opus-5 335 522880 1031
277 principal claude-opus-5 1220 523215 144
278 principal claude-opus-5 367 524435 696
279 principal claude-opus-5 857 524802 511
280 principal claude-opus-5 1097 525659 506
281 principal claude-opus-5 8552 527262 128
282 principal claude-opus-5 155 535814 349
283 principal claude-opus-5 498033 37125 506
284 principal claude-opus-5 10365 536318 109
285 principal claude-opus-5 7441 546683 109
286 principal claude-opus-5 156 554124 119
287 principal claude-opus-5 7954 554280 97
288 principal claude-opus-5 8110 562234 259
289 principal claude-opus-5 1405 570344 6590
290 principal claude-opus-5 6649 571749 683
291 principal claude-opus-5 4643 578398 8798
292 principal claude-opus-5 8857 583041 725
293 principal claude-opus-5 4696 591898 1413
294 principal claude-opus-5 1475 596594 657
295 principal claude-opus-5 820 598069 1192
296 principal claude-opus-5 1654 598889 2137
297 principal claude-opus-5 2611 600543 1348
298 principal claude-opus-5 9338 603154 547
299 principal claude-opus-5 1059 612492 1365
300 principal claude-opus-5 5222 613551 1859
301 principal claude-opus-5 1940 618773 205
302 principal claude-opus-4-7 48551 0 295
303 principal claude-opus-5 3497 620713 109
304 principal claude-opus-4-7 7754 48551 85
305 principal claude-opus-4-7 11712 56305 82
306 principal claude-opus-5 7754 624210 107
307 principal claude-opus-4-7 6638 68017 122
308 principal claude-opus-4-7 6436 74655 79
309 principal claude-opus-5 7540 631964 164
310 principal claude-opus-5 6202 639504 488
311 principal claude-opus-4-7 1638 81091 744
312 principal claude-opus-5 1570 645706 2235
313 principal claude-opus-4-7 1835 82729 2568
314 principal claude-opus-5 2292 647276 1753
315 principal claude-opus-4-7 2583 84564 101
316 principal claude-opus-5 5592 649568 2258
317 principal claude-opus-4-7 1408 87147 3270
318 principal claude-opus-4-7 3888 88555 1500
319 principal claude-opus-5 5982 655160 5597
320 principal claude-opus-5 5655 661142 1070
321 principal claude-opus-5 1124 666797 769
322 principal claude-opus-5 4818 667921 3614
323 principal claude-opus-5 3630 672739 4306
324 principal claude-opus-5 4748 676369 130
325 principal claude-opus-5 184 681117 549
326 principal claude-opus-5 610 681301 1433
327 principal claude-opus-5 1483 681911 1815
328 principal claude-opus-5 2360 683394 2410
329 principal claude-opus-5 6369 685754 1252
330 principal claude-opus-5 1648 692123 1024
331 principal claude-opus-5 1505 693771 1785
332 principal claude-opus-5 2180 695276 2014
333 principal claude-opus-5 2092 697456 174
334 principal claude-opus-5 3302 699548 98
335 principal claude-opus-5 4837 702850 102
336 principal claude-opus-5 5844 707687 102
337 principal claude-opus-5 5188 713531 269
338 principal claude-opus-4-7 29696 27342 2927
339 principal claude-opus-4-7 9213 57038 78
340 principal claude-opus-4-7 4214 66251 81
341 principal claude-opus-4-7 2489 70465 79
342 principal claude-opus-4-7 5182 72954 79
343 principal claude-opus-4-7 7694 78136 81
344 principal claude-opus-4-7 6820 85830 85
345 principal claude-opus-5 632 718719 5387
346 principal claude-opus-4-7 11818 92650 2106
347 principal claude-opus-5 5446 719351 1965
348 principal claude-opus-4-7 2905 104468 812
349 principal claude-opus-4-7 2398 107373 1417
350 principal claude-opus-4-7 3751 109771 1609
351 principal claude-opus-4-7 1645 113522 69
352 principal claude-opus-5 1981 724797 6340
353 principal claude-opus-5 6816 726778 111
354 principal claude-opus-5 126 733594 197
355 principal claude-opus-5 215 733720 1468
356 principal claude-opus-5 5449 733935 1672
357 principal claude-opus-5 2135 739384 1560
358 principal claude-opus-5 1581 741519 1896
359 principal claude-opus-5 1971 743100 1488
360 principal claude-opus-4-7 18164 27342 1462
361 principal claude-opus-4-7 1512 45506 93
362 principal claude-opus-4-7 201 47018 93
363 principal claude-opus-4-7 6016 47219 88
364 principal claude-opus-5 5352 745071 657
365 principal claude-opus-4-7 4662 53235 93
366 principal claude-opus-4-7 7710 57897 508
367 principal claude-opus-4-7 650 65607 191
368 principal claude-opus-4-7 371 66257 134
369 principal claude-opus-4-7 3357 66628 1195
370 principal claude-opus-4-7 1546 69985 216
371 principal claude-opus-5 1158 750423 2260
372 principal claude-opus-4-7 1618 71531 1291
373 principal claude-opus-4-7 1327 73149 69
374 principal claude-opus-5 6182 751581 1102
375 principal claude-opus-5 1220 757763 2154
376 principal claude-opus-5 2596 758983 128
377 principal claude-opus-5 240 761579 683
378 principal claude-opus-5 333 762502 213
379 principal claude-opus-5 19154 762835 298
380 principal claude-opus-5 359 781989 212
381 principal claude-opus-5 68337 0 147
382 principal claude-opus-5 2865 68337 132
383 principal claude-opus-5 2761 71202 213
384 principal claude-opus-5 1173 73963 401
385 principal claude-opus-5 458 75136 49
386 principal claude-opus-5 82067 0 145
387 principal claude-opus-5 2775 82067 320
388 principal claude-opus-5 712 84842 53
389 principal claude-opus-5 128 85607 230
390 principal claude-opus-5 741 85735 276
391 principal claude-opus-5 886 86476 447
392 principal claude-opus-5 958 87362 263
393 principal claude-opus-5 432 88320 273
394 principal claude-opus-5 3186 88752 236
395 principal claude-opus-5 488 91938 404
396 principal claude-opus-5 481 92426 120
397 principal claude-opus-5 154 92907 74
398 principal claude-opus-5 18 93135 416
399 principal claude-opus-5 607 93153 158
400 principal claude-opus-5 1228 93760 120
401 principal claude-opus-5 1746 94988 231
402 principal claude-opus-5 794 96734 470
403 principal claude-opus-5 506 97528 349
404 principal claude-opus-5 253 98383 224
405 principal claude-opus-5 260 98636 269
406 principal claude-opus-5 780 98896 251
407 principal claude-opus-5 309 99676 262
408 principal claude-opus-5 466 99985 211
409 principal claude-opus-5 737 100451 138
410 principal claude-opus-5 5484 101188 607
411 principal claude-opus-5 1059 106672 146
412 principal claude-opus-5 273 107877 153
413 principal claude-opus-5 189 108150 140
414 principal claude-opus-5 1178 108339 217
415 principal claude-opus-5 273 109734 138
416 principal claude-opus-5 5493 110007 225
417 principal claude-opus-5 2555 115500 261
418 principal claude-opus-5 771 118055 299
419 principal claude-opus-5 347 118826 402
420 principal claude-opus-5 480 119173 136
421 principal claude-opus-5 647 119789 132
422 principal claude-opus-5 459 120436 58
423 principal claude-opus-5 693 120895 163
424 principal claude-opus-5 1123 121588 236
425 principal claude-opus-5 239 122711 57
426 principal claude-opus-5 283 123007 179
427 principal claude-opus-5 199 123290 100
428 principal claude-opus-5 115 123489 140
429 principal claude-opus-5 160 123604 276
430 principal claude-opus-5 442 123764 208
431 principal claude-opus-5 1965 124206 259
432 principal claude-opus-5 770 126171 260
433 principal claude-opus-5 399 126941 405
434 principal claude-opus-5 579 127340 299
435 principal claude-opus-5 283 128218 165
436 principal claude-opus-5 256 128666 502
437 principal claude-opus-5 627 128922 479
438 principal claude-opus-5 555 129549 66
439 principal claude-opus-5 12 130170 325
440 principal claude-opus-5 340 130182 149
441 principal claude-opus-5 1034 130522 270
442 principal claude-opus-5 398 131556 326
443 principal claude-opus-5 11 132280 305
444 principal claude-opus-5 922 132291 215
445 principal claude-opus-5 447 133213 133
446 principal claude-opus-5 1234 133660 384
447 principal claude-opus-5 1392 134894 541
448 principal claude-opus-5 619 136286 212
449 principal claude-opus-5 13 137117 239
450 principal claude-opus-5 19 137369 1086
451 principal claude-opus-5 2017 137388 366
452 principal claude-opus-5 412 139405 112
453 principal claude-opus-5 623 139817 359
454 principal claude-opus-5 641 140440 385
455 principal claude-opus-5 405 141081 1339
456 principal claude-opus-5 257 142825 513
457 principal claude-opus-5 649 143082 550
458 principal claude-opus-5 628 143731 26
459 principal claude-opus-5 257 144385 328
460 principal claude-opus-5 460 144642 625
461 principal claude-opus-5 1076 145102 54
462 principal claude-opus-5 256 146232 328
463 principal claude-opus-5 467 146488 190
464 principal claude-opus-5 210 146955 550
465 principal claude-opus-5 629 147165 40
466 principal claude-opus-5 14 147834 349
467 principal claude-opus-5 1264 147848 159
468 principal claude-opus-5 151381 0 366
469 principal claude-opus-5 765 151381 176
470 principal claude-opus-5 687 152146 270
471 principal claude-opus-5 801 152833 279
472 principal claude-opus-5 366 153634 195
473 principal claude-opus-5 267 154000 941
474 principal claude-opus-5 1107 154267 944
475 principal claude-opus-5 1024 155374 195
476 principal claude-opus-5 309 156398 173
477 principal claude-opus-5 21 156880 202
478 principal claude-opus-5 289 156901 1345
479 principal claude-opus-5 3036 157190 231
480 principal claude-opus-5 303 160226 772
481 principal claude-opus-5 1695 160529 108
482 principal claude-opus-5 301 162224 130
483 principal claude-opus-5 844 162525 162
484 principal claude-opus-5 987 163369 93
485 principal claude-opus-5 837 164356 287
486 principal claude-opus-5 410 165193 130
487 principal claude-opus-5 253 165603 1570
488 principal claude-opus-5 1665 165856 90
489 principal claude-opus-5 650 167521 97
490 principal claude-opus-5 301 168171 96
491 principal claude-opus-5 4485 168472 99
492 principal claude-opus-5 247 172957 850
493 principal claude-opus-5 884 173204 112
494 principal claude-opus-5 215 174088 129
495 principal claude-opus-5 350 174303 489
496 principal claude-opus-5 846 174653 1195
497 principal claude-opus-5 1710 175499 448
498 principal claude-opus-5 525 177209 225
499 principal claude-opus-5 247 177959 170
500 principal claude-opus-5 1118 178206 140
501 principal claude-opus-5 655 179464 216
502 principal claude-opus-5 727 180119 244
503 principal claude-opus-5 339 180846 219
504 principal claude-opus-5 2418 181185 320
505 principal claude-opus-5 1696 183603 502
506 principal claude-opus-5 2094 185299 1828
507 principal claude-opus-5 1862 187393 420
508 principal claude-opus-5 805 189255 144
509 principal claude-opus-5 612 190060 335
510 principal claude-opus-5 395 190672 119
511 principal claude-opus-5 1345 191067 293
512 principal claude-opus-5 353 192412 557
513 principal claude-opus-5 617 192765 522
514 principal claude-opus-5 580 193382 131
515 principal claude-opus-5 430 193962 1270
516 principal claude-opus-5 1341 194392 121
-->
<!-- /cout -->
