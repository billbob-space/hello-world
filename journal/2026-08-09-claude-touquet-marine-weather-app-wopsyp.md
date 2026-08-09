# 2026-08-09 — claude/touquet-marine-weather-app-wopsyp

Branche : `claude/touquet-marine-weather-app-wopsyp`
Périmètre : estran
Mode : `chaud`

## Anomalies

Aucune anomalie. Rédaction du PRD de `estran` (météo marine et jauge de
marée pour Étaples–Le Touquet, palier `private`), après un brainstorming
avec l'utilisateur sur le nom, la source des données (Open-Meteo plutôt que
l'extraction de meteoconsult.fr), l'inclusion du vent/état de mer, et la
stack (Go, alignée sur le reste de la fabrique). Recherche faite
(`WebSearch`/`WebFetch`) pour confirmer la disponibilité réelle des sources
de données avant de les inscrire au PRD : Open-Meteo et Open-Meteo Marine
sont gratuites et sans clé, le SHOM ne l'est pas pour son API de marée
(abonnement payant), point qu'`Evidence on Hand` documente comme décision
ouverte plutôt que comme fait acquis. Aucun code écrit à ce stade — seul
`PRODUCT.md` est livré, conformément à `memory/produit.md` (« un répertoire
qui ne porte que ces documents est légitime »).

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-09 à 12:20 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 4 427 | 0,01 $ |
| Écriture de cache | 168 917 | 0,63 $ |
| Lecture de cache | 4 139 301 | 1,24 $ |
| Sortie | 27 456 | 0,41 $ |
| **Total** | **4 340 101** | **2,30 $ — 2,00 €** |

**Ce qui coûte**

- **35 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 265 jetons, écrits une fois par session puis relus à chaque
  échange : 2 287 010 jetons de relecture, 55 % de tout ce qui a été relu.
- **Tours courts** — 17 des 35 tours (48 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,02 $, soit 44 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 265 jetons relus au premier appel qui relise
  quelque chose, 168 566 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 4340101 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 67265 0 76
2 principal claude-sonnet-5 605 67265 1466
3 principal claude-sonnet-5 4770 67870 593
4 principal claude-sonnet-5 7897 72640 194
5 principal claude-sonnet-5 264 80537 240
6 principal claude-sonnet-5 4565 80801 201
7 principal claude-sonnet-5 3642 85366 4262
8 principal claude-sonnet-5 4731 89008 2405
9 principal claude-sonnet-5 3884 93739 153
10 principal claude-sonnet-5 1093 97623 659
11 principal claude-sonnet-5 3111 98716 251
12 principal claude-sonnet-5 630 101827 2388
13 principal claude-sonnet-5 4737 102457 125
14 principal claude-sonnet-5 133 107194 128
15 principal claude-sonnet-5 4435 107327 223
16 principal claude-sonnet-5 438 111762 91
17 principal claude-sonnet-5 3258 112200 850
18 principal claude-sonnet-5 943 115458 431
19 principal claude-sonnet-5 892 116401 3358
20 principal claude-sonnet-5 3453 117293 2869
21 principal claude-sonnet-5 2922 120746 1016
22 principal claude-sonnet-5 9254 123668 376
23 principal claude-sonnet-5 954 132922 251
24 principal claude-sonnet-5 24988 133876 404
25 principal claude-sonnet-5 1597 158864 429
26 principal claude-sonnet-5 1012 160461 244
27 principal claude-sonnet-5 426 161473 154
28 principal claude-sonnet-5 1397 161899 722
29 principal claude-sonnet-5 820 163296 114
30 principal claude-sonnet-5 361 164116 560
31 principal claude-sonnet-5 965 164477 1151
32 principal claude-sonnet-5 1249 165442 135
33 principal claude-sonnet-5 629 166691 657
34 principal claude-sonnet-5 1246 167320 139
35 principal claude-sonnet-5 351 168566 141
-->
<!-- /cout -->
