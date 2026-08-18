# 2026-08-18 — claude/ci-optimization-sfl4f5

Branche : `claude/ci-optimization-sfl4f5`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. La CI dure dix minutes, et personne ne mesurait où

**Symptome** — l'utilisateur signale une CI « extraordinairement longue ». Mesure
sur le run 32162296876 (push sur `main`, 9 min 49 s) : le job
`tests-de-l-outillage` occupe 8 min 12 s à lui seul, en quatre scripts joués en
séquence — `test-init.sh` 5 min 30, `test-cout.sh` 21 s, `test-pret.sh` 2 min 13,
`test-jetons.sh` 2 s. Tout le reste du graphe — `contrat` 19 s, la matrice `test`
des neuf apps, la matrice `build` des neuf images — est terminé à 2 min 15. Le job
`deploy`, qui a `tests-de-l-outillage` dans ses `needs`, attend donc six minutes
sans rien faire.

**Cause** — le job qui teste l'outillage a grossi script par script sans que rien
ne mesure sa durée. Il est resté un job unique et séquentiel là où ses quatre
scripts sont indépendants, et il verrouille `deploy`.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — aucun contrôle ne dit qu'un job de CI dépasse un
plafond de durée ; la dérive s'installe sans signal.
