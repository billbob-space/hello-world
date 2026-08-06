# 2026-08-06 — claude/marcq-handball-app-phases-1yk38x

Branche : `claude/marcq-handball-app-phases-1yk38x`
Périmètre : marcq-handball
Mode : `chaud`

Execution des PRP du lot 1 de `apps/marcq-handball/prp/` : 01 socle, 02
programme, 03 entree, 04 seance, 05 perso, 06 recompenses.

## Anomalies

### 1. Le harnais impose une branche unique la ou les PRP en prevoient une par lot

**Symptome** — les PRP decoupent le travail en « un PRP = une branche
`marcq-handball/<sujet>` = une pull request », et le PRP 01 en exige meme deux
(`socle` puis `activation`) parce que la CI ne publie l'image que sur un push
vers `main`. La session cloud, elle, ne peut pousser que sur
`claude/marcq-handball-app-phases-1yk38x`.

**Cause** — le harnais assigne le nom de la branche et refuse tout autre
remote ref, exactement le cas deja consigne dans
`journal/2026-08-03-fabrique-prefixe-impose-par-le-harnais.md`. Le contrat
accepte le prefixe `claude/` pour rejoindre une branche, mais rien n'attenue la
consequence en aval : les frontieres de relecture prevues par les PRP
disparaissent.

**Consequence tenue** — tout le lot 1 arrive dans une seule pull request, un
commit par tache de PRP pour garder la relisibilite, et `enabled` reste a
`false` : activer l'app dans la meme PR referencerait une image qui n'existe pas
encore au registre et ferait echouer le `compose up` de toute la stack.
L'activation est un geste separe, apres la fusion et la publication de l'image.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le decoupage en PR des PRP suppose une liberte de
nommage de branche que les sessions cloud n'ont pas ; a trancher une fois pour
toutes plutot qu'a chaque app.

### 2. Le PRP 02 casse un test Go du PRP 01 sans le dire

**Symptome** — deposer `web/programme.json` fait echouer
`TestProgrammeJSONPasEncoreLivre`, qui exige un 404 sur cette route. Le PRP 02
ne mentionne ni `main_test.go` ni ce test, ni dans sa liste « Fichiers », ni
dans aucune de ses huit taches.

**Cause** — la consigne existe, mais elle est ecrite dans le PRP 01 (« PRP 02
depose le fichier et remplace `TestProgrammeJSONPasEncoreLivre` par l'assertion
200 ») et nulle part dans le PRP 02. Un agent qui applique le 02 sans avoir lu
le 01 en entier casse la suite Go et ne sait pas pourquoi.

**Detecte par** — `test`

**Action** — `contrat` — une obligation d'un PRP aval doit etre ecrite dans ce
PRP aval, pas seulement dans celui qui l'anticipe. Le renvoi croise ne suffit
pas quand les deux documents sont censes s'executer separement.
