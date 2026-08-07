# 2026-08-07 — claude/claude-md-caveman-format-ylhb9k

Branche : `claude/claude-md-caveman-format-ylhb9k`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le style caveman n'a pas raccourci le contrat, il l'a allongé

**Symptome** — la conversion du contrat en style caveman est partie de 250
lignes et est arrivée à 253, au-dessus du plafond `claude_max_lignes`. Trois
resserrages successifs n'ont rien changé au compte : chacun raccourcissait la
phrase sans faire remonter un mot sur la ligne précédente.

**Cause** — deux erreurs de raisonnement de ma part. D'abord j'ai supposé qu'un
style qui supprime articles et subordonnées produirait un fichier plus court :
faux, il remplace des phrases longues par beaucoup de phrases courtes, et le
volume de caractères ne bouge presque pas. Ensuite, le contrôle compte des
**lignes** dans un fichier enveloppé à 80 colonnes : tant qu'une réécriture ne
libère pas 80 caractères d'affilée dans un même paragraphe, le compte reste
identique, même si le texte est visiblement plus court. J'ai fait quatre
modifications sans effet avant de vérifier le compte après chacune.

**Detecte par** — `relecture`

**Action** — `comportement` — sur un fichier borné en lignes, mesurer après
chaque modification plutôt qu'après une série ; et viser un paragraphe entier à
réécrire, pas une tournure à raccourcir.

### 2. Rien ne vérifie que le contrat dit toujours la même chose

**Symptome** — `./init.sh --check` a validé la réécriture intégrale du contrat :
sommaire de `memory/` exact, aucun lien mort, aucun titre en double, 250 lignes.
Ces quatre contrôles portent sur la structure. Aucun ne regarde le contenu : une
règle perdue, un seuil changé (« < 200 Mo »), un palier d'exposition décrit à
l'envers passeraient tous les quatre.

**Cause** — le contrat est le seul document du dépôt dont le lecteur principal
est un agent, et le seul dont aucun test ne dépend. Les garde-fous existants ont
été posés sur les dérives observées — croissance, doublons de section, sommaire
menteur — qui sont toutes des dérives de forme. Une réécriture de fond est un
cas nouveau, et le fait que `--check` soit vert ne prouve ici rien d'autre que
l'absence de dégât structurel.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la relecture du contenu revient à l'humain : c'est
son contrat, et le style est sa décision. Rien à automatiser tant que la
réécriture intégrale reste exceptionnelle.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 23:51 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 41 | 0,00 $ |
| Écriture de cache | 103 644 | 0,65 $ |
| Lecture de cache | 1 884 413 | 0,94 $ |
| Sortie | 21 257 | 0,53 $ |
| **Total** | **2 009 355** | **2,12 $ — 1,84 €** |

**Ce qui coûte**

- **22 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  59 140 jetons, écrits une fois par session puis relus à chaque
  échange : 1 241 940 jetons de relecture, 65 % de tout ce qui a été relu.
- **Tours courts** — 9 des 22 tours (40 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,56 $, soit 26 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 59 140 jetons relus au premier appel qui relise
  quelque chose, 103 354 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 2009355 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 59140 0 903
2 principal claude-opus-5 3429 59140 258
3 principal claude-opus-5 3711 62569 427
4 principal claude-opus-5 4869 66280 1037
5 principal claude-opus-5 10545 71149 7435
6 principal claude-opus-5 7615 81694 220
7 principal claude-opus-5 450 89309 229
8 principal claude-opus-5 1843 89759 818
9 principal claude-opus-5 1012 91602 1544
10 principal claude-opus-5 1690 92614 84
11 principal claude-opus-5 90 94304 423
12 principal claude-opus-5 603 94394 922
13 principal claude-opus-5 1067 94997 850
14 principal claude-opus-5 900 96064 84
15 principal claude-opus-5 90 96964 1396
16 principal claude-opus-5 1446 97054 1245
17 principal claude-opus-5 1295 98500 144
18 principal claude-opus-5 235 99795 2100
19 principal claude-opus-5 2174 100030 96
20 principal claude-opus-5 433 102204 698
21 principal claude-opus-5 717 102637 107
22 principal claude-opus-5 290 103354 237
-->
<!-- /cout -->
