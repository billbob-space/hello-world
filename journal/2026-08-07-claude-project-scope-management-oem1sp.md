# 2026-08-07 — claude/project-scope-management-oem1sp

Branche : `claude/project-scope-management-oem1sp`
Périmètre : `marcq-handball`, `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le PRD de marcq-handball affirme le contraire de ce que l'application fait

**Symptome** — `apps/marcq-handball/PRODUCT.md` liste le chronomètre et les
vidéos de démonstration sous « Hors périmètre — décidé, pas oublié » (§ 6), et
le § 13 argumente le refus du chronomètre. Les deux sont livrés depuis le
7 août : `web/chrono.js` et `web/video.js` sont dans l'image en ligne, avec
leurs tests. La ligne « Capabilities and Constraints » de la fiche produit,
celle que lit un agent qui n'ouvre pas le PRD, répète la même exclusion.

Trois des sept changements postérieurs aux onze PRP déplaçaient le périmètre —
le minuteur, les liens vidéo, et « L'équipe » sortie de l'écran perso pour
devenir un onglet, ce que le § 7.5 décrivait autrement. Aucun des trois n'a
touché le PRD.

**Cause** — rien n'oblige à rouvrir le PRD quand un ajout dépasse les PRP, et
rien ne le signale. Le seul ajout correctement reporté (le dénominateur du
classement, `922e1d9`) l'a été parce qu'il corrigeait une règle métier déjà
écrite au § 9 : le travail passait par le document, donc le document a suivi.
Une capacité *neuve* ne passe par aucune ligne existante — elle s'ajoute à côté
du PRD, jamais dedans. C'est exactement le cas que ni `--check` ni `pret.sh` ne
regardaient.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `pret.sh` voit passer les fichiers ajoutés par la
branche ; un fichier de code neuf dans une app dont le `PRODUCT.md` n'est pas
touché est le signal exact, et il ne se déclenche pas sur les corrections.

### 2. Une capacité livrée dont la demande n'existe nulle part dans le dépôt

**Symptome** — les liens vidéo (`a24674f`) n'ont ni PRP, ni ligne de PRD, ni
entrée de journal : le seul endroit du dépôt où cette capacité est justifiée est
le message de commit qui l'introduit. Le minuteur (`538e523`) est dans le même
cas ; seule sa *correction* du lendemain a laissé une trace, parce qu'elle est
née d'une anomalie et que les anomalies, elles, ont un registre.

**Cause** — le journal enregistre les anomalies, les PRP enregistrent le travail
planifié, et le PRD enregistre les décisions. Un ajout demandé de vive voix
après la livraison ne tombe dans aucun des trois : il n'a mal tourné nulle part,
il n'était pas planifié, et il n'a pas été arbitré par écrit. Le dépôt n'avait
donc pas d'endroit pour lui — ce qui se lit, à tort, comme la permission de ne
rien écrire.

**Detecte par** — `auteur`

**Action** — `contrat` — le PRD reçoit une section « Ajouté après les PRP » ;
c'est l'endroit manquant, et le contrat dit désormais qu'il faut le remplir.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 16:35 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 117 | 0,00 $ |
| Écriture de cache | 182 691 | 0,96 $ |
| Lecture de cache | 6 780 962 | 3,22 $ |
| Sortie | 53 004 | 1,20 $ |
| **Total** | **7 016 774** | **5,38 $ — 4,67 €** |

**Ce qui coûte**

- **64 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  55 854 jetons, écrits une fois par session puis relus à chaque
  échange : 3 518 802 jetons de relecture, 51 % de tout ce qui a été relu.
- **Croissance** — 55 854 jetons relus au premier appel qui relise
  quelque chose, 153 305 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 7016774 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 55854 0 757
2 principal claude-opus-5 3802 55854 553
3 principal claude-opus-5 5853 59656 797
4 principal claude-opus-5 2239 65509 1566
5 principal claude-opus-5 60 69314 908
6 principal claude-opus-5 5077 69374 351
7 principal claude-opus-5 4491 74451 356
8 principal claude-opus-5 3880 78942 2906
9 principal claude-opus-5 3930 82822 425
10 principal claude-opus-5 4776 86752 2557
11 principal claude-opus-5 3949 91528 235
12 principal claude-opus-5 778 95477 1672
13 principal claude-opus-5 2742 96255 1038
14 principal claude-opus-5 2271 98997 1340
15 principal claude-opus-5 1409 101268 305
16 principal claude-opus-5 2050 102677 322
17 principal claude-opus-5 405 104727 578
18 principal claude-opus-5 768 105132 158
19 principal claude-opus-5 603 105900 355
20 principal claude-opus-5 415 106503 442
21 principal claude-opus-5 502 106918 2823
22 principal claude-opus-5 2883 107420 227
23 principal claude-opus-5 2028 110303 536
24 principal claude-opus-5 594 112331 94
25 principal claude-opus-5 291 112925 1471
26 principal claude-opus-5 1515 113216 103
27 principal claude-opus-5 261 114731 821
28 principal claude-opus-5 1825 114992 2258
29 principal claude-opus-5 8498 116817 722
30 principal claude-opus-5 773 125315 912
31 principal claude-opus-5 963 126088 572
32 principal claude-opus-5 1154 127051 453
33 principal claude-opus-5 1746 128205 2002
34 principal claude-opus-5 2907 129951 3114
35 principal claude-opus-5 3160 132858 109
36 principal claude-opus-5 284 136018 844
37 principal claude-opus-5 892 136302 94
38 principal claude-opus-5 319 137194 818
39 principal claude-opus-5 1299 137513 230
40 principal claude-opus-5 297 138812 112
41 principal claude-opus-5 121 139109 93
42 principal claude-opus-5 470 139230 329
43 principal claude-opus-5 1056 139700 694
44 principal claude-opus-5 745 140756 167
45 principal claude-opus-5 380 141501 1461
46 principal claude-opus-5 1633 141881 181
47 principal claude-opus-4-7 8467 28262 114
48 principal claude-opus-4-7 164 36729 93
49 principal claude-opus-4-7 209 36893 82
50 principal claude-opus-4-7 3353 37102 80
51 principal claude-opus-4-7 3492 40455 84
52 principal claude-opus-4-7 10039 43947 3166
53 principal claude-opus-4-7 3189 53986 177
54 principal claude-opus-4-7 232 57175 1389
55 principal claude-opus-5 313 143514 1059
56 principal claude-opus-5 1418 143827 1185
57 principal claude-opus-5 1670 145245 322
58 principal claude-opus-5 620 146915 3401
59 principal claude-opus-5 3447 147535 109
60 principal claude-opus-5 658 150982 674
61 principal claude-opus-5 724 151640 267
62 principal claude-opus-5 447 152364 157
63 principal claude-opus-5 494 152811 1688
64 principal claude-opus-5 1807 153305 96
-->
<!-- /cout -->
