# 2026-08-21 — claude/bonjour-snxoni

Branche : `claude/bonjour-snxoni`
Périmètre : fabrique
Mode : `chaud`

Compactage de `CLAUDE.md` avec la compétence `compact-claude-md` : 271 → 222 lignes,
2 418 → 1 823 mots, soit ~1 100 jetons de moins à chaque tour de chaque session.

Le tri a été vérifié contre le dépôt plutôt qu'à vue : `./init.sh --help` pour ce qui
était déjà découvrable, les deux hooks et les en-têtes `Tenu par` de `memory/` pour ce
qui était déjà tenu par un contrôle, et les 364 anomalies des 53 entrées de journal pour
savoir quelles règles avaient déjà servi. Ce dernier point a changé deux verdicts :
« déléguer à `artisan` » (69 mentions) et « grouper les appels d'outils » (30 mentions)
ressemblaient à des évidences, le journal dit qu'elles récidivent — gardées.

L'essentiel du gain vient des justifications (`DROP-HISTORY`) et des sections recopiées
du contrat alors que le sommaire de `memory/` y renvoie déjà. Aucun garde-fou n'est
parti : les 24 termes impératifs du contrat sont présents avant et après.

## Anomalies

### 1. Le contrat a dépassé son propre budget pendant plusieurs branches sans que rien ne l'arrête

**Symptome** — `./init.sh --check` affichait « CLAUDE.md 271 lignes, au-dela de 250 »
à chaque passage, sur une branche puis la suivante. Le contrat a continué de grossir :
l'avertissement était rendu à chaque fois, et à chaque fois rien n'en découlait.

**Cause** — le contrôle est un `warn` et non un `bad`, choix délibéré et commenté dans
`init.sh` (« un contrat a 260 lignes n'est pas un defaut de deploiement »). Le
raisonnement est juste sur le déploiement, mais il laisse le seul signal de dérive dans
un flot d'une centaine de lignes vertes, où il se lit comme du décor. La dérive que le
garde-fou devait rendre visible est redevenue invisible parce qu'il ne bloque pas.

**Detecte par** — `relecture`

**Action** — `arbitrage` — passer ce `warn` en `bad` rendrait le contrat bloquant pour
un dépassement d'une ligne, ce qui gêne au mauvais moment ; l'alternative est de faire
remonter les avertissements en fin de sortie plutôt que dans le flot. Les deux se
défendent, et c'est une décision qui appartient à l'utilisateur, pas un correctif.

### 2. Le gain d'un compactage annoncé en lignes, mesuré en mots : l'annonce était fausse de 40 %

**Symptome** — le tri annonçait « 271 lignes → ~160 ». Le premier passage, qui appliquait
pourtant tous les verdicts annoncés sans exception, a rendu 232 lignes. Un second passage
a été nécessaire pour approcher la promesse, et elle n'a jamais été tenue : 222.

**Cause** — l'estimation a été faite en comptant les lignes que les verdicts allaient
retirer, comme si une ligne supprimée était une ligne de moins. Elle ne l'est pas : le
fichier est en Markdown replié à ~90 colonnes, donc retirer une justification de vingt
mots au milieu d'un paragraphe reflue les lignes suivantes et n'en supprime souvent
qu'une seule ; et ~40 % du fichier est structurel — titres de section, lignes vides,
tables — que le tri ne touche jamais. Le nombre de lignes n'est pas proportionnel à ce
qui est effectivement retiré.

**Detecte par** — `auteur`

**Action** — `comportement` — annoncer un compactage en mots ou en jetons, jamais en
lignes : ce sont les seules unités qui varient avec ce qu'on supprime réellement. Les
lignes ne servent qu'à parler au budget de `--check`, qui compte en lignes lui aussi.

### 3. Un commentaire d'`init.sh` nomme deux artefacts dérivés qui ne le sont plus

**Symptome** — en vérifiant la ligne du contrat qui énumère les artefacts générés, le
commentaire d'en-tête d'`init.sh` la contredit : il annonce « compose.yaml, le workflow,
.claude/, go.work » comme TOUJOURS réécrits, quand `CLAUDE.md` dit du workflow et de
`.claude/` qu'ils sont ordinaires.

**Cause** — `liste_derives()` ne rend que `compose.yaml`, `go.work` et les notices
`apps/*/CLAUDE.md` : c'est le contrat qui dit juste, et le commentaire qui a survécu au
retrait du workflow et de `.claude/` de la génération. Aucun contrôle ne relit les
commentaires, et celui-ci est en tête du fichier que lit quiconque veut comprendre la
génération — il fait croire qu'éditer `.github/workflows/build.yml` à la main serait
écrasé au prochain `./init.sh`, donc inutile.

**Detecte par** — `auteur`

**Action** — `rien` — corrigé dans la foulée, sur la même branche.
