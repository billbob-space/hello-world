# 2026-08-07 — claude/notification-whistle-sound-jehtob

Branche : `claude/notification-whistle-sound-jehtob`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Les tests décrivaient un sifflet, le haut-parleur donnait un bip

**Symptome** — signalé de vive voix : *« le sifflet ne ressemble absolument pas
à un sifflet »*. La sonnerie était trois sinusoïdes à 2100 Hz. Tout ce qui
l'entourait était vert et le disait : le test s'appelait « jouer produit une
note par note, dans l'ordre » et affirmait `ctx.joues.length === 3, 'trois coups
de sifflet'`, le module commentait « rien d'autre n'est nécessaire pour décrire
un bip, une cloche ou un coup de sifflet », le README expliquait pourquoi ce
n'était pas un fichier. Trois documents concordants sur un son que personne
n'avait écouté.

**Cause** — un test ne peut vérifier que la **structure** d'un son : combien
d'oscillateurs, à quelles fréquences, dans quel ordre. Il ne dit rien du timbre,
qui est tout ce qui distingue un sifflet d'un bip aigu. Le piège n'est pas que
le test soit faible — il ne peut pas être autre chose —, c'est que sa **chaîne
d'assertion cite l'intention** : « trois coups de sifflet » écrit dans un message
d'échec fait croire que trois coups de sifflet ont été vérifiés. Le nom de la
chose a tenu lieu de la chose, dans le test comme dans les commentaires.

**Detecte par** — `utilisateur`

**Action** — `comportement` — pour ce qui se juge par un sens — un son, une
couleur, une animation —, aucun test ne remplace un échantillon écouté ou
regardé. En produire un et le faire parvenir à celui qui décide, avant de
déclarer la chose faite. C'est ce qui a été fait ici : les trois sonneries ont
été rendues en `.wav` et envoyées à l'écoute avant le commit. Et ne jamais
écrire l'intention dans le message d'un `assert` qui ne la vérifie pas.

### 2. Un garde-fou avait figé un choix d'implémentation en règle

**Symptome** — le test « aucun fichier audio n'entre dans l'application »
refusait la chaîne `.wav` jusque dans les commentaires du module. Le correctif
demandé — un vrai enregistrement — le faisait échouer.

**Cause** — le garde-fou empilait deux motifs de nature différente sous un seul
interdit. L'un est une **contrainte** : l'ossature §2 interdit de charger quoi
que ce soit depuis un domaine tiers, la page étant publique. L'autre est une
**préférence**, défendable et jamais tranchée par le PRD : ne rien livrer du
tout, pour que la coque hors ligne et l'image ne grossissent pas. Confondus, ils
ont produit une règle plus dure que la contrainte, et cette règle a survécu à ce
qui la justifiait — 25 Ko sur une image de 14 Mo ne se mesurent pas, à côté d'un
blason de 32 Ko déjà livré. Le fichier ajouté est en même origine : la
contrainte, elle, tient toujours.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand un garde-fou interdit plus large que la
règle qu'il protège, écrire dans son message **laquelle de ses raisons est une
contrainte et laquelle est un confort**. Sans quoi le jour où le confort coûte
plus qu'il ne rapporte, l'interdit se lit comme une contrainte et on ne rouvre
rien.

### 3. Le modèle de données rendait la cloche inexprimable

**Symptome** — la sonnerie *Cloche* était une sinusoïde tenue 0,9 s : un bip
long, pas une cloche. En la retravaillant, il est apparu qu'on ne **pouvait pas**
écrire autre chose.

**Cause** — une sonnerie était une suite de `{ hz, duree, apres }` jouée par
`depart += Math.max(duree, apres)`. Tout s'enchaîne, rien ne se superpose. Or
une cloche est faite de partiels frappés au **même instant** — c'est leur
désaccord simultané qui fait entendre du métal ; joués l'un après l'autre, les
mêmes partiels font une gamme. Le modèle interdisait donc l'accord, et l'auteur
de la sonnerie n'avait pas à se le dire : il écrivait la seule chose que la
structure acceptait. Remplacer `apres` par un départ explicite `a` a suffi — la
structure ne coûtait pas plus cher, elle disait juste moins.

**Detecte par** — `auteur`

**Action** — `rien` — réparé. À retenir sans garde-fou : une structure de
données qui n'a qu'une façon d'enchaîner ses éléments **choisit** à la place de
celui qui la remplit, sans jamais le lui dire.

### 4. `prod.sh` a annoncé une app tombée pendant que la stack redémarrait

**Symptome** — premier contrôle après la fusion : `ramure absent de l hote`, en
rouge, sur une app que ce travail n'a pas touchée. Le réflexe qu'il déclenche —
une panne collatérale, le rayon de souffle qui vient de mordre — est le bon
réflexe et il était infondé : trente secondes plus tard, `ramure` était
`running (healthy)`, et ses journaux montraient un démarrage propre pendant le
contrôle même.

**Cause** — `docker compose up` recrée les conteneurs les uns après les autres.
Entre le retrait de l'ancien et le démarrage du nouveau, un service **n'existe
pas**, et `prod.sh` — qui décrit fidèlement l'instant où on l'interroge — le
rapporte comme absent. Ce n'était pas une lecture fausse mais une lecture
**prise trop tôt** : un état transitoire lu comme un état. Le même contrôle
affichait par ailleurs des conteneurs « Up 7 minutes » alors que l'en-tête
`X-App-Version` du site rendait déjà le commit de fusion — deux instants
différents dans une même sortie, ce qui aurait dû suffire à ne pas conclure.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le vrai témoin d'un déploiement n'est pas l'état des
conteneurs, c'est la **version servie** : `X-App-Version` est comparable au
commit fusionné, sans ambiguïté ni fenêtre de course. `prod.sh` gagnerait à
attendre la fin du redéploiement avant de conclure, ou à dire qu'il lit un
instant. En attendant : après une fusion, vérifier la version servie d'abord, et
ne lire l'état des services qu'ensuite.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 23:25 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 346 | 0,00 $ |
| Écriture de cache | 269 757 | 1,20 $ |
| Lecture de cache | 9 348 170 | 4,52 $ |
| Sortie | 57 937 | 1,35 $ |
| **Total** | **9 676 210** | **7,07 $ — 6,14 €** |

**Ce qui coûte**

- **75 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  59 176 jetons, écrits une fois par session puis relus à chaque
  échange : 4 379 024 jetons de relecture, 46 % de tout ce qui a été relu.
- **Tours courts** — 32 des 75 tours (42 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,81 $, soit 39 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 59 176 jetons relus au premier appel qui relise
  quelque chose, 190 975 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 9676210 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 59176 0 361
2 principal claude-opus-5 1218 59176 206
3 principal claude-opus-5 5184 60394 900
4 principal claude-opus-5 6768 65578 1664
5 principal claude-opus-5 4410 72346 733
6 principal claude-opus-5 1009 76756 2591
7 principal claude-opus-5 2664 77765 2209
8 principal claude-opus-5 2738 80429 1676
9 principal claude-opus-5 2023 83167 683
10 principal claude-opus-5 2015 85190 1904
11 principal claude-opus-5 1951 87205 2135
12 principal claude-opus-5 2466 89156 569
13 principal claude-opus-5 4039 91622 282
14 principal claude-opus-5 2088 95661 326
15 principal claude-opus-5 2143 97749 1948
16 principal claude-opus-5 3057 99892 1896
17 principal claude-opus-5 2171 102949 4195
18 principal claude-opus-5 4256 105120 339
19 principal claude-opus-5 421 109376 6694
20 principal claude-opus-5 6758 109797 123
21 principal claude-opus-5 462 116555 108
22 principal claude-opus-5 617 117017 566
23 principal claude-opus-5 659 117634 371
24 principal claude-opus-5 709 118293 286
25 principal claude-opus-5 1728 119002 217
26 principal claude-opus-5 1983 120730 126
27 principal claude-opus-5 1702 122713 1336
28 principal claude-opus-5 3143 124415 1356
29 principal claude-opus-5 1435 127558 114
30 principal claude-opus-5 684 128993 425
31 principal claude-opus-5 610 129677 959
32 principal claude-opus-5 1018 130287 158
33 principal claude-opus-5 433 131305 1041
34 principal claude-opus-5 1101 131738 144
35 principal claude-opus-5 3515 132839 147
36 principal claude-opus-5 10562 136354 2981
37 principal claude-opus-5 3049 146916 105
38 principal claude-opus-5 797 149965 99
39 principal claude-opus-5 4265 150762 98
40 principal claude-opus-5 371 155027 1620
41 principal claude-opus-5 1800 155398 121
42 principal claude-opus-5 344 157198 94
43 principal claude-opus-4-7 15189 28262 250
44 principal claude-opus-5 451 157542 86
45 principal claude-opus-4-7 433 43451 238
46 principal claude-opus-4-7 23654 28262 316
47 principal claude-opus-4-7 649 51916 290
48 principal claude-opus-5 480 157993 1122
49 principal claude-opus-4-7 13015 43884 885
50 principal claude-opus-5 1637 158473 118
51 principal claude-opus-5 2109 160110 137
52 principal claude-opus-5 408 162219 525
53 principal claude-opus-4-7 1582 56899 1905
54 principal claude-opus-5 587 162627 603
55 principal claude-opus-5 3098 163214 289
56 principal claude-opus-5 4490 166312 540
57 principal claude-opus-5 748 170802 159
58 principal claude-opus-5 738 171550 137
59 principal claude-opus-5 917 172288 193
60 principal claude-opus-5 306 173205 22
61 principal claude-opus-5 340 173533 137
62 principal claude-opus-5 1099 173873 175
63 principal claude-opus-5 784 174972 137
64 principal claude-opus-4-7 23144 52565 13
65 principal claude-opus-5 194 175756 117
66 principal claude-opus-5 638 175950 28
67 principal claude-opus-5 334 176615 93
68 principal claude-opus-5 397 176949 523
69 principal claude-opus-5 1062 177346 784
70 principal claude-opus-5 1114 178408 730
71 principal claude-opus-5 885 179522 448
72 principal claude-opus-5 616 180407 228
73 principal claude-opus-5 540 181023 1558
74 principal claude-opus-5 9412 181563 1095
75 principal claude-opus-5 1165 190975 150
-->
<!-- /cout -->
