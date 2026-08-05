# 2026-08-05 — claude/prd-prp-app-locations-77cstg

Branche : `claude/prd-prp-app-locations-77cstg`
Périmètre : fabrique, marcq-handball, ardoise, compteur, ramure-v2
Mode : `chaud`

## Anomalies

### 1. Les documents produit d'une app avaient trois domiciles, et rien ne l'interdisait

**Symptome** — un inventaire des PRD et PRP a trouvé trois emplacements en
usage simultané pour six apps : `apps/<nom>/PRODUCT.md` (cinq apps),
`docs/superpowers/specs/*-prd.md` (trois apps, dont `marcq-handball` qui n'avait
aucun document dans son répertoire), et `docs/superpowers/plans/ramure-v2/`
pour les PRP d'une app dont toutes les autres tiennent leurs PRP dans
`apps/<nom>/prp/`. Deux plans concurrents décrivaient `ramure-v2` : un plan
monolithique de 2282 lignes et la série de PRP qui l'a remplacé, sans qu'aucun
des deux ne renvoie à l'autre.

**Cause** — les compétences `superpowers` écrivent leurs specs et leurs plans
sous `docs/superpowers/`, ce qui est juste pour un sujet de fabrique et faux
pour un sujet d'app. Le contrat ne disait rien de `docs/` — il ne le mentionne
même pas dans son arborescence — et `--check` ne regardait que l'existence de
`apps/<nom>/PRODUCT.md`. Un document d'app posé ailleurs n'était donc ni
interdit, ni signalé, ni même visible : le contrôle de liens morts ne lit pas
`docs/`.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `--check` refuse désormais un document sous `docs/`
dont le chemin nomme une app ; le contrat dit où vivent PRD et PRP.

### 2. `--add` aurait écrasé le PRD qu'on venait de rapatrier

**Symptome** — en déplaçant le PRD de `marcq-handball` vers
`apps/marcq-handball/PRODUCT.md`, on le posait exactement sur le fichier que
`./init.sh --add marcq-handball` écrit sans condition — première tâche du PRP 01
de cette app, encore à exécuter. Le répertoire n'ayant pas d'`app.yml`, `--add`
s'y exécute sans `--force` : le PRD de 496 lignes aurait été remplacé par un
gabarit de TODO, sans avertissement.

**Cause** — `--add` traitait `README.md` et `PRODUCT.md` comme des artefacts
dérivés, au même titre que `app.yml` ou `.dockerignore`. Or ce sont les deux
seuls qu'un humain peut légitimement avoir écrits **avant** le code — c'est la
séquence que le contrat recommande lui-même, PRD puis PRP puis l'app. Le
commentaire de `--add` anticipait déjà le cas d'un répertoire ne contenant que
des documents, mais pour autoriser l'échafaudage, pas pour protéger ces
documents.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `--add` conserve `README.md` et `PRODUCT.md` quand
ils existent, `--force` compris : personne n'invoque `--force` pour perdre un
PRD.

### 3. Le PRP 01 de marcq-handball portait un second PRODUCT.md, en gabarit

**Symptome** — `apps/marcq-handball/prp/01-socle.md` contenait, dans un bloc de
code de 63 lignes, le texte complet du `PRODUCT.md` à créer : une fiche produit
courte, marquée « dérivé du PRD, qui reste la source ». Deux documents produit
pour une app qui n'a pas encore une ligne de code, dont un caché dans un plan
d'implémentation.

**Cause** — le PRD vivant hors du répertoire de l'app, le PRP a dû prévoir de
fabriquer sur place le fichier que `--check` réclame. Le contenu de cette fiche
est réel et validé ; c'est son emplacement qui était accidentel.

**Detecte par** — `auteur`

**Action** — `rien` — la fiche est devenue l'en-tête du `PRODUCT.md` rapatrié,
et le PRP renvoie au fichier au lieu de le recopier.
