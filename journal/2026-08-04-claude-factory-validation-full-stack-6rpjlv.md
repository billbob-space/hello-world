# 2026-08-04 — claude/factory-validation-full-stack-6rpjlv

Branche : `claude/factory-validation-full-stack-6rpjlv`
Périmètre : fabrique, ardoise
Mode : `chaud`

> Validation de bout en bout de la fabrique par une application volontairement
> minimale mais complète — front, back, base de données, cache — menée en six
> phases, chacune vérifiée avant la suivante. Les anomalies ci-dessous sont
> celles de la **fabrique**, pas celles de l'application : c'est la fabrique qui
> est l'objet du test.

## Anomalies

Phase 0 et phase 1 sans anomalie : `--branche` a rejoint la branche existante et
ouvert l'entrée, `--check` est resté vert, `--pret` a refusé le gabarit nu —
c'est son travail.

### 1. `--add` refuse un répertoire que `--check` déclare ne pas être une application

**Symptome** — `apps/ardoise/` ne contenait que `prp/`, cinq documents
d'implémentation écrits avant le code. `./init.sh --check` l'ignorait avec un
avertissement — `apps/ardoise : pas d'app.yml, ignore` — et `./init.sh --add
ardoise` a refusé : `apps/ardoise existe deja (--force pour reecrire ses
fichiers d'echafaudage)`. Il a fallu `--force` pour échafauder une application
qui n'existait pas encore.

**Cause** — `--add` teste l'existence du **répertoire**, alors que
`discover_apps` — le seul endroit du script où « application » est défini — teste
l'existence de `app.yml`. Les deux ne répondent pas la même chose à la même
question, et c'est `--force`, dont le nom promet d'écraser du travail, qui
tranche.

Ce n'est pas un cas tordu : c'est la séquence que la fabrique recommande
elle-même. `apps/marcq-handball/` vit dans le dépôt depuis une semaine avec ses
onze PRP et pas une ligne de code, et son `prp/README.md` prévient déjà que les
garde-fous ne s'accordent pas sur ce cas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — faire tester à `--add` la présence de `app.yml`, comme
`discover_apps`, et ne réclamer `--force` que si une application est réellement
là.

### 2. Le scan des secrets se déclenche sur une ligne de commentaire

**Symptome** — `./init.sh` a refusé de générer quoi que ce soit :

```
ERREUR : valeur ressemblant a un secret — aucun artefact n'a ete genere.
  fabrique.yml:66 la cle « requirepass » porte une valeur litterale
```

La ligne 66 était un commentaire expliquant pourquoi ce Redis **n'a pas** de mot
de passe : `# Pas de --requirepass : redis n'est joignable que depuis apps_net`.
Le mot suivi de ` : ` puis de `redis` a été lu comme une clé portant une valeur
littérale.

**Cause** — le scan lit le fichier ligne à ligne, commentaires compris. C'est
délibéré et c'est juste : un secret collé dans un commentaire est un secret dans
le dépôt. Mais rien ne distingue une **valeur** d'un mot de prose, et documenter
une décision de sécurité déclenche donc le garde-fou qui l'applique.

Le contournement — reformuler le commentaire — est le pire des résultats : il
apprend à ne plus écrire le mot, donc à ne plus expliquer la décision.

**Detecte par** — `test`

**Action** — `garde-fou` — sur une ligne de commentaire, exiger un signal plus
fort qu'un mot de prose : une valeur sans espace, d'une longueur ou d'une
composition qui ressemble à un secret. Le motif reste le même hors commentaire.

### 3. Une `command:` en liste perd ses éléments vides, en silence

**Symptome** — `fabrique.yml` déclare pour le cache :

```yaml
command: ["valkey-server", "--maxmemory", "64mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
```

`compose.yaml` en porte six éléments sur sept — le `""` final a disparu :

```yaml
command: ["valkey-server", "--maxmemory", "64mb", "--maxmemory-policy", "allkeys-lru", "--save"]
```

**Cause** — le lecteur de listes saute les éléments vides, ce qui est le bon
comportement pour une ligne blanche à l'intérieur d'une section en bloc, et le
mauvais pour un `""` explicite d'une liste en ligne. Or `""` est précisément la
façon dont Redis et Valkey désactivent la persistance sur disque.

Le contrat promet l'inverse, en toutes lettres dans `fabrique.yml` : « elle est
lue et émise **EN ENTIER** dans les deux cas ». Ici le manifeste dit une chose
et le déploiement en fait une autre, sans un mot.

Vérifié en conteneur : `valkey-server --save` sans argument désactive aussi la
persistance — `CONFIG GET save` répond vide. L'effet est donc le même **par
chance**, sur cette commande-là. Sur une autre, l'écart serait silencieux et
réel.

**Detecte par** — `relecture`

**Action** — `garde-fou`, corrigé dans cette branche — et le correctif a
découvert un **second** bug empilé sous le premier, invisible tant que le
premier n'était pas levé.

Couche 1, dans `init.sh` : `ylist` et `ymaps` (les deux lecteurs de listes —
sections simples et listes de mappings) suppriment un élément dès que sa
valeur nettoyée est vide, qu'il ait été écrit `""` ou qu'il soit une ligne
blanche à l'intérieur d'un bloc. Corrigé en distinguant les deux à la source :
un élément **explicitement cité** (`""`, `''`) est désormais toujours émis,
même vide ; un élément qui n'a jamais porté de guillemets ne l'est pas.

Couche 2, une fois la première levée : l'élément vide traversait bien `ymaps`
et `cmd_argv`, mais disparaissait encore. `aux_block` assemble `command:` à
partir d'un tableau bash `CMD_ARGV` recollé en chaîne par
`cmd=$(printf '%s\n' "${CMD_ARGV[@]}")` — une **substitution de commande**, qui
retire INCONDITIONNELLEMENT tous les retours à la ligne finaux. Un dernier
élément vide se traduit par une ligne blanche finale dans ce texte ; la
substitution l'efface, exactement comme les retours à la ligne de trop qu'elle
est censée nettoyer. Remplacé par `printf -v cmd`, qui assigne le texte produit
tel quel. Une fois ce point corrigé, un **second** piège identique est apparu
juste à côté : `mapfile -t argv <<<"$cmd"` relit ce texte via un here-string,
qui ajoute lui aussi, inconditionnellement, un retour à la ligne — l'élément
vide manquant devenait un élément vide **en trop**. Remplacé par
`mapfile -t argv < <(printf '%s' "$cmd")`, une substitution de PROCESSUS, qui
ne rejoue aucune des deux troncatures.

Trois correctifs pour un seul symptôme, chacun invisible tant que le
précédent n'était pas levé — c'est pour ça qu'il a fallu la stack réelle
(`valkey-cli CONFIG GET save`, un service qui démarre vraiment) pour le
confirmer résolu, pas seulement relire `compose.yaml`.

### 4. Fausse alerte : le `PRODUCT.md` échafaudé n'a pas à porter le schéma `impeccable`

**Symptome initial** — `--add … --ui` écrit un `PRODUCT.md` de quatre sections
sans le marqueur `<!-- impeccable:product-schema 1 -->`, alors que `hello-world`
et `cadran` en portent neuf, marqueur compris. J'ai d'abord noté ceci comme un
défaut d'outillage à corriger dans `init.sh`.

**Vérification, avant correctif** — `ramure`, également `ui: true`, ne porte
**pas** ce marqueur non plus, et suit un plan de dix-sept sections qui lui est
propre. Le fichier de référence du plugin (`impeccable/…/reference/init.md`)
confirme : le schéma marqué est écrit par la **propre étape d'initialisation
du plugin**, une interview qui produit « Write only confirmed facts... Omit
irrelevant sections », et « Preserve useful legacy headings » — il attend
explicitement de trouver un fichier existant, pas nécessairement dans son
propre format, et le fait évoluer. Rien dans le contrat ni dans le plugin
n'exige que le gabarit d'`--add` anticipe ce schéma.

**Conclusion** — pas une anomalie de la fabrique : le gabarit générique à
quatre sections est un point de départ légitime, et `ramure` prouve qu'un
`PRODUCT.md` `ui: true` sans ce marqueur n'est pas une non-conformité. Corriger
`init.sh` ici aurait verrouillé toute app dans un schéma qu'elle n'a pas
forcément choisi.

**Detecte par** — `relecture`

**Action** — `rien` — hypothèse fausse, écartée avant tout changement de code.

### 5. Deux documents du dépôt affirment des faits que la fabrique a démentis

**Symptome** — deux affirmations fausses, sur des sujets où elles orientent une
décision :

- `apps/marcq-handball/prp/README.md` explique que `--pret` échoue sur une
  application réduite à des documents (« `[marcq-handball] test.sh absent ou non
  executable` ») parce qu'`apps_touchees` ne repasse pas par `discover_apps`.
  **Vérifié, et déjà faux** : `apps_touchees` (`init.sh`) teste bien la présence
  de `apps/$a/app.yml` avant de retenir une app touchée — testé sur cette
  branche avec un répertoire `apps/temoin-touchee/prp/` ajouté au suivi git,
  `--pret` ne le mentionne pas. Le bug que ce passage décrit n'existe plus ; je
  l'avais moi-même repris comme acquis dans un brouillon de cette entrée, avant
  de le vérifier — la même leçon que l'anomalie suivante, appliquée à mon propre
  travail.
- `apps/ramure/cache.go` justifie son cache en mémoire par « la fabrique n'offre
  ni base de données ni volume persistant ». Elle les offre : `memory/perimetre.md`
  ouvre par « ce qui **t'appartient désormais** : une base de données, un cache,
  un volume persistant, un service annexe ».

**Cause** — le contrat et `init.sh` évoluent ; les documents qui les citent ne
sont relus par personne. `--check` vérifie les liens morts entre documents, pas
les affirmations mortes.

**Detecte par** — `relecture`

**Action** — `contrat` — corriger les deux passages. Aucun garde-fou raisonnable
ne détecte une affirmation périmée ; ce qui se tient, c'est la règle de relire
les documents d'une app quand le chapitre du contrat qu'ils citent bouge.

### 6. `GOWORK` global fait qu'une simple commande `go` corrompt `go.work`

**Symptome** — `go.work` est un artefact généré, marqué « NE PAS EDITER » comme
`compose.yaml`. Une commande aussi anodine que `go get` lancée **hors du dépôt**,
dans un répertoire scratch sans rapport, l'a pourtant réécrit : `go 1.24` est
devenu `go 1.25.0`, et l'espacement entre les `use` a changé. `git diff` l'a
montré après coup ; rien avant n'avait signalé l'écriture.

**Cause** — la variable d'environnement `GOWORK` de cette machine pointe en dur
sur `/home/user/hello-world/go.work` (`go env GOWORK`), donc **toute** commande
`go`, où qu'elle s'exécute, opère sur l'espace de travail du dépôt. Un module qui
exige un `go` plus récent que ce que `go.work` déclare (ici `pgx/v5` récent, qui
demandait `go >= 1.25`) déclenche `GOTOOLCHAIN=auto` : le binaire télécharge et
utilise un toolchain plus recent, puis **réécrit le fichier généré** pour que
l'incohérence disparaisse. `init.sh` n'est jamais dans la boucle.

**Cause additionnelle, distincte** — même en isolant les commandes avec
`GOWORK=off`, `go mod tidy` a écrit dans `apps/ardoise/go.mod` un directive
trois-composants (`go 1.24.0` + `toolchain go1.24.7`) au lieu du `go 1.24` que
tous les autres `go.mod` du dépôt portent à la main. `go.work`, généré par
`emit_gowork` qui **écrit `go 1.24` en dur**, a alors refusé ce module :
`module . listed in go.work file requires go >= 1.24.0, but go.work lists go
1.24` — deux écritures numériquement équivalentes que le toolchain compare comme
inégales.

**Detecte par** — `auteur`

**Action** — `garde-fou`, en partie déjà pris. Corrigé dans cette branche :
`emit_gowork` (`init.sh`) écrit désormais `go 1.24.0`, trois composants —
vérifié qu'un go.work à trois composants satisfait à la fois un `go.mod`
d'app à deux composants (`hello-world`, `cadran`, `ramure`, tous « go 1.24 »
écrits à la main) et un `go.mod` à trois composants tel que produit par un
`go mod tidy` récent (`ardoise`, « go 1.24.0 » + `toolchain go1.24.7`) ; la
réciproque, testée aussi, échoue. Reste à faire, non corrigé ici : documenter
dans `memory/outillage.md` qu'un agent qui lance une commande `go` sur cette
machine — où que ce soit, `GOWORK` pointant en dur sur le dépôt — doit isoler
avec `GOWORK=off` tant que `./init.sh` n'a pas régénéré `go.work` pour l'app en
cours, sans quoi la commande réécrit silencieusement l'artefact généré.

### 7. Stats de tokens et de coût — hors de portée de cet agent

Demandé en cours de session : ajouter au journal une mesure de tokens consommés
et de coût en euros pour cette branche. Aucun outil de cette session n'expose
cette donnée à l'agent lui-même — ni consommation de tokens, ni coût, pour la
conversation en cours. Le chiffre ne peut donc pas être écrit ici sans être
inventé.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — si cette mesure a de la valeur pour la fabrique
(comparer le coût d'une validation de bout en bout à l'usage qu'elle prévient),
elle doit venir d'un instrument externe à l'agent — le tableau de bord de
facturation, ou un export de la plateforme — pas d'une estimation produite par
la session qu'elle est censée mesurer.

### 8. Phase 5 (bout en bout) : ce que ça a pris pour sortir du dépôt

**Symptôme** — construire l'image et monter la stack a exigé un contournement
que rien dans le contrat ne prévoit. `docker build` du `Dockerfile` réel
échoue dans cet environnement (`RUN go mod download` : `tls: failed to verify
certificate: x509: certificate signed by unknown authority`, y compris avec
`--network host`), parce que l'environnement de développement fait passer les
sorties HTTPS par un proxy qui re-signe le trafic — un conteneur Docker n'en
hérite pas et ne connaît pas son autorité de certification. Contourné en
construisant depuis un `Dockerfile` **jamais committé**, hors dépôt, qui copie
`/root/.ccr/ca-bundle.crt` dans l'étage de build.

**Cause** — c'est une propriété de **cet environnement de développement**, pas
du contrat de la fabrique : le contrat ne promet nulle part que `docker build`
fonctionne en local, et la CI, elle, a un accès réseau direct. Rien à corriger
dans `init.sh`. Mais rien ne le dit non plus : un agent qui découvre ceci pour
la première fois perd du temps à se demander si le `Dockerfile` est en cause.

**Detecte par** — `auteur`

**Action** — `contrat` — une ligne dans `memory/outillage.md` ou le `README`
de la fabrique, disant qu'un `docker build` local dans cet environnement exige
de faire confiance à `/root/.ccr/ca-bundle.crt` dans l'étage de build (ou de
construire ailleurs), pour que le prochain agent ne le redécouvre pas seul.

Une fois la construction possible, la stack réelle a validé ce que rien avant
ne pouvait montrer : les huit critères d'acceptation du PRD (A1 à A8), contre
un Postgres 17 et un Valkey 8 véritables, orchestrés à la main puis via
`e2e/lancer.sh` et une suite Playwright committée (`apps/ardoise/e2e/`) — A3
(conteneurs **détruits et recréés**, le volume `ardoise-donnees` a rendu les
lignes intactes), A6 (`redis` arrêté en cours de service, lectures et
écritures continuent), A7 (l'application démarrée **sans base du tout**
répond `200` sur `/healthz` et `503` en français sur `/api/lignes`, puis se
rétablit sans redémarrer quand la base arrive en retard), A8 (le parcours
navigateur complet, provenance affichée comprise).

### 9. Une hypothèse fausse sur le DOM, rattrapée par le test lui-même

**Symptôme** — le premier jet du test e2e « 140 caractères refusés » échouait :
le navigateur **tronque lui-même** la valeur d'un `<textarea maxlength="140">`
posée par script, y compris hors saisie utilisateur, ce que je n'avais pas
anticipé. La ligne de 150 caractères n'atteignait donc jamais le serveur à
141+ caractères — le test constatait un succès (`201`), pas un refus.

**Cause** — une hypothèse fausse sur le DOM : je pensais `maxlength` limité à
la saisie utilisateur (frappe, collage), pas à une affectation programmatique
de `.value`. Corrigé en testant ce que le navigateur fait réellement (la
valeur reste plafonnée à 140), la règle serveur (R2) restant seule couverte,
exhaustivement, par `domaine_test.go`.

**Detecte par** — `test`

**Action** — `rien` — rattrapée avant tout commit, rien à en tirer pour la
fabrique.
