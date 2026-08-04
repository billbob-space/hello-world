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

### 4. Un PRD d'app existant avait échappé dans `docs/`, dupliqué à l'octet

**Symptome** — `docs/PRD-RAMURE.md` (625 lignes) était strictement identique,
octet pour octet (`cmp -s`), à `apps/ramure/PRODUCT.md` déjà présent et déployé.
Aucun contrôle ne le voyait : le contrôle de liens morts ne regarde que les
liens markdown, pas le contenu des fichiers.

**Cause** — Introduit en un seul commit (« ramure-v2 : PRD et plan
d'implementation des lots MVP et V1 », PR #32) : en écrivant le plan de
`apps/ramure-v2/` — une réécriture prévue de `ramure`, pas un produit distinct —
l'agent a copié le PRD existant dans `docs/` au lieu d'y renvoyer directement.
Le journal avait déjà signalé le même motif sur une branche abandonnée
(`2026-08-03-claude-analyze-cleanup-merged-branches-12gta2.md`, anomalie 5),
mais sans garde-fou pour l'empêcher, il s'est reproduit sur une branche
différente et a fusionné.

**Detecte par** — `utilisateur` — l'utilisateur a demandé un garde-fou
d'arborescence après avoir remarqué des fichiers mal placés.

**Action** — `garde-fou` — `--check` refuse maintenant qu'un fichier hors de
`apps/*/` soit un doublon exact d'un `apps/<nom>/PRODUCT.md` ou `README.md` : un
domicile par app. Corrigé : le fichier supprimé, les cinq renvois du plan
`ramure-v2` (non encore exécuté) redirigés vers `apps/ramure/PRODUCT.md`.

### 5. Un lien relatif s'est cassé en changeant de répertoire, silencieusement

**Symptome** — En déplaçant le chapitre « Ce qui ne t'appartient pas » vers
`memory/perimetre.md`, un lien markdown vers le README de la racine — valide
depuis `CLAUDE.md` — pointait après coup vers un fichier inexistant dans
`memory/`. Rien ne l'aurait montré sans relancer `--check` juste après.

**Cause** — Un déplacement de contenu markdown change le répertoire de
référence de tous ses liens relatifs, et rien ne le rappelle en écrivant le
fichier. Le contrôle de liens morts existant l'a rattrapé immédiatement — c'est
lui qui a nommé le fichier et la cible manquante — mais seulement parce que
`--check` tournait après chaque déplacement, comme le prévoyait le plan.

**Detecte par** — `auteur` — `./init.sh --check`, relancé après le déplacement,
avant tout commit.

**Action** — `rien` — le garde-fou existant (liens morts) a fait exactement ce
pour quoi il existe ; la parade est déjà le rythme du plan, pas un nouveau
contrôle.

### 6. Un découpage de plage par ligne a effacé les trois lignes d'un tableau

**Symptome** — En condensant le chapitre des paliers d'exposition (tâche 4), un
premier découpage par numéro de ligne (`sed -n '1,199p'`) s'est arrêté juste
après l'en-tête du tableau des trois paliers, sans ses trois lignes de données.
Le tableau généré ne portait plus que ses deux premières lignes — repéré en
relisant le fichier après coup, avant `--check`.

**Cause** — Compter une plage de lignes à la main, dans un fichier qui vient
d'être modifié par l'étape précédente, se trompe facilement d'une ligne — le
tableau suivait immédiatement le paragraphe que je pensais couper après. Aucun
contrôle ne vérifie qu'un tableau markdown garde ses lignes de données après une
édition.

**Detecte par** — `auteur` — relecture du fichier immédiatement après l'édition,
avant `--check` et avant tout commit.

**Action** — `comportement` — après un découpage de plage par numéro de ligne
sur un fichier tout juste modifié, relire le résultat avant de continuer, pas
seulement compter les lignes retirées/ajoutées.

### 7. Décrire un lien cassé dans le journal a cassé le journal lui-même

**Symptome** — En rédigeant l'anomalie 5 ci-dessus, citer littéralement l'ancien
lien fautif entre apostrophes inverses (markdown pour markdown) a produit la
même syntaxe `](...)` que le contrôle de liens morts recherche. `--check` a
échoué sur ce fichier de journal, pour un lien qui n'en était pas un — il
décrivait un lien, il n'en posait pas.

**Detecte par** — `compilateur` — `--check`, immédiatement, avant tout commit.

**Action** — `rien` — corrigé en reformulant sans la syntaxe entre crochets ;
le contrôle a raison de refuser toute occurrence du motif, décrire un lien
cassé sans le montrer littéralement est la bonne habitude à prendre.
