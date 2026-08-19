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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 15:58 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 22 | 0,00 $ |
| Écriture de cache | 96 166 | 0,60 $ |
| Lecture de cache | 856 656 | 0,43 $ |
| Sortie | 9 103 | 0,23 $ |
| **Total** | **961 947** | **1,26 $ — 1,09 €** |

**Ce qui coûte**

- **11 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 505 jetons, écrits une fois par session puis relus à chaque
  échange : 655 050 jetons de relecture, 76 % de tout ce qui a été relu.
- **Tours courts** — 3 des 11 tours (27 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,17 $, soit 13 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 505 jetons relus au premier appel qui relise
  quelque chose, 94 985 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 961947 -->
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
-->
<!-- /cout -->
