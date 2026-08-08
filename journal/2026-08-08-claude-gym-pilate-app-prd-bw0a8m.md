# 2026-08-08 — claude/gym-pilate-app-prd-bw0a8m

Branche : `claude/gym-pilate-app-prd-bw0a8m`
Périmètre : pilabelle
Mode : `chaud`

## Anomalies

Aucune anomalie. Rédaction du PRD de `pilabelle` (programme pilates doux
quotidien, personnalisé, palier `private`), après un brainstorming avec
l'utilisateur sur le nom, le suivi de mesures, la durée de séance et les
mécaniques de challenge. Aucun code écrit à ce stade — seul `PRODUCT.md` est
livré, conformément à `memory/produit.md` (« un répertoire qui ne porte que
ces documents est légitime »).

Rédaction ensuite des huit PRP (`apps/pilabelle/prp/`), dérivés de ce PRD, sur
le modèle de `marcq-handball` (serveur qui tient l'état, un PRP = une branche
= une PR) adapté à l'inverse de son partage serveur/navigateur : ici le
serveur tient l'identité, la persistance et l'algorithme, puisque la
progression doit se retrouver sur n'importe quel appareil (PRD §6 item 8),
ce qu'un stockage `localStorage` ne permettrait pas. Toujours aucun code
écrit — seuls les PRP et `apps/pilabelle/CLAUDE.md` (régénéré par
`./init.sh`) changent.

Deux points non tranchés par le PRD ont été résolus par lecture plutôt
qu'escaladés, et documentés comme tels dans `00-ossature.md` §6 et dans
`02-dictionnaire.md` (le tirage sans repli silencieux, PRD §12) : la série
compte les jours actifs déclarés, pas les jours calendaires. Un point reste
un verrou ouvert et nommé, faute de spécification : le contenu et la règle de
génération du défi de la semaine (`06-defi-semaine.md`), écrit en profondeur
« contrat » plutôt qu'exécutable pour cette raison — même choix que les PRP
07 à 11 de `marcq-handball` sur des verrous comparables.

---

Reprise sur la même branche (PR #101 fusionnée depuis) pour implémenter le
lot 1 (PRP 01 à 05) et mettre l'application en ligne, en mode `/livrer`.
Décision prise seule et non escaladée : un seul commit d'activation
(`enabled: true`) à la fin de CETTE branche plutôt que la séquence en deux
PR décrite dans les PRP — vérifié sur `.github/workflows/build.yml:355-374`
que le job `deploy` ne tourne jamais sur un `pull_request`, seulement sur un
`push` vers `main` après fusion, et que `build` (qui publie l'image) le
précède dans le même run via `needs:`. Le risque que la séquence en deux PR
protégeait — un `app.yml` activé avant que l'image existe sur le registre —
ne se produit donc pas si l'activation est fusionnée dans le même run qui
publie l'image pour la première fois.
