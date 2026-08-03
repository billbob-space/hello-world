# 2026-08-03 — fabrique/journal-des-anomalies

Branche : `fabrique/journal-des-anomalies`
Périmètre : fabrique

Première entrée écrite avec le mécanisme qu'elle décrit.

## Anomalies

### 1. La vérification en CI aurait rendu `--check` rouge pendant toute la session

**Symptôme** — anticipé à la conception, pas observé : `--check` refusant un
gabarit nu aurait échoué dès la seconde suivant `./init.sh --branche`, puisque
l'entrée fraîche *est* un gabarit nu. Or `--pret` appelle `--check`. Toute la
session serait restée rouge jusqu'à ce que le journal soit écrit, y compris pour
des raisons sans rapport.

**Cause** — confondre « entrée livrée » et « entrée en cours d'écriture ».

**Détecté par** — relecture, avant écriture du code.

**Ce que ça devrait changer** — rien, c'est corrigé : `--check` ne juge que les
entrées **suivies par git**. Une entrée non suivie est un travail en cours. En CI
tout est suivi, donc rien n'est relâché là où ça compte. Vérifié dans les deux
sens : `--check` sort 0 avec l'entrée non suivie, et 1 après `git add`.

### 2. Le premier réflexe était un hook `Stop`, qui se déclenche au mauvais rythme

**Symptôme** — anticipé, pas observé.

**Cause** — le dépôt a déjà un hook `Stop` (`garde-commit.sh`), donc le réflexe
était d'en ajouter un second. Mais `Stop` se déclenche à **chaque fin de tour**,
alors que l'unité de travail journalisée est **la branche**. Le hook aurait
réclamé le journal des dizaines de fois par branche.

**Détecté par** — relecture, avant écriture du code.

**Ce que ça devrait changer** — rien. Motif à retenir : la fréquence d'un
garde-fou doit épouser l'unité qu'il protège. `--pret` tourne une fois par
commit, `--check` une fois par PR — les deux bonnes cadences étaient déjà là.

### 3. Le journal de la branche la plus riche a dû être reconstitué

**Symptôme** — l'entrée `claude/ramure-design-implementation-4fnao0` a été écrite
après coup, la branche étant déjà fusionnée.

**Cause** — le mécanisme n'existait pas quand cette branche a vécu. Inévitable
pour la première fois, et jamais ensuite.

**Détecté par** — moi, en faisant l'exercice.

**Ce que ça devrait changer** — rien, mais c'est la démonstration la plus utile de
la session : reconstituer dix anomalies de mémoire donne une confiance très
inégale. Les plus coûteuses sont sûres. Les mineures sont probablement
incomplètes, et je ne sais pas lesquelles manquent. C'est exactement l'écart que
« écrire à chaud » cherche à supprimer.

Une trouvaille en est sortie qui n'aurait émergé d'aucune autre relecture :
**le nom de branche imposé par le harnais cloud viole la convention du contrat**,
et aucun garde-fou ne le voit. Écrire le journal a produit un défaut de contrat.
