# 2026-08-04 — claude/factory-memory-architecture-m0dpb5

Branche : `claude/factory-memory-architecture-m0dpb5`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. Le travail d'une session cloud avait disparu sans que rien ne le signale

**Symptome** — La session s'ouvre sur « reprends la branche
`claude/factory-memory-architecture-n3unga` ». Cette branche n'existe ni
localement, ni sur le distant : `git ls-remote` liste vingt branches, aucune ne
porte ce nom, aucune PR ne la mentionne, aucune entrée de `journal/` ne lui
correspond. Le lien de session `claude.ai/code/session_...` fourni ensuite
renvoie `HTTP 403` — il n'est lisible que dans le navigateur de son
propriétaire. Le disque du conteneur ne contient que la conversation courante.
Le travail est perdu, et rien n'en avait averti l'utilisateur.

**Cause** — Une session cloud vit dans un conteneur éphémère : ce qui n'est pas
poussé disparaît avec lui. Deux garde-fous couvrent le voisinage sans couvrir ce
cas : `garde-branche.sh` refuse d'éditer sur `main`, `garde-commit.sh` refuse de
terminer sur un arbre de travail sale. Aucun ne regarde si les commits ont été
**poussés**, ni si une branche a jamais été créée. Une session qui n'a rien
committé du tout sort donc proprement, en ayant tout perdu.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — le hook `Stop` devrait refuser de terminer sur une
branche dont le HEAD n'est pas sur le distant, pas seulement sur un arbre sale.

### 2. J'ai diagnostiqué le mauvais problème pendant deux questions

**Symptome** — Faute de pouvoir récupérer la session perdue, j'ai reconstruit le
sujet à partir du nom de la branche — « factory memory architecture ». J'ai
agrégé les récurrences du journal, mesuré deux familles d'anomalies, et proposé à
l'utilisateur de choisir laquelle empêcher de revenir. Sa réponse : « le problème
c'est la taille du claude.md ». Deux questions et une analyse pour rien.

**Cause** — J'ai déduit l'intention d'un nom de branche au lieu de la demander.
Mes deux premières questions supposaient déjà le sujet — elles proposaient des
choix *à l'intérieur* de mon hypothèse, ce qui la rendait invisible : aucune des
options offertes ne permettait de dire « ce n'est pas le sujet ». Une question
ouverte en premier — « qu'est-ce que ça doit changer pour toi ? » — aurait coûté
un aller-retour au lieu de trois.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand le sujet est reconstitué et non reçu, la
première question doit être ouverte, et l'hypothèse doit être dite avant d'être
instrumentée.

### 3. Le générateur porte 870 lignes de copies de fichiers déjà versionnés

**Symptome** — Sur les 3 848 lignes de `init.sh`, environ 870 sont des gabarits
de fichiers qui existent par ailleurs dans le dépôt : le workflow de CI (382),
les deux agents (149), `cloud-setup.sh` (97), `check-plugins.sh` (77), les deux
hooks (79), `settings.json` (61), le gabarit de PR (26). `--check` refuse qu'ils
diffèrent du gabarit, donc toute correction passe par l'édition d'un texte
enfoui dans un script bash, suivie d'un `./init.sh`.

**Cause** — Le contrat présente `init.sh` comme le générateur de l'outillage,
avec pour justification qu'un clone reparte avec le même outillage. C'est git qui
le garantit. Le générateur n'apporte cela qu'une fois, à l'amorçage d'un dépôt
vide — scénario qui ne se reproduira pas. Personne ne l'avait relevé parce que le
coût est diffus : il se paie à chaque correction, jamais d'un coup.

**Detecte par** — `utilisateur`

**Action** — `outillage` — l'outillage sort du générateur (lot 2 de la
conception) ; `--check` vérifie une propriété utile au lieu d'une égalité au
gabarit.
