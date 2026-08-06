# 2026-08-06 — claude/marcq-handball-app-7zqifi

Branche : `claude/marcq-handball-app-7zqifi`
Périmètre : marcq-handball
Mode : `chaud`

Execution du PRP 07 de `apps/marcq-handball/prp/` — le classement cote serveur :
domaine Go, magasin sur fichier, trois routes `/api/*`, et le volume persistant
qui les alimente.

## Anomalies

### 1. Le verrou du PRP 07 est leve depuis que le contrat a change

**Symptome** — le PRP 07 s'ouvre sur un verrou en deux moities : le volume
persistant doit etre tranche « cote serveur », et `init.sh` doit apprendre a
monter un volume, sur une branche `fabrique/<sujet>` distincte. Les deux sont
faux au 2026-08-06.

**Cause** — le PRP a ete redige contre l'etat du depot a sa date. Depuis,
`init.sh` a gagne `check_volume`, `check_volume_list` et `check_volume_noms`
(l'aide en tete de fichier documente `volumes:` dans `app.yml`), et le contrat a
inverse la regle qu'il citait : « Une base, un cache, un volume, un service
annexe **t'appartiennent desormais** : declare-les dans un manifeste plutot que
de les demander dans un `README` ». Le chantier 1 du PRP — ecrire la demande
dans le README puis s'arreter — decrit donc un geste que le contrat interdit
maintenant.

**Detecte par** — `auteur`

**Action** — `contrat` — un PRP fige une lecture du contrat a sa date d'ecriture
et rien ne le lui rappelle. Le chantier 1 du PRP 07 est a reecrire : le volume
se declare dans `app.yml`, il ne se demande plus.
