# 2026-08-21 — claude/agent-dialogue-optimization-8sq1fs



Branche : `claude/agent-dialogue-optimization-8sq1fs`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. L'endroit qu'on croit couteux n'est pas celui qui coute

**Symptome** — la demande etait « abreger les dialogues entre agents ». Le geste
evident est de reecrire les cinq fichiers de `.claude/agents/`, qui sont la seule
chose qui ressemble a un dialogue permanent. Mesure faite avant d'y toucher :
ces cinq fichiers pesent 6 510 jetons, soit **0,2 %** des 1 504 $ consommes par
le depot. Le poste reel est ailleurs — 42 % des tours sont des sous-agents, a
138 752 jetons relus par tour, et ce volume est decide par la MISSION qu'on leur
donne, pas par leur consigne.

**Cause** — la consigne d'un agent est ecrite une fois et se voit ; la mission et
le rapport sont ecrits a chaque appel et ne se voient nulle part. L'intuition
suit ce qui se voit.

**Detecte par** — `auteur`

**Action** — `contrat` — le chiffre et son raisonnement sont ecrits dans
`memory/travail.md`, sans quoi la meme intuition reviendra a la prochaine
tentative d'optimisation.

### 2. --check annoncait cinq agents et n'en verifiait que trois

**Symptome** — `memory/travail.md` disait « presence des cinq agents » dans son
champ `Tenu par`. La boucle de `check_outillage` ne listait que `analyste`,
`greffier` et `artisan` : `esthete.md` et `relecteur.md` pouvaient disparaitre
sans un mot. Le registre des agents n'etant relu qu'au demarrage d'une session,
l'absence ne se serait remarquee qu'a la session suivante, sur un
`Agent(subagent_type: "esthete")` qui ne rend rien.

**Cause** — la liste a ete ecrite quand il y avait trois agents et n'a pas suivi
les deux ajouts. Rien ne relie le nombre annonce dans `memory/` a la liste du
programme.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le nouveau parcours du protocole traverse les cinq
agents nommes et refuse un fichier absent ; deux cas de `test-init.sh` le
tiennent.

### 3. Le contrat depasse son propre plafond, et cette branche l'aggrave

**Symptome** — `--check` avertit depuis un moment : `CLAUDE.md` 271 lignes pour
un plafond de 250. La regle du protocole en ajoute deux, a 273. L'avertissement
ne bloque pas, personne ne le traite, et chaque branche le repousse d'un cran.

**Cause** — l'avertissement dit quoi faire (« sors un sujet dans `memory/` »)
mais pas LEQUEL, et choisir ce qui quitte le contrat engage ce que tout futur
agent lira par defaut. Aucune branche ne veut prendre cette decision en passant.

**Detecte par** — `auteur`

**Action** — `arbitrage` — quel sujet de `CLAUDE.md` descend dans `memory/` est
une decision a prendre avec l'utilisateur, pas un correctif a glisser dans une
branche dont ce n'est pas le sujet.

### 4. Le garde-fou neuf disait vert sur la panne meme qu'il existe pour voir

**Symptome** — le controle ajoute par cette branche cherchait chaque champ
obligatoire dans TOUT le fichier de l'agent, pas dans sa section `## Rendu`.
Or `ecrans` et `montre` ouvrent aussi des lignes de prose plus haut dans la
consigne de l'`esthete`. Verifie en bac a sable : le champ `ecrans` retire de
son rendu, `--check` repondait toujours « ok — cinq agents : section '## Rendu'
et champs obligatoires ». Deux champs sur quatre d'un agent n'etaient donc pas
gardes, et le controle affirmait le contraire.

**Cause** — la portee du `grep` n'a pas ete posee au moment de l'ecrire. Les
trois cas de test ecrits dans la foulee ne portaient que sur `artisan.md`, dont
aucun des quatre champs n'a de collision de ce genre : la suite est passee au
vert sur un controle a moitie mort. C'est le vert silencieux de
`docs/parallelisme.md`, applique a un garde-fou plutot qu'a une chaine.

**Detecte par** — `relecture`

**Action** — `garde-fou` — la recherche est restreinte a la section par `awk`, et
un cas de test neuf porte precisement sur la collision de l'`esthete`, la ou le
cas `artisan` ne pouvait pas la voir. Lecon transposable : un cas de test choisi
sur l'agent le plus simple ne teste pas le controle, il teste le cas facile.


---

**Second lot, même branche : compacter le contrat.** Périmètre et mode inchangés.
Les anomalies qui suivent continuent la numérotation ci-dessus.

### 5. J'ai presente a l'utilisateur un depassement deja corrige

**Symptome** — j'ai signale, dans deux reponses et dans le corps de la pull request
#161, que `CLAUDE.md` depassait son plafond (271 lignes pour 250) et j'en ai fait
un `arbitrage` a trancher par l'utilisateur. Au moment ou je l'ecrivais, `main`
portait deja `f138a2f — contrat : compacter CLAUDE.md de 271 a 222 lignes`, et ce
commit etait **entre dans ma propre branche** par le merge `fc8e604`. Le fichier
que je decrivais a 273 lignes en faisait 224, sous le plafond, et `--check` etait
vert sur ce point.

**Cause** — j'ai relu l'avertissement de `pret.sh` releve **avant** que `main` ne
soit fusionne dans la branche, sans le reverifier sur la tete courante. Le merge
n'etait pas de moi — le harnais l'a fait — donc rien dans mon fil ne signalait que
l'etat avait change. Une session parallele travaillait le meme sujet ; deux
sessions sur le meme depot ne se voient pas.

**Detecte par** — `auteur`

**Action** — `comportement` — un avertissement releve a un instant T ne se
transmet pas a l'utilisateur sans etre rejoue sur la tete courante, surtout apres
un merge qu'on n'a pas fait soi-meme. Aucun artefact a changer : c'est un reflexe,
pas un garde-fou.

Aucune autre anomalie. Le compactage lui-meme n'a rien revele : chaque fait retire de `CLAUDE.md` a ete
verifie present dans `memory/` avant retrait, et les deux seuls qui ne l'etaient
pas — `./docs/banc/mesurer.sh` et la capture de secours quand l'artefact manque —
ont ete remis dans le contrat plutot que deplaces.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 17:05 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 430 | 0,00 $ |
| Écriture de cache | 846 609 | 4,54 $ |
| Lecture de cache | 19 864 221 | 9,37 $ |
| Sortie | 91 541 | 2,13 $ |
| **Total** | **20 802 801** | **16,03 $ — 13,92 €** |

**Ce qui coûte**

- **153 appel(s) au modèle** — un par réponse, outils compris —, dont 38 par des sous-agents — 1 013 982 jetons, 0,42 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 812 jetons, écrits une fois par session puis relus à chaque
  échange : 7 844 568 jetons de relecture, 39 % de tout ce qui a été relu.
- **Tours courts** — 50 des 153 tours (32 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 5,17 $, soit 32 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 812 jetons relus au premier appel qui relise
  quelque chose, 286 530 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 20802801 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68812 0 994
2 principal claude-opus-5 16320 68812 1316
3 principal claude-opus-5 12603 85132 1909
4 principal claude-opus-5 3286 97735 193
5 principal claude-opus-5 529 101021 329
6 principal claude-opus-5 536 101550 367
7 principal claude-opus-5 590 102086 2027
8 principal claude-opus-5 2482 102676 307
9 principal claude-opus-5 4302 105158 3279
10 principal claude-opus-5 3310 109460 6881
11 principal claude-opus-5 6990 112770 194
12 principal claude-opus-5 577 119760 595
13 principal claude-opus-5 7392 119956 597
14 principal claude-opus-5 2690 127348 491
15 principal claude-opus-5 4218 130038 3033
16 principal claude-opus-5 3134 134256 120
17 principal claude-opus-5 2417 137390 3655
18 principal claude-opus-5 3693 139807 818
19 principal claude-opus-5 1112 143500 3536
20 principal claude-opus-5 4025 144612 1484
21 principal claude-opus-5 1793 148637 240
22 principal claude-opus-5 956 150430 2521
23 principal claude-opus-5 2551 151386 1086
24 principal claude-opus-5 1122 153937 173
25 principal claude-opus-5 769 155059 1278
26 principal claude-opus-5 1405 155828 145
27 principal claude-opus-5 303 157233 100
28 principal claude-opus-5 173 157536 400
29 principal claude-opus-5 1394 157709 2084
30 principal claude-opus-5 2193 159103 124
31 principal claude-opus-5 510 161296 832
32 principal claude-opus-4-7 5000 29200 157
33 principal claude-opus-4-7 277 34200 98
34 principal claude-opus-4-7 265 34477 120
35 principal claude-opus-4-7 213 34742 122
36 principal claude-opus-4-7 3709 34955 130
37 principal claude-opus-5 1075 161806 943
38 principal claude-opus-5 1506 162881 697
39 principal claude-opus-4-7 17319 38664 1694
40 principal claude-opus-4-7 1748 55983 153
41 principal claude-opus-5 1243 164387 410
42 principal claude-opus-4-7 350 57731 197
43 principal claude-opus-5 1215 165630 528
44 principal claude-opus-4-7 277 58081 1098
45 principal claude-opus-4-7 1316 58358 69
46 principal claude-opus-5 2382 167373 1583
47 principal claude-opus-5 1668 169755 1869
48 principal claude-opus-5 1905 171423 886
49 principal claude-opus-5 1061 173328 252
50 principal claude-opus-5 669 174389 855
51 principal claude-opus-5 947 175058 694
52 principal claude-opus-4-7 4284 29200 162
53 principal claude-opus-4-7 240 33484 117
54 principal claude-opus-4-7 220 33724 122
55 principal claude-opus-4-7 2513 33944 168
56 principal claude-opus-5 885 176005 345
57 principal claude-opus-5 2501 176890 1690
58 principal claude-opus-4-7 2227 36457 2024
59 principal claude-opus-5 1755 179391 124
60 principal claude-opus-5 229 181146 353
61 principal claude-opus-5 437 181375 611
62 principal claude-opus-5 961 181812 30
63 principal claude-opus-5 1308 182773 144
64 principal claude-opus-5 1067 184081 137
65 principal claude-opus-5 1863 185148 438
66 principal claude-opus-5 3503 187011 258
67 principal claude-opus-5 395 190514 73
68 principal claude-opus-5 349 190982 30
69 principal claude-opus-5 692 191331 156
70 principal claude-opus-5 2235 192023 755
71 principal claude-opus-5 385 195013 415
72 principal claude-opus-5 497 195398 217
73 principal claude-opus-5 2312 195895 60
74 principal claude-opus-5 206934 0 30
75 principal claude-opus-5 794 206934 287
76 principal claude-opus-5 774 207728 470
77 principal claude-opus-5 734 208502 688
78 principal claude-opus-5 771 209236 35
79 principal claude-opus-5 6645 210042 599
80 principal claude-opus-5 3865 216687 736
81 principal claude-opus-5 1192 220552 498
82 principal claude-opus-5 695 221744 130
83 principal claude-opus-5 1004 222439 268
84 principal claude-opus-5 503 223443 39
85 principal claude-opus-5 388 223946 30
86 principal claude-opus-5 752 224334 343
87 principal claude-opus-5 3032 225086 442
88 principal claude-opus-5 386 228560 320
89 principal claude-opus-5 870 228946 138
90 principal claude-opus-5 796 229816 237
91 principal claude-opus-5 1506 230612 219
92 principal claude-opus-5 2144 232118 648
93 principal claude-opus-5 995 234262 46
94 principal claude-opus-5 388 235303 138
95 principal claude-opus-5 638 235691 1300
96 principal claude-opus-5 1383 236329 600
97 principal claude-opus-5 1280 237712 712
98 principal claude-opus-5 1555 238992 367
99 principal claude-opus-5 504 240547 734
100 principal claude-opus-5 1079 241051 506
101 principal claude-opus-5 592 242130 202
102 principal claude-opus-5 7239 242722 543
103 principal claude-opus-5 732 249961 297
104 principal claude-opus-5 1076 250693 542
105 principal claude-opus-5 205165 48206 686
106 principal claude-opus-5 4117 253371 815
107 principal claude-opus-5 7068 257488 1510
108 principal claude-opus-5 1911 264556 510
109 principal claude-opus-5 1761 266467 7236
110 principal claude-opus-5 7310 268228 639
111 principal claude-opus-5 2677 275538 1967
112 principal claude-opus-5 2289 278215 864
113 principal claude-opus-5 5113 280504 664
114 principal claude-opus-5 913 285617 1809
115 principal claude-opus-5 2347 286530 474
116 agent claude-sonnet-5 17102 0 4
117 agent claude-sonnet-5 1724 17102 2
118 agent claude-sonnet-5 2581 18826 0
119 agent claude-sonnet-5 2577 21407 6
120 agent claude-sonnet-5 2002 23984 20
121 agent claude-sonnet-5 6663 25986 3
122 agent claude-sonnet-5 2996 32649 4
123 agent claude-sonnet-5 3703 35645 2
124 agent claude-sonnet-5 1798 39348 3
125 agent claude-sonnet-5 2392 41146 10
126 agent claude-sonnet-5 2660 43538 5
127 agent claude-sonnet-5 3694 46198 3
128 agent claude-sonnet-5 1525 49892 3
129 agent claude-sonnet-5 249 51417 5
130 agent claude-sonnet-5 2827 51666 2
131 agent claude-sonnet-5 2605 54493 2
132 agent claude-sonnet-5 5310 57098 2
133 agent claude-haiku-4-5-20251001 12639 0 4
134 agent claude-haiku-4-5-20251001 1676 12639 2
135 agent claude-haiku-4-5-20251001 822 14315 2
136 agent claude-haiku-4-5-20251001 1335 15137 2
137 agent claude-haiku-4-5-20251001 875 16472 2
138 agent claude-haiku-4-5-20251001 534 17347 4
139 agent claude-haiku-4-5-20251001 337 17881 4
140 agent claude-haiku-4-5-20251001 202 18218 2
141 agent claude-haiku-4-5-20251001 12700 0 4
142 agent claude-haiku-4-5-20251001 1353 12700 2
143 agent claude-haiku-4-5-20251001 484 14053 1
144 agent claude-haiku-4-5-20251001 1038 14537 2
145 agent claude-haiku-4-5-20251001 842 15575 2
146 agent claude-haiku-4-5-20251001 289 16417 2
147 agent claude-haiku-4-5-20251001 12896 0 4
148 agent claude-haiku-4-5-20251001 1562 12896 2
149 agent claude-haiku-4-5-20251001 1038 14458 1
150 agent claude-haiku-4-5-20251001 3131 15496 2
151 agent claude-haiku-4-5-20251001 692 18627 4
152 agent claude-haiku-4-5-20251001 343 19319 5
153 agent claude-haiku-4-5-20251001 306 19662 2
-->
<!-- /cout -->
