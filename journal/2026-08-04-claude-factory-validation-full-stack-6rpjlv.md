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

**Action** — `garde-fou` — distinguer l'élément vide explicite d'une ligne
blanche, ou refuser la génération plutôt que d'émettre une commande différente
du manifeste.

### 4. Le `PRODUCT.md` échafaudé ignore le schéma que `ui: true` installe

**Symptome** — `--add … --ui` a écrit un `PRODUCT.md` de quatre sections
(`Users`, `Product Purpose`, `Capabilities and Constraints`, `Product
Principles`) sans le marqueur `<!-- impeccable:product-schema 1 -->`. Les deux
applications `ui: true` du dépôt en portent neuf, marqueur compris.

**Cause** — `ui: true` ajoute le plugin `impeccable` à l'outillage, mais le
gabarit d'échafaudage n'a pas suivi : il est resté celui d'une app sans
interface. L'agent qui remplit les quatre sections proposées produit un document
que son propre outillage ne reconnaît pas.

**Detecte par** — `relecture`

**Action** — `outillage` — faire dépendre le gabarit de `PRODUCT.md` de `ui:`,
et y poser le marqueur de schéma quand l'interface existe.

### 5. Deux documents du dépôt affirment des faits que la fabrique a démentis

**Symptome** — deux affirmations fausses, sur des sujets où elles orientent une
décision :

- `apps/marcq-handball/prp/README.md` explique que `--pret` échoue sur une
  application réduite à des documents. C'est encore vrai aujourd'hui — l'anomalie
  1 ci-dessus n'est pas corrigée — mais le texte affirme que « l'écart entre les
  deux garde-fous appartient à la fabrique » comme une évidence acquise, sans
  dire que le correctif reste à faire. Rien de faux ici, mais une formulation qui
  vieillira mal dès que l'anomalie 1 sera corrigée : le passage devra être retiré
  à ce moment-là, pas laissé à décrire un bug disparu.
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
