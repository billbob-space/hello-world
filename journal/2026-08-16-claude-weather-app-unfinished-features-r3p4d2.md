# 2026-08-16 — claude/weather-app-unfinished-features-r3p4d2

Branche : `claude/weather-app-unfinished-features-r3p4d2`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La branche à reprendre n'existait nulle part

**Symptome** — demande initiale : reprendre `claude/weather-app-unfinished-features-nrzal0`,
ouverte par une autre session cloud restée bloquée sur la même question. Ni `git fetch`
ni `list_branches` ne connaissent cette référence : la session tournait encore, n'avait
rien committé, rien poussé. Il n'y avait donc rien à reprendre — seulement un sujet.
Même constat pour la session « Navigation historique météo » du 15 août, archivée sur une
question sans réponse : sa branche `claude/meteo-historical-navigation-vemabz` n'a jamais
atteint le dépôt, et son conteneur ayant disparu, ce travail est définitivement perdu.

**Cause** — une session cloud qui dialogue sans jamais committer ne laisse aucune trace
hors de son conteneur. Le contrat impose de pousser à chaque commit, mais rien ne dit
quand faire le premier : une session qui tourne longtemps avant de produire un artefact
est indistinguable, vue du dépôt, d'une session qui n'a jamais existé.

**Detecte par** — `utilisateur`

**Action** — `comportement` — pousser un premier commit (entrée de journal, spec) dès que
le sujet est arrêté, avant tout dialogue long : c'est le seul point de reprise qu'une
autre session pourra retrouver.

### 2. Deux retouches abandonnées qui ne se combinent pas

**Symptome** — les deux évolutions d'affichage laissées en brouillon les 9 et 10 août
touchent le même fichier de style et, appliquées ensemble, produisent une échelle non
monotone : la hauteur de marée passerait à 3rem en base et retomberait à 2,6rem au palier
tablette, soit plus petit sur un écran plus large.

**Cause** — les deux branches ont été écrites en parallèle depuis la même base, chacune
ignorant l'autre, et aucune n'a été rejouée sur la mise en page pleine largeur fusionnée
depuis. Une pull request brouillon laissée ouverte ne vieillit pas visiblement : rien ne
signale qu'elle a cessé d'être applicable.

**Detecte par** — `auteur`

**Action** — `comportement` — reprendre une branche abandonnée, c'est en relire l'intention
puis la réécrire sur la base courante, jamais la fusionner telle quelle.
