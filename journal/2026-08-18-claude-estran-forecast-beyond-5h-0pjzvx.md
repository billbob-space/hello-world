# 2026-08-18 — claude/estran-forecast-beyond-5h-0pjzvx

Branche : `claude/estran-forecast-beyond-5h-0pjzvx`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La navigation temporelle a laisse le jour courant tronque a cinq heures

**Symptome** — un aller-retour utilisateur : impossible de voir la fin de
l'apres-midi sans partir sur demain puis revenir. La donnee etait deja
recuperee et deja servie aux autres jours ; seule la journee en cours restait
coupee a cinq vignettes.

**Cause** — prp/01 s'etait donne pour contrainte principale de laisser l'ecran
d'aujourd'hui identique a l'octet pres, et a livre les vingt-quatre heures
« pour un jour autre qu'aujourd'hui ». Cette formulation, ecrite pour proteger
l'ecran d'ouverture, a fige une asymetrie que personne n'avait choisie : le
seul jour qu'on regarde vraiment etait le seul a ne pas avoir le detail.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une capacite s'ajoute « pour les autres
cas », verifier ce qu'elle laisse au cas par defaut : ne pas toucher a l'ecran
d'ouverture est une precaution, pas un objectif.
