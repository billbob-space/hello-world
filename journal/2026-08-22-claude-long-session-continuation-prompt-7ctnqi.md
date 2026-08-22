# 2026-08-22 — claude/long-session-continuation-prompt-7ctnqi

Branche : `claude/long-session-continuation-prompt-7ctnqi`
Périmètre : fabrique — contrat, `memory/`, `lib/journal.sh`, `scripts/cout.sh`,
`.claude/commands/livrer.md`. Aucune app touchée.
Mode : `chaud`

Sujet : quand la session annonce qu'elle est devenue trop longue, son message
doit se terminer par un prompt de reprise, copiable tel quel dans une session
neuve.

## Anomalies

### 1. La coupe était annoncée sans rien pour la reprendre

**Symptome** — le dépôt sait dire « coupe la session » à trois endroits —
l'avertissement de `cout.sh` à 300 000 jetons, son refus à 600 000, et la
proposition de `/livrer` — et aucun ne dit ce que la session neuve reçoit. Le
contrat décrivait pourtant déjà par quoi elle doit repartir : PRD, PRP, entrée de
journal, messages de commit, « jamais par le fil de la conversation ».

**Cause** — la règle était écrite du côté de la session qui **arrive**, jamais du
côté de celle qui **part**. Or elle seule sait où le travail en est : ce qui est
poussé, ce qui reste, les pistes déjà fermées. Non transmis, cet état meurt avec
le conteneur, et la session neuve le rachète en explorant — soit exactement le
coût qu'on coupait pour éviter. L'utilisateur l'a demandé après l'avoir payé.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la règle entre dans `CLAUDE.md`, son gabarit dans
`memory/travail.md`, et le rappel dans les deux messages d'alerte de `cout.sh` :
c'est le seul moment où elle s'applique, donc le seul endroit où elle sera lue.

### 2. `branche.sh` n'ouvrait plus aucune entrée de journal

**Symptome** — `./scripts/branche.sh claude/<sujet>` sur une branche existante
annonce « branche existante », puis sort en code 1 sans un mot de plus. Aucune
entrée de journal n'est créée. `pret.sh` refuse ensuite le commit pour entrée
manquante, et le geste censé la créer est précisément celui qui échoue.

**Cause** — le suffixe `--2` des noms de branche réutilisés était calculé
**dans** l'affectation du chemin :
`f="…-$slug$([ "$rang" -gt 1 ] && printf -- '--%s' "$rang").md"`. L'affectation
hérite du code de sortie de la substitution ; au rang 1 — la première entrée d'un
nom de branche, c'est-à-dire le cas normal — le test est faux, l'affectation sort
non nulle, et `set -e` tue le script juste avant la création du fichier. Introduit
la veille, en même temps que le suffixe lui-même. Les deux cas de test existants
couvraient le rang 2 et l'entrée déjà présente ; le rang 1 n'en avait aucun, et
un test qui n'aurait pas activé `set -e` serait passé au vert sur le code cassé,
puisque la fonction rendait bien le bon chemin.

**Detecte par** — `auteur`

**Action** — `garde-fou` — suffixe calculé avant l'affectation, par un `if`, et
un troisième cas dans `test-pret.sh` qui lance `journal_ouvre` sous `set -e` sur
un dépôt sans entrée. Vérifié rouge sur le code d'avant, vert après.
