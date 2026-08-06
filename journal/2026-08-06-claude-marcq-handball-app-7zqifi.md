# 2026-08-06 — claude/marcq-handball-app-7zqifi

Branche : `claude/marcq-handball-app-7zqifi`
Périmètre : marcq-handball
Mode : `chaud`

Execution du PRP 07 de `apps/marcq-handball/prp/` — le classement cote serveur :
domaine Go, magasin sur fichier, trois routes `/api/*`, et le volume persistant
qui les alimente.

## Anomalies

### 1. Le verrou du PRP 07 est leve depuis que le contrat a change

**Symptome** — le PRP 07 s'ouvre sur un verrou en deux moities : le volume
persistant doit etre tranche « cote serveur », et `init.sh` doit apprendre a
monter un volume, sur une branche `fabrique/<sujet>` distincte. Les deux sont
faux au 2026-08-06.

**Cause** — le PRP a ete redige contre l'etat du depot a sa date. Depuis,
`init.sh` a gagne `check_volume`, `check_volume_list` et `check_volume_noms`
(l'aide en tete de fichier documente `volumes:` dans `app.yml`), et le contrat a
inverse la regle qu'il citait : « Une base, un cache, un volume, un service
annexe **t'appartiennent desormais** : declare-les dans un manifeste plutot que
de les demander dans un `README` ». Le chantier 1 du PRP — ecrire la demande
dans le README puis s'arreter — decrit donc un geste que le contrat interdit
maintenant.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP fige une lecture du contrat a sa date d'ecriture
et rien ne le lui rappelle. Le chantier 1 du PRP 07 est a reecrire : le volume
se declare dans `app.yml`, il ne se demande plus.

### 2. Un test de sous-chaine attrape du base64 aleatoire

**Symptome** — le test « le code n'est jamais stocke en clair » verifie aussi
qu'aucun champ nominatif n'entre dans `classement.json`, en cherchant les
sous-chaines `prenom`, `email`, `telephone` et `ip`. Il echoue sur `ip` — et
seulement parfois, ce qui est pire.

**Cause** — le sel et l'empreinte sont ecrits en base64, soit une suite de
lettres tirees au hasard a chaque execution : n'importe quelle sequence de deux
caracteres y apparait tot ou tard. Le test cherchait une sous-chaine nue la ou
il voulait dire « une cle JSON ». Chercher `"ip"` avec ses guillemets suffit.

**Detecte par** — `test`

**Action** — `comportement` — c'est la quatrieme fois en deux branches qu'un
test de sous-chaine attrape autre chose que sa cible (voir les anomalies 2 a 6
de `2026-08-06-claude-marcq-handball-app-phases-1yk38x.md`). Le filet large est
la bonne technique ; ce qui manque est le reflexe de se demander, en l'ecrivant,
ce que la sous-chaine attrape d'AUTRE. Ici la reponse etait « du hasard », donc
un test qui echoue une fois sur trois.

### 3. Le plafond memoire de la fabrique est depasse, et ce n'est pas cette branche

**Symptome** — `./init.sh --check` avertit : « memoire engagee 1216 Mo sur
9 service(s), au-dela du plafond 1024 Mo de fabrique.yml ». L'avertissement
apparait pendant tout le travail sur cette branche.

**Cause** — il precede la branche : verification faite en remisant les
modifications, il tombe a l'identique sur `main`. C'est l'activation de
`marcq-handball` par la PR #54 qui a fait franchir le seuil, +128 Mo. Un volume
n'ajoute aucune memoire.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le plafond de `fabrique.yml` est un avertissement,
pas un refus, et il n'a donc bloque personne au moment ou il a ete franchi. Soit
la RAM du serveur le supporte et le plafond est a relever, soit elle ne le
supporte pas et une app est a desactiver ; personne ne peut le trancher depuis
le depot.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-06 à 11:35 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 161 | 0,00 $ |
| Écriture de cache | 390 548 | 1,63 $ |
| Lecture de cache | 12 687 675 | 5,92 $ |
| Sortie | 107 317 | 2,17 $ |
| **Total** | **13 185 701** | **9,72 $ — 8,44 €** |

**Ce qui coûte**

- **84 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  54 704 jetons, écrits une fois par session puis relus à chaque
  échange : 4 540 432 jetons de relecture, 35 % de tout ce qui a été relu.
- **Croissance** — 54 704 jetons relus au premier appel qui relise
  quelque chose, 260 379 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 13185701 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 54704 0 374
2 principal claude-opus-5 1047 54704 178
3 principal claude-opus-5 2487 55751 183
4 principal claude-opus-5 19032 58238 659
5 principal claude-opus-5 2185 77270 379
6 principal claude-opus-5 22097 79455 847
7 principal claude-opus-5 10222 101552 560
8 principal claude-opus-5 8684 111774 2195
9 principal claude-opus-5 9816 120458 139
10 principal claude-opus-5 4469 130274 345
11 principal claude-opus-5 6265 134743 348
12 principal claude-opus-5 3085 141008 124
13 principal claude-opus-5 1361 144093 758
14 principal claude-opus-5 829 145454 861
15 principal claude-opus-5 1095 146283 389
16 principal claude-opus-5 953 147378 5591
17 principal claude-opus-5 5645 148331 705
18 principal claude-opus-5 786 153976 4252
19 principal claude-opus-5 4631 154762 502
20 principal claude-opus-5 581 159393 118
21 principal claude-opus-5 280 159974 129
22 principal claude-opus-5 153 160254 234
23 principal claude-opus-5 4990 160407 1117
24 principal claude-opus-5 1147 165397 149
25 principal claude-opus-4-7 40398 0 126
26 principal claude-opus-4-7 205 40398 86
27 principal claude-opus-4-7 3562 40603 144
28 principal claude-opus-4-7 1019 44165 333
29 principal claude-opus-4-7 1436 45184 260
30 principal claude-opus-4-7 332 46620 197
31 principal claude-opus-5 229 166544 3765
32 principal claude-opus-4-7 3111 46952 2008
33 principal claude-opus-4-7 2061 50063 1507
34 principal claude-opus-4-7 1543 52124 69
35 principal claude-opus-5 3820 166773 11303
36 principal claude-opus-5 11356 170593 5206
37 principal claude-opus-5 5653 181949 758
38 principal claude-opus-5 1144 187602 578
39 principal claude-opus-5 710 188746 684
40 principal claude-opus-5 848 189456 99
41 principal claude-opus-5 116 190304 116
42 principal claude-opus-5 471 190420 233
43 principal claude-opus-5 290 190891 124
44 principal claude-opus-5 503 191181 598
45 principal claude-opus-5 4202 191684 11586
46 principal claude-opus-5 11631 195886 125
47 principal claude-opus-5 4874 207517 761
48 principal claude-opus-5 819 212391 233
49 principal claude-opus-5 4581 213210 10107
50 principal claude-opus-5 10161 217791 592
51 principal claude-opus-5 5002 227952 463
52 principal claude-opus-5 1023 232954 2348
53 principal claude-opus-5 2380 233977 221
54 principal claude-opus-5 338 236357 1091
55 principal claude-opus-5 1114 236695 567
56 principal claude-opus-5 623 237809 771
57 principal claude-opus-5 829 238432 96
58 principal claude-opus-5 863 239261 259
59 principal claude-opus-5 1734 240124 271
60 principal claude-opus-5 4129 241858 3594
61 principal claude-opus-4-7 43442 27342 9068
62 principal claude-opus-4-7 11393 70784 166
63 principal claude-opus-5 3649 245987 1125
64 principal claude-opus-4-7 1231 82177 427
65 principal claude-opus-5 1180 249636 458
66 principal claude-opus-5 513 250816 141
67 principal claude-opus-5 792 251329 320
68 principal claude-opus-5 490 252121 202
69 principal claude-opus-5 1147 252611 1710
70 principal claude-opus-4-7 4660 27342 196
71 principal claude-opus-4-7 3349 32002 113
72 principal claude-opus-5 1815 253758 2238
73 principal claude-opus-4-7 2872 35351 1857
74 principal claude-opus-5 2301 255573 632
75 principal claude-opus-4-7 2323 38223 256
76 principal claude-opus-4-7 928 40546 71
77 principal claude-opus-5 695 257874 492
78 principal claude-opus-4-7 2159 41474 168
79 principal claude-opus-4-7 1951 43633 614
80 principal claude-opus-5 550 258569 873
81 principal claude-opus-5 931 259119 128
82 principal claude-opus-5 329 260050 699
83 principal claude-opus-4-7 1455 45584 2853
84 principal claude-opus-5 739 260379 95
-->
<!-- /cout -->
