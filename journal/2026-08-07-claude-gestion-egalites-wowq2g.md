# 2026-08-07 — claude/gestion-egalites-wowq2g

Branche : `claude/gestion-egalites-wowq2g`
Périmètre : marcq-handball
Mode : `chaud`

## Anomalies

### 1. La règle de départage transformait le classement en course au chrono

**Symptome** — Le PRD §9 écrivait « à égalité, le premier arrivé à ce score est
devant », et le serveur l'appliquait à la minute près. Dans une équipe où la
plupart des enfants cochent tout, plus aucune ligne du classement ne mesurait
l'assiduité : le podium départageait la vitesse à sortir son téléphone après la
séance. Un enfant à 100 % pouvait lire « 9e sur 12 » sans qu'aucun écran ne lui
dise pourquoi, et la règle récompensait de cocher avant d'avoir fait.

**Cause** — La règle avait été écrite pour que l'ordre soit *total*, pas pour
qu'il soit *juste* : elle répondait à la question technique « comment trier deux
lignes identiques » et personne n'a demandé ce que le tri produirait quand la
majorité des lignes seraient identiques. Le cas dégénéré — tout le monde à
100 % — est le cas nominal d'une équipe motivée, et c'est précisément celui
qu'aucun test ne mettait en scène : les tests de classement comparaient toujours
des scores différents.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — aucun garde-fou ne pouvait voir ça : le code faisait
exactement ce que le PRD demandait. Seul un humain qui se représente douze
enfants réels pouvait juger la règle mauvaise.
