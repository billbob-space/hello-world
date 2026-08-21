# 2026-08-21 — claude/update-project-docs-3ojnjq

Branche : `claude/update-project-docs-3ojnjq`
Périmètre : fabrique, ramure, ramure-v2 — documentation seulement, aucun
comportement applicatif touché
Mode : `chaud`

Sujet : remettre d'aplomb toute la documentation du dépôt sur l'état réel du
code. Relevé d'entrée : le `README` racine décrit 6 applications sur 10, annonce
deux paliers d'exposition sur trois, trois volumes sur six, et un décompte
d'outillage qui date de deux plugins en arrière.

## Anomalies

### 1. Le garde-fou des tests cités ne regarde qu'un seul répertoire

**Symptome** — `./init.sh --check` avertit sept fois que `apps/ramure-v2/PRODUCT.md`
cite un test « introuvable dans les tests de l'app ». Six des sept existent
pourtant, et passent.

**Cause** — `check_traces_risques` construit sa liste de tests par
`ls apps/<n>/*_test.go apps/<n>/tests/*.test.js`. `ramure-v2` range ses tests Go
sous `internal/**/` et ses tests de vue sous `web/tests/*.test.ts` : aucun des
deux motifs ne les atteint. Le contrôle ne dit donc pas « le PRD ment », il dit
« je n'ai pas cherché là ». Sept avertissements dont six faux valent moins que
zéro : ils apprennent à ne plus lire la sortie.

**Detecte par** — `auteur`

**Action** — `garde-fou` — la liste des tests se cherche récursivement, sinon le
contrôle ne vaut que pour les apps dont le code est à plat.

### 2. Un septième avertissement, vrai celui-là, caché par les six faux

**Symptome** — une fois le garde-fou réparé, il reste un seul avertissement :
`TestCadragePlusEtroitSurEcranEtroit`, cité par le tableau de risques du PRD de
`ramure-v2`, n'existe nulle part. Le risque « le canevas exige de la place » —
moins de branches sur écran étroit — n'était donc tenu par aucun test côté
serveur. `TestLargeurInconnueRetombeSurLarge` couvrait le repli, jamais la
réduction elle-même.

**Cause** — le PRD promettait le test, et le bruit des six faux positifs rendait
la sortie du contrôle illisible : sept avertissements identiques dans la forme,
aucune raison de les ouvrir un par un. C'est exactement le défaut que
`memory/produit.md` veut empêcher — une promesse écrite trois fois, tenue zéro
fois — et le garde-fou censé l'attraper le disait, sans être entendu.

**Detecte par** — `relecture`

**Action** — `rien` — le test est écrit et passe ; la réparation du garde-fou,
elle, est l'anomalie 1.

### 3. Le README racine décrivait six applications sur dix

**Symptome** — la table des applications du `README` racine listait
`hello-world`, `cadran`, `ramure`, `ardoise`, `compteur` et `marcq-handball`.
Manquaient `estran`, `pilabelle`, `ramure-v2` et `renaissance-gym`, livrées et en
ligne ; `ramure`, elle, y figurait avec une URL alors qu'elle est retirée de la
stack depuis le 20 août. Même dérive ailleurs : deux paliers d'exposition
annoncés sur trois, trois volumes nommés sur six, un plafond mémoire « dépassé »
qui ne l'est plus, un décompte d'outillage de deux plugins en retard, et
`.claude/cloud-setup.sh` présenté deux fois comme GÉNÉRÉ alors qu'il est édité à
la main.

**Cause** — rien ne rattrapait la dérive documentaire. `--check` lit pourtant ces
fichiers : il y traque les liens morts et les titres en double, mais un lien vers
un **répertoire** (`(apps/estran/)`) n'est pas une cible en `.md` et échappait
donc au contrôle. Ajouter une app touche `app.yml`, `compose.yaml` et
`go.work` — tous régénérés et vérifiés — et jamais le `README`, que personne ne
relit puisque rien ne s'en plaint.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `--check` compare désormais la table des applications
du `README` au contenu de `apps/`, dans les deux sens. Avertissement et non KO :
un `README` incomplet ne casse aucun déploiement, et arrêter la CI de tout le
monde sur une ligne de tableau serait hors de proportion.
