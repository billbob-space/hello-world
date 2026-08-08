---
name: compact-claude-md
description: Trie, compresse et réorganise les fichiers de mémoire projet (CLAUDE.md, AGENTS.md, .claude/rules) en supprimant les consignes inutiles plutôt qu'en abrégeant le texte. Déclenche cette skill dès que l'utilisateur parle de nettoyer, compacter, alléger, simplifier, réduire, auditer ou réorganiser un CLAUDE.md ou sa mémoire projet, ou se plaint qu'il est trop long / bouffe du contexte / a dérivé — même sans le mot « skill » et même s'il demande juste « raccourcis ce fichier ». Also triggers in English on requests to compact, trim, shrink or audit a CLAUDE.md, on project memory bloat, and on context window optimization for memory files.
---

# Compacter un CLAUDE.md

## Le principe

Le gain vient de **ce qu'on supprime, pas de la façon dont on l'écrit**.

Réécrire en style télégraphique (« caveman ») fait gagner 10-15 % de tokens au mieux, et détruit l'information : les mots-outils portent les relations logiques (négations, conditions, qui fait quoi). `ne jamais commit sans lancer les tests` → `commit tests` : le modèle rebouche le trou avec ses priors et l'instruction est perdue. **Ne jamais compresser par abréviation, dégrammaticalisation, ou substitution de symboles.** Le français (ou l'anglais) reste grammatical, simplement dense.

En revanche, un CLAUDE.md typique contient 40 à 70 % de lignes qui n'influencent aucune décision. C'est là que se trouve le budget.

Un CLAUDE.md sain tient en 30-60 lignes.

## Phase 1 — Inventaire vérifié (lecture seule)

**N'écris aucun fichier pendant cette phase.** Le tri et l'application doivent être séparés par une validation humaine — sans ça l'utilisateur perd son droit de veto, et c'est précisément là que disparaissent les garde-fous utiles.

Commence par cartographier ce qui est réellement chargé :

- le `CLAUDE.md` racine et tous ceux des sous-dossiers concernés
- les imports `@chemin/fichier.md` (ils comptent dans le budget contexte)
- `~/.claude/CLAUDE.md` si l'utilisateur le mentionne — c'est souvent là que la dette est la plus lourde, parce que rien n'oblige jamais à le relire
- `AGENTS.md`, `.cursorrules`, ou équivalents s'ils coexistent (source classique de doublons)

Puis, **avant de classer une ligne, vérifie-la contre le dépôt réel**. C'est ce qui distingue un tri fiable d'un avis arbitraire : si une ligne dit « lance `pnpm test:e2e` », ouvre `package.json` et regarde si le script y est déclaré. Utilise Read, Glob et Grep sur :

- `package.json`, `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml` → commandes déjà déclarées
- `.github/workflows/`, `.pre-commit-config.yaml` → contraintes déjà automatisées
- `tsconfig.json`, `.eslintrc*`, `.prettierrc*`, `.editorconfig` → conventions déjà appliquées par l'outillage
- l'arborescence réelle → descriptions de structure devenues fausses

Une consigne déjà imposée par un linter ou un hook CI est du bruit : l'outil est plus fiable que le rappel textuel.

## Verdicts

Classe chaque instruction dans une de ces catégories :

| Verdict | Signification |
|---|---|
| `DROP-DEFAULT` | Comportement que tu appliquerais déjà sans la consigne |
| `DROP-DISCOVERABLE` | Lisible depuis le dépôt — **cite le fichier qui le contient** |
| `DROP-ENFORCED` | Déjà garanti par un linter, un hook, ou la CI |
| `DROP-STALE` | Faux ou obsolète par rapport au dépôt actuel |
| `DROP-HISTORY` | Justification, historique, ou récit sans effet sur une décision |
| `MERGE` | Redondant avec une autre ligne — **indique laquelle** |
| `MOVE` | Utile mais pas à chaque tour → propose un chemin cible |
| `KEEP` | Spécifique au projet, contre-intuitif, ou garde-fou |

### Ce qui tombe en `DROP-DEFAULT`

Tout ce qui relève du comportement par défaut d'un modèle compétent : « écris du code lisible », « ajoute des tests », « gère les erreurs », « respecte les conventions existantes », « demande si tu as un doute », « ne casse pas l'existant ». Ces lignes coûtent du contexte et ne changent rien. Pire, elles diluent l'attention portée aux consignes qui, elles, comptent.

### Ce qui reste en `KEEP`

Le critère est la **surprise** : une consigne mérite sa place si un développeur compétent mais nouveau sur le projet pourrait raisonnablement faire l'inverse.

- conventions qui divergent du défaut de l'écosystème
- commandes avec des flags ou un ordre non-devinables
- pièges où le projet s'est déjà fait avoir (une régression passée vaut dix consignes préventives)
- interdits explicites avec une conséquence réelle (« ne touche pas à `migrations/`, elles sont rejouées en prod »)
- vocabulaire métier non-évident

**Ne supprime jamais un garde-fou de sécurité ou de destruction de données au motif qu'il « paraît évident »**, même s'il ressemble à un `DROP-DEFAULT`. Dans le doute sur ce type de ligne, propose `KEEP` et signale l'hésitation.

### `MOVE` : le vrai levier

Le gain le plus important n'est pas la suppression mais le **déplacement hors du chargement systématique**. Une explication d'architecture de 40 lignes est utile trois fois par mois : elle a sa place dans `docs/architecture.md`, référencée par une ligne dans CLAUDE.md, et lue à la demande.

CLAUDE.md doit tendre vers un index de règles courtes + des pointeurs. Si un bloc dépasse ~8 lignes sur un même sujet, c'est un candidat `MOVE`.

Cible selon le cas : `docs/*.md` pour la référence, une skill dédiée pour un workflow répétable, un CLAUDE.md de sous-dossier pour ce qui ne concerne qu'une partie du code.

## Phase 2 — Restituer le tri

Présente un tableau : `ligne | verdict | justification (10 mots max)`.

Puis un récapitulatif : nombre de lignes avant/après, estimation du gain en tokens, et la liste des `MOVE` avec leur destination.

Termine en demandant explicitement à l'utilisateur ce qu'il conteste avant d'appliquer quoi que ce soit. Attends sa réponse.

## Phase 3 — Appliquer

Uniquement après validation. Vérifie d'abord que l'arbre git est propre (ou dis-le à l'utilisateur) — il doit pouvoir faire `git diff` puis annuler.

Règles de réécriture des lignes conservées :

- une instruction par ligne, verbe à l'impératif en premier
- pas de justification, sauf si elle empêche une erreur récurrente identifiée
- regrouper par sections courtes (Commandes / Conventions / Architecture / Pièges) — le regroupement remplace les transitions
- tables ou listes pour tout ce qui est énumératif
- les majuscules impératives (`NE JAMAIS`, `TOUJOURS`) sur 2-3 lignes maximum : au-delà, plus rien ne ressort

**Exemple**

Avant :
```
Pour les tests, il est important de noter que nous utilisons Vitest et non Jest,
suite à la migration de mars 2024 qui avait été motivée par les problèmes de
performance sur les gros suites. Pense à bien lancer les tests avant de commit.
```

Après :
```
- Tests : Vitest (pas Jest) — les recettes Jest de ta mémoire ne s'appliquent pas.
```

La justification historique disparaît (`DROP-HISTORY`), « lancer les tests avant commit » disparaît si un hook pre-commit le fait déjà (`DROP-ENFORCED`), et l'information réellement surprenante est mise en avant.

## Phase 4 — Vérification comportementale

Un CLAUDE.md ne se juge pas à sa lecture mais à ce qu'il empêche. Le seul test valable est comportemental.

Propose 2-3 tâches typiques du projet à relancer dans une session neuve, choisies pour toucher les zones où des lignes ont été supprimées. Si une consigne retirée était réellement porteuse, la régression apparaît au premier tour et on la remet — avec, cette fois, la preuve qu'elle sert à quelque chose.

## Anti-patterns

- Réécrire en style télégraphique, en pseudo-code, ou en abréviations
- Supprimer et réécrire dans le même tour que le tri
- Classer `DROP-DISCOVERABLE` sans avoir ouvert le fichier qui est censé contenir l'info
- Traiter le CLAUDE.md racine sans regarder les imports ni les sous-dossiers
- Supprimer un garde-fou destructif parce qu'il « va de soi »
- Optimiser le nombre de caractères plutôt que le nombre de décisions influencées
