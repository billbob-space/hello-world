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

### 2. Le registre des compétences est lu au démarrage, comme celui des agents

**Symptome** — la compétence écrite pendant cette session n'était pas invocable
dans la même session.

**Cause** — `memory/travail.md` note déjà que le registre des **commandes** est
relu en cours de session, contrairement à ceux des agents et des plugins. Les
compétences suivent le second comportement. La note existait, elle ne citait pas
les compétences parce qu'il n'y en avait pas.

**Detecte par** — `auteur`

**Action** — `contrat` — la ligne de `memory/travail.md` sur les trois registres
en mentionne maintenant quatre.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 00:01 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 7 899 | 0,04 $ |
| Écriture de cache | 90 587 | 0,57 $ |
| Lecture de cache | 1 322 759 | 0,66 $ |
| Sortie | 6 156 | 0,15 $ |
| **Total** | **1 427 401** | **1,42 $ — 1,23 €** |

**Ce qui coûte**

- **17 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  62 976 jetons, écrits une fois par session puis relus à chaque
  échange : 1 007 616 jetons de relecture, 76 % de tout ce qui a été relu.
- **Tours courts** — 9 des 17 tours (52 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,53 $, soit 37 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 62 976 jetons relus au premier appel qui relise
  quelque chose, 90 160 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 1427401 -->
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
-->
<!-- /cout -->
