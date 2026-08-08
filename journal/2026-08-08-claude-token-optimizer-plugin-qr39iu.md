# 2026-08-08 — claude/token-optimizer-plugin-qr39iu

Branche : `claude/token-optimizer-plugin-qr39iu`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. Le classificateur a bloqué la première édition de `cloud-setup.sh`, sans raison apparente

**Symptome** — Le premier appel `Edit` sur `.claude/cloud-setup.sh` (ajout de
la ligne `marketplace add alexgreensh/token-optimizer`) a été refusé par « le
classificateur du mode automatique », avec le message générique « Blocked by
classifier ». Le second appel, sur le même fichier, avec un diff de forme
identique (ajout d'une ligne à une liste existante), est passé sans encombre.

**Cause** — Inconnue : rien dans le contenu ajouté ne distingue les deux
appels. Le fichier édité est un script qui *installe* des plugins une fois
collé dans un environnement cloud — le classificateur le traite peut-être
comme plus sensible qu'une édition de fichier ordinaire, et déclenche parfois,
pas systématiquement.

**Detecte par** — `auteur`

**Action** — `rien` — un nouvel essai a suffi. Si le blocage redevenait
systématique sur ce fichier, ce serait à consigner comme `outillage`.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 11:15 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 62 | 0,00 $ |
| Écriture de cache | 116 152 | 0,44 $ |
| Lecture de cache | 2 948 667 | 0,88 $ |
| Sortie | 15 679 | 0,24 $ |
| **Total** | **3 080 560** | **1,56 $ — 1,35 €** |

**Ce qui coûte**

- **31 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 918 jetons, écrits une fois par session puis relus à chaque
  échange : 2 007 540 jetons de relecture, 68 % de tout ce qui a été relu.
- **Tours courts** — 16 des 31 tours (51 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,60 $, soit 38 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 918 jetons relus au premier appel qui relise
  quelque chose, 115 875 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 3080560 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66918 0 763
2 principal claude-sonnet-5 962 66918 202
3 principal claude-sonnet-5 8833 67880 539
4 principal claude-sonnet-5 6738 76713 531
5 principal claude-sonnet-5 1246 83451 80
6 principal claude-sonnet-5 92 84697 1443
7 principal claude-sonnet-5 2821 84789 233
8 principal claude-sonnet-5 1053 87610 455
9 principal claude-sonnet-5 1026 88663 1329
10 principal claude-sonnet-5 1749 89689 336
11 principal claude-sonnet-5 1939 91438 662
12 principal claude-sonnet-5 1468 93377 164
13 principal claude-sonnet-5 2164 94845 1668
14 principal claude-sonnet-5 5002 97009 210
15 principal claude-sonnet-5 1568 102011 151
16 principal claude-sonnet-5 301 103579 88
17 principal claude-sonnet-5 1329 103880 260
18 principal claude-sonnet-5 357 105209 130
19 principal claude-sonnet-5 1048 105566 274
20 principal claude-sonnet-5 348 106614 228
21 principal claude-sonnet-5 278 106962 750
22 principal claude-sonnet-5 1038 107240 566
23 principal claude-sonnet-5 621 108278 236
24 principal claude-sonnet-5 291 108899 577
25 principal claude-sonnet-5 631 109190 162
26 principal claude-sonnet-5 844 109821 483
27 principal claude-sonnet-5 533 110665 88
28 principal claude-sonnet-5 1498 111198 1020
29 principal claude-sonnet-5 1209 112696 1873
30 principal claude-sonnet-5 1970 113905 67
31 principal claude-sonnet-5 277 115875 111
-->
<!-- /cout -->
