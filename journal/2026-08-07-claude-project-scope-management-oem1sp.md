# 2026-08-07 — claude/project-scope-management-oem1sp

Branche : `claude/project-scope-management-oem1sp`
Périmètre : `marcq-handball`, `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le PRD de marcq-handball affirme le contraire de ce que l'application fait

**Symptome** — `apps/marcq-handball/PRODUCT.md` liste le chronomètre et les
vidéos de démonstration sous « Hors périmètre — décidé, pas oublié » (§ 6), et
le § 13 argumente le refus du chronomètre. Les deux sont livrés depuis le
7 août : `web/chrono.js` et `web/video.js` sont dans l'image en ligne, avec
leurs tests. La ligne « Capabilities and Constraints » de la fiche produit,
celle que lit un agent qui n'ouvre pas le PRD, répète la même exclusion.

Trois des sept changements postérieurs aux onze PRP déplaçaient le périmètre —
le minuteur, les liens vidéo, et « L'équipe » sortie de l'écran perso pour
devenir un onglet, ce que le § 7.5 décrivait autrement. Aucun des trois n'a
touché le PRD.

**Cause** — rien n'oblige à rouvrir le PRD quand un ajout dépasse les PRP, et
rien ne le signale. Le seul ajout correctement reporté (le dénominateur du
classement, `922e1d9`) l'a été parce qu'il corrigeait une règle métier déjà
écrite au § 9 : le travail passait par le document, donc le document a suivi.
Une capacité *neuve* ne passe par aucune ligne existante — elle s'ajoute à côté
du PRD, jamais dedans. C'est exactement le cas que ni `--check` ni `pret.sh` ne
regardaient.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `pret.sh` voit passer les fichiers ajoutés par la
branche ; un fichier de code neuf dans une app dont le `PRODUCT.md` n'est pas
touché est le signal exact, et il ne se déclenche pas sur les corrections.

### 2. Une capacité livrée dont la demande n'existe nulle part dans le dépôt

**Symptome** — les liens vidéo (`a24674f`) n'ont ni PRP, ni ligne de PRD, ni
entrée de journal : le seul endroit du dépôt où cette capacité est justifiée est
le message de commit qui l'introduit. Le minuteur (`538e523`) est dans le même
cas ; seule sa *correction* du lendemain a laissé une trace, parce qu'elle est
née d'une anomalie et que les anomalies, elles, ont un registre.

**Cause** — le journal enregistre les anomalies, les PRP enregistrent le travail
planifié, et le PRD enregistre les décisions. Un ajout demandé de vive voix
après la livraison ne tombe dans aucun des trois : il n'a mal tourné nulle part,
il n'était pas planifié, et il n'a pas été arbitré par écrit. Le dépôt n'avait
donc pas d'endroit pour lui — ce qui se lit, à tort, comme la permission de ne
rien écrire.

**Detecte par** — `auteur`

**Action** — `contrat` — le PRD reçoit une section « Ajouté après les PRP » ;
c'est l'endroit manquant, et le contrat dit désormais qu'il faut le remplir.

### 3. La procédure d'ajout d'une app existait en trois copies, dont deux fausses

**Symptome** — en allégeant le contrat, trouvé que la séquence « construire
d'abord, brancher ensuite » est écrite trois fois : dans `CLAUDE.md`, dans
`README.md`, et dans le message que `./init.sh --add` affiche à la fin.

Les deux dernières donnent la même consigne fausse — `git add … .github …
.claude …`, et « `--add` vient de réécrire compose.yaml, **le workflow** et
.gitignore ». Le workflow n'est plus généré : `--check` en vérifie deux
propriétés depuis qu'il a cessé de l'être, et `.claude/settings.json` n'est plus
régénéré non plus. Seul `CLAUDE.md` était à jour. Le message de `--add` est le
plus nuisible des trois : il s'affiche au moment exact où on va committer.

**Cause** — une copie ne vieillit pas au même rythme que son original. Le commit
qui a cessé de générer le workflow a corrigé le contrat, qui parle du workflow,
et n'a pas pensé aux deux textes qui parlent d'*ajouter une app* — le sujet
n'était pas le même, la phrase l'était. Rien ne relie une phrase à sa copie ;
c'est ce qui rend la duplication coûteuse longtemps après avoir été écrite.

**Detecte par** — `auteur`

**Action** — `contrat` — la procédure vit désormais dans un seul fichier ; le
contrat, le README et le message de `--add` y renvoient au lieu de la recopier.

### 4. Le README décrivait `--check` deux fois, et la première version était fausse

**Symptome** — le § « Le contrôle avant de pousser » enchaînait deux
descriptions du même programme. La seconde était juste. La première annonçait
« il commence par les manifestes, **il vérifie ensuite service par service** » —
en sautant la section des artefacts dérivés, que la seconde qualifie pourtant de
« deuxième section, pas la dernière ». Un lecteur qui s'arrêtait à la première
croyait que `--check` ne compare jamais le `compose.yaml` à ce qu'`init.sh`
écrirait aujourd'hui, c'est-à-dire le seul contrôle qui prouve que le compose
committé décrit les apps committées.

Deux sections manquaient en outre aux deux versions : les contrôles par
application — `Dockerfile`, `USER` non root, `chown` des volumes — et le journal.

**Cause** — les deux passages ont été écrits à des moments différents, chacun de
mémoire, et l'ordre réel des sections n'a été relu dans aucun des deux. Il est
pourtant lisible en une commande : `./init.sh --check` imprime ses huit sections
dans l'ordre où elles tournent.

**Detecte par** — `auteur`

**Action** — `comportement` — un document qui énumère les étapes d'un programme
se rédige depuis la sortie du programme, jamais de mémoire. Aucun garde-fou
plausible ne distingue deux paragraphes qui redisent la même chose d'un rappel
volontaire ; c'est la relecture qui doit changer, pas l'outillage.

### 5. Quatre affirmations du README étaient périmées, dont deux au même endroit

**Symptome** — en corrigeant le doublon, relu le reste du fichier. Quatre
affirmations fausses :

- le tableau des applications en listait **trois** ; il y en a six actives ;
- « aucune application ne déclare de volume ni de service partagé,
  `shared_services` est vide » — il y a trois volumes nommés, deux bases annexes
  et un cache Valkey partagé ;
- l'arborescence annonçait `.github/workflows/` et `.claude/` **GÉNÉRÉS** ;
  c'est la faute déjà corrigée hier dans le message de `--add`, restée dans un
  troisième document que la correction d'hier n'avait pas atteint ;
- « à vérifier avant d'ajouter la **deuxième** application », alors que la
  septième est en cours.

**Cause** — un `README` n'a pas de garde-fou parce qu'aucune de ses phrases n'est
dérivable d'un manifeste : `--check` sait comparer `compose.yaml` à ce
qu'`init.sh` écrirait, il ne sait pas comparer une prose à un état. Le fichier
vieillit donc à la vitesse de la fabrique, sans que rien ne le signale, et une
phrase écrite juste devient fausse sans être touchée.

Le troisième point est le plus instructif : la correction d'hier a cherché les
copies de la procédure d'ajout et les a toutes trouvées — deux — sans penser que
la même *affirmation* vivait ailleurs, dans un tableau qui ne parle pas d'ajouter
une app. Chercher les copies d'un paragraphe ne trouve pas les copies d'un fait.

**Detecte par** — `auteur`

**Action** — `comportement` — relire le `README` en entier quand on y touche, et
vérifier ses affirmations chiffrées contre la sortie des scripts plutôt que
contre le souvenir qu'on en a.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 17:25 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 271 | 0,00 $ |
| Écriture de cache | 583 071 | 3,43 $ |
| Lecture de cache | 22 746 574 | 11,14 $ |
| Sortie | 98 925 | 2,31 $ |
| **Total** | **23 428 841** | **16,89 $ — 14,66 €** |

**Ce qui coûte**

- **145 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  55 854 jetons, écrits une fois par session puis relus à chaque
  échange : 8 042 976 jetons de relecture, 35 % de tout ce qui a été relu.
- **Croissance** — 55 854 jetons relus au premier appel qui relise
  quelque chose, 247 865 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 23428841 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 55854 0 757
2 principal claude-opus-5 3802 55854 553
3 principal claude-opus-5 5853 59656 797
4 principal claude-opus-5 2239 65509 1566
5 principal claude-opus-5 60 69314 908
6 principal claude-opus-5 5077 69374 351
7 principal claude-opus-5 4491 74451 356
8 principal claude-opus-5 3880 78942 2906
9 principal claude-opus-5 3930 82822 425
10 principal claude-opus-5 4776 86752 2557
11 principal claude-opus-5 3949 91528 235
12 principal claude-opus-5 778 95477 1672
13 principal claude-opus-5 2742 96255 1038
14 principal claude-opus-5 2271 98997 1340
15 principal claude-opus-5 1409 101268 305
16 principal claude-opus-5 2050 102677 322
17 principal claude-opus-5 405 104727 578
18 principal claude-opus-5 768 105132 158
19 principal claude-opus-5 603 105900 355
20 principal claude-opus-5 415 106503 442
21 principal claude-opus-5 502 106918 2823
22 principal claude-opus-5 2883 107420 227
23 principal claude-opus-5 2028 110303 536
24 principal claude-opus-5 594 112331 94
25 principal claude-opus-5 291 112925 1471
26 principal claude-opus-5 1515 113216 103
27 principal claude-opus-5 261 114731 821
28 principal claude-opus-5 1825 114992 2258
29 principal claude-opus-5 8498 116817 722
30 principal claude-opus-5 773 125315 912
31 principal claude-opus-5 963 126088 572
32 principal claude-opus-5 1154 127051 453
33 principal claude-opus-5 1746 128205 2002
34 principal claude-opus-5 2907 129951 3114
35 principal claude-opus-5 3160 132858 109
36 principal claude-opus-5 284 136018 844
37 principal claude-opus-5 892 136302 94
38 principal claude-opus-5 319 137194 818
39 principal claude-opus-5 1299 137513 230
40 principal claude-opus-5 297 138812 112
41 principal claude-opus-5 121 139109 93
42 principal claude-opus-5 470 139230 329
43 principal claude-opus-5 1056 139700 694
44 principal claude-opus-5 745 140756 167
45 principal claude-opus-5 380 141501 1461
46 principal claude-opus-5 1633 141881 181
47 principal claude-opus-4-7 8467 28262 114
48 principal claude-opus-4-7 164 36729 93
49 principal claude-opus-4-7 209 36893 82
50 principal claude-opus-4-7 3353 37102 80
51 principal claude-opus-4-7 3492 40455 84
52 principal claude-opus-4-7 10039 43947 3166
53 principal claude-opus-4-7 3189 53986 177
54 principal claude-opus-4-7 232 57175 1389
55 principal claude-opus-5 313 143514 1059
56 principal claude-opus-5 1418 143827 1185
57 principal claude-opus-5 1670 145245 322
58 principal claude-opus-5 620 146915 3401
59 principal claude-opus-5 3447 147535 109
60 principal claude-opus-5 658 150982 674
61 principal claude-opus-5 724 151640 267
62 principal claude-opus-5 447 152364 157
63 principal claude-opus-5 494 152811 1688
64 principal claude-opus-5 1807 153305 96
65 principal claude-opus-5 2652 155112 164
66 principal claude-opus-5 283 157764 185
67 principal claude-opus-5 332 158047 877
68 principal claude-opus-5 124086 38224 511
69 principal claude-opus-5 4286 162310 197
70 principal claude-opus-5 7436 166596 2803
71 principal claude-opus-5 3290 174032 242
72 principal claude-opus-5 1888 177322 987
73 principal claude-opus-5 1564 179210 349
74 principal claude-opus-5 1515 180774 1592
75 principal claude-opus-5 3033 182289 1728
76 principal claude-opus-5 1780 185322 942
77 principal claude-opus-5 1122 187102 267
78 principal claude-opus-5 316 188224 912
79 principal claude-opus-5 957 188540 106
80 principal claude-opus-5 718 189497 685
81 principal claude-opus-5 731 190215 114
82 principal claude-opus-5 323 190946 732
83 principal claude-opus-5 919 191269 786
84 principal claude-opus-5 855 192188 91
85 principal claude-opus-5 291 193043 1082
86 principal claude-opus-4-7 3765 28262 184
87 principal claude-opus-4-7 234 32027 98
88 principal claude-opus-4-7 204 32261 122
89 principal claude-opus-4-7 1338 32465 789
90 principal claude-opus-5 1263 193334 2778
91 principal claude-opus-5 2827 194597 652
92 principal claude-opus-5 702 197424 491
93 principal claude-opus-5 546 198126 480
94 principal claude-opus-5 530 198672 559
95 principal claude-opus-5 608 199202 106
96 principal claude-opus-5 1083 199810 265
97 principal claude-opus-5 315 200893 425
98 principal claude-opus-5 475 201208 418
99 principal claude-opus-5 598 201683 105
100 principal claude-opus-5 749 202281 1348
101 principal claude-opus-5 1398 203030 134
102 principal claude-opus-5 487 204428 138
103 principal claude-opus-5 270 204915 221
104 principal claude-opus-5 1456 205185 329
105 principal claude-opus-5 345 206641 94
106 principal claude-opus-5 294 206986 1184
107 principal claude-opus-5 1233 207280 157
108 principal claude-opus-5 4390 208513 111
109 principal claude-opus-5 250 212903 625
110 principal claude-opus-5 8 213778 253
111 principal claude-opus-5 1043 213786 1263
112 principal claude-opus-5 1778 214829 178
113 principal claude-opus-5 2169 216607 137
114 principal claude-opus-5 541 218776 449
115 principal claude-opus-5 512 219317 340
116 principal claude-opus-5 181652 38224 179
117 principal claude-opus-5 215 219876 238
118 principal claude-opus-5 16 220329 221
119 principal claude-opus-5 362 220345 104
120 principal claude-opus-5 2157 220707 496
121 principal claude-opus-5 549 222864 495
122 principal claude-opus-5 1837 223413 988
123 principal claude-opus-5 4992 225250 1182
124 principal claude-opus-5 1589 230242 727
125 principal claude-opus-5 1050 231831 600
126 principal claude-opus-5 645 232881 563
127 principal claude-opus-5 608 233526 104
128 principal claude-opus-5 1594 234134 798
129 principal claude-opus-5 843 235728 109
130 principal claude-opus-5 123 236571 1393
131 principal claude-opus-5 1462 236694 91
132 principal claude-opus-5 266 238156 878
133 principal claude-opus-5 910 238422 913
134 principal claude-opus-5 2077 239332 564
135 principal claude-opus-5 866 241409 387
136 principal claude-opus-5 512 242275 723
137 principal claude-opus-5 768 242787 306
138 principal claude-opus-5 351 243555 104
139 principal claude-opus-5 456 243906 626
140 principal claude-opus-5 671 244362 101
141 principal claude-opus-5 431 245033 919
142 principal claude-opus-5 964 245464 129
143 principal claude-opus-5 330 246428 908
144 principal claude-opus-5 1107 246758 1126
145 principal claude-opus-5 1189 247865 164
-->
<!-- /cout -->
