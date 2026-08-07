# 2026-08-07 — claude/project-scope-management-oem1sp

Branche : `claude/project-scope-management-oem1sp`
Périmètre : `marcq-handball`, `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le PRD de marcq-handball affirme le contraire de ce que l'application fait

**Symptome** — `apps/marcq-handball/PRODUCT.md` liste le chronomètre et les
vidéos de démonstration sous « Hors périmètre — décidé, pas oublié » (§ 6), et
le § 13 argumente le refus du chronomètre. Les deux sont livrés depuis le
7 août : `web/chrono.js` et `web/video.js` sont dans l'image en ligne, avec
leurs tests. La ligne « Capabilities and Constraints » de la fiche produit,
celle que lit un agent qui n'ouvre pas le PRD, répète la même exclusion.

Trois des sept changements postérieurs aux onze PRP déplaçaient le périmètre —
le minuteur, les liens vidéo, et « L'équipe » sortie de l'écran perso pour
devenir un onglet, ce que le § 7.5 décrivait autrement. Aucun des trois n'a
touché le PRD.

**Cause** — rien n'oblige à rouvrir le PRD quand un ajout dépasse les PRP, et
rien ne le signale. Le seul ajout correctement reporté (le dénominateur du
classement, `922e1d9`) l'a été parce qu'il corrigeait une règle métier déjà
écrite au § 9 : le travail passait par le document, donc le document a suivi.
Une capacité *neuve* ne passe par aucune ligne existante — elle s'ajoute à côté
du PRD, jamais dedans. C'est exactement le cas que ni `--check` ni `pret.sh` ne
regardaient.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `pret.sh` voit passer les fichiers ajoutés par la
branche ; un fichier de code neuf dans une app dont le `PRODUCT.md` n'est pas
touché est le signal exact, et il ne se déclenche pas sur les corrections.

### 2. Une capacité livrée dont la demande n'existe nulle part dans le dépôt

**Symptome** — les liens vidéo (`a24674f`) n'ont ni PRP, ni ligne de PRD, ni
entrée de journal : le seul endroit du dépôt où cette capacité est justifiée est
le message de commit qui l'introduit. Le minuteur (`538e523`) est dans le même
cas ; seule sa *correction* du lendemain a laissé une trace, parce qu'elle est
née d'une anomalie et que les anomalies, elles, ont un registre.

**Cause** — le journal enregistre les anomalies, les PRP enregistrent le travail
planifié, et le PRD enregistre les décisions. Un ajout demandé de vive voix
après la livraison ne tombe dans aucun des trois : il n'a mal tourné nulle part,
il n'était pas planifié, et il n'a pas été arbitré par écrit. Le dépôt n'avait
donc pas d'endroit pour lui — ce qui se lit, à tort, comme la permission de ne
rien écrire.

**Detecte par** — `auteur`

**Action** — `contrat` — le PRD reçoit une section « Ajouté après les PRP » ;
c'est l'endroit manquant, et le contrat dit désormais qu'il faut le remplir.
