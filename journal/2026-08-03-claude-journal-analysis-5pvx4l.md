# 2026-08-03 — claude/journal-analysis-5pvx4l

Branche : `claude/journal-analysis-5pvx4l`
Périmètre : fabrique
Mode : `chaud`

Première lecture du journal par l'`analyste`, puis mise en œuvre des deux
actions `garde-fou` de son plan : le champ `Mode`, et le refus d'un `Périmètre`
laissé au gabarit.

## Anomalies

### 1. Le gabarit émettait `Perimetre` sans accents, les trois auteurs ont écrit `Périmètre`

**Symptôme** — en écrivant le motif de vérification du champ, ancré en ASCII pur
comme le veut le commentaire d'`init.sh`, il serait sorti rouge sur **les trois**
entrées du journal. Aucune n'est fautive : c'est le gabarit généré qui écrit
`Perimetre`, et les trois auteurs sur trois qui l'ont réécrit `Périmètre`.

**Cause** — la règle « les étiquettes s'écrivent sans accents » a été posée pour
que le motif de vérification reste insensible à la locale, et elle vaut pour
`Detecte par` et `Action`. Mais `Perimetre` n'était vérifié par rien : la
divergence entre ce que le générateur émet et ce que les entrées portent
réellement pouvait courir indéfiniment sans que rien ne bronche. Elle n'est
apparue que le jour où le champ est devenu vérifié — c'est-à-dire au pire
moment, avec trois entrées déjà committées à réconcilier. Un champ généré que
personne ne vérifie dérive en silence, et la dérive ne se paie qu'à la première
tentative de vérification.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le gabarit suit désormais l'usage (`Périmètre`
accentué) et `--check` le vérifie, donc les deux formes ne peuvent plus
diverger. Le motif reste insensible à la locale : il compare des octets
littéraux, pas des classes de caractères.

### 2. Mon test négatif a conclu « aucun garde-fou ne se déclenche », à tort

**Symptôme** — après avoir câblé les quatre contrôles, je les ai éprouvés en
cassant volontairement une entrée. Les quatre cas ont rendu « (rien) » : aucun
`KO`. J'ai failli conclure que le code ne s'exécutait pas.

**Cause** — le `grep` de contrôle cherchait `ok .*entree\(s\)` et `KO .*journal`
dans une sortie qui porte des codes couleur ANSI : entre `ok` et l'espace
suivant, il y a `\033[0m`. Le motif ne pouvait matcher aucune ligne. Le
diagnostic n'a tenu que parce que la série comportait un **cas témoin** —
l'état restauré, qui devait sortir vert et sortait « rien » lui aussi. Un cas
censé passer et qui échoue comme les autres ne dit pas « le code est faux », il
dit « l'instrument est faux ».

**Detecte par** — `auteur`

**Action** — `comportement` — un test négatif sans cas témoin ne prouve rien :
il ne distingue pas « le garde-fou refuse » de « rien ne s'exécute ». Toute
série de cas censés échouer porte au moins un cas censé passer.

### 3. Une entrée ouverte avant le changement de gabarit reste au vieux format, en silence

**Symptôme** — l'entrée de cette branche, ouverte au début de la session,
portait l'en-tête d'avant : `Perimetre` en ASCII, pas de champ `Mode`. Relancer
`./init.sh` ne l'a pas mise à jour.

**Cause** — `journal_ouvre` ne réécrit jamais une entrée existante, et c'est
volontaire : elle contient du travail. La conséquence est qu'un changement de
gabarit ne se propage pas aux entrées déjà ouvertes, qui ne se voient qu'au
prochain `--pret`. Supprimer le fichier et relancer `--branche` suffit tant que
rien n'y est encore écrit.

**Detecte par** — `auteur`

**Action** — `rien` — le message de `--check` nomme le champ manquant, ce qui
suffit à réparer. Réécrire une entrée existante coûterait bien plus cher que le
cas qu'elle éviterait.
