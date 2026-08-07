# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Un bouton nommé par sa raison, et non par son effet, est introuvable

**Symptome** — un parent, après mise en ligne : *« j'ai déjà fait une boulette en
allant voir depuis mon téléphone et en créant un compte pour Charlie que je
n'arrive plus à supprimer pour qu'il me fasse lui-même de son tél »*.

Le geste qu'il cherchait existait : « Changer d'enfant », dans les réglages. Il
efface le prénom, la progression et la clé du classement. Personne ne va le
chercher sous ce nom-là — il désigne une **situation** (un frère, une sœur, un
téléphone partagé), pas une action. Un parent qui veut effacer un profil créé par
erreur n'est dans aucune de ces trois situations, donc n'ouvre pas ce bouton.

**Cause** — le nom vient du § 7.2 du PRD, qui décrivait le geste par son cas
d'usage. Le PRD a raison de raisonner en parcours ; c'est l'**étiquette du
bouton** qui n'avait pas à recopier le vocabulaire du parcours. Une étiquette
répond à « qu'est-ce que ça fait ? », un parcours à « pourquoi je suis là ? », et
les deux ne se rédigent pas pareil.

**Detecte par** — `utilisateur`

**Action** — `rien` — réparé par le renommage. Aucun garde-fou ne juge un
libellé, et l'inventer coûterait plus que le défaut.

### 2. Le geste effaçait la clé qui commandait ce qu'il laissait en ligne

**Symptome** — « Changer d'enfant » efface la clé locale du classement, donc le
**code**, mais ne touche pas au serveur : le nom restait au classement, visible
par tous, et plus personne — pas même celui qui l'avait créé — ne pouvait le
retirer. Le produit fabriquait ainsi lui-même l'état dont le parent se plaignait.

Le geste **l'annonçait** : *« Ton nom au classement restera visible, et plus
personne ne pourra le supprimer. Supprime-le d'abord si tu ne veux pas le
laisser. »* La phrase était exacte, et c'est ce qui l'a rendue rassurante : elle
avait l'air d'un garde-fou. Une phrase qui décrit une impasse à celui qui va y
entrer n'en est pas un — c'est la documentation du défaut, et elle a servi
d'excuse à ne pas le corriger.

**Cause** — le geste a été écrit quand rien du produit ne vivait sur le serveur.
Le classement est arrivé au lot 2 et a ajouté une **seconde moitié** au profil ;
les deux gestes destructeurs existants n'ont pas été rejugés à ce moment-là. Le
tort n'est pas d'avoir oublié une ligne, c'est de n'avoir pas relu les gestes
destructeurs quand la surface qu'ils détruisent a changé de nature.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une app gagne un état côté serveur, relire
ses gestes destructeurs existants fait partie du lot, au même titre que ses
écrans de lecture. Rien à outiller : la question tient en une ligne — *ce bouton
efface-t-il encore tout ce qu'il prétend effacer ?*

### 3. Un premier correctif livré, puis annulé — la solution ne visait pas la cause

**Symptome** — le premier jet ajoutait un écran où l'on retape un nom et son code
pour retirer une fiche que ce téléphone ne porte pas. Correct, testé, poussé,
puis annulé sur demande : *« pour moi c'est le bouton changer d'enfant qui
devrait s'appeler supprimer mon profil »*. Deux commits et onze tests jetés.

**L'annulation est arrivée trop tard** : la PR #71, ouverte sur cette branche
avant le revirement, a été fusionnée dans `main` entre-temps. L'écran écarté est
donc parti en production, et c'est la présente branche qui l'en retire — d'où un
diff qui supprime du code que `main` n'a porté que quelques minutes. Le `git
reset` local avait bien défait le travail dans le dépôt de travail ; il ne
pouvait rien contre une PR déjà ouverte.

**Cause** — le symptôme rapporté — *« je n'arrive plus à supprimer »* — a été lu
comme *« il manque un chemin »*, alors qu'il disait *« le chemin existant ne se
trouve pas et ne finit pas le travail »*. Ajouter un troisième geste de sortie à
un produit dont le défaut était que ses deux gestes existants ne se distinguaient
pas aggravait la cause en traitant l'effet.

Le questionnement l'avait pourtant effleuré : la question posée listait « il ne
trouve pas le bouton » parmi les cas possibles, et la réponse fut « je ne sais
pas — couvre les trois ». Trois cas couverts par une seule solution, c'est le
signe qu'aucun n'a été diagnostiqué. **Une hypothèse retenue par défaut n'est pas
une hypothèse.** Il fallait relire les gestes existants avant d'en proposer un
neuf — la relecture qui a produit le bon correctif a pris dix minutes, après
coup.

**Detecte par** — `utilisateur`

**Action** — `comportement` — devant une demande d'ajout née d'un usage réel,
inventorier d'abord ce qui existe déjà pour la couvrir, et pourquoi ça n'a pas
suffi. « Ajouter » est le réflexe le plus cher : il double la surface, et il
laisse en place la chose qui n'allait pas.

### 4. « Annulé » ne veut rien dire tant qu'une pull request est ouverte

**Symptome** — le travail écarté à l'anomalie 3 a été défait localement — `git
reset --hard origin/main`, arbre propre, branche revenue à son point de départ —
et il est quand même arrivé dans `main` : la PR #71, ouverte sur cette branche,
a été fusionnée. Le conflit ne s'est manifesté qu'au moment de fusionner la PR
suivante, sous la forme d'un `mergeable_state: dirty` que rien n'annonçait.

Deux faits ont brouillé la lecture sur le moment : le `push --force-with-lease`
a échoué en `stale info`, puis la branche a disparu du serveur — ce qui
ressemblait exactement à une annulation réussie. Elle ne l'était pas : la PR,
elle, tenait toujours ses commits.

**Cause** — annuler a été traité comme une opération sur le dépôt local, alors
que le travail avait déjà été **publié**. Un `reset` défait des commits ; il ne
défait ni une PR, ni une fusion, ni un déploiement. La règle qui manquait tient
en une ligne : *ce qui est publié ne s'annule que là où il est publié*.

**Detecte par** — `auteur`

**Action** — `comportement` — avant d'annuler du travail poussé, regarder s'il
existe une PR sur la branche, et la fermer explicitement. Et le dire à qui
demande l'annulation : « annulé localement » et « retiré de la production » ne
sont pas la même phrase, et seule la seconde répond à la demande.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 20:16 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 220 | 0,00 $ |
| Écriture de cache | 479 662 | 2,41 $ |
| Lecture de cache | 16 554 657 | 7,76 $ |
| Sortie | 88 205 | 1,81 $ |
| **Total** | **17 122 744** | **11,97 $ — 10,40 €** |

**Ce qui coûte**

- **118 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 515 jetons, écrits une fois par session puis relus à chaque
  échange : 6 846 255 jetons de relecture, 41 % de tout ce qui a été relu.
- **Croissance** — 58 515 jetons relus au premier appel qui relise
  quelque chose, 236 930 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 17122744 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58515 0 477
2 principal claude-opus-5 4752 58515 149
3 principal claude-opus-5 653 63267 175
4 principal claude-opus-5 2527 63920 219
5 principal claude-opus-5 2698 66447 110
6 principal claude-opus-5 158 69145 71
7 principal claude-opus-5 13511 69303 270
8 principal claude-opus-5 6006 82814 202
9 principal claude-opus-5 1528 88820 368
10 principal claude-opus-5 3377 90348 123
11 principal claude-opus-5 2566 93725 298
12 principal claude-opus-5 684 96291 662
13 principal claude-opus-5 5012 96975 913
14 principal claude-opus-5 946 101987 123
15 principal claude-opus-5 451 102933 162
16 principal claude-opus-5 1850 103384 956
17 principal claude-opus-5 1133 105234 834
18 principal claude-opus-5 1017 106367 1511
19 principal claude-opus-5 1721 107384 1162
20 principal claude-opus-5 47 110266 947
21 principal claude-opus-5 3431 110313 183
22 principal claude-opus-5 1843 113744 180
23 principal claude-opus-5 263 115587 102
24 principal claude-opus-5 3583 115850 1709
25 principal claude-opus-5 5056 119433 2073
26 principal claude-opus-5 2088 124489 114
27 principal claude-opus-5 129 126577 207
28 principal claude-opus-5 1806 126706 818
29 principal claude-opus-5 1448 128512 113
30 principal claude-opus-5 1411 129960 222
31 principal claude-opus-5 1860 131371 206
32 principal claude-opus-5 2093 133231 123
33 principal claude-opus-5 1223 135324 234
34 principal claude-opus-5 527 136547 1452
35 principal claude-opus-5 2442 137074 123
36 principal claude-opus-5 1278 139516 327
37 principal claude-opus-5 1902 140794 2152
38 principal claude-opus-5 4345 142696 958
39 principal claude-opus-5 2129 147041 5277
40 principal claude-opus-5 5336 149170 122
41 principal claude-opus-5 478 154506 825
42 principal claude-opus-5 913 154984 1265
43 principal claude-opus-5 1329 155897 1992
44 principal claude-opus-5 2056 157226 255
45 principal claude-opus-5 319 159282 95
46 principal claude-opus-5 509 159601 269
47 principal claude-opus-5 545 160110 102
48 principal claude-opus-5 652 160655 163
49 principal claude-opus-5 602 161307 318
50 principal claude-opus-5 496 161909 90
51 principal claude-opus-5 179 162405 767
52 principal claude-opus-5 6924 162584 141
53 principal claude-opus-5 363 169508 126
54 principal claude-opus-5 1124 169871 361
55 principal claude-opus-5 551 170995 927
56 principal claude-opus-5 986 171546 253
57 principal claude-opus-5 268 172532 113
58 principal claude-opus-5 116 172800 119
59 principal claude-opus-5 182 172916 82
60 principal claude-opus-5 3616 173098 1908
61 principal claude-opus-5 1974 176714 89
62 principal claude-opus-5 776 178688 100
63 principal claude-opus-5 297 179464 351
64 principal claude-opus-5 4413 179761 1556
65 principal claude-opus-5 1726 184174 96
66 principal claude-opus-4-7 12899 28262 128
67 principal claude-opus-5 4413 185900 212
68 principal claude-opus-4-7 216 41161 79
69 principal claude-opus-4-7 865 41377 95
70 principal claude-opus-4-7 0 41161 156
71 principal claude-opus-4-7 19488 42242 145
72 principal claude-opus-5 370 190313 566
73 principal claude-opus-4-7 7944 61730 132
74 principal claude-opus-4-7 244 41161 123
75 principal claude-opus-4-7 182 41405 85
76 principal claude-opus-4-7 269 69674 198
77 principal claude-opus-4-7 119 41587 95
78 principal claude-opus-4-7 503 69943 131
79 principal claude-opus-4-7 19488 41706 248
80 principal claude-opus-4-7 1583 61194 199
81 principal claude-opus-4-7 1486 70446 3173
82 principal claude-opus-4-7 2308 62777 3266
83 principal claude-opus-4-7 5039 71932 3202
84 principal claude-opus-4-7 3364 65085 1876
85 principal claude-opus-4-7 5194 76971 2287
86 principal claude-opus-4-7 13134 28262 126
87 principal claude-opus-4-7 214 41396 133
88 principal claude-opus-5 150370 40941 2343
89 principal claude-opus-5 10763 191311 181
90 principal claude-opus-5 227 202074 121
91 principal claude-opus-5 222 202301 1658
92 principal claude-opus-5 4 204181 2342
93 principal claude-opus-5 2998 204185 134
94 principal claude-opus-5 1764 207183 2350
95 principal claude-opus-5 3037 208947 6485
96 principal claude-opus-5 6542 211984 591
97 principal claude-opus-5 655 218526 296
98 principal claude-opus-5 360 219181 1011
99 principal claude-opus-5 1075 219541 954
100 principal claude-opus-5 1016 220616 745
101 principal claude-opus-5 807 221632 501
102 principal claude-opus-5 563 222439 2637
103 principal claude-opus-5 2829 223002 286
104 principal claude-opus-5 347 225831 123
105 principal claude-opus-5 503 226178 107
106 principal claude-opus-5 327 226681 1303
107 principal claude-opus-5 1364 227008 120
108 principal claude-opus-5 285 228372 617
109 principal claude-opus-5 681 228657 610
110 principal claude-opus-5 674 229338 97
111 principal claude-opus-5 564 230012 1211
112 principal claude-opus-5 1196 230576 117
113 principal claude-opus-5 303 231772 956
114 principal claude-opus-5 1015 232075 1213
115 principal claude-opus-5 1273 233090 2023
116 principal claude-opus-5 2089 234363 147
117 principal claude-opus-5 478 236452 1233
118 principal claude-opus-5 1270 236930 248
-->
<!-- /cout -->
