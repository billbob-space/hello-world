# 2026-08-03 — fabrique/journal-des-anomalies

Branche : `fabrique/journal-des-anomalies`
Périmètre : fabrique
Mode : `chaud`

Première entrée écrite avec le mécanisme qu'elle décrit.

## Anomalies

### 1. La vérification en CI aurait rendu `--check` rouge pendant toute la session

**Symptôme** — anticipé à la conception, pas observé : `--check` refusant un
gabarit nu aurait échoué dès la seconde suivant `./init.sh --branche`, puisque
l'entrée fraîche *est* un gabarit nu. Or `--pret` appelle `--check`. Toute la
session serait restée rouge jusqu'à ce que le journal soit écrit, y compris pour
des raisons sans rapport.

**Cause** — confondre « entrée livrée » et « entrée en cours d'écriture ».

**Detecte par** — `relecture` — avant écriture du code.

**Action** — `rien` — corrigé à la conception : `--check` ne juge que les entrées
suivies par git. Vérifié dans les deux sens, `--check` sort 0 avec l'entrée non
suivie et 1 après `git add`.

### 2. Le premier réflexe était un hook `Stop`, qui se déclenche au mauvais rythme

**Symptôme** — anticipé, pas observé.

**Cause** — le dépôt a déjà un hook `Stop` (`garde-commit.sh`), donc le réflexe
était d'en ajouter un second. Mais `Stop` se déclenche à **chaque fin de tour**,
alors que l'unité de travail journalisée est **la branche**. Le hook aurait
réclamé le journal des dizaines de fois par branche.

**Detecte par** — `relecture` — avant écriture du code.

**Action** — `comportement` — la fréquence d'un garde-fou doit épouser l'unité
qu'il protège. `--pret` tourne une fois par commit, `--check` une fois par PR :
les deux bonnes cadences existaient déjà.

### 3. Le journal de la branche la plus riche a dû être reconstitué

**Symptôme** — l'entrée `claude/ramure-design-implementation-4fnao0` a été écrite
après coup, la branche étant déjà fusionnée.

**Cause** — le mécanisme n'existait pas quand cette branche a vécu. Inévitable
pour la première fois, et jamais ensuite.

**Detecte par** — `auteur` — en faisant l'exercice.

**Action** — `rien` — mais c'est la démonstration la plus utile de la session :
reconstituer dix anomalies de mémoire donne une confiance très inégale. Les plus
coûteuses sont sûres, les mineures probablement incomplètes, et je ne sais pas
lesquelles manquent. C'est l'écart exact que « écrire à chaud » supprime. L'entrée
porte un avertissement en tête, et l'`analyste` a pour consigne de ne pas la
compter comme une mesure fiable.

### 4. J'ai conçu deux champs pour l'agrégation, puis je les ai écrits en prose

**Symptôme** — mes deux premières entrées portaient treize valeurs de « Détecté
par », réparties en six catégories informelles : « moi », « moi, au navigateur »,
« la critique impeccable », « la mesure à 54 scènes », « le compilateur »,
« l'utilisateur ». Aucune ne correspondait au vocabulaire que mon propre gabarit
proposait.

**Cause** — j'avais conclu d'une réponse antérieure que le lecteur serait humain,
et un humain lit de la prose. Le gabarit listait bien des valeurs, mais rien ne
les imposait, et je ne les ai pas suivies moi-même — dans la même session où je
les avais écrites. Un vocabulaire non vérifié n'est pas un vocabulaire, c'est une
suggestion.

**Detecte par** — `utilisateur` — sur la PR #23 : « il est possible qu'un agent
relise afin de créer des plans d'amélioration ». La phrase invalide l'hypothèse
du lecteur humain, et avec elle le format.

**Action** — `garde-fou` — corrigé : `Detecte par` et `Action` ont un vocabulaire
fermé, et `./init.sh --check` compte les titres d'anomalie puis les champs
valides et refuse l'écart. Un jeton hors vocabulaire ne matche pas, donc le
compte tombe — pas besoin d'analyser le document. La prose reste dans `Symptôme`
et `Cause`, qui ne sont pas vérifiés. Les deux entrées existantes ont été
réécrites : c'était la seule preuve qui vaille.

### 5. Le journal n'avait pas de lecteur

**Symptôme** — le mécanisme garantissait que les entrées soient écrites, et rien
au-delà. Un journal que personne ne relit est un coût sans contrepartie.

**Cause** — j'ai conçu la collecte sans concevoir l'exploitation, en comptant sur
une revue humaine périodique qui n'était outillée par rien.

**Detecte par** — `utilisateur` — même retour que l'anomalie 4 : « afin de créer
des plans d'amélioration » nommait la moitié manquante.

**Action** — `outillage` — un agent `analyste` est généré dans `.claude/agents/`,
restreint à `Bash`, `Read` et `Grep`. Il agrège les deux champs fermés, cherche
les récurrences entre branches et rend un plan ordonné. Comme le `greffier`, il
n'a pas d'outil d'édition : il rend son plan dans sa réponse et ne touche pas au
dépôt, ce qui le rend lançable en tâche de fond. Non vérifié en session : le
registre des agents est lu au démarrage, celui-ci ne sera invocable qu'à la
suivante.

### 6. La recette d'agrégation livrée à l'`analyste` était fausse

**Symptôme** — la distribution comptait `montreEtat()`, `impeccable` et
`./init.sh` comme valeurs de « Détecté par ». Six jetons attendus, huit obtenus.

**Cause** — le motif d'extraction était gourmand et prenait le **dernier** groupe
entre apostrophes inverses de la ligne, pas le premier. Or la prose qui suit le
jeton en contient souvent d'autres — c'est même le cas courant, puisque le format
encourage à justifier le jeton. Le `grep | sort | uniq` que j'avais écrit dans le
gabarit de l'agent avait le même défaut sous une autre forme : il agrégeait des
lignes entières, donc toutes distinctes.

**Detecte par** — `auteur` — en lançant la recette pour la première fois, après
l'avoir livrée dans le fichier de l'agent.

**Action** — `comportement` — j'ai écrit une commande dans un artefact livré sans
l'exécuter. `--check` ne l'aurait jamais vu : il valide le journal, pas les
recettes qui le lisent. Le motif est corrigé, ancré en début de ligne, et le
gabarit de l'`analyste` porte maintenant un contrôle de somme — le total des
jetons doit égaler le nombre de `^### `, faute de quoi l'extraction laisse des
anomalies de côté. Vérifié : 15 titres, 15 jetons de chaque côté.
