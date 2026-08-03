# 2026-08-03 — fabrique/prefixe-impose-par-le-harnais

Branche : `fabrique/prefixe-impose-par-le-harnais`
Périmètre : fabrique

Résolution de l'`arbitrage` ouvert par l'entrée
[`claude/ramure-design-implementation-4fnao0`](2026-08-03-claude-ramure-design-implementation-4fnao0.md),
anomalie 6. Décision de l'utilisateur : « c'est un system » — le préfixe est
imposé, donc le contrat l'admet.

## Anomalies

### 1. Le journal était inouvrable depuis une session cloud

**Symptôme** — `./init.sh --branche claude/exemple-impose` répond
`ERREUR : prefixe 'claude' inconnu`. Or c'est le geste qui ouvre l'entrée de
journal, et `claude/<sujet>` est le seul nom de branche qu'une session cloud
puisse porter.

**Cause** — le journal a été livré avec `--branche` pour unique porte d'entrée,
sans que je vérifie que cette porte s'ouvre sur les branches réellement
utilisées. La validation de préfixe existait avant le journal et n'avait alors
aucune conséquence : refuser un nom qu'on ne créait de toute façon pas par ce
chemin ne coûtait rien. Le journal a transformé un refus inerte en blocage — le
mécanisme censé enregistrer les anomalies ne pouvait pas être ouvert là où il
servirait le plus.

**Detecte par** — `auteur` — en reproduisant le cas avant de trancher
l'arbitrage. Aucune session n'était encore repassée par ce chemin depuis la
fusion, donc rien ne l'avait signalé.

**Action** — `garde-fou` — corrigé : `claude` est accepté pour **rejoindre** une
branche existante, refusé pour en **créer** une, avec un message qui renvoie vers
`<app>/<sujet>`. La distinction encode la règle réelle — le harnais l'assigne, on
ne le choisit pas — plutôt que d'ouvrir le vocabulaire. Vérifié dans les deux
sens : création refusée, branche existante rejointe et son entrée ouverte.

### 2. Le préfixe accepté ne porte plus l'information qu'il promettait

**Symptôme** — le contrat pose que « le préfixe dit quel périmètre est en jeu,
donc quel rayon de souffle, avant même d'ouvrir le diff ». `claude/<sujet>` ne dit
rien de tel.

**Cause** — admettre le préfixe résout le blocage mais crée une catégorie de
branches dont le nom n'informe pas. C'est le coût de la décision, pas un défaut
d'implémentation : le harnais ne connaît pas la convention du dépôt.

**Detecte par** — `auteur` — en rédigeant la section du contrat, où la
contradiction est devenue visible à l'écriture.

**Action** — `contrat` — la section dit maintenant ce que ce préfixe ne dit pas,
et où lire le périmètre à la place : le champ `Périmètre` de l'entrée de journal,
et le diff. Aucun garde-fou possible ici — le périmètre d'une branche neuve n'est
pas déductible à sa création, puisqu'elle ne touche encore rien.

### 3. Une branche de simulation a ouvert une entrée de journal orpheline

**Symptôme** — vérifier le chemin « branche existante » demandait une vraie
branche `claude/*`. La rejoindre a ouvert
`journal/2026-08-03-claude-simulation-harnais.md`, qui ne correspondait à aucun
travail.

**Cause** — `--branche` ouvre une entrée à chaque appel, y compris quand l'appel
est un test du mécanisme lui-même.

**Detecte par** — `auteur` — immédiatement, à la lecture de la sortie.

**Action** — `rien` — l'entrée et la branche ont été supprimées avant tout
commit, et `--check` ne juge que les entrées suivies par git : une entrée
orpheline non committée n'aurait rien cassé de toute façon. Noté parce que c'est
le premier cas où la conception a absorbé une bavure sans qu'on ait à y penser.
