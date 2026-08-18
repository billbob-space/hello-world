# 2026-08-18 — claude/dockhand-deployment-issue-yb1msg

Branche : `claude/dockhand-deployment-issue-yb1msg`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « analyse le problème de déploiement unitaire qui ne
fonctionne pas dans dockhand », en partant du message posté le 8 août sur
[`Finsys/dockhand#419`](https://github.com/Finsys/dockhand/issues/419). Le
`README` décrivait déjà le symptôme et concluait que le dépôt n'y pouvait rien ;
la lecture du code source de `dockhand` a montré que ce n'était pas tout à fait
vrai.

## Anomalies

### 1. « Le dépôt n'y peut rien » avait été conclu sans lire le code de l'outil

**Symptome** — le `README` consacre une section entière au redémarrage sélectif
qu'on n'obtient pas, et la referme sur trois issues : relancer la demande chez
`dockhand`, changer d'outil, ou vivre avec. La lecture du code source de
`dockhand` — clone public, vingt minutes — en ouvre une quatrième, et corrige au
passage deux affirmations : la recréation forcée ne tient pas à un réglage
manquant mais à **une ligne**, `forceRecreate = syncResult.updated` dans le
chemin git, et `updated` vaut « un fichier a changé **dans le répertoire du
compose** », c'est-à-dire le dépôt entier puisque le nôtre est à la racine. Plus
utile encore : `dockhand` **contient déjà** la primitive juste —
`updateStackService()`, qui fait `docker compose up -d <service>` sans forcer —
et **personne ne l'appelle**. Le correctif chez eux tient en quelques lignes, ce
qui change ce qu'on peut raisonnablement leur demander.

**Cause** — l'analyse s'était arrêtée aux traces d'exécution et à la
documentation de l'outil, toutes deux suffisantes pour établir le symptôme et
sa cause immédiate. Elles ne disent pas ce que l'outil sait faire par ailleurs.
Un composant libre est lisible : ne pas le lire, c'est traiter comme une limite
ce qui n'est qu'un chemin non câblé.

**Detecte par** — `auteur`

**Action** — `comportement` — devant un défaut d'un composant libre, lire son
code avant de conclure à une limite : le clone est gratuit, et il change la
liste des issues possibles.

### 2. Le levier existait, la porte de service interdisait de l'actionner

**Symptome** — l'API de `dockhand` sait recréer **un** conteneur en gardant tous
ses réglages, et c'est exactement la livraison unitaire cherchée. Elle est
pourtant inatteignable depuis la CI : le routeur Traefik qui expose `/api` sans
authentification est restreint à la méthode `GET`, et c'est cette restriction —
et elle seule — qui rend le jeton d'API inoffensif s'il fuit.

**Cause** — la porte de service a été taillée pour un besoin de lecture, le seul
qui existait alors. Elle n'a pas de réglage plus fin que la méthode HTTP : elle
ouvre tout `GET` ou rien.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soumis à l'utilisateur avec son coût : entrouvrir la
porte sur trois chemins précis, ou éclater la stack en une pile par app. Choix
retenu : entrouvrir, ce qui déplace un peu le verrou et se referme en une ligne.

### 3. Un heredoc occupe l'entrée standard, le tuyau qui portait le JSON était ignoré

**Symptome** — le pas de livraison échouait sur `JSONDecodeError: Expecting
value: line 1 column 1`, alors que l'appel HTTP juste avant avait rendu un corps
complet et que le même faux serveur, appelé à la main, rendait bien ce corps.

**Cause** — `printf '%s' "$REPONSE" | python3 - "$arg" <<'PY' … PY` : le
programme python arrive **par l'entrée standard**, que le heredoc branche ; le
tuyau est donc écrasé, et `json.load(sys.stdin)` lit un flux déjà consommé. Deux
usages corrects du même `python3 -` — l'un lisant un fichier, l'autre censé lire
un tuyau — se ressemblent assez pour qu'on ne voie pas que le second ne peut pas
marcher. Corrigé en écrivant la réponse HTTP dans un fichier, dont le chemin est
passé par l'environnement.

**Detecte par** — `test`

**Action** — `rien` — le faux serveur monté avant le commit l'a vu du premier
coup ; c'est exactement ce pour quoi il a été monté.

### 4. Ce que la livraison unitaire ne rattrape pas, et qu'il fallait donc écrire

**Symptome** — en écrivant le repli, une question sans réponse dans le dépôt :
la copie du `compose.yaml` que `dockhand` garde à côté de la stack n'est
rafraîchie qu'au déploiement complet. Recréer un conteneur sans la toucher
laisse une copie qui dit encore les images d'avant — et c'est elle que sert un
`Restart` depuis l'interface.

**Cause** — la fabrique n'avait jamais eu besoin de distinguer « ce que le dépôt
dit » de « ce que le serveur a sous la main » : le déploiement complet les
réalignait à chaque fois. Contourner ce chemin fait apparaître un troisième
état, qu'aucun contrôle ne regardait.

**Detecte par** — `auteur`

**Action** — `rien` — la copie est mise à jour avant les conteneurs, sans
redémarrage, et le README dit pourquoi ce pas existe.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-18 à 13:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 219 | 0,00 $ |
| Écriture de cache | 473 444 | 2,57 $ |
| Lecture de cache | 16 999 203 | 8,40 $ |
| Sortie | 115 150 | 2,35 $ |
| **Total** | **17 588 016** | **13,32 $ — 11,57 €** |

**Ce qui coûte**

- **107 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 054 jetons, écrits une fois par session puis relus à chaque
  échange : 6 789 724 jetons de relecture, 39 % de tout ce qui a été relu.
- **Tours courts** — 34 des 107 tours (31 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 3,01 $, soit 22 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 054 jetons relus au premier appel qui relise
  quelque chose, 265 271 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 17588016 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 64054 0 580
2 principal claude-opus-5 6338 64054 396
3 principal claude-opus-5 3431 70392 496
4 principal claude-opus-5 9346 73823 346
5 principal claude-opus-5 979 83169 547
6 principal claude-opus-5 942 84148 207
7 principal claude-opus-5 391 85090 311
8 principal claude-opus-5 491 85481 304
9 principal claude-opus-5 556 85972 167
10 principal claude-opus-5 600 86528 259
11 principal claude-opus-5 389 87128 250
12 principal claude-opus-5 486 87517 329
13 principal claude-opus-5 893 88003 85
14 principal claude-opus-5 306 88896 547
15 principal claude-opus-5 594 89202 174
16 principal claude-opus-5 714 89796 163
17 principal claude-opus-5 1506 90510 251
18 principal claude-opus-5 563 92016 1033
19 principal claude-opus-5 1146 92579 258
20 principal claude-opus-5 1877 93725 1208
21 principal claude-opus-5 6012 95602 233
22 principal claude-opus-5 2161 101614 451
23 principal claude-opus-5 3327 103775 812
24 principal claude-opus-5 5433 107102 774
25 principal claude-opus-5 1430 112535 188
26 principal claude-opus-5 1679 113965 268
27 principal claude-opus-5 316 115644 150
28 principal claude-opus-5 1478 115960 480
29 principal claude-opus-5 1464 117438 94
30 principal claude-opus-5 1058 118902 682
31 principal claude-opus-5 795 119960 412
32 principal claude-opus-5 1270 120755 228
33 principal claude-opus-5 975 122025 343
34 principal claude-opus-5 747 123000 114
35 principal claude-opus-5 970 123747 1096
36 principal claude-opus-5 1357 124717 131
37 principal claude-opus-5 1008 126074 1324
38 principal claude-opus-5 1991 127082 154
39 principal claude-opus-5 1765 129073 1153
40 principal claude-opus-5 2083 130838 262
41 principal claude-opus-5 350 132921 160
42 principal claude-opus-5 388 133271 124
43 principal claude-opus-5 2116 133659 2287
44 principal claude-opus-5 2543 135775 1074
45 principal claude-opus-5 2796 138318 505
46 principal claude-opus-5 3126 141114 440
47 principal claude-opus-5 2771 144240 245
48 principal claude-opus-5 739 147011 1597
49 principal claude-opus-5 4050 147750 2733
50 principal claude-opus-5 3949 151800 344
51 principal claude-opus-5 1301 155749 340
52 principal claude-opus-5 2814 157050 125
53 principal claude-opus-5 3511 159864 1721
54 principal claude-opus-5 3017 163375 599
55 principal claude-opus-5 3372 166392 230
56 principal claude-opus-5 3606 169764 2019
57 principal claude-opus-5 3903 173370 3030
58 principal claude-opus-5 4845 177273 1845
59 principal claude-opus-5 143746 45269 491
60 principal claude-opus-5 11243 180305 1323
61 principal claude-opus-5 1535 191548 3280
62 principal claude-opus-5 5430 193083 2118
63 principal claude-opus-5 4365 198513 405
64 principal claude-opus-5 655 202878 126
65 principal claude-opus-5 526 203533 5019
66 principal claude-opus-5 5418 204059 105
67 principal claude-opus-5 1227 209477 1725
68 principal claude-opus-5 1864 210704 233
69 principal claude-opus-5 784 212568 11846
70 principal claude-opus-5 11934 213352 693
71 principal claude-opus-5 1283 225286 841
72 principal claude-opus-5 1212 226569 189
73 principal claude-opus-5 969 227781 682
74 principal claude-opus-5 730 228750 343
75 principal claude-opus-5 1005 229480 2099
76 principal claude-opus-5 2130 230485 391
77 principal claude-opus-5 513 232615 433
78 principal claude-opus-5 1012 233128 1028
79 principal claude-opus-5 1331 234140 456
80 principal claude-opus-5 566 235471 2992
81 principal claude-opus-5 3031 236037 432
82 principal claude-opus-5 622 239068 898
83 principal claude-opus-5 1446 239690 404
84 principal claude-opus-5 662 241136 916
85 principal claude-opus-5 1485 241798 1002
86 principal claude-opus-5 1344 243283 660
87 principal claude-opus-5 952 244627 2083
88 principal claude-opus-5 2137 245579 164
89 principal claude-opus-4-7 9652 29200 165
90 principal claude-opus-5 429 247716 465
91 principal claude-opus-4-7 0 38852 292
92 principal claude-opus-5 765 248145 110
93 principal claude-opus-5 1874 248910 635
94 principal claude-opus-5 1259 250784 213
95 principal claude-opus-5 999 252043 152
96 principal claude-opus-4-7 21186 38852 7819
97 principal claude-opus-4-7 9324 60038 1597
98 principal claude-opus-5 585 253042 6464
99 principal claude-opus-5 6653 253627 1307
100 principal claude-opus-4-7 21313 38852 11395
101 principal claude-opus-5 1637 260280 526
102 principal claude-opus-5 904 261917 100
103 principal claude-opus-5 470 262821 670
104 principal claude-opus-5 806 263291 145
105 principal claude-opus-5 623 264097 315
106 principal claude-opus-5 551 264720 1037
107 principal claude-opus-5 1139 265271 1688
-->
<!-- /cout -->
