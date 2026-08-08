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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 00:04 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 7 926 | 0,04 $ |
| Écriture de cache | 101 945 | 0,64 $ |
| Lecture de cache | 2 667 619 | 1,33 $ |
| Sortie | 12 498 | 0,31 $ |
| **Total** | **2 789 988** | **2,32 $ — 2,02 €** |

**Ce qui coûte**

- **31 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  62 976 jetons, écrits une fois par session puis relus à chaque
  échange : 1 889 280 jetons de relecture, 70 % de tout ce qui a été relu.
- **Tours courts** — 16 des 31 tours (51 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,92 $, soit 39 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 62 976 jetons relus au premier appel qui relise
  quelque chose, 101 502 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 2789988 -->
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
-->
<!-- /cout -->
