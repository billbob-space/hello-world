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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 23:16 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 71 | 0,00 $ |
| Écriture de cache | 150 762 | 0,94 $ |
| Lecture de cache | 3 951 319 | 1,98 $ |
| Sortie | 41 973 | 1,05 $ |
| **Total** | **4 144 125** | **3,97 $ — 3,45 €** |

**Ce qui coûte**

- **38 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  59 176 jetons, écrits une fois par session puis relus à chaque
  échange : 2 189 512 jetons de relecture, 55 % de tout ce qui a été relu.
- **Tours courts** — 13 des 38 tours (34 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,00 $, soit 25 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 59 176 jetons relus au premier appel qui relise
  quelque chose, 149 965 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 4144125 -->
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
-->
<!-- /cout -->
