# 2026-08-03 — claude/config-french-responses-3cl6nk

Branche : `claude/config-french-responses-3cl6nk`
Perimetre : fabrique — `CLAUDE.md` uniquement, aucune app touchee

Ajout au contrat d'une section `Comment tu reponds` : francais, court, vulgarise
pour un lecteur non technicien.

## Anomalies

### 1. Le contrat ne disait rien de la langue ni du registre des reponses

**Symptôme** — le dépôt est intégralement en français — contrat, journal,
messages de commit, `init.sh` jusque dans ses options (`--branche`, `--pret`) —
mais rien n'imposait la langue des **réponses**. Rien non plus sur leur longueur
ni sur le niveau technique du lecteur. Une session lisant `CLAUDE.md` de bout en
bout pouvait donc répondre en anglais, ou dérouler des noms de fichiers et des
sorties de commande à quelqu'un qui ne lit pas de code, sans enfreindre une seule
règle écrite.

**Cause** — le contrat a été écrit pour décrire des **artefacts** : ce que
contient un `app.yml`, ce que doit faire un `Dockerfile`, ce que vérifie
`--check`. La conversation elle-même n'est pas un artefact du dépôt, elle est
donc restée hors du périmètre — alors que c'est le seul livrable que
l'utilisateur reçoit à chaque tour.

**Detecte par** — `utilisateur` — il a fallu qu'il le demande. Aucun garde-fou ne
pouvait le voir : rien de ce qui est vérifiable dans le dépôt n'était en cause.

**Action** — `contrat` — section `Comment tu réponds` ajoutée juste après
l'introduction, avant `Arborescence`. Placée en tête délibérément : c'est la
règle qui s'applique à chaque tour, et dans un fichier de cinq cents lignes une
règle enfouie pèse moins qu'une règle lue en premier.

### 2. La regle nouvelle contredisait deux regles deja ecrites

**Symptôme** — « fais court » et « vulgarise » entrent en collision frontale avec
deux exigences existantes du contrat : le raisonnement détaillé **doit** aller
dans les messages de commit, et le journal **doit** retenir les anomalies avec
leur cause. Prise au pied de la lettre, la nouvelle section faisait de chaque
message de commit dense une infraction.

**Cause** — mon erreur de cadrage. J'ai d'abord rédigé la règle comme un style
global — « réponds simplement » — sans distinguer ce que l'agent **dit** de ce
qu'il **écrit dans le dépôt**. Ce sont deux livrables, avec deux lecteurs
différents : l'utilisateur d'un côté, un développeur ou un agent de l'autre. La
contradiction n'est apparue qu'en relisant la section à côté de
`La pull request se lit en trente secondes`.

**Detecte par** — `auteur` — en cours de rédaction, avant tout commit.

**Action** — `contrat` — la section délimite maintenant sa propre portée par un
paragraphe final explicite : commits, `journal/`, `README` et corps de PR gardent
leur précision technique. Une règle de style qui ne dit pas où elle s'arrête
finit par être appliquée là où elle nuit.
