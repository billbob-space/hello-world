# 2026-09-02 — fabrique/memswap-apps

Branche : `fabrique/memswap-apps`
Périmètre : fabrique
Mode : `retrospective`

## Anomalies

### 1. Un correctif appliqué sur le serveur, jamais commité

**Symptome** — `memory.swap.max = 0` sur le cgroup d'`ardoise`, alors que ni
`compose.yaml` ni `init.sh` ne portaient de `memswap_limit`. Le dépôt décrivait
une plateforme qui n'était plus celle qui tourne, et personne ne pouvait le voir
en lisant le dépôt seul.

**Cause** — le correctif de swap du 2026-08-26 a été appliqué en direct sur les
conteneurs et dans les fichiers de l'hôte, sans passer par une branche. La copie
locale du dépôt est en outre restée 74 commits en arrière, ce qui rendait tout
report ultérieur plus risqué qu'il n'aurait dû l'être.

**Detecte par** — `auteur`

**Action** — `garde-fou` — rien ne compare le `compose.yaml` committé à ce qui
tourne réellement. Un contrôle qui lit `memory.swap.max` des cgroups et le
confronte au manifeste attraperait cette classe d'écart, ici comme ailleurs.

### 2. La conversion en octets tronquait, et rendait un swap SOUS la limite RAM

**Symptome** — `mem_to_swap_bytes` passait par `mem_to_mb`, qui rend des Mo
entiers : `512k` y vaut 0 Mo, donc `memswap_limit: 1` pour un `mem_limit: 512k` ;
`100000000` vaut 95 Mo, donc un memswap inférieur au mem_limit. Les trois
validations de manifeste acceptent pourtant le suffixe `k` et la valeur nue.

**Cause** — réutilisation d'une fonction existante par commodité, sans vérifier
son domaine de définition. `mem_to_mb` est juste pour ce qu'elle nomme — des Mo —
et le défaut n'apparaît que dans la conversion inverse.

**Detecte par** — `relecture`

**Action** — `garde-fou` — corrigé par `mem_to_bytes()`, qui convertit sans
détour, et fixé par trois cas de `test-init.sh`. Sans eux, retirer la ligne des
générateurs laissait tout vert : compose et générateur retombent d'accord entre
eux, donc le contrôle de désynchronisation ne mord pas.

### 3. Branche ouverte hors de l'outillage

**Symptome** — première tentative sur une branche `fix/memswap-apps`, préfixe
hors vocabulaire, sans entrée de journal. `pret.sh` l'aurait refusée ; le commit
est passé parce qu'il a été fait à la main, `git commit` directement.

**Cause** — commit fabriqué sans passer par `./scripts/branche.sh`, dans un
dépôt dont les conventions vivent précisément dans cet outillage.

**Detecte par** — `relecture`

**Action** — `comportement` — dans ce dépôt, ouvrir la branche par
`./scripts/branche.sh` et finir par `./scripts/pret.sh`, plutôt que de commiter
à la main puis de découvrir les règles par le refus de la CI.
