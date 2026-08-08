# 2026-08-07 — claude/add-skill-project-xhs3xv

Branche : `claude/add-skill-project-xhs3xv`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le dépôt n'avait aucune compétence propre, et rien ne disait où en poser une

**Symptome** — la demande était d'ajouter une compétence (`compact-claude-md`,
fournie en pièce jointe) au dépôt. `.claude/` portait `agents/`, `commands/`,
deux hooks et `settings.json`, mais pas de `skills/` ; `memory/outillage.md` ne
décrit que les compétences **apportées par les plugins**, jamais une compétence
écrite dans le dépôt. Le chemin (`.claude/skills/<nom>/SKILL.md`) vient de la
convention Claude Code, pas d'une ligne du contrat.

**Cause** — `--check` vérifie la présence des trois agents et des deux commandes
de mode, donc `.claude/agents/` et `.claude/commands/` sont documentés par le
garde-fou qui les tient. Rien ne tient les compétences, donc rien ne les
mentionne : l'emplacement n'est écrit nulle part parce qu'aucun contrôle n'y
touche.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/outillage.md` distingue désormais les
compétences des plugins de celles du dépôt, et donne le chemin. Pas de garde-fou
proposé : une compétence absente ne casse rien, contrairement à un agent ou à une
commande de mode que le contrat promet.

### 2. Le registre des compétences se rafraîchit en cours de session, mais en retard — et j'ai conclu trop vite

**Symptome** — invoquée dans la foulée de son écriture, la compétence a répondu
`Unknown skill`. J'en ai déduit que le registre des compétences était lu au
démarrage, comme ceux des agents et des plugins, et je l'ai écrit dans
`memory/travail.md` et dans cette entrée. Six tours plus tard, sans aucun geste
de ma part, la compétence est apparue dans la liste des compétences disponibles
de **la même session**. La conclusion était fausse, et déjà committée.

**Cause** — l'erreur de raisonnement est d'avoir traité une observation négative
unique comme une mesure. `Unknown skill` prouve qu'à cet instant la compétence
n'était pas enregistrée ; il ne dit rien de la suite. Le contrat proposait deux
cases — « relu en session » et « lu au démarrage » — et j'ai rangé le cas observé
dans la seule qui collait à mon unique point de mesure, au lieu de constater
qu'il n'entrait dans aucune des deux. Le délai réel n'est ni documenté ni
annoncé, donc rien n'aurait signalé la méprise si le rafraîchissement n'avait
pas eu lieu sous mes yeux.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/travail.md` décrit maintenant le comportement
observé aux deux bouts, et dit explicitement de ne rien conclure d'un premier
`Unknown skill`. Pas de garde-fou proposé : aucun contrôle ne peut vérifier une
affirmation de prose sur le comportement du harnais.


---

# Suite — 2026-08-08, compactage du contrat

La PR #84 fusionnée, la branche repart de `main` sous le même nom. Périmètre et
mode inchangés : `fabrique`, `chaud`.

## Anomalies du compactage

### 3. Deux affirmations fausses dans le contrat, dont une déjà corrigée par une autre session

**Symptome** — le tri du contrat a trouvé deux lignes qui ne décrivaient plus le
dépôt. La première : « `.github/pull_request_template.md`, généré ». Vérifié dans
`init.sh` — le fichier n'est **que** vérifié en présence, aucune ligne ne l'écrit.
Un agent qui le croit généré ne l'éditera jamais à la main et attendra d'un
`./init.sh` qu'il le remette en forme. La seconde : « le déploiement se déclenche
à chaque fusion sur `main` », devenue fausse avec le déploiement sélectif.

**Cause** — les deux ont la même forme : une phrase vraie à l'écriture, qu'aucun
contrôle ne relie à ce qu'elle décrit. `--check` compte les lignes du contrat et
vérifie que son sommaire liste exactement les fichiers de `memory/` ; rien ne
vérifie qu'une affirmation sur `init.sh` ou sur la CI corresponde encore à leur
code.

**Detecte par** — `auteur`

**Action** — `contrat` — les deux lignes sont corrigées. Pas de garde-fou
proposé : relier une phrase en prose à la ligne de code qu'elle décrit demanderait
un langage d'assertions que ce dépôt n'a pas, et le coût dépasse largement deux
lignes fausses en quatre jours.

### 4. J'ai annoncé un gain deux fois supérieur au gain réel

**Symptome** — le tri annonçait « 250 lignes → ~125, environ 4 400 jetons →
~2 300 ». Après application : 198 lignes, ~3 300 jetons. Le gain réel est de
**−24 % en mots** (2 138 → 1 627), pas de −50 %.

**Cause** — j'ai estimé le résultat en comptant les lignes que je supprimais, sans
tenir compte de ce que la réécriture reflow : les paragraphes conservés sont
revenus sur des lignes plus longues, et les deux tableaux et cinq blocs de code —
33 lignes incompressibles — ne bougent pas. La ligne est une mauvaise unité pour
annoncer un gain ; le mot ou l'octet en est une bonne. L'annonce a été faite à
l'utilisateur avant qu'il ne valide, donc sur un chiffre qu'il n'avait aucun moyen
de contredire.

**Detecte par** — `auteur`

**Action** — `comportement` — annoncer un gain de compactage en **mots ou en
octets**, jamais en lignes, et le mesurer sur un échantillon réécrit plutôt que
sur les lignes supprimées.

### 5. Le contrat avait bougé sous le tri, entre l'inventaire et l'application

**Symptome** — entre la lecture du contrat et l'application du tri, une autre
session a fusionné `d1860db`, qui touchait `CLAUDE.md` : ajout de `versions.yml`,
recompactage de trois paragraphes, et correction partielle de la ligne du
déploiement. Le tri présenté à l'utilisateur portait donc sur un fichier qui
n'était déjà plus celui du dépôt.

**Cause** — la branche de travail avait été ouverte avant, et rien dans la
séquence ne rafraîchit la base entre l'inventaire et l'écriture. Sans le
`git checkout -B` depuis `origin/main` imposé par la PR déjà fusionnée, le
compactage aurait écrasé silencieusement le travail de l'autre session — le
fichier étant réécrit en entier, git n'aurait signalé aucun conflit.

Ce que l'autre session a corrigé n'était d'ailleurs pas tout : elle a précisé ce
que le déploiement **recrée** en laissant écrit qu'il « part à chaque fusion ».
Vérifié sur cette branche : le job `deploy` est **sauté** quand aucune image ni le
compose ne change — constaté sur la fusion de la PR #84.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un compactage réécrit un fichier en entier, donc
n'entre jamais en conflit et écrase sans bruit. Relire la base juste avant
d'écrire, et pas seulement à l'ouverture de la branche, est le geste qui manque ;
`pret.sh` pourrait avertir quand un fichier réécrit a bougé sur `origin/main`
depuis le point de départ de la branche.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 00:31 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 8 034 | 0,04 $ |
| Écriture de cache | 374 136 | 1,90 $ |
| Lecture de cache | 10 302 777 | 4,87 $ |
| Sortie | 62 198 | 1,26 $ |
| **Total** | **10 747 145** | **8,07 $ — 7,01 €** |

**Ce qui coûte**

- **89 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  62 976 jetons, écrits une fois par session puis relus à chaque
  échange : 5 541 888 jetons de relecture, 53 % de tout ce qui a été relu.
- **Tours courts** — 38 des 89 tours (42 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 2,69 $, soit 33 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 62 976 jetons relus au premier appel qui relise
  quelque chose, 190 236 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 10747145 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 62976 0 411
2 principal claude-opus-5 5940 62976 297
3 principal claude-opus-5 1822 68916 764
4 principal claude-opus-5 9646 70738 165
5 principal claude-opus-5 266 80384 81
6 principal claude-opus-5 3615 80650 311
7 principal claude-opus-5 350 84265 351
8 principal claude-opus-5 524 84615 909
9 principal claude-opus-5 975 85139 492
10 principal claude-opus-5 531 86114 206
11 principal claude-opus-5 546 86645 461
12 principal claude-opus-5 578 87191 926
13 principal claude-opus-5 976 87769 254
14 principal claude-opus-5 341 88745 230
15 principal claude-opus-5 280 89086 102
16 principal claude-opus-5 794 89366 98
17 principal claude-opus-5 427 90160 98
18 principal claude-opus-5 1939 90587 93
19 principal claude-opus-5 172 92526 815
20 principal claude-opus-5 836 92698 126
21 principal claude-opus-5 331 93534 94
22 principal claude-opus-5 451 93865 86
23 principal claude-opus-5 480 94316 1033
24 principal claude-opus-5 1548 94796 109
25 principal claude-opus-5 1008 96344 137
26 principal claude-opus-5 410 97352 381
27 principal claude-opus-5 921 97762 1187
28 principal claude-opus-5 1235 98683 989
29 principal claude-opus-5 1059 99918 475
30 principal claude-opus-5 525 100977 128
31 principal claude-opus-5 443 101502 689
32 principal claude-opus-5 3644 101945 103
33 principal claude-opus-5 172 105589 137
34 principal claude-opus-5 159 105761 227
35 principal claude-opus-5 665 105920 992
36 principal claude-opus-5 1163 106585 379
37 principal claude-opus-4-7 49208 28262 10690
38 principal claude-opus-5 2873 107748 374
39 principal claude-opus-4-7 10740 77470 117
40 principal claude-opus-4-7 252 88210 82
41 principal claude-opus-4-7 4624 88462 180
42 principal claude-opus-5 4287 110621 473
43 principal claude-opus-5 514 114908 87
44 principal claude-opus-4-7 1524 93086 245
45 principal claude-opus-5 779 115422 137
46 principal claude-opus-4-7 1272 94610 173
47 principal claude-opus-4-7 2416 95882 128
48 principal claude-opus-5 192 116201 519
49 principal claude-opus-5 1218 116393 154
50 principal claude-opus-5 1401 117611 177
51 principal claude-opus-5 688 119012 260
52 principal claude-opus-5 318 119700 246
53 principal claude-opus-5 786 120018 822
54 principal claude-opus-5 2243 120804 381
55 principal claude-opus-5 714 123047 120
56 principal claude-opus-5 236 123761 243
57 principal claude-opus-5 255 123997 42
58 principal claude-opus-5 476 124294 163
59 principal claude-opus-5 3305 124770 354
60 principal claude-opus-5 653 128075 950
61 principal claude-opus-5 3196 129678 949
62 principal claude-opus-5 7435 132874 905
63 principal claude-opus-5 1270 140309 352
64 principal claude-opus-5 680 141579 157
65 principal claude-opus-5 2165 142259 290
66 principal claude-opus-5 1108 144424 238
67 principal claude-opus-5 841 145532 461
68 principal claude-opus-5 937 146373 924
69 principal claude-opus-5 1009 147310 416
70 principal claude-opus-5 485 148319 143
71 principal claude-opus-5 790 148804 311
72 principal claude-opus-5 802 149594 4171
73 principal claude-opus-5 4990 150396 3585
74 principal claude-opus-5 117959 41035 2082
75 principal claude-opus-5 2397 158994 160
76 principal claude-opus-5 388 161391 498
77 principal claude-opus-5 759 161779 527
78 principal claude-opus-5 2929 162538 560
79 principal claude-opus-5 1166 165467 362
80 principal claude-opus-5 4066 166633 619
81 principal claude-opus-5 1552 170699 4160
82 principal claude-opus-5 4608 172251 4702
83 principal claude-opus-5 4752 176859 161
84 principal claude-opus-5 722 181611 1250
85 principal claude-opus-5 1440 182333 242
86 principal claude-opus-5 305 183773 1842
87 principal claude-opus-5 5788 184078 109
88 principal claude-opus-5 370 189866 435
89 principal claude-opus-5 505 190236 134
-->
<!-- /cout -->
