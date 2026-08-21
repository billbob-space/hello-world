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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 16:11 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 313 | 0,00 $ |
| Écriture de cache | 558 503 | 2,84 $ |
| Lecture de cache | 11 429 230 | 5,18 $ |
| Sortie | 65 055 | 1,46 $ |
| **Total** | **12 053 101** | **9,49 $ — 8,25 €** |

**Ce qui coûte**

- **112 appel(s) au modèle** — un par réponse, outils compris —, dont 32 par des sous-agents — 923 934 jetons, 0,42 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 812 jetons, écrits une fois par session puis relus à chaque
  échange : 5 436 148 jetons de relecture, 47 % de tout ce qui a été relu.
- **Tours courts** — 39 des 112 tours (34 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 3,81 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 68 812 jetons relus au premier appel qui relise
  quelque chose, 216 687 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 12053101 -->
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
81 agent claude-sonnet-5 17102 0 4
82 agent claude-sonnet-5 1724 17102 2
83 agent claude-sonnet-5 2581 18826 0
84 agent claude-sonnet-5 2577 21407 6
85 agent claude-sonnet-5 2002 23984 20
86 agent claude-sonnet-5 6663 25986 3
87 agent claude-sonnet-5 2996 32649 4
88 agent claude-sonnet-5 3703 35645 2
89 agent claude-sonnet-5 1798 39348 3
90 agent claude-sonnet-5 2392 41146 10
91 agent claude-sonnet-5 2660 43538 5
92 agent claude-sonnet-5 3694 46198 3
93 agent claude-sonnet-5 1525 49892 3
94 agent claude-sonnet-5 249 51417 5
95 agent claude-sonnet-5 2827 51666 2
96 agent claude-sonnet-5 2605 54493 2
97 agent claude-sonnet-5 5310 57098 2
98 agent claude-haiku-4-5-20251001 12639 0 4
99 agent claude-haiku-4-5-20251001 1676 12639 2
100 agent claude-haiku-4-5-20251001 822 14315 2
101 agent claude-haiku-4-5-20251001 1335 15137 2
102 agent claude-haiku-4-5-20251001 875 16472 2
103 agent claude-haiku-4-5-20251001 534 17347 4
104 agent claude-haiku-4-5-20251001 337 17881 4
105 agent claude-haiku-4-5-20251001 202 18218 2
106 agent claude-haiku-4-5-20251001 12896 0 4
107 agent claude-haiku-4-5-20251001 1562 12896 2
108 agent claude-haiku-4-5-20251001 1038 14458 1
109 agent claude-haiku-4-5-20251001 3131 15496 2
110 agent claude-haiku-4-5-20251001 692 18627 4
111 agent claude-haiku-4-5-20251001 343 19319 5
112 agent claude-haiku-4-5-20251001 306 19662 2
-->
<!-- /cout -->
