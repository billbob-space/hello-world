# 2026-08-18 — claude/estran-forecast-beyond-5h-0pjzvx

Branche : `claude/estran-forecast-beyond-5h-0pjzvx`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La navigation temporelle a laisse le jour courant tronque a cinq heures

**Symptome** — un aller-retour utilisateur : impossible de voir la fin de
l'apres-midi sans partir sur demain puis revenir. La donnee etait deja
recuperee et deja servie aux autres jours ; seule la journee en cours restait
coupee a cinq vignettes.

**Cause** — prp/01 s'etait donne pour contrainte principale de laisser l'ecran
d'aujourd'hui identique a l'octet pres, et a livre les vingt-quatre heures
« pour un jour autre qu'aujourd'hui ». Cette formulation, ecrite pour proteger
l'ecran d'ouverture, a fige une asymetrie que personne n'avait choisie : le
seul jour qu'on regarde vraiment etait le seul a ne pas avoir le detail.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une capacite s'ajoute « pour les autres
cas », verifier ce qu'elle laisse au cas par defaut : ne pas toucher a l'ecran
d'ouverture est une precaution, pas un objectif.

### 2. Au bord de la fenetre, l'absence se decodait en zero

**Symptome** — application lancee en local et interrogee pour de vrai : le
seizieme jour de tendance annoncait « 0 °C, vent 0 km/h, rafales 0 », et la
journee entiere affichait « pluie 0 % » et « vagues 0,0 m ». Ni la
compilation, ni `go vet`, ni les tests, ni la relecture du diff ne l'avaient
signale — la seule chose qui l'ait montre est un appel a la vraie API.

**Cause** — Open-Meteo rend `null` au bord de sa fenetre, sur des grandeurs
distinctes et a des profondeurs distinctes (journalier au dernier jour, pluie
horaire sur la derniere journee, vagues nulles sur les 24 heures). Decodees en
`float64`, ces absences deviennent la valeur zero, qui est ici **credible** :
« 0 % de pluie » ne ressemble pas a une donnee manquante. Le PRP decrivait
pourtant la degradation attendue en bord de fenetre pour les vagues seules,
heritee de prp/01 — la regle etait ecrite, mais pour un seul champ, et
personne ne l'a generalisee en passant de huit a seize jours.

**Detecte par** — `auteur`

**Action** — `comportement` — elargir une fenetre de donnees, c'est s'approcher
du bord ou le fournisseur cesse de repondre : lancer l'app et regarder le
DERNIER element, pas le premier. Un test sur une donnee figee ne peut pas
trouver ca, il ne contient que ce qu'on a pense a y mettre.

### 3. Deux modeles d'accord affichaient « confiance haute »

**Symptome** — sur la vraie reponse, les jours J+9 a J+12 portaient une
confiance haute alors que quatre modeles sur six ne repondaient plus. L'indice
disait le contraire de ce qu'il est cense dire, precisement la ou l'incertitude
est maximale.

**Cause** — la regle que j'avais ecrite mesurait la DISPERSION entre modeles
survivants sans jamais regarder leur NOMBRE, au-dela d'un plancher a deux. Deux
modeles qui s'accordent ne font pas un accord, mais la formule ne pouvait pas
le savoir. Erreur de conception, pas d'implementation.

**Detecte par** — `auteur`

**Action** — `rien` — reparee par un plafond (« moyenne » au plus sous trois
modeles) ecrit dans le PRP et dans le code ; rien a en tirer pour la fabrique.

### 4. Un test capturait la mauvaise requete sortante, en silence

**Symptome** — rapporte par l'artisan : le test qui verifie la fenetre demandee
au fournisseur meteo capturait la requete dans une variable partagee par un
handler unique. L'appel d'accord entre modeles partageant la meme URL de base,
il ecrasait la requete capturee, et le test aurait continue a passer en
verifiant la mauvaise.

**Cause** — un test double qui ne distingue pas deux appels distincts vers le
meme hote ne verifie pas ce que son nom annonce. Le defaut est apparu quand un
troisieme appel sortant est arrive, pas quand le test a ete ecrit.

**Detecte par** — `auteur`

**Action** — `rien` — repare en distinguant les deux requetes sur la presence
du parametre `models`.

### 5. Un test comparait un nombre d'heures a une constante, avec l'heure reelle

**Symptome** — rapporte par l'artisan : le test de la reponse sans parametre
utilisait `time.Now()` et exigeait exactement cinq vignettes. Avec la nouvelle
regle (les heures restantes du jour, minimum cinq), cette egalite devient
fausse selon l'heure a laquelle la CI tourne — vert en local le soir, rouge en
CI a midi.

**Cause** — un test qui depend de l'horloge reelle et fige une egalite stricte
mesure l'heure autant que le code. Le reste du domaine passe deja `maintenant`
en parametre explicite pour cette raison ; ce test-la ne le faisait pas.

**Detecte par** — `auteur`

**Action** — `rien` — repare en comparant au plancher plutot qu'a l'egalite ;
le vice de forme est connu et deja evite partout ailleurs dans cette app.

### 6. Trois defauts visibles seulement a l'ecran, sous des verifications DOM vertes

**Symptome** — captures prises sur l'app reelle a 390 et 1280 de large : les
barres de l'indice de confiance se superposaient au texte du vent, la tendance
avait acquis un defilement interne qui coupait une ligne en deux au bas du
cadre et cachait dix jours sur quinze derriere une seconde barre de
defilement, et le titre annoncait « Tendance a 16 jours » au-dessus de quinze
lignes. Les verifications faites au selecteur — presence des classes, valeurs
de `getComputedStyle`, comptes d'elements — etaient toutes vertes.

**Cause** — interroger le DOM repond a « l'element est-il la, avec la bonne
regle CSS ? », jamais a « qu'est-ce qu'on voit ? ». Un chevauchement, une
troncature et un titre qui contredit son contenu sont exactement les trois
choses qu'un selecteur ne peut pas voir. Le titre, lui, est un cas a part : il
etait ecrit en dur alors que le nombre de jours rendus depend desormais du
fournisseur — la correction de degradation l'a rendu faux sans le toucher.

**Detecte par** — `relecture`

**Action** — `comportement` — sur un changement d'interface, regarder la
capture avant de conclure ; une assertion DOM verte n'est pas une preuve
visuelle. Et une valeur ecrite en dur dans le HTML devient un mensonge des que
la donnee qu'elle resume se met a varier.


## Suite : la mise en ligne, apres la fusion

Perimetre de cette seconde partie : `estran` et la fabrique (chaine de
deploiement).

### 7. La CI ne peut plus enregistrer les versions sur main — rien ne se deploie

**Symptome** — PR #139 fusionnee, tous les jobs verts, image publiee, puis le
job `deploy` echoue a l'etape « enregistrer les versions deployees » :
`GH013: Repository rule violations found for refs/heads/main`, « 2 of 2
required status checks are expected », quatre tentatives, puis
« impossible d'enregistrer les versions sur main — rien n'est deploye ». Le
webhook dockhand n'est pas appele, le conteneur en ligne affiche toujours
`Up 43 hours`.

**Cause** — une regle de protection de `main` exige des controles de statut sur
tout ce qui y est pousse. La CI, elle, pousse un commit d'epinglage
directement, avec `[skip ci]` — donc les controles exiges ne s'executeront
jamais sur ce commit, et la regle le refusera toujours. Ce n'est pas une
condition de course : c'est une impasse structurelle, et la meme panne avait
deja eu lieu le 16 aout (run 31963069804), avant ce travail.

**Ce qui ne repare PAS** — trois pistes essayees sur le papier et ecartees
avant d'ecrire une ligne :

- *ouvrir une pull request depuis la CI et la fusionner automatiquement* :
  GitHub ne declenche aucun workflow pour un evenement produit par
  `GITHUB_TOKEN`. Les controles exiges ne tourneraient donc pas sur cette PR,
  la fusion automatique attendrait indefiniment, et la fusion elle-meme ne
  declencherait pas le deploiement ;
- *rendre l'echec non bloquant et appeler quand meme le webhook* : dockhand
  clone le depot et deploie ce qu'il y lit. Sans le commit d'epinglage, il
  redeploierait l'ancienne image en croyant travailler ;
- *renoncer a l'epinglage* (tag mouvant du genre `:main`) : le compose ne
  changerait plus jamais, et dockhand recreerait les neuf conteneurs a chaque
  appel au lieu du seul service livre.

**Ce qui repare vraiment** — deux gestes, tous deux hors du depot : autoriser
le robot de la CI a contourner la regle (acteur de contournement sur la
ruleset), ou lui donner un jeton qui la contourne. Le depot ne peut pas se
sortir seul d'une regle qui s'applique a lui.

**Contournement applique en attendant** — l'epinglage pousse par pull request
depuis une branche ordinaire, comme le 16 aout : les controles tournent
normalement, la fusion pousse sur `main`, et c'est cette poussee qui declenche
le deploiement.

**Detecte par** — `CI`

**Action** — `arbitrage` — le correctif durable est un reglage GitHub, pas un
changement de code : il appartient a l'exploitant du depot.

### 8. Le contournement choisi par l'exploitant ne visait pas la bonne regle

**Symptome** — apres avoir coche « Do not require status checks on creation »,
la CI relancee sur les neuf apps a echoue **exactement au meme endroit et avec
le meme message**, au caractere pres : `2 of 2 required status checks are
expected`.

**Cause** — deux options voisines dans le meme ecran ne portent pas sur le meme
evenement : celle-ci n'exempte que la **creation** d'une branche ou d'un depot,
pas la mise a jour d'une ref existante. Je l'avais proposee comme porte de
cote sans en verifier la portee — l'anomalie est la mienne, pas celle de qui
l'a cochee.

**Detecte par** — `CI`

**Action** — `comportement` — ne pas proposer un reglage d'apres son intitule.
Ici, l'intitule disait « status checks » et la description disait « created » :
c'est la description qui avait raison, et elle etait sous les yeux.

### 9. Le robot des Actions n'est pas proposable en contournement — la cle de deploiement, si

**Symptome** — « GitHub Actions » n'apparait pas dans la *Bypass list* de la
regle. L'acteur qu'il aurait fallu exempter n'est donc pas exemptable.

**Cause** — GitHub n'expose dans cette liste que des roles, des equipes, des
applications installees et les **cles de deploiement**. Le robot integre des
Actions n'en fait pas partie.

**Ce qui a ete pose** — une cle de deploiement dediee : partie publique en
`Deploy keys` avec acces en ecriture, partie privee dans le secret
`DEPLOIEMENT_SSH_KEY`, *Deploy keys* ajoute a la *Bypass list*. Le workflow
pousse desormais par SSH avec elle quand le secret existe, et retombe sur la
poussee HTTPS d'avant quand il manque — un fork n'a rien a configurer.

**Le piege qui vient avec, et qui n'existait pas avant** : une poussee faite par
une cle de deploiement **declenche** les workflows, contrairement a celle du
`GITHUB_TOKEN`. Ce qui ferme la boucle « la CI committe, donc la CI repart »
n'est plus la nature du jeton mais le seul `[skip ci]` du message de commit.
Ecrit dans le workflow, dans le README et ici : c'est le genre de garde-fou
qu'on retire un jour en le croyant decoratif.

**La cle privee n'a pas transite par la conversation** — elle a ete fabriquee
par l'exploitant sur sa machine. Une cle privee collee dans un fil de session
n'est plus privee, et la session est archivee.

**Detecte par** — `auteur`

**Action** — `rien` — repare dans le README de la fabrique, ou le contrat
envoie deja le lecteur pour tout ce qui touche au deploiement (« c'est mesure
au README ») : le montage a poser une fois y est ecrit, le piege du `[skip ci]`
aussi. Rien a changer dans le contrat lui-meme.


### 10. La regle ne refusait plus rien, mais la cle etait illisible

**Symptome** — premiere relance avec la cle de deploiement : plus aucune
violation de regle, mais `Load key "/home/runner/.ssh/deploiement": error in
libcrypto`, puis `git@github.com: Permission denied (publickey)`. Le second
message accuse les droits d'acces ; le vrai defaut est la forme du secret.

**Cause** — une cle privee collee dans un secret perd facilement sa forme :
retours chariot, ou corps replie sur une seule ligne par un presse-papier — un
telephone le fait sans prevenir, et l'exploitant travaillait depuis le sien.
openssh ne le dit pas : « error in libcrypto » ne nomme ni le champ ni la
ligne.

**Ce qui a ete pose** — le workflow remet la cle en forme avant de s'en servir
(retours chariot retires, corps re-decoupe en lignes de 70 caracteres quand
tout tenait sur une seule, saut de ligne final garanti), **puis la verifie**
avec `ssh-keygen -y` et n'affiche que son empreinte publique. Un secret
illisible produit desormais une erreur qui dit quoi recoller, avant meme
qu'on essaie de pousser.

**Deux pieges rencontres en l'ecrivant, tous deux silencieux** :

- un `<<'HEREDOC'` dans un bloc YAML garde la marge d'indentation du bloc, que
  Python refuse ; le script est donc depouille par `sed` avant d'etre lu, et
  ecrit sans indentation propre pour survivre a ce depouillage ;
- la premiere version re-decoupait le corps en lignes de 70 caracteres **sans
  retirer les espaces** qui separaient les morceaux : la cle ressortait
  toujours invalide, mais joliment presentee. Trouve en essayant les trois cas
  a la main — cle bien formee, cle sur une ligne, cle avec retours chariot —
  avant de committer, pas en CI.

**Detecte par** — `CI`

**Action** — `rien` — repare dans le workflow, avec le message d'erreur qui
manquait.


### 11. Un bloc `run:` valide en YAML et casse en shell, decouvert par la CI

**Symptome** — relance suivante : `here-document at line 30 delimited by
end-of-file (wanted 'NORMALISER')`, puis `syntax error: unexpected end of
file`. L'etape meurt avant sa premiere commande, apres dix minutes de
construction et neuf images publiees pour rien.

**Cause** — le delimiteur de fin d'un heredoc doit etre en debut de ligne, or
un bloc YAML impose une marge a toutes ses lignes. Je le savais pour le CONTENU
du script — c'est meme pour ca que je le depouillais par `sed` — et je ne l'ai
pas vu pour le DELIMITEUR lui-meme. Le YAML, lui, restait parfaitement valide :
un analyseur YAML ne lit pas le shell qu'il transporte.

**Ce qui a ete pose** — la remise en forme reecrite en shell pur, sans heredoc
ni script indente, et quatre cas essayes localement avant de pousser (cle bien
formee rendue identique, cle sur une ligne avec espaces reconstituee a
l'identique, retours chariot retires, texte quelconque refuse avec un message
qui dit quoi recoller). Les treize blocs `run:` du workflow ont ete extraits et
passes a `bash -n`.

**Detecte par** — `CI`

**Action** — `garde-fou` — `--check` devrait passer chaque bloc `run:` du
workflow a `bash -n` : ici, deux verifications vertes (YAML valide, contrat
respecte) ont laisse partir un script qui ne demarrait pas. Le correctif n'est
pas dans ce commit : il touche `init.sh`, partage par toutes les apps, et la
mise en ligne d'estran attend. Il vient juste apres, dans sa propre branche.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-18 à 13:41 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 002 | 0,00 $ |
| Écriture de cache | 2 099 756 | 8,93 $ |
| Lecture de cache | 117 147 778 | 45,46 $ |
| Sortie | 173 695 | 3,42 $ |
| **Total** | **119 422 231** | **57,81 $ — 50,20 €** |

**Ce qui coûte**

- **501 appel(s) au modèle** — un par réponse, outils compris —, dont 234 par des sous-agents — 61 095 071 jetons, 21,82 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 046 jetons, écrits une fois par session puis relus à chaque
  échange : 17 036 236 jetons de relecture, 14 % de tout ce qui a été relu.
- **Tours courts** — 352 des 501 tours (70 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 38,90 $, soit 67 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 046 jetons relus au premier appel qui relise
  quelque chose, 387 671 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 119422231 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 64046 0 393
2 principal claude-opus-5 1593 64046 193
3 principal claude-opus-5 1969 65639 179
4 principal claude-opus-5 4783 67608 214
5 principal claude-opus-5 2420 72391 222
6 principal claude-opus-5 674 74811 89
7 principal claude-opus-5 1811 75485 830
8 principal claude-opus-5 11016 77296 1550
9 principal claude-opus-5 1901 88312 745
10 principal claude-opus-5 5897 90213 195
11 principal claude-opus-5 3886 96110 292
12 principal claude-opus-5 498 99996 108
13 principal claude-opus-5 1236 100494 762
14 principal claude-opus-5 1095 102494 1003
15 principal claude-opus-5 2579 103589 1936
16 principal claude-opus-5 2134 106168 1134
17 principal claude-opus-5 1653 108302 676
18 principal claude-opus-5 1651 109955 2615
19 principal claude-opus-5 4993 111606 138
20 principal claude-opus-5 2656 116599 137
21 principal claude-opus-5 698 119255 768
22 principal claude-opus-5 1354 119953 339
23 principal claude-opus-5 1307 121307 5347
24 principal claude-opus-5 5377 122614 841
25 principal claude-opus-5 1144 127991 2433
26 principal claude-opus-5 2835 129135 1216
27 principal claude-opus-5 1248 131970 333
28 principal claude-opus-5 616 133218 706
29 principal claude-opus-5 915 133834 401
30 principal claude-opus-5 700 134749 1104
31 principal claude-opus-5 1170 135449 110
32 principal claude-opus-5 332 136619 160
33 principal claude-opus-5 5928 133834 212
34 principal claude-opus-5 663 139762 97
35 principal claude-opus-5 1044 140425 197
36 principal claude-opus-5 2676 141469 328
37 principal claude-opus-5 396 144145 104
38 principal claude-opus-5 1404 144541 638
39 principal claude-opus-5 906 145945 140
40 principal claude-opus-5 194 146851 495
41 principal claude-opus-5 1231 147045 770
42 principal claude-opus-5 1068 148276 1136
43 principal claude-opus-5 1264 149344 2431
44 principal claude-opus-5 2552 150608 1415
45 principal claude-opus-5 1446 153160 1368
46 principal claude-opus-5 1498 154606 836
47 principal claude-opus-5 1187 156104 1976
48 principal claude-opus-5 2358 157291 589
49 principal claude-opus-5 875 159649 162
50 principal claude-opus-5 236 160524 351
51 principal claude-opus-5 3288 160760 942
52 principal claude-opus-5 1190 164048 549
53 principal claude-opus-5 636 165238 910
54 principal claude-opus-5 1013 165874 66
55 principal claude-opus-5 6975 160524 28
56 principal claude-opus-5 447 167499 743
57 principal claude-opus-5 844 167946 57
58 principal claude-opus-5 120 168790 84
59 principal claude-opus-5 286 168910 1188
60 principal claude-opus-5 1380 169196 109
61 principal claude-opus-5 217 170576 71
62 principal claude-opus-5 2427 170864 609
63 principal claude-opus-5 798 173291 372
64 principal claude-opus-5 466 174089 160
65 principal claude-opus-5 298 174555 765
66 principal claude-opus-5 1455 174853 464
67 principal claude-opus-5 1464 176308 87
68 principal claude-opus-5 180 177772 303
69 principal claude-opus-5 711 177952 145
70 principal claude-opus-5 317 178663 676
71 principal claude-opus-5 862 178980 335
72 principal claude-opus-5 1154 179842 381
73 principal claude-opus-5 2432 180996 1558
74 principal claude-opus-5 1688 183428 1243
75 principal claude-opus-5 1791 185116 759
76 principal claude-opus-5 790 186907 78
77 principal claude-opus-5 141 187697 77
78 principal claude-opus-5 279 187838 338
79 principal claude-opus-5 859 188117 62
80 principal claude-opus-5 2160 189038 366
81 principal claude-opus-5 437 191198 264
82 principal claude-opus-5 510 191635 194
83 principal claude-opus-5 414 192145 110
84 principal claude-opus-5 1065 192559 226
85 principal claude-opus-5 3415 193624 513
86 principal claude-opus-5 542 197039 105
87 principal claude-opus-5 358 197581 958
88 principal claude-opus-5 1142 197939 136
89 principal claude-opus-5 544 199081 196
90 principal claude-opus-5 235 199625 135
91 principal claude-opus-5 1688 199860 433
92 principal claude-opus-5 600 201548 84
93 principal claude-opus-5 465 202148 86
94 principal claude-opus-4-7 0 76503 1720
95 principal claude-opus-4-7 76503 0 2246
96 principal claude-opus-4-7 1806 76503 96
97 principal claude-opus-4-7 2334 76503 94
98 principal claude-opus-4-7 265 78309 84
99 principal claude-opus-4-7 263 78837 84
100 principal claude-opus-4-7 12212 78574 128
101 principal claude-opus-4-7 12212 79100 124
102 principal claude-opus-5 504 202613 1280
103 principal claude-opus-5 1890 203117 149
104 principal claude-opus-4-7 4791 91312 554
105 principal claude-opus-5 2164 205007 137
106 principal claude-opus-4-7 3030 96103 209
107 principal claude-opus-4-7 0 76503 2102
108 principal claude-opus-4-7 2185 76503 95
109 principal claude-opus-4-7 264 78688 82
110 principal claude-opus-5 432 207171 515
111 principal claude-opus-4-7 4749 78952 84
112 principal claude-opus-4-7 7910 90786 1831
113 principal claude-opus-4-7 6498 98696 179
114 principal claude-opus-5 728 207603 582
115 principal claude-opus-4-7 1041 99133 1586
116 principal claude-opus-4-7 12212 83701 2203
117 principal claude-opus-4-7 3061 105194 1896
118 principal claude-opus-4-7 14957 95913 122
119 principal claude-opus-5 40 208913 309
120 principal claude-opus-5 763 208953 224
121 principal claude-opus-4-7 7904 110870 2498
122 principal claude-opus-5 38 209940 221
123 principal claude-opus-5 1199 209978 459
124 principal claude-opus-5 28 211636 162
125 principal claude-opus-5 908 211664 133
126 principal claude-opus-5 198 212572 137
127 principal claude-opus-5 682 212770 290
128 principal claude-opus-5 1171 213452 263
129 principal claude-opus-5 515 214623 638
130 principal claude-opus-5 1370 215138 213
131 principal claude-opus-5 165110 45275 186
132 principal claude-opus-5 5717 210385 226
133 principal claude-opus-5 736 216102 160
134 principal claude-opus-5 3257 216838 608
135 principal claude-opus-5 1605 220095 160
136 principal claude-opus-5 2659 221700 1557
137 principal claude-opus-5 9137 221862 480
138 principal claude-opus-5 698 230999 170
139 principal claude-opus-5 253 231697 1417
140 principal claude-opus-5 1631 231950 664
141 principal claude-opus-5 2474 233581 1298
142 principal claude-opus-5 2703 236055 4994
143 principal claude-opus-5 5439 238758 1927
144 principal claude-opus-5 2048 244197 192
145 principal claude-opus-4-7 3936 29200 145
146 principal claude-opus-4-7 233 33136 98
147 principal claude-opus-4-7 257 33369 78
148 principal claude-opus-4-7 0 33136 241
149 principal claude-opus-4-7 395 33136 182
150 principal claude-opus-4-7 772 33626 294
151 principal claude-opus-5 419 246245 962
152 principal claude-opus-4-7 1008 34398 244
153 principal claude-opus-4-7 1763 33531 426
154 principal claude-opus-5 1572 246664 496
155 principal claude-opus-5 542 248236 419
156 principal claude-opus-5 520 248778 404
157 principal claude-opus-5 421 249702 137
158 principal claude-opus-5 527 250123 352
159 principal claude-opus-5 1026 250650 652
160 principal claude-opus-5 6342 251676 931
161 principal claude-opus-5 1069 258018 642
162 principal claude-opus-5 697 259087 153
163 principal claude-opus-5 253 259784 98
164 principal claude-opus-5 276 260135 137
165 principal claude-opus-5 1452 260411 209
166 principal claude-opus-5 274 261863 137
167 principal claude-opus-5 808 262137 417
168 principal claude-opus-5 858 262945 55
169 principal claude-opus-5 287 263858 174
170 principal claude-opus-5 587 264145 234
171 principal claude-opus-5 488 264732 441
172 principal claude-opus-5 35 265661 2101
173 principal claude-opus-5 46 267797 943
174 principal claude-opus-5 2170 267843 1419
175 principal claude-opus-5 1515 270013 88
176 principal claude-opus-5 750 271528 195
177 principal claude-opus-5 302 272278 176
178 principal claude-opus-5 276 272580 89
179 principal claude-opus-5 179 272856 177
180 principal claude-opus-5 264 273035 236
181 principal claude-opus-5 392 273299 278
182 principal claude-opus-5 299 273969 101
183 principal claude-opus-5 575 274268 185
184 principal claude-opus-5 288 274843 335
185 principal claude-opus-5 876 275131 231
186 principal claude-opus-5 449 276007 349
187 principal claude-opus-5 450 276456 102
188 principal claude-opus-5 282 277008 161
189 principal claude-opus-5 240 277290 202
190 principal claude-opus-5 23052 277530 206
191 principal claude-opus-5 1462 300582 274
192 principal claude-opus-5 2462 302044 283
193 principal claude-opus-5 3464 304506 1960
194 principal claude-opus-5 272738 45275 795
195 principal claude-opus-5 834 318013 1418
196 principal claude-opus-5 167 320265 1603
197 principal claude-opus-5 1915 320432 771
198 principal claude-opus-5 38 323118 860
199 principal claude-opus-5 1797 323156 2556
200 principal claude-opus-5 2593 324953 160
201 principal claude-opus-5 565 327546 85
202 principal claude-opus-5 806 328111 1307
203 principal claude-opus-5 1443 328917 1221
204 principal claude-opus-5 1628 330360 1053
205 principal claude-opus-5 1184 331988 905
206 principal claude-opus-4-7 34362 0 160
207 principal claude-opus-5 1072 333172 1341
208 principal claude-opus-5 1951 334244 227
209 principal claude-opus-5 329 336195 325
210 principal claude-opus-4-7 16113 34362 8184
211 principal claude-opus-5 281 336849 137
212 principal claude-opus-5 528 337130 457
213 principal claude-opus-5 495 337658 182
214 principal claude-opus-4-7 9392 50475 1470
215 principal claude-opus-5 282 338153 113
216 principal claude-opus-5 305 338548 137
217 principal claude-opus-5 4103 338853 318
218 principal claude-opus-5 383 342956 137
219 principal claude-opus-5 689 343339 195
220 principal claude-opus-5 642 344028 305
221 principal claude-opus-5 406 344670 106
222 principal claude-opus-5 295 345182 302
223 principal claude-opus-5 1194 345477 227
224 principal claude-opus-5 289 346671 489
225 principal claude-opus-5 587 346960 62
226 principal claude-opus-5 275 347609 223
227 principal claude-opus-5 738 347884 277
228 principal claude-opus-5 1872 348622 160
229 principal claude-opus-5 2960 350494 3053
230 principal claude-opus-5 3087 353454 2442
231 principal claude-opus-5 2479 356541 768
232 principal claude-opus-5 1519 359020 1148
233 principal claude-opus-5 1534 360539 1665
234 principal claude-opus-4-7 4648 29200 152
235 principal claude-opus-5 1827 362073 1096
236 principal claude-opus-5 1706 363900 323
237 principal claude-opus-5 595 365606 220
238 principal claude-opus-5 258 366201 161
239 principal claude-opus-5 261 366459 191
240 principal claude-opus-4-7 17078 33848 4784
241 principal claude-opus-4-7 6126 50926 1872
242 principal claude-opus-5 284 366911 134
243 principal claude-opus-5 609 367195 230
244 principal claude-opus-5 747 367804 90
245 principal claude-opus-5 135 368551 184
246 principal claude-opus-5 260 368686 139
247 principal claude-opus-5 225 368946 133
248 principal claude-opus-5 198 369171 137
249 principal claude-opus-5 843 369369 210
250 principal claude-opus-5 310 370212 82
251 principal claude-opus-5 292 370604 137
252 principal claude-opus-5 565 370896 195
253 principal claude-opus-5 642 371461 319
254 principal claude-opus-5 420 372103 81
255 principal claude-opus-5 296 372604 205
256 principal claude-opus-5 1097 372900 226
257 principal claude-opus-5 285 373997 184
258 principal claude-opus-5 260 374282 413
259 principal claude-opus-5 643 374542 49
260 principal claude-opus-5 280 375234 184
261 principal claude-opus-5 2452 375514 160
262 principal claude-opus-5 2916 377966 3165
263 principal claude-opus-5 4047 380882 938
264 principal claude-opus-5 1386 384929 630
265 principal claude-opus-5 691 386315 471
266 principal claude-opus-5 665 387006 88
267 principal claude-opus-5 1394 387671 3101
268 agent claude-sonnet-5 18761 0 4
269 agent claude-sonnet-5 2297 18761 2
270 agent claude-sonnet-5 3540 21058 9
271 agent claude-sonnet-5 638 24598 20
272 agent claude-sonnet-5 5613 25236 14
273 agent claude-sonnet-5 7112 30849 7
274 agent claude-sonnet-5 4726 37961 3
275 agent claude-sonnet-5 5215 42687 5
276 agent claude-sonnet-5 6668 47902 14
277 agent claude-sonnet-5 6765 54570 5
278 agent claude-sonnet-5 719 61335 6
279 agent claude-sonnet-5 12812 62054 2
280 agent claude-sonnet-5 9784 74866 3
281 agent claude-sonnet-5 17956 84650 14
282 agent claude-sonnet-5 1336 102606 5
283 agent claude-sonnet-5 12386 103942 4
284 agent claude-sonnet-5 6251 116328 2
285 agent claude-sonnet-5 445 122579 17
286 agent claude-sonnet-5 524 123024 16
287 agent claude-sonnet-5 1293 123548 5
288 agent claude-sonnet-5 1223 124841 7
289 agent claude-sonnet-5 1523 126064 14
290 agent claude-sonnet-5 759 127587 17
291 agent claude-sonnet-5 1491 128346 5
292 agent claude-sonnet-5 1853 129837 20
293 agent claude-sonnet-5 550 131690 17
294 agent claude-sonnet-5 4359 132240 5
295 agent claude-sonnet-5 183 136599 1
296 agent claude-sonnet-5 953 136782 3
297 agent claude-sonnet-5 1342 137735 6
298 agent claude-sonnet-5 703 139077 3
299 agent claude-sonnet-5 767 139780 1
300 agent claude-sonnet-5 802 140547 20
301 agent claude-sonnet-5 672 141349 5
302 agent claude-sonnet-5 308 142021 9
303 agent claude-sonnet-5 333 142329 17
304 agent claude-sonnet-5 296 142662 6
305 agent claude-sonnet-5 836 142958 4
306 agent claude-sonnet-5 362 143794 17
307 agent claude-sonnet-5 956 144156 7
308 agent claude-sonnet-5 676 145112 6
309 agent claude-sonnet-5 228 145788 3
310 agent claude-sonnet-5 2433 146016 3
311 agent claude-sonnet-5 1556 148449 9
312 agent claude-sonnet-5 2042 150005 2
313 agent claude-sonnet-5 1699 152047 20
314 agent claude-sonnet-5 598 153746 3
315 agent claude-sonnet-5 922 154344 2
316 agent claude-sonnet-5 627 155266 17
317 agent claude-sonnet-5 1402 155893 6
318 agent claude-sonnet-5 224 157295 3
319 agent claude-sonnet-5 1343 157519 3
320 agent claude-sonnet-5 1159 158862 3
321 agent claude-sonnet-5 755 160021 4
322 agent claude-sonnet-5 1947 160776 3
323 agent claude-sonnet-5 639 162723 6
324 agent claude-sonnet-5 145 163362 7
325 agent claude-sonnet-5 4100 163507 3
326 agent claude-sonnet-5 1452 167607 3
327 agent claude-sonnet-5 2656 169059 4
328 agent claude-sonnet-5 1879 171715 3
329 agent claude-sonnet-5 1201 173594 3
330 agent claude-sonnet-5 1217 174795 20
331 agent claude-sonnet-5 2752 176012 5
332 agent claude-sonnet-5 711 178764 6
333 agent claude-sonnet-5 2918 179475 6
334 agent claude-sonnet-5 256 182393 20
335 agent claude-sonnet-5 4509 182649 1
336 agent claude-sonnet-5 4703 187158 8
337 agent claude-sonnet-5 298 191861 2
338 agent claude-sonnet-5 438 192159 17
339 agent claude-sonnet-5 400 192597 7
340 agent claude-sonnet-5 795 192997 4
341 agent claude-sonnet-5 782 193792 6
342 agent claude-sonnet-5 772 194574 4
343 agent claude-sonnet-5 1519 195346 20
344 agent claude-sonnet-5 3155 196865 2
345 agent claude-sonnet-5 645 200020 6
346 agent claude-sonnet-5 856 200665 6
347 agent claude-sonnet-5 943 201521 17
348 agent claude-sonnet-5 649 202464 2
349 agent claude-sonnet-5 611 203113 5
350 agent claude-sonnet-5 381 203724 14
351 agent claude-sonnet-5 755 204105 9
352 agent claude-sonnet-5 1358 204860 4
353 agent claude-sonnet-5 2152 206218 2
354 agent claude-sonnet-5 1180 208370 5
355 agent claude-sonnet-5 584 209550 16
356 agent claude-sonnet-5 859 210134 2
357 agent claude-sonnet-5 1607 210993 14
358 agent claude-sonnet-5 514 212600 5
359 agent claude-sonnet-5 816 213114 5
360 agent claude-sonnet-5 571 213930 3
361 agent claude-sonnet-5 1644 214501 3
362 agent claude-sonnet-5 376 216145 20
363 agent claude-sonnet-5 640 216521 4
364 agent claude-sonnet-5 453 217161 20
365 agent claude-sonnet-5 391 217614 17
366 agent claude-sonnet-5 391 218005 8
367 agent claude-sonnet-5 439 218396 9
368 agent claude-sonnet-5 189 218835 8
369 agent claude-sonnet-5 325 219024 3
370 agent claude-sonnet-5 2195 219349 7
371 agent claude-sonnet-5 2598 221544 9
372 agent claude-sonnet-5 1532 224142 1
373 agent claude-sonnet-5 184 225674 20
374 agent claude-sonnet-5 345 225858 2
375 agent claude-sonnet-5 176 226203 8
376 agent claude-sonnet-5 1745 226379 2
377 agent claude-sonnet-5 716 228124 2
378 agent claude-sonnet-5 297 228840 3
379 agent claude-sonnet-5 242 229137 20
380 agent claude-sonnet-5 152 229379 2
381 agent claude-sonnet-5 209276 11469 4
382 agent claude-sonnet-5 6239 220745 2
383 agent claude-sonnet-5 22604 226984 2
384 agent claude-sonnet-5 11737 249588 9
385 agent claude-sonnet-5 2316 261325 5
386 agent claude-sonnet-5 1617 263641 20
387 agent claude-sonnet-5 562 265258 2
388 agent claude-sonnet-5 2536 265820 3
389 agent claude-sonnet-5 546 268356 3
390 agent claude-sonnet-5 1273 268902 3
391 agent claude-sonnet-5 6662 270175 5
392 agent claude-sonnet-5 2110 276837 3
393 agent claude-sonnet-5 3838 278947 4
394 agent claude-sonnet-5 579 282785 5
395 agent claude-sonnet-5 4057 283364 4
396 agent claude-sonnet-5 247 287421 4
397 agent claude-sonnet-5 8693 287668 3
398 agent claude-sonnet-5 3017 296361 17
399 agent claude-sonnet-5 507 299378 4
400 agent claude-sonnet-5 601 299885 3
401 agent claude-sonnet-5 817 300486 9
402 agent claude-sonnet-5 1131 301303 4
403 agent claude-sonnet-5 667 302434 17
404 agent claude-sonnet-5 437 303101 4
405 agent claude-sonnet-5 2327 303538 9
406 agent claude-sonnet-5 263 305865 1
407 agent claude-sonnet-5 349 306128 16
408 agent claude-sonnet-5 2176 306477 3
409 agent claude-sonnet-5 2286 308653 3
410 agent claude-sonnet-5 341 310939 2
411 agent claude-sonnet-5 11326 311280 6
412 agent claude-sonnet-5 782 322606 17
413 agent claude-sonnet-5 682 323388 5
414 agent claude-sonnet-5 1182 324070 21
415 agent claude-sonnet-5 375 325252 3
416 agent claude-sonnet-5 1523 325627 3
417 agent claude-sonnet-5 4310 327150 3
418 agent claude-sonnet-5 1020 331460 5
419 agent claude-sonnet-5 385 332480 2
420 agent claude-sonnet-5 5278 332865 3
421 agent claude-sonnet-5 1317 338143 20
422 agent claude-sonnet-5 1502 339460 3
423 agent claude-sonnet-5 1475 340962 5
424 agent claude-sonnet-5 1396 342437 6
425 agent claude-sonnet-5 1908 343833 9
426 agent claude-sonnet-5 157 345741 20
427 agent claude-sonnet-5 5499 345898 3
428 agent claude-sonnet-5 642 351397 20
429 agent claude-sonnet-5 702 352039 17
430 agent claude-sonnet-5 992 352741 2
431 agent claude-sonnet-5 1204 353733 14
432 agent claude-sonnet-5 391 354937 3
433 agent claude-sonnet-5 2232 355328 4
434 agent claude-sonnet-5 1003 357560 2
435 agent claude-sonnet-5 224 358563 6
436 agent claude-sonnet-5 223 358787 4
437 agent claude-sonnet-5 301 359010 3
438 agent claude-sonnet-5 459 359311 2
439 agent claude-sonnet-5 262 359770 20
440 agent claude-sonnet-5 239 360032 4
441 agent claude-sonnet-5 1411 360271 3
442 agent claude-sonnet-5 314 361682 20
443 agent claude-sonnet-5 131 361996 4
444 agent claude-sonnet-5 183 362127 20
445 agent claude-sonnet-5 661 362310 1
446 agent claude-sonnet-5 252 362971 5
447 agent claude-sonnet-5 380 363223 2
448 agent claude-sonnet-5 346085 11469 7
449 agent claude-sonnet-5 3547 357554 5
450 agent claude-sonnet-5 996 361101 2
451 agent claude-sonnet-5 873 362097 5
452 agent claude-sonnet-5 1371 362970 3
453 agent claude-sonnet-5 4139 364341 3
454 agent claude-sonnet-5 639 368480 7
455 agent claude-sonnet-5 716 369119 3
456 agent claude-sonnet-5 1553 369835 2
457 agent claude-sonnet-5 467 371388 20
458 agent claude-sonnet-5 699 371855 3
459 agent claude-sonnet-5 820 372554 5
460 agent claude-sonnet-5 386 373374 20
461 agent claude-sonnet-5 279 373760 4
462 agent claude-sonnet-5 288 374039 5
463 agent claude-sonnet-5 206 374327 20
464 agent claude-sonnet-5 212 374533 6
465 agent claude-sonnet-5 3039 374745 4
466 agent claude-sonnet-5 2050 377784 2
467 agent claude-sonnet-5 4199 379834 3
468 agent claude-sonnet-5 618 384033 3
469 agent claude-sonnet-5 504 384651 5
470 agent claude-sonnet-5 632 385155 2
471 agent claude-sonnet-5 2315 385787 2
472 agent claude-sonnet-5 2951 388102 20
473 agent claude-sonnet-5 541 391053 7
474 agent claude-sonnet-5 4282 391594 2
475 agent claude-sonnet-5 1010 395876 3
476 agent claude-sonnet-5 715 396886 1
477 agent claude-sonnet-5 814 397601 3
478 agent claude-sonnet-5 1580 398415 3
479 agent claude-sonnet-5 3609 399995 2
480 agent claude-sonnet-5 3519 403604 9
481 agent claude-sonnet-5 5269 407123 3
482 agent claude-sonnet-5 184 412392 20
483 agent claude-sonnet-5 711 412576 2
484 agent claude-sonnet-5 3169 413287 6
485 agent claude-sonnet-5 247 416456 20
486 agent claude-sonnet-5 609 416703 20
487 agent claude-sonnet-5 336 417312 6
488 agent claude-sonnet-5 877 417648 4
489 agent claude-sonnet-5 2138 418525 2
490 agent claude-sonnet-5 477 420663 2
491 agent claude-sonnet-5 2154 421140 2
492 agent claude-sonnet-5 1403 423294 3
493 agent claude-sonnet-5 3659 424697 2
494 agent claude-sonnet-5 1825 428356 20
495 agent claude-sonnet-5 160 430181 2
496 agent claude-sonnet-5 220 430341 20
497 agent claude-sonnet-5 357 430561 5
498 agent claude-sonnet-5 449 430918 2
499 agent claude-sonnet-5 742 431367 3
500 agent claude-sonnet-5 342 432109 4
501 agent claude-sonnet-5 698 432451 1
-->
<!-- /cout -->
