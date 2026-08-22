# 2026-08-22 — claude/ramure-v2-refonte-1q0zsr

Branche : `claude/ramure-v2-refonte-1q0zsr`
Périmètre : `ramure-v2` — reprise des neuf PRP après le durcissement de la chaîne
de développement (revue outillée à cinq axes). Aucune autre app touchée.
Mode : `chaud`

## Anomalies

### 1. L'axe de couverture navigateur ne mesure rien sur cette app, et le dit vert

**Symptome** — `./scripts/revue.sh ramure-v2` rend « ok couverture Go 81.7% ».
Pas un mot du navigateur, alors que l'app porte 13 fichiers de test et 167 tests
TypeScript — soit la moitie de son code. `revue_couverture_web` est absent de son
`app.yml`, donc aucune barre n'est posee, donc meme l'avertissement « aucune
barre posee » ne se declenche pas : la cle vide passe pour un choix.

**Cause** — l'axe ne sait lire qu'une seule forme : `node --test
tests/*.test.js`, a la racine de l'app. `ramure-v2` teste son client avec
`vitest`, sous `web/tests/*.test.ts`. Le glob ne matche rien, `web_pct` reste
vide, et le code ne distingue pas « cette app n'a pas de navigateur » de « je
n'ai pas su la mesurer ». C'est exactement le vert silencieux que
`memory/revue.md` dit refuser — « un axe qui ne lit rien doit crier, pas rendre
0 » —, ici sous une quatrieme forme que ses quatre cas connus ne couvraient pas :
non pas un outil qui tombe ou qui lit de travers, mais un outil qui n'est jamais
appele.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'axe doit crier quand une app a des tests navigateur
qu'il ne sait pas lancer, au lieu de rendre un verdict Go seul.

### 2. La moitie du client n'est couverte par aucun test unitaire, et personne ne pouvait le savoir

**Symptome** — mesure faite a la main, l'axe ne la faisant pas (anomalie 1) :
couverture navigateur **53,9 %** de lignes, contre 81,7 % cote Go. Le detail est
plus dur que le total : `main.ts`, **1157 lignes**, tout le cablage de
l'application — routage, montage des ecrans, branchement des evenements — est a
**0 %**. `sw.ts` est a 20,3 %. Les onze autres modules sont entre 84 % et 100 %.

**Cause** — deux causes additionnees. La premiere est structurelle : `main.ts`
est un script d'assemblage a effet de bord immediat, sans fonction exportee ; il
n'y a rien a appeler depuis un test, donc aucun test n'a ete ecrit. La seconde
est que rien ne l'a signale — les 167 tests passent, la revue est verte, et le
seul chiffre affiche est celui du Go. Un module a 0 % dans une app qui annonce
81,7 % : les deux chiffres coexistent sans se contredire parce qu'ils ne parlent
pas du meme code.

**Detecte par** — `auteur`

**Action** — `garde-fou` — meme cause que l'anomalie 1 : un axe qui ne mesure
pas une moitie du code laisse cette moitie deriver sans bruit.

### 3. Le tri de la discographie par appreciation est faux, et ses deux tests ne pouvaient pas le voir

**Symptome** — F-21 demande la discographie triee par appreciation decroissante,
les albums sans note significative rejetes en fin de liste dans leur ordre
d'origine. Sur une liste melangee — un album note 1.0, un sans note, un note
9.0, un sans note, un note 5.0 — la fonction rend l'ordre source inchange :
l'album note 9 reste derriere l'album note 1. Reproduit sur la vraie fonction
pendant l'audit.

**Cause** — le comparateur passe a `sort.SliceStable` rend `false` des que l'un
des deux albums est sous le seuil de votes. Ce n'est pas un ordre strict faible :
la relation n'est pas transitive, deux albums notes peuvent se retrouver
« egaux » via un album non note intercale, et le tri de Go part alors de travers
**en silence**. Les deux tests existants ne comparaient chacun qu'un seul type de
paire — deux notes entre eux, ou deux non-notes entre eux. Aucun ne melangeait
les deux, c'est-a-dire aucun ne testait le cas reel.

**Detecte par** — `relecture`

**Action** — `comportement` — un comparateur se teste sur une liste **melangee**,
pas sur deux paires homogenes. Deux tests verts qui n'exercent jamais la
combinaison sont un cas particulier de couverture menteuse : le pourcentage
monte, la regle n'est pas exercee.

### 4. Deux documents de l'app decrivaient un etat de la serie depasse

**Symptome** — le `README` de l'app annonce « Socle deployable […] Le canevas,
l'arbre et les sources de donnees arrivent aux etapes suivantes » et « Go 1.24,
bibliotheque standard uniquement a ce stade », quarante lignes au-dessus de sa
propre documentation de `/api/centre`, de la collection, du service worker et de
l'installation. `web/tests/REFERENCE.md` annonce 165 tests client et 161
fonctions Go, pour 167 et 164 reels.

**Cause** — les deux fichiers sont ecrits une fois, a l'etape qui les cree, et
rien ne les relit ensuite : aucun controle ne compare un chiffre ecrit dans un
document a la mesure correspondante. Le cas de `REFERENCE.md` est le plus net —
un commit a retouche ce fichier le jour meme ou les compteurs devenaient faux,
sans corriger la table.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un chiffre recopie a la main dans un document derive
en silence. Soit il se genere, soit il ne s'ecrit pas.

### 5. Deux chantiers enchaines sans enregistrement entre les deux

**Symptome** — l'instrumentation de la couverture navigateur et le correctif du
tri de la discographie se sont retrouves dans le meme arbre de travail sale, et
donc dans le meme commit, alors que ce sont deux etapes independantes, relisables
separement.

**Cause** — j'ai lance le second artisan sans passer le greffier entre les deux.
Le greffier fait `git add -A` : une fois les deux chantiers dans l'arbre, il n'y
a plus de decoupage possible sans faire moi-meme le `git add` selectif que le
contrat me retire. Le decoupage en commits se decide **avant** de lancer
l'artisan suivant, pas apres.

**Detecte par** — `auteur`

**Action** — `comportement` — un artisan, puis un greffier, puis l'artisan
suivant. L'ordre n'est pas une preference de style : il est la seule fenetre ou
le decoupage existe encore.


### 6. L'artisan repart en tache de fond malgre le drapeau explicite

**Symptome** — les trois artisans de cette branche ont ete lances avec
`run_in_background: false`, comme le contrat l'exige. Le harnais a repondu
« Async agent launched successfully » aux trois, et a rendu la main
immediatement.

**Cause** — inconnue, cote harnais. Ce n'est pas neuf : `docs/parallelisme.md`
signale deja deux entrees de journal qui rapportent le meme comportement. Troisieme
occurrence, meme drapeau, meme resultat.

**Detecte par** — `auteur`

**Action** — `contrat` — le contrat presente `run_in_background: false` comme la
protection qui empeche deux ecrivains de se marcher dessus. Elle ne protege pas :
c'est la session appelante qui doit **n'en lancer qu'un a la fois**, et le
drapeau ne fait rien pour l'y aider. Le dire ainsi plutot que de repeter un
drapeau sans effet.


### 7. Un test nomme par un PRP peut ne jamais etre ecrit sans que rien ne le voie

**Symptome** — la tache 3 du PRP 06 exige que « le service choisi soit relu du
serveur au demarrage, pas du navigateur ». Le comportement est livre et
fonctionne en production ; aucun test ne l'exerce, ni unitaire ni bout en bout.
Meme famille, un cran plus bas : `textes.suggestionsLabel` etait defini dans le
fichier des libelles et pose nulle part, si bien que la liste de suggestions —
que la tache 2 du meme PRP voulait annoncee — n'avait pas de nom accessible.

**Cause** — les PRP nomment leurs tests un par un, et rien ne verifie ensuite que
le test nomme existe. Le seul controle proche est celui de `--check` sur les
tests cites par `PRODUCT.md`, et il ne cherche pas sous `internal/` : il rend des
`attn` sur des tests qui existent bel et bien, ce qui apprend a ne plus le lire.
Un controle qui crie a tort sur ce qui va couvre ce qui ne va pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un nom de test ecrit dans un PRP ou un PRD est une
promesse verifiable mecaniquement : soit la fonction existe quelque part sous
l'app, soit le document ment. Et le controle existant doit d'abord cesser de se
tromper avant qu'on lui en demande plus.

**Suite, chiffree.** Le controle existant rend **sept** avertissements sur cette
app. Verification faite un par un : **six sont faux** — les tests existent, sous
`internal/`, ou il ne cherche pas. Le septieme est vrai :
`TestCadragePlusEtroitSurEcranEtroit`, que le PRD §14 designe comme la
mitigation du risque « le canevas exige de la place », n'existe nulle part.
`cadragePour` — la fonction qui fait dependre de la largeur le nombre de
branches et d'heritiers — n'a aucun test : tous les tests d'arbre passent
`CadrageLarge` en dur.

Six faux positifs cachaient un vrai. C'est la demonstration exacte de ce que
coute un controle qui crie a tort : non pas du bruit, mais un vrai constat
rendu invisible parmi ses six voisins.

### 8. Une constante de libelle definie et jamais posee ne se voit dans aucun axe

**Symptome** — `textes.suggestionsLabel` etait exporte, jamais reference.
`staticcheck` ne le voit pas — c'est du TypeScript ; `tsc --noEmit` ne le voit
pas non plus — un export non utilise est legitime dans un module ; et la
couverture le comptait comme couvert, puisque le fichier de libelles est
integralement evalue a l'import.

**Cause** — une valeur morte dans un module de constantes est invisible aux cinq
axes a la fois. Elle est pourtant le signe le plus fiable qu'une exigence a ete
a moitie faite : quelqu'un a ecrit le libelle, puis n'a pas pose l'attribut.

**Detecte par** — `relecture`

**Action** — `outillage` — la chaine navigateur n'a aucun detecteur de code mort
cote TypeScript. `tsc --noEmit` n'est pas un remplacant : ce n'est pas son role.

### 9. L'outil de navigation depose ses traces a la racine du depot

**Symptome** — pendant la critique des ecrans, un repertoire `.playwright-mcp/`
apparait a la **racine** du depot, avec journaux de console et instantanes de
page. Il n'est ignore nulle part, donc `git status` le voit, donc le `git add -A`
du greffier l'aurait committe — et il aurait atterri sur `main` avec la pull
request.

**Cause** — l'esthete a pour regle de ne rien ecrire hors du repertoire de son
app ; l'outil de navigation qu'il pilote, lui, n'a pas cette regle et ecrit ou
sa configuration lui dit. La regle porte sur l'agent, pas sur ses outils.

**Detecte par** — `auteur`

**Action** — `garde-fou` — soit le repertoire est ignore, soit l'outil est
configure pour ecrire ailleurs. Un depot ou le passage d'un agent laisse des
fichiers non suivis a la racine finit par les committer : il suffit d'un
greffier lance sans regarder.

### 10. Un agent bloque une heure sans que rien ne le signale

**Symptome** — l'esthete lance a 09h56 n'a plus emis une seule ligne apres
10h00, et n'a rendu aucun fichier. Une heure d'attente, un navigateur ouvert,
l'app demarree, et rien. Aucune notification, aucun code d'erreur : du point de
vue de la session appelante, un agent bloque et un agent qui reflechit
longuement sont indiscernables.

**Cause** — non etablie cote agent. Ce qui est etabli, c'est la facon de s'en
apercevoir : la seule trace exploitable est l'horodatage du fichier de
transcription du sous-agent, sous
`~/.claude/projects/<depot>/<session>/subagents/`. Fige depuis 58 minutes, il
tranche ce qu'aucun autre signal ne disait.

**Detecte par** — `auteur`

**Action** — `comportement` — un agent lance en fin de branche se surveille a la
croissance de sa transcription, pas a l'espoir qu'il rende. Et une mission
longue s'ecrit avec un **premier livrable impose tout de suite** : le second
esthete a recu l'ordre de deposer sa critique squelettique avant de regarder
quoi que ce soit, pour qu'une heure perdue laisse au moins un fichier.

### 11. Une interface francophone sans un seul accent, en ligne depuis le premier jour

**Symptome** — la critique des ecrans a trouve **zero diacritique** dans toute
l'interface : « Gardes recemment », « Deja garde », « Ta session a expire ». Une
app dont le PRD tranche « francophone », dont le vocabulaire est declare
contractuel, affichait un francais sans accents a tous ses visiteurs depuis sa
mise en ligne.

**Cause** — les libelles ont ete ecrits sans accents par commodite de saisie, et
rien ne les relit : `tsc` valide des chaines, la couverture les compte comme
executees, `jscpd` ne les compare pas, et les tests de bout en bout les
selectionnent par le texte **tel qu'il est ecrit** — donc ils passaient au vert
en confirmant l'erreur. Cinq litteraux de test portaient les memes fautes.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un test qui selectionne par un libelle errone valide
le libelle errone. Rien dans la chaine ne regarde la langue de ce qui s'affiche,
alors que la langue est une exigence ecrite du PRD.

### 12. La barre de couverture posee le matin a attrape une regression l'apres-midi

**Symptome** — `test.sh` a echoue : « Coverage for lines (56.45%) does not meet
global threshold (57%) ». La critique des ecrans venait d'ajouter cent vingt-six
lignes a `main.ts`, le fichier a 0 %, ce qui a dilue le ratio sous la barre.

**Cause** — aucune. C'est le garde-fou qui fait exactement ce pour quoi il a ete
pose ce matin, quelques heures apres l'avoir ete, sur du code ecrit par un autre
agent que celui qui l'a installe. Notee ici parce qu'une mesure qui n'a jamais
rien attrape ne prouve rien, et que celle-ci a desormais attrape quelque chose.

**Detecte par** — `test`

**Action** — `rien` — le garde-fou a joue, le code neuf part se faire tester.

### 13. La critique a pris pour un defaut un chargement volontairement differe

**Symptome** — l'esthete signale comme le plus grave de ses constats que
`/api/centre` rend « ok » avec dix branches et **zero heritier**, et que rien a
l'ecran ne dit que la moitie de l'arbre manque. Verification faite : c'est le
comportement voulu — `internal/arbre/centre.go:89` ecrit « les heritiers de
chaque branche restent vides : F-39 les charge ensuite ».

**Cause** — l'esthete regarde l'ecran et n'a pas a lire le serveur, qui est hors
de son perimetre. Un chargement progressif ressemble, sur une capture, a un
chargement incomplet. Ecarte, avec sa raison.

**Detecte par** — `relecture`

**Action** — `rien` — le partage des perimetres a fonctionne : l'esthete a
montre plutot que de decider, et la verification a tranche en deux minutes.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-22 à 12:06 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 2 365 | 0,01 $ |
| Écriture de cache | 2 416 867 | 9,22 $ |
| Lecture de cache | 92 709 932 | 35,50 $ |
| Sortie | 101 668 | 2,17 $ |
| **Total** | **95 230 832** | **46,89 $ — 40,72 €** |

**Ce qui coûte**

- **986 appel(s) au modèle** — un par réponse, outils compris —, dont 840 par des sous-agents — 68 559 155 jetons, 30,92 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 792 jetons, écrits une fois par session puis relus à chaque
  échange : 9 974 840 jetons de relecture, 10 % de tout ce qui a été relu.
- **Tours courts** — 843 des 986 tours (85 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 36,13 $, soit 77 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 792 jetons relus au premier appel qui relise
  quelque chose, 283 176 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 95230832 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68792 0 203
2 principal claude-opus-5 3566 68792 376
3 principal claude-opus-5 7469 72358 418
4 principal claude-opus-5 24640 79827 451
5 principal claude-opus-5 2552 104467 523
6 principal claude-opus-5 1824 107019 598
7 principal claude-opus-5 2806 108843 298
8 principal claude-opus-5 504 111649 1387
9 principal claude-opus-5 2066 112153 1083
10 principal claude-opus-5 3785 114219 6396
11 principal claude-opus-5 10039 118004 404
12 principal claude-opus-5 1974 128043 283
13 principal claude-opus-5 3442 130017 2285
14 principal claude-opus-5 2521 133459 185
15 principal claude-opus-5 885 135980 310
16 principal claude-opus-5 933 136865 388
17 principal claude-opus-5 462 137798 236
18 principal claude-opus-5 1209 138260 1078
19 principal claude-opus-5 4912 139469 724
20 principal claude-opus-5 2254 144381 1748
21 principal claude-opus-5 2833 146635 322
22 principal claude-opus-5 1576 149468 489
23 principal claude-opus-5 616 151044 274
24 principal claude-opus-5 900 151660 539
25 principal claude-opus-5 753 152560 78
26 principal claude-opus-5 3143 153313 1634
27 principal claude-opus-5 10608 156456 1974
28 principal claude-opus-5 1993 167064 247
29 principal claude-opus-5 1168 169057 358
30 principal claude-opus-5 1740 170225 673
31 principal claude-opus-5 4503 171965 2336
32 principal claude-opus-5 4060 176468 1079
33 principal claude-opus-5 1400 180528 1486
34 principal claude-opus-4-7 26921 29208 164
35 principal claude-opus-4-7 252 56129 93
36 principal claude-opus-4-7 280 56381 96
37 principal claude-opus-5 1685 181928 318
38 principal claude-opus-4-7 5440 56661 938
39 principal claude-opus-4-7 5404 62101 943
40 principal claude-opus-5 2056 183613 3826
41 principal claude-opus-5 4332 185669 325
42 principal claude-opus-5 501 190001 1038
43 principal claude-opus-5 1069 190502 458
44 principal claude-opus-5 738 191571 382
45 principal claude-opus-5 984 192309 714
46 principal claude-opus-5 944 193293 28
47 principal claude-opus-5 3896 192309 498
48 principal claude-opus-5 1084 196205 1447
49 principal claude-opus-4-7 20898 29208 165
50 principal claude-opus-4-7 290 50106 124
51 principal claude-opus-4-7 221 50396 84
52 principal claude-opus-4-7 155 50617 94
53 principal claude-opus-4-7 3526 50772 91
54 principal claude-opus-4-7 21732 54298 138
55 principal claude-opus-4-7 2101 76030 93
56 principal claude-opus-5 2056 197289 1770
57 principal claude-opus-4-7 2121 78131 3492
58 principal claude-opus-4-7 3566 80252 69
59 principal claude-opus-5 2163 199345 1339
60 principal claude-opus-5 1370 201508 413
61 principal claude-opus-5 1916 202878 564
62 principal claude-opus-5 830 204794 94
63 principal claude-opus-5 1197 205624 902
64 principal claude-opus-5 1005 206821 18
65 principal claude-opus-5 298 207826 187
66 principal claude-opus-5 343 208124 820
67 principal claude-opus-5 923 208467 20
68 principal claude-opus-5 1813 208124 150
69 principal claude-opus-5 1293 209937 274
70 principal claude-opus-5 2553 211230 1138
71 principal claude-opus-5 1334 213783 1203
72 principal claude-opus-5 1605 215117 256
73 principal claude-opus-5 489 216722 249
74 principal claude-opus-5 1128 217211 491
75 principal claude-opus-5 594 218339 14
76 principal claude-opus-5 285 218947 178
77 principal claude-opus-5 367 219232 657
78 principal claude-opus-5 882 219599 295
79 principal claude-opus-5 3315 220481 1044
80 principal claude-opus-5 1075 223796 14
81 principal claude-opus-5 294 224871 492
82 principal claude-opus-5 592 225165 16
83 principal claude-opus-5 1153 225165 175
84 principal claude-opus-5 468 226318 460
85 principal claude-opus-5 672 226786 439
86 principal claude-opus-5 579 227458 812
87 principal claude-opus-5 1707 228037 1679
88 principal claude-opus-5 2066 229744 671
89 principal claude-opus-5 702 231810 383
90 principal claude-opus-5 484 232512 38
91 principal claude-opus-5 318 232996 149
92 principal claude-opus-5 1006 233314 497
93 principal claude-opus-5 599 234320 25
94 principal claude-opus-5 3758 233314 1613
95 principal claude-opus-5 2918 237072 986
96 principal claude-opus-5 1734 239990 1245
97 principal claude-opus-5 1738 241724 2402
98 principal claude-opus-5 2923 243462 1292
99 principal claude-opus-5 1569 246385 394
100 principal claude-opus-5 497 247954 148
101 principal claude-opus-5 211 248451 516
102 principal claude-opus-5 618 248662 17
103 principal claude-opus-5 1645 249297 455
104 principal claude-opus-5 1063 250942 1579
105 principal claude-opus-4-7 50915 0 153
106 principal claude-opus-4-7 278 50915 123
107 principal claude-opus-4-7 221 51193 73
108 principal claude-opus-4-7 144 51414 84
109 principal claude-opus-4-7 4064 51558 81
110 principal claude-opus-4-7 24277 55622 83
111 principal claude-opus-4-7 10632 79899 82
112 principal claude-opus-4-7 3493 90531 120
113 principal claude-opus-4-7 2083 94024 225
114 principal claude-opus-4-7 3318 96107 78
115 principal claude-opus-5 1775 252005 1389
116 principal claude-opus-5 2019 253780 187
117 principal claude-opus-5 577 255799 368
118 principal claude-opus-4-7 8917 99425 1366
119 principal claude-opus-4-7 1503 108342 126
120 principal claude-opus-5 1521 256376 488
121 principal claude-opus-4-7 1517 109845 1032
122 principal claude-opus-5 769 257897 529
123 principal claude-opus-5 637 258666 195
124 principal claude-opus-5 1529 259303 361
125 principal claude-opus-5 1315 260832 314
126 principal claude-opus-4-7 1812 111362 2740
127 principal claude-opus-5 1124 262147 1323
128 principal claude-opus-5 1482 263271 354
129 principal claude-opus-5 456 264753 11
130 principal claude-opus-5 74 265209 861
131 principal claude-opus-5 1049 265283 22
132 principal claude-opus-5 292 266354 280
133 principal claude-opus-5 866 266646 321
134 principal claude-opus-5 1148 267512 42
135 principal claude-opus-5 2546 268702 2300
136 principal claude-opus-5 2689 271248 364
137 principal claude-opus-5 938 273937 43
138 principal claude-opus-5 106 274875 250
139 principal claude-opus-5 5779 274981 193
140 principal claude-opus-5 421 280760 375
141 principal claude-opus-5 478 281181 7
142 principal claude-opus-5 393 281666 106
143 principal claude-opus-5 542 282059 41
144 principal claude-opus-5 104 282601 358
145 principal claude-opus-5 460 282705 11
146 principal claude-opus-5 2256 283176 1454
147 agent claude-opus-5 32387 0 1
148 agent claude-opus-5 4706 32387 1
149 agent claude-opus-5 528 37093 3
150 agent claude-opus-5 1209 37621 3
151 agent claude-opus-5 6068 38830 7
152 agent claude-opus-5 716 44898 17
153 agent claude-opus-5 4658 45614 2
154 agent claude-opus-5 238 50272 36
155 agent claude-opus-5 169 50510 41
156 agent claude-opus-5 274 50679 40
157 agent claude-opus-5 235 50953 74
158 agent claude-opus-5 134 51188 148
159 agent claude-opus-5 501 51322 3
160 agent claude-opus-5 1509 51823 6
161 agent claude-opus-5 2215 53332 3
162 agent claude-opus-5 3570 55547 3
163 agent claude-opus-5 2003 59117 4
164 agent claude-opus-5 1875 61120 2
165 agent claude-opus-5 1012 62995 578
166 agent claude-opus-5 1623 64007 3
167 agent claude-opus-5 964 65630 17
168 agent claude-opus-5 276 66594 17
169 agent claude-opus-5 2189 66870 2
170 agent claude-opus-5 1723 69059 4
171 agent claude-opus-5 163 70782 40
172 agent claude-opus-5 310 70945 41
173 agent claude-opus-5 231 71255 17
174 agent claude-opus-5 616 71486 2
175 agent claude-opus-5 609 72102 38
176 agent claude-opus-5 1586 72711 2
177 agent claude-opus-5 927 74297 3
178 agent claude-opus-5 239 75224 41
179 agent claude-opus-5 229 75463 20
180 agent claude-opus-5 804 75692 3
181 agent claude-opus-5 1523 76496 2
182 agent claude-opus-5 1120 78019 43
183 agent claude-opus-5 323 79139 16
184 agent claude-opus-5 616 79462 2
185 agent claude-opus-5 3875 80078 3
186 agent claude-opus-5 2764 83953 3
187 agent claude-opus-5 2045 86717 2
188 agent claude-opus-5 2353 88762 4
189 agent claude-opus-5 172 91115 41
190 agent claude-opus-5 235 91287 17
191 agent claude-opus-5 1900 91522 3
192 agent claude-opus-5 1356 93422 39
193 agent claude-opus-5 2107 94778 3
194 agent claude-opus-5 1781 96885 3
195 agent claude-opus-5 821 98666 17
196 agent claude-opus-5 919 99487 17
197 agent claude-opus-5 1094 100406 20
198 agent claude-opus-5 502 101500 17
199 agent claude-opus-5 522 102002 4
200 agent claude-opus-5 2097 102524 3
201 agent claude-opus-5 1924 104621 4
202 agent claude-opus-5 339 106545 39
203 agent claude-opus-5 1617 106884 37
204 agent claude-opus-5 231 108501 16
205 agent claude-opus-5 1898 108732 2
206 agent claude-opus-5 942 110630 41
207 agent claude-opus-5 1117 111572 3
208 agent claude-opus-5 1121 112689 3
209 agent claude-opus-5 1995 113810 3
210 agent claude-opus-5 1249 115805 20
211 agent claude-opus-5 642 117054 20
212 agent claude-opus-5 279 117696 20
213 agent claude-opus-5 192 117975 20
214 agent claude-opus-5 608 118167 20
215 agent claude-opus-5 504 118775 5
216 agent claude-opus-5 2569 119279 20
217 agent claude-opus-5 680 121848 4
218 agent claude-opus-5 552 122528 2
219 agent claude-opus-5 215 123080 17
220 agent claude-opus-5 402 123295 20
221 agent claude-opus-5 718 123697 16
222 agent claude-opus-5 568 124415 4
223 agent claude-opus-5 305 124983 16
224 agent claude-opus-5 769 125288 3
225 agent claude-opus-5 901 126057 3
226 agent claude-opus-5 704 126958 3
227 agent claude-opus-5 1137 127662 20
228 agent claude-opus-5 1343 128799 20
229 agent claude-opus-5 306 130142 16
230 agent claude-opus-5 1394 130448 2
231 agent claude-opus-5 860 131842 2
232 agent claude-opus-5 989 132702 20
233 agent claude-opus-5 261 133691 20
234 agent claude-opus-5 292 133952 20
235 agent claude-opus-5 370 134244 16
236 agent claude-opus-5 468 134614 20
237 agent claude-opus-5 1454 135082 2
238 agent claude-opus-5 541 136536 16
239 agent claude-opus-5 517 137077 17
240 agent claude-opus-5 4980 137594 3
241 agent claude-opus-5 1191 142574 20
242 agent claude-opus-5 724 143765 2
243 agent claude-opus-5 468 144489 20
244 agent claude-opus-5 1185 144957 2
245 agent claude-opus-5 1060 146142 20
246 agent claude-opus-5 742 147202 3
247 agent claude-opus-5 1007 147944 4
248 agent claude-opus-5 385 148951 20
249 agent claude-opus-5 609 149336 4
250 agent claude-opus-5 2034 149945 2
251 agent claude-opus-5 579 151979 20
252 agent claude-opus-5 940 152558 4
253 agent claude-opus-5 1041 153498 2
254 agent claude-opus-5 316 154539 8
255 agent claude-opus-5 5190 154855 3
256 agent claude-opus-5 187 160045 20
257 agent claude-opus-5 286 160232 16
258 agent claude-opus-5 193 160518 16
259 agent claude-opus-5 472 160711 1
260 agent claude-opus-5 432 161183 3
261 agent claude-opus-5 352 161615 121
262 agent claude-opus-5 259 161967 20
263 agent claude-opus-5 437 162226 17
264 agent claude-opus-5 271 162663 38
265 agent claude-opus-5 276 162934 42
266 agent claude-opus-5 247 163210 17
267 agent claude-opus-5 1906 163457 3
268 agent claude-opus-5 363 165363 41
269 agent claude-opus-5 303 165726 41
270 agent claude-opus-5 1513 166029 7
271 agent claude-opus-5 1639 167542 2
272 agent claude-opus-5 1159 169181 2
273 agent claude-opus-5 324 170340 39
274 agent claude-opus-5 1467 170664 2
275 agent claude-opus-5 596 172131 16
276 agent claude-opus-5 622 172727 3
277 agent claude-opus-5 2615 173349 4
278 agent claude-opus-5 3776 175964 3
279 agent claude-opus-5 12197 179740 17
280 agent claude-opus-5 603 191937 17
281 agent claude-opus-5 741 192540 2
282 agent claude-opus-5 1091 193281 2
283 agent claude-opus-5 5189 194372 17
284 agent claude-opus-5 332 199561 17
285 agent claude-opus-5 490 199893 2
286 agent claude-opus-5 763 200383 1
287 agent claude-sonnet-5 5703 9726 4
288 agent claude-sonnet-5 14827 15429 8
289 agent claude-sonnet-5 1876 30256 20
290 agent claude-sonnet-5 1228 32132 2
291 agent claude-sonnet-5 492 33360 20
292 agent claude-sonnet-5 5675 33852 3
293 agent claude-sonnet-5 3928 39527 6
294 agent claude-sonnet-5 8619 43455 3
295 agent claude-sonnet-5 5017 52074 6
296 agent claude-sonnet-5 681 57091 21
297 agent claude-sonnet-5 12327 57772 4
298 agent claude-sonnet-5 1592 70099 6
299 agent claude-sonnet-5 1198 71691 7
300 agent claude-sonnet-5 1644 72889 2
301 agent claude-sonnet-5 2760 74533 4
302 agent claude-sonnet-5 432 77293 14
303 agent claude-sonnet-5 320 77725 16
304 agent claude-sonnet-5 2730 78045 2
305 agent claude-sonnet-5 275 80775 5
306 agent claude-sonnet-5 215 81050 2
307 agent claude-sonnet-5 280 81265 8
308 agent claude-sonnet-5 1370 81545 3
309 agent claude-sonnet-5 311 82915 4
310 agent claude-sonnet-5 751 83226 3
311 agent claude-sonnet-5 496 83977 2
312 agent claude-sonnet-5 666 84473 2
313 agent claude-sonnet-5 2344 85139 7
314 agent claude-sonnet-5 674 87483 20
315 agent claude-sonnet-5 273 88157 2
316 agent claude-sonnet-5 292 88430 7
317 agent claude-sonnet-5 1011 88722 2
318 agent claude-sonnet-5 481 89733 3
319 agent claude-sonnet-5 1390 90214 6
320 agent claude-sonnet-5 445 91604 21
321 agent claude-sonnet-5 421 92049 3
322 agent claude-sonnet-5 1798 92470 3
323 agent claude-sonnet-5 1931 94268 2
324 agent claude-sonnet-5 285 96199 3
325 agent claude-sonnet-5 298 96484 3
326 agent claude-sonnet-5 1356 96782 2
327 agent claude-sonnet-5 1280 98138 2
328 agent claude-sonnet-5 2587 99418 2
329 agent claude-sonnet-5 255 102005 5
330 agent claude-sonnet-5 1328 102260 2
331 agent claude-sonnet-5 3033 103588 4
332 agent claude-sonnet-5 362 106621 4
333 agent claude-sonnet-5 1440 106983 6
334 agent claude-sonnet-5 323 108423 9
335 agent claude-sonnet-5 567 108746 3
336 agent claude-sonnet-5 1639 109313 2
337 agent claude-sonnet-5 683 110952 1
338 agent claude-sonnet-5 5607 9726 2
339 agent claude-sonnet-5 36352 15333 5
340 agent claude-sonnet-5 15202 51685 6
341 agent claude-sonnet-5 7614 66887 2
342 agent claude-sonnet-5 4656 74501 5
343 agent claude-sonnet-5 1290 79157 1
344 agent claude-sonnet-5 1779 80447 3
345 agent claude-sonnet-5 1517 82226 1
346 agent claude-sonnet-5 474 83743 2
347 agent claude-sonnet-5 455 84217 4
348 agent claude-sonnet-5 639 84672 3
349 agent claude-sonnet-5 1331 85311 2
350 agent claude-sonnet-5 5171 86642 2
351 agent claude-sonnet-5 2582 91813 1
352 agent claude-sonnet-5 1067 94395 2
353 agent claude-sonnet-5 18961 0 2
354 agent claude-sonnet-5 2532 18961 5
355 agent claude-sonnet-5 383 21493 20
356 agent claude-sonnet-5 139 21876 2
357 agent claude-sonnet-5 7973 22015 2
358 agent claude-sonnet-5 6199 29988 5
359 agent claude-sonnet-5 2038 36187 20
360 agent claude-sonnet-5 3766 38225 3
361 agent claude-sonnet-5 666 41991 139
362 agent claude-sonnet-5 1622 42657 3
363 agent claude-sonnet-5 2972 44279 3
364 agent claude-sonnet-5 1963 47251 2
365 agent claude-sonnet-5 3233 49214 2
366 agent claude-sonnet-5 1670 52447 3
367 agent claude-sonnet-5 7052 54117 3
368 agent claude-sonnet-5 1607 61169 2
369 agent claude-sonnet-5 2419 62776 20
370 agent claude-sonnet-5 1841 65195 2
371 agent claude-sonnet-5 3281 67036 2
372 agent claude-sonnet-5 3297 70317 4
373 agent claude-sonnet-5 1849 73614 7
374 agent claude-sonnet-5 619 75463 20
375 agent claude-sonnet-5 1333 76082 7
376 agent claude-sonnet-5 1026 77415 3
377 agent claude-sonnet-5 1976 78441 2
378 agent claude-sonnet-5 1120 80417 6
379 agent claude-sonnet-5 1044 81537 16
380 agent claude-sonnet-5 367 82581 2
381 agent claude-sonnet-5 1969 82948 3
382 agent claude-sonnet-5 351 84917 20
383 agent claude-sonnet-5 982 85268 4
384 agent claude-sonnet-5 882 86250 2
385 agent claude-sonnet-5 320 87132 2
386 agent claude-sonnet-5 1899 87452 4
387 agent claude-sonnet-5 799 89351 20
388 agent claude-sonnet-5 401 90150 2
389 agent claude-sonnet-5 2861 90551 8
390 agent claude-sonnet-5 2437 93412 20
391 agent claude-sonnet-5 2085 95849 2
392 agent claude-sonnet-5 172 97934 20
393 agent claude-sonnet-5 1300 98106 2
394 agent claude-sonnet-5 368 99406 3
395 agent claude-sonnet-5 836 99774 2
396 agent claude-sonnet-5 2522 100610 1
397 agent claude-sonnet-5 1160 103132 3
398 agent claude-sonnet-5 880 104292 3
399 agent claude-sonnet-5 309 105172 5
400 agent claude-sonnet-5 182 105481 20
401 agent claude-sonnet-5 4827 105663 2
402 agent claude-sonnet-5 449 110490 6
403 agent claude-sonnet-5 864 110939 2
404 agent claude-sonnet-5 632 111803 17
405 agent claude-sonnet-5 362 112435 6
406 agent claude-sonnet-5 354 112797 4
407 agent claude-sonnet-5 1468 113151 3
408 agent claude-sonnet-5 5657 114619 3
409 agent claude-sonnet-5 333 120276 3
410 agent claude-sonnet-5 248 120609 2
411 agent claude-sonnet-5 375 120857 16
412 agent claude-sonnet-5 338 121232 3
413 agent claude-sonnet-5 274 121570 5
414 agent claude-sonnet-5 3005 121844 3
415 agent claude-sonnet-5 2420 124849 1
416 agent claude-sonnet-5 776 127269 4
417 agent claude-sonnet-5 386 128045 7
418 agent claude-sonnet-5 1321 128431 2
419 agent claude-sonnet-5 2145 129752 5
420 agent claude-sonnet-5 520 131897 2
421 agent claude-sonnet-5 488 132417 2
422 agent claude-haiku-4-5-20251001 12144 0 1
423 agent claude-haiku-4-5-20251001 1803 12144 2
424 agent claude-haiku-4-5-20251001 1134 13947 3
425 agent claude-haiku-4-5-20251001 8849 15081 2
426 agent claude-haiku-4-5-20251001 551 23930 2
427 agent claude-haiku-4-5-20251001 2225 24481 2
428 agent claude-haiku-4-5-20251001 302 26706 2
429 agent claude-sonnet-5 5702 9726 5
430 agent claude-sonnet-5 20998 15428 5
431 agent claude-sonnet-5 1679 36426 3
432 agent claude-sonnet-5 5488 38105 3
433 agent claude-sonnet-5 7538 43593 2
434 agent claude-sonnet-5 13404 51131 1
435 agent claude-sonnet-5 10535 64535 2
436 agent claude-sonnet-5 3397 75070 1
437 agent claude-sonnet-5 4407 78467 2
438 agent claude-sonnet-5 1777 82874 1
439 agent claude-sonnet-5 1444 84651 3
440 agent claude-sonnet-5 914 86095 2
441 agent claude-sonnet-5 417 87009 2
442 agent claude-sonnet-5 2640 87426 2
443 agent claude-sonnet-5 1372 90066 2
444 agent claude-sonnet-5 1352 91438 1
445 agent claude-sonnet-5 199 92790 1
446 agent claude-sonnet-5 5762 9726 4
447 agent claude-sonnet-5 8120 15488 5
448 agent claude-sonnet-5 4313 23608 2
449 agent claude-sonnet-5 5131 27921 6
450 agent claude-sonnet-5 3554 33052 10
451 agent claude-sonnet-5 1248 36606 3
452 agent claude-sonnet-5 260 37854 3
453 agent claude-sonnet-5 701 38114 2
454 agent claude-sonnet-5 1094 38815 2
455 agent claude-sonnet-5 952 39909 3
456 agent claude-sonnet-5 874 40861 2
457 agent claude-sonnet-5 1104 41735 5
458 agent claude-sonnet-5 964 42839 3
459 agent claude-sonnet-5 2866 43803 3
460 agent claude-sonnet-5 1611 46669 7
461 agent claude-sonnet-5 2269 48280 3
462 agent claude-sonnet-5 549 50549 9
463 agent claude-sonnet-5 1074 51098 8
464 agent claude-sonnet-5 5530 52172 2
465 agent claude-sonnet-5 1592 57702 3
466 agent claude-sonnet-5 1529 59294 2
467 agent claude-sonnet-5 625 60823 6
468 agent claude-sonnet-5 938 61448 2
469 agent claude-sonnet-5 1437 62386 4
470 agent claude-sonnet-5 4101 63823 2
471 agent claude-sonnet-5 879 67924 9
472 agent claude-sonnet-5 1684 68803 3
473 agent claude-sonnet-5 1037 70487 1
474 agent claude-sonnet-5 1356 71524 2
475 agent claude-sonnet-5 2253 72880 8
476 agent claude-sonnet-5 484 75133 21
477 agent claude-sonnet-5 1345 75617 6
478 agent claude-sonnet-5 1025 76962 2
479 agent claude-sonnet-5 883 77987 2
480 agent claude-sonnet-5 3159 78870 2
481 agent claude-sonnet-5 427 82029 2
482 agent claude-sonnet-5 350 82456 2
483 agent claude-sonnet-5 558 82806 9
484 agent claude-sonnet-5 215 83364 4
485 agent claude-sonnet-5 5824 9726 3
486 agent claude-sonnet-5 11099 15550 5
487 agent claude-sonnet-5 1620 26649 2
488 agent claude-sonnet-5 2574 28269 2
489 agent claude-sonnet-5 5803 30843 8
490 agent claude-sonnet-5 10110 36646 1
491 agent claude-sonnet-5 11523 46756 1
492 agent claude-sonnet-5 7289 58279 10
493 agent claude-sonnet-5 4786 65568 1
494 agent claude-sonnet-5 438 70354 20
495 agent claude-sonnet-5 6835 70792 4
496 agent claude-sonnet-5 5059 77627 3
497 agent claude-sonnet-5 477 82686 14
498 agent claude-sonnet-5 3674 83163 8
499 agent claude-sonnet-5 539 86837 3
500 agent claude-sonnet-5 3072 87376 3
501 agent claude-sonnet-5 373 90448 14
502 agent claude-sonnet-5 3392 90821 2
503 agent claude-sonnet-5 280 94213 2
504 agent claude-sonnet-5 412 94493 14
505 agent claude-sonnet-5 4838 94905 3
506 agent claude-sonnet-5 2513 99743 6
507 agent claude-sonnet-5 231 102256 2
508 agent claude-sonnet-5 2245 102487 4
509 agent claude-sonnet-5 3116 104732 1
510 agent claude-sonnet-5 1305 107848 1
511 agent claude-sonnet-5 299 109153 3
512 agent claude-sonnet-5 2242 109452 1
513 agent claude-sonnet-5 1402 111694 7
514 agent claude-sonnet-5 3578 113096 6
515 agent claude-sonnet-5 1208 116674 3
516 agent claude-sonnet-5 1459 117882 3
517 agent claude-sonnet-5 939 119341 2
518 agent claude-sonnet-5 2805 120280 1
519 agent claude-sonnet-5 321 123085 3
520 agent claude-sonnet-5 646 123406 1
521 agent claude-haiku-4-5-20251001 4832 6769 5
522 agent claude-haiku-4-5-20251001 1497 11601 2
523 agent claude-haiku-4-5-20251001 15076 13098 2
524 agent claude-haiku-4-5-20251001 1133 28174 1
525 agent claude-haiku-4-5-20251001 1236 29307 2
526 agent claude-haiku-4-5-20251001 917 30543 1
527 agent claude-haiku-4-5-20251001 465 31460 2
528 agent claude-sonnet-5 5636 9726 5
529 agent claude-sonnet-5 14261 15362 5
530 agent claude-sonnet-5 11837 29623 3
531 agent claude-sonnet-5 2719 41460 2
532 agent claude-sonnet-5 8067 44179 3
533 agent claude-sonnet-5 6144 52246 2
534 agent claude-sonnet-5 5784 58390 5
535 agent claude-sonnet-5 3641 64174 2
536 agent claude-sonnet-5 6140 67815 1
537 agent claude-sonnet-5 4725 73955 1
538 agent claude-sonnet-5 5013 78680 2
539 agent claude-sonnet-5 800 83693 3
540 agent claude-sonnet-5 415 84493 20
541 agent claude-sonnet-5 4475 84908 2
542 agent claude-sonnet-5 5136 89383 3
543 agent claude-sonnet-5 981 94519 3
544 agent claude-sonnet-5 1218 95500 3
545 agent claude-sonnet-5 905 96718 2
546 agent claude-sonnet-5 2026 97623 21
547 agent claude-sonnet-5 430 99649 3
548 agent claude-sonnet-5 1066 100079 6
549 agent claude-sonnet-5 936 101145 7
550 agent claude-sonnet-5 286 102081 9
551 agent claude-sonnet-5 1306 102367 3
552 agent claude-sonnet-5 278 103673 3
553 agent claude-sonnet-5 1631 103951 9
554 agent claude-sonnet-5 4722 105582 6
555 agent claude-sonnet-5 190 110304 2
556 agent claude-sonnet-5 245 110494 1
557 agent claude-sonnet-5 15397 0 2
558 agent claude-sonnet-5 5780 15397 4
559 agent claude-sonnet-5 57095 21177 4
560 agent claude-sonnet-5 25208 78272 7
561 agent claude-sonnet-5 8893 103480 3
562 agent claude-sonnet-5 1258 112373 2
563 agent claude-sonnet-5 6837 113631 2
564 agent claude-sonnet-5 3491 120468 1
565 agent claude-sonnet-5 509 123959 4
566 agent claude-sonnet-5 997 124468 2
567 agent claude-sonnet-5 1968 125465 3
568 agent claude-sonnet-5 3068 127433 2
569 agent claude-sonnet-5 1891 130501 9
570 agent claude-sonnet-5 19128 0 2
571 agent claude-sonnet-5 2378 19128 4
572 agent claude-sonnet-5 7746 21506 10
573 agent claude-sonnet-5 10170 29252 8
574 agent claude-sonnet-5 1282 39422 2
575 agent claude-sonnet-5 278 40704 6
576 agent claude-sonnet-5 1439 40982 2
577 agent claude-sonnet-5 4412 42421 4
578 agent claude-sonnet-5 1288 46833 3
579 agent claude-sonnet-5 741 48121 2
580 agent claude-sonnet-5 1150 48862 6
581 agent claude-sonnet-5 637 50012 6
582 agent claude-sonnet-5 441 50649 20
583 agent claude-sonnet-5 163 51090 20
584 agent claude-sonnet-5 4494 51253 1
585 agent claude-sonnet-5 530 55747 3
586 agent claude-sonnet-5 534 56277 3
587 agent claude-sonnet-5 405 56811 20
588 agent claude-sonnet-5 762 57216 6
589 agent claude-sonnet-5 2991 57978 3
590 agent claude-sonnet-5 1561 60969 5
591 agent claude-sonnet-5 2565 62530 3
592 agent claude-sonnet-5 1403 65095 3
593 agent claude-sonnet-5 289 66498 20
594 agent claude-sonnet-5 325 66787 5
595 agent claude-sonnet-5 1912 67112 5
596 agent claude-sonnet-5 289 69024 20
597 agent claude-sonnet-5 1630 69313 6
598 agent claude-sonnet-5 826 70943 21
599 agent claude-sonnet-5 4106 71769 2
600 agent claude-sonnet-5 1865 75875 5
601 agent claude-sonnet-5 652 77740 5
602 agent claude-sonnet-5 1638 78392 3
603 agent claude-sonnet-5 253 80030 2
604 agent claude-sonnet-5 221 80283 3
605 agent claude-sonnet-5 342 80504 21
606 agent claude-sonnet-5 582 80846 2
607 agent claude-sonnet-5 603 81428 20
608 agent claude-sonnet-5 1631 82031 2
609 agent claude-sonnet-5 716 83662 2
610 agent claude-sonnet-5 695 84378 2
611 agent claude-sonnet-5 1458 85073 5
612 agent claude-sonnet-5 466 86531 5
613 agent claude-sonnet-5 1244 86997 3
614 agent claude-sonnet-5 1157 88241 7
615 agent claude-sonnet-5 1604 89398 5
616 agent claude-sonnet-5 177 91002 20
617 agent claude-sonnet-5 530 91179 2
618 agent claude-sonnet-5 212 91709 2
619 agent claude-sonnet-5 225 91921 1
620 agent claude-sonnet-5 739 92146 5
621 agent claude-sonnet-5 175 92885 20
622 agent claude-sonnet-5 148 93060 2
623 agent claude-sonnet-5 1323 93208 2
624 agent claude-sonnet-5 2263 94531 2
625 agent claude-sonnet-5 1617 96794 4
626 agent claude-sonnet-5 814 98411 3
627 agent claude-sonnet-5 2171 99225 1
628 agent claude-sonnet-5 150 101396 20
629 agent claude-sonnet-5 2236 101546 1
630 agent claude-sonnet-5 328 103782 5
631 agent claude-sonnet-5 447 104110 5
632 agent claude-sonnet-5 313 104557 3
633 agent claude-sonnet-5 768 104870 1
634 agent claude-sonnet-5 874 105638 3
635 agent claude-sonnet-5 1428 106512 2
636 agent claude-sonnet-5 642 107940 20
637 agent claude-sonnet-5 3107 108582 2
638 agent claude-sonnet-5 535 111689 3
639 agent claude-sonnet-5 1214 112224 6
640 agent claude-sonnet-5 1492 113438 2
641 agent claude-sonnet-5 2170 114930 7
642 agent claude-sonnet-5 573 117100 9
643 agent claude-sonnet-5 1300 117673 6
644 agent claude-sonnet-5 1001 118973 2
645 agent claude-sonnet-5 354 119974 20
646 agent claude-sonnet-5 852 120328 3
647 agent claude-sonnet-5 1537 121180 3
648 agent claude-sonnet-5 215 122717 20
649 agent claude-sonnet-5 531 122932 6
650 agent claude-sonnet-5 496 123463 1
651 agent claude-sonnet-5 1230 123959 2
652 agent claude-sonnet-5 2151 125189 2
653 agent claude-sonnet-5 372 127340 2
654 agent claude-sonnet-5 453 127712 20
655 agent claude-sonnet-5 1166 128165 3
656 agent claude-sonnet-5 1164 129331 1
657 agent claude-sonnet-5 402 130495 1
658 agent claude-opus-5 31960 0 1
659 agent claude-opus-5 4738 31960 1
660 agent claude-opus-5 3195 36698 7
661 agent claude-opus-5 2309 39893 17
662 agent claude-opus-5 5318 42202 5
663 agent claude-opus-5 1496 47520 3
664 agent claude-opus-5 5368 49016 2
665 agent claude-opus-5 4264 54384 2
666 agent claude-opus-5 833 58648 17
667 agent claude-opus-5 1019 59481 17
668 agent claude-opus-5 836 60500 3
669 agent claude-opus-5 455 61336 17
670 agent claude-opus-5 1733 61791 3
671 agent claude-opus-5 510 63524 3
672 agent claude-opus-5 299 64034 20
673 agent claude-opus-5 258 64333 2
674 agent claude-opus-5 371 64591 87
675 agent claude-opus-5 169 64962 40
676 agent claude-opus-5 276 65131 41
677 agent claude-opus-5 266 65407 17
678 agent claude-opus-5 1446 65673 2
679 agent claude-opus-5 1047 67119 3
680 agent claude-opus-5 906 68166 38
681 agent claude-opus-5 213 69072 40
682 agent claude-opus-5 468 69285 41
683 agent claude-opus-5 411 69753 9
684 agent claude-haiku-4-5-20251001 12261 0 1
685 agent claude-haiku-4-5-20251001 1644 12261 2
686 agent claude-haiku-4-5-20251001 807 13905 1
687 agent claude-haiku-4-5-20251001 3389 14712 2
688 agent claude-haiku-4-5-20251001 1331 18101 3
689 agent claude-haiku-4-5-20251001 358 19432 4
690 agent claude-haiku-4-5-20251001 12054 0 1
691 agent claude-haiku-4-5-20251001 1277 12054 1
692 agent claude-haiku-4-5-20251001 828 13331 1
693 agent claude-sonnet-5 7329 12065 2
694 agent claude-sonnet-5 2374 19394 8
695 agent claude-sonnet-5 416 21768 20
696 agent claude-sonnet-5 640 22184 5
697 agent claude-sonnet-5 388 22824 20
698 agent claude-sonnet-5 23519 23212 10
699 agent claude-sonnet-5 9048 46731 7
700 agent claude-sonnet-5 638 55779 20
701 agent claude-sonnet-5 638 56417 20
702 agent claude-sonnet-5 735 57055 6
703 agent claude-sonnet-5 403 57790 2
704 agent claude-sonnet-5 345 58193 4
705 agent claude-sonnet-5 691 58538 20
706 agent claude-sonnet-5 343 59229 5
707 agent claude-sonnet-5 574 59572 6
708 agent claude-sonnet-5 1436 60146 14
709 agent claude-sonnet-5 1771 61582 6
710 agent claude-sonnet-5 1047 63353 3
711 agent claude-sonnet-5 294 64400 20
712 agent claude-sonnet-5 725 64694 3
713 agent claude-sonnet-5 2884 65419 2
714 agent claude-sonnet-5 728 68303 7
715 agent claude-sonnet-5 960 69031 6
716 agent claude-sonnet-5 609 69991 4
717 agent claude-sonnet-5 845 70600 7
718 agent claude-sonnet-5 284 71445 4
719 agent claude-sonnet-5 1463 71729 3
720 agent claude-sonnet-5 419 73192 20
721 agent claude-sonnet-5 208 73611 3
722 agent claude-sonnet-5 1083 73819 3
723 agent claude-sonnet-5 1051 74902 4
724 agent claude-sonnet-5 3226 75953 3
725 agent claude-sonnet-5 863 79179 5
726 agent claude-sonnet-5 982 80042 4
727 agent claude-sonnet-5 272 81024 1
728 agent claude-sonnet-5 331 81296 17
729 agent claude-sonnet-5 396 81627 3
730 agent claude-sonnet-5 814 82023 4
731 agent claude-sonnet-5 344 82837 20
732 agent claude-sonnet-5 414 83181 20
733 agent claude-sonnet-5 364 83595 3
734 agent claude-sonnet-5 1042 83959 4
735 agent claude-sonnet-5 302 85001 6
736 agent claude-sonnet-5 281 85303 2
737 agent claude-sonnet-5 411 85584 20
738 agent claude-sonnet-5 445 85995 4
739 agent claude-sonnet-5 187 86440 8
740 agent claude-sonnet-5 314 86627 17
741 agent claude-sonnet-5 382 86941 2
742 agent claude-sonnet-5 302 87323 20
743 agent claude-sonnet-5 814 87625 20
744 agent claude-sonnet-5 774 88439 5
745 agent claude-sonnet-5 309 89213 21
746 agent claude-sonnet-5 4427 89522 4
747 agent claude-sonnet-5 252 93949 2
748 agent claude-sonnet-5 293 94201 4
749 agent claude-sonnet-5 337 94494 20
750 agent claude-sonnet-5 4228 94831 2
751 agent claude-sonnet-5 217 99059 14
752 agent claude-sonnet-5 951 99276 17
753 agent claude-sonnet-5 660 100227 3
754 agent claude-sonnet-5 257 100887 7
755 agent claude-sonnet-5 332 101144 5
756 agent claude-sonnet-5 1808 101476 5
757 agent claude-sonnet-5 967 103284 5
758 agent claude-sonnet-5 187 104251 20
759 agent claude-sonnet-5 513 104438 16
760 agent claude-sonnet-5 620 104951 3
761 agent claude-sonnet-5 515 105571 3
762 agent claude-sonnet-5 723 106086 5
763 agent claude-sonnet-5 923 106809 7
764 agent claude-sonnet-5 3316 107732 9
765 agent claude-sonnet-5 6329 111048 3
766 agent claude-sonnet-5 1188 117377 3
767 agent claude-sonnet-5 1320 118565 2
768 agent claude-sonnet-5 761 119885 3
769 agent claude-sonnet-5 2140 120646 1
770 agent claude-sonnet-5 959 122786 20
771 agent claude-sonnet-5 2212 123745 1
772 agent claude-sonnet-5 3798 125957 3
773 agent claude-sonnet-5 685 129755 3
774 agent claude-sonnet-5 904 130440 1
775 agent claude-sonnet-5 1283 131344 1
776 agent claude-sonnet-5 192 132627 4
777 agent claude-sonnet-5 231 132819 20
778 agent claude-sonnet-5 1079 133050 2
779 agent claude-sonnet-5 6850 134129 2
780 agent claude-sonnet-5 187 140979 1
781 agent claude-sonnet-5 5729 9726 4
782 agent claude-sonnet-5 6346 15455 2
783 agent claude-sonnet-5 33965 21801 4
784 agent claude-sonnet-5 11893 55766 3
785 agent claude-sonnet-5 1344 67659 5
786 agent claude-sonnet-5 12040 69003 7
787 agent claude-sonnet-5 3410 81043 2
788 agent claude-sonnet-5 5405 84453 2
789 agent claude-sonnet-5 2801 89858 7
790 agent claude-sonnet-5 822 92659 2
791 agent claude-sonnet-5 1403 93481 20
792 agent claude-sonnet-5 2202 94884 2
793 agent claude-sonnet-5 6089 97086 2
794 agent claude-sonnet-5 3079 103175 6
795 agent claude-sonnet-5 2584 106254 3
796 agent claude-sonnet-5 381 108838 2
797 agent claude-sonnet-5 305 109219 21
798 agent claude-sonnet-5 1964 109524 3
799 agent claude-sonnet-5 3151 111488 3
800 agent claude-sonnet-5 2487 114639 5
801 agent claude-sonnet-5 1344 117126 3
802 agent claude-sonnet-5 445 118470 3
803 agent claude-sonnet-5 579 118915 5
804 agent claude-sonnet-5 4092 119494 3
805 agent claude-sonnet-5 696 123586 7
806 agent claude-sonnet-5 2384 124282 3
807 agent claude-sonnet-5 418 126666 3
808 agent claude-sonnet-5 837 127084 3
809 agent claude-sonnet-5 878 127921 2
810 agent claude-sonnet-5 870 128799 2
811 agent claude-sonnet-5 6533 12065 3
812 agent claude-sonnet-5 2378 18598 5
813 agent claude-sonnet-5 7677 20976 2
814 agent claude-sonnet-5 1177 28653 3
815 agent claude-sonnet-5 738 29830 2
816 agent claude-sonnet-5 1059 30568 5
817 agent claude-sonnet-5 741 31627 4
818 agent claude-sonnet-5 1074 32368 2
819 agent claude-sonnet-5 718 33442 2
820 agent claude-sonnet-5 1399 34160 5
821 agent claude-sonnet-5 1855 35559 3
822 agent claude-sonnet-5 1061 37414 2
823 agent claude-sonnet-5 235 38475 7
824 agent claude-sonnet-5 429 38710 9
825 agent claude-sonnet-5 906 39139 3
826 agent claude-sonnet-5 315 40045 2
827 agent claude-sonnet-5 1918 40360 5
828 agent claude-sonnet-5 1315 42278 3
829 agent claude-sonnet-5 264 43593 309
830 agent claude-sonnet-5 1521 43857 2
831 agent claude-sonnet-5 483 45378 2
832 agent claude-sonnet-5 2167 45861 6
833 agent claude-sonnet-5 922 48028 2
834 agent claude-sonnet-5 1173 48950 3
835 agent claude-sonnet-5 1571 50123 2
836 agent claude-sonnet-5 634 51694 2
837 agent claude-sonnet-5 163 52328 3
838 agent claude-sonnet-5 579 52491 3
839 agent claude-sonnet-5 2200 53070 7
840 agent claude-sonnet-5 1959 55270 20
841 agent claude-sonnet-5 782 57229 2
842 agent claude-sonnet-5 416 58011 6
843 agent claude-sonnet-5 5266 58427 3
844 agent claude-sonnet-5 2631 63693 3
845 agent claude-sonnet-5 455 66324 1
846 agent claude-sonnet-5 911 66779 6
847 agent claude-sonnet-5 493 67690 5
848 agent claude-sonnet-5 1492 68183 1
849 agent claude-sonnet-5 2227 69675 2
850 agent claude-sonnet-5 388 71902 1
851 agent claude-sonnet-5 5678 9726 3
852 agent claude-sonnet-5 9801 15404 2
853 agent claude-sonnet-5 2211 25205 4
854 agent claude-sonnet-5 6638 27416 3
855 agent claude-sonnet-5 10289 34054 2
856 agent claude-sonnet-5 5813 44343 2
857 agent claude-sonnet-5 4930 50156 2
858 agent claude-sonnet-5 609 55086 14
859 agent claude-sonnet-5 2727 55695 6
860 agent claude-sonnet-5 2105 58422 2
861 agent claude-sonnet-5 2584 60527 2
862 agent claude-sonnet-5 2582 63111 2
863 agent claude-sonnet-5 320 65693 4
864 agent claude-sonnet-5 1982 66013 2
865 agent claude-sonnet-5 836 67995 3
866 agent claude-sonnet-5 1892 68831 3
867 agent claude-sonnet-5 2739 70723 3
868 agent claude-sonnet-5 6364 73462 3
869 agent claude-sonnet-5 2780 79826 2
870 agent claude-sonnet-5 566 82606 2
871 agent claude-sonnet-5 398 83172 20
872 agent claude-sonnet-5 394 83570 3
873 agent claude-haiku-4-5-20251001 11838 0 8
874 agent claude-haiku-4-5-20251001 1387 11838 2
875 agent claude-haiku-4-5-20251001 839 13225 2
876 agent claude-haiku-4-5-20251001 1363 14064 2
877 agent claude-haiku-4-5-20251001 842 15427 104
878 agent claude-haiku-4-5-20251001 279 16269 2
879 agent claude-sonnet-5 15909 0 8
880 agent claude-sonnet-5 12607 15909 5
881 agent claude-sonnet-5 18919 28516 2
882 agent claude-sonnet-5 1502 47435 20
883 agent claude-sonnet-5 2597 48937 2
884 agent claude-sonnet-5 4181 51534 2
885 agent claude-sonnet-5 1491 55715 20
886 agent claude-sonnet-5 4110 57206 2
887 agent claude-sonnet-5 739 61316 20
888 agent claude-sonnet-5 1778 62055 2
889 agent claude-sonnet-5 2818 63833 2
890 agent claude-sonnet-5 4502 66651 3
891 agent claude-sonnet-5 1071 71153 20
892 agent claude-sonnet-5 1988 72224 4
893 agent claude-sonnet-5 466 74212 5
894 agent claude-sonnet-5 979 74678 6
895 agent claude-sonnet-5 1185 75657 1
896 agent claude-sonnet-5 1062 76842 20
897 agent claude-sonnet-5 2796 77904 4
898 agent claude-sonnet-5 760 80700 3
899 agent claude-sonnet-5 426 81460 9
900 agent claude-sonnet-5 743 81886 5
901 agent claude-sonnet-5 543 82629 3
902 agent claude-sonnet-5 358 83172 8
903 agent claude-sonnet-5 1119 83530 7
904 agent claude-sonnet-5 1139 84649 3
905 agent claude-sonnet-5 1659 85788 20
906 agent claude-sonnet-5 1995 87447 7
907 agent claude-sonnet-5 343 89442 3
908 agent claude-sonnet-5 686 89785 9
909 agent claude-sonnet-5 699 90471 5
910 agent claude-sonnet-5 1603 91170 3
911 agent claude-sonnet-5 1869 92773 2
912 agent claude-sonnet-5 278 94642 3
913 agent claude-sonnet-5 813 94920 2
914 agent claude-sonnet-5 1368 95733 20
915 agent claude-sonnet-5 1394 97101 3
916 agent claude-sonnet-5 334 98495 2
917 agent claude-sonnet-5 352 98829 4
918 agent claude-sonnet-5 435 99181 5
919 agent claude-sonnet-5 322 99616 2
920 agent claude-sonnet-5 339 99938 4
921 agent claude-sonnet-5 1258 100277 3
922 agent claude-sonnet-5 501 101535 16
923 agent claude-sonnet-5 1038 102036 2
924 agent claude-sonnet-5 432 103074 21
925 agent claude-sonnet-5 196 103506 20
926 agent claude-sonnet-5 1600 103702 6
927 agent claude-sonnet-5 874 105302 4
928 agent claude-sonnet-5 433 106176 20
929 agent claude-sonnet-5 607 106609 9
930 agent claude-sonnet-5 1352 107216 20
931 agent claude-sonnet-5 2301 108568 2
932 agent claude-sonnet-5 324 110869 2
933 agent claude-sonnet-5 643 111193 2
934 agent claude-sonnet-5 794 111836 3
935 agent claude-sonnet-5 341 112630 20
936 agent claude-sonnet-5 332 112971 2
937 agent claude-sonnet-5 301 113303 2
938 agent claude-sonnet-5 819 113604 20
939 agent claude-sonnet-5 171 114423 5
940 agent claude-sonnet-5 1530 114594 7
941 agent claude-sonnet-5 2031 116124 2
942 agent claude-sonnet-5 1811 118155 2
943 agent claude-sonnet-5 2564 119966 3
944 agent claude-sonnet-5 18314 0 3
945 agent claude-sonnet-5 3398 18314 5
946 agent claude-sonnet-5 1634 21712 7
947 agent claude-sonnet-5 263 23346 2
948 agent claude-sonnet-5 595 23609 2
949 agent claude-sonnet-5 492 24204 2
950 agent claude-sonnet-5 704 24696 9
951 agent claude-sonnet-5 413 25400 20
952 agent claude-sonnet-5 1248 25813 2
953 agent claude-sonnet-5 234 27061 2
954 agent claude-sonnet-5 295 27295 20
955 agent claude-sonnet-5 817 27590 2
956 agent claude-sonnet-5 296 28407 2
957 agent claude-sonnet-5 1694 28703 3
958 agent claude-sonnet-5 409 30397 1
959 agent claude-sonnet-5 244 30806 4
960 agent claude-sonnet-5 297 31050 20
961 agent claude-sonnet-5 413 31347 2
962 agent claude-sonnet-5 405 31760 1
963 agent claude-sonnet-5 470 32165 20
964 agent claude-sonnet-5 221 32635 2
965 agent claude-sonnet-5 2142 32856 3
966 agent claude-sonnet-5 6309 12065 3
967 agent claude-sonnet-5 4578 18374 8
968 agent claude-sonnet-5 6340 22952 3
969 agent claude-sonnet-5 1126 29292 2
970 agent claude-sonnet-5 1270 30418 2
971 agent claude-sonnet-5 259 31688 17
972 agent claude-sonnet-5 442 31947 20
973 agent claude-sonnet-5 459 32389 5
974 agent claude-sonnet-5 473 32848 20
975 agent claude-sonnet-5 266 33321 2
976 agent claude-sonnet-5 1692 33587 2
977 agent claude-sonnet-5 523 35279 2
978 agent claude-sonnet-5 574 35802 4
979 agent claude-sonnet-5 1036 36376 1
980 agent claude-haiku-4-5-20251001 12235 0 3
981 agent claude-haiku-4-5-20251001 1511 12235 2
982 agent claude-haiku-4-5-20251001 700 13746 276
983 agent claude-haiku-4-5-20251001 6762 14446 2
984 agent claude-haiku-4-5-20251001 590 21208 1
985 agent claude-haiku-4-5-20251001 1273 21798 2
986 agent claude-haiku-4-5-20251001 358 23071 3
-->
<!-- /cout -->
