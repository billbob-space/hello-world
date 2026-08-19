# 2026-08-19 — claude/project-mockups-validation-u65p0l

Branche : `claude/project-mockups-validation-u65p0l`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. Le contrat ne disait rien de la forme sous laquelle un choix est soumis

**Symptome** — l'utilisateur a demande que toute decision qui lui revient lui soit
presentee sous forme de quelques maquettes, plutot que decrite. Rien dans le contrat
ne le prevoyait : les choix lui etaient poses en prose, format sur lequel il tranche
mal — il decide de ce qu'on construit et ne lit pas le code.

**Cause** — la section « Comment tu reponds » regle le registre de la reponse (en
francais, court, l'effet plutot que le mecanisme) mais pas la **forme d'une question**.
L'outillage etait deja la — `frontend-design` et `impeccable` sont installes — sans
qu'aucune regle ne dise quand s'en servir pour autre chose que du code livre.

**Detecte par** — `utilisateur`

**Action** — `contrat` — une section dediee dans `CLAUDE.md`, et le sort de la
decision retenue precise dans `memory/produit.md`.

### 2. Ou vivent les maquettes n'a pas de reponse evidente dans une fabrique

**Symptome** — en ecrivant la regle, il a fallu trancher un point que la demande ne
disait pas : les fichiers de maquette entrent-ils dans le depot ? « Tout ce qui decrit
une app vit dans son repertoire » plaidait pour `apps/<nom>/`, leur nature jetable
contre.

**Cause** — une maquette est un objet hybride : elle sert a decider (donc elle
ressemble a un document de produit) mais ne survit pas a la decision (donc elle
ressemble a un brouillon). Le contrat n'avait pas de categorie pour ca.

**Detecte par** — `auteur`

**Action** — `arbitrage` — tranche par defaut : les maquettes ne sont pas committees,
seule la decision retenue l'est, dans le PRD ou le PRP. A revoir si une variante
ecartee se revele utile a rouvrir.

### 3. La limite ecrite pour proteger la regle l'avait retrecie

**Symptome** — la premiere version de la regle rangeait « un choix sans forme visible »
hors de son perimetre : palier d'exposition, technologie, arbitrage de perimetre restaient
des questions en prose. L'utilisateur a demande le contraire — illustrer ceux-la aussi
quand c'est possible.

**Cause** — la limite a ete ecrite pour un vrai risque (illustrer a vide, faire decider
sur une mise en forme plutot que sur le fond) mais elle visait le mauvais critere. Ce qui
n'a pas d'ecran a dessiner a quand meme des **consequences** qui se montrent : qui entre
et qui reste dehors, ce qui devient impossible. En confondant « pas d'interface » et « rien
a montrer », la regle excluait justement les choix ou le lecteur non technicien est le plus
demuni face a de la prose.

**Detecte par** — `utilisateur`

**Action** — `contrat` — le critere devient « une consequence se montre-t-elle
honnetement ? » et non « y a-t-il un ecran ? ». La prose reste le recours quand rien ne
s'ajoute a trois phrases.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 16:09 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 66 | 0,00 $ |
| Écriture de cache | 115 226 | 0,72 $ |
| Lecture de cache | 3 186 491 | 1,59 $ |
| Sortie | 17 612 | 0,44 $ |
| **Total** | **3 319 395** | **2,75 $ — 2,39 €** |

**Ce qui coûte**

- **33 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 505 jetons, écrits une fois par session puis relus à chaque
  échange : 2 096 160 jetons de relecture, 65 % de tout ce qui a été relu.
- **Tours courts** — 18 des 33 tours (54 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,12 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 505 jetons relus au premier appel qui relise
  quelque chose, 115 037 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 3319395 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65505 0 599
2 principal claude-opus-5 10360 65505 561
3 principal claude-opus-5 5938 75865 620
4 principal claude-opus-5 2530 81803 1580
5 principal claude-opus-5 2264 84333 2624
6 principal claude-opus-5 3142 86597 1184
7 principal claude-opus-5 1603 89739 124
8 principal claude-opus-5 1240 91342 1118
9 principal claude-opus-5 1323 92582 113
10 principal claude-opus-5 1080 93905 484
11 principal claude-opus-5 1181 94985 96
12 principal claude-opus-5 407 96166 822
13 principal claude-opus-5 934 96573 204
14 principal claude-opus-5 845 97507 86
15 principal claude-opus-5 504 98352 978
16 principal claude-opus-5 1716 98856 100
17 principal claude-opus-5 1023 100572 137
18 principal claude-opus-5 434 101595 230
19 principal claude-opus-5 3167 102029 255
20 principal claude-opus-5 396 105196 444
21 principal claude-opus-5 381 106036 137
22 principal claude-opus-5 1264 106417 529
23 principal claude-opus-5 616 107681 183
24 principal claude-opus-5 28 108480 288
25 principal claude-opus-5 1034 108508 133
26 principal claude-opus-5 326 109542 137
27 principal claude-opus-5 684 109868 281
28 principal claude-opus-5 817 110552 231
29 principal claude-opus-5 44 111600 1367
30 principal claude-opus-5 1559 111644 908
31 principal claude-opus-5 1218 113203 175
32 principal claude-opus-5 616 114421 721
33 principal claude-opus-5 1047 115037 163
-->
<!-- /cout -->
