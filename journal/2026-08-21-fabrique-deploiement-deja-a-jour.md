# 2026-08-21 — fabrique/deploiement-deja-a-jour

Branche : `fabrique/deploiement-deja-a-jour`
Périmètre : `fabrique` — `.github/workflows/build.yml` (job `deploy`, job
`outillage`) et un `test-deploiement.sh` neuf. Aucune app touchee. Rayon de
souffle : la mise en ligne de la stack entiere.
Mode : `chaud`

## Anomalies

### 1. Le verdict de mise en ligne accusait le serveur d'une panne inexistante

**Symptome** — le 21 aout 2026, la fusion de #159 a deploye pour de bon a 13:49 :
les dix images tirees, tous les conteneurs recrees et redemarres, `success: true`
dans la reponse. Un declenchement manuel « toutes », lance quatre minutes plus
tard par prudence, a recu de dockhand :

```
{"success":true,"output":"No changes detected, skipping redeploy","skipped":true}
```

— ce qui etait **exact** : la stack etait deja sur ce commit. Le job a pourtant
rougi, en affichant :

> dockhand a saute le deploiement alors que compose.yaml a change sur main.
> Il n'a pas vu la poussee : verifie que la stack suit bien la branche main de
> ce depot, et que son clone n'est pas bloque (le conteneur dockhand doit
> resoudre github.com).

Soit une accusation precise et fausse contre une infrastructure saine, au moment
meme ou la livraison venait de reussir.

**Cause** — le controle reposait sur une premisse ecrite en toutes lettres dans
son commentaire : « on n'arrive ici qu'avec un `compose.yaml` qui a bel et bien
change et ete pousse — un saut ne peut donc plus vouloir dire *rien a faire* ».
Cette premisse etait **fausse sur presque tous les chemins d'entree**.

`webhook=true` n'est pose qu'a UN endroit : la fonction `repli()` de l'etape
precedente. Or `repli()` est appelee dans sept situations, et cinq d'entre elles
abandonnent **avant d'avoir compare quoi que ce soit** — secret `DOCKHAND_URL`
absent, secret `DOCKHAND_TOKEN` absent, identifiant de pile illisible, commit
precedent inconnu (`github.event.before` est **vide** sur un declenchement
manuel : c'est le cas exact du 21 aout), et jusqu'a « compose.yaml identique au
commit precedent » — celui-la annoncant explicitement le contraire de la
premisse. Deux seulement l'etablissent : un changement de structure, et des
conteneurs absents de l'hote.

Le controle etait donc juste dans deux cas sur sept, et calomnieux dans cinq.

**Detecte par** — `CI`

**Action** — `garde-fou` — `repli()` transmet desormais s'il a **etabli** qu'il y
a quelque chose a deployer, et le verdict s'y adosse. Etabli et dockhand saute :
echec, message inchange, le garde-fou d'origine est intact. Non etabli : ce n'est
plus un echec — mais pas un silence non plus. Deux avertissements disent que
dockhand se considere deja a jour, que c'est normal apres un deploiement qui
vient d'avoir lieu, et **ou regarder si ce n'est pas vrai** : `./scripts/prod.sh`.

Le defaut de fond n'est pas la severite, c'est la **premisse tenue pour acquise**.
Un controle qui affirme « on n'arrive ici que si X » sans que rien ne garantisse
X ne verifie pas X : il le suppose, et rend un verdict precis sur une supposition.
Precis et faux se lit exactement comme precis et vrai — c'est le vert silencieux
retourne, un ROUGE silencieux, et il coute la meme chose : on cesse de croire le
controle. La regle : **un message d'erreur qui nomme une cause doit nommer une
cause ETABLIE, ou dire qu'il ne sait pas.**

### 2. Ce verdict n'avait aucun test, et ne pouvait pas en avoir par relecture

**Symptome** — le defaut ci-dessus vivait dans du shell inline au milieu d'un
YAML. Il n'a jamais tourne ailleurs qu'en integration continue. Aucune relecture
ne pouvait le voir : le commentaire etait cohérent, le code faisait ce que le
commentaire disait, et c'est la premisse — invisible depuis le bloc — qui etait
fausse.

**Cause** — ses trois entrees (code HTTP, corps rendu par dockhand, et ce que
l'etape precedente a etabli) ne se combinent **jamais toutes** sur un run reel.
Un run donne exerce un point de l'espace ; le defaut vivait dans un autre.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `test-deploiement.sh`, sixieme script de la matrice
`outillage`, onze cas. Il **extrait** le bloc de `build.yml` et l'execute tel
quel : pas de recopie, qui se desynchroniserait au premier changement et
continuerait a rendre vert. Ses deux bornes d'extraction sont verifiees — si
l'une disparait, il **s'arrete fort** au lieu de tester un bloc vide.

**Contre-epreuve, en deux temps, parce qu'un test qui n'a pas ete joue contre son
defaut ne prouve rien :**

1. **Contre le defaut** — l'ancien verdict remis en place, le test passe de 11/11
   a **6 reussis, 5 echecs**. Il mord.
2. **Contre lui-meme** — la borne d'extraction renommee, le test ne rend pas
   « 11 reussis » sur un bloc vide : il s'arrete en disant « borne trouvee 0 fois
   dans build.yml, attendu 1 ». C'est le piege classique de ce genre de test, et
   il valait d'etre joue : un harnais qui n'extrait plus rien passe au vert.

Un troisieme cas a d'ailleurs echoue au premier essai, et l'erreur etait dans le
TEST — un motif attendu ecrit `n avait` la ou le message dit `n'avait`. Trois
lignes rouges pour une apostrophe : c'est le prix normal d'un test qu'on joue
avant de le croire.

### 3. La livraison app par app n'a JAMAIS tourne — deux secrets manquent

**Symptome** — en lisant le journal du job `deploy` pour diagnostiquer
l'anomalie 1, cette ligne :

```
##[warning]livraison unitaire ecartee — secret DOCKHAND_URL absent
le deploiement repasse par le webhook : TOUTE la stack sera recreee
```

`DOCKHAND_URL` et `DOCKHAND_TOKEN` sont vides dans l'environnement du job.

**Cause** — le mecanisme qui ne recree que les conteneurs dont l'image a bouge a
besoin de ces deux secrets pour interroger dockhand. Sans eux, il se replie sur
le webhook — et le webhook fait `docker compose up -d --remove-orphans
**--force-recreate**`, verifie dans la reponse du 21 aout : les douze conteneurs
recrees et redemarres, y compris les bases de donnees et le cache, y compris les
apps que rien n'avait touchees.

Le `README` decrit pourtant le chemin unitaire comme le chemin NORMAL, et le
deploiement complet comme le repli reserve aux changements de structure. **C'est
l'inverse qui se produit, a chaque mise en ligne, depuis que ce code existe.**
Chaque fusion coute donc quelques secondes d'indisponibilite a TOUTES les apps,
la ou une seule aurait du redemarrer.

Le mecanisme se signale — un `::warning::`, pas un `::error::` —, et c'est
defendable : ce qui empeche la livraison unitaire ne doit jamais empecher la
LIVRAISON. Mais un avertissement dans un journal de job que personne n'ouvre
quand tout est vert, c'est la definition du vert silencieux : le comportement
documente n'a jamais eu lieu, et rien ne l'a dit pendant des semaines.

**Detecte par** — `production`

**Action** — `arbitrage` — rien n'est corrige ici, et **ce n'est pas un oubli** :
le remede est de poser deux valeurs de secret, ce qui n'appartient pas a ce
depot. Le contrat le dit — « seule exception, les VALEURS des secrets : tu ecris
le nom dans `env:` et dans ton `README`, l'infrastructure injecte la valeur ».
Les deux noms sont deja declares et deja lus ; il ne manque que le contenu.

Ce qui se decide, et qui n'est pas a moi : **si ces secrets ne doivent jamais
etre poses**, alors le chemin unitaire est du code mort et le `README` decrit une
fabrique qui n'existe pas — les deux se retirent. **S'ils doivent l'etre**, alors
l'absence merite mieux qu'un avertissement : un deploiement complet subi, alors
qu'un deploiement cible etait prevu, devrait se voir sans ouvrir un journal.

Piste pour qui tranchera : le seul controle qui puisse le dire aujourd'hui est
`./scripts/prod.sh`, et il montre l'etat, pas la maniere dont on y est arrive.


### 4. Le correctif desarmait le garde-fou qu'il pretendait garder intact

**Symptome** — la relecture, sur le diff de l'anomalie 1 : « le nouveau garde-fou
`etabli=oui` est **inatteignable en production** ». Le commit affirmait pourtant
« etabli et dockhand saute : echec, message inchange, le garde-fou d'origine est
intact ». C'etait faux.

**Cause** — l'ORDRE des controles dans l'etape `unitaire`. Les deux seuls appels
qui posent `etabli=oui` viennent apres les tests de secrets. Or ces secrets sont
vides sur ce depot depuis toujours (anomalie 3) : le script sortait donc au tout
premier `repli`, `etabli` valait `non` a chaque run, et le code capable de le
mettre a `oui` n'etait **jamais atteint**.

Consequence exacte : le jour ou dockhand cesse reellement de voir la poussee —
la panne de resolution du 6 aout 2026, celle pour laquelle ce garde-fou a ete
ecrit —, `skipped: true` arrive, `ETABLI` vaut `non` par construction, et le job
rend un avertissement **vert**. J'avais echange un rouge trompeur contre un vert
trompeur, dans le seul scenario ou le controle servait a quelque chose.

**Detecte par** — `relecture`

**Action** — `garde-fou` — la relecture proposait de le documenter. Documenter un
faux vert le laisse en place : ce qui est corrige, c'est **l'ordre**. Tout ce qui
s'etablit avec le seul `git` — le commit precedent est-il connu, `compose.yaml`
a-t-il bouge, et ailleurs que sur des lignes `image:` — passe desormais AVANT le
premier controle qui depend d'un secret. La preuve se fait sans rien demander a
personne ; les secrets ne servent qu'a la livraison ciblee, et leur absence
n'enleve rien a ce qui vient d'etre etabli. `repli()` emporte la valeur courante
au lieu d'une constante, pour qu'aucun repli en aval ne la perde.

Cinq cas neufs gardent cet ordre, parce qu'un ordre correct ne se voit dans aucun
diff futur : `ETABLI=oui` doit precede les trois controles a secret, `non` doit
preceder `oui`, et le defaut de `repli()` doit etre la variable et non la chaine.
Joues contre le defaut : les secrets remontes au-dessus de la preuve, deux cas
rougissent ; la constante restauree dans `repli()`, un troisieme. Les onze cas de
l'anomalie 2 restaient tous verts pendant ce temps — aucun ne regarde COMMENT
`etabli` est calcule, seulement ce qu'on en fait.

**Ce que ce cas apprend, et qui depasse ce fichier** — les onze premiers cas
testaient le verdict ; le defaut etait dans ce qui l'ALIMENTE. Un test qui couvre
la decision ne couvre pas la chaine qui lui fournit ses entrees, et un correctif
qui deplace une garantie sans deplacer ses tests laisse les deux d'accord sur un
perimetre vide. C'est le troisieme correctif de la journee a etre rattrape par un
relecteur apres etre passe par des tests verts — et le troisieme dont l'auteur
avait ecrit noir sur blanc qu'il etait sain.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 14:49 UTC, sur 3 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 5 436 | 0,01 $ |
| Écriture de cache | 5 888 513 | 27,39 $ |
| Lecture de cache | 270 296 847 | 121,38 $ |
| Sortie | 63 465 | 1,12 $ |
| **Total** | **276 254 261** | **149,91 $ — 130,18 €** |

**Ce qui coûte**

- **1762 appel(s) au modèle** — un par réponse, outils compris —, dont 1208 par des sous-agents — 93 338 688 jetons, 46,01 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 847 jetons, écrits une fois par session puis relus à chaque
  échange : 36 413 391 jetons de relecture, 13 % de tout ce qui a été relu.
- **Tours courts** — 1 520 des 1 762 tours (86 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 144,28 $, soit 96 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 847 jetons relus au premier appel qui relise
  quelque chose, 352 261 au dernier : une session longue se paie à chaque tour.
- **Écarté** — 1 autre(s) branche(s) travaillée(s) dans ce conteneur,
  72 074 396 jetons, qui ne sont pas ceux de celle-ci.

<!-- cout-total: 276254261 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65847 0 0
2 principal claude-opus-5 7118 65847 0
3 principal claude-opus-5 3536 72965 0
4 principal claude-opus-5 5441 76501 0
5 principal claude-opus-5 3478 81942 0
6 principal claude-opus-5 3070 85420 0
7 principal claude-opus-5 2360 88490 0
8 principal claude-opus-5 4234 90850 0
9 principal claude-opus-5 4011 95084 0
10 principal claude-opus-5 3583 99095 0
11 principal claude-opus-5 3026 102678 0
12 principal claude-opus-5 66 106521 0
13 principal claude-opus-5 1948 106587 0
14 principal claude-opus-5 6656 110665 0
15 principal claude-opus-5 4265 117321 0
16 principal claude-opus-5 1354 121586 0
17 principal claude-opus-5 1684 122940 0
18 principal claude-opus-5 13537 124624 0
19 principal claude-opus-5 1237 138161 0
20 principal claude-opus-5 379 139398 0
21 principal claude-opus-5 413 139777 0
22 principal claude-opus-5 1448 140190 0
23 principal claude-opus-5 6643 142896 0
24 principal claude-opus-5 692 149539 0
25 principal claude-opus-5 620 150231 0
26 principal claude-opus-5 399 150851 0
27 principal claude-opus-5 2320 151250 0
28 principal claude-opus-5 454 153570 0
29 principal claude-opus-5 1321 154024 0
30 principal claude-opus-5 583 155345 0
31 principal claude-opus-5 481 155928 0
32 principal claude-opus-5 9848 156409 0
33 principal claude-opus-5 470 166257 0
34 principal claude-opus-5 815 166727 0
35 principal claude-opus-5 566 167542 0
36 principal claude-opus-5 317 168108 0
37 principal claude-opus-5 626 168425 0
38 principal claude-opus-5 770 169051 0
39 principal claude-opus-5 272 169821 0
40 principal claude-opus-5 1471 170093 0
41 principal claude-opus-5 528 171564 0
42 principal claude-opus-5 2455 172092 0
43 principal claude-opus-5 1021 174547 0
44 principal claude-opus-5 1454 175568 0
45 principal claude-opus-5 1621 177022 0
46 principal claude-opus-5 1822 178643 0
47 principal claude-opus-5 1770 180465 0
48 principal claude-opus-5 2892 182235 0
49 principal claude-opus-5 3892 185127 0
50 principal claude-opus-5 1865 189019 0
51 principal claude-opus-5 6649 192116 0
52 principal claude-opus-5 1819 198765 0
53 principal claude-opus-5 13441 200584 0
54 principal claude-opus-5 1221 214025 0
55 principal claude-opus-5 1606 215246 0
56 principal claude-opus-5 6744 216852 0
57 principal claude-opus-5 1154 223596 0
58 principal claude-opus-5 639 224750 0
59 principal claude-opus-5 818 225389 0
60 principal claude-opus-5 192 226207 0
61 principal claude-opus-5 601 226399 0
62 principal claude-opus-5 1211 227000 0
63 principal claude-opus-5 1651 228211 0
64 principal claude-opus-5 3790 229862 0
65 principal claude-opus-5 912 233652 0
66 principal claude-opus-5 1247 234564 0
67 principal claude-opus-5 546 235811 0
68 principal claude-opus-5 827 236357 0
69 principal claude-opus-5 7588 237184 0
70 principal claude-opus-5 1518 244772 0
71 principal claude-opus-5 6645 246290 0
72 principal claude-opus-5 1855 252935 0
73 principal claude-opus-5 335 254790 0
74 principal claude-opus-5 1224 255125 0
75 principal claude-opus-5 1130 256349 0
76 principal claude-opus-5 2632 257479 0
77 principal claude-opus-5 2639 260111 0
78 principal claude-opus-5 475 262750 0
79 principal claude-opus-5 878 263225 0
80 principal claude-opus-5 549 264103 0
81 principal claude-opus-5 3378 264652 0
82 principal claude-opus-5 367 268030 0
83 principal claude-opus-5 5119 264103 0
84 principal claude-opus-5 1117 269222 0
85 principal claude-opus-5 1719 270339 0
86 principal claude-opus-5 1126 272058 0
87 principal claude-opus-5 514 273184 0
88 principal claude-opus-5 1101 273698 0
89 principal claude-opus-5 1562 274799 0
90 principal claude-opus-5 2481 276361 0
91 principal claude-opus-5 926 278842 0
92 principal claude-opus-5 1946 279768 0
93 principal claude-opus-5 541 281714 0
94 principal claude-opus-5 508 282255 0
95 principal claude-opus-5 1453 282763 0
96 principal claude-opus-5 2681 284216 0
97 principal claude-opus-5 703 286897 0
98 principal claude-opus-5 813 287600 0
99 principal claude-opus-5 2486 288413 0
100 principal claude-opus-5 1497 290899 0
101 principal claude-opus-5 693 292396 0
102 principal claude-opus-5 686 293089 0
103 principal claude-opus-5 1103 293775 0
104 principal claude-opus-5 1422 294878 0
105 principal claude-opus-5 1741 296300 0
106 principal claude-opus-5 252659 46716 0
107 principal claude-opus-5 1933 299375 0
108 principal claude-opus-5 702 301308 0
109 principal claude-opus-5 1246 302010 0
110 principal claude-opus-5 1374 303256 0
111 principal claude-opus-5 1167 304630 0
112 principal claude-opus-5 1890 305797 0
113 principal claude-opus-5 827 307687 0
114 principal claude-opus-5 2219 308514 0
115 principal claude-opus-5 361 310733 0
116 principal claude-opus-5 1717 311094 0
117 principal claude-opus-5 9702 312811 0
118 principal claude-opus-5 1219 322513 0
119 principal claude-opus-5 1223 323732 0
120 principal claude-opus-5 930 324955 0
121 principal claude-opus-5 1046 325885 0
122 principal claude-opus-5 553 326931 0
123 principal claude-opus-5 1682 327484 0
124 principal claude-opus-5 695 329166 0
125 principal claude-opus-5 2808 329861 0
126 principal claude-opus-5 3655 332669 0
127 principal claude-opus-5 1203 336324 0
128 principal claude-opus-5 10684 329861 0
129 principal claude-opus-5 553 340545 0
130 principal claude-opus-5 317 341098 0
131 principal claude-opus-5 9769 341415 0
132 principal claude-opus-5 4184 351184 0
133 principal claude-opus-5 534 355368 0
134 principal claude-opus-5 649 355902 0
135 principal claude-opus-5 748 356551 0
136 principal claude-opus-5 2320 357299 0
137 principal claude-opus-5 602 359619 0
138 principal claude-opus-5 1999 360221 0
139 principal claude-opus-5 893 362220 0
140 principal claude-opus-5 1179 363113 0
141 principal claude-opus-5 1379 364292 0
142 principal claude-opus-5 1371 365671 0
143 principal claude-opus-5 4329 367042 0
144 principal claude-opus-5 458 371371 0
145 principal claude-opus-5 845 371829 0
146 principal claude-opus-5 2380 372674 0
147 principal claude-opus-5 1823 375054 0
148 principal claude-opus-5 901 376877 0
149 principal claude-opus-5 818 377778 0
150 principal claude-opus-5 613 378596 0
151 principal claude-opus-5 125 379209 0
152 principal claude-opus-5 585 379334 0
153 principal claude-opus-5 533 379919 0
154 principal claude-opus-5 862 380452 0
155 principal claude-opus-5 1865 381314 0
156 principal claude-opus-5 1958 383179 0
157 principal claude-opus-5 555 385137 0
158 principal claude-opus-5 1176 385692 0
159 principal claude-opus-5 1879 386868 0
160 principal claude-opus-5 519 388747 0
161 principal claude-opus-5 1787 389266 0
162 principal claude-opus-5 426 391053 0
163 principal claude-opus-5 672 391479 0
164 principal claude-opus-5 1143 392151 0
165 principal claude-opus-5 429 393294 0
166 principal claude-opus-5 1144 393723 0
167 principal claude-opus-5 1814 394867 0
168 principal claude-opus-5 436 396681 0
169 principal claude-opus-5 810 397117 0
170 principal claude-opus-5 3302 397927 0
171 principal claude-opus-5 991 401229 0
172 principal claude-opus-5 382 402220 0
173 principal claude-opus-5 1428 402220 0
174 principal claude-opus-5 2344 403648 0
175 principal claude-opus-5 720 405992 0
176 principal claude-opus-5 541 406712 0
177 principal claude-opus-5 1810 407253 0
178 principal claude-opus-5 1127 409063 0
179 principal claude-opus-5 5453 410190 0
180 principal claude-opus-5 9716 415643 0
181 principal claude-opus-5 1538 425359 0
182 principal claude-opus-5 470 426897 0
183 principal claude-opus-5 2447 427367 0
184 principal claude-opus-5 395 429814 0
185 principal claude-opus-5 333 430209 0
186 principal claude-opus-5 852 430542 0
187 principal claude-opus-5 2960 431394 0
188 principal claude-opus-5 965 434354 0
189 principal claude-opus-5 283 435319 0
190 principal claude-opus-5 2750 435319 0
191 principal claude-opus-5 2294 438069 0
192 principal claude-opus-5 1252 440363 0
193 principal claude-opus-5 472 441615 0
194 principal claude-opus-5 884 442087 0
195 principal claude-opus-5 911 442971 0
196 principal claude-opus-5 4743 443882 0
197 principal claude-opus-5 1340 448625 0
198 principal claude-opus-5 11613 442087 0
199 principal claude-opus-5 1152 453700 0
200 principal claude-opus-5 2943 454852 0
201 principal claude-opus-5 1787 457795 0
202 principal claude-opus-5 2834 459582 0
203 principal claude-opus-5 796 462416 0
204 principal claude-opus-5 301 463212 0
205 principal claude-opus-5 3168 463212 0
206 principal claude-opus-5 560 466380 0
207 principal claude-opus-5 1023 466940 0
208 principal claude-opus-5 2123 467963 0
209 principal claude-opus-5 607 470086 0
210 principal claude-opus-5 2652 470693 0
211 principal claude-opus-5 1359 473345 0
212 principal claude-opus-5 1655 474704 0
213 principal claude-opus-5 1613 476359 0
214 principal claude-opus-5 802 477972 0
215 principal claude-opus-5 1108 478774 0
216 principal claude-opus-5 1074 479882 0
217 principal claude-opus-5 607 480956 0
218 principal claude-opus-5 761 481563 0
219 principal claude-opus-5 929 482324 0
220 principal claude-opus-5 564 483253 0
221 principal claude-opus-5 431 483817 0
222 principal claude-opus-5 358 484248 0
223 principal claude-opus-5 2171 484606 0
224 principal claude-opus-5 5407 483817 0
225 principal claude-opus-5 470 489224 0
226 principal claude-opus-5 1386 489694 0
227 principal claude-opus-5 1084 491080 0
228 principal claude-opus-5 517 492164 0
229 principal claude-opus-5 836 492681 0
230 principal claude-opus-5 1272 493517 0
231 principal claude-opus-5 613 494789 0
232 principal claude-opus-5 692 495402 0
233 principal claude-opus-5 259 496094 0
234 principal claude-opus-5 554 496353 0
235 principal claude-opus-5 2720 496907 0
236 principal claude-opus-5 695 499627 0
237 principal claude-opus-5 259 500322 0
238 principal claude-opus-5 1191 500322 0
239 principal claude-opus-5 2816 501513 0
240 principal claude-opus-5 2739 504329 0
241 principal claude-opus-5 497 507068 0
242 principal claude-opus-5 732 507565 0
243 principal claude-opus-5 1306 508297 0
244 principal claude-opus-5 2444 509603 0
245 principal claude-opus-5 1191 512047 0
246 principal claude-opus-5 1241 513238 0
247 principal claude-opus-5 1199 514479 0
248 principal claude-opus-5 582 515678 0
249 principal claude-opus-5 733 516260 0
250 principal claude-opus-5 1583 516993 0
251 principal claude-opus-5 892 518576 0
252 principal claude-opus-5 2643 519468 0
253 principal claude-opus-5 873 522111 0
254 principal claude-opus-5 444 522984 0
255 principal claude-opus-5 1887 522984 0
256 principal claude-opus-5 3617 524871 0
257 principal claude-opus-5 1819 528488 0
258 principal claude-opus-5 1594 530617 0
259 principal claude-opus-5 737 532211 0
260 principal claude-opus-5 1176 532948 0
261 principal claude-opus-5 2006 534124 0
262 principal claude-opus-5 1328 536130 0
263 principal claude-opus-5 604 537458 0
264 principal claude-opus-5 2170 538062 0
265 principal claude-opus-5 4285 538062 0
266 principal claude-opus-5 620 542347 0
267 principal claude-opus-5 388 542967 0
268 principal claude-opus-5 1638 543355 0
269 principal claude-opus-5 1351 544993 0
270 principal claude-opus-5 2109 546344 0
271 principal claude-opus-5 547 548453 0
272 principal claude-opus-5 1406 549000 0
273 principal claude-opus-5 2180 550406 0
274 principal claude-opus-5 899 552586 0
275 principal claude-opus-5 1999 553485 0
276 principal claude-opus-5 664 555484 0
277 principal claude-opus-5 845 556148 0
278 principal claude-opus-5 631 556993 0
279 principal claude-opus-5 347 557624 0
280 principal claude-opus-5 1173 557624 0
281 principal claude-opus-5 607 558797 0
282 principal claude-opus-5 732 559404 0
283 principal claude-opus-5 820 560136 0
284 principal claude-opus-5 598 560956 0
285 principal claude-opus-5 1136 561554 0
286 principal claude-opus-5 1031 562690 0
287 principal claude-opus-5 456 563721 0
288 principal claude-opus-5 2630 564177 0
289 principal claude-opus-5 622 566807 0
290 principal claude-opus-5 135 567429 0
291 principal claude-opus-5 1054 567429 0
292 principal claude-opus-5 739 568483 0
293 principal claude-opus-5 3172 569222 0
294 principal claude-opus-5 1783 572394 0
295 principal claude-opus-5 1126 574177 0
296 principal claude-opus-5 1585 575303 0
297 principal claude-opus-5 2713 576888 0
298 principal claude-opus-5 1810 579601 0
299 principal claude-opus-5 1148 581411 0
300 principal claude-opus-5 1409 582559 0
301 principal claude-opus-5 1707 583968 0
302 principal claude-opus-5 746 585675 0
303 principal claude-opus-5 214 586421 0
304 principal claude-opus-5 1175 586421 0
305 principal claude-opus-5 497 587596 0
306 principal claude-opus-5 1010 588093 0
307 principal claude-opus-5 1395 589103 0
308 principal claude-opus-5 171 590498 0
309 principal claude-opus-5 3850 590669 0
310 principal claude-opus-5 1139 594519 0
311 principal claude-opus-5 838 595658 0
312 principal claude-opus-5 949 596496 0
313 principal claude-opus-5 1195 597445 0
314 principal claude-opus-5 454 598971 0
315 principal claude-opus-5 3031 599425 0
316 principal claude-opus-5 1174 602456 0
317 principal claude-opus-5 483 603630 0
318 principal claude-opus-5 2182 604113 0
319 principal claude-opus-5 1683 606295 0
320 principal claude-opus-5 2227 607978 0
321 principal claude-opus-5 650 610205 0
322 principal claude-opus-5 721 610855 0
323 principal claude-opus-5 559 611576 0
324 principal claude-opus-5 790 612135 0
325 principal claude-opus-5 1138 612925 0
326 principal claude-opus-5 224 614063 0
327 principal claude-opus-5 1588 614287 0
328 principal claude-opus-5 639 615875 0
329 principal claude-opus-5 684 616514 0
330 principal claude-opus-5 1907 617198 0
331 principal claude-opus-5 652 619105 0
332 principal claude-opus-5 998 619757 0
333 principal claude-opus-5 6663 620755 0
334 principal claude-opus-5 2249 627418 0
335 principal claude-opus-5 2033 629667 0
336 principal claude-opus-5 813 631700 0
337 principal claude-opus-5 756 632513 0
338 principal claude-opus-5 540 633269 0
339 principal claude-opus-5 4783 631745 0
340 principal claude-opus-5 549 636528 0
341 principal claude-opus-5 385 637077 0
342 principal claude-opus-5 366 637462 0
343 principal claude-opus-5 3547 637828 0
344 principal claude-opus-5 894 641375 0
345 principal claude-opus-5 240 642269 0
346 principal claude-opus-5 1257 642269 0
347 principal claude-opus-5 370 643526 0
348 principal claude-opus-5 902 644748 0
349 principal claude-opus-5 494 645650 0
350 principal claude-opus-5 1988 646144 0
351 principal claude-opus-5 2354 648132 0
352 principal claude-opus-5 2139 650486 0
353 principal claude-opus-5 2315 652625 0
354 principal claude-opus-5 29900 37470 0
355 principal claude-opus-5 716 67370 0
356 principal claude-opus-5 4302 68086 0
357 principal claude-opus-5 4251 72388 0
358 principal claude-opus-5 348 76639 0
359 principal claude-opus-5 2787 76987 0
360 principal claude-opus-5 454 79774 0
361 principal claude-opus-5 4941 80228 0
362 principal claude-opus-5 3194 85169 0
363 principal claude-opus-5 4631 88363 0
364 principal claude-opus-5 591 92994 0
365 principal claude-opus-5 293 93585 0
366 principal claude-opus-5 394 93878 0
367 principal claude-opus-5 2006 94272 0
368 principal claude-opus-5 347 96278 0
369 principal claude-opus-5 977 96625 0
370 principal claude-opus-5 563 97602 0
371 principal claude-opus-5 1709 98165 0
372 principal claude-opus-5 552724 0 0
373 principal claude-opus-5 1906 552724 0
374 principal claude-opus-5 1302 554630 0
375 principal claude-opus-5 2244 555932 0
376 principal claude-opus-5 863 558176 0
377 principal claude-opus-5 416 559039 0
378 principal claude-opus-5 1290 559039 0
379 principal claude-opus-5 185 560329 0
380 principal claude-opus-5 132355 0 0
381 principal claude-opus-5 340 132355 0
382 principal claude-opus-5 1420 132695 0
383 principal claude-opus-5 589 134115 0
384 principal claude-opus-5 1418 134704 0
385 principal claude-opus-5 568 136122 0
386 principal claude-opus-5 728 136690 0
387 principal claude-opus-5 345 137418 0
388 principal claude-opus-5 539 137763 0
389 principal claude-opus-5 690 138302 0
390 principal claude-opus-5 1491 138992 0
391 principal claude-opus-5 1717 140483 0
392 principal claude-opus-5 444 142200 0
393 principal claude-opus-5 7615 143257 0
394 principal claude-opus-5 1519 150872 0
395 principal claude-opus-5 1146 152391 0
396 principal claude-opus-5 50 156394 0
397 principal claude-opus-5 1605 156444 0
398 principal claude-opus-5 1282 158049 0
399 principal claude-opus-5 1168 159331 0
400 principal claude-opus-5 2205 160499 0
401 principal claude-opus-5 921 162704 0
402 principal claude-opus-5 1601 163625 0
403 principal claude-opus-5 901 165226 0
404 principal claude-opus-5 376 166127 0
405 principal claude-opus-5 3768 166503 0
406 principal claude-opus-5 354 170271 0
407 principal claude-opus-5 5516 166127 0
408 principal claude-opus-5 803 171643 0
409 principal claude-opus-5 349 172985 0
410 principal claude-opus-5 709 173334 0
411 principal claude-opus-5 907 174043 0
412 principal claude-opus-5 3951 174950 0
413 principal claude-opus-5 1630 178901 0
414 principal claude-opus-5 739 180531 0
415 principal claude-opus-5 1343 181270 0
416 principal claude-opus-5 1123 182613 0
417 principal claude-opus-5 3999 183736 0
418 principal claude-opus-5 3676 187735 0
419 principal claude-opus-5 450 191411 0
420 principal claude-opus-5 1391 192891 0
421 principal claude-opus-5 602 194282 0
422 principal claude-opus-5 525 195002 0
423 principal claude-opus-5 1189 195527 0
424 principal claude-opus-5 30293 38013 0
425 principal claude-opus-5 3079 68306 0
426 principal claude-opus-5 4093 71385 0
427 principal claude-opus-5 1321 75478 0
428 principal claude-opus-5 2230 76799 0
429 principal claude-opus-5 1003 79385 0
430 principal claude-opus-5 1659 80388 0
431 principal claude-opus-5 8629 82047 0
432 principal claude-opus-5 1022 90676 0
433 principal claude-opus-5 9072 92356 0
434 principal claude-opus-5 13509 102108 0
435 principal claude-opus-5 15151 115617 0
436 principal claude-opus-5 9413 130768 0
437 principal claude-opus-5 3937 140181 0
438 principal claude-opus-5 2536 144118 0
439 principal claude-opus-5 966 146654 0
440 principal claude-opus-5 3212 147620 0
441 principal claude-opus-5 4598 150832 0
442 principal claude-opus-5 1710 155430 0
443 principal claude-opus-5 998 157140 0
444 principal claude-opus-5 1446 158138 0
445 principal claude-opus-5 1023 159584 0
446 principal claude-opus-5 8068 160607 0
447 principal claude-opus-5 3164 168675 0
448 principal claude-opus-5 1715 171839 0
449 principal claude-opus-5 855 173554 0
450 principal claude-opus-5 870 174409 0
451 principal claude-opus-5 2381 175279 0
452 principal claude-opus-5 1380 177660 0
453 principal claude-opus-5 3994 179040 0
454 principal claude-opus-5 1122 183034 0
455 principal claude-opus-5 1342 184156 0
456 principal claude-opus-5 958 185498 0
457 principal claude-opus-5 2541 186456 0
458 principal claude-opus-5 1391 188997 0
459 principal claude-opus-5 418 190388 0
460 principal claude-opus-5 1482 190806 0
461 principal claude-opus-5 1229 192288 0
462 principal claude-opus-5 795 193517 0
463 principal claude-opus-5 953 194312 0
464 principal claude-opus-5 1377 195265 0
465 principal claude-opus-5 1483 196642 0
466 principal claude-opus-5 2334 198125 0
467 principal claude-opus-5 1802 200459 0
468 principal claude-opus-5 949 202261 0
469 principal claude-opus-5 842 203210 0
470 principal claude-opus-5 1252 204052 0
471 principal claude-opus-5 703 205304 0
472 principal claude-opus-5 390 206007 0
473 principal claude-opus-5 977 206397 0
474 principal claude-opus-5 986 207374 0
475 principal claude-opus-5 405 208360 0
476 principal claude-opus-5 37 209623 0
477 principal claude-opus-5 4272 209660 0
478 principal claude-opus-5 4338 213932 0
479 principal claude-opus-5 5630 218270 0
480 principal claude-opus-5 1129 223900 0
481 principal claude-opus-5 1480 225029 0
482 principal claude-opus-5 350 226509 0
483 principal claude-opus-5 1390 226859 0
484 principal claude-opus-5 793 228249 0
485 principal claude-opus-5 2302 229042 0
486 principal claude-opus-5 2357 231344 0
487 principal claude-opus-5 1029 233701 0
488 principal claude-opus-5 3925 234730 0
489 principal claude-opus-5 2286 238655 0
490 principal claude-opus-5 723 240941 0
491 principal claude-opus-5 1541 241664 0
492 principal claude-opus-5 1495 243205 0
493 principal claude-opus-5 1907 244700 0
494 principal claude-opus-5 2208 246607 0
495 principal claude-opus-5 1802 248815 0
496 principal claude-opus-5 615 250617 0
497 principal claude-opus-5 1012 251232 0
498 principal claude-opus-5 2106 252244 0
499 principal claude-opus-5 695 254350 0
500 principal claude-opus-5 1365 255045 0
501 principal claude-opus-5 702 256410 0
502 principal claude-opus-5 1835 257112 0
503 principal claude-opus-5 6764 258947 0
504 principal claude-opus-5 1332 265711 0
505 principal claude-opus-5 1167 267017 413
506 principal claude-opus-5 1474 268184 1576
507 principal claude-opus-5 1737 269658 646
508 principal claude-opus-5 6465 272041 240
509 principal claude-opus-5 2144 278506 152
510 principal claude-opus-5 1905 280650 586
511 principal claude-opus-5 2205 282555 2289
512 principal claude-opus-5 2348 284760 160
513 principal claude-opus-5 15691 287108 2601
514 principal claude-opus-5 3278 302799 1205
515 principal claude-opus-5 1366 306077 888
516 principal claude-opus-5 924 307443 1972
517 principal claude-opus-5 2014 308367 1348
518 principal claude-opus-5 2463 310381 732
519 principal claude-opus-5 1969 312844 455
520 principal claude-opus-5 2316 314813 3175
521 principal claude-opus-5 3926 317129 282
522 principal claude-opus-5 663 321055 1192
523 principal claude-opus-5 1455 321718 479
524 principal claude-opus-5 1817 323173 1381
525 principal claude-opus-5 1503 324990 289
526 principal claude-opus-5 1405 326493 3548
527 principal claude-opus-5 3624 327898 130
528 principal claude-opus-5 498 331522 323
529 principal claude-opus-5 426 332020 180
530 principal claude-opus-5 308 332446 2316
531 principal claude-opus-4-7 10471 29200 136
532 principal claude-opus-4-7 222 39671 93
533 principal claude-opus-4-7 280 39893 82
534 principal claude-opus-4-7 3452 40173 84
535 principal claude-opus-4-7 22914 43625 128
536 principal claude-opus-4-7 0 39671 206
537 principal claude-opus-4-7 292 39671 93
538 principal claude-opus-4-7 280 39963 82
539 principal claude-opus-4-7 3452 40243 84
540 principal claude-opus-4-7 22914 43695 128
541 principal claude-opus-5 2558 332754 1949
542 principal claude-opus-4-7 11286 66539 5279
543 principal claude-opus-4-7 11286 66609 8311
544 principal claude-opus-4-7 8380 77895 153
545 principal claude-opus-4-7 668 86275 1529
546 principal claude-opus-5 2483 335312 585
547 principal claude-opus-5 2867 338380 2126
548 principal claude-opus-5 3505 341247 2471
549 principal claude-opus-5 3493 344752 1699
550 principal claude-opus-5 1829 348245 104
551 principal claude-opus-5 285 350074 375
552 principal claude-opus-5 676 350359 836
553 principal claude-opus-5 1226 351035 1576
554 principal claude-opus-5 1862 352261 175
555 agent claude-haiku-4-5-20251001 12845 0 4
556 agent claude-haiku-4-5-20251001 1502 12845 2
557 agent claude-haiku-4-5-20251001 610 14347 1
558 agent claude-haiku-4-5-20251001 404 14957 1
559 agent claude-haiku-4-5-20251001 16043 0 2
560 agent claude-haiku-4-5-20251001 830 16043 2
561 agent claude-haiku-4-5-20251001 725 16873 4
562 agent claude-haiku-4-5-20251001 1409 17598 3
563 agent claude-haiku-4-5-20251001 296 19007 2
564 agent claude-haiku-4-5-20251001 225 19303 2
565 agent claude-opus-5 13868 17190 1
566 agent claude-opus-5 4698 31058 1
567 agent claude-opus-5 3235 35756 5
568 agent claude-opus-5 10015 38991 3
569 agent claude-opus-5 5721 49006 3
570 agent claude-opus-5 5621 54727 8
571 agent claude-opus-5 2274 60348 5
572 agent claude-opus-5 800 62622 3
573 agent claude-opus-5 2258 63422 3
574 agent claude-opus-5 460 65680 0
575 agent claude-opus-5 4178 66140 5
576 agent claude-opus-5 199 70318 6
577 agent claude-opus-5 852 70517 3
578 agent claude-opus-5 613 71369 17
579 agent claude-opus-5 789 71982 17
580 agent claude-opus-5 2724 72771 3
581 agent claude-opus-5 2216 75495 2
582 agent claude-opus-5 2691 77711 17
583 agent claude-opus-5 3520 80402 3
584 agent claude-opus-5 2736 83922 20
585 agent claude-opus-5 3348 86658 4
586 agent claude-opus-5 2035 90006 3
587 agent claude-opus-5 2791 92041 2
588 agent claude-opus-5 1052 94832 2
589 agent claude-opus-5 655 95884 0
590 agent claude-opus-5 227 96539 17
591 agent claude-opus-5 2154 96766 2
592 agent claude-opus-5 1475 98920 10
593 agent claude-opus-5 4318 100395 2
594 agent claude-opus-5 1613 104713 17
595 agent claude-opus-5 1556 106326 2
596 agent claude-opus-5 2005 107882 20
597 agent claude-opus-5 1014 109887 2
598 agent claude-opus-5 2541 110901 17
599 agent claude-opus-5 809 113442 3
600 agent claude-opus-5 1991 114251 2
601 agent claude-opus-5 1108 116242 17
602 agent claude-opus-5 1040 117350 3
603 agent claude-opus-5 1170 118390 3
604 agent claude-opus-5 1240 119560 20
605 agent claude-opus-5 415 120800 3
606 agent claude-opus-5 5090 121215 2
607 agent claude-opus-5 1266 126305 21
608 agent claude-opus-5 543 127571 17
609 agent claude-opus-5 910 128114 17
610 agent claude-opus-5 447 129024 16
611 agent claude-opus-5 552 129471 4
612 agent claude-opus-5 1118 130023 3
613 agent claude-opus-5 636 131141 17
614 agent claude-opus-5 706 131777 4
615 agent claude-opus-5 887 132483 4
616 agent claude-opus-5 836 133370 4
617 agent claude-opus-5 584 134206 20
618 agent claude-opus-5 405 134790 17
619 agent claude-opus-5 5031 135195 3
620 agent claude-opus-5 1417 140226 3
621 agent claude-opus-5 1228 141643 17
622 agent claude-opus-5 1296 142871 3
623 agent claude-opus-5 660 144167 5
624 agent claude-opus-5 286 144827 0
625 agent claude-opus-5 906 145113 16
626 agent claude-opus-5 1622 146019 2
627 agent claude-opus-5 1266 147641 9
628 agent claude-opus-5 890 148907 3
629 agent claude-opus-5 1038 149797 20
630 agent claude-opus-5 434 150835 2
631 agent claude-opus-5 486 151269 17
632 agent claude-opus-5 645 151755 2
633 agent claude-opus-5 4909 152400 2
634 agent claude-opus-5 17051 157309 17
635 agent claude-opus-5 608 174360 4
636 agent claude-opus-5 645 174968 21
637 agent claude-opus-5 1785 175613 3
638 agent claude-opus-5 6109 177398 14
639 agent claude-opus-5 623 183507 3
640 agent claude-opus-5 770 184130 6
641 agent claude-opus-5 201 184900 16
642 agent claude-opus-5 6536 185101 5
643 agent claude-opus-5 750 191637 17
644 agent claude-opus-5 1018 192387 3
645 agent claude-opus-5 829 193405 17
646 agent claude-opus-5 191 194234 1
647 agent claude-sonnet-5 18223 0 3
648 agent claude-sonnet-5 2205 18223 2
649 agent claude-sonnet-5 4028 20428 4
650 agent claude-sonnet-5 7759 24456 6
651 agent claude-sonnet-5 2919 32215 7
652 agent claude-sonnet-5 1182 35134 3
653 agent claude-sonnet-5 808 36316 2
654 agent claude-sonnet-5 1750 37124 4
655 agent claude-sonnet-5 1294 38874 3
656 agent claude-sonnet-5 12324 40168 9
657 agent claude-sonnet-5 2098 52492 7
658 agent claude-sonnet-5 3186 54590 20
659 agent claude-sonnet-5 211 57776 20
660 agent claude-sonnet-5 723 57987 5
661 agent claude-sonnet-5 565 58710 3
662 agent claude-sonnet-5 1458 59275 3
663 agent claude-sonnet-5 743 60733 20
664 agent claude-sonnet-5 203 61476 2
665 agent claude-sonnet-5 561 61679 2
666 agent claude-sonnet-5 1192 62240 14
667 agent claude-sonnet-5 218 63432 5
668 agent claude-sonnet-5 17627 63650 6
669 agent claude-sonnet-5 3020 81277 3
670 agent claude-sonnet-5 374 84297 8
671 agent claude-sonnet-5 3322 84671 4
672 agent claude-sonnet-5 3497 87993 3
673 agent claude-sonnet-5 23276 91490 3
674 agent claude-sonnet-5 608 114766 2
675 agent claude-sonnet-5 695 115374 8
676 agent claude-sonnet-5 751 116069 3
677 agent claude-sonnet-5 293 116820 2
678 agent claude-sonnet-5 2259 117113 20
679 agent claude-sonnet-5 1187 119372 3
680 agent claude-sonnet-5 1605 120559 3
681 agent claude-sonnet-5 1526 122164 2
682 agent claude-sonnet-5 2373 123690 2
683 agent claude-sonnet-5 624 126063 4
684 agent claude-sonnet-5 576 126687 2
685 agent claude-sonnet-5 7985 127263 3
686 agent claude-sonnet-5 6403 135248 8
687 agent claude-sonnet-5 295 141651 20
688 agent claude-sonnet-5 171 141946 3
689 agent claude-sonnet-5 10179 7828 2
690 agent claude-sonnet-5 4180 18007 2
691 agent claude-sonnet-5 308 22187 2
692 agent claude-sonnet-5 409 22495 20
693 agent claude-sonnet-5 394 22904 2
694 agent claude-sonnet-5 188 23298 0
695 agent claude-sonnet-5 820 23486 2
696 agent claude-sonnet-5 399 24306 5
697 agent claude-sonnet-5 866 24705 1
698 agent claude-sonnet-5 199 25571 20
699 agent claude-sonnet-5 142 25770 1
700 agent claude-haiku-4-5-20251001 12939 0 4
701 agent claude-haiku-4-5-20251001 1360 12939 2
702 agent claude-haiku-4-5-20251001 692 14299 2
703 agent claude-haiku-4-5-20251001 533 14991 2
704 agent claude-haiku-4-5-20251001 1092 15524 2
705 agent claude-haiku-4-5-20251001 379 16616 4
706 agent claude-haiku-4-5-20251001 602 16995 1
707 agent claude-sonnet-5 6975 11475 4
708 agent claude-sonnet-5 3724 18450 4
709 agent claude-sonnet-5 2748 22174 2
710 agent claude-sonnet-5 749 24922 2
711 agent claude-sonnet-5 2387 25671 20
712 agent claude-sonnet-5 1393 28058 5
713 agent claude-sonnet-5 1647 29451 2
714 agent claude-sonnet-5 1991 31098 3
715 agent claude-sonnet-5 708 33089 8
716 agent claude-sonnet-5 2348 33797 7
717 agent claude-sonnet-5 3499 36145 3
718 agent claude-sonnet-5 1063 39644 4
719 agent claude-sonnet-5 1060 40707 3
720 agent claude-sonnet-5 716 41767 0
721 agent claude-sonnet-5 421 42483 9
722 agent claude-sonnet-5 3680 42904 8
723 agent claude-sonnet-5 2021 46584 5
724 agent claude-sonnet-5 881 48605 5
725 agent claude-sonnet-5 365 49486 2
726 agent claude-sonnet-5 681 49851 4
727 agent claude-sonnet-5 6121 50532 2
728 agent claude-sonnet-5 1211 56653 2
729 agent claude-sonnet-5 2884 57864 2
730 agent claude-sonnet-5 229 60748 20
731 agent claude-sonnet-5 1244 60977 3
732 agent claude-sonnet-5 2406 62221 3
733 agent claude-sonnet-5 333 64627 20
734 agent claude-sonnet-5 355 64960 3
735 agent claude-sonnet-5 397 65315 5
736 agent claude-sonnet-5 1328 65712 3
737 agent claude-sonnet-5 2735 67040 7
738 agent claude-sonnet-5 1062 69775 3
739 agent claude-sonnet-5 2308 70837 2
740 agent claude-sonnet-5 607 73145 20
741 agent claude-sonnet-5 367 73752 2
742 agent claude-sonnet-5 527 74119 6
743 agent claude-sonnet-5 1065 74646 17
744 agent claude-sonnet-5 527 75711 17
745 agent claude-sonnet-5 378 76238 17
746 agent claude-sonnet-5 385 76616 2
747 agent claude-sonnet-5 565 77001 2
748 agent claude-sonnet-5 449 77566 2
749 agent claude-sonnet-5 913 78015 0
750 agent claude-sonnet-5 209 78928 5
751 agent claude-sonnet-5 311 79137 2
752 agent claude-sonnet-5 258 79448 3
753 agent claude-haiku-4-5-20251001 13111 0 4
754 agent claude-haiku-4-5-20251001 1989 13111 2
755 agent claude-haiku-4-5-20251001 661 15100 1
756 agent claude-haiku-4-5-20251001 596 15761 2
757 agent claude-haiku-4-5-20251001 715 16357 4
758 agent claude-haiku-4-5-20251001 2012 17072 3
759 agent claude-haiku-4-5-20251001 292 19084 4
760 agent claude-sonnet-5 7082 11475 3
761 agent claude-sonnet-5 4116 18557 5
762 agent claude-sonnet-5 3292 22673 20
763 agent claude-sonnet-5 4562 25965 3
764 agent claude-sonnet-5 4722 30527 3
765 agent claude-sonnet-5 2374 35249 2
766 agent claude-sonnet-5 1712 37623 8
767 agent claude-sonnet-5 3687 39335 0
768 agent claude-sonnet-5 4002 43022 8
769 agent claude-sonnet-5 4596 47024 4
770 agent claude-sonnet-5 4845 51620 5
771 agent claude-sonnet-5 2694 56465 3
772 agent claude-sonnet-5 1522 59159 3
773 agent claude-sonnet-5 6301 60681 7
774 agent claude-sonnet-5 1369 66982 7
775 agent claude-sonnet-5 2351 68351 3
776 agent claude-sonnet-5 3956 70702 5
777 agent claude-sonnet-5 3836 74658 3
778 agent claude-sonnet-5 1199 78494 20
779 agent claude-sonnet-5 2216 79693 20
780 agent claude-sonnet-5 772 81909 2
781 agent claude-sonnet-5 806 82681 5
782 agent claude-sonnet-5 1168 83487 2
783 agent claude-sonnet-5 956 84655 3
784 agent claude-sonnet-5 403 85611 2
785 agent claude-sonnet-5 2551 86014 5
786 agent claude-sonnet-5 1513 88565 2
787 agent claude-sonnet-5 391 90078 1
788 agent claude-sonnet-5 2275 90469 2
789 agent claude-sonnet-5 1887 92744 1
790 agent claude-sonnet-5 289 94631 6
791 agent claude-sonnet-5 492 94920 4
792 agent claude-sonnet-5 349 95412 8
793 agent claude-sonnet-5 0 96461 5
794 agent claude-haiku-4-5-20251001 13556 0 4
795 agent claude-haiku-4-5-20251001 1957 13556 2
796 agent claude-haiku-4-5-20251001 767 15513 1
797 agent claude-haiku-4-5-20251001 635 16280 4
798 agent claude-haiku-4-5-20251001 425 16915 2
799 agent claude-haiku-4-5-20251001 629 17340 3
800 agent claude-haiku-4-5-20251001 754 17969 4
801 agent claude-haiku-4-5-20251001 1666 18723 0
802 agent claude-haiku-4-5-20251001 316 20389 4
803 agent claude-haiku-4-5-20251001 183 20705 4
804 agent claude-opus-5 30787 0 1
805 agent claude-opus-5 4724 30787 1
806 agent claude-opus-5 2904 35511 2
807 agent claude-opus-5 1770 38415 3
808 agent claude-opus-5 5511 40185 5
809 agent claude-opus-5 6347 45696 3
810 agent claude-opus-5 10565 52043 3
811 agent claude-opus-5 9855 62608 2
812 agent claude-opus-5 3717 72463 20
813 agent claude-opus-5 2495 76180 5
814 agent claude-opus-5 2192 78675 21
815 agent claude-opus-5 3951 80867 3
816 agent claude-opus-5 5653 84818 2
817 agent claude-opus-5 4055 90471 7
818 agent claude-opus-5 5029 94526 0
819 agent claude-opus-5 2159 99555 2
820 agent claude-opus-5 5584 101714 3
821 agent claude-opus-5 2729 107298 3
822 agent claude-opus-5 4649 110027 2
823 agent claude-opus-5 4233 114676 2
824 agent claude-opus-5 3035 118909 3
825 agent claude-opus-5 3601 121944 3
826 agent claude-opus-5 2523 125545 3
827 agent claude-opus-5 1985 128068 5
828 agent claude-opus-5 481 130053 17
829 agent claude-opus-5 316 130534 3
830 agent claude-opus-5 220 130850 17
831 agent claude-opus-5 191 131070 20
832 agent claude-opus-5 474 131261 17
833 agent claude-opus-5 203 131735 17
834 agent claude-opus-5 334 131938 7
835 agent claude-opus-5 249 132272 16
836 agent claude-opus-5 363 132521 16
837 agent claude-opus-5 364 132884 2
838 agent claude-opus-5 747 133248 2
839 agent claude-opus-5 578 133995 20
840 agent claude-opus-5 370 134573 3
841 agent claude-opus-5 634 134943 2
842 agent claude-opus-5 1811 135577 2
843 agent claude-opus-5 2101 137388 2
844 agent claude-opus-5 429 139489 17
845 agent claude-opus-5 468 139918 2
846 agent claude-opus-5 4721 140386 3
847 agent claude-opus-5 12813 145107 17
848 agent claude-opus-5 599 157920 3
849 agent claude-opus-5 217 158519 20
850 agent claude-opus-5 1026 158736 21
851 agent claude-opus-5 2362 159762 2
852 agent claude-opus-5 950 162124 17
853 agent claude-opus-5 356 163074 21
854 agent claude-opus-5 2368 163430 8
855 agent claude-opus-5 735 165798 6
856 agent claude-opus-5 197 166533 16
857 agent claude-opus-5 7740 166730 0
858 agent claude-opus-5 704 174470 5
859 agent claude-opus-5 353 175174 1
860 agent claude-opus-5 157646 17190 10
861 agent claude-opus-5 1558 174836 16
862 agent claude-opus-5 1763 176394 2
863 agent claude-opus-5 2274 178157 20
864 agent claude-opus-5 583 180431 3
865 agent claude-opus-5 1069 181014 3
866 agent claude-opus-5 6114 182083 3
867 agent claude-opus-5 2972 188197 3
868 agent claude-opus-5 1196 191169 20
869 agent claude-opus-5 2595 192365 20
870 agent claude-opus-5 894 194960 3
871 agent claude-opus-5 644 195854 0
872 agent claude-opus-5 666 196498 2
873 agent claude-opus-5 584 197164 4
874 agent claude-opus-5 1333 197748 20
875 agent claude-opus-5 2937 199081 2
876 agent claude-opus-5 4387 202018 3
877 agent claude-opus-5 1416 206405 2
878 agent claude-opus-5 1102 207821 2
879 agent claude-opus-5 1997 208923 2
880 agent claude-opus-5 282 210920 17
881 agent claude-opus-5 432 211202 16
882 agent claude-opus-5 357 211634 0
883 agent claude-opus-5 925 211991 2
884 agent claude-opus-5 1688 212916 20
885 agent claude-opus-5 370 214604 1
886 agent claude-haiku-4-5-20251001 13025 0 4
887 agent claude-haiku-4-5-20251001 1575 13025 2
888 agent claude-haiku-4-5-20251001 484 14600 4
889 agent claude-haiku-4-5-20251001 526 15084 2
890 agent claude-haiku-4-5-20251001 7567 15610 2
891 agent claude-haiku-4-5-20251001 1710 23177 3
892 agent claude-haiku-4-5-20251001 289 24887 4
893 agent claude-sonnet-5 19740 0 7
894 agent claude-sonnet-5 2491 19740 4
895 agent claude-sonnet-5 720 22231 20
896 agent claude-sonnet-5 3084 22951 2
897 agent claude-sonnet-5 2179 26035 2
898 agent claude-sonnet-5 448 28214 2
899 agent claude-sonnet-5 2131 28662 3
900 agent claude-sonnet-5 466 30793 20
901 agent claude-sonnet-5 275 31259 20
902 agent claude-sonnet-5 330 31534 2
903 agent claude-sonnet-5 257 31864 4
904 agent claude-sonnet-5 263 32121 20
905 agent claude-sonnet-5 433 32384 9
906 agent claude-sonnet-5 1425 32817 2
907 agent claude-sonnet-5 1289 34242 2
908 agent claude-sonnet-5 630 35531 2
909 agent claude-sonnet-5 465 36161 3
910 agent claude-sonnet-5 279 36626 2
911 agent claude-sonnet-5 872 36905 20
912 agent claude-sonnet-5 1467 37777 2
913 agent claude-sonnet-5 1027 39244 3
914 agent claude-sonnet-5 743 40271 3
915 agent claude-sonnet-5 779 41014 20
916 agent claude-sonnet-5 204 41793 20
917 agent claude-sonnet-5 216 41997 20
918 agent claude-sonnet-5 377 42213 20
919 agent claude-sonnet-5 958 42590 8
920 agent claude-sonnet-5 1576 43548 8
921 agent claude-sonnet-5 1849 45124 2
922 agent claude-sonnet-5 698 46973 2
923 agent claude-sonnet-5 1176 47671 20
924 agent claude-sonnet-5 18117 0 5
925 agent claude-sonnet-5 1563 18117 2
926 agent claude-sonnet-5 1245 19680 20
927 agent claude-sonnet-5 22924 20925 2
928 agent claude-sonnet-5 11269 43849 6
929 agent claude-sonnet-5 14740 55118 5
930 agent claude-sonnet-5 8681 69858 8
931 agent claude-sonnet-5 512 78539 5
932 agent claude-sonnet-5 4401 79051 7
933 agent claude-sonnet-5 2454 83452 2
934 agent claude-sonnet-5 538 85906 2
935 agent claude-sonnet-5 764 86444 2
936 agent claude-sonnet-5 182 87208 5
937 agent claude-sonnet-5 783 87390 3
938 agent claude-sonnet-5 5199 88173 7
939 agent claude-sonnet-5 6026 93372 3
940 agent claude-sonnet-5 1417 99398 20
941 agent claude-sonnet-5 301 100815 3
942 agent claude-sonnet-5 445 101116 2
943 agent claude-sonnet-5 1529 101561 1
944 agent claude-sonnet-5 186 103090 4
945 agent claude-haiku-4-5-20251001 12687 0 4
946 agent claude-haiku-4-5-20251001 1512 12687 2
947 agent claude-haiku-4-5-20251001 314 14199 4
948 agent claude-haiku-4-5-20251001 315 14513 3
949 agent claude-haiku-4-5-20251001 568 14828 2
950 agent claude-haiku-4-5-20251001 242 15396 4
951 agent claude-haiku-4-5-20251001 720 15638 2
952 agent claude-haiku-4-5-20251001 819 16358 2
953 agent claude-haiku-4-5-20251001 446 17177 2
954 agent claude-haiku-4-5-20251001 592 17623 4
955 agent claude-haiku-4-5-20251001 286 18215 4
956 agent claude-haiku-4-5-20251001 170 18501 2
957 agent claude-sonnet-5 7122 11475 4
958 agent claude-sonnet-5 3412 18597 5
959 agent claude-sonnet-5 423 22009 21
960 agent claude-sonnet-5 3825 22432 8
961 agent claude-sonnet-5 1055 26257 20
962 agent claude-sonnet-5 26269 27312 3
963 agent claude-sonnet-5 1874 53581 10
964 agent claude-sonnet-5 11006 55455 3
965 agent claude-sonnet-5 9774 66461 2
966 agent claude-sonnet-5 371 76235 3
967 agent claude-sonnet-5 1325 76606 0
968 agent claude-sonnet-5 2760 77931 3
969 agent claude-sonnet-5 642 80691 20
970 agent claude-sonnet-5 725 81333 20
971 agent claude-sonnet-5 986 82058 3
972 agent claude-sonnet-5 932 83044 3
973 agent claude-sonnet-5 778 83976 2
974 agent claude-sonnet-5 982 84754 3
975 agent claude-sonnet-5 314 85736 2
976 agent claude-sonnet-5 599 86050 2
977 agent claude-sonnet-5 1438 86649 2
978 agent claude-sonnet-5 776 88087 2
979 agent claude-sonnet-5 337 88863 3
980 agent claude-sonnet-5 559 89200 0
981 agent claude-sonnet-5 366 89759 3
982 agent claude-sonnet-5 2123 90125 2
983 agent claude-sonnet-5 3412 92248 0
984 agent claude-sonnet-5 720 95660 2
985 agent claude-sonnet-5 415 96380 5
986 agent claude-sonnet-5 1140 96795 0
987 agent claude-sonnet-5 310 97935 17
988 agent claude-sonnet-5 2273 98245 2
989 agent claude-sonnet-5 1915 100518 6
990 agent claude-sonnet-5 2735 102433 3
991 agent claude-sonnet-5 1434 105168 3
992 agent claude-sonnet-5 531 106602 0
993 agent claude-sonnet-5 1633 107133 20
994 agent claude-sonnet-5 720 108766 4
995 agent claude-sonnet-5 3206 109486 5
996 agent claude-sonnet-5 170 112692 20
997 agent claude-sonnet-5 332 112862 17
998 agent claude-sonnet-5 206 113194 16
999 agent claude-sonnet-5 802 113400 5
1000 agent claude-sonnet-5 2307 114202 3
1001 agent claude-sonnet-5 259 116509 3
1002 agent claude-sonnet-5 4462 116768 2
1003 agent claude-sonnet-5 166 121230 20
1004 agent claude-sonnet-5 1390 121396 2
1005 agent claude-sonnet-5 896 122786 4
1006 agent claude-sonnet-5 612 123682 6
1007 agent claude-sonnet-5 1468 124294 3
1008 agent claude-sonnet-5 352 125762 3
1009 agent claude-sonnet-5 1109 126114 20
1010 agent claude-sonnet-5 425 127223 7
1011 agent claude-sonnet-5 889 127648 6
1012 agent claude-sonnet-5 1016 128537 2
1013 agent claude-sonnet-5 205 129553 20
1014 agent claude-sonnet-5 154 129758 20
1015 agent claude-sonnet-5 698 129912 9
1016 agent claude-sonnet-5 928 130610 9
1017 agent claude-sonnet-5 480 131538 8
1018 agent claude-sonnet-5 309 132018 1
1019 agent claude-sonnet-5 119457 11467 5
1020 agent claude-sonnet-5 1710 130924 2
1021 agent claude-sonnet-5 1404 132634 0
1022 agent claude-sonnet-5 615 134038 2
1023 agent claude-sonnet-5 1096 134653 17
1024 agent claude-sonnet-5 957 135749 6
1025 agent claude-sonnet-5 605 136706 17
1026 agent claude-sonnet-5 308 137311 2
1027 agent claude-sonnet-5 713 137619 17
1028 agent claude-sonnet-5 368 138332 4
1029 agent claude-sonnet-5 229 138700 2
1030 agent claude-sonnet-5 1058 138929 0
1031 agent claude-sonnet-5 172 139987 2
1032 agent claude-sonnet-5 14482 140159 4
1033 agent claude-sonnet-5 758 154641 2
1034 agent claude-sonnet-5 3436 155399 2
1035 agent claude-sonnet-5 661 158835 3
1036 agent claude-sonnet-5 2873 159496 3
1037 agent claude-sonnet-5 2691 162369 3
1038 agent claude-sonnet-5 631 165060 3
1039 agent claude-sonnet-5 6337 165691 4
1040 agent claude-sonnet-5 455 172028 3
1041 agent claude-sonnet-5 215 172483 6
1042 agent claude-sonnet-5 512 172698 8
1043 agent claude-sonnet-5 5091 173210 2
1044 agent claude-sonnet-5 370 178301 0
1045 agent claude-sonnet-5 590 178671 20
1046 agent claude-sonnet-5 827 179261 1
1047 agent claude-sonnet-5 4948 180088 2
1048 agent claude-sonnet-5 7826 185036 3
1049 agent claude-sonnet-5 2402 192862 3
1050 agent claude-sonnet-5 1620 195264 2
1051 agent claude-sonnet-5 2255 196884 2
1052 agent claude-sonnet-5 2151 199139 5
1053 agent claude-sonnet-5 1438 201290 3
1054 agent claude-sonnet-5 1141 202728 6
1055 agent claude-sonnet-5 872 203869 2
1056 agent claude-sonnet-5 2187 204741 3
1057 agent claude-sonnet-5 499 206928 6
1058 agent claude-sonnet-5 286 207427 2
1059 agent claude-sonnet-5 1542 207713 2
1060 agent claude-sonnet-5 650 209255 20
1061 agent claude-sonnet-5 789 209905 2
1062 agent claude-sonnet-5 1320 210694 2
1063 agent claude-sonnet-5 1105 212014 3
1064 agent claude-sonnet-5 1554 213119 2
1065 agent claude-sonnet-5 1262 214673 9
1066 agent claude-sonnet-5 815 215935 3
1067 agent claude-sonnet-5 1037 216750 0
1068 agent claude-sonnet-5 625 217787 20
1069 agent claude-sonnet-5 154 218412 20
1070 agent claude-sonnet-5 196 218566 2
1071 agent claude-sonnet-5 1252 218762 2
1072 agent claude-sonnet-5 1966 220014 2
1073 agent claude-sonnet-5 218 221980 20
1074 agent claude-sonnet-5 2372 222198 3
1075 agent claude-sonnet-5 735 224570 2
1076 agent claude-sonnet-5 1019 225305 1
1077 agent claude-sonnet-5 281 226324 1
1078 agent claude-sonnet-5 212555 11467 5
1079 agent claude-sonnet-5 1973 224022 7
1080 agent claude-sonnet-5 1366 225995 2
1081 agent claude-sonnet-5 2697 227361 3
1082 agent claude-sonnet-5 8586 230058 8
1083 agent claude-sonnet-5 5430 238644 3
1084 agent claude-sonnet-5 5720 244074 3
1085 agent claude-sonnet-5 1455 249794 2
1086 agent claude-sonnet-5 503 251249 20
1087 agent claude-sonnet-5 829 251752 3
1088 agent claude-sonnet-5 1736 252581 3
1089 agent claude-sonnet-5 3150 254317 3
1090 agent claude-sonnet-5 1053 257467 3
1091 agent claude-sonnet-5 1404 258520 2
1092 agent claude-sonnet-5 872 259924 3
1093 agent claude-sonnet-5 1104 260796 1
1094 agent claude-sonnet-5 272 261900 2
1095 agent claude-haiku-4-5-20251001 5598 6509 4
1096 agent claude-haiku-4-5-20251001 1721 12107 2
1097 agent claude-haiku-4-5-20251001 285 13828 2
1098 agent claude-haiku-4-5-20251001 415 14113 2
1099 agent claude-haiku-4-5-20251001 18254 14528 1
1100 agent claude-haiku-4-5-20251001 860 32782 2
1101 agent claude-haiku-4-5-20251001 291 33642 2
1102 agent claude-opus-5 10758 15753 1
1103 agent claude-opus-5 9971 26511 3
1104 agent claude-opus-5 23086 36482 3
1105 agent claude-opus-5 5840 59568 4
1106 agent claude-opus-5 4295 65408 3
1107 agent claude-opus-5 6358 69703 6
1108 agent claude-opus-5 6293 76061 4
1109 agent claude-opus-5 4931 82354 3
1110 agent claude-opus-5 3314 87285 3
1111 agent claude-opus-5 2735 90599 5
1112 agent claude-opus-5 3277 93334 3
1113 agent claude-opus-5 4806 96611 3
1114 agent claude-opus-5 3927 101417 3
1115 agent claude-opus-5 1878 105344 5
1116 agent claude-opus-5 2194 107222 3
1117 agent claude-opus-5 1984 109416 2
1118 agent claude-opus-5 1652 111400 2
1119 agent claude-opus-5 4662 113052 3
1120 agent claude-haiku-4-5-20251001 12255 0 4
1121 agent claude-haiku-4-5-20251001 1957 12255 2
1122 agent claude-haiku-4-5-20251001 445 14212 1
1123 agent claude-haiku-4-5-20251001 573 14657 2
1124 agent claude-haiku-4-5-20251001 226 15230 3
1125 agent claude-haiku-4-5-20251001 1251 15456 4
1126 agent claude-haiku-4-5-20251001 1716 16707 2
1127 agent claude-haiku-4-5-20251001 19872 18423 2
1128 agent claude-haiku-4-5-20251001 1202 38295 2
1129 agent claude-haiku-4-5-20251001 271 39497 2
1130 agent claude-sonnet-5 18509 0 4
1131 agent claude-sonnet-5 2494 18509 5
1132 agent claude-sonnet-5 231 21003 17
1133 agent claude-sonnet-5 1811 21234 3
1134 agent claude-sonnet-5 473 23045 3
1135 agent claude-sonnet-5 1443 23518 2
1136 agent claude-sonnet-5 1620 24961 3
1137 agent claude-sonnet-5 3329 26581 7
1138 agent claude-sonnet-5 6904 29910 1
1139 agent claude-sonnet-5 404 36814 8
1140 agent claude-sonnet-5 192 37218 9
1141 agent claude-sonnet-5 1446 37410 5
1142 agent claude-sonnet-5 1178 38856 17
1143 agent claude-sonnet-5 405 40034 2
1144 agent claude-sonnet-5 1697 40439 2
1145 agent claude-sonnet-5 945 42136 21
1146 agent claude-sonnet-5 1776 43081 2
1147 agent claude-sonnet-5 1907 44857 2
1148 agent claude-sonnet-5 749 46764 2
1149 agent claude-sonnet-5 1475 47513 3
1150 agent claude-sonnet-5 2959 48988 2
1151 agent claude-sonnet-5 713 51947 17
1152 agent claude-sonnet-5 625 52660 17
1153 agent claude-sonnet-5 533 53285 0
1154 agent claude-sonnet-5 1071 53818 3
1155 agent claude-sonnet-5 1180 54889 0
1156 agent claude-sonnet-5 1220 56069 8
1157 agent claude-sonnet-5 1104 57289 1
1158 agent claude-haiku-4-5-20251001 12676 0 4
1159 agent claude-haiku-4-5-20251001 1478 12676 2
1160 agent claude-haiku-4-5-20251001 486 14154 2
1161 agent claude-haiku-4-5-20251001 446 14640 2
1162 agent claude-haiku-4-5-20251001 1213 15086 2
1163 agent claude-haiku-4-5-20251001 421 16299 5
1164 agent claude-sonnet-5 17685 0 3
1165 agent claude-sonnet-5 1612 17685 2
1166 agent claude-sonnet-5 764 19297 0
1167 agent claude-sonnet-5 4282 20061 3
1168 agent claude-sonnet-5 1624 24343 3
1169 agent claude-sonnet-5 356 25967 3
1170 agent claude-sonnet-5 1134 26323 2
1171 agent claude-sonnet-5 250 27457 20
1172 agent claude-sonnet-5 1522 27707 6
1173 agent claude-sonnet-5 2554 29229 8
1174 agent claude-sonnet-5 503 31783 5
1175 agent claude-sonnet-5 210 32286 8
1176 agent claude-sonnet-5 2393 32496 3
1177 agent claude-sonnet-5 1718 34889 3
1178 agent claude-haiku-4-5-20251001 12324 0 4
1179 agent claude-haiku-4-5-20251001 1549 12324 2
1180 agent claude-haiku-4-5-20251001 429 13873 2
1181 agent claude-haiku-4-5-20251001 631 14302 2
1182 agent claude-haiku-4-5-20251001 692 14933 3
1183 agent claude-haiku-4-5-20251001 382 15625 4
1184 agent claude-haiku-4-5-20251001 13095 0 4
1185 agent claude-haiku-4-5-20251001 2451 13095 2
1186 agent claude-haiku-4-5-20251001 383 15546 2
1187 agent claude-haiku-4-5-20251001 1328 15929 4
1188 agent claude-haiku-4-5-20251001 731 17257 4
1189 agent claude-haiku-4-5-20251001 13067 0 0
1190 agent claude-haiku-4-5-20251001 1671 13067 2
1191 agent claude-haiku-4-5-20251001 194 14738 2
1192 agent claude-haiku-4-5-20251001 353 14932 1
1193 agent claude-haiku-4-5-20251001 4197 15285 1
1194 agent claude-haiku-4-5-20251001 1100 19482 2
1195 agent claude-haiku-4-5-20251001 227 20582 1
1196 agent claude-haiku-4-5-20251001 487 20809 2
1197 agent claude-haiku-4-5-20251001 1278 21296 1
1198 agent claude-haiku-4-5-20251001 315 22574 1
1199 agent claude-haiku-4-5-20251001 200 22889 2
1200 agent claude-haiku-4-5-20251001 219 23089 2
1201 agent claude-haiku-4-5-20251001 635 23308 1
1202 agent claude-haiku-4-5-20251001 1315 23943 0
1203 agent claude-haiku-4-5-20251001 298 25258 4
1204 agent claude-haiku-4-5-20251001 302 25556 4
1205 agent claude-opus-5 10679 15753 1
1206 agent claude-opus-5 7750 26432 5
1207 agent claude-opus-5 10483 34182 17
1208 agent claude-opus-5 10630 44665 17
1209 agent claude-opus-5 10928 55295 6
1210 agent claude-opus-5 2307 66223 17
1211 agent claude-opus-5 2899 68530 20
1212 agent claude-opus-5 4731 71429 4
1213 agent claude-opus-5 2910 76160 4
1214 agent claude-opus-5 1067 79070 2
1215 agent claude-opus-5 2636 80137 17
1216 agent claude-opus-5 1829 82773 3
1217 agent claude-opus-5 1141 84602 4
1218 agent claude-opus-5 1622 85743 4
1219 agent claude-opus-5 3289 87365 5
1220 agent claude-opus-5 2815 90654 20
1221 agent claude-opus-5 1200 93469 2
1222 agent claude-opus-5 882 94669 3
1223 agent claude-opus-5 3311 95551 2
1224 agent claude-haiku-4-5-20251001 12607 0 4
1225 agent claude-haiku-4-5-20251001 1620 12607 2
1226 agent claude-haiku-4-5-20251001 583 14227 2
1227 agent claude-haiku-4-5-20251001 186 14810 2
1228 agent claude-haiku-4-5-20251001 3518 14996 2
1229 agent claude-haiku-4-5-20251001 1433 18514 2
1230 agent claude-haiku-4-5-20251001 1153 19947 2
1231 agent claude-haiku-4-5-20251001 285 21100 5
1232 agent claude-sonnet-5 16936 0 5
1233 agent claude-sonnet-5 2713 16936 4
1234 agent claude-sonnet-5 1661 19649 20
1235 agent claude-sonnet-5 13698 21310 3
1236 agent claude-sonnet-5 465 35008 17
1237 agent claude-sonnet-5 15139 35473 10
1238 agent claude-sonnet-5 2837 50612 2
1239 agent claude-sonnet-5 8897 53449 3
1240 agent claude-sonnet-5 1351 62346 3
1241 agent claude-sonnet-5 881 63697 3
1242 agent claude-sonnet-5 10012 64578 0
1243 agent claude-sonnet-5 7111 74590 5
1244 agent claude-sonnet-5 545 81701 0
1245 agent claude-sonnet-5 23481 82246 0
1246 agent claude-sonnet-5 3569 105727 2
1247 agent claude-sonnet-5 10056 109296 3
1248 agent claude-sonnet-5 3591 119352 3
1249 agent claude-sonnet-5 1326 122943 0
1250 agent claude-sonnet-5 4251 124269 3
1251 agent claude-sonnet-5 1949 128520 3
1252 agent claude-sonnet-5 585 130469 0
1253 agent claude-sonnet-5 1831 131054 3
1254 agent claude-sonnet-5 1419 132885 4
1255 agent claude-sonnet-5 956 134304 0
1256 agent claude-sonnet-5 1648 135260 4
1257 agent claude-sonnet-5 867 136908 2
1258 agent claude-sonnet-5 420 137775 2
1259 agent claude-sonnet-5 936 138195 3
1260 agent claude-sonnet-5 5350 139131 2
1261 agent claude-sonnet-5 1308 144481 2
1262 agent claude-sonnet-5 1238 145789 2
1263 agent claude-sonnet-5 362 147027 0
1264 agent claude-haiku-4-5-20251001 12818 0 2
1265 agent claude-haiku-4-5-20251001 1859 12818 2
1266 agent claude-haiku-4-5-20251001 639 14677 2
1267 agent claude-haiku-4-5-20251001 480 15316 2
1268 agent claude-haiku-4-5-20251001 2736 15796 2
1269 agent claude-haiku-4-5-20251001 404 18532 5
1270 agent claude-haiku-4-5-20251001 13141 0 4
1271 agent claude-haiku-4-5-20251001 1773 13141 1
1272 agent claude-haiku-4-5-20251001 952 14914 2
1273 agent claude-haiku-4-5-20251001 819 15866 3
1274 agent claude-haiku-4-5-20251001 3639 16685 3
1275 agent claude-haiku-4-5-20251001 286 20324 4
1276 agent claude-sonnet-5 18211 0 4
1277 agent claude-sonnet-5 3179 18211 2
1278 agent claude-sonnet-5 198 21390 16
1279 agent claude-sonnet-5 205 21588 9
1280 agent claude-sonnet-5 1045 21793 8
1281 agent claude-sonnet-5 376 22838 20
1282 agent claude-sonnet-5 191 23214 1
1283 agent claude-sonnet-5 213 23405 20
1284 agent claude-sonnet-5 307 23618 5
1285 agent claude-sonnet-5 170 23925 2
1286 agent claude-opus-5 10807 15753 1
1287 agent claude-opus-5 8021 26560 5
1288 agent claude-opus-5 1846 34581 3
1289 agent claude-opus-5 2015 36427 5
1290 agent claude-opus-5 7729 38442 3
1291 agent claude-opus-5 2735 46171 9
1292 agent claude-opus-5 2741 48906 6
1293 agent claude-opus-5 2469 51647 8
1294 agent claude-opus-5 916 54116 2
1295 agent claude-haiku-4-5-20251001 12415 0 4
1296 agent claude-haiku-4-5-20251001 1702 12415 1
1297 agent claude-haiku-4-5-20251001 708 14117 2
1298 agent claude-haiku-4-5-20251001 240 14825 2
1299 agent claude-haiku-4-5-20251001 337 15065 4
1300 agent claude-haiku-4-5-20251001 1419 15402 2
1301 agent claude-haiku-4-5-20251001 4360 16821 2
1302 agent claude-haiku-4-5-20251001 2242 21181 2
1303 agent claude-haiku-4-5-20251001 652 23423 4
1304 agent claude-haiku-4-5-20251001 311 24075 4
1305 agent claude-sonnet-5 7079 11467 5
1306 agent claude-sonnet-5 2380 18546 4
1307 agent claude-sonnet-5 5016 20926 4
1308 agent claude-sonnet-5 2578 25942 3
1309 agent claude-sonnet-5 1150 28520 5
1310 agent claude-sonnet-5 2641 29670 8
1311 agent claude-sonnet-5 5613 32311 4
1312 agent claude-sonnet-5 604 37924 17
1313 agent claude-sonnet-5 401 38528 17
1314 agent claude-sonnet-5 390 38929 2
1315 agent claude-sonnet-5 520 39319 20
1316 agent claude-sonnet-5 1364 39839 3
1317 agent claude-sonnet-5 763 41203 0
1318 agent claude-sonnet-5 192 41966 20
1319 agent claude-sonnet-5 300 42158 0
1320 agent claude-sonnet-5 500 42458 8
1321 agent claude-sonnet-5 1043 42958 2
1322 agent claude-sonnet-5 934 44001 0
1323 agent claude-sonnet-5 488 44935 0
1324 agent claude-sonnet-5 410 45423 8
1325 agent claude-sonnet-5 1038 45833 2
1326 agent claude-sonnet-5 300 46871 2
1327 agent claude-sonnet-5 487 47171 0
1328 agent claude-sonnet-5 499 47658 16
1329 agent claude-sonnet-5 499 48157 7
1330 agent claude-sonnet-5 605 48656 3
1331 agent claude-sonnet-5 1657 49261 3
1332 agent claude-sonnet-5 2294 50918 4
1333 agent claude-sonnet-5 480 53212 17
1334 agent claude-sonnet-5 1282 53692 20
1335 agent claude-sonnet-5 313 54974 2
1336 agent claude-sonnet-5 548 55287 2
1337 agent claude-sonnet-5 1177 55835 3
1338 agent claude-sonnet-5 271 57012 2
1339 agent claude-sonnet-5 468 57283 4
1340 agent claude-sonnet-5 716 57751 3
1341 agent claude-sonnet-5 627 58467 2
1342 agent claude-sonnet-5 336 59094 2
1343 agent claude-sonnet-5 17907 0 3
1344 agent claude-sonnet-5 2794 17907 2
1345 agent claude-sonnet-5 1182 20701 3
1346 agent claude-sonnet-5 411 21883 1
1347 agent claude-sonnet-5 611 22294 20
1348 agent claude-sonnet-5 2086 22905 0
1349 agent claude-haiku-4-5-20251001 12577 0 1
1350 agent claude-haiku-4-5-20251001 1657 12577 2
1351 agent claude-haiku-4-5-20251001 469 14234 2
1352 agent claude-haiku-4-5-20251001 248 14703 1
1353 agent claude-haiku-4-5-20251001 249 14951 2
1354 agent claude-haiku-4-5-20251001 658 15200 3
1355 agent claude-haiku-4-5-20251001 1630 15858 2
1356 agent claude-haiku-4-5-20251001 2122 17488 4
1357 agent claude-haiku-4-5-20251001 368 19610 4
1358 agent claude-sonnet-5 7120 11467 5
1359 agent claude-sonnet-5 2297 18587 2
1360 agent claude-sonnet-5 484 20884 17
1361 agent claude-sonnet-5 24873 21368 2
1362 agent claude-sonnet-5 7185 46241 3
1363 agent claude-sonnet-5 3165 53426 6
1364 agent claude-sonnet-5 1602 56591 2
1365 agent claude-sonnet-5 216 58193 20
1366 agent claude-sonnet-5 180 58409 20
1367 agent claude-sonnet-5 225 58589 20
1368 agent claude-sonnet-5 455 58814 2
1369 agent claude-sonnet-5 778 59269 20
1370 agent claude-sonnet-5 447 60047 8
1371 agent claude-sonnet-5 399 60494 20
1372 agent claude-sonnet-5 516 60893 3
1373 agent claude-sonnet-5 2491 61409 2
1374 agent claude-sonnet-5 2518 63900 3
1375 agent claude-sonnet-5 1616 66418 3
1376 agent claude-sonnet-5 1280 68034 2
1377 agent claude-sonnet-5 204 69314 20
1378 agent claude-sonnet-5 749 69518 2
1379 agent claude-sonnet-5 579 70267 3
1380 agent claude-sonnet-5 642 70846 2
1381 agent claude-sonnet-5 1029 71488 2
1382 agent claude-sonnet-5 223 72517 2
1383 agent claude-sonnet-5 1203 72740 20
1384 agent claude-sonnet-5 306 73943 3
1385 agent claude-sonnet-5 1023 74249 9
1386 agent claude-sonnet-5 371 75272 20
1387 agent claude-sonnet-5 534 75643 4
1388 agent claude-sonnet-5 197 76177 20
1389 agent claude-sonnet-5 624 76374 2
1390 agent claude-sonnet-5 178 76998 4
1391 agent claude-sonnet-5 242 77176 2
1392 agent claude-sonnet-5 356 77418 2
1393 agent claude-sonnet-5 239 77774 2
1394 agent claude-sonnet-5 352 78013 2
1395 agent claude-sonnet-5 463 78365 9
1396 agent claude-sonnet-5 1096 78828 2
1397 agent claude-sonnet-5 571 79924 8
1398 agent claude-sonnet-5 434 80495 2
1399 agent claude-sonnet-5 17938 0 5
1400 agent claude-sonnet-5 3243 17938 2
1401 agent claude-sonnet-5 7495 21181 8
1402 agent claude-sonnet-5 2264 28676 2
1403 agent claude-sonnet-5 2774 30940 6
1404 agent claude-sonnet-5 714 33714 8
1405 agent claude-sonnet-5 8963 34428 2
1406 agent claude-sonnet-5 460 43391 4
1407 agent claude-sonnet-5 412 43851 20
1408 agent claude-sonnet-5 152 44263 4
1409 agent claude-sonnet-5 1864 44415 2
1410 agent claude-sonnet-5 3550 46279 3
1411 agent claude-sonnet-5 1205 49829 2
1412 agent claude-sonnet-5 250 51034 2
1413 agent claude-sonnet-5 240 51284 2
1414 agent claude-sonnet-5 24851 51524 2
1415 agent claude-sonnet-5 4964 76375 3
1416 agent claude-sonnet-5 2181 81339 2
1417 agent claude-sonnet-5 1347 83520 5
1418 agent claude-sonnet-5 8426 84867 3
1419 agent claude-sonnet-5 18414 0 4
1420 agent claude-sonnet-5 3416 18414 4
1421 agent claude-sonnet-5 2805 21830 3
1422 agent claude-sonnet-5 4264 24635 14
1423 agent claude-sonnet-5 12589 28899 10
1424 agent claude-sonnet-5 1892 41488 2
1425 agent claude-sonnet-5 166 43380 20
1426 agent claude-sonnet-5 2332 43546 3
1427 agent claude-sonnet-5 4322 45878 2
1428 agent claude-sonnet-5 316 50200 20
1429 agent claude-sonnet-5 586 50516 4
1430 agent claude-sonnet-5 687 51102 2
1431 agent claude-opus-5 40505 0 1
1432 agent claude-opus-5 2430 40505 31
1433 agent claude-opus-5 376 42935 5
1434 agent claude-opus-5 689 43311 3
1435 agent claude-opus-5 413 44000 2
1436 agent claude-opus-5 696 44413 20
1437 agent claude-opus-5 446 45109 3
1438 agent claude-opus-5 528 45555 2
1439 agent claude-opus-5 486 46083 3
1440 agent claude-opus-5 560 46569 3
1441 agent claude-opus-5 682 47129 2
1442 agent claude-opus-5 422 47811 5
1443 agent claude-opus-5 1253 48233 3
1444 agent claude-opus-5 1194 49486 2
1445 agent claude-opus-5 1814 50680 17
1446 agent claude-opus-5 3652 52494 4
1447 agent claude-opus-5 3940 56146 17
1448 agent claude-opus-5 890 60086 3
1449 agent claude-haiku-4-5-20251001 13527 0 4
1450 agent claude-haiku-4-5-20251001 1496 13527 2
1451 agent claude-haiku-4-5-20251001 1683 15023 3
1452 agent claude-haiku-4-5-20251001 783 16706 4
1453 agent claude-haiku-4-5-20251001 13128 0 4
1454 agent claude-haiku-4-5-20251001 3079 13128 2
1455 agent claude-haiku-4-5-20251001 456 16207 2
1456 agent claude-haiku-4-5-20251001 2030 16663 2
1457 agent claude-haiku-4-5-20251001 299 18693 2
1458 agent claude-sonnet-5 6581 11477 4
1459 agent claude-sonnet-5 2631 18058 4
1460 agent claude-sonnet-5 1547 20689 5
1461 agent claude-sonnet-5 1560 22236 2
1462 agent claude-sonnet-5 772 23796 3
1463 agent claude-sonnet-5 667 24568 3
1464 agent claude-sonnet-5 312 25235 2
1465 agent claude-sonnet-5 1170 25547 1
1466 agent claude-sonnet-5 796 26717 0
1467 agent claude-sonnet-5 6571 11477 4
1468 agent claude-sonnet-5 3216 18048 2
1469 agent claude-sonnet-5 799 21264 3
1470 agent claude-sonnet-5 684 22063 0
1471 agent claude-sonnet-5 475 22747 1
1472 agent claude-sonnet-5 314 23222 1
1473 agent claude-sonnet-5 6527 11477 3
1474 agent claude-sonnet-5 3585 18004 2
1475 agent claude-sonnet-5 1157 21589 2
1476 agent claude-sonnet-5 359 22746 20
1477 agent claude-sonnet-5 152 23105 2
1478 agent claude-sonnet-5 2953 23257 2
1479 agent claude-sonnet-5 768 26210 2
1480 agent claude-sonnet-5 320 26978 2
1481 agent claude-sonnet-5 322 27298 0
1482 agent claude-sonnet-5 260 27620 2
1483 agent claude-sonnet-5 210 27880 9
1484 agent claude-sonnet-5 335 28090 1
1485 agent claude-haiku-4-5-20251001 12821 0 0
1486 agent claude-haiku-4-5-20251001 1839 12821 2
1487 agent claude-haiku-4-5-20251001 1741 14660 2
1488 agent claude-haiku-4-5-20251001 1831 16401 2
1489 agent claude-haiku-4-5-20251001 476 18232 2
1490 agent claude-haiku-4-5-20251001 229 18708 4
1491 agent claude-sonnet-5 7026 11477 5
1492 agent claude-sonnet-5 2337 18503 2
1493 agent claude-sonnet-5 2403 20840 2
1494 agent claude-sonnet-5 868 23243 3
1495 agent claude-sonnet-5 748 24111 8
1496 agent claude-sonnet-5 2520 24859 4
1497 agent claude-sonnet-5 728 27379 3
1498 agent claude-sonnet-5 1501 28107 8
1499 agent claude-sonnet-5 432 29608 17
1500 agent claude-sonnet-5 449 30040 2
1501 agent claude-sonnet-5 337 30489 2
1502 agent claude-sonnet-5 681 30826 5
1503 agent claude-sonnet-5 226 31507 2
1504 agent claude-sonnet-5 398 31733 20
1505 agent claude-sonnet-5 274 32131 16
1506 agent claude-sonnet-5 420 32405 2
1507 agent claude-sonnet-5 830 32825 5
1508 agent claude-sonnet-5 751 33655 0
1509 agent claude-sonnet-5 442 34406 9
1510 agent claude-sonnet-5 579 34848 2
1511 agent claude-sonnet-5 601 35427 20
1512 agent claude-sonnet-5 303 36028 5
1513 agent claude-sonnet-5 181 36331 20
1514 agent claude-sonnet-5 1132 36512 4
1515 agent claude-sonnet-5 456 37644 3
1516 agent claude-sonnet-5 346 38100 1
1517 agent claude-sonnet-5 252 38446 1
1518 agent claude-sonnet-5 1636 38698 8
1519 agent claude-sonnet-5 1420 40334 2
1520 agent claude-sonnet-5 1427 41754 1
1521 agent claude-sonnet-5 6958 11475 4
1522 agent claude-sonnet-5 3557 18433 3
1523 agent claude-sonnet-5 3037 21990 20
1524 agent claude-sonnet-5 3530 25027 3
1525 agent claude-sonnet-5 20459 28557 3
1526 agent claude-sonnet-5 2950 49016 4
1527 agent claude-sonnet-5 2702 51966 2
1528 agent claude-sonnet-5 6236 54668 2
1529 agent claude-sonnet-5 11339 60904 3
1530 agent claude-sonnet-5 9099 72243 3
1531 agent claude-sonnet-5 1026 81342 7
1532 agent claude-sonnet-5 2600 82368 3
1533 agent claude-sonnet-5 361 84968 3
1534 agent claude-sonnet-5 2078 85329 2
1535 agent claude-sonnet-5 320 87407 17
1536 agent claude-sonnet-5 2425 87727 0
1537 agent claude-sonnet-5 2503 90152 3
1538 agent claude-sonnet-5 495 92655 8
1539 agent claude-sonnet-5 6468 93150 3
1540 agent claude-sonnet-5 515 99618 4
1541 agent claude-sonnet-5 1088 100133 4
1542 agent claude-sonnet-5 3457 101221 2
1543 agent claude-sonnet-5 246 104678 20
1544 agent claude-sonnet-5 560 104924 6
1545 agent claude-sonnet-5 607 105484 2
1546 agent claude-sonnet-5 261 106091 2
1547 agent claude-sonnet-5 371 106352 2
1548 agent claude-sonnet-5 273 106723 9
1549 agent claude-haiku-4-5-20251001 13118 0 4
1550 agent claude-haiku-4-5-20251001 1228 13118 2
1551 agent claude-haiku-4-5-20251001 388 14346 2
1552 agent claude-haiku-4-5-20251001 235 14734 2
1553 agent claude-haiku-4-5-20251001 857 14969 4
1554 agent claude-haiku-4-5-20251001 610 15826 4
1555 agent claude-haiku-4-5-20251001 13861 0 4
1556 agent claude-haiku-4-5-20251001 1578 13861 2
1557 agent claude-haiku-4-5-20251001 500 15439 1
1558 agent claude-haiku-4-5-20251001 1595 15939 2
1559 agent claude-haiku-4-5-20251001 294 17534 2
1560 agent claude-haiku-4-5-20251001 558 17828 4
1561 agent claude-haiku-4-5-20251001 238 18386 2
1562 agent claude-haiku-4-5-20251001 13552 0 4
1563 agent claude-haiku-4-5-20251001 1453 13552 2
1564 agent claude-haiku-4-5-20251001 223 15005 1
1565 agent claude-haiku-4-5-20251001 1331 15228 3
1566 agent claude-haiku-4-5-20251001 629 16559 2
1567 agent claude-haiku-4-5-20251001 201 17188 2
1568 agent claude-opus-5 26433 0 2
1569 agent claude-opus-5 1817 26433 17
1570 agent claude-opus-5 22634 28250 3
1571 agent claude-opus-5 14641 50884 3
1572 agent claude-opus-5 4594 65525 3
1573 agent claude-opus-5 5031 70119 3
1574 agent claude-opus-5 456 75150 16
1575 agent claude-opus-5 3184 75606 3
1576 agent claude-opus-5 2269 78790 3
1577 agent claude-opus-5 2226 81059 3
1578 agent claude-opus-5 3500 83285 3
1579 agent claude-opus-5 785 86785 6
1580 agent claude-opus-5 72645 15753 3
1581 agent claude-opus-5 567 88398 2
1582 agent claude-opus-5 1319 88965 4
1583 agent claude-opus-5 1022 90284 3
1584 agent claude-opus-5 637 91306 3
1585 agent claude-opus-5 2188 91943 9
1586 agent claude-opus-5 3042 94131 5
1587 agent claude-opus-5 1195 97173 2
1588 agent claude-opus-5 1816 98368 2
1589 agent claude-opus-5 574 100184 3
1590 agent claude-opus-5 5814 100758 3
1591 agent claude-opus-5 644 106572 5
1592 agent claude-sonnet-5 7180 11467 3
1593 agent claude-sonnet-5 2231 18647 5
1594 agent claude-sonnet-5 18350 20878 9
1595 agent claude-sonnet-5 2587 39228 2
1596 agent claude-sonnet-5 2160 41815 3
1597 agent claude-sonnet-5 4452 43975 2
1598 agent claude-sonnet-5 610 48427 0
1599 agent claude-sonnet-5 689 49037 8
1600 agent claude-sonnet-5 1407 49726 2
1601 agent claude-sonnet-5 643 51133 6
1602 agent claude-sonnet-5 4134 51776 2
1603 agent claude-sonnet-5 2044 55910 2
1604 agent claude-sonnet-5 1334 57954 20
1605 agent claude-sonnet-5 2227 59288 8
1606 agent claude-sonnet-5 507 61515 0
1607 agent claude-sonnet-5 1330 62022 10
1608 agent claude-sonnet-5 1998 63352 2
1609 agent claude-sonnet-5 1071 65350 3
1610 agent claude-sonnet-5 1232 66421 4
1611 agent claude-sonnet-5 1677 67653 20
1612 agent claude-sonnet-5 760 69330 17
1613 agent claude-sonnet-5 441 70090 17
1614 agent claude-sonnet-5 361 70531 20
1615 agent claude-sonnet-5 465 70892 1
1616 agent claude-sonnet-5 274 71357 1
1617 agent claude-sonnet-5 151 71631 1
1618 agent claude-sonnet-5 7051 11475 4
1619 agent claude-sonnet-5 6117 18526 2
1620 agent claude-sonnet-5 11899 24643 2
1621 agent claude-sonnet-5 950 36542 2
1622 agent claude-sonnet-5 611 37492 3
1623 agent claude-sonnet-5 1083 38103 2
1624 agent claude-sonnet-5 2355 39186 2
1625 agent claude-sonnet-5 567 41541 3
1626 agent claude-sonnet-5 891 42108 2
1627 agent claude-sonnet-5 543 42999 3
1628 agent claude-sonnet-5 463 43542 2
1629 agent claude-sonnet-5 483 44005 2
1630 agent claude-sonnet-5 1321 44488 3
1631 agent claude-sonnet-5 6655 45809 3
1632 agent claude-sonnet-5 3405 52464 5
1633 agent claude-sonnet-5 913 55869 5
1634 agent claude-sonnet-5 1620 56782 4
1635 agent claude-sonnet-5 425 58402 17
1636 agent claude-sonnet-5 318 58827 2
1637 agent claude-sonnet-5 3486 59145 7
1638 agent claude-sonnet-5 2198 62631 3
1639 agent claude-sonnet-5 3759 64829 2
1640 agent claude-sonnet-5 5287 68588 0
1641 agent claude-sonnet-5 224 73875 20
1642 agent claude-sonnet-5 1291 74099 2
1643 agent claude-sonnet-5 2029 75390 4
1644 agent claude-sonnet-5 1701 77419 2
1645 agent claude-sonnet-5 485 79120 9
1646 agent claude-sonnet-5 810 79605 3
1647 agent claude-sonnet-5 351 80415 2
1648 agent claude-sonnet-5 1183 80766 1
1649 agent claude-sonnet-5 73544 7828 4
1650 agent claude-sonnet-5 4428 81372 0
1651 agent claude-sonnet-5 1345 85800 0
1652 agent claude-sonnet-5 13085 87145 0
1653 agent claude-sonnet-5 5620 100230 2
1654 agent claude-sonnet-5 5442 105850 5
1655 agent claude-sonnet-5 5488 111292 6
1656 agent claude-sonnet-5 2209 116780 17
1657 agent claude-sonnet-5 623 118989 17
1658 agent claude-sonnet-5 719 119612 17
1659 agent claude-sonnet-5 650 120331 6
1660 agent claude-sonnet-5 14268 120981 2
1661 agent claude-sonnet-5 6768 135249 3
1662 agent claude-sonnet-5 5554 142017 2
1663 agent claude-sonnet-5 4891 147571 6
1664 agent claude-sonnet-5 1346 152462 2
1665 agent claude-sonnet-5 17442 153808 2
1666 agent claude-sonnet-5 172 171250 20
1667 agent claude-sonnet-5 961 171422 17
1668 agent claude-sonnet-5 1508 172383 2
1669 agent claude-sonnet-5 2899 173891 20
1670 agent claude-sonnet-5 204 176790 2
1671 agent claude-sonnet-5 1302 176994 3
1672 agent claude-sonnet-5 4450 178296 2
1673 agent claude-sonnet-5 688 182746 0
1674 agent claude-sonnet-5 755 183434 5
1675 agent claude-sonnet-5 1264 184189 3
1676 agent claude-sonnet-5 1976 185453 20
1677 agent claude-sonnet-5 1119 187429 2
1678 agent claude-sonnet-5 1265 188548 2
1679 agent claude-sonnet-5 871 189813 2
1680 agent claude-sonnet-5 760 190684 2
1681 agent claude-sonnet-5 1184 191444 2
1682 agent claude-sonnet-5 582 192628 20
1683 agent claude-sonnet-5 305 193210 3
1684 agent claude-sonnet-5 1343 193515 17
1685 agent claude-sonnet-5 607 194858 0
1686 agent claude-sonnet-5 585 195465 2
1687 agent claude-sonnet-5 298 196050 3
1688 agent claude-sonnet-5 633 196348 2
1689 agent claude-sonnet-5 574 196981 3
1690 agent claude-sonnet-5 669 197555 20
1691 agent claude-sonnet-5 703 198224 3
1692 agent claude-sonnet-5 1258 198927 20
1693 agent claude-sonnet-5 756 200185 9
1694 agent claude-sonnet-5 1041 200941 2
1695 agent claude-sonnet-5 705 201982 1
1696 agent claude-sonnet-5 201 202687 8
1697 agent claude-sonnet-5 263 202888 2
1698 agent claude-sonnet-5 313 203151 20
1699 agent claude-sonnet-5 173 203464 3
1700 agent claude-sonnet-5 516 203637 6
1701 agent claude-sonnet-5 354 204153 2
1702 agent claude-sonnet-5 455 204507 2
1703 agent claude-sonnet-5 726 204962 2
1704 agent claude-sonnet-5 2250 205688 8
1705 agent claude-sonnet-5 722 207938 8
1706 agent claude-sonnet-5 723 208660 17
1707 agent claude-sonnet-5 588 209383 2
1708 agent claude-sonnet-5 602 209971 5
1709 agent claude-haiku-4-5-20251001 13214 0 4
1710 agent claude-haiku-4-5-20251001 1465 13214 2
1711 agent claude-haiku-4-5-20251001 213 14679 2
1712 agent claude-haiku-4-5-20251001 893 14892 5
1713 agent claude-haiku-4-5-20251001 728 15785 1
1714 agent claude-haiku-4-5-20251001 571 16513 2
1715 agent claude-haiku-4-5-20251001 614 17084 4
1716 agent claude-haiku-4-5-20251001 393 17698 1
1717 agent claude-haiku-4-5-20251001 615 18091 2
1718 agent claude-haiku-4-5-20251001 968 18706 1
1719 agent claude-haiku-4-5-20251001 1072 19674 2
1720 agent claude-haiku-4-5-20251001 2311 20746 3
1721 agent claude-haiku-4-5-20251001 283 23057 3
1722 agent claude-sonnet-5 7013 11475 4
1723 agent claude-sonnet-5 4070 18488 2
1724 agent claude-sonnet-5 3846 22558 5
1725 agent claude-sonnet-5 1136 26404 3
1726 agent claude-sonnet-5 3632 27540 7
1727 agent claude-sonnet-5 5060 31172 4
1728 agent claude-sonnet-5 5727 36232 3
1729 agent claude-sonnet-5 2190 41959 2
1730 agent claude-sonnet-5 2355 44149 2
1731 agent claude-sonnet-5 312 46504 5
1732 agent claude-sonnet-5 1990 46816 4
1733 agent claude-sonnet-5 200 48806 20
1734 agent claude-sonnet-5 2470 49006 3
1735 agent claude-sonnet-5 1970 51476 3
1736 agent claude-sonnet-5 382 53446 20
1737 agent claude-sonnet-5 166 53828 8
1738 agent claude-sonnet-5 2402 53994 2
1739 agent claude-sonnet-5 469 56396 9
1740 agent claude-sonnet-5 1392 56865 1
1741 agent claude-sonnet-5 234 58257 0
1742 agent claude-haiku-4-5-20251001 6455 6509 4
1743 agent claude-haiku-4-5-20251001 1492 12964 2
1744 agent claude-haiku-4-5-20251001 254 14456 2
1745 agent claude-haiku-4-5-20251001 216 14710 2
1746 agent claude-haiku-4-5-20251001 708 14926 2
1747 agent claude-haiku-4-5-20251001 565 15634 4
1748 agent claude-sonnet-5 6800 11467 4
1749 agent claude-sonnet-5 8089 18267 2
1750 agent claude-sonnet-5 1229 26356 20
1751 agent claude-sonnet-5 1042 27585 2
1752 agent claude-sonnet-5 1067 28627 2
1753 agent claude-sonnet-5 1020 29694 20
1754 agent claude-sonnet-5 452 30714 2
1755 agent claude-sonnet-5 271 31166 1
1756 agent claude-sonnet-5 127 31437 1
1757 agent claude-haiku-4-5-20251001 6489 6509 4
1758 agent claude-haiku-4-5-20251001 1697 12998 2
1759 agent claude-haiku-4-5-20251001 836 14695 2
1760 agent claude-haiku-4-5-20251001 354 15531 2
1761 agent claude-haiku-4-5-20251001 2189 15885 2
1762 agent claude-haiku-4-5-20251001 444 18074 2
-->
<!-- /cout -->
